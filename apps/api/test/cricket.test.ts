import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ball } from '@prisma/client';
import { ballLabel, buildInnings, nextState, oversStr } from '../src/lib/cricket.ts';

let seq = 0;
const b = (p: Partial<Ball>): Ball => ({ id: String(++seq), matchId: 'm', seq, innings: 1, battingTeamId: 'A', striker: 'S1', nonStriker: 'S2', bowler: 'B1', runs: 0, extraType: null, extraRuns: 0, wicket: null, dismissed: null, fielder: null, createdAt: new Date(), ...p });

test('totals, extras, wickets and overs', () => {
  const balls = [
    b({ runs: 4 }), b({ runs: 1 }), b({ striker: 'S2', nonStriker: 'S1', extraType: 'WD', extraRuns: 1 }),
    b({ striker: 'S2', nonStriker: 'S1', wicket: 'BOWLED' }), b({ striker: 'S3', nonStriker: 'S1', extraType: 'LB', extraRuns: 2 }),
    b({ striker: 'S3', nonStriker: 'S1', runs: 6 }), b({ striker: 'S3', nonStriker: 'S1', runs: 0 }),
  ];
  const inn = buildInnings(balls, 1);
  assert.equal(inn.runs, 14);
  assert.equal(inn.wickets, 1);
  assert.equal(inn.legalBalls, 6);
  assert.equal(inn.overs, '1.0');
  assert.deepEqual(inn.extras, { WD: 1, NB: 0, B: 0, LB: 2, total: 3 });
  const bowler = inn.bowling.find((x) => x.name === 'B1')!;
  assert.equal(bowler.runs, 12, 'leg-byes are not charged to the bowler');
  assert.equal(bowler.wickets, 1);
  const s2 = inn.batting.find((x) => x.name === 'S2')!;
  assert.equal(s2.balls, 1, 'a wide is not a ball faced');
  assert.equal(s2.out, 'b B1');
});

test('strike rotates on odd runs and at the end of the over', () => {
  const balls = [b({ runs: 1 }), b({ striker: 'S2', nonStriker: 'S1', runs: 0 }), b({ striker: 'S2', nonStriker: 'S1', runs: 0 }), b({ striker: 'S2', nonStriker: 'S1', runs: 0 }), b({ striker: 'S2', nonStriker: 'S1', runs: 0 }), b({ striker: 'S2', nonStriker: 'S1', runs: 0 })];
  const n = nextState(balls, 1);
  assert.equal(n.striker, 'S1', 'over ended: S1 back on strike');
  assert.equal(n.nonStriker, 'S2');
  assert.equal(n.needsNewBowler, true);
  assert.equal(n.lastOverBowler, 'B1');
  assert.equal(buildInnings(balls, 1).bowling[0].maidens, 0, '1 run conceded is not a maiden');
});

test('wicket leaves an empty crease slot', () => {
  const n = nextState([b({ wicket: 'CAUGHT', fielder: 'F1' })], 1);
  assert.equal(n.striker, null);
  assert.equal(n.needsNewBatter, true);
});

test('labels and overs formatting', () => {
  assert.equal(ballLabel(b({ runs: 0 })), '•');
  assert.equal(ballLabel(b({ extraType: 'WD', extraRuns: 1 })), 'wd');
  assert.equal(ballLabel(b({ wicket: 'LBW' })), 'W');
  assert.equal(ballLabel(b({ extraType: 'NB', extraRuns: 1, runs: 4 })), '4nb');
  assert.equal(oversStr(19), '3.1');
});
