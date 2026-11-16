/**
 * Integrations, the common way (KAN-338; KAN-513): the list is the bridge behaviours plus any
 * name a Workspace uses, each with its Workspaces, its Services part, and the secrets saved
 * under `<name>-` (names only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'ronin-integrations-'));
process.env.RONIN_USER_ROOT = root;
process.env.RONIN_DATA_ROOT = path.join(root, '.data');
const { listInstallations } = await import('../src/resource-adapters.js');
const { integrationsState } = await import('../src/integrations.js');
const { normalizeWorkspace, saveWorkspace } = await import('../src/workspaces.js');
const parts = { onDisk: ['jira', 'netlify'], loaded: ['netlify'] };

test('the list is the bridges; Ronin Services is not one of them', async () => {
  const rows = await integrationsState('c1', parts);
  assert.deepEqual(rows.map((row) => row.name), ['netlify', 'jira', 'perplexity']);
  assert.deepEqual((await listInstallations()).map((row) => row.name), ['ronin_services']);
  const jira = rows.find((row) => row.name === 'jira')!;
  assert.equal(jira.label, 'Jira');
  assert.equal(jira.bridge, 'jira-bridge');
  assert.equal(jira.part, 'parked');
  assert.equal(rows.find((row) => row.name === 'netlify')!.part, 'running');
  assert.equal(rows.find((row) => row.name === 'perplexity')!.part, '');
});

test('a Workspace keeps its integrations, with facts a bridge reads', () => {
  const w = normalizeWorkspace('c1', 'site', { integrations: [{ provider: 'Netlify', site: 'my-site', note: 'the docs' }, 'jira', { provider: 'netlify' }, { nope: 1 }] });
  assert.deepEqual(w.integrations, [{ site: 'my-site', note: 'the docs', provider: 'netlify' }, { provider: 'jira' }]);
  assert.deepEqual(normalizeWorkspace('c1', 'site', {}).integrations, []);
});

test('a Workspace name with no bridge is a row; saved secrets show by name, never a value', async () => {
  await saveWorkspace({ ...normalizeWorkspace('c1', 'site', {}), integrations: [{ provider: 'netlify', site: 'my-site' }, { provider: 'supabase' }] });
  const secrets = path.join(root, 'services_secrets');
  await mkdir(secrets, { recursive: true });
  await writeFile(path.join(secrets, 'netlify-auth-token'), 'secret-1', { mode: 0o600 });
  await writeFile(path.join(secrets, 'netlifyish-key'), 'x', { mode: 0o600 });
  const rows = await integrationsState('c1', parts);
  const netlify = rows.find((row) => row.name === 'netlify')!;
  assert.deepEqual(netlify.secrets, ['netlify-auth-token']);
  assert.deepEqual(netlify.workspaces, ['site']);
  assert.ok(!JSON.stringify(rows).includes('secret-1'), 'a value never comes back');
  const supabase = rows.at(-1)!;
  assert.deepEqual({ ...supabase }, { name: 'supabase', label: 'supabase', blurb: '', bridge: '', part: '', secrets: [], workspaces: ['site'], mcp: null });
});

test('every MCP server record is a row, read from its file; a record named like a bridge stays the bridge', async () => {
  const dir = path.join(root, 'catalogs', 'integrations');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'wispr-flow.md'), '# Wispr Flow\n- **description:** Voice dictation.\n- **reach:** https://mcp.example.com/mcp\n- **sign-in:** key\n- **secret:** wispr-flow-api-key\n- **send:** \n- **campaigns:** c1, c2\n');
  await writeFile(path.join(dir, 'notion.md'), '# Notion\n- **description:** Pages.\n- **reach:** https://mcp.notion.com/mcp\n- **sign-in:** oauth\n- **secret:** notion-oauth\n- **campaigns:** \n');
  await writeFile(path.join(dir, 'netlify.md'), '# Netlify MCP\n- **reach:** https://netlify.example/mcp\n- **sign-in:** key\n- **secret:** netlify-api-key\n');
  await writeFile(path.join(dir, 'README.md'), '# not a record\n');
  await writeFile(path.join(root, 'services_secrets', 'wispr-flow-api-key'), 'value-9', { mode: 0o600 });
  await saveWorkspace({ ...normalizeWorkspace('c1', 'voice', {}), integrations: [{ provider: 'wispr-flow' }] });
  const rows = await integrationsState('c1', parts);
  const wispr = rows.find((row) => row.name === 'wispr-flow')!;
  assert.equal(wispr.label, 'Wispr Flow');
  assert.equal(wispr.blurb, 'Voice dictation.');
  assert.deepEqual(wispr.secrets, ['wispr-flow-api-key']);
  assert.deepEqual(wispr.workspaces, ['voice']);
  assert.deepEqual(wispr.mcp, { reach: 'https://mcp.example.com/mcp', sign_in: 'key', secret: 'wispr-flow-api-key', saved: true, campaigns: ['c1', 'c2'] });
  const notion = rows.find((row) => row.name === 'notion')!;
  assert.deepEqual(notion.mcp, { reach: 'https://mcp.notion.com/mcp', sign_in: 'oauth', secret: 'notion-oauth', saved: false, campaigns: [] });
  const netlify = rows.filter((row) => row.name === 'netlify');
  assert.equal(netlify.length, 1);
  assert.equal(netlify[0]!.bridge, 'netlify-bridge');
  assert.equal(netlify[0]!.mcp, null);
  assert.ok(!rows.some((row) => row.name === 'README'));
  assert.ok(!JSON.stringify(rows).includes('value-9'), 'a value never comes back');
});

test('an owner bridge file adds an integration', async () => {
  await mkdir(path.join(root, 'behaviours'), { recursive: true });
  await writeFile(path.join(root, 'behaviours', 'resend-bridge.md'), '# Resend bridge\n- **seed:** Resend sends mail.\n- **when:** integration:resend\n- **depth:** seed\n');
  const row = (await integrationsState('c1', parts)).find((one) => one.name === 'resend');
  assert.equal(row?.label, 'Resend');
  assert.equal(row?.blurb, 'Resend sends mail.');
});

test('every Cowork Agent is told Integrations at seed depth with nothing selected', async () => {
  const { readCatalog } = await import('../src/catalog.js');
  const brief = (await readCatalog('behaviours')).find((row) => row.name === 'integrations');
  assert.ok(brief, 'the folder is the registry: no selection needed');
  assert.equal(brief!.depth, 'seed');
  assert.deepEqual(brief!.when, []);
  assert.ok(brief!.seed, 'its seed line stands on its own');
  const secret = (await readCatalog('tools')).find((row) => row.name === 'secret');
  assert.ok(secret?.serves.includes('integrations'), 'its tool comes with it');
});
