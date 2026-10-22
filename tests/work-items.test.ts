/**
 * THE WORK ITEM STORE — one item, stored once, every change a trail line.
 * Checks from WORK_ITEM_STORE.md cut 1 and WORK_ITEM_BUILDOUT.md (the Jira shape): a write
 * reads back; concurrent trail appends all land; level defaults one below the parent; a move
 * that changes the level of an item with children, or goes under a subtask, is refused; an old file reads in the new
 * shape; the one migration; the routes answer with the item as it now is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-work-items-'));
// Every store under private roots, whoever runs this file: holder scans and arrival
// notices must never reach a live roster, letter or message queue.
const isolated = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-isolated-'));
process.env.RONIN_DATA_ROOT = path.join(isolated, 'data');
process.env.RONIN_USER_ROOT = path.join(isolated, 'user');
delete process.env.RONIN_SOCKET;
process.env.RONIN_WORK_ITEMS_DIR = temp;

const items = await import('../src/work-items.js');
const { registerWorkItems } = await import('../src/routes/work-items-api.js');

test('no parent is normal: level 0, kind blank, nothing made to hold it', async () => {
  const first = await items.createItem({ title: 'First' }, 'probe');
  assert.deepEqual([first.item.parent, first.item.level, first.item.kind, first.item.status, first.item.flagged], [null, 0, undefined, 'IDEA', false]);
  assert.deepEqual((await items.listItems()).map((item) => item.id), [first.item.id], 'one create, one item');
});

test('level defaults one below the parent and adding a child never changes it', async () => {
  const epic = (await items.createItem({ title: 'Epic', level: 1 }, 'probe')).item;
  const story = (await items.createItem({ title: 'Story', parent: epic.id, kind: 'story' }, 'probe')).item;
  const sub = (await items.createItem({ title: 'Sub', parent: story.id }, 'probe')).item;
  assert.deepEqual([epic.level, story.level, sub.level], [1, 0, -1]);
  assert.equal((await items.readItem(story.id))!.level, 0, 'a story with a subtask is still level 0');
  const leaf = (await items.createItem({ title: 'Leaf' }, 'probe')).item;
  await items.createItem({ title: 'Under the leaf', parent: leaf.id }, 'probe');
  assert.equal((await items.readItem(leaf.id))!.level, 0);
});

test('the ladder stays on an item when it gains a child (the fold into the first child is gone)', async () => {
  const epic = (await items.createItem({ title: 'Planned epic', level: 1 }, 'probe')).item;
  await items.writePlan(epic.id, { edits: [['phase', 'Design'], ['leg', '1', 'Sketch']] }, 'probe');
  const child = (await items.createItem({ title: 'First child', parent: epic.id }, 'probe')).item;
  assert.deepEqual((await items.readItem(epic.id))!.ladder, [{ phase: 'Design', status: 'PLANNED', legs: [{ title: 'Sketch', status: 'PLANNED' }] }]);
  assert.deepEqual((await items.readItem(child.id))!.ladder, []);
  const other = (await items.createItem({ title: 'Moved in' }, 'probe')).item;
  await items.moveItem(other.id, epic.id, 'probe');
  assert.equal((await items.readItem(epic.id))!.ladder.length, 1, 'a move under it keeps it too');
});

test('kind is a label: story, task, bug or blank; the answer says only what the act changed', async () => {
  const bug = await items.createItem({ title: 'Crash', kind: 'bug' }, 'probe');
  assert.equal(items.didLine(bug), `${bug.item.id} was created`);
  assert.equal(items.didLine(await items.editItem(bug.item.id, { kind: 'story', flagged: true }, 'probe')), `${bug.item.id} changed: kind story, flagged`);
  assert.equal(items.didLine(await items.editItem(bug.item.id, { status: 'BUILD' }, 'probe')), `${bug.item.id} moved to BUILD`);
  assert.equal((await items.editItem(bug.item.id, { kind: '' }, 'probe')).item.kind, undefined);
  await assert.rejects(items.createItem({ title: 'Odd', kind: 'epic' }, 'probe'), /kind must be one of story, task, bug/);
});

test('create → read round-trips the whole shape, with one create line', async () => {
  const { item, line } = await items.createItem({ title: 'Store', objective: 'Keep items once.' }, 'probe');
  assert.match(item.id, /^w[1-9][0-9]*$/);
  assert.deepEqual(item.external, {});
  assert.equal(line.op, 'create');
  assert.equal(line.by, 'probe');
  assert.deepEqual(await items.readItem(item.id), item);
  const onDisk = JSON.parse(await fs.readFile(path.join(temp, `${item.id}.json`), 'utf8'));
  assert.deepEqual(onDisk, item, 'one JSON file per item, trail inside it');
  assert.equal('stage' in onDisk || 'exit' in onDisk, false);
});

test('an old file reads in the new shape and is written in it on its next write', async () => {
  const id = 'w9000';
  await fs.writeFile(path.join(temp, `${id}.json`), JSON.stringify({
    id, title: 'Old', objective: '', stage: 'BUILD', exit: 'lead', status: 'red', kind: 'task', parent: null,
    ladder: [], docs: [], external: {}, trail: [], created: { at: '2026-10-01T00:00:00Z', by: 'old' },
  }));
  const read = (await items.readItem(id))!;
  assert.deepEqual([read.status, read.flagged, read.level, read.kind, 'exit' in read, 'stage' in read], ['BUILD', true, 0, 'task', false, false]);
  await items.editItem(id, { objective: 'now' }, 'probe');
  const onDisk = JSON.parse(await fs.readFile(path.join(temp, `${id}.json`), 'utf8'));
  assert.deepEqual([onDisk.status, onDisk.flagged, 'stage' in onDisk, 'exit' in onDisk], ['BUILD', true, false, false]);
  await fs.unlink(path.join(temp, `${id}.json`));
});

test('one global issuer: concurrent creates never share an id', async () => {
  const made = await Promise.all(Array.from({ length: 12 }, (_, i) => items.createItem({ title: `t${i}` }, 'probe')));
  assert.equal(new Set(made.map(({ item }) => item.id)).size, 12);
});

test('trail append is atomic under concurrent writers: every line lands', async () => {
  const { item } = await items.createItem({ title: 'Busy' }, 'probe');
  await Promise.all(Array.from({ length: 25 }, (_, i) => items.addEvidence(item.id, `fact ${i}`, `writer${i}`)));
  const back = (await items.readItem(item.id))!;
  assert.equal(back.trail.filter((line) => line.op === 'evidence').length, 25);
  assert.equal(new Set(back.trail.map((line) => line.note)).size, 26);
});

test('each write appends exactly one line; external is writable', async () => {
  const { item } = await items.createItem({ title: 'Edits' }, 'probe');
  assert.deepEqual([(await items.editItem(item.id, { status: 'BUILD' }, 'a')).line.op], ['status']);
  const jira = await items.editItem(item.id, { external: { jira: 'RON-12' } }, 'a');
  assert.deepEqual(jira.item.external, { jira: 'RON-12' });
  assert.equal((await items.editItem(item.id, { title: 'Edited', objective: 'o' }, 'a')).line.op, 'edit');
  assert.deepEqual((await items.readItem(item.id))!.trail.map((line) => line.op), ['create', 'status', 'edit', 'edit']);
  assert.throws(() => items.editItem(item.id, { status: 'SHIPPED' }, 'a'), /status must be one of IDEA, PLAN, BUILD, REVIEW, LAND, DONE/);
});

test('a move sets parent and level together; a level change with children, or a place under a subtask, is refused', async () => {
  const a = (await items.createItem({ title: 'A', level: 1 }, 'p')).item;
  const b = (await items.createItem({ title: 'B', parent: a.id }, 'p')).item;
  const c = (await items.createItem({ title: 'C', parent: b.id }, 'p')).item;
  const other = (await items.createItem({ title: 'Other epic', level: 1 }, 'p')).item;
  const story = await items.moveItem(b.id, other.id, 'p');
  assert.deepEqual([story.item.parent, story.item.level, (await items.readItem(c.id))!.parent], [other.id, 0, b.id], 'a story moves to another epic, its subtasks with it');
  assert.equal((await items.moveItem(a.id, null, 'p')).item.level, 1, 'no parent keeps the level: an epic stays an epic');
  const story2 = (await items.createItem({ title: 'Story', parent: a.id }, 'p')).item;
  await assert.rejects(items.moveItem(b.id, story2.id, 'p'), { message: `${b.id} has children and can't move.` });
  assert.equal((await items.readItem(b.id))!.parent, other.id, 'a refusal writes nothing');
  await assert.rejects(items.createItem({ title: 'Under a subtask', parent: c.id }, 'p'), { message: `${c.id} is a subtask and can't have children.` });
  const loose = (await items.createItem({ title: 'Loose' }, 'p')).item;
  await assert.rejects(items.moveItem(loose.id, c.id, 'p'), { message: `${c.id} is a subtask and can't have children.` });
  const moved = await items.moveItem(loose.id, a.id, 'p');
  assert.deepEqual([moved.item.parent, moved.item.level, moved.line.op], [a.id, 0, 'move']);
  const back = await items.moveItem(loose.id, null, 'p');
  assert.deepEqual([back.item.parent, back.item.level], [null, 0]);
});

test('the one migration: stage → status, red → flagged, exit gone, levels from children, Unfiled gone', async () => {
  const store = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-migrate-'));
  const old = (id: string, fields: Record<string, unknown>) => fs.writeFile(path.join(store, `${id}.json`), JSON.stringify({
    id, title: id, objective: '', stage: 'IDEA', exit: 'none', status: 'yellow', parent: null, ladder: [], docs: [], external: {}, trail: [], created: { at: '', by: '' }, ...fields,
  }));
  await old('w1', { title: 'Unfiled' });
  await old('w2', { parent: 'w1', stage: 'BUILD', status: 'red', kind: 'bug' });
  await old('w3', { stage: 'PLAN' });
  await old('w4', { parent: 'w3', status: 'green', exit: 'lead' });
  process.env.RONIN_WORK_ITEMS_DIR = store;
  try {
    const done = await items.migrateItems('probe');
    assert.deepEqual([done.before, done.after, done.removed, done.migrated], [4, 3, ['w1'], ['w2', 'w3', 'w4']]);
    const [w2, w3, w4] = await Promise.all(['w2', 'w3', 'w4'].map(async (id) => JSON.parse(await fs.readFile(path.join(store, `${id}.json`), 'utf8'))));
    assert.deepEqual([w2.parent, w2.status, w2.flagged, w2.level, w2.kind, 'exit' in w2, 'stage' in w2], [null, 'BUILD', true, 0, 'bug', false, false]);
    assert.deepEqual([w3.level, w3.status], [1, 'PLAN']);
    assert.deepEqual([w4.level, w4.flagged, w4.parent], [0, false, 'w3']);
    assert.deepEqual((await items.migrateItems('probe')).migrated, [], 'a second run changes nothing');
  } finally {
    process.env.RONIN_WORK_ITEMS_DIR = temp;
  }
});

test('routes acknowledge with the item and the appended line; refusals answer 409', async () => {
  const app = express();
  app.use(express.json());
  registerWorkItems(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/work-items`;
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: await res.json() as Record<string, any> };
  };
  try {
    const made = await call('POST', base, { title: 'Routed', objective: 'o', kind: 'task', by: 'probe' });
    assert.equal(made.status, 200);
    const id = made.data.item.id as string;
    assert.equal(made.data.acknowledgement, `${id} was created`);
    const moved = await call('PUT', `${base}/${id}`, { status: 'PLAN', flagged: 'true', jira: 'RON-1', by: 'probe' });
    assert.deepEqual([moved.data.item.status, moved.data.item.flagged, moved.data.item.external.jira], ['PLAN', true, 'RON-1']);
    const child = await call('POST', base, { title: 'Child', parent: id, by: 'probe' });
    assert.equal(child.data.item.level, -1);
    assert.deepEqual((await call('GET', `${base}/${id}`)).data.children.map((item: { id: string }) => item.id), [child.data.item.id]);
    const peer = await call('POST', base, { title: 'Peer', by: 'probe' });
    const stuck = await call('POST', `${base}/${id}/move`, { parent: peer.data.item.id, by: 'probe' });
    assert.deepEqual([stuck.status, stuck.data.error], [409, `${id} has children and can't move.`]);
    const plan = await call('POST', `${base}/${id}/plan`, { edits: [['phase', 'One']], by: 'probe' });
    assert.equal(plan.data.item.ladder[0].phase, 'One');
    assert.equal((await call('POST', `${base}/${id}/evidence`, { text: 'a fact', by: 'probe' })).data.line.op, 'evidence');
    assert.ok((await call('GET', `${base}?no_parent=1`)).data.items.some((item: { id: string }) => item.id === id));
    assert.ok((await call('GET', `${base}?parent=${id}`)).data.items.every((item: { parent: string }) => item.parent === id));
    assert.equal((await call('GET', `${base}/w999999`)).status, 404);
    assert.equal((await call('PUT', `${base}/${id}`, { status: 'nope' })).status, 400);
  } finally {
    server.close();
  }
});
