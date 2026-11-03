import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { leagueManagers, notify } from '../lib/notify.js';
import { trialCode } from './trials.js';

const r = Router();
r.use(requireAuth);

r.get('/me', requireRole('PLAYER'), ah(async (req, res) => {
  res.json(await prisma.playerProfile.findUniqueOrThrow({
    where: { userId: me(req).id },
    include: { registrations: { include: { league: { select: { id: true, name: true, logoUrl: true, startDate: true, city: true } }, team: { select: { name: true } } } } },
  }));
}));

r.patch('/me', requireRole('PLAYER'), ah(async (req, res) => {
  const d = z.object({
    dob: z.coerce.date().optional().nullable(), city: z.string().optional().nullable(), state: z.string().optional().nullable(),
    playingRole: z.string().optional().nullable(), battingStyle: z.string().optional().nullable(), bowlingStyle: z.string().optional().nullable(),
    bio: z.string().optional().nullable(), matches: z.coerce.number().int().optional(), runs: z.coerce.number().int().optional(),
    wickets: z.coerce.number().int().optional(), videoUrl: z.string().optional().nullable(),
  }).parse(req.body);
  res.json(await prisma.playerProfile.update({ where: { userId: me(req).id }, data: d }));
}));

// Leagues currently accepting players
r.get('/open-leagues', ah(async (_req, res) => {
  res.json(await prisma.league.findMany({
    where: { isPublic: true, status: { in: ['PLANNING', 'REGISTRATION_OPEN'] } },
    select: { id: true, name: true, logoUrl: true, city: true, format: true, sport: true, startDate: true, status: true, category: true },
    orderBy: { startDate: 'asc' },
  }));
}));

r.post('/register/:leagueId', requireRole('PLAYER'), ah(async (req, res) => {
  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  const league = await prisma.league.findUnique({ where: { id: req.params.leagueId } });
  if (!league || !league.isPublic) throw new HttpError(404, 'League not found');
  if (!['PLANNING', 'REGISTRATION_OPEN'].includes(league.status)) throw new HttpError(400, 'Registrations are closed for this league');
  const existing = await prisma.playerRegistration.findUnique({ where: { leagueId_playerId: { leagueId: league.id, playerId: profile.id } } });
  if (existing) throw new HttpError(409, 'You have already registered for this league');
  const reg = await prisma.playerRegistration.create({ data: { leagueId: league.id, playerId: profile.id } });
  await notify(await leagueManagers(league.id), `New player registration: ${me(req).name}`, { link: `/leagues/${league.id}/players` });
  res.status(201).json(reg);
}));

// Trials for leagues I'm registered in (+ my passes)
r.get('/trials', requireRole('PLAYER'), ah(async (req, res) => {
  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId: me(req).id }, include: { registrations: true } });
  const regIds = profile.registrations.map((g) => g.id);
  const trials = await prisma.trialEvent.findMany({
    where: { leagueId: { in: profile.registrations.map((g) => g.leagueId) }, date: { gte: new Date(Date.now() - 864e5) } },
    orderBy: { date: 'asc' },
    include: { league: { select: { name: true, logoUrl: true } }, entries: { select: { regId: true, code: true, checkedInAt: true, total: true } } },
  });
  res.json(trials.map(({ entries, ...t }) => {
    const mine = entries.find((e) => regIds.includes(e.regId));
    return { ...t, full: entries.length >= t.capacity, myPass: mine ? { code: mine.code, checkedInAt: mine.checkedInAt } : null };
  }).filter((t) => !t.inviteOnly || t.myPass));
}));

r.post('/trials/:tid/register', requireRole('PLAYER'), ah(async (req, res) => {
  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  const t = await prisma.trialEvent.findUnique({ where: { id: req.params.tid }, include: { _count: { select: { entries: true } } } });
  if (!t) throw new HttpError(404, 'Trial not found');
  if (t.inviteOnly) throw new HttpError(403, 'This trial is invite-only');
  if (t._count.entries >= t.capacity) throw new HttpError(409, 'This trial is full');
  const reg = await prisma.playerRegistration.findUnique({ where: { leagueId_playerId: { leagueId: t.leagueId, playerId: profile.id } } });
  if (!reg) throw new HttpError(400, 'Register for the league first');
  const existing = await prisma.trialEntry.findUnique({ where: { trialId_regId: { trialId: t.id, regId: reg.id } } });
  if (existing) return res.json(existing);
  res.status(201).json(await prisma.trialEntry.create({ data: { trialId: t.id, regId: reg.id, code: trialCode() } }));
}));

export default r;
