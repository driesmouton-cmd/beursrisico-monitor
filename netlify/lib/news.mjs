import { normalizeGdeltArticle, classify, simpleHash } from './core.mjs';

// Headlines are third-party, untrusted data. Rendering code must always escape HTML.
const decodeEntities = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#(x[0-9a-fA-F]+|[0-9]+);/g, (_, v) => {
    const n = v[0]?.toLowerCase() === 'x' ? parseInt(v.slice(1), 16) : parseInt(v, 10);
    return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  }).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, v) => ({ amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ' }[v]));
const tag = (item, name) => decodeEntities(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] || '').trim();
const sourceHost = item => {
  const attrs = item.match(/<source\s+[^>]*url="([^"]+)"[^>]*>/i)?.[1];
  try { return new URL(decodeEntities(attrs)).hostname.replace(/^www\./, ''); } catch { return 'news.google.com'; }
};

export function parseGoogleNewsRss(xml, stock, nowMs = Date.now()) {
  if (!/<rss\b/i.test(xml) || !/<channel>/i.test(xml)) throw new Error('Google News gaf geen geldige RSS-feed terug');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 25);
  const out = [];
  for (const [, item] of items) {
    const title = tag(item,'title').replace(/\s+[-–]\s+[^–-]{2,65}$/u,'').slice(0,280);
    const url = tag(item,'link').slice(0,1600);
    if (title.length < 16 || !/^https:\/\//i.test(url)) continue;
    const dateMs = Date.parse(tag(item,'pubDate'));
    if (!Number.isFinite(dateMs) || dateMs > nowMs + 4*3600e3 || dateMs < nowMs - 72*3600e3) continue;
    out.push({id:'g-'+simpleHash(url), title,url,domain:sourceHost(item),date:new Date(dateMs).toISOString(),stocks:[stock.id],topic:stock.drivers?.[0] || 'Bedrijfsnieuws',direction:classify(title),seed:false,note:'Via Google News RSS'});
  }
  return out.slice(0,8);
}

async function getText(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(),ms);
  try {
    const res = await fetch(url, {signal:ctrl.signal,headers:{'Accept':'application/rss+xml, application/xml, text/xml, application/json, */*'}});
    if (!res.ok) throw new Error('HTTP '+res.status);
    return await res.text();
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`time-out na ${ms/1000}s`);
    throw e;
  } finally { clearTimeout(timer); }
}

export async function collect(stock) {
  const name = stock.name.replace(/\b(Inc|Corp|SE|PLC|AG)\b\.?/g,'').trim();
  const google = new URL('https://news.google.com/rss/search');
  google.searchParams.set('q', `"${name}" (earnings OR shares OR stock OR profit OR revenue OR debt OR guidance) when:2d`);
  google.searchParams.set('hl','en-US');google.searchParams.set('gl','US');google.searchParams.set('ceid','US:en');
  let googleFailure = '';
  try {
    const xml = await getText(google,7500);
    return {articles:parseGoogleNewsRss(xml,stock),source:'Google News RSS'};
  } catch(e) {googleFailure=String(e.message||e);}
  const gdelt = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
  gdelt.searchParams.set('query', `"${name}" (earnings OR stock OR shares OR profit OR debt OR revenue OR guidance OR investors)`);
  gdelt.searchParams.set('mode','artlist');gdelt.searchParams.set('format','json');gdelt.searchParams.set('timespan','48h');gdelt.searchParams.set('maxrecords','12');gdelt.searchParams.set('sort','datedesc');
  try {
    const payload = await getText(gdelt,5000);
    const response = JSON.parse(payload);
    return {articles:(response.articles||[]).map(x=>normalizeGdeltArticle(x,stock)).filter(Boolean).slice(0,8),source:'GDELT (reservebron)'};
  } catch(e) {throw new Error(`Google News: ${googleFailure}; GDELT: ${String(e.message||e)}`);}
}
