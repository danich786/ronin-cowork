import test from 'node:test';
import assert from 'node:assert/strict';

// The Team's Work line: one segment per status column, filled up to the item's status, the
// current segment marked (flagged when flagged), and the holder after it.
const node = (tag) => ({ tag, className: '', textContent: '', title: '', dataset: {}, children: [],
  setAttribute(name, value) { this[name] = value; }, append(...kids) { this.children.push(...kids); } });
globalThis.document = { createElement: node };
globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {} };
const { itemLine, PROJECT_STAGES } = await import('../public/js/team-kanban.js');

test('a work item line fills the bar to its status and marks a flag', () => {
  const line = itemLine({ id: 'surface/8', title: 'Teams collection', status: 'BUILD', flagged: true, holder: 'agent:surface_teams' }, { holder: 'surface_teams' });
  const [title, holder, bar] = line.children;
  assert.equal(title.textContent, 'Teams collection');
  assert.deepEqual(bar.children.map((segment) => segment.className), ['past', 'past', 'now flagged', '', '', '']);
  assert.equal(bar.children.length, PROJECT_STAGES.length);
  assert.equal(holder.textContent, '@surface_teams');
  const done = itemLine({ id: 'x', title: 'x', status: 'DONE', holder: '' });
  assert.equal(done.children[2].children.at(-1).className, 'now');
  assert.equal(done.children[1].textContent, '', 'no holder, no name');
});
