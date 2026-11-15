/**
 * INTEGRATIONS, THE COMMON WAY (KAN-328; KAN-513). Every outside service a user brings is held
 * the same way, whether or not Ronin has a bridge for it (docs/architecture/brief.md,
 * Integrations and bridges):
 *
 *   the bridge    a behaviour with `when: integration:<name>` (catalog.ts catalogIntegrations)
 *   the keys      secrets in the store named `<name>-<key>`, asked with `secret ask` (secrets.ts)
 *   the link      each Workspace lists the integrations it uses (workspaces.ts)
 *
 * The list is the bridges plus any name a Workspace uses that has none. Each row is read live:
 * the Workspaces using it, whether a Services part of its name runs, and the secrets saved
 * under `<name>-` (names only, never a value).
 */
import { catalogIntegrations, readCatalog } from './catalog.js';
import { secretNames } from './secrets.js';
import { listWorkspaces } from './workspaces.js';

/** running: a Services part of the name is loaded; parked: on disk, not loaded; '': no such part. */
export type PartState = 'running' | 'parked' | '';

export interface IntegrationState {
  name: string;
  /** The bridge's title without "bridge"; the name when there is no bridge. */
  label: string;
  /** The bridge's seed; '' without one. */
  blurb: string;
  /** The bridge behaviour's id; '' is none. */
  bridge: string;
  part: PartState;
  /** The secrets saved under `<name>-`, names only. */
  secrets: string[];
  workspaces: string[];
}

export interface PartFacts { onDisk: string[]; loaded: string[] }

const partState = (name: string, parts: PartFacts): PartState =>
  parts.loaded.includes(name) ? 'running' : parts.onDisk.includes(name) ? 'parked' : '';

export async function integrationsState(campaign: string, parts: PartFacts): Promise<IntegrationState[]> {
  const [behaviours, workspaces, saved] = await Promise.all([readCatalog('behaviours'), listWorkspaces(campaign), secretNames()]);
  const bridges = catalogIntegrations({ behaviours });
  const used = workspaces.flatMap((w) => w.integrations.map((i) => i.provider));
  const names = [...bridges.map((b) => b.name), ...[...new Set(used)].filter((name) => !bridges.some((b) => b.name === name)).sort()];
  return names.map((name) => {
    const bridge = bridges.find((b) => b.name === name);
    return {
      name,
      label: bridge ? bridge.title.replace(/\s+bridge$/i, '') : name,
      blurb: bridge?.seed ?? '',
      bridge: bridge?.behaviour ?? '',
      part: partState(name, parts),
      secrets: saved.filter((one) => one.startsWith(`${name}-`)),
      workspaces: workspaces.filter((w) => w.integrations.some((i) => i.provider === name)).map((w) => w.name),
    };
  });
}
