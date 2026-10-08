/* part of the ronin-cowork client — see js/README.md */
/**
 * WHAT: YOUR BOARDS — the boards door of the collections workbench, Who's shape over boards
 * (COLLECTIONS_DIRECTION.md; PATTERNS.md rows "Collections (What)"; lead 2026-10-08).
 *
 *   Head          the door's name.
 *   Question      Under each board: Items or Agents, the two-answer flip Who uses.
 *   Stones        boards, name only, Unfiled last.
 *   Bars          the board's items by title, or the Agents on it.
 *   Board pressed the thin open beside the rail: objective, its items by title, the Agents on
 *                 it, and one door, Open, which places the Board (the Trello view) in the
 *                 opposite workspace.
 *   Bar pressed   its read in a partial overlay hung off the bar: an item — description,
 *                 status, holder; an Agent — the items it holds on this board.
 *   Drag          an item bar onto another board stone reparents it there.
 *
 * Reading: the collection push (collection-reading.js), the whole campaign; the browser
 * requests, filters and joins nothing. `whatRows` (what-rows.js) is the pure mapping.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createCollectionPhalanx } from './collection-phalanx.js';
import { subscribeCollection } from './collection-reading.js';
import { itemsOnBoardHeldBy, whatMove, whatRows } from './what-rows.js';
import { holderName } from './work-readings.js';
import { stageLabel } from './team-kanban.js';
import { openPartialOverlay } from './partial-overlay.js';
import { ask } from './ask.js';
import { request } from './request.js';
import { t } from './lexicon.js';

export const WHAT_TYPE = 'collection.what';
const el = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };

/** `openBoard(board)` places the Board surface in the opposite workspace. */
export function createWhatSurface({ openBoard = () => {} } = {}) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('collection.what', 'What: Your Boards'), className: 'what-surface' });
  const DRAG = 'application/x-ronin-what';

  let under = 'items';
  const filter = ask([{ fields: [
    { key: 'under', label: t('collection.under_each_board', 'Under each board'), options: [
      { v: 'items', l: t('collection.under_items', 'Items') }, { v: 'agents', l: t('collection.under_agents', 'Agents') },
    ] },
  ] }], { value: { under }, density: 'tight', onChange: ({ under: next }) => { under = next === 'agents' ? 'agents' : 'items'; if (last) paint(last); } });
  const questions = el('div', 'who-questions'); questions.append(filter.el);

  /* ---------- a bar pressed: its read in a partial overlay hung off the bar ---------- */
  const read1 = (host, lines) => { for (const [label, text] of lines) { if (!text) continue; const line = el('div', 'cph-read-line'); line.append(el('b', '', label), document.createTextNode(text)); host.append(line); } };
  const readOf = (item, host) => {
    if (item.kind === 'item') {
      read1(host, [[t('collection.description', 'Description'), item.item.objective || t('collection.none', 'None')], [t('collection.status', 'Status'), stageLabel(item.item.stage)], [t('collection.holder', 'Holder'), holderName(item.item.holder) || t('collection.nobody', 'nobody')]]);
      return;
    }
    if (item.kind === 'agent') {
      const board = (last?.boards || []).find((row) => row.id === item.board);
      read1(host, [[t('collection.holds', 'Holds'), itemsOnBoardHeldBy(board, item.agent.name).map((row) => row.title).join(' · ') || t('collection.none', 'None')]]);
    }
  };
  const press = (item, bar) => {
    bar.setAttribute('aria-pressed', 'true');
    openPartialOverlay(surface.content, { anchor: bar, title: item.label, draw: (body) => readOf(item, body), onClose: () => bar.setAttribute('aria-pressed', 'false') });
  };

  /* ---------- the thin open: a board pressed ---------- */
  const bar = (row) => {
    const button = el('button', `sws-stone ${row.className || ''}`.trim()); button.type = 'button';
    button.dataset.cphDepth = '1'; button.dataset.swsId = String(row.id);
    button.append(el('b', 'sws-label', row.label));
    button.addEventListener('click', () => press(row, button));
    return button;
  };
  const list = (title, rows) => {
    const box = el('div', 'who-open-list');
    box.append(el('b', 'who-open-label', title));
    if (!rows.length) box.append(el('span', 'who-open-none', t('collection.none', 'None')));
    for (const row of rows) box.append(bar(row));
    return box;
  };
  const renderDetail = (item, host) => {
    if (item.kind !== 'board') return;
    const box = el('div', 'who-open');
    const head = el('div', 'who-open-head');
    const open = createAction({ label: t('collection.open', 'Open'), size: 'compact', action: () => openBoard(item.board) });
    head.append(el('h2', '', item.label), open.el);
    box.append(head);
    if (item.board.objective) box.append(el('p', 'who-open-objective', item.board.objective));
    const one = { boards: [item.board] };
    box.append(
      list(t('collection.items', 'Items'), whatRows(one, { under: 'items' })[0]?.items || []),
      list(t('league.agents', 'Agents'), whatRows(one, { under: 'agents' })[0]?.items || []),
    );
    host.append(box);
  };
  const phalanx = createCollectionPhalanx({ className: 'what-phalanx', items: [], renderDetail, press });
  phalanx.mount(surface.content, { before: [questions] });

  /* ---------- the drag: an item bar onto another board stone ---------- */
  const carried = (event) => { try { return JSON.parse(event.dataTransfer?.getData(DRAG) || 'null'); } catch { return null; } };
  const wire = (boards) => boards.map((board) => ({
    ...board,
    events: {
      dragover: (event) => { if (!event.dataTransfer?.types?.includes(DRAG)) return; event.preventDefault(); event.currentTarget.classList.add('cph-over'); },
      dragleave: (event) => event.currentTarget.classList.remove('cph-over'),
      drop: async (event) => {
        event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('cph-over');
        const moved = carried(event);
        if (whatMove(moved, board) !== 'reparent') return;
        const result = await request(`/api/work-items/${encodeURIComponent(moved.id)}/reparent`, { method: 'POST', json: { parent: board.id } });
        if (!result.ok) surface.setState('failed', result.message || '');
      },
    },
    items: (board.items || []).map((row) => row.kind !== 'item' ? row : {
      ...row, draggable: true,
      events: { dragstart: (event) => { event.dataTransfer.setData(DRAG, JSON.stringify({ kind: 'item', id: row.id, board: board.id })); event.dataTransfer.effectAllowed = 'move'; } },
    }),
  }));

  /* ---------- the reading: the collection push ---------- */
  let shown = '';
  let last = null;
  const paint = (data) => {
    last = data;
    const next = whatRows(data, { under, labels: { unfiled: t('work_nav.draft_unfiled', 'Unfiled') } });
    const signature = JSON.stringify(next);
    if (signature === shown) return;
    shown = signature;
    phalanx.setItems(wire(next));
  };
  let stop = null;
  return {
    el: surface.el,
    show: () => { stop ??= subscribeCollection({}, (reading) => { surface.setState(); paint(reading || {}); }); },
    leave: () => { stop?.(); stop = null; },
    destroy: () => { stop?.(); stop = null; filter.destroy?.(); phalanx.destroy(); },
  };
}
