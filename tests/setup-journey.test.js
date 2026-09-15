import test from 'node:test';
import assert from 'node:assert/strict';
import { setupJourney } from '../public/js/setup-journey.js';

test('Scene 1 shows only Model providers beside the quiet workspace', () => {
  assert.deepEqual(setupJourney({ activated_count: 0 }), {
    id: 'provider', selector: false, visibleTypes: ['setup.providers'],
    seats: { workspace1: '', workspace2: 'setup.providers' },
  });
});

test('a ready provider exits Scene 1 without encoding later route decisions', () => {
  const scene = setupJourney({ activated_count: 1 });
  assert.equal(scene.id, 'legacy');
  assert.equal(scene.selector, true);
  assert.equal(scene.seats.workspace1, 'setup.presets');
});
