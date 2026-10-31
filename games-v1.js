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
const defaults=(ownerId='')=>({version:4,ownerId:String(ownerId||''),createdAt:Date.now(),lastCalendarAt:Date.now(),coins:120,level:1,xp:0,season:'春',day:1,plots:Array.from({length:9},(_,i)=>({id:i,crop:'',plantedAt:0,readyAt:0,watered:false})),inventory:{seed_carrot:12,seed_tomato:5,seed_lettuce:5},unlocked:['carrot','tomato','lettuce'],log:[],lastVisit:Date.now(),partnerId:String(ownerId||''),partnerName:'',partnerAvatar:'',partnerLastAction:0,decor:[],daily:{date:'',done:[]},stats:{harvests:0,planted:0},animals:{chickens:0,lastEggAt:Date.now()},buildings:{pond:false,cottage:false,coop:false},house:{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0},crafted:{bouquet:0,jam:0},achievements:[],quest:{date:'',claimed:[]}});
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
 d.inventory={...defaults(id).inventory,...(d.inventory||{})};d.stats={...defaults(id).stats,...(d.stats||{})};
 d.animals={...defaults(id).animals,...(d.animals||{})};d.buildings={...defaults(id).buildings,...(d.buildings||{})};
 d.crafted={...defaults(id).crafted,...(d.crafted||{})};d.house={...defaults(id).house,...(d.house||{})};d.achievements=Array.isArray(d.achievements)?d.achievements:[];
 d.quest={...defaults(id).quest,...(d.quest||{})};d.unlocked=Array.isArray(d.unlocked)?d.unlocked:defaults(id).unlocked;d.log=Array.isArray(d.log)?d.log:[];return d;
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
async function hydrateOwner(id){
 const key=ownerKey(id);
 try{const saved=await idbGet(key);if(saved){const normalized=normalizeFarm(saved,key);try{localStorage.setItem(profileKey(key),JSON.stringify(normalized))}catch(_){}return normalized}}catch(e){console.warn('[Farm] IndexedDB read:',e)}
 // Migrate the previous V1 IndexedDB database before creating a fresh profile.
 const oldDbData=await legacyIdbGet(key==='solo'?'':key);
 if(oldDbData){const migrated=normalizeFarm(oldDbData,key);try{await idbPut(key,migrated)}catch(_){}try{localStorage.setItem(profileKey(key),JSON.stringify(migrated))}catch(_){}return migrated}
 const local=readStore(profileKey(key));if(local)return normalizeFarm(local,key);
 // One-time migration from the previous single-farm localStorage key, only to its original owner.
 const legacy=readStore(KEY);if(legacy){const legacyOwner=ownerKey(legacy.ownerId||legacy.partnerId);if(legacyOwner===key){const migrated=normalizeFarm(legacy,key);try{await idbPut(key,migrated)}catch(_){}try{localStorage.setItem(profileKey(key),JSON.stringify(migrated))}catch(_){}return migrated}}
 const person=personFor(key);const fresh=normalizeFarm({partnerName:person?.remark||person?.name||'',partnerAvatar:person?.avatar||''},key);
 try{await idbPut(key,fresh)}catch(e){console.warn('[Farm] initial save:',e)}
 return fresh;
}
async function save(){
 const owner=ownerKey(activeOwnerId);farm=normalizeFarm(farm,owner);farm.lastVisit=Date.now();const snap=JSON.parse(JSON.stringify(farm));
 saveChain=saveChain.catch(()=>false).then(async()=>{
  let idbOk=false,localOk=false;const errors=[];
  try{await idbPut(owner,snap);idbOk=true}catch(e){errors.push('数据库 '+(e?.name||e?.message||'失败'));console.error('[Farm] IndexedDB save failed',e)}
  try{localStorage.setItem(profileKey(owner),JSON.stringify(snap));localOk=true}catch(e){errors.push('本地备份 '+(e?.name||e?.message||'失败'));console.error('[Farm] localStorage backup failed',e)}
  try{localStorage.setItem(ACTIVE_KEY,owner)}catch(e){errors.push('活动联系人标记 '+(e?.name||'失败'))}
  if(idbOk||localOk){saveError='';return true}
  saveError=errors.join('；')||'未知存储错误';console.error('[Farm] all save methods failed:',saveError);toast('存档失败：'+saveError+'。请勿清除网站数据。');return false;
 });return saveChain;
}
let activeOwnerId=getInitialOwner();
let farm=loadOwner(activeOwnerId),view='farm',selectedSeed='carrot',busy=false,apiMessage='',switchingOwner=false;
function cfg(){let s={};try{s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}')||{}}catch{};return {base:String((typeof state!=='undefined'&&state.apiBase)||s.apiBase||document.querySelector('#apiBase')?.value||'').trim().replace(/\/+$/,''),key:String((typeof state!=='undefined'&&state.apiKey)||s.apiKey||document.querySelector('#apiKey')?.value||'').trim(),model:String((typeof state!=='undefined'&&state.apiModel)||s.apiModel||document.querySelector('#apiModel')?.value||'').trim()}}
function addLog(text,kind='note'){farm.log.unshift({id:Date.now()+Math.random(),text,kind,at:Date.now()});farm.log=farm.log.slice(0,40)}
function toast(s){const n=$('#farmToast');if(n){n.textContent=s;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),1800)}}
function mature(p){return !!p.crop&&Date.now()>=p.readyAt}
function remaining(p){return Math.max(0,Math.ceil((p.readyAt-Date.now())/1000))}
function fmt(sec){const m=Math.floor(sec/60),s=sec%60;return m?`${m}分${s?`${s}秒`:''}`:`${s}秒`}
function settleOffline(){const now=Date.now(),elapsed=Math.max(0,Math.min(now-(farm.lastVisit||now),12*60*60*1000));if(farm.partnerId&&now-(farm.partnerLastAction||0)>30*60*1000){let watered=0;farm.plots.forEach(p=>{if(p.crop&&!mature(p)&&!p.watered&&watered<2){p.watered=true;p.readyAt=Math.max(now,p.readyAt-8000);watered++}});if(watered){farm.partnerLastAction=now;addLog(`${farm.partnerName||'搭档'}趁你不在，帮忙照看了 ${watered} 块菜地。`,'partner')}}const calendarNow=Date.now(),calendarBase=farm.lastCalendarAt||calendarNow,passedDays=Math.floor(Math.max(0,calendarNow-calendarBase)/86400000);if(passedDays>0){const seasons=['春','夏','秋','冬'];for(let d=0;d<Math.min(passedDays,365);d++){farm.day++;if((farm.day-1)%7===0){const idx=seasons.indexOf(farm.season);farm.season=seasons[(idx+1+4)%4]}}farm.lastCalendarAt=calendarBase+passedDays*86400000;addLog(`新的一天到来啦：${farm.season}季，第${farm.day}天。`,'note')}if((farm.animals?.chickens||0)>0){const last=farm.animals.lastEggAt||now;const eggs=Math.min(8,Math.floor((now-last)/3600000)*farm.animals.chickens);if(eggs>0){farm.inventory.egg=(farm.inventory.egg||0)+eggs;farm.animals.lastEggAt=now;addLog(`小鸡们留下了鸡蛋 × ${eggs}。`,'note')}}farm.lastVisit=now;save()}
async function open(){mount();$('#lr-games').classList.add('open');document.body.style.overflow='hidden';view='farm';switchingOwner=true;render();try{farm=await hydrateOwner(activeOwnerId);settleOffline();render()}catch(e){console.error('[Farm] load failed',e);toast('农场读取失败：'+(e?.message||'未知错误'))}finally{switchingOwner=false;render()}}
function close(){const r=$('#lr-games');if(r)r.classList.remove('open');document.body.style.overflow=''}
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
@media(prefers-reduced-motion:reduce){#lr-games .iso-room *{animation:none!important;transition:none!important}}

`;
function mount(){if($('#lr-games'))return;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);const root=document.createElement('div');root.id='lr-games';root.innerHTML=`<div class="gbar"><button id="gclose">‹ 返回 LOVE RECORD</button><b id="gbarTitle">OUR LITTLE FARM · 我们的小农场</b></div><main class="gscroll" id="gbody"></main><nav class="gtabs" id="farmDock" aria-label="农场导航"></nav><div class="gtoast" id="farmToast"></div>`;document.body.appendChild(root);root.addEventListener('click',onClick);root.addEventListener('change',onChange);$('#gclose').onclick=close;render()}
function partnerCard(){const p=people().find(x=>String(x.id)===String(farm.partnerId));return `<section class="gcard"><b>共同农场主人</b><div class="grow" style="margin-top:10px"><div class="gavatar">${farm.partnerAvatar?`<img src="${esc(farm.partnerAvatar)}">`:esc((farm.partnerName||'♡').slice(0,1))}</div><div style="flex:1"><b>${esc(farm.partnerName||'还没有选择搭档')}</b><div class="gmuted">${p?'与你共同经营这座农场':'选择一位联系人，成为共同主人'}</div></div></div><select id="farmPartner" style="margin-top:12px"><option value="">选择联系人…</option>${people().map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(farm.partnerId)?'selected':''}>${esc(x.remark||x.name||'联系人')}</option>`).join('')}</select></section>`}
function header(){return `<div class="ghead"><div class="gmuted" style="letter-spacing:2px">OUR LITTLE FARM · ${farm.season}季 第${farm.day}天</div><h1 class="gtitle">一起慢慢，把日子种出来。</h1><div class="gsub">这是 ${esc(farm.partnerName||'你的')} 的专属农场。</div><div class="gstats"><div class="gstat"><b>🪙 ${farm.coins}</b>金币</div><div class="gstat"><b>⭐ ${farm.level}</b>农场等级</div><div class="gstat"><b>🌾 ${farm.stats.harvests}</b>累计收获</div></div></div>`}
function tabs(){const active=view==='house'?'farm':view;return `${[['farm','🌿','农场'],['shop','🛒','商店'],['bag','🧺','仓库'],['life','♡','日常']].map(([v,i,n])=>`<button data-view="${v}" class="${active===v?'active':''}">${i}<br>${n}</button>`).join('')}`}
function farmyardView(){
 const spots=[
  {id:'cottage',emoji:'🏡',name:'温馨小屋',built:!!farm.buildings.cottage,desc:'窗边亮着暖暖的灯',art:`<div class="yard-art cottage-art"><span class="cottage-smoke">☁️</span><span class="cottage-house">🏡</span><span class="yard-spark">✦</span></div>`},
  {id:'coop',emoji:'🐔',name:'小鸡窝',built:!!farm.buildings.coop,desc:`小鸡 ${farm.animals.chickens||0} 只 · 鸡蛋 ${farm.inventory.egg||0} 枚`,art:`<div class="yard-art coop-art"><span class="coop-house">🐔</span><span class="coop-chick">🐥</span><span class="yard-spark">✦</span></div>`},
  {id:'pond',emoji:'🪷',name:'小池塘',built:!!farm.buildings.pond,desc:'荷叶轻轻漂在水面上',art:`<div class="yard-art pond-art"><span class="pond-water">💧</span><span class="pond-lily">🪷</span><span class="pond-fish">🐟</span></div>`}
 ];
 return `<section class="gcard farmyard-card"><div class="grow" style="justify-content:space-between"><b>🌼 农场的小天地</b><span class="gmuted">已建造 ${spots.filter(x=>x.built).length}/3</span></div><p class="gmuted">建好的设施会出现在这里，也会随着农场生活慢慢热闹起来。</p><div class="farmyard-grid">${spots.map(x=>`<article class="yard-item ${x.built?'is-built':'is-locked'}"><div class="yard-scene">${x.built?x.art:`<div class="yard-empty">${x.emoji}<small>等待建造</small></div>`}</div><b>${x.name}</b><small>${x.built?x.desc:'去商店把它带回农场吧'}</small>${x.built?(x.id==='cottage'?'<button class="yard-enter" data-enter-house>推门进去 ↗</button>':'<span class="yard-status">已入住 · 正在生活</span>'):`<button data-view="shop">去建造</button>`}</article>`).join('')}</div></section>`;
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
function houseView(){
 const h=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};
 if(!farm.buildings.cottage)return `${header()}<section class="gcard"><b>小屋还没有建好</b><p class="gmuted">先去商店建造温馨小屋，再回来看看吧。</p><button class="primary" data-view="shop">去建造</button></section>`;
 return `<section class="house-page">
  <div class="house-intro"><button class="house-back" data-view="farm">← 回到农场</button><div class="house-kicker">LOVE RECORD · FRENCH COUNTRY HOME</div><h1>温馨小屋</h1><p>${esc(farm.partnerName||'你们')}的小小休息站 · 已来访 ${h.visited||0} 次</p></div>
  ${houseScene(h)}
  <section class="house-controls"><div class="house-section-title"><b>屋里的小日常</b><span>慢下来，休息一会儿</span></div>
   <div class="house-action-grid">
    <button data-house-action="lamp">${houseIcon('lamp')}<b>${h.lampOn?'关掉暖灯':'点亮暖灯'}</b><small>${h.lampOn?'让傍晚的灯光柔和一点':'给房间一点温柔'}</small></button>
    <button data-house-action="window">${houseIcon('window')}<b>${h.windowOpen?'关上窗户':'打开窗户'}</b><small>${h.windowOpen?'微风已经吹进来了':'听听花园外面的风声'}</small></button>
    <button data-house-action="rest">${houseIcon('sofa')}<b>坐下休息</b><small>已休息 ${h.rests||0} 次</small></button>
    <button data-house-action="tea">${houseIcon('tea')}<b>泡一杯热茶</b><small>一起享受安静时光 · ${h.teas||0} 杯</small></button>
   </div>
   <div class="house-note">${h.windowOpen?'窗帘轻轻摆动，花园的风穿过半开的窗户。':h.lampOn?'暖黄色的灯光落在木地板上，整个小屋都变得柔软。':'傍晚的自然光透过窗棂，小屋安静又明亮。'}</div>
  </section>
  <section class="house-memory"><b>小屋记忆</b><p>${(farm.log||[]).filter(x=>/小屋|休息|热茶|窗户|暖灯/.test(x.text)).slice(0,4).map(x=>esc(x.text)).join(' · ')||'这里还没有留下特别的回忆。今天可以从一杯热茶开始。'}</p></section>
 </section>`;
}
function farmView(){
 const plots=farm.plots.map(p=>{const c=crops[p.crop];if(!c)return `<button class="plot empty" data-plot="${p.id}"><span class="cropemoji">＋</span><small>空地 · 播种</small></button>`;const ready=mature(p);return `<button class="plot ${ready?'ready':''}" data-plot="${p.id}"><span class="cropemoji">${ready?c.emoji:['🌱','🌿','🌾'][Math.min(2,Math.floor((1-remaining(p)/Math.max(1,(p.readyAt-p.plantedAt)/1000))*3))]||'🌱'}</span><b>${c.name}</b><small>${ready?'点击收获':fmt(remaining(p))}</small></button>`}).join('');
 const need=farm.level*35;
 return `${header()}${partnerCard()}<section class="gcard"><div class="grow" style="justify-content:space-between"><b>🌤️ 今日农场</b><span class="gmuted">${farm.season}季 · 第${farm.day}天</span></div><div class="gnotice">已建造 ${Object.values(farm.buildings).filter(Boolean).length} 座设施 · 小鸡 ${farm.animals.chickens||0} 只 · 鸡蛋 ${farm.inventory.egg||0} 枚</div><div class="gxp"><span>农场经验 ${farm.xp}/${need}</span><i><b style="width:${Math.min(100,farm.xp/need*100)}%"></b></i></div></section>
 <section class="gcard"><div class="grow" style="justify-content:space-between"><b>我们的菜园</b><span class="gmuted">${farm.plots.length} 块土地</span></div><div class="gmap" style="margin-top:12px">${plots}</div><p class="gmuted">选择种子，再点击一块空地；每次只种一块。作物会快速成长。</p></section>
 ${farmyardView()}\n <section class="gcard"><div class="grow" style="justify-content:space-between"><b>选择种子</b><span class="gmuted">当前：${crops[selectedSeed]?.emoji||'🌱'} ${crops[selectedSeed]?.name||'胡萝卜'}</span></div><div class="ggrid" style="margin-top:10px">${farm.unlocked.map(id=>{const c=crops[id];return `<button class="gseed ${selectedSeed===id?'active':''}" data-seed="${id}"><span class="emoji">${c.emoji}</span><span><b>${c.name}</b><small>${c.cost} 金币 · ${Math.round(c.time/60)} 分钟成熟 · 库存 ${farm.inventory['seed_'+id]||0}</small></span></button>`}).join('')}</div><div class="grow" style="margin-top:12px"><button data-action="water-all">💧 浇水加速</button><button data-action="daily-claim" class="primary">领取今日任务</button></div></section>
 <section class="gcard"><b>农场近况</b><div class="glog" style="margin-top:10px">${farm.log.slice(0,4).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p class="gmuted">你们的农场刚刚开始，来种下第一颗种子吧。</p>'}</div></section>`;
}

function shopView(){
 const buildings=[['coop','🐔','小鸡窝',90,'让小鸡入住，定期收获鸡蛋'],['pond','🪷','小池塘',120,'解锁池塘边的宁静时光'],['cottage','🏡','温馨小屋',180,'为农场增加一处休息空间']];
 return `${header()}<h2 class="gtitle">小镇种子铺</h2><p class="gsub">种子、动物与农场设施，都可以慢慢添置。</p>
 <section class="gcard"><b>种子货架</b>${Object.entries(crops).map(([id,c])=>`<div class="grow" style="padding:12px 0;border-bottom:1px solid #eee2d5"><span style="font-size:27px">${c.emoji}</span><div style="flex:1"><b>${c.name}</b><div class="gmuted">${c.desc} · 售价 ${c.sell} 金币</div></div><button data-buy="${id}">购买 · ${c.cost}</button></div>`).join('')}</section>
 <section class="gcard"><b>🐾 农场伙伴</b><div class="grow" style="padding:12px 0"><span style="font-size:28px">🐥</span><div style="flex:1"><b>小鸡</b><div class="gmuted">每只 45 金币 · 每隔一段时间产出鸡蛋</div><small>现有 ${farm.animals.chickens||0} 只</small></div><button data-action="buy-chicken">领养 · 45</button></div></section>
 <section class="gcard"><b>🏡 农场建设</b>${buildings.map(([id,emoji,name,cost,desc])=>`<div class="grow" style="padding:12px 0;border-bottom:1px solid #eee2d5"><span style="font-size:27px">${emoji}</span><div style="flex:1"><b>${name}</b><div class="gmuted">${desc}</div></div>${farm.buildings[id]?'<span>已建造 ✓</span>':`<button data-build="${id}" data-cost="${cost}">建造 · ${cost}</button>`}</div>`).join('')}<p class="gmuted">农场扩建</p><button class="primary" data-action="expand" ${farm.plots.length>=18?'disabled':''}>增加一块土地 · ${80+Math.max(0,farm.plots.length-9)*35} 金币</button></section>`;
}

function bagView(){
 const rows=Object.entries(farm.inventory).filter(([,n])=>n>0);
 const achievements=[['first-plant','🌱','初次播种',farm.stats.planted>=1],['first-harvest','🌾','第一次收获',farm.stats.harvests>=1],['green-thumb','🌿','种植十次',farm.stats.planted>=10],['little-farm','🏡','建设小屋',farm.buildings.cottage]];
 return `${header()}<h2 class="gtitle">共同仓库</h2><p class="gsub">收获、制作与收藏，都在这里慢慢积累。</p>
 <section class="gcard"><b>仓库库存</b>${rows.length?rows.map(([id,n])=>{const cropId=id.startsWith('seed_')?id.slice(5):id;const c=crops[cropId];const itemName=id.startsWith('seed_')?`${c?.name||cropId}种子`:c?.name;return `<div class="grow" style="padding:10px 0;border-bottom:1px solid #eee2d5"><span style="font-size:25px">${c?.emoji|| (id==='egg'?'🥚':'📦')}</span><b style="flex:1">${itemName|| (id==='egg'?'鸡蛋':id)}</b><span>× ${n}</span>${(c||id==='egg')?`<button data-sell="${id}">出售</button>`:''}</div>`}).join(''):'<p class="gmuted">仓库还是空的，收获作物后就会出现在这里。</p>'}</section>
 <section class="gcard"><b>🧺 手作工坊</b><p class="gmuted">把收获变成小小的礼物。</p><div class="grow"><span>💐 花束（需要 2 雏菊）</span><button data-craft="bouquet">制作 · 已有 ${farm.crafted.bouquet||0}</button></div><div class="grow" style="margin-top:10px"><span>🍓 果酱（需要 2 草莓）</span><button data-craft="jam">制作 · 已有 ${farm.crafted.jam||0}</button></div></section>
 <section class="gcard"><b>🏅 农场成就</b>${achievements.map(([id,emoji,name,ok])=>`<div class="grow" style="padding:9px 0"><span>${emoji}</span><span style="flex:1">${name}</span><span>${farm.achievements.includes(id)||ok?'已达成 ✓':'未解锁'}</span></div>`).join('')}</section>
 <section class="gcard"><b>经营记录</b><div class="gstats"><div class="gstat"><b>${farm.stats.planted}</b>播种次数</div><div class="gstat"><b>${farm.stats.harvests}</b>收获次数</div><div class="gstat"><b>${farm.xp}</b>经验值</div></div></section>`;
}

function lifeView(){
 const tasks=[['plant','种下一颗种子',farm.stats.planted>0],['harvest','收获一份作物',farm.stats.harvests>0],['visit','看看农场商店',true]];
 return `${header()}<h2 class="gtitle">农场日常</h2><p class="gsub">一起经营，也一起留下生活的小片段。</p>
 <section class="gcard"><b>📋 今日小任务</b>${tasks.map(([id,label,done])=>`<div class="grow" style="padding:9px 0"><span>${done?'☑️':'▫️'}</span><span style="flex:1">${label}</span><span class="gmuted">${done?'已完成':'待完成'}</span></div>`).join('')}<button class="primary" data-action="daily-claim" style="margin-top:8px">领取今日奖励 · 20 金币</button></section>
 <section class="gcard"><b>和搭档聊聊</b><p class="gmuted">聊聊今天的农场、商量种什么，或邀请对方做一件事。</p><textarea id="farmChat" placeholder="和${esc(farm.partnerName||'搭档')}说点什么…"></textarea><button class="primary" data-action="talk" style="margin-top:10px" ${!farm.partnerId?'disabled':''}>发送给搭档</button><div class="gnotice" style="margin-top:10px">${esc(apiMessage||'互动时才调用主页 API，不会在每次种植时请求。')}</div></section>
 <section class="gcard"><div class="grow" style="justify-content:space-between"><b>共同日记</b><button data-action="daily">让搭档分享今天的农场日记</button></div><div class="glog" style="margin-top:12px">${farm.log.slice(0,15).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p>今天是你们农场的第一天。</p>'}</div></section>`;
}

function render(){const b=$('#gbody');if(!b)return;try{b.innerHTML=view==='farm'?farmView():view==='house'?houseView():view==='shop'?shopView():view==='bag'?bagView():lifeView();const dock=$('#farmDock');if(dock)dock.innerHTML=tabs();const title=$('#gbarTitle');if(title)title.textContent=view==='house'?'温馨小屋 · 屋内':'OUR LITTLE FARM · 我们的小农场'}catch(e){console.error('[Farm] render failed',e);b.innerHTML='<section class="gcard"><b>农场暂时无法显示</b><p class="gmuted">页面渲染遇到错误。你的存档没有因此被主动清除，请返回后重试。</p><button class="primary" onclick="window.LoveRecordGames&&window.LoveRecordGames.open()">重新打开农场</button></section>'}}
function plant(id,seed){const p=farm.plots.find(x=>x.id===id);if(!p||p.crop)return false;const c=crops[seed];if(!c){return false}const seedKey='seed_'+seed;if((farm.inventory[seedKey]||0)<=0){toast('种子不够啦，可以去商店购买');return false}farm.inventory[seedKey]--;p.crop=seed;p.plantedAt=Date.now();p.readyAt=Date.now()+c.time*1000;p.watered=false;farm.stats.planted++;farm.xp+=2;addLog(`你们种下了${c.name}。`);save();return true}
function harvest(id){const p=farm.plots.find(x=>x.id===id);if(!p||!p.crop)return;if(!mature(p)){toast('还在努力生长中，再等等哦');return}const c=crops[p.crop];farm.inventory[p.crop]=(farm.inventory[p.crop]||0)+1;farm.stats.harvests++;farm.xp+=5;addLog(`收获了 ${c.name} × 1，放进共同仓库啦。`);p.crop='';p.plantedAt=0;p.readyAt=0;p.watered=false;if(farm.xp>=farm.level*35){farm.xp-=farm.level*35;farm.level++;addLog(`农场升到 ${farm.level} 级啦！`)}save();render()}
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
function onClick(e){if(switchingOwner)return;const b=e.target.closest('button');if(!b)return;if(b.dataset.view){view=b.dataset.view;render();return}if(b.hasAttribute('data-enter-house')){if(!farm.buildings.cottage){toast('先建造温馨小屋哦');return}farm.house=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};farm.house.visited=(farm.house.visited||0)+1;view='house';save();render();return}if(b.dataset.houseAction){farm.house=farm.house||{lampOn:true,windowOpen:false,rests:0,teas:0,visited:0};const a=b.dataset.houseAction;if(a==='lamp'){farm.house.lampOn=!farm.house.lampOn;addLog(farm.house.lampOn?'你们点亮了小屋的暖灯。':'你们关掉了小屋的暖灯。')}if(a==='window'){farm.house.windowOpen=!farm.house.windowOpen;addLog(farm.house.windowOpen?'你们打开窗户，让微风吹进小屋。':'你们轻轻关上了窗户。')}if(a==='rest'){farm.house.rests=(farm.house.rests||0)+1;addLog('你们在小屋的沙发上休息了一会儿。');toast('舒服地休息了一会儿 ☁️')}if(a==='tea'){farm.house.teas=(farm.house.teas||0)+1;addLog('你们泡了一杯热茶，在小屋里慢慢聊天。');toast('热茶泡好啦 🍵')}save();render();return}if(b.dataset.seed){selectedSeed=b.dataset.seed;render();return}if(b.dataset.plot!==undefined){const id=Number(b.dataset.plot),p=farm.plots.find(x=>x.id===id);if(p?.crop)harvest(id);else if(plant(id,selectedSeed)){toast('播种成功！');render()}return}if(b.dataset.buy){const id=b.dataset.buy,c=crops[id];if(farm.coins<c.cost){toast('金币不够啦');return}farm.coins-=c.cost;farm.inventory['seed_'+id]=(farm.inventory['seed_'+id]||0)+1;if(!farm.unlocked.includes(id))farm.unlocked.push(id);addLog(`购买了${c.name}种子 × 1。`);save();render();return}if(b.dataset.build){const id=b.dataset.build,cost=Number(b.dataset.cost||0);if(farm.buildings[id]){toast('这座设施已经建好啦');return}if(farm.coins<cost){toast('金币不够啦');return}farm.coins-=cost;farm.buildings[id]=true;addLog(`你们一起建造了${id==='coop'?'小鸡窝':id==='pond'?'小池塘':'温馨小屋'}。`);save();render();return}if(b.dataset.craft){const id=b.dataset.craft,need=id==='bouquet'?'flower':'strawberry',label=id==='bouquet'?'花束':'果酱';if((farm.inventory[need]||0)<2){toast(`材料不足，需要 2 份${crops[need].name}`);return}farm.inventory[need]-=2;farm.crafted[id]=(farm.crafted[id]||0)+1;addLog(`制作完成：${label} × 1。`);farm.xp+=4;save();render();return}if(b.dataset.sell){const id=b.dataset.sell,n=farm.inventory[id]||0;if(!n)return;const c=crops[id],price=c?.sell||(id==='egg'?5:0),name=c?.name||(id==='egg'?'鸡蛋':id);if(!price)return;farm.inventory[id]=n-1;farm.coins+=price;addLog(`出售了${name}，获得 ${price} 金币。`);save();render();return}if(b.dataset.action==='buy-chicken'){if(!farm.buildings.coop){toast('先建造小鸡窝，才能领养小鸡哦');return}if(farm.coins<45){toast('金币不够啦');return}farm.coins-=45;farm.animals.chickens=(farm.animals.chickens||0)+1;farm.animals.lastEggAt=farm.animals.lastEggAt||Date.now();addLog('一只毛茸茸的小鸡加入农场啦。');save();render();return}if(b.dataset.action==='daily-claim'){const today=new Date().toISOString().slice(0,10);if(farm.quest.date===today&&farm.quest.claimed.includes('daily')){toast('今天的奖励已经领取过啦');return}if(farm.stats.planted<1||farm.stats.harvests<1){toast('先完成播种和收获，再来领取奖励吧');return}farm.quest.date=today;farm.quest.claimed=['daily'];farm.coins+=20;farm.xp+=5;addLog('完成今日农场任务，获得 20 金币和 5 经验。');save();toast('今日奖励已领取！');render();return}if(b.dataset.action==='water-all'){let count=0;farm.plots.forEach(p=>{if(p.crop&&!mature(p)&&!p.watered){p.watered=true;p.readyAt=Math.max(Date.now(),p.readyAt-8000);count++}});addLog(count?`你给 ${count} 块土地浇了水，作物加速成长。`:'暂时没有需要浇水的作物。');save();toast(count?'浇水完成，作物加速啦':'没有需要浇水的作物');render();return}if(b.dataset.action==='expand'){const cost=80+Math.max(0,farm.plots.length-9)*35;if(farm.plots.length>=18||farm.coins<cost){toast('金币不足或土地已全部开放');return}farm.coins-=cost;farm.plots.push({id:farm.plots.length,crop:'',plantedAt:0,readyAt:0,watered:false});addLog('你们一起扩建了一块新土地。');save();render();return}if(b.dataset.action==='talk'){const t=$('#farmChat')?.value.trim();if(t)callAI(t,'chat');else toast('先写点想说的话吧');return}if(b.dataset.action==='daily'){callAI('请主动分享今天在农场做过的一件小事，并自然地邀请我一起完成一件小事。','daily');return}}
document.addEventListener('click',e=>{if(e.target.closest('[data-launch-games]')){e.preventDefault();open()}});
window.LoveRecordGames={open,close,save:()=>save(),getCurrentOwner:()=>activeOwnerId,getSaveStatus:()=>({database:DB_NAME,owner:ownerKey(activeOwnerId),lastError:saveError}),exportSave:()=>JSON.stringify({owner:ownerKey(activeOwnerId),farm},null,2)};document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});window.addEventListener('pagehide',()=>save());
setInterval(()=>{if($('#lr-games')?.classList.contains('open')&&view==='farm')render()},5000);
})();