import { getMoods, saveMoods } from './moods-store.js';
import { DEFAULT_SORTING } from '../logic/tinder-ranking.js';
import { getDefaultPreset, getSortingPreset } from '../logic/sorting-presets.js';

const CRITERIA = ['importance', 'time', 'difficulty'];

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeSortingConfig(config = {}) {
  const sourceWeights = config.weights && typeof config.weights === 'object'
    ? config.weights
    : {};
  const sourceDirections = config.directions && typeof config.directions === 'object'
    ? config.directions
    : {};

  const weights = {};
  for (const criterion of CRITERIA) {
    const value = Number(sourceWeights[criterion]);
    weights[criterion] = Number.isFinite(value) && value >= 0
      ? value
      : DEFAULT_SORTING.weights[criterion];
  }

  let total = CRITERIA.reduce((sum, criterion) => sum + weights[criterion], 0);
  if (total <= 0) {
    const fallback = getDefaultPreset().weights;
    for (const criterion of CRITERIA) weights[criterion] = fallback[criterion];
    total = CRITERIA.reduce((sum, criterion) => sum + weights[criterion], 0);
  }

  const normalizedWeights = {};
  for (const criterion of CRITERIA) {
    normalizedWeights[criterion] = round(weights[criterion] / total);
  }

  const directions = {};
  for (const criterion of CRITERIA) {
    const raw = sourceDirections[criterion];
    directions[criterion] = raw === undefined || raw === null || raw === ''
      ? DEFAULT_SORTING.directions[criterion]
      : (Number(raw) < 0 ? -1 : 1);
  }

  return {
    weights: normalizedWeights,
    directions,
    presetId: config.presetId || null
  };
}

export function saveMoodSorting(moodId, config) {
  const moods = getMoods();
  const index = moods.findIndex(mood => mood.id === moodId);
  if (index === -1) return null;

  const normalized = normalizeSortingConfig(config);
  moods[index] = {
    ...moods[index],
    sorting: normalized
  };
  saveMoods(moods);
  return normalized;
}

export function applySortingPreset(moodId, presetId) {
  const preset = getSortingPreset(presetId);
  if (!preset) return null;

  return saveMoodSorting(moodId, {
    weights: preset.weights,
    directions: preset.directions,
    presetId: preset.id
  });
}

export function resetMoodSorting(moodId) {
  const moods = getMoods();
  const index = moods.findIndex(mood => mood.id === moodId);
  if (index === -1) return false;

  const next = { ...moods[index] };
  delete next.sorting;
  moods[index] = next;
  saveMoods(moods);
  return true;
}
