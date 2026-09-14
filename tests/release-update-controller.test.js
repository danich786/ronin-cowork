import test from 'node:test';
import assert from 'node:assert/strict';
import { createReleaseUpdateController, packageReading, releaseIdentity } from '../public/js/release-update-controller.js';

test('identity and package facts stay honest and independent', () => {
  assert.equal(releaseIdentity({release:'v2.3.1'}), 'v2.3.1');
  assert.equal(releaseIdentity({commit:'abc'}), 'Dev checkout · abc');
  assert.equal(releaseIdentity(null), 'Version unavailable');
  assert.equal(packageReading({latest:null,upToDate:true}).state,'unknown');
  assert.equal(packageReading({latest:'v2',upToDate:true}).state,'current');
  assert.equal(packageReading({latest:'v2',upToDate:false}).available,true);
});

for (const pkg of ['cowork','services']) test(`${pkg} explicit update uses package and established completion watch`, async () => {
  const calls=[]; let ran=false; let reloaded=false; let state;
  const controller=createReleaseUpdateController({onChange:s=>state=s, sleep:async()=>{},reload:()=>{reloaded=true;},send:async(url,opts)=>{
    calls.push([url,opts]);
    if(url==='/api/update/run') {ran=true; return {ok:true};}
    if(url==='/api/update/check') return {ok:true,data:{latest:'v2',services:{latest:'s2'}}};
    return {ok:true,data:{release:ran?'v2':'v1',startedAt:ran?'later':'before',services:['task_manager']}};
  }});
  await controller.identify();
  assert.equal(calls.length,1);
  await controller.run(pkg);
  assert.equal(calls.length,1);
  await controller.check();
  assert.equal(state.facts.services.latest,'s2');
  await controller.run(pkg);
  assert.equal(calls.find(([u])=>u==='/api/update/run')[1].json.package,pkg);
  assert.equal(reloaded,true);
});

for(const identity of [null,{commit:'abc',release:null}]) test(`non-release identity cannot update: ${JSON.stringify(identity)}`,async()=>{
 const calls=[];let state;
 const c=createReleaseUpdateController({onChange:s=>state=s,send:async(url)=>{calls.push(url);return url==='/api/version'?{ok:!!identity,data:identity}:{ok:true,data:{latest:'v2',services:{latest:'s2'}}};}});
 await c.check(); await c.run('cowork'); await c.run('services');
 assert.equal(state.canUpdate,false); assert.equal(calls.includes('/api/update/run'),false);
});

test('failed recheck clears stale update offers; checks never start a watch',async()=>{
 let fails=false;let state;let calls=[];
 const c=createReleaseUpdateController({onChange:s=>state=s,send:async(url)=>{calls.push(url);return url==='/api/version'?{ok:true,data:{release:'v1'}}:fails?{ok:false}:{ok:true,data:{latest:'v2',services:{latest:null}}};}});
 await c.check();assert.equal(packageReading(state.facts.services).state,'unknown');
 fails=true;await c.check();await c.run('cowork');assert.equal(state.facts,null);
 assert.deepEqual(calls,['/api/version','/api/update/check','/api/version','/api/update/check']);
});
