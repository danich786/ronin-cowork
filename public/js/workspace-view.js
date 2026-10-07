/* part of the ronin-cowork client — see js/README.md */
/**
 * WORKSPACE — the thin tenant on the tenant frame (js/tenant-frame.js) for one workspace
 * folder; the route names it, the server narrows the reading to it. WS1 is the Teams and
 * boards in it (workspace-teams-surface.js, Phalanx C/D); WS2 its docs and repos
 * (workspace-docs-surface.js, Rows). Configuration is an item on WS1's メ opening the full
 * overlay with Grey form rows (title, remit, match, docs, plans; PUT /api/project-roots/:name,
 * each row its own save), seeded from the folder catalog the page holds (home.js). The tiles
 * of whoever is in it follow.
 */
import { createTenantFrame } from './tenant-frame.js';
import { createWorkspaceTeamsSurface, WORKSPACE_TEAMS_TYPE } from './workspace-teams-surface.js';
import { createWorkspaceDocsSurface, WORKSPACE_DOCS_TYPE } from './workspace-docs-surface.js';
import { openWorkspaceTab } from './workspace.js';
import { configurationGroup, openConfiguration } from './configuration-overlay.js';
import { loadProjects, projectData } from './home.js';
import { request } from './request.js';
import { t } from './lexicon.js';
import { WORKBENCH_PROFILES } from './workbench-catalog.js';

const list = (value) => (Array.isArray(value) ? value.join(', ') : String(value || ''));
// One field per save, as the store merges it; lists are typed as the store reads them, commas between.
const saveField = (name, field) => (value) => request(`/api/project-roots/${encodeURIComponent(name)}`, { method: 'PUT', json: { [field]: value } });

export function createWorkspaceView() {
  const bySeat = {};
  const docsBySeat = {};
  return createTenantFrame({
    key: 'workspace',
    profile: WORKBENCH_PROFILES.workspace,
    glyph: '⌂',
    label: () => t('next.workspace', 'Workspace'),
    name: (folder) => folder || t('next.workspace', 'Workspace'),
    homeCard: WORKSPACE_TEAMS_TYPE,
    firstOpen: () => ({ workspace1: WORKSPACE_TEAMS_TYPE, workspace2: WORKSPACE_DOCS_TYPE }),
    cards: (frame) => ({
      workspaceTeams: (seat) => {
        if (!bySeat[seat]) {
          const surface = createWorkspaceTeamsSurface({ folder: () => frame.param(), openTeam: (name) => openWorkspaceTab('team-next', name) });
          const configure = () => {
            const name = frame.param();
            const folder = (projectData || []).find((row) => row.name === name) || { name };
            const after = () => loadProjects();
            openConfiguration(surface.el, { title: t('workspace.configuration_title', 'Configuration · {folder}', { folder: folder.title || name }), rows: () => [
              { label: t('team_config.title', 'Title'), value: folder.title || '', save: saveField(name, 'title'), after },
              { label: t('workspace.remit', 'Remit'), value: folder.remit || '', kind: 'long', save: saveField(name, 'remit'), after },
              { label: t('workspace.match', 'Match'), value: list(folder.match), note: t('workspace.list_note', 'commas between'), save: saveField(name, 'match'), after },
              { label: t('workspace.docs', 'Docs'), value: list(folder.docs), note: t('workspace.list_note', 'commas between'), save: saveField(name, 'docs'), after },
              { label: t('workspace.plans', 'Plans'), value: list(folder.plans), note: t('workspace.list_note', 'commas between'), save: saveField(name, 'plans'), after },
            ] });
          };
          bySeat[seat] = { ...surface, menu: () => configurationGroup(configure) };
        }
        return bySeat[seat];
      },
      workspaceDocs: (seat) => {
        docsBySeat[seat] ||= createWorkspaceDocsSurface({ folder: () => frame.param() });
        return docsBySeat[seat];
      },
    }),
    destroy: () => { for (const surface of [...Object.values(bySeat), ...Object.values(docsBySeat)]) surface.destroy(); },
  });
}
