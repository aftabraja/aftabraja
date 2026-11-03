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

import { checkJersey, contrast, defaultMilestones } from '../src/lib/jersey.ts';

test('jersey rules: reserved slots, duplicates, contrast', () => {
  const rules = { leagueLogoSlot: 'CHEST_RIGHT', teamLogoSlot: 'CHEST_LEFT', sponsorSlots: ['FRONT_CHEST', 'SLEEVE_LEFT'] };
  const ok = { teamId: 't', colors: { body: '#1d4ed8', text: '#ffffff' }, sponsors: [{ slot: 'FRONT_CHEST', name: 'FreshBrew', logoUrl: '/files/a.png' }], roster: [{}] };
  assert.equal(checkJersey(ok, rules, true).filter((i) => i.level === 'error').length, 0);
  const bad = { ...ok, colors: { body: '#ffff00', text: '#ffffff' }, sponsors: [{ slot: 'CHEST_RIGHT', name: 'X' }, { slot: 'BACK_TOP', name: 'Y' }] };
  const errs = checkJersey(bad, rules, false).filter((i) => i.level === 'error').map((i) => i.message).join(' | ');
  assert.match(errs, /league logo/i);
  assert.match(errs, /reserved/);
  assert.match(errs, /not allowed/);
  assert.match(errs, /hard to read/);
  assert.ok(contrast('#000000', '#ffffff') > 20);
});

test('work order milestones by category', () => {
  assert.equal(defaultMilestones('jersey-printing').length, 5);
  assert.equal(defaultMilestones('umpires').length, 2);
});

import { channelOf, quantityOf } from '../src/routes/crm.ts';

test('sponsor deliverables: channel and quantity parsed from the package', () => {
  assert.equal(channelOf('Logo on all jerseys (chest)'), 'JERSEY');
  assert.equal(channelOf('LED exposure every match'), 'ON_GROUND');
  assert.equal(channelOf('10 Instagram reels'), 'DIGITAL');
  assert.equal(channelOf('Commentator mentions'), 'BROADCAST');
  assert.equal(quantityOf('10 Instagram reels'), 10);
  assert.equal(quantityOf('Trophy branding'), 1);
});
