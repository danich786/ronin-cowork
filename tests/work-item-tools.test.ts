/**
 * `item …` against the real /api/work-items routes (WORK_ITEM_BUILDOUT cut 3): each act
 * names its item and leaves exactly one trail line; no tool refuses a caller for not being
 * the holder; the old `team item` and `work-record item` families are gone.
 *
 * The routes run in this process on a free port (RONIN_URL). The tools see a fake tmux
 * answering for a session called "probe"; this process sees no tmux server at all, so its
 * session key for "probe" is "probe" too, and both find the same letter.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const root = path.resolve(import.meta.dirname, '..');
const dir = mkdtempSync(path.join(tmpdir(), 'work-item-tools-'));
// Every store under private roots: holder scans and arrival notices never reach live ones.
process.env.RONIN_DATA_ROOT = path.join(dir, 'data');
process.env.RONIN_USER_ROOT = path.join(dir, 'user');
delete process.env.RONIN_SOCKET;
delete process.env.TMUX;
process.env.TMUX_TMPDIR = mkdtempSync(path.join(tmpdir(), 'work-item-tools-tmux-'));
process.env.RONIN_SESSION_DIR = path.join(dir, 'sessions');
process.env.RONIN_WORK_ITEMS_DIR = path.join(dir, 'work-items');
process.env.RONIN_TEAM_ROSTERS_DIR = path.join(dir, 'team_rosters');

const { registerWorkItems } = await import('../src/routes/work-items-api.js');
const { createTeamRoster } = await import('../src/team-rosters.js');
const { readLetterHolds, seedTegami } = await import('../src/tegami.js');
const { readItem } = await import('../src/work-items.js');

await createTeamRoster('crew', { objective: 'hold things' });
await seedTegami('probe');
const app = express();
app.use(express.json());
registerWorkItems(app);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
test.after(() => server.close());

const bin = path.join(dir, 'bin');
mkdirSync(bin);
// FAKE_SESSION names the session this tool call runs in; "probe" unless a test says so.
writeFileSync(path.join(bin, 'tmux'), [
  '#!/bin/sh',
  'S=${FAKE_SESSION:-probe}',
  'case "$1" in',
  '  display-message) echo "@1";;',
  "  list-windows) printf '%s\\t@1\\n' \"$S\";;",
  "  list-sessions) case \"$*\" in *ronin-key*) printf '%s\\t%s\\t1\\n' \"$S\" \"$S\";; *) printf '%s\\t\\n' \"$S\";; esac;;",
  '  *) exit 1;;',
  'esac',
  '',
].join('\n'), { mode: 0o755 });
const env: NodeJS.ProcessEnv = {
  ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}`, TMUX_PANE: '%1',
  RONIN_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
};
// Async on purpose: the routes answer from this same process, so a sync call would block them.
const run = (name: string, args: string[], as = 'probe', input?: string) => new Promise<{ status: number; stdout: string; stderr: string }>((resolve) => {
  const child = execFile(path.join(root, 'ronin_bin', name), args, { encoding: 'utf8', env: { ...env, FAKE_SESSION: as } }, (error, stdout, stderr) =>
    resolve({ status: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout, stderr }));
  child.stdin?.end(input ?? '');
});
const tool = async (name: string, args: string[], as = 'probe', input?: string) => {
  const r = await run(name, args, as, input);
  assert.equal(r.status, 0, `${name} ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const trail = async (id: string) => (await readItem(id))!.trail;

/** Run one tool call and prove it appended exactly one line, returning that line. */
async function oneLine(id: string, args: string[], as = 'probe') {
  const before = (await trail(id)).length;
  const out = await tool('item', args, as);
  const after = await trail(id);
  assert.equal(after.length, before + 1, `item ${args.join(' ')} appended ${after.length - before} lines`);
  assert.match(out, new RegExp(`Keep it current: item write ${id} `), 'the acknowledgement nags');
  return after.at(-1)!;
}
const made = (out: string) => /Work item (w\d+)/.exec(out)![1]!;

test('item acts, each naming its item, one trail line each', async () => {
  const epic = made(await tool('item', ['create', '--title', 'Overall', '--level', '1']));
  assert.deepEqual([(await readItem(epic))!.level, (await trail(epic)).map((line) => [line.op, line.to])], [1, [['create', 'none']]]);
  const id = made(await tool('item', ['create', '--title', 'Piece', '--objective', 'part', '--parent', epic, '--kind', 'task']));
  assert.match(await tool('item', ['read', id]), /"level": 0/);

  assert.equal((await oneLine(id, ['assign', id, 'probe'])).to, 'agent:probe');
  assert.deepEqual((await readLetterHolds('probe'))!.holds, [id]);
  assert.equal((await oneLine(id, ['assign', id, 'team:crew'])).to, 'team:crew');
  assert.equal((await oneLine(id, ['assign', id, 'none'])).op, 'release');
  assert.equal((await oneLine(id, ['write', id, '--status', 'DONE'])).to, 'DONE');
  const flagged = await oneLine(id, ['write', id, '--flagged', 'true', '--jira', 'RON-7']);
  assert.deepEqual([flagged.op, (await readItem(id))!.flagged, (await readItem(id))!.external.jira], ['edit', true, 'RON-7']);
  assert.equal((await oneLine(id, ['evidence', id, 'commit abc123'])).note, 'commit abc123');
  assert.equal((await oneLine(id, ['plan', id, '--phase', 'p', '--leg', '1', 'x', '--leg', '1', 'y', '--done', '1.1', '--active', '1.2'])).op, 'edit');
  assert.deepEqual((await readItem(id))!.ladder[0]!.legs, [{ title: 'x', status: 'DONE' }, { title: 'y', status: 'ACTIVE' }]);
  const doc = path.join(dir, 'plan.md');
  writeFileSync(doc, '# plan\n');
  await oneLine(id, ['doc', id, 'add', doc]);
  assert.deepEqual((await readItem(id))!.docs, [doc]);
  const missing = await run('item', ['doc', id, 'add', path.join(dir, 'nope.md')]);
  assert.match(missing.stderr, /no such file/);

  const sub = made(await tool('item', ['create', '--title', 'Sub', '--parent', id]));
  assert.equal((await readItem(sub))!.level, -1);
  const children = JSON.parse(await tool('item', ['read', id])).children as Array<{ id: string }>;
  assert.deepEqual(children.map((child) => child.id), [sub]);
  const stuck = await run('item', ['move', id, '--to', 'none']);
  assert.deepEqual([stuck.status, stuck.stderr.trim()], [4, `${id} has subtasks and can't move.`]);
  const loose = made(await tool('item', ['create', '--title', 'Loose']));
  const moved = await oneLine(loose, ['move', loose, '--to', epic]);
  assert.deepEqual([moved.op, moved.to, (await readItem(loose))!.level], ['move', epic, 0]);

  const listed = JSON.parse(await tool('item', ['list', '--parent', epic])) as { items: Array<{ id: string }> };
  assert.deepEqual(listed.items.map((item) => item.id).sort(), [id, loose].sort());
  const roots = JSON.parse(await tool('item', ['list', '--no-parent'])) as { items: Array<{ parent: string | null }> };
  assert.ok(roots.items.length && roots.items.every((item) => item.parent === null));
});

test('focus picks which held item the work record shows; held by someone else, it says so', async () => {
  const a = made(await tool('item', ['create', '--title', 'A'], 'duo'));
  const b = made(await tool('item', ['create', '--title', 'B'], 'duo'));
  await seedTegami('duo');
  await tool('item', ['assign', a, 'duo'], 'duo');
  await tool('item', ['assign', b, 'duo'], 'duo');
  assert.match(await tool('item', ['focus', b], 'duo'), new RegExp(`now shows ${b}`));
  assert.equal((await readLetterHolds('duo'))!.at?.item, b);
  const other = made(await tool('item', ['create', '--title', 'Not mine'], 'duo'));
  assert.match(await tool('item', ['focus', other], 'duo'), /not held by @duo/);
  assert.equal((await readLetterHolds('duo'))!.at?.item, b);
});

test('the old families are gone: no team item, no work-record item, no editing through focus', async () => {
  assert.notEqual((await run('team', ['item', 'read', 'w1'])).status, 0);
  assert.notEqual((await run('work-record', ['item', 'read', 'w1'])).status, 0);
  assert.notEqual((await run('work-record', ['document', 'add', path.join(dir, 'plan.md')])).status, 0);
  const ladder = await run('work-record', ['update_record', '--phase', 'p']);
  assert.notEqual(ladder.status, 0);
  assert.match(ladder.stderr, /item plan <id>/);
});

test('an id no route can hold answers "No work item <id>", and a reply that is not JSON names its HTTP status', async () => {
  for (const args of [['read', 'surface/7'], ['write', 'surface/7', '--status', 'DONE']]) {
    const r = await run('item', args);
    assert.equal(r.status, 3, `item ${args.join(' ')}`);
    assert.equal(r.stderr.trim(), 'No work item surface/7.');
  }
  const { createServer } = await import('node:http');
  const html = createServer((_req, res) => { res.writeHead(502, { 'content-type': 'text/html' }); res.end('<html>bad gateway</html>'); });
  await new Promise<void>((resolve) => html.listen(0, '127.0.0.1', resolve));
  try {
    const r = await new Promise<{ status: number; stderr: string }>((resolve) => {
      execFile(path.join(root, 'ronin_bin', 'item'), ['read', 'w1'], {
        encoding: 'utf8', env: { ...env, RONIN_URL: `http://127.0.0.1:${(html.address() as AddressInfo).port}` },
      }, (error, _stdout, stderr) => resolve({ status: error ? Number((error as { code?: number }).code ?? 1) : 0, stderr }));
    });
    assert.equal(r.status, 3);
    assert.equal(r.stderr.trim(), 'HTTP 502: Ronin answered GET /api/work-items/w1 without JSON');
  } finally {
    html.close();
  }
});
