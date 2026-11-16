/**
 * CANVASES (KAN-329, KAN-610; behaviours/canvases.md, tools/canvas.md). A canvas is a one-page
 * map of a Workspace: blocks, each read where it lives or typed by an Agent or a person. It is
 * Markdown in the Workspace's plans place, `<plans>/canvases/<name>.md` (plans.ts plansPlace), so
 * `plan ls` never lists it; no Agent sees the path: everything goes through `ronin_bin/canvas`
 * over /api/canvases (src/routes/canvases-api.ts).
 *
 * The file holds the blocks and the typed entries, never a reading and never a command: the
 * plans place is a shared checkout anyone may edit, so a `read:` line in a canvas file is ignored.
 * A block's commands (an integration block's `read:`) are its template's, in the catalog (stock,
 * the user's store over it), found at read time by the canvas's `from <template>` and the block's
 * name; a canvas of no template, or a block its template hasn't, runs nothing. `read` answers
 * each block with its live lines (repos, items, documents, resolved here) and those commands with
 * the facts (`{workspace}`, the integration's `{site}`), which the tool fills per argument after
 * splitting, and runs as its caller. No key is ever on a canvas or in a reading.
 *
 *   # <name>
 *
 *   Canvas: from <template|none> · <date> · <by>
 *
 *   ## blocks
 *
 *   ### Other services
 *   - **source:** typed
 *   - **holds:** Anything outside Ronin the site depends on.
 *   - **entry:** GoDaddy DNS · ronincowork.com's records at GoDaddy · canvas_builder · 2026-11-16
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { commitOnly, plansPlace, listPlans } from './plans.js';
import { readDefinitions, type Definition } from './resource-adapters.js';
import { type Workspace } from './workspaces.js';

export class CanvasMissing extends Error {}
export class CanvasBadInput extends Error {}

/** A canvas name. A Workspace's name is the Workspace's own rule, never this one. */
export const isValidCanvasName = (s: string): boolean => /^[a-z0-9][a-z0-9-]{0,63}$/.test(s);

export interface CanvasEntry { name: string; line: string; by: string; at: string }
export interface CanvasBlock { name: string; source: string; holds: string; entriesHint: string; read: string[]; entries: CanvasEntry[] }
export interface Canvas { name: string; workspace: string; title: string; template: string; date: string; by: string; blocks: CanvasBlock[]; text: string }
export interface CanvasRow { name: string; template: string; date: string; by: string }
export interface CanvasTemplate { name: string; label: string; blurb: string; kinds: string; integration: string; origin: string; blocks: CanvasBlock[] }

const today = (): string => new Date().toISOString().slice(0, 10);
const HEADER = /^Canvas: from (\S+) · (\S+) · (.+)$/;
const KEY = /^-\s*\*\*([\w.-]+):\*\*\s*(.*)$/;
/** One line, no Markdown that could open a block or a key of its own. */
const oneLine = (v: unknown, max = 300): string => String(v ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const nameText = (v: unknown): string => oneLine(v, 80).replace(/·/g, '-').replace(/^#+\s*/, '');
const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/* ---------- the Markdown ---------- */

/** The blocks under `## blocks`: one `### <name>` each, its key lines, in the order they paint. */
/** `reads`: keep `read:` lines (a template's); a canvas file's are ignored. */
export function parseBlocks(text: string, reads = false): CanvasBlock[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const from = lines.findIndex((line) => /^##\s+blocks\s*$/i.test(line.trim()));
  if (from === -1) return [];
  const blocks: CanvasBlock[] = [];
  let at: CanvasBlock | null = null;
  for (const raw of lines.slice(from + 1)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) break;
    const head = /^###\s+(.+)$/.exec(line);
    if (head) { at = { name: head[1]!.trim(), source: '', holds: '', entriesHint: '', read: [], entries: [] }; blocks.push(at); continue; }
    const key = at ? KEY.exec(line) : null;
    if (!at || !key) continue;
    const [, k, v] = key as unknown as [string, string, string];
    switch (k.toLowerCase()) {
      case 'source': at.source = v.trim(); break;
      case 'holds': at.holds = v.trim(); break;
      case 'entries': at.entriesHint = v.trim(); break;
      case 'read': if (reads) at.read.push(...v.split(';').map((one) => one.trim()).filter(Boolean)); break;
      case 'entry': {
        const parts = v.split(' · ');
        if (parts.length >= 4) {
          const at2 = parts.pop()!; const by = parts.pop()!; const name = parts.shift()!;
          at.entries.push({ name: name.trim(), line: parts.join(' · ').trim(), by: by.trim(), at: at2.trim() });
        } else at.entries.push({ name: (parts[0] ?? '').trim(), line: parts.slice(1).join(' · ').trim(), by: '', at: '' });
        break;
      }
      default: break;
    }
  }
  return blocks;
}

const blockText = (b: CanvasBlock): string[] => [
  `### ${b.name}`,
  `- **source:** ${b.source || 'typed'}`,
  ...(b.holds ? [`- **holds:** ${b.holds}`] : []),
  ...(b.entriesHint ? [`- **entries:** ${b.entriesHint}`] : []),
  ...b.entries.map((e) => `- **entry:** ${e.name} · ${e.line} · ${e.by} · ${e.at}`),
  '',
];

export function canvasText(c: Pick<Canvas, 'title' | 'template' | 'date' | 'by' | 'blocks'>): string {
  return [`# ${c.title}`, '', `Canvas: from ${c.template || 'none'} · ${c.date} · ${c.by}`, '', '## blocks', '', ...c.blocks.flatMap(blockText)].join('\n').replace(/\n*$/, '\n');
}

export function parseCanvas(text: string, name: string, workspace: string): Canvas {
  const lines = text.split('\n');
  const title = (lines.find((line) => /^# /.test(line)) ?? `# ${name}`).replace(/^# +/, '').trim();
  const h = lines.map((line) => HEADER.exec(line.trim())).find(Boolean);
  return { name, workspace, title, template: h?.[1] === 'none' ? '' : h?.[1] ?? '', date: h?.[2] ?? '', by: h?.[3]?.trim() ?? '', blocks: parseBlocks(text), text };
}

/* ---------- where ---------- */

async function dirOf(w: Workspace): Promise<string> {
  return path.join((await plansPlace(w.campaign_id, w.name, w.plans)).dir, 'canvases');
}

function checkName(name: string): void {
  if (!isValidCanvasName(name)) throw new CanvasBadInput(`A canvas name is lowercase letters, digits and -: "${name}".`);
}

async function load(w: Workspace, name: string): Promise<{ canvas: Canvas; file: string; dir: string }> {
  checkName(name);
  const dir = await dirOf(w);
  const file = path.join(dir, `${name}.md`);
  let text: string;
  try { text = await readFile(file, 'utf8'); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new CanvasMissing(`No canvas ${w.name}/${name}. canvas ls lists them.`);
    throw e;
  }
  return { canvas: parseCanvas(text, name, w.name), file, dir };
}

/* ---------- the templates ---------- */

const templateOf = (d: Definition): CanvasTemplate => ({
  name: d.name, label: d.get('label') || d.name, blurb: d.get('blurb'), kinds: d.get('kinds'), integration: d.get('integration'), origin: d.origin,
  blocks: parseBlocks(d.text, true),
});

/** The shelf: stock templates/canvases, the user's catalogs store over them by name. */
export async function listCanvasTemplates(): Promise<CanvasTemplate[]> {
  return (await readDefinitions('templates/canvases')).map(templateOf);
}

/* ---------- the acts ---------- */

let chain: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = chain.then(work, work);
  chain = next.catch(() => undefined);
  return next;
}

export interface CanvasAnswer { line: string; history: string }

export async function listCanvases(w: Workspace): Promise<CanvasRow[]> {
  const dir = await dirOf(w);
  const names = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).filter(isValidCanvasName).sort();
  const rows = await Promise.all(names.map(async (name) => {
    const c = parseCanvas(await readFile(path.join(dir, `${name}.md`), 'utf8'), name, w.name);
    return { name, template: c.template, date: c.date, by: c.by };
  }));
  return rows;
}

export function createCanvas(w: Workspace, name: string, template: string, by: string): Promise<CanvasAnswer> {
  checkName(name);
  return serial(async () => {
    const dir = await dirOf(w);
    const file = path.join(dir, `${name}.md`);
    if (await readFile(file).then(() => true, () => false)) throw new CanvasBadInput(`${w.name}/${name} is already a canvas: canvas read ${name}, canvas edit ${name} ….`);
    let blocks: CanvasBlock[] = [];
    if (template) {
      const t = (await listCanvasTemplates()).find((one) => one.name === template);
      if (!t) throw new CanvasMissing(`No canvas template ${template}. canvas templates lists them.`);
      blocks = t.blocks.map((b) => ({ ...b, read: [], entries: [] }));
    }
    await mkdir(dir, { recursive: true });
    await writeFile(file, canvasText({ title: name, template, date: today(), by, blocks }), 'utf8');
    const history = await commitOnly(dir, [file], `canvas ${name}: create`);
    const list = blocks.map((b) => b.name).join(', ');
    return { line: `Made ${w.name}/${name}${template ? ` from ${template}: ${list || 'no blocks'}` : ', empty'}. Remove a block the Workspace hasn't: canvas edit ${name} remove <block>.`, history };
  });
}

export type EditOp = 'add' | 'change' | 'remove';

/** Typed entries only: add, change or remove one, or remove a whole block. Nothing here writes a
 * block's source, holds or read lines; a block that add makes is `typed`. */
export function editCanvas(w: Workspace, name: string, op: string, blockName: string, entryName: string, line: string, by: string): Promise<CanvasAnswer> {
  return serial(async () => {
    const { canvas, file, dir } = await load(w, name);
    const blockN = nameText(blockName);
    const entryN = nameText(entryName);
    const text = oneLine(line);
    if (!blockN) throw new CanvasBadInput('Name the block: canvas edit <name> add|change|remove <block> ….');
    let block = canvas.blocks.find((b) => same(b.name, blockN));
    let said = '';
    if (op === 'add' || op === 'change') {
      if (!entryN || !text) throw new CanvasBadInput(`canvas edit ${name} ${op} <block> <entry> "<line>".`);
      if (op === 'add' && !block) { block = { name: blockN, source: 'typed', holds: '', entriesHint: '', read: [], entries: [] }; canvas.blocks.push(block); }
      if (!block) throw new CanvasMissing(`${name} has no block ${blockN}; its blocks: ${canvas.blocks.map((b) => b.name).join(', ') || 'none'}.`);
      const at = block.entries.findIndex((e) => same(e.name, entryN));
      if (op === 'add' && at !== -1) throw new CanvasBadInput(`${block.name} already has ${block.entries[at]!.name}: canvas edit ${name} change.`);
      if (op === 'change' && at === -1) throw new CanvasMissing(`${block.name} has no entry ${entryN}: canvas edit ${name} add.`);
      const entry = { name: op === 'change' ? block.entries[at]!.name : entryN, line: text, by, at: today() };
      if (op === 'add') block.entries.push(entry); else block.entries[at] = entry;
      said = `${op === 'add' ? 'Added' : 'Changed'} ${block.name} › ${entry.name} on ${w.name}/${name}.`;
    } else if (op === 'remove') {
      if (!block) throw new CanvasMissing(`${name} has no block ${blockN}; its blocks: ${canvas.blocks.map((b) => b.name).join(', ') || 'none'}.`);
      if (entryN) {
        const at = block.entries.findIndex((e) => same(e.name, entryN));
        if (at === -1) throw new CanvasMissing(`${block.name} has no entry ${entryN}.`);
        said = `Removed ${block.name} › ${block.entries[at]!.name} from ${w.name}/${name}.`;
        block.entries.splice(at, 1);
      } else {
        canvas.blocks = canvas.blocks.filter((b) => b !== block);
        said = `Removed the block ${block.name} from ${w.name}/${name}.`;
      }
    } else throw new CanvasBadInput(`canvas edit takes add, change or remove, not "${op}".`);
    await writeFile(file, canvasText(canvas), 'utf8');
    return { line: said, history: await commitOnly(dir, [file], `canvas ${name}: ${op} ${blockN}${entryN ? ` › ${entryN}` : ''}`) };
  });
}

/* ---------- the reading ---------- */

/** One block as read now: `lines` are what Ronin read itself; `run` its template's commands,
 * unfilled, and `facts` what fills their `{…}` (per argument, in the tool). `shown` false: the
 * Workspace hasn't this part (no such integration, nothing in it). `unavailable`: why an
 * integration block has no reading (its template or its block is not in the catalog). */
export interface ReadBlock { name: string; source: string; holds: string; lines: string[]; run: string[]; facts: Record<string, string>; entries: CanvasEntry[]; shown: boolean; unavailable: string }
export interface CanvasReading { name: string; workspace: string; title: string; template: string; date: string; by: string; blocks: ReadBlock[] }

/** `{workspace}` and the integration's facts (`{site}`) in one argument; an unknown one stays. */
export const fillArg = (arg: string, facts: Record<string, string>): string =>
  arg.replace(/\{([a-z_]+)\}/g, (all, key: string) => (facts[key] ? facts[key]! : all));

const factsOf = (row: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(row).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => [k, String(v)]));

const CAP = 25;

async function repoLines(w: Workspace): Promise<string[]> {
  const { peekProjectRoots } = await import('./project-roots.js');
  const roots = await peekProjectRoots().catch(() => []);
  return w.repos.map((repo) => {
    const dir = roots.find((root) => root.name === repo.name)?.dir ?? '';
    return [repo.name, repo.note, dir].filter(Boolean).join(' — ');
  });
}

/** The Workspace's items: those its Teams, their members and the Workspace itself hold. */
async function workspaceItems(w: Workspace) {
  const { listTeamRosters } = await import('./team-rosters.js');
  const { listSessions } = await import('./tmux.js');
  const { liveRows } = await import('./work-items-index.js');
  const teams = new Set((await listTeamRosters()).filter((r) => r.workspace === w.name && r.state !== 'archived' && (!r.campaign_id || r.campaign_id === w.campaign_id)).map((r) => r.name));
  const members = new Set((await listSessions().catch(() => [])).filter((s) => s.tags.some((t) => teams.has(t))).map((s) => s.name));
  const mine = (h: string) => h === `workspace:${w.name}` || (h.startsWith('team:') && teams.has(h.slice(5))) || (h.startsWith('agent:') && members.has(h.slice(6)));
  const rows = (await liveRows()).filter((row) => row.campaign_id === w.campaign_id && row.holders.some(mine));
  const done = (s: string) => /^done$/i.test(s);
  return rows.sort((a, b) => Number(done(a.status)) - Number(done(b.status)) || b.level - a.level || b.moved.localeCompare(a.moved));
}

async function itemLines(w: Workspace): Promise<string[]> {
  const rows = await workspaceItems(w);
  const lines = rows.slice(0, CAP).map((row) => `${row.id} ${row.kind} · ${row.status} · ${row.holders.join(', ') || 'nobody'} · ${row.title}`);
  if (rows.length > CAP) lines.push(`and ${rows.length - CAP} more: item search`);
  return lines;
}

async function documentLines(w: Workspace): Promise<string[]> {
  const lines = (await listPlans(w).catch(() => [])).map((p) => `plan ${w.name}/${p.name} — ${p.title || p.name} (${p.status}): plan read ${p.name}`);
  const { readItem } = await import('./work-items.js');
  const seen = new Set<string>();
  for (const row of (await workspaceItems(w)).slice(0, CAP)) {
    for (const doc of (await readItem(row.id).catch(() => null))?.attachments ?? []) {
      if (doc.startsWith('plan:') || seen.has(doc)) continue;
      seen.add(doc);
      lines.push(`${doc} (on ${row.id})`);
    }
  }
  return lines;
}

export async function readCanvas(w: Workspace, name: string): Promise<CanvasReading> {
  const { canvas } = await load(w, name);
  const template = canvas.template ? (await listCanvasTemplates()).find((t) => t.name === canvas.template) : undefined;
  const commandsOf = (b: CanvasBlock): string[] => template?.blocks.find((one) => same(one.name, b.name))?.read ?? [];
  const whyNot = (b: CanvasBlock): string => !canvas.template ? 'this canvas is from no template, so nothing reads this block'
    : !template ? `the template ${canvas.template} is not in the catalog (canvas templates)`
    : !commandsOf(b).length ? `the template ${canvas.template} has no reading for a block ${b.name}` : '';
  const blocks: ReadBlock[] = [];
  for (const b of canvas.blocks) {
    const [kind, what = ''] = b.source.split(/\s+/);
    const read = commandsOf(b);
    const base = { name: b.name, source: b.source, holds: b.holds, entries: b.entries, lines: [] as string[], run: read, facts: { workspace: w.name } as Record<string, string>, unavailable: '' };
    if (kind === 'integration' && what) {
      const link = w.integrations.find((one) => one.provider === what);
      blocks.push({ ...base, run: link ? read : [], facts: { ...(link ? factsOf(link) : {}), workspace: w.name }, unavailable: link ? whyNot(b) : '', shown: !!link || b.entries.length > 0 });
    } else if (kind === 'live') {
      const lines = what === 'repos' ? await repoLines(w) : what === 'items' ? await itemLines(w) : what === 'documents' ? await documentLines(w) : [];
      blocks.push({ ...base, lines, shown: lines.length > 0 || b.entries.length > 0 || read.length > 0 });
    } else {
      blocks.push({ ...base, shown: b.entries.length > 0 || read.length > 0 });
    }
  }
  return { name, workspace: w.name, title: canvas.title, template: canvas.template, date: canvas.date, by: canvas.by, blocks };
}
