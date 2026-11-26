import { renderLayout } from './views/layout.js';
import { renderThemesScreen } from './views/themes.js';
import { renderMoodsScreen } from './views/moods.js';
import { renderMainView } from './views/main-view.js';

export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;

  // Применяем сохранённую тему при старте
  const savedTheme = localStorage.getItem('bonsai-theme') || 'bonsai';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // На каждом запуске начинаем с выбора настроения
  localStorage.removeItem('bonsai-last-screen');
  renderLayout({ showHeader: true, showTabs: true });
  renderMoodsScreen({ startup: true });
}

export function showMainView(mode = 'tinder') {
  const app = document.getElementById('app');
  if (!app) return;

  // Применяем сохранённую тему
  const savedTheme = localStorage.getItem('bonsai-theme') || 'bonsai';
  document.documentElement.setAttribute('data-theme', savedTheme);

  renderLayout({ showHeader: true, showTabs: true });
  renderMainView(mode);
}

export function showMoodsScreen() {
  const app = document.getElementById('app');
  if (!app) return;

  renderLayout({ showHeader: true, showTabs: true });
  renderMoodsScreen();
}

export function showThemesScreen(options) {
  const app = document.getElementById('app');
  if (!app) return;

  renderLayout({ showHeader: true, showTabs: true });
  renderThemesScreen(options);
}
