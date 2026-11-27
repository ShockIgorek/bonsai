// Один активный таймер на всё приложение.
// Храним не «тикающий счётчик», а метки времени, чтобы переживать
// сворачивание приложения, блокировку экрана и перезагрузку страницы.

const TIMER_KEY = 'bonsai-active-timer';

function emitChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bonsai-timer-change'));
  }
}

export function getActiveTimer() {
  const raw = localStorage.getItem(TIMER_KEY);
  if (!raw) return null;

  try {
    const timer = JSON.parse(raw);
    if (!timer || !timer.taskId) return null;

    return {
      taskId: String(timer.taskId),
      taskName: timer.taskName || 'Задача',
      taskPath: Array.isArray(timer.taskPath) ? timer.taskPath : [],
      moodId: timer.moodId || 'default',
      startedAt: Number(timer.startedAt) || 0,
      accumulatedMs: Math.max(0, Number(timer.accumulatedMs) || 0),
      isPaused: !!timer.isPaused
    };
  } catch (err) {
    return null;
  }
}

export function getTimerElapsedMs(timer, now = Date.now()) {
  if (!timer) return 0;

  const accumulated = Math.max(0, Number(timer.accumulatedMs) || 0);
  if (timer.isPaused) return accumulated;

  const startedAt = Number(timer.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return accumulated;

  return accumulated + Math.max(0, now - startedAt);
}

export function getActiveTimerForTask(taskId) {
  const timer = getActiveTimer();
  return timer && timer.taskId === String(taskId) ? timer : null;
}

export function startTimer(task, moodId) {
  const now = Date.now();
  const timer = {
    taskId: String(task.id),
    taskName: task.name || 'Задача',
    taskPath: Array.isArray(task.path) ? task.path : [],
    moodId: moodId || 'default',
    startedAt: now,
    accumulatedMs: 0,
    isPaused: false,
    updatedAt: now
  };

  localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  emitChange();
  return timer;
}

export function pauseTimer() {
  const timer = getActiveTimer();
  if (!timer || timer.isPaused) return timer;

  timer.accumulatedMs = getTimerElapsedMs(timer);
  timer.isPaused = true;
  timer.startedAt = 0;
  timer.updatedAt = Date.now();
  localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  emitChange();
  return timer;
}

export function resumeTimer() {
  const timer = getActiveTimer();
  if (!timer || !timer.isPaused) return timer;

  timer.startedAt = Date.now();
  timer.isPaused = false;
  timer.updatedAt = Date.now();
  localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  emitChange();
  return timer;
}

export function stopTimer() {
  const timer = getActiveTimer();
  const elapsed = getTimerElapsedMs(timer);

  localStorage.removeItem(TIMER_KEY);
  emitChange();
  return elapsed;
}

export function clearTimer() {
  localStorage.removeItem(TIMER_KEY);
  emitChange();
}
