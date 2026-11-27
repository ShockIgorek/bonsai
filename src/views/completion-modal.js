import { getTasksTree } from '../data/tasks-store.js';
import { saveTasksTreeWithRecovery, isQuotaError } from '../utils/media-compaction.js';
import { logCompletion } from '../data/archive-store.js';
import { getAverageDifficulty } from '../logic/cyclic-schedule.js';
import { applyMetricStyle } from '../utils/metric-style.js';
import { formatLastCompleted } from '../utils/format-time.js';

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Модалка выполнения циклической задачи.
 * Оценка сложности опциональна; показываем среднее последних 10.
 */
export function openCompletionModal(task, moodId, onDone) {
  const average = getAverageDifficulty(task);
  let difficulty = average !== null
    ? average
    : (Number.isFinite(Number(task.difficulty)) ? Number(task.difficulty) : 5);

  const overlay = document.createElement('div');
  overlay.className = 'completion-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Выполнить задачу</h2>
        <button class="modal-close" type="button" data-action="close" aria-label="Закрыть">×</button>
      </div>

      <div class="modal-body">
        <div>
          <div style="font-size: 18px; font-weight: 800; line-height: 1.25;">${escapeHtml(task.name)}</div>
          ${task.path && task.path.length ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(task.path.slice(0, -1).join(' / '))}</div>` : ''}
        </div>

        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
          Средняя сложность за последние 10: <strong style="color: var(--text-main);">${average !== null ? `${average.toFixed(1)} / 10` : '—'}</strong>
          ${task.completionHistory && task.completionHistory.length ? `<br>Последнее выполнение: ${formatLastCompleted(task.completionHistory[task.completionHistory.length - 1].at)}` : ''}
        </div>

        <div class="task-metric-editor" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-secondary));">
          <div class="task-metric-label">Сложность сейчас</div>
          <div class="task-metric-row">
            <button class="task-metric-btn" type="button" data-action="minus">−</button>
            <span id="completion-difficulty" class="task-metric-value">${difficulty.toFixed(1)}</span>
            <button class="task-metric-btn" type="button" data-action="plus">+</button>
          </div>
        </div>

        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
          Оценка заменит субъективную сложность. Можно пропустить — тогда останется среднее.
        </div>
      </div>

      <div class="modal-footer" style="display: flex; gap: 8px;">
        <button class="btn-save" type="button" data-action="cancel" style="flex: 1; background: var(--bg-panel); color: var(--text-main);">Отмена</button>
        <button class="btn-save" type="button" data-action="skip" style="flex: 1; background: var(--bg-panel); color: var(--text-secondary);">Пропустить</button>
        <button class="btn-save" type="button" data-action="complete" style="flex: 1;">Выполнить</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const difficultyEl = overlay.querySelector('#completion-difficulty');
  const close = () => overlay.remove();
  let saving = false;

  applyMetricStyle(difficultyEl, difficulty);

  function refreshDifficulty() {
    difficultyEl.textContent = difficulty.toFixed(1);
    applyMetricStyle(difficultyEl, difficulty);
  }

  async function saveCompletion(rating) {
    if (saving) return;
    saving = true;
    document.activeElement?.blur?.();

    try {
      const now = Date.now();
      const tree = getTasksTree();

      function findById(node) {
        if (node.id === task.id) return node;
        if (node.children) {
          for (const child of node.children) {
            const found = findById(child);
            if (found) return found;
          }
        }
        return null;
      }

      const node = findById(tree);
      if (node) {
        if (!Array.isArray(node.completionHistory)) node.completionHistory = [];
        node.completionHistory.push({
          at: now,
          difficulty: rating,
          moodId
        });
        await saveTasksTreeWithRecovery(tree);
      }

      logCompletion(
        { ...task, type: 'cyclic', path: task.path || [] },
        moodId,
        { difficulty: rating, actualMinutes: null }
      );

      close();
      if (typeof onDone === 'function') onDone();
    } catch (err) {
      saving = false;
      console.error('Не удалось сохранить выполнение', err);
      alert(isQuotaError(err)
        ? 'Не хватает места для сохранения. Уменьши или удали фото.'
        : 'Не удалось сохранить выполнение. Попробуй ещё раз.');
    }
  }

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('[data-action="minus"]').addEventListener('click', () => {
    difficulty = Math.max(0, difficulty - 0.5);
    refreshDifficulty();
  });
  overlay.querySelector('[data-action="plus"]').addEventListener('click', () => {
    difficulty = Math.min(10, difficulty + 0.5);
    refreshDifficulty();
  });

  overlay.querySelector('[data-action="skip"]').addEventListener('click', () => saveCompletion(null));
  overlay.querySelector('[data-action="complete"]').addEventListener('click', () => saveCompletion(difficulty));
}
