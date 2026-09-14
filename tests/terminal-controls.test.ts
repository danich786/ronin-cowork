import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-controls-'));
process.env.RONIN_CONFIG_DIR = path.join(temp, 'config');
process.env.RONIN_MESSAGE_QUEUE_DIR = path.join(temp, 'queue');
const { CONTROL_DEFAULTS, validateBindings, agentControlKeys, registerTerminalControls } = await import('../src/terminal-controls.js');
const { parseSessionIdentity } = await import('../src/tmux.js');

test('a remapped control has one persisted definition; invalid saves do not replace it', async () => {
  const app = express(); app.use(express.json()); registerTerminalControls(app);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/terminal-controls`;
    assert.deepEqual((await (await fetch(url)).json()).bindings, CONTROL_DEFAULTS);
    const bindings = { ...CONTROL_DEFAULTS, close: 'Ctrl+X' };
    assert.equal((await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bindings }) })).status, 200);
    assert.deepEqual((await (await fetch(url)).json()).bindings, bindings);
    const invalid = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bindings: { ...bindings, stop: 'Ctrl+X' } }) });
    assert.equal(invalid.status, 400);
    assert.deepEqual((await (await fetch(url)).json()).bindings, bindings);
    const stored = JSON.parse(await fs.readFile(path.join(temp, 'config/machine_settings.json'), 'utf8'));
    assert.deepEqual(stored.terminalControls.bindings, bindings);
    assert.match(await (await fetch(url + '/help')).text(), /# Terminal controls/);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('bad, duplicate, browser and typing chords are rejected', () => {
  for (const close of ['C', 'Enter', 'Ctrl+W', 'Meta+C', 'Ctrl++C', 'Escape']) assert.throws(() => validateBindings({ ...CONTROL_DEFAULTS, close }));
  assert.throws(() => validateBindings({ stop: 'Escape' }));
  assert.deepEqual(validateBindings(CONTROL_DEFAULTS), CONTROL_DEFAULTS);
});

test('Clear adapters contain only editing keys, never interrupt, exit, Enter or slash commands', () => {
  for (const cli of ['codex', 'claude', 'gemini', 'grok', 'hermes']) {
    const keys = agentControlKeys(cli, 'clear');
    assert.ok(keys.length);
    assert.ok(keys.every((key) => ['C-u', 'C-k'].includes(key)), cli);
  }
  assert.deepEqual(agentControlKeys('codex', 'stop'), ['Escape']);
  assert.deepEqual(agentControlKeys('grok', 'stop'), ['C-c']);
  assert.throws(() => agentControlKeys('bash', 'stop'), /No stop binding/);
  assert.throws(() => agentControlKeys('', 'clear'), /No clear binding/);
});

test('session identity distinguishes CLI from inference provider and model', () => {
  const identity = { sessionType: 'cowork_agent', cli: 'codex', provider: 'other-inference-vendor', model: 'other-model' };
  assert.deepEqual(parseSessionIdentity(JSON.stringify(identity)), identity);
  assert.equal(parseSessionIdentity('broken'), undefined);
  assert.equal(parseSessionIdentity('{"cli":"codex"}'), undefined);
});

test('a control waits for the paste transaction without joining its typing grace', async () => {
  const { withMessageTarget } = await import('../src/message-queue.js');
  const calls: string[] = [];
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const paste = withMessageTarget('birth', async () => { calls.push('paste'); entered(); await hold; calls.push('Enter'); });
  await started;
  const clear = withMessageTarget('birth', async () => { calls.push('Clear'); });
  release(); await Promise.all([paste, clear]);
  assert.deepEqual(calls, ['paste', 'Enter', 'Clear']);
});

test.after(async () => { await fs.rm(temp, { recursive: true, force: true }); });
