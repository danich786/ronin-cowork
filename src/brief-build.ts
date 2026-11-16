/**
 * BUILDING A BRIEF (docs/architecture/brief.md, The work record is the source of truth; Layers and brief settings; The brief): the record from what Ronin knows of an Agent,
 * its layers, what is in play, and the packet. Launch, an Update, a record change and the New
 * Agent preview all come through `composeBrief`, so they cannot disagree.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BriefRecord, BriefSettings, SessionType } from './brief-record.js';
import { cascade, layerOf, readUserLayer, resolveBrief, type Cascade, type Layer, type Resolved } from './brief-settings.js';
import { renderBrief } from './brief.js';
import { catalogIntegrations, readCatalogs, type Catalog } from './catalog.js';
import type { CampaignSettings } from './campaigns.js';
import { offeredTo, readMcpRecords, type McpRecord } from './mcp-records.js';
import { isHostedOffice, officePeople } from './office-people.js';
import { listTeamRosters } from './team-rosters.js';
import type { LaunchFacts, SpawnForm } from './spawn.js';
import { mandate } from './agent-defaults.js';
import { listDeskRecords } from './desks/registry.js';
import type { WorkRecordBrief } from './tegami.js';
import { jiraConnected } from './work-items.js';

/** The Agent's own layer, as a launch body or the work record carries it. */
export interface AgentBrief { brief: BriefSettings; integrations: string[]; pm?: boolean }

export const agentBriefFile = (dir: string): string => path.join(dir, 'composition-brief.json');

export async function readAgentBriefAt(dir: string): Promise<AgentBrief> {
  try {
    const layer = layerOf('agent', JSON.parse(await readFile(agentBriefFile(dir), 'utf8')));
    return { brief: layer.brief, integrations: layer.integrations, ...(layer.pm !== undefined ? { pm: layer.pm } : {}) };
  } catch {
    return { brief: { add: [], block: [], only: [] }, integrations: [] };
  }
}

export async function writeAgentBriefAt(dir: string, value: AgentBrief): Promise<void> {
  const target = agentBriefFile(dir);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, target);
}

/** The MCP servers a Campaign is offered: on at its layer (Offered is on). A record named as a
 * curated bridge is that bridge's way through the broker, not an MCP server of its own. */
export async function offeredMcp(campaign: string, catalog?: Pick<Catalog, 'behaviours'>): Promise<McpRecord[]> {
  const bridges = new Set(catalogIntegrations(catalog ?? await readCatalogs()).map((row) => row.name));
  return (await readMcpRecords()).filter((record) => !bridges.has(record.name) && offeredTo(record, campaign));
}

/** The Campaign's layer: its own settings, Jira when the Campaign is paired (so pm is on), and
 * the MCP servers offered to it. */
export async function campaignLayer(campaign: { id: string; config: Pick<CampaignSettings, 'integrations'> } | null | undefined, catalog?: Pick<Catalog, 'behaviours'>): Promise<Layer> {
  if (!campaign) return layerOf('campaign', {});
  const offered = (await offeredMcp(campaign.id, catalog)).map((record) => record.name);
  const jira = jiraConnected(campaign.id) ? ['jira'] : [];
  return layerOf('campaign', { ...campaign.config, integrations: [...campaign.config.integrations, ...jira, ...offered] });
}

/** The layers widest first: user, Campaign, Workspace, Team, Agent. */
export async function briefLayers(facts: Pick<LaunchFacts, 'campaign' | 'workspace' | 'roster'>, agent: AgentBrief, catalog?: Pick<Catalog, 'behaviours'>): Promise<Layer[]> {
  return [
    await readUserLayer(),
    await campaignLayer(facts.campaign, catalog),
    layerOf('workspace', facts.workspace ?? {}),
    layerOf('team', facts.roster ?? {}),
    layerOf('agent', agent),
  ];
}

const sessionType = (form: SpawnForm): SessionType =>
  form.house_seat === 'mika' ? 'mika' : form.session_type === 'bare_metal_agent' ? 'bare' : 'cowork';

/** Every value the brief depends on, read where it lives (docs/architecture/brief.md, The work record is the source of truth). */
export async function buildBriefRecord(form: SpawnForm, facts: LaunchFacts, on: Cascade, launch: { provider?: string; model?: string; harness?: string; launch_mode?: BriefRecord['agent']['launch_mode'] } = {}, catalog?: Pick<Catalog, 'behaviours'>, teamOn: Cascade = on): Promise<BriefRecord> {
  const held = mandate(form.mandate ?? {
    reach: facts.parentSeed?.seeds.reach.value,
    recruit: facts.parentSeed?.seeds.recruit.value,
    output: facts.parentSeed?.seeds.output.value,
  });
  const role = form.role ?? (form.team_lead ? 'lead' : 'coworker');
  const campaignId = facts.campaign?.id ?? '';
  const newOwner = !(await listTeamRosters()).some((roster) => roster.campaign_id === campaignId && roster.state !== 'archived');
  const person = form.person;
  return {
    session: {
      name: facts.name,
      title: '',
      type: sessionType(form),
      template: form.template ?? '',
      task: form.prompt?.trim() ?? '',
    },
    user: {
      name: person?.name ?? '',
      email: person?.email ?? '',
      first_name: person?.first_name ?? '',
      last_name: person?.last_name ?? '',
      nickname: person?.nickname ?? '',
      role: person ? person.role ?? '' : 'owner',
      organization: person?.organization ?? '',
      job_title: person?.job_title ?? '',
      time_zone: person?.time_zone ?? '',
      language: person?.language ?? '',
      planned_use: person?.planned_use ?? [],
      planned_use_other: person?.planned_use_other ?? '',
      technical_level: person?.technical_level ?? '',
      ai_experience: person?.ai_experience ?? '',
      about: person?.about ?? '',
      new_owner: newOwner,
      account: '',
    },
    people: officePeople().map((p) => ({ ...p, role: p.role ?? '' })),
    setting: {
      hosted: isHostedOffice(),
      campaign: campaignId,
      workspace: facts.workspace?.name ?? '',
      instructions: facts.workspace?.instructions ?? '',
      integrations: Object.keys(on.integrations),
      mcp: (await offeredMcp(campaignId, catalog)).filter((record) => on.integrations[record.name]).map((record) => ({ name: record.name, description: record.description })),
      pm: on.pm.on,
      services: facts.installations.filter((row) => row.enabled).map((row) => row.name),
    },
    agent: {
      role,
      team: form.team ?? '',
      lead: !!form.team && !!form.team_lead,
      wipeboard: facts.roster?.wipeboard ?? form.team ?? '',
      team_objective: facts.roster?.objective ?? '',
      // The lead's brief says what its Team has on.
      team_integrations: form.team && role === 'lead' ? Object.keys(teamOn.integrations) : [],
      reach: held.reach,
      recruit: held.recruit,
      output: held.output,
      provider: launch.provider ?? '',
      model: launch.model ?? '',
      harness: launch.harness ?? '',
      launch_mode: launch.launch_mode ?? 'configured',
    },
    work: {
      repos: facts.repositories.map((repo) => repo.name),
      where: facts.repositories.map((repo) => ({ repo: repo.name, held: repo.managed ? 'desk' as const : 'checkout' as const })),
      repo_lines: facts.repositories.map((repo) =>
        `- ${repo.name} ${repo.dir} — ${repo.managed ? `worktree: \`worktree-desk open ${repo.name}\`` : 'shared checkout'}${repo.note ? ` (${repo.note})` : ''}`).join('\n'),
      folder_lines: facts.folders.map((folder) => `- ${folder.name} ${folder.dir}${folder.note ? ` — ${folder.note}` : ''}`).join('\n'),
      // A desk holds when one is cut for this Agent (its desk record), not when its repos could have one.
      desk: form.desk ?? (await listDeskRecords({ owner: facts.name }).catch(() => [])).length > 0,
      checkout: form.checkout ?? facts.arrangement === 'checkout',
    },
  };
}

export interface ComposedBrief { record: BriefRecord; layers: Layer[]; cascade: Cascade; resolved: Resolved; text: string }

/** What the work record's `brief` key holds: the record, and each layer's brief settings. */
export const workRecordBrief = (composed: ComposedBrief): WorkRecordBrief => ({
  ...composed.record,
  brief_settings: Object.fromEntries(composed.layers.map((layer) => [layer.layer, layer.brief])),
});

/** The whole brief for an Agent: record, layers, what is in play, and the packet text. */
export async function composeBrief(form: SpawnForm, facts: LaunchFacts, agent: AgentBrief, launch?: Parameters<typeof buildBriefRecord>[3]): Promise<ComposedBrief> {
  const catalog = await readCatalogs();
  const layers = await briefLayers(facts, agent, catalog);
  const on = cascade(layers);
  const record = await buildBriefRecord(form, facts, on, launch, catalog, cascade(layers.filter((layer) => layer.layer !== 'agent')));
  const resolved = resolveBrief(catalog, record, layers);
  return { record, layers, cascade: on, resolved, text: renderBrief(facts.name, record, resolved) };
}

/** The Agent's own layer from a launch body or a configuration: `brief`, `integrations`, `pm`. */
export function agentBriefOf(body: unknown): AgentBrief {
  const layer = layerOf('agent', body);
  return { brief: layer.brief, integrations: layer.integrations, ...(layer.pm !== undefined ? { pm: layer.pm } : {}) };
}
