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
function loadPhone(p){
 selected=p;
 data=readJSON(storeKey(p.id),emptyData());
 // The sidebar/device-info blocks were intentionally removed from the single-screen design.
 // Only update elements that still exist in the current markup.
 const personName=$('personName');if(personName)personName.textContent=(p.name||'联系人')+' 的手机';
 const personAvatar=$('personAvatar');if(personAvatar)personAvatar.textContent=(p.name||'?').trim().charAt(0);
 const deviceName=$('deviceName');if(deviceName)deviceName.textContent=(p.name||'联系人')+' 的手机';
 const apiState=$('apiState');if(apiState)apiState.textContent=getApi()?'API 已连接':'请先配置主页 API';
 renderData();
 show('home');
}
function save(){if(selected)try{localStorage.setItem(storeKey(selected.id),JSON.stringify(data))}catch(e){toast('手机数据保存失败：浏览器储存空间不足')}}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const el=$(view+'View');if(el)el.classList.add('active');if(!el)return;const head=el.querySelector('.backline');if(!head)return;let action=head.querySelector('.checkin-generate');if(view==='contacts'||view==='home'){action?.remove();return}if(!action){action=document.createElement('button');action.className='checkin-generate';action.type='button';action.title='调用主页 API 生成内容';action.setAttribute('aria-label','生成内容');action.innerHTML='✧';head.appendChild(action);action.addEventListener('click',()=>generateForApp(view,action))}}
async function renderContacts(){
 const box=$('contactPicker');
 if(!box)return;
 box.innerHTML='<div class="empty">正在同步联系人…</div>';
 const people=await getPeople();
 if(!people.length){
  box.innerHTML='<div class="empty">暂时没有读取到联系人。请确认 LOVE RECORD 联系人已保存，然后重新进入查岗。</div>';
  return;
 }
 box.innerHTML=people.map(p=>`<button type="button" class="list-item checkin-contact-button" data-contact-id="${esc(p.id)}" style="width:100%;background:none;text-align:left;position:relative;z-index:2;pointer-events:auto;touch-action:manipulation"><span class="list-avatar">${esc((p.name||'?').trim().charAt(0))}</span><span class="list-main"><b>${esc(p.name)}</b><p>${esc(p.role||'AI 联系人')} · 独立手机空间</p></span><span style="color:#ad9a85">›</span></button>`).join('');
 // Delegate from the stable container so replacing list markup never loses the tap handler.
 box.onclick=(event)=>{
  const button=event.target.closest('[data-contact-id]');
  if(!button||!box.contains(button))return;
  event.preventDefault();
  event.stopPropagation();
  const person=people.find(x=>String(x.id)===String(button.dataset.contactId));
  if(person)loadPhone(person);
 };
 box.querySelectorAll('[data-contact-id]').forEach(button=>{
  button.addEventListener('keydown',event=>{
   if(event.key==='Enter'||event.key===' '){event.preventDefault();button.click()}
  });
 });
}
function row(icon,title,detail,time,hideTime=false){return `<div class="list-item"><div class="list-avatar">${esc(icon)}</div><div class="list-main"><b>${esc(title)}</b><p>${esc(detail||'')}</p></div>${hideTime?'':`<time>${esc(time||'')}</time>`}</div>`}
function activityMarkup(items){return items.length?items.map(a=>`<div class="activity-row"><div class="activity-dot">${esc(a.icon||'◦')}</div><div class="activity-copy"><b>${esc(a.title)}</b><p>${esc(a.detail||'')}</p><time>${esc(a.time||'')}</time></div></div>`).join(''):'<div class="empty">暂无活动记录。可以在主页 API 配置完成后生成活动。</div>'}
function openChatThread(index){
 const item=data.messages[index];if(!item)return;
 let modal=$('chatThreadModal');
 if(!modal){modal=document.createElement('div');modal.id='chatThreadModal';modal.className='chat-thread-modal';modal.innerHTML='<div class="chat-thread-panel"><div class="chat-thread-head"><button type="button" id="closeChatThread">‹</button><div><b id="chatThreadName"></b><small>聊天记录</small></div></div><div id="chatThreadBody" class="chat-thread-body"></div></div>';document.body.appendChild(modal);$('closeChatThread').onclick=()=>modal.classList.remove('open');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')})}
 $('chatThreadName').textContent=item.contactName||item.name||'联系人';
 $('chatThreadBody').innerHTML=(item.messages||[]).map(m=>`<div class="chat-bubble-row ${m.fromMe?'mine':''}"><div class="chat-bubble">${esc(m.text||'')}</div></div>`).join('')||'<div class="empty">暂无聊天内容。</div>';
 modal.classList.add('open');
}
function renderBrowser(){
 const box=$('browserHistory');if(!box)return;
 box.innerHTML=data.browserHistory.length?data.browserHistory.map(x=>`<article class="browser-entry"><b>${esc(x.title||'浏览记录')}</b><p>${esc(x.url||'')}</p><small>${esc(x.detail||'')}</small></article>`).join(''):'<div class="empty">暂无浏览记录。</div>';
}
function renderXhs(){
 const box=$('xhsFeed');if(!box)return;
 box.innerHTML=data.xhsNotes.length?data.xhsNotes.map(x=>`<article class="glass xhs-entry"><div class="eyebrow">${esc(x.author||'推荐内容')}</div><h3>${esc(x.title||'生活笔记')}</h3><p>${esc(x.body||'')}</p>${x.tags?.length?`<div class="xhs-tags">${x.tags.map(t=>'#'+esc(t)).join('　')}</div>`:''}</article>`).join(''):'<div class="empty">暂无笔记内容。</div>';
}
function renderData(){
 if($('activityAll'))$('activityAll').innerHTML=activityMarkup(data.activities);
 $('statActivities').textContent=String(data.activities.length).padStart(2,'0');$('statUnread').textContent=String(data.messages.length).padStart(2,'0');$('statPhotos').textContent=String(data.photos.length).padStart(2,'0');
 const ml=$('messageList');if(ml)ml.innerHTML=data.messages.map((x,i)=>`<button type="button" class="list-item message-thread" data-thread-index="${i}"><span class="list-avatar">▤</span><span class="list-main"><b>${esc(x.contactName||x.name||'联系人')}</b><p>${esc(x.preview||x.messages?.[x.messages.length-1]?.text||x.text||'')}</p></span><span class="thread-arrow">›</span></button>`).join('')||'<div class="empty">暂无聊天记录。</div>';
 if(ml)ml.querySelectorAll('[data-thread-index]').forEach(b=>b.addEventListener('click',()=>openChatThread(Number(b.dataset.threadIndex))));
 const cl=$('contactList');if(cl)cl.innerHTML=data.contacts.map(x=>row('♙',x.name,x.note||x.number,'',true)).join('')||'<div class="empty">暂无手机联系人。</div>';
 const music=$('musicList');if(music)music.innerHTML=data.songs.map(x=>row('♫',x.name,x.artist,'')).join('')||'<div class="empty">暂无播放记录。</div>';
 const notes=$('noteList');if(notes)notes.innerHTML=data.notes.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time||'')}</div><b>${esc(x.title)}</b><p>${esc(x.body)}</p></article>`).join('')||'<div class="empty">暂无备忘录。</div>';
 const cal=$('calendarList');if(cal)cal.innerHTML=data.calendar.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time||'')}</div><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></article>`).join('')||'<div class="empty">暂无日程。</div>';
 const songTitle=$('songTitle');if(songTitle)songTitle.textContent=data.songs[0]?.name||'暂无播放记录';
 const songArtist=$('songArtist');if(songArtist)songArtist.textContent=data.songs[0]?.artist||'';
 const pg=$('photoGrid');if(pg)pg.innerHTML=data.photos.length?data.photos.map(p=>`<div class="photo">${esc(p.title||'照片')}</div>`).join(''):'<div class="empty" style="grid-column:1/-1">暂无照片。</div>';
 renderBrowser();renderXhs();
}
async function getCharacterMemoryContext(){
 if(!selected)return '';
 const parts=[];
 // Current profile and selected character settings are shared with the homepage.
 const profile=[
  ['角色身份',selected.role],['性格',selected.personality],['外貌',selected.appearance],
  ['说话方式',selected.speech],['背景',selected.background],['角色规则',selected.instructions]
 ];
 profile.forEach(([k,v])=>{if(v&&String(v).trim())parts.push(k+'：'+String(v).trim())});
 // Chat settings are stored IndexedDB-first; read the same database/store as the homepage.
 let meta={};
 try{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open('love-record-chat-meta-db-v1');
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  if(db.objectStoreNames.contains('contactMeta')){
   const row=await new Promise((resolve,reject)=>{
    const req=db.transaction('contactMeta','readonly').objectStore('contactMeta').get(String(selected.id));
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
   });
   meta=row?.data||{};
  }
  db.close();
 }catch(e){console.warn('[CHECK IN] character memory DB read skipped',e)}
 // Older builds may still have the legacy metadata in localStorage.
 if(!Object.keys(meta).length){
  try{const all=JSON.parse(localStorage.getItem('love-record-chat-meta-v1')||localStorage.getItem('love-record-chat-meta-v2')||'{}');meta=all[String(selected.id)]||{}}catch{}
 }
 const memoryFields=[
  ['角色长期记忆',meta.longTermMemory],['角色记忆补充',meta.memory],['角色备注',meta.remark],
  ['角色背景补充',meta.characterMemory],['关系与重要约定',meta.relationshipMemory]
 ];
 memoryFields.forEach(([k,v])=>{if(v&&String(v).trim())parts.push(k+'：'+String(v).trim())});
 // Sync the character's selected worldbook only (not every unrelated worldbook).
 try{
  const state=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}');
  const world=(Array.isArray(state.worlds)?state.worlds:[]).find(w=>String(w.id)===String(meta.worldId));
  if(world){
   const entries=Array.isArray(world.entries)?world.entries:[];
   const body=entries.map(e=>[e.note,e.content].filter(Boolean).join('：')).filter(Boolean).join('\n')||
    [world.description,world.locations,world.rules].filter(Boolean).join('\n');
   if(body)parts.push('角色当前启用的世界书《'+(world.name||'未命名')+'》：'+body.slice(0,9000));
  }
 }catch(e){console.warn('[CHECK IN] worldbook context read skipped',e)}
 // Include recent real chat history so generated phone conversations continue established facts and relationships.
 try{
  const threads=JSON.parse(localStorage.getItem('love-record-chat-threads-v2')||'{}');
  const history=Array.isArray(threads[String(selected.id)])?threads[String(selected.id)]:[];
  const recent=history.slice(-24).map(m=>(m.role==='assistant'?'角色':'用户')+'：'+String(m.text||'').trim()).filter(x=>x.length>3);
  if(recent.length)parts.push('最近真实聊天记录（用于保持连续性，不要照抄）：\n'+recent.join('\n').slice(-7000));
 }catch(e){console.warn('[CHECK IN] recent chat context read skipped',e)}
 return parts.join('\n\n').slice(0,14000);
}
async function generateForApp(view,button){
 if(!selected){toast('请先选择联系人');return}
 const cfg=getApi();if(!cfg){toast('请先在 LOVE RECORD 主页配置 API');return}
 const labels={messages:'联系人之间的聊天',photos:'相册照片',music:'音乐播放记录',contactsApp:'手机通讯录中的其他人',calendar:'日历安排',notes:'私人备忘录',browser:'浏览器搜索与浏览记录',xiaohongshu:'小红书笔记',activity:'手机活动'};
 const label=labels[view]||'手机内容';
 button.disabled=true;button.classList.add('loading');button.innerHTML='…';toast('正在生成....');
 const isChat=view==='messages';
 const characterMemory=await getCharacterMemoryContext();
 const prompt=isChat
 ?`请为角色「${selected.name||'当前角色'}」的模拟手机生成5-7个【其他联系人】的聊天会话。绝对不要把手机主人自己列为联系人，也不要把聊天内容写成主人单方面自言自语。每个联系人生成4-6条有来有回的消息，sender只能是联系人名字或“${selected.name||'我'}”，并用fromMe布尔值标记是否由手机主人发送。返回JSON数组，每项格式：{"contactName":"对方姓名","preview":"最近一条消息摘要","messages":[{"sender":"对方姓名","fromMe":false,"text":"消息"},{"sender":"${selected.name||'我'}","fromMe":true,"text":"回复"}]}。对话自然、有上下文、符合人物设定。必须参考以下角色记忆、设定和近期聊天上下文，不能违背已发生的事情，也不能把用户与角色的关系、称呼、共同经历随意改写：\n${characterMemory||'暂无额外记忆资料'}。`
 :`请为角色「${selected.name||'当前角色'}」的模拟手机生成5-7条不同的${label}内容。必须符合角色设定，不要把手机主人自己当作通讯录联系人。只返回JSON数组。${view==='contactsApp'?'每项字段：name（其他人的姓名）、number（随机但格式合理的电话号码）、note（关系或备注）。禁止生成角色本人姓名或本人号码。':''}${view==='browser'?'每项字段：title（搜索标题）、url（网址或域名）、detail（简短浏览摘要）。':''}${view==='xiaohongshu'?'每项字段：author（博主昵称）、title（笔记标题）、body（笔记正文，具体自然）、tags（标签数组）。':''}${view==='photos'?'每项字段：title、detail。':''}${view==='music'?'每项字段：title、artist。':''}${view==='calendar'?'每项字段：title、time、detail。':''}${view==='notes'?'每项字段：title、time、body。':''}${view==='activity'?'每项字段：title、time、detail。':''}请生成一批全新的内容，不要沿用或拼接此前查岗生成的旧内容。角色身份：${selected.role||''}；角色设定：${selected.persona||selected.personality||''}；背景：${selected.background||''}；指令：${selected.instructions||''}。以下是必须参考的角色记忆、设定和近期聊天上下文：\n${characterMemory||'暂无额外记忆资料'}。`;
 try{
  const base=String(cfg.apiBase).replace(/\/+$/,'');
  const res=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey},body:JSON.stringify({model:cfg.apiModel,messages:[{role:'system',content:'你是 LOVE RECORD 查岗手机内容生成器。严格只输出有效 JSON 数组，不要 Markdown 代码块、解释或数组以外的文字。'}, {role:'user',content:prompt}],temperature:.85,max_tokens:5000,stream:false})});
  const raw=await res.text();if(!res.ok)throw new Error('HTTP '+res.status);
  const obj=JSON.parse(raw);let content=obj.choices?.[0]?.message?.content||'';
  if(Array.isArray(content))content=content.map(x=>x.text||'').join('');
  content=String(content).replace(/```(?:json)?|```/gi,'').trim();
  const a=content.indexOf('['),b=content.lastIndexOf(']');if(a<0||b<a)throw new Error('返回格式不正确');
  const rows=JSON.parse(content.slice(a,b+1));if(!Array.isArray(rows)||!rows.length)throw new Error('没有生成内容');
  const stamp=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  const replace=(arr,items)=>{data[arr]=items};
  if(isChat){
   const chats=rows.slice(0,7).map((x,i)=>({contactName:String(x.contactName||x.name||`联系人${i+1}`),preview:String(x.preview||x.messages?.at?.(-1)?.text||'新消息'),messages:(Array.isArray(x.messages)?x.messages:[]).slice(0,6).map(m=>({sender:String(m.sender||x.contactName||'联系人'),fromMe:!!m.fromMe,text:String(m.text||'')}))}));
   replace('messages',chats);
  }else if(view==='photos')replace('photos',rows.slice(0,7).map(x=>({title:x.title||'新照片',detail:x.detail||x.body||'',time:stamp})));
  else if(view==='music')replace('songs',rows.slice(0,7).map(x=>({name:x.title||x.name||'新曲目',artist:x.artist||x.detail||''})));
  else if(view==='contactsApp')replace('contacts',rows.slice(0,7).map((x,i)=>({name:String(x.name||`联系人${i+1}`),number:String(x.number||''),note:String(x.note||x.detail||'')})));
  else if(view==='calendar')replace('calendar',rows.slice(0,7).map(x=>({time:x.time||stamp,title:x.title||'日程安排',detail:x.detail||x.body||''})));
  else if(view==='notes')replace('notes',rows.slice(0,7).map(x=>({title:x.title||'新备忘录',body:x.body||x.detail||'',time:x.time||stamp})));
  else if(view==='browser')replace('browserHistory',rows.slice(0,7).map(x=>({title:x.title||'搜索记录',url:x.url||'',detail:x.detail||''})));
  else if(view==='xiaohongshu')replace('xhsNotes',rows.slice(0,7).map(x=>({author:x.author||'推荐博主',title:x.title||'生活笔记',body:x.body||x.detail||'',tags:Array.isArray(x.tags)?x.tags:[]})));
  else replace('activities',rows.slice(0,7).map(x=>({time:x.time||stamp,icon:'✧',title:x.title||'手机活动',detail:x.detail||x.body||''})));
  save();renderData();toast(`生成完成 · ${Math.min(rows.length,7)} 条`);
 }catch(e){toast('生成失败：'+(e.message||'请检查 API 配置'))}
 finally{button.disabled=false;button.classList.remove('loading');button.innerHTML='✧'}
}
const now=new Date();$('statusTime').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('todayDate').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'2-digit'}).toUpperCase();
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',()=>show('home')));
document.querySelectorAll('[data-contacts]').forEach(b=>b.addEventListener('click',()=>{renderContacts();show('contacts')}));
$('backHome').addEventListener('click',()=>{try{sessionStorage.setItem('lr-skip-intro-once','1')}catch(e){}location.replace('./index.html')});

$('playMusic')?.addEventListener('click',()=>toast('此版本展示播放记录，尚未接入音频播放。'));

renderContacts();show('contacts');
window.__LOVE_RECORD_CHECKIN={getSelected:()=>selected,getData:()=>data,refreshContacts:renderContacts};
})();