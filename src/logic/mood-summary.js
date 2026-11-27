import { getMoods } from '../data/moods-store.js';
import { createPriorityResolver } from '../data/mood-priorities.js';

function isHiddenDeep(nav, node, hiddenIds) {
  let current = node;

  while (current) {
    if (hiddenIds.has(current.id)) return true;
    current = current.parentId ? nav.byId.get(current.parentId) : null;
  }

  return false;
}

function isUnderSelected(nav, node, selectedIds) {
  let current = node;

  while (current) {
    if (selectedIds.has(current.id)) return true;
    current = current.parentId ? nav.byId.get(current.parentId) : null;
  }

  return false;
}

/**
 * Топ-3 ветки/задачи для карточки настроения.
 * Сначала корневые ветки по приоритету, затем добиваем задачами.
 */
export function getMoodTopNodes(nav, moodId, limit = 3) {
  const root = nav.byId.get(nav.rootId);
  if (!root) return [];

  const resolver = createPriorityResolver(nav, moodId);
  const mood = getMoods().find(item => item.id === moodId);
  const hiddenIds = new Set((mood && mood.hiddenTasks) || []);
  const selected = [];
  const selectedIds = new Set();

  const branches = (root.childIds || [])
    .map(id => nav.byId.get(id))
    .filter(node => node && !node.isLeaf && !isHiddenDeep(nav, node, hiddenIds))
    .sort((a, b) => resolver.resolve(b.id) - resolver.resolve(a.id));

  for (const branch of branches) {
    if (selected.length >= limit) break;
    selected.push({ id: branch.id, name: branch.name, isLeaf: false });
    selectedIds.add(branch.id);
  }

  if (selected.length < limit) {
    const leaves = [];
    nav.byId.forEach(node => {
      if (node.id === nav.rootId || !node.isLeaf) return;
      if (isHiddenDeep(nav, node, hiddenIds)) return;
      leaves.push(node);
    });

    leaves.sort((a, b) => resolver.resolve(b.id) - resolver.resolve(a.id));

    const addLeaves = (excludeUnderSelected) => {
      for (const leaf of leaves) {
        if (selected.length >= limit) break;
        if (selectedIds.has(leaf.id)) continue;
        if (excludeUnderSelected && isUnderSelected(nav, leaf, selectedIds)) continue;

        selected.push({ id: leaf.id, name: leaf.name, isLeaf: true });
        selectedIds.add(leaf.id);
      }
    };

    // Сначала задачи вне уже выбранных веток, потом — если мест всё ещё нет.
    addLeaves(true);
    addLeaves(false);
  }

  return selected;
}
