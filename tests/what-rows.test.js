import test from 'node:test';
import assert from 'node:assert/strict';

const { whatRows, whatMove, whatStatuses, itemsOnBoardHeldBy } = await import('../public/js/what-rows.js');

// The collection push's shape (src/collection-read.ts).
const reading = {
  teams: [],
  boards: [
    { id: 'w2', title: 'Unfiled', objective: '', stage: 'IDEA', holder: '', teams: [], agents: [], roots: [], stages: [{ stage: 'PLAN', items: [{ id: 'w9', title: 'Loose', stage: 'PLAN', holder: '' }] }] },
    { id: 'w1', title: 'Upgrade', objective: 'o', stage: 'BUILD', holder: 'agent:lead', teams: ['surface'], agents: ['lead', 'items'], roots: ['ronin_cowork'],
      stages: [{ stage: 'IDEA', items: [{ id: 'w10', title: 'Idea', stage: 'IDEA', holder: '' }] }, { stage: 'DONE', items: [{ id: 'w6', title: 'Done one', stage: 'DONE', holder: 'agent:items' }] }] },
  ],
  roots: [],
};

test('What: one stone per board, Unfiled last; at rest under each its items by title, every bar its title alone', () => {
  const rows = whatRows(reading);
  assert.deepEqual(rows.map((row) => [row.id, row.kind, row.label]), [['w1', 'board', 'Upgrade'], ['w2', 'board', 'Unfiled']]);
  assert.deepEqual(rows[0].items.map((row) => [row.id, row.kind, row.label, row.board, row.state]), [['w10', 'item', 'Idea', 'w1', undefined], ['w6', 'item', 'Done one', 'w1', undefined]]);
  assert.deepEqual(rows[1].items.map((row) => row.id), ['w9']);
  assert.ok(!rows.some((row) => row.items.some((bar) => bar.kind === 'status')), 'no status under a stone at rest');
});

test('What: a board pressed into gives its rail the statuses it has items at, in stage order, one row each', () => {
  const statuses = whatStatuses(reading.boards[1], { labels: { stage: (key) => key[0] + key.slice(1).toLowerCase() } });
  assert.deepEqual(statuses.map((row) => [row.id, row.kind, row.label, row.stage, row.board]), [['w1:IDEA', 'status', 'Idea', 'IDEA', 'w1'], ['w1:DONE', 'status', 'Done', 'DONE', 'w1']]);
  assert.deepEqual(whatStatuses(undefined), []);
});

test('What: under each board, the Agents on it instead', () => {
  const rows = whatRows(reading, { under: 'agents' });
  assert.deepEqual(rows[0].items.map((row) => [row.id, row.kind, row.label]), [['agent:w1:lead', 'agent', 'lead'], ['agent:w1:items', 'agent', 'items']]);
  assert.deepEqual(rows[1].items, []);
});

test('What: what a drop means — an item onto another board reparents it; onto its own board, or anything else, nothing', () => {
  const board = { kind: 'board', id: 'w1' };
  assert.equal(whatMove({ kind: 'item', id: 'w9', board: 'w2' }, board), 'reparent');
  assert.equal(whatMove({ kind: 'item', id: 'w10', board: 'w1' }, board), '');
  assert.equal(whatMove({ kind: 'agent', id: 'lead', board: 'w2' }, board), '');
  assert.equal(whatMove({ kind: 'item', id: 'w9', board: 'w2' }, { kind: 'item', id: 'w10' }), '');
  assert.equal(whatMove(null, board), '');
});

test('What: the items on a board an Agent holds; a missing or malformed reading draws no stones', () => {
  assert.deepEqual(itemsOnBoardHeldBy(reading.boards[1], 'items').map((item) => item.id), ['w6']);
  assert.deepEqual(itemsOnBoardHeldBy(undefined, 'items'), []);
  assert.deepEqual(whatRows(undefined), []);
  assert.deepEqual(whatRows({ boards: 'x' }), []);
});
