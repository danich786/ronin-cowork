// Focused browser diagnostic: local assets and mocked APIs, no live Campaign writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from './lib/ui-host.mjs';
const root = process.cwd();
const server = http.createServer((req, res) => {
  if (req.url === '/fixture') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/css/ask.css"><body><main style="height:700px;overflow:auto"></main>');
    return;
  }
  const file = path.join(root, 'public', req.url.split('?')[0]);
  try {
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml');
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const browser = await (await loadPlaywright()).chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 850 } });
let desired = {};
let fail = false;
let master = true;
let parked = [];
let factsFail = false;
const calls = [];
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url()).pathname;
  calls.push(url);
  let data = {};
  if (url === '/api/campaigns') data = [{ id: 'test', config: { services: { parts: desired } } }];
  if (url === '/api/campaigns/test') {
    if (fail) return route.fulfill({ status: 500, json: { error: 'Save failed' } });
    desired = route.request().postDataJSON().config.services.parts;
    data = { id: 'test', config: { services: { parts: desired } } };
  }
  if (url === '/api/installed') {
    if (factsFail) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    data = {
      cowork: { startedAt: 'first' },
      services: {
        installed: true, switched_on: master, parts: ['fixture'], loaded: [],
        restart_needed: Object.values(desired).some(Boolean),
        capabilities: { desired, running: [], disagrees: Object.keys(desired).filter((key) => desired[key]), parked },
      },
    };
  }
  if (url === '/api/setup/registration') data = { services_entitled: true };
  return route.fulfill({ json: data });
});
await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
await page.evaluate(async () => {
  const { createServicesSurface } = await import('/js/setup-surfaces.js');
  window.surface = createServicesSurface({ tenant: { campaign: 'test' } });
  document.querySelector('main').append(surface.el);
  await surface.show();
});

try {
  const switches = page.getByRole('switch');
  assert.equal(await switches.count(),6);
  for (const width of [900, 600, 390, 320]) {
    await page.setViewportSize({width,height:1000});
    await page.screenshot({path:`/tmp/services-surface-${width}.png`,fullPage:true});
    const overflow = await page.locator('.setup-services-benefit').evaluateAll(rows=>rows.some(row=>row.scrollWidth>row.clientWidth || [...row.querySelectorAll('h3,p')].some(n=>n.scrollWidth>n.clientWidth)));
    assert.equal(overflow,false,`rows fit at ${width}px`);
  }
  await page.setViewportSize({width:900,height:850});
  await page.evaluate(()=>{
    window.originalRows=[...document.querySelectorAll('.setup-services-benefit')];
    window.originalSwitches=[...document.querySelectorAll('[role="switch"]')];
    window.timerCalls=[];
    const timeout=window.setTimeout;
    window.setTimeout=(fn,ms,...args)=>{window.timerCalls.push(ms);return timeout(fn,ms,...args);};
    document.querySelector('main').scrollTop=80;
    window.originalScroll=document.querySelector('main').scrollTop;
    window.originalTop=originalRows[0].getBoundingClientRect().top;
  });
  const before = calls.length;
  await switches.first().focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('.setup-services-notice').textContent==='saved' && document.querySelector('[data-step="restart"]'));
  assert.deepEqual(calls.slice(before),['/api/campaigns/test','/api/campaigns','/api/installed']);
  assert.equal(desired.terminal_transcript,false);
  assert.equal(desired.voice_hotwords,false);
  assert.equal(await switches.first().getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement===originalSwitches[0]),true);
  assert.equal(await page.evaluate(()=>originalRows.every((n,i)=>n===document.querySelectorAll('.setup-services-benefit')[i]) && originalSwitches.every((n,i)=>n===document.querySelectorAll('[role="switch"]')[i])),true);
  assert.equal(await page.evaluate(()=>document.querySelector('main').scrollTop===originalScroll && originalRows[0].getBoundingClientRect().top===originalTop),true);
  assert.equal(await page.evaluate(()=>timerCalls.some(ms=>ms===5000||ms===15000)),false);
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('[data-step="restart"]').parentElement.hidden);
  assert.equal(await switches.first().getAttribute('aria-checked'),'false');
  fail = true;
  await switches.nth(3).click();
  await page.waitForFunction(()=>document.querySelector('.setup-services-notice').classList.contains('bad'));
  assert.equal(await switches.nth(3).getAttribute('aria-checked'),'false');
  fail = false;
  factsFail = true;
  await switches.nth(3).click();
  await page.waitForFunction(()=>document.querySelector('.setup-services-notice').textContent.includes('unconfirmed'));
  assert.equal(await switches.nth(3).getAttribute('aria-checked'),'true');
  factsFail = false;
  master = false;
  await page.evaluate(()=>surface.show());
  assert.equal(await switches.count(),6);
  assert.equal(await switches.evaluateAll(nodes=>nodes.every(n=>n.disabled)),true);
  assert.equal(await switches.nth(3).getAttribute('aria-checked'),'true');
  master = true;
  parked = [{name:'terminal_transcript',reason:'Recorder refactor'}];
  await page.evaluate(()=>surface.show());
  assert.equal(await switches.nth(1).isDisabled(),true);
  assert.equal(await switches.nth(1).getAttribute('title'),'Recorder refactor');
  console.log('PASS: six rows at 900/600/390/320px; stable DOM, focus, scroll, save rollback, master/parked gating, restart truth, no selection polling.');
} finally {
  await browser.close();
  server.close();
}
