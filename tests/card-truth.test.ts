/** KAN-664: the card is the one truth for an Agent's status; the newest input wins, a dead pane over all. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardFields, type HookRecord } from '../src/asking.js';

const T1 = '2026-11-18T10:00:00.000Z';
const T2 = '2026-11-18T10:00:05.000Z';
const ask: HookRecord = { stance: 'asking', at: T1, question: { kind: 'permission', tool: 'Bash', detail: 'rm x', reason: '' } };

test('KAN-664: the newer input says the turn state', () => {
  const lost = cardFields({ stance: 'awaiting_you', at: T2 }, { stance: 'working', at: T1, tool: { name: 'Bash', target: 'ls' } });
  assert.equal(lost.stance, 'awaiting_you', 'a Stop hook lost in a restart: the log puts it right');
  assert.equal(lost.tool, undefined);
  const esc = cardFields({ stance: 'interrupted', at: T2 }, { stance: 'working', at: T1 });
  assert.equal(esc.stance, 'interrupted', 'Esc fired no hook: the log says interrupted');
  const hook = cardFields({ stance: 'working', at: T1, tool: { name: 'Read', target: 'a' } }, { stance: 'awaiting_you', at: T2 });
  assert.equal(hook.stance, 'awaiting_you', 'a newer hook wins');
  assert.equal(hook.tool, undefined, 'the older input leaves no tool behind');
  assert.equal(hook.hooked, true);
});

test('KAN-664: the question is the hook\'s, until a newer input moves the turn on', () => {
  assert.deepEqual(cardFields({ stance: 'working', at: T1 }, { ...ask, at: T2 }).question, ask.question);
  assert.deepEqual(cardFields({ stance: 'asking', at: T2 }, ask).question, ask.question, 'the log still asks');
  const moved = cardFields({ stance: 'working', at: T2 }, ask);
  assert.equal(moved.stance, 'working');
  assert.equal(moved.question, undefined);
});

test('KAN-664: a dead pane is over everything; one input is just that input', () => {
  const dead = cardFields({ stance: 'working', at: T2 }, { stance: 'stopped', at: T1, exit: 137 });
  assert.equal(dead.stance, 'stopped');
  assert.equal(dead.exit, 137);
  assert.deepEqual(cardFields({ stance: 'working', at: T1 }, null), { stance: 'working', at: T1, hooked: false });
  assert.equal(cardFields({ stance: 'unknown' }, ask).stance, 'asking', 'a log with no line yet: the hook');
});
