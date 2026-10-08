/* part of the ronin-cowork client — see js/README.md */
/**
 * COLLECTIONS — the thin tenant on the tenant frame (js/tenant-frame.js): find work, add
 * work, reassign work (samurai_lab COLLECTIONS_DIRECTION.md). Its tenant is the campaign,
 * the one machine campaign when the route names none — the "all" layer. Cards: Who, What,
 * Where and New (js/collection-new.js). No tiles, and no Trello view card: a board's Open lays
 * the board's lists over the door (js/board-overlay.js). The old Teams collection
 * (#/cowork, cowork-view.js) stands beside it until this one replaces it.
 */
import { createTenantFrame } from './tenant-frame.js';
import { createWhoSurface } from './who-surface.js';
import { createWhatSurface } from './what-surface.js';
import { createWhereSurface } from './where-surface.js';
import { createCollectionNewSurface } from './collection-new.js';
import { openBoardOver } from './board-overlay.js';
import { membersOfTeam, teamsFromState } from './team-controller.js';
import { openWorkspaceTab } from './workspace.js';
import { t } from './lexicon.js';
import { WORKBENCH_PROFILES, WORKBENCH_TYPES } from './workbench-catalog.js';
import { DISMISSED_WORKSPACE } from './workspace-contract.js';

// Launch opens the Team's tab on the new frame (team-view.js).
function openTeam(name) {
  return openWorkspaceTab('team-next', name);
}
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

// A board's Open (owner, 2026-10-08): that board's Trello view in a full overlay over the
// surface it was opened from; never the opposite workspace.
const openBoard = (board, host) => openBoardOver(host, board, { holderTeam, openTeam, leadOf });

export function createCollectionsView() {
  const whoBySeat = {};
  const whatBySeat = {};
  const whereBySeat = {};
  return createTenantFrame({
    key: 'collections',
    profile: WORKBENCH_PROFILES.collections,
    glyph: '⛩',
    label: () => t('collections.title', 'Collections'),
    name: () => t('collections.title', 'Collections'),
    homeCard: WORKBENCH_TYPES.who,
    firstOpen: () => ({ workspace1: WORKBENCH_TYPES.who, workspace2: DISMISSED_WORKSPACE }),
    cards: () => ({
      who: (id) => {
        whoBySeat[id] ||= createWhoSurface({ openTeam, openBoard });
        return whoBySeat[id];
      },
      what: (id) => {
        whatBySeat[id] ||= createWhatSurface({ openBoard });
        return whatBySeat[id];
      },
      where: (id) => {
        whereBySeat[id] ||= createWhereSurface({ openTeam, openBoard });
        return whereBySeat[id];
      },
      collectionNew: () => createCollectionNewSurface(),
    }),
    destroy: () => { for (const surface of [...Object.values(whoBySeat), ...Object.values(whatBySeat), ...Object.values(whereBySeat)]) surface.destroy?.(); },
  });
}
