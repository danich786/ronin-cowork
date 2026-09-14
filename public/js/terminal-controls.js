/* Ronin owns the gesture; the server's CLI registry owns the command. */
import { request } from './request.js';
import { sheet, toast } from './ui.js';
import { S } from './state.js';

const actions = ['copy', 'clear', 'close', 'stop'];
const labels = { copy: 'Copy', clear: 'Clear', close: 'Close', stop: 'Stop' };
const meanings = { copy: 'Select and copy terminal text.', clear: 'Clear unsent input. Never close the session.', close: 'Retire this Agent through confirmation.', stop: 'Interrupt the Agent now; keep its session.' };
let config = null;
let loading = null;
let channel = null;
const preference = (key, value) => {
  try { if (value === undefined) return localStorage.getItem(key); localStorage.setItem(key, value); } catch {}
};
function describeAction(node) {
  if (!config) return;
  const action = node.dataset.terminalAction;
  node.title = `${labels[action]} — ${config.bindings[action]}. ${meanings[action]}`;
  node.setAttribute('aria-keyshortcuts', config.bindings[action].replace('Ctrl', 'Control'));
}
function publish(data) {
  config = data;
  for (const node of document.querySelectorAll('[data-control-key]')) node.textContent = config.bindings[node.dataset.controlKey];
  for (const node of document.querySelectorAll('[data-terminal-action]')) {
    describeAction(node);
  }
}
export function loadTerminalControls() {
  if (!loading) loading = request('/api/terminal-controls').then((r) => { if (r.ok) publish(r.data); return r; }).finally(() => { loading = null; });
  return loading;
}
function initialize() {
  if (!config) void loadTerminalControls();
  if (!channel && typeof window.BroadcastChannel !== 'undefined') {
    channel = new window.BroadcastChannel('ronin-terminal-controls');
    channel.onmessage = () => void loadTerminalControls();
  }
}
export function controlChord(e) {
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.metaKey ? 'Meta+' : ''}${key}`;
}
export function matchedControl(e, bindings) {
  if (e.isComposing || e.altGraphKey || e.getModifierState?.('AltGraph')) return null;
  return actions.find((action) => bindings?.[action] === controlChord(e)) || null;
}
export function installTileControls(tile) {
  initialize();
  tile.el.addEventListener('focusin', (e) => {
    if (e.target === tile.composerTa) tile.inputTarget = 'composer';
    else if (e.target.closest?.('.xterm')) tile.inputTarget = 'terminal';
  });
  tile.el.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const overlay = document.querySelector('.ui-sheet.open .ui-card');
    const drop = document.querySelector('.tdrop.open');
    if (overlay || drop) {
      if (e.key === 'Escape' && !e.isComposing) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (overlay) overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        else drop.classList.remove('open');
      } else if (matchedControl(e, config?.bindings)) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
      return;
    }
    const target = e.target;
    const composer = target === tile.composerTa;
    const terminal = !!target.closest?.('.xterm') || target === tile.body;
    if (!composer && !terminal) return;
    // Native browser clipboard/editing stays native in the Ronin textarea.
    if (composer && (e.ctrlKey || e.metaKey) && ['c', 'x', 'v', 'z', 'y', 'a'].includes(e.key.toLowerCase()) && !e.shiftKey && !e.altKey) return;
    const action = matchedControl(e, config?.bindings);
    if (!action) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) void tile.controlAction(action, composer ? 'composer' : 'terminal');
  }, true);
  const row = document.createElement('div');
  row.className = 'terminal-actions';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Agent controls');
  for (const action of actions) row.append(actionButton(action, () => { tile.activate?.(); return tile.controlAction(action); }));
  tile.el.append(row);
  if (config) publish(config);
}
function actionButton(action, run) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = labels[action];
  button.dataset.terminalAction = action;
  button.setAttribute('aria-label', labels[action]);
  describeAction(button);
  button.addEventListener('pointerdown', (e) => e.preventDefault());
  button.addEventListener('click', () => void run());
  return button;
}
export async function runTerminalAction(tile, action, target) {
  if (action === 'copy') return copyTerminal(tile);
  if (!tile.session) return toast('Choose an Agent first.', false);
  if (action === 'close') return tile.kill();
  if (action === 'clear') {
    target ||= tile.inputTarget;
    const composer = tile.composerTa;
    if (target === 'composer' || (target !== 'terminal' && composer && (document.activeElement === composer || composer.value))) {
      tile.composer.clear();
      return toast('Unsent message cleared');
    }
    if (tile.pending) { tile.pending = ''; tile.renderPending(); return toast('Unsent input cleared'); }
  }
  const session = S.sessions.find((row) => row.name === tile.session);
  const r = await request(`/api/sessions/${encodeURIComponent(tile.session)}/control-action`, { method: 'POST', json: { intent: action, key: tile.sessionKey || session?.key } });
  toast(r.ok ? r.data.message : r.message, r.ok);
}
export function terminalSnapshot(tile) {
  if (tile.tapeMode) return tile.tape?.el?.innerText || tile.body.innerText || '';
  const buffer = tile.term.term.buffer.active;
  const lines = [];
  for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) || '');
  return lines.join('\n').trimEnd();
}
async function writeClipboard(text) {
  if (!navigator.clipboard?.writeText) return false;
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
async function copyTerminal(tile) {
  const native = window.getSelection?.();
  const local = native && tile.el.contains(native.anchorNode) ? native.toString() : '';
  const selected = local || tile.term.getSelection() || tile.lastSelection || '';
  if (selected && await writeClipboard(selected)) return toast('Copied');
  const dlg = sheet({ id: `terminal-copy-${tile.retirementId}`, label: `Copy terminal text — ${tile.session || 'Tile'}`, onClose: () => dlg.el.remove() });
  const text = document.createElement('textarea');
  text.readOnly = true;
  text.className = 'terminal-copy-text';
  text.setAttribute('aria-label', 'Select terminal text to copy');
  text.value = selected || terminalSnapshot(tile);
  const note = document.createElement('p');
  note.textContent = 'Select text below. This snapshot stays still while the Agent continues.';
  const copy = actionButton('copy', async () => {
    const value = text.value.slice(text.selectionStart, text.selectionEnd) || text.value;
    if (await writeClipboard(value)) toast('Copied');
    else { text.focus(); if (text.selectionStart === text.selectionEnd) text.select(); toast('Use your browser’s Copy command on the selected text.'); }
  });
  const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; done.onclick = () => dlg.close();
  dlg.card.append(note, text, copy, done); dlg.open();
}
export function buildControlHints(getTile = () => S.active) {
  initialize();
  const card = document.createElement('details');
  card.className = 'terminal-hints wk-card';
  card.open = preference('ronin.hints.collapsed') !== 'yes';
  const title = document.createElement('summary'); title.textContent = 'Hints';
  card.append(title);
  card.addEventListener('toggle', () => preference('ronin.hints.collapsed', card.open ? 'no' : 'yes'));
  for (const action of actions) {
    const row = document.createElement('div'); row.className = 'terminal-hint-row';
    const button = actionButton(action, () => { const tile = getTile(); if (tile) return tile.controlAction(action); toast('Choose an Agent first.', false); });
    const key = document.createElement('kbd'); key.dataset.controlKey = action; key.textContent = config?.bindings[action] || '…';
    const help = document.createElement('small'); help.textContent = meanings[action];
    row.append(button, key, help); card.append(row);
  }
  const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Customize shortcuts'; edit.onclick = () => void openTerminalControlSettings();
  const help = document.createElement('a'); help.href = '/api/terminal-controls/help'; help.target = '_blank'; help.rel = 'noopener'; help.textContent = 'Help';
  card.append(edit, help);
  return card;
}
export async function openTerminalControlSettings() {
  const r = await loadTerminalControls();
  if (!r.ok) return toast(r.message, false);
  if (document.getElementById('terminal-control-settings')) return;
  const dlg = sheet({ id: 'terminal-control-settings', label: 'Terminal controls', onClose: () => dlg.el.remove() });
  const title = document.createElement('h2'); title.textContent = 'Terminal controls';
  const help = document.createElement('p'); help.textContent = 'One shortcut map for every Ronin browser and Agent. Enter a chord such as Ctrl+X or Escape. Browser text fields keep native Copy, Cut and Undo.';
  const fields = {};
  dlg.card.append(title, help);
  for (const action of actions) {
    const label = document.createElement('label'); label.className = 'terminal-control-field'; label.textContent = labels[action];
    const input = document.createElement('input'); input.value = config.bindings[action]; input.setAttribute('aria-label', `${labels[action]} shortcut`);
    fields[action] = input; label.append(input); dlg.card.append(label);
  }
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Save';
  save.onclick = async () => {
    save.disabled = true;
    const bindings = Object.fromEntries(actions.map((a) => [a, fields[a].value.trim()]));
    // Pad captures at document level; do not leave it silently overriding this map.
    const { padBinds, padChord } = await import('./pad.js');
    for (const chord of Object.values(bindings)) {
      const parts = chord.split('+'); const key = parts.pop();
      const code = /^[A-Z]$/.test(key) ? `Key${key}` : key;
      if (padBinds[padChord({ code, key, ctrlKey: parts.includes('Ctrl'), altKey: parts.includes('Alt'), shiftKey: parts.includes('Shift'), metaKey: parts.includes('Meta') })]) {
        status.textContent = `${chord} is assigned to the pad. Remove that pad binding first.`; save.disabled = false; return;
      }
    }
    const result = await request('/api/terminal-controls', { method: 'PUT', json: { bindings } });
    save.disabled = false;
    if (!result.ok) { status.textContent = result.message; return; }
    publish(result.data); channel?.postMessage('changed'); status.textContent = 'Saved for every Agent. Other devices refresh on focus.';
  };
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset defaults'; reset.onclick = () => { for (const a of actions) fields[a].value = config.defaults[a]; status.textContent = 'Press Save to apply defaults.'; };
  const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; done.onclick = () => dlg.close();
  dlg.card.append(status, save, reset, done); dlg.open();
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('focus', () => { if (config) void loadTerminalControls(); });
