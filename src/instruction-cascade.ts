import type { BehaviourRow, ContributionRow, InstallationRow } from './resource-adapters.js';

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
      typeof item === 'string' && item !== 'mandates' && /^[a-z0-9][a-z0-9_:-]{0,159}$/.test(item)))]
  : [];

export function availableBehaviours(installations: InstallationRow[], value: unknown, behaviours: BehaviourRow[]): string[] {
  const on = switches(value);
  const supplied = new Set<string>();
  for (const installation of installations) {
    if (on[installation.name] !== true) continue;
    if (installation.requires.some((required) => on[required] !== true)) continue;
    for (const behaviour of installation.provides) supplied.add(behaviour);
  }
  return behaviours.filter((behaviour) =>
    behaviour.scope === 'selected' &&
    (!behaviour.installation || supplied.has(behaviour.name))
  ).map((behaviour) => behaviour.name);
}

export function resolveContributions(
  installations: InstallationRow[], installationValues: unknown, behaviours: BehaviourRow[], available: string[],
  campaignBehaviours: unknown, teamBehaviours?: unknown, agentBehaviours?: unknown,
): { contributions: ResolvedContribution[]; selected: string[]; undelivered: string[]; behaviour_layer: CascadeLayer } {
  const on = switches(installationValues);
  const requested = names(agentBehaviours ?? teamBehaviours ?? campaignBehaviours);
  const behaviour_layer: CascadeLayer = agentBehaviours !== undefined ? 'agent' : teamBehaviours !== undefined ? 'team' : 'campaign';
  const offered = new Set(available);
  const selected = requested.filter((name) => offered.has(name));
  const undelivered = requested.filter((name) => !offered.has(name));
  const system = installations.filter((item) => item.effect === 'system').map((item) => ({
    ...item, enabled: on[item.name] === true, stated_by: 'installation' as const, required_by: [] as string[],
    reading: on[item.name] === true ? item.reading : item.reading_off,
  }));
  const chosen = behaviours.filter((item) => selected.includes(item.name)).map((item) => ({
    ...item, enabled: true, stated_by: behaviour_layer, required_by: [] as string[],
  }));
  return { contributions: [...system, ...chosen], selected, undelivered, behaviour_layer };
}
