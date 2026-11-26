// Единое визуальное правило для метрик: важность, время, сложность.
// Значение 0..10: прозрачность растёт с величиной, >5 добавляет свечение.

export function metricValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 5;
  return Math.max(0, Math.min(10, number));
}

export function metricOpacity(value) {
  const v = metricValue(value);
  return Number((0.45 + (v / 10) * 0.55).toFixed(2));
}

export function metricTextShadow(value, color = 'currentColor') {
  const v = metricValue(value);
  if (v <= 5) return '0 2px 4px rgba(0,0,0,0.5)';
  return `0 0 ${((v - 5) * 3).toFixed(1)}px ${color}, 0 2px 4px rgba(0,0,0,0.5)`;
}

export function applyMetricStyle(el, value) {
  if (!el) return;
  el.style.opacity = metricOpacity(value);
  el.style.textShadow = metricTextShadow(value);
}
