import { timeToScore } from './task-metrics.js';

export const TIME_SAMPLE_SIZE = 10;

export function getActualTimeSamples(task) {
  const history = task && Array.isArray(task.completionHistory)
    ? task.completionHistory
    : [];

  return history
    .map(item => Number(item.actualMinutes))
    .filter(value => Number.isFinite(value) && value > 0)
    .slice(-TIME_SAMPLE_SIZE);
}

export function getAverageActualMinutes(task) {
  const samples = getActualTimeSamples(task);
  if (!samples.length) return null;

  const sum = samples.reduce((total, value) => total + value, 0);
  return Math.round((sum / samples.length) * 10) / 10;
}

/**
 * Объективные замеры перекрывают субъективную оценку.
 * Возвращает среднее последних 10 фактических значений или null.
 */
export function applyActualTimeStats(task) {
  const average = getAverageActualMinutes(task);
  if (average === null) return null;

  task.duration = {
    ...(task.duration || {}),
    actual: average
  };
  task.timeScore = timeToScore(average);
  return average;
}
