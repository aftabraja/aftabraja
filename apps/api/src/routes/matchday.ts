import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit } from '../lib/notify.js';
import { publish } from '../lib/realtime.js';
import { broadcastClashes, checklistFor, PHASES } from '../lib/matchday.js';

/** Match-day operations checklist and broadcast (TV) slots. Mounted at /api/leagues/:leagueId/matchday */
const r = Router({ mergeParams: true });
r.use(requireAuth);

const teamName = { select: { name: true, shortName: true } };

export async function ensureChecklist(matchId: string) {
  const m = await prisma.match.findUniqueOrThrow({ where: { id: matchId }, select: { startsAt: true, _count: { select: { checklist: true } } } });
  if (!m._count.checklist) await prisma.matchChecklistItem.createMany({ data: checklistFor(m.startsAt).map((x) => ({ ...x, matchId })) });
}

const summarise = (items: { done: boolean; critical: boolean; dueAt: Date | null }[], now = new Date()) => ({
  total: items.length, done: items.filter((i) => i.done).length,
  criticalOpen: items.filter((i) => i.critical && !i.done).length,
  overdue: items.filter((i) => !i.done && i.dueAt && i.dueAt < now).length,
});

// Upcoming matches with checklist progress
r.get('/summary', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const matches = await prisma.match.findMany({
    where: { leagueId: req.params.leagueId, status: { in: ['SCHEDULED', 'LIVE'] } }, orderBy: [{ startsAt: 'asc' }, { number: 'asc' }], take: 40,
    include: { homeTeam: teamName, awayTeam: teamName, venue: { select: { name: true } }, checklist: { select: { done: true, critical: true, dueAt: true } } },
  });
  res.json(matches.map(({ checklist, ...m }) => ({ ...m, checklist: checklist.length ? summarise(checklist) : null })));
}));

r.get('/checklist/:mid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const m = await prisma.match.findFirst({ where: { id: req.params.mid, leagueId: req.params.leagueId }, include: { homeTeam: teamName, awayTeam: teamName, venue: { select: { name: true } } } });
  if (!m) throw new HttpError(404, 'Match not found');
  await ensureChecklist(m.id);
  const items = await prisma.matchChecklistItem.findMany({ where: { matchId: m.id }, orderBy: [{ sort: 'asc' }] });
  res.json({ match: m, phases: PHASES, items: items.sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase) || a.sort - b.sort), summary: summarise(items) });
}));

r.post('/checklist/:mid/items', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const m = await prisma.match.findFirst({ where: { id: req.params.mid, leagueId: req.params.leagueId } });
  if (!m) throw new HttpError(404, 'Match not found');
  const d = z.object({ title: z.string().min(3), phase: z.enum(PHASES as [string, ...string[]]), department: z.string().min(2), critical: z.boolean().default(false), dueAt: z.coerce.date().nullable().optional() }).parse(req.body);
  res.status(201).json(await prisma.matchChecklistItem.create({ data: { ...d, matchId: m.id, sort: 100 } }));
}));

r.patch('/checklist/items/:id', ah(async (req, res) => {
  const u = me(req);
  await assertLeague(u, req.params.leagueId, 'staff');
  const item = await prisma.matchChecklistItem.findFirst({ where: { id: req.params.id, match: { leagueId: req.params.leagueId } } });
  if (!item) throw new HttpError(404, 'Item not found');
  const d = z.object({ done: z.boolean().optional(), note: z.string().max(500).nullable().optional(), dueAt: z.coerce.date().nullable().optional() }).parse(req.body);
  const out = await prisma.matchChecklistItem.update({ where: { id: item.id }, data: { ...d, ...(d.done !== undefined && { doneBy: d.done ? u.name : null, doneAt: d.done ? new Date() : null }) } });
  if (d.done !== undefined && item.critical) await audit(u.id, d.done ? 'checklist-done' : 'checklist-reopened', 'MatchChecklistItem', item.id, { title: item.title });
  publish(`match:${item.matchId}`);
  res.json(out);
}));

r.delete('/checklist/items/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const item = await prisma.matchChecklistItem.findFirst({ where: { id: req.params.id, match: { leagueId: req.params.leagueId } } });
  if (!item) throw new HttpError(404, 'Item not found');
  if (item.critical) throw new HttpError(400, 'Critical safety items cannot be removed');
  await prisma.matchChecklistItem.delete({ where: { id: item.id } });
  res.json({ ok: true });
}));

// ---------- Broadcast / TV slots ----------
r.get('/broadcast', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  const matches = await prisma.match.findMany({
    where: { leagueId: req.params.leagueId }, orderBy: [{ startsAt: 'asc' }, { number: 'asc' }],
    select: { id: true, number: true, stage: true, startsAt: true, status: true, broadcaster: true, tvSlot: true, onAirAt: true, offAirAt: true, streamUrl: true, homeLabel: true, awayLabel: true, homeTeam: teamName, awayTeam: teamName, venue: { select: { name: true } } },
  });
  const clashes = broadcastClashes(matches);
  res.json({ matches: matches.map((m) => ({ ...m, clashWith: clashes.filter((c) => c.includes(m.id)).map((c) => matches.find((x) => x.id === (c[0] === m.id ? c[1] : c[0]))!.number) })), clashes: clashes.length });
}));

const slotSchema = z.object({
  broadcaster: z.string().max(80).nullable().optional(), tvSlot: z.string().max(60).nullable().optional(),
  onAirAt: z.coerce.date().nullable().optional(), offAirAt: z.coerce.date().nullable().optional(),
  streamUrl: z.string().url().nullable().optional().or(z.literal('')),
});
r.patch('/broadcast/:mid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = slotSchema.parse(req.body);
  if (d.onAirAt && d.offAirAt && d.offAirAt <= d.onAirAt) throw new HttpError(400, 'Off-air must be after on-air');
  const m = await prisma.match.update({ where: { id: req.params.mid, leagueId: req.params.leagueId }, data: { ...d, streamUrl: d.streamUrl || null } });
  res.json(m);
}));

// Assign one broadcaster/slot to many matches at once
r.post('/broadcast/bulk', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ matchIds: z.array(z.string()).min(1), broadcaster: z.string().max(80), tvSlot: z.string().max(60).optional(), preShowMinutes: z.coerce.number().int().min(0).max(180).default(30), durationHours: z.coerce.number().min(1).max(12).default(4) }).parse(req.body);
  const ms = await prisma.match.findMany({ where: { id: { in: d.matchIds }, leagueId: req.params.leagueId } });
  for (const m of ms) {
    const on = m.startsAt ? new Date(m.startsAt.getTime() - d.preShowMinutes * 6e4) : null;
    await prisma.match.update({ where: { id: m.id }, data: { broadcaster: d.broadcaster, tvSlot: d.tvSlot, onAirAt: on, offAirAt: on ? new Date(on.getTime() + d.durationHours * 36e5) : null } });
  }
  res.json({ updated: ms.length });
}));

export default r;
