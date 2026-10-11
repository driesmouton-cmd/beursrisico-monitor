const RISK_TERMS = /\b(risk|crisis|warn|fear|plunge|slump|drop|miss|downgrade|debt|default|deficit|tariff|cut|selloff|downturn|fall|falls|weak|slowdown|probe|investigation|shock|war|sanction|higher costs|funding squeeze|bubble|volatil|loss|lawsuit|lawsuits|decline|recession|delay)\b/i;
const POS_TERMS = /\b(beat|beats|surge|rally|record|profit|profits|growth|strong|upgrade|rebound|recover|rise|rises|higher revenue|raises|outperform|optimism)\b/i;
export function classify(title = '') {
  const risk = RISK_TERMS.test(title), good = POS_TERMS.test(title);
  return risk && !good ? 'risico' : good && !risk ? 'positief' : 'gemengd';
}
export function score(stock, articles, now = Date.now()) {
  const relevant = articles.filter(x => x.stocks?.includes(stock.id) && now - new Date(x.date).getTime() < 14 * 864e5 && now >= new Date(x.date).getTime());
  const distinct = new Set(relevant.filter(a => a.direction==='risico').map(a=>a.domain)).size;
  const bad = relevant.filter(a=>a.direction==='risico').length;
  const base = stock.core ? ({hoog:3,verhoogd:2,volgen:1}[stock.level] ?? 1) : 0;
  const dynamic = Math.min(3, (bad>=2 ? 1:0) + (bad>=5 && distinct>=2 ? 1:0) + (bad>=9 && distinct>=3 ? 1:0));
  const points=base+dynamic; const level=points>=3&&base===3 || points>=4?'hoog':points>=2?'verhoogd':'volgen';
  return {base, dynamic, bad, sources:distinct, points, level};
}
export function eligibleToPromote(stock, articles, now = Date.now()) {
  if(stock.core) return false;
  const recent = articles.filter(a => a.stocks?.includes(stock.id) && a.direction==='risico' && now - new Date(a.date).getTime() < 7*864e5);
  return recent.length>=3 && new Set(recent.map(a=>a.domain)).size>=2;
}
export function normalizeGdeltArticle(a, stock) {
  if (!a || typeof a.url!=='string' || !/^https:\/\//i.test(a.url)) return null;
  const title = String(a.title||'').trim().slice(0,280);
  if(title.length < 16) return null;
  const url = a.url.slice(0,1600);
  let domain; try{domain = new URL(url).hostname.replace(/^www\./,'');}catch{return null;}
  const dateRaw = String(a.seendate||'');
  const date = /^\d{8}T\d{6}Z?$/.test(dateRaw) ? `${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}T${dateRaw.slice(9,11)}:${dateRaw.slice(11,13)}:${dateRaw.slice(13,15)}Z` : new Date().toISOString();
  const id = 'u-'+simpleHash(url);
  return {id,title,url,domain,date,stocks:[stock.id],topic:stock.drivers[0],direction:classify(title),seed:false,note:''};
}
export function simpleHash(s) { let h=2166136261; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)} return (h>>>0).toString(16); }
export function mergeArticles(oldList, newList) {
  const map = new Map();
  for(const a of [...oldList,...newList]) {
    const key = a.url||a.id;
    if(map.has(key)) {
      const prev=map.get(key); map.set(key,{...prev,...a,stocks:[...new Set([...(prev.stocks||[]),...(a.stocks||[])])]});
    } else map.set(key,{...a});
  }
  return [...map.values()].sort((a,b)=>new Date(b.date)-new Date(a.date));
}
export function visibleStocks(seed, promoted = []) {
  const current = new Set(promoted);
  return seed.stocks.filter(s=>s.core||current.has(s.id));
}
