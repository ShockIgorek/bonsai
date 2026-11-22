import { buildNavIndex } from '../store.js';
import { getTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood, hideTaskForMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';

/**
 * Тиндер: карточки с задачами, свайпы для пролистывания,
 * кнопки "Выполнить" и "Скрыть".
 */
export function renderTinderView() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const nav = buildNavIndex(getTasksTree());

  // Активное настроение
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const themeFilter = activeMood ? getThemeFilter(activeMood.theme) : 'none';
  const isNormalMode = activeMoodId === 'default'; // В "Норма" крестик не показываем

  // Функция сбора листьев (исключая скрытые)
  function collectLeaves() {
    const result = [];
    nav.byId.forEach(node => {
      if (node.isLeaf) {
        if (!isTaskHiddenForMood(activeMoodId, node.id)) {
          result.push(node);
        }
      }
    });
    return result;
  }

  // Текущий список листьев
  let leaves = collectLeaves();

  // Состояние
  let currentIndex = 0;

  // Восстанавливаем позицию из localStorage (если возвращаемся)
  const savedPathForRestore = localStorage.getItem('bonsai-tinder-last-path');
  if (savedPathForRestore) {
    try {
      const pathArr = JSON.parse(savedPathForRestore);
      const pathStr = pathArr.join(' / ');
      const idx = leaves.findIndex(l => l.path.join(' / ') === pathStr);
      if (idx !== -1) {
        currentIndex = idx;
      }
    } catch (e) {}
    localStorage.removeItem('bonsai-tinder-last-path');
  }
  let startX = 0;
  let isDragging = false;
  let currentTranslate = 0;

  function render() {
    // Убираем старый обработчик клавиатуры, если был
    if (window.__tinderCleanup) {
      window.__tinderCleanup();
      window.__tinderCleanup = null;
    }
    const leaf = leaves[currentIndex];

    if (!leaf) {
      main.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-main); display: flex; flex-direction: column; height: 100%; justify-content: center;">
          <h1 style="font-size: 28px; margin-bottom: 12px;">🎉 Все задачи просмотрены!</h1>
          <p style="color: var(--text-secondary); font-size: 16px; margin-bottom: 24px;">Ты молодец.</p>
          <button id="restart-tinder" style="
            background: var(--accent);
            color: var(--bg-main);
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            margin: 0 auto;
          ">
            Начать сначала
          </button>
        </div>
      `;
      main.querySelector('#restart-tinder')?.addEventListener('click', () => {
        currentIndex = 0;
        render();
      });
      return;
    }

    const path = leaf.path.join(' / ');

    main.innerHTML = `
      <div class="tinder-view" style="padding: 16px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; align-items: center; justify-content: center; position: relative;">

        <!-- Карточка -->
        <div id="tinder-card" class="tinder-card" style="
          position: relative;
          width: 100%;
          max-width: 320px;
          background: var(--bg-card);
          border: 2px solid var(--border);
          border-radius: 24px;
          padding: 32px 20px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
          touch-action: pan-y;
          cursor: grab;
          user-select: none;
          transition: transform 0.3s ease, opacity 0.3s ease;
        ">
          <!-- Кнопка "Открыть в проводнике" -->
          <button id="tinder-open-in-nav" style="
            position: absolute;
            top: 12px;
            right: 12px;
            background: var(--bg-panel);
            border: 1px solid var(--border);
            color: var(--text-main);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 18px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
          " title="Открыть в проводнике">📁</button>

          <!-- Заглушка-картинка (с фильтром темы) -->
          <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--bg-panel); display: flex; align-items: center; justify-content: center; font-size: 56px; filter: ${themeFilter}; margin-bottom: 8px;">
            🌱
          </div>

          <!-- Название -->
          <h2 style="font-size: 22px; font-weight: 800; text-align: center; margin: 0; color: var(--text-main);">
            ${leaf.name}
          </h2>

          <!-- Описание -->
          ${leaf.desc ? `<p style="font-size: 14px; color: var(--text-secondary); text-align: center; margin: 0; line-height: 1.4;">${leaf.desc}</p>` : ''}

          <!-- Путь -->
          <div style="font-size: 12px; color: var(--text-muted); text-align: center;">
            ${path}
          </div>

          <!-- Приоритет (заглушка 5.0) -->
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            Приоритет: 5.0 / 10.0
          </div>
        </div>

        <!-- Кнопки -->
        <div style="display: flex; gap: 16px; margin-top: 24px; align-items: center;">
          <!-- Скрыть (крестик) — только не в Норме -->
          ${!isNormalMode ? `
          <button id="tinder-hide" style="
            background: var(--bg-panel);
            border: 2px solid var(--border);
            color: #e5484d;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          " title="Скрыть для этого настроения">❌</button>
          ` : ''}

          <!-- Выполнить (галочка) -->
          <button id="tinder-complete" style="
            background: var(--bg-panel);
            border: 2px solid var(--border);
            color: #30a46c;
            width: 64px;
            height: 64px;
            border-radius: 50%;
            font-size: 26px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          " title="Выполнить">✅</button>

          <!-- Пропустить (листнуть) -->
          <button id="tinder-skip" style="
            background: var(--bg-panel);
            border: 2px solid var(--border);
            color: var(--text-muted);
            width: 56px;
            height: 56px;
            border-radius: 50%;
            font-size: 20px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          " title="Пропустить">⏭️</button>
        </div>

        <div style="font-size: 12px; color: var(--text-muted); margin-top: 16px;">
          ${currentIndex + 1} из ${leaves.length}
        </div>
      </div>
    `;

    // ===== Свайпы (touch/mouse) =====
    const card = main.querySelector('#tinder-card');
    if (card) {
      // Touch
      card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
      });
      card.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const dx = e.touches[0].clientX - startX;
        card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
      });
      card.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const dx = e.changedTouches[0].clientX - startX;
        isDragging = false;
        card.style.transition = 'transform 0.3s ease';
        if (Math.abs(dx) > 80) {
          // Свайп влево/вправо — просто листаем
          card.style.transform = `translateX(${dx > 0 ? 400 : -400}px) rotate(${dx > 0 ? 20 : -20}deg)`;
          setTimeout(() => {
            currentIndex++;
            render();
          }, 200);
        } else {
          // Возвращаем на место
          card.style.transform = 'translateX(0) rotate(0)';
        }
      });

      // Mouse (для ПК)
      card.addEventListener('mousedown', (e) => {
        startX = e.clientX;
        isDragging = true;
        card.style.cursor = 'grabbing';
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        card.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
      });
      window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        isDragging = false;
        card.style.cursor = 'grab';
        card.style.transition = 'transform 0.3s ease';
        if (Math.abs(dx) > 80) {
          card.style.transform = `translateX(${dx > 0 ? 400 : -400}px) rotate(${dx > 0 ? 20 : -20}deg)`;
          setTimeout(() => {
            currentIndex++;
            render();
          }, 200);
        } else {
          card.style.transform = 'translateX(0) rotate(0)';
        }
      });

      // Стрелки клавиатуры (для ПК)
      const keyHandler = (e) => {
        if (e.key === 'ArrowLeft') {
          card.style.transform = 'translateX(-400px) rotate(-20deg)';
          card.style.opacity = '0';
          setTimeout(() => {
            currentIndex++;
            render();
          }, 300);
        } else if (e.key === 'ArrowRight') {
          card.style.transform = 'translateX(400px) rotate(20deg)';
          card.style.opacity = '0';
          setTimeout(() => {
            currentIndex++;
            render();
          }, 300);
        }
      };
      document.addEventListener('keydown', keyHandler);
      
      // Убираем обработчик при перерисовке (чтобы не плодить)
      const cleanup = () => {
        document.removeEventListener('keydown', keyHandler);
      };
      // Сохраняем cleanup в глобальной переменной для вызова при следующем рендере
      window.__tinderCleanup = cleanup;
    }

    // ===== Кнопки =====

    // Открыть текущую задачу в проводнике (Навигация)
    main.querySelector('#tinder-open-in-nav')?.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('bonsai-tinder-last-path', JSON.stringify(leaf.path));
      import('../router.js').then(m => m.showMainView('navigation'));
    });

    main.querySelector('#tinder-skip')?.addEventListener('click', () => {
      currentIndex++;
      render();
    });

    main.querySelector('#tinder-complete')?.addEventListener('click', () => {
      // TODO: удалить одноразовую / снизить приоритет цикличной
      // Пока просто листаем
      currentIndex++;
      render();
    });

    main.querySelector('#tinder-hide')?.addEventListener('click', () => {
      hideTaskForMood(activeMoodId, leaf.id);
      // Пересобираем список (задача исчезла)
      leaves = collectLeaves();
      // Если текущий индекс вышел за пределы — сбрасываем на последний
      if (currentIndex >= leaves.length) {
        currentIndex = Math.max(0, leaves.length - 1);
      }
      render();
    });
  }

  render();
}
