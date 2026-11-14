/**
 * THE BRIEF ROUTES (docs/architecture/brief.md, Layers and brief settings; The brief; Where it is set in the UI): the catalog for the pickers, each layer's
 * brief settings, the New Agent preview worked out by the server, the packet on the tile, and
 * the user's own facts, behaviours and tools.
 */
import type express from 'express';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { refreshAllBriefs } from '../agent-configuration.js';
import { BIRTH_BRIEF } from '../birth-brief.js';
import { briefOff, briefTold, cascade, layerOf, readUserLayer, userBriefFile, type Layer, type LayerName } from '../brief-settings.js';
import { BehaviourDocumentError, createBehaviourDocument, readBehaviourDocument, updateBehaviourDocument } from '../behaviour-documents.js';
import { initialCampaignId } from '../campaign-scope.js';
import { listCampaigns, readCampaign, writeCampaign } from '../campaigns.js';
import { readCatalogs } from '../catalog.js';
import { CONDITIONALS } from '../conditionals.js';
import { person } from '../office-people.js';
import { sessionDir, sessionKey } from '../session-dir.js';
import { resolveBriefFor, resolveFacts, type SpawnForm } from '../spawn.js';
import { listTeamRosters, readTeamRoster, writeTeamRoster } from '../team-rosters.js';
import { listWorkspaces, readWorkspace, saveWorkspace } from '../workspaces.js';

const errMsg = (e: unknown): string => String((e as Error)?.message ?? e);
const SETTING_LAYERS = ['user', 'campaign', 'workspace', 'team'] as const;
type SettingLayer = typeof SETTING_LAYERS[number];

/** A layer's own record, and the layers above it. */
async function layerAt(layer: SettingLayer, id: string, campaignId: string): Promise<{ own: Layer; above: Layer[] }> {
  const user = await readUserLayer();
  if (layer === 'user') return { own: user, above: [] };
  const campaign = await readCampaign(campaignId);
  if (!campaign) throw new BehaviourDocumentError(`Unknown Campaign: ${campaignId || '(none)'}.`, 404);
  const campaignLayer = layerOf('campaign', campaign.config);
  if (layer === 'campaign') return { own: campaignLayer, above: [user] };
  if (layer === 'workspace') {
    const workspace = await readWorkspace(campaignId, id);
    if (!workspace) throw new BehaviourDocumentError(`No Workspace "${id}".`, 404);
    return { own: layerOf('workspace', workspace), above: [user, campaignLayer] };
  }
  const roster = await readTeamRoster(id, campaignId) ?? await readTeamRoster(id, '');
  if (!roster) throw new BehaviourDocumentError(`No Team "${id}".`, 404);
  const workspace = roster.workspace ? await readWorkspace(roster.campaign_id || campaignId, roster.workspace) : null;
  return { own: layerOf('team', roster), above: [user, campaignLayer, ...(workspace ? [layerOf('workspace', workspace)] : [])] };
}

const shown = (own: Layer, above: Layer[]) => ({
  brief: own.brief,
  integrations: own.integrations,
  pm: own.pm ?? null,
  inherited: cascade(above),
});

async function writeLayer(layer: SettingLayer, id: string, campaignId: string, body: Record<string, unknown>): Promise<void> {
  const next = layerOf(layer as LayerName, body);
  const pm = body.pm === undefined ? undefined : typeof body.pm === 'boolean' ? body.pm : null;
  if (layer === 'user') {
    const current = await readUserLayer();
    const value = {
      brief: body.brief === undefined ? current.brief : next.brief,
      integrations: body.integrations === undefined ? current.integrations : next.integrations,
      ...((pm === undefined ? current.pm : pm ?? undefined) !== undefined ? { pm: pm === undefined ? current.pm : pm } : {}),
    };
    const file = userBriefFile();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(`${file}.tmp`, file);
  } else if (layer === 'campaign') {
    await writeCampaign(campaignId, { config: {
      ...(body.brief !== undefined ? { brief: next.brief } : {}),
      ...(body.integrations !== undefined ? { integrations: next.integrations } : {}),
      ...(pm !== undefined ? { pm } : {}),
    } });
  } else if (layer === 'workspace') {
    const workspace = await readWorkspace(campaignId, id);
    if (!workspace) throw new BehaviourDocumentError(`No Workspace "${id}".`, 404);
    const kept = new Map(workspace.integrations.map((row) => [row.provider, row]));
    const { pm: _pm, ...rest } = workspace;
    await saveWorkspace({
      ...rest,
      ...(body.brief !== undefined ? { brief: next.brief } : {}),
      ...(body.integrations !== undefined ? { integrations: next.integrations.map((name) => kept.get(name) ?? { provider: name }) } : {}),
      ...((pm === undefined ? workspace.pm : pm) != null ? { pm: (pm === undefined ? workspace.pm : pm) as boolean } : {}),
    });
  } else {
    const roster = await readTeamRoster(id, campaignId) ?? await readTeamRoster(id, '');
    if (!roster) throw new BehaviourDocumentError(`No Team "${id}".`, 404);
    await writeTeamRoster(id, {
      ...(body.brief !== undefined ? { brief: next.brief } : {}),
      ...(body.integrations !== undefined ? { integrations: next.integrations } : {}),
      ...(pm !== undefined ? { pm } : {}),
    }, roster.campaign_id);
  }
}

/** A draft Agent as the New Agent form has it; the server fills in what it knows itself. */
function draftForm(body: Record<string, unknown>): SpawnForm {
  const type = String(body.type ?? body.session_type ?? 'cowork_agent');
  const role = ['coworker', 'lead', 'epic_lead', 'coordinator'].includes(String(body.role)) ? String(body.role) as SpawnForm['role'] : 'coworker';
  return {
    session_type: type === 'bare_metal_agent' ? 'bare_metal_agent' : 'cowork_agent',
    name: String(body.name ?? '').trim() || 'new_agent',
    campaign_id: String(body.campaign_id ?? body.campaign ?? '').trim() || undefined,
    team: String(body.team ?? '').trim() || undefined,
    workspace: String(body.workspace ?? '').trim() || undefined,
    team_lead: role === 'lead',
    role,
    template: typeof body.template === 'string' ? body.template : undefined,
    prompt: String(body.instructions ?? body.prompt ?? ''),
    ...(typeof body.desk === 'boolean' ? { desk: body.desk } : {}),
    ...(typeof body.checkout === 'boolean' ? { checkout: body.checkout } : {}),
    ...layerOf('agent', body),
  };
}

export function registerBrief(app: express.Express): void {
  // (a) The catalog, for the pickers.
  app.get('/api/brief/catalog', async (_req, res) => {
    try {
      const catalog = await readCatalogs();
      res.json([...catalog.facts, ...catalog.behaviours, ...catalog.tools].map((row) => ({
        kind: row.kind.replace(/s$/, ''), name: row.name, title: row.title, seed: row.seed, line: row.line,
        depth: row.depth, when: row.when, serves: row.serves, mandate: row.mandate, value: row.value, with: row.with,
        order: row.order === Number.MAX_SAFE_INTEGER ? null : row.order, path: row.file, origin: row.origin,
      })));
    } catch (e) { res.status(500).json({ error: errMsg(e) }); }
  });

  // The conditional words, for the `when:` picker: those of docs/architecture/brief.md, Conditionals, and integration:<name> for each
  // integration a layer names or a catalog file already uses. Any other name is the user's to type.
  app.get('/api/brief/conditionals', async (_req, res) => {
    try {
      const names = new Set<string>((await readUserLayer()).integrations);
      for (const campaign of await listCampaigns()) {
        for (const name of campaign.config.integrations) names.add(name);
        for (const workspace of await listWorkspaces(campaign.id)) for (const row of workspace.integrations) names.add(row.provider);
      }
      for (const roster of await listTeamRosters()) for (const name of roster.integrations) names.add(name);
      const catalog = await readCatalogs();
      for (const row of [...catalog.facts, ...catalog.behaviours, ...catalog.tools]) {
        for (const word of row.when) if (word.replace(/^!/, '').startsWith('integration:')) names.add(word.replace(/^!/, '').slice('integration:'.length));
      }
      res.json([...CONDITIONALS.filter((word) => word !== 'integration:<name>'), ...[...names].filter(Boolean).sort().map((name) => `integration:${name}`)]);
    } catch (e) { res.status(500).json({ error: errMsg(e) }); }
  });

  // (b) One layer's brief settings, and what it inherits.
  app.get('/api/brief/settings/:layer/:id', async (req, res) => {
    const layer = req.params.layer as SettingLayer;
    if (!SETTING_LAYERS.includes(layer)) return res.status(400).json({ error: 'layer is user, campaign, workspace or team.' });
    try {
      const campaignId = layer === 'campaign' ? req.params.id : String(req.query.campaign_id ?? '').trim() || await initialCampaignId();
      const { own, above } = await layerAt(layer, req.params.id, campaignId);
      res.json(shown(own, above));
    } catch (e) { res.status(e instanceof BehaviourDocumentError ? e.status : 500).json({ error: errMsg(e) }); }
  });

  app.put('/api/brief/settings/:layer/:id', async (req, res) => {
    const layer = req.params.layer as SettingLayer;
    if (!SETTING_LAYERS.includes(layer)) return res.status(400).json({ error: 'layer is user, campaign, workspace or team.' });
    try {
      const campaignId = layer === 'campaign' ? req.params.id : String(req.query.campaign_id ?? req.body?.campaign_id ?? '').trim() || await initialCampaignId();
      await writeLayer(layer, req.params.id, campaignId, (req.body ?? {}) as Record<string, unknown>);
      // A layer changed: every Agent's brief is rebuilt, and each is sent only what differs.
      void refreshAllBriefs().catch(() => {});
      const { own, above } = await layerAt(layer, req.params.id, campaignId);
      res.json(shown(own, above));
    } catch (e) { res.status(e instanceof BehaviourDocumentError ? e.status : 500).json({ error: errMsg(e) }); }
  });

  // (c) What a draft Agent would be told, each with why, and where its integrations come from.
  app.post('/api/brief/preview', async (req, res) => {
    try {
      const form = draftForm((req.body ?? {}) as Record<string, unknown>);
      const who = person(req);
      if (who) form.person = who;
      const facts = await resolveFacts(form, new Set());
      const composed = await resolveBriefFor(form, facts);
      if (!composed) return res.json({ in_play: [], integrations: {}, pm: { on: false }, off: [] });
      res.json({
        in_play: briefTold(composed.resolved), integrations: composed.cascade.integrations, pm: composed.cascade.pm,
        off: briefOff(await readCatalogs(), composed.layers),
      });
    } catch (e) { res.status(400).json({ error: errMsg(e) }); }
  });

  // (d) The packet, for the bottom of the work record on the tile.
  app.get('/api/sessions/:name/brief', async (req, res) => {
    try {
      const text = await readFile(path.join(sessionDir(await sessionKey(req.params.name)), BIRTH_BRIEF), 'utf8');
      res.type('text/markdown').send(text);
    } catch { res.status(404).json({ error: 'No brief for that session.' }); }
  });

  // The user's own facts, behaviours and tools: read, write their own, replace a stock one by name.
  app.get('/api/brief/files/:kind/:name', async (req, res) => {
    try { res.json(await readBehaviourDocument(req.params.kind, req.params.name)); }
    catch (e) { res.status(e instanceof BehaviourDocumentError ? e.status : 500).json({ error: errMsg(e) }); }
  });
  app.post('/api/brief/files', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const made = await createBehaviourDocument({ name: body.name, text: body.text, shadow: body.shadow, scope: body.kind ?? body.scope });
      void refreshAllBriefs().catch(() => {});
      res.status(201).json(made);
    } catch (e) { res.status(e instanceof BehaviourDocumentError ? e.status : 500).json({ error: errMsg(e) }); }
  });
  app.put('/api/brief/files/:kind/:name', async (req, res) => {
    try {
      const saved = await updateBehaviourDocument({ ...req.body, scope: req.params.kind, name: req.params.name });
      void refreshAllBriefs().catch(() => {});
      res.json(saved);
    }
    catch (e) { res.status(e instanceof BehaviourDocumentError ? e.status : 500).json({ error: errMsg(e) }); }
  });
}
