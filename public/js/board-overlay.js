/* part of the ronin-cowork client — see js/README.md */
/**
 * A BOARD'S OPEN ON COLLECTIONS (owner, 2026-10-08, PATTERNS Board row): one rule for Who,
 * What and Where — the Trello view of that one board, the Board tenant's own board-scoped view
 * (work-views-surface.js with `board`), in a full overlay over the surface it was opened from.
 * Close returns to where you were. Nothing is placed in the opposite workspace.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { createWorkViewsSurface } from './work-views-surface.js';
import { fullOverlay } from './work-details.js';

const el = (tag, cls = '', text = '') => { const out = document.createElement(tag); if (cls) out.className = cls; if (text) out.textContent = text; return out; };

/** Lay the board's Trello view over `host`. `scope` is what the view needs: holderTeam, openTeam, leadOf. */
export function openBoardOver(host, board, scope = {}) {
  const view = createWorkViewsSurface({ ...scope, board: () => board.id });
  fullOverlay(host, (layer, through) => {
    const head = el('div', 'league-team-detail-head');
    const tools = el('div', 'wk-surface-header-actions'); tools.append(...through);
    head.append(el('h2', '', board.title), tools);
    layer.append(head, view.el);
    view.show();
  }, { closed: () => view.destroy() });
}
