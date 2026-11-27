import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeSingleTask,
  getArchive,
  archiveTask,
  restoreArchivedTask,
  removeArchiveEntry,
  clearArchive,
  getLog
} from '../src/data/archive-store.js';
import { installMemoryStorage } from './helpers/memory-storage.js';

function seedTree() {
  return installMemoryStorage({
    'bonsai-tasks-tree': {
      id: 'root',
      name: 'Мои задачи',
      children: [
        {
          id: 'folder-home',
          name: 'Дом',
          children: [
            {
              id: 'task-dishes',
              name: 'Помыть посуду',
              type: 'single',
              desc: 'Тарелки',
              image: 'data:image/png;base64,AAAA',
              duration: { estimated: 10, actual: null }
            }
          ]
        }
      ]
    },
    'bonsai-moods': [
      { id: 'default', name: 'Норма', priorities: { 'task-dishes': 8 } }
    ]
  });
}

function navTaskFromTree() {
  return {
    id: 'task-dishes',
    name: 'Помыть посуду',
    type: 'single',
    path: ['Мои задачи', 'Дом', 'Помыть посуду'],
    ref: {
      id: 'task-dishes',
      name: 'Помыть посуду',
      type: 'single',
      desc: 'Тарелки',
      image: 'data:image/png;base64,AAAA',
      duration: { estimated: 10, actual: null }
    }
  };
}

test('single completion archives task, removes it from tree and writes log', async () => {
  const memory = seedTree();

  await completeSingleTask(navTaskFromTree(), 'default');

  const tree = JSON.parse(memory.storage.getItem('bonsai-tasks-tree'));
  assert.equal(tree.children[0].children.length, 0);

  const archive = getArchive();
  assert.equal(archive.length, 1);
  assert.equal(archive[0].name, 'Помыть посуду');
  assert.equal(archive[0].image, '');
  assert.deepEqual(archive[0].parentPath, ['Мои задачи', 'Дом']);
  assert.ok(archive[0].archiveId);
  assert.equal('ref' in archive[0], false);
  assert.equal('path' in archive[0], false);

  const log = getLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].taskName, 'Помыть посуду');
  assert.equal(log[0].taskType, 'single');
  assert.equal(log[0].moodId, 'default');
});

test('restore returns task to its original folder', async () => {
  const memory = seedTree();
  await completeSingleTask(navTaskFromTree(), 'default');
  const entry = getArchive()[0];

  const result = await restoreArchivedTask(entry.archiveId);

  assert.equal(result.usedRoot, false);
  assert.equal(result.task.id, 'task-dishes');
  assert.equal(getArchive().length, 0);

  const tree = JSON.parse(memory.storage.getItem('bonsai-tasks-tree'));
  assert.equal(tree.children[0].children[0].name, 'Помыть посуду');
});

test('restore falls back to root when original folder is gone', async () => {
  const memory = seedTree();
  const archived = archiveTask({
    id: 'task-lost',
    name: 'Потерянная',
    type: 'single',
    path: ['Мои задачи', 'Нет папки', 'Потерянная'],
    ref: { id: 'task-lost', name: 'Потерянная', type: 'single' }
  }, 'default');

  const result = await restoreArchivedTask(archived.archiveId);

  assert.equal(result.usedRoot, true);
  const tree = JSON.parse(memory.storage.getItem('bonsai-tasks-tree'));
  assert.equal(tree.children[tree.children.length - 1].name, 'Потерянная');
});

test('old archive entries get archiveId and lose stored photos', () => {
  const memory = installMemoryStorage({
    'bonsai-archive': [
      { name: 'Старая', image: 'data:image/png;base64,BBBB', archivedAt: 1 }
    ]
  });

  const archive = getArchive();
  assert.equal(archive.length, 1);
  assert.equal(archive[0].image, '');
  assert.ok(archive[0].archiveId);
  assert.match(memory.storage.getItem('bonsai-archive'), /archiveId/);
});

test('archive entry can be deleted or the whole archive cleared', () => {
  installMemoryStorage({
    'bonsai-archive': [
      { archiveId: 'a1', name: 'Первая' },
      { archiveId: 'a2', name: 'Вторая' }
    ]
  });

  assert.equal(removeArchiveEntry('a1').length, 1);
  assert.equal(getArchive()[0].name, 'Вторая');

  clearArchive();
  assert.deepEqual(getArchive(), []);
});
