import {
  getActiveTimer,
  getActiveTimerForTask,
  getTimerElapsedMs,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer
} from '../data/timer-store.js';
import { formatTimerClock } from '../utils/format-time.js';

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
 * Модалка секундомера для задачи.
 * Один активный таймер на приложение, состояние хранится в localStorage.
 */
export function openTimerModal(task, moodId, onChanged) {
  const overlay = document.createElement('div');
  overlay.className = 'completion-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card">
      <div class="modal-header">
        <h2 class="modal-title">Таймер</h2>
        <button class="modal-close" type="button" data-action="close" aria-label="Закрыть">×</button>
      </div>

      <div class="modal-body">
        <div>
          <div style="font-size: 18px; font-weight: 800; line-height: 1.25;">${escapeHtml(task.name)}</div>
          ${task.path && task.path.length ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(task.path.slice(0, -1).join(' / '))}</div>` : ''}
        </div>

        <div id="timer-display" class="timer-display">0:00</div>
        <div id="timer-status" class="timer-status">Таймер не запущен</div>

        <div id="timer-other" style="display: none; padding: 10px 12px; border-radius: 12px; background: var(--bg-main); border: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); line-height: 1.4;"></div>

        <div style="font-size: 11px; color: var(--text-muted); line-height: 1.4;">
          Таймер продолжает идти, даже если свернуть приложение или уйти на другой экран.
        </div>
      </div>

      <div class="modal-footer" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="timer-start" class="btn-save" type="button" style="flex: 1; min-width: 120px;">Запустить таймер</button>
        <button id="timer-pause" class="btn-save" type="button" style="flex: 1; min-width: 100px; background: var(--bg-panel); color: var(--text-main);">Пауза</button>
        <button id="timer-resume" class="btn-save" type="button" style="flex: 1; min-width: 100px;">Продолжить</button>
        <button id="timer-stop" class="btn-save" type="button" style="flex: 1; min-width: 100px; background: transparent; color: var(--danger); border: 1px solid var(--danger);">Стоп</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const displayEl = overlay.querySelector('#timer-display');
  const statusEl = overlay.querySelector('#timer-status');
  const otherEl = overlay.querySelector('#timer-other');
  const startBtn = overlay.querySelector('#timer-start');
  const pauseBtn = overlay.querySelector('#timer-pause');
  const resumeBtn = overlay.querySelector('#timer-resume');
  const stopBtn = overlay.querySelector('#timer-stop');
  let intervalId = null;

  function refresh() {
    const active = getActiveTimer();
    const current = active && active.taskId === String(task.id) ? active : null;
    const other = active && active.taskId !== String(task.id) ? active : null;

    displayEl.textContent = formatTimerClock(current ? getTimerElapsedMs(current) : 0);

    if (current) {
      statusEl.textContent = current.isPaused ? 'Пауза' : 'Идёт';
    } else {
      statusEl.textContent = 'Таймер не запущен';
    }

    if (other) {
      otherEl.style.display = 'block';
      otherEl.innerHTML = `Сейчас идёт таймер: <strong style="color: var(--text-main);">${escapeHtml(other.taskName)}</strong> · ${formatTimerClock(getTimerElapsedMs(other))}`;
    } else {
      otherEl.style.display = 'none';
    }

    startBtn.style.display = current ? 'none' : 'block';
    startBtn.textContent = other ? 'Остановить текущий и начать' : 'Запустить таймер';
    pauseBtn.style.display = current && !current.isPaused ? 'block' : 'none';
    resumeBtn.style.display = current && current.isPaused ? 'block' : 'none';
    stopBtn.style.display = current ? 'block' : 'none';
  }

  function close() {
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener('bonsai-timer-change', refresh);
    overlay.remove();
  }

  function notifyChanged() {
    if (typeof onChanged === 'function') onChanged();
  }

  startBtn.addEventListener('click', () => {
    const active = getActiveTimer();
    if (active && active.taskId !== String(task.id)) {
      const ok = window.confirm(`Сейчас идёт таймер «${active.taskName}». Остановить его и запустить новый?`);
      if (!ok) return;
      stopTimer();
    }

    startTimer(task, moodId);
    refresh();
    notifyChanged();
  });

  pauseBtn.addEventListener('click', () => {
    pauseTimer();
    refresh();
    notifyChanged();
  });

  resumeBtn.addEventListener('click', () => {
    resumeTimer();
    refresh();
    notifyChanged();
  });

  stopBtn.addEventListener('click', () => {
    const current = getActiveTimerForTask(task.id);
    const elapsed = current ? getTimerElapsedMs(current) : 0;

    if (elapsed >= 60000) {
      const ok = window.confirm('Остановить таймер? Замер не сохранится.');
      if (!ok) return;
    }

    stopTimer();
    refresh();
    notifyChanged();
  });

  overlay.querySelector('[data-action="close"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  window.addEventListener('bonsai-timer-change', refresh);
  intervalId = window.setInterval(refresh, 1000);
  refresh();
}
