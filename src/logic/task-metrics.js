// Глобальные метрики задачи: время и сложность.
// Время 0..10 — только для сортировки; на карточке показываем обычные минуты.

export const TIME_SCORE_MAX_MINUTES = 240;

/**
 * Стартовое субъективное время 0..10 из примерной оценки в минутах.
 * Дальше его уточняют тестом, а объективные замеры имеют больший вес.
 */
export function timeToScore(minutes) {
  const value = Number(minutes);
  if (!Number.isFinite(value) || value <= 0) return 0;

  const score = (value / TIME_SCORE_MAX_MINUTES) * 10;
  return Math.round(Math.min(10, score) * 10) / 10;
}
