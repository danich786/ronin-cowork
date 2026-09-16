/* Versioned content boundary for the reusable garden canvas. */
export const GARDEN_CANVAS_VERSION = 1;
export const GARDEN_REGION_KEYS = Object.freeze(['question', 'cta', 'copy', 'media']);

const text = (value) => typeof value === 'string' ? value.trim() : '';
const enabled = (value) => value && typeof value === 'object' && value.enabled !== false;
const safeAction = (value) => /^[a-z][a-z0-9.-]*$/.test(text(value)) ? text(value) : '';
const safeSource = (value) => {
  const source = text(value);
  if (!source || /^(?:javascript|data):/i.test(source)) return '';
  return source;
};

const normalizeQuestion = (value) => {
  if (!enabled(value) || !text(value.prompt)) return null;
  const kind = ['text', 'textarea'].includes(value.kind) ? value.kind : 'text';
  return Object.freeze({ prompt: text(value.prompt), kind, placeholder: text(value.placeholder), name: text(value.name) || 'answer' });
};

const normalizeCta = (value) => {
  const action = enabled(value) ? safeAction(value.action) : '';
  const label = enabled(value) ? text(value.label) : '';
  return action && label ? Object.freeze({ action, label }) : null;
};

const normalizeCopy = (value) => {
  if (!enabled(value)) return null;
  const copy = { eyebrow: text(value.eyebrow), heading: text(value.heading), body: text(value.body) };
  return Object.values(copy).some(Boolean) ? Object.freeze(copy) : null;
};

const normalizeMedia = (value) => {
  const rows = Array.isArray(value) ? value : enabled(value) && Array.isArray(value.items) ? value.items : [];
  const items = rows.flatMap((item) => {
    const kind = enabled(item) && ['doc', 'url', 'video'].includes(item.kind) ? item.kind : '';
    const src = kind ? safeSource(item.src) : '';
    if (!kind || !src || !text(item.label)) return [];
    return [Object.freeze({ kind, src, label: text(item.label), description: text(item.description) })];
  });
  return items.length ? Object.freeze(items) : null;
};

export function normalizeGardenCanvasCatalog(value) {
  if (!value || value.version !== GARDEN_CANVAS_VERSION || !value.scenarios || typeof value.scenarios !== 'object') {
    throw new Error(`garden canvas content must use version ${GARDEN_CANVAS_VERSION}`);
  }
  const scenarios = {};
  for (const [id, raw] of Object.entries(value.scenarios)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !raw || typeof raw !== 'object') continue;
    scenarios[id] = Object.freeze({
      question: normalizeQuestion(raw.question),
      cta: normalizeCta(raw.cta),
      copy: normalizeCopy(raw.copy),
      media: normalizeMedia(raw.media),
    });
  }
  return Object.freeze({ version: GARDEN_CANVAS_VERSION, scenarios: Object.freeze(scenarios) });
}

export function createGardenTransitionGate(apply) {
  if (typeof apply !== 'function') throw new TypeError('garden transition gate needs an apply function');
  let appliedToken = null;
  let count = 0;
  return Object.freeze({
    select(scenarioId, content, transitionToken) {
      if (transitionToken === undefined || transitionToken === null) throw new Error('garden canvas selection needs a transition token');
      if (Object.is(appliedToken, transitionToken)) return false;
      appliedToken = transitionToken;
      apply(scenarioId, content);
      count += 1;
      return true;
    },
    count: () => count,
  });
}
