import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adapter = await readFile(new URL('../public/js/agent-composition.js', import.meta.url), 'utf8');
const form = await readFile(new URL('../public/js/new-agent.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/routes/sessions-api.ts', import.meta.url), 'utf8');
const configuration = await readFile(new URL('../src/agent-configuration.ts', import.meta.url), 'utf8');

test('Configuration is the New Agent form in existing-Agent mode', () => {
  assert.match(adapter, /createNewAgentView\(WorkspaceKit, \{ configure: agent, embedded: true \}\)/);
  assert.doesNotMatch(adapter, /ask\(|createStep\(|createField/);
  assert.match(form, /configure \? t\('agent_composition\.send', 'Send'\) : t\('forms\.launch', 'Launch'\)/);
  assert.match(form, /box\.disabled = !!configure/);
  assert.match(form, /for \(const key of \['provider', 'model', 'root'\]\) questions\.disable/);
  assert.match(form, /request\(`\/api\/sessions\/\$\{encodeURIComponent\(configure\)\}\/composition`/);
  assert.match(form, /request\(`\/api\/sessions\/\$\{encodeURIComponent\(configure\)\}\/configuration`, \{ method: 'PUT', json: configurationValue\(\) \}\)/);
  for (const field of ['session_type', 'provider', 'model', 'objective', 'title', 'role', 'team', 'mandate', 'behaviours']) assert.match(form, new RegExp(field));
  assert.doesNotMatch(form, /hiddenBehaviours/);
});

test('Send rebuilds one brief and sends one message', () => {
  assert.match(routes, /app\.put\('\/api\/sessions\/:name\/configuration'/);
  assert.equal((configuration.match(/enqueueMessage\(/g) || []).length, 1);
  assert.match(configuration, /resolveReading\(form, await resolveFacts\(form, new Set\(\)\)\)/);
  for (const writer of ['writeObjective', 'setSessionTitle', 'setTags', 'setLeads', 'writeMandate', 'writeCurrentBehaviours', 'writeCurrentRole']) assert.match(configuration, new RegExp(writer));
});
