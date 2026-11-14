/**
 * The Tools help page's list is generated from ronin_catalogs/tools headers
 * (scripts/tool-list.mjs); this fails when someone edits a header and not the page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readdirSync } from 'node:fs';

test('docs/using-ronin/agent-tools.md lists every told tool from its header', () => {
  const script = path.join(import.meta.dirname, '..', 'scripts', 'tool-list.mjs');
  const run = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
});

test('facts, behaviours and tools share one namespace: no two files have the same name', () => {
  const root = path.join(import.meta.dirname, '..', 'ronin_catalogs');
  const names = ['facts', 'behaviours', 'tools'].flatMap((dir) =>
    readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.md') && f !== 'README.md'));
  const twice = names.filter((name, i) => names.indexOf(name) !== i);
  assert.deepEqual(twice, []);
});
