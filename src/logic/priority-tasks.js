import { buildNavIndex } from '../store.js';
import { getTasksTree } from '../data/tasks-store.js';
import { isTaskHiddenForMood } from '../data/moods-store.js';

/**
 * Возвращает задачи-листья, которые видны в конкретном настроении.
 * Папки (задачи с подзадачами) в попарный тест не попадают.
 */
export function getMoodTasks(moodId) {
  const nav = buildNavIndex(getTasksTree());
  const tasks = [];

  nav.byId.forEach(node => {
    if (!node.isLeaf) return;
    if (moodId !== 'default' && isTaskHiddenForMood(moodId, node.id)) return;

    tasks.push({
      id: node.id,
      name: node.name,
      desc: node.desc || '',
      image: node.image || '',
      path: node.path.slice(0, -1).join(' / ') || node.path[0] || ''
    });
  });

  return { nav, tasks };
}
