/* /api/work-items* — the one door to the work item store (src/work-items.ts), and the
 * `item` tool's (ronin_bin/item): every act names its item. Every write acknowledges with
 * the item as it now is and the trail line it appended; the caller reads that before its
 * next act. The refusals (409): a level change for an item with children, a child for a subtask. */
import type express from 'express';
import {
  WorkItemBadInput, WorkItemMissing, WorkItemRefused,
  addEvidence, assignItem, createItem, editItem, focusItem, holderLabel, holdersOf, listItems, moveItem, readItem, releaseItem, writeDocs, writePlan,
  didLine, type Acknowledged, type Holder,
} from '../work-items.js';
import { agentReading, everyItemReading, teamReading, type HeldItem } from '../work-items-read.js';
import { pushTeams } from '../ws/events.js';

const text = (value: unknown): string | undefined => typeof value === 'string' ? value : value === undefined || value === null ? undefined : String(value);

/** Who called: the tool names its session; the browser is the owner. */
export function callerOf(req: express.Request): string {
  const stated = text(req.body?.by)?.trim();
  if (stated) return stated.slice(0, 128);
  return /^user_/.test(req.get('x-ronin-source') ?? '') ? 'owner' : 'unknown';
}

export const acknowledge = (res: express.Response, done: Acknowledged, extra: Record<string, unknown> = {}) =>
  res.json({
    ok: true, item: done.item, line: done.line, ...(done.notified?.length ? { notified: done.notified } : {}), ...extra,
    acknowledgement: didLine(done)
      + `${done.notified?.length ? `\nTold ${done.notified.map((name) => `@${name}`).join(', ')} of the arrival.` : ''}`,
  });

export function answerError(res: express.Response, error: unknown): void {
  const message = String((error as Error)?.message ?? error);
  if (error instanceof WorkItemRefused) res.status(409).json({ ok: false, refused: true, error: message });
  else if (error instanceof WorkItemMissing) res.status(404).json({ ok: false, error: message });
  else if (error instanceof WorkItemBadInput) res.status(400).json({ ok: false, error: `BAD-ARG: ${message}` });
  else res.status(500).json({ ok: false, error: message });
}

/** A holder is named as { team } or { session }. */
export function holderFrom(body: Record<string, unknown> | undefined): Holder {
  const team = text(body?.team)?.trim();
  const session = text(body?.session)?.trim();
  if (Boolean(team) === Boolean(session)) throw new WorkItemBadInput('name the holder as team or session, one of them.');
  return team ? { kind: 'team', name: team } : { kind: 'agent', name: session! };
}

const parsed = (value: string): unknown => {
  try { return JSON.parse(value); } catch (error) { throw new WorkItemBadInput(`--ladder is not valid JSON — ${(error as Error).message}`); }
};
/** The tool sends words: "-1" is a level, "true" is flagged. Anything else is passed on as it came, for the store to name. */
const levelOf = (value: unknown): number | undefined => value === undefined || value === null || value === '' ? undefined : /^-?\d+$/.test(String(value)) ? Number(value) : value as number;
const flagOf = (value: unknown): boolean | undefined => value === undefined || value === null || value === '' ? undefined : value === true || value === 'true' ? true : value === false || value === 'false' ? false : value as boolean;

type Handler = (req: express.Request, res: express.Response) => Promise<unknown>;
const guarded = (handler: Handler): express.RequestHandler => (req, res) => {
  handler(req, res).catch((error) => answerError(res, error));
};

export function registerWorkItems(app: express.Express): void {
  // Every write here moves what the teams push carries (a Team's epic and items), so the
  // server pushes the rosters again after it, as the roster routes do (teams-api.ts).
  app.use('/api/work-items', (req, res, next) => {
    if (req.method !== 'GET') res.on('finish', () => { if (res.statusCode < 400) void pushTeams(); });
    next();
  });

  app.get('/api/work-items', guarded(async (req, res) => {
    // The readings: ?session= (an Agent's), ?team= (a Team's), or every item; each narrowed
    // by ?holder=<name>, ?parent=<id> or ?no_parent=1.
    const team = text(req.query.team)?.trim();
    const session = text(req.query.session)?.trim();
    const holder = text(req.query.holder)?.trim();
    const parent = text(req.query.parent)?.trim();
    const orphans = Boolean(text(req.query.no_parent));
    if (session) return res.json({ ok: true, ...(await agentReading(session)) });
    const narrow = (items: HeldItem[]): HeldItem[] => items.filter((item) =>
      (!holder || item.holder === `agent:${holder}` || item.holder === `team:${holder}` || item.holder === holder)
      && (!parent || item.parent === parent) && (!orphans || !item.parent));
    if (team) {
      const reading = await teamReading(team);
      return res.json({ ok: true, ...reading, items: narrow(reading.items) });
    }
    res.json({ ok: true, items: narrow(await everyItemReading()) });
  }));

  app.post('/api/work-items', guarded(async (req, res) => {
    const b = req.body ?? {};
    acknowledge(res, await createItem({
      title: text(b.title) ?? '', objective: text(b.objective), status: text(b.status), kind: text(b.kind), level: levelOf(b.level), parent: text(b.parent) || null,
      ...(b.team || b.session ? { holder: holderFrom(b) } : {}),
    }, callerOf(req)));
  }));

  app.get('/api/work-items/:id', guarded(async (req, res) => {
    const item = await readItem(req.params.id);
    if (!item) throw new WorkItemMissing(`No work item ${req.params.id}.`);
    const children = (await listItems()).filter((other) => other.parent === item.id);
    res.json({ ok: true, item, held_by: (await holdersOf(item.id)).map(holderLabel), ...(children.length ? { children } : {}) });
  }));

  app.put('/api/work-items/:id', guarded(async (req, res) => {
    const b = req.body ?? {};
    const external = Object.fromEntries((['jira', 'trello', 'github'] as const).filter((key) => b[key] !== undefined).map((key) => [key, text(b[key]) ?? '']));
    acknowledge(res, await editItem(req.params.id, {
      title: text(b.title), objective: text(b.objective), status: text(b.status), kind: text(b.kind), level: levelOf(b.level), flagged: flagOf(b.flagged),
      ...(Object.keys(external).length ? { external } : {}),
    }, callerOf(req), text(b.note)));
  }));

  app.post('/api/work-items/:id/move', guarded(async (req, res) => {
    const to = text(req.body?.parent)?.trim();
    acknowledge(res, await moveItem(req.params.id, to && to !== 'none' ? to : null, callerOf(req)));
  }));
  // A holder: { team }, { session }, or { none: true } for held by nobody.
  app.post('/api/work-items/:id/assign', guarded(async (req, res) => {
    if (req.body?.none === true || req.body?.none === 'true') return acknowledge(res, await releaseItem(req.params.id, callerOf(req), text(req.body?.note)));
    acknowledge(res, await assignItem(req.params.id, holderFrom(req.body), callerOf(req), text(req.body?.note)));
  }));
  app.post('/api/work-items/:id/plan', guarded(async (req, res) => {
    const b = req.body ?? {};
    const done = await writePlan(req.params.id, {
      edits: Array.isArray(b.edits) ? b.edits.map((edit: unknown[]) => edit.map(String)) : undefined,
      ...(b.ladder !== undefined ? { ladder: typeof b.ladder === 'string' ? parsed(b.ladder) : b.ladder } : {}),
    }, callerOf(req));
    acknowledge(res, done, { said: done.said });
  }));
  app.post('/api/work-items/:id/docs', guarded(async (req, res) => {
    acknowledge(res, await writeDocs(req.params.id, { add: text(req.body?.add), remove: text(req.body?.remove) }, callerOf(req)));
  }));
  app.post('/api/work-items/:id/evidence', guarded(async (req, res) => {
    acknowledge(res, await addEvidence(req.params.id, text(req.body?.text) ?? '', callerOf(req)));
  }));
  // Which held item this Agent's work record shows. The focus is the letter's, not the item's.
  app.post('/api/work-items/:id/focus', guarded(async (req, res) => {
    const session = text(req.body?.session)?.trim();
    if (!session) throw new WorkItemBadInput('name the session whose focus this is.');
    if (!(await readItem(req.params.id))) throw new WorkItemMissing(`No work item ${req.params.id}.`);
    const moved = await focusItem(session, req.params.id);
    res.json({ ok: true, focus: moved ? req.params.id : null, acknowledgement: moved ? `@${session}'s work record now shows ${req.params.id}.` : `${req.params.id} is not held by @${session}, so the focus is unchanged.` });
  }));

  // Anything else under /api/work-items names no item (an id like surface/7 is not one):
  // a JSON 404 naming it, so a tool can say so rather than parse an HTML error page.
  app.all('/api/work-items/*', (req, res) => {
    const id = req.path.slice('/api/work-items/'.length).replace(/\/(assign|move|plan|docs|evidence|focus)$/, '');
    res.status(404).json({ ok: false, error: `No work item ${id}.` });
  });
}
