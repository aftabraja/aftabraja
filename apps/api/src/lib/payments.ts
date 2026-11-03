import crypto from 'node:crypto';
import { prisma } from './prisma.js';
import { HttpError } from './http.js';
import { notify } from './notify.js';

/**
 * Payments: Razorpay when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set, otherwise a clearly
 * labelled TEST provider (only when PAYMENTS_TEST_MODE is not "false") so the full flow can be
 * exercised before going live.
 */
const KEY_ID = () => process.env.RAZORPAY_KEY_ID;
const SECRET = () => process.env.RAZORPAY_KEY_SECRET;
export const provider = () => (KEY_ID() && SECRET() ? 'RAZORPAY' : 'TEST');
export const testModeAllowed = () => provider() === 'TEST' && process.env.PAYMENTS_TEST_MODE !== 'false';

export async function createPayment(opts: { purpose: 'SUBSCRIPTION' | 'TICKETS'; refId: string; amount: number; userId?: string; description: string }) {
  if (opts.amount <= 0) throw new HttpError(400, 'Amount must be greater than zero');
  const p = await prisma.payment.create({ data: { purpose: opts.purpose, refId: opts.refId, amount: opts.amount, userId: opts.userId, provider: provider() } });
  if (provider() === 'RAZORPAY') {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${KEY_ID()}:${SECRET()}`).toString('base64') },
      body: JSON.stringify({ amount: opts.amount * 100, currency: 'INR', receipt: p.id, notes: { purpose: opts.purpose, refId: opts.refId } }),
    });
    const order = (await r.json()) as { id?: string; error?: { description: string } };
    if (!r.ok || !order.id) throw new HttpError(502, `Payment gateway error: ${order.error?.description ?? r.statusText}`);
    await prisma.payment.update({ where: { id: p.id }, data: { providerOrderId: order.id } });
    return { paymentId: p.id, provider: 'RAZORPAY', keyId: KEY_ID(), orderId: order.id, amount: opts.amount, description: opts.description };
  }
  if (!testModeAllowed()) throw new HttpError(503, 'Online payments are not configured yet');
  return { paymentId: p.id, provider: 'TEST', amount: opts.amount, description: opts.description };
}

export async function verifyPayment(d: { paymentId: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string }) {
  const p = await prisma.payment.findUnique({ where: { id: d.paymentId } });
  if (!p) throw new HttpError(404, 'Payment not found');
  if (p.status === 'PAID') return p;
  if (p.provider === 'RAZORPAY') {
    if (!d.razorpay_order_id || !d.razorpay_payment_id || !d.razorpay_signature || d.razorpay_order_id !== p.providerOrderId) throw new HttpError(400, 'Invalid payment details');
    const expected = crypto.createHmac('sha256', SECRET()!).update(`${d.razorpay_order_id}|${d.razorpay_payment_id}`).digest('hex');
    const ok = expected.length === d.razorpay_signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(d.razorpay_signature));
    if (!ok) {
      await prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
      throw new HttpError(400, 'Payment signature verification failed');
    }
  } else if (!testModeAllowed()) {
    throw new HttpError(400, 'Test payments are disabled');
  }
  const paid = await prisma.payment.update({ where: { id: p.id }, data: { status: 'PAID', providerPaymentId: d.razorpay_payment_id ?? `test_${Date.now()}` } });
  await fulfil(paid.id);
  return paid;
}

async function fulfil(paymentId: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (p.purpose === 'TICKETS' && p.refId) {
    const order = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: p.refId } });
    // Atomically take inventory; refuse if the category sold out meanwhile
    const taken = await prisma.$executeRaw`UPDATE "TicketCategory" SET "sold" = "sold" + ${order.qty} WHERE "id" = ${order.categoryId} AND "sold" + ${order.qty} <= "quantity"`;
    await prisma.ticketOrder.update({ where: { id: order.id }, data: taken ? { status: 'PAID', paymentId: p.id } : { status: 'CANCELLED', paymentId: p.id } });
    if (!taken) throw new HttpError(409, 'Sorry, these tickets sold out while you were paying. Your payment will be refunded.');
  }
  if (p.purpose === 'SUBSCRIPTION' && p.refId) {
    const validTill = new Date(); validTill.setFullYear(validTill.getFullYear() + 1);
    const sub = await prisma.subscription.update({ where: { id: p.refId }, data: { status: 'ACTIVE', validTill } });
    await notify(sub.userId, 'Payment received — your SportsIQ plan is active', { type: 'success', link: '/account' });
  }
}
