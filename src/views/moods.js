import { getMoods } from '../data/moods-store.js';
import { updateHeaderMoodName } from './layout.js';
import { openMoodModal } from './mood-modal.js';
import { getThemeFilter } from '../utils/theme-filter.js';

export function renderMoodsScreen({ startup = false } = {}) {
  const main = document.getElementById('main-content');
  if (!main) return;

  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';

  main.innerHTML = `
    <div class="moods-screen">
      <div class="moods-header">
        <button class="back-btn" aria-label="Назад">←</button>
        <h1 class="moods-title">Настроения</h1>
        <button class="help-btn" aria-label="Справка">?</button>
      </div>

      <div class="moods-grid">
        ${moods.map(m => {
          const isActive = m.id === activeMoodId;
          const theme = m.theme || 'bonsai';
          const filter = getThemeFilter(theme);
          const hasPriorities = m.priorities && Object.keys(m.priorities).length > 0;

          return `
          <div class="mood-card ${isActive ? 'is-active' : ''}" data-mood="${m.id}" data-theme="${theme}" role="button" tabindex="0">
            
            <div class="mood-cover">
              ${m.image
                ? `<img src="${m.image}" alt="${m.name}" style="filter: ${filter};" onerror="this.style.display='none'"/>`
                : `<div class="mood-cover-placeholder" style="filter: ${filter};">🌱</div>`}
            </div>

            <div class="mood-info">
              <span class="mood-name">${m.name}</span>
              ${m.description ? `<span class="mood-desc">${m.description}</span>` : ''}
              <button class="mood-priority-btn" type="button" data-priority="${m.id}">
                ${hasPriorities ? 'Пересмотреть приоритеты' : 'Расставить приоритеты'}
              </button>
            </div>

            <button class="edit-mood-btn" data-edit="${m.id}" aria-label="Редактировать">✏️</button>
            
            ${isActive ? '<div class="mood-active-badge">✓</div>' : ''}
          </div>
        `}).join('')}

        <div class="mood-card add-mood" data-mood="add" role="button" tabindex="0">
          <div class="mood-cover-placeholder" style="background: var(--bg-panel); border: 2px dashed var(--border);">
            <span style="color: var(--text-muted); font-size: 32px;">+</span>
          </div>
          <span class="mood-name" style="padding: 16px;">Добавить</span>
        </div>
      </div>
    </div>
  `;

  main.querySelectorAll('.mood-card:not(.add-mood)').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.edit-mood-btn') || e.target.closest('.mood-priority-btn')) return;
      const moodId = card.dataset.mood;
      const mood = moods.find(m => m.id === moodId);
      if (!mood) return;

      localStorage.setItem('bonsai-active-mood', moodId);
      document.documentElement.setAttribute('data-theme', mood.theme || 'bonsai');
      localStorage.setItem('bonsai-theme', mood.theme || 'bonsai');
      updateHeaderMoodName();

      if (startup) {
        // При запуске выбор настроения сразу ведёт в приложение
        const mode = localStorage.getItem('bonsai-current-mode') || 'tinder';
        import('../router.js').then(m => m.showMainView(mode));
      } else {
        renderMoodsScreen();
      }
    });
  });

  main.querySelectorAll('.edit-mood-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mood = moods.find(m => m.id === btn.dataset.edit);
      if (mood) openMoodModal(mood, () => renderMoodsScreen({ startup }));
    });
  });

  main.querySelectorAll('.mood-priority-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mood = moods.find(m => m.id === btn.dataset.priority);
      if (!mood) return;
      import('./priority-test.js').then(module => module.openPriorityTest(
        mood,
        () => renderMoodsScreen({ startup })
      ));
    });
  });

  main.querySelector('.add-mood')?.addEventListener('click', () => {
    openMoodModal(null, () => renderMoodsScreen({ startup }));
  });

  main.querySelector('.back-btn')?.addEventListener('click', () => {
    const lastScreen = localStorage.getItem('bonsai-last-screen');
    localStorage.removeItem('bonsai-last-screen');

    const mode = lastScreen && lastScreen.startsWith('moods:')
      ? lastScreen.split(':')[1]
      : (localStorage.getItem('bonsai-current-mode') || 'tinder');

    import('../router.js').then(m => m.showMainView(mode));
  });
}
