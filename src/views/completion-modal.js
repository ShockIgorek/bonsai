import { getTasksTree } from '../data/tasks-store.js';
import { saveTasksTreeWithRecovery, isQuotaError } from '../utils/media-compaction.js';
import { logCompletion } from '../data/archive-store.js';
import { getAverageDifficulty } from '../logic/cyclic-schedule.js';
import { applyActualTimeStats } from '../logic/task-time.js';
import {
  getTimerForTask,
  getTimerElapsedMs,
  pauseTimer,
  resumeTimer,
  stopTimer
} from '../data/timer-store.js';
import { applyMetricStyle } from '../utils/metric-style.js';
import {
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
 * Сложность опциональна, время можно поправить большими кнопками.
 */
export function openCompletionModal(task, moodId, onDone) {
  const average = getAverageDifficulty(task);
  let difficulty = average !== null
    ? average
    : (Number.isFinite(Number(task.difficulty)) ? Number(task.difficulty) : 5);

  const estimateMinutes = getTaskEstimateMinutes(task.duration);
  const prefillMinutes = Math.max(1, Math.round(estimateMinutes));

  let activeTimer = getTimerForTask(task.id);
  const resumeAfterCancel = !!(activeTimer && !activeTimer.isPaused);
  if (resumeAfterCancel) {
    pauseTimer(task.id);
    activeTimer = getTimerForTask(task.id);
  }

  const overlay = document.createElement('div');
  overlay.className = 'completion-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card completion-modal">
      <div class="modal-header">
        <h2 class="modal-title">Выполнить задачу</h2>
        <button class="modal-close" type="button" data-action="close" aria-label="Закрыть">×</button>
      </div>

      <div class="modal-body">
        <div>
          <div class="completion-task-name">${escapeHtml(task.name)}</div>
          ${task.path && task.path.length ? `<div class="completion-task-path">${escapeHtml(task.path.slice(0, -1).join(' / '))}</div>` : ''}
        </div>

        <div class="completion-section">
          <div class="completion-section-title">Время</div>

          ${activeTimer ? `
            <div class="completion-timer-line">
              <span>По таймеру</span>
              <strong id="completion-timer-display">${formatTimerClock(getTimerElapsedMs(activeTimer))}</strong>
            </div>
            <label class="completion-check">
              <input id="completion-use-timer" type="checkbox" checked />
              Использовать это время
            </label>
          ` : ''}

          <div id="completion-manual-time" style="display: ${activeTimer ? 'none' : 'block'};">
            <div class="completion-time-stepper">
              <button type="button" data-action="time-minus" aria-label="Уменьшить время">−</button>
              <input id="completion-actual-minutes" type="number" min="0" step="1" inputmode="decimal" value="${prefillMinutes}" />
              <span class="completion-time-unit">мин</span>
              <button type="button" data-action="time-plus" aria-label="Увеличить время">+</button>
            </div>
            <div class="completion-time-hint">Оценка: ${formatTaskDuration({ estimated: estimateMinutes })}</div>
            <label class="completion-check">
              <input id="completion-save-time" type="checkbox" checked />
              Записать как фактическое
            </label>
          </div>
        </div>

        <div class="completion-section">
          <div class="completion-section-title">Сложность</div>
          <div class="completion-difficulty-row">
            <button class="task-metric-btn" type="button" data-action="minus">−</button>
            <span id="completion-difficulty" class="task-metric-value">${difficulty.toFixed(1)}</span>
            <button class="task-metric-btn" type="button" data-action="plus">+</button>
          </div>
          <label class="completion-check">
            <input id="completion-skip-difficulty" type="checkbox" />
            Не оценивать сложность
          </label>
        </div>
      </div>

      <div class="modal-footer completion-footer">
        <button class="btn-save completion-cancel" type="button" data-action="cancel">Отмена</button>
        <button class="btn-save completion-submit" type="button" data-action="complete">Выполнить</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const difficultyEl = overlay.querySelector('#completion-difficulty');
  const minusBtn = overlay.querySelector('[data-action="minus"]');
  const plusBtn = overlay.querySelector('[data-action="plus"]');
  const skipDifficultyEl = overlay.querySelector('#completion-skip-difficulty');
  const useTimerEl = overlay.querySelector('#completion-use-timer');
  const manualTimeEl = overlay.querySelector('#completion-manual-time');
  const timeInput = overlay.querySelector('#completion-actual-minutes');
  let timerInterval = null;
  let saving = false;

  const close = ({ resume = true } = {}) => {
    if (timerInterval) clearInterval(timerInterval);
    overlay.remove();
    if (resume && resumeAfterCancel) resumeTimer(task.id);
  };

  applyMetricStyle(difficultyEl, difficulty);

  function refreshDifficulty() {
    difficultyEl.textContent = difficulty.toFixed(1);
    applyMetricStyle(difficultyEl, difficulty);
  }

  function refreshDifficultyState() {
    const skipped = skipDifficultyEl.checked;
    minusBtn.disabled = skipped;
    plusBtn.disabled = skipped;
    minusBtn.style.opacity = skipped ? '0.35' : '';
    plusBtn.style.opacity = skipped ? '0.35' : '';

    if (skipped) {
      difficultyEl.style.opacity = '0.35';
    } else {
      applyMetricStyle(difficultyEl, difficulty);
    }
  }

  if (useTimerEl) {
    useTimerEl.addEventListener('change', () => {
      manualTimeEl.style.display = useTimerEl.checked ? 'none' : 'block';
    });

    timerInterval = window.setInterval(() => {
      const display = overlay.querySelector('#completion-timer-display');
      if (!display) return;

      const timer = getTimerForTask(task.id);
      display.textContent = formatTimerClock(timer ? getTimerElapsedMs(timer) : 0);
    }, 1000);
  }

  function getActualMinutesForSave() {
    const timer = getTimerForTask(task.id);
    const useTimer = useTimerEl ? useTimerEl.checked : false;

    if (useTimer) {
      if (!timer) return null;
      const minutes = getTimerElapsedMs(timer) / 60000;
      return Math.max(0.05, Math.round(minutes * 10) / 10);
    }

    const saveTimeEl = overlay.querySelector('#completion-save-time');
    if (!saveTimeEl || !saveTimeEl.checked) return null;

    const value = Number(timeInput && timeInput.value);
    if (!Number.isFinite(value) || value <= 0) return null;

    return Math.max(0.05, Math.round(value * 10) / 10);
  }

  async function saveCompletion() {
    if (saving) return;

    const timerForConfirm = getTimerForTask(task.id);
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
      const rating = skipDifficultyEl.checked ? null : difficulty;
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

      if (getTimerForTask(task.id)) stopTimer(task.id);

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

  overlay.querySelector('[data-action="time-minus"]').addEventListener('click', () => {
    const value = Number(timeInput.value) || 0;
    timeInput.value = String(Math.max(0, value - 1));
  });

  overlay.querySelector('[data-action="time-plus"]').addEventListener('click', () => {
    const value = Number(timeInput.value) || 0;
    timeInput.value = String(value + 1);
  });

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  minusBtn.addEventListener('click', () => {
    if (skipDifficultyEl.checked) return;
    difficulty = Math.max(0, difficulty - 0.5);
    refreshDifficulty();
  });
  plusBtn.addEventListener('click', () => {
    if (skipDifficultyEl.checked) return;
    difficulty = Math.min(10, difficulty + 0.5);
    refreshDifficulty();
  });
  skipDifficultyEl.addEventListener('change', refreshDifficultyState);

  overlay.querySelector('[data-action="complete"]').addEventListener('click', saveCompletion);

  refreshDifficultyState();
}
