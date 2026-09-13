// Team Configuration — the commons tab that asks a team's record through ERABI
// (public/js/team-configuration.js · ronin-lab SELECTORS.md). Fake-DOM floor: every
// question is a stone with the right reading, the Features group is never silent, the
// text entries are the kit's, and Save sends the record the server expects.
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
globalThis.document = { createElement: (tag) => new FakeNode(tag), createDocumentFragment: () => new FakeNode('#fragment'), querySelector: () => null, head: { append() {} }, addEventListener() {}, removeEventListener() {} };
globalThis.window = { matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {}, location: { hash: '' } };

const catalog = { origin: 'stock', providers: [
  { provider: 'anthropic', cli: 'claude', label: 'Anthropic', models: [{ model: 'opus', tier: 'frontier', cmd: 'claude --model opus' }] },
  { provider: 'openai', cli: 'codex', label: 'OpenAI', models: [{ model: 'gpt-5.6-sol', tier: 'frontier', cmd: 'codex --model gpt-5.6-sol' }] },
] };
const machine = { measured_at: '2026-09-13T00:00:00.000Z', providers: [
  { id: 'codex', label: 'Codex', from: 'OpenAI', installed: true, signed_in: true, activated: true },
  { id: 'claude', label: 'Claude Code', from: 'Anthropic', installed: false, signed_in: false, activated: false },
] };
const ways = [{ name: 'mandates', label: 'Mandates', blurb: '' }, { name: 'buildout', label: 'Buildout', blurb: 'Write the plan beside the work.' }];
const roots = { roots: [
  { name: 'ronin_cowork', title: 'Ronin Cowork', repo_profile: { worktrees: 'enabled' } },
  { name: 'ronin_services', title: 'Ronin Services', repo_profile: { worktrees: 'disabled' } },
] };
const seedWith = (available) => ({ features: [{ name: 'ronin_host', label: 'Ronin Host' }, { name: 'trello', label: 'Trello' }], behaviours: [], available });

const puts = [];
const serve = (seed) => {
  globalThis.fetch = async (url, init = {}) => {
    const body = url.startsWith('/api/launch-seed') ? seed
      : url.startsWith('/api/ways') ? ways
        : url.startsWith('/api/provider-catalog') ? catalog
          : url.startsWith('/api/setup/runtime') ? machine
            : url.startsWith('/api/project-roots/detail') ? roots
              : url.startsWith('/api/team-rosters/') && init.method === 'PUT' ? (puts.push(JSON.parse(init.body)), { roster: JSON.parse(init.body) })
                : null;
    return { ok: body !== null, status: body ? 200 : 404, headers: { get: () => 'application/json' }, json: async () => body ?? { error: 'no' }, text: async () => JSON.stringify(body) };
  };
};

const roster = {
  durable: true, name: 'jobber', title: 'Jobber', kind: 'coding', objective: 'Polish.',
  project_root: 'ronin_cowork', repos: ['ronin_services'], branches: { ronin_services: 'dev' }, features: ['ronin_host'],
  behaviours: { selected: ['mandates', 'buildout'], required: ['mandates'] },
  agent_defaults: { provider: 'openai', model: 'gpt-5.6-sol', reach: 'plan', recruit: 'propose agents', output: 'open', dial: 'write', launch_mode: 'live_dangerously', permissions: 'retired', note: 'carried' },
};

const { renderTeamConfiguration } = await import('../public/js/team-configuration.js');

const painted = async (host) => {
  for (let i = 0; i < 50 && !host.one('tw-config-form'); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  const form = host.one('tw-config-form');
  assert.ok(form, 'the form painted');
  return form;
};
const stone = (form, key) => form.all('ask-stone').find((node) => node.dataset.askKey === key) || null;
const readingOf = (form, key) => stone(form, key)?.one('ask-reading')?.textContent ?? null;

test('every question is an ERABI stone whose reading is the saved answer', async () => {
  serve(seedWith(['ronin_host']));
  const host = new FakeNode('div');
  renderTeamConfiguration(host, roster);
  const form = await painted(host);
  assert.deepEqual(form.all('ask-stone').map((node) => node.dataset.askKey), [
    'root', 'repos', 'kind', 'ronin_host', 'mandates', 'buildout', 'provider', 'model', 'reach', 'recruit', 'output', 'launch_mode',
  ], 'the stones, in the tab’s order: only the available feature is asked, and no Control stone');
  assert.equal(readingOf(form, 'root'), 'Ronin Cowork', 'Born in reads the Workspace Folder’s title');
  assert.equal(readingOf(form, 'repos'), 'Ronin Services');
  assert.equal(readingOf(form, 'kind'), 'Coding');
  assert.equal(stone(form, 'ronin_host').getAttribute('aria-checked'), 'true', 'a feature is a switch, on when the record lists it');
  assert.equal(readingOf(form, 'mandates'), 'Required', 'a required behaviour reads Required');
  assert.equal(readingOf(form, 'buildout'), 'On');
  assert.equal(readingOf(form, 'provider'), 'OpenAI');
  assert.equal(readingOf(form, 'model'), 'gpt-5.6-sol');
  assert.equal(readingOf(form, 'reach'), 'Plan');
  assert.equal(readingOf(form, 'launch_mode'), 'Dangerously');
});

test('the head is one line, the entries are the kit’s, and nothing else is hand-drawn', async () => {
  serve(seedWith(['ronin_host']));
  const host = new FakeNode('div');
  renderTeamConfiguration(host, roster);
  const form = await painted(host);
  const head = form.one('tw-config-head');
  assert.ok(head, 'the head line exists');
  assert.equal(head.one('tw-config-reading').textContent, 'Team IDjobber');
  assert.ok(head.one('tw-config-field').one('wk-field-control'), 'the title entry wears the kit’s control class');
  const entries = form.all('tw-config-field').map((node) => [node.children[0].textContent, node.children[1].tagName, node.children[1].value]);
  assert.deepEqual(entries, [['Readable title', 'INPUT', 'Jobber'], ['Purpose', 'TEXTAREA', 'Polish.']], 'title and purpose, and no references — that field left the shape');
  for (const node of form.walk()) {
    assert.notEqual(node.tagName, 'SELECT', 'no native select');
    assert.notEqual(node.type, 'checkbox', 'no checkbox');
  }
});

test('the Features group is never silent: with nothing available it says where the switch is', async () => {
  serve(seedWith([]));
  const host = new FakeNode('div');
  renderTeamConfiguration(host, roster);
  const form = await painted(host);
  assert.equal(stone(form, 'ronin_host'), null, 'no feature stone when none is available');
  const group = form.one('tw-config-group');
  assert.ok(group, 'the group still stands');
  assert.equal(group.one('tw-config-group-head').textContent, 'Features');
  assert.match(group.one('tw-config-note').textContent, /No installation on this box offers a feature yet/);
});

test('Save sends the record: features, behaviours by state, agent defaults carried without permissions', async () => {
  serve(seedWith(['ronin_host']));
  puts.length = 0;
  const host = new FakeNode('div');
  let savedRoster = null;
  renderTeamConfiguration(host, roster, { onSaved: (saved) => { savedRoster = saved; } });
  const form = await painted(host);
  await stone(form, 'ronin_host').click(); // switch the feature off
  await form.fire('submit');
  for (let i = 0; i < 50 && !puts.length; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(puts.length, 1, 'one PUT');
  const body = puts[0];
  assert.equal(body.title, 'Jobber');
  assert.equal(body.kind, 'coding');
  assert.equal(body.project_root, 'ronin_cowork');
  assert.deepEqual(body.repos, ['ronin_services']);
  assert.deepEqual(body.branches, { ronin_services: 'dev' }, 'a checkout keeps its branch');
  assert.equal('references' in body, false, 'references is not sent');
  assert.deepEqual(body.features, [], 'the switched-off feature is not listed');
  assert.deepEqual(body.behaviours, { selected: ['mandates', 'buildout'], required: ['mandates'] });
  assert.equal(body.agent_defaults.note, 'carried', 'a key the tab does not draw is carried');
  assert.equal('permissions' in body.agent_defaults, false, 'the retired key is not rewritten');
  assert.equal(body.agent_defaults.model, 'gpt-5.6-sol');
  assert.equal(body.agent_defaults.dial, 'write', 'the retired Control default is written as the one value every Agent starts with');
  assert.deepEqual(body.agent_defaults.output, ['open']);
  assert.ok(savedRoster, 'onSaved received the server’s roster');
  assert.equal(form.one('tw-config-status').textContent, 'Saved');
});
