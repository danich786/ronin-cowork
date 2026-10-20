/**
 * MODEL INFO — every fungible fact about a model (name, description, prices, limits, dates),
 * from the public models.dev catalog, used only once accepted (owner, 2026-10-20).
 *
 * Ronin keeps its own concepts in `ronin_catalogs/MODEL_PROVIDERS.md` (the provider, its
 * CLI, its family → tier words, the models.dev key it is filed under). Everything that
 * moves with the market comes from here:
 *
 * - SHIPPED: `ronin_catalogs/MODEL_INFO.json`, the accepted snapshot a release carries.
 * - ACCEPTED: `MODEL_INFO.json` in the catalogs store; it replaces the shipped copy whole.
 * - PENDING: `MODEL_INFO.pending.json` beside it — what Refresh all fetched that differs
 *   from the accepted copy. Nothing reads it but the review (the Model refresh surface, or
 *   an Agent pointed at the file). Only Accept makes it the copy Ronin uses.
 *
 * One fetch, on Refresh all only (the owner's press, never a timer), one egress line —
 * the door's second step, on its own route after the CLIs' lists are read. The
 * fetch keeps only the providers the catalog names, only their models with tool use, and
 * only the fields below; the rest of the 5.8 MB never touches disk.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { STOCK_DIR, storeDir } from './resources.js';
import { appendEgress, type EgressLine } from './activation/egress.js';

export const MODEL_INFO_SOURCE = 'https://models.dev/api.json';
/** Where the source is kept and under what licence: said beside every fetch. */
export const MODEL_INFO_REPOSITORY = 'https://github.com/anomalyco/models.dev';
export const MODEL_INFO_LICENCE = 'MIT';
export const MODEL_INFO_FILE = 'MODEL_INFO.json';
const PENDING_FILE = 'MODEL_INFO.pending.json';
const CHECK_FILE = 'MODEL_INFO.check.json';

/** One model as models.dev describes it, trimmed to what Ronin shows. */
export interface ModelInfo {
  name: string;
  description: string;
  family: string;
  release_date: string;
  /** The training cut-off, `YYYY-MM`. */
  knowledge: string;
  /** Dollars per million tokens. */
  cost: { input?: number; output?: number; cache_read?: number; cache_write?: number };
  /** Tokens. */
  limit: { context?: number; output?: number };
  reasoning: boolean;
  tool_call: boolean;
  open_weights: boolean;
  modalities: { input: string[]; output: string[] };
}

export interface ModelInfoFile {
  source: string;
  /** When it was fetched from the source. */
  fetched_at: string;
  /** sha256 of the whole response as fetched. */
  sha256: string;
  /** models.dev provider key → model id → info. */
  providers: Record<string, Record<string, ModelInfo>>;
}

/** What the last Refresh all found: the same, an update waiting, or why there was nothing to compare. */
export interface ModelInfoCheck {
  at: string;
  outcome: 'same' | 'pending' | 'failed';
  say: string;
}

export interface ModelInfoChange {
  provider: string;
  model: string;
  change: 'added' | 'removed' | 'changed';
  /** Each differing field, as `cost.input`, with its old and new value; null where the model has none. */
  fields: Array<{ field: string; was: unknown; now: unknown }>;
}

export const SHIPPED_MODEL_INFO = path.join(STOCK_DIR, MODEL_INFO_FILE);
export const acceptedModelInfoPath = (): string => path.join(storeDir('catalogs'), MODEL_INFO_FILE);
export const pendingModelInfoPath = (): string => path.join(storeDir('catalogs'), PENDING_FILE);
const checkPath = (): string => path.join(storeDir('catalogs'), CHECK_FILE);

const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown): string => typeof v === 'string' ? v : '';
const strs = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
const numbers = <K extends string>(v: unknown, keys: readonly K[]): Partial<Record<K, number>> => {
  const o = obj(v);
  return Object.fromEntries(keys.flatMap((k) => typeof o[k] === 'number' && Number.isFinite(o[k]) ? [[k, o[k]]] : [])) as Partial<Record<K, number>>;
};

/** One models.dev model, trimmed to Ronin's fields. */
function trimModel(raw: unknown): ModelInfo {
  const m = obj(raw);
  const modalities = obj(m.modalities);
  return {
    name: str(m.name),
    description: str(m.description),
    family: str(m.family),
    release_date: str(m.release_date),
    knowledge: str(m.knowledge),
    cost: numbers(m.cost, ['input', 'output', 'cache_read', 'cache_write'] as const),
    limit: numbers(m.limit, ['context', 'output'] as const),
    reasoning: m.reasoning === true,
    tool_call: m.tool_call === true,
    open_weights: m.open_weights === true,
    modalities: { input: strs(modalities.input), output: strs(modalities.output) },
  };
}

/** The whole models.dev answer, trimmed to the named providers' tool-using models; throws when it lists none of them. */
export function trimModelInfo(text: string, keys: readonly string[], fetched_at: string): ModelInfoFile {
  const all = obj(JSON.parse(text));
  const providers: ModelInfoFile['providers'] = {};
  for (const key of keys) {
    // Only models with tool use: a coding CLI drives nothing else (image, video, embedding).
    const models = obj(obj(all[key]).models);
    const ids = Object.keys(models).filter((id) => obj(models[id]).tool_call === true);
    if (!ids.length) continue;
    providers[key] = Object.fromEntries(ids.sort().map((id) => [id, trimModel(models[id])]));
  }
  if (!Object.keys(providers).length) throw new Error(`models.dev listed none of ${keys.join(', ')}`);
  return { source: MODEL_INFO_SOURCE, fetched_at, sha256: createHash('sha256').update(text).digest('hex'), providers };
}

async function readJson(file: string): Promise<ModelInfoFile | null> {
  try { return JSON.parse(await readFile(file, 'utf8')) as ModelInfoFile; } catch { return null; }
}

/** The copy Ronin uses: the owner's accepted one, else the shipped snapshot. */
export async function readModelInfo(): Promise<ModelInfoFile & { origin: 'user' | 'stock' }> {
  const accepted = await readJson(acceptedModelInfoPath());
  if (accepted) return { ...accepted, origin: 'user' };
  const shipped = await readJson(SHIPPED_MODEL_INFO);
  return { ...(shipped ?? { source: MODEL_INFO_SOURCE, fetched_at: '', sha256: '', providers: {} }), origin: 'stock' };
}

export const readPendingModelInfo = (): Promise<ModelInfoFile | null> => readJson(pendingModelInfoPath());

export async function readModelInfoCheck(): Promise<ModelInfoCheck | null> {
  try { return JSON.parse(await readFile(checkPath(), 'utf8')) as ModelInfoCheck; } catch { return null; }
}

/** One model's facts as `field → value` pairs, nested objects by dotted name. */
function flat(info: ModelInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(info)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = Array.isArray(v2) ? v2.join(', ') : v2;
    else out[k] = v;
  }
  return out;
}

/** What `now` changes against `was`, per model; unchanged models are not listed. */
export function diffModelInfo(was: ModelInfoFile['providers'], now: ModelInfoFile['providers']): ModelInfoChange[] {
  const out: ModelInfoChange[] = [];
  for (const provider of [...new Set([...Object.keys(was), ...Object.keys(now)])]) {
    const a = was[provider] ?? {};
    const b = now[provider] ?? {};
    for (const model of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const x = a[model] ? flat(a[model]) : {}; const y = b[model] ? flat(b[model]) : {};
      const fields = [...new Set([...Object.keys(x), ...Object.keys(y)])]
        .filter((field) => x[field] !== y[field])
        .map((field) => ({ field, was: x[field] ?? null, now: y[field] ?? null }));
      const change = !a[model] ? 'added' : !b[model] ? 'removed' : 'changed';
      if (fields.length) out.push({ provider, model, change, fields });
    }
  }
  return out;
}

async function writeStore(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}

export interface FetchOps {
  fetchText?: (url: string) => Promise<string>;
  egress?: (line: EgressLine) => Promise<void>;
  now?: () => string;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`models.dev answered ${res.status}`);
  return res.text();
}

/**
 * REFRESH ALL's models.dev step: fetch once, trim to `keys`, compare with the copy Ronin
 * uses. The same → no pending (a stale one is removed). Different → the pending copy. A
 * failed fetch or an unreadable answer leaves both copies as they were and says why.
 */
export async function checkModelInfo(keys: readonly string[], ops: FetchOps = {}): Promise<ModelInfoCheck> {
  const now = ops.now ?? (() => new Date().toISOString());
  const egress = ops.egress ?? appendEgress;
  const started = Date.now();
  let text = '';
  let check: ModelInfoCheck;
  try {
    text = await (ops.fetchText ?? fetchText)(MODEL_INFO_SOURCE);
    const fetched = trimModelInfo(text, keys, now());
    const changes = diffModelInfo((await readModelInfo()).providers, fetched.providers);
    if (changes.length) {
      await writeStore(pendingModelInfoPath(), fetched);
      check = { at: now(), outcome: 'pending', say: `${changes.length} model${changes.length === 1 ? '' : 's'} changed` };
    } else {
      await rm(pendingModelInfoPath(), { force: true });
      check = { at: now(), outcome: 'same', say: 'no changes' };
    }
  } catch (error) {
    check = { at: now(), outcome: 'failed', say: (error as Error).message || String(error) };
  }
  await egress({ at: now(), host: 'models.dev', method: 'GET', path: '/api.json', status: text ? 200 : 0, outcome: check.outcome === 'failed' ? 'unreachable' : 'ok', ms: Date.now() - started }).catch(() => { /* bookkeeping never fails the ask */ });
  await writeStore(checkPath(), check);
  return check;
}

/** Accept: the pending copy becomes the one Ronin uses. False when nothing was pending. */
export async function acceptModelInfo(): Promise<boolean> {
  const pending = await readPendingModelInfo();
  if (!pending) return false;
  await writeStore(acceptedModelInfoPath(), pending);
  await rm(pendingModelInfoPath(), { force: true });
  return true;
}

/** Discard: the pending copy is deleted; the copy Ronin uses stays. */
export async function discardModelInfo(): Promise<void> {
  await rm(pendingModelInfoPath(), { force: true });
}

/** How many models a copy holds per provider key. */
const kept = (file: ModelInfoFile): Record<string, number> =>
  Object.fromEntries(Object.entries(file.providers).map(([key, models]) => [key, Object.keys(models).length]));

/** What the review reads: the source, the copy in use, the update waiting with its changes and its models, the last check. */
export async function modelInfoReview(): Promise<{
  source: { url: string; repository: string; licence: string };
  using: { origin: 'user' | 'stock'; fetched_at: string; path: string; kept: Record<string, number> };
  pending: { fetched_at: string; path: string; sha256: string; kept: Record<string, number>; changes: ModelInfoChange[]; models: ModelInfoFile['providers'] } | null;
  check: ModelInfoCheck | null;
}> {
  const [using, pending, check] = await Promise.all([readModelInfo(), readPendingModelInfo(), readModelInfoCheck()]);
  const changes = pending ? diffModelInfo(using.providers, pending.providers) : [];
  // The changed models whole, from both copies, so the review draws a model as the table does.
  const models: ModelInfoFile['providers'] = {};
  for (const { provider, model } of changes) {
    const info = pending?.providers[provider]?.[model] ?? using.providers[provider]?.[model];
    if (info) (models[provider] ??= {})[model] = info;
  }
  return {
    source: { url: MODEL_INFO_SOURCE, repository: MODEL_INFO_REPOSITORY, licence: MODEL_INFO_LICENCE },
    using: { origin: using.origin, fetched_at: using.fetched_at, path: using.origin === 'user' ? acceptedModelInfoPath() : SHIPPED_MODEL_INFO, kept: kept(using) },
    pending: pending ? { fetched_at: pending.fetched_at, path: pendingModelInfoPath(), sha256: pending.sha256, kept: kept(pending), changes, models } : null,
    check,
  };
}
