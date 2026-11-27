import { getTasksTree, saveTasksTree } from './tasks-store.js';
import { getMoods, saveMoods } from './moods-store.js';
import { getArchive, getLog, saveArchive, saveLog } from './archive-store.js';

export const BACKUP_VERSION = 1;
export const BACKUP_KIND = 'full-backup';

// Постоянные ключи, которые входят в бэкап явными полями.
const EXPLICIT_KEYS = new Set([
  'bonsai-tasks-tree',
  'bonsai-moods',
  'bonsai-archive',
  'bonsai-log',
  'bonsai-theme',
  'bonsai-active-mood',
  'bonsai-show-hidden',
  'bonsai-current-mode'
]);

// Временное состояние: таймер, позиция Тиндера, навигационный экран.
// При переносе на другой origin это не нужно и может только запутать.
const TRANSIENT_KEYS = new Set([
  'bonsai-active-timer',
  'bonsai-tinder-last-path',
  'bonsai-tinder-restore-index',
  'bonsai-last-screen'
]);

function cloneForBackup(value, includeImages) {
  if (Array.isArray(value)) {
    return value.map(item => cloneForBackup(item, includeImages));
  }

  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (
        key === 'image' &&
        !includeImages &&
        typeof item === 'string' &&
        item.startsWith('data:')
      ) {
        result[key] = '';
      } else {
        result[key] = cloneForBackup(item, includeImages);
      }
    }
    return result;
  }

  return value;
}

function readSetting(key, fallback = null) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

function writeSetting(key, value) {
  if (value === null || value === undefined) return;
  localStorage.setItem(key, String(value));
}

function collectExtraKeys() {
  const extra = {};

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('bonsai-')) continue;
      if (EXPLICIT_KEYS.has(key) || TRANSIENT_KEYS.has(key)) continue;

      const raw = localStorage.getItem(key);
      if (raw !== null) extra[key] = raw;
    }
  } catch (err) {
    // Бэкап не должен падать из-за одного нечитаемого ключа.
  }

  return extra;
}

function countTasks(node) {
  if (!node) return 0;
  return (node.children || []).reduce((total, child) => (
    total + 1 + countTasks(child)
  ), 0);
}

/**
 * Полный бэкап всех постоянных данных приложения.
 * Фото по умолчанию вырезаются: на телефоне их хранить необязательно.
 * Если появятся новые механики с новыми ключами bonsai-*,
 * они автоматически попадут в extra (кроме временных ключей).
 */
export function createFullBackup({ includeImages = false } = {}) {
  return {
    app: 'bonsai',
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    buildId: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null,
    includesImages: includeImages,
    data: {
      tasksTree: cloneForBackup(getTasksTree(), includeImages),
      moods: cloneForBackup(getMoods(), includeImages),
      archive: cloneForBackup(getArchive(), includeImages),
      log: cloneForBackup(getLog(), includeImages),
      settings: {
        theme: readSetting('bonsai-theme', 'bonsai'),
        activeMood: readSetting('bonsai-active-mood', 'default'),
        showHidden: readSetting('bonsai-show-hidden', 'false'),
        currentMode: readSetting('bonsai-current-mode', 'tinder')
      },
      extra: collectExtraKeys()
    }
  };
}

export function validateFullBackup(backup) {
  if (!backup || typeof backup !== 'object') {
    return 'Файл не похож на бэкап Bonsai.';
  }

  if (backup.app !== 'bonsai' || backup.kind !== BACKUP_KIND) {
    return 'Это не полный бэкап Bonsai.';
  }

  if (!Number.isInteger(backup.version) || backup.version < 1) {
    return 'Неизвестная версия бэкапа.';
  }

  if (backup.version > BACKUP_VERSION) {
    return 'Бэкап создан более новой версией приложения. Обнови приложение и попробуй снова.';
  }

  const data = backup.data;
  if (!data || typeof data !== 'object') {
    return 'В бэкапе нет данных.';
  }

  if (!data.tasksTree || typeof data.tasksTree !== 'object' || typeof data.tasksTree.name !== 'string') {
    return 'В бэкапе нет дерева задач.';
  }

  if (!Array.isArray(data.moods) || !data.moods.length) {
    return 'В бэкапе нет настроений.';
  }

  if (data.archive != null && !Array.isArray(data.archive)) {
    return 'Повреждён архив задач.';
  }

  if (data.log != null && !Array.isArray(data.log)) {
    return 'Повреждён лог выполнения.';
  }

  if (data.extra != null && typeof data.extra !== 'object') {
    return 'Повреждены дополнительные данные.';
  }

  return null;
}

export function getBackupSummary(backup) {
  const data = backup && backup.data ? backup.data : {};
  return {
    exportedAt: backup && backup.exportedAt ? backup.exportedAt : null,
    includesImages: !!(backup && backup.includesImages),
    tasks: countTasks(data.tasksTree),
    moods: Array.isArray(data.moods) ? data.moods.length : 0,
    archive: Array.isArray(data.archive) ? data.archive.length : 0,
    log: Array.isArray(data.log) ? data.log.length : 0
  };
}

export function restoreFullBackup(backup) {
  const error = validateFullBackup(backup);
  if (error) throw new Error(error);

  const data = backup.data;
  const moods = data.moods;
  const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};

  saveTasksTree(data.tasksTree);
  saveMoods(moods);
  saveArchive(Array.isArray(data.archive) ? data.archive : []);
  saveLog(Array.isArray(data.log) ? data.log : []);

  const activeMood = settings.activeMood && moods.some(mood => mood.id === settings.activeMood)
    ? settings.activeMood
    : (moods[0] && moods[0].id) || 'default';

  writeSetting('bonsai-theme', settings.theme || (moods.find(mood => mood.id === activeMood) || {}).theme || 'bonsai');
  writeSetting('bonsai-active-mood', activeMood);
  writeSetting('bonsai-show-hidden', settings.showHidden ?? 'false');
  writeSetting('bonsai-current-mode', settings.currentMode || 'tinder');

  if (data.extra && typeof data.extra === 'object') {
    for (const [key, raw] of Object.entries(data.extra)) {
      if (!key.startsWith('bonsai-')) continue;
      if (EXPLICIT_KEYS.has(key) || TRANSIENT_KEYS.has(key)) continue;
      if (typeof raw !== 'string') continue;
      localStorage.setItem(key, raw);
    }
  }

  for (const key of TRANSIENT_KEYS) {
    localStorage.removeItem(key);
  }

  return getBackupSummary(backup);
}
