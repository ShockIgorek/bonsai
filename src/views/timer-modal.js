import {
  getTimerForTask,
  getRunningTimer,
  getTimerElapsedMs,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer
} from '../data/timer-store.js';
import { formatTimerClock } from '../utils/format-time.js';
import { ICONS } from '../utils/icons.js';

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
 * Модалка таймера задачи.
 * Один таймер может идти, остальные — стоять на паузе.
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

      <div class="modal-footer timer-controls">
        <button id="timer-toggle" class="timer-control-btn timer-control-primary" type="button" aria-label="Запустить таймер">${ICONS.play}</button>
        <button id="timer-stop" class="timer-control-btn timer-control-danger" type="button" aria-label="Сбросить таймер" style="display: none;">${ICONS.stop}</button>
      </div>
    </div>
  `;
  document.getElementById('app').appendChild(overlay);

  const displayEl = overlay.querySelector('#timer-display');
  const statusEl = overlay.querySelector('#timer-status');
  const otherEl = overlay.querySelector('#timer-other');
  const toggleBtn = overlay.querySelector('#timer-toggle');
  const stopBtn = overlay.querySelector('#timer-stop');
  let intervalId = null;

  function refresh() {
    const current = getTimerForTask(task.id);
    const running = getRunningTimer();
    const other = running && running.taskId !== String(task.id) ? running : null;
    const elapsed = current ? getTimerElapsedMs(current) : 0;

    displayEl.textContent = formatTimerClock(elapsed);

    if (current) {
      statusEl.textContent = current.isPaused ? 'Пауза' : 'Идёт';
    } else {
      statusEl.textContent = 'Таймер не запущен';
    }

    if (other) {
      otherEl.style.display = 'block';
      otherEl.innerHTML = `Сейчас идёт таймер: <strong style="color: var(--text-main);">${escapeHtml(other.taskName)}</strong>. При запуске этого он встанет на паузу.`;
    } else {
      otherEl.style.display = 'none';
    }

    const runningCurrent = !!(current && !current.isPaused);
    toggleBtn.innerHTML = runningCurrent ? ICONS.pause : ICONS.play;
    const title = runningCurrent
      ? 'Пауза'
      : (current ? 'Продолжить' : 'Запустить таймер');
    toggleBtn.title = title;
    toggleBtn.setAttribute('aria-label', title);
    stopBtn.style.display = current ? 'inline-flex' : 'none';
  }

  function close() {
    if (intervalId) clearInterval(intervalId);
    window.removeEventListener('bonsai-timer-change', refresh);
    overlay.remove();
  }

  function notifyChanged() {
    if (typeof onChanged === 'function') onChanged();
  }

  toggleBtn.addEventListener('click', () => {
    const current = getTimerForTask(task.id);

    if (current && !current.isPaused) {
      pauseTimer(task.id);
    } else if (current && current.isPaused) {
      resumeTimer(task.id);
    } else {
      startTimer(task, moodId);
    }

    refresh();
    notifyChanged();
  });

  stopBtn.addEventListener('click', () => {
    const current = getTimerForTask(task.id);
    if (!current) return;

    if (getTimerElapsedMs(current) > 0) {
      const ok = window.confirm('Сбросить таймер? Замер не сохранится.');
      if (!ok) return;
    }

    stopTimer(task.id);
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
