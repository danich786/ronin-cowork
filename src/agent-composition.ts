import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mandate } from './agent-defaults.js';
import { listBehaviours } from './resource-adapters.js';
import { sessionDir, sessionKey } from './session-dir.js';
import { readTegami } from './tegami-read.js';
import { getLeads, getProjectRoot, getTags, listSessions } from './tmux.js';
import { listTeamRosters } from './team-rosters.js';

type Receipt = { mandate?: unknown; behaviours?: Array<{ book?: string; file?: string }>; stated_by?: unknown };
export const birthMandateFromReceipt = (receipt: Receipt) => receipt.mandate === undefined ? null : mandate(receipt.mandate);

async function receiptFor(name: string): Promise<Receipt> {
  return JSON.parse(await readFile(path.join(sessionDir(await sessionKey(name)), 'birth-receipt.json'), 'utf8')) as Receipt;
}

/** THE CURRENT CHOSEN BEHAVIOURS, one list the Configuration's Update writes whole (owner,
 * 2026-10-24): an unticked behaviour simply is not in it. Before Update there were only
 * additions to the birth list (composition-additions.json); a session that has that file and
 * not this one still reads as born plus additions. */
const behavioursFile = (dir: string) => path.join(dir, 'composition-behaviours.json');
const additionsFile = (dir: string) => path.join(dir, 'composition-additions.json');
type BehaviourRow = { name: string; path: string };
async function rowsIn(file: string): Promise<BehaviourRow[] | null> {
  try {
    const rows = JSON.parse(await readFile(file, 'utf8')) as unknown;
    return Array.isArray(rows) ? rows.flatMap((row) => row && typeof row === 'object' && typeof (row as { name?: unknown }).name === 'string'
      ? [{ name: (row as { name: string }).name, path: String((row as { path?: unknown }).path ?? '') }] : []) : [];
  } catch { return null; }
}
export async function currentBehavioursAt(dir: string, born: BehaviourRow[]): Promise<BehaviourRow[]> {
  const chosen = await rowsIn(behavioursFile(dir));
  if (chosen) return chosen;
  const additions = await rowsIn(additionsFile(dir)) ?? [];
  return [...born, ...additions.filter((row) => !born.some((item) => item.name === row.name))];
}

export async function writeCurrentBehavioursAt(dir: string, rows: BehaviourRow[]): Promise<void> {
  const target = behavioursFile(dir);
  const temp = `${target}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temp, `${JSON.stringify(rows, null, 2)}\n`, 'utf8'); await rename(temp, target);
}
export async function writeCurrentBehaviours(name: string, rows: BehaviourRow[]): Promise<void> {
  return writeCurrentBehavioursAt(sessionDir(await sessionKey(name)), rows);
}

export async function readAgentComposition(name: string) {
  const key = await sessionKey(name);
  const [receipt, work, brief, catalog, sessions, teams, leads, tags, projectRoot] = await Promise.all([
    receiptFor(name), readTegami(name), readFile(path.join(sessionDir(key), 'brief.md'), 'utf8').catch(() => ''), listBehaviours(),
    listSessions(), listTeamRosters(), getLeads(name), getTags(name), getProjectRoot(name),
  ]);
  if (!work) throw new Error(`@${name} has no readable work record`);
  const born = (receipt.behaviours ?? []).map((row) => ({ name: row.book ?? '', path: row.file ?? '' })).filter((row) => row.name);
  const bornMandate = birthMandateFromReceipt(receipt);
  const currentBehaviours = await currentBehavioursAt(sessionDir(key), born);
  const names = new Set(currentBehaviours.map((row) => row.name));
  const role = names.has('steerco_mgr') ? 'coordinator' : names.has('epic_agent') ? 'epic_lead' : leads.length ? 'lead' : 'coworker';
  const session = sessions.find((row) => row.name === name);
  const title = session?.title || name.split(/[_-]+/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
  return {
    birth: { mandate: bornMandate, behaviours: born, brief, provenance: receipt.stated_by ?? null },
    current: {
      objective: work.objective, title, project_root: projectRoot,
      role, team: tags[0] ?? '', mandate: work.mandate, behaviours: currentBehaviours,
    },
    available_teams: teams.filter((row) => row.state !== 'archived').map((row) => ({ name: row.name, title: row.title, objective: row.objective })),
    available_behaviours: catalog.filter((row) => row.scope === 'selected').map((row) => ({ name: row.name, label: row.label, blurb: row.blurb, path: row.page })),
  };
}
