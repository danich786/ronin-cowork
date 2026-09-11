import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (file) => readFile(new URL(`../public/js/${file}`, import.meta.url), 'utf8');

test('New Agent presents Kind, four session doors, combined instructions, and a final Payload', async () => {
  const form = await source('new-agent.js');
  assert.match(form, /const plan = \(\) => \{[\s\S]*\['kind', 'type', 'top'/);
  assert.match(form, /key: 'template'.*Apply Template/);
  assert.match(form, /templateTray\(offered\(\), draft\.template,[\s\S]*includeOwn: false/);
  assert.match(form, /Name & instructions/);
  assert.match(form, /Session type/);
  assert.match(form, /Name · required/);
  assert.match(form, /draft\.type === 'terminal'\) return \['type', 'top'\]/);
  assert.match(form, /stepPayload\.el\.hidden = draft\.type === 'terminal'/);
  assert.match(form, /stepPayload\.setNumber\(order\.length \+ 1\)/);
  assert.match(form, /key: 'payload'.*Payload/);
  assert.doesNotMatch(form, /const stepTemplate =/);
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

test('New Team cast controls are labelled, related, and stack without changing New Agent', async () => {
  const [agents, css, newAgent] = await Promise.all([
    source('team-agents.js'),
    readFile(new URL('../public/css/launch-forms.css', import.meta.url), 'utf8'),
    source('new-agent.js'),
  ]);
  assert.match(agents, /el\('label', 'ntf-agent-field ntf-agent-name-field'\)/);
  assert.match(agents, /el\('label', 'ntf-agent-field ntf-agent-what-field'\)/);
  assert.match(agents, /more\.setAttribute\('aria-expanded', String\(row\.open\)\)/);
  assert.match(agents, /more\.setAttribute\('aria-controls', `\$\{id\}-detail`\)/);
  assert.match(agents, /detail\.id = `\$\{id\}-detail`;\s*detail\.hidden = !row\.open/);
  assert.match(agents, /drop\.setAttribute\('aria-label'/);
  assert.match(css, /@media \(max-width: 44rem\)[\s\S]*\.ntf-surface \.ntf-agent-head/);
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
