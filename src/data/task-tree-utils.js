export function findNodeById(root, id) {
  if (!root || !id) return null;
  if (root.id === id) return root;

  for (const child of root.children || []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
}

export function removeNodeById(root, id) {
  if (!root || !Array.isArray(root.children)) return null;

  const index = root.children.findIndex(child => child.id === id);
  if (index !== -1) {
    return root.children.splice(index, 1)[0];
  }

  for (const child of root.children) {
    const removed = removeNodeById(child, id);
    if (removed) return removed;
  }

  return null;
}

/**
 * Ищет папку по пути имён. Пустой путь — корень.
 */
export function findFolderByPath(root, pathNames = []) {
  let current = root;

  for (const name of pathNames) {
    const children = Array.isArray(current.children) ? current.children : [];
    const next = children.find(child => (
      child.name === name && Array.isArray(child.children)
    ));
    if (!next) return null;
    current = next;
  }

  return current;
}

export function appendTaskToPath(root, pathNames = [], task) {
  const folder = findFolderByPath(root, pathNames);
  const parent = folder || root;

  if (!Array.isArray(parent.children)) parent.children = [];
  parent.children.push(task);

  return {
    parent,
    usedRoot: !folder && pathNames.length > 0
  };
}

export function createTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function makeUniqueTaskId(root, id) {
  if (!id) return createTaskId();
  return findNodeById(root, id) ? createTaskId() : id;
}
