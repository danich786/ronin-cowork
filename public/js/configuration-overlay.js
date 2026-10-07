/* part of the ronin-cowork client — see js/README.md */
/**
 * CONFIGURATION — the one way a tenant's configuration opens (PATTERNS.md rows "Board
 * configuration", "Workspace configuration", "Team configuration"; owner, 2026-10-07): an
 * item on the workspace header's メ (js/menu.js) opens the full overlay (work-details.js)
 * over that surface, holding Grey form rows that each save themselves (js/save-row.js is the
 * commit; the row is drawn here as Machine settings draws its own). Nothing here has a look
 * of its own: the menu, the overlay, the field and the question are their owners'.
 */
import { fullOverlay } from './work-details.js';
import { saveRow } from './save-row.js';
import { field } from './ui.js';
import { ask } from './ask.js';
import { t } from './lexicon.js';

const el = (tag, cls = '', text = '') => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text) out.textContent = text;
  return out;
};

/** A text row's control: `{ label, value, save(value), after(result), kind: 'text' | 'long', note? }`. */
const control = (row) => {
  const input = row.kind === 'long' ? el('textarea') : el('input');
  if (row.kind !== 'long') input.type = 'text';
  else input.rows = 3;
  input.spellcheck = false;
  input.value = row.value ?? '';
  return input;
};

/** The menu group a configured surface hands over: one item that opens its configuration. */
export function configurationGroup(open, { label = t('workspace.tab_team_configuration', 'Configuration'), foot = [] } = {}) {
  return [{ items: [{ glyph: '⚙', label, run: open }] }, ...(foot.length ? [{ foot: true, items: foot }] : [])];
}

/** A text row: the kit's labelled field with its status line; the commit runs on change. */
const textRow = (row) => {
  const input = control(row);
  const labelled = field(input, { label: row.label, sr: false });
  labelled.el.classList.add('st-field');
  if (row.note) labelled.say(row.note);
  const line = el('div', 'st-row');
  line.append(labelled.el);
  const commit = saveRow({ say: (state, message) => labelled.say(message, state === 'invalid'), save: row.save, after: row.after });
  input.addEventListener('change', () => void commit(input.value));
  return line;
};

/** A question row: `{ label, fields, value, save(value), after }` is one ask() group with a
 *  status line under it; the question's change is the commit. */
const questionRow = (row) => {
  let commit = () => {};
  const question = ask([{ group: row.label, fields: row.fields }], { value: row.value || {}, density: 'tight', onChange: (value) => void commit(value) });
  const note = el('p', 'st-note', row.note || '');
  note.setAttribute('role', 'status');
  const line = el('div', 'st-row');
  line.append(question.el, note);
  commit = saveRow({ say: (state, message) => { note.textContent = message; note.classList.toggle('bad', state === 'invalid'); }, save: row.save, after: row.after });
  return line;
};

/** Open the configuration of the surface `surfaceEl` heads: a head with the title and the
 *  overlay's Close, then one Grey form row per field. `rows` are read when it opens. */
export function openConfiguration(surfaceEl, { title, rows }) {
  const host = surfaceEl.querySelector(':scope > .wk-surface-content');
  host.querySelector(':scope > .work-overlay')?.remove();
  return fullOverlay(host, (layer, through) => {
    const head = el('div', 'league-team-detail-head');
    const tools = el('div', 'wk-surface-header-actions');
    tools.append(...through.flatMap((item) => (item?.el ? [item.el] : item instanceof Node ? [item] : [])));
    head.append(el('h2', '', title), tools);
    const form = el('div', 'tw-config cfg-rows');
    for (const row of rows()) form.append(row.fields ? questionRow(row) : textRow(row));
    layer.append(head, form);
  });
}
