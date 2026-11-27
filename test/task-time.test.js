import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActualTimeSamples,
  getAverageActualMinutes,
  applyActualTimeStats
} from '../src/logic/task-time.js';
import { timeToScore } from '../src/logic/task-metrics.js';

function historyWithActuals(values) {
  return values.map((actualMinutes, index) => ({
    at: index,
    actualMinutes
  }));
}

test('actual time samples ignore empty values and keep last 10', () => {
  const samples = getActualTimeSamples({
    completionHistory: historyWithActuals([5, null, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
  });

  assert.deepEqual(samples, [10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
});

test('average actual time uses the last 10 measurements', () => {
  const task = {
    completionHistory: historyWithActuals([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120])
  };

  assert.equal(getAverageActualMinutes(task), 75);
});

test('no measurements means no objective average', () => {
  assert.equal(getAverageActualMinutes({ completionHistory: [] }), null);
  assert.equal(getAverageActualMinutes({ completionHistory: historyWithActuals([null, null]) }), null);
});

test('applyActualTimeStats updates duration and timeScore', () => {
  const task = {
    duration: { estimated: 20, actual: null },
    timeScore: 1,
    completionHistory: historyWithActuals([30, 40])
  };

  const average = applyActualTimeStats(task);

  assert.equal(average, 35);
  assert.equal(task.duration.actual, 35);
  assert.equal(task.timeScore, timeToScore(35));
  assert.equal(task.duration.estimated, 20);
});
