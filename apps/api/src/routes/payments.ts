import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { createPayment, provider, testModeAllowed, verifyPayment } from '../lib/payments.js';
import { GST_RATE, GSTIN_RE, gstSplit, INDIAN_STATES, PLATFORM } from '../lib/gst.js';
import { invoicePdf } from '../lib/invoice.js';

const r = Router();

r.get('/config', (_req, res) => res.json({ provider: provider(), testMode: testModeAllowed(), keyId: process.env.RAZORPAY_KEY_ID ?? null, platformState: PLATFORM().state, gstRate: GST_RATE }));

// Billing details for GST invoices
r.get('/billing', requireAuth, ah(async (req, res) => {
  res.json({ profile: await prisma.billingProfile.findUnique({ where: { userId: me(req).id } }), states: INDIAN_STATES });
}));
r.put('/billing', requireAuth, ah(async (req, res) => {
  const d = z.object({ name: z.string().min(2), gstin: z.string().toUpperCase().regex(GSTIN_RE, 'Enter a valid 15-character GSTIN').or(z.literal('')).optional(), state: z.enum(INDIAN_STATES as [string, ...string[]]), address: z.string().optional() }).parse(req.body);
  const data = { ...d, gstin: d.gstin || null };
  res.json(await prisma.billingProfile.upsert({ where: { userId: me(req).id }, update: data, create: { ...data, userId: me(req).id } }));
}));

// Pay for the logged-in user's current plan: plan price + GST
r.post('/subscription', requireAuth, ah(async (req, res) => {
  const sub = await prisma.subscription.findFirst({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' } });
  if (!sub) throw new HttpError(404, 'No subscription found');
  if (!sub.amount) throw new HttpError(400, 'Your plan is free');
  const bill = await prisma.billingProfile.findUnique({ where: { userId: me(req).id } });
  if (!bill) throw new HttpError(400, 'Add your billing details first (needed for the GST invoice)');
  const { total } = gstSplit(sub.amount, bill.state);
  res.json(await createPayment({ purpose: 'SUBSCRIPTION', refId: sub.id, amount: total, userId: me(req).id, description: `SportsIQ ${sub.plan.replace('_', ' ').toLowerCase()} plan (incl. GST)` }));
}));

r.get('/invoices', requireAuth, ah(async (req, res) => {
  const u = me(req);
  res.json(await prisma.invoice.findMany({ where: u.role === 'SUPER_ADMIN' ? {} : { userId: u.id }, orderBy: { issuedAt: 'desc' } }));
}));

r.get('/invoices/:id/pdf', requireAuth, ah(async (req, res) => {
  const u = me(req);
  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!inv || (u.role !== 'SUPER_ADMIN' && inv.userId !== u.id)) throw new HttpError(404, 'Invoice not found');
  res.setHeader('Content-Disposition', `attachment; filename="${inv.number.replace(/\//g, '-')}.pdf"`);
  res.type('application/pdf').send(await invoicePdf(inv));
}));

r.post('/verify', ah(async (req, res) => {
  const d = z.object({ paymentId: z.string(), razorpay_order_id: z.string().optional(), razorpay_payment_id: z.string().optional(), razorpay_signature: z.string().optional() }).parse(req.body);
  const p = await verifyPayment(d);
  const order = p.purpose === 'TICKETS' ? await prisma.ticketOrder.findUnique({ where: { id: p.refId! } }) : null;
  res.json({ ok: true, status: p.status, ticketCode: order?.code ?? null });
}));

export default r;

/** QR code as SVG — used for tickets and trial check-in passes */
export const qrRouter = Router();
qrRouter.get('/', ah(async (req, res) => {
  const { data } = z.object({ data: z.string().min(1).max(500) }).parse(req.query);
  res.type('image/svg+xml').send(await QRCode.toString(data, { type: 'svg', margin: 1, width: 240 }));
}));
