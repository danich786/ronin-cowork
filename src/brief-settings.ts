/**
 * LAYERS AND BRIEF SETTINGS (wip/BRIEF_MODEL.md §6).
 *
 * The layers, widest first: user, Campaign, Workspace, Team, Agent. Each layer's own record
 * holds the same three lists, `brief: {add, block, only}`, plus `integrations` and `pm`:
 *
 *   user       ~/ronin/config/brief.json
 *   Campaign   campaign.config.{brief, integrations, pm}
 *   Workspace  the Workspace record's {brief, integrations, pm}
 *   Team       the Team roster's {brief, integrations, pm}
 *   Agent      the work record (composition-brief.json beside it)
 *
 * Integrations and project management only add down the layers: on at a layer is on below
 * it, and Jira on is project management on. Files in play: each header's `when:` and
 * `depth:`, then every layer's add (the higher depth holds), then every block, then each
 * screen (`only`), which covers facts, behaviours and tools: a behaviour let through brings
 * the tools that serve it. Hide, never guard: this decides only what
 * an Agent is told.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { BriefRecord, BriefSettings } from './brief-record.js';
import type { Catalog, CatalogFile, CatalogKind, Depth } from './catalog.js';
import { DEPTHS } from './catalog.js';
import { whenHolds } from './conditionals.js';
import { storeDir } from './resources.js';

export type LayerName = 'user' | 'campaign' | 'workspace' | 'team' | 'agent';
export const LAYERS: readonly LayerName[] = ['user', 'campaign', 'workspace', 'team', 'agent'];

/** What one layer's record holds. `pm` absent: this layer says nothing. */
export interface LayerSettings { brief: BriefSettings; integrations: string[]; pm?: boolean }
export interface Layer extends LayerSettings { layer: LayerName }

const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const names = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.flatMap((row) => {
      // A Workspace's integrations are records with a `provider`; elsewhere names.
      const name = typeof row === 'string' ? row : row && typeof row === 'object' ? (row as { provider?: unknown }).provider : '';
      return typeof name === 'string' && NAME.test(name.trim()) ? [name.trim()] : [];
    }))]
  : [];

export const emptyBrief = (): BriefSettings => ({ add: [], block: [], only: [] });

/** A record's brief settings, from whatever the record holds; anything unreadable is empty. */
export function briefSettings(value: unknown): BriefSettings {
  const v = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const add = Array.isArray(v.add) ? v.add.flatMap((row) => {
    const name = typeof row === 'string' ? row : row && typeof row === 'object' ? (row as { name?: unknown }).name : '';
    const depth = row && typeof row === 'object' ? (row as { depth?: unknown }).depth : undefined;
    if (typeof name !== 'string' || !NAME.test(name)) return [];
    return [(DEPTHS as readonly unknown[]).includes(depth) && depth !== 'none' ? { name, depth: depth as Depth } : { name }];
  }) : [];
  return { add, block: names(v.block), only: names(v.only) };
}

/** One layer from a record holding `brief`, `integrations`, `pm`. */
export function layerOf(layer: LayerName, record: unknown): Layer {
  const r = record && typeof record === 'object' ? record as Record<string, unknown> : {};
  return {
    layer,
    brief: briefSettings(r.brief),
    integrations: names(r.integrations),
    ...(typeof r.pm === 'boolean' ? { pm: r.pm } : {}),
  };
}

export const userBriefFile = (): string => path.join(storeDir('config'), 'brief.json');

export async function readUserLayer(): Promise<Layer> {
  try {
    return layerOf('user', JSON.parse(await readFile(userBriefFile(), 'utf8')));
  } catch {
    return layerOf('user', {});
  }
}

export interface Cascade {
  /** Each integration on, and the widest layer that turned it on. */
  integrations: Record<string, LayerName>;
  /** On: from the widest layer that turned it on, or 'jira'. Off: no from. */
  pm: { on: boolean; from?: LayerName | 'jira' };
}

/** Integrations and project management down the layers: they only add. */
export function cascade(layers: readonly Layer[]): Cascade {
  const integrations: Record<string, LayerName> = {};
  for (const layer of layers) for (const name of layer.integrations) integrations[name] ??= layer.layer;
  const by = layers.find((layer) => layer.pm === true)?.layer;
  const pm = by ? { on: true, from: by } : integrations.jira ? { on: true, from: 'jira' as const } : { on: false };
  return { integrations, pm };
}

export interface InPlay {
  kind: CatalogKind;
  name: string;
  title: string;
  depth: Exclude<Depth, 'none'>;
  /** Why it is in play: its `when:` words ([] = every Agent), or `add:<layer>`. */
  why: string[];
  file: CatalogFile;
}

export interface Resolved {
  facts: InPlay[];
  /** The mandate values the Agent holds (§4): orders, printed in their own section. */
  mandates: InPlay[];
  /** Behaviours in play, each with the tools that serve it (a tool under its first behaviour only). */
  behaviours: Array<InPlay & { tools: InPlay[] }>;
  /** Tools in play that serve no behaviour in play. */
  other: InPlay[];
}

const RANK: Record<Depth, number> = { none: 0, seed: 1, full: 2 };
/** Mandates print axis by axis, as the mandate fact does; a new axis after these. */
const axis = (row: InPlay): number => { const at = ['reach', 'recruit', 'output'].indexOf(row.file.mandate); return at < 0 ? 3 : at; };

/** What this Agent is told: the catalog over the record and the layers, §6's order. */
export function resolveBrief(catalog: Catalog, record: BriefRecord, layers: readonly Layer[]): Resolved {
  const all = new Map<string, CatalogFile>();
  for (const kind of ['facts', 'behaviours', 'tools'] as const) for (const file of catalog[kind]) if (!all.has(file.name)) all.set(file.name, file);
  const told = new Map<string, InPlay>();
  const put = (file: CatalogFile, depth: Depth, why: string[]): void => {
    if (depth === 'none') return;
    const was = told.get(file.name);
    if (was && RANK[was.depth] >= RANK[depth]) return;
    told.set(file.name, { kind: file.kind, name: file.name, title: file.title, depth, why: was ? was.why : why, file });
  };
  // 1. Each header. A tool that serves a behaviour comes with it (below), not on its own; a
  // mandate value is in play only for the Agent that holds it.
  const holds = (file: CatalogFile): boolean => {
    const held = (record.agent as unknown as Record<string, unknown>)[file.mandate];
    return Array.isArray(held) ? held.includes(file.value) : held === file.value;
  };
  for (const file of all.values()) {
    if (file.kind === 'tools' && file.serves.length) continue;
    if (file.mandate && !holds(file)) continue;
    if (whenHolds(file.when, record)) put(file, file.depth, file.mandate ? [`${file.mandate}:${file.value}`, ...file.when] : file.when);
  }
  // 2. Add, from every layer.
  for (const layer of layers) for (const add of layer.brief.add) {
    const file = all.get(add.name);
    if (file) put(file, add.depth ?? (file.depth === 'none' ? 'seed' : file.depth), [`add:${layer.layer}`]);
  }
  // 3. Block, from every layer.
  for (const layer of layers) for (const name of layer.brief.block) told.delete(name);
  // 4. Screens: each narrows, facts included.
  for (const layer of layers) {
    if (!layer.brief.only.length) continue;
    const only = new Set(layer.brief.only);
    for (const [name] of told) if (!only.has(name)) told.delete(name);
  }
  // Tools that serve a behaviour in play come with it, unless blocked or screened out by name.
  const blocked = new Set(layers.flatMap((layer) => layer.brief.block));
  const screens = layers.filter((layer) => layer.brief.only.length).map((layer) => new Set(layer.brief.only));
  const byOrder = (a: InPlay, b: InPlay): number => a.file.order - b.file.order || a.title.localeCompare(b.title);
  const behaviours = [...told.values()].filter((row) => row.kind === 'behaviours' && !row.file.mandate).sort(byOrder).map((row) => ({ ...row, tools: [] as InPlay[] }));
  const placed = new Set<string>();
  for (const tool of catalog.tools) {
    if (!tool.serves.length || blocked.has(tool.name) || told.has(tool.name)) continue;
    const host = behaviours.find((row) => tool.serves.includes(row.name));
    if (!host || !whenHolds(tool.when, record)) continue;
    if (screens.some((only) => !only.has(tool.name) && !only.has(host.name))) continue;
    put(tool, tool.depth === 'none' ? 'seed' : tool.depth, [...host.why]);
  }
  for (const row of [...told.values()].filter((row) => row.kind === 'tools').sort(byOrder)) {
    const host = behaviours.find((behaviour) => row.file.serves.includes(behaviour.name));
    if (host) host.tools.push(row);
    else placed.add(row.name);
  }
  return {
    facts: [...told.values()].filter((row) => row.kind === 'facts').sort(byOrder),
    mandates: [...told.values()].filter((row) => row.file.mandate).sort((a, b) => axis(a) - axis(b) || a.file.mandate.localeCompare(b.file.mandate) || byOrder(a, b)),
    behaviours,
    other: [...told.values()].filter((row) => placed.has(row.name)).sort(byOrder),
  };
}

/** The catalog files the layers take off: blocked by any, or left out by any screen. For the
 * forms' menus (a blocked mandate value is off the menu, §4). */
export function briefOff(catalog: Catalog, layers: readonly Layer[]): string[] {
  const blocked = new Set(layers.flatMap((layer) => layer.brief.block));
  const screens = layers.filter((layer) => layer.brief.only.length).map((layer) => new Set(layer.brief.only));
  const names = new Set([...catalog.facts, ...catalog.behaviours, ...catalog.tools].map((file) => file.name));
  return [...names].filter((name) => blocked.has(name) || screens.some((only) => !only.has(name)));
}

/** What a brief told, flat: name, kind, depth, why. For receipts and the preview. */
export const briefTold = (r: Resolved): Array<Pick<InPlay, 'kind' | 'name' | 'title' | 'depth' | 'why'> & { path: string }> =>
  [...r.facts, ...r.mandates, ...r.behaviours.flatMap((row) => [row, ...row.tools]), ...r.other]
    .map((row) => ({ kind: row.kind, name: row.name, title: row.title, depth: row.depth, why: row.why, path: row.file.file }));
