// The brief form's project management switch and Jira's scope (public/js/brief-step.js, KAN-608):
// PM is its own switch at every layer, on by default from the Campaign; Jira shows only at the
// Campaign and Workspace, never on a Team or Agent form.
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
  one(cls) { return this.all(cls)[0] || null; }
  get textContent() { return this._text + this.children.map((node) => (typeof node === 'string' ? node : node.tagName === 'WBR' ? '' : node.textContent)).join(''); }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
}
globalThis.Node = FakeNode;
globalThis.HTMLElement = FakeNode; // the kit's createField accepts a control by instanceof
globalThis.document = { createElement: (tag) => new FakeNode(tag), createDocumentFragment: () => new FakeNode('#fragment'), querySelector: () => null, head: { append() {} }, addEventListener() {}, removeEventListener() {} };

const { paintBriefForm } = await import('../public/js/brief-step.js');
const catalog = [{ kind: 'behaviour', name: 'jira-bridge', title: 'Jira', seed: '', depth: 'full', when: ['integration:jira'], mandate: '', value: '' },
  { kind: 'behaviour', name: 'netlify-bridge', title: 'Netlify', seed: '', depth: 'full', when: ['integration:netlify'], mandate: '', value: '' }];
const stone = (host, key) => host.all('ask-stone').find((node) => node.dataset.askKey === key) || null;
const draw = (layer, above = {}, value = undefined) => {
  const host = new FakeNode('div');
  const changes = [];
  paintBriefForm(host, { layer, catalog, above, ...(value ? { value } : {}), onChange: (next) => changes.push(next) });
  return { host, changes };
};
const card = (host, v) => host.all('ask-opt').find((node) => node.dataset.askValue === v) || null;
const optionNames = (host) => host.all('ask-opt').map((node) => node.dataset.v ?? node.dataset.value ?? node.textContent);

test('Jira is offered at the Campaign and Workspace, never on a Team or Agent form', () => {
  const above = { integrations: { jira: 'campaign' }, pm: { on: true, from: 'campaign' } };
  for (const layer of ['campaign', 'workspace']) assert.match(draw(layer, above).host.textContent, /jira/, `${layer} shows Jira`);
  for (const layer of ['team', 'agent']) {
    const { host, changes } = draw(layer, above);
    assert.doesNotMatch(host.textContent, /jira/i, `${layer} never names Jira`);
    assert.match(host.textContent, /netlify/, `${layer} keeps its other integrations`);
    (layer === 'agent' ? card(host, '@pm') : stone(host, 'pm')).click();
    assert.equal((changes.at(-1).brief.integrations_off || []).includes('jira'), false, `${layer} never writes Jira off`);
  }
});

test('project management: on from the Campaign by default; turning it off is this layer’s own, back on follows again', () => {
  const { host, changes } = draw('team', { pm: { on: true, from: 'campaign' } });
  const pm = stone(host, 'pm');
  assert.equal(pm.attributes['aria-checked'], 'true', 'on by default');
  assert.equal(pm.attributes.disabled, undefined, 'never locked by the layer above');
  assert.match(host.textContent, /On, from the Campaign/);
  pm.click();
  assert.equal(changes.at(-1).pm, false, 'off is set on the Team');
  assert.match(host.textContent, /Off here and below/);
  stone(host, 'pm').click();
  assert.equal('pm' in changes.at(-1), false, 'back on: follows the Campaign again');
});

test('project management off above can be turned on below; the Campaign’s own default is on', () => {
  const agent = draw('agent', { pm: { on: false, from: 'workspace' } });
  assert.equal(card(agent.host, '@pm').attributes['aria-selected'], 'false');
  assert.match(agent.host.textContent, /Off, from the Workspace/);
  card(agent.host, '@pm').click();
  assert.equal(agent.changes.at(-1).pm, true);
  const campaign = draw('campaign', {});
  assert.equal(stone(campaign.host, 'pm').attributes['aria-checked'], 'true', 'nothing said: on');
  stone(campaign.host, 'pm').click();
  assert.equal(campaign.changes.at(-1).pm, false, 'the Campaign turns it off deliberately');
});
