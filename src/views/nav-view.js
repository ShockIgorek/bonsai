import { buildNavIndex } from '../store.js';
import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';
import { openAddTaskModal, openEditTaskModal, openDeleteTaskModal } from './task-modal.js';

function getTaskEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('посуд') || n.includes('тарел') || n.includes('чашк')) return '🍽️';
  if (n.includes('стол') || n.includes('крошк')) return '🧹';
  if (n.includes('шкаф') || n.includes('разобра')) return '🗄️';
  if (n.includes('холодильник') || n.includes('просроч')) return '🧊';
  if (n.includes('срач') || n.includes('диван')) return '🛋️';
  if (n.includes('подоконник')) return '🪟';
  if (n.includes('постель') || n.includes('кроват')) return '🛏️';
  if (n.includes('гитар')) return '🎸';
  if (n.includes('провод')) return '🔌';
  if (n.includes('пол') || n.includes('пылесос')) return '🧹';
  if (n.includes('белок') || n.includes('протеин') || n.includes('коктейл')) return '🥤';
  if (n.includes('рыб')) return '🐟';
  if (n.includes('яйц')) return '🥚';
  if (n.includes('куроч') || n.includes('куриц')) return '🍗';
  if (n.includes('вод') || n.includes('пить')) return '💧';
  if (n.includes('фрукт') || n.includes('овощ')) return '🍎';
  if (n.includes('силов') || n.includes('трен')) return '🏋️';
  if (n.includes('растяж') || n.includes('шпагат')) return '🧘';
  if (n.includes('кардио') || n.includes('пробеж') || n.includes('велик')) return '🏃';
  if (n.includes('гул') || n.includes('прогул')) return '🚶';
  if (n.includes('режим') || n.includes('спать')) return '😴';
  if (n.includes('альбом') || n.includes('запис')) return '🎵';
  if (n.includes('программ') || n.includes('произведен')) return '🎹';
  if (n.includes('этюд') || n.includes('пассаж')) return '🎼';
  if (n.includes('видео') || n.includes('видос')) return '🎬';
  if (n.includes('чай')) return '🍵';
  if (n.includes('винил') || n.includes('музык')) return '🎧';
  if (n.includes('игр') || n.includes('плойк')) return '🎮';
  if (n.includes('сериал') || n.includes('сери')) return '📺';
  if (n.includes('книг') || n.includes('читать')) return '📖';
  if (n.includes('отклад') || n.includes('деньг')) return '💰';
  if (n.includes('кредит') || n.includes('платеж')) return '💳';
  if (n.includes('друз') || n.includes('встрет')) return '👥';
  if (n.includes('мам') || n.includes('бабушк') || n.includes('позвон')) return '📞';
  if (n.includes('серег') || n.includes('доебат')) return '😜';
  return '📝';
}

export function renderNavView() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const tasksTree = getTasksTree();
  const nav = buildNavIndex(tasksTree);

  // Активное настроение
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const themeFilter = activeMood ? getThemeFilter(activeMood.theme) : 'none';

  function render() {
    const node = nav.current;
    if (!node) return;
    const children = nav.children;
    const breadcrumbs = nav.breadcrumbs;

    // Для крошек собираем id
    const breadcrumbIds = [];
    let cur = node;
    while (cur) {
      breadcrumbIds.unshift(cur.id);
      cur = cur.parentId ? nav.byId.get(cur.parentId) : null;
    }

    main.innerHTML = `
      <div class="nav-view" style="padding: 16px; color: var(--text-main); display: flex; flex-direction: column; height: 100%; box-sizing: border-box;">
        
        <div class="nav-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-shrink: 0;">
          ${nav.currentId !== nav.rootId ? `<button id="nav-back" class="back-btn" aria-label="Назад">←</button>` : ''}
          <div class="nav-breadcrumbs" style="font-size: 14px; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${breadcrumbIds.map((id, i) => {
              const isLast = i === breadcrumbIds.length - 1;
              const name = nav.byId.get(id).name;
              return isLast
                ? `<span style="color: var(--text-main); font-weight: 600;">${name}</span>`
                : `<span class="nav-crumb" data-id="${id}" style="cursor: pointer; text-decoration: underline; text-decoration-style: dotted;">${name}</span> <span style="opacity:0.5;">/</span> `;
            }).join('')}
          </div>
        </div>

        <div class="nav-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 16px; overflow-y: auto; align-content: start;">
          ${children.map(child => {
            const isFolder = !child.isLeaf;
            const icon = isFolder ? '📁' : getTaskEmoji(child.name);
            return `
              <div class="nav-item" data-id="${child.id}" data-is-folder="${isFolder}" style="display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; transition: transform 0.15s, border-color 0.15s;">
                <div class="nav-item-icon" style="font-size: 40px; line-height: 1; filter: ${themeFilter};">${icon}</div>
                <div class="nav-item-name" style="font-size: 13px; font-weight: 600; text-align: center; color: var(--text-main); word-break: break-word;">${child.name}</div>
              </div>
            `;
          }).join('')}
          
          <!-- Карточка "Добавить" (как в настроениях) -->
          <div id="nav-add-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 12px; background: var(--bg-card); border: 2px dashed var(--border); border-radius: 16px; transition: transform 0.15s, border-color 0.15s; min-height: 100px;">
            <div style="font-size: 40px; line-height: 1; color: var(--text-muted);">+</div>
            <div style="font-size: 13px; font-weight: 600; text-align: center; color: var(--text-secondary);">Добавить</div>
          </div>
        </div>
        ${children.length === 0 ? `<div style="text-align: center; color: var(--text-secondary); padding: 40px 0;">Пусто. Нажми «Добавить» чтобы создать задачу.</div>` : ''}
      </div>
    `;

    // Клик по папке/листу
    main.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const isFolder = item.dataset.isFolder === 'true';
        if (isFolder) {
          nav.currentId = id;
          render();
        } else {
          alert(`Задача: ${nav.byId.get(id).name}`);
        }
      });
    });

    // Хлебные крошки
    main.querySelectorAll('.nav-crumb').forEach(crumb => {
      crumb.addEventListener('click', () => {
        nav.currentId = crumb.dataset.id;
        render();
      });
    });

    // Назад
    main.querySelector('#nav-back')?.addEventListener('click', () => {
      if (node.parentId) {
        nav.currentId = node.parentId;
        render();
      }
    });

    // Карточка "Добавить"
    main.querySelector('#nav-add-card')?.addEventListener('click', () => {
      openAddTaskModal(node.name, () => {
        const newTree = getTasksTree();
        const newNav = buildNavIndex(newTree);
        // Перерисовываем на том же уровне (сбрасываем на root для простоты)
        // В будущем сделаем сохранение позиции
        renderNavView();
      });
    });
  }

  render();
}
