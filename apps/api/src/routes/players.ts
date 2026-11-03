import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { leagueManagers, notify } from '../lib/notify.js';
import { trialCode } from './trials.js';
import { ageOn, PLAYER_DOCS, registrationWindow } from '../lib/squad.js';
import { refreshKyc } from './squads.js';
import { createPayment } from '../lib/payments.js';

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
    select: { id: true, name: true, logoUrl: true, city: true, format: true, sport: true, startDate: true, status: true, category: true, regFee: true, regClosesAt: true, regOpensAt: true },
    orderBy: { startDate: 'asc' },
  }));
}));

r.post('/register/:leagueId', requireRole('PLAYER'), ah(async (req, res) => {
  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  const league = await prisma.league.findUnique({ where: { id: req.params.leagueId } });
  if (!league || !league.isPublic) throw new HttpError(404, 'League not found');
  const w = registrationWindow(league);
  if (!w.open) throw new HttpError(400, w.reason!);
  const existing = await prisma.playerRegistration.findUnique({ where: { leagueId_playerId: { leagueId: league.id, playerId: profile.id } } });
  if (existing) throw new HttpError(409, 'You have already registered for this league');
  if (league.regMaxPlayers && (await prisma.playerRegistration.count({ where: { leagueId: league.id } })) >= league.regMaxPlayers) throw new HttpError(409, 'Registrations are full for this league');
  if (league.minAge || league.maxAge) {
    if (!profile.dob) throw new HttpError(400, 'Add your date of birth to your profile first — this league has age limits');
    const age = ageOn(profile.dob, league.startDate ?? new Date());
    if (league.minAge && age < league.minAge) throw new HttpError(400, `Players must be at least ${league.minAge} years old`);
    if (league.maxAge && age > league.maxAge) throw new HttpError(400, `Players must be ${league.maxAge} or younger`);
  }
  const reg = await prisma.playerRegistration.create({ data: { leagueId: league.id, playerId: profile.id, feeStatus: league.regFee > 0 ? 'PENDING' : null, kycStatus: league.regDocs.length ? 'PENDING' : 'VERIFIED' } });
  await notify(await leagueManagers(league.id), `New player registration: ${me(req).name}`, { link: `/leagues/${league.id}/players` });
  res.status(201).json(reg);
}));

// My registrations: fee, documents and KYC per league
r.get('/registrations', requireRole('PLAYER'), ah(async (req, res) => {
  const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { userId: me(req).id } });
  const regs = await prisma.playerRegistration.findMany({
    where: { playerId: profile.id }, orderBy: { createdAt: 'desc' },
    include: { documents: { orderBy: { createdAt: 'desc' } }, team: { select: { name: true } }, league: { select: { id: true, name: true, logoUrl: true, regFee: true, regDocs: true } } },
  });
  res.json({ docTypes: PLAYER_DOCS, registrations: regs });
}));

const myReg = async (userId: string, regId: string) => {
  const reg = await prisma.playerRegistration.findFirst({ where: { id: regId, player: { userId } }, include: { league: { select: { name: true, regFee: true, regDocs: true } } } });
  if (!reg) throw new HttpError(404, 'Registration not found');
  return reg;
};

r.post('/registrations/:regId/documents', requireRole('PLAYER'), ah(async (req, res) => {
  const reg = await myReg(me(req).id, req.params.regId);
  const d = z.object({ type: z.enum(Object.keys(PLAYER_DOCS) as [string, ...string[]]), number: z.string().max(40).optional(), fileUrl: z.string().min(1) }).parse(req.body);
  if (!/^\/files\/|^https:\/\//.test(d.fileUrl)) throw new HttpError(400, 'Upload the document file');
  const doc = await prisma.playerDocument.create({ data: { ...d, regId: reg.id } });
  const kyc = await refreshKyc(reg.id);
  if (kyc === 'SUBMITTED') await notify(await leagueManagers(reg.leagueId), `${me(req).name} submitted KYC documents`, { link: `/leagues/${reg.leagueId}/players` });
  res.status(201).json(doc);
}));

r.delete('/registrations/:regId/documents/:docId', requireRole('PLAYER'), ah(async (req, res) => {
  const reg = await myReg(me(req).id, req.params.regId);
  const doc = await prisma.playerDocument.findFirst({ where: { id: req.params.docId, regId: reg.id } });
  if (!doc) throw new HttpError(404, 'Document not found');
  if (doc.status === 'VERIFIED') throw new HttpError(400, 'Verified documents cannot be removed');
  await prisma.playerDocument.delete({ where: { id: doc.id } });
  await refreshKyc(reg.id);
  res.json({ ok: true });
}));

r.post('/registrations/:regId/pay', requireRole('PLAYER'), ah(async (req, res) => {
  const reg = await myReg(me(req).id, req.params.regId);
  if (reg.feeStatus !== 'PENDING') throw new HttpError(400, 'No fee is due for this registration');
  res.json(await createPayment({ purpose: 'REG_FEE', refId: reg.id, amount: reg.league.regFee, userId: me(req).id, description: `${reg.league.name} — player registration fee` }));
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
