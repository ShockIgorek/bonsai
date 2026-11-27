import test from 'node:test';
import assert from 'node:assert/strict';
import { getMoodTasks } from '../src/logic/priority-tasks.js';
import { installMemoryStorage } from './helpers/memory-storage.js';

function seed() {
  return installMemoryStorage({
    'bonsai-tasks-tree': {
      id: 'root',
      name: 'Мои задачи',
      children: [
        {
          id: 'folder',
          name: 'Дом',
          children: [
            {
              id: 'measured',
              name: 'С замером',
              type: 'cyclic',
              duration: { estimated: 30, actual: null },
              timeScore: 1.25,
              difficulty: 3,
              completionHistory: [{ at: 1, actualMinutes: 25, difficulty: 7 }]
            },
            {
              id: 'subjective',
              name: 'Без замера',
              type: 'single',
              duration: { estimated: 20, actual: null, calibrated: true },
              timeScore: 0.8,
              sortTimeScore: 2,
              difficulty: 4,
              difficultyCalibrated: true
            }
          ]
        }
      ]
    },
    'bonsai-moods': [
      {
        id: 'default',
        name: 'Норма',
        priorities: { measured: 8, subjective: 5 },
        hiddenTasks: []
      },
      {
        id: 'tired',
        name: 'Устал',
        priorities: {},
        hiddenTasks: ['folder']
      }
    ]
  });
}

test('mood tasks expose actual/subjective time and difficulty', () => {
  seed();

  const { tasks } = getMoodTasks('default');
  const measured = tasks.find(task => task.id === 'measured');
  const subjective = tasks.find(task => task.id === 'subjective');

  assert.equal(measured.timeIsActual, true);
  assert.equal(measured.timeMinutes, 25);
  assert.equal(measured.difficultyIsActual, true);
  assert.equal(measured.difficulty, 7);
  assert.equal(measured.anchors.time, true);
  assert.equal(measured.anchors.difficulty, true);
  assert.equal(measured.priority, 8);

  assert.equal(subjective.timeIsActual, false);
  assert.equal(subjective.timeMinutes, 20);
  assert.equal(subjective.timeCalibrated, true);
  assert.equal(subjective.difficultyIsActual, false);
  assert.equal(subjective.difficulty, 4);
  assert.equal(subjective.difficultyCalibrated, true);
  assert.equal(subjective.anchors.time, false);
  assert.equal(subjective.priority, 5);
});

test('hidden folder removes its children from calibration', () => {
  seed();

  const { tasks } = getMoodTasks('tired');

  assert.equal(tasks.length, 0);
});
