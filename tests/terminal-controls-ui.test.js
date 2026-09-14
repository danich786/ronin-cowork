import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = { matchMedia: () => ({ matches: false }) };
const { matchedControl, controlChord, runTerminalAction } = await import('../public/js/terminal-controls.js');
const { S } = await import('../public/js/state.js');
const key = (key, extra = {}) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...extra });

test('remapping changes the gesture without changing the intent; IME is untouched', () => {
  const bindings = { stop: 'Escape', close: 'Ctrl+X', clear: 'Ctrl+Shift+Backspace', copy: 'Ctrl+Shift+C' };
  assert.equal(matchedControl(key('x', { ctrlKey: true }), bindings), 'close');
  assert.equal(matchedControl(key('c', { ctrlKey: true }), bindings), null);
  assert.equal(matchedControl(key('c', { ctrlKey: true, shiftKey: true }), bindings), null);
  assert.equal(matchedControl(key('Escape', { isComposing: true }), bindings), null);
  assert.equal(matchedControl(key('Escape', { getModifierState: () => true }), bindings), null);
  assert.equal(controlChord(key('Backspace', { ctrlKey: true, shiftKey: true })), 'Ctrl+Shift+Backspace');
});

test('Close uses the retirement boundary even with a draft; it sends no terminal request', async () => {
  let closed = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => assert.fail('Close is not terminal input');
  try { await runTerminalAction({ session: 'a', pending: 'draft', kill: () => closed++ }, 'close'); }
  finally { globalThis.fetch = oldFetch; }
  assert.equal(closed, 1);
});
