import assert from 'node:assert/strict';
import test from 'node:test';
import { toRequest } from '../public/js/machine-settings-schema.js';
import { MACHINE_SETTINGS_SCHEMA } from '../src/machine-settings-schema.js';
import { readFile } from 'node:fs/promises';

test('a campaign registry row builds through the standing settings request path', () => {
  const field = MACHINE_SETTINGS_SCHEMA.fields.find((row) => row.lands.family === 'campaign');
  assert.ok(field);
  assert.deepEqual(toRequest(MACHINE_SETTINGS_SCHEMA, field, 'A new campaign'), {
    route: '/api/machine-settings',
    method: 'PATCH',
    json: { family: 'campaign', value: { [field.lands.key]: 'A new campaign' } },
  });
});

test('the retired setup page redirects narrowly and has no client setup branch', async () => {
  const [server, client] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../public/js/main.js', import.meta.url), 'utf8'),
  ]);
  assert.match(server, /app\.get\('\/cowork-setup', \(_req, res\) => res\.redirect\(302, '\/'\)\)/);
  assert.doesNotMatch(server, /app\.get\('\*'/);
  assert.doesNotMatch(client, /cowork-setup|buildCoworkSetup|setup\.pending/);
});
