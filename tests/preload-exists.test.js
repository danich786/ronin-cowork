// Every module either document preloads must exist: a retired module left in a preload list
// is a 404 and an aborted request on every page load, which the render gate counts as
// two failures (promotion 20260913T114011Z-promote-jobber-wcl1 reverted on exactly that).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('every modulepreload names a module that exists', async () => {
  for (const document of ['index.html', 'mobile.html']) {
    const html = await readFile(new URL(`../public/${document}`, import.meta.url), 'utf8');
    const preloads = [...html.matchAll(/modulepreload" href="\/__RONIN_ASSET_VERSION__\/(js\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(preloads.length > 10, `${document} preloads its modules (${preloads.length} found)`);
    const missing = [];
    for (const file of preloads) await access(new URL(`../public/${file}`, import.meta.url)).catch(() => missing.push(file));
    assert.deepEqual(missing, [], `${document} does not preload a missing module`);
  }
});
