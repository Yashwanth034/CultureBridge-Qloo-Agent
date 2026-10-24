import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAppServer,bodyJson,clientRateKey} from '../src/server.mjs';
import {QlooClient} from '../src/qloo.mjs';

const uid=(n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const entity=(n)=>({id:uid(n),name:'Choice '+n,type:'movie'});
async function serve(client) {
  const server=createAppServer({client});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
test('Render trusted proxy rate keys ignore spoofed leftmost XFF but never trust headers locally',()=>{
  const req={socket:{remoteAddress:'10.0.0.5'},headers:{
    'x-forwarded-for':'1.2.3.4, 203.0.113.45, 198.51.100.30, 192.0.2.20'
  }};
  assert.equal(clientRateKey(req,0),'10.0.0.5');
  assert.equal(clientRateKey(req,3),'203.0.113.45');
  assert.equal(clientRateKey(req,1),'192.0.2.20');
  assert.equal(clientRateKey({...req,headers:{...req.headers,'cf-connecting-ip':'203.0.113.88'}},3),'203.0.113.88');
  assert.equal(clientRateKey({...req,headers:{'x-forwarded-for':'1.2.3.4','cf-connecting-ip':'FAKE'}},3),'10.0.0.5');
  assert.equal(clientRateKey({...req,headers:{'x-forwarded-for':'1.2.3.4, garbage, 192.0.2.20, 203.0.113.9'}},3),'10.0.0.5');
  assert.equal(clientRateKey({...req,headers:{'cf-connecting-ip':'203.0.113.88'}},0),'10.0.0.5');
});
test('trusted proxy limiter separates real visitors and ignores spoofed leftmost addresses',async()=>{
  const trusted=createAppServer({client:new QlooClient({apiKey:''}),trustedProxyHops:3});
  await new Promise(resolve=>trusted.listen(0,'127.0.0.1',resolve));
  const endpoint='http://127.0.0.1:'+trusted.address().port+'/api/resolve';
  const send=clientIp=>fetch(endpoint,{
    method:'POST',
    headers:{'Content-Type':'application/json',
      'x-forwarded-for':'192.0.2.200, '+clientIp+', 198.51.100.50, 198.51.100.60'},
    body:'{}'
  });
  try{
    for(let i=0;i<60;i++){
      const response=await send('203.0.113.81');
      assert.equal(response.status,400);
    }
    assert.equal((await send('203.0.113.81')).status,429);
    assert.equal((await send('203.0.113.82')).status,400);
  }finally{await new Promise(resolve=>trusted.close(resolve));}
});
test('JSON parser preserves international names across split UTF-8 byte boundaries',async()=>{
  const body={groupA:'movie: Amélie, book: 百年孤独',groupB:'movie: 千と千尋の神隠し, artist: Sigur Rós'};
  const bytes=Buffer.from(JSON.stringify(body),'utf8');
  const req={async *[Symbol.asyncIterator](){for(const byte of bytes)yield Buffer.from([byte]);}};
  assert.deepEqual(await bodyJson(req),body);
});
test('JSON parser enforces byte limit, including multi-byte characters',async()=>{
  const long=Buffer.from(JSON.stringify({groupA:'🍿'.repeat(1300)}),'utf8');
  const req={async *[Symbol.asyncIterator](){yield long.subarray(0,5000);yield long.subarray(5000);}};
  await assert.rejects(bodyJson(req),error=>error.status===413&&/too large/i.test(error.message));
  const bad={async *[Symbol.asyncIterator](){yield Buffer.from('{"bad":');}};
  await assert.rejects(bodyJson(bad),error=>error.status===400&&/valid JSON/i.test(error.message));
});
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
test('HTTP entity preview submits comma-containing cultural titles intact',async()=>{
  const names=[];
  const client={apiKey:'stub',async search(name,type){
    names.push([name,type]);
    return [{id:uid(names.length),name,type:type||'movie'}];
  }};
  const {server,url}=await serve(client);
  try{
    const res=await fetch(url+'/api/resolve',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({groupA:'movie: "I, Tonya", book: "Eat, Pray, Love"',groupB:'movie: Barbie'})
    });
    assert.equal(res.status,200);
    const preview=await res.json();
    assert.deepEqual(names,[['I, Tonya','movie'],['Eat, Pray, Love','book'],['Barbie','movie']]);
    assert.equal(preview.groupA.length,2);
    assert.equal(preview.groupA[0].input,'I, Tonya');
    assert.equal(preview.groupA[1].input,'Eat, Pray, Love');
  }finally{await new Promise(resolve=>server.close(resolve));}
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
test('HTTP reviewed exclusions prevent later auto-selection of rejected tastes',async()=>{
  const names=[];
  const client={
    apiKey:'stub-private',
    async search(name,type){
      names.push(name);
      return [{id:uid(name==='Dune'?1:name==='Barbie'?2:3),name,type:'movie'}];
    },
    async insights(){return [entity(40)]}
  };
  const {server,url}=await serve(client);
  try{
    const r=await fetch(url+'/api/plan',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        groupA:'movie: Dune, movie: Bad Match',groupB:'movie: Barbie',category:'movie',
        selections:{groupA:[uid(1),null],groupB:[uid(2)]}
      })
    });
    assert.equal(r.status,200);
    const plan=await r.json();
    assert.deepEqual(names,['Dune','Barbie']);
    assert.deepEqual(plan.groupA.excluded,['Bad Match']);
    assert.deepEqual(plan.groupA.seeds.map(x=>x.name),['Dune']);
    assert.equal(plan.overlapCount,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
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
