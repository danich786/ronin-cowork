/** KAN-616, KAN-656..658: the CLI's hooks set the Agent's status and its question; launch questions are set ahead. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { answered, answerKeys, createNoProgress, hookRecordOf, NO_PROGRESS_MS, parseHookEvent, type HookRecord } from '../src/asking.js';
import { asksForInput } from '../src/status.js';
import { setAhead, tomlEnsure } from '../src/launch-ahead.js';

const AT = '2026-11-18T12:00:00.000Z';
/** Walk events through the record as the server does; each step's record. */
async function walk(events: Record<string, unknown>[]) {
  const out: (HookRecord | null)[] = [];
  let was: HookRecord | undefined;
  for (const e of events) { const next = await hookRecordOf(e, was, AT); out.push(next); if (next) was = next; }
  return out;
}
const CHOICE = { questions: [{ question: 'Which colour?', header: 'Colour', multiSelect: false, options: [{ label: 'Red', description: 'r' }, { label: 'Green', description: 'g' }] }] };

test('KAN-656: the hooks set status: a prompt works, a tool names itself, the stop awaits you', async () => {
  const [prompt, tool, done, stop, failed, codexStop] = await walk([
    { hook_event_name: 'UserPromptSubmit', prompt: 'x' },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test\nsecond line', description: 'tests' } },
    { hook_event_name: 'PostToolUse', tool_name: 'Bash' },
    { hook_event_name: 'Stop' },
    { hook_event_name: 'StopFailure', error: 'rate_limit' },
    { hook_event_name: 'Interrupt', turn_id: 't' },
  ]);
  assert.deepEqual(prompt, { stance: 'working', at: AT }, 'thinking is working, from the prompt on');
  assert.deepEqual(tool, { stance: 'working', at: AT, tool: { name: 'Bash', target: 'npm test' } }, 'name and target only');
  assert.equal(done?.stance, 'working');
  assert.equal(stop?.stance, 'awaiting_you');
  assert.equal(failed?.stance, 'error');
  assert.equal(codexStop?.stance, 'interrupted');
  assert.equal(await hookRecordOf({ hook_event_name: 'Notification', notification_type: 'idle_prompt' }, undefined, AT), null, 'an idle notice changes nothing');
});

test('KAN-657: each question rides the record whole, and goes when the CLI moves on', async () => {
  const [ask, leave, , moved] = await walk([
    { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: CHOICE },
    { hook_event_name: 'PermissionRequest', tool_name: 'AskUserQuestion', tool_input: CHOICE },
    { hook_event_name: 'Notification', notification_type: 'permission_prompt' },
    { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion' },
  ]);
  const choice = { kind: 'choice', questions: [{ question: 'Which colour?', header: 'Colour', many: false, options: [{ label: 'Red', description: 'r' }, { label: 'Green', description: 'g' }] }] };
  assert.deepEqual(ask, { stance: 'asking', at: AT, question: choice });
  assert.deepEqual(leave?.question, choice, "Claude's leave for its own question is the same question");
  assert.deepEqual(moved, { stance: 'working', at: AT }, 'answered: the question goes');
  const codex = await hookRecordOf({ hook_event_name: 'PreToolUse', tool_name: 'request_user_input', tool_input: { questions: [{ id: 'c', header: 'C', question: 'Which?', options: [{ label: 'A', description: '' }] }] } }, undefined, AT);
  assert.equal(codex?.question?.kind, 'choice', "Codex's question is the same shape");
  const plan = await hookRecordOf({ hook_event_name: 'PreToolUse', tool_name: 'ExitPlanMode', tool_input: { plan: '1. Do it' } }, undefined, AT);
  assert.deepEqual(plan?.question, { kind: 'plan', plan: '1. Do it' });
  const permission = await hookRecordOf({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'touch x', description: 'Make x' } }, undefined, AT);
  assert.deepEqual(permission?.question, { kind: 'permission', tool: 'Bash', detail: 'touch x', reason: 'Make x' });
  const form = await hookRecordOf({ hook_event_name: 'Elicitation', message: 'Your token?' }, undefined, AT);
  assert.deepEqual(form?.question, { kind: 'form', message: 'Your token?' });
});

test("KAN-657: Codex's proposed plan is read from its rollout on Stop", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'codex-plan-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const rollout = path.join(dir, 'rollout.jsonl');
  const said = (text: string) => JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } });
  await writeFile(rollout, `${said('earlier')}\n${said('<proposed_plan>\n1. Create it\n</proposed_plan>')}\n`);
  const stop = await hookRecordOf({ hook_event_name: 'Stop', turn_id: 't', transcript_path: rollout }, undefined, AT);
  assert.deepEqual(stop, { stance: 'asking', at: AT, question: { kind: 'plan', plan: '1. Create it' } });
  await writeFile(rollout, `${said('<proposed_plan>\nold\n</proposed_plan>')}\n${said('Done.')}\n`);
  assert.equal((await hookRecordOf({ hook_event_name: 'Stop', turn_id: 't', transcript_path: rollout }, undefined, AT))?.stance, 'awaiting_you', 'only the last message counts');
});

test('KAN-658: an answer is the keys each CLI\'s own prompt takes (tried on Claude 2.1.327, Codex 0.169)', () => {
  const one = { kind: 'choice' as const, questions: [{ question: 'q', header: '', many: false, options: [{ label: 'a', description: '' }, { label: 'b', description: '' }] }] };
  const many = { kind: 'choice' as const, questions: [one.questions[0], { ...one.questions[0], many: true }] };
  assert.deepEqual(answerKeys('claude', one, { choices: [1] }), ['2']);
  assert.deepEqual(answerKeys('claude', many, { choices: [0, [0, 1]] }), ['1', '1', '2', 'Tab', '1'], 'checkboxes, then the review submits');
  assert.deepEqual(answerKeys('codex', { ...one, questions: [one.questions[0], one.questions[0]] }, { choices: [1, 0] }), ['2', '1'], 'Codex submits on the last');
  assert.deepEqual(answerKeys('claude', { kind: 'plan', plan: '' }, { yes: false }), ['Escape']);
  assert.deepEqual(answerKeys('codex', { kind: 'plan', plan: '' }, { yes: false }), ['3'], 'stay in Plan mode');
  assert.deepEqual(answerKeys('codex', { kind: 'permission', tool: 'Bash', detail: '', reason: '' }, { yes: true }), ['y']);
  assert.equal(answerKeys('claude', one, { choices: [5] }), null, 'no such option');
  assert.equal(answerKeys('claude', { kind: 'form', message: '' }, { yes: true }), null, 'free text is the terminal\'s');
  assert.equal(answerKeys('grok', one, { choices: [0] }), null, 'a CLI without hooks');
  assert.equal(answered({ yes: false }).stance, 'awaiting_you', 'a decline fires no hook: Ronin says so');
});

test('a relay event cut short still says what it was', () => {
  assert.deepEqual(parseHookEvent('{"hook_event_name":"PostToolUse","tool_name":"Read","tool_response":"xxxx'), { hook_event_name: 'PostToolUse', tool_name: 'Read' });
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
  assert.equal(quiet.check('c', 'working', 'line-1'), false, 'only a record time counts, not any string Date.parse takes');
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
  assert.deepEqual(Object.keys(declared).sort(), ['Interrupt', 'PermissionRequest', 'PostToolUse', 'PreToolUse', 'SessionStart', 'Stop', 'UserPromptSubmit']);
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

test('ronin-asking sends the pane and the whole event, cut at 128 KB, prints nothing, exits 0 with or without Ronin', async (t) => {
  const bodies: { url?: string; body: string }[] = [];
  const server = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { bodies.push({ url: req.url, body: b }); res.end('{"ok":true}'); }); });
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
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].url, '/api/asking?pane=%257');
  assert.equal(bodies[0].body, event.slice(0, 131072), 'the event, cut');
  assert.equal(parseHookEvent(bodies[0].body).tool_name, 'AskUserQuestion');
  assert.equal(run('http://127.0.0.1:1'), '', 'no Ronin: nothing said, exit 0');
  assert.ok(existsSync(tool));
});
