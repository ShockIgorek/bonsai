import { DEFAULT_SORTING } from './tinder-ranking.js';

export const DEFAULT_PRESET_ID = 'balance';

export const SORTING_PRESETS = [
  {
    id: 'balance',
    name: 'Баланс',
    description: 'Важное, короткое, лёгкое',
    weights: { ...DEFAULT_SORTING.weights },
    directions: { ...DEFAULT_SORTING.directions }
  },
  {
    id: 'rest',
    name: 'Отдых',
    description: 'Короткое, лёгкое, без высоких ставок',
    weights: { importance: 0.2, time: 0.4, difficulty: 0.4 },
    directions: { importance: -1, time: -1, difficulty: -1 }
  },
  {
    id: 'machine',
    name: 'Я машина',
    description: 'Важное, длинное, сложное',
    weights: { importance: 0.4, time: 0.3, difficulty: 0.3 },
    directions: { importance: 1, time: 1, difficulty: 1 }
  }
];

export function getSortingPreset(id) {
  return SORTING_PRESETS.find(preset => preset.id === id) || null;
}

export function getDefaultPreset() {
  return getSortingPreset(DEFAULT_PRESET_ID) || SORTING_PRESETS[0];
}
