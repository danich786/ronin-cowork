import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { WebSocket } from 'ws';
import type { SessionInfo } from '../src/tmux.js';

// A card watches its Agent's folder in the session store: the store is a temp one.
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-home-push-'));
process.env.RONIN_DATA_ROOT = temp;
after(() => fs.rm(temp, { recursive: true, force: true }));
const { changed, feedEvents, handleEvents, mark, publishHeld, pushJikan, pushMessages, pushTeams, pushWipeboard, sessionsSignature, tick, watchStore } = await import('../src/ws/events.js');
const { sessionDir } = await import('../src/session-dir.js');

// A browser on /events: records what it is sent, and can close.
function browser() {
  const sent: Array<Record<string, unknown>> = [];
  const handlers = new Map<string, (raw?: unknown) => void>();
  const ws = {
    OPEN: 1,
    readyState: 1,
    send(text: string) { sent.push(JSON.parse(text) as Record<string, unknown>); },
    on(event: string, fn: (raw?: unknown) => void) { handlers.set(event, fn); },
  };
  return {
    ws: ws as unknown as WebSocket,
    got: (t: string) => sent.filter((msg) => msg.t === t),
    close() { ws.readyState = 3; handlers.get('close')?.(); },
    // What the browser says on the socket, as the server receives it.
    say(msg: unknown) { handlers.get('message')?.(Buffer.from(JSON.stringify(msg))); },
  };
}

// Every test starts from a fresh feed and closes its browsers, so the module's held rows,
// signatures and connections never carry from one test into the next.
function open(t: { after: (fn: () => void) => void }) {
  const b = browser();
  handleEvents(b.ws);
  t.after(() => b.close());
  return b;
}

const session = (name: string, patch: Record<string, unknown> = {}) => ({ name, key: `${name}-1`, tags: [], leads: [], campaign_id: '', activity: 1, ...patch }) as unknown as SessionInfo;
// Joins whatever tick is in flight (a connection starts one), then lets its sends land.
const settle = async () => { await tick(); await new Promise((resolve) => setImmediate(resolve)); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const until = async (done: () => boolean) => { for (let i = 0; i < 200 && !done(); i++) await new Promise((resolve) => setTimeout(resolve, 5)); };

test('a tab is sent every card whole at connect, then each card that moved, reading only its marked part (KAN-641)', async (t) => {
  const reads: string[] = [];
  let ctx = 1;
  feedEvents({
    list: async () => [session('a'), session('b')],
    card: async (s, parts) => { reads.push(`${s.name} ${[...parts].sort().join(',')}`); return { name: s.name, ctx }; },
  });
  const first = open(t);
  await settle();
  assert.deepEqual(first.got('cards').at(-1), { t: 'cards', rev: 3, cards: [{ name: 'a', ctx: 1 }, { name: 'b', ctx: 1 }] });
  assert.deepEqual(reads, ['a fields,pane,record', 'b fields,pane,record'], 'a new Agent is read whole');

  reads.length = 0;
  ctx = 2;
  mark('b', 'pane');
  await until(() => first.got('card').length === 3);
  assert.deepEqual(reads, ['b pane'], 'a pane draw reads that pane alone');
  assert.deepEqual(first.got('card').at(-1), { t: 'card', rev: 4, card: { name: 'b', ctx: 2 } });
  reads.length = 0;
  mark('b', 'pane', 'fields');
  await settle();
  assert.deepEqual(reads, ['b fields,pane'], 'a pane draw reads its screen and its CLI\'s log in one read, never the record');
  assert.equal(first.got('card').length, 3, 'a card that did not move is not sent');
  changed();
  await settle();
  assert.equal(first.got('cards').length, 1, 'a tick on an unchanged listing sends nothing');

  const second = open(t);
  assert.deepEqual(second.got('cards'), [{ t: 'cards', rev: 4, cards: [{ name: 'a', ctx: 1 }, { name: 'b', ctx: 2 }] }], 'a reconnect gets every card at the current rev');
  await settle();
});

test('a mark during a rebuild is read on the next round, with every part marked meanwhile', async (t) => {
  let gate = deferred<void>();
  const reads: string[] = [];
  let ask: unknown = null;
  feedEvents({ list: async () => [session('a')], card: async (s, parts) => { reads.push([...parts].sort().join(',')); await gate.promise; return { name: s.name, secret_ask: ask }; } });
  const b = open(t);
  gate.resolve();
  await settle();
  gate = deferred<void>();
  reads.length = 0;
  mark('a', 'pane');
  await until(() => reads.length === 1);
  ask = { name: 'test_key3' };
  mark('a', 'fields');
  mark('a', 'record');
  gate.resolve();
  await until(() => reads.length === 2);
  await settle();
  assert.deepEqual(reads, ['pane', 'fields,record']);
  assert.deepEqual(b.got('card').at(-1)?.card, { name: 'a', secret_ask: { name: 'test_key3' } });
});

test('a mark that lands while a rebuild is finishing is still read', async (t) => {
  let n = 0;
  feedEvents({ list: async () => [session('a')], card: async (s) => ({ name: s.name, n }) });
  const b = open(t);
  await settle();
  // Each mark lands a few microtasks after the one before, as a part's async write does.
  for (let delay = 0; delay < 8; delay++) {
    n += 1;
    mark('a', 'fields');
    for (let i = 0; i < delay; i++) await Promise.resolve();
    n += 1;
    mark('a', 'fields');
    await until(() => b.got('card').at(-1)?.card.n === n);
    assert.equal(b.got('card').at(-1)?.card.n, n, `the second mark, ${delay} microtasks on, was read`);
  }
});

test('a card\'s own folder marks its record: the letter, the brief, a drop, and nothing else', async (t) => {
  const reads: string[] = [];
  feedEvents({ list: async () => [session('w')], card: async (s, parts) => { reads.push([...parts].join(',')); return { name: s.name, n: reads.length }; } });
  open(t);
  await settle();
  const dir = sessionDir('w-1');
  reads.length = 0;
  await fs.writeFile(path.join(dir, 'transcript.jsonl'), 'x');
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(reads, [], 'a transcript write is not the record');
  await fs.writeFile(path.join(dir, 'tegami.md'), 'x');
  await until(() => reads.includes('record'));
  reads.length = 0;
  await fs.writeFile(path.join(dir, 'drop', 'f.txt'), 'x');
  await until(() => reads.includes('record'));
  assert.ok(reads.includes('record'), 'a document dropped on it');
});

test('an Agent that leaves the listing goes from the cards', async (t) => {
  let listing = [session('a'), session('b')];
  feedEvents({ list: async () => listing, card: async (s) => ({ name: s.name }) });
  const b = open(t);
  await settle();
  listing = [session('a')];
  changed();
  await settle();
  assert.deepEqual(b.got('cards').at(-1)?.cards, [{ name: 'a' }]);
});

test('a tab that connects while the listing fails is sent what every other tab holds', async (t) => {
  let fail = false;
  feedEvents({ list: async () => { if (fail) throw new Error('tmux is restarting'); return [session('a')]; }, card: async (s) => ({ name: s.name, stance: 'idle' }) });
  const first = open(t);
  await settle();
  assert.equal(first.got('sessions').length, 1);
  fail = true;
  const late = open(t);
  await settle();
  assert.deepEqual(late.got('sessions').map((m) => (m.list as Array<{ name: string }>).map((s) => s.name)), [['a']], 'the last good session list');
  assert.deepEqual(late.got('cards').map((m) => m.cards), [[{ name: 'a', stance: 'idle' }]], 'and the cards');
  assert.equal(first.got('sessions').length, 1, 'the tab already open is sent nothing again');
});

test('the session list pushes when a painted field moves, and never for activity alone', async (t) => {
  let listing = [session('a', { title: 'one' })];
  feedEvents({ teams: async () => [], list: async () => listing });
  const b = open(t);
  await settle();
  assert.equal(b.got('sessions').length, 1);
  listing = [session('a', { title: 'one', activity: 99 })];
  await tick();
  assert.equal(b.got('sessions').length, 1, 'activity is not painted: a notification that only moved it sends nothing');
  listing = [session('a', { title: 'two', activity: 99 })];
  await tick();
  assert.equal(b.got('sessions').length, 2, 'a title is painted, so it pushes though names, Teams and leads did not move');
  assert.equal(sessionsSignature([{ name: 'a', activity: 1 }]), sessionsSignature([{ name: 'a', activity: 2 }]));
});

test('the rosters are read once per write, pushed when they moved, and held for a fresh connection', async (t) => {
  let reads = 0;
  let rosters: unknown[] = [{ name: 'front-2', projects: [] }];
  feedEvents({ list: async () => [session('a')], teams: async () => { reads += 1; return rosters; } });
  const first = open(t);
  await settle();
  await pushTeams();
  assert.deepEqual(first.got('teams'), [{ t: 'teams', rosters }], 'the first read is pushed');
  await pushTeams();
  assert.equal(first.got('teams').length, 1, 'a write that changed nothing sends nothing');
  const second = open(t);
  await settle();
  assert.deepEqual(second.got('teams'), [{ t: 'teams', rosters }], 'a fresh connection gets what every other tab holds, once');
  rosters = [{ name: 'front-2', projects: [{ id: 'front-2/12' }] }];
  reads = 0;
  await pushTeams();
  assert.equal(reads, 1, 'one read for every open tab');
  for (const b of [first, second]) assert.deepEqual(b.got('teams').at(-1), { t: 'teams', rosters });
  assert.equal(second.got('teams').length, 2);
});

test('roster reads land in write order', async (t) => {
  const gates: Array<(value: unknown[]) => void> = [];
  feedEvents({ list: async () => [session('a')], teams: () => new Promise((resolve) => gates.push(resolve)) });
  const b = open(t);
  await settle();
  const one = pushTeams();
  const two = pushTeams();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(gates.length, 1, 'the second read waits for the first');
  gates[0]!([{ name: 'old' }]);
  await one;
  gates[1]!([{ name: 'new' }]);
  await two;
  assert.deepEqual(b.got('teams').map((m) => m.rosters), [[{ name: 'old' }], [{ name: 'new' }]]);
});


test('held messages are sent when they change, and whole to a fresh connection', async (t) => {
  let list: unknown[] = [{ id: 'm1' }];
  feedEvents({ list: async () => [session('a')], messages: async () => list });
  const first = open(t);
  await settle();
  await pushMessages();
  assert.deepEqual(first.got('messages'), [{ t: 'messages', list }]);
  await pushMessages();
  assert.equal(first.got('messages').length, 1, 'a read that found the same queue sends nothing');
  list = [];
  await pushMessages();
  assert.deepEqual(first.got('messages').at(-1), { t: 'messages', list: [] });
  assert.equal(publishHeld({ t: 'memory', reading: { off: true } }), true);
  assert.equal(publishHeld({ t: 'memory', reading: { off: true } }), false, 'off is pushed once');
  const second = open(t);
  await settle();
  assert.deepEqual(second.got('messages'), [{ t: 'messages', list: [] }], 'a fresh tab gets the queue every tab holds');
  assert.deepEqual(second.got('memory'), [{ t: 'memory', reading: { off: true } }]);
});

test('a want answers that one connection with the message a write sends everybody', async (t) => {
  const boards: Record<string, unknown> = { 'front-2': { brief: 'b', posts: [{ id: '1' }], more: false } };
  feedEvents({
    list: async () => [session('a')],
    wipeboard: async (board) => (boards[board] as Record<string, unknown>) ?? null,
    jikan: async (team) => team === '*' ? [{ id: 'j', team: 'front-2' }] : team === 'front-2' ? [{ id: 'j' }] : null,
  });
  const asker = open(t);
  const other = open(t);
  await settle();
  asker.say({ t: 'want', resource: 'wipeboard', board: 'front-2' });
  asker.say({ t: 'want', resource: 'jikan', team: '*' });
  asker.say({ t: 'want', resource: 'wipeboard', board: 'nope' });
  await settle();
  assert.deepEqual(asker.got('wipeboard'), [{ t: 'wipeboard', board: 'front-2', brief: 'b', posts: [{ id: '1' }], more: false }]);
  assert.deepEqual(asker.got('jikan'), [{ t: 'jikan', team: '*', jobs: [{ id: 'j', team: 'front-2' }] }]);
  assert.deepEqual(other.got('wipeboard'), [], 'only the connection that asked');
});

test('a burst of file events from one write is one read and one push', async (t) => {
  let reads = 0;
  let posts = [{ id: '1' }];
  feedEvents({ list: async () => [session('a')], wipeboard: async () => { reads += 1; return { posts }; } });
  const b = open(t);
  await settle();
  posts = [{ id: '1' }, { id: '2' }];
  await Promise.all([pushWipeboard('front-2'), pushWipeboard('front-2'), pushWipeboard('front-2'), pushWipeboard('front-2')]);
  assert.ok(reads <= 2, `one read running and one waiting, not four (${reads})`);
  assert.deepEqual(b.got('wipeboard'), [{ t: 'wipeboard', board: 'front-2', posts }]);
  await pushWipeboard('front-2');
  assert.equal(b.got('wipeboard').length, 1, 'the same board read again sends nothing');
});

test('a Team\'s jobs changing pushes that Team and every Team', async (t) => {
  let jobs = [{ id: 'j1' }];
  feedEvents({ list: async () => [session('a')], jikan: async (team) => team === '*' ? jobs.map((j) => ({ ...j, team: 'front-2' })) : jobs });
  const b = open(t);
  await settle();
  jobs = [{ id: 'j1' }, { id: 'j2' }];
  await pushJikan('front-2');
  assert.deepEqual(b.got('jikan').map((m) => [m.team, (m.jobs as unknown[]).length]), [['front-2', 2], ['*', 2]]);
});

test('GitHub setup is watched while a setup session is attached, and once after it closes', async (t) => {
  let attached = false;
  let answer = { authenticated: false };
  feedEvents({ list: async () => [session('a')], github: { attached: async () => attached, answer: async () => answer } });
  const b = open(t);
  await settle();
  assert.deepEqual(b.got('github-setup'), [], 'nothing while nothing is attached');
  attached = true;
  await tick();
  assert.deepEqual(b.got('github-setup'), [{ t: 'github-setup', github: { authenticated: false } }]);
  await tick();
  assert.equal(b.got('github-setup').length, 1, 'an unchanged answer sends nothing');
  answer = { authenticated: true };
  attached = false; // the login finished and its session closed
  await tick();
  assert.deepEqual(b.got('github-setup').at(-1), { t: 'github-setup', github: { authenticated: true } });
  answer = { authenticated: false };
  await tick();
  assert.equal(b.got('github-setup').length, 2, 'then nothing until a session is attached again');
});

test('a store folder change names the file that changed', async (t) => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-watch-'));
  const seen: string[] = [];
  const stop = watchStore(dir, (file) => seen.push(file));
  t.after(async () => { stop(); await fs.rm(dir, { recursive: true, force: true }); });
  await fs.mkdir(path.join(dir, 'front-2', 'posts'), { recursive: true });
  await fs.writeFile(path.join(dir, 'front-2', 'posts', '1.md'), 'hello');
  for (let i = 0; i < 50 && !seen.some((f) => f.startsWith('front-2/posts')); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(seen.some((f) => f.split('/')[0] === 'front-2'), `saw ${seen.join(', ')}`);
});

test('while Mika is starting the server looks again and pushes each change, then stops', async (t) => {
  feedEvents({ list: async () => [session('a')] });
  const b = open(t);
  await settle();
  const { watchMika } = await import('../src/routes/launch.js');
  const answers = ['starting', 'starting', 'action_required'];
  let looks = 0;
  await watchMika(async () => ({ ok: false, state: answers[looks++] ?? 'ready', code: 'provider_confirmation_required' }), { state: 'starting' }, 1);
  assert.equal(looks, 3, 'it stops at the first answer that is not starting');
  assert.deepEqual(b.got('mika'), [{ t: 'mika', ok: false, state: 'action_required', code: 'provider_confirmation_required' }], 'an unchanged answer sends nothing');
  assert.equal(watchMika(async () => ({ state: 'ready' }), { state: 'ready' }), null, 'a ready answer starts no watch');
});

test('a socket that reopened mid-shutdown asks for it and gets the operation as it stands', async (t) => {
  const operation = { id: 'op1', session: 'leaving', state: 'running', phase: 'closing_desks' };
  feedEvents({ list: async () => [session('a')], shutdown: (id) => id === 'op1' ? operation : null });
  const b = open(t);
  await settle();
  b.say({ t: 'want', resource: 'shutdown', id: 'op1' });
  b.say({ t: 'want', resource: 'shutdown', id: 'gone' });
  await settle();
  assert.deepEqual(b.got('shutdown'), [{ t: 'shutdown', ...operation }]);
});
