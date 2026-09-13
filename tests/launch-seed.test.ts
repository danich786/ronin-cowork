import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDefaults } from '../src/agent-defaults.js';
import { resolveLaunchSeed } from '../src/launch-seed.js';
import type { CampaignConfig } from '../src/campaigns.js';
import type { FeatureRow, InstallationRow } from '../src/resource-adapters.js';
import type { TeamRoster } from '../src/team-rosters.js';

const contribution = { label: '', blurb: '', origin: 'stock', shadowed: false, reading: [], reading_off: [], sops: [], macros: [], actions: [], tools: [], mcp: [], parts: [] } as const;
const installations: InstallationRow[] = [
  { ...contribution, name: 'ronin_services', effect: 'system', provides: [], requires: [], reading_off: ['routine/ronin_services/OFF.md'] },
  { ...contribution, name: 'gbrain', effect: 'feature_provider', provides: ['gbrain'], requires: [] },
];
const features: FeatureRow[] = [{ ...contribution, name: 'gbrain', provider: 'gbrain' }, { ...contribution, name: 'ronin_host', provider: '' }];
const campaign = { id: 'home_machine', config: {
  installations: { ronin_services: false, gbrain: true },
  defaults: agentDefaults({ provider: 'openai', model: 'gpt', features: ['gbrain'], behaviours: ['mandates'] }),
  cowork_defaults: {}, template_defaults: {},
} } as CampaignConfig;
const team = { name: 'alpha', campaign_id: 'home_machine', kind: 'coding', project_root: 'work', branch: 'dev',
  features: ['ronin_host'], behaviours: { selected: ['mandates'], required: ['mandates'] },
  agent_defaults: { provider: 'anthropic', model: 'opus', reach: 'execute', recruit: 'nobody', output: ['code'], dial: 'read', launch_mode: 'configured' },
} as TeamRoster;
const sources = (roster: TeamRoster | null) => ({ campaign, roster, roots: [{ name: 'home', dir: '/home', archived: false }],
  sessions: { default: { provider: 'anthropic', model: 'sonnet' } }, installations, features });

test('teamless seed exposes available features and the fixed residue', () => {
  const seed = resolveLaunchSeed(sources(null));
  assert.deepEqual(seed.available, ['gbrain', 'ronin_host']);
  assert.deepEqual(seed.seeds.features.value, ['gbrain']);
  assert.equal(seed.resolved_contributions.find((row) => row.name === 'ronin_services')?.reading[0], 'routine/ronin_services/OFF.md');
  assert.equal(seed.resolved_contributions[0]?.stated_by, 'installation');
  assert.deepEqual(seed.still_asked, ['session_type', 'name', 'instructions']);
});

test('Team complete lists replace campaign defaults and carry team provenance', () => {
  const seed = resolveLaunchSeed(sources(team));
  assert.deepEqual(seed.seeds.features.value, ['ronin_host']);
  assert.equal(seed.seeds.features.stated_by[0]?.layer, 'team');
  assert.equal(seed.seeds.project_root.stated_by[0]?.layer, 'conditional');
  assert.equal(seed.behaviours[0]?.required, true);
  assert.deepEqual(seed.seeds.behaviours.value, ['mandates']);
});

test('unavailable requested features are reported, never refused', () => {
  const off = { ...campaign, config: { ...campaign.config, installations: { ronin_services: false, gbrain: false } } };
  const seed = resolveLaunchSeed({ ...sources(null), campaign: off });
  assert.deepEqual(seed.available, ['ronin_host']);
  assert.deepEqual(seed.undelivered, ['gbrain']);
});

test('old-shape Campaign and Team inputs seed stock Mandates and no features', () => {
  const oldCampaign = { ...campaign, config: {
    defaults: agentDefaults({ features: ['gbrain'], behaviours: [] }), cowork_defaults: {}, template_defaults: {},
  } } as CampaignConfig;
  const oldTeam = { ...team, behaviours: { books: [], required: false } } as unknown as TeamRoster;
  delete (oldTeam as unknown as Record<string, unknown>).features;
  const seed = resolveLaunchSeed({ ...sources(oldTeam), campaign: oldCampaign });
  assert.deepEqual(seed.seeds.features.value, []);
  assert.deepEqual(seed.seeds.behaviours.value, ['mandates']);
});
