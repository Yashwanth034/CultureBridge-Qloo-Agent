import {QlooError} from './qloo.mjs';
/**
 * Tool-using mediator: resolve -> independent Qloo scouting -> joint exploration
 * -> deterministic parity evaluation -> transparent evidence.
 * Rank-based scores are NOT probabilities or Qloo affinities.
 */
const TYPES = new Set(['movie','artist','book']);
export function parseSeeds(text) {
  if (typeof text !== 'string' || text.length > 500) throw new QlooError('Use short preference names.',400);
  const parts = text.split(/[;,\n]/).map((s)=>s.trim()).filter(Boolean);
  if (parts.length < 1 || parts.length > 3) throw new QlooError('Give 1–3 tastes per group, separated by commas.',400);
  return parts.map((part)=>{
    const match = /^(movie|artist|book)\s*:\s*(.+)$/i.exec(part);
    const name = (match ? match[2] : part).trim();
    if (name.length < 2 || name.length > 80) throw new QlooError('Each preference must be 2–80 characters.',400);
    return {name,type:match ? match[1].toLowerCase() : null};
  });
}
const relativeRank = (rank,total) => rank < 0 ? 0 : Math.round((1-rank/Math.max(total,1))*100);
export function reconcile(a,b,joint,max=6) {
  const mapA = new Map(a.map((item,i)=>[item.id,{item,rank:i}]));
  const mapB = new Map(b.map((item,i)=>[item.id,{item,rank:i}]));
  const mapJ = new Map(joint.map((item,i)=>[item.id,{item,rank:i}]));
  const rows = [...new Set([...mapA.keys(),...mapB.keys(),...mapJ.keys()])].map((id)=>{
    const left=mapA.get(id),right=mapB.get(id),bridge=mapJ.get(id);
    const pa=relativeRank(left?left.rank:-1,a.length),pb=relativeRank(right?right.rank:-1,b.length);
    const both=Boolean(left&&right);
    return {
      id,name:(left||right||bridge).item.name,
      type:(left||right||bridge).item.type,
      groupAScore:pa,groupBScore:pb,
      commonGround:both,jointDiscovery:Boolean(bridge),
      parityGap:Math.abs(pa-pb),
      score:both?Math.round(.7*Math.min(pa,pb)+.3*(pa+pb)/2):0,
      discoveryRank:bridge?bridge.rank+1:null,
      groupARank:left?left.rank+1:null,groupBRank:right?right.rank+1:null,
      evidence:both?'Qloo independently ranked this for both groups: #'+(left.rank+1)+' and #'+(right.rank+1)+'.':'Exploratory only: it was not independently retrieved for both groups.'
    };
  });
  const agreement=rows.filter((x)=>x.commonGround)
    .sort((x,y)=>y.score-x.score || x.parityGap-y.parityGap || x.name.localeCompare(y.name));
  const exploratory=rows.filter((x)=>!x.commonGround&&x.jointDiscovery)
    .sort((x,y)=>x.discoveryRank-y.discoveryRank);
  return {agreement:agreement.slice(0,max),exploratory:exploratory.slice(0,max),overlapCount:agreement.length};
}
async function resolve(seeds,client) {
  const resolved=[],unmatched=[];
  for (const seed of seeds) {
    const candidates=await client.search(seed.name,seed.type);
    const exact=candidates.find((x)=>x.name.toLowerCase()===seed.name.toLowerCase());
    const chosen=exact||candidates[0];
    if (!chosen||!chosen.type) {unmatched.push(seed.name);continue;}
    resolved.push({input:seed.name,name:chosen.name,id:chosen.id,type:chosen.type,exact:Boolean(exact)});
  }
  return {resolved,unmatched};
}
export async function buildBridge(input,client) {
  const sa=parseSeeds(input.groupA),sb=parseSeeds(input.groupB);
  const category=String(input.category||'movie');
  if (!TYPES.has(category)) throw new QlooError('Choose movie, artist, or book.',400);
  const trace=['Validated two audience profiles'];
  const a=await resolve(sa,client),b=await resolve(sb,client);
  if (!a.resolved.length||!b.resolved.length) throw new QlooError('Qloo could not resolve enough tastes. Try well-known titles with movie: or artist: prefixes.',422);
  trace.push('Resolved actual Qloo cultural entities');
  const idsA=[...new Set(a.resolved.map((x)=>x.id))],idsB=[...new Set(b.resolved.map((x)=>x.id))];
  const listA=await client.insights(category,idsA),listB=await client.insights(category,idsB);
  trace.push('Scouted each group independently');
  const joint=await client.insights(category,[...new Set([...idsA,...idsB])]);
  trace.push('Probed a combined Qloo taste signal');
  const compared=reconcile(listA,listB,joint);
  trace.push('Audited rank balance and common-ground evidence');
  const overlap=compared.overlapCount>0;
  return {
    state:overlap?'grounded-overlap':'exploration-only',mode:'qloo-live',
    category,groupA:{seeds:a.resolved,unmatched:a.unmatched,count:listA.length},
    groupB:{seeds:b.resolved,unmatched:b.unmatched,count:listB.length},
    candidates:overlap?compared.agreement:[],exploratory:compared.exploratory,
    overlapCount:compared.overlapCount,trace,
    metadata:{
      requestedCalls:sa.length+sb.length+3,
      explanation:overlap
        ? 'Each common-ground item appears in both independent Qloo rankings. Balance is calculated from relative positions, not Qloo affinity or estimated probability.'
        : 'No item appeared in both independent top lists. Joint-signal suggestions are exploratory, NOT verified agreement.'
    }
  };
}
