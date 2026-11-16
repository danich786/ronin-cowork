/* part of the ronin-cowork client — see js/README.md */
/**
 * SETUP IS IRASSHAI'S WHILE SHE RUNS (owner, 2026-11-15; KAN-573). Irasshai is a hosted
 * office's onboarding Agent (Ronin Services, docs/irasshai.md). While her session is live:
 * - the Assist surface is her chat only: her conversation as Chat draws it (tile-transcript.js)
 *   and the message box under it, with no header tools, no terminal and no tile chrome;
 * - the selector's steps are her onboarding epic's tasks, in the template's order, a done one
 *   marked ✓; a press asks her to take that step, one line through the message queue, shown in
 *   her chat at once.
 * Her items are the store's pushed `epics` and `epicItems`; nothing here asks on a timer. With no
 * Irasshai, Setup is as it always was.
 *
 * OPEN IRASSHAI (KAN-615): a hosted office's Setup header carries one button. A press asks Ronin
 * Services (POST /api/irasshai/open) to open her: it goes to her if she runs, restores her from
 * her archive if she ended, launches her if she never ran. Once her session is live the pushed
 * session list seats her chat as above. Self-hosted the button is not there.
 *
 * THE INTEGRATIONS STEP (KAN-601) also seats the integrations panel, embedded, in Workspace 2: each
 * service she adds appears there with its state (key needed, key saved, sign in), with its paste
 * field or Sign in. It reads the list again each time one of her turns ends (her row's stance,
 * pushed on `home`, leaves working): no timer, no new watcher.
 */
import { S } from './state.js';
import { get } from './store.js';
import { request } from './request.js';
import { buildComposer } from './composer.js';
import { sendComposerMessage } from './composer-rules.js';
import { makeTileTranscript } from './tile-transcript.js';
import { WorkspaceKit } from './workspace-kit.js';
import { IRASSHAI, irasshaiIn } from './setup-journey.js';
import { createIntegrationsPanel } from './integrations-panel.js';
import { campaigns, loadCampaigns } from './campaigns.js';
import { subscribe } from './store.js';
import { t } from './lexicon.js';

export { IRASSHAI, irasshaiSteps, takeStepLine } from './setup-journey.js';
export const IRASSHAI_STEP_TYPE = 'setup.irasshai-step';
export const IRASSHAI_INTEGRATIONS_TYPE = 'setup.irasshai-integrations';
/** The onboarding task whose step seats the integrations panel. */
export const INTEGRATIONS_STEP = 'Integrations';
export const stepSurface = (step) => (step?.title === INTEGRATIONS_STEP ? IRASSHAI_INTEGRATIONS_TYPE : null);
/** Whether her session is live, as the pushed session list says. */
export const irasshaiLive = () => irasshaiIn(S.sessions);

/** The onboarding template's task titles, read once: the steps' order. */
let order = null;
export function irasshaiOrder(onRead) {
  if (order) return order;
  order = [];
  void request('/api/epic-templates').then((result) => {
    const onboarding = result.ok ? (result.data.templates || []).find((one) => one.name === 'onboarding') : null;
    if (onboarding) { order = onboarding.tasks.slice(); onRead?.(); }
  });
  return order;
}

/** The Open Irasshai button; `onOpen` runs once she is live (to bring her chat forward). */
export function createOpenIrasshai(onOpen) {
  const wrap = document.createElement('span');
  wrap.className = 'setup-open-irasshai';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'setup-open-irasshai-button';
  const label = t('setup.open_irasshai', 'Open Irasshai');
  button.textContent = label;
  const note = document.createElement('span');
  note.className = 'setup-open-irasshai-note';
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = t('setup.opening_irasshai', 'Opening Irasshai…');
    note.textContent = '';
    const result = await request('/api/irasshai/open', { method: 'POST' });
    button.disabled = false;
    button.textContent = label;
    if (result.ok) onOpen?.();
    else note.textContent = result.data?.error || result.message || '';
  });
  wrap.append(button, note);
  return wrap;
}

/** Her chat: the conversation and the message box, nothing else. */
export function createIrasshaiChat() {
  const el = document.createElement('div');
  el.className = 'tile transcript-on setup-irasshai-chat';
  const body = document.createElement('div');
  body.className = 'tile-body';
  body.dataset.surface = 'chat';
  el.append(body);
  const transcript = makeTileTranscript();
  body.append(transcript.el);
  const say = (text) => {
    const drop = transcript.pending(text);
    return sendComposerMessage(IRASSHAI, text).then((outcome) => { if (!outcome?.ok) drop(); return outcome; });
  };
  const composer = buildComposer(body, {
    activate: () => {}, clearOverlays: () => {}, connected: () => true, send: () => true,
    sendMessage: say, scrollToBottom: () => {},
  });
  composer.show(true);
  const stance = () => {
    const row = (get('home') || []).find((one) => one.name === IRASSHAI);
    transcript.setStance(row?.stance || '', row?.tool);
    transcript.rewatch();
  };
  return {
    el,
    say,
    show: () => { transcript.show(IRASSHAI, ''); stance(); },
    stance,
    hide: () => transcript.hide(),
    dispose: () => { transcript.dispose(); composer.dispose(); },
  };
}

/** Her steps in the selector: one card per task, read off `environment.irasshaiSteps()`. */
export function registerIrasshaiSteps() {
  if (WorkspaceKit.workbench.library.has(IRASSHAI_STEP_TYPE)) return IRASSHAI_STEP_TYPE;
  return WorkspaceKit.workbench.library.register({
    type: IRASSHAI_STEP_TYPE,
    header: 'surface',
    label: 'Step',
    discover: (_tenant, environment) => (environment?.irasshaiSteps?.() || []).map((step) => ({
      key: step.id, label: step.title, summary: '', mark: step.done ? '✓' : null,
      action: () => environment.takeIrasshaiStep(step),
    })),
    // Never placed: a press asks her. A drag lands the blank Tilespace.
    create: () => WorkspaceKit.primitives.createBlankSurface(),
  });
}

/** Her Integrations step's surface: the integrations panel, embedded, for the office's Campaign. */
export function registerIrasshaiIntegrations() {
  if (WorkspaceKit.workbench.library.has(IRASSHAI_INTEGRATIONS_TYPE)) return IRASSHAI_INTEGRATIONS_TYPE;
  return WorkspaceKit.workbench.library.register({
    type: IRASSHAI_INTEGRATIONS_TYPE,
    header: 'surface',
    label: () => t('integrations.title', 'Integrations'),
    create: () => {
      const surface = WorkspaceKit.primitives.createSurface({ label: t('integrations.title', 'Integrations'), className: 'setup-surface integrations-surface setup-irasshai-integrations' });
      const panel = createIntegrationsPanel(() => campaigns()[0] || null, { embedded: true });
      panel.el.querySelector('.integrations-heading')?.remove(); // the surface's header names it
      surface.content.append(panel.el);
      let working = false;
      const stop = subscribe('home', (rows) => {
        const now = (rows || []).find((one) => one.name === IRASSHAI)?.stance === 'working';
        if (working && !now) void panel.enter();
        working = now;
      });
      return {
        el: surface.el,
        show: async () => { await loadCampaigns(); await panel.enter(); },
        destroy: () => { stop(); panel.destroy(); },
      };
    },
  });
}
