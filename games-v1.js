/* LOVE RECORD · OUR LITTLE FARM v1
   Shared-owner cozy farming sim. Local simulation is independent of API.
   AI calls are event-driven and reuse the homepage API settings.
*/
(()=>{'use strict';
const KEY='lr-our-little-farm-v1';
const ACTIVE_KEY=KEY+'::active';
const ownerKey=id=>String(id||'solo');
const profileKey=id=>KEY+'::'+encodeURIComponent(ownerKey(id));
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const crops={
 carrot:{name:'胡萝卜',emoji:'🥕',cost:4,sell:10,time:35,desc:'脆甜的小可爱'},
 tomato:{name:'番茄',emoji:'🍅',cost:7,sell:17,time:55,desc:'阳光的味道'},
 strawberry:{name:'草莓',emoji:'🍓',cost:10,sell:25,time:75,desc:'甜甜的春日果实'},
 lettuce:{name:'生菜',emoji:'🥬',cost:3,sell:8,time:25,desc:'清爽又好种'},
 pumpkin:{name:'南瓜',emoji:'🎃',cost:15,sell:38,time:110,desc:'秋日丰收明星'},
 flower:{name:'雏菊',emoji:'🌼',cost:8,sell:20,time:60,desc:'可以做成小花束'}
};
const defaults=(ownerId='')=>({version:4,ownerId:String(ownerId||''),createdAt:Date.now(),lastCalendarAt:Date.now(),coins:120,level:1,xp:0,season:'春',day:1,plots:Array.from({length:9},(_,i)=>({id:i,crop:'',plantedAt:0,readyAt:0,watered:false})),inventory:{seed_carrot:12,seed_tomato:5,seed_lettuce:5},unlocked:['carrot','tomato','lettuce'],log:[],lastVisit:Date.now(),partnerId:String(ownerId||''),partnerName:'',partnerAvatar:'',partnerLastAction:0,decor:[],daily:{date:'',done:[]},stats:{harvests:0,planted:0,sold:0,pondVisits:0,coopVisits:0},dailyProgress:{date:'',planted:0,harvested:0,watered:0,shopVisits:0,facilityVisits:0,sold:0,eggsCollected:0,teas:0,roomsVisited:0,eventsClaimed:0},achievementClaims:[],animals:{chickens:0,lastEggAt:Date.now()},buildings:{pond:false,cottage:false,coop:false},house:{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0,currentRoom:'living',rooms:{living:true,bedroom:true,kitchen:true,balcony:true},roomsVisited:[],decorMode:false,furnitureInventory:{},placed:{living:[],bedroom:[],kitchen:[],balcony:[]}},world:{weather:'晴',weatherDate:'',festivalDate:'',pendingEvent:null,lastEventDay:0},story:{chapter:0,flags:[],partnerActionAt:0,generated:[],lastGenerated:null},crafted:{bouquet:0,jam:0},achievements:[],quest:{date:'',claimed:[]}});
function readStore(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:null}catch{return null}}
function people(){try{return typeof window.__LOVE_RECORD_GET_PEOPLE==='function'?(window.__LOVE_RECORD_GET_PEOPLE()||[]):[]}catch{return[]}}
function personFor(id){return people().find(x=>String(x.id)===String(id))}
function getInitialOwner(){
 try{const active=localStorage.getItem(ACTIVE_KEY);if(active!==null)return String(active)}catch{}
 const legacy=readStore(KEY);return String(legacy?.ownerId||legacy?.partnerId||'');
}
function normalizeFarm(data,id){
 const d={...defaults(id),...(data||{})};d.ownerId=ownerKey(id);d.partnerId=ownerKey(id)==='solo'?'':ownerKey(id);
 d.plots=Array.isArray(d.plots)&&d.plots.length?d.plots:defaults(id).plots;
 d.inventory={...defaults(id).inventory,...(d.inventory||{})};d.stats={...defaults(id).stats,...(d.stats||{})};d.dailyProgress={...defaults(id).dailyProgress,...(d.dailyProgress||{})};d.achievementClaims=Array.isArray(d.achievementClaims)?d.achievementClaims:[];
 d.animals={...defaults(id).animals,...(d.animals||{})};d.buildings={...defaults(id).buildings,...(d.buildings||{})};
 d.crafted={...defaults(id).crafted,...(d.crafted||{})};d.house={...defaults(id).house,...(d.house||{})};d.house.rooms={...defaults(id).house.rooms,...(d.house.rooms||{})};d.house.roomsVisited=Array.isArray(d.house.roomsVisited)?d.house.roomsVisited:[];d.house.furnitureInventory={...(d.house.furnitureInventory||{})};d.house.placed={...defaults(id).house.placed,...(d.house.placed||{})};d.world={...defaults(id).world,...(d.world||{})};d.story={...defaults(id).story,...(d.story||{})};d.story.flags=Array.isArray(d.story.flags)?d.story.flags:[];d.story.generated=Array.isArray(d.story.generated)?d.story.generated:[];d.story.lastGenerated=d.story.lastGenerated||null;d.achievements=Array.isArray(d.achievements)?d.achievements:[];
 d.quest={...defaults(id).quest,...(d.quest||{})};d.weekly={date:'',planted:0,harvested:0,claimed:false,...(d.weekly||{})};d.dailyProgress={...defaults(id).dailyProgress,...(d.dailyProgress||{})};d.unlocked=Array.isArray(d.unlocked)?d.unlocked:defaults(id).unlocked;d.log=Array.isArray(d.log)?d.log:[];return d;
}
function loadOwner(ownerId){
 const id=String(ownerId||''),stored=readStore(profileKey(id));if(stored)return normalizeFarm(stored,id);
 const legacy=readStore(KEY);if(legacy){const legacyOwner=String(legacy.ownerId||legacy.partnerId||'');if(legacyOwner===id||(!legacyOwner&&!id))return normalizeFarm(legacy,id)}
 const p=personFor(id);return normalizeFarm({partnerName:p?.remark||p?.name||'',partnerAvatar:p?.avatar||''},id);
}
const DB_NAME='lr-farm-save-db-v5',DB_VERSION=1,DB_STORE='profiles';let dbPromise=null,saveChain=Promise.resolve(),saveError='';
function openFarmDB(){
 if(!('indexedDB' in window))return Promise.reject(new Error('当前浏览器不支持 IndexedDB'));
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  let req;try{req=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){reject(e);return}
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE,{keyPath:'id'})};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();dbPromise=null};resolve(db)};
  req.onerror=()=>{dbPromise=null;reject(req.error||new Error('IndexedDB 打开失败'))};
  req.onblocked=()=>{dbPromise=null;reject(new Error('数据库被旧页面占用，请关闭其他 LOVE RECORD 页面后重试'))};
 });return dbPromise;
}
function idbGet(id){return openFarmDB().then(db=>new Promise((resolve,reject)=>{let tx;try{tx=db.transaction(DB_STORE,'readonly');const r=tx.objectStore(DB_STORE).get(ownerKey(id));r.onsuccess=()=>resolve(r.result?.data||null);r.onerror=()=>reject(r.error||new Error('读取农场存档失败'));}catch(e){reject(e)}}))}
function legacyIdbGet(id){return new Promise(resolve=>{
 if(!('indexedDB' in window)){resolve(null);return}let req;try{req=indexedDB.open('lr-farm-save-db')}catch(_){resolve(null);return}
 req.onupgradeneeded=e=>{if(e.oldVersion===0){try{req.transaction.abort()}catch(_){} }};
 req.onerror=()=>resolve(null);req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('farms')){db.close();resolve(null);return}try{const tx=db.transaction('farms','readonly');let r=tx.objectStore('farms').get(String(id||''));r.onsuccess=()=>{const value=r.result?.data||null;db.close();resolve(value)};r.onerror=()=>{db.close();resolve(null)}}catch(_){db.close();resolve(null)}};
 })}
function idbPut(id,data){return openFarmDB().then(db=>new Promise((resolve,reject)=>{let tx;try{tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put({id:ownerKey(id),data,updatedAt:Date.now()});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error('IndexedDB 写入失败'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB 写入事务中断'));}catch(e){reject(e)}}))}
function farmProgressScore(d){
 if(!d||typeof d!=='object')return -1;
 const st=d.stats||{},plots=Array.isArray(d.plots)?d.plots:[],build=d.buildings||{},house=d.house||{},placed=house.placed||{},story=d.story||{};
 const plantedPlots=plots.filter(p=>p&&p.crop).length;
 const furniture=Object.values(placed).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);
 const inventory=Object.values(d.inventory||{}).reduce((n,v)=>n+(Number(v)||0),0);
 return (Number(d.coins)||0)+(Number(d.level)||1)*150+(Number(d.xp)||0)
  +(Number(st.harvests)||0)*40+(Number(st.planted)||0)*8+(Number(st.sold)||0)*5
  +Object.values(build).filter(Boolean).length*65+(Number(story.chapter)||0)*100
  +plantedPlots*18+(Number(d.animals?.chickens)||0)*22+furniture*12
  +(Number(house.visited)||0)*2+inventory;
}
async function hydrateOwner(id){
 const key=ownerKey(id);let readError=null,current=null;storageReadOnly=false;
 try{current=await idbGet(key)}catch(e){readError=e;storageReadOnly=true;console.error('[Farm] IndexedDB read failed; searching backups without overwriting the database:',e)}
 const candidates=[];
 const localProfile=readStore(profileKey(key));if(localProfile)candidates.push({source:'local profile backup',data:localProfile});
 // Recover from the previous database and legacy key even when the current DB contains a newly-created default profile.
 try{const oldDbData=await legacyIdbGet(key==='solo'?'':key);if(oldDbData)candidates.push({source:'legacy IndexedDB',data:oldDbData})}catch(_){}
 const legacy=readStore(KEY);
 if(legacy&&ownerKey(legacy.ownerId||legacy.partnerId)===key)candidates.push({source:'legacy localStorage',data:legacy});
 let chosen=current?normalizeFarm(current,key):null,chosenSource='current IndexedDB';
 let chosenScore=chosen?farmProgressScore(chosen):-1;
 for(const c of candidates){const candidate=normalizeFarm(c.data,key),score=farmProgressScore(candidate);if(score>chosenScore+25){chosen=candidate;chosenScore=score;chosenSource=c.source}}
 if(chosen){
  const recovered=chosenSource!=='current IndexedDB';
  if(recovered){console.warn('[Farm] recovered a more complete save from',chosenSource);chosen.log=Array.isArray(chosen.log)?chosen.log:[];chosen.log.unshift({id:Date.now(),text:'已找回一份较完整的农场备份。',kind:'note',at:Date.now()});chosen.log=chosen.log.slice(0,40)}
  try{localStorage.setItem(profileKey(key),JSON.stringify(chosen))}catch(_){}
  if(!readError){try{await idbPut(key,chosen)}catch(e){storageReadOnly=true;console.warn('[Farm] save restore write failed; keeping local backup:',e)}}
  return chosen;
 }
 // A read error is never interpreted as an empty database. Do not create defaults over a possibly recoverable record.
 if(readError)throw new Error('农场数据库暂时无法读取。为保护旧存档，已停止创建新农场；请关闭其他 LOVE RECORD 页面后重试。');
 const person=personFor(key);const fresh=normalizeFarm({partnerName:person?.remark||person?.name||'',partnerAvatar:person?.avatar||''},key);
 try{await idbPut(key,fresh)}catch(e){storageReadOnly=true;console.warn('[Farm] initial save:',e)}
 try{localStorage.setItem(profileKey(key),JSON.stringify(fresh))}catch(e){console.warn('[Farm] initial local backup:',e)}
 return fresh;
}

let rescueCandidates=[],rescueScanBusy=false,rescueScanError='';
function rescueSummary(d){
 const st=d?.stats||{},plots=Array.isArray(d?.plots)?d.plots:[],inv=d?.inventory||{},build=d?.buildings||{};
 return {
  coins:Number(d?.coins)||0,level:Number(d?.level)||1,xp:Number(d?.xp)||0,
  harvests:Number(st.harvests)||0,planted:Number(st.planted)||0,
  crops:plots.filter(p=>p&&p.crop).length,
  harvestedCrops:Object.entries(inv).filter(([k,v])=>!String(k).startsWith('seed_')&&Number(v)>0).reduce((n,[,v])=>n+Number(v),0),
  chickens:Number(d?.animals?.chickens)||0,buildings:Object.values(build).filter(Boolean).length,
  updatedAt:Number(d?.lastVisit||d?.updatedAt||d?.savedAt||0)
 };
}
function looksLikeFarmData(v){
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const d=v.data&&typeof v.data==='object'?v.data:v;
 return ('coins'in d||'plots'in d||'inventory'in d)&&('stats'in d||'level'in d||'buildings'in d);
}

function addRescueCandidate(list,source,raw,ownerHint=''){
 const seen=new WeakSet();
 function walk(value,path,depth,owner){
  if(depth>6||value==null)return;
  let obj=value;
  if(typeof obj==='string'){
   const s=obj.trim();
   if((s.startsWith('{')&&s.endsWith('}'))||(s.startsWith('[')&&s.endsWith(']'))){
    try{obj=JSON.parse(s)}catch(_){return}
   }else return;
  }
  if(typeof obj!=='object')return;
  if(seen.has(obj))return;seen.add(obj);
  if(looksLikeFarmData(obj)){
   const data=obj.data&&typeof obj.data==='object'?obj.data:obj;
   const resolvedOwner=String(data.ownerId||data.partnerId||owner||ownerHint||'solo');
   const sig=resolvedOwner+'|'+(Number(data.lastVisit||data.updatedAt||data.savedAt)||0)+'|'+(Number(data.coins)||0)+'|'+(Array.isArray(data.plots)?data.plots.length:0)+'|'+path;
   if(!list.some(x=>x.sig===sig)){
    list.push({source:path,owner:resolvedOwner,data,summary:rescueSummary(data),score:farmProgressScore(data),sig});
   }
  }
  if(Array.isArray(obj)){obj.forEach((v,i)=>walk(v,`${path} → [${i}]`,depth+1,owner));return;}
  for(const [k,v] of Object.entries(obj)){
   if(['__proto__','prototype','constructor'].includes(k))continue;
   const nextOwner=(/^(id|ownerId|partnerId|profileId)$/i.test(k)&&typeof v==='string')?v:owner;
   walk(v,`${path} → ${k}`,depth+1,nextOwner);
  }
 }
 walk(raw,source,0,ownerHint);
}
async function readAllFromDatabase(dbName){
 return new Promise(resolve=>{
  let req;try{req=indexedDB.open(dbName)}catch(_){resolve([]);return}
  req.onerror=()=>resolve([]);
  req.onblocked=()=>resolve([]);
  req.onsuccess=()=>{
   const db=req.result,stores=[...db.objectStoreNames],out=[];
   if(!stores.length){db.close();resolve(out);return}
   let remaining=stores.length;
   for(const store of stores){
    try{
     const tx=db.transaction(store,'readonly'),r=tx.objectStore(store).getAll();
     r.onsuccess=()=>{(r.result||[]).forEach((row,i)=>addRescueCandidate(out,`IndexedDB · ${dbName}/${store} · ${i+1}`,row,row?.id||''));if(--remaining===0){db.close();resolve(out)}};
     r.onerror=()=>{if(--remaining===0){db.close();resolve(out)}};
    }catch(_){if(--remaining===0){db.close();resolve(out)}}
   }
  };
 });
}

async function scanFarmArchives(){
 rescueScanBusy=true;rescueScanError='';rescueCandidates=[];render();
 const found=[];
 try{
  // Scan every database exposed by this origin. Do not filter by name:
  // older versions may have used unrelated database names.
  let dbNames=[];
  try{
   if(typeof indexedDB.databases==='function'){
    const listed=await indexedDB.databases();
    dbNames=(listed||[]).map(x=>x&&x.name).filter(Boolean);
   }else{
    rescueScanError='当前浏览器不支持列出全部 IndexedDB 数据库；已扫描可访问的本地备份，但数据库历史记录可能不完整。';
   }
  }catch(e){rescueScanError='读取数据库清单失败：'+(e?.message||String(e))}
  dbNames=[...new Set(dbNames)];
  const dbResults=await Promise.all(dbNames.map(readAllFromDatabase));
  dbResults.flat().forEach(x=>found.push(x));
  try{
   for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key)continue;
    try{
     const value=localStorage.getItem(key);
     if(value!=null)addRescueCandidate(found,`localStorage · ${key}`,value,key.includes('::')?decodeURIComponent(key.split('::').slice(1).join('::')):'');
    }catch(_){}
   }
  }catch(e){rescueScanError=(rescueScanError?rescueScanError+'；':'')+'localStorage 扫描受限：'+(e?.message||String(e))}
  try{
   for(let i=0;i<sessionStorage.length;i++){
    const key=sessionStorage.key(i);if(!key)continue;
    try{addRescueCandidate(found,`sessionStorage · ${key}`,sessionStorage.getItem(key))}catch(_){}
   }
  }catch(_){}
  rescueCandidates=found.sort((a,b)=>b.score-a.score||b.summary.updatedAt-a.summary.updatedAt);
  if(!rescueCandidates.length){
   rescueScanError=(rescueScanError?rescueScanError+'；':'')+'没有在当前网站来源可访问的 IndexedDB、localStorage 或 sessionStorage 中找到可识别的农场存档。扫描没有修改任何数据。';
  }else{
   rescueScanError=(rescueScanError?rescueScanError+'；':'')+`本次已检查当前网站来源的 ${dbNames.length} 个 IndexedDB 数据库及本地/会话存储。不同浏览器来源（域名或协议）之间的数据无法互相读取。`;
  }
 }catch(e){rescueScanError='扫描遇到问题：'+(e?.message||String(e))}
 finally{rescueScanBusy=false;render()}
 return rescueCandidates;
}
async function restoreFarmArchive(index){
 const item=rescueCandidates[Number(index)];if(!item){toast('请先选择一份存档');return}
 if(!confirm(`确定将这份存档恢复到当前联系人「${farm?.partnerName||activeOwnerId||'当前农场'}」吗？\\n\\n来源：${item.source}\\n金币：${item.summary.coins} · 等级：${item.summary.level}\\n\\n恢复前会先备份当前农场，不会删除扫描到的原始存档。`))return;
 try{
  // Preserve the currently visible farm before restoring anything.
  const before= farm?JSON.parse(JSON.stringify(farm)):null;
  if(before){
   const backupKey=KEY+'::rescue-before-'+Date.now()+'::'+encodeURIComponent(ownerKey(activeOwnerId));
   localStorage.setItem(backupKey,JSON.stringify(before));
  }
  // Preserve the selected source too, especially when it lives in the same IndexedDB row that will be replaced.\n  localStorage.setItem(KEY+'::rescue-source-'+Date.now()+'::'+encodeURIComponent(item.owner),JSON.stringify(item.data));\n  const restored=normalizeFarm(item.data,ownerKey(activeOwnerId));
  restored.ownerId=ownerKey(activeOwnerId);
  restored.partnerId=ownerKey(activeOwnerId)==='solo'?'':ownerKey(activeOwnerId);
  restored.log=Array.isArray(restored.log)?restored.log:[];
  restored.log.unshift({id:Date.now(),text:`已从存档急救中心恢复备份（${item.source}）。`,kind:'note',at:Date.now()});
  farm=restored;
  // Synchronously keep a local copy first, then write IndexedDB.
  localStorage.setItem(profileKey(ownerKey(activeOwnerId)),JSON.stringify(restored));
  storageBlocked=false;storageReadOnly=false;
  await idbPut(ownerKey(activeOwnerId),restored);
  saveError='';
  view='farm';toast('农场存档恢复成功！原始候选备份仍保留');render();
 }catch(e){
  storageBlocked=true;saveError=e?.message||String(e);
  toast('恢复写入失败；原始候选存档没有删除');
  console.error('[Farm rescue] restore failed',e);view='rescue';render();
 }
}
function rescueView(){
 const rows=rescueCandidates.map((x,i)=>`<section class="gcard"><div class="grow" style="justify-content:space-between"><b>候选存档 ${i+1}</b><span class="gmuted">${esc(x.owner)}</span></div><p class="gmuted" style="word-break:break-all">${esc(x.source)}</p><div class="gstats"><div class="gstat"><b>🪙 ${x.summary.coins}</b>金币</div><div class="gstat"><b>⭐ ${x.summary.level}</b>等级</div><div class="gstat"><b>🌾 ${x.summary.harvests}</b>收获</div></div><p class="gmuted">经验 ${x.summary.xp} · 已种植 ${x.summary.planted} · 土地上作物 ${x.summary.crops} · 库存作物 ${x.summary.harvestedCrops} · 小鸡 ${x.summary.chickens} · 设施 ${x.summary.buildings}</p><p class="gmuted">存档时间：${x.summary.updatedAt?new Date(x.summary.updatedAt).toLocaleString():'未记录'}</p><button class="primary" data-rescue-restore="${i}">恢复到当前联系人</button></section>`).join('');
 return `<section class="gcard"><div class="grow" style="justify-content:space-between"><b>🛟 农场存档急救中心</b><button data-view="farm">返回农场</button></div><p class="gmuted">扫描当前网站来源下全部可枚举 IndexedDB 数据库、localStorage 与 sessionStorage，并递归检查嵌套备份。扫描只读取，不会自动覆盖、删除或初始化任何存档。</p><button class="primary" data-action="rescue-scan" ${rescueScanBusy?'disabled':''}>${rescueScanBusy?'正在扫描…':'重新扫描所有存档'}</button>${rescueScanError?`<div class="gnotice">${esc(rescueScanError)}</div>`:''}<p class="gmuted">找到 ${rescueCandidates.length} 份候选存档。请根据金币、等级、收获和存档时间选择，不要只看排序。</p>${rows||'<div class="gnotice">尚未扫描，或没有找到可识别的备份。</div>'}</section>`;
}

async function save(){
 const owner=ownerKey(activeOwnerId);
 if(storageBlocked){saveError='存档读取尚未恢复，为保护旧数据已暂停写入';return Promise.resolve(false)}
 farm=normalizeFarm(farm,owner);farm.lastVisit=Date.now();const snap=JSON.parse(JSON.stringify(farm));
 // Write the compact local backup synchronously BEFORE awaiting IndexedDB.
 // Android Chrome may freeze a background tab before an async transaction settles.
 let localOk=false;const errors=[];
 try{localStorage.setItem(profileKey(owner),JSON.stringify(snap));localOk=true}catch(e){errors.push('本地备份 '+(e?.name||e?.message||'失败'));console.error('[Farm] synchronous local backup failed',e)}
 try{localStorage.setItem(ACTIVE_KEY,owner)}catch(e){errors.push('活动联系人标记 '+(e?.name||'失败'))}
 saveChain=saveChain.catch(()=>false).then(async()=>{
  let idbOk=false;
  if(!storageReadOnly){try{await idbPut(owner,snap);idbOk=true}catch(e){storageReadOnly=true;errors.push('数据库 '+(e?.name||e?.message||'失败'));console.error('[Farm] IndexedDB save failed',e)}}
  if(idbOk||localOk){saveError='';return true}
  saveError=errors.join('；')||'未知存储错误';console.error('[Farm] all save methods failed:',saveError);toast('存档失败：'+saveError+'。请勿清除网站数据。');return false;
 });return saveChain;
}
let activeOwnerId=getInitialOwner();
let farm=loadOwner(activeOwnerId),view='farm',selectedSeed='carrot',busy=false,apiMessage='',switchingOwner=false,storageReadOnly=false,storageBlocked=false;
function cfg(){let s={};try{s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}')||{}}catch{};return {base:String((typeof state!=='undefined'&&state.apiBase)||s.apiBase||document.querySelector('#apiBase')?.value||'').trim().replace(/\/+$/,''),key:String((typeof state!=='undefined'&&state.apiKey)||s.apiKey||document.querySelector('#apiKey')?.value||'').trim(),model:String((typeof state!=='undefined'&&state.apiModel)||s.apiModel||document.querySelector('#apiModel')?.value||'').trim()}}
function addLog(text,kind='note'){farm.log.unshift({id:Date.now()+Math.random(),text,kind,at:Date.now()});farm.log=farm.log.slice(0,40)}
function toast(s){const n=$('#farmToast');if(n){n.textContent=s;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),1800)}}
function mature(p){return !!p.crop&&Date.now()>=p.readyAt}
function remaining(p){return Math.max(0,Math.ceil((p.readyAt-Date.now())/1000))}
function fmt(sec){const m=Math.floor(sec/60),s=sec%60;return m?`${m}分${s?`${s}秒`:''}`:`${s}秒`}
const dailyTaskDefs=[
 {id:'plant',label:'播下一颗种子',detail:'让菜园继续长大',reward:15,done:d=>d.planted>=1},
 {id:'harvest',label:'收获一份作物',detail:'把成熟的心意收进仓库',reward:25,done:d=>d.harvested>=1},
 {id:'water',label:'给作物浇一次水',detail:'照顾正在成长的小苗',reward:12,done:d=>d.watered>=1},
 {id:'shop',label:'逛逛农场商店',detail:'看看今天有什么新东西',reward:10,done:d=>d.shopVisits>=1},
 {id:'facility',label:'拜访一处农场设施',detail:'去小屋、小鸡窝或池塘看看',reward:15,done:d=>d.facilityVisits>=1},
 {id:'sell',label:'出售一件收获',detail:'把劳动成果换成金币',reward:15,done:d=>d.sold>=1},
 {id:'egg',get label(){return (farm.animals.chickens||0)>0?'从小鸡窝收集鸡蛋':'在小屋泡一杯热茶'},detail:'照顾农场伙伴，也照顾自己的心情',reward:20,done:d=>d.eggsCollected>=1||(!(farm.animals.chickens||0)&&d.teas>=1)},
 {id:'room',label:'拜访家里的一个房间',detail:'在客厅、卧室、厨房或阳台停留片刻',reward:12,done:d=>d.roomsVisited>=1},
 {id:'event',label:'参与一次农场小事件',detail:'收下天气或节日带来的惊喜',reward:18,done:d=>d.eventsClaimed>=1}
];
function ensureDailyProgress(){const today=localDateKey();ensureWeekly();if(!farm.dailyProgress||farm.dailyProgress.date!==today){farm.dailyProgress={date:today,planted:0,harvested:0,watered:0,shopVisits:0,facilityVisits:0,sold:0,eggsCollected:0,teas:0,roomsVisited:0,eventsClaimed:0};farm.quest={date:today,claimed:[]};save();}else if(!farm.quest||farm.quest.date!==today){farm.quest={date:today,claimed:[]};save();}}
function achievementDefs(){return [
 ['plant-1','初次播种','第一次把种子种进土地',farm.stats.planted>=1,20],['plant-10','勤劳园丁','累计播种 10 次',farm.stats.planted>=10,45],['plant-50','播种达人','累计播种 50 次',farm.stats.planted>=50,120],
 ['harvest-1','第一份收成','第一次收获作物',farm.stats.harvests>=1,25],['harvest-10','丰收季节','累计收获 10 份作物',farm.stats.harvests>=10,65],['harvest-30','金色麦田','累计收获 30 份作物',farm.stats.harvests>=30,150],
 ['sell-10','小小生意人','累计出售 10 件物品',farm.stats.sold>=10,50],['sell-50','集市常客','累计出售 50 件物品',farm.stats.sold>=50,130],
 ['build-all','农场规划师','建成小屋、小鸡窝和池塘',!!farm.buildings.cottage&&!!farm.buildings.coop&&!!farm.buildings.pond,120],
 ['chicken-1','咯咯伙伴','领养第一只小鸡',(farm.animals.chickens||0)>=1,30],['tea-5','午后茶时光','在小屋泡茶 5 次',(farm.house?.teas||0)>=5,35],['pond-5','池塘访客','拜访池塘 5 次',(farm.stats.pondVisits||0)>=5,45],['coop-5','鸡舍管理员','拜访小鸡窝 5 次',(farm.stats.coopVisits||0)>=5,45],['level-5','农场新星','农场达到 5 级',farm.level>=5,150],
 ['room-tour','家的探索者','拜访过卧室、厨房和阳台',['bedroom','kitchen','balcony'].every(r=>(farm.house?.roomsVisited||[]).includes(r)),55],
 ['decor-first','家的布置师','第一次购买家具',Object.values(farm.house?.furnitureInventory||{}).some(n=>n>0)||Object.values(farm.house?.placed||{}).some(a=>a.length>0),45],
 ['festival-first','节日来客','参加一次季节庆典',(farm.world?.festivalClaims||[]).length>=1,65],
 ['story-two','共同回忆','完成两章共同故事',(farm.story?.chapter||0)>=2,80]
 ];}
const furnitureCatalog=[
 {id:'bed',name:'奶油双人床',room:'bedroom',price:120,svg:'<svg viewBox="0 0 100 70"><path d="M8 37 50 16 92 37 50 59Z" fill="#b98e6b"/><path d="M14 34 50 15 86 33 50 52Z" fill="#f5e8d6" stroke="#c9ad8e" stroke-width="3"/><path d="M18 34 50 19 50 43 18 58Z" fill="#d9b8a2"/><path d="M50 19 82 34 82 58 50 43Z" fill="#fff5e7"/><path d="M23 31 38 24 50 30 35 37Z" fill="#fffdf7"/><path d="M50 30 65 23 78 30 63 37Z" fill="#fffdf7"/></svg>'},
 {id:'nightstand',name:'橡木床头柜',room:'bedroom',price:48,svg:'<svg viewBox="0 0 100 70"><path d="M25 25 51 12 78 25 51 39Z" fill="#d5b18a"/><path d="M25 25 51 39 51 62 25 48Z" fill="#a97b57"/><path d="M51 39 78 25 78 49 51 62Z" fill="#bd916a"/><path d="M39 32 51 26 63 32 51 38Z" fill="#e7c9a4"/></svg>'},
 {id:'stove',name:'复古炉灶',room:'kitchen',price:95,svg:'<svg viewBox="0 0 100 70"><path d="M20 22 52 7 84 22 52 38Z" fill="#eee5d7" stroke="#b9a58b" stroke-width="3"/><path d="M20 22 52 38 52 62 20 46Z" fill="#d7c5ad"/><path d="M52 38 84 22 84 46 52 62Z" fill="#b6a18a"/><path d="M32 24 51 15 71 24 52 33Z" fill="#71695e"/><circle cx="43" cy="24" r="5" fill="#b9b6a9"/><circle cx="61" cy="25" r="5" fill="#b9b6a9"/></svg>'},
 {id:'cupboard',name:'奶油餐边柜',room:'kitchen',price:78,svg:'<svg viewBox="0 0 100 70"><path d="M22 20 51 6 80 20 51 35Z" fill="#f2dfc5"/><path d="M22 20 51 35 51 62 22 47Z" fill="#c99d76"/><path d="M51 35 80 20 80 47 51 62Z" fill="#dfba94"/><path d="M31 25 48 34 48 52 31 43Z" fill="#f3e7d6"/><path d="M55 36 72 27 72 45 55 54Z" fill="#f3e7d6"/></svg>'},
 {id:'balcony-chair',name:'藤编休闲椅',room:'balcony',price:65,svg:'<svg viewBox="0 0 100 70"><path d="M30 17 66 17 76 40 39 40Z" fill="#cda77f" stroke="#9b7654" stroke-width="4"/><path d="M39 40 34 62M70 40 75 62M31 18 26 48M67 18 72 48" stroke="#9b7654" stroke-width="4" fill="none"/><path d="M36 23 65 23M39 30 68 30" stroke="#f0d7b4" stroke-width="2"/></svg>'},
 {id:'plant',name:'陶盆绿植',room:'all',price:28,svg:'<svg viewBox="0 0 100 70"><path d="M37 42 65 42 60 64 42 64Z" fill="#c78e70" stroke="#a8755b" stroke-width="3"/><path d="M51 43Q25 19 32 9Q48 13 51 43M52 43Q73 10 84 19Q78 37 52 43M50 41Q43 5 55 4Q67 20 50 41" fill="#8da17a" stroke="#6e8666" stroke-width="2"/></svg>'},
 {id:'rug',name:'奶油花纹地毯',room:'all',price:42,svg:'<svg viewBox="0 0 100 70"><path d="M10 36 50 15 90 36 50 58Z" fill="#ead8bd" stroke="#c9ad8e" stroke-width="3"/><path d="M22 36 50 22 78 36 50 50Z" fill="none" stroke="#fff8eb" stroke-width="3"/></svg>'}
];
const weatherTypes=['晴','多云','细雨','微风'];
const seasonalFestivals={春:'春日花展',夏:'夏夜萤火祭',秋:'丰收集市',冬:'暖冬灯会'};
const randomEvents=[
 {id:'seed-gift',title:'邻居送来的种子',desc:'一位邻居路过，留下了一小包种子。',coins:18,xp:3},
 {id:'lost-coins',title:'草丛里的零钱',desc:'你在花园小径边发现了一些金币。',coins:24,xp:2},
 {id:'fresh-breeze',title:'晴朗的好天气',desc:'好天气让大家都精神起来，农场收到一份小小补贴。',coins:15,xp:4},
 {id:'market-note',title:'集市小订单',desc:'镇上的面包店想收购一些农产品，送来一笔谢礼。',coins:32,xp:5}
];
function ensureWorld(){farm.world={...defaults(activeOwnerId).world,...(farm.world||{})};farm.story={...defaults(activeOwnerId).story,...(farm.story||{})};farm.house={...defaults(activeOwnerId).house,...(farm.house||{})};farm.house.rooms={...defaults(activeOwnerId).house.rooms,...(farm.house.rooms||{})};farm.house.furnitureInventory={...(farm.house.furnitureInventory||{})};farm.house.placed={...defaults(activeOwnerId).house.placed,...(farm.house.placed||{})};}
function localDateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function localWeekKey(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return localDateKey(x)}
function ensureWeekly(){farm.weekly=farm.weekly||{date:'',planted:0,harvested:0,claimed:false};const wk=localWeekKey();if(farm.weekly.date!==wk)farm.weekly={date:wk,planted:0,harvested:0,claimed:false};}
function updateWeather(){ensureWorld();const today=localDateKey();if(farm.world.weatherDate!==today){const seed=(farm.day*7+String(farm.ownerId||'').length*3)%weatherTypes.length;farm.world.weather=weatherTypes[seed];farm.world.weatherDate=today;save()}}
function maybeFestival(){ensureWorld();if(farm.day>1&&farm.day%7===0&&farm.world.festivalDate!==`${farm.season}-${farm.day}`){farm.world.festivalDate=`${farm.season}-${farm.day}`;farm.world.pendingEvent={id:`festival-${farm.season}-${farm.day}`,kind:'festival',title:seasonalFestivals[farm.season]||'农场小镇节日',desc:`小镇正在举办${seasonalFestivals[farm.season]||'季节庆典'}，大家邀请你们一起参加。`,coins:45,xp:8};addLog(`今天是${seasonalFestivals[farm.season]}，小镇挂起了彩灯。`,'event')}}
function maybeRandomEvent(){ensureWorld();if(farm.day>=3&&farm.day-farm.world.lastEventDay>=3&&!farm.world.pendingEvent){const ev=randomEvents[(farm.day+String(farm.ownerId||'').length)%randomEvents.length];farm.world.pendingEvent={...ev,kind:'random',day:farm.day};farm.world.lastEventDay=farm.day;addLog(`农场发生小事：${ev.title}。`,'event')}}
function partnerAutonomy(){ensureWorld();if(!farm.partnerId||farm.partnerId==='solo')return;const now=Date.now(),last=farm.story.partnerActionAt||farm.partnerLastAction||0;if(now-last<2*60*60*1000)return;const actions=[];const unripe=farm.plots.find(p=>p.crop&&!mature(p)&&!p.watered);if(unripe)actions.push(()=>{unripe.watered=true;unripe.readyAt=Math.max(now,unripe.readyAt-10000);return `${farm.partnerName||'搭档'}帮忙给一块菜地浇了水。`});if((farm.animals.chickens||0)>0)actions.push(()=>{farm.inventory.egg=(farm.inventory.egg||0)+1;return `${farm.partnerName||'搭档'}去鸡舍看了看，替你收好一枚鸡蛋。`});actions.push(()=>{farm.inventory.seed_carrot=(farm.inventory.seed_carrot||0)+1;return `${farm.partnerName||'搭档'}整理了种子抽屉，发现一包胡萝卜种子。`});const idx=(farm.day+Math.floor(now/7200000))%actions.length;const note=actions[idx]();farm.story.partnerActionAt=now;farm.partnerLastAction=now;addLog(note,'partner');}
function storyScene(){ensureWorld();const chapters=[{id:'first-evening',title:'第一晚的灯光',desc:'搭档在小屋窗边留了一盏灯，等你一起回家。',reward:24,need:()=>!!farm.buildings.cottage},{id:'shared-breakfast',title:'一起准备早餐',desc:'厨房里摆好了面包和果酱，今天也从好好吃饭开始。',reward:32,need:()=>!!farm.buildings.cottage&&!!farm.house.rooms.kitchen},{id:'balcony-stars',title:'阳台上的晚风',desc:'你们把两张藤椅并排放好，聊起以后想种的花。',reward:36,need:()=>!!farm.buildings.cottage&&!!farm.house.rooms.balcony},{id:'garden-promise',title:'写给未来的约定',desc:'你们在共同日记里写下一个小小的愿望。',reward:48,need:()=>!!farm.buildings.cottage&&!!farm.buildings.pond}];return (farm.story.chapter||0)>=chapters.length?{id:'story-complete',title:'未完待续',desc:'你们已经写下了许多共同回忆，新的故事会在未来的农场生活中慢慢展开。',reward:0,need:()=>false}:chapters[farm.story.chapter||0];}
async function storyClaim(){
 const ch=storyScene();if(!ch.need())return false;farm.story.flags=farm.story.flags||[];if(farm.story.flags.includes(ch.id))return false;
 const c=cfg();if(!c.base||!c.key||!c.model){apiMessage='请先在 LOVE RECORD 主页配置 API，才能生成共同故事。';toast(apiMessage);render();return false}
 if(busy)return false;busy=true;apiMessage='正在邀请搭档写下这一段共同故事…';render();
 try{
  const recent=(farm.log||[]).slice(0,8).map(x=>x.text).join('；');
  const prompt=`请为用户和联系人「${farm.partnerName||'搭档'}」创作一段约100个汉字的中文共同生活短篇，80至120个汉字为宜。故事章节主题：${ch.title}。场景提示：${ch.desc}。农场季节：${farm.season}，第${farm.day}天；天气：${farm.world?.weather||'晴'}；当前房间：${({living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'}[farm.house?.currentRoom||'living'])}。近期农场生活：${recent||'刚开始共同经营农场'}。请写成有具体动作、细腻环境和两人互动的温柔日常片段，以联系人自然的视角或第三人称叙述均可。不要标题、不要解释、不要提AI，只输出故事正文。`;
  const r=await fetch(c.base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},body:JSON.stringify({model:c.model,messages:[{role:'system',content:'你是优秀的中文生活故事写作者，擅长温柔、细腻、有画面感的法式乡村日常。严格遵守用户要求的篇幅。'},{role:'user',content:prompt}],stream:false,temperature:0.85,max_tokens:420})});
  const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status);const j=JSON.parse(raw);let text=j.choices?.[0]?.message?.content?.trim();if(!text)throw new Error('API 没有返回故事正文');text=text.replace(/^【[^】]+】\s*/,'').replace(/^故事正文[:：]\s*/,'').trim();
  const entry={id:ch.id,title:ch.title,text,at:Date.now(),season:farm.season,day:farm.day};farm.story.generated=Array.isArray(farm.story.generated)?farm.story.generated:[];farm.story.generated.unshift(entry);farm.story.generated=farm.story.generated.slice(0,20);farm.story.lastGenerated=entry;
  farm.story.flags.push(ch.id);farm.story.chapter=(farm.story.chapter||0)+1;farm.coins+=ch.reward;farm.xp+=6;addLog(`你和${farm.partnerName||'搭档'}写下共同故事「${ch.title}」，获得 ${ch.reward} 金币。`,'story');apiMessage='共同故事生成完成，已保存到当前联系人的农场。';save();toast(`故事已写好 · +${ch.reward} 金币`);return true;
 }catch(e){console.warn('[Farm story API]',e);apiMessage='这次没有生成成功，章节和金币都没有消耗或推进。请检查主页 API 配置后重试。';toast(apiMessage);return false}
 finally{busy=false;render()}
}
function settleOffline(){const now=Date.now(),calendarNow=now,calendarBase=farm.lastCalendarAt||calendarNow,passedDays=Math.floor(Math.max(0,calendarNow-calendarBase)/86400000);if(passedDays>0){const seasons=['春','夏','秋','冬'];for(let d=0;d<Math.min(passedDays,365);d++){farm.day++;if((farm.day-1)%7===0){const idx=seasons.indexOf(farm.season);farm.season=seasons[(idx+1+4)%4]}}farm.lastCalendarAt=calendarBase+passedDays*86400000;addLog(`新的一天到来啦：${farm.season}季，第${farm.day}天。`,'note')}updateWeather();maybeFestival();maybeRandomEvent();partnerAutonomy();if((farm.animals?.chickens||0)>0){const last=farm.animals.lastEggAt||now;const eggs=Math.min(8,Math.floor((now-last)/3600000)*farm.animals.chickens);if(eggs>0){farm.inventory.egg=(farm.inventory.egg||0)+eggs;farm.animals.lastEggAt=now;addLog(`小鸡们留下了鸡蛋 × ${eggs}。`,'note')}}farm.lastVisit=now;save()}
async function open(){mount();$('#lr-games').classList.add('open');document.body.style.overflow='hidden';view='farm';switchingOwner=true;storageBlocked=false;render();try{farm=await hydrateOwner(activeOwnerId);ensureDailyProgress();settleOffline();render();try{if(navigator.storage?.persist)navigator.storage.persist().then(ok=>console.info('[Farm] persistent storage:',!!ok)).catch(()=>{})}catch(_){}}catch(e){storageBlocked=true;console.error('[Farm] load failed; writes paused to protect existing save:',e);toast('存档读取失败，已暂停写入保护旧数据')}finally{switchingOwner=false;render()}}
async function retryStorageLoad(){switchingOwner=true;storageBlocked=false;try{farm=await hydrateOwner(activeOwnerId);ensureDailyProgress();settleOffline();storageBlocked=false;await save();toast('存档读取成功')}catch(e){storageBlocked=true;console.error('[Farm] retry load failed:',e);toast('仍无法读取旧存档，请勿清除网站数据')}finally{switchingOwner=false;render()}}
function close(){save();const r=$('#lr-games');if(r)r.classList.remove('open');document.body.style.overflow=''}
const css=`#lr-games{position:fixed;inset:0;z-index:100100;background:#f7f0e7;color:#51453d;display:none;flex-direction:column;font-family:inherit}#lr-games.open{display:flex}#lr-games *{box-sizing:border-box}#lr-games .gbar{height:56px;flex:none;display:flex;align-items:center;gap:12px;padding:0 16px;background:#fffaf3;border-bottom:1px solid #e8d9c9;color:#57483d}#lr-games button{font:inherit;color:inherit;border:1px solid #d9c5b0;background:#fffaf3;border-radius:14px;padding:10px 13px;cursor:pointer}#lr-games button.primary{background:#8d9c78;color:white;border-color:#8d9c78}#lr-games button:disabled{opacity:.45}#lr-games .gscroll{overflow:auto;padding:15px 15px 34px;max-width:760px;width:100%;margin:0 auto}#lr-games .gtitle{font-size:27px;margin:4px 0 5px;color:#57483d}#lr-games .gsub{font-size:12px;color:#8d7d6d;line-height:1.8}#lr-games .gcard{background:linear-gradient(155deg,#fffdf8 0%,#fff8ed 100%);border:1px solid #e6d8c8;border-radius:23px;padding:18px;margin:16px 0;box-shadow:0 8px 24px #7b5c3212}#lr-games .ghead{background:radial-gradient(circle at 90% 10%,#ffffff88,transparent 34%),linear-gradient(135deg,#e8efdf 0%,#f8e7d7 100%);border-radius:25px;padding:21px 19px;margin:5px 0 16px;border:1px solid #d5dfc9;box-shadow:inset 0 1px 0 #ffffffaa,0 8px 22px #8d806018}#lr-games .gstats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}#lr-games .gstat{background:#ffffffb8;border-radius:13px;padding:9px;text-align:center;font-size:11px;color:#857361}#lr-games .gstat b{display:block;font-size:19px;color:#5c6c4d}#lr-games .gmap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:13px;background:linear-gradient(145deg,#e0eacf,#edf0d9);border:1px solid #cbd7b9;border-radius:23px;position:relative;overflow:hidden;box-shadow:inset 0 2px 8px #657a4c12}#lr-games .plot{min-height:104px;border-radius:15px;background:linear-gradient(145deg,#b98b65,#9e704e);border:2px solid #d8b58f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:5px;color:#fff8ed;text-shadow:0 1px 2px #60452c;font-size:12px}#lr-games .plot.empty{background:linear-gradient(145deg,#c49a75,#a77a54);box-shadow:inset 0 1px 0 #ffffff38,0 3px 8px #6c4a2b20;transition:transform .16s,filter .16s}#lr-games .plot:active{transform:scale(.97);filter:brightness(1.08)}#lr-games .plot.ready{background:linear-gradient(145deg,#9ab77c,#6f9660);border-color:#e1edca;animation:farmGlow 1.8s ease-in-out infinite}#lr-games .plot .cropemoji{font-size:29px;line-height:1.2}#lr-games .plot small{font-size:10px}#lr-games .grow{display:flex;align-items:center;gap:9px;flex-wrap:wrap}#lr-games .gavatar{width:38px;height:38px;border-radius:50%;background:#d9c9b4;display:grid;place-items:center;overflow:hidden;font-size:18px}#lr-games .gavatar img{width:100%;height:100%;object-fit:cover}#lr-games .gseed{display:flex;align-items:center;gap:8px;text-align:left;width:100%;padding:10px!important}#lr-games .gseed.active{border-color:#82966d;background:linear-gradient(135deg,#edf2e5,#f8f5e9);box-shadow:0 0 0 2px #82966d22}#lr-games .gseed .emoji{font-size:25px}#lr-games .gseed small{display:block;color:#8d7d6d;font-size:10px}#lr-games .ggrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#lr-games select,#lr-games input,#lr-games textarea{width:100%;background:#fff;border:1px solid #dfd0bf;color:#57483d;border-radius:12px;padding:11px;font:inherit}#lr-games .gtabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;position:sticky;bottom:-1px;background:#fffaf3;padding:9px 0 max(9px,env(safe-area-inset-bottom));border-top:1px solid #e8d9c9;margin-top:14px}#lr-games .gtabs button{font-size:11px;padding:9px 2px;border:0;background:transparent}#lr-games .gtabs button.active{background:#e9efdf;color:#596c4b}#lr-games .gmuted{font-size:11px;color:#988777;line-height:1.7}#lr-games .glog{display:grid;gap:8px}#lr-games .glog p{margin:0;padding:10px 12px;background:#f6efe5;border-radius:12px;font-size:12px;line-height:1.7}#lr-games .gnotice{padding:11px 13px;background:#f1eadf;border-radius:13px;color:#7d6b59;font-size:12px;line-height:1.7}#lr-games .gxp{margin-top:10px;font-size:11px;color:#8d7d6d}#lr-games .gxp i{display:block;height:8px;background:#eee5d8;border-radius:99px;overflow:hidden;margin-top:6px}#lr-games .gxp i b{display:block;height:100%;background:linear-gradient(90deg,#a9bd91,#718b62);border-radius:99px;transition:width .3s}#lr-games .gmap{gap:10px;padding:14px}#lr-games .plot{min-height:104px;border-radius:19px;box-shadow:inset 0 2px 5px #fff4,0 4px 9px #76523820}#lr-games .gcard{padding:17px;margin:15px 0;border-radius:23px}#lr-games .gseed{min-height:70px;border-radius:17px!important}#lr-games .gtabs{box-shadow:0 -5px 18px #6b54300d}#lr-games .gbar{height:62px;min-height:62px}#lr-games .gscroll{padding:18px 16px 30px}#lr-games .gtoast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,12px);opacity:0;transition:.2s;background:#51483d;color:white;padding:10px 15px;border-radius:99px;font-size:12px;pointer-events:none;z-index:3}#lr-games .gtoast.show{opacity:1;transform:translate(-50%,0)}@keyframes farmGlow{50%{filter:brightness(1.12)}}@media(max-width:380px){#lr-games .plot{min-height:86px}#lr-games .gstats{gap:5px}}
/* V7: farmyard scenes, gentle motion, and non-obstructive navigation */
#lr-games .gtabs{position:relative!important;bottom:auto!important;z-index:1;margin:18px 0 8px!important;padding:10px 8px max(14px,env(safe-area-inset-bottom))!important;border-radius:20px!important;box-shadow:0 4px 18px #6b54300d!important}
#lr-games .gscroll{padding-bottom:calc(34px + env(safe-area-inset-bottom))!important;scroll-padding-bottom:24px}
#lr-games .farmyard-card{overflow:hidden;background:linear-gradient(145deg,#fffdf7,#f8f2e7)}
#lr-games .farmyard-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}
#lr-games .yard-item{min-width:0;padding:10px 7px 12px;border:1px solid #e7dac8;border-radius:18px;background:#fffaf2;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;box-shadow:0 5px 14px #8063440c}
#lr-games .yard-item>b{font-size:12px}
#lr-games .yard-item>small{font-size:10px;line-height:1.5;color:#94816d;min-height:29px}
#lr-games .yard-status{font-size:9px;color:#72875f;background:#edf2e5;border-radius:99px;padding:4px 7px}
#lr-games .yard-item button{font-size:10px;padding:6px 8px;border-radius:99px;background:#eef2e6;border-color:#d7dfc9;color:#637653}
#lr-games .yard-scene{height:88px;width:100%;border-radius:13px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(180deg,#edf1df,#e2ebd8)}
#lr-games .yard-empty{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:27px;opacity:.42;filter:grayscale(.4)}
#lr-games .yard-empty small{font-size:9px;color:#8f806f}
#lr-games .yard-art{height:100%;width:100%;position:relative;display:grid;place-items:center}
#lr-games .cottage-art{background:linear-gradient(180deg,#e8efdF 0 62%,#c9d7ad 62%)}
#lr-games .cottage-house{font-size:49px;z-index:1;animation:yardBob 3.2s ease-in-out infinite}
#lr-games .cottage-smoke{position:absolute;top:5px;right:25%;font-size:17px;opacity:.55;animation:smokeDrift 3.6s ease-in-out infinite}
#lr-games .yard-spark{position:absolute;top:13px;left:17%;color:#d5ad61;animation:sparkle 2s ease-in-out infinite}
#lr-games .coop-art{background:linear-gradient(180deg,#e9efdf 0 65%,#d3dfb9 65%)}
#lr-games .coop-house{font-size:46px;z-index:1;animation:yardBob 2.8s ease-in-out infinite}
#lr-games .coop-chick{position:absolute;right:13%;bottom:9px;font-size:23px;animation:chickHop 1.8s ease-in-out infinite}
#lr-games .pond-art{background:linear-gradient(145deg,#d9e8d8,#b9d4c4)}
#lr-games .pond-water{font-size:54px;filter:drop-shadow(0 4px 3px #688b8066);animation:waterPulse 2.5s ease-in-out infinite}
#lr-games .pond-lily{position:absolute;top:5px;right:15%;font-size:26px;animation:yardBob 3s ease-in-out infinite}
#lr-games .pond-fish{position:absolute;bottom:8px;left:17%;font-size:21px;animation:fishSwim 4s ease-in-out infinite}
@keyframes yardBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes smokeDrift{0%,100%{transform:translate(0,5px);opacity:.3}50%{transform:translate(5px,-5px);opacity:.7}}
@keyframes sparkle{0%,100%{opacity:.2;transform:scale(.8) rotate(0)}50%{opacity:1;transform:scale(1.2) rotate(25deg)}}
@keyframes chickHop{0%,75%,100%{transform:translateY(0)}85%{transform:translateY(-7px)}}
@keyframes waterPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 3px 2px #688b8044)}50%{transform:scale(1.06);filter:drop-shadow(0 5px 5px #688b8066)}}
@keyframes fishSwim{0%,100%{transform:translateX(0) scaleX(1)}50%{transform:translateX(20px) scaleX(-1)}}
@media(max-width:390px){#lr-games .farmyard-grid{gap:6px}#lr-games .yard-item{padding:8px 5px 10px}#lr-games .yard-scene{height:78px}}
@media(prefers-reduced-motion:reduce){#lr-games .yard-art span,#lr-games .plot.ready{animation:none!important}}

#lr-games .ghead{padding:24px 22px;border-radius:28px;position:relative;overflow:hidden}#lr-games .gtitle{font-size:clamp(23px,6vw,30px);line-height:1.35;letter-spacing:.04em}#lr-games .gcard{border-radius:26px;padding:20px;border-color:#e4d7c5;box-shadow:0 10px 28px rgba(111,86,55,.07)}#lr-games .gmap{gap:12px;padding:16px;border-radius:26px;background:linear-gradient(145deg,#e6eddc,#f0efd9)}#lr-games .plot{min-height:clamp(92px,26vw,124px);border-radius:21px;font-size:13px}#lr-games .plot.empty{background:linear-gradient(145deg,#cba783,#b48762);border:2px solid #e4c5a1}#lr-games .gseed{min-height:82px!important;border-radius:19px!important;background:#fffdf8}#lr-games .gseed .emoji{font-size:30px}#lr-games .gnotice{border:1px solid #ebe0d2;background:linear-gradient(135deg,#f5eee3,#f8f2e8);padding:14px 16px}#lr-games .gtabs{position:sticky;bottom:0;margin:18px -16px -30px;padding:10px 16px max(12px,env(safe-area-inset-bottom));background:rgba(255,251,244,.96);backdrop-filter:blur(16px);border-radius:20px 20px 0 0;z-index:5}#lr-games .gtabs button{font-size:12px;min-height:54px;border-radius:16px}#lr-games .grow{gap:12px}#lr-games .gbar b{font-size:14px;letter-spacing:.02em}
/* V8: dock is a fixed flex sibling of the scroll area, never part of page content. */
#lr-games{height:100dvh;min-height:0;overflow:hidden}
#lr-games .gscroll{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:18px 16px 28px!important;scroll-padding-bottom:28px}
#lr-games .gtabs{position:relative!important;inset:auto!important;flex:0 0 auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;width:100%;max-width:760px;margin:0 auto!important;padding:9px 14px calc(9px + env(safe-area-inset-bottom))!important;border:0;border-top:1px solid #eadfce;border-radius:20px 20px 0 0!important;background:rgba(255,251,244,.97);backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15);box-shadow:0 -8px 24px rgba(87,67,43,.09)!important;z-index:20}
#lr-games .gtabs button{min-width:0;min-height:54px;padding:7px 2px!important;border:0;border-radius:16px;background:transparent;font-size:12px;line-height:1.35}
#lr-games .gtabs button.active{background:#e9efdf;color:#596c4b}
#lr-games .gtoast{bottom:calc(82px + env(safe-area-inset-bottom))}
#lr-games .yard-enter{width:100%;font-size:10px!important;padding:7px 5px!important;border-radius:99px!important;background:linear-gradient(135deg,#8d9c78,#71865f)!important;color:#fff!important;border:0!important;box-shadow:0 4px 10px #71865f30}
/* V9 · French country cottage / isometric interior */
#lr-games .gscroll{flex:1 1 auto!important;min-height:0!important;overscroll-behavior:contain;padding-bottom:24px!important}
#lr-games .gtabs{flex:0 0 auto!important;position:relative!important;inset:auto!important;z-index:20;margin:0!important;padding:9px 12px max(10px,env(safe-area-inset-bottom))!important;border-radius:22px 22px 0 0!important;border:1px solid #eee2d2;border-bottom:0;background:rgba(255,251,244,.96)!important;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 -8px 28px #6b543018!important}
#lr-games .house-page{max-width:720px;margin:0 auto;padding:4px 0 18px}
#lr-games .house-intro{padding:3px 3px 15px}
#lr-games .house-back{padding:8px 13px!important;border-radius:99px!important;background:#fffaf3!important;margin-bottom:13px}
#lr-games .house-kicker{font-size:9px;letter-spacing:.2em;color:#a28b70}
#lr-games .house-intro h1{font:600 clamp(25px,7vw,34px)/1.3 Georgia,'Noto Serif SC',serif;margin:7px 0;color:#57483d}
#lr-games .house-intro p{font-size:12px;color:#988777;margin:0}
#lr-games .iso-room-shell{position:relative;overflow:hidden;border:7px solid #fffaf1;border-radius:27px;background:#f4ead7;box-shadow:0 15px 36px #765a351b,inset 0 0 0 1px #dfcdb6}
#lr-games .iso-room{display:block;width:100%;height:auto;aspect-ratio:640/500}
#lr-games .iso-room .wall-left{fill:url(#wallLeft)}#lr-games .iso-room .wall-right{fill:url(#wallRight)}
#lr-games .iso-room .floor-base{fill:url(#floorWood)}#lr-games .iso-room .floor-line{fill:none;stroke:#a87955;stroke-width:2;opacity:.23}
#lr-games .iso-room .window-glass{fill:url(#windowGlass)}#lr-games .iso-room .curtain-shape{fill:url(#curtainFabric);stroke:#d8b79b;stroke-width:2}
#lr-games .iso-room .fire-flame{transform-origin:468px 248px;animation:isoFlame 1.15s ease-in-out infinite alternate}
#lr-games .iso-room .lamp-glow{opacity:1;transition:opacity .4s}#lr-games .iso-room.lamp-off .lamp-glow{opacity:.12}
#lr-games .iso-room .window-shutter{transform-origin:center;transition:transform .6s ease}#lr-games .iso-room.window-open .window-shutter.left{transform:translateX(-16px)}#lr-games .iso-room.window-open .window-shutter.right{transform:translateX(16px)}
#lr-games .iso-room .curtain-left{transform-origin:100% 0;transition:transform .65s ease}#lr-games .iso-room .curtain-right{transform-origin:0 0;transition:transform .65s ease}
#lr-games .iso-room.window-open .curtain-left{transform:skewY(-5deg) translateX(-9px)}#lr-games .iso-room.window-open .curtain-right{transform:skewY(5deg) translateX(9px)}
#lr-games .iso-room .plant-leaf{transform-box:fill-box;transform-origin:bottom center;animation:leafSway 4s ease-in-out infinite}
#lr-games .iso-room .plant-leaf:nth-child(2n){animation-delay:-1.5s}
#lr-games .iso-room .dust{animation:dustDrift 8s ease-in-out infinite}
#lr-games .iso-room .curtain-sheen{opacity:.38}
#lr-games .room-hotspot{position:absolute;z-index:5;border:0!important;background:transparent!important;padding:0!important;border-radius:12px!important;min-width:0;min-height:0;box-shadow:none!important;outline-offset:3px}
#lr-games .room-hotspot:focus-visible{outline:2px solid #82966d}
#lr-games .room-hotspot.sofa{left:37%;top:62%;width:28%;height:20%}
#lr-games .room-hotspot.window{left:8%;top:23%;width:29%;height:30%}
#lr-games .room-hotspot.fireplace{right:10%;top:27%;width:25%;height:25%}
#lr-games .room-hotspot.lamp{left:51%;top:8%;width:12%;height:17%}
#lr-games .house-controls,#lr-games .house-memory{margin-top:15px;padding:17px;border:1px solid #e7dac8;border-radius:22px;background:linear-gradient(145deg,#fffdf8,#faf2e7);box-shadow:0 8px 22px #7b5c3210}
#lr-games .house-section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:12px}
#lr-games .house-section-title span{font-size:10px;color:#9a8875}
#lr-games .house-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
#lr-games .house-action-grid button{min-height:88px;display:grid;grid-template-columns:38px 1fr;grid-template-rows:auto auto;column-gap:9px;align-content:center;text-align:left;padding:12px;border-radius:17px;background:#fffaf2;border-color:#e7d9c7}
#lr-games .house-action-grid button>svg{grid-row:1/3;width:34px;height:34px;align-self:center;stroke:#8b9876;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
#lr-games .house-action-grid button>b{font-size:12px}#lr-games .house-action-grid button>small{font-size:9px;color:#9a8875;margin-top:4px;line-height:1.4}
#lr-games .house-note{margin-top:12px;padding:12px 14px;border-radius:14px;background:#edf1e5;color:#788568;font-size:11px;line-height:1.7}
#lr-games .house-memory b{font-size:13px}#lr-games .house-memory p{font-size:11px;color:#94816d;line-height:1.8;margin:8px 0 0}
@keyframes isoFlame{from{transform:scale(.92) rotate(-2deg);filter:drop-shadow(0 0 4px #e99b54)}to{transform:scale(1.07) rotate(2deg);filter:drop-shadow(0 0 12px #f3ad5d)}}
@keyframes leafSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
@keyframes dustDrift{0%{transform:translate(0,0);opacity:.15}50%{opacity:.65}100%{transform:translate(18px,-15px);opacity:.1}}
@media(max-width:390px){#lr-games .iso-room-shell{border-width:5px;border-radius:22px}#lr-games .house-action-grid button{min-height:82px;padding:9px}}


/* V11 · French country multi-room home, decor placement, seasons & story */
#lr-games .room-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 12px;padding:5px;background:#eee7d9;border-radius:15px}
#lr-games .room-tabs button{padding:9px 3px!important;border:0;border-radius:11px;background:transparent;font-size:11px}
#lr-games .room-tabs button.active{background:#fffaf1;color:#657b55;box-shadow:0 2px 8px #6b543018}
#lr-games .v11-room-stage{position:relative;overflow:hidden;aspect-ratio:640/460;border:7px solid #fffaf1;border-radius:25px;background:#f4ead7;box-shadow:0 14px 32px #765a351b;touch-action:pan-y}
#lr-games .v11-room-stage>svg{display:block;width:100%;height:100%}
#lr-games .placed-furniture-wrap{position:absolute;width:22%;height:24%;transform:translate(-50%,-50%);z-index:3;display:grid;place-items:center}
#lr-games .v11-room-stage.decor-active{touch-action:none}
#lr-games .placed-furniture{width:100%;height:100%;min-width:0;min-height:0;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;touch-action:none;display:grid;place-items:center}
#lr-games .placed-furniture svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 5px 3px #62482c35)}
#lr-games .furniture-remove{position:absolute;right:-7px;top:-8px;min-height:0;padding:2px 6px!important;border:1px solid #d9bda5!important;border-radius:99px!important;background:#fff8ed!important;color:#8b654b!important;font-size:9px!important;z-index:4}
#lr-games .house-controls .furniture-inventory{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}
#lr-games .furniture-inventory button{display:flex;align-items:center;gap:8px;text-align:left;font-size:10px;padding:8px!important}
#lr-games .furniture-inventory svg{width:42px;height:34px;flex:none}
#lr-games .furniture-shop-row{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee4d7}
#lr-games .furniture-shop-row>svg{width:52px;height:42px;flex:none}
#lr-games .furniture-shop-row>div{flex:1;min-width:0}
#lr-games .furniture-shop-row b{display:block;font-size:11px}
#lr-games .furniture-shop-row small{display:block;font-size:9px;color:#9b8875;margin-top:3px}
#lr-games .furniture-shop-row strong{font-size:10px;color:#84936f;white-space:nowrap}
#lr-games .furniture-shop-row button{font-size:10px;padding:7px 9px!important}
#lr-games .world-card{background:linear-gradient(135deg,#f7f0e2,#edf1e5)}
#lr-games .world-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
#lr-games .world-card-top b{font-size:13px}
#lr-games .world-card-top span{font-size:10px;color:#8c9978;white-space:nowrap}
#lr-games .world-card p{font-size:11px;line-height:1.8;color:#8d7d6d;margin:9px 0}
#lr-games .world-card small{font-size:9px;color:#9a8875}
#lr-games .event-pending{border-color:#d8c99e;background:linear-gradient(135deg,#fff6df,#f2ead8)}
#lr-games .story-board h3{font-size:15px;margin:12px 0 5px;color:#625345}
#lr-games .weekly-progress{height:8px;border-radius:99px;background:#eee6d9;overflow:hidden;margin:10px 0}
#lr-games .weekly-progress i{display:block;height:100%;background:linear-gradient(90deg,#b4c69b,#758e66);border-radius:99px}
#lr-games .room-weather-wash{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s}
#lr-games .room-weather-wash.sunny{opacity:.24;background:linear-gradient(120deg,#fff3b7,transparent 45%)}
#lr-games .room-weather-wash.rainy{opacity:.18;background:repeating-linear-gradient(110deg,transparent 0 16px,#9bb9bd 17px 18px,transparent 19px 29px)}
@media(max-width:390px){#lr-games .furniture-shop-row{gap:5px}#lr-games .furniture-shop-row>svg{width:42px}#lr-games .furniture-shop-row strong{font-size:9px}#lr-games .room-tabs button{font-size:10px}}
@media(prefers-reduced-motion:reduce){#lr-games .room-weather-wash,#lr-games .placed-furniture{transition:none!important}}

/* V10 · interactive 2D isometric coop & pond, generous daily rewards */
#lr-games .facility-page{max-width:720px;margin:0 auto;padding:4px 0 20px}
#lr-games .facility-intro{padding:4px 4px 14px}.facility-intro>span{display:block;font-size:9px;letter-spacing:.18em;color:#a18b70;margin-top:8px}.facility-intro h1{font:600 clamp(26px,7vw,35px)/1.25 Georgia,'Noto Serif SC',serif;margin:8px 0;color:#57483d}.facility-intro p{font-size:12px;color:#93816e;margin:0;line-height:1.7}
#lr-games .facility-stage{position:relative;overflow:hidden;border:7px solid #fffaf1;border-radius:26px;box-shadow:0 14px 32px #765a351b;background:linear-gradient(180deg,#e8efdF,#d8e3c7)}
#lr-games .facility-stage svg{display:block;width:100%;height:auto}.coop-chicken-svg{animation:coopBreathe 2.7s ease-in-out infinite;transform-origin:center}.pond-fish-svg{animation:fishLoop 6s ease-in-out infinite;transform-origin:center}.pond-ripple{animation:pondRipple 3.4s ease-in-out infinite;transform-origin:300px 260px}.facility-sunlight{position:absolute;inset:0;pointer-events:none;background:linear-gradient(120deg,#fff8d533,transparent 48%);mix-blend-mode:screen}
#lr-games .facility-actions article{margin-top:14px;padding:17px;border:1px solid #e7dac8;border-radius:21px;background:linear-gradient(145deg,#fffdf8,#faf2e7);box-shadow:0 8px 22px #7b5c3210}.facility-actions p{font-size:11px;color:#95836f;line-height:1.8}.facility-counts{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.facility-counts span{padding:9px 12px;border-radius:13px;background:#edf1e5;color:#6d7d5e;font-size:11px}.facility-counts strong{font-size:17px;margin-left:4px}.facility-actions button{margin:4px 6px 0 0}
#lr-games .daily-board-head{display:flex;align-items:center;justify-content:space-between}.daily-board-head b{font-size:16px}.daily-board-head small{display:block;color:#9b8875;font-size:10px;margin-top:4px}.daily-board-head strong{font-size:20px;color:#788b68}.daily-progress{height:8px;background:#eee6d9;border-radius:99px;overflow:hidden;margin:12px 0}.daily-progress i{display:block;height:100%;background:linear-gradient(90deg,#b4c69b,#758e66);border-radius:99px;transition:width .35s}
#lr-games .daily-task{display:flex;align-items:center;gap:9px;padding:12px 0;border-bottom:1px solid #eee4d7}.daily-task-mark{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#f0eadf;color:#9c8b76;flex:none}.daily-task.is-done .daily-task-mark{background:#e7efdf;color:#6f865e}.daily-task-copy{flex:1;min-width:0}.daily-task-copy b{display:block;font-size:12px}.daily-task-copy small{display:block;font-size:10px;color:#9b8875;margin-top:3px}.daily-task-reward{font-size:10px;color:#8a9a70;white-space:nowrap}.daily-task button{font-size:10px;padding:6px 9px;border-radius:99px;white-space:nowrap}.daily-task-claimed{font-size:10px;color:#84936f;white-space:nowrap}.daily-bonus{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:14px}.daily-bonus b{font-size:12px}.daily-bonus small{display:block;font-size:10px;color:#988675;margin-top:4px}.daily-bonus button{font-size:10px;white-space:nowrap}.achievement-row{display:flex;align-items:center;gap:8px;padding:11px 0;border-bottom:1px solid #eee4d7}.achievement-row>div{flex:1;min-width:0}.achievement-row b{display:block;font-size:12px}.achievement-row small{display:block;color:#998775;font-size:10px;margin-top:3px}.achievement-row>span{font-size:10px;color:#8b9a72;white-space:nowrap}.achievement-row button{font-size:10px;padding:6px 9px;white-space:nowrap}.achievement-row em{font-size:10px;color:#82916d;white-space:nowrap;font-style:normal}
@keyframes coopBreathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes fishLoop{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}@keyframes pondRipple{0%,100%{transform:scale(.96);opacity:.55}50%{transform:scale(1.04);opacity:.9}}
@media(max-width:390px){#lr-games .daily-task{gap:6px}.daily-task-reward{font-size:9px}.daily-task button{padding:5px 7px}.achievement-row{gap:5px}}

@media(prefers-reduced-motion:reduce){#lr-games .iso-room *,#lr-games .facility-stage *{animation:none!important;transition:none!important}}



/* V13 · compact collapsible farm boards */
#lr-games details.farm-fold{padding:0;overflow:hidden}
#lr-games .farm-fold-summary{list-style:none;display:flex;align-items:center;gap:12px;min-height:66px;padding:15px 18px;cursor:pointer;user-select:none}
#lr-games .farm-fold-summary::-webkit-details-marker{display:none}
#lr-games .farm-fold-summary>span:first-child{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
#lr-games .farm-fold-summary b{font-size:15px;color:#5c4b3e}
#lr-games .farm-fold-summary small{font-size:10px;font-weight:400;color:#9b8976}
#lr-games .farm-fold-meta{font-size:11px;font-weight:500;color:#879574;white-space:nowrap}
#lr-games .farm-fold-chevron{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#edf1e5;color:#788b68;font-size:18px;transition:transform .2s ease}
#lr-games details.farm-fold[open] .farm-fold-chevron{transform:rotate(180deg)}
#lr-games .farm-fold-content{padding:0 17px 17px;border-top:1px solid #eee5d9;animation:farmFoldIn .18s ease-out}
@keyframes farmFoldIn{from{opacity:.55;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){#lr-games .farm-fold-chevron{transition:none}#lr-games .farm-fold-content{animation:none}}

/* V12 · story API card, compact shop accordions and richer isometric room finish */
#lr-games .shop-accordion{padding:0;overflow:hidden}
#lr-games .shop-accordion>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 18px;cursor:pointer;font-weight:700;color:#5b4a3d;min-height:58px}
#lr-games .shop-accordion>summary::-webkit-details-marker{display:none}
#lr-games .shop-accordion>summary:after{content:'＋';display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:#edf1e5;color:#7d8e6c;font-size:16px;flex:none;transition:transform .2s}
#lr-games .shop-accordion[open]>summary:after{content:'－';transform:rotate(180deg)}
#lr-games .shop-accordion>summary span{font-size:15px}
#lr-games .shop-accordion>summary small{margin-left:auto;color:#9b8b78;font-size:10px;font-weight:400}
#lr-games .shop-accordion-body{padding:0 17px 16px;border-top:1px solid #eee4d7;animation:shopReveal .22s ease-out}
#lr-games .shop-product-row{padding:12px 0;border-bottom:1px solid #eee4d7;min-height:68px}
#lr-games .shop-product-art{width:42px;height:42px;border-radius:13px;background:linear-gradient(145deg,#f0f1e4,#f9eadb);display:grid;place-items:center;font-size:24px;flex:none}
#lr-games .generated-story{position:relative;margin:12px 0;padding:18px 17px 15px;border-radius:17px;background:linear-gradient(145deg,#f6f0e4,#fffaf0);border:1px solid #e9ddca;color:#685748;font-size:14px;line-height:2;letter-spacing:.025em;box-shadow:inset 0 1px #fff}
#lr-games .generated-story:before{content:'“';position:absolute;left:7px;top:-8px;font:38px Georgia,serif;color:#c5b08f;opacity:.65}
#lr-games .generated-story small{display:block;text-align:right;margin-top:9px;color:#9b8b78;font-size:10px}
#lr-games .story-archive{margin-top:12px;border-top:1px solid #eee4d7;padding-top:10px}
#lr-games .story-archive summary{cursor:pointer;color:#82906f;font-size:12px;padding:5px 0}
#lr-games .story-archive article{padding:10px 0;border-bottom:1px solid #eee4d7}
#lr-games .story-archive article p{font-size:12px;line-height:1.9;color:#857563}
#lr-games .v11-room-stage{background:radial-gradient(ellipse at 50% 28%,#fff9e9 0%,#f0e5ce 66%,#dfcfb5 100%);box-shadow:inset 0 0 0 1px #fff9e9,inset 0 -18px 35px #9c795022,0 15px 28px #7b5c3217}
#lr-games .v11-room-stage svg{filter:drop-shadow(0 7px 6px #765a3510)}
#lr-games .v11-room-stage .room-weather-wash{mix-blend-mode:soft-light}
#lr-games .room-stage-grain{pointer-events:none;position:absolute;inset:0;opacity:.12;background-image:radial-gradient(#9a7955 0.55px,transparent .8px);background-size:9px 9px;mix-blend-mode:multiply}
@keyframes shopReveal{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:420px){#lr-games .shop-accordion>summary{padding:15px}#lr-games .shop-accordion-body{padding:0 13px 13px}#lr-games .generated-story{font-size:13px;line-height:1.9}}

#lr-games .room-architecture path{vector-effect:non-scaling-stroke}
#lr-games .room-wall-sparkles circle{animation:roomDust 7s ease-in-out infinite alternate}
#lr-games .room-wall-sparkles circle:nth-child(2){animation-delay:-2s}
#lr-games .room-wall-sparkles circle:nth-child(3){animation-delay:-4s}
#lr-games .room-wall-sparkles circle:nth-child(4){animation-delay:-1s}
#lr-games .sway-plant{animation:plantSway 5.5s ease-in-out infinite alternate}
#lr-games .lamp-glow{animation:lampPulse 3.2s ease-in-out infinite alternate;filter:drop-shadow(0 0 8px #f5d88b)}
#lr-games .balcony-lights circle{animation:lightTwinkle 2.8s ease-in-out infinite alternate;filter:drop-shadow(0 0 5px #f5d88b)}
#lr-games .balcony-lights circle:nth-child(2n){animation-delay:-1.2s}
#lr-games .room-fire{transform-origin:480px 190px;animation:fireWaver 1.8s ease-in-out infinite alternate}
#lr-games .bedroom-details,.living-details,.kitchen-details,.balcony-details{filter:drop-shadow(0 3px 2px #72533818)}
#lr-games .room-stage-grain{opacity:.075;background-size:13px 13px}
#lr-games .v11-room-stage{background:radial-gradient(ellipse at 50% 24%,#fffdf3 0%,#f3e8d3 58%,#d9c5a7 100%);box-shadow:inset 0 0 0 1px #fff9e9,inset 0 -22px 42px #8c684522,0 17px 34px #7b5c3222}
#lr-games .v11-room-stage>svg{filter:drop-shadow(0 8px 7px #765a3518)}
@keyframes plantSway{0%{transform:rotate(-2deg)}100%{transform:rotate(2.4deg)}}
@keyframes lampPulse{0%{opacity:.78;filter:drop-shadow(0 0 4px #f5d88b)}100%{opacity:1;filter:drop-shadow(0 0 11px #f5d88b)}}
@keyframes lightTwinkle{0%{opacity:.55}100%{opacity:1}}
@keyframes fireWaver{0%{transform:scale(.94,1);opacity:.82}100%{transform:scale(1.05,1.08);opacity:1}}
@keyframes roomDust{0%{opacity:.15;transform:translateY(4px)}100%{opacity:.8;transform:translateY(-7px)}}
@media(prefers-reduced-motion:reduce){#lr-games .sway-plant,#lr-games .lamp-glow,#lr-games .balcony-lights circle,#lr-games .room-fire,#lr-games .room-wall-sparkles circle{animation:none!important}}

`;
function mount(){if($('#lr-games'))return;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);const root=document.createElement('div');root.id='lr-games';root.innerHTML=`<div class="gbar"><button id="gclose">‹ 返回 LOVE RECORD</button><b id="gbarTitle">OUR LITTLE FARM · 我们的小农场</b></div><main class="gscroll" id="gbody"></main><nav class="gtabs" id="farmDock" aria-label="农场导航"></nav><div class="gtoast" id="farmToast"></div>`;document.body.appendChild(root);root.addEventListener('click',onClick);root.addEventListener('change',onChange);root.addEventListener('pointerdown',onFurniturePointerDown);root.addEventListener('pointermove',onFurniturePointerMove);root.addEventListener('pointerup',onFurniturePointerUp);root.addEventListener('pointercancel',onFurniturePointerUp);$('#gclose').onclick=close;render()}
function partnerCard(){const p=people().find(x=>String(x.id)===String(farm.partnerId));return `<section class="gcard"><b>共同农场主人</b><div class="grow" style="margin-top:10px"><div class="gavatar">${farm.partnerAvatar?`<img src="${esc(farm.partnerAvatar)}">`:esc((farm.partnerName||'♡').slice(0,1))}</div><div style="flex:1"><b>${esc(farm.partnerName||'还没有选择搭档')}</b><div class="gmuted">${p?'与你共同经营这座农场':'选择一位联系人，成为共同主人'}</div></div></div><select id="farmPartner" style="margin-top:12px"><option value="">选择联系人…</option>${people().map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(farm.partnerId)?'selected':''}>${esc(x.remark||x.name||'联系人')}</option>`).join('')}</select></section>`}
function header(){return `<div class="ghead"><div class="gmuted" style="letter-spacing:2px">OUR LITTLE FARM · ${farm.season}季 第${farm.day}天 · ${farm.world?.weather||'晴'}</div><h1 class="gtitle">一起慢慢，把日子种出来。</h1><div class="gsub">这是 ${esc(farm.partnerName||'你的')} 的专属农场。</div><div class="gstats"><div class="gstat"><b>🪙 ${farm.coins}</b>金币</div><div class="gstat"><b>⭐ ${farm.level}</b>农场等级</div><div class="gstat"><b>🌾 ${farm.stats.harvests}</b>累计收获</div></div></div>`}
function tabs(){const active=view==='house'?'farm':view;return `${[['farm','🌿','农场'],['shop','🛒','商店'],['bag','🧺','仓库'],['life','♡','日常']].map(([v,i,n])=>`<button data-view="${v}" class="${active===v?'active':''}">${i}<br>${n}</button>`).join('')}`}
function farmyardView(){
 const spots=[
  {id:'cottage',name:'温馨小屋',built:!!farm.buildings.cottage,desc:'窗边亮着暖暖的灯',art:'<svg viewBox="0 0 180 112" aria-hidden="true"><path d="M8 86 90 42l82 44-82 22Z" fill="#c9d5ad"/><path d="M43 62 90 27l48 35v36H43Z" fill="#e8d2b5" stroke="#a97c5b" stroke-width="4"/><path d="m34 62 56-44 58 44-12 7-46-35-44 35Z" fill="#a96e58"/><rect x="78" y="68" width="24" height="30" rx="3" fill="#8d684d"/><rect x="50" y="68" width="18" height="17" fill="#b9d7d2" stroke="#fff2dc" stroke-width="3"/><rect x="112" y="68" width="17" height="17" fill="#b9d7d2" stroke="#fff2dc" stroke-width="3"/><circle cx="90" cy="57" r="4" fill="#e7c66f"/></svg>'},
  {id:'coop',name:'小鸡窝',built:!!farm.buildings.coop,desc:`小鸡 ${farm.animals.chickens||0} 只 · 鸡蛋 ${farm.inventory.egg||0} 枚`,art:'<svg viewBox="0 0 180 112" aria-hidden="true"><path d="M12 88 90 48l78 40-78 20Z" fill="#cbd7b1"/><path d="M48 51 90 22l45 29v43H48Z" fill="#d7b184" stroke="#956b4d" stroke-width="4"/><path d="m39 52 51-39 55 39-12 7-43-31-39 31Z" fill="#a96c58"/><path d="M73 64q17-16 34 0v30H73Z" fill="#77543e"/><path d="M111 82q17-13 31 0" fill="none" stroke="#fff0d6" stroke-width="5"/><circle cx="121" cy="75" r="9" fill="#fff3dc"/><circle cx="126" cy="71" r="2" fill="#55483e"/><path d="m133 75 9 3-9 4Z" fill="#e6a45f"/></svg>'},
  {id:'pond',name:'小池塘',built:!!farm.buildings.pond,desc:'荷叶轻轻漂在水面上',art:'<svg viewBox="0 0 180 112" aria-hidden="true"><path d="M10 68 90 28l80 40-80 38Z" fill="#cbd8b4"/><path d="M27 66 90 34l63 32-63 32Z" fill="#85b9ad" stroke="#f5e7cd" stroke-width="5"/><path d="M49 64q-14-19-28-5 8 20 28 5Zm76 12q15-21 30-7-9 20-30 7Z" fill="#708c63"/><path d="M92 48q-14-18 0-25 15 9 0 25Zm0 0q18-17 27-6-3 15-27 6Z" fill="#e9aaa1"/><path d="M67 72q15-11 29 0-14 12-29 0Z" fill="#e5a66d"/></svg>'}
 ];
 return `<section class="gcard farmyard-card"><div class="grow" style="justify-content:space-between"><b>农场的小天地</b><span class="gmuted">已建造 ${spots.filter(x=>x.built).length}/3</span></div><p class="gmuted">每一处设施都可以进去看看，留下自己的生活片段。</p><div class="farmyard-grid">${spots.map(x=>`<article class="yard-item ${x.built?'is-built':'is-locked'}"><div class="yard-scene ${x.id}-thumb">${x.built?x.art:`<div class="yard-empty">${x.id==='cottage'?'小屋':x.id==='coop'?'鸡舍':'池塘'}<small>等待建造</small></div>`}</div><b>${x.name}</b><small>${x.built?x.desc:'去商店把它带回农场吧'}</small>${x.built?`<button class="yard-enter" ${x.id==='cottage'?'data-enter-house':`data-facility="${x.id}"`}>${x.id==='cottage'?'推门进去':'进去看看'} ↗</button>`:`<button data-view="shop">去建造</button>`}</article>`).join('')}</div></section>`;
}
function houseIcon(type){
 const common='viewBox="0 0 48 48" aria-hidden="true"';
 const paths={lamp:'<path d="M24 5v8M13 15h22l-4 12H17zM19 27v12h10V27M15 40h18"/><path d="M18 8l-3-3M30 8l3-3"/>',window:'<rect x="7" y="7" width="34" height="34" rx="3"/><path d="M24 8v32M8 24h32M12 12l8 8M36 12l-8 8"/>',sofa:'<path d="M9 24v-6a5 5 0 0 1 5-5h20a5 5 0 0 1 5 5v6M7 23a4 4 0 0 0-4 4v9h42v-9a4 4 0 0 0-4-4M9 36v5M39 36v5M12 23h24v10H12z"/>',tea:'<path d="M10 17h24v16a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8zM34 21h4a5 5 0 0 1 0 10h-5M15 11c-2-3 2-4 0-7M24 11c-2-3 2-4 0-7"/>'};
 return `<svg ${common}>${paths[type]||paths.lamp}</svg>`;
}
function houseScene(h){
 return `<div class="iso-room-shell"><svg class="iso-room ${h.lampOn?'lamp-on':'lamp-off'} ${h.windowOpen?'window-open':''}" viewBox="0 0 640 500" role="img" aria-label="奶油色法式乡村风等距视角小屋室内：客厅、壁炉、拱窗、沙发和绿植">
 <defs>
  <linearGradient id="wallLeft" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7efd9"/><stop offset="1" stop-color="#e9dfc8"/></linearGradient>
  <linearGradient id="wallRight" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4ead3"/><stop offset="1" stop-color="#e5d8bd"/></linearGradient>
  <linearGradient id="floorWood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d9b48d"/><stop offset="1" stop-color="#b98660"/></linearGradient>
  <linearGradient id="windowGlass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b7d2ce"/><stop offset="1" stop-color="#dce6cf"/></linearGradient>
  <linearGradient id="curtainFabric" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#d5a98e"/><stop offset=".55" stop-color="#f3d9bd"/><stop offset="1" stop-color="#d8b092"/></linearGradient>
  <linearGradient id="sofaFabric" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c4cda9"/><stop offset="1" stop-color="#899a76"/></linearGradient>
  <linearGradient id="fireGlass" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#745342"/><stop offset="1" stop-color="#3f3029"/></linearGradient>
  <radialGradient id="warmGlow"><stop stop-color="#ffe7a3" stop-opacity=".72"/><stop offset="1" stop-color="#ffe7a3" stop-opacity="0"/></radialGradient>
  <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="7"/></filter>
  <filter id="furnitureShadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="4"/></filter>
 </defs>
 <!-- isometric room shell -->
 <path class="wall-left" d="M36 155 320 22v286L36 442Z"/>
 <path class="wall-right" d="M320 22 604 155v287L320 308Z"/>
 <path d="M36 155 320 22 604 155" fill="none" stroke="#d2bea0" stroke-width="12" stroke-linecap="round"/>
 <path d="M36 442 320 308 604 442" fill="none" stroke="#c8a984" stroke-width="7" opacity=".75"/>
 <!-- wall panels and trim -->
 <path d="M55 170 320 47v13L55 183Z M320 60 585 183v13L320 73Z" fill="#fff8e9" opacity=".8"/>
 <path d="M58 188 58 416 M320 80V291 M582 188V416" stroke="#d8c7a9" stroke-width="3" opacity=".55"/>
 <path d="M72 205 302 97M338 98l230 108" stroke="#fff9e9" stroke-width="2" opacity=".5"/>
 <!-- window on left wall -->
 <g class="iso-window">
  <path d="M83 174 205 117l1 137-123 57Z" fill="#c39a75" opacity=".35" transform="translate(0 7)"/>
  <path d="M83 166 205 109l0 137-122 57Z" fill="#f8f0df" stroke="#caa986" stroke-width="7"/>
  <path d="M94 169 194 122v112l-100 47Z" class="window-glass"/>
  <path d="M94 169 194 122v112l-100 47Z" fill="#fff" opacity=".12"/>
  <path d="M144 146v119M94 218l100-47" stroke="#fff8e8" stroke-width="6"/>
  <path d="M99 170 189 128" stroke="#fff" stroke-width="4" opacity=".55"/>
  <g class="window-shutter left"><path d="M73 160 91 151v151l-18 9Z" fill="#c78f72"/><path d="M77 166 86 162v132l-9 4Z" fill="#e4b99b" opacity=".8"/></g>
  <g class="window-shutter right"><path d="M197 102 215 94v151l-18 9Z" fill="#c78f72"/><path d="M201 108 210 104v132l-9 4Z" fill="#e4b99b" opacity=".8"/></g>
  <path d="M76 305 211 242l10 9-145 68Z" fill="#b98b68"/><path d="M80 305 211 245" stroke="#f6dfc3" stroke-width="4"/>
  <g class="curtain-left"><path class="curtain-shape" d="M70 151q18-8 26 7v143q-13 13-26 4Z"/><path class="curtain-sheen" d="M77 157q8-4 11 3v133q-5 6-11 4Z" fill="#fff5e8"/></g>
  <g class="curtain-right"><path class="curtain-shape" d="M198 93q17-9 25 7v143q-12 12-25 4Z"/><path class="curtain-sheen" d="M205 100q8-4 11 3v132q-5 6-11 4Z" fill="#fff5e8"/></g>
  <path d="M83 318q40-16 77-36" stroke="#fff2d7" stroke-width="3" opacity=".8"/>
 </g>
 <!-- right wall fireplace -->
 <g>
  <path d="M390 188 520 248v116l-130-61Z" fill="#8d6c51" opacity=".18" transform="translate(0 8)"/>
  <path d="M384 180 528 247v123l-144-67Z" fill="#c8a47e" stroke="#a77f5c" stroke-width="5"/>
  <path d="M402 196 511 247v91l-109-51Z" fill="url(#fireGlass)" stroke="#ead2ad" stroke-width="5"/>
  <path d="M382 177 528 244l-10 13-145-68Z" fill="#f0d9b8" stroke="#c5a27b" stroke-width="3"/>
  <ellipse cx="458" cy="287" rx="61" ry="48" fill="url(#warmGlow)" class="lamp-glow"/>
  <g class="fire-flame"><path d="M456 322q-31-22-10-55 3 19 15 22-2-30 19-49-6 29 13 43 21 33-8 47-18 10-29-8Z" fill="#e99a50"/><path d="M458 324q-17-18-3-35 3 12 11 14 0-17 13-26-4 20 8 29 11 19-8 26-13 5-21-8Z" fill="#ffd98b"/><path d="M461 324q-7-12 3-21 2 8 8 9 5 8-3 14-5 3-8-2Z" fill="#fff0bd"/></g>
  <path d="M410 350 502 393" stroke="#a77e5d" stroke-width="5" opacity=".5"/>
 </g>
 <!-- wall shelf, books and pottery -->
 <g>
  <path d="M375 133 535 207l-8 10-160-74Z" fill="#a97c59"/><path d="M379 131 535 203" stroke="#f3d9b7" stroke-width="4"/>
  <path d="M406 118l42 20-5 7-42-20Z" fill="#8c9b80"/><path d="M410 108l42 20-5 8-42-20Z" fill="#b47e62"/><path d="M414 99l42 20-5 8-42-20Z" fill="#d8bd91"/>
  <path d="M482 147q12-9 23 2l-2 36q-9 9-20 0Z" fill="#f3e6cf" stroke="#c5a889" stroke-width="2"/><path d="M488 146q5-13 10-1" fill="none" stroke="#c5a889" stroke-width="3"/>
  <path d="M516 169q15-12 27 1l-7 25q-12 8-22-1Z" fill="#9ba987"/><path d="M529 169q-10-17-17-8m17 8q9-18 17-12m-17 12q-2-20 2-24" stroke="#647b5c" stroke-width="4" fill="none" stroke-linecap="round"/>
 </g>
 <!-- floor -->
 <path class="floor-base" d="M36 442 320 308 604 442 320 492Z"/>
 <path class="floor-line" d="M88 417 371 466M145 390 429 440M204 363 487 413M262 335 546 386M122 462 406 328M215 480 499 347M309 490 581 362"/>
 <path d="M36 442 320 308 604 442" fill="none" stroke="#a97a56" stroke-width="8" opacity=".6"/>
 <!-- rug -->
 <path d="M157 386 319 310 485 388 320 470Z" fill="#9f795c" opacity=".2" filter="url(#furnitureShadow)"/>
 <path d="M151 378 319 300 490 380 320 461Z" fill="#e9d6b9" stroke="#c9a985" stroke-width="4"/>
 <path d="M173 379 320 312 468 380 320 448Z" fill="#d7bea0" stroke="#f5e8d4" stroke-width="3"/>
 <path d="M197 379 320 323 445 380 320 437Z" fill="none" stroke="#f7ead8" stroke-width="2" opacity=".8"/>
 <!-- sofa: isometric cushions and arms -->
 <g class="sofa-art">
  <path d="M192 343 265 309 394 369 319 407Z" fill="#6e7960" opacity=".22" transform="translate(0 8)"/>
  <path d="M191 322 255 292 390 354 322 388Z" fill="#879779" stroke="#718366" stroke-width="4"/>
  <path d="M187 319 217 305 219 353 190 367Z" fill="#9aa889" stroke="#718366" stroke-width="4"/>
  <path d="M360 354 390 340 390 385 361 399Z" fill="#849473" stroke="#718366" stroke-width="4"/>
  <path d="M219 306 254 290 389 353 356 371Z" fill="url(#sofaFabric)" stroke="#728267" stroke-width="3"/>
  <path d="M222 311 256 296 303 318 269 334Z" fill="#dce0c9"/><path d="M273 335 307 319 353 340 320 358Z" fill="#d1d8bd"/>
  <path d="M193 362 322 421 389 389 389 402 321 436 191 376Z" fill="#6f8063"/>
  <path d="M202 366 321 421 377 395" fill="none" stroke="#c7d0b1" stroke-width="3" opacity=".8"/>
  <path d="M220 380 220 400M361 410 361 427" stroke="#8b674d" stroke-width="7" stroke-linecap="round"/>
 </g>
 <!-- coffee table -->
 <g>
  <path d="M392 382 459 350 524 380 457 413Z" fill="#8f6548" opacity=".22" transform="translate(0 10)"/>
  <path d="M405 375 461 349 518 375 460 402Z" fill="#d9b58e" stroke="#a97e5c" stroke-width="4"/>
  <path d="M423 385 420 415M498 384 501 410" stroke="#936b4e" stroke-width="7" stroke-linecap="round"/>
  <path d="M444 366q12-9 23 0l-2 16q-10 8-19 0Z" fill="#f5eee0" stroke="#b6a58b" stroke-width="2"/><path d="M466 369q15-4 12 9-4 8-12 3" fill="none" stroke="#b6a58b" stroke-width="3"/>
  <path d="M448 365q-2-7 3-10m8 10q-1-8 5-11" stroke="#a9b68c" stroke-width="2" fill="none"/>
 </g>
 <!-- floor lamp -->
 <g><path d="M320 292v65" stroke="#8c684d" stroke-width="6"/><path d="M297 294 342 294 334 265 305 265Z" fill="#e6c96f" stroke="#c5a65a" stroke-width="3"/><path d="M303 298 336 298" stroke="#fff2bc" stroke-width="4"/><ellipse cx="320" cy="362" rx="25" ry="7" fill="#8c684d" opacity=".3"/></g>
 <!-- plants in ceramic pots -->
 <g transform="translate(94 362)"><path d="M-18 20h38l-5 34h-28Z" fill="#c78e70" stroke="#a8755b" stroke-width="3"/><path d="M0 23q-29-24-25-42 21 5 25 42Zm2-4q27-32 39-24-2 24-39 31Zm-1-8Q-5-28 7-40q16 20-3 51Z" fill="#8fa17a" stroke="#6f8666" stroke-width="2"/><path d="M0 25q-8-40 4-57" stroke="#6c815f" stroke-width="3" fill="none"/></g>
 <g transform="translate(548 375) scale(.8)"><path d="M-18 20h38l-5 34h-28Z" fill="#d3a17f" stroke="#ad7d5d" stroke-width="3"/><path d="M0 23q-29-24-25-42 21 5 25 42Zm2-4q27-32 39-24-2 24-39 31Zm-1-8Q-5-28 7-40q16 20-3 51Z" fill="#91a47b" stroke="#6f8666" stroke-width="2"/><path d="M0 25q-8-40 4-57" stroke="#6c815f" stroke-width="3" fill="none"/></g>
 <!-- warm sunlight and dust -->
 <ellipse class="lamp-glow" cx="282" cy="260" rx="190" ry="170" fill="url(#warmGlow)" pointer-events="none"/>
 <g fill="#fff5d5"><circle class="dust" cx="270" cy="208" r="3"/><circle class="dust" cx="346" cy="250" r="2.5"/><circle class="dust" cx="300" cy="285" r="2"/><circle class="dust" cx="235" cy="270" r="2.5"/></g>
 </svg>
 <button class="room-hotspot window" data-house-action="window" aria-label="打开或关闭窗户" title="窗户"></button>
 <button class="room-hotspot fireplace" data-house-action="lamp" aria-label="切换壁炉和暖灯" title="暖灯"></button>
 <button class="room-hotspot sofa" data-house-action="rest" aria-label="坐下休息" title="沙发"></button>
 <button class="room-hotspot lamp" data-house-action="lamp" aria-label="切换室内暖灯" title="暖灯"></button>
 </div>`;
}
function roomArtwork(room){
 const art={
 living:`<path d="M35 145 320 18 605 145 320 285Z" fill="#f2e6d1" stroke="#d9c7a9" stroke-width="5"/><path d="M35 145 320 285 320 430 35 290Z" fill="#f7eddd"/><path d="M320 285 605 145 605 290 320 430Z" fill="#eee1cb"/><path d="M35 290 320 430 605 290" fill="none" stroke="#b88d68" stroke-width="9"/><path d="M85 300 320 405 555 300 320 195Z" fill="#d8bea0" stroke="#f8edda" stroke-width="8"/><path d="M130 300 320 385 510 300 320 215Z" fill="none" stroke="#f8edda" stroke-width="4"/><path d="M90 92 190 48 190 160 90 205Z" fill="#b7d2ce" stroke="#fff5e6" stroke-width="8"/><path d="M140 70v112M91 150l99-45" stroke="#fff8ed" stroke-width="5"/><path d="M410 110 520 160v95l-110-52Z" fill="#87624b" stroke="#c8a47e" stroke-width="9"/><path d="M425 126 505 163v60l-80-38Z" fill="#513b30"/><path class="room-fire" d="M464 215q-24-24-4-50 2 16 13 18-3-23 15-36-5 24 11 36 15 25-7 37-17 8-28-5Z" fill="#efad63"/>`,
 bedroom:`<path d="M35 145 320 18 605 145 320 285Z" fill="#f3e8d6" stroke="#d9c7a9" stroke-width="5"/><path d="M35 145 320 285 320 430 35 290Z" fill="#f8efdf"/><path d="M320 285 605 145 605 290 320 430Z" fill="#efe2ce"/><path d="M35 290 320 430 605 290" fill="none" stroke="#b88d68" stroke-width="9"/><path d="M82 293 320 405 556 293 320 181Z" fill="#e8d8bf" stroke="#fff7e9" stroke-width="7"/><path d="M110 200 245 139 380 202 245 265Z" fill="#b98e6b"/><path d="M110 200 245 265 245 345 110 280Z" fill="#cda985"/><path d="M245 265 380 202 380 282 245 345Z" fill="#f5e7d5"/><path d="M130 204 245 151 355 203 245 257Z" fill="#fffaf0" stroke="#d2b89b" stroke-width="4"/><path d="M145 198 202 172 248 194 191 222Z" fill="#d8b9a5"/><path d="M250 194 305 169 347 190 292 216Z" fill="#d8b9a5"/><path d="M435 90 535 135v100l-100-46Z" fill="#b9d4cf" stroke="#fff7e8" stroke-width="8"/><path d="M485 113v100" stroke="#fff" stroke-width="5"/>`,
 kitchen:`<path d="M35 145 320 18 605 145 320 285Z" fill="#f4ead8" stroke="#d9c7a9" stroke-width="5"/><path d="M35 145 320 285 320 430 35 290Z" fill="#f8efdf"/><path d="M320 285 605 145 605 290 320 430Z" fill="#eee0ca"/><path d="M35 290 320 430 605 290" fill="none" stroke="#b88d68" stroke-width="9"/><path d="M90 220 220 160 350 220 220 282Z" fill="#d9b68f" stroke="#a77c59" stroke-width="5"/><path d="M90 220 220 282 220 350 90 288Z" fill="#c99c73"/><path d="M220 282 350 220 350 288 220 350Z" fill="#e4c29c"/><path d="M115 216 220 168 325 217 220 267Z" fill="#f7f0e3" stroke="#c4a887" stroke-width="4"/><path d="M140 218 220 181 300 219 220 256Z" fill="#74685c"/><circle cx="190" cy="214" r="10" fill="#d4c8b3"/><circle cx="250" cy="214" r="10" fill="#d4c8b3"/><path d="M410 110 535 168v125l-125-58Z" fill="#d7b58e" stroke="#b58a65" stroke-width="5"/><path d="M430 132 515 171v88l-85-40Z" fill="#f4e6d2"/><path d="M445 150 500 175M445 190 500 215" stroke="#c5a17d" stroke-width="4"/>`,
 balcony:`<path d="M35 145 320 18 605 145 320 285Z" fill="#e9e9d9" stroke="#d9c7a9" stroke-width="5"/><path d="M35 145 320 285 320 430 35 290Z" fill="#f4ead9"/><path d="M320 285 605 145 605 290 320 430Z" fill="#e7dfcf"/><path d="M35 290 320 430 605 290" fill="none" stroke="#b88d68" stroke-width="9"/><path d="M72 220 320 342 568 220" fill="none" stroke="#fffaf0" stroke-width="12"/><path d="M72 220 72 155M155 262 155 198M238 303 238 238M320 342 320 278M403 303 403 238M486 262 486 198M568 220 568 155" stroke="#b99c79" stroke-width="8"/><path d="M92 116 185 73 185 180 92 223Z" fill="#b6d4d0" stroke="#fff8ea" stroke-width="7"/><path d="M137 94v110" stroke="#fff" stroke-width="5"/><path d="M430 292 485 265 540 292 485 320Z" fill="#c79d75"/><path d="M442 291 442 345M528 291 528 345" stroke="#98704f" stroke-width="7"/>`
 };
 return art[room]||art.living;
}
function furnitureButton(item,room,index){const arr=farm.house.placed[room]||[],placed=arr.find(x=>x.id===item.id);if(!placed)return '';const x=Math.max(4,Math.min(88,Number(placed.x??(18+(index%3)*28)))),y=Math.max(12,Math.min(78,Number(placed.y??(48+(index%2)*13))));return `<div class="placed-furniture-wrap" style="left:${x}%;top:${y}%"><button class="placed-furniture" data-drag-furniture="${item.id}" data-furniture-room="${room}" aria-label="拖动${item.name}">${item.svg}</button>${farm.house.decorMode?`<button class="furniture-remove" data-remove-furniture="${item.id}" data-furniture-room="${room}">收回</button>`:''}</div>`}

function roomDetailArt(room){
 const common=`<g class="room-architecture" pointer-events="none">
  <path d="M44 148 320 282 596 148" fill="none" stroke="#fff9ec" stroke-width="8" opacity=".75"/>
  <path d="M48 157 320 291 592 157" fill="none" stroke="#c9b18e" stroke-width="2" opacity=".42"/>
  <path d="M43 278 320 414 597 278" fill="none" stroke="#fff8e9" stroke-width="8" opacity=".9"/>
  <path d="M43 286 320 422 597 286" fill="none" stroke="#9c7657" stroke-width="3" opacity=".3"/>
  <path d="M70 170 70 273M110 190 110 294M150 210 150 314M190 230 190 334M230 250 230 354" stroke="#b89b78" stroke-width="1.4" opacity=".15"/>
  <path d="M390 250 390 350M430 230 430 330M470 210 470 310M510 190 510 290M550 170 550 270" stroke="#b89b78" stroke-width="1.4" opacity=".15"/>
  <path d="M75 160 130 188M510 188 565 160" stroke="#fffdf5" stroke-width="3" opacity=".8"/>
  <g class="room-wall-sparkles" fill="#fff9e8"><circle cx="280" cy="110" r="2.2"/><circle cx="350" cy="92" r="1.7"/><circle cx="390" cy="145" r="1.5"/><circle cx="240" cy="160" r="1.4"/></g>
 </g>`;
 const rooms={
 bedroom:`<g class="bedroom-details" pointer-events="none">
   <!-- padded headboard and soft quilt stitching -->
   <path d="M148 195 245 150 343 195 343 215 245 260 148 215Z" fill="#b58b69" stroke="#9d7658" stroke-width="4"/>
   <path d="M160 198 245 160 330 198 245 238Z" fill="#e7d2b9" stroke="#fff4e4" stroke-width="4"/>
   <path d="M173 201 245 168 316 201 245 234Z" fill="#f6ead9"/>
   <path d="M180 203 245 174 309 203 245 232Z" fill="none" stroke="#d7b99b" stroke-width="2" stroke-dasharray="4 5"/>
   <!-- embroidered duvet -->
   <path d="M130 207 245 260 355 207 355 225 245 281 130 228Z" fill="#d8bca3" stroke="#b99170" stroke-width="3"/>
   <path d="M145 218 245 264 340 220M160 226 245 266 325 229" fill="none" stroke="#f9eee0" stroke-width="2" opacity=".9"/>
   <path d="M195 230 245 253 295 230" fill="none" stroke="#b98d70" stroke-width="2" stroke-dasharray="3 4"/>
   <!-- bedside tables -->
   <path d="M392 270 435 250 478 270 435 292Z" fill="#d6b28d" stroke="#a77f5e" stroke-width="3"/>
   <path d="M392 270 435 292 435 332 392 310Z" fill="#bd956f"/><path d="M435 292 478 270 478 310 435 332Z" fill="#d9b995"/>
   <path d="M410 281 435 293 460 281" stroke="#f7e6d1" stroke-width="2"/>
   <path d="M426 251 426 231 435 226 444 231 444 258" fill="#e8d6b7" stroke="#b99b76" stroke-width="2"/>
   <path d="M429 230q-4-13 6-19 10 8 5 19Z" fill="#f2d38c" class="lamp-glow"/>
   <!-- bedside plant -->
   <path d="M92 330 120 316 148 330 120 345Z" fill="#bf9875"/><path d="M102 330 102 353 120 363 138 353 138 330Z" fill="#c88f70"/>
   <g class="sway-plant" transform-origin="120px 320px" fill="#718b64"><path d="M120 321q-27-35-38-14 9 22 38 14Z"/><path d="M120 321q-3-42 17-39 8 24-17 39Z"/><path d="M120 321q22-31 36-15-10 21-36 15Z"/><path d="M120 321q-17-24-30-9 8 18 30 9Z"/></g>
   <!-- wall art -->
   <path d="M420 88 486 58 486 124 420 154Z" fill="#b88e6b" stroke="#fff7e9" stroke-width="6"/>
   <path d="M430 91 476 70 476 119 430 140Z" fill="#e8e3cf"/><path d="M435 126q14-30 34-38" fill="none" stroke="#82936e" stroke-width="4"/>
 </g>`,
 living:`<g class="living-details" pointer-events="none">
   <!-- French linen curtains -->
   <path d="M75 88q24-10 42 2l-4 112q-22 8-34-3Z" fill="#fff7e8" stroke="#e4d2b9" stroke-width="3"/>
   <path d="M174 51q-20-6-33 5l4 109q19 10 30-3Z" fill="#fff7e8" stroke="#e4d2b9" stroke-width="3"/>
   <path d="M82 100q15 12 29 0M83 122q14 12 28 0M149 65q12 10 23 0" fill="none" stroke="#d7c0a5" stroke-width="2"/>
   <!-- sideboard -->
   <path d="M388 280 450 251 515 281 452 311Z" fill="#c79e78" stroke="#a67c59" stroke-width="3"/>
   <path d="M388 280 452 311 452 354 388 323Z" fill="#b88b66"/><path d="M452 311 515 281 515 324 452 354Z" fill="#d6b18a"/>
   <path d="M407 291 452 313 452 335 407 313Z" fill="#ead5b8" stroke="#a77d5a" stroke-width="2"/>
   <circle cx="444" cy="324" r="3" fill="#8e684b"/>
   <!-- potted olive tree -->
   <path d="M70 350 104 334 138 350 104 367Z" fill="#c89472"/><path d="M80 350 80 379 104 392 128 379 128 350Z" fill="#b77f61"/>
   <path d="M104 351 104 286" stroke="#8b694d" stroke-width="7" stroke-linecap="round"/>
   <g class="sway-plant" transform-origin="104px 300px" fill="#78916b"><path d="M104 313q-44-35-48-6 20 22 48 6Z"/><path d="M104 300q-7-48 19-44 14 28-19 44Z"/><path d="M105 307q35-42 53-15-13 28-53 15Z"/><path d="M103 325q-28-20-39-2 17 19 39 2Z"/></g>
   <!-- framed botanical print -->
   <path d="M470 75 535 105v72l-65-30Z" fill="#b98f6b" stroke="#fff5e5" stroke-width="5"/>
   <path d="M480 87 525 108v54l-45-21Z" fill="#f2e8d7"/><path d="M502 145q-8-22 3-36m-3 28q-13-13-18-7m20-5q12-13 17-5" fill="none" stroke="#81916d" stroke-width="3"/>
   <!-- coffee table tray -->
   <ellipse cx="320" cy="372" rx="43" ry="16" fill="#9c7657" opacity=".18"/>
   <path d="M284 350 320 333 356 350 320 368Z" fill="#d7b48e" stroke="#ad805d" stroke-width="3"/>
   <path d="M299 349q12-14 24 0" fill="none" stroke="#fff3df" stroke-width="3"/>
 </g>`,
 kitchen:`<g class="kitchen-details" pointer-events="none">
   <!-- tiled backsplash -->
   <path d="M90 178 220 118 350 178 350 220 220 282 90 220Z" fill="#f3eadb" opacity=".72"/>
   <path d="M115 190 220 141 325 190M115 210 220 259 325 210M167 166 167 235M220 141 220 259M273 166 273 235" stroke="#d5c2a8" stroke-width="2" opacity=".75"/>
   <!-- hanging shelf and crockery -->
   <path d="M405 105 520 159" stroke="#a77c59" stroke-width="8" stroke-linecap="round"/>
   <path d="M425 109 425 143M455 123 455 157M485 137 485 171" stroke="#b98f6c" stroke-width="3"/>
   <path d="M416 140q10-18 20 0v14h-20Z" fill="#e7d7c2" stroke="#bca184" stroke-width="2"/>
   <path d="M447 154q10-18 20 0v14h-20Z" fill="#d8e4d9" stroke="#9cae95" stroke-width="2"/>
   <path d="M477 168q10-18 20 0v14h-20Z" fill="#f0d7c0" stroke="#c8a17e" stroke-width="2"/>
   <!-- fruit bowl -->
   <path d="M255 232q38 30 76 0l-8 17q-30 18-60 0Z" fill="#c88e6b" stroke="#a97555" stroke-width="2"/>
   <circle cx="274" cy="228" r="11" fill="#d98c75"/><circle cx="294" cy="222" r="12" fill="#e3b36e"/><circle cx="313" cy="230" r="10" fill="#8da276"/>
   <!-- towel and hanging herbs -->
   <path d="M535 195q20 2 26 18l-8 46-25-12Z" fill="#f7f0e3" stroke="#d9c6ac" stroke-width="2"/>
   <path d="M535 201q10 7 15 0" fill="none" stroke="#b7a18a" stroke-width="2"/>
   <g class="sway-plant" transform-origin="390px 190px" fill="#82956e"><path d="M390 190q-28-22-30-4 14 17 30 4Z"/><path d="M390 190q-4-28 12-27 8 16-12 27Z"/><path d="M390 190q20-24 29-8-10 16-29 8Z"/></g>
 </g>`,
 balcony:`<g class="balcony-details" pointer-events="none">
   <!-- canopy and string lights -->
   <path d="M65 103q130-55 260 0" fill="none" stroke="#b78f6c" stroke-width="4"/>
   <path d="M92 91 92 105M145 77 145 91M200 68 200 82M255 70 255 84M310 88 310 102" stroke="#b78f6c" stroke-width="2"/>
   <g class="balcony-lights" fill="#f5d98e"><circle cx="92" cy="107" r="5"/><circle cx="145" cy="93" r="5"/><circle cx="200" cy="84" r="5"/><circle cx="255" cy="86" r="5"/><circle cx="310" cy="104" r="5"/></g>
   <!-- flower boxes -->
   <path d="M80 312 130 288 180 312 130 337Z" fill="#b98262" stroke="#986c50" stroke-width="3"/>
   <path d="M91 311 91 338 130 359 169 338 169 311Z" fill="#c58e6b"/>
   <g class="sway-plant" transform-origin="130px 300px" fill="#78936a"><path d="M130 311q-35-34-42-10 17 22 42 10Z"/><path d="M130 311q-4-40 18-40 12 26-18 40Z"/><path d="M130 311q32-35 47-12-14 25-47 12Z"/></g>
   <g fill="#e7a6a0"><circle cx="104" cy="294" r="8"/><circle cx="146" cy="276" r="9"/><circle cx="166" cy="300" r="7"/></g>
   <!-- rattan chair -->
   <path d="M395 270 455 242 515 270 455 300Z" fill="#c9a17a" stroke="#9d7657" stroke-width="4"/>
   <path d="M405 270 405 325M505 270 505 325M420 310 490 310" stroke="#98704f" stroke-width="6" stroke-linecap="round"/>
   <path d="M416 269 455 250 494 269 455 289Z" fill="#f3e5d1" stroke="#b58c67" stroke-width="3"/>
   <!-- lantern -->
   <path d="M540 170 558 160 576 170 558 180Z" fill="#c39a70"/><path d="M546 170 546 207 558 214 570 207 570 170Z" fill="#ead9b8" stroke="#b58c67" stroke-width="2"/><path d="M558 180q-10 13 0 20 10-7 0-20Z" fill="#f2c879" class="lamp-glow"/>
 </g>`
 };
 return `${common}${rooms[room]||rooms.living}`;
}

function roomStage(room){const roomNames={living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'};const placed=(farm.house.placed[room]||[]).map((x,i)=>{const item=furnitureCatalog.find(c=>c.id===x.id);return item?furnitureButton(item,room,i):''}).join('');return `<div class="v11-room-stage ${farm.house.decorMode?'decor-active':''}" data-room-stage="${room}"><svg viewBox="0 0 640 460" role="img" aria-label="奶油法式乡村风${roomNames[room]}2D等距场景"><defs><linearGradient id="v11wall" x2="0" y2="1"><stop stop-color="#fbf3e3"/><stop offset="1" stop-color="#e9ddc7"/></linearGradient><linearGradient id="v11floor" x2="0" y2="1"><stop stop-color="#d9b58e"/><stop offset="1" stop-color="#b98761"/></linearGradient><pattern id="v12wood" width="34" height="18" patternUnits="userSpaceOnUse"><path d="M0 8H34M8 0V8M25 8V18" stroke="#9b7657" stroke-opacity=".12" stroke-width="1"/><path d="M4 3q8-2 15 0" stroke="#fff7e9" stroke-opacity=".35" fill="none"/></pattern><pattern id="v12wallpaper" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="7" cy="8" r="1.2" fill="#c8b89b" opacity=".2"/><path d="M20 17q4-5 7 0" stroke="#c8b89b" stroke-opacity=".15" fill="none"/></pattern></defs>${roomArtwork(room)}<g pointer-events="none" opacity=".52"><path d="M35 145 320 285 605 145" fill="none" stroke="url(#v12wallpaper)" stroke-width="24"/><path d="M35 290 320 430 605 290" fill="none" stroke="url(#v12wood)" stroke-width="118"/><path d="M54 286 320 416 585 286" fill="none" stroke="#fff5e5" stroke-opacity=".42" stroke-width="2"/><path d="M92 318 320 425M150 345 320 430M210 373 320 430M548 310 320 425M490 340 320 425M430 370 320 425" stroke="#916d4e" stroke-opacity=".12" stroke-width="2"/><path d="M70 290 320 412 570 290" fill="none" stroke="#fff8e9" stroke-opacity=".6" stroke-width="3"/></g>${roomDetailArt(room)}<path d="M35 290 320 430 605 290" fill="none" stroke="#a97d59" stroke-width="7" opacity=".65"/><g fill="#fff5d8" opacity=".5"><circle cx="280" cy="170" r="3"/><circle cx="330" cy="205" r="2"/><circle cx="380" cy="150" r="2.5"/></g></svg>${placed}<div class="room-stage-grain"></div><div class="room-weather-wash ${farm.world?.weather==='细雨'?'rainy':farm.world?.weather==='晴'?'sunny':''}"></div></div>`}
function houseView(){
 ensureWorld();const h=farm.house,room=h.currentRoom||'living',names={living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'},ch=storyScene();
 if(!farm.buildings.cottage)return `${header()}<section class="gcard"><b>小屋还没有建好</b><p class="gmuted">先去商店建造温馨小屋，再回来看看吧。</p><button class="primary" data-view="shop">去建造</button></section>`;
 const inv=Object.entries(h.furnitureInventory||{}).filter(([,n])=>n>0).map(([id,n])=>{const item=furnitureCatalog.find(x=>x.id===id);return item&&(item.room==='all'||item.room===room)?`<button data-place-furniture="${id}" data-furniture-room="${room}">${item.svg}<span>${item.name} ×${n}</span></button>`:''}).join('');
 return `<section class="house-page"><div class="house-intro"><button class="house-back" data-view="farm">← 回到农场</button><div class="house-kicker">LOVE RECORD · FRENCH COUNTRY HOME</div><h1>${names[room]}</h1><p>${esc(farm.partnerName||'你们')}的小小家 · ${farm.season}季 · ${farm.world.weather||'晴'}</p></div>
 <div class="room-tabs">${Object.entries(names).map(([id,n])=>`<button data-room="${id}" class="${room===id?'active':''}">${n}</button>`).join('')}</div>
 ${roomStage(room)}
 <section class="house-controls"><div class="house-section-title"><b>${h.decorMode?'装修模式 · 拖动家具摆放':'屋里的小日常'}</b><button data-action="decor-toggle">${h.decorMode?'完成摆放':'进入装修'}</button></div>
 ${h.decorMode?`<p class="gmuted">按住家具拖动到喜欢的位置。家具需要先在装修商店购买。</p><div class="furniture-inventory">${inv||'<p class="gmuted">这个房间还没有可摆放的家具，去商店看看吧。</p>'}</div>`:`<div class="house-action-grid"><button data-house-action="lamp">${houseIcon('lamp')}<b>${h.lampOn?'关掉暖灯':'点亮暖灯'}</b><small>调节室内光线</small></button><button data-house-action="window">${houseIcon('window')}<b>${h.windowOpen?'关上窗户':'打开窗户'}</b><small>听听外面的风声</small></button><button data-house-action="rest">${houseIcon('sofa')}<b>坐下休息</b><small>已休息 ${h.rests||0} 次</small></button><button data-house-action="tea">${houseIcon('tea')}<b>泡一杯热茶</b><small>一起享受安静时光 · ${h.teas||0} 杯</small></button></div>`}
 <div class="house-note">${h.windowOpen?'微风穿过窗户，窗帘轻轻摆动。':h.lampOn?'暖黄色灯光落在木地板上，整个小屋都柔软起来。':'自然光透过窗棂，小屋安静又明亮。'}</div></section>
 <section class="house-memory"><b>共同生活记忆</b><p>${(farm.log||[]).filter(x=>/小屋|休息|热茶|窗户|暖灯|卧室|厨房|阳台/.test(x.text)).slice(0,4).map(x=>esc(x.text)).join(' · ')||'这里还没有留下特别的回忆。今天可以从一杯热茶开始。'}</p></section></section>`;
}

function coopScene(){const count=farm.animals.chickens||0,eggs=farm.inventory.egg||0;return `<section class="facility-page"><div class="facility-intro"><button class="house-back" data-view="farm">← 回到农场</button><span>FRENCH COUNTRY FARM · CHICKEN COOP</span><h1>小鸡窝</h1><p>木头与干草的香气里，住着 ${count} 只小鸡。</p></div><div class="facility-stage coop-stage"><svg viewBox="0 0 640 430" role="img" aria-label="法式乡村风木制鸡舍等距场景"><defs><linearGradient id="coopWood" x2="0" y2="1"><stop stop-color="#e8c99f"/><stop offset="1" stop-color="#b9865e"/></linearGradient><linearGradient id="coopRoof" x2="0" y2="1"><stop stop-color="#b9775e"/><stop offset="1" stop-color="#8d5948"/></linearGradient></defs><path d="M35 320 320 175 605 320 320 410Z" fill="#d7c79f"/><path d="M80 300 320 175 560 300 320 385Z" fill="#e8dfc4" stroke="#c8b58f" stroke-width="5"/><path d="M180 190 320 95 470 190 320 275Z" fill="url(#coopWood)" stroke="#956b4d" stroke-width="7"/><path d="M165 190 320 70 485 190 452 208 320 112 198 211Z" fill="url(#coopRoof)" stroke="#805440" stroke-width="6"/><path d="M320 112v162M198 211v80l122 65V275M452 208v82l-132 55" fill="none" stroke="#9a6c4d" stroke-width="6"/><path d="M260 250q60-55 120 0v88l-120-60Z" fill="#76533d" stroke="#f0d6b1" stroke-width="6"/><path d="M280 259q40-35 80 0v64l-80-40Z" fill="#d9b68a"/><path d="M295 277v46m25-58v69m25-56v69" stroke="#b58b61" stroke-width="5"/><g fill="#f1d9b2"><ellipse cx="220" cy="326" rx="35" ry="12"/><ellipse cx="420" cy="340" rx="42" ry="14"/></g><g class="coop-chicken-svg"><ellipse cx="210" cy="286" rx="27" ry="21" fill="#fff4df"/><circle cx="228" cy="265" r="15" fill="#fff4df"/><path d="m238 265 17 6-16 7Z" fill="#e7a35f"/><path d="M220 249q-8-16 4-18 7 12 13 2 10 13-4 19Z" fill="#d98772"/><circle cx="232" cy="263" r="2.5" fill="#594638"/><path d="M200 303v10m18-10v10" stroke="#bd895c" stroke-width="4" stroke-linecap="round"/><ellipse cx="390" cy="318" rx="23" ry="18" fill="#fff4df"/><circle cx="405" cy="300" r="13" fill="#fff4df"/><path d="m414 301 14 5-14 5Z" fill="#e7a35f"/><circle cx="409" cy="298" r="2" fill="#594638"/></g><g fill="#fffdf5" stroke="#d9c4a3" stroke-width="3"><ellipse cx="345" cy="350" rx="11" ry="15"/><ellipse cx="370" cy="358" rx="11" ry="15"/><ellipse cx="394" cy="366" rx="11" ry="15"/></g><path d="M95 333q30-35 60 0m-35 5q25-25 48 0" stroke="#8d9d72" stroke-width="7" fill="none" stroke-linecap="round"/></svg><div class="facility-sunlight"></div></div><div class="facility-actions"><article><b>雞舍日常</b><p>小鸡会在这里休息、啄食，也会留下新鲜鸡蛋。</p><div class="facility-counts"><span>小鸡 <strong>${count}</strong> 只</span><span>待收鸡蛋 <strong>${eggs}</strong> 枚</span></div><button class="primary" data-coop-action="collect" ${eggs>0?'':'disabled'}>收集鸡蛋 · ${eggs} 枚</button><button data-action="buy-chicken">领养小鸡 · 45 金币</button></article></div></section>`}
function pondScene(){const fish=(farm.pond?.fishVisits||0);return `<section class="facility-page"><div class="facility-intro"><button class="house-back" data-view="farm">← 回到农场</button><span>FRENCH COUNTRY FARM · GARDEN POND</span><h1>小池塘</h1><p>荷叶在水面轻轻摇晃，偶尔有小鱼游过。</p></div><div class="facility-stage pond-stage"><svg viewBox="0 0 640 430" role="img" aria-label="法式乡村花园小池塘等距场景"><defs><linearGradient id="pondGrass" x2="0" y2="1"><stop stop-color="#dce6c9"/><stop offset="1" stop-color="#b9c99d"/></linearGradient><linearGradient id="pondWater" x2="0" y2="1"><stop stop-color="#a8cfc8"/><stop offset="1" stop-color="#6faaa2"/></linearGradient></defs><path d="M30 300 320 150 610 300 320 420Z" fill="url(#pondGrass)"/><path d="M115 286 320 182 525 286 320 390Z" fill="#b78d69" opacity=".55"/><path d="M130 270 320 175 510 270 320 365Z" fill="url(#pondWater)" stroke="#f1e4c9" stroke-width="12"/><path d="M160 270 320 193 480 270 320 347Z" fill="none" stroke="#d6eee0" stroke-width="4" opacity=".7"/><g class="pond-ripple" fill="none" stroke="#e6f4e8" stroke-width="4"><ellipse cx="300" cy="260" rx="75" ry="24"/><ellipse cx="300" cy="260" rx="112" ry="38" opacity=".5"/></g><g fill="#718e62" stroke="#56784e" stroke-width="3"><path d="M210 244q-35-38-65-6 20 35 65 6Z"/><path d="M400 282q28-42 65-15-12 38-65 15Z"/><path d="M330 218q-8-48 30-56 22 40-30 56Z"/></g><g fill="#e8a8a2" stroke="#c77f7a" stroke-width="2"><path d="M332 218q-25-35 0-43 22 9 0 43Zm0 0q28-34 44-13-5 24-44 13Zm0 0q-10 38-31 25-6-20 31-25Z"/></g><g class="pond-fish-svg"><path d="M240 300q35-25 70 0-35 25-70 0Z" fill="#e5a46f"/><path d="m240 300-18-15v30Z" fill="#d88b5d"/><circle cx="290" cy="297" r="3" fill="#594638"/><path d="M370 250q25-18 50 0-25 18-50 0Z" fill="#e9e1c6"/><path d="m370 250-13-12v24Z" fill="#d6c7a7"/><circle cx="410" cy="247" r="2.5" fill="#594638"/></g><g fill="#fff5df"><circle cx="180" cy="250" r="5"/><circle cx="450" cy="310" r="4"/><circle cx="355" cy="330" r="3"/></g></svg></div><div class="facility-actions"><article><b>池塘边的慢时光</b><p>来池塘边坐一会儿，看看鱼儿和荷花。每次散步都会得到一点小小的金币奖励。</p><div class="facility-counts"><span>散步次数 <strong>${fish}</strong></span><span>池塘纪念 <strong>已保存</strong></span></div><button class="primary" data-pond-action="walk">沿池塘散步 · +12 金币</button><button data-pond-action="feed">喂小鱼 · 8 金币</button></article></div></section>`}
function facilityVisit(kind){ensureDailyProgress();farm.dailyProgress.facilityVisits++;if(kind==='pond')farm.stats.pondVisits=(farm.stats.pondVisits||0)+1;if(kind==='coop')farm.stats.coopVisits=(farm.stats.coopVisits||0)+1;save()}
function worldEventCard(){const ev=farm.world?.pendingEvent;if(!ev)return `<section class="gcard world-card"><div class="world-card-top"><b>季节与天气</b><span>${farm.season}季 · ${farm.world?.weather||'晴'}</span></div><p>今天适合${farm.world?.weather==='细雨'?'在屋檐下整理花园':farm.world?.weather==='微风'?'去阳台坐一会儿':farm.world?.weather==='多云'?'慢慢照看作物':'出门走走'}。${farm.day%7===0?' 小镇节日正在举行。':''}</p><small>每七个农场日会迎来一次季节庆典，天气和小事件会随日子变化。</small></section>`;return `<section class="gcard world-card event-pending"><div class="world-card-top"><b>${ev.kind==='festival'?'季节庆典':'农场小事件'} · ${esc(ev.title)}</b><span>+${ev.coins} 金币</span></div><p>${esc(ev.desc)}</p><button class="primary" data-action="claim-world-event">收下这份惊喜 · ${ev.coins} 金币</button></section>`}
function farmView(){
 const plots=farm.plots.map(p=>{const c=crops[p.crop];if(!c)return `<button class="plot empty" data-plot="${p.id}"><span class="cropemoji">＋</span><small>空地 · 播种</small></button>`;const ready=mature(p);return `<button class="plot ${ready?'ready':''}" data-plot="${p.id}"><span class="cropemoji">${ready?c.emoji:['🌱','🌿','🌾'][Math.min(2,Math.floor((1-remaining(p)/Math.max(1,(p.readyAt-p.plantedAt)/1000))*3))]||'🌱'}</span><b>${c.name}</b><small>${ready?'点击收获':fmt(remaining(p))}</small></button>`}).join('');
 const need=farm.level*35;
 return `${header()}<section class="gcard"><div class="grow" style="justify-content:space-between"><b>存档保护</b><button data-view="rescue">🛟 存档急救中心</button></div><p class="gmuted">如果农场进度异常，可以扫描浏览器里的旧备份；扫描不会修改存档。</p></section>${partnerCard()}<section class="gcard"><div class="grow" style="justify-content:space-between"><b>🌤️ 今日农场</b><span class="gmuted">${farm.season}季 · 第${farm.day}天</span></div><div class="gnotice">已建造 ${Object.values(farm.buildings).filter(Boolean).length} 座设施 · 小鸡 ${farm.animals.chickens||0} 只 · 鸡蛋 ${farm.inventory.egg||0} 枚</div><div class="gxp"><span>农场经验 ${farm.xp}/${need}</span><i><b style="width:${Math.min(100,farm.xp/need*100)}%"></b></i></div></section>
 <section class="gcard"><div class="grow" style="justify-content:space-between"><b>我们的菜园</b><span class="gmuted">${farm.plots.length} 块土地</span></div><div class="gmap" style="margin-top:12px">${plots}</div><p class="gmuted">选择种子，再点击一块空地；每次只种一块。作物会快速成长。</p></section>
 ${farmyardView()}\n ${worldEventCard()}\n <section class="gcard"><div class="grow" style="justify-content:space-between"><b>选择种子</b><span class="gmuted">当前：${crops[selectedSeed]?.emoji||'🌱'} ${crops[selectedSeed]?.name||'胡萝卜'}</span></div><div class="ggrid" style="margin-top:10px">${farm.unlocked.map(id=>{const c=crops[id];return `<button class="gseed ${selectedSeed===id?'active':''}" data-seed="${id}"><span class="emoji">${c.emoji}</span><span><b>${c.name}</b><small>${c.cost} 金币 · ${Math.round(c.time/60)} 分钟成熟 · 库存 ${farm.inventory['seed_'+id]||0}</small></span></button>`}).join('')}</div><div class="grow" style="margin-top:12px"><button data-action="water-all">💧 浇水加速</button><button data-view="life" class="primary">查看今日委托与金币奖励</button></div></section>
 <section class="gcard"><b>农场近况</b><div class="glog" style="margin-top:10px">${farm.log.slice(0,4).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p class="gmuted">你们的农场刚刚开始，来种下第一颗种子吧。</p>'}</div></section>`;
}

function shopView(){
 const buildings=[['coop','🐔','小鸡窝',90,'让小鸡入住，定期收获鸡蛋'],['pond','🪷','小池塘',120,'解锁池塘边的宁静时光'],['cottage','🏡','温馨小屋',180,'为农场增加一处休息空间']];
 return `${header()}<h2 class="gtitle">小镇商店</h2><p class="gsub">按类别收纳货架，想买什么再展开看看。</p>
 <details class="gcard shop-accordion" open><summary><span>种子铺</span><small>作物种子 · ${Object.keys(crops).length} 种</small></summary><div class="shop-accordion-body">${Object.entries(crops).map(([id,c])=>`<div class="grow shop-product-row"><span class="shop-product-art">${c.emoji}</span><div style="flex:1"><b>${c.name}</b><div class="gmuted">${c.desc} · 售价 ${c.sell} 金币</div></div><button data-buy="${id}">购买 · ${c.cost}</button></div>`).join('')}</div></details>
 <details class="gcard shop-accordion"><summary><span>动物用品</span><small>小鸡与农场伙伴</small></summary><div class="shop-accordion-body"><div class="grow shop-product-row"><span class="shop-product-art">🐥</span><div style="flex:1"><b>小鸡</b><div class="gmuted">每只 45 金币 · 每隔一段时间产出鸡蛋</div><small>现有 ${farm.animals.chickens||0} 只</small></div><button data-action="buy-chicken">领养 · 45</button></div></div></details>
 <details class="gcard shop-accordion"><summary><span>家具商店</span><small>家具与软装 · ${furnitureCatalog.length} 件</small></summary><div class="shop-accordion-body"><p class="gmuted">购买后放入当前联系人的家具库存，可在小屋装修模式中自由拖动摆放。</p>${furnitureCatalog.map(item=>`<div class="furniture-shop-row">${item.svg}<div><b>${item.name}</b><small>${item.room==='all'?'所有房间均可使用':({bedroom:'卧室',kitchen:'厨房',balcony:'阳台'}[item.room])}</small></div><strong>${item.price} 金币</strong><button data-buy-furniture="${item.id}">购买</button></div>`).join('')}</div></details>
 <details class="gcard shop-accordion"><summary><span>建筑与扩建</span><small>农场设施 · ${buildings.length} 项</small></summary><div class="shop-accordion-body">${buildings.map(([id,emoji,name,cost,desc])=>`<div class="grow shop-product-row"><span class="shop-product-art">${emoji}</span><div style="flex:1"><b>${name}</b><div class="gmuted">${desc}</div></div>${farm.buildings[id]?'<span>已建造 ✓</span>':`<button data-build="${id}" data-cost="${cost}">建造 · ${cost}</button>`}</div>`).join('')}<p class="gmuted">农场扩建</p><button class="primary" data-action="expand" ${farm.plots.length>=18?'disabled':''}>增加一块土地 · ${80+Math.max(0,farm.plots.length-9)*35} 金币</button></div></details>`;
}

function bagView(){
 const rows=Object.entries(farm.inventory).filter(([,n])=>n>0);
 const achievements=[['first-plant','🌱','初次播种',farm.stats.planted>=1],['first-harvest','🌾','第一次收获',farm.stats.harvests>=1],['green-thumb','🌿','种植十次',farm.stats.planted>=10],['little-farm','🏡','建设小屋',farm.buildings.cottage]];
 return `${header()}<h2 class="gtitle">共同仓库</h2><p class="gsub">收获、制作与收藏，都在这里慢慢积累。</p>
 <section class="gcard"><b>仓库库存</b>${rows.length?rows.map(([id,n])=>{const cropId=id.startsWith('seed_')?id.slice(5):id;const c=crops[cropId];const itemName=id.startsWith('seed_')?`${c?.name||cropId}种子`:c?.name;return `<div class="grow" style="padding:10px 0;border-bottom:1px solid #eee2d5"><span style="font-size:25px">${c?.emoji|| (id==='egg'?'🥚':'📦')}</span><b style="flex:1">${itemName|| (id==='egg'?'鸡蛋':id)}</b><span>× ${n}</span>${(c||id==='egg')?`<button data-sell="${id}">出售</button>`:''}</div>`}).join(''):'<p class="gmuted">仓库还是空的，收获作物后就会出现在这里。</p>'}</section>
 <section class="gcard"><b>🧺 手作工坊</b><p class="gmuted">把收获变成小小的礼物。</p><div class="grow"><span>💐 花束（需要 2 雏菊）</span><button data-craft="bouquet">制作 · 已有 ${farm.crafted.bouquet||0}</button></div><div class="grow" style="margin-top:10px"><span>🍓 果酱（需要 2 草莓）</span><button data-craft="jam">制作 · 已有 ${farm.crafted.jam||0}</button></div></section>
 <details class="gcard farm-fold farm-fold-achievement-board"><summary class="farm-fold-summary"><span><b>🏅 农场成就</b><small>完成里程碑，领取金币</small></span><strong class="farm-fold-meta">${(farm.achievementClaims||[]).length}/${achievementDefs().length} 已领取</strong><span class="farm-fold-chevron" aria-hidden="true">⌄</span></summary><div class="farm-fold-content"><div class="grow" style="justify-content:space-between"><b>🏅 农场成就</b><span class="gmuted">完成里程碑，领取金币</span></div>${achievementDefs().map(([id,name,desc,ok,reward])=>{const got=(farm.achievementClaims||[]).includes(id);return `<div class="achievement-row"><div><b>${name}</b><small>${desc}</small></div><span>+${reward} 金币</span>${got?'<em>已领取 ✓</em>':`<button data-achievement-claim="${id}" ${ok?'':'disabled'}>${ok?'领取':'未达成'}</button>`}</div>`}).join('')}</div></details>
 
 <section class="gcard"><b>经营记录</b><div class="gstats"><div class="gstat"><b>${farm.stats.planted}</b>播种次数</div><div class="gstat"><b>${farm.stats.harvests}</b>收获次数</div><div class="gstat"><b>${farm.xp}</b>经验值</div></div></section>`;
}

function lifeView(){
 ensureDailyProgress();ensureWeekly();const d=farm.dailyProgress,claimed=farm.quest.claimed||[];
 const tasks=dailyTaskDefs.map(t=>{const done=t.done(d),got=claimed.includes(t.id);return `<div class="daily-task ${done?'is-done':''}"><div class="daily-task-mark">${done?'✓':'○'}</div><div class="daily-task-copy"><b>${t.label}</b><small>${t.detail}</small></div><span class="daily-task-reward">+${t.reward} 金币</span>${got?'<span class="daily-task-claimed">已领取</span>':`<button data-task-claim="${t.id}" ${done?'':'disabled'}>${done?'领取':'未完成'}</button>`}</div>`}).join('');
 const completed=dailyTaskDefs.filter(t=>t.done(d)).length,allClaimed=dailyTaskDefs.every(t=>claimed.includes(t.id)),bonusClaimed=claimed.includes('daily-bonus');
 return `${header()}<h2 class="gtitle">农场日常</h2><p class="gsub">每天做一点小事，金币和成就都会慢慢积累。</p>
 <details class="gcard farm-fold farm-fold-daily-board"><summary class="farm-fold-summary"><span><b>📋 今日委托</b><small>完成任务领取金币</small></span><strong class="farm-fold-meta">${completed}/${dailyTaskDefs.length} 项</strong><span class="farm-fold-chevron" aria-hidden="true">⌄</span></summary><div class="farm-fold-content"><div class="daily-board-head"><div><b>今日委托</b><small>完成任务就能领取金币，不必等全部做完</small></div><strong>${completed}/${dailyTaskDefs.length}</strong></div><div class="daily-progress"><i style="width:${completed/dailyTaskDefs.length*100}%"></i></div>${tasks}<div class="daily-bonus"><div><b>今日全勤奖励</b><small>领取全部 ${dailyTaskDefs.length} 项任务后额外获得 60 金币</small></div>${bonusClaimed?'<span>已领取 ✓</span>':`<button data-action="daily-bonus" ${allClaimed?'':'disabled'}>领取 · 60 金币</button>`}</div></div></details>
 
 <details class="gcard farm-fold farm-fold-story-board"><summary class="farm-fold-summary"><span><b>♡ 共同记忆</b><small>和搭档一起写下的故事</small></span><strong class="farm-fold-meta">第${Math.min((farm.story?.chapter||0)+1,4)} / 4 章</strong><span class="farm-fold-chevron" aria-hidden="true">⌄</span></summary><div class="farm-fold-content"><div class="world-card-top"><b>共同故事 · ${Math.min((farm.story?.chapter||0)+1,4)} / 4</b><span>每次点击调用主页 API</span></div><h3>${esc(storyScene().title)}</h3><p>${esc(storyScene().desc)}</p>${farm.story?.lastGenerated?.text?`<div class="generated-story"><b>最近写下 · ${esc(farm.story.lastGenerated.title)}</b><br>${esc(farm.story.lastGenerated.text)}<small>— ${esc(farm.story.lastGenerated.season||farm.season)}季 · 第${farm.story.lastGenerated.day||farm.day}天</small></div>`:''}<button class="primary" data-action="story-progress" ${storyScene().need()&&!busy?'':'disabled'}>${busy?'搭档正在写故事…':storyScene().need()?'生成这一章共同故事 · +'+storyScene().reward+' 金币':storyScene().id==='story-complete'?'四章故事已完成':'先建造温馨小屋或对应设施'}</button><div class="gmuted" style="margin-top:8px">每次生成都会单独请求一次主页 API；成功后才推进章节、发放奖励并保存。${esc(apiMessage||'')}</div>${(farm.story?.generated||[]).length>1?`<details class="story-archive"><summary>翻看以前的故事 · ${farm.story.generated.length} 篇</summary>${farm.story.generated.slice(1,6).map(x=>`<article><b>${esc(x.title)}</b><p>${esc(x.text)}</p></article>`).join('')}</details>`:''}</div></details>
 
 <section class="gcard weekly-board"><div class="world-card-top"><b>本周经营目标</b><span>${farm.weekly?.harvested||0}/250 次收获</span></div><p>本周累计收获 250 份作物，可领取额外 150 金币。</p><div class="weekly-progress"><i style="width:${Math.min(100,(farm.weekly?.harvested||0)/250*100)}%"></i></div><button data-action="weekly-claim" ${((farm.weekly?.harvested||0)>=250&&!farm.weekly?.claimed)?'':'disabled'}>${farm.weekly?.claimed?'本周已领取':'领取周奖励 · 150 金币'}</button></section>
 <section class="gcard"><b>和搭档聊聊</b><p class="gmuted">聊聊今天的农场、商量种什么，或邀请对方做一件事。</p><textarea id="farmChat" placeholder="和${esc(farm.partnerName||'搭档')}说点什么…"></textarea><button class="primary" data-action="talk" style="margin-top:10px" ${!farm.partnerId?'disabled':''}>发送给搭档</button><div class="gnotice" style="margin-top:10px">${esc(apiMessage||'互动时才调用主页 API，不会在每次种植时请求。')}</div></section>
 <section class="gcard"><div class="grow" style="justify-content:space-between"><b>共同日记</b><button data-action="daily">让搭档分享今天的农场日记</button></div><div class="glog" style="margin-top:12px">${farm.log.slice(0,15).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p>今天是你们农场的第一天。</p>'}</div></section>`;
}
function render(){const b=$('#gbody');if(!b)return;if(storageBlocked&&view!=='rescue'){b.innerHTML='<section class="gcard"><b>正在保护你的农场存档</b><p class="gmuted">数据库暂时无法读取。为了避免把旧农场覆盖成新农场，游戏已暂停操作。请先关闭其他 LOVE RECORD 页面，再重新尝试读取。</p><button class="primary" data-action="retry-storage">重新读取存档</button><button data-view="rescue">🛟 扫描旧存档</button></section>';return}if(view==='life')ensureDailyProgress();try{const openedFolds=[...b.querySelectorAll('details.farm-fold[open]')].map(x=>x.className);b.innerHTML=view==='rescue'?rescueView():view==='farm'?farmView():view==='house'?houseView():view==='coop'?coopScene():view==='pond'?pondScene():view==='shop'?shopView():view==='bag'?bagView():lifeView();for(const fold of b.querySelectorAll('details.farm-fold'))if(openedFolds.includes(fold.className))fold.open=true;const dock=$('#farmDock');if(dock)dock.innerHTML=tabs();const title=$('#gbarTitle');if(title)title.textContent=view==='house'?`温馨小屋 · ${{living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'}[farm.house?.currentRoom||'living']}`:view==='coop'?'小鸡窝 · 鸡舍':view==='pond'?'小池塘 · 花园':'OUR LITTLE FARM · 我们的小农场'}catch(e){console.error('[Farm] render failed',e);b.innerHTML='<section class="gcard"><b>农场暂时无法显示</b><p class="gmuted">页面渲染遇到错误。你的存档没有因此被主动清除，请返回后重试。</p><button class="primary" onclick="window.LoveRecordGames&&window.LoveRecordGames.open()">重新打开农场</button></section>'}}
function plant(id,seed){const p=farm.plots.find(x=>x.id===id);if(!p||p.crop)return false;const c=crops[seed];if(!c){return false}const seedKey='seed_'+seed;if((farm.inventory[seedKey]||0)<=0){toast('种子不够啦，可以去商店购买');return false}farm.inventory[seedKey]--;p.crop=seed;p.plantedAt=Date.now();p.readyAt=Date.now()+c.time*1000;p.watered=false;farm.stats.planted++;ensureDailyProgress();farm.dailyProgress.planted++;farm.xp+=2;addLog(`你们种下了${c.name}。`);save();return true}
function harvest(id){const p=farm.plots.find(x=>x.id===id);if(!p||!p.crop)return;if(!mature(p)){toast('还在努力生长中，再等等哦');return}const c=crops[p.crop];farm.inventory[p.crop]=(farm.inventory[p.crop]||0)+1;farm.stats.harvests++;ensureWeekly();farm.weekly.harvested=(farm.weekly.harvested||0)+1;ensureDailyProgress();farm.dailyProgress.harvested++;farm.xp+=5;addLog(`收获了 ${c.name} × 1，放进共同仓库啦。`);p.crop='';p.plantedAt=0;p.readyAt=0;p.watered=false;if(farm.xp>=farm.level*35){farm.xp-=farm.level*35;farm.level++;addLog(`农场升到 ${farm.level} 级啦！`)}save();render()}
async function callAI(userText,kind){const c=cfg();if(!c.base||!c.key||!c.model){apiMessage='主页 API 尚未连接；农场功能仍可正常使用。';toast('主页 API 尚未连接');render();return}if(busy)return;busy=true;apiMessage='搭档正在想怎么回应…';render();try{const prompt=`你正在与用户共同经营一个温馨的手绘风农场。联系人名字：${farm.partnerName||'搭档'}。农场季节：${farm.season}，第${farm.day}天，等级${farm.level}，金币${farm.coins}。最近农场记录：${farm.log.slice(0,5).map(x=>x.text).join('；')}。用户的内容：${userText}。请以联系人本人的口吻，用自然亲切的中文回应，1-3句话，不要提AI，不要输出系统说明。`;const r=await fetch(c.base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},body:JSON.stringify({model:c.model,messages:[{role:'system',content:'你是用户的农场共同主人，拥有自己的性格，与你的搭档平等经营农场。'}, {role:'user',content:prompt}],stream:false})});const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status);const j=JSON.parse(raw);const answer=j.choices?.[0]?.message?.content?.trim();if(!answer)throw new Error('没有收到有效回复');addLog(`${farm.partnerName||'搭档'}：${answer}`,'partner');apiMessage='搭档回复啦。';save()}catch(e){apiMessage='这次没有联系上搭档，农场内容已经保留。';console.warn('[Farm API]',e);toast(apiMessage)}finally{busy=false;render()}}
async function onChange(e){
 if(e.target.id!=='farmPartner'||switchingOwner)return;
 const nextId=ownerKey(e.target.value);if(nextId===ownerKey(activeOwnerId))return;
 switchingOwner=true;const select=e.target;select.disabled=true;
 try{
  const oldId=ownerKey(activeOwnerId);const oldSaved=await save();if(!oldSaved)throw new Error('当前农场未能保存，已取消切换以免覆盖进度');
  activeOwnerId=nextId;try{localStorage.setItem(ACTIVE_KEY,nextId)}catch(_){}
  farm=await hydrateOwner(nextId);
  const person=personFor(nextId);farm.partnerId=nextId==='solo'?'':nextId;farm.partnerName=person?.remark||person?.name||farm.partnerName||'';farm.partnerAvatar=person?.avatar||farm.partnerAvatar||'';
  addLog(person?`已进入 ${farm.partnerName} 的独立农场。`:'已进入个人农场。','note');
  const ok=await save();if(!ok)throw new Error('新农场载入了，但保存失败');
  selectedSeed='carrot';apiMessage='';view='farm';toast(person?'已切换到独立农场':'已切换到个人农场');
 }catch(err){console.error('[Farm] owner switch failed',err);toast(err.message||'切换失败，原农场数据已保留');}
 finally{switchingOwner=false;render()}
}
let furnitureDrag=null;
function onFurniturePointerDown(e){const b=e.target.closest('[data-drag-furniture]');if(!b||!farm.house.decorMode)return;const stage=b.closest('[data-room-stage]'),wrap=b.closest('.placed-furniture-wrap');if(!stage||!wrap)return;const rect=stage.getBoundingClientRect();furnitureDrag={id:b.dataset.dragFurniture,room:b.dataset.furnitureRoom,stage,rect,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,left:parseFloat(wrap.style.left)||50,top:parseFloat(wrap.style.top)||50,el:wrap};try{b.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()}
function onFurniturePointerMove(e){if(!furnitureDrag||e.pointerId!==furnitureDrag.pointerId)return;const d=furnitureDrag,dx=(e.clientX-d.startX)/d.rect.width*100,dy=(e.clientY-d.startY)/d.rect.height*100;d.el.style.left=Math.max(3,Math.min(90,d.left+dx))+'%';d.el.style.top=Math.max(8,Math.min(84,d.top+dy))+'%'}
function onFurniturePointerUp(e){if(!furnitureDrag||e.pointerId!==furnitureDrag.pointerId)return;const d=furnitureDrag;const arr=farm.house.placed[d.room]||(farm.house.placed[d.room]=[]);let item=arr.find(x=>x.id===d.id);if(!item){item={id:d.id};arr.push(item)}item.x=parseFloat(d.el.style.left)||d.left;item.y=parseFloat(d.el.style.top)||d.top;furnitureDrag=null;save()}
async function onClick(e){const b=e.target.closest('button');if(!b)return;if(b.dataset.action==='rescue-scan'){scanFarmArchives();return}if(b.dataset.rescueRestore!==undefined){restoreFarmArchive(b.dataset.rescueRestore);return}if(b.dataset.view==='rescue'){view='rescue';render();return}if(storageBlocked){if(b.dataset.action==='retry-storage')retryStorageLoad();else toast('存档读取尚未恢复，暂时暂停操作以保护旧数据');return}if(switchingOwner)return;if(b.dataset.room){if(!['living','bedroom','kitchen','balcony'].includes(b.dataset.room))return;farm.house.currentRoom=b.dataset.room;farm.house.roomsVisited=Array.isArray(farm.house.roomsVisited)?farm.house.roomsVisited:[];if(!farm.house.roomsVisited.includes(b.dataset.room))farm.house.roomsVisited.push(b.dataset.room);ensureDailyProgress();farm.dailyProgress.roomsVisited=(farm.dailyProgress.roomsVisited||0)+1;save();render();return}if(b.dataset.buyFurniture){const item=furnitureCatalog.find(x=>x.id===b.dataset.buyFurniture);if(!item)return;if(farm.coins<item.price){toast('金币还不够，慢慢攒起来哦');return}farm.coins-=item.price;farm.house.furnitureInventory[item.id]=(farm.house.furnitureInventory[item.id]||0)+1;addLog(`购买了家具「${item.name}」，可以去小屋布置啦。`);save();toast(`${item.name}已放入家具库存`);render();return}if(b.dataset.removeFurniture){const id=b.dataset.removeFurniture,room=b.dataset.furnitureRoom;farm.house.placed[room]=(farm.house.placed[room]||[]).filter(x=>x.id!==id);farm.house.furnitureInventory[id]=(farm.house.furnitureInventory[id]||0)+1;save();render();return}if(b.dataset.placeFurniture){const id=b.dataset.placeFurniture,room=b.dataset.furnitureRoom;const inv=farm.house.furnitureInventory[id]||0;if(!inv){toast('家具库存不足');return}const catalogItem=furnitureCatalog.find(x=>x.id===id);if(catalogItem&&catalogItem.room!=='all'&&catalogItem.room!==room){toast('这件家具适合放在'+({bedroom:'卧室',kitchen:'厨房',balcony:'阳台'}[catalogItem.room]||'指定房间'));return}const arr=farm.house.placed[room]||(farm.house.placed[room]=[]);if(arr.some(x=>x.id===id)){toast('这件家具已经摆在房间里了');return}arr.push({id,x:45+(arr.length%3)*10,y:48+(arr.length%2)*9});farm.house.furnitureInventory[id]=inv-1;save();render();return}if(b.dataset.action==='decor-toggle'){farm.house.decorMode=!farm.house.decorMode;render();return}if(b.dataset.action==='claim-world-event'){const ev=farm.world?.pendingEvent;if(!ev){toast('这份惊喜已经被收下啦');return}farm.coins+=Number(ev.coins)||0;farm.xp+=Number(ev.xp)||0;if(ev.kind==='festival'){farm.world.festivalClaims=Array.isArray(farm.world.festivalClaims)?farm.world.festivalClaims:[];farm.world.festivalClaims.push(ev.id)}farm.world.pendingEvent=null;ensureDailyProgress();farm.dailyProgress.eventsClaimed=(farm.dailyProgress.eventsClaimed||0)+1;addLog(`参与「${ev.title}」，获得 ${ev.coins} 金币和 ${ev.xp} 经验。`,'event');save();toast(`惊喜奖励 +${ev.coins} 金币`);render();return}if(b.dataset.action==='story-progress'){const ch=storyScene();if(!ch.need()){toast('先把对应的设施准备好哦');return}if(busy){toast('搭档正在写故事，请稍等');return}await storyClaim();return}if(b.dataset.action==='weekly-claim'){ensureWeekly();if((farm.weekly.harvested||0)<250||farm.weekly.claimed){toast('本周目标还没完成哦');return}farm.weekly.claimed=true;farm.coins+=150;farm.xp+=20;addLog('完成本周经营目标，获得 150 金币。');save();toast('周奖励 +150 金币');render();return}if(b.dataset.view){view=b.dataset.view;if(view==='shop'){ensureDailyProgress();farm.dailyProgress.shopVisits++;save()}render();return}if(b.dataset.facility){const kind=b.dataset.facility;if(!farm.buildings[kind]){toast('先建造这处设施哦');return}facilityVisit(kind);view=kind;render();return}if(b.dataset.coopAction==='collect'){const eggs=farm.inventory.egg||0;if(!eggs){toast('还没有鸡蛋，过一会儿再来看看');return}farm.inventory.egg=0;farm.coop=farm.coop||{};farm.coop.collected=(farm.coop.collected||0)+eggs;ensureDailyProgress();farm.dailyProgress.eggsCollected+=eggs;farm.coins+=eggs*8;farm.xp+=eggs*2;addLog(`从小鸡窝收集了 ${eggs} 枚鸡蛋，获得 ${eggs*8} 金币。`);save();toast(`收集完成！+${eggs*8} 金币`);render();return}if(b.dataset.pondAction==='walk'){farm.pond=farm.pond||{fishVisits:0,feedings:0};farm.pond.fishVisits=(farm.pond.fishVisits||0)+1;farm.coins+=12;farm.xp+=2;addLog('你沿着池塘散步，收获了 12 金币。');save();toast('池塘散步完成 · +12 金币');render();return}if(b.dataset.pondAction==='feed'){if(farm.coins<8){toast('金币不够啦');return}farm.coins-=8;farm.pond=farm.pond||{fishVisits:0,feedings:0};farm.pond.feedings=(farm.pond.feedings||0)+1;addLog('你买了鱼食，喂池塘里的小鱼。');save();toast('小鱼开心地游过来啦');render();return}if(b.dataset.achievementClaim){const item=achievementDefs().find(x=>x[0]===b.dataset.achievementClaim);if(!item||!item[3]){toast('这个成就还没有达成哦');return}farm.achievementClaims=farm.achievementClaims||[];if(farm.achievementClaims.includes(item[0])){toast('奖励已经领取啦');return}farm.achievementClaims.push(item[0]);farm.coins+=item[4];farm.xp+=8;addLog(`解锁成就「${item[1]}」，获得 ${item[4]} 金币。`);save();toast(`成就奖励 +${item[4]} 金币`);render();return}if(b.dataset.taskClaim){ensureDailyProgress();const task=dailyTaskDefs.find(t=>t.id===b.dataset.taskClaim);if(!task||!task.done(farm.dailyProgress)){toast('先完成这项小任务哦');return}farm.quest.claimed=farm.quest.claimed||[];if(farm.quest.claimed.includes(task.id)){toast('这项奖励已经领取啦');return}farm.quest.claimed.push(task.id);farm.coins+=task.reward;farm.xp+=3;addLog(`完成任务「${task.label}」，获得 ${task.reward} 金币。`);save();toast(`任务奖励 +${task.reward} 金币`);render();return}if(b.dataset.action==='daily-bonus'){ensureDailyProgress();if(!dailyTaskDefs.every(t=>(farm.quest.claimed||[]).includes(t.id))){toast('先领取全部今日任务奖励哦');return}if((farm.quest.claimed||[]).includes('daily-bonus')){toast('全勤奖励已经领取啦');return}farm.quest.claimed.push('daily-bonus');farm.coins+=60;farm.xp+=10;addLog('完成全部今日委托，额外获得 60 金币和 10 经验。');save();toast('全勤奖励 +60 金币！');render();return}if(b.hasAttribute('data-enter-house')){if(!farm.buildings.cottage){toast('先建造温馨小屋哦');return}farm.house=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};farm.house.visited=(farm.house.visited||0)+1;farm.house.roomsVisited=Array.isArray(farm.house.roomsVisited)?farm.house.roomsVisited:[];if(!farm.house.roomsVisited.includes('living'))farm.house.roomsVisited.push('living');ensureDailyProgress();farm.dailyProgress.roomsVisited=(farm.dailyProgress.roomsVisited||0)+1;facilityVisit('cottage');view='house';save();render();return}if(b.dataset.houseAction){ensureDailyProgress();farm.dailyProgress.roomsVisited=(farm.dailyProgress.roomsVisited||0)+1;farm.house=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};const a=b.dataset.houseAction;if(a==='lamp'){farm.house.lampOn=!farm.house.lampOn;addLog(farm.house.lampOn?'你们点亮了小屋的暖灯。':'你们关掉了小屋的暖灯。')}if(a==='window'){farm.house.windowOpen=!farm.house.windowOpen;addLog(farm.house.windowOpen?'你们打开窗户，让微风吹进小屋。':'你们轻轻关上了窗户。')}if(a==='rest'){farm.house.rests=(farm.house.rests||0)+1;addLog('你们在小屋的沙发上休息了一会儿。');toast('舒服地休息了一会儿 ☁️')}if(a==='tea'){farm.house.teas=(farm.house.teas||0)+1;ensureDailyProgress();farm.dailyProgress.teas=(farm.dailyProgress.teas||0)+1;addLog('你们泡了一杯热茶，在小屋里慢慢聊天。');toast('热茶泡好啦 🍵')}save();render();return}if(b.dataset.seed){selectedSeed=b.dataset.seed;render();return}if(b.dataset.plot!==undefined){const id=Number(b.dataset.plot),p=farm.plots.find(x=>x.id===id);if(p?.crop)harvest(id);else if(plant(id,selectedSeed)){toast('播种成功！');render()}return}if(b.dataset.buy){const id=b.dataset.buy,c=crops[id];if(farm.coins<c.cost){toast('金币不够啦');return}farm.coins-=c.cost;farm.inventory['seed_'+id]=(farm.inventory['seed_'+id]||0)+1;if(!farm.unlocked.includes(id))farm.unlocked.push(id);addLog(`购买了${c.name}种子 × 1。`);save();render();return}if(b.dataset.build){const id=b.dataset.build,cost=Number(b.dataset.cost||0);if(farm.buildings[id]){toast('这座设施已经建好啦');return}if(farm.coins<cost){toast('金币不够啦');return}farm.coins-=cost;farm.buildings[id]=true;addLog(`你们一起建造了${id==='coop'?'小鸡窝':id==='pond'?'小池塘':'温馨小屋'}。`);save();render();return}if(b.dataset.craft){const id=b.dataset.craft,need=id==='bouquet'?'flower':'strawberry',label=id==='bouquet'?'花束':'果酱';if((farm.inventory[need]||0)<2){toast(`材料不足，需要 2 份${crops[need].name}`);return}farm.inventory[need]-=2;farm.crafted[id]=(farm.crafted[id]||0)+1;addLog(`制作完成：${label} × 1。`);farm.xp+=4;save();render();return}if(b.dataset.sell){const id=b.dataset.sell,n=farm.inventory[id]||0;if(!n)return;const c=crops[id],price=c?.sell||(id==='egg'?5:0),name=c?.name||(id==='egg'?'鸡蛋':id);if(!price)return;farm.inventory[id]=n-1;farm.coins+=price;farm.stats.sold=(farm.stats.sold||0)+1;ensureDailyProgress();farm.dailyProgress.sold++;addLog(`出售了${name}，获得 ${price} 金币。`);save();render();return}if(b.dataset.action==='buy-chicken'){if(!farm.buildings.coop){toast('先建造小鸡窝，才能领养小鸡哦');return}if(farm.coins<45){toast('金币不够啦');return}farm.coins-=45;farm.animals.chickens=(farm.animals.chickens||0)+1;farm.animals.lastEggAt=farm.animals.lastEggAt||Date.now();addLog('一只毛茸茸的小鸡加入农场啦。');save();render();return}if(b.dataset.action==='daily-claim'){const today=new Date().toISOString().slice(0,10);if(farm.quest.date===today&&farm.quest.claimed.includes('daily')){toast('今天的奖励已经领取过啦');return}if(farm.stats.planted<1||farm.stats.harvests<1){toast('先完成播种和收获，再来领取奖励吧');return}farm.quest.date=today;farm.quest.claimed=['daily'];farm.coins+=20;farm.xp+=5;addLog('完成今日农场任务，获得 20 金币和 5 经验。');save();toast('今日奖励已领取！');render();return}if(b.dataset.action==='water-all'){let count=0;farm.plots.forEach(p=>{if(p.crop&&!mature(p)&&!p.watered){p.watered=true;p.readyAt=Math.max(Date.now(),p.readyAt-8000);count++}});if(count){ensureDailyProgress();farm.dailyProgress.watered+=count}addLog(count?`你给 ${count} 块土地浇了水，作物加速成长。`:'暂时没有需要浇水的作物。');save();toast(count?'浇水完成，作物加速啦':'没有需要浇水的作物');render();return}if(b.dataset.action==='expand'){const cost=80+Math.max(0,farm.plots.length-9)*35;if(farm.plots.length>=18||farm.coins<cost){toast('金币不足或土地已全部开放');return}farm.coins-=cost;farm.plots.push({id:farm.plots.length,crop:'',plantedAt:0,readyAt:0,watered:false});addLog('你们一起扩建了一块新土地。');save();render();return}if(b.dataset.action==='talk'){const t=$('#farmChat')?.value.trim();if(t)callAI(t,'chat');else toast('先写点想说的话吧');return}if(b.dataset.action==='daily'){callAI('请主动分享今天在农场做过的一件小事，并自然地邀请我一起完成一件小事。','daily');return}}
document.addEventListener('click',e=>{if(e.target.closest('[data-launch-games]')){e.preventDefault();open()}});
window.LoveRecordGames={open,close,save:()=>save(),getCurrentOwner:()=>activeOwnerId,getSaveStatus:()=>({database:DB_NAME,owner:ownerKey(activeOwnerId),lastError:saveError,readOnly:storageReadOnly,blocked:storageBlocked}),exportSave:()=>JSON.stringify({owner:ownerKey(activeOwnerId),farm},null,2),scanSaves:scanFarmArchives,getRescueCandidates:()=>rescueCandidates.map((x,i)=>({index:i,source:x.source,owner:x.owner,summary:x.summary,score:x.score})),restoreRescueSave:restoreFarmArchive};document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});window.addEventListener('pagehide',()=>save());
setInterval(()=>{if($('#lr-games')?.classList.contains('open')&&!storageBlocked)save()},15000);setInterval(()=>{if($('#lr-games')?.classList.contains('open')&&view==='farm')render()},5000);
})();