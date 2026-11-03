import { post } from './api';

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

export interface PaymentInit {
  paymentId: string; provider: 'RAZORPAY' | 'TEST'; keyId?: string; orderId?: string; amount: number; description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment gateway'));
    document.body.appendChild(s);
  });
}

/**
 * Runs checkout for a payment created on the server and resolves with the verify result.
 * TEST provider (no gateway keys configured) asks for confirmation and marks the payment paid.
 */
export async function checkout(p: PaymentInit): Promise<{ ok: boolean; ticketCode?: string | null }> {
  if (p.provider === 'TEST') {
    if (!window.confirm(`TEST MODE — no real money is charged.\n\n${p.description}\nAmount: ₹${p.amount.toLocaleString('en-IN')}\n\nSimulate a successful payment?`)) throw new Error('Payment cancelled');
    return post('/payments/verify', { paymentId: p.paymentId });
  }
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: p.keyId, order_id: p.orderId, amount: p.amount * 100, currency: 'INR', name: 'SportsIQ', description: p.description,
      prefill: p.prefill, theme: { color: '#1d4ed8' },
      handler: (r: Record<string, string>) => post('/payments/verify', { paymentId: p.paymentId, ...r }).then(resolve, reject),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.on('payment.failed', () => reject(new Error('Payment failed')));
    rzp.open();
  });
}
