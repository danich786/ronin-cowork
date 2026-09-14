import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import {
  CAPABILITY_CLASSES,
  capabilityTools,
  checkRequirement,
  listCapabilities,
  parseToolsTable,
  renderCapabilitiesOverview,
  resolveCapabilities,
  type CapabilityFacts,
  type CapabilityRow,
} from '../src/capabilities.js';

const REPO = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const STOCK = path.join(REPO, 'ronin_catalogs', 'capabilities');

const none: CapabilityFacts = {
  arrangement: 'none', installations: new Set(), behaviours: new Set(),
  connected: false, campaign: false, team: false, lead: false,
};
const everything = (tool: string) => Promise.resolve(tool !== 'absent_tool');

const row = (name: string, requires: string[], tools = ''): CapabilityRow => ({
  name, origin: 'stock', shadowed: false, file: `/shelf/${name}.md`, label: name, blurb: `${name}?`, class: 'cowork',
  tools: parseToolsTable(`# x\n\n## Tools\n\n| Tool | Authority | Teach | Help |\n|---|---|---|---|\n${tools}`),
  requires,
});

async function withUserCatalogs<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'ronin-capabilities-test-'));
  const previous = process.env.RONIN_CATALOGS_DIR;
  process.env.RONIN_CATALOGS_DIR = temp;
  try {
    return await run(temp);
  } finally {
    if (previous === undefined) delete process.env.RONIN_CATALOGS_DIR;
    else process.env.RONIN_CATALOGS_DIR = previous;
    await rm(temp, { recursive: true, force: true });
  }
}

test('every requirement word reads one launch fact, and an unknown word never holds', () => {
  const facts: CapabilityFacts = {
    arrangement: 'managed', installations: new Set(['ronin_services']), behaviours: new Set(['ronin_host']),
    connected: true, campaign: true, team: true, lead: true,
  };
  for (const requirement of ['installation:ronin_services', 'behaviour:ronin_host', 'arrangement:managed', 'connected', 'campaign', 'team', 'lead']) {
    assert.equal(checkRequirement(requirement, facts), '', `${requirement} holds`);
    assert.notEqual(checkRequirement(requirement, none), '', `${requirement} fails on the bare launch`);
  }
  assert.equal(checkRequirement('arrangement:checkout', { ...none, arrangement: 'checkout' }), '');
  assert.match(checkRequirement('arrangement:managed', { ...none, arrangement: 'checkout' }), /no managed arrangement/);
  assert.match(checkRequirement('installation:trello', facts), /installation trello is off/);
  assert.match(checkRequirement('behaviour:gbrain', facts), /behaviour gbrain is not selected/);
  assert.match(checkRequirement('lead', { ...facts, lead: false }), /not the Team lead/);
  // A misspelt requirement withdraws the bundle rather than teaching it to everyone.
  assert.match(checkRequirement('leader', facts), /unknown requirement "leader"/);
  assert.match(checkRequirement('arrangement:worktree', facts), /unknown arrangement/);
  // Listings that show what a bundle would teach pass everything; a birth never does.
  assert.equal(checkRequirement('leader', { ...none, everything: true }), '');
});

test('the tools table names actual tools: executable, operation, authority, priority and help, columns in any order', () => {
  const tools = parseToolsTable([
    '# Bundle', '', '- **label:** Bundle', '', 'Prose before the table.', '',
    '## Tools', '',
    '| Help | Teach | Tool | Authority |',
    '|---|---|---|---|',
    '| | priority | `session_check` | read: one live session |',
    '| `worktree-desk --help` | | `worktree-desk hand-in` | write |',
    '| | | — | |',
    '', 'Prose after the table, with a | pipe in it.',
  ].join('\n'));
  assert.deepEqual(tools, [
    { name: 'session_check', command: 'session_check', authority: 'read: one live session', priority: true, help: 'session_check --help' },
    { name: 'worktree-desk', command: 'worktree-desk hand-in', authority: 'write', priority: false, help: 'worktree-desk --help' },
  ]);
  assert.deepEqual(parseToolsTable('# No table\n\n- **label:** x\n'), []);
  assert.deepEqual(parseToolsTable('# Tools heading, no table\n\n## Tools\n\nnone\n'), []);
});

test('selection is a predicate over launch facts; projection is what exists on the box; a toolless bundle is still selected', async () => {
  const rows = [
    row('edges', [], '| `edges send` | write | priority | `edges --help` |\n| `edges read` | read | priority | |\n'),
    row('worktree-desk', ['arrangement:managed'], '| `worktree-desk status` | read | priority | |\n'),
    row('team-lead', ['lead'], '| `session_create` | create | priority | |\n| `absent_tool` | write | priority | |\n'),
    row('host', ['behaviour:ronin_host'], '| `host_survey` | read | priority | |\n'),
    row('authority-only', ['team']),
  ];
  const bare = await resolveCapabilities({ ...none, arrangement: 'checkout' }, { rows, present: everything });
  assert.deepEqual(bare.map((item) => [item.name, item.selected, item.reason]), [
    ['edges', true, ''],
    ['worktree-desk', false, 'no managed arrangement'],
    ['team-lead', false, 'not the Team lead'],
    ['host', false, 'behaviour ronin_host is not selected'],
    ['authority-only', false, 'not on a Team'],
  ]);
  assert.deepEqual(capabilityTools(bare), ['edges']);
  // A bundle that was not selected has nothing projected and nothing missing: it was never looked for.
  assert.deepEqual(bare[1].delivered, []);
  assert.deepEqual(bare[1].missing, []);

  const lead = await resolveCapabilities(
    { arrangement: 'managed', installations: new Set(), behaviours: new Set(['ronin_host']), connected: true, campaign: true, team: true, lead: true },
    { rows, present: everything },
  );
  assert.ok(lead.every((item) => item.selected), lead.map((item) => `${item.name}:${item.reason}`).join(' '));
  assert.deepEqual(capabilityTools(lead), ['edges', 'worktree-desk', 'session_create', 'host_survey']);
  const teamLead = lead.find((item) => item.name === 'team-lead')!;
  assert.deepEqual(teamLead.delivered, ['session_create']);
  assert.deepEqual(teamLead.missing, ['absent_tool'], 'a listed tool the box lacks is recorded, never taught');
  const authorityOnly = lead.find((item) => item.name === 'authority-only')!;
  assert.equal(authorityOnly.selected, true);
  assert.deepEqual(authorityOnly.tools, []);
});

test('the overview is derived from the selected files: lesson, title, blurb, projected priority tools, help route, full document', async () => {
  const rows = [
    row('edges', [], '| `edges send` | write: one message | priority | `edges --help` |\n| `edges page` | read/write | | `edges --help` |\n'),
    row('team-lead', ['lead'], '| `session_create` | create | priority | |\n| `absent_tool` | write | priority | |\n'),
    row('authority-only', []),
    row('worktree-desk', ['arrangement:managed'], '| `worktree-desk status` | read | priority | |\n'),
  ];
  const resolved = await resolveCapabilities({ ...none, lead: true, team: true }, { rows, present: everything });
  const text = renderCapabilitiesOverview(resolved);
  assert.match(text, /^# YOUR TOOLS/m);
  assert.match(text, /Your tools are grouped by the work you are doing\./);
  assert.match(text, /Run any tool with `--help`/);
  const edgesAt = text.indexOf('### edges');
  const leadAt = text.indexOf('### team-lead');
  const onlyAt = text.indexOf('### authority-only');
  assert.ok(edgesAt >= 0 && leadAt > edgesAt && onlyAt > leadAt, 'selected bundles in folder order');
  assert.doesNotMatch(text, /### worktree-desk/, 'an unselected bundle is not in the lesson');
  const edges = text.slice(edgesAt, leadAt);
  assert.match(edges, /edges\?/, 'the blurb');
  assert.match(edges, /- \*\*Priority:\*\* `edges send` \(write\)/, "the authority is its first word; the clause stays in the document");
  assert.doesNotMatch(edges, /edges page/, 'a non-priority tool is left to --help');
  assert.match(edges, /- \*\*Help:\*\* `edges --help`/);
  assert.match(edges, /- \*\*Full document:\*\* `\/shelf\/edges\.md`/);
  const lead = text.slice(leadAt, onlyAt);
  assert.match(lead, /`session_create`/);
  assert.doesNotMatch(lead, /absent_tool/, 'a tool the box lacks is never advertised');
  assert.match(lead, /`session_create --help`/);
  const only = text.slice(onlyAt);
  assert.match(only, /none projected on this box yet — the document is the teaching/);
  assert.doesNotMatch(only, /Priority/);
  assert.match(renderCapabilitiesOverview([]), /No capability bundle was selected/);
});

test('the folder is the catalog: an owner file shadows a stock name whole, a new name is one more bundle, hidden withdraws', async () => {
  await withUserCatalogs(async (dir) => {
    await mkdir(path.join(dir, 'capabilities'), { recursive: true });
    await writeFile(path.join(dir, 'capabilities', 'edges.md'), '# Edges, mine\n- **label:** My edges\n- **requires:** team\n');
    await writeFile(path.join(dir, 'capabilities', 'trello.md'), [
      '# Trello', '- **label:** Trello', '- **class:** integration', '- **requires:** behaviour:trello, connected', '',
      '## Tools', '', '| Tool | Authority | Teach |', '|---|---|---|', '| `trello_cards` | read | priority |', '',
    ].join('\n'));
    await writeFile(path.join(dir, 'capabilities', 'session.md'), '# Gone\n- **hidden:** yes\n');
    const rows = await listCapabilities();
    const edges = rows.find((item) => item.name === 'edges')!;
    assert.equal(edges.origin, 'user');
    assert.equal(edges.shadowed, true);
    assert.equal(edges.label, 'My edges');
    assert.deepEqual(edges.requires, ['team']);
    assert.deepEqual(edges.tools, [], 'the shadow replaces the stock file whole, table included');
    const trello = rows.find((item) => item.name === 'trello')!;
    assert.equal(trello.class, 'integration');
    assert.deepEqual(trello.requires, ['behaviour:trello', 'connected']);
    assert.equal(trello.tools[0]?.name, 'trello_cards');
    assert.ok(!rows.some((item) => item.name === 'session'), 'hidden withdraws a stock definition');
    const resolved = await resolveCapabilities(
      { ...none, behaviours: new Set(['trello']), connected: true },
      { rows, present: async (tool) => tool === 'trello_cards' },
    );
    assert.equal(resolved.find((item) => item.name === 'trello')?.selected, true);
    assert.equal(resolved.find((item) => item.name === 'edges')?.reason, 'not on a Team');
    assert.deepEqual(capabilityTools(resolved), ['trello_cards']);
  });
});

test('the stock capability documents are well-formed and carry no retired vocabulary', async () => {
  const files = (await readdir(STOCK)).filter((name) => name.endsWith('.md') && name !== 'README.md').sort();
  assert.deepEqual(files, ['edges.md', 'gbrain.md', 'machine-settings.md', 'perplexity.md', 'ronin-host.md', 'ronin-services.md', 'session.md', 'team-lead.md', 'trello.md', 'work-record.md', 'worktree-desk.md']);
  const rows = await withUserCatalogs(() => listCapabilities());
  assert.deepEqual(rows.map((item) => item.name), ['edges', 'work-record', 'session', 'worktree-desk', 'machine-settings', 'team-lead', 'ronin-host', 'ronin-services', 'gbrain', 'trello', 'perplexity'], 'ordered by `order`');
  for (const item of rows) {
    const text = await readFile(item.file, 'utf8');
    assert.ok(item.label && item.blurb, `${item.name} has a label and a blurb`);
    assert.ok(CAPABILITY_CLASSES.includes(item.class), `${item.name} class`);
    assert.doesNotMatch(text, /tejun|MACROS\.md|ACTIONS\.md|\+\w+:/, `${item.name} teaches no retired name`);
    assert.doesNotMatch(text, /initial revision|revision-aware|revision counter is|reclaim|park a project|a verdict of|the decider/i, `${item.name} carries no retired project field`);
    for (const requirement of item.requires) assert.equal(checkRequirement(requirement, { ...none, everything: false, arrangement: 'managed', installations: new Set(['x', 'ronin_services']), behaviours: new Set(['x', 'ronin_host', 'gbrain', 'trello', 'perplexity']), connected: true, campaign: true, team: true, lead: true }), '', `${item.name} requires ${requirement}`);
    for (const tool of item.tools) assert.match(tool.name, /^[a-z][a-z0-9_-]*$/, `${item.name}: ${tool.command}`);
  }
  const by = Object.fromEntries(rows.map((item) => [item.name, item]));
  assert.deepEqual(by.edges.requires, []);
  assert.deepEqual(by['work-record'].requires, []);
  assert.deepEqual(by.session.requires, []);
  assert.deepEqual(by['worktree-desk'].requires, ['arrangement:managed']);
  assert.deepEqual(by['machine-settings'].requires, ['campaign']);
  assert.deepEqual(by['team-lead'].requires, ['lead']);
  assert.deepEqual(by['ronin-host'].requires, ['behaviour:ronin_host']);
  assert.deepEqual(by['ronin-services'].requires, ['installation:ronin_services']);
  assert.deepEqual(by.gbrain.requires, ['behaviour:gbrain']);
  assert.deepEqual(by.trello.requires, ['behaviour:trello', 'connected']);
  assert.deepEqual(by.perplexity.requires, ['behaviour:perplexity', 'connected']);
  for (const name of ['gbrain', 'trello', 'perplexity']) assert.deepEqual(by[name].tools, []);
  assert.deepEqual(by['ronin-services'].tools.map((tool) => tool.name), ['mika']);
  assert.doesNotMatch(await readFile(by.gbrain.file, 'utf8'), /\bmemor(?:y|ies)\b|tejun-(?:recall|remember)/i,
    'GBrain remains authority-only teaching with no retired memory vocabulary');
  assert.deepEqual(by['ronin-host'].tools.map((tool) => tool.name), ['ronin-host']);
  assert.equal(by['ronin-host'].tools[0]?.help, 'ronin-host --help');
  // Lead rulings, 2026-09-13: project create is first-class and a priority; session_create
  // is the lead's, never universal; session_check and session_set stay base.
  const priority = (name: string) => by[name].tools.filter((tool) => tool.priority).map((tool) => tool.command);
  assert.deepEqual(priority('work-record'), ['work-record update_record', 'work-record document add', 'work-record project create', 'work-record project read', 'work-record project write', 'work-record project return', 'work-record project backlog', 'work-record project done']);
  assert.deepEqual(priority('edges'), ['edges send', 'edges wipeboard', 'edges read', 'edges team']);
  assert.deepEqual(priority('worktree-desk'), ['worktree-desk status', 'worktree-desk sync', 'worktree-desk hand-in']);
  assert.deepEqual(priority('session'), ['session_check', 'session_fork']);
  assert.ok(by.session.tools.some((tool) => tool.name === 'session_set'));
  assert.ok(!by.session.tools.some((tool) => tool.name === 'session_create'), 'session_create is not universal');
  assert.deepEqual(priority('team-lead'), [
    'session_create', 'team-lead roster read', 'team-lead project create',
    'team-lead project read', 'team-lead project list', 'team-lead project write',
    'team-lead project assign', 'team-lead project return', 'team-lead project backlog',
    'team-lead project done', 'team-lead project restore', 'team-lead member status',
  ]);
  assert.match(await readFile(by['work-record'].file, 'utf8'), /Team roster issues its ID/);
  assert.match(await readFile(by['work-record'].file, 'utf8'), /Agents never choose or reuse IDs/);
  assert.match(await readFile(by['work-record'].file, 'utf8'), /`exit`[\s\S]*`none` · `agent` · `lead` · `user`[\s\S]*`status`[\s\S]*`green` · `yellow` · `red`/);
  assert.match(await readFile(by['team-lead'].file, 'utf8'), /Assign and return/);
  const machine = await readFile(by['machine-settings'].file, 'utf8');
  assert.match(machine, /canonical Campaign\/provider model\s+catalog used by the UI dropdowns/);
  assert.doesNotMatch(machine, /gpt-|claude-|gemini-|sonnet|opus/i, 'the capability carries no maintained model IDs');
});

test('optional capabilities are absent until their individual predicates hold', async () => {
  const rows = await withUserCatalogs(() => listCapabilities());
  const bare = await resolveCapabilities({ ...none, campaign: true }, { rows, present: async () => true });
  for (const name of ['ronin-host', 'ronin-services', 'gbrain', 'trello', 'perplexity']) {
    assert.equal(bare.find((row) => row.name === name)?.selected, false);
  }
  const selected = await resolveCapabilities({ ...none, campaign: true, connected: true,
    installations: new Set(['ronin_services']), behaviours: new Set(['ronin_host', 'gbrain', 'trello', 'perplexity']) },
  { rows, present: async () => true });
  for (const name of ['ronin-host', 'ronin-services', 'gbrain', 'trello', 'perplexity']) {
    assert.equal(selected.find((row) => row.name === name)?.selected, true);
  }
});
