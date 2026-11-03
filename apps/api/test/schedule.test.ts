import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundRobin } from '../src/lib/schedule.ts';

const key = (a: string, b: string) => [a, b].sort().join('-');

test('single round-robin: every pair meets exactly once', () => {
  const teams = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const pairs = roundRobin(teams, 1);
  assert.equal(pairs.length, 28);
  assert.equal(new Set(pairs.map(([a, b]) => key(a, b))).size, 28);
  assert.ok(pairs.every(([a, b]) => a !== b));
});

test('odd number of teams uses byes', () => {
  assert.equal(roundRobin(['A', 'B', 'C', 'D', 'E'], 1).length, 10);
});

test('double round-robin: home and away legs', () => {
  const pairs = roundRobin(['A', 'B', 'C', 'D'], 2);
  assert.equal(pairs.length, 12);
  const counts = new Map<string, number>();
  pairs.forEach(([a, b]) => counts.set(key(a, b), (counts.get(key(a, b)) ?? 0) + 1));
  assert.ok([...counts.values()].every((c) => c === 2));
});
