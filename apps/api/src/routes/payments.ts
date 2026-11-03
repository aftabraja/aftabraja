import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { ah, HttpError } from '../lib/http.js';
import { me, requireAuth } from '../lib/auth.js';
import { createPayment, provider, testModeAllowed, verifyPayment } from '../lib/payments.js';

const r = Router();

r.get('/config', (_req, res) => res.json({ provider: provider(), testMode: testModeAllowed(), keyId: process.env.RAZORPAY_KEY_ID ?? null }));

// Pay for the logged-in user's current plan
r.post('/subscription', requireAuth, ah(async (req, res) => {
  const sub = await prisma.subscription.findFirst({ where: { userId: me(req).id }, orderBy: { createdAt: 'desc' } });
  if (!sub) throw new HttpError(404, 'No subscription found');
  if (!sub.amount) throw new HttpError(400, 'Your plan is free');
  res.json(await createPayment({ purpose: 'SUBSCRIPTION', refId: sub.id, amount: sub.amount, userId: me(req).id, description: `SportsIQ ${sub.plan.replace('_', ' ').toLowerCase()} plan` }));
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
