import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActualTimeSamples,
  getAverageActualMinutes,
  applyActualTimeStats
} from '../src/logic/task-time.js';
import { timeToScore } from '../src/logic/task-metrics.js';
import { buildNavIndex } from '../src/store.js';

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

test('calibrated sortTimeScore is used only when there is no actual time', () => {
  const tree = {
    id: 'root',
    name: 'Мои задачи',
    children: [
      {
        id: 'subjective',
        name: 'Без замера',
        type: 'cyclic',
        duration: { estimated: 30, actual: null },
        timeScore: 1.2,
        sortTimeScore: 2.5
      },
      {
        id: 'measured',
        name: 'С замером',
        type: 'cyclic',
        duration: { estimated: 30, actual: null },
        timeScore: 1.2,
        sortTimeScore: 2.5,
        completionHistory: [{ at: 1, actualMinutes: 20 }]
      }
    ]
  };

  const nav = buildNavIndex(tree);

  assert.equal(nav.byId.get('subjective').sortTimeScore, 2.5);
  assert.equal(nav.byId.get('measured').sortTimeScore, null);
  assert.equal(nav.byId.get('measured').duration.actual, 20);
});
