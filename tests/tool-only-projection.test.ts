import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('the core contribution carries no macro/action catalog or compiler projection', async () => {
  const source = await readFile(path.join(root, 'src', 'spawn.ts'), 'utf8');
  const core = /const CORE_CONTRIBUTION[\s\S]*?\n};/.exec(source)?.[0] ?? '';
  assert.match(core, /macros: \[\]/);
  assert.match(core, /actions: \[\]/);
  assert.doesNotMatch(core, /['"]tejun['"]/);
  assert.doesNotMatch(core, /tejun-step/);
  assert.match(source, /capability_tools: capabilityTools\(capabilities\)/,
    'selected capability tools remain the replacement projection');
});
