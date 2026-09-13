import type { InstallationRow } from './resource-adapters.js';
import { switches } from './instruction-cascade.js';

export interface ResolvedInstallation extends InstallationRow {
  enabled: boolean;
}

export function resolveInstallations(catalog: InstallationRow[], value: unknown): ResolvedInstallation[] {
  const selected = switches(value);
  return catalog.map((installation) => ({
    ...installation,
    enabled: selected[installation.name] === true,
  }));
}
