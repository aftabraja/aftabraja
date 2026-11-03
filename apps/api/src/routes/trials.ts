import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { notify } from '../lib/notify.js';

/** Trials: events, invitations/registrations, QR check-in, scout scoring and auto-shortlisting. /api/leagues/:leagueId/trials */
const r = Router({ mergeParams: true });
r.use(requireAuth);
export const trialCode = () => 'TR-' + crypto.randomBytes(4).toString('hex').toUpperCase();

const trialSchema = z.object({
  title: z.string().min(2), city: z.string().optional().nullable(), venue: z.string().optional().nullable(),
  date: z.coerce.date(), capacity: z.coerce.number().int().min(1).default(100), inviteOnly: z.boolean().default(false),
});

r.get('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const trials = await prisma.trialEvent.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { date: 'asc' }, include: { entries: { select: { checkedInAt: true, total: true } } } });
  res.json(trials.map(({ entries, ...t }) => ({ ...t, registered: entries.length, checkedIn: entries.filter((e) => e.checkedInAt).length, scored: entries.filter((e) => e.total != null).length })));
}));

r.post('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.status(201).json(await prisma.trialEvent.create({ data: { ...trialSchema.parse(req.body), leagueId: req.params.leagueId } }));
}));

r.patch('/:tid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.trialEvent.update({ where: { id: req.params.tid, leagueId: req.params.leagueId }, data: trialSchema.partial().parse(req.body) }));
}));

r.delete('/:tid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.trialEvent.delete({ where: { id: req.params.tid, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

r.get('/:tid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const t = await prisma.trialEvent.findFirstOrThrow({ where: { id: req.params.tid, leagueId: req.params.leagueId } });
  const entries = await prisma.trialEntry.findMany({ where: { trialId: t.id }, orderBy: [{ total: 'desc' }, { createdAt: 'asc' }] });
  const regs = await prisma.playerRegistration.findMany({ where: { id: { in: entries.map((e) => e.regId) } }, include: { player: { include: { user: { select: { name: true, phone: true } } } } } });
  res.json({ ...t, entries: entries.map((e) => { const g = regs.find((x) => x.id === e.regId)!; return { ...e, name: g.player.user.name, phone: g.player.user.phone, role: g.player.playingRole, dob: g.player.dob, status: g.status }; }) });
}));

// Invite / add registered players
r.post('/:tid/entries', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { regIds } = z.object({ regIds: z.array(z.string()).min(1) }).parse(req.body);
  const t = await prisma.trialEvent.findFirstOrThrow({ where: { id: req.params.tid, leagueId: req.params.leagueId } });
  const regs = await prisma.playerRegistration.findMany({ where: { id: { in: regIds }, leagueId: t.leagueId }, include: { player: true } });
  let added = 0;
  for (const g of regs) {
    const exists = await prisma.trialEntry.findUnique({ where: { trialId_regId: { trialId: t.id, regId: g.id } } });
    if (exists) continue;
    await prisma.trialEntry.create({ data: { trialId: t.id, regId: g.id, code: trialCode() } });
    await notify(g.player.userId, `You're invited to trials: ${t.title}`, { body: `${t.date.toLocaleString('en-IN')} · ${t.venue ?? t.city ?? ''}`, link: '/player', type: 'success' });
    added++;
  }
  res.json({ added });
}));

r.post('/:tid/checkin', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { code } = z.object({ code: z.string().min(3) }).parse(req.body);
  const e = await prisma.trialEntry.findFirst({ where: { trialId: req.params.tid, code: code.trim().toUpperCase() } });
  if (!e) throw new HttpError(404, 'No player with this pass code in this trial');
  if (e.checkedInAt) throw new HttpError(409, `Already checked in at ${e.checkedInAt.toLocaleTimeString('en-IN')}`);
  res.json(await prisma.trialEntry.update({ where: { id: e.id }, data: { checkedInAt: new Date() } }));
}));

r.patch('/:tid/entries/:eid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const score = z.coerce.number().int().min(0).max(10).nullable().optional();
  const d = z.object({ batting: score, bowling: score, fielding: score, fitness: score, comments: z.string().nullable().optional(), checkedIn: z.boolean().optional() }).parse(req.body);
  const cur = await prisma.trialEntry.findFirstOrThrow({ where: { id: req.params.eid, trialId: req.params.tid } });
  const { checkedIn, ...rest } = d;
  const merged = { ...cur, ...rest };
  const parts = [merged.batting, merged.bowling, merged.fielding, merged.fitness].filter((x): x is number => x != null);
  res.json(await prisma.trialEntry.update({ where: { id: cur.id }, data: { ...rest, total: parts.length ? parts.reduce((a, b) => a + b, 0) : null, ...(checkedIn !== undefined && { checkedInAt: checkedIn ? new Date() : null }) } }));
}));

// Auto-shortlist by score (and optional role / max age)
r.post('/:tid/shortlist', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const d = z.object({ minTotal: z.coerce.number().int().min(0).max(40), role: z.string().optional(), maxAge: z.coerce.number().int().optional() }).parse(req.body);
  const entries = await prisma.trialEntry.findMany({ where: { trialId: req.params.tid, total: { gte: d.minTotal } } });
  const regs = await prisma.playerRegistration.findMany({ where: { id: { in: entries.map((e) => e.regId) }, status: { in: ['APPLIED', 'UNSOLD'] } }, include: { player: true } });
  const now = Date.now();
  const picked = regs.filter((g) => (!d.role || g.player.playingRole === d.role) && (!d.maxAge || !g.player.dob || (now - g.player.dob.getTime()) / 31557600000 <= d.maxAge));
  await prisma.playerRegistration.updateMany({ where: { id: { in: picked.map((p) => p.id) } }, data: { status: 'SHORTLISTED' } });
  await notify(picked.map((p) => p.player.userId), 'You have been shortlisted for the auction!', { link: '/player', type: 'success' });
  await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'trials' } }, update: { status: 'DONE' }, create: { leagueId, stepKey: 'trials', status: 'DONE' } });
  res.json({ shortlisted: picked.length });
}));

export default r;
