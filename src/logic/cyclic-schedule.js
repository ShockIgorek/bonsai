// Кулдаун циклических задач и объективная сложность.
// Всё считается из completionHistory задачи.

export const BONUS_MULTIPLIER = 1.25;
export const BONUS_WINDOW_END = 1.5;
export const CARD_MIN_OPACITY = 0.35;
export const DIFFICULTY_SAMPLE_SIZE = 10;

export function getIntervalMinutes(task) {
  const minutes = Number(task && task.interval && task.interval.totalMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

export function getCompletionHistory(task) {
  return task && Array.isArray(task.completionHistory) ? task.completionHistory : [];
}

export function getLastCompletionAt(task) {
  const history = getCompletionHistory(task);
  if (!history.length) return null;
  const value = Number(history[history.length - 1].at);
  return Number.isFinite(value) ? value : null;
}

/**
 * Состояние кулдауна.
 * ratio = прошедшее время / интервал.
 * Во время кулдауна множитель линейно растёт 0 → 1.
 * После восстановления до 150% интервала действует бонус 1.25.
 */
export function getCooldownState(task, now = Date.now()) {
  const intervalMinutes = getIntervalMinutes(task);
  const lastAt = getLastCompletionAt(task);

  if (!intervalMinutes || !lastAt) {
    return {
      hasSchedule: false,
      isCooling: false,
      ratio: 1,
      multiplier: 1,
      opacity: 1,
      remainingMs: 0,
      nextAt: null,
      lastAt
    };
  }

  const intervalMs = intervalMinutes * 60000;
  const elapsed = Math.max(0, now - lastAt);
  const ratio = elapsed / intervalMs;
  const nextAt = lastAt + intervalMs;

  if (ratio < 1) {
    const multiplier = Math.max(0, Math.min(1, ratio));
    const opacity = CARD_MIN_OPACITY + (1 - CARD_MIN_OPACITY) * multiplier;

    return {
      hasSchedule: true,
      isCooling: true,
      ratio,
      multiplier,
      opacity,
      remainingMs: Math.max(0, nextAt - now),
      nextAt,
      lastAt
    };
  }

  const bonusActive = ratio < BONUS_WINDOW_END;
  return {
    hasSchedule: true,
    isCooling: false,
    ratio,
    multiplier: bonusActive ? BONUS_MULTIPLIER : 1,
    opacity: 1,
    remainingMs: 0,
    nextAt,
    lastAt,
    bonusActive
  };
}

export function getDifficultyRatings(task) {
  return getCompletionHistory(task)
    .map(item => Number(item.difficulty))
    .filter(value => Number.isFinite(value))
    .slice(-DIFFICULTY_SAMPLE_SIZE);
}

export function getAverageDifficulty(task) {
  const ratings = getDifficultyRatings(task);
  if (!ratings.length) return null;
  const sum = ratings.reduce((total, value) => total + value, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}

/**
 * Объективная сложность (среднее последних 10 оценок) перекрывает
 * субъективную оценку из создания/теста.
 */
export function getEffectiveDifficulty(task) {
  const average = getAverageDifficulty(task);
  if (average !== null) return average;

  const initial = Number(task && task.difficulty);
  return Number.isFinite(initial) ? initial : 5;
}
