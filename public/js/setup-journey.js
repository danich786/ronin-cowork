/** Setup is one developer path. Scenes name selector doors; they never reshape the workbench. */
export const SETUP_SCENES = Object.freeze([
  { id: 'provider', label: 'Model providers', type: 'setup.providers', canvas: 'library.setup.provider-welcome' },
  { id: 'register', label: 'Register (optional)', type: 'setup.register', canvas: 'library.setup.register' },
  { id: 'workspace', label: 'Workspace folders', type: 'setup.roots', canvas: 'library.setup.workspace' },
  { id: 'installations', label: 'Installations', type: 'setup.installations', canvas: 'library.setup.installations' },
  { id: 'password', label: 'Password', type: 'machine.password', canvas: 'library.setup.password' },
  { id: 'bounty', label: 'Bounty Program', type: 'setup.bounty', canvas: 'library.setup.bounty' },
  { id: 'launch', label: 'Launch', type: 'setup.launch-own', canvas: 'library.setup.launch' },
].map((scene, index) => Object.freeze({ ...scene, number: index + 1 })));

/* IRASSHAI'S STEPS (KAN-573; setup-irasshai.js): while she runs, Setup's steps are her onboarding
   epic's tasks instead of the scenes above. */
export const IRASSHAI = 'irasshai';
const HELD = `agent:${IRASSHAI}`;

/** Whether her session is in a session list (setup-irasshai.js reads the pushed one). */
export const irasshaiIn = (sessions) => (sessions || []).some((session) => session?.name === IRASSHAI);

const holds = (item) => item?.holder === HELD || (Array.isArray(item?.holders) && item.holders.includes(HELD));

/**
 * Her epic's tasks as Setup's steps: the epic she holds, its level-0 children, in `order` (the
 * template's task titles) with any other after them, each { id, title, done }.
 */
export function irasshaiSteps(epics, items, order = []) {
  const epic = (epics || []).find((one) => one?.level === 1 && holds(one) && one.status !== 'Done')
    || (epics || []).find((one) => one?.level === 1 && holds(one));
  if (!epic) return [];
  const rank = (title) => { const at = order.indexOf(title); return at < 0 ? order.length : at; };
  return (items || [])
    .filter((item) => item?.epic === epic.id && item.level === 0)
    .map((item, index) => ({ id: item.id, title: item.title || item.id, done: item.status === 'Done', index }))
    .sort((a, b) => rank(a.title) - rank(b.title) || a.index - b.index)
    .map(({ id, title, done }) => ({ id, title, done }));
}

/** The line a press sends her. */
export const takeStepLine = (step) => `Let's do ${step.title} (${step.id}).`;
