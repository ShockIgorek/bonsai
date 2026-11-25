// Чистая логика попарного теста приоритетов.
// Никакого DOM и localStorage — только данные, чтобы это можно было тестировать отдельно.

export const TEST_START_RATING = 1000;
export const TEST_K_FACTOR = 32;
export const MANUAL_K_FACTOR = 0.3;
export const PRIORITY_MIN = 0;
export const PRIORITY_MAX = 10;

const MIN_COMPARISONS_PER_TASK = 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function roundPriority(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Создаёт сессию теста.
 * @param {Array<{id: string, name: string, desc?: string, path?: string}>} tasks
 */
export function createPrioritySession(tasks) {
  const ratings = {};
  const counts = {};

  for (const task of tasks) {
    ratings[task.id] = TEST_START_RATING;
    counts[task.id] = 0;
  }

  return {
    tasks: tasks.map(task => ({ ...task })),
    ratings,
    counts,
    comparisons: 0,
    lastPairKey: null
  };
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Выбирает следующую пару: случайно, но с приоритетом для задач,
 * которые участвовали меньше остальных. Так тест не зацикливается
 * на двух задачах и постепенно покрывает все.
 */
export function pickNextPair(session) {
  const tasks = session.tasks;
  if (tasks.length < 2) return null;

  const minCount = Math.min(...tasks.map(t => session.counts[t.id] || 0));
  const pool = tasks.filter(t => (session.counts[t.id] || 0) <= minCount + 1);

  for (let attempt = 0; attempt < 20; attempt++) {
    const a = randomFrom(pool);
    const b = randomFrom(pool);
    if (a.id === b.id) continue;

    const key = pairKey(a.id, b.id);
    // По возможности не показываем одну и ту же пару два раза подряд
    if (key === session.lastPairKey && pool.length > 2) continue;

    return [a, b];
  }

  // Страховка: любые две разные задачи
  const a = randomFrom(tasks);
  const b = tasks.find(t => t.id !== a.id);
  return [a, b];
}

/**
 * Ничья: оба получают по 0.5 очка. Нужна для кнопки «=».
 */
export function applyPriorityDraw(session, aId, bId) {
  const aRating = session.ratings[aId];
  const bRating = session.ratings[bId];
  if (!Number.isFinite(aRating) || !Number.isFinite(bRating)) return;

  const expectedA = 1 / (1 + Math.pow(10, (bRating - aRating) / 400));
  const delta = TEST_K_FACTOR * (0.5 - expectedA);

  session.ratings[aId] = aRating + delta;
  session.ratings[bId] = bRating - delta;
  session.counts[aId] = (session.counts[aId] || 0) + 1;
  session.counts[bId] = (session.counts[bId] || 0) + 1;
  session.comparisons += 1;
  session.lastPairKey = pairKey(aId, bId);
}

/**
 * Обновляет Elo-рейтинги пары и счётчики участия.
 */
export function applyPriorityChoice(session, winnerId, loserId) {
  const winnerRating = session.ratings[winnerId];
  const loserRating = session.ratings[loserId];
  if (!Number.isFinite(winnerRating) || !Number.isFinite(loserRating)) return;

  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const delta = TEST_K_FACTOR * (1 - expected);

  session.ratings[winnerId] = winnerRating + delta;
  session.ratings[loserId] = loserRating - delta;
  session.counts[winnerId] = (session.counts[winnerId] || 0) + 1;
  session.counts[loserId] = (session.counts[loserId] || 0) + 1;
  session.comparisons += 1;
  session.lastPairKey = pairKey(winnerId, loserId);
}

/**
 * Прогресс теста: считаем задачу «переоценённой», если она участвовала
 * минимум MIN_COMPARISONS_PER_TASK раз.
 */
export function getPriorityProgress(session) {
  const total = session.tasks.length;
  const covered = session.tasks.filter(t => (session.counts[t.id] || 0) >= MIN_COMPARISONS_PER_TASK).length;
  const compared = session.tasks.filter(t => (session.counts[t.id] || 0) >= 1).length;

  return {
    total,
    covered,
    compared,
    comparisons: session.comparisons,
    coverage: total ? covered / total : 0,
    canFinish: session.comparisons > 0,
    minComparisonsPerTask: MIN_COMPARISONS_PER_TASK
  };
}

/**
 * Финальная нормализация в 0..10 по местам.
 * Раскладываем задачи по рейтингу и равномерно растягиваем места:
 * для трёх задач это даёт 0 / 5 / 10, даже если Elo-очки лидеров близки.
 * Задачи с одинаковым рейтингом делят среднее место.
 */
export function finalizePrioritySession(session) {
  const tasks = session.tasks;
  if (!tasks.length) return {};
  if (tasks.length === 1) return { [tasks[0].id]: 5.0 };

  const sorted = [...tasks].sort((a, b) => session.ratings[a.id] - session.ratings[b.id]);
  const result = {};
  let index = 0;

  while (index < sorted.length) {
    let end = index;
    while (
      end + 1 < sorted.length
      && Math.abs(session.ratings[sorted[end + 1].id] - session.ratings[sorted[index].id]) < 0.0001
    ) {
      end += 1;
    }

    const averageRank = (index + end) / 2;
    const value = (averageRank / (sorted.length - 1)) * 10;

    for (let i = index; i <= end; i += 1) {
      result[sorted[i].id] = roundPriority(value);
    }
    index = end + 1;
  }

  return result;
}

/**
 * Ручное сравнение для кнопок +/-.
 * Работает уже с нормализованными значениями 0..10:
 * Elo-шаг меняет только пару, остальные задачи не трогаем.
 * Гарантирует, что победитель окажется выше проигравшего.
 */
export function applyManualPriorityComparison(priorityMap, winnerId, loserId) {
  const winner = Number(priorityMap[winnerId]);
  const loser = Number(priorityMap[loserId]);
  if (!Number.isFinite(winner) || !Number.isFinite(loser)) {
    return { ...priorityMap };
  }

  // Шкала 0..10 соответствует 400 Elo-пунктам (4 пункта приоритета)
  const expected = 1 / (1 + Math.pow(10, (loser - winner) / 4));
  const delta = MANUAL_K_FACTOR * (1 - expected);

  let nextWinner = clamp(winner + delta, PRIORITY_MIN, PRIORITY_MAX);
  let nextLoser = clamp(loser - delta, PRIORITY_MIN, PRIORITY_MAX);

  // Пользователь подтвердил, что победитель важнее — не даём значениям
  // остаться на одном уровне или перевернуться.
  if (nextWinner <= nextLoser) {
    nextWinner = Math.min(PRIORITY_MAX, nextLoser + 0.1);
    if (nextWinner <= nextLoser) {
      nextLoser = Math.max(PRIORITY_MIN, nextWinner - 0.1);
    }
  }

  let resultWinner = roundPriority(nextWinner);
  let resultLoser = roundPriority(nextLoser);

  // После округления до 0.1 победитель всё ещё должен быть выше
  if (resultWinner <= resultLoser) {
    resultWinner = Math.min(PRIORITY_MAX, roundPriority(resultLoser + 0.1));
    if (resultWinner <= resultLoser) {
      resultLoser = Math.max(PRIORITY_MIN, roundPriority(resultWinner - 0.1));
    }
  }

  return {
    ...priorityMap,
    [winnerId]: resultWinner,
    [loserId]: resultLoser
  };
}
