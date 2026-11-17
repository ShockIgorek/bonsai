import { renderThemesScreen } from './views/themes.js';

export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;

  // Показываем экран выбора тем по умолчанию
  renderThemesScreen();
}
