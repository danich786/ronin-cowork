import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveFileLink } from '../src/file-link.js';

test('a Chat file link resolves ~ to home and a relative path in the first base that holds it (KAN-619)', async () => {
  const desk = await mkdtemp(path.join(os.tmpdir(), 'ronin-link-'));
  const cwd = await mkdtemp(path.join(os.tmpdir(), 'ronin-link-'));
  await mkdir(path.join(cwd, 'docs'));
  await writeFile(path.join(cwd, 'docs', 'a.md'), '# a\n');
  assert.equal(resolveFileLink('~/docs/a.md', [], cwd), path.join(cwd, 'docs', 'a.md'));
  assert.equal(resolveFileLink('/etc/hosts', [desk]), '/etc/hosts');
  assert.equal(resolveFileLink('docs/a.md', [desk, cwd]), path.join(cwd, 'docs', 'a.md'));
  assert.equal(resolveFileLink('docs/none.md', [desk, cwd]), null);
  // Only a file that is there (KAN-701): a missing one, or a folder, is no link.
  assert.equal(resolveFileLink('~/x/y.md', [], '/home/me'), null);
  assert.equal(resolveFileLink('/no/such/file.md', []), null);
  assert.equal(resolveFileLink(cwd, []), null);
  // Written from the folder above a Workspace folder (samurai_lab/ronin_cloud/X.md): that folder is a base.
  assert.equal(resolveFileLink(`${path.basename(cwd)}/docs/a.md`, [desk, path.dirname(cwd)]), path.join(cwd, 'docs', 'a.md'));
});
