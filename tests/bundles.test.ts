/**
 * TEMPLATE BUNDLES (src/bundles.ts): the document is held to its shape, a plan says what an
 * install would do and why, an install lands only in the owner's stores and is idempotent,
 * a tool never replaces one of Ronin's, and a pack carries back out exactly what the
 * owner's copies hold. Every user store is pointed at a temp root; no live store, no
 * tmux, no socket, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(tmpdir(), 'ronin-bundles-'));
process.env.RONIN_USER_ROOT = path.join(root, 'user');
process.env.RONIN_DATA_ROOT = path.join(root, 'data');
const { installBundle, packBundle, parseBundle, parseLibraryIndex, planInstall, libraryCard, bundleHolds, BUNDLE_FORMAT, LIBRARY_FORMAT } =
  await import('../src/bundles.js');
const { listTeamTemplates, listBehaviours } = await import('../src/resource-adapters.js');
const { resolveBehaviourBooks } = await import('../src/behaviours.js');
const { STOCK_DIR } = await import('../src/resources.js');
const { storeDir } = await import('../src/resources.js');

const TEAM = `# Weekly Review
- **label:** Weekly Review
- **art:** 🗓
- **blurb:** A week looked back on, and the next one shaped.
- **kinds:** work
- **objective:** Review the week and shape the next.
- **behaviours:** weekly_review

## agents

### review lead
- **team_lead:** yes
- **instructions:** Run the review.
- **mandate:** execute · nobody · an artifact
`;
const SOP = '# weekly_review — how this house reviews a week\n\nLook back, then forward.\n';
const BEHAVIOUR = `# Weekly Review
- **label:** Weekly Review
- **blurb:** The review tool and its book.
- **reading:** —
- **sops:** weekly_review
- **tools:** tejun-review
- **mcp:** —
- **installation:** —
- **order:** 90
`;
const TOOL = '#!/usr/bin/env bash\necho REVIEWED\n';
const TOOL_ROW = '| `tejun-review` | report-outcome | `tejun-review` → `REVIEWED`. |';

const bundle = () => parseBundle({
  format: BUNDLE_FORMAT,
  name: 'weekly_review',
  label: 'Weekly Review',
  art: '🗓',
  blurb: 'A week looked back on.',
  kinds: ['work', 'nonsense'],
  version: '2026-09-03',
  files: [
    { store: 'catalogs', path: 'templates/teams/weekly_review.md', text: TEAM },
    { store: 'sops', path: 'weekly_review.md', text: SOP },
    { store: 'ways', path: 'weekly_review.md', text: BEHAVIOUR },
    { store: 'tools', path: 'tejun-review', text: TOOL },
  ],
  entries: [
    { catalog: 'TOOLS.md', name: 'tejun-review', text: TOOL_ROW },
  ],
});

test('a bundle is held to its shape', () => {
  assert.throws(() => parseBundle({ format: 'x' }), /not ronin-bundle\/1/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'Bad Name', files: [] }), /lowercase/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', files: [{ store: 'sops', path: '../etc/passwd.md', text: '' }] }), /inside its store/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', files: [{ store: 'catalogs', path: 'PROJECT_ROOTS.md', text: '' }] }), /catalog file sits on/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', files: [{ store: 'tools', path: 'tmux', text: '' }] }), /never supplies a guard/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', files: [{ store: 'sops', path: 'a.md', text: 'x' }], entries: [{ catalog: 'MACROS.md', name: 'a', text: '## a\n' }] }), /catalog is one of TOOLS\.md, MODEL_PROVIDERS\.md/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', files: [{ store: 'sops', path: 'a.md', text: 'x' }], entries: [{ catalog: 'ACTIONS.md', name: 'a', text: '## a\n' }] }), /catalog is one of TOOLS\.md, MODEL_PROVIDERS\.md/);
  // The provider catalog is entry-merged too, per `### <Vendor>` section, named by the id it declares.
  const section = '### OpenAI\n\n- **provider:** `openai`\n- **cli:** `codex`\n\n| model | tier | default | cost | good at | not good at | launch |\n|---|---|---|---|---|---|---|\n| `gpt-7` | frontier | yes | $5 (2026-10) | a | b | `codex --model gpt-7` |\n';
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', entries: [{ catalog: 'MODEL_PROVIDERS.md', name: 'other', text: section }] }), /named by its `- \*\*provider:\*\* id`/);
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', entries: [{ catalog: 'MODEL_PROVIDERS.md', name: 'openai', text: '## OpenAI\n- **provider:** `openai`\n' }] }), /`### <Vendor>` heading/);
  const provider = parseBundle({ format: BUNDLE_FORMAT, name: 'x', entries: [{ catalog: 'MODEL_PROVIDERS.md', name: 'openai', text: section }] });
  assert.equal(provider.entries[0].catalog, 'MODEL_PROVIDERS.md');
  assert.throws(() => parseBundle({ format: BUNDLE_FORMAT, name: 'x', files: [] }), /holds nothing/);
  const b = bundle();
  assert.deepEqual(b.kinds, ['work'], 'an unruled kind is dropped, not fatal');
  assert.equal(b.files.find((f) => f.store === 'tools')?.executable, true);
  assert.deepEqual(bundleHolds(b), { teams: 1, sops: 1, ways: 1, tools: 2 });
});

test('the plan says what an install would do, and a tool never replaces one of Ronin\'s', async () => {
  const stockTeam = await readFile(path.join(STOCK_DIR, 'templates/teams/staff_my_codebase.md'), 'utf8');
  const b = parseBundle({
    format: BUNDLE_FORMAT,
    name: 'probe',
    files: [
      { store: 'catalogs', path: 'templates/teams/staff_my_codebase.md', text: stockTeam },
      { store: 'catalogs', path: 'templates/teams/dinner_party.md', text: '# Dinner Party\n- **label:** Mine\n' },
      { store: 'sops', path: 'brand_new.md', text: '# new\n' },
      { store: 'tools', path: 'tejun-send', text: '#!/bin/sh\n' },
    ],
    entries: [
      { catalog: 'TOOLS.md', name: 'tejun', text: '| `tejun` | compile-macro | mine |' },
    ],
  });
  const plan = await planInstall(b);
  const verdict = (p: string) => plan.find((i) => i.path === p)?.verdict;
  assert.equal(verdict('templates/teams/staff_my_codebase.md'), 'same-as-shipped');
  assert.equal(verdict('templates/teams/dinner_party.md'), 'shadows-shipped');
  assert.equal(verdict('brand_new.md'), 'new');
  assert.equal(verdict('tejun-send'), 'refused');
  assert.equal(verdict('tejun'), 'refused');
  const receipt = await installBundle(b);
  assert.deepEqual(receipt.refused.map((i) => i.path).sort(), ['tejun', 'tejun-send']);
  assert.deepEqual(receipt.skipped.map((i) => i.path), ['templates/teams/staff_my_codebase.md']);
  assert.deepEqual(receipt.written.map((i) => i.path).sort(), ['brand_new.md', 'templates/teams/dinner_party.md']);
  await rm(storeDir('catalogs'), { recursive: true, force: true });
  await rm(storeDir('sops'), { recursive: true, force: true });
});

test('an install lands in the owner\'s stores, reads back, and is idempotent', async () => {
  const first = await installBundle(bundle());
  assert.equal(first.refused.length, 0);
  assert.equal(first.written.length, 5);
  const team = (await listTeamTemplates()).find((row) => row.name === 'weekly_review');
  assert.equal(team?.origin, 'user');
  assert.equal(team?.agents[0]?.team_lead, true);
  assert.deepEqual(team?.behaviours, ['weekly_review']);
  const books = await resolveBehaviourBooks(team?.behaviours ?? []);
  assert.equal(books.delivered[0]?.file, path.join(storeDir('ways'), 'weekly_review.md'));
  const behaviour = (await listBehaviours()).find((row) => row.name === 'weekly_review');
  assert.deepEqual(behaviour?.tools, ['tejun-review']);
  assert.equal(behaviour?.installation, '', 'the catalog dash means this behaviour needs no installation');
  const tool = await stat(path.join(storeDir('tools'), 'tejun-review'));
  assert.ok(tool.mode & 0o100, 'a bundled tool is executable');
  const tools = await readFile(path.join(storeDir('catalogs'), 'TOOLS.md'), 'utf8');
  assert.match(tools, /^\| Tool \| Implements \(action\) \| Usage \|$/m);
  assert.match(tools, /^\| `tejun-review` \|/m);

  const again = await installBundle(bundle());
  assert.equal(again.written.length, 0);
  assert.equal(again.skipped.length, 5);
  assert.ok(again.skipped.every((i) => i.verdict === 'same-as-yours'));

  // The owner edits their copy; the bundle does not write over it unless told to.
  await writeFile(path.join(storeDir('sops'), 'weekly_review.md'), '# mine now\n');
  const kept = await installBundle(bundle());
  assert.equal(kept.skipped.find((i) => i.path === 'weekly_review.md')?.verdict, 'replaces-yours');
  assert.equal(await readFile(path.join(storeDir('sops'), 'weekly_review.md'), 'utf8'), '# mine now\n');
  const replaced = await installBundle(bundle(), { replace: true });
  assert.equal(replaced.written.find((i) => i.path === 'weekly_review.md')?.verdict, 'replaces-yours');
  assert.equal(await readFile(path.join(storeDir('sops'), 'weekly_review.md'), 'utf8'), SOP);

});

test('a pack carries back out what the owner\'s copies hold, and reads as a bundle', async () => {
  await mkdir(storeDir('ways'), { recursive: true });
  await writeFile(path.join(storeDir('ways'), 'my_way.md'), '# My way\n- **kinds:** work\n\nMine.\n');
  const packed = await packBundle({ team: 'weekly_review', ways: ['my_way'], version: '2026-09-03' });
  const paths = packed.files.map((f) => `${f.store}:${f.path}`).sort();
  assert.deepEqual(paths, [
    'catalogs:templates/teams/weekly_review.md',
    'sops:weekly_review.md',
    'tools:tejun-review',
    'ways:my_way.md',
    'ways:weekly_review.md',
  ]);
  assert.deepEqual(packed.entries.map((e) => `${e.catalog}:${e.name}`).sort(), ['TOOLS.md:tejun-review']);
  assert.equal(packed.entries.find((e) => e.catalog === 'TOOLS.md')?.text, TOOL_ROW);
  assert.equal(packed.label, 'Weekly Review');
  await assert.rejects(packBundle({ team: 'no_such_team' }), /not a team template/);

  // A shipped template packs its own file; the stock books it names stay named, not copied.
  const shipped = await packBundle({ team: 'staff_my_codebase' });
  assert.deepEqual(shipped.files.map((f) => f.path), ['templates/teams/staff_my_codebase.md']);

  const text = JSON.stringify(packed);
  const card = libraryCard(packed, text, 'bundles/weekly_review.json');
  assert.equal(card.sha256.length, 64);
  assert.deepEqual(card.holds, { teams: 1, sops: 1, tools: 2, ways: 2 });
  const index = parseLibraryIndex({ format: LIBRARY_FORMAT, bundles: [card, { name: 'evil', url: 'https://elsewhere.example/x.json' }, { name: 'up', url: '../x.json' }] });
  assert.deepEqual(index.bundles.map((c) => c.name), ['weekly_review'], 'a card pointing off the library is dropped');
  assert.throws(() => parseLibraryIndex({ format: 'nope' }), /not ronin-library\/1/);
});

test.after(async () => {
  delete process.env.RONIN_USER_ROOT;
  delete process.env.RONIN_DATA_ROOT;
  await rm(root, { recursive: true, force: true });
});
