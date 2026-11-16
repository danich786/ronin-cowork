// The New Agent form's Behaviors step (paintBriefForm, layer 'agent'; KAN-609): one list of
// cards, each on or off — Project management, each integration by name (never Jira), the
// optional behaviours. What is saved is unchanged: { brief, integrations, pm }.
import test from 'node:test';
import assert from 'node:assert/strict';

class FakeList { constructor() { this.set = new Set(); } add(...c) { c.forEach((x) => this.set.add(x)); } remove(...c) { c.forEach((x) => this.set.delete(x)); } contains(c) { return this.set.has(c); } toggle(c, on) { if (on ?? !this.set.has(c)) this.set.add(c); else this.set.delete(c); } }
class FakeNode {
  constructor(tag = '') { this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.listeners = {}; this.attributes = {}; this._text = ''; this.className = ''; this.classList = new FakeList(); this.value = ''; }
  append(...nodes) { for (const node of nodes.flat().filter((node) => node != null && node !== '')) { if (node instanceof FakeNode) { node.parent?.children.splice(node.parent.children.indexOf(node), 1); node.parent = this; } this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  async fire(name, event = {}) { for (const callback of this.listeners[name] || []) await callback({ currentTarget: this, target: this, preventDefault() {}, ...event }); }
  click() { return this.fire('click'); }
  focus() { this.focused = true; }
  contains(node) { return node === this || [...this.walk()].includes(node); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; } }
  *walk() { for (const child of this.children) { if (!(child instanceof FakeNode)) continue; yield child; yield* child.walk(); } }
  all(cls) { return [...this.walk()].filter((node) => `${node.className} ${[...node.classList.set].join(' ')}`.split(' ').includes(cls)); }
  get textContent() { return this._text + this.children.map((node) => (typeof node === 'string' ? node : node.tagName === 'WBR' ? '' : node.textContent)).join(''); }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
}
globalThis.Node = FakeNode;
globalThis.HTMLElement = FakeNode;
globalThis.document = { createElement: (tag) => new FakeNode(tag), createDocumentFragment: () => new FakeNode('#fragment'), querySelector: () => null, head: { append() {} }, addEventListener() {}, removeEventListener() {} };

const { paintBriefForm } = await import('../public/js/brief-step.js');
const catalog = [
  { kind: 'behaviour', name: 'jira-bridge', title: 'Jira', depth: 'full', when: ['integration:jira'] },
  { kind: 'behaviour', name: 'netlify-bridge', title: 'Netlify', depth: 'full', when: ['integration:netlify'] },
  { kind: 'behaviour', name: 'stripe-bridge', title: 'Stripe', depth: 'full', when: ['integration:stripe'] },
  { kind: 'behaviour', name: 'team-work', title: 'Team work', depth: 'none' },
  { kind: 'behaviour', name: 'more-checkpoints', title: 'More checkpoints', depth: 'none' },
];
const above = { integrations: { jira: 'campaign', netlify: 'workspace' }, off: { stripe: 'team' }, pm: { on: true, from: 'campaign' } };
const draw = (value) => {
  const host = new FakeNode('div');
  const changes = [];
  paintBriefForm(host, { layer: 'agent', catalog, above, ...(value ? { value } : {}), onChange: (next) => changes.push(next), openBehaviours: () => {} });
  return { host, changes };
};
const cards = (host) => host.all('ask-opt');
const card = (host, v) => cards(host).find((node) => node.dataset.askValue === v);
const word = (node) => node.all('ask-word')[0]?.textContent || '';

test('one list of cards: Project management, each integration but Jira, the optional behaviours', () => {
  const { host } = draw();
  assert.equal(host.children.filter((node) => node.className === 'na-behaviour-section').length, 2, 'the cards, then Comes with this Agent');
  assert.deepEqual(cards(host).map((node) => node.dataset.askValue),
    ['@pm', 'integration:netlify', 'integration:stripe', 'add:team-work', 'add:more-checkpoints', '@customize']);
  assert.doesNotMatch(host.textContent, /jira/i);
  for (const gone of [/Integrations/, /Optional/, /Set on/, /Work items/, /No work items/]) assert.doesNotMatch(host.textContent, gone);
  assert.equal(host.all('brief-pm-row').length, 0);
  assert.equal(host.all('brief-set-on').length, 0);
});

test('a card on from above says where; the rest read On or Off', () => {
  const { host } = draw();
  assert.equal(word(card(host, '@pm')), 'On, from the Campaign');
  assert.equal(word(card(host, 'integration:netlify')), 'On, from the Workspace');
  assert.equal(word(card(host, 'integration:stripe')), 'Off, from the Team');
  assert.equal(card(host, 'integration:stripe').attributes['aria-disabled'], 'true');
  assert.equal(word(card(host, 'add:team-work')), 'Off');
});

test('turning cards on and off saves the same { brief, integrations, pm } as before', async () => {
  const { host, changes } = draw();
  await card(host, '@pm').click();
  assert.equal(changes.at(-1).pm, false, 'off for this Agent');
  await card(host, 'integration:netlify').click();
  assert.deepEqual(changes.at(-1).brief.integrations_off, ['netlify'], 'an inherited one turned off for this Agent alone');
  await card(host, 'add:team-work').click();
  const last = changes.at(-1);
  assert.deepEqual(last.brief.add, [{ name: 'team-work', depth: 'full' }]);
  assert.deepEqual(last.integrations, []);
  assert.deepEqual(Object.keys(last).sort(), ['brief', 'integrations', 'pm']);
  await card(host, '@pm').click();
  assert.equal('pm' in changes.at(-1), false, 'back on: follows the Campaign again');
});

test('a saved value paints as it was, depth kept', () => {
  const { host, changes } = draw({ brief: { add: [{ name: 'more-checkpoints', depth: 'seed' }], block: [], only: [], integrations_off: ['netlify'] }, integrations: [], pm: false });
  assert.equal(card(host, '@pm').attributes['aria-selected'], 'false');
  assert.equal(word(card(host, '@pm')), 'Off');
  assert.equal(card(host, 'integration:netlify').attributes['aria-selected'], 'false');
  assert.equal(card(host, 'add:more-checkpoints').attributes['aria-selected'], 'true');
  assert.equal(word(card(host, 'add:more-checkpoints')), 'On · Seed');
  assert.equal(changes.length, 0);
});
