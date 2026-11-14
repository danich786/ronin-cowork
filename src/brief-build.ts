/**
 * BUILDING A BRIEF (wip/BRIEF_MODEL.md §5–§7): the record from what Ronin knows of an Agent,
 * its layers, what is in play, and the packet. Launch, an Update, a record change and the New
 * Agent preview all come through `composeBrief`, so they cannot disagree.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BriefRecord, BriefSettings, SessionType } from './brief-record.js';
import { cascade, layerOf, readUserLayer, resolveBrief, type Cascade, type Layer, type Resolved } from './brief-settings.js';
import { renderBrief } from './brief.js';
import { readCatalogs } from './catalog.js';
import { isHostedOffice, officePeople } from './office-people.js';
import { listTeamRosters } from './team-rosters.js';
import type { LaunchFacts, SpawnForm } from './spawn.js';
import { mandate } from './agent-defaults.js';

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

/** The layers widest first: user, Campaign, Workspace, Team, Agent. */
export async function briefLayers(facts: Pick<LaunchFacts, 'campaign' | 'workspace' | 'roster'>, agent: AgentBrief): Promise<Layer[]> {
  return [
    await readUserLayer(),
    layerOf('campaign', facts.campaign?.config ?? {}),
    layerOf('workspace', facts.workspace ?? {}),
    layerOf('team', facts.roster ?? {}),
    layerOf('agent', agent),
  ];
}

const sessionType = (form: SpawnForm): SessionType =>
  form.house_seat === 'mika' ? 'mika' : form.session_type === 'bare_metal_agent' ? 'bare' : 'cowork';

/** Every value the brief depends on, read where it lives (§5). */
export async function buildBriefRecord(form: SpawnForm, facts: LaunchFacts, on: Cascade, launch: { provider?: string; model?: string; harness?: string; launch_mode?: BriefRecord['agent']['launch_mode'] } = {}): Promise<BriefRecord> {
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
      role: person ? person.role ?? '' : 'owner',
      organisation: person?.organization ?? '',
      new_owner: newOwner,
      experience: '',
      account: '',
    },
    people: officePeople().map((p) => ({ email: p.email, role: p.role ?? '', ...(p.name ? { name: p.name } : {}), ...(p.organization ? { organization: p.organization } : {}) })),
    setting: {
      hosted: isHostedOffice(),
      campaign: campaignId,
      workspace: facts.workspace?.name ?? '',
      instructions: facts.workspace?.instructions ?? '',
      integrations: Object.keys(on.integrations),
      pm: on.pm.on,
      services: facts.installations.filter((row) => row.enabled).map((row) => row.name),
    },
    agent: {
      role,
      team: form.team ?? '',
      lead: !!form.team && !!form.team_lead,
      wipeboard: facts.roster?.wipeboard ?? form.team ?? '',
      team_objective: facts.roster?.objective ?? '',
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
      desk: form.desk ?? facts.arrangement === 'managed',
      checkout: form.checkout ?? facts.arrangement === 'checkout',
    },
  };
}

export interface ComposedBrief { record: BriefRecord; layers: Layer[]; cascade: Cascade; resolved: Resolved; text: string }

/** The whole brief for an Agent: record, layers, what is in play, and the packet text. */
export async function composeBrief(form: SpawnForm, facts: LaunchFacts, agent: AgentBrief, launch?: Parameters<typeof buildBriefRecord>[3]): Promise<ComposedBrief> {
  const layers = await briefLayers(facts, agent);
  const on = cascade(layers);
  const record = await buildBriefRecord(form, facts, on, launch);
  const resolved = resolveBrief(await readCatalogs(), record, layers);
  return { record, layers, cascade: on, resolved, text: renderBrief(facts.name, record, resolved) };
}

/** The Agent's own layer from a launch body or a configuration: `brief`, `integrations`, `pm`. */
export function agentBriefOf(body: unknown): AgentBrief {
  const layer = layerOf('agent', body);
  return { brief: layer.brief, integrations: layer.integrations, ...(layer.pm !== undefined ? { pm: layer.pm } : {}) };
}
