import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installMemoryStorage } from './helpers/memory-storage.js';
import { validateFullBackup } from '../src/data/backup-store.js';
import { buildNavIndex } from '../src/store.js';
import { getMoodSorting, scoreTask } from '../src/logic/tinder-ranking.js';
import { createPriorityResolver } from '../src/data/mood-priorities.js';
import { getCooldownState } from '../src/logic/cyclic-schedule.js';

const NOW = Date.UTC(2026, 11, 31, 12, 0, 0);
const backup = JSON.parse(readFileSync(
  new URL('../test-data/bonsai-test-backup.json', import.meta.url),
  'utf8'
));

function countTasks(node) {
  return (node.children || []).reduce((total, child) => total + 1 + countTasks(child), 0);
}

function moodOrder(nav, mood) {
  const sorting = getMoodSorting(mood);
  const resolver = createPriorityResolver(nav, mood.id);
  const hidden = new Set(mood.hiddenTasks || []);
  const items = [];

  nav.byId.forEach(node => {
    if (node.id === nav.rootId || !node.isLeaf) return;

    let current = node;
    while (current) {
      if (hidden.has(current.id)) return;
      current = current.parentId ? nav.byId.get(current.parentId) : null;
    }

    const cooldown = getCooldownState(node, NOW);
    const base = scoreTask({
      importance: resolver.resolve(node.id),
      timeScore: node.sortTimeScore !== null && node.sortTimeScore !== undefined
        ? node.sortTimeScore
        : node.timeScore,
      difficulty: node.difficulty
    }, sorting);

    items.push({ id: node.id, score: base * cooldown.multiplier });
  });

  return items.sort((a, b) => b.score - a.score).map(item => item.id);
}

test('manual test backup is valid and understandable', () => {
  assert.equal(validateFullBackup(backup), null);
  assert.equal(countTasks(backup.data.tasksTree), 21);
  assert.equal(backup.data.moods.length, 3);
  assert.equal(backup.data.archive.length, 1);
  assert.equal(backup.data.log.length, 2);
  assert.equal(backup.data.extra['bonsai-test-marker'], 'manual-test-v1');
});

test('manual test backup has ready tasks without active cooldown', () => {
  installMemoryStorage({
    'bonsai-tasks-tree': backup.data.tasksTree,
    'bonsai-moods': backup.data.moods
  });
  const nav = buildNavIndex(backup.data.tasksTree);

  assert.equal(getCooldownState(nav.byId.get('test-cooldown'), NOW).isCooling, false);
  assert.equal(getCooldownState(nav.byId.get('test-streak'), NOW).isCooling, false);
  assert.equal(getCooldownState(nav.byId.get('test-anchor-a'), NOW).isCooling, false);
});

test('manual test backup keeps actual and calibrated sources', () => {
  installMemoryStorage({
    'bonsai-tasks-tree': backup.data.tasksTree,
    'bonsai-moods': backup.data.moods
  });
  const nav = buildNavIndex(backup.data.tasksTree);

  assert.equal(nav.byId.get('test-anchor-a').duration.actual, 10);
  assert.equal(nav.byId.get('test-anchor-a').difficulty, 3);
  assert.equal(nav.byId.get('test-calibrated').duration.calibrated, true);
  assert.equal(nav.byId.get('test-calibrated').sortTimeScore, 0.5);
  assert.equal(nav.byId.get('test-calibrated').difficultyCalibrated, true);
  assert.equal(nav.byId.get('test-quick-easy').duration.calibrated || false, false);
});

test('manual test backup order is stable and predictable', () => {
  installMemoryStorage({
    'bonsai-tasks-tree': backup.data.tasksTree,
    'bonsai-moods': backup.data.moods
  });
  const nav = buildNavIndex(backup.data.tasksTree);
  const moods = new Map(backup.data.moods.map(mood => [mood.id, mood]));

  assert.deepEqual(moodOrder(nav, moods.get('default')), [
    'test-hidden',
    'test-important',
    'test-quick-easy',
    'test-cooldown',
    'test-streak',
    'test-anchor-a',
    'test-timer',
    'test-single',
    'test-nested-a',
    'test-quick-hard',
    'test-anchor-b',
    'test-calibrated',
    'test-long-easy',
    'test-nested-b',
    'test-long-hard',
    'test-unimportant'
  ]);

  assert.deepEqual(moodOrder(nav, moods.get('tired')), [
    'test-nested-b',
    'test-nested-a',
    'test-quick-easy',
    'test-anchor-a',
    'test-cooldown',
    'test-streak',
    'test-long-easy',
    'test-unimportant',
    'test-timer',
    'test-single',
    'test-calibrated',
    'test-important',
    'test-anchor-b',
    'test-quick-hard',
    'test-long-hard'
  ]);

  assert.deepEqual(moodOrder(nav, moods.get('machine')), [
    'test-long-hard',
    'test-important',
    'test-anchor-b',
    'test-quick-hard',
    'test-single',
    'test-hidden',
    'test-long-easy',
    'test-timer',
    'test-calibrated',
    'test-cooldown',
    'test-streak',
    'test-anchor-a',
    'test-nested-a',
    'test-unimportant',
    'test-nested-b',
    'test-quick-easy'
  ]);
});
