/**
 * Desks and promotion: an Agent opens a desk on a managed repository, commits, hands in to
 * its Team's line; the lead promotes the line into `dev`. Real git in scratch repositories.
 * The live restart is skipped (--no-restart); the health step is checked below with the
 * restart and probe faked, since both act on the machine.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { bootRonin, ROOT } from './helpers/ronin.js';

const GIT_ENV = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const ronin = await bootRonin('promotion', { env: GIT_ENV });
test.after(() => ronin.stop());
const git = (dir: string, ...args: string[]) => execFileSync('git', ['-C', dir, ...args], { env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

const shop = path.join(ronin.scratch, 'repos', 'shop');
await fs.mkdir(shop, { recursive: true });
git(shop, 'init', '-q', '-b', 'master');
await fs.writeFile(path.join(shop, 'README.md'), '# shop\n');
await fs.writeFile(path.join(shop, 'RONIN_REPO'), 'mode=reviewed\nworking=dev\nstable=master\ndesks=managed\n');
git(shop, 'add', '-A');
git(shop, 'commit', '-q', '-m', 'first');
git(shop, 'checkout', '-q', '-b', 'dev');
await fs.mkdir(path.join(ronin.scratch, 'user', 'catalogs'), { recursive: true });
await fs.writeFile(path.join(ronin.scratch, 'user', 'catalogs', 'PROJECT_ROOTS.md'), `# roots\n\n## shop\n- **dir:** ${shop}\n- **remit:** the shop\n`);

await ronin.api('/api/team-rosters', { body: { name: 'crew', objective: 'Build the shop.' } });
await ronin.api('/api/launch', { body: { name: 'builder', provider: 'anthropic', team: 'crew', prompt: 'Build.' } });
await ronin.api('/api/launch', { body: { name: 'boss', provider: 'anthropic', team: 'crew', team_lead: true, prompt: 'Lead.' } });
const paneOf = (name: string) => ronin.tmux.run('display-message', '-p', '-t', `=${name}:`, '#{pane_id}');
const asBuilder = { TMUX_PANE: await paneOf('builder') };
const asBoss = { TMUX_PANE: await paneOf('boss') };
const run = (cmd: string, args: string[], env: NodeJS.ProcessEnv = {}) => new Promise<{ status: number; stdout: string; stderr: string }>((resolve) => {
  execFile(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...ronin.env, ...env } }, (error, stdout, stderr) =>
    resolve({ status: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout, stderr }));
});

test('desk open, commit, hand-in, promote: the change reaches dev and the item says so', async () => {
  const opened = await ronin.tool('worktree-desk', ['open', 'shop'], { env: asBuilder });
  assert.equal(opened.status, 0, opened.stderr + opened.stdout);
  const desk = /worktree (\S+)/.exec(opened.stdout)?.[1];
  assert.ok(desk, opened.stdout);
  await fs.writeFile(path.join(desk, 'till.txt'), 'adds up\n');
  git(desk, 'add', '-A');
  git(desk, 'commit', '-q', '-m', 'the till adds up');
  const tip = git(desk, 'rev-parse', 'HEAD');

  const created = await ronin.tool('item', ['create', '--title', 'The till adds up'], { env: asBuilder });
  const id = /created (\S+)/.exec(created.stdout)![1];
  await ronin.tool('item', ['transition', id, 'In Progress'], { env: asBuilder });
  const handIn = await ronin.tool('worktree-desk', ['hand-in', 'shop', '--item', id, '--note', 'Ring up a sale.'], { env: asBuilder });
  assert.equal(handIn.status, 0, handIn.stderr + handIn.stdout);
  assert.equal(JSON.parse((await ronin.tool('item', ['read', id, '--json'], { env: asBuilder })).stdout).status, 'In Review');
  assert.notEqual(git(shop, 'rev-parse', 'dev'), tip, 'a hand-in does not touch dev');

  const promoted = await run(path.join(ROOT, 'bin', 'ronin-promote'), ['crew', '--no-restart'], asBoss);
  assert.equal(promoted.status, 0, promoted.stderr + promoted.stdout);
  git(shop, 'merge-base', '--is-ancestor', tip, 'dev');
  assert.equal(git(shop, 'show', 'dev:till.txt'), 'adds up');
  assert.match(promoted.stdout, /crew/);
});

test('a promotion whose health fails after restart is reverted: dev goes back to what it was', async () => {
  // In-process with the machine effects faked: restart would restart this box's Ronin.
  process.env.RONIN_WORKTREES_DIR = path.join(ronin.scratch, 'fx-worktrees');
  process.env.RONIN_PROMOTION_LEDGER_DIR = path.join(ronin.scratch, 'fx-ledger');
  const P = await import('../src/promotion/promote.js');
  const C = await import('../src/promotion/candidate.js');
  const repo = path.join(ronin.scratch, 'repos', 'kiosk');
  await fs.mkdir(repo, { recursive: true });
  git(repo, 'init', '-q', '-b', 'dev');
  await fs.writeFile(path.join(repo, 'README.md'), '# kiosk\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  const base = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'checkout', '-q', '-b', 'team/crew/dev');
  await fs.writeFile(path.join(repo, 'broken.txt'), 'blank page\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'breaks the page');
  git(repo, 'checkout', '-q', 'dev');

  const at = () => new Date().toISOString();
  let probes = 0;
  const out = await P.promoteTeam({
    team: 'crew', by: 'boss', repos: [{ repo: 'kiosk', dir: repo, line: 'team/crew/dev', target: 'dev' }],
    ledgerDir: process.env.RONIN_PROMOTION_LEDGER_DIR, log: () => undefined,
    effects: {
      restart: async () => ({ unit: 'fake', at: at(), ok: true }),
      health: async () => (++probes === 1
        ? { passed: false, checks: [{ name: 'smoke-ui', status: 'FAIL', detail: 'the page is blank' }], at: at() }
        : { passed: true, checks: [{ name: 'api/health', status: 'ok' }], at: at() }),
      notify: async () => 'posted',
      handInsFor: C.derivedHandIns,
    },
  });
  assert.equal(out.ok, false);
  assert.equal(out.receipt?.state, 'reverted');
  assert.throws(() => git(repo, 'show', 'dev:broken.txt'), 'the breaking change is off dev');
  assert.equal(git(repo, 'diff', base, 'dev', '--stat'), '', 'dev has the content it had before');
});
