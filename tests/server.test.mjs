import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAppServer} from '../src/server.mjs';
import {QlooClient} from '../src/qloo.mjs';

const uid=(n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const entity=(n)=>({id:uid(n),name:'Choice '+n,type:'movie'});
async function serve(client) {
  const server=createAppServer({client});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('served frontend, real API error contract and security headers',async()=>{
  const {server,url}=await serve(new QlooClient({apiKey:''}));
  try {
    const page=await fetch(url+'/');
    assert.equal(page.status,200);
    assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
    assert.match(await page.text(),/CultureBridge/);
    const css=await fetch(url+'/styles.css');
    assert.equal(css.status,200);
    assert.match(await css.text(),/rank-item/);
    const webgl=await fetch(url+'/scene.js');
    assert.equal(webgl.status,200);
    assert.match(webgl.headers.get('content-type'),/text\/javascript/);
    assert.match(await webgl.text(),/culturebridge:phase/);
    const favicon=await fetch(url+'/favicon.svg');
    assert.equal(favicon.status,200);
    assert.match(favicon.headers.get('content-type'),/image\/svg\+xml/);
    const health=await (await fetch(url+'/api/health')).json();
    assert.equal(health.qlooConfigured,false);
    const readiness=await fetch(url+'/api/readiness');
    assert.equal(readiness.status,503);
    assert.deepEqual(await readiness.json(),{status:'configuration_required',qlooConfigured:false,liveQlooVerified:false});
    const response=await fetch(url+'/api/plan',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({groupA:'movie: Dune',groupB:'movie: Barbie',category:'movie'})
    });
    assert.equal(response.status,503);
    assert.match((await response.json()).error,/not configured/);
  } finally {await new Promise((resolve)=>server.close(resolve));}
});
test('HTTP /api/resolve returns selectable Qloo entities without starting insights',async()=>{
 const log=[];
 const client={apiKey:'mock',async search(name,type){log.push(['search',name,type]);return [{id:uid(name==='Dune'?1:2),name,type:'movie'}]},async insights(){throw new Error('should not run insights in review phase')}};
 const {server,url}=await serve(client);
 try{
   const res=await fetch(url+'/api/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupA:'movie: Dune',groupB:'movie: Barbie'})});
   assert.equal(res.status,200);
   const response=await res.json();
   assert.equal(response.source,'qloo-live');
   assert.equal(response.groupA[0].matches[0].name,'Dune');
   assert.equal(response.groupB[0].matches[0].name,'Barbie');
   assert.equal(log.length,2);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
test('HTTP /api/plan preserves truthful independent evidence when optional joint Qloo fails',async()=>{
  const {QlooError}=await import('../src/qloo.mjs');
  const client={
    apiKey:'mock-local-key',
    async search(name,type){return [{id:uid(name==='Dune'?1:2),name,type:'movie'}];},
    async insights(type,ids){
      if(ids.length===2)throw new QlooError('temporary provider outage',503);
      return [entity(6),entity(7)];
    }
  };
  const {server,url}=await serve(client);
  try{
    const res=await fetch(url+'/api/plan',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({groupA:'movie: Dune',groupB:'movie: Barbie',category:'movie',strategy:'discovery'})});
    assert.equal(res.status,200);
    const plan=await res.json();
    assert.equal(plan.state,'grounded-overlap');
    assert.equal(plan.candidates.length,2);
    assert.deepEqual(plan.exploratory,[]);
    assert.equal(plan.metadata.jointStatus,'unavailable');
    assert.match(plan.metadata.warnings.join(' '),/joint Qloo exploration/i);
    assert.doesNotMatch(JSON.stringify(plan),/mock-local-key/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('HTTP /api/plan keeps raw Qloo affinity evidence distinct from relative fairness',async()=>{
  const client={
    apiKey:'stub-only',
    async search(name,type){return [{id:uid(name==='Dune'?1:2),name,type:'movie'}]},
    async insights(type,ids){
      const affinity=ids.length===2?0.62:ids[0]===uid(1)?0.8:0.23;
      return [{...entity(99),affinity}];
    }
  };
  const {server,url}=await serve(client);
  try{
    const result=await fetch(url+'/api/plan',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({groupA:'movie: Dune',groupB:'movie: Barbie',category:'movie'})
    });
    assert.equal(result.status,200);
    const plan=await result.json();
    assert.equal(plan.candidates.length,1);
    assert.equal(plan.candidates[0].score,100);
    assert.equal(plan.candidates[0].groupAAffinity,0.8);
    assert.equal(plan.candidates[0].groupBAffinity,0.23);
    assert.equal(plan.candidates[0].jointAffinity,0.62);
    assert.doesNotMatch(JSON.stringify(plan),/stub-only/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('HTTP /api/plan returns grounded Qloo-shaped output without secrets',async()=>{
  const client={
    apiKey:'dummy-event-key',
    async search(name,type){return [{id:uid(name==='Dune'?1:2),name,type:'movie'}];},
    async insights(type,ids){return ids.length===2?[entity(4),entity(5)]:ids[0]===uid(1)?[entity(5),entity(4)]:[entity(4),entity(5)];}
  };
  const {server,url}=await serve(client);
  try {
    const readiness=await fetch(url+'/api/readiness');
    assert.equal(readiness.status,200);
    assert.equal((await readiness.json()).liveQlooVerified,false);
    const res=await fetch(url+'/api/plan',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({groupA:'movie: Dune',groupB:'movie: Barbie',category:'movie'})
    });
    assert.equal(res.status,200);
    const response=await res.json();
    assert.equal(response.state,'grounded-overlap');
    assert.equal(response.candidates.length,2);
    assert.equal(response.mode,'qloo-live');
    assert.deepEqual(response.trace.length,5);
    assert.doesNotMatch(JSON.stringify(response),/dummy-event-key/);
    const cross=await fetch(url+'/api/plan',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json'},body:'{}'});
    assert.equal(cross.status,403);
  } finally {await new Promise((resolve)=>server.close(resolve));}
});
