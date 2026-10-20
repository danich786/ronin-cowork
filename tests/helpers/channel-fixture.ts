import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Channels, type ChannelSession } from '../../src/channels.js';
import { SlackChannel } from '../../src/slack-channel.js';
import { registerChannels } from '../../src/routes/channels-api.js';

export async function channelFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'ronin-channels-'));
  const sessions: ChannelSession[] = [
    { name: 'agent-a', key: 'birth-a', tags: ['test-team'] },
    { name: 'agent-b', key: 'birth-b', tags: ['test-team'] },
    { name: 'outsider', key: 'birth-other', tags: ['other-team'] },
  ];
  const notices: Array<{ name: string; key: string; text: string }> = [];
  const channels = new Channels(directory, {
    sessions: async () => sessions,
    notify: async (name, key, text) => { notices.push({ name, key, text }); },
  });
  const remote = express();
  remote.use(express.json());
  const remoteServer = createServer(remote);
  const sockets = new WebSocketServer({ server: remoteServer });
  let socket: WebSocket | undefined;
  const acknowledged: string[] = [];
  sockets.on('connection', ws => {
    socket = ws;
    ws.on('message', raw => acknowledged.push(JSON.parse(raw.toString()).envelope_id));
    ws.send(JSON.stringify({ type: 'hello' }));
  });
  await new Promise<void>(resolve => remoteServer.listen(0, '127.0.0.1', resolve));
  const address = remoteServer.address() as { port: number };
  const posts: Record<string, unknown>[] = [];
  let failNext = '';
  remote.post('/api/auth.test', (req, res) => {
    if (req.headers.authorization !== 'Bearer test-bot') return res.status(401).json({ ok: false });
    res.json({ ok: true, team_id: 'TTEST', user_id: 'UBOT' });
  });
  remote.post('/api/apps.connections.open', (req, res) => {
    if (req.headers.authorization !== 'Bearer test-app') return res.status(401).json({ ok: false });
    res.json({ ok: true, url: `ws://127.0.0.1:${address.port}` });
  });
  remote.all('/api/conversations.info', (req, res) => {
    if (req.headers.authorization !== 'Bearer test-bot') return res.status(401).json({ ok: false });
    // Slack rejects the previous JSON POST: channel must be a GET query argument.
    if (req.method !== 'GET' || typeof req.query.channel !== 'string' || !/^[CG][A-Z0-9]+$/.test(req.query.channel)) {
      return res.json({ ok: false, error: 'invalid_arguments' });
    }
    res.json({ ok: true, channel: { id: req.query.channel, is_member: true } });
  });
  remote.post('/api/chat.postMessage', (req, res) => {
    if (req.headers.authorization !== 'Bearer test-bot') return res.status(401).json({ ok: false });
    const failure = failNext;
    failNext = '';
    if (failure === 'rate') return res.set('Retry-After', '1').status(429).end();
    if (failure === 'denied') return res.json({ ok: false, error: 'not_in_channel' });
    posts.push(req.body);
    if (failure === 'unknown') { req.socket.destroy(); return; }
    res.json({ ok: true, ts: `2000.${posts.length}` });
  });
  const slack = new SlackChannel(channels, { bot: 'test-bot', app: 'test-app' }, `http://127.0.0.1:${address.port}/api/`);
  channels.adapters.set('slack', slack);
  const app = express();
  app.use(express.json());
  registerChannels(app, channels, {
    status: () => slack.status,
    resolveSession: async name => sessions.find(s => s.name === name),
    teamExists: async team => team === 'test-team',
  });
  app.use('/js', express.static(path.resolve('public/js')));
  app.use('/css', express.static(path.resolve('public/css')));
  app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html><head>
    <meta charset="utf-8"><link rel="stylesheet" href="/css/team-workspace.css"></head><body>
    <script type="module">
    import { createTeamChannels } from '/js/team-channels.js';
    const channels = createTeamChannels(); document.body.append(channels.el);
    channels.setTeam('test-team', ['agent-a', 'agent-b']); channels.enter();
    window.testChannels = channels;
    </script></body></html>`));
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return {
    directory, channels, sessions, notices, slack, posts, acknowledged, url, app,
    fail(kind: string) { failNext = kind; },
    event(id: string, changes: Record<string, unknown> = {}) {
      if (!socket) throw new Error('Slack socket not connected.');
      socket.send(JSON.stringify({
        envelope_id: id, type: 'events_api',
        payload: { team_id: 'TTEST', event: { type: 'message', channel: 'CTEST', user: 'UOWNER', ts: '1000.1', text: 'Investigate authentication', ...changes } },
      }));
    },
    reconnect() { socket?.close(); },
    async close() {
      slack.stop();
      sockets.clients.forEach(ws => ws.terminate());
      await new Promise<void>(resolve => sockets.close(() => resolve()));
      server.closeAllConnections(); remoteServer.closeAllConnections();
      await Promise.all([
        new Promise<void>(resolve => server.close(() => resolve())),
        new Promise<void>(resolve => remoteServer.close(() => resolve())),
      ]);
      await rm(directory, { recursive: true, force: true });
    },
  };
}
export async function until(predicate: () => boolean | Promise<boolean>, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (!await predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for channel fixture.');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
