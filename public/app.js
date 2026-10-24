'use strict';
/* Real two-stage agent interface: resolve entities → human review → Qloo insights. */
const $=id=>document.getElementById(id);
const stages=['empty-state','loading-state','match-review','results','error-state'];
const presets={
  cinema:{a:'movie: Interstellar, artist: Daft Punk',b:'movie: Spirited Away, artist: BTS',category:'movie'},
  music:{a:'artist: Radiohead, movie: Dune',b:'artist: Taylor Swift, movie: Barbie',category:'artist'},
  books:{a:'book: Dune, movie: Arrival',b:'book: Pride and Prejudice, artist: Adele',category:'book'}
};
let draft=null, preview=null, latest=null, selectedIndex=0, requestSerial=0;
const el=(tag,className,text)=>{
  const item=document.createElement(tag);
  if(className)item.className=className;
  if(text!==undefined)item.textContent=String(text);
  return item;
};
function stage(name) {
  for(const id of stages)$(id).hidden=id!==name;
  $('phase-indicator').textContent=({ 'empty-state':'NOT STARTED','loading-state':'WORKING','match-review':'REVIEW THE MATCHES','results':'SHORTLIST READY','error-state':'NEEDS ATTENTION'})[name];
  $('results').setAttribute('aria-busy','false');
  document.dispatchEvent(new CustomEvent('culturebridge:phase',{detail:{phase:name}}));
  // The active workspace sits beneath the three taste cards on mobile and
  // many laptop screens. Without scrolling, a successful click can look inert.
  if(name!=='empty-state') {
    requestAnimationFrame(()=>{
      const active=$(name);
      if(!active.hidden) active.scrollIntoView({
        block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'
      });
    });
  }
}
function updateDraft(){return {groupA:$('group-a').value,groupB:$('group-b').value,category:$('category').value,strategy:$('strategy').value};}
async function post(path,payload){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  let data;
  try{data=await response.json();}catch{throw new Error('The server returned an unreadable response.');}
  if(!response.ok)throw new Error(data.error||'Unable to complete the request.');
  if(data.source==='qloo-live'||data.mode==='qloo-live'){
    // Unlike /api/health, this reflects a completed request that reached
    // Qloo through the server. Do not mark unconfigured apps as connected.
    $('api-banner').dataset.liveVerified='true';
    $('api-banner').classList.remove('needs-key');
    $('api-banner').classList.add('connected');
    $('api-message').textContent=data.mode==='qloo-live'?'Qloo live recommendations received':'Qloo live search connected';
  }
  return data;
}
function setLoading(title,detail){
  stage('loading-state');$('loading-title').textContent=title;$('loading-detail').textContent=detail;
}
function showError(error){
  stage('error-state');
  $('error-message').textContent=error instanceof Error?error.message:String(error);
}
function reviewGroup(target,rows,label,group){
  const wrap=$(target);
  const title=el('div','review-group-title');
  title.append(el('span','',label),el('span','',rows.length+' TASTE SIGNAL'+(rows.length===1?'':'S')));
  wrap.replaceChildren(title);
  rows.forEach((seed,index)=>{
    const row=el('div','review-entry');
    const side=el('div');
    side.append(el('span','review-input-label',seed.input),el('span','review-type',seed.type||'Type not specified'));
    const field=el('div');
    const control=el('select','choice-select');
    control.dataset.group=group;
    control.dataset.index=String(index);
    control.setAttribute('aria-label','Qloo match for '+seed.input);
    if(!seed.matches.length){
      const option=el('option','','No Qloo match — excluded');option.value='';control.append(option);
      control.disabled=true;
      field.append(control,el('p','review-note','Try editing this name if it is important to your plan.'));
    }else{
      for(const match of seed.matches){
        const suffix=match.type?' · '+match.type:'';
        const option=el('option','',match.name+suffix+(match.exact?' · exact':''));
        option.value=match.id;
        if(match.id===seed.suggestedId)option.selected=true;
        control.append(option);
      }
      const note=seed.matches.find(x=>x.id===seed.suggestedId)?.exact
        ?'Exact title matched to a Qloo entity.'
        :'Suggested match. Check the title before continuing.';
      field.append(control,el('p','review-note',note));
    }
    row.append(side,field);wrap.append(row);
  });
}
function renderPreview(data){
  preview=data;
  reviewGroup('review-a',data.groupA,'GROUP A / FIRST PERSPECTIVE','groupA');
  reviewGroup('review-b',data.groupB,'GROUP B / SECOND PERSPECTIVE','groupB');
  const countA=data.groupA.filter(x=>x.matches.length).length;
  const countB=data.groupB.filter(x=>x.matches.length).length;
  const issue=$( 'review-warning');
  issue.hidden=Boolean(countA&&countB);
  issue.textContent=countA&&countB?'':'Each side must have at least one matched Qloo entity. Edit your preferences and check again.';
  $('generate').disabled=!(countA&&countB);
  stage('match-review');
}
function collectSelections(group){
  const rows=preview[group];
  return rows.map((_,i)=>{
    const select=document.querySelector('.choice-select[data-group="'+group+'"][data-index="'+i+'"]');
    return select&&!select.disabled?select.value:null;
  });
}
function reportText(plan){
  return [
    'CultureBridge / taste session','Source: Qloo live API','Category: '+plan.category,
    'Mode: '+plan.strategy,'Status: '+plan.state,
    'Group A: '+plan.groupA.seeds.map(x=>x.name).join(', '),
    'Group B: '+plan.groupB.seeds.map(x=>x.name).join(', '),
    'Verified shared options: '+plan.overlapCount,'',
    ...plan.candidates.map(x=>x.name+' / A #'+x.groupARank+' / B #'+x.groupBRank+' / rank balance '+x.score+
      (typeof x.groupAAffinity==='number'?' / raw Qloo A affinity '+x.groupAAffinity:'')+
      (typeof x.groupBAffinity==='number'?' / raw Qloo B affinity '+x.groupBAffinity:'')+
      (typeof x.jointAffinity==='number'?' / raw Qloo joint affinity '+x.jointAffinity:'')),
    '','Exploratory (not independently verified for both):',
    ...plan.exploratory.map(x=>x.name+' / joint Qloo rank #'+x.discoveryRank),
    '',plan.metadata.explanation,'Rank-balance numbers are local heuristics. Raw Qloo affinity values, when present, are not satisfaction probabilities and should not be compared between separate queries.'
  ].join('\n');
}
function selectCandidate(index){
  if(!latest||!latest.candidates[index])return;
  selectedIndex=index;
  const x=latest.candidates[index];
  document.dispatchEvent(new CustomEvent('culturebridge:selection',{detail:{balance:x.score,rankA:x.groupARank,rankB:x.groupBRank}}));
  $('featured').hidden=false;
  $('featured-title').textContent=x.name;
  $('featured-evidence').textContent=x.evidence;
  const anchorSection=$('featured-anchors');
  anchorSection.replaceChildren();
  for(const [label,seeds] of [['A',latest.groupA.seeds],['B',latest.groupB.seeds]]){
    const line=el('p','anchor-line');
    line.append(el('strong','',label+' / '),el('span','',seeds.map(y=>y.name).join(' · ')));
    anchorSection.append(line);
  }
  const affinities=[['A / Qloo affinity',x.groupAAffinity],['B / Qloo affinity',x.groupBAffinity],['Joint Qloo affinity',x.jointAffinity]]
    .filter(([,value])=>typeof value==='number'&&Number.isFinite(value));
  const affinityPanel=$('featured-affinities');
  affinityPanel.hidden=!affinities.length;
  affinityPanel.replaceChildren();
  if(affinities.length){
    affinityPanel.append(el('p','affinity-heading','QLOO-REPORTED EVIDENCE'));
    for(const [label,value] of affinities){
      const line=el('div','affinity-entry');
      line.append(el('span','',label),el('strong','',String(Number(value.toFixed(3)))));
      affinityPanel.append(line);
    }
    affinityPanel.append(el('p','affinity-disclaimer','Raw affinity values are provided by Qloo. They are not percentages, satisfaction probabilities or directly comparable across independent queries.'));
  }
  const bars=[];
  for(const [title,value,rank,color] of [
    ['Perspective A',x.groupAScore,x.groupARank,'first'],
    ['Perspective B',x.groupBScore,x.groupBRank,'second']]){
    const row=el('div','evidence-row');
    const head=el('div','bar-top');
    head.append(el('span','',title),el('span','','#'+rank+' IN QLOO'));
    const track=el('div','bar-track');
    const fill=el('div','bar-fill '+color);
    fill.style.width=Math.min(100,Math.max(0,value))+'%';
    track.append(fill);row.append(head,track);bars.push(row);
  }
  $('featured-bars').replaceChildren(...bars);
  document.querySelectorAll('.rank-item').forEach((node,i)=>{
    node.classList.toggle('selected',i===index);
    node.setAttribute('aria-pressed',String(i===index));
  });
}
function resultRow(x,index){
  const button=el('button','rank-item');
  button.type='button';
  const number=el('span','rank-no',String(index+1).padStart(2,'0'));
  const nameWrap=el('span');
  nameWrap.append(el('span','rank-name',x.name),el('span','rank-sub','Group A #'+x.groupARank+'  ·  Group B #'+x.groupBRank));
  const fairness=el('span','rank-index');
  fairness.append(el('span','rank-number',x.score),el('span','score-label','BALANCE'));
  button.setAttribute('aria-label','Inspect '+x.name+'; relative-rank fairness index '+x.score+', not a probability');
  button.append(number,nameWrap,fairness,el('span','rank-arr','↗'));
  button.addEventListener('click',()=>selectCandidate(index));
  return button;
}
function renderPlan(plan){
  latest=plan;selectedIndex=0;
  stage('results');
  const verified=plan.state==='grounded-overlap';
  $('result-title').textContent=verified?'Here’s what you share.':'No confirmed overlap—yet.';
  $('result-subtitle').textContent=verified
    ?'These appeared independently in both Qloo taste rankings. Choose one to inspect why.'
    :'Our two independent Qloo lists did not intersect. Joint suggestions are exploratory, not verified agreement.';
  $('trust').textContent=verified?'Two-sided ranking':'Exploratory only';
  $('count').textContent=String(plan.overlapCount);
  $('no-overlap').hidden=verified;
  $('shared-results').hidden=!verified;
  if(!verified){
    const best=plan.exploratory[0];
    $('no-overlap-title').textContent=best?best.name:'No shared match in this search';
    $('no-overlap-copy').textContent=best
      ?'A Qloo joint-search discovery (#'+best.discoveryRank+'), not a confirmed match in both independent rankings. This is an idea to explore together, not proof of agreement.'
      :'Qloo did not return an independently shared or joint exploratory pick. Try different favorites or a different category; we won’t invent a recommendation.';
    const next={movie:'artist',artist:'book',book:'movie'}[plan.category];
    $('try-category').dataset.category=next;
    $('try-category').firstChild.textContent={movie:'Try movies ',artist:'Try music ',book:'Try books '}[next];
  }
  $('cards').replaceChildren(...plan.candidates.map(resultRow));
  $('featured').hidden=!plan.candidates.length;
  if(plan.candidates.length)selectCandidate(0);
  const comparison=plan.comparison||{};
  const baselines=[['IF A PICKED ALONE',comparison.unmediatedA],['IF B PICKED ALONE',comparison.unmediatedB]];
  $('counterfactual').hidden=!baselines.some(x=>x[1]);
  $('counterfactual-rows').replaceChildren(...baselines.filter(x=>x[1]).map(([label,value])=>{
    const block=el('div','counterfactual-block');
    block.append(el('span','',label),el('strong','',value.name),
      el('span','counterfactual-notice',value.acknowledgedByOther?'Also appears in the other side’s ranking':'Not in the other side’s Qloo top list'));
    return block;
  }));
  $('explore-section').hidden=!plan.exploratory.length;
  $('explore-cards').replaceChildren(...plan.exploratory.map(x=>{
    const item=el('div','explore-card');
    item.append(el('strong','',x.name),el('span','','Joint search rank #'+x.discoveryRank));
    return item;
  }));
  const notes=[...(plan.metadata?.warnings||[])];
  for(const group of [plan.groupA,plan.groupB]){
    if(group.unmatched?.length)notes.push('Not matched: '+group.unmatched.join(', '));
    if(group.approximate?.length)notes.push('Approximate Qloo titles: '+group.approximate.map(x=>x.input+' → '+x.name).join('; '));
  }
  $('warnings').hidden=!notes.length;
  $('warnings').textContent=notes.join('. ');
  $('trace').replaceChildren(...plan.trace.map(text=>el('li','',text)));
  $('methodology').textContent=plan.metadata.explanation;
}
async function checkMatches(){
  const current=updateDraft(); draft=current;preview=null;latest=null;
  const req=++requestSerial;
  setLoading('Matching the cultural identities…','Searching Qloo for the actual films, artists and books you named.');
  $('resolve').disabled=true;
  try{
    const data=await post('/api/resolve',current);
    if(req===requestSerial)renderPreview(data);
  }catch(error){if(req===requestSerial)showError(error);}
  finally{$('resolve').disabled=false;}
}
async function makePlan(){
  if(!draft||!preview)return;
  const req=++requestSerial;
  const payload={...draft,selections:{groupA:collectSelections('groupA'),groupB:collectSelections('groupB')}};
  $('generate').disabled=true;
  setLoading('Tracing the common ground…','Inspecting independent Qloo rankings, then testing the combined taste signal.');
  try{
    const plan=await post('/api/plan',payload);
    if(req===requestSerial)renderPlan(plan);
  }catch(error){if(req===requestSerial)showError(error);}
  finally{$('generate').disabled=false;}
}
function goBack(){++requestSerial;stage('empty-state');$('group-a').focus();}
$('bridge-form').addEventListener('submit',event=>{event.preventDefault();checkMatches();});
$('generate').addEventListener('click',makePlan);
$('back-to-edit').addEventListener('click',goBack);
$('retry').addEventListener('click',goBack);
$('new-brief').addEventListener('click',goBack);
$('refine-seeds').addEventListener('click',goBack);
$('try-category').addEventListener('click',()=>{
  const next=$('try-category').dataset.category;
  if(!['movie','artist','book'].includes(next))return;
  $('category').value=next;
  goBack();
  $('category').focus();
});
$('export').addEventListener('click',async()=>{
  if(!latest)return;
  try{await navigator.clipboard.writeText(reportText(latest));$('export').textContent='Report copied ✓';}
  catch{$('export').textContent='Clipboard unavailable';}
});
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
  const p=presets[button.dataset.preset];
  $('group-a').value=p.a;$('group-b').value=p.b;$('category').value=p.category;
  draft=null;preview=null;latest=null;++requestSerial;stage('empty-state');
}));
for(const id of ['group-a','group-b','category','strategy']){
  $(id).addEventListener('change',()=>{if(!$('empty-state').hidden){return;}++requestSerial;preview=null;latest=null;stage('empty-state');});
}
fetch('/api/health').then(r=>r.json()).then(data=>{
  const badge=$('api-banner');
  if(badge.dataset.liveVerified==='true')return;
  badge.classList.add(data.qlooConfigured?'connected':'needs-key');
  $('api-message').textContent=data.qlooConfigured?'Qloo key present · live access not yet verified':'Qloo key not configured';
}).catch(()=>{$('api-message').textContent='Qloo connection status unavailable';});
