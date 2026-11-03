import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractMentions, plainText } from '../src/lib/mentions.ts';
import { allows, defaultLevel, matrix } from '../src/lib/permissions.ts';

test('mentions are parsed and rendered', () => {
  const b = 'Thanks @[Asha Rao](cm1abcdefghij) and @[Arjun Nair](cm2abcdefghij), @[Asha Rao](cm1abcdefghij) again';
  assert.deepEqual(extractMentions(b), ['cm1abcdefghij', 'cm2abcdefghij']);
  assert.equal(plainText('Hi @[Asha Rao](cm1abcdefghij)!'), 'Hi @Asha Rao!');
  assert.deepEqual(extractMentions('email me at a@b.com'), []);
});

test('department defaults and overrides', () => {
  assert.equal(defaultLevel('Finance', 'finance'), 'edit');
  assert.equal(defaultLevel('Marketing', 'finance'), 'none');
  assert.equal(defaultLevel('Marketing', 'legal'), 'view');
  assert.equal(defaultLevel('Operations', 'legal'), 'edit');
  assert.equal(defaultLevel('Scouting', 'finance'), 'none', 'unknown departments never see finance by default');
  const m = matrix({ Marketing: { finance: 'view' } }, ['Marketing']);
  assert.equal(m.Marketing.finance, 'view');
  assert.equal(m.Marketing.marketing, 'edit');
  assert.ok(allows('edit', 'view') && allows('view', 'view') && !allows('view', 'edit') && !allows('none', 'view'));
});
