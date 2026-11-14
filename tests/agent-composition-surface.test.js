import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adapter = await readFile(new URL('../public/js/agent-composition.js', import.meta.url), 'utf8');
const form = await readFile(new URL('../public/js/new-agent.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/routes/sessions-api.ts', import.meta.url), 'utf8');
const configuration = await readFile(new URL('../src/agent-configuration.ts', import.meta.url), 'utf8');
const tilehead = await readFile(new URL('../public/js/tilehead.js', import.meta.url), 'utf8');
const launchRoute = await readFile(new URL('../src/routes/launch.ts', import.meta.url), 'utf8');

test('Configuration is the New Agent form in existing-Agent mode', () => {
  assert.match(adapter, /createNewAgentView\(WorkspaceKit, \{ configure: agent, embedded: true \}\)/);
  assert.doesNotMatch(adapter, /ask\(|createStep\(|createField/);
  assert.match(form, /configure \? t\('agent_composition\.send', 'Send'\) : t\('forms\.launch', 'Launch'\)/);
  assert.match(form, /box\.disabled = !!configure/);
  assert.match(form, /TYPES\(\)\.filter\(\(row\) => !configure \|\| row\.key === draft\.type\)/);
  for (const field of ['provider', 'model']) assert.match(form, new RegExp(`key: '${field}'[^\\n]*fixed: !!configure`));
  assert.match(form, /key: 'agentId'[\s\S]*fixed: true/);
  assert.match(form, /questions\.show\(\['provider', 'model', 'role', 'reach', 'recruit', 'output'\]\)/);
  // What comes with the Agent is the server's answer to the draft, never a browser guess (BRIEF_MODEL §8).
  assert.match(form, /request\('\/api\/brief\/preview', \{ method: 'POST'/);
  assert.doesNotMatch(form, /row\.requires/);
  assert.match(form, /request\(`\/api\/sessions\/\$\{encodeURIComponent\(configure\)\}\/composition`/);
  assert.match(form, /request\(`\/api\/sessions\/\$\{encodeURIComponent\(configure\)\}\/configuration`, \{ method: 'PUT', json: configurationValue\(\) \}\)/);
  assert.match(form, /if \(embedded && !configure\)/, 'Configuration puts no action in its body');
  assert.match(tilehead, /overTile\(tile, t\('me\.configuration', 'Configuration'\)[\s\S]*actions: \[reader\.action\]/, 'Send belongs to the Configuration overlay head');
  for (const field of ['session_type', 'provider', 'model', 'objective', 'title', 'role', 'team', 'mandate', 'setting']) assert.match(form, new RegExp(field));
  assert.doesNotMatch(form, /hiddenBehaviours/);
});

test('Send writes the record, rebuilds the brief, and sends only what differs', () => {
  assert.match(routes, /app\.put\('\/api\/sessions\/:name\/configuration'/);
  assert.equal((configuration.match(/enqueueMessage\(/g) || []).length, 1);
  assert.match(configuration, /const changes = briefChanges\(before, composed\.resolved, composed\.record\);[\s\S]*if \(!changes\) return/, 'nothing changed: nothing sent');
  assert.match(configuration, /writeCurrentRole\(name, next\.role\)[\s\S]*return refreshBrief\(name\)/, 'Send stores the role before rebuilding');
  assert.match(launchRoute, /writeBriefPacketAt\([\s\S]*writeCurrentRoleAt\(birthDir,[^\n]+\)/, 'birth stores the role fact after the packet creates its record directory');
  for (const writer of ['writeObjective', 'setSessionTitle', 'setTags', 'setLeads', 'writeMandate', 'writeAgentBriefAt', 'writeCurrentRole']) assert.match(configuration, new RegExp(writer));
});
