import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, draftTurn, registrationWindow, roleNeeds, squadBlocker } from '../src/lib/squad.ts';

const rules = { maxSquad: 5, maxOverseas: 1, roleMins: { 'Wicket-keeper': 1, Bowler: 2 } };

test('role needs count what is missing', () => {
  assert.deepEqual(roleNeeds(['Bowler', 'Batter'], rules.roleMins), { 'Wicket-keeper': 1, Bowler: 1 });
  assert.deepEqual(roleNeeds(['Bowler', 'Bowler', 'Wicket-keeper'], rules.roleMins), {});
});

test('squad limits: size, overseas and reserved role slots', () => {
  assert.match(squadBlocker({ squad: 5, overseas: 0, roles: [] }, { role: 'Batter', isOverseas: false }, rules)!, /full squad/);
  assert.match(squadBlocker({ squad: 1, overseas: 1, roles: ['Batter'] }, { role: 'Bowler', isOverseas: true }, rules)!, /overseas/);
  // 2 batters already, 3 slots left, 3 role needs → next batter blocked, bowler allowed
  const t = { squad: 2, overseas: 0, roles: ['Batter', 'Batter'] };
  assert.match(squadBlocker(t, { role: 'Batter', isOverseas: false }, rules)!, /1 Wicket-keeper, 2 Bowlers/);
  assert.equal(squadBlocker(t, { role: 'Bowler', isOverseas: false }, rules), null);
  assert.equal(squadBlocker({ squad: 0, overseas: 0, roles: [] }, { role: 'Batter', isOverseas: false }, rules), null);
});

test('snake draft order reverses every other round', () => {
  const o = ['A', 'B', 'C'];
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((i) => draftTurn(o, i, true)!.teamId), ['A', 'B', 'C', 'C', 'B', 'A', 'A']);
  assert.deepEqual([0, 3].map((i) => draftTurn(o, i, false)!.teamId), ['A', 'A']);
  assert.equal(draftTurn(o, 4, true)!.round, 2);
});

test('registration window and age', () => {
  const now = new Date('2027-01-10');
  assert.equal(registrationWindow({ regOpensAt: new Date('2027-01-01'), regClosesAt: new Date('2027-01-31'), status: 'REGISTRATION_OPEN' }, now).open, true);
  assert.match(registrationWindow({ regOpensAt: new Date('2027-02-01'), regClosesAt: null, status: 'PLANNING' }, now).reason!, /open on/);
  assert.equal(registrationWindow({ regOpensAt: null, regClosesAt: new Date('2027-01-05'), status: 'PLANNING' }, now).open, false);
  assert.equal(registrationWindow({ regOpensAt: null, regClosesAt: null, status: 'IN_PROGRESS' }, now).open, false);
  assert.equal(ageOn(new Date('2000-06-15'), new Date('2027-06-14')), 26);
  assert.equal(ageOn(new Date('2000-06-15'), new Date('2027-06-15')), 27);
});
