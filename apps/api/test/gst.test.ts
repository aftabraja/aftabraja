import { test } from 'node:test';
import assert from 'node:assert/strict';
import { financialYear, GSTIN_RE, gstSplit, inWords } from '../src/lib/gst.ts';

test('intra-state supply splits CGST + SGST', () => {
  assert.deepEqual(gstSplit(5000, 'Maharashtra', 'Maharashtra'), { cgst: 450, sgst: 450, igst: 0, total: 5900 });
});
test('inter-state supply uses IGST', () => {
  assert.deepEqual(gstSplit(5000, 'Karnataka', 'Maharashtra'), { cgst: 0, sgst: 0, igst: 900, total: 5900 });
});
test('odd tax amounts still add up', () => {
  const s = gstSplit(1501, 'Goa', 'Goa');
  assert.equal(s.cgst + s.sgst, 270);
  assert.equal(s.total, 1771);
});
test('financial year boundaries (April)', () => {
  assert.equal(financialYear(new Date('2027-03-31')), '2026-27');
  assert.equal(financialYear(new Date('2027-04-01')), '2027-28');
});
test('amount in words (Indian system)', () => {
  assert.equal(inWords(5900), 'Five Thousand Nine Hundred');
  assert.equal(inWords(472000), 'Four Lakh Seventy Two Thousand');
  assert.equal(inWords(12500000), 'One Crore Twenty Five Lakh');
});
test('GSTIN format', () => {
  assert.ok(GSTIN_RE.test('27AAPFU0939F1ZV'));
  assert.ok(!GSTIN_RE.test('27AAPFU0939F1Z'));
});
