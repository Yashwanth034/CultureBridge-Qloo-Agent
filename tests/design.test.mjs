import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const source=(path)=>readFile(join(root,path),'utf8');

test('redesigned page retains every control required by the real agent',async()=>{
  const html=await source('public/index.html');
  for(const id of ['bridge-form','group-a','group-b','category','strategy','generate',
    'results','result-title','result-subtitle','cards','explore-section','explore-cards',
    'warnings','trace','methodology','api-banner','api-message','export',
    'counterfactual','counterfactual-rows','trust','count']) {
    assert.match(html,new RegExp('id="'+id+'"'),'Missing '+id);
  }
  for(const link of ['href="#studio"','href="#process"']) assert.ok(html.includes(link));
  for(const value of ['value="movie"','value="artist"','value="book"','value="balanced"','value="discovery"']) assert.ok(html.includes(value));
  for(const ref of ['data-preset="cinema"','data-preset="music"','data-preset="books"']) assert.ok(html.includes(ref));
  assert.match(html,/<label for="group-a">/);
  assert.match(html,/<label for="group-b">/);
  assert.match(html,/<label[^>]*for="category">/);
  assert.match(html,/<label[^>]*for="strategy">/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/class="skip-link"/);
});

test('visual system includes mobile layout, accessible focus and reduced-motion fallback',async()=>{
  const css=await source('public/styles.css');
  assert.match(css,/@media\(max-width:730px\)/);
  assert.match(css,/@media\(max-width:420px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.match(css, /\.studio-workspace/);
  assert.match(css, /\.candidate/);
  assert.match(css, /\.verified-tag/);
  assert.match(css, /\.manifesto-section/);
});

test('page uses original CSS artwork and references public font endpoints without inline scripts',async()=>{
  const html=await source('public/index.html');
  assert.match(html,/class="record"/);
  assert.match(html,/class="paper-side paper-left"/);
  assert.match(html,/class="paper-side paper-right"/);
  assert.match(html,/fonts\.googleapis\.com/);
  assert.match(html,/<script src="\/app\.js" defer><\/script>/);
  assert.doesNotMatch(html,/<script(?![^>]+src=)[^>]*>/);
  const app=await source('public/app.js');
  assert.match(app,/textContent/);
  assert.doesNotMatch(app,/innerHTML\s*=/);
});
