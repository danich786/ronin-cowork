/* part of the ronin-cowork client — see js/README.md */
/**
 * THE TWO WORKBENCHES HOME'S DOORS OPEN (owner, 2026-10-19; PATTERNS.md Home): Models and
 * Workspaces — each a destination of its own, opened in the same tab, the bar reading
 * RoninCowork • Home • <door>, Home the way back (the Teams door opens the Cowork workbench,
 * cowork-view.js; owner, 2026-10-20). One shape for the two: the Kit workbench
 * on a profile of the door's surfaces (workbench-catalog.js), the door's surface seated in
 * Workspace 1 on first open. Models seats its own stones of providers (models-surface.js), a
 * stone dragged into a workspace or a selector card placing that provider whole; Workspaces
 * seats its own stones of folders (workspaces-surface.js) the same way, its three admin doors
 * dotted selector cards.
 */
import { WorkspaceKit } from './workspace-kit.js';
import { t } from './lexicon.js';
import { workbenchView } from './workspace-contract.js';
import { registerWorkbenchCatalog, WORKBENCH_PROFILES, WORKBENCH_TYPES } from './workbench-catalog.js';
import { createProviderSetupSessionMount } from './provider-setup-session.js';
import { loadProviderCatalog } from './form-steps.js';
import { createModelDefaults, createModelProvider, createModelRefresh, createModelStones, providerOffers } from './models-surface.js';
import { createGithubWorkspaceSetup } from './github-workspace-setup.js';
import { createFolder, createFolderClone, createFolderGithub, createFolderNew, createFolderStones, createRootsReading, folderOffers } from './workspaces-surface.js';
import { createWorkspaceAdd } from './workspace-add.js';
import { campaignById, loadCampaigns, normalizeSelection } from './campaigns.js';

const blank = (id) => WorkspaceKit.primitives.createBlankSurface(id.replace('workspace', 'Workspace ')).el;

/**
 * One door's workbench. `seat` is the type Workspace 1 holds on first open; `environment`
 * builds the surfaces' resident data over the bench; `cards` false leaves the selector
 * without cards; `loaded` is a read the seats are re-placed after (the folders need the
 * Campaign); `destroy` lets the surfaces go with the view.
 */
function doorWorkbench({ id, profile, label, seat, environment, cards = true, loaded = null, destroy = () => {} }) {
  registerWorkbenchCatalog();
  const { normalizeWorkbenchState } = WorkspaceKit.contract;
  let ctx = null, entered = false, bench = null;
  const save = () => ctx?.patchViewState(id, bench.snapshot());
  const reseat = () => {
    for (const [workspace, held] of Object.entries(bench.snapshot().seats)) {
      const type = typeof held === 'object' ? held.type : held;
      if (type) bench.place(type, workspace, typeof held === 'object' ? held : {});
    }
  };
  bench = WorkspaceKit.workbench.create({
    profile, tenant: { kind: id }, environment: environment({ bench: () => bench, entered: () => entered, ctx: () => ctx }),
    defaultNode: blank, label, ...(cards ? {} : { selectorFilter: () => false }), onStateChange: save, onPlacement: save,
  });
  return {
    el: bench.host, ...workbenchView(id, { header: { feedback: false } }), arrangement: bench.arrangement,
    title: () => label, place: () => label,
    mount: (_host, context) => { ctx = context; },
    enter: (context) => {
      ctx = context; entered = true;
      const { state: entry } = context.workbenchEntry({
        count: 2, selected: 'workspace1',
        arrangement: normalizeWorkbenchState(null, bench.declaration).arrangement,
        seats: { workspace1: seat },
      });
      const typed = normalizeWorkbenchState(entry, bench.declaration);
      bench.enter({ ...typed, ...entry });
      for (const workspace of bench.ids) {
        const held = typed.seats[workspace];
        const type = typeof held === 'object' ? held.type : held;
        if (WorkspaceKit.workbench.library.has(type)) bench.place(type, workspace, typeof held === 'object' ? held : {});
      }
      bench.refreshSelector(); save();
      if (loaded) void loaded().then(() => { if (entered) reseat(); });
    },
    leave: () => { entered = false; bench.leave(); },
    destroy: () => { entered = false; destroy(); bench.leave(); ctx = null; },
  };
}

/** Models: the stones of providers in Workspace 1, a provider whole where a stone is dropped or its card
 * placed, one card per provider; the sign-in tile mounted as on Setup. */
export function createModelsView() {
  const providerSessions = createProviderSetupSessionMount();
  const made = [];
  const keep = (surface) => { made.push(surface); return surface; };
  return doorWorkbench({
    id: 'models', profile: WORKBENCH_PROFILES.models, label: t('campaign_home.models', 'Models'), seat: WORKBENCH_TYPES.modelStones,
    loaded: loadProviderCatalog,
    environment: ({ bench }) => {
      const environment = {
        setupRuntime: null, mountProviderSetupSession: providerSessions.mountProviderSetupSession,
        providers: providerOffers,
        modelStones: (workspace) => keep(createModelStones({ workspace, detail: {}, environment, workbench: bench() })),
        modelRefresh: (workspace) => keep(createModelRefresh({ workspace, detail: {}, environment, workbench: bench() })),
        modelDefaults: () => createModelDefaults(),
        modelProvider: (workspace, detail) => keep(createModelProvider(detail.key, { workspace, detail, environment, workbench: bench() })),
      };
      return environment;
    },
    destroy: () => { for (const surface of made.splice(0)) surface.destroy?.(); providerSessions.destroyAll(); },
  });
}

/** Workspaces: the stones of folders in Workspace 1 over the Campaign this tab looks at, a folder whole where a
 * stone is dropped or its card placed, one card per folder; Add a workspace, GitHub CLI and Clone a repository
 * as dotted cards, the folder they add taking their workspace. One read of the folders for the whole bench. */
export function createWorkspacesView() {
  const campaign = (ctx) => campaignById(normalizeSelection(ctx()?.state?.campaignSelection).primary_campaign_id);
  const providerSessions = createProviderSetupSessionMount();
  const reading = createRootsReading();
  const made = [];
  const keep = (surface) => { made.push(surface); return surface; };
  let github = null;
  let cloneSeat = 'workspace2';
  return doorWorkbench({
    id: 'workspaces', profile: WORKBENCH_PROFILES.workspaces, label: t('campaign_home.workspaces', 'Workspaces'), seat: WORKBENCH_TYPES.folderStones,
    loaded: loadCampaigns,
    environment: ({ bench, ctx }) => {
      const campaignId = () => campaign(ctx)?.id || '';
      const placeFolder = (name, workspace) => bench().place(WORKBENCH_TYPES.folder, workspace, { key: name });
      const environment = {
        mountProviderSetupSession: providerSessions.mountProviderSetupSession,
        folders: () => folderOffers(reading),
        folderStones: () => keep(createFolderStones({ reading, campaignId, workbench: bench() })),
        folder: (_workspace, detail) => keep(createFolder(detail.key, { reading, campaignId })),
        folderNew: (workspace) => keep(createFolderNew({ reading, campaignId, placeFolder: (name) => placeFolder(name, workspace) })),
        folderAdd: (workspace) => keep(createWorkspaceAdd({ campaignId, placeFolder: async (name) => { await reading.read(); placeFolder(name, workspace); }, signIn: () => bench().place(WORKBENCH_TYPES.folderGithub, workspace === 'workspace1' ? 'workspace2' : 'workspace1') })),
        folderGithub: () => keep(createFolderGithub(github ??= boxes())),
        folderClone: (workspace) => { cloneSeat = workspace; return keep(createFolderClone(github ??= boxes())); },
      };
      const boxes = () => createGithubWorkspaceSetup({
        environment, workspace: 'workspace2',
        onCloned: async (root) => { await reading.read(); if (root?.name) placeFolder(root.name, cloneSeat); },
      });
      return environment;
    },
    destroy: () => { for (const surface of made.splice(0)) surface.destroy?.(); github?.destroy(); github = null; providerSessions.destroyAll(); },
  });
}
