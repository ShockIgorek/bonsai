import { getMoodTasks } from '../logic/priority-tasks.js';
import {
  createPrioritySession,
  pickNextPair,
  applyPriorityChoice,
  applyPriorityDraw,
  getPriorityProgress,
  finalizePrioritySession
} from '../logic/priority-ranking.js';
import { getMoodPriorities, saveMoodPriorities } from '../data/mood-priorities.js';
import { escapeHtml, renderPriorityTaskContent } from './priority-card.js';

function renderChoice(task) {
  return `
    <button type="button" class="priority-choice" data-id="${escapeHtml(task.id)}">
      ${renderPriorityTaskContent(task)}
    </button>
  `;
}

/**
 * Полноэкранный попарный тест приоритетов для настроения.
 * @param {object} mood — объект настроения
 * @param {function} onDone — колбэк после сохранения
 */
export function openPriorityTest(mood, onDone) {
  const { tasks } = getMoodTasks(mood.id);

  const screen = document.createElement('div');
  screen.className = 'priority-screen';

  if (tasks.length < 2) {
    screen.innerHTML = `
      <div class="priority-header">
        <button class="back-btn" data-action="close" aria-label="Закрыть">←</button>
        <h1 class="priority-title">Калибровка · ${escapeHtml(mood.name)}</h1>
      </div>
      <div class="priority-empty">
        Для теста нужно минимум 2 видимые задачи.<br>
        Добавь задачи или измени фильтры этого настроения.
      </div>
    `;
    screen.querySelector('[data-action="close"]').addEventListener('click', () => screen.remove());
    document.getElementById('app').appendChild(screen);
    return;
  }

  const session = createPrioritySession(tasks);
  let currentPair = null;

  screen.innerHTML = `
    <div class="priority-header">
      <button class="back-btn" data-action="close" aria-label="Назад">←</button>
      <h1 class="priority-title">Калибровка · ${escapeHtml(mood.name)}</h1>
      <button class="priority-finish" type="button" data-action="finish" disabled>Завершить</button>
    </div>
    <div class="priority-progress">
      <div class="priority-progress-track">
        <div class="priority-progress-fill"></div>
      </div>
      <div class="priority-progress-text"></div>
    </div>
    <div class="priority-pair"></div>
    <div class="priority-footer">
      Выбери более важную задачу. «=» — если они одинаково важны. Желательно сравнить каждую хотя бы 2 раза.
      <br>
      <span style="font-size: 11px; color: var(--text-muted);">
        Сейчас калибруется важность. Вес скорости и сложности пока по умолчанию.
      </span>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const pairEl = screen.querySelector('.priority-pair');
  const progressFill = screen.querySelector('.priority-progress-fill');
  const progressText = screen.querySelector('.priority-progress-text');
  const finishBtn = screen.querySelector('[data-action="finish"]');

  function updateProgress() {
    const progress = getPriorityProgress(session);
    progressFill.style.width = `${Math.round(progress.coverage * 100)}%`;
    progressText.textContent = `Оценено ${progress.covered} из ${progress.total} задач · сравнений: ${progress.comparisons}`;
    finishBtn.disabled = !progress.canFinish;
  }

  function renderPair() {
    currentPair = pickNextPair(session);
    if (!currentPair) {
      pairEl.innerHTML = '<div class="priority-empty">Больше нет доступных пар задач.</div>';
      return;
    }

    const [a, b] = currentPair;
    pairEl.innerHTML = `
      ${renderChoice(a)}
      <button class="priority-equal-choice" type="button" data-action="equal" aria-label="Одинаково важны">=</button>
      ${renderChoice(b)}
    `;

    pairEl.querySelectorAll('.priority-choice').forEach(card => {
      card.addEventListener('click', () => {
        choose(card.dataset.id);
      });
    });

    pairEl.querySelector('[data-action="equal"]')?.addEventListener('click', chooseEqual);
  }

  function choose(winnerId) {
    if (!currentPair) return;
    const winner = currentPair.find(task => task.id === winnerId);
    const loser = currentPair.find(task => task.id !== winnerId);
    if (!winner || !loser) return;

    applyPriorityChoice(session, winner.id, loser.id);
    updateProgress();
    renderPair();
  }

  function chooseEqual() {
    if (!currentPair) return;
    const [a, b] = currentPair;
    applyPriorityDraw(session, a.id, b.id);
    updateProgress();
    renderPair();
  }

  function requestClose() {
    const progress = getPriorityProgress(session);
    if (progress.comparisons > 0 && !confirm('Выйти без сохранения результатов теста?')) {
      return;
    }
    screen.remove();
  }

  function finish() {
    const progress = getPriorityProgress(session);
    if (!progress.canFinish) return;

    if (progress.coverage < 1) {
      const ok = confirm(
        `Полностью оценено ${progress.covered} из ${progress.total} задач (по 2 сравнения).\n` +
        'Завершить и сохранить текущие результаты?'
      );
      if (!ok) return;
    }

    const priorities = finalizePrioritySession(session);
    // Сохраняем и старые значения скрытых/неучаствовавших задач
    const merged = { ...getMoodPriorities(mood.id), ...priorities };
    saveMoodPriorities(mood.id, merged);
    screen.remove();
    if (typeof onDone === 'function') onDone();
  }

  screen.querySelector('[data-action="close"]').addEventListener('click', requestClose);
  finishBtn.addEventListener('click', finish);

  updateProgress();
  renderPair();
}
