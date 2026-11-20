import { renderLayout } from './views/layout.js';
import { renderThemesScreen } from './views/themes.js';
import { renderMoodsScreen } from './views/moods.js';
import { renderMainView } from './views/main-view.js';

export function initRouter() {
  const app = document.getElementById('app');
  if (!app) return;

  // Стартуем с главного экрана (режим тиндера пока заглушка)
  // Но если активного настроения нет — можно показать настроения (опционально)
  renderLayout({ showHeader: true, showTabs: true });
  renderMainView('tinder');
}

export function showMainView(mode = 'tinder') {
  const app = document.getElementById('app');
  if (!app) return;

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
