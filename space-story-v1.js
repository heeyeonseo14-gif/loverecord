/* LOVE RECORD · SPACE STORY ENGINE V1
   Long-form story workspace layered onto the existing pixel SPACE world.
   Home contacts, personas and world books remain the canonical profile sources.
*/
(()=>{
  'use strict';
  if(window.__LR_SPACE_STORY_V1__)return;
  window.__LR_SPACE_STORY_V1__=true;
  const $=id=>document.getElementById(id);
  const DB_NAME='love-record-space-story-engine-v1';
  const DB_VERSION=1;
  const META_STORE='stories';
  const ENTRY_STORE='storyEntries';
  let dbPromise=null;
  let activeStory=null;
  let activeEntries=[];
  let editingStoryId='';
  let generationBusy=false;
  let cancelRequested=false;
  let sourceEventsBound=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>JSON.parse(JSON.stringify(v??null));
  const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const countChars=s=>Array.from(String(s||'').replace(/\s/g,'')).length;
  const textLimit=(v,n=3000)=>String(v??'').trim().slice(0,n);
  function bridge(){return window.LRSpaceStoryBridge||null}
  function notify(message){const b=bridge();if(b?.toast)b.toast(message);else if(typeof window.toast==='function')window.toast(message);else alert(message)}
  function db(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('当前浏览器不支持 IndexedDB，无法安全保存长篇故事。'));return}
      let req;try{req=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){reject(e);return}
      req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(META_STORE))d.createObjectStore(META_STORE,{keyPath:'id'});if(!d.objectStoreNames.contains(ENTRY_STORE))d.createObjectStore(ENTRY_STORE,{keyPath:'id'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('故事数据库打开失败'));req.onblocked=()=>reject(new Error('故事数据库升级被其他 LOVE RECORD 页面阻挡，请关闭其他标签页后重试。'));
    }).catch(e=>{dbPromise=null;throw e});
    return dbPromise;
  }
  async function put(store,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error('保存失败'));tx.onabort=()=>reject(tx.error||new Error('保存已中断'))})}
  async function getAll(store){const d=await db();return new Promise((resolve,reject)=>{const req=d.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error('读取失败'))})}
  async function removeStoryRecords(storyId){const d=await db();const rows=await getAll(ENTRY_STORE);return new Promise((resolve,reject)=>{const tx=d.transaction([META_STORE,ENTRY_STORE],'readwrite');tx.objectStore(META_STORE).delete(storyId);const store=tx.objectStore(ENTRY_STORE);rows.filter(x=>x.storyId===storyId).forEach(x=>store.delete(x.id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('删除故事失败'));tx.onabort=()=>reject(tx.error||new Error('删除故事已中断'))})}
  async function loadStoryList(){const rows=await getAll(META_STORE);return rows.sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0))}
  async function loadStoryEntries(storyId){return (await getAll(ENTRY_STORE)).filter(x=>x.storyId===storyId).sort((a,b)=>(a.seq||0)-(b.seq||0)||(a.createdAt||0)-(b.createdAt||0))}
  async function saveMeta(story){story.updatedAt=Date.now();await put(META_STORE,story);return story}
  async function appendEntry(story,role,content,extra={}){
    const all=activeEntries.filter(x=>x.storyId===story.id);
    const entry={id:uid('entry'),storyId:story.id,branchId:story.activeBranchId||'main',seq:Math.max(0,...all.map(x=>Number(x.seq)||0))+1,role,content:String(content||''),createdAt:Date.now(),...extra};
    await put(ENTRY_STORE,entry);activeEntries.push(entry);return entry;
  }
  function contacts(){return bridge()?.getContacts?.()||[]}
  function personas(){return bridge()?.getSelfPersonas?.()||[]}
  function worldBooks(){return bridge()?.getWorldBooks?.()||[]}
  function getContact(id){return contacts().find(x=>String(x.id)===String(id))||null}
  function getPersona(id){return personas().find(x=>String(x.id)===String(id))||null}
  function getWorldBook(id){return worldBooks().find(x=>String(x.id)===String(id))||null}
  function snapshotContact(p){return {id:String(p.id),name:textLimit(p.name,100),role:textLimit(p.role,250),personality:textLimit(p.personality||p.persona,1800),appearance:textLimit(p.appearance,1200),speech:textLimit(p.speech,1200),background:textLimit(p.background,1800),instructions:textLimit(p.instructions,1200),avatar:String(p.avatar||p.image||''),sourceUpdatedAt:Number(p.updatedAt||p.updated_at||0)}}
  function snapshotPersona(p){return {id:String(p.id),name:textLimit(p.name,100),role:textLimit(p.role,250),personality:textLimit(p.personality,1800),appearance:textLimit(p.appearance,1200),speech:textLimit(p.speech,1200),background:textLimit(p.background,1800),sourceUpdatedAt:Number(p.updatedAt||p.updated_at||0)}}
  function snapshotWorldBook(w){const entries=Array.isArray(w.entries)?w.entries.map((e,i)=>({id:String(e.id||('entry-'+i)),note:textLimit(e.note,180),content:textLimit(e.content,5000)})):[];return {id:String(w.id),name:textLimit(w.name,120),description:textLimit(w.description,5000),locations:textLimit(Array.isArray(w.locations)?w.locations.join('、'):w.locations,2000),rules:textLimit(w.rules,3000),entries,sourceUpdatedAt:Number(w.updatedAt||w.updated_at||0)}}
  function flatWorldBook(w){const entryText=(w.entries||[]).map(e=>[e.note,e.content].filter(Boolean).join('：')).filter(Boolean);return [w.name?`【${w.name}】`:'',w.description||'',w.locations||'',w.rules||'',...entryText].filter(Boolean).join('\n')}
  function currentRefs(story){const chars=(story.characters||[]).map(ref=>({ref,live:getContact(ref.id)}));const persona=story.personaRef?.id?getPersona(story.personaRef.id):null;const books=(story.worldBooks||[]).map(ref=>({ref,live:getWorldBook(ref.id)}));return {chars,persona,books}}
  function sourceChanges(story){const refs=currentRefs(story),changed=[];refs.chars.forEach(({ref,live})=>{if(!live){changed.push({type:'char',id:ref.id,name:ref.snapshot?.name||'联系人',missing:true});return}const a=JSON.stringify(snapshotContact(live)),b=JSON.stringify(ref.snapshot||{});if(a!==b)changed.push({type:'char',id:ref.id,name:live.name||ref.snapshot?.name||'联系人'})});if(story.personaRef?.id){if(!refs.persona)changed.push({type:'persona',id:story.personaRef.id,name:story.personaRef.snapshot?.name||'自设',missing:true});else if(JSON.stringify(snapshotPersona(refs.persona))!==JSON.stringify(story.personaRef.snapshot||{}))changed.push({type:'persona',id:story.personaRef.id,name:refs.persona.name||'自设'})}refs.books.forEach(({ref,live})=>{if(!live){changed.push({type:'world',id:ref.id,name:ref.snapshot?.name||'世界书',missing:true});return}if(JSON.stringify(snapshotWorldBook(live))!==JSON.stringify(ref.snapshot||{}))changed.push({type:'world',id:ref.id,name:live.name||ref.snapshot?.name||'世界书'})});return changed}
  function syncStorySources(story){
    story.characters=(story.characters||[]).map(ref=>{const p=getContact(ref.id);return p?{id:String(p.id),snapshot:snapshotContact(p),syncedAt:Date.now()}:ref});
    if(story.personaRef?.id){const p=getPersona(story.personaRef.id);if(p)story.personaRef={id:String(p.id),snapshot:snapshotPersona(p),syncedAt:Date.now()}}
    story.worldBooks=(story.worldBooks||[]).map(ref=>{const w=getWorldBook(ref.id);return w?{id:String(w.id),snapshot:snapshotWorldBook(w),syncedAt:Date.now()}:ref});
    return saveMeta(story);
  }
  function currentBranch(story){return (story.branches||[]).find(x=>x.id===story.activeBranchId)||story.branches?.[0]||{id:'main',name:'主线',baseEntryIds:[]}}
  function visibleEntries(story,entries){const branch=currentBranch(story),base=new Set(branch.baseEntryIds||[]);return entries.filter(x=>base.has(x.id)||x.branchId===branch.id).sort((a,b)=>(a.seq||0)-(b.seq||0))}
  function profileSummary(story){return (story.characters||[]).map(x=>x.snapshot?.name||'未命名角色').join('、')||'暂无角色'}
  function injectStyles(){if($('lrSpaceStoryEngineStyles'))return;const style=document.createElement('style');style.id='lrSpaceStoryEngineStyles';style.textContent=`
#space.lr-space-v2 .lr-story-hub{margin:0 0 18px;padding:16px;border:3px solid #7e647e;border-radius:4px;background:#fff8e8;box-shadow:5px 5px 0 #d4bfd0;position:relative;overflow:hidden}
#space.lr-space-v2 .lr-story-hub:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.22;background-image:linear-gradient(90deg,transparent 24px,#cfbcd0 25px,transparent 26px),linear-gradient(transparent 24px,#cfbcd0 25px,transparent 26px);background-size:26px 26px}
#space.lr-space-v2 .lr-story-hub>*{position:relative;z-index:1}#space.lr-space-v2 .lr-story-hub-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}#space.lr-space-v2 .lr-story-pixel-label{font:700 9px/1.4 ui-monospace,monospace;letter-spacing:1.8px;color:#987b9b}#space.lr-space-v2 .lr-story-hub h2{font:700 22px/1.3 ui-monospace,'Courier New',monospace;color:#59475e;margin:5px 0}#space.lr-space-v2 .lr-story-hub p{font-size:11px;line-height:1.65;color:#927f91;margin:4px 0 0}#space.lr-space-v2 .lr-story-hub-mark{width:42px;height:42px;display:grid;place-items:center;background:#dfc7e1;color:#654d6c;border:2px solid #8b718f;box-shadow:3px 3px 0 #bda8c0;font-size:23px;image-rendering:pixelated;flex:none}
#space.lr-space-v2 .lr-story-hub-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px}#space.lr-space-v2 .lr-story-pixel-btn{min-height:40px;padding:9px 13px;border:2px solid #826a83;border-radius:3px;background:#e6d7eb;color:#5b4860;font:700 11px ui-monospace,monospace;box-shadow:3px 3px 0 #c7b4ca;cursor:pointer}#space.lr-space-v2 .lr-story-pixel-btn.primary{background:#a985ae;color:#fff;border-color:#745c7c}#space.lr-space-v2 .lr-story-pixel-btn:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #c7b4ca}
#space.lr-space-v2 .lr-story-hub-recent{display:grid;gap:7px;margin-top:12px}#space.lr-space-v2 .lr-story-mini-card{display:flex;align-items:center;gap:10px;padding:10px;border:2px solid #d8c8d7;border-radius:3px;background:rgba(255,255,255,.78);color:#5f5062;text-align:left;width:100%}#space.lr-space-v2 .lr-story-mini-cover{width:38px;height:38px;flex:none;display:grid;place-items:center;border:2px solid #8d7790;background:repeating-linear-gradient(0deg,#e5d2e7 0 5px,#d5bfd9 5px 10px);font-size:18px;image-rendering:pixelated}#space.lr-space-v2 .lr-story-mini-copy{min-width:0;flex:1}#space.lr-space-v2 .lr-story-mini-copy b,#space.lr-space-v2 .lr-story-mini-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#space.lr-space-v2 .lr-story-mini-copy b{font-size:12px}#space.lr-space-v2 .lr-story-mini-copy small{font-size:9px;color:#9b899e;margin-top:4px}
#space.lr-space-v2 .lr-story-screen{min-height:calc(100dvh - 110px);padding:16px 16px 130px;background:#f6f0e4;color:#594d5b}#space.lr-space-v2 .lr-story-top{display:flex;align-items:center;gap:9px;margin-bottom:13px}#space.lr-space-v2 .lr-story-top h1{flex:1;min-width:0;font:700 20px/1.35 ui-monospace,'Courier New',monospace;color:#59475e;margin:0;overflow-wrap:anywhere}#space.lr-space-v2 .lr-story-panel{border:3px solid #806a82;border-radius:4px;background:#fffaf0;box-shadow:4px 4px 0 #d9c8d5;padding:14px;margin:12px 0}#space.lr-space-v2 .lr-story-panel h2{font:700 14px ui-monospace,monospace;color:#705b74;margin:0 0 10px}#space.lr-space-v2 .lr-story-muted{font-size:11px;line-height:1.7;color:#99899a}#space.lr-space-v2 .lr-story-field{display:grid;gap:6px;margin:12px 0}#space.lr-space-v2 .lr-story-field>label,#space.lr-space-v2 .lr-story-label{font:700 10px ui-monospace,monospace;color:#8d728f;letter-spacing:.7px}#space.lr-space-v2 .lr-story-input,#space.lr-space-v2 .lr-story-textarea,#space.lr-space-v2 .lr-story-select{width:100%;min-width:0;border:2px solid #ddcbdc;border-radius:3px;background:#fffef9;color:#594d5b;padding:11px;font:13px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;box-sizing:border-box}#space.lr-space-v2 .lr-story-textarea{min-height:100px;resize:vertical}#space.lr-space-v2 .lr-story-option-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}#space.lr-space-v2 .lr-story-option{display:flex;align-items:flex-start;gap:8px;padding:9px;border:2px solid #e2d4df;border-radius:3px;background:#fffdf8;font-size:11px;line-height:1.45;min-width:0}#space.lr-space-v2 .lr-story-option input{margin:2px 0 0;accent-color:#97779d;flex:none}#space.lr-space-v2 .lr-story-toolbar{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}#space.lr-space-v2 .lr-story-toolbar .lr-story-pixel-btn{flex:1;min-width:105px}#space.lr-space-v2 .lr-story-list{display:grid;gap:10px;margin-top:12px}#space.lr-space-v2 .lr-story-card{border:3px solid #8c758d;border-radius:4px;background:#fffaf0;box-shadow:4px 4px 0 #d8c8d5;padding:12px;display:grid;gap:9px}#space.lr-space-v2 .lr-story-card-head{display:flex;align-items:center;gap:10px}#space.lr-space-v2 .lr-story-cover{width:52px;height:58px;flex:none;display:grid;place-items:center;border:2px solid #8b748e;background:repeating-linear-gradient(0deg,#e7d6e8 0 7px,#d6c0db 7px 14px);font-size:23px;image-rendering:pixelated}#space.lr-space-v2 .lr-story-card-copy{min-width:0;flex:1}#space.lr-space-v2 .lr-story-card-copy b{font-size:14px;color:#5e4b62;display:block;overflow-wrap:anywhere}#space.lr-space-v2 .lr-story-card-copy small{font-size:10px;line-height:1.6;color:#9c8a9c;display:block;margin-top:4px}#space.lr-space-v2 .lr-story-card-actions{display:flex;gap:7px;flex-wrap:wrap}#space.lr-space-v2 .lr-story-card-actions button{flex:1;min-width:75px}
#space.lr-space-v2 .lr-story-cast{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}#space.lr-space-v2 .lr-story-cast-chip{display:flex;align-items:center;gap:6px;padding:6px 8px;border:2px solid #d9c9d8;border-radius:3px;background:#fffdf8;font-size:10px;color:#6f5a72}#space.lr-space-v2 .lr-story-cast-chip img{width:24px;height:24px;object-fit:cover;image-rendering:pixelated;border:1px solid #8b748e}#space.lr-space-v2 .lr-story-cast-chip button{border:1px solid #cdb9cd;border-radius:2px;background:#fff8ee;color:#795f7c;font:9px ui-monospace,monospace;padding:3px 5px;cursor:pointer}#space.lr-space-v2 .lr-story-transcript{display:grid;gap:12px;margin:14px 0}#space.lr-space-v2 .lr-story-msg{border:2px solid #d7c7d5;border-radius:3px;background:#fffdf8;padding:12px;box-shadow:2px 2px 0 #e5dce0}#space.lr-space-v2 .lr-story-msg.user{background:#eee4f0;border-color:#aa8bad;margin-left:9%}#space.lr-space-v2 .lr-story-msg.assistant{background:#fffdf8;margin-right:3%}#space.lr-space-v2 .lr-story-msg-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font:700 9px ui-monospace,monospace;letter-spacing:.6px;color:#957b98;margin-bottom:8px}#space.lr-space-v2 .lr-story-msg-body{font:15px/2.05 Georgia,'Noto Serif SC',serif;color:#554a57;white-space:pre-wrap;overflow-wrap:anywhere}#space.lr-space-v2 .lr-story-msg-actions{display:flex;justify-content:flex-end;margin-top:9px}#space.lr-space-v2 .lr-story-msg-actions button{font-size:9px;padding:6px 8px;min-height:30px}
#space.lr-space-v2 .lr-story-source-alert{padding:10px;border:2px dashed #b78f70;background:#fff5e6;font-size:10px;line-height:1.6;color:#886a53;margin:9px 0}#space.lr-space-v2 .lr-story-composer{position:sticky;bottom:8px;background:#f1e8d9;border:3px solid #846f83;padding:10px;box-shadow:4px 4px 0 #d8c8d5;z-index:8}#space.lr-space-v2 .lr-story-composer textarea{width:100%;min-height:84px;max-height:220px;resize:vertical;border:2px solid #d6c7d6;border-radius:3px;background:#fffdf8;padding:11px;font:13px/1.65 sans-serif;color:#574b59;box-sizing:border-box}#space.lr-space-v2 .lr-story-composer-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}#space.lr-space-v2 .lr-story-status{font-size:10px;line-height:1.6;color:#947b96;margin:7px 0}.lr-story-hidden{display:none!important}
#space.lr-space-v2 .lr-story-profile-modal{position:fixed;inset:0;z-index:10070;background:rgba(55,44,58,.45);display:none;align-items:flex-end;justify-content:center;padding:10px}#space.lr-space-v2 .lr-story-profile-modal.show{display:flex}#space.lr-space-v2 .lr-story-profile-sheet{width:100%;max-width:580px;max-height:84dvh;overflow:auto;background:#fffaf0;border:3px solid #806a82;box-shadow:5px 5px 0 #cbb9ca;padding:15px;border-radius:4px}#space.lr-space-v2 .lr-story-profile-sheet h3{font:700 15px ui-monospace,monospace;margin:0 0 10px;color:#6b5670}
@media(min-width:650px){#space.lr-space-v2 .lr-story-screen{max-width:820px;margin:0 auto;padding-left:24px;padding-right:24px}#space.lr-space-v2 .lr-story-option-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:380px){#space.lr-space-v2 .lr-story-screen{padding-left:11px;padding-right:11px}#space.lr-space-v2 .lr-story-panel{padding:11px}}
#space.lr-space-v2 .lr-story-screen[hidden]{display:none!important}
/* MOBILE FIX: the long story profile form owns its scroll area inside the clipped SPACE shell. */
#space.lr-space-v2 #lrSpaceStoryCreate.lr-story-screen.is-current{height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 52px);max-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 52px);min-height:0;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y;padding-bottom:calc(150px + env(safe-area-inset-bottom,0px))!important}
#space.lr-space-v2 #lrSpaceStoryCreate.lr-story-screen.is-current>*{touch-action:pan-y}
#space.lr-space-v2 #lrSpaceStoryCreate.lr-story-screen.is-current .lr-story-textarea{touch-action:pan-y}
/* SPACE OFFLINE STORY FOCUS: temporarily hide city/world-settings UI without deleting saved city data */
#space.lr-space-v2 #lrSpaceV2Directory>.lr-space-v2-panel,
#space.lr-space-v2 #lrSpaceCreateCityPanel,
#space.lr-space-v2 #lrSpaceSettings,
#space.lr-space-v2 #lrSpaceOpenWorldSettingsShortcut,
#space.lr-space-v2 #lrSpaceV2Map,
#space.lr-space-v2 #lrSpaceCreate,
#space.lr-space-v2 #lrSpaceWorldEdit,
#space.lr-space-v2 #lrSpaceLocationEdit,
#space.lr-space-v2 #lrSpaceMissionsModal,
#space.lr-space-v2 #lrSpaceMissionEditor,
#space.lr-space-v2 #lrSpaceMiniStoryModal,
body:has(#space.active) #systemAppbarAction{display:none!important}
/* Output mode belongs to the story text area, not below the user composer */
#space.lr-space-v2 .lr-story-output-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;margin:12px 0 8px;border:2px solid #d7c6d8;background:#fffaf0;box-shadow:2px 2px 0 #e5dce0}
#space.lr-space-v2 .lr-story-output-toolbar label{font:700 10px ui-monospace,monospace;color:#8d728f}
#space.lr-space-v2 .lr-story-output-toolbar select{flex:1;min-width:150px;width:auto}
#space.lr-space-v2 .lr-story-output-hint{font-size:10px;color:#9a879b;flex-basis:100%;line-height:1.5}
#space.lr-space-v2 .lr-story-live-region{border:2px dashed #ae95b2;background:#f5edf6;padding:12px;margin:8px 0;color:#66536b;white-space:pre-wrap;overflow-wrap:anywhere;max-height:42dvh;overflow:auto;font:14px/1.9 Georgia,'Noto Serif SC',serif}
#space.lr-space-v2 .lr-story-output-progress{padding:7px 10px;margin:6px 0 12px;background:#f2eaf2;color:#927d96;font-size:10px;line-height:1.6;border-left:3px solid #ae91b2}
#space.lr-space-v2 .lr-story-msg-fold{min-width:0}
#space.lr-space-v2 .lr-story-msg-fold>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;cursor:pointer;color:#8f7791;font:700 10px/1.5 ui-monospace,monospace;padding:2px 0 8px}
#space.lr-space-v2 .lr-story-msg-fold>summary::-webkit-details-marker{display:none}
#space.lr-space-v2 .lr-story-msg-fold>summary:after{content:'＋';font-size:14px;color:#9a7aa0;flex:none}
#space.lr-space-v2 .lr-story-msg-fold[open]>summary:after{content:'－'}
#space.lr-space-v2 .lr-story-msg-fold .lr-story-msg-body{padding-top:4px}
#space.lr-space-v2 .lr-story-msg-actions{flex-wrap:wrap;gap:6px}
#space.lr-space-v2 .lr-story-msg-actions button[data-story-action="reroll"]{background:#a985ae;color:white;border-color:#745c7c}
/* SPACE STORY V2 · compact mobile UI + immersive reader */
#space.lr-space-v2 #lrSpaceStoryCreate,#space.lr-space-v2 #lrSpaceStoryLibrary{max-width:760px;margin:0 auto;padding:10px 12px 110px}
#space.lr-space-v2 .lr-story-screen{padding-top:10px}
#space.lr-space-v2 .lr-story-top{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;margin-bottom:10px}
#space.lr-space-v2 .lr-story-top h1{font-size:clamp(15px,4vw,20px);text-align:center;line-height:1.25}
#space.lr-space-v2 .lr-story-pixel-btn{min-height:36px;padding:7px 10px;font-size:10px;box-shadow:2px 2px 0 #c7b4ca;white-space:normal}
#space.lr-space-v2 .lr-story-panel{padding:11px;margin:9px 0;border-width:2px;box-shadow:2px 2px 0 #d9c8d5}
#space.lr-space-v2 .lr-story-panel h2{font-size:12px;margin-bottom:7px}
#space.lr-space-v2 .lr-story-field{gap:5px;margin:8px 0}
#space.lr-space-v2 .lr-story-option-grid{grid-template-columns:minmax(0,1fr);gap:6px}
#space.lr-space-v2 .lr-story-option{display:grid!important;grid-template-columns:18px minmax(0,1fr);align-items:start;width:100%;min-height:0;padding:9px 10px;gap:8px;box-sizing:border-box;overflow:hidden}
#space.lr-space-v2 .lr-story-option>input[type=checkbox],#space.lr-space-v2 .lr-story-option>input[type=radio]{display:block!important;appearance:auto!important;-webkit-appearance:checkbox!important;width:17px!important;height:17px!important;min-width:17px!important;max-width:17px!important;margin:2px 0 0!important;padding:0!important;position:static!important;opacity:1!important;transform:none!important;flex:none!important;accent-color:#97779d}
#space.lr-space-v2 .lr-story-option>span{display:block!important;min-width:0!important;width:100%!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;writing-mode:horizontal-tb!important;line-height:1.45}
#space.lr-space-v2 .lr-story-option b{display:inline;font-size:12px}
#space.lr-space-v2 .lr-story-option small{font-size:10px;color:#8f8191;line-height:1.45}
#space.lr-space-v2 .lr-story-card-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
#space.lr-space-v2 .lr-story-card-actions button{min-width:0;width:100%;flex:auto}
#space.lr-space-v2 .lr-story-card-actions button:first-child{grid-column:1/-1}
#space.lr-space-v2 .lr-story-card{padding:10px;gap:8px}
#space.lr-space-v2 .lr-story-composer{position:sticky;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);padding:9px;background:rgba(247,239,226,.97);backdrop-filter:blur(12px);box-shadow:0 0 0 1px rgba(132,111,131,.1),3px 3px 0 #d8c8d5}
#space.lr-space-v2 .lr-story-composer textarea{min-height:66px;max-height:170px;font-size:14px}
#space.lr-space-v2 .lr-story-composer-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#space.lr-space-v2 .lr-story-composer-actions button{min-width:0;width:100%}
#space.lr-space-v2 #lrStoryGenerationStatus{margin:5px 0 0;font-size:10px}#space.lr-space-v2 #lrStoryLiveDraft{max-height:220px;overflow:auto}#space.lr-space-v2 .lr-story-timeline{margin:10px 0;padding:9px 11px;border:2px solid #d9c8d8;background:#fffaf0}#space.lr-space-v2 .lr-story-timeline>summary{font:700 10px ui-monospace,monospace;color:#866c89;cursor:pointer}#space.lr-space-v2 #lrStoryTimelineList{margin:9px 0}
#space.lr-space-v2 #lrStoryLiveDraft{padding:10px 12px;margin:9px 0;border:1px dashed #aa8bad;background:#f6edf6;color:#67566b;white-space:pre-wrap;line-height:1.8;font-size:14px;overflow-wrap:anywhere}
#space.lr-space-v2 .lr-story-reader{max-width:780px;margin:0 auto;padding:10px 12px calc(24px + env(safe-area-inset-bottom,0px));min-height:calc(100dvh - 120px);background:#f6f0e4}
#space.lr-space-v2 .lr-story-reader-top{position:sticky;top:0;z-index:12;background:rgba(246,240,228,.96);backdrop-filter:blur(12px);padding:7px 0 10px;border-bottom:1px solid rgba(126,100,126,.15);display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px}
#space.lr-space-v2 .lr-story-reader-title{min-width:0;text-align:center;font:700 14px/1.35 ui-monospace,monospace;color:#59475e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#space.lr-space-v2 .lr-story-reader-tools{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}
#space.lr-space-v2 .lr-story-reader-tools .lr-story-pixel-btn{flex:1;min-width:0}
#space.lr-space-v2 .lr-story-reader details{border:1px solid #d9c8d8;background:#fffaf0;padding:8px 10px;margin:8px 0}
#space.lr-space-v2 .lr-story-reader details>summary{font:700 10px ui-monospace,monospace;color:#866c89;cursor:pointer}
#space.lr-space-v2 .lr-story-reader .lr-story-transcript{max-width:720px;margin:12px auto 18px;gap:16px}
#space.lr-space-v2 .lr-story-reader .lr-story-msg{padding:16px 14px;box-shadow:1px 2px 0 #e5dce0}
#space.lr-space-v2 .lr-story-reader .lr-story-msg-body{font-size:16px;line-height:2.05;letter-spacing:.015em}
#space.lr-space-v2 .lr-story-reader .lr-story-msg.user .lr-story-msg-body{font:14px/1.8 -apple-system,BlinkMacSystemFont,sans-serif}
/* Reading column: modestly wider, while preserving comfortable side margins. */
#space.lr-space-v2 .lr-story-reader{max-width:820px}
#space.lr-space-v2 .lr-story-reader .lr-story-transcript{max-width:760px}
#space.lr-space-v2 .lr-story-reader .lr-story-msg.user{margin-left:6%}
#space.lr-space-v2 .lr-story-reader .lr-story-msg.assistant{margin-right:1%}
#space.lr-space-v2 .lr-story-reader .lr-story-msg{padding-left:16px;padding-right:16px}
#space.lr-space-v2 .lr-story-long-memory{margin-top:18px;padding:13px;border:2px solid #d8c7d8;background:linear-gradient(145deg,#fffaf0,#f9f2f8);box-shadow:2px 2px 0 #e7dce5}
#space.lr-space-v2 .lr-story-long-memory-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
#space.lr-space-v2 .lr-story-long-memory-head h3{margin:0;color:#705b74;font:700 12px/1.5 ui-monospace,monospace;letter-spacing:.5px}
#space.lr-space-v2 .lr-story-long-memory-head p{margin:5px 0 0;color:#99899a;font-size:10px;line-height:1.65}
#space.lr-space-v2 .lr-story-memory-mark{display:grid;place-items:center;width:32px;height:32px;flex:none;background:#eaddec;border:1px solid #cbb6cf;color:#8b6f91}
#space.lr-space-v2 .lr-story-memory-toggle{margin:12px 0 8px}
#space.lr-space-v2 .lr-story-memory-settings{display:grid;grid-template-columns:minmax(0,1fr);gap:4px}
#space.lr-space-v2 .lr-story-memory-settings .lr-story-field{margin:5px 0}
#space.lr-space-v2 .lr-story-memory-status{padding:8px 10px;background:#f1e9f2;border-left:3px solid #ad91b1;color:#806b84;font-size:10px;line-height:1.65;overflow-wrap:anywhere}
#space.lr-space-v2 .lr-story-memory-text{min-height:190px;line-height:1.8}
#space.lr-space-v2 .lr-story-memory-actions{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}
#space.lr-space-v2 .lr-story-memory-actions button{flex:1;min-width:130px}
@media(max-width:390px){#space.lr-space-v2 .lr-story-reader{padding-left:9px;padding-right:9px}#space.lr-space-v2 .lr-story-reader .lr-story-msg.user{margin-left:5%}#space.lr-space-v2 .lr-story-reader .lr-story-msg.assistant{margin-right:.5%}#space.lr-space-v2 .lr-story-reader .lr-story-msg{padding-left:14px;padding-right:14px}}
#space.lr-space-v2 .lr-story-reader .lr-story-composer{z-index:30}
#space.lr-space-v2 .lr-story-generation-mode{display:flex;align-items:center;gap:7px;margin:5px 0}
#space.lr-space-v2 .lr-story-generation-mode label{font:700 10px ui-monospace,monospace;color:#8d728f}
#space.lr-space-v2 .lr-story-generation-mode select{flex:1;min-width:0;border:1px solid #d6c7d6;border-radius:3px;background:#fffdf8;padding:7px;color:#5b4d5e}
#space.lr-space-v2 .lr-story-export-options{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}
#space.lr-space-v2 .lr-story-export-options button{flex:1;min-width:72px}
@media(min-width:560px){#space.lr-space-v2 .lr-story-option-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#space.lr-space-v2 #lrSpaceStoryCreate,#space.lr-space-v2 #lrSpaceStoryLibrary{padding-left:20px;padding-right:20px}}
@media(max-width:390px){#space.lr-space-v2 .lr-story-top{grid-template-columns:auto minmax(0,1fr)}#space.lr-space-v2 .lr-story-top>:last-child{grid-column:2;justify-self:end}#space.lr-space-v2 .lr-story-reader-top{grid-template-columns:auto minmax(0,1fr) auto}#space.lr-space-v2 .lr-story-reader-title{font-size:12px}#space.lr-space-v2 .lr-story-reader .lr-story-msg-body{font-size:15px;line-height:1.95}}
`;
    document.head.appendChild(style);
  }
  function getDir(){return $('lrSpaceV2Directory')}
  function ensureHub(){
    const dir=getDir();if(!dir)return;
    if(!$('lrSpaceStoryHub')){
      const head=dir.querySelector('.lr-space-v2-head');
      const hub=document.createElement('section');hub.id='lrSpaceStoryHub';hub.className='lr-story-hub';
      hub.innerHTML=`<div class="lr-story-hub-head"><div><div class="lr-story-pixel-label">PIXEL STORY ENGINE · SPACE</div><h2>剧情工作台</h2><p>把 CHAR、你的自设与世界书带进故事，开启一段可以长期保存的长篇剧情。</p></div><div class="lr-story-hub-mark">▣</div></div><div class="lr-story-hub-actions"><button class="lr-story-pixel-btn primary" type="button" data-story-action="new">＋ 创建新故事</button><button class="lr-story-pixel-btn" type="button" data-story-action="library">我的故事档案</button><button class="lr-story-pixel-btn" type="button" data-story-action="custom-css">自定义 CSS</button></div><div id="lrSpaceStoryRecent" class="lr-story-hub-recent"><div class="lr-story-muted">正在读取故事档案…</div></div>`;
      if(head)head.insertAdjacentElement('afterend',hub);else dir.prepend(hub);
    }
  }
  function ensureScreens(){
    const root=$('space');if(!root)return;
    if(!$('lrSpaceStoryLibrary')){
      const lib=document.createElement('section');lib.id='lrSpaceStoryLibrary';lib.className='lr-space-v2-screen lr-story-screen';lib.hidden=true;lib.innerHTML=`<header class="lr-story-top"><button class="lr-story-pixel-btn" data-story-action="home">‹ 返回 SPACE</button><h1>我的故事档案</h1><button class="lr-story-pixel-btn primary" data-story-action="new">＋ 新故事</button></header><section class="lr-story-panel"><h2>STORY LIBRARY</h2><div class="lr-story-toolbar"><input id="lrStorySearch" class="lr-story-input" type="search" placeholder="搜索故事名称、人物或设定…"><button class="lr-story-pixel-btn" data-story-action="import-backup">导入故事备份</button><input id="lrStoryBackupFile" type="file" accept=".json,application/json" hidden></div><div id="lrStoryLibraryList" class="lr-story-list"><div class="lr-story-muted">正在读取…</div></div></section></section>`;
      root.appendChild(lib);
    }
    if(!$('lrSpaceStoryCreate')){
      const form=document.createElement('section');form.id='lrSpaceStoryCreate';form.className='lr-space-v2-screen lr-story-screen';form.hidden=true;form.innerHTML=`<header class="lr-story-top"><button class="lr-story-pixel-btn" data-story-action="library">‹ 返回档案</button><h1 id="lrStoryCreateHeading">创建新故事</h1><span></span></header>
        <section class="lr-story-panel"><h2>01 · 故事资料</h2><div class="lr-story-field"><label for="lrStoryTitle">故事名称 *</label><input id="lrStoryTitle" class="lr-story-input" maxlength="90" placeholder="给这段故事取一个名字"></div><div class="lr-story-field"><label for="lrStoryPremise">故事背景与开场设定</label><textarea id="lrStoryPremise" class="lr-story-textarea" placeholder="时代、地点、背景、人物关系、故事起点……"></textarea></div><div class="lr-story-field"><label for="lrStoryOpening">第一段剧情 / 开场指令（可选）</label><textarea id="lrStoryOpening" class="lr-story-textarea" placeholder="例如：一个下雨的傍晚，我比平时更早回到家。"></textarea></div></section>
        <section class="lr-story-panel"><h2>02 · 选择 CHAR（主页联系人）</h2><p class="lr-story-muted">直接引用主页联系人，故事会保存资料快照，不会复制或修改主页联系人。</p><div id="lrStoryContactChoices" class="lr-story-option-grid"></div></section>
        <section class="lr-story-panel"><h2>03 · 选择自设（主页自设）</h2><p class="lr-story-muted">选择你在本故事中扮演的身份。可不选择，使用默认的你。</p><div class="lr-story-field"><select id="lrStoryPersonaSelect" class="lr-story-select"></select></div></section>
        <section class="lr-story-panel"><h2>04 · 选择世界书（主页世界书）</h2><p class="lr-story-muted">可选择多本世界书。只读取勾选的设定，并在本故事中保存版本快照。</p><div id="lrStoryWorldChoices" class="lr-story-option-grid"></div></section>
        <section class="lr-story-panel"><h2>05 · 关联 SPACE CITY（可选）</h2><p class="lr-story-muted">可以把故事关联到一座城市。创作时可读取城市时间、天气、地点和居民快照；剧情要改变城市状态时，仍需你确认。</p><div class="lr-story-field"><select id="lrStoryCitySelect" class="lr-story-select"><option value="">暂不关联城市</option></select></div></section>
        <details class="lr-story-panel" open><summary class="lr-story-panel-summary">05 · 剧情与 AI 规则</summary><div class="lr-story-field"><label for="lrStoryMode">剧情模式</label><select id="lrStoryMode" class="lr-story-select"><option value="novel">小说沉浸模式</option><option value="interactive">互动长文模式</option></select></div><div class="lr-story-field"><label for="lrStoryUserControl">用户角色控制权</label><select id="lrStoryUserControl" class="lr-story-select"><option value="user">用户完全控制（默认）</option><option value="assist">AI 辅助控制（需尊重用户意图）</option><option value="ai">AI 完全控制</option></select></div><div class="lr-story-field"><label for="lrStoryNpcPolicy">NPC 创建方式</label><select id="lrStoryNpcPolicy" class="lr-story-select"><option value="both">AI 自主生成＋用户手动创建</option><option value="manual">仅用户手动创建</option><option value="ai">AI 自主生成（用户可编辑）</option></select></div><div class="lr-story-field"><label for="lrStoryTarget">每次剧情目标字数（中文字符）</label><input id="lrStoryTarget" class="lr-story-input" type="number" min="300" max="12000" step="100" value="2000"><small class="lr-story-muted">目标字数模式：尽可能接近目标，允许自然浮动，不为凑字数灌水；超长内容分段生成并逐段保存。</small></div><div class="lr-story-field"><label for="lrStoryView">叙事视角</label><select id="lrStoryView" class="lr-story-select"><option value="third">第三人称</option><option value="first">第一人称</option></select></div><div class="lr-story-field"><label for="lrStoryPace">剧情节奏</label><select id="lrStoryPace" class="lr-story-select"><option value="slow">慢节奏</option><option value="normal" selected>正常</option><option value="fast">快节奏</option></select></div><div class="lr-story-field"><label>剧情连贯性</label><select id="lrStoryContinuity" class="lr-story-select"><option value="balanced" selected>平衡模式</option><option value="strict">严格模式</option><option value="creative">创作模式</option></select></div><div class="lr-story-field"><label>文学描写</label><select id="lrStoryDetail" class="lr-story-select"><option value="rich" selected>丰富</option><option value="moderate">适中</option><option value="dialogue">对白优先</option></select></div><div class="lr-story-field"><label>AI 剧情主动性</label><select id="lrStoryInitiative" class="lr-story-select"><option value="medium" selected>中 · 适度推动</option><option value="low">低 · 主要回应用户</option><option value="high">高 · 主动创造支线</option></select></div><div class="lr-story-field"><label for="lrStoryExtraRules">故事专属规则（可选）</label><textarea id="lrStoryExtraRules" class="lr-story-textarea" placeholder="例如：不要让角色突然离开当前场景；两位角色目前还没有确认关系……"></textarea></div></details>
        <div class="lr-story-toolbar"><button class="lr-story-pixel-btn" data-story-action="library">取消</button><button id="lrStoryCreateSave" class="lr-story-pixel-btn primary" type="button">创建故事并进入</button></div><div id="lrStoryCreateStatus" class="lr-story-status" role="status"></div>`;
      root.appendChild(form);
    }
    if(!$('lrSpaceStoryWorkspace')){
      const work=document.createElement('section');work.id='lrSpaceStoryWorkspace';work.className='lr-space-v2-screen lr-story-screen';work.hidden=true;work.innerHTML=`<div class="lr-story-reader lr-story-focus-mode"><canvas id="lrStoryThemeCanvas" class="lr-story-theme-canvas" aria-hidden="true"></canvas><header class="lr-story-reader-top lr-story-focus-top"><button class="lr-story-pixel-btn lr-story-back-btn" data-story-action="library" type="button" aria-label="返回故事档案" title="返回故事档案">‹ 档案</button><div class="lr-story-reader-title" id="lrStoryWorkspaceTitle">故事</div><button class="lr-story-pixel-btn lr-story-gear-btn" data-story-action="show-settings" type="button" aria-label="打开线下模式设置" title="设置">⚙</button></header>
        <div id="lrStorySettingsPanel" class="lr-story-settings-overlay" hidden aria-hidden="true"><section class="lr-story-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="lrStorySettingsTitle"><header class="lr-story-settings-head"><div><div class="lr-story-pixel-label">SPACE · OFFLINE MODE</div><h2 id="lrStorySettingsTitle">线下模式设置</h2><p>管理入口已收纳在这里，关闭后回到专注阅读。</p></div><button class="lr-story-pixel-btn" data-story-action="close-settings" type="button" aria-label="关闭设置">✕</button></header>
          <details class="lr-story-settings-group lr-story-theme-group"><summary>外观与动态主题</summary><div class="lr-story-theme-intro">四套 LOVE RECORD 原创主题。切换后立即应用并自动保存，不影响其他 APP。</div><div class="lr-story-theme-grid" id="lrStoryThemeGrid">
            <button type="button" class="lr-story-theme-card" data-offline-theme-select="pixel" aria-pressed="false"><span class="lr-story-theme-preview pixel"><i></i><b></b><em></em></span><strong>原始像素</strong><small>ORIGINAL PIXEL</small><span class="lr-story-theme-check">✓</span></button>
            <button type="button" class="lr-story-theme-card" data-offline-theme-select="rain" aria-pressed="false"><span class="lr-story-theme-preview rain"><i></i><b></b><em></em></span><strong>雨幕玻璃</strong><small>RAIN GLASS</small><span class="lr-story-theme-check">✓</span></button>
            <button type="button" class="lr-story-theme-card" data-offline-theme-select="cream" aria-pressed="false"><span class="lr-story-theme-preview cream"><i></i><b></b><em></em></span><strong>奶油黑白</strong><small>CREAM MONO</small><span class="lr-story-theme-check">✓</span></button>
            <button type="button" class="lr-story-theme-card" data-offline-theme-select="yuzu" aria-pressed="false"><span class="lr-story-theme-preview yuzu"><i></i><b></b><em></em></span><strong>柚子汽水</strong><small>YUZU SODA</small><span class="lr-story-theme-check">✓</span></button>
          </div><div class="lr-story-theme-controls"><label class="lr-story-theme-motion"><input id="lrStoryThemeMotion" type="checkbox" checked><span><b>动态效果</b><small>启用主题专属的轻量动画</small></span></label><label class="lr-story-theme-rain-control" id="lrStoryRainControl"><span>雨势强度</span><select id="lrStoryRainIntensity" class="lr-story-select"><option value="light">小雨 · 轻柔细密</option><option value="medium" selected>中雨 · 雨丝与水滴</option><option value="heavy">大雨 · 密集雨幕</option></select></label></div><div class="lr-story-theme-status" id="lrStoryThemeStatus" role="status" aria-live="polite">当前使用：原始像素</div><p class="lr-story-theme-note">动画只在故事阅读页运行；离开故事、切换页面或关闭动态效果时会暂停。支持系统减少动态效果设置。</p></details>
          <details class="lr-story-settings-group" open><summary>故事管理</summary><div class="lr-story-settings-actions"><button class="lr-story-pixel-btn" data-story-action="library">‹ 返回故事档案</button><button class="lr-story-pixel-btn" data-story-action="edit-active">编辑故事资料</button></div><label class="lr-story-field"><span class="lr-story-label">当前剧情分支</span><select id="lrStoryBranchSelect" class="lr-story-select" aria-label="当前分支"></select></label></details>
          <details class="lr-story-settings-group"><summary>导出与备份</summary><div class="lr-story-settings-actions"><button class="lr-story-pixel-btn" data-story-action="export">导出 MD</button><button class="lr-story-pixel-btn" data-story-action="export-txt">导出 TXT</button><button class="lr-story-pixel-btn" data-story-action="export-json">完整备份</button><button class="lr-story-pixel-btn" data-story-action="export-pdf">导出 PDF</button></div></details>
          <details class="lr-story-settings-group"><summary>角色与主页资料</summary><div id="lrStoryCastDetails" class="lr-story-settings-content"><div class="lr-story-cast" id="lrStoryCast"></div><div class="lr-story-toolbar"><button class="lr-story-pixel-btn" data-story-action="add-contact">＋ 添加 CHAR</button><button class="lr-story-pixel-btn" data-story-action="manual-npc">＋ 手动 NPC</button><button class="lr-story-pixel-btn" data-story-action="ai-npc">✦ AI 创建 NPC</button></div><div id="lrStorySourceChanges"></div><div class="lr-story-muted" id="lrStoryContextMeta"></div></div></details>
          <details class="lr-story-settings-group"><summary>SPACE CITY · 城市同步</summary><div id="lrStoryCitySyncDetails" class="lr-story-settings-content"><div class="lr-story-muted" id="lrStoryCitySyncMeta" style="margin:9px 0">尚未关联城市。可以在编辑故事资料时选择一座 SPACE CITY。</div><div class="lr-story-field"><label class="lr-story-label" for="lrStoryCityLocationSelect">将城市当前地点同步为</label><select id="lrStoryCityLocationSelect" class="lr-story-select"><option value="">请先关联城市</option></select></div><div class="lr-story-toolbar"><button type="button" class="lr-story-pixel-btn primary" data-story-action="sync-city-location">确认同步当前地点</button></div><p class="lr-story-muted">同步前会再次询问。只有你确认后，城市当前地点和用户角色位置才会更新；不会自动改变其他居民、关系或家庭状态。</p></div></details>
          <details class="lr-story-settings-group"><summary>本故事写作设置</summary><div id="lrStoryWritingDetails" class="lr-story-settings-content"><div class="lr-story-option-grid" style="margin-top:10px"><label class="lr-story-field"><span class="lr-story-label">剧情模式</span><select id="lrStoryWorkspaceMode" class="lr-story-select"><option value="novel">小说沉浸</option><option value="interactive">互动长文</option></select></label><label class="lr-story-field"><span class="lr-story-label">目标字数</span><input id="lrStoryWorkspaceTarget" class="lr-story-input" type="number" min="300" max="12000" step="100"></label><label class="lr-story-field"><span class="lr-story-label">文风描写</span><select id="lrStoryWorkspaceDetail" class="lr-story-select"><option value="rich">丰富</option><option value="moderate">适中</option><option value="dialogue">对白优先</option></select></label><label class="lr-story-field"><span class="lr-story-label">连贯性</span><select id="lrStoryWorkspaceContinuity" class="lr-story-select"><option value="balanced">平衡</option><option value="strict">严格</option><option value="creative">创作</option></select></label><label class="lr-story-field"><span class="lr-story-label">AI 主动性</span><select id="lrStoryWorkspaceInitiative" class="lr-story-select"><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label><label class="lr-story-field"><span class="lr-story-label">用户角色控制</span><select id="lrStoryWorkspaceUserControl" class="lr-story-select"><option value="user">用户完全控制</option><option value="assist">AI 辅助控制</option><option value="ai">AI 完全控制</option></select></label><label class="lr-story-field"><span class="lr-story-label">NPC 创建方式</span><select id="lrStoryWorkspaceNpcPolicy" class="lr-story-select"><option value="both">AI＋手动创建</option><option value="manual">仅手动创建</option><option value="ai">AI 创建</option></select></label><label class="lr-story-field"><span class="lr-story-label">叙事视角</span><select id="lrStoryWorkspaceView" class="lr-story-select"><option value="third">第三人称</option><option value="first">第一人称</option></select></label><label class="lr-story-field"><span class="lr-story-label">剧情节奏</span><select id="lrStoryWorkspacePace" class="lr-story-select"><option value="slow">慢节奏</option><option value="normal">正常</option><option value="fast">快速</option></select></label></div><label class="lr-story-field"><span class="lr-story-label">剧情摘要 / 当前进度</span><textarea id="lrStoryWorkspaceSummary" class="lr-story-textarea" placeholder="记录故事目前发展到哪里，帮助后续续写保持连贯。"></textarea></label><label class="lr-story-field"><span class="lr-story-label">固定事实与长期备注</span><textarea id="lrStoryWorkspaceNotes" class="lr-story-textarea" placeholder="记录不能随意改变的事实、承诺、秘密与重要关系。"></textarea></label><textarea id="lrStoryWorkspaceRules" class="lr-story-textarea" placeholder="故事专属规则"></textarea><div class="lr-story-toolbar"><button class="lr-story-pixel-btn" data-story-action="save-settings" type="button">保存故事设置</button></div></div></details>
          <details class="lr-story-settings-group"><summary>剧情时间轴 · 已记录的重要节点</summary><div id="lrStoryTimelineDetails" class="lr-story-settings-content lr-story-timeline"><div id="lrStoryTimelineList"></div><button type="button" class="lr-story-pixel-btn" data-story-action="add-timeline-event">＋ 记录剧情节点</button>
          <section class="lr-story-long-memory" aria-labelledby="lrStoryLongMemoryTitle"><div class="lr-story-long-memory-head"><div><h3 id="lrStoryLongMemoryTitle">长记忆 · LONG MEMORY</h3><p>把当前分支的对话整理成可持续累积的剧情记忆。原始消息不会删除。</p></div><span class="lr-story-memory-mark">✦</span></div><label class="lr-story-option lr-story-memory-toggle"><input id="lrStoryLongMemoryAuto" type="checkbox" checked><span><b>启用自动总结</b><br><small>达到设定消息数后，自动整理当前分支的待总结内容。</small></span></label><div class="lr-story-memory-settings"><label class="lr-story-field"><span class="lr-story-label">每多少条对话消息总结一次</span><input id="lrStoryLongMemoryInterval" class="lr-story-input" type="number" min="2" max="100" step="1" value="15"></label><div id="lrStoryLongMemoryStatus" class="lr-story-memory-status" role="status">正在读取长记忆状态…</div></div><label class="lr-story-field"><span class="lr-story-label">当前分支的长记忆（可手动编辑）</span><textarea id="lrStoryLongMemoryText" class="lr-story-textarea lr-story-memory-text" placeholder="这里会保存人物关系、重要事实、剧情进度、伏笔和待推进事项。你也可以直接手动编辑。"></textarea></label><div class="lr-story-memory-actions"><button type="button" class="lr-story-pixel-btn" data-story-action="save-long-memory">保存长记忆</button><button type="button" class="lr-story-pixel-btn primary" data-story-action="summarize-long-memory">立即总结待处理消息</button></div><p class="lr-story-muted">消息数按“每条用户输入”和“每轮完整 SPACE 回复”计算；长文内部的分段生成会合并计为一条。自动总结需要调用当前配置的 API。</p></section>
        </div></details>
          <details class="lr-story-settings-group"><summary>正文输出方式</summary><div class="lr-story-output-toolbar"><label for="lrStoryQuickStreamMode">生成模式</label><select id="lrStoryQuickStreamMode" class="lr-story-select"><option value="stream">流式输出 · 边生成边显示</option><option value="complete">非流式输出 · 完整生成后显示</option></select><span class="lr-story-label" id="lrStoryLiveStatus">就绪</span><div class="lr-story-output-hint" id="lrStoryOutputHint">流式：正文会随模型输出逐步出现。</div></div></details>
        </section></div>
        <div id="lrStoryTranscript" class="lr-story-transcript"></div>
        <div id="lrStoryLiveDraft" class="lr-story-live-region" hidden></div>
        <div id="lrStoryGenerationStatus" class="lr-story-output-progress" role="status" aria-live="polite">每段剧情都会自动保存。调用 API 时，这里会显示连接与生成进度。</div>
        <div class="lr-story-composer"><div class="lr-story-label" id="lrStoryComposerHint">写下你想发生的事，或让故事从这里开始。</div><textarea id="lrStoryUserInput" placeholder="你的行动、对白、想法或下一段剧情方向……"></textarea><div class="lr-story-composer-actions"><button id="lrStoryGenerate" class="lr-story-pixel-btn primary" type="button">生成剧情</button><button id="lrStoryCancelGeneration" class="lr-story-pixel-btn" type="button" hidden>停止后续生成</button></div></div>
        <div id="lrStoryAddContactModal" class="lr-story-profile-modal"><section class="lr-story-profile-sheet"><h3>添加主页 CHAR</h3><div id="lrStoryAddContactChoices" class="lr-story-option-grid"></div><div class="lr-story-toolbar"><button class="lr-story-pixel-btn" data-story-action="close-modal">取消</button><button class="lr-story-pixel-btn primary" data-story-action="confirm-contacts">添加所选角色</button></div></section></div>
        <div id="lrStoryNpcModal" class="lr-story-profile-modal"><section class="lr-story-profile-sheet"><h3>创建故事 NPC</h3><div class="lr-story-field"><label>姓名</label><input id="lrStoryNpcName" class="lr-story-input" maxlength="80"></div><div class="lr-story-field"><label>身份</label><input id="lrStoryNpcRole" class="lr-story-input" maxlength="120"></div><div class="lr-story-field"><label>性格</label><textarea id="lrStoryNpcPersonality" class="lr-story-textarea"></textarea></div><div class="lr-story-field"><label>说话方式</label><textarea id="lrStoryNpcSpeech" class="lr-story-textarea" placeholder="语气、用词习惯、口头禅……"></textarea></div><div class="lr-story-field"><label>背景</label><textarea id="lrStoryNpcBackground" class="lr-story-textarea"></textarea></div><div class="lr-story-toolbar"><button class="lr-story-pixel-btn" data-story-action="close-modal">取消</button><button class="lr-story-pixel-btn primary" data-story-action="save-npc">保存 NPC</button></div></section></div>
        <div id="lrStoryEditEntryModal" class="lr-story-profile-modal"><section class="lr-story-profile-sheet"><h3>编辑剧情内容</h3><textarea id="lrStoryEditEntryText" class="lr-story-textarea" style="min-height:220px"></textarea><div class="lr-story-toolbar"><button class="lr-story-pixel-btn" data-story-action="close-modal">取消</button><button class="lr-story-pixel-btn primary" data-story-action="save-entry">保存修改</button></div></section></div></div>`;
      root.appendChild(work);
    }
    if(!$('lrSpaceStoryCssEditor')){
      const cssPage=document.createElement('section');cssPage.id='lrSpaceStoryCssEditor';cssPage.className='lr-space-v2-screen lr-story-screen';cssPage.hidden=true;cssPage.innerHTML=`<header class="lr-story-top"><button class="lr-story-pixel-btn" data-story-action="home">‹ 返回 SPACE</button><h1>自定义 CSS</h1><span></span></header><section class="lr-story-panel"><h2>SPACE CUSTOM CSS</h2><p class="lr-story-muted">这是 SPACE 全局 CSS：会作用于 SPACE 的故事工作台、档案、正文和原有像素界面，不影响其他 LOVE RECORD APP，也不会执行 JavaScript。内置示例可以直接修改；支持常规 CSS、@media、@supports 与动画关键帧，外部资源载入会被阻止。</p><label class="lr-story-option"><input id="lrSpaceCssEnabled" type="checkbox" checked><span><b>启用自定义 CSS</b><br><small>关闭后仍会保留代码，再次开启即可恢复。</small></span></label><div class="lr-story-field"><label for="lrSpaceCustomCssInput">CSS 代码</label><textarea id="lrSpaceCustomCssInput" class="lr-story-textarea" spellcheck="false" autocapitalize="off" autocomplete="off" style="min-height:360px;font:12px/1.65 ui-monospace,monospace" placeholder="编辑下方已提供的全局 CSS 示例……"></textarea></div><div class="lr-story-toolbar"><button class="lr-story-pixel-btn primary" data-story-action="save-css">保存并应用</button><button class="lr-story-pixel-btn" data-story-action="export-css">导出 CSS</button><button class="lr-story-pixel-btn" data-story-action="import-css">导入 CSS</button><button class="lr-story-pixel-btn" data-story-action="reset-css">恢复默认</button><input id="lrSpaceCssFile" type="file" accept=".css,text/css" hidden></div><div id="lrSpaceCustomCssStatus" class="lr-story-status" role="status">CSS 尚未修改。</div></section></section>`;root.appendChild(cssPage);
    }
  }
  const OFFLINE_THEME_KEY='love-record-offline-theme-v1';
  const OFFLINE_THEME_MOTION_KEY='love-record-offline-theme-motion-v1';
  const OFFLINE_THEME_RAIN_KEY='love-record-offline-theme-rain-v1';
  const OFFLINE_THEME_NAMES={pixel:'原始像素',rain:'雨幕玻璃',cream:'奶油黑白',yuzu:'柚子汽水'};
  let offlineThemeRaf=0,offlineThemeLastFrame=0,offlineThemeParticles=[],offlineThemeDrops=[],offlineThemeClouds=[],offlineThemeCanvasSize={w:0,h:0,dpr:1},offlineThemeLifecycleBound=false;
  function readOfflineThemePrefs(){let theme='pixel',motion=true,rain='medium';try{const t=localStorage.getItem(OFFLINE_THEME_KEY);if(Object.prototype.hasOwnProperty.call(OFFLINE_THEME_NAMES,t))theme=t;motion=localStorage.getItem(OFFLINE_THEME_MOTION_KEY)!=='false';rain=['light','medium','heavy'].includes(localStorage.getItem(OFFLINE_THEME_RAIN_KEY))?localStorage.getItem(OFFLINE_THEME_RAIN_KEY):'medium'}catch(e){}return {theme,motion,rain}}
  function writeOfflineThemePref(key,value){try{localStorage.setItem(key,String(value))}catch(e){console.warn('[SPACE offline theme] preference could not be saved',e)}}
  function renderOfflineThemeControls(){const prefs=readOfflineThemePrefs();document.querySelectorAll('[data-offline-theme-select]').forEach(btn=>{const selected=btn.dataset.offlineThemeSelect===prefs.theme;btn.classList.toggle('is-selected',selected);btn.setAttribute('aria-pressed',String(selected))});const motion=$('lrStoryThemeMotion');if(motion)motion.checked=prefs.motion;const rain=$('lrStoryRainIntensity');if(rain)rain.value=prefs.rain;const rainControl=$('lrStoryRainControl');if(rainControl)rainControl.hidden=prefs.theme!=='rain';const status=$('lrStoryThemeStatus');if(status){const rainName={light:'小雨',medium:'中雨',heavy:'大雨'}[prefs.rain];status.textContent=`当前使用：${OFFLINE_THEME_NAMES[prefs.theme]} · ${prefs.motion?'动态效果已开启':'动态效果已关闭'}${prefs.theme==='rain'?' · '+rainName:''}`}}
  function applyOfflineTheme(){const prefs=readOfflineThemePrefs(),work=$('lrSpaceStoryWorkspace'),reader=work?.querySelector('.lr-story-reader'),space=$('space'),app=space?.closest('.app');const active=!!work&&!work.hidden;if(work){work.dataset.offlineTheme=prefs.theme;work.classList.toggle('lr-offline-motion-off',!prefs.motion)}if(reader)reader.dataset.offlineTheme=prefs.theme;if(space){if(active)space.dataset.offlineTheme=prefs.theme;else delete space.dataset.offlineTheme}if(document.body){if(active)document.body.dataset.lrOfflineTheme=prefs.theme;else delete document.body.dataset.lrOfflineTheme}if(app){if(active)app.dataset.lrOfflineTheme=prefs.theme;else delete app.dataset.lrOfflineTheme}const canvas=$('lrStoryThemeCanvas');if(canvas){canvas.style.opacity=({pixel:'.92',rain:'1',cream:'.48',yuzu:'.88'})[prefs.theme]||'.85'}renderOfflineThemeControls();if(active&&prefs.motion&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)startOfflineThemeAnimation();else stopOfflineThemeAnimation()}
  function setOfflineTheme(theme){if(!Object.prototype.hasOwnProperty.call(OFFLINE_THEME_NAMES,theme))return;writeOfflineThemePref(OFFLINE_THEME_KEY,theme);applyOfflineTheme();const status=$('lrStoryThemeStatus');if(status)status.textContent=`已切换并保存：${OFFLINE_THEME_NAMES[theme]}`}
  function makeThemeParticles(theme,w,h){
    const prefs=readOfflineThemePrefs();offlineThemeDrops=[];offlineThemeClouds=[];
    if(theme==='rain'){
      // Each rain level changes the whole weather profile, not only particle count.
      // Light rain is visibly sparse and slow; heavy rain has denser, longer, faster streaks.
      const profiles={
        light:{streaks:42,drops:7,streakSpeed:[.85,2.15],streakLength:[7,22],streakWidth:[.42,.82],streakAlpha:[.075,.19],drift:.52,dropRadius:[2.2,4.8],dropSpeed:[.055,.19],dropTrail:[8,30],dropAlpha:[.20,.39],dropElongation:[.70,1.02],largeChance:.08},
        medium:{streaks:138,drops:26,streakSpeed:[2.0,5.0],streakLength:[13,42],streakWidth:[.68,1.25],streakAlpha:[.16,.38],drift:1.05,dropRadius:[3.2,8.2],dropSpeed:[.16,.48],dropTrail:[22,76],dropAlpha:[.34,.66],dropElongation:[.82,1.28],largeChance:.34},
        heavy:{streaks:286,drops:74,streakSpeed:[4.0,9.6],streakLength:[28,92],streakWidth:[1.05,2.05],streakAlpha:[.30,.66],drift:1.65,dropRadius:[5.0,15.5],dropSpeed:[.34,.92],dropTrail:[58,188],dropAlpha:[.52,.94],dropElongation:[.95,1.62],largeChance:.70}
      };
      const profile=profiles[prefs.rain]||profiles.medium;
      const pick=range=>range[0]+Math.random()*(range[1]-range[0]);
      offlineThemeDrops=Array.from({length:profile.drops},()=>({
        x:Math.random()*w,y:Math.random()*h,r:pick(profile.dropRadius),speed:pick(profile.dropSpeed),
        drift:(Math.random()-.5)*.24,trail:pick(profile.dropTrail),alpha:pick(profile.dropAlpha),
        phase:Math.random()*Math.PI*2,large:Math.random()<profile.largeChance,elongation:pick(profile.dropElongation)
      }));
      return Array.from({length:profile.streaks},()=>({
        x:Math.random()*w,y:Math.random()*h,z:Math.random(),speed:pick(profile.streakSpeed),
        length:pick(profile.streakLength),width:pick(profile.streakWidth),drift:(Math.random()-.5)*profile.drift,
        alpha:pick(profile.streakAlpha),phase:Math.random()*Math.PI*2
      }));
    }
    if(theme==='pixel'){
      offlineThemeClouds=Array.from({length:7},(_,i)=>({x:Math.random()*w,y:h*(.12+i*.115),scale:1.0+Math.random()*1.55,speed:.22+Math.random()*.34,alpha:.24+Math.random()*.18}));
      return Array.from({length:86},()=>({x:Math.random()*w,y:Math.random()*h,size:2+Math.floor(Math.random()*5),speed:.13+Math.random()*.48,alpha:.38+Math.random()*.48,phase:Math.random()*Math.PI*2,shape:Math.random()>.62?'cross':'block',tone:Math.random()>.5?0:1}));
    }
    if(theme==='cream'){
      return Array.from({length:110},()=>({x:Math.random()*w,y:Math.random()*h,size:.45+Math.random()*1.65,speed:.035+Math.random()*.11,drift:(Math.random()-.5)*.07,alpha:.10+Math.random()*.22,phase:Math.random()*Math.PI*2,angle:Math.random()*Math.PI}));
    }
    return Array.from({length:72},()=>({x:Math.random()*w,y:Math.random()*h,r:3.5+Math.random()*11,speed:.32+Math.random()*.9,drift:(Math.random()-.5)*.32,alpha:.28+Math.random()*.48,phase:Math.random()*Math.PI*2,ring:Math.random()>.58}));
  }
  function resizeOfflineThemeCanvas(){
    const canvas=$('lrStoryThemeCanvas');if(!canvas)return;
    const w=Math.max(1,window.innerWidth||canvas.clientWidth||1),h=Math.max(1,window.innerHeight||canvas.clientHeight||1),dpr=Math.min(1.25,window.devicePixelRatio||1);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width='100%';canvas.style.height='100%';
    const ctx=canvas.getContext('2d');if(ctx)ctx.setTransform(dpr,0,0,dpr,0,0);
    offlineThemeCanvasSize={w,h,dpr};offlineThemeParticles=makeThemeParticles(readOfflineThemePrefs().theme,w,h);
  }
  function drawPixelCloud(ctx,x,y,s,alpha){
    ctx.globalAlpha=alpha;ctx.fillStyle='#bda5cb';
    ctx.fillRect(x+10*s,y+5*s,28*s,8*s);ctx.fillRect(x+4*s,y+11*s,44*s,8*s);
    ctx.fillRect(x+13*s,y,13*s,10*s);ctx.fillRect(x+29*s,y+2*s,11*s,8*s);
    ctx.fillStyle='rgba(255,255,255,.58)';ctx.fillRect(x+10*s,y+12*s,30*s,2*s);ctx.globalAlpha=1;
  }
  function drawWaterDrop(ctx,d,now){
    const r=d.r,x=d.x,y=d.y,shine=.68+.28*Math.sin(now/760+d.phase),elong=d.elongation||1;
    ctx.save();
    // A thin, refractive rivulet remains behind each larger drop.
    const trail=ctx.createLinearGradient(x-r*.1,y-r*1.4,x+d.drift*20,y-d.trail);
    trail.addColorStop(0,'rgba(255,255,255,0)');
    trail.addColorStop(.22,`rgba(255,255,255,${d.alpha*.26})`);
    trail.addColorStop(.56,`rgba(112,163,195,${d.alpha*.23})`);
    trail.addColorStop(1,'rgba(255,255,255,0)');
    ctx.strokeStyle=trail;ctx.lineWidth=Math.max(1.05,r*.23);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x,y-r*.55);ctx.quadraticCurveTo(x+d.drift*9,y-d.trail*.52,x+d.drift*18,y-d.trail);ctx.stroke();
    ctx.translate(x,y);ctx.rotate(d.drift*.045);
    ctx.scale(1,elong);
    ctx.beginPath();ctx.moveTo(0,-r*1.15);ctx.bezierCurveTo(r*.68,-r*.96,r*1.02,-r*.24,r*.84,r*.39);ctx.quadraticCurveTo(r*.68,r*1.15,0,r*1.08);ctx.quadraticCurveTo(-r*.84,r*.98,-r*.86,r*.37);ctx.bezierCurveTo(-r*1.02,-r*.32,-r*.62,-r*.98,0,-r*1.15);ctx.closePath();
    const body=ctx.createRadialGradient(-r*.34,-r*.43,.2,r*.05,r*.12,r*1.55);
    body.addColorStop(0,`rgba(255,255,255,${Math.min(.99,shine)})`);
    body.addColorStop(.15,`rgba(255,255,255,${d.alpha*.78})`);
    body.addColorStop(.42,`rgba(226,244,253,${d.alpha*.62})`);
    body.addColorStop(.72,`rgba(135,183,211,${d.alpha*.32})`);
    body.addColorStop(1,`rgba(75,127,161,${d.alpha*.18})`);
    ctx.fillStyle=body;ctx.shadowColor='rgba(56,111,148,.34)';ctx.shadowBlur=r*.9;ctx.fill();ctx.shadowBlur=0;
    // Outer bright rim and a darker refracted lower edge.
    ctx.strokeStyle=`rgba(255,255,255,${Math.min(.98,d.alpha*.98)})`;ctx.lineWidth=Math.max(.8,r*.12);ctx.stroke();
    ctx.beginPath();ctx.ellipse(0,r*.62,r*.63,Math.max(.7,r*.17),0,.12,Math.PI-.12);ctx.strokeStyle=`rgba(69,126,161,${d.alpha*.36})`;ctx.lineWidth=Math.max(.7,r*.09);ctx.stroke();
    // Distinct specular streak and tiny secondary glint.
    ctx.beginPath();ctx.ellipse(-r*.31,-r*.43,Math.max(.8,r*.18),Math.max(1.5,r*.36),-.34,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${Math.min(1,d.alpha*1.12)})`;ctx.fill();
    ctx.beginPath();ctx.ellipse(-r*.03,-r*.62,Math.max(.6,r*.055),Math.max(1,r*.12),-.25,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.88)';ctx.fill();
    ctx.beginPath();ctx.ellipse(r*.36,r*.36,Math.max(.45,r*.12),Math.max(.8,r*.25),.3,0,Math.PI*2);ctx.fillStyle=`rgba(61,112,146,${d.alpha*.24})`;ctx.fill();
    ctx.restore();
  }
  function drawOfflineThemeFrame(now){
    offlineThemeRaf=0;const prefs=readOfflineThemePrefs(),work=$('lrSpaceStoryWorkspace'),canvas=$('lrStoryThemeCanvas');
    if(!canvas||work?.hidden||!prefs.motion||document.hidden||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const theme=prefs.theme,ctx=canvas.getContext('2d');if(!ctx)return;
    if(offlineThemeLastFrame&&now-offlineThemeLastFrame<32){offlineThemeRaf=requestAnimationFrame(drawOfflineThemeFrame);return}
    const {w,h}=offlineThemeCanvasSize;if(!w||!h){resizeOfflineThemeCanvas();offlineThemeRaf=requestAnimationFrame(drawOfflineThemeFrame);return}
    ctx.clearRect(0,0,w,h);const dt=Math.min(2.2,Math.max(.45,(now-(offlineThemeLastFrame||now))/16.67));offlineThemeLastFrame=now;
    if(theme==='pixel'){
      // A softly animated pixel-world: drifting block clouds, a moving tile grid and bright pixel stars.
      const shift=(now*.006)%28;ctx.strokeStyle='rgba(137,103,157,.14)';ctx.lineWidth=1;
      for(let x=-28+shift;x<w+28;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
      for(let y=-28+shift;y<h+28;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
      offlineThemeClouds.forEach((c,i)=>{c.x+=c.speed*dt;if(c.x>w+90)c.x=-100;drawPixelCloud(ctx,c.x,c.y+Math.sin(now/2800+i)*4,c.scale,c.alpha)});
      offlineThemeParticles.forEach(p=>{p.y-=p.speed*dt;p.x+=Math.sin(now/1600+p.phase)*.19*dt;if(p.y< -10){p.y=h+10;p.x=Math.random()*w}const pulse=.45+.55*Math.sin(now/690+p.phase),s=p.size;ctx.globalAlpha=p.alpha*pulse;ctx.fillStyle=p.tone?'#a78db3':'#e3cce9';const x=Math.round(p.x/2)*2,y=Math.round(p.y/2)*2;if(p.shape==='cross'){ctx.fillRect(x+s,y,s,s);ctx.fillRect(x,y+s,s,s);ctx.fillRect(x+s*2,y+s,s,s);ctx.fillRect(x+s,y+s*2,s,s)}else{ctx.fillRect(x,y,s*1.5,s*1.5);ctx.fillRect(x+s,y-s,s,s);ctx.fillRect(x-s,y+s,s,s)}});ctx.globalAlpha=1;
    }else if(theme==='rain'){
      // Atmospheric light/refraction across the pane.
      const glow=ctx.createRadialGradient(w*.18,h*.10,0,w*.18,h*.10,Math.max(w,h)*.82);glow.addColorStop(0,'rgba(255,255,255,.34)');glow.addColorStop(.55,'rgba(190,220,239,.13)');glow.addColorStop(1,'rgba(108,153,184,.045)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
      // Soft, distant city-light bokeh seen through a rain-covered window.
      for(let i=0;i<11;i++){const x=(w*(.07+((i*37)%89)/100)+Math.sin(now/5100+i*1.7)*8)%w,y=h*(.13+((i*23)%78)/100),r=7+(i%4)*5,pulse=.70+.30*Math.sin(now/1800+i*1.3);const bg=ctx.createRadialGradient(x,y,0,x,y,r*2.8);bg.addColorStop(0,`rgba(${i%3===0?'255,246,220':'255,255,255'},${.12*pulse})`);bg.addColorStop(.42,`rgba(179,211,229,${.075*pulse})`);bg.addColorStop(1,'rgba(179,211,229,0)');ctx.fillStyle=bg;ctx.beginPath();ctx.arc(x,y,r*2.8,0,Math.PI*2);ctx.fill()}
      // Subtle vertical pane reflections give the foreground droplets a real glass surface.
      const paneShift=Math.sin(now/6200)*4;ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.12)';for(let i=1;i<4;i++){const x=w*i/4+paneShift;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
      const edge=ctx.createLinearGradient(0,0,w,0);edge.addColorStop(0,'rgba(63,111,142,.10)');edge.addColorStop(.06,'rgba(255,255,255,.02)');edge.addColorStop(.94,'rgba(255,255,255,.02)');edge.addColorStop(1,'rgba(63,111,142,.09)');ctx.fillStyle=edge;ctx.fillRect(0,0,w,h);
      // Layered rain: distant fine rain, nearer elongated streaks.
      offlineThemeParticles.forEach(p=>{p.y+=p.speed*dt*(.82+p.z*1.32);p.x+=p.drift*dt;if(p.y>h+48){p.y=-48;p.x=Math.random()*w}const alpha=p.alpha*(.58+p.z*1.05);const grad=ctx.createLinearGradient(p.x,p.y,p.x-p.drift*2,p.y+p.length*(.7+p.z));grad.addColorStop(0,`rgba(255,255,255,${alpha*.08})`);grad.addColorStop(.28,`rgba(207,229,242,${alpha*.75})`);grad.addColorStop(1,`rgba(100,151,183,${alpha*.35})`);ctx.strokeStyle=grad;ctx.lineWidth=p.width*(.65+p.z*.8);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.drift*2,p.y+p.length*(.7+p.z));ctx.stroke()});
      // Foreground droplets are larger, luminous and slowly slide down the virtual glass surface.
      offlineThemeDrops.forEach(d=>{d.y+=d.speed*dt;d.x+=d.drift*dt+Math.sin(now/1700+d.phase)*.13;if(d.y>h+70){d.y=-70;d.x=Math.random()*w}drawWaterDrop(ctx,d,now)});
      // Gentle vertical refraction bands, like light passing through a wet window.
      const sweep=(now*.024)%(w+320)-160,band=ctx.createLinearGradient(sweep-150,0,sweep+150,0);band.addColorStop(0,'rgba(255,255,255,0)');band.addColorStop(.38,'rgba(255,255,255,.08)');band.addColorStop(.5,'rgba(255,255,255,.28)');band.addColorStop(.62,'rgba(255,255,255,.08)');band.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=band;ctx.fillRect(0,0,w,h);
    }else if(theme==='cream'){
      // Quiet paper fibers and a slow, broad daylight sweep.
      offlineThemeParticles.forEach(p=>{p.x+=p.drift*dt;p.y-=p.speed*dt;if(p.y< -4){p.y=h+4;p.x=Math.random()*w}const pulse=.55+.45*Math.sin(now/4400+p.phase);ctx.globalAlpha=p.alpha*pulse;ctx.strokeStyle='#88877f';ctx.lineWidth=p.size;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+Math.cos(p.angle)*5,p.y+Math.sin(p.angle)*1.8);ctx.stroke()});ctx.globalAlpha=1;
      const sweep=(now*.009)%(w+420)-210,light=ctx.createLinearGradient(sweep-210,0,sweep+210,0);light.addColorStop(0,'rgba(255,255,255,0)');light.addColorStop(.5,'rgba(255,255,255,.32)');light.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    }else if(theme==='yuzu'){
      // Clear soda bubbles with inner highlights, rising at several depths.
      offlineThemeParticles.forEach(p=>{p.y-=p.speed*dt;p.x+=Math.sin(now/1400+p.phase)*.34*dt;if(p.y< -p.r*3){p.y=h+p.r*3;p.x=Math.random()*w}const pulse=.72+.28*Math.sin(now/720+p.phase),r=p.r*(.94+.06*Math.sin(now/820+p.phase));ctx.globalAlpha=p.alpha*pulse;
        const g=ctx.createRadialGradient(p.x-r*.34,p.y-r*.38,.2,p.x,p.y,r*1.25);g.addColorStop(0,'rgba(255,255,255,.82)');g.addColorStop(.4,'rgba(255,255,255,.22)');g.addColorStop(1,'rgba(139,179,119,.10)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(126,163,107,.52)';ctx.lineWidth=.9;ctx.stroke();ctx.beginPath();ctx.ellipse(p.x-r*.28,p.y-r*.34,Math.max(.7,r*.18),Math.max(.9,r*.28),-.4,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.82)';ctx.fill();
        if(p.ring){ctx.beginPath();ctx.arc(p.x,p.y,r*1.55,0,Math.PI*2);ctx.strokeStyle='rgba(224,200,94,.22)';ctx.lineWidth=.7;ctx.stroke()}
      });ctx.globalAlpha=1;
    }
    offlineThemeRaf=requestAnimationFrame(drawOfflineThemeFrame);
  }
  function stopOfflineThemeAnimation(){if(offlineThemeRaf)cancelAnimationFrame(offlineThemeRaf);offlineThemeRaf=0;offlineThemeLastFrame=0;const canvas=$('lrStoryThemeCanvas');if(canvas){const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height)}}
  function startOfflineThemeAnimation(){stopOfflineThemeAnimation();const prefs=readOfflineThemePrefs(),work=$('lrSpaceStoryWorkspace');if(!work||work.hidden||!prefs.motion||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;resizeOfflineThemeCanvas();offlineThemeRaf=requestAnimationFrame(drawOfflineThemeFrame)}
  function injectOfflineThemeStyles(){if($('lrStoryOfflineThemeStyles'))return;const st=document.createElement('style');st.id='lrStoryOfflineThemeStyles';st.textContent=`
/* OFFLINE THEMES 3.0 — page-wide design tokens and full-surface coverage */
#space.lr-space-v2[data-offline-theme="pixel"]{--lr-theme-page:#f6f0e4;--lr-theme-surface:#fffaf0;--lr-theme-card:#fffdf8;--lr-theme-user:#eee4f0;--lr-theme-composer:#f1e8d9;--lr-theme-input:#fffdf8;--lr-theme-text:#554a57;--lr-theme-muted:#927f96;--lr-theme-heading:#59475e;--lr-theme-border:#d7c7d5;--lr-theme-accent:#a985ae;--lr-theme-accent-strong:#846f83;--lr-theme-button:#e6d7eb;--lr-theme-button-text:#5b4860;--lr-theme-shadow:#d8c8d5;--lr-theme-radius:4px;--lr-theme-soft:#f5edf6;background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme="rain"]{--lr-theme-page:linear-gradient(145deg,#dceaf3 0%,#eaf3f8 42%,#d7e7f1 100%);--lr-theme-surface:rgba(245,251,255,.72);--lr-theme-card:rgba(255,255,255,.58);--lr-theme-user:rgba(210,231,245,.56);--lr-theme-composer:rgba(237,247,253,.72);--lr-theme-input:rgba(255,255,255,.76);--lr-theme-text:#314b60;--lr-theme-muted:#7893a8;--lr-theme-heading:#3d6179;--lr-theme-border:rgba(255,255,255,.76);--lr-theme-accent:#7ba6c2;--lr-theme-accent-strong:#477c9f;--lr-theme-button:rgba(238,248,254,.72);--lr-theme-button-text:#426c86;--lr-theme-shadow:rgba(89,132,160,.16);--lr-theme-radius:21px;--lr-theme-soft:rgba(225,240,249,.60);background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme="cream"]{--lr-theme-page:#efeee9;--lr-theme-surface:#faf9f5;--lr-theme-card:#fffefa;--lr-theme-user:#e9e8e1;--lr-theme-composer:rgba(250,249,245,.96);--lr-theme-input:#fffefa;--lr-theme-text:#282825;--lr-theme-muted:#77766f;--lr-theme-heading:#20201e;--lr-theme-border:#d4d2ca;--lr-theme-accent:#292927;--lr-theme-accent-strong:#171715;--lr-theme-button:#fffefa;--lr-theme-button-text:#242422;--lr-theme-shadow:rgba(33,33,30,.08);--lr-theme-radius:13px;--lr-theme-soft:#f0efe9;background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme="yuzu"]{--lr-theme-page:linear-gradient(145deg,#edf4e3 0%,#faf5d8 52%,#edf5e8 100%);--lr-theme-surface:rgba(250,252,242,.86);--lr-theme-card:rgba(255,255,250,.92);--lr-theme-user:rgba(246,239,188,.82);--lr-theme-composer:rgba(247,251,239,.91);--lr-theme-input:rgba(255,255,255,.93);--lr-theme-text:#435c49;--lr-theme-muted:#809779;--lr-theme-heading:#557252;--lr-theme-border:#d3dfc8;--lr-theme-accent:#8ca77f;--lr-theme-accent-strong:#68885f;--lr-theme-button:#e4efd9;--lr-theme-button-text:#526c4c;--lr-theme-shadow:rgba(106,140,93,.11);--lr-theme-radius:18px;--lr-theme-soft:#f1f6e9;background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important}
/* Extend each theme to the app shell and page gutters, not only the inner reader column. */
body:has(#space.active[data-offline-theme="pixel"]),.app:has(#space.active[data-offline-theme="pixel"]){background:#f6f0e4!important}
body:has(#space.active[data-offline-theme="rain"]),.app:has(#space.active[data-offline-theme="rain"]){background:linear-gradient(145deg,#dceaf3 0%,#edf5fa 48%,#d8e8f2 100%)!important}
body:has(#space.active[data-offline-theme="cream"]),.app:has(#space.active[data-offline-theme="cream"]){background:#efeee9!important}
body:has(#space.active[data-offline-theme="yuzu"]),.app:has(#space.active[data-offline-theme="yuzu"]){background:linear-gradient(145deg,#edf4e3 0%,#faf5d8 52%,#edf5e8 100%)!important}
body:has(#space.active[data-offline-theme]) #systemAppbar{border-bottom:1px solid transparent!important;backdrop-filter:blur(24px) saturate(1.45)!important;-webkit-backdrop-filter:blur(24px) saturate(1.45)!important}
#systemAppbar:has(~ #space.active[data-offline-theme="pixel"]){background:rgba(247,243,249,.96)!important;color:#59475e!important;border-bottom-color:#d7c7d5!important}
#systemAppbar:has(~ #space.active[data-offline-theme="pixel"]) .system-back{background:#fffaf0!important;border:2px solid #a985ae!important;color:#59475e!important;box-shadow:2px 2px 0 #d8c8d5!important}
#systemAppbar:has(~ #space.active[data-offline-theme="rain"]){background:rgba(232,244,251,.76)!important;color:#3d6179!important;border-bottom-color:rgba(255,255,255,.78)!important}
#systemAppbar:has(~ #space.active[data-offline-theme="rain"]) .system-back{background:linear-gradient(145deg,rgba(255,255,255,.9),rgba(216,237,248,.62))!important;border:1px solid rgba(255,255,255,.95)!important;color:#426c86!important;box-shadow:0 5px 15px rgba(82,130,160,.16),inset 0 1px 0 #fff!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
#systemAppbar:has(~ #space.active[data-offline-theme="cream"]){background:rgba(244,243,237,.97)!important;color:#282825!important;border-bottom-color:rgba(30,30,28,.10)!important}
#systemAppbar:has(~ #space.active[data-offline-theme="cream"]) .system-back{background:#fffefa!important;border:1px solid #d4d2ca!important;color:#242422!important;box-shadow:0 3px 8px rgba(33,33,30,.08)!important}
#systemAppbar:has(~ #space.active[data-offline-theme="yuzu"]){background:rgba(242,247,230,.94)!important;color:#526c4c!important;border-bottom-color:rgba(149,174,130,.22)!important}
#systemAppbar:has(~ #space.active[data-offline-theme="yuzu"]) .system-back{background:linear-gradient(145deg,#fffef1,#e9f2db)!important;border:1px solid #c9d9bc!important;color:#526c4c!important;box-shadow:0 4px 12px rgba(106,140,93,.14)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace{display:block;width:100%!important;max-width:none!important;min-height:calc(100dvh - 52px)!important;margin:0!important;padding:0 0 calc(112px + env(safe-area-inset-bottom,0px))!important;background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important;box-sizing:border-box}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader{position:relative;isolation:isolate;overflow:visible;max-width:860px;width:100%;min-height:calc(100dvh - 64px);margin:0 auto;padding:9px 16px calc(28px + env(safe-area-inset-bottom,0px));background:transparent!important;color:var(--lr-theme-text)!important;box-sizing:border-box}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-theme-canvas{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;opacity:.9;display:block;mix-blend-mode:normal}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader>*:not(.lr-story-theme-canvas){position:relative;z-index:2}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-top{position:sticky;top:0;z-index:12;display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:9px;padding:9px 0 13px;margin:0 0 14px;background:color-mix(in srgb,var(--lr-theme-page) 76%,transparent);border-bottom:1px solid var(--lr-theme-border);backdrop-filter:blur(18px) saturate(1.25);-webkit-backdrop-filter:blur(18px) saturate(1.25)}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-title{color:var(--lr-theme-heading)!important;font:650 14px/1.35 -apple-system,BlinkMacSystemFont,'Noto Sans SC',sans-serif;letter-spacing:.08em;text-align:center;min-width:0}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-back-btn{display:grid;place-items:center;justify-self:start;width:40px;height:40px;min-height:40px;padding:0;border-radius:50%;font:26px/1 -apple-system,BlinkMacSystemFont,sans-serif;text-decoration:none}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-gear-btn{justify-self:end;width:42px;height:42px;min-height:42px;padding:0;border-radius:50%;font-size:19px}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-transcript{position:relative;z-index:1;max-width:790px;margin:14px auto 22px;gap:18px}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg{position:relative;isolation:isolate;overflow:hidden;padding:17px 17px 14px;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;background:var(--lr-theme-card)!important;color:var(--lr-theme-text)!important;box-shadow:0 8px 24px var(--lr-theme-shadow)!important;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0);transition:background .35s ease,border-color .35s ease,box-shadow .35s ease}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg.user{margin-left:5%;margin-right:0;background:var(--lr-theme-user)!important;border-color:var(--lr-theme-border)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg.assistant{margin-left:0;margin-right:1%;background:var(--lr-theme-card)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-head{color:var(--lr-theme-muted)!important;font:650 10px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.045em}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-body{color:var(--lr-theme-text)!important;font:16px/2.02 Georgia,'Noto Serif SC',serif;letter-spacing:.012em;white-space:pre-wrap;overflow-wrap:anywhere}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg.user .lr-story-msg-body{font:14px/1.85 -apple-system,BlinkMacSystemFont,'Noto Sans SC',sans-serif}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary{color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary:after{color:var(--lr-theme-accent)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-top:12px}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-actions .lr-story-pixel-btn{min-height:34px;padding:7px 11px;font-size:10px}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-composer{position:sticky;bottom:calc(env(safe-area-inset-bottom,0px) + 7px);z-index:30;margin:16px 0 0;padding:14px;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;background:var(--lr-theme-composer)!important;color:var(--lr-theme-text)!important;box-shadow:0 10px 28px var(--lr-theme-shadow)!important;backdrop-filter:blur(22px) saturate(1.25);-webkit-backdrop-filter:blur(22px) saturate(1.25)}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-composer textarea{width:100%;min-height:82px;max-height:220px;padding:13px;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 4px)!important;background:var(--lr-theme-input)!important;color:var(--lr-theme-text)!important;font:14px/1.7 -apple-system,BlinkMacSystemFont,'Noto Sans SC',sans-serif;box-sizing:border-box}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-pixel-btn{min-height:38px;padding:8px 12px;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 4px)!important;background:var(--lr-theme-button)!important;color:var(--lr-theme-button-text)!important;box-shadow:0 3px 9px var(--lr-theme-shadow)!important;font:650 11px/1.35 -apple-system,BlinkMacSystemFont,'Noto Sans SC',sans-serif;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .25s ease}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-pixel-btn:active{transform:translateY(1px);box-shadow:0 1px 4px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-pixel-btn.primary,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace #lrStoryGenerate{background:var(--lr-theme-accent-strong)!important;color:#fff!important;border-color:var(--lr-theme-accent-strong)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-input,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-textarea,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-select,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-toolbar select{width:100%;background:var(--lr-theme-input)!important;color:var(--lr-theme-text)!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 5px)!important;box-shadow:inset 0 1px 2px rgba(0,0,0,.025)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-field>label,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-label{color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-muted,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-theme-note{color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-long-memory,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-timeline,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-toolbar,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-live-region,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace #lrStoryLiveDraft,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-source-alert{border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;background:var(--lr-theme-surface)!important;color:var(--lr-theme-text)!important;box-shadow:0 6px 20px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-long-memory-head h3{color:var(--lr-theme-heading)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-memory-mark{background:var(--lr-theme-soft)!important;border:1px solid var(--lr-theme-border)!important;color:var(--lr-theme-accent-strong)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-memory-status{background:var(--lr-theme-soft)!important;border-left:3px solid var(--lr-theme-accent)!important;color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-hint,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-status{color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-sheet{background:var(--lr-theme-surface)!important;color:var(--lr-theme-text)!important;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;box-shadow:0 20px 64px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-group{background:var(--lr-theme-card)!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 4px)!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-group>summary,#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-head h2{color:var(--lr-theme-heading)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-head p{color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-profile-sheet{background:var(--lr-theme-surface)!important;color:var(--lr-theme-text)!important;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;box-shadow:0 18px 52px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-profile-sheet h3{color:var(--lr-theme-heading)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-theme-controls{background:var(--lr-theme-soft)!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 5px)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-theme-status{color:var(--lr-theme-muted)!important}
/* ORIGINAL PIXEL — preserve the original visual language, but make the moving pixel scene unmistakable. */
#space.lr-space-v2[data-offline-theme="pixel"] #lrSpaceStoryWorkspace .lr-story-msg{border:2px solid #d7c7d5!important;border-radius:4px!important;box-shadow:3px 3px 0 #d8c8d5!important}
#space.lr-space-v2[data-offline-theme="pixel"] #lrSpaceStoryWorkspace .lr-story-pixel-btn{border:2px solid #826a83!important;border-radius:3px!important;box-shadow:3px 3px 0 #c7b4ca!important}
#space.lr-space-v2[data-offline-theme="pixel"] #lrSpaceStoryWorkspace .lr-story-composer{border:2px solid #846f83!important;border-radius:4px!important;box-shadow:4px 4px 0 #d8c8d5!important}
#space.lr-space-v2[data-offline-theme="pixel"] #lrSpaceStoryWorkspace .lr-story-reader-top{background:rgba(246,240,228,.82)}
/* RAIN GLASS — cool translucent glass surfaces, actual depth, refraction and liquid highlights. */
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-reader:before{content:'';position:absolute;inset:-20px -50vw 0;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 14% 8%,rgba(255,255,255,.74),transparent 34%),radial-gradient(ellipse at 86% 28%,rgba(154,197,222,.19),transparent 38%),linear-gradient(115deg,rgba(255,255,255,.12),transparent 42%,rgba(255,255,255,.16));}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-msg,#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-composer,#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-long-memory,#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-timeline{background:linear-gradient(145deg,rgba(255,255,255,.72),rgba(239,248,253,.42))!important;border:1px solid rgba(255,255,255,.84)!important;box-shadow:0 14px 36px rgba(73,117,146,.13),inset 0 1px 0 rgba(255,255,255,.94),inset 0 -1px 0 rgba(129,169,193,.12)!important;backdrop-filter:blur(26px) saturate(1.55)!important;-webkit-backdrop-filter:blur(26px) saturate(1.55)!important;border-radius:21px!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-msg:before,#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-composer:before{content:'';position:absolute;inset:1px 1px auto;height:38%;border-radius:inherit;pointer-events:none;background:linear-gradient(170deg,rgba(255,255,255,.50),rgba(255,255,255,.10) 42%,transparent);opacity:.78}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-msg.user{background:linear-gradient(145deg,rgba(211,234,248,.72),rgba(226,241,249,.44))!important;border-color:rgba(178,211,231,.72)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-composer textarea{background:rgba(250,254,255,.76)!important;border:1px solid rgba(164,198,218,.60)!important;box-shadow:inset 0 2px 8px rgba(89,135,162,.06)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-pixel-btn{background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(225,241,250,.58))!important;border:1px solid rgba(255,255,255,.9)!important;color:#426b85!important;box-shadow:0 5px 15px rgba(82,130,160,.12),inset 0 1px 0 #fff!important;border-radius:14px!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-pixel-btn.primary,#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace #lrStoryGenerate{background:linear-gradient(135deg,#8dbbd5,#6799b8)!important;color:#fff!important;border:1px solid rgba(255,255,255,.8)!important;box-shadow:0 8px 20px rgba(86,139,171,.23)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-reader-top{background:rgba(233,245,252,.58);border-color:rgba(255,255,255,.7);backdrop-filter:blur(26px) saturate(1.6);-webkit-backdrop-filter:blur(26px) saturate(1.6)}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-settings-sheet{background:rgba(234,246,253,.82)!important;backdrop-filter:blur(28px) saturate(1.55)!important;-webkit-backdrop-filter:blur(28px) saturate(1.55)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-settings-group{background:rgba(255,255,255,.55)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-theme-preview.rain{box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 5px 16px rgba(76,125,156,.13)}
/* CREAM MONO — warm porcelain white, ink-black typography and quiet editorial structure. */
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-msg{box-shadow:0 5px 19px rgba(25,25,22,.045),inset 0 1px 0 rgba(255,255,255,.95)!important}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-msg.user{border-left:3px solid #292927!important}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-pixel-btn{font-weight:650;letter-spacing:.01em}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-pixel-btn.primary,#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace #lrStoryGenerate{background:#242422!important;color:#fffefa!important}
/* YUZU SODA — vivid but soft citrus green with sunny yellow user notes and glass bubbles. */
#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace .lr-story-msg{box-shadow:0 10px 26px rgba(107,143,91,.10),inset 0 1px 0 rgba(255,255,255,.94)!important}
#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace .lr-story-msg.user{background:linear-gradient(145deg,rgba(251,246,202,.96),rgba(244,239,190,.76))!important;border-color:rgba(209,195,117,.52)!important}
#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace .lr-story-pixel-btn.primary,#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace #lrStoryGenerate{background:linear-gradient(135deg,#8eae80,#71986a)!important;color:#fff!important}
#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace .lr-story-composer{background:rgba(249,252,239,.90)!important}
/* App header back button stays visible while the Offline Workspace is open. */
#systemAppbar:has(~ #space.active[data-offline-theme]) .system-back{display:grid!important;visibility:visible!important;opacity:1!important;place-items:center!important;flex:0 0 32px!important;width:32px!important;height:32px!important;min-width:32px!important;padding:0!important;border-radius:50%!important;font-size:27px!important;line-height:1!important}
#space.lr-space-v2 #lrSpaceStoryWorkspace[hidden]{display:none!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-theme-canvas{pointer-events:none!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace.lr-offline-motion-off .lr-story-theme-canvas{display:none!important}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-settings-overlay{position:fixed!important;inset:0!important;z-index:2147483640!important}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-settings-sheet{max-height:100%;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card{border:1px solid var(--lr-theme-border,#ddd0dc);border-radius:12px;background:var(--lr-theme-card,#fffdf8);color:var(--lr-theme-text,#66566a)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card.is-selected{border:2px solid var(--lr-theme-accent,#92759a);box-shadow:0 0 0 3px color-mix(in srgb,var(--lr-theme-accent,#92759a) 14%,transparent)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-check{background:var(--lr-theme-accent-strong,#8e7195)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion{color:var(--lr-theme-text,#716475)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion input{accent-color:var(--lr-theme-accent-strong,#8d7293)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-rain-control{color:var(--lr-theme-muted,#73899b)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-rain-control[hidden]{display:none!important}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-status{font-size:10px;margin:9px 1px 0}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-note{font-size:9px;line-height:1.6;margin:7px 1px 0}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview{height:72px;border-radius:9px}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.pixel{background:repeating-linear-gradient(90deg,#eee5f1 0 12px,#dfd0e7 12px 13px),repeating-linear-gradient(#eee5f1 0 12px,#dfd0e7 12px 13px)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.rain{background:linear-gradient(145deg,#9fc5dd,#e9f5fc 48%,#84b2ce)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.cream{background:linear-gradient(145deg,#e7e6df,#fffefa)}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.yuzu{background:linear-gradient(145deg,#c8dfb8,#f5edaf 58%,#f8fbf1)}
@media(max-width:430px){#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader{padding-left:12px;padding-right:12px}#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg{padding:15px 13px 12px}#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-body{font-size:15px;line-height:1.96}#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-top{grid-template-columns:40px minmax(0,1fr) 42px}}
@media(prefers-reduced-motion:reduce){#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview *{animation:none!important}#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-canvas{display:none!important}}
`;document.head.appendChild(st)}
  function injectOfflineFocusStyles(){if($('lrStoryOfflineFocusStyles'))return;const st=document.createElement('style');st.id='lrStoryOfflineFocusStyles';st.textContent=`
#space.lr-space-v2 .lr-story-focus-top{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);padding:8px 0 12px}
#space.lr-space-v2 .lr-story-focus-spacer{min-width:1px}
#space.lr-space-v2 .lr-story-gear-btn{justify-self:end;width:42px;height:42px;min-height:42px;padding:0;font-size:18px;border-radius:50%;background:#fffaf0}
/* Keep the modal above story transcript cards, the global app bar and the bottom dock.
   The reader is an isolated stacking context for the animated canvas, so elevate that
   context only while settings are open, then place the panel above all reader children. */
body.lr-story-settings-open #space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-reader{z-index:2147483000!important}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-reader>#lrStorySettingsPanel{position:fixed!important;inset:0!important;z-index:2147483640!important;pointer-events:auto!important}
#space.lr-space-v2 .lr-story-settings-overlay{position:fixed;inset:0;z-index:2147483640!important;display:flex;align-items:stretch;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 12px) 12px calc(env(safe-area-inset-bottom,0px) + 12px);background:rgba(49,39,52,.48);backdrop-filter:blur(5px);box-sizing:border-box;pointer-events:auto;touch-action:pan-y}
#space.lr-space-v2 .lr-story-settings-overlay[hidden]{display:none!important}
#space.lr-space-v2 .lr-story-settings-sheet{position:relative;z-index:1;pointer-events:auto;width:100%;max-width:620px;max-height:100%;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;background:#f6f0e4;border:2px solid #8a728d;box-shadow:5px 5px 0 #cbb9ca;padding:14px;border-radius:5px;box-sizing:border-box}
#space.lr-space-v2 .lr-story-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:2px 0 12px;border-bottom:1px solid #d9c8d8;margin-bottom:10px}
#space.lr-space-v2 .lr-story-settings-head h2{font:700 19px/1.35 ui-monospace,monospace;color:#59475e;margin:5px 0}
#space.lr-space-v2 .lr-story-settings-head p{font-size:11px;line-height:1.6;color:#99899a;margin:0}
#space.lr-space-v2 .lr-story-settings-group{border:1px solid #d9c8d8;background:#fffaf0;margin:9px 0;padding:11px 12px}
#space.lr-space-v2 .lr-story-settings-group>summary{font:700 12px/1.5 ui-monospace,monospace;color:#755f79;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px}
#space.lr-space-v2 .lr-story-settings-group>summary::-webkit-details-marker{display:none}
#space.lr-space-v2 .lr-story-settings-group>summary:after{content:'＋';font-size:16px;color:#a184a5}
#space.lr-space-v2 .lr-story-settings-group[open]>summary:after{content:'－'}
#space.lr-space-v2 .lr-story-settings-content{padding-top:8px}
#space.lr-space-v2 .lr-story-settings-actions{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}
#space.lr-space-v2 .lr-story-settings-actions button{flex:1;min-width:120px}
#space.lr-space-v2 .lr-story-settings-group .lr-story-output-toolbar{margin-top:10px}
body.lr-story-settings-open{overflow:hidden}
@media(max-width:390px){#space.lr-space-v2 .lr-story-settings-sheet{padding:11px}#space.lr-space-v2 .lr-story-settings-actions button{min-width:calc(50% - 7px)}}
`;document.head.appendChild(st)}
  function injectOfflineThemeControlStyles(){
    if($('lrStoryOfflineThemeControlStyles'))return;
    const st=document.createElement('style');st.id='lrStoryOfflineThemeControlStyles';st.textContent=`
/* Theme picker: four separated, readable preview cards on narrow mobile screens. */
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-group{padding:15px!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-intro{display:block;margin:10px 0 15px!important;line-height:1.75!important;font-size:12px!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;width:100%!important;margin:0 0 15px!important;align-items:stretch!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card{position:relative!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:5px!important;box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:142px!important;margin:0!important;padding:9px!important;overflow:hidden!important;text-align:left!important;white-space:normal!important;line-height:1.35!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card .lr-story-theme-preview{position:relative!important;display:block!important;flex:0 0 76px!important;width:100%!important;height:76px!important;min-height:76px!important;margin:0 0 3px!important;overflow:hidden!important;border-radius:9px!important;box-sizing:border-box!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card strong{display:block!important;min-width:0!important;padding-right:29px!important;font-size:13px!important;line-height:1.4!important;font-weight:750!important;white-space:normal!important;overflow-wrap:anywhere!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card small{display:block!important;min-width:0!important;color:var(--lr-theme-muted,#887b8c)!important;font-size:9px!important;line-height:1.35!important;letter-spacing:.075em!important;white-space:normal!important;overflow-wrap:anywhere!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-check{position:absolute!important;top:10px!important;right:10px!important;display:grid!important;place-items:center!important;width:23px!important;height:23px!important;padding:0!important;border:1px solid rgba(255,255,255,.82)!important;border-radius:50%!important;background:var(--lr-theme-accent-strong,#8e7195)!important;color:#fff!important;font:700 13px/1 sans-serif!important;opacity:0!important;transform:scale(.8)!important;transition:opacity .18s ease,transform .18s ease!important;box-shadow:0 2px 7px rgba(0,0,0,.12)!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card.is-selected .lr-story-theme-check{opacity:1!important;transform:scale(1)!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card.is-selected{padding:8px!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.pixel{background:linear-gradient(135deg,#f7eff8,#e6d8eb 56%,#d5c4dc)!important;background-image:linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(135deg,#f7eff8,#e6d8eb 56%,#d5c4dc)!important;background-size:14px 14px,14px 14px,auto!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.rain{background:radial-gradient(ellipse at 22% 18%,rgba(255,255,255,.9),transparent 38%),linear-gradient(135deg,#8fb8d0,#eaf6fc 52%,#a6c9dc)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.94)!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.cream{background:linear-gradient(145deg,#fffefa,#e8e7df)!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-preview.yuzu{background:radial-gradient(circle at 80% 20%,rgba(255,255,255,.8),transparent 28%),linear-gradient(135deg,#c9dfbb,#f4edbb 58%,#f8fbf2)!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-controls{display:grid!important;grid-template-columns:1fr!important;gap:11px!important;padding:12px!important;margin:0!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion{display:flex!important;align-items:center!important;gap:11px!important;min-width:0!important;padding:10px 11px!important;border-radius:11px!important;line-height:1.45!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion input{flex:0 0 auto!important;width:19px!important;height:19px!important;margin:0!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion span{display:flex!important;flex-direction:column!important;gap:2px!important;min-width:0!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion b{font-size:12px!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-motion small{font-size:10px!important;line-height:1.45!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-rain-control{display:grid!important;grid-template-columns:1fr!important;gap:7px!important;min-width:0!important;padding:2px 1px 0!important;font-size:11px!important;font-weight:700!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-rain-control select{display:block!important;width:100%!important;min-width:0!important;min-height:43px!important;box-sizing:border-box!important;padding:9px 12px!important;border-radius:10px!important;font-size:12px!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-status{display:block!important;margin:11px 2px 0!important;font-size:11px!important;line-height:1.55!important;}
#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-note{display:block!important;margin:7px 2px 0!important;font-size:10px!important;line-height:1.6!important;}
@media(max-width:360px){#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-grid{gap:9px!important;}#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card{min-height:134px!important;padding:8px!important;}#space.lr-space-v2 #lrSpaceStoryWorkspace .lr-story-theme-card .lr-story-theme-preview{height:66px!important;min-height:66px!important;flex-basis:66px!important;}}
`;
    document.head.appendChild(st);
  }
  function injectOfflineThemeQualityStyles(){
    if($('lrStoryOfflineThemeQualityStyles'))return;
    const st=document.createElement('style');st.id='lrStoryOfflineThemeQualityStyles';st.textContent=`
/* OFFLINE THEMES QUALITY PASS — harmonise every visible surface, not only message shells. */
#space.lr-space-v2[data-offline-theme],#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader{background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important}
body:has(#space.active[data-offline-theme="pixel"]),body:has(#space.active[data-offline-theme="pixel"]) .app{background:#f6f0e4!important}
body:has(#space.active[data-offline-theme="rain"]),body:has(#space.active[data-offline-theme="rain"]) .app{background:linear-gradient(145deg,#d7e8f3 0%,#edf6fb 44%,#d5e7f2 100%)!important}
body:has(#space.active[data-offline-theme="cream"]),body:has(#space.active[data-offline-theme="cream"]) .app{background:#efeee9!important}
body:has(#space.active[data-offline-theme="yuzu"]),body:has(#space.active[data-offline-theme="yuzu"]) .app{background:linear-gradient(145deg,#edf4e3 0%,#faf5d8 52%,#edf5e8 100%)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace{padding:0!important;margin:0!important;width:100%!important;max-width:none!important;min-height:calc(100dvh - 52px)!important;background:var(--lr-theme-page)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader{width:100%!important;max-width:900px!important;margin:0 auto!important;background:transparent!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-top{grid-template-columns:82px minmax(0,1fr) 46px!important;min-height:54px!important;gap:10px!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-top .lr-story-back-btn{display:flex!important;visibility:visible!important;opacity:1!important;position:relative!important;grid-column:1!important;grid-row:1!important;align-items:center!important;justify-content:center!important;justify-self:start!important;align-self:center!important;width:78px!important;min-width:78px!important;max-width:78px!important;height:40px!important;min-height:40px!important;padding:0 7px!important;overflow:visible!important;color:var(--lr-theme-button-text)!important;background:var(--lr-theme-button)!important;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;box-shadow:0 4px 12px var(--lr-theme-shadow)!important;font:650 12px/1.2 -apple-system,BlinkMacSystemFont,'Noto Sans SC',sans-serif!important;letter-spacing:.02em!important;z-index:5!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-title{grid-column:2!important;grid-row:1!important;text-align:center!important;justify-self:stretch!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-gear-btn{grid-column:3!important;grid-row:1!important}
/* The assistant entry uses a <details> fold. Its old cream background was the main source of theme leakage. */
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-fold{display:block!important;min-width:0!important;margin:0!important;padding:0!important;background:transparent!important;border:0!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;min-height:38px!important;margin:0 0 10px!important;padding:7px 9px!important;background:var(--lr-theme-summary,var(--lr-theme-soft))!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 4px)!important;color:var(--lr-theme-heading)!important;font:650 11px/1.45 -apple-system,BlinkMacSystemFont,'Noto Sans SC',sans-serif!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary:after{color:var(--lr-theme-accent-strong)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-fold .lr-story-msg-body{display:block!important;padding:7px 3px 2px!important;margin:0!important;background:transparent!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-body{background:transparent!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-msg-actions{background:transparent!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-toolbar,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-progress,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-live-region,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace #lrStoryLiveDraft,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-long-memory,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-timeline,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-source-alert{background:var(--lr-theme-surface)!important;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;color:var(--lr-theme-text)!important;box-shadow:0 7px 22px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-composer{background:var(--lr-theme-composer)!important;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;color:var(--lr-theme-text)!important;box-shadow:0 12px 30px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-composer textarea{background:var(--lr-theme-input)!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 5px)!important;color:var(--lr-theme-text)!important;box-shadow:inset 0 1px 4px rgba(0,0,0,.045)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-composer textarea::placeholder{color:var(--lr-theme-muted)!important;opacity:.88}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-toolbar label,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-hint,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-status,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-generation-mode label{color:var(--lr-theme-muted)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-output-toolbar select,
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-generation-mode select{background:var(--lr-theme-input)!important;color:var(--lr-theme-text)!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 5px)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-sheet{background:var(--lr-theme-page)!important;color:var(--lr-theme-text)!important;border:1px solid var(--lr-theme-border)!important;border-radius:var(--lr-theme-radius)!important;box-shadow:0 24px 70px var(--lr-theme-shadow)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-group{background:var(--lr-theme-surface)!important;border:1px solid var(--lr-theme-border)!important;border-radius:calc(var(--lr-theme-radius) - 2px)!important;color:var(--lr-theme-text)!important}
#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-settings-group>summary{color:var(--lr-theme-heading)!important}
/* RAIN GLASS: transparent layered glass across both user and assistant messages and the composer. */
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-msg{background:linear-gradient(145deg,rgba(255,255,255,.48),rgba(220,239,250,.29))!important;border:1px solid rgba(255,255,255,.88)!important;box-shadow:0 16px 42px rgba(70,119,151,.14),inset 0 1px 0 rgba(255,255,255,.96),inset 0 -1px 0 rgba(98,149,181,.15)!important;backdrop-filter:blur(28px) saturate(1.72)!important;-webkit-backdrop-filter:blur(28px) saturate(1.72)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-msg.user{background:linear-gradient(145deg,rgba(205,231,246,.52),rgba(231,244,251,.30))!important;border-color:rgba(185,218,237,.88)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary{background:linear-gradient(135deg,rgba(255,255,255,.42),rgba(210,233,246,.26))!important;border-color:rgba(255,255,255,.82)!important;backdrop-filter:blur(16px) saturate(1.6)!important;-webkit-backdrop-filter:blur(16px) saturate(1.6)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-composer{background:linear-gradient(145deg,rgba(245,252,255,.58),rgba(208,231,245,.35))!important;border-color:rgba(255,255,255,.9)!important;backdrop-filter:blur(30px) saturate(1.7)!important;-webkit-backdrop-filter:blur(30px) saturate(1.7)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-composer textarea{background:rgba(255,255,255,.48)!important;border-color:rgba(255,255,255,.9)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important}
#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-reader:after{content:'';position:fixed;inset:0;z-index:1;pointer-events:none;background:linear-gradient(112deg,rgba(255,255,255,.10),transparent 25%,rgba(115,169,199,.08) 52%,transparent 70%,rgba(255,255,255,.14));background-size:220% 100%;animation:lrRainGlassReflection 13s ease-in-out infinite alternate}
@keyframes lrRainGlassReflection{0%{background-position:0% 50%;opacity:.55}100%{background-position:100% 50%;opacity:1}}
/* PIXEL: recognizable block-clouds and moving tile light; CREAM: visible paper-light drift; YUZU: glass bubbles. */
#space.lr-space-v2[data-offline-theme="pixel"] #lrSpaceStoryWorkspace .lr-story-reader{background-color:transparent!important}
#space.lr-space-v2[data-offline-theme="pixel"] #lrSpaceStoryWorkspace .lr-story-msg{border:2px solid #bda8c4!important;box-shadow:4px 4px 0 rgba(190,169,197,.52),0 8px 22px rgba(89,63,102,.08)!important}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-msg{background:linear-gradient(145deg,#fffefa,#f8f7f1)!important;border:1px solid #d6d4cc!important;box-shadow:0 8px 24px rgba(24,24,22,.055),inset 0 1px 0 #fff!important}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-msg.user{background:linear-gradient(145deg,#eeede7,#e5e4dd)!important;border-left:3px solid #282826!important}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary{background:#f1f0e9!important;border-color:#dfded6!important;color:#292927!important}
#space.lr-space-v2[data-offline-theme="cream"] #lrSpaceStoryWorkspace .lr-story-composer{background:linear-gradient(145deg,#fffefa,#f3f2ec)!important;border-color:#d7d5cd!important}
#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace .lr-story-msg-fold>summary{background:linear-gradient(135deg,#f7f9ec,#edf4df)!important;border-color:#d6e1c8!important;color:#526d4d!important}
#space.lr-space-v2[data-offline-theme="yuzu"] #lrSpaceStoryWorkspace .lr-story-composer{background:linear-gradient(145deg,rgba(251,253,242,.96),rgba(231,241,219,.88))!important;border-color:#d4e1c9!important}
@media(max-width:430px){#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-reader-top{grid-template-columns:78px minmax(0,1fr) 44px!important}#space.lr-space-v2[data-offline-theme] #lrSpaceStoryWorkspace .lr-story-back-btn{width:74px!important;min-width:74px!important;max-width:74px!important}}
@media(prefers-reduced-motion:reduce){#space.lr-space-v2[data-offline-theme="rain"] #lrSpaceStoryWorkspace .lr-story-reader:after{animation:none!important}}
`;
    document.head.appendChild(st);
  }
  function showScreen(id){
    const root=$('space');if(!root)return;
    root.querySelectorAll('.lr-space-v2-screen').forEach(el=>{el.hidden=true;el.classList.remove('is-current')});
    const page=$(id);if(page){page.hidden=false;page.classList.add('is-current');page.scrollTop=0}
    window.scrollTo({top:0,behavior:'auto'});
    if(id==='lrSpaceStoryWorkspace'){applyOfflineTheme()}else{stopOfflineThemeAnimation();const space=$('space');if(space)delete space.dataset.offlineTheme;}
  }
  const SPACE_CSS_KEY='love-record-space-custom-css-v1';
  const SPACE_CSS_STARTER=`/* SPACE 全局 CSS 示例模板
   只影响 LOVE RECORD 的 SPACE，不影响其他 APP。
   修改下面的颜色、圆角、间距和字体，就能调整 SPACE 的整体外观。
*/
:root {
  --lr-space-bg: #f6f0e4;
  --lr-space-panel: #fffaf0;
  --lr-space-card: #fffdf8;
  --lr-space-text: #594d5b;
  --lr-space-muted: #99899a;
  --lr-space-accent: #a985ae;
  --lr-space-border: #826a83;
  --lr-space-shadow: #d8c8d5;
}

/* SPACE 页面整体 */
.lr-space-v2-screen,
.lr-story-screen {
  background: var(--lr-space-bg);
  color: var(--lr-space-text);
}

/* 故事工作台、档案卡片与资料面板 */
.lr-story-hub,
.lr-story-panel,
.lr-story-card,
.lr-space-v2-panel {
  background: var(--lr-space-panel);
  border-color: var(--lr-space-border);
  color: var(--lr-space-text);
}

/* SPACE 按钮 */
.lr-story-pixel-btn,
.lr-space-primary,
.lr-space-secondary {
  border-radius: 4px;
  border-color: var(--lr-space-border);
  box-shadow: 3px 3px 0 var(--lr-space-shadow);
}

.lr-story-pixel-btn.primary,
.lr-space-primary {
  background: var(--lr-space-accent);
}

/* 剧情正文卡片 */
.lr-story-msg {
  background: var(--lr-space-card);
  border-color: var(--lr-space-border);
  border-radius: 4px;
}

.lr-story-msg-body {
  color: var(--lr-space-text);
  font-size: 16px;
  line-height: 2;
}

/* 表单控件 */
.lr-story-input,
.lr-story-textarea,
.lr-story-select,
.lr-story-composer textarea {
  border-radius: 4px;
  background: var(--lr-space-card);
  color: var(--lr-space-text);
}

/* 手机端正文间距 */
@media (max-width: 600px) {
  .lr-story-msg { padding: 12px; }
  .lr-story-msg-body { font-size: 15px; line-height: 1.95; }
}`;
  function scopeCustomCss(input){
    let css=String(input||'').replace(/\/\*[\s\S]*?\*\//g,'').trim();
    if(!css)return '';
    if(/@import|@namespace|@charset|url\s*\(|expression\s*\(|javascript\s*:|behavior\s*:|-moz-binding|\\x3c\s*\/\s*style/i.test(css))throw new Error('不允许导入外部资源、执行表达式或使用脚本相关内容。');
    function splitSelectors(value){const out=[];let buf='',depth=0,quote='';for(let i=0;i<value.length;i++){const c=value[i];if(quote){buf+=c;if(c===quote&&value[i-1]!=='\\')quote='';continue}if(c==='"'||c==="'"){quote=c;buf+=c;continue}if(c==='('||c==='[')depth++;if(c===')'||c===']')depth=Math.max(0,depth-1);if(c===','&&depth===0){out.push(buf.trim());buf='';}else buf+=c}if(buf.trim())out.push(buf.trim());return out}
    function parseBlock(source){let out='',i=0;while(i<source.length){while(i<source.length&&/\s/.test(source[i]))i++;if(i>=source.length)break;let open=-1,quote='',paren=0;for(let j=i;j<source.length;j++){const c=source[j];if(quote){if(c===quote&&source[j-1]!=='\\')quote='';continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='[')paren++;if(c===')'||c===']')paren=Math.max(0,paren-1);if(c==='{'&&paren===0){open=j;break}if(c===';'&&paren===0){const at=source.slice(i,j).trim();if(at)throw new Error('当前 CSS 编辑器不支持独立的 @ 语句。');i=j+1;break}}if(open<0){if(i<source.length&&source.slice(i).trim())throw new Error('CSS 语法不完整：缺少规则块。');break}const header=source.slice(i,open).trim();let depth=1,j=open+1,q='';for(;j<source.length&&depth;j++){const c=source[j];if(q){if(c===q&&source[j-1]!=='\\')q='';continue}if(c==='"'||c==="'"){q=c;continue}if(c==='{')depth++;else if(c==='}')depth--}if(depth!==0)throw new Error('CSS 语法不完整：缺少右花括号。');const body=source.slice(open+1,j-1);if(/^@(media|supports|container|layer)\b/i.test(header)){out+=header+'{'+parseBlock(body)+'}'}else if(/^@(?:-webkit-)?keyframes\b/i.test(header)){out+=header+'{'+body+'}'}else if(header.startsWith('@')){throw new Error('暂不支持此类 CSS 指令：'+header.split(/\s/)[0])}else{const selectors=splitSelectors(header).map(sel=>{if(!sel)throw new Error('CSS 选择器不能为空。');if(/^:root\b/.test(sel))return sel.replace(/^:root\b/,'#space.lr-space-v2');if(/^#space(?:\b|\.)/.test(sel))return sel;return '#space.lr-space-v2 '+sel});out+=selectors.join(',')+'{'+body+'}'}i=j}return out}
    return parseBlock(css);
  }
  function applyCustomCss(css,enabled=true){let node=$('lrSpaceCustomCssStyle');if(!node){node=document.createElement('style');node.id='lrSpaceCustomCssStyle';document.head.appendChild(node)}node.textContent=enabled?scopeCustomCss(css):'';return node.textContent}
  function openCustomCss(){ensureScreens();let raw='';try{raw=localStorage.getItem(SPACE_CSS_KEY)||''}catch(e){}$('lrSpaceCustomCssInput').value=raw||SPACE_CSS_STARTER;$('lrSpaceCssEnabled').checked=localStorage.getItem(SPACE_CSS_KEY+':enabled')!=='false';$('lrSpaceCustomCssStatus').textContent=raw?'已读取本机保存的全局 CSS。':'已载入 SPACE 全局示例模板，可直接修改后点击保存并应用。';showScreen('lrSpaceStoryCssEditor')}
  function saveCustomCss(){const input=$('lrSpaceCustomCssInput').value;try{const enabled=$('lrSpaceCssEnabled').checked;applyCustomCss(input,enabled);localStorage.setItem(SPACE_CSS_KEY,input);localStorage.setItem(SPACE_CSS_KEY+':enabled',String(enabled));$('lrSpaceCustomCssStatus').textContent=enabled?'CSS 检查通过，已保存并应用。':'CSS 已保存，目前处于停用状态。';notify('SPACE 自定义 CSS 已保存。')}catch(e){$('lrSpaceCustomCssStatus').textContent='CSS 未应用：'+e.message;notify('CSS 检查失败：'+e.message)}}
  function loadCustomCssAtBoot(){try{const raw=localStorage.getItem(SPACE_CSS_KEY)||'';const enabled=localStorage.getItem(SPACE_CSS_KEY+':enabled')!=='false';if(raw)applyCustomCss(raw,enabled)}catch(e){console.warn('[SPACE] custom CSS skipped',e)}}
  function exportCustomCss(){const raw=$('lrSpaceCustomCssInput').value;downloadFile('LOVE_RECORD_SPACE_custom.css',raw,'text/css;charset=utf-8')}
  function resetCustomCss(){if(!confirm('确定清除已保存的 CSS，并恢复 SPACE 默认外观吗？'))return;localStorage.removeItem(SPACE_CSS_KEY);localStorage.removeItem(SPACE_CSS_KEY+':enabled');$('lrSpaceCustomCssInput').value=SPACE_CSS_STARTER;$('lrSpaceCssEnabled').checked=true;applyCustomCss('',false);$('lrSpaceCustomCssStatus').textContent='已恢复默认外观；示例模板已重新载入编辑框，可再次修改。';notify('SPACE 已恢复默认外观。')}
  function checkSelections(selector){return [...document.querySelectorAll(selector+':checked')].map(x=>x.value)}
  function renderCreateSources(story=null){
    const people=contacts(),personaList=personas(),books=worldBooks();
    const selectedChars=new Set((story?.characters||[]).map(x=>String(x.id)));
    const selectedBooks=new Set((story?.worldBooks||[]).map(x=>String(x.id)));
    const liveContactIds=new Set(people.map(p=>String(p.id)));const missingChars=(story?.characters||[]).filter(ref=>!liveContactIds.has(String(ref.id)));const c=$('lrStoryContactChoices');c.innerHTML=[...people.map(p=>`<label class="lr-story-option"><input type="checkbox" value="${esc(p.id)}" data-story-contact ${selectedChars.has(String(p.id))?'checked':''}><span><b>${esc(p.name||'未命名联系人')}</b><br><small>${esc(p.role||p.personality||'CHAR')}</small></span></label>`),...missingChars.map(ref=>`<label class="lr-story-option"><input type="checkbox" value="${esc(ref.id)}" data-story-contact checked><span><b>${esc(ref.snapshot?.name||'已删除 CHAR')}</b><br><small>主页联系人已删除 · 保留本故事快照</small></span></label>`)].join('')||'<div class="lr-story-muted">主页联系人列表为空。请先在 LOVE RECORD「联系人」创建 CHAR。</div>';
    const ps=$('lrStoryPersonaSelect');const personaMissing=!!(story?.personaRef?.id&&!personaList.some(p=>String(p.id)===String(story.personaRef.id)));ps.innerHTML='<option value="">默认的我（不引用特定自设）</option>'+personaList.map(p=>`<option value="${esc(p.id)}" ${String(story?.personaRef?.id||'')===String(p.id)?'selected':''}>${esc(p.name||'未命名自设')} · ${esc(p.role||'自设')}</option>`).join('')+(personaMissing?`<option value="__snapshot__" selected>${esc(story.personaRef.snapshot?.name||'已删除自设')} · 保留本故事快照</option>`:'');
    const liveBookIds=new Set(books.map(w=>String(w.id)));const missingBooks=(story?.worldBooks||[]).filter(ref=>!liveBookIds.has(String(ref.id)));const wb=$('lrStoryWorldChoices');wb.innerHTML=[...books.map(w=>`<label class="lr-story-option"><input type="checkbox" value="${esc(w.id)}" data-story-world ${selectedBooks.has(String(w.id))?'checked':''}><span><b>${esc(w.name||'未命名世界书')}</b><br><small>${esc((w.description||w.entries?.[0]?.content||'世界设定').slice(0,90))}</small></span></label>`),...missingBooks.map(ref=>`<label class="lr-story-option"><input type="checkbox" value="${esc(ref.id)}" data-story-world checked><span><b>${esc(ref.snapshot?.name||'已删除世界书')}</b><br><small>主页世界书已删除 · 保留本故事快照</small></span></label>`)].join('')||'<div class="lr-story-muted">暂无主页世界书，可先不选择，稍后再补充。</div>';
    const citySelect=$('lrStoryCitySelect');if(citySelect){const cities=bridge()?.getCities?.()||[];const oldId=String(story?.cityId||'');citySelect.innerHTML='<option value="">暂不关联城市</option>'+cities.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'未命名城市')}</option>`).join('')+(oldId&&!cities.some(c=>String(c.id)===oldId)?`<option value="${esc(oldId)}" selected>原关联城市（暂不可用）</option>`:'');citySelect.value=oldId&&cities.some(c=>String(c.id)===oldId)?oldId:'';}
  }
  function fillCreateForm(story){
    $('lrStoryTitle').value=story?.title||'';$('lrStoryPremise').value=story?.premise||'';$('lrStoryOpening').value=story?.opening||'';
    $('lrStoryUserControl').value=story?.userControl||'user';$('lrStoryNpcPolicy').value=story?.npcPolicy||'both';$('lrStoryTarget').value=story?.targetLength||2000;$('lrStoryMode').value=story?.mode||'novel';$('lrStoryView').value=story?.narrativeView||'third';$('lrStoryPace').value=story?.pace||'normal';$('lrStoryContinuity').value=story?.continuity||'balanced';$('lrStoryDetail').value=story?.detail||'rich';$('lrStoryInitiative').value=story?.initiative||'medium';$('lrStoryExtraRules').value=story?.extraRules||'';
    $('lrStoryCreateHeading').textContent=story?'编辑故事资料':'创建新故事';$('lrStoryCreateSave').textContent=story?'保存故事修改':'创建故事并进入';$('lrStoryCreateStatus').textContent='';
  }
  async function openCreate(storyId=''){
    ensureScreens();editingStoryId=storyId||'';let story=null;
    if(storyId){story=(await loadStoryList()).find(x=>x.id===storyId)||null;if(!story){notify('找不到需要编辑的故事。');return}}
    renderCreateSources(story);fillCreateForm(story);showScreen('lrSpaceStoryCreate');
  }
  async function createStory(){
    const title=textLimit($('lrStoryTitle')?.value,90);if(!title){$('lrStoryCreateStatus').textContent='请先填写故事名称。';$('lrStoryTitle').focus();return}
    const ids=checkSelections('[data-story-contact]').map(String);
    const selected=ids.map(getContact).filter(Boolean);const existingForEdit=editingStoryId?(await loadStoryList()).find(x=>x.id===editingStoryId):null;const keptMissingChars=(existingForEdit?.characters||[]).filter(ref=>!getContact(ref.id)&&ids.includes(String(ref.id)));if(!selected.length&&!keptMissingChars.length){$('lrStoryCreateStatus').textContent='请至少保留或选择一位 CHAR。';return}
    const personaId=String($('lrStoryPersonaSelect').value||'');const persona=personaId&&personaId!=='__snapshot__'?getPersona(personaId):null;
    const worldIds=checkSelections('[data-story-world]').map(String),selectedBooks=worldIds.map(getWorldBook).filter(Boolean);const keptMissingBooks=(existingForEdit?.worldBooks||[]).filter(ref=>!getWorldBook(ref.id)&&worldIds.includes(String(ref.id)));
    const target=Math.max(300,Math.min(12000,Number($('lrStoryTarget').value)||2000));
    const storyList=existingForEdit?null:await loadStoryList();let story=existingForEdit||(editingStoryId?storyList.find(x=>x.id===editingStoryId):null);
    if(editingStoryId&&!story){$('lrStoryCreateStatus').textContent='这部故事已不存在，无法保存修改。';return}
    if(!story)story={id:uid('story'),createdAt:Date.now(),status:'active',npcs:[],branches:[{id:'main',name:'主线',baseEntryIds:[],createdAt:Date.now()}],activeBranchId:'main',pendingGeneration:null,summary:'',notes:'',defaultStyle:'literary'};
    story.cityId=String($('lrStoryCitySelect')?.value||'');
    Object.assign(story,{title,updatedAt:Date.now(),premise:textLimit($('lrStoryPremise').value,8000),opening:textLimit($('lrStoryOpening').value,6000),characters:[...selected.map(p=>({id:String(p.id),snapshot:snapshotContact(p),syncedAt:Date.now()})),...keptMissingChars],personaRef:persona?{id:String(persona.id),snapshot:snapshotPersona(persona),syncedAt:Date.now()}:personaId==='__snapshot__'?(story.personaRef||null):null,worldBooks:[...selectedBooks.map(w=>({id:String(w.id),snapshot:snapshotWorldBook(w),syncedAt:Date.now()})),...keptMissingBooks],mode:$('lrStoryMode').value==='interactive'?'interactive':'novel',streamMode:story.streamMode==='complete'?'complete':'stream',userControl:$('lrStoryUserControl').value||'user',npcPolicy:$('lrStoryNpcPolicy').value||'both',targetLength:target,narrativeView:$('lrStoryView').value||'third',pace:$('lrStoryPace').value||'normal',continuity:$('lrStoryContinuity').value||'balanced',detail:$('lrStoryDetail').value||'rich',initiative:$('lrStoryInitiative').value||'medium',extraRules:textLimit($('lrStoryExtraRules').value,5000)});
    try{await saveMeta(story);activeStory=story;activeEntries=await loadStoryEntries(story.id);if(editingStoryId){editingStoryId='';await showWorkspace(story);notify('故事资料已更新，原有剧情与存档保持不变。')}else{await showWorkspace(story);$('lrStoryUserInput').value=story.opening||'请根据故事背景、已选角色与世界书设定，写出这段故事的第一个场景。';notify('故事已创建，主页资料快照也已保存。')}}
    catch(e){console.error('[SPACE story save]',e);$('lrStoryCreateStatus').textContent='保存失败：'+(e.message||'本地数据库不可用')}
  }
  async function openLibrary(){ensureScreens();showScreen('lrSpaceStoryLibrary');await renderLibrary()}
  async function renderLibrary(){
    const list=$('lrStoryLibraryList');if(!list)return;
    try{const stories=await loadStoryList();const q=String($('lrStorySearch')?.value||'').trim().toLowerCase();const entries=q?await getAll(ENTRY_STORE):[];const filtered=stories.filter(s=>s.status!=='deleted').filter(s=>!q||[s.title,s.premise,profileSummary(s),s.summary,...(s.timeline||[]).map(e=>e.title+' '+e.note)].join(' ').toLowerCase().includes(q)||entries.some(e=>e.storyId===s.id&&String(e.content||'').toLowerCase().includes(q)));
      list.innerHTML=filtered.length?filtered.map(s=>`<article class="lr-story-card"><div class="lr-story-card-head"><div class="lr-story-cover">${s.mode==='interactive'?'✦':'▤'}</div><div class="lr-story-card-copy"><b>${esc(s.title||'未命名故事')}</b><small>${esc(profileSummary(s))} · ${s.mode==='interactive'?'互动长文':'小说沉浸'}<br>最近更新：${esc(new Date(s.updatedAt||s.createdAt).toLocaleString())}</small></div></div><div class="lr-story-muted">${esc((s.premise||'暂无故事简介').slice(0,140))}</div><div class="lr-story-card-actions"><button class="lr-story-pixel-btn primary" data-story-action="open" data-story-id="${esc(s.id)}">继续故事</button><button class="lr-story-pixel-btn" data-story-action="edit" data-story-id="${esc(s.id)}">编辑</button><button class="lr-story-pixel-btn" data-story-action="export-list" data-story-id="${esc(s.id)}">导出</button><button class="lr-story-pixel-btn" data-story-action="archive" data-story-id="${esc(s.id)}">${s.status==='archived'?'恢复':'归档'}</button><button class="lr-story-pixel-btn" data-story-action="delete" data-story-id="${esc(s.id)}">删除</button></div></article>`).join(''):'<div class="lr-story-panel"><h2>还没有匹配的故事</h2><p class="lr-story-muted">可搜索故事名称、简介、CHAR 名称，以及剧情正文中的关键词。</p><button class="lr-story-pixel-btn primary" data-story-action="new">＋ 创建新故事</button></div>';
    }catch(e){list.innerHTML=`<div class="lr-story-muted">读取故事档案失败：${esc(e.message||'数据库不可用')}</div>`}
  }
  async function renderHub(){ensureHub();const list=$('lrSpaceStoryRecent');if(!list)return;try{const stories=(await loadStoryList()).filter(s=>s.status==='active').slice(0,2);list.innerHTML=stories.length?stories.map(s=>`<button type="button" class="lr-story-mini-card" data-story-action="open" data-story-id="${esc(s.id)}"><span class="lr-story-mini-cover">${s.mode==='interactive'?'✦':'▤'}</span><span class="lr-story-mini-copy"><b>${esc(s.title||'未命名故事')}</b><small>${esc(profileSummary(s))} · ${esc(new Date(s.updatedAt||s.createdAt).toLocaleDateString())}</small></span><span>›</span></button>`).join(''):'<div class="lr-story-muted">还没有进行中的故事。先创建一部作品吧。</div>'}catch(e){list.textContent='故事档案暂时无法读取。'}}
  async function openStory(id){try{const stories=await loadStoryList();const story=stories.find(s=>s.id===id);if(!story){notify('找不到这部故事。');return}activeStory=story;activeEntries=await loadStoryEntries(id);ensureScreens();showWorkspace(story)}catch(e){console.error(e);notify('无法打开故事：'+(e.message||'本地读取失败'))}}
  function createCastHtml(story){
    const chars=(story.characters||[]).map(ref=>{const p=ref.snapshot||{};return `<span class="lr-story-cast-chip">${p.avatar?`<img src="${esc(p.avatar)}" alt="">`:'▣'} ${esc(p.name||'未命名 CHAR')} <small>主页 CHAR</small></span>`});
    (story.npcs||[]).forEach(p=>chars.push(`<span class="lr-story-cast-chip">♟ ${esc(p.name||'NPC')} <small>NPC</small><button type="button" data-story-action="edit-npc" data-npc-id="${esc(p.id)}">编辑</button><button type="button" data-story-action="delete-npc" data-npc-id="${esc(p.id)}">删除</button></span>`));
    if(story.personaRef?.snapshot)chars.push(`<span class="lr-story-cast-chip">♡ ${esc(story.personaRef.snapshot.name||'我的自设')} <small>用户角色</small></span>`);
    return chars.join('')||'<span class="lr-story-muted">尚未设置角色</span>';
  }
  function renderStoryCitySync(story){
    const select=$('lrStoryCityLocationSelect'),meta=$('lrStoryCitySyncMeta');if(!select||!meta)return;
    const cityId=String(story?.cityId||'');const city=cityId?bridge()?.getCitySnapshot?.(cityId):null;const snap=city?.snapshot;
    if(!city||!snap){select.innerHTML='<option value="">请先关联一座可用的 SPACE CITY</option>';select.disabled=true;meta.textContent='当前故事尚未关联可用城市。请先通过「编辑故事资料」关联城市。';return}
    const buildings=Array.isArray(snap.buildings)?snap.buildings:[];select.innerHTML=buildings.map(b=>`<option value="${esc(b.id)}">${esc(b.name||'未命名地点')}</option>`).join('')||'<option value="">城市暂无地点</option>';
    select.value=String(snap.currentLocation||'');select.disabled=!buildings.length;
    meta.textContent=`已关联：${city.name||'SPACE CITY'} · ${snap.currentLocationName||'城市'} · ${new Date(snap.worldNow||Date.now()).toLocaleString()} · ${snap.weather||'天气未知'} · ${snap.season||'季节未知'}。剧情创作可读取居民、关系、地点与城市设定快照。`;
  }
  async function syncStoryCityLocation(){
    if(!activeStory?.cityId){notify('请先在故事资料中关联一座 SPACE CITY。');return}
    const locationId=String($('lrStoryCityLocationSelect')?.value||'');if(!locationId){notify('这座城市目前没有可同步的地点。');return}
    const fn=bridge()?.setCityCurrentLocation;if(typeof fn!=='function'){notify('当前 SPACE CITY 同步接口不可用。');return}
    const result=await fn(activeStory.cityId,locationId);if(!result?.ok){if(result?.message!=='用户取消同步')notify(result?.message||'城市地点同步失败。');return}
    renderStoryCitySync(activeStory);notify(`已将「${result.locationName}」同步为城市当前地点。`);
  }
  async function showWorkspace(story){
    ensureScreens();activeStory=story;activeEntries=await loadStoryEntries(story.id);
    $('lrStoryWorkspaceTitle').textContent=story.title||'未命名故事';$('lrStoryCast').innerHTML=createCastHtml(story);
    $('lrStoryWorkspaceMode').value=story.mode||'novel';$('lrStoryWorkspaceTarget').value=story.targetLength||2000;$('lrStoryQuickStreamMode').value=story.streamMode||'stream';$('lrStoryOutputHint').textContent=(story.streamMode||'stream')==='stream'?'流式：正文会随模型输出逐步出现。':'非流式：等待本段完整生成后，再显示正文。';$('lrStoryLiveStatus').textContent='就绪';
    $('lrStoryWorkspaceDetail').value=story.detail||'rich';$('lrStoryWorkspaceContinuity').value=story.continuity||'balanced';$('lrStoryWorkspaceInitiative').value=story.initiative||'medium';$('lrStoryWorkspaceUserControl').value=story.userControl||'user';$('lrStoryWorkspaceNpcPolicy').value=story.npcPolicy||'both';$('lrStoryWorkspaceView').value=story.narrativeView||'third';$('lrStoryWorkspacePace').value=story.pace||'normal';$('lrStoryWorkspaceRules').value=story.extraRules||'';$('lrStoryWorkspaceSummary').value=story.summary||'';$('lrStoryWorkspaceNotes').value=story.notes||'';
    const settingsGroups=$('lrStorySettingsPanel')?.querySelectorAll('.lr-story-settings-group')||[];settingsGroups.forEach((group,index)=>{group.open=index===0});closeOfflineSettings();
    renderStoryCitySync(story);
    const manualNpc=document.querySelector('[data-story-action="manual-npc"]'),aiNpc=document.querySelector('[data-story-action="ai-npc"]');if(manualNpc)manualNpc.hidden=story.npcPolicy==='ai';if(aiNpc)aiNpc.hidden=story.npcPolicy==='manual';
    renderBranches(story);renderTranscript(story);renderSourceChanges(story);renderTimeline(story);renderLongMemory(story);
    $('lrStoryContextMeta').textContent=`${(story.characters||[]).length} 位主页 CHAR · ${(story.npcs||[]).length} 位故事 NPC · ${(story.worldBooks||[]).length} 本世界书 · 目标 ${story.targetLength||2000} 字`;
    $('lrStoryGenerate').textContent=story.pendingGeneration?'继续补完本次目标':'生成剧情';$('lrStoryComposerHint').textContent=story.mode==='interactive'?'互动长文 · 输入你的动作、对白或想法，CHAR 会根据你的参与继续推进。':'小说沉浸 · 阅读完整段落后，再决定故事接下来往哪里走。';$('lrStoryUserInput').placeholder=story.mode==='interactive'?'写下你的行动、对白或临时剧情方向……':'写下你希望下一段发生的事，或让故事自然继续……';
    $('lrStoryGenerationStatus').textContent=story.pendingGeneration?'上次生成未完成，已有内容已保存；点击按钮可以继续接近目标字数。':'每段剧情都会自动保存。你可以选择流式或非流式输出。';
    showScreen('lrSpaceStoryWorkspace');
  }
  function ensureLongMemory(story){
    if(!story.longMemory||typeof story.longMemory!=='object')story.longMemory={autoEnabled:true,interval:15,branches:{}};
    if(typeof story.longMemory.autoEnabled!=='boolean')story.longMemory.autoEnabled=true;
    story.longMemory.interval=Math.max(2,Math.min(100,Number(story.longMemory.interval)||15));
    if(!story.longMemory.branches||typeof story.longMemory.branches!=='object')story.longMemory.branches={};
    const branchId=String(story.activeBranchId||'main');
    if(!story.longMemory.branches[branchId])story.longMemory.branches[branchId]={summary:'',coveredEntryIds:[],lastSummaryAt:0,totalSummarized:0};
    const branch=story.longMemory.branches[branchId];
    if(typeof branch.summary!=='string')branch.summary='';
    if(!Array.isArray(branch.coveredEntryIds))branch.coveredEntryIds=[];
    return branch;
  }
  function longMemoryUnits(story,entries){
    const rows=visibleEntries(story,entries).filter(e=>(e.role==='user'||e.role==='assistant')&&String(e.content||'').trim());
    const units=[];
    rows.forEach(entry=>{
      const last=units[units.length-1];
      if(entry.role==='assistant'&&entry.generationId&&last?.role==='assistant'&&last.generationId===entry.generationId){last.content+='\n\n'+entry.content;last.entryIds.push(entry.id);last.lastAt=entry.createdAt||last.lastAt;}
      else units.push({role:entry.role,generationId:entry.generationId||'',content:String(entry.content||''),entryIds:[entry.id],at:entry.createdAt||0,lastAt:entry.createdAt||0});
    });
    return units;
  }
  function renderLongMemory(story){
    if(!story)return;
    const branch=ensureLongMemory(story),units=longMemoryUnits(story,activeEntries),covered=new Set(branch.coveredEntryIds);
    const pending=units.filter(unit=>unit.entryIds.some(id=>!covered.has(id)));
    const auto=$('lrStoryLongMemoryAuto'),interval=$('lrStoryLongMemoryInterval'),memo=$('lrStoryLongMemoryText'),status=$('lrStoryLongMemoryStatus');
    if(auto)auto.checked=story.longMemory.autoEnabled!==false;
    if(interval)interval.value=String(story.longMemory.interval||15);
    if(memo)memo.value=branch.summary||'';
    if(status){const coveredCount=units.filter(unit=>unit.entryIds.every(id=>covered.has(id))).length;status.textContent=`当前分支：${units.length} 条对话消息 · 已纳入长记忆 ${coveredCount} 条 · 待总结 ${pending.length} 条。自动总结${story.longMemory.autoEnabled===false?'已关闭':`已开启，每 ${story.longMemory.interval} 条整理一次`}${branch.lastSummaryAt?' · 最近整理 '+new Date(branch.lastSummaryAt).toLocaleString():''}。`;}
  }
  async function saveLongMemory(){
    if(!activeStory)return;
    const story=activeStory,branch=ensureLongMemory(story);
    story.longMemory.autoEnabled=$('lrStoryLongMemoryAuto')?.checked!==false;
    story.longMemory.interval=Math.max(2,Math.min(100,Math.round(Number($('lrStoryLongMemoryInterval')?.value)||15)));
    branch.summary=textLimit($('lrStoryLongMemoryText')?.value,18000);branch.manuallyEditedAt=Date.now();
    await saveMeta(story);renderLongMemory(story);notify('当前分支的长记忆已保存。');
  }
  let longMemoryBusy=false;
  async function summarizeLongMemory(story=activeStory,{automatic=false}={}){
    if(!story||longMemoryBusy)return false;
    const branchId=String(story.activeBranchId||'main'),branch=ensureLongMemory(story),units=longMemoryUnits(story,activeEntries),covered=new Set(branch.coveredEntryIds);
    const pending=units.filter(unit=>unit.entryIds.some(id=>!covered.has(id)));
    const interval=Math.max(2,Math.min(100,Number(story.longMemory.interval)||15));
    if(automatic&&(story.longMemory.autoEnabled===false||pending.length<interval))return false;
    if(!pending.length){if(!automatic)notify('当前分支没有待整理的新消息。');return false;}
    const batch=pending.slice(0,automatic?interval:Math.min(60,Math.max(interval,pending.length)));
    const api=bridge()?.callAPI;if(typeof api!=='function'){if(!automatic)notify('当前 SPACE AI 接口不可用，请检查 API 设置。');return false;}
    const system=`你是 LOVE RECORD SPACE 的长篇剧情记忆整理助手。你的工作是把新增对话整合进已有长记忆，供后续续写保持连续。只输出整理后的记忆正文，不要输出开场白或解释。必须忠于原文，不能编造、猜测或把可能性写成事实；保留人物姓名、关系、时间、地点、承诺、重要物品、已确认事件、人物状态变化、尚未解决的冲突与伏笔。若新消息明确修正旧信息，以最新明确内容为准。优先保留后续剧情真正需要的事实，合并重复信息，避免流水账。使用清晰的小标题：当前进度、人物与关系、已确认事实、重要经历、未解决事项与伏笔。控制在约 1200—2600 个中文字符，信息不足时可以更短。`;
    const user=JSON.stringify({storyTitle:story.title||'',branchName:currentBranch(story).name||'主线',existingLongMemory:branch.summary||'（尚无既有长记忆）',storyPremise:story.premise||'',fixedNotes:story.notes||'',timeline:(story.timeline||[]).filter(x=>!x.branchId||x.branchId===branchId).slice(-30).map(x=>({title:x.title,note:x.note,at:x.at})),newMessages:batch.map((unit,index)=>({index:index+1,role:unit.role==='user'?'用户输入':'SPACE剧情回复',content:textLimit(unit.content,2200),at:unit.at}))});
    longMemoryBusy=true;
    const status=$('lrStoryLongMemoryStatus');if(status)status.textContent=`正在整理 ${batch.length} 条新消息……原始剧情不会删除。`;
    try{
      const raw=await api(system,user,'正在整理故事长记忆…',false,90000);
      const result=String(raw||'').trim();if(!result)throw new Error('AI 没有返回有效的记忆摘要。');
      // Store into the exact branch whose messages were summarized, even if the UI changes branch mid-request.
      story.longMemory=story.longMemory||{autoEnabled:true,interval:15,branches:{}};story.longMemory.branches=story.longMemory.branches||{};
      const target=story.longMemory.branches[branchId]||(story.longMemory.branches[branchId]={summary:'',coveredEntryIds:[],lastSummaryAt:0,totalSummarized:0});
      target.summary=textLimit(result,18000);target.coveredEntryIds=[...new Set([...(target.coveredEntryIds||[]),...batch.flatMap(x=>x.entryIds)])];target.lastSummaryAt=Date.now();target.totalSummarized=(Number(target.totalSummarized)||0)+batch.length;
      await saveMeta(story);
      if(activeStory?.id===story.id){if(String(activeStory.activeBranchId||'main')===branchId)renderLongMemory(activeStory);else renderLongMemory(activeStory);}
      const left=longMemoryUnits(story,activeEntries).filter(unit=>unit.entryIds.some(id=>!new Set(target.coveredEntryIds).has(id))).length;
      if(!automatic)notify(`长记忆已更新，整理了 ${batch.length} 条消息${left?`，还有 ${left} 条待整理`:''}。`);
      return true;
    }catch(err){console.error('[SPACE long memory]',err);if(status)status.textContent='长记忆整理失败：'+(err.message||'未知错误')+'。原始剧情没有受到影响，可以稍后重试。';if(!automatic)notify('长记忆整理失败：'+(err.message||'请检查 API 设置'));return false;}
    finally{longMemoryBusy=false;if(activeStory?.id===story.id)renderLongMemory(activeStory);}
  }
  async function maybeAutoLongMemory(story){
    if(!story||story.longMemory?.autoEnabled===false||longMemoryBusy)return;
    const branch=ensureLongMemory(story),pending=longMemoryUnits(story,activeEntries).filter(unit=>unit.entryIds.some(id=>!new Set(branch.coveredEntryIds).has(id)));
    if(pending.length>=Math.max(2,Number(story.longMemory.interval)||15))await summarizeLongMemory(story,{automatic:true});
  }
  function renderTimeline(story){const box=$('lrStoryTimelineList');if(!box)return;const rows=Array.isArray(story.timeline)?story.timeline.slice().sort((a,b)=>(a.at||0)-(b.at||0)):[];box.innerHTML=rows.length?rows.map(ev=>`<article class="lr-story-msg"><div class="lr-story-msg-head"><b>${esc(ev.title||'剧情节点')}</b><time>${esc(new Date(ev.at||Date.now()).toLocaleString())}</time></div><div class="lr-story-msg-body" style="font:12px/1.7 sans-serif">${esc(ev.note||'')}</div><div class="lr-story-msg-actions"><button class="lr-story-pixel-btn" data-story-action="remove-timeline-event" data-event-id="${esc(ev.id)}">移除节点</button></div></article>`).join(''):'<p class="lr-story-muted">还没有记录重要节点。可以手动添加相遇、旅行、关系变化或其他关键事件。</p>';renderLongMemory(story)}
  async function addTimelineEvent(){if(!activeStory)return;const title=prompt('剧情节点名称：','重要事件');if(!title)return;const note=prompt('事件摘要（可选）：','');activeStory.timeline=Array.isArray(activeStory.timeline)?activeStory.timeline:[];activeStory.timeline.push({id:uid('event'),title:textLimit(title,100),note:textLimit(note,1200),at:Date.now(),branchId:activeStory.activeBranchId||'main'});await saveMeta(activeStory);renderTimeline(activeStory);notify('剧情时间轴已记录。')}
  async function removeTimelineEvent(id){if(!activeStory||!confirm('确定移除这个剧情时间轴节点吗？'))return;activeStory.timeline=(activeStory.timeline||[]).filter(x=>x.id!==id);await saveMeta(activeStory);renderTimeline(activeStory)}
  function renderBranches(story){const sel=$('lrStoryBranchSelect');if(!sel)return;sel.innerHTML=(story.branches||[]).map(b=>`<option value="${esc(b.id)}" ${b.id===story.activeBranchId?'selected':''}>${esc(b.name||'故事分支')}</option>`).join('')}
  function renderTranscript(story){
    const box=$('lrStoryTranscript');if(!box)return;const rows=visibleEntries(story,activeEntries);
    if(!rows.length){box.innerHTML='<section class="lr-story-panel"><h2>STORY BEGINNING</h2><p class="lr-story-muted">这里将保存完整故事。输入开场或你的第一个行动，SPACE 就会开始写作。</p></section>';return}
    const groups=[];rows.forEach(e=>{const last=groups[groups.length-1];if(e.role==='assistant'&&last?.role==='assistant'&&last.generationId&&last.generationId===e.generationId){last.content+='\n\n'+e.content;last.entryIds.push(e.id);last.lastEntryId=e.id}else groups.push({...e,entryIds:[e.id],lastEntryId:e.id})});
    const lastAssistant=groups.reduce((n,e,i)=>e.role==='assistant'?i:n,-1);
    box.innerHTML=groups.map((e,i)=>{
      const isUser=e.role==='user';
      const body=isUser?`<div class="lr-story-msg-head"><span>YOU · 用户输入</span><time>${esc(new Date(e.createdAt).toLocaleString())}</time></div><div class="lr-story-msg-body">${esc(e.content)}</div>`:`<details class="lr-story-msg-fold" ${i===lastAssistant?'open':''}><summary><span>SPACE · 剧情正文</span><span>${esc(new Date(e.createdAt).toLocaleString())} · ${countChars(e.content)} 字</span></summary><div class="lr-story-msg-body">${esc(e.content)}</div></details>`;
      const reroll=(isUser||!e.generationId)?'':`<button class="lr-story-pixel-btn" data-story-action="reroll" data-generation-id="${esc(e.generationId)}">重 roll</button>`;
      return `<article class="lr-story-msg ${isUser?'user':'assistant'}">${body}<div class="lr-story-msg-actions"><button class="lr-story-pixel-btn" data-story-action="edit-entry" data-entry-id="${esc(e.lastEntryId||e.id)}">编辑内容</button>${isUser?'':`<button class="lr-story-pixel-btn" data-story-action="fork" data-entry-id="${esc(e.lastEntryId)}">从这里创建分支</button>${reroll}`}</div></article>`;
    }).join('');
  }
  function renderSourceChanges(story){const box=$('lrStorySourceChanges');if(!box)return;const changes=sourceChanges(story);if(!changes.length){box.innerHTML='<div class="lr-story-muted">主页资料已与本故事快照一致。</div>';return}const missing=changes.filter(x=>x.missing);box.innerHTML=`<div class="lr-story-source-alert">检测到主页资料有变化：${changes.map(x=>esc(x.name)+(x.missing?'（主页已删除，故事保留原快照）':'')).join('、')}。历史剧情不会被改写。${missing.length===changes.length?'':`<button type="button" class="lr-story-pixel-btn" data-story-action="sync" style="margin-top:7px">将最新资料应用到后续剧情</button>`}</div>`}
  function renderAddContactModal(){const current=new Set((activeStory.characters||[]).map(x=>x.id));const available=contacts().filter(p=>!current.has(String(p.id)));$('lrStoryAddContactChoices').innerHTML=available.length?available.map(p=>`<label class="lr-story-option"><input type="checkbox" value="${esc(p.id)}" data-story-add-contact><span><b>${esc(p.name||'未命名联系人')}</b><br><small>${esc(p.role||'CHAR')}</small></span></label>`).join(''):'<div class="lr-story-muted">所有主页 CHAR 都已加入，或主页联系人列表为空。</div>';$('lrStoryAddContactModal').classList.add('show')}
  async function addSelectedContacts(){const ids=checkSelections('[data-story-add-contact]').map(String);if(!ids.length){$('lrStoryAddContactModal').classList.remove('show');return}for(const id of ids){const p=getContact(id);if(!p)continue;if((activeStory.characters||[]).some(x=>x.id===id))continue;activeStory.characters.push({id,snapshot:snapshotContact(p),syncedAt:Date.now(),addedAt:Date.now()})}await saveMeta(activeStory);$('lrStoryAddContactModal').classList.remove('show');renderStoryWorkspaceAfterCast();notify('已将主页 CHAR 加入当前故事。')}
  async function renderStoryWorkspaceAfterCast(){if(activeStory)await showWorkspace(activeStory)}
  function editNpc(id){const npc=(activeStory?.npcs||[]).find(x=>x.id===id);if(!npc)return;$('lrStoryNpcModal').dataset.editingNpcId=id;$('lrStoryNpcName').value=npc.name||'';$('lrStoryNpcRole').value=npc.role||'';$('lrStoryNpcPersonality').value=npc.personality||'';$('lrStoryNpcSpeech').value=npc.speech||'';$('lrStoryNpcBackground').value=npc.background||'';$('lrStoryNpcModal').querySelector('[data-story-action="save-npc"]').textContent='保存修改';$('lrStoryNpcModal').classList.add('show')}
  async function saveNpc(){const name=textLimit($('lrStoryNpcName').value,80);if(!name){notify('请填写 NPC 姓名。');return}activeStory.npcs=activeStory.npcs||[];const modal=$('lrStoryNpcModal'),editId=modal.dataset.editingNpcId;const data={name,role:textLimit($('lrStoryNpcRole').value,180),personality:textLimit($('lrStoryNpcPersonality').value,1600),speech:textLimit($('lrStoryNpcSpeech').value,1000),background:textLimit($('lrStoryNpcBackground').value,1400)};if(editId){const npc=activeStory.npcs.find(x=>x.id===editId);if(npc)Object.assign(npc,data,{editedAt:Date.now()});delete modal.dataset.editingNpcId}else activeStory.npcs.push({id:uid('npc'),...data,createdAt:Date.now(),source:'user'});await saveMeta(activeStory);modal.classList.remove('show');$('lrStoryNpcName').value='';$('lrStoryNpcRole').value='';$('lrStoryNpcPersonality').value='';$('lrStoryNpcSpeech').value='';$('lrStoryNpcBackground').value='';modal.querySelector('[data-story-action="save-npc"]').textContent='保存 NPC';renderStoryWorkspaceAfterCast();notify(editId?'NPC 资料已更新。':'故事 NPC 已创建。')}
  async function deleteNpc(id){const npc=(activeStory?.npcs||[]).find(x=>x.id===id);if(!npc||!confirm(`确定从本故事后续剧情中移除 NPC「${npc.name}」吗？历史剧情会保留。`))return;activeStory.npcs=activeStory.npcs.filter(x=>x.id!==id);await saveMeta(activeStory);await renderStoryWorkspaceAfterCast();notify('NPC 已从后续角色名单移除，历史剧情保留。')}
  async function generateNpc(){if(generationBusy)return;if(activeStory?.npcPolicy==='manual'){notify('本故事设置为仅手动创建 NPC。');return}const api=bridge()?.callAPI;if(!api){notify('当前 SPACE AI 接口不可用。');return}const story=activeStory;const system='你是角色设计助手。根据当前故事背景生成一位可加入故事的 NPC。只返回 JSON，不要 Markdown。字段：name、role、personality、speech、background。人物必须适合当前世界，不要重复已有角色。';const user=JSON.stringify({title:story.title,premise:story.premise,worldBooks:(story.worldBooks||[]).map(x=>flatWorldBook(x.snapshot||{})),existingCharacters:(story.characters||[]).map(x=>x.snapshot?.name),existingNPCs:(story.npcs||[]).map(x=>x.name)});try{const raw=await api(system,user,'正在构思故事 NPC…',false,60000);if(!raw)return;const obj=JSON.parse(String(raw).replace(/^```json\s*|^```|```$/g,'').trim());if(!obj.name)throw new Error('返回内容缺少 NPC 名称');story.npcs=story.npcs||[];story.npcs.push({id:uid('npc'),name:textLimit(obj.name,80),role:textLimit(obj.role,180),personality:textLimit(obj.personality,1400),speech:textLimit(obj.speech,1000),background:textLimit(obj.background,1400),createdAt:Date.now(),source:'ai'});await saveMeta(story);await showWorkspace(story);notify('AI 已为故事创建一位 NPC。')}catch(e){console.error('[SPACE NPC]',e);notify('NPC 生成失败：'+(e.message||'请检查 API 或返回格式'))}}
  async function syncSources(){if(!activeStory)return;const changes=sourceChanges(activeStory);if(!changes.length){notify('主页资料已经是最新版本。');return}if(changes.every(x=>x.missing)){notify('联系人或资料已从主页删除；故事继续使用本地快照，不会丢失。');return}await syncStorySources(activeStory);await showWorkspace(activeStory);notify('主页最新资料已应用到后续剧情，既有故事记录不变。')}
  function storyPrompt(story,entries,generation,promptChunk){
    const visible=visibleEntries(story,entries);const recent=visible.slice(-12).map(e=>({role:e.role,content:textLimit(e.content,1600)}));
    const characters=(story.characters||[]).map(x=>x.snapshot||{});const npcList=(story.npcs||[]).map(x=>({name:x.name,role:x.role,personality:x.personality,speech:x.speech,background:x.background}));
    const persona=story.personaRef?.snapshot||{name:'用户'};const world=(story.worldBooks||[]).map(x=>flatWorldBook(x.snapshot||{})).filter(Boolean).join('\n\n').slice(0,14000);
    const rules={continuity:{balanced:'允许合理补充新细节，但不能推翻已经确认的重要事实、角色设定、时间线和关系。',strict:'严格遵守所有既有事实，不擅自增加会改变故事根基的设定。',creative:'允许创造新支线和意外细节，但不得否定核心人设及已发生事实。'}[story.continuity]||'平衡模式',detail:{rich:'丰富细腻：具体描写环境、光线、声音、气味、动作、神态、微表情、心理活动与情绪变化，避免空泛形容和重复灌水。',moderate:'描写与对话均衡，抓住关键动作、氛围和心理。',dialogue:'对白优先，减少过长环境描写，让人物交流推动剧情。'}[story.detail]||'丰富细腻',initiative:{low:'主要回应用户明确输入，不主动制造重大事件。',medium:'适度推动剧情，可以加入自然的小变化、角色互动和合理钩子；重大转折需有铺垫，不替用户做决定。',high:'可以主动拓展支线、事件和新人物，但仍需尊重故事规则。'}[story.initiative]||'适度推动'};
    const userControl={user:'用户完全控制自己的角色。绝对不要替用户角色编造台词、决定思想、情绪、动作、选择或身体反应；只回应用户已经给出的行动，并为用户留下空间。',assist:'AI 可以帮助润色用户明确给出的行动和表达，但不得擅自决定用户未表达的重要选择、立场和情绪。',ai:'此故事允许 AI 控制用户角色；仍需遵守用户明确给出的限制和人物设定。'}[story.userControl]||'用户完全控制';
    const mode=story.mode==='interactive'?'互动长文模式：保留用户自由输入，剧情可以有更明显的互动节点，但不使用固定选项限制用户。':'小说沉浸模式：以连贯、完整、具有章节感的文学叙事为主，用户在每段生成后决定下一步。';
    const flow='生成方式允许完整长文与角色轮流行动/对白并存。根据当前场景自然选择：安静场景可用连续叙述，群体对话或冲突场景可让角色逐一回应；不要强迫所有角色同时发言。';
    const system=`你是 LOVE RECORD SPACE 的长期长篇剧情写作引擎。只输出本轮新增的中文剧情正文，不要解释写作过程、不要输出设置摘要或 JSON。\n\n故事：${story.title}\n模式：${mode}\n叙事视角：${story.narrativeView==='first'?'第一人称':'第三人称'}。节奏：${story.pace==='slow'?'慢节奏':story.pace==='fast'?'快节奏':'正常节奏'}。默认文风：细腻文学风。\n连贯性：${rules.continuity}\n描写：${rules.detail}\n主动性：${rules.initiative}\n用户角色权限：${userControl}\n生成调度：${flow}\n故事专属规则：${story.extraRules||'无额外规则'}\n长记忆：后续上下文中的 longMemory 是当前分支的累积长期记忆；优先遵守其中已确认事实，同时以本轮明确的新信息修正已变化状态。\n关联城市：${story.cityId?'已关联城市；城市信息仅作为场景与居民状态参考，禁止擅自修改城市中的重大状态。':'未关联城市'}\n\n核心要求：人物必须遵循各自人设、语言习惯、背景和关系；人物只知道自己有机会知道的信息；场景、时间、物品、动作保持连贯；不得无缘无故跳地点、瞬间改变关系或遗忘已发生事件。多角色时让每个人有独立反应，不要所有人同声附和。NPC 创建策略为 ${story.npcPolicy}；当 NPC 策略允许 AI 创建时，如果剧情确实需要一位有姓名且可能再次出现的配角，请在整段正文末尾追加单独机器标记 [[LR_STORY_NPC:{\"name\":\"姓名\",\"role\":\"身份\",\"personality\":\"性格\",\"speech\":\"说话方式\",\"background\":\"背景\"}]]；不要为一次性路人创建档案，不要把标记解释给用户。手动模式下禁止追加标记。不要重复之前的段落，不要为了字数重复描写或灌水。\n本轮目标字数约 ${promptChunk} 个中文字符（不计空格），尽量接近目标；允许自然浮动，优先故事质量与自然收束。若本轮是续段，必须直接承接上一段最后的动作、对白或场景，不复述、不另起炉灶。`;
    const citySnapshot=story.cityId?bridge()?.getCitySnapshot?.(story.cityId)?.snapshot||null:null;const context={storyPremise:story.premise||'',worldBooks:world,characters,npcs:npcList,userPersona:persona,linkedCity:citySnapshot?{name:citySnapshot.name,worldNow:citySnapshot.worldNow,weather:citySnapshot.weather,season:citySnapshot.season,currentLocation:citySnapshot.currentLocation,currentLocationName:citySnapshot.currentLocationName,buildings:citySnapshot.buildings,residents:citySnapshot.residents,relationships:citySnapshot.relationships,families:citySnapshot.families,worldBooks:citySnapshot.worldBooks}:null,recentStory:recent,storySummary:story.summary||'',storyNotes:story.notes||'',longMemory:ensureLongMemory(story).summary||'',pendingOriginalUserInput:generation.userPrompt||'',alreadyGeneratedThisTurn:generation.generatedChars||0,previousGeneratedSegment:generation.lastSegment||'',instruction:generation.generatedChars?'请接着本轮已经生成的最后一句自然继续，保持同一场景与叙事节奏。':'根据用户本轮输入与故事设定开始创作。',targetLength:promptChunk};
    return {system,user:JSON.stringify(context)};
  }
  function extractNpcMarkers(raw,story){
    let body=String(raw||'');const markers=[];
    if(story.npcPolicy==='both'||story.npcPolicy==='ai'){
      body=body.replace(/\[\[LR_STORY_NPC:([\s\S]*?)\]\]/g,(whole,json)=>{try{const item=JSON.parse(json);if(item&&item.name)markers.push(item)}catch(e){console.warn('[SPACE] ignored invalid NPC marker',e)}return ''});
      story.npcs=story.npcs||[];markers.forEach(item=>{const name=textLimit(item.name,80);if(!name||story.npcs.some(x=>x.name===name))return;story.npcs.push({id:uid('npc'),name,role:textLimit(item.role,180),personality:textLimit(item.personality,1400),speech:textLimit(item.speech,1000),background:textLimit(item.background,1400),createdAt:Date.now(),source:'ai-story'})});
    }
    return body.trim();
  }
  async function generateStory(){
    if(generationBusy||!activeStory)return;
    const story=activeStory;let pending=story.pendingGeneration;
    if(!pending){const input=textLimit($('lrStoryUserInput')?.value,7000);if(!input&&!story.opening){notify('先写下开场、行动或你想发展的剧情。');return}const hasPriorUserTurn=activeEntries.some(x=>x.role==='user'||x.role==='assistant');const userPrompt=input||(!hasPriorUserTurn?story.opening:'')||'请根据当前剧情自然继续推进，保持前后连贯。';const userEntry=await appendEntry(story,'user',userPrompt,{generationId:uid('gen')});pending={id:userEntry.generationId||uid('gen'),userEntryId:userEntry.id,userPrompt,targetLength:Math.max(300,Math.min(12000,Number(story.targetLength)||2000)),generatedChars:0,lastSegment:'',status:'pending',chunks:0,createdAt:Date.now(),streamMode:$('lrStoryQuickStreamMode')?.value||story.streamMode||'stream'};story.pendingGeneration=pending;await saveMeta(story);$('lrStoryUserInput').value='';activeEntries=await loadStoryEntries(story.id);renderTranscript(story)}
    const selectedStreamMode=$('lrStoryQuickStreamMode')?.value==='complete'?'complete':'stream';pending.streamMode=selectedStreamMode;story.streamMode=selectedStreamMode;await saveMeta(story);
    const status=$('lrStoryGenerationStatus'),live=$('lrStoryLiveDraft'),liveStatus=$('lrStoryLiveStatus');generationBusy=true;cancelRequested=false;$('lrStoryGenerate').disabled=true;$('lrStoryCancelGeneration').hidden=false;live.hidden=false;live.textContent='';
    const target=Math.max(300,Math.min(12000,Number(pending.targetLength)||Number(story.targetLength)||2000));let loopCount=0;const maxChunks=Math.ceil(target/1250)+4;
    try{
      while(pending.generatedChars<target*0.95&&loopCount<maxChunks&&!cancelRequested){loopCount++;const remaining=target-pending.generatedChars;const chunkTarget=Math.max(250,Math.min(1250,remaining));let streamed='';const useStream=(pending.streamMode||story.streamMode||$('lrStoryQuickStreamMode')?.value)==='stream';
        status.textContent=`${useStream?'正在连接 API · 流式接收剧情':'正在调用 API · 等待完整回复'} · 第 ${pending.chunks+1} 段 · 已保存 ${pending.generatedChars} / ${target} 字…`;liveStatus.textContent=useStream?'流式输出中':'非流式生成中';$('lrStoryOutputHint').textContent=useStream?'API 正在流式返回正文，文字会逐步显示在下方剧情区域。':'API 正在生成完整段落，完成后会一次性显示在下方剧情区域。';live.textContent=useStream?'正在连接模型…':'AI 正在创作本段剧情，请稍候…';
        const req=storyPrompt(story,activeEntries,pending,chunkTarget);
        const raw=await bridge()?.callAPI?.(req.system,req.user,useStream?'SPACE 正在流式写作…':'SPACE 正在创作剧情…',true,120000,{stream:useStream,onDelta:delta=>{streamed+=delta;live.textContent=streamed;status.textContent=`正在接收第 ${pending.chunks+1} 段 · ${countChars(streamed)} 字 · 已保存 ${pending.generatedChars} / ${target} 字…`;}});
        if(!raw){if(streamed.trim()&&countChars(streamed)>30){const partial=extractNpcMarkers(streamed.trim(),story);if(partial){await appendEntry(story,'assistant',partial,{generationId:pending.id,chunkIndex:pending.chunks+1,partial:true});pending.generatedChars+=countChars(partial);pending.lastSegment=partial.slice(-2200);pending.chunks++;activeEntries=await loadStoryEntries(story.id);renderTranscript(story);await saveMeta(story);}}pending.status='partial';story.pendingGeneration=pending;await saveMeta(story);status.textContent=streamed.trim()?'流式连接中断；已收到的部分内容已保存，可以继续补完。':'本段未生成成功。此前完成的内容均已保存，可以稍后继续。';liveStatus.textContent='生成未完成';live.hidden=true;break}
        const clean=extractNpcMarkers(String(raw).trim(),story);if(!clean){pending.status='partial';story.pendingGeneration=pending;await saveMeta(story);status.textContent='AI 没有返回可用的剧情正文；已保存此前内容，可以稍后重试。';liveStatus.textContent='未收到有效正文';live.hidden=true;break}
        await appendEntry(story,'assistant',clean,{generationId:pending.id,chunkIndex:pending.chunks+1});pending.generatedChars+=countChars(clean);pending.lastSegment=clean.slice(-2200);pending.chunks++;pending.status='running';story.pendingGeneration=pending;await saveMeta(story);activeEntries=await loadStoryEntries(story.id);renderTranscript(story);renderBranches(story);$('lrStoryCast').innerHTML=createCastHtml(story);live.hidden=true;live.textContent='';
        if(cancelRequested)break;
        if(pending.generatedChars>=target*0.95)break;
        if(countChars(clean)<Math.max(150,chunkTarget*.35)){status.textContent='这一段已保存。AI 本次输出较短，为避免重复灌水，已暂停自动补写；可以检查后继续。';pending.status='partial';await saveMeta(story);break}
      }
      const completed=pending.generatedChars>=target*0.95;
      if(completed){story.pendingGeneration=null;status.textContent=`本轮剧情已保存完成 · ${pending.generatedChars} 字（目标 ${target} 字）`;}
      else if(cancelRequested){pending.status='paused';story.pendingGeneration=pending;status.textContent='已停止后续生成，当前内容已逐段保存；点击继续即可接近目标。'}
      else if(pending.status!=='partial'){pending.status='partial';story.pendingGeneration=pending;status.textContent=`已保存 ${pending.generatedChars} / ${target} 字，点击继续补完本次目标。`}
      await saveMeta(story);$('lrStoryGenerate').textContent=story.pendingGeneration?'继续补完本次目标':'生成下一段剧情';$('lrStoryGenerationStatus').textContent=status.textContent;liveStatus.textContent='';await renderHub();
    }catch(e){console.error('[SPACE story generation]',e);pending.status='partial';story.pendingGeneration=pending;await saveMeta(story);status.textContent='生成中断：'+(e.message||'未知错误')+'。已经生成的段落已保存，可以继续。';liveStatus.textContent='请求中断';live.hidden=true}
    finally{generationBusy=false;$('lrStoryGenerate').disabled=false;$('lrStoryCancelGeneration').hidden=true;if(!story.pendingGeneration&&activeStory?.id===story.id){Promise.resolve().then(()=>maybeAutoLongMemory(story)).catch(err=>console.warn('[SPACE auto long memory]',err));}}
  }
  async function saveWorkspaceSettings(){if(!activeStory)return;activeStory.mode=$('lrStoryWorkspaceMode').value==='interactive'?'interactive':'novel';activeStory.targetLength=Math.max(300,Math.min(12000,Number($('lrStoryWorkspaceTarget').value)||2000));activeStory.detail=$('lrStoryWorkspaceDetail').value;activeStory.continuity=$('lrStoryWorkspaceContinuity').value;activeStory.initiative=$('lrStoryWorkspaceInitiative').value;activeStory.userControl=$('lrStoryWorkspaceUserControl').value;activeStory.npcPolicy=$('lrStoryWorkspaceNpcPolicy').value;activeStory.narrativeView=$('lrStoryWorkspaceView').value;activeStory.pace=$('lrStoryWorkspacePace').value;activeStory.extraRules=textLimit($('lrStoryWorkspaceRules').value,5000);activeStory.summary=textLimit($('lrStoryWorkspaceSummary').value,9000);activeStory.notes=textLimit($('lrStoryWorkspaceNotes').value,9000);await saveMeta(activeStory);const manualNpc=document.querySelector('[data-story-action=\"manual-npc\"]'),aiNpc=document.querySelector('[data-story-action=\"ai-npc\"]');if(manualNpc)manualNpc.hidden=activeStory.npcPolicy==='ai';if(aiNpc)aiNpc.hidden=activeStory.npcPolicy==='manual';$('lrStoryContextMeta').textContent=`${(activeStory.characters||[]).length} 位主页 CHAR · ${(activeStory.npcs||[]).length} 位故事 NPC · ${(activeStory.worldBooks||[]).length} 本世界书 · 目标 ${activeStory.targetLength} 字`;notify('本故事写作设置已保存。')}
  async function rerollGeneration(generationId){
    if(!activeStory||generationBusy)return;
    const story=activeStory,rows=visibleEntries(story,activeEntries),gid=String(generationId||'');
    if(!gid){notify('这段剧情缺少原始轮次标识，暂时无法重 roll。');return}
    const aiRows=rows.filter(x=>x.role==='assistant'&&String(x.generationId||'')===gid);
    const userIndex=rows.findIndex(x=>x.role==='user'&&String(x.generationId||'')===gid);
    if(!aiRows.length||userIndex<0){notify('找不到这轮剧情对应的用户输入，无法安全重刷。');return}
    if(!confirm('将从这轮用户输入之前创建一个新的剧情分支，并重新调用 AI 生成。原来的剧情会完整保留，不会被覆盖。继续吗？'))return;
    const now=Date.now(),branchId=uid('branch'),newGenerationId=uid('gen');
    const branch={id:branchId,name:'重 roll · '+new Date(now).toLocaleString(),baseEntryIds:rows.slice(0,userIndex).map(x=>x.id),parentBranchId:story.activeBranchId||'main',forkEntryId:rows[userIndex-1]?.id||null,createdAt:now,kind:'reroll',rerolledFrom:generationId};
    story.branches=Array.isArray(story.branches)?story.branches:[];story.branches.push(branch);story.activeBranchId=branchId;
    const originalUser=rows[userIndex],all=activeEntries.filter(x=>x.storyId===story.id);
    const copiedUser={...originalUser,id:uid('entry'),branchId,seq:Math.max(0,...all.map(x=>Number(x.seq)||0))+1,generationId:newGenerationId,createdAt:now,rerolledFrom:generationId};
    await put(ENTRY_STORE,copiedUser);
    story.pendingGeneration={id:newGenerationId,userEntryId:copiedUser.id,userPrompt:originalUser.content,targetLength:Math.max(300,Math.min(12000,Number(story.targetLength)||2000)),generatedChars:0,lastSegment:'',status:'pending',chunks:0,createdAt:now,streamMode:$('lrStoryQuickStreamMode')?.value||story.streamMode||'stream'};
    ensureLongMemory(story);await saveMeta(story);activeEntries=await loadStoryEntries(story.id);renderBranches(story);renderTranscript(story);renderLongMemory(story);$('lrStoryUserInput').value='';$('lrStoryGenerationStatus').textContent='已创建重 roll 分支，正在使用原始用户输入重新生成；旧版本仍保留在原分支。';
    await generateStory();
  }
  async function createBranch(entryId){if(!activeStory)return;const rows=visibleEntries(activeStory,activeEntries),idx=rows.findIndex(x=>x.id===entryId);if(idx<0)return;const name=prompt('给新分支取个名字：','另一种发展');if(!name)return;const branch={id:uid('branch'),name:textLimit(name,60),baseEntryIds:rows.slice(0,idx+1).map(x=>x.id),parentBranchId:activeStory.activeBranchId,forkEntryId:entryId,createdAt:Date.now()};activeStory.branches.push(branch);activeStory.activeBranchId=branch.id;ensureLongMemory(activeStory);await saveMeta(activeStory);renderBranches(activeStory);renderTranscript(activeStory);renderLongMemory(activeStory);notify('已从指定剧情节点创建新分支，原故事线保留不变。')}
  function downloadFile(filename,content,mime){const blob=new Blob([content],{type:mime||'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  async function exportStory(story,format='md'){
    const all=await loadStoryEntries(story.id),rows=visibleEntries(story,all),safe=(story.title||'SPACE故事').replace(/[\\/:*?"<>|]/g,'_');
    const exportMemory=story.longMemory?.branches?.[String(story.activeBranchId||'main')]?.summary||'';const plain=[story.title||'未命名故事',story.premise||'',`模式：${story.mode==='interactive'?'互动长文':'小说沉浸'} · CHAR：${profileSummary(story)}`,exportMemory?`[长记忆]\n${exportMemory}`:'',...(story.timeline||[]).map(e=>`[时间轴] ${e.title} · ${e.note||''}`),'',...rows.map(x=>x.role==='user'?`【用户】\n${x.content}`:x.content)].join('\n\n');
    if(format==='txt'){downloadFile(safe+'.txt',plain,'text/plain;charset=utf-8');return}
    if(format==='json'){const bundle={format:'LOVE_RECORD_SPACE_STORY',version:2,exportedAt:Date.now(),story,entries:all};downloadFile(safe+'.space-story.json',JSON.stringify(bundle,null,2),'application/json;charset=utf-8');return}
    if(format==='pdf'){
      const win=window.open('','_blank');if(!win){notify('浏览器阻止了打印窗口，请允许弹窗后再导出 PDF。');return}
      const pdfMemory=exportMemory?`<section class="long-memory"><h2>长记忆</h2><div>${esc(exportMemory)}</div></section>`:'';win.document.write(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${esc(story.title)}</title><style>body{max-width:760px;margin:40px auto;padding:0 24px;font:16px/2 Georgia,'Noto Serif SC',serif;color:#333}h1{font-size:26px}.long-memory{padding:14px;margin:22px 0;background:#f7f0f7;border:1px solid #d8c7d8;white-space:pre-wrap}.long-memory h2{font-size:17px;margin:0 0 8px}article{white-space:pre-wrap;margin:24px 0;page-break-inside:avoid}.user{color:#765b7c;background:#f7f0f7;padding:12px}small{color:#888}@media print{body{margin:18mm auto}}</style><h1>${esc(story.title)}</h1><p>${esc(story.premise||'')}</p>${pdfMemory}${rows.map(x=>`<article class="${x.role==='user'?'user':''}"><small>${x.role==='user'?'用户':'剧情'} · ${esc(new Date(x.createdAt).toLocaleString())}</small><div>${esc(x.content)}</div></article>`).join('')}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></html>`);win.document.close();return
    }
    const content=[`# ${story.title}`,``,story.premise||'',``,`模式：${story.mode==='interactive'?'互动长文':'小说沉浸'} · CHAR：${profileSummary(story)}`,exportMemory?'## 长记忆\n\n'+exportMemory:'',``,`---`,``,...rows.map(x=>x.role==='user'?`**用户**\n\n${x.content}`:`${x.content}`).flatMap(x=>[x,'','---',''])].join('\n');downloadFile(safe+'.md',content,'text/markdown;charset=utf-8')
  }
  async function importStoryBackupFile(file){
    if(!file)return;
    let bundle;try{bundle=JSON.parse(await file.text())}catch(e){notify('备份文件不是有效 JSON。');return}
    if(bundle?.format!=='LOVE_RECORD_SPACE_STORY'||!bundle.story||!Array.isArray(bundle.entries)){notify('无法识别这个 SPACE 故事备份文件。');return}
    if(!confirm(`将导入故事「${String(bundle.story.title||'未命名故事')}」，并作为一部新故事加入档案。不会覆盖现有故事，是否继续？`))return;
    const story=JSON.parse(JSON.stringify(bundle.story)),entries=JSON.parse(JSON.stringify(bundle.entries));
    const oldStoryId=story.id,newStoryId=uid('story'),idMap=new Map();
    for(const entry of entries){const old=String(entry.id||uid('old'));idMap.set(old,uid('entry'))}
    story.id=newStoryId;story.createdAt=Date.now();story.updatedAt=Date.now();story.status='active';story.pendingGeneration=null;story.importedFrom={storyId:oldStoryId,at:Date.now(),formatVersion:bundle.version||1};
    story.branches=(Array.isArray(story.branches)?story.branches:[]).map(branch=>({...branch,baseEntryIds:(branch.baseEntryIds||[]).map(id=>idMap.get(String(id))).filter(Boolean),forkEntryId:idMap.get(String(branch.forkEntryId))||null}));
    if(!story.branches.length)story.branches=[{id:'main',name:'主线',baseEntryIds:[],createdAt:Date.now()}];
    if(!story.branches.some(b=>b.id===story.activeBranchId))story.activeBranchId=story.branches[0].id;
    if(story.longMemory?.branches&&typeof story.longMemory.branches==='object'){Object.values(story.longMemory.branches).forEach(memory=>{if(Array.isArray(memory.coveredEntryIds))memory.coveredEntryIds=memory.coveredEntryIds.map(id=>idMap.get(String(id))).filter(Boolean)})}
    const restored=entries.map(entry=>({...entry,id:idMap.get(String(entry.id)),storyId:newStoryId,importedAt:Date.now()}));
    try{await saveMeta(story);for(const entry of restored)await put(ENTRY_STORE,entry);await renderLibrary();await renderHub();notify(`故事「${story.title||'未命名故事'}」已导入。`)}catch(e){console.error('[SPACE story import]',e);notify('导入未能完整完成：'+(e.message||'本地数据库写入失败'))}
  }
  async function editEntry(id){const entry=activeEntries.find(x=>x.id===id);if(!entry)return;$('lrStoryEditEntryText').value=entry.content||'';$('lrStoryEditEntryModal').dataset.entryId=id;setModal('lrStoryEditEntryModal',true)}
  async function saveEntry(){const id=$('lrStoryEditEntryModal').dataset.entryId;const entry=activeEntries.find(x=>x.id===id);if(!entry)return;entry.content=$('lrStoryEditEntryText').value;entry.editedAt=Date.now();await put(ENTRY_STORE,entry);activeEntries=await loadStoryEntries(activeStory.id);setModal('lrStoryEditEntryModal',false);renderTranscript(activeStory);notify('剧情内容已修改。')}
  async function openStorySettings(){if(!activeStory)return;await openCreate(activeStory.id)}
  async function archiveStory(id){const stories=await loadStoryList(),story=stories.find(x=>x.id===id);if(!story)return;story.status=story.status==='archived'?'active':'archived';await saveMeta(story);await renderLibrary();await renderHub()}
  async function deleteStory(id){const story=(await loadStoryList()).find(x=>x.id===id);if(!story)return;if(!confirm(`确定永久删除「${story.title}」及其所有剧情记录吗？此操作无法撤销。建议先导出备份。`))return;await removeStoryRecords(id);await renderLibrary();await renderHub();notify('故事及其剧情记录已删除。')}
  function openOfflineSettings(){const panel=$('lrStorySettingsPanel');if(!panel)return;panel.hidden=false;panel.setAttribute('aria-hidden','false');document.body.classList.add('lr-story-settings-open');const first=panel.querySelector('button');first?.focus?.()}
  function closeOfflineSettings(){const panel=$('lrStorySettingsPanel');if(!panel)return;panel.hidden=true;panel.setAttribute('aria-hidden','true');document.body.classList.remove('lr-story-settings-open');$('lrStoryWorkspace')?.querySelector('[data-story-action="show-settings"]')?.focus?.()}
  function setModal(id,on){const el=$(id);if(el)el.classList.toggle('show',!!on)}
  async function handleAction(action,el){const id=el.dataset.storyId;switch(action){
    case 'new':await openCreate();break;
    case 'custom-css':openCustomCss();break;
    case 'import-backup':$('lrStoryBackupFile')?.click();break;
    case 'save-css':saveCustomCss();break;
    case 'reset-css':resetCustomCss();break;
    case 'export-css':exportCustomCss();break;
    case 'import-css':$('lrSpaceCssFile').click();break;
    case 'add-timeline-event':await addTimelineEvent();break;
    case 'remove-timeline-event':await removeTimelineEvent(el.dataset.eventId);break;
    case 'save-long-memory':await saveLongMemory();break;
    case 'summarize-long-memory':await summarizeLongMemory(activeStory,{automatic:false});break;
    case 'edit':await openCreate(id);break;
    case 'edit-active':if(activeStory)await openCreate(activeStory.id);break;
    case 'show-settings':openOfflineSettings();break;
    case 'close-settings':closeOfflineSettings();break;
    case 'edit-entry':await editEntry(el.dataset.entryId);break;
    case 'save-entry':await saveEntry();break;
    case 'export-txt':if(activeStory)await exportStory(activeStory,'txt');break;
    case 'export-json':if(activeStory)await exportStory(activeStory,'json');break;
    case 'export-pdf':if(activeStory)await exportStory(activeStory,'pdf');break;
    case 'library':await openLibrary();break;
    case 'home':showScreen('lrSpaceV2Directory');await renderHub();break;
    case 'open':await openStory(id);break;
    case 'export':if(activeStory)await exportStory(activeStory);break;
    case 'export-list':{const s=(await loadStoryList()).find(x=>x.id===id);if(s)await exportStory(s);break}
    case 'archive':await archiveStory(id);break;
    case 'delete':await deleteStory(id);break;
    case 'add-contact':renderAddContactModal();break;
    case 'manual-npc':delete $('lrStoryNpcModal').dataset.editingNpcId;$('lrStoryNpcName').value='';$('lrStoryNpcRole').value='';$('lrStoryNpcPersonality').value='';$('lrStoryNpcSpeech').value='';$('lrStoryNpcBackground').value='';$('lrStoryNpcModal').querySelector('[data-story-action=\"save-npc\"]').textContent='保存 NPC';setModal('lrStoryNpcModal',true);break;
    case 'edit-npc':editNpc(el.dataset.npcId);break;
    case 'delete-npc':await deleteNpc(el.dataset.npcId);break;
    case 'ai-npc':await generateNpc();break;
    case 'close-modal':setModal('lrStoryAddContactModal',false);setModal('lrStoryNpcModal',false);setModal('lrStoryEditEntryModal',false);break;
    case 'confirm-contacts':await addSelectedContacts();break;
    case 'save-npc':await saveNpc();break;
    case 'sync':await syncSources();break;
    case 'save-settings':await saveWorkspaceSettings();break;
    case 'sync-city-location':await syncStoryCityLocation();break;
    case 'fork':await createBranch(el.dataset.entryId);break;
    case 'reroll':await rerollGeneration(el.dataset.generationId);break;
  }}
  function bindEvents(){if(window.__LR_SPACE_STORY_EVENTS__)return;window.__LR_SPACE_STORY_EVENTS__=true;
    document.addEventListener('click',async e=>{
      if(e.target?.id==='lrStorySettingsPanel'){closeOfflineSettings();return}
      const themeButton=e.target.closest?.('[data-offline-theme-select]');if(themeButton){e.preventDefault();e.stopPropagation();setOfflineTheme(themeButton.dataset.offlineThemeSelect);return}
      const act=e.target.closest?.('[data-story-action]');if(act){e.preventDefault();e.stopPropagation();try{await handleAction(act.dataset.storyAction,act)}catch(err){console.error('[SPACE story action]',err);notify('操作失败：'+(err.message||'请稍后重试'))}return}
      if(e.target?.id==='lrStoryCreateSave'){await createStory();return}
      if(e.target?.id==='lrStoryGenerate'){await generateStory();return}
      if(e.target?.id==='lrStoryCancelGeneration'){cancelRequested=true;$('lrStoryGenerationStatus').textContent='正在结束当前段落，之后不会继续自动生成…';return}
    });
    document.addEventListener('input',e=>{if(e.target?.id==='lrStorySearch')renderLibrary()});
    document.addEventListener('change',e=>{if(e.target?.id==='lrStoryBackupFile'){const file=e.target.files?.[0];if(file)importStoryBackupFile(file);e.target.value=''}if(e.target?.id==='lrSpaceCssEnabled'){try{const raw=localStorage.getItem(SPACE_CSS_KEY)||'';applyCustomCss(raw,e.target.checked);localStorage.setItem(SPACE_CSS_KEY+':enabled',String(e.target.checked));$('lrSpaceCustomCssStatus').textContent=e.target.checked?'已启用自定义 CSS。':'已停用自定义 CSS，默认样式已恢复。'}catch(err){e.target.checked=false;$('lrSpaceCustomCssStatus').textContent='CSS 应用失败：'+err.message}}if(e.target?.id==='lrSpaceCssFile'){const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{$('lrSpaceCustomCssInput').value=String(reader.result||'');$('lrSpaceCustomCssStatus').textContent='文件已读取，请点击保存并应用。'};reader.onerror=()=>{$('lrSpaceCustomCssStatus').textContent='CSS 文件读取失败。'};reader.readAsText(f);e.target.value=''}});
    document.addEventListener('change',async e=>{if(e.target?.id==='lrStoryThemeMotion'){writeOfflineThemePref(OFFLINE_THEME_MOTION_KEY,e.target.checked);renderOfflineThemeControls();applyOfflineTheme();}if(e.target?.id==='lrStoryRainIntensity'){writeOfflineThemePref(OFFLINE_THEME_RAIN_KEY,e.target.value);renderOfflineThemeControls();if(readOfflineThemePrefs().theme==='rain'&&!$('lrSpaceStoryWorkspace')?.hidden)startOfflineThemeAnimation();}if(e.target?.id==='lrStoryWorkspaceMode'&&activeStory){activeStory.mode=e.target.value==='interactive'?'interactive':'novel';$('lrStoryComposerHint').textContent=activeStory.mode==='interactive'?'互动长文 · 输入你的动作、对白或想法，CHAR 会根据你的参与继续推进。':'小说沉浸 · 阅读完整段落后，再决定故事接下来往哪里走。';$('lrStoryUserInput').placeholder=activeStory.mode==='interactive'?'写下你的行动、对白或临时剧情方向……':'写下你希望下一段发生的事，或让故事自然继续……';await saveMeta(activeStory)}if(e.target?.id==='lrStoryBranchSelect'&&activeStory){activeStory.activeBranchId=e.target.value;await saveMeta(activeStory);renderTranscript(activeStory);renderLongMemory(activeStory)}if(e.target?.id==='lrStoryQuickStreamMode'&&activeStory){activeStory.streamMode=e.target.value==='complete'?'complete':'stream';$('lrStoryOutputHint').textContent=activeStory.streamMode==='stream'?'流式：正文会随模型输出逐步出现。':'非流式：等待本段完整生成后，再显示正文。';await saveMeta(activeStory)}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('lrStorySettingsPanel')?.hidden){closeOfflineSettings();return}if(e.target?.id==='lrStoryUserInput'&&e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();generateStory()}});
    window.addEventListener('lr-worldbooks-updated',()=>{if(activeStory)renderSourceChanges(activeStory)});
    window.addEventListener('lr-contacts-updated',()=>{if(activeStory)renderSourceChanges(activeStory)});
    window.addEventListener('lr-self-personas-updated',()=>{if(activeStory)renderSourceChanges(activeStory)});
  }
  async function onSpaceReady(){injectStyles();injectOfflineFocusStyles();injectOfflineThemeStyles();injectOfflineThemeQualityStyles();injectOfflineThemeControlStyles();ensureScreens();ensureHub();renderOfflineThemeControls();loadCustomCssAtBoot();bindEvents();await renderHub();if(!offlineThemeLifecycleBound){offlineThemeLifecycleBound=true;window.addEventListener('resize',()=>{if(!$('lrSpaceStoryWorkspace')?.hidden&&readOfflineThemePrefs().motion)resizeOfflineThemeCanvas()},{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stopOfflineThemeAnimation();else if(!$('lrSpaceStoryWorkspace')?.hidden)startOfflineThemeAnimation()});}}
  window.addEventListener('lr-space-v2-ready',()=>{onSpaceReady().catch(e=>console.error('[SPACE story ready]',e))});
  // Also initialize in case the module is evaluated after SPACE has already been opened.
  if($('space')?.classList.contains('lr-space-v2'))onSpaceReady().catch(e=>console.error('[SPACE story init]',e));
})();
