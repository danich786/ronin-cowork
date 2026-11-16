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
  // What comes with the Agent is the server's answer to the draft, never a browser guess (docs/architecture/brief.md, Where it is set in the UI).
  assert.match(form, /request\('\/api\/brief\/preview', \{ method: 'POST'/);
  assert.doesNotMatch(form, /row\.requires/);
  assert.match(form, /request\(`\/api\/sessions\/\$\{encodeURIComponent\(configure\)\}\/composition`/);
  assert.match(form, /request\(`\/api\/sessions\/\$\{encodeURIComponent\(configure\)\}\/configuration`, \{ method: 'PUT', json: configurationValue\(\) \}\)/);
  assert.match(form, /if \(embedded && !configure\)/, 'Configuration puts no action in its body');
  assert.match(tilehead, /overTile\(tile, t\('me\.configuration', 'Configuration'\)[\s\S]*actions: \[reader\.action\]/, 'Send belongs to the Configuration overlay head');
  for (const field of ['session_type', 'provider', 'model', 'objective', 'title', 'role', 'team', 'mandate', 'setting']) assert.match(form, new RegExp(field));
  assert.doesNotMatch(form, /hiddenBehaviours/);
});

test('Send writes its authorities, then edits the brief document and sends only what differs', () => {
  assert.match(routes, /app\.put\('\/api\/sessions\/:name\/configuration'/);
  assert.equal((configuration.match(/enqueueMessage\(/g) || []).length, 1);
  assert.match(configuration, /const changes = briefChanges\(before, after\);[\s\S]*if \(!changes\) return/, 'nothing changed: nothing sent');
  assert.match(configuration, /return configureBrief\(name, \{ title: next\.title, role: next\.role, team: next\.team, mandate: next\.mandate, agent: next\.agent \}\)/, 'Send edits the document through the one route');
  for (const writer of ['writeObjective', 'setSessionTitle', 'setTags', 'setLeads', 'writeMandate']) assert.match(configuration, new RegExp(writer));
  assert.doesNotMatch(configuration + launchRoute, /writeAgentBriefAt|writeCurrentRole|writeSnapshotAt/, 'no side files beside the document');
});

test('the birth brief is written once; an update writes AGENT_BRIEF.md and the document (KAN-515, KAN-605)', () => {
  assert.match(configuration, /writeBriefPacketAt\(dir, after\.text, name, AGENT_BRIEF\)/, 'an update never rewrites the birth brief');
  assert.match(configuration, /writeBriefRecord\(name, after\.doc\)/, 'an update writes the document onto the work record');
  assert.match(launchRoute, /seedTegami\([\s\S]*writeBriefRecord\(resolved\.name, resolved\.composed\.doc\)/, 'birth writes it whole once the work record exists');
});

test('a live Agent re-briefs only on its configuration; a default never moves its document (owner, 2026-11-16)', async () => {
  const files = {};
  for (const file of ['src/routes/brief-api.ts', 'src/work-items.ts', 'src/sockets.ts', 'src/routes/secrets-api.ts', 'src/commands/desk.ts']) files[file] = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  const read = (file) => files[file];
  for (const file of ['src/routes/brief-api.ts', 'src/work-items.ts', 'src/sockets.ts', 'src/routes/secrets-api.ts']) assert.doesNotMatch(read(file), /refreshAllBriefs|briefsChanged|configureBrief/, `${file} re-briefs nobody`);
  assert.doesNotMatch(read('src/commands/desk.ts'), /configureBrief/, 'a desk opened or closed moves no brief');
  assert.match(configuration, /readBriefRecord\(name\)[\s\S]*buildBrief\(editBrief\(was, edit/, 'a rebuild is the builder over the edited document');
});
