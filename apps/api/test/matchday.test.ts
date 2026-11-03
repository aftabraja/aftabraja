import { test } from 'node:test';
import assert from 'node:assert/strict';
import { broadcastClashes, checklistFor, deadlineAlert, MATCH_CHECKLIST } from '../src/lib/matchday.ts';

test('checklist is scheduled relative to the start', () => {
  const start = new Date('2027-01-10T14:00:00Z');
  const c = checklistFor(start);
  assert.equal(c.length, MATCH_CHECKLIST.length);
  assert.equal(c[0].dueAt!.toISOString(), '2027-01-03T14:00:00.000Z');
  assert.ok(c.filter((x) => x.critical).length >= 5);
  assert.equal(checklistFor(null)[0].dueAt, null);
});

test('broadcast clashes only for the same broadcaster with overlapping windows', () => {
  const d = (h: number) => new Date(Date.UTC(2027, 0, 10, h));
  const ms = [
    { id: 'a', broadcaster: 'StreamPlay', onAirAt: null, offAirAt: null, startsAt: d(14) },
    { id: 'b', broadcaster: 'streamplay', onAirAt: null, offAirAt: null, startsAt: d(16) },
    { id: 'c', broadcaster: 'StreamPlay', onAirAt: null, offAirAt: null, startsAt: d(20) },
    { id: 'd', broadcaster: 'Channel 9', onAirAt: null, offAirAt: null, startsAt: d(14) },
    { id: 'e', broadcaster: null, onAirAt: null, offAirAt: null, startsAt: d(14) },
  ];
  assert.deepEqual(broadcastClashes(ms), [['a', 'b']]);
});

test('deadline alerts escalate once', () => {
  const now = new Date('2027-01-10T00:00:00Z');
  const h = (n: number) => new Date(now.getTime() + n * 36e5);
  assert.equal(deadlineAlert(h(100), false, null, now), null);
  assert.equal(deadlineAlert(h(24), false, null, now), 'DUE_SOON');
  assert.equal(deadlineAlert(h(24), false, 'DUE_SOON', now), null);
  assert.equal(deadlineAlert(h(-1), false, 'DUE_SOON', now), 'OVERDUE');
  assert.equal(deadlineAlert(h(-1), false, 'OVERDUE', now), null);
  assert.equal(deadlineAlert(h(-1), true, null, now), null);
});
