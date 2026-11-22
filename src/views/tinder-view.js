import { buildNavIndex } from '../store.js';
import { getTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood, hideTaskForMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';

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
  if (savedPathForRestore) {
    try {
      const pathArr = JSON.parse(savedPathForRestore);
      const pathStr = pathArr.join(' / ');
      const idx = leaves.findIndex(l => l.path.join(' / ') === pathStr);
      if (idx !== -1) currentIndex = idx;
    } catch (e) {}
    localStorage.removeItem('bonsai-tinder-last-path');
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
          " title="Открыть в проводнике">📁</button>

          <!-- Счётчик в левом верхнем углу -->
          <div style="position: absolute; top: 16px; left: 16px; z-index: 10; background: rgba(0,0,0,0.5); color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">
            ${currentIndex + 1} / ${leaves.length}
          </div>

          <!-- Картинка (заглушка на фоне) -->
          <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 120px; filter: ${themeFilter}; opacity: 0.3;">
            🌱
          </div>

          <!-- Кнопки на фиксированной позиции (70% высоты) -->
          <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; padding: 0 24px 24px 24px; display: flex; flex-direction: column; gap: 16px;">
            
            <!-- Кнопки (внутри карточки, но фиксированы по высоте) -->
          <div style="position: absolute; bottom: 140px; left: 0; right: 0; z-index: 20; padding: 0 24px; display: flex; justify-content: space-between;">
            <button id="tinder-hide" style="
              background: ${isNormalMode ? 'rgba(255,255,255,0.1)' : '#e5484d'};
              border: 2px solid ${isNormalMode ? 'rgba(255,255,255,0.2)' : '#e5484d'};
              color: white;
              width: 56px; height: 56px;
              border-radius: 50%;
              font-size: 22px;
              cursor: pointer;
              display: flex; align-items: center; justify-content: center;
              opacity: ${isNormalMode ? '0.3' : '1'};
              pointer-events: ${isNormalMode ? 'none' : 'auto'};
            " title="Скрыть">❌</button>

            <button id="tinder-complete" style="
              background: #30a46c;
              border: none;
              color: white;
              width: 56px; height: 56px;
              border-radius: 50%;
              font-size: 22px;
              cursor: pointer;
              display: flex; align-items: center; justify-content: center;
            " title="Выполнить">✅</button>
          </div>

          <!-- Текст (с обрезкой) -->
            <div style="background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); padding: 16px 0 0 0;">
              <h2 style="font-size: 28px; font-weight: 800; color: white; margin: 0 0 8px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${leaf.name}</h2>
              ${leaf.desc ? `<p style="font-size: 15px; color: rgba(255,255,255,0.9); margin: 0 0 8px 0; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${leaf.desc}</p>` : ''}
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
          // Свайп влево — назад, вправо — вперёд
          const direction = dx > 0 ? -1 : 1;
          card.style.transform = `translateX(${dx > 0 ? 500 : -500}px)`;
          setTimeout(() => {
            if (direction === 1 && currentIndex < leaves.length - 1) currentIndex++;
            else if (direction === -1 && currentIndex > 0) currentIndex--;
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
          const direction = dx > 0 ? -1 : 1;
          card.style.transform = `translateX(${dx > 0 ? 500 : -500}px)`;
          setTimeout(() => {
            if (direction === 1 && currentIndex < leaves.length - 1) currentIndex++;
            else if (direction === -1 && currentIndex > 0) currentIndex--;
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
        e.stopPropagation(); // не даём клику всплыть до карточки
        console.log('КЛИК ✅, currentIndex ДО:', currentIndex);
        if (currentIndex < leaves.length - 1) currentIndex++;
        console.log('КЛИК ✅, currentIndex ПОСЛЕ:', currentIndex);
        render();
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
