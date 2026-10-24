/** Qloo event keys stay on the server; no fabricated "live" data. */
export const QLOO_ORIGIN = 'https://hackathon.api.qloo.com';
const CATEGORIES = ['movie', 'artist', 'book'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class QlooError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'QlooError'; this.status = status; }
}
export function extractEntities(json) {
  const result = json && json.results;
  const rows = Array.isArray(result) ? result : result && Array.isArray(result.entities) ? result.entities : [];
  return rows.map((item) => {
    const id = String(item.entity_id || item.id || '').trim().toLowerCase();
    const name = String(item.name || '').trim();
    const types = Array.isArray(item.types) ? item.types : [];
    const type = CATEGORIES.find((t) => types.includes('urn:entity:' + t) || types.includes(t))
      || (typeof item.type === 'string' ? item.type.replace(/^urn:entity:/, '') : null);
    if (!UUID.test(id) || !name) return null;
    const raw = item.query && item.query.affinity;
    return {id, name: name.slice(0, 120), type: CATEGORIES.includes(type) ? type : null,
      affinity: raw !== null && raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : null};
  }).filter(Boolean);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export class QlooClient {
  constructor({apiKey = process.env.QLOO_API_KEY, fetchImpl = globalThis.fetch, origin = QLOO_ORIGIN, minGapMs = 260} = {}) {
    this.apiKey = apiKey; this.fetchImpl = fetchImpl; this.origin = origin;
    this.minGapMs = minGapMs; this.cache = new Map(); this.pending = Promise.resolve(); this.nextAt = 0;
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
    const worker = async () => {
      const again = this.cache.get(cacheKey);
      if (again && again.expires > Date.now()) return again.data;
      const wait = Math.max(0, this.nextAt - Date.now());
      if (wait) await sleep(wait);
      for (let attempt = 0; attempt < 3; attempt++) {
        this.nextAt = Date.now() + this.minGapMs;
        let res;
        try { res = await this.fetchImpl(url, {headers: {'X-Api-Key': this.apiKey, Accept: 'application/json'}, signal: AbortSignal.timeout(9500)}); }
        catch { throw new QlooError('Qloo connection timed out or was unavailable. Try again.'); }
        if (res.status === 429 || res.status >= 500) {
          if (attempt < 2) { await sleep(800 * (attempt + 1)); continue; }
          throw new QlooError('Qloo is rate limiting or temporarily unavailable.', 503);
        }
        if (!res.ok) {
          // Qloo /search explicitly documents HTTP 404 for zero matches.
          if (path === '/search' && res.status === 404) return {success:true,results:{entities:[]}};
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
    this.pending = p.catch(() => {});
    return p;
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
    return extractEntities(payload).filter((x) => !x.type || x.type === type).slice(0, take);
  }
}
