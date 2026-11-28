import { getCompletionHistory, getIntervalMinutes } from './cyclic-schedule.js';

export const STREAK_SEGMENTS = 10;

const STATUS_FULL = 'full';
const STATUS_WEAK = 'weak';
const STATUS_MISSED = 'missed';
const STATUS_EMPTY = 'empty';

function buildStatuses(task, now, includePending) {
  const intervalMinutes = getIntervalMinutes(task);
  const history = getCompletionHistory(task);

  if (!intervalMinutes || !history.length) return [];

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

  // Пропуски, которые уже накопились в текущем ожидании.
  // Для карточки их можно отключить: пока пользователь не выполнил задачу,
  // это ещё не завершённый цикл, и шкала не должна «закрашиваться» сама.
  if (includePending) {
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
  }

  return statuses;
}

function padSegments(statuses, count) {
  return statuses.concat(Array(Math.max(0, count - statuses.length)).fill(STATUS_EMPTY));
}

/**
 * Полная история для статистики: последние `count` циклов,
 * включая текущее ожидание.
 */
export function getStreakSegments(task, now = Date.now(), count = STREAK_SEGMENTS, options = {}) {
  const includePending = options.includePending !== false;
  const statuses = buildStatuses(task, now, includePending);
  return padSegments(statuses.slice(-count), count);
}

/**
 * Шкала для карточки: только завершённые циклы, без текущего ожидания.
 * Начинаем с первого закрашенного сегмента, чтобы длина серии была видна.
 */
export function getDisplayStreakSegments(task, now = Date.now(), count = STREAK_SEGMENTS) {
  const statuses = buildStatuses(task, now, false);
  const window = statuses.slice(-count);
  const firstFilled = window.findIndex(status => (
    status === STATUS_FULL || status === STATUS_WEAK
  ));

  if (firstFilled === -1) {
    return padSegments([], count);
  }

  return padSegments(window.slice(firstFilled), count);
}
