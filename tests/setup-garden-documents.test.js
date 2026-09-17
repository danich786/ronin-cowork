import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('every Setup Canvas guide is a shipped product document, not a registered workspace dependency', async () => {
  const catalog = JSON.parse(await readFile(new URL('../public/content/setup-garden.v2.json', import.meta.url), 'utf8'));
  const documents = Object.values(catalog.canvases).flatMap((canvas) => canvas.media || []).filter((item) => item.kind === 'doc');
  assert.ok(documents.length > 0);
  for (const item of documents) {
    assert.equal(item.root, undefined, `${item.id} must not require a registered Workspace Folder`);
    assert.match(item.path, /^docs\/.+\.md$/);
    await access(new URL(`../${item.path}`, import.meta.url));
  }
  const setup = await readFile(new URL('../public/js/setup-view.js', import.meta.url), 'utf8');
  assert.match(setup, /else query\.set\('product', '1'\)/);
});
