import test from 'node:test';
import assert from 'node:assert/strict';
import {extractEntities,extractContributions,QlooClient,QLOO_ORIGIN} from '../src/qloo.mjs';
const ID='123e4567-e89b-42d3-a456-426614174000';
const entity={entity_id:ID,name:'Dune',types:['urn:entity:movie'],query:{affinity:0.66}};
test('normalizes documented Qloo entity envelopes',()=>{
  const entities=extractEntities({results:{entities:[entity,{id:'not-an-id',name:'invalid'}]}});
  assert.equal(entities.length,1);
  assert.equal(entities[0].type,'movie');
  assert.equal(entities[0].affinity,0.66);
});
test('normalizes the verified live Insights subtype envelope without category guessing',async()=>{
  const live={entity_id:ID,name:'Arrival',type:'urn:entity',subtype:'urn:entity:movie',query:{affinity:0.77}};
  assert.deepEqual(extractEntities({results:{entities:[live]}}).map(x=>x.type),['movie']);
  const client=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>({
    ok:true,status:200,json:async()=>({success:true,results:{entities:[live]}})
  })});
  const result=await client.insights('movie',[ID]);
  assert.equal(result.length,1);
  assert.equal(result[0].name,'Arrival');
  assert.equal(result[0].affinity,0.77);
  assert.deepEqual(extractEntities({results:{entities:[
    {...live,types:['urn:entity:book']}
  ]}}).map(x=>x.type),[null]);
  assert.deepEqual(extractEntities({results:{entities:[
    {...live,subtype:'urn:entity:tv_show'}
  ]}}).map(x=>x.type),[null]);
});
test('Qloo explainability accepts only validated provider seed IDs and normalized scores',()=>{
  const other='87654321-ffff-4000-8000-123456789012';
  assert.deepEqual(extractContributions({
    'signal.interests.entities':{[ID]:0.42,[other]:1,'spoofed':0.5}
  }),[{id:ID,score:0.42},{id:other,score:1}]);
  assert.deepEqual(extractContributions({
    'signal.interests.entities':[{entity_id:ID,score:0.31},{id:other,contribution:0.62}]
  }),[{id:ID,score:0.31},{id:other,score:0.62}]);
  assert.deepEqual(extractContributions({
    'signal.interests.entities':{[ID]:'0.8',[other]:3}
  }),[]);
  assert.deepEqual(extractContributions({warning:'unavailable'}),[]);
  assert.deepEqual(extractContributions(undefined),[]);
  const [entityWithContributions]=extractEntities({results:{entities:[{
    ...entity,query:{affinity:0.6,explainability:{'signal.interests.entities':{[ID]:0.4}}}
  }]}});
  assert.deepEqual(entityWithContributions.contributions,[{id:ID,score:0.4}]);
});
test('Qloo affinity retains only genuine finite numeric provider values',()=>{
  const make=value=>({entity_id:ID,name:'Dune',type:'urn:entity:movie',query:{affinity:value}});
  const values=[0.42,'0.73',0,'',true,null,'NaN',Infinity,'0x10','1e-2'];
  const rows=extractEntities({results:{entities:values.map(make)}});
  assert.deepEqual(rows.map(x=>x.affinity),[0.42,0.73,0,null,null,null,null,null,null,0.01]);
});
test('Qloo Insights refuses wrong category or untyped results despite HTTP 200',async()=>{
  const incorrect=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>({
    ok:true,status:200,async json(){return {success:true,results:{entities:[
      {...entity,types:['urn:entity:book']},
      {...entity,types:[],type:'urn:entity:artist',entity_id:'123e4567-e89b-42d3-a456-426614174001'}
    ]}};}
  })});
  await assert.rejects(incorrect.insights('movie',[ID]),/outside the requested movie category/);
  const mixed=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>({
    ok:true,status:200,async json(){return {success:true,results:{entities:[
      entity,{...entity,entity_id:'123e4567-e89b-42d3-a456-426614174001',types:['urn:entity:book']}
    ]}};}
  })});
  const picks=await mixed.insights('movie',[ID]);
  assert.equal(picks.length,1);
  assert.equal(picks[0].type,'movie');
});
test('Qloo requests target event origin, pass server-only key, cache and exclude seeds',async()=>{
  const calls=[];
  const fetchImpl=async (url,opts)=>{calls.push({url:String(url),headers:opts.headers});return {ok:true,status:200,async json(){return {success:true,results:{entities:[entity]}}}};};
  const client=new QlooClient({apiKey:'dummy-event-key',fetchImpl,minGapMs:0});
  await client.search('Dune','movie');
  await client.search('Dune','movie');
  const result=await client.insights('movie',[ID]);
  assert.equal(calls.length,2);
  assert.ok(calls[0].url.startsWith(QLOO_ORIGIN+'/search?'));
  assert.equal(calls[0].headers['X-Api-Key'],'dummy-event-key');
  assert.match(calls[1].url,/filter.exclude.entities/);
  assert.equal(result[0].name,'Dune');
});
test('concurrent identical Qloo queries coalesce into one upstream call',async()=>{
  let unblock;
  const held=new Promise(resolve=>{unblock=resolve;});
  let calls=0;
  const client=new QlooClient({apiKey:'stub',minGapMs:0,
    fetchImpl:async()=>{calls++;await held;return {ok:true,status:200,async json(){return {success:true,results:{entities:[entity]}};}};}
  });
  const first=client.search('Dune','movie');
  const second=client.search('Dune','movie');
  const third=client.search('Dune','movie');
  assert.equal(client.inflight.size,1);
  unblock();
  const values=await Promise.all([first,second,third]);
  assert.equal(calls,1);
  assert.equal(client.inflight.size,0);
  assert.deepEqual(values[0],values[2]);
});
test('a failed concurrent request rejects all waiters once and can be retried',async()=>{
  let calls=0;
  const client=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>{
    calls++;
    if(calls<=3)throw new Error('network offline');
    return {ok:true,status:200,async json(){return {success:true,results:{entities:[entity]}};}};
  }});
  const errors=await Promise.allSettled([client.search('Dune','movie'),client.search('Dune','movie')]);
  assert.ok(errors.every(x=>x.status==='rejected'&&/Qloo connection/.test(x.reason.message)));
  assert.equal(calls,3);
  assert.equal(client.inflight.size,0);
  assert.equal((await client.search('Dune','movie')).length,1);
  assert.equal(calls,4);
});
test('transient network reset recovers without retrying bad credentials',async()=>{
  let calls=0;
  const client=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>{
    calls++;
    if(calls===1)throw new Error('ECONNRESET');
    return {ok:true,status:200,async json(){return {success:true,results:{entities:[entity]}};}};
  }});
  assert.equal((await client.search('Dune','movie')).length,1);
  assert.equal(calls,2);
});
test('429 Retry-After is honored and capped while request eventually succeeds',async()=>{
  let calls=0;
  const client=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>{
    calls++;
    if(calls===1)return {ok:false,status:429,headers:{get:()=> '0'}};
    return {ok:true,status:200,async json(){return {success:true,results:{entities:[entity]}};}};
  }});
  assert.equal((await client.search('Dune','movie')).length,1);
  assert.equal(calls,2);
});
test('missing Qloo names use a short negative cache',async()=>{
  let calls=0;
  const client=new QlooClient({apiKey:'stub',minGapMs:0,fetchImpl:async()=>{calls++;return {ok:false,status:404};}});
  assert.deepEqual(await client.search('Unknown Artist','artist'),[]);
  assert.deepEqual(await client.search('Unknown Artist','artist'),[]);
  assert.equal(calls,1);
});
test('zero search results from Qloo are not a fatal API error',async()=>{
  const client=new QlooClient({apiKey:'dummy-key',minGapMs:0,fetchImpl:async()=>({ok:false,status:404})});
  assert.deepEqual(await client.search('unfindable band','artist'),[]);
});
test('Qloo plain entity type is normalized while malformed IDs are excluded',()=>{
  const all=extractEntities({results:{entities:[{entity_id:ID,name:'Dune',type:'urn:entity:movie'},
    {entity_id:ID,name:'Duplicated Dune',type:'movie'},
    {entity_id:'invalid',name:'Fake',type:'movie'}]}});
  assert.equal(all.length,2);
  assert.deepEqual(all.map((x)=>x.type),['movie','movie']);
});
test('no key rejects rather than silently pretending to use Qloo',async()=>{
  const client=new QlooClient({apiKey:'',fetchImpl:async()=>{throw Error('not reached')}});
  await assert.rejects(client.search('Dune'),/not configured/);
});
test('upstream auth failure returns safe diagnostic',async()=>{
  const client=new QlooClient({apiKey:'x',minGapMs:0,fetchImpl:async()=>({ok:false,status:401})});
  await assert.rejects(client.search('Dune'),/rejected the event credential/);
});
