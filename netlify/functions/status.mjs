import { getStore } from '@netlify/blobs';
import { score, visibleStocks } from '../lib/core.mjs';
import seed from '../lib/seed.mjs';
export default async (req) => {
  if (req.method !== 'GET') return new Response('Method not allowed',{status:405});
  try {
    const store = getStore('beursrisico-monitor-v1');
    const state = await store.get('state',{type:'json',consistency:'strong'}) || {};
    const settings = await store.get('settings',{type:'json',consistency:'strong'}) || {};
    const adminChanges = await store.get('admin-changes',{type:'json',consistency:'strong'}) || [];
    const url = new URL(req.url);
    const month = url.searchParams.get('month');
    let articles = state.articles?.length ? state.articles : seed.articles;
    if(month && /^20\d\d-(0[1-9]|1[0-2])$/.test(month)) {
      articles = await store.get('archive/'+month,{type:'json',consistency:'strong'}) || articles.filter(a=>a.date.startsWith(month));
    }
    const stocks = (settings.stocks||seed.stocks).map(s=>({...s,computed:score(s,state.articles||seed.articles)}));
    return Response.json({live:state.lastScanSucceeded ?? !!state.lastSuccess, lastScan:state.lastScan||null,lastSuccess:state.lastSuccess||null,lastError:state.lastError||null, nextCoverageHours:Math.ceil(stocks.length/4), stocks, activeIds:visibleStocks({stocks},state.promoted||[]).map(s=>s.id),promoted:state.promoted||[],articles,changes:[...(state.changes||[]),...adminChanges].sort((a,b)=>new Date(b.date)-new Date(a.date)),months:state.months||[],sources:seed.sources,newsSource:'Google News RSS; GDELT DOC API als reserve. Geen redactionele verificatie.'},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
  } catch(e) { return Response.json({live:false,error:'Opslag tijdelijk onbeschikbaar: '+String(e.message||e),stocks:seed.stocks,articles:seed.articles,activeIds:seed.stocks.filter(x=>x.core).map(x=>x.id),changes:[],sources:seed.sources}); }
};
