import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ProviderSummary } from '../src/model-providers.js';
import type { ProviderReadiness } from '../src/sockets-contract.js';

// CONTRACT_V 13: a part may choose Mika's launch (null = Core's rule) and hears every write of
// the provider record. Isolated roots: nothing here reaches the live store.
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-mika-socket-'));
Object.assign(process.env, { HOME: path.join(root, 'home'), RONIN_USER_ROOT: path.join(root, 'user'), RONIN_DATA_ROOT: path.join(root, 'data') });
await fs.mkdir(process.env.HOME!, { recursive: true });
const { CONTRACT_V } = await import('../src/sockets-contract.js');
const { sockets } = await import('../src/sockets.js');
const { recordProviderSummary } = await import('../src/provider-summary.js');
const { resolveConfiguredMikaModel } = await import('../src/mika-runtime.js');
const { mikaLaunchBody } = await import('../src/routes/launch.js');
test.after(() => fs.rm(root, { recursive: true, force: true }));

const summary = (operational: string[]): ProviderSummary => ({
  measured_at: '2026-11-15T00:00:00Z', refreshed_at: '', installed: ['claude', 'codex'], signed_in: operational,
  operational, off: [], activated_count: operational.length, paths: {}, versions: {}, models: {}, latest: {},
} as unknown as ProviderSummary);

let choose = false;
const heard: ProviderReadiness[] = [];
sockets.chooseMikaLaunch(() => { throw new Error('a broken chooser counts as null'); });
sockets.chooseMikaLaunch((ready) => choose && !ready.operational.length
  ? { provider: 'part_provider', model: 'part-model', cli: 'codex', cmd: 'codex --model part-model', wrapArgv: (argv) => ['wrap', ...argv] }
  : null);
sockets.onProvidersRecorded((ready) => { heard.push(ready); });

test('the contract is 13', () => assert.equal(CONTRACT_V, 13));

test('every write of the provider record is told to the parts', async () => {
  await recordProviderSummary(summary(['claude']));
  assert.deepEqual(heard.at(-1), { operational: ['claude'], signed_in: ['claude'] });
});

test('a part choice is used before Core\'s rule; null leaves Core\'s rule', async () => {
  await recordProviderSummary(summary([]));
  await assert.rejects(resolveConfiguredMikaModel(), (e: { code?: string }) => e.code === 'mika_no_ready_provider', 'no choice: Core\'s rule, which refuses');
  choose = true;
  const chosen = await resolveConfiguredMikaModel();
  assert.equal(chosen.provider, 'part_provider');
  assert.equal(chosen.spec.cmd, 'codex --model part-model');
  assert.deepEqual(chosen.choice?.wrapArgv?.(['codex']), ['wrap', 'codex']);
  assert.deepEqual(mikaLaunchBody({}, chosen).cmd, 'codex --model part-model', 'the launch body carries the part\'s own command');
  assert.equal(mikaLaunchBody({}, chosen).provider, undefined);
  await recordProviderSummary(summary(['claude']));
  assert.equal((await resolveConfiguredMikaModel()).provider, 'anthropic', 'the chooser answered null: Core\'s rule');
});

test('no part running: the sockets answer no Mika and restart does nothing', async () => {
  assert.equal(await sockets.mikaIdentity(), null);
  await sockets.restartMika({ prompt: 'hello', archive: true });
});
