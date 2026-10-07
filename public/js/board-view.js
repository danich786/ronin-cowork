/* part of the ronin-cowork client — see js/README.md */
/**
 * BOARD — the thin tenant on the tenant frame (js/tenant-frame.js). The route names the
 * board by its item id; the server narrows the reading to it and pushes it. WS1 is the
 * Board pattern (work-views-surface.js) for that one board (PATTERNS.md, Board tenant: the
 * board itself; owner, 2026-10-07). The item, the holders' tiles and the configuration
 * follow, one row per hand-in.
 */
import { createTenantFrame } from './tenant-frame.js';
import { createWorkViewsSurface } from './work-views-surface.js';
import { membersOfTeam, teamsFromState } from './team-controller.js';
import { openWorkspaceTab } from './workspace.js';
import { S } from './state.js';
import { t } from './lexicon.js';
import { WORKBENCH_PROFILES, WORKBENCH_TYPES } from './workbench-catalog.js';
import { DISMISSED_WORKSPACE } from './workspace-contract.js';

function leadOf(name) {
  return membersOfTeam(name).find((member) => member.team_lead)?.name || '';
}
// The Team a work item's holder works in: the holding Team, or the Team of the holding Agent.
function holderTeam(holder) {
  if (holder.startsWith('team:')) return holder.slice(5);
  if (!holder.startsWith('agent:')) return '';
  const agent = holder.slice(6);
  return teamsFromState().find((row) => membersOfTeam(row.name).some((member) => member.name === agent))?.name || '';
}
function openTeam(name) {
  return openWorkspaceTab('team-next', name);
}

export function createBoardView() {
  const titles = new Map(); // board id -> title, learned from the reading; the bar name
  return createTenantFrame({
    key: 'board',
    profile: WORKBENCH_PROFILES.board,
    glyph: '卜',
    label: () => t('next.board', 'Board'),
    name: (id) => titles.get(id) || id || t('next.board', 'Board'),
    homeCard: WORKBENCH_TYPES.workViews,
    firstOpen: () => ({ workspace1: WORKBENCH_TYPES.workViews, workspace2: DISMISSED_WORKSPACE }),
    cards: (frame) => ({
      workViews: () => createWorkViewsSurface({
        board: () => frame.param(), holderTeam, openTeam, leadOf,
        onRead: (boards) => {
          const root = boards.find((entry) => entry.board.id === frame.param())?.board;
          if (!root?.title || titles.get(root.id) === root.title) return;
          titles.set(root.id, root.title);
          S.refreshWorkspaceHeader?.();
          S.workspace?.refreshTitle?.();
        },
      }),
    }),
  });
}
