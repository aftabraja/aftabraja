import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { assertLeague, leagueAccess } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { slugify, tempPassword } from '../lib/util.js';
import { ALL_STEPS, PLAYBOOK, STEP_KEYS } from '../data/playbook.js';

const r = Router();
r.use(requireAuth);

const leagueSchema = z.object({
  name: z.string().min(2),
  shortCode: z.string().max(10).optional().nullable(),
  sport: z.string().default('Cricket'),
  format: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional(),
  description: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  numTeams: z.coerce.number().int().min(0).max(64).optional(),
  teamPurse: z.coerce.number().int().optional().nullable(),
  status: z.enum(['DRAFT', 'PLANNING', 'REGISTRATION_OPEN', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
  isPublic: z.boolean().optional(),
});

/** Progress = done-or-skipped steps / total steps. Critical steps are reported separately. */
export async function leagueProgress(leagueId: string) {
  const rows = await prisma.leagueStepProgress.findMany({ where: { leagueId } });
  const done = rows.filter((r) => r.status === 'DONE' || r.status === 'SKIPPED').map((r) => r.stepKey);
  const critical = ALL_STEPS.filter((s) => s.critical);
  return {
    percent: Math.round((done.length / ALL_STEPS.length) * 100),
    done: done.length,
    total: ALL_STEPS.length,
    criticalDone: critical.filter((s) => done.includes(s.key)).length,
    criticalTotal: critical.length,
    nextStep: ALL_STEPS.find((s) => !done.includes(s.key)) ?? null,
  };
}

// Leagues I own, work for, or own a team in
r.get('/', ah(async (req, res) => {
  const u = me(req);
  const where: Prisma.LeagueWhereInput =
    u.role === 'SUPER_ADMIN'
      ? {}
      : { OR: [{ ownerId: u.id }, { members: { some: { userId: u.id } } }, { teams: { some: { owners: { some: { userId: u.id } } } } }] };
  const leagues = await prisma.league.findMany({ where, orderBy: { createdAt: 'desc' }, include: { _count: { select: { teams: true, registrations: true } } } });
  res.json(await Promise.all(leagues.map(async (l) => ({ ...l, progress: await leagueProgress(l.id) }))));
}));

r.post('/', requireRole('LEAGUE_OWNER'), ah(async (req, res) => {
  const d = leagueSchema.parse(req.body);
  const u = me(req);
  const base = slugify(d.shortCode || d.name) || 'league';
  const slug = (await prisma.league.findUnique({ where: { slug: base } })) ? `${base}-${Date.now().toString(36)}` : base;
  const league = await prisma.league.create({ data: { ...d, slug, ownerId: u.id, status: 'PLANNING' } });

  // Create placeholder teams so the owner can sell them as franchises
  if (d.numTeams) {
    await prisma.team.createMany({ data: Array.from({ length: d.numTeams }, (_, i) => ({ leagueId: league.id, name: `Team ${i + 1}`, purse: d.teamPurse ?? undefined })) });
  }
  // Mark completed steps derived from the creation form
  const autoDone = ['league-profile', ...(d.logoUrl ? ['league-logo'] : []), ...(d.numTeams ? ['create-teams'] : [])];
  await prisma.leagueStepProgress.createMany({ data: autoDone.map((stepKey) => ({ leagueId: league.id, stepKey, status: 'DONE' as const })) });
  await audit(u.id, 'create', 'League', league.id);
  await notify(u.id, `${league.name} is created`, { body: 'Follow the execution playbook step by step to launch your league.', link: `/leagues/${league.id}/playbook`, type: 'success' });
  res.status(201).json(league);
}));

r.get('/:id', ah(async (req, res) => {
  const access = await assertLeague(me(req), req.params.id);
  const league = await prisma.league.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { teams: true, registrations: true, opportunities: true, members: true } } },
  });
  res.json({ ...league, access, progress: await leagueProgress(league.id) });
}));

r.patch('/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'staff');
  const d = leagueSchema.partial().parse(req.body);
  const league = await prisma.league.update({ where: { id: req.params.id }, data: d });
  if (d.logoUrl) {
    await prisma.leagueStepProgress.upsert({
      where: { leagueId_stepKey: { leagueId: league.id, stepKey: 'league-logo' } },
      update: { status: 'DONE' },
      create: { leagueId: league.id, stepKey: 'league-logo', status: 'DONE' },
    });
  }
  await audit(me(req).id, 'update', 'League', league.id, d);
  res.json(league);
}));

r.delete('/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'admin');
  await prisma.league.delete({ where: { id: req.params.id } });
  await audit(me(req).id, 'delete', 'League', req.params.id);
  res.json({ ok: true });
}));

// Dashboard summary
r.get('/:id/dashboard', ah(async (req, res) => {
  const id = req.params.id;
  await assertLeague(me(req), id);
  const [teams, registrations, opportunities, expenses, incomes, budget, members] = await Promise.all([
    prisma.team.count({ where: { leagueId: id } }),
    prisma.playerRegistration.groupBy({ by: ['status'], where: { leagueId: id }, _count: true }),
    prisma.sponsorshipOpportunity.findMany({ where: { leagueId: id }, select: { status: true, price: true } }),
    prisma.expense.aggregate({ where: { leagueId: id }, _sum: { amount: true } }),
    prisma.income.aggregate({ where: { leagueId: id }, _sum: { amount: true } }),
    prisma.budgetLine.aggregate({ where: { leagueId: id }, _sum: { planned: true } }),
    prisma.leagueMember.count({ where: { leagueId: id } }),
  ]);
  const teamsWithOwners = await prisma.team.count({ where: { leagueId: id, owners: { some: {} } } });
  res.json({
    progress: await leagueProgress(id),
    teams, teamsWithOwners, members,
    players: Object.fromEntries(registrations.map((g) => [g.status, g._count])),
    sponsorship: {
      total: opportunities.length,
      sold: opportunities.filter((o) => o.status === 'SOLD').length,
      inventoryValue: opportunities.reduce((s, o) => s + o.price, 0),
      soldValue: opportunities.filter((o) => o.status === 'SOLD').reduce((s, o) => s + o.price, 0),
    },
    finance: { expense: expenses._sum.amount ?? 0, income: incomes._sum.amount ?? 0, budget: budget._sum.planned ?? 0 },
  });
}));

// ---------- Playbook ----------
r.get('/:id/playbook', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id);
  const rows = await prisma.leagueStepProgress.findMany({ where: { leagueId: req.params.id } });
  const byKey = new Map(rows.map((r) => [r.stepKey, r]));
  res.json({
    progress: await leagueProgress(req.params.id),
    phases: PLAYBOOK.map((p) => {
      const steps = p.steps.map((s) => ({ ...s, status: byKey.get(s.key)?.status ?? 'NOT_STARTED', notes: byKey.get(s.key)?.notes ?? null, attachments: byKey.get(s.key)?.attachments ?? [] }));
      return { ...p, steps, done: steps.filter((s) => s.status === 'DONE' || s.status === 'SKIPPED').length };
    }),
  });
}));

r.patch('/:id/playbook/:stepKey', ah(async (req, res) => {
  const { id, stepKey } = req.params;
  await assertLeague(me(req), id, 'staff');
  if (!STEP_KEYS.has(stepKey)) throw new HttpError(404, 'Unknown step');
  const d = z.object({
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'SKIPPED']).optional(),
    notes: z.string().optional().nullable(),
    attachment: z.string().optional(), // data URL or link
  }).parse(req.body);
  const existing = await prisma.leagueStepProgress.findUnique({ where: { leagueId_stepKey: { leagueId: id, stepKey } } });
  const attachments = [...(existing?.attachments ?? []), ...(d.attachment ? [d.attachment] : [])];
  const row = await prisma.leagueStepProgress.upsert({
    where: { leagueId_stepKey: { leagueId: id, stepKey } },
    update: { status: d.status, notes: d.notes, attachments },
    create: { leagueId: id, stepKey, status: d.status ?? 'IN_PROGRESS', notes: d.notes, attachments },
  });
  if (d.status === 'DONE') {
    const step = ALL_STEPS.find((s) => s.key === stepKey)!;
    await notify(await leagueManagers(id), `Step completed: ${step.title}`, { link: `/leagues/${id}/playbook`, type: 'success' });
  }
  res.json({ step: row, progress: await leagueProgress(id) });
}));

// ---------- Teams ----------
const teamSchema = z.object({
  name: z.string().min(1), shortName: z.string().optional().nullable(), city: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(), color: z.string().optional().nullable(),
  purse: z.coerce.number().int().optional().nullable(), franchiseFee: z.coerce.number().int().optional().nullable(),
});

r.get('/:id/teams', ah(async (req, res) => {
  const access = await assertLeague(me(req), req.params.id);
  const teams = await prisma.team.findMany({
    where: { leagueId: req.params.id, ...(access === 'team' && { owners: { some: { userId: me(req).id } } }) },
    orderBy: { createdAt: 'asc' },
    include: {
      owners: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      players: { include: { player: { include: { user: { select: { name: true } } } } } },
    },
  });
  res.json(teams);
}));

r.post('/:id/teams', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'staff');
  const team = await prisma.team.create({ data: { ...teamSchema.parse(req.body), leagueId: req.params.id } });
  await prisma.league.update({ where: { id: req.params.id }, data: { numTeams: { increment: 1 } } });
  res.status(201).json(team);
}));

r.patch('/:id/teams/:teamId', ah(async (req, res) => {
  const access = await assertLeague(me(req), req.params.id);
  if (access === 'team' && !(await prisma.teamOwner.findFirst({ where: { teamId: req.params.teamId, userId: me(req).id } }))) throw new HttpError(403, 'Not your team');
  const team = await prisma.team.update({ where: { id: req.params.teamId, leagueId: req.params.id }, data: teamSchema.partial().parse(req.body) });
  res.json(team);
}));

r.delete('/:id/teams/:teamId', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'admin');
  await prisma.team.delete({ where: { id: req.params.teamId, leagueId: req.params.id } });
  await prisma.league.update({ where: { id: req.params.id }, data: { numTeams: { decrement: 1 } } });
  res.json({ ok: true });
}));

/** Create (or attach) a user account and return a temporary password when newly created. */
async function ensureUser(name: string, email: string, phone: string | undefined, role: 'TEAM_OWNER' | 'LEAGUE_STAFF') {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { user: existing, tempPassword: null as string | null };
  const pwd = tempPassword();
  const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), phone, role, passwordHash: await bcrypt.hash(pwd, 10) } });
  return { user, tempPassword: pwd };
}

r.post('/:id/teams/:teamId/owners', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'staff');
  const d = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), sharePct: z.coerce.number().min(0).max(100).default(100) }).parse(req.body);
  const team = await prisma.team.findFirstOrThrow({ where: { id: req.params.teamId, leagueId: req.params.id }, include: { league: true } });
  const { user, tempPassword } = await ensureUser(d.name, d.email, d.phone, 'TEAM_OWNER');
  await prisma.teamOwner.upsert({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
    update: { sharePct: d.sharePct },
    create: { teamId: team.id, userId: user.id, sharePct: d.sharePct },
  });
  await notify(user.id, `You are now an owner of ${team.name} in ${team.league.name}`, { link: `/leagues/${team.leagueId}/teams`, type: 'success' });
  await audit(me(req).id, 'add-owner', 'Team', team.id, { userId: user.id });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, tempPassword });
}));

r.delete('/:id/teams/:teamId/owners/:userId', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'admin');
  await prisma.teamOwner.delete({ where: { teamId_userId: { teamId: req.params.teamId, userId: req.params.userId } } });
  res.json({ ok: true });
}));

// ---------- Management team ----------
r.get('/:id/members', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'staff');
  res.json(await prisma.leagueMember.findMany({ where: { leagueId: req.params.id }, include: { user: { select: { id: true, name: true, email: true, phone: true } } }, orderBy: { createdAt: 'asc' } }));
}));

r.post('/:id/members', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'admin');
  const d = z.object({ name: z.string().min(2), email: z.string().email(), phone: z.string().optional(), department: z.string().min(2), title: z.string().optional() }).parse(req.body);
  const league = await prisma.league.findUniqueOrThrow({ where: { id: req.params.id } });
  const { user, tempPassword } = await ensureUser(d.name, d.email, d.phone, 'LEAGUE_STAFF');
  await prisma.leagueMember.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
    update: { department: d.department, title: d.title },
    create: { leagueId: league.id, userId: user.id, department: d.department, title: d.title },
  });
  await notify(user.id, `You were added to ${league.name} management (${d.department})`, { link: `/leagues/${league.id}`, type: 'success' });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, tempPassword });
}));

r.delete('/:id/members/:userId', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'admin');
  await prisma.leagueMember.delete({ where: { leagueId_userId: { leagueId: req.params.id, userId: req.params.userId } } });
  res.json({ ok: true });
}));

// ---------- Player registrations (league side) ----------
r.get('/:id/registrations', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id);
  res.json(await prisma.playerRegistration.findMany({
    where: { leagueId: req.params.id },
    orderBy: { createdAt: 'desc' },
    include: { team: { select: { id: true, name: true } }, player: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } } },
  }));
}));

r.patch('/:id/registrations/:regId', ah(async (req, res) => {
  await assertLeague(me(req), req.params.id, 'staff');
  const d = z.object({
    status: z.enum(['APPLIED', 'SHORTLISTED', 'REJECTED', 'SOLD', 'UNSOLD']).optional(),
    category: z.string().optional().nullable(), basePrice: z.coerce.number().int().optional().nullable(),
    soldPrice: z.coerce.number().int().optional().nullable(), teamId: z.string().optional().nullable(),
  }).parse(req.body);
  const reg = await prisma.playerRegistration.update({ where: { id: req.params.regId, leagueId: req.params.id }, data: d, include: { player: true, league: true, team: true } });
  if (d.status) {
    const msg = d.status === 'SOLD' && reg.team ? `You have been picked by ${reg.team.name}!` : `Your ${reg.league.name} registration is now ${d.status.toLowerCase()}`;
    await notify(reg.player.userId, msg, { link: '/player', type: d.status === 'REJECTED' ? 'warning' : 'success' });
  }
  res.json(reg);
}));

// Access probe for the frontend
r.get('/:id/access', ah(async (req, res) => {
  res.json({ access: await leagueAccess(me(req), req.params.id) });
}));

export default r;
