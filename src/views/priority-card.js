import { ICONS } from '../utils/icons.js';
import { formatTaskDuration } from '../utils/format-time.js';

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function renderMetric(task, dimension) {
  if (!dimension || dimension === 'importance') return '';

  let value = '';
  let source = '';
  let sourceClass = '';

  if (dimension === 'time') {
    value = formatTaskDuration(task.timeIsActual
      ? { actual: task.timeMinutes, estimated: task.timeMinutes }
      : { estimated: task.timeMinutes });
    source = task.timeIsActual ? 'факт' : (task.timeCalibrated ? 'калибровка' : 'оценка');
    sourceClass = task.timeIsActual ? 'is-fact' : (task.timeCalibrated ? 'is-calibrated' : 'is-estimate');
  }

  if (dimension === 'difficulty') {
    value = `${Number(task.difficulty || 0).toFixed(1)} / 10`;
    source = task.difficultyIsActual ? 'факт' : (task.difficultyCalibrated ? 'калибровка' : 'оценка');
    sourceClass = task.difficultyIsActual ? 'is-fact' : (task.difficultyCalibrated ? 'is-calibrated' : 'is-estimate');
  }

  if (!value) return '';

  return `
    <span class="priority-task-metric">
      <span class="priority-task-metric-value">${escapeHtml(value)}</span>
      <span class="priority-task-metric-source ${sourceClass}">${source}</span>
    </span>
  `;
}

/**
 * Общая разметка карточки задачи для теста и диалога +/-:
 * картинка/заглушка + название, путь, описание и метрика текущего вопроса.
 */
export function renderPriorityTaskContent(task, { dimension = null } = {}) {
  return `
    <span class="priority-task-media">
      ${task.image
        ? `<img src="${escapeHtml(task.image)}" alt="" loading="lazy" draggable="false" />`
        : `<span class="priority-task-placeholder">${ICONS.sprout}</span>`}
    </span>
    <span class="priority-task-body">
      <span class="priority-task-name">${escapeHtml(task.name)}</span>
      ${task.path ? `<span class="priority-task-path">${escapeHtml(task.path)}</span>` : ''}
      ${task.desc ? `<span class="priority-task-desc">${escapeHtml(task.desc)}</span>` : ''}
      ${renderMetric(task, dimension)}
    </span>
  `;
}
