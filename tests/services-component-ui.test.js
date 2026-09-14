import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const setup = await readFile(new URL('../public/js/setup-surfaces.js', import.meta.url), 'utf8');
const installed = await readFile(new URL('../src/routes/installed-api.ts', import.meta.url), 'utf8');
const launch = await readFile(new URL('../src/routes/launch.ts', import.meta.url), 'utf8');

test('the one Services selector owns the three owner-facing component labels', () => {
  assert.match(setup, /id: 'kanban', label: 'Kanban'/);
  assert.match(setup, /id: 'koe', label: 'Koe'/);
  assert.match(setup, /id: 'rireki', label: 'Terminal transcript'/);
  assert.match(setup, /many: true/);
  assert.match(setup, /Turn on Running services first/);
});

test('installed truth distinguishes desired, running, parked, and restart state', () => {
  assert.match(installed, /desired: Record<string, boolean>/);
  assert.match(installed, /listServiceFailures\(\)/);
  assert.match(installed, /\['master_off', 'component_off'\]/);
  assert.match(setup, /'Parked'.*'Restart'.*'Running'.*'Off'/s);
});

test('new Agent transcript recording follows both the master and component choices', () => {
  assert.match(launch, /config\.services\.parts\.rireki === true/);
  assert.match(launch, /contribution\.enabled\) && transcriptOn/);
});
