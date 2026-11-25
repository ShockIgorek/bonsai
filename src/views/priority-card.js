import { ICONS } from '../utils/icons.js';

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

/**
 * Общая разметка карточки задачи для теста и диалога +/-:
 * картинка/заглушка + название, путь, описание.
 */
export function renderPriorityTaskContent(task) {
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
    </span>
  `;
}
