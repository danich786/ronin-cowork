/* part of the ronin-cowork client — see js/README.md */
/**
 * CONFIGURATION — the one way a tenant's configuration opens (PATTERNS.md rows "Board
 * configuration", "Workspace configuration", "Team configuration"; owner, 2026-10-07): an
 * item on the workspace header's メ (js/menu.js) opens the full overlay (work-details.js)
 * over that surface, holding Grey form rows that each save themselves (js/save-row.js).
 * Nothing here has a look of its own: the menu, the overlay and the rows are their owners'.
 */
import { fullOverlay } from './work-details.js';
import { saveRow } from './save-row.js';
import { field } from './ui.js';
import { t } from './lexicon.js';

const el = (tag, cls = '', text = '') => {
  const out = document.createElement(tag);
  if (cls) out.className = cls;
  if (text) out.textContent = text;
  return out;
};

/** A text row: `{ label, value, save(value), kind: 'text' | 'long', note? }`. */
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

/** Open the configuration of the surface `surfaceEl` heads: a head with the title and the
 *  overlay's Close, then one Grey form row per field. `rows` are read when it opens. */
export function openConfiguration(surfaceEl, { title, rows }) {
  const host = surfaceEl.querySelector(':scope > .wk-surface-content') || surfaceEl;
  host.querySelector(':scope > .work-overlay')?.remove();
  return fullOverlay(host, (layer, through) => {
    const head = el('div', 'league-team-detail-head');
    const tools = el('div', 'wk-surface-header-actions');
    tools.append(...through.flatMap((item) => (item?.el ? [item.el] : item instanceof Node ? [item] : [])));
    head.append(el('h2', '', title), tools);
    const form = el('div', 'tw-config cfg-rows');
    // Each row is drawn here, as Machine settings draws its own: the kit's labelled field with
    // its status line; saveRow is the commit, run when the control changes.
    for (const row of rows()) {
      const input = control(row);
      const labelled = field(input, { label: row.label, sr: false });
      labelled.el.classList.add('st-field');
      if (row.note) labelled.say(row.note);
      const line = el('div', 'st-row');
      line.append(labelled.el);
      const commit = saveRow({ say: (state, message) => labelled.say(message, state === 'invalid'), save: row.save, after: row.after });
      input.addEventListener('change', () => void commit(input.value));
      form.append(line);
    }
    layer.append(head, form);
  });
}
