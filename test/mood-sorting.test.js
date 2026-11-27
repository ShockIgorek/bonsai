import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveMoodSorting,
  applySortingPreset,
  resetMoodSorting,
  normalizeSortingConfig
} from '../src/data/mood-sorting.js';
import { getMoods } from '../src/data/moods-store.js';
import { getMoodSorting, DEFAULT_SORTING } from '../src/logic/tinder-ranking.js';
import { installMemoryStorage } from './helpers/memory-storage.js';

function seed() {
  installMemoryStorage({
    'bonsai-moods': [
      { id: 'default', name: 'Норма', priorities: {}, hiddenTasks: [] }
    ]
  });
}

test('custom weights are normalized and saved in mood.sorting', () => {
  seed();

  const saved = saveMoodSorting('default', {
    weights: { importance: 2, time: 1, difficulty: 1 },
    directions: { importance: 1, time: -1, difficulty: -1 },
    presetId: null
  });

  assert.deepEqual(saved.weights, {
    importance: 0.5,
    time: 0.25,
    difficulty: 0.25
  });

  const mood = getMoods().find(item => item.id === 'default');
  const sorting = getMoodSorting(mood);

  assert.deepEqual(sorting.weights, saved.weights);
  assert.equal(sorting.directions.importance, 1);
  assert.equal(sorting.directions.time, -1);
});

test('preset applies weights, directions and presetId', () => {
  seed();

  applySortingPreset('default', 'rest');
  const mood = getMoods().find(item => item.id === 'default');
  const sorting = getMoodSorting(mood);

  assert.equal(mood.sorting.presetId, 'rest');
  assert.deepEqual(sorting.weights, {
    importance: 0.2,
    time: 0.4,
    difficulty: 0.4
  });
  assert.deepEqual(sorting.directions, {
    importance: -1,
    time: -1,
    difficulty: -1
  });
});

test('reset removes custom sorting', () => {
  seed();
  applySortingPreset('default', 'machine');

  assert.equal(resetMoodSorting('default'), true);

  const mood = getMoods().find(item => item.id === 'default');
  assert.equal(mood.sorting, undefined);
  assert.deepEqual(getMoodSorting(mood).weights, DEFAULT_SORTING.weights);
});

test('zero weights fall back to defaults', () => {
  const normalized = normalizeSortingConfig({
    weights: { importance: 0, time: 0, difficulty: 0 },
    directions: { importance: 1, time: -1, difficulty: -1 }
  });

  assert.deepEqual(normalized.weights, DEFAULT_SORTING.weights);
});
