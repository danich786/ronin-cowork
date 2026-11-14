/**
 * The Tools help page's list is generated from ronin_catalogs/tools headers
 * (scripts/tool-list.mjs); this fails when someone edits a header and not the page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

test('docs/using-ronin/agent-tools.md lists every told tool from its header', () => {
  const script = path.join(import.meta.dirname, '..', 'scripts', 'tool-list.mjs');
  const run = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});
