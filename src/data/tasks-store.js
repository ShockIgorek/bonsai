import { demoTree } from '../../data/demo-tree.js';

const STORAGE_KEY = 'bonsai-tasks-tree';

/**
 * Получить текущее дерево задач.
 * Если в localStorage ничего нет — берём demoTree и сохраняем его.
 */
export function getTasksTree() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Ошибка парсинга дерева задач, сбрасываем на demoTree');
    }
  }
  // Первый запуск или битые данные — сохраняем demoTree
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demoTree));
  return JSON.parse(JSON.stringify(demoTree));
}

/**
 * Сохранить дерево задач.
 */
export function saveTasksTree(tree) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
}

/**
 * Сбросить дерево к demoTree (полезно для отладки).
 */
export function resetTasksTree() {
  localStorage.removeItem(STORAGE_KEY);
  return getTasksTree();
}
