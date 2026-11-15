/**
 * AN AGENT'S TEMP AND PROCESSES ARE ITS OWN (w624; src/agent-scope.ts). Temp on disk under the
 * session folder, short enough for a socket; a stop never touches a live pane's scope or this
 * service's; the start sweep takes only what ended Agents left, and never from a rig.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-agent-scope-'));
process.env.HOME = isolated;
process.env.RONIN_USER_ROOT = path.join(isolated, 'user');
process.env.RONIN_DATA_ROOT = path.join(isolated, 'd');
delete process.env.TMUX;

const { agentTempDir, agentTempEnv, memoryCeiling, recordScope, stoppable, sweepLeftovers, TEMP_ROOT_MAX } = await import('../src/agent-scope.ts');
const { storeDir } = await import('../src/resources.ts');
const { panesDied } = await import('../src/tmux.ts');
const { liveScopeOps, sessionFolders } = await import('../src/agent-scope.ts');
const { spawn } = await import('node:child_process');
type Ops = import('../src/agent-scope.ts').ScopeOps;

const unit = (n: number) => `tmux-spawn-0000000${n}-0000-4000-8000-000000000000.scope`;

function fakeOps(over: Partial<Ops> & { scopeByPid?: Record<number, string> } = {}): Ops & { stopped: string[] } {
  const stopped: string[] = [];
  return {
    stopped,
    scopeOf: async (pid) => over.scopeByPid?.[pid] ?? null,
    scopes: async () => [],
    folderScopes: async () => [],
    stop: async (units) => { stopped.push(...units); },
    limit: async () => {},
    self: async () => ({ pid: 1, service: true }),
    ...over,
  };
}

test('temp lives in the session folder, on disk, and the Agent is pointed at it', async () => {
  const env = await agentTempEnv('a-1');
  const dir = path.join(storeDir('session'), 'a-1', 'tmp');
  assert.equal(env.TMPDIR, dir);
  assert.equal(env.CLAUDE_CODE_TMPDIR, dir);
  assert.ok((await fs.stat(dir)).isDirectory());
});

test('a session path too long for a socket gets a short root, linked from its folder', async () => {
  const key = `${'x'.repeat(64)}-00000000-0000-4000-8000-000000000000`;
  const dir = agentTempDir(key);
  assert.ok(dir.length <= TEMP_ROOT_MAX, dir);
  await agentTempEnv(key);
  assert.equal(await fs.readlink(path.join(storeDir('session'), key, 'tmp')), dir);
});

test('a stop skips live panes\' scopes and this service\'s own', async () => {
  const ops = fakeOps({ scopeByPid: { 10: unit(1), 1: unit(3) } });
  assert.deepEqual(await stoppable([unit(1), unit(2), unit(3), 'tmux-server.service'], [10], ops), [unit(2)]);
});

test('the start sweep takes only Ronin\'s own leftovers, and the rigs they started', async () => {
  await recordScope('ended-1', unit(5));
  const ops = fakeOps({
    scopeByPid: { 100: unit(1), 61: unit(2), 81: unit(7) },
    scopes: async () => [
      { unit: unit(1), pane: 100, server: 50 }, // live pane of our server: kept
      { unit: unit(2), pane: 101, server: 50 }, // our server, pane gone: stopped
      { unit: unit(3), pane: 200, server: 61 }, // pane of a rig whose server ran in unit 2: stopped
      { unit: unit(4), pane: 300, server: 70 }, // another tmux server, gone or not: the user's, kept
      { unit: unit(6), pane: 400, server: 81 }, // a live user's tmux server elsewhere: kept
    ],
  });
  await fs.mkdir(path.join(storeDir('session'), '..', 'tmp', 'deadbeefdeadbeef'), { recursive: true });
  const asked: string[][] = [];
  ops.folderScopes = async (dirs) => { asked.push(dirs); return dirs.some((d) => d.endsWith('ended-1')) ? [unit(8)] : []; };
  const swept = await sweepLeftovers({ server: 50, livePanes: [100], sessionKeys: ['ended-1', 'live-1'], liveKeys: ['live-1'] }, ops);
  assert.deepEqual(ops.stopped.sort(), [unit(2), unit(3), unit(5), unit(8)]);
  assert.deepEqual(asked, [sessionFolders('ended-1')], 'only folders of sessions that are not live are scanned');
  assert.ok(swept.temp.includes('deadbeefdeadbeef'));
});

test('the ceiling follows the box: a fifth of RAM, never under 1 GiB', () => {
  const G = 1_073_741_824;
  assert.deepEqual(memoryCeiling(16 * G), { MemoryHigh: '2785M', MemoryMax: '3276M', MemorySwapMax: '819M' });
  assert.deepEqual(memoryCeiling(4 * G), { MemoryHigh: '870M', MemoryMax: '1024M', MemorySwapMax: '256M' });
});

test('a Ronin that is not the box\'s service (a rig in a pane) never sweeps', async () => {
  const ops = fakeOps({ self: async () => ({ pid: 1, service: false }), scopes: async () => [{ unit: unit(2), pane: 1, server: 50 }] });
  assert.deepEqual(await sweepLeftovers({ server: 50, livePanes: [], sessionKeys: [], liveKeys: [] }, ops), { scopes: [], temp: [] });
  assert.deepEqual(ops.stopped, []);
});

test('a process is found by where it runs from: its working folder inside the session folder', { skip: process.platform !== 'linux' }, async () => {
  const folder = sessionFolders('helper-1')[0];
  await fs.mkdir(folder, { recursive: true });
  const child = spawn('sleep', ['30'], { cwd: folder, stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 200));
    const own = await liveScopeOps.scopeOf(process.pid);
    const found = await liveScopeOps.folderScopes([folder]);
    // Under a tmux pane the child shares this test's scope; elsewhere there is no pane scope to find.
    assert.deepEqual(found, own ? [own] : []);
    assert.deepEqual(await liveScopeOps.folderScopes([path.join(isolated, 'elsewhere')]), []);
  } finally { child.kill(); }
});

test('the pane-dead push names each session whose pane newly died, once', () => {
  const last = new Map<string, string>();
  assert.deepEqual(panesDied('a=0,b=0,', last), []);
  assert.deepEqual(panesDied('a=0,b=1,', last), ['b']);
  assert.deepEqual(panesDied('a=0,b=1,', last), []);
  assert.deepEqual(panesDied('a=01,b=1,', last), ['a']);
});

test.after(() => fs.rm(isolated, { recursive: true, force: true }));
