/* part of the ronin-cowork client — see js/README.md */
/** The three-state projection of a feature-provider installation onto its two stored records. */
export function featureProviderState(installation, installations, defaultFeatures) {
  if (installations?.[installation.name] !== true) return 'off';
  const provided = Array.isArray(installation.provides) ? installation.provides : [];
  const defaults = Array.isArray(defaultFeatures) ? defaultFeatures : [];
  return provided.length && provided.every((name) => defaults.includes(name)) ? 'all' : 'on';
}

export function applyFeatureProviderState(installation, answer, installations, defaults) {
  const provided = new Set(Array.isArray(installation.provides) ? installation.provides : []);
  const currentFeatures = Array.isArray(defaults?.features) ? defaults.features : [];
  const kept = currentFeatures.filter((name) => !provided.has(name));
  return {
    installations: { ...(installations || {}), [installation.name]: answer !== 'off' },
    defaults: { ...(defaults || {}), features: answer === 'all' ? [...kept, ...provided] : kept },
  };
}
