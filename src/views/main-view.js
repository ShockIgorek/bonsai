import { renderListView } from './list-view.js';
import { renderNavView } from './nav-view.js';
import { renderTinderView } from './tinder-view.js';

export function renderMainView(mode = 'tinder') {
  const main = document.getElementById('main-content');
  if (!main) return;

  if (mode === 'list') {
    renderListView();
    return;
  }

  if (mode === 'navigation') {
    renderNavView();
    return;
  }

  // По умолчанию — Тиндер
  renderTinderView();
}
