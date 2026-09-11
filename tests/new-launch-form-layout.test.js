import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (file) => readFile(new URL(`../public/js/${file}`, import.meta.url), 'utf8');

test('New Agent is the canonical five-section launcher with three session types', async () => {
  const form = await source('new-agent.js');
  assert.match(form, /\['type', 'top', 'team', 'where', 'loadout'\]/);
  assert.doesNotMatch(form, /key: 'template'.*Apply Template/);
  assert.match(form, /Cowork Agent[\s\S]*Bare-metal Agent[\s\S]*Terminal/);
  assert.match(form, /Session type/);
  assert.match(form, /agent_body', 'Agent'/);
  assert.match(form, /Name · required/);
  assert.match(form, /providerModelStones/);
  assert.match(form, /Make Team Lead/);
  assert.match(form, /stepPayload\.setNumber\(order\.length \+ 1\)/);
  assert.match(form, /key: 'payload'.*Payload/);
  assert.match(form, /agentChoices\.append\(modelPackage, mandatePackage\)/);
  assert.match(form, /modelPackage\.append\(el\('p', 'fs-head', t\('new_agent\.model_package', 'Model'\)\), pair\.el\)/);
  assert.match(form, /mandatePackage\.append\(el\('p', 'fs-head', t\('mandate', 'Mandate'\)\), mandateHost\)/);
  assert.match(form, /stepTop\.body\.replaceChildren\(nameField, agentChoices, instructionsField\)/);
});

test('both workbench entrances use the canonical New Agent form with contextual Team default', async () => {
  const cowork = await source('cowork-view.js');
  assert.doesNotMatch(cowork, /createAddAgentView/);
  assert.match(cowork, /const view = createNewAgentView\(WorkspaceKit, \{[\s\S]*team: \(\) =>/);
  assert.match(cowork, /connect: \(name\) => connectSession\(name, id\)/);
});

test('Where it works separates birthplace and additional workspace profile stones', async () => {
  const [form, where] = await Promise.all([source('new-agent.js'), source('where-it-works.js')]);
  assert.match(form, /request\('\/api\/project-roots\/detail'\)/);
  assert.match(form, /rootRows\.data\?\.roots/);
  assert.match(where, /Where it’s born/);
  assert.match(where, /Additional workspaces/);
  assert.match(where, /o\.stones \? 'div' : 'details'/);
  assert.match(where, /details\.replaceChildren\(el\('p', 'fs-head', t\('where\.label', 'Where it works'\)\)\)/);
  assert.match(where, /sws-stone na-workspace-stone/);
  assert.match(where, /repo_profile\?\.worktrees === 'enabled'/);
  assert.match(where, /'worktree'/);
  assert.match(where, /'checkout'/);
  assert.match(where, /open === 'born'/);
  assert.match(where, /root\.name !== state\.root/);
});

test('model disclosures open directly to choices and close after selection', async () => {
  const parts = await source('form-steps.js');
  assert.doesNotMatch(parts, /options\.append\(el\('p', 'na-choice-label', label\)\)/);
  assert.match(parts, /choose\(''\); open = ''; paint\(\)/);
  assert.match(parts, /choose\(choice\.key\); open = ''; paint\(\)/);
});

test('New Team folds Kind and template choice into one optional first section', async () => {
  const [form, agents] = await Promise.all([source('new-team-form.js'), source('team-agents.js')]);
  assert.match(form, /\['template', 'top', 'lead', 'defaults', 'where', 'kit'\]/);
  assert.match(form, /Templates · optional/);
  assert.match(form, /stepTemplate\.body\.append\(kindHost, trayHost\)/);
  assert.doesNotMatch(form, /const stepKind = createStep/);
  assert.match(form, /includeOwn: false/);
  assert.match(form, /Name & instructions/);
  assert.match(agents, /＋ Add Agent/);
  assert.match(agents, /Make Team Lead/);
  assert.doesNotMatch(agents, /Add Lead Agent|Add Team Agent/);
});

test('collapsible steps expose one full-width disclosure row and Team defaults use it', async () => {
  const [steps, team, agents, css] = await Promise.all([
    source('form-steps.js'), source('new-team-form.js'), source('team-agents.js'),
    readFile(new URL('../public/css/launch-forms.css', import.meta.url), 'utf8'),
  ]);
  assert.match(steps, /el\(onToggle \? 'button' : 'div', 'fs-step-head'\)/);
  assert.match(steps, /setAttribute\('aria-expanded'/);
  assert.match(steps, /forms\.expand', 'Expand'/);
  assert.match(steps, /forms\.collapse', 'Collapse'/);
  assert.match(css, /\.fs-togglable \{ grid-column: 1 \/ -1; width: 100%/);
  assert.match(team, /key: 'defaults'.*Agent defaults/);
  assert.match(team, /Settings inherited by Agents launched in this Team/);
  assert.match(team, /for \(const key of \['where', 'kit'\]\) steps\[key\]\.el\.hidden = !defaultsOpen/);
  assert.match(team, /const stepWhere = createStep\(\{ n: 5, key: 'where', title:[^}]+\}\);/);
  assert.match(team, /const stepKit = createStep\(\{ n: 6, key: 'kit', title:[^}]+\}\);/);
  assert.match(team, /const FOLDS = \['lead'\]/);
  assert.doesNotMatch(team, /stepDefaults\.body\.append/);
  assert.doesNotMatch(team, /createBand/);
  assert.ok(agents.indexOf('host.append(add)') < agents.indexOf('rows().forEach'), 'Add Agent precedes the mini forms');
});

test('each Agent mini-form carries lead, mandate, and provider choices in one launch shape', async () => {
  const agents = await source('team-agents.js');
  assert.match(agents, /lead\.setAttribute\('aria-pressed', String\(row\.lead\)\)/);
  assert.match(agents, /for \(const other of rows\(\)\) other\.lead = false/);
  assert.match(agents, /providerModelPair/);
  assert.match(agents, /provider: row\.provider/);
  assert.match(agents, /model: row\.model/);
  assert.match(agents, /row\.mandateOpen = ''/);
  assert.match(agents, /instructions: row\.assignment\.trim\(\)/);
  assert.match(agents, /team_lead: !!row\.lead/);
});

test('New Team cast controls are labelled, related, and stack without changing New Agent', async () => {
  const [agents, css, newAgent] = await Promise.all([
    source('team-agents.js'),
    readFile(new URL('../public/css/launch-forms.css', import.meta.url), 'utf8'),
    source('new-agent.js'),
  ]);
  assert.match(agents, /el\('label', 'ntf-agent-field'\)/);
  assert.match(agents, /button\.setAttribute\('aria-expanded', String\(row\.mandateOpen === axis\)\)/);
  assert.match(agents, /button\.setAttribute\('aria-controls', `\$\{id\}-\$\{axis\}`\)/);
  assert.match(agents, /drop\.setAttribute\('aria-label'/);
  assert.match(css, /@media \(max-width: 44rem\)[\s\S]*\.ntf-surface \.ntf-agent-mandate-summaries/);
  assert.doesNotMatch(css, /@media \(max-width: 44rem\)[\s\S]*\.na-surface \.ntf-agent/);
  assert.doesNotMatch(newAgent, /ntf-agent-field|new-team-agent-/);
});

test('New Team checks names only for a cast and opens partial Teams with exact recovery evidence', async () => {
  const form = await source('new-team-form.js');
  assert.match(form, /if \(picks\.length\) \{[\s\S]*request\('\/api\/sessions'/);
  assert.match(form, /const born = outcomes\.filter\(\(\{ result \}\) => result\?\.ok\)/);
  assert.match(form, /Team created\. Launched \{launched\} of \{total\} Agents: \{born\}\. Failed: \{names\}/);
  assert.match(form, /if \(refused\.length\) \{[\s\S]*seedReservedWorkspaceTab\(launchTab, 'team',[\s\S]*openWorkspaceTab\('team', name, launchTab\);[\s\S]*return;/);
  assert.doesNotMatch(form, /if \(refused\.length\) \{\s*closeWorkspaceTab/);
});
