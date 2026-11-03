import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { notify } from '../lib/notify.js';
import { publish } from '../lib/realtime.js';
import { extractMentions, plainText } from '../lib/mentions.js';
import { STEP_KEYS } from '../data/playbook.js';

/** Comment threads with @mentions on any league record. /api/leagues/:leagueId/comments */
const r = Router({ mergeParams: true });
r.use(requireAuth);

export const ENTITY_TYPES = ['Contract', 'WorkOrder', 'Rfq', 'SponsorDeal', 'JerseyDesign', 'PlaybookStep', 'Match'] as const;
const TEAM_VISIBLE = ['JerseyDesign', 'Match'];

/** Everyone who can be @mentioned in a league: owner, staff and team owners */
export async function leaguePeople(leagueId: string) {
  const l = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, select: {
    owner: { select: { id: true, name: true } },
    members: { select: { department: true, user: { select: { id: true, name: true } } } },
    teams: { select: { name: true, owners: { select: { user: { select: { id: true, name: true } } } } } },
  } });
  const out = [{ id: l.owner.id, name: l.owner.name, role: 'League Owner' }, ...l.members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.department }))];
  for (const t of l.teams) for (const o of t.owners) if (!out.some((x) => x.id === o.user.id)) out.push({ id: o.user.id, name: o.user.name, role: `${t.name} owner` });
  return out;
}

async function entityInfo(leagueId: string, type: string, id: string): Promise<{ title: string; link: string } | null> {
  const L = `/leagues/${leagueId}`;
  switch (type) {
    case 'Contract': { const x = await prisma.contract.findFirst({ where: { id, leagueId } }); return x && { title: x.title, link: `${L}/contracts/${id}` }; }
    case 'WorkOrder': { const x = await prisma.workOrder.findFirst({ where: { id, leagueId } }); return x && { title: `WO-${x.number} ${x.title}`, link: `${L}/procurement/work-orders/${id}` }; }
    case 'Rfq': { const x = await prisma.rfq.findFirst({ where: { id, leagueId } }); return x && { title: x.title, link: `${L}/procurement/rfqs/${id}` }; }
    case 'SponsorDeal': { const x = await prisma.sponsorDeal.findFirst({ where: { id, leagueId } }); return x && { title: `${x.company} deal`, link: `${L}/crm?deal=${id}` }; }
    case 'JerseyDesign': { const x = await prisma.jerseyDesign.findFirst({ where: { id, leagueId } }); return x && { title: x.name, link: `${L}/jerseys/${id}` }; }
    case 'Match': { const x = await prisma.match.findFirst({ where: { id, leagueId } }); return x && { title: `Match ${x.number}`, link: `${L}/matchday?match=${id}` }; }
    case 'PlaybookStep': return STEP_KEYS.has(id) ? { title: `Playbook: ${id}`, link: `${L}/playbook#${id}` } : null;
  }
  return null;
}

const authorize = async (req: Parameters<typeof me>[0] & { params: Record<string, string> }, type: string) => {
  const access = await assertLeague(me(req), req.params.leagueId);
  if (access === 'team' && !TEAM_VISIBLE.includes(type)) throw new HttpError(403, 'Comments here are for league staff');
};

r.get('/people', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  res.json(await leaguePeople(req.params.leagueId));
}));

r.get('/', ah(async (req, res) => {
  const q = z.object({ type: z.enum(ENTITY_TYPES), id: z.string().min(1) }).parse(req.query);
  await authorize(req, q.type);
  const list = await prisma.comment.findMany({ where: { leagueId: req.params.leagueId, entityType: q.type, entityId: q.id }, orderBy: { createdAt: 'asc' } });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(list.map((c) => c.authorId))] } }, select: { id: true, name: true, avatarUrl: true } });
  res.json(list.map((c) => ({ ...c, author: users.find((u) => u.id === c.authorId) ?? { id: c.authorId, name: 'Former member' } })));
}));

r.post('/', ah(async (req, res) => {
  const u = me(req);
  const d = z.object({ type: z.enum(ENTITY_TYPES), id: z.string().min(1), body: z.string().trim().min(1).max(4000) }).parse(req.body);
  await authorize(req, d.type);
  const info = await entityInfo(req.params.leagueId, d.type, d.id);
  if (!info) throw new HttpError(404, 'Record not found');
  const people = await leaguePeople(req.params.leagueId);
  const mentions = extractMentions(d.body).filter((id) => id !== u.id && people.some((p) => p.id === id));
  const c = await prisma.comment.create({ data: { leagueId: req.params.leagueId, entityType: d.type, entityId: d.id, authorId: u.id, body: d.body, mentions } });
  if (mentions.length) await notify(mentions, `${u.name} mentioned you on ${info.title}`, { body: plainText(d.body).slice(0, 200), link: info.link, type: 'mention' });
  // Let earlier participants know about the reply
  const earlier = await prisma.comment.findMany({ where: { leagueId: req.params.leagueId, entityType: d.type, entityId: d.id, id: { not: c.id } }, select: { authorId: true } });
  const followers = [...new Set(earlier.map((x) => x.authorId))].filter((id) => id !== u.id && !mentions.includes(id));
  if (followers.length) await notify(followers, `${u.name} replied on ${info.title}`, { body: plainText(d.body).slice(0, 200), link: info.link });
  publish(`comments:${d.type}:${d.id}`);
  res.status(201).json({ ...c, author: { id: u.id, name: u.name } });
}));

r.patch('/:cid', ah(async (req, res) => {
  const u = me(req);
  const c = await prisma.comment.findFirst({ where: { id: req.params.cid, leagueId: req.params.leagueId } });
  if (!c) throw new HttpError(404, 'Comment not found');
  if (c.authorId !== u.id) throw new HttpError(403, 'You can only edit your own comments');
  const { body } = z.object({ body: z.string().trim().min(1).max(4000) }).parse(req.body);
  res.json(await prisma.comment.update({ where: { id: c.id }, data: { body, editedAt: new Date() } }));
}));

r.delete('/:cid', ah(async (req, res) => {
  const u = me(req);
  const access = await assertLeague(u, req.params.leagueId);
  const c = await prisma.comment.findFirst({ where: { id: req.params.cid, leagueId: req.params.leagueId } });
  if (!c) throw new HttpError(404, 'Comment not found');
  if (c.authorId !== u.id && access !== 'admin') throw new HttpError(403, 'You can only delete your own comments');
  await prisma.comment.delete({ where: { id: c.id } });
  res.json({ ok: true });
}));

export default r;
