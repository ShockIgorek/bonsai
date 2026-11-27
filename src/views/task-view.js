import { buildNavIndex } from '../store.js';
import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods, hideTaskForMood, isTaskHiddenForMood } from '../data/moods-store.js';
import { createPriorityResolver } from '../data/mood-priorities.js';
import { formatTaskDuration, formatInterval, formatLastCompleted, formatCountdown } from '../utils/format-time.js';
import { applyMetricStyle } from '../utils/metric-style.js';
import { getCooldownState, getLastCompletionAt } from '../logic/cyclic-schedule.js';
import { completeSingleTask } from '../data/archive-store.js';
import { getActiveTimerForTask, stopTimer } from '../data/timer-store.js';
import { isQuotaError } from '../utils/media-compaction.js';
import { openAddTaskModal, openDeleteTaskModal } from './task-modal.js';

/**
 * Открывает полноэкранный экран деталей задачи.
 * @param {object} task — объект задачи (из nav.byId)
 * @param {function} onChanged — колбэк после изменений (для перерисовки)
 */
export function openTaskView(task, onChanged) {
  const screen = document.createElement('div');
  screen.className = 'task-view-screen';
  screen.style.cssText = `
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    color: var(--text-main);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  `;

  // Получаем данные
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const isNormal = activeMoodId === 'default';
  const isHidden = isTaskHiddenForMood(activeMoodId, task.id);
  const isFolder = !task.isLeaf;
  const isCyclic = !isFolder && task.type === 'cyclic';
  const canComplete = !isFolder;
  const cooldown = getCooldownState(task);
  const isCooling = isCyclic && cooldown.isCooling;
  const lastCompletedAt = getLastCompletionAt(task);
  const nav = buildNavIndex(getTasksTree());
  const priority = createPriorityResolver(nav, activeMoodId).resolve(task.id);

  screen.innerHTML = `
    <div class="task-view-header" style="display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;">
      <button class="back-btn" data-action="close" aria-label="Назад">←</button>
      <h1 class="task-view-title" style="font-size: 20px; font-weight: 700; margin: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${task.name}</h1>
    </div>

    <div class="task-view-body" style="flex: 1; overflow-y: auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Картинка (заглушка) -->
      <div style="width: 100%; height: 160px; background: var(--bg-panel); border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 64px; border: 1px solid var(--border);">
        ${isFolder ? '📁' : '📝'}
      </div>

      <!-- Название и описание -->
      <div>
        <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">${task.name}</h2>
        <p style="font-size: 15px; color: var(--text-secondary); margin: 0; line-height: 1.4;">${task.desc || 'Описание отсутствует'}</p>
      </div>

      <!-- Путь (где находится) -->
      <div style="font-size: 13px; color: var(--text-muted);">
        ${task.path.join(' / ')}
      </div>

      <!-- Инфо-блок -->
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 16px; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Время</span>
          <span data-metric="time" style="font-weight: 600; color: color-mix(in srgb, var(--accent) 40%, var(--text-main));">${formatTaskDuration(task.duration)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Важность</span>
          <span data-metric="priority" style="font-weight: 600; color: var(--accent);">
            ${priority.toFixed(1)} / 10.0
            ${isFolder ? '<span style="font-size: 11px; color: var(--text-muted);">(среднее по подзадачам)</span>' : ''}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Сложность</span>
          <span data-metric="difficulty" style="font-weight: 600; color: color-mix(in srgb, var(--accent) 40%, var(--text-secondary));">${(task.difficulty !== undefined ? task.difficulty : 5.0).toFixed(1)} / 10.0</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Тип</span>
          <span style="font-weight: 600;">${isCyclic ? 'Циклическая' : 'Одноразовая'}</span>
        </div>
        ${isCyclic && task.interval ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-secondary);">Интервал</span>
            <span style="font-weight: 600; color: var(--accent);">${formatInterval(task.interval.totalMinutes)}</span>
          </div>
        ` : ''}
        ${isCyclic ? `
          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <span style="color: var(--text-secondary);">Последнее выполнение</span>
            <span style="font-weight: 600; text-align: right;">${formatLastCompleted(lastCompletedAt)}</span>
          </div>
          ${isCooling ? `
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: var(--text-secondary);">Восстановление через</span>
              <span style="font-weight: 600; color: var(--accent); text-align: right;">${formatCountdown(cooldown.remainingMs)}</span>
            </div>
          ` : ''}
        ` : ''}
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">Скрыта для настроения</span>
          <span style="font-weight: 600; color: ${isHidden ? '#e5484d' : '#30a46c'};">${isHidden ? 'Да' : 'Нет'}</span>
        </div>
      </div>

      <!-- Кнопки действий -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
        ${!isNormal ? `
        <button id="tv-hide" class="btn-save" style="background: var(--bg-panel); color: var(--text-main);">
          ${isHidden ? '👁️ Показать для этого настроения' : '🙈 Скрыть для этого настроения'}
        </button>
        ` : ''}
        
        <button id="tv-complete" class="btn-save" style="background: var(--accent); color: var(--bg-main); ${canComplete ? '' : 'opacity: 0.45; cursor: not-allowed;'}" ${canComplete ? '' : 'disabled'}>
          ${canComplete ? 'Выполнить' : 'Сначала закрой подзадачи'}
        </button>
        
        <button id="tv-edit" class="btn-save" style="background: var(--bg-panel); color: var(--text-main);">
          ✏️ Редактировать
        </button>
        
        <button id="tv-subtask" class="btn-save" style="background: var(--bg-panel); color: var(--text-main);">
          ➕ Добавить подзадачу
        </button>
        
        <button id="tv-delete" class="btn-save" style="background: #e5484d; color: white;">
          🗑️ Удалить
        </button>
      </div>
    </div>
  `;

  document.getElementById('app').appendChild(screen);

  applyMetricStyle(screen.querySelector('[data-metric="time"]'), task.timeScore);
  applyMetricStyle(screen.querySelector('[data-metric="priority"]'), priority);
  applyMetricStyle(screen.querySelector('[data-metric="difficulty"]'), task.difficulty);

  const close = () => {
    screen.remove();
    if (typeof onChanged === 'function') onChanged();
  };

  // Закрыть
  screen.querySelector('[data-action="close"]').addEventListener('click', close);

  // Скрыть/показать
  screen.querySelector('#tv-hide')?.addEventListener('click', () => {
    if (isHidden) {
      // Показать
      import('../data/moods-store.js').then(({ showTaskForMood }) => {
        showTaskForMood(activeMoodId, task.id);
        close();
      });
    } else {
      // Скрыть
      hideTaskForMood(activeMoodId, task.id);
      close();
    }
  });

  // Выполнить задачу
  screen.querySelector('#tv-complete')?.addEventListener('click', async () => {
    if (!canComplete) return;

    if (isCyclic) {
      import('./completion-modal.js').then(({ openCompletionModal }) => {
        openCompletionModal(task, activeMoodId, () => close());
      });
      return;
    }

    const confirmed = window.confirm(
      `Выполнить задачу «${task.name}»?\nОна уйдёт в архив.`
    );
    if (!confirmed) return;

    try {
      if (getActiveTimerForTask(task.id)) stopTimer();
      await completeSingleTask(task, activeMoodId);
      close();
    } catch (err) {
      console.error('Не удалось выполнить задачу', err);
      alert(isQuotaError(err)
        ? 'Не хватает места для сохранения. Уменьши или удали фото.'
        : 'Не удалось выполнить задачу. Попробуй ещё раз.');
    }
  });

  // Редактировать
  screen.querySelector('#tv-edit')?.addEventListener('click', () => {
    import('./task-modal.js').then(({ openEditTaskModal }) => {
      openEditTaskModal(task, () => {
        close();
        if (typeof onChanged === 'function') onChanged();
      });
    });
  });

  // Добавить подзадачу (открываем полноценную модалку добавления)
  screen.querySelector('#tv-subtask')?.addEventListener('click', () => {
    // Задача станет папкой, поэтому добавляем в неё (по имени)
    openAddTaskModal(task.name, () => {
      close();
      if (typeof onChanged === 'function') onChanged();
    });
  });

  // Удалить
  screen.querySelector('#tv-delete')?.addEventListener('click', () => {
    openDeleteTaskModal(task, close);
  });
}
