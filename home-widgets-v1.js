/* LOVE RECORD · Home widgets v1
   In-app launcher widgets. Layout is persisted and shared across launcher sessions/tabs. */
(()=>{'use strict';
const KEY='love-record-home-widgets-v1';
const launcher=document.getElementById('launcher');
if(!launcher||document.getElementById('lrWidgetShelf'))return;
const definitions=[
 {id:'days',name:'在一起的日子',category:'LOVE',size:'small',desc:'纪念日计数与今日寄语'},
 {id:'photo',name:'我们的照片',category:'MEMORY',size:'medium',desc:'读取主页照片，点按可更换'},
 {id:'daily',name:'今日寄语',category:'AI',size:'small',desc:'展示主页今日文字'},
 {id:'message',name:'最近一条消息',category:'AI',size:'medium',desc:'读取最近聊天记录'},
 {id:'music',name:'音乐播放器',category:'MUSIC',size:'small',desc:'显示当前播放歌曲与控制'},
 {id:'calendar',name:'今日日历',category:'LIFE',size:'small',desc:'日期、星期与月份'},
 {id:'note',name:'快速便笺',category:'LIFE',size:'medium',desc:'随手记录，自动保存'},
 {id:'memory',name:'随机回忆',category:'MEMORY',size:'medium',desc:'从已有照片中随机展示'}
];
let config={items:[],order:['welcome','days','shelf'],hidden:[]},pressTimer=null,pressStart=null,opening=false,editMode=false,dragState=null;
const style=document.createElement('style');style.id='lr-home-widgets-style';style.textContent=`
#lrWidgetShelf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0 0 18px;padding:0 2px}
.lr-widget{position:relative;min-width:0;min-height:112px;padding:14px;border:1px solid rgba(255,255,255,.78);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.78),rgba(239,229,247,.68));box-shadow:0 10px 28px rgba(105,78,128,.09),inset 0 1px 0 rgba(255,255,255,.9);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);color:#574a62;overflow:hidden}
.lr-widget.large{grid-column:1/-1;min-height:142px}
.lr-widget-kicker{font-size:9px;letter-spacing:1.7px;opacity:.58;margin-bottom:8px}
.lr-widget-title{font-size:12px;font-weight:650;margin-bottom:6px}
.lr-widget-main{font-size:22px;line-height:1.2;font-weight:650;overflow-wrap:anywhere}
.lr-widget-sub{font-size:11px;line-height:1.55;opacity:.7;margin-top:5px;overflow-wrap:anywhere}
.lr-widget-tools{position:absolute;right:8px;top:8px;display:flex;gap:5px;opacity:0;transition:opacity .15s}
#launcher.lr-widgets-editing .lr-widget-tools{opacity:1}
.lr-widget-tools button{width:25px;height:25px;border:1px solid #fff9;border-radius:50%;background:#fff9;color:#74617f;font-size:13px}
.lr-widget-photo{width:100%;height:105px;object-fit:cover;border-radius:13px;display:block}
.lr-widget-note{width:100%;min-height:64px;border:0;outline:0;resize:vertical;background:transparent;color:inherit;font:inherit;font-size:12px}
.lr-widget-audio{display:flex;align-items:center;gap:9px;margin-top:9px}
.lr-widget-play{width:34px;height:34px;border:0;border-radius:50%;background:#b99bc9;color:white;font-size:15px}
#lrWidgetOverlay{position:fixed;inset:0;z-index:100050;display:none;align-items:flex-end;justify-content:center;background:rgba(42,31,51,.28);backdrop-filter:blur(7px);padding:12px}
#lrWidgetOverlay.show{display:flex}
.lr-widget-sheet{width:min(100%,560px);max-height:min(82dvh,720px);overflow:auto;border:1px solid #ffffffc9;border-radius:28px;background:linear-gradient(145deg,#fbf8fd,#eee5f3);box-shadow:0 22px 70px #34243f40;padding:18px;color:#574a62}
.lr-widget-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.lr-widget-sheet-head h2{font-size:18px;margin:0}.lr-widget-sheet-head p{font-size:11px;opacity:.65;margin:3px 0 0}
.lr-widget-close{border:0;background:#fff9;border-radius:50%;width:34px;height:34px;font-size:20px;color:inherit}
.lr-widget-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.lr-widget-choice{border:1px solid #d9c9e3;border-radius:17px;padding:12px;background:#fff9;color:inherit;text-align:left;min-height:88px}
.lr-widget-choice:disabled{opacity:.42}
.lr-widget-choice strong{display:block;font-size:12px}.lr-widget-choice small{display:block;font-size:10px;opacity:.66;margin-top:5px;line-height:1.4}
.lr-widget-sheet-foot{font-size:10px;opacity:.6;line-height:1.5;margin:13px 2px 2px}
#launcher.lr-widgets-editing #lrWidgetShelf{outline:1px dashed #b99bc9;outline-offset:5px}
#launcher.lr-widgets-editing .lr-widget{box-shadow:0 0 0 1px #b99bc9,0 10px 28px #694e8018}

#lrWidgetBoard{display:flex;flex-direction:column;gap:0;position:relative}
#lrWidgetEditBar{display:none;position:sticky;top:40px;z-index:90;justify-content:flex-end;gap:8px;margin:0 4px 10px}
#launcher.lr-widgets-editing #lrWidgetEditBar{display:flex}
#lrWidgetEditBar button{border:1px solid #ffffffc9;border-radius:999px;padding:8px 14px;background:rgba(255,255,255,.88);color:#705d7e;font:inherit;font-size:11px;box-shadow:0 5px 15px #57436618;backdrop-filter:blur(14px)}

.lr-edit-tools{position:absolute;right:9px;top:9px;z-index:8;display:none;gap:6px}
#launcher.lr-widgets-editing .lr-edit-tools{display:flex}
.lr-edit-tools button{width:27px;height:27px;border:1px solid #fff;border-radius:50%;background:rgba(255,255,255,.94);color:#8c6fa0;font-size:16px;line-height:1;box-shadow:0 3px 10px #57436620}
#launcher.lr-widgets-editing .launcher-welcome,#launcher.lr-widgets-editing .launcher-info,#launcher.lr-widgets-editing .lr-widget{outline:1px dashed rgba(169,137,190,.9);outline-offset:2px;position:relative;cursor:grab;touch-action:none}
#launcher.lr-widgets-editing .launcher-welcome{border-radius:16px;background:rgba(255,255,255,.15)}
#launcher.lr-widgets-editing .is-lr-dragging{opacity:.38;transform:scale(.98)}
#launcher.lr-widgets-editing .lr-drop-target{outline:2px solid #ad8bc4;outline-offset:3px}
#lrWidgetShelf:empty{display:none}
.lr-widget-drag-hint{font-size:9px;opacity:.55;text-align:center;margin:-5px 0 9px;display:none}
#launcher.lr-widgets-editing .lr-widget-drag-hint{display:block}
.lr-widget[hidden],.launcher-info[hidden],.launcher-welcome[hidden],#lrWidgetShelf[hidden]{display:none!important}

@media(max-width:360px){#lrWidgetShelf{gap:7px}.lr-widget{padding:11px}.lr-widget-main{font-size:19px}}
`;document.head.appendChild(style);
const shelf=document.createElement('section');shelf.id='lrWidgetShelf';shelf.setAttribute('aria-label','桌面小组件');
const grid=launcher.querySelector('.launcher-grid');
const welcome=launcher.querySelector('.launcher-welcome');
const daysCard=launcher.querySelector('.launcher-info');
const board=document.createElement('div');board.id='lrWidgetBoard';board.setAttribute('aria-label','可编辑桌面组件');
const editBar=document.createElement('div');editBar.id='lrWidgetEditBar';editBar.innerHTML='<button type="button" data-widget-open-chooser>＋ 添加组件</button><button type="button" data-widget-finish>完成</button>';
if(welcome&&daysCard&&grid){launcher.insertBefore(editBar,welcome);launcher.insertBefore(board,welcome);board.append(welcome,daysCard,shelf);}
else if(grid)launcher.insertBefore(shelf,grid);
const overlay=document.createElement('div');overlay.id='lrWidgetOverlay';overlay.innerHTML=`<section class="lr-widget-sheet" role="dialog" aria-modal="true" aria-labelledby="lrWidgetSheetTitle"><div class="lr-widget-sheet-head"><div><h2 id="lrWidgetSheetTitle">桌面组件</h2><p>可恢复已移除的固定组件，也可以添加新组件</p></div><button class="lr-widget-close" type="button" aria-label="关闭">×</button></div><div class="lr-widget-list" id="lrWidgetList"></div><div class="lr-widget-sheet-foot">长按组件进入编辑模式，再次拖动即可调整位置；点击 × 可移除。布局保存在当前设备。</div></section>`;
document.body.appendChild(overlay);
const $=id=>document.getElementById(id);
function read(){try{const v=JSON.parse(localStorage.getItem(KEY)||'{}');if(Array.isArray(v.items))config.items=v.items.filter(x=>definitions.some(d=>d.id===x.id)).map(x=>({id:x.id,size:x.size==='large'?'large':'small',note:String(x.note||'')}));if(Array.isArray(v.order))config.order=v.order.filter(x=>['welcome','days','shelf'].includes(x));if(Array.isArray(v.hidden))config.hidden=v.hidden.filter(x=>['welcome','days'].includes(x));if(Array.isArray(v.itemOrder)){const rank=new Map(v.itemOrder.map((id,i)=>[id,i]));config.items.sort((a,b)=>(rank.get(a.id)??999)-(rank.get(b.id)??999))}}catch{}}
function applyLayout(){const map={welcome,days:daysCard,shelf};config.order.forEach(id=>{const node=map[id];if(node&&node.parentElement===board)board.appendChild(node)});if(welcome)welcome.hidden=config.hidden.includes('welcome');if(daysCard)daysCard.hidden=config.hidden.includes('days');if(shelf)shelf.hidden=!config.items.length&&!editMode;}
function setEditMode(on){editMode=!!on;launcher.classList.toggle('lr-widgets-editing',editMode);if(!editMode)dragState=null;renderChoices();applyLayout();}
function addEditTools(node,kind){if(!node||node.querySelector(':scope > .lr-edit-tools'))return;const tools=document.createElement('div');tools.className='lr-edit-tools';tools.innerHTML=`<button type="button" data-fixed-remove="${kind}" aria-label="移除组件">×</button>`;node.appendChild(tools)}
if(welcome)addEditTools(welcome,'welcome');if(daysCard)addEditTools(daysCard,'days');
function save(){try{localStorage.setItem(KEY,JSON.stringify({...config,itemOrder:config.items.map(x=>x.id)}));window.dispatchEvent(new CustomEvent('lr-home-widgets-changed',{detail:config}));}catch(e){notify('组件保存失败，请检查浏览器储存空间。')}}
function notify(t){if(typeof window.toast==='function')window.toast(t);else if($('toast')){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}}
function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function localJSON(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function latestMessage(){const threads=localJSON('love-record-chat-threads-v2');if(!threads)return null;let all=[];if(Array.isArray(threads))all=threads;else if(typeof threads==='object')Object.values(threads).forEach(v=>{if(Array.isArray(v))all.push(...v);else if(Array.isArray(v?.messages))all.push(...v.messages)});return all.filter(x=>x&&typeof x==='object'&&(x.text||x.content||x.message)).sort((a,b)=>new Date(b.createdAt||b.time||b.timestamp||0)-new Date(a.createdAt||a.time||a.timestamp||0))[0]||null}
function photoFromDB(type){return new Promise(resolve=>{try{const req=indexedDB.open('yanyan-love-v5',1);req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains('images')){db.close();resolve(null);return}const tx=db.transaction('images','readonly'),idx=tx.objectStore('images').index('type'),r=idx.getAll(type);r.onsuccess=()=>{const arr=(r.result||[]).reverse();db.close();resolve(arr[0]?.blob||null)};r.onerror=()=>{db.close();resolve(null)}};req.onerror=()=>resolve(null)}catch{resolve(null)}})}
function widgetHTML(item){const d=definitions.find(x=>x.id===item.id);const large=item.size==='large';let body='';
 if(item.id==='days'){const days=$('launcherDays')?.textContent||'0';body=`<div class="lr-widget-main">${escape(days)} <span style="font-size:11px;font-weight:500">DAYS</span></div><div class="lr-widget-sub">${escape($('launcherToday')?.textContent||'把今天也留在这里。')}</div>`}
 if(item.id==='daily'){body=`<div class="lr-widget-main" style="font-size:16px">“${escape($('launcherToday')?.textContent||'把今天也留在这里。')}”</div><div class="lr-widget-sub">把今天也好好收藏起来。</div>`}
 if(item.id==='photo'||item.id==='memory'){body=`<div class="lr-widget-photo-wrap"><div class="lr-widget-sub">${item.id==='memory'?'正在寻找一段回忆…':'读取主页照片…'}</div></div>`}
 if(item.id==='message'){const m=latestMessage();const content=m?(m.text||m.content||m.message):'还没有聊天记录';body=`<div class="lr-widget-main" style="font-size:14px">${escape(content).slice(0,120)}</div><div class="lr-widget-sub">${m?escape(m.senderName||m.name||'最近的对话'):'开始一段对话，让这里留下你们的消息。'}</div>`}
 if(item.id==='music'){const audio=$('lrGlobalAudio');const song=audio?.dataset?.title||audio?.getAttribute('data-title')||'打开音乐，播放喜欢的歌';body=`<div class="lr-widget-main" style="font-size:14px">${escape(song)}</div><div class="lr-widget-audio"><button class="lr-widget-play" type="button" data-widget-play>▶</button><span class="lr-widget-sub">${audio&&!audio.paused?'正在播放':'LOVE RECORD · MUSIC'}</span></div>`}
 if(item.id==='calendar'){const now=new Date();body=`<div class="lr-widget-main">${now.getDate()}</div><div class="lr-widget-sub">${now.toLocaleDateString('zh-CN',{year:'numeric',month:'long',weekday:'long'})}</div>`}
 if(item.id==='note'){body=`<textarea class="lr-widget-note" data-widget-note placeholder="写下一点想留下的话…">${escape(item.note||'')}</textarea><div class="lr-widget-sub">自动保存到这个桌面组件</div>`}
 return `<article class="lr-widget ${large?'large':''}" data-widget-id="${item.id}"><div class="lr-widget-tools"><button type="button" data-widget-size title="切换大小">↔</button><button type="button" data-widget-remove title="移除组件">×</button></div><div class="lr-widget-kicker">${d.category} · LOVE RECORD</div><div class="lr-widget-title">${d.name}</div>${body}</article>`;
}
async function render(){shelf.innerHTML=config.items.map(widgetHTML).join('');if(config.items.length&&!shelf.querySelector('.lr-widget-drag-hint'))shelf.insertAdjacentHTML('afterbegin','<div class="lr-widget-drag-hint">长按组件可移动 · × 移除</div>');applyLayout();for(const item of config.items.filter(x=>x.id==='photo'||x.id==='memory')){const card=shelf.querySelector(`[data-widget-id="${item.id}"] .lr-widget-photo-wrap`);if(!card)continue;const blob=await photoFromDB(item.id==='photo'?'home':'memory');if(blob){const url=URL.createObjectURL(blob);card.innerHTML=`<img class="lr-widget-photo" src="${url}" alt="LOVE RECORD 照片">`}else card.innerHTML='<div class="lr-widget-sub">还没有照片，点主页照片卡片添加一张吧 ♡</div>'}}
function openChooser(){if(opening)return;opening=true;renderChoices();overlay.classList.add('show');setEditMode(true)}
function closeChooser(){opening=false;overlay.classList.remove('show')}
function renderChoices(){const list=$('lrWidgetList');if(!list)return;const fixed=[{id:'welcome',name:'我们的小宇宙',category:'HOME',desc:'主页标题与欢迎区域',hidden:config.hidden.includes('welcome')},{id:'days',name:'Days Together',category:'LOVE',desc:'纪念日与主页照片卡片',hidden:config.hidden.includes('days')}];list.innerHTML=fixed.map(d=>`<button type="button" class="lr-widget-choice" data-widget-restore="${d.id}" ${!d.hidden?'disabled':''}><strong>${d.name}${d.hidden?' · 点击恢复':' · 已显示'}</strong><small>${d.category} · ${d.desc}</small></button>`).join('')+definitions.map(d=>{const exists=config.items.some(x=>x.id===d.id);return `<button type="button" class="lr-widget-choice" data-widget-add="${d.id}" ${exists?'disabled':''}><strong>${d.name}${exists?' · 已添加':''}</strong><small>${d.category} · ${d.desc}</small></button>`}).join('')}
function add(id){if(config.items.some(x=>x.id===id))return;const d=definitions.find(x=>x.id===id);if(!d)return;config.items.push({id,size:d.size,note:''});save();render();renderChoices();notify('已添加 '+d.name+' ♡')}
function restoreFixed(id){config.hidden=config.hidden.filter(x=>x!==id);save();applyLayout();renderChoices();notify('已恢复组件 ♡')}
editBar.addEventListener('click',e=>{if(e.target.closest('[data-widget-open-chooser]'))openChooser();if(e.target.closest('[data-widget-finish]')){closeChooser();setEditMode(false);notify('桌面布局已保存 ♡')}});
overlay.querySelector('.lr-widget-close').addEventListener('click',closeChooser);
overlay.addEventListener('click',e=>{if(e.target===overlay)closeChooser();const restore=e.target.closest('[data-widget-restore]');if(restore&&!restore.disabled){restoreFixed(restore.dataset.widgetRestore);return}const addBtn=e.target.closest('[data-widget-add]');if(addBtn&&!addBtn.disabled)add(addBtn.dataset.widgetAdd)});
function itemNode(target){return target.closest('.launcher-welcome,.launcher-info,.lr-widget')}
function saveOrder(){config.order=[...board.children].filter(n=>n===welcome||n===daysCard||n===shelf).map(n=>n===welcome?'welcome':n===daysCard?'days':'shelf');config.items=[...shelf.querySelectorAll('.lr-widget')].map(n=>config.items.find(x=>x.id===n.dataset.widgetId)).filter(Boolean);save()}
function reorderAt(x,y){if(!dragState)return;const under=document.elementFromPoint(x,y);const target=under?.closest('.launcher-welcome,.launcher-info,.lr-widget');if(!target||target===dragState.node)return;if(dragState.scope==='board'&&(target===welcome||target===daysCard)){const rect=target.getBoundingClientRect();board.insertBefore(dragState.node,y<rect.top+rect.height/2?target:target.nextSibling)}else if(dragState.scope==='shelf'&&target.classList.contains('lr-widget')){const rect=target.getBoundingClientRect();shelf.insertBefore(dragState.node,y<rect.top+rect.height/2?target:target.nextSibling)}}
function startDrag(node,e){if(!editMode||!node)return;dragState={node,scope:node.classList.contains('lr-widget')?'shelf':'board'};node.classList.add('is-lr-dragging')}
document.addEventListener('pointermove',e=>{if(dragState)reorderAt(e.clientX,e.clientY)});
document.addEventListener('pointerup',()=>{if(!dragState)return;dragState.node.classList.remove('is-lr-dragging');dragState=null;saveOrder();renderChoices()});
document.addEventListener('pointercancel',()=>{if(dragState){dragState.node.classList.remove('is-lr-dragging');dragState=null}});
launcher.addEventListener('pointerdown',e=>{
 const node=itemNode(e.target);
 if(editMode&&node&&!e.target.closest('button,input,textarea')){startDrag(node,e);return}
 if(e.target.closest('button,a,input,textarea,select,#lrWidgetOverlay'))return;
 if(node){pressTimer=setTimeout(()=>{pressTimer=null;setEditMode(true);notify('已进入桌面编辑模式，再次按住组件并拖动即可调整位置。')},520);return}
 if(e.target===launcher||e.target.closest('.launcher-pages,.launcher-grid')||e.target.id==='lrWidgetShelf'){pressTimer=setTimeout(()=>{pressTimer=null;openChooser()},560)}
});
['pointerup','pointercancel','pointerleave'].forEach(type=>launcher.addEventListener(type,()=>{clearTimeout(pressTimer);pressTimer=null}));
launcher.addEventListener('click',e=>{
 const remove=e.target.closest('[data-fixed-remove]');
 if(remove){const id=remove.dataset.fixedRemove;if(!config.hidden.includes(id))config.hidden.push(id);save();applyLayout();renderChoices();return}
 const card=e.target.closest('[data-widget-id]');if(!card)return;const id=card.dataset.widgetId;
 if(e.target.closest('[data-widget-remove]')){config.items=config.items.filter(x=>x.id!==id);save();render();renderChoices();return}
 if(e.target.closest('[data-widget-size]')){const item=config.items.find(x=>x.id===id);if(item){item.size=item.size==='large'?'small':'large';save();render()}return}
 if(e.target.closest('[data-widget-play]')){const audio=$('lrGlobalAudio');if(audio){if(audio.paused)audio.play().catch(()=>notify('请先在音乐页面选择歌曲。'));else audio.pause();setTimeout(render,100)}else notify('请先在音乐页面选择歌曲。')}
});
shelf.addEventListener('input',e=>{if(!e.target.matches('[data-widget-note]'))return;const card=e.target.closest('[data-widget-id]'),item=config.items.find(x=>x.id===card?.dataset.widgetId);if(item){item.note=e.target.value;save()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opening)closeChooser();else if(e.key==='Escape'&&editMode)setEditMode(false)});
window.addEventListener('storage',e=>{if(e.key===KEY){read();render();renderChoices()}});
window.addEventListener('lr-home-widgets-refresh',()=>{render()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
// Keep the widgets live when their source components change in the same page.
const liveObserver=new MutationObserver(()=>{if(!document.hidden)render()});
['launcherDays','launcherToday','homePhoto','chatMessages','musicTogetherCurrentSong'].forEach(id=>{const node=$(id);if(node)liveObserver.observe(node,{childList:true,subtree:true,characterData:true,attributes:id==='homePhoto'})});
const globalAudio=$('lrGlobalAudio');if(globalAudio)['play','pause','ended','loadedmetadata'].forEach(ev=>globalAudio.addEventListener(ev,()=>render()));
read();applyLayout();render();
})();
