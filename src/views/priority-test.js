import { getMoodTasks } from '../logic/priority-tasks.js';
import {
  createCalibrationSession,
  pickNextPair,
  applyCalibrationChoice,
  applyCalibrationDraw,
  getCalibrationProgress,
  finalizeCalibrationSession
} from '../logic/calibration-ranking.js';
import { getMoodPriorities, saveMoodPriorities } from '../data/mood-priorities.js';
import { getTasksTree } from '../data/tasks-store.js';
import { saveTasksTreeWithRecovery, isQuotaError } from '../utils/media-compaction.js';
import { findNodeById } from '../data/task-tree-utils.js';
import { timeToScore } from '../logic/task-metrics.js';
import { escapeHtml, renderPriorityTaskContent } from './priority-card.js';

const QUESTION_HTML = {
  importance: 'Какая задача <strong>важнее</strong>?',
  time: 'Какую задачу выполнишь <strong>быстрее</strong>?',
  difficulty: 'Какая задача <strong>сложнее</strong>?'
};

function renderChoice(task, dimension) {
  return `
    <button type="button" class="priority-choice" data-id="${escapeHtml(task.id)}">
      ${renderPriorityTaskContent(task, { dimension })}
    </button>
  `;
}

async function saveCalibration(mood, result) {
  const tree = getTasksTree();
  let treeChanged = false;

  if (result.time) {
    for (const [taskId, info] of Object.entries(result.time)) {
      if (info.source === 'fact') continue;

      const node = findNodeById(tree, taskId);
      if (!node) continue;

      if (info.minutes !== null && info.minutes !== undefined) {
        node.duration = {
          ...(node.duration || {}),
          estimated: info.minutes,
          calibrated: true
        };
        node.timeScore = timeToScore(info.minutes);
        delete node.sortTimeScore;
        treeChanged = true;
      }

      if (info.sortTimeScore !== null && info.sortTimeScore !== undefined) {
        // Абсолютные минуты не менялись — это всё ещё оценка.
        // Калиброванным является только относительный рейтинг для сортировки.
        node.sortTimeScore = info.sortTimeScore;
        treeChanged = true;
      }
    }
  }

  if (result.difficulty) {
    for (const [taskId, info] of Object.entries(result.difficulty)) {
      if (info.source === 'fact') continue;

      const node = findNodeById(tree, taskId);
      if (!node) continue;

      node.difficulty = info.value;
      node.difficultyCalibrated = true;
      treeChanged = true;
    }
  }

  if (treeChanged) {
    await saveTasksTreeWithRecovery(tree);
  }

  if (result.importance) {
    const merged = { ...getMoodPriorities(mood.id), ...result.importance };
    saveMoodPriorities(mood.id, merged);
  }
}

/**
 * Полноэкранная калибровка важности, скорости и сложности.
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
        Для калибровки нужно минимум 2 видимые задачи.<br>
        Добавь задачи или измени фильтры этого настроения.
      </div>
    `;
    screen.querySelector('[data-action="close"]').addEventListener('click', () => screen.remove());
    document.getElementById('app').appendChild(screen);
    return;
  }

  const session = createCalibrationSession(tasks);
  let current = null;
  let saving = false;

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
      <div class="priority-progress-scale">
        <span data-accuracy="1">примерная</span>
        <span data-accuracy="2">средняя</span>
        <span data-accuracy="3">высокая</span>
      </div>
      <div class="priority-progress-text"></div>
    </div>
    <div class="priority-question" id="priority-question"></div>
    <div class="priority-pair"></div>
    <div class="priority-footer">
      Выбери карточку или «=», если разницы нет.
      <br>
      <span style="font-size: 11px; color: var(--text-muted);">
        факт — из таймера или выполнения, оценка — субъективное значение.
        <br>
        Время и сложность применяются ко всем настроениям.
      </span>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const questionEl = screen.querySelector('#priority-question');
  const pairEl = screen.querySelector('.priority-pair');
  const progressFill = screen.querySelector('.priority-progress-fill');
  const progressText = screen.querySelector('.priority-progress-text');
  const finishBtn = screen.querySelector('[data-action="finish"]');

  function updateProgress() {
    const progress = getCalibrationProgress(session);
    progressFill.style.width = `${Math.round(progress.progress * 100)}%`;
    progressText.textContent = `Точность: ${progress.accuracyLabel} · сравнений: ${progress.comparisons}`;
    finishBtn.disabled = !progress.canFinish;

    screen.querySelectorAll('[data-accuracy]').forEach(label => {
      const level = Number(label.dataset.accuracy);
      label.classList.toggle('is-reached', progress.level >= level);
      label.classList.toggle('is-current', progress.level === level);
    });

    return progress;
  }

  function renderPair() {
    current = pickNextPair(session);

    if (!current) {
      questionEl.textContent = 'Все доступные пары пройдены';
      pairEl.innerHTML = '<div class="priority-empty">Можно завершить и сохранить результат.</div>';
      updateProgress();
      return;
    }

    const { dimension, pair } = current;
    const [a, b] = pair;

    questionEl.innerHTML = QUESTION_HTML[dimension];
    pairEl.innerHTML = `
      ${renderChoice(a, dimension)}
      <button class="priority-equal-choice" type="button" data-action="equal" aria-label="Одинаково">=</button>
      ${renderChoice(b, dimension)}
    `;

    pairEl.querySelectorAll('.priority-choice').forEach(card => {
      card.addEventListener('click', () => choose(card.dataset.id));
    });

    pairEl.querySelector('[data-action="equal"]')?.addEventListener('click', chooseEqual);
    updateProgress();
  }

  function choose(winnerId) {
    if (!current) return;
    const [a, b] = current.pair;
    const winner = a.id === winnerId ? a : b;
    const loser = a.id === winnerId ? b : a;

    if (applyCalibrationChoice(session, current.dimension, winner.id, loser.id)) {
      renderPair();
    }
  }

  function chooseEqual() {
    if (!current) return;
    const [a, b] = current.pair;

    if (applyCalibrationDraw(session, current.dimension, a.id, b.id)) {
      renderPair();
    }
  }

  function requestClose() {
    const progress = getCalibrationProgress(session);
    if (progress.comparisons > 0 && !confirm('Выйти без сохранения результатов калибровки?')) {
      return;
    }
    screen.remove();
  }

  async function finish() {
    if (saving) return;

    const progress = getCalibrationProgress(session);
    if (!progress.canFinish) return;

    if (progress.level < 3) {
      const ok = confirm(
        `Текущая точность: ${progress.accuracyLabel}.\n` +
        'Завершить и сохранить результат?'
      );
      if (!ok) return;
    }

    saving = true;
    finishBtn.disabled = true;

    try {
      const result = finalizeCalibrationSession(session);
      await saveCalibration(mood, result);
      screen.remove();
      if (typeof onDone === 'function') onDone();
    } catch (err) {
      saving = false;
      finishBtn.disabled = false;
      console.error('Не удалось сохранить калибровку', err);
      alert(isQuotaError(err)
        ? 'Не хватает места для сохранения. Уменьши или удали фото.'
        : 'Не удалось сохранить калибровку. Попробуй ещё раз.');
    }
  }

  screen.querySelector('[data-action="close"]').addEventListener('click', requestClose);
  finishBtn.addEventListener('click', finish);

  updateProgress();
  renderPair();
}
