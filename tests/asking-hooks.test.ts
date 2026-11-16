/** KAN-616: the CLI's hooks raise and lower the asking flag; launch questions are set ahead. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { askingByHook, createNoProgress, NO_PROGRESS_MS, recordHook } from '../src/asking.js';
import { asksForInput } from '../src/status.js';
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

test('KAN-618: Claude\'s plan approval flags from its hook; approved or not, moving on lowers it', () => {
  const s = 'claude-plan';
  recordHook(s, ev('PreToolUse', 'ExitPlanMode'));
  assert.equal(askingByHook(s), true, 'the plan waits for approval');
  recordHook(s, ev('PostToolUse', 'ExitPlanMode'));
  assert.equal(askingByHook(s), false, 'approved');
  recordHook(s, ev('PreToolUse', 'ExitPlanMode'));
  recordHook(s, ev('UserPromptSubmit'));
  assert.equal(askingByHook(s), false, 'turned down with a note');
});

// The choice lists no hook reports, as each CLI draws them: the numbered list with its selector.
const CHOICE_SCREENS: Record<string, string> = {
  'Codex request_user_input': [
    '  Question 1/1', '  Which database should the service use?', '',
    '› 1. Postgres (Recommended)  Durable, the house default.', '  2. SQLite  One file, no server.',
    '  3. None of the above  Optionally, add details in notes (tab).', '', '  tab to add notes | enter to submit answer | esc to interrupt',
  ].join('\n'),
  'Codex trust menu': ['> You are in /home/u/new', '  Do you trust the contents of this directory?', '',
    '› 1. Yes, continue', '  2. No, quit', '', '  Press enter to continue'].join('\n'),
  'Codex update menu': ['  ✨ Update available! 0.169.0 -> 0.170.0', '', '› 1. Update now', '  2. Skip', '  3. Skip until next version', '', '  Press enter to continue'].join('\n'),
  'Claude plan approval': [' Would you like to proceed?', '', ' ❯ 1. Yes, and auto-accept edits', '   2. Yes, and manually approve edits',
    '   3. No, keep planning', '', ' ctrl-g to edit in Notepad'].join('\n'),
  'Claude trust menu': [' Do you trust the files in this folder?', '', ' ❯ 1. Yes, proceed', '   2. No, exit', '', ' Enter to confirm · Esc to exit'].join('\n'),
};
for (const [name, screen] of Object.entries(CHOICE_SCREENS)) {
  test(`KAN-618: the screen read flags ${name}`, () => assert.equal(asksForInput(screen), true));
}

test('KAN-618: working with no new record for 12 minutes is flagged; new activity clears it; one timer', () => {
  let clock = Date.parse('2026-11-16T22:00:00Z');
  const pushed: string[] = [];
  const timers: Array<{ fire: () => void; ms: number }> = [];
  const quiet = createNoProgress((s) => pushed.push(s), () => clock, (fire, ms) => { const one = { fire, ms }; timers.push(one); return one; });
  const at = new Date(clock).toISOString();
  assert.equal(quiet.check('a', 'working', at), false, 'just wrote');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, NO_PROGRESS_MS, 'due when the record turns 12 minutes old');
  quiet.check('a', 'working', at);
  assert.equal(timers.length, 1, 'the same record arms nothing more');
  clock += NO_PROGRESS_MS;
  timers[0].fire();
  assert.deepEqual(pushed, ['a'], 'the timer only asks for the row again');
  assert.equal(quiet.check('a', 'working', at), true, 'no progress for 12 min');
  clock += 1000;
  assert.equal(quiet.check('a', 'working', new Date(clock).toISOString()), false, 'a new record clears it');
  assert.equal(timers.length, 2, 'and moves the one timer');
  assert.equal(quiet.check('a', 'awaiting_you', at), false, 'a finished turn is never stuck');
  assert.equal(quiet.check('b', 'working', undefined), false, 'nothing read yet: nothing to time');
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

test('Codex is set ahead in its home: trust, no update check, warnings off, hooks without a review', async (t) => {
  const home = await mkdtemp(path.join(tmpdir(), 'codex-ahead-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  await writeFile(path.join(home, 'config.toml'), 'model = "x"\n');
  assert.deepEqual(await setAhead('codex', '/work/here', home), ['--dangerously-bypass-hook-trust']);
  const config = await readFile(path.join(home, 'config.toml'), 'utf8');
  assert.match(config, /^check_for_update_on_startup = false\nmodel = "x"/);
  assert.match(config, /\[projects\."\/work\/here"\]\ntrust_level = "trusted"/);
  assert.match(config, /\[notice\]\n(hide_\w+ = true\n){2}/);
  const hooks = path.join(home, 'hooks.json');
  assert.doesNotMatch(config, /hooks\.state/, "no trust entries in the owner's config");
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
