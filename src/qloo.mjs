/** Qloo event keys stay on the server; no fabricated "live" data. */
export const QLOO_ORIGIN = 'https://hackathon.api.qloo.com';
const CATEGORIES = ['movie', 'artist', 'book'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class QlooError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'QlooError'; this.status = status; }
}
const toContributionScore=value=>{
  if(typeof value!=='number' || !Number.isFinite(value) || value<0 || value>1)return null;
  return value;
};
// Qloo's explainability is optional. Accept only unambiguous ID + normalized
// numeric score pairs; unknown response variants remain absent, never guessed.
export function extractContributions(explainability){
  const block=explainability?.['signal.interests.entities'];
  if(!block || typeof block!=='object')return [];
  const rows=[];
  const add=(id,score)=>{
    if(typeof id!=='string'||!UUID.test(id))return;
    const number=toContributionScore(score);
    if(number===null)return;
    rows.push({id:id.toLowerCase(),score:number});
  };
  if(Array.isArray(block)){
    for(const item of block){
      if(!item||typeof item!=='object'||Array.isArray(item))continue;
      add(item.entity_id||item.id,item.score??item.contribution);
    }
  }else{
    for(const [id,value] of Object.entries(block))add(id,value);
  }
  return [...new Map(rows.map(row=>[row.id,row])).values()].slice(0,8);
}
export function extractEntities(json) {
  const result = json && json.results;
  const rows = Array.isArray(result) ? result : result && Array.isArray(result.entities) ? result.entities : [];
  return rows.map((item) => {
    const id = String(item.entity_id || item.id || '').trim().toLowerCase();
    const name = String(item.name || '').trim();
    // Qloo's live Insights envelope uses type:"urn:entity" (generic)
    // and subtype:"urn:entity:movie" (actual output category). Normalize
    // both it and the older Search shapes, but reject conflicting categories.
    const rawTypes = [
      ...(Array.isArray(item.types) ? item.types : []),
      item.subtype,
      item.type
    ];
    const categories = [...new Set(rawTypes
      .filter((value) => typeof value === 'string')
      .map((value) => value.replace(/^urn:entity:/, ''))
      .filter((value) => CATEGORIES.includes(value)))];
    const type = categories.length === 1 ? categories[0] : null;
    if (!UUID.test(id) || !name) return null;
    const raw = item.query && item.query.affinity;
    // Qloo's numeric affinity is optional and must never be synthesised from
    // booleans, nulls or empty strings. We expose it as raw provider evidence,
    // not a percent or estimated chance of personal satisfaction.
    const numeric = typeof raw === 'number' ? raw :
      (typeof raw === 'string' && raw.trim() && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()) ? Number(raw) : null);
    return {id, name: name.slice(0, 120), type: CATEGORIES.includes(type) ? type : null,
      affinity: typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : null,
      contributions:extractContributions(item.query?.explainability)};
  }).filter(Boolean);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export class QlooClient {
  constructor({apiKey = process.env.QLOO_API_KEY, fetchImpl = globalThis.fetch, origin = QLOO_ORIGIN, minGapMs = 260} = {}) {
    this.apiKey = apiKey; this.fetchImpl = fetchImpl; this.origin = origin;
    this.minGapMs = minGapMs; this.cache = new Map(); this.inflight = new Map(); this.pending = Promise.resolve(); this.nextAt = 0;
  }
  async request(path, params) {
    if (!this.apiKey) throw new QlooError('Qloo live key is not configured on the server yet.', 503);
    const url = new URL(path, this.origin);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;
    // Concurrent requests for the same taste share an in-flight upstream call.
    // This prevents duplicate queue slots and duplicated failed retries.
    const inProgress=this.inflight.get(cacheKey);
    if(inProgress)return inProgress;
    const worker = async () => {
      const again = this.cache.get(cacheKey);
      if (again && again.expires > Date.now()) return again.data;
      const wait = Math.max(0, this.nextAt - Date.now());
      if (wait) await sleep(wait);
      for (let attempt = 0; attempt < 3; attempt++) {
        this.nextAt = Date.now() + this.minGapMs;
        let res;
        try { res = await this.fetchImpl(url, {headers: {'X-Api-Key': this.apiKey, Accept: 'application/json'}, signal: AbortSignal.timeout(9500)}); }
        catch {
          // Transient network resets happen during hosting-provider routing
          // changes. Retry a bounded number of times, but never expose the
          // transport exception or API key to the browser.
          if(attempt<2){await sleep(500*(attempt+1));continue;}
          throw new QlooError('Qloo connection timed out or was unavailable. Try again.',503);
        }
        if (res.status === 429 || res.status >= 500) {
          if (attempt < 2) {
            // Honor a short Retry-After for 429s if supplied. Cap the wait to
            // avoid a single slow request blocking the entire shared queue.
            const retryHeader=res.status===429?res.headers?.get?.('retry-after'):null;
            const seconds=typeof retryHeader==='string' && /^\d+(?:\.\d+)?$/.test(retryHeader.trim())?Number(retryHeader):null;
            const waitMs=Number.isFinite(seconds)?Math.min(5000,Math.max(0,seconds*1000)):800*(attempt+1);
            await sleep(waitMs);
            continue;
          }
          throw new QlooError('Qloo is rate limiting or temporarily unavailable.', 503);
        }
        if (!res.ok) {
          // Qloo /search explicitly documents HTTP 404 for zero matches.
          if (path === '/search' && res.status === 404) {
            const empty={success:true,results:{entities:[]}};
            if(this.cache.size>250)this.cache.clear();
            this.cache.set(cacheKey,{data:empty,expires:Date.now()+60*1000});
            return empty;
          }
          if ([401,403].includes(res.status)) throw new QlooError('Qloo rejected the event credential or this endpoint. Verify the key and event API origin.', 503);
          throw new QlooError('Qloo declined a query (HTTP ' + res.status + ').', 502);
        }
        let payload;
        try { payload = await res.json(); } catch { throw new QlooError('Qloo returned invalid JSON.'); }
        if (!payload || typeof payload !== 'object' || payload.success === false || !payload.results) throw new QlooError('Qloo returned an unsuccessful or unsupported response.');
        if (this.cache.size > 250) this.cache.clear();
        this.cache.set(cacheKey, {data: payload, expires: Date.now() + 10 * 60 * 1000});
        return payload;
      }
    };
    const p = this.pending.then(worker, worker);
    this.inflight.set(cacheKey,p);
    this.pending = p.catch(() => {});
    try{return await p;}
    finally{if(this.inflight.get(cacheKey)===p)this.inflight.delete(cacheKey);}
  }
  async search(query, type = null) {
    const term = String(query).trim();
    if (term.length < 2 || term.length > 100) throw new QlooError('Invalid seed name.', 400);
    if (type !== null && !CATEGORIES.includes(type)) throw new QlooError('Unsupported seed type.', 400);
    const payload = await this.request('/search', {query: term, types: type ? 'urn:entity:' + type : null, take: 8});
    return extractEntities(payload).filter((x) => !type || x.type === type || x.type === null);
  }
  async insights(type, seedIds, take = 40) {
    if (!CATEGORIES.includes(type)) throw new QlooError('Unsupported output category.', 400);
    if (!Array.isArray(seedIds) || !seedIds.length || seedIds.length > 8 || seedIds.some((id) => !UUID.test(id))) throw new QlooError('Qloo needs valid entity IDs.', 400);
    const ids = [...new Set(seedIds)].join(',');
    const payload = await this.request('/v2/insights', {
      'filter.type':'urn:entity:' + type, 'signal.interests.entities':ids,
      'filter.exclude.entities':ids, 'feature.explainability':'true', take
    });
    // A 200 response does not prove the requested Qloo output category was
    // honored. Never allow unknown/wrong entity types into ranked results.
    const entities=extractEntities(payload);
    const matching=entities.filter(x=>x.type===type);
    if(entities.length>0 && matching.length===0){
      // Keep the public error generic. Log only category metadata for diagnosing
      // provider schema changes, never names, entity IDs, request URLs or keys.
      const first=Array.isArray(payload?.results?.entities)?payload.results.entities[0]:null;
      console.warn('Qloo Insights category metadata',JSON.stringify({
        expected:type,
        parsedTypes:[...new Set(entities.map(item=>item.type??'untyped'))].slice(0,5),
        rawType:typeof first?.type==='string'?first.type.slice(0,90):null,
        rawTypes:Array.isArray(first?.types)?first.types.filter(x=>typeof x==='string').slice(0,5):null,
        subtype:typeof first?.subtype==='string'?first.subtype.slice(0,90):null,
        fields:first&&typeof first==='object'?Object.keys(first).filter(x=>!['query','entity_id','id','name'].includes(x)).slice(0,20):[]
      }));
      throw new QlooError('Qloo returned entities outside the requested '+type+' category. Check the event API response.',502);
    }
    return matching.slice(0,take);
  }
}
