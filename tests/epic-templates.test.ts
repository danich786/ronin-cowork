/**
 * EPIC TEMPLATES (KAN-557; docs/using-ronin/epic-templates.md): one file per template in
 * epic_templates/, the user's over stock by name; epic-template start makes the epic, its tasks
 * in order and their subtasks through the item functions, held by the Agent, and tells it one line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const root = path.resolve(import.meta.dirname, '..');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-epic-templates-'));
process.env.RONIN_DATA_ROOT = path.join(dir, 'data');
process.env.RONIN_USER_ROOT = path.join(dir, 'user');
process.env.HOME = dir;
delete process.env.RONIN_SOCKET;
delete process.env.TMUX;
process.env.TMUX_TMPDIR = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-epic-templates-tmux-'));
process.env.RONIN_SESSION_DIR = path.join(dir, 'sessions');
process.env.RONIN_WORK_ITEMS_DIR = path.join(dir, 'work-items');
process.env.RONIN_TEAM_ROSTERS_DIR = path.join(dir, 'team_rosters');

// Two live sessions, as a stub tmux answers them; a tool call runs as FAKE_SESSION.
const bin = path.join(dir, 'bin');
await fs.mkdir(bin);
const rows = path.join(bin, 'rows');
const row = (name: string, tags: string, leads: string) => [name, '', '1', '0', '1', tags, leads, name, '', 'camp', '', '0', ''].join('\t');
await fs.writeFile(rows, [row('mika', '', ''), row('mapper', 'crew', '')].join('\n') + '\n');
await fs.writeFile(path.join(bin, 'tmux'), [
  '#!/bin/sh',
  'S=${FAKE_SESSION:-mika}',
  'case "$*" in',
  // Each session its own key, so each holds on its own letter.
  '  *display-message*mapper*) echo "@2";;',
  '  *display-message*) echo "@1";;',
  "  *list-windows*) printf '%s\\t@1\\n' \"$S\";;",
  `  *list-sessions*) cat '${rows}';;`,
  '  *) exit 1;;',
  'esac',
  '',
].join('\n'), { mode: 0o755 });
process.env.PATH = `${bin}:${process.env.PATH ?? ''}`;

const { listTemplates, readTemplate } = await import('../src/epic-templates.js');
const { registerEpicTemplates } = await import('../src/routes/epic-templates-api.js');
const { registerTeams } = await import('../src/routes/teams-api.js');
const { readItem, holdersOf, listItems } = await import('../src/work-items.js');
const { listQueuedMessages } = await import('../src/message-queue.js');
const { seedTegami } = await import('../src/tegami.js');
await seedTegami('mika');
await seedTegami('mapper');

const app = express();
app.use(express.json());
registerEpicTemplates(app);
registerTeams(app);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
test.after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const run = (args: string[], as = 'mika') => new Promise<{ status: number; stdout: string; stderr: string }>((resolve) => {
  execFile(path.join(root, 'ronin_bin', 'epic-template'), args, { encoding: 'utf8', env: { ...process.env, TMUX_PANE: '%1', FAKE_SESSION: as, RONIN_URL: base } }, (error, stdout, stderr) =>
    resolve({ status: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout, stderr }));
});

test('stock: onboarding is the three tasks in order, its Workspace task carrying three subtasks; no item ids', async () => {
  const onboarding = await readTemplate('onboarding');
  assert.equal(onboarding.title, 'Getting set up in your new office');
  assert.deepEqual(onboarding.tasks.map((task) => task.title), [
    'Sign in an Agent harness', 'Create their first Workspace', 'A tour, if they want one',
  ]);
  assert.deepEqual(onboarding.tasks[1]!.subtasks.map((sub) => sub.title), ['Sign in GitHub, if they use it', 'Bring in their folders or repositories', 'Map the project, if they brought one in']);
  assert.match(onboarding.tasks[1]!.subtasks[2]!.objective, /epic-template start import-project --to <agent>/);
  for (const template of await listTemplates()) {
    const all = [template.objective, ...template.tasks.flatMap((task) => [task.objective, ...task.subtasks.map((sub) => sub.objective)])].join('\n');
    assert.doesNotMatch(all, /\b(w[1-9]\d*|KAN-\d+)\b/, `${template.name} names no item id`);
    for (const task of template.tasks) assert.match(task.objective, /^Do: .*\nDetails: .*\nCheck: /s, `${template.name}: ${task.title}`);
  }
  assert.ok((await listTemplates()).some((one) => one.name === 'import-project'));
});

test('a file of the user\'s own adds a template, or replaces stock by name; list prints each in order', async () => {
  const own = path.join(dir, 'user', 'epic_templates');
  await fs.mkdir(own, { recursive: true });
  await fs.writeFile(path.join(own, 'import-project.md'), '# Our way in\n- **for:** our repos\n- **order:** 20\n\nOurs.\n\n## One step\nDo: it.\nDetails: x.\nCheck: y.\n');
  await fs.writeFile(path.join(own, 'launch.md'), '# A launch\n- **for:** a site going live\n- **order:** 15\n\nGo.\n\n## Ship\nDo: ship.\nDetails: `netlify --help`.\nCheck: live.\n');
  const listed = await run(['list']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(listed.stdout.trim().split('\n'), [
    'onboarding  Getting set up in your new office — a person who has just moved into their office',
    'launch  A launch — a site going live (yours)',
    'import-project  Our way in — our repos (yours)',
  ]);
  await fs.rm(path.join(own, 'import-project.md'));
});

test('start makes the epic, tasks in order and subtasks, each held by the Agent, and tells it one line', async () => {
  const own = path.join(dir, 'user', 'epic_templates');
  await fs.mkdir(own, { recursive: true });
  await fs.writeFile(path.join(own, 'stepped.md'), '# Stepped\n- **for:** a test\n- **order:** 90\n\nWalk it.\n\n## First\nDo: a.\nDetails: b.\nCheck: c.\n\n## Second\nDo: a.\nDetails: b.\nCheck: c.\n\n### Its step\nDo: a.\nDetails: b.\nCheck: c.\n');
  const r = await run(['start', 'stepped', '--to', 'mapper', '--workspace', 'shop']);
  await fs.rm(path.join(own, 'stepped.md'));
  assert.equal(r.status, 0, r.stderr);
  const epicId = /^started (\S+) from stepped$/m.exec(r.stdout)![1]!;
  const epic = (await readItem(epicId))!;
  assert.equal(epic.kind, 'Epic');
  assert.match(epic.objective, /\nWorkspace: shop$/);
  const children = (await listItems()).filter((item) => item.parent === epicId);
  assert.deepEqual(children.map((item) => item.title), ['First', 'Second']);
  const subs = (await listItems()).filter((item) => item.parent === children[1]!.id);
  assert.deepEqual(subs.map((item) => [item.title, item.level]), [['Its step', -1]]);
  for (const id of [epicId, ...children.map((item) => item.id), subs[0]!.id]) assert.deepEqual(await holdersOf(id), [{ kind: 'agent', name: 'mapper' }], id);
  const told = (await listQueuedMessages()).filter((one) => one.target === 'mapper');
  assert.equal(told.length, 1);
  assert.equal(told[0]!.text, `Walk this epic through: ${epicId} 'Stepped', in the Workspace shop. Read it (\`item read ${epicId}\`); its tasks are its children.`);
  assert.equal(told[0]!.when, 'ready');
});

test('start with no --to is the caller\'s own, untold; an unknown template or --new is refused', async () => {
  const mine = await run(['start', 'launch'], 'mika');
  assert.equal(mine.status, 0, mine.stderr);
  const epicId = /^started (\S+)/.exec(mine.stdout)![1]!;
  assert.deepEqual(await holdersOf(epicId), [{ kind: 'agent', name: 'mika' }]);
  assert.equal((await listQueuedMessages()).filter((one) => one.target === 'mika').length, 0);
  const missing = await run(['start', 'nope']);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /No epic template "nope"; epic-template list shows them\./);
  const gone = await run(['start', 'launch', '--new', 'b']);
  assert.equal(gone.status, 2);
});
