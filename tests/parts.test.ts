/**
 * The parts rule: a Services part on disk runs only while the installation that claims it is
 * on for the Campaign; an unclaimed part always runs. Off is "as if not installed".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverParts, partClaims, partsToLoad } from '../src/parts.js';
import { listInstallations } from '../src/resource-adapters.js';

const installations = [
  { name: 'ronin_services', parts: ['counting', 'kanban', 'koe', 'koshi', 'koshi_weights', 'michi', 'rireki'] },
  { name: 'gbrain', parts: [] },
];
const onDisk = ['counting', 'gbrain', 'kanban', 'koe', 'koshi', 'koshi_weights', 'machine', 'michi', 'rireki'].map((name) => ({ name }));

test('Services off parks every part the installation claims; unclaimed parts still load', () => {
  const plan = partsToLoad(onDisk, installations, { ronin_services: false }, { kanban: true, koe: true, rireki: true });
  assert.deepEqual(plan.load.map((p) => p.name), ['gbrain', 'machine']);
  assert.deepEqual(plan.parked, ['counting', 'kanban', 'koe', 'koshi', 'koshi_weights', 'michi', 'rireki'].map((name) => ({ name, installation: 'ronin_services', reason: 'master_off' })));
});

test('Services on loads only selected claimed parts and never their siblings', () => {
  const plan = partsToLoad(onDisk, installations, { ronin_services: true }, { kanban: true });
  assert.deepEqual(plan.load.map((p) => p.name), ['gbrain', 'kanban', 'machine']);
  assert.deepEqual(plan.parked.map(({ name, reason }) => ({ name, reason })),
    ['counting', 'koe', 'koshi', 'koshi_weights', 'michi', 'rireki'].map((name) => ({ name, reason: 'component_off' })));
});

test('PARKED.md parks a part with its reason regardless of the installation switch', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'parts-parked-'));
  await mkdir(path.join(dir, 'rireki'));
  await writeFile(path.join(dir, 'rireki', 'register.ts'), '');
  await writeFile(path.join(dir, 'rireki', 'PARKED.md'), 'RIREKI is off in this beta: not ready, to be refactored\n\nDetails.\n');
  const parts = discoverParts(dir);
  assert.equal(parts[0].parked, 'RIREKI is off in this beta: not ready, to be refactored');
  assert.deepEqual(partsToLoad(parts, installations, { ronin_services: true }, { rireki: true }), {
    load: [],
    parked: [{ name: 'rireki', reason: 'RIREKI is off in this beta: not ready, to be refactored' }],
  });
});

test('an absent or malformed switch map reads as off — the recorder never runs by accident', () => {
  for (const switches of [undefined, null, {}, [], 'on', { ronin_services: 'yes' }]) {
    const plan = partsToLoad(onDisk, installations, switches, { rireki: true });
    assert.equal(plan.load.some((p) => p.name === 'rireki'), false, `switches=${JSON.stringify(switches)}`);
  }
});

test('the stock Ronin Services installation claims the recorder', async () => {
  const claims = partClaims(await listInstallations());
  assert.equal(claims.get('kanban'), 'ronin_services');
  assert.equal(claims.get('rireki'), 'ronin_services');
  assert.equal(claims.get('koshi'), 'ronin_services');
  assert.equal(claims.get('machine'), undefined, 'the Host part is unclaimed and always loads');
});

test('discoverParts lists directories with a register entry, and nothing else', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'parts-'));
  await mkdir(path.join(dir, 'rireki')); await writeFile(path.join(dir, 'rireki', 'register.ts'), '');
  await mkdir(path.join(dir, 'notes')); await writeFile(path.join(dir, 'notes', 'README.md'), '');
  await writeFile(path.join(dir, 'stray.ts'), '');
  assert.deepEqual(discoverParts(dir).map((p) => p.name), ['rireki']);
  assert.deepEqual(discoverParts(path.join(dir, 'missing')), []);
});
