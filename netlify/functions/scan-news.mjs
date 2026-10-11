import { getStore } from '@netlify/blobs';
import { eligibleToPromote, mergeArticles } from '../lib/core.mjs';
import seed from '../lib/seed.mjs';
import { collect } from '../lib/news.mjs';
export default async () => {
 const now = new Date().toISOString(); const store = getStore('beursrisico-monitor-v1');
 const state = await store.get('state',{type:'json',consistency:'strong'}) || {articles:seed.articles,cursor:0,promoted:[],changes:[],months:[]};
 const settings = await store.get('settings',{type:'json',consistency:'strong'}) || {};
 const stocks = settings.stocks || seed.stocks;
 const picked=Array.from({length:Math.min(4,stocks.length)},(_,i)=>stocks[((state.cursor||0)+i)%stocks.length]);
 const incoming=[]; const failures=[]; const sources=[];
 // Fetch all four in parallel: a slow or blocked provider does not stall the entire scan.
 const responses=await Promise.all(picked.map(async stock=>{
   try {const result=await collect(stock);return {stock,ok:true,...result};}
   catch(err){return {stock,ok:false,error:String(err.message||err).slice(0,180)};}
 }));
 for(const result of responses){
   if(result.ok){incoming.push(...result.articles);sources.push(result.stock.id+': '+result.source);}
   else failures.push(result.stock.id+': '+result.error);
 }
 const successful=responses.filter(x=>x.ok).length;
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
 const next={...state,articles:merged.slice(0,500),cursor:((state.cursor||0)+picked.length)%stocks.length,lastScan:now,lastScanSucceeded:successful>0,lastSuccess:successful>0?now:(state.lastSuccess||null),lastError:failures.length?failures.join('; '):null,months,changes:changes.slice(0,300),promoted:[...promoted]};
 // If the feed fails entirely, preserve previously saved articles, note error, and never fake new coverage.
 await store.setJSON('state',next);
 console.log(JSON.stringify({lastScan:now,checked:picked.map(s=>s.id),successful,added:incoming.length,sources,failures}));
};
export const config={schedule:'@hourly'};
