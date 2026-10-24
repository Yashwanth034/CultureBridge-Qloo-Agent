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
    assert.match(await css.text(),/candidate/);
    const favicon=await fetch(url+'/favicon.svg');
    assert.equal(favicon.status,200);
    assert.match(favicon.headers.get('content-type'),/image\/svg\+xml/);
    const health=await (await fetch(url+'/api/health')).json();
    assert.equal(health.qlooConfigured,false);
    const response=await fetch(url+'/api/plan',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({groupA:'movie: Dune',groupB:'movie: Barbie',category:'movie'})
    });
    assert.equal(response.status,503);
    assert.match((await response.json()).error,/not configured/);
  } finally {await new Promise((resolve)=>server.close(resolve));}
});
test('HTTP /api/plan returns grounded Qloo-shaped output without secrets',async()=>{
  const client={
    apiKey:'dummy-event-key',
    async search(name,type){return [{id:uid(name==='Dune'?1:2),name,type:'movie'}];},
    async insights(type,ids){return ids.length===2?[entity(4),entity(5)]:ids[0]===uid(1)?[entity(5),entity(4)]:[entity(4),entity(5)];}
  };
  const {server,url}=await serve(client);
  try {
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
