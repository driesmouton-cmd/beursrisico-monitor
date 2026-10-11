import { getStore } from '@netlify/blobs';
import seed from '../lib/seed.mjs';
import { applySummaries, summarizeBatch } from '../lib/summaries.mjs';
import { mergeArticles } from '../lib/core.mjs';

/**
 * Separate scheduled function: Netlify Scheduled Functions have a hard 30s limit.
 * Do not add AI calls to scan-news, which must keep working independently.
 */
export default async () => {
  const now=new Date().toISOString();
  if(!process.env.OPENAI_API_KEY){
    console.log(JSON.stringify({summariesAdded:0,summaryConfigured:false,message:'OPENAI_API_KEY ontbreekt'}));
    return;
  }
  const store=getStore('beursrisico-monitor-v1');
  const state=await store.get('state',{type:'json',consistency:'strong'})||{};
  const settings=await store.get('settings',{type:'json',consistency:'strong'})||{};
  const stockNames=settings.stocks||seed.stocks;
  // A small bounded batch safely fits Netlify's 30s scheduled-function limit.
  const existing=state.articles||seed.articles;
  const result=await summarizeBatch(existing,stockNames,{limit:4,timeoutMs:10000});
  if(result.summaries.length){
    const enriched=applySummaries(existing,result.summaries);
    const touched=[...new Set(enriched.filter(a=>result.summaries.some(x=>x.id===a.id)).map(a=>a.date.slice(0,7)))];
    for(const month of touched){
      const archived=await store.get('archive/'+month,{type:'json',consistency:'strong'})||[];
      // New summary wins on duplicate URLs, old articles still preserved.
      await store.setJSON('archive/'+month,mergeArticles(archived,enriched.filter(a=>a.date.startsWith(month))));
    }
    // Refresh latest news. The offset half-hour schedule avoids races with news scan.
    await store.setJSON('state',{...state,articles:enriched,lastSummaryScan:now,lastSummaryError:result.failures[0]||null,lastSummariesAdded:result.summaries.length,months:[...new Set([...(state.months||[]),...touched])].sort().reverse()});
  } else {
    await store.setJSON('state',{...state,lastSummaryScan:now,lastSummaryError:result.failures[0]||null,lastSummariesAdded:0});
  }
  console.log(JSON.stringify({lastSummaryScan:now,summariesAdded:result.summaries.length,summaryConfigured:result.configured,summaryFailures:result.failures.length,examples:result.failures.slice(0,2)}));
};
export const config={schedule:'30 * * * *'};
