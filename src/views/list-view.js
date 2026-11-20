import { buildNavIndex } from '../store.js';
import { demoTree } from '../../data/demo-tree.js';

/**
 * Рендерит дерево задач в режиме "Список" (аккордеон).
 */
export function renderListView() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // Строим индекс (пока на демо-данных)
  const nav = buildNavIndex(demoTree);

  // Рекурсивно рендерим узел и его детей
  function renderNode(nodeId, depth = 0) {
    const node = nav.byId.get(nodeId);
    if (!node) return '';

    const hasChildren = !node.isLeaf;
    const indent = depth * 16;

    return `
      <div class="list-node" style="margin-left: ${indent}px;">
        <div class="list-node-header" data-id="${node.id}" data-has-children="${hasChildren}">
          <span class="list-node-icon">${hasChildren ? '📁' : '📄'}</span>
          <span class="list-node-name">${node.name}</span>
          ${hasChildren ? `<span class="list-node-arrow">▼</span>` : ''}
        </div>
        ${node.desc ? `<div class="list-node-desc" style="margin-left: 24px;">${node.desc}</div>` : ''}
        ${hasChildren ? `
          <div class="list-node-children" style="display: none;">
            ${node.childIds.map(childId => renderNode(childId, depth + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  main.innerHTML = `
    <div class="list-view" style="padding: 16px; color: var(--text-main);">
      <h2 style="font-size: 20px; margin-bottom: 16px;">📋 Список задач</h2>
      ${renderNode(nav.rootId)}
    </div>
  `;

  // Обработка кликов (сворачивание/разворачивание)
  main.querySelectorAll('.list-node-header').forEach(header => {
    header.addEventListener('click', () => {
      const hasChildren = header.dataset.hasChildren === 'true';
      if (!hasChildren) return;
      
      const parent = header.closest('.list-node');
      const children = parent.querySelector('.list-node-children');
      if (!children) return;
      
      const isHidden = children.style.display === 'none';
      children.style.display = isHidden ? 'block' : 'none';
      
      const arrow = header.querySelector('.list-node-arrow');
      if (arrow) arrow.textContent = isHidden ? '▼' : '▶';
    });
  });
}
