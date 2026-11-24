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
