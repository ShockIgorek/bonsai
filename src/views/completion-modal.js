import { getTasksTree } from '../data/tasks-store.js';
import { saveTasksTreeWithRecovery, isQuotaError } from '../utils/media-compaction.js';
import { logCompletion } from '../data/archive-store.js';
import { getAverageDifficulty } from '../logic/cyclic-schedule.js';
import { applyActualTimeStats } from '../logic/task-time.js';
import {
  getActiveTimerForTask,
  getTimerElapsedMs,
  pauseTimer,
  resumeTimer,
  stopTimer
} from '../data/timer-store.js';
import { applyMetricStyle } from '../utils/metric-style.js';
import {
  formatLastCompleted,
  formatTimerClock,
  formatTaskDuration,
  getTaskEstimateMinutes
} from '../utils/format-time.js';

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
 * Время: таймер или ручное значение с предзаполнением оценкой.
 */
export function openCompletionModal(task, moodId, onDone) {
  const average = getAverageDifficulty(task);
  let difficulty = average !== null
    ? average
    : (Number.isFinite(Number(task.difficulty)) ? Number(task.difficulty) : 5);

  const estimateMinutes = getTaskEstimateMinutes(task.duration);
  const prefillMinutes = Math.max(0.5, Math.round(estimateMinutes * 10) / 10);

  // Фиксируем замер в момент открытия модалки: время, потраченное
  // на оценку сложности, не должно попадать в фактическое время.
  let activeTimer = getActiveTimerForTask(task.id);
  const resumeAfterCancel = !!(activeTimer && !activeTimer.isPaused);
  if (resumeAfterCancel) {
    pauseTimer();
    activeTimer = getActiveTimerForTask(task.id);
  }

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

        <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 14px; background: var(--bg-main); border: 1px solid var(--border);">
          <div class="task-metric-label" style="color: var(--text-secondary);">Время</div>

          ${activeTimer ? `
            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px;">
              <span style="font-size: 13px; color: var(--text-secondary);">По таймеру</span>
              <strong id="completion-timer-display" style="font-size: 22px; font-variant-numeric: tabular-nums; color: var(--text-main);">${formatTimerClock(getTimerElapsedMs(activeTimer))}</strong>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-main);">
              <input id="completion-use-timer" type="checkbox" checked style="width: 16px; height: 16px; accent-color: var(--accent);" />
              Использовать это время
            </label>
          ` : ''}

          <div id="completion-manual-time" style="display: ${activeTimer ? 'none' : 'flex'}; flex-direction: column; gap: 6px;">
            <label for="completion-actual-minutes" style="font-size: 12px; color: var(--text-secondary);">Фактическое время, мин</label>
            <input id="completion-actual-minutes" class="input-field" type="number" min="0" step="0.5" inputmode="decimal" value="${prefillMinutes}" />
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary);">
              <input id="completion-save-time" type="checkbox" checked style="width: 16px; height: 16px; accent-color: var(--accent);" />
              Записать как фактическое
            </label>
          </div>

          <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
            ${activeTimer
              ? 'Таймер остановится после сохранения.'
              : `Оценка: ${formatTaskDuration({ estimated: estimateMinutes })}. Если время не замеряли, сними галочку — останется оценка.`}
          </div>
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
  const useTimerEl = overlay.querySelector('#completion-use-timer');
  const manualTimeEl = overlay.querySelector('#completion-manual-time');
  let timerInterval = null;
  let saving = false;

  const close = ({ resume = true } = {}) => {
    if (timerInterval) clearInterval(timerInterval);
    overlay.remove();
    if (resume && resumeAfterCancel) resumeTimer();
  };

  applyMetricStyle(difficultyEl, difficulty);

  function refreshDifficulty() {
    difficultyEl.textContent = difficulty.toFixed(1);
    applyMetricStyle(difficultyEl, difficulty);
  }

  if (useTimerEl) {
    useTimerEl.addEventListener('change', () => {
      manualTimeEl.style.display = useTimerEl.checked ? 'none' : 'flex';
    });

    timerInterval = window.setInterval(() => {
      const display = overlay.querySelector('#completion-timer-display');
      if (!display) return;

      const timer = getActiveTimerForTask(task.id);
      display.textContent = formatTimerClock(timer ? getTimerElapsedMs(timer) : 0);
    }, 1000);
  }

  function getActualMinutesForSave() {
    const timer = getActiveTimerForTask(task.id);
    const useTimer = useTimerEl ? useTimerEl.checked : false;

    if (useTimer) {
      if (!timer) return null;
      const minutes = getTimerElapsedMs(timer) / 60000;
      return Math.max(0.05, Math.round(minutes * 10) / 10);
    }

    const saveTimeEl = overlay.querySelector('#completion-save-time');
    if (!saveTimeEl || !saveTimeEl.checked) return null;

    const input = overlay.querySelector('#completion-actual-minutes');
    const value = Number(input && input.value);
    if (!Number.isFinite(value) || value <= 0) return null;

    return Math.max(0.05, Math.round(value * 10) / 10);
  }

  async function saveCompletion(rating) {
    if (saving) return;

    const timerForConfirm = getActiveTimerForTask(task.id);
    if (useTimerEl && useTimerEl.checked && timerForConfirm) {
      const confirmed = window.confirm(
        `Записать время по таймеру: ${formatTimerClock(getTimerElapsedMs(timerForConfirm))}?`
      );
      if (!confirmed) return;
    }

    saving = true;
    document.activeElement?.blur?.();

    try {
      const now = Date.now();
      const actualMinutes = getActualMinutesForSave();
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
          moodId,
          actualMinutes
        });
        applyActualTimeStats(node);
        await saveTasksTreeWithRecovery(tree);
      }

      if (getActiveTimerForTask(task.id)) stopTimer();

      logCompletion(
        { ...task, type: 'cyclic', path: task.path || [] },
        moodId,
        { difficulty: rating, actualMinutes }
      );

      close({ resume: false });
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
