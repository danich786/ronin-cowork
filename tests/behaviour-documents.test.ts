import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = await mkdtemp(path.join(os.tmpdir(), 'ronin-behaviour-docs-'));
process.env.RONIN_BEHAVIOURS_DIR = path.join(root, 'behaviours');
process.env.RONIN_FACTS_DIR = path.join(root, 'facts');

const {
  BehaviourDocumentError,
  createBehaviourDocument,
  readBehaviourDocument,
  updateBehaviourDocument,
} = await import('../src/behaviour-documents.js');

test('stock facts, behaviours and tools are readable by kind and name', async () => {
  const rows = await Promise.all([
    readBehaviourDocument('behaviours', 'base-agent'),
    readBehaviourDocument('facts', 'user-intro'),
    readBehaviourDocument('behaviours', 'team-lead'),
    readBehaviourDocument('tools', 'work-item'),
  ]);
  assert.deepEqual(rows.map((row) => row.name), ['base-agent', 'user-intro', 'team-lead', 'work-item']);
  assert.ok(rows.every((row) => row.origin === 'stock'));
});

test('saving stock creates a whole-file user copy that replaces it by name, and never changes stock', async () => {
  const stock = await readBehaviourDocument('behaviours', 'write-it-down');
  assert.equal(stock.origin, 'stock');
  const text = stock.text.replace('Keep a clean', 'Keep a tidy');
  const saved = await createBehaviourDocument({ scope: 'behaviours', name: 'write-it-down', text, shadow: true });
  assert.equal(saved.origin, 'user');
  assert.equal(saved.shadowed, true);
  assert.equal(await readFile(path.join(process.env.RONIN_BEHAVIOURS_DIR!, 'write-it-down.md'), 'utf8'), text);
});

test('Save As is create-only and rejects stock or user collisions', async () => {
  const text = '# My Way\n- **seed:** Mine.\n- **depth:** none\n\nWork this way.\n';
  const created = await createBehaviourDocument({ scope: 'behaviours', name: 'my-way', text });
  assert.equal(created.origin, 'user');
  await assert.rejects(() => createBehaviourDocument({ scope: 'behaviours', name: 'my-way', text }), (error: unknown) => error instanceof BehaviourDocumentError && error.status === 409);
  await assert.rejects(() => createBehaviourDocument({ scope: 'behaviours', name: 'visual-staging', text }), (error: unknown) => error instanceof BehaviourDocumentError && error.status === 409);
});

test('user updates require the last read revision', async () => {
  const current = await readBehaviourDocument('behaviours', 'my-way');
  const next = await updateBehaviourDocument({ scope: 'behaviours', name: 'my-way', text: current.text.replace('Work this way.', 'Work carefully.'), revision: current.revision });
  assert.match(next.text, /Work carefully/);
  await assert.rejects(() => updateBehaviourDocument({ scope: 'behaviours', name: 'my-way', text: current.text, revision: current.revision }), (error: unknown) => error instanceof BehaviourDocumentError && error.status === 409);
});

test('bad names, unknown kinds and symlinked user files are refused', async () => {
  const text = '# Bad\n';
  await assert.rejects(() => createBehaviourDocument({ scope: 'behaviours', name: '../bad', text }), BehaviourDocumentError);
  await assert.rejects(() => createBehaviourDocument({ scope: 'selected', name: 'bad', text }), BehaviourDocumentError);
  const dir = process.env.RONIN_BEHAVIOURS_DIR!;
  await mkdir(dir, { recursive: true });
  const outside = path.join(root, 'outside.md');
  await writeFile(outside, '# Outside\n');
  await symlink(outside, path.join(dir, 'linked.md'));
  await assert.rejects(() => updateBehaviourDocument({ scope: 'behaviours', name: 'linked', text: '# Linked\n', revision: 'x' }), (error: unknown) => error instanceof BehaviourDocumentError && error.status === 409);
});
