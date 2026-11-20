/**
 * Возвращает CSS-фильтр для превью темы.
 * Используется и на экране тем, и на карточках настроений.
 */
export function getThemeFilter(themeId) {
  const filters = {
    'noir': 'grayscale(100%) contrast(1.2)',
    'ice': 'sepia(0.3) hue-rotate(180deg) saturate(1.5)',
    'neon': 'contrast(1.2) saturate(1.5) hue-rotate(300deg)',
    'vice': 'contrast(1.1) saturate(1.3) hue-rotate(240deg)',
    'ember': 'sepia(0.6) saturate(1.4) hue-rotate(-20deg)',
    'nuance': 'sepia(0.2) hue-rotate(300deg)',
    'aqua': 'hue-rotate(150deg) saturate(1.2)',
    'sunset': 'sepia(0.4) saturate(1.3) hue-rotate(-30deg)',
    'amber': 'sepia(0.5) saturate(1.2)',
    'bonsai': 'contrast(1.1) saturate(1.2)',
    'forest': 'hue-rotate(60deg) saturate(1.3)',
    'dark': 'none',
    'light': 'none'
  };
  return filters[themeId] || 'none';
}
