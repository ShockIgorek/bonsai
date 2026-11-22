import { buildNavIndex } from '../store.js';
import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';
import { openAddTaskModal, openEditTaskModal, openDeleteTaskModal } from './task-modal.js';
import { openTaskView } from './task-view.js';

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

  // Если пришли из Тиндера — заходим в нужную папку
  const savedPath = localStorage.getItem('bonsai-tinder-last-path');
  if (savedPath) {
    try {
      const path = JSON.parse(savedPath);
      // path — массив имён от корня до задачи. Нам нужна папка (предпоследний элемент)
      if (path.length >= 2) {
        const folderName = path[path.length - 2];
        // Ищем узел с таким именем (рекурсивно)
        function findNodeByName(nodeId, name) {
          const node = nav.byId.get(nodeId);
          if (!node) return null;
          if (node.name === name) return nodeId;
          for (const childId of node.childIds) {
            const found = findNodeByName(childId, name);
            if (found) return found;
          }
          return null;
        }
        const folderId = findNodeByName(nav.rootId, folderName);
        if (folderId) {
          nav.currentId = folderId;
        }
      }
    } catch (e) {
      console.warn('Ошибка парсинга пути из Тиндера');
    }
    // НЕ очищаем — пусть Тиндер использует его при возврате
  }

  // Состояние "показывать скрытые" (запоминаем в localStorage)
  let showHidden = localStorage.getItem('bonsai-show-hidden') === 'true';

  // Активное настроение
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const themeFilter = activeMood ? getThemeFilter(activeMood.theme) : 'none';

  // Проверяем, видна ли задача для текущего настроения
  // (если скрыта — false; если папка и все дети скрыты — тоже false)
  function isVisible(nodeId) {
    if (activeMoodId === 'default') return true; // В Норме всё видно
    if (showHidden) return true; // Если включен режим "показать скрытые" — показываем всё
    if (isTaskHiddenForMood(activeMoodId, nodeId)) return false;
    const node = nav.byId.get(nodeId);
    if (!node) return false;
    if (node.isLeaf) return true;
    // Для папки: если есть хоть один видимый ребёнок — показываем
    return node.childIds.some(childId => isVisible(childId));
  }

  // Проверяем, скрыта ли папка полностью (сама или все дети)
  function isFullyHidden(nodeId) {
    if (activeMoodId === 'default') return false;
    if (isTaskHiddenForMood(activeMoodId, nodeId)) return true;
    const node = nav.byId.get(nodeId);
    if (!node || node.isLeaf) return false;
    // Папка скрыта, если все дети скрыты
    return node.childIds.every(childId => isFullyHidden(childId));
  }

  // Получаем картинку для узла: своя, или от первого ребёнка (рекурсивно)
  function getNodeImage(nodeId, depth = 0) {
    if (depth > 10) return ''; // защита от рекурсии
    const node = nav.byId.get(nodeId);
    if (!node) return '';
    // Если есть своя картинка (в исходных данных) — берём её
    // В nav.byId картинки нет, поэтому ищем в исходном дереве по имени
    // Для простоты: будем хранить image в задаче, но пока его нет
    // Пока возвращаем пустоту (заглушка)
    return '';
  }

  function render() {
    const node = nav.current;
    if (!node) return;
    const children = nav.children.filter(child => isVisible(child.id));
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
          <button id="nav-toggle-hidden" style="background: var(--bg-panel); color: var(--text-main); border: 1px solid var(--border); width: 36px; height: 36px; border-radius: 50%; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Показать скрытые">👁️</button>
        </div>

        <div class="nav-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 16px; overflow-y: auto; align-content: start;">
          ${children.map(child => {
            const isFolder = !child.isLeaf;
            const icon = isFolder ? '📁' : getTaskEmoji(child.name);
            const hiddenForMood = activeMoodId !== 'default' && isFullyHidden(child.id);
            const opacity = hiddenForMood ? '0.6' : '1';
            const childCount = isFolder ? child.childIds.length : 0;
            return `
              <div class="nav-item" data-id="${child.id}" data-is-folder="${isFolder}" style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; transition: transform 0.15s, border-color 0.15s; opacity: ${opacity};">
                <div class="nav-item-icon" style="position: relative; font-size: 40px; line-height: 1; filter: ${themeFilter};">
                  ${icon}
                  ${isFolder ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: 800;">${childCount}</div>` : ''}
                </div>
                <div class="nav-item-name" style="font-size: 13px; font-weight: 600; text-align: center; color: var(--text-main); word-break: break-word;">${child.name}</div>
                ${hiddenForMood ? '<div style="position: absolute; top: 4px; left: 4px; font-size: 12px;">🙈</div>' : ''}
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
          const task = nav.byId.get(id);
          openTaskView(task, () => renderNavView());
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
        renderNavView();
      });
    });

    // Кнопка "Показать/скрыть скрытые"
    main.querySelector('#nav-toggle-hidden')?.addEventListener('click', () => {
      showHidden = !showHidden;
      localStorage.setItem('bonsai-show-hidden', showHidden ? 'true' : 'false');
      render();
    });
  }

  render();
}
