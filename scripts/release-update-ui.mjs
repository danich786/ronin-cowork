// Focused local browser diagnostic. All API responses are mocked.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from './lib/ui-host.mjs';
const server = http.createServer((req,res)=>{
 if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/css/campaign-home.css"><body><div id="fixture" style="height:100vh"></div>');return;}
 const file=path.join(process.cwd(),'public',req.url.split('?')[0]);
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
const browser=await (await loadPlaywright()).chromium.launch({headless:true});
const page=await browser.newPage();
let identity={release:'v2.3.0',commit:'abc',startedAt:'before'};
let facts={installed:'v2.3.0',latest:'v2.3.1',upToDate:false,services:{installed:null,latest:null,upToDate:false}};
const calls=[];
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url()).pathname;calls.push([url,route.request().postDataJSON()]);
 if(url==='/api/update/run') return route.fulfill({status:503,json:{error:'Fixture: update not started'}});
 return route.fulfill({json:url==='/api/version'?identity:url==='/api/update/check'?facts:url==='/api/setup/runtime'?{activated_count:2}:{}});
});
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 await page.evaluate(async()=>{const {createCampaignHome}=await import('/js/campaign-home.js');window.home=createCampaignHome();document.querySelector('#fixture').append(home.el);home.enter({navigate(){}});});
 assert.equal(await page.locator('.ch-release').innerText(), 'Check for updates');
 assert.equal(calls.filter(([u])=>u==='/api/version').length,0);
 for (const width of [320,900]) {
  await page.setViewportSize({width,height:850});
  await page.screenshot({path:`/tmp/project17-quiet-${width}.png`,fullPage:true});
 }
 assert.equal(calls.filter(([u])=>u==='/api/update/check').length,0);
 await page.evaluate(()=>{window.original=document.querySelector('.ch-release');window.check=document.querySelector('.ch-release > button');});
 for(const width of [320,390,600,900]){
  await page.setViewportSize({width,height:850});
  await page.locator('.ch-release > button').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.ch-update-reading').textContent.includes('v2.3.1'));
  assert.equal(await page.evaluate(()=>document.activeElement===window.check&&document.querySelector('.ch-release')===window.original),true);
  assert.match(await page.locator('.ch-update-reading').nth(1).textContent(),/No release information/);
  assert.equal(await page.evaluate(()=>document.querySelector('.ch-release').scrollWidth<=document.querySelector('.ch-release').clientWidth),true);
  await page.screenshot({path:`/tmp/project17-home-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Update Cowork',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ch-update-answer').textContent.includes('Fixture'));
 assert.equal(calls.filter(([u])=>u==='/api/update/run').at(-1)[1].package,'cowork');
 facts.services={installed:'s1',latest:'s2',upToDate:false};
 await page.locator('.ch-release > button').click();
 await page.getByRole('button',{name:'Update Services',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.ch-update-answer').textContent.includes('Fixture'));
 assert.equal(calls.filter(([u])=>u==='/api/update/run').at(-1)[1].package,'services');
 identity={release:null,commit:'deadbeef'};
 await page.locator('.ch-release > button').click();
 await page.waitForFunction(()=>document.querySelector('.ch-release').textContent.includes('cannot be updated here'));
 assert.equal(await page.getByRole('button',{name:'Update Cowork',exact:true}).isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Update Services',exact:true}).isVisible(),false);
 assert.doesNotMatch(await page.locator('.ch-release').innerText(),/checkout|deadbeef|Not checked/i);
 // The existing account surface uses the same controller and keeps check focus.
 await page.evaluate(async()=>{home.leave();document.querySelector('#fixture').replaceChildren();const {buildSystemPanel}=await import('/js/system.js');window.system=buildSystemPanel();document.querySelector('#fixture').append(system.release);system.enter();});
 await page.getByRole('button',{name:'Check for updates',exact:true}).click();
 await page.waitForFunction(()=>document.body.textContent.includes('Ronin Services — s2 available'));
 assert.equal(await page.getByRole('button',{name:'Update Services',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:'Check for updates',exact:true}).evaluate(e=>e===document.activeElement),true);
 console.log('CLEAN: home 320/390/600/900; separate facts, package POSTs, checkout gating, retained check DOM/focus; shared Account controller.');
}finally{await browser.close();server.close();}
