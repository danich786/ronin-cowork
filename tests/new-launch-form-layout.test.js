import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (file) => readFile(new URL(`../public/js/${file}`, import.meta.url), 'utf8');

test('New Agent uses one ruled ask() spec after its three session types', async () => {
  const form = await source('new-agent.js');
  assert.match(form, /import \{ ask \} from '\.\/ask\.js'/);
  assert.match(form, /const questions = ask\(\[/);
  assert.match(form, /const teamQuestions = ask\(\[/);
  assert.match(form, /className: 'na-questions',[\s\S]*density: 'tight'/);
  assert.doesNotMatch(form, /key: 'template'.*Apply Template/);
  assert.match(form, /Cowork Agent[\s\S]*Bare-metal Agent[\s\S]*Terminal/);
  assert.match(form, /Session type/);
  assert.match(form, /agent_body', 'Agent'/);
  assert.match(form, /Name · required/);
  assert.match(form, /group: t\('new_agent\.model_package', 'Model'\)/);
  assert.match(form, /after: 'provider'/);
  assert.match(form, /group: t\('mandate', 'Mandate'\)/);
  assert.doesNotMatch(form, /key: '(?:reach|recruit|output)'[^\n]+shape: 'square'/);
  assert.match(form, /group: t\('squad', 'Team'\)/);
  assert.match(form, /switch: \[t\('yes', 'Yes'\), t\('no', 'No'\)\]/);
  assert.doesNotMatch(form, /switch: \[[^\]]+\], word:/);
  assert.match(form, /group: t\('where\.label', 'Where it works'\)/);
  assert.match(form, /many: true, after: 'root'/);
  assert.match(form, /questions\.show\(draft\.type === 'terminal' \? \[\] : draft\.type === 'bare_metal_agent' \? \['provider', 'model', 'root', 'repos'\] : null\)/);
  assert.match(form, /teamQuestions\.show\(isCowork\(\) \? null : \['team'\]\)/);
  assert.match(form, /questions\.el\.hidden = draft\.type === 'terminal'/);
  assert.match(form, /\? \{ session_type: 'terminal', name, team \}/);
  assert.match(form, /stepPayload\.setNumber\(order\.length \+ 1\)/);
  assert.match(form, /key: 'payload'.*Payload/);
  assert.match(form, /identityRow\.append\(nameField, teamQuestions\.el\)/);
  assert.match(form, /stepTop\.body\.replaceChildren\(identityRow, questions\.el, instructionsField\)/);
  assert.doesNotMatch(form, /providerModelStones|na-choice-stone|na-mini-stone|stones: true/);
});

test('both workbench entrances use the canonical New Agent form with contextual Team default', async () => {
  const cowork = await source('cowork-view.js');
  assert.doesNotMatch(cowork, /createAddAgentView/);
  assert.match(cowork, /const view = createNewAgentView\(WorkspaceKit, \{[\s\S]*team: \(\) =>/);
  assert.match(cowork, /connect: \(name\) => connectSession\(name, id\)/);
});

test('Where it works asks birthplace then a workspace set which includes the birthplace', async () => {
  const form = await source('new-agent.js');
  assert.match(form, /request\('\/api\/project-roots\/detail'\)/);
  assert.match(form, /rootRows\.data\?\.roots/);
  assert.match(form, /repo_profile\?\.worktrees === 'enabled'/);
  assert.match(form, /label: t\('where\.born_in', 'Born in'\), options: rootRows/);
  assert.match(form, /label: t\('where\.workspaces', 'Workspaces'\), many: true, after: 'root', options: rootRows/);
  assert.match(form, /draft\.repos = draft\.root \? \[draft\.root\] : \[\]/);
  assert.doesNotMatch(form, /filter\(\(row\) => row\.v !== value\.root\)/);
});

test('the old New Agent selector implementation and CSS are deleted', async () => {
  const [parts, where, css] = await Promise.all([source('form-steps.js'), source('where-it-works.js'), readFile(new URL('../public/css/launch-forms.css', import.meta.url), 'utf8')]);
  assert.doesNotMatch(parts, /providerModelStones/);
  assert.doesNotMatch(where, /o\.stones|na-workspace-stone|na-choice-stone/);
  assert.doesNotMatch(css, /na-choice-stone|na-stone|na-mandate-grid|na-model-picker|na-workspace-stone/);
});

test('New Team makes templates optional and offers explicit Agent roles', async () => {
  const [form, agents] = await Promise.all([source('new-team-form.js'), source('team-agents.js')]);
  assert.match(form, /\['kind', 'template', 'top', 'lead', 'defaults', 'where', 'kit'\]/);
  assert.match(form, /Template · optional/);
  assert.match(form, /includeOwn: false/);
  assert.match(form, /Name & instructions/);
  assert.match(agents, /Add Lead Agent/);
  assert.match(agents, /Add Team Agent/);
  assert.doesNotMatch(agents, /Mark as team lead/);
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
  assert.ok(agents.indexOf('host.append(buttons)') < agents.indexOf('rows().forEach'), 'Add buttons precede Agent rows');
});

test('a new lead has an explicit coordinating mandate without a second launch shape', async () => {
  const agents = await source('team-agents.js');
  assert.match(agents, /lead \? 'plan' : 'open'/);
  assert.match(agents, /lead \? 'staff agents' : 'open'/);
  assert.match(agents, /lead \? \['the team'\] : \['open'\]/);
  assert.match(agents, /instructions: row\.assignment\.trim\(\)/);
  assert.match(agents, /team_lead: !!row\.lead/);
});
