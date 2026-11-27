import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveTimer,
  getActiveTimerForTask,
  getTimerElapsedMs,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer
} from '../src/data/timer-store.js';
import { installMemoryStorage, installWindow, setNow } from './helpers/memory-storage.js';

const task = {
  id: 'task-1',
  name: 'Задача',
  path: ['Мои задачи', 'Задача']
};

test('timer counts elapsed time, pauses and resumes', () => {
  installMemoryStorage();
  installWindow();
  const clock = setNow(1_000_000);

  try {
    startTimer(task, 'default');
    assert.equal(getTimerElapsedMs(getActiveTimer()), 0);

    clock.advance(65_000);
    assert.equal(getTimerElapsedMs(getActiveTimer()), 65_000);

    pauseTimer();
    assert.equal(getActiveTimer().isPaused, true);
    clock.advance(60_000);
    assert.equal(getTimerElapsedMs(getActiveTimer()), 65_000);

    resumeTimer();
    clock.advance(5_000);
    assert.equal(getTimerElapsedMs(getActiveTimer()), 70_000);

    const elapsed = stopTimer();
    assert.equal(elapsed, 70_000);
    assert.equal(getActiveTimer(), null);
  } finally {
    clock.restore();
  }
});

test('only one active timer exists at a time', () => {
  installMemoryStorage();
  installWindow();

  startTimer(task, 'default');
  startTimer({ id: 'task-2', name: 'Вторая', path: [] }, 'default');

  assert.equal(getActiveTimer().taskId, 'task-2');
  assert.equal(getActiveTimerForTask('task-1'), null);
  assert.equal(getActiveTimerForTask('task-2').taskName, 'Вторая');
});

test('paused timer survives reload because state is stored', () => {
  installMemoryStorage({
    'bonsai-active-timer': {
      taskId: 'task-1',
      taskName: 'Задача',
      taskPath: ['Мои задачи', 'Задача'],
      moodId: 'default',
      startedAt: 0,
      accumulatedMs: 42_000,
      isPaused: true
    }
  });
  installWindow();

  const timer = getActiveTimer();
  assert.equal(timer.isPaused, true);
  assert.equal(getTimerElapsedMs(timer), 42_000);
  assert.equal(getActiveTimerForTask('task-1').taskName, 'Задача');
});
