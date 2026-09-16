/* Ronin Setup 2 — a deliberately small developer-only workbench. */
import { WorkspaceKit } from './workspace-kit.js';
import { SETUP_SURFACE_TYPES, registerSetupSurfaces } from './setup-surfaces.js';
import { createProviderSetupSessionMount } from './provider-setup-session.js';
import { request } from './request.js';
import { SETUP_SCENES } from './setup-journey.js';
import { GARDEN_CANVAS_TYPE, registerGardenCanvas } from './garden-canvas.js';
import { normalizeGardenCanvasCatalog } from './garden-canvas-model.js';
import { PRESETS_TYPE, createKindsPreference, registerPresetsSurface } from './presets.js';
import { launchPresetPlan, presetLaunchUrl } from './preset-launch.js';
import { reserveWorkspaceTab } from './workspace.js';

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
const GARDEN_CONTENT_URL = '/content/setup-garden.v2.json';

function registerSetup2Workbench() {
  registerSetupSurfaces();
  registerGardenCanvas();
  registerPresetsSurface();
  return WorkspaceKit.workbench.profiles.define(PROFILE, [GARDEN_CANVAS_TYPE, PRESETS_TYPE, ...ORDER]);
}

export function createSetup2View() {
  registerSetup2Workbench();
  let ctx = null;
  let bench = null;
  let runtime = null;
  let garden = null;
  let gardenContent = null;
  let providerSurface = null;
  let paintedSceneId = null;
  let completionLoaded = false;
  let completion = { registered: false, github: false };
  let sceneOverride = 1;
  const providerSessions = createProviderSetupSessionMount();
  const kinds = createKindsPreference(globalThis.localStorage, (next) => request('/api/setup/preferences', { method: 'PATCH', json: { kinds: next } }));
  const nextAction = WorkspaceKit.primitives.createAction({ label: 'Next', kind: 'primary', action: () => advance() });
  nextAction.el.classList.add('setup-next');
  const blank = (id) => WorkspaceKit.primitives.createBlankSurface(id.replace('workspace', 'Workspace ')).el;
  const environment = {
    setup2OnboardingExtras: true,
    onGithubAuthenticated: () => { completion.github = true; paint(); },
    setupRuntime: null,
    onSetupRuntime: (next) => { runtime = next; environment.setupRuntime = next; paint(); },
    kinds,
    runtime: () => runtime || {},
    launch: launchPresetPlan,
    launchUrl: presetLaunchUrl,
    reserveLaunchTab: reserveWorkspaceTab,
    setPathNote: (path_note) => request('/api/setup/preferences', { method: 'PATCH', json: { path_note } }),
    setIdentityChoice: (identity_choice) => request('/api/setup/preferences', { method: 'PATCH', json: { identity_choice } }),
    mountProviderSetupSession: providerSessions.mountProviderSetupSession,
    showNewSession: (prompt) => { ctx?.patchViewState('launch', { prompt: String(prompt || '') }); ctx?.navigate('launch'); },
    openLaunchForm: () => ctx?.navigate('launch'),
    onGardenCanvas: (next) => {
      garden = next;
      garden.controls.hidden = false;
      garden.controls.replaceChildren(nextAction.el);
      paintedSceneId = null;
      selectGarden(activeScene());
    },
    onProviderSurface: (next) => { providerSurface = next; },
    openGardenMedia: async (item) => {
      if (!garden) return;
      if (item.kind !== 'doc') { garden.showMedia({ label: item.label, kind: item.kind, src: item.src }); return; }
      const query = new URLSearchParams({ root: item.root, path: item.path });
      const result = await request('/api/file?' + query.toString());
      garden.showMedia({ label: item.label, kind: item.kind, text: result.ok ? result.data.text || '' : result.message });
    },
    openSetupAction: (action) => {
      if (action === 'setup.providers.choose') {
        const scene = SCENES.find((candidate) => candidate.type === SETUP_SURFACE_TYPES.providers);
        if (!scene) return;
        sceneOverride = scene.number;
        open(scene.number);
        providerSurface?.openFirst();
        flashSelector(scene.type);
        return;
      }
      const scene = SCENES.find((candidate) => candidate.type === action);
      if (!scene) return;
      sceneOverride = scene.number;
      open(scene.number);
    },
  };
  const save = () => ctx?.patchViewState('setup2', { ...bench.snapshot(), sceneOverride });
  const defaultScene = () => SCENES.find((scene) => !sceneComplete(scene)) || SCENES[SCENES.length - 1];
  const sceneAt = (number) => SCENES[Number(number) - 1] || defaultScene();
  const activeScene = () => sceneAt(sceneOverride);
  const sceneComplete = (scene) => {
    if (scene.type === SETUP_SURFACE_TYPES.providers) return Number(runtime?.activated_count || 0) > 0;
    if (scene.type === SETUP_SURFACE_TYPES.register) return completion.registered;
    if (scene.type === SETUP_SURFACE_TYPES.roots) return completion.github || Boolean(runtime?.roots?.length);
    if (scene.type === SETUP_SURFACE_TYPES.installations) return Boolean(runtime?.services?.active || runtime?.services?.activated || runtime?.services?.installed);
    return false;
  };
  const flashSelector = (type) => {
    const card = bench?.host.querySelector(`[data-workbench-offer-type="${type}"]`);
    if (!card) return;
    card.classList.remove('setup-selector-pulse');
    void card.offsetWidth;
    card.classList.add('setup-selector-pulse');
    card.addEventListener('animationend', () => card.classList.remove('setup-selector-pulse'), { once: true });
  };
  const selectGarden = (scene) => {
    if (!garden || !gardenContent || !scene || paintedSceneId === scene.id) return false;
    garden.paint(gardenContent.canvases[scene.canvas] || null);
    paintedSceneId = scene.id;
    return true;
  };
  const paint = () => {
    const active = activeScene();
    nextAction.el.hidden = active.number >= SCENES.length;
    for (const card of bench?.host.querySelectorAll('[data-workbench-offer-type]') || []) {
      delete card.dataset.sceneRelevant;
      const position = ORDER.indexOf(card.dataset.workbenchOfferType);
      const scene = SCENES[position];
      if (scene?.id === active.id) card.setAttribute('aria-current', 'page');
      else card.removeAttribute('aria-current');
      card.dataset.complete = String(Boolean(scene && sceneComplete(scene)));
      card.dataset.stepState = position === active.number - 1 ? 'current' : 'upcoming';
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
  function advance() {
    const next = SCENES[activeScene().number];
    if (!next) return;
    sceneOverride = next.number;
    open(next.number);
  }

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
      if (scene) {
        sceneOverride = scene.number;
        selectGarden(scene);
        paint();
      }
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
    title: () => 'Ronin Setup 2',
    mount: (_host, context) => { ctx = context; },
    enter: async (context) => {
      ctx = context;
      if (!runtime) {
        const result = await request('/api/setup/runtime', { cache: 'no-store' });
        runtime = result.ok ? result.data : { providers: [], activated_count: 0 };
        environment.setupRuntime = runtime;
        environment.kinds.hydrate(runtime?.preferences?.kinds?.length ? runtime.preferences.kinds : ['build']);
      }
      if (!completionLoaded) {
        const [registration, github] = await Promise.all([
          request('/api/setup/registration', { cache: 'no-store' }),
          request('/api/setup/github', { cache: 'no-store' }),
        ]);
        completion = {
          registered: registration.ok && registration.data?.registered === true,
          github: github.ok && github.data?.authenticated === true,
        };
        completionLoaded = true;
      }
      if (!gardenContent) {
        const result = await request(GARDEN_CONTENT_URL);
        gardenContent = normalizeGardenCanvasCatalog(result.ok ? result.data : { schema_version: 2, canvases: {} });
      }
      const stored = context.viewState('setup2') || {};
      sceneOverride = defaultScene().number;
      bench.enter({ ...stored, count: 2, arrangement: { ...ARRANGEMENT, widths: stored.arrangement?.widths || ARRANGEMENT.widths } });
      bench.setCount(2);
      bench.place(GARDEN_CANVAS_TYPE, 'workspace1');
      paint();
      open(sceneOverride);
    },
    leave: () => bench.leave(),
    destroy: () => { providerSessions.destroyAll(); bench.leave(); ctx = null; },
  };
}
