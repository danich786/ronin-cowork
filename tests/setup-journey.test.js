import test from 'node:test';
import assert from 'node:assert/strict';
import { SETUP_SCENES, setupJourney } from '../public/js/setup-journey.js';

test('Scene 1 shows only Model providers beside the quiet workspace', () => {
  assert.deepEqual(setupJourney({ activated_count: 0 }), {
    id: 'provider', label: 'Provider', number: 1, selector: false, visibleTypes: ['setup.providers'],
    seats: { workspace1: '', workspace2: 'setup.providers' },
  });
});

test('a ready provider exits Scene 1 without encoding later route decisions', () => {
  const scene = setupJourney({ activated_count: 1 });
  assert.equal(scene.id, 'register');
  assert.equal(scene.number, 2);
  assert.equal(scene.seats.workspace2, 'setup.register');
});

test('the view-only scene index can inspect every scene without changing real provider facts', () => {
  assert.equal(SETUP_SCENES.length, 7);
  assert.equal(new Set(SETUP_SCENES.map(({ id }) => id)).size, 7);
  assert.equal(setupJourney({ activated_count: 2 }, 1).id, 'provider');
  assert.equal(setupJourney({ activated_count: 0 }, 7).id, 'ready');
  assert.equal(setupJourney({ activated_count: 0 }, 99).id, 'provider');
});
