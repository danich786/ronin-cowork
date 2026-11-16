/**
 * BRIEF UPDATES (docs/architecture/brief.md, The work record is the source of truth; The brief).
 * The work record's `brief` document is the session's one authority. Only an explicit
 * configuration change (the Configuration's Send, or being made lead) edits it; the edited
 * document goes through the same builder as birth (`buildBrief`), and when the brief comes out
 * different the Agent is sent only the difference. Nothing else is read: no default, machine
 * setting, receipt, snapshot, tmux tag or other work-record key. The objective, items, flags,
 * watches, documents and desks are dynamic and never rebuild the brief.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readAgentComposition } from './agent-composition.js';
import type { Mandate } from './agent-defaults.js';
import { AGENT_BRIEF, describePacket, writeBriefPacketAt } from './birth-brief.js';
import { buildBrief, composeBrief, type AgentBrief, type BriefDocument } from './brief-build.js';
import type { AgentRole } from './brief-record.js';
import { briefTold } from './brief-settings.js';
import { briefChanges } from './brief.js';
import { readCatalogs } from './catalog.js';
import { enqueueMessage } from './message-queue.js';
import { personByEmail, type Person } from './office-people.js';
import { sessionDir, sessionKey } from './session-dir.js';
import { resolveFacts, type SpawnForm } from './spawn.js';
import { readBriefRecord, teamChanged, writeBriefRecord, writeMandate, writeObjective } from './tegami.js';
import { getLeads, getTags, setLeads, setSessionTitle, setTags } from './tmux.js';

/** The person an Agent works for (hosted), from its birth receipt; null self-hosted or unknown.
 * The launcher's identity for session_create, not a brief input. */
export async function callerUser(name: string): Promise<Person | null> {
  if (!name) return null;
  try {
    const receipt = JSON.parse(await readFile(path.join(sessionDir(await sessionKey(name)), 'birth-receipt.json'), 'utf8').catch(() => '{}')) as { user_email?: string };
    return receipt.user_email ? personByEmail(receipt.user_email) : null;
  } catch { return null; }
}

/** Whether an Agent works under project management: its brief tells it the item model. */
export async function projectManagementOn(name: string): Promise<boolean> {
  try {
    const built = buildBrief(await readBriefRecord(name), await readCatalogs());
    return built.resolved.behaviours.some((row) => row.name === 'project-management');
  } catch { return false; }
}

/** What the brief carries, each with why: for the Configuration. */
export async function configurationSends(name: string) {
  return briefTold(buildBrief(await readBriefRecord(name), await readCatalogs()).resolved);
}

/** What a Configuration sets on the brief document. */
export interface BriefEdit {
  title?: string;
  role?: AgentRole;
  team?: string;
  lead?: boolean;
  mandate?: Mandate;
  agent?: AgentBrief;
}

/** The Team-and-Workspace part of a brief document: what a move to another Team brings. */
export type TeamPart = Pick<BriefDocument, 'brief_settings'> & {
  agent: Pick<BriefDocument['agent'], 'team' | 'wipeboard' | 'team_objective'>;
  setting: Pick<BriefDocument['setting'], 'workspace' | 'instructions'>;
  work: Pick<BriefDocument['work'], 'repos' | 'where' | 'repo_lines' | 'folder_lines'>;
};

/** The edit applied to a document. Pure; a Team move takes the Team's part as given. */
export function editBrief(doc: BriefDocument, edit: BriefEdit, team?: TeamPart): BriefDocument {
  const role = edit.role ?? doc.agent.role;
  const teamName = team ? team.agent.team : doc.agent.team;
  return {
    ...doc,
    session: { ...doc.session, ...(edit.title !== undefined ? { title: edit.title.trim() } : {}) },
    setting: { ...doc.setting, ...(team ? team.setting : {}) },
    work: { ...doc.work, ...(team ? team.work : {}) },
    agent: {
      ...doc.agent,
      ...(team ? team.agent : {}),
      role,
      lead: edit.lead ?? (role === 'lead' && !!teamName),
      ...(edit.mandate ? { reach: edit.mandate.reach, recruit: edit.mandate.recruit, output: edit.mandate.output } : {}),
    },
    brief_settings: {
      ...doc.brief_settings,
      ...(team ? { team: team.brief_settings.team, workspace: team.brief_settings.workspace } : {}),
      ...(edit.agent ? { agent: edit.agent } : {}),
    },
  };
}

/** A move to another Team: that Team's values, resolved as the New Agent path resolves them. */
async function teamPart(doc: BriefDocument, team: string): Promise<TeamPart> {
  const form: SpawnForm = { session_type: 'cowork_agent', name: doc.session.name, team: team || undefined, campaign_id: doc.setting.campaign || undefined };
  const { doc: fresh } = await composeBrief(form, await resolveFacts(form, new Set()), { brief: { add: [], block: [], only: [] }, integrations: [] });
  return {
    agent: { team: fresh.agent.team, wipeboard: fresh.agent.wipeboard, team_objective: fresh.agent.team_objective },
    setting: { workspace: fresh.setting.workspace, instructions: fresh.setting.instructions },
    work: { repos: fresh.work.repos, where: fresh.work.where, repo_lines: fresh.work.repo_lines, folder_lines: fresh.work.folder_lines },
    brief_settings: { team: fresh.brief_settings.team, workspace: fresh.brief_settings.workspace },
  };
}

/**
 * The one route after birth: edit the document, build it, write the brief (AGENT_BRIEF.md; the
 * birth brief stays as written) and the document, and when the brief differs from the one
 * before, send the difference once.
 */
export async function configureBrief(name: string, edit: BriefEdit): Promise<{ brief: string; sent: boolean }> {
  const [was, catalog, dir] = await Promise.all([readBriefRecord(name), readCatalogs(), sessionKey(name).then(sessionDir)]);
  const moved = edit.team !== undefined && edit.team !== was.agent.team;
  const before = buildBrief(was, catalog);
  const after = buildBrief(editBrief(was, edit, moved ? await teamPart(was, edit.team!) : undefined), catalog);
  const brief = await writeBriefPacketAt(dir, after.text, name, AGENT_BRIEF);
  await writeBriefRecord(name, after.doc);
  const changes = briefChanges(before, after);
  if (!changes) return { brief, sent: false };
  const packet = await describePacket(brief, name);
  await enqueueMessage(name, `Your brief changed:\n\n${changes}\n\nThe whole brief: ${brief} (ends with "${packet.terminator}").`, 'house');
  return { brief, sent: true };
}

type ConfigurationUpdate = {
  objective: string; title: string; role: AgentRole; team: string;
  mandate: Mandate; agent: AgentBrief; by: string;
};

/** The Configuration's Send: its runtime authorities (objective, title, Team tags and leads,
 * mandate line), then the brief document through `configureBrief`. */
export async function updateConfiguration(name: string, next: ConfigurationUpdate): Promise<{ brief: string; sent: boolean }> {
  const before = await readAgentComposition(name);
  const beforeTeams = await getTags(name);
  const teams = next.team ? [next.team] : [];
  const wantedLeads = next.role === 'lead' && next.team ? [next.team] : [];
  const beforeLeads = await getLeads(name);
  if (next.objective.trim() !== before.current.objective) await writeObjective(name, next.objective, next.by);
  if (next.title.trim() !== before.current.title) await setSessionTitle(name, next.title);
  const changedTeam = JSON.stringify(beforeTeams) !== JSON.stringify(teams) || JSON.stringify(beforeLeads) !== JSON.stringify(wantedLeads);
  if (JSON.stringify(beforeTeams) !== JSON.stringify(teams)) await setTags(name, teams);
  if (JSON.stringify(beforeLeads) !== JSON.stringify(wantedLeads)) await setLeads(name, wantedLeads);
  if (changedTeam) await teamChanged([...new Set([...beforeTeams, ...teams])], next.by, name).catch(() => {});
  if (JSON.stringify(before.current.mandate) !== JSON.stringify(next.mandate)) await writeMandate(name, next.mandate);
  return configureBrief(name, { title: next.title, role: next.role, team: next.team, mandate: next.mandate, agent: next.agent });
}
