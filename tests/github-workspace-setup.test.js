import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag = '') { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.hidden = false; this.removed = false; this.value = ''; }
  append(...nodes) { this.children.push(...nodes.filter(Boolean)); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  querySelectorAll(selector) { return [...this.walk()].filter((node) => selector === '[data-sws-id]' && node.dataset.swsId); }
  querySelector(selector) { return [...this.walk()].find((node) => selector === '.sws-state' && node.className === 'sws-state') || null; }
  *walk() { for (const child of this.children) { if (!(child instanceof FakeNode)) continue; yield child; yield* child.walk(); } }
  click() { for (const callback of this.listeners.click || []) callback({ currentTarget: this }); }
}

globalThis.Node = FakeNode;
globalThis.document = { createElement: (tag) => new FakeNode(tag), createTextNode: (text) => Object.assign(new FakeNode('#text'), { textContent: text }) };


const { createGithubWorkspaceSetup } = await import('../public/js/github-workspace-setup.js');
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('connected GitHub can re-check, change accounts without closing early, and sign out the shown login', async () => {
  const calls = [];
  let github = { installed: true, authenticated: true, account: 'octo-cat', attachment: null };
  let poll;
  let finishes = 0;
  let resolveCheck;
  let hold = false;
  globalThis.window = { setInterval: (fn) => { poll = fn; return 1; }, clearInterval: () => {} };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (hold && url === '/api/setup/github') await new Promise((resolve) => { resolveCheck = resolve; });
    if (url.endsWith('/login')) github = { ...github, attachment: { type: 'session', key: 'setup_github' } };
    if (url.endsWith('/close')) github = { ...github, attachment: null };
    if (url.endsWith('/logout')) github = { installed: true, authenticated: false, account: '', attachment: null };
    return { ok: true, status: 200, json: async () => ({ ...github }) };
  };
  const surface = createGithubWorkspaceSetup({
    environment: { mountProviderSetupSession: () => ({ park() {}, destroy() {} }) },
    onAuthenticated: () => { finishes++; },
  });
  const host = new FakeNode('div');
  surface.items[0].renderDetail(host);
  await settle();
  const button = (label) => [...host.walk()].find((n) => n.tagName === 'BUTTON' && n.textContent === label);
  assert.ok(button('Change account'));
  assert.equal(button('Sign out').hidden, false);
  hold = true;
  button('Re-check connection').click();
  assert.equal(button('Checking…').disabled, true);
  resolveCheck(); hold = false;
  await settle();
  assert.equal(button('Re-check connection').disabled, false);
  button('Change account').click();
  await settle();
  poll(); await settle();
  assert.equal(finishes, 0, 'the existing account must not end a new login attempt');
  assert.equal(calls.some((c) => c.url.endsWith('/close')), false);
  github = { ...github, account: 'new-cat' };
  poll(); await settle();
  assert.equal(finishes, 1);
  assert.equal(surface.items[0].state, 'Connected · new-cat');
  button('Sign out').click(); await settle();
  const logout = calls.find((c) => c.url.endsWith('/logout'));
  assert.deepEqual(JSON.parse(logout.options.body), { account: 'new-cat' });
  assert.equal(button('Sign out').hidden, true);
  assert.ok(button('Connect GitHub'));
  assert.ok(button('Check connection'));
  assert.equal(surface.items[1].disabled, true);
  surface.destroy(); await settle();
});
