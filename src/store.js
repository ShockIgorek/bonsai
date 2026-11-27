import { getEffectiveDifficulty } from './logic/cyclic-schedule.js';

export function buildNavIndex(root) {
  const byId = new Map();
  let counter = 0;

  function walk(node, parentId, path) {
    // Используем сохранённый id, если есть; иначе генерируем (для старых данных)
    const id = node.id || `n${++counter}`;
    const fullPath = [...path, node.name];
    const isLeaf = !node.children || node.children.length === 0;
    
    byId.set(id, {
      id,
      name: node.name,
      desc: node.desc || '',
      image: node.image || '',
      type: node.type || 'single',
      priority: node.priority !== undefined ? node.priority : 5.0,
      difficulty: getEffectiveDifficulty(node),
      timeScore: node.timeScore !== undefined ? node.timeScore : 5.0,
      duration: node.duration || { estimated: null, actual: null },
      deadline: node.deadline || null,
      interval: node.interval || null,
      completionHistory: Array.isArray(node.completionHistory) ? node.completionHistory : [],
      series: node.series || 0,
      ref: node,
      parentId,
      path: fullPath,
      isLeaf,
      childIds: isLeaf ? [] : node.children.map(() => null)
    });
    
    if (!isLeaf) {
      node.children.forEach((child, i) => {
        const childId = walk(child, id, fullPath);
        byId.get(id).childIds[i] = childId;
      });
    }
    return id;
  }

  const rootId = walk(root, null, []);
  
  return {
    byId,
    rootId,
    currentId: rootId,
    get current() { return this.byId.get(this.currentId); },
    get children() {
      const node = this.byId.get(this.currentId);
      return node ? node.childIds.map(id => this.byId.get(id)) : [];
    },
    get breadcrumbs() { return this.current ? this.current.path : []; }
  };
}
