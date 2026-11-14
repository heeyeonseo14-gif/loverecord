/* LOVE RECORD · Home widgets v1
   In-app launcher widgets. Layout is persisted and shared across launcher sessions/tabs. */
(()=>{'use strict';
const KEY='love-record-home-widgets-v1';
const launcher=document.getElementById('launcher');
if(!launcher||document.getElementById('lrWidgetShelf'))return;
const definitions=[
 {id:'clock',name:'时光时钟',category:'DAILY',size:'small',desc:'极简时间与日期 · 黑白杂志排版',preview:'09:41'},
 {id:'photo',name:'照片日记',category:'MEMORY',size:'medium',desc:'一张照片，收藏今天的瞬间',preview:'A MOMENT'},
 {id:'music',name:'正在播放',category:'MUSIC',size:'medium',desc:'唱片封面、歌曲与播放控制',preview:'NOW PLAYING'},
 {id:'quote',name:'每日短句',category:'EDITORIAL',size:'small',desc:'留给今天的一句话',preview:'A LITTLE NOTE'},
 {id:'calendar',name:'日期日历',category:'DAILY',size:'small',desc:'日期、星期与月份',preview:'14'},
 {id:'note',name:'随手便笺',category:'NOTES',size:'medium',desc:'极简便笺 · 自动保存在本机',preview:'WRITE IT DOWN'}
];
let config={items:[],order:['welcome','days','shelf'],hidden:[],positions:{},pageItems:{},pagePositions:{},pageFixed:{}},activePage=Math.max(0,Number(window.__loveRecordLauncherCurrentPage)||0),pressTimer=null,pressStart=null,pendingWidgetPress=null,opening=false,editMode=false,dragState=null,needsUpgrade=false;
const WIDGET_DB='love-record-home-widgets-db',WIDGET_STORE='layout',WIDGET_LAYOUT_KEY='desktop-layout-v1';
function widgetDbOpen(){return new Promise((resolve,reject)=>{try{const req=indexedDB.open(WIDGET_DB);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(WIDGET_STORE))req.result.createObjectStore(WIDGET_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('Widget database open failed'));req.onblocked=()=>reject(new Error('Widget database is blocked'))}catch(err){reject(err)}})}
async function widgetDbGet(){const db=await widgetDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(WIDGET_STORE,'readonly'),req=tx.objectStore(WIDGET_STORE).get(WIDGET_LAYOUT_KEY);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('Widget layout read failed'));tx.oncomplete=()=>db.close();tx.onabort=()=>{db.close();reject(tx.error||new Error('Widget layout read aborted'))}})}
async function widgetDbSet(value){const db=await widgetDbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(WIDGET_STORE,'readwrite');tx.objectStore(WIDGET_STORE).put(value,WIDGET_LAYOUT_KEY);tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>reject(tx.error||new Error('Widget layout write failed'));tx.onabort=()=>reject(tx.error||new Error('Widget layout write aborted'))})}

const style=document.createElement('style');style.id='lr-home-widgets-style';style.textContent=`
#launcher .launcher-welcome,#launcher .launcher-info{display:none!important}
#lrWidgetBoard{display:block;position:relative;margin:0 0 20px}
#lrWidgetShelf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:132px;grid-auto-flow:row;align-items:stretch;gap:10px;margin:0 0 12px;padding:0 2px;width:100%;min-width:0}
.lr-widget{grid-column:span 1;width:100%;position:relative;min-width:0;min-height:104px;padding:13px 14px;touch-action:none;border:1px solid rgba(35,35,35,.10);border-radius:5px;background:rgba(255,255,255,.88);box-shadow:0 8px 24px rgba(0,0,0,.045);color:#252525;overflow:hidden;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.lr-widget.medium{grid-column:1/-1;min-height:132px}
.lr-widget.large{grid-column:1/-1;min-height:248px}
.lr-widget.small{grid-column:span 1;min-height:104px}
.lr-widget-kicker{font-family:Arial,sans-serif;font-size:8px;letter-spacing:2.4px;color:#858585;margin-bottom:9px}
.lr-widget-title{font-family:Georgia,"Noto Serif SC",serif;font-size:13px;font-weight:500;letter-spacing:.4px;color:#252525;margin-bottom:7px}
.lr-widget-main{font-family:Georgia,"Times New Roman","Noto Serif SC",serif;font-size:27px;line-height:1.12;font-weight:400;color:#202020;overflow-wrap:anywhere}
.lr-widget-sub{font-family:Arial,"Noto Sans SC",sans-serif;font-size:10px;line-height:1.55;color:#858585;margin-top:7px;overflow-wrap:anywhere}
.lr-widget-tools{position:absolute;right:8px;top:8px;display:none;gap:5px;z-index:5}
#launcher.lr-widgets-editing .lr-widget-tools{display:flex}
.lr-widget-tools button{width:25px;height:25px;border:1px solid rgba(30,30,30,.12);border-radius:50%;background:rgba(255,255,255,.96);color:#252525;font-size:13px}
.lr-widget-photo{width:100%;height:76px;object-fit:cover;border-radius:2px;display:block}
.lr-widget-memory-widget{min-height:248px;grid-row:span 2}
.lr-widget-memory-view{display:flex;flex-direction:column;align-items:stretch;gap:7px;width:100%;min-width:0}
.lr-widget-memory-image{display:block;width:100%;height:148px;padding:0;border:0;border-radius:2px;overflow:hidden;background:#eee;cursor:pointer}
.lr-widget-photo-square{display:block;width:100%;height:100%;object-fit:cover}
.lr-widget-memory-meta{display:flex;justify-content:space-between;gap:8px;width:100%;font-family:Arial,sans-serif;font-size:8px;letter-spacing:1.4px;color:#888;white-space:nowrap;overflow:hidden}
.lr-widget-memory-meta span:first-child{overflow:hidden;text-overflow:ellipsis}
.lr-widget-memory-empty{width:100%;padding:22px 8px;text-align:center;font-family:Georgia,serif;font-size:11px;letter-spacing:1px;color:#888}
.lr-widget-music-row{display:flex;align-items:center;gap:12px;min-width:0;margin-top:10px}
.lr-widget-music-cover{width:58px;height:58px;flex:0 0 58px;object-fit:cover;border-radius:2px;background:#eee}
.lr-widget-music-meta{min-width:0;flex:1}
.lr-widget-music-meta strong{display:block;font-family:Georgia,"Noto Serif SC",serif;font-size:15px;font-weight:500;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lr-widget-music-meta small{display:block;font-family:Arial,sans-serif;font-size:9px;letter-spacing:1px;color:#888;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lr-widget-play{width:32px;height:32px;border:1px solid #222;border-radius:50%;background:#222;color:white;font-size:13px}
.lr-widget-note{width:100%;min-height:70px;border:0;border-bottom:1px solid rgba(0,0,0,.15);outline:0;resize:vertical;background:transparent;color:#222;font-family:Georgia,"Noto Serif SC",serif;font-size:13px;padding:5px 0}
.lr-widget-audio{display:flex;align-items:center;gap:7px;margin-top:5px}
#lrWidgetShelf:empty{display:none}
.lr-widget[hidden],#lrWidgetShelf[hidden]{display:none!important}
#launcher.lr-widgets-editing .lr-widget{outline:1px dashed rgba(30,30,30,.55);outline-offset:2px;cursor:grab}
#launcher.lr-widgets-editing .lr-widget.is-lr-dragging{opacity:.65;transform:scale(.99);z-index:200!important;box-shadow:0 18px 35px rgba(0,0,0,.16)}
#launcher.lr-widgets-editing .lr-drop-target{outline:2px solid #222;outline-offset:3px}
#lrWidgetEditBar{display:none;position:relative;z-index:90;justify-content:flex-end;gap:8px;margin:0 4px 10px}
#launcher.lr-widgets-editing #lrWidgetEditBar{display:flex}
#lrWidgetEditBar button{border:1px solid rgba(0,0,0,.13);border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.94);color:#222;font-family:Arial,sans-serif;font-size:10px;letter-spacing:1px;box-shadow:0 5px 15px rgba(0,0,0,.05)}
#lrWidgetOverlay{position:fixed;inset:0;z-index:100050;display:none;align-items:flex-end;justify-content:center;background:rgba(15,15,15,.28);backdrop-filter:blur(8px);padding:12px}
#lrWidgetOverlay.show{display:flex}
.lr-widget-sheet{width:min(100%,560px);max-height:min(82dvh,720px);overflow:auto;border:1px solid rgba(0,0,0,.12);border-radius:22px 22px 8px 8px;background:#f8f8f6;box-shadow:0 22px 70px rgba(0,0,0,.22);padding:19px;color:#222}
.lr-widget-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:17px;padding-bottom:14px;border-bottom:1px solid rgba(0,0,0,.12)}
.lr-widget-sheet-head h2{font-family:Georgia,"Noto Serif SC",serif;font-size:22px;font-weight:400;letter-spacing:1px;margin:0;color:#222}
.lr-widget-sheet-head p{font-family:Arial,sans-serif;font-size:9px;letter-spacing:1.5px;color:#888;margin:6px 0 0}
.lr-widget-close{border:1px solid rgba(0,0,0,.12);background:white;border-radius:50%;width:34px;height:34px;font-size:20px;color:#222}
.lr-widget-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.lr-widget-choice{position:relative;border:1px solid rgba(0,0,0,.14);border-radius:5px;padding:12px;background:white;color:#222;text-align:left;min-height:114px;display:flex;flex-direction:column;justify-content:space-between}
.lr-widget-choice:disabled{opacity:.4}
.lr-widget-choice strong{display:block;font-family:Georgia,"Noto Serif SC",serif;font-size:13px;font-weight:500}
.lr-widget-choice small{display:block;font-family:Arial,sans-serif;font-size:8px;letter-spacing:1px;color:#888;margin-top:6px;line-height:1.5}
.lr-widget-choice-preview{display:block;font-family:Georgia,serif;font-size:20px;letter-spacing:1px;color:#222;border-top:1px solid rgba(0,0,0,.10);padding-top:9px;margin-top:12px}
.lr-widget-sheet-foot{font-family:Arial,sans-serif;font-size:9px;letter-spacing:.6px;color:#888;line-height:1.6;margin:13px 2px 2px}
@media(max-width:360px){#lrWidgetShelf{gap:7px;grid-auto-rows:124px}.lr-widget{padding:10px}.lr-widget.medium{min-height:118px}}
`;document.head.appendChild(style);
const shelf=document.createElement('section');shelf.id='lrWidgetShelf';shelf.setAttribute('aria-label','桌面小组件');
const grid=launcher.querySelector('.launcher-grid');
const welcome=launcher.querySelector('.launcher-welcome');
const daysCard=launcher.querySelector('.launcher-info');
const board=document.createElement('div');board.id='lrWidgetBoard';board.setAttribute('aria-label','INS 风格桌面组件');
const editBar=document.createElement('div');editBar.id='lrWidgetEditBar';editBar.innerHTML='<button type="button" data-widget-open-chooser>＋ 添加组件</button><button type="button" data-widget-finish>完成</button>';
if(grid){launcher.insertBefore(editBar,grid);launcher.insertBefore(board,grid);board.append(shelf);}
if(welcome)welcome.hidden=true;
if(daysCard)daysCard.hidden=true;
const overlay=document.createElement('div');overlay.id='lrWidgetOverlay';overlay.innerHTML=`<section class="lr-widget-sheet" role="dialog" aria-modal="true" aria-labelledby="lrWidgetSheetTitle"><div class="lr-widget-sheet-head"><div><h2 id="lrWidgetSheetTitle">DESKTOP WIDGETS</h2><p>INSPIRED BY EVERYDAY MOMENTS · INS 风格组件</p></div><button class="lr-widget-close" type="button" aria-label="关闭">×</button></div><div class="lr-widget-list" id="lrWidgetList"></div><div class="lr-widget-sheet-foot">长按桌面空白处打开组件库；长按组件进入编辑模式，可自由拖动和调整位置。布局保存在本机。</div></section>`;
document.body.appendChild(overlay);
const $=id=>document.getElementById(id);
async function read(){
 let v=null;try{v=await widgetDbGet()}catch(e){console.warn('[LOVE RECORD] dedicated widget DB read failed',e)}
 if(!v){try{if(typeof lrKVGet==='function')v=await lrKVGet('home-widgets-layout-v2')}catch(e){console.warn('[LOVE RECORD] previous widget layout migration read failed',e)}}
 if(!v){try{v=JSON.parse(localStorage.getItem(KEY)||'null')}catch{v=null}}
 if(v&&Number(v.version||0)<9)needsUpgrade=true;
 const cleanItems=arr=>(Array.isArray(arr)?arr:[]).filter(x=>x&&definitions.some(d=>d.id===x.id)).map(x=>({...x,size:x.size==='small'?'small':x.size==='large'?'large':'medium',note:String(x.note||''),waterCount:Math.max(0,Number(x.waterCount)||0),waterDate:String(x.waterDate||''),mood:String(x.mood||''),moodHistory:Array.isArray(x.moodHistory)?x.moodHistory.slice(-7):[],focusRemaining:Math.max(0,Number(x.focusRemaining)||1500),focusUntil:Number(x.focusUntil)||0,focusRunning:!!x.focusRunning}));
 if(v&&Array.isArray(v.items))config.items=cleanItems(v.items);
 if(v&&Array.isArray(v.order))config.order=v.order.filter(x=>['welcome','days','shelf'].includes(x));
 if(v&&Array.isArray(v.hidden))config.hidden=v.hidden.filter(x=>['welcome','days'].includes(x));
 if(v&&v.positions&&typeof v.positions==='object')config.positions={...v.positions};
 if(v&&v.pageItems&&typeof v.pageItems==='object')config.pageItems=Object.fromEntries(Object.entries(v.pageItems).map(([k,a])=>[k,cleanItems(a)]));
 if(v&&v.pagePositions&&typeof v.pagePositions==='object')config.pagePositions={...v.pagePositions};
 if(v&&v.pageFixed&&typeof v.pageFixed==='object')config.pageFixed={...v.pageFixed};
 // V10 is a clean break from the old widget shelf: remove legacy fixed cards and old widget placements on every page.
 if(!v||Number(v.version||0)<10){
  config.items=[];config.positions={};config.pageItems={};config.pagePositions={};
  config.hidden=['welcome','days'];config.order=['shelf'];
  config.pageFixed={'0':{hidden:['welcome','days'],order:['shelf']}};
 }
 const allWidgetPages=new Set(['0',...Object.keys(config.pageItems||{}),...Object.keys(config.pageFixed||{})]);
 for(const page of allWidgetPages)config.pageFixed[page]={hidden:['welcome','days'],order:['shelf']};
 activePage=Math.max(0,Number(window.__loveRecordLauncherCurrentPage)||0);
 config.items=cleanItems(config.pageItems[String(activePage)]||[]);
 config.pageItems[String(activePage)]=config.items.map(x=>({...x}));
 config.positions={...(config.pagePositions[String(activePage)]||{})};
 config.hidden=['welcome','days'];config.order=['shelf'];
 await save({silent:true});
}
async function widgetDbHasLayout(){try{return !!(await widgetDbGet())}catch{return false}}
function applyLayout(){if(shelf&&shelf.parentElement===board)board.appendChild(shelf);if(welcome)welcome.hidden=true;if(daysCard)daysCard.hidden=true;shelf.hidden=!config.items.length&&!editMode;}
function setEditMode(on){editMode=!!on;launcher.classList.toggle('lr-widgets-editing',editMode);if(!editMode)dragState=null;renderChoices();applyLayout();}
function addEditTools(node,kind){if(!node||node.querySelector(':scope > .lr-edit-tools'))return;const tools=document.createElement('div');tools.className='lr-edit-tools';tools.innerHTML=`<button type="button" data-fixed-remove="${kind}" aria-label="移除组件">×</button>`;node.appendChild(tools)}
if(welcome)addEditTools(welcome,'welcome');if(daysCard)addEditTools(daysCard,'days');
let saveSeq=0;
async function save(options={}){const seq=++saveSeq;config.pageItems[String(activePage)]=config.items.map(x=>({...x}));config.pagePositions[String(activePage)]={...config.positions};config.pageFixed[String(activePage)]={hidden:[...config.hidden],order:[...config.order]};const payload={...config,items:config.items.map(x=>({...x})),positions:{...config.positions},pageItems:JSON.parse(JSON.stringify(config.pageItems)),pagePositions:JSON.parse(JSON.stringify(config.pagePositions)),pageFixed:JSON.parse(JSON.stringify(config.pageFixed)),itemOrder:config.items.map(x=>x.id),updatedAt:Date.now(),version:10};try{await widgetDbSet(payload);if(seq===saveSeq){window.dispatchEvent(new CustomEvent('lr-home-widgets-changed',{detail:payload}));if(!options.silent)notify('组件布局已保存 ♡')}}catch(e){console.error('[LOVE RECORD] dedicated widget DB save failed',e);if(seq===saveSeq)notify('组件保存失败：独立组件数据库写入失败，请刷新后重试。')}}
function notify(t){if(typeof window.toast==='function')window.toast(t);else if($('toast')){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}}
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function localJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function latestMessage(){const threads=localJSON('love-record-chat-threads-v2');if(!threads)return null;let all=[];if(Array.isArray(threads))all=threads;else if(typeof threads==='object')Object.values(threads).forEach(v=>{if(Array.isArray(v))all.push(...v);else if(Array.isArray(v?.messages))all.push(...v.messages)});return all.filter(x=>x&&typeof x==='object'&&(x.text||x.content||x.message)).sort((a,b)=>new Date(b.createdAt||b.time||b.timestamp||0)-new Date(a.createdAt||a.time||a.timestamp||0))[0]||null}
function photosFromDB(type='memory'){return new Promise(resolve=>{try{const req=indexedDB.open('yanyan-love-v5');req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('images')){db.close();resolve([]);return}let tx;try{tx=db.transaction('images','readonly')}catch(e){db.close();resolve([]);return}const store=tx.objectStore('images');if(!store.indexNames.contains('type')){db.close();resolve([]);return}const r=store.index('type').getAll(type);r.onsuccess=()=>{const arr=(r.result||[]).filter(x=>x&&x.blob).sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0));db.close();resolve(arr)};r.onerror=()=>{db.close();resolve([])};tx.onabort=()=>{db.close();resolve([])}};req.onerror=()=>resolve([]);req.onblocked=()=>resolve([])}catch{resolve([])}})}
const photoWidgetData=new Map();
async function renderPhotoWidget(widgetId){const card=shelf.querySelector(`[data-widget-id="${widgetId}"]`),view=card?.querySelector(`[data-memory-view="${widgetId}"]`);if(!view)return;let data=photoWidgetData.get(widgetId);if(!data||!data.loaded){const records=await photosFromDB('memory');data={loaded:true,records,index:0,urls:new Map()};photoWidgetData.set(widgetId,data)}const records=data.records;if(!records.length){view.innerHTML='<div class="lr-widget-memory-empty">MEMORY 里还没有照片 ♡</div>';return}data.index=((data.index%records.length)+records.length)%records.length;const record=records[data.index];let url=data.urls.get(record.id);if(!url){url=URL.createObjectURL(record.blob);data.urls.set(record.id,url)}const note=String(record.note||'A little moment.');const date=String(record.date||'');view.innerHTML=`<button type="button" class="lr-widget-memory-image" data-memory-next="${widgetId}" aria-label="切换 MEMORY 照片"><img class="lr-widget-photo-square" src="${url}" alt="${escape(note)}"></button><div class="lr-widget-memory-meta"><span>${escape(date||note)}</span><span>${data.index+1} / ${records.length}　›</span></div>`}
function cyclePhotoWidget(widgetId){const data=photoWidgetData.get(widgetId);if(!data||data.records.length<2)return;data.index=widgetId==='memory'?(data.index+1+Math.floor(Math.random()*(data.records.length-1)))%data.records.length:(data.index+1)%data.records.length;renderPhotoWidget(widgetId)}
function widgetHTML(item){const d=definitions.find(x=>x.id===item.id);const sizeClass=item.size==='large'?'large':item.size==='medium'?'medium':'small';let body='';
 if(item.id==='days'){const days=$('launcherDays')?.textContent||'0';body=`<div class="lr-widget-main">${escape(days)} <span style="font-size:11px;font-weight:500">DAYS</span></div><div class="lr-widget-sub">${escape($('launcherToday')?.textContent||'把今天也留在这里。')}</div>`}
 if(item.id==='daily'){body=`<div class="lr-widget-main" style="font-size:16px">“${escape($('launcherToday')?.textContent||'把今天也留在这里。')}”</div><div class="lr-widget-sub">把今天也好好收藏起来。</div>`}
 if(item.id==='photo'||item.id==='memory'){body=`<div class="lr-widget-memory-view" data-memory-view="${item.id}"><div class="lr-widget-sub">正在读取 MEMORY 照片…</div></div>`}
 if(item.id==='message'){const m=latestMessage();const content=m?(m.text||m.content||m.message):'还没有聊天记录';body=`<div class="lr-widget-main" style="font-size:14px">${escape(content).slice(0,120)}</div><div class="lr-widget-sub">${m?escape(m.senderName||m.name||'最近的对话'):'开始一段对话，让这里留下你们的消息。'}</div>`}
 if(item.id==='music'){const snap=window.LRMusicSnapshot||{};const song=snap.title||$('musicNowTitle')?.textContent||'打开音乐，播放喜欢的歌';const artist=snap.artist||$('musicNowArtist')?.textContent||'LOVE RECORD · MUSIC';const cover=snap.cover||$('musicMainCover')?.src||'';const playing=!!snap.playing;body=`<div class="lr-widget-music-row"><img class="lr-widget-music-cover" data-widget-music-cover src="${escape(cover)}" alt=""><div class="lr-widget-music-meta"><strong data-widget-music-title>${escape(song)}</strong><small data-widget-music-artist>${escape(artist)}</small></div><button class="lr-widget-play" type="button" data-widget-play>${playing?'Ⅱ':'▶'}</button></div>`}
 if(item.id==='calendar'){const now=new Date();body=`<div class="lr-widget-main">${now.getDate()}</div><div class="lr-widget-sub">${now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',weekday:'long'})}</div>`}
 if(item.id==='note'){body=`<textarea class="lr-widget-note" data-widget-note placeholder="写下一点想留下的话…">${escape(item.note||'')}</textarea><div class="lr-widget-sub">自动保存到这个桌面组件</div>`}

 if(item.id==='clock'){const now=new Date();body=`<div class="lr-widget-main" data-widget-clock>${now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})}</div><div class="lr-widget-sub">${now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</div>`}
 if(item.id==='countdown'){const start=localJSON('yanyan-love-settings-v5')?.startDate;let days=0;if(start){const d=new Date(start);if(!isNaN(d))days=Math.max(0,Math.floor((Date.now()-d.getTime())/86400000))}body=`<div class="lr-widget-main">${start?`第 ${days} 天`:'设置纪念日日期'}</div><div class="lr-widget-sub">把相伴的每一天都收藏起来 ♡</div>`}
 if(item.id==='checklist'){const checks=Array.isArray(item.checks)&&item.checks.length?item.checks:[{text:'喝一杯水',done:false},{text:'听一首喜欢的歌',done:false},{text:'好好休息',done:false}];body=`<div class="lr-widget-checklist">${checks.map((c,i)=>`<label><input type="checkbox" data-check-index="${i}" ${c.done?'checked':''}><span>${escape(c.text)}</span></label>`).join('')}</div><button type="button" class="lr-widget-add-check" data-check-add>＋ 添加事项</button>`}
 if(item.id==='quote'){const quotes=['慢慢来，也是一种前进。','今天也值得被温柔对待。','把喜欢的日子，过成喜欢的样子。','不必每一步都很快，重要的是一直向前。'];body=`<div class="lr-widget-main" style="font-size:15px;line-height:1.65">“${quotes[new Date().getDate()%quotes.length]}”</div><div class="lr-widget-sub">TODAY’S LITTLE INSPIRATION</div>`}


 if(item.id==='water'){
  const today=localDateKey();if(item.waterDate!==today){item.waterDate=today;item.waterCount=0}
  body=`<div class="lr-widget-sub">TODAY · 每一杯都是小小照顾</div><div class="lr-widget-water"><div><strong>${item.waterCount||0}</strong><small> / 8 杯</small></div><div style="display:flex;gap:6px"><button type="button" class="lr-widget-step" data-water-minus aria-label="减少一杯">−</button><button type="button" class="lr-widget-step" data-water-plus aria-label="增加一杯">＋</button></div></div><div class="lr-widget-sub">今日饮水记录</div>`;
 }
 if(item.id==='mood'){
  const moods=[['😊','开心'],['🥰','幸福'],['😌','平静'],['🥺','低落'],['😴','疲惫']];
  body=`<div class="lr-widget-sub">今天的你，感觉怎么样？</div><div class="lr-widget-moods">${moods.map(([emoji,label])=>`<button type="button" data-mood="${label}" aria-label="${label}" class="${item.mood===label?'active':''}">${emoji}</button>`).join('')}</div><div class="lr-widget-sub">${item.mood?`今天：${item.mood} · 已为你收藏`:'选一个最接近此刻的心情'}</div>`;
 }
 if(item.id==='focus'){
  const remaining=item.focusRunning&&item.focusUntil?Math.max(0,Math.ceil((item.focusUntil-Date.now())/1000)):Math.max(0,Number(item.focusRemaining)||1500);
  if(item.focusRunning&&remaining===0){item.focusRunning=false;item.focusUntil=0;item.focusRemaining=1500}
  const mm=String(Math.floor(remaining/60)).padStart(2,'0'),ss=String(remaining%60).padStart(2,'0');
  body=`<div class="lr-widget-sub">FOCUS SESSION · 25 MINUTES</div><div class="lr-widget-focus"><strong class="lr-widget-focus-time" data-focus-time>${mm}:${ss}</strong><div style="display:flex;gap:5px"><button type="button" data-focus-toggle>${item.focusRunning?'暂停':'开始'}</button><button type="button" data-focus-reset style="background:#ffffffa8;color:#8e75a0">重置</button></div></div><div class="lr-widget-sub">给自己一点不被打扰的时间。</div>`;
 }
 if(item.id==='week'){
  const now=new Date(),day=(now.getDay()+6)%7,monday=new Date(now);monday.setDate(now.getDate()-day);const labels=['一','二','三','四','五','六','日'];
  body=`<div class="lr-widget-sub">${now.getFullYear()}年${now.getMonth()+1}月 · THIS WEEK</div><div class="lr-widget-week">${labels.map((label,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return `<span class="${d.toDateString()===now.toDateString()?'today':''}"><small>${label}</small><b>${d.getDate()}</b></span>`}).join('')}</div>`;
 }

 return `<article class="lr-widget ${sizeClass}${(item.id==='photo'||item.id==='memory')?' lr-widget-memory-widget':''}" data-widget-id="${item.id}"><div class="lr-widget-tools"><button type="button" data-widget-size title="切换大小">↔</button><button type="button" data-widget-remove title="移除组件">×</button></div><div class="lr-widget-kicker">${d.category} · LOVE RECORD</div><div class="lr-widget-title">${d.name}</div>${body}</article>`;
}
function widgetSpan(item){return {cols:item.size==='small'?1:2,rows:(item.id==='photo'||item.id==='memory')?2:(item.size==='large'?2:1)}}
function widgetCells(pos,item){const sp=widgetSpan(item),cells=[];for(let r=pos.row;r<pos.row+sp.rows;r++)for(let c=pos.col;c<pos.col+sp.cols;c++)cells.push(`${r}:${c}`);return cells}
function layoutWidgetPositions(preferredId=null,preferred=null){const used=new Set(),ordered=preferredId?[...config.items.filter(x=>x.id===preferredId),...config.items.filter(x=>x.id!==preferredId)]:config.items.slice();for(const item of ordered){const sp=widgetSpan(item);let pos=item.id===preferredId&&preferred?{row:Math.max(1,preferred.row),col:sp.cols===2?1:Math.max(1,Math.min(2,preferred.col))}:config.positions[item.id];const valid=p=>p&&Number.isInteger(p.row)&&p.row>=1&&p.row<40&&Number.isInteger(p.col)&&p.col>=1&&p.col<=3-sp.cols&&widgetCells(p,item).every(k=>!used.has(k));if(!valid(pos)){pos=null;for(let row=1;row<40&&!pos;row++)for(let col=1;col<=3-sp.cols;col++){const candidate={row,col};if(valid(candidate)){pos=candidate;break}}}if(!pos)pos={row:40+ordered.indexOf(item),col:1};config.positions[item.id]=pos;widgetCells(pos,item).forEach(k=>used.add(k));const node=shelf.querySelector(`[data-widget-id="${item.id}"]`);if(node){node.style.gridColumn=`${pos.col} / span ${sp.cols}`;node.style.gridRow=`${pos.row} / span ${sp.rows}`}}}
function commitWidgetDrop(id,x,y){const item=config.items.find(v=>v.id===id);if(!item)return;const rect=shelf.getBoundingClientRect();if(x<rect.left-20||x>rect.right+20||y<rect.top||y>rect.bottom+80)return;const st=getComputedStyle(shelf),gap=parseFloat(st.rowGap)||10,rowH=parseFloat(st.gridAutoRows)||132;const localY=Math.max(0,y-rect.top);const row=Math.max(1,Math.floor(localY/(rowH+gap))+1);const col=widgetSpan(item).cols===2?1:(x<rect.left+rect.width/2?1:2);layoutWidgetPositions(id,{row,col});}
async function render(){shelf.innerHTML=config.items.map(widgetHTML).join('');layoutWidgetPositions();applyLayout();for(const item of config.items.filter(x=>x.id==='photo'||x.id==='memory'))await renderPhotoWidget(item.id)}
function refreshMusicWidget(){const card=shelf.querySelector('[data-widget-id="music"]');if(!card)return;const snap=window.LRMusicSnapshot||{},title=card.querySelector('[data-widget-music-title]'),artist=card.querySelector('[data-widget-music-artist]'),cover=card.querySelector('[data-widget-music-cover]'),play=card.querySelector('[data-widget-play]');if(title)title.textContent=snap.title||$('musicNowTitle')?.textContent||'打开音乐，播放喜欢的歌';if(artist)artist.textContent=snap.artist||$('musicNowArtist')?.textContent||'LOVE RECORD · MUSIC';if(cover){const src=snap.cover||$('musicMainCover')?.src||'';if(src&&src!=='about:blank')cover.src=src;else cover.removeAttribute('src')}if(play)play.textContent=snap.playing?'Ⅱ':'▶'}
window.addEventListener('lr-music-state-change',refreshMusicWidget);
function openChooser(){if(opening)return;opening=true;renderChoices();overlay.classList.add('show');setEditMode(true)}
function closeChooser(){opening=false;overlay.classList.remove('show')}
function renderChoices(){const list=$('lrWidgetList');if(!list)return;list.innerHTML=definitions.map(d=>{const exists=config.items.some(x=>x.id===d.id);return `<button type="button" class="lr-widget-choice" data-widget-add="${d.id}" ${exists?'disabled':''}><span><strong>${d.name}${exists?' · 已添加':''}</strong><small>${d.category} · ${d.desc}</small></span><span class="lr-widget-choice-preview">${d.preview}</span></button>`}).join('')}
function add(id){if(config.items.some(x=>x.id===id))return;const d=definitions.find(x=>x.id===id);if(!d)return;config.items.push({id,size:d.size,note:'',waterCount:0,waterDate:'',mood:'',moodHistory:[],focusRemaining:1500,focusUntil:0,focusRunning:false});render().then(()=>save());renderChoices();notify('已添加 '+d.name+' ♡')}
editBar.addEventListener('click',e=>{if(e.target.closest('[data-widget-open-chooser]'))openChooser();if(e.target.closest('[data-widget-finish]')){closeChooser();setEditMode(false);notify('桌面布局已保存 ♡')}});
overlay.querySelector('.lr-widget-close').addEventListener('click',closeChooser);
overlay.addEventListener('click',e=>{if(e.target===overlay)closeChooser();const addBtn=e.target.closest('[data-widget-add]');if(addBtn&&!addBtn.disabled)add(addBtn.dataset.widgetAdd)});
function itemNode(target){return target.closest('.lr-widget')}
async function switchWidgetPage(next){
 const page=Math.max(0,Number(next)||0);if(page===activePage)return;
 config.pageItems[String(activePage)]=config.items.map(x=>({...x}));
 config.pagePositions[String(activePage)]={...config.positions};
 config.pageFixed[String(activePage)]={hidden:[...config.hidden],order:[...config.order]};
 activePage=page;
 config.items=(config.pageItems[String(activePage)]||[]).map(x=>({...x}));
 config.positions={...(config.pagePositions[String(activePage)]||{})};
 const fixed=config.pageFixed[String(activePage)]||{hidden:['welcome','days'],order:['shelf']};
 config.hidden=[...(fixed.hidden||[])];config.order=[...(fixed.order||['shelf'])];
 await save({silent:true});await render();renderChoices();applyLayout();
}
window.addEventListener('lr-launcher-page-change',e=>{switchWidgetPage(e.detail?.page).catch(err=>console.error('[LOVE RECORD] page widget switch failed',err))});
function saveOrder(){config.order=['shelf'];config.hidden=['welcome','days'];config.pageFixed[String(activePage)]={hidden:['welcome','days'],order:['shelf']};config.items=[...shelf.querySelectorAll('.lr-widget')].map(n=>config.items.find(x=>x.id===n.dataset.widgetId)).filter(Boolean);save()}
async function moveWidgetToPage(id,targetPage){
 const item=config.items.find(x=>x.id===id);if(!item||targetPage===activePage)return false;
 const from=String(activePage),to=String(targetPage);
 const targetItems=(config.pageItems[to]||[]).map(x=>({...x}));
 if(targetItems.some(x=>x.id===id))return false;
 config.pageItems[from]=config.items.filter(x=>x.id!==id).map(x=>({...x}));
 config.pageItems[to]=[...targetItems,{...item}];
 const nextPositions={...(config.pagePositions[to]||{})};delete nextPositions[id];config.pagePositions[to]=nextPositions;
 config.items=config.pageItems[from].map(x=>({...x}));
 delete config.positions[id];
 await save({silent:true});
 if(typeof window.__loveRecordLauncherSetPage==='function')window.__loveRecordLauncherSetPage(targetPage);
 notify('组件已移动到第 '+(targetPage+1)+' 页 ♡');
 return true;
}
async function moveFixedWidgetToPage(id,targetPage){
 if(!['welcome','days'].includes(id)||targetPage===activePage)return false;
 const from=String(activePage),to=String(targetPage);
 const source={...(config.pageFixed[from]||{hidden:[...config.hidden],order:[...config.order]})};
 const target={...(config.pageFixed[to]||{hidden:['welcome','days'],order:['shelf']})};
 source.hidden=[...(source.hidden||[]).filter(x=>x!==id),id];
 source.order=[...(source.order||[]).filter(x=>x!==id)];
 target.hidden=(target.hidden||[]).filter(x=>x!==id);
 target.order=[...(target.order||['shelf']).filter(x=>x!==id)];
 const shelfIndex=target.order.indexOf('shelf');
 target.order.splice(shelfIndex<0?target.order.length:shelfIndex,0,id);
 config.pageFixed[from]=source;config.pageFixed[to]=target;
 config.hidden=[...source.hidden];config.order=[...source.order];
 await save({silent:true});
 if(typeof window.__loveRecordLauncherSetPage==='function')window.__loveRecordLauncherSetPage(targetPage);
 notify('桌面组件已移动到第 '+(targetPage+1)+' 页 ♡');
 return true;
}
let widgetDragFrame=0,widgetPendingPoint=null;
function reorderAt(x,y){
 if(!dragState)return;
 dragState.lastX=x;dragState.lastY=y;
 widgetPendingPoint={x,y};
 if(widgetDragFrame)return;
 widgetDragFrame=requestAnimationFrame(()=>{
  widgetDragFrame=0;if(!dragState||!widgetPendingPoint)return;
  const p=widgetPendingPoint;widgetPendingPoint=null;
  dragState.node.style.transform=`translate3d(${p.x-dragState.startX}px,${p.y-dragState.startY}px,0) scale(1.025)`;
  dragState.node.style.zIndex='150';
 });
}
function startDrag(node,e){
 if(!node)return;
 dragState={node,scope:node.classList.contains('lr-widget')?'shelf':'board',oldPointerEvents:node.style.pointerEvents,
  pointerId:e.pointerId,startX:Number(e.clientX)||0,startY:Number(e.clientY)||0,lastX:Number(e.clientX)||0,lastY:Number(e.clientY)||0,
  widgetId:node.dataset.widgetId||null,oldPosition:node.dataset.widgetId?{...(config.positions[node.dataset.widgetId]||{row:2,col:1})}:null};
 node.classList.add('is-lr-dragging');node.style.pointerEvents='none';node.style.willChange='transform';
 try{if(e.pointerId!==undefined&&node.setPointerCapture)node.setPointerCapture(e.pointerId)}catch(err){console.debug('[LOVE RECORD] widget pointer capture unavailable',err)}
 if(e.cancelable)e.preventDefault();
}
function nearestLauncherPage(x,y){
 const dots=[...document.querySelectorAll('#launcherPages [data-launcher-page]')];let best=null,bestD=Infinity;
 for(const dot of dots){const r=dot.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(x-cx,y-cy);if(d<bestD&&d<=84){bestD=d;best=Number(dot.dataset.launcherPage)}}
 return best;
}
document.addEventListener('pointermove',e=>{
 if(pendingWidgetPress&&e.pointerId===pendingWidgetPress.pointerId&&Math.hypot(e.clientX-pendingWidgetPress.x,e.clientY-pendingWidgetPress.y)>28){clearTimeout(pressTimer);pressTimer=null;pendingWidgetPress=null;}
 if(dragState){dragState.lastX=e.clientX;dragState.lastY=e.clientY;window.__lrWidgetLastPointer={x:e.clientX,y:e.clientY};reorderAt(e.clientX,e.clientY)}
},{passive:true});
document.addEventListener('pointerup',e=>{
 if(!dragState|| (dragState.pointerId!==undefined&&e.pointerId!==dragState.pointerId))return;
 if(widgetDragFrame){cancelAnimationFrame(widgetDragFrame);widgetDragFrame=0;}
 if(widgetPendingPoint){const p=widgetPendingPoint;widgetPendingPoint=null;dragState.node.style.transform=`translate3d(${p.x-dragState.startX}px,${p.y-dragState.startY}px,0) scale(1.025)`;}
 const state=dragState,node=state.node;
 node.classList.remove('is-lr-dragging');
 const releaseX=Number.isFinite(e.clientX)?e.clientX:state.lastX,releaseY=Number.isFinite(e.clientY)?e.clientY:state.lastY;
 const releaseUnder=document.elementFromPoint(releaseX,releaseY);
 const targetPage=nearestLauncherPage(releaseX,releaseY);
 if(state.scope==='shelf'&&state.widgetId){
  node.style.transform='';node.style.zIndex='';node.style.willChange='';
  if(targetPage!==null&&Number.isInteger(targetPage)&&targetPage>=0&&targetPage!==activePage){
   moveWidgetToPage(state.widgetId,targetPage).then(moved=>{if(!moved)commitWidgetDrop(state.widgetId,releaseX,releaseY)}).catch(err=>console.error('[LOVE RECORD] widget page move failed',err));
  }else commitWidgetDrop(state.widgetId,releaseX,releaseY);
 }else if(state.scope==='board'){
  const fixedId=null;
  node.style.transform='';node.style.zIndex='';node.style.willChange='';
  if(fixedId&&targetPage!==null&&Number.isInteger(targetPage)&&targetPage>=0&&targetPage!==activePage){
   moveFixedWidgetToPage(fixedId,targetPage).catch(err=>console.error('[LOVE RECORD] fixed widget page move failed',err));
  }else{
   const target=releaseUnder?.closest('#lrWidgetShelf');
   if(target&&target!==node){const rect=target.getBoundingClientRect();board.insertBefore(node,(state.lastY||e.clientY)<rect.top+rect.height/2?target:target.nextSibling);}
  }
 }
 const wasPageDrop=(state.scope==='shelf'&&state.widgetId||state.scope==='board')&&targetPage!==null&&targetPage!==activePage;
 window.__lrWidgetJustDragged=Date.now();
 node.style.pointerEvents=state.oldPointerEvents||'';
 dragState=null;if(!wasPageDrop)saveOrder();renderChoices();
});
document.addEventListener('pointercancel',()=>{
 if(widgetDragFrame){cancelAnimationFrame(widgetDragFrame);widgetDragFrame=0;}
 widgetPendingPoint=null;
 if(dragState){dragState.node.classList.remove('is-lr-dragging');dragState.node.style.pointerEvents=dragState.oldPointerEvents||'';dragState.node.style.transform='';dragState.node.style.zIndex='';dragState.node.style.willChange='';dragState=null;}
});
let blankPress=null,blankPressTimer=null,blankPressOpened=false;
launcher.addEventListener('pointerdown',e=>{
 if(e.target.closest('.launcher-app'))return;
 const node=itemNode(e.target);
 if(editMode&&node&&!e.target.closest('button,input,textarea')){startDrag(node,e);return}
 if(e.target.closest('button,a,input,textarea,select,#lrWidgetOverlay,.nav,.nav-btn'))return;
 if(node){
  const downEvent=e;pendingWidgetPress={pointerId:e.pointerId,x:e.clientX,y:e.clientY,node};
  pressTimer=setTimeout(()=>{pressTimer=null;pendingWidgetPress=null;setEditMode(true);startDrag(node,{pointerId:downEvent.pointerId,cancelable:false,clientX:downEvent.clientX,clientY:downEvent.clientY});notify('正在移动组件，松开即可放置。')},320);
  return;
 }
 if(e.target.closest('#launcher')){
  clearTimeout(blankPressTimer);blankPressOpened=false;
  blankPress={pointerId:e.pointerId,x:e.clientX,y:e.clientY};
  blankPressTimer=setTimeout(()=>{blankPressTimer=null;blankPressOpened=true;blankPress=null;openChooser()},520);
 }
},{capture:true});
document.addEventListener('pointermove',e=>{
 if(blankPress&&e.pointerId===blankPress.pointerId&&Math.hypot(e.clientX-blankPress.x,e.clientY-blankPress.y)>18){clearTimeout(blankPressTimer);blankPressTimer=null;blankPress=null;}
 if(pendingWidgetPress&&e.pointerId===pendingWidgetPress.pointerId&&Math.hypot(e.clientX-pendingWidgetPress.x,e.clientY-pendingWidgetPress.y)>28){clearTimeout(pressTimer);pressTimer=null;pendingWidgetPress=null;}
},{passive:true});
document.addEventListener('pointerup',e=>{
 if(blankPress&&e.pointerId===blankPress.pointerId){clearTimeout(blankPressTimer);blankPressTimer=null;blankPress=null;}
});
document.addEventListener('pointercancel',()=>{clearTimeout(blankPressTimer);blankPressTimer=null;blankPress=null;});
document.addEventListener('pointerup',()=>{clearTimeout(pressTimer);pressTimer=null;pendingWidgetPress=null;});document.addEventListener('pointercancel',()=>{clearTimeout(pressTimer);pressTimer=null;pendingWidgetPress=null;});
launcher.addEventListener('click',e=>{
 if(blankPressOpened){blankPressOpened=false;e.preventDefault();e.stopPropagation();return}

 if(window.__lrWidgetJustDragged&&Date.now()-window.__lrWidgetJustDragged<700){e.preventDefault();e.stopPropagation();return}
 const memoryNext=e.target.closest('[data-memory-next]');if(memoryNext){e.preventDefault();e.stopPropagation();cyclePhotoWidget(memoryNext.dataset.memoryNext);return}
 const remove=e.target.closest('[data-fixed-remove]');
 if(remove){const id=remove.dataset.fixedRemove;if(!config.hidden.includes(id))config.hidden.push(id);save();applyLayout();renderChoices();return}
 const card=e.target.closest('[data-widget-id]');if(!card)return;const id=card.dataset.widgetId;
 if(e.target.closest('[data-widget-remove]')){config.items=config.items.filter(x=>x.id!==id);save();render();renderChoices();return}
 if(e.target.closest('[data-widget-size]')){const item=config.items.find(x=>x.id===id);if(item){item.size=item.size==='small'?'medium':item.size==='medium'?'large':'small';layoutWidgetPositions();save();render()}return}
 if(e.target.closest('[data-widget-play]')){const audio=$('lrGlobalAudio');if(audio){if(audio.paused)audio.play().catch(()=>notify('请先在音乐页面选择歌曲。'));else audio.pause()}else notify('请先在音乐页面选择歌曲。')}
 const item=config.items.find(x=>x.id===id);if(!item)return;
 if(e.target.closest('[data-water-plus]')||e.target.closest('[data-water-minus]')){const today=localDateKey();if(item.waterDate!==today){item.waterDate=today;item.waterCount=0}item.waterCount=Math.max(0,Math.min(99,(item.waterCount||0)+(e.target.closest('[data-water-plus]')?1:-1)));render().then(()=>save());return}
 const mood=e.target.closest('[data-mood]');if(mood){item.mood=mood.dataset.mood;item.moodHistory=[...(item.moodHistory||[]),{date:localDateKey(),mood:item.mood}].slice(-7);render().then(()=>save());return}
 if(e.target.closest('[data-focus-toggle]')){const now=Date.now();if(item.focusRunning){item.focusRemaining=Math.max(0,Math.ceil((item.focusUntil-now)/1000));item.focusRunning=false;item.focusUntil=0}else{if(!item.focusRemaining)item.focusRemaining=1500;item.focusRunning=true;item.focusUntil=now+item.focusRemaining*1000}render().then(()=>save({silent:true}));return}
 if(e.target.closest('[data-focus-reset]')){item.focusRunning=false;item.focusUntil=0;item.focusRemaining=1500;render().then(()=>save());return}
});
shelf.addEventListener('input',e=>{if(!e.target.matches('[data-widget-note]'))return;const card=e.target.closest('[data-widget-id]'),item=config.items.find(x=>x.id===card?.dataset.widgetId);if(item){item.note=e.target.value;save()}});
shelf.addEventListener('change',e=>{if(!e.target.matches('[data-check-index]'))return;const card=e.target.closest('[data-widget-id]'),item=config.items.find(x=>x.id===card?.dataset.widgetId);if(!item)return;const labels=[...card.querySelectorAll('.lr-widget-checklist label span')].map(n=>n.textContent);item.checks=labels.map((text,i)=>({text,done:!!card.querySelector(`[data-check-index="${i}"]`)?.checked}));save()});
shelf.addEventListener('click',e=>{const btn=e.target.closest('[data-check-add]');if(!btn)return;const card=btn.closest('[data-widget-id]'),item=config.items.find(x=>x.id===card?.dataset.widgetId);if(!item)return;const text=prompt('写下一个小任务');if(text&&text.trim()){const existing=[...card.querySelectorAll('.lr-widget-checklist label span')].map((n,i)=>({text:n.textContent,done:!!card.querySelector(`[data-check-index="${i}"]`)?.checked}));existing.push({text:text.trim(),done:false});item.checks=existing;render().then(()=>save())}});
setInterval(()=>{const card=shelf.querySelector('[data-widget-id="focus"]');if(!card)return;const item=config.items.find(x=>x.id==='focus');if(!item||!item.focusRunning)return;const left=Math.max(0,Math.ceil((item.focusUntil-Date.now())/1000));const node=card.querySelector('[data-focus-time]');if(node)node.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;if(left===0){item.focusRunning=false;item.focusUntil=0;item.focusRemaining=1500;save({silent:true});notify('专注时间结束啦，休息一下吧 ♡');render()}},1000);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opening)closeChooser();else if(e.key==='Escape'&&editMode)setEditMode(false)});
window.addEventListener('storage',e=>{if(e.key===KEY){read();render();renderChoices()}});
window.addEventListener('lr-home-widgets-refresh',()=>{render()});
const sharedAudio=$('lrGlobalAudio');if(sharedAudio)['play','pause','loadedmetadata','ended'].forEach(ev=>sharedAudio.addEventListener(ev,refreshMusicWidget));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
// Keep the widgets live when their source components change in the same page.
const liveObserver=new MutationObserver(records=>{if(document.hidden)return;if(records.some(r=>r.target&&r.target.closest&&r.target.closest('#memoryGrid'))){for(const id of ['photo','memory']){const data=photoWidgetData.get(id);if(data){data.loaded=false;for(const url of data.urls.values())URL.revokeObjectURL(url);photoWidgetData.delete(id)}}}render()});
['launcherDays','launcherToday','homePhoto','chatMessages','musicTogetherCurrentSong'].forEach(id=>{const node=$(id);if(node)liveObserver.observe(node,{childList:true,subtree:true,characterData:true,attributes:id==='homePhoto'})});
const memoryGallery=$('memoryGrid');if(memoryGallery)liveObserver.observe(memoryGallery,{childList:true,subtree:true});
const globalAudio=$('lrGlobalAudio');if(globalAudio)['play','pause','ended','loadedmetadata'].forEach(ev=>globalAudio.addEventListener(ev,()=>render()));
read().then(()=>{applyLayout();render().then(()=>{if(needsUpgrade)save({silent:true})})}).catch(e=>{console.error('[LOVE RECORD] widget layout restore failed',e);applyLayout();render()});
})();
