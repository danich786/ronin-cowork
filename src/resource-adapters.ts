import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STOCK_DIR, entryValue, isKeyLine, resolveFiles, type Origin } from './resources.js';
import { storeDir } from './resources.js';

export type DefinitionKind =
  | 'desk_profiles' | 'lexicons' | 'installations' | 'behaviours' | 'capabilities'
  | 'templates/agents' | 'templates/teams';

export interface Definition {
  name: string;
  origin: Origin;
  shadowed: boolean;
  file: string;
  /** The whole file, for definitions whose body carries structure beyond the key lines. */
  text: string;
  get: (key: string) => string;
  has: (key: string) => boolean;
}

const isDefinitionFile = (n: string): boolean =>
  n.endsWith('.md') && !n.startsWith('.') && n !== 'README.md';

const isHidden = (d: Definition): boolean => /^yes$/i.test(d.get('hidden'));

export async function readDefinitions(kind: DefinitionKind): Promise<Definition[]> {
  const merged = new Map<string, Definition>();
  for (const file of await resolveFiles({
    stock: path.join(STOCK_DIR, kind),
    user: kind === 'behaviours' ? storeDir('ways') : path.join(storeDir('catalogs'), kind),
    include: isDefinitionFile,
    symlinks: true,
  })) {
    const lines = file.text.split('\n');
    if (!lines.some(isKeyLine)) {
      console.error(`[ronin] ${file.path}: no \`- **key:** value\` lines — not a definition, skipped.`);
      continue;
    }
    merged.set(file.name, {
      name: file.name,
      origin: file.origin,
      shadowed: file.shadowed,
      file: file.path,
      text: file.text,
      get: (key: string) => entryValue(lines, key),
      has: (key: string) => entryValue(lines, key) !== '',
    });
  }
  const rank = (d: Definition): number => {
    const n = Number(d.get('order'));
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
  const label = (d: Definition): string => (d.get('label') || d.name).toLowerCase();
  return [...merged.values()]
    .filter((d) => !isHidden(d))
    .sort((a, b) => rank(a) - rank(b) || label(a).localeCompare(label(b)));
}

export async function findDefinition(kind: DefinitionKind, token: string): Promise<Definition | undefined> {
  if (!token) return undefined;
  return (await readDefinitions(kind)).find((d) => d.name === token);
}

export const splitDefinitionList = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '—' && s !== '-');

interface Row {
  name: string;
  origin: Origin;
  shadowed: boolean;
  icon: string;
  label: string;
  blurb: string;
  ask: string;
  remit: string;
  credit?: { text: string; url: string };
}

export interface ContributionRow extends Pick<Row, 'name' | 'origin' | 'shadowed' | 'label' | 'blurb'> {
  reading: string[];
  reading_off: string[];
  sops: string[];
  macros: string[];
  actions: string[];
  tools: string[];
  mcp: string[];
  /** Services parts this contribution runs inside the server; loaded only while its switch is on. */
  parts: string[];
}

export interface InstallationRow extends ContributionRow {
  effect: 'system' | 'feature_provider';
  provides: string[];
  requires: string[];
}

export interface BehaviourRow extends ContributionRow { installation: string; page: string }

function credit(v: string): { text: string; url: string } | undefined {
  const m = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(v.trim());
  return m ? { text: m[1], url: m[2] } : undefined;
}

const row = (d: Definition): Row => ({
  name: d.name,
  origin: d.origin,
  shadowed: d.shadowed,
  icon: d.get('icon'),
  label: d.get('label') || d.name,
  blurb: d.get('blurb'),
  ask: d.get('ask'),
  remit: d.get('remit'),
  credit: credit(d.get('credit')),
});

const contribution = (d: Definition): ContributionRow => ({
  name: d.name, origin: d.origin, shadowed: d.shadowed,
  label: d.get('label') || d.name, blurb: d.get('blurb'),
  reading: splitDefinitionList(d.get('reading')), reading_off: splitDefinitionList(d.get('reading_off')),
  sops: splitDefinitionList(d.get('sops')), macros: splitDefinitionList(d.get('macros')),
  actions: splitDefinitionList(d.get('actions')), tools: splitDefinitionList(d.get('tools')),
  mcp: splitDefinitionList(d.get('mcp')), parts: splitDefinitionList(d.get('parts')),
});

export async function listInstallations(): Promise<InstallationRow[]> {
  return (await readDefinitions('installations')).map((d) => ({
    ...contribution(d),
    effect: d.get('effect') === 'system' ? 'system' : 'feature_provider',
    provides: splitDefinitionList(d.get('provides')),
    requires: splitDefinitionList(d.get('requires')),
  }));
}

export async function listBehaviours(): Promise<BehaviourRow[]> {
  return (await readDefinitions('behaviours')).map((d) => {
    const installation = d.get('installation').trim();
    return { ...contribution(d), installation: /^[\u2013\u2014-]$/.test(installation) ? '' : installation, page: d.file };
  });
}

const REACH = ['open', 'discuss', 'plan', 'execute'];
const RECRUIT = ['open', 'nobody', 'propose agents', 'staff agents'];
const OUTPUT = ['open', 'a plan', 'ideas', 'code', 'an artifact', 'the team', 'no code'];
const TEMPLATE_KINDS = ['coding', 'work', 'personal', 'household', 'social', 'school'];

export interface TemplateMandate { reach: string; recruit: string; output: string[] }

export interface TemplateBox extends Pick<Row, 'name' | 'origin' | 'shadowed' | 'label' | 'blurb'> {
  art: string;
  kinds: string[];
  behaviours: string[];
}

export interface AgentTemplateRow extends TemplateBox {
  brief: string;
  mandate: TemplateMandate | null;
  team_mode: string;
}

export interface TemplateAgentRow {
  name: string;
  instructions: string;
  mandate: TemplateMandate | null;
  team_lead: boolean;
  behaviours: string[];
}

export interface TeamTemplateRow extends TemplateBox {
  objective: string;
  agents: TemplateAgentRow[];
}

export function templateMandate(value: string): TemplateMandate | null {
  const [reach, recruit, outputText] = value.split('·').map((part) => part.trim());
  const output = outputText?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
  if (!REACH.includes(reach) || !RECRUIT.includes(recruit) || !output.length || output.some((part) => !OUTPUT.includes(part))) return null;
  return { reach, recruit, output };
}

const templateBox = (d: Definition): TemplateBox => ({
  name: d.name,
  origin: d.origin,
  shadowed: d.shadowed,
  label: d.get('label') || d.name,
  blurb: d.get('blurb'),
  art: d.get('art'),
  kinds: splitDefinitionList(d.get('kinds')).filter((kind) => TEMPLATE_KINDS.includes(kind)),
  behaviours: splitDefinitionList(d.get('behaviours')),
});

export async function listAgentTemplates(): Promise<AgentTemplateRow[]> {
  return (await readDefinitions('templates/agents')).map((d) => ({
    ...templateBox(d),
    brief: d.get('brief'),
    mandate: d.has('mandate') ? templateMandate(d.get('mandate')) : null,
    team_mode: d.get('team_mode') === 'new' ? 'new' : '',
  }));
}

export function parseTemplateAgents(raw: string): TemplateAgentRow[] {
  const at = raw.search(/^## agents\s*$/m);
  if (at === -1) return [];
  return raw
    .slice(at)
    .split(/^###\s+/m)
    .slice(1)
    .map((section) => {
      const lines = section.split('\n');
      const mandate = entryValue(lines, 'mandate');
      return {
        name: lines[0].trim(),
        instructions: entryValue(lines, 'instructions'),
        mandate: mandate ? templateMandate(mandate) : null,
        team_lead: /^yes$/i.test(entryValue(lines, 'team_lead')),
        behaviours: splitDefinitionList(entryValue(lines, 'behaviours')),
      };
    })
    .filter((row) => row.name);
}

export async function listTeamTemplates(): Promise<TeamTemplateRow[]> {
  const rows: TeamTemplateRow[] = [];
  for (const d of await readDefinitions('templates/teams')) {
    let raw = '';
    try {
      raw = await readFile(d.file, 'utf8');
    } catch {
      continue; // vanished mid-read, exactly as readDir treats it
    }
    rows.push({
      ...templateBox(d),
      objective: d.get('objective'),
      agents: parseTemplateAgents(raw),
    });
  }
  return rows;
}

export const contributionReading = (
  contributions: readonly { enabled: boolean; reading: string[]; reading_off: string[] }[],
): string[] => contributions.flatMap((contribution) => contribution.enabled ? contribution.reading : contribution.reading_off);
