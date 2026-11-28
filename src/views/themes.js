import { getMoods, updateMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';

export const THEMES = [
  { id: 'bonsai', name: 'Bonsai' },
  { id: 'dark', name: 'Dark' },
  { id: 'light', name: 'Light' },
  { id: 'ember', name: 'Ember' },
  { id: 'ice', name: 'Ice' },
  { id: 'neon', name: 'Neon' },
  { id: 'vice', name: 'Vice' },
  { id: 'nuance', name: 'Nuance' },
  { id: 'noir', name: 'Noir' },
  { id: 'aqua', name: 'Aqua' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'amber', name: 'Amber' },
  { id: 'forest', name: 'Forest' }
];

/**
 * Экран выбора темы.
 * @param {object} options
 * @param {string} [options.forMoodId] — если задан, тема сохраняется в это настроение
 *                                       и после выбора возвращаемся на экран настроений.
 */
export function renderThemesScreen({ forMoodId } = {}) {
  const app = document.getElementById('main-content');
  if (!app) return;

  // Какая тема сейчас активна для контекста?
  let currentTheme;
  if (forMoodId) {
    const mood = getMoods().find(m => m.id === forMoodId);
    currentTheme = mood?.theme || 'bonsai';
  } else {
    currentTheme = localStorage.getItem('bonsai-theme') || 'bonsai';
  }
  document.documentElement.setAttribute('data-theme', currentTheme);

  app.innerHTML = `
    <div class="themes-screen">
      <div class="themes-header-row">
        <button class="back-btn" aria-label="Назад">←</button>
        <h1 class="themes-title">${forMoodId ? 'Тема настроения' : 'Выбери тему'}</h1>
      </div>
      <div class="themes-list">
        ${THEMES.map(t => {
          const filter = getThemeFilter(t.id);
          return `
          <button class="theme-card" data-theme="${t.id}">
            <div class="theme-preview" data-theme="${t.id}">
              <div class="theme-bg" style="background: var(--bg-card);"></div>
              <div class="theme-preview-img" style="background-image: url('/assets/bonsai-preview.jpg'); filter: ${filter};"></div>

              <div class="theme-preview-overlay">
                <div class="theme-preview-header">
                  <span class="theme-preview-title">${t.name}</span>
                  <span class="theme-preview-badge"></span>
                </div>
                <div class="theme-preview-desc">Пример описания задачи</div>
                <div class="theme-preview-btn">Сделать</div>
              </div>
            </div>
          </button>
        `}).join('')}
      </div>
    </div>
  `;

  // Назад: либо в настроения (если был контекст), либо в настроения (по умолчанию)
  app.querySelector('.back-btn')?.addEventListener('click', () => {
    import('../router.js').then(m => m.showMoodsScreen());
  });

  app.querySelectorAll('.theme-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const theme = btn.dataset.theme;

      if (forMoodId) {
        // Сохраняем тему в конкретное настроение
        updateMood(forMoodId, { theme });
        // И применяем её глобально, чтобы пользователь сразу увидел
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('bonsai-theme', theme);
        // Вариант А: возвращаемся на экран настроений
        import('../router.js').then(m => m.showMoodsScreen());
      } else {
        // Глобальная тема (как раньше)
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('bonsai-theme', theme);
        renderThemesScreen();
      }
    });
  });
}

