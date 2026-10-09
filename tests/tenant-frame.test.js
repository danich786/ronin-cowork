import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WORKSPACE_DESTINATIONS, WORKBENCH_APPEARANCES } from '../public/js/workspace-contract.js';
import { readingKey } from '../public/js/store.js';

const source = (file) => readFile(new URL(`../public/js/${file}`, import.meta.url), 'utf8');

// Destination id and appearance are one word in workspace.js: a tenant missing from either
// list opens on Home instead of itself.
test('the new tenants are destinations and appearances; the Next root is a destination only', () => {
  for (const word of ['collections', 'team-next', 'board', 'workspace']) {
    assert.ok(WORKSPACE_DESTINATIONS.includes(word), `${word} destination`);
    assert.ok(WORKBENCH_APPEARANCES.includes(word), `${word} appearance`);
  }
  assert.ok(WORKSPACE_DESTINATIONS.includes('next'));
  assert.ok(!WORKBENCH_APPEARANCES.includes('next'), 'the root is a static page, not a workbench');
});

// The key is the server's spelling of the want (src/ws/events.ts wantedReading): resource, then
// the filter's JSON in its field order, trimmed, empties dropped, roots deduped. A key spelt
// otherwise would want a reading the server answers under a different name.
test('a reading key is the server spelling of its filter', () => {
  assert.equal(readingKey('collection'), 'collection:{}');
  assert.equal(readingKey('collection', { root: ['b', 'a', 'b', ''], team: ' surface ', campaign: 'c 1', agent: 'x' }), 'collection:{"campaign":"c 1","team":"surface","root":["b","a"]}');
  assert.equal(readingKey('collection', { stage: ['DONE', ' BUILD', 'DONE', ''], root: ['a'] }), 'collection:{"root":["a"],"stage":["DONE","BUILD"]}', 'stage rides after root, normalised as root is (surface_push, 2026-10-08)');
  assert.equal(readingKey('collection', { board: ' w3 ', root: 'one' }), 'collection:{"board":["w3"],"root":["one"]}', 'a collection board is a list, as root is (surface_push, 2026-10-09)');
  assert.equal(readingKey('collection', { board: ['w2', ' w1', 'w2', ''] }), 'collection:{"board":["w2","w1"]}');
  assert.equal(readingKey('work-items', { board: 'w1', team: 'surface' }), 'work-items:{"team":"surface","board":"w1"}');
});

test('the tenant frame is the one seat machinery; tenants are thin files over it and cowork-view is untouched', async () => {
  const [frame, cowork, main] = await Promise.all([source('tenant-frame.js'), source('cowork-view.js'), source('main.js')]);
  assert.match(frame, /createWarmTerminalPool\(/);
  assert.match(frame, /WorkspaceKit\.workbench\.create\(/);
  for (const file of ['collections-view.js', 'team-view.js', 'board-view.js', 'workspace-view.js']) {
    const tenant = await source(file);
    assert.doesNotMatch(tenant, /createWarmTerminalPool|workbench\.create\(/, `${file} owns no seats`);
    assert.match(tenant, /createTenantFrame\(\{/);
  }
  assert.doesNotMatch(cowork, /tenant-frame/, 'the old file is left as it is');
  assert.match(main, /workspace\.register\('collections', createCollectionsView\(\)\)/);
  assert.match(main, /workspace\.register\('team-next', createTeamView\(\)\)/);
  assert.match(main, /workspace\.register\('board', createBoardView\(\)\)/);
  assert.match(main, /workspace\.register\('workspace', createWorkspaceView\(\)\)/);
  assert.match(main, /standing: \['collections', 'team-next', 'board', 'workspace'\]/);
});

// The browser READS through the one seam; a write goes to its route (a PUT, POST or DELETE on that line).
test('only the reading seam reads the collection and work-items routes among the new files', async () => {
  for (const file of ['tenant-frame.js', 'collections-view.js', 'team-view.js', 'team-commons-surface.js', 'board-view.js', 'workspace-view.js', 'workspace-teams-surface.js', 'where-surface.js', 'workspace-docs-surface.js', 'reading-surface.js', 'next-home.js', 'team-profile.js', 'work-details.js']) {
    assert.doesNotMatch(await source(file), /\/api\/(collection|work-items)(?![^\n]*method: '(PUT|POST|DELETE)')/, `${file} reads through collection-reading.js`);
  }
});

// Owner 2026-09-28: Cowork and Desk offer no per-Team card. The Team profile card is a type of
// its own, offered on team-next alone; the old type stays exactly as it was.
test('the Team profile card belongs to team-next only', async () => {
  const catalog = await source('workbench-catalog.js');
  assert.match(catalog, /type: WORKBENCH_TYPES\.team, header: 'surface', discover: \(\) => \[\]/);
  assert.match(catalog, /WORKBENCH_PROFILES\.teamNext, \[[^\n]*WORKBENCH_TYPES\.teamProfile/);
  assert.doesNotMatch(catalog, /WORKBENCH_PROFILES\.(cowork|desk|team|agent), \[[^\n]*teamProfile/);
});

// Owner 2026-10-09: on team-next the Trello view and Work Items are one card, Work: one
// surface, one header, two questions, both engines drawn in its body over the collection
// reading. Owner 2026-10-09: the LEFT breadcrumb on every tenant of the frame is navigation —
// Home, then 'Team: <title>' — drawn once in the frame from the tenant's name; the island stays the editable tab name; the old
// workbenches untouched.
test('team-next offers Work as one surface over both engines, the left breadcrumb is Home then the tenant, and the island is the tab name', async () => {
  const [catalog, teamView, work, header, frame] = await Promise.all([source('workbench-catalog.js'), source('team-view.js'), source('work-surfaces.js'), source('workspace-header.js'), source('tenant-frame.js')]);
  assert.match(catalog, /WORKBENCH_PROFILES\.teamNext, \[[^\n]*WORKBENCH_TYPES\.teamWork/);
  assert.doesNotMatch(catalog, /WORKBENCH_PROFILES\.teamNext, \[[^\n]*WORKBENCH_TYPES\.workViews/);
  assert.match(teamView, /createWorkSurfaces\(\{ team, holderTeam, openTeam, leadOf, openOwner: openAgent \}\)/);
  assert.doesNotMatch(teamView, /createWorkViewsSurface|createWorkItemsSurface/, 'no surface nests in the Work card (owner, 2026-10-09)');
  assert.match(work, /key: 'view'/);
  assert.match(work, /key: 'board', label: t\('collection\.board', 'Board'\), blank: t\('collection\.all', 'All'\), many: true/, "the Board question is Who's Workspace question");
  assert.match(work, /createLists\(trello/);
  assert.match(work, /createItemsBoard\(\{ lead/);
  assert.match(work, /subscribeCollection\(\{ board: chosen \}/);
  assert.doesNotMatch(work, /request\(|subscribeWorkItems/, 'the Work card reads the collection push only (owner, 2026-10-09)');
  assert.match(header, /const editable = Boolean\(active\?\.view\?\.tabName\) && !\(active\?\.id === 'team' && !active\.param\)/);
  assert.match(frame, /place: \(\) => \[name\(''\), param && name\(\)\]\.filter\(Boolean\)\.join\(': '\)/);
  assert.match(frame, /tabName: \{\n\s+get: \(\) => ctx\?\.viewState\(tenant\.key\)\?\.tabName \|\| name\(\)/);
  assert.match(header, /word\.textContent = placed \? t\('bar\.home', 'Home'\) : brandWord/);
  assert.match(header, /coworkers\.hidden = landing \|\| Boolean\(placed\)/);
  assert.match(header, /crumb\.textContent = placed; crumb\.hidden = !placed/);
  assert.doesNotMatch(header, /place\.replaceChildren\(home/);
});
