/**
 * THE CATALOG — facts, behaviours and tools (wip/BRIEF_MODEL.md §3).
 *
 * One flat folder per object in `ronin_catalogs/` (`facts/`, `behaviours/`, `tools/`); the
 * user's own store (`~/ronin/facts/`, `~/ronin/behaviours/`, `~/ronin/tools/`) adds files and
 * replaces stock ones by name. A file's name (without `.md`) is its id: the one `when:`,
 * `serves:` and the brief settings name. Every file starts the same:
 *
 *   # Title
 *   - **seed:** the one line            (behaviours, tools)
 *   - **line:** User: {user.name}{, user.role}   (facts)
 *   - **when:** cowork, !mika           (all; blank = every Agent)
 *   - **depth:** none | seed | full     (behaviours, tools; blank = seed)
 *   - **serves:** write-it-down         (tools; blank = Other tools)
 *   - **mandate:** reach                (behaviours: a mandate value; the title is the value)
 *   - **order:** 40
 *
 *   <the full text>
 *
 * An unknown key is ignored. Nothing here decides who is told what: that is §4–§6.
 */
import path from 'node:path';
import { STOCK_DIR, entryValue, isKeyLine, resolveFiles, storeDir, type Origin } from './resources.js';

export type CatalogKind = 'facts' | 'behaviours' | 'tools';
export type Depth = 'none' | 'seed' | 'full';
export const CATALOG_KINDS: readonly CatalogKind[] = ['facts', 'behaviours', 'tools'];
export const DEPTHS: readonly Depth[] = ['none', 'seed', 'full'];

export interface CatalogFile {
  kind: CatalogKind;
  name: string;
  title: string;
  seed: string;
  line: string;
  when: string[];
  depth: Depth;
  serves: string[];
  /** The mandate axis this behaviour is a value of (§4): reach, recruit, output; '' if none. */
  mandate: string;
  /** Its value on that axis: the title, lower-cased ('Propose agents' → 'propose agents'). */
  value: string;
  order: number;
  /** The full text: everything after the header. */
  body: string;
  file: string;
  origin: Origin;
  shadowed: boolean;
}

/** The user's folder for a kind. Tool files sit beside the user's own tool executables. */
export const userCatalogDir = (kind: CatalogKind): string => storeDir(kind);

const list = (value: string): string[] => value.split(',').map((part) => part.trim()).filter(Boolean);

/** The header and the full text of one catalog file. */
export function parseCatalogFile(kind: CatalogKind, name: string, text: string): Omit<CatalogFile, 'file' | 'origin' | 'shadowed'> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let at = 0;
  while (at < lines.length && !lines[at].trim()) at++;
  const title = /^#\s+(.+?)\s*$/.exec(lines[at] ?? '')?.[1] ?? name;
  if (/^#\s/.test(lines[at] ?? '')) at++;
  while (at < lines.length && !lines[at].trim()) at++;
  const header: string[] = [];
  while (at < lines.length && isKeyLine(lines[at])) header.push(lines[at++]);
  const get = (key: string): string => entryValue(header, key);
  const depth = get('depth').toLowerCase();
  const order = Number(get('order'));
  const axis = kind === 'behaviours' ? get('mandate').toLowerCase() : '';
  return {
    kind,
    name,
    title,
    seed: get('seed'),
    line: get('line'),
    when: list(get('when')),
    depth: kind === 'facts' ? 'full' : (DEPTHS as readonly string[]).includes(depth) ? depth as Depth : 'seed',
    serves: kind === 'tools' ? list(get('serves')) : [],
    mandate: axis,
    value: axis ? title.toLowerCase() : '',
    order: Number.isFinite(order) && get('order') !== '' ? order : Number.MAX_SAFE_INTEGER,
    body: lines.slice(at).join('\n').trim(),
  };
}

const isCatalogFile = (relative: string): boolean =>
  relative.endsWith('.md') && !relative.startsWith('.') && relative !== 'README.md';

/** One kind, stock and user merged by name, in `order:` then title order. */
export async function readCatalog(kind: CatalogKind): Promise<CatalogFile[]> {
  const files = await resolveFiles({
    stock: path.join(STOCK_DIR, kind),
    user: userCatalogDir(kind),
    include: isCatalogFile,
    symlinks: true,
  });
  return files
    .map((file) => ({ ...parseCatalogFile(kind, file.name, file.text), file: file.path, origin: file.origin, shadowed: file.shadowed }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export interface Catalog { facts: CatalogFile[]; behaviours: CatalogFile[]; tools: CatalogFile[] }

export async function readCatalogs(): Promise<Catalog> {
  const [facts, behaviours, tools] = await Promise.all(CATALOG_KINDS.map(readCatalog));
  return { facts, behaviours, tools };
}
