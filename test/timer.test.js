import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTimerForTask,
  getRunningTimer,
  getPausedTimers,
  getTimerElapsedMs,
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer
} from '../src/data/timer-store.js';
import { installMemoryStorage, installWindow, setNow } from './helpers/memory-storage.js';

const taskA = {
  id: 'task-1',
  name: 'Первая',
  path: ['Мои задачи', 'Первая']
};

const taskB = {
  id: 'task-2',
  name: 'Вторая',
  path: ['Мои задачи', 'Вторая']
};

test('timer counts elapsed time, pauses and resumes', () => {
  installMemoryStorage();
  installWindow();
  const clock = setNow(1_000_000);

  try {
    startTimer(taskA, 'default');
    assert.equal(getTimerElapsedMs(getTimerForTask('task-1')), 0);

    clock.advance(65_000);
    assert.equal(getTimerElapsedMs(getTimerForTask('task-1')), 65_000);

    pauseTimer('task-1');
    assert.equal(getTimerForTask('task-1').isPaused, true);
    clock.advance(60_000);
    assert.equal(getTimerElapsedMs(getTimerForTask('task-1')), 65_000);

    resumeTimer('task-1');
    clock.advance(5_000);
    assert.equal(getTimerElapsedMs(getTimerForTask('task-1')), 70_000);

    const elapsed = stopTimer('task-1');
    assert.equal(elapsed, 70_000);
    assert.equal(getTimerForTask('task-1'), null);
  } finally {
    clock.restore();
  }
});

test('starting another timer pauses the running one', () => {
  installMemoryStorage();
  installWindow();
  const clock = setNow(2_000_000);

  try {
    startTimer(taskA, 'default');
    clock.advance(10_000);
    startTimer(taskB, 'default');
    clock.advance(5_000);

    const first = getTimerForTask('task-1');
    const second = getTimerForTask('task-2');

    assert.equal(first.isPaused, true);
    assert.equal(getTimerElapsedMs(first), 10_000);
    assert.equal(second.isPaused, false);
    assert.equal(getTimerElapsedMs(second), 5_000);
    assert.equal(getRunningTimer().taskId, 'task-2');
    assert.deepEqual(getPausedTimers().map(timer => timer.taskId), ['task-1']);
  } finally {
    clock.restore();
  }
});

test('resuming one timer pauses the other running timer', () => {
  installMemoryStorage();
  installWindow();
  const clock = setNow(3_000_000);

  try {
    startTimer(taskA, 'default');
    startTimer(taskB, 'default');
    clock.advance(5_000);

    resumeTimer('task-1');

    assert.equal(getTimerForTask('task-1').isPaused, false);
    assert.equal(getTimerForTask('task-2').isPaused, true);
    assert.equal(getRunningTimer().taskId, 'task-1');
    assert.deepEqual(getPausedTimers().map(timer => timer.taskId), ['task-2']);
  } finally {
    clock.restore();
  }
});

test('stopping one timer keeps the other paused timer', () => {
  installMemoryStorage();
  installWindow();
  const clock = setNow(4_000_000);

  try {
    startTimer(taskA, 'default');
    startTimer(taskB, 'default');
    pauseTimer('task-2');
    stopTimer('task-1');

    assert.equal(getTimerForTask('task-1'), null);
    assert.equal(getTimerForTask('task-2').isPaused, true);
    assert.equal(getRunningTimer(), null);
  } finally {
    clock.restore();
  }
});

test('legacy single timer migrates to the timer map', () => {
  const memory = installMemoryStorage({
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

  const timer = getTimerForTask('task-1');
  assert.equal(timer.isPaused, true);
  assert.equal(getTimerElapsedMs(timer), 42_000);
  assert.ok(memory.storage.getItem('bonsai-timers'));
  assert.equal(memory.storage.getItem('bonsai-active-timer'), null);
});

test('paused timer survives reload because state is stored', () => {
  installMemoryStorage({
    'bonsai-timers': {
      'task-1': {
        taskId: 'task-1',
        taskName: 'Задача',
        taskPath: ['Мои задачи', 'Задача'],
        moodId: 'default',
        startedAt: 0,
        accumulatedMs: 42_000,
        isPaused: true,
        updatedAt: 1
      }
    }
  });
  installWindow();

  const timer = getTimerForTask('task-1');
  assert.equal(timer.isPaused, true);
  assert.equal(getTimerElapsedMs(timer), 42_000);
  assert.equal(getPausedTimers().length, 1);
});
