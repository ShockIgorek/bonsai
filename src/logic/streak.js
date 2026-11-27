import { getCompletionHistory, getIntervalMinutes } from './cyclic-schedule.js';

export const STREAK_SEGMENTS = 10;

const STATUS_FULL = 'full';
const STATUS_WEAK = 'weak';
const STATUS_MISSED = 'missed';
const STATUS_EMPTY = 'empty';

/**
 * Сегменты полосы серии по последним циклам.
 *
 * Правила (в долях интервала между выполнениями):
 *  - первое выполнение — полный сегмент;
 *  - повтор/досрочное выполнение < 150% — полный сегмент;
 *  - 150–200% — слабый сегмент (без свечения, с прозрачностью);
 *  - каждые следующие 100% без выполнения — пропущенный сегмент;
 *  - если выполнение случилось после пропусков — сначала пропуски, затем текущий.
 */
export function getStreakSegments(task, now = Date.now(), count = STREAK_SEGMENTS) {
  const intervalMinutes = getIntervalMinutes(task);
  const history = getCompletionHistory(task);

  if (!intervalMinutes || !history.length) {
    return Array(count).fill(STATUS_EMPTY);
  }

  const intervalMs = intervalMinutes * 60000;
  const statuses = [STATUS_FULL];

  for (let i = 1; i < history.length; i += 1) {
    const previousAt = Number(history[i - 1].at);
    const completedAt = Number(history[i].at);
    if (!Number.isFinite(previousAt) || !Number.isFinite(completedAt)) continue;

    const ratio = Math.max(0, completedAt - previousAt) / intervalMs;

    if (ratio >= 2) {
      const missed = Math.max(0, Math.floor(ratio) - 1);
      for (let missedIndex = 0; missedIndex < missed; missedIndex += 1) {
        statuses.push(STATUS_MISSED);
      }
      statuses.push(STATUS_FULL);
    } else if (ratio >= 1.5) {
      statuses.push(STATUS_WEAK);
    } else {
      statuses.push(STATUS_FULL);
    }
  }

  // Пропуски, которые уже накопились в текущем ожидании
  const lastAt = Number(history[history.length - 1].at);
  if (Number.isFinite(lastAt)) {
    const ratio = Math.max(0, now - lastAt) / intervalMs;
    if (ratio >= 2) {
      const missed = Math.max(0, Math.floor(ratio) - 1);
      for (let missedIndex = 0; missedIndex < missed; missedIndex += 1) {
        statuses.push(STATUS_MISSED);
      }
    }
  }

  const recent = statuses.slice(-count);
  return recent.concat(Array(Math.max(0, count - recent.length)).fill(STATUS_EMPTY));
}
