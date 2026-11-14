/**
 * BRIEF UPDATES (wip/BRIEF_MODEL.md §5, §7). Any change to what an Agent's brief depends on
 * rebuilds the brief from today's files over its record; when the brief came out different, the
 * Agent is sent only the difference: the facts that changed, and the behaviours and tools that
 * came into play or left it. Items and the objective are on the record but not in the brief, so
 * they send nothing.
 *
 * UPDATE (owner, 2026-10-24) is one such change: the Configuration writes the record, then
 * refreshes the brief.
 */
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readAgentComposition, writeCurrentRole } from './agent-composition.js';
import type { Mandate } from './agent-defaults.js';
import { describePacket, writeBriefPacketAt } from './birth-brief.js';
import { readAgentBriefAt, writeAgentBriefAt, type AgentBrief, type ComposedBrief } from './brief-build.js';
import { briefTold } from './brief-settings.js';
import { briefChanges, briefSnapshot, type BriefSnapshot } from './brief.js';
import { enqueueMessage } from './message-queue.js';
import { sessionDir, sessionKey } from './session-dir.js';
import { resolveBriefFor, resolveFacts, type SpawnForm } from './spawn.js';
import { teamChanged } from './tegami.js';
import { writeMandate, writeObjective } from './tegami.js';
import { getCampaign, getLeads, getTags, listSessions, setLeads, setSessionTitle, setTags } from './tmux.js';

type Receipt = { team?: string; kind?: string; template?: string; told?: Array<{ name?: string }> };

const snapshotFile = (dir: string): string => path.join(dir, 'brief-told.json');

export async function readSnapshotAt(dir: string): Promise<BriefSnapshot | null> {
  try { return JSON.parse(await readFile(snapshotFile(dir), 'utf8')) as BriefSnapshot; } catch { return null; }
}

export async function writeSnapshotAt(dir: string, composed: ComposedBrief): Promise<void> {
  const target = snapshotFile(dir);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(briefSnapshot(composed.resolved, composed.record))}\n`, 'utf8');
  await rename(temp, target);
}

/** The Agent's brief as its record stands now, over today's files. */
export async function currentBrief(name: string): Promise<{ dir: string; composed: ComposedBrief }> {
  const dir = sessionDir(await sessionKey(name));
  const receipt = JSON.parse(await readFile(path.join(dir, 'birth-receipt.json'), 'utf8').catch(() => '{}')) as Receipt;
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
 * (wip/BRIEF_MODEL.md §6). An Agent with no readable record is not under it. */
export async function projectManagementOn(name: string): Promise<boolean> {
  try { return !!(await readSnapshotAt(sessionDir(await sessionKey(name))))?.told['project-management']; } catch { return false; }
}

/** What the brief carries now, each with why; `since_birth` marks what birth did not tell. */
export async function configurationSends(name: string) {
  const { dir, composed } = await currentBrief(name);
  const born = await readSnapshotAt(dir);
  return briefTold(composed.resolved).map((row) => ({ ...row, since_birth: !!born && row.kind !== 'facts' && !born.told[row.name] }));
}

/**
 * Rebuild the Agent's brief; when it differs from what it was last told, write the new packet
 * and send the difference once. Returns the packet path, and whether anything was sent.
 */
export async function refreshBrief(name: string): Promise<{ brief: string; sent: boolean }> {
  const { dir, composed } = await currentBrief(name);
  const before = await readSnapshotAt(dir) ?? { facts: {}, told: {} };
  const changes = briefChanges(before, composed.resolved, composed.record);
  const brief = await writeBriefPacketAt(dir, composed.text, name);
  await writeSnapshotAt(dir, composed);
  if (!changes) return { brief, sent: false };
  const packet = await describePacket(brief, name);
  await enqueueMessage(name, `Your brief changed:\n\n${changes}\n\nThe whole brief: ${brief} (ends with "${packet.terminator}").`, 'house');
  return { brief, sent: true };
}

/** Rebuild every live Agent's brief, after a layer (user, Campaign, Workspace, Team) changed. */
export async function refreshAllBriefs(): Promise<void> {
  for (const session of await listSessions()) {
    if ((session.identity?.sessionType || 'cowork_agent') !== 'cowork_agent') continue;
    await refreshBrief(session.name).catch(() => {});
  }
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
