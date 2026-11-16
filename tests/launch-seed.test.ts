import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDefaults } from '../src/agent-defaults.js';
import { resolveLaunchSeed, shownLaunchSeed } from '../src/launch-seed.js';
import type { CampaignConfig } from '../src/campaigns.js';
import type { BehaviourRow, InstallationRow } from '../src/resource-adapters.js';
import type { TeamRoster } from '../src/team-rosters.js';

const contribution = { label: '', blurb: '', origin: 'stock', shadowed: false, reading: [], reading_off: [], parts: [] } as const;
const installations: InstallationRow[] = [
  { ...contribution, name: 'ronin_services', effect: 'system', provides: [], requires: [], reading_off: ['routine/ronin_services/OFF.md'] },
  { ...contribution, name: 'perplexity', effect: 'provider', provides: ['perplexity'], requires: [] },
];
const behaviours: BehaviourRow[] = [
  { ...contribution, name: 'perplexity', installation: 'perplexity', page: '/perplexity.md', scope: 'selected', requires: [] },
  { ...contribution, name: 'write_it_down', installation: '', page: '/write_it_down.md', scope: 'selected', requires: [] },
  { ...contribution, name: 'mandates', installation: '', page: '/mandates.md', scope: 'floor', requires: [] },
];
const campaign = { id: 'home_machine', config: {
  installations: { ronin_services: false, perplexity: true },
  defaults: agentDefaults({ provider: 'openai', model: 'gpt', behaviours: ['perplexity', 'mandates'] }),
  cowork_defaults: {}, template_defaults: {},
} } as CampaignConfig;
const team = { name: 'alpha', campaign_id: 'home_machine', kind: 'coding', workspace: 'work', branch: 'dev',
  behaviours: { selected: ['write_it_down', 'mandates'], required: ['mandates'] },
  agent_defaults: { provider: 'anthropic', model: 'opus', reach: 'execute', recruit: 'nobody', output: ['code'] },
} as TeamRoster;
const sources = (roster: TeamRoster | null) => ({ campaign, roster, workspace: null,
  sessions: { default: { provider: 'anthropic', model: 'sonnet' } }, installations, behaviours });

test('a Team lead seed shows the lead pair; an Agent seed the Agent pair; no lead pair = the Agent pair', () => {
  const both = { default: { provider: 'anthropic', model: 'sonnet' }, lead: { provider: 'openai', model: 'gpt-lead' } };
  const lead = resolveLaunchSeed({ ...sources(team), sessions: both, lead: true });
  assert.deepEqual([lead.seeds.provider.value, lead.seeds.model.value], ['openai', 'gpt-lead']);
  const agent = resolveLaunchSeed({ ...sources(team), sessions: both });
  assert.deepEqual([agent.seeds.provider.value, agent.seeds.model.value], ['anthropic', 'sonnet'], 'the Desk pair (openai/gpt) is not read');
  const unset = resolveLaunchSeed({ ...sources(team), lead: true });
  assert.deepEqual([unset.seeds.provider.value, unset.seeds.model.value], ['anthropic', 'sonnet']);
});
