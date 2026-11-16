import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDefaults, mandate } from '../src/agent-defaults.js';

test('agent_defaults validates every field in the complete record shape', () => {
  const cases = [
    ['blank gets the ruled stock values', undefined, {
      provider: '', model: '', reach: 'plan', recruit: 'propose agents', output: ['open'],
      launch_mode: 'configured',
    }],
    ['every valid value survives', {
      provider: ' anthropic ', model: ' opus ', reach: 'execute', recruit: 'staff agents', output: ['code', 'no code'],
      launch_mode: 'configured',
    }, {
      provider: 'anthropic', model: 'opus', reach: 'execute', recruit: 'staff agents',
      output: ['code', 'no code'],
      launch_mode: 'configured',
    }],
    ['any mandate value is taken (its file decides what it means); a bad launch mode falls back', {
      reach: 'Review', recruit: 'propose', output: 'report', routines: { base: 'yes', control: true },
      launch_mode: 'unsafe', stray_mode: 'maybe',
    }, {
      provider: '', model: '', reach: 'review', recruit: 'propose', output: ['report'],
      launch_mode: 'configured',
    }],
    ['a blank axis falls back', { reach: ' ', recruit: 7, output: [] }, {
      provider: '', model: '', reach: 'plan', recruit: 'propose agents', output: ['open'],
      launch_mode: 'configured',
    }],
  ] as const;

  for (const [name, input, expected] of cases) assert.deepEqual(agentDefaults(input), expected, name);
});

test('mandate: blank gets the fallback, any stated value is kept', () => {
  const cases = [
    [undefined, { reach: 'plan', recruit: 'propose agents', output: ['open'] }],
    [{ reach: 'open', recruit: 'staff agents', output: 'the team' }, { reach: 'open', recruit: 'staff agents', output: ['the team'] }],
    [{ reach: 'run', recruit: 'propose', output: 'report' }, { reach: 'run', recruit: 'propose', output: ['report'] }],
  ] as const;
  for (const [input, expected] of cases) assert.deepEqual(mandate(input), expected);
});
