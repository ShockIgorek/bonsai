// Калибровка трёх измерений: важность, скорость и сложность.
// Elo-рейтинги живут только внутри сессии, а задачи с фактическими
// замерами являются неподвижными якорями.

export const DIMENSIONS = ['importance', 'time', 'difficulty'];
export const TEST_START_RATING = 1000;
export const TEST_K_FACTOR = 64;
export const MAX_ACCURACY_LEVEL = 3;

function clamp(value, min = 0, max = 10) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function randomFrom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function isAnchor(task, dimension) {
  return !!(task && task.anchors && task.anchors[dimension]);
}

function initialRating(task, dimension) {
  if (dimension === 'time') {
    const speed = 10 - clamp(task.timeScore);
    return TEST_START_RATING + speed * 20;
  }

  if (dimension === 'difficulty') {
    return TEST_START_RATING + clamp(task.difficulty) * 20;
  }

  return TEST_START_RATING + clamp(task.values && task.values.importance) * 20;
}

function dimensionState(session, dimension) {
  return session.dimensions[dimension];
}

function eligibleTasks(session, dimension) {
  return session.tasks.filter(task => !isAnchor(task, dimension));
}

function anchorTasks(session, dimension) {
  return session.tasks.filter(task => isAnchor(task, dimension));
}

function levelForCounts(eligible, counts) {
  if (!eligible.length) return MAX_ACCURACY_LEVEL;

  let level = 0;
  for (let next = 1; next <= MAX_ACCURACY_LEVEL; next += 1) {
    if (eligible.every(task => (counts[task.id] || 0) >= next)) {
      level = next;
    } else {
      break;
    }
  }
  return level;
}

function dimensionProgress(session, dimension) {
  const state = dimensionState(session, dimension);
  const eligible = eligibleTasks(session, dimension);
  const anchors = anchorTasks(session, dimension);
  const level = levelForCounts(eligible, state.counts);
  const nextLevel = Math.min(MAX_ACCURACY_LEVEL, level + 1);
  const coveredNext = eligible.filter(task => (state.counts[task.id] || 0) >= nextLevel).length;
  const coverageNext = eligible.length ? coveredNext / eligible.length : 1;
  const canCompare = eligible.length >= 2 || (eligible.length >= 1 && anchors.length >= 1);
  const done = !canCompare || level >= MAX_ACCURACY_LEVEL;

  return {
    dimension,
    eligible: eligible.length,
    anchors: anchors.length,
    level,
    nextLevel,
    coverageNext,
    canCompare,
    done,
    comparisons: state.comparisons,
    score: done ? Number.POSITIVE_INFINITY : level + coverageNext
  };
}

export function getCalibrationProgress(session) {
  const dimensions = {};
  let overallLevel = MAX_ACCURACY_LEVEL;
  let anyComparable = false;

  for (const dimension of DIMENSIONS) {
    const progress = dimensionProgress(session, dimension);
    dimensions[dimension] = progress;
    if (progress.canCompare) {
      anyComparable = true;
      overallLevel = Math.min(overallLevel, progress.level);
    }
  }

  if (!anyComparable) overallLevel = 0;

  const comparable = DIMENSIONS
    .map(dimension => dimensions[dimension])
    .filter(progress => progress.canCompare);
  const averageNextCoverage = comparable.length
    ? comparable.reduce((sum, progress) => sum + progress.coverageNext, 0) / comparable.length
    : 1;

  const labels = ['нет данных', 'примерная', 'средняя', 'высокая'];

  return {
    dimensions,
    level: overallLevel,
    accuracyLabel: labels[overallLevel] || labels[0],
    progress: Math.min(1, (overallLevel + averageNextCoverage) / MAX_ACCURACY_LEVEL),
    comparisons: session.comparisons,
    canFinish: session.comparisons > 0
  };
}

export function createCalibrationSession(tasks) {
  const sessionTasks = tasks.map(task => ({ ...task }));
  const dimensions = {};

  for (const dimension of DIMENSIONS) {
    const ratings = {};
    const counts = {};

    for (const task of sessionTasks) {
      ratings[task.id] = initialRating(task, dimension);
      counts[task.id] = 0;
    }

    dimensions[dimension] = {
      ratings,
      counts,
      comparisons: 0,
      lastPairKey: null,
      seenPairs: new Set()
    };
  }

  return {
    tasks: sessionTasks,
    dimensions,
    comparisons: 0
  };
}

function updateRatings(state, winnerId, loserId, score) {
  const winnerRating = state.ratings[winnerId];
  const loserRating = state.ratings[loserId];
  if (!Number.isFinite(winnerRating) || !Number.isFinite(loserRating)) return false;

  const expected = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const delta = TEST_K_FACTOR * (score - expected);

  const winner = state.winnerAnchor;
  const loser = state.loserAnchor;

  if (!winner) state.ratings[winnerId] = winnerRating + delta;
  if (!loser) state.ratings[loserId] = loserRating - delta;

  state.counts[winnerId] = (state.counts[winnerId] || 0) + 1;
  state.counts[loserId] = (state.counts[loserId] || 0) + 1;
  state.comparisons += 1;
  return true;
}

export function applyCalibrationChoice(session, dimension, winnerId, loserId) {
  const state = dimensionState(session, dimension);
  if (!state) return false;

  const winner = session.tasks.find(task => task.id === winnerId);
  const loser = session.tasks.find(task => task.id === loserId);
  if (!winner || !loser || winnerId === loserId) return false;

  const winnerAnchor = isAnchor(winner, dimension);
  const loserAnchor = isAnchor(loser, dimension);
  if (winnerAnchor && loserAnchor) return false;

  state.winnerAnchor = winnerAnchor;
  state.loserAnchor = loserAnchor;
  const updated = updateRatings(state, winnerId, loserId, 1);
  delete state.winnerAnchor;
  delete state.loserAnchor;
  if (!updated) return false;

  const key = pairKey(winnerId, loserId);
  state.lastPairKey = key;
  state.seenPairs.add(key);
  session.comparisons += 1;
  return true;
}

export function applyCalibrationDraw(session, dimension, aId, bId) {
  const state = dimensionState(session, dimension);
  if (!state) return false;

  const a = session.tasks.find(task => task.id === aId);
  const b = session.tasks.find(task => task.id === bId);
  if (!a || !b || aId === bId) return false;

  const aAnchor = isAnchor(a, dimension);
  const bAnchor = isAnchor(b, dimension);
  if (aAnchor && bAnchor) return false;

  state.winnerAnchor = aAnchor;
  state.loserAnchor = bAnchor;
  const updated = updateRatings(state, aId, bId, 0.5);
  delete state.winnerAnchor;
  delete state.loserAnchor;
  if (!updated) return false;

  const key = pairKey(aId, bId);
  state.lastPairKey = key;
  state.seenPairs.add(key);
  session.comparisons += 1;
  return true;
}

function nearestAnchors(task, anchors, state, limit = 2) {
  const rating = state.ratings[task.id];

  return anchors
    .filter(anchor => anchor.id !== task.id)
    .slice()
    .sort((a, b) => (
      Math.abs(state.ratings[a.id] - rating) - Math.abs(state.ratings[b.id] - rating)
    ))
    .slice(0, limit);
}

function pairScore(a, b, dimension, state, level) {
  const counts = state.counts;
  const aAnchor = isAnchor(a, dimension);
  const bAnchor = isAnchor(b, dimension);
  const key = pairKey(a.id, b.id);

  let score = -((counts[a.id] || 0) + (counts[b.id] || 0)) * 10;

  if (aAnchor || bAnchor) {
    const subjective = aAnchor ? b : a;
    // Первое сравнение с якорем важно, дальше — уже не так сильно.
    score += (counts[subjective.id] || 0) === 0 ? 60 : 10;
  } else {
    const sameParent = a.parentId === b.parentId;
    const crossBranch = a.topBranchId !== b.topBranchId;

    if (sameParent) score += level >= 2 ? 10 : 40;
    else if (crossBranch) score += level >= 1 ? 40 : 10;
  }

  const ratingGap = Math.abs(state.ratings[a.id] - state.ratings[b.id]);
  score -= Math.min(20, ratingGap / 20);

  if (state.seenPairs.has(key)) score -= 1000;
  if (state.lastPairKey === key) score -= 2000;

  return score;
}

function pickPairForDimension(session, dimension) {
  const state = dimensionState(session, dimension);
  const nonAnchors = eligibleTasks(session, dimension);
  const anchors = anchorTasks(session, dimension);

  if (!nonAnchors.length) return null;
  if (nonAnchors.length < 2 && !anchors.length) return null;

  const zero = nonAnchors.filter(task => (state.counts[task.id] || 0) === 0);

  // Сначала даём каждой субъективной задаче хотя бы одно сравнение.
  if (zero.length) {
    const task = randomFrom(zero);

    if (anchors.length) {
      return [task, randomFrom(nearestAnchors(task, anchors, state))];
    }

    const sameParent = nonAnchors.filter(other => (
      other.id !== task.id && other.parentId === task.parentId
    ));
    if (sameParent.length) {
      return [task, randomFrom(sameParent)];
    }

    const others = nonAnchors.filter(other => other.id !== task.id);
    if (others.length) {
      return [task, randomFrom(others)];
    }
  }

  const level = levelForCounts(nonAnchors, state.counts);
  const minCount = Math.min(...nonAnchors.map(task => state.counts[task.id] || 0));
  const pool = nonAnchors
    .filter(task => (state.counts[task.id] || 0) <= minCount + 1)
    .slice();

  // Добавляем представителей других веток, чтобы появились кросс-веточные пары.
  const byBranch = new Map();
  for (const task of nonAnchors) {
    const key = task.topBranchId || task.id;
    if (!byBranch.has(key)) byBranch.set(key, []);
    byBranch.get(key).push(task);
  }
  for (const branchTasks of byBranch.values()) {
    const sorted = branchTasks.slice().sort((a, b) => state.ratings[b.id] - state.ratings[a.id]);
    for (const task of [sorted[0], sorted[sorted.length - 1]]) {
      if (task && !pool.some(item => item.id === task.id)) pool.push(task);
    }
  }

  const candidates = [];
  const seenCandidateKeys = new Set();

  function addCandidate(a, b) {
    if (!a || !b || a.id === b.id) return;
    if (isAnchor(a, dimension) && isAnchor(b, dimension)) return;

    const key = pairKey(a.id, b.id);
    if (seenCandidateKeys.has(key)) return;
    seenCandidateKeys.add(key);
    candidates.push([a, b]);
  }

  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      addCandidate(pool[i], pool[j]);
    }
  }

  for (const task of pool) {
    for (const anchor of nearestAnchors(task, anchors, state)) {
      addCandidate(task, anchor);
    }
  }

  if (!candidates.length) {
    const a = randomFrom(nonAnchors);
    const b = randomFrom(session.tasks.filter(task => task.id !== a.id));
    if (!b) return null;
    if (isAnchor(a, dimension) && isAnchor(b, dimension)) return null;
    return [a, b];
  }

  candidates.sort((left, right) => (
    pairScore(right[0], right[1], dimension, state, level)
    - pairScore(left[0], left[1], dimension, state, level)
  ));

  return candidates[0];
}

export function pickNextPair(session) {
  const ordered = DIMENSIONS
    .map(dimension => dimensionProgress(session, dimension))
    .filter(progress => !progress.done)
    .sort((a, b) => (
      a.score - b.score
      || a.comparisons - b.comparisons
      || DIMENSIONS.indexOf(a.dimension) - DIMENSIONS.indexOf(b.dimension)
    ));

  for (const progress of ordered) {
    const pair = pickPairForDimension(session, progress.dimension);
    if (pair) {
      return { dimension: progress.dimension, pair };
    }
  }

  return null;
}

function normalizeByRank(tasks, ratings) {
  if (!tasks.length) return {};
  if (tasks.length === 1) return { [tasks[0].id]: 5.0 };

  const sorted = [...tasks].sort((a, b) => ratings[a.id] - ratings[b.id]);
  const result = {};
  let index = 0;

  while (index < sorted.length) {
    let end = index;
    while (
      end + 1 < sorted.length
      && Math.abs(ratings[sorted[end + 1].id] - ratings[sorted[index].id]) < 0.0001
    ) {
      end += 1;
    }

    const averageRank = (index + end) / 2;
    const value = (averageRank / (sorted.length - 1)) * 10;

    for (let i = index; i <= end; i += 1) {
      result[sorted[i].id] = round(value, 1);
    }
    index = end + 1;
  }

  return result;
}

function interpolateValues(tasks, ratings, anchors, getAnchorValue) {
  const sorted = [...tasks].sort((a, b) => ratings[b.id] - ratings[a.id]);
  const anchorSet = new Set(anchors.map(anchor => anchor.id));
  const anchorValues = new Map(anchors.map(anchor => [anchor.id, getAnchorValue(anchor)]));
  const anchorIndexes = [];

  sorted.forEach((task, index) => {
    if (anchorSet.has(task.id)) anchorIndexes.push(index);
  });

  if (anchorIndexes.length < 2) return {};

  const result = {};

  for (let index = 0; index < sorted.length; index += 1) {
    const task = sorted[index];

    if (anchorSet.has(task.id)) {
      result[task.id] = getAnchorValue(task);
      continue;
    }

    let previous = -1;
    let next = -1;

    for (const anchorIndex of anchorIndexes) {
      if (anchorIndex < index) previous = anchorIndex;
      else if (anchorIndex > index) {
        next = anchorIndex;
        break;
      }
    }

    if (previous >= 0 && next >= 0) {
      const previousTask = sorted[previous];
      const nextTask = sorted[next];
      const previousValue = anchorValues.get(previousTask.id);
      const nextValue = anchorValues.get(nextTask.id);
      const fraction = (index - previous) / (next - previous);
      result[task.id] = previousValue + (nextValue - previousValue) * fraction;
    } else if (next >= 0) {
      result[task.id] = anchorValues.get(sorted[next].id);
    } else if (previous >= 0) {
      result[task.id] = anchorValues.get(sorted[previous].id);
    }
  }

  return result;
}

function buildTimeResult(session) {
  const state = dimensionState(session, 'time');
  if (!state || state.comparisons === 0) return null;

  const anchors = anchorTasks(session, 'time');
  const result = {};

  if (anchors.length >= 2) {
    const interpolated = interpolateValues(
      session.tasks,
      state.ratings,
      anchors,
      task => task.timeMinutes
    );

    for (const task of session.tasks) {
      if (isAnchor(task, 'time')) {
        result[task.id] = {
          minutes: round(task.timeMinutes, 1),
          sortTimeScore: null,
          source: 'fact',
          calibrated: false
        };
      } else if ((state.counts[task.id] || 0) > 0 && interpolated[task.id] !== undefined) {
        result[task.id] = {
          minutes: Math.max(0, round(interpolated[task.id], 1)),
          sortTimeScore: null,
          source: 'calibration',
          calibrated: true
        };
      }
    }

    return result;
  }

  const ranked = normalizeByRank(session.tasks, state.ratings);
  const anchor = anchors[0];
  const shift = anchor
    ? clamp(anchor.timeScore) - (10 - ranked[anchor.id])
    : 0;

  for (const task of session.tasks) {
    if (isAnchor(task, 'time')) {
      result[task.id] = {
        minutes: round(task.timeMinutes, 1),
        sortTimeScore: null,
        source: 'fact',
        calibrated: false
      };
    } else if ((state.counts[task.id] || 0) > 0) {
      result[task.id] = {
        minutes: round(task.timeMinutes, 1),
        sortTimeScore: round(clamp(10 - ranked[task.id] + shift, 0, 10), 1),
        source: 'calibration',
        calibrated: true
      };
    }
  }

  return result;
}

function buildDifficultyResult(session) {
  const state = dimensionState(session, 'difficulty');
  if (!state || state.comparisons === 0) return null;

  const anchors = anchorTasks(session, 'difficulty');
  const result = {};

  if (anchors.length >= 2) {
    const interpolated = interpolateValues(
      session.tasks,
      state.ratings,
      anchors,
      task => task.difficulty
    );

    for (const task of session.tasks) {
      if (isAnchor(task, 'difficulty')) {
        result[task.id] = {
          value: round(task.difficulty, 1),
          source: 'fact',
          calibrated: false
        };
      } else if ((state.counts[task.id] || 0) > 0 && interpolated[task.id] !== undefined) {
        result[task.id] = {
          value: round(clamp(interpolated[task.id]), 1),
          source: 'calibration',
          calibrated: true
        };
      }
    }

    return result;
  }

  const ranked = normalizeByRank(session.tasks, state.ratings);
  const anchor = anchors[0];
  const shift = anchor
    ? clamp(anchor.difficulty) - ranked[anchor.id]
    : 0;

  for (const task of session.tasks) {
    if (isAnchor(task, 'difficulty')) {
      result[task.id] = {
        value: round(task.difficulty, 1),
        source: 'fact',
        calibrated: false
      };
    } else if ((state.counts[task.id] || 0) > 0) {
      result[task.id] = {
        value: round(clamp(ranked[task.id] + shift), 1),
        source: 'calibration',
        calibrated: true
      };
    }
  }

  return result;
}

export function finalizeCalibrationSession(session) {
  const importanceState = dimensionState(session, 'importance');
  let importance = null;

  if (importanceState && importanceState.comparisons > 0) {
    const ranked = normalizeByRank(session.tasks, importanceState.ratings);
    importance = {};

    for (const task of session.tasks) {
      if ((importanceState.counts[task.id] || 0) > 0) {
        importance[task.id] = ranked[task.id];
      }
    }
  }

  return {
    importance,
    time: buildTimeResult(session),
    difficulty: buildDifficultyResult(session),
    progress: getCalibrationProgress(session)
  };
}
