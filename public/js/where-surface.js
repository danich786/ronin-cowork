/* part of the ronin-cowork client — see js/README.md */
/**
 * WHERE: YOUR WORKSPACES — the workspace-folder door of the collections workbench
 * (samurai_lab COLLECTIONS_DIRECTION.md, "What and Where"): find work by where it lives.
 *
 *   Question      Under each folder: Teams or Boards (a one-of-two, as Who's).
 *   Stones        workspace folders, name only.
 *   Bars          the folder's Teams or its boards, title only.
 *   Folder pressed  the thin open: its name and path.
 *   Bar pressed   its read in a partial overlay hung off the bar, with the reads Workspace
 *                 WS1 uses (workspace-teams-surface.js): a Team's objective and its door,
 *                 Launch; a board's objective and items, and its door, Open, into the
 *                 opposite workspace. Nothing adds or moves here.
 *
 * Reading: the collection push, unfiltered (collection-reading.js); a folder's `teams` and
 * `boards` come resolved on its row, and the browser joins nothing.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createCollectionPhalanx } from './collection-phalanx.js';
import { subscribeCollection } from './collection-reading.js';
import { boardRead, teamRead } from './workspace-teams-surface.js';
import { openPartialOverlay } from './partial-overlay.js';
import { ask } from './ask.js';
import { t } from './lexicon.js';

export const WHERE_TYPE = 'collection.where';
const el = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };

/** The stones from one collection reading: every folder, its Teams or its boards as bars. Pure. */
export function whereRows(reading = {}, under = 'teams') {
  const teams = new Map((reading.teams || []).map((team) => [team.name, team]));
  const boards = new Map((reading.boards || []).map((board) => [board.id, board]));
  return (reading.roots || []).map((root) => ({
    id: root.name, kind: 'root', root, className: 'who-team', label: root.name,
    items: under === 'boards'
      ? root.boards.filter((id) => boards.has(id)).map((id) => ({ id: `${root.name}:board:${id}`, kind: 'board', board: boards.get(id), className: 'who-board', label: boards.get(id).title }))
      : root.teams.filter((name) => teams.has(name)).map((name) => ({ id: `${root.name}:team:${name}`, kind: 'team', team: teams.get(name), className: 'who-agent', label: String(teams.get(name).title ?? '').trim() || name })),
  }));
}

/** `openTeam(name)` opens the Team's tab; `openBoard(board)` places the board's surface opposite. */
export function createWhereSurface({ openTeam = () => {}, openBoard = () => {} } = {}) {
  const { createSurface, createAction } = WorkspaceKit.primitives;
  const surface = createSurface({ label: t('collection.where', 'Where: Your Workspaces'), className: 'who-surface' });

  let under = 'teams';
  let last = null;
  const filter = ask([{ fields: [
    { key: 'under', label: t('collection.under_each_folder', 'Under each folder'), options: [
      { v: 'teams', l: t('collection.under_teams', 'Teams') }, { v: 'boards', l: t('collection.under_boards', 'Boards') },
    ] },
  ] }], { value: { under }, density: 'tight', onChange: ({ under: next }) => { under = next === 'boards' ? 'boards' : 'teams'; if (last) paint(last); } });

  const renderDetail = (item, host) => {
    if (item.kind !== 'root') return;
    const box = el('div', 'who-open');
    box.append(el('h2', '', item.label));
    if (item.root.path) box.append(el('p', 'who-open-objective', item.root.path));
    host.append(box);
  };
  const press = (item, bar) => {
    bar.setAttribute('aria-pressed', 'true');
    openPartialOverlay(surface.content, { anchor: bar, title: item.label, onClose: () => bar.setAttribute('aria-pressed', 'false'),
      draw: (body, { lift }) => {
        if (item.kind === 'team') teamRead(body, item.team, createAction({ label: t('league.launch_team', 'Launch'), launch: true, size: 'compact', action: () => { lift(); openTeam(item.team.name); } }).el);
        else boardRead(body, item.board, createAction({ label: t('collection.open', 'Open'), size: 'compact', action: () => { lift(); openBoard(item.board); } }).el);
      } });
  };
  const phalanx = createCollectionPhalanx({ className: 'who-phalanx', items: [], renderDetail, press });
  phalanx.mount(surface.content, { before: [filter.el] });

  let shown = '';
  const paint = (reading) => {
    last = reading || {};
    const next = whereRows(last, under);
    const signature = JSON.stringify(next);
    if (signature === shown) return;
    shown = signature;
    phalanx.setItems(next);
  };
  let stop = null;
  const listen = () => { stop ||= subscribeCollection({}, paint); };
  const quiet = () => { stop?.(); stop = null; shown = ''; };
  return {
    el: surface.el,
    show: listen,
    leave: quiet,
    destroy: () => { quiet(); filter.destroy?.(); phalanx.destroy(); },
  };
}
