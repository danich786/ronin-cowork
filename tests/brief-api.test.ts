import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-brief-api-'));
process.env.RONIN_USER_ROOT = temp;
process.env.RONIN_DATA_ROOT = path.join(temp, 'data');
const { resourceRequestCache } = await import('../src/resources.js');
const { registerBrief } = await import('../src/routes/brief-api.js');
const app = express();
app.use(express.json());
app.use(resourceRequestCache);
registerBrief(app);
const server: Server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

test('writing your own files: every save reads back what it wrote, one after another', async () => {
  for (const [kind, name] of [['behaviours', 'probe-one'], ['behaviours', 'probe-two'], ['tools', 'probe-tool']]) {
    const response = await fetch(`${base}/api/brief/files`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, name, text: `# ${name}\n- **seed:** x\n- **depth:** full\n\nx\n` }),
    });
    assert.equal(response.status, 201, `${kind}/${name}`);
    assert.equal((await response.json() as { origin: string }).origin, 'user');
  }
  const catalog = await (await fetch(`${base}/api/brief/catalog`)).json() as Array<{ name: string }>;
  assert.ok(['probe-one', 'probe-two', 'probe-tool'].every((name) => catalog.some((row) => row.name === name)));
});

test('the catalog carries each mandate value: its axis, its value, its order', async () => {
  const made = await fetch(`${base}/api/brief/files`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'behaviours', name: 'recruit-probe', text: "# Probe value\n- **seed:** Probe only.\n- **mandate:** recruit\n- **order:** 3\n" }),
  });
  assert.equal(made.status, 201);
  const catalog = await (await fetch(`${base}/api/brief/catalog`)).json() as Array<{ name: string; mandate: string; value: string; order: number | null }>;
  const row = catalog.find((entry) => entry.name === 'recruit-probe')!;
  assert.deepEqual([row.mandate, row.value, row.order], ['recruit', 'probe value', 3]);
  const plain = catalog.find((entry) => entry.name === 'probe-one')!;
  assert.deepEqual([plain.mandate, plain.value, plain.order], ['', '', null]);
});

test('the integrations listing is the bridge files: adding one adds an integration', async () => {
  const made = await fetch(`${base}/api/brief/files`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'behaviours', name: 'probe-bridge', text: '# Probe bridge\n- **seed:** How we use Probe.\n- **when:** integration:probe\n' }),
  });
  assert.equal(made.status, 201);
  const listing = await (await fetch(`${base}/api/brief/integrations`)).json() as Array<{ name: string; behaviour: string }>;
  assert.ok(listing.some((row) => row.name === 'probe' && row.behaviour === 'probe-bridge'), JSON.stringify(listing));
  const words = await (await fetch(`${base}/api/brief/conditionals`)).json() as string[];
  assert.ok(words.includes('integration:probe'));
  assert.deepEqual(words.filter((word) => word.startsWith('integration:')), listing.map((row) => `integration:${row.name}`), 'no other source of names');
  const catalog = await (await fetch(`${base}/api/brief/catalog`)).json() as Array<{ name: string; integration: string }>;
  assert.equal(catalog.find((row) => row.name === 'probe-bridge')!.integration, 'probe');
});

test('a Campaign with its Jira part on has project management on (the switch, not the live pairing)', async () => {
  const { briefLayers } = await import('../src/brief-build.js');
  const { cascade } = await import('../src/brief-settings.js');
  const campaign = (jira: boolean) => ({ campaign: { id: 'paired', config: { brief: { add: [], block: [], only: [] }, integrations: [], services: { parts: { jira } } } }, workspace: null, roster: null }) as never;
  const agent = { brief: { add: [], block: [], only: [] }, integrations: [] };
  assert.deepEqual(cascade(await briefLayers(campaign(false), agent)).pm, { on: false });
  const on = cascade(await briefLayers(campaign(true), agent));
  assert.deepEqual([on.integrations.jira, on.pm], ['campaign', { on: true, from: 'jira' }]);
});

test.after(async () => {
  server.close();
  await fs.rm(temp, { recursive: true, force: true });
});
