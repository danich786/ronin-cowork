/**
 * THE PUBLIC session_* FAMILY (ronin_bin): session_check, session_create, session_set,
 * session_fork, session_end, session_archive and session_restore are the Agent-typed names.
 * Inspection, self-management, and the four lifecycle commands reach every Cowork Agent
 * through the base contribution; creating a supporting Agent is Team Lead work, so
 * session_create is projected only by the lead-conditional capability (ruled 2026-09-13;
 * that projection is bundle_brief's), never by the base list. The tejun-session-* and old
 * lifecycle spellings they replaced are gone — no file, alias, or shipped reference — so
 * the old names cannot regrow through a copied example.
 * Pure filesystem reads; no tmux, no socket, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const FAMILY = ['session_check', 'session_create', 'session_set'];
const LIFECYCLE = ['session_fork', 'session_end', 'session_archive', 'session_restore'];
const RETIRED = [
  'tejun-session-check', 'tejun-session-create', 'tejun-session-set',
  'tejun-fork', 'tejun-harakiri', 'tejun-archive', 'tejun-rehydrate',
  'tejun-kanban',
];
const SHIPPED = ['ronin_bin', 'ronin_catalogs', 'ronin_session_boot', 'ronin_sops', 'ronin_library', 'docs', 'src', 'public', 'scripts', 'tests', 'bin', 'libexec'];
const ABSENCE_FIXTURES = new Set([
  path.join(root, 'tests', 'session-names.test.ts'),
  path.join(root, 'tests', 'tool-bundle-dispatchers.test.ts'),
  path.join(root, 'tests', 'tool-only-absence.test.ts'),
]);

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

test('the session family exists under its public names and is executable', async () => {
  for (const name of [...FAMILY, ...LIFECYCLE]) {
    const file = path.join(root, 'ronin_bin', name);
    const s = await stat(file);
    assert.ok(s.mode & 0o111, `${name} is executable`);
    const text = await readFile(file, 'utf8');
    assert.match(text, new RegExp(`^# ${name} — `, 'm'), `${name} names itself in its header`);
    assert.match(text, new RegExp(`Run ${name} --help`), `${name} routes a bad call to its own help`);
  }
});

test('the retired session command files do not exist and no shipped surface names them', async () => {
  for (const name of RETIRED) {
    await assert.rejects(access(path.join(root, 'ronin_bin', name)), `${name} must not exist, even as an alias`);
  }
  const pattern = /tejun-(?:session-(?:check|create|set)|fork|harakiri|archive|rehydrate|kanban)\b/;
  const offenders: string[] = [];
  for (const dir of SHIPPED) {
    const full = path.join(root, dir);
    try { await access(full); } catch { continue; }
    for await (const file of walk(full)) {
      if (ABSENCE_FIXTURES.has(file)) continue;
      if (/\.(png|jpg|jpeg|gif|woff2?|ttf|ico|wasm)$/i.test(file)) continue;
      const text = await readFile(file, 'utf8');
      if (pattern.test(text)) offenders.push(path.relative(root, file));
    }
  }
  assert.deepEqual(offenders, [], 'a retired name survives in a shipped file');
});

test('the base contribution projects inspection and self-management, never supporting-Agent creation', async () => {
  const spawn = await readFile(path.join(root, 'src', 'spawn.ts'), 'utf8');
  const base = /const CORE_CONTRIBUTION[\s\S]*?tools: \[([^\]]*)\]/.exec(spawn);
  assert.ok(base, 'the base contribution lists its tools in src/spawn.ts');
  const tools = [...base![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const name of ['session_check', 'session_set']) assert.ok(tools.includes(name), `${name} is in the base tool list`);
  for (const name of LIFECYCLE) assert.ok(tools.includes(name), `${name} is in the base tool list`);
  assert.ok(!tools.includes('session_create'), 'session_create is Team Lead conditional, not universal');
  for (const name of RETIRED) assert.ok(!tools.includes(name), `${name} is not in the base tool list`);
});

test('the catalog rows and the help of the family agree on the names', async () => {
  const catalog = await readFile(path.join(root, 'ronin_catalogs', 'TOOLS.md'), 'utf8');
  for (const name of [...FAMILY, ...LIFECYCLE]) assert.match(catalog, new RegExp(`^\\| \`${name}\` \\|`, 'm'), `${name} has a TOOLS.md row`);
});
