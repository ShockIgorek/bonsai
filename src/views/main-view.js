import { renderListView } from './list-view.js';
import { renderNavView } from './nav-view.js';

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

  // Заглушка для тиндера (и любых других)
  const titles = {
    tinder: '🔥 Тиндер'
  };

  main.innerHTML = `
    <div style="padding: 40px 20px; text-align: center; color: var(--text-main);">
      <h1 style="font-size: 28px; margin-bottom: 12px;">${titles[mode] || 'Задачи'}</h1>
      <p style="color: var(--text-secondary); font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
        Тут будут задачи в режиме «${mode}».<br/>
        Пока это заглушка, но скоро мы её заполним!
      </p>
      <button id="go-moods" style="
        background: var(--accent);
        color: var(--bg-main);
        border: none;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
      ">
        Перейти в настроения
      </button>
    </div>
  `;

  main.querySelector('#go-moods')?.addEventListener('click', () => {
    import('../router.js').then(m => m.showMoodsScreen());
  });
}
