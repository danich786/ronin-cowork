import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { commitPage, resolveCommit } from '../src/commit-link.js';

test('a commit hash in Chat resolves only in the Agent\'s repos; pressed, its git show is a page (KAN-701)', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'ronin-commit-'));
  const other = await mkdtemp(path.join(os.tmpdir(), 'ronin-commit-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  await writeFile(path.join(repo, 'a.md'), '# a <b>\n');
  git('add', 'a.md');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'add a');
  const sha = git('rev-parse', 'HEAD');

  assert.deepEqual(await resolveCommit(sha.slice(0, 7), [other, repo]), { sha, repo });
  assert.equal(await resolveCommit(sha.slice(0, 7), [other]), null, 'not in its repos: no link');
  assert.equal(await resolveCommit('acceded', [repo]), null, 'a word that is hex is no commit');
  assert.equal(await resolveCommit('HEAD', [repo]), null, 'only a hash');

  const out = path.join(other, 'commits');
  const page = await commitPage(sha.slice(0, 7), [repo], out);
  assert.equal(page, path.join(out, `${sha}.html`));
  const html = await readFile(page!, 'utf8');
  assert.match(html, /add a/);
  assert.match(html, /a\.md \| 1 \+/, 'the --stat');
  assert.match(html, /# a &lt;b&gt;/, 'the patch, escaped');
});
