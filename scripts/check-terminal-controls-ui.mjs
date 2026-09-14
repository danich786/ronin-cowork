#!/usr/bin/env node
// Explicit browser diagnostic. Static fixture + mocked HTTP only; never touches tmux.
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { loadPlaywright } from './lib/ui-host.mjs';
const pw = await loadPlaywright();
if (!pw) throw new Error('Playwright unavailable; see docs/host-tools.md');
const app = express(); app.use(express.json());
app.get('/vendor/xterm.js', (_req,res)=>res.sendFile(new URL('../node_modules/@xterm/xterm/lib/xterm.js',import.meta.url).pathname));
app.get('/vendor/addon-fit.js', (_req,res)=>res.sendFile(new URL('../node_modules/@xterm/addon-fit/lib/addon-fit.js',import.meta.url).pathname));
app.get('/vendor/xterm.css', (_req,res)=>res.sendFile(new URL('../node_modules/@xterm/xterm/css/xterm.css',import.meta.url).pathname));
let bindings;
const defaults = { copy: 'Ctrl+Shift+C', clear: 'Ctrl+Shift+Backspace', close: 'Ctrl+C', stop: 'Escape' };
let calls = [];
app.get('/api/terminal-controls', (_req, res) => res.json({ bindings, defaults }));
app.put('/api/terminal-controls', (req, res) => { bindings = req.body.bindings; res.json({ bindings, defaults }); });
app.post('/api/sessions/:name/control-action', (req, res) => { calls.push(req.body); res.json({ message: `${req.body.intent} sent` }); });
app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html><head>
<link rel="stylesheet" href="/vendor/xterm.css"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/workspace-kit.css">
<style>body{display:block;padding:12px}#target{height:380px;display:flex;flex-direction:column}.body{flex:1;min-height:0}.selector{height:350px;width:320px}.tile{height:380px}</style>
</head><body><div id="target" class="tile keys-on"><div class="body tile-body"></div></div><div class="selector wk-workbench-selector"><div class="wk-workbench-selector-cards"></div></div>
<script src="/vendor/xterm.js"></script><script src="/vendor/addon-fit.js"></script>
<script type="module">
import { TermView } from '/js/termview.js';
import { buildComposer } from '/js/composer.js';
import { installTileControls, runTerminalAction, buildControlHints, loadTerminalControls } from '/js/terminal-controls.js';
import { retireSession } from '/js/session-retire.js';
import { S, tiles } from '/js/state.js';
window.raw = [];
const el = document.querySelector('#target');
const tile = { el, body: el.querySelector('.body'), session: 'fixture', sessionKey: 'birth', retirementId: 'fixture', pending: '', renderPending(){}, kill(){retireSession(this.session,this.retirementId,()=>{})}, controlAction(a,t){return runTerminalAction(this,a,t)} };
tile.term = new TermView(tile.body,{onUserData:d=>raw.push(d),onProtocolData(){},onResize(){},onSelection:s=>tile.lastSelection=s});
installTileControls(tile);
tile.composer = buildComposer(tile.body,{activate(){},clearOverlays(){},connected:()=>true,send:d=>raw.push(d),sendMessage:async()=>({ok:true}),scrollToBottom(){}});
Object.defineProperty(tile,'composerTa',{get:()=>tile.composer.ta});
tile.composer.show(true);
S.sessions=[{name:'fixture',key:'birth',agent:'codex'}];S.active=tile;tiles.push(tile);
const cards=document.querySelector('.wk-workbench-selector-cards');
for(let i=0;i<40;i++){const p=document.createElement('p');p.textContent='Agent '+i;cards.append(p)}
document.querySelector('.selector').append(buildControlHints(()=>tile));
await loadTerminalControls();tile.term.write('COPY SNAPSHOT CONTENT');
window.tile=tile;window.ready=true;
</script></body></html>`));
app.use(express.static(new URL('../public', import.meta.url).pathname));
const server = createServer(app); await new Promise(r => server.listen(0, '127.0.0.1', r));
try {
  for (const mobile of [false, true]) {
    bindings = { ...defaults }; calls = [];
    const browser = await pw.chromium.launch({ headless: true });
    try {
      const context = await browser.newContext(mobile ? { ...pw.devices['Pixel 7'] } : { viewport: { width: 1200, height: 900 } });
      const page = await context.newPage(); const errors=[]; page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForFunction(()=>window.ready);
      assert.equal(await page.locator('.terminal-hints').getAttribute('open'), '');
      const before = await page.locator('.terminal-hints').boundingBox();
      await page.locator('.wk-workbench-selector-cards').evaluate(el=>el.scrollTop=el.scrollHeight);
      assert.equal((await page.locator('.terminal-hints').boundingBox()).y,before.y);
      await page.locator('.terminal-hints summary').click();
      assert.equal(await page.locator('.terminal-hints').getAttribute('open'), null);
      await page.waitForFunction(()=>localStorage.getItem('ronin.hints.collapsed')==='yes');
      await page.locator('.wk-workbench-selector-cards').evaluate(el=>el.hidden=true);
      assert.equal(await page.locator('.terminal-hints').getAttribute('open'), null);
      await page.locator('.terminal-hints summary').click();
      assert.equal(await page.locator('.terminal-hints').getAttribute('open'), '');
      assert.equal(await page.locator('.wk-workbench-selector-cards').evaluate(el=>el.hidden), true);
      await page.locator('.wk-workbench-selector-cards').evaluate(el=>el.hidden=false);
      await page.locator('.terminal-hints summary').click();
      await page.waitForFunction(()=>localStorage.getItem('ronin.hints.collapsed')==='yes');
      await page.reload();
      await page.waitForFunction(()=>window.ready);
      assert.equal(await page.locator('.terminal-hints').getAttribute('open'), null);
      await page.locator('.terminal-hints summary').click();
      await page.locator('.composer textarea').fill('unfinished\nsecond line');
      await page.locator('.terminal-actions button').filter({hasText:/^Clear$/}).click();
      assert.equal(await page.locator('.composer textarea').inputValue(),''); assert.equal(calls.length,0);
      await page.locator('.composer textarea').fill('keep me');
      await page.locator('.terminal-actions button').filter({hasText:/^Stop$/}).click();
      await page.waitForFunction(()=>document.body.innerText.includes('stop sent'));
      assert.equal(calls.at(-1).intent,'stop'); assert.equal(await page.locator('.composer textarea').inputValue(),'keep me');
      if (!mobile) {
        await page.evaluate(()=>tile.term.focus()); await page.keyboard.press('Control+c');
        await page.locator('.ui-sheet.open').waitFor();
        await page.evaluate(()=>tile.term.focus()); await page.keyboard.press('Control+c');
        assert.deepEqual(await page.evaluate(()=>raw),[]);
        assert.equal(await page.locator('.ui-sheet.open').count(),1);
        const n=calls.length; await page.evaluate(()=>tile.term.focus()); await page.keyboard.press('Escape');
        assert.equal(await page.locator('.ui-sheet.open').count(),0);assert.equal(calls.length,n);
        await page.evaluate(()=>tile.term.focus());await page.keyboard.press('Escape');
        await page.waitForTimeout(150);assert.equal(calls.length,n+1);
        assert.deepEqual(await page.evaluate(()=>raw),[]);
      }
      await page.locator('.terminal-actions button').filter({hasText:/^Copy$/}).click();
      assert.match(await page.locator('.terminal-copy-text').inputValue(),/COPY SNAPSHOT CONTENT/);
      await page.locator('.ui-sheet.open button').filter({hasText:'Done'}).click();
      await page.getByRole('button',{name:'Customize shortcuts'}).click();
      await page.getByRole('textbox',{name:'Close shortcut',exact:true}).fill('Ctrl+X');
      await page.getByRole('button',{name:'Save',exact:true}).click();
      await page.getByText('Saved for every Agent.',{exact:false}).waitFor();
      assert.equal(await page.locator('[data-control-key="close"]').textContent(),'Ctrl+X');
      await page.getByRole('button',{name:'Done',exact:true}).click();
      assert.deepEqual(errors,[]);
      console.log(`${mobile?'mobile touch':'desktop'}: controls, draft, Copy snapshot, Hints pinning and remapping passed`);
    } finally { await browser.close(); }
  }
} finally { await new Promise(r=>server.close(r)); }
