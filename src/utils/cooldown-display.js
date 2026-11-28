export function cooldownPercent(ratio) {
  const value = Math.max(0, Math.min(1, Number(ratio) || 0));
  return Math.min(99, Math.floor(value * 100));
}

/**
 * Угол границы сектора: 0° — 12 часов, 180° — 6 часов.
 */
export function cooldownSweepDegrees(ratio) {
  return Math.max(0, Math.min(1, Number(ratio) || 0)) * 360;
}

/**
 * Тёмный сектор поверх картинки, который уходит по часовой стрелке.
 * 0 — всё закрыто, 1 — всё открыто.
 */
export function cooldownShadeBackground(ratio) {
  const degrees = cooldownSweepDegrees(ratio);
  const shade = 'color-mix(in srgb, var(--bg-main) 78%, transparent)';

  return `conic-gradient(from 0deg, transparent 0deg, transparent ${degrees}deg, ${shade} ${degrees}deg, ${shade} 360deg)`;
}
