/**
 * One-command live Qloo smoke test, with no simulated data.
 *
 * Usage (from local shell with a secret configured):
 *   QLOO_API_KEY=... npm run verify:qloo
 *   npm run verify:qloo -- artist
 *   npm run verify:qloo -- all
 *
 * NOTE: Do not paste a key into GitHub, browser console, or Devpost.
 * The command reports only the test category, candidate counts and stage.
 */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {QlooClient} from '../src/qloo.mjs';
import {buildBridge} from '../src/agent.mjs';

const scenarios = Object.freeze({
  movie:{groupA:'movie: Interstellar',groupB:'movie: Spirited Away'},
  artist:{groupA:'artist: Daft Punk',groupB:'artist: BTS'},
  book:{groupA:'book: Dune',groupB:'book: Pride and Prejudice'}
});
const categories=new Set(Object.keys(scenarios));
export async function verifyQloo({client,category='movie'}={}) {
  if (!categories.has(category)) throw new Error('Choose movie, artist or book.');
  const activeClient=client??new QlooClient();
  if (!activeClient.apiKey || !String(activeClient.apiKey).trim()) {
    throw new Error('No QLOO_API_KEY configured. Request your private event key and set it in the server environment.');
  }
  // A and B have different input seeds, so the check proves both independent
  // search paths and the subsequent joint Insights request execute.
  const plan=await buildBridge({...scenarios[category],category,strategy:'balanced'},activeClient);
  if (plan.mode!=='qloo-live' || !plan.groupA.seeds.length || !plan.groupB.seeds.length) {
    throw new Error('Live Qloo smoke test did not resolve both input profiles.');
  }
  if (plan.groupA.count===0 || plan.groupB.count===0) {
    throw new Error('Live Qloo Insights did not return independent rankings for both profiles.');
  }
  if(plan.metadata?.jointStatus!=='ok'){
    throw new Error('Live Qloo joint exploration failed; verify full Insights availability before submitting.');
  }
  return {
    category,
    state:plan.state,
    firstProfileCandidates:plan.groupA.count,
    secondProfileCandidates:plan.groupB.count,
    verifiedOverlapCount:plan.overlapCount,
    exploratoryCount:plan.exploratory.length,
    upstreamCalls:plan.metadata.requestedCalls,
    note:'All counts came from live Qloo requests. Shared candidates are not guaranteed.'
  };
}
export async function verifyAllQloo({client}={}) {
  const activeClient=client??new QlooClient();
  const reports=[];
  for(const category of categories) reports.push(await verifyQloo({client:activeClient,category}));
  return reports;
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const selection=process.argv[2]||'all';
    const report=selection==='all'?await verifyAllQloo():await verifyQloo({category:selection});
    console.log(JSON.stringify({success:true,...report},null,2));
  } catch(error) {
    console.error('Qloo live verification failed:',error.message);
    process.exitCode=1;
  }
}
