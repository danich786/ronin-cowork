/* part of the ronin-cowork client — see js/README.md */
/**
 * WORKSPACE — the thin tenant on the tenant frame (js/tenant-frame.js) for one workspace
 * folder; the route names it, the server narrows the reading to it. WS1 is the Teams and
 * boards in it (workspace-teams-surface.js, Phalanx C/D). Its docs and repos, the tiles of
 * whoever is in it and its configuration follow, one row of PATTERNS.md per hand-in.
 */
import { createTenantFrame } from './tenant-frame.js';
import { createWorkspaceTeamsSurface, WORKSPACE_TEAMS_TYPE } from './workspace-teams-surface.js';
import { openWorkspaceTab } from './workspace.js';
import { t } from './lexicon.js';
import { WORKBENCH_PROFILES } from './workbench-catalog.js';
import { DISMISSED_WORKSPACE } from './workspace-contract.js';

export function createWorkspaceView() {
  const bySeat = {};
  return createTenantFrame({
    key: 'workspace',
    profile: WORKBENCH_PROFILES.workspace,
    glyph: '⌂',
    label: () => t('next.workspace', 'Workspace'),
    name: (folder) => folder || t('next.workspace', 'Workspace'),
    homeCard: WORKSPACE_TEAMS_TYPE,
    firstOpen: () => ({ workspace1: WORKSPACE_TEAMS_TYPE, workspace2: DISMISSED_WORKSPACE }),
    cards: (frame) => ({
      workspaceTeams: (seat) => {
        bySeat[seat] ||= createWorkspaceTeamsSurface({ folder: () => frame.param(), openTeam: (name) => openWorkspaceTab('team-next', name) });
        return bySeat[seat];
      },
    }),
    destroy: () => { for (const surface of Object.values(bySeat)) surface.destroy(); },
  });
}
