import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { irasshaiIn, irasshaiShown, irasshaiSteps, onboardingDone, takeStepLine } from '../public/js/setup-journey.js';

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
  assert.equal(takeStepLine({ id: 'KAN-3', title: 'Workspace' }), "Let's do Workspace.", 'a press is one line, with no item id (KAN-699)');
  assert.equal(irasshaiIn([{ name: 'mika_agent' }, { name: 'irasshai' }]), true);
  assert.equal(irasshaiIn([{ name: 'mika_agent' }]), false);
  assert.equal(onboardingDone([]), false, 'before her epic exists, onboarding is not over (KAN-676)');
  assert.equal(onboardingDone(epics), false);
  assert.equal(onboardingDone([{ ...epics[1], status: 'Done' }]), true);
});

test('Setup while Irasshai runs: Assist seats her chat, the selector offers only her steps, a press goes to her through the message queue (KAN-573)', async () => {
  const [view, chat, garden, css] = await Promise.all([source('js/setup-view.js'), source('js/setup-irasshai.js'), source('js/garden-canvas.js'), source('css/garden-canvas.css')]);
  assert.match(view, /selectorFilter: \(type\) => type === IRASSHAI_OPEN_TYPE \|\| \(irasshai \? type === IRASSHAI_STEP_TYPE : ORDER\.includes\(type\)\)/, 'her entry, then her steps in place of the scenes; with no Irasshai, Setup is as it was');
  assert.match(view, /hear\('sessions', followIrasshai\)/, 'her session is followed on the push, never a timer');
  assert.match(view, /hear\('epicItems'/, 'her steps move with the pushed items');
  assert.match(view, /garden\.chat\(chat\.el, IRASSHAI_NAME\)/, 'Assist seats her chat in place of the scene, headed with her name');
  assert.match(view, /if \(!step\.done\) return void chat\?\.say\(takeStepLine\(step\)\);/, 'a press on a step not done is one line to her, shown in her chat at once; she opens its surface (KAN-692)');
  assert.match(view, /const opens = stepOpens\(step\);\n\s*if \(opens && WorkspaceKit\.workbench\.library\.has\(opens\)\) bench\?\.place\(opens, 'workspace2'\);/, 'a press on a done step tells her nothing and opens its surface (KAN-699)');
  assert.match(chat, /makeTileTranscript\(\{ admit:/, 'her conversation is Chat’s own drawing');
  assert.match(chat, /sendComposerMessage\(IRASSHAI, text\)/, 'the box and the steps send through the message queue');
  assert.doesNotMatch(chat, /makeTile\(|new Tile\b|tilehead/, 'no Agent tile, no terminal, no tile head');
  assert.match(garden, /surface\.el\.dataset\.chat = seated \? 'on' : 'off'/);
  assert.match(css, /\.garden-canvas\[data-chat='on'\] \.wk-surface-header-actions \{ display: none; \}/, 'the Assist header carries no tools under her chat');
  assert.match(view, /!HOSTED \|\| !NOT_HOSTED\.includes\(scene\.id\)/, 'a hosted Setup leaves out registration, password and installations');
});

test('She opens a step’s surface with show; the integrations panel is one, embedded, read again as each of her turns ends (KAN-601, KAN-692)', async () => {
  const [view, chat] = await Promise.all([source('js/setup-view.js'), source('js/setup-irasshai.js')]);
  assert.match(chat, /createIntegrationsPanel\(.*\{ embedded: true \}\)/, 'the panel, embedded');
  assert.match(chat, /IRASSHAI_INTEGRATIONS_TYPE = 'setup\.integrations'/, 'a surface show can name');
  assert.match(chat, /subscribe\('home'/, 'it reads again off the pushed roster, never a timer');
  assert.doesNotMatch(chat, /setInterval|setTimeout/, 'no timer');
  assert.match(view, /profiles\.define\(PROFILE, \[[^\]]*IRASSHAI_INTEGRATIONS_TYPE/, 'the surface is in Setup’s profile');
  assert.doesNotMatch(view + chat, /stepSurface|INTEGRATIONS_STEP/, 'no step-to-surface wiring');
  assert.match(view, /m\.tab !== mikaTab\(\)/, 'show places only for this tab');
  assert.match(view, /selected: 'workspace1'/, 'her chat is never the target');
  assert.match(chat, /json: \{ tab: mikaTab\(\) \}/, 'the tab goes with each ask for her');
  assert.match(chat, /redirect: \(detail\) => \(detail\?\.opens \? \{ type: detail\.opens \} : null\)/, 'a dragged step opens what its Open line names, else nothing (KAN-696)');
  assert.match(chat, /redirect: \(_detail, environment\) => \{ environment\?\.irasshaiPress\?\.\(\); return null; \}/, 'a dragged Helpful Assistant pill does what a press does');
});

test('Opening a hosted Setup opens her; her selector entry opens her anywhere; a new birth gets a new chat (KAN-676, KAN-694)', async () => {
  const [view, chat] = await Promise.all([source('js/setup-view.js'), source('js/setup-irasshai.js')]);
  assert.match(view, /if \(HOSTED\) void askIrasshai\(\);/, 'hosted, on opening Setup');
  assert.match(chat, /request\('\/api\/irasshai\/open', \{ method: 'POST', json: \{ tab: mikaTab\(\) \} \}\)/, 'one request; Services shows her or makes her fresh');
  assert.match(view, /profiles\.define\(PROFILE, \[IRASSHAI_OPEN_TYPE,/, 'her entry tops the selector');
  assert.match(view, /selectorFilter: \(type\) => type === IRASSHAI_OPEN_TYPE \|\|/, 'always there, on any install');
  assert.match(chat, /if \(state === 'opening'\) return;/, 'repeats are ignored while a press runs');
  assert.match(chat, /afterReady\(record, irasshaiReady\(\)\)/, 'her chat starts at her ready mark');
  assert.match(view, /if \(chat && chat\.key !== irasshai\) \{ garden\.chat\(null\); chat\.dispose\(\); chat = null; \}/, 'a new birth key: the last chat goes');
});

test('Irasshai’s chat reads as a conversation: the Chat reading, the person’s messages without Ronin’s head, her replies, nothing else (KAN-617)', async () => {
  const chat = await source('js/setup-irasshai.js');
  assert.match(chat, /transcript\.show\(IRASSHAI, CHAT_READING\)/, 'her chat asks for the Chat reading, which drops Codex startup and injected context');
  assert.match(chat, /export const CHAT_READING = 'chat';/);
  assert.match(chat, /makeTileTranscript\(\{ admit: \(record\) => \(afterReady\(record, irasshaiReady\(\)\) \? irasshaiShown\(record\) : null\) \}\)/, 'drawn by irasshaiShown, from her ready mark on (KAN-694)');
  const shown = irasshaiShown;
  const user = (text) => ({ seq: 1, role: 'user', kind: 'say', text });
  assert.equal(shown(user('Read first: /home/ronin/.ronin/sessions/irasshai-1/AGENT_BIRTH_BRIEF.md — 90 lines, 6 KB, one read')), null, 'no birth packet');
  assert.equal(shown(user("From Epic templates [House notice]:\nWalk this epic through: w1 'Getting set up in your new office'.")), null, 'no house notice');
  assert.equal(shown(user('From @system_lead [Tell]:\nhi')), null, 'no Tell');
  assert.deepEqual(shown(user('From Glen Osmond <g@x.com>, owner, Redpick [Message box]:\nhello')), user('hello'), 'the person’s words, without Ronin’s head');
  assert.deepEqual(shown(user('hello')), user('hello'), 'typed bare, shown as typed');
  const reply = { seq: 2, role: 'agent', kind: 'say', text: 'Welcome!' };
  assert.equal(shown(reply), reply);
});
