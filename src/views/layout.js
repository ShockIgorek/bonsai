import { getMoods } from '../data/moods-store.js';
import { ICONS } from '../utils/icons.js';
import { getRunningTimer, getTimerElapsedMs } from '../data/timer-store.js';
import { formatTimerClock } from '../utils/format-time.js';

export function renderLayout({ showTabs = true, showHeader = true } = {}) {
  const app = document.getElementById('app');
  if (!app) return;

  // Останавливаем таймеры/слушатели прошлого экрана (Тиндер и т.п.),
  // иначе они продолжат работать поверх нового экрана.
  if (typeof window.__tinderCleanup === 'function') {
    window.__tinderCleanup();
    window.__tinderCleanup = null;
  }
  if (typeof window.__globalTimerCleanup === 'function') {
    window.__globalTimerCleanup();
    window.__globalTimerCleanup = null;
  }

  // Текущий режим (для подсветки таб-бара)
  const currentMode = localStorage.getItem('bonsai-current-mode') || 'tinder';

  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const activeMoodName = activeMood ? activeMood.name : 'Bonsai';

  app.innerHTML = `
    <div class="layout">
      ${showHeader ? `
      <header class="header">
        <button class="burger-menu" aria-label="Меню">☰</button>
        <button class="logo-btn" style="background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; font-size: 16px; font-weight: 700; color: var(--text-main); margin-left: 8px; padding: 8px 16px; font-family: inherit; flex: 1; text-align: left; transition: border-color 0.2s;">${activeMoodName}</button>
        <button id="global-timer" class="global-timer" type="button" aria-label="Активный таймер">
          ${ICONS.timer}
          <span id="global-timer-value">0:00</span>
        </button>
      </header>
      ` : ''}

      <main id="main-content" class="main-content"></main>

      ${showTabs ? `
      <nav class="tab-bar">
        <button class="tab-item ${currentMode === 'tinder' ? 'active' : ''}" data-view="tinder">${ICONS.tinder}</button>
        <button class="tab-item ${currentMode === 'navigation' ? 'active' : ''}" data-view="navigation">${ICONS.folder}</button>
        <button class="tab-item ${currentMode === 'list' ? 'active' : ''}" data-view="list">${ICONS.list}</button>
      </nav>
      ` : ''}
    </div>
  `;

  mountGlobalTimer(app);

  // Обработчик бургер-меню (открывает меню импорта/экспорта)
  app.querySelector('.burger-menu')?.addEventListener('click', () => {
    import('./burger-menu.js').then(m => m.openBurgerMenu());
  });

  // Обработчик клика на название настроения (toggle: в настроения / обратно)
  app.querySelector('.logo-btn')?.addEventListener('click', () => {
    const lastScreen = localStorage.getItem('bonsai-last-screen');
    if (lastScreen && lastScreen.startsWith('moods:')) {
      // Возвращаемся на тот режим, откуда пришли (из lastScreen)
      const prevMode = lastScreen.split(':')[1] || 'tinder';
      localStorage.removeItem('bonsai-last-screen');
      // Обновляем текущий режим, чтобы таб-бар подсветился правильно
      localStorage.setItem('bonsai-current-mode', prevMode);
      import('../router.js').then(m => m.showMainView(prevMode));
    } else {
      // Запоминаем текущий режим (по активной кнопке таб-бара)
      const activeTab = document.querySelector('.tab-item.active');
      const currentMode = activeTab ? activeTab.dataset.view : 'tinder';
      localStorage.setItem('bonsai-last-screen', `moods:${currentMode}`);
      import('../router.js').then(m => m.showMoodsScreen());
    }
  });

  // Обработчик таб-бара
  if (showTabs) {
    app.querySelectorAll('.tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.view;
        // Переключаем активный класс
        app.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Сохраняем режим
        localStorage.setItem('bonsai-current-mode', mode);
        // Рендерим соответствующий режим
        import('../router.js').then(m => m.showMainView(mode));
      });
    });
  }
}

export function updateHeaderMoodName() {
  const logo = document.querySelector('.header .logo-btn');
  if (!logo) return;

  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];

  logo.textContent = activeMood ? activeMood.name : 'Bonsai';
}

function mountGlobalTimer(app) {
  const button = app.querySelector('#global-timer');
  const value = app.querySelector('#global-timer-value');
  if (!button || !value) return;

  const refresh = () => {
    const timer = getRunningTimer();
    if (!timer) {
      button.style.display = 'none';
      button.classList.remove('is-running');
      return;
    }

    button.style.display = 'inline-flex';
    button.style.opacity = '1';
    button.classList.add('is-running');
    value.textContent = formatTimerClock(getTimerElapsedMs(timer));
    button.title = `Таймер: ${timer.taskName}`;
  };

  const handleClick = () => {
    const timer = getRunningTimer();
    if (!timer) return;

    if (timer.taskPath && timer.taskPath.length) {
      localStorage.setItem('bonsai-tinder-last-path', JSON.stringify(timer.taskPath));
    }
    if (timer.moodId) {
      localStorage.setItem('bonsai-active-mood', timer.moodId);
    }
    localStorage.setItem('bonsai-current-mode', 'tinder');
    import('../router.js').then(m => m.showMainView('tinder'));
  };

  const handleVisibility = () => {
    if (!document.hidden) refresh();
  };

  button.addEventListener('click', handleClick);
  window.addEventListener('bonsai-timer-change', refresh);
  document.addEventListener('visibilitychange', handleVisibility);
  const interval = window.setInterval(refresh, 1000);
  refresh();

  window.__globalTimerCleanup = () => {
    window.clearInterval(interval);
    window.removeEventListener('bonsai-timer-change', refresh);
    document.removeEventListener('visibilitychange', handleVisibility);
    button.removeEventListener('click', handleClick);
  };
}
