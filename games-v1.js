/* LOVE RECORD · OUR LITTLE FARM v1
   Shared-owner cozy farming sim. Local simulation is independent of API.
   AI calls are event-driven and reuse the homepage API settings.
*/
(()=>{'use strict';
const KEY='lr-our-little-farm-v1';
const ACTIVE_KEY=KEY+'::active';
let furnitureShopOpen=false;
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
 d.crafted={...defaults(id).crafted,...(d.crafted||{})};d.house={...defaults(id).house,...(d.house||{})};d.house.rooms={...defaults(id).house.rooms,...(d.house.rooms||{})};d.house.roomsVisited=Array.isArray(d.house.roomsVisited)?d.house.roomsVisited:[];d.house.furnitureInventory={...(d.house.furnitureInventory||{})};d.house.placed={...defaults(id).house.placed,...(d.house.placed||{})};for(const room of ['living','bedroom','kitchen','balcony']){d.house.placed[room]=Array.isArray(d.house.placed[room])?d.house.placed[room]:[];d.house.placed[room].forEach((x,i)=>{if(x&&!x.uid)x.uid=`legacy-${room}-${i}-${x.id||'item'}`})};d.world={...defaults(id).world,...(d.world||{})};d.story={...defaults(id).story,...(d.story||{})};d.story.flags=Array.isArray(d.story.flags)?d.story.flags:[];d.story.generated=Array.isArray(d.story.generated)?d.story.generated:[];d.story.lastGenerated=d.story.lastGenerated||null;d.achievements=Array.isArray(d.achievements)?d.achievements:[];
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
function furnitureArt(type){
 const uid=`fa-${type}-${Math.random().toString(36).slice(2,8)}`;
 const defs=`<defs>
  <linearGradient id="${uid}-wood" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#e6c9a4"/><stop offset=".52" stop-color="#bd916b"/><stop offset="1" stop-color="#90684b"/></linearGradient>
  <linearGradient id="${uid}-sage" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#c5d0b2"/><stop offset=".55" stop-color="#91a17f"/><stop offset="1" stop-color="#657b60"/></linearGradient>
  <linearGradient id="${uid}-linen" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf0"/><stop offset=".55" stop-color="#eadcc8"/><stop offset="1" stop-color="#d5bea4"/></linearGradient>
  <linearGradient id="${uid}-brass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f3d99c"/><stop offset="1" stop-color="#a77d45"/></linearGradient>
  <filter id="${uid}-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>
 </defs>`;
 const art={
 sofa:`<ellipse cx="90" cy="121" rx="70" ry="9" fill="#69513c" opacity=".18" filter="url(#${uid}-shadow)"/><path d="M34 73 90 45l57 28v32l-57 28-56-28Z" fill="#718568"/><path d="M34 73 90 101v28l-56-28Z" fill="#879778"/><path d="m90 101 57-28v28l-57 28Z" fill="#657b60"/><path d="M27 70q0-20 18-29l45-22 46 22q18 9 18 29v24l-64 31-63-31Z" fill="url(#${uid}-sage)" stroke="#63785c" stroke-width="3"/><path d="M36 70q3-14 15-20l39-19 39 19q12 6 15 20l-54 27Z" fill="#b6c4a3" stroke="#dbe0cb" stroke-width="2"/><path d="m38 74 24-12 26 13v28L63 116 38 103Z" fill="url(#${uid}-linen)" stroke="#d5c2aa" stroke-width="2"/><path d="m91 75 25-13 25 12v29l-25 13-25-13Z" fill="#f0dfcc" stroke="#d4bda4" stroke-width="2"/><path d="M48 80q14-9 27 0m27 0q14-9 27 0" fill="none" stroke="#fffaf1" stroke-width="2.4"/><path d="M48 88q13 6 27 0m27 0q14 6 27 0" fill="none" stroke="#c7b39a" stroke-width="1.5" stroke-dasharray="2 3"/><path d="M43 105v12m94-12v12" stroke="#89674b" stroke-width="5" stroke-linecap="round"/><path d="M31 64q-5 8-3 24m124-24q5 8 3 24" fill="none" stroke="#d5dfc5" stroke-width="3"/>`,
 armchair:`<ellipse cx="90" cy="121" rx="46" ry="7" fill="#69513c" opacity=".17" filter="url(#${uid}-shadow)"/><path d="M48 73 90 94l42-21v31l-42 24-42-24Z" fill="#849575"/><path d="M43 68q0-21 16-29l31-16 31 16q16 8 16 29v28L90 119 43 96Z" fill="url(#${uid}-sage)" stroke="#6f8265" stroke-width="3"/><path d="M54 67q2-12 12-17l24-12 24 12q10 5 12 17L90 85Z" fill="#e8d8c5" stroke="#fff7e9" stroke-width="2"/><path d="m55 77 35 18 35-18v20l-35 19-35-19Z" fill="#d7c4ad" stroke="#bca58c" stroke-width="2"/><path d="M66 78q10-7 19 0m19 0q10-7 19 0" stroke="#fffaf0" stroke-width="2" fill="none"/><path d="M52 94v22m76-22v22" stroke="#98714f" stroke-width="5" stroke-linecap="round"/><path d="M44 65q-9 9-5 31m102-31q9 9 5 31" stroke="#d8e0ca" stroke-width="4" fill="none"/>`,
 coffee:`<ellipse cx="90" cy="119" rx="57" ry="7" fill="#6d5238" opacity=".16" filter="url(#${uid}-shadow)"/><path d="m34 71 56-28 56 28-56 29Z" fill="#936b4d"/><path d="m39 68 51-25 51 25-51 27Z" fill="url(#${uid}-wood)" stroke="#956d4e" stroke-width="2.5"/><path d="m47 68 43-21 43 21-43 22Z" fill="#e8cda9" stroke="#f5e4cc" stroke-width="2"/><path d="M48 77v32m84-32v32m-72-1v8m60-8v8" stroke="#936b4d" stroke-width="5" stroke-linecap="round"/><path d="m58 62 17-8 18 9-17 8Z" fill="#f7efe2" stroke="#c7b69f"/><path d="m62 60 13-6 14 7-13 6Z" fill="#a9b18f"/><path d="m102 64 13-7 12 6-13 7Z" fill="#f6eee1" stroke="#b99e7e"/><path d="M109 62q-3-9 5-11 9 6 5 13Z" fill="#fff8e9" stroke="#bca78d" stroke-width="1.5"/><path d="M119 63q9-4 8 3-4 5-9 1" fill="none" stroke="#bca78d" stroke-width="2"/>`,
 bookcase:`<ellipse cx="90" cy="126" rx="42" ry="6" fill="#60472f" opacity=".16" filter="url(#${uid}-shadow)"/><path d="m45 22 45-17 45 17v94l-45 20-45-20Z" fill="#805b40"/><path d="m51 25 39-14 39 14v84l-39 18-39-18Z" fill="url(#${uid}-wood)" stroke="#805b40" stroke-width="3"/><path d="M90 12v115M51 53l39 18 39-18M51 82l39 18 39-18" stroke="#805b40" stroke-width="4"/><path d="m58 32 9-4v18l-9-4Zm13-5 8-3v22l-8-4Zm24 17 9-4v18l-9 4Zm14-7 8-4v20l-8 4ZM58 62l10 4v15l-10-5Zm14 7 9 4v15l-9-5Zm26 4 9-4v17l-9 4Zm13-7 8-4v18l-8 4Z" fill="#f1dfc7"/><path d="m58 48 9 4m16 12 9 4m18-35 8-4" stroke="#c47d62" stroke-width="3"/><path d="M57 109h66" stroke="#e8c9a5" stroke-width="2"/>`,
 lamp:`<ellipse cx="90" cy="125" rx="25" ry="5" fill="#6b523b" opacity=".16" filter="url(#${uid}-shadow)"/><path d="M88 61v56m-13 2h27" stroke="#98724e" stroke-width="5" stroke-linecap="round"/><path d="M57 59q4-32 33-38 30 6 34 38l-33 16Z" fill="url(#${uid}-linen)" stroke="#b99a73" stroke-width="3"/><path d="M62 56q28 13 57 0" stroke="#fffaf1" stroke-width="3" fill="none"/><path d="M69 62q21 10 43 0" stroke="#d7c3a8" stroke-width="2" fill="none"/><path d="M78 30q12-7 24 0" stroke="#fff" stroke-width="2" fill="none"/><ellipse cx="90" cy="121" rx="18" ry="4" fill="#a77e53"/>`,
 sideboard:`<ellipse cx="90" cy="124" rx="54" ry="7" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m32 54 58-29 58 29-58 30Z" fill="#916849"/><path d="m36 52 54-27 54 27-54 28Z" fill="url(#${uid}-wood)" stroke="#8c6548" stroke-width="2.5"/><path d="m36 52 54 28v38l-54-28Z" fill="#b88660" stroke="#8c6548" stroke-width="2"/><path d="m90 80 54-28v38l-54 28Z" fill="#d0a47b" stroke="#8c6548" stroke-width="2"/><path d="m47 61 33 17v22L47 83Z" fill="#ead7bd" stroke="#a9825e" stroke-width="2"/><path d="m98 84 34-18v22l-34 18Z" fill="#f0dfc8" stroke="#a9825e" stroke-width="2"/><circle cx="72" cy="88" r="2.7" fill="#a77b45"/><circle cx="116" cy="91" r="2.7" fill="#a77b45"/><path d="M47 108v10m85-45v10" stroke="#8d6749" stroke-width="5"/>`,
 bed:`<ellipse cx="90" cy="126" rx="70" ry="8" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="M27 44 90 13l63 31v28l-63 32-63-32Z" fill="#986f50"/><path d="M34 44 90 16l56 28v20l-56 29-56-29Z" fill="url(#${uid}-wood)" stroke="#8e674b" stroke-width="3"/><path d="M42 47 90 23l48 24v12L90 83 42 59Z" fill="#f2e7d7" stroke="#fffaf1" stroke-width="3"/><path d="M50 49 90 29l40 20v9L90 78 50 58Z" fill="#e6d7c4"/><path d="M57 52q14-10 27 0m12 0q14-10 27 0" stroke="#fffaf2" stroke-width="2.5" fill="none"/><path d="M25 64 90 97l65-33v35l-65 34-65-34Z" fill="#e8d8c5" stroke="#b58b68" stroke-width="3"/><path d="M25 64 90 97l65-33-18-11-47 24-47-24Z" fill="#fff8ed" stroke="#d6c2aa" stroke-width="2"/><path d="M38 73 90 100l52-27M38 91 90 118l52-27" stroke="#fffaf1" stroke-width="2" fill="none"/><path d="M39 112v10m102-10v10" stroke="#916a4b" stroke-width="6" stroke-linecap="round"/>`,
 wardrobe:`<ellipse cx="90" cy="127" rx="43" ry="6" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m43 19 47-16 47 16v101l-47 18-47-18Z" fill="#9c7452"/><path d="m49 22 41-14 41 14v91l-41 16-41-16Z" fill="url(#${uid}-linen)" stroke="#9a7554" stroke-width="3"/><path d="M90 8v121" stroke="#a47d59" stroke-width="3"/><path d="M58 32q14-9 26 0v65q-12 9-26 0Zm38 0q14-9 26 0v65q-12 9-26 0Z" fill="#f7efe3" stroke="#d4c0a8" stroke-width="2"/><path d="M64 42q8-6 15 0m-15 9q8-6 15 0m24-9q8-6 15 0m-15 9q8-6 15 0" stroke="#e0cdb6" stroke-width="1.5" fill="none"/><path d="M82 63v11m16-11v11" stroke="#b58a4f" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="68" r="2" fill="#f3d99c"/><circle cx="98" cy="68" r="2" fill="#f3d99c"/>`,
 dresser:`<ellipse cx="90" cy="124" rx="50" ry="6" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m35 49 55-27 55 27-55 29Z" fill="#9a704f"/><path d="m40 48 50-25 50 25-50 26Z" fill="url(#${uid}-wood)" stroke="#8d674a" stroke-width="2.5"/><path d="m40 48 50 26v39l-50-25Z" fill="#b98862"/><path d="m90 74 50-26v39l-50 26Z" fill="#d0a27a"/><path d="m49 56 34 17v9L49 65Zm0 16 34 17v9L49 81Z" fill="#f0dfc8" stroke="#a98260" stroke-width="1.5"/><path d="m98 77 33-17v9L98 86Zm0 16 33-17v9L98 102Z" fill="#f0dfc8" stroke="#a98260" stroke-width="1.5"/><circle cx="76" cy="78" r="2" fill="#a77b45"/><circle cx="76" cy="94" r="2" fill="#a77b45"/>`,
 vanity:`<ellipse cx="90" cy="126" rx="49" ry="6" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="m40 66 50-25 50 25-50 26Z" fill="#a77c58"/><path d="m44 64 46-23 46 23-46 24Z" fill="url(#${uid}-wood)"/><path d="m44 64 46 24v28L44 92Z" fill="#b98b65"/><path d="m90 88 46-24v28l-46 24Z" fill="#d2a77e"/><path d="M65 45V20q25-24 50 0v25" fill="#98714f" stroke="#805c41" stroke-width="3"/><path d="M71 42V22q19-17 38 0v20" fill="#b9d2cf" stroke="#fff8eb" stroke-width="4"/><path d="M77 24q12-9 25-2m-21 12q9-5 17-1" stroke="#f8ffff" stroke-width="2" fill="none"/><path d="m54 76 29 15v13L54 89Z" fill="#f1dfc8"/><circle cx="77" cy="94" r="2.3" fill="#9d754f"/>`,
 stove:`<ellipse cx="90" cy="126" rx="49" ry="6" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m39 52 51-26 51 26-51 27Z" fill="#a38b72"/><path d="m44 49 46-23 46 23-46 24Z" fill="#f8f2e8" stroke="#c8b49a" stroke-width="3"/><path d="m44 49 46 24v42l-46-24Z" fill="#e3d6c5" stroke="#b9a58c" stroke-width="2"/><path d="m90 73 46-24v42l-46 24Z" fill="#d4c4af" stroke="#a99478" stroke-width="2"/><ellipse cx="73" cy="46" rx="13" ry="7" fill="#655e54"/><ellipse cx="108" cy="63" rx="13" ry="7" fill="#655e54"/><ellipse cx="73" cy="46" rx="7" ry="3.5" fill="#b6aa98"/><ellipse cx="108" cy="63" rx="7" ry="3.5" fill="#b6aa98"/><path d="M60 86v17m61-28v17" stroke="#f7eee0" stroke-width="2"/>`,
 cupboard:`<ellipse cx="90" cy="126" rx="52" ry="6" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m35 49 55-27 55 27-55 28Z" fill="#8c9b7b"/><path d="m40 47 50-25 50 25-50 26Z" fill="url(#${uid}-sage)" stroke="#6f8064" stroke-width="2.5"/><path d="m40 47 50 26v40L40 87Z" fill="#829474"/><path d="m90 73 50-26v40l-50 26Z" fill="#6f8468"/><path d="m49 57 31 16v27L49 84Z" fill="#f2e5d3" stroke="#a9a88c" stroke-width="2"/><path d="m99 78 31-16v27l-31 16Z" fill="#f2e5d3" stroke="#a9a88c" stroke-width="2"/><circle cx="76" cy="86" r="2.5" fill="#bd985e"/><circle cx="115" cy="88" r="2.5" fill="#bd985e"/>`,
 island:`<ellipse cx="90" cy="126" rx="57" ry="6" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m27 63 63-31 63 31-63 32Z" fill="#718568"/><path d="m31 60 59-29 59 29-59 30Z" fill="#e9d5b8" stroke="#9b7858" stroke-width="3"/><path d="m31 60 59 30v27L31 87Z" fill="#849575"/><path d="m90 90 59-30v27l-59 30Z" fill="#6c8263"/><path d="m47 61 43-21 43 21-43 22Z" fill="#fff8ec" stroke="#d2bda2" stroke-width="2"/><path d="M51 88v22m78-22v22" stroke="#61765b" stroke-width="5"/>`,
 dining:`<ellipse cx="90" cy="126" rx="60" ry="6" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="m24 64 66-33 66 33-66 34Z" fill="#91694a"/><path d="m31 61 59-29 59 29-59 30Z" fill="url(#${uid}-wood)" stroke="#8e6547" stroke-width="3"/><path d="m39 61 51-25 51 25-51 25Z" fill="#e8c9a4" stroke="#f3e2ca" stroke-width="2"/><path d="M43 72v38m94-38v38" stroke="#8f6748" stroke-width="6" stroke-linecap="round"/><path d="m75 55 15-8 15 8-15 8Z" fill="#f8f1e6"/><path d="m82 53 8-4 8 4-8 4Z" fill="#84966f"/>`,
 chair:`<ellipse cx="90" cy="126" rx="32" ry="5" fill="#60472f" opacity=".15" filter="url(#${uid}-shadow)"/><path d="M56 56q34-28 68 0v33L90 108 56 89Z" fill="#98704f"/><path d="M62 57q28-22 56 0v26L90 99 62 83Z" fill="#e8d8c4" stroke="#c5a98b" stroke-width="3"/><path d="m55 86 35 18 35-18v20l-35 18-35-18Z" fill="#c3a17e"/><path d="M62 99v21m56-21v21m-48-12 20 10 20-10" stroke="#8e6749" stroke-width="4"/><path d="M68 62q22-14 44 0" fill="none" stroke="#fff9ed" stroke-width="2"/>`,
 shelf:`<ellipse cx="90" cy="126" rx="37" ry="5" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="m43 30 47-23 47 23-47 24Z" fill="#9b704e"/><path d="m49 29 41-20 41 20-41 21Z" fill="url(#${uid}-wood)" stroke="#8a6244" stroke-width="3"/><path d="M50 51 90 72 130 51M50 75 90 96 130 75" stroke="#8a6244" stroke-width="6" fill="none"/><path d="m57 28 8-4v16l-8 4Zm16-8 8-4v21l-8 4Zm35 5 8-4v16l-8 4Zm-46 34 8-4v14l-8 4Zm18 7 8-4v14l-8 4Zm33-9 8-4v14l-8 4Z" fill="#f0dfc8"/>`,
 chairbal:`<ellipse cx="90" cy="126" rx="39" ry="5" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="M51 62q0-34 39-39 39 5 39 39v20L90 103 51 82Z" fill="#b98e67" stroke="#8e6949" stroke-width="3"/><path d="M59 62q0-25 31-30 31 5 31 30v13L90 91 59 75Z" fill="#e2c6a2" stroke="#f4dfc2" stroke-width="3"/><path d="M65 43q25-13 50 0M62 54q28-13 56 0M62 65q28-12 56 0" stroke="#fff1d9" stroke-width="3" fill="none"/><path d="M58 82v34m64-34v34M68 92v26m44-26v26" stroke="#98704e" stroke-width="4"/>`,
 bistro:`<ellipse cx="90" cy="126" rx="38" ry="5" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="m38 61 52-26 52 26-52 27Z" fill="#a17a58"/><path d="m45 59 45-22 45 22-45 23Z" fill="#e5cba8" stroke="#9a7655" stroke-width="3"/><path d="M90 82v38m-22 0h44" stroke="#8b684a" stroke-width="5"/><path d="m70 56 20-10 20 10-20 10Z" fill="#f9f1e4"/><path d="M90 46v-10m-5 5 5-6 5 6" stroke="#82936e" stroke-width="2" fill="none"/>`,
 flowers:`<ellipse cx="90" cy="126" rx="34" ry="5" fill="#60472f" opacity=".13" filter="url(#${uid}-shadow)"/><path d="m55 81 70 0-8 34H63Z" fill="#b77f62" stroke="#8f654b" stroke-width="3"/><path d="M90 82V34m-2 46q-35-39-44-16 15 24 44 16m2-18q13-39 32-25 0 25-32 25m-2 17q30-30 43-11-14 21-43 11" fill="#81966e" stroke="#637d5c" stroke-width="2.5"/><g fill="#e9aaa0" stroke="#c78379" stroke-width="1.5"><circle cx="46" cy="55" r="9"/><circle cx="120" cy="42" r="10"/><circle cx="132" cy="75" r="8"/><circle cx="85" cy="39" r="7"/></g><g fill="#f4d98f"><circle cx="46" cy="55" r="3"/><circle cx="120" cy="42" r="3"/><circle cx="132" cy="75" r="3"/></g>`,
 lantern:`<ellipse cx="90" cy="126" rx="24" ry="5" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="M90 12v13m-18 4q18-20 36 0l-5 57H77Z" fill="#8c684b"/><path d="M76 33h28l-4 47H80Z" fill="#f4dca3" stroke="#b28c5e" stroke-width="3"/><path d="M83 39h14v34H83Z" fill="#fff1b9" opacity=".85"/><path d="M72 29h36M78 81l-7 12m41-12 7 12" stroke="#8c684b" stroke-width="3" fill="none"/><path d="M90 45q-8 13 0 22 8-9 0-22Z" fill="#e99a57"/>`,
 plant:`<ellipse cx="90" cy="126" rx="28" ry="5" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="m65 84 50 0-8 36H73Z" fill="#bb8466" stroke="#95684e" stroke-width="3"/><path d="M90 86V33m-1 49Q47 55 44 31q31-4 45 51m2-8q6-48 34-49 12 32-34 49m-2-4Q63 37 70 15q27 9 19 64m2-8q29-33 48-13-15 28-48 13" fill="#81976e" stroke="#607b58" stroke-width="2.5"/><path d="M90 84q-12-33-26-27m26 24q15-29 30-25" stroke="#a8b994" stroke-width="2" fill="none"/>`,
 mirror:`<ellipse cx="90" cy="126" rx="23" ry="5" fill="#60472f" opacity=".14" filter="url(#${uid}-shadow)"/><path d="M90 8q-34 0-34 37v35q0 29 34 39 34-10 34-39V45Q124 8 90 8Z" fill="#9b7555" stroke="#805c42" stroke-width="4"/><path d="M90 16q-26 0-26 31v31q0 21 26 31 26-10 26-31V47Q116 16 90 16Z" fill="#b9d3d0" stroke="#f7ecdc" stroke-width="4"/><path d="M72 34q12-12 25-9M70 52q9-8 19-7" stroke="#fff" stroke-width="3" fill="none" opacity=".85"/><path d="M90 111v12m-17 4h34" stroke="#8c6849" stroke-width="4"/>`,
 wallart:`<ellipse cx="90" cy="126" rx="28" ry="4" fill="#60472f" opacity=".12" filter="url(#${uid}-shadow)"/><path d="m48 25 42-18 42 18v75l-42 21-42-21Z" fill="#98704f" stroke="#805c42" stroke-width="3"/><path d="m55 27 35-15 35 15v65l-35 17-35-17Z" fill="#f1eadb" stroke="#fff9ef" stroke-width="4"/><path d="M90 88q-19-27-2-53 20 20 2 53Zm0-17q-28-22-35-5 14 22 35 5m0-13q25-26 35-9-9 20-35 9" fill="#81966e" stroke="#657f5c" stroke-width="2"/><g fill="#e6a9a0"><circle cx="88" cy="35" r="5"/><circle cx="57" cy="65" r="4"/><circle cx="122" cy="62" r="4"/></g>`,
 clock:`<ellipse cx="90" cy="126" rx="22" ry="4" fill="#60472f" opacity=".12" filter="url(#${uid}-shadow)"/><path d="M90 8q-31 0-31 32v39l31 25 31-25V40Q121 8 90 8Z" fill="#98704f" stroke="#805b40" stroke-width="3"/><path d="M90 15q-24 0-24 27v34l24 19 24-19V42Q114 15 90 15Z" fill="#f4e8d6" stroke="#d6c1a4" stroke-width="3"/><circle cx="90" cy="51" r="23" fill="#fffaf0" stroke="#b99b79" stroke-width="2"/><path d="M90 32v19l13 8" stroke="#84664b" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M90 27v4m0 40v4m-19-24h4m30 0h4" stroke="#987454" stroke-width="2"/>`,
 rug:`<ellipse cx="90" cy="110" rx="72" ry="15" fill="#6a513b" opacity=".13" filter="url(#${uid}-shadow)"/><path d="m12 72 78-39 78 39-78 40Z" fill="#d9c5a9" stroke="#a98968" stroke-width="3"/><path d="m23 72 67-33 67 33-67 34Z" fill="#f3e7d6" stroke="#fffaf1" stroke-width="3"/><path d="m38 72 52-25 52 25-52 26Z" fill="none" stroke="#c58e83" stroke-width="3"/><path d="m53 72 37-18 37 18-37 18Z" fill="none" stroke="#a6ad8d" stroke-width="2.5"/><path d="m12 72-8 0m164 0 8 0" stroke="#b28f6e" stroke-width="3"/>`,
 cushion:`<ellipse cx="90" cy="122" rx="36" ry="5" fill="#60472f" opacity=".13" filter="url(#${uid}-shadow)"/><path d="m43 63 47-26 47 26-47 27Z" fill="#cda995" stroke="#a98370" stroke-width="3"/><path d="m43 63 47 27v26L43 89Z" fill="#e6d2bf"/><path d="m90 90 47-27v26l-47 27Z" fill="#c69f8c"/><path d="m55 65 35-19 35 19-35 20Z" fill="none" stroke="#fff4e6" stroke-width="2.5"/><path d="M62 68q28-17 56 0m-56 8q28-17 56 0" stroke="#f4e5d6" stroke-width="1.6" fill="none"/>`,
 curtain:`<path d="M30 19h120" stroke="#987454" stroke-width="5" stroke-linecap="round"/><g fill="url(#${uid}-linen)" stroke="#d4c1a9" stroke-width="2"><path d="M35 23q20-11 36 0l-2 89q-18 14-33 0Z"/><path d="M109 23q20-11 36 0l-2 89q-18 14-33 0Z"/></g><path d="M43 31v70m10-73v74m10-75v73m52-69v69m10-73v74m10-75v73" stroke="#d7c5ad" stroke-width="1.5"/><path d="M36 92q17 13 33 0m41 0q17 13 34 0" fill="none" stroke="#c9a98a" stroke-width="2"/><g fill="#f9efe1"><circle cx="42" cy="20" r="3"/><circle cx="56" cy="20" r="3"/><circle cx="70" cy="20" r="3"/><circle cx="112" cy="20" r="3"/><circle cx="126" cy="20" r="3"/><circle cx="140" cy="20" r="3"/></g>`
 }[type]||'';
 return `<svg viewBox="0 0 180 140" role="img" aria-label="家具插画" focusable="false">${defs}<ellipse cx="90" cy="126" rx="54" ry="6" fill="#71563b" opacity=".12"/>${art}</svg>`;
}
const furnitureCatalog=[
 {id:'sofa',name:'鼠尾草绒布沙发',room:'living',category:'living',price:180,type:'sofa',desc:'柔软绒布与花卉靠枕，客厅主角'},
 {id:'armchair',name:'法式单人扶手椅',room:'living',category:'living',price:105,type:'armchair',desc:'奶油色软包，适合窗边阅读'},
 {id:'coffee-table',name:'复古橡木茶几',room:'living',category:'living',price:88,type:'coffee',desc:'摆上茶杯、书本与花束'},
 {id:'bookcase',name:'乡村高书柜',room:'living',category:'living',price:145,type:'bookcase',desc:'收藏书籍与旅行纪念品'},
 {id:'floor-lamp',name:'奶油布罩落地灯',room:'living',category:'living',price:76,type:'lamp',desc:'夜晚为沙发旁添一盏暖光'},
 {id:'sideboard',name:'复古餐边柜',room:'living',category:'living',price:125,type:'sideboard',desc:'橡木抽屉与展示台面'},
 {id:'bed',name:'法式雕花双人床',room:'bedroom',category:'bedroom',price:220,type:'bed',desc:'层叠棉被、软枕与雕花床头'},
 {id:'nightstand',name:'橡木床头柜',room:'bedroom',category:'bedroom',price:58,type:'sideboard',desc:'床边收纳与小小台灯'},
 {id:'wardrobe',name:'奶油双开门衣柜',room:'bedroom',category:'bedroom',price:175,type:'wardrobe',desc:'复古门板与黄铜把手'},
 {id:'dresser',name:'三斗抽屉柜',room:'bedroom',category:'bedroom',price:115,type:'dresser',desc:'收纳衣物与日常小物'},
 {id:'vanity',name:'花漾梳妆台',room:'bedroom',category:'bedroom',price:138,type:'vanity',desc:'椭圆镜与精致小抽屉'},
 {id:'bedside-lamp',name:'暖光床头灯',room:'bedroom',category:'bedroom',price:48,type:'lamp',desc:'睡前阅读的柔和光线'},
 {id:'stove',name:'复古珐琅炉灶',room:'kitchen',category:'kitchen',price:135,type:'stove',desc:'奶油白炉身与深色炉圈'},
 {id:'cupboard',name:'鼠尾草餐边柜',room:'kitchen',category:'kitchen',price:118,type:'cupboard',desc:'收纳餐具与厨房杂货'},
 {id:'kitchen-island',name:'乡村料理中岛',room:'kitchen',category:'kitchen',price:165,type:'island',desc:'备餐、摆放面包与水果'},
 {id:'dining-table',name:'四人橡木餐桌',room:'kitchen',category:'kitchen',price:145,type:'dining',desc:'一起吃早餐、分享小故事'},
 {id:'dining-chair',name:'格纹软垫餐椅',room:'kitchen',category:'kitchen',price:55,type:'chair',desc:'与餐桌搭配的木质餐椅'},
 {id:'wall-shelf',name:'陶器展示层架',room:'kitchen',category:'kitchen',price:68,type:'shelf',desc:'摆放陶罐、香料和杯子'},
 {id:'balcony-chair',name:'藤编休闲椅',room:'balcony',category:'balcony',price:75,type:'chairbal',desc:'适合阳台午后小憩'},
 {id:'bistro-table',name:'铁艺圆形茶桌',room:'balcony',category:'balcony',price:92,type:'bistro',desc:'两个人的下午茶角落'},
 {id:'flower-rack',name:'层叠花架',room:'balcony',category:'balcony',price:64,type:'flowers',desc:'让阳台开满小花'},
 {id:'lantern',name:'复古玻璃提灯',room:'balcony',category:'balcony',price:52,type:'lantern',desc:'傍晚点亮阳台一角'},
 {id:'plant',name:'陶盆琴叶绿植',room:'all',category:'decor',price:32,type:'plant',desc:'每个房间都适合的一抹绿意'},
 {id:'rug',name:'手织花卉地毯',room:'all',category:'decor',price:58,type:'rug',desc:'柔软织纹与细致花边'},
 {id:'mirror',name:'古典椭圆穿衣镜',room:'all',category:'decor',price:72,type:'mirror',desc:'让墙面多一处优雅细节'},
 {id:'wall-art',name:'植物学装饰画',room:'all',category:'decor',price:38,type:'wallart',desc:'手绘花草主题墙面装饰'},
 {id:'clock',name:'复古木框挂钟',room:'all',category:'decor',price:46,type:'clock',desc:'为小屋增添生活气息'},
 {id:'curtain',name:'法式蕾丝窗帘',room:'all',category:'decor',price:82,type:'curtain',desc:'轻柔亚麻与蕾丝细节'},
 {id:'cushion',name:'刺绣花卉抱枕',room:'all',category:'decor',price:24,type:'cushion',desc:'为沙发和床铺增加柔软层次'}
].map(item=>({...item,svg:furnitureArt(item.type)}));
function furnitureShopView(){
 const groups=[['living','客厅家具','沙发、茶几、书柜与灯具'],['bedroom','卧室家具','床铺、衣柜、梳妆台与床头灯'],['kitchen','厨房家具','炉灶、橱柜、料理台与餐桌'],['balcony','阳台家具','藤椅、茶桌、花架与提灯'],['decor','软装与装饰','绿植、地毯、镜子、窗帘与墙面装饰']];
 return `<details class="gcard shop-accordion furniture-mega-shop" ${furnitureShopOpen?'open':''}><summary><span>家具与软装商店</span><small>把小屋慢慢布置成家 · ${furnitureCatalog.length} 件</small></summary><div class="shop-accordion-body"><div class="furniture-shop-intro"><b>把小屋慢慢布置成家</b><p>挑选喜欢的家具，购买后会放进当前联系人的家具库存。进入小屋装修模式即可摆放。</p><span>FRENCH COUNTRY COLLECTION · 2026</span></div>${groups.map(([key,title,desc],idx)=>{const items=furnitureCatalog.filter(x=>x.category===key);return `<details class="furniture-category" ${idx===0?'open':''}><summary><span>${title}</span><small>${items.length} 件 · ${desc}</small></summary><div class="furniture-shop-grid">${items.map(item=>`<article class="furniture-product-card"><div class="furniture-product-art">${item.svg}</div><div class="furniture-product-copy"><b>${item.name}</b><small>${item.desc}</small><div class="furniture-product-buy"><strong>◉ ${item.price}</strong><button data-buy-furniture="${item.id}">购买</button></div><em>库存 ${farm.house.furnitureInventory[item.id]||0}</em></div></article>`).join('')}</div></details>`}).join('')}</div></details>`;
}

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

/* V18 · Living Storybook art direction: painterly layers, ambient motion, depth */
#lr-games .v18-storybook-stage{isolation:isolate;position:relative;overflow:hidden;border:7px solid #fffaf1;border-radius:28px;background:radial-gradient(ellipse at 32% 18%,#fff8e8 0%,#f2e5ce 52%,#d9c3a4 100%);box-shadow:inset 0 0 0 1px #fffdf5,inset 0 -24px 40px #8b684522,0 18px 38px #73583a22}
#lr-games .v18-storybook-stage>svg{position:relative;z-index:1;filter:drop-shadow(0 8px 7px #6e52351c);overflow:visible}
#lr-games .v18-storybook-stage:before{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(135deg,#fff9e9aa 0%,transparent 34%,transparent 70%,#9e805019 100%);mix-blend-mode:soft-light}
#lr-games .v18-storybook-stage .room-vignette{position:absolute;inset:0;z-index:4;pointer-events:none;box-shadow:inset 0 0 36px #8b6b4320;border-radius:20px}
#lr-games .v18-storybook-stage .room-stage-grain{z-index:3;opacity:.08;background-image:radial-gradient(#987b5a .55px,transparent .8px),radial-gradient(#fff .45px,transparent .7px);background-position:0 0,5px 7px;background-size:12px 12px,17px 17px;mix-blend-mode:multiply}
#lr-games .v18-storybook-stage .room-sunbeam{transform-origin:20% 10%;animation:v18Sunbeam 14s ease-in-out infinite alternate;mix-blend-mode:screen}
#lr-games .v18-storybook-stage .room-dust circle{animation:v18Dust 7s ease-in-out infinite alternate;filter:drop-shadow(0 0 3px #fff5ce)}
#lr-games .v18-storybook-stage .room-dust circle:nth-child(2n){animation-delay:-3.2s}
#lr-games .v18-storybook-stage .room-glints{animation:v18Glimmer 4s ease-in-out infinite alternate}
#lr-games .v18-storybook-stage .room-curtain{transform-box:fill-box;transform-origin:top center;animation:v18Curtain 5.5s ease-in-out infinite alternate}
#lr-games .v18-storybook-stage .room-curtain-right{animation-delay:-2.7s}
#lr-games .v18-storybook-stage .room-flame{transform-box:fill-box;transform-origin:50% 100%;animation:v18Fire .95s ease-in-out infinite alternate;filter:drop-shadow(0 0 9px #f5a45c99)}
#lr-games .v18-storybook-stage .room-leaves{transform-box:fill-box;transform-origin:50% 100%;animation:v18Leaves 4.8s ease-in-out infinite alternate}
#lr-games .v18-storybook-stage .room-steam{animation:v18Steam 3s ease-out infinite;transform-box:fill-box;transform-origin:bottom center}
#lr-games .v18-storybook-stage .room-lamp-glow{animation:v18Lamp 2.8s ease-in-out infinite alternate;filter:drop-shadow(0 0 9px #f6d58a)}
#lr-games .v18-storybook-stage .balcony-lights circle{animation:v18Twinkle 2.3s ease-in-out infinite alternate;filter:drop-shadow(0 0 7px #f7d98e)}
#lr-games .v18-storybook-stage .balcony-lights circle:nth-child(2n){animation-delay:-1.1s}
#lr-games .v18-storybook-stage .room-pollen circle{animation:v18Pollen 9s ease-in-out infinite alternate}
#lr-games .v18-storybook-stage .room-pollen circle:nth-child(2n){animation-delay:-4s}
#lr-games .v18-storybook-stage .room-weather-wash{z-index:5;mix-blend-mode:soft-light}
#lr-games .v18-storybook-stage .placed-furniture-wrap{z-index:6}
#lr-games .v18-storybook-stage .placed-furniture svg{filter:drop-shadow(0 7px 5px #5d452d42) saturate(1.06)}
#lr-games .v18-storybook-stage.decor-active{outline:2px solid #a9b88e;outline-offset:3px}
#lr-games .room-intro-card{background:linear-gradient(145deg,#fffaf1,#f4eadb);border:1px solid #e5d5c1;border-radius:20px;padding:14px 16px;box-shadow:0 8px 22px #765a3510}
@keyframes v18Sunbeam{0%{transform:translate(-8px,0) rotate(-1deg);opacity:.24}100%{transform:translate(18px,5px) rotate(2deg);opacity:.55}}
@keyframes v18Dust{0%{transform:translate(0,5px);opacity:.12}50%{opacity:.8}100%{transform:translate(12px,-15px);opacity:.18}}
@keyframes v18Glimmer{0%{opacity:.2;transform:scale(.8)}100%{opacity:.9;transform:scale(1.1)}}
@keyframes v18Curtain{0%{transform:skewY(-1deg) translateX(0)}100%{transform:skewY(1.5deg) translateX(2px)}}
@keyframes v18Fire{0%{transform:scale(.94,1) rotate(-2deg)}100%{transform:scale(1.06,1.08) rotate(2deg)}}
@keyframes v18Leaves{0%{transform:rotate(-2deg)}100%{transform:rotate(3deg)}}
@keyframes v18Steam{0%{opacity:0;transform:translateY(5px) scale(.8)}30%{opacity:.7}100%{opacity:0;transform:translateY(-13px) scale(1.2)}}
@keyframes v18Lamp{0%{opacity:.72}100%{opacity:1}}
@keyframes v18Twinkle{0%{opacity:.55}100%{opacity:1}}
@keyframes v18Pollen{0%{transform:translate(0,0);opacity:.12}100%{transform:translate(9px,-12px);opacity:.62}}
@media(max-width:430px){#lr-games .v18-storybook-stage{border-width:5px;border-radius:23px}#lr-games .v18-storybook-stage>svg{min-height:0}}
@media(prefers-reduced-motion:reduce){#lr-games .v18-storybook-stage *{animation:none!important;transition:none!important}}


/* V19 · premium illustrated cottage interiors + redesigned furniture boutique */
#lr-games .v19-room-stage{position:relative;isolation:isolate;overflow:hidden;aspect-ratio:4/3;border:7px solid #fffaf1;border-radius:27px;background:#e9ddc8;box-shadow:0 18px 42px #634b321f,inset 0 0 0 1px #fffdf5;touch-action:pan-y}
#lr-games .v19-room-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;display:block;z-index:0;image-rendering:auto;filter:saturate(.98) contrast(1.015);transition:filter .8s ease,transform 1.2s cubic-bezier(.2,.7,.2,1)}
#lr-games .v19-room-stage:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(135deg,#fff7e51c,transparent 40%,#6c503015);}
#lr-games .v19-room-light{position:absolute;inset:-15%;z-index:2;pointer-events:none;background:radial-gradient(ellipse at 25% 22%,#fff1bc55 0,transparent 42%);mix-blend-mode:screen;animation:v19SunDrift 16s ease-in-out infinite alternate}
#lr-games .v19-room-stage.lamp-off .v19-room-art{filter:saturate(.82) brightness(.86)}
#lr-games .v19-room-stage.lamp-on .v19-room-light{background:radial-gradient(ellipse at 68% 60%,#ffd77a44 0,transparent 42%),radial-gradient(ellipse at 24% 25%,#fff2c455 0,transparent 40%)}
#lr-games .v19-room-dust{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
#lr-games .v19-room-dust i{position:absolute;width:4px;height:4px;border-radius:50%;background:#fff9df;box-shadow:0 0 9px #fff2b9;left:22%;top:38%;animation:v19DustFloat 8s ease-in-out infinite alternate}
#lr-games .v19-room-dust i:nth-child(2){left:44%;top:24%;animation-delay:-2s;transform:scale(.7)}
#lr-games .v19-room-dust i:nth-child(3){left:68%;top:49%;animation-delay:-4s;transform:scale(.6)}
#lr-games .v19-room-dust i:nth-child(4){left:80%;top:31%;animation-delay:-1s;transform:scale(.8)}
#lr-games .v19-room-dust i:nth-child(5){left:34%;top:70%;animation-delay:-5s;transform:scale(.55)}
#lr-games .v19-room-weather{position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;transition:opacity .5s}
#lr-games .v19-room-weather.is-rain{opacity:.18;background:repeating-linear-gradient(108deg,transparent 0 18px,#c5d9dc 19px 20px,transparent 21px 32px)}
#lr-games .v19-room-weather.is-cloudy{opacity:.12;background:linear-gradient(120deg,#aebbb3,transparent 65%)}
#lr-games .v19-room-vignette{position:absolute;inset:0;z-index:5;pointer-events:none;box-shadow:inset 0 0 34px #614b301c}
#lr-games .v19-room-stage .placed-furniture-wrap{position:absolute;width:22%;height:24%;transform:translate(-50%,-50%);z-index:7;display:grid;place-items:center}
#lr-games .v19-room-stage .placed-furniture{width:100%;height:100%;min-width:0;min-height:0;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;touch-action:none;display:grid;place-items:center}
#lr-games .v19-room-stage .placed-furniture svg{filter:drop-shadow(0 7px 6px #49362155);transition:transform .2s ease}
#lr-games .v20-room-stage{background:radial-gradient(ellipse at 50% 12%,#fffaf0 0%,#f0e4d1 65%,#d9c4a7 100%);overflow:hidden;isolation:isolate}
#lr-games .v20-room-stage .empty-room-shell{position:absolute;inset:0;width:100%;height:100%;z-index:0;display:block;filter:drop-shadow(0 7px 7px #71573a16)}
#lr-games .v20-room-stage .v19-room-light{z-index:1}
#lr-games .v20-room-stage .v19-room-dust{z-index:2}
#lr-games .v20-room-stage .placed-furniture-wrap{width:30%;height:34%;z-index:10;filter:drop-shadow(0 8px 7px #5a40272b)}
#lr-games .v20-room-stage .placed-furniture{width:100%;height:100%;overflow:visible}
#lr-games .v20-room-stage .placed-furniture svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 4px 3px #60472f30)}
#lr-games .v20-room-stage.decor-active .placed-furniture-wrap{outline:1px dashed #8d9d78;outline-offset:2px;border-radius:12px}
#lr-games .v20-room-empty-note{position:absolute;left:50%;top:72%;transform:translate(-50%,-50%);z-index:6;display:flex;flex-direction:column;align-items:center;gap:4px;width:max-content;max-width:80%;padding:9px 15px;border-radius:999px;background:#fffaf0c9;border:1px solid #e5d6c2;color:#8a7a66;text-align:center;pointer-events:none;box-shadow:0 4px 14px #71573a12}
#lr-games .v20-room-empty-note b{font:600 11px Georgia,'Noto Serif SC',serif;color:#786653}
#lr-games .v20-room-empty-note span{font-size:9px;letter-spacing:.04em}
#lr-games .furniture-product-art{height:124px;background:radial-gradient(ellipse at 50% 83%,#dfd2bd 0,transparent 62%),linear-gradient(145deg,#f9f2e5,#fffaf1)}
#lr-games .furniture-product-art svg{width:100%;height:116px;filter:drop-shadow(0 7px 6px #5e452b25)}
#lr-games .furniture-inventory button{min-height:74px;background:linear-gradient(145deg,#fffaf2,#f3e8d8)!important;border:1px solid #e4d5c1!important;border-radius:15px!important;box-shadow:0 4px 12px #735a3a0c}
#lr-games .furniture-inventory button svg{width:66px;height:56px;filter:drop-shadow(0 5px 4px #5e452b22)}
#lr-games .furniture-product-card{background:linear-gradient(160deg,#fffdf8,#f3eadc);box-shadow:0 6px 18px #80634412}
#lr-games .furniture-product-copy>b{font-size:12px}
#lr-games .furniture-product-copy>small{font-size:10px}

#lr-games .v19-room-stage .placed-furniture:active svg{transform:scale(1.05)}
#lr-games .v19-room-stage.decor-active{outline:2px solid #91a17d;outline-offset:3px;touch-action:none}
#lr-games .house-page .furniture-mega-shop{margin:16px 0 0;border-radius:24px;box-shadow:0 10px 28px #80634412}#lr-games .house-page .furniture-mega-shop>summary{padding:17px 18px;font-size:14px}#lr-games .house-page .furniture-mega-shop>.shop-accordion-body{padding:0 12px 14px}#lr-games .furniture-mega-shop>.shop-accordion-body{padding-top:10px}
#lr-games .furniture-shop-intro{padding:16px;border-radius:18px;background:linear-gradient(135deg,#f7efdf,#e8eddf);border:1px solid #e1d5c1;margin-bottom:12px}
#lr-games .furniture-shop-intro b{font:600 15px Georgia,'Noto Serif SC',serif;color:#5d5144}
#lr-games .furniture-shop-intro p{font-size:11px;line-height:1.8;color:#897a68;margin:7px 0}
#lr-games .furniture-shop-intro span{font-size:8px;letter-spacing:.18em;color:#9a987d}
#lr-games .furniture-category{border:1px solid #e9ddca;border-radius:17px;background:#fffaf2;margin:10px 0;overflow:hidden}
#lr-games .furniture-category>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:13px 14px;cursor:pointer;color:#655547;font-size:12px;font-weight:650}
#lr-games .furniture-category>summary::-webkit-details-marker{display:none}
#lr-games .furniture-category>summary:after{content:'＋';display:grid;place-items:center;flex:none;width:25px;height:25px;border-radius:50%;background:#edf0e5;color:#7f906f;font-size:14px}
#lr-games .furniture-category[open]>summary:after{content:'−'}
#lr-games .furniture-category>summary small{font-size:9px;font-weight:400;color:#a0907d;text-align:right}
#lr-games .furniture-shop-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:0 10px 12px}
#lr-games .furniture-product-card{min-width:0;overflow:hidden;border:1px solid #eee3d3;border-radius:15px;background:linear-gradient(160deg,#fffdf8,#f7efe3);box-shadow:0 3px 10px #8063440c}
#lr-games .furniture-product-art{height:91px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 80%,#e9dfce 0,transparent 62%),linear-gradient(145deg,#f6efdf,#fffaf1);border-bottom:1px solid #f0e6d8}
#lr-games .furniture-product-art svg{width:94%;height:83px;filter:drop-shadow(0 5px 4px #5e452b25)}
#lr-games .furniture-product-copy{padding:9px 9px 10px}
#lr-games .furniture-product-copy>b{display:block;font-size:11px;line-height:1.45;color:#5f5144;min-height:30px}
#lr-games .furniture-product-copy>small{display:block;min-height:28px;font-size:9px;line-height:1.55;color:#9a8875}
#lr-games .furniture-product-buy{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-top:7px}
#lr-games .furniture-product-buy strong{font-size:10px;color:#83916e;white-space:nowrap}
#lr-games .furniture-product-buy button{min-height:0;padding:6px 10px!important;border:1px solid #d9cbb8!important;border-radius:999px!important;background:#fffaf1!important;font-size:10px!important;color:#655344!important}
#lr-games .furniture-product-copy em{display:block;margin-top:5px;font-size:8px;font-style:normal;color:#a89986}
#lr-games .furniture-inventory button svg{width:48px;height:40px;filter:drop-shadow(0 3px 2px #5e452b1d)}
@keyframes v19SunDrift{0%{transform:translate(-2%,0) rotate(-1deg);opacity:.5}100%{transform:translate(3%,2%) rotate(1.5deg);opacity:1}}
@keyframes v19DustFloat{0%{transform:translate3d(0,10px,0);opacity:.08}50%{opacity:.8}100%{transform:translate3d(10px,-16px,0);opacity:.16}}
@media(max-width:390px){#lr-games .v19-room-stage{border-width:5px;border-radius:22px}#lr-games .furniture-shop-grid{gap:7px;padding:0 8px 10px}#lr-games .furniture-product-art{height:78px}#lr-games .furniture-product-art svg{height:72px}#lr-games .furniture-product-copy{padding:8px 7px}#lr-games .furniture-product-copy>b{font-size:10px}}
@media(prefers-reduced-motion:reduce){#lr-games .v19-room-stage *{animation:none!important;transition:none!important}}


`;
function mount(){if($('#lr-games'))return;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);const root=document.createElement('div');root.id='lr-games';root.innerHTML=`<div class="gbar"><button id="gclose">‹ 返回 LOVE RECORD</button><b id="gbarTitle">OUR LITTLE FARM · 我们的小农场</b></div><main class="gscroll" id="gbody"></main><nav class="gtabs" id="farmDock" aria-label="农场导航"></nav><div class="gtoast" id="farmToast"></div>`;document.body.appendChild(root);root.addEventListener('click',onClick);root.addEventListener('toggle',e=>{if(e.target.matches?.('.furniture-mega-shop'))furnitureShopOpen=!!e.target.open},true);root.addEventListener('change',onChange);root.addEventListener('pointerdown',onFurniturePointerDown);root.addEventListener('pointermove',onFurniturePointerMove);root.addEventListener('pointerup',onFurniturePointerUp);root.addEventListener('pointercancel',onFurniturePointerUp);$('#gclose').onclick=close;render()}
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
 const shell=`
 <!-- hand-painted room shell: wallpaper, mouldings, parquet and skirting -->
 <path d="M35 145 320 18 605 145 320 285Z" fill="url(#v18wallpaper)" stroke="#d4c2a5" stroke-width="5"/>
 <path d="M35 145 320 285 320 430 35 290Z" fill="url(#v18leftwall)"/>
 <path d="M320 285 605 145 605 290 320 430Z" fill="url(#v18rightwall)"/>
 <path d="M35 145 320 18 605 145" fill="none" stroke="#d2bd9d" stroke-width="11" stroke-linejoin="round"/>
 <path d="M42 151 320 29 598 151" fill="none" stroke="#fff9ec" stroke-width="3" opacity=".9"/>
 <path d="M35 290 320 430 605 290" fill="none" stroke="#9e7454" stroke-width="11" stroke-linejoin="round"/>
 <path d="M42 284 320 420 598 284" fill="none" stroke="#f8ead4" stroke-width="7"/>
 <path d="M52 173 320 300 588 173" fill="none" stroke="#fff9ed" stroke-width="5" opacity=".72"/>
 <path d="M54 182 320 309 586 182" fill="none" stroke="#d7c5a9" stroke-width="2" opacity=".65"/>
 <!-- wainscot panels -->
 <g fill="#f5ead8" fill-opacity=".34" stroke="#d8c5a8" stroke-width="2" opacity=".8">
 <path d="M52 208 105 233 105 279 52 253Z"/><path d="M120 241 174 267 174 313 120 287Z"/><path d="M189 275 243 301 243 347 189 321Z"/>
 <path d="M397 301 451 275 451 321 397 347Z"/><path d="M466 267 520 241 520 287 466 313Z"/><path d="M535 233 588 208 588 253 535 279Z"/>
 </g>
 <!-- parquet floor boards -->
 <path d="M35 290 320 430 605 290 320 151Z" fill="url(#v18floor)" opacity=".96"/>
 <path d="M35 290 320 430 605 290 320 151Z" fill="url(#v18parquet)" opacity=".72"/>
 <path d="M55 292 320 420 585 292" fill="none" stroke="#fff5e5" stroke-width="3" opacity=".55"/>
 <path d="M95 312 320 420M145 336 320 420M195 360 320 420M245 384 320 420M545 312 320 420M495 336 320 420M445 360 320 420M395 384 320 420" stroke="#946e4d" stroke-width="1.5" opacity=".18"/>
 <path d="M80 304 320 420 560 304" fill="none" stroke="#fff8eb" stroke-width="2" opacity=".35"/>
 <!-- soft woven rug -->
 <path d="M118 300 320 202 522 300 320 398Z" fill="url(#v18rug)" stroke="#f9f0e2" stroke-width="9"/>
 <path d="M137 300 320 212 503 300 320 388Z" fill="none" stroke="#c9aa88" stroke-width="2.5" opacity=".7"/>
 <path d="M154 300 320 221 486 300 320 379Z" fill="none" stroke="#fff8ec" stroke-width="2" opacity=".8"/>
 <path d="M178 300 320 232 462 300 320 368Z" fill="none" stroke="#c5a584" stroke-width="1.4" stroke-dasharray="3 7" opacity=".55"/>
 <g fill="#fff4e2" opacity=".65"><circle cx="320" cy="205" r="3"/><circle cx="522" cy="300" r="3"/><circle cx="320" cy="398" r="3"/><circle cx="118" cy="300" r="3"/></g>`;
 const window=`
 <!-- tall French casement window with outdoor garden view -->
 <g class="room-window" filter="url(#v18shadow)">
  <path d="M83 105 202 51 202 191 83 247Z" fill="#b58c68" stroke="#fff8e9" stroke-width="9"/>
  <path d="M94 111 191 67 191 183 94 228Z" fill="url(#v18glass)" stroke="#f8f0df" stroke-width="5"/>
  <path d="M94 111 191 67 191 183 94 228Z" fill="url(#v18skyshine)" opacity=".5"/>
  <path d="M143 89 143 205M94 169 191 125" stroke="#fffaf0" stroke-width="6"/>
  <path d="M103 119q22-15 40-5M154 91q15-8 27-4" stroke="#fff" stroke-width="3" opacity=".65" fill="none"/>
  <path d="M95 226q28-16 48-4 25-22 47-8" fill="none" stroke="#8ea47a" stroke-width="7" opacity=".7"/>
  <path d="M113 219q-7-35 12-43 18 18-12 43Zm24-10q7-38 27-35 8 24-27 35Z" fill="#88a277" opacity=".85"/>
  <!-- curtain rod and linen curtains -->
  <path d="M73 99 211 36" stroke="#9d7657" stroke-width="7" stroke-linecap="round"/>
  <path class="room-curtain room-curtain-left" d="M78 100q20-15 34-8l9 124q-18 18-35 9Z" fill="url(#v18linen)" stroke="#ddc7ab" stroke-width="2"/>
  <path class="room-curtain room-curtain-right" d="M190 49q-16-9-27 2l4 129q17 12 29-1Z" fill="url(#v18linen)" stroke="#ddc7ab" stroke-width="2"/>
  <path d="M86 115q12 8 24-2M88 145q12 8 25-2M171 65q10 8 18 0" stroke="#c9ad91" stroke-width="2" fill="none" opacity=".65"/>
 </g>`;
 const fireplace=`
 <g class="room-fireplace" filter="url(#v18shadow)">
  <path d="M407 128 520 178 520 294 407 244Z" fill="#b88b66" stroke="#e7d0b2" stroke-width="8"/>
  <path d="M421 145 506 183 506 275 421 237Z" fill="#594033" stroke="#8f694d" stroke-width="5"/>
  <path d="M414 132 520 178" stroke="#f8e8d0" stroke-width="8" stroke-linecap="round"/>
  <path d="M423 238 506 275" stroke="#3c3029" stroke-width="9"/>
  <g class="room-flame"><path d="M461 257q-29-28-9-57 1 18 13 22-4-31 18-49-7 29 11 43 20 30-8 48-18 11-25-7Z" fill="#e8894d"/><path d="M469 257q-12-18 1-34 2 12 9 14 9 15-3 25-5 4-7-5Z" fill="#ffd27b"/><path d="M480 260q-4-11 5-18 10 15-1 23Z" fill="#fff0b1"/></g>
  <path d="M397 126 525 184" stroke="#d8b58d" stroke-width="7"/>
 </g>`;
 const leftShelf=`
 <g class="room-shelf" filter="url(#v18shadow)">
  <path d="M75 263 182 213" stroke="#a77a55" stroke-width="10" stroke-linecap="round"/>
  <path d="M90 255 90 276M166 219 166 242" stroke="#916a4b" stroke-width="4"/>
  <path d="M100 241q10-22 22-2v21h-22Z" fill="#f3e6d1" stroke="#c5a889" stroke-width="2"/>
  <path d="M128 228q10-18 20 0v20h-20Z" fill="#d7e1d2" stroke="#9daa8c" stroke-width="2"/>
  <path d="M151 216q8-16 17 0v18h-17Z" fill="#d9b89b" stroke="#b48d6c" stroke-width="2"/>
 </g>`;
 if(room==='living') return shell+window+fireplace+leftShelf;
 if(room==='bedroom') return shell+window+`<g class="bedroom-wall-decor"><path d="M408 92 485 57 485 135 408 170Z" fill="#b98e6b" stroke="#fff8e9" stroke-width="7"/><path d="M420 99 474 75 474 127 420 151Z" fill="#e7e5d4"/><path d="M431 141q10-27 27-39m-23 23q-13-12-18-3m31-16q14-14 21-7" fill="none" stroke="#81966f" stroke-width="4"/></g>`;
 if(room==='kitchen') return shell+`<g class="kitchen-window"><path d="M80 105 196 52 196 177 80 230Z" fill="#b58b67" stroke="#fff8e9" stroke-width="8"/><path d="M91 111 185 68 185 169 91 212Z" fill="url(#v18glass)"/><path d="M138 90v101M91 160l94-43" stroke="#fff" stroke-width="5"/></g>`;
 return shell+window+`<g class="balcony-view"><path d="M45 260 320 395 595 260" stroke="#fff7e9" stroke-width="8" fill="none"/><path d="M58 268 58 190M125 301 125 223M192 334 192 256M259 367 259 289M326 383 326 305M393 350 393 272M460 317 460 239M527 284 527 206M594 251 594 173" stroke="#a98260" stroke-width="6"/><path d="M45 190 320 325 595 190" stroke="#d2b18d" stroke-width="8" fill="none"/><path d="M45 198 320 333 595 198" stroke="#fff4df" stroke-width="3" fill="none"/></g>`;
}
function furnitureButton(item,room,placed,index){if(!placed)return '';const x=Math.max(4,Math.min(88,Number(placed.x??(22+(index%3)*25)))),y=Math.max(12,Math.min(84,Number(placed.y??(52+(index%2)*13))));const uid=esc(placed.uid||`${placed.id}-${index}`);return `<div class="placed-furniture-wrap" style="left:${x}%;top:${y}%;z-index:${10+Math.round(y)}"><button class="placed-furniture" data-drag-furniture="${uid}" data-furniture-room="${room}" aria-label="拖动${item.name}">${item.svg}</button>${farm.house.decorMode?`<button class="furniture-remove" data-remove-furniture="${uid}" data-furniture-room="${room}">收回</button>`:''}</div>`}

function roomDetailArt(room){
 const ambient=`<g class="room-ambient" pointer-events="none">
  <path class="room-sunbeam" d="M105 90 270 40 410 340 220 390Z" fill="url(#v18sunbeam)" opacity=".42"/>
  <g class="room-dust" fill="#fff8df"><circle cx="260" cy="128" r="2.8"/><circle cx="330" cy="180" r="2"/><circle cx="375" cy="110" r="2.4"/><circle cx="215" cy="225" r="1.8"/><circle cx="470" cy="260" r="2.2"/></g>
  <g class="room-glints" fill="#fff9e9"><path d="M285 85l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/><path d="M540 220l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>
 </g>`;
 const plant=(x,y,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})" class="room-potted-plant" filter="url(#v18shadow)"><path d="M-21 0 0-11 21 0 0 12Z" fill="#b88767"/><path d="M-15 1 15 1 11 32-11 32Z" fill="url(#v18pot)" stroke="#a97759" stroke-width="2"/><path d="M0 3 0-53" stroke="#71865d" stroke-width="4"/><g class="room-leaves" fill="#78946a" stroke="#5f7d58" stroke-width="1.5"><path d="M0-28q-31-31-43-9 15 24 43 9Z"/><path d="M0-36q-8-38 13-42 17 23-13 42Z"/><path d="M0-24q28-39 45-18-12 27-45 18Z"/><path d="M0-13q-26-25-39-8 15 22 39 8Z"/><path d="M0-45q17-29 31-17-7 22-31 17Z"/></g></g>`;
 const lamp=(x,y)=>`<g class="room-table-lamp" filter="url(#v18shadow)"><path d="M${x} ${y}v42" stroke="#9b7657" stroke-width="5"/><path d="M${x-19} ${y} ${x+19} ${y} ${x+12} ${y-28} ${x-12} ${y-28}Z" fill="url(#v18lampshade)" stroke="#c7a66e" stroke-width="2"/><path d="M${x-14} ${y-2}h28" stroke="#fff0b7" stroke-width="3"/><ellipse cx="${x}" cy="${y+44}" rx="14" ry="4" fill="#8e6d4e" opacity=".25"/></g>`;
 const rooms={
 living:`<g class="living-details" pointer-events="none">
  <!-- large hand-upholstered French sofa -->
  <ellipse cx="320" cy="348" rx="145" ry="42" fill="#765b43" opacity=".18" filter="url(#v18blur)"/>
  <path d="M185 292 318 230 455 293 318 358Z" fill="#8b9a79" stroke="#687b60" stroke-width="4"/>
  <path d="M185 292 185 333q5 24 29 31l104 48v-54Z" fill="url(#v18sofaSide)" stroke="#6f8062" stroke-width="4"/>
  <path d="M318 358 455 293v42q-4 22-25 31l-112 52Z" fill="#879775" stroke="#6c7d5f" stroke-width="4"/>
  <path d="M202 283q8-36 37-45l80-37 93 44q31 16 36 48l-130 65Z" fill="url(#v18sofa)" stroke="#6c8061" stroke-width="4"/>
  <path d="M214 288 318 337 427 286l-4 39-105 53-104-49Z" fill="#aab895" stroke="#74876b" stroke-width="3"/>
  <path d="M225 286 267 266 310 286 310 324 267 344 225 324Z" fill="#e8d4bd" stroke="#c5aa8c" stroke-width="3"/><path d="M326 285 370 265 413 285 413 323 370 344 326 324Z" fill="#d9b59d" stroke="#b68f76" stroke-width="3"/>
  <path d="M237 292q22-13 45 0M338 291q22-13 45 0" fill="none" stroke="#fff4e6" stroke-width="3" opacity=".75"/>
  <path d="M204 343 204 363M438 333 438 353" stroke="#88674e" stroke-width="8" stroke-linecap="round"/>
  <!-- coffee table with book and tea -->
  <path d="M268 365 320 340 375 366 320 394Z" fill="#a97f5d" opacity=".24"/>
  <path d="M270 344 320 320 371 344 320 370Z" fill="url(#v18oak)" stroke="#956d4d" stroke-width="3"/><path d="M283 350 283 375M357 350 357 375" stroke="#936b4c" stroke-width="5"/>
  <path d="M297 339 319 329 341 339 319 350Z" fill="#f2e5d2" stroke="#cbb79d" stroke-width="2"/><path d="M301 337 320 328 338 337" stroke="#a4a98a" stroke-width="2" fill="none"/>
  <path d="M344 341q-10-13 2-18 14 7 7 18Z" fill="#f4eee0" stroke="#b9a58c" stroke-width="2"/><path d="M351 323q-6-8 1-13m2 12q-2-8 5-11" stroke="#fff" stroke-width="2" fill="none" class="room-steam"/>
  <!-- sideboard, books, vase -->
  <path d="M405 250 470 219 535 250 470 282Z" fill="#d6b28d" stroke="#a77c59" stroke-width="3"/><path d="M405 250 470 282 470 329 405 297Z" fill="#b98d68"/><path d="M470 282 535 250 535 297 470 329Z" fill="#d0a982"/>
  <path d="M424 260 470 282 470 310 424 288Z" fill="#ead7bd" stroke="#a77c59" stroke-width="2"/><circle cx="460" cy="292" r="3" fill="#806047"/>
  <path d="M433 240 459 228 483 239 457 252Z" fill="#81916e"/><path d="M438 235 463 223 488 234 463 246Z" fill="#d6a77f"/><path d="M443 230 466 219 489 230 466 241Z" fill="#eee1c9"/>
  <path d="M502 238q-12-16-1-25 13 7 6 25Z" fill="#d9c4a7" stroke="#b69877" stroke-width="2"/><path d="M505 234q-20-18-25-5 8 14 25 5m0 0q17-19 25-7-7 17-25 7" fill="#81966e"/>
  ${plant(105,340,.9)}${lamp(350,270)}
  <!-- framed botanical print -->
  <path d="M480 75 548 107v76l-68-32Z" fill="#a97d5d" stroke="#fff7e8" stroke-width="6"/><path d="M490 86 538 109v60l-48-23Z" fill="#f3eadb"/><path d="M515 156q-10-26 3-43m-3 31q-14-14-21-7m22-17q13-13 20-5" stroke="#82966e" stroke-width="3" fill="none"/>
 </g>`,
 bedroom:`<g class="bedroom-details" pointer-events="none">
  <!-- upholstered headboard -->
  <path d="M160 190 275 137 392 191 392 234 275 290 160 234Z" fill="#b88c6b" stroke="#966f53" stroke-width="5"/>
  <path d="M173 194 275 147 379 194 379 224 275 273 173 224Z" fill="url(#v18headboard)" stroke="#e9d5bd" stroke-width="4"/>
  <path d="M190 199 275 160 362 199M190 217 275 256 362 217" stroke="#fff3e3" stroke-width="2" opacity=".7" fill="none"/>
  <!-- layered pillows -->
  <path d="M190 211 242 187 293 211 242 236Z" fill="#f9f1e4" stroke="#d6bea1" stroke-width="3"/><path d="M253 211 308 185 359 209 305 235Z" fill="#f3e6d6" stroke="#d0b69a" stroke-width="3"/>
  <path d="M205 210q34-18 67 0M269 210q35-18 69 0" fill="none" stroke="#d9c2a7" stroke-width="2"/>
  <!-- thick duvet with embroidered seams -->
  <path d="M145 235 275 296 405 235 405 292 275 359 145 297Z" fill="url(#v18duvet)" stroke="#b98f70" stroke-width="4"/>
  <path d="M145 235 275 296 405 235 375 220 275 267 174 220Z" fill="#f8efe1" stroke="#d8c1a6" stroke-width="3"/>
  <path d="M164 246 275 298 385 246M164 270 275 322 385 270M184 288 275 331 366 288" fill="none" stroke="#fff8ec" stroke-width="2.5" opacity=".8"/>
  <path d="M205 267q18-14 35 0m68 28q18-14 35 0" fill="none" stroke="#c8a78b" stroke-width="2" stroke-dasharray="3 5"/>
  <!-- bed frame and turned legs -->
  <path d="M145 297 275 359 405 292v24L275 382 145 321Z" fill="#b78965" stroke="#956c4e" stroke-width="3"/><path d="M163 320 163 344M386 313 386 337" stroke="#8e684a" stroke-width="8" stroke-linecap="round"/>
  <!-- bedside tables -->
  <path d="M410 276 451 256 492 276 451 297Z" fill="#d8b48f" stroke="#a77d5c" stroke-width="3"/><path d="M410 276 451 297 451 338 410 316Z" fill="#bb906c"/><path d="M451 297 492 276 492 316 451 338Z" fill="#d3ae88"/><path d="M420 285 451 301 451 321 420 305Z" fill="#ecdac1"/><circle cx="444" cy="309" r="3" fill="#8d684d"/>
  <path d="M438 262v-19l13-6 13 6v19" fill="#f2e4cf" stroke="#b89a78" stroke-width="2"/><path d="M442 242q-6-13 9-20 14 10 7 20Z" fill="#f5d58d" class="room-lamp-glow"/>
  <path d="M95 306 132 289 168 306 132 324Z" fill="#c38f70"/><path d="M107 306 107 339 132 352 157 339 157 306Z" fill="#d2a083"/>${plant(132,302,.65)}
  <!-- wall art and small floating shelf -->
  <path d="M430 91 495 61 495 126 430 157Z" fill="#ad8060" stroke="#fff8ea" stroke-width="6"/><path d="M440 99 484 79v42l-44 20Z" fill="#e8eadc"/><path d="M459 132q-5-20 7-35m-6 25q-12-9-17-1" stroke="#84976f" stroke-width="3" fill="none"/>
  <path d="M405 180 490 140" stroke="#9f7958" stroke-width="7"/><path d="M420 171q9-15 18 0v12h-18Z" fill="#e8d9c5"/><path d="M447 159q9-14 18 0v12h-18Z" fill="#d8e2d3"/>
 </g>`,
 kitchen:`<g class="kitchen-details" pointer-events="none">
  <!-- tiled backsplash with hand-painted tile details -->
  <path d="M80 175 220 110 365 178 220 246Z" fill="#f8f1e5" stroke="#d7c5aa" stroke-width="3"/>
  <path d="M104 175 220 121 341 178M104 198 220 253 341 198M143 157 143 216M181 139 181 235M220 121 220 253M260 140 260 235M300 159 300 216" stroke="#d8c8b2" stroke-width="2" fill="none"/>
  <g fill="#a5b18d" opacity=".55"><path d="M130 178q8-13 16 0-8 12-16 0Z"/><path d="M237 150q8-13 16 0-8 12-16 0Z"/><path d="M286 190q8-13 16 0-8 12-16 0Z"/></g>
  <!-- lower cabinets and butcher-block counter -->
  <path d="M82 232 222 166 362 232 222 300Z" fill="#d8b38c" stroke="#a77c58" stroke-width="4"/><path d="M82 232 222 300 222 365 82 297Z" fill="#c29570"/><path d="M222 300 362 232 362 297 222 365Z" fill="#d0a77f"/>
  <path d="M99 242 222 301 222 345 99 285Z" fill="#e9d4b8" stroke="#a77d59" stroke-width="3"/><path d="M235 306 345 253 345 294 235 348Z" fill="#e7d1b3" stroke="#a77d59" stroke-width="3"/>
  <path d="M160 272 160 319M286 291 286 328" stroke="#b58b67" stroke-width="3"/><circle cx="176" cy="309" r="3" fill="#89664a"/><circle cx="303" cy="319" r="3" fill="#89664a"/>
  <!-- inset sink and brass tap -->
  <path d="M117 227 176 199 234 227 175 256Z" fill="#f4eee2" stroke="#b89b7c" stroke-width="3"/><path d="M135 227 176 208 216 227 175 247Z" fill="#b8d1cb" stroke="#e9f3e9" stroke-width="3"/><path d="M176 207v-17q0-12 13-12h10" fill="none" stroke="#b88d5d" stroke-width="5" stroke-linecap="round"/>
  <!-- stove with enamel top and burners -->
  <path d="M245 180 293 158 341 180 293 204Z" fill="#f6f0e5" stroke="#b99d7e" stroke-width="3"/><ellipse cx="278" cy="180" rx="12" ry="6" fill="#81776b"/><ellipse cx="307" cy="192" rx="12" ry="6" fill="#81776b"/><path d="M266 181 266 194M319 190 319 203" stroke="#aa8b69" stroke-width="3"/>
  <!-- wall shelf with jars, plates and hanging herbs -->
  <path d="M398 123 526 183" stroke="#9f7654" stroke-width="9" stroke-linecap="round"/><path d="M416 129v-24M458 149v-24M500 169v-24" stroke="#a57c58" stroke-width="3"/>
  <path d="M405 104q12-18 24 0v23h-24Z" fill="#e9dcc8" stroke="#bda487" stroke-width="2"/><path d="M448 124q12-18 24 0v22h-24Z" fill="#d7e3d6" stroke="#a3b296" stroke-width="2"/><path d="M490 144q12-18 24 0v22h-24Z" fill="#f2d8bf" stroke="#c9a17d" stroke-width="2"/>
  <path d="M410 96q15-20 30 0M453 116q15-20 30 0" fill="none" stroke="#fff8ec" stroke-width="3"/>
  <!-- fruit bowl, bread board, tea kettle -->
  <path d="M270 218q35 27 70 0l-7 17q-27 17-56 0Z" fill="#b67f5e" stroke="#946847" stroke-width="2"/><circle cx="284" cy="213" r="11" fill="#d77f6d"/><circle cx="306" cy="207" r="12" fill="#e5b86f"/><circle cx="327" cy="215" r="10" fill="#8b9e72"/>
  <path d="M375 229 402 216 428 229 401 242Z" fill="#c69c73"/><path d="M387 220q-4-16 10-20 15 8 7 20Z" fill="#f0e7d7" stroke="#ad9274" stroke-width="2"/><path d="M398 201q-7-10 1-17m4 16q-2-9 5-13" fill="none" stroke="#fff" stroke-width="2" class="room-steam"/>
  <path d="M540 194q18-4 25 13l-7 39-25-12Z" fill="#f8f0e4" stroke="#d7c4aa" stroke-width="2"/><path d="M538 207q10 8 19 0" stroke="#c5aa8e" stroke-width="2" fill="none"/>
  ${plant(550,285,.65)}
 </g>`,
 balcony:`<g class="balcony-details" pointer-events="none">
  <!-- canopy and warm string lights -->
  <path d="M70 103q120-65 270-4" fill="none" stroke="#a9805d" stroke-width="5"/><path d="M93 92v16M145 75v17M200 66v18M255 73v18M310 91v16" stroke="#a9805d" stroke-width="2"/>
  <g class="balcony-lights" fill="#f5d98e"><circle cx="93" cy="109" r="6"/><circle cx="145" cy="92" r="6"/><circle cx="200" cy="84" r="6"/><circle cx="255" cy="91" r="6"/><circle cx="310" cy="107" r="6"/></g>
  <!-- wrought iron railing and climbing vines -->
  <path d="M55 250 320 382 585 250" fill="none" stroke="#987455" stroke-width="9"/><path d="M55 250 55 181M112 278 112 209M169 306 169 237M226 335 226 266M283 363 283 294M340 372 340 303M397 344 397 275M454 316 454 247M511 288 511 219M585 250 585 181" stroke="#b48c67" stroke-width="6"/><path d="M55 185 320 317 585 185" fill="none" stroke="#f4e6d0" stroke-width="5"/>
  <!-- bistro table -->
  <path d="M250 300 304 274 358 300 304 327Z" fill="#c59b74" stroke="#987150" stroke-width="4"/><path d="M304 327v43M282 361h44" stroke="#987150" stroke-width="6"/><path d="M275 298 304 284 333 298 304 312Z" fill="#f3e7d6"/>
  <path d="M291 293q-7-13 4-17 12 7 6 17Z" fill="#f4e9d8" stroke="#b89b7d" stroke-width="2"/><path d="M298 276q-5-7 1-12m3 12q-2-7 4-10" stroke="#fff" stroke-width="2" fill="none" class="room-steam"/>
  <!-- rattan chair with woven back -->
  <path d="M390 273 439 250 489 273 439 297Z" fill="#d2aa7f" stroke="#98704f" stroke-width="4"/><path d="M397 269 397 229q42-28 84 0v43" fill="#d8b48b" stroke="#98704f" stroke-width="5"/><path d="M407 237q30-18 63 0M407 249q30-18 63 0M407 261q30-18 63 0" fill="none" stroke="#f0d8b6" stroke-width="2"/><path d="M401 273v55M477 273v55M413 319h54" stroke="#98704f" stroke-width="6"/>
  <!-- flower boxes and abundant blooms -->
  <path d="M78 310 130 284 183 310 130 337Z" fill="#b98262" stroke="#986b4e" stroke-width="3"/><path d="M89 310v27l41 21 42-21v-27" fill="#c78e6c"/><g class="room-leaves" fill="#7f986b"><path d="M130 307q-39-38-49-12 20 23 49 12Z"/><path d="M130 307q-3-45 20-45 13 28-20 45Z"/><path d="M130 307q37-40 52-14-15 27-52 14Z"/><path d="M130 307q-20-27-34-12 12 21 34 12Z"/></g><g fill="#e6a6a0" stroke="#c78379" stroke-width="1.5"><circle cx="100" cy="287" r="9"/><circle cx="148" cy="267" r="10"/><circle cx="169" cy="294" r="8"/><circle cx="121" cy="275" r="7"/></g>
  <path d="M500 321 535 304 570 321 535 338Z" fill="#b98060"/><path d="M510 321v29l25 13 25-13v-29" fill="#ca9270"/>${plant(535,312,.65)}
 </g>`
 };
 return `${ambient}${rooms[room]||rooms.living}`;
}

function emptyRoomShellArt(room){
 const id=`room-${room}`;
 const base=`<defs>
 <linearGradient id="${id}-wall" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffaf0"/><stop offset="1" stop-color="#e9ddc9"/></linearGradient>
 <linearGradient id="${id}-floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e8d3b5"/><stop offset="1" stop-color="#c49a73"/></linearGradient>
 <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d9eeea"/><stop offset="1" stop-color="#9fc6c2"/></linearGradient>
 <pattern id="${id}-wallpaper" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1" fill="#c9b99f" opacity=".24"/><path d="M14 12q4-6 8 0-4 6-8 0Z" fill="none" stroke="#d7c7b1" stroke-width=".7" opacity=".22"/></pattern>
 <pattern id="${id}-boards" width="92" height="28" patternUnits="userSpaceOnUse"><path d="M0 0H92M0 27H92M46 0V27" stroke="#a77c58" stroke-width="1" opacity=".24"/><path d="M8 8q18-4 32 0m19 12q13-3 25 0" stroke="#fff4df" stroke-width="1" opacity=".28" fill="none"/></pattern>
 <filter id="${id}-soft"><feGaussianBlur stdDeviation="7"/></filter>
 </defs>
 <rect width="640" height="480" fill="#f3ead9"/>
 <path d="M42 190 320 35 598 190 320 345Z" fill="url(#${id}-wall)" stroke="#cdbb9e" stroke-width="5"/>
 <path d="M42 190 320 345 320 402 42 246Z" fill="#f4ead9" stroke="#cdbb9e" stroke-width="4"/>
 <path d="M320 345 598 190 598 246 320 402Z" fill="#eee1ce" stroke="#cdbb9e" stroke-width="4"/>
 <path d="M42 190 320 345 598 190" fill="none" stroke="#fffaf0" stroke-width="10" opacity=".9"/>
 <path d="M320 345 320 402" stroke="#a77e5b" stroke-width="6"/>
 <path d="M42 246 320 402 598 246" fill="none" stroke="#a77c58" stroke-width="10"/>
 <path d="M55 239 320 386 585 239" fill="none" stroke="#f8eedf" stroke-width="5"/>
 <path d="M42 190 320 35 598 190 320 345Z" fill="url(#${id}-wallpaper)" opacity=".75"/>
 <path d="M58 211 320 357 582 211" fill="none" stroke="#d4c2a8" stroke-width="3" opacity=".7"/>
 <path d="M42 224 320 379 598 224" fill="none" stroke="#fff8eb" stroke-width="3" opacity=".7"/>
 <path d="M72 252 320 391 568 252" fill="none" stroke="#8e694b" stroke-width="2" opacity=".25"/>
 <path d="M320 345 320 402" stroke="#fff8eb" stroke-width="2"/>`;
 let fixtures='';
 if(room==='living'||room==='bedroom'){
  fixtures=`<g><path d="M105 150 177 110 249 150 177 190Z" fill="#a9815e" stroke="#fff8eb" stroke-width="7"/><path d="M115 150 177 116 239 150 177 184Z" fill="url(#${id}-glass)" stroke="#fff8eb" stroke-width="4"/><path d="M177 116v68M115 150h124" stroke="#fffaf1" stroke-width="5"/><path d="M94 145q13-11 22-7l4 83q-13 9-26 0Zm146-2q13-10 22-5l-3 79q-13 8-22-1Z" fill="#f6ead8" stroke="#d7c2a5" stroke-width="2"/><path d="M100 151q8 7 15 0m-15 18q8 7 15 0m130-17q8 7 15 0m-15 17q8 7 15 0" stroke="#dfcbb1" stroke-width="2" fill="none"/></g>`;
 } else if(room==='kitchen'){
  fixtures=`<g opacity=".95"><path d="M80 142 190 82 300 142 190 202Z" fill="#f7f0e4" stroke="#d8c8b3" stroke-width="3"/><path d="M80 142 190 202 300 142M117 122 117 163M153 102 153 182M190 82 190 202M227 102 227 182M263 122 263 163" stroke="#d7c7b2" stroke-width="2" fill="none"/><g fill="#a5b18d" opacity=".45"><path d="M135 140q9-14 18 0-9 13-18 0Z"/><path d="M222 132q9-14 18 0-9 13-18 0Z"/></g></g>`;
 } else {
  fixtures=`<g><path d="M95 165 205 105 315 165 205 225Z" fill="url(#${id}-glass)" stroke="#fffaf0" stroke-width="8"/><path d="M95 165 205 225 315 165M205 105v120" stroke="#fffaf0" stroke-width="5"/><path d="M80 230 320 365 560 230" fill="none" stroke="#a67b57" stroke-width="8"/><path d="M95 239 95 192M160 275 160 228M225 312 225 265M290 347 290 300M355 347 355 300M420 312 420 265M485 275 485 228M550 239 550 192" stroke="#b28d6b" stroke-width="5"/><path d="M80 192 320 327 560 192" fill="none" stroke="#fff5e4" stroke-width="6"/></g>`;
 }
 const floor=`<path d="M58 246 320 392 582 246 320 101Z" fill="url(#${id}-floor)" opacity=".18"/><path d="M58 246 320 392 582 246 320 101Z" fill="url(#${id}-boards)" opacity=".9"/>`;
 return `<svg class="empty-room-shell" viewBox="0 0 640 480" role="img" aria-label="${({living:'空置客厅',bedroom:'空置卧室',kitchen:'空置厨房',balcony:'空置阳台'}[room]||'空置房间')}" preserveAspectRatio="xMidYMid meet">${base}${floor}${fixtures}<g fill="#fffaf0" opacity=".65"><circle cx="320" cy="66" r="3"/><circle cx="294" cy="80" r="1.5"/><circle cx="350" cy="93" r="2"/></g></svg>`;
}
function roomStage(room){
 const weather=farm.world?.weather||'晴';
 return `<div class="v21-room-stage" data-room-stage="${room}" data-lr3d-room="${room}">
   <div class="lr3d-viewport" data-lr3d-viewport="${room}" role="img" aria-label="${({living:'3D客厅',bedroom:'3D卧室',kitchen:'3D厨房',balcony:'3D阳台'}[room]||'3D小屋')}" >
     <div class="lr3d-loading"><span class="lr3d-loading-mark">✿</span><b>正在布置你们的小家</b><small>3D 场景准备中…</small></div>
   </div>
   <div class="lr3d-stage-tools"><button type="button" data-action="decor-toggle">${farm.house.decorMode?'完成装修':'✎ 装修'}</button><button type="button" data-action="open-furniture-shop">家具商店</button></div>
   <div class="lr3d-caption"><span>3D HOME</span><span>左右滑动旋转 · 双指缩放全景</span></div>
 </div>`;
}

function houseView(){
 ensureWorld();const h=farm.house,room=h.currentRoom||'living',names={living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'},ch=storyScene();
 if(!farm.buildings.cottage)return `${header()}<section class="gcard"><b>小屋还没有建好</b><p class="gmuted">先去商店建造温馨小屋，再回来看看吧。</p><button class="primary" data-view="shop">去建造</button></section>`;
 const inv=Object.entries(h.furnitureInventory||{}).filter(([,n])=>n>0).map(([id,n])=>{const item=furnitureCatalog.find(x=>x.id===id);return item&&(item.room==='all'||item.room===room)?`<button data-place-furniture="${id}" data-furniture-room="${room}">${item.svg}<span>${item.name} ×${n}</span></button>`:''}).join('');
 return `<section class="house-page"><div class="house-intro"><button class="house-back" data-view="farm">← 回到农场</button><div class="house-kicker">LOVE RECORD · FRENCH COUNTRY HOME</div><h1>${names[room]}</h1><p>${esc(farm.partnerName||'你们')}的小小家 · ${farm.season}季 · ${farm.world.weather||'晴'}</p></div>
 <div class="room-tabs">${Object.entries(names).map(([id,n])=>`<button data-room="${id}" class="${room===id?'active':''}">${n}</button>`).join('')}</div>
 ${roomStage(room)}
 <section class="house-controls house-decor-panel"><div class="house-section-title"><div><b>${h.decorMode?'装修模式':'我的小家'}</b><small>${h.decorMode?'拖动家具摆放，点选家具调整颜色与角度':'左右滑动旋转视角，双指缩放查看全景'}</small></div><span class="house-decor-summary">已摆放 ${(h.placed?.[room]||[]).length} 件</span></div>
 ${h.decorMode?`<div class="furniture-inventory">${inv||'<p class="gmuted">当前房间还没有可摆放的家具，打开家具图鉴挑选吧。</p>'}</div>`:''}
 </section>
 ${furnitureShopView()}
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
function onFurniturePointerDown(e){const b=e.target.closest('[data-drag-furniture]');if(!b||!farm.house.decorMode)return;const stage=b.closest('[data-room-stage]'),wrap=b.closest('.placed-furniture-wrap');if(!stage||!wrap)return;const rect=stage.getBoundingClientRect();furnitureDrag={uid:b.dataset.dragFurniture,room:b.dataset.furnitureRoom,stage,rect,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,left:parseFloat(wrap.style.left)||50,top:parseFloat(wrap.style.top)||50,el:wrap};try{b.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()}
function onFurniturePointerMove(e){if(!furnitureDrag||e.pointerId!==furnitureDrag.pointerId)return;const d=furnitureDrag,dx=(e.clientX-d.startX)/d.rect.width*100,dy=(e.clientY-d.startY)/d.rect.height*100;d.el.style.left=Math.max(3,Math.min(90,d.left+dx))+'%';d.el.style.top=Math.max(8,Math.min(84,d.top+dy))+'%'}
function onFurniturePointerUp(e){if(!furnitureDrag||e.pointerId!==furnitureDrag.pointerId)return;const d=furnitureDrag;const arr=farm.house.placed[d.room]||(farm.house.placed[d.room]=[]);let item=arr.find(x=>String(x.uid)===String(d.uid));if(item){item.x=parseFloat(d.el.style.left)||d.left;item.y=parseFloat(d.el.style.top)||d.top;}furnitureDrag=null;save()}
async function onClick(e){const b=e.target.closest('button');if(!b)return;if(b.dataset.action==='rescue-scan'){scanFarmArchives();return}if(b.dataset.rescueRestore!==undefined){restoreFarmArchive(b.dataset.rescueRestore);return}if(b.dataset.view==='rescue'){view='rescue';render();return}if(storageBlocked){if(b.dataset.action==='retry-storage')retryStorageLoad();else toast('存档读取尚未恢复，暂时暂停操作以保护旧数据');return}if(switchingOwner)return;if(b.dataset.action==='open-furniture-shop'){furnitureShopOpen=true;render();requestAnimationFrame(()=>document.querySelector('.furniture-mega-shop')?.scrollIntoView({behavior:'smooth',block:'start'}));return}if(b.dataset.room){if(!['living','bedroom','kitchen','balcony'].includes(b.dataset.room))return;farm.house.currentRoom=b.dataset.room;farm.house.roomsVisited=Array.isArray(farm.house.roomsVisited)?farm.house.roomsVisited:[];if(!farm.house.roomsVisited.includes(b.dataset.room))farm.house.roomsVisited.push(b.dataset.room);ensureDailyProgress();farm.dailyProgress.roomsVisited=(farm.dailyProgress.roomsVisited||0)+1;save();render();return}if(b.dataset.buyFurniture){const item=furnitureCatalog.find(x=>x.id===b.dataset.buyFurniture);if(!item)return;if(farm.coins<item.price){toast('金币还不够，慢慢攒起来哦');return}farm.coins-=item.price;farm.house.furnitureInventory[item.id]=(farm.house.furnitureInventory[item.id]||0)+1;addLog(`购买了家具「${item.name}」，可以去小屋布置啦。`);save();toast(`${item.name}已放入家具库存`);render();return}if(b.dataset.removeFurniture){const uid=b.dataset.removeFurniture,room=b.dataset.furnitureRoom;const arr=farm.house.placed[room]||[];const index=arr.findIndex(x=>String(x.uid)===String(uid));if(index<0)return;const [removed]=arr.splice(index,1);farm.house.furnitureInventory[removed.id]=(farm.house.furnitureInventory[removed.id]||0)+1;save();render();return}if(b.dataset.placeFurniture){const id=b.dataset.placeFurniture,room=b.dataset.furnitureRoom;const inv=farm.house.furnitureInventory[id]||0;if(!inv){toast('家具库存不足');return}const catalogItem=furnitureCatalog.find(x=>x.id===id);if(catalogItem&&catalogItem.room!=='all'&&catalogItem.room!==room){toast('这件家具适合放在'+({bedroom:'卧室',kitchen:'厨房',balcony:'阳台'}[catalogItem.room]||'指定房间'));return}const arr=farm.house.placed[room]||(farm.house.placed[room]=[]);const uid=`f-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;arr.push({uid,id,x:35+(arr.length%3)*15,y:55+(arr.length%3)*8,scale:1,rotation:0});farm.house.furnitureInventory[id]=inv-1;save();render();return}if(b.dataset.action==='decor-toggle'){farm.house.decorMode=!farm.house.decorMode;render();return}if(b.dataset.action==='claim-world-event'){const ev=farm.world?.pendingEvent;if(!ev){toast('这份惊喜已经被收下啦');return}farm.coins+=Number(ev.coins)||0;farm.xp+=Number(ev.xp)||0;if(ev.kind==='festival'){farm.world.festivalClaims=Array.isArray(farm.world.festivalClaims)?farm.world.festivalClaims:[];farm.world.festivalClaims.push(ev.id)}farm.world.pendingEvent=null;ensureDailyProgress();farm.dailyProgress.eventsClaimed=(farm.dailyProgress.eventsClaimed||0)+1;addLog(`参与「${ev.title}」，获得 ${ev.coins} 金币和 ${ev.xp} 经验。`,'event');save();toast(`惊喜奖励 +${ev.coins} 金币`);render();return}if(b.dataset.action==='story-progress'){const ch=storyScene();if(!ch.need()){toast('先把对应的设施准备好哦');return}if(busy){toast('搭档正在写故事，请稍等');return}await storyClaim();return}if(b.dataset.action==='weekly-claim'){ensureWeekly();if((farm.weekly.harvested||0)<250||farm.weekly.claimed){toast('本周目标还没完成哦');return}farm.weekly.claimed=true;farm.coins+=150;farm.xp+=20;addLog('完成本周经营目标，获得 150 金币。');save();toast('周奖励 +150 金币');render();return}if(b.dataset.view){if(b.dataset.view!=='house')furnitureShopOpen=false;view=b.dataset.view;if(view==='shop'){ensureDailyProgress();farm.dailyProgress.shopVisits++;save()}render();return}if(b.dataset.facility){const kind=b.dataset.facility;if(!farm.buildings[kind]){toast('先建造这处设施哦');return}facilityVisit(kind);view=kind;render();return}if(b.dataset.coopAction==='collect'){const eggs=farm.inventory.egg||0;if(!eggs){toast('还没有鸡蛋，过一会儿再来看看');return}farm.inventory.egg=0;farm.coop=farm.coop||{};farm.coop.collected=(farm.coop.collected||0)+eggs;ensureDailyProgress();farm.dailyProgress.eggsCollected+=eggs;farm.coins+=eggs*8;farm.xp+=eggs*2;addLog(`从小鸡窝收集了 ${eggs} 枚鸡蛋，获得 ${eggs*8} 金币。`);save();toast(`收集完成！+${eggs*8} 金币`);render();return}if(b.dataset.pondAction==='walk'){farm.pond=farm.pond||{fishVisits:0,feedings:0};farm.pond.fishVisits=(farm.pond.fishVisits||0)+1;farm.coins+=12;farm.xp+=2;addLog('你沿着池塘散步，收获了 12 金币。');save();toast('池塘散步完成 · +12 金币');render();return}if(b.dataset.pondAction==='feed'){if(farm.coins<8){toast('金币不够啦');return}farm.coins-=8;farm.pond=farm.pond||{fishVisits:0,feedings:0};farm.pond.feedings=(farm.pond.feedings||0)+1;addLog('你买了鱼食，喂池塘里的小鱼。');save();toast('小鱼开心地游过来啦');render();return}if(b.dataset.achievementClaim){const item=achievementDefs().find(x=>x[0]===b.dataset.achievementClaim);if(!item||!item[3]){toast('这个成就还没有达成哦');return}farm.achievementClaims=farm.achievementClaims||[];if(farm.achievementClaims.includes(item[0])){toast('奖励已经领取啦');return}farm.achievementClaims.push(item[0]);farm.coins+=item[4];farm.xp+=8;addLog(`解锁成就「${item[1]}」，获得 ${item[4]} 金币。`);save();toast(`成就奖励 +${item[4]} 金币`);render();return}if(b.dataset.taskClaim){ensureDailyProgress();const task=dailyTaskDefs.find(t=>t.id===b.dataset.taskClaim);if(!task||!task.done(farm.dailyProgress)){toast('先完成这项小任务哦');return}farm.quest.claimed=farm.quest.claimed||[];if(farm.quest.claimed.includes(task.id)){toast('这项奖励已经领取啦');return}farm.quest.claimed.push(task.id);farm.coins+=task.reward;farm.xp+=3;addLog(`完成任务「${task.label}」，获得 ${task.reward} 金币。`);save();toast(`任务奖励 +${task.reward} 金币`);render();return}if(b.dataset.action==='daily-bonus'){ensureDailyProgress();if(!dailyTaskDefs.every(t=>(farm.quest.claimed||[]).includes(t.id))){toast('先领取全部今日任务奖励哦');return}if((farm.quest.claimed||[]).includes('daily-bonus')){toast('全勤奖励已经领取啦');return}farm.quest.claimed.push('daily-bonus');farm.coins+=60;farm.xp+=10;addLog('完成全部今日委托，额外获得 60 金币和 10 经验。');save();toast('全勤奖励 +60 金币！');render();return}if(b.hasAttribute('data-enter-house')){if(!farm.buildings.cottage){toast('先建造温馨小屋哦');return}farm.house=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};farm.house.visited=(farm.house.visited||0)+1;farm.house.roomsVisited=Array.isArray(farm.house.roomsVisited)?farm.house.roomsVisited:[];if(!farm.house.roomsVisited.includes('living'))farm.house.roomsVisited.push('living');ensureDailyProgress();farm.dailyProgress.roomsVisited=(farm.dailyProgress.roomsVisited||0)+1;facilityVisit('cottage');view='house';save();render();return}if(b.dataset.houseAction){ensureDailyProgress();farm.dailyProgress.roomsVisited=(farm.dailyProgress.roomsVisited||0)+1;farm.house=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};const a=b.dataset.houseAction;if(a==='lamp'){farm.house.lampOn=!farm.house.lampOn;addLog(farm.house.lampOn?'你们点亮了小屋的暖灯。':'你们关掉了小屋的暖灯。')}if(a==='window'){farm.house.windowOpen=!farm.house.windowOpen;addLog(farm.house.windowOpen?'你们打开窗户，让微风吹进小屋。':'你们轻轻关上了窗户。')}if(a==='rest'){farm.house.rests=(farm.house.rests||0)+1;addLog('你们在小屋的沙发上休息了一会儿。');toast('舒服地休息了一会儿 ☁️')}if(a==='tea'){farm.house.teas=(farm.house.teas||0)+1;ensureDailyProgress();farm.dailyProgress.teas=(farm.dailyProgress.teas||0)+1;addLog('你们泡了一杯热茶，在小屋里慢慢聊天。');toast('热茶泡好啦 🍵')}save();render();return}if(b.dataset.seed){selectedSeed=b.dataset.seed;render();return}if(b.dataset.plot!==undefined){const id=Number(b.dataset.plot),p=farm.plots.find(x=>x.id===id);if(p?.crop)harvest(id);else if(plant(id,selectedSeed)){toast('播种成功！');render()}return}if(b.dataset.buy){const id=b.dataset.buy,c=crops[id];if(farm.coins<c.cost){toast('金币不够啦');return}farm.coins-=c.cost;farm.inventory['seed_'+id]=(farm.inventory['seed_'+id]||0)+1;if(!farm.unlocked.includes(id))farm.unlocked.push(id);addLog(`购买了${c.name}种子 × 1。`);save();render();return}if(b.dataset.build){const id=b.dataset.build,cost=Number(b.dataset.cost||0);if(farm.buildings[id]){toast('这座设施已经建好啦');return}if(farm.coins<cost){toast('金币不够啦');return}farm.coins-=cost;farm.buildings[id]=true;addLog(`你们一起建造了${id==='coop'?'小鸡窝':id==='pond'?'小池塘':'温馨小屋'}。`);save();render();return}if(b.dataset.craft){const id=b.dataset.craft,need=id==='bouquet'?'flower':'strawberry',label=id==='bouquet'?'花束':'果酱';if((farm.inventory[need]||0)<2){toast(`材料不足，需要 2 份${crops[need].name}`);return}farm.inventory[need]-=2;farm.crafted[id]=(farm.crafted[id]||0)+1;addLog(`制作完成：${label} × 1。`);farm.xp+=4;save();render();return}if(b.dataset.sell){const id=b.dataset.sell,n=farm.inventory[id]||0;if(!n)return;const c=crops[id],price=c?.sell||(id==='egg'?5:0),name=c?.name||(id==='egg'?'鸡蛋':id);if(!price)return;farm.inventory[id]=n-1;farm.coins+=price;farm.stats.sold=(farm.stats.sold||0)+1;ensureDailyProgress();farm.dailyProgress.sold++;addLog(`出售了${name}，获得 ${price} 金币。`);save();render();return}if(b.dataset.action==='buy-chicken'){if(!farm.buildings.coop){toast('先建造小鸡窝，才能领养小鸡哦');return}if(farm.coins<45){toast('金币不够啦');return}farm.coins-=45;farm.animals.chickens=(farm.animals.chickens||0)+1;farm.animals.lastEggAt=farm.animals.lastEggAt||Date.now();addLog('一只毛茸茸的小鸡加入农场啦。');save();render();return}if(b.dataset.action==='daily-claim'){const today=new Date().toISOString().slice(0,10);if(farm.quest.date===today&&farm.quest.claimed.includes('daily')){toast('今天的奖励已经领取过啦');return}if(farm.stats.planted<1||farm.stats.harvests<1){toast('先完成播种和收获，再来领取奖励吧');return}farm.quest.date=today;farm.quest.claimed=['daily'];farm.coins+=20;farm.xp+=5;addLog('完成今日农场任务，获得 20 金币和 5 经验。');save();toast('今日奖励已领取！');render();return}if(b.dataset.action==='water-all'){let count=0;farm.plots.forEach(p=>{if(p.crop&&!mature(p)&&!p.watered){p.watered=true;p.readyAt=Math.max(Date.now(),p.readyAt-8000);count++}});if(count){ensureDailyProgress();farm.dailyProgress.watered+=count}addLog(count?`你给 ${count} 块土地浇了水，作物加速成长。`:'暂时没有需要浇水的作物。');save();toast(count?'浇水完成，作物加速啦':'没有需要浇水的作物');render();return}if(b.dataset.action==='expand'){const cost=80+Math.max(0,farm.plots.length-9)*35;if(farm.plots.length>=18||farm.coins<cost){toast('金币不足或土地已全部开放');return}farm.coins-=cost;farm.plots.push({id:farm.plots.length,crop:'',plantedAt:0,readyAt:0,watered:false});addLog('你们一起扩建了一块新土地。');save();render();return}if(b.dataset.action==='talk'){const t=$('#farmChat')?.value.trim();if(t)callAI(t,'chat');else toast('先写点想说的话吧');return}if(b.dataset.action==='daily'){callAI('请主动分享今天在农场做过的一件小事，并自然地邀请我一起完成一件小事。','daily');return}}
document.addEventListener('click',e=>{if(e.target.closest('[data-launch-games]')){e.preventDefault();open()}});
window.LoveRecordGames3D={
 getSceneState:()=>({owner:ownerKey(activeOwnerId),room:farm.house?.currentRoom||'living',decorMode:!!farm.house?.decorMode,lampOn:farm.house?.lampOn!==false,windowOpen:!!farm.house?.windowOpen,weather:farm.world?.weather||'晴',season:farm.season||'春',placed:(farm.house?.placed?.[farm.house?.currentRoom||'living']||[]).map(x=>({...x})),catalog:furnitureCatalog.map(x=>({id:x.id,name:x.name,type:x.type,room:x.room,category:x.category})),inventory:{...(farm.house?.furnitureInventory||{})}}),
 updatePlacement:(uid,x,y,rotation)=>{const room=farm.house?.currentRoom||'living';const item=(farm.house?.placed?.[room]||[]).find(x=>String(x.uid)===String(uid));if(!item)return false;item.x=Math.max(4,Math.min(88,Number(x)||50));item.y=Math.max(12,Math.min(84,Number(y)||50));if(Number.isFinite(Number(rotation)))item.rotation=((Number(rotation)%360)+360)%360;save();return true},updateFurnitureColor:(uid,role,color)=>{const room=farm.house?.currentRoom||'living';const item=(farm.house?.placed?.[room]||[]).find(x=>String(x.uid)===String(uid));if(!item)return false;const allowed=['upholstery','wood','fabric','pottery'];if(!allowed.includes(role)||!/^#[0-9a-fA-F]{6}$/.test(String(color)))return false;item.colors={...(item.colors||{}),[role]:String(color)};save();return true},
 removePlacement:(uid)=>{const room=farm.house?.currentRoom||'living';const arr=farm.house?.placed?.[room]||[];const i=arr.findIndex(x=>String(x.uid)===String(uid));if(i<0)return false;const [item]=arr.splice(i,1);farm.house.furnitureInventory[item.id]=(farm.house.furnitureInventory[item.id]||0)+1;save();render();return true},
 refresh:()=>render()
};
window.LoveRecordGames={open,close,save:()=>save(),getCurrentOwner:()=>activeOwnerId,getSaveStatus:()=>({database:DB_NAME,owner:ownerKey(activeOwnerId),lastError:saveError,readOnly:storageReadOnly,blocked:storageBlocked}),exportSave:()=>JSON.stringify({owner:ownerKey(activeOwnerId),farm},null,2),scanSaves:scanFarmArchives,getRescueCandidates:()=>rescueCandidates.map((x,i)=>({index:i,source:x.source,owner:x.owner,summary:x.summary,score:x.score})),restoreRescueSave:restoreFarmArchive};document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});window.addEventListener('pagehide',()=>save());
setInterval(()=>{if($('#lr-games')?.classList.contains('open')&&!storageBlocked)save()},15000);setInterval(()=>{if($('#lr-games')?.classList.contains('open')&&view==='farm')render()},5000);
})();