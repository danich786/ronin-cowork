import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDefaults, mandate } from '../src/agent-defaults.js';

test('agent_defaults validates every field in the complete record shape', () => {
  const cases = [
    ['blank gets the ruled stock values', undefined, {
      provider: '', model: '', reach: 'plan', recruit: 'propose agents', output: ['open'],
      behaviours: [], dial: 'write', launch_mode: 'configured',
    }],
    ['every valid value survives', {
      provider: ' anthropic ', model: ' opus ', reach: 'execute', recruit: 'staff agents', output: ['code', 'no code'],
      behaviours: [' ways:CutCode ', 'ronin_catalogs/behaviours:github'], dial: 'read', launch_mode: 'configured',
    }, {
      provider: 'anthropic', model: 'opus', reach: 'execute', recruit: 'staff agents',
      output: ['code', 'no code'],
      behaviours: ['ways:CutCode', 'ronin_catalogs/behaviours:github'], dial: 'read', launch_mode: 'configured',
    }],
    ['bad hand edits fall back field by field', {
      reach: 'run', recruit: 'propose', output: 'report', routines: { base: 'yes', control: true },
      behaviours: [null, ' ways:CheckWork '], dial: 'admin', launch_mode: 'unsafe', gbrain_mode: 'maybe',
    }, {
      provider: '', model: '', reach: 'plan', recruit: 'propose agents', output: ['open'],
      behaviours: ['ways:CheckWork'], dial: 'write', launch_mode: 'configured',
    }],
  ] as const;

  for (const [name, input, expected] of cases) assert.deepEqual(agentDefaults(input), expected, name);
});

test('mandate blank and explicit table uses the amended R36 words', () => {
  const cases = [
    [undefined, { reach: 'plan', recruit: 'propose agents', output: ['open'] }],
    [{ reach: 'open', recruit: 'staff agents', output: 'the team' }, { reach: 'open', recruit: 'staff agents', output: ['the team'] }],
    [{ reach: 'run', recruit: 'propose', output: 'report' }, { reach: 'plan', recruit: 'propose agents', output: ['open'] }],
  ] as const;
  for (const [input, expected] of cases) assert.deepEqual(mandate(input), expected);
});
