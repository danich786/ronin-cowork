import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('../public/js/agent-composition.js', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/routes/sessions-api.ts', import.meta.url), 'utf8');
const behaviours = await readFile(new URL('../src/behaviours.ts', import.meta.url), 'utf8');
const configuration = await readFile(new URL('../src/agent-configuration.ts', import.meta.url), 'utf8');
const tegami = await readFile(new URL('../src/tegami.ts', import.meta.url), 'utf8');
const members = await readFile(new URL('../public/js/team-members.js', import.meta.url), 'utf8');
const tilehead = await readFile(new URL('../public/js/tilehead.js', import.meta.url), 'utf8');
const formSteps = await readFile(new URL('../public/js/form-steps.js', import.meta.url), 'utf8');
const newAgent = await readFile(new URL('../public/js/new-agent.js', import.meta.url), 'utf8');

test('Agent composition uses the shared selector and preserves many-valued Output', () => {
  assert.match(ui, /import \{ ask \} from '\.\/ask\.js'/);
  assert.doesNotMatch(ui, /document\.createElement\(['"]select/);
  assert.match(ui, /key: 'output'.*many: true/);
  assert.match(ui, /json: value\(\)/);
  assert.doesNotMatch(ui, /output\?\.\[0\]/);
});

test('Configuration shows every current field and has one Send act', () => {
  assert.match(ui, /\/configuration`, \{ method: 'PUT', json: value\(\) \}/);
  assert.match(ui, /action\.el\.disabled = JSON\.stringify\(value\(\)\) === loaded/);
  assert.match(ui, /agent_composition\.send'.*'Send'.*launch: true, size: 'compact'/);
  for (const field of ['session_type', 'provider', 'model', 'objective', 'title', 'project_root', 'role', 'team', 'mandate', 'behaviours']) assert.match(ui, new RegExp(field));
  assert.match(ui, /paintShelves\(shelves/, 'Configuration uses the New Agent shelf painter');
  assert.match(newAgent, /export \{ fixedBirthStone, paintShelves \}/);
  assert.match(ui, /fixedBirthStone\('born_workspace'/, 'Born workspace is one selected, fixed ERABI stone');
  assert.match(ui, /fixedBirthStone\('session_type'/);
  assert.match(ui, /fixedBirthStone\('provider'/);
  assert.match(ui, /fixedBirthStone\('model'/);
  assert.match(ui, /links: false, reason: why/, 'fixed Behaviors state their reason without a read glyph');
  assert.doesNotMatch(ui, /hiddenBehaviours/, 'catalog folders, not a client hide list, decide the shelves');
  assert.doesNotMatch(ui, /forms\.(save|close|add)|composition\/brief|composition\/mandate|composition\/behaviours|resend/i);
  assert.match(formSteps, /if \(label instanceof Node\) dt\.append\(label\)/, 'a reading-row key may be a Node, as its value may');
  assert.match(routes, /app\.put\('\/api\/sessions\/:name\/configuration'/);
  assert.doesNotMatch(routes, /composition\/brief|composition\/mandate|composition\/behaviours/);
  assert.match(configuration, /resolveReading\(form, await resolveFacts\(form, new Set\(\)\)\)/);
  assert.doesNotMatch(configuration, /resolveForm|launch_mode|cmd:/, 'a brief rebuild never resolves a launch');
  assert.equal((configuration.match(/enqueueMessage\(/g) || []).length, 1, 'one message: the new brief');
  assert.match(configuration, /Your configuration changed\. Here is your new brief/);
  for (const writer of ['writeObjective', 'setSessionTitle', 'setTags', 'setLeads', 'writeMandate', 'writeCurrentBehaviours', 'writeCurrentRole']) assert.match(configuration, new RegExp(writer), `${writer} writes its existing authority`);
  assert.match(tegami, /export async function writeMandate\(name: string, current: Mandate\): Promise<Mandate>/, 'the mandate write carries no notice of its own');
  assert.match(members, /actions: \[composition\.action, rename, lead, eject, close\]/);
  assert.match(tilehead, /\{ closed: reader\.destroy, actions: \[reader\.action\] \}/);
  assert.match(behaviours, /scope === 'selected'/);
});
