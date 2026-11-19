import { renderLayout } from './views/layout.js';
import { renderThemesScreen } from './views/themes.js';
import { renderMoodsScreen } from './views/moods.js';

export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;

  // Показываем экран тем (без шапки и таб-бара)
  renderLayout({ showHeader: false, showTabs: false });
  renderThemesScreen();
}

export function showMoodsScreen() {
  const app = document.getElementById('app');
  if (!app) return;

  // Перерисовываем каркас: теперь с шапкой и таб-баром
  renderLayout({ showHeader: true, showTabs: true });

  // Показываем экран настроений внутри каркаса
  renderMoodsScreen();
}