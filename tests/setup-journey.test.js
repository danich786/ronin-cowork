import test from 'node:test';
import assert from 'node:assert/strict';
import { SETUP_SCENES } from '../public/js/setup-journey.js';

test('the explicit scene selector can inspect every stable scene', () => {
  assert.equal(SETUP_SCENES.length, 7);
  assert.equal(new Set(SETUP_SCENES.map(({ id }) => id)).size, 7);
});
