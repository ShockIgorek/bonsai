import {
  getArchive,
  removeArchiveEntry,
  clearArchive,
  restoreArchivedTask
} from '../data/archive-store.js';
import { getMoods } from '../data/moods-store.js';
import { formatDateTime } from '../utils/format-time.js';

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function openArchiveView(options = {}) {
  const screen = document.createElement('div');
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    background: var(--bg-main);
    color: var(--text-main);
    box-sizing: border-box;
  `;

  screen.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" type="button" data-action="close" aria-label="Назад">←</button>
      <h1 style="font-size: 20px; font-weight: 700; margin: 0; flex: 1;">Архив</h1>
    </div>

    <div id="archive-body" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;"></div>
  `;

  document.getElementById('app').appendChild(screen);

  const body = screen.querySelector('#archive-body');
  const close = () => screen.remove();

  function renderBody() {
    const entries = getArchive()
      .slice()
      .sort((a, b) => (Number(b.archivedAt) || 0) - (Number(a.archivedAt) || 0));

    if (!entries.length) {
      body.innerHTML = `
        <div style="padding: 40px 16px; text-align: center; color: var(--text-secondary); line-height: 1.5;">
          Архив пуст. Выполненные одноразовые задачи появятся здесь.
        </div>
      `;
      return;
    }

    const moods = getMoods();
    const moodNames = new Map(moods.map(mood => [mood.id, mood.name]));

    body.innerHTML = entries.map(entry => {
      const mood = moodNames.get(entry.moodId) || entry.moodId || '—';
      const path = Array.isArray(entry.parentPath) && entry.parentPath.length
        ? entry.parentPath.join(' / ')
        : 'Корень';
      const archiveId = escapeHtml(entry.archiveId);

      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; gap: 12px; align-items: baseline;">
            <span style="font-weight: 700; font-size: 15px; overflow-wrap: anywhere;">${escapeHtml(entry.name)}</span>
            <span style="font-size: 12px; color: var(--text-muted); white-space: nowrap;">${formatDateTime(entry.archivedAt)}</span>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; color: var(--text-secondary);">
            <span>Настроение: ${escapeHtml(mood)}</span>
            <span>Путь: ${escapeHtml(path)}</span>
          </div>

          ${entry.desc ? `<div style="font-size: 12px; color: var(--text-muted); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(entry.desc)}</div>` : ''}

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button type="button" data-restore="${archiveId}" class="btn-save" style="flex: 1; background: var(--accent); color: var(--bg-main);">Восстановить</button>
            <button type="button" data-delete="${archiveId}" class="btn-save" style="flex: 1; background: transparent; color: var(--danger); border: 1px solid var(--danger);">Удалить</button>
          </div>
        </div>
      `;
    }).join('') + `
      <button id="archive-clear" type="button" class="btn-save" style="margin-top: 8px; padding: 12px; background: transparent; color: var(--danger); border: 1px solid var(--danger);">
        Очистить архив
      </button>
    `;

    body.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const archiveId = btn.dataset.restore;
        btn.disabled = true;
        btn.textContent = 'Восстанавливаю…';

        try {
          const result = await restoreArchivedTask(archiveId);
          alert(result.usedRoot
            ? 'Задача восстановлена в корень: исходная папка не найдена.'
            : 'Задача восстановлена.');

          if (typeof options.onRestored === 'function') {
            options.onRestored(result);
          } else {
            renderBody();
          }
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Восстановить';
          alert('Не удалось восстановить задачу: ' + err.message);
        }
      });
    });

    body.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const archiveId = btn.dataset.delete;
        const entry = entries.find(item => item.archiveId === archiveId);
        const name = entry ? entry.name : 'задачу';

        if (!confirm(`Удалить «${name}» из архива навсегда?`)) return;
        removeArchiveEntry(archiveId);
        renderBody();
      });
    });

    body.querySelector('#archive-clear')?.addEventListener('click', () => {
      if (!confirm('Очистить весь архив? Это необратимо.')) return;
      clearArchive();
      renderBody();
    });
  }

  screen.querySelector('[data-action="close"]').addEventListener('click', close);
  renderBody();
}
