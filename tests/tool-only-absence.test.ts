import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const retired = [
  'src/macros.ts',
  'src/actions.ts',
  'public/js/tilemacros.js',
  'public/js/macros.js',
  'ronin_bin/tejun',
  'ronin_bin/tejun-step',
  'ronin_catalogs/MACROS.md',
  'ronin_catalogs/ACTIONS.md',
  'ronin_catalogs/MIKA_MACROS.md',
  'ronin_bin/tejun-survey',
  'ronin_bin/tejun-account',
  'ronin_bin/tejun-secrets',
  'ronin_bin/tejun-machine-restart',
  'ronin_bin/tejun-recall',
  'ronin_bin/tejun-remember',
  'ronin_bin/tejun-send',
  'ronin_bin/tejun-peek',
  'ronin_bin/tejun-team',
  'ronin_bin/tejun-wipeboard',
  'ronin_bin/tejun-teampage',
  'ronin_bin/tejun-jikan',
  'ronin_bin/tejun-rireki',
  'ronin_bin/tejun-desk',
  'ronin_bin/ronin-repo-init',
  'ronin_bin/read_tegami',
  'ronin_bin/write_tegami',
  'ronin_bin/tejun-team-set',
];
const shipped = ['src', 'public', 'scripts', 'ronin_bin', 'ronin_catalogs', 'ronin_library', 'ronin_session_boot', 'ronin_sops', 'docs'];
const forbidden = /(?:\/api\/(?:macros|actions)\b|\btejun-(?:step|desk|team-set)\b|\b(?:ronin-repo-init|read_tegami|write_tegami)\b|\b(?:MIKA_)?(?:MACROS|ACTIONS)\.md\b|compile-macro|\*\*(?:macros|actions):\*\*)/;

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else if (entry.isFile()) yield file;
  }
}

test('macro and action compilers, catalogs, routes, and UI are absent', async () => {
  for (const relative of retired) {
    await assert.rejects(access(path.join(root, relative)), `${relative} must not exist, even as an alias`);
  }
  await access(path.join(root, 'public/js/session-picker.js'));

  const offenders: string[] = [];
  for (const relative of shipped) {
    for await (const file of walk(path.join(root, relative))) {
      if (/\.(?:png|jpe?g|gif|woff2?|ttf|ico|wasm)$/i.test(file)) continue;
      if (forbidden.test(await readFile(file, 'utf8'))) offenders.push(path.relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], 'a shipped macro/action mechanism reference survives');
});

test('definition adapters expose no retired macro or action fields', async () => {
  const adapters = await readFile(path.join(root, 'src/resource-adapters.ts'), 'utf8');
  assert.doesNotMatch(adapters, /\b(?:macros|actions)\s*:/);
  assert.doesNotMatch(adapters, /d\.get\(['"](?:macros|actions)['"]\)/);
});
