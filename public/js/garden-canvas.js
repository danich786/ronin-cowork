/* A stable four-region work surface; scenario JSON supplies content, never layout. */
import { WorkspaceKit } from './workspace-kit.js';
import { GARDEN_REGION_KEYS, createGardenTransitionGate } from './garden-canvas-model.js';

export const GARDEN_CANVAS_TYPE = 'setup.garden';

const node = (tag, cls = '', value = '') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value) el.textContent = value;
  return el;
};

export function createGardenCanvas({ onAction = () => {} } = {}) {
  const surface = WorkspaceKit.primitives.createSurface({ label: 'Garden canvas', className: 'garden-canvas' });
  surface.content.classList.add('garden-canvas-content');
  const scene = node('div', 'garden-canvas-scene');
  scene.setAttribute('aria-live', 'polite');
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mark.setAttribute('class', 'garden-canvas-mark');
  mark.setAttribute('viewBox', '0 0 480 72');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<path d="M8 54c72-45 118 28 192-12s118 25 180-5 72 5 92-9" fill="none" stroke="currentColor"/><circle cx="410" cy="20" r="12" fill="none" stroke="currentColor"/><path d="M66 58c18-16 42-16 58 0zM286 56c12-11 31-11 44 0z" fill="currentColor" opacity=".32"/>';
  scene.append(mark);
  const regions = Object.fromEntries(GARDEN_REGION_KEYS.map((key) => {
    const region = node('section', `garden-region garden-region-${key}`);
    region.dataset.region = key;
    region.hidden = true;
    scene.append(region);
    return [key, region];
  }));

  const overlay = node('div', 'garden-media-overlay');
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Media');
  const close = node('button', 'garden-media-close', '×');
  close.type = 'button'; close.setAttribute('aria-label', 'Close media');
  const mediaBody = node('div', 'garden-media-body');
  overlay.append(close, mediaBody);
  let mediaOpener = null;
  const closeMedia = () => {
    if (overlay.hidden) return;
    mediaBody.replaceChildren();
    overlay.hidden = true;
    mediaOpener?.focus();
    mediaOpener = null;
  };
  close.addEventListener('click', closeMedia);
  overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) { event.preventDefault(); closeMedia(); } });
  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeMedia(); } });

  const openMedia = (item, opener) => {
    mediaOpener = opener;
    mediaBody.replaceChildren();
    const title = node('h2', '', item.label);
    const external = node('a', 'garden-media-external', 'Open separately ↗');
    external.href = item.src; external.target = '_blank'; external.rel = 'noopener';
    let viewer;
    if (item.kind === 'video') {
      viewer = node('video', 'garden-media-video');
      viewer.controls = true; viewer.preload = 'metadata'; viewer.src = item.src;
    } else {
      viewer = node('iframe', 'garden-media-frame');
      viewer.title = item.label; viewer.src = item.src;
      viewer.setAttribute('sandbox', 'allow-same-origin');
    }
    mediaBody.append(title, external, viewer);
    overlay.hidden = false;
    close.focus();
  };

  const paintCopy = (copy) => {
    if (copy.eyebrow) regions.copy.append(node('p', 'garden-copy-eyebrow', copy.eyebrow));
    if (copy.heading) regions.copy.append(node('h2', 'garden-copy-heading', copy.heading));
    if (copy.body) regions.copy.append(node('p', 'garden-copy-body', copy.body));
  };
  const paintQuestion = (question) => {
    const label = node('label', 'garden-question-label', question.prompt);
    const input = node(question.kind === 'textarea' ? 'textarea' : 'input', 'garden-question-input');
    input.name = question.name; input.placeholder = question.placeholder;
    if (question.kind === 'text') input.type = 'text';
    label.append(input); regions.question.append(label);
  };
  const paintCta = (cta) => {
    const button = node('button', 'garden-cta', cta.label);
    button.type = 'button'; button.addEventListener('click', () => onAction(cta.action));
    regions.cta.append(button);
  };
  const paintMedia = (items) => {
    const list = node('div', 'garden-media-list');
    for (const item of items) {
      const button = node('button', 'garden-media-choice');
      button.type = 'button';
      button.append(node('strong', '', item.label));
      if (item.description) button.append(node('span', '', item.description));
      button.addEventListener('click', () => openMedia(item, button));
      list.append(button);
    }
    regions.media.append(list);
  };

  const transition = createGardenTransitionGate((scenarioId, content) => {
    closeMedia();
    for (const region of Object.values(regions)) { region.replaceChildren(); region.hidden = true; }
    const next = content?.scenarios?.[scenarioId] || null;
    if (next?.copy) { paintCopy(next.copy); regions.copy.hidden = false; }
    if (next?.question) { paintQuestion(next.question); regions.question.hidden = false; }
    if (next?.cta) { paintCta(next.cta); regions.cta.hidden = false; }
    if (next?.media) { paintMedia(next.media); regions.media.hidden = false; }
    scene.dataset.scenario = scenarioId || '';
    scene.dataset.empty = String(!next || GARDEN_REGION_KEYS.every((key) => !next[key]));
  });

  surface.content.append(scene, overlay);
  return { ...surface, select: transition.select, closeMedia, paintCount: transition.count };
}

export function registerGardenCanvas() {
  if (WorkspaceKit.workbench.library.has(GARDEN_CANVAS_TYPE)) return GARDEN_CANVAS_TYPE;
  return WorkspaceKit.workbench.library.register({
    type: GARDEN_CANVAS_TYPE,
    header: 'surface',
    label: 'Garden canvas',
    create: (context) => {
      const canvas = createGardenCanvas({ onAction: (action) => context.environment?.openSetupAction?.(action) });
      context.environment?.onGardenCanvas?.(canvas);
      return canvas;
    },
  });
}
