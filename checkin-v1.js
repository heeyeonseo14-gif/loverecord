(()=>{'use strict';
const $=id=>document.getElementById(id);
const SETTINGS_KEY='yanyan-love-settings-v5', API_KEY='love-record-api-active-v1', LEGACY_API_KEY='love-record-api-settings-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emptyData=()=>({activities:[],messages:[],contacts:[],songs:[],notes:[],calendar:[],photos:[],browserHistory:[],xhsNotes:[]});
let selected=null,data=emptyData();
function readJSON(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??fallback}catch{return fallback}}
async function getPeople(){
 const merge=(base,extra)=>{const map=new Map();[...(Array.isArray(extra)?extra:[]),...(Array.isArray(base)?base:[])].forEach(p=>{if(p&&p.id)map.set(String(p.id),p)});return [...map.values()]};
 let state=readJSON(SETTINGS_KEY,{});
 let people=Array.isArray(state.people)?state.people:[];
 try{people=merge(people,readJSON('love-record-people-recovery-v1',[]))}catch{}
 // LOVE RECORD's canonical durable state store.
 try{
  const kv=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('love-record-kv-v1');
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('settings'))req.result.createObjectStore('settings')};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  if(kv.objectStoreNames.contains('settings')){
   const full=await new Promise((resolve,reject)=>{const req=kv.transaction('settings','readonly').objectStore('settings').get('love-record-full-state-v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   if(full&&Array.isArray(full.people))people=merge(people,full.people);
  }
 }catch(e){console.warn('[CHECK IN] LOVE RECORD full-state fallback unavailable',e)}
 // Dedicated contact database, using the exact DB/store names from the homepage.
 try{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('love-record-contact-db-v1');
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('people'))req.result.createObjectStore('people',{keyPath:'id'})};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  if(db.objectStoreNames.contains('people')){
   const rows=await new Promise((resolve,reject)=>{const req=db.transaction('people','readonly').objectStore('people').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});
   people=merge(people,rows);
  }
 }catch(e){console.warn('[CHECK IN] contact database unavailable',e)}
 return people.filter(p=>p&&p.id&&String(p.name||'').trim()&&String(p.id)!=='p-yanyan');
}
function getApi(){let c=readJSON(API_KEY,null);if(c&&c.apiBase&&c.apiKey&&c.apiModel)return c;c=readJSON(LEGACY_API_KEY,null);if(c&&c.apiBase&&c.apiKey&&c.apiModel)return c;const s=readJSON(SETTINGS_KEY,{});return s.apiBase&&s.apiKey&&s.apiModel?{apiBase:s.apiBase,apiKey:s.apiKey,apiModel:s.apiModel}:null}
function storeKey(id){return 'love-record-checkin-v1:'+encodeURIComponent(String(id))}
function loadPhone(p){selected=p;data=readJSON(storeKey(p.id),emptyData());$('personName').textContent=(p.name||'联系人')+' 的手机';$('sideName').textContent=(p.name||'联系人')+' 的手机';$('deviceName').textContent=p.name+' 的手机';$('personAvatar').textContent=(p.name||'?').trim().charAt(0);$('apiState').textContent=getApi()?'API 已连接':'请先配置主页 API';renderData();show('home')}
function save(){if(selected)try{localStorage.setItem(storeKey(selected.id),JSON.stringify(data))}catch(e){toast('手机数据保存失败：浏览器储存空间不足')}}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const el=$(view+'View');if(el)el.classList.add('active');if(!el)return;const head=el.querySelector('.backline');if(!head)return;let action=head.querySelector('.checkin-generate');if(view==='contacts'||view==='home'){action?.remove();return}if(!action){action=document.createElement('button');action.className='checkin-generate';action.type='button';action.title='调用主页 API 生成内容';action.setAttribute('aria-label','生成内容');action.innerHTML='✧';head.appendChild(action);action.addEventListener('click',()=>generateForApp(view,action))}}
async function renderContacts(){const box=$('contactPicker');box.innerHTML='<div class="empty">正在同步联系人…</div>';const people=await getPeople();if(!people.length){box.innerHTML='<div class="empty">暂时没有读取到联系人。请确认 LOVE RECORD 联系人已保存，然后重新进入查岗。</div>';return}box.innerHTML=people.map(p=>`<button class="list-item" data-contact-id="${esc(p.id)}" style="width:100%;background:none;text-align:left"><span class="list-avatar">${esc((p.name||'?').trim().charAt(0))}</span><span class="list-main"><b>${esc(p.name)}</b><p>${esc(p.role||'AI 联系人')} · 独立手机空间</p></span><span style="color:#ad9a85">›</span></button>`).join('');box.querySelectorAll('[data-contact-id]').forEach(b=>b.addEventListener('click',()=>{const p=people.find(x=>String(x.id)===b.dataset.contactId);if(p)loadPhone(p)}))}
function row(icon,title,detail,time){return `<div class="list-item"><div class="list-avatar">${esc(icon)}</div><div class="list-main"><b>${esc(title)}</b><p>${esc(detail||'')}</p></div><time>${esc(time||'')}</time></div>`}
function activityMarkup(items){return items.length?items.map(a=>`<div class="activity-row"><div class="activity-dot">${esc(a.icon||'◦')}</div><div class="activity-copy"><b>${esc(a.title)}</b><p>${esc(a.detail||'')}</p><time>${esc(a.time||'')}</time></div></div>`).join(''):'<div class="empty">暂无活动记录。可以在主页 API 配置完成后生成活动。</div>'}
function renderData(){
 if($('activityAll'))$('activityAll').innerHTML=activityMarkup(data.activities);
 $('statActivities').textContent=String(data.activities.length).padStart(2,'0');$('statUnread').textContent=String(data.messages.length).padStart(2,'0');$('statPhotos').textContent=String(data.photos.length).padStart(2,'0');
 $('messageList').innerHTML=data.messages.map(x=>row('▤',x.name||'聊天',x.text,x.time)).join('')||'<div class="empty">暂无聊天记录。</div>';
 $('contactList').innerHTML=data.contacts.map(x=>row('♙',x.name,x.note,x.time)).join('')||'<div class="empty">暂无手机联系人。</div>';
 $('musicList').innerHTML=data.songs.map(x=>row('♫',x.name,x.artist,'')).join('')||'<div class="empty">暂无播放记录。</div>';
 $('noteList').innerHTML=data.notes.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.body)}</p></article>`).join('')||'<div class="empty">暂无备忘录。</div>';
 $('calendarList').innerHTML=data.calendar.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></article>`).join('')||'<div class="empty">暂无日程。</div>';
 $('songTitle').textContent=data.songs[0]?.name||'暂无播放记录';$('songArtist').textContent=data.songs[0]?.artist||'';
 $('photoGrid').innerHTML=data.photos.length?data.photos.map((p,i)=>`<div class="photo">${esc(typeof p==='string'?p:(p.title||'照片'))}</div>`).join(''):'<div class="empty" style="grid-column:1/-1">暂无照片。</div>';
}
async function generateForApp(view,button){if(!selected){toast('请先选择联系人');return}const cfg=getApi();if(!cfg){toast('请先在 LOVE RECORD 主页配置 API');return}const labels={messages:'聊天记录',photos:'相册照片',music:'音乐播放记录',contactsApp:'手机联系人',calendar:'日历安排',notes:'备忘录',browser:'浏览记录',xiaohongshu:'小红书笔记',activity:'手机活动'};const label=labels[view]||'手机内容';button.disabled=true;button.classList.add('loading');button.innerHTML='…';toast('正在生成....');const prompt=`请为 LOVE RECORD 查岗中的当前 AI 联系人生成 1-2 条真实自然的${label}示例数据。角色名称：${selected.name||''}；角色身份：${selected.role||''}；角色设定：${selected.persona||selected.personality||''}；背景：${selected.background||''}；指令：${selected.instructions||''}。必须符合角色设定，不要假设性别关系，不要重复已有内容。请只返回 JSON 数组，数组每项字段：title、body、time、detail、name、text、artist、url。按当前 APP 内容选择合适字段。`;try{const base=String(cfg.apiBase).replace(/\/+$/,'');const res=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey},body:JSON.stringify({model:cfg.apiModel,messages:[{role:'system',content:'你是 LOVE RECORD 手机内容生成器，只返回有效 JSON。'}, {role:'user',content:prompt}],temperature:.8,max_tokens:800,stream:false})});const raw=await res.text();if(!res.ok)throw new Error('HTTP '+res.status);const obj=JSON.parse(raw);let content=obj.choices?.[0]?.message?.content||'';if(Array.isArray(content))content=content.map(x=>x.text||'').join('');content=String(content).replace(/```json|```/gi,'').trim();const a=content.indexOf('['),b=content.lastIndexOf(']');if(a<0||b<a)throw new Error('返回格式不正确');const rows=JSON.parse(content.slice(a,b+1));if(!Array.isArray(rows)||!rows.length)throw new Error('没有生成内容');const stamp=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});const add=(arr,mapper)=>{data[arr]=[...rows.slice(0,2).map(x=>mapper(x,stamp)),...(data[arr]||[])].slice(0,80)};if(view==='messages')add('messages',x=>({name:x.name||'新消息',text:x.text||x.body||x.title||'',time:x.time||stamp}));else if(view==='photos')add('photos',x=>({title:x.title||'新照片',detail:x.detail||x.body||'',time:x.time||stamp}));else if(view==='music')add('songs',x=>({name:x.title||x.name||'新曲目',artist:x.artist||x.detail||''}));else if(view==='contactsApp')add('contacts',x=>({name:x.name||x.title||'联系人',note:x.detail||x.body||'',time:x.time||stamp}));else if(view==='calendar')add('calendar',x=>({time:x.time||stamp,title:x.title||'日程安排',detail:x.detail||x.body||''}));else if(view==='notes')add('notes',x=>({title:x.title||'新备忘录',body:x.body||x.detail||'',time:x.time||stamp}));else if(view==='browser')add('browserHistory',x=>({title:x.title||'浏览记录',url:x.url||x.detail||'',time:x.time||stamp}));else if(view==='xiaohongshu')add('xhsNotes',x=>({title:x.title||'新笔记',body:x.body||x.detail||'',time:x.time||stamp}));else add('activities',x=>({time:x.time||stamp,icon:'✧',title:x.title||'手机活动',detail:x.detail||x.body||''}));save();renderData();renderBrowser();renderXhs();toast('生成完成');}catch(e){toast('生成失败：'+(e.message||'请检查 API 配置'))}finally{button.disabled=false;button.classList.remove('loading');button.innerHTML='✧'}}
const now=new Date();$('statusTime').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('todayDate').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'2-digit'}).toUpperCase();
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',()=>show('home')));
document.querySelectorAll('[data-contacts]').forEach(b=>b.addEventListener('click',()=>{renderContacts();show('contacts')}));
$('backHome').addEventListener('click',()=>{try{sessionStorage.setItem('lr-skip-intro-once','1')}catch(e){}location.replace('./index.html')});

$('playMusic')?.addEventListener('click',()=>toast('此版本展示播放记录，尚未接入音频播放。'));

renderContacts();show('contacts');
window.__LOVE_RECORD_CHECKIN={getSelected:()=>selected,getData:()=>data,refreshContacts:renderContacts};
})();