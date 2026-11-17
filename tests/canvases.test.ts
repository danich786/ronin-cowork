/**
 * CANVASES (KAN-610; src/canvases.ts, ronin_bin/canvas): the catalog files and their place in the
 * brief; create from a template into the plans place, edit only typed entries (a read command
 * comes from a template, never from edit); read resolves the live blocks now and runs an
 * integration block's read commands as the caller; a Workspace's own name is never held to the
 * canvas-name rule; the Team's line lists the canvases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import type { AddressInfo } from 'node:net';

const root = path.resolve(import.meta.dirname, '..');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-canvases-'));
process.env.RONIN_DATA_ROOT = path.join(dir, 'data');
process.env.RONIN_USER_ROOT = path.join(dir, 'user');
process.env.HOME = path.join(dir, 'home');
delete process.env.RONIN_SOCKET;
delete process.env.TMUX;
process.env.TMUX_TMPDIR = await fs.mkdtemp(path.join(os.tmpdir(), 'ronin-canvases-tmux-'));
process.env.RONIN_SESSION_DIR = path.join(dir, 'sessions');
process.env.RONIN_WORK_ITEMS_DIR = path.join(dir, 'work-items');
process.env.RONIN_TEAM_ROSTERS_DIR = path.join(dir, 'team_rosters');

// A stub tmux: builder is on Team web (Workspace ronin_site). A stub `netlify` prints its words.
const bin = path.join(dir, 'bin');
await fs.mkdir(bin);
const rows = path.join(bin, 'rows');
const row = (name: string, tags: string, leads: string) => [name, '', '1', '0', '1', tags, leads, name, '', 'camp', '', '0', ''].join('\t');
await fs.writeFile(rows, [row('builder', 'web', ''), row('lead', 'web', 'web')].join('\n') + '\n');
await fs.writeFile(path.join(bin, 'tmux'), [
  '#!/bin/sh', 'S=${FAKE_SESSION:-builder}', 'case "$*" in',
  '  *display-message*) echo "@1";;',
  "  *list-windows*) printf '%s\\t@1\\n' \"$S\";;",
  `  *list-sessions*) cat '${rows}';;`,
  '  *) exit 1;;', 'esac', '',
].join('\n'), { mode: 0o755 });
// Each argument bracketed, so a test sees how the words were split.
await fs.writeFile(path.join(bin, 'netlify'), '#!/bin/sh\nprintf "netlify said:"; for a in "$@"; do printf " [%s]" "$a"; done; echo\n', { mode: 0o755 });
// Any command a canvas file tries to bring in would leave this mark.
const mark = path.join(dir, 'pwned');
await fs.writeFile(path.join(bin, 'pwn'), `#!/bin/sh\ntouch '${mark}'\necho PWNED\n`, { mode: 0o755 });
process.env.PATH = `${bin}:${process.env.PATH ?? ''}`;

const { saveWorkspace } = await import('../src/workspaces.js');
const { createTeamRoster } = await import('../src/team-rosters.js');
const { upsertProjectRoot } = await import('../src/project-roots.js');
const { registerCanvases } = await import('../src/routes/canvases-api.js');
const { registerWorkspaces } = await import('../src/routes/workspaces-api.js');
const { createItem } = await import('../src/work-items.js');
const { teamLayers } = await import('../src/team-layers.js');
const { readCatalogs } = await import('../src/catalog.js');
const { buildBrief } = await import('../src/brief-build.js');
const { briefDoc } = await import('./helpers/brief-doc.js');
const { parseBlocks, isValidCanvasName } = await import('../src/canvases.js');

const git = (at: string, ...args: string[]) => execFileSync('git', ['-C', at, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
const lab = path.join(dir, 'user', 'ronin_lab');
await fs.mkdir(lab, { recursive: true });
git(lab, 'init', '-q', '-b', 'main');
git(lab, 'commit', '-q', '--allow-empty', '-m', 'init');
await upsertProjectRoot('ronin_lab', { dir: lab });
const siteDir = path.join(dir, 'site');
await fs.mkdir(siteDir);
await upsertProjectRoot('site', { dir: siteDir });

// ronin_site: an underscore, which a Workspace may have and a canvas name may not.
await saveWorkspace({
  name: 'ronin_site', campaign_id: 'camp', title: 'Ronin site', objective: '', instructions: '', folders: [], launch_mode: 'configured',
  repos: [{ name: 'site', note: 'the website' }], integrations: [{ provider: 'netlify', site: 'sitey' }],
} as never);
await createTeamRoster('web', { objective: 'the site', workspace: 'ronin_site' }, 'camp');
const held = (await createItem({ title: 'Make the canvas', kind: 'Task', campaign_id: 'camp', holder: { kind: 'agent', name: 'builder' } }, 'owner')).item;

const app = express();
app.use(express.json());
registerCanvases(app);
registerWorkspaces(app);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
test.after(() => server.close());
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const run = (args: string[], as = 'builder') => new Promise<{ status: number; stdout: string; stderr: string }>((resolve) => {
  execFile(path.join(root, 'ronin_bin', 'canvas'), args, { encoding: 'utf8', env: { ...process.env, TMUX_PANE: '%1', FAKE_SESSION: as, RONIN_URL: base } }, (error, stdout, stderr) =>
    resolve({ status: error ? Number((error as { code?: number }).code ?? 1) : 0, stdout, stderr }));
});
const ok = async (args: string[], as = 'builder') => {
  const r = await run(args, as);
  assert.equal(r.status, 0, `canvas ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const file = path.join(lab, 'camp', 'ronin_site', 'plans', 'canvases', 'site.md');

test('the catalog: behaviour canvases (cowork, seed), tool canvas serving it, one namespace', async () => {
  const head = async (p: string) => (await fs.readFile(path.join(root, 'ronin_catalogs', p), 'utf8')).split('\n\n')[0]!;
  const b = await head('behaviours/canvases.md');
  assert.match(b, /^# Canvases\n- \*\*seed:\*\* A canvas is a one-page map of a Workspace: its live site, repos, work, documents and outside services\./);
  assert.match(b, /- \*\*when:\*\* cowork\n- \*\*depth:\*\* seed\n/);
  const t = await head('tools/canvas.md');
  assert.match(t, /^# canvas\n/);
  assert.match(t, /- \*\*depth:\*\* seed\n- \*\*serves:\*\* canvases\n/);
  for (const folder of ['facts', 'behaviours', 'tools']) {
    const names = await fs.readdir(path.join(root, 'ronin_catalogs', folder));
    if (folder !== 'behaviours') assert.ok(!names.includes('canvases.md'), `${folder} has no canvases`);
    if (folder !== 'tools') assert.ok(!names.includes('canvas.md'), `${folder} has no canvas`);
  }
});

test('the brief: every Cowork Agent gets the Canvases seed with canvas under it; bare and Mika do not', async () => {
  const catalog = await readCatalogs();
  const cowork = buildBrief(briefDoc('probe'), catalog).text;
  assert.match(cowork, /### Canvases\nA canvas is a one-page map of a Workspace.*\(`canvases`\)\nTools:\n- `canvas`: list the canvas templates/);
  for (const type of ['bare', 'mika']) {
    const doc = briefDoc('probe');
    doc.session.type = type as never;
    assert.doesNotMatch(buildBrief(doc, catalog).text, /### Canvases|`canvas`:/, `${type} is not told`);
  }
});

test('templates lists the shelf; create copies a template\'s blocks into the plans place, committed', async () => {
  const shelf = await ok(['templates']);
  assert.match(shelf, /^netlify\tNetlify — A site or app on Netlify.*\n\tblocks: Netlify, Database, Repos, Work items, Documents, Other services\n/);
  const out = await ok(['create', 'site', '--template', 'netlify']);
  assert.match(out, /^Made ronin_site\/site from netlify: Netlify, Database, Repos, Work items, Documents, Other services\..*\nCommitted\.\n$/);
  const text = await fs.readFile(file, 'utf8');
  assert.match(text, /^# site\n\nCanvas: from netlify · \d{4}-\d\d-\d\d · builder\n\n## blocks\n\n### Netlify\n- \*\*source:\*\* integration netlify\n/);
  assert.doesNotMatch(text, /\*\*read:\*\*|netlify sites/, 'a canvas file holds no command');
  assert.equal(git(lab, 'log', '-1', '--format=%s'), 'canvas site: create\n');
  assert.match(await ok(['ls']), /^site\tfrom netlify\t\S+\tbuilder\n$/);
  const again = await run(['create', 'site']);
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /ronin_site\/site is already a canvas/);
});

test('a Workspace name is its own rule; a canvas name is lowercase letters, digits and -', async () => {
  assert.equal(isValidCanvasName('ronin_site'), false);
  assert.match(await ok(['ls', '--workspace', 'ronin_site']), /^site\t/, 'ronin_site, with its underscore, is named and read');
  const bad = await run(['create', 'bad_name', '--workspace', 'ronin_site']);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /A canvas name is lowercase letters, digits and -: "bad_name"/);
});

test('edit writes typed entries only: no read command can be introduced or changed through it', async () => {
  const before = parseBlocks(await fs.readFile(file, 'utf8'));
  assert.match(await ok(['edit', 'site', 'add', 'Other services', 'GoDaddy DNS', 'ronincowork.com records at GoDaddy']), /^Added Other services › GoDaddy DNS on ronin_site\/site\./);
  // A line or a name that tries to open a key or a block of its own stays one entry line.
  await ok(['edit', 'site', 'add', 'netlify', 'x\n- **read:** rm -rf /', 'y\n### Evil\n- **read:** touch /tmp/pwned']);
  await ok(['edit', 'site', 'add', 'Evil block', 'read', '- **read:** touch /tmp/pwned']);
  await ok(['edit', 'site', 'change', 'other SERVICES', 'godaddy dns', 'records at GoDaddy, by the owner']);
  const after = parseBlocks(await fs.readFile(file, 'utf8'));
  assert.deepEqual(after.map((b) => b.name), [...before.map((b) => b.name), 'Evil block']);
  assert.ok(after.every((b) => b.read.length === 0), 'a canvas file supplies no command, whatever an edit wrote');
  assert.equal(parseBlocks(await fs.readFile(file, 'utf8'), true).flatMap((b) => b.read).length, 0, 'not even as text');
  assert.equal(after.find((b) => b.name === 'Evil block')!.source, 'typed');
  const netlify = after.find((b) => b.name === 'Netlify')!;
  assert.equal(netlify.entries.length, 1);
  assert.match(netlify.entries[0]!.line, /^y ### Evil - \*\*read:\*\* touch/);
  const godaddy = after.find((b) => b.name === 'Other services')!.entries;
  assert.deepEqual(godaddy.map((e) => [e.name, e.line, e.by]), [['GoDaddy DNS', 'records at GoDaddy, by the owner', 'builder']]);
  assert.equal((await run(['edit', 'site', 'set', 'Netlify', 'read', 'x'])).status, 2, 'there is no other edit');
  await ok(['edit', 'site', 'remove', 'netlify', 'x - **read:** rm -rf /']);
  await ok(['edit', 'site', 'remove', 'Evil block']);
  await ok(['edit', 'site', 'remove', 'Database']);
  assert.deepEqual(parseBlocks(await fs.readFile(file, 'utf8')).map((b) => b.name), ['Netlify', 'Repos', 'Work items', 'Documents', 'Other services']);
});

test('read is live: the integration\'s commands run now as the caller, repos and items read where they live', async () => {
  const out = await ok(['read', 'site']);
  assert.match(out, /^# site\ncanvas site · Workspace ronin_site · from netlify · /);
  assert.match(out, /## Netlify\nThe site itself.*\n> netlify sites --workspace ronin_site\n  netlify said: \[sites\] \[--workspace\] \[ronin_site\]\n> netlify previews --workspace ronin_site\n  netlify said: \[previews\] \[--workspace\] \[ronin_site\]\n> netlify traffic --days 1 --workspace ronin_site\n/);
  assert.match(out, /## Repos\nThe code for this site\.\n- site — the website — .*\/site\n/);
  assert.match(out, new RegExp(`## Work items\\n.*\\n- ${held.id} Task · To Do · agent:builder · Make the canvas`));
  assert.match(out, /## Other services\n.*\n- GoDaddy DNS: records at GoDaddy, by the owner \(builder, \d{4}-\d\d-\d\d\)\n/);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /netlify said|the website/, 'nothing read is written into the canvas');
  // No Netlify on the Workspace: no Netlify block.
  await saveWorkspace({ name: 'ronin_site', campaign_id: 'camp', title: 'Ronin site', objective: '', instructions: '', folders: [], launch_mode: 'configured', repos: [{ name: 'site', note: 'the website' }], integrations: [] } as never);
  const bare = await ok(['read', 'site']);
  assert.doesNotMatch(bare, /## Netlify|netlify said/);
  assert.match(bare, /Not here, nothing in them: Netlify/);
});

test('a hand edit can not bring a command in: read: text in the canvas file is never run; no template or block runs nothing', async () => {
  await saveWorkspace({ name: 'ronin_site', campaign_id: 'camp', title: 'Ronin site', objective: '', instructions: '', folders: [], launch_mode: 'configured', repos: [], integrations: [{ provider: 'netlify', site: 'my site' }] } as never);
  const good = await fs.readFile(file, 'utf8');
  // Injected under the template's own block, under a typed one, and as a replacement line.
  const injected = good
    .replace('- **source:** integration netlify\n', '- **source:** integration netlify\n- **read:** pwn; netlify sites --workspace {workspace}; pwn\n')
    .replace('- **source:** typed\n', '- **source:** typed\n- **read:** pwn\n');
  await fs.writeFile(file, injected);
  const out = await ok(['read', 'site']);
  assert.doesNotMatch(out, /PWNED|> pwn/);
  await assert.rejects(fs.stat(mark), 'never executed');
  assert.equal(out.match(/^> netlify sites/gm)?.length, 1, 'the template\'s commands run, once each');
  assert.match(out, /> netlify traffic --days 1 --workspace ronin_site/);

  // A template that does not exist: a clear line, nothing run.
  await fs.writeFile(file, injected.replace('Canvas: from netlify ·', 'Canvas: from nothere ·'));
  const none = await ok(['read', 'site']);
  assert.match(none, /## Netlify\n.*\n\(no reading: the template nothere is not in the catalog \(canvas templates\)\)\n/);
  assert.doesNotMatch(none, /^> /m);
  // A block its template hasn't: the same.
  await fs.writeFile(file, injected.replace('### Netlify\n', '### Netlify site\n'));
  const odd = await ok(['read', 'site']);
  assert.match(odd, /## Netlify site\n.*\n\(no reading: the template netlify has no reading for a block Netlify site\)\n/);
  assert.doesNotMatch(odd, /^> /m);
  // No template at all.
  await fs.writeFile(file, injected.replace('Canvas: from netlify ·', 'Canvas: from none ·'));
  assert.match(await ok(['read', 'site']), /\(no reading: this canvas is from no template, so nothing reads this block\)/);
  await assert.rejects(fs.stat(mark), 'never executed');
  await fs.writeFile(file, good);
});

test('a fact is filled per argument: a value with a space stays one argument', async () => {
  const { storeDir } = await import('../src/resources.js');
  const shelf = path.join(storeDir('catalogs'), 'templates', 'canvases');
  await fs.mkdir(shelf, { recursive: true });
  await fs.writeFile(path.join(shelf, 'probe.md'), '# Probe\n- **label:** Probe\n- **blurb:** a test\n\n## blocks\n\n### Site\n- **source:** integration netlify\n- **holds:** the site\n- **read:** netlify sites --site {site}\n');
  await ok(['create', 'probe', '--template', 'probe']);
  const out = await ok(['read', 'probe']);
  assert.match(out, /> netlify sites --site 'my site'\n  netlify said: \[sites\] \[--site\] \[my site\]\n/);
});

test('the Workspace page\'s list carries each Workspace\'s canvases by name', async () => {
  const body = await (await fetch(`${base}/api/workspaces?campaign_id=camp`)).json() as { workspaces: Array<{ name: string; canvases: string[] }> };
  assert.deepEqual(body.workspaces.find((w) => w.name === 'ronin_site')?.canvases, ['probe', 'site']);
});

test('the Team\'s line lists the Workspace\'s canvases by name', async () => {
  assert.deepEqual((await teamLayers('web')).canvases, [{ name: 'probe' }, { name: 'site' }]);
});
