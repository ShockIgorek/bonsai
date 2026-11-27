import { buildNavIndex } from '../store.js';
import { getTasksTree } from '../data/tasks-store.js';
import { getMoods } from '../data/moods-store.js';
import { createPriorityResolver } from '../data/mood-priorities.js';
import { getAverageActualMinutes } from './task-time.js';
import { getDifficultyRatings, getEffectiveDifficulty } from './cyclic-schedule.js';
import { getTaskDurationMinutes } from '../utils/format-time.js';

function topBranchId(nav, node) {
  let current = node;

  while (current && current.parentId && current.parentId !== nav.rootId) {
    current = nav.byId.get(current.parentId);
  }

  return current ? current.id : node.id;
}

/**
 * Возвращает задачи-листья, которые видны в конкретном настроении.
 * Папки в попарный тест не попадают.
 */
export function getMoodTasks(moodId) {
  const nav = buildNavIndex(getTasksTree());
  const resolver = createPriorityResolver(nav, moodId);
  const mood = getMoods().find(item => item.id === moodId);
  const hiddenIds = new Set((mood && mood.hiddenTasks) || []);
  const tasks = [];

  function isHiddenDeep(node) {
    let current = node;

    while (current) {
      if (hiddenIds.has(current.id)) return true;
      current = current.parentId ? nav.byId.get(current.parentId) : null;
    }

    return false;
  }

  nav.byId.forEach(node => {
    if (!node.isLeaf) return;
    if (moodId !== 'default' && isHiddenDeep(node)) return;

    const actualMinutes = getAverageActualMinutes(node);
    const difficultyRatings = getDifficultyRatings(node);
    const timeMinutes = getTaskDurationMinutes(node.duration) ?? 20;

    tasks.push({
      id: node.id,
      name: node.name,
      desc: node.desc || '',
      image: node.image || '',
      path: node.path.slice(0, -1).join(' / ') || node.path[0] || '',
      parentId: node.parentId,
      topBranchId: topBranchId(nav, node),
      priority: resolver.resolve(node.id),
      timeMinutes,
      timeScore: Number.isFinite(node.timeScore) ? node.timeScore : 5,
      timeIsActual: actualMinutes !== null,
      timeCalibrated: !!(node.duration && node.duration.calibrated),
      difficulty: getEffectiveDifficulty(node),
      difficultyIsActual: difficultyRatings.length > 0,
      difficultyCalibrated: !!node.difficultyCalibrated,
      anchors: {
        time: actualMinutes !== null,
        difficulty: difficultyRatings.length > 0
      },
      values: {
        importance: resolver.resolve(node.id),
        time: timeMinutes,
        difficulty: getEffectiveDifficulty(node)
      }
    });
  });

  return { nav, tasks };
}
