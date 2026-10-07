/* part of the ronin-cowork client — see js/README.md */
/**
 * BOARD — the thin tenant on the tenant frame (js/tenant-frame.js). The route names the
 * board by its item id; the server narrows the reading to it and pushes it. WS1 is the
 * Board pattern (work-views-surface.js) for that one board (PATTERNS.md, Board tenant: the
 * board itself; owner, 2026-10-07). Configuration is an item on that surface's メ opening the
 * full overlay with Grey form rows: title and objective, each saving itself
 * (PUT /api/work-items/:id). The item and the holders' tiles follow, one row per hand-in.
 */
import { createTenantFrame } from './tenant-frame.js';
import { createWorkViewsSurface } from './work-views-surface.js';
import { configurationGroup, openConfiguration } from './configuration-overlay.js';
import { request } from './request.js';
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

const saveField = (id, field) => (value) => request(`/api/work-items/${encodeURIComponent(id)}`, { method: 'PUT', json: { [field]: value } });

export function createBoardView() {
  const titles = new Map(); // board id -> title, learned from the reading; the bar name
  const records = new Map(); // board id -> the root item as last read; configuration starts from it
  return createTenantFrame({
    key: 'board',
    profile: WORKBENCH_PROFILES.board,
    glyph: '卜',
    label: () => t('next.board', 'Board'),
    name: (id) => titles.get(id) || id || t('next.board', 'Board'),
    homeCard: WORKBENCH_TYPES.workViews,
    firstOpen: () => ({ workspace1: WORKBENCH_TYPES.workViews, workspace2: DISMISSED_WORKSPACE }),
    cards: (frame) => ({
      workViews: () => {
        const view = createWorkViewsSurface({
          board: () => frame.param(), holderTeam, openTeam, leadOf,
          onRead: (boards) => {
            const root = boards.find((entry) => entry.board.id === frame.param())?.board;
            if (!root) return;
            records.set(root.id, root);
            if (titles.get(root.id) === root.title) return;
            titles.set(root.id, root.title);
            S.refreshWorkspaceHeader?.();
            S.workspace?.refreshTitle?.();
          },
        });
        // Configuration: an item on this surface's メ; the rows start from the record as last pushed.
        const configure = () => {
          const id = frame.param();
          const board = records.get(id) || { id, title: titles.get(id) || id, objective: '' };
          openConfiguration(view.el, { title: t('board.configuration_title', 'Configuration · {board}', { board: board.title }), rows: () => [
            // after: nothing to re-read; the push repaints the board.
            { label: t('team_config.title', 'Title'), value: board.title, save: saveField(id, 'title'), after: () => {} },
            { label: t('collection.objective', 'Objective'), value: board.objective || '', kind: 'long', save: saveField(id, 'objective'), after: () => {} },
          ] });
        };
        return { ...view, menu: () => configurationGroup(configure) };
      },
    }),
  });
}
