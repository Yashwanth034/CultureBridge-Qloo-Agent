/**
 * Public deployment preflight. Does NOT claim Qloo authentication passed.
 * Run: npm run verify:deploy -- https://YOUR-APP.onrender.com
 * For live Qloo integration, separately run "npm run verify:qloo" with the key
 * and use both steps of the public app in an incognito browser.
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
export async function verifyDeployment(url,{fetchImpl=fetch}={}) {
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
  return {
    host:base.host,
    checksPassed:report,
    note:'Hosting and secret presence confirmed. Real Qloo authentication and recommendation flow require a separate test.'
  };
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(!process.argv[2])throw new Error('Usage: npm run verify:deploy -- https://YOUR-APP.onrender.com');
    const report=await verifyDeployment(process.argv[2]);
    console.log(JSON.stringify({success:true,...report},null,2));
  }catch(error){
    console.error('Public deployment verification failed:',error.message);
    process.exitCode=1;
  }
}
