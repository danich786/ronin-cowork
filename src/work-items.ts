/**
 * THE WORK ITEM STORE — one item type, stored once, keyed by id.
 *
 * The only module that reads or writes an item file. Everything else reaches items through
 * the /api/work-items routes (src/routes/work-items-api.ts), and every change here appends
 * exactly one line to the item's trail, naming who called. Nothing is locked against
 * anyone: holding is discovery, never permission. Two refusals: a move that would form a
 * cycle, and a move of an item with subtasks.
 *
 * THE SHAPE MATCHES JIRA (owner, 2026-10-22; samurai_lab WORK_ITEM_BUILDOUT.md). One object
 * at every level: `level` 1 epic · 0 story/task/bug · -1 subtask, stored; `kind` a label;
 * `status` the board column; `flagged` an impediment. An old file (stage, exit, a colour
 * status) is read in the new shape and written in it on its next write.
 *
 * One file per item, <store>/<id>.json, written beside and renamed over. Ids come from one
 * global issuer (w1, w2, …) under one in-process lock that every write shares, so a trail
 * append is read, push, write with nobody in between.
 */
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { storeDir } from './resources.js';
import { sessionKey } from './session-dir.js';
import { enqueueMessage } from './message-queue.js';
import { findLeads } from './desks/lead.js';
import { listTeamRosters, readTeamRoster, writeTeamRoster } from './team-rosters.js';
import { ackRecord, listLetterHolds, teamChanged, readLetterHolds, seedTegami, writeLetterHolds } from './tegami.js';

export const ITEM_STATUSES = ['IDEA', 'PLAN', 'BUILD', 'REVIEW', 'LAND', 'DONE'] as const;
/** A level-0 item's kind (owner, 2026-10-22): a label only; absent reads as blank. */
export const ITEM_KINDS = ['story', 'task', 'bug'] as const;
export const ITEM_LEVELS = [1, 0, -1] as const;
export const RUNG_STATUSES = ['PLANNED', 'ACTIVE', 'DONE'] as const;
export const TRAIL_OPS = ['create', 'assign', 'release', 'move', 'status', 'edit', 'evidence', 'holder-ended'] as const;

export type ItemStatus = typeof ITEM_STATUSES[number];
export type ItemKind = typeof ITEM_KINDS[number];
export type ItemLevel = typeof ITEM_LEVELS[number];
export type RungStatus = typeof RUNG_STATUSES[number];
export type TrailOp = typeof TRAIL_OPS[number];

export interface Leg { title: string; status: RungStatus }
/** A rung is a phase holding legs, or a gate. Phases and legs are never items. */
export interface Rung { phase?: string; gate?: string; status?: RungStatus; legs?: Leg[] }
export interface TrailLine { at: string; by: string; op: TrailOp; from?: string; to?: string; note?: string }
export interface External { trello?: string; jira?: string; github?: string }

export interface WorkItem {
  id: string;
  title: string;
  objective: string;
  /** 1 epic · 0 story, task or bug · -1 subtask. A default at birth, never derived. */
  level: ItemLevel;
  /** Story, task or bug; absent reads as blank. */
  kind?: ItemKind;
  status: ItemStatus;
  flagged: boolean;
  parent: string | null;
  ladder: Rung[];
  docs: string[];
  external: External;
  trail: TrailLine[];
  created: { at: string; by: string };
}

/** What every write answers: the item as it now is, the line it appended, what the item
 * is ("w9 is a task at PLAN", "w7 is an epic, 3 items"), and who was told of an arrival. */
export interface Acknowledged { item: WorkItem; line: TrailLine; shape: string; notified?: string[] }

export class WorkItemRefused extends Error {}
export class WorkItemMissing extends Error {}
export class WorkItemBadInput extends Error {}

const ID = /^w[1-9][0-9]*$/;
export const isItemId = (value: string): boolean => ID.test(value);

const dir = () => storeDir('work_items');
const fileOf = (id: string) => path.join(dir(), `${id}.json`);

const member = <T extends readonly unknown[]>(values: T, value: unknown): value is T[number] =>
  (values as readonly unknown[]).includes(value);

let tail: Promise<unknown> = Promise.resolve();
/** The issuer lock. Every item and holder write runs inside it, one at a time. */
export function withIssuer<T>(action: () => Promise<T>): Promise<T> {
  const run = tail.then(action, action);
  tail = run.catch(() => undefined);
  return run;
}

let written = 0;
async function save(item: WorkItem): Promise<void> {
  await mkdir(dir(), { recursive: true });
  const target = fileOf(item.id);
  const tmp = `${target}.tmp-${process.pid}-${++written}`;
  await writeFile(tmp, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  await rename(tmp, target);
}

export function checkLadder(value: unknown): Rung[] {
  if (!Array.isArray(value)) throw new WorkItemBadInput('ladder must be a list of rungs.');
  return value.map((raw, index) => {
    const at = index + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new WorkItemBadInput(`rung ${at} is not an object.`);
    const r = raw as Record<string, unknown>;
    if ((typeof r.gate === 'string') === (typeof r.phase === 'string')) throw new WorkItemBadInput(`rung ${at} must be a gate OR a phase — exactly one of them.`);
    if (r.status !== undefined && !member(RUNG_STATUSES, r.status)) throw new WorkItemBadInput(`rung ${at} status must be PLANNED, ACTIVE or DONE.`);
    if (typeof r.gate === 'string') return { gate: r.gate, status: (r.status as RungStatus | undefined) ?? 'PLANNED' };
    const rung: Rung = { phase: r.phase as string, ...(r.status ? { status: r.status as RungStatus } : {}) };
    if (r.legs !== undefined) {
      if (!Array.isArray(r.legs)) throw new WorkItemBadInput(`rung ${at} legs must be a list.`);
      rung.legs = r.legs.map((leg, j) => {
        const l = (leg ?? {}) as Record<string, unknown>;
        if (typeof l.title !== 'string') throw new WorkItemBadInput(`rung ${at} leg ${j + 1} needs a "title".`);
        const status = l.status ?? 'PLANNED';
        if (!member(RUNG_STATUSES, status)) throw new WorkItemBadInput(`rung ${at} leg ${j + 1} status must be PLANNED, ACTIVE or DONE.`);
        return { title: l.title, status };
      });
    }
    return rung;
  });
}

/** An item file in the shape it was written in, read in today's: `stage` is the status, a
 * red colour is flagged, `exit` and the other colours go, no level reads 0. */
export function inShape(raw: Record<string, unknown>): WorkItem {
  const { stage, exit: _exit, status, flagged, level, kind, ...rest } = raw;
  void _exit;
  return {
    ...(rest as unknown as WorkItem),
    level: member(ITEM_LEVELS, level) ? level : 0,
    ...(member(ITEM_KINDS, kind) ? { kind } : {}),
    status: member(ITEM_STATUSES, status) ? status : member(ITEM_STATUSES, stage) ? stage : 'IDEA',
    flagged: typeof flagged === 'boolean' ? flagged : status === 'red',
    external: (rest.external && typeof rest.external === 'object' ? rest.external : {}) as External,
  };
}

async function load(id: string): Promise<WorkItem> {
  if (!isItemId(id)) throw new WorkItemMissing(`"${id}" is not a work item id; ids look like w12.`);
  try {
    return inShape(JSON.parse(await readFile(fileOf(id), 'utf8')) as Record<string, unknown>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new WorkItemMissing(`No work item ${id}.`);
    throw error;
  }
}

export async function readItem(id: string): Promise<WorkItem | null> {
  try { return await load(id); } catch (error) {
    if (error instanceof WorkItemMissing) return null;
    throw error;
  }
}

export async function listItems(): Promise<WorkItem[]> {
  let names: string[];
  try { names = await readdir(dir()); } catch { return []; }
  const ids = names.filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).filter(isItemId);
  const items = await Promise.all(ids.map((id) => readItem(id)));
  return items.filter((item): item is WorkItem => item !== null).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

async function nextId(): Promise<string> {
  let names: string[] = [];
  try { names = await readdir(dir()); } catch { /* an empty store issues w1 */ }
  const top = names.reduce((max, name) => {
    const match = /^w([1-9][0-9]*)\.json$/.exec(name);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `w${top + 1}`;
}

const lineOf = (by: string, op: TrailOp, extra: Omit<TrailLine, 'at' | 'by' | 'op'> = {}): TrailLine => ({
  at: new Date().toISOString(), by: by.trim() || 'unknown', op,
  ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined && value !== '')),
});

/** "w7 is an epic, 3 items", "w9 is a task at PLAN", "w12 is a subtask at BUILD, flagged":
 * the level and kind as stored, the children counted. */
export async function kindOf(item: WorkItem): Promise<string> {
  const flag = item.flagged ? ', flagged' : '';
  if (item.level === 1) {
    const children = (await listItems()).filter((other) => other.parent === item.id).length;
    return `${item.id} is an epic, ${children} item${children === 1 ? '' : 's'}${flag}`;
  }
  const word = item.level === -1 ? 'subtask' : item.kind ?? 'work item';
  return `${item.id} is a ${word} at ${item.status}${flag}`;
}

/** Read, change, append one trail line, write. Runs inside the issuer lock. */
const answer = async (item: WorkItem, line: TrailLine): Promise<Acknowledged> => ({ item, line, shape: await kindOf(item) });

export async function appendTrail(id: string, by: string, change: (item: WorkItem) => Omit<TrailLine, 'at' | 'by'>): Promise<Acknowledged> {
  const item = await load(id);
  const { op, ...extra } = change(item);
  const line = lineOf(by, op, extra);
  item.trail.push(line);
  await save(item);
  return answer(item, line);
}

export interface NewItem {
  title: string;
  objective?: string;
  status?: string;
  parent?: string | null;
  level?: number;
  kind?: string;
  /** Held from birth by this Team or Agent, in the same call and the same trail line. */
  holder?: Holder;
  ladder?: Rung[];
  docs?: string[];
}

function checkFields(fields: { status?: unknown; kind?: unknown; level?: unknown; flagged?: unknown }): void {
  if (fields.kind !== undefined && fields.kind !== '' && !member(ITEM_KINDS, fields.kind)) throw new WorkItemBadInput(`kind must be one of ${ITEM_KINDS.join(', ')}, or blank.`);
  if (fields.status !== undefined && !member(ITEM_STATUSES, fields.status)) throw new WorkItemBadInput(`status must be one of ${ITEM_STATUSES.join(', ')}.`);
  if (fields.level !== undefined && !member(ITEM_LEVELS, fields.level)) throw new WorkItemBadInput('level must be 1, 0 or -1.');
  if (fields.flagged !== undefined && typeof fields.flagged !== 'boolean') throw new WorkItemBadInput('flagged must be true or false.');
}

/** One below the parent, 0 with none (Jira's hierarchy). A default, never a guard. */
const levelUnder = (parent: WorkItem | null): ItemLevel => parent ? (Math.max(-1, parent.level - 1) as ItemLevel) : 0;

const blank = (title: string, by: string): WorkItem => ({
  id: '', title, objective: '', level: 0, status: 'IDEA', flagged: false, parent: null,
  ladder: [], docs: [], external: {}, trail: [], created: { at: new Date().toISOString(), by: by.trim() || 'unknown' },
});

/** An arrival under a held epic is announced to its holder, one queued message: to the
 * Agent, or to a holding Team's lead. An epic held by nobody notifies nobody. */
async function announceArrival(item: WorkItem): Promise<string[]> {
  if (!item.parent) return [];
  const told: string[] = [];
  for (const holder of await holdersOf(item.parent)) {
    const targets = holder.kind === 'agent' ? [holder.name] : await findLeads(holder.name);
    for (const target of targets) {
      await enqueueMessage(target, `${item.id} ${item.title} was added under your epic ${item.parent}. Handle it as you see fit.`, 'house', 'Work items');
      told.push(target);
    }
  }
  return told;
}

/** Issue an id and write the item. Unlocked: callers hold the issuer. */
export async function createItemUnlocked(input: NewItem, by: string): Promise<Acknowledged> {
  const title = String(input.title ?? '').trim();
  if (!title) throw new WorkItemBadInput('A work item needs a title.');
  checkFields(input);
  const parent = input.parent ? await load(input.parent) : null;
  const item: WorkItem = {
    ...blank(title, by),
    id: await nextId(),
    objective: String(input.objective ?? '').trim(),
    level: (input.level as ItemLevel | undefined) ?? levelUnder(parent),
    ...(input.kind ? { kind: input.kind as ItemKind } : {}),
    status: (input.status as ItemStatus | undefined) ?? 'IDEA',
    parent: parent?.id ?? null,
    ladder: input.ladder ?? [],
    docs: input.docs ?? [],
  };
  const list = input.holder ? await listFor(input.holder) : null;
  await save(item);
  if (list) { await list.set([...list.holds, item.id]); await ackHolds([input.holder ?? null], by); }
  const line = lineOf(by, 'create', { to: input.holder ? holderLabel(input.holder) : 'none', note: [item.title, item.parent ? `under ${item.parent}` : 'no parent'].join('; ') });
  item.trail.push(line);
  await save(item);
  return { ...(await answer(item, line)), notified: await announceArrival(item) };
}

export const createItem = (input: NewItem, by: string) => withIssuer(() => createItemUnlocked(input, by));

export interface ItemEdit { title?: string; objective?: string; status?: string; level?: number; kind?: string; flagged?: boolean; external?: Partial<Record<keyof External, string>> }

/** One call, one trail line: a lone status change is named by its own op; anything else is edit. */
export function editItem(id: string, edit: ItemEdit, by: string, note?: string): Promise<Acknowledged> {
  checkFields(edit);
  if (edit.title !== undefined && !String(edit.title).trim()) throw new WorkItemBadInput('title cannot be empty.');
  return withIssuer(() => appendTrail(id, by, (item) => {
    const changed: string[] = [];
    const before = item.status;
    if (edit.title !== undefined && edit.title.trim() !== item.title) { item.title = edit.title.trim(); changed.push('title'); }
    if (edit.objective !== undefined && edit.objective.trim() !== item.objective) { item.objective = edit.objective.trim(); changed.push('objective'); }
    if (edit.status !== undefined && edit.status !== item.status) { item.status = edit.status as ItemStatus; changed.push('status'); }
    if (edit.level !== undefined && edit.level !== item.level) { item.level = edit.level as ItemLevel; changed.push('level'); }
    if (edit.kind !== undefined && edit.kind !== (item.kind ?? '')) {
      if (edit.kind) item.kind = edit.kind as ItemKind; else delete item.kind;
      changed.push('kind');
    }
    if (edit.flagged !== undefined && edit.flagged !== item.flagged) { item.flagged = edit.flagged; changed.push(edit.flagged ? 'flagged' : 'unflagged'); }
    for (const [key, value] of Object.entries(edit.external ?? {}) as Array<[keyof External, string]>) {
      if ((item.external[key] ?? '') === value.trim()) continue;
      if (value.trim()) item.external[key] = value.trim(); else delete item.external[key];
      changed.push(key);
    }
    const said = note || undefined;
    if (changed.length === 1 && changed[0] === 'status') return { op: 'status', from: before, to: item.status, note: said };
    return { op: 'edit', note: [said, changed.length ? changed.join(', ') : 'no change'].filter(Boolean).join('; ') };
  }));
}

/** Evidence is a fact with its receipt: one trail line on the named item. */
export function addEvidence(id: string, fact: string, by: string): Promise<Acknowledged> {
  const text = String(fact ?? '').trim();
  if (!text) throw new WorkItemBadInput('evidence needs the fact, with its receipt.');
  return withIssuer(() => appendTrail(id, by, () => ({ op: 'evidence', note: text })));
}

/** Documents live on the item. Paths are absolute and must exist when listed. */
function docsChange(change: { add?: string; remove?: string }): { target: string; add: boolean } {
  const add = change.add?.trim();
  const remove = change.remove?.trim();
  if (Boolean(add) === Boolean(remove)) throw new WorkItemBadInput('docs takes one of add or remove, one path at a time.');
  const target = (add || remove)!;
  if (!path.isAbsolute(target)) throw new WorkItemBadInput(`${target} is not an absolute path.`);
  if (add) {
    if (!existsSync(target)) throw new WorkItemBadInput(`no such file: ${target}`);
    if (statSync(target).isDirectory()) throw new WorkItemBadInput(`${target} is a directory; the list holds documents.`);
  }
  return { target, add: Boolean(add) };
}

function applyDocs(item: WorkItem, { target, add }: { target: string; add: boolean }): Omit<TrailLine, 'at' | 'by'> {
  const kept = item.docs.filter((doc) => doc !== target);
  item.docs = add ? [target, ...kept] : kept;
  return { op: 'edit', note: `${add ? 'doc listed' : 'doc unlisted'}: ${target}` };
}

export function writeDocs(id: string, change: { add?: string; remove?: string }, by: string): Promise<Acknowledged> {
  const docs = docsChange(change);
  return withIssuer(() => appendTrail(id, by, (item) => applyDocs(item, docs)));
}

/** MOVE (Jira's convert/move): the parent and the level change together, one below the new
 * parent, 0 with none. Refused: a parent chain that comes back to the item, and an item
 * with subtasks, in one plain line. */
export function moveItem(id: string, parent: string | null, by: string): Promise<Acknowledged> {
  return withIssuer(async () => {
    const child = await load(id);
    if ((await listItems()).some((item) => item.parent === id && item.level === -1)) throw new WorkItemRefused(`${id} has subtasks and can't move.`);
    let under: WorkItem | null = null;
    if (parent) {
      under = await load(parent);
      const chain = [id];
      let at: string | null = parent;
      while (at) {
        chain.push(at);
        if (at === id) throw new WorkItemRefused(`REFUSED: ${id} under ${parent} would form a cycle: ${chain.join(' → ')}.`);
        at = (await load(at)).parent;
      }
    }
    const from = child.parent ?? 'none';
    child.parent = parent;
    child.level = levelUnder(under);
    const line = lineOf(by, 'move', { from, to: parent ?? 'none', note: `level ${child.level}` });
    child.trail.push(line);
    await save(child);
    return { ...(await answer(child, line)), notified: await announceArrival(child) };
  });
}

/* HOLDING — a list of item ids on each Team (roster.holds) and each Agent (the letter's
 * holds). Assignment moves an id between lists and never touches the item's content or
 * parent; release takes it off every list. Both run under the issuer lock, so two
 * concurrent assigns leave the id on exactly one list. */

export type Holder = { kind: 'team' | 'agent'; name: string };
export const holderLabel = (holder: Holder): string => `${holder.kind}:${holder.name}`;

interface HeldList { holder: Holder; holds: string[]; set(holds: string[]): Promise<unknown> }

async function heldLists(): Promise<HeldList[]> {
  const teams = (await listTeamRosters()).map((roster): HeldList => ({
    holder: { kind: 'team', name: roster.name },
    holds: roster.holds,
    set: (holds) => writeTeamRoster(roster.name, { holds }, roster.campaign_id),
  }));
  const agents = (await listLetterHolds()).map((letter): HeldList => ({
    holder: { kind: 'agent', name: letter.name },
    holds: letter.holds,
    set: (holds) => writeLetterHolds(letter.key, holds),
  }));
  return [...teams, ...agents];
}

async function listFor(holder: Holder): Promise<HeldList> {
  if (holder.kind === 'team') {
    const roster = await readTeamRoster(holder.name);
    if (!roster) throw new WorkItemBadInput(`Team "${holder.name}" has no roster.`);
    return { holder, holds: roster.holds, set: (holds) => writeTeamRoster(roster.name, { holds }, roster.campaign_id) };
  }
  const key = await sessionKey(holder.name);
  const letter = await readLetterHolds(key) ?? (await seedTegami(holder.name) ? await readLetterHolds(key) : null);
  if (!letter) throw new WorkItemBadInput(`Agent "${holder.name}" has no work record to hold work in.`);
  return { holder, holds: letter.holds, set: (holds) => writeLetterHolds(key, holds) };
}

/** Every id on any holder's list, with the holder that has it. */
export async function heldIds(): Promise<Map<string, Holder>> {
  const out = new Map<string, Holder>();
  for (const list of await heldLists()) for (const id of list.holds) out.set(id, list.holder);
  return out;
}

/** Who holds this id now: nobody, or (after any old race) everyone found with it. */
export async function holdersOf(id: string): Promise<Holder[]> {
  return (await heldLists()).filter((list) => list.holds.includes(id)).map((list) => list.holder);
}

async function takeOffEveryList(id: string, except?: Holder): Promise<Holder[]> {
  const from: Holder[] = [];
  for (const list of await heldLists()) {
    if (!list.holds.includes(id)) continue;
    from.push(list.holder);
    if (except && holderLabel(list.holder) === holderLabel(except)) continue;
    await list.set(list.holds.filter((held) => held !== id));
  }
  return from;
}

const labels = (holders: Holder[]): string => holders.length ? holders.map(holderLabel).join(', ') : 'none';

/** The ack (tegami.ts ackRecord) to every Agent whose holds this move changed; a Team's holds are its roster, so its lead's. */
async function ackHolds(holders: Array<Holder | null>, by: string): Promise<void> {
  const seen = new Set<string>();
  for (const holder of holders) {
    if (!holder || seen.has(holderLabel(holder))) continue;
    seen.add(holderLabel(holder));
    await (holder.kind === 'agent' ? ackRecord(holder.name, by) : teamChanged([holder.name], by));
  }
}

export async function assignUnlocked(id: string, to: Holder, by: string, note?: string): Promise<Acknowledged> {
  await load(id);
  const target = await listFor(to);
  const from = await takeOffEveryList(id, to);
  if (!target.holds.includes(id)) await target.set([...target.holds, id]);
  await ackHolds([...from, to], by);
  return appendTrail(id, by, () => ({ op: 'assign', from: labels(from), to: holderLabel(to), note }));
}

export const assignItem = (id: string, to: Holder, by: string, note?: string) => withIssuer(() => assignUnlocked(id, to, by, note));

/** Park: the id leaves every list. It is found again under its parent, or unassigned. */
export function releaseItem(id: string, by: string, note?: string): Promise<Acknowledged> {
  return withIssuer(async () => {
    await load(id);
    const from = await takeOffEveryList(id);
    await ackHolds(from, by);
    return appendTrail(id, by, () => ({ op: 'release', from: labels(from), to: 'none', note }));
  });
}

/** Point an Agent's focus at an item it holds. The focus is the letter's, not the item's. */
export async function focusItem(session: string, id: string): Promise<boolean> {
  return withIssuer(async () => {
    const key = await sessionKey(session);
    const letter = await readLetterHolds(key);
    if (!letter?.holds.includes(id)) return false;
    await writeLetterHolds(key, letter.holds, id);
    return true;
  });
}

/** Acknowledgements nag, tools do not: every acknowledgement that touches an item ends
 * with this line, naming the item and the writes that keep it current. */
export function keepCurrentLine({ item, line, shape }: Acknowledged): string {
  const what = line.op === 'status' ? `moved to ${line.to}`
    : line.op === 'assign' ? `is held by ${line.to}`
      : line.op === 'release' || line.op === 'holder-ended' ? 'is held by nobody'
        : line.op === 'create' ? 'was created'
          : `changed (${line.op})`;
  return `${item.id} ${what}; ${shape}. Keep it current: item write ${item.id} --objective "<what it is now>"; item evidence ${item.id} "<a fact with its receipt>"`;
}

/* THE LADDER LIVES ON EVERY ITEM, children or not (owner, 2026-10-22: moving it to the
 * first child was a bug). `item plan <id>` writes it, the item always named. An Agent's
 * work record shows the ladder of its focus item. Phases and legs are never items. */

export type LadderEdit = string[];

/** The field verbs, applied in order: phase, gate, rung, leg, status, drop. Positions are
 * N or N.M as the rung sits on the ladder. Returns what each did. */
export function applyLadderEdits(ladder: Rung[], edits: LadderEdit[]): string[] {
  const said: string[] = [];
  const pos = (word: string, verb: string, want?: 'rung' | 'leg'): { rung: Rung; leg: Leg | null } => {
    const parts = String(word ?? '').split('.');
    if (parts.length > 2 || !parts.every((part) => /^\d+$/.test(part))) throw new WorkItemBadInput(`${verb} takes a position as item read prints it — N or N.M — not "${word}".`);
    const ri = Number(parts[0]);
    const li = parts[1] === undefined ? null : Number(parts[1]);
    if (ri < 1 || ri > ladder.length) throw new WorkItemBadInput(`${verb}: rung ${ri} is out of range (1..${ladder.length}).`);
    const rung = ladder[ri - 1]!;
    if (li === null) {
      if (want === 'leg') throw new WorkItemBadInput(`${verb}: rung ${ri} is a ${rung.gate !== undefined ? 'gate' : 'phase'} — name a leg, N.M.`);
      return { rung, leg: null };
    }
    if (rung.gate !== undefined) throw new WorkItemBadInput(`${verb}: rung ${ri} is a gate and has no legs.`);
    const legs = rung.legs ?? [];
    if (li < 1 || li > legs.length) throw new WorkItemBadInput(`${verb}: rung ${ri} has ${legs.length} leg(s); ${li} is out of range.`);
    return { rung, leg: legs[li - 1]! };
  };
  for (const [verb, a = '', b = ''] of edits) {
    if (verb === 'phase') { ladder.push({ phase: a.trim(), status: 'PLANNED', legs: [] }); said.push(`phase ${ladder.length} added`); }
    else if (verb === 'gate') { ladder.push({ gate: a.trim(), status: 'PLANNED' }); said.push(`gate ${ladder.length} added`); }
    else if (verb === 'rung') {
      const { rung } = pos(a, '--rung', 'rung');
      if (rung.gate !== undefined) rung.gate = b.trim(); else rung.phase = b.trim();
      said.push(`rung ${a} retitled`);
    } else if (verb === 'leg') {
      if (a.includes('.')) { pos(a, '--leg', 'leg').leg!.title = b.trim(); said.push(`leg ${a} retitled`); }
      else {
        const { rung } = pos(a, '--leg', 'rung');
        if (rung.gate !== undefined) throw new WorkItemBadInput(`--leg: rung ${a} is a gate; legs belong to a phase.`);
        (rung.legs ??= []).push({ title: b.trim(), status: 'PLANNED' });
        said.push(`leg ${a}.${rung.legs.length} added`);
      }
    } else if (verb === 'status') {
      const status = b.trim().toUpperCase();
      if (!member(RUNG_STATUSES, status)) throw new WorkItemBadInput(`--status takes PLANNED, ACTIVE or DONE, not "${b}".`);
      const { rung, leg } = pos(a, '--status');
      (leg ?? rung).status = status;
      said.push(`${a} -> ${status}`);
    } else if (verb === 'drop') {
      const { rung, leg } = pos(a, '--drop');
      if (leg) rung.legs = (rung.legs ?? []).filter((x) => x !== leg);
      else ladder.splice(ladder.indexOf(rung), 1);
      said.push(`${a} dropped`);
    } else throw new WorkItemBadInput(`unknown ladder verb "${verb}".`);
  }
  return said;
}

export interface LadderWrite { edits?: LadderEdit[]; ladder?: unknown }

/** The verbs in order, or a whole ladder: one trail line on the named item. */
export function writePlan(id: string, change: LadderWrite, by: string): Promise<Acknowledged & { said: string[] }> {
  const whole = change.ladder === undefined ? undefined : checkLadder(change.ladder);
  return withIssuer(async () => {
    let said: string[] = [];
    const done = await appendTrail(id, by, (item) => {
      if (whole) { item.ladder = whole; said = [`ladder saved (${whole.length} rungs)`]; }
      else { const next = structuredClone(item.ladder); said = applyLadderEdits(next, change.edits ?? []); item.ladder = next; }
      return { op: 'edit', note: `ladder: ${said.join('; ')}` };
    });
    return { ...done, said };
  });
}

/** An Agent going away takes its list with it: each item it held gets one holder-ended
 * line and is found again under its parent or unassigned. Restore does not reclaim. */
export function releaseHolder(session: string, key: string, how: string): Promise<Acknowledged[]> {
  return withIssuer(async () => {
    const letter = await readLetterHolds(key);
    if (!letter?.holds.length) return [];
    const released: Acknowledged[] = [];
    for (const id of letter.holds) {
      if (!(await readItem(id))) continue;
      released.push(await appendTrail(id, 'ronin', () => ({ op: 'holder-ended', from: `agent:${session}`, to: 'none', note: how })));
    }
    await writeLetterHolds(key, []);
    return released;
  });
}

/* THE ONE MIGRATION (WORK_ITEM_BUILDOUT cut 2): every item file in today's shape. stage →
 * status, red → flagged, exit dropped; an item with children gets level 1, every other 0;
 * the Unfiled epic (or the former "Common" root) goes and its items have no parent; kind
 * stays as stored. An item already in shape is left alone, so a second run changes nothing.
 * Holder lists are not touched: an id left on one names nothing and reads as nothing. */
export function migrateItems(by = 'ronin'): Promise<{ before: number; after: number; migrated: string[]; removed: string[] }> {
  return withIssuer(async () => {
    let names: string[] = [];
    try { names = await readdir(dir()); } catch { return { before: 0, after: 0, migrated: [], removed: [] }; }
    const raws = new Map<string, Record<string, unknown>>();
    for (const name of names) {
      const id = name.endsWith('.json') ? name.slice(0, -5) : '';
      if (isItemId(id)) raws.set(id, JSON.parse(await readFile(fileOf(id), 'utf8')) as Record<string, unknown>);
    }
    const before = raws.size;
    const removed = [...raws].filter(([, raw]) => raw.parent === null && (raw.title === 'Unfiled' || raw.title === 'Common') && !('level' in raw)).map(([id]) => id);
    for (const id of removed) { await rm(fileOf(id)); raws.delete(id); }
    const parents = new Set([...raws.values()].map((raw) => raw.parent));
    const migrated: string[] = [];
    for (const [id, raw] of raws) {
      const unfiled = removed.includes(String(raw.parent));
      if ('level' in raw && 'flagged' in raw && !('stage' in raw) && !('exit' in raw) && !unfiled) continue;
      const item = inShape({ ...raw, ...('level' in raw ? {} : { level: parents.has(id) ? 1 : 0 }) });
      if (unfiled) item.parent = null;
      item.trail.push(lineOf(by, 'edit', { note: `migrated to the Jira shape${unfiled ? `; ${raw.parent} (Unfiled) went, so no parent` : ''}` }));
      await save(item);
      migrated.push(id);
    }
    return { before, after: raws.size, migrated, removed };
  });
}
