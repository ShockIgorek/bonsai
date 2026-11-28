import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCooldownState,
  getAverageDifficulty,
  getEffectiveDifficulty,
  getIntervalMinutes
} from '../src/logic/cyclic-schedule.js';

const H = 3600000;
const BASE = Date.UTC(2026, 0, 1);

function makeTask({ intervalHours = 20, history = [] } = {}) {
  return {
    interval: { totalMinutes: intervalHours * 60 },
    difficulty: 5,
    completionHistory: history.map(item => ({
      at: BASE + item.hours * H,
      difficulty: item.difficulty ?? 5
    }))
  };
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`
  );
}

test('getIntervalMinutes reads totalMinutes', () => {
  assert.equal(getIntervalMinutes({ interval: { totalMinutes: 90 } }), 90);
  assert.equal(getIntervalMinutes({ interval: { totalMinutes: 0 } }), 0);
  assert.equal(getIntervalMinutes({}), 0);
});

test('no completion means no active cooldown', () => {
  const state = getCooldownState(makeTask(), BASE);
  assert.equal(state.hasSchedule, false);
  assert.equal(state.isCooling, false);
  assert.equal(state.multiplier, 1);
  assert.equal(state.opacity, 1);
});

test('cooldown multiplier grows linearly to 1', () => {
  const task = makeTask({ history: [{ hours: 0 }] });

  const quarter = getCooldownState(task, BASE + 5 * H);
  assert.equal(quarter.isCooling, true);
  assertClose(quarter.ratio, 0.25, 'quarter ratio');
  assertClose(quarter.multiplier, 0.25, 'quarter multiplier');
  assertClose(quarter.opacity, 0.35 + 0.65 * 0.25, 'quarter opacity');

  const half = getCooldownState(task, BASE + 10 * H);
  assertClose(half.ratio, 0.5, 'half ratio');
  assertClose(half.multiplier, 0.5, 'half multiplier');

  const end = getCooldownState(task, BASE + 20 * H);
  assert.equal(end.isCooling, false);
  assert.equal(end.multiplier, 1.25);
  assert.equal(end.bonusActive, true);
});

test('restored task keeps 1.25 bonus until 150%', () => {
  const task = makeTask({ history: [{ hours: 0 }] });

  const restored = getCooldownState(task, BASE + 20 * H);
  assertClose(restored.ratio, 1, 'restored ratio');
  assert.equal(restored.multiplier, 1.25);
  assert.equal(restored.bonusActive, true);

  const late = getCooldownState(task, BASE + 30 * H);
  assertClose(late.ratio, 1.5, 'late ratio');
  assert.equal(late.multiplier, 1);
  assert.equal(late.bonusActive, false);
});

test('bonus window reports when it ends', () => {
  const task = makeTask({ history: [{ hours: 0 }] });

  const bonus = getCooldownState(task, BASE + 24 * H);
  assert.equal(bonus.bonusActive, true);
  assert.equal(bonus.bonusEndsAt, BASE + 30 * H);
  assert.equal(bonus.bonusRemainingMs, 6 * H);

  const expired = getCooldownState(task, BASE + 31 * H);
  assert.equal(expired.bonusActive, false);
  assert.equal(expired.bonusEndsAt, null);
  assert.equal(expired.bonusRemainingMs, 0);
});

test('average difficulty uses last 10 ratings', () => {
  const task = makeTask({
    history: Array.from({ length: 12 }, (_, index) => ({
      hours: index,
      difficulty: index + 1
    }))
  });

  // Последние 10 оценок: 3..12, среднее 7.5
  assert.equal(getAverageDifficulty(task), 7.5);
});

test('skipped difficulty does not break the average', () => {
  const task = {
    completionHistory: [
      { at: 1, difficulty: 4 },
      { at: 2, difficulty: null },
      { at: 3, difficulty: 6 }
    ]
  };

  assert.equal(getAverageDifficulty(task), 5);
});

test('objective difficulty overrides subjective', () => {
  const task = {
    difficulty: 2,
    completionHistory: [{ at: 1, difficulty: 8 }]
  };

  assert.equal(getEffectiveDifficulty(task), 8);
  assert.equal(getEffectiveDifficulty({ difficulty: 2 }), 2);
});
