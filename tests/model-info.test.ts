/**
 * MODEL INFO FROM MODELS.DEV, REVIEWED BEFORE ACCEPTED (owner, 2026-10-20). Refresh all
 * fetches once, keeps the catalog's providers and their tool-using models, and leaves an
 * update waiting when it differs from the copy in use; only Accept makes it that copy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const box = await mkdtemp(path.join(os.tmpdir(), 'ronin-model-info-'));
process.env.RONIN_USER_ROOT = path.join(box, 'ronin');
process.env.RONIN_CATALOGS_DIR = path.join(box, 'ronin', 'catalogs');

const info = await import('../src/model-info.js');
const exists = async (file: string) => { try { await stat(file); return true; } catch { return false; } };

const model = (over: Record<string, unknown> = {}) => ({ name: 'M', description: 'd', family: 'f', tool_call: true, cost: { input: 1, output: 2 }, limit: { context: 1000, output: 10 }, extra: 'dropped', ...over });
const answer = (models: Record<string, unknown>) => JSON.stringify({ vendor: { id: 'vendor', models }, other: { models: { x: model() } } });
const ops = (text: string | Error) => ({
  fetchText: async () => { if (text instanceof Error) throw text; return text; },
  egress: async () => {}, now: () => '2026-10-20T12:00:00.000Z',
});

test('the fetch keeps the named providers\' tool-using models and Ronin\'s fields only', () => {
  const file = info.trimModelInfo(answer({ a: model(), img: model({ tool_call: false }) }), ['vendor'], 'now');
  assert.deepEqual(Object.keys(file.providers), ['vendor']);
  assert.deepEqual(Object.keys(file.providers.vendor), ['a'], 'an image model is not a coding model');
  assert.ok(!('extra' in file.providers.vendor.a));
  assert.equal(file.sha256.length, 64);
  assert.throws(() => info.trimModelInfo('{}', ['vendor'], 'now'), /listed none of vendor/);
});

test('an update waits until Accept; the same answer leaves nothing waiting; a failure changes nothing', async () => {
  const shipped = (await info.readModelInfo()).providers;
  const first = await info.checkModelInfo(['vendor'], ops(answer({ a: model() })));
  assert.equal(first.outcome, 'pending');
  const review = await info.modelInfoReview();
  assert.equal(review.using.origin, 'stock', 'nothing accepted yet: Ronin still uses the shipped snapshot');
  assert.deepEqual(review.pending?.changes.find((c) => c.model === 'a')?.change, 'added');
  assert.deepEqual((await info.readModelInfo()).providers, shipped, 'pending is not used');

  assert.equal(await info.acceptModelInfo(), true);
  assert.equal((await info.readModelInfo()).origin, 'user', 'accepted: the owner\'s copy replaces the shipped one');
  assert.equal(await exists(info.pendingModelInfoPath()), false);
  assert.equal(await info.acceptModelInfo(), false, 'nothing waiting: nothing to accept');

  assert.equal((await info.checkModelInfo(['vendor'], ops(answer({ a: model() })))).outcome, 'same');
  assert.equal(await exists(info.pendingModelInfoPath()), false);

  await info.checkModelInfo(['vendor'], ops(answer({ a: model({ cost: { input: 5, output: 2 } }) })));
  assert.deepEqual((await info.modelInfoReview()).pending?.changes, [{ provider: 'vendor', model: 'a', change: 'changed', fields: [{ field: 'cost.input', was: 1, now: 5 }] }]);
  await info.discardModelInfo();
  assert.equal((await info.readModelInfo()).providers.vendor.a.cost.input, 1, 'discarded: the accepted price stands');

  const failed = await info.checkModelInfo(['vendor'], ops(new Error('models.dev answered 503')));
  assert.deepEqual([failed.outcome, failed.say], ['failed', 'models.dev answered 503']);
  assert.deepEqual((await info.modelInfoReview()).check?.outcome, 'failed');
  assert.ok(JSON.parse(await readFile(info.acceptedModelInfoPath(), 'utf8')).providers.vendor, 'the accepted copy is untouched');
});
