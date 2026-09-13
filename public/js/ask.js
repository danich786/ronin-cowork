/* part of the ronin-cowork client — see js/README.md */
/**
 * ERABI — how a form asks a question. THE ONE SELECTOR UTILITY (ronin-lab SELECTORS.md,
 * owner's ruling 2026-09-12). A consumer writes a spec; this module draws it. Nothing spatial
 * is the consumer's: not the width, not the wrapping, not the shape, not what opens.
 *
 *   ask([{ group, fields: [{ key, label, options, blank?, many?, switch?, shape?, after?, row?, word?, then? }] }],
 *       { value, onChange, density })  →  { el, value(), set(key, v) | set({...}), options(key, rows), show(keys|null), open(key), close(), destroy() }
 *
 * A field is a READING STONE (140 × 48: label over answer). Click it and a TRAY opens under
 * its group, holding option stones in one of two fixed shapes — the SQUARE (85, a glyph and
 * a ruled word) or the RECTANGLE (140 × 48, a name and one short word). A stone carries a
 * name, never a sentence: the CAPTION line under the tray carries the sentence, the facts,
 * and the reason a stone is greyed. A SWITCH is the reading stone with a track; it flips and
 * opens nothing. GROUPS keep together and stack as a group. Names break at their joints.
 *
 * An option row is `{ v, l, sub?, off?, glyph?, word? }`: `sub` reads in the caption, `off`
 * is the reason the stone is greyed (disabled, never hidden), `glyph` sits on a square,
 * `word` is the rectangle's short second line (tier, worktree, checkout). `after` names the
 * field this one depends on: when that one changes, this answer clears and its options are
 * asked again. `row(option, value)` draws a control that belongs to a chosen option — a branch
 * name, a new team's name — under the group's stones, open or closed, so an answer's own field
 * never vanishes with the tray. `show([...keys])` limits which fields are drawn (a session type
 * decides which questions exist); `show(null)` draws them all. `then` is A SECOND LAYER: a
 * list of nested questions, each with `when` naming the parent answer that reveals it —
 * `then: [{ when: 'current', key: 'teamName', label: 'Which team', options: () => teamRows() }]`.
 * Picking `current` keeps the tray open and draws the nested question's stones beneath the
 * first layer; answering it closes the tray, and the reading says the nested answer. Any other
 * parent answer clears the nested one. A nested question is a field like any other in `value()`,
 * `set()` and `onChange`, but it is never a stone of its own in the group. `density: 'tight'` is the launch
 * forms' setting — less line spacing inside a group, the same paragraph spacing between groups,
 * a 40 px stone — for questions that are optional and must not be in the owner's face; 'loose'
 * (the default) is the commons' setting where a question is the page's subject.
 */
import { t } from './lexicon.js';

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = String(text);
  return node;
};

/** THE SNAKE RULE: a name breaks after its joints — `_` `-` `.` — never mid-word. */
export function snake(text) {
  const frag = document.createDocumentFragment();
  const parts = String(text ?? '').split(/(?<=[_\-.])/);
  parts.forEach((part, index) => {
    frag.append(part);
    if (index < parts.length - 1) frag.append(document.createElement('wbr'));
  });
  return frag;
}

const FILTER_FROM = 12;
let trayIds = 0;

export function ask(groups = [], { value = {}, onChange = null, className = '', density = 'loose' } = {}) {
  const spec = (Array.isArray(groups) ? groups : []).map((group) => ({
    label: group.group || group.label || '',
    fields: (group.fields || []).map((field) => ({ ...field, shape: field.shape === 'square' ? 'square' : 'rect' })),
  }));
  const nested = (field) => (Array.isArray(field.then) ? field.then : []).map((child) => ({ ...child, parent: field.key, when: child.when, shape: child.shape === 'square' ? 'square' : 'rect' }));
  const fields = spec.flatMap((group) => [...group.fields.flatMap((field) => [field, ...nested(field)])]);
  const childrenOf = (field) => fields.filter((child) => child.parent === field.key);
  const activeChild = (field) => childrenOf(field).find((child) => String(child.when) === String(state[field.key])) || null;
  const answered = (field) => (field.many ? state[field.key].length > 0 : state[field.key] !== '' && state[field.key] != null);
  const byKey = (key) => fields.find((field) => field.key === key) || null;
  const state = {};
  for (const field of fields) state[field.key] = field.switch ? Boolean(value[field.key]) : field.many ? [...(value[field.key] || [])] : (value[field.key] ?? '');
  let open = '';
  let filter = '';
  let outside = null;
  let shown = null;
  const visible = (field) => !shown || shown.has(field.key) || (field.parent != null && shown.has(field.parent));

  const root = el('section', `ask ${className}`.trim());
  root.dataset.density = density === 'tight' ? 'tight' : 'loose';
  const trayId = `ask-tray-${++trayIds}`;

  const rowsOf = (field) => {
    const rows = typeof field.options === 'function' ? field.options(snapshot()) : field.options;
    return (Array.isArray(rows) ? rows : []).map((row) => (typeof row === 'string' ? { v: row, l: row } : row)).filter((row) => row && row.v != null);
  };
  const rowFor = (field, v) => rowsOf(field).find((row) => String(row.v) === String(v)) || null;
  const snapshot = () => {
    const out = {};
    for (const field of fields) out[field.key] = field.many ? [...state[field.key]] : state[field.key];
    return out;
  };

  const clear = (field) => { state[field.key] = field.switch ? false : field.many ? [] : ''; };
  const changed = (key) => {
    for (const field of fields) {
      if (field.after === key || (field.parent === key && String(field.when) !== String(state[key]))) {
        if (!answered(field)) continue;
        clear(field);
        changed(field.key);
      }
    }
    onChange?.(snapshot(), key);
  };
  const choose = (field, row) => {
    if (field.many) {
      const cur = state[field.key];
      state[field.key] = cur.includes(row.v) ? cur.filter((v) => v !== row.v) : [...cur, row.v];
    } else {
      state[field.key] = row.v;
      const reveals = childrenOf(field).some((child) => String(child.when) === String(row.v));
      if (!reveals) open = '';
    }
    changed(field.key);
    paint();
  };

  /* ---- the reading: what the closed stone says ---- */
  const reading = (field) => {
    const cur = state[field.key];
    const b = el('b', 'ask-reading');
    if (field.switch) { b.textContent = field.switch[cur ? 0 : 1]; if (field.word) b.append(el('i', 'ask-fact', field.word)); return b; }
    if (field.many) {
      if (!cur.length) { b.className += ' ask-blank'; b.textContent = t('ask.none', 'None'); }
      else if (cur.length <= 2) b.textContent = cur.map((v) => rowFor(field, v)?.l ?? v).join(', ');
      else b.textContent = t('ask.chosen', '{n} chosen', { n: cur.length });
      return b;
    }
    if (cur === '' || cur == null) { b.className += ' ask-blank'; b.textContent = field.blank ?? t('ask.none', 'None'); return b; }
    const child = activeChild(field);
    if (child && answered(child)) return reading(child);
    // The reading is the answer and nothing else; a row's short word lives on its rectangle.
    b.textContent = rowFor(field, cur)?.l ?? cur;
    return b;
  };

  const stone = (field) => {
    const button = el('button', 'ask-stone');
    button.type = 'button';
    button.dataset.askKey = field.key;
    if (field.switch) {
      const on = Boolean(state[field.key]);
      button.className += ' ask-switch';
      button.setAttribute('role', 'switch');
      button.setAttribute('aria-checked', String(on));
      const words = el('span', 'ask-words');
      words.append(el('small', 'ask-label', field.label), reading(field));
      button.append(words, el('span', 'ask-track'));
      button.addEventListener('click', () => { state[field.key] = !state[field.key]; changed(field.key); paint(); });
      return button;
    }
    button.setAttribute('aria-expanded', String(open === field.key));
    button.setAttribute('aria-controls', trayId);
    button.append(el('small', 'ask-label', field.label), reading(field));
    button.addEventListener('click', () => { open = open === field.key ? '' : field.key; filter = ''; paint(); });
    return button;
  };

  /* ---- the tray: the option stones, the caption, the rows ---- */
  const tray = (field) => {
    const box = el('div', 'ask-tray');
    box.id = trayId;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', field.label);
    const all = rowsOf(field);
    const caption = el('p', 'ask-caption');
    const say = (row) => {
      caption.replaceChildren();
      if (!row) return;
      caption.append(el('b', null, row.l));
      const rest = row.off || row.sub || '';
      if (rest) caption.append(` — ${rest}`);
    };
    // One layer of stones for one question; the second layer, when revealed, is the same thing again.
    const child = activeChild(field);
    const target = child && rowsOf(child).length > FILTER_FROM ? child : all.length > FILTER_FROM ? field : null;
    const layerOf = (f) => {
      const options = el('div', 'ask-options');
      options.setAttribute('role', 'listbox');
      if (f.many) options.setAttribute('aria-multiselectable', 'true');
      const rows = f === field ? all : rowsOf(f);
      const fill = () => {
        options.replaceChildren();
        if (!rows.length) {
          const parent = f.after ? byKey(f.after) : null;
          options.append(el('span', 'ask-empty', parent ? t('ask.after', 'Choose {field} first.', { field: parent.label }) : t('ask.nothing', 'Nothing to choose.')));
          return;
        }
        const shown = rows.filter((row) => f !== target || !filter || `${row.l} ${row.sub || ''} ${row.word || ''}`.toLowerCase().includes(filter));
        const items = [...(!f.many && f.blank != null ? [{ v: '', l: f.blank, blank: true }] : []), ...shown];
        for (const row of items) {
          const opt = el('button', `ask-opt ask-${f.shape}`);
          opt.type = 'button';
          opt.setAttribute('role', 'option');
          const on = f.many ? state[f.key].includes(row.v) : String(state[f.key]) === String(row.v);
          opt.setAttribute('aria-selected', String(on));
          if (row.off) { opt.setAttribute('aria-disabled', 'true'); opt.title = row.off; }
          if (f.shape === 'square') opt.append(el('i', 'ask-glyph', row.glyph || (row.blank ? '○' : '·')));
          const name = el('b', 'ask-name');
          name.append(snake(row.l));
          opt.append(name);
          if (f.shape === 'rect' && row.word) opt.append(el('small', 'ask-word', row.word));
          opt.addEventListener('mouseenter', () => say(row));
          opt.addEventListener('focus', () => say(row));
          opt.addEventListener('click', () => { if (row.off) { say(row); return; } choose(f, row); });
          options.append(opt);
        }
      };
      fill();
      return { options, fill };
    };
    const first = layerOf(field);
    let second = null;
    if (child) {
      second = layerOf(child);
      const layer = el('div', 'ask-layer');
      layer.setAttribute('role', 'group');
      layer.setAttribute('aria-label', child.label);
      if (child.label) layer.append(el('small', 'ask-layer-head', child.label));
      layer.append(second.options);
      second.el = layer;
    }
    if (target) {
      const find = el('input', 'ask-filter');
      find.type = 'search';
      find.placeholder = t('ask.find', 'type to find');
      find.value = filter;
      find.addEventListener('input', () => { filter = find.value.trim().toLowerCase(); (target === field ? first : second).fill(); });
      box.append(find);
    }
    const pressedIn = (f) => (f.many ? null : rowsOf(f).find((row) => String(row.v) === String(state[f.key])));
    say((child && pressedIn(child)) || pressedIn(field) || null);
    box.append(first.options);
    if (second) box.append(second.el);
    box.append(caption);
    return box;
  };

  /* ---- extras: a chosen option's own control, under the group, open or closed ---- */
  const extrasOf = (group) => {
    const extras = el('div', 'ask-extras');
    for (const field of group.fields) {
      if (!visible(field)) continue;
      const chosen = field.many ? state[field.key] : [state[field.key]];
      for (const v of chosen) {
        const row = rowFor(field, v);
        if (!row) continue;
        const draw = typeof row.row === 'function' ? row.row : field.row;
        if (typeof draw !== 'function') continue;
        const node = draw(row, snapshot());
        if (!node) continue;
        const line = el('label', 'ask-extra');
        line.append(el('span', 'ask-extra-name', row.l), node);
        extras.append(line);
      }
    }
    return extras.children.length ? extras : null;
  };

  /* ---- paint: groups, their stones, and the one open tray ---- */
  function paint() {
    root.replaceChildren();
    if (open && !fields.some((field) => field.key === open && visible(field))) open = '';
    root.dataset.open = open;
    for (const group of spec) {
      const drawn = group.fields.filter(visible);
      if (!drawn.length) continue;
      const box = el('div', 'ask-group');
      if (group.label) box.append(el('h4', 'ask-group-head', group.label));
      const row = el('div', 'ask-fields');
      for (const field of drawn) row.append(stone(field));
      box.append(row);
      const extras = extrasOf(group);
      if (extras) box.append(extras);
      root.append(box);
      const opened = drawn.find((field) => field.key === open && !field.switch);
      if (opened) root.append(tray(opened));
    }
    bindOutside();
  }

  /* ---- dismissal: Escape, and a press outside the utility ---- */
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); const key = open; open = ''; paint(); focusStone(key); }
  });
  const focusStone = (key) => { for (const node of root.children) { /* groups */ for (const inner of node.children || []) { for (const button of inner.children || []) if (button.dataset?.askKey === key) button.focus?.(); } } };
  function bindOutside() {
    if (typeof document.addEventListener !== 'function') return;
    if (open && !outside) {
      outside = (event) => { if (typeof root.contains === 'function' && root.contains(event.target)) return; open = ''; paint(); };
      document.addEventListener('pointerdown', outside);
    } else if (!open && outside) {
      document.removeEventListener('pointerdown', outside);
      outside = null;
    }
  }

  paint();
  return {
    el: root,
    value: snapshot,
    set(key, v) {
      const patch = key && typeof key === 'object' ? key : { [key]: v };
      for (const [name, next] of Object.entries(patch)) { const field = byKey(name); if (field) state[name] = field.switch ? Boolean(next) : field.many ? [...(next || [])] : (next ?? ''); }
      paint();
    },
    show(keys) { shown = Array.isArray(keys) ? new Set(keys) : null; paint(); },
    options(key, rows) { const field = byKey(key); if (!field) return; field.options = rows; paint(); },
    open(key) { open = byKey(key) && !byKey(key).switch ? key : ''; filter = ''; paint(); },
    close() { open = ''; paint(); },
    paint,
    destroy() { open = ''; bindOutside(); root.remove?.(); },
  };
}
