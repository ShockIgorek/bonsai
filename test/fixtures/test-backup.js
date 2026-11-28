import { timeToScore } from '../../src/logic/task-metrics.js';

export const HOUR = 3600000;

export const TEST_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

function completion(at, actualMinutes, difficulty = 5, moodId = 'default') {
  return { at, actualMinutes, difficulty, moodId };
}

function cyclicTask({
  id,
  name,
  desc,
  priority,
  intervalHours,
  duration,
  difficulty,
  completionHistory = [],
  extra = {}
}) {
  return {
    id,
    name,
    desc,
    type: 'cyclic',
    priority,
    difficulty,
    timeScore: timeToScore(duration),
    image: '',
    duration: { estimated: duration, actual: null },
    interval: { totalMinutes: intervalHours * 60 },
    completionHistory,
    ...extra
  };
}

export function buildTestBackup({ now = TEST_NOW } = {}) {
  const at = hoursAgo => now - hoursAgo * HOUR;
  const deadline = new Date(now + 3 * 24 * HOUR).toISOString().slice(0, 10);

  const tasksTree = {
    id: 'root',
    name: 'Тестовое дерево',
    children: [
      {
        id: 'branch-work',
        name: 'Работа',
        children: [
          cyclicTask({
            id: 'task-cooldown-50',
            name: 'Кулдаун 50%',
            desc: '24 часа, выполнена 12 часов назад',
            priority: 8,
            intervalHours: 24,
            duration: 30,
            difficulty: 5,
            completionHistory: [completion(at(12), 30, 5)]
          }),
          cyclicTask({
            id: 'task-streak-21',
            name: 'Серия 21ч',
            desc: 'Интервал 20 часов, выполнения 42 и 21 час назад',
            priority: 6,
            intervalHours: 20,
            duration: 20,
            difficulty: 5,
            completionHistory: [completion(at(42), 20, 5), completion(at(21), 20, 5)]
          }),
          cyclicTask({
            id: 'task-streak-31',
            name: 'Серия 31ч',
            desc: 'Интервал 20 часов, выполнения 62 и 31 час назад',
            priority: 5,
            intervalHours: 20,
            duration: 25,
            difficulty: 6,
            completionHistory: [completion(at(62), 25, 6), completion(at(31), 25, 6)]
          }),
          {
            id: 'task-hidden',
            name: 'Скрытая для Устал',
            desc: 'Не должна появляться в настроении Устал',
            type: 'single',
            priority: 10,
            difficulty: 2,
            timeScore: timeToScore(10),
            image: '',
            duration: { estimated: 10, actual: null },
            deadline: null
          }
        ]
      },
      {
        id: 'branch-home',
        name: 'Дом',
        children: [
          cyclicTask({
            id: 'task-cooldown-0',
            name: 'Только что выполнена',
            desc: '10 часов, выполнена минуту назад',
            priority: 9,
            intervalHours: 10,
            duration: 20,
            difficulty: 3,
            completionHistory: [completion(at(1 / 60), 20, 3)]
          }),
          cyclicTask({
            id: 'task-streak-41',
            name: 'Серия 41ч',
            desc: 'Интервал 20 часов, выполнения 82 и 41 час назад',
            priority: 4,
            intervalHours: 20,
            duration: 20,
            difficulty: 5,
            completionHistory: [completion(at(82), 20, 5), completion(at(41), 20, 5)]
          }),
          cyclicTask({
            id: 'task-streak-61',
            name: 'Серия 61ч',
            desc: 'Интервал 20 часов, выполнения 122 и 61 час назад',
            priority: 3,
            intervalHours: 20,
            duration: 20,
            difficulty: 5,
            completionHistory: [completion(at(122), 20, 5), completion(at(61), 20, 5)]
          }),
          {
            id: 'task-single',
            name: 'Одноразовая с дедлайном',
            desc: 'Дедлайн через 3 дня',
            type: 'single',
            priority: 7,
            difficulty: 6,
            timeScore: timeToScore(45),
            image: '',
            duration: { estimated: 45, actual: null },
            deadline
          }
        ]
      },
      {
        id: 'branch-health',
        name: 'Здоровье',
        children: [
          cyclicTask({
            id: 'task-bonus',
            name: 'Бонус 1.25',
            desc: '10 часов, выполнена 12 часов назад',
            priority: 7,
            intervalHours: 10,
            duration: 15,
            difficulty: 4,
            completionHistory: [completion(at(12), 15, 4)]
          }),
          cyclicTask({
            id: 'task-no-bonus',
            name: 'Без бонуса',
            desc: '10 часов, выполнена 16 часов назад',
            priority: 6,
            intervalHours: 10,
            duration: 25,
            difficulty: 6,
            completionHistory: [completion(at(16), 25, 6)]
          }),
          {
            id: 'task-subjective',
            name: 'Без фактических замеров',
            desc: 'Только субъективная оценка времени и сложности',
            type: 'cyclic',
            priority: 4,
            difficulty: 7,
            timeScore: timeToScore(60),
            image: '',
            duration: { estimated: 60, actual: null },
            interval: { totalMinutes: 48 * 60 },
            completionHistory: []
          },
          {
            id: 'task-calibrated',
            name: 'Калиброванная',
            desc: 'Субъективная задача после калибровки',
            type: 'cyclic',
            priority: 6,
            difficulty: 5,
            timeScore: timeToScore(25),
            image: '',
            duration: { estimated: 25, actual: null, calibrated: true },
            sortTimeScore: 0.5,
            difficultyCalibrated: true,
            interval: { totalMinutes: 72 * 60 },
            completionHistory: []
          }
        ]
      }
    ]
  };

  const basePriorities = {
    'task-cooldown-50': 8,
    'task-streak-21': 6,
    'task-streak-31': 5,
    'task-hidden': 10,
    'task-cooldown-0': 9,
    'task-streak-41': 4,
    'task-streak-61': 3,
    'task-single': 7,
    'task-bonus': 7,
    'task-no-bonus': 6,
    'task-subjective': 4,
    'task-calibrated': 6
  };

  const moods = [
    {
      id: 'default',
      name: 'Норма',
      description: 'Баланс',
      theme: 'bonsai',
      image: '',
      priorities: basePriorities,
      hiddenTasks: [],
      sorting: {
        weights: { importance: 0.6, time: 0.25, difficulty: 0.15 },
        directions: { importance: 1, time: -1, difficulty: -1 },
        presetId: 'balance'
      }
    },
    {
      id: 'tired',
      name: 'Устал',
      description: 'Короче, проще, без высоких ставок',
      theme: 'bonsai',
      image: '',
      priorities: {
        ...basePriorities,
        'task-calibrated': 9,
        'task-subjective': 7,
        'task-cooldown-0': 8,
        'task-bonus': 6,
        'task-cooldown-50': 5,
        'task-no-bonus': 3,
        'task-single': 6
      },
      hiddenTasks: ['task-hidden'],
      sorting: {
        weights: { importance: 0.2, time: 0.4, difficulty: 0.4 },
        directions: { importance: -1, time: -1, difficulty: -1 },
        presetId: 'rest'
      }
    },
    {
      id: 'machine',
      name: 'Я машина',
      description: 'Важное, длинное, сложное',
      theme: 'bonsai',
      image: '',
      priorities: {
        ...basePriorities,
        'task-cooldown-50': 9,
        'task-no-bonus': 8,
        'task-single': 8,
        'task-streak-31': 7,
        'task-streak-61': 6,
        'task-streak-41': 6,
        'task-streak-21': 6,
        'task-subjective': 4,
        'task-calibrated': 5
      },
      hiddenTasks: [],
      sorting: {
        weights: { importance: 0.4, time: 0.3, difficulty: 0.3 },
        directions: { importance: 1, time: 1, difficulty: 1 },
        presetId: 'machine'
      }
    }
  ];

  const archive = [
    {
      archiveId: 'archive-test-1',
      name: 'Старая задача',
      desc: 'Архивная запись для проверки восстановления',
      type: 'single',
      priority: 5,
      difficulty: 4,
      timeScore: timeToScore(20),
      image: '',
      duration: { estimated: 20, actual: null },
      deadline: null,
      archivedAt: at(120),
      moodId: 'default',
      parentPath: ['Тестовое дерево', 'Дом']
    }
  ];

  const log = [
    {
      taskId: 'task-cooldown-50',
      taskName: 'Кулдаун 50%',
      taskType: 'cyclic',
      moodId: 'default',
      completedAt: at(12),
      parentPath: ['Тестовое дерево', 'Работа'],
      taskPath: ['Тестовое дерево', 'Работа', 'Кулдаун 50%'],
      difficulty: 5,
      actualMinutes: 30
    },
    {
      taskId: 'task-bonus',
      taskName: 'Бонус 1.25',
      taskType: 'cyclic',
      moodId: 'default',
      completedAt: at(12),
      parentPath: ['Тестовое дерево', 'Здоровье'],
      taskPath: ['Тестовое дерево', 'Здоровье', 'Бонус 1.25'],
      difficulty: 4,
      actualMinutes: 15
    }
  ];

  return {
    app: 'bonsai',
    kind: 'full-backup',
    version: 1,
    exportedAt: new Date(now).toISOString(),
    buildId: 'test-fixture',
    includesImages: false,
    test: {
      now,
      description: 'Детерминированный тестовый бэкап для проверки сортировки, кулдауна, серии, якорей и архива'
    },
    data: {
      tasksTree,
      moods,
      archive,
      log,
      settings: {
        theme: 'bonsai',
        activeMood: 'default',
        showHidden: 'false',
        currentMode: 'tinder'
      },
      extra: {
        'bonsai-test-marker': 'test-backup-v1'
      }
    }
  };
}
