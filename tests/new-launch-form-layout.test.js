import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (file) => readFile(new URL(`../public/js/${file}`, import.meta.url), 'utf8');

test('New Agent uses one ruled ask() spec after its three session types', async () => {
  const form = await source('new-agent.js');
  assert.match(form, /import \{ ask \} from '\.\/ask\.js'/);
  assert.match(form, /const questions = ask\(\[/);
  assert.doesNotMatch(form, /key: 'template'.*Apply Template/);
  assert.match(form, /Cowork Agent[\s\S]*Bare-metal Agent[\s\S]*Terminal/);
  assert.match(form, /Session type/);
  assert.match(form, /agent_body', 'Agent'/);
  assert.match(form, /Name · required/);
  assert.match(form, /group: t\('new_agent\.model_package', 'Model'\)/);
  assert.match(form, /after: 'provider'/);
  assert.match(form, /group: t\('mandate', 'Mandate'\)/);
  assert.match(form, /shape: 'square'[\s\S]*many: true/);
  assert.match(form, /group: t\('squad', 'Team'\)/);
  assert.match(form, /switch: \[t\('yes', 'Yes'\), t\('no', 'No'\)\], word: '人'/);
  assert.match(form, /group: t\('where\.label', 'Where it works'\)/);
  assert.match(form, /many: true, after: 'root'/);
  assert.match(form, /stepPayload\.setNumber\(order\.length \+ 1\)/);
  assert.match(form, /key: 'payload'.*Payload/);
  assert.match(form, /stepTop\.body\.replaceChildren\(nameField, questions\.el, instructionsField\)/);
  assert.doesNotMatch(form, /providerModelStones|na-choice-stone|na-mini-stone|stones: true/);
});

test('both workbench entrances use the canonical New Agent form with contextual Team default', async () => {
  const cowork = await source('cowork-view.js');
  assert.doesNotMatch(cowork, /createAddAgentView/);
  assert.match(cowork, /const view = createNewAgentView\(WorkspaceKit, \{[\s\S]*team: \(\) =>/);
  assert.match(cowork, /connect: \(name\) => connectSession\(name, id\)/);
});

test('Where it works asks birthplace then additional workspace names from root profiles', async () => {
  const form = await source('new-agent.js');
  assert.match(form, /request\('\/api\/project-roots\/detail'\)/);
  assert.match(form, /rootRows\.data\?\.roots/);
  assert.match(form, /repo_profile\?\.worktrees === 'enabled'/);
  assert.match(form, /label: t\('where\.born_in', 'Born in'\), options: rootRows/);
  assert.match(form, /label: t\('where\.additional', 'Additional workspaces'\), many: true, after: 'root'/);
});

test('the old New Agent selector implementation and CSS are deleted', async () => {
  const [parts, where, css] = await Promise.all([source('form-steps.js'), source('where-it-works.js'), readFile(new URL('../public/css/launch-forms.css', import.meta.url), 'utf8')]);
  assert.doesNotMatch(parts, /providerModelStones/);
  assert.doesNotMatch(where, /o\.stones|na-workspace-stone|na-choice-stone/);
  assert.doesNotMatch(css, /na-choice-stone|na-stone|na-mandate-grid|na-model-picker|na-workspace-stone/);
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
  assert.match(agents, /key: 'lead'.*Team lead.*switch:/);
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
  assert.match(agents, /if \(editor\) host\.append\(paintEditor\(\)\);[\s\S]*createAction\(\{ label:[\s\S]*＋ Add Agent/);
});

test('Add Agent confirms a draft into a compact row with the one selector utility', async () => {
  const agents = await source('team-agents.js');
  assert.match(agents, /let editor = null/);
  assert.match(agents, /if \(index < 0\) rows\(\)\.push\(saved\)/);
  assert.match(agents, /editor = null; changed\(\); paint\(\)/);
  assert.match(agents, /agent_add_confirm', 'Add'/);
  assert.match(agents, /ntf-agent-row/);
  assert.match(agents, /for \(const other of rows\(\)\) other\.lead = false/);
  assert.match(agents, /const questions = ask\(\[/);
  assert.match(agents, /group: t\('new_agent\.model_package', 'Model'\)/);
  assert.match(agents, /group: t\('mandate', 'Mandate'\)/);
  assert.match(agents, /shape: 'square'/);
  assert.match(agents, /many: true/);
  assert.match(agents, /switch: \[t\('yes', 'Yes'\), t\('no', 'No'\)\]/);
  assert.match(agents, /box\.append\(actions\.el, field/);
  assert.doesNotMatch(agents, /wk-button/);
  assert.doesNotMatch(agents, /dialRow|providerModelPair|type = 'checkbox'|aria-pressed/);
  assert.match(agents, /provider: row\.provider/);
  assert.match(agents, /model: row\.model/);
  assert.match(agents, /instructions: row\.assignment\.trim\(\)/);
  assert.match(agents, /team_lead: !!row\.lead/);
});

test('New Team cast text is labelled and all cast selections belong to ask()', async () => {
  const [agents, css, newAgent] = await Promise.all([
    source('team-agents.js'),
    readFile(new URL('../public/css/launch-forms.css', import.meta.url), 'utf8'),
    source('new-agent.js'),
  ]);
  assert.match(agents, /el\('label', 'ntf-agent-field'\)/);
  assert.match(agents, /import \{ ask \} from '\.\/ask\.js'/);
  assert.match(agents, /title: t\('new_team\.agent_drop_named'/);
  assert.match(agents, /className: 'ntf-agent-row-actions'/);
  assert.doesNotMatch(css, /\.ntf-agent-(?:stone|mandate-toggle|lead-choice)/);
  assert.doesNotMatch(css, /\.na-[^,{ ]*[^}]*ntf-agent/);
  assert.doesNotMatch(css, /@media \(max-width: 44rem\)[\s\S]*\.na-surface \.ntf-agent/);
  assert.doesNotMatch(newAgent, /ntf-agent-field|new-team-agent-/);
});

test('New Team routes each selector region through ask() and leaves Templates browsing alone', async () => {
  const form = await source('new-team-form.js');
  assert.match(form, /const kindQuestions = ask\(/);
  assert.match(form, /const whereQuestions = ask\(/);
  assert.match(form, /kitQuestions = ask\(/);
  assert.match(form, /after: 'provider'/);
  assert.match(form, /after: 'root'/);
  assert.match(form, /row: branchField/);
  assert.match(form, /switch: \[t\('on', 'On'\), t\('off', 'Off'\)\]/);
  assert.match(form, /options: LAUNCH_MODES\(\)\.map/);
  assert.match(form, /many: true, options: shelfRows/);
  assert.match(form, /templateTray\(offered\(\)/);
  assert.doesNotMatch(form, /kindTiles|providerModelPair|mandateSelect|dialRowMulti|wayTiles|bookShelves|createWhereItWorks|fs-routine/);
});

test('New Team checks names only for a cast and opens partial Teams with exact recovery evidence', async () => {
  const form = await source('new-team-form.js');
  assert.match(form, /if \(picks\.length\) \{[\s\S]*request\('\/api\/sessions'/);
  assert.match(form, /const born = outcomes\.filter\(\(\{ result \}\) => result\?\.ok\)/);
  assert.match(form, /Team created\. Launched \{launched\} of \{total\} Agents: \{born\}\. Failed: \{names\}/);
  assert.match(form, /if \(refused\.length\) \{[\s\S]*seedReservedWorkspaceTab\(launchTab, 'team',[\s\S]*openWorkspaceTab\('team', name, launchTab\);[\s\S]*return;/);
  assert.doesNotMatch(form, /if \(refused\.length\) \{\s*closeWorkspaceTab/);
});
