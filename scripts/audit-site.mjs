import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(join(root, 'public/index.html'), 'utf8');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const idSet = new Set(ids);
check(ids.length === idSet.size, 'Duplicate HTML IDs detected');
const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/g)].map(m => Number(m[1]));
check(headings.filter(n => n === 1).length === 1, 'Expected exactly one visible page H1');
check(/<main\b/.test(html), 'Missing main landmark');
check(/name="description"/.test(html), 'Missing meta description');
check(/<html lang="en"/.test(html), 'Missing HTML language');
for (const [, target] of html.matchAll(/<label\b[^>]*for="([^"]+)"/g)) {
  check(idSet.has(target), 'Label points to unknown input #' + target);
}
for (const [, described] of html.matchAll(/aria-describedby="([^"]+)"/g)) {
  for (const id of described.split(/\s+/)) check(idSet.has(id), 'Broken aria-describedby #' + id);
}
for (const [, anchor] of html.matchAll(/<a\b[^>]*href="#([^"]+)"/g)) {
  check(idSet.has(anchor), 'Broken in-page link #' + anchor);
}
const relativeAssets = [...new Set([
  ...[...html.matchAll(/<script\b[^>]*src="(\/[^"]+)"/g)].map(m => m[1]),
  ...[...html.matchAll(/<link\b[^>]*href="(\/[^"]+)"/g)].map(m => m[1]),
])];
const origin = (process.argv[2] || 'http://127.0.0.1:4177').replace(/\/$/, '');
let checked = 0;
for (const path of ['/', ...relativeAssets, '/api/health', '/api/readiness']) {
  try {
    const res = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(6000) });
    const expected = path === '/api/readiness' ? [200, 503] : [200];
    check(expected.includes(res.status), path + ' returned HTTP ' + res.status);
    if (path === '/') check((await res.text()).includes('culturebridge'), 'Homepage missing app identity');
    if (path === '/api/readiness') {
      const data = await res.json();
      console.log('Qloo key configured:', Boolean(data.qlooConfigured));
    }
    checked++;
  } catch (error) {
    errors.push(path + ': ' + (error?.message || String(error)));
  }
}
console.log('Verified', checked, 'HTTP routes/assets,', ids.length, 'unique IDs,', headings.length, 'headings, and local anchor/label references');
if (errors.length) {
  console.error(errors.map(e => 'FAIL: ' + e).join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: website structure and local routes');
}
