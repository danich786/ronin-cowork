/**
 * OFFICE READ (owner, 2026-11-19; KAN-712): the rig an Agent is sitting on, as one text any
 * Agent reads with `office read` (GET /api/office/read). Not the office record (office-record.ts),
 * which is the park's record of an office_unit. Assembled live, each time it is asked, from
 * the readers that already exist; nothing is stored. Built for Ronin Hosted, where the people come
 * from the Business Lounge's About You; an empty About You says it has not been filled in yet.
 *
 * Sections: the people and the notes on them (library/ABOUT_USER.md); the model providers signed
 * in; each Workspace with its Summary (library/workspaces/<handle>.md, KAN-713) and the Teams and
 * Agents running in it; Agents running on their own; services connected; the defaults new Agents
 * get. The lounge account is Ronin Services' (`office read` adds it when that part answers).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { storeDir } from './resources.js';
import { initialCampaignId } from './campaign-scope.js';
import { readCampaign } from './campaigns.js';
import { readAgentsSection } from './machine-state.js';
import { listWorkspaces } from './workspaces.js';
import { listTeamRosters } from './team-rosters.js';
import { listSessions } from './tmux.js';
import { readProviderSummary } from './provider-summary.js';
import { partProviderRows } from './provider-parts.js';
import { integrationsState } from './integrations.js';
import { discoverParts } from './parts.js';
import { listServices } from './sockets.js';
import { officePeople, type Person } from './office-people.js';
import { readWorkspaceSummary } from './workspace-doc.js';

/** The person's notes, any Agent's to read and add to (KAN-678). */
export const aboutUserFile = (): string => path.join(storeDir('library'), 'ABOUT_USER.md');
const NOT_FILLED = 'About You not filled in yet in the Business Lounge';
/** One person as the Lounge's About You has them; nothing there says so. */
export function personLine(p: Pick<Person, 'email' | 'role'> & Partial<Person>): string {
  const who = [p.name || [p.first_name, p.last_name].filter(Boolean).join(' '), p.nickname && `call them ${p.nickname}`].filter(Boolean).join(', ');
  const facts = [p.job_title, p.organization, p.technical_level, p.ai_experience && `AI: ${p.ai_experience}`,
    p.planned_use?.length && `plans ${[...p.planned_use, p.planned_use_other].filter(Boolean).join(', ')}`, p.time_zone, p.language].filter(Boolean);
  const head = `${who || p.email}${p.role ? ` (${p.role})` : ''}`;
  if (!who && !facts.length && !p.about) return `${head}: ${NOT_FILLED}`;
  return [head, ...facts].join(', ') + (p.about ? `. In their words: ${p.about}` : '');
}

const list = (items: string[]): string[] => (items.length ? items.map((one) => `- ${one}`) : ['- none yet']);

/** The office as it is now, as Markdown. */
export async function officeRead(): Promise<string> {
  const campaign = await initialCampaignId();
  const parts = { onDisk: discoverParts().map((part) => part.name), loaded: listServices() };
  const [notes, workspaces, rosters, sessions, summary, rows, services, office, agents] = await Promise.all([
    fs.readFile(aboutUserFile(), 'utf8').catch(() => ''), listWorkspaces(campaign).catch(() => []), listTeamRosters().catch(() => []),
    listSessions().catch(() => []), readProviderSummary().catch(() => null), partProviderRows().catch(() => []),
    integrationsState(campaign, parts).catch(() => []), readCampaign(campaign).catch(() => null),
    readAgentsSection().catch(() => ({} as Record<string, unknown>)),
  ]);
  const people = officePeople();
  const running = sessions.filter((one) => one.agent);
  const teams = rosters.filter((team) => team.state !== 'archived' && (!campaign || team.campaign_id === campaign));
  const teamLine = (team: (typeof teams)[number]): string => {
    const live = running.filter((one) => one.tags.includes(team.name)).map((one) => one.title || one.name);
    return `${team.title || team.name}: ${live.length ? live.join(', ') : 'no Agents running'}`;
  };
  const shown = await Promise.all(workspaces.map(async (w) => {
    const sum = await readWorkspaceSummary(w.name).catch(() => '');
    const inIt = teams.filter((team) => team.workspace === w.name).map(teamLine);
    return [`### ${w.title || w.name} (${w.name})`, w.objective || '', sum ? `Summary: ${sum}` : 'Summary: none yet',
      inIt.length ? `Teams: ${inIt.join('; ')}` : 'Teams: none'].filter(Boolean).join('\n');
  }));
  const inTeams = new Set(teams.map((team) => team.name));
  const alone = running.filter((one) => !one.tags.some((tag) => inTeams.has(tag))).map((one) => one.title || one.name);
  const signedIn = [...(summary?.signed_in ?? []), ...rows.filter((row) => row.operational).map((row) => row.label)];
  const connected = services.filter((one) => one.secrets.length || one.workspaces.length || one.mcp?.saved)
    .map((one) => `${one.label}${one.workspaces.length ? ` (in ${one.workspaces.join(', ')})` : ''}`);
  const model = ((agents.sessions as Record<string, unknown> | undefined)?.default ?? {}) as { provider?: string; model?: string };
  const mine = office?.config.defaults;
  const defaults = [
    `Campaign: ${office?.title || campaign || 'none'}`,
    `Default model: ${[model.provider, model.model].filter(Boolean).join(', ') || 'none set'}`,
    ...(mine ? [`New Agents: reach ${mine.reach}, recruit ${mine.recruit}, output ${mine.output.join(', ')}; Mode ${mine.launch_mode === 'configured' ? 'Native' : 'Dangerously'}`] : []),
  ];
  return [
    '# This office', '', `As of ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`, '',
    '## The people', ...list(people.length ? people.map(personLine) : [`The owner: ${NOT_FILLED}`]), '',
    '## Notes on them (library/ABOUT_USER.md)', notes.trim() || '- none yet', '',
    '## Model providers signed in', ...list(signedIn), '',
    '## Workspaces', ...(shown.length ? shown.flatMap((one) => [one, '']) : ['- none yet', '']),
    '## Agents running outside a Team', ...list(alone), '',
    '## Services connected', ...list(connected), '',
    '## Defaults', ...list(defaults), '',
  ].join('\n');
}
