import { getTasksTree } from './tasks-store.js';
import { saveTasksTreeWithRecovery } from '../utils/media-compaction.js';
import { stripBase64Images } from '../utils/strip-images.js';
import {
  findFolderByPath,
  removeNodeById,
  appendTaskToPath,
  makeUniqueTaskId
} from './task-tree-utils.js';

const ARCHIVE_KEY = 'bonsai-archive';
const LOG_KEY = 'bonsai-log';

function createArchiveId() {
  return `archive_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function snapshotTask(task) {
  // В архив попадает сама задача, а не nav-обёртка с ref/path/isLeaf.
  const source = task && task.ref ? task.ref : task;
  if (!source || typeof source !== 'object') return {};

  const copy = stripBase64Images(source);

  delete copy.ref;
  delete copy.path;
  delete copy.isLeaf;
  delete copy.childIds;
  delete copy.parentId;

  return copy;
}

function sanitizeArchive(archive) {
  const state = { changed: false };

  const cleaned = archive.map((entry, index) => {
    if (!entry || typeof entry !== 'object') return entry;

    const copy = stripBase64Images(entry, state);

    for (const key of ['ref', 'path', 'isLeaf', 'childIds', 'parentId']) {
      if (key in copy) {
        delete copy[key];
        state.changed = true;
      }
    }

    if (!copy.archiveId) {
      copy.archiveId = `archive_${copy.archivedAt || Date.now()}_${index}`;
      state.changed = true;
    }

    return copy;
  });

  if (state.changed) {
    try {
      saveArchive(cleaned);
    } catch (err) {
      console.error('Не удалось очистить старые фото в архиве', err);
    }
  }

  return cleaned;
}

/**
 * Добавить задачу в архив.
 * Base64-фото вырезаются, чтобы архив не съедал localStorage.
 */
export function archiveTask(task, moodId) {
  const archive = getArchive();
  const snapshot = snapshotTask(task);
  const parentPath = Array.isArray(task.path)
    ? task.path.slice(0, -1)
    : (Array.isArray(task.parentPath) ? task.parentPath : []);

  const archivedTask = {
    ...snapshot,
    type: snapshot.type || 'single',
    archiveId: createArchiveId(),
    archivedAt: Date.now(),
    moodId: moodId || 'default',
    parentPath
  };

  archive.push(archivedTask);
  saveArchive(archive);
  return archivedTask;
}

/**
 * Получить архив. Заодно вычищает старые base64-фото
 * и проставляет archiveId старым записям.
 */
export function getArchive() {
  const saved = localStorage.getItem(ARCHIVE_KEY);
  if (!saved) return [];

  try {
    const archive = JSON.parse(saved);
    return Array.isArray(archive) ? sanitizeArchive(archive) : [];
  } catch (e) {
    return [];
  }
}

export function saveArchive(archive) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(Array.isArray(archive) ? archive : []));
}

export function removeArchiveEntry(archiveId) {
  const archive = getArchive();
  const next = archive.filter(entry => entry.archiveId !== archiveId);
  saveArchive(next);
  return next;
}

export function clearArchive() {
  localStorage.removeItem(ARCHIVE_KEY);
}

/**
 * Архивирует задачу и убирает её из дерева.
 * При ошибке сохранения дерева запись архива откатывается.
 */
export async function archiveAndRemoveTask(task, moodId) {
  const archivedTask = archiveTask(task, moodId);
  const tree = getTasksTree();
  const removed = removeNodeById(tree, task.id);

  if (!removed) {
    removeArchiveEntry(archivedTask.archiveId);
    throw new Error('Задача не найдена в дереве.');
  }

  try {
    await saveTasksTreeWithRecovery(tree);
  } catch (err) {
    removeArchiveEntry(archivedTask.archiveId);
    throw err;
  }

  return archivedTask;
}

/**
 * Восстанавливает задачу из архива в исходную папку.
 * Если папки уже нет — в корень.
 */
export async function restoreArchivedTask(archiveId) {
  const archive = getArchive();
  const entry = archive.find(item => item.archiveId === archiveId);
  if (!entry) throw new Error('Запись архива не найдена.');

  const tree = getTasksTree();
  const { archiveId: _archiveId, archivedAt: _archivedAt, moodId: _moodId, parentPath: _parentPath, ...task } = entry;

  task.id = makeUniqueTaskId(tree, task.id);
  task.type = task.type || 'single';

  // В старых записях parentPath начинается с имени корня.
  // Если корень переименовали, пробуем путь без первого сегмента.
  const rawParentPath = Array.isArray(entry.parentPath) ? entry.parentPath : [];
  let parentPath = rawParentPath;

  if (rawParentPath[0] === tree.name) {
    parentPath = rawParentPath.slice(1);
  } else if (rawParentPath.length && !findFolderByPath(tree, rawParentPath)) {
    const withoutFirst = rawParentPath.slice(1);
    if (findFolderByPath(tree, withoutFirst)) parentPath = withoutFirst;
  }

  const inserted = appendTaskToPath(tree, parentPath, task);

  // Сначала сохраняем дерево. Если не хватит места — архив остаётся целым.
  await saveTasksTreeWithRecovery(tree);
  saveArchive(archive.filter(item => item.archiveId !== archiveId));

  return { task, usedRoot: inserted.usedRoot };
}

/**
 * Добавить запись в лог выполнения.
 * @param {object} task — задача
 * @param {string} moodId — id настроения
 * @param {object} extra — difficulty / actualMinutes
 */
export function logCompletion(task, moodId, extra = {}) {
  const log = getLog();
  log.push({
    taskId: task.id || null,
    taskName: task.name,
    taskType: task.type || 'single',
    moodId,
    completedAt: Date.now(),
    parentPath: task.path ? task.path.slice(0, -1) : [],
    taskPath: task.path || [],
    difficulty: extra.difficulty ?? null,
    actualMinutes: extra.actualMinutes ?? null
  });
  saveLog(log);
}

/**
 * Полное выполнение одноразовой задачи: архив + удаление из дерева + лог.
 */
export async function completeSingleTask(task, moodId) {
  const archived = await archiveAndRemoveTask(task, moodId);

  try {
    logCompletion(
      { id: task.id, name: task.name, type: 'single', path: task.path || [] },
      moodId,
      { difficulty: null, actualMinutes: null }
    );
  } catch (err) {
    // Задача уже в архиве; лог не должен «отменять» выполнение.
    console.error('Не удалось записать выполнение в лог', err);
  }

  return archived;
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

export function saveLog(log) {
  localStorage.setItem(LOG_KEY, JSON.stringify(Array.isArray(log) ? log : []));
}

/**
 * Очистить лог.
 */
export function clearLog() {
  localStorage.removeItem(LOG_KEY);
}
