export const SETUP_SCENES = Object.freeze([
  { id: 'provider', label: 'Provider', selector: false, visibleTypes: ['setup.providers'], seats: { workspace1: '', workspace2: 'setup.providers' } },
  { id: 'register', label: 'Register', selector: true, visibleTypes: ['setup.providers', 'setup.register'], seats: { workspace1: 'setup.providers', workspace2: 'setup.register' } },
  { id: 'tailored', label: 'Tailored setup', selector: true, visibleTypes: ['setup.roots', 'setup.installations', 'setup.launch-own'], seats: { workspace1: 'setup.roots', workspace2: 'setup.installations' } },
  { id: 'workspace', label: 'Workspace folders', selector: true, visibleTypes: ['setup.roots', 'setup.installations'], seats: { workspace1: '', workspace2: 'setup.roots' } },
  { id: 'installations', label: 'Installations', selector: true, visibleTypes: ['setup.roots', 'setup.installations'], seats: { workspace1: 'setup.roots', workspace2: 'setup.installations' } },
  { id: 'launch', label: 'Choose a start', selector: true, visibleTypes: ['setup.launch-own'], seats: { workspace1: 'setup.presets', workspace2: 'setup.launch-own' } },
  { id: 'ready', label: 'Ready', selector: true, visibleTypes: ['setup.providers', 'setup.register', 'setup.roots', 'setup.installations', 'setup.launch-own'], seats: { workspace1: 'setup.presets', workspace2: 'setup.launch-own' } },
].map((scene, index) => Object.freeze({ ...scene, number: index + 1, visibleTypes: Object.freeze(scene.visibleTypes), seats: Object.freeze(scene.seats) })));

export function automaticSetupScene(runtime = {}) {
  if (Number(runtime?.activated_count || 0) === 0) return 1;
  const preferences = runtime?.preferences || {};
  if (!(preferences.kinds || []).length || !preferences.identity_choice) return 2;
  return 3;
}

function projectedScene(number, runtime) {
  const scene = SETUP_SCENES[number - 1];
  if (number !== 3) return scene;
  const software = runtime?.preferences?.kinds?.[0] === 'build';
  return Object.freeze({
    ...scene,
    visibleTypes: Object.freeze(software ? ['setup.roots', 'setup.installations', 'setup.launch-own'] : ['setup.installations', 'setup.launch-own']),
    seats: Object.freeze(software
      ? { workspace1: 'setup.roots', workspace2: 'setup.installations' }
      : { workspace1: '', workspace2: 'setup.installations' }),
  });
}

/** Pure projection: facts choose Auto; an explicit view-only index chooses a review scene. */
export function setupJourney(runtime = {}, sceneOverride = 0) {
  const requested = Number(sceneOverride);
  const number = Number.isInteger(requested) && requested >= 1 && requested <= SETUP_SCENES.length
    ? requested
    : automaticSetupScene(runtime);
  return projectedScene(number, runtime);
}
