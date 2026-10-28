import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=path=>readFile(join(root,path),'utf8');
test('real two-stage app retains all form, review and results controls',async()=>{
  const html=await source('public/index.html');
  for(const id of ['bridge-form','group-a','group-b','category','strategy','resolve','match-review','review-a','review-b','generate',
    'empty-state','loading-state','results','result-title','result-subtitle','cards','explore-section','explore-cards',
    'warnings','trace','methodology','api-banner','api-message','export','featured','featured-bars',
    'counterfactual','counterfactual-rows','trust','count','error-state','retry','back-to-edit','new-brief',
    'no-overlap','no-overlap-title','no-overlap-copy','try-category','refine-seeds','shared-results','featured-anchors','featured-affinities','featured-contributions','cancel-request','jump-to-tastes']) {
    assert.match(html,new RegExp('id="'+id+'"'),'Missing '+id);
  }
  for(const value of ['value="movie"','value="artist"','value="book"','value="balanced"','value="discovery"']) assert.ok(html.includes(value));
  for(const ref of ['data-preset="cinema"','data-preset="music"','data-preset="books"']) assert.ok(html.includes(ref));
  for(const ref of ['group-a','group-b','category','strategy']) assert.match(html,new RegExp('<label[^>]*for="'+ref+'"'));
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/class="skip-link"/);
});
test('first screen prioritizes plain-language tasks without decorative arrows or redundant labels',async()=>{
  const html=await source('public/index.html');
  const js=await source('public/app.js');
  const css=await source('public/styles.css');
  assert.doesNotMatch(html,/[↗↶→←]/, 'decorative arrows do not belong on website buttons or links');
  assert.doesNotMatch(js,/el\('span','rank-arr','↗'\)/, 'ranked choices must not use redundant arrows');
  assert.doesNotMatch(html,/THE UNKNOWN IN BETWEEN|YOUR SIGNAL|THEIR SIGNAL|01 \/ 02|02 \/ 02/);
  assert.match(html,/id="taste-format-tip"/);
  assert.match(html,/aria-describedby="taste-format-tip"/);
  assert.match(html,/id="how"/);
  assert.match(css,/\.input-wrap label\{[^}]*font-size:1[4-9]px/);
  assert.match(css,/\.example-pill\{[^}]*font-size:1[4-9]px/);
});
test('responsive workspace has meaningful mobile layouts, focus, reduced motion',async()=>{
  const css=await source('public/styles.css');
  assert.match(css,/@media\(max-width:900px\)/);
  assert.match(css,/@media\(max-width:620px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/focus-visible/);
  assert.match(css,/\.taste-lab/);
  assert.match(css,/\.rank-item/);
  assert.match(css,/\.match-review/);
  assert.match(css,/\.taste-stage\{order:2;min-height:180px\}/);
  assert.match(css,/\.profile-b\{order:1\}/);
  assert.match(css,/\.intro-cta/);
  // Last mobile breakpoint must override the later desktop/tablet grid rule.
  assert.match(css,/\.lab-controls\{grid-template-columns:minmax\(0,1fr\);margin:3px 15px/);
  assert.match(css,/\.form-options\{grid-template-columns:minmax\(0,1fr\);gap:12px/);
});
test('app loads local behavior with no inline script or unsafe HTML',async()=>{
  const html=await source('public/index.html');
  const js=await source('public/app.js');
  assert.match(html,/<script src="\/app\.js" defer><\/script>/);
  assert.doesNotMatch(html,/<script(?![^>]+src=)[^>]*>/);
  assert.match(js,/textContent/);
  assert.doesNotMatch(js,/innerHTML\s*=/);
  assert.match(js,/\/api\/resolve/);
  assert.match(js,/\/api\/plan/);
  assert.match(js,/aria-pressed/);
  assert.match(js,/Exclude this taste/);
  assert.match(js,/select\.value\|\|null/);
  assert.match(js,/updateReviewEligibility/);
  assert.match(js,/scrollIntoView/);
  assert.match(js,/\$\('jump-to-tastes'\)\.addEventListener\('click'/);
  assert.match(js,/relative-rank fairness index/);
  assert.match(js,/affinity-disclaimer/);
  assert.match(js,/QLOO-REPORTED EVIDENCE/);
  assert.match(js,/Raw affinity values are provided by Qloo/);
  assert.match(js,/WHY QLOO SUGGESTED THIS/);
  assert.match(js,/normalized contributions/);
  assert.match(js,/dataset\.liveVerified/);
  assert.match(js,/Qloo live recommendations received/);
  assert.match(js,/AbortSignal\.timeout\(90000\)/);
  assert.match(js,/AbortSignal\.any\(/);
  assert.match(js,/activeController\?\.abort\(\)/);
  assert.match(js,/\$\('cancel-request'\)\.addEventListener\('click',goBack\)/);
  assert.match(js,/cultural search is taking too long/);
  assert.match(js,/culturebridge:phase/);
  assert.match(js,/culturebridge:selection/);
  const scene=await source('public/scene.js');
  assert.match(scene,/three@0\.181\.0/);
  assert.match(scene,/culturebridge:phase/);
  assert.match(scene,/culturebridge:selection/);
  assert.match(scene,/prefers-reduced-motion/);
  assert.match(scene,/scene-ready/);
  assert.match(html,/<canvas id="taste-canvas"/);
});
