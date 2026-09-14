import test from 'node:test';
import assert from 'node:assert/strict';
import { savedLaunchFields } from '../src/resources.js';

test('saved-launch write shape admits only live fields', () => {
  const cases = [
    ['live strings', {
      label: '  Review  ', project_root: ' cowork ',
      team: ' sea_settle ', prompt: ' inspect ',
    }, {
      label: 'Review', project_root: 'cowork',
      team: 'sea_settle', prompt: 'inspect',
    }],
    ['retired keys', { role_family: 'developer', mode: 'agent', group: 'old_team' }, {}],
    ['unknown and non-string values', { label: 7, extra: 'no' }, {}],
  ] as const;

  for (const [name, body, expected] of cases) {
    assert.deepEqual(savedLaunchFields(body), expected, name);
  }
});
