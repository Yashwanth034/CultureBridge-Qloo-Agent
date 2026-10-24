'use strict';
const $=(id)=>document.getElementById(id);
const form=$('bridge-form'),button=$('generate'),results=$('results');
let latest=null;
const presets={
  cinema:{a:'movie: Interstellar, artist: Daft Punk',b:'movie: Spirited Away, artist: BTS',category:'movie'},
  music:{a:'artist: Radiohead, movie: Dune',b:'artist: Taylor Swift, movie: Barbie',category:'artist'},
  books:{a:'book: Dune, movie: Arrival',b:'book: Pride and Prejudice, artist: Adele',category:'book'}
};
document.querySelectorAll('[data-preset]').forEach((el)=>el.addEventListener('click',()=>{
  const p=presets[el.dataset.preset];$('group-a').value=p.a;$('group-b').value=p.b;$('category').value=p.category;
  $('group-a').focus();
}));
function make(tag,cls,txt) {
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(txt!==undefined)node.textContent=String(txt);
  return node;
}
function showError(message) {
  results.hidden=false;results.setAttribute('aria-busy','false');
  $('result-title').textContent='We need one more ingredient.';
  $('result-subtitle').textContent=message;
  $('warnings').hidden=true;$('counterfactual').hidden=true;
  $('cards').replaceChildren();$('explore-section').hidden=true;
  document.querySelector('.summary-strip').hidden=true;
  document.querySelector('.evidence').hidden=true;
  $('export').hidden=true;
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
function reportText(plan) {
  const lines=[
    '# CultureBridge evidence report',
    'Evidence source: Live Qloo Insights API',
    'State: '+plan.state,
    'Category: '+plan.category,
    'Mediation strategy: '+plan.strategy,
    'Group A unilateral pick: '+(plan.comparison.unmediatedA?.name||'none'),
    'Group B unilateral pick: '+(plan.comparison.unmediatedB?.name||'none'),
    'First profile: '+plan.groupA.seeds.map((x)=>x.name+' ('+x.type+')').join(', '),
    'Second profile: '+plan.groupB.seeds.map((x)=>x.name+' ('+x.type+')').join(', '),
    '',
    'Verified overlap: '+plan.overlapCount,
    ...plan.candidates.map((x)=>'- '+x.name+' | relative rank score '+x.score+' | A #'+x.groupARank+' | B #'+x.groupBRank),
    '',
    'Exploratory (not validated for both groups):',
    ...plan.exploratory.map((x)=>'- '+x.name+' | joint rank #'+x.discoveryRank),
    '',
    plan.metadata.explanation,
    'Note: Relative rank points are not probabilities or upstream Qloo affinity scores.'
  ];
  return lines.join('\n');
}
$('export').addEventListener('click',async()=>{
  if(!latest)return;
  try {await navigator.clipboard.writeText(reportText(latest));$('export').textContent='Copied ✓';}
  catch {$('export').textContent='Clipboard not available';}
});
function candidateCard(x,index) {
  const article=make('article','candidate');
  const upper=make('div','candidate-top');
  const rank=make('span','candidate-rank',String(index+1).padStart(2,'0'));
  const pill=make('span','verified-tag','✳  VERIFIED TWO-SIDED MATCH');
  upper.append(rank,pill);
  const name=make('h3','candidate-name',x.name);
  const text=make('p','candidate-description','Independently recommended by Qloo for both groups. The bars reflect relative list position.');
  const comparison=make('div','comparison');
  for(const [label,value,kind,sourceRank] of [
    ['FIRST PROFILE',x.groupAScore,'first',x.groupARank],
    ['SECOND PROFILE',x.groupBScore,'second',x.groupBRank]
  ]) {
    const row=make('div','comparison-row');
    const head=make('div','comparison-head');
    head.append(make('span','',label),make('span','', 'QLOO RANK #'+sourceRank));
    const track=make('div','bar-track');
    const fill=make('div','bar-fill '+kind);fill.style.width=Math.max(0,Math.min(100,value))+'%';
    track.append(fill);row.append(head,track);comparison.append(row);
  }
  const footer=make('div','candidate-footer');
  const balance=make('div','balance');
  balance.append(make('strong','',x.score+' / 100'),make('span','','relative balance · our heuristic'));
  footer.append(balance,make('p','evidence-copy',x.evidence));
  article.append(upper,name,text,comparison,footer);
  return article;
}
function render(plan) {
  latest=plan;results.hidden=false;results.setAttribute('aria-busy','false');
  document.querySelector('.summary-strip').hidden=false;
  document.querySelector('.evidence').hidden=false;
  $('export').hidden=false;$('export').textContent='Copy evidence report ↗';
  const verified=plan.state==='grounded-overlap';
  $('result-title').textContent=verified?'Here is where your worlds overlap.':'Our agent found possibilities, not proven agreement.';
  $('result-subtitle').textContent=verified?'Every featured pick was surfaced independently by Qloo for both sides.':'The two independent result sets did not intersect. Try different seeds or a different category.';
  $('trust').textContent=verified?'TWO-SIDED EVIDENCE':'EXPLORATORY ONLY';
  $('count').textContent=String(plan.overlapCount);
  $('cards').replaceChildren(...plan.candidates.map(candidateCard));
  const counter=$('counterfactual');
  const baseline=plan.comparison||{};
  const alternatives=[['GROUP A ACTS ALONE',baseline.unmediatedA],['GROUP B ACTS ALONE',baseline.unmediatedB]];
  counter.hidden=!(baseline.unmediatedA||baseline.unmediatedB);
  $('counterfactual-rows').replaceChildren(...alternatives.filter((x)=>x[1]).map(([label,option])=>{
    const block=make('div','counterfactual-block');
    block.append(make('span','strip-label',label),make('strong','',option.name),
      make('span','counterfactual-notice',option.acknowledgedByOther?'Also appears in the other group’s Qloo list':'Not found in the other group’s Qloo top list'));
    return block;
  }));
  $('explore-section').hidden=!plan.exploratory.length;
  $('explore-cards').replaceChildren(...plan.exploratory.map((x)=>{
    const el=make('div','explore-card');
    el.append(make('strong','',x.name),make('span','', 'Joint Qloo discovery #'+x.discoveryRank));
    return el;
  }));
  const unmatched=[...plan.groupA.unmatched,...plan.groupB.unmatched];
  const approx=[...(plan.groupA.approximate||[]),...(plan.groupB.approximate||[])];
  const warningMessages=[];
  if(unmatched.length)warningMessages.push('Could not match: '+unmatched.join(', ')+'. Results use only resolved seeds.');
  if(approx.length)warningMessages.push('Approximate Qloo name matches: '+approx.map((x)=>x.input+' → '+x.name).join('; ')+'. Check these names before trusting the plan.');
  const warnings=$('warnings');warnings.hidden=!warningMessages.length;warnings.textContent=warningMessages.join(' ');
  const trace=$('trace');
  trace.replaceChildren(...plan.trace.map((x)=>make('li','',x)));
  $('methodology').textContent=plan.metadata.explanation;
  results.scrollIntoView({behavior:'smooth',block:'start'});
}
form.addEventListener('submit',async(e)=>{
  e.preventDefault();button.disabled=true;
  const label=button.querySelector('span');
  const old=label.textContent;label.textContent='Mapping the taste graph…';
  results.setAttribute('aria-busy','true');
  try {
    const payload={groupA:$('group-a').value,groupB:$('group-b').value,category:$('category').value,strategy:$('strategy').value};
    const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    let data;try{data=await response.json()}catch{throw new Error('Unexpected response from application server.')}
    if(!response.ok)throw new Error(data.error||'Unable to complete the Qloo requests.');
    render(data);
  }catch(err){latest=null;showError(err.message);}
  finally{button.disabled=false;label.textContent=old;results.setAttribute('aria-busy','false');}
});
fetch('/api/health').then((r)=>r.json()).then((status)=>{
  const banner=$('api-banner');
  if(status.qlooConfigured) {
    banner.classList.add('connected');banner.querySelector('.status-symbol').textContent='●';
    $('api-message').textContent='Live Qloo integration is configured. Explore real cultural data below.';
  } else {
    banner.classList.add('needs-key');banner.querySelector('.status-symbol').textContent='!';
    $('api-message').textContent='Setup required: add your Qloo event API key to the server to enable live recommendations. No pretend demo data is shown.';
  }
}).catch(()=>{$('api-message').textContent='Unable to check server health.';});
