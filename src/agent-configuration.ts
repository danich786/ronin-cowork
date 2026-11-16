/**
 * BRIEF UPDATES (docs/architecture/brief.md, The work record is the source of truth; The brief). Only a
 * configuration change (the Configuration's Send, or being made lead) rebuilds the brief, from
 * the record set at birth with that change; when the brief came out different, the Agent is
 * sent only the difference: the facts that changed, and the behaviours and tools that came into
 * play or left it. A changed default never reaches a live Agent. Items and the objective are on
 * the record but not in the brief, so they send nothing.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readAgentComposition, writeCurrentRole } from './agent-composition.js';
import type { Mandate } from './agent-defaults.js';
import { AGENT_BRIEF, describePacket, writeBriefPacketAt } from './birth-brief.js';
import { readAgentBriefAt, workRecordBrief, writeAgentBriefAt, type AgentBrief, type ComposedBrief } from './brief-build.js';
import { briefTold, LAYERS, layerOf, resolveBrief } from './brief-settings.js';
import { briefChanges, briefSnapshot, renderBrief, type BriefSnapshot } from './brief.js';
import type { BriefRecord } from './brief-record.js';
import { readCatalogs } from './catalog.js';
import { enqueueMessage } from './message-queue.js';
import { personByEmail, type Person } from './office-people.js';
import { sessionDir, sessionKey } from './session-dir.js';
import { resolveBriefFor, resolveFacts, type SpawnForm } from './spawn.js';
import { teamChanged } from './tegami.js';
import { readBriefRecord, writeBriefRecord, writeMandate, writeObjective } from './tegami.js';
import { getCampaign, getLeads, getTags, listSessions, setLeads, setSessionTitle, setTags } from './tmux.js';

type Receipt = { team?: string; kind?: string; template?: string; user_email?: string; told?: Array<{ name?: string }> };

const receiptOf = async (dir: string): Promise<Receipt> =>
  JSON.parse(await readFile(path.join(dir, 'birth-receipt.json'), 'utf8').catch(() => '{}')) as Receipt;

/** The person an Agent works for (hosted), from its birth receipt; null self-hosted or unknown. */
export async function callerUser(name: string): Promise<Person | null> {
  if (!name) return null;
  try {
    const email = (await receiptOf(sessionDir(await sessionKey(name)))).user_email;
    return email ? personByEmail(email) : null;
  } catch { return null; }
}

const snapshotFile = (dir: string): string => path.join(dir, 'brief-told.json');

/** What the Agent was told (only that: the values are the work record's `brief`), written at launch beside its packet. */
export async function readSnapshotAt(dir: string): Promise<BriefSnapshot> {
  return JSON.parse(await readFile(snapshotFile(dir), 'utf8')) as BriefSnapshot;
}

export async function writeSnapshotAt(dir: string, composed: ComposedBrief): Promise<void> {
  const target = snapshotFile(dir);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(briefSnapshot(composed.resolved))}\n`, 'utf8');
  await rename(temp, target);
}

/**
 * The Agent's brief: the brief record on its work record, with only its configuration (title,
 * role, Team, lead, mandate, its own brief settings) as it is set now, over today's files
 * (docs/architecture/brief.md, The work record is the source of truth). Defaults that changed
 * since birth (user, machine, Campaign, Workspace, Team, a connection) don't move the record. A
 * Team the configuration moved it to brings that Team's values: its Setting, Workspace and
 * Team settings.
 */
export async function currentBrief(name: string): Promise<{ dir: string; composed: ComposedBrief }> {
  const [{ dir, composed: now }, born] = await Promise.all([configuredBrief(name), readBriefRecord(name)]);
  const moved = born.agent.team !== now.record.agent.team;
  const { provider, model, harness, launch_mode } = born.agent;
  const record: BriefRecord = {
    ...born,
    session: { ...born.session, title: now.record.session.title },
    agent: { ...now.record.agent, provider, model, harness, launch_mode },
    setting: moved ? now.record.setting : born.setting,
  };
  const set = Object.fromEntries(now.layers.map((layer) => [layer.layer, layer.brief]));
  const settings = { ...born.brief_settings, agent: set.agent, ...(moved ? { team: set.team, workspace: set.workspace } : {}) };
  const layers = LAYERS.map((layer) => layerOf(layer, { brief: settings[layer] }));
  const resolved = resolveBrief(await readCatalogs(), record, layers);
  return { dir, composed: { record, layers, cascade: now.cascade, resolved, text: renderBrief(name, record, resolved) } };
}

/** The brief as the Agent's configuration and every default stand now. */
async function configuredBrief(name: string): Promise<{ dir: string; composed: ComposedBrief }> {
  const dir = sessionDir(await sessionKey(name));
  const receipt = await receiptOf(dir);
  const user = receipt.user_email ? personByEmail(receipt.user_email) : null;
  const [composition, tags, leads, campaign, agent, sessions] = await Promise.all([
    readAgentComposition(name), getTags(name), getLeads(name), getCampaign(name), readAgentBriefAt(dir), listSessions(),
  ]);
  const team = receipt.team && tags.includes(receipt.team) ? receipt.team : tags[0] ?? '';
  const identity = sessions.find((row) => row.name === name)?.identity;
  const form: SpawnForm = {
    session_type: 'cowork_agent',
    name,
    team: team || undefined,
    team_lead: !!team && leads.includes(team),
    campaign_id: campaign || undefined,
    kind: receipt.kind,
    template: receipt.template,
    mandate: composition.current.mandate,
    role: composition.current.role,
    ...(user ? { person: user } : {}),
    ...agent,
  };
  const facts = await resolveFacts(form, new Set());
  const composed = await resolveBriefFor(form, facts, {
    provider: identity?.provider ?? '', model: identity?.model ?? '', harness: identity?.cli ?? '',
    launch_mode: composition.current.launch_mode,
  });
  if (!composed) throw new Error(`@${name} has no brief.`);
  return { dir, composed };
}

/** Whether an Agent works under project management: its brief told it the item model
 * (docs/architecture/brief.md, Layers and brief settings). An Agent with no readable record is not under it. */
export async function projectManagementOn(name: string): Promise<boolean> {
  try { return !!(await readSnapshotAt(sessionDir(await sessionKey(name)))).told['project-management']; } catch { return false; }
}

/** What the brief carries now, each with why; `since_birth` marks what birth did not tell. */
export async function configurationSends(name: string) {
  const { dir, composed } = await currentBrief(name);
  const born = await readSnapshotAt(dir);
  return briefTold(composed.resolved).map((row) => ({ ...row, since_birth: !!born && row.kind !== 'facts' && !born.told[row.name] }));
}

/**
 * Rebuild the Agent's brief: write it as AGENT_BRIEF.md (the birth brief stays as written) and
 * its record onto the work record; when it differs from what it was last told, send the
 * difference once. Returns the packet path, and whether anything was sent.
 */
export async function refreshBrief(name: string): Promise<{ brief: string; sent: boolean }> {
  const { dir, composed } = await currentBrief(name);
  const [before, was] = await Promise.all([readSnapshotAt(dir), readBriefRecord(name)]);
  const changes = briefChanges(before, was, composed.resolved, composed.record);
  const brief = await writeBriefPacketAt(dir, composed.text, name, AGENT_BRIEF);
  await writeBriefRecord(name, workRecordBrief(composed));
  await writeSnapshotAt(dir, composed);
  if (!changes) return { brief, sent: false };
  const packet = await describePacket(brief, name);
  await enqueueMessage(name, `Your brief changed:\n\n${changes}\n\nThe whole brief: ${brief} (ends with "${packet.terminator}").`, 'house');
  return { brief, sent: true };
}

type ConfigurationUpdate = {
  objective: string; title: string; role: 'coworker' | 'lead' | 'epic_lead' | 'coordinator'; team: string;
  mandate: Mandate; agent: AgentBrief; by: string;
};

/** The one act: write the record, then refresh the brief. */
export async function updateConfiguration(name: string, next: ConfigurationUpdate): Promise<{ brief: string; sent: boolean }> {
  const before = await readAgentComposition(name);
  const dir = sessionDir(await sessionKey(name));
  const beforeTeams = await getTags(name);
  const teams = next.team ? [next.team] : [];
  const wantedLeads = next.role === 'lead' && next.team ? [next.team] : [];
  const beforeLeads = await getLeads(name);
  if (next.objective.trim() !== before.current.objective) await writeObjective(name, next.objective, next.by);
  if (next.title.trim() !== before.current.title) await setSessionTitle(name, next.title);
  const changedTeam = JSON.stringify(beforeTeams) !== JSON.stringify(teams) || JSON.stringify(beforeLeads) !== JSON.stringify(wantedLeads);
  if (JSON.stringify(beforeTeams) !== JSON.stringify(teams)) await setTags(name, teams);
  if (JSON.stringify(beforeLeads) !== JSON.stringify(wantedLeads)) await setLeads(name, wantedLeads);
  if (before.current.role !== next.role) await writeCurrentRole(name, next.role);
  if (changedTeam) await teamChanged([...new Set([...beforeTeams, ...teams])], next.by, name).catch(() => {});
  if (JSON.stringify(before.current.mandate) !== JSON.stringify(next.mandate)) await writeMandate(name, next.mandate);
  await writeAgentBriefAt(dir, next.agent);
  return refreshBrief(name);
}
