import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SORTING_PRESETS,
  DEFAULT_PRESET_ID,
  getSortingPreset,
  getDefaultPreset
} from '../src/logic/sorting-presets.js';
import { DEFAULT_SORTING } from '../src/logic/tinder-ranking.js';

test('all presets have normalized weights and directions', () => {
  for (const preset of SORTING_PRESETS) {
    const total = Object.values(preset.weights).reduce((sum, value) => sum + value, 0);
    assert.equal(total, 1, `${preset.id} weights must sum to 1`);

    for (const value of Object.values(preset.directions)) {
      assert.ok(value === 1 || value === -1);
    }
  }
});

test('balance preset matches default sorting', () => {
  const preset = getSortingPreset('balance');
  assert.deepEqual(preset.weights, DEFAULT_SORTING.weights);
  assert.deepEqual(preset.directions, DEFAULT_SORTING.directions);
  assert.equal(DEFAULT_PRESET_ID, 'balance');
  assert.equal(getDefaultPreset().id, 'balance');
});

test('unknown preset returns null', () => {
  assert.equal(getSortingPreset('unknown'), null);
});
