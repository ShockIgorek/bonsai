import { buildNavIndex } from '../store.js';
import { getTasksTree } from '../data/tasks-store.js';
import { getMoods, isTaskHiddenForMood, hideTaskForMood } from '../data/moods-store.js';
import { getThemeFilter } from '../utils/theme-filter.js';
import { ICONS } from '../utils/icons.js';
import { formatInterval, formatTaskDuration, formatCountdown, formatLastCompleted, formatShortDateTime } from '../utils/format-time.js';
import { createPriorityResolver } from '../data/mood-priorities.js';
import { applyMetricStyle } from '../utils/metric-style.js';
import { getCooldownState, getLastCompletionAt, getDifficultyRatings } from '../logic/cyclic-schedule.js';
import { getDisplayStreakSegments } from '../logic/streak.js';
import { getMoodSorting, scoreTask } from '../logic/tinder-ranking.js';
import { getAverageActualMinutes } from '../logic/task-time.js';
import { cooldownPercent, cooldownSweepDegrees, cooldownShadeBackground } from '../utils/cooldown-display.js';
import { getTimerForTask, getTimers, stopTimer } from '../data/timer-store.js';
import { completeSingleTask } from '../data/archive-store.js';
import { isQuotaError } from '../utils/media-compaction.js';

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
  .tinder-metric-source {
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    opacity: 0.85;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }
  .tinder-metric-source.is-fact { color: var(--accent); }
  .tinder-metric-source.is-calibrated { color: var(--text-secondary); }
  .tinder-metric-source.is-estimate { color: var(--text-muted); }
  @keyframes tinderTimerRunPulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 55%, transparent); }
    50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--accent) 0%, transparent); }
  }
  @keyframes tinderTimerPausePulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 35%, transparent); }
    50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 0%, transparent); }
  }
  .tinder-timer-btn.is-running { animation: tinderTimerRunPulse 1.4s ease-out infinite; }
  .tinder-timer-btn.is-paused { animation: tinderTimerPausePulse 2.2s ease-in-out infinite; }
  .tinder-bonus-badge {
    display: inline-block;
    max-width: 100%;
    box-sizing: border-box;
    margin-bottom: 5px;
    padding: 2px 8px;
    border: 1px solid var(--accent);
    border-radius: 7px;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1px;
    line-height: 1.3;
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

function renderStreakSegments(statuses) {
  return statuses.map(state => {
    const filled = state === 'full' || state === 'weak';
    const background = filled ? 'var(--accent)' : 'var(--bg-panel)';
    const opacity = state === 'weak' ? '0.35' : (state === 'missed' ? '0.45' : '1');
    const shadow = state === 'full'
      ? '0 0 6px color-mix(in srgb, var(--accent) 55%, transparent)'
      : 'none';

    return `<div style="flex: 1; height: 8px; background: ${background}; opacity: ${opacity}; box-shadow: ${shadow};"></div>`;
  }).join('');
}

export function renderTinderView() {
  const main = document.getElementById('main-content');
  if (!main) return;

  let nav = buildNavIndex(getTasksTree());
  const moods = getMoods();
  const activeMoodId = localStorage.getItem('bonsai-active-mood') || 'default';
  const activeMood = moods.find(m => m.id === activeMoodId) || moods[0];
  const themeFilter = activeMood ? getThemeFilter(activeMood.theme) : 'none';
  const isNormalMode = activeMoodId === 'default';
  let priorityResolver = createPriorityResolver(nav, activeMoodId);
  let sorting = getMoodSorting(activeMood);

  function collectLeaves() {
    const result = [];
    nav.byId.forEach(node => {
      if (node.isLeaf && !isTaskHiddenForMood(activeMoodId, node.id)) result.push(node);
    });

    // Взвешенная релевантность: важность + скорость + сложность.
    // Кулдаун умножает её на 0..1, восстановленная задача получает бонус 1.25.
    // Задачи с таймером на паузе всегда поднимаются в начало колоды.
    const now = Date.now();
    const pausedIds = new Set(
      getTimers()
        .filter(timer => timer.isPaused)
        .map(timer => timer.taskId)
    );

    const score = task => {
      const base = scoreTask({
        importance: priorityResolver.resolve(task.id),
        timeScore: task.sortTimeScore !== null && task.sortTimeScore !== undefined
          ? task.sortTimeScore
          : task.timeScore,
        difficulty: task.difficulty
      }, sorting);

      const value = base * getCooldownState(task, now).multiplier;
      return pausedIds.has(task.id) ? 1000 + value : value;
    };

    return result.sort((a, b) => score(b) - score(a));
  }

  let leaves = collectLeaves();
  let currentIndex = 0;

  function pathKeyOf(leaf) {
    return leaf ? leaf.path.join(' / ') : null;
  }

  /**
   * Ставит текущую карточку на её место в отсортированной колоде.
   * Так она не «прыгает» под пальцем, а следующая карточка всегда
   * берётся из актуального порядка остальных задач.
   */
  function pinCurrentCard(sortedLeaves, currentPath, pinnedIndex, currentId = null) {
    const current = currentId
      ? sortedLeaves.find(l => l.id === currentId)
      : (currentPath ? sortedLeaves.find(l => pathKeyOf(l) === currentPath) : null);

    if (!current) {
      leaves = sortedLeaves;
      currentIndex = Math.min(pinnedIndex, Math.max(0, leaves.length - 1));
      return;
    }

    const rest = sortedLeaves.filter(l => l.id !== current.id);
    rest.splice(Math.min(pinnedIndex, rest.length), 0, current);
    leaves = rest;
    currentIndex = Math.min(pinnedIndex, leaves.length - 1);
  }

  /**
   * Пересобирает колоду после выполнения: выполненная карточка
   * уходит в конец, а показывается следующая за ней.
   */
  function advanceAfterCompletion(completedId, nextId) {
    nav = buildNavIndex(getTasksTree());
    priorityResolver = createPriorityResolver(nav, activeMoodId);
    leaves = collectLeaves();

    const completedIndex = leaves.findIndex(l => l.id === completedId);
    if (completedIndex !== -1) {
      const [completed] = leaves.splice(completedIndex, 1);
      leaves.push(completed);
    }

    if (nextId) {
      const nextIndex = leaves.findIndex(l => l.id === nextId);
      currentIndex = nextIndex !== -1 ? nextIndex : 0;
    } else {
      // Выполненная была последней — начинаем колоду заново.
      currentIndex = 0;
    }
  }

  /**
   * Обновляет порядок колоды раз в минуту, не переключая карточку.
   */
  function resortLeaves() {
    if (!leaves.length) return;
    const current = leaves[currentIndex];
    pinCurrentCard(collectLeaves(), pathKeyOf(current), currentIndex, current ? current.id : null);
  }

  /**
   * После действий с таймером пересобирает колоду без закрепления:
   * задачи на паузе должны сразу уйти в начало.
   */
  function refreshAfterTimer() {
    const currentPath = pathKeyOf(leaves[currentIndex]);
    leaves = collectLeaves();
    const idx = leaves.findIndex(leaf => pathKeyOf(leaf) === currentPath);
    currentIndex = idx !== -1 ? idx : Math.min(currentIndex, Math.max(0, leaves.length - 1));
  }

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
    const leafPriority = priorityResolver.resolve(leaf.id);
    const leafTimeScore = Number.isFinite(leaf.timeScore) ? leaf.timeScore : 5;
    const leafDifficulty = Number.isFinite(leaf.difficulty) ? leaf.difficulty : 5;
    const isCyclic = leaf.type === 'cyclic';
    const cooldown = getCooldownState(leaf, Date.now());
    const isCooling = isCyclic && cooldown.isCooling;
    const isBonus = isCyclic && !isCooling && !!cooldown.bonusActive;
    const bonusUntil = isBonus && cooldown.bonusEndsAt
      ? ` до ${formatShortDateTime(cooldown.bonusEndsAt)}`
      : '';
    const cardOpacity = isCooling ? cooldown.opacity : 1;
    const lastCompletedAt = getLastCompletionAt(leaf);
    const streak = getDisplayStreakSegments(leaf, Date.now());
    const taskTimer = getTimerForTask(leaf.id);
    const timerIsRunning = !!(taskTimer && !taskTimer.isPaused);
    const timerIsPaused = !!(taskTimer && taskTimer.isPaused);
    const canUseTimer = isCyclic || !!taskTimer;
    const canComplete = isCyclic || leaf.type === 'single';
    const timeIsActual = getAverageActualMinutes(leaf) !== null;
    const timeIsCalibrated = !!(leaf.duration && leaf.duration.calibrated);
    const timeSource = timeIsActual ? 'факт' : (timeIsCalibrated ? 'калибровка' : 'оценка');
    const timeSourceClass = timeIsActual ? 'is-fact' : (timeIsCalibrated ? 'is-calibrated' : 'is-estimate');
    const difficultyIsActual = getDifficultyRatings(leaf).length > 0;
    const difficultyIsCalibrated = !!leaf.difficultyCalibrated;
    const difficultySource = difficultyIsActual ? 'факт' : (difficultyIsCalibrated ? 'калибровка' : 'оценка');
    const difficultySourceClass = difficultyIsActual ? 'is-fact' : (difficultyIsCalibrated ? 'is-calibrated' : 'is-estimate');
    const timerButtonBg = timerIsRunning
      ? 'var(--accent)'
      : 'var(--bg-panel)';
    const timerButtonBorder = taskTimer ? 'var(--accent)' : 'var(--border)';
    const timerButtonClass = timerIsRunning
      ? 'is-running'
      : (timerIsPaused ? 'is-paused' : '');
    const timerButtonIcon = timerIsRunning
      ? ICONS.pause
      : (timerIsPaused ? ICONS.play : ICONS.timer);
    const timerButtonTitle = !canUseTimer
      ? 'Таймер доступен для циклических задач'
      : (taskTimer
        ? (timerIsPaused ? 'Таймер на паузе' : 'Таймер идёт')
        : 'Таймер');

    main.innerHTML = `
      <div class="tinder-view" style="position: relative; width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; background: var(--bg-main);">

        <div id="tinder-card" class="tinder-card" style="position: absolute; inset: 0; display: flex; flex-direction: column; cursor: grab; user-select: none; transition: transform 0.3s ease-out; z-index: 1; ${isBonus ? 'box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent), inset 0 0 28px color-mix(in srgb, var(--accent) 12%, transparent);' : ''}">

          <!-- Картинка (до середины кнопок) -->
          <div style="flex: 1; min-height: 0; position: relative; overflow: hidden;">
            ${leaf.image
              ? `<canvas id="tinder-photo" class="tinder-photo-canvas" style="display: block; width: 100%; height: 100%; filter: ${themeFilter}; pointer-events: none; user-select: none; -webkit-user-drag: none; opacity: ${cardOpacity}; transition: opacity 0.3s;"></canvas>`
              : `<div id="tinder-photo" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; filter: ${themeFilter}; opacity: ${0.3 * cardOpacity}; transition: opacity 0.3s;">
                   <span class="tinder-placeholder" style="display: flex;">${ICONS.sprout}</span>
                 </div>`
            }
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 26%; z-index: 1; background: linear-gradient(to bottom, var(--bg-main), transparent); pointer-events: none;"></div>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 26%; z-index: 1; background: linear-gradient(to bottom, transparent, var(--bg-main)); pointer-events: none;"></div>

            <!-- Радиальный кулдаун поверх картинки -->
            <div
              id="tinder-cooldown-shade"
              style="position: absolute; inset: 0; z-index: 2; pointer-events: none; background: ${isCooling ? cooldownShadeBackground(cooldown.ratio) : 'transparent'}; transition: background 0.3s linear;"
            ></div>

            <!-- Граница сектора кулдауна -->
            <div
              id="tinder-cooldown-hand"
              style="display: ${isCooling ? 'block' : 'none'}; position: absolute; left: 50%; top: 0; bottom: 50%; width: 2px; margin-left: -1px; transform-origin: 50% 100%; transform: rotate(${isCooling ? cooldownSweepDegrees(cooldown.ratio) : 0}deg); background: color-mix(in srgb, var(--text-main) 30%, transparent); box-shadow: 0 0 8px 2px color-mix(in srgb, var(--bg-main) 95%, transparent); z-index: 3; pointer-events: none; will-change: transform;"
            ></div>

            <!-- Полоса серии: последние 10 циклов -->
            ${isCyclic ? `
              <div id="tinder-streak" style="position: absolute; bottom: 40px; left: 0; right: 0; display: flex; gap: 2px; z-index: 3;">
                ${renderStreakSegments(streak)}
              </div>

              <!-- Время восстановления — по центру картинки -->
              <div
                id="tinder-cooldown"
                style="display: ${isCooling ? 'flex' : 'none'}; position: absolute; top: 50%; left: 16px; right: 16px; transform: translateY(-50%); z-index: 4; justify-content: center; pointer-events: none;"
              >
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 200px; padding: 13px 18px; border-radius: 17px; background: color-mix(in srgb, var(--bg-main) 76%, transparent); text-align: center; box-shadow: 0 4px 18px rgba(0,0,0,0.3); backdrop-filter: blur(3px);">
                  <div id="tinder-restore-at" style="font-size: 13px; line-height: 1.3; color: var(--text-secondary); text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                    ${isCooling ? `восстановится ${formatShortDateTime(cooldown.nextAt)}` : ''}
                  </div>
                  <div id="tinder-cooldown-percent" title="Прогресс восстановления" style="font-size: 15px; font-weight: 800; line-height: 1.1; color: var(--text-main); font-variant-numeric: tabular-nums; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                    ${isCooling ? `${cooldownPercent(cooldown.ratio)}%` : ''}
                  </div>
                  <div id="tinder-countdown" style="color: var(--accent); font-size: 19px; font-weight: 800; line-height: 1.2; letter-spacing: 0.2px; text-shadow: 0 1px 4px rgba(0,0,0,0.8);">
                    ${isCooling ? `до восстановления ${formatCountdown(cooldown.remainingMs)}` : ''}
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Метрики: время — важность — сложность -->
          <div id="tinder-metrics" style="position: absolute; top: 56px; left: 0; right: 0; display: flex; justify-content: center; align-items: flex-start; gap: 22px; z-index: 10; pointer-events: none; opacity: ${cardOpacity}; transition: opacity 0.3s;">
            <div class="tinder-metric" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-main));">
              <span id="tinder-time-value" class="tinder-metric-value">${formatTaskDuration(leaf.duration)}</span>
              <span class="tinder-metric-label">время</span>
              <span class="tinder-metric-source ${timeSourceClass}">${timeSource}</span>
            </div>
            <div class="tinder-metric" style="color: var(--accent);">
              <span id="tinder-priority-value" class="tinder-metric-value">${leafPriority.toFixed(1)}</span>
              <span class="tinder-metric-label">важность</span>
            </div>
            <div class="tinder-metric" style="color: color-mix(in srgb, var(--accent) 40%, var(--text-secondary));">
              <span id="tinder-difficulty-value" class="tinder-metric-value">${leafDifficulty.toFixed(1)}</span>
              <span class="tinder-metric-label">сложность</span>
              <span class="tinder-metric-source ${difficultySourceClass}">${difficultySource}</span>
            </div>
          </div>

          <!-- Кнопки (справа) -->
          <div style="position: absolute; top: 16px; right: 16px; z-index: 10; display: flex; gap: 8px; align-items: center;">
            <button id="tinder-edit" style="background: none; border: none; color: var(--text-main); width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">${ICONS.edit}</button>
            <button id="tinder-open-in-nav" style="background: none; border: none; color: var(--text-main); width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">${ICONS.folder}</button>
          </div>

          <!-- Счётчик (слева) -->
          <div id="tinder-counter" style="position: absolute; top: 16px; left: 16px; z-index: 10; height: 36px; display: flex; align-items: center; color: var(--text-main); font-size: 14px; font-weight: 700; letter-spacing: 0.5px; font-variant-numeric: tabular-nums; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
            ${currentIndex + 1}/${leaves.length}
          </div>

          <!-- Нижняя часть (текст) -->
          <div style="flex: 0 0 auto; display: flex; flex-direction: column; padding: 0 16px 16px; background: var(--bg-main); position: relative; z-index: 2;">

            <!-- Кнопки (наполовину поверх картинки) -->
            <div style="display: flex; justify-content: space-evenly; align-items: center; margin-top: -32px; margin-bottom: 8px;">
              <button id="tinder-hide" class="tinder-action-btn" style="background: ${isNormalMode ? 'var(--bg-panel)' : 'var(--danger)'}; border: 3px solid ${isNormalMode ? 'var(--border)' : 'var(--danger)'}; color: var(--text-main); width: 64px; height: 64px; border-radius: 50%; font-size: 24px; cursor: ${isNormalMode ? 'not-allowed' : 'pointer'}; display: flex; align-items: center; justify-content: center; opacity: ${isNormalMode ? '0.3' : '1'}; pointer-events: ${isNormalMode ? 'none' : 'auto'};" title="Скрыть">${ICONS.x}</button>
              <button id="tinder-timer-main" class="tinder-action-btn tinder-timer-btn ${timerButtonClass}" style="background: ${timerButtonBg}; border: 3px solid ${timerButtonBorder}; color: var(--text-main); width: 64px; height: 64px; border-radius: 50%; font-size: 24px; cursor: ${canUseTimer ? 'pointer' : 'not-allowed'}; display: flex; align-items: center; justify-content: center; opacity: ${canUseTimer ? '1' : '0.3'}; pointer-events: ${canUseTimer ? 'auto' : 'none'};" title="${timerButtonTitle}" ${canUseTimer ? '' : 'disabled'}>${timerButtonIcon}</button>
              <button id="tinder-complete" class="tinder-action-btn" style="background: var(--accent); border: 3px solid var(--accent); color: var(--text-main); width: 64px; height: 64px; border-radius: 50%; font-size: 24px; display: ${isCooling ? 'none' : 'flex'}; align-items: center; justify-content: center; opacity: ${canComplete ? '1' : '0.3'}; pointer-events: ${canComplete ? 'auto' : 'none'}; cursor: ${canComplete ? 'pointer' : 'not-allowed'};" title="${canComplete ? 'Выполнить' : 'Выполнение недоступно'}" ${canComplete ? '' : 'disabled'}>${ICONS.check}</button>
            </div>

            ${isCyclic ? `
              <button id="tinder-repeat" type="button" style="display: ${isCooling ? 'block' : 'none'}; width: 100%; margin: 0 0 10px; padding: 10px; border: none; border-radius: 12px; background: var(--accent); color: var(--bg-main); font-family: inherit; font-weight: 800; font-size: 14px; cursor: pointer;">
                Выполнить повторно
              </button>
            ` : ''}

            <!-- Текст -->
            <div id="tinder-text" style="opacity: ${cardOpacity}; transition: opacity 0.3s;">
              ${isBonus ? `<div class="tinder-bonus-badge" title="Бонус +25% действует${bonusUntil}. После этого приоритет вернётся к обычному.">бонус +25%${bonusUntil}</div>` : ''}
              <h2 style="font-size: 28px; font-weight: 800; color: var(--text-main); margin: 0 0 8px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${leaf.name}</h2>
              <div class="tinder-meta" style="display: flex; gap: 12px; font-size: 14px; color: var(--text-secondary); align-items: center; margin-bottom: 8px;">
                <span title="${leaf.type === 'cyclic' ? 'Циклическая' : 'Одноразовая'}">${leaf.type === 'cyclic' ? ICONS.cyclic : ICONS.single}</span>
                ${leaf.deadline ? `<span style="color: var(--accent);" title="Дедлайн">${ICONS.calendar} ${leaf.deadline}</span>` : ''}
                ${leaf.interval ? `<span style="color: var(--accent);" title="Интервал">${ICONS.timer} ${formatInterval(leaf.interval.totalMinutes)}</span>` : ''}
                ${isCyclic && lastCompletedAt ? `
                  <span style="margin-left: auto; font-size: 11px; color: var(--text-muted);" title="Последнее выполнение">последнее ${formatLastCompleted(lastCompletedAt)}</span>
                ` : ''}
              </div>
              <div style="font-size: 13px; line-height: 1.3; min-height: 1.3em; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 6px;">${path}</div>
              <p style="font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.35; height: 4.05em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word;">${leaf.desc || ''}</p>
            </div>
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

    // ===== Выполнение циклической задачи =====
    function openCompletion() {
      const completedId = leaf.id;
      const nextId = leaves[currentIndex + 1] ? leaves[currentIndex + 1].id : null;

      import('./completion-modal.js').then(({ openCompletionModal }) => {
        openCompletionModal(leaf, activeMoodId, () => {
          advanceAfterCompletion(completedId, nextId);
          render();
        });
      });
    }

    main.querySelector('#tinder-complete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!canComplete) return;

      if (leaf.type === 'cyclic') {
        openCompletion();
        return;
      }

      const confirmed = window.confirm(
        `Выполнить задачу «${leaf.name}»?\nОна уйдёт в архив.`
      );
      if (!confirmed) return;

      const completedId = leaf.id;
      const nextId = leaves[currentIndex + 1] ? leaves[currentIndex + 1].id : null;

      try {
        if (getTimerForTask(leaf.id)) stopTimer(leaf.id);
        await completeSingleTask(leaf, activeMoodId);
        advanceAfterCompletion(completedId, nextId);
        render();
      } catch (err) {
        console.error('Не удалось выполнить одноразовую задачу', err);
        alert(isQuotaError(err)
          ? 'Не хватает места для сохранения. Уменьши или удали фото.'
          : 'Не удалось выполнить задачу. Попробуй ещё раз.');
      }
    });

    main.querySelector('#tinder-repeat')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openCompletion();
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
      if (!canUseTimer) return;
      import('./timer-modal.js').then(({ openTimerModal }) => {
        openTimerModal(leaf, activeMoodId, () => {
          refreshAfterTimer();
          render();
        });
      });
    });

    // Все три метрики визуально одинаковы: высота, прозрачность и свечение по величине.
    applyMetricStyle(main.querySelector('#tinder-time-value'), leafTimeScore);
    applyMetricStyle(main.querySelector('#tinder-priority-value'), leafPriority);
    applyMetricStyle(main.querySelector('#tinder-difficulty-value'), leafDifficulty);

    // ===== Живой кулдаун =====
    // Таймер, прозрачность и полоса серии обновляются каждую секунду,
    // порядок колоды — раз в минуту, чтобы карточка не прыгала под пальцем.
    let wasCooling = isCooling;
    let wasBonus = isBonus;

    const tick = () => {
      const current = leaves[currentIndex];
      if (!current || current.type !== 'cyclic') return;

      const state = getCooldownState(current, Date.now());

      if (!state.isCooling) {
        const bonusNow = !!state.bonusActive;
        if (wasCooling || bonusNow !== wasBonus) {
          wasCooling = false;
          wasBonus = bonusNow;
          render();
        }
        return;
      }

      wasCooling = true;
      wasBonus = false;

      const cooldownEl = main.querySelector('#tinder-cooldown');
      if (cooldownEl) cooldownEl.style.display = 'flex';

      const restoreAtEl = main.querySelector('#tinder-restore-at');
      if (restoreAtEl) {
        restoreAtEl.textContent = `восстановится ${formatShortDateTime(state.nextAt)}`;
      }

      const percentEl = main.querySelector('#tinder-cooldown-percent');
      if (percentEl) {
        percentEl.textContent = `${cooldownPercent(state.ratio)}%`;
      }

      const countdownEl = main.querySelector('#tinder-countdown');
      if (countdownEl) {
        countdownEl.textContent = `до восстановления ${formatCountdown(state.remainingMs)}`;
      }

      const shadeEl = main.querySelector('#tinder-cooldown-shade');
      if (shadeEl) {
        shadeEl.style.background = cooldownShadeBackground(state.ratio);
      }

      const handEl = main.querySelector('#tinder-cooldown-hand');
      if (handEl) {
        handEl.style.display = 'block';
        handEl.style.transform = `rotate(${cooldownSweepDegrees(state.ratio)}deg)`;
      }

      const photoEl = main.querySelector('#tinder-photo');
      if (photoEl) {
        const baseOpacity = photoEl.classList.contains('tinder-photo-canvas') ? 1 : 0.3;
        photoEl.style.opacity = String(baseOpacity * state.opacity);
      }

      const textEl = main.querySelector('#tinder-text');
      if (textEl) textEl.style.opacity = String(state.opacity);

      const metricsEl = main.querySelector('#tinder-metrics');
      if (metricsEl) metricsEl.style.opacity = String(state.opacity);

      const completeBtn = main.querySelector('#tinder-complete');
      if (completeBtn) completeBtn.style.display = 'none';
      const repeatBtn = main.querySelector('#tinder-repeat');
      if (repeatBtn) repeatBtn.style.display = 'block';

      const streakEl = main.querySelector('#tinder-streak');
      if (streakEl) {
        streakEl.innerHTML = renderStreakSegments(getDisplayStreakSegments(current, Date.now()));
      }
    };

    const tickId = setInterval(tick, 1000);
    const sortId = setInterval(() => {
      if (isDragging) return;
      resortLeaves();
      const counter = main.querySelector('#tinder-counter');
      if (counter) counter.textContent = `${currentIndex + 1}/${leaves.length}`;
    }, 60000);

    const cleanupBeforeIntervals = window.__tinderCleanup;
    window.__tinderCleanup = () => {
      clearInterval(tickId);
      clearInterval(sortId);
      if (cleanupBeforeIntervals) cleanupBeforeIntervals();
    };
  }

  render();
}
