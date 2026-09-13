import type { ContributionRow, FeatureRow, InstallationRow } from './resource-adapters.js';

export type Switches = Record<string, boolean>;
export type CascadeLayer = 'installation' | 'campaign' | 'team' | 'agent' | 'conditional';

export interface ResolvedContribution extends ContributionRow {
  enabled: boolean;
  stated_by: CascadeLayer;
  required_by: string[];
}

export const switches = (value: unknown): Switches => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] =>
    /^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry[0]) && typeof entry[1] === 'boolean'));
};

export const names = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string =>
      typeof item === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(item)))]
  : [];

export function availableFeatures(installations: InstallationRow[], value: unknown, features: FeatureRow[]): string[] {
  const on = switches(value);
  const supplied = new Set<string>();
  for (const installation of installations) {
    if (on[installation.name] !== true) continue;
    if (installation.requires.some((required) => on[required] !== true)) continue;
    for (const feature of installation.provides) supplied.add(feature);
  }
  return features.filter((feature) => !feature.provider || supplied.has(feature.name)).map((feature) => feature.name);
}

export function resolveContributions(
  installations: InstallationRow[], installationValues: unknown, features: FeatureRow[], available: string[],
  campaignFeatures: unknown, teamFeatures?: unknown, agentFeatures?: unknown,
): { contributions: ResolvedContribution[]; selected: string[]; undelivered: string[]; feature_layer: CascadeLayer } {
  const on = switches(installationValues);
  const requested = names(agentFeatures ?? teamFeatures ?? campaignFeatures);
  const feature_layer: CascadeLayer = agentFeatures !== undefined ? 'agent' : teamFeatures !== undefined ? 'team' : 'campaign';
  const offered = new Set(available);
  const selected = requested.filter((name) => offered.has(name));
  const undelivered = requested.filter((name) => !offered.has(name));
  const system = installations.filter((item) => item.effect === 'system').map((item) => ({
    ...item, enabled: on[item.name] === true, stated_by: 'installation' as const, required_by: [] as string[],
    reading: on[item.name] === true ? item.reading : item.reading_off,
  }));
  const chosen = features.filter((item) => selected.includes(item.name)).map((item) => ({
    ...item, enabled: true, stated_by: feature_layer, required_by: [] as string[],
  }));
  return { contributions: [...system, ...chosen], selected, undelivered, feature_layer };
}
