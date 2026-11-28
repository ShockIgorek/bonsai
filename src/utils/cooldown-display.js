export function cooldownPercent(ratio) {
  const value = Math.max(0, Math.min(1, Number(ratio) || 0));
  return Math.min(99, Math.floor(value * 100));
}

/**
 * Тёмный сектор поверх картинки, который уходит по часовой стрелке.
 * 0 — всё закрыто, 1 — всё открыто.
 */
export function cooldownShadeBackground(ratio) {
  const degrees = Math.max(0, Math.min(1, Number(ratio) || 0)) * 360;
  const shade = 'color-mix(in srgb, var(--bg-main) 78%, transparent)';

  return `conic-gradient(from -90deg, transparent 0deg, transparent ${degrees}deg, ${shade} ${degrees}deg, ${shade} 360deg)`;
}
