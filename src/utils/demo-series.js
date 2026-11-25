// ВРЕМЕННО: демо-серия для визуальной проверки полосы статистики.
// Включено, пока не появится реальная механика серий.
// Чтобы выключить — поставь DEMO_SERIES_ENABLED = false.
export const DEMO_SERIES_ENABLED = true;

export const SERIES_SEGMENTS = 10;

const cache = new Map();

/**
 * Случайное, но стабильное для задачи число закрашенных полос (0..SEGMENTS).
 * Стабильное — чтобы полоса не перескакивала при каждом рендере карточки.
 */
export function getDemoSeries(id) {
  if (!cache.has(id)) {
    cache.set(id, Math.floor(Math.random() * (SERIES_SEGMENTS + 1)));
  }
  return cache.get(id);
}
