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

type Receipt = { team?: string; cmd?: string; kind?: string };

export async function resendBirthBrief(name: string): Promise<{ readme: string }> {
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
  const readme = await compileBirthReadmeAt(dir, resolved.birth_reading, name, isShelfTeaching);
  await enqueueMessage(name, `Your birth brief was rebuilt from today's files. Read ${readme} now, top to bottom; it ends with the line "${packetEndLine(name)}".`, 'house');
  return { readme };
}
