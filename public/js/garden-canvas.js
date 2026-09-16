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
  const surface = WorkspaceKit.primitives.createSurface({ label: 'Garden canvas', className: 'garden-canvas', header: false });
  surface.content.classList.add('garden-canvas-content');
  const scene = node('div', 'garden-canvas-scene');
  scene.setAttribute('aria-live', 'polite');
  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  mark.setAttribute('class', 'garden-canvas-mark');
  mark.setAttribute('viewBox', '0 0 900 180');
  mark.setAttribute('preserveAspectRatio', 'xMidYMax slice');
  mark.setAttribute('aria-hidden', 'true');
  mark.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="miter" stroke-linecap="square"><path d="M0 52H160L184 40H330L350 50H452L476 38H660L680 48H812L834 36H900" stroke-opacity=".1"/><path d="M0 78H70L102 62H228L248 72H360L386 59H580L604 71H772L798 58H900" stroke-opacity=".16"/><path d="M0 102H196L220 90H296L316 100H412L436 88H612L638 101H800L824 89H900" stroke-opacity=".23"/><path d="M0 124H900" stroke-opacity=".34"/><path d="M0 148H80L104 136H268L288 146H440L464 134H668L690 145H860L880 135H900" stroke-opacity=".28"/></g><path d="M0 168H128L144 160H396L414 169H700L720 159H900V180H0Z" fill="currentColor" fill-opacity=".11"/><path d="M0 168H128L144 160H396L414 169H700L720 159H900" fill="none" stroke="currentColor" stroke-width="1.25" stroke-opacity=".46" stroke-linejoin="miter" stroke-linecap="square"/>';
  const hito = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  hito.setAttribute('class', 'garden-canvas-hito');
  hito.setAttribute('viewBox', '24 18 75 72');
  hito.setAttribute('aria-hidden', 'true');
  hito.innerHTML = '<g fill="currentColor"><path d="M52.3 21.8c3.9-4.3 10.4-4.1 14.5-.5l3.8 3.4c2 1.8 2.1 4.4.5 6.7-5.4 7.8-8.7 15.8-12.1 23.7-6.1 14.4-15.7 24.7-29.4 32.7-3.7 2.2-7.4 1.4-8.8-1.6-1.2-2.6.4-5 3.7-7.4 11.2-8.1 19.1-17.7 24-29.2 3.8-9 6.8-17.1 5.1-22.4l-1.8-3c-.5-.8-.3-1.7.5-2.4z"/><path d="M54.2 50c2.8-2.5 6.3-2.1 9.3 1.2 9.9 11.1 19.8 20 32.2 27.2 3.7 2.1 4.6 5 2.2 7.4-1.8 1.8-5 2.5-9.2 1.8-13.2-2.4-24.7-12.4-36.3-25.8-3.7-4.2-2.9-8.6 1.8-11.8z"/></g>';
  scene.append(mark, hito);
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
      if (copy.kind) item.dataset.kind = copy.kind;
      if (copy.age) item.dataset.age = copy.age;
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
      button.dataset.kind = item.kind;
      if (item.id) button.dataset.mediaId = item.id;
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
