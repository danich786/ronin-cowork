export const SETUP_SCENES = Object.freeze([
  { id: 'provider', label: 'Provider', selector: false, visibleTypes: ['setup.providers'], seats: { workspace1: '', workspace2: 'setup.providers' } },
  { id: 'register', label: 'Register', selector: false, visibleTypes: ['setup.providers', 'setup.register'], seats: { workspace1: 'setup.providers', workspace2: 'setup.register' } },
  { id: 'tailored', label: 'Tailored', selector: true, visibleTypes: ['setup.roots', 'setup.installations'], seats: { workspace1: '', workspace2: 'setup.roots' } },
  { id: 'workspace', label: 'Workspace', selector: false, visibleTypes: ['setup.roots'], seats: { workspace1: '', workspace2: 'setup.roots' } },
  { id: 'installations', label: 'Installations', selector: false, visibleTypes: ['setup.installations'], seats: { workspace1: '', workspace2: 'setup.installations' } },
  { id: 'launch', label: 'Launch', selector: false, visibleTypes: ['setup.launch-own'], seats: { workspace1: '', workspace2: 'setup.launch-own' } },
  { id: 'ready', label: 'Ready', selector: true, visibleTypes: ['setup.providers', 'setup.register', 'setup.roots', 'setup.installations', 'setup.launch-own'], seats: { workspace1: 'setup.presets', workspace2: 'setup.launch-own' } },
].map((scene, index) => Object.freeze({ ...scene, number: index + 1, visibleTypes: Object.freeze(scene.visibleTypes), seats: Object.freeze(scene.seats) })));

export function automaticSetupScene(runtime = {}) {
  return Number(runtime?.activated_count || 0) === 0 ? 1 : 2;
}

/** Pure projection: facts choose Auto; an explicit view-only index chooses a review scene. */
export function setupJourney(runtime = {}, sceneOverride = 0) {
  const requested = Number(sceneOverride);
  const number = Number.isInteger(requested) && requested >= 1 && requested <= SETUP_SCENES.length
    ? requested
    : automaticSetupScene(runtime);
  return SETUP_SCENES[number - 1];
}
