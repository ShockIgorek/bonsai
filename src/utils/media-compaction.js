import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods, saveMoods } from '../data/moods-store.js';
import { compressDataUrl } from './image-compress.js';

// Сжимаем только крупные старые data URL, чтобы не трогать маленькие иконки
const MIN_IMAGE_SIZE = 250000;

export function isQuotaError(err) {
  return !!err && (err.name === 'QuotaExceededError' || err.code === 22);
}

function collectTreeImages(node, jobs) {
  if (node.image && typeof node.image === 'string' && node.image.length > MIN_IMAGE_SIZE) {
    jobs.push(compressDataUrl(node.image).then(src => {
      if (src !== node.image) {
        node.image = src;
        return true;
      }
      return false;
    }));
  }

  (node.children || []).forEach(child => collectTreeImages(child, jobs));
}

function collectMoodImages(moods, jobs) {
  for (const mood of moods) {
    if (mood.image && typeof mood.image === 'string' && mood.image.length > MIN_IMAGE_SIZE) {
      jobs.push(compressDataUrl(mood.image).then(src => {
        if (src !== mood.image) {
          mood.image = src;
          return true;
        }
        return false;
      }));
    }
  }
}

/**
 * Аварийное освобождение места: сжимает старые крупные фото
 * в задачах и настроениях. Вызывается только когда сохранение
 * упало в QuotaExceededError.
 */
export async function compactAllMedia({ tree = null } = {}) {
  const taskTree = tree || getTasksTree();
  const moods = getMoods();
  const jobs = [];

  collectTreeImages(taskTree, jobs);
  collectMoodImages(moods, jobs);

  if (!jobs.length) return false;

  const results = await Promise.all(jobs);
  const changed = results.some(Boolean);
  if (!changed) return false;

  // Сначала освобождаем место в настроениях, затем пишем задачи.
  // Если квота всё ещё не позволяет — не роняем вызывающий сценарий,
  // а даём ему повторить запись и показать понятную ошибку.
  try {
    saveMoods(moods);
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  try {
    saveTasksTree(taskTree);
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  return true;
}

export async function saveTasksTreeWithRecovery(tree) {
  try {
    saveTasksTree(tree);
    return;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  await compactAllMedia({ tree });
  saveTasksTree(tree);
}

export async function saveWithMediaRecovery(saveFn) {
  try {
    saveFn();
    return;
  } catch (err) {
    if (!isQuotaError(err)) throw err;
  }

  await compactAllMedia();
  saveFn();
}
