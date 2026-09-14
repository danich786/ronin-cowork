import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('behaviours merge owner books over stock whole-file and append new names', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ronin-ways-'));
  process.env.RONIN_WAYS_DIR = path.join(root, 'ways');
  await mkdir(process.env.RONIN_WAYS_DIR, { recursive: true });
  await writeFile(path.join(process.env.RONIN_WAYS_DIR, 'buildout.md'), '# My Buildout\n\nMine.\n');
  await writeFile(
    path.join(process.env.RONIN_WAYS_DIR, 'my_way.md'),
    '# My Way\n- **kinds:** work, household, no_such_kind\n\nNew.\n',
  );
  try {
    const { listWays } = await import('../src/resources.js');
    const rows = await listWays();
    const buildout = rows.find((row) => row.name === 'buildout');
    assert.deepEqual(buildout, { name: 'buildout', label: 'My Buildout', blurb: 'Mine.', kinds: [], origin: 'user', shadowed: true });
    const mine = rows.find((row) => row.name === 'my_way');
    assert.equal(mine?.origin, 'user');
    assert.deepEqual(mine?.kinds, ['work', 'household']);
    assert.equal(mine?.blurb, 'New.');
    assert.equal(rows.find((row) => row.name === 'recruit')?.origin, 'stock');
  } finally {
    delete process.env.RONIN_WAYS_DIR;
    await rm(root, { recursive: true, force: true });
  }
});
