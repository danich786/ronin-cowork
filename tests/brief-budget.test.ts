import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

// The stock catalog only: the user's store is an empty temp folder.
const temp = await mkdtemp(path.join(os.tmpdir(), 'ronin-brief-budget-'));
process.env.RONIN_USER_ROOT = temp;
process.env.RONIN_DATA_ROOT = path.join(temp, 'data');
const { catalogIntegrations, readCatalogs } = await import('../src/catalog.js');
const { layerOf, resolveBrief } = await import('../src/brief-settings.js');
const { renderBrief } = await import('../src/brief.js');
const { PACKET_BUDGET } = await import('../src/birth-brief.js');
type BriefRecord = import('../src/brief-record.js').BriefRecord;

test.after(() => rm(temp, { recursive: true, force: true }));

test('the fullest stock brief fits one read (docs/architecture/brief.md, The brief)', async () => {
  const catalog = await readCatalogs();
  const integrations = catalogIntegrations(catalog).map((row) => row.name);
  const repos = ['ronin_cowork', 'ronin_services', 'samurai_lab'];
  // Fullest: a lead on a Team, project management and every integration on, desks cut,
  // and every optional behaviour (depth: none) added at full.
  const record: BriefRecord = {
    session: { name: 'fullest_agent', title: 'The fullest brief', type: 'cowork', template: 'coding', task: 'Plan the next release with the Team.' },
    user: {
      name: 'Alex Example', email: 'alex@example.com', first_name: 'Alex', last_name: 'Example', nickname: 'Al', role: 'owner',
      organization: 'Example Works', job_title: 'Founder', time_zone: 'Europe/London', language: 'English',
      planned_use: ['coding', 'planning', 'other'], planned_use_other: 'running the office', technical_level: 'developer',
      ai_experience: 'daily', about: 'x'.repeat(500), new_owner: false, account: 'active',
    },
    people: [
      { role: 'owner', name: 'Alex Example', nickname: 'Al', organization: 'Example Works' },
      { role: 'member', name: 'Sam Member', organization: 'Partner Ltd' },
      { role: 'member', name: 'Kim Member' },
    ] as BriefRecord['people'],
    setting: {
      hosted: false, campaign: 'home_machine', workspace: 'ronin_cowork', instructions: 'Work in small, reviewed steps.',
      integrations, pm: true, services: ['ronin_services', 'gbrain'],
    },
    agent: {
      role: 'lead', team: 'behaviours', lead: true, wipeboard: 'behaviours', team_objective: 'Ship the brief model.',
      reach: 'execute', recruit: 'staff agents', output: ['code', 'a plan'], provider: 'anthropic', model: 'claude-opus-5-5',
      harness: 'claude', launch_mode: 'configured',
    },
    work: {
      repos, where: repos.map((repo) => ({ repo, held: 'desk' as const })),
      repo_lines: repos.map((repo) => `- ${repo}: desk at /home/user/ronin/worktrees/${repo}/team/behaviours/fullest_agent`).join('\n'),
      folder_lines: '- notes /home/user/notes — shared notes\n- designs /home/user/designs',
      desk: true, checkout: false,
    },
  };
  const optional = catalog.behaviours.filter((file) => file.depth === 'none' && !file.mandate).map((file) => ({ name: file.name, depth: 'full' as const }));
  const resolved = resolveBrief(catalog, record, [layerOf('agent', { brief: { add: optional } })]);
  const text = renderBrief(record.session.name, record, resolved);
  const bytes = Buffer.byteLength(text), lines = text.split('\n').length;
  assert.ok(resolved.mandates.length >= 3, 'the mandate values are told');
  assert.ok(bytes <= PACKET_BUDGET.bytes, `${bytes} bytes over ${PACKET_BUDGET.bytes}`);
  assert.ok(lines <= PACKET_BUDGET.lines, `${lines} lines over ${PACKET_BUDGET.lines}`);
});
