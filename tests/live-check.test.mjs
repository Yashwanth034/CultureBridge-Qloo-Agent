import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyQloo,verifyAllQloo} from '../scripts/verify-qloo.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const item=n=>({id:id(n),name:'Movie '+n,type:'movie'});
test('live verification refuses absent event credentials before external requests',async()=>{
  await assert.rejects(verifyQloo({client:{apiKey:''}}),/No QLOO_API_KEY/);
  await assert.rejects(verifyQloo({client:{apiKey:'test'},category:'wrong'}),/Choose movie/);
});
test('verification exercises two searches and three independent/joint insights calls',async()=>{
  const calls=[];
  const client={
    apiKey:'mock-private-key',
    async search(name,type){
      calls.push(['search',name,type]);
      return [{id:id(name==='Interstellar'?1:2),name,type:'movie'}];
    },
    async insights(type,ids,take){
      calls.push(['insights',type,ids,take]);
      return ids.length===2?[item(10),item(11)]:ids[0]===id(1)?[item(10),item(12)]:[item(11),item(10)];
    }
  };
  const result=await verifyQloo({client});
  assert.equal(result.category,'movie');
  assert.equal(result.firstProfileCandidates,2);
  assert.equal(result.secondProfileCandidates,2);
  assert.equal(result.verifiedOverlapCount,1);
  assert.equal(calls.filter(x=>x[0]==='search').length,2);
  assert.equal(calls.filter(x=>x[0]==='insights').length,3);
  assert.doesNotMatch(JSON.stringify(result),/mock-private-key/);
});
test('verification refuses a Qloo response with no usable independent candidates',async()=>{
  const client={
    apiKey:'mock',
    async search(name){return [{id:id(name==='Interstellar'?1:2),name,type:'movie'}];},
    async insights(){return []}
  };
  await assert.rejects(verifyQloo({client}),/did not return independent rankings/);
});
test('all-categories verification uses real category-specific taste seeds',async()=>{
  const searched=[],queries=[];
  const ids={'Interstellar':1,'Spirited Away':2,'Daft Punk':3,'BTS':4,'Dune':5,'Pride and Prejudice':6};
  const client={
    apiKey:'mock-credential',
    async search(name,type){searched.push([name,type]);return [{id:id(ids[name]),name,type}];},
    async insights(type,entities){queries.push([type,entities]);return [{id:id(100),name:'Shared',type}];}
  };
  const reports=await verifyAllQloo({client});
  assert.deepEqual(reports.map(x=>x.category),['movie','artist','book']);
  assert.deepEqual(searched,[['Interstellar','movie'],['Spirited Away','movie'],['Daft Punk','artist'],['BTS','artist'],['Dune','book'],['Pride and Prejudice','book']]);
  assert.equal(queries.length,9);
  assert.deepEqual(queries.map(x=>x[0]),['movie','movie','movie','artist','artist','artist','book','book','book']);
  assert.ok(reports.every(x=>x.verifiedOverlapCount===1));
});
