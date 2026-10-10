/* LOVE RECORD · SPACE V2
   A standalone world/map/story experience. It intentionally does not hard-code any
   specific character or user name; it uses the contacts already stored in LOVE RECORD.
*/
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const KEY='love-record-space-v2';
  let data={selectedPeople:[],locations:[],currentLocation:null,history:[],activityLog:[],memories:[],invites:[],characterSchedule:{},lastWorldTick:0,worldNote:'',worldTitle:'',worldDescription:'',worldBookIds:[],timeSense:{enabled:false,zone:'Asia/Kuala_Lumpur'},season:'none',seasonFx:true,seasonAi:true,atmosphere:'default',memoryEngine:null,growthGarden:{pets:[],children:[],diary:[]},updatedAt:0};
  let busy=false;
  let memorySummaryRunning=false;
  let historyStorageReady=false;
  let historyDbPromise=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function load(){
    try{data={...data,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){}
    if(!Array.isArray(data.selectedPeople))data.selectedPeople=[];if(!Array.isArray(data.locations))data.locations=[];if(!Array.isArray(data.history))data.history=[];if(!Array.isArray(data.activityLog))data.activityLog=[];if(!Array.isArray(data.memories))data.memories=[];if(!Array.isArray(data.invites))data.invites=[];if(!data.growthGarden||typeof data.growthGarden!=='object')data.growthGarden={pets:[],children:[],diary:[]};if(!Array.isArray(data.growthGarden.pets))data.growthGarden.pets=[];if(!Array.isArray(data.growthGarden.children))data.growthGarden.children=[];if(!Array.isArray(data.growthGarden.diary))data.growthGarden.diary=[];if(!data.characterSchedule||typeof data.characterSchedule!=='object')data.characterSchedule={};if(!Array.isArray(data.worldBookIds))data.worldBookIds=[];if(!data.timeSense||typeof data.timeSense!=='object')data.timeSense={enabled:false,zone:'Asia/Kuala_Lumpur'};if(!data.timeSense.zone)data.timeSense.zone='Asia/Kuala_Lumpur';if(!data.season)data.season='none';if(typeof data.seasonFx!=='boolean')data.seasonFx=true;if(typeof data.seasonAi!=='boolean')data.seasonAi=true;if(!data.worldTitle&&data.worldNote)data.worldTitle=data.worldNote;if(!data.worldTitle)data.worldTitle='我们的世界';
    const hadEngine=!!data.memoryEngine;
    if(!data.memoryEngine||typeof data.memoryEngine!=='object')data.memoryEngine={batchSize:10,completedThrough:0,batches:[],summaries:[],diaryEntries:[],cards:[],currentState:'',lastSuccessAt:0,autoEnabled:true,nextSequence:1,health:{lastCheckedAt:0,issues:[]}};
    const me=data.memoryEngine;me.batchSize=10;if(!Array.isArray(me.batches))me.batches=[];if(!Array.isArray(me.summaries))me.summaries=[];if(!Array.isArray(me.diaryEntries))me.diaryEntries=[];if(!Array.isArray(me.cards))me.cards=[];if(!Array.isArray(me.health?.issues))me.health={lastCheckedAt:0,issues:[]};if(typeof me.autoEnabled!=='boolean')me.autoEnabled=true;
    let maxSeq=0;data.history.forEach((h,i)=>{if(!h.id)h.id='h-legacy-'+(i+1);if(!Number.isFinite(h.seq))h.seq=i+1;maxSeq=Math.max(maxSeq,h.seq);if(!h.threadId)h.threadId='thread-legacy';});
    if(!hadEngine){me.completedThrough=maxSeq;me.nextSequence=maxSeq+1;
      // Preserve legacy memory snippets by migrating them into the new archive once.
      (data.memories||[]).forEach((old,i)=>{const content=String(old.text||'').trim();if(!content)return;const title='旧记忆 · '+String(old.place||'世界经历');const source=(data.history||[]).find(h=>h.at===old.at&&(h.place===old.place||!old.place));me.cards.push({id:String(old.id||('legacy-memory-'+i)),dedupeKey:'legacy-'+String(old.id||i),type:'shared',title,content,characterNames:[],characterIds:[],locationNames:old.place?[old.place]:[],locationIds:source?.locationId?[source.locationId]:[],threadIds:source?.threadId?[source.threadId]:[],sourceRecordIds:source?[source.id]:[],emotion:'',status:'active',tags:['旧版迁移'],createdAt:Number(old.at)||Date.now(),updatedAt:Number(old.at)||Date.now(),userEdited:false})});
    }else{me.nextSequence=Math.max(Number(me.nextSequence)||1,maxSeq+1);}
    save();
  }
  function save(){data.updatedAt=Date.now();try{const stored={...data};if(historyStorageReady)stored.history=[];localStorage.setItem(KEY,JSON.stringify(stored));return true}catch(e){console.error('LOVE RECORD Space storage failed',e);return false}}
  function openHistoryDB(){if(historyDbPromise)return historyDbPromise;historyDbPromise=new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return}const req=indexedDB.open('love-record-space-history-v1',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('history'))db.createObjectStore('history',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'))});return historyDbPromise}
  async function hydrateHistoryFromIDB(){try{const db=await openHistoryDB();const stored=await new Promise((resolve,reject)=>{const tx=db.transaction('history','readonly'),req=tx.objectStore('history').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});const byId=new Map();[...(data.history||[]),...stored].forEach(h=>{if(h&&h.id)byId.set(h.id,h)});data.history=[...byId.values()].sort((a,b)=>(Number(a.seq)||0)-(Number(b.seq)||0)||(Number(a.at)||0)-(Number(b.at)||0));let max=0;data.history.forEach((h,i)=>{if(!Number.isFinite(Number(h.seq)))h.seq=i+1;max=Math.max(max,Number(h.seq)||0)});data.memoryEngine.nextSequence=Math.max(Number(data.memoryEngine.nextSequence)||1,max+1);const tx=db.transaction('history','readwrite'),store=tx.objectStore('history');data.history.forEach(h=>store.put(h));await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});historyStorageReady=true;save()}catch(e){console.warn('Space history archive using compatibility storage fallback',e);historyStorageReady=false}}
  async function persistHistoryRecord(record){try{const db=await openHistoryDB();await new Promise((resolve,reject)=>{const tx=db.transaction('history','readwrite');tx.objectStore('history').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});return true}catch(e){console.error('Could not persist Space history to IndexedDB',e);historyStorageReady=false;try{const stored={...data};stored.history=data.history;localStorage.setItem(KEY,JSON.stringify(stored))}catch(_){}toast('剧情档案存储失败。请检查浏览器存储空间；本次内容仍保留在当前页面中。');return false}}
  async function deleteHistoryRecordFromIDB(id){try{const db=await openHistoryDB();await new Promise((resolve,reject)=>{const tx=db.transaction('history','readwrite');tx.objectStore('history').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}catch(e){console.warn('Could not delete archived history record',e)}}
  function people(){
    // Read the same persistent people store used by LOVE RECORD itself.
    // Do not depend on window.state: the main app declares `let state`, which is
    // a global lexical binding rather than a window property.
    try{
      const raw=localStorage.getItem('yanyan-love-settings-v5');
      const parsed=raw?JSON.parse(raw):null;
      const list=Array.isArray(parsed?.people)?parsed.people:[];
      if(list.length)return list.filter(p=>p&&p.id!=='p-yanyan'&&String(p.name||'').trim());
    }catch(e){}
    try{
      if(typeof state!=='undefined' && Array.isArray(state.people)){
        return state.people.filter(p=>p&&p.id!=='p-yanyan'&&String(p.name||'').trim());
      }
    }catch(e){}
    return [];
  }
  function person(id){return people().find(p=>p.id===id)}
  function toast(msg){if(typeof window.toast==='function')window.toast(msg);else alert(msg)}
  function apiConfig(){let s={};try{s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}')||{}}catch(e){}return {base:String(s.apiBase||$('apiBase')?.value||'').trim().replace(/\/+$/,''),key:String(s.apiKey||$('apiKey')?.value||'').trim(),model:String(s.apiModel||$('apiModel')?.value||'').trim()}}
  async function callAPI(system,user,loadingText='正在连接 API…'){
    const {base,key,model}=apiConfig();
    if(!base||!key||!model){toast('请先在 LOVE RECORD 的 API 设置里连接模型。');return null}
    busy=true; setBusy(true,loadingText);
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const r=await fetch(base+'/chat/completions',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'Accept':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:user}],temperature:.9,stream:false})});
      const raw=await r.text();if(!r.ok){let d=raw;try{const j=JSON.parse(raw);d=j.error?.message||j.message||raw}catch{}throw new Error('HTTP '+r.status+' · '+String(d).slice(0,220))}
      let j;try{j=JSON.parse(raw)}catch{throw new Error('API 返回不是有效 JSON')}
      let c=j?.choices?.[0]?.message?.content??j?.choices?.[0]?.text??'';
      if(Array.isArray(c))c=c.map(x=>x?.text||'').join('');
      if(!String(c).trim())throw new Error('API 返回为空');
      return String(c).trim();
    }catch(e){toast(e.name==='AbortError'?'API 请求超时（30秒）':'API 请求失败：'+e.message);return null}
    finally{clearTimeout(timer);busy=false;setBusy(false)}
  }
  function setBusy(on,text='正在生成…'){
    const m=$('lrSpaceV2Busy');if(!m)return;m.querySelector('.lr-space-busy-text').textContent=text;m.classList.toggle('show',!!on);
  }
  function installStyles(){
    if($('lrSpaceV2Style'))return;
    const s=document.createElement('style');s.id='lrSpaceV2Style';s.textContent=`
.lr-space-v2.active ~ .nav{display:none!important}
#lrSpaceActivityModal .lr-space-review-item{overflow:hidden}
#lrSpaceActivityModal .lr-space-review-item b{display:block;min-width:0;overflow-wrap:anywhere;line-height:1.45}
.lr-space-growth-item[data-growth-open]{cursor:pointer;touch-action:manipulation}
.lr-space-growth-item[data-growth-open] .lr-space-growth-item-copy{min-width:0}
.lr-space-pet-detail{padding:8px 0 18px}
.lr-space-pet-hero{display:flex;align-items:center;gap:14px;padding:18px;border-radius:24px;background:linear-gradient(135deg,#f9e8f5,#f0eafb);margin-bottom:16px}
.lr-space-pet-hero .lr-space-growth-avatar{width:72px;height:72px;flex:0 0 72px;font-size:36px}
.lr-space-pet-hero h3{margin:0 0 5px;font-size:22px}.lr-space-pet-hero p{margin:0;color:#8e788e;font-size:13px}
.lr-space-pet-section{border:1px solid #eadce8;background:rgba(255,255,255,.8);border-radius:20px;padding:16px;margin:12px 0}
.lr-space-pet-section h4{margin:0 0 12px;font-size:16px}
.lr-space-pet-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lr-space-pet-fields label{display:block;font-size:12px;color:#967f93;margin-bottom:6px}
.lr-space-pet-fields input,.lr-space-pet-fields select{width:100%;min-width:0;border:1px solid #e5d6e4;border-radius:12px;background:#fff;padding:11px;color:#655468;font:inherit}
.lr-space-pet-actions{display:flex;gap:10px;margin-top:14px}.lr-space-pet-actions button{flex:1;min-height:44px;border-radius:14px}
.lr-space-pet-back{border:1px solid #e3d4e2;background:#fff;color:#8d6f88;padding:10px 15px;border-radius:14px;margin-bottom:12px}
@media(max-width:380px){.lr-space-pet-fields{grid-template-columns:1fr}.lr-space-pet-hero{align-items:flex-start}}

#space.lr-space-v2{position:relative;padding:0 0 110px;background:linear-gradient(180deg,#f8f4f9 0%,#f1edf4 100%);min-height:calc(100dvh - 150px);overflow:hidden}
#space.lr-space-v2 *{box-sizing:border-box}.lr-space-v2-screen{min-height:calc(100dvh - 150px);padding:24px 0}.lr-space-v2.hidden{display:none!important}
.lr-space-v2-intro{position:fixed;inset:0;z-index:5000;background:radial-gradient(circle at 50% 40%,#fff 0,#f4edf7 40%,#d8c6e0 100%);display:grid;place-items:center;opacity:1;pointer-events:auto;transition:opacity .7s ease}.lr-space-v2-intro.hide{opacity:0;pointer-events:none}.lr-space-v2-intro-inner{text-align:center;transform:translateY(12px);animation:lrSpaceIntro 1.25s ease both}.lr-space-v2-intro-mark{width:76px;height:76px;border-radius:50%;margin:0 auto 22px;background:radial-gradient(circle at 35% 30%,#fff,#d5b9df 58%,#a987b8);box-shadow:0 18px 55px rgba(126,92,145,.22);animation:lrSpaceOrb 2.2s ease-in-out infinite}.lr-space-v2-intro-title{font:400 42px/1 Georgia,'Noto Serif SC',serif;letter-spacing:.12em;color:#55465d}.lr-space-v2-intro-sub{margin-top:12px;color:#95869b;letter-spacing:.16em;font-size:11px}.lr-space-v2-intro-line{width:54px;height:1px;background:#c79ab5;margin:20px auto}
@keyframes lrSpaceIntro{from{opacity:0;transform:translateY(28px) scale(.96)}to{opacity:1;transform:none}}@keyframes lrSpaceOrb{50%{transform:scale(1.06);box-shadow:0 24px 70px rgba(126,92,145,.3)}}
.lr-space-v2-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:20px}.lr-space-v2-kicker{font-size:11px;letter-spacing:.18em;color:#b18ca6;text-transform:uppercase}.lr-space-v2-head h1{margin:5px 0 0;font:400 34px/1.1 Georgia,'Noto Serif SC',serif;color:#4b3d50}.lr-space-v2-head p{margin:7px 0 0;color:#948896;font-size:12px;line-height:1.7}.lr-space-v2-pill{border:1px solid #e1d3e4;background:rgba(255,255,255,.7);padding:10px 14px;border-radius:999px;color:#88677d;white-space:nowrap}
.lr-space-v2-panel{background:rgba(255,255,255,.74);border:1px solid rgba(255,255,255,.9);border-radius:28px;box-shadow:0 14px 40px rgba(91,68,101,.08);backdrop-filter:blur(18px);padding:20px;margin-bottom:15px}.lr-space-v2-panel h2{margin:0;color:#4e4054;font:400 22px/1.3 Georgia,'Noto Serif SC',serif}.lr-space-v2-sub{margin:7px 0 0;color:#958996;font-size:12px;line-height:1.7}
.lr-space-people{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.lr-space-person{border:1px solid #e6dbe8;background:rgba(255,255,255,.78);border-radius:20px;padding:12px;display:flex;align-items:center;gap:10px;text-align:left;color:#5c4e62;cursor:pointer}.lr-space-person.selected{border-color:#c887a8;box-shadow:0 0 0 2px rgba(200,135,168,.12);background:#fff}.lr-space-avatar{width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(145deg,#f8e9f1,#dfc8e5);color:#a56f91;font-weight:600;overflow:hidden}.lr-space-avatar img{width:100%;height:100%;object-fit:cover}.lr-space-person b{display:block;font-size:14px}.lr-space-person small{display:block;margin-top:4px;color:#9a8c9d;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr-space-check{margin-left:auto;width:22px;height:22px;border-radius:50%;border:1px solid #d8cbdc;display:grid;place-items:center;color:#fff}.selected .lr-space-check{background:#c887a8;border-color:#c887a8}
.lr-space-actions{display:flex;justify-content:flex-end;margin-top:16px}.lr-space-primary{border:0;background:linear-gradient(135deg,#d38cab,#b96f95);color:#fff;border-radius:999px;padding:13px 22px;font-size:14px;box-shadow:0 10px 24px rgba(185,111,149,.22);cursor:pointer}.lr-space-primary:disabled{opacity:.45}.lr-space-secondary{border:1px solid #e0d2e3;background:#fff;color:#89697d;border-radius:999px;padding:11px 17px;cursor:pointer}
.lr-space-map{position:relative;min-height:560px;border-radius:30px;overflow:hidden;background:radial-gradient(circle at 25% 25%,rgba(255,255,255,.92),transparent 30%),linear-gradient(145deg,#e9e0ed,#f8f4f8 50%,#e3d7e8);border:1px solid rgba(255,255,255,.95);box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),0 18px 50px rgba(91,68,101,.1)}
.lr-space-map:before{content:"";position:absolute;inset:0;background-image:linear-gradient(115deg,transparent 48%,rgba(255,255,255,.72) 49%,transparent 50%),linear-gradient(25deg,transparent 48%,rgba(255,255,255,.72) 49%,transparent 50%);background-size:180px 140px;opacity:.55}.lr-space-map-title{position:absolute;left:20px;top:18px;z-index:2}.lr-space-map-title b{display:block;font:400 20px Georgia,'Noto Serif SC',serif;color:#55455c}.lr-space-map-title span{font-size:10px;color:#9a899f;letter-spacing:.12em}.lr-space-location{position:absolute;z-index:3;transform:translate(-50%,-50%);border:0;background:transparent;cursor:pointer;text-align:center;color:#56475e}.lr-space-location-pin{width:58px;height:58px;border-radius:21px;background:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.95);box-shadow:0 12px 24px rgba(92,67,103,.13);display:grid;place-items:center;margin:auto;font-size:23px;color:#b3799a;transition:.2s}.lr-space-location:hover .lr-space-location-pin{transform:translateY(-4px) scale(1.04)}.lr-space-location b{display:block;margin-top:6px;font-size:11px;font-weight:600}.lr-space-location small{display:block;color:#9b8b9e;font-size:9px;margin-top:2px;max-width:110px}.lr-space-map-add{position:absolute;right:16px;bottom:16px;z-index:4}.lr-space-empty-map{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#8f8193;padding:30px}.lr-space-empty-map b{display:block;font:400 22px Georgia,'Noto Serif SC',serif;color:#5b4c61;margin-bottom:8px}
.lr-space-story{background:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.92);border-radius:28px;box-shadow:0 14px 40px rgba(91,68,101,.08);padding:22px}.lr-space-story-place{font-size:10px;letter-spacing:.16em;color:#b17d98;text-transform:uppercase}.lr-space-story h2{font:400 27px/1.25 Georgia,'Noto Serif SC',serif;color:#4e4054;margin:6px 0}.lr-space-story-meta{color:#988b9a;font-size:11px;line-height:1.7}.lr-space-story-body{margin-top:18px;color:#5a4d60;font-size:15px;line-height:2;white-space:pre-wrap}.lr-space-story-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.lr-space-story-input{display:flex;gap:8px;margin-top:14px}.lr-space-story-input input{flex:1;min-width:0;border:1px solid #e2d6e4;background:#fff;border-radius:18px;padding:13px 14px;outline:none;color:#514455}.lr-space-story-input button{flex:none}
.lr-space-create textarea{width:100%;min-height:120px;resize:vertical;border:1px solid #dfd2e2;border-radius:18px;padding:14px;background:#fff;outline:none;color:#504355;font:inherit;line-height:1.7}.lr-space-create label{display:block;font-size:11px;color:#9b8b9e;margin:16px 0 7px}.lr-space-create .hint{font-size:11px;color:#9b8b9e;margin-top:7px}.lr-space-locations-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.lr-space-location-tag{padding:8px 11px;border:1px solid #e3d7e6;border-radius:999px;background:#fff;color:#806b84;font-size:11px}
.lr-space-busy{position:fixed;inset:0;z-index:5100;background:rgba(49,39,54,.22);backdrop-filter:blur(8px);display:none;place-items:center}.lr-space-busy.show{display:grid}.lr-space-busy-box{width:min(280px,calc(100vw - 48px));padding:25px;border-radius:26px;background:rgba(255,255,255,.92);text-align:center;box-shadow:0 24px 70px rgba(50,35,58,.2)}.lr-space-spinner{width:38px;height:38px;border:2px solid #eadde9;border-top-color:#bb7f9e;border-radius:50%;margin:0 auto 14px;animation:lrSpin .9s linear infinite}.lr-space-busy-text{color:#66556b;font-size:13px}@keyframes lrSpin{to{transform:rotate(360deg)}}

.lr-space-map-heading-row{display:flex;align-items:flex-start}.lr-space-world-title-btn{border:0;background:transparent;padding:0;text-align:left;color:inherit;cursor:pointer}.lr-space-world-title-btn h1{display:inline-block}.lr-space-fixed-title{margin:5px 0 8px!important;font:400 34px/1.1 Georgia,'Noto Serif SC',serif!important;color:#4b3d50}.lr-space-world-title-btn{display:block}.lr-space-world-title-btn span:first-child{display:block;font:400 16px/1.4 Georgia,'Noto Serif SC',serif;color:#806a86}.lr-space-title-edit{display:block;font-size:10px;color:#b18ca6;letter-spacing:.08em;margin-top:3px;opacity:1}.lr-space-location-pin img{width:100%;height:100%;object-fit:cover;border-radius:20px}.lr-space-modal{position:fixed;inset:0;z-index:5200;display:none;pointer-events:none;align-items:flex-end;background:rgba(52,41,58,.2);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.lr-space-modal.show{display:flex;pointer-events:auto}.lr-space-sheet{width:100%;max-height:88dvh;overflow:auto;background:rgba(255,255,255,.96);border:1px solid rgba(255,255,255,.95);border-radius:30px 30px 0 0;padding:20px 19px 28px;box-shadow:0 -18px 60px rgba(66,46,74,.16)}.lr-space-sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.lr-space-sheet h2{margin:4px 0 0;font:400 25px/1.25 Georgia,'Noto Serif SC',serif;color:#4e4054}.lr-space-sheet-head p{margin:5px 0 0;font-size:11px;color:#9a8b9e}.lr-space-close{width:36px;height:36px;border:1px solid #e5dbe7;border-radius:50%;background:#fff;color:#7f6d84;font-size:20px}.lr-space-setting-section{padding:16px 0;border-top:1px solid #eee6ef}.lr-space-setting-section:first-of-type{border-top:0}.lr-space-setting-section h3{margin:0;font-size:10px;letter-spacing:.18em;color:#a68196}.lr-space-setting-section p{margin:6px 0 10px;color:#9a8d9d;font-size:11px;line-height:1.6}.lr-space-setting-list{display:grid;gap:8px}.lr-space-setting-check{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid #e7dce9;border-radius:15px;background:#fff}.lr-space-setting-check input{margin-top:2px}.lr-space-setting-check b{display:block;font-size:12px;color:#5b4c61}.lr-space-setting-check small{display:block;margin-top:3px;font-size:10px;color:#9a8c9e;line-height:1.5}.lr-space-select,.lr-space-input,.lr-space-textarea{width:100%;border:1px solid #e2d6e4;border-radius:15px;background:#fff;color:#514356;padding:12px 13px;font:inherit;outline:none}.lr-space-textarea{min-height:100px;resize:vertical;line-height:1.7}.lr-space-sheet>label{display:block;margin:12px 0 6px;font-size:10px;color:#9b8b9e}.lr-space-switch{display:flex!important;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;margin:0!important;color:#66566b!important;font-size:12px!important}.lr-space-switch input{display:none}.lr-space-switch i{width:42px;height:24px;border-radius:999px;background:#ddd2df;position:relative;flex:none;transition:.2s}.lr-space-switch i:after{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.12);transition:.2s}.lr-space-switch input:checked+i{background:#c887a8}.lr-space-switch input:checked+i:after{transform:translateX(18px)}.lr-space-full-btn{width:100%;margin-top:14px}.lr-space-location-preview{height:150px;border:1px dashed #d9cadc;border-radius:20px;background:linear-gradient(145deg,#f8f2f9,#eee5f1);display:grid!important;place-items:center;color:#9d8da0;overflow:hidden;cursor:pointer}.lr-space-location-preview img{width:100%;height:100%;object-fit:cover}.lr-space-edit-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px}.lr-space-danger{border:1px solid #e8ccd6;background:#fff4f7;color:#a66578;border-radius:999px;padding:12px 15px}.lr-space-season-fx{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;border-radius:30px}.lr-space-season-fx span{position:absolute;top:-30px;animation:lrSeasonFall 10s linear infinite;filter:drop-shadow(0 2px 4px rgba(110,80,120,.12))}.season-winter span{color:#fff}.season-spring span{color:#d39ab4}.season-summer span{color:#d7a86b}.season-autumn span{color:#b98268}.season-night{filter:saturate(.9)}@keyframes lrSeasonFall{0%{transform:translate3d(0,-20px,0) rotate(0deg)}50%{transform:translate3d(22px,300px,0) rotate(100deg)}100%{transform:translate3d(-18px,650px,0) rotate(220deg)}}
/* SPACE V1 · cherry blossom illustrated world */
#space.lr-space-v2{background:linear-gradient(180deg,#fff8fb 0%,#f7effa 48%,#fdf4f7 100%);color:#554459}
.lr-space-v2-kicker{color:#c28ba8!important}.lr-space-v2-head h1,.lr-space-fixed-title{color:#58425f!important}
.lr-space-v2-panel{border-color:rgba(255,255,255,.96);background:rgba(255,252,254,.84);box-shadow:0 14px 42px rgba(175,119,157,.10)}
.lr-space-primary{background:linear-gradient(135deg,#dfa0bc,#c57fa8)!important;box-shadow:0 10px 24px rgba(197,127,168,.24)!important}
.lr-space-secondary,.lr-space-pill{border-color:#eed9e6!important;color:#a16f8b!important}
.lr-space-map{background:linear-gradient(180deg,#f9eaf3 0%,#f5eefa 42%,#e7edf7 100%)!important;border-color:#fff!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.65),0 18px 50px rgba(175,119,157,.13)!important}
.lr-space-map:before{background-image:radial-gradient(ellipse at 20% 22%,rgba(255,255,255,.9) 0 9%,transparent 10%),radial-gradient(ellipse at 80% 68%,rgba(255,255,255,.75) 0 12%,transparent 13%),linear-gradient(155deg,transparent 42%,rgba(255,255,255,.8) 43% 45%,transparent 46%),linear-gradient(25deg,transparent 48%,rgba(220,191,220,.5) 49% 51%,transparent 52%);background-size:auto,auto,100% 100%,170px 145px;opacity:.82}
.lr-space-location-pin{background:linear-gradient(145deg,#fff,#fff4f9)!important;border-color:#fff!important;box-shadow:0 12px 24px rgba(183,120,158,.2)!important;color:#c17ea5!important;border-radius:22px 22px 18px 22px!important}
.lr-space-location b{color:#654d6b!important;text-shadow:0 1px 0 rgba(255,255,255,.8)}
.lr-space-livebar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 15px;margin:0 0 14px;border:1px solid #f1dce8;border-radius:20px;background:linear-gradient(110deg,rgba(255,255,255,.92),rgba(255,241,248,.86));box-shadow:0 8px 24px rgba(175,119,157,.08)}
.lr-space-livebar b{display:block;font-size:13px;color:#76546f}.lr-space-livebar small{display:block;margin-top:4px;color:#a28a9f;font-size:10px}.lr-space-live-dot{width:8px;height:8px;border-radius:50%;background:#d98eaf;display:inline-block;margin-right:6px;box-shadow:0 0 0 4px #f8e4ed}
.lr-space-life-panel{background:rgba(255,252,254,.9);border:1px solid #f1dce8;border-radius:24px;padding:17px;margin-top:15px;box-shadow:0 12px 30px rgba(175,119,157,.08)}
.lr-space-life-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}.lr-space-life-head h2{margin:0;font:400 21px Georgia,'Noto Serif SC',serif;color:#624c69}.lr-space-life-head small{color:#b28da5;font-size:10px;letter-spacing:.08em}
.lr-space-shortcuts-panel{padding:12px!important;margin-top:12px!important;position:relative;z-index:10}.lr-space-world-cards{display:flex;flex-direction:column;gap:12px;margin:0;position:relative;z-index:11;pointer-events:auto}.lr-space-world-card{appearance:none;-webkit-appearance:none;position:relative;z-index:12;isolation:isolate;width:100%;min-height:82px;box-sizing:border-box;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:rgba(194,132,171,.18);cursor:pointer;display:flex;flex-direction:row;align-items:center;text-align:left;gap:13px;padding:15px;border:1px solid #efdfeb;border-radius:20px;background:linear-gradient(110deg,rgba(255,255,255,.98),rgba(252,241,248,.94));color:#6d566f;box-shadow:0 6px 20px rgba(171,125,162,.07);user-select:none}.lr-space-world-card:active{transform:scale(.99);background:#fff0f7}.lr-space-world-card-icon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:14px;background:#f6e6f0;color:#bd86a7;font-size:22px;pointer-events:none}.lr-space-card-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:5px;pointer-events:none}.lr-space-world-card b{font-size:15px;font-weight:600;pointer-events:none}.lr-space-world-card small{font-size:11px;line-height:1.5;color:#a18da2;pointer-events:none}.lr-space-world-card-link{margin-left:auto;flex:none;font-size:11px;color:#b07e9d;pointer-events:none}.lr-space-growth-add{width:100%;padding:12px;border:1px dashed #d9bfd8;border-radius:15px;background:#fcf7fc;color:#9c779b;font-size:12px;margin:6px 0 12px}.lr-space-growth-item{display:flex;gap:12px;align-items:flex-start;padding:13px;border:1px solid #eee2ef;border-radius:17px;background:rgba(255,255,255,.8);margin:9px 0}.lr-space-growth-avatar{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,#f8e5ef,#eee6fb);font-size:25px;flex:none}.lr-space-growth-item h4{margin:0 0 4px;color:#66506f;font-size:14px}.lr-space-growth-item p{margin:0;color:#96869b;font-size:11px;line-height:1.7;white-space:pre-wrap}.lr-space-growth-item small{display:block;margin-top:6px;color:#bd8ba8;font-size:10px}.lr-space-growth-empty{text-align:center;padding:26px 14px;color:#a18fa4;font-size:12px;line-height:1.9}.lr-space-person-moment{display:flex;align-items:center;gap:12px;padding:14px;margin:10px 0;border:1px solid #f0dfeb;border-radius:18px;background:linear-gradient(120deg,rgba(255,255,255,.98),rgba(251,241,249,.94));box-shadow:0 5px 16px rgba(170,125,162,.06)}.lr-space-person-avatar{display:grid;place-items:center;flex:0 0 46px;width:46px;height:46px;border-radius:16px;background:linear-gradient(145deg,#f1e4fb,#fbe7f0);color:#8b6a9a;font-size:18px;font-weight:600}.lr-space-person-moment-copy{flex:1;min-width:0}.lr-space-person-moment-top{display:flex;align-items:center;gap:8px}.lr-space-person-moment-top b{color:#6e5574;font-size:14px}.lr-space-live-dot{font-size:10px;padding:3px 7px;border-radius:999px;background:#f4e9f5;color:#a27eaa}.lr-space-person-status{margin-top:5px;color:#806b89;font-size:12px}.lr-space-person-place{margin-top:5px;color:#b18aa6;font-size:11px}.lr-space-person-sparkle{color:#c39fbe;font-size:18px}.lr-space-growth-item-copy{flex:1;min-width:0}.lr-space-growth-item-actions{display:flex;gap:6px;margin-top:9px}.lr-space-growth-item-actions button{border:1px solid #eaddea;background:#fff;border-radius:999px;padding:6px 10px;color:#96758f;font-size:10px}.lr-space-growth-item-actions .lr-space-growth-delete{color:#b66d87;border-color:#f0d9e3}.lr-space-growth-add{font-weight:600;cursor:pointer;touch-action:manipulation}.lr-space-growth-item{min-width:0}.lr-space-growth-form{padding:12px;border:1px solid #eee1ef;border-radius:17px;background:#fcf8fc;margin-bottom:12px}.lr-space-growth-form label{display:block;color:#917b96;font-size:11px;margin:8px 0 5px}.lr-space-growth-form .lr-space-primary{margin-top:12px;width:100%}
.lr-space-activity{display:grid;grid-template-columns:58px 1fr;gap:10px;padding:11px 0;border-top:1px solid #f4e8ef}.lr-space-activity:first-child{border-top:0}.lr-space-activity time{font-size:11px;color:#bf83a2;padding-top:2px}.lr-space-activity b{display:block;font-size:12px;color:#6d566f}.lr-space-activity p{margin:4px 0 0;font-size:11px;line-height:1.6;color:#9b879b}.lr-space-life-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.lr-space-life-actions button{font-size:11px;padding:9px 12px}
.lr-space-invite{padding:12px;border-radius:16px;background:#fff4f8;border:1px solid #f0d6e4;margin:8px 0}.lr-space-invite b{font-size:12px;color:#7b5872}.lr-space-invite p{font-size:11px;color:#9b879b;line-height:1.5;margin:5px 0 9px}
.lr-space-season-fx span{opacity:.8}
.lr-space-story-place{display:none!important}.lr-space-story-head-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.lr-space-review-sheet{max-height:86dvh}.lr-space-review-list{display:flex;flex-direction:column;gap:0}.lr-space-review-item{padding:14px 0;border-top:1px solid #f0e3ec}.lr-space-review-item:first-child{border-top:0}.lr-space-review-meta{display:flex;justify-content:space-between;gap:10px;color:#b27e9b;font-size:11px;margin-bottom:6px}.lr-space-review-item b{display:block;color:#70546e;font-size:13px;margin-bottom:7px}.lr-space-review-text{white-space:pre-wrap;color:#827487;font-size:13px;line-height:1.85}.lr-space-review-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.lr-space-review-actions button{font-size:11px;padding:8px 12px}.lr-space-review-jump{background:linear-gradient(135deg,#dfa0bc,#c57fa8)!important;color:#fff!important;border-color:transparent!important}.lr-space-review-empty{padding:28px 10px;text-align:center;color:#a18fa3;font-size:13px;line-height:1.8}.lr-space-review-empty b{display:block;color:#806681;font-size:15px;margin-bottom:8px}.lr-space-review-empty p{margin:0;color:#a18fa3}.lr-space-activity-modal-note{border-radius:18px;background:linear-gradient(135deg,#fbf0f7,#f2ecfa);padding:14px;color:#927c96}#lrSpaceV2Story .lr-space-v2-head h1{font-size:27px;line-height:1.25;overflow-wrap:anywhere;max-width:100%}#lrSpaceV2Story .lr-space-v2-head{align-items:center;gap:10px}#lrSpaceV2Story .lr-space-story-head-actions{flex-direction:column;align-items:stretch;flex:none}#lrSpaceV2Story .lr-space-story-head-actions button{padding:9px 12px;font-size:12px}
@media(max-width:560px){.lr-space-people{grid-template-columns:1fr}.lr-space-map{min-height:500px}.lr-space-v2-head{align-items:flex-start}.lr-space-v2-head h1{font-size:30px}#lrSpaceV2Story .lr-space-v2-head h1{font-size:23px;max-width:calc(100vw - 210px)}#lrSpaceV2Story .lr-space-story-head-actions button{white-space:nowrap;padding:9px 10px}}
.lr-space-memory-modal{z-index:6100}.lr-space-memory-sheet{max-height:90dvh;overflow:auto}.lr-space-memory-tabs{display:flex;gap:7px;overflow:auto;padding:4px 0 12px}.lr-space-memory-tab{border:1px solid #e7d9e9;background:#fff;border-radius:999px;padding:9px 12px;color:#8b718d;white-space:nowrap;font-size:12px}.lr-space-memory-tab.active{background:linear-gradient(135deg,#eadcf2,#f8e4ed);border-color:#d8b9d9;color:#6d527b}.lr-space-memory-card{border:1px solid #eee2ef;background:rgba(255,255,255,.82);border-radius:17px;padding:13px;margin:9px 0}.lr-space-memory-card h4{margin:0 0 6px;color:#66506f;font-size:14px}.lr-space-memory-card p{margin:0;color:#87778b;font-size:12px;line-height:1.8;white-space:pre-wrap}.lr-space-memory-meta{display:flex;gap:7px;flex-wrap:wrap;color:#b0809c;font-size:10px;margin-top:9px}.lr-space-memory-actions{display:flex;gap:7px;margin-top:10px}.lr-space-memory-actions button{border:1px solid #eaddea;background:#fff;border-radius:999px;padding:7px 11px;color:#96758f;font-size:11px}.lr-space-memory-empty{padding:24px 12px;text-align:center;color:#a08ea4;font-size:12px;line-height:1.8}.lr-space-memory-setting{background:#fbf7fc;border:1px solid #eee3f1;border-radius:16px;padding:13px;margin:12px 0}.lr-space-memory-setting b{display:block;color:#725b7a;font-size:13px}.lr-space-memory-setting p{margin:6px 0;color:#98889d;font-size:11px;line-height:1.7}.lr-space-memory-setting-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.lr-space-memory-setting-actions button{font-size:11px;padding:9px 12px}
@media(max-width:560px){.lr-space-memory-sheet{padding:18px}.lr-space-memory-tabs{margin-right:-4px}.lr-space-memory-card{padding:12px}}

`;
    document.head.appendChild(s);
  }
  function replaceSpace(){
    const old=$('space');if(!old)return;
    old.className='page active lr-space-v2';
    old.innerHTML=`
      <div id="lrSpaceV2Directory" class="lr-space-v2-screen">
        <div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">LOVE RECORD · SPACE</div><h1>空间</h1><p>先选择今天一起进入这个世界的人。</p></div></div>
        <section class="lr-space-v2-panel"><h2>今天，谁会来到这里？</h2><div class="lr-space-v2-sub">支持单人或多人。选择完成后，AI 会根据同行者共同开启今天的空间。</div><div id="lrSpacePeople" class="lr-space-people"></div><div class="lr-space-actions"><button id="lrSpaceEnter" class="lr-space-primary" type="button" disabled>进入空间</button></div></section>
      </div>
      <div id="lrSpaceV2Map" class="lr-space-v2-screen" hidden>
        <div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">THE WORLD</div><div class="lr-space-map-heading-row"><div><h1 class="lr-space-fixed-title">空间地图</h1><button id="lrSpaceWorldTitleBtn" class="lr-space-world-title-btn" type="button" aria-label="编辑世界名称"><span id="lrSpaceWorldTitle">我们的世界</span><span class="lr-space-title-edit">编辑世界名称</span></button></div></div><p id="lrSpaceMapMeta">选择一个地方，让故事从这里开始。</p></div><button id="lrSpaceBackPeople" class="lr-space-secondary" type="button">更换同行者</button></div>
        <div class="lr-space-map" id="lrSpaceMap"><div class="lr-space-map-title"><span>PLACES · STORIES · MOMENTS</span></div><div id="lrSpaceMapLocations"></div><div class="lr-space-map-add"><button id="lrSpaceCreateBtn" class="lr-space-primary" type="button">＋ 创建地点</button></div><div id="lrSpaceSeasonFX" class="lr-space-season-fx" aria-hidden="true"></div></div>
        <section class="lr-space-life-panel lr-space-shortcuts-panel"><div class="lr-space-world-cards"><button id="lrSpaceOpenPeopleDynamics" class="lr-space-world-card" type="button" aria-label="打开角色动态"><span class="lr-space-world-card-icon">✧</span><span class="lr-space-card-copy"><b>角色动态</b><small>看看大家此刻正在做什么</small></span><span class="lr-space-world-card-link">查看动态　›</span></button><button id="lrSpaceOpenGrowthGarden" class="lr-space-world-card" type="button" aria-label="打开成长乐园"><span class="lr-space-world-card-icon">☘</span><span class="lr-space-card-copy"><b>成长乐园</b><small>萌宠、育儿与成长日记</small></span><span class="lr-space-world-card-link">进入乐园　›</span></button></div></section>
      </div>
      <div id="lrSpaceV2Story" class="lr-space-v2-screen" hidden>
        <div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">CURRENT PLACE</div><h1 id="lrSpaceCurrentPlaceTitle">当前地点</h1></div><div class="lr-space-story-head-actions"><button id="lrSpaceReviewStory" class="lr-space-secondary" type="button">回顾剧情</button><button id="lrSpaceBackMap" class="lr-space-secondary" type="button">返回地图</button></div></div>
        <section class="lr-space-story"><div id="lrSpaceStoryPlace" class="lr-space-story-place"></div><h2 id="lrSpaceStoryTitle" hidden></h2><div id="lrSpaceStoryMeta" class="lr-space-story-meta" hidden></div><div id="lrSpaceStoryBody" class="lr-space-story-body">正在让这个地点发生故事……</div><div id="lrSpaceStoryActions" class="lr-space-story-actions"></div><div class="lr-space-story-input"><input id="lrSpaceStoryInput" placeholder="告诉 AI 你想做什么……"><button id="lrSpaceStorySend" class="lr-space-primary" type="button">继续</button></div></section>
        <div id="lrSpaceStoryReview" class="lr-space-modal" aria-hidden="true"><section class="lr-space-sheet lr-space-review-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">STORY ARCHIVE</div><h2>回顾剧情</h2><p>按时间回顾这条连续的故事。</p></div><button class="lr-space-close" id="lrSpaceReviewClose" type="button">×</button></div><div id="lrSpaceReviewList" class="lr-space-review-list"></div></section></div>

      </div>
        <div id="lrSpaceActivityModal" class="lr-space-modal" aria-hidden="true"><section class="lr-space-sheet lr-space-review-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker" id="lrSpaceActivityKicker">WORLD ACTIVITY</div><h2 id="lrSpaceActivityTitle">世界动态</h2><p id="lrSpaceActivitySubtitle">看看这个世界正在发生什么。</p></div><button class="lr-space-close" id="lrSpaceActivityClose" type="button">×</button></div><div id="lrSpaceActivityList" class="lr-space-review-list"></div></section></div>
      <div id="lrSpaceCreate" class="lr-space-v2-screen" hidden><div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">CREATE PLACE</div><h1>创建地点</h1><p>告诉 AI 你想让地图里出现什么地方。</p></div><button id="lrSpaceCreateBack" class="lr-space-secondary" type="button">返回地图</button></div><section class="lr-space-panel lr-space-v2-panel lr-space-create"><h2>你想要什么地点？</h2><label for="lrSpaceCreatePrompt">地点描述</label><textarea id="lrSpaceCreatePrompt" placeholder="例如：城市边缘的一间可以看星星的玻璃温室，适合晚上聊天。"></textarea><div class="hint">写下你的想法后，AI 会整理出地点名称、用途、简介、氛围与可发生的故事。</div><div class="lr-space-actions"><button id="lrSpaceCreateSubmit" class="lr-space-primary" type="button">让 AI 创建地点</button></div></section><section class="lr-space-v2-panel"><h2>已创建地点</h2><div id="lrSpaceCreatedList" class="lr-space-locations-list"></div></section></div>
      <div id="lrSpaceGrowthGarden" class="lr-space-modal lr-space-memory-modal" aria-hidden="true"><section class="lr-space-sheet lr-space-memory-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">GROWTH GARDEN</div><h2>成长乐园</h2><p>陪伴萌宠与孩子慢慢长大，把生活里的小小瞬间收藏起来。</p></div><button class="lr-space-close" id="lrSpaceGrowthClose" type="button">×</button></div><div class="lr-space-memory-tabs" id="lrSpaceGrowthTabs"><button class="lr-space-memory-tab active" data-growth-tab="pets" type="button">♡ 萌宠</button><button class="lr-space-memory-tab" data-growth-tab="children" type="button">✿ 育儿</button><button class="lr-space-memory-tab" data-growth-tab="diary" type="button">✧ 成长日记</button></div><div id="lrSpaceGrowthContent"></div></section></div>
      <div id="lrSpaceSettings" class="lr-space-modal"><section class="lr-space-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">SPACE SETTINGS</div><h2>世界设置</h2><button id="lrSpaceOpenMemoryArchive" class="lr-space-secondary" type="button" style="margin-top:9px">✦ 记忆档案</button></div><button class="lr-space-close" id="lrSpaceSettingsClose" type="button">×</button></div><div class="lr-space-setting-section"><h3>WORLD BOOK</h3><p>选择这个空间需要读取的世界书。</p><div id="lrSpaceBookList" class="lr-space-setting-list"></div></div><div class="lr-space-setting-section"><h3>TIME & PLACE</h3><p>让世界感知指定地区的当地时间。</p><label class="lr-space-switch"><span>启用时间感知</span><input id="lrSpaceTimeEnabled" type="checkbox"><i></i></label><select id="lrSpaceTimeZone" class="lr-space-select"><optgroup label="中国地区"><option value="Asia/Shanghai">上海 · 中国</option><option value="Asia/Shanghai">北京 · 中国</option><option value="Asia/Shanghai">广州 · 中国</option><option value="Asia/Shanghai">深圳 · 中国</option><option value="Asia/Shanghai">杭州 · 中国</option><option value="Asia/Shanghai">成都 · 中国</option><option value="Asia/Shanghai">重庆 · 中国</option><option value="Asia/Shanghai">南京 · 中国</option><option value="Asia/Shanghai">苏州 · 中国</option><option value="Asia/Shanghai">武汉 · 中国</option><option value="Asia/Shanghai">厦门 · 中国</option><option value="Asia/Shanghai">青岛 · 中国</option><option value="Asia/Shanghai">西安 · 中国</option><option value="Asia/Shanghai">昆明 · 中国</option><option value="Asia/Shanghai">大理 · 中国</option><option value="Asia/Shanghai">哈尔滨 · 中国</option><option value="Asia/Shanghai">长沙 · 中国</option><option value="Asia/Shanghai">三亚 · 中国</option></optgroup><optgroup label="其他地区"><option value="Asia/Kuala_Lumpur">Kuala Lumpur · 马来西亚</option><option value="Asia/Tokyo">Tokyo · 日本</option><option value="Asia/Seoul">Seoul · 韩国</option><option value="Europe/London">London · 英国</option><option value="America/New_York">New York · 美国</option><option value="America/Los_Angeles">Los Angeles · 美国</option></optgroup></select></div><div class="lr-space-setting-section"><h3>SEASON</h3><p>手动决定这个世界现在是什么季节。</p><select id="lrSpaceSeason" class="lr-space-select"><option value="none">不设置季节</option><option value="spring">春 · 花瓣</option><option value="summer">夏 · 光影</option><option value="autumn">秋 · 落叶</option><option value="winter">冬 · 飘雪</option></select><label class="lr-space-switch"><span>显示季节动态效果</span><input id="lrSpaceSeasonFx" type="checkbox"><i></i></label><label class="lr-space-switch"><span>让 AI 感知当前季节</span><input id="lrSpaceSeasonAi" type="checkbox"><i></i></label></div><div class="lr-space-setting-section"><h3>ATMOSPHERE</h3><select id="lrSpaceAtmosphere" class="lr-space-select"><option value="default">默认</option><option value="dreamy">梦幻</option><option value="quiet">安静</option><option value="warm">温暖</option><option value="rainy">雨夜</option><option value="morning">清晨</option><option value="night">深夜</option></select></div><div class="lr-space-setting-section"><h3>MEMORY ENGINE</h3><p>全世界跨地点统一整理。原始剧情永久保留，AI 优先读取摘要与相关长期记忆。</p><div class="lr-space-memory-setting"><b id="lrSpaceMemoryStatus">自动总结：每 10 条有效剧情记录</b><p id="lrSpaceMemoryProgress">正在读取记忆状态…</p><div class="lr-space-memory-setting-actions"><button id="lrSpaceMemorySummarizeNow" class="lr-space-secondary" type="button">整理待处理剧情</button><button id="lrSpaceMemoryHealthCheck" class="lr-space-secondary" type="button">记忆健康检查</button></div></div></div><button id="lrSpaceSettingsSave" class="lr-space-primary lr-space-full-btn" type="button">保存世界设置</button></section></div>
      <div id="lrSpaceMemoryArchive" class="lr-space-modal lr-space-memory-modal" aria-hidden="true"><section class="lr-space-sheet lr-space-memory-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">MEMORY ARCHIVE</div><h2>我们的记忆</h2><p>所有地点共享记忆；原始剧情保留在「回顾剧情」中。</p></div><button class="lr-space-close" id="lrSpaceMemoryClose" type="button">×</button></div><div id="lrSpaceMemoryTabs" class="lr-space-memory-tabs"><button class="lr-space-memory-tab active" data-memory-tab="cards" type="button">记忆卡片</button><button class="lr-space-memory-tab" data-memory-tab="diary" type="button">角色日记</button><button class="lr-space-memory-tab" data-memory-tab="summaries" type="button">剧情摘要</button><button class="lr-space-memory-tab" data-memory-tab="commitments" type="button">约定与计划</button><button class="lr-space-memory-tab" data-memory-tab="health" type="button">健康检查</button></div><div id="lrSpaceMemoryContent"></div></section></div>
      <div id="lrSpaceWorldEdit" class="lr-space-modal"><section class="lr-space-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">THE WORLD</div><h2>编辑世界</h2></div><button class="lr-space-close" id="lrSpaceWorldEditClose" type="button">×</button></div><label>世界名称</label><input id="lrSpaceWorldName" class="lr-space-input"><label>世界简介</label><textarea id="lrSpaceWorldDescription" class="lr-space-textarea" placeholder="这个世界是什么样的？"></textarea><button id="lrSpaceWorldSave" class="lr-space-primary lr-space-full-btn" type="button">保存</button></section></div>
      <div id="lrSpaceLocationEdit" class="lr-space-modal"><section class="lr-space-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">EDIT PLACE</div><h2>编辑地点</h2><p>长按地图上的地点即可打开。</p></div><button class="lr-space-close" id="lrSpaceLocationEditClose" type="button">×</button></div><label>地点图片</label><label id="lrSpaceLocationPreview" class="lr-space-location-preview" for="lrSpaceLocationImage"><span>上传地点图片</span></label><input id="lrSpaceLocationImage" type="file" accept="image/*" hidden><label>地点名称</label><input id="lrSpaceLocationName" class="lr-space-input"><label>地点类型</label><input id="lrSpaceLocationType" class="lr-space-input"><label>地点用途</label><input id="lrSpaceLocationPurpose" class="lr-space-input" placeholder="例如：居住空间 / 餐饮休闲 / 公共空间"><label>地点概要</label><textarea id="lrSpaceLocationDescription" class="lr-space-textarea"></textarea><label>氛围</label><input id="lrSpaceLocationAtmosphere" class="lr-space-input" placeholder="例如：安静、温暖、适合聊天"><div class="lr-space-edit-actions"><button id="lrSpaceLocationDelete" class="lr-space-danger" type="button">删除地点</button><button id="lrSpaceLocationSave" class="lr-space-primary" type="button">保存修改</button></div></section></div>
      <div id="lrSpaceV2Busy" class="lr-space-busy"><div class="lr-space-busy-box"><div class="lr-space-spinner"></div><div class="lr-space-busy-text">正在生成…</div></div></div>`;
    renderPeople();renderMap();renderCreatedList();
  }
  function bindSpaceControls(){
    const bind=(id,fn)=>{
      const el=$(id);
      if(!el)return;
      // Assign the target handler directly: mobile WebViews and legacy delegated
      // listeners can swallow bubbled clicks on dynamically replaced controls.
      el.onclick=e=>{e.preventDefault();e.stopPropagation();try{fn(e)}catch(err){console.error('[Space control]',id,err);toast('这个功能暂时无法打开，请稍后再试。')}};
      el.style.pointerEvents='auto';
      el.style.touchAction='manipulation';
    };
    bind('lrSpaceCreateBtn',()=>show('create'));
    bind('lrSpaceCreateBack',()=>show('map'));
    bind('lrSpaceCreateSubmit',()=>createLocation());
    bind('lrSpaceWorldTitleBtn',()=>openWorldEditor());
    bind('lrSpaceSettingsClose',()=>closeWorldSettings());
    bind('lrSpaceSettingsSave',()=>saveWorldSettings());
    bind('lrSpaceWorldEditClose',()=>closeWorldEditor());
    bind('lrSpaceWorldSave',()=>saveWorldEditor());
    bind('lrSpaceLocationEditClose',()=>closeLocationEditor());
    bind('lrSpaceLocationSave',()=>saveLocationEditor());
    bind('lrSpaceLocationDelete',()=>deleteLocationEditor());
    bind('lrSpaceReviewStory',()=>openStoryReview());
    bind('lrSpaceReviewClose',()=>closeStoryReview());
    bind('lrSpaceActivityClose',()=>closeActivityModal());
    // Bind the World Activity dashboard controls directly in capture phase.
    // This avoids the legacy app's delegated click handlers swallowing taps on mobile.
    bind('lrSpaceWorldRefresh',()=>{simulateWorld();toast('世界动态已更新。')});
    bind('lrSpaceOpenPeopleDynamics',()=>showPeopleDynamics());
    bind('lrSpaceOpenGrowthGarden',()=>openGrowthGarden('pets'));
    bind('lrSpaceGrowthClose',()=>closeGrowthGarden());
    bind('lrSpaceMemoryClose',()=>closeMemoryArchive());
    bind('lrSpaceOpenMemoryArchive',()=>openMemoryArchive('cards'));

  }
  function renderPeople(){
    const box=$('lrSpacePeople');if(!box)return;const list=people();
    if(!list.length){box.innerHTML='<div style="grid-column:1/-1;color:#9a8d9d;font-size:12px;padding:18px 4px">还没有可进入空间的人物。请先在 LOVE RECORD 的人物/联系人里添加角色。</div>';return}
    box.innerHTML=list.map(p=>{const selected=data.selectedPeople.includes(p.id);const av=p.avatar||p.image||'';return `<button type="button" class="lr-space-person ${selected?'selected':''}" data-space-person="${esc(p.id)}"><span class="lr-space-avatar">${av?`<img src="${esc(av)}" alt="">`:esc((p.name||'?').slice(0,1))}</span><span style="min-width:0"><b>${esc(p.name||'未命名人物')}</b><small>${esc(p.role||p.personality||'角色')}</small></span><span class="lr-space-check">${selected?'✓':''}</span></button>`}).join('');
    $('lrSpaceEnter').disabled=!data.selectedPeople.length;
  }
  function worldBooks(){
    try{if(typeof state!=='undefined'&&Array.isArray(state.worlds))return state.worlds}catch(e){}
    try{const raw=localStorage.getItem('yanyan-love-settings-v5');const s=raw?JSON.parse(raw):{};return Array.isArray(s.worlds)?s.worlds:[]}catch(e){return []}
  }
  function worldBookContext(){return worldBooks().filter(w=>data.worldBookIds.includes(w.id)).map(w=>({name:w.name,description:w.description,locations:w.locations,rules:w.rules}))}
  function timeContext(){
    if(!data.timeSense?.enabled)return '时间感知：关闭。';
    try{const zone=data.timeSense.zone||'Asia/Kuala_Lumpur';const now=new Date();const parts=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,dateStyle:'full',timeStyle:'medium'}).formatToParts(now);const obj=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `时间感知：开启；地区：${zone}；当地时间：${obj.year||''}-${obj.month||''}-${obj.day||''} ${obj.hour||''}:${obj.minute||''}:${obj.second||''}；星期：${obj.weekday||''}`;}catch(e){return '时间感知：开启；地区：'+String(data.timeSense?.zone||'Asia/Kuala_Lumpur')}}
  function worldContext(){return {worldName:data.worldTitle||data.worldNote||'我们的世界',worldDescription:data.worldDescription||'',worldBooks:worldBookContext(),time:timeContext(),season:data.season||'none',seasonAware:!!data.seasonAi,atmosphere:data.atmosphere||'default'}}
  function applySeasonFX(){
    const root=$('lrSpaceSeasonFX');if(!root)return;root.innerHTML='';root.className='lr-space-season-fx season-'+(data.season||'none');if(!data.seasonFx||!data.season||data.season==='none')return;
    const map={winter:['❄','·','✦'],spring:['✿','·','❀'],summer:['·','✦','○'],autumn:['•','·','❧']};const chars=map[data.season]||[];
    for(let i=0;i<30;i++){const el=document.createElement('span');el.textContent=chars[i%chars.length];el.style.left=(Math.random()*100)+'%';el.style.animationDelay=(-Math.random()*10)+'s';el.style.animationDuration=(7+Math.random()*8)+'s';el.style.opacity=(.25+Math.random()*.55).toFixed(2);el.style.fontSize=(8+Math.random()*10)+'px';root.appendChild(el)}
  }
  function openWorldSettings(){
    const modal=$('lrSpaceSettings');if(!modal)return;const books=worldBooks();
    $('lrSpaceBookList').innerHTML=books.length?books.map(w=>`<label class="lr-space-setting-check"><input type="checkbox" value="${esc(w.id)}" ${data.worldBookIds.includes(w.id)?'checked':''}><span><b>${esc(w.name||'未命名世界')}</b><small>${esc(w.description||'')}</small></span></label>`).join(''):'<div class="lr-space-setting-empty">还没有世界书。你可以先在 LOVE RECORD 的「世界书」里创建。</div>';
    $('lrSpaceTimeEnabled').checked=!!data.timeSense.enabled;$('lrSpaceTimeZone').value=data.timeSense.zone||'Asia/Kuala_Lumpur';$('lrSpaceSeason').value=data.season||'none';$('lrSpaceSeasonFx').checked=!!data.seasonFx;$('lrSpaceSeasonAi').checked=!!data.seasonAi;$('lrSpaceAtmosphere').value=data.atmosphere||'default';renderMemoryProgress();modal.classList.add('show');document.body.style.overflow='hidden';
  }
  function closeWorldSettings(){const m=$('lrSpaceSettings');if(m)m.classList.remove('show');document.body.style.overflow=''}
  function saveWorldSettings(){
    data.worldBookIds=[...document.querySelectorAll('#lrSpaceBookList input:checked')].map(x=>x.value);data.timeSense={enabled:!!$('lrSpaceTimeEnabled').checked,zone:$('lrSpaceTimeZone').value};data.season=$('lrSpaceSeason').value;data.seasonFx=!!$('lrSpaceSeasonFx').checked;data.seasonAi=!!$('lrSpaceSeasonAi').checked;data.atmosphere=$('lrSpaceAtmosphere').value;save();applySeasonFX();closeWorldSettings();toast('世界设置已保存');
  }
  function openWorldEditor(){const m=$('lrSpaceWorldEdit');if(!m)return;$('lrSpaceWorldName').value=data.worldTitle||data.worldNote||'我们的世界';$('lrSpaceWorldDescription').value=data.worldDescription||'';m.classList.add('show');document.body.style.overflow='hidden'}
  function closeWorldEditor(){const m=$('lrSpaceWorldEdit');if(m)m.classList.remove('show');document.body.style.overflow=''}
  function saveWorldEditor(){const name=$('lrSpaceWorldName').value.trim();if(!name){toast('请先填写世界名称。');return}data.worldTitle=name;data.worldNote=name;data.worldDescription=$('lrSpaceWorldDescription').value.trim();save();renderMap();closeWorldEditor();toast('世界名称已更新')}
  function openLocationEditor(id){const l=locationById(id);if(!l)return;const m=$('lrSpaceLocationEdit');if(!m)return;m.dataset.id=id;$('lrSpaceLocationName').value=l.name||'';$('lrSpaceLocationType').value=l.type||'';$('lrSpaceLocationPurpose').value=l.purpose||'';$('lrSpaceLocationDescription').value=l.description||'';$('lrSpaceLocationAtmosphere').value=l.atmosphere||'';$('lrSpaceLocationImage').value='';const preview=$('lrSpaceLocationPreview');preview.innerHTML=l.image?`<img src="${esc(l.image)}" alt="">`:'<span>上传地点图片</span>';m.classList.add('show');document.body.style.overflow='hidden'}
  function closeLocationEditor(){const m=$('lrSpaceLocationEdit');if(m)m.classList.remove('show');document.body.style.overflow=''}
  function saveLocationEditor(){const id=$('lrSpaceLocationEdit').dataset.id,l=locationById(id);if(!l)return;const name=$('lrSpaceLocationName').value.trim();if(!name){toast('地点名称不能为空。');return}l.name=name;l.type=$('lrSpaceLocationType').value.trim();l.purpose=$('lrSpaceLocationPurpose').value.trim();l.description=$('lrSpaceLocationDescription').value.trim();l.atmosphere=$('lrSpaceLocationAtmosphere').value.trim();const file=$('lrSpaceLocationImage').files?.[0];const finish=()=>{save();renderMap();renderCreatedList();closeLocationEditor();toast('地点已更新')};if(file){const reader=new FileReader();reader.onload=()=>{l.image=String(reader.result||'');finish()};reader.readAsDataURL(file)}else finish()}
  function deleteLocationEditor(){const id=$('lrSpaceLocationEdit').dataset.id;if(!id)return;if(!confirm('删除这个地点？'))return;data.locations=data.locations.filter(x=>x.id!==id);if(data.currentLocation===id)data.currentLocation=null;save();renderMap();renderCreatedList();closeLocationEditor();toast('地点已删除')}
  function worldNow(){const zone=data.timeSense?.enabled?data.timeSense.zone:'Asia/Kuala_Lumpur';try{return new Date(new Date().toLocaleString('en-US',{timeZone:zone}))}catch{return new Date()}}
  function addActivity(title,detail,opts={}){const entry={id:'act-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),at:Date.now(),title:String(title),detail:String(detail||''),kind:opts.kind||'daily',personId:opts.personId||'',locationId:opts.locationId||'',status:opts.status||'completed'};data.activityLog.push(entry);if(data.activityLog.length>1500)data.activityLog=data.activityLog.slice(-1500);return entry}
  function fmtTime(ts){try{return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:data.timeSense?.enabled?data.timeSense.zone:'Asia/Kuala_Lumpur'}).format(new Date(ts))}catch{return new Date(ts).toLocaleTimeString().slice(0,5)}}
  function simulateWorld(){const now=Date.now();if(!data.lastWorldTick){data.lastWorldTick=now;addActivity('世界已启动','世界时间线开始记录。',{kind:'system'});save();renderActivity();return}const from=data.lastWorldTick;const elapsed=now-from;if(elapsed<60*1000)return;const peopleList=selectedSummary();const hours=Math.min(24*30,Math.floor(elapsed/3600000));if(hours>0&&peopleList.length){const slots=[['早晨','开始新的一天，整理今天的安排。'],['上午','处理自己的日常事务。'],['午间','停下来休息，享用午餐。'],['下午','继续今天的工作、学习或个人计划。'],['傍晚','结束白天的安排，准备转换心情。'],['夜晚','回到自己的生活节奏，放松休息。']];const already=new Set(data.activityLog.filter(a=>a.at>from).map(a=>a.personId+'|'+new Date(a.at).toDateString()+'|'+a.title));for(let h=1;h<=Math.min(hours,72);h++){const ts=from+h*3600000;const d=new Date(ts);const slot=slots[Math.min(5,Math.floor(d.getHours()/4))];peopleList.forEach((p,i)=>{const key=p.id+'|'+d.toDateString()+'|'+slot[0];if(already.has(key))return;const home=data.locations.find(l=>/家|公寓|住宅|宿舍|居所/.test(l.name+' '+l.type));const loc=(data.locations.length?data.locations[(Math.floor(ts/3600000)+i)%data.locations.length]:null);const chosen=(d.getHours()<8||d.getHours()>=21)?(home||loc):loc;addActivity(slot[0]+' · '+p.name,slot[1]+(chosen?' 当前地点：'+chosen.name+'。':''),{kind:'routine',personId:p.id,locationId:chosen?.id||''});if(chosen){data.characterSchedule[p.id]={locationId:chosen.id,status:slot[0],updatedAt:ts}}});}}
    data.lastWorldTick=now;save();renderActivity();}
  function renderActivity(){const clock=$('lrSpaceClock'),weather=$('lrSpaceWeatherLine'),box=$('lrSpaceActivityTimeline');if(clock){const d=worldNow();clock.textContent=new Intl.DateTimeFormat('zh-CN',{weekday:'long',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:data.timeSense?.enabled?data.timeSense.zone:'Asia/Kuala_Lumpur'}).format(d)}if(weather)weather.textContent=(data.season&&data.season!=='none'?({spring:'春日花开',summer:'夏日光影',autumn:'秋叶轻落',winter:'冬日飘雪'}[data.season]||''): '世界时间持续推进')+' · '+(data.locations.length+' 个地点');if(box){const entries=[...data.activityLog].sort((a,b)=>b.at-a.at).slice(0,8);box.innerHTML=entries.length?entries.map(a=>`<div class="lr-space-activity"><time>${esc(fmtTime(a.at))}</time><div><b>${esc(a.title)}</b><p>${esc(a.detail)}${a.status==='pending'?'（待决定）':''}</p></div></div>`).join(''):'<div class="lr-space-activity"><time>NOW</time><div><b>世界正在等待第一段生活</b><p>进入地点或更新世界，活动会出现在这里。</p></div></div>'}renderInvites()}
  function renderInvites(){const box=$('lrSpaceInvites');if(!box)return;const pending=data.invites.filter(x=>x.status==='pending');box.innerHTML=pending.slice(0,3).map(x=>`<div class="lr-space-invite"><b>${esc(x.title)}</b><p>${esc(x.detail)}</p><div class="lr-space-life-actions"><button class="lr-space-primary" data-invite-action="accept" data-invite-id="${esc(x.id)}">接受</button><button class="lr-space-secondary" data-invite-action="decline" data-invite-id="${esc(x.id)}">暂不参加</button></div></div>`).join('')}
  function makeInvite(){const peopleList=selectedSummary();if(!peopleList.length){toast('先选择同行者，再创建活动邀请。');return}const who=peopleList[0],loc=data.locations[0];const title=who.name+' 邀请你一起'+(loc?'去'+loc.name+'看看':'度过一点时间');const inv={id:'inv-'+Date.now(),title,detail:'这是一个活动提案。你可以接受或暂不参加；未回应不会自动视为接受。',status:'pending',createdAt:Date.now(),locationId:loc?.id||'',personId:who.id};data.invites.unshift(inv);addActivity('收到活动邀请',title,{kind:'invite',personId:who.id,locationId:loc?.id||'',status:'pending'});save();renderActivity();toast('活动邀请已创建。')}
  function showPeopleDynamics(){
    const modal=$('lrSpaceActivityModal'),list=$('lrSpaceActivityList');if(!modal||!list)return;
    $('lrSpaceActivityTitle').textContent='角色动态';$('lrSpaceActivityKicker').textContent='CHARACTER MOMENTS';$('lrSpaceActivitySubtitle').textContent='看看大家此刻的日常。';
    const peopleList=selectedSummary();
    const verbs=['正在散步','正在吃饭','正在逛街','正在工作','正在休息','正在看书','正在喝咖啡','正在回家的路上'];
    const now=Date.now();
    if(!peopleList.length){list.innerHTML='<div class="lr-space-review-empty"><div style="font-size:28px;margin-bottom:10px">✧</div><b>还没有角色动态</b><p>先选择角色并进入空间，大家的日常就会出现在这里。</p></div>';}
    else {
      list.innerHTML=peopleList.map((p,i)=>{
        const schedule=data.characterSchedule?.[p.id]||{};
        const place=data.locations.find(l=>l.id===schedule.locationId);
        const old=data.activityLog.filter(a=>a.personId===p.id).sort((a,b)=>b.at-a.at)[0];
        const status= schedule.status && schedule.updatedAt && now-schedule.updatedAt<12*3600000 ? ({'早晨':'正在开始新的一天','上午':'正在处理日常事务','午间':'正在吃饭或休息','下午':'正在忙自己的事情','傍晚':'正在散步或逛街','夜晚':'正在休息'}[schedule.status]||schedule.status) : verbs[Math.floor((now/3600000+i*3)%verbs.length)];
        const location=place?.name|| (old?.locationId?locationById(old.locationId)?.name:'') || '在自己的日常里';
        return `<article class="lr-space-person-moment"><div class="lr-space-person-avatar">${esc((p.name||'?').slice(0,1))}</div><div class="lr-space-person-moment-copy"><div class="lr-space-person-moment-top"><b>${esc(p.name||'未命名角色')}</b><span class="lr-space-live-dot">此刻</span></div><div class="lr-space-person-status">${esc(status)}</div><div class="lr-space-person-place">⌁ ${esc(location)}</div></div><span class="lr-space-person-sparkle">✧</span></article>`;
      }).join('');
    }
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  }
  function showAllActivity(mode='all'){
    const modal=$('lrSpaceActivityModal'),list=$('lrSpaceActivityList');if(!modal||!list)return;
    const isPeople=mode==='people';const entries=[...data.activityLog].filter(a=>mode==='all'||(isPeople?!!a.personId:a.kind==='event'||a.kind==='invite'||a.kind==='system')).sort((a,b)=>b.at-a.at);
    $('lrSpaceActivityTitle').textContent=isPeople?'角色动态':'世界事件';$('lrSpaceActivityKicker').textContent=isPeople?'CHARACTER ACTIVITY':'WORLD EVENTS';$('lrSpaceActivitySubtitle').textContent=isPeople?'角色的日常、所在地点与活动记录':'世界里的重要变化、活动与事件记录';
    list.innerHTML=entries.length?entries.slice(0,100).map(a=>`<article class="lr-space-review-item"><div class="lr-space-review-meta"><span>${esc(fmtTime(a.at))}</span><span>${esc(locationById(a.locationId)?.name||'世界')}</span></div><b>${esc(a.title||'日常记录')}</b><div class="lr-space-review-text">${esc(a.detail||'暂时没有更多细节。')}</div></article>`).join(''):`<div class="lr-space-review-empty"><div style="font-size:28px;margin-bottom:10px">${isPeople?'✧':'❀'}</div><b>${isPeople?'还没有角色动态':'暂时没有世界事件'}</b><p>${isPeople?'更新世界后，角色的日常活动会整理在这里。':'创建活动或推进世界后，重要变化会显示在这里。'}</p></div>`;
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  }
  function closeActivityModal(){const m=$('lrSpaceActivityModal');if(m){m.classList.remove('show');m.setAttribute('aria-hidden','true')}}
  async function openStoryReview(){
    if(!historyStorageReady) await hydrateHistoryFromIDB();
    const modal=$('lrSpaceStoryReview'),list=$('lrSpaceReviewList');if(!modal||!list)return;
    const entries=[...(data.history||[])].sort((a,b)=>b.at-a.at);
    list.innerHTML=entries.length?entries.map((h,i)=>`<article class="lr-space-review-item"><div class="lr-space-review-meta"><span>${esc(fmtTime(h.at))}</span><span>${esc(h.place||'未知地点')}</span></div><b>第 ${entries.length-i} 段剧情</b><div class="lr-space-review-text">${esc(h.text||'')}</div><div class="lr-space-review-actions"><button class="lr-space-secondary lr-space-review-jump" type="button" data-review-jump="${esc(h.id)}">回到这段剧情</button><button class="lr-space-secondary" type="button" data-review-delete="${esc(h.id)}">删除记录</button></div></article>`).join(''):'<div class="lr-space-review-empty">这里还没有剧情记录。进入地点后，写下你的行动并发送，生成的剧情就会保存在这里。</div>';
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  }
  function jumpToHistory(id){
    const h=(data.history||[]).find(x=>x.id===id);if(!h)return;
    if(h.locationId&&locationById(h.locationId))data.currentLocation=h.locationId;
    else if(!data.currentLocation){toast('原地点已不存在，仍可查看记录，但无法在该地点继续。');}
    data.activeStoryThread=h.threadId||data.activeStoryThread||('thread-'+Date.now());save();
    const loc=locationById(data.currentLocation);
    $('lrSpaceCurrentPlaceTitle').textContent=loc?.name||h.place||'剧情回顾';
    $('lrSpaceStoryPlace').textContent=loc?.name||h.place||'';
    $('lrSpaceStoryTitle').textContent='';$('lrSpaceStoryMeta').textContent='';
    $('lrSpaceStoryBody').textContent=h.text||'';makeStoryActions(h.text||'');
    closeStoryReview();show('story');window.scrollTo({top:0,behavior:'smooth'});
  }
  function deleteHistoryEntry(id){
    const h=(data.history||[]).find(x=>x.id===id);if(!h)return;
    if(!confirm('确定删除这段剧情记录吗？删除后无法恢复。'))return;
    data.history=data.history.filter(x=>x.id!==id);if(historyStorageReady)deleteHistoryRecordFromIDB(id);
    data.memories=(data.memories||[]).filter(m=>!(m.at===h.at&&m.place===h.place&&String(m.text||'')===String(h.text||'').slice(0,1200)));
    save();openStoryReview();toast('这段剧情记录已删除。');
  }
  function closeStoryReview(){const modal=$('lrSpaceStoryReview');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}}
  function handleInviteAction(btn){const inv=data.invites.find(x=>x.id===btn.dataset.inviteId);if(!inv)return;inv.status=btn.dataset.inviteAction==='accept'?'accepted':'declined';inv.respondedAt=Date.now();addActivity(inv.status==='accepted'?'已接受邀请':'暂不参加邀请',inv.title,{kind:'invite',personId:inv.personId,locationId:inv.locationId,status:inv.status});save();renderActivity();toast(inv.status==='accepted'?'已接受邀请。':'已记录你的选择。')}
  function renderMap(){
    const box=$('lrSpaceMapLocations');if(!box)return;const list=data.locations||[];
    if(!list.length){box.innerHTML='<div class="lr-space-empty-map"><div><b>这座城市还是空白的</b><div>先创建一个地点，让空间有第一个故事发生。</div></div></div>';return}
    const positions=[[18,30],[50,25],[80,34],[30,58],[63,56],[18,79],[48,78],[78,76],[50,44]];
    box.innerHTML=list.map((l,i)=>{const pos=positions[i%positions.length];return `<button class="lr-space-location" style="left:${pos[0]}%;top:${pos[1]}%" data-space-location="${esc(l.id)}" type="button"><span class="lr-space-location-pin">${l.image?`<img src="${esc(l.image)}" alt="">`:esc(l.icon||'⌂')}</span><b>${esc(l.name)}</b><small>${esc(l.type||l.purpose||'地点')}</small></button>`}).join('');
    $('lrSpaceWorldTitle').textContent=data.worldTitle||data.worldNote||'我们的世界';applySeasonFX();renderActivity();
  }
  function renderCreatedList(){const box=$('lrSpaceCreatedList');if(!box)return;box.innerHTML=data.locations.length?data.locations.map(l=>`<span class="lr-space-location-tag">${esc(l.name)}</span>`).join(''):'<span style="color:#9a8d9d;font-size:11px">还没有自定义地点。</span>'}
  function selectedSummary(){return data.selectedPeople.map(person).filter(Boolean).map(p=>({id:p.id,name:p.name,role:p.role,personality:p.personality,background:p.background,speech:p.speech,instructions:p.instructions}));}
  function locationById(id){return data.locations.find(x=>x.id===id)}
  async function createLocation(){
    if(busy)return;const prompt=String($('lrSpaceCreatePrompt')?.value||'').trim();if(!prompt){toast('先告诉我你想创建什么地点。');return}
    const system=`你是 LOVE RECORD 的空间世界设计师。根据用户想法创建一个可用于持续剧情的虚拟地点。只返回 JSON，不要 Markdown。字段：name,type,purpose,description,atmosphere,storyHooks,icon。icon 只允许一个简单字符，不要 emoji。不要加入任何用户未提供的真实人物姓名。`;
    const out=await callAPI(system,JSON.stringify({idea:prompt,world:worldContext(),people:selectedSummary()}));if(!out)return;
    try{const clean=out.replace(/^```json\s*|^```|```$/g,'').trim();const j=JSON.parse(clean);const loc={id:'loc-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:String(j.name||'未命名地点'),type:String(j.type||'地点'),purpose:String(j.purpose||''),description:String(j.description||''),atmosphere:String(j.atmosphere||''),storyHooks:Array.isArray(j.storyHooks)?j.storyHooks:[],icon:String(j.icon||'⌂').slice(0,2)};data.locations.push(loc);save();$('lrSpaceCreatePrompt').value='';renderMap();renderCreatedList();show('map');toast('地点已加入空间地图。')}catch(e){toast('AI 返回的地点资料格式不正确，请再试一次。')}
  }
  function enterLocation(id){
    const loc=locationById(id);if(!loc)return;
    data.currentLocation=id;
    if(!data.activeStoryThread)data.activeStoryThread='thread-'+Date.now();
    save();show('story');
    $('lrSpaceStoryPlace').textContent=loc.name;
    $('lrSpaceCurrentPlaceTitle').textContent=loc.name;
    $('lrSpaceStoryTitle').textContent='';$('lrSpaceStoryMeta').textContent='';
    const previous=[...(data.history||[])].reverse().find(h=>h.locationId===id||h.place===loc.name);
    $('lrSpaceStoryBody').textContent=previous?previous.text:'这里还没有开始剧情。写下你想说的话或想做的事，再点击「继续」，AI 才会生成新的剧情。';
    $('lrSpaceStoryActions').innerHTML='';
    if(previous)makeStoryActions(previous.text);
  }
  function makeStoryActions(text){$('lrSpaceStoryActions').innerHTML='';const defaults=['继续观察眼前发生的事情','回应同行的人','做一个和当前地点有关的小行动'];defaults.forEach(t=>{const b=document.createElement('button');b.className='lr-space-secondary';b.type='button';b.textContent=t;b.onclick=()=>continueStory(t);$('lrSpaceStoryActions').appendChild(b)});}
  async function continueStory(action){if(busy)return;const loc=locationById(data.currentLocation);if(!loc)return;const thread=data.activeStoryThread||('thread-'+Date.now());data.activeStoryThread=thread;const system=`你是 LOVE RECORD【空间】的剧情导演。继续当前跨地点连续剧情。只写新的剧情正文，不复述旧剧情。不要替用户决定行动、台词、思想或情绪；用户的行动只有在输入明确后才发生。同行人物可以自然回应。严格遵循已保存的事实与约定，跨地点保持连续性。`;
    const me=data.memoryEngine||{};const relevantCards=(me.cards||[]).filter(m=>!m.archived).filter(m=>(m.locationIds||[]).includes(loc.id)||(m.characterIds||[]).some(id=>data.selectedPeople.includes(id))||(m.threadIds||[]).includes(thread)).slice(-12).map(m=>({type:m.type,title:m.title,content:m.content,status:m.status}));const recent=data.history.slice(-8).map(h=>({at:h.at,place:h.place,userAction:h.userAction||'',text:h.text,threadId:h.threadId}));const user=JSON.stringify({world:worldContext(),location:loc,people:selectedSummary(),recent,storySummary:(me.summaries||[]).slice(-3).map(x=>x.summary),currentWorldState:me.currentState||'',relevantLongTermMemories:relevantCards,userAction:action});const out=await callAPI(system,user);if(out){await appendHistory(loc.name,out,action);$('lrSpaceStoryBody').textContent=out;makeStoryActions(out)}}
  async function sendStory(){const input=$('lrSpaceStoryInput');const t=String(input?.value||'').trim();if(!t||busy)return;if(input)input.value='';await continueStory(t)}
  async function appendHistory(place,text,userAction=''){
    const me=data.memoryEngine||(data.memoryEngine={batchSize:10,completedThrough:0,batches:[],summaries:[],diaryEntries:[],cards:[],currentState:'',lastSuccessAt:0,autoEnabled:true,nextSequence:1,health:{lastCheckedAt:0,issues:[]}});
    const seq=Math.max(Number(me.nextSequence)||1,...data.history.map(h=>Number(h.seq)||0).map(n=>n+1));const item={id:'h-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),seq,place,text:String(text),userAction:String(userAction||''),at:Date.now(),locationId:data.currentLocation,threadId:data.activeStoryThread||('thread-'+Date.now())};me.nextSequence=seq+1;if(!data.activeStoryThread)data.activeStoryThread=item.threadId;data.history.push(item);
    addActivity('地点剧情 · '+place,String(text).slice(0,260),{kind:'story',locationId:data.currentLocation});if(historyStorageReady)await persistHistoryRecord(item);save();renderActivity();renderMemoryProgress();if(me.autoEnabled)maybeRunMemorySummary();
  }

  const normalizeMemoryText=v=>String(v||'').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'').slice(0,180);
  function pendingHistory(){const me=data.memoryEngine;return data.history.filter(h=>(Number(h.seq)||0)>(Number(me.completedThrough)||0)).sort((a,b)=>(a.seq||0)-(b.seq||0))}
  function renderMemoryProgress(){const me=data.memoryEngine||{},pending=pendingHistory();const status=$('lrSpaceMemoryStatus'),progress=$('lrSpaceMemoryProgress');if(status)status.textContent='自动总结：每 10 条有效剧情记录 · '+(me.autoEnabled===false?'已暂停':'已开启');if(progress){const batch=me.batches?.find(b=>b.status!=='completed');progress.textContent='待整理 '+pending.length+' 条 · 已完成 '+(me.summaries||[]).length+' 批 · '+(batch?('当前状态：'+({pending:'待总结',running:'总结中',retrying:'重试中',ready_to_commit:'待保存',failed:'等待重试',completed:'已完成'}[batch.status]||batch.status)):'当前没有未完成批次')+(me.lastSuccessAt?' · 上次成功 '+fmtDateTime(me.lastSuccessAt):'');}}
  function fmtDateTime(ts){try{return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:data.timeSense?.enabled?data.timeSense.zone:'Asia/Kuala_Lumpur'}).format(new Date(ts))}catch{return new Date(ts).toLocaleString()}}
  function stableBatchId(ids){return 'batch-'+ids.join('-')}
  function maybeRunMemorySummary(force=false){if(memorySummaryRunning)return;const me=data.memoryEngine;if(!me||me.autoEnabled===false&&!force)return;const pending=pendingHistory();let batch=me.batches.find(b=>b.status!=='completed'&&b.status!=='cancelled');if(!batch){if(pending.length<10&&!force)return;const selected=pending.slice(0,10);if(!selected.length)return;batch={id:stableBatchId(selected.map(h=>h.id)),recordIds:selected.map(h=>h.id),startSeq:selected[0].seq,endSeq:selected[selected.length-1].seq,status:'pending',attempts:0,createdAt:Date.now(),result:null,lastError:''};me.batches.push(batch);save()}processMemoryBatch(batch.id)}
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function processMemoryBatch(batchId){if(memorySummaryRunning)return;const me=data.memoryEngine,batch=me?.batches?.find(b=>b.id===batchId);if(!batch||batch.status==='completed'||batch.status==='cancelled')return;memorySummaryRunning=true;try{
      const records=batch.recordIds.map(id=>data.history.find(h=>h.id===id)).filter(Boolean);if(!records.length){batch.status='failed';batch.lastError='批次引用的原始剧情不存在';save();return}
      if(batch.result){batch.status='ready_to_commit';save();commitMemoryBatch(batch,records);return}
      const delays=[2000,5000,15000];let result=null,lastError='';
      for(let attempt=0;attempt<3;attempt++){batch.status=attempt?'retrying':'running';batch.attempts=attempt+1;save();
        const system=`你是 LOVE RECORD Space 的长期记忆整理引擎。输入是按时间顺序排列的已发生剧情记录。只能依据输入，不得捏造事实；区分事实、角色感受、关系变化、已完成事件和未完成约定。跨地点保持同一剧情线连续。输出严格 JSON，不要 Markdown，结构为：{"plotSummary":"本批剧情摘要，按顺序概括地点移动、关键互动、结果与未完剧情","currentState":"本批完成后的世界/剧情当前状态，明确未完成事项","diaryEntries":[{"characterName":"角色名或空字符串","title":"日记标题","content":"基于记录的角色视角日记，不得虚构角色未表达的内心事实"}],"memories":[{"type":"fact|emotion|relationship|commitment|shared","title":"简洁标题","content":"记忆内容","sourceRecordIds":["输入中的原始记录 ID"],"characterNames":["参与角色名"],"locationNames":["地点名"],"emotion":"有依据的情感摘要或空字符串","status":"active|pending|completed","tags":["标签"]}],"commitments":[{"title":"约定标题","content":"约定内容","status":"pending|scheduled|completed|cancelled|uncertain","dueHint":"时间提示或空字符串","characterNames":["角色名"]}]}。避免重复记忆；如果没有可靠内容，使用空数组。不要把用户未选择的行动写成已发生。`;
        const user=JSON.stringify({worldName:data.worldTitle||data.worldNote,previousWorldState:me.currentState||'',previousSummaries:(me.summaries||[]).slice(-3).map(x=>x.summary),previousMemories:(me.cards||[]).map(m=>({type:m.type,title:m.title,content:m.content,status:m.status,userEdited:!!m.userEdited})).slice(-80),records:records.map(h=>({id:h.id,seq:h.seq,at:h.at,place:h.place,locationId:h.locationId,threadId:h.threadId,userAction:h.userAction||'',text:h.text}))});
        const out=await callAPI(system,user,'正在整理长期记忆…');if(out){try{const clean=out.replace(/^```json\s*|^```|```$/g,'').trim();const parsed=JSON.parse(clean);if(!parsed||typeof parsed.plotSummary!=='string'||!Array.isArray(parsed.memories)||!Array.isArray(parsed.diaryEntries)||!Array.isArray(parsed.commitments))throw new Error('总结结果字段不完整');result=parsed;break}catch(e){lastError='总结格式校验失败：'+e.message}}else{lastError='API 请求失败'}
        if(attempt<2)await wait(delays[attempt]);
      }
      if(!result){batch.status='failed';batch.lastError=lastError||'总结失败';batch.failedAt=Date.now();save();renderMemoryProgress();toast('记忆总结失败，原始剧情已保留。你可以稍后在记忆档案中重试。');return}
      batch.result=result;batch.status='ready_to_commit';batch.generatedAt=Date.now();save();commitMemoryBatch(batch,records);
    }catch(e){batch.status='failed';batch.lastError=String(e?.message||e);save();renderMemoryProgress();toast('记忆整理遇到问题，原始剧情没有删除。')}finally{memorySummaryRunning=false;renderMemoryProgress();if(pendingHistory().length>=10&&data.memoryEngine?.autoEnabled!==false){const next=data.memoryEngine.batches.find(b=>b.status!=='completed'&&b.status!=='cancelled');if(!next)maybeRunMemorySummary()}}}
  function commitMemoryBatch(batch,records){const me=data.memoryEngine,result=batch.result;if(!result)return;const sourceIds=records.map(h=>h.id),locations=[...new Set(records.map(h=>h.place).filter(Boolean))],locationIds=[...new Set(records.map(h=>h.locationId).filter(Boolean))],threadIds=[...new Set(records.map(h=>h.threadId).filter(Boolean))];
    const summary={id:'summary-'+batch.id,batchId:batch.id,fromSeq:batch.startSeq,toSeq:batch.endSeq,sourceRecordIds:sourceIds,summary:String(result.plotSummary||''),currentState:String(result.currentState||''),at:Date.now(),locations,locationIds,threadIds};const si=me.summaries.findIndex(x=>x.batchId===batch.id);if(si>=0)me.summaries[si]=summary;else me.summaries.push(summary);me.currentState=summary.currentState||me.currentState;
    (Array.isArray(result.diaryEntries)?result.diaryEntries:[]).forEach((d,i)=>{const id='diary-'+batch.id+'-'+i,entry={id,batchId:batch.id,characterName:String(d.characterName||''),title:String(d.title||'生活日记'),content:String(d.content||''),sourceRecordIds:sourceIds,locationNames:locations,locationIds,threadIds,at:Date.now()};const ix=me.diaryEntries.findIndex(x=>x.id===id);if(ix>=0)me.diaryEntries[ix]=entry;else me.diaryEntries.push(entry)});
    const addOrMerge=(raw,typeOverride)=>{const type=typeOverride||String(raw.type||'shared');const title=String(raw.title||'未命名记忆').trim();const key=normalizeMemoryText(type+'-'+title);const content=String(raw.content||'').trim();if(!content)return;let existing=me.cards.find(m=>m.dedupeKey===key);const scopedIds=Array.isArray(raw.sourceRecordIds)?raw.sourceRecordIds.filter(id=>sourceIds.includes(id)):[];const memorySourceIds=scopedIds.length?scopedIds:sourceIds;const sourceRecords=records.filter(h=>memorySourceIds.includes(h.id));const memoryLocations=[...new Set(sourceRecords.map(h=>h.place).filter(Boolean))];const memoryLocationIds=[...new Set(sourceRecords.map(h=>h.locationId).filter(Boolean))];const memoryThreadIds=[...new Set(sourceRecords.map(h=>h.threadId).filter(Boolean))];const charIds=(raw.characterNames||[]).map(n=>people().find(p=>p.name===n)?.id).filter(Boolean);const locNames=[...new Set([...(raw.locationNames||[]),...memoryLocations])];const locIds=[...new Set([...memoryLocationIds,...data.locations.filter(l=>locNames.includes(l.name)).map(l=>l.id)])];if(existing){existing.sourceRecordIds=[...new Set([...(existing.sourceRecordIds||[]),...memorySourceIds])];existing.locationNames=[...new Set([...(existing.locationNames||[]),...locNames])];existing.locationIds=[...new Set([...(existing.locationIds||[]),...locIds])];existing.threadIds=[...new Set([...(existing.threadIds||[]),...memoryThreadIds])];existing.characterIds=[...new Set([...(existing.characterIds||[]),...charIds])];existing.tags=[...new Set([...(existing.tags||[]),...(raw.tags||[])])];if(!existing.userEdited)existing.content=content;if(raw.status)existing.status=String(raw.status);if(raw.emotion)existing.emotion=String(raw.emotion);existing.updatedAt=Date.now();}else{me.cards.push({id:'mem-'+batch.id+'-'+key,dedupeKey:key,type,title,content,characterNames:raw.characterNames||[],characterIds:charIds,locationNames:locNames,locationIds:locIds,threadIds:memoryThreadIds,sourceRecordIds:memorySourceIds,emotion:String(raw.emotion||''),status:String(raw.status||'active'),tags:Array.isArray(raw.tags)?raw.tags:[],createdAt:Date.now(),updatedAt:Date.now(),userEdited:false})}};
    (Array.isArray(result.memories)?result.memories:[]).forEach(m=>addOrMerge(m));(Array.isArray(result.commitments)?result.commitments:[]).forEach(c=>addOrMerge({...c,type:'commitment',tags:['约定与计划']},'commitment'));
    batch.status='completed';batch.completedAt=Date.now();batch.lastError='';me.completedThrough=Math.max(Number(me.completedThrough)||0,Number(batch.endSeq)||0);me.lastSuccessAt=Date.now();me.health=me.health||{lastCheckedAt:0,issues:[]};save();renderMemoryProgress();if($('lrSpaceMemoryArchive')?.classList.contains('show'))renderMemoryArchive();toast('已完成一批记忆整理：剧情摘要与长期记忆均已保存。');
  }
  let growthTab='pets';
  function openGrowthGarden(tab='pets'){const modal=$('lrSpaceGrowthGarden');if(!modal)return;growthTab=tab;modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderGrowthGarden()}
  function closeGrowthGarden(){const modal=$('lrSpaceGrowthGarden');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}document.body.style.overflow=''}
  function renderGrowthGarden(){
    const box=$('lrSpaceGrowthContent'),tabs=$('lrSpaceGrowthTabs');if(!box||!tabs)return;
    tabs.querySelectorAll('[data-growth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.growthTab===growthTab));
    const g=data.growthGarden||(data.growthGarden={pets:[],children:[],diary:[]});const items=g[growthTab]||[];const isDiary=growthTab==='diary';
    const addLabel=isDiary?'＋ 记录成长瞬间':growthTab==='pets'?'＋ 添加一位萌宠':'＋ 添加家庭中的孩子';
    let html=`<button class="lr-space-growth-add" id="lrSpaceGrowthAdd" type="button">${addLabel}</button><div id="lrSpaceGrowthFormHost"></div>`;
    if(!items.length)html+=`<div class="lr-space-growth-empty"><div style="font-size:30px;margin-bottom:8px">${isDiary?'📔':growthTab==='pets'?'🐾':'🌱'}</div><b>${isDiary?'把第一次和每一个小进步记下来':growthTab==='pets'?'给家里的小可爱建一份档案':'建立一份成长档案'}</b><p>${isDiary?'第一次见面、第一次撒娇、第一次学会新本领，都值得被记住。':growthTab==='pets'?'记录名字、性格、喜好和日常照料。':'记录成长阶段、性格变化与珍贵日常。'}</p><small>内容保存在当前设备的 Space 中。</small></div>`;
    else html+=items.slice().reverse().map(x=>`<article class="lr-space-growth-item" ${!isDiary?`data-growth-open="${esc(x.id||'')}"`:''}><div class="lr-space-growth-avatar">${esc(x.emoji||(isDiary?'📖':growthTab==='pets'?'🐾':'🧸'))}</div><div class="lr-space-growth-item-copy"><h4>${esc(x.name||x.title||'成长记录')}</h4><p>${esc(x.note||x.content||'还没有添加描述。')}</p><small>${esc(x.stage||x.kind||(isDiary?'成长日记':growthTab==='pets'?'萌宠档案':'成长档案'))}${x.date?' · '+esc(x.date):''}</small><div class="lr-space-growth-item-actions">${!isDiary?'<span style="font-size:12px;color:#a184a0;margin-right:8px">查看档案与自定义 ›</span>':''}<button type="button" data-growth-delete="${esc(x.id||'') }" class="lr-space-growth-delete">删除记录</button></div></div></article>`).join('');
    box.innerHTML=html;const add=$('lrSpaceGrowthAdd');if(add)add.onclick=()=>showGrowthForm();
  }
  function openGrowthDetail(id){
    const g=data.growthGarden||(data.growthGarden={pets:[],children:[],diary:[]});
    const arr=g[growthTab]||[];const item=arr.find(x=>String(x.id||'')===String(id));if(!item)return;
    const box=$('lrSpaceGrowthContent');if(!box)return;
    const isPet=growthTab==='pets';const title=isPet?'萌宠档案':'成长档案';
    const defaults={skin:item.skin||'自然肤色',outfit:item.outfit||'日常休闲',stage:item.stage||(isPet?'幼年期':'幼儿期'),personality:item.personality||'',likes:item.likes||''};
    box.innerHTML=`<button class="lr-space-pet-back" id="lrSpaceGrowthBack" type="button">← 返回成长乐园</button><div class="lr-space-pet-detail">
      <div class="lr-space-pet-hero"><div class="lr-space-growth-avatar">${esc(item.emoji||(isPet?'🐾':'🧸'))}</div><div><h3>${esc(item.name||title)}</h3><p>${title} · 可自定义档案</p></div></div>
      <div class="lr-space-pet-section"><h4>基础信息</h4><div class="lr-space-pet-fields">
      <div><label>昵称</label><input id="lrPetName" maxlength="60" value="${esc(item.name||'')}"></div>
      <div><label>${isPet?'宠物类型 / 阶段':'成长阶段'}</label><input id="lrPetStage" maxlength="60" value="${esc(defaults.stage)}"></div>
      <div><label>外观 / 肤色</label><select id="lrPetSkin">${['自然肤色','白皙','小麦色','健康肤色','奶油色毛发','橘色毛发','自定义'].map(v=>`<option ${defaults.skin===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div><label>穿搭 / 配饰</label><select id="lrPetOutfit">${['日常休闲','可爱连衣裙','居家睡衣','户外运动','小围巾','蝴蝶结','自定义'].map(v=>`<option ${defaults.outfit===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div><label>性格</label><input id="lrPetPersonality" maxlength="120" value="${esc(defaults.personality)}" placeholder="例如：黏人、活泼、慢热"></div>
      <div><label>喜欢的东西</label><input id="lrPetLikes" maxlength="120" value="${esc(defaults.likes)}" placeholder="例如：晒太阳、玩球"></div></div></div>
      <div class="lr-space-pet-section"><h4>${isPet?'日常照料':'育儿记录'}</h4><p style="margin:0 0 12px;color:#927d91;font-size:13px">${isPet?'把性格、喜好、外观与照料习惯收进同一份萌宠档案。':'自定义成长阶段、肤色与穿搭，并持续记录孩子的变化。'}</p><label style="display:block;font-size:12px;color:#967f93;margin-bottom:6px">备注 / 照料与成长记录</label><textarea id="lrPetNote" class="lr-space-textarea" maxlength="1200">${esc(item.note||item.content||'')}</textarea><div class="lr-space-pet-actions"><button class="lr-space-primary" id="lrPetSave" type="button">保存档案</button></div></div></div>`;
    $('lrSpaceGrowthBack').onclick=renderGrowthGarden;
    $('lrPetSave').onclick=()=>{item.name=$('lrPetName').value.trim()||item.name;item.stage=$('lrPetStage').value.trim();item.skin=$('lrPetSkin').value;item.outfit=$('lrPetOutfit').value;item.personality=$('lrPetPersonality').value.trim();item.likes=$('lrPetLikes').value.trim();item.note=$('lrPetNote').value.trim();item.content=item.note;save();renderGrowthGarden();toast('档案已保存。')};
  }
  function showGrowthForm(){const host=$('lrSpaceGrowthFormHost');if(!host)return;const diary=growthTab==='diary';host.innerHTML=`<div class="lr-space-growth-form"><label>${diary?'记录标题':'名字'}</label><input id="lrGrowthName" class="lr-space-input" maxlength="60" placeholder="${diary?'例如：第一次学会握手':'给这个小家伙取个名字'}"><label>${diary?'发生了什么？':(growthTab==='pets'?'宠物类型 / 性格':'成长阶段 / 性格')}</label><textarea id="lrGrowthNote" class="lr-space-textarea" maxlength="1200" placeholder="写下想记住的小细节…"></textarea>${diary?'':'<label>代表表情</label><select id="lrGrowthEmoji" class="lr-space-select"><option value="🐾">🐾 萌宠</option><option value="🐱">🐱 猫咪</option><option value="🐶">🐶 狗狗</option><option value="🐰">🐰 兔兔</option><option value="🧸">🧸 孩子</option><option value="🌷">🌷 其他</option></select>'}<button id="lrSpaceGrowthSave" class="lr-space-primary" type="button">保存记录</button></div>`;const saveBtn=$('lrSpaceGrowthSave');if(saveBtn)saveBtn.onclick=()=>{const name=$('lrGrowthName')?.value.trim(),note=$('lrGrowthNote')?.value.trim();if(!name){toast('先给这份记录起个名字吧。');return}const g=data.growthGarden||(data.growthGarden={pets:[],children:[],diary:[]});const arr=g[growthTab]||(g[growthTab]=[]);arr.push({id:'growth-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name,title:name,note,content:note,emoji:diary?'📖':($('lrGrowthEmoji')?.value||'🐾'),stage:diary?'成长日记':growthTab==='pets'?'萌宠档案':'成长档案',date:new Date().toLocaleDateString('zh-CN'),createdAt:Date.now()});save();renderGrowthGarden();toast('已收藏这段小小的成长。')}}
  function openMemoryArchive(tab='cards'){const modal=$('lrSpaceMemoryArchive');if(!modal)return;modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderMemoryArchive(tab)}
  function closeMemoryArchive(){const modal=$('lrSpaceMemoryArchive');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}document.body.style.overflow=''}
  function renderMemoryArchive(tab){const content=$('lrSpaceMemoryContent'),tabs=$('lrSpaceMemoryTabs');if(!content||!tabs)return;if(tab)tabs.dataset.active=tab;tab=tabs.dataset.active||'cards';tabs.querySelectorAll('[data-memory-tab]').forEach(b=>b.classList.toggle('active',b.dataset.memoryTab===tab));const me=data.memoryEngine||{};let items=[],empty='这里还没有内容。随着剧情推进，记忆会自动整理到这里。';
    if(tab==='cards'){items=(me.cards||[]).slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));content.innerHTML=items.length?items.map(m=>`<article class="lr-space-memory-card"><h4>${esc(m.title)} <span style="font-size:10px;color:#b0809c;font-weight:400">${esc(({fact:'事实',emotion:'情感',relationship:'关系',commitment:'约定',shared:'共同回忆'}[m.type]||m.type))}</span></h4><p>${esc(m.content)}</p><div class="lr-space-memory-meta"><span>${esc((m.locationNames||[]).join(' · ')||'世界记忆')}</span><span>${esc(m.status||'active')}</span><span>来源 ${m.sourceRecordIds?.length||0} 条剧情</span></div><div class="lr-space-memory-actions"><button type="button" data-memory-edit="${esc(m.id)}">编辑记忆</button><button type="button" data-memory-delete="${esc(m.id)}">删除记忆</button></div></article>`).join(''):`<div class="lr-space-memory-empty">${empty}<br>每 10 条有效剧情记录会生成一次长期记忆更新。</div>`;}
    else if(tab==='diary'){items=(me.diaryEntries||[]).slice().sort((a,b)=>b.at-a.at);content.innerHTML=items.length?items.map(d=>`<article class="lr-space-memory-card"><h4>${esc(d.title)} <span style="font-size:10px;color:#b0809c;font-weight:400">${esc(d.characterName||'世界日记')}</span></h4><p>${esc(d.content)}</p><div class="lr-space-memory-meta"><span>${esc((d.locationNames||[]).join(' · '))}</span><span>${esc(fmtDateTime(d.at))}</span></div></article>`).join(''):`<div class="lr-space-memory-empty">还没有角色日记。完成第一批自动总结后，这里就会出现基于剧情的日记。</div>`;}
    else if(tab==='summaries'){items=(me.summaries||[]).slice().sort((a,b)=>b.toSeq-a.toSeq);content.innerHTML=items.length?items.map(x=>`<article class="lr-space-memory-card"><h4>剧情摘要 · 记录 ${x.fromSeq}–${x.toSeq}</h4><p>${esc(x.summary)}</p><div class="lr-space-memory-meta"><span>${esc((x.locations||[]).join(' · '))}</span><span>${x.sourceRecordIds?.length||0} 条原始记录</span></div><p style="margin-top:9px"><b>当前状态：</b>${esc(x.currentState||'暂无')}</p></article>`).join(''):`<div class="lr-space-memory-empty">尚未生成剧情摘要。每累计 10 条新剧情记录后自动整理。</div>`;}
    else if(tab==='commitments'){items=(me.cards||[]).filter(m=>m.type==='commitment').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));content.innerHTML=items.length?items.map(m=>`<article class="lr-space-memory-card"><h4>${esc(m.title)}</h4><p>${esc(m.content)}</p><div class="lr-space-memory-meta"><span>状态：${esc(m.status||'pending')}</span><span>${esc((m.locationNames||[]).join(' · '))}</span></div></article>`).join(''):`<div class="lr-space-memory-empty">目前没有已整理的约定与计划。</div>`;}
    else {const issues=runMemoryHealthCheck(false);const pending=pendingHistory();const failed=(me.batches||[]).filter(b=>b.status==='failed');content.innerHTML=`<article class="lr-space-memory-card"><h4>记忆健康检查</h4><p>原始剧情：${data.history.length} 条；待整理：${pending.length} 条；已完成总结：${(me.summaries||[]).length} 批；长期记忆：${(me.cards||[]).length} 条；角色日记：${(me.diaryEntries||[]).length} 篇；失败批次：${failed.length} 个。</p><div class="lr-space-memory-meta"><span>最近检查：${me.health?.lastCheckedAt?esc(fmtDateTime(me.health.lastCheckedAt)):'尚未检查'}</span></div><p style="margin-top:8px">${issues.length?esc(issues.join('；')):'没有发现明显的索引或批次异常。'}</p><div class="lr-space-memory-setting-actions"><button id="lrSpaceMemoryRunHealthAgain" class="lr-space-secondary" type="button">重新检查</button><button id="lrSpaceMemoryRetry" class="lr-space-secondary" type="button">重试失败批次</button><button id="lrSpaceMemoryForceSummary" class="lr-space-secondary" type="button">整理待处理剧情</button></div></article>`;}
  }
  function editMemoryCard(id){const m=data.memoryEngine?.cards?.find(x=>x.id===id);if(!m)return;const title=prompt('编辑记忆标题',m.title||'');if(title===null)return;const content=prompt('编辑记忆内容',m.content||'');if(content===null)return;if(!title.trim()||!content.trim()){toast('标题和内容不能为空。');return}m.title=title.trim();m.content=content.trim();m.dedupeKey=normalizeMemoryText(m.type+'-'+m.title);m.userEdited=true;m.updatedAt=Date.now();save();renderMemoryArchive('cards');toast('记忆已更新；自动总结会保留你的手动修改。')}
  function deleteMemoryCard(id){const me=data.memoryEngine,m=me?.cards?.find(x=>x.id===id);if(!m)return;if(!confirm('确定删除这条长期记忆吗？原始剧情不会删除。'))return;me.cards=me.cards.filter(x=>x.id!==id);save();renderMemoryArchive('cards');toast('长期记忆已删除，原始剧情仍保留。')}
  function runMemoryHealthCheck(notify=true){const me=data.memoryEngine,issues=[];const ids=new Set();for(const h of data.history){if(ids.has(h.id))issues.push('发现重复的原始剧情 ID');ids.add(h.id);if(!Number.isFinite(Number(h.seq)))issues.push('有原始剧情缺少序号')}const batchIds=new Set();for(const b of me.batches||[]){if(batchIds.has(b.id))issues.push('发现重复总结批次');batchIds.add(b.id);if(b.status==='completed'&&!me.summaries.some(x=>x.batchId===b.id))issues.push('有已完成批次缺少剧情摘要')}for(const m of me.cards||[]){if((m.sourceRecordIds||[]).some(id=>!ids.has(id)))issues.push('有记忆引用已不存在的原始剧情')}me.health={lastCheckedAt:Date.now(),issues:[...new Set(issues)]};save();if(notify)toast(issues.length?'检查完成：发现 '+new Set(issues).size+' 项需要查看的问题。':'检查完成，没有发现明显问题。');return me.health.issues}
  async function retryFailedMemoryBatches(){const failed=(data.memoryEngine?.batches||[]).filter(b=>b.status==='failed');if(!failed.length){toast('目前没有失败的总结批次。');return}for(const b of failed){b.status=b.result?'ready_to_commit':'pending';b.lastError='';save();if(b.result){const records=b.recordIds.map(id=>data.history.find(h=>h.id===id)).filter(Boolean);commitMemoryBatch(b,records)}else await processMemoryBatch(b.id)}renderMemoryProgress();if($('lrSpaceMemoryArchive')?.classList.contains('show'))renderMemoryArchive('health')}
  function show(which){const ids={directory:'lrSpaceV2Directory',map:'lrSpaceV2Map',story:'lrSpaceV2Story',create:'lrSpaceCreate'};Object.entries(ids).forEach(([k,id])=>{const el=$(id);if(!el)return;el.hidden=k!==which;el.classList.toggle('is-current',k===which)});if(which==='create')renderCreatedList()}
  async function seedMap(){
    if(busy||data.locations.length)return;
    const system=`你是 LOVE RECORD【空间】的世界地图设计师。根据同行人物与用户已有世界设定，创建一个适合长期剧情的现代虚拟城市/区域地图。只返回 JSON，不要 Markdown。字段：worldName,worldDescription,locations。locations 是数组，生成 6 个地点，每项字段为 name,type,purpose,description,atmosphere,storyHooks,icon。地点之间要有明显差异，例如居住、餐饮、公共空间、自然空间、商业空间、安静空间。icon 只允许一个简单非 emoji 字符。不要加入任何具体人物姓名。`;
    const out=await callAPI(system,JSON.stringify({people:selectedSummary(),worldNote:data.worldNote||'',context:worldContext()}));
    if(!out)return;
    try{const clean=out.replace(/^```json\s*|^```|```$/g,'').trim();const j=JSON.parse(clean);data.worldNote=String(j.worldName||'我们的世界');data.worldTitle=data.worldNote;data.worldDescription=String(j.worldDescription||'');data.locations=(Array.isArray(j.locations)?j.locations:[]).slice(0,8).map((l,i)=>({id:'loc-'+Date.now()+'-'+i,name:String(l.name||('地点 '+(i+1))),type:String(l.type||'地点'),purpose:String(l.purpose||''),description:String(l.description||''),atmosphere:String(l.atmosphere||''),storyHooks:Array.isArray(l.storyHooks)?l.storyHooks:[],icon:String(l.icon||'⌂').slice(0,2)}));save();renderMap();toast('地图已经生成。选一个地方开始剧情。')}catch(e){toast('AI 返回的地图格式不正确，请再试一次。')}
  }
  async function enterMap(){if(!data.selectedPeople.length){toast('至少选择一位同行者。');return}save();$('lrSpaceMapMeta').textContent='同行者：'+data.selectedPeople.map(id=>person(id)?.name).filter(Boolean).join('、');show('map');simulateWorld();renderMap();applySeasonFX();renderMemoryProgress();const interrupted=data.memoryEngine?.batches?.find(b=>['pending','running','retrying','ready_to_commit'].includes(b.status));if(interrupted){if(interrupted.status==='ready_to_commit'&&interrupted.result){const records=interrupted.recordIds.map(id=>data.history.find(h=>h.id===id)).filter(Boolean);commitMemoryBatch(interrupted,records)}else if(interrupted.status!=='running'&&!memorySummaryRunning)processMemoryBatch(interrupted.id)}if(!data.locations.length)await seedMap()}
  function activateSpacePage(){
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    const target=$('space');
    if(!target)return false;
    target.classList.add('active');
    document.body.classList.remove('launcher-open');
    const dock=document.querySelector('.nav');if(dock)dock.style.display='none';
    const bar=$('systemAppbar');if(bar)bar.classList.add('show');
    const title=$('systemAppTitle');if(title)title.textContent='SPACE';
    window.scrollTo(0,0);
    return true;
  }
  async function open(){
    load();await hydrateHistoryFromIDB();installStyles();
    /* Do not call the legacy nav('space') here. The old Space renderer expects
       the removed legacy DOM (#place, #choices, etc.) and can throw before V2
       finishes opening. Activate the page shell directly instead. */
    activateSpacePage();
    replaceSpace();
    bindSpaceControls();
    // The directory is created dynamically, so render the real contacts immediately.
    // Without this call the new SPACE opens correctly but the people grid stays empty.
    renderPeople();
    show('directory');
    const intro=document.createElement('div');intro.className='lr-space-v2-intro';intro.id='lrSpaceIntro';
    intro.innerHTML='<div class="lr-space-v2-intro-inner"><div class="lr-space-v2-intro-mark"></div><div class="lr-space-v2-intro-title">SPACE</div><div class="lr-space-v2-intro-line"></div><div class="lr-space-v2-intro-sub">ENTER YOUR WORLD</div></div>';
    document.body.appendChild(intro);setTimeout(()=>intro.classList.add('hide'),1700);setTimeout(()=>intro.remove(),2400);
  }
  window.openLoveRecordSpaceV2=()=>{open()};
  function init(){
    load();installStyles();
    // Global capture-phase routing for the Space dashboard. This runs before legacy
    // document handlers and survives DOM replacement, unlike one-time element binding.
    if(!window.__lrSpaceGlobalTapRouter){
      window.__lrSpaceGlobalTapRouter=true;
      document.addEventListener('click',function(e){
        const card=e.target.closest?.('#lrSpaceOpenPeopleDynamics,#lrSpaceOpenGrowthGarden,#lrSpaceWorldRefresh');
        if(!card)return;
        e.preventDefault();e.stopImmediatePropagation();
        try{
          if(card.id==='lrSpaceOpenPeopleDynamics')showPeopleDynamics();
          else if(card.id==='lrSpaceOpenGrowthGarden')openGrowthGarden('pets');
          else if(card.id==='lrSpaceWorldRefresh'){simulateWorld();toast('世界动态已更新。');}
        }catch(err){console.error('[Space global tap router]',card.id,err);toast('暂时无法打开，请稍后再试。');}
      },true);
    }
    const launch=document.querySelector('[data-space-v2-launch]');if(launch){launch.querySelector('span:last-child')?.replaceChildren(document.createTextNode('空间'));launch.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.openLoveRecordSpaceV2();},{capture:true})}
    document.addEventListener('click',e=>{
      const p=e.target.closest?.('[data-space-person]');if(p){const id=p.dataset.spacePerson;data.selectedPeople=data.selectedPeople.includes(id)?data.selectedPeople.filter(x=>x!==id):[...data.selectedPeople,id];save();renderPeople();return}
      const l=e.target.closest?.('[data-space-location]');if(l){if(l.dataset.longPressed==='1'){l.dataset.longPressed='';return}enterLocation(l.dataset.spaceLocation);return}
    });
    document.addEventListener('pointerdown',e=>{const l=e.target.closest?.('[data-space-location]');if(!l)return;clearTimeout(l._lrHold);l._lrHold=setTimeout(()=>{l.dataset.longPressed='1';openLocationEditor(l.dataset.spaceLocation);if(navigator.vibrate)navigator.vibrate(18)},620)},{passive:true});
    document.addEventListener('pointerup',e=>{const l=e.target.closest?.('[data-space-location]');if(l)clearTimeout(l._lrHold)},{passive:true});
    document.addEventListener('pointercancel',e=>{const l=e.target.closest?.('[data-space-location]');if(l)clearTimeout(l._lrHold)},{passive:true});
    document.addEventListener('pointermove',e=>{const l=e.target.closest?.('[data-space-location]');if(l&&Math.abs(e.movementX)+Math.abs(e.movementY)>12)clearTimeout(l._lrHold)},{passive:true});
    document.addEventListener('click',e=>{
      if(e.target?.id==='lrSpaceActivityModal'){closeActivityModal();return}
      if(e.target?.id==='lrSpaceGrowthGarden'){closeGrowthGarden();return}
      const growthOpen=e.target.closest?.('[data-growth-open]');
      if(growthOpen&&!e.target.closest?.('[data-growth-delete]')){openGrowthDetail(growthOpen.dataset.growthOpen);return}
      const growthDelete=e.target.closest?.('[data-growth-delete]');
      if(growthDelete){const id=growthDelete.dataset.growthDelete;const arr=data.growthGarden?.[growthTab]||[];const idx=arr.findIndex(x=>String(x.id||'')===String(id));if(idx>=0){arr.splice(idx,1);save();renderGrowthGarden();toast('这条成长记录已删除。')}return}
      const memoryTab=e.target.closest?.('[data-memory-tab]');if(memoryTab){renderMemoryArchive(memoryTab.dataset.memoryTab);return}
      const memoryEdit=e.target.closest?.('[data-memory-edit]');if(memoryEdit){editMemoryCard(memoryEdit.dataset.memoryEdit);return}
      const memoryDelete=e.target.closest?.('[data-memory-delete]');if(memoryDelete){deleteMemoryCard(memoryDelete.dataset.memoryDelete);return}
      if(e.target?.id==='lrSpaceMemoryArchive'){closeMemoryArchive();return}
      const jump=e.target.closest?.('[data-review-jump]');
      if(jump){jumpToHistory(jump.dataset.reviewJump);return}
      const del=e.target.closest?.('[data-review-delete]');
      if(del){deleteHistoryEntry(del.dataset.reviewDelete);return}
      const el=e.target.closest?.('button,[role="button"],select');
      const id=el?.id||e.target.id;
      if(id==='lrSpaceEnter')enterMap();
      else if(id==='lrSpaceBackPeople'){show('directory');renderPeople()}
      else if(id==='lrSpaceBackMap')show('map');
      else if(id==='lrSpaceReviewStory')openStoryReview();
      else if(id==='lrSpaceReviewClose')closeStoryReview();
      else if(id==='lrSpaceActivityClose')closeActivityModal();
      else if(id==='lrSpaceCreateBtn')show('create');
      else if(id==='lrSpaceCreateBack')show('map');
      else if(id==='lrSpaceCreateSubmit')createLocation();
      else if(id==='lrSpaceWorldRefresh'){simulateWorld();toast('世界动态已更新。')}
      else if(id==='lrSpaceOpenMemories')openStoryReview();
      else if(id==='lrSpaceOpenGrowthGarden')openGrowthGarden('pets');
      else if(id==='lrSpaceGrowthClose')closeGrowthGarden();
      else if(el?.dataset?.growthTab){growthTab=el.dataset.growthTab;renderGrowthGarden()}
      else if(id==='lrSpaceOpenPeopleDynamics'){showAllActivity('people')}
      else if(id==='lrSpaceOpenEvents'){showAllActivity('events')}
      else if(id==='lrSpaceStorySend')sendStory();
      else if(id==='lrSpaceOpenMemoryArchive')openMemoryArchive('cards');
      else if(id==='lrSpaceMemoryClose')closeMemoryArchive();
      else if(id==='lrSpaceMemorySummarizeNow'||id==='lrSpaceMemoryForceSummary'){maybeRunMemorySummary(true);toast('已开始整理待处理剧情。');}
      else if(id==='lrSpaceMemoryHealthCheck'||id==='lrSpaceMemoryRunHealthAgain'){runMemoryHealthCheck(true);renderMemoryArchive('health');}
      else if(id==='lrSpaceMemoryRetry')retryFailedMemoryBatches();
      else if(id==='lrSpaceSettingsClose')closeWorldSettings();
      else if(id==='lrSpaceSettingsSave')saveWorldSettings();
      else if(id==='lrSpaceWorldEditClose')closeWorldEditor();
      else if(id==='lrSpaceWorldSave')saveWorldEditor();
      else if(id==='lrSpaceWorldTitleBtn')openWorldEditor();
      else if(id==='lrSpaceLocationEditClose')closeLocationEditor();
      else if(id==='lrSpaceLocationSave')saveLocationEditor();
      else if(id==='lrSpaceLocationDelete')deleteLocationEditor();
      else if(id==='systemAppbarAction'&&$('space')?.classList.contains('active'))openWorldSettings();
    });
    document.addEventListener('click',e=>{if(e.target?.id==='lrSpaceStoryReview')closeStoryReview();if(e.target?.id==='lrSpaceActivityModal')closeActivityModal()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeStoryReview();closeMemoryArchive()}});
    document.addEventListener('change',e=>{if(e.target?.id!=='lrSpaceLocationImage')return;const f=e.target.files?.[0],p=$('lrSpaceLocationPreview');if(f&&p){const r=new FileReader();r.onload=()=>p.innerHTML=`<img src="${esc(String(r.result||''))}" alt="">`;r.readAsDataURL(f)}});
    $('systemAppbarAction')?.addEventListener('click',()=>{if($('space')?.classList.contains('active'))openWorldSettings()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
