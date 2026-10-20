import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Channels } from '../src/channels.js';
import { bindOperatorSocket, isOperatorPeer } from '../src/operator-socket.js';
import { channelFixture, until } from './helpers/channel-fixture.js';

const exec = promisify(execFile);
const binding = { provider: 'slack', workspace: 'TTEST', conversation: 'CTEST' };
test('Agent channel commands read and post through an explicitly selected private development socket', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  await f.channels.create('support', 'test-team', 'Support');
  await f.channels.subscribe('support', f.sessions[0], true, true);
  await f.channels.post('support', 'Socket test question');
  const socketPath = path.join(f.directory, 'run', 'dev.sock');
  const socket = await bindOperatorSocket((req, res) => {
    if (!isOperatorPeer(req)) { res.writeHead(401); res.end(); return; }
    f.app(req, res);
  }, socketPath);
  t.after(() => socket.close());
  const cli = (args: string[]) => exec(process.execPath,
    ['--import', 'tsx', 'src/channel-cli.ts', ...args],
    { env: { ...process.env, RONIN_URL: '', RONIN_SOCKET: socketPath, RONIN_SESSION: 'agent-a', RONIN_CLI_TOKEN: '' }, timeout: 20000 });
  const read = JSON.parse((await cli(['read', 'support'])).stdout);
  assert.equal(read.messages[0].text, 'Socket test question');
  assert.equal(JSON.parse((await cli(['read', 'support'])).stdout).messages.length, 0);
  await cli(['post', 'support', 'Socket test reply']);
  assert.equal((await f.channels.get('support')).messages.at(-1)?.text, 'Socket test reply');
});

test('Slack socket → persistent channel → two independent Agents → explicit threaded Slack reply', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  const api = async (url: string, method = 'GET', body?: unknown) => {
    const response = await fetch(f.url + url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert(response.ok, await response.clone().text());
    return response.json();
  };
  await api('/api/channels', 'POST', { id: 'support', team: 'test-team', title: 'Support' });
  await api('/api/channels/support/binding', 'PUT', { binding });
  for (const agent of ['agent-a', 'agent-b']) {
    await api(`/api/channels/support/subscriptions/${agent}`, 'PUT', { write: agent === 'agent-b', notify: true });
  }
  f.slack.start();
  await until(() => f.slack.status.connected);
  f.event('event-one');
  await until(() => f.acknowledged.includes('event-one'));
  f.event('event-retry');
  await until(() => f.acknowledged.includes('event-retry'));
  assert.equal((await f.channels.get('support')).messages.length, 1, 'Slack retries deduplicate');
  await f.channels.pump();
  assert.deepEqual(f.notices.map(n => n.name), ['agent-a', 'agent-b']);
  assert(f.notices.every(n => n.text.includes('edges channel read support')));
  const cli = (session: string, args: string[]) => exec(process.execPath,
    ['--import', 'tsx', 'src/channel-cli.ts', ...args],
    { env: { ...process.env, RONIN_URL: f.url, RONIN_SESSION: session }, timeout: 20000 });
  const readA = JSON.parse((await cli('agent-a', ['read', 'support'])).stdout);
  assert.equal(readA.messages[0].text, 'Investigate authentication');
  assert.equal(JSON.parse((await cli('agent-a', ['read', 'support'])).stdout).messages.length, 0);
  assert.equal((await f.channels.read('support', f.sessions[1])).messages.length, 1, 'A cannot consume B unread');
  await assert.rejects(cli('agent-a', ['post', 'support', 'not permitted']));
  const readB = JSON.parse((await cli('agent-b', ['read', 'support'])).stdout);
  await cli('agent-b', ['post', 'support', '--reply-to', readB.messages[0].id, 'Found the auth bug']);
  await f.channels.pump();
  assert.equal(f.posts.length, 1);
  assert.equal(f.posts[0].channel, 'CTEST');
  assert.equal(f.posts[0].thread_ts, '1000.1');
  assert.equal(f.posts[0].text, 'agent:agent-b\nFound the auth bug');
  assert.equal(f.posts[0].mrkdwn, false);
  f.event('echo', { ts: '2000.1', user: 'UBOT', bot_id: 'BTEST', text: 'echo' });
  await until(() => f.acknowledged.includes('echo'));
  assert.equal((await f.channels.get('support')).messages.length, 2, 'bot echo is not re-ingested');
  const persisted = new Channels(f.directory, f.channels.ports);
  assert.equal((await persisted.get('support')).messages[1].delivery, 'sent');
  assert.equal((await stat(path.join(f.directory, 'support.json'))).mode & 0o777, 0o600);
  const exported = JSON.stringify(await api('/api/channels/support'));
  assert(!exported.includes('test-bot') && !exported.includes('test-app'));
});

test('subscriptions, quiet reads, session replacement, Team boundaries, and archive survive restart', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  await f.channels.create('support', 'test-team', 'Support');
  await assert.rejects(f.channels.create('../escape', 'test-team', 'Bad'), /lowercase letters, numbers, hyphens, or underscores/);
  await assert.rejects(f.channels.subscribe('support', f.sessions[2], true, true));
  await f.channels.subscribe('support', f.sessions[0], false, false);
  await f.channels.post('support', 'Quiet owner note');
  await f.channels.pump();
  assert.equal(f.notices.length, 0);
  assert.equal((await f.channels.read('support', f.sessions[0])).messages.length, 1);
  f.sessions[0].key = 'replacement';
  await assert.rejects(f.channels.read('support', f.sessions[0]));
  await f.channels.subscribe('support', f.sessions[0], true, true);
  await f.channels.archive('support', true);
  await assert.rejects(f.channels.post('support', 'archived'));
  await f.channels.archive('support', false);
  await f.channels.unsubscribe('support', 'agent-a');
  await assert.rejects(f.channels.read('support', f.sessions[0]));
  assert.equal((await f.channels.get('support')).messages.length, 1);
});

test('concurrent posts are preserved and owner retry IDs are idempotent', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  await f.channels.create('support', 'test-team', 'Support');
  const requestId = randomUUID();
  const first = await f.channels.post('support', 'Once', undefined, undefined, requestId);
  assert.equal((await f.channels.post('support', 'Once', undefined, undefined, requestId)).id, first.id);
  await assert.rejects(f.channels.post('support', 'Different', undefined, undefined, requestId));
  await Promise.all(Array.from({ length: 25 }, (_, i) => f.channels.post('support', `message ${i}`)));
  const all = (await f.channels.get('support')).messages;
  assert.equal(all.length, 26);
  assert.equal(new Set(all.map(m => m.seq)).size, 26);
  await assert.rejects(f.channels.post('support', 'x'.repeat(12001)));
});

test('rate limits retry, explicit failures stay visible, ambiguous sends never auto-repeat', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  await f.channels.create('support', 'test-team', 'Support');
  await f.channels.bind('support', binding);
  await f.channels.post('support', 'Rate limited');
  f.fail('rate');
  await f.channels.pump();
  const limited = (await f.channels.get('support')).messages[0];
  assert.equal(limited.delivery, 'queued');
  assert(limited.retryAt! > Date.now());
  await f.channels.pump();
  assert.equal(f.posts.length, 0);
  await new Promise(resolve => setTimeout(resolve, 1050));
  await f.channels.pump();
  assert.equal(f.posts.length, 1);
  const denied = await f.channels.post('support', 'Rejected');
  f.fail('denied');
  await f.channels.pump();
  assert.equal((await f.channels.get('support')).messages[1].delivery, 'failed');
  await assert.rejects(f.channels.bind('support', undefined), /Resolve pending/);
  await f.channels.resolve('support', denied.id, false);
  const uncertain = await f.channels.post('support', 'Possibly delivered');
  f.fail('unknown');
  await f.channels.pump();
  assert.equal((await f.channels.get('support')).messages[2].delivery, 'uncertain');
  const count = f.posts.length;
  await f.channels.pump();
  assert.equal(f.posts.length, count);
  await f.channels.resolve('support', uncertain.id, true);
  await f.channels.pump();
  assert.equal((await f.channels.get('support')).messages[2].delivery, 'sent');
  await f.channels.bind('support', undefined);
});

test('crash recovery preserves unread and requires review of in-flight delivery', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  await f.channels.create('support', 'test-team', 'Support');
  await f.channels.bind('support', binding);
  await f.channels.post('support', 'In flight');
  const filename = path.join(f.directory, 'support.json');
  const stored = JSON.parse(await readFile(filename, 'utf8'));
  stored.messages[0].delivery = 'sending';
  await writeFile(filename, JSON.stringify(stored));
  const restarted = new Channels(f.directory, f.channels.ports);
  restarted.adapters.set('slack', f.slack);
  await restarted.recover();
  await restarted.pump();
  assert.equal((await restarted.get('support')).messages[0].delivery, 'uncertain');
  assert.equal(f.posts.length, 0);
});

test('Slack ignores other workspaces/channels, edits, bots; preserves thread and file links; reconnects', async t => {
  const f = await channelFixture(); t.after(() => f.close());
  await f.channels.create('support', 'test-team', 'Support');
  await f.channels.bind('support', binding);
  await f.channels.create('second', 'test-team', 'Second');
  await assert.rejects(f.channels.bind('second', binding), /already bound/);
  await assert.rejects(f.channels.bind('second', { ...binding, workspace: 'TOTHER' }));
  await f.slack.receive({ type: 'events_api', payload: { team_id: 'TOTHER', event: { type: 'message', ts: '1', channel: 'CTEST', user: 'U1', text: 'ignore' } } });
  f.slack.start();
  await until(() => f.slack.status.connected);
  f.event('other', { channel: 'COTHER' });
  f.event('edit', { subtype: 'message_changed' });
  f.event('bot', { bot_id: 'BOTHER' });
  f.event('file', { ts: '1000.2', thread_ts: '1000.0', subtype: 'file_share', files: [{ name: 'report.txt', permalink: 'https://example.com/report' }] });
  await until(() => f.acknowledged.includes('file'));
  const messages = (await f.channels.get('support')).messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].thread, '1000.0');
  assert.match(messages[0].text, /report.txt/);
  f.reconnect();
  await until(() => !f.slack.status.connected);
  await until(() => f.slack.status.connected);
  f.event('after-reconnect', { ts: '1000.3' });
  await until(() => f.acknowledged.includes('after-reconnect'));
  assert.equal((await f.channels.get('support')).messages.length, 2);
});
