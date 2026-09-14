import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { prepareDevServices } from '../src/dev-services.js';
import { envWithoutGitLocation } from '../src/tegami.js';

const repository = path.resolve(import.meta.dirname, '..');
const env = envWithoutGitLocation();
const git = (dir: string, ...args: string[]) => execFileSync('git', ['-C', dir, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-dev-services-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'cowork'), source = path.join(root, 'services');
  for (const dir of [target, source]) {
    await fs.mkdir(path.join(dir, 'bin'), { recursive: true });
    git(dir, 'init', '--initial-branch=dev');
    git(dir, 'config', 'user.name', 'Test');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    await fs.writeFile(path.join(dir, 'RONIN_REPO'), 'mode=reviewed\nworking=dev\nstable=master\ndesks=managed\n');
  }
  await fs.writeFile(path.join(target, 'bin/ronin-store'), '', { mode: 0o755 });
  await fs.mkdir(path.join(source, 'sample'));
  await fs.writeFile(path.join(source, 'sample/register.ts'), 'export const name = "sample";\n');
  await fs.writeFile(path.join(source, 'bin/dev-sync'), '#!/bin/sh\nset -eu\nmkdir -p "$1/src/services/sample"\ncp sample/register.ts "$1/src/services/sample/register.ts"\n', { mode: 0o755 });
  for (const dir of [target, source]) { git(dir, 'add', '.'); git(dir, 'commit', '-m', 'Fixture'); }
  const roots = [{ name: 'ronin_cowork', dir: target }, { name: 'ronin_services', dir: source }];
  return { root, target, source, roots };
}

test('global working checkout refreshes from Services working branch, not its registered desk', async (t) => {
  const { root, target, source, roots } = await fixture(t);
  const desk = path.join(root, 'services-desk');
  git(source, 'worktree', 'add', '-b', 'team/test/cutter', desk);
  await fs.writeFile(path.join(desk, 'sample/register.ts'), 'desk-only change');
  roots[1].dir = desk;
  const result = await prepareDevServices(target, roots);
  assert.deepEqual(result, { status: 'synced', source, target, revision: git(source, 'rev-parse', 'HEAD') });
  assert.equal(await fs.readFile(path.join(target, 'src/services/sample/register.ts'), 'utf8'), 'export const name = "sample";\n');
  // A later accepted working tip must replace the placed copy on the next start.
  await fs.writeFile(path.join(source, 'sample/register.ts'), 'accepted second revision');
  git(source, 'commit', '-am', 'Next accepted revision');
  await prepareDevServices(target, roots);
  assert.equal(await fs.readFile(path.join(target, 'src/services/sample/register.ts'), 'utf8'), 'accepted second revision');
});

test('release, private desk, candidate and core-only starts leave placement alone', async (t) => {
  const { root, target, source, roots } = await fixture(t);
  const untouched = path.join(target, 'src/services/keep');
  await fs.mkdir(untouched, { recursive: true });
  await fs.writeFile(path.join(untouched, 'register.js'), 'installed');
  await fs.writeFile(path.join(target, 'VERSION'), 'release=v1.0.0\n');
  assert.equal((await prepareDevServices(target, roots)).status, 'skipped');
  await fs.unlink(path.join(target, 'VERSION'));
  assert.equal((await prepareDevServices(target, roots.slice(0, 1))).status, 'skipped');
  assert.equal((await prepareDevServices(target, [])).status, 'skipped');
  for (const branch of ['team/test/cutter', 'candidate']) {
    const desk = path.join(root, branch.replaceAll('/', '-'));
    git(target, 'worktree', 'add', '-b', branch, desk);
    assert.equal((await prepareDevServices(desk, roots)).status, 'skipped');
  }
  assert.equal(await fs.readFile(path.join(untouched, 'register.js'), 'utf8'), 'installed');
  await assert.rejects(fs.access(path.join(target, 'src/services/sample')));
});

test('uncommitted, deleted, and untracked runtime source cannot be placed as accepted dev', async (t) => {
  const { target, source, roots } = await fixture(t);
  for (const mutate of [
    () => fs.writeFile(path.join(source, 'sample/register.ts'), 'uncommitted'),
    () => fs.unlink(path.join(source, 'sample/register.ts')),
    () => fs.writeFile(path.join(source, 'sample/new.ts'), 'untracked'),
  ]) {
    await mutate();
    await assert.rejects(prepareDevServices(target, roots), /uncommitted/);
    git(source, 'restore', 'sample/register.ts');
    await fs.rm(path.join(source, 'sample/new.ts'), { force: true });
  }
  await assert.rejects(fs.access(path.join(target, 'src/services/sample')));
  // A document edit is outside the runtime payload.
  await fs.writeFile(path.join(source, 'notes.md'), 'Unpublished notes');
  assert.equal((await prepareDevServices(target, roots)).status, 'synced');
});

test('missing working checkout and failed placement report errors', async (t) => {
  const { target, source, roots } = await fixture(t);
  git(source, 'checkout', '-b', 'desk');
  await assert.rejects(prepareDevServices(target, roots), /no mounted checkout/);
  git(source, 'checkout', 'dev');
  await fs.writeFile(path.join(source, 'bin/dev-sync'), '#!/bin/sh\nexit 17\n', { mode: 0o755 });
  git(source, 'commit', '-am', 'Failing placement');
  await assert.rejects(prepareDevServices(target, roots));
});

test('npm start and dev prepare before launch; preparation failure prevents launch', async (t) => {
  const { root, target, source } = await fixture(t);
  const catalogs = path.join(root, 'catalogs');
  await fs.mkdir(catalogs);
  await fs.writeFile(path.join(catalogs, 'PROJECT_ROOTS.md'),
    `## ronin_cowork\n- **dir:** ${target}\n\n## ronin_services\n- **dir:** ${source}\n`);
  await fs.symlink(path.join(repository, 'node_modules'), path.join(target, 'node_modules'));
  await fs.symlink(path.join(repository, 'scripts'), path.join(target, 'scripts'));
  const shipped = JSON.parse(await fs.readFile(path.join(repository, 'package.json'), 'utf8'));
  // Keep the real preparation commands; replace the long-lived server with a payload reader.
  await fs.writeFile(path.join(target, 'launch.cjs'), "console.log('LAUNCHED:' + require('fs').readFileSync('src/services/sample/register.ts', 'utf8'))");
  await fs.writeFile(path.join(target, 'package.json'), JSON.stringify({ scripts: {
    prestart: shipped.scripts.prestart, predev: shipped.scripts.predev,
    start: 'node launch.cjs', dev: 'node launch.cjs',
  } }));
  for (const command of ['start', 'dev']) {
    await fs.rm(path.join(target, 'src/services'), { recursive: true, force: true });
    const result = spawnSync('npm', ['run', command], { cwd: target, env: { ...env, RONIN_CATALOGS_DIR: catalogs }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /dev Services: .*@.* →/);
    assert.match(result.stdout, /LAUNCHED:export const name/);
  }
  await fs.writeFile(path.join(source, 'sample/register.ts'), 'uncommitted');
  const failed = spawnSync('npm', ['start'], { cwd: target, env: { ...env, RONIN_CATALOGS_DIR: catalogs }, encoding: 'utf8' });
  assert.notEqual(failed.status, 0);
  assert.doesNotMatch(failed.stdout, /LAUNCHED:/);
  assert.match(failed.stderr, /preparation failed.*uncommitted/);
});
