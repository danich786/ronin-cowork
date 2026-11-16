/** /api/canvases — the `canvas` tool's one door (ronin_bin/canvas, src/canvases.ts). Every command
 * names its caller (`by`); the Workspace is `workspace`, else the caller's Team's (plans.ts
 * whichWorkspace, the plan tool's rule). A create or edit answers one line, then the history. */
import type express from 'express';
import { initialCampaignId } from '../campaign-scope.js';
import { listSessions } from '../tmux.js';
import { PlanBadInput, PlanMissing, PlanRefused, whichWorkspace, type Caller } from '../plans.js';
import { CanvasBadInput, CanvasMissing, createCanvas, editCanvas, listCanvasTemplates, listCanvases, readCanvas, type CanvasAnswer } from '../canvases.js';
import { layersMayHaveChanged } from '../team-layers.js';

const text = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));

async function callerOf(source: Record<string, unknown>, req: express.Request): Promise<Caller> {
  const by = text(source.by).trim().slice(0, 128) || (/^user_/.test(req.get('x-ronin-source') ?? '') ? 'owner' : 'unknown');
  const session = (await listSessions()).find((one) => one.name === by);
  const campaign = session?.campaign_id || text(source.campaign_id).trim() || await initialCampaignId();
  return { by, campaign };
}

function failed(res: express.Response, e: unknown): void {
  const error = String((e as Error)?.message ?? e);
  if (e instanceof PlanRefused) res.status(409).json({ ok: false, refused: true, error });
  else if (e instanceof PlanMissing || e instanceof CanvasMissing) res.status(404).json({ ok: false, error });
  else if (e instanceof PlanBadInput || e instanceof CanvasBadInput) res.status(400).json({ ok: false, error: `BAD-ARG: ${error}` });
  else res.status(500).json({ ok: false, error });
}

const acted = (res: express.Response, done: CanvasAnswer) => res.json({ ok: true, acknowledgement: [done.line, done.history].filter(Boolean).join('\n') });

type Handler = (req: express.Request, res: express.Response) => Promise<unknown>;
const route = (handler: Handler): express.RequestHandler => (req, res) => { handler(req, res).catch((e) => failed(res, e)); };

export function registerCanvases(app: express.Express): void {
  app.get('/api/canvases/templates', route(async (_req, res) => {
    res.json({ ok: true, templates: (await listCanvasTemplates()).map(({ name, label, blurb, kinds, integration, origin, blocks }) => ({ name, label, blurb, kinds, integration, origin, blocks: blocks.map((b) => b.name) })) });
  }));

  app.get('/api/canvases', route(async (req, res) => {
    const w = await whichWorkspace(await callerOf(req.query as Record<string, unknown>, req), text(req.query.workspace));
    res.json({ ok: true, workspace: w.name, canvases: await listCanvases(w) });
  }));

  app.get('/api/canvases/read', route(async (req, res) => {
    const w = await whichWorkspace(await callerOf(req.query as Record<string, unknown>, req), text(req.query.workspace));
    res.json({ ok: true, canvas: await readCanvas(w, text(req.query.name).trim()) });
  }));

  app.post('/api/canvases/create', route(async (req, res) => {
    const b = req.body ?? {};
    const caller = await callerOf(b, req);
    const w = await whichWorkspace(caller, text(b.workspace));
    acted(res, await createCanvas(w, text(b.name).trim(), text(b.template).trim(), caller.by));
    layersMayHaveChanged();
  }));

  app.post('/api/canvases/edit', route(async (req, res) => {
    const b = req.body ?? {};
    const caller = await callerOf(b, req);
    const w = await whichWorkspace(caller, text(b.workspace));
    acted(res, await editCanvas(w, text(b.name).trim(), text(b.op).trim(), text(b.block), text(b.entry), text(b.line), caller.by));
    // Entries tell nobody; a removed block is not on the Team's line either (names only).
  }));
}
