/* part of the ronin-cowork client — see js/README.md */
const bucket = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export function completeInstallationMap(catalog, stored) {
  const current = bucket(stored);
  return Object.fromEntries(catalog.map((installation) => [installation.name, current[installation.name] === true]));
}
