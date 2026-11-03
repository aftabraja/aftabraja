import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { assertLeague } from '../lib/access.js';
import { createPayment } from '../lib/payments.js';
import { teamSel } from '../lib/matchView.js';
import { applyPromo, normaliseCode } from '../lib/promo.js';

/** League-side ticketing: categories, orders, gate check-in. /api/leagues/:leagueId/tickets */
const r = Router({ mergeParams: true });
r.use(requireAuth);

const catSchema = z.object({ name: z.string().min(1), price: z.coerce.number().int().min(0), quantity: z.coerce.number().int().min(1), matchId: z.string().nullable().optional(), isActive: z.boolean().optional() });

r.get('/', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const cats = await prisma.ticketCategory.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { price: 'asc' }, include: { match: { select: { id: true, number: true, startsAt: true, homeTeam: teamSel, awayTeam: teamSel } } } });
  const orders = await prisma.ticketOrder.findMany({ where: { category: { leagueId: req.params.leagueId } }, orderBy: { createdAt: 'desc' }, take: 500, include: { category: { select: { name: true } } } });
  const paid = orders.filter((o) => o.status === 'PAID');
  res.json({
    categories: cats,
    orders,
    summary: {
      revenue: paid.reduce((s, o) => s + o.amount, 0), ticketsSold: paid.reduce((s, o) => s + o.qty, 0),
      capacity: cats.reduce((s, c) => s + c.quantity, 0), checkedIn: paid.reduce((s, o) => s + o.checkedIn, 0),
    },
  });
}));

r.post('/categories', ah(async (req, res) => {
  const leagueId = req.params.leagueId;
  await assertLeague(me(req), leagueId, 'staff');
  const c = await prisma.ticketCategory.create({ data: { ...catSchema.parse(req.body), leagueId } });
  await prisma.leagueStepProgress.upsert({ where: { leagueId_stepKey: { leagueId, stepKey: 'ticketing' } }, update: {}, create: { leagueId, stepKey: 'ticketing', status: 'IN_PROGRESS' } });
  res.status(201).json(c);
}));
r.patch('/categories/:cid', ah(async (req, res) => { await assertLeague(me(req), req.params.leagueId, 'staff'); res.json(await prisma.ticketCategory.update({ where: { id: req.params.cid, leagueId: req.params.leagueId }, data: catSchema.partial().parse(req.body) })); }));
r.delete('/categories/:cid', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  if (await prisma.ticketOrder.count({ where: { categoryId: req.params.cid, status: 'PAID' } })) throw new HttpError(400, 'Tickets have been sold in this category — deactivate it instead');
  await prisma.ticketCategory.delete({ where: { id: req.params.cid, leagueId: req.params.leagueId } });
  res.json({ ok: true });
}));

// ---------- Promo codes ----------
const promoSchema = z.object({
  code: z.string().min(3).max(20).transform(normaliseCode).refine((c) => /^[A-Z0-9_-]+$/.test(c), 'Use letters, numbers, - or _'),
  kind: z.enum(['PERCENT', 'FLAT']), value: z.coerce.number().int().min(1),
  maxUses: z.coerce.number().int().min(1).nullable().optional(), minQty: z.coerce.number().int().min(1).max(10).default(1),
  categoryIds: z.array(z.string()).default([]), validFrom: z.coerce.date().nullable().optional(), validTo: z.coerce.date().nullable().optional(), active: z.boolean().optional(),
}).refine((d) => d.kind !== 'PERCENT' || d.value <= 100, { message: 'Percent must be 100 or less', path: ['value'] });

r.get('/promos', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const promos = await prisma.promoCode.findMany({ where: { leagueId: req.params.leagueId }, orderBy: { createdAt: 'desc' } });
  const stats = await prisma.ticketOrder.groupBy({ by: ['promoCodeId'], where: { status: 'PAID', promoCodeId: { in: promos.map((p) => p.id) } }, _sum: { amount: true, discount: true, qty: true } });
  res.json(promos.map((p) => { const s = stats.find((x) => x.promoCodeId === p.id)?._sum; return { ...p, revenue: s?.amount ?? 0, discountGiven: s?.discount ?? 0, tickets: s?.qty ?? 0 }; }));
}));
r.post('/promos', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = promoSchema.parse(req.body);
  if (await prisma.promoCode.findUnique({ where: { leagueId_code: { leagueId: req.params.leagueId, code: d.code } } })) throw new HttpError(409, 'That code already exists');
  res.status(201).json(await prisma.promoCode.create({ data: { ...d, leagueId: req.params.leagueId } }));
}));
r.patch('/promos/:id', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ active: z.boolean().optional(), maxUses: z.coerce.number().int().min(1).nullable().optional(), validTo: z.coerce.date().nullable().optional() }).parse(req.body);
  res.json(await prisma.promoCode.update({ where: { id: req.params.id, leagueId: req.params.leagueId }, data: d }));
}));

// Box office: issue complimentary / cash tickets
r.post('/box-office', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const d = z.object({ categoryId: z.string(), qty: z.coerce.number().int().min(1).max(50), buyerName: z.string().min(1), email: z.string().email().or(z.literal('')).default(''), phone: z.string().optional(), complimentary: z.boolean().default(false) }).parse(req.body);
  const cat = await prisma.ticketCategory.findFirstOrThrow({ where: { id: d.categoryId, leagueId: req.params.leagueId } });
  const taken = await prisma.$executeRaw`UPDATE "TicketCategory" SET "sold" = "sold" + ${d.qty} WHERE "id" = ${cat.id} AND "sold" + ${d.qty} <= "quantity"`;
  if (!taken) throw new HttpError(409, 'Not enough tickets left');
  res.status(201).json(await prisma.ticketOrder.create({ data: { categoryId: cat.id, code: ticketCode(), buyerName: d.buyerName, email: d.email || '-', phone: d.phone, qty: d.qty, amount: d.complimentary ? 0 : cat.price * d.qty, status: 'PAID' } }));
}));

r.post('/checkin', ah(async (req, res) => {
  await assertLeague(me(req), req.params.leagueId, 'staff');
  const { code, count } = z.object({ code: z.string().min(3), count: z.coerce.number().int().min(1).default(1) }).parse(req.body);
  const o = await prisma.ticketOrder.findFirst({ where: { code: code.trim().toUpperCase(), category: { leagueId: req.params.leagueId } }, include: { category: true } });
  if (!o) throw new HttpError(404, 'Ticket not found');
  if (o.status !== 'PAID') throw new HttpError(400, `Ticket is ${o.status.toLowerCase()}`);
  if (o.checkedIn + count > o.qty) throw new HttpError(409, `All ${o.qty} entries on this ticket have already been used`);
  const u = await prisma.ticketOrder.update({ where: { id: o.id }, data: { checkedIn: { increment: count } }, include: { category: true } });
  res.json(u);
}));

export default r;

export const ticketCode = () => 'TK-' + crypto.randomBytes(5).toString('hex').toUpperCase();

/** Public ticket purchase (no login) — mounted at /api/public/tickets */
export const publicTickets = Router();
async function pricePromo(categoryId: string, qty: number, code?: string) {
  const cat = await prisma.ticketCategory.findUnique({ where: { id: categoryId }, include: { league: true } });
  if (!cat || !cat.isActive || !cat.league.isPublic) throw new HttpError(404, 'Tickets not available');
  const gross = cat.price * qty;
  if (!code) return { cat, gross, discount: 0, promo: null };
  const promo = await prisma.promoCode.findUnique({ where: { leagueId_code: { leagueId: cat.leagueId, code: normaliseCode(code) } } });
  const r = applyPromo(promo, { categoryId, qty, unitPrice: cat.price });
  if (r.error) throw new HttpError(400, r.error);
  return { cat, gross, discount: r.discount, promo };
}

publicTickets.post('/promo', ah(async (req, res) => {
  const d = z.object({ categoryId: z.string(), qty: z.coerce.number().int().min(1).max(10), code: z.string().min(1).max(30) }).parse(req.body);
  const { gross, discount, promo } = await pricePromo(d.categoryId, d.qty, d.code);
  res.json({ code: promo!.code, gross, discount, total: gross - discount });
}));

publicTickets.post('/order', ah(async (req, res) => {
  const d = z.object({ categoryId: z.string(), qty: z.coerce.number().int().min(1).max(10), buyerName: z.string().min(2), email: z.string().email(), phone: z.string().min(8).optional(), promoCode: z.string().max(30).optional() }).parse(req.body);
  const { cat, gross, discount, promo } = await pricePromo(d.categoryId, d.qty, d.promoCode || undefined);
  if (cat.sold + d.qty > cat.quantity) throw new HttpError(409, `Only ${cat.quantity - cat.sold} tickets left`);
  const amount = gross - discount;
  const order = await prisma.ticketOrder.create({ data: { categoryId: cat.id, code: ticketCode(), buyerName: d.buyerName, email: d.email, phone: d.phone, qty: d.qty, amount, discount, promoCodeId: promo?.id } });
  if (amount === 0) {
    const taken = await prisma.$executeRaw`UPDATE "TicketCategory" SET "sold" = "sold" + ${d.qty} WHERE "id" = ${cat.id} AND "sold" + ${d.qty} <= "quantity"`;
    if (!taken) throw new HttpError(409, 'Sold out');
    await prisma.ticketOrder.update({ where: { id: order.id }, data: { status: 'PAID' } });
    if (promo) await prisma.promoCode.update({ where: { id: promo.id }, data: { used: { increment: 1 } } });
    return res.status(201).json({ free: true, ticketCode: order.code });
  }
  const pay = await createPayment({ purpose: 'TICKETS', refId: order.id, amount, description: `${d.qty} × ${cat.name} — ${cat.league.name}` });
  res.status(201).json({ ...pay, prefill: { name: d.buyerName, email: d.email, contact: d.phone } });
}));

publicTickets.get('/:code', ah(async (req, res) => {
  const o = await prisma.ticketOrder.findUnique({
    where: { code: req.params.code.toUpperCase() },
    include: { category: { include: { league: { select: { name: true, logoUrl: true, slug: true, city: true } }, match: { select: { number: true, startsAt: true, homeTeam: teamSel, awayTeam: teamSel, venue: { select: { name: true, city: true } } } } } } },
  });
  if (!o) throw new HttpError(404, 'Ticket not found');
  const { email: _e, phone: _p, ...safe } = o;
  res.json(safe);
}));
