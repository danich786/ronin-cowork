import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mandate } from './agent-defaults.js';
import { readAgentBriefAt } from './brief-build.js';
import { sessionDir, sessionKey } from './session-dir.js';
import { readTegami } from './tegami-read.js';
import { getLeads, getProjectRoot, getTags, listSessions } from './tmux.js';
import { listTeamRosters } from './team-rosters.js';

type Receipt = { mandate?: unknown; launch_mode?: 'configured' | 'live_dangerously'; stated_by?: unknown };
export const birthMandateFromReceipt = (receipt: Receipt) => receipt.mandate === undefined ? null : mandate(receipt.mandate);

async function receiptFor(name: string): Promise<Receipt> {
  return JSON.parse(await readFile(path.join(sessionDir(await sessionKey(name)), 'birth-receipt.json'), 'utf8')) as Receipt;
}

const roleFile = (dir: string) => path.join(dir, 'composition-role.json');
type AgentRole = 'coworker' | 'lead' | 'epic_lead' | 'coordinator';
async function currentRoleAt(dir: string, leads: string[]): Promise<AgentRole> {
  try {
    const role = JSON.parse(await readFile(roleFile(dir), 'utf8')) as unknown;
    if (['coworker', 'lead', 'epic_lead', 'coordinator'].includes(String(role))) return role as AgentRole;
  } catch {}
  return leads.length ? 'lead' : 'coworker';
}
export async function writeCurrentRole(name: string, role: AgentRole): Promise<void> {
  return writeCurrentRoleAt(sessionDir(await sessionKey(name)), role);
}
export async function writeCurrentRoleAt(dir: string, role: AgentRole): Promise<void> {
  const target = roleFile(dir);
  const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temp, `${JSON.stringify(role)}\n`, 'utf8'); await rename(temp, target);
}

export async function readAgentComposition(name: string) {
  const key = await sessionKey(name);
  const [receipt, work, brief, sessions, teams, leads, tags, projectRoot, agent] = await Promise.all([
    receiptFor(name), readTegami(name), readFile(path.join(sessionDir(key), 'brief.md'), 'utf8').catch(() => ''),
    listSessions(), listTeamRosters(), getLeads(name), getTags(name), getProjectRoot(name), readAgentBriefAt(sessionDir(key)),
  ]);
  if (!work) throw new Error(`@${name} has no readable work record`);
  const bornMandate = birthMandateFromReceipt(receipt);
  const role = await currentRoleAt(sessionDir(key), leads);
  const session = sessions.find((row) => row.name === name);
  const title = session?.title || name.split(/[_-]+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
  return {
    birth: { mandate: bornMandate, brief, provenance: receipt.stated_by ?? null },
    current: {
      objective: work.objective, title, project_root: projectRoot,
      session_type: session?.identity?.sessionType || 'cowork_agent',
      provider: session?.identity?.provider || '', model: session?.identity?.model || '',
      launch_mode: receipt.launch_mode || 'configured',
      role, team: tags[0] ?? '', mandate: work.mandate,
      // The Agent's own layer (docs/architecture/brief.md, Layers and brief settings).
      brief: agent.brief, integrations: agent.integrations, ...(agent.pm !== undefined ? { pm: agent.pm } : {}),
    },
    available_teams: teams.filter((row) => row.state !== 'archived').map((row) => ({ name: row.name, title: row.title, objective: row.objective })),
  };
}
