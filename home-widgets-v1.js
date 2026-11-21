/* LOVE RECORD · WIDGET STUDIO
   INS editorial widget library + free-form widget creator.
   Isolated IndexedDB storage; per-launcher-page layouts; draggable widgets. */
(()=>{'use strict';
const launcher=document.getElementById('launcher');
if(!launcher||window.__LR_WIDGET_STUDIO_V2)return;
window.__LR_WIDGET_STUDIO_V2=true;

const DB='love-record-home-widgets-db',STORE='layout',DBKEY='desktop-layout-v1',VERSION=12;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>`w${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
const dateText=()=>new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'});
const clockText=()=>new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
const $=id=>document.getElementById(id);
const notify=t=>{if(typeof window.toast==='function')window.toast(t);else{const n=$('toast');if(n){n.textContent=t;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),2200)}}};

const templates=[
 {id:'photo',cat:'MEMORY',name:'PHOTO MOMENT',desc:'一张照片，留住此刻',size:'large',skin:'photo'},
 {id:'collage',cat:'MEMORY',name:'PHOTO JOURNAL',desc:'三张照片组成一页回忆',size:'large',skin:'collage'},
 {id:'vinyl',cat:'MUSIC',name:'NOW PLAYING',desc:'正在播放的音乐与专辑封面',size:'medium',skin:'vinyl'},
 {id:'clock',cat:'DAILY',name:'THE TIME',desc:'时间与日期，极简呈现',size:'small',skin:'clock'},
 {id:'calendar',cat:'DAILY',name:'MONTHLY',desc:'月历与今日日期',size:'medium',skin:'calendar'},
 {id:'quote',cat:'EDITORIAL',name:'A LITTLE NOTE',desc:'留下一句今天想说的话',size:'medium',skin:'quote'},
 {id:'note',cat:'EDITORIAL',name:'DAILY THOUGHT',desc:'随手记录值得记住的事',size:'small',skin:'note'},
 {id:'love',cat:'LOVE',name:'DAYS TOGETHER',desc:'记录属于你们的每一天',size:'medium',skin:'love'}
];
const categories=['全部','MEMORY','MUSIC','DAILY','EDITORIAL','LOVE'];
let state={items:[],pageItems:{},pagePositions:{},customTemplates:[],activePage:0};
let editMode=false,drag=null,longPress=null,longTimer=null,blankTimer=null,blankStart=null,activeTab='全部',sheetMode='library',editingUid=null,editorDraft=null,saveChain=Promise.resolve();
let activeCategory='全部',myTemplatesOnly=false;

function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function dbGet(){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(DBKEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();tx.onerror=()=>db.close()})}
async function dbSet(value){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,DBKEY);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();reject(tx.error)};tx.onabort=()=>{db.close();reject(tx.error||new Error('save aborted'))}})}
function pageNow(){return Math.max(0,Number(window.__loveRecordLauncherCurrentPage)||0)}
function snapshot(){state.pageItems[String(state.activePage)]=state.items.map(x=>structuredClone(x));state.pagePositions[String(state.activePage)]=state.items.reduce((o,x)=>{o[x.uid]=x.pos||null;return o},{});return {version:VERSION,items:structuredClone(state.items),pageItems:structuredClone(state.pageItems),pagePositions:structuredClone(state.pagePositions),customTemplates:structuredClone(state.customTemplates),updatedAt:Date.now()}}
function save(silent=false){const data=snapshot();saveChain=saveChain.then(()=>dbSet(data)).then(()=>{window.dispatchEvent(new CustomEvent('lr-home-widgets-changed',{detail:data}));if(!silent)notify('组件已保存 ♡')}).catch(e=>{console.error('[WIDGET STUDIO] save failed',e);notify('保存失败，请检查浏览器储存空间')});return saveChain}
async function load(){let old=null;try{old=await dbGet()}catch(e){console.warn(e)}
 if(old&&Number(old.version)>=VERSION){state.pageItems=old.pageItems||{};state.pagePositions=old.pagePositions||{};state.customTemplates=Array.isArray(old.customTemplates)?old.customTemplates:[]}
 else if(old){/* Keep existing desktop placements and user content during the visual-library refresh. */state.pageItems=old.pageItems||{};state.pagePositions=old.pagePositions||{};state.customTemplates=Array.isArray(old.customTemplates)?old.customTemplates:[]}
 state.activePage=pageNow();state.items=(state.pageItems[String(state.activePage)]||[]).map(x=>({...x,uid:x.uid||uid(),size:['small','medium','large'].includes(x.size)?x.size:'medium'}));
 state.pageItems[String(state.activePage)]=structuredClone(state.items);
 await save(true);renderDesktop();
}

const style=document.createElement('style');style.id='lr-widget-studio-style';style.textContent=`
#launcher .launcher-welcome,#launcher .launcher-info{display:none!important}
#lrWidgetBoard{position:relative;width:100%;margin:0 0 18px;min-width:0}
#lrWidgetShelf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:124px;grid-auto-flow:row;gap:12px;padding:0 2px;width:100%;min-width:0;align-items:stretch}
.lrw-card{position:relative;min-width:0;min-height:0;overflow:hidden;grid-column:span 1;border:1px solid #deddd9;border-radius:4px;background:#f7f6f2;color:#242422;box-shadow:0 5px 18px rgba(20,20,20,.045);padding:14px;touch-action:none;box-sizing:border-box}
.lrw-card.medium{grid-column:1/-1}.lrw-card.large{grid-column:1/-1;min-height:250px;grid-row:span 2}
.lrw-card.small{grid-column:span 1;min-height:124px}
.lrw-card .lrw-kicker{font:8px/1.4 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#85847f;margin-bottom:8px}
.lrw-card .lrw-title{font:500 15px/1.3 Georgia,"Noto Serif SC",serif;letter-spacing:.3px;color:#252522}
.lrw-card .lrw-copy{font:12px/1.6 Georgia,"Noto Serif SC",serif;color:#55534f;white-space:pre-wrap;overflow-wrap:anywhere}
.lrw-card .lrw-meta{font:8px/1.5 Arial,sans-serif;letter-spacing:1.6px;color:#898781}.lrw-tone-ink .lrw-kicker,.lrw-tone-ink .lrw-title,.lrw-tone-ink .lrw-copy,.lrw-tone-ink .lrw-meta,.lrw-tone-ink .lrw-preview-block,.lrw-live-preview.ink .lrw-preview-block{color:#f7f6f2!important}.lrw-tone-grey{background:#e8e7e1!important}
.lrw-card .lrw-tools{display:none;position:absolute;right:7px;top:7px;z-index:8;gap:5px}
#launcher.lrw-editing .lrw-card .lrw-tools{display:flex}
.lrw-card .lrw-tools button{width:27px;height:27px;border:1px solid #d5d3ce;border-radius:50%;background:rgba(255,255,255,.96);color:#252522;font-size:13px}
#launcher.lrw-editing .lrw-card{outline:1px dashed #686761;outline-offset:2px;cursor:grab;touch-action:none}
#launcher.lrw-editing .lrw-card.lrw-dragging{z-index:999!important;opacity:.94;box-shadow:0 18px 40px #0002;transition:none}
#lrWidgetBoard .lrw-editbar{display:none;justify-content:flex-end;gap:8px;margin:0 4px 12px}
#launcher.lrw-editing .lrw-editbar{display:flex}
.lrw-editbar button{border:1px solid #d5d3ce;border-radius:999px;background:#242422;color:#fff;padding:9px 16px;font:11px Arial,sans-serif;letter-spacing:1px}
.lrw-editbar button.secondary{background:#fff;color:#242422}
#lrwStudioOverlay{position:fixed;inset:0;z-index:100500;display:none;align-items:flex-end;justify-content:center;background:rgba(23,23,22,.32);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);padding:0}
#lrwStudioOverlay.show{display:flex}
.lrw-sheet{width:min(100%,620px);max-height:91dvh;overflow:auto;overscroll-behavior:contain;background:#f8f7f3;color:#252522;border:1px solid #fff;border-radius:26px 26px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -18px 60px #0002}
.lrw-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:0 1px 15px;border-bottom:1px solid #deddd8}
.lrw-eyebrow{font:8px Arial,sans-serif;letter-spacing:2.6px;color:#8a8982;text-transform:uppercase}
.lrw-sheet-head h2{margin:6px 0 0;font:400 25px/1.1 Georgia,"Noto Serif SC",serif;letter-spacing:.7px}
.lrw-sheet-head p{margin:7px 0 0;font:9px/1.5 Arial,"Noto Sans SC",sans-serif;letter-spacing:1px;color:#898780}
.lrw-close{width:36px;height:36px;border:1px solid #d8d7d1;border-radius:50%;background:#fff;color:#242422;font-size:20px}
.lrw-tabs{display:flex;gap:7px;margin:15px 0 13px}
.lrw-tab{flex:1;min-height:40px;border:1px solid #deddd8;border-radius:999px;background:#efeee9;color:#55544f;font:11px Arial,"Noto Sans SC",sans-serif;letter-spacing:.5px}
.lrw-tab.active{background:#242422;color:#fff;border-color:#242422}
.lrw-cats{display:flex;gap:7px;overflow:auto;padding:0 0 10px;scrollbar-width:none}
.lrw-cats button{white-space:nowrap;border:1px solid #d9d8d2;border-radius:999px;background:transparent;color:#6f6e68;padding:7px 11px;font:9px Arial,sans-serif;letter-spacing:1px}
.lrw-cats button.active{background:#e5e3dd;color:#242422;border-color:#c9c7c0}
.lrw-template-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.lrw-template{border:1px solid #deddd8;border-radius:5px;background:#fff;padding:10px;text-align:left;color:#252522;min-width:0}
.lrw-template-preview{height:122px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f4f3ef;border:1px solid #e8e7e1;margin-bottom:9px;padding:8px;box-sizing:border-box}
.lrw-template-name{font:14px Georgia,"Noto Serif SC",serif}
.lrw-template-desc{font:9px/1.5 Arial,"Noto Sans SC",sans-serif;color:#88867f;margin-top:5px}
.lrw-addline{display:flex;justify-content:space-between;align-items:center;margin-top:9px;padding-top:8px;border-top:1px solid #ecebe6;font:9px Arial,sans-serif;letter-spacing:1px;color:#686760}
.lrw-template-preview>div{width:100%;height:100%;box-sizing:border-box}
.pv-receipt{background:#fff;padding:9px;font:8px/1.7 monospace;display:flex;flex-direction:column;color:#333}.pv-receipt b{text-align:center;font-size:14px;letter-spacing:2px}.pv-receipt hr{width:100%;border:0;border-top:1px dashed #aaa;margin:auto 0 5px}.pv-camera{background:#1d1d1c;color:white;display:flex;flex-direction:column;justify-content:space-between;padding:8px;font:8px Arial}.pv-camera b{font-size:38px;text-align:center;font-weight:200}.pv-web{background:white;padding:9px;display:flex;flex-direction:column;gap:10px;color:#333}.pv-web small{font:7px Arial;letter-spacing:1px;color:#999}.pv-web b{font:14px Georgia}.pv-web i{font:italic 10px Georgia;color:#777}.pv-weather{background:#e9e8e2;padding:10px;display:flex;flex-direction:column;justify-content:space-between;color:#292927}.pv-weather b{font:36px Georgia}.pv-weather small,.pv-weather i{font:8px Arial;letter-spacing:1px}.pv-profile{background:#e7e5df;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#222}.pv-avatar{width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center;font:12px Georgia}.pv-profile b{font:14px Georgia}.pv-profile small,.pv-profile i{font:7px Arial;letter-spacing:1px}.pv-voice{background:#e8e7e1;border-radius:22px;padding:13px 7px;font:10px Arial;text-align:center;color:#333}.pv-vinyl{border-radius:50%;width:92px!important;height:92px!important;background:repeating-radial-gradient(circle,#252522 0 3px,#444 4px 5px);color:white;display:flex;flex-direction:column;align-items:center;justify-content:center}.pv-vinyl span{font-size:24px}.pv-vinyl b{font:7px Arial}.pv-vinyl small{font:5px Arial}.pv-photo{background:#e7e6e1;padding:13px;display:flex;flex-direction:column;justify-content:space-between}.pv-photo div{flex:1;background:#f8f7f3;display:grid;place-items:center;font:8px Arial;letter-spacing:2px;color:#aaa}.pv-photo small{font:7px Georgia;text-align:center;padding-top:7px}.pv-quote{background:#f9f8f4;display:flex;flex-direction:column;justify-content:space-between;padding:9px}.pv-quote small,.pv-quote i{font:7px Arial;letter-spacing:1px;color:#aaa}.pv-quote b{font:17px/1.5 Georgia,"Noto Serif SC",serif;text-align:center}.pv-calendar{background:#fff;padding:9px;display:flex;flex-direction:column;gap:12px;font:9px Arial}.pv-calendar div{line-height:2.3;letter-spacing:1px}.pv-calendar strong{background:#252522;color:#fff;border-radius:50%;padding:3px}.pv-clock{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#fff}.pv-clock b{font:42px Arial;letter-spacing:-2px}.pv-clock small{font:7px Arial;letter-spacing:1px;color:#999}.pv-note{background:#f5f1e8;padding:12px;display:flex;flex-direction:column;justify-content:space-between}.pv-note small,.pv-note i{font:7px Arial;letter-spacing:1px;color:#888}.pv-note b{font:15px Georgia}.pv-contact{background:#fff;border:1px solid #ddd;padding:13px;display:flex;flex-direction:column;justify-content:space-around}.pv-contact small,.pv-contact i{font:7px Arial;letter-spacing:1px;color:#999}.pv-contact b{font:22px Georgia}.pv-collage{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:5px;background:#eee;padding:5px}.pv-collage i{background:#d5d3cc}.pv-collage i:nth-child(2){grid-row:span 2;background:#c7c5bd}.pv-collage b{font:7px Arial;letter-spacing:1px}
.lrw-create-hero{padding:16px;background:#242422;color:#fff;margin:13px 0;border-radius:4px}
.lrw-create-hero strong{display:block;font:18px Georgia,"Noto Serif SC",serif}.lrw-create-hero span{display:block;margin-top:6px;font:8px Arial;letter-spacing:2px;color:#bbb}
.lrw-create-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.lrw-create-actions button{min-height:58px;border:1px solid #deddd8;background:#fff;color:#282824;text-align:left;padding:10px;font:12px Georgia,"Noto Serif SC",serif}
.lrw-create-actions small{display:block;margin-top:4px;color:#999;font:8px Arial;letter-spacing:1px}
.lrw-editor-grid{display:grid;grid-template-columns:1fr;gap:12px}
.lrw-preview-stage{background:#e8e7e1;padding:16px;border:1px solid #d9d8d1;display:grid;place-items:center;min-height:180px}
.lrw-live-preview{width:min(100%,310px);min-height:150px;padding:18px;background:#f8f7f3;border:1px solid #d8d7d1;box-shadow:0 10px 24px #0001;color:#242422;overflow:hidden;box-sizing:border-box}.lrw-live-preview.ink,.lrw-tone-ink{background:#242422!important;color:#f7f6f2!important;border-color:#242422!important}.lrw-live-preview.grey,.lrw-tone-grey{background:#e8e7e1!important;color:#292927!important}
.lrw-preview-block{margin:0 0 10px;overflow-wrap:anywhere;white-space:pre-wrap}
.lrw-preview-block.eyebrow{font:8px Arial;letter-spacing:2px;color:#999;text-transform:uppercase}
.lrw-preview-block.heading{font:25px/1.2 Georgia,"Noto Serif SC",serif}
.lrw-preview-block.body{font:13px/1.7 Georgia,"Noto Serif SC",serif}
.lrw-preview-block.date{font:9px Arial;letter-spacing:2px;color:#888}
.lrw-preview-block.sticker{font-size:28px}
.lrw-preview-block img{display:block;width:100%;max-height:150px;object-fit:cover}
.lrw-block-list{display:grid;gap:8px}
.lrw-block-row{background:#fff;border:1px solid #deddd8;padding:10px;display:grid;grid-template-columns:1fr auto;gap:7px}
.lrw-block-row label{grid-column:1/-1;font:8px Arial;letter-spacing:1.5px;color:#999}
.lrw-block-row textarea,.lrw-block-row input[type=text]{width:100%;border:1px solid #e2e1dc;background:#faf9f6;padding:9px;color:#242422;font:12px Georgia,"Noto Serif SC",serif;box-sizing:border-box}
.lrw-block-row button{border:1px solid #ddd;background:#f4f3ef;padding:5px 9px;color:#555}.lrw-block-style{grid-column:1/-1;display:flex;gap:6px;align-items:center}.lrw-block-style select{min-width:0;flex:1;border:1px solid #e2e1dc;background:#faf9f6;padding:6px;color:#555;font:9px Arial}.lrw-block-style input[type=color]{width:32px;height:30px;border:1px solid #ddd;background:#fff;padding:2px}
.lrw-editor-tools{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}
.lrw-editor-tools button,.lrw-primary,.lrw-secondary{border:1px solid #d7d6d0;border-radius:999px;padding:10px 14px;background:#242422;color:white;font:10px Arial,"Noto Sans SC",sans-serif;letter-spacing:.6px}
.lrw-editor-tools button{background:#fff;color:#292925}
.lrw-primary{width:100%;min-height:46px;margin-top:10px}
.lrw-secondary{background:#fff;color:#242422}
.lrw-field{display:grid;gap:6px;margin:10px 0}.lrw-field label{font:8px Arial;letter-spacing:1.5px;color:#8c8a83}.lrw-field input,.lrw-field select{width:100%;box-sizing:border-box;border:1px solid #dcdad4;background:#fff;padding:11px;color:#242422;border-radius:2px}
.lrw-mine-empty{padding:32px 12px;text-align:center;color:#999;font:12px Georgia}
.lrw-foot{font:9px/1.7 Arial,"Noto Sans SC",sans-serif;color:#929087;margin:14px 2px 0}
.lrw-receipt{background:#f7f5ee;border-style:dashed;padding:15px 18px}.lrw-receipt .lrw-copy{font:10px/1.9 monospace}.lrw-receipt .lrw-title{text-align:center;font:22px Georgia;letter-spacing:2px}
.lrw-camera{background:#1c1c1b;color:#fff;border-color:#1c1c1b}.lrw-camera .lrw-kicker,.lrw-camera .lrw-title,.lrw-camera .lrw-meta{color:#fff}
.lrw-camera-frame{border:1px solid #ffffff88;min-height:74px;margin:8px 0;display:grid;place-items:center;font:30px Arial;color:#fff}
.lrw-webclip{background:#fff;border-radius:2px;padding:15px 17px}
.lrw-weather{background:#e9e8e2}
.lrw-profile{background:#e9e8e2;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
.lrw-profile .lrw-avatar{width:54px;height:54px;border-radius:50%;background:#fff;display:grid;place-items:center;margin:5px auto 10px;font:17px Georgia;overflow:hidden}.lrw-profile .lrw-avatar img{width:100%;height:100%;object-fit:cover}
.lrw-voice{background:#e8e7e1;border:0;border-radius:28px;min-height:78px;display:flex;align-items:center;justify-content:center;font:11px Arial}
.lrw-vinyl{display:flex;align-items:center;gap:15px;background:#f0efeb}
.lrw-record{width:88px;height:88px;border-radius:50%;background:repeating-radial-gradient(circle,#242422 0 3px,#444 4px 5px);display:grid;place-items:center;flex:none}
.lrw-record span{width:28px;height:28px;border-radius:50%;background:#e8e6df;display:grid;place-items:center;font-size:11px}.lrw-play-dot{cursor:pointer}
.lrw-photo{background:#eeede8;padding:12px}.lrw-photo img{width:100%;height:145px;object-fit:cover;display:block}.lrw-photo-placeholder{height:145px;background:#deddd7;display:grid;place-items:center;color:#999;font:9px Arial;letter-spacing:2px}
.lrw-quote{display:flex;flex-direction:column;justify-content:space-between;background:#faf9f5}
.lrw-calendar{background:#fff}.lrw-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:10px;text-align:center;font:9px Arial;color:#777}.lrw-calendar-grid span{padding:4px 0}.lrw-calendar-grid .today{background:#252522;color:#fff;border-radius:50%}
.lrw-clock{background:#fff;text-align:center;display:flex;flex-direction:column;justify-content:center}.lrw-clock .lrw-clock-time{font:clamp(35px,10vw,54px)/1 Arial;letter-spacing:-2px}
.lrw-note{background:#f3efe6;border:0;padding:18px}
.lrw-contact{background:#fff;border:1px solid #ddd;display:flex;flex-direction:column;justify-content:space-around}
.lrw-collage{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;background:#e7e6e0;padding:9px}.lrw-collage img{width:100%;height:100%;object-fit:cover;min-height:75px}.lrw-collage img:nth-child(2){grid-row:span 2}
@media(max-width:370px){.lrw-sheet{padding-left:13px;padding-right:13px}.lrw-template-preview{height:108px}.lrw-card{padding:11px}}
`;document.head.appendChild(style);

/* V10 — liquid frosted glass system */
const glassStyle=document.createElement('style');glassStyle.id='lr-widget-liquid-glass-v10';glassStyle.textContent=`
#lrWidgetBoard{margin:0 0 20px;padding:0 1px}
#lrWidgetShelf{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:auto!important;grid-auto-flow:row!important;align-items:start!important;gap:14px!important;padding:4px 3px 12px!important}
.lrw-card{
 position:relative;display:flex;flex-direction:column;justify-content:center;align-items:stretch;
 width:100%;height:auto!important;min-height:0!important;aspect-ratio:2/1;
 box-sizing:border-box;overflow:hidden;isolation:isolate;
 padding:clamp(13px,3.6vw,22px)!important;
 border:1px solid rgba(255,255,255,.78)!important;border-radius:22px!important;
 background:linear-gradient(135deg,rgba(255,255,255,.48),rgba(250, 244, 234, .25) 48%,rgba(233, 228, 219, .34))!important;
 color:#302d35!important;
 -webkit-backdrop-filter:blur(30px) saturate(1.8)!important;backdrop-filter:blur(30px) saturate(1.8)!important;
 box-shadow:inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(255,255,255,.34),0 14px 34px rgba(62, 59, 56, .13),0 2px 7px rgba(55, 52, 49, .06)!important;
 transition:box-shadow .22s ease,transform .22s ease,border-color .22s ease;
}
.lrw-card::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;background:linear-gradient(128deg,rgba(255,255,255,.82) 0%,rgba(255,255,255,.18) 26%,transparent 48%,rgba(255,255,255,.22) 100%);opacity:.9}
.lrw-card::after{content:"";position:absolute;z-index:0;pointer-events:none;width:68%;height:90%;right:-28%;top:-48%;border-radius:50%;background:radial-gradient(ellipse,rgba(255,255,255,.64),rgba(255,255,255,0) 68%);filter:blur(5px)}
.lrw-card>*{position:relative;z-index:1}
.lrw-card.small{aspect-ratio:1/1!important}
.lrw-card.medium{aspect-ratio:2.05/1!important}
.lrw-card.large{aspect-ratio:1.62/1!important}
.lrw-card.lrw-profile{aspect-ratio:2.15/1!important}
.lrw-card.lrw-photo{aspect-ratio:1.85/1!important}
.lrw-card.lrw-collage{aspect-ratio:1.9/1!important}
.lrw-card.lrw-camera{aspect-ratio:1.9/1!important}
.lrw-card.lrw-vinyl{aspect-ratio:2.15/1!important}
.lrw-card.lrw-weather{aspect-ratio:1.85/1!important}
.lrw-card.lrw-quote{aspect-ratio:1.95/1!important}
.lrw-card.lrw-calendar{aspect-ratio:1.75/1!important}
.lrw-card.lrw-webclip{aspect-ratio:1.8/1!important}
.lrw-card.lrw-small,.lrw-card.lrw-clock,.lrw-card.lrw-note,.lrw-card.lrw-contact,.lrw-card.lrw-receipt,.lrw-card.lrw-voice{aspect-ratio:1/1!important}
.lrw-card.lrw-tone-ink{background:linear-gradient(145deg,rgba(42,39,48,.88),rgba(24,23,29,.72))!important;border-color:rgba(255,255,255,.24)!important;color:#FFFAF0!important}
.lrw-card.lrw-tone-ink::before{background:linear-gradient(130deg,rgba(255,255,255,.22),transparent 42%,rgba(255,255,255,.06))}
.lrw-card.lrw-tone-grey{background:linear-gradient(145deg,rgba(241, 235, 226, .76),rgba(208,207,216,.52))!important}
.lrw-card .lrw-kicker{font:7px/1.5 Arial,sans-serif!important;letter-spacing:2.2px!important;color:rgba(63,57,70,.58)!important}
.lrw-card .lrw-title{font:500 clamp(15px,4.4vw,21px)/1.35 Georgia,"Noto Serif SC",serif!important;letter-spacing:.5px!important;color:#302c36!important}
.lrw-card .lrw-copy{font:12px/1.65 Georgia,"Noto Serif SC",serif!important;color:rgba(48,44,54,.78)!important}
.lrw-card .lrw-meta{font:7px/1.55 Arial,sans-serif!important;letter-spacing:1.8px!important;color:rgba(66,60,73,.52)!important}
.lrw-card.lrw-tone-ink .lrw-kicker,.lrw-card.lrw-tone-ink .lrw-title,.lrw-card.lrw-tone-ink .lrw-copy,.lrw-card.lrw-tone-ink .lrw-meta{color:rgba(255,255,255,.84)!important}
.lrw-card.lrw-profile .lrw-avatar{width:44px;height:44px;margin:0 auto 7px;background:rgba(255,255,255,.62);border:1px solid rgba(255,255,255,.9);box-shadow:0 4px 16px rgba(68, 65, 62, .10);color:#88847E}
.lrw-card.lrw-profile .lrw-title{font-size:18px!important}
.lrw-card.lrw-profile .lrw-meta{margin-top:4px}
.lrw-card.lrw-photo{padding:12px!important;gap:8px}
.lrw-card.lrw-photo img{width:100%;height:calc(100% - 24px)!important;max-height:none!important;min-height:0;flex:1;object-fit:cover;border-radius:13px;box-shadow:0 5px 16px rgba(37, 34, 32, .12)}
.lrw-card.lrw-photo .lrw-photo-placeholder{height:auto;min-height:0;flex:1;border-radius:13px;background:linear-gradient(135deg,rgba(255,255,255,.7),rgba(228, 223, 214, .55));border:1px solid rgba(255,255,255,.8);color:rgba(65,59,72,.55)}
.lrw-card.lrw-camera{background:linear-gradient(145deg,rgba(35,33,41,.90),rgba(64,58,72,.78))!important;border-color:rgba(255,255,255,.38)!important;color:#fff!important}
.lrw-card.lrw-camera .lrw-kicker,.lrw-card.lrw-camera .lrw-meta{color:rgba(255,255,255,.7)!important}
.lrw-card.lrw-camera .lrw-camera-frame{flex:1;min-height:0;margin:5px 0;border-radius:14px;border:1px solid rgba(255,255,255,.32);background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.025));overflow:hidden}
.lrw-card.lrw-camera .lrw-camera-frame img{width:100%;height:100%;object-fit:cover}
.lrw-card.lrw-vinyl{flex-direction:row;align-items:center;justify-content:center;gap:16px}
.lrw-card.lrw-record{border:1px solid rgba(255,255,255,.55)}
.lrw-card.lrw-weather{background:linear-gradient(135deg,rgba(255,255,255,.50),rgba(228, 223, 214, .28))!important}
.lrw-card.lrw-quote{justify-content:space-between}
.lrw-card.lrw-quote .lrw-title{font-size:clamp(17px,5vw,24px)!important;max-width:88%;margin:auto!important}
.lrw-card.lrw-calendar .lrw-calendar-grid{gap:3px;margin-top:6px}
.lrw-card.lrw-calendar .lrw-calendar-grid span{padding:2px 0}
.lrw-card.lrw-note{background:linear-gradient(135deg,rgba(255,255,255,.50),rgba(237, 232, 223, .28))!important}
.lrw-card.lrw-receipt{border-style:solid!important}
.lrw-card.lrw-voice{border-radius:24px!important;background:linear-gradient(135deg,rgba(255,255,255,.48),rgba(226, 221, 212, .32))!important}
.lrw-card .lrw-tools{right:9px!important;top:9px!important;gap:6px!important}
.lrw-card .lrw-tools button{width:29px!important;height:29px!important;border:1px solid rgba(255,255,255,.88)!important;background:rgba(255,255,255,.58)!important;color:#50495a!important;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:0 3px 10px rgba(43, 40, 38, .08)!important}
#launcher.lrw-editing .lrw-card{outline:1px solid rgba(255,255,255,.92)!important;outline-offset:2px;cursor:grab;box-shadow:inset 0 0 0 1px rgba(135, 131, 125, .16),0 10px 28px rgba(68, 65, 62, .13)!important}
#launcher.lrw-editing .lrw-card.lrw-dragging{box-shadow:0 24px 48px rgba(42, 39, 37, .24)!important}
#lrWidgetBoard .lrw-editbar{gap:9px!important;margin:0 5px 13px!important}
.lrw-editbar button{border:1px solid rgba(255,255,255,.9)!important;border-radius:999px!important;background:rgba(255,255,255,.58)!important;color:#38333e!important;padding:10px 18px!important;font:10px Arial,"Noto Sans SC",sans-serif!important;letter-spacing:1.2px!important;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 5px 18px rgba(49, 46, 43, .08)!important}
.lrw-editbar button:not(.secondary){background:linear-gradient(145deg,rgba(48,45,54,.92),rgba(24,23,28,.94))!important;color:#fff!important;border-color:rgba(255,255,255,.55)!important}
#lrwStudioOverlay{background:rgba(33, 31, 29, .25)!important;-webkit-backdrop-filter:blur(22px) saturate(1.45)!important;backdrop-filter:blur(22px) saturate(1.45)!important}
.lrw-sheet{width:min(100%,640px)!important;max-height:93dvh!important;padding:22px 18px calc(24px + env(safe-area-inset-bottom))!important;border:1px solid rgba(255,255,255,.84)!important;border-bottom:0!important;border-radius:30px 30px 0 0!important;background:linear-gradient(135deg,rgba(255, 250, 240, .72),rgba(229, 224, 215, .58))!important;color:#302c36!important;-webkit-backdrop-filter:blur(34px) saturate(1.65)!important;backdrop-filter:blur(34px) saturate(1.65)!important;box-shadow:0 -18px 60px rgba(31, 29, 27, .18),inset 0 1px 0 rgba(255,255,255,.96)!important}
.lrw-sheet::before{content:"";position:absolute;top:0;left:12%;width:76%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent)}
.lrw-sheet-head{border-color:rgba(112,101,127,.16)!important}
.lrw-eyebrow{color:rgba(77, 74, 70, .55)!important;letter-spacing:2.5px!important}
.lrw-sheet-head h2{font-size:27px!important;color:#302c36!important}
.lrw-sheet-head p{color:rgba(72,65,82,.52)!important;letter-spacing:1.4px!important}
.lrw-close{border:1px solid rgba(255,255,255,.9)!important;background:rgba(255,255,255,.56)!important;color:#4d4657!important;box-shadow:0 4px 14px rgba(43, 40, 38, .07)!important;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.lrw-tabs{gap:8px!important}
.lrw-tab{border:1px solid rgba(255,255,255,.9)!important;border-radius:999px!important;background:rgba(255,255,255,.42)!important;color:#625a6d!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)!important}
.lrw-tab.active{background:linear-gradient(145deg,rgba(56,51,64,.95),rgba(37, 34, 32, .96))!important;color:#fff!important;border-color:rgba(255,255,255,.55)!important}
.lrw-create-hero{border:1px solid rgba(255,255,255,.42)!important;border-radius:20px!important;background:linear-gradient(125deg,rgba(68, 65, 62, .90),rgba(109, 105, 100, .78))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 12px 28px rgba(60, 57, 54, .14)!important}
.lrw-create-hero strong{font-size:20px!important;letter-spacing:.3px}
.lrw-create-actions button{border:1px solid rgba(255,255,255,.88)!important;border-radius:15px!important;background:linear-gradient(145deg,rgba(255,255,255,.72),rgba(251, 245, 235, .44))!important;color:#393441!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 5px 16px rgba(51, 48, 45, .055)!important}
.lrw-create-actions small{color:rgba(75, 72, 68, .56)!important}
.lrw-cats button{border-color:rgba(255,255,255,.85)!important;background:rgba(255,255,255,.38)!important;color:#62596d!important}
.lrw-cats button.active{background:rgba(65, 62, 59, .9)!important;color:#fff!important;border-color:rgba(255,255,255,.6)!important}
.lrw-template-grid{gap:12px!important}
.lrw-template{border:1px solid rgba(255,255,255,.88)!important;border-radius:17px!important;background:linear-gradient(135deg,rgba(255,255,255,.55),rgba(240, 234, 225, .34))!important;color:#373431!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92),0 8px 22px rgba(51, 48, 45, .075)!important;overflow:hidden}
.lrw-template-preview{height:124px!important;border:1px solid rgba(255,255,255,.92)!important;border-radius:12px!important;background:linear-gradient(135deg,rgba(255,255,255,.42),rgba(220, 215, 206, .26))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92)!important}
.lrw-template-name{font-size:15px!important;color:#373431!important}
.lrw-template-desc{font-size:9px!important;color:rgba(74, 71, 68, .58)!important}
.lrw-addline{border-color:rgba(103, 100, 96, .12)!important;color:#6b6177!important}
.lrw-foot{color:rgba(72,65,82,.58)!important}
.lrw-preview-stage{border:1px solid rgba(255,255,255,.9)!important;border-radius:20px!important;background:linear-gradient(145deg,rgba(255,255,255,.52),rgba(224, 219, 210, .38))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)!important}
.lrw-live-preview{border:1px solid rgba(255,255,255,.9)!important;border-radius:20px!important;background:linear-gradient(135deg,rgba(255,255,255,.60),rgba(240, 234, 225, .42))!important;box-shadow:inset 0 1px 0 #fff,0 12px 30px rgba(45, 42, 40, .12)!important}
.lrw-live-preview{min-height:0!important;aspect-ratio:2/1!important;height:auto!important}.lrw-live-photo{aspect-ratio:1.85/1!important}.lrw-live-profile{aspect-ratio:2.15/1!important}.lrw-live-collage{aspect-ratio:1.9/1!important}.lrw-live-camera{aspect-ratio:1.9/1!important}.lrw-live-clock,.lrw-live-note,.lrw-live-contact,.lrw-live-receipt,.lrw-live-voice{aspect-ratio:1/1!important}.lrw-live-preview.ink{background:linear-gradient(145deg,rgba(49,45,57,.94),rgba(29, 27, 25, .88))!important;color:#fff!important}
.lrw-live-preview.grey{background:linear-gradient(145deg,rgba(244, 238, 229, .9),rgba(217, 212, 204, .72))!important}
.lrw-field input,.lrw-field select,.lrw-block-row textarea,.lrw-block-row input[type=text],.lrw-block-style select{border:1px solid rgba(255,255,255,.94)!important;border-radius:12px!important;background:rgba(255,255,255,.55)!important;color:#373431!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.92)!important}
.lrw-block-row{border:1px solid rgba(255,255,255,.9)!important;border-radius:14px!important;background:rgba(255,255,255,.46)!important}
.lrw-block-row button,.lrw-editor-tools button,.lrw-secondary{border:1px solid rgba(255,255,255,.92)!important;border-radius:999px!important;background:rgba(255,255,255,.55)!important;color:#4d4657!important}
.lrw-primary{border:1px solid rgba(255,255,255,.65)!important;border-radius:999px!important;background:linear-gradient(145deg,#484151,#2B2826)!important;color:#fff!important;box-shadow:0 9px 22px rgba(43, 40, 38, .18)!important}
.lrw-ratio-locked{padding:12px 14px;border:1px solid rgba(255,255,255,.82);border-radius:13px;background:rgba(255,255,255,.38)}
.lrw-ratio-locked span{font:11px/1.6 Georgia,"Noto Serif SC",serif;color:rgba(67, 64, 61, .7)}
.lrw-card.lrw-custom.medium{aspect-ratio:2/1!important}.lrw-card.lrw-custom.large{aspect-ratio:1.6/1!important}.lrw-card.lrw-custom.small{aspect-ratio:1/1!important}
@media(max-width:370px){#lrWidgetShelf{gap:10px!important}.lrw-card{border-radius:18px!important}.lrw-card .lrw-tools button{width:26px!important;height:26px!important}.lrw-sheet{padding-left:13px!important;padding-right:13px!important}}
`;document.head.appendChild(glassStyle);


const board=document.createElement('div');board.id='lrWidgetBoard';
const editbar=document.createElement('div');editbar.className='lrw-editbar';editbar.innerHTML='<button class="secondary" type="button" data-lrw-add>＋ 添加组件</button><button type="button" data-lrw-done>完成</button>';
const shelf=document.createElement('section');shelf.id='lrWidgetShelf';shelf.setAttribute('aria-label','桌面组件');
const grid=launcher.querySelector('.launcher-grid');
if(grid){launcher.insertBefore(board,grid);board.append(editbar,shelf)}
const overlay=document.createElement('div');overlay.id='lrwStudioOverlay';document.body.appendChild(overlay);

function templateById(id){return templates.find(t=>t.id===id)}
function defaultItem(id){const t=templateById(id);return {uid:uid(),type:id,name:t?.name||'自定义组件',size:t?.size||'medium',skin:t?.skin||'custom',title:t?.name||'A LITTLE MOMENT',subtitle:'LOVE RECORD · EVERYDAY',text:id==='note'?'把今天留在这里。':id==='quote'?'想和你走遍每一个角落':'',date:dateText(),image:'',city:'YOUR CITY',weatherNote:'TODAY · WEATHER NOTES',profileName:'YOUR NAME',profileBio:'MY LITTLE SPACE',blocks:[],pos:null}}
function defaultBlocks(){return [{id:uid(),kind:'eyebrow',text:'LOVE RECORD · EVERYDAY'},{id:uid(),kind:'heading',text:'A LITTLE MOMENT'},{id:uid(),kind:'body',text:'把今天留在这里。'},{id:uid(),kind:'date',text:dateText()}]}
function previewHTML(item){
 const image=item.image?`<img src="${esc(item.image)}" alt="">`:'';
 const base=`<div class="lrw-kicker">${esc(item.subtitle||'LOVE RECORD · EVERYDAY')}</div>`;
 if(item.skin==='receipt')return `<div class="lrw-kicker">STORE #042 · ${esc(dateText())}</div><div class="lrw-title" style="text-align:center;font-size:22px;letter-spacing:2px">${esc(item.title||'SOUL MART')}</div><div class="lrw-copy" style="font:10px/2 monospace;margin-top:8px">MORNING COFFEE　×1<br>AFTERNOON NAP　×1<br>SUNSET WATCHING　FREE</div><div style="border-top:1px dashed #888;margin-top:12px;padding-top:8px;font:10px monospace">TOTAL　PRICELESS</div>`;
 if(item.skin==='camera')return `${base}<div class="lrw-camera-frame">${image||'＋'}</div><div class="lrw-meta">PHOTO　　VIDEO　　CINEMATIC</div>`;
 if(item.skin==='webclip')return `<div class="lrw-meta">↶　↻　　LOVE RECORD</div><div class="lrw-title" style="font-size:20px;margin:13px 0">${esc(item.title||'Notes from a little world')}</div><div class="lrw-copy">${esc(item.text||'Some moments deserve a place to stay.')}</div><div class="lrw-meta" style="margin-top:15px">READ · SAVE · REMEMBER</div>`;
 if(item.skin==='weather')return `${base}<div class="lrw-title" style="font-size:32px;margin:15px 0">☼　24°</div><div class="lrw-copy">${esc(item.title||item.city||'YOUR CITY')}<br>${esc(item.text||item.weatherNote||'TODAY · WEATHER NOTES')}</div>`;
 if(item.skin==='profile')return `<div class="lrw-avatar">${image||esc((item.title||item.profileName||'LR').slice(0,2))}</div><div class="lrw-title">${esc(item.title||item.profileName||'YOUR NAME')}</div><div class="lrw-meta">${esc(item.text||item.profileBio||'MY LITTLE SPACE')}</div><div class="lrw-meta" style="margin-top:14px">FOLLOWING　 FOLLOWER　 LIKE</div>`;
 if(item.skin==='voice')return `<div class="lrw-meta">VOICE NOTE · 00:12</div><div style="font:14px Arial;margin:13px 0">▶　▂▅▃▆▇▃▅▂　0:12</div><div class="lrw-copy">${esc(item.text||'一段想留下的话')}</div>`;
 if(item.skin==='vinyl'){const snap=window.LRMusicSnapshot||{};return `<div class="lrw-record"><span>♫</span></div><div style="min-width:0"><div class="lrw-kicker">NOW PLAYING</div><div class="lrw-title">${esc(snap.title||'A LITTLE SONG')}</div><div class="lrw-meta">${esc(snap.artist||'LOVE RECORD · MUSIC')}</div><span data-lrw-play class="lrw-play-dot" style="display:inline-grid;place-items:center;margin-top:12px;border:1px solid #222;background:#222;color:white;border-radius:50%;width:30px;height:30px">▶</span></div>`}
 if(item.skin==='photo')return `${image?`<img src="${esc(item.image)}" alt="">`:'<div class="lrw-photo-placeholder">UPLOAD A PHOTO</div>'}<div class="lrw-meta" style="text-align:center;margin-top:8px">${esc(item.text||'A MOMENT TO KEEP')}</div>`;
 if(item.skin==='quote')return `<div class="lrw-meta">LOVE NOTE · ${esc(dateText())}</div><div class="lrw-title" style="font-size:22px;line-height:1.5;text-align:center;margin:auto 0">“${esc(item.text||'想和你走遍每一个角落')}”</div><div class="lrw-meta" style="text-align:center">— A LITTLE NOTE —</div>`;
 if(item.skin==='love')return `<div class="lrw-meta">LOVE RECORD　·　OUR STORY</div><div class="lrw-love-number">${item.daysTogether==null?'—':Number(item.daysTogether)}</div><div class="lrw-title">DAYS TOGETHER</div><div class="lrw-meta">EVERY DAY, A LITTLE MORE</div>`;
 if(item.skin==='calendar'){const now=new Date(),first=new Date(now.getFullYear(),now.getMonth(),1).getDay(),days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();let cells='';for(let i=0;i<first;i++)cells+='<span></span>';for(let d=1;d<=days;d++)cells+=`<span class="${d===now.getDate()?'today':''}">${d}</span>`;return `<div class="lrw-title">${now.toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()}</div><div class="lrw-calendar-grid">${['S','M','T','W','T','F','S'].map(x=>`<span>${x}</span>`).join('')}${cells}</div>`}
 if(item.skin==='clock')return `<div class="lrw-clock-time">${clockText()}</div><div class="lrw-meta" style="margin-top:10px">${esc(dateText())} · LOVE RECORD</div>`;
 if(item.skin==='note')return `<div class="lrw-meta">YOUR LITTLE NOTE</div><div class="lrw-title" style="font-size:20px;margin:18px 0">${esc(item.text||'把今天留在这里。')}</div><div class="lrw-meta">✳　LOVE RECORD</div>`;
 if(item.skin==='contact')return `<div class="lrw-meta">PERSONAL CARD</div><div class="lrw-title" style="font-size:26px">${esc(item.title||item.profileName||'YOUR NAME')}</div><div class="lrw-copy">${esc(item.text||item.profileBio||'HELLO@LOVE.RECORD')}</div>`;
 if(item.skin==='collage'){const imgs=(item.images||[]).slice(0,3);if(item.image&&!imgs.length)imgs.push(item.image);return `<div class="lrw-collage">${[0,1,2].map(i=>imgs[i]?`<img src="${imgs[i]}" alt="">`:'<div class="lrw-photo-placeholder">＋</div>').join('')}</div><div class="lrw-meta" style="margin-top:8px">COLLECT MOMENTS</div>`}
 if(item.skin==='custom'){return (item.image&&!((item.blocks||[]).some(b=>b.kind==='image'))?`<div class="lrw-preview-block"><img src="${esc(item.image)}" alt=""></div>`:'')+(item.blocks||[]).map(b=>{if(b.kind==='image')return b.image?`<div class="lrw-preview-block"><img src="${esc(b.image)}" alt=""></div>`:'';if(b.kind==='line')return '<hr style="border:0;border-top:1px solid #ccc;margin:10px 0">';if(b.kind==='date')return `<div class="lrw-preview-block date" style="font-size:${Math.max(8,Math.min(36,Number(b.fontSize)||12))}px;text-align:${['left','center','right'].includes(b.align)?b.align:'left'};color:${/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color:'#888888'}">${esc(b.text||dateText())}</div>`;if(b.kind==='sticker')return `<div class="lrw-preview-block sticker" style="font-size:${Math.max(8,Math.min(36,Number(b.fontSize)||22))}px;text-align:${['left','center','right'].includes(b.align)?b.align:'left'}">${esc(b.text||'✳')}</div>`;const fs=Math.max(8,Math.min(48,Number(b.fontSize)||(b.kind==='heading'?25:b.kind==='eyebrow'?8:13)));return `<div class="lrw-preview-block ${b.kind==='eyebrow'?'eyebrow':b.kind==='heading'?'heading':'body'}" style="font-size:${fs}px;text-align:${['left','center','right'].includes(b.align)?b.align:'left'};color:${/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color:''};font-family:${b.fontFamily==='sans'?'Arial,sans-serif':b.fontFamily==='mono'?'monospace':'Georgia,"Noto Serif SC",serif'}">${esc(b.text||'')}</div>`}).join('')}
 return `${base}<div class="lrw-title">${esc(item.title||'A LITTLE MOMENT')}</div><div class="lrw-copy">${esc(item.text||'')}</div>`;
}
function widgetHTML(item){const size=['small','medium','large'].includes(item.size)?item.size:'medium',skin=templates.some(t=>t.skin===item.skin)?item.skin:'custom',tone=['paper','ink','grey'].includes(item.tone)?item.tone:'paper';const cls=['lrw-card',size,`lrw-${skin}`,`lrw-tone-${tone}`].join(' ');return `<article class="${cls}" data-lrw-uid="${esc(item.uid)}"><div class="lrw-tools"><button type="button" data-lrw-edit aria-label="编辑">✎</button><button type="button" data-lrw-remove aria-label="移除">×</button></div>${previewHTML(item)}</article>`}
function span(item){const square=['clock','note'];if(square.includes(item.skin))return 1;return item.skin==='custom'&&item.size==='small'?1:2}
function arrange(preferredUid=null,preferred=null){const used=new Set();const list=preferredUid?[...state.items.filter(x=>x.uid===preferredUid),...state.items.filter(x=>x.uid!==preferredUid)]:state.items;for(const item of list){const cols=span(item),old=item.pos;let pos=item.uid===preferredUid&&preferred?{row:Math.max(1,preferred.row),col:cols===2?1:Math.max(1,Math.min(2,preferred.col))}:old;const valid=p=>p&&p.row>0&&p.row<80&&p.col>0&&p.col<=3-cols&&Array.from({length:cols},(_,i)=>`${p.row}:${p.col+i}`).every(k=>!used.has(k));if(!valid(pos)){pos=null;for(let r=1;r<80&&!pos;r++)for(let c=1;c<=3-cols;c++){let p={row:r,col:c};if(valid(p)){pos=p;break}}}if(!pos)pos={row:80+list.indexOf(item),col:1};item.pos=pos;for(let c=pos.col;c<pos.col+cols;c++)used.add(`${pos.row}:${c}`);const node=shelf.querySelector(`[data-lrw-uid="${item.uid}"]`);if(node){node.style.gridColumn=`${pos.col}/span ${cols}`;node.style.gridRow=`${pos.row}/span 1`;node.style.minHeight='0';node.style.gridRowEnd='span 1';}}
}
function renderDesktop(){shelf.innerHTML=state.items.map(widgetHTML).join('');arrange();shelf.hidden=!state.items.length&&!editMode;board.hidden=!state.items.length&&!editMode;}
function setEdit(on){editMode=!!on;launcher.classList.toggle('lrw-editing',editMode);editbar.style.display=editMode?'flex':'none';if(!editMode)drag=null;shelf.hidden=!state.items.length&&!editMode;board.hidden=!state.items.length&&!editMode}
function addTemplate(id){const item=defaultItem(id);if(id==='custom'){item.skin='custom';item.blocks=defaultBlocks()}state.items.push(item);arrange();renderDesktop();save(true);notify('已添加到桌面 ♡')}
function switchPage(next){const page=Math.max(0,Number(next)||0);if(page===state.activePage)return;state.pageItems[String(state.activePage)]=structuredClone(state.items);state.pagePositions[String(state.activePage)]=state.items.reduce((o,x)=>{o[x.uid]=x.pos;return o},{});state.activePage=page;state.items=(state.pageItems[String(page)]||[]).map(x=>({...x}));save(true);renderDesktop()}
window.addEventListener('lr-launcher-page-change',e=>switchPage(e.detail?.page));

function openLibrary(){sheetMode='library';activeCategory='全部';myTemplatesOnly=false;renderSheet();overlay.classList.add('show');setEdit(true)}
function closeSheet(){overlay.classList.remove('show');sheetMode='library';editingUid=null;editorDraft=null}
function renderSheet(){
 if(sheetMode==='editor'){renderEditor();return}
 const labels={'全部':'ALL','MEMORY':'MEMORY','MUSIC':'MUSIC','DAILY':'DAILY','EDITORIAL':'EDITORIAL','LOVE':'LOVE'};
 overlay.innerHTML=`<section class="lrw-sheet lrw-library-redesign" role="dialog" aria-modal="true"><header class="lrw-sheet-head"><div><div class="lrw-eyebrow">LOVE RECORD　/　OBJECTS FOR EVERYDAY</div><h2>桌面组件</h2><p>MONOCHROME · ULTRA LIQUID GLASS</p></div><button class="lrw-close" data-lrw-close aria-label="关闭">×</button></header><div class="lrw-library-intro"><span>THE LITTLE THINGS, BEAUTIFULLY KEPT.</span><p>为你的桌面，挑选一件喜欢的小物。</p></div><nav class="lrw-cats" aria-label="组件分类">${categories.map(c=>`<button class="${activeCategory===c?'active':''}" data-lrw-cat="${esc(c)}">${labels[c]||c}</button>`).join('')}</nav><div class="lrw-template-grid" id="lrwTemplateGrid"></div><p class="lrw-foot">选择喜欢的组件添加到桌面。长按组件可移动，点击编辑按钮可更换内容。</p></section>`;
 const list=overlay.querySelector('#lrwTemplateGrid');
 const data=templates.filter(t=>activeCategory==='全部'||t.cat===activeCategory);
 list.innerHTML=data.map(t=>{const preview=previewTemplate(t);return `<button class="lrw-template" data-lrw-add-template="${t.id}" aria-label="添加${esc(t.name)}"><div class="lrw-template-preview skin-${t.skin}">${preview}</div><div class="lrw-template-info"><div class="lrw-template-name">${esc(t.name)}</div><div class="lrw-template-desc">${esc(t.desc)}</div><div class="lrw-addline"><span>${esc(t.cat)}</span><b>＋ ADD</b></div></div></button>`}).join('');
}
function previewTemplate(t){const sample=defaultItem(t.id);sample.skin=t.skin;sample.title=t.title||t.name;sample.text=t.text||t.desc;sample.blocks=t.blocks||[];return `<div class="lrw-card ${t.skin==='collage'?'lrw-card-collage':`lrw-${esc(t.skin)}`} lrw-tone-paper ${esc(t.size||'medium')}">${previewHTML(sample)}</div>`}
function beginCreate(item=null){overlay.classList.add('show');editingUid=item?.uid||null;editorDraft=item?structuredClone(item):defaultItem('custom');if(!item){editorDraft.name='我的组件';editorDraft.skin='custom';editorDraft.size='medium';editorDraft.blocks=defaultBlocks()}sheetMode='editor';renderEditor()}
function renderEditor(){
 const d=editorDraft;const blocks=d.blocks||[];
 overlay.innerHTML=`<section class="lrw-sheet" role="dialog" aria-modal="true"><header class="lrw-sheet-head"><div><div class="lrw-eyebrow">WIDGET STUDIO · CREATOR</div><h2>${editingUid?'编辑组件':'自由创作'}</h2><p>BUILD YOUR OWN EDITORIAL OBJECT</p></div><button class="lrw-close" data-lrw-close>×</button></header><div class="lrw-editor-grid"><div class="lrw-field"><label>组件名称 · TITLE</label><input id="lrwName" value="${esc(d.name||'我的组件')}" maxlength="32"></div>${d.skin==='custom'?`<div class="lrw-field"><label>组件版式 · LAYOUT</label><select id="lrwSize"><option value="small" ${d.size==='small'?'selected':''}>方形 · 1:1</option><option value="medium" ${d.size==='medium'?'selected':''}>横向 · 2:1</option><option value="large" ${d.size==='large'?'selected':''}>宽幅 · 1.6:1</option></select></div>`:`<div class="lrw-field lrw-ratio-locked"><label>组件比例 · FIXED RATIO</label><span>已为「${esc(d.name||'当前组件')}」锁定专属构图，不会因误触而变形</span></div>`}<div class="lrw-field"><label>主标题 · HEADLINE</label><input id="lrwTitle" value="${esc(d.title||'')}" maxlength="60" placeholder="输入组件标题"></div><div class="lrw-field"><label>文字内容 · CAPTION</label><input id="lrwText" value="${esc(d.text||'')}" maxlength="180" placeholder="写下一段文字"></div><div class="lrw-field"><label>上传图片 · IMAGE</label><input id="lrwImage" type="file" accept="image/*"><small class="lrw-meta">${d.image?'已添加图片 · 可重新选择':'可选 · 图片会压缩后保存在本机'}</small></div><div class="lrw-field"><label>视觉底色 · PAPER</label><select id="lrwTone"><option value="paper" ${d.tone!=='ink'?'selected':''}>奶油白</option><option value="ink" ${d.tone==='ink'?'selected':''}>墨黑</option><option value="grey" ${d.tone==='grey'?'selected':''}>雾面灰</option></select></div><div class="lrw-preview-stage"><div class="lrw-live-preview lrw-live-${esc(d.skin||'custom')} ${d.tone==='ink'?'ink':''} ${d.tone==='grey'?'grey':''}" id="lrwLivePreview">${previewHTML(d)}</div></div><div class="lrw-eyebrow">CONTENT LAYERS · 内容图层</div><div class="lrw-block-list" id="lrwBlockList">${blocks.map((b,i)=>blockEditorRow(b,i)).join('')}</div><div class="lrw-editor-tools"><button data-lrw-add-block="eyebrow">＋ 小标题</button><button data-lrw-add-block="heading">＋ 大标题</button><button data-lrw-add-block="body">＋ 正文</button><button data-lrw-add-block="image">＋ 图片</button><button data-lrw-add-block="date">＋ 日期</button><button data-lrw-add-block="line">＋ 分隔线</button><button data-lrw-add-block="sticker">＋ 装饰</button></div><div class="lrw-field"><label>模板描述 · DESCRIPTION</label><input id="lrwDesc" value="${esc(d.desc||'自定义组件 · LOVE RECORD')}" maxlength="70"></div><button class="lrw-primary" data-lrw-save-widget>${editingUid?'保存修改':'添加到桌面'}</button><button class="lrw-secondary" style="width:100%;margin-top:8px" data-lrw-back>返回组件库</button></div></section>`;
}
function blockEditorRow(b,i){const image=b.kind==='image';return `<div class="lrw-block-row" data-lrw-block="${i}"><label>${String(b.kind||'TEXT').toUpperCase()} · 图层 ${i+1}</label>${image?`<input type="file" accept="image/*" data-lrw-block-image="${i}"><span class="lrw-meta">${b.image?'已添加图片':'选择图片'}</span>`:b.kind==='line'?'<span class="lrw-meta">细线分隔</span>':`<textarea rows="2" data-lrw-block-text="${i}" placeholder="输入内容">${esc(b.text||'')}</textarea>`}<div class="lrw-block-style"><select data-lrw-block-size="${i}" aria-label="字号"><option value="12" ${Number(b.fontSize||16)===12?'selected':''}>小字</option><option value="16" ${Number(b.fontSize||16)===16?'selected':''}>常规</option><option value="22" ${Number(b.fontSize||16)===22?'selected':''}>大字</option><option value="30" ${Number(b.fontSize||16)===30?'selected':''}>特大</option></select><select data-lrw-block-align="${i}" aria-label="对齐"><option value="left" ${(!b.align||b.align==='left')?'selected':''}>左对齐</option><option value="center" ${b.align==='center'?'selected':''}>居中</option><option value="right" ${b.align==='right'?'selected':''}>右对齐</option></select><select data-lrw-block-font="${i}" aria-label="字体"><option value="serif" ${(!b.fontFamily||b.fontFamily==='serif')?'selected':''}>衬线</option><option value="sans" ${b.fontFamily==='sans'?'selected':''}>无衬线</option><option value="mono" ${b.fontFamily==='mono'?'selected':''}>等宽</option></select><input type="color" value="${/^#[0-9a-f]{6}$/i.test(b.color||'')?b.color:'#292927'}" data-lrw-block-color="${i}" aria-label="文字颜色"></div><div><button data-lrw-block-up="${i}">↑</button> <button data-lrw-block-down="${i}">↓</button> <button data-lrw-block-delete="${i}">×</button></div></div>`}
function updatePreview(){const n=$('lrwLivePreview');if(n){n.innerHTML=previewHTML(editorDraft);n.classList.toggle('ink',editorDraft.tone==='ink');n.classList.toggle('grey',editorDraft.tone==='grey')}}
function compressImage(file,max=1100){return new Promise((resolve,reject)=>{if(!file||!file.type.startsWith('image/'))return reject(new Error('请选择图片'));const reader=new FileReader();reader.onerror=()=>reject(reader.error);reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('图片读取失败'));img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.round(img.width*scale),h=Math.round(img.height*scale),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.82))};img.src=reader.result};reader.readAsDataURL(file)})}
function downloadJSON(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function saveCustomWidget(){editorDraft.name=$('lrwName')?.value.trim()||'我的组件';editorDraft.size=$('lrwSize')?.value||'medium';editorDraft.tone=$('lrwTone')?.value||'paper';editorDraft.desc=$('lrwDesc')?.value||'自定义组件';if(editingUid){const i=state.items.findIndex(x=>x.uid===editingUid);if(i>=0)state.items[i]=structuredClone(editorDraft)}else{editorDraft.uid=uid();state.items.push(structuredClone(editorDraft))}renderDesktop();save(true);closeSheet();notify(editingUid?'组件修改已保存 ♡':'新组件已添加到桌面 ♡')}
function saveAsTemplate(){editorDraft.name=$('lrwName')?.value.trim()||'我的组件';editorDraft.size=$('lrwSize')?.value||'medium';editorDraft.tone=$('lrwTone')?.value||'paper';editorDraft.desc=$('lrwDesc')?.value||'我的自定义组件';const copy=structuredClone(editorDraft);copy.templateId=uid();state.customTemplates.unshift(copy);save(true);notify('已保存到我的模板 ♡')}
function updateDraftFromFields(){if($('lrwName'))editorDraft.name=$('lrwName').value;if($('lrwSize'))editorDraft.size=$('lrwSize').value;if($('lrwTone'))editorDraft.tone=$('lrwTone').value;if($('lrwDesc'))editorDraft.desc=$('lrwDesc').value;if($('lrwTitle'))editorDraft.title=$('lrwTitle').value;if($('lrwText'))editorDraft.text=$('lrwText').value}
overlay.addEventListener('input',e=>{if(sheetMode!=='editor')return;updateDraftFromFields();const ti=e.target.dataset.lrwBlockText;if(ti!==undefined){const b=editorDraft.blocks[Number(ti)];b.text=e.target.value;if(b.kind==='heading'&&editorDraft.skin==='custom'&&editorDraft.blocks.find(x=>x.kind==='heading')===b&&$('lrwTitle'))$('lrwTitle').value=e.target.value;if(b.kind==='body'&&editorDraft.skin==='custom'&&editorDraft.blocks.find(x=>x.kind==='body')===b&&$('lrwText'))$('lrwText').value=e.target.value;updatePreview();return}if(editorDraft.skin==='custom'&&e.target.id==='lrwTitle'){const b=editorDraft.blocks.find(x=>x.kind==='heading');if(b)b.text=e.target.value}if(editorDraft.skin==='custom'&&e.target.id==='lrwText'){const b=editorDraft.blocks.find(x=>x.kind==='body');if(b)b.text=e.target.value}if(['lrwName','lrwTitle','lrwText','lrwDesc'].includes(e.target.id))updatePreview()});
overlay.addEventListener('change',async e=>{if(sheetMode!=='editor')return;updateDraftFromFields();const file=e.target.files?.[0];if(file&&e.target.dataset.lrwBlockImage!==undefined){try{editorDraft.blocks[Number(e.target.dataset.lrwBlockImage)].image=await compressImage(file);renderEditor()}catch(err){notify(err.message)}}else if(file&&e.target.id==='lrwImage'){try{editorDraft.image=await compressImage(file);updatePreview();notify('图片已添加 ♡')}catch(err){notify(err.message)}}else{for(const attr of ['lrwBlockSize','lrwBlockAlign','lrwBlockFont','lrwBlockColor'])if(e.target.dataset[attr]!==undefined){const b=editorDraft.blocks[Number(e.target.dataset[attr])];if(attr==='lrwBlockSize')b.fontSize=Number(e.target.value);if(attr==='lrwBlockAlign')b.align=e.target.value;if(attr==='lrwBlockFont')b.fontFamily=e.target.value;if(attr==='lrwBlockColor')b.color=e.target.value;updatePreview();return}if(e.target.id==='lrwSize'||e.target.id==='lrwTone')updatePreview()}});
overlay.addEventListener('click',async e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.hasAttribute('data-lrw-close')){closeSheet();return}
 if(target.hasAttribute('data-lrw-create-tab')){beginCreate();return}if(target.dataset.lrwLibraryTab){myTemplatesOnly=target.dataset.lrwLibraryTab==='mine';activeCategory='全部';renderSheet();return}
 if(target.dataset.lrwCat!==undefined){activeCategory=target.dataset.lrwCat;renderSheet();return}
 if(target.hasAttribute('data-lrw-create')){beginCreate();return}
 if(target.hasAttribute('data-lrw-my-create')){myTemplatesOnly=true;activeCategory='全部';renderSheet();return}
 if(target.hasAttribute('data-lrw-import')){$('lrwImportFile')?.click();return}
 if(target.hasAttribute('data-lrw-export-all')){downloadJSON({format:'LOVE_RECORD_WIDGET_TEMPLATES',version:1,templates:state.customTemplates},'love-record-widget-templates.json');return}
 if(target.hasAttribute('data-lrw-back')){sheetMode='library';renderSheet();return}
 if(target.dataset.lrwAddTemplate!==undefined){if(target.dataset.lrwCustomTemplate==='1'){const t=state.customTemplates[Number(target.dataset.lrwAddTemplate)];if(t){const item=structuredClone(t);item.uid=uid();delete item.templateId;state.items.push(item);renderDesktop();save(true);notify('已添加我的模板 ♡')}}else addTemplate(target.dataset.lrwAddTemplate);return}
 if(target.dataset.lrwAddBlock){editorDraft.blocks=editorDraft.blocks||[];editorDraft.blocks.push({id:uid(),kind:target.dataset.lrwAddBlock,text:target.dataset.lrwAddBlock==='date'?dateText():target.dataset.lrwAddBlock==='sticker'?'✳':''});renderEditor();return}
 if(target.dataset.lrwBlockDelete!==undefined){editorDraft.blocks.splice(Number(target.dataset.lrwBlockDelete),1);renderEditor();return}
 if(target.dataset.lrwBlockUp!==undefined){const i=Number(target.dataset.lrwBlockUp);if(i>0)[editorDraft.blocks[i-1],editorDraft.blocks[i]]=[editorDraft.blocks[i],editorDraft.blocks[i-1]];renderEditor();return}
 if(target.dataset.lrwBlockDown!==undefined){const i=Number(target.dataset.lrwBlockDown);if(i<editorDraft.blocks.length-1)[editorDraft.blocks[i+1],editorDraft.blocks[i]]=[editorDraft.blocks[i],editorDraft.blocks[i+1]];renderEditor();return}
 if(target.hasAttribute('data-lrw-save-widget')){updateDraftFromFields();saveCustomWidget();return}
 if(target.hasAttribute('data-lrw-save-template')){updateDraftFromFields();saveAsTemplate();return}
 if(target.hasAttribute('data-lrw-export-one')){updateDraftFromFields();downloadJSON({format:'LOVE_RECORD_WIDGET_TEMPLATE',version:1,template:editorDraft},'love-record-widget.json');return}
 if(target.hasAttribute('data-lrw-play')){const audio=$('lrGlobalAudio');if(audio){if(audio.paused)audio.play().catch(()=>notify('请先选择一首歌曲'));else audio.pause()}return}
});
overlay.addEventListener('change',async e=>{if(e.target.id==='lrwImportFile'){const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());const list=data.templates||[data.template||data];for(const t of list){if(t&&t.name&&t.skin)state.customTemplates.push({...t,templateId:uid(),uid:undefined})}await save(true);myTemplatesOnly=true;renderSheet();notify('模板导入成功 ♡')}catch(err){notify('模板文件无法读取')}e.target.value=''}});

function openEdit(item){beginCreate(item)}
function addToolActions(){editbar.addEventListener('click',e=>{if(e.target.closest('[data-lrw-add]'))openLibrary();if(e.target.closest('[data-lrw-done]')){setEdit(false);save(true);notify('桌面已保存 ♡')}})}
addToolActions();
shelf.addEventListener('click',e=>{const card=e.target.closest('[data-lrw-uid]');if(!card)return;const item=state.items.find(x=>x.uid===card.dataset.lrwUid);if(!item)return;if(e.target.closest('[data-lrw-edit]')){openEdit(item);return}if(e.target.closest('[data-lrw-remove]')){state.items=state.items.filter(x=>x.uid!==item.uid);renderDesktop();save(true);return}if(e.target.closest('[data-lrw-play]')){const a=$('lrGlobalAudio');if(a){if(a.paused)a.play().catch(()=>notify('请先选择一首歌曲'));else a.pause()}}});
function nearestPage(x,y){let best=null,dist=Infinity;document.querySelectorAll('#launcherPages [data-launcher-page]').forEach(n=>{const r=n.getBoundingClientRect(),d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<dist&&d<90){dist=d;best=Number(n.dataset.launcherPage)}});return best}
function startWidgetDrag(card,e){const item=state.items.find(x=>x.uid===card.dataset.lrwUid);if(!item)return;drag={card,item,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,transform:card.style.transform};card.classList.add('lrw-dragging');card.style.pointerEvents='none';card.style.willChange='transform';try{card.setPointerCapture(e.pointerId)}catch{}e.preventDefault()}
launcher.addEventListener('pointerdown',e=>{
 if(e.target.closest('.launcher-app,.nav,.nav-btn,button,a,input,textarea,select,#lrwStudioOverlay'))return;
 const card=e.target.closest('[data-lrw-uid]');
 if(card){longPress={card,pointerId:e.pointerId,x:e.clientX,y:e.clientY};clearTimeout(longTimer);longTimer=setTimeout(()=>{if(!longPress)return;setEdit(true);startWidgetDrag(card,{pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,cancelable:false,preventDefault(){}});longPress=null},360);return}
 if(!e.target.closest('#lrWidgetShelf')){blankStart={pointerId:e.pointerId,x:e.clientX,y:e.clientY};clearTimeout(blankTimer);blankTimer=setTimeout(()=>{if(blankStart){blankStart=null;openLibrary()}},520)}
},{capture:true});
document.addEventListener('pointermove',e=>{
 if(longPress&&e.pointerId===longPress.pointerId&&Math.hypot(e.clientX-longPress.x,e.clientY-longPress.y)>12){clearTimeout(longTimer);longPress=null}
 if(blankStart&&e.pointerId===blankStart.pointerId&&Math.hypot(e.clientX-blankStart.x,e.clientY-blankStart.y)>14){clearTimeout(blankTimer);blankStart=null}
 if(drag){drag.x=e.clientX;drag.y=e.clientY;drag.card.style.transform=`translate3d(${e.clientX-drag.startX}px,${e.clientY-drag.startY}px,0) scale(1.025)`;drag.card.style.zIndex='1000'}
},{passive:true});
document.addEventListener('pointerup',e=>{
 clearTimeout(longTimer);clearTimeout(blankTimer);longPress=null;blankStart=null;
 if(!drag||e.pointerId!==drag.pointerId)return;
 const d=drag,item=d.item;d.card.classList.remove('lrw-dragging');d.card.style.transform='';d.card.style.zIndex='';d.card.style.willChange='';d.card.style.pointerEvents='';
 const target=nearestPage(e.clientX,e.clientY);
 if(target!==null&&target!==state.activePage){state.pageItems[String(state.activePage)]=state.items.filter(x=>x.uid!==item.uid).map(x=>({...x}));const next=(state.pageItems[String(target)]||[]).map(x=>({...x}));next.push({...item,pos:null});state.pageItems[String(target)]=next;state.items=state.items.filter(x=>x.uid!==item.uid);save(true);if(typeof window.__loveRecordLauncherSetPage==='function')window.__loveRecordLauncherSetPage(target);else switchPage(target)}
 else{const r=shelf.getBoundingClientRect(),row=Math.max(1,Math.floor(Math.max(0,e.clientY-r.top)/220)+1),col=span(item)===2?1:(e.clientX<r.left+r.width/2?1:2);arrange(item.uid,{row,col});renderDesktop();save(true)}
 window.__lrWidgetJustDragged=Date.now();drag=null;
});
document.addEventListener('pointercancel',()=>{clearTimeout(longTimer);clearTimeout(blankTimer);longPress=null;blankStart=null;if(drag){drag.card.classList.remove('lrw-dragging');drag.card.style.transform='';drag.card.style.zIndex='';drag.card.style.willChange='';drag.card.style.pointerEvents='';drag=null}});
window.addEventListener('lr-music-state-change',()=>{const n=shelf.querySelector('[data-lrw-uid]');if(n){const item=state.items.find(x=>x.skin==='vinyl');if(item)renderDesktop()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.items.some(x=>x.skin==='clock'))renderDesktop()});setInterval(()=>{if(!document.hidden&&state.items.some(x=>x.skin==='clock')&&!overlay.classList.contains('show'))renderDesktop()},30000);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('show'))closeSheet();else if(e.key==='Escape'&&editMode)setEdit(false)});
window.addEventListener('storage',()=>{});

/* V12 · INS monochrome ultra liquid-glass widget library */
const v12Style=document.createElement('style');v12Style.id='lr-widget-ins-v12';v12Style.textContent=`
#lrwStudioOverlay{background:rgba(12,13,15,.48)!important;backdrop-filter:blur(28px) saturate(1.35)!important;-webkit-backdrop-filter:blur(28px) saturate(1.35)!important}
.lrw-sheet.lrw-library-redesign{position:relative;width:min(100%,640px)!important;max-height:92dvh!important;overflow-y:auto!important;padding:25px 19px calc(24px + env(safe-area-inset-bottom))!important;border:1px solid rgba(255,255,255,.88)!important;border-bottom:0!important;border-radius:30px 30px 0 0!important;color:#171819!important;background:linear-gradient(145deg,rgba(250,250,250,.79),rgba(215,217,220,.58) 48%,rgba(246,247,248,.70))!important;backdrop-filter:blur(42px) saturate(1.8)!important;-webkit-backdrop-filter:blur(42px) saturate(1.8)!important;box-shadow:0 -20px 70px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(255,255,255,.5)!important}
.lrw-sheet.lrw-library-redesign:before{content:"";position:absolute;inset:0 0 auto;height:42%;pointer-events:none;border-radius:inherit;background:linear-gradient(155deg,rgba(255,255,255,.64),transparent 62%)}
.lrw-library-redesign>*{position:relative;z-index:1}
.lrw-library-redesign .lrw-sheet-head{align-items:center;padding-bottom:18px;border-bottom:1px solid rgba(20,22,25,.13)!important}
.lrw-library-redesign .lrw-eyebrow{font:8px/1.5 Arial,sans-serif!important;letter-spacing:3px!important;color:rgba(25,27,30,.55)!important}
.lrw-library-redesign .lrw-sheet-head h2{font:400 34px/1.2 Georgia,"Noto Serif SC",serif!important;letter-spacing:3px!important;color:#151617!important}
.lrw-library-redesign .lrw-sheet-head p{font:8px Arial,sans-serif!important;letter-spacing:2.1px!important;color:rgba(25,27,30,.56)!important}
.lrw-library-redesign .lrw-close{width:40px;height:40px;border:1px solid rgba(255,255,255,.95)!important;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(225,227,229,.44))!important;color:#171819!important;box-shadow:inset 0 1px 0 #fff,0 5px 16px rgba(0,0,0,.08)!important;backdrop-filter:blur(20px)}
.lrw-library-intro{padding:20px 2px 16px}.lrw-library-intro span{font:8px Arial,sans-serif;letter-spacing:2.6px;color:rgba(25,27,30,.55)}.lrw-library-intro p{margin:8px 0 0;font:15px/1.6 Georgia,"Noto Serif SC",serif;color:#242628}
.lrw-library-redesign .lrw-cats{gap:7px;padding:2px 0 16px!important}
.lrw-library-redesign .lrw-cats button{padding:8px 13px!important;border:1px solid rgba(255,255,255,.9)!important;border-radius:999px!important;background:rgba(255,255,255,.28)!important;color:rgba(20,22,24,.7)!important;font:8px Arial,sans-serif!important;letter-spacing:1.5px!important;backdrop-filter:blur(18px)}
.lrw-library-redesign .lrw-cats button.active{background:linear-gradient(145deg,#252729,#090a0b)!important;border-color:rgba(255,255,255,.68)!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 5px 13px rgba(0,0,0,.14)!important}
.lrw-library-redesign .lrw-template-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:13px!important}
.lrw-library-redesign .lrw-template{display:flex;flex-direction:column;gap:0;padding:8px!important;border:1px solid rgba(255,255,255,.96)!important;border-radius:21px!important;text-align:left!important;background:linear-gradient(145deg,rgba(255,255,255,.58),rgba(222,224,227,.28))!important;color:#171819!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(255,255,255,.42),0 9px 26px rgba(18,20,23,.09)!important;backdrop-filter:blur(26px) saturate(1.7)!important;-webkit-backdrop-filter:blur(26px) saturate(1.7)!important;overflow:hidden}
.lrw-library-redesign .lrw-template:active{transform:scale(.985)}
.lrw-library-redesign .lrw-template-preview{height:auto!important;aspect-ratio:1/1!important;width:100%!important;margin:0 0 11px!important;padding:11px!important;display:flex!important;align-items:stretch!important;justify-content:stretch!important;border:1px solid rgba(255,255,255,.94)!important;border-radius:15px!important;overflow:hidden!important;background:linear-gradient(145deg,rgba(255,255,255,.66),rgba(195,198,202,.30))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -10px 24px rgba(255,255,255,.12)!important}
.lrw-library-redesign .lrw-template-preview>div{width:100%!important;height:100%!important;min-height:0!important;box-sizing:border-box!important;border-radius:10px!important;overflow:hidden!important}
.lrw-library-redesign .lrw-template-info{padding:0 5px 4px}.lrw-library-redesign .lrw-template-name{font:15px/1.3 Georgia,"Noto Serif SC",serif!important;letter-spacing:.5px;color:#171819!important}.lrw-library-redesign .lrw-template-desc{font:10px/1.5 Arial,"Noto Sans SC",sans-serif!important;color:rgba(25,27,30,.57)!important;margin-top:5px!important;min-height:30px}
.lrw-library-redesign .lrw-addline{margin-top:8px!important;padding-top:8px!important;border-top:1px solid rgba(25,27,30,.12)!important;color:rgba(25,27,30,.54)!important;font:8px Arial,sans-serif!important;letter-spacing:1.6px!important}.lrw-library-redesign .lrw-addline b{color:#151617!important;font-weight:500!important}
.lrw-library-redesign .lrw-foot{margin-top:15px!important;color:rgba(25,27,30,.55)!important;font:9px/1.7 Arial,"Noto Sans SC",sans-serif!important}
/* Square image preview areas: no stretching, no distorted aspect ratios. */
.lrw-library-redesign .lrw-template-preview .lrw-photo{height:100%!important;aspect-ratio:1/1!important;display:flex!important;flex-direction:column!important;justify-content:stretch!important;gap:7px!important;padding:7px!important;background:linear-gradient(145deg,rgba(255,255,255,.68),rgba(215,217,220,.34))!important}
.lrw-library-redesign .lrw-template-preview .lrw-photo img,.lrw-library-redesign .lrw-template-preview .lrw-photo .lrw-photo-placeholder{width:100%!important;height:auto!important;min-height:0!important;aspect-ratio:1/1!important;flex:1 1 auto!important;object-fit:cover!important;border-radius:8px!important}
.lrw-library-redesign .lrw-template-preview .lrw-card-collage{height:100%!important;aspect-ratio:1/1!important;display:flex!important;padding:7px!important;background:linear-gradient(145deg,rgba(255,255,255,.48),rgba(205,208,211,.25))!important}.lrw-library-redesign .lrw-template-preview .lrw-collage{height:100%!important;aspect-ratio:1/1!important;display:grid!important;grid-template-columns:1fr 1fr!important;grid-template-rows:1fr 1fr!important;gap:5px!important;padding:7px!important;background:rgba(255,255,255,.22)!important}
.lrw-library-redesign .lrw-template-preview .lrw-collage img,.lrw-library-redesign .lrw-template-preview .lrw-collage .lrw-photo-placeholder{width:100%!important;height:100%!important;min-height:0!important;object-fit:cover!important;border-radius:6px!important}
.lrw-library-redesign .lrw-template-preview .lrw-vinyl{height:100%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important;background:transparent!important}
.lrw-library-redesign .lrw-template-preview .lrw-record{width:76px!important;height:76px!important;background:repeating-radial-gradient(circle,#161718 0 2px,#45484a 3px 4px)!important;box-shadow:0 8px 20px rgba(0,0,0,.2),inset 0 0 0 1px rgba(255,255,255,.4)!important}
.lrw-library-redesign .lrw-template-preview .lrw-record span{background:linear-gradient(145deg,#fdfdfd,#aeb1b4)!important;color:#171819!important}
.lrw-library-redesign .lrw-template-preview .lrw-clock{height:100%!important;background:transparent!important}.lrw-library-redesign .lrw-template-preview .lrw-clock-time{font:clamp(29px,8vw,42px)/1 Arial,sans-serif!important;letter-spacing:-2px!important;color:#171819!important}
.lrw-library-redesign .lrw-template-preview .lrw-calendar{height:100%!important;justify-content:center!important;gap:8px!important;padding:8px!important;background:transparent!important}.lrw-library-redesign .lrw-template-preview .lrw-calendar-grid{gap:2px!important;font-size:7px!important}.lrw-library-redesign .lrw-template-preview .lrw-calendar-grid span{padding:2px 0!important}
.lrw-library-redesign .lrw-template-preview .lrw-quote{height:100%!important;padding:10px!important;justify-content:space-between!important;background:transparent!important}.lrw-library-redesign .lrw-template-preview .lrw-quote .lrw-title{font-size:16px!important;line-height:1.55!important;text-align:center!important}
.lrw-library-redesign .lrw-template-preview .lrw-note{height:100%!important;justify-content:space-between!important;padding:13px!important;background:transparent!important;border:0!important}.lrw-library-redesign .lrw-template-preview .lrw-note .lrw-title{font-size:17px!important;line-height:1.6!important}
.lrw-library-redesign .lrw-template-preview .lrw-love{height:100%!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:flex-start!important;padding:13px!important;background:linear-gradient(145deg,rgba(255,255,255,.4),rgba(175,178,182,.25))!important}.lrw-library-redesign .lrw-love-number{font:500 42px/.95 Georgia,serif!important;letter-spacing:-2px!important;color:#171819!important;margin:9px 0 4px}
/* Desktop cards use the same monochrome liquid-glass language. */
.lrw-card{border:1px solid rgba(255,255,255,.92)!important;border-radius:24px!important;background:linear-gradient(145deg,rgba(255,255,255,.64),rgba(210,213,216,.34) 52%,rgba(248,249,250,.52))!important;color:#171819!important;backdrop-filter:blur(34px) saturate(1.65)!important;-webkit-backdrop-filter:blur(34px) saturate(1.65)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.98),inset 0 -1px 0 rgba(255,255,255,.42),0 12px 32px rgba(15,17,19,.10)!important}
.lrw-card:before{background:linear-gradient(130deg,rgba(255,255,255,.82),rgba(255,255,255,.08) 45%,transparent 68%)!important}
.lrw-card.lrw-photo,.lrw-card.lrw-collage{aspect-ratio:1/1!important;grid-column:span 2!important;padding:12px!important}
.lrw-card.lrw-photo img,.lrw-card.lrw-photo .lrw-photo-placeholder{width:100%!important;height:auto!important;aspect-ratio:1/1!important;object-fit:cover!important;flex:1 1 auto!important;border-radius:13px!important}
.lrw-card.lrw-collage .lrw-collage{width:100%;height:100%;aspect-ratio:1/1;min-height:0}
.lrw-card.lrw-love{aspect-ratio:2/1!important;grid-column:span 2!important;display:flex;flex-direction:column;justify-content:center}
.lrw-card.lrw-love .lrw-love-number{font:500 clamp(40px,12vw,60px)/.95 Georgia,serif;letter-spacing:-3px;margin:8px 0 4px}
.lrw-card.lrw-tone-ink{background:linear-gradient(145deg,rgba(37,39,41,.88),rgba(8,9,10,.76))!important;color:#fff!important}
@media(max-width:370px){.lrw-library-redesign .lrw-template-grid{gap:9px!important}.lrw-library-redesign .lrw-template{padding:6px!important}.lrw-library-redesign .lrw-template-preview{padding:8px!important}}
`;document.head.appendChild(v12Style);

load().catch(e=>{console.error('[WIDGET STUDIO] init failed',e);renderDesktop()});
})();
