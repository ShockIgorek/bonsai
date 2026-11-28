import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestBackup, TEST_NOW } from './fixtures/test-backup.js';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { buildNavIndex } from '../src/store.js';
import { getMoodSorting, scoreTask } from '../src/logic/tinder-ranking.js';
import { createPriorityResolver } from '../src/data/mood-priorities.js';
import { getCooldownState } from '../src/logic/cyclic-schedule.js';
import { getStreakSegments } from '../src/logic/streak.js';
import { isTaskHiddenForMood } from '../src/data/moods-store.js';
import { validateFullBackup, restoreFullBackup } from '../src/data/backup-store.js';

function prepare() {
  const backup = buildTestBackup({ now: TEST_NOW });
  const memory = installMemoryStorage({
    'bonsai-tasks-tree': backup.data.tasksTree,
    'bonsai-moods': backup.data.moods
  });
  const nav = buildNavIndex(backup.data.tasksTree);
  return { backup, memory, nav };
}

function moodOrder(nav, mood) {
  const sorting = getMoodSorting(mood);
  const resolver = createPriorityResolver(nav, mood.id);
  const items = [];

  nav.byId.forEach(node => {
    if (node.id === nav.rootId || !node.isLeaf) return;
    if (mood.id !== 'default' && isTaskHiddenForMood(mood.id, node.id)) return;

    const cooldown = getCooldownState(node, TEST_NOW);
    const base = scoreTask({
      importance: resolver.resolve(node.id),
      timeScore: node.sortTimeScore !== null && node.sortTimeScore !== undefined
        ? node.sortTimeScore
        : node.timeScore,
      difficulty: node.difficulty
    }, sorting);

    items.push({
      id: node.id,
      score: base * cooldown.multiplier
    });
  });

  return items.sort((a, b) => b.score - a.score).map(item => item.id);
}

function assertClose(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}

test('test backup is valid and has expected counts', () => {
  const { backup } = prepare();

  assert.equal(validateFullBackup(backup), null);
  assert.equal(backup.test.now, TEST_NOW);
  assert.equal(backup.data.moods.length, 3);
  assert.equal(backup.data.archive.length, 1);
  assert.equal(backup.data.log.length, 2);
  assert.equal(backup.data.extra['bonsai-test-marker'], 'test-backup-v1');
});

test('cooldown states are predictable', () => {
  const { nav } = prepare();

  const half = getCooldownState(nav.byId.get('task-cooldown-50'), TEST_NOW);
  assert.equal(half.isCooling, true);
  assertClose(half.ratio, 0.5);
  assertClose(half.multiplier, 0.5);
  assertClose(half.opacity, 0.675);

  const fresh = getCooldownState(nav.byId.get('task-cooldown-0'), TEST_NOW);
  assert.equal(fresh.isCooling, true);
  assertClose(fresh.ratio, 1 / 600);
  assertClose(fresh.multiplier, 1 / 600);

  const bonus = getCooldownState(nav.byId.get('task-bonus'), TEST_NOW);
  assert.equal(bonus.isCooling, false);
  assertClose(bonus.ratio, 1.2);
  assert.equal(bonus.multiplier, 1.25);
  assert.equal(bonus.bonusActive, true);

  const noBonus = getCooldownState(nav.byId.get('task-no-bonus'), TEST_NOW);
  assert.equal(noBonus.isCooling, false);
  assertClose(noBonus.ratio, 1.6);
  assert.equal(noBonus.multiplier, 1);
});

test('streak segments match the documented examples plus current waiting', () => {
  const { nav } = prepare();

  assert.deepEqual(
    getStreakSegments(nav.byId.get('task-streak-21'), TEST_NOW).slice(0, 4),
    ['full', 'full', 'empty', 'empty']
  );
  assert.deepEqual(
    getStreakSegments(nav.byId.get('task-streak-31'), TEST_NOW).slice(0, 4),
    ['full', 'weak', 'empty', 'empty']
  );
  assert.deepEqual(
    getStreakSegments(nav.byId.get('task-streak-41'), TEST_NOW).slice(0, 5),
    ['full', 'missed', 'full', 'missed', 'empty']
  );
  assert.deepEqual(
    getStreakSegments(nav.byId.get('task-streak-61'), TEST_NOW).slice(0, 7),
    ['full', 'missed', 'missed', 'full', 'missed', 'missed', 'empty']
  );
});

test('Tinder order per mood is predictable', () => {
  const { backup, nav } = prepare();
  const moods = new Map(backup.data.moods.map(mood => [mood.id, mood]));

  assert.deepEqual(moodOrder(nav, moods.get('default')), [
    'task-hidden',
    'task-bonus',
    'task-streak-21',
    'task-single',
    'task-calibrated',
    'task-no-bonus',
    'task-streak-31',
    'task-streak-41',
    'task-streak-61',
    'task-subjective',
    'task-cooldown-50',
    'task-cooldown-0'
  ]);

  assert.deepEqual(moodOrder(nav, moods.get('tired')), [
    'task-bonus',
    'task-streak-21',
    'task-streak-61',
    'task-streak-41',
    'task-no-bonus',
    'task-streak-31',
    'task-calibrated',
    'task-single',
    'task-subjective',
    'task-cooldown-50',
    'task-cooldown-0'
  ]);

  assert.deepEqual(moodOrder(nav, moods.get('machine')), [
    'task-single',
    'task-no-bonus',
    'task-bonus',
    'task-streak-21',
    'task-streak-31',
    'task-hidden',
    'task-subjective',
    'task-streak-41',
    'task-streak-61',
    'task-calibrated',
    'task-cooldown-50',
    'task-cooldown-0'
  ]);
});

test('full test backup restores settings, moods, archive and extra data', () => {
  const { backup } = prepare();
  const memory = installMemoryStorage();

  const restored = restoreFullBackup(backup);

  assert.equal(restored.tasks, 15);
  assert.equal(restored.moods, 3);
  assert.equal(restored.archive, 1);
  assert.equal(restored.log, 2);

  const moods = JSON.parse(memory.storage.getItem('bonsai-moods'));
  const tired = moods.find(mood => mood.id === 'tired');
  assert.equal(tired.sorting.presetId, 'rest');
  assert.deepEqual(tired.hiddenTasks, ['task-hidden']);
  assert.equal(memory.storage.getItem('bonsai-test-marker'), 'test-backup-v1');
  assert.equal(memory.storage.getItem('bonsai-active-mood'), 'default');
});
