/* part of the ronin-cowork client — see js/README.md */
/** The What door's stones from one collection reading (the collection push). Pure: no DOM. */
import { holderName } from './work-readings.js';

/**
 * The stones: every board the reading names, Unfiled last. Under each, `under` chooses what
 * stacks: 'items' (one row per status the board has items at, in the reading's stage order,
 * each with its items beneath; owner 2026-10-08: the rail lists statuses, the detail the
 * items) or 'agents' (the Agents
 * on the board, the session names the reading gives). A bar is its title and nothing else
 * (owner, 2026-10-04: a table of contents, never a reading of everything).
 */
export function whatRows(reading = {}, { under = 'items', labels = {} } = {}) {
  const boards = Array.isArray(reading.boards) ? reading.boards : [];
  const unfiled = (board) => board.title === (labels.unfiled || 'Unfiled') && !board.teams.length;
  const ordered = [...boards.filter((board) => !unfiled(board)), ...boards.filter(unfiled)];
  return ordered.map((board) => ({
    id: board.id, kind: 'board', board, className: 'what-board',
    label: board.title,
    items: under === 'agents'
      ? (board.agents || []).map((name) => ({ id: `agent:${board.id}:${name}`, kind: 'agent', agent: { name }, board: board.id, className: 'what-agent', label: name }))
      : (board.stages || []).map((stage) => ({
        id: `${board.id}:${stage.stage}`, kind: 'status', stage: stage.stage, board: board.id, className: 'what-status',
        label: (labels.stage || ((key) => key))(stage.stage),
        items: stage.items.map((item) => ({ id: item.id, kind: 'item', item, board: board.id, className: 'what-item', label: item.title })),
      })),
  }));
}

/**
 * What dropping `moved` on `target` means on What, or '' when nothing: an item onto another
 * board reparents it there (owner, 2026-10-07). `moved` is { kind, id, board }: what is
 * dragged and the board it was under; `target` is a row ({ kind, id }).
 */
export function whatMove(moved, target) {
  if (!moved || !target) return '';
  if (target.kind === 'board' && moved.kind === 'item' && moved.board !== target.id) return 'reparent';
  return '';
}

/** The items on a board that an Agent holds. */
export const itemsOnBoardHeldBy = (board, agent) => (board?.stages || []).flatMap((stage) => stage.items.filter((item) => holderName(item.holder) === agent));
