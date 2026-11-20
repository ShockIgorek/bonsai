import { getMoods } from '../data/moods-store.js';

export function renderLayout({ showTabs = true, showHeader = true } = {}) {
  const app = document.getElementById('app');
  if (!app) return;

  // Получаем имя активного настроения
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const activeMoodName = activeMood ? activeMood.name : 'Bonsai';

  app.innerHTML = `
    <div class="layout">
      ${showHeader ? `
      <header class="header">
        <button class="burger-menu" aria-label="Меню">☰</button>
        <div class="logo">${activeMoodName}</div>
        <div class="header-spacer"></div>
      </header>
      ` : ''}

      <main id="main-content" class="main-content"></main>

      ${showTabs ? `
      <nav class="tab-bar">
        <button class="tab-item active" data-view="tinder">🔥</button>
        <button class="tab-item" data-view="navigation">📁</button>
        <button class="tab-item" data-view="list">📋</button>
      </nav>
      ` : ''}
    </div>
  `;
}

/**
 * Обновляет только текст в хедере, не перерисовывая весь layout.
 * Вызывать после смены активного настроения.
 */
export function updateHeaderMoodName() {
  const logo = document.querySelector('.header .logo');
  if (!logo) return;
  
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  
  logo.textContent = activeMood ? activeMood.name : 'Bonsai';
}
