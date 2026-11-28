import test from 'node:test';
import assert from 'node:assert/strict';
import { cooldownPercent, cooldownShadeBackground } from '../src/utils/cooldown-display.js';

test('cooldown percentage never shows 100 before restoration', () => {
  assert.equal(cooldownPercent(0), 0);
  assert.equal(cooldownPercent(0.5), 50);
  assert.equal(cooldownPercent(0.999), 99);
  assert.equal(cooldownPercent(1), 99);
  assert.equal(cooldownPercent(-1), 0);
  assert.equal(cooldownPercent('bad'), 0);
});

test('cooldown shade reveals the card clockwise', () => {
  const start = cooldownShadeBackground(0);
  const half = cooldownShadeBackground(0.5);
  const end = cooldownShadeBackground(1);

  assert.match(start, /transparent 0deg/);
  assert.match(start, /0deg, color-mix/);
  assert.match(half, /transparent 180deg/);
  assert.match(half, /180deg, color-mix/);
  assert.match(end, /transparent 360deg/);
  assert.match(end, /360deg, color-mix/);
  assert.match(start, /from -90deg/);
});
