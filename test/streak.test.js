import test from 'node:test';
import assert from 'node:assert/strict';
import { getStreakSegments, STREAK_SEGMENTS } from '../src/logic/streak.js';

const H = 3600000;
const BASE = Date.UTC(2026, 0, 1);

function makeTask(completionHours, intervalHours = 20) {
  return {
    interval: { totalMinutes: intervalHours * 60 },
    completionHistory: completionHours.map(hours => ({
      at: BASE + hours * H,
      difficulty: 5
    }))
  };
}

function firstSegments(task, nowHours) {
  return getStreakSegments(task, BASE + nowHours * H).slice(0, 5);
}

test('empty history gives empty strip', () => {
  const segments = getStreakSegments(makeTask([]), BASE);
  assert.equal(segments.length, STREAK_SEGMENTS);
  assert.ok(segments.every(status => status === 'empty'));
});

test('first completion fills the first segment', () => {
  assert.deepEqual(firstSegments(makeTask([0]), 0), ['full', 'empty', 'empty', 'empty', 'empty']);
});

test('completion at 21h is full, at 31h is weak', () => {
  assert.deepEqual(firstSegments(makeTask([0, 21]), 21), ['full', 'full', 'empty', 'empty', 'empty']);
  assert.deepEqual(firstSegments(makeTask([0, 31]), 31), ['full', 'weak', 'empty', 'empty', 'empty']);
});

test('late completion adds missed segments before the current one', () => {
  assert.deepEqual(firstSegments(makeTask([0, 41]), 41), ['full', 'missed', 'full', 'empty', 'empty']);
  assert.deepEqual(firstSegments(makeTask([0, 61]), 61), ['full', 'missed', 'missed', 'full', 'empty']);
});

test('waiting past two intervals adds missed segments', () => {
  assert.deepEqual(firstSegments(makeTask([0]), 41), ['full', 'missed', 'empty', 'empty', 'empty']);
  assert.deepEqual(firstSegments(makeTask([0]), 61), ['full', 'missed', 'missed', 'empty', 'empty']);
});

test('strip always has exactly 10 segments', () => {
  const task = makeTask(Array.from({ length: 20 }, (_, index) => index * 20));
  const segments = getStreakSegments(task, BASE + 19 * 20 * H);
  assert.equal(segments.length, STREAK_SEGMENTS);
});
