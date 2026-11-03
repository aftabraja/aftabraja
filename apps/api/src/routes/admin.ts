import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { audit, notify } from '../lib/notify.js';
import { leagueProgress } from './leagues.js';

/** Super admin: full visibility into every record on the platform. */
const r = Router();
r.use(requireAuth, requireRole('SUPER_ADMIN'));

r.get('/overview', ah(async (_req, res) => {
  const [usersByRole, leaguesByStatus, vendors, sponsors, players, services, opportunities, expenses, incomes, subs] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: true }),
    prisma.league.groupBy({ by: ['status'], _count: true }),
    prisma.vendorProfile.count(),
    prisma.sponsorProfile.count(),
    prisma.playerProfile.count(),
    prisma.vendorService.count(),
    prisma.sponsorshipOpportunity.aggregate({ _count: true, _sum: { price: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.income.aggregate({ _sum: { amount: true } }),
    prisma.subscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIAL'] } }, select: { amount: true, status: true } }),
  ]);
  const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, name: true, email: true, role: true, createdAt: true } });
  res.json({
    usersByRole: Object.fromEntries(usersByRole.map((g) => [g.role, g._count])),
    leaguesByStatus: Object.fromEntries(leaguesByStatus.map((g) => [g.status, g._count])),
    vendors, sponsors, players, services,
    opportunities: { count: opportunities._count, value: opportunities._sum.price ?? 0 },
    gmv: { expenses: expenses._sum.amount ?? 0, incomes: incomes._sum.amount ?? 0 },
    mrr: subs.filter((s) => s.status === 'ACTIVE').reduce((s, x) => s + x.amount, 0),
    potentialMrr: subs.reduce((s, x) => s + x.amount, 0),
    recentUsers,
  });
}));

r.get('/users', ah(async (req, res) => {
  const q = z.object({ role: z.string().optional(), q: z.string().optional() }).parse(req.query);
  res.json(await prisma.user.findMany({
    where: {
      ...(q.role && { role: q.role as never }),
      ...(q.q && { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] }),
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true, deletionRequestedAt: true,
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      vendorProfile: { select: { companyName: true } }, sponsorProfile: { select: { companyName: true } },
    },
  }));
}));

r.patch('/users/:id', ah(async (req, res) => {
  const d = z.object({ isActive: z.boolean().optional() }).parse(req.body);
  const u = await prisma.user.update({ where: { id: req.params.id }, data: d });
  await audit(me(req).id, 'admin-update', 'User', u.id, d);
  res.json(u);
}));

r.patch('/users/:id/subscription', ah(async (req, res) => {
  const d = z.object({ status: z.enum(['TRIAL', 'ACTIVE', 'EXPIRED']), months: z.coerce.number().int().min(0).default(12) }).parse(req.body);
  const sub = await prisma.subscription.findFirst({ where: { userId: req.params.id }, orderBy: { createdAt: 'desc' } });
  if (!sub) return res.status(404).json({ error: 'No subscription' });
  const validTill = new Date(); validTill.setMonth(validTill.getMonth() + d.months);
  res.json(await prisma.subscription.update({ where: { id: sub.id }, data: { status: d.status, validTill } }));
}));

r.get('/leagues', ah(async (_req, res) => {
  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { name: true, email: true } }, _count: { select: { teams: true, registrations: true, opportunities: true, expenses: true, members: true } } },
  });
  res.json(await Promise.all(leagues.map(async (l) => ({ ...l, progress: await leagueProgress(l.id) }))));
}));

r.get('/vendors', ah(async (_req, res) => {
  res.json(await prisma.vendorProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, email: true, isActive: true } }, services: { include: { category: { select: { name: true } } } }, _count: { select: { expenses: true } } },
  }));
}));

r.patch('/vendors/:id', ah(async (req, res) => {
  const d = z.object({ verified: z.boolean() }).parse(req.body);
  const v = await prisma.vendorProfile.update({ where: { id: req.params.id }, data: d });
  if (d.verified) await notify(v.userId, 'Your vendor profile is now verified', { type: 'success', link: '/vendor' });
  res.json(v);
}));

r.get('/sponsors', ah(async (_req, res) => {
  res.json(await prisma.sponsorProfile.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } }));
}));

r.get('/opportunities', ah(async (_req, res) => {
  res.json(await prisma.sponsorshipOpportunity.findMany({ orderBy: { createdAt: 'desc' }, include: { league: { select: { id: true, name: true } } } }));
}));

r.get('/transactions', ah(async (_req, res) => {
  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 500, include: { league: { select: { name: true } }, vendor: { select: { companyName: true } } } }),
    prisma.income.findMany({ orderBy: { date: 'desc' }, take: 500, include: { league: { select: { name: true } } } }),
  ]);
  res.json({ expenses, incomes });
}));

r.get('/talent', ah(async (_req, res) => {
  res.json(await prisma.agencyProfile.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true, phone: true } }, talents: { orderBy: { name: 'asc' }, include: { _count: { select: { enquiries: true } } } } } }));
}));

r.patch('/agencies/:id', ah(async (req, res) => {
  const d = z.object({ verified: z.boolean() }).parse(req.body);
  const a = await prisma.agencyProfile.update({ where: { id: req.params.id }, data: d });
  if (d.verified) await notify(a.userId, 'Your agency is verified on SportsIQ', { type: 'success', link: '/agent' });
  res.json(a);
}));

r.patch('/talents/:id', ah(async (req, res) => {
  const d = z.object({ verified: z.boolean().optional(), isPublished: z.boolean().optional() }).parse(req.body);
  const t = await prisma.talent.update({ where: { id: req.params.id }, data: d, include: { agency: true } });
  await audit(me(req).id, 'admin-update', 'Talent', t.id, d);
  if (d.verified) await notify(t.agency.userId, `${t.name}'s profile is verified`, { type: 'success', link: '/agent' });
  if (d.isPublished === false) await notify(t.agency.userId, `${t.name}'s profile was unpublished by SportsIQ`, { type: 'warning', link: '/agent' });
  res.json(t);
}));

r.get('/emails', ah(async (_req, res) => {
  res.json(await prisma.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
}));

// DPDP erasure: anonymise personal data while keeping financial/audit records intact
r.post('/users/:id/erase', ah(async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
  if (u.role === 'SUPER_ADMIN') return res.status(400).json({ error: 'Cannot erase a super admin' });
  await prisma.$transaction([
    prisma.user.update({ where: { id: u.id }, data: { name: 'Deleted user', email: `deleted-${u.id}@deleted.sportsiq.invalid`, phone: null, avatarUrl: null, isActive: false, passwordHash: '!' } }),
    prisma.playerProfile.updateMany({ where: { userId: u.id }, data: { bio: null, dob: null, videoUrl: null, city: null, state: null } }),
    prisma.notification.deleteMany({ where: { userId: u.id } }),
    prisma.authToken.deleteMany({ where: { userId: u.id } }),
  ]);
  await audit(me(req).id, 'erase-user', 'User', u.id);
  res.json({ ok: true });
}));

r.get('/audit', ah(async (_req, res) => {
  res.json(await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300, include: { user: { select: { name: true, email: true } } } }));
}));

export default r;
