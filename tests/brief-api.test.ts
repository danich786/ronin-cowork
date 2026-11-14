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
    body: JSON.stringify({ kind: 'behaviours', name: 'recruit-propose-agents', text: "# Propose agents\n- **seed:** Propose Agents; don't raise them.\n- **mandate:** recruit\n- **order:** 3\n" }),
  });
  assert.equal(made.status, 201);
  const catalog = await (await fetch(`${base}/api/brief/catalog`)).json() as Array<{ name: string; mandate: string; value: string; order: number | null }>;
  const row = catalog.find((entry) => entry.name === 'recruit-propose-agents')!;
  assert.deepEqual([row.mandate, row.value, row.order], ['recruit', 'propose agents', 3]);
  const plain = catalog.find((entry) => entry.name === 'probe-one')!;
  assert.deepEqual([plain.mandate, plain.value, plain.order], ['', '', null]);
});

test.after(async () => {
  server.close();
  await fs.rm(temp, { recursive: true, force: true });
});
