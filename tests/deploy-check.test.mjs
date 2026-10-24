import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyDeployment} from '../scripts/verify-deployment.mjs';

function fakeSite({configured=true,broken=null}={}){
  const entries={
    '/':['text/html','<html><title>CultureBridge</title><form id="bridge-form"></form></html>'],
    '/styles.css':['text/css','.test{}'],
    '/app.js':['text/javascript','document.querySelector("form")'],
    '/scene.js':['text/javascript','const scene = 1'],
    '/api/health':['application/json',JSON.stringify({status:'ok',qlooConfigured:configured})],
    '/api/readiness':['application/json',JSON.stringify({status:configured?'ready':'configuration_required',qlooConfigured:configured})]
  };
  return async url=>{
    const p=new URL(url).pathname;
    const [contentType,body]=entries[p]||['text/plain','not found'];
    return new Response(body,{status:p===broken?500:(p==='/api/readiness'&&!configured?503:entries[p]?200:404),
      headers:{'Content-Type':contentType,...(p==='/'?{'Content-Security-Policy':"default-src 'none'; script-src 'self'"}:{})}});
  };
}
test('deployment preflight checks every public asset and readiness',async()=>{
  const result=await verifyDeployment('https://culturebridge.example/',{fetchImpl:fakeSite()});
  assert.equal(result.host,'culturebridge.example');
  assert.equal(result.checksPassed.length,6);
});
test('deployment preflight prevents HTTP public links, missing keys and broken assets',async()=>{
  await assert.rejects(verifyDeployment('http://public.example/',{fetchImpl:fakeSite()}),/HTTPS/);
  await assert.rejects(verifyDeployment('https://username:password@public.example/',{fetchImpl:fakeSite()}),/without credentials/);
  await assert.rejects(verifyDeployment('https://public.example/',{fetchImpl:fakeSite({configured:false})}),/HTTP 503/);
  await assert.rejects(verifyDeployment('https://public.example/',{fetchImpl:fakeSite({broken:'/scene.js'})}),/scene.js returned HTTP 500/);
});
