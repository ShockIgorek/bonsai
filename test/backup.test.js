import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFullBackup,
  validateFullBackup,
  getBackupSummary,
  restoreFullBackup
} from '../src/data/backup-store.js';
import { installMemoryStorage } from './helpers/memory-storage.js';

function seedStorage() {
  return installMemoryStorage({
    'bonsai-tasks-tree': {
      id: 'root',
      name: 'Мои задачи',
      children: [
        {
          id: 'task-a',
          name: 'Задача A',
          type: 'cyclic',
          image: 'data:image/png;base64,AAAA',
          duration: { estimated: 20, actual: null, calibrated: true },
          sortTimeScore: 2.5,
          difficultyCalibrated: true,
          completionHistory: [{ at: 1, difficulty: 5, actualMinutes: 20 }]
        },
        {
          id: 'folder-b',
          name: 'Папка B',
          children: [
            {
              id: 'task-c',
              name: 'Задача C',
              type: 'single',
              image: 'https://example.com/c.png'
            }
          ]
        }
      ]
    },
    'bonsai-moods': [
      {
        id: 'default',
        name: 'Норма',
        theme: 'bonsai',
        image: 'data:image/png;base64,BBBB',
        priorities: { 'task-a': 8 },
        hiddenTasks: ['folder-b'],
        sorting: {
          weights: { importance: 0.5, time: 0.3, difficulty: 0.2 },
          directions: { importance: 1, time: -1, difficulty: -1 },
          presetId: 'custom'
        }
      }
    ],
    'bonsai-archive': [
      {
        name: 'Архивная',
        image: 'data:image/png;base64,CCCC',
        archivedAt: 123
      }
    ],
    'bonsai-log': [
      { taskName: 'Архивная', completedAt: 123 }
    ],
    'bonsai-theme': 'bonsai',
    'bonsai-active-mood': 'default',
    'bonsai-show-hidden': 'true',
    'bonsai-current-mode': 'navigation',
    'bonsai-test-extra': '{"enabled":true}',
    'bonsai-active-timer': '{"taskId":"task-a"}',
    'bonsai-tinder-last-path': '["Мои задачи","Задача A"]'
  });
}

test('full backup keeps data and strips base64 images', () => {
  seedStorage();

  const backup = createFullBackup();

  assert.equal(backup.app, 'bonsai');
  assert.equal(backup.kind, 'full-backup');
  assert.equal(backup.version, 1);
  assert.equal(backup.includesImages, false);

  assert.equal(backup.data.tasksTree.children[0].image, '');
  assert.equal(backup.data.tasksTree.children[1].children[0].image, 'https://example.com/c.png');
  assert.equal(backup.data.moods[0].image, '');
  assert.equal(backup.data.archive[0].image, '');

  assert.equal(backup.data.extra['bonsai-test-extra'], '{"enabled":true}');
  assert.equal('bonsai-active-timer' in backup.data.extra, false);
  assert.equal('bonsai-tinder-last-path' in backup.data.extra, false);
});

test('backup summary counts tasks, moods, archive and log', () => {
  seedStorage();
  const backup = createFullBackup();

  assert.deepEqual(getBackupSummary(backup), {
    exportedAt: backup.exportedAt,
    includesImages: false,
    tasks: 3,
    moods: 1,
    archive: 1,
    log: 1
  });
});

test('full backup can be restored into empty storage', () => {
  seedStorage();
  const backup = createFullBackup();
  const memory = installMemoryStorage();

  const restored = restoreFullBackup(backup);

  assert.equal(restored.tasks, 3);
  assert.equal(restored.moods, 1);

  const tree = JSON.parse(memory.storage.getItem('bonsai-tasks-tree'));
  const moods = JSON.parse(memory.storage.getItem('bonsai-moods'));
  const archive = JSON.parse(memory.storage.getItem('bonsai-archive'));

  assert.equal(tree.children[0].name, 'Задача A');
  assert.equal(tree.children[0].sortTimeScore, 2.5);
  assert.equal(tree.children[0].difficultyCalibrated, true);
  assert.equal(tree.children[0].duration.calibrated, true);
  assert.equal(moods[0].priorities['task-a'], 8);
  assert.deepEqual(moods[0].hiddenTasks, ['folder-b']);
  assert.deepEqual(moods[0].sorting.weights, {
    importance: 0.5,
    time: 0.3,
    difficulty: 0.2
  });
  assert.equal(moods[0].sorting.presetId, 'custom');
  assert.equal(archive.length, 1);
  assert.equal(memory.storage.getItem('bonsai-theme'), 'bonsai');
  assert.equal(memory.storage.getItem('bonsai-active-mood'), 'default');
  assert.equal(memory.storage.getItem('bonsai-show-hidden'), 'true');
  assert.equal(memory.storage.getItem('bonsai-current-mode'), 'navigation');
  assert.equal(memory.storage.getItem('bonsai-test-extra'), '{"enabled":true}');
  assert.equal(memory.storage.getItem('bonsai-active-timer'), null);
  assert.equal(memory.storage.getItem('bonsai-tinder-last-path'), null);
});

test('backup validation rejects foreign and broken files', () => {
  assert.ok(validateFullBackup(null));
  assert.match(validateFullBackup({ app: 'other' }), /не полный бэкап/i);
  assert.match(validateFullBackup({ app: 'bonsai', kind: 'full-backup', version: 1 }), /нет данных/i);
  assert.match(validateFullBackup({
    app: 'bonsai',
    kind: 'full-backup',
    version: 1,
    data: { tasksTree: { name: 'x' }, moods: [] }
  }), /настроений/i);
});
