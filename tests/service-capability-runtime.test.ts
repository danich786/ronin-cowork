import test from 'node:test';
import assert from 'node:assert/strict';
import { listServiceCapabilities, noteService, noteServiceCapabilityPlan } from '../src/sockets.js';

test('one running Task manager part projects as partial, never stopped or running', () => {
  noteServiceCapabilityPlan([{ name: 'task_manager', parts: ['first', 'second'] }]);
  noteService('first');
  const facts = listServiceCapabilities();
  assert.deepEqual(facts.partial, ['task_manager']);
  assert.deepEqual(facts.running, []);
});
