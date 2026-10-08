/* part of the ronin-cowork client — see js/README.md */
/**
 * A BOARD'S OPEN ON COLLECTIONS (owner, 2026-10-08, PATTERNS Board row): one rule for Who,
 * What and Where — that board's lists, in a full overlay over the surface it was opened
 * from. The overlay's head is the board's title and Close; under it the stage lists side by
 * side, Idea to Done, each holding that board's items at that stage as cards with Add at the
 * foot, and a card dragged onto another list writes its stage: the Trello view's own drawing
 * (`createLists`, work-views-surface.js), nothing else of that surface. The board's items
 * arrive by push (the work-items want by board) and repaint the lists; Close lifts the
 * overlay and the subscription with it. Nothing is placed in the opposite workspace.
 */
import { el } from './form-steps.js';
import { createLists } from './work-views-surface.js';
import { fullOverlay } from './work-details.js';
import { subscribeWorkItems } from './collection-reading.js';

/** Lay the board's lists over `host`. `scope` is what the lists need: holderTeam, openTeam, leadOf. */
export function openBoardOver(host, board, scope = {}) {
  let stop = null;
  fullOverlay(host, (layer, through) => {
    const head = el('div', 'league-team-detail-head');
    const tools = el('div', 'wk-surface-header-actions'); tools.append(...through);
    head.append(el('h2', '', board.title), tools);
    const root = el('div', 'wv');
    layer.append(head, root);
    const lists = createLists(root, { ...scope, boardId: () => board.id });
    stop = subscribeWorkItems({ board: board.id }, (reading) => lists.paint('status', reading?.items || []));
  }, { closed: () => stop?.() });
}
