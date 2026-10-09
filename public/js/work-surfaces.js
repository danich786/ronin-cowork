/* part of the ronin-cowork client — see js/README.md */
/**
 * WORK — the Team's work card: one surface, one header (owner, 2026-10-09). At its head two
 * questions (ask.js, as Who's and What's): View, Trello view or Work Items (a two-answer
 * flip), and Board, a many-of over every board — Who's Workspace question copied — answered
 * at first with the Team's boards (the Team's collection reading) and changeable to any;
 * none is all. The body draws the chosen boards' items with the existing engines and no
 * surface or header of their own: the Trello view's lists (`createLists`,
 * work-views-surface.js, its Status view) or the Work Items board (`createItemsBoard`,
 * work-items-surface.js). Reads by push, the collection reading only (owner, 2026-10-09: one
 * reading per tenant): unfiltered for the question's boards and the Team's own, and wanted
 * with the chosen boards for the body; the browser requests, filters and joins nothing.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { ask } from './ask.js';
import { createLists } from './work-views-surface.js';
import { createItemsBoard } from './work-items-surface.js';
import { projectsForScope, taskManagerScope } from './team-kanban.js';
import { readingKey, subscribeCollection } from './collection-reading.js';
import { collectionBoards } from './work-readings.js';
import { t } from './lexicon.js';

export const WORK_SURFACES_TYPE = 'team-next.work';
const el = (tag, cls = '') => { const out = document.createElement(tag); if (cls) out.className = cls; return out; };

/** `team()` names the Team; `holderTeam`, `openTeam` and `leadOf` as the Trello view takes
 * them; `openOwner(name)` opens an item's holder, as the Work Items board takes it. */
export function createWorkSurfaces({ team = () => '', holderTeam = () => '', openTeam = () => {}, leadOf = () => '', openOwner = () => {} } = {}) {
  const { createSurface } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('team.work_card', 'Work'), className: 'work-surfaces' });

  // The two questions: the view, and the boards (any number; none is all).
  let view = 'trello';
  let chosen = [];
  const filter = ask([{ fields: [
    { key: 'view', label: t('team.work_view', 'View'), options: [
      { v: 'trello', l: t('work_views.title', 'Trello view') }, { v: 'items', l: t('work_items.title', 'Work Items') },
    ] },
    { key: 'board', label: t('collection.board', 'Board'), blank: t('collection.all', 'All'), many: true, options: [] },
  ] }], { value: { view, board: [] }, density: 'tight', onChange: ({ view: nextView, board: nextBoards }) => {
    view = nextView === 'items' ? 'items' : 'trello';
    chosen = (nextBoards || []).map(String);
    listen();
    paint();
  } });

  // The body: the Trello view's lists and the Work Items board, the chosen view shown.
  const body = el('div', 'work-body');
  const trello = el('div', 'wv');
  const lists = createLists(trello, { holderTeam, openTeam, team: team(), leadOf });
  const itemsHost = el('div', 'work-items-board sws-host');
  const board = createItemsBoard({ lead: () => leadOf(team()), openOwner });
  itemsHost.append(board.el, board.notice);
  body.append(trello, itemsHost);
  surface.content.append(filter.el, body);
  let boards = []; // the chosen boards, the lists' shape
  const paint = () => {
    trello.hidden = view !== 'trello';
    itemsHost.hidden = view !== 'items';
    if (view === 'trello') lists.paint('status', boards);
    else board.paint(projectsForScope(boards.flatMap((entry) => entry.stages.flatMap((stage) => stage.items)).map((item) => ({ ...item, team: team() })), taskManagerScope({ kind: 'team', team: team() })));
  };

  /* ---------- the readings: the collection push ---------- */
  // The unfiltered reading offers every board on the Board question and, the first time,
  // answers it with the Team's boards (its teams[].boards); the body is the reading wanted
  // with the chosen boards.
  let entered = false;
  let answered = false;
  let stopBody = null, heard = '';
  let stopAll = null;
  const listen = () => {
    if (!entered) return;
    const key = readingKey('collection', { board: chosen });
    if (stopBody && key === heard) return;
    stopBody?.(); heard = key;
    stopBody = subscribeCollection({ board: chosen }, (reading) => { surface.setState(); boards = collectionBoards(reading); paint(); });
  };
  const quiet = () => { stopBody?.(); stopAll?.(); stopBody = stopAll = null; heard = ''; };
  return {
    el: surface.el,
    show: () => {
      entered = true;
      stopAll = subscribeCollection({}, (reading) => {
        filter.options('board', (reading?.boards || []).map((row) => ({ v: row.id, l: row.title })));
        if (answered) return;
        answered = true;
        chosen = (reading?.teams || []).find((row) => row.name === team())?.boards || [];
        filter.set('board', chosen);
        listen();
      });
      listen();
    },
    leave: () => { entered = false; quiet(); },
    destroy: () => { entered = false; quiet(); filter.destroy?.(); board.destroy(); },
  };
}
