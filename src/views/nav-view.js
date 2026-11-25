import Sortable from 'sortablejs';
import { buildNavIndex } from '../store.js';
import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood } from '../data/moods-store.js';
import { createPriorityResolver } from '../data/mood-priorities.js';
import { getThemeFilter } from '../utils/theme-filter.js';
import { ICONS } from '../utils/icons.js';
import { openAddTaskModal, openEditTaskModal, openDeleteTaskModal } from './task-modal.js';
import { openTaskView } from './task-view.js';

const navSortStyle = document.createElement('style');
navSortStyle.textContent = `
  .nav-item-ghost { opacity: 0.25; }
  .nav-item-chosen { outline: 2px solid var(--accent); outline-offset: 2px; cursor: grabbing; }
  .nav-item-drag { opacity: 0.9; }
  .nav-item-drop-target { outline: 2px solid var(--accent); outline-offset: 2px; }
  .nav-crumb-drop-target { color: var(--accent) !important; }

  .nav-drag-bar {
    position: fixed;
    left: 50%;
    bottom: 80px;
    transform: translateX(-50%);
    z-index: 200000;
    display: flex;
    align-items: stretch;
    gap: 8px;
    max-width: calc(100vw - 16px);
    padding: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    user-select: none;
  }
  .nav-drag-descend, .nav-drag-trash {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--bg-panel);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
  .nav-drag-descend {
    flex: 1;
    min-width: 0;
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .nav-drag-descend-disabled {
    opacity: 0.45;
    border-color: var(--border);
    color: var(--text-muted);
  }
  .nav-drag-trash {
    flex-shrink: 0;
    border: 1px solid var(--danger);
    color: var(--danger);
  }
  .nav-drag-trash svg { width: 18px; height: 18px; stroke: var(--danger); flex-shrink: 0; }
  .nav-drag-descend-active {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    background: color-mix(in srgb, var(--accent) 18%, var(--bg-panel));
  }
  .nav-drag-trash-active {
    outline: 2px solid var(--danger);
    outline-offset: 2px;
    background: color-mix(in srgb, var(--danger) 20%, var(--bg-panel));
  }
`;
document.head.appendChild(navSortStyle);

let navSortable = null;
let navDragCleanup = null;
let navDragBar = null;

function detachNavDragTracking() {
  if (navDragCleanup) {
    navDragCleanup();
    navDragCleanup = null;
  }
}

function hideNavDragBar() {
  if (navDragBar) {
    navDragBar.remove();
    navDragBar = null;
  }
}

function updateNavDragBar(folderName) {
  const zone = navDragBar?.querySelector('.nav-drag-descend');
  if (!zone) return;
  zone.classList.toggle('nav-drag-descend-disabled', !folderName);
  zone.textContent = folderName ? `↓ Спуститься в «${folderName}»` : '↓ Наведите на папку';
}

function showNavDragBar() {
  if (navDragBar) return;
  navDragBar = document.createElement('div');
  navDragBar.className = 'nav-drag-bar';
  navDragBar.innerHTML = `
    <div class="nav-drag-descend nav-drag-descend-disabled" data-zone="descend">↓ Наведите на папку</div>
    <div class="nav-drag-trash" data-zone="trash">${ICONS.trash}<span>Удалить</span></div>
  `;
  document.body.appendChild(navDragBar);
}

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

  let tasksTree = getTasksTree();
  let nav = buildNavIndex(tasksTree);

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

  // Перечитывает дерево и перерисовывает папку (по пути или текущую)
  function reloadNav(pathOverride = null) {
    const currentPath = pathOverride
      || (nav.current ? JSON.stringify(nav.current.path) : null);
    tasksTree = getTasksTree();
    nav = buildNavIndex(tasksTree);
    if (currentPath) {
      const found = Array.from(nav.byId.values()).find(n => JSON.stringify(n.path) === currentPath);
      if (found) nav.currentId = found.id;
    }
    render();
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
    detachNavDragTracking();
    hideNavDragBar();
    if (navSortable) {
      navSortable.destroy();
      navSortable = null;
    }

    const node = nav.current;
    if (!node) return;
    const children = nav.children.filter(child => isVisible(child.id));
    const priorityResolver = createPriorityResolver(nav, activeMoodId);
    let suppressClickUntil = 0;
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
            const hiddenForMood = activeMoodId !== 'default' && isFullyHidden(child.id);
            const opacity = hiddenForMood ? '0.6' : '1';
            const childCount = isFolder ? child.childIds.length : 0;
            const priority = priorityResolver.resolve(child.id);
            const priorityOpacity = priority < 5 ? (0.4 + (priority / 5) * 0.6).toFixed(2) : '1';
            const priorityGlow = priority > 5 ? `0 0 ${((priority - 5) * 2).toFixed(1)}px var(--accent)` : 'none';

            // Иконка: картинка (если есть), эмодзи или папка
            let iconHtml = '';
            if (child.image) {
              iconHtml = `<img src="${child.image}" alt="" draggable="false" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px; filter: ${themeFilter}; pointer-events: none; -webkit-user-drag: none;" />`;
            } else if (isFolder) {
              iconHtml = '📁';
            } else {
              iconHtml = getTaskEmoji(child.name);
            }
            
            return `
              <div class="nav-item" data-id="${child.id}" data-is-folder="${isFolder}" style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 128px; overflow: hidden; cursor: pointer; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; transition: transform 0.15s, border-color 0.15s; opacity: ${opacity}; user-select: none; -webkit-touch-callout: none;">
                ${!isFolder ? `<div class="nav-item-priority" style="position: absolute; top: 6px; left: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.3px; color: var(--accent); opacity: ${priorityOpacity}; text-shadow: ${priorityGlow};">${priority.toFixed(1)}</div>` : ''}
                <div class="nav-item-icon" style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 40px; line-height: 1; filter: ${themeFilter};">
                  ${iconHtml}
                  ${isFolder ? `<div style="position: absolute; inset: 0; background: color-mix(in srgb, var(--bg-main) 65%, transparent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-main); font-size: 16px; font-weight: 800;">${childCount}</div>` : ''}
                </div>
                <div class="nav-item-name" style="font-size: 13px; font-weight: 600; line-height: 1.2; text-align: center; color: var(--text-main); word-break: break-word; min-height: 2.4em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${child.name}</div>
                ${hiddenForMood ? '<div style="position: absolute; top: 4px; right: 4px; font-size: 12px;">🙈</div>' : ''}
              </div>
            `;
          }).join('')}
          
          <!-- Карточка "Добавить" (как в настроениях) -->
          <div id="nav-add-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 128px; cursor: pointer; padding: 12px; background: var(--bg-card); border: 2px dashed var(--border); border-radius: 16px; transition: transform 0.15s, border-color 0.15s;">
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
        if (Date.now() < suppressClickUntil) return;
        const id = item.dataset.id;
        const isFolder = item.dataset.isFolder === 'true';
        if (isFolder) {
          nav.currentId = id;
          render();
        } else {
          const task = nav.byId.get(id);
          openTaskView(task, () => reloadNav());
        }
      });
    });

    // Хлебные крошки: клик — переход
    main.querySelectorAll('.nav-crumb').forEach(crumb => {
      crumb.addEventListener('click', () => {
        if (Date.now() < suppressClickUntil) return;
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
      if (Date.now() < suppressClickUntil) return;
      openAddTaskModal(node.name, () => reloadNav());
    });

    // Кнопка "Показать/скрыть скрытые"
    main.querySelector('#nav-toggle-hidden')?.addEventListener('click', () => {
      showHidden = !showHidden;
      localStorage.setItem('bonsai-show-hidden', showHidden ? 'true' : 'false');
      render();
    });

    // Драг-энд-дроп: только перенос в папки (сортировка отключена)
    const grid = main.querySelector('.nav-grid');
    if (grid) {
      let draggedId = null;
      let hoverFolderId = null;
      let dropFolderEl = null;
      let dropCrumbEl = null;
      let dropDescendEl = null;
      let dropTrashEl = null;

      function pointFromEvent(e) {
        const t = e?.changedTouches?.[0] || e?.touches?.[0] || e;
        return typeof t?.clientX === 'number' ? { x: t.clientX, y: t.clientY } : null;
      }

      function resolveTargets(point) {
        const result = { folderEl: null, crumbEl: null, descendEl: null, trashEl: null };
        if (!point) return result;

        const els = document.elementsFromPoint(point.x, point.y);
        const overBar = navDragBar
          && els.some(el => el === navDragBar || navDragBar.contains(el));

        if (overBar) {
          result.descendEl = els.find(el => el.classList?.contains('nav-drag-descend')) || null;
          result.trashEl = els.find(el => el.classList?.contains('nav-drag-trash')) || null;
          return result;
        }

        for (const el of els) {
          if (!result.crumbEl && el.classList?.contains('nav-crumb')) {
            result.crumbEl = el;
          }
          if (!result.folderEl) {
            const item = el.closest?.('.nav-item');
            if (item && item.dataset.isFolder === 'true' && item.dataset.id !== draggedId) {
              result.folderEl = item;
            }
          }
        }
        return result;
      }

      function updateTargets(point) {
        const targets = resolveTargets(point);

        if (dropFolderEl !== targets.folderEl) {
          if (dropFolderEl) dropFolderEl.classList.remove('nav-item-drop-target');
          dropFolderEl = targets.folderEl;
          if (dropFolderEl) dropFolderEl.classList.add('nav-item-drop-target');
        }

        if (dropCrumbEl !== targets.crumbEl) {
          if (dropCrumbEl) dropCrumbEl.classList.remove('nav-crumb-drop-target');
          dropCrumbEl = targets.crumbEl;
          if (dropCrumbEl) dropCrumbEl.classList.add('nav-crumb-drop-target');
        }

        if (dropDescendEl !== targets.descendEl) {
          if (dropDescendEl) dropDescendEl.classList.remove('nav-drag-descend-active');
          dropDescendEl = targets.descendEl;
        }
        if (dropDescendEl) {
          dropDescendEl.classList.toggle('nav-drag-descend-active', !!hoverFolderId);
        }

        if (dropTrashEl !== targets.trashEl) {
          if (dropTrashEl) dropTrashEl.classList.remove('nav-drag-trash-active');
          dropTrashEl = targets.trashEl;
          if (dropTrashEl) dropTrashEl.classList.add('nav-drag-trash-active');
        }

        // Запоминаем последнюю наведённую папку — её имя показываем в зоне «Спуститься»
        if (targets.folderEl) {
          const folder = nav.byId.get(targets.folderEl.dataset.id);
          if (folder) {
            hoverFolderId = folder.id;
            updateNavDragBar(folder.name);
          }
        }
      }

      function clearTargets() {
        if (dropFolderEl) dropFolderEl.classList.remove('nav-item-drop-target');
        if (dropCrumbEl) dropCrumbEl.classList.remove('nav-crumb-drop-target');
        if (dropDescendEl) dropDescendEl.classList.remove('nav-drag-descend-active');
        if (dropTrashEl) dropTrashEl.classList.remove('nav-drag-trash-active');
        dropFolderEl = dropCrumbEl = dropDescendEl = dropTrashEl = null;
      }

      function moveIntoFolder(sourceId, targetId, openFolder = false) {
        if (!sourceId || !targetId || sourceId === targetId) return false;

        const dragged = nav.byId.get(sourceId);
        const target = nav.byId.get(targetId);
        if (!dragged || !target) return false;
        if (!target.ref || !Array.isArray(target.ref.children)) return false;
        if (dragged.parentId === targetId) return false; // уже в этой папке

        // Папку нельзя положить в саму себя или в своего потомка
        let ancestorId = target.parentId;
        while (ancestorId) {
          if (ancestorId === sourceId) return false;
          ancestorId = nav.byId.get(ancestorId)?.parentId;
        }

        const parentNode = node.ref;
        if (!parentNode || !Array.isArray(parentNode.children)) return false;
        const index = parentNode.children.indexOf(dragged.ref);
        if (index === -1) return false;

        const targetPath = JSON.stringify(target.path);
        parentNode.children.splice(index, 1);
        target.ref.children.push(dragged.ref);

        saveTasksTree(tasksTree);
        setTimeout(() => reloadNav(openFolder ? targetPath : null), 0);
        return true;
      }

      navSortable = Sortable.create(grid, {
        animation: 150,
        sort: false,
        draggable: '.nav-item',
        ghostClass: 'nav-item-ghost',
        chosenClass: 'nav-item-chosen',
        dragClass: 'nav-item-drag',
        delay: 120,
        delayOnTouchOnly: true,
        touchStartThreshold: 4,
        onStart: (evt) => {
          detachNavDragTracking();
          showNavDragBar();
          updateNavDragBar(null);
          clearTargets();
          hoverFolderId = null;
          draggedId = evt.item?.dataset?.id || null;

          const handleMove = (e) => {
            if (e.type === 'dragover') e.preventDefault();
            const point = pointFromEvent(e);
            if (point) updateTargets(point);
          };

          document.addEventListener('dragover', handleMove, { capture: true, passive: false });
          document.addEventListener('pointermove', handleMove, { passive: true });
          document.addEventListener('touchmove', handleMove, { passive: true });

          navDragCleanup = () => {
            document.removeEventListener('dragover', handleMove, true);
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('touchmove', handleMove);
          };
        },
        onEnd: (evt) => {
          suppressClickUntil = Date.now() + 350;
          draggedId = draggedId || evt.item?.dataset?.id || null;

          const originalEvent = evt.originalEvent;
          // Esc / дроп вне окна / отменённый тач — ничего не переносим
          const canceled = (originalEvent?.type === 'dragend' && originalEvent.dropEffect === 'none')
            || originalEvent?.type === 'touchcancel';
          const point = pointFromEvent(originalEvent);
          const targets = point && !canceled ? resolveTargets(point) : null;
          const sourceId = draggedId;
          const descendTargetId = hoverFolderId;

          detachNavDragTracking();
          hideNavDragBar();
          clearTargets();
          draggedId = null;
          hoverFolderId = null;

          if (!sourceId) return;

          // Корзина: удаление с подтверждением
          if (targets?.trashEl) {
            const task = nav.byId.get(sourceId);
            if (task) openDeleteTaskModal(task, () => reloadNav());
            return;
          }

          // «Спуститься»: перенос внутрь папки + открытие этой папки
          if (targets?.descendEl && descendTargetId) {
            moveIntoFolder(sourceId, descendTargetId, true);
            return;
          }

          // Хлебная крошка: перенос в папку-предка
          if (targets?.crumbEl?.dataset.id) {
            moveIntoFolder(sourceId, targets.crumbEl.dataset.id);
            return;
          }

          // Обычный перенос в папку без открытия
          if (targets?.folderEl?.dataset.id) {
            moveIntoFolder(sourceId, targets.folderEl.dataset.id);
          }
        }
      });
    }
  }

  render();
}
