import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('behaviour books resolve from the stock shelf and whole-file owner shadows', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ronin-behaviours-'));
  process.env.RONIN_WAYS_DIR = path.join(root, 'ways');
  await mkdir(path.join(process.env.RONIN_WAYS_DIR, 'floor'), { recursive: true });
  await mkdir(path.join(process.env.RONIN_WAYS_DIR, 'selected'), { recursive: true });
  await writeFile(path.join(process.env.RONIN_WAYS_DIR, 'floor', 'mandates.md'), '# My mandates\n- **scope:** floor\n\nMine.\n');
  await writeFile(path.join(process.env.RONIN_WAYS_DIR, 'selected', 'my_way.md'), '# My Way\n- **scope:** selected\n\nMine.\n');
  try {
    const { resolveBehaviourBooks, resolveFloorBehaviours } = await import('../src/behaviours.js');
    const answer = await resolveBehaviourBooks([
      'mandates', 'ways:my_way', 'ways:missing', 'sops:github', 'bad', 'mandates',
    ]);
    assert.deepEqual(answer.delivered.map((row) => row.book), ['ways:my_way']);
    assert.equal(answer.delivered[0]?.file, path.join(process.env.RONIN_WAYS_DIR, 'selected', 'my_way.md'));
    assert.equal(answer.ignored.includes('behaviours[mandates]'), false, 'the legacy token is silently tolerated');
    assert.deepEqual(answer.ignored, ['behaviours[bad]', 'behaviours[sops:github]', 'behaviours[ways:missing]']);
    assert.equal((await resolveFloorBehaviours()).find((row) => row.book === 'mandates')?.file, path.join(process.env.RONIN_WAYS_DIR, 'floor', 'mandates.md'),
      'the floor behaviour remains discoverable and owner-shadowable outside elective resolution');
  } finally {
    delete process.env.RONIN_WAYS_DIR;
    await rm(root, { recursive: true, force: true });
  }
});
