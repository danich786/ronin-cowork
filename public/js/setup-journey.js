export const SETUP_SCENES = Object.freeze({ provider: 'provider', legacy: 'legacy' });

/** Pure projection: machine and onboarding facts decide the Setup furniture. */
export function setupJourney(runtime = {}) {
  if (Number(runtime?.preview_scene || 0) === 1 || Number(runtime?.activated_count || 0) === 0) return Object.freeze({
    id: SETUP_SCENES.provider,
    selector: false,
    visibleTypes: Object.freeze(['setup.providers']),
    seats: Object.freeze({ workspace1: '', workspace2: 'setup.providers' }),
  });
  return Object.freeze({
    id: SETUP_SCENES.legacy,
    selector: true,
    visibleTypes: Object.freeze([
      'setup.providers', 'setup.register', 'setup.roots', 'setup.installations', 'setup.launch-own',
    ]),
    seats: Object.freeze({ workspace1: 'setup.presets' }),
  });
}
