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
import { briefChanges, fillLine, renderBrief } from '../src/brief.js';

/** One build over a record: what briefChanges compares. */
const built = (catalog: Catalog, doc: BriefRecord) => ({ doc, resolved: resolveBrief(catalog, doc, []) });

const record = (over: Partial<{ type: BriefRecord['session']['type']; team: string; lead: boolean; pm: boolean; desk: boolean; integrations: string[]; mcp: BriefRecord['setting']['mcp']; role: BriefRecord['agent']['role'] }> = {}): BriefRecord => ({
  session: { name: 'demo', title: '', type: over.type ?? 'cowork', template: '', task: 'Do it' },
  user: {
    name: 'Glen', email: '', first_name: '', last_name: '', nickname: '', role: 'owner', organization: '', job_title: '',
    time_zone: '', language: '', planned_use: [], planned_use_other: '', technical_level: '', ai_experience: '', about: '',
    new_owner: false, account: '',
  },
  people: [],
  setting: { hosted: false, campaign: 'c', workspace: 'w', instructions: '', integrations: over.integrations ?? [], available: (over.mcp ?? []).map((one) => ({ ...one, kind: 'mcp' as const })), mcp: over.mcp ?? [], api: [], pm: over.pm ?? false, services: [] },
  agent: { role: over.role ?? 'coworker', team: over.team ?? '', lead: over.lead ?? false, wipeboard: '', team_objective: '', team_integrations: [], reach: 'plan', recruit: 'nobody', output: ['code'], provider: '', model: '', harness: '', launch_mode: 'configured' },
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

test('integrations add down the layers; Jira ends at the Workspace (KAN-608)', () => {
  const on = cascade([layerOf('campaign', { integrations: ['netlify'] }), layerOf('team', { integrations: ['jira'] }), layerOf('agent', { integrations: ['jira'] })]);
  assert.deepEqual(on.integrations, { netlify: 'campaign' }, 'a Team or Agent cannot turn Jira on');
  assert.deepEqual(cascade([layerOf('user', { integrations: ['jira'] })]).integrations, {}, 'nor the user layer: Jira is Campaign and Workspace only');
  assert.deepEqual(cascade([layerOf('user', { brief: { integrations_off: ['jira'] } }), layerOf('campaign', { integrations: ['jira'] })]).integrations, { jira: 'campaign' }, 'a user-layer Jira off is ignored too');
  assert.deepEqual(cascade([layerOf('workspace', { integrations: [{ provider: 'jira' }] })]).integrations, { jira: 'workspace' });
  const off = cascade([layerOf('campaign', { integrations: ['jira'] }), layerOf('team', { brief: { integrations_off: ['jira'] } }), layerOf('agent', { brief: { integrations_off: ['jira'] } })]);
  assert.deepEqual([off.integrations, off.off], [{ jira: 'campaign' }, {}], 'nor turn it off');
});

test('project management: its own cascade, on at the Campaign by default, the narrowest layer holds, Jira never moves it (KAN-608)', () => {
  assert.deepEqual(cascade([]).pm, { on: true, from: 'campaign' }, 'nobody says: on, from the Campaign');
  assert.deepEqual(cascade([layerOf('campaign', {})]).pm, { on: true, from: 'campaign' });
  assert.deepEqual(cascade([layerOf('campaign', { pm: false })]).pm, { on: false, from: 'campaign' }, 'off is deliberate');
  assert.deepEqual(cascade([layerOf('campaign', { pm: false }), layerOf('team', { pm: true })]).pm, { on: true, from: 'team' }, 'a Team turns it back on');
  assert.deepEqual(cascade([layerOf('campaign', {}), layerOf('workspace', { pm: false }), layerOf('agent', { pm: true })]).pm, { on: true, from: 'agent' });
  assert.deepEqual(cascade([layerOf('campaign', {}), layerOf('team', { pm: false })]).pm, { on: false, from: 'team' });
  assert.deepEqual(cascade([layerOf('campaign', { pm: false, integrations: ['jira'] })]).pm, { on: false, from: 'campaign' }, 'Jira on does not turn pm on');
  assert.deepEqual(cascade([layerOf('campaign', { brief: { integrations_off: ['jira'] } })]).pm, { on: true, from: 'campaign' }, 'Jira off does not turn pm off');
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
  assert.match(text, /## Behaviours\nEach in full: `ronin-help <name>`; all of Ronin's Help: `ronin-help`\.\n\n###/, 'how to read every behaviour in full');
  assert.match(text, /### PM\nItems\. \(`pm`\)\nTools:\n- `item`: Work items\./, 'a seed prints its file name');
  assert.match(text, /## Other tools\n- `ronin-help`: More reading\./);
  assert.match(text, /`<tool> --help` gives its syntax\.\n\n— end of packet for demo —\n$/);
  assert.doesNotMatch(text, /YOUR TOOLS|SOUGHT|On your shelf|In this packet/);
});

test('an update sends only what differs between the two builds', () => {
  const before = record();
  assert.equal(briefChanges(built(CATALOG, before), built(CATALOG, before)), '', 'nothing changed: nothing sent');
  const after = record({ pm: true, team: 't', lead: true });
  const changes = briefChanges(built(CATALOG, before), built(CATALOG, after));
  assert.match(changes, /### Lead\nLead text\./);
  assert.match(changes, /### PM\nItems\./);
  assert.match(changes, /- `item`: Work items\./);
  assert.doesNotMatch(changes, /Base text/);
  const left = briefChanges(built(CATALOG, after), built(CATALOG, before));
  assert.match(left, /No longer in your brief: Lead, PM, item\./);
  const renamed = { ...before, user: { ...before.user, name: 'Alex' } };
  assert.equal(briefChanges(built(CATALOG, before), built(CATALOG, renamed)), '- User: Alex, owner', 'a fact changed on the record: that fact line only');
});

test('a behaviour whose wording differs between builds is sent again, at its depth (KAN-549)', () => {
  const r = record();
  const edited: Catalog = { ...CATALOG, behaviours: CATALOG.behaviours.map((one) => one.name === 'base'
    ? file('behaviours', 'base', '# Base\n- **seed:** Base seed.\n- **depth:** full\n- **order:** 1\n\nBase text, reworded.\n\n## Inner\nx') : one) };
  const changes = briefChanges(built(CATALOG, r), built(edited, r));
  assert.match(changes, /### Base\nBase text, reworded\./);
  assert.doesNotMatch(changes, /No longer in your brief/);
  assert.equal(briefChanges(built(edited, r), built(edited, r)), '', 'the same build: nothing');
});


test('narrowing: a layer turns off what is on above, for itself and below (KAN-589)', () => {
  const layers: Layer[] = [
    layerOf('campaign', { integrations: ['jira', 'netlify', 'perplexity'] }),
    layerOf('workspace', { brief: { integrations_off: ['jira'] } }),
    layerOf('team', { brief: { integrations_off: ['netlify'] } }),
    layerOf('agent', { integrations: ['netlify'] }),
  ];
  const on = cascade(layers);
  assert.deepEqual(on.integrations, { perplexity: 'campaign' }, 'off at the Team holds below it, an Agent add included');
  assert.deepEqual(on.off, { jira: 'workspace', netlify: 'team' });
  assert.deepEqual(on.pm, { on: true, from: 'campaign' }, 'Jira off leaves project management as it is');
  assert.deepEqual(layerOf('workspace', { brief: { integrations_off: ['perplexity', 'Bad Name'] } }).brief.integrations_off, ['perplexity']);
  assert.equal(layerOf('workspace', { brief: {} }).brief.integrations_off, undefined, 'nothing off: no key');
});

test('mcp-servers: one generated line per MCP server on, in play only when one is (KAN-589)', async () => {
  const catalog: Catalog = { facts: [], tools: [], behaviours: [(await readCatalog('behaviours')).find((one) => one.name === 'mcp-servers')!] };
  assert.equal(resolveBrief(catalog, record(), []).behaviours.length, 0, 'no MCP server on: not told');
  const r = record({ mcp: [{ name: 'wispr-flow', description: 'Voice dictation and transcripts.' }, { name: 'linear', description: 'Issues in Linear.' }] });
  assert.equal(conditionHolds('mcp', r), true);
  const text = renderBrief('demo', r, resolveBrief(catalog, r, []));
  assert.match(text, /### MCP servers\n.*keys: `mcp tools <name>`.* runs one\.\n- wispr-flow: Voice dictation and transcripts\.\n- linear: Issues in Linear\. \(`mcp-servers`\)/);
  const fewer = record({ mcp: [{ name: 'linear', description: 'Issues in Linear.' }] });
  const changes = briefChanges(built(catalog, r), built(catalog, fewer));
  assert.match(changes, /### MCP servers\n.*\n- linear: Issues in Linear\. \(`mcp-servers`\)/, 'a server gone: the seed is sent again');
  assert.doesNotMatch(changes, /wispr-flow/);
});
