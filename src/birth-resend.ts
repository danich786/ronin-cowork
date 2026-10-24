/**
 * RESEND BIRTH BRIEF (owner, 2026-10-23): an Agent after compaction, or one born before
 * today's files, reads its brief again. The packet is rebuilt the way birth builds it —
 * resolveForm selects the behaviours, capabilities and conditions from today's files and
 * today's facts — and compiled over the session's README. The Agent gets one message: read it.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readAgentComposition } from './agent-composition.js';
import { compileBirthReadmeAt, isShelfTeaching, packetEndLine } from './birth-readme.js';
import { enqueueMessage } from './message-queue.js';
import { listBehaviours } from './resource-adapters.js';
import { sessionDir, sessionKey } from './session-dir.js';
import { resolveForm } from './spawn.js';
import { getCampaign, getLeads, getProjectRoot, getTags } from './tmux.js';

type Receipt = { team?: string; cmd?: string; kind?: string; behaviours?: Array<{ book?: string }> };

/** The one resend resolution: today's files over the Agent's current facts. */
async function resendResolution(name: string) {
  const dir = sessionDir(await sessionKey(name));
  const receipt = JSON.parse(await readFile(path.join(dir, 'birth-receipt.json'), 'utf8')) as Receipt;
  const [composition, tags, leads, projectRoot, campaign, catalog] = await Promise.all([
    readAgentComposition(name), getTags(name), getLeads(name), getProjectRoot(name), getCampaign(name), listBehaviours(),
  ]);
  const team = receipt.team && tags.includes(receipt.team) ? receipt.team : tags[0] ?? '';
  const selected = new Set(catalog.filter((row) => row.scope === 'selected').map((row) => row.name));
  const resolved = await resolveForm({
    session_type: 'cowork_agent',
    name,
    team,
    team_lead: !!team && leads.includes(team),
    project_root: projectRoot || undefined,
    campaign_id: campaign || undefined,
    cmd: receipt.cmd,
    kind: receipt.kind,
    mandate: composition.current.mandate,
    behaviours: composition.current.behaviours.map((row) => row.name).filter((book) => selected.has(book)),
  }, new Set());
  return { dir, receipt, catalog, resolved };
}

/**
 * WHAT A RESEND WOULD SEND (owner, 2026-10-24): every behaviour in the rebuilt brief, as
 * Always (floor), Because (a conditional whose requirements hold now) or Chosen.
 * `since_birth` marks a conditional the birth receipt lacks: a resend would add it.
 */
export async function resendBehaviours(name: string) {
  const { receipt, catalog, resolved } = await resendResolution(name);
  const born = new Set((receipt.behaviours ?? []).map((row) => row.book));
  const rows = new Map(catalog.map((row) => [row.name, row]));
  return resolved.behaviours.flatMap((delivered) => {
    const row = rows.get(delivered.book.replace(/^ways:/, ''));
    if (!row) return [];
    return [{
      name: row.name, label: row.label, blurb: row.blurb, path: row.page, scope: row.scope, requires: row.requires,
      since_birth: row.scope === 'conditional' && !born.has(row.name),
    }];
  });
}

export async function resendBirthBrief(name: string): Promise<{ readme: string }> {
  const { dir, resolved } = await resendResolution(name);
  const readme = await compileBirthReadmeAt(dir, resolved.birth_reading, name, isShelfTeaching);
  await enqueueMessage(name, `Your birth brief was rebuilt from today's files. Read ${readme} now, top to bottom; it ends with the line "${packetEndLine(name)}".`, 'house');
  return { readme };
}
