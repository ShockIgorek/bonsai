import test from 'node:test';
import assert from 'node:assert/strict';
import { THEMES } from '../src/views/themes.js';

test('default bonsai theme is selectable again', () => {
  const bonsai = THEMES.find(theme => theme.id === 'bonsai');
  assert.ok(bonsai);
  assert.equal(bonsai.name, 'Bonsai');
});

test('theme ids are unique', () => {
  const ids = THEMES.map(theme => theme.id);
  assert.equal(new Set(ids).size, ids.length);
});
