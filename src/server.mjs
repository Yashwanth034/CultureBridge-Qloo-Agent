import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {QlooClient, QlooError} from './qloo.mjs';
import {buildBridge, previewBridge} from './agent.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','public');
const staticFiles=new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/scene.js',['scene.js','text/javascript; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']],
  ['/favicon.svg',['favicon.svg','image/svg+xml']]
]);
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(JSON.stringify(obj));};
const counts=new Map();
function allow(ip) {
  const now=Date.now();
  if (counts.size>2500) for (const [key,item] of counts) if (item.reset<now) counts.delete(key);
  const item=counts.get(ip);
  if (!item||item.reset<now) {counts.set(ip,{n:1,reset:now+3600000});return true;}
  return ++item.n<=60;
}
async function bodyJson(req) {
  let data='';
  for await (const chunk of req) {
    data+=chunk.toString('utf8');
    if (data.length>5000) throw new QlooError('Request body too large.',413);
  }
  try {return JSON.parse(data);}catch{throw new QlooError('Request must contain valid JSON.',400);}
}
export function createAppServer({client=new QlooClient()}={}) {
  return createServer(async(req,res)=>{
    try {
      const url=new URL(req.url||'/', 'http://localhost');
      const pathname=url.pathname;
      if (req.method==='GET'&&pathname==='/api/health') {
        // Liveness: the Node process is listening. Do not mistake this for an
        // upstream Qloo authentication or integration check.
        return send(res,200,{status:'ok',qlooConfigured:Boolean(client.apiKey),mode:'live-only'});
      }
      if (req.method==='GET'&&pathname==='/api/readiness') {
        // Deployment readiness is deliberately stricter than process liveness.
        // A key being set is necessary but does not prove Qloo will accept it.
        const configured=Boolean(client.apiKey && String(client.apiKey).trim());
        return send(res,configured?200:503,{status:configured?'ready':'configuration_required',qlooConfigured:configured,liveQlooVerified:false});
      }
      if (req.method==='POST'&&(pathname==='/api/plan'||pathname==='/api/resolve')) {
        const origin=req.headers.origin;
        if (origin) {
          let host;
          try {host=new URL(origin).host;} catch {return send(res,403,{error:'Invalid request origin.'});}
          if (host!==req.headers.host) return send(res,403,{error:'Cross-origin requests are not allowed.'});
        }
        if (!String(req.headers['content-type']||'').startsWith('application/json')) return send(res,415,{error:'Send application/json.'});
        if (!allow(req.socket.remoteAddress||'unknown')) return send(res,429,{error:'Too many plan requests. Please try again later.'});
        const payload=await bodyJson(req);
        if (!payload||typeof payload!=='object'||Array.isArray(payload)) throw new QlooError('Expected an input object.',400);
        const result=pathname==='/api/resolve'?await previewBridge(payload,client):await buildBridge(payload,client);
        return send(res,200,result);
      }
      if (req.method==='GET'&&staticFiles.has(pathname)) {
        const [name,contentType]=staticFiles.get(pathname);
        const contents=await readFile(join(root,name));
        res.writeHead(200,{'Content-Type':contentType,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
          'Content-Security-Policy':"default-src 'none'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          'Cache-Control':'public, max-age=60'});
        return res.end(contents);
      }
      return send(res,404,{error:'Not found.'});
    } catch(err) {
      // No request paths, raw upstream error responses or credentials leak to users.
      const status=err instanceof QlooError?err.status:500;
      return send(res,status,{error:err instanceof QlooError?err.message:'Unexpected server error. Please try again.'});
    }
  });
}
if (process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const port=Number(process.env.PORT||3000);
  if (!Number.isInteger(port)||port<1||port>65535) throw new Error('Invalid PORT');
  createAppServer().listen(port,'0.0.0.0',()=>console.log('CultureBridge ready on port '+port));
}
