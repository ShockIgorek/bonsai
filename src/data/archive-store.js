const ARCHIVE_KEY = 'bonsai-archive';
const LOG_KEY = 'bonsai-log';

/**
 * Добавить задачу в архив.
 * @param {object} task — объект задачи (с полями name, desc, type, priority, image, parentPath)
 * @param {string} moodId — id настроения, в котором выполняли
 */
export function archiveTask(task, moodId) {
  const archive = getArchive();
  const archivedTask = {
    ...task,
    archivedAt: Date.now(),
    moodId,
    parentPath: task.path ? task.path.slice(0, -1) : [] // путь папки (без самой задачи)
  };
  archive.push(archivedTask);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archive));
}

/**
 * Получить все архивированные задачи.
 */
export function getArchive() {
  const saved = localStorage.getItem(ARCHIVE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * Очистить архив.
 */
export function clearArchive() {
  localStorage.removeItem(ARCHIVE_KEY);
}

/**
 * Добавить запись в лог выполнения.
 * @param {object} task — задача
 * @param {string} moodId — id настроения
 */
export function logCompletion(task, moodId) {
  const log = getLog();
  log.push({
    taskName: task.name,
    taskType: task.type || 'single',
    moodId,
    completedAt: Date.now(),
    parentPath: task.path ? task.path.slice(0, -1) : []
  });
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

/**
 * Получить лог выполнения.
 */
export function getLog() {
  const saved = localStorage.getItem(LOG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * Очистить лог.
 */
export function clearLog() {
  localStorage.removeItem(LOG_KEY);
}
