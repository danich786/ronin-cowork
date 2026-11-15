import test from 'node:test';
import assert from 'node:assert/strict';
import { openTestServer, closeTestServer } from './helpers/testserver.js';
import { setSessionIdentity, listSessions } from '../src/tmux.js';
import { registerTerminalControls } from '../src/terminal-controls.js';
import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

test('live sessions carry launch identity and a stale Tile cannot send a control', async () => {
  const name = `controls-${process.pid}`;
  const rig = await openTestServer(name, { onPath: true });
  try {
    await rig.run('new-session', '-d', '-s', 'agent', 'cat');
    const identity = { sessionType: 'bare_metal_agent', cli: 'codex', provider: 'alternate-provider', model: 'chosen-model' };
    await setSessionIdentity('agent', identity);
    const found = (await listSessions()).find((s) => s.name === 'agent');
    assert.deepEqual(found?.identity, identity);
    assert.equal(found?.agent, 'codex');
    const app = express(); app.use(express.json()); registerTerminalControls(app);
    const server = createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sessions/agent/control-action`;
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'stop', key: 'wrong-birth' }) });
      assert.equal(r.status, 409);
      assert.match((await r.json()).error, /session changed/);
      await setSessionIdentity('agent', { ...identity, cli: 'unknown' });
      const clear = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'clear', key: found?.key }) });
      assert.equal(clear.status, 422);
      assert.match((await clear.json()).error, /No clear binding/);
      assert.equal((await rig.run('list-sessions', '-F', '#{session_name}')).includes('agent'), true);
    } finally { await new Promise<void>((r) => server.close(() => r())); }
  } finally { await closeTestServer(name); }
});

test('a Stop Ronin sent reads interrupted until the Agent writes a line or is sent to (w414)', async () => {
  const { sockets } = await import('../src/sockets.js');
  const { homeRows } = await import('../src/routes/launch.js');
  const { deliverForce } = await import('../src/send.js');
  const name = `stops-${process.pid}`;
  const rig = await openTestServer(name, { onPath: true });
  // The Agent's log reading, as the transcript part gives it: its stance and its newest line.
  let reading: Record<string, unknown> = { stance: 'working', at: 'line-1' };
  sockets.addRowFields((session) => (session === 'agent' ? reading : {}));
  try {
    await rig.run('new-session', '-d', '-s', 'agent', 'cat');
    await setSessionIdentity('agent', { sessionType: 'bare_metal_agent', cli: 'claude', provider: 'p', model: 'm' });
    const found = (await listSessions()).find((s) => s.name === 'agent')!;
    const row = async () => (await homeRows([found as never]))[0] as Record<string, unknown>;
    const app = express(); app.use(express.json()); registerTerminalControls(app);
    const server = createServer(app);
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const stop = () => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sessions/agent/control-action`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ intent: 'stop', key: found.key }) });
    try {
      assert.equal((await row()).stance, 'working');
      assert.equal((await stop()).status, 200);
      // Before the first reply the log writes nothing: the row says what Ronin did.
      let now = await row();
      assert.equal(now.stance, 'interrupted');
      assert.ok(now.stopped_at);
      assert.equal((await row()).stance, 'interrupted', 'it holds while the log is quiet');
      reading = { stance: 'working', at: 'line-2' }; // the Agent wrote a line: still at it
      now = await row();
      assert.equal(now.stance, 'working');
      assert.equal(now.stopped_at, undefined);
      await stop();
      assert.equal((await row()).stance, 'interrupted');
      await deliverForce('agent', 'go on', { read: async () => '', type: async () => {}, enter: async () => {} });
      assert.equal((await row()).stance, 'working', 'a message clears it');
      reading = { stance: 'awaiting_you', at: 'line-3' };
      await stop();
      assert.equal((await row()).stance, 'awaiting_you', 'an Agent at a turn end has nothing to stop');
    } finally { await new Promise<void>((r) => server.close(() => r())); }
  } finally { await closeTestServer(name); }
});

test('a question on the screen reads asking for any provider, Codex update prompt included (KAN-527)', async () => {
  const { sockets } = await import('../src/sockets.js');
  const { homeRows } = await import('../src/routes/launch.js');
  const name = `asking-${process.pid}`;
  const rig = await openTestServer(name, { onPath: true });
  // Codex has no log before its first turn; its reader reports no question of its own.
  sockets.addRowFields((session) => (session === 'codexer' ? { stance: 'unknown', stance_reports: ['awaiting_you', 'interrupted'] } : {}));
  try {
    const prompt = "Update available! 0.1 -> 0.2\\n\\n› 1. Update now\\n  2. Skip\\n  3. Skip until next version\\n\\nPress enter to continue\\n";
    await rig.run('new-session', '-d', '-s', 'codexer', `printf '${prompt}'; read x; printf '\\033[2J\\033[H'; cat`);
    await setSessionIdentity('codexer', { sessionType: 'bare_metal_agent', cli: 'codex', provider: 'p', model: 'm' });
    const row = async () => {
      const found = (await listSessions()).find((s) => s.name === 'codexer')!;
      return (await homeRows([found as never]))[0] as Record<string, unknown>;
    };
    let now: Record<string, unknown> = {};
    for (let i = 0; i < 50 && now.stance !== 'asking'; i++) { now = await row(); await new Promise((r) => setTimeout(r, 50)); }
    assert.equal(now.stance, 'asking');
    assert.deepEqual(now.stance_reports, ['asking', 'awaiting_you', 'interrupted']);
    assert.equal('asking' in now, false, 'the pane read stays inside the stance');
    await rig.run('send-keys', '-t', 'codexer', 'Enter');
    for (let i = 0; i < 60 && now.stance === 'asking'; i++) { await new Promise((r) => setTimeout(r, 50)); now = await row(); }
    assert.equal(now.stance, 'unknown', 'answered, the question leaves with the screen');
  } finally { await closeTestServer(name); }
});
