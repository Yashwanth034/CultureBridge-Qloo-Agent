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
test('no overlap never produces counterfeit consensus',()=>{
  const result=reconcile([item(1)],[item(2)],[item(3)]);
  assert.equal(result.agreement.length,0);
  assert.equal(result.exploratory[0].commonGround,false);
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
