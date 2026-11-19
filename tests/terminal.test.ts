/**
 * The terminal in a tile: keys typed in the browser reach the pane and its output comes back;
 * the Message box delivers to the session; a socket from another site is refused.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { bootRonin, until } from './helpers/ronin.js';

const ronin = await bootRonin('terminal');
test.after(() => ronin.stop());
await ronin.api('/api/launch', { body: { session_type: 'terminal', name: 'shell' } });
const ws = (session: string, origin = ronin.base) =>
  new WebSocket(`${ronin.base.replace('http', 'ws')}/pty?session=${session}&cols=100&rows=30`, { headers: { origin } });
const pane = () => ronin.tmux.run('capture-pane', '-p', '-t', '=shell:');

test('typing in the tile runs in the pane and the output streams back', async () => {
  const socket = ws('shell');
  let screen = '';
  const frames: Array<{ t?: string }> = [];
  socket.on('message', (data, binary) => {
    if (binary) screen += data.toString();
    else frames.push(JSON.parse(data.toString()));
  });
  await until(() => frames.some((f) => f.t === 'ready'), 'the ready frame');
  socket.send(JSON.stringify({ t: 'i', d: 'echo typed-$((40+2))\r' }));
  await until(() => screen.includes('typed-42'), 'the output in the tile');
  assert.ok((await pane()).includes('typed-42'), 'and in the pane itself');
  socket.close();
});

test('a tile for a session that does not exist is told so', async () => {
  const socket = ws('nobody');
  const frame = await new Promise<{ t: string; m: string }>((resolve) => socket.on('message', (data) => resolve(JSON.parse(data.toString()))));
  assert.equal(frame.t, 'error');
  assert.match(frame.m, /No such session/);
  socket.close();
});

test('a socket from another site is refused', async () => {
  const socket = ws('shell', 'https://evil.example');
  const refused = await new Promise<boolean>((resolve) => {
    socket.on('open', () => resolve(false));
    socket.on('error', () => resolve(true));
  });
  assert.ok(refused);
});

test('the Message box delivers a message into the session', async () => {
  const sent = await ronin.api('/api/messages', { body: { target: 'shell', text: 'echo boxed-$((6*7))', typed: true } });
  assert.equal(sent.status, 200, JSON.stringify(sent.body));
  await until(async () => (await pane()).includes('boxed-42'), 'the message to run in the pane');
});
