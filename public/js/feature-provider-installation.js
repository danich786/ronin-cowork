/* part of the ronin-cowork client — see js/README.md */
/** The three-state projection of a provider installation onto installation and behaviour records. */
export function featureProviderState(installation, installations, defaultBehaviours) {
  if (installations?.[installation.name] !== true) return 'off';
  const provided = Array.isArray(installation.provides) ? installation.provides : [];
  const defaults = Array.isArray(defaultBehaviours) ? defaultBehaviours : [];
  return provided.length && provided.every((name) => defaults.includes(name)) ? 'all' : 'on';
}

export function applyFeatureProviderState(installation, answer, installations, defaults) {
  const provided = new Set(Array.isArray(installation.provides) ? installation.provides : []);
  const current = Array.isArray(defaults?.behaviours) ? defaults.behaviours : [];
  const kept = current.filter((name) => !provided.has(name));
  return {
    installations: { ...(installations || {}), [installation.name]: answer !== 'off' },
    defaults: { ...(defaults || {}), behaviours: answer === 'all' ? [...kept, ...provided] : kept },
  };
}
