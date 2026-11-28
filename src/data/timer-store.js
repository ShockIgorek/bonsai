// Таймеры задач. Активным может быть только один, но пауз может быть много.
// Храним метки времени, чтобы переживать сворачивание приложения и перезагрузку.

const TIMERS_KEY = 'bonsai-timers';
const LEGACY_TIMER_KEY = 'bonsai-active-timer';

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bonsai-timer-change'));
  }
}

function normalizeTimer(timer) {
  if (!timer || !timer.taskId) return null;

  return {
    taskId: String(timer.taskId),
    taskName: timer.taskName || 'Задача',
    taskPath: Array.isArray(timer.taskPath) ? timer.taskPath : [],
    moodId: timer.moodId || 'default',
    startedAt: Number(timer.startedAt) || 0,
    accumulatedMs: Math.max(0, Number(timer.accumulatedMs) || 0),
    isPaused: !!timer.isPaused,
    lastStartedAt: Number(timer.lastStartedAt) || Number(timer.startedAt) || Number(timer.updatedAt) || 0,
    updatedAt: Number(timer.updatedAt) || 0
  };
}

function readTimerMap() {
  const raw = localStorage.getItem(TIMERS_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};

      const map = {};
      for (const timer of Object.values(parsed)) {
        const normalized = normalizeTimer(timer);
        if (normalized) map[normalized.taskId] = normalized;
      }
      return map;
    } catch (err) {
      return {};
    }
  }

  // Миграция старого одиночного таймера.
  const legacyRaw = localStorage.getItem(LEGACY_TIMER_KEY);
  if (!legacyRaw) return {};

  try {
    const legacy = normalizeTimer(JSON.parse(legacyRaw));
    if (!legacy) return {};

    const map = { [legacy.taskId]: legacy };
    localStorage.setItem(TIMERS_KEY, JSON.stringify(map));
    localStorage.removeItem(LEGACY_TIMER_KEY);
    return map;
  } catch (err) {
    return {};
  }
}

function writeTimerMap(map) {
  localStorage.setItem(TIMERS_KEY, JSON.stringify(map));
  emitChange();
}

export function getTimers() {
  return Object.values(readTimerMap());
}

export function getTimerForTask(taskId) {
  const map = readTimerMap();
  return map[String(taskId)] || null;
}

export function getRunningTimer() {
  return getTimers().find(timer => !timer.isPaused) || null;
}

export function getPausedTimers() {
  return getTimers()
    .filter(timer => timer.isPaused)
    .sort((a, b) => (
      b.lastStartedAt - a.lastStartedAt
      || b.updatedAt - a.updatedAt
    ));
}

/**
 * Для индикатора в шапке: сначала активный, затем последний запущенный
 * среди таймеров на паузе.
 */
export function getPreferredTimer() {
  return getRunningTimer() || getPausedTimers()[0] || null;
}

export function getTimerElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;

  const accumulated = Math.max(0, Number(timer.accumulatedMs) || 0);
  if (timer.isPaused) return accumulated;

  const startedAt = Number(timer.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return accumulated;

  return accumulated + Math.max(0, now - startedAt);
}

export function startTimer(task, moodId) {
  const now = Date.now();
  const map = readTimerMap();

  // Запуск нового таймера ставит текущий активный на паузу.
  for (const timer of Object.values(map)) {
    if (timer.isPaused) continue;

    timer.accumulatedMs = getTimerElapsedMs(timer, now);
    timer.isPaused = true;
    timer.startedAt = 0;
    timer.updatedAt = now;
    map[timer.taskId] = timer;
  }

  const timer = {
    taskId: String(task.id),
    taskName: task.name || 'Задача',
    taskPath: Array.isArray(task.path) ? task.path : [],
    moodId: moodId || 'default',
    startedAt: now,
    accumulatedMs: 0,
    isPaused: false,
    lastStartedAt: now,
    updatedAt: now
  };

  map[timer.taskId] = timer;
  writeTimerMap(map);
  return timer;
}

export function pauseTimer(taskId = null) {
  const now = Date.now();
  const map = readTimerMap();
  const target = taskId
    ? map[String(taskId)]
    : Object.values(map).find(timer => !timer.isPaused);

  if (!target || target.isPaused) return target || null;

  target.accumulatedMs = getTimerElapsedMs(target, now);
  target.isPaused = true;
  target.startedAt = 0;
  target.updatedAt = now;
  map[target.taskId] = target;
  writeTimerMap(map);
  return target;
}

export function resumeTimer(taskId) {
  const now = Date.now();
  const map = readTimerMap();
  const target = map[String(taskId)];
  if (!target || !target.isPaused) return target || null;

  // Активным может быть только один таймер.
  for (const timer of Object.values(map)) {
    if (timer.taskId === target.taskId || timer.isPaused) continue;

    timer.accumulatedMs = getTimerElapsedMs(timer, now);
    timer.isPaused = true;
    timer.startedAt = 0;
    timer.updatedAt = now;
    map[timer.taskId] = timer;
  }

  target.startedAt = now;
  target.isPaused = false;
  target.lastStartedAt = now;
  target.updatedAt = now;
  map[target.taskId] = target;
  writeTimerMap(map);
  return target;
}

export function stopTimer(taskId = null) {
  const map = readTimerMap();
  const target = taskId
    ? map[String(taskId)]
    : Object.values(map).find(timer => !timer.isPaused);

  if (!target) return 0;

  const elapsed = getTimerElapsedMs(target);
  delete map[target.taskId];
  writeTimerMap(map);
  return elapsed;
}

export function clearTimer(taskId = null) {
  if (!taskId) {
    localStorage.removeItem(TIMERS_KEY);
    emitChange();
    return;
  }

  const map = readTimerMap();
  delete map[String(taskId)];
  writeTimerMap(map);
}
