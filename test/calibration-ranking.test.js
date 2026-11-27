import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCalibrationSession,
  applyCalibrationChoice,
  getCalibrationProgress,
  finalizeCalibrationSession,
  pickNextPair
} from '../src/logic/calibration-ranking.js';

function baseTask(id, overrides = {}) {
  return {
    id,
    name: id,
    parentId: 'parent',
    topBranchId: 'branch',
    anchors: { time: false, difficulty: false },
    values: { importance: 5, time: 20, difficulty: 5 },
    timeMinutes: 20,
    timeScore: 0.8,
    difficulty: 5,
    ...overrides
  };
}

test('session creates ratings and counts for all dimensions', () => {
  const session = createCalibrationSession([baseTask('a'), baseTask('b')]);

  assert.deepEqual(Object.keys(session.dimensions), ['importance', 'time', 'difficulty']);
  assert.equal(session.dimensions.importance.counts.a, 0);
  assert.equal(session.dimensions.time.ratings.a, 1000 + (10 - 0.8) * 20);
});

test('two anchored tasks cannot be compared in their dimension', () => {
  const session = createCalibrationSession([
    baseTask('a', { anchors: { time: true, difficulty: true } }),
    baseTask('b', { anchors: { time: true, difficulty: true } })
  ]);

  assert.equal(applyCalibrationChoice(session, 'time', 'a', 'b'), false);
  assert.equal(session.dimensions.time.comparisons, 0);
  assert.equal(session.dimensions.time.counts.a, 0);
});

test('anchor and subjective task can be compared, anchor stays fixed', () => {
  const session = createCalibrationSession([
    baseTask('anchor', { anchors: { time: true, difficulty: false }, timeMinutes: 10, timeScore: 0.4 }),
    baseTask('subjective', { timeMinutes: 30, timeScore: 1.2 })
  ]);

  const before = session.dimensions.time.ratings.anchor;
  assert.equal(applyCalibrationChoice(session, 'time', 'subjective', 'anchor'), true);
  assert.equal(session.dimensions.time.ratings.anchor, before);
  assert.ok(session.dimensions.time.ratings.subjective > 1000);
  assert.equal(session.dimensions.time.comparisons, 1);
});

test('time interpolation uses anchored minutes and clamps outside', () => {
  const session = createCalibrationSession([
    baseTask('a', { anchors: { time: true, difficulty: false }, timeMinutes: 20 }),
    baseTask('b', { anchors: { time: true, difficulty: false }, timeMinutes: 10 }),
    baseTask('c'),
    baseTask('fast'),
    baseTask('slow')
  ]);

  session.dimensions.time.ratings = {
    fast: 1300,
    b: 1200,
    c: 1150,
    a: 1100,
    slow: 1000
  };
  session.dimensions.time.counts = { fast: 1, c: 1, slow: 1 };
  session.dimensions.time.comparisons = 3;

  const result = finalizeCalibrationSession(session).time;

  assert.equal(result.a.source, 'fact');
  assert.equal(result.b.source, 'fact');
  assert.equal(result.a.minutes, 20);
  assert.equal(result.b.minutes, 10);
  assert.equal(result.c.minutes, 15);
  assert.equal(result.fast.minutes, 10);
  assert.equal(result.slow.minutes, 20);
});

test('one time anchor shifts relative sort scores around the fact', () => {
  const session = createCalibrationSession([
    baseTask('anchor', { anchors: { time: true, difficulty: false }, timeMinutes: 20, timeScore: 0.8 }),
    baseTask('fast'),
    baseTask('slow')
  ]);

  session.dimensions.time.ratings = { fast: 1200, anchor: 1100, slow: 1000 };
  session.dimensions.time.counts = { fast: 1, slow: 1 };
  session.dimensions.time.comparisons = 2;

  const result = finalizeCalibrationSession(session).time;

  assert.equal(result.anchor.source, 'fact');
  assert.ok(result.fast.sortTimeScore < 0.8);
  assert.ok(result.slow.sortTimeScore > 0.8);
});

test('difficulty interpolation uses anchored values and clamps outside', () => {
  const session = createCalibrationSession([
    baseTask('hard', { anchors: { time: false, difficulty: true }, difficulty: 8 }),
    baseTask('easy', { anchors: { time: false, difficulty: true }, difficulty: 2 }),
    baseTask('middle'),
    baseTask('harder'),
    baseTask('easier')
  ]);

  session.dimensions.difficulty.ratings = {
    harder: 1300,
    hard: 1200,
    middle: 1150,
    easy: 1100,
    easier: 1000
  };
  session.dimensions.difficulty.counts = { harder: 1, middle: 1, easier: 1 };
  session.dimensions.difficulty.comparisons = 3;

  const result = finalizeCalibrationSession(session).difficulty;

  assert.equal(result.hard.source, 'fact');
  assert.equal(result.easy.source, 'fact');
  assert.equal(result.middle.value, 5);
  assert.equal(result.harder.value, 8);
  assert.equal(result.easier.value, 2);
});

test('importance finalization only updates compared tasks', () => {
  const session = createCalibrationSession([
    baseTask('a'),
    baseTask('b'),
    baseTask('c')
  ]);

  session.dimensions.importance.ratings = { a: 1200, b: 1100, c: 1000 };
  session.dimensions.importance.counts = { a: 1, b: 1, c: 0 };
  session.dimensions.importance.comparisons = 1;

  const importance = finalizeCalibrationSession(session).importance;

  assert.deepEqual(importance, { a: 10, b: 5 });
});

test('progress levels follow 1/2/3 comparisons per task', () => {
  const session = createCalibrationSession([baseTask('a'), baseTask('b')]);

  for (const dimension of ['importance', 'time', 'difficulty']) {
    session.dimensions[dimension].counts = { a: 1, b: 1 };
    session.dimensions[dimension].comparisons = 1;
  }
  session.comparisons = 3;
  assert.equal(getCalibrationProgress(session).accuracyLabel, 'примерная');

  for (const dimension of ['importance', 'time', 'difficulty']) {
    session.dimensions[dimension].counts = { a: 2, b: 2 };
  }
  assert.equal(getCalibrationProgress(session).accuracyLabel, 'средняя');

  for (const dimension of ['importance', 'time', 'difficulty']) {
    session.dimensions[dimension].counts = { a: 3, b: 3 };
  }
  assert.equal(getCalibrationProgress(session).accuracyLabel, 'высокая');
});

test('pair selection never offers two time anchors for the time question', () => {
  const tasks = [
    baseTask('anchor-a', { anchors: { time: true, difficulty: false } }),
    baseTask('anchor-b', { anchors: { time: true, difficulty: false } }),
    baseTask('subjective-c'),
    baseTask('subjective-d')
  ];
  const session = createCalibrationSession(tasks);

  // Уводим важность и сложность на высокую точность,
  // чтобы следующим вопросом стала скорость.
  for (const dimension of ['importance', 'difficulty']) {
    session.dimensions[dimension].counts = {
      'anchor-a': 3,
      'anchor-b': 3,
      'subjective-c': 3,
      'subjective-d': 3
    };
    session.dimensions[dimension].comparisons = 6;
  }
  session.comparisons = 12;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const next = pickNextPair(session);
    assert.ok(next);
    assert.equal(next.dimension, 'time');

    const [a, b] = next.pair;
    const anchors = [a, b].filter(task => task.anchors.time);
    assert.ok(anchors.length <= 1, 'two time anchors must not be compared');
  }
});
