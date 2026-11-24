import { buildNavIndex } from '../store.js';
import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood, hideTaskForMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';
import { ICONS } from '../utils/icons.js';
import { formatInterval } from '../utils/format-time.js';

// Стиль для SVG в кнопках (больше)
const style = document.createElement('style');
style.textContent = '.tinder-card button svg { width: 40px; height: 40px; }';
document.head.appendChild(style);
import { archiveTask, logCompletion } from '../data/archive-store.js';

export function renderTinderView() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const nav = buildNavIndex(getTasksTree());

  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const themeFilter = activeMood ? getThemeFilter(activeMood.theme) : 'none';
  const isNormalMode = activeMoodId === 'default';

  function collectLeaves() {
    const result = [];
    nav.byId.forEach(node => {
      if (node.isLeaf && !isTaskHiddenForMood(activeMoodId, node.id)) {
        result.push(node);
      }
    });
    return result;
  }

  let leaves = collectLeaves();
  let currentIndex = 0;

  const savedPathForRestore = localStorage.getItem('bonsai-tinder-last-path');
  const savedIndexForRestore = localStorage.getItem('bonsai-tinder-restore-index');
  
  if (savedPathForRestore) {
    try {
      const pathArr = JSON.parse(savedPathForRestore);
      const pathStr = pathArr.join(' / ');
      const idx = leaves.findIndex(l => l.path.join(' / ') === pathStr);
      if (idx !== -1) {
        currentIndex = idx;
      } else if (savedIndexForRestore) {
        // Если путь не нашли — используем индекс
        const fallbackIdx = parseInt(savedIndexForRestore);
        if (!isNaN(fallbackIdx) && fallbackIdx < leaves.length) {
          currentIndex = fallbackIdx;
        }
      }
    } catch (e) {}
    localStorage.removeItem('bonsai-tinder-last-path');
    localStorage.removeItem('bonsai-tinder-restore-index');
  } else if (savedIndexForRestore) {
    const fallbackIdx = parseInt(savedIndexForRestore);
    if (!isNaN(fallbackIdx) && fallbackIdx < leaves.length) {
      currentIndex = fallbackIdx;
    }
    localStorage.removeItem('bonsai-tinder-restore-index');
  }



  let isDragging = false;
  let startX = 0;

  function render() {
    const leaf = leaves[currentIndex];

    if (!leaf) {
      main.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-main); display: flex; flex-direction: column; height: 100%; justify-content: center;">
          <h1 style="font-size: 28px; margin-bottom: 12px;">🎉 Все задачи просмотрены!</h1>
          <p style="color: var(--text-secondary); font-size: 16px; margin-bottom: 24px;">Ты молодец.</p>
          <button id="restart-tinder" style="background: var(--accent); color: var(--bg-main); border: none; padding: 12px 24px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin: 0 auto;">Начать сначала</button>
        </div>
      `;
      main.querySelector('#restart-tinder')?.addEventListener('click', () => { currentIndex = 0; render(); });
      return;
    }

    const path = leaf.path.slice(0, -1).join(' / ');

    main.innerHTML = `
      <div class="tinder-view" style="position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; box-sizing: border-box;">
        
        <!-- Карточка на весь экран -->
        <div id="tinder-card" class="tinder-card" style="
          position: absolute;
          inset: 0;
          background: var(--bg-card);
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          cursor: grab;
          user-select: none;
          transition: transform 0.3s ease-out;
          z-index: 1;
        ">
          <!-- Кнопка "Папка" в правом верхнем углу -->
          <button id="tinder-open-in-nav" style="
            position: absolute;
            top: 16px;
            right: 16px;
            z-index: 10;
            background: rgba(0,0,0,0.5);
            border: none;
            color: white;
            width: 40px; height: 40px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          " title="Открыть в проводнике">${ICONS.folder}</button>
          
          <!-- Кнопка "Редактировать" (карандаш) -->
          <button id="tinder-edit" style="
            position: absolute;
            top: 16px;
            right: 64px;
            z-index: 10;
            background: rgba(0,0,0,0.5);
            border: none;
            color: white;
            width: 40px; height: 40px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          " title="Редактировать задачу">${ICONS.edit}</button>

          <!-- Счётчик в левом верхнем углу -->
          <div style="position: absolute; top: 16px; left: 16px; z-index: 10; background: rgba(0,0,0,0.5); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
            ${currentIndex + 1} / ${leaves.length}
          </div>

          <!-- Картинка (если есть) или заглушка -->
          ${leaf.image
            ? `<img src="${leaf.image}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: ${themeFilter};" />`
            : `<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 120px; filter: ${themeFilter}; opacity: 0.3;">🌱</div>`
          }

          <!-- Кнопки на фиксированной позиции (70% высоты) -->
          <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; padding: 0 24px 24px 24px; display: flex; flex-direction: column; gap: 16px;">
            
            <!-- Кнопки (внутри карточки, но фиксированы по высоте) -->
          <div style="position: absolute; bottom: 155px; left: 0; right: 0; z-index: 20; padding: 0 24px; display: flex; justify-content: space-around;">
            <button id="tinder-hide" style="
              background: ${isNormalMode ? 'rgba(255,255,255,0.1)' : '#e5484d'};
              border: 3px solid ${isNormalMode ? 'rgba(255,255,255,0.2)' : '#e5484d'};
              color: white;
              width: 70px; height: 70px;
              border-radius: 50%;
              font-size: 24px;
              cursor: ${isNormalMode ? 'not-allowed' : 'pointer'};
              display: flex; align-items: center; justify-content: center;
              opacity: ${isNormalMode ? '0.3' : '1'};
              pointer-events: ${isNormalMode ? 'none' : 'auto'};
            " title="Скрыть">${ICONS.x}</button>

            <button id="tinder-complete" style="
              background: var(--accent);
              border: 3px solid var(--accent);
              color: white;
              width: 70px; height: 70px;
              border-radius: 50%;
              font-size: 24px;
              cursor: pointer;
              display: flex; align-items: center; justify-content: center;
            " title="Выполнить">${ICONS.check}</button>
          </div>

          <!-- Кнопка "Добавить фото" (если нет картинки) -->
          ${!leaf.image ? `
            <button id="tinder-add-photo" style="
              position: absolute;
              bottom: 200px;
              left: 50%;
              transform: translateX(-50%);
              z-index: 20;
              background: rgba(0,0,0,0.6);
              border: 1px dashed rgba(255,255,255,0.5);
              color: white;
              padding: 10px 20px;
              border-radius: 20px;
              font-size: 14px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 8px;
            ">📷 Добавить фото</button>
          ` : ''}

          <!-- Текст (с обрезкой) -->
            <div style="background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); padding: 16px 0 0 0;">
              <h2 style="font-size: 28px; font-weight: 800; color: white; margin: 0 0 8px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${leaf.name}</h2>
              ${leaf.desc ? `<p style="font-size: 15px; color: rgba(255,255,255,0.9); margin: 0 0 8px 0; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${leaf.desc}</p>` : ''}
              
              <!-- Тип задачи и приоритет (SVG) -->
              <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 14px; color: var(--text-secondary); align-items: center;">
                <span style="display: flex; align-items: center; gap: 4px; width: 20px; height: 20px;">
                  ${leaf.type === 'cyclic' ? ICONS.cyclic : ICONS.single}
                </span>
                <span>⭐ ${leaf.priority !== undefined ? leaf.priority.toFixed(1) : '5.0'}</span>
                ${leaf.deadline ? `<span style="color: var(--accent);">📅 ${leaf.deadline}</span>` : ''}
                ${leaf.interval ? `<span style="color: var(--accent);">⏱️ ${formatInterval(leaf.interval.totalMinutes)}</span>` : ''}
              </div>
              <div style="font-size: 13px; color: rgba(255,255,255,0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${path}</div>
            </div>
          </div>
        </div>

      </div>
    `;

    // ===== Свайпы (без поворотов) =====
    const card = main.querySelector('#tinder-card');
    if (card) {
      card.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isDragging = true; });
      card.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        card.style.transform = `translateX(${dx}px)`;
      });
      card.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const dx = e.changedTouches[0].clientX - startX;
        isDragging = false;
        card.style.transition = 'transform 0.3s ease-out';
        if (Math.abs(dx) > 80) {
          // Свайп влево (dx < 0) — вперёд, вправо (dx > 0) — назад
          card.style.transform = `translateX(${dx > 0 ? 500 : -500}px)`;
          setTimeout(() => {
            if (dx < 0 && currentIndex < leaves.length - 1) currentIndex++;
            else if (dx > 0 && currentIndex > 0) currentIndex--;
            render();
          }, 200);
        } else {
          card.style.transform = 'translateX(0)';
        }
      });

      card.addEventListener('mousedown', (e) => { startX = e.clientX; isDragging = true; card.style.cursor = 'grabbing'; });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        card.style.transform = `translateX(${dx}px)`;
      });
      window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        isDragging = false;
        card.style.cursor = 'grab';
        card.style.transition = 'transform 0.3s ease-out';
        if (Math.abs(dx) > 80) {
          card.style.transform = `translateX(${dx > 0 ? 500 : -500}px)`;
          setTimeout(() => {
            if (dx < 0 && currentIndex < leaves.length - 1) currentIndex++;
            else if (dx > 0 && currentIndex > 0) currentIndex--;
            render();
          }, 200);
        } else {
          card.style.transform = 'translateX(0)';
        }
      });

      // Стрелки клавиатуры обрабатываются ГЛОБАЛЬНО (ниже), без дублей
    }

    // ===== Кнопки =====
    const btnComplete = main.querySelector('#tinder-complete');
    const btnHide = main.querySelector('#tinder-hide');
    const btnOpenNav = main.querySelector('#tinder-open-in-nav');

    if (btnComplete) {
      btnComplete.onclick = (e) => {
        e.stopPropagation();

        // Логируем выполнение
        logCompletion(leaf, activeMoodId);

        if (leaf.type === 'single') {
          // Одноразовая: архивируем и удаляем из дерева
          archiveTask(leaf, activeMoodId);

          const tree = getTasksTree();
          function removeFromNode(node, targetName) {
            if (node.children) {
              const idx = node.children.findIndex(c => c.name === targetName);
              if (idx !== -1) {
                node.children.splice(idx, 1);
                return true;
              }
              for (const child of node.children) {
                if (removeFromNode(child, targetName)) return true;
              }
            }
            return false;
          }
          removeFromNode(tree, leaf.name);
          saveTasksTree(tree);

          // Пересобираем листья и перерисовываем
          leaves = collectLeaves();
          if (currentIndex >= leaves.length) currentIndex = Math.max(0, leaves.length - 1);
          render();
        } else {
          // Циклическая: пока просто листаем (следующим шагом сделаем КД)
          if (currentIndex < leaves.length - 1) currentIndex++;
          render();
        }
      };
    }

    if (btnHide) {
      btnHide.onclick = () => {
        hideTaskForMood(activeMoodId, leaf.id);
        leaves = collectLeaves();
        if (currentIndex >= leaves.length) currentIndex = Math.max(0, leaves.length - 1);
        render();
      };
    }

    if (btnOpenNav) {
      btnOpenNav.onclick = (e) => {
        e.stopPropagation();
        localStorage.setItem('bonsai-tinder-last-path', JSON.stringify(leaf.path));
        import('../router.js').then(m => m.showMainView('navigation'));
      };
    }

    // Редактировать (карандаш)
    const btnEdit = main.querySelector('#tinder-edit');
    if (btnEdit) {
      btnEdit.onclick = (e) => {
        e.stopPropagation();
        // Запоминаем и путь, и индекс
        const savedPath = JSON.stringify(leaf.path);
        const savedIndex = currentIndex;
        import('./task-modal.js').then(({ openEditTaskModal }) => {
          openEditTaskModal(leaf, () => {
            localStorage.setItem('bonsai-tinder-last-path', savedPath);
            localStorage.setItem('bonsai-tinder-restore-index', String(savedIndex));
            renderTinderView();
          });
        });
      };
    }

    // Добавить фото
    const btnAddPhoto = main.querySelector('#tinder-add-photo');
    if (btnAddPhoto) {
      btnAddPhoto.onclick = (e) => {
        e.stopPropagation();
        // Открываем выбор файла
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const imageData = event.target.result;
            // Сохраняем картинку в задачу
            const tree = getTasksTree();
            function addImageToNode(node, targetName) {
              if (node.name === targetName) {
                node.image = imageData;
                return true;
              }
              if (node.children) {
                for (const child of node.children) {
                  if (addImageToNode(child, targetName)) return true;
                }
              }
              return false;
            }
            addImageToNode(tree, leaf.name);
            saveTasksTree(tree);
            renderTinderView(); // перерисовываем
          };
          reader.readAsDataURL(file);
        };
        fileInput.click();
      };
    }
  }

  // Глобальный обработчик стрелок (один раз)
  const globalKeyHandler = (e) => {
    if (e.key === 'ArrowLeft') {
      const card = document.querySelector('#tinder-card');
      if (card) {
        card.style.transform = 'translateX(-500px)';
        setTimeout(() => {
          if (currentIndex > 0) currentIndex--;
          render();
        }, 300);
      }
    } else if (e.key === 'ArrowRight') {
      const card = document.querySelector('#tinder-card');
      if (card) {
        card.style.transform = 'translateX(500px)';
        setTimeout(() => {
          if (currentIndex < leaves.length - 1) currentIndex++;
          render();
        }, 300);
      }
    }
  };
  
  // Удаляем старый глобальный обработчик, если был
  if (window.__tinderGlobalKey) {
    document.removeEventListener('keydown', window.__tinderGlobalKey);
  }
  document.addEventListener('keydown', globalKeyHandler);
  window.__tinderGlobalKey = globalKeyHandler;

  render();
}
