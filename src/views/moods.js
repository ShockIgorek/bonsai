import { getMoods } from '../data/moods-store.js';
import { openMoodModal } from './mood-modal.js';

export function renderMoodsScreen() {
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
        ${moods.map(m => `
          <div class="mood-card ${m.id === activeMoodId ? 'is-active' : ''}" data-mood="${m.id}" role="button" tabindex="0">
            <div class="mood-preview" style="background: var(--bg-card); border: 2px solid var(--border);">
              ${m.image
                ? `<img src="${m.image}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'"/>`
                : `<span style="font-size: 32px;">${m.icon || '🙂'}</span>`}
            </div>
            <span class="mood-name">${m.name}</span>
            <button class="edit-mood-btn" data-edit="${m.id}" aria-label="Редактировать">✏️</button>
          </div>
        `).join('')}

        <div class="mood-card add-mood" data-mood="add" role="button" tabindex="0">
          <div class="mood-preview" style="background: var(--bg-panel); border: 2px dashed var(--border);">
            <span style="color: var(--text-muted); font-size: 32px;">+</span>
          </div>
          <span class="mood-name">Добавить</span>
        </div>
      </div>
    </div>
  `;

  main.querySelector('.back-btn')?.addEventListener('click', () => {
    import('./themes.js').then(m => m.renderThemesScreen());
  });

  // Клик по карточке — только выбор темы
  main.querySelectorAll('.mood-card:not(.add-mood)').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.edit-mood-btn')) return;
      const moodId = card.dataset.mood;
      const mood = moods.find(m => m.id === moodId);
      if (!mood) return;

      localStorage.setItem('bonsai-active-mood', moodId);
      document.documentElement.setAttribute('data-theme', mood.theme);
      renderMoodsScreen();
    });
  });

  // Карандаш — открыть модалку
  main.querySelectorAll('.edit-mood-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mood = moods.find(m => m.id === btn.dataset.edit);
      if (mood) openMoodModal(mood, renderMoodsScreen);
    });
  });

  // "Добавить" — открыть модалку в режиме создания
  main.querySelector('.add-mood')?.addEventListener('click', () => {
    openMoodModal(null, renderMoodsScreen);
  });
}
