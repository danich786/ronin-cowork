import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { parseCatalogFile, readCatalog, type Catalog, type CatalogFile, type CatalogKind } from '../src/catalog.js';
import { conditionHolds } from '../src/conditionals.js';
import type { BriefRecord } from '../src/brief-record.js';
import { briefOff, cascade, layerOf, resolveBrief, type Layer } from '../src/brief-settings.js';
import { mandate } from '../src/agent-defaults.js';
import { templateMandate } from '../src/resource-adapters.js';
import { briefChanges, briefSnapshot, fillLine, renderBrief } from '../src/brief.js';

const record = (over: Partial<{ type: BriefRecord['session']['type']; team: string; lead: boolean; pm: boolean; desk: boolean; integrations: string[]; role: BriefRecord['agent']['role'] }> = {}): BriefRecord => ({
  session: { name: 'demo', title: '', type: over.type ?? 'cowork', template: '', task: 'Do it' },
  user: {
    name: 'Glen', email: '', first_name: '', last_name: '', nickname: '', role: 'owner', organization: '', job_title: '',
    time_zone: '', language: '', planned_use: [], planned_use_other: '', technical_level: '', ai_experience: '', about: '',
    new_owner: false, account: '',
  },
  people: [],
  setting: { hosted: false, campaign: 'c', workspace: 'w', instructions: '', integrations: over.integrations ?? [], pm: over.pm ?? false, services: [] },
  agent: { role: over.role ?? 'coworker', team: over.team ?? '', lead: over.lead ?? false, wipeboard: '', team_objective: '', reach: 'plan', recruit: 'nobody', output: ['code'], provider: '', model: '', harness: '', launch_mode: 'configured' },
  work: { repos: [], where: [], repo_lines: '', folder_lines: '', desk: over.desk ?? false, checkout: false },
});

const file = (kind: CatalogKind, name: string, text: string): CatalogFile =>
  ({ ...parseCatalogFile(kind, name, text), file: `/${kind}/${name}.md`, origin: 'stock', shadowed: false });

const CATALOG: Catalog = {
  facts: [file('facts', 'user', '# User\n- **line:** User: {user.name}{, user.role}\n- **order:** 1\n')],
  behaviours: [
    file('behaviours', 'base', '# Base\n- **seed:** Base seed.\n- **depth:** full\n- **order:** 1\n\nBase text.\n\n## Inner\nx'),
    file('behaviours', 'lead-ways', '# Lead\n- **seed:** Lead seed.\n- **when:** lead\n- **depth:** full\n- **order:** 2\n\nLead text.'),
    file('behaviours', 'pm', '# PM\n- **seed:** Items.\n- **when:** pm\n- **depth:** seed\n- **order:** 3\n\nPM text.'),
    file('behaviours', 'extra', '# Extra\n- **seed:** Optional.\n- **depth:** none\n- **order:** 4\n\nExtra text.'),
  ],
  tools: [
    file('tools', 'item', '# item\n- **seed:** Work items.\n- **serves:** pm\n'),
    file('tools', 'help', '# ronin-help\n- **seed:** More reading.\n- **order:** 9\n'),
  ],
};

test('the header: title, seed, when, depth, serves, order, then the full text', () => {
  const f = parseCatalogFile('tools', 'item', '# item\n- **seed:** One job.\n- **when:** cowork, !mika\n- **serves:** pm, lead-ways\n- **order:** 40\n\nBody here.\n');
  assert.deepEqual([f.title, f.seed, f.when, f.depth, f.serves, f.order, f.body], ['item', 'One job.', ['cowork', '!mika'], 'seed', ['pm', 'lead-ways'], 40, 'Body here.']);
  assert.equal(parseCatalogFile('facts', 'x', '# X\n- **depth:** none\n').depth, 'full', 'facts are told in full');
});

test('the user store replaces a stock file by name', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ronin-catalog-'));
  const old = process.env.RONIN_BEHAVIOURS_DIR;
  try {
    process.env.RONIN_BEHAVIOURS_DIR = root;
    await writeFile(path.join(root, 'base-agent.md'), '# Mine\n- **seed:** mine\n');
    await writeFile(path.join(root, 'my-own.md'), '# Own\n');
    const rows = await readCatalog('behaviours');
    const base = rows.find((row) => row.name === 'base-agent')!;
    assert.equal(base.title, 'Mine');
    assert.equal(base.shadowed, true);
    assert.ok(rows.some((row) => row.name === 'my-own' && row.origin === 'user'));
  } finally {
    if (old === undefined) delete process.env.RONIN_BEHAVIOURS_DIR; else process.env.RONIN_BEHAVIOURS_DIR = old;
    await rm(root, { recursive: true, force: true });
  }
});

test('one conditional function: words, negation, unknown never holds', () => {
  const r = record({ team: 't', lead: true, pm: true, desk: true, integrations: ['netlify'], role: 'lead' });
  for (const word of ['cowork', 'lead', 'team', 'pm', 'desk', 'integration:netlify', 'role:lead', 'owner', 'workspace:w', '!mika', '!hosted'])
    assert.equal(conditionHolds(word, r), true, word);
  for (const word of ['mika', 'checkout', 'integration:jira', 'role:coworker', 'service:ronin_services', 'nonsense'])
    assert.equal(conditionHolds(word, r), false, word);
});

test('integrations and project management only add down the layers; Jira on is pm on', () => {
  const layers: Layer[] = [layerOf('campaign', { integrations: ['netlify'] }), layerOf('team', { pm: false, integrations: ['jira'] })];
  const on = cascade(layers);
  assert.deepEqual(on.integrations, { netlify: 'campaign', jira: 'team' });
  assert.deepEqual(on.pm, { on: true, from: 'jira' });
  assert.deepEqual(cascade([layerOf('campaign', { pm: true }), layerOf('agent', { pm: false })]).pm, { on: true, from: 'campaign' });
  assert.deepEqual(cascade([layerOf('agent', { pm: false })]).pm, { on: false });
});

test('add, then block, then screen; a behaviour brings the tools that serve it', () => {
  const names = (layers: Layer[], r = record({ pm: true })) => {
    const out = resolveBrief(CATALOG, r, layers);
    return { behaviours: out.behaviours.map((row) => `${row.name}:${row.depth}${row.tools.length ? `[${row.tools.map((t) => t.name).join()}]` : ''}`), other: out.other.map((row) => row.name) };
  };
  assert.deepEqual(names([]), { behaviours: ['base:full', 'pm:seed[item]'], other: ['help'] });
  assert.deepEqual(names([], record()).behaviours, ['base:full'], 'pm off: no item behaviour, no item tool');
  assert.deepEqual(names([layerOf('team', { brief: { add: ['extra', { name: 'pm', depth: 'full' }] } })]).behaviours, ['base:full', 'pm:full[item]', 'extra:seed']);
  assert.deepEqual(names([layerOf('agent', { brief: { block: ['pm'] } })]).behaviours, ['base:full'], 'a blocked behaviour takes its tools with it');
  assert.deepEqual(names([layerOf('campaign', { brief: { only: ['pm'] } }), layerOf('agent', { brief: { add: ['extra'] } })]), { behaviours: ['pm:seed[item]'], other: [] }, 'nothing below adds back what a screen left out');
  assert.deepEqual(resolveBrief(CATALOG, record(), [layerOf('team', { brief: { only: ['base'] } })]).facts, [], 'a screen covers facts too');
  assert.deepEqual(resolveBrief(CATALOG, record(), [layerOf('team', { brief: { only: ['base', 'user'] } })]).facts.map((row) => row.name), ['user']);
  assert.deepEqual(resolveBrief(CATALOG, record(), [layerOf('agent', { brief: { block: ['user'] } })]).facts, [], 'a fact can be blocked');
  const why = resolveBrief(CATALOG, record({ team: 't', lead: true }), [layerOf('team', { brief: { add: ['extra'] } })]);
  assert.deepEqual(why.behaviours.map((row) => [row.name, row.why]), [['base', []], ['lead-ways', ['lead']], ['extra', ['add:team']]]);
});

test('mandate values are the files: a value is in play for the Agent that holds it, in its own section', () => {
  const plan = file('behaviours', 'reach-plan', "# Plan\n- **seed:** Plan; don't build.\n- **mandate:** reach\n- **with:** extra\n- **order:** 2\n");
  assert.deepEqual([plan.mandate, plan.value, plan.with], ['reach', 'plan', ['extra']]);
  assert.deepEqual([CATALOG.behaviours[0].mandate, CATALOG.behaviours[0].value], ['', ''], 'an ordinary behaviour has no axis');
  const catalog: Catalog = {
    ...CATALOG,
    behaviours: [
      ...CATALOG.behaviours,
      plan,
      file('behaviours', 'reach-execute', '# Execute\n- **seed:** Build it.\n- **mandate:** reach\n'),
      file('behaviours', 'recruit-nobody', '# Nobody\n- **seed:** Work alone.\n- **mandate:** recruit\n'),
      file('behaviours', 'output-code', '# Code\n- **seed:** Return code.\n- **mandate:** output\n- **depth:** full\n\nThe repo arrangement.'),
      file('behaviours', 'output-a-plan', '# A plan\n- **seed:** Return a plan.\n- **mandate:** output\n'),
    ],
  };
  const out = resolveBrief(catalog, record(), []);
  assert.deepEqual(out.mandates.map((row) => row.name), ['reach-plan', 'recruit-nobody', 'output-code']);
  assert.deepEqual(out.behaviours.map((row) => [row.name, row.depth, row.why]), [['base', 'full', []], ['extra', 'seed', ['with:reach-plan']]], 'never among the behaviours; with: brings its behaviour');
  assert.ok(!resolveBrief(catalog, { ...record(), agent: { ...record().agent, reach: 'execute' } }, []).behaviours.some((row) => row.name === 'extra'), 'another value, no with:');
  const text = renderBrief('demo', record(), out);
  assert.match(text, /## Facts[^]*## Mandate\n- Plan; don't build\.\n- Work alone\.\n- Return code\.\n\nThe repo arrangement\.[^]*## Behaviours/);
  assert.equal(resolveBrief(catalog, record(), [layerOf('team', { brief: { block: ['reach-plan'] } })]).mandates.length, 2, 'a blocked value is not told');
  const off = briefOff(catalog, [layerOf('team', { brief: { block: ['reach-plan'], only: ['base', 'user', 'reach-plan', 'reach-execute', 'recruit-nobody', 'output-code', 'output-a-plan'] } })]);
  assert.deepEqual(off.sort(), ['extra', 'help', 'item', 'lead-ways', 'pm', 'reach-plan'], 'off: blocked, or left out by a screen');
  assert.deepEqual(mandate({ reach: 'Review', recruit: 'nobody', output: ['an integration', 'code'] }), { reach: 'review', recruit: 'nobody', output: ['an integration', 'code'] }, 'any value is taken');
  assert.deepEqual(mandate({}), { reach: 'plan', recruit: 'propose agents', output: ['open'] });
  assert.deepEqual(templateMandate('review · nobody · a plan, notes'), { reach: 'review', recruit: 'nobody', output: ['a plan', 'notes'] });
});

test('the Lounge\'s user facts: words, call name, conditionals', async () => {
  const r = record();
  Object.assign(r.user, { first_name: 'Glen', nickname: 'G', technical_level: 'developer', ai_experience: 'daily', planned_use: ['coding', 'other'], planned_use_other: 'boats', time_zone: 'Europe/London' });
  assert.equal(fillLine('User: {user.name} (call them {user.call_name}), {user.role}{, user.organization}{ · user.technical_level}{, user.ai_experience}{ · plans user.planned_use}{ · user.time_zone}{, user.language}', r),
    'User: Glen (call them G), owner · developer, uses AI daily · plans coding, boats · Europe/London');
  for (const word of ['experience:developer', 'ai:daily', 'use:coding', 'use:other']) assert.equal(conditionHolds(word, r), true, word);
  for (const word of ['experience:some', 'ai:new', 'use:writing']) assert.equal(conditionHolds(word, r), false, word);

  const dir = await mkdtemp(path.join(os.tmpdir(), 'ronin-office-people-'));
  const old = process.env.RONIN_OFFICE_UNIT_DIR;
  try {
    process.env.RONIN_OFFICE_UNIT_DIR = dir;
    await writeFile(path.join(dir, 'members.json'), JSON.stringify({ members: [{ email: 'A@x.com', role: 'member', name: 'Ann Lee', first_name: 'Ann', planned_use: 'writing', technical_level: 'some', about: 'x'.repeat(600), unknown_key: 1 }] }));
    const { loadMembers, personByEmail, callName } = await import('../src/office-people.js');
    await loadMembers();
    const ann = personByEmail('a@x.com')!;
    assert.deepEqual([ann.role, ann.first_name, ann.planned_use, ann.technical_level, ann.about?.length], ['member', 'Ann', ['writing'], 'some', 500]);
    assert.equal(callName(ann), 'Ann');
  } finally {
    if (old === undefined) delete process.env.RONIN_OFFICE_UNIT_DIR; else process.env.RONIN_OFFICE_UNIT_DIR = old;
    await rm(dir, { recursive: true, force: true });
  }
});

test('fact lines fill from the record; an all-empty line is not printed', () => {
  assert.equal(fillLine('User: {user.name}{, user.role}', record()), 'User: Glen, owner');
  assert.equal(fillLine('Team: {agent.team}{, agent.wipeboard}', record()), '');
  const nameless = record();
  nameless.user.name = '';
  assert.equal(fillLine('User: {user.name}, {user.role}{, user.organisation}', nameless), 'User: owner', 'an empty value drops its segment');
  assert.equal(fillLine('Workspace: {setting.workspace} · repos {work.repos}', record()), 'Workspace: w', 'and its separator');
  assert.equal(fillLine('Ronin: {setting.hosted?hosted|self-hosted}', record()), 'Ronin: self-hosted');
  assert.equal(fillLine('Model: {agent.provider} {agent.model}{, agent.harness}{, agent.launch_mode}', record()), 'Model: configured', 'empty values leave no gap or dangling separator');
  const workspace = file('facts', 'workspace', '# Workspace\n- **line:** Workspace: {setting.workspace}\n\nRepositories:\n{work.repo_lines}\n\nFolders:\n{work.folder_lines}\n');
  const text = renderBrief('demo', record(), resolveBrief({ ...CATALOG, facts: [workspace] }, record(), []));
  assert.match(text, /- Workspace: w\n/);
  assert.doesNotMatch(text, /Repositories:|Folders:/, 'a paragraph whose values are all empty goes, its label with it');
});

test('a tool at depth: none is not told with its behaviour; a layer adding it tells it', () => {
  const quiet = file('tools', 'quiet', '# quiet\n- **seed:** Not yet.\n- **serves:** pm\n- **depth:** none\n');
  const catalog: Catalog = { ...CATALOG, tools: [...CATALOG.tools, quiet] };
  const tools = (layers: Layer[]) => resolveBrief(catalog, record({ pm: true }), layers).behaviours.find((row) => row.name === 'pm')!.tools.map((row) => row.name);
  assert.deepEqual(tools([]), ['item']);
  assert.deepEqual(tools([layerOf('agent', { brief: { add: ['quiet'] } })]), ['item', 'quiet']);
});

test('the brief: facts, behaviours with their tools, other tools, the help line, the end line', () => {
  const r = record({ pm: true });
  const text = renderBrief('demo', r, resolveBrief(CATALOG, r, []));
  assert.match(text, /^# Brief — demo\n\n## Facts\n- User: Glen, owner\n/);
  assert.match(text, /### Base\nBase text\.\n\n#### Inner/);
  assert.match(text, /### PM\nItems\. More: `ronin-help pm`\.\nTools:\n- `item`: Work items\./);
  assert.match(text, /## Other tools\n- `ronin-help`: More reading\./);
  assert.match(text, /`<tool> --help` gives its syntax\.\n\n— end of packet for demo —\n$/);
  assert.doesNotMatch(text, /YOUR TOOLS|SOUGHT|On your shelf|In this packet/);
});

test('an update sends only what differs', () => {
  const before = record();
  const snap = briefSnapshot(resolveBrief(CATALOG, before, []), before);
  assert.equal(briefChanges(snap, resolveBrief(CATALOG, before, []), before), '', 'nothing changed: nothing sent');
  const after = record({ pm: true, team: 't', lead: true });
  const changes = briefChanges(snap, resolveBrief(CATALOG, after, []), after);
  assert.match(changes, /### Lead\nLead text\./);
  assert.match(changes, /### PM\nItems\./);
  assert.match(changes, /- `item`: Work items\./);
  assert.doesNotMatch(changes, /Base text/);
  const left = briefChanges(briefSnapshot(resolveBrief(CATALOG, after, []), after), resolveBrief(CATALOG, before, []), before);
  assert.match(left, /No longer in your brief: Lead, PM, item\./);
});

