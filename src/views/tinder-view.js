import { buildNavIndex } from '../store.js';
import { getTasksTree, saveTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood, hideTaskForMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';
import { ICONS } from '../utils/icons.js';
import { formatInterval, formatTaskDuration } from '../utils/format-time.js';
import { DEMO_SERIES_ENABLED, SERIES_SEGMENTS, getDemoSeries } from '../utils/demo-series.js';
import { archiveTask, logCompletion } from '../data/archive-store.js';
import { createPriorityResolver } from '../data/mood-priorities.js';
import { applyMetricStyle } from '../utils/metric-style.js';

// Стили для SVG внутри карточки
const style = document.createElement('style');
style.textContent = `
  .tinder-card .tinder-action-btn svg { width: 40px; height: 40px; }
  .tinder-meta svg { width: 18px; height: 18px; }
  .tinder-meta > span { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
  .tinder-meta svg { flex-shrink: 0; }
  .tinder-card .tinder-placeholder svg { width: 120px; height: 120px; }
  .tinder-metric { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .tinder-metric-value {
    display: flex;
    align-items: center;
    height: 34px;
    font-size: 30px;
    font-weight: 800;
    line-height: 1.1;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    transition: opacity 0.3s, text-shadow 0.3s;
  }
  .tinder-metric-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    opacity: 0.72;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }
`;
document.head.appendChild(style);

// Фото рисуется в <canvas>, а не выводится как <img>/background-image:
// браузер не считает canvas изображением и не показывает над ним
// свои hover-панели и «Сохранить изображение».
function drawImageCover(canvas, src) {
  const ctx = canvas.getContext('2d');
  const img = new Image();
  let observer = null;
  let frame = 0;

  function paint() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || !img.naturalWidth) return;

    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }

    // object-fit: cover вручную
    const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;

    ctx.clearRect(0, 0, bw, bh);
    ctx.drawImage(img, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
  }

  img.onload = () => {
    paint();
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(paint);
      });
      observer.observe(canvas);
    }
  };
  img.src = src;

  return () => {
    cancelAnimationFrame(frame);
    if (observer) observer.disconnect();
    img.onload = null;
  };
}

export function renderTinderView() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const nav = buildNavIndex(getTasksTree());
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const themeFilter = activeMood ? getThemeFilter(activeMood.theme) : 'none';
  const isNormalMode = activeMoodId === 'default';
  const priorityResolver = createPriorityResolver(nav, activeMoodId);

  function collectLeaves() {
    const result = [];
    nav.byId.forEach(node => {
      if (node.isLeaf && !isTaskHiddenForMood(activeMoodId, node.id)) result.push(node);
    });

    // Чем выше приоритет — тем раньше задача в Тиндере.
    // При равенстве сохраняем порядок дерева (стабильная сортировка).
    return result.sort((a, b) => (
      priorityResolver.resolve(b.id) - priorityResolver.resolve(a.id)
    ));
  }

  let leaves = collectLeaves();
  let currentIndex = 0;

  // Восстановление позиции
  const savedPath = localStorage.getItem('bonsai-tinder-last-path');
  const savedIndex = localStorage.getItem('bonsai-tinder-restore-index');
  if (savedPath) {
    try {
      const pathArr = JSON.parse(savedPath);
      const idx = leaves.findIndex(l => l.path.join(' / ') === pathArr.join(' / '));
      if (idx !== -1) currentIndex = idx;
      else if (savedIndex) currentIndex = parseInt(savedIndex) || 0;
    } catch (e) {}
    localStorage.removeItem('bonsai-tinder-last-path');
    localStorage.removeItem('bonsai-tinder-restore-index');
  } else if (savedIndex) {
    const idx = parseInt(savedIndex);
    if (!isNaN(idx) && idx < leaves.length) currentIndex = idx;
    localStorage.removeItem('bonsai-tinder-restore-index');
  }

  let isDragging = false;
  let startX = 0;

  function render() {
    if (window.__tinderCleanup) {
      window.__tinderCleanup();
      window.__tinderCleanup = null;
    }

    const leaf = leaves[currentIndex];

    if (!leaf) {
      main.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--text-main); display: flex; flex-direction: column; height: 100%; justify-content: center;">
          <h1 style="font-size: 28px; margin-bottom: 12px;">Все задачи просмотрены!</h1>
          <p style="color: var(--text-secondary); font-size: 16px; margin-bottom: 24px;">Ты молодец.</p>
          <button id="restart-tinder" style="background: var(--accent); color: var(--bg-main); border: none; padding: 12px 24px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin: 0 auto;">Начать сначала</button>
        </div>
      `;
      main.querySelector('#restart-tinder')?.addEventListener('click', () => { currentIndex = 0; render(); });
      return;
    }

    const path = leaf.path.slice(0, -1).join(' / ');
    const series = DEMO_SERIES_ENABLED ? getDemoSeries(leaf.id) : (leaf.series || 0);
    const showSeries = DEMO_SERIES_ENABLED || leaf.type === 'cyclic';
    const leafPriority = priorityResolver.resolve(leaf.id);
    const leafTimeScore = Number.isFinite(leaf.timeScore) ? leaf.timeScore : 5;
    const leafDifficulty = Number.isFinite(leaf.difficulty) ? leaf.difficulty : 5;

    main.innerHTML = `
      <div class="tinder-view" style="position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; background: var(--bg-main);">

        <div id="tinder-card" class="tinder-card" style="position: absolute; inset: 0; display: flex; flex-direction: column; cursor: grab; user-select: none; transition: transform 0.3s ease-out; z-index: 1;">

          <!-- Картинка (до середины кнопок) -->
          <div style="flex: 1; min-height: 0; position: relative; overflow: hidden;">
            ${leaf.image
              ? `<canvas class="tinder-photo-canvas" style="display: block; width: 100%; height: 100%; filter: ${themeFilter}; pointer-events: none; user-select: none; -webkit-user-drag: none;"></canvas>`
              : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; filter: ${themeFilter}; opacity: 0.3;">
                   <span class="tinder-placeholder" style="display: flex;">${ICONS.sprout}</span>
                 </div>`
            }
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 18%; background: linear-gradient(to bottom, transparent, var(--bg-main));"></div>

            <!-- Полоса статистики (на всю ширину карточки) -->
            ${showSeries ? `
              <div style="position: absolute; bottom: 40px; left: 0; right: 0; display: flex; gap: 2px; z-index: 3;">
                ${Array(SERIES_SEGMENTS).fill(0).map((_, i) => {
                  const filled = i < series;
                  return `
                    <div style="flex: 1; height: 8px; background: ${filled ? 'var(--accent)' : 'var(--bg-panel)'}; box-shadow: ${filled ? '0 0 6px color-mix(in srgb, var(--accent) 55%, transparent)' : 'none'};"></div>
                  `;
                }).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Метрики: время — важность — сложность -->
          <div style="position: absolute; top: 56px; left: 0; right: 0; display: flex; justify-content: center; align-items: flex-start; gap: 22px; z-index: 10; pointer-events: none;">
            <div class="tinder-metric" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-main));">
              <span id="tinder-time-value" class="tinder-metric-value">${formatTaskDuration(leaf.duration)}</span>
              <span class="tinder-metric-label">время</span>
            </div>
            <div class="tinder-metric" style="color: var(--accent);">
              <span id="tinder-priority-value" class="tinder-metric-value">${leafPriority.toFixed(1)}</span>
              <span class="tinder-metric-label">важность</span>
            </div>
            <div class="tinder-metric" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-secondary));">
              <span id="tinder-difficulty-value" class="tinder-metric-value">${leafDifficulty.toFixed(1)}</span>
              <span class="tinder-metric-label">сложность</span>
            </div>
          </div>

          <!-- Кнопки (справа) -->
          <div style="position: absolute; top: 16px; right: 16px; z-index: 10; display: flex; gap: 8px; align-items: center;">
            <button id="tinder-edit" style="background: none; border: none; color: var(--text-main); width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">${ICONS.edit}</button>
            <button id="tinder-open-in-nav" style="background: none; border: none; color: var(--text-main); width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">${ICONS.folder}</button>
          </div>

          <!-- Счётчик (слева) -->
          <div style="position: absolute; top: 16px; left: 16px; z-index: 10; height: 36px; display: flex; align-items: center; color: var(--text-main); font-size: 14px; font-weight: 700; letter-spacing: 0.5px; font-variant-numeric: tabular-nums; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
            ${currentIndex + 1}/${leaves.length}
          </div>

          <!-- Нижняя часть (текст) -->
          <div style="flex: 0 0 auto; display: flex; flex-direction: column; padding: 0 16px 16px; background: var(--bg-main); position: relative; z-index: 2;">

            <!-- Кнопки (наполовину поверх картинки) -->
            <div style="display: flex; justify-content: space-evenly; align-items: center; margin-top: -32px; margin-bottom: 8px;">
              <button id="tinder-hide" class="tinder-action-btn" style="background: ${isNormalMode ? 'var(--bg-panel)' : 'var(--danger)'}; border: 3px solid ${isNormalMode ? 'var(--border)' : 'var(--danger)'}; color: var(--text-main); width: 64px; height: 64px; border-radius: 50%; font-size: 24px; cursor: ${isNormalMode ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; justify-content: center; opacity: ${isNormalMode ? '0.3' : '1'}; pointer-events: ${isNormalMode ? 'none' : 'auto'};" title="Скрыть">${ICONS.x}</button>
              <button id="tinder-timer-main" class="tinder-action-btn" style="background: var(--bg-panel); border: 3px solid var(--border); color: var(--text-main); width: 64px; height: 64px; border-radius: 50%; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Таймер">${ICONS.timer}</button>
              <button id="tinder-complete" class="tinder-action-btn" style="background: var(--accent); border: 3px solid var(--accent); color: var(--text-main); width: 64px; height: 64px; border-radius: 50%; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Выполнить">${ICONS.check}</button>
            </div>

            <!-- Текст -->
            <h2 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${leaf.name}</h2>
            <div class="tinder-meta" style="display: flex; gap: 12px; font-size: 14px; color: var(--text-secondary); align-items: center; margin-bottom: 8px;">
              <span title="${leaf.type === 'cyclic' ? 'Циклическая' : 'Одноразовая'}">${leaf.type === 'cyclic' ? ICONS.cyclic : ICONS.single}</span>
              ${leaf.deadline ? `<span style="color: var(--accent);" title="Дедлайн">${ICONS.calendar} ${leaf.deadline}</span>` : ''}
              ${leaf.interval ? `<span style="color: var(--accent);" title="Интервал">${ICONS.timer} ${formatInterval(leaf.interval.totalMinutes)}</span>` : ''}
            </div>
            <div style="font-size: 13px; line-height: 1.3; min-height: 1.3em; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 6px;">${path}</div>
            <p style="font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.35; height: 4.05em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;">${leaf.desc || ''}</p>
          </div>
        </div>
      </div>
    `;

    // ===== Свайпы =====
    const card = main.querySelector('#tinder-card');
    if (card) {
      card.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isDragging = true; });
      card.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        card.style.transform = `translateX(${e.touches[0].clientX - startX}px)`;
      });
      card.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const dx = e.changedTouches[0].clientX - startX;
        isDragging = false;
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
      card.addEventListener('mousedown', (e) => { startX = e.clientX; isDragging = true; card.style.cursor = 'grabbing'; });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        card.style.transform = `translateX(${e.clientX - startX}px)`;
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
      const keyHandler = (e) => {
        if (e.key === 'ArrowLeft') { card.style.transform = 'translateX(-500px)'; setTimeout(() => { if (currentIndex > 0) currentIndex--; render(); }, 300); }
        else if (e.key === 'ArrowRight') { card.style.transform = 'translateX(500px)'; setTimeout(() => { if (currentIndex < leaves.length - 1) currentIndex++; render(); }, 300); }
      };
      document.addEventListener('keydown', keyHandler);
      window.__tinderCleanup = () => document.removeEventListener('keydown', keyHandler);
    }

    // ===== Фото (canvas) =====
    const photoCanvas = main.querySelector('.tinder-photo-canvas');
    if (photoCanvas && leaf.image) {
      const stopPhoto = drawImageCover(photoCanvas, leaf.image);
      const prevCleanup = window.__tinderCleanup;
      window.__tinderCleanup = () => {
        stopPhoto();
        if (prevCleanup) prevCleanup();
      };
    }

    // ===== Кнопки =====
    main.querySelector('#tinder-complete')?.addEventListener('click', (e) => {
      e.stopPropagation();
      logCompletion(leaf, activeMoodId);
      if (leaf.type === 'single') {
        archiveTask(leaf, activeMoodId);
        const tree = getTasksTree();
        function removeFromNode(node, targetName) {
          if (node.children) {
            const idx = node.children.findIndex(c => c.name === targetName);
            if (idx !== -1) { node.children.splice(idx, 1); return true; }
            for (const child of node.children) { if (removeFromNode(child, targetName)) return true; }
          }
          return false;
        }
        removeFromNode(tree, leaf.name);
        saveTasksTree(tree);
        leaves = collectLeaves();
        if (currentIndex >= leaves.length) currentIndex = Math.max(0, leaves.length - 1);
        render();
      } else {
        if (currentIndex < leaves.length - 1) currentIndex++;
        render();
      }
    });

    main.querySelector('#tinder-hide')?.addEventListener('click', (e) => {
      e.stopPropagation();
      hideTaskForMood(activeMoodId, leaf.id);
      leaves = collectLeaves();
      if (currentIndex >= leaves.length) currentIndex = Math.max(0, leaves.length - 1);
      render();
    });

    main.querySelector('#tinder-open-in-nav')?.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('bonsai-tinder-last-path', JSON.stringify(leaf.path));
      import('../router.js').then(m => m.showMainView('navigation'));
    });

    main.querySelector('#tinder-edit')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const savedPath = JSON.stringify(leaf.path);
      const savedIndex = currentIndex;
      import('./task-modal.js').then(({ openEditTaskModal }) => {
        openEditTaskModal(leaf, () => {
          localStorage.setItem('bonsai-tinder-last-path', savedPath);
          localStorage.setItem('bonsai-tinder-restore-index', String(savedIndex));
          renderTinderView();
        });
      });
    });

    main.querySelector('#tinder-timer-main')?.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('Таймер в разработке');
    });

    // Все три метрики визуально одинаковы: высота, прозрачность и свечение по величине.
    applyMetricStyle(main.querySelector('#tinder-time-value'), leafTimeScore);
    applyMetricStyle(main.querySelector('#tinder-priority-value'), leafPriority);
    applyMetricStyle(main.querySelector('#tinder-difficulty-value'), leafDifficulty);
  }

  render();
}
