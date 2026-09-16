/* A dumb four-region painter: its controller supplies one normalized canvas object. */
import { WorkspaceKit } from './workspace-kit.js';
import { GARDEN_REGION_KEYS } from './garden-canvas-model.js';

export const GARDEN_CANVAS_TYPE = 'setup.garden';

const node = (tag, cls = '', value = '') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value) el.textContent = value;
  return el;
};

export function createGardenCanvas({ onAction = () => {}, onMedia = () => {} } = {}) {
  const surface = WorkspaceKit.primitives.createSurface({ label: 'Garden canvas', className: 'garden-canvas' });
  surface.content.classList.add('garden-canvas-content');
  const scene = node('div', 'garden-canvas-scene');
  scene.setAttribute('aria-live', 'polite');
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mark.setAttribute('class', 'garden-canvas-mark');
  mark.setAttribute('viewBox', '0 0 480 96');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<g fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter"><path d="M0 76L54 45l35 20 49-34 38 31 51-45 35 38 43-29 35 40 54-28 39 22 47-31"/><path d="M0 88l73-24 45 18 65-31 45 27 64-30 52 29 68-25 68 20" opacity=".45"/><path d="M286 67h71l-12 13h-47zM322 67V29l27 30h-27"/></g><path d="M132 69l22-24 16 17 28-35 20 31-21-13-18 24zM385 64l17-20 13 13 18-23 18 27-17-11-15 19z" fill="currentColor" opacity=".24"/>';
  scene.append(mark);
  const regions = Object.fromEntries(GARDEN_REGION_KEYS.map((key) => {
    const region = node('section', `garden-region garden-region-${key}`);
    region.dataset.region = key;
    region.hidden = true;
    scene.append(region);
    return [key, region];
  }));

  const paintCopy = (items) => {
    for (const copy of items) {
      const item = node('article', 'garden-copy-item');
      item.dataset.copyId = copy.id;
      if (copy.eyebrow) item.append(node('p', 'garden-copy-eyebrow', copy.eyebrow));
      if (copy.heading) item.append(node('h2', 'garden-copy-heading', copy.heading));
      if (copy.body) item.append(node('p', 'garden-copy-body', copy.body));
      if (copy.stamp) item.append(node('time', 'garden-copy-stamp', copy.stamp));
      regions.copy.append(item);
    }
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
      button.addEventListener('click', () => onMedia(item));
      list.append(button);
    }
    regions.media.append(list);
  };

  const paint = (canvas) => {
    for (const region of Object.values(regions)) { region.replaceChildren(); region.hidden = true; }
    if (canvas?.copy) { paintCopy(canvas.copy); regions.copy.hidden = false; }
    if (canvas?.question) { paintQuestion(canvas.question); regions.question.hidden = false; }
    if (canvas?.cta) { paintCta(canvas.cta); regions.cta.hidden = false; }
    if (canvas?.media) { paintMedia(canvas.media); regions.media.hidden = false; }
    scene.dataset.canvas = canvas?.id || '';
    scene.dataset.empty = String(!canvas || GARDEN_REGION_KEYS.every((key) => !canvas[key]));
  };

  surface.content.append(scene);
  return { ...surface, paint };
}

export function registerGardenCanvas() {
  if (WorkspaceKit.workbench.library.has(GARDEN_CANVAS_TYPE)) return GARDEN_CANVAS_TYPE;
  return WorkspaceKit.workbench.library.register({
    type: GARDEN_CANVAS_TYPE,
    header: 'surface',
    label: 'Garden canvas',
    create: (context) => {
      const canvas = createGardenCanvas({
        onAction: (action) => context.environment?.openSetupAction?.(action),
        onMedia: (media) => context.environment?.openGardenMedia?.(media),
      });
      context.environment?.onGardenCanvas?.(canvas);
      return canvas;
    },
  });
}
