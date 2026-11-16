import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { irasshaiIn, irasshaiSteps, takeStepLine } from '../public/js/setup-journey.js';

const source = (path) => readFile(new URL(`../public/${path}`, import.meta.url), 'utf8');
const ORDER = ['Agent Harness', 'Workspace', 'Integrations', 'Ronin Tour', 'Meet your Agents'];

test('Irasshai’s steps: her epic’s tasks in the template’s order, done ones marked; subtasks and other epics left out (KAN-573)', () => {
  const epics = [
    { id: 'w1', level: 1, status: 'In Progress', holder: 'agent:someone', holders: ['agent:someone'] },
    { id: 'KAN-530', level: 1, status: 'In Progress', holder: 'agent:irasshai', holders: ['agent:irasshai'] },
  ];
  const items = [
    { id: 'KAN-9', epic: 'KAN-530', level: 0, title: 'Meet your Agents', status: 'To Do' },
    { id: 'KAN-3', epic: 'KAN-530', level: 0, title: 'Workspace', status: 'In Progress' },
    { id: 'KAN-4', epic: 'KAN-530', level: -1, title: 'Start Team 1', status: 'To Do' },
    { id: 'KAN-1', epic: 'KAN-530', level: 0, title: 'Agent Harness', status: 'Done' },
    { id: 'KAN-7', epic: 'KAN-530', level: 0, title: 'Ronin Tour', status: 'To Do' },
    { id: 'KAN-6', epic: 'KAN-530', level: 0, title: 'Integrations', status: 'Done' },
    { id: 'w2', epic: 'w1', level: 0, title: 'Not hers', status: 'To Do' },
  ];
  assert.deepEqual(irasshaiSteps(epics, items, ORDER), [
    { id: 'KAN-1', title: 'Agent Harness', done: true },
    { id: 'KAN-3', title: 'Workspace', done: false },
    { id: 'KAN-6', title: 'Integrations', done: true },
    { id: 'KAN-7', title: 'Ronin Tour', done: false },
    { id: 'KAN-9', title: 'Meet your Agents', done: false },
  ]);
  assert.deepEqual(irasshaiSteps(epics.slice(0, 1), items, ORDER), [], 'no epic of hers, no steps');
  assert.equal(takeStepLine({ id: 'KAN-3', title: 'Workspace' }), "Let's do Workspace (KAN-3).", 'a press is one line');
  assert.equal(irasshaiIn([{ name: 'mika_agent' }, { name: 'irasshai' }]), true);
  assert.equal(irasshaiIn([{ name: 'mika_agent' }]), false);
});

test('Setup while Irasshai runs: Assist seats her chat, the selector offers only her steps, a press goes to her through the message queue (KAN-573)', async () => {
  const [view, chat, garden, css] = await Promise.all([source('js/setup-view.js'), source('js/setup-irasshai.js'), source('js/garden-canvas.js'), source('css/garden-canvas.css')]);
  assert.match(view, /selectorFilter: \(type\) => \(irasshai \? type === IRASSHAI_STEP_TYPE : ORDER\.includes\(type\)\)/, 'her steps replace the scenes; with no Irasshai, Setup is as it was');
  assert.match(view, /hear\('sessions', followIrasshai\)/, 'her session is followed on the push, never a timer');
  assert.match(view, /hear\('epicItems'/, 'her steps move with the pushed items');
  assert.match(view, /garden\.chat\(chat\.el\)/, 'Assist seats her chat in place of the scene');
  assert.match(view, /takeIrasshaiStep: \(step\) => \{[^}]*\}\s*void chat\?\.say\(takeStepLine\(step\)\);/, 'a press is one line to her, shown in her chat at once');
  assert.match(chat, /makeTileTranscript\(\)/, 'her conversation is Chat’s own drawing');
  assert.match(chat, /sendComposerMessage\(IRASSHAI, text\)/, 'the box and the steps send through the message queue');
  assert.doesNotMatch(chat, /makeTile\(|new Tile\b|tilehead/, 'no Agent tile, no terminal, no tile head');
  assert.match(garden, /surface\.el\.dataset\.chat = seated \? 'on' : 'off'/);
  assert.match(css, /\.garden-canvas\[data-chat='on'\] \.wk-surface-header-actions \{ display: none; \}/, 'the Assist header carries no tools under her chat');
  assert.match(view, /!HOSTED \|\| !NOT_HOSTED\.includes\(scene\.id\)/, 'a hosted Setup leaves out registration, password and installations');
});

test('Irasshai’s Integrations step seats the integrations panel, embedded, and reads it again as each of her turns ends (KAN-601)', async () => {
  const [view, chat] = await Promise.all([source('js/setup-view.js'), source('js/setup-irasshai.js')]);
  assert.match(chat, /createIntegrationsPanel\(.*\{ embedded: true \}\)/, 'the panel, embedded');
  assert.match(chat, /stepSurface = \(step\) => \(step\?\.title === INTEGRATIONS_STEP \? IRASSHAI_INTEGRATIONS_TYPE : null\)/, 'only the Integrations step has a surface');
  assert.match(chat, /subscribe\('home'/, 'it reads again off the pushed roster, never a timer');
  assert.doesNotMatch(chat, /setInterval|setTimeout/, 'no timer');
  assert.match(view, /profiles\.define\(PROFILE, \[[^\]]*IRASSHAI_INTEGRATIONS_TYPE/, 'the surface is in Setup’s profile');
  assert.match(view, /const type = stepSurface\(step\);\s*if \(type\) \{ bench\.place\(type, 'workspace2'\)/, 'a press seats it in Workspace 2');
  assert.match(view, /if \(type && now && !started\.has\(step\.id\)\) bench\?\.place\(type, 'workspace2'\)/, 'a step she starts herself seats it too');
});

test('Open Irasshai: a hosted Setup header carries one button that asks Services to open her; self-hosted none (KAN-615)', async () => {
  const [view, chat] = await Promise.all([source('js/setup-view.js'), source('js/setup-irasshai.js')]);
  assert.match(view, /const openIrasshai = HOSTED \? createOpenIrasshai\(/, 'hosted only');
  assert.match(view, /actions: \[\.\.\.\(openIrasshai \? \[openIrasshai\] : \[\]\), themeToggle\]/);
  assert.match(chat, /request\('\/api\/irasshai\/open', \{ method: 'POST' \}\)/, 'one press, one request; Services decides open, restore or launch');
});
