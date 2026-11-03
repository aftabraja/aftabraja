import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { leagueProgress } from './leagues.js';

const r = Router();
r.use(requireAuth);

export const SPONSOR_TIERS = ['Title', 'Powered By', 'Associate', 'Jersey', 'On-ground', 'Broadcast', 'Digital', 'Hospitality', 'Official Partner'];

// Sponsor directory for league managers
r.get('/', ah(async (req, res) => {
  const q = z.object({ q: z.string().optional(), industry: z.string().optional(), city: z.string().optional() }).parse(req.query);
  res.json(await prisma.sponsorProfile.findMany({
    where: {
      user: { isActive: true },
      ...(q.industry && { industry: { contains: q.industry, mode: 'insensitive' } }),
      ...(q.city && { city: { contains: q.city, mode: 'insensitive' } }),
      ...(q.q && { OR: [{ companyName: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }, { industry: { contains: q.q, mode: 'insensitive' } }] }),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  }));
}));

r.get('/tiers', (_req, res) => res.json(SPONSOR_TIERS));

r.get('/me/profile', requireRole('SPONSOR'), ah(async (req, res) => {
  res.json(await prisma.sponsorProfile.findUniqueOrThrow({ where: { userId: me(req).id } }));
}));

r.patch('/me/profile', requireRole('SPONSOR'), ah(async (req, res) => {
  const d = z.object({
    companyName: z.string().min(2).optional(), industry: z.string().optional().nullable(), website: z.string().optional().nullable(),
    city: z.string().optional().nullable(), description: z.string().optional().nullable(),
    budgetMin: z.coerce.number().int().optional().nullable(), budgetMax: z.coerce.number().int().optional().nullable(),
  }).parse(req.body);
  res.json(await prisma.sponsorProfile.update({ where: { userId: me(req).id }, data: d }));
}));

// Marketplace: public leagues with open opportunities, filter by start window (months)
r.get('/marketplace', ah(async (req, res) => {
  const q = z.object({ within: z.coerce.number().optional(), sport: z.string().optional(), city: z.string().optional(), tier: z.string().optional() }).parse(req.query);
  const now = new Date();
  const until = q.within ? new Date(now.getFullYear(), now.getMonth() + q.within, now.getDate()) : undefined;
  const leagues = await prisma.league.findMany({
    where: {
      isPublic: true,
      status: { notIn: ['CANCELLED', 'COMPLETED', 'DRAFT'] },
      ...(until && { startDate: { gte: now, lte: until } }),
      ...(q.sport && { sport: q.sport }),
      ...(q.city && { city: { contains: q.city, mode: 'insensitive' } }),
    },
    orderBy: { startDate: 'asc' },
    include: {
      owner: { select: { id: true, name: true } },
      opportunities: { where: { status: { in: ['OPEN', 'IN_DISCUSSION'] }, ...(q.tier && { tier: q.tier }) }, orderBy: { price: 'desc' } },
      _count: { select: { teams: true, registrations: true } },
    },
  });
  res.json(await Promise.all(leagues.map(async (l) => ({ ...l, progress: await leagueProgress(l.id) }))));
}));

// ---------- Opportunities (league side) ----------
const oppSchema = z.object({
  title: z.string().min(2), tier: z.string().min(2), description: z.string().optional().nullable(),
  price: z.coerce.number().int().min(0), deliverables: z.array(z.string()).default([]), slots: z.coerce.number().int().min(1).default(1),
  status: z.enum(['OPEN', 'IN_DISCUSSION', 'SOLD', 'CLOSED']).optional(),
});

r.get('/leagues/:leagueId/opportunities', ah(async (req, res) => {
  const league = await prisma.league.findUniqueOrThrow({ where: { id: req.params.leagueId } });
  const u = me(req);
  if (!(league.isPublic && u.role === 'SPONSOR')) await assertLeague(u, league.id);
  res.json(await prisma.sponsorshipOpportunity.findMany({ where: { leagueId: league.id }, orderBy: [{ price: 'desc' }] }));
}));

r.post('/leagues/:leagueId/opportunities', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const opp = await prisma.sponsorshipOpportunity.create({ data: { ...oppSchema.parse(req.body), leagueId: req.params.leagueId } });
  await prisma.leagueStepProgress.upsert({
    where: { leagueId_stepKey: { leagueId: req.params.leagueId, stepKey: 'sponsorship-inventory' } },
    update: {}, create: { leagueId: req.params.leagueId, stepKey: 'sponsorship-inventory', status: 'IN_PROGRESS' },
  });
  await audit(me(req).id, 'create', 'SponsorshipOpportunity', opp.id);
  res.status(201).json(opp);
}));

r.patch('/leagues/:leagueId/opportunities/:oid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = oppSchema.partial().parse(req.body);
  const opp = await prisma.sponsorshipOpportunity.update({ where: { id: req.params.oid, leagueId: req.params.leagueId }, data: d });
  if (d.status === 'SOLD') await notify(await leagueManagers(req.params.leagueId), `Sponsorship sold: ${opp.title}`, { link: `/leagues/${req.params.leagueId}/sponsorships`, type: 'success' });
  res.json(opp);
}));

r.delete('/leagues/:leagueId/opportunities/:oid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.sponsorshipOpportunity.delete({ where: { id: req.params.oid, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

// Sponsor expresses interest -> opens a conversation with league owner
r.post('/opportunities/:oid/interest', requireRole('SPONSOR'), ah(async (req, res) => {
  const { message } = z.object({ message: z.string().min(2) }).parse(req.body);
  const opp = await prisma.sponsorshipOpportunity.findUnique({ where: { id: req.params.oid }, include: { league: true } });
  if (!opp) throw new HttpError(404, 'Opportunity not found');
  const u = me(req);
  const convo = await prisma.conversation.create({
    data: {
      subject: `Sponsorship: ${opp.title} — ${opp.league.name}`,
      leagueId: opp.leagueId,
      participants: { create: [{ userId: u.id, lastReadAt: new Date() }, { userId: opp.league.ownerId }] },
      messages: { create: { senderId: u.id, body: message } },
    },
  });
  if (opp.status === 'OPEN') await prisma.sponsorshipOpportunity.update({ where: { id: opp.id }, data: { status: 'IN_DISCUSSION' } });
  // Every marketplace enquiry becomes a CRM deal so nothing is lost
  const sp = await prisma.sponsorProfile.findUnique({ where: { userId: u.id } });
  await prisma.sponsorDeal.create({ data: {
    leagueId: opp.leagueId, company: sp?.companyName ?? u.name, contactName: u.name, email: u.email, sponsorUserId: u.id, opportunityId: opp.id, value: opp.price,
    stage: 'CONTACTED', source: 'MARKETPLACE', conversationId: convo.id, ownerId: opp.league.ownerId,
    ownerName: (await prisma.user.findUnique({ where: { id: opp.league.ownerId }, select: { name: true } }))?.name ?? null,
    activities: { create: { kind: 'EMAIL', body: `Enquiry via SportsIQ marketplace: ${message}`, authorName: u.name } },
  } });
  await notify(await leagueManagers(opp.leagueId), `New sponsor interest in "${opp.title}"`, { body: `${u.name}: ${message.slice(0, 120)}`, link: `/messages/${convo.id}`, type: 'success' });
  res.status(201).json(convo);
}));

export default r;
