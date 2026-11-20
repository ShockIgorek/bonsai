import { renderLayout } from './views/layout.js';
import { renderThemesScreen } from './views/themes.js';
import { renderMoodsScreen } from './views/moods.js';

export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;

  // Теперь при старте показываем экран настроений (внутри каркаса с шапкой и табами)
  renderLayout({ showHeader: true, showTabs: true });
  renderMoodsScreen();
}

export function showMoodsScreen() {
  const app = document.getElementById('app');
  if (!app) return;

  // Перерисовываем каркас на всякий случай и показываем настроения
  renderLayout({ showHeader: true, showTabs: true });
  renderMoodsScreen();
}

export function showThemesScreen(options) {
  const app = document.getElementById('app');
  if (!app) return;

  // Экран тем показываем без шапки и таб-бара (или с ними, если нужно)
  renderLayout({ showHeader: true, showTabs: true });
  renderThemesScreen(options);
}
