import { getStore } from '@netlify/blobs';
import { eligibleToPromote, mergeArticles, normalizeGdeltArticle } from '../lib/core.mjs';
import seed from '../lib/seed.mjs';
const delay = ms => new Promise(r=>setTimeout(r,ms));
async function collect(stock){
 const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc');
 // Company name in quotation marks, plus financial context; avoid ticker-only ambiguity.
 const name = stock.name.replace(/\b(Inc|Corp|SE|PLC|AG)\b\.?/g,'').trim();
 url.searchParams.set('query',`"${name}" (earnings OR stock OR shares OR profit OR debt OR revenue OR guidance OR investors OR outlook)`);
 url.searchParams.set('mode','artlist'); url.searchParams.set('format','json');url.searchParams.set('timespan','48h');url.searchParams.set('maxrecords','12');url.searchParams.set('sort','datedesc');
 const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),4500);
 try { const res=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'BeursrisicoMonitor/1.0 (risk research dashboard)'}}); if(!res.ok) throw Error('GDELT HTTP '+res.status);
 const data=await res.json(); return (data.articles||[]).map(x=>normalizeGdeltArticle(x,stock)).filter(Boolean).slice(0,8); }
 finally {clearTimeout(t)}
}
export default async () => {
 const now = new Date().toISOString(); const store = getStore('beursrisico-monitor-v1');
 const state = await store.get('state',{type:'json',consistency:'strong'}) || {articles:seed.articles,cursor:0,promoted:[],changes:[],months:[]};
 const settings = await store.get('settings',{type:'json',consistency:'strong'}) || {};
 const stocks = settings.stocks || seed.stocks;
 const picked=Array.from({length:Math.min(4,stocks.length)},(_,i)=>stocks[((state.cursor||0)+i)%stocks.length]);
 const incoming=[]; const failures=[];
 for(const stock of picked){
   try {incoming.push(...await collect(stock))} catch(err){failures.push(stock.id+': '+String(err.message||err).slice(0,100))}
   await delay(500);
 }
 const merged=mergeArticles(state.articles||seed.articles,incoming);
 // Persistent monthly archive; older posts remain accessible following redeploys.
 const touched=[...new Set(incoming.map(a=>a.date.slice(0,7)))];
 const months=[...new Set([...(state.months||[]),...touched])].sort().reverse();
 for (const month of touched){
   const existing=await store.get('archive/'+month,{type:'json',consistency:'strong'}) || [];
   const articlesForMonth=merged.filter(a=>a.date.startsWith(month));
   await store.setJSON('archive/'+month,mergeArticles(existing,articlesForMonth));
 }
 const promoted= new Set(state.promoted||[]);const changes=[...(state.changes||[])];
 for(const stock of stocks.filter(s=>!s.core)){
   const eligible=eligibleToPromote(stock,merged);
   if(eligible && !promoted.has(stock.id)) {promoted.add(stock.id);changes.unshift({date:now,stock:stock.id,event:'Geactiveerd als extra risicokandidaat',reason:'Ten minste 3 risico-artikelen van 2 verschillende domeinen in 7 dagen (heuristisch).'});}
   // A candidate returns to inactive if no adverse coverage in a month.
   if(!eligible && promoted.has(stock.id)) {
      const latest=merged.filter(a=>a.stocks?.includes(stock.id)&&a.direction==='risico').map(a=>new Date(a.date).getTime());
      if(!latest.length || Date.now()-Math.max(...latest)>30*864e5) {promoted.delete(stock.id); changes.unshift({date:now,stock:stock.id,event:'Terug naar kandidatenlijst',reason:'Geen negatief nieuwssignaal in de laatste 30 dagen.'});}
   }
 }
 const next={...state,articles:merged.slice(0,500),cursor:((state.cursor||0)+picked.length)%stocks.length,lastScan:now,lastSuccess:failures.length<picked.length?now:(state.lastSuccess||null),lastError:failures.length?failures.join('; '):null,months,changes:changes.slice(0,300),promoted:[...promoted]};
 // If the feed fails entirely, preserve previously saved articles, note error, and never fake new coverage.
 await store.setJSON('state',next);
 console.log(JSON.stringify({lastScan:now,checked:picked.map(s=>s.id),added:incoming.length,failures}));
};
export const config={schedule:'@hourly'};
