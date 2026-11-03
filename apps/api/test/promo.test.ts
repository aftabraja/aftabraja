import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPromo, normaliseCode, nps } from '../src/lib/promo.ts';

const base = { code: 'FAN20', kind: 'PERCENT', value: 20, maxUses: 10, used: 0, minQty: 1, categoryIds: [], validFrom: null, validTo: null, active: true };
const o = { categoryId: 'c1', qty: 2, unitPrice: 499 };

test('percent and flat discounts', () => {
  assert.equal(applyPromo(base, o).discount, 200);
  assert.equal(applyPromo({ ...base, kind: 'FLAT', value: 150 }, o).discount, 150);
  assert.equal(applyPromo({ ...base, kind: 'FLAT', value: 5000 }, o).discount, 998, 'flat discount never exceeds the order');
  assert.equal(applyPromo({ ...base, value: 150 }, o).discount, 998, 'percent capped at 100');
});

test('promo validity rules', () => {
  const now = new Date('2027-01-10');
  assert.match(applyPromo({ ...base, used: 10 }, o).error!, /fully used/);
  assert.match(applyPromo({ ...base, validTo: new Date('2027-01-01') }, o, now).error!, /expired/);
  assert.match(applyPromo({ ...base, validFrom: new Date('2027-02-01') }, o, now).error!, /not active yet/);
  assert.match(applyPromo({ ...base, categoryIds: ['c2'] }, o).error!, /ticket type/);
  assert.match(applyPromo({ ...base, minQty: 4 }, o).error!, /at least 4/);
  assert.match(applyPromo(null, o).error!, /not valid/);
  assert.equal(normaliseCode(' fan 20 '), 'FAN20');
});

test('NPS', () => {
  const r = nps([10, 10, 9, 8, 7, 6, 3, 10, 9, 0]);
  assert.equal(r.responses, 10);
  assert.equal(r.promoters, 50);
  assert.equal(r.detractors, 30);
  assert.equal(r.score, 20);
  assert.equal(r.distribution[10], 3);
  assert.equal(nps([]).score, null);
});
