import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';

// MCP server and web API records in a temp owner store (docs/architecture/integrations.md, Who has it).
const temp = await mkdtemp(path.join(os.tmpdir(), 'ronin-mcp-records-'));
process.env.RONIN_USER_ROOT = temp;
process.env.RONIN_DATA_ROOT = path.join(temp, 'data');
const { mcpRecordsDir, readMcpRecords } = await import('../src/mcp-records.js');
const { availableRecords, briefLayers, buildBrief, campaignLayer } = await import('../src/brief-build.js');
const { readCatalogs } = await import('../src/catalog.js');
const { briefDoc } = await import('./helpers/brief-doc.js');
const { cascade, layerOf } = await import('../src/brief-settings.js');

test.after(() => rm(temp, { recursive: true, force: true }));

const record = (title: string, fields: Record<string, string>) =>
  `# ${title}\n${Object.entries(fields).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}\n`;

test('available is not on: a record is listed for its Campaigns and on only where a layer turns it on (KAN-607)', async () => {
  await mkdir(mcpRecordsDir(), { recursive: true });
  await writeFile(path.join(mcpRecordsDir(), 'wispr-flow.md'), record('Wispr Flow', { description: 'Voice dictation and transcripts.', reach: 'https://mcp.example.com/mcp', 'sign-in': 'key', secret: 'wispr-flow-api-key', campaigns: 'home_machine, client_x' }));
  await writeFile(path.join(mcpRecordsDir(), 'linear.md'), record('Linear', { description: 'Issues in Linear.', reach: 'https://mcp.linear.app/mcp', campaigns: '' }));
  await writeFile(path.join(mcpRecordsDir(), 'netlify.md'), record('Netlify', { description: 'Hosting.', reach: 'https://netlify.example/mcp' }));
  await writeFile(path.join(mcpRecordsDir(), 'old-bridge.md'), record('Old', { blurb: 'no reach or base: not a record' }));

  assert.deepEqual((await readMcpRecords()).map((r) => [r.name, r.kind]), [['linear', 'mcp'], ['netlify', 'mcp'], ['wispr-flow', 'mcp']]);
  assert.deepEqual((await availableRecords('home_machine')).map((r) => r.name), ['linear', 'wispr-flow'], 'netlify is the curated bridge');
  assert.deepEqual((await availableRecords('other')).map((r) => r.name), ['linear'], 'blank campaigns: every Campaign');

  const layer = await campaignLayer({ id: 'home_machine', config: { integrations: ['perplexity'] } });
  assert.deepEqual(layer.integrations, ['perplexity'], 'an available record is not added to the Campaign');
  const on = cascade([layerOf('campaign', { integrations: ['perplexity', 'wispr-flow'] }), layerOf('team', { brief: { integrations_off: ['wispr-flow'] } })]);
  assert.deepEqual(Object.keys(on.integrations), ['perplexity'], 'a Team turns a Campaign record off');
});

test('cloudflare and workos are available to home_machine and on only for Workspace ronin_hosted (KAN-607)', async () => {
  for (const [name, title] of [['cloudflare', 'Cloudflare'], ['workos', 'WorkOS']]) {
    await writeFile(path.join(mcpRecordsDir(), `${name}.md`), record(title, { description: `${title}'s API.`, base: `https://api.${name}.com`, 'sign-in': 'key', secret: `${name}-api-key`, campaigns: 'home_machine' }));
  }
  const catalog = await readCatalogs();
  const available = (await availableRecords('home_machine', catalog)).map((r) => ({ name: r.name, kind: r.kind, description: r.description }));
  assert.deepEqual(available.filter((r) => r.kind === 'api').map((r) => r.name), ['cloudflare', 'workos'], 'both are available: listed in the pickers');
  assert.deepEqual((await availableRecords('client_x')).map((r) => r.name).filter((n) => n === 'cloudflare' || n === 'workos'), [], 'not available to another Campaign');

  const campaign = { id: 'home_machine', config: { brief: { add: [], block: [], only: [] }, integrations: [] } };
  const agent = { brief: { add: [], block: [], only: [] }, integrations: [] };
  const briefFor = async (workspace: Record<string, unknown> | null, roster: Record<string, unknown> | null = null) => {
    const layers = await briefLayers({ campaign, workspace, roster } as never, agent);
    const doc = briefDoc('probe');
    doc.setting.available = available;
    doc.brief_settings = Object.fromEntries(layers.map(({ layer, ...rest }) => [layer, rest]));
    return buildBrief(doc, catalog);
  };

  const plain = await briefFor({ name: 'ronin_cowork', integrations: [] });
  assert.deepEqual(plain.doc.setting.api, [], 'available but not on: another Workspace is told nothing');
  assert.doesNotMatch(plain.text, /cloudflare|workos/);

  const hosted = await briefFor({ name: 'ronin_hosted', integrations: [{ provider: 'cloudflare' }, { provider: 'workos' }] });
  assert.deepEqual(hosted.doc.setting.api.map((r) => r.name), ['cloudflare', 'workos']);
  assert.deepEqual(hosted.cascade.integrations, { cloudflare: 'workspace', workos: 'workspace' });
  assert.match(hosted.text, /### Web APIs\n.*`api call <name> <METHOD> <path>`.*\n- cloudflare: Cloudflare's API\.\n- workos: WorkOS's API\./);
  assert.deepEqual(hosted.doc.setting.integrations, ['cloudflare', 'workos'], 'the facts line names them');

  const narrowed = await briefFor({ name: 'ronin_hosted', integrations: [{ provider: 'cloudflare' }, { provider: 'workos' }] }, { name: 't', brief: { integrations_off: ['workos'] } });
  assert.deepEqual(narrowed.doc.setting.api.map((r) => r.name), ['cloudflare'], 'a Team below turns one off');
});

test('a record added before its key says so on its line; saving the key clears it (KAN-600)', async () => {
  const byName = async () => Object.fromEntries((await readMcpRecords()).map((r) => [r.name, r.needs]));
  let needs = await byName();
  assert.equal(needs['wispr-flow'], 'its key: secret ask wispr-flow-api-key');
  assert.equal(needs.linear, '', 'sign-in none needs nothing');
  await mkdir(path.join(temp, 'services_secrets'), { recursive: true });
  await writeFile(path.join(temp, 'services_secrets', 'wispr-flow-api-key'), 'k\n', { mode: 0o600 });
  needs = await byName();
  assert.equal(needs['wispr-flow'], '');
});
