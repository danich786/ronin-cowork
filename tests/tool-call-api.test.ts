import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countBrowserTool } from '../src/tool-call-api.js';
import { setCountSink } from '../src/counts.js';

test('tool counters use explicit browser sources and ignore agent requests and polling', () => {
 const seen: unknown[]=[];setCountSink((event,fields)=>seen.push({event,...fields}));
 const call=(method:string,path:string,source?:string)=>countBrowserTool({method,path,get:()=>source} as any,{} as any,()=>{});
 call('GET','/api/sessions','user_desktop');
 call('POST','/api/launch');
 call('POST','/api/launch','user_mobile');
 call('DELETE','/api/sessions/private-name','user_desktop');
 assert.deepEqual(seen,[{event:'tool.call',tool:'session_create',source:'user_mobile'},
 {event:'tool.call',tool:'DELETE /api/sessions/:name',source:'user_desktop'}]);
 setCountSink(()=>{});
});
