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
  assert.equal(resolveFileLink('~/x/y.md', [], '/home/me'), '/home/me/x/y.md');
  assert.equal(resolveFileLink('/etc/hosts', [desk]), '/etc/hosts');
  assert.equal(resolveFileLink('docs/a.md', [desk, cwd]), path.join(cwd, 'docs', 'a.md'));
  assert.equal(resolveFileLink('docs/none.md', [desk, cwd]), null);
});
