/* Ronin Setup 2 — a deliberately small developer-only workbench. */
import { WorkspaceKit } from './workspace-kit.js';
import { SETUP_SURFACE_TYPES, registerSetupSurfaces } from './setup-surfaces.js';
import { createProviderSetupSessionMount } from './provider-setup-session.js';
import { request } from './request.js';
import { SETUP_SCENES } from './setup-journey.js';
import { GARDEN_CANVAS_TYPE, registerGardenCanvas } from './garden-canvas.js';
import { normalizeGardenCanvasCatalog } from './garden-canvas-model.js';

const PROFILE = 'setup2';
// Release toggles: unfinished programs stay out of Setup without changing the workbench.
export const SETUP2_FEATURES = Object.freeze({ bounty: false });
const SCENES = Object.freeze(SETUP_SCENES
  .filter((scene) => SETUP2_FEATURES.bounty || scene.type !== SETUP_SURFACE_TYPES.bounty)
  .map((scene, index) => Object.freeze({ ...scene, number: index + 1 })));
const ORDER = Object.freeze(SCENES.map((scene) => scene.type));
const ARRANGEMENT = Object.freeze({
  order: Object.freeze(['workspace1', 'selector', 'workspace2']),
  hidden: Object.freeze([]),
  widths: Object.freeze({ workspace1: 34, selector: 18, workspace2: 48 }),
});
const GARDEN_CONTENT_URL = '/content/setup-garden.v1.json';

function registerSetup2Workbench() {
  registerSetupSurfaces();
  registerGardenCanvas();
  return WorkspaceKit.workbench.profiles.define(PROFILE, [GARDEN_CANVAS_TYPE, ...ORDER]);
}

export function createSetup2View() {
  registerSetup2Workbench();
  let ctx = null;
  let bench = null;
  let runtime = null;
  let garden = null;
  let gardenContent = null;
  let paintedSceneId = null;
  let sceneOverride = 0;
  const providerSessions = createProviderSetupSessionMount();
  let kinds = ['build'];
  const blank = (id) => WorkspaceKit.primitives.createBlankSurface(id.replace('workspace', 'Workspace ')).el;
  const environment = {
    setupRuntime: null,
    onSetupRuntime: (next) => { runtime = next; environment.setupRuntime = next; },
    kinds: { get: () => [...kinds], hydrate: () => { kinds = ['build']; }, set: () => { kinds = ['build']; } },
    setPathNote: (path_note) => request('/api/setup/preferences', { method: 'PATCH', json: { path_note } }),
    setIdentityChoice: (identity_choice) => request('/api/setup/preferences', { method: 'PATCH', json: { identity_choice } }),
    mountProviderSetupSession: providerSessions.mountProviderSetupSession,
    showNewSession: (prompt) => { ctx?.patchViewState('launch', { prompt: String(prompt || '') }); ctx?.navigate('launch'); },
    openLaunchForm: () => ctx?.navigate('launch'),
    openTemplateLaunchForm: () => ctx?.navigate('launch'),
    onGardenCanvas: (next) => {
      garden = next;
      paintedSceneId = null;
      selectGarden(activeScene());
    },
    openGardenMedia: async (item) => {
      if (!garden) return;
      if (item.kind !== 'doc') { garden.showMedia({ label: item.label, kind: item.kind, src: item.src }); return; }
      const query = new URLSearchParams({ root: item.root, path: item.path });
      const result = await request('/api/file?' + query.toString());
      garden.showMedia({ label: item.label, kind: item.kind, text: result.ok ? result.data.text || '' : result.message });
    },
    openSetupAction: (action) => {
      const scene = SCENES.find((candidate) => candidate.type === action);
      if (!scene) return;
      sceneOverride = scene.number;
      open(scene.number);
    },
  };
  const save = () => ctx?.patchViewState('setup2', { ...bench.snapshot(), sceneOverride });
  const sceneIndex = document.createElement('span');
  sceneIndex.className = 'setup-scene-index';
  sceneIndex.setAttribute('aria-label', 'Setup steps');
  const sceneButtons = [];
  const automaticScene = () => Number(runtime?.activated_count || 0) > 0
    ? SCENES.find((scene) => scene.type === SETUP_SURFACE_TYPES.roots) || SCENES[0]
    : SCENES[0];
  const sceneAt = (number) => Number(number) > 0 ? SCENES[Number(number) - 1] || automaticScene() : automaticScene();
  const activeScene = () => sceneAt(sceneOverride);
  const selectGarden = (scene) => {
    if (!garden || !gardenContent || !scene || paintedSceneId === scene.id) return false;
    const canvasId = gardenContent.scenarios[scene.id];
    garden.paint(gardenContent.canvases[canvasId] || null);
    paintedSceneId = scene.id;
    return true;
  };
  const paint = () => {
    const active = activeScene();
    for (const { button, number } of sceneButtons) {
      button.setAttribute('aria-pressed', String(number === sceneOverride));
      button.dataset.current = String(number > 0 && number === active.number);
    }
    for (const card of bench?.host.querySelectorAll('[data-workbench-offer-type]') || []) {
      delete card.dataset.sceneRelevant;
      const position = ORDER.indexOf(card.dataset.workbenchOfferType);
      card.dataset.stepState = position < active.number - 1 ? 'complete'
        : position === active.number - 1 ? 'current' : 'upcoming';
    }
  };
  const open = (number) => {
    const scene = sceneAt(number);
    selectGarden(scene);
    bench.place(scene.type, 'workspace2');
    bench.select('workspace2');
    paint();
    save();
  };
  const addStep = (number, label, title) => {
    const button = document.createElement('button');
    button.className = 'bar-toggle setup-scene-button';
    button.type = 'button'; button.textContent = label; button.title = title; button.setAttribute('aria-label', title);
    button.addEventListener('click', () => { sceneOverride = number; open(number); });
    sceneButtons.push({ button, number }); sceneIndex.append(button);
  };
  addStep(0, 'Auto', 'Open the recommended setup step');
  for (const scene of SCENES) addStep(scene.number, String(scene.number), `${scene.number}. ${scene.label}`);

  bench = WorkspaceKit.workbench.create({
    profile: PROFILE,
    tenant: { kind: 'setup' },
    environment,
    defaultNode: blank,
    label: 'Ronin Setup 2',
    title: () => 'Ronin Setup 2',
    selectorWorkspace: 'workspace2',
    selectorCurrent: true,
    selectorFilter: (type) => ORDER.includes(type),
    onSelectorRefresh: paint,
    onStateChange: save,
    onPlacement: (snapshot) => {
      const type = typeof snapshot?.seats?.workspace2 === 'string' ? snapshot.seats.workspace2 : snapshot?.seats?.workspace2?.type;
      const scene = SCENES.find((candidate) => candidate.type === type);
      if (scene) selectGarden(scene);
      save();
    },
  });
  bench.host.dataset.selectorDensity = 'thin';
  bench.host.querySelector('.wk-workbench-selector-cards')?.addEventListener('click', () => queueMicrotask(() => bench.select('workspace2')));

  return {
    el: bench.host,
    glyph: '人',
    hideFeedback: true,
    hideShapeControl: true,
    barActions: [sceneIndex],
    title: () => 'Ronin Setup 2',
    mount: (_host, context) => { ctx = context; },
    enter: async (context) => {
      ctx = context;
      if (!runtime) {
        const result = await request('/api/setup/runtime', { cache: 'no-store' });
        runtime = result.ok ? result.data : { providers: [], activated_count: 0 };
        environment.setupRuntime = runtime;
        environment.kinds.hydrate(['build']);
      }
      if (!gardenContent) {
        const result = await request(GARDEN_CONTENT_URL);
        gardenContent = normalizeGardenCanvasCatalog(result.ok ? result.data : { schema_version: 2, scenarios: {}, canvases: {} });
      }
      const stored = context.viewState('setup2') || {};
      sceneOverride = Number(stored.sceneOverride) >= 1 && Number(stored.sceneOverride) <= SCENES.length ? Number(stored.sceneOverride) : 0;
      bench.enter({ ...stored, count: 2, arrangement: { ...ARRANGEMENT, widths: stored.arrangement?.widths || ARRANGEMENT.widths } });
      bench.setCount(2);
      bench.place(GARDEN_CANVAS_TYPE, 'workspace1');
      paint();
      open(sceneOverride || automaticScene().number);
    },
    leave: () => bench.leave(),
    destroy: () => { providerSessions.destroyAll(); bench.leave(); ctx = null; },
  };
}
