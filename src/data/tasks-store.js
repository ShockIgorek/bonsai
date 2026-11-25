import { demoTree } from '../../data/demo-tree.js';

const STORAGE_KEY = 'bonsai-tasks-tree';

/**
 * Проставляет id узлам без id (старые данные/demoTree) и сохраняет их.
 * Нумерация повторяет ту, что раньше генерировал buildNavIndex,
 * чтобы ссылки на задачи (например, скрытие по настроению) не сломались.
 */
function collectIds(node, used) {
  if (node.id) used.add(node.id);
  if (Array.isArray(node.children)) {
    node.children.forEach(child => collectIds(child, used));
  }
}

function ensureIds(node, state) {
  if (!node.id) {
    let id;
    do {
      id = `n${++state.n}`;
    } while (state.used.has(id));
    node.id = id;
    state.used.add(id);
    state.changed = true;
  }
  if (Array.isArray(node.children)) {
    node.children.forEach(child => ensureIds(child, state));
  }
}

/**
 * Получить текущее дерево задач.
 * Если в localStorage ничего нет — берём demoTree и сохраняем его.
 */
export function getTasksTree() {
  const saved = localStorage.getItem(STORAGE_KEY);
  let tree = null;
  let needsSave = false;

  if (saved) {
    try {
      tree = JSON.parse(saved);
    } catch (e) {
      console.warn('Ошибка парсинга дерева задач, сбрасываем на demoTree');
    }
  }

  if (!tree) {
    // Первый запуск или битые данные — берём demoTree
    tree = JSON.parse(JSON.stringify(demoTree));
    needsSave = true;
  }

  const state = { n: 0, changed: false, used: new Set() };
  collectIds(tree, state.used);
  ensureIds(tree, state);

  if (needsSave || state.changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  }

  return tree;
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
