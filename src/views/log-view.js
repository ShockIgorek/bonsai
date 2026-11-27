import { getLog } from '../data/archive-store.js';
import { getMoods } from '../data/moods-store.js';
import { formatTaskDuration, formatDateTime } from '../utils/format-time.js';

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

export function openLogView() {
  const moods = getMoods();
  const moodNames = new Map(moods.map(mood => [mood.id, mood.name]));
  const entries = getLog().slice().sort((a, b) => b.completedAt - a.completedAt);

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
      <h1 style="font-size: 20px; font-weight: 700; margin: 0; flex: 1;">Лог выполнения</h1>
    </div>

    <div style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box;">
      ${entries.length ? entries.map(entry => {
        const mood = moodNames.get(entry.moodId) || entry.moodId || '—';
        const path = (entry.taskPath && entry.taskPath.length
          ? entry.taskPath
          : (entry.parentPath || [])).join(' / ');
        const difficulty = entry.difficulty != null
          ? `${Number(entry.difficulty).toFixed(1)} / 10`
          : '—';
        const actualTime = entry.actualMinutes != null
          ? formatTaskDuration({ estimated: entry.actualMinutes })
          : '—';

        return `
          <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; gap: 12px; align-items: baseline;">
              <span style="font-weight: 700; font-size: 15px;">${escapeHtml(entry.taskName)}</span>
              <span style="font-size: 12px; color: var(--text-muted); white-space: nowrap;">${formatDateTime(entry.completedAt)}</span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; color: var(--text-secondary);">
              <span>Настроение: ${escapeHtml(mood)}</span>
              <span>Путь: ${escapeHtml(path || '—')}</span>
              <span>Сложность: ${difficulty}</span>
              <span>Время: ${actualTime}</span>
            </div>
          </div>
        `;
      }).join('') : `
        <div style="padding: 40px 16px; text-align: center; color: var(--text-secondary); line-height: 1.5;">
          Пока нет выполнений. Заверши циклическую задачу — запись появится здесь.
        </div>
      `}
    </div>
  `;

  document.getElementById('app').appendChild(screen);

  screen.querySelector('[data-action="close"]').addEventListener('click', () => screen.remove());
}
