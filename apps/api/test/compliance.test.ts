import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complianceStatus, expiryAlertDue, requiredDocs } from '../src/lib/compliance.ts';

const now = new Date('2026-06-01T00:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 864e5);

test('required documents follow service categories', () => {
  assert.deepEqual(requiredDocs([]), ['PAN', 'GST']);
  assert.deepEqual(requiredDocs(['catering', 'security']), ['PAN', 'GST', 'FSSAI', 'POLICE_NOC', 'INSURANCE']);
  assert.deepEqual(requiredDocs(['security', 'medical']).filter((d) => d === 'INSURANCE').length, 1);
});

test('compliance status per document', () => {
  const s = complianceStatus(['PAN', 'GST', 'FSSAI', 'INSURANCE'], [
    { type: 'PAN', verified: true, expiresOn: null },
    { type: 'GST', verified: false, expiresOn: null },
    { type: 'FSSAI', verified: true, expiresOn: inDays(-1) },
  ], now);
  assert.deepEqual(s.items.map((i) => i.status), ['VALID', 'PENDING', 'EXPIRED', 'MISSING']);
  assert.equal(s.compliant, false);
  assert.equal(s.missing, 3);
});

test('a renewed document replaces an expired one', () => {
  const s = complianceStatus(['FSSAI'], [{ type: 'FSSAI', verified: true, expiresOn: inDays(-10) }, { type: 'FSSAI', verified: true, expiresOn: inDays(300) }], now);
  assert.equal(s.compliant, true);
});

test('expiry alerts escalate once per level', () => {
  assert.equal(expiryAlertDue(null, null, now), null);
  assert.equal(expiryAlertDue(inDays(60), null, now), null);
  assert.equal(expiryAlertDue(inDays(20), null, now), 'D30');
  assert.equal(expiryAlertDue(inDays(20), 'D30', now), null);
  assert.equal(expiryAlertDue(inDays(5), 'D30', now), 'D7');
  assert.equal(expiryAlertDue(inDays(5), null, now), 'D7');
  assert.equal(expiryAlertDue(inDays(-1), 'D7', now), 'EXPIRED');
  assert.equal(expiryAlertDue(inDays(-1), 'EXPIRED', now), null);
});
