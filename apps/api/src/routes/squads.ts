import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, type AuthUser } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, notify } from '../lib/notify.js';
import { PLAYER_DOCS, STAFF_ROLES, squadBlocker } from '../lib/squad.js';

/** Registration rules, player KYC, team staff and retentions. Mounted at /api/leagues/:leagueId/squads */
const r = Router({ mergeParams: true });
r.use(requireAuth);

/** League staff, or the owner of this particular team */
async function assertTeam(u: AuthUser, leagueId: string, teamId: string) {
  const access = await assertLeague(u, leagueId);
  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId } });
  if (!team) throw new HttpError(404, 'Team not found');
  if (access === 'team' && !(await prisma.teamOwner.findFirst({ where: { teamId, userId: u.id } }))) throw new HttpError(403, 'You can only manage your own team');
  return team;
}

/** Recompute a registration's KYC status from its documents */
export async function refreshKyc(regId: string) {
  const reg = await prisma.playerRegistration.findUniqueOrThrow({ where: { id: regId }, include: { documents: true, league: { select: { regDocs: true } } } });
  const required = reg.league.regDocs;
  const latest = (t: string) => reg.documents.filter((d) => d.type === t).sort((a, b) => +b.createdAt - +a.createdAt)[0];
  const docs = required.map(latest);
  const status = docs.some((d) => d?.status === 'REJECTED') ? 'REJECTED'
    : docs.every((d) => d?.status === 'VERIFIED') ? 'VERIFIED'
    : docs.every(Boolean) ? 'SUBMITTED' : 'PENDING';
  if (status !== reg.kycStatus) await prisma.playerRegistration.update({ where: { id: regId }, data: { kycStatus: status } });
  return status;
}

// ---------- Registration settings ----------
r.get('/settings', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId);
  const l = await prisma.league.findUniqueOrThrow({ where: { id: req.params.leagueId }, select: { regOpensAt: true, regClosesAt: true, regFee: true, regMaxPlayers: true, regDocs: true, minAge: true, maxAge: true, status: true } });
  res.json({ ...l, docTypes: PLAYER_DOCS, staffRoles: STAFF_ROLES });
}));

r.patch('/settings', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'admin');
  const d = z.object({
    regOpensAt: z.coerce.date().nullable().optional(), regClosesAt: z.coerce.date().nullable().optional(),
    regFee: z.coerce.number().int().min(0).max(100000).optional(), regMaxPlayers: z.coerce.number().int().min(1).nullable().optional(),
    regDocs: z.array(z.enum(Object.keys(PLAYER_DOCS) as [string, ...string[]])).optional(),
    minAge: z.coerce.number().int().min(5).max(80).nullable().optional(), maxAge: z.coerce.number().int().min(5).max(80).nullable().optional(),
  }).parse(req.body);
  if (d.regOpensAt && d.regClosesAt && d.regClosesAt <= d.regOpensAt) throw new HttpError(400, 'The window must close after it opens');
  if (d.minAge && d.maxAge && d.maxAge < d.minAge) throw new HttpError(400, 'Maximum age must be above minimum age');
  const l = await prisma.league.update({ where: { id: req.params.leagueId }, data: d });
  if (d.regDocs) { const regs = await prisma.playerRegistration.findMany({ where: { leagueId: l.id }, select: { id: true } }); for (const g of regs) await refreshKyc(g.id); }
  await audit(me(req).id, 'update-registration-settings', 'League', l.id, d);
  res.json({ ok: true });
}));

// ---------- KYC review ----------
r.get('/registrations/:regId/documents', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const reg = await prisma.playerRegistration.findFirstOrThrow({ where: { id: req.params.regId, leagueId: req.params.leagueId }, include: { documents: { orderBy: { createdAt: 'desc' } }, player: { include: { user: { select: { name: true } } } }, league: { select: { regDocs: true } } } });
  res.json({ name: reg.player.user.name, dob: reg.player.dob, kycStatus: reg.kycStatus, required: reg.league.regDocs, docTypes: PLAYER_DOCS, documents: reg.documents });
}));

r.patch('/documents/:docId', ah(async (req, res) => {
  const u = me(req);
  await assertLeague(u, req.params.leagueId, 'staff');
  const d = z.object({ status: z.enum(['VERIFIED', 'REJECTED']), note: z.string().max(300).optional() }).parse(req.body);
  if (d.status === 'REJECTED' && !d.note) throw new HttpError(400, 'Tell the player why the document was rejected');
  const doc = await prisma.playerDocument.findFirstOrThrow({ where: { id: req.params.docId, reg: { leagueId: req.params.leagueId } }, include: { reg: { include: { player: true, league: { select: { name: true } } } } } });
  await prisma.playerDocument.update({ where: { id: doc.id }, data: { status: d.status, note: d.note, reviewedBy: u.name } });
  const kyc = await refreshKyc(doc.regId);
  if (d.status === 'REJECTED') await notify(doc.reg.player.userId, `${doc.reg.league.name}: please re-upload your ${PLAYER_DOCS[doc.type] ?? doc.type}`, { body: d.note, link: '/player', type: 'warning' });
  else if (kyc === 'VERIFIED') await notify(doc.reg.player.userId, `${doc.reg.league.name}: your documents are verified`, { link: '/player', type: 'success' });
  await audit(u.id, `kyc-${d.status.toLowerCase()}`, 'PlayerDocument', doc.id);
  res.json({ kycStatus: kyc });
}));

r.patch('/registrations/:regId/fee', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { status } = z.object({ status: z.enum(['PAID', 'WAIVED', 'PENDING']) }).parse(req.body);
  const reg = await prisma.playerRegistration.findFirstOrThrow({ where: { id: req.params.regId, leagueId: req.params.leagueId }, include: { league: { select: { regFee: true } } } });
  const u = await prisma.playerRegistration.update({ where: { id: reg.id }, data: { feeStatus: status, feePaid: status === 'PAID' ? reg.feePaid ?? reg.league.regFee : status === 'WAIVED' ? 0 : null } });
  await audit(me(req).id, `fee-${status.toLowerCase()}`, 'PlayerRegistration', reg.id);
  res.json(u);
}));

// ---------- Team staff ----------
const staffSchema = z.object({ name: z.string().min(2), role: z.string().min(2).max(60), email: z.string().email().optional().or(z.literal('')), phone: z.string().max(20).optional() });

r.get('/teams/:teamId/staff', ah(async (req, res) => {
  await assertTeam(me(req), req.params.leagueId, req.params.teamId);
  res.json(await prisma.teamStaff.findMany({ where: { teamId: req.params.teamId }, orderBy: { createdAt: 'asc' } }));
}));
r.post('/teams/:teamId/staff', ah(async (req, res) => {
  await assertTeam(me(req), req.params.leagueId, req.params.teamId);
  const d = staffSchema.parse(req.body);
  res.status(201).json(await prisma.teamStaff.create({ data: { ...d, email: d.email || null, teamId: req.params.teamId } }));
}));
r.patch('/teams/:teamId/staff/:id', ah(async (req, res) => {
  await assertTeam(me(req), req.params.leagueId, req.params.teamId);
  const d = staffSchema.partial().parse(req.body);
  res.json(await prisma.teamStaff.update({ where: { id: req.params.id, teamId: req.params.teamId }, data: { ...d, ...(d.email !== undefined && { email: d.email || null }) } }));
}));
r.delete('/teams/:teamId/staff/:id', ah(async (req, res) => {
  await assertTeam(me(req), req.params.leagueId, req.params.teamId);
  await prisma.teamStaff.delete({ where: { id: req.params.id, teamId: req.params.teamId } });
  res.json({ ok: true });
}));

// ---------- Retentions (before the auction starts) ----------
r.get('/teams/:teamId/retention', ah(async (req, res) => {
  const team = await assertTeam(me(req), req.params.leagueId, req.params.teamId);
  const a = await prisma.auction.findUnique({ where: { leagueId: req.params.leagueId } });
  const regs = await prisma.playerRegistration.findMany({ where: { leagueId: req.params.leagueId, previousTeamId: team.id }, include: { player: { include: { user: { select: { name: true } } } } } });
  res.json({
    maxRetentions: a?.maxRetentions ?? 0, open: !a || a.status === 'SETUP',
    eligible: regs.map((g) => ({ id: g.id, name: g.player.user.name, role: g.player.playingRole, category: g.category, basePrice: g.basePrice, isOverseas: g.isOverseas, retained: g.acquiredVia === 'RETAINED' && g.teamId === team.id, price: g.soldPrice, status: g.status, teamId: g.teamId })),
  });
}));

r.post('/teams/:teamId/retain', ah(async (req, res) => {
  const u = me(req);
  const leagueId = req.params.leagueId;
  const team = await assertTeam(u, leagueId, req.params.teamId);
  const { regId, price } = z.object({ regId: z.string(), price: z.coerce.number().int().min(0) }).parse(req.body);
  const a = (await prisma.auction.findUnique({ where: { leagueId } })) ?? (await prisma.auction.create({ data: { leagueId } }));
  if (a.status !== 'SETUP') throw new HttpError(400, 'Retentions close once the auction starts');
  const reg = await prisma.playerRegistration.findFirst({ where: { id: regId, leagueId }, include: { player: { include: { user: { select: { name: true } } } } } });
  if (!reg) throw new HttpError(404, 'Player not found');
  if (reg.previousTeamId !== team.id) throw new HttpError(400, 'Only players who played for this team last season can be retained');
  if (reg.teamId) throw new HttpError(400, 'Player is already in a squad');
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const squad = await prisma.playerRegistration.findMany({ where: { leagueId, teamId: team.id }, include: { player: { select: { playingRole: true } } } });
  const retained = squad.filter((s) => s.acquiredVia === 'RETAINED').length;
  if (retained >= a.maxRetentions) throw new HttpError(400, a.maxRetentions ? `Retention limit reached (${a.maxRetentions})` : 'This league does not allow retentions');
  const block = squadBlocker({ name: team.name, squad: squad.length, overseas: squad.filter((s) => s.isOverseas).length, roles: squad.map((s) => s.player.playingRole) }, { role: reg.player.playingRole, isOverseas: reg.isOverseas }, { maxSquad: a.maxSquad, maxOverseas: a.maxOverseas, roleMins: a.roleMins as Record<string, number> });
  if (block) throw new HttpError(400, block);
  const purse = team.purse ?? league.teamPurse ?? 0;
  const spent = squad.reduce((s, x) => s + (x.soldPrice ?? 0), 0);
  if (price > purse - spent) throw new HttpError(400, `${team.name} does not have enough purse remaining`);
  const out = await prisma.playerRegistration.update({ where: { id: reg.id }, data: { teamId: team.id, status: 'SOLD', soldPrice: price, acquiredVia: 'RETAINED' } });
  await notify(reg.player.userId, `${team.name} has retained you for ${league.name}`, { link: '/player', type: 'success' });
  await audit(u.id, 'retain', 'PlayerRegistration', reg.id, { teamId: team.id, price });
  res.json(out);
}));

r.delete('/teams/:teamId/retain/:regId', ah(async (req, res) => {
  const team = await assertTeam(me(req), req.params.leagueId, req.params.teamId);
  const a = await prisma.auction.findUnique({ where: { leagueId: req.params.leagueId } });
  if (a && a.status !== 'SETUP') throw new HttpError(400, 'Retentions close once the auction starts');
  const reg = await prisma.playerRegistration.findFirst({ where: { id: req.params.regId, teamId: team.id, acquiredVia: 'RETAINED' } });
  if (!reg) throw new HttpError(404, 'Retention not found');
  res.json(await prisma.playerRegistration.update({ where: { id: reg.id }, data: { teamId: null, status: 'SHORTLISTED', soldPrice: null, acquiredVia: null } }));
}));

export default r;
