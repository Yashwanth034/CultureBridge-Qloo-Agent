import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {runInNewContext} from 'node:vm';

const appSource=await readFile(join(dirname(fileURLToPath(import.meta.url)),'../public/app.js'),'utf8');

function makeHarness(){
  const elements=new Map();
  function get(id){
    if(!elements.has(id)){
      const events=new Map();
      elements.set(id,{
        id,events,hidden:id!=='empty-state',disabled:false,value:'',
        dataset:{},style:{},textContent:'',
        classList:{add(){},remove(){},toggle(){}},
        addEventListener(name,fn){events.set(name,fn);},
        setAttribute(){},scrollIntoView(){},focus(){},
        replaceChildren(){},append(){},
      });
    }
    return elements.get(id);
  }
  get('group-a').value='movie: Dune';get('group-b').value='movie: Barbie';
  get('category').value='movie';get('strategy').value='balanced';
  const requests=[];
  const document={
    getElementById:get,
    querySelectorAll:()=>[],
    createElement:tag=>({tagName:tag,dataset:{},style:{},append(){},replaceChildren(){},setAttribute(){}}),
    dispatchEvent(){}
  };
  const context={
    document,window:{matchMedia:()=>({matches:true})},
    CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
    requestAnimationFrame:fn=>fn(),
    AbortController,AbortSignal,
    navigator:{clipboard:{writeText:async()=>{}}},
    fetch:(path,options)=>{
      if(path==='/api/health')return Promise.resolve({json:async()=>({qlooConfigured:false})});
      return new Promise(resolve=>requests.push({path,options,resolve}));
    },
    console
  };
  runInNewContext(appSource,context);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  return {get,requests,flush};
}
const badResponse={ok:false,json:async()=>({error:'Temporary failure'})};

test('hero jump opens the existing taste studio and focuses the first input',()=>{
  const {get}=makeHarness();
  let scrolled=false,focused=false;
  get('studio').scrollIntoView=options=>{scrolled=options.block==='start';};
  get('group-a').focus=options=>{focused=options.preventScroll===true;};
  get('jump-to-tastes').events.get('click')();
  assert.equal(scrolled,true);
  assert.equal(focused,true);
});
test('cancel immediately aborts the in-flight request and ignores its later response',async()=>{
  const {get,requests,flush}=makeHarness();
  get('bridge-form').events.get('submit')({preventDefault(){}});
  assert.equal(get('loading-state').hidden,false);
  assert.equal(requests.length,1);
  assert.equal(requests[0].options.signal.aborted,false);
  get('cancel-request').events.get('click')();
  assert.equal(requests[0].options.signal.aborted,true);
  assert.equal(get('empty-state').hidden,false);
  assert.equal(get('resolve').disabled,false);
  requests[0].resolve(badResponse);
  await flush();
  assert.equal(get('empty-state').hidden,false);
  assert.equal(get('error-state').hidden,true);
});

test('finishing an obsolete request cannot unlock an ongoing replacement',async()=>{
  const {get,requests,flush}=makeHarness();
  const submit=()=>get('bridge-form').events.get('submit')({preventDefault(){}});
  submit();
  get('group-a').events.get('change')();
  submit();
  assert.equal(requests.length,2);
  assert.equal(requests[0].options.signal.aborted,true);
  assert.equal(requests[1].options.signal.aborted,false);
  assert.equal(get('resolve').disabled,true);
  requests[0].resolve(badResponse);
  await flush();
  assert.equal(get('resolve').disabled,true);
  assert.equal(get('loading-state').hidden,false);
  requests[1].resolve(badResponse);
  await flush();
  assert.equal(get('resolve').disabled,false);
  assert.equal(get('error-state').hidden,false);
});
