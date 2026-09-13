// ask() — the one selector utility (public/js/ask.js · ronin-lab SELECTORS.md).
// Fake-DOM unit floor: the reading stone, the tray, the two shapes, the switch, the blank,
// dependents, the greyed stone with its reason, the filter past twelve, and the snake rule.
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag = '') { this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.listeners = {}; this.attributes = {}; this._text = ''; this.className = ''; }
  append(...nodes) { for (const node of nodes.flat().filter((node) => node != null && node !== '')) { if (node instanceof FakeNode) { node.parent?.children.splice(node.parent.children.indexOf(node), 1); node.parent = this; } this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  fire(name, event = {}) { for (const callback of this.listeners[name] || []) callback({ currentTarget: this, preventDefault() {}, ...event }); }
  click() { this.fire('click'); }
  focus() { this.focused = true; }
  remove() { this.removed = true; if (this.parent) { this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; } }
  *walk() { for (const child of this.children) { if (!(child instanceof FakeNode)) continue; yield child; yield* child.walk(); } }
  all(cls) { return [...this.walk()].filter((node) => node.className.split(' ').includes(cls)); }
  one(cls) { return this.all(cls)[0] || null; }
  get textContent() { return this._text + this.children.map((node) => (typeof node === 'string' ? node : node.tagName === 'WBR' ? '' : node.textContent)).join(''); }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
}
class FakeFragment extends FakeNode { constructor() { super('#fragment'); } }
globalThis.Node = FakeNode;
globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createDocumentFragment: () => new FakeFragment(),
  querySelector: () => null,
  head: { append() {} },
};

const { ask, snake } = await import('../public/js/ask.js');

const PROVIDERS = [
  { v: 'anthropic', l: 'Claude Code' },
  { v: 'openai', l: 'Codex' },
  { v: 'google', l: 'Gemini CLI', off: 'not on this machine' },
];
const MODELS = { anthropic: [{ v: 'opus', l: 'opus', word: 'frontier', sub: '$5 in · $25 out' }, { v: 'sonnet', l: 'sonnet', word: 'standard' }], openai: [{ v: 'gpt-5.6-sol', l: 'gpt-5.6-sol', word: 'frontier' }] };
const REACH = [{ v: 'open', l: 'Open', glyph: '○' }, { v: 'plan', l: 'Plan', glyph: '🗺' }, { v: 'execute', l: 'Execute', glyph: '⚙', sub: 'Does the work.' }];

const build = (extra = {}) => {
  const changes = [];
  const form = ask([
    { group: 'Model', fields: [
      { key: 'provider', label: 'Model provider', blank: 'Default', options: PROVIDERS },
      { key: 'model', label: 'Model', blank: 'Default', after: 'provider', options: (v) => MODELS[v.provider] || [] },
    ] },
    { group: 'Mandate', fields: [
      { key: 'reach', label: 'Reach', shape: 'square', options: REACH },
      { key: 'output', label: 'Output', shape: 'square', many: true, options: ['open', 'code', 'a plan', 'ideas'] },
    ] },
    { group: 'Team', fields: [{ key: 'lead', label: 'Team lead', switch: ['Yes', 'No'] }] },
  ], { value: { reach: 'plan', output: ['open'], ...extra }, onChange: (value, key) => changes.push([key, value]) });
  return { form, changes };
};
const stoneFor = (form, key) => form.el.all('ask-stone').find((node) => node.dataset.askKey === key);
const optNamed = (form, name) => form.el.all('ask-opt').find((node) => node.one('ask-name')?.textContent === name);

test('groups draw their fields as reading stones with the label over the answer', () => {
  const { form } = build();
  assert.equal(form.el.className, 'ask');
  const groups = form.el.all('ask-group');
  assert.deepEqual(groups.map((group) => group.one('ask-group-head').textContent), ['Model', 'Mandate', 'Team']);
  const provider = stoneFor(form, 'provider');
  assert.equal(provider.one('ask-label').textContent, 'Model provider');
  assert.equal(provider.one('ask-reading').textContent, 'Default');
  assert.match(provider.one('ask-reading').className, /ask-blank/);
  assert.equal(stoneFor(form, 'reach').one('ask-reading').textContent, 'Plan');
  assert.equal(provider.attributes['aria-expanded'], 'false');
  assert.equal(form.el.all('ask-tray').length, 0, 'nothing is open at rest');
});

test('a click opens one tray under the field\'s group; a one-of pick answers and closes; the blank is a stone', () => {
  const { form, changes } = build();
  stoneFor(form, 'provider').click();
  assert.equal(form.el.dataset.open, 'provider');
  const trays = form.el.all('ask-tray');
  assert.equal(trays.length, 1);
  assert.equal(form.el.children[1], trays[0], 'the tray sits right after the Model group');
  const names = trays[0].all('ask-opt').map((opt) => opt.one('ask-name').textContent);
  assert.deepEqual(names, ['Default', 'Claude Code', 'Codex', 'Gemini CLI']);
  assert.ok(trays[0].all('ask-opt').every((opt) => opt.className.includes('ask-rect')), 'names are rectangles');
  optNamed(form, 'Claude Code').click();
  assert.equal(form.value().provider, 'anthropic');
  assert.equal(form.el.all('ask-tray').length, 0, 'one-of closes on pick');
  assert.equal(stoneFor(form, 'provider').one('ask-reading').textContent, 'Claude Code');
  assert.deepEqual(changes.at(-1)[0], 'provider');
});

test('a dependent field clears and re-asks its options when its parent changes', () => {
  const { form } = build({ provider: 'anthropic', model: 'sonnet' });
  assert.equal(stoneFor(form, 'model').one('ask-reading').textContent, 'sonnet', 'the reading is the answer alone; the short word lives on the rectangle');
  stoneFor(form, 'provider').click();
  optNamed(form, 'Codex').click();
  assert.equal(form.value().model, '', 'the child answer cleared');
  stoneFor(form, 'model').click();
  assert.deepEqual(form.el.one('ask-tray').all('ask-opt').map((opt) => opt.one('ask-name').textContent), ['Default', 'gpt-5.6-sol']);
});

test('an empty dependent tray says which field to answer first', () => {
  const { form } = build();
  stoneFor(form, 'model').click();
  assert.equal(form.el.one('ask-tray').one('ask-empty').textContent, 'Choose Model provider first.');
});

test('a many field keeps its tray open, ticks stones, and reads names or a count', () => {
  const { form } = build();
  stoneFor(form, 'output').click();
  optNamed(form, 'code').click();
  assert.equal(form.el.all('ask-tray').length, 1, 'many stays open');
  assert.deepEqual(form.value().output, ['open', 'code']);
  assert.equal(stoneFor(form, 'output').one('ask-reading').textContent, 'open, code');
  optNamed(form, 'a plan').click();
  assert.equal(stoneFor(form, 'output').one('ask-reading').textContent, '3 chosen');
  optNamed(form, 'open').click();
  assert.deepEqual(form.value().output, ['code', 'a plan']);
  assert.equal(optNamed(form, 'open').attributes['aria-selected'], 'false');
});

test('a square stone carries a glyph and a ruled word; the caption carries the sentence', () => {
  const { form } = build();
  stoneFor(form, 'reach').click();
  const execute = optNamed(form, 'Execute');
  assert.match(execute.className, /ask-square/);
  assert.equal(execute.one('ask-glyph').textContent, '⚙');
  const tray = form.el.one('ask-tray');
  assert.equal(tray.one('ask-caption').textContent, 'Plan', 'the pressed stone reads in the caption at rest');
  execute.fire('mouseenter');
  assert.equal(tray.one('ask-caption').textContent, 'Execute — Does the work.');
});

test('a greyed stone stays in the tray with its reason, and a click on it says why instead of picking', () => {
  const { form } = build();
  stoneFor(form, 'provider').click();
  const gemini = optNamed(form, 'Gemini CLI');
  assert.equal(gemini.attributes['aria-disabled'], 'true');
  assert.equal(gemini.title, 'not on this machine');
  gemini.click();
  assert.equal(form.value().provider, '');
  assert.equal(form.el.one('ask-caption').textContent, 'Gemini CLI — not on this machine');
});

test('a switch is the reading stone with a track: it flips and opens nothing', () => {
  const { form, changes } = build();
  const lead = stoneFor(form, 'lead');
  assert.equal(lead.attributes.role, 'switch');
  assert.equal(lead.attributes['aria-checked'], 'false');
  assert.equal(lead.one('ask-reading').textContent, 'No');
  assert.ok(lead.one('ask-track'));
  lead.click();
  assert.equal(form.value().lead, true);
  assert.equal(stoneFor(form, 'lead').one('ask-reading').textContent, 'Yes');
  assert.equal(form.el.all('ask-tray').length, 0);
  assert.equal(changes.at(-1)[0], 'lead');
});

test('past twelve options the tray grows a filter line', () => {
  const form = ask([{ group: 'Team', fields: [{ key: 'team', label: 'Team', options: Array.from({ length: 13 }, (_, i) => ({ v: `t${i}`, l: `team_${i}` })) }] }]);
  stoneFor(form, 'team').click();
  const find = form.el.one('ask-filter');
  assert.ok(find, 'thirteen rows bring the filter');
  find.value = 'team_1';
  find.fire('input');
  assert.deepEqual(form.el.one('ask-tray').all('ask-opt').map((opt) => opt.one('ask-name').textContent), ['team_1', 'team_10', 'team_11', 'team_12']);
  const small = ask([{ fields: [{ key: 'reach', label: 'Reach', options: REACH }] }]);
  stoneFor(small, 'reach').click();
  assert.equal(small.el.one('ask-filter'), null, 'three rows bring none');
});

test('the snake rule breaks a name after its joints, never mid-word', () => {
  const frag = snake('gemini-2.5-flash-lite');
  const parts = frag.children.filter((node) => typeof node === 'string');
  assert.deepEqual(parts, ['gemini-', '2.', '5-', 'flash-', 'lite']);
  assert.equal(frag.children.filter((node) => node.tagName === 'WBR').length, 4);
  assert.deepEqual(snake('plain').children, ['plain']);
});

test('set() and options() repaint; Escape closes; a chosen option can draw its own row under the tray', () => {
  const form = ask([{ fields: [
    { key: 'root', label: 'Born in', options: [{ v: 'a', l: 'ronin_cowork' }, { v: 'b', l: 'ronin_services' }] },
    { key: 'repos', label: 'Additional workspaces', many: true, after: 'root', options: (v) => [{ v: 'a', l: 'ronin_cowork' }, { v: 'b', l: 'ronin_services' }].filter((r) => r.v !== v.root), row: (o) => { const input = new FakeNode('input'); input.placeholder = `branch for ${o.l}`; return input; } },
  ] }], { value: { root: 'a', repos: ['b'] } });
  const extra = form.el.one('ask-extra');
  assert.equal(extra.one('ask-extra-name').textContent, 'ronin_services', 'the chosen option\'s own control shows with the tray closed');
  assert.equal(extra.children[1].placeholder, 'branch for ronin_services');
  assert.equal(form.el.all('ask-group')[0].one('ask-extras'), form.el.one('ask-extras'), 'it sits under the group, not in a tray');
  stoneFor(form, 'repos').click();
  assert.equal(form.el.one('ask-tray').one('ask-extras'), null);
  form.el.fire('keydown', { key: 'Escape' });
  assert.equal(form.el.all('ask-tray').length, 0);
  assert.ok(form.el.one('ask-extra'), 'and it is still there after Escape');
  form.set('root', 'b');
  assert.equal(stoneFor(form, 'root').one('ask-reading').textContent, 'ronin_services');
  form.options('root', [{ v: 'c', l: 'notes' }]);
  stoneFor(form, 'root').click();
  assert.deepEqual(form.el.one('ask-tray').all('ask-opt').map((opt) => opt.one('ask-name').textContent), ['notes']);
});

test('density is the caller\'s one word: loose by default, tight for the launch forms', () => {
  assert.equal(build().form.el.dataset.density, 'loose');
  const tight = ask([{ fields: [{ key: 'reach', label: 'Reach', options: REACH }] }], { density: 'tight' });
  assert.equal(tight.el.dataset.density, 'tight');
});

test('set() takes a patch object in one paint, and show() limits which questions are drawn', () => {
  const { form } = build();
  form.set({ provider: 'openai', model: 'gpt-5.6-sol', reach: 'execute', lead: true });
  assert.equal(stoneFor(form, 'provider').one('ask-reading').textContent, 'Codex');
  assert.equal(stoneFor(form, 'model').one('ask-reading').textContent, 'gpt-5.6-sol');
  assert.equal(stoneFor(form, 'lead').attributes['aria-checked'], 'true');
  stoneFor(form, 'reach').click();
  assert.equal(form.el.dataset.open, 'reach');
  form.show(['provider', 'model']);
  assert.deepEqual(form.el.all('ask-group').map((group) => group.one('ask-group-head').textContent), ['Model'], 'groups with nothing shown are not drawn');
  assert.equal(form.el.all('ask-stone').length, 2);
  assert.equal(form.el.dataset.open, '', 'a hidden open field closes');
  assert.equal(form.value().reach, 'execute', 'hidden answers are kept, not cleared');
  form.show(null);
  assert.equal(form.el.all('ask-stone').length, 5);
});

test('a second layer: the parent answer that reveals it keeps the tray open, the nested answer speaks for the parent, other answers clear it', () => {
  const changes = [];
  const teams = [{ v: 'jobber', l: 'jobber' }, { v: 'setup', l: 'setup' }];
  const form = ask([
    { group: 'Team', fields: [
      { key: 'team', label: 'Team', options: [
        { v: 'none', l: 'No team — a rōnin' },
        { v: 'current', l: 'Current team' },
        { v: 'new', l: 'New team', row: () => { const i = new FakeNode('input'); i.placeholder = 'team name'; return i; } },
      ], then: [{ when: 'current', key: 'teamName', label: 'Which team', options: () => teams }] },
      { key: 'lead', label: 'Team lead', switch: ['Yes', 'No'] },
    ] },
    { group: 'Model', fields: [{ key: 'provider', label: 'Model provider', options: PROVIDERS }] },
  ], { value: { team: 'none' }, onChange: (value, key) => changes.push([key, { ...value }]) });
  assert.deepEqual(Object.keys(form.value()).sort(), ['lead', 'provider', 'team', 'teamName'], 'the nested question is a field in the value');
  assert.equal(form.el.all('ask-stone').length, 3, 'but never a stone of its own');
  stoneFor(form, 'team').click();
  assert.equal(form.el.all('ask-layer').length, 0, 'no second layer until its answer is picked');
  optNamed(form, 'Current team').click();
  assert.equal(form.el.dataset.open, 'team', 'the revealing answer keeps the tray open');
  const layer = form.el.one('ask-layer');
  assert.ok(layer, 'and draws the second layer');
  assert.equal(layer.one('ask-layer-head').textContent, 'Which team');
  assert.deepEqual(layer.all('ask-opt').map((o) => o.one('ask-name').textContent), ['jobber', 'setup']);
  assert.equal(stoneFor(form, 'team').one('ask-reading').textContent, 'Current team', 'unanswered, the reading says the parent answer');
  layer.all('ask-opt')[0].click();
  assert.equal(form.el.all('ask-tray').length, 0, 'answering the second layer closes the tray');
  assert.deepEqual([form.value().team, form.value().teamName], ['current', 'jobber']);
  assert.equal(stoneFor(form, 'team').one('ask-reading').textContent, 'jobber', 'the nested answer speaks for the parent');
  assert.equal(changes.at(-1)[0], 'teamName');
  stoneFor(form, 'team').click();
  optNamed(form, 'New team').click();
  assert.equal(form.el.all('ask-tray').length, 0, 'an answer with no second layer closes');
  assert.equal(form.value().teamName, '', 'and the nested answer is cleared');
  assert.equal(form.el.one('ask-extra').children[1].placeholder, 'team name', 'the option\'s own row shows under the group');
  form.set({ team: 'current', teamName: 'setup' });
  assert.equal(stoneFor(form, 'team').one('ask-reading').textContent, 'setup');
  form.show(['provider']);
  assert.equal(form.el.all('ask-stone').length, 1);
  form.show(['team', 'lead']);
  assert.equal(form.el.all('ask-stone').length, 2, 'the nested question follows its parent through show()');
});

test('trayHost: the open tray is placed at the end of the consumer\'s row, not inside the instance, and leaves when it closes', () => {
  const row = new FakeNode('div'); row.className = 'identity-row';
  const name = new FakeNode('div'); name.className = 'name'; row.append(name);
  const form = ask([{ group: 'Team', fields: [{ key: 'team', label: 'Team', options: [{ v: 'none', l: 'No team' }, { v: 'current', l: 'Current team' }], then: [{ when: 'current', key: 'teamName', label: 'Which team', options: [{ v: 'jobber', l: 'jobber' }] }] }] }], { value: { team: 'none' }, trayHost: row });
  row.append(form.el);
  stoneFor(form, 'team').click();
  assert.equal(form.el.all('ask-tray').length, 0, 'not inside the instance');
  assert.equal(row.children.at(-1).className, 'ask-tray', 'at the end of the row');
  assert.equal(row.children.at(-1).dataset.density, 'loose', 'a hosted tray carries the instance\'s density, since it sits outside it');
  row.children.at(-1).all('ask-opt').find((o) => o.one('ask-name').textContent === 'Current team').click();
  assert.equal(row.children.filter((n) => n.className === 'ask-tray').length, 1, 'one tray after a repaint, not two');
  assert.ok(row.children.at(-1).one('ask-layer'), 'the second layer rides in it');
  row.children.at(-1).fire('keydown', { key: 'Escape' });
  assert.equal(row.children.filter((n) => n.className === 'ask-tray').length, 0, 'Escape inside the hosted tray closes it');
  assert.deepEqual(row.children.map((n) => n.className), ['name', 'ask'], 'the row is back to its controls');
});
