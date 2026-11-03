import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalBlockers } from '../src/routes/accreditation.ts';
import { fillTemplate, LEGAL_DISCLAIMER } from '../src/data/contractTemplates.ts';
import { cellText, toCsv } from '../src/reports/export.ts';
import { ALL_STEPS } from '../src/data/playbook.ts';
import { CATEGORY_SLUGS } from '../src/data/vendorCategories.ts';

test('accreditation cannot be approved without photo, zones, ID check and validity', () => {
  const base = { photoUrl: null, zones: [], idVerified: false, idType: null, validFrom: null, validTo: null };
  assert.equal(approvalBlockers(base, { requiresIdCheck: true }).length, 4);
  const ok = { photoUrl: '/files/x.jpg', zones: ['1'], idVerified: true, idType: 'Passport', validFrom: new Date('2027-01-01'), validTo: new Date('2027-02-01') };
  assert.deepEqual(approvalBlockers(ok, { requiresIdCheck: true }), []);
  assert.match(approvalBlockers({ ...ok, validTo: new Date('2026-12-01') }, { requiresIdCheck: true })[0], /after/);
  assert.deepEqual(approvalBlockers({ ...ok, idVerified: false, idType: null }, { requiresIdCheck: false }), []);
});

test('contract templates fill values and mark missing ones', () => {
  const out = fillTemplate('Fee ₹{{fee}} for {{team}} on {{date}}', { fee: 1500000, team: 'Thane Titans' });
  assert.equal(out, 'Fee ₹15,00,000 for Thane Titans on [DATE]');
  assert.match(LEGAL_DISCLAIMER, /qualified lawyer/);
});

test('report exports: Indian formatting, CSV totals and BOM', () => {
  assert.equal(cellText({ key: 'a', label: 'A', type: 'money' }, 1234567), '₹12,34,567');
  assert.equal(cellText({ key: 'a', label: 'A', type: 'money' }, -500, 'Rs.'), '-Rs.500');
  const csv = toCsv({ columns: [{ key: 'n', label: 'Name' }, { key: 'v', label: 'Value', type: 'money', total: true }], rows: [{ n: 'x', v: 10 }, { n: 'y', v: 15 }] });
  assert.ok(csv.startsWith('﻿'));
  assert.match(csv, /"TOTAL","25"/);
});

test('every playbook vendor action points to a real vendor category', () => {
  for (const s of ALL_STEPS) for (const a of s.actions) if (a.type === 'vendor') assert.ok(CATEGORY_SLUGS.has(a.category), `${s.key} → ${a.category}`);
});
