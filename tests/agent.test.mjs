import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSeeds,reconcile,buildBridge} from '../src/agent.mjs';
const id=(n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const item=(n)=>({id:id(n),name:'Entity '+n,type:'movie'});
test('typed and untyped signals are handled',()=>{
  assert.deepEqual(parseSeeds('movie: Arrival, artist: BTS'),[{name:'Arrival',type:'movie'},{name:'BTS',type:'artist'}]);
  assert.equal(parseSeeds('Dune')[0].type,null);
  assert.throws(()=>parseSeeds(''),/1–3 tastes/);
  assert.throws(()=>parseSeeds('a, b, c, d'),/1–3 tastes/);
});
test('ranking prioritizes verified overlap rather than one-sided favorites',()=>{
  const a=[item(1),item(2),item(3)],b=[item(2),item(4),item(1)],joint=[item(3),item(2),item(5)];
  const result=reconcile(a,b,joint);
  assert.equal(result.overlapCount,2);
  assert.deepEqual(result.agreement.map((x)=>x.id),[id(2),id(1)]);
  assert.ok(result.agreement.every((x)=>x.commonGround&&x.score>0));
  assert.ok(result.exploratory.every((x)=>!x.commonGround));
  assert.equal(result.exploratory[0].name,'Entity 3');
});
test('candidate includes raw Qloo affinities without overwriting the rank fairness heuristic',()=>{
  const a=[{...item(1),affinity:0.82},{...item(2),affinity:0.3}];
  const b=[{...item(1),affinity:0.17},{...item(2),affinity:0.4}];
  const joint=[{...item(1),affinity:0.64}];
  const rows=reconcile(a,b,joint);
  const first=rows.agreement.find(x=>x.id===id(1));
  assert.equal(first.groupAAffinity,0.82);
  assert.equal(first.groupBAffinity,0.17);
  assert.equal(first.jointAffinity,0.64);
  assert.equal(first.score,100);
  const second=rows.agreement.find(x=>x.id===id(2));
  assert.equal(second.jointAffinity,null);
  assert.equal(reconcile([item(1)],[item(1)],[]).agreement[0].groupAAffinity,null);
});
test('discovery mode gives more weight to joint Qloo rank while preserving mutual evidence',()=>{
  const sides=[item(1),item(2),item(3)];
  const joint=[item(2),item(1)];
  const fair=reconcile(sides,sides,joint,6,'balanced');
  const discovery=reconcile(sides,sides,joint,6,'discovery');
  assert.equal(fair.agreement[0].name,'Entity 1');
  assert.equal(discovery.agreement[0].name,'Entity 2');
  assert.ok(discovery.agreement.every((x)=>x.commonGround));
  assert.throws(()=>reconcile(sides,sides,joint,6,'invalid'),/Unknown mediation strategy/);
});
test('no overlap never produces counterfeit consensus',()=>{
  const result=reconcile([item(1)],[item(2)],[item(3)]);
  assert.equal(result.agreement.length,0);
  assert.equal(result.exploratory[0].commonGround,false);
});
test('duplicate Qloo IDs retain their best independent and joint ranks',()=>{
  const a=[item(1),item(2),item(1)],b=[item(2),item(1),item(2)],joint=[item(1),item(2),item(1)];
  const outcome=reconcile(a,b,joint);
  const one=outcome.agreement.find(x=>x.id===id(1));
  const two=outcome.agreement.find(x=>x.id===id(2));
  assert.equal(outcome.overlapCount,2);
  assert.equal(one.groupARank,1);
  assert.equal(one.discoveryRank,1);
  assert.equal(two.groupBRank,1);
  assert.equal(two.discoveryRank,2);
});
test('agent resolves identities and makes independent and joint probes',async()=>{
  const calls=[];
  const client={
    async search(name,type){calls.push(['search',name,type]);return [{id:id(name==='Arrival'?1:2),name,type:'movie'}];},
    async insights(type,ids){calls.push(['insights',type,ids]);return ids.length===2?[item(11),item(12)]:ids[0]===id(1)?[item(11),item(13)]:[item(12),item(11)];}
  };
  const plan=await buildBridge({groupA:'movie: Arrival',groupB:'movie: Amelie',category:'movie'},client);
  assert.equal(plan.mode,'qloo-live');
  assert.equal(plan.state,'grounded-overlap');
  assert.equal(plan.candidates.length,1);
  assert.equal(plan.candidates[0].name,'Entity 11');
  assert.equal(calls.filter((x)=>x[0]==='insights').length,3);
  assert.equal(plan.groupA.seeds[0].name,'Arrival');
  assert.equal(plan.trace.length,5);
});
test('preserves independently verified common ground if joint Insights is temporarily unavailable',async()=>{
  const client={
    async search(name){return [{id:id(name==='Arrival'?1:2),name,type:'movie'}];},
    async insights(category,ids){
      if(ids.length===2)throw new (await import('../src/qloo.mjs')).QlooError('temporary Qloo outage',503);
      return [item(10),item(11)];
    }
  };
  const plan=await buildBridge({groupA:'movie: Arrival',groupB:'movie: Amelie',category:'movie',strategy:'discovery'},client);
  assert.equal(plan.state,'grounded-overlap');
  assert.equal(plan.metadata.jointStatus,'unavailable');
  assert.equal(plan.candidates.length,2);
  assert.equal(plan.exploratory.length,0);
  assert.match(plan.metadata.warnings.join(' '),/joint Qloo exploration/i);
  assert.match(plan.metadata.explanation,/discovery mode used independent evidence only/);
  assert.ok(plan.trace.some(t=>t.includes('unavailable')));
});
test('does not invent joint-only discoveries when the joint Qloo probe fails',async()=>{
  const client={
    async search(name){return [{id:id(name==='Arrival'?1:2),name,type:'movie'}];},
    async insights(category,ids){
      if(ids.length===2)throw new (await import('../src/qloo.mjs')).QlooError('temporarily unavailable',503);
      return ids[0]===id(1)?[item(10)]:[item(20)];
    }
  };
  const plan=await buildBridge({groupA:'Arrival',groupB:'Amelie',category:'movie'},client);
  assert.equal(plan.state,'exploration-only');
  assert.deepEqual(plan.candidates,[]);
  assert.deepEqual(plan.exploratory,[]);
  assert.equal(plan.metadata.jointStatus,'unavailable');
  assert.match(plan.metadata.explanation,/could not be checked/);
});
test('fails rather than masking programming errors or invalid joint requests',async()=>{
  const client={
    async search(name){return [{id:id(name==='Arrival'?1:2),name,type:'movie'}];},
    async insights(category,ids){
      if(ids.length===2)throw new Error('Programming error: malformed data');
      return [item(10)];
    }
  };
  await assert.rejects(buildBridge({groupA:'Arrival',groupB:'Amelie'},client),/Programming error/);
});
test('agent autonomously expands full ranked lists when initial searches have no overlap',async()=>{
  const calls=[];
  const client={
    async search(name){return [{id:id(name==='Dune'?1:2),name,type:'movie'}];},
    async insights(category,ids,take=40){
      calls.push({ids,take});
      if(ids.length===2)return [item(501)];
      const start=ids[0]===id(1)?100:200;
      const rows=Array.from({length:40},(_,i)=>item(start+i));
      return take===50?[...rows,item(501)]:rows;
    }
  };
  const result=await buildBridge({groupA:'Dune',groupB:'Barbie',category:'movie'},client);
  assert.equal(result.state,'grounded-overlap');
  assert.equal(result.candidates[0].name,'Entity 501');
  assert.equal(result.metadata.expandedSearch,true);
  assert.deepEqual(calls.map((x)=>x.take),[40,40,40,50,50]);
  assert.ok(result.trace.some((stage)=>stage.includes('expanded Qloo')));
});
test('human-in-the-loop preview exposes alternatives and respects a reviewed Qloo UUID',async()=>{
  const searchLog=[],insightLog=[];
  const client={
    async search(name,type){searchLog.push({name,type});return name==='Dune'
      ? [{id:id(1),name:'Dune',type:'movie'},{id:id(8),name:'Dune (Alternative)',type:'movie'}]
      : [{id:id(2),name:'Barbie',type:'movie'}];},
    async insights(type,ids){insightLog.push(ids);return [item(30),item(31)];}
  };
  const {previewBridge}=await import('../src/agent.mjs');
  const input={groupA:'movie: Dune',groupB:'movie: Barbie',category:'movie'};
  const preview=await previewBridge(input,client);
  assert.equal(preview.groupA[0].matches.length,2);
  assert.equal(preview.groupA[0].suggestedId,id(1));
  const plan=await buildBridge({...input,selections:{groupA:[id(8)],groupB:[id(2)]}},client);
  assert.equal(plan.groupA.seeds[0].id,id(8));
  assert.equal(insightLog[0][0],id(8));
  await assert.rejects(buildBridge({...input,selections:{groupA:[id(99)],groupB:[id(2)]}},client),/no longer valid/);
});
test('explicit review exclusions are honored even when Qloo would find a new match later',async()=>{
  const searches=[],insights=[];
  const client={
    async search(name,type){
      searches.push(name);
      return [{id:id(name==='Dune'?1:name==='Barbie'?2:3),name,type:'movie'}];
    },
    async insights(type,ids){
      insights.push(ids);
      return [item(30)];
    }
  };
  const input={groupA:'movie: Dune, movie: Uncertain Title',groupB:'movie: Barbie',category:'movie',
    selections:{groupA:[id(1),null],groupB:[id(2)]}};
  const plan=await buildBridge(input,client);
  assert.deepEqual(searches,['Dune','Barbie']);
  assert.deepEqual(plan.groupA.seeds.map(x=>x.name),['Dune']);
  assert.deepEqual(plan.groupA.excluded,['Uncertain Title']);
  assert.deepEqual(plan.groupA.unmatched,[]);
  assert.equal(plan.groupB.excluded.length,0);
  assert.ok(insights.every(ids=>!ids.includes(id(3))));
  assert.equal(plan.overlapCount,1);
  assert.equal(plan.metadata.requestedCalls,5); // two approved searches, three Qloo Insights calls
});
test('explicitly excluding all matches for one perspective fails instead of inventing a taste',async()=>{
  let calls=0;
  const client={
    async search(){calls++;return [{id:id(1),name:'Dune',type:'movie'}];},
    async insights(){throw Error('Must not run insights without two approved groups')}
  };
  await assert.rejects(buildBridge({groupA:'Dune',groupB:'Barbie',selections:{groupA:[null],groupB:[id(1)]}},client),/could not resolve/);
  assert.equal(calls,1);
});
test('agent reports exploration-only when there is no agreement',async()=>{
  const client={
    async search(name){return [{id:id(name==='Adele'?1:2),name,type:'artist'}];},
    async insights(type,ids){return ids.length===2?[item(8)]:ids[0]===id(1)?[item(6)]:[item(7)];}
  };
  const plan=await buildBridge({groupA:'Adele',groupB:'BTS',category:'movie'},client);
  assert.equal(plan.state,'exploration-only');
  assert.deepEqual(plan.candidates,[]);
  assert.equal(plan.exploratory[0].name,'Entity 8');
});
test('agent rejects unresolvable taste instead of inventing an entity',async()=>{
  const client={async search(){return [];},async insights(){throw Error('should not call')}};
  await assert.rejects(buildBridge({groupA:'NoSuchMovie',groupB:'NoSuchArtist'},client),/could not resolve/);
});
