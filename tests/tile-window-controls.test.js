import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the tile corner exposes minimize and retirement through the existing Tile boundaries', async () => {
  const [head, tile] = await Promise.all([read('public/js/tilehead.js'), read('public/js/tile.js')]);
  // Delete or archive is the menu's foot; minus is the head's last control.
  assert.match(head, /run: \(\) => tile\.kill\(\)/);
  assert.match(head, /key: 'minimizeBtn',[^\n]+text: '−'/);
  assert.match(head, /on: \(tile\) => tile\.minimize\(\)/);
  const table = head.slice(0, head.indexOf('export function tileMenu'));
  assert.equal(table.indexOf("key:", table.indexOf("key: 'minimizeBtn'") + 1), -1, 'no control follows the window control');
  assert.doesNotMatch(head, /text: '🗑'/);
  assert.match(tile, /if \(this\.onMinimize\) this\.onMinimize\(this\);\s*else this\.detach\(\)/);
  assert.match(tile, /retireSession\(name, this\.retirementId/);
});

test('the Torii rename prompt keeps the immutable Agent ID visible', async () => {
  const tile = await read('public/js/tile.js');
  assert.match(tile, /head\.rename_prompt', 'Edit Agent title\\n\\nAgent ID: \{id\}', \{ id: session \}/);
  assert.match(tile, /setSessionTitle\(session, wanted\.trim\(\)\)/);
});

test('every tile puts the Agent tools behind one menu instead of folding the head', async () => {
  const [style, head] = await Promise.all([read('public/style.css'), read('public/js/tilehead.js')]);
  // The list of workbench kinds is allowed to grow — 60b7ff7b added 'desk'. What this
  // guards is that the control is scoped to workbench kinds, not the exact membership.
  const scope = ":root:is\\(\\[data-workbench='team'\\], \\[data-workbench='cowork'\\][^)]*\\)";
  const lit = (x) => x;
  // The per-tile chevron is retired: it traded one tap for another and gave the tile head
  // a different depth from the surface heads beside it.
  assert.doesNotMatch(style, /tile-head-collapse|tile\.header-collapsed/);
  assert.doesNotMatch(head, /tile-head-collapse|header-collapsed/);
  // One menu, the same on a desk, a tablet and a phone (js/menu.js).
  assert.match(head, /key: 'menuBtn'/);
  // The reading toggle stays a toggle in the head and never becomes a row in a menu.
  assert.match(head, /key: 'transcriptBtn'/);
  assert.doesNotMatch(head.slice(head.indexOf('export function tileMenu')), /toggleTranscript/);
  // ONE BAND DEPTH ACROSS THE ROW. The Kit's depth is already on .tile-head; the defect
  // was the wide-touch block overriding it to 38px against the surface head's 45px, so
  // what this guards is that nothing here restates or shrinks the band again.
  assert.match(style, /^\.tile-head \{[^}]*min-height: var\(--row-head\)/m);
  const wide = style.slice(style.indexOf('@media (pointer: coarse) and (min-width: 681px)'));
  const found = new RegExp(`${scope} \\.tile-head \\{([^}]*)\\}`).exec(wide);
  assert.ok(found, 'the wide-touch tile head rule is there to inspect');
  const body = found[1];
  assert.match(body, /flex-wrap: nowrap/, 'one row, never two');
  assert.doesNotMatch(body, /min-height|height:|padding/, 'the band depth is the Kit\'s, not restated here');
});

test('managed workspaces empty their seat and both empty views use the subdued Ronin mark', async () => {
  const [cowork, host, tile, css] = await Promise.all([
    read('public/js/cowork-view.js'), read('public/js/terminal-tile-host.js'),
    read('public/js/tile.js'), read('public/style.css'),
  ]);
  assert.match(cowork, /onMinimize: \(\) => emptySeat\(id\)/);
  const emptySeat = cowork.slice(cowork.indexOf('const emptySeat ='), cowork.indexOf('const putTerminal ='));
  assert.ok(emptySeat.indexOf('pool.destroyAll()') < emptySeat.indexOf('remembered[id] = DISMISSED_WORKSPACE'));
  // destroyAll takes the pool's seats with the tiles; an Agent card pressed before the next push
  // then found no seat, showed nothing, and place() threw 'did not render its terminal Workbench
  // header' (owner, 2026-10-19). The roster is read again at once.
  assert.ok(emptySeat.indexOf('pool.destroyAll()') < emptySeat.indexOf('syncPools(restorationMembers())') && emptySeat.indexOf('syncPools(restorationMembers())') < emptySeat.indexOf('remembered[id] = DISMISSED_WORKSPACE'), 'an emptied seat re-reads its members before anything else');
  assert.ok(emptySeat.indexOf('remembered[id] = DISMISSED_WORKSPACE') < emptySeat.indexOf('bench.restoreDefault(id)'));
  // Tolerant of layout: what matters is that the host hands its onMinimize to the Tile,
  // not whether the options sit on one line (fb952d2e wrapped them to add transcriptCache).
  assert.match(host, /new Tile\([\s\S]{0,240}onMinimize: options\.onMinimize/);
  assert.match(tile, /this\.emptyMark\.append\(ninMark\(\)\)/);
  assert.match(cowork, /mark\.append\(WorkspaceKit\.primitives\.ninMark\(\)\)/);
  assert.match(css, /\.tile-empty-mark svg[\s\S]*opacity: 0\.16;[\s\S]*filter: grayscale\(1\)/);
});

test('collapsing the application header moves the caret alone, never the island', async () => {
  const [layout, style] = await Promise.all([read('public/js/layout.js'), read('public/style.css')]);
  // The defect: collapsing re-parented the whole island into the live selector header,
  // where a class had to unwind every island property to survive a flex band, and the
  // header lost its own title and actions to make room. The island stays in the bar.
  assert.doesNotMatch(layout, /island-docked|selectorHead|data-workbench-header="selector"/);
  assert.doesNotMatch(style, /island-docked/);
  assert.match(layout, /document\.body\.append\(collapse\)/);
  assert.match(layout, /collapse\.classList\.add\('header-collapse-docked'\)/);
  assert.match(style, /\.app-header-collapse\.header-collapse-docked \{[^}]*position: fixed/);
  // Keyed on the control, not on its parent, so the caret keeps its shape once it is
  // docked and no longer the island's child.
  assert.match(style, /:root:is\(\[data-workbench='team'\], \[data-workbench='cowork'\][^)]*\) \.app-header-collapse \{/);
  assert.doesNotMatch(style, /\.view-island > \.app-header-collapse \{[^}]*display: inline-flex/);
});

test('the wide-touch bar keeps its readings at the right-hand end', async () => {
  const [style, html] = await Promise.all([read('public/style.css'), read('public/index.html')]);
  // The island goes position: absolute on wide touch, so its .grow stops pushing the
  // readings right and trimBarForTouch removes the only other right-hand push.
  assert.match(style, /#bar > \.wk-view-map \{ margin-left: auto; \}/);
  // The auto margin only carries the group if the map is still first of the trailing run.
  const bar = html.slice(html.indexOf('<header id="bar">'), html.indexOf('</header>'));
  for (const after of ['id="ramrpm"', 'id="viewactions"', 'id="feedbackaction"']) {
    assert.ok(bar.indexOf('id="viewmap"') < bar.indexOf(after), `the map precedes ${after}`);
  }
});

test('a UI diagnostic asks the host contract where Ronin answers instead of guessing', async () => {
  const { readdir } = await import('node:fs/promises');
  const names = (await readdir(new URL('../scripts', import.meta.url))).filter((n) => n.endsWith('-ui.mjs'));
  const checked = [];
  for (const name of names) {
    const src = await read(`scripts/${name}`);
    // Only the scripts that drive an ALREADY-RUNNING Ronin. The others stand up their own
    // loopback fixture on an ephemeral port, which resolves nothing and guesses nothing.
    if (!/from '\.\/lib\/ui-host\.mjs'/.test(src) || !/defaultUrl/.test(src)) continue;
    checked.push(name);
    // A routable address in the source is one machine's answer published to every other.
    assert.doesNotMatch(src, /\b(?!127\.0\.0\.1)\d{1,3}(?:\.\d{1,3}){3}\b/, `${name} names a machine address`);
    assert.doesNotMatch(src, /https?:\/\/[^\s'"`$]+/, `${name} hardcodes a target URL`);
    assert.doesNotMatch(src, /\|\|\s*['"`]https?:/, `${name} falls back to a literal URL`);
    // defaultUrl(), defaultUrl(true) and defaultUrl(<staging flag>) are all the contract.
    assert.match(src, /defaultUrl\(/, `${name} must resolve its target through defaultUrl()`);
  }
  assert.ok(checked.includes('ipad-header-ui.mjs'), 'the iPad header diagnostic is covered');
});

test('one rule for every touch screen, and the level always indexes the cycle', async () => {
  const tile = await read('public/js/tile.js');
  const cycle = tile.slice(tile.indexOf('transcriptCycle() {'), tile.indexOf('toggleTranscript()'));
  // A thumb gets Terminal or the conversation, phone and tablet alike (owner, 2026-09-26).
  // The tablet briefly had Work as a third state; there is no surface-specific case left.
  assert.match(cycle, /if \(isCoarse\(\)\) return readings\.slice\(0, 1\);/);
  assert.doesNotMatch(cycle, /getElementById\('phone'\)/, 'the phone needs no case of its own');
  assert.match(cycle, /return readings;/, 'a desk still walks every reading the route published');
  // What source text uniquely guards: the level indexes the CYCLE, never the route's full
  // list. Mixing the two drifts the button's label away from the reading on screen.
  for (const site of ['const readings = this.transcriptCycle();', 'const cycle = this.transcriptCycle();', 'this.transcriptCycle()[this.transcriptLevel]']) {
    assert.ok(tile.includes(site), `the cycle is the index everywhere: ${site}`);
  }
  assert.doesNotMatch(tile, /this\.transcriptReadings\[this\.transcriptLevel\]/, 'the level never indexes the unfiltered list');
});


test('the メ menu holds Output for a Services-bound Agent and withdraws it for one without', async () => {
  const [tile, head] = await Promise.all([read('public/js/tile.js'), read('public/js/tilehead.js')]);
  // Services being ON for the desk is not the same question as Services being on for THIS
  // Agent: the roster row carries rireki per session, and an Agent born before Rireki was
  // activated answers false while every newer one answers true. Both must read correctly.
  const off = tile.slice(tile.indexOf('servicesOff() {'), tile.indexOf('syncOutput() {'));
  assert.match(off, /S\.streamOff/, 'the Campaign switch still wins');
  assert.match(off, /row\?\.rireki === false/, 'otherwise it is this Agent\'s own answer');
  assert.match(head, /tile\.servicesOff\(\) \|\| outputs\.length < 2 \? null/, 'no Output group when there is nothing to choose');
});
