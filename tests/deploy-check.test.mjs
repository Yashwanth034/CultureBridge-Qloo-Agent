import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDeployment,verifyHostedFlow} from '../scripts/verify-deployment.mjs';

function fakeSite({configured=true,broken=null}={}){
  const entries={
    '/':['text/html','<html><title>CultureBridge</title><form id="bridge-form"></form></html>'],
    '/styles.css':['text/css','.test{}'],
    '/app.js':['text/javascript','document.querySelector("form")'],
    '/scene.js':['text/javascript','const scene = 1'],
    '/api/health':['application/json',JSON.stringify({status:'ok',qlooConfigured:configured})],
    '/api/readiness':['application/json',JSON.stringify({status:configured?'ready':'configuration_required',qlooConfigured:configured})]
  };
  return async url=>{
    const p=new URL(url).pathname;
    const [contentType,body]=entries[p]||['text/plain','not found'];
    return new Response(body,{status:p===broken?500:(p==='/api/readiness'&&!configured?503:entries[p]?200:404),
      headers:{'Content-Type':contentType,...(p==='/'?{'Content-Security-Policy':"default-src 'none'; script-src 'self'"}:{})}});
  };
}
test('deployment preflight checks every public asset and readiness',async()=>{
  const result=await verifyDeployment('https://culturebridge.example/',{fetchImpl:fakeSite()});
  assert.equal(result.host,'culturebridge.example');
  assert.equal(result.checksPassed.length,6);
});
test('optional public live Qloo check verifies reviewed IDs and all three categories',async()=>{
  const requestLog=[];
  const mock=async (url,opts={})=>{
    const path=new URL(url).pathname;
    if(opts.method!=='POST')return fakeSite()(url);
    const data=JSON.parse(opts.body);
    requestLog.push({path,category:data.category,origin:opts.headers.Origin,selections:data.selections});
    if(path==='/api/resolve'){
      const result={source:'qloo-live'};
      for(const group of ['groupA','groupB']){
        result[group]=[{input:data[group],matches:[{id:'123e4567-e89b-42d3-a456-426614174000',name:'Qloo match',type:data.category}],suggestedId:'123e4567-e89b-42d3-a456-426614174000'}];
      }
      return Response.json(result);
    }
    if(path==='/api/plan'){
      assert.equal(data.selections.groupA[0],'123e4567-e89b-42d3-a456-426614174000');
      assert.equal(data.selections.groupB[0],'123e4567-e89b-42d3-a456-426614174000');
      return Response.json({mode:'qloo-live',category:data.category,state:'exploration-only',overlapCount:0,candidates:[],exploratory:[],groupA:{count:2},groupB:{count:3}});
    }
    throw new Error('Unexpected route');
  };
  const report=await verifyDeployment('https://culturebridge.example/',{fetchImpl:mock,live:true});
  assert.equal(report.liveQlooChecks.length,3);
  assert.deepEqual(report.liveQlooChecks.map(x=>x.category),['movie','artist','book']);
  assert.ok(report.liveQlooChecks.every(x=>x.sharedCandidates===0));
  assert.equal(requestLog.length,6);
  assert.ok(requestLog.every(x=>x.origin==='https://culturebridge.example'));
  assert.deepEqual(requestLog.map(x=>x.path),['/api/resolve','/api/plan','/api/resolve','/api/plan','/api/resolve','/api/plan']);
});
test('live preflight rejects unresolved entities, invalid Insights and upstream outages',async()=>{
  const noMatches=async (url,opts)=>Response.json({source:'qloo-live',groupA:[{matches:[]}],groupB:[{matches:[]}]});
  await assert.rejects(verifyHostedFlow(new URL('https://app.example/'),{fetchImpl:noMatches}),/no usable groupA/);
  const wrongInsights=async (url,opts)=>{
    if(new URL(url).pathname==='/api/resolve'){
      const row={matches:[{id:'abc'}],suggestedId:'abc'};
      return Response.json({source:'qloo-live',groupA:[row],groupB:[row]});
    }
    return Response.json({mode:'qloo-live',category:'movie',groupA:{count:0},groupB:{count:0},candidates:[],exploratory:[],state:'exploration-only'});
  };
  await assert.rejects(verifyHostedFlow(new URL('https://app.example/'),{fetchImpl:wrongInsights}),/valid independent live Qloo Insights/);
  const outage=async()=>Response.json({error:'Qloo unavailable'},{status:503});
  await assert.rejects(verifyHostedFlow(new URL('https://app.example/'),{fetchImpl:outage}),/HTTP 503/);
});
test('deployment preflight prevents HTTP public links, missing keys and broken assets',async()=>{
  await assert.rejects(verifyDeployment('http://public.example/',{fetchImpl:fakeSite()}),/HTTPS/);
  await assert.rejects(verifyDeployment('https://username:password@public.example/',{fetchImpl:fakeSite()}),/without credentials/);
  await assert.rejects(verifyDeployment('https://public.example/',{fetchImpl:fakeSite({configured:false})}),/HTTP 503/);
  await assert.rejects(verifyDeployment('https://public.example/',{fetchImpl:fakeSite({broken:'/scene.js'})}),/scene.js returned HTTP 500/);
});
