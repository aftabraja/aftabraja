import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth, requireRole } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { audit, leagueManagers, notify } from '../lib/notify.js';
import { createContractDraft } from './studio.js';

/**
 * Procurement: RFQ → vendor quotes → comparison → award → work order → proofs → completion → review.
 * League side mounted at /api/leagues/:leagueId/procurement, vendor side at /api/vendor-portal.
 */
const r = Router({ mergeParams: true });
r.use(requireAuth);

const vendorSel = { select: { id: true, companyName: true, city: true, rating: true, reviewCount: true, verified: true, userId: true } };
const dateOpt = z.coerce.date().nullable().optional();

// ---------------- RFQs (league) ----------------
r.get('/rfqs', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const rfqs = await prisma.rfq.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { createdAt: 'desc' }, include: { _count: { select: { invites: true, quotes: true } }, quotes: { select: { amount: true, gstAmount: true, status: true } } } });
  res.json(rfqs.map(({ quotes, ...x }) => ({ ...x, lowest: quotes.filter((q) => q.status !== 'WITHDRAWN').reduce<number | null>((m, q) => (m === null || q.amount + q.gstAmount < m ? q.amount + q.gstAmount : m), null) })));
}));

const rfqSchema = z.object({
  title: z.string().min(3), categorySlug: z.string(), specs: z.string().min(5), quantity: z.string().nullable().optional(), location: z.string().nullable().optional(),
  neededBy: dateOpt, budgetMax: z.coerce.number().int().min(0).nullable().optional(), attachments: z.array(z.string()).default([]),
  vendorIds: z.array(z.string()).default([]), inviteAllInCategory: z.boolean().default(false), city: z.string().optional(),
});

r.post('/rfqs', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const { vendorIds, inviteAllInCategory, city, ...d } = rfqSchema.parse(req.body);
  const cat = await prisma.vendorCategory.findUnique({ where: { slug: d.categorySlug } });
  if (!cat) throw new HttpError(400, 'Unknown vendor category');
  let ids = vendorIds;
  if (inviteAllInCategory) {
    const all = await prisma.vendorProfile.findMany({ where: { user: { isActive: true }, services: { some: { categoryId: cat.id } }, ...(city && { OR: [{ city: { contains: city, mode: 'insensitive' } }, { serviceAreas: { has: city } }, { serviceAreas: { has: 'Pan India' } }] }) }, select: { id: true } });
    ids = [...new Set([...ids, ...all.map((v) => v.id)])];
  }
  if (!ids.length) throw new HttpError(400, 'Choose at least one vendor to invite');
  const n = await prisma.rfq.aggregate({ where: { leagueId }, _max: { number: true } });
  const rfq = await prisma.rfq.create({ data: { ...d, leagueId, number: (n._max.number ?? 0) + 1, createdById: u.id, invites: { create: ids.map((vendorId) => ({ vendorId })) } } });
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const vendors = await prisma.vendorProfile.findMany({ where: { id: { in: ids } }, select: { userId: true } });
  await notify(vendors.map((v) => v.userId), `New request for quote from ${league.name}`, { body: `${rfq.title}${rfq.neededBy ? ` · needed by ${rfq.neededBy.toLocaleDateString('en-IN')}` : ''}`, link: '/vendor?tab=rfqs', type: 'success' });
  await audit(u.id, 'create', 'Rfq', rfq.id, { invited: ids.length });
  res.status(201).json(rfq);
}));

r.get('/rfqs/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const rfq = await prisma.rfq.findFirst({
    where: { id: req.params.id, leagueId: req.params.leagueId },
    include: { invites: { include: { vendor: vendorSel } }, quotes: { include: { vendor: vendorSel }, orderBy: { amount: 'asc' } } },
  });
  if (!rfq) throw new HttpError(404, 'RFQ not found');
  const live = rfq.quotes.filter((q) => q.status !== 'WITHDRAWN');
  const lowest = Math.min(...live.map((q) => q.amount + q.gstAmount));
  const cat = await prisma.vendorCategory.findUnique({ where: { slug: rfq.categorySlug } });
  const wo = await prisma.workOrder.findFirst({ where: { rfqId: rfq.id }, select: { id: true, number: true } });
  res.json({ ...rfq, categoryName: cat?.name, workOrder: wo, quotes: rfq.quotes.map((q) => ({ ...q, total: q.amount + q.gstAmount, isLowest: q.status !== 'WITHDRAWN' && q.amount + q.gstAmount === lowest, overBudget: !!rfq.budgetMax && q.amount > rfq.budgetMax })) });
}));

r.post('/rfqs/:id/invite', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { vendorIds } = z.object({ vendorIds: z.array(z.string()).min(1) }).parse(req.body);
  const rfq = await prisma.rfq.findFirstOrThrow({ where: { id: req.params.id, leagueId: req.params.leagueId, status: 'OPEN' } });
  await prisma.rfqInvite.createMany({ data: vendorIds.map((vendorId) => ({ rfqId: rfq.id, vendorId })), skipDuplicates: true });
  const vendors = await prisma.vendorProfile.findMany({ where: { id: { in: vendorIds } }, select: { userId: true } });
  await notify(vendors.map((v) => v.userId), `New request for quote: ${rfq.title}`, { link: '/vendor?tab=rfqs', type: 'success' });
  res.json({ ok: true });
}));

r.patch('/rfqs/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ status: z.enum(['OPEN', 'CLOSED', 'CANCELLED']).optional(), neededBy: dateOpt, budgetMax: z.coerce.number().int().nullable().optional() }).parse(req.body);
  res.json(await prisma.rfq.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: d }));
}));

// Award a quote: work order + vendor contract draft + pending expense, other quotes rejected
r.post('/quotes/:qid/award', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = z.object({ createContract: z.boolean().default(true), createExpense: z.boolean().default(true), expenseCategory: z.string().default('Miscellaneous'), dueDate: dateOpt, contactPerson: z.string().optional() }).parse(req.body);
  const q = await prisma.quote.findFirst({ where: { id: req.params.qid, rfq: { leagueId } }, include: { rfq: true, vendor: true } });
  if (!q) throw new HttpError(404, 'Quote not found');
  if (q.rfq.status !== 'OPEN') throw new HttpError(400, `This RFQ is already ${q.rfq.status.toLowerCase()}`);
  if (q.status !== 'SUBMITTED') throw new HttpError(400, 'This quote cannot be accepted');
  const n = await prisma.workOrder.aggregate({ where: { leagueId }, _max: { number: true } });
  const wo = await prisma.workOrder.create({
    data: {
      leagueId, number: (n._max.number ?? 0) + 1, vendorId: q.vendorId, rfqId: q.rfqId, quoteId: q.id, title: q.rfq.title,
      scope: `${q.rfq.specs}${q.rfq.quantity ? `\nQuantity: ${q.rfq.quantity}` : ''}\n\nVendor terms: ${q.terms ?? '—'}\nTimeline: ${q.timeline}`,
      location: q.rfq.location, dueDate: d.dueDate ?? q.rfq.neededBy, amount: q.amount, gstAmount: q.gstAmount, contactPerson: d.contactPerson, createdById: u.id,
    },
  });
  await prisma.quote.update({ where: { id: q.id }, data: { status: 'ACCEPTED' } });
  const others = await prisma.quote.findMany({ where: { rfqId: q.rfqId, id: { not: q.id }, status: 'SUBMITTED' }, include: { vendor: true } });
  await prisma.quote.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: 'REJECTED' } });
  await prisma.rfq.update({ where: { id: q.rfqId }, data: { status: 'AWARDED' } });
  let contractId: string | undefined, expenseId: string | undefined;
  if (d.createContract) {
    const c = await createContractDraft(leagueId, 'vendor', q.vendor.companyName, { service_description: `${q.rfq.title}. ${q.rfq.specs}`, contract_value: q.amount, delivery_dates: q.timeline, payment_terms: q.terms ?? '', agreement_date: new Date().toISOString().slice(0, 10), governing_law: 'India', cure_days: 15 });
    contractId = c.id;
  }
  if (d.createExpense) {
    const e = await prisma.expense.create({ data: { leagueId, category: d.expenseCategory, description: `WO-${wo.number}: ${q.rfq.title}`, amount: q.amount, gstAmount: q.gstAmount, vendorId: q.vendorId, status: 'PENDING', createdById: u.id, approvedById: u.id } });
    expenseId = e.id;
  }
  await prisma.workOrder.update({ where: { id: wo.id }, data: { contractId, expenseId } });
  await prisma.workOrderUpdate.create({ data: { workOrderId: wo.id, authorId: u.id, authorName: u.name, side: 'LEAGUE', kind: 'STATUS', status: 'NOT_STARTED', body: 'Work order issued' } });
  await notify(q.vendor.userId, `You've been awarded: ${q.rfq.title}`, { body: `Work order WO-${wo.number}`, link: '/vendor?tab=work', type: 'success' });
  await notify(others.map((o) => o.vendor.userId), `Quote not selected: ${q.rfq.title}`, { body: 'Thank you for quoting. The league has chosen another vendor.', link: '/vendor?tab=rfqs', type: 'info' });
  await audit(u.id, 'award', 'Quote', q.id, { workOrder: wo.id, amount: q.amount });
  res.status(201).json({ workOrderId: wo.id, contractId, expenseId });
}));

// ---------------- Work orders (league) ----------------
const woInclude = { vendor: vendorSel, updates: { orderBy: { createdAt: 'asc' as const } }, review: true };
const overdue = (w: { dueDate: Date | null; status: string }) => !!w.dueDate && w.dueDate < new Date() && !['COMPLETED', 'CANCELLED'].includes(w.status);

r.get('/work-orders', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const list = await prisma.workOrder.findMany({ where: { leagueId: req.params.leagueId }, orderBy: [{ status: 'asc' }, { dueDate: 'asc' }], include: { vendor: vendorSel, _count: { select: { updates: true } }, review: { select: { quality: true, onTime: true, value: true } } } });
  res.json(list.map((w) => ({ ...w, overdue: overdue(w) })));
}));

r.post('/work-orders', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = z.object({ vendorId: z.string(), title: z.string().min(3), scope: z.string().min(3), deliverables: z.array(z.string()).default([]), location: z.string().nullable().optional(), contactPerson: z.string().nullable().optional(), startDate: dateOpt, dueDate: dateOpt, amount: z.coerce.number().int().min(0), gstAmount: z.coerce.number().int().min(0).default(0) }).parse(req.body);
  const v = await prisma.vendorProfile.findUniqueOrThrow({ where: { id: d.vendorId } });
  const n = await prisma.workOrder.aggregate({ where: { leagueId }, _max: { number: true } });
  const wo = await prisma.workOrder.create({ data: { ...d, leagueId, number: (n._max.number ?? 0) + 1, createdById: u.id } });
  await prisma.workOrderUpdate.create({ data: { workOrderId: wo.id, authorId: u.id, authorName: u.name, side: 'LEAGUE', kind: 'STATUS', status: 'NOT_STARTED', body: 'Work order issued' } });
  await notify(v.userId, `New work order WO-${wo.number}: ${wo.title}`, { link: '/vendor?tab=work', type: 'success' });
  res.status(201).json(wo);
}));

r.get('/work-orders/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const w = await prisma.workOrder.findFirst({ where: { id: req.params.id, leagueId: req.params.leagueId }, include: woInclude });
  if (!w) throw new HttpError(404, 'Work order not found');
  res.json({ ...w, overdue: overdue(w) });
}));

/** League: comment, request revision, approve completion, cancel */
r.post('/work-orders/:id/updates', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const d = z.object({ kind: z.enum(['COMMENT', 'REVISION', 'APPROVE', 'CANCEL', 'START']), body: z.string().optional(), attachments: z.array(z.string()).default([]) }).parse(req.body);
  const w = await prisma.workOrder.findFirstOrThrow({ where: { id: req.params.id, leagueId }, include: { vendor: true } });
  const nextStatus = { COMMENT: null, REVISION: 'IN_PROGRESS', APPROVE: 'COMPLETED', CANCEL: 'CANCELLED', START: 'IN_PROGRESS' }[d.kind];
  if (d.kind === 'REVISION' && !d.body) throw new HttpError(400, 'Describe the changes you need');
  await prisma.workOrderUpdate.create({ data: { workOrderId: w.id, authorId: u.id, authorName: u.name, side: 'LEAGUE', kind: d.kind === 'COMMENT' ? 'COMMENT' : d.kind === 'REVISION' ? 'REVISION' : 'STATUS', status: nextStatus, body: d.body ?? (d.kind === 'APPROVE' ? 'Work approved as complete' : d.kind === 'CANCEL' ? 'Work order cancelled' : null), attachments: d.attachments } });
  if (nextStatus) await prisma.workOrder.update({ where: { id: w.id }, data: { status: nextStatus, ...(nextStatus === 'COMPLETED' && { completedAt: new Date() }) } });
  const msg = { COMMENT: 'New comment', REVISION: 'Changes requested', APPROVE: 'Work approved', CANCEL: 'Work order cancelled', START: 'Work order started' }[d.kind];
  await notify(w.vendor.userId, `WO-${w.number} ${w.title}: ${msg}`, { body: d.body?.slice(0, 140), link: '/vendor?tab=work', type: d.kind === 'REVISION' || d.kind === 'CANCEL' ? 'warning' : 'info' });
  res.status(201).json(await prisma.workOrder.findUniqueOrThrow({ where: { id: w.id }, include: woInclude }));
}));

r.post('/work-orders/:id/review', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  const u = me(req);
  await assertLeague(u, leagueId, 'staff');
  const star = z.coerce.number().int().min(1).max(5);
  const d = z.object({ quality: star, onTime: star, value: star, comment: z.string().max(1000).optional() }).parse(req.body);
  const w = await prisma.workOrder.findFirstOrThrow({ where: { id: req.params.id, leagueId }, include: { review: true } });
  if (w.status !== 'COMPLETED') throw new HttpError(400, 'You can review a vendor after the work is completed');
  if (w.review) throw new HttpError(409, 'This work order has already been reviewed');
  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const review = await prisma.vendorReview.create({ data: { ...d, vendorId: w.vendorId, leagueId, leagueName: league.name, workOrderId: w.id, authorId: u.id } });
  // Vendor rating = average of all reviews (mean of the three scores)
  const all = await prisma.vendorReview.findMany({ where: { vendorId: w.vendorId } });
  const avg = all.reduce((s, x) => s + (x.quality + x.onTime + x.value) / 3, 0) / all.length;
  const v = await prisma.vendorProfile.update({ where: { id: w.vendorId }, data: { rating: Math.round(avg * 10) / 10, reviewCount: all.length } });
  await notify(v.userId, `${league.name} reviewed your work`, { body: `${'★'.repeat(Math.round((d.quality + d.onTime + d.value) / 3))} — WO-${w.number}`, link: '/vendor?tab=reviews', type: 'success' });
  res.status(201).json(review);
}));

export default r;

// =================================================================
// Vendor side: /api/vendor-portal
// =================================================================
export const vendorPortal = Router();
vendorPortal.use(requireAuth, requireRole('VENDOR'));
const myVendor = async (userId: string) => {
  const v = await prisma.vendorProfile.findUnique({ where: { userId } });
  if (!v) throw new HttpError(404, 'Vendor profile not found');
  return v;
};

vendorPortal.get('/rfqs', ah(async (req, res) => {
  const v = await myVendor(me(req).id);
  const invites = await prisma.rfqInvite.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' }, include: { rfq: { include: { quotes: { where: { vendorId: v.id } } } } } });
  const leagues = await prisma.league.findMany({ where: { id: { in: invites.map((i) => i.rfq.leagueId) } }, select: { id: true, name: true, logoUrl: true, city: true } });
  const cats = await prisma.vendorCategory.findMany({ select: { slug: true, name: true } });
  res.json(invites.map((i) => ({ ...i.rfq, quotes: undefined, myQuote: i.rfq.quotes[0] ?? null, declined: i.declined, league: leagues.find((l) => l.id === i.rfq.leagueId), categoryName: cats.find((c) => c.slug === i.rfq.categorySlug)?.name })));
}));

vendorPortal.post('/rfqs/:id/quote', ah(async (req, res) => {
  const v = await myVendor(me(req).id);
  const d = z.object({ amount: z.coerce.number().int().min(1), gstAmount: z.coerce.number().int().min(0).default(0), timeline: z.string().min(2), terms: z.string().optional(), validTill: dateOpt, attachments: z.array(z.string()).default([]) }).parse(req.body);
  const inv = await prisma.rfqInvite.findUnique({ where: { rfqId_vendorId: { rfqId: req.params.id, vendorId: v.id } }, include: { rfq: true } });
  if (!inv) throw new HttpError(404, 'You were not invited to this RFQ');
  if (inv.rfq.status !== 'OPEN') throw new HttpError(400, 'This RFQ is no longer accepting quotes');
  const existing = await prisma.quote.findUnique({ where: { rfqId_vendorId: { rfqId: inv.rfqId, vendorId: v.id } } });
  if (existing && existing.status !== 'SUBMITTED' && existing.status !== 'WITHDRAWN') throw new HttpError(400, 'Your quote can no longer be changed');
  const q = await prisma.quote.upsert({ where: { rfqId_vendorId: { rfqId: inv.rfqId, vendorId: v.id } }, update: { ...d, status: 'SUBMITTED' }, create: { ...d, rfqId: inv.rfqId, vendorId: v.id } });
  await notify(await leagueManagers(inv.rfq.leagueId), `${existing ? 'Updated' : 'New'} quote from ${v.companyName}`, { body: `${inv.rfq.title}: ₹${(d.amount + d.gstAmount).toLocaleString('en-IN')}`, link: `/leagues/${inv.rfq.leagueId}/procurement/rfqs/${inv.rfqId}`, type: 'success' });
  res.status(201).json(q);
}));

vendorPortal.post('/rfqs/:id/withdraw', ah(async (req, res) => {
  const v = await myVendor(me(req).id);
  const q = await prisma.quote.findFirst({ where: { rfqId: req.params.id, vendorId: v.id, status: 'SUBMITTED' } });
  if (!q) throw new HttpError(404, 'No open quote to withdraw');
  res.json(await prisma.quote.update({ where: { id: q.id }, data: { status: 'WITHDRAWN' } }));
}));

vendorPortal.post('/rfqs/:id/decline', ah(async (req, res) => {
  const v = await myVendor(me(req).id);
  res.json(await prisma.rfqInvite.update({ where: { rfqId_vendorId: { rfqId: req.params.id, vendorId: v.id } }, data: { declined: true } }));
}));

vendorPortal.get('/work-orders', ah(async (req, res) => {
  const v = await myVendor(me(req).id);
  const list = await prisma.workOrder.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' }, include: { updates: { orderBy: { createdAt: 'asc' } }, review: true } });
  const leagues = await prisma.league.findMany({ where: { id: { in: list.map((w) => w.leagueId) } }, select: { id: true, name: true, logoUrl: true } });
  res.json(list.map((w) => ({ ...w, league: leagues.find((l) => l.id === w.leagueId), overdue: overdue(w) })));
}));

/** Vendor: start work, post progress / proofs, submit for review */
vendorPortal.post('/work-orders/:id/updates', ah(async (req, res) => {
  const u = me(req);
  const v = await myVendor(u.id);
  const d = z.object({ kind: z.enum(['COMMENT', 'PROOF', 'START', 'SUBMIT']), body: z.string().optional(), attachments: z.array(z.string()).default([]) }).parse(req.body);
  const w = await prisma.workOrder.findFirst({ where: { id: req.params.id, vendorId: v.id } });
  if (!w) throw new HttpError(404, 'Work order not found');
  if (['COMPLETED', 'CANCELLED'].includes(w.status)) throw new HttpError(400, `This work order is ${w.status.toLowerCase()}`);
  if (d.kind === 'PROOF' && !d.attachments.length) throw new HttpError(400, 'Attach at least one photo or document as proof');
  const nextStatus = d.kind === 'START' ? 'IN_PROGRESS' : d.kind === 'SUBMIT' ? 'UNDER_REVIEW' : null;
  await prisma.workOrderUpdate.create({ data: { workOrderId: w.id, authorId: u.id, authorName: v.companyName, side: 'VENDOR', kind: nextStatus ? 'STATUS' : d.kind, status: nextStatus, body: d.body ?? (d.kind === 'START' ? 'Work started' : d.kind === 'SUBMIT' ? 'Submitted for review' : null), attachments: d.attachments } });
  if (nextStatus) await prisma.workOrder.update({ where: { id: w.id }, data: { status: nextStatus } });
  const label = { COMMENT: 'New message', PROOF: 'Proof uploaded', START: 'Work started', SUBMIT: 'Ready for your review' }[d.kind];
  await notify(await leagueManagers(w.leagueId), `WO-${w.number} ${w.title}: ${label}`, { body: `${v.companyName}${d.body ? ` — ${d.body.slice(0, 100)}` : ''}`, link: `/leagues/${w.leagueId}/procurement/work-orders/${w.id}`, type: d.kind === 'SUBMIT' ? 'success' : 'info' });
  res.status(201).json({ ok: true });
}));

vendorPortal.get('/reviews', ah(async (req, res) => {
  const v = await myVendor(me(req).id);
  res.json(await prisma.vendorReview.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' } }));
}));

// Portfolio
const pfSchema = z.object({ title: z.string().min(2), client: z.string().nullable().optional(), description: z.string().nullable().optional(), imageUrl: z.string().nullable().optional(), videoUrl: z.string().url().nullable().optional().or(z.literal('')) });
vendorPortal.get('/portfolio', ah(async (req, res) => { const v = await myVendor(me(req).id); res.json(await prisma.portfolioItem.findMany({ where: { vendorId: v.id }, orderBy: { createdAt: 'desc' } })); }));
vendorPortal.post('/portfolio', ah(async (req, res) => { const v = await myVendor(me(req).id); const d = pfSchema.parse(req.body); res.status(201).json(await prisma.portfolioItem.create({ data: { ...d, videoUrl: d.videoUrl || null, vendorId: v.id } })); }));
vendorPortal.delete('/portfolio/:id', ah(async (req, res) => { const v = await myVendor(me(req).id); await prisma.portfolioItem.delete({ where: { id: req.params.id, vendorId: v.id } }); res.json({ ok: true }); }));
