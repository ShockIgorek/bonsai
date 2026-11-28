import { mkdir, writeFile } from 'node:fs/promises';
import { buildTestBackup, TEST_NOW } from '../test/fixtures/test-backup.js';
import { installMemoryStorage } from '../test/helpers/memory-storage.js';
import { buildNavIndex } from '../src/store.js';
import { getMoodSorting, scoreTask } from '../src/logic/tinder-ranking.js';
import { createPriorityResolver } from '../src/data/mood-priorities.js';
import { getCooldownState } from '../src/logic/cyclic-schedule.js';
import { getStreakSegments, getDisplayStreakSegments } from '../src/logic/streak.js';
import { getAverageActualMinutes } from '../src/logic/task-time.js';
import { getDifficultyRatings } from '../src/logic/cyclic-schedule.js';
import { isTaskHiddenForMood } from '../src/data/moods-store.js';

const HOUR = 3600000;
const nowArg = process.argv[2];
const now = nowArg ? Number(nowArg) : Date.now();
const backup = buildTestBackup({ now });
const nav = buildNavIndex(backup.data.tasksTree);

installMemoryStorage({
  'bonsai-tasks-tree': backup.data.tasksTree,
  'bonsai-moods': backup.data.moods
});

function sourceTime(node) {
  if (getAverageActualMinutes(node) !== null) return 'факт';
  if (node.duration && node.duration.calibrated) return 'калибровка';
  return 'оценка';
}

function sourceDifficulty(node) {
  if (getDifficultyRatings(node).length > 0) return 'факт';
  if (node.difficultyCalibrated) return 'калибровка';
  return 'оценка';
}

function collectMoodOrder(mood) {
  const sorting = getMoodSorting(mood);
  const resolver = createPriorityResolver(nav, mood.id);
  const items = [];

  nav.byId.forEach(node => {
    if (node.id === nav.rootId || !node.isLeaf) return;
    if (mood.id !== 'default' && isTaskHiddenForMood(mood.id, node.id)) return;

    const cooldown = getCooldownState(node, now);
    const base = scoreTask({
      importance: resolver.resolve(node.id),
      timeScore: node.sortTimeScore !== null && node.sortTimeScore !== undefined
        ? node.sortTimeScore
        : node.timeScore,
      difficulty: node.difficulty
    }, sorting);

    items.push({
      id: node.id,
      name: node.name,
      path: node.path.join(' / '),
      base: Number(base.toFixed(3)),
      multiplier: Number(cooldown.multiplier.toFixed(3)),
      score: Number((base * cooldown.multiplier).toFixed(3)),
      timeSource: sourceTime(node),
      difficultySource: sourceDifficulty(node)
    });
  });

  return items.sort((a, b) => b.score - a.score);
}

const moods = {};
for (const mood of backup.data.moods) {
  moods[mood.id] = collectMoodOrder(mood);
}

const cooldownIds = ['task-cooldown-50', 'task-cooldown-0', 'task-bonus', 'task-no-bonus'];
const cooldown = {};
for (const id of cooldownIds) {
  const node = nav.byId.get(id);
  const state = getCooldownState(node, now);
  cooldown[id] = {
    name: node.name,
    isCooling: state.isCooling,
    ratio: Number(state.ratio.toFixed(3)),
    multiplier: Number(state.multiplier.toFixed(3)),
    opacity: Number(state.opacity.toFixed(3)),
    remainingHours: Number((state.remainingMs / HOUR).toFixed(2))
  };
}

const streakIds = ['task-streak-21', 'task-streak-31', 'task-streak-41', 'task-streak-61'];
const streak = {};
for (const id of streakIds) {
  const node = nav.byId.get(id);
  streak[id] = {
    name: node.name,
    segments: getStreakSegments(node, now),
    displaySegments: getDisplayStreakSegments(node, now)
  };
}

const expected = {
  generatedAt: new Date().toISOString(),
  now: new Date(now).toISOString(),
  nowMs: now,
  moods,
  cooldown,
  streak,
  counts: {
    tasks: backup.data.tasksTree.children.reduce((total, branch) => (
      total + 1 + (branch.children || []).length
    ), 0),
    moods: backup.data.moods.length,
    archive: backup.data.archive.length,
    log: backup.data.log.length
  }
};

await mkdir('test-backup', { recursive: true });
await writeFile('test-backup/bonsai-test-backup.json', JSON.stringify(backup, null, 2));
await writeFile('test-backup/expected-results.json', JSON.stringify(expected, null, 2));

console.log(`Тестовый бэкап: test-backup/bonsai-test-backup.json`);
console.log(`Ожидаемые результаты: test-backup/expected-results.json`);
console.log(`Время фикстуры: ${expected.now}`);
console.log('');

for (const [moodId, items] of Object.entries(moods)) {
  console.log(`Порядок Тиндера · ${moodId}`);
  items.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.name} (${item.id}) score=${item.score}`);
  });
  console.log('');
}

console.log('Кулдаун');
for (const [id, state] of Object.entries(cooldown)) {
  console.log(`  ${id}: cooling=${state.isCooling}, ratio=${state.ratio}, multiplier=${state.multiplier}, remaining=${state.remainingHours}ч`);
}

console.log('');
console.log('Серия');
for (const [id, state] of Object.entries(streak)) {
  console.log(`  ${id}: статистика [${state.segments.join(', ')}] · карточка [${state.displaySegments.join(', ')}]`);
}

console.log('');
console.log('Импортируй файл сразу после генерации: состояния кулдауна зависят от текущего времени.');
console.log(`Для фиксированного времени: node scripts/generate-test-backup.js ${TEST_NOW}`);
