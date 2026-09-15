import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { migrateSopsToBehaviours } from '../src/behaviour-store-migration.js';

test('legacy owner SOPs move whole into Behaviors and differing collisions refuse', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ronin-behaviour-migration-'));
  const oldUser = process.env.RONIN_USER_ROOT;
  try {
    process.env.RONIN_USER_ROOT = root;
    await mkdir(path.join(root, 'sops'), { recursive: true });
    await mkdir(path.join(root, 'ways'), { recursive: true });
    await writeFile(path.join(root, 'sops', 'mine.md'), '# Mine\n');
    assert.deepEqual(await migrateSopsToBehaviours(), { moved: ['mine.md'], deduplicated: [] });
    const migrated = await readFile(path.join(root, 'ways', 'mine.md'), 'utf8');
    assert.match(migrated, /^# Mine\n\n- \*\*label:\*\* Mine/m);
    assert.match(migrated, /^- \*\*scope:\*\* situational/m);

    await mkdir(path.join(root, 'sops'), { recursive: true });
    await writeFile(path.join(root, 'sops', 'mine.md'), '# Different\n');
    await assert.rejects(migrateSopsToBehaviours(), /migration collision for mine\.md/);
    assert.equal(await readFile(path.join(root, 'ways', 'mine.md'), 'utf8'), migrated);
  } finally {
    if (oldUser === undefined) delete process.env.RONIN_USER_ROOT;
    else process.env.RONIN_USER_ROOT = oldUser;
    await rm(root, { recursive: true, force: true });
  }
});
