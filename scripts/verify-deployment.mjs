/**
 * Public deployment preflight. Does NOT claim Qloo authentication passed.
 * Run: npm run verify:deploy -- https://YOUR-APP.onrender.com
 * For live Qloo integration, separately run "npm run verify:qloo" with the key
 * and use both steps of the public app in an incognito browser.
 * Run with --live to exercise real public /api/resolve and /api/plan for
 * movie, artist and book; no API key ever leaves the server.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

function validateBase(url) {
  let base;
  try {base=new URL(url);} catch {throw new Error('Provide a full HTTPS public demo URL.');}
  const loopback=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
  if (base.protocol!=='https:' && !(loopback && base.protocol==='http:')) {
    throw new Error('Public demos must use HTTPS, not an HTTP or private-network URL.');
  }
  if (base.username || base.password || base.pathname!=='/' || base.search || base.hash) {
    throw new Error('Provide only the site origin, without credentials, a path or query string.');
  }
  return base;
}
const liveScenarios=Object.freeze([
  {category:'movie',groupA:'movie: Interstellar',groupB:'movie: Spirited Away'},
  {category:'artist',groupA:'artist: Daft Punk',groupB:'artist: BTS'},
  {category:'book',groupA:'book: Dune',groupB:'book: Pride and Prejudice'}
]);
async function postJson(base,path,body,fetchImpl){
  const response=await fetchImpl(new URL(path,base),{
    method:'POST',
    headers:{'Content-Type':'application/json','Origin':base.origin},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(45000)
  });
  if(!response.ok)throw new Error(path+' failed with HTTP '+response.status+'. Check server logs and Qloo credentials.');
  let data;
  try{data=await response.json();}catch{throw new Error(path+' returned invalid JSON.');}
  return data;
}
/** Real hosted integration flow; never uses mock or embedded credentials. */
export async function verifyHostedFlow(base,{fetchImpl=fetch,categories=liveScenarios}={}){
  const results=[];
  for(const scenario of categories){
    const input={...scenario,strategy:'balanced'};
    const preview=await postJson(base,'/api/resolve',input,fetchImpl);
    if(preview.source!=='qloo-live')throw new Error('Hosted /api/resolve did not identify its Qloo source.');
    const selected={};
    for(const group of ['groupA','groupB']){
      const rows=preview[group];
      if(!Array.isArray(rows)||!rows.length)throw new Error(scenario.category+' has no '+group+' resolved taste rows.');
      selected[group]=rows.map(row=>{
        const match=row.matches?.find(x=>x.id===row.suggestedId);
        return match?.id||null;
      });
      if(!selected[group].some(Boolean)){
        throw new Error(scenario.category+' has no usable '+group+' Qloo entity. Inspect the event API key and search results.');
      }
    }
    const plan=await postJson(base,'/api/plan',{...input,selections:selected},fetchImpl);
    if(plan.mode!=='qloo-live'||plan.category!==scenario.category||
       !Array.isArray(plan.candidates)||!Array.isArray(plan.exploratory)||
       !plan.groupA?.count||!plan.groupB?.count||
       plan.metadata?.jointStatus!=='ok'||
       [...plan.candidates,...plan.exploratory].some(x=>x?.type!==scenario.category)||
       !['grounded-overlap','exploration-only'].includes(plan.state)){
      throw new Error(scenario.category+' did not return valid independent live Qloo Insights.');
    }
    results.push({
      category:scenario.category,
      sharedCandidates:plan.overlapCount,
      independentA:plan.groupA.count,
      independentB:plan.groupB.count,
      state:plan.state
    });
  }
  return results;
}
export async function verifyDeployment(url,{fetchImpl=fetch,live=false}={}) {
  const base=validateBase(url);
  const checks=[
    ['/',200,'text/html'],
    ['/styles.css',200,'text/css'],
    ['/app.js',200,'text/javascript'],
    ['/scene.js',200,'text/javascript'],
    ['/api/health',200,'application/json'],
    ['/api/readiness',200,'application/json']
  ];
  const report=[];
  for(const [path,expected,contentType] of checks){
    const response=await fetchImpl(new URL(path,base),{signal:AbortSignal.timeout(12000)});
    const mime=String(response.headers.get('content-type')||'').toLowerCase();
    if(response.status!==expected || !mime.includes(contentType)) {
      throw new Error(path+' returned HTTP '+response.status+' ('+(mime||'unknown type')+').');
    }
    if(path==='/'){
      const html=await response.text();
      if(!html.includes('CultureBridge')||!html.includes('id="bridge-form"')){
        throw new Error('Hosted homepage is not the CultureBridge interactive app.');
      }
      if(!String(response.headers.get('content-security-policy')||'').includes("script-src 'self'")){
        throw new Error('Hosted homepage is missing expected security headers.');
      }
    }
    if(path==='/api/readiness'){
      const data=await response.json();
      if(!data.qlooConfigured || data.status!=='ready'){
        throw new Error('Hosted app does not have its private Qloo key configured.');
      }
    }
    report.push(path);
  }
  const liveFlow=live?await verifyHostedFlow(base,{fetchImpl}):null;
  return {
    host:base.host,
    checksPassed:report,
    ...(liveFlow?{liveQlooChecks:liveFlow}:{}),
    note:live?'Live entity review and Qloo Insights completed for all three categories; overlap is not guaranteed.':'Hosting and secret presence confirmed. For actual Qloo integration add --live.'
  };
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2])throw new Error('Usage: npm run verify:deploy -- https://YOUR-APP.onrender.com [--live]');
    const live=process.argv.slice(3).includes('--live');
    const report=await verifyDeployment(process.argv[2],{live});
    console.log(JSON.stringify({success:true,...report},null,2));
  }catch(error){
    console.error('Public deployment verification failed:',error.message);
    process.exitCode=1;
  }
}
