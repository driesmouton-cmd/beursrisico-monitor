import { getStore } from '@netlify/blobs';
import seed from '../lib/seed.mjs';
export default async (req) => {
 if(req.method!=='POST') return new Response('Method not allowed',{status:405});
 const secret=process.env.MONITOR_ADMIN_TOKEN;
 if(!secret || req.headers.get('authorization')!==`Bearer ${secret}`) return Response.json({error:'Niet gemachtigd; stel MONITOR_ADMIN_TOKEN in bij Netlify.'},{status:403});
 let input;try{input=await req.json()}catch{return Response.json({error:'Ongeldige JSON'},{status:400})}
 if(!Array.isArray(input.stocks) || input.stocks.length<5 || input.stocks.length>75)return Response.json({error:'5–75 aandelen nodig.'},{status:400});
 const valid=input.stocks.every(s=>/^[A-Z0-9.\-]{1,14}$/.test(s.id||'')&&typeof s.name==='string'&&s.name.length<90&&['US','EU'].includes(s.region)&&['hoog','verhoogd','volgen','kandidaat'].includes(s.level)&&Array.isArray(s.drivers)&&typeof s.search==='string'&&s.search.length<200);
 if(!valid)return Response.json({error:'Ongeldige aandelendata'},{status:400});
 const store=getStore('beursrisico-monitor-v1');
 const oldSettings=await store.get('settings',{type:'json',consistency:'strong'})||{};
 const oldStocks=oldSettings.stocks||seed.stocks;
 const oldById=new Map(oldStocks.map(s=>[s.id,s]));
 const newById=new Map(input.stocks.map(s=>[s.id,s]));
 const changes=[]; const now=new Date().toISOString();
 for(const s of input.stocks){
   const old=oldById.get(s.id);
   if(!old)changes.push({date:now,stock:s.id,event:'Handmatig toegevoegd',reason:'Nieuwe onderneming toegevoegd aan kandidatenlijst / waaklijst.'});
   else if(old.level!==s.level||old.core!==s.core||old.reason!==s.reason||JSON.stringify(old.drivers)!==JSON.stringify(s.drivers))changes.push({date:now,stock:s.id,event:'Handmatig aangepast',reason:`Niveau: ${old.level} → ${s.level}; actieve kern: ${old.core?'ja':'nee'} → ${s.core?'ja':'nee'}.`});
 }
 for(const s of oldStocks)if(!newById.has(s.id))changes.push({date:now,stock:s.id,event:'Handmatig uit lijst gehaald',reason:'Niet langer opgenomen in bewakingsuniversum.'});
 await store.setJSON('settings',{stocks:input.stocks,updated:now});
 if(changes.length){const existing=await store.get('admin-changes',{type:'json',consistency:'strong'})||[];await store.setJSON('admin-changes',[...changes,...existing].slice(0,500));}
 return Response.json({ok:true,count:input.stocks.length,changes:changes.length});
};
