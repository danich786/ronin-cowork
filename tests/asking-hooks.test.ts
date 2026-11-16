/** KAN-616: the CLI's hooks raise and lower the asking flag; launch questions are set ahead. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { askingByHook, recordHook } from '../src/asking.js';
import { setAhead, tomlEnsure } from '../src/launch-ahead.js';

const ev = (hook_event_name: string, tool_name = '', notification_type = '') => ({ hook_event_name, tool_name, notification_type });

test('Claude: AskUserQuestion and a permission prompt flag; the CLI moving on lowers it', () => {
  const s = 'claude-agent';
  // The order Claude 2.1.325 sends them for an AskUserQuestion, answered.
  recordHook(s, ev('UserPromptSubmit'));
  assert.equal(askingByHook(s), false);
  recordHook(s, ev('PreToolUse', 'AskUserQuestion'));
  assert.equal(askingByHook(s), true, 'the question is up');
  recordHook(s, ev('PermissionRequest', 'AskUserQuestion'));
  recordHook(s, ev('Notification', '', 'permission_prompt'));
  assert.equal(askingByHook(s), true);
  recordHook(s, ev('PostToolUse', 'AskUserQuestion'));
  assert.equal(askingByHook(s), false, 'answered');
  // A permission prompt, then the next tool call.
  recordHook(s, ev('PreToolUse', 'Bash'));
  recordHook(s, ev('PermissionRequest', 'Bash'));
  assert.equal(askingByHook(s), true);
  recordHook(s, ev('PreToolUse', 'Read'));
  assert.equal(askingByHook(s), false);
  // An MCP form; an idle turn is not a question.
  recordHook(s, ev('Elicitation'));
  assert.equal(askingByHook(s), true);
  recordHook(s, ev('ElicitationResult'));
  recordHook(s, ev('Notification', '', 'idle_prompt'));
  assert.equal(askingByHook(s), false);
});

test('Codex: an approval flags; Stop or the next prompt lowers it', () => {
  const s = 'codex-agent';
  recordHook(s, ev('PreToolUse', 'Bash'));
  assert.equal(recordHook(s, ev('PermissionRequest', 'Bash')), true, 'a moved flag pushes the row');
  assert.equal(recordHook(s, ev('PermissionRequest', 'Bash')), false, 'an unmoved one does not');
  recordHook(s, ev('Stop'));
  assert.equal(askingByHook(s), false);
  recordHook(s, ev('PermissionRequest', 'Bash'));
  recordHook(s, ev('UserPromptSubmit'));
  assert.equal(askingByHook(s), false);
});

test('a TOML key is added once, in its table, and the rest of the file is kept', () => {
  const owner = 'model = "x"\n\n[notice]\nhide_gpt5_1_migration_prompt = true\n\n[projects."/a"]\ntrust_level = "trusted"\n';
  let text = tomlEnsure(owner, null, 'check_for_update_on_startup', 'false');
  assert.ok(text.startsWith('check_for_update_on_startup = false\nmodel = "x"'));
  text = tomlEnsure(text, 'notice', 'hide_full_access_warning', 'true');
  assert.match(text, /\[notice\]\nhide_full_access_warning = true\nhide_gpt5_1_migration_prompt = true/);
  text = tomlEnsure(text, 'projects."/b"', 'trust_level', '"trusted"');
  assert.ok(text.endsWith('[projects."/b"]\ntrust_level = "trusted"\n'));
  for (const [table, key, value] of [[null, 'check_for_update_on_startup', 'false'], ['notice', 'hide_full_access_warning', 'true'], ['projects."/a"', 'trust_level', '"trusted"'], ['projects."/b"', 'trust_level', '"trusted"']] as const) {
    assert.equal(tomlEnsure(text, table, key, value), text, `${key} already there`);
  }
  assert.equal(tomlEnsure('[projects."/a"]\ntrust_level = "untrusted"\n', 'projects."/a"', 'trust_level', '"trusted"'), '[projects."/a"]\ntrust_level = "untrusted"\n', "the owner's own answer stays");
});

test('Codex is set ahead in its home: trust, no update check, warnings off, hooks trusted', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-ahead-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await writeFile(path.join(home, 'config.toml'), 'model = "x"\n');
  assert.deepEqual(await setAhead('codex', '/work/here', home), []);
  const config = await readFile(path.join(home, 'config.toml'), 'utf8');
  assert.match(config, /^check_for_update_on_startup = false\nmodel = "x"/);
  assert.match(config, /\[projects\."\/work\/here"\]\ntrust_level = "trusted"/);
  assert.match(config, /\[notice\]\n(hide_\w+ = true\n){2}/);
  const hooks = path.join(home, 'hooks.json');
  assert.match(config, new RegExp(`\\[hooks\\.state\\."${hooks.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}:permission_request:0:0"\\]\ntrusted_hash = "sha256:`));
  const declared = JSON.parse(await readFile(hooks, 'utf8')).hooks;
  assert.deepEqual(Object.keys(declared).sort(), ['PermissionRequest', 'PostToolUse', 'PreToolUse', 'Stop', 'UserPromptSubmit']);
  await setAhead('codex', '/work/here', home);
  assert.equal(await readFile(path.join(home, 'config.toml'), 'utf8'), config, 'a second launch changes nothing');
});

test('Claude is set ahead: the folder trusted, the hooks on its argv', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'claude-ahead-'));
  const old = process.env.CLAUDE_CONFIG_DIR; process.env.CLAUDE_CONFIG_DIR = dir;
  t.after(async () => { if (old === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = old; await rm(dir, { recursive: true, force: true }); });
  await writeFile(path.join(dir, '.claude.json'), JSON.stringify({ projects: { '/work/here': { allowedTools: ['x'] } }, theme: 'dark' }));
  const argv = await setAhead('claude', '/work/here', undefined);
  const state = JSON.parse(await readFile(path.join(dir, '.claude.json'), 'utf8'));
  assert.deepEqual(state.projects['/work/here'], { allowedTools: ['x'], hasTrustDialogAccepted: true });
  assert.equal(state.theme, 'dark');
  assert.equal(argv[0], '--settings');
  const hooks = JSON.parse(await readFile(argv[1]!, 'utf8')).hooks;
  for (const event of ['PreToolUse', 'PermissionRequest', 'Notification', 'Elicitation', 'Stop', 'UserPromptSubmit']) {
    assert.equal(hooks[event][0].hooks[0].command, 'ronin-asking', event);
  }
});

test('ronin-asking sends the pane and three fields, prints nothing, exits 0 with or without Ronin', async (t) => {
  const bodies: unknown[] = [];
  const server = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { bodies.push({ url: req.url, body: JSON.parse(b) }); res.end('{"ok":true}'); }); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const port = (server.address() as { port: number }).port;
  const tool = new URL('../ronin_bin/ronin-asking', import.meta.url).pathname;
  const big = 'x'.repeat(200_000);
  const event = JSON.stringify({ session_id: 's', cwd: '/w', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { tool_name: 'Nested', text: big } });
  const run = (url: string) => execFileSync(tool, { input: event, encoding: 'utf8', env: { ...process.env, TMUX_PANE: '%7', RONIN_URL: url } });
  // execFileSync would block the thread the server answers on, so the live call is async.
  const { execFile } = await import('node:child_process');
  const out = await new Promise<string>((resolve, reject) => {
    const child = execFile(tool, { encoding: 'utf8', env: { ...process.env, TMUX_PANE: '%7', RONIN_URL: `http://127.0.0.1:${port}` } }, (e, stdout) => (e ? reject(e) : resolve(stdout)));
    child.stdin!.end(event);
  });
  assert.equal(out, '');
  assert.deepEqual(bodies, [{ url: '/api/asking', body: { pane: '%7', hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', notification_type: '' } }]);
  assert.equal(run('http://127.0.0.1:1'), '', 'no Ronin: nothing said, exit 0');
  assert.ok(existsSync(tool));
});
