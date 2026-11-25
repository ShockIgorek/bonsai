import { getMoods, saveMoods } from './moods-store.js';

/**
 * Приоритеты конкретного настроения: { [taskId]: 0..10 }.
 */
export function getMoodPriorities(moodId) {
  const mood = getMoods().find(m => m.id === moodId);
  return mood && mood.priorities ? mood.priorities : {};
}

export function saveMoodPriorities(moodId, priorities) {
  const moods = getMoods();
  const index = moods.findIndex(m => m.id === moodId);
  if (index === -1) return false;

  moods[index] = { ...moods[index], priorities };
  saveMoods(moods);
  return true;
}

/**
 * Единый резолвер приоритета для текущего настроения.
 *
 * Правила:
 *  1. Если у настроения есть собственное значение для задачи — берём его.
 *  2. Для «Нормы» без собственного значения — базовый task.priority.
 *  3. Для остальных настроений без собственного значения — среднее
 *     по значениям из других настроений, где тест/правка уже были.
 *  4. Если нигде значений нет — базовый task.priority.
 *  5. Папки не сравниваются: их приоритет = среднее по детям.
 */
export function createPriorityResolver(nav, moodId) {
  const moods = getMoods();
  const mood = moods.find(m => m.id === moodId);
  const own = mood && mood.priorities ? mood.priorities : {};
  const isDefault = moodId === 'default';

  const otherMaps = moods
    .filter(m => m.id !== moodId && m.priorities && typeof m.priorities === 'object')
    .map(m => m.priorities);

  const cache = new Map();

  function readValue(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  function baseValue(task) {
    const value = readValue(task.priority);
    return value === null ? 5 : value;
  }

  function inheritedValue(taskId) {
    const values = [];
    for (const map of otherMaps) {
      const value = readValue(map[taskId]);
      if (value !== null) values.push(value);
    }
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function resolveLeaf(task) {
    const ownValue = readValue(own[task.id]);
    if (ownValue !== null) return ownValue;

    if (!isDefault) {
      const inherited = inheritedValue(task.id);
      if (inherited !== null) return inherited;
    }

    return baseValue(task);
  }

  function resolve(taskId) {
    if (cache.has(taskId)) return cache.get(taskId);

    const task = nav.byId.get(taskId);
    if (!task) return 5;

    let value;
    if (task.isLeaf) {
      value = resolveLeaf(task);
    } else {
      const children = task.childIds.map(id => resolve(id));
      value = children.length
        ? children.reduce((sum, childValue) => sum + childValue, 0) / children.length
        : baseValue(task);
    }

    const rounded = Math.round(value * 10) / 10;
    cache.set(taskId, rounded);
    return rounded;
  }

  return {
    mood,
    isDefault,
    resolve
  };
}
