import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';

// MCP records in a temp owner store (docs/architecture/integrations.md, Who has it).
const temp = await mkdtemp(path.join(os.tmpdir(), 'ronin-mcp-records-'));
process.env.RONIN_USER_ROOT = temp;
process.env.RONIN_DATA_ROOT = path.join(temp, 'data');
const { mcpRecordsDir, readMcpRecords } = await import('../src/mcp-records.js');
const { campaignLayer, offeredMcp } = await import('../src/brief-build.js');
const { cascade, layerOf } = await import('../src/brief-settings.js');

test.after(() => rm(temp, { recursive: true, force: true }));

const record = (title: string, fields: Record<string, string>) =>
  `# ${title}\n${Object.entries(fields).map(([k, v]) => `- **${k}:** ${v}`).join('\n')}\n`;

test('offered is on: an MCP record is on at the Campaign layer for its Campaigns; a bridge name is the bridge (KAN-589)', async () => {
  await mkdir(mcpRecordsDir(), { recursive: true });
  await writeFile(path.join(mcpRecordsDir(), 'wispr-flow.md'), record('Wispr Flow', { description: 'Voice dictation and transcripts.', reach: 'https://mcp.example.com/mcp', 'sign-in': 'key', secret: 'wispr-flow-api-key', campaigns: 'home_machine, client_x' }));
  await writeFile(path.join(mcpRecordsDir(), 'linear.md'), record('Linear', { description: 'Issues in Linear.', reach: 'https://mcp.linear.app/mcp', campaigns: '' }));
  await writeFile(path.join(mcpRecordsDir(), 'netlify.md'), record('Netlify', { description: 'Hosting.', reach: 'https://netlify.example/mcp' }));
  await writeFile(path.join(mcpRecordsDir(), 'old-bridge.md'), record('Old', { blurb: 'no reach: not an MCP server' }));

  assert.deepEqual((await readMcpRecords()).map((r) => r.name), ['linear', 'netlify', 'wispr-flow']);
  assert.deepEqual((await offeredMcp('home_machine')).map((r) => r.name), ['linear', 'wispr-flow'], 'netlify is the curated bridge');
  assert.deepEqual((await offeredMcp('other')).map((r) => r.name), ['linear'], 'blank campaigns: every Campaign');

  const layer = await campaignLayer({ id: 'home_machine', config: { integrations: ['perplexity'] } });
  assert.deepEqual(layer.integrations.sort(), ['linear', 'perplexity', 'wispr-flow']);
  const on = cascade([layer, layerOf('team', { brief: { integrations_off: ['wispr-flow'] } })]);
  assert.deepEqual(Object.keys(on.integrations).sort(), ['linear', 'perplexity'], 'a Team narrows an offered server off');
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
