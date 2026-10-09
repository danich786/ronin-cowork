/* part of the ronin-cowork client — see js/README.md */
/**
 * TRELLO VIEW — every board's items read two ways, off GET /api/work-items. No phalanx. The
 * button at the top left reads "View by: Status" or "View by: Board"; pressing it switches.
 *
 *   Status   one list per stage across the top; in each, every board with items at that
 *            stage as a subtitle, that board's items at that stage under it; one board
 *            alone has no subtitle, its items sit straight in the list
 *   Board    one list per board across the top; in each, every stage the board has items
 *            at as a subtitle, the board's items at that stage under it
 *
 * Laid out the way a Trello board is: each list one fixed-width panel as tall as what it
 * holds, its name and count at the head, Add at the foot; in Board view, Add board after
 * the last board. A board is a root item and its items are every item under it. In Board
 * view an item drags onto another board's list (it moves there) or onto empty space (it
 * becomes a board of its own); in Status view it drags onto another stage's list (its stage
 * is written). Press a list head, a subtitle or an item and its overlay
 * lies over the lists (the item overlay for a board or an item, the status's items in their
 * context for a status). Close or Escape lifts it.
 *
 * The lists are one drawing, `createLists`: the surface draws both views with it, and a
 * board's Open on a collection door (board-overlay.js) draws that one board's stage lists
 * with it, nothing else of the surface (owner, 2026-10-08).
 */
import { WorkspaceKit } from './workspace-kit.js';
import { el } from './form-steps.js';
import { PROJECT_STAGES } from './team-kanban.js';
import { NEW_BOARD, draftOverlay, itemOverlay, listOverlay } from './work-details.js';
import { request } from './request.js';
import { carryItem } from './team-drag.js';
import { readingKey, subscribeCollection } from './collection-reading.js';
import { boardStages, collectionBoards, holderName } from './work-readings.js';
import { t } from './lexicon.js';

export const WORK_VIEWS_TYPE = 'work.views';

const STAGE_KEYS = PROJECT_STAGES.map((stage) => stage.key);
const stageName = (key) => PROJECT_STAGES.find((stage) => stage.key === key)?.label || key;

/**
 * THE LISTS — cards, groups and lists drawn into `root` (a `.wv` box; the row of lists is
 * appended to it), the drag between lists, and the overlays laid over `root`. `paint(view,
 * boards)` draws the boards — `boardStages`'s shape, { board, stages, size }, as `boardStages`
 * makes it from items or `collectionBoards` from a collection reading — in Status or Board view. `holderTeam(holder)` names the Team a holder works in;
 * `openTeam(team)` opens its workbench; `team`, on a Team's workbench, holds a board dragged
 * onto empty space; `leadOf(team)` names its lead, whose board is the Team's second choice for
 * Add; `boardId()` names the one board drawn, when one is: Add starts on it and there is no
 * Add board; `changed()` hears every write, for a reader that is not pushed to read again.
 */
export function createLists(root, { holderTeam = () => '', openTeam = () => {}, team = '', leadOf = () => '', boardId = () => '', changed = () => {} } = {}) {
  const { createAction } = WorkspaceKit.primitives;
  let view = 'status';
  let boards = [];
  const row = el('div', 'wv-row');
  root.append(row);

  // The overlay: one at a time, over the lists; what it writes is said.
  const lift = () => root.querySelector(':scope > .work-overlay')?.remove();
  const openItem = (item) => {
    lift();
    const holding = holderTeam(String(item.holder || ''));
    itemOverlay(root, item, {
      through: holding ? [createAction({ label: t('work.open_team', 'Open {team}', { team: holding }), size: 'compact', action: () => openTeam(holding) })] : [],
      context: () => ({ stage: item.stage, parent: item.parent || item.id }), changed,
    });
  };
  const openStatus = (stage, board, items) => {
    lift();
    listOverlay(root, {
      title: board ? `${stageName(stage)} · ${board.title}` : stageName(stage),
      about: board ? t('work_views.status_in_board', 'Items under {board} at {stage}.', { board: board.title, stage: stageName(stage) })
        : t('work_views.status_all', 'Items under every board at {stage}.', { stage: stageName(stage) }),
      items,
    }, { context: () => ({ stage, parent: board?.id || target() }), changed });
  };

  const press = (className, parts, action) => {
    const button = el('button', className);
    button.type = 'button';
    button.append(...parts);
    button.addEventListener('click', action);
    return button;
  };
  /** An item: its title, and the initial of whoever holds it. */
  const card = (item) => {
    const who = holderName(item.holder);
    const mark = who ? el('span', 'wv-holder', who.slice(0, 1).toUpperCase()) : null;
    if (mark) mark.title = who;
    const button = press('wv-item', [el('span', 'wv-label', item.title), mark].filter(Boolean), () => openItem(item));
    // Every card drags onto a tile as the item's reference; it also moves between lists (board or stage).
    button.draggable = true;
    button.addEventListener('dragstart', (event) => {
      carryItem(event.dataTransfer, item);
      event.dataTransfer?.setData('text/plain', item.id);
    });
    return button;
  };
  /** A group inside a list: a plain underlined subtitle, its items under it. */
  const group = (label, items, action) => {
    const box = el('div', 'wv-group');
    box.append(press('wv-sub', [el('span', 'wv-label', label)], action), ...items.map(card));
    return box;
  };
  /** A list: its name and count, its groups, and Add at the foot, starting where it sits. */
  const list = (label, n, action, groups, context) => {
    const column = el('section', 'wv-list');
    if (context.parent && context.parent === unfiledId()) column.dataset.unfiled = '';
    const add = press('wv-add', [el('i', 'wv-add-mark', '+'), el('span', null, t('work_views.add', 'Add a work item'))],
      () => { lift(); draftOverlay(root, { ...context, parent: context.parent || target(), changed }); });
    column.append(press('wv-list-head', [el('span', 'wv-label', label), el('span', 'wv-count', String(n))], action), ...groups, add);
    // An item dropped on another list: in Board view it moves under that board; in Status view its stage is written.
    column.addEventListener('dragover', (event) => { event.preventDefault(); column.classList.add('over'); });
    column.addEventListener('dragleave', () => column.classList.remove('over'));
    column.addEventListener('drop', (event) => {
      event.preventDefault(); event.stopPropagation(); column.classList.remove('over');
      const id = event.dataTransfer?.getData('text/plain') || '';
      if (view === 'board' && boardOf.get(id) !== context.parent) void move(id, context.parent);
      if (view === 'status' && itemsById.get(id)?.stage !== context.stage) void setStage(id, context.stage);
    });
    return column;
  };

  /* DRAG IN BOARD VIEW. Onto another board's list: the item (its children with it) moves
   * under that board. Onto empty space: it becomes a board of its own; on a Team's workbench
   * the Team then holds it when nobody does, so it stays in view. One reparent call each,
   * through the store's route, which writes the trail line. */
  const boardOf = new Map(); // item id → the board it is on
  const itemsById = new Map();
  const move = async (id, parent) => {
    const moved = await request(`/api/work-items/${encodeURIComponent(id)}/reparent`, { method: 'POST', json: { parent: parent || '' } });
    if (moved.ok && !parent && team && !itemsById.get(id)?.holder) {
      await request(`/api/work-items/${encodeURIComponent(id)}/assign`, { method: 'POST', json: { team } });
    }
    changed();
  };
  /* DRAG IN STATUS VIEW. Onto another stage's list: one stage call through the store's
   * route, which writes the trail line. */
  const setStage = async (id, key) => {
    await request(`/api/work-items/${encodeURIComponent(id)}/stage`, { method: 'POST', json: { stage: key } });
    changed();
  };
  row.addEventListener('dragover', (event) => { if (view === 'board') event.preventDefault(); });
  row.addEventListener('drop', (event) => {
    if (view !== 'board' || event.target.closest?.('.wv-list')) return;
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || '';
    if (id && itemsById.get(id)?.parent) void move(id, '');
  });

  /* WHERE ADD STARTS ON A TEAM: the Team's target board, read off the boards the server sent,
   * nothing stored. The root the Team holds; else the root its lead holds; else Unfiled
   * (the form's default). Several of one kind: the oldest. Cowork/Desk start at Unfiled. */
  const unfiledId = () => boards.find((entry) => entry.board.title === 'Unfiled')?.board.id || '';
  const oldest = (rows) => rows.sort((a, b) => String(a.created?.at || '').localeCompare(String(b.created?.at || '')))[0];
  const target = () => {
    if (boardId()) return boardId();
    if (!team) return '';
    const roots = boards.map((entry) => entry.board);
    const lead = leadOf(team);
    return (oldest(roots.filter((board) => board.holder === `team:${team}`))
      || (lead && oldest(roots.filter((board) => board.holder === `agent:${lead}`))))?.id || '';
  };
  /** Board view: Unfiled at the far right, every other board in store order left of it. */
  const unfiledLast = (rows) => [...rows.filter((entry) => entry.board.id !== unfiledId()), ...rows.filter((entry) => entry.board.id === unfiledId())];

  const paint = (next, rows) => {
    view = next;
    boards = rows;
    lift();
    root.dataset.view = view;
    row.scrollLeft = 0;
    boardOf.clear(); itemsById.clear();
    for (const entry of boards) for (const stage of entry.stages) for (const item of stage.items) { boardOf.set(item.id, entry.board.id); itemsById.set(item.id, item); }
    // One board alone has no subtitle to tell its items apart: they sit straight in the list.
    const one = boards.length === 1 ? boards[0].board : null;
    if (view === 'status') row.replaceChildren(...STAGE_KEYS.map((stage) => {
      const here = boards.map((entry) => ({ board: entry.board, items: entry.stages.find((row) => row.stage === stage)?.items || [] })).filter((entry) => entry.items.length);
      const all = here.flatMap((entry) => entry.items);
      return list(stageName(stage), all.length, () => openStatus(stage, one, all),
        one ? all.map(card) : here.map((entry) => group(entry.board.title, entry.items, () => openItem(entry.board))), { stage });
    }));
    else row.replaceChildren(...unfiledLast(boards).map((entry) => list(entry.board.title, entry.size, () => openItem(entry.board),
      entry.stages.map((row) => group(stageName(row.stage), row.items, () => openStatus(row.stage, entry.board, row.items))), { parent: entry.board.id })),
    // Add board, after the last board: the Add form with New board chosen, held by this Team on a Team's workbench. One board has no Add board.
    ...(boardId() ? [] : [press('wv-add-board', [el('i', 'wv-add-mark', '+'), el('span', null, t('work_views.add_board', 'Add board'))],
      () => { lift(); draftOverlay(root, { parent: NEW_BOARD, team, changed }); })]));
  };
  return { paint };
}

/** `holderTeam(holder)` names the Team a holder works in; `openTeam(team)` opens its workbench;
 * `team`, on a Team's workbench, reads that Team's boards from the server and holds new boards;
 * `leadOf(team)` names its lead, whose board is the Team's second choice for Add. `board`, on
* the Board tenant (a board id, or a function naming it), draws that one board: its reading
 * arrives by push (the collection reading, board=[id]: `boards[].stages` carries the items
 * with their holders; owner, 2026-10-09, one reading per tenant), Add starts on it, and
 * there is no Add board. `onRead(boards)` hears each reading, for the tenant's bar name. */
export function createWorkViewsSurface({ holderTeam = () => '', openTeam = () => {}, team = '', leadOf = () => '', board = '', onRead = () => {} } = {}) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  let view = 'status';
  let boards = [];
  const surface = createSurface({ label: t('work_views.title', 'Trello view'), className: 'work-views-surface' });
  const root = el('div', 'wv');
  const toggle = createAction({ size: 'compact', className: 'wv-toggle', action: () => { view = view === 'status' ? 'board' : 'status'; paint(); } });
  const head = el('div', 'wv-head');
  head.append(toggle.el);
  root.append(head);
  surface.content.append(root);
  const boardId = () => (typeof board === 'function' ? board() : board) || '';
  // No wording on the surface: a write shows itself when the lists are read again.
  const lists = createLists(root, { holderTeam, openTeam, team, leadOf, boardId, changed: () => void refresh() });

  const paint = () => {
    toggle.el.textContent = t('work_views.view_by', 'View by: {view}', { view: view === 'status' ? t('work_views.status', 'Status') : t('work_views.board', 'Board') });
    toggle.el.title = view === 'status' ? t('work_views.to_board', 'Showing Status. Press for Board.') : t('work_views.to_status', 'Showing Board. Press for Status.');
    lists.paint(view, boards);
  };

  // One board hears its collection reading from the store and repaints on each push; a
  // changed board id resubscribes. A write needs no re-read. The reading's boards are the
  // lists' shape through `collectionBoards`.
  let stop = null, heard = '';
  const listen = () => {
    const id = boardId();
    const key = readingKey('collection', { board: id });
    if (stop && key === heard) return;
    stop?.(); heard = key;
    stop = subscribeCollection({ board: id }, (reading) => {
      boards = collectionBoards(reading);
      paint();
      onRead(boards);
    });
  };
  async function refresh() {
    if (boardId()) return;
    // A Team reads its boards from the server (its team reading's `boards`); Cowork/Desk read every item.
    const read = await request(team ? `/api/work-items?team=${encodeURIComponent(team)}` : '/api/work-items', { cache: 'no-store' });
    if (!read.ok) return;
    boards = boardStages((team ? read.data.boards : read.data.items) || [], STAGE_KEYS);
    paint();
  }
  paint();
  return {
    el: surface.el,
    show: () => { if (boardId()) listen(); else void refresh(); },
    leave: () => { stop?.(); stop = null; heard = ''; },
    destroy: () => { stop?.(); stop = null; heard = ''; },
  };
}
