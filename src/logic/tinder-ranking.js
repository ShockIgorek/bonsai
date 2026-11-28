export const DEFAULT_SORTING = {
  weights: {
    importance: 0.6,
    time: 0.25,
    difficulty: 0.15
  },
  directions: {
    importance: 1,
    time: -1,
    difficulty: -1
  }
};

const SUMMARY_WORDS = {
  importance: { positive: 'важные', negative: 'менее важные' },
  time: { positive: 'длинные', negative: 'короткие' },
  difficulty: { positive: 'сложные', negative: 'простые' }
};

const CRITERIA = [
  {
    key: 'importance',
    label: 'Важность',
    highLabel: 'выше',
    lowLabel: 'ниже'
  },
  {
    key: 'time',
    label: 'Скорость',
    positiveLabel: 'Длительность',
    highLabel: 'дольше',
    lowLabel: 'короче'
  },
  {
    key: 'difficulty',
    label: 'Сложность',
    highLabel: 'сложнее',
    lowLabel: 'проще'
  }
];

function clampMetric(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 5;
  return Math.max(0, Math.min(10, number));
}

function normalizeWeights(weights) {
  const merged = {
    ...DEFAULT_SORTING.weights,
    ...(weights && typeof weights === 'object' ? weights : {})
  };

  const result = {};
  for (const criterion of CRITERIA) {
    const value = Number(merged[criterion.key]);
    result[criterion.key] = Number.isFinite(value) && value >= 0
      ? value
      : DEFAULT_SORTING.weights[criterion.key];
  }

  const total = Object.values(result).reduce((sum, value) => sum + value, 0);
  return total > 0 ? result : { ...DEFAULT_SORTING.weights };
}

function normalizeDirections(directions) {
  const merged = {
    ...DEFAULT_SORTING.directions,
    ...(directions && typeof directions === 'object' ? directions : {})
  };

  const result = {};
  for (const criterion of CRITERIA) {
    result[criterion.key] = Number(merged[criterion.key]) < 0 ? -1 : 1;
  }
  return result;
}

/**
 * Возвращает настройки сортировки для настроения.
 * Пока у настроения нет своих весов — используются дефолтные.
 */
export function getMoodSorting(mood) {
  const custom = mood && mood.sorting && typeof mood.sorting === 'object'
    ? mood.sorting
    : {};

  return {
    weights: normalizeWeights(custom.weights),
    directions: normalizeDirections(custom.directions)
  };
}

/**
 * Базовая релевантность задачи 0..10.
 * Кулдаун умножается отдельно в Тиндере.
 */
export function scoreTask(features, sorting = DEFAULT_SORTING) {
  const weights = normalizeWeights(sorting.weights);
  const directions = normalizeDirections(sorting.directions);

  const values = {
    importance: clampMetric(features && features.importance),
    time: clampMetric(features && features.timeScore),
    difficulty: clampMetric(features && features.difficulty)
  };

  let total = 0;
  let weightSum = 0;

  for (const criterion of CRITERIA) {
    const weight = weights[criterion.key];
    if (weight <= 0) continue;

    const directed = directions[criterion.key] > 0
      ? values[criterion.key]
      : 10 - values[criterion.key];

    total += directed * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * Список критериев по убыванию влияния — для карточки настроения.
 */
export function getSortingPreferences(sorting = DEFAULT_SORTING) {
  const weights = normalizeWeights(sorting.weights);
  const directions = normalizeDirections(sorting.directions);
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  return CRITERIA
    .map(criterion => {
      const direction = directions[criterion.key];
      return {
        key: criterion.key,
        label: direction > 0 ? (criterion.positiveLabel || criterion.label) : criterion.label,
        direction,
        directionLabel: direction > 0 ? criterion.highLabel : criterion.lowLabel,
        weight: weights[criterion.key],
        share: total > 0 ? weights[criterion.key] / total : 0
      };
    })
    .sort((a, b) => b.share - a.share);
}

/**
 * Человеческая расшифровка влияния: «важные → короткие → простые».
 */
export function getSortingSummary(sorting = DEFAULT_SORTING) {
  return getSortingPreferences(sorting).map(preference => ({
    key: preference.key,
    word: SUMMARY_WORDS[preference.key][preference.direction > 0 ? 'positive' : 'negative'],
    share: preference.share
  }));
}
