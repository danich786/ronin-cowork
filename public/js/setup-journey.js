/** Setup is one developer path. Scenes name selector doors; they never reshape the workbench. */
export const SETUP_SCENES = Object.freeze([
  { id: 'provider', label: 'Model providers', type: 'setup.providers' },
  { id: 'register', label: 'Register (optional)', type: 'setup.register' },
  { id: 'workspace', label: 'Workspace folders', type: 'setup.roots' },
  { id: 'installations', label: 'Installations', type: 'setup.installations' },
  { id: 'bounty', label: 'Bounty Program', type: 'setup.bounty' },
  { id: 'launch', label: 'Launch', type: 'setup.launch-own' },
].map((scene, index) => Object.freeze({ ...scene, number: index + 1 })));

export function automaticSetupScene(runtime = {}) {
  return Number(runtime?.activated_count || 0) > 0 ? 3 : 1;
}

export function setupJourney(runtime = {}, sceneOverride = 0) {
  const requested = Number(sceneOverride);
  const number = Number.isInteger(requested) && requested >= 1 && requested <= SETUP_SCENES.length
    ? requested
    : automaticSetupScene(runtime);
  return SETUP_SCENES[number - 1];
}
