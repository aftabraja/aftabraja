import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { createContractDraft } from './studio.js';

/** Sponsorship CRM: pipeline, activities, won deals → deliverables with proof. /api/leagues/:leagueId/crm */
const r = Router({ mergeParams: true });
r.use(requireAuth);

export const STAGES = ['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
export const PROBABILITY: Record<string, number> = { LEAD: 10, CONTACTED: 25, PROPOSAL: 50, NEGOTIATION: 75, WON: 100, LOST: 0 };

/** Guess the delivery channel from a deliverable's wording */
export function channelOf(text: string) {
  const t = text.toLowerCase();
  if (/jersey|kit|sleeve|chest/.test(t)) return 'JERSEY';
  if (/led|boundary|sight|toss|ground|board|stand|backdrop|podium/.test(t)) return 'ON_GROUND';
  if (/broadcast|graphic|commentat|replay|on-screen|time-out|timeout/.test(t)) return 'BROADCAST';
  if (/instagram|reel|post|social|youtube|digital|website|contest|short/.test(t)) return 'DIGITAL';
  if (/hospitality|vip|box|meet|pass/.test(t)) return 'HOSPITALITY';
  return 'OTHER';
}
/** "10 Instagram reels" → 10 */
export const quantityOf = (text: string) => { const m = /^(\d{1,3})\s/.exec(text.trim()); return m ? Number(m[1]) : 1; };

const dealInclude = { activities: { orderBy: { createdAt: 'desc' as const } }, deliverables: { orderBy: { title: 'asc' as const } } };

r.get('/', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const [deals, opps, members, league] = await Promise.all([
    prisma.sponsorDeal.findMany({ where: { leagueId }, orderBy: { updatedAt: 'desc' }, include: { deliverables: { select: { quantity: true, delivered: true } }, _count: { select: { activities: true } } } }),
    prisma.sponsorshipOpportunity.findMany({ where: { leagueId }, select: { id: true, title: true, tier: true, price: true, slots: true, status: true } }),
    prisma.leagueMember.findMany({ where: { leagueId }, include: { user: { select: { id: true, name: true } } } }),
    prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { owner: { select: { id: true, name: true } } } }),
  ]);
  const open = deals.filter((d) => !['WON', 'LOST'].includes(d.stage));
  res.json({
    deals: deals.map((d) => ({ ...d, probability: PROBABILITY[d.stage], progress: d.deliverables.length ? Math.round((d.deliverables.reduce((s, x) => s + Math.min(x.delivered, x.quantity), 0) / d.deliverables.reduce((s, x) => s + x.quantity, 0)) * 100) : null })),
    opportunities: opps,
    owners: [league.owner, ...members.map((m) => m.user)],
    summary: {
      pipeline: open.reduce((s, d) => s + d.value, 0),
      weighted: Math.round(open.reduce((s, d) => s + d.value * PROBABILITY[d.stage] / 100, 0)),
      won: deals.filter((d) => d.stage === 'WON').reduce((s, d) => s + d.value, 0),
      winRate: (() => { const closed = deals.filter((d) => ['WON', 'LOST'].includes(d.stage)); return closed.length ? Math.round((closed.filter((d) => d.stage === 'WON').length / closed.length) * 100) : null; })(),
    },
  });
}));

const dealSchema = z.object({
  company: z.string().min(2), contactName: z.string().nullable().optional(), email: z.string().email().nullable().optional().or(z.literal('')), phone: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(), value: z.coerce.number().int().min(0).default(0), expectedClose: z.coerce.date().nullable().optional(),
  ownerId: z.string().nullable().optional(), sponsorUserId: z.string().nullable().optional(), stage: z.enum(STAGES).optional(),
});

async function ownerName(id?: string | null) { return id ? (await prisma.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null : null; }

r.post('/deals', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = dealSchema.parse(req.body);
  let value = d.value;
  if (!value && d.opportunityId) value = (await prisma.sponsorshipOpportunity.findFirst({ where: { id: d.opportunityId, leagueId } }))?.price ?? 0;
  const deal = await prisma.sponsorDeal.create({ data: { ...d, email: d.email || null, value, leagueId, ownerId: d.ownerId ?? u.id, ownerName: await ownerName(d.ownerId ?? u.id), activities: { create: { kind: 'STAGE', body: `Deal created at ${(d.stage ?? 'LEAD').toLowerCase()}`, authorName: u.name } } } });
  res.status(201).json(deal);
}));

r.get('/deals/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = await prisma.sponsorDeal.findFirst({ where: { id: req.params.id, leagueId: req.params.leagueId }, include: dealInclude });
  if (!d) throw new HttpError(404, 'Deal not found');
  res.json({ ...d, probability: PROBABILITY[d.stage] });
}));

r.patch('/deals/:id', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = dealSchema.partial().extend({ lostReason: z.string().nullable().optional() }).parse(req.body);
  const cur = await prisma.sponsorDeal.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (d.stage === 'WON' && cur.stage !== 'WON') throw new HttpError(400, 'Use "Mark as won" to close a deal');
  if (d.stage === 'LOST' && !d.lostReason && !cur.lostReason) throw new HttpError(400, 'Add a reason for losing the deal');
  const data = { ...d, ...(d.email !== undefined && { email: d.email || null }), ...(d.ownerId !== undefined && { ownerName: await ownerName(d.ownerId) }) };
  const deal = await prisma.sponsorDeal.update({ where: { id: cur.id }, data });
  if (d.stage && d.stage !== cur.stage) await prisma.dealActivity.create({ data: { dealId: cur.id, kind: 'STAGE', body: `Moved from ${cur.stage.toLowerCase()} to ${d.stage.toLowerCase()}${d.lostReason ? ` — ${d.lostReason}` : ''}`, authorName: u.name } });
  res.json(deal);
}));

r.post('/deals/:id/activities', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ kind: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING']), body: z.string().min(2) }).parse(req.body);
  await prisma.sponsorDeal.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  const a = await prisma.dealActivity.create({ data: { ...d, dealId: req.params.id, authorName: me(req).name } });
  await prisma.sponsorDeal.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } });
  res.status(201).json(a);
}));

/** Generate a personalised sponsorship deck or agreement draft for this deal */
r.post('/deals/:id/documents', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const { kind } = z.object({ kind: z.enum(['DECK', 'CONTRACT']) }).parse(req.body);
  const deal = await prisma.sponsorDeal.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  const opp = deal.opportunityId ? await prisma.sponsorshipOpportunity.findUnique({ where: { id: deal.opportunityId } }) : null;
  if (kind === 'CONTRACT') {
    const c = await createContractDraft(leagueId, 'sponsorship', deal.company, { package_name: opp?.title ?? 'Sponsor', sponsorship_fee: deal.value, deliverables: (opp?.deliverables ?? []).map((x) => `• ${x}`).join('\n'), agreement_date: new Date().toISOString().slice(0, 10), governing_law: 'India', cure_days: 15 });
    await prisma.sponsorDeal.update({ where: { id: deal.id }, data: { contractId: c.id } });
    await prisma.dealActivity.create({ data: { dealId: deal.id, kind: 'DOCUMENT', body: 'Sponsorship agreement draft created (verify with your lawyer)', authorName: u.name } });
    return res.status(201).json({ contractId: c.id });
  }
  const { buildDeck } = await import('../data/deckTemplates.js');
  const l = await prisma.league.findUniqueOrThrow({ where: { id: leagueId }, include: { teams: { include: { owners: true } }, opportunities: { orderBy: { price: 'desc' } }, _count: { select: { registrations: true } } } });
  const deck = await prisma.deck.create({ data: { leagueId, type: 'sponsorship', title: `Sponsorship Deck — ${deal.company}`, audience: deal.company, slides: buildDeck('sponsorship', { ...l, registrations: l._count.registrations }, deal.company) as object[] } });
  await prisma.sponsorDeal.update({ where: { id: deal.id }, data: { deckId: deck.id } });
  await prisma.dealActivity.create({ data: { dealId: deal.id, kind: 'DOCUMENT', body: 'Personalised sponsorship deck created', authorName: u.name } });
  res.status(201).json({ deckId: deck.id });
}));

/** Won: inventory marked sold, deliverables created from the package, receivable added */
r.post('/deals/:id/win', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = z.object({ value: z.coerce.number().int().min(0).optional(), addReceivable: z.boolean().default(true), dueDate: z.coerce.date().nullable().optional() }).parse(req.body);
  const deal = await prisma.sponsorDeal.findFirstOrThrow({ where: { id: req.params.id, leagueId } });
  if (deal.stage === 'WON') throw new HttpError(400, 'Already won');
  const value = d.value ?? deal.value;
  const opp = deal.opportunityId ? await prisma.sponsorshipOpportunity.findUnique({ where: { id: deal.opportunityId } }) : null;
  await prisma.sponsorDeal.update({ where: { id: deal.id }, data: { stage: 'WON', value, wonAt: new Date() } });
  if (opp) {
    await prisma.sponsorshipOpportunity.update({ where: { id: opp.id }, data: { status: 'SOLD' } });
    await prisma.sponsorDeliverable.createMany({ data: opp.deliverables.map((t) => ({ leagueId, dealId: deal.id, title: t, channel: channelOf(t), quantity: quantityOf(t) })) });
  }
  if (d.addReceivable && value) await prisma.income.create({ data: { leagueId, source: 'Sponsorship', description: `${opp?.title ?? 'Sponsorship'} — ${deal.company}`, party: deal.company, amount: value, status: 'PENDING', dueDate: d.dueDate ?? null } });
  await prisma.dealActivity.create({ data: { dealId: deal.id, kind: 'STAGE', body: `Deal won for ₹${value.toLocaleString('en-IN')}${opp ? ` — ${opp.deliverables.length} deliverables created` : ''}`, authorName: u.name } });
  await notify(await leagueManagers(leagueId), `Sponsorship won: ${deal.company}`, { body: `₹${value.toLocaleString('en-IN')}`, link: `/leagues/${leagueId}/crm`, type: 'success' });
  if (deal.sponsorUserId) await notify(deal.sponsorUserId, 'Your sponsorship is confirmed', { body: 'Track every deliverable from your SportsIQ dashboard.', link: '/sponsor/deals', type: 'success' });
  await audit(u.id, 'deal-won', 'SponsorDeal', deal.id, { value });
  res.json(await prisma.sponsorDeal.findUniqueOrThrow({ where: { id: deal.id }, include: dealInclude }));
}));

// ---------- Deliverables ----------
r.get('/deliverables', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  res.json(await prisma.sponsorDeal.findMany({ where: { leagueId: req.params.leagueId, stage: 'WON' }, orderBy: { company: 'asc' }, include: { deliverables: { orderBy: { title: 'asc' } } } }));
}));

r.post('/deals/:id/deliverables', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ title: z.string().min(2), quantity: z.coerce.number().int().min(1).default(1), dueDate: z.coerce.date().nullable().optional(), channel: z.string().optional() }).parse(req.body);
  await prisma.sponsorDeal.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId } });
  res.status(201).json(await prisma.sponsorDeliverable.create({ data: { ...d, channel: d.channel ?? channelOf(d.title), leagueId: req.params.leagueId, dealId: req.params.id } }));
}));

r.patch('/deliverables/:did', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const d = z.object({ delivered: z.coerce.number().int().min(0).optional(), addProofs: z.array(z.string()).default([]), notes: z.string().nullable().optional(), dueDate: z.coerce.date().nullable().optional(), quantity: z.coerce.number().int().min(1).optional() }).parse(req.body);
  const cur = await prisma.sponsorDeliverable.findFirstOrThrow({ where: { id: req.params.did, leagueId }, include: { deal: true } });
  const delivered = d.delivered ?? cur.delivered;
  if (delivered > cur.quantity && !d.quantity) throw new HttpError(400, `Only ${cur.quantity} to deliver`);
  if (delivered >= (d.quantity ?? cur.quantity) && !cur.proofs.length && !d.addProofs.length) throw new HttpError(400, 'Attach proof (photo, screenshot or link capture) before marking complete');
  const { addProofs, ...rest } = d;
  const u = await prisma.sponsorDeliverable.update({ where: { id: cur.id }, data: { ...rest, proofs: [...cur.proofs, ...addProofs] } });
  if (cur.deal.sponsorUserId && (addProofs.length || delivered > cur.delivered)) await notify(cur.deal.sponsorUserId, `Deliverable update: ${cur.title}`, { body: `${delivered}/${u.quantity} delivered`, link: '/sponsor/deals', type: 'info' });
  res.json(u);
}));

r.delete('/deliverables/:did', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  await prisma.sponsorDeliverable.deleteMany({ where: { id: req.params.did, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

export default r;

/** Sponsor's own view: their won deals and deliverable proof. /api/sponsor-portal */
export const sponsorPortal = Router();
sponsorPortal.use(requireAuth, requireRole('SPONSOR'));
sponsorPortal.get('/deals', ah(async (req, res) => {
  const deals = await prisma.sponsorDeal.findMany({ where: { sponsorUserId: me(req).id, stage: { in: ['WON'] } }, include: { deliverables: { orderBy: { title: 'asc' } } }, orderBy: { wonAt: 'desc' } });
  const leagues = await prisma.league.findMany({ where: { id: { in: deals.map((d) => d.leagueId) } }, select: { id: true, name: true, logoUrl: true, startDate: true, endDate: true } });
  res.json(deals.map(({ lostReason: _l, ownerId: _o, ...d }) => ({ ...d, league: leagues.find((l) => l.id === d.leagueId) })));
}));
