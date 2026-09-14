import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-machine-settings-campaigns-'));
process.env.RONIN_CONFIG_DIR = root;
process.env.RONIN_CATALOGS_DIR = path.join(root, 'catalogs');
process.env.RONIN_CAMPAIGNS_DIR = path.join(root, 'campaigns');

const {
  archiveCampaign,
  createCampaign,
  initialCampaign,
  isValidCampaignId,
  listCampaigns,
  readCampaign,
  writeCampaign,
} = await import('../src/campaigns.js');

test('campaign ids remain safe stable tokens', () => {
  assert.equal(isValidCampaignId('home_machine'), true);
  for (const id of ['', '../x', 'two words', '.hidden', 'A']) {
    assert.equal(isValidCampaignId(id), false);
  }
});

test('a pre-installation-cascade campaign gets stock defaults without a rewrite', async () => {
  const file = path.join(root, 'machine_settings.json');
  const old = JSON.stringify({ campaigns: { home_machine: {
    id: 'home_machine', title: 'Ronin Home', desk: {}, config: {
      defaults: { behaviours: [] },
      services: { parts: { michi: true, kanban: false, rireki: true, koe: true } },
    },
  } } }, null, 2) + '\n';
  await fs.writeFile(file, old, 'utf8');
  const campaign = await readCampaign('home_machine');
  assert.equal('features' in (campaign?.config.defaults ?? {}), false);
  assert.deepEqual(campaign?.config.defaults.behaviours, ['mandates']);
  assert.equal(campaign?.config.services.parts.task_manager, true, 'either legacy half enables the indivisible Task manager');
  assert.equal(campaign?.config.services.parts.voice_hotwords, false, 'legacy voice never opts into the capability');
  assert.equal(campaign?.config.services.parts.terminal_transcript, false, 'legacy recording never opts into the capability');
  assert.equal(await fs.readFile(file, 'utf8'), old, 'reading the old shape does not migrate it');
  await fs.writeFile(file, JSON.stringify({ campaigns: {} }, null, 2) + '\n', 'utf8');
});

test('campaigns share the machine configuration document', async () => {
  const created = await createCampaign({
    id: 'alpha',
    title: 'Alpha',
    description: 'First body of work',
    config: { cowork_defaults: { arrangement: 'two' } },
  });
  assert.deepEqual(created.config.services.parts, {
    task_manager: false,
    terminal_transcript: false,
    voice_hotwords: false,
    usage_stats: false,
    project_coordinator: false,
    local_weights: false,
  }, 'new Campaigns make all six capability defaults explicitly off');
  assert.equal((await readCampaign('alpha'))?.title, 'Alpha');

  await writeCampaign('alpha', { description: 'Current body of work' });
  const edited = await readCampaign('alpha');
  assert.equal(edited?.description, 'Current body of work');
  assert.deepEqual(edited?.config.cowork_defaults, { arrangement: 'two' });
  await writeCampaign('alpha', { config: { services: { parts: { task_manager: true, voice_hotwords: false, future_capability: true } } } });
  assert.deepEqual((await readCampaign('alpha'))?.config.services.parts, {
    task_manager: true, voice_hotwords: false, future_capability: true,
  });
  assert.equal(edited?.created_at, created.created_at);

  const document = JSON.parse(
    await fs.readFile(path.join(root, 'machine_settings.json'), 'utf8'),
  ) as Record<string, unknown>;
  assert.ok((document.campaigns as Record<string, unknown>).alpha);
  assert.deepEqual((await fs.readdir(root)).filter((name) => name.endsWith('.json')), [
    'machine_settings.json',
  ]);
});

test('campaign list order and archive state are deterministic', async () => {
  await createCampaign({ id: 'beta', title: 'Beta' });
  assert.deepEqual((await listCampaigns()).map((campaign) => campaign.id), ['alpha', 'beta']);
  await archiveCampaign('alpha');
  assert.equal((await readCampaign('alpha'))?.state, 'archived');
  assert.equal((await initialCampaign())?.id, 'alpha');
});

test('unknown campaign edits report the missing record', async () => {
  await assert.rejects(() => writeCampaign('missing', { title: 'Missing' }), /does not exist/);
});

test.after(async () => fs.rm(root, { recursive: true, force: true }));
