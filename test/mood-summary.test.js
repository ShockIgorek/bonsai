import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNavIndex } from '../src/store.js';
import { getMoodTopNodes } from '../src/logic/mood-summary.js';
import { installMemoryStorage } from './helpers/memory-storage.js';

function makeTree() {
  return {
    id: 'root',
    name: 'Мои задачи',
    children: [
      {
        id: 'work',
        name: 'Работа',
        children: [
          { id: 'deep', name: 'Глубокая работа', type: 'single' }
        ]
      },
      {
        id: 'health',
        name: 'Здоровье',
        children: [
          { id: 'run', name: 'Пробежка', type: 'single' }
        ]
      },
      { id: 'read', name: 'Почитать', type: 'single' }
    ]
  };
}

function seedMoods(priorities = {}, hiddenTasks = []) {
  installMemoryStorage({
    'bonsai-moods': [
      { id: 'default', name: 'Норма', priorities, hiddenTasks }
    ]
  });
}

test('top branches come first, then root tasks fill the list', () => {
  seedMoods({ deep: 8, run: 6, read: 7 });
  const nav = buildNavIndex(makeTree());

  const top = getMoodTopNodes(nav, 'default', 3);

  assert.deepEqual(top.map(node => node.name), ['Работа', 'Здоровье', 'Почитать']);
  assert.deepEqual(top.map(node => node.isLeaf), [false, false, true]);
});

test('hidden branches exclude their children too', () => {
  seedMoods({ deep: 8, run: 6, read: 7 }, ['work']);
  const nav = buildNavIndex(makeTree());

  const top = getMoodTopNodes(nav, 'default', 3);

  assert.deepEqual(top.map(node => node.name), ['Здоровье', 'Почитать', 'Пробежка']);
});

test('tasks fill the list when there are no branches', () => {
  seedMoods({ a: 9, b: 5, c: 7, d: 1 });
  const nav = buildNavIndex({
    id: 'root',
    name: 'Мои задачи',
    children: [
      { id: 'a', name: 'A', type: 'single' },
      { id: 'b', name: 'B', type: 'single' },
      { id: 'c', name: 'C', type: 'single' },
      { id: 'd', name: 'D', type: 'single' }
    ]
  });

  const top = getMoodTopNodes(nav, 'default', 3);

  assert.deepEqual(top.map(node => node.name), ['A', 'C', 'B']);
});

test('empty tree returns an empty summary', () => {
  seedMoods();
  const nav = buildNavIndex({ id: 'root', name: 'Мои задачи', children: [] });

  assert.deepEqual(getMoodTopNodes(nav, 'default', 3), []);
});
