/**
 * Форматирует минуты в человекочитаемый вид: "1 д 3 ч 12 мин"
 * @param {number} totalMinutes — общее количество минут
 * @returns {string}
 */
export function formatInterval(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '0 мин';
  
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days} д`);
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0) parts.push(`${minutes} мин`);
  
  return parts.join(' ') || '0 мин';
}

/**
 * Время выполнения задачи: сначала объективное (actual), затем оценка.
 * @returns {number|null} минуты
 */
export function getTaskDurationMinutes(duration) {
  if (!duration) return null;

  const actual = Number(duration.actual);
  if (Number.isFinite(actual) && actual > 0) return actual;

  const estimated = Number(duration.estimated);
  if (Number.isFinite(estimated) && estimated > 0) return estimated;

  return null;
}

/**
 * Компактное человеческое время для верхней части карточки:
 * 45м, 1ч 30м, 2д 4ч.
 */
export function formatTaskDuration(duration) {
  const total = getTaskDurationMinutes(duration);
  if (total === null) return '—';

  if (total < 1) return `${Math.max(1, Math.round(total * 60))}с`;

  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = Math.round(total % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0) parts.push(`${hours}ч`);
  if (minutes > 0 || (!days && !hours)) parts.push(`${minutes}м`);

  return parts.join(' ');
}

/**
 * Оценка времени из формы, не подменяя её фактическим замером.
 */
export function getTaskEstimateMinutes(duration) {
  const estimated = Number(duration && duration.estimated);
  if (Number.isFinite(estimated) && estimated > 0) return estimated;

  const actual = Number(duration && duration.actual);
  if (Number.isFinite(actual) && actual > 0) return actual;

  return 20;
}

/**
 * Секундомер: 05:12 или 1:05:12.
 */
export function formatTimerClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}д`);
  if (hours > 0) parts.push(`${hours}ч`);
  if (minutes > 0) parts.push(`${minutes}м`);
  parts.push(`${String(seconds).padStart(2, '0')}с`);

  return parts.join(' ');
}

export function formatLastCompleted(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
