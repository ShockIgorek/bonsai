import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SORTING,
  getMoodSorting,
  scoreTask,
  getSortingPreferences
} from '../src/logic/tinder-ranking.js';

test('default sorting is importance 60%, speed 25%, difficulty 15%', () => {
  const preferences = getSortingPreferences(DEFAULT_SORTING);

  assert.deepEqual(
    preferences.map(item => item.label),
    ['Важность', 'Скорость', 'Сложность']
  );
  assert.deepEqual(
    preferences.map(item => item.share),
    [0.6, 0.25, 0.15]
  );
  assert.deepEqual(
    preferences.map(item => item.directionLabel),
    ['выше', 'короче', 'проще']
  );
});

test('score prefers important, short and easy tasks', () => {
  const quickImportant = scoreTask({
    importance: 8,
    timeScore: 1,
    difficulty: 2
  });

  const longHard = scoreTask({
    importance: 7,
    timeScore: 6,
    difficulty: 7
  });

  assert.equal(quickImportant, 8.25);
  assert.equal(longHard, 5.65);
  assert.ok(quickImportant > longHard);
});

test('long-first time direction renames speed to duration', () => {
  const preferences = getSortingPreferences({
    weights: { importance: 0.4, time: 0.3, difficulty: 0.3 },
    directions: { importance: 1, time: 1, difficulty: 1 }
  });

  assert.equal(preferences.find(item => item.key === 'time').label, 'Длительность');
  assert.equal(preferences.find(item => item.key === 'time').directionLabel, 'дольше');
});

test('custom mood weights and directions override defaults', () => {
  const sorting = getMoodSorting({
    sorting: {
      weights: { importance: 1, time: 0, difficulty: 0 },
      directions: { time: 1 }
    }
  });

  assert.equal(scoreTask({ importance: 7, timeScore: 10, difficulty: 10 }, sorting), 7);
  assert.equal(sorting.directions.time, 1);
  assert.equal(sorting.directions.importance, 1);
  assert.equal(sorting.directions.difficulty, -1);
});

test('weights are normalized and zero total falls back to defaults', () => {
  const preferences = getSortingPreferences({
    weights: { importance: 1, time: 1, difficulty: 2 },
    directions: DEFAULT_SORTING.directions
  });

  assert.deepEqual(
    preferences.map(item => item.share),
    [0.5, 0.25, 0.25]
  );

  const fallback = getMoodSorting({
    sorting: { weights: { importance: 0, time: 0, difficulty: 0 } }
  });

  assert.deepEqual(fallback.weights, DEFAULT_SORTING.weights);
});

test('metrics are clamped to 0..10', () => {
  assert.equal(scoreTask({ importance: 99, timeScore: -5, difficulty: 5 }), 9.25);
});
