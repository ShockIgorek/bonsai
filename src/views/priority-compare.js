import { getMoodTasks } from '../logic/priority-tasks.js';
import { createPriorityResolver, getMoodPriorities, saveMoodPriorities } from '../data/mood-priorities.js';
import { applyManualPriorityComparison } from '../logic/priority-ranking.js';
import { escapeHtml, renderPriorityTaskContent } from './priority-card.js';

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function showMessage(message) {
  const screen = document.createElement('div');
  screen.className = 'priority-compare-screen';
  screen.innerHTML = `
    <div class="priority-compare-header">
      <button class="back-btn" type="button" data-action="close" aria-label="Закрыть">←</button>
      <h1 class="priority-title">Уточнение приоритета</h1>
    </div>
    <div class="priority-compare-body priority-compare-message">${escapeHtml(message)}</div>
    <div class="priority-compare-footer">
      <button class="priority-btn priority-btn-primary" type="button" data-action="close">Закрыть</button>
    </div>
  `;
  screen.querySelectorAll('[data-action="close"]').forEach(btn => {
    btn.addEventListener('click', () => screen.remove());
  });
  document.getElementById('app').appendChild(screen);
}

/**
 * Подтверждение ручной правки приоритета.
 * direction = 'up'   — нажали «+»: ищем задачу выше и спрашиваем, менее ли она важна.
 * direction = 'down' — нажали «−»: ищем задачу ниже и спрашиваем, более ли она важна.
 */
export function openPriorityCompare({ task, moodId, direction, onDone }) {
  const { nav, tasks } = getMoodTasks(moodId);
  const resolver = createPriorityResolver(nav, moodId);
  const currentValue = resolver.resolve(task.id);

  const others = tasks
    .filter(item => item.id !== task.id)
    .map(item => ({ ...item, value: resolver.resolve(item.id) }));

  const strict = direction === 'up'
    ? others.filter(item => item.value > currentValue).sort((a, b) => a.value - b.value)
    : others.filter(item => item.value < currentValue).sort((a, b) => b.value - a.value);

  const equal = shuffle(others.filter(item => item.value === currentValue));
  const candidates = [...strict, ...equal];

  if (!candidates.length) {
    showMessage(direction === 'up'
      ? `«${task.name}» уже самая важная — выше никого нет.`
      : `«${task.name}» уже самая низкая по приоритету — ниже никого нет.`);
    return;
  }

  const screen = document.createElement('div');
  screen.className = 'priority-compare-screen';
  screen.innerHTML = `
    <div class="priority-compare-header">
      <button class="back-btn" type="button" data-action="cancel" aria-label="Назад">←</button>
      <h1 class="priority-title">Уточнение приоритета</h1>
    </div>

    <div class="priority-compare-body">
      <div>
        <div class="priority-compare-label">
          Текущая задача · <span class="priority-compare-value">${currentValue.toFixed(1)} / 10</span>
        </div>
        <div class="priority-compare-task-card">${renderPriorityTaskContent(task)}</div>
      </div>

      <div class="priority-compare-question" id="priority-question"></div>

      <div id="priority-candidate-block">
        <div class="priority-compare-label" id="priority-candidate-label"></div>
        <div class="priority-compare-task-card" id="priority-candidate"></div>
      </div>
    </div>

    <div class="priority-compare-footer">
      <button class="priority-btn priority-btn-ghost" type="button" data-action="cancel">Отмена</button>
      <button class="priority-btn priority-btn-secondary" type="button" data-action="no">Нет</button>
      <button class="priority-btn priority-btn-primary" type="button" data-action="yes">Да</button>
    </div>
  `;
  document.getElementById('app').appendChild(screen);

  const questionEl = screen.querySelector('#priority-question');
  const candidateBlockEl = screen.querySelector('#priority-candidate-block');
  const candidateLabelEl = screen.querySelector('#priority-candidate-label');
  const candidateEl = screen.querySelector('#priority-candidate');
  const cancelHeaderBtn = screen.querySelector('.priority-compare-header [data-action="cancel"]');
  const cancelFooterBtn = screen.querySelector('.priority-compare-footer [data-action="cancel"]');
  const noBtn = screen.querySelector('[data-action="no"]');
  const yesBtn = screen.querySelector('[data-action="yes"]');

  let index = 0;

  const close = () => screen.remove();

  function renderCandidate() {
    const candidate = candidates[index];
    if (!candidate) {
      questionEl.textContent = 'Больше нет подходящих задач для сравнения.';
      candidateBlockEl.style.display = 'none';
      yesBtn.style.display = 'none';
      noBtn.style.display = 'none';
      cancelFooterBtn.textContent = 'Закрыть';
      return;
    }

    candidateBlockEl.style.display = '';
    candidateLabelEl.innerHTML = `Сравниваем с · <span class="priority-compare-value">${candidate.value.toFixed(1)} / 10</span>`;
    questionEl.textContent = direction === 'up'
      ? `«${candidate.name}» менее важна, чем «${task.name}»?`
      : `«${candidate.name}» более важна, чем «${task.name}»?`;
    candidateEl.innerHTML = renderPriorityTaskContent(candidate);
  }

  cancelHeaderBtn.addEventListener('click', close);
  cancelFooterBtn.addEventListener('click', close);

  noBtn.addEventListener('click', () => {
    index += 1;
    renderCandidate();
  });

  yesBtn.addEventListener('click', () => {
    const candidate = candidates[index];
    if (!candidate) return;

    const priorities = { ...getMoodPriorities(moodId) };
    priorities[task.id] = currentValue;
    priorities[candidate.id] = candidate.value;

    const winnerId = direction === 'up' ? task.id : candidate.id;
    const loserId = direction === 'up' ? candidate.id : task.id;
    const updated = applyManualPriorityComparison(priorities, winnerId, loserId);

    saveMoodPriorities(moodId, updated);
    close();
    if (typeof onDone === 'function') onDone();
  });

  renderCandidate();
}
