/** Ticket promo codes and NPS maths. Pure functions — unit tested. */
export interface Promo { code: string; kind: string; value: number; maxUses: number | null; used: number; minQty: number; categoryIds: string[]; validFrom: Date | null; validTo: Date | null; active: boolean }

export function applyPromo(p: Promo | null, o: { categoryId: string; qty: number; unitPrice: number }, now = new Date()): { discount: number; error?: string } {
  if (!p || !p.active) return { discount: 0, error: 'This promo code is not valid' };
  if (p.validFrom && now < p.validFrom) return { discount: 0, error: 'This promo code is not active yet' };
  if (p.validTo && now > p.validTo) return { discount: 0, error: 'This promo code has expired' };
  if (p.maxUses != null && p.used >= p.maxUses) return { discount: 0, error: 'This promo code has been fully used' };
  if (p.categoryIds.length && !p.categoryIds.includes(o.categoryId)) return { discount: 0, error: 'This promo code does not apply to this ticket type' };
  if (o.qty < p.minQty) return { discount: 0, error: `Buy at least ${p.minQty} tickets to use this code` };
  const gross = o.unitPrice * o.qty;
  const discount = p.kind === 'PERCENT' ? Math.round((gross * Math.min(100, p.value)) / 100) : Math.min(gross, p.value);
  return { discount };
}

export const normaliseCode = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '');

/** Net Promoter Score: % promoters (9–10) minus % detractors (0–6) */
export function nps(scores: number[]) {
  const n = scores.length;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = n - promoters - detractors;
  const pct = (x: number) => (n ? Math.round((x / n) * 1000) / 10 : 0);
  return { responses: n, score: n ? Math.round(pct(promoters) - pct(detractors)) : null, promoters: pct(promoters), passives: pct(passives), detractors: pct(detractors), distribution: Array.from({ length: 11 }, (_, i) => scores.filter((s) => s === i).length) };
}
