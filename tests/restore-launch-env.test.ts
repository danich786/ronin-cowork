import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';

// KAN-555: a restore starts its Agent with the environment a launch gets. The restore route
// calls createSession with the resume argv alone; the pane must still carry ronin_bin and the
// temp dirs. Isolated tmux server, user root and home; nothing touches the live ~/ronin.
const box = await mkdtemp(path.join(os.tmpdir(), 'ronin-restore-env-'));
process.env.TMUX = '';
process.env.TMUX_TMPDIR = path.join(box, 'tmux');
process.env.RONIN_USER_ROOT = path.join(box, 'user');
process.env.HOME = path.join(box, 'home');
await mkdir(process.env.TMUX_TMPDIR, { recursive: true, mode: 0o700 });
await mkdir(process.env.HOME, { recursive: true });

const tmux = await import('../src/tmux.js');
const { REPO_ROOT } = await import('../src/resources.js');

test.after(async () => {
  await tmux.stopSessionTree('restored').catch(() => {});
  await rm(box, { recursive: true, force: true });
});

test('a restored Agent\'s pane has Ronin\'s PATH and temp dirs, as the restore route calls it', async () => {
  const out = path.join(box, 'pane-env');
  const argv = ['/bin/sh', '-c', `printenv > ${out}.tmp && mv ${out}.tmp ${out}; while :; do sleep 60; done`];
  // The exact shape of POST /api/archived-sessions/:id/rehydrate: no env of its own.
  await tmux.createSession('restored', box, { agent: true, argv, cli: 'sh', key: 'restored-key', resume: true });
  let text = '';
  for (let i = 0; i < 100 && !text; i++) {
    text = await readFile(out, 'utf8').catch(() => '');
    if (!text) await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const env = Object.fromEntries(text.split('\n').filter(Boolean).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  const PATH = (env.PATH ?? '').split(':');
  assert.ok(PATH.includes(path.join(REPO_ROOT, 'ronin_bin')), `ronin_bin missing from ${env.PATH}`);
  assert.ok(PATH.includes(path.join(REPO_ROOT, 'bin', 'shim')), `shims missing from ${env.PATH}`);
  assert.ok(env.TMPDIR && env.TMPDIR === env.CLAUDE_CODE_TMPDIR, 'temp dirs set');
});
