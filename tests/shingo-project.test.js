import test from 'node:test';
import assert from 'node:assert/strict';
import { taskAtHand } from '../public/js/shingo.js';

test('a focused project is the one Task at hand and outranks the legacy session ladder', () => {
  const project = { id: 'team/3', title: 'Project', objective: 'Project objective', ladder: [] };
  assert.deepEqual(taskAtHand({ objective: 'Legacy objective', ladder: [{ phase: 'Legacy' }], project }), {
    objective: 'Project objective', project,
  });
});

test('a record without a focused project keeps bare-ladder compatibility', () => {
  assert.deepEqual(taskAtHand({ objective: 'Legacy objective', ladder: [{ phase: 'Legacy' }] }), {
    objective: 'Legacy objective', project: null,
  });
});
