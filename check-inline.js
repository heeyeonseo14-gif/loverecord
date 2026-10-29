
const DB_NAME='yanyan-love-v5', STORE='images', SETTINGS_KEY='yanyan-love-settings-v5';
const defaults={language:'zh',name:'用户',partner:'YAN HUAN',startDate:'',today:'把今天也留在这里。',apiBase:'',apiKey:'',apiModel:'',modelList:[],memoryOn:true,events:[],selfPersonas:[],people:[],worlds:[],forumPosts:[],journal:[],spaces:[]};
let state=Object.assign({},defaults,(()=>{let saved={};try{saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}}catch(e){console.warn('[LOVE RECORD] settings JSON unreadable',e)}try{const api=JSON.parse(localStorage.getItem('love-record-api-settings-v1')||'{}');saved={...saved,...Object.fromEntries(Object.entries(api).filter(([k,v])=>v!==undefined&&v!==null&&v!==''))}}catch{}return saved})());
// Contact-save recovery store: protects contacts if the main settings blob hits storage quota.
const CONTACT_RECOVERY_KEY='love-record-people-recovery-v1';
try {
 const recovered=JSON.parse(localStorage.getItem(CONTACT_RECOVERY_KEY)||'[]');
 if(Array.isArray(recovered)&&recovered.length){
   const current=Array.isArray(state.people)?state.people:[];
   const byId=new Map(current.map(p=>[String(p.id),p]));
   recovered.forEach(p=>{if(p&&p.id)byId.set(String(p.id),p)});
   state.people=Array.from(byId.values());
 }
} catch(e){console.warn('[LOVE RECORD] contact recovery read failed',e)}
// Independent IndexedDB store for contacts. It does not depend on localStorage quota.
const CONTACT_DB_NAME='love-record-contact-db-v1', CONTACT_DB_STORE='people';
let contactDBPromise=null;
function openContactDB(){
 if(contactDBPromise)return contactDBPromise;
 contactDBPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(CONTACT_DB_NAME,1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(CONTACT_DB_STORE))db.createObjectStore(CONTACT_DB_STORE,{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('联系人数据库打开失败'));
 });
 return contactDBPromise;
}
async function savePeopleToIndexedDB(people){
 const db=await openContactDB();
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(CONTACT_DB_STORE,'readwrite'),store=tx.objectStore(CONTACT_DB_STORE);
  store.clear();(Array.isArray(people)?people:[]).forEach(person=>{if(person&&person.id)store.put(person)});
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('联系人数据库写入失败'));tx.onabort=()=>reject(tx.error||new Error('联系人数据库写入中断'));
 });
}
async function loadPeopleFromIndexedDB(){
 const db=await openContactDB();
 return await new Promise((resolve,reject)=>{
  const req=db.transaction(CONTACT_DB_STORE,'readonly').objectStore(CONTACT_DB_STORE).getAll();
  req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error('联系人数据库读取失败'));
 });
}
async function removePersonFromIndexedDB(id){
 const db=await openContactDB();
 await new Promise((resolve,reject)=>{const tx=db.transaction(CONTACT_DB_STORE,'readwrite');tx.objectStore(CONTACT_DB_STORE).delete(String(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('联系人删除失败'))});
}
// Restore contact profiles independently at startup; do not overwrite current profile edits.
(async()=>{
 try{
  const stored=await loadPeopleFromIndexedDB();
  if(stored.length){
   const map=new Map((Array.isArray(state.people)?state.people:[]).map(x=>[String(x.id),x]));
   stored.forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});
   state.people=Array.from(map.values());
  }
 }catch(e){console.warn('[LOVE RECORD] IndexedDB contacts unavailable',e)}
})();
function persistPeopleRecovery(){
 try { localStorage.setItem(CONTACT_RECOVERY_KEY,JSON.stringify(Array.isArray(state.people)?state.people:[])); return true; }
 catch(e){ console.error('[LOVE RECORD] contact recovery save failed',e); return false; }
}

let db=null, deferredPrompt=null, aiBusy=false;
const $=id=>document.getElementById(id);
function save(){
 const full=JSON.stringify(state);
 try{localStorage.setItem(SETTINGS_KEY,full);try{localStorage.setItem('love-record-api-settings-v1',JSON.stringify({apiBase:state.apiBase,apiKey:state.apiKey,apiModel:state.apiModel}))}catch{}return true}
 catch(err){
  console.warn('[LOVE RECORD] settings quota exceeded; preserving existing full snapshot',err);
  // Never overwrite the user's complete state with a compact snapshot that drops history/worlds.
  try{localStorage.setItem('love-record-api-settings-v1',JSON.stringify({apiBase:state.apiBase,apiKey:state.apiKey,apiModel:state.apiModel}))}catch(e){console.warn('[LOVE RECORD] API settings local persistence also full',e)}
  try{persistPeopleRecovery()}catch(e){}
  try{savePeopleToIndexedDB(state.people||[]).catch(e=>console.warn('[LOVE RECORD] people backup failed',e))}catch(e){}
  return false;
 }
}
// Clean legacy/deleted and empty placeholder contacts once, preserving real contacts and chat history.
const isInvalidContact=p=>{
  if(!p||typeof p!=='object')return true;
  const id=String(p.id||'').trim().toLowerCase();
  const name=String(p.name||'').trim().toLowerCase();
  return id==='p-yanyan'||!name||name==='ai character';
};
state.people=(Array.isArray(state.people)?state.people:[]).filter(p=>!isInvalidContact(p));
save();
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>$('toast').classList.remove('show'),1800)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});s.createIndex('type','type')}};r.onsuccess=e=>{db=e.target.result;resolve()};r.onerror=()=>reject(r.error)})}
function getImages(type){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).index('type').getAll(type);r.onsuccess=()=>resolve(r.result.reverse());r.onerror=()=>reject(r.error)})}
function addImage(type,blob,note){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).add({type,blob,note,date:new Date().toLocaleDateString('en-CA')});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function deleteImage(id){return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);r.onsuccess=resolve;r.onerror=()=>reject(r.error)})}
function daysTogether(){if(!state.startDate)return 0;const s=new Date(state.startDate+'T00:00:00');const n=new Date();s.setHours(0,0,0,0);n.setHours(0,0,0,0);return Math.max(0,Math.floor((n-s)/86400000))}
function renderHome(){
  const days=$('launcherDays'),today=$('launcherToday'),photo=$('homePhoto');
  if(days)days.textContent=daysTogether();
  if(today)today.textContent=state.today||defaults.today;
  if(photo)getImages('home').then(a=>{
    photo.innerHTML=a[0]?'<img src="'+URL.createObjectURL(a[0].blob)+'" alt="">':'<span class="polaroid-placeholder">＋</span>';
  });
}

const CHAT_CONTACTS_KEY='love-record-chat-contacts-v2';
const CHAT_THREADS_KEY='love-record-chat-threads-v2';
const CHAT_META_KEY='love-record-chat-meta-v1';
let activeChatContactId='';
let editingChatMeta={remark:'',avatar:'',background:'#f7f3f9',backgroundImage:''};
function readChatMeta(){try{if(window.readChatMeta&&typeof window.readChatMeta==='function')return window.readChatMeta();return JSON.parse(localStorage.getItem(CHAT_META_KEY)||'{}')}catch{return {}}}
function chatMeta(id){try{if(window.chatMeta&&typeof window.chatMeta==='function')return window.chatMeta(id)}catch(e){}const all=readChatMeta();return {...(all[id]||{})}}
function writeChatMeta(id,data){if(window.writeChatMeta&&typeof window.writeChatMeta==='function')return window.writeChatMeta(id,data);const all=readChatMeta();all[id]={...(all[id]||{}),...data};try{localStorage.setItem(CHAT_META_KEY,JSON.stringify(all))}catch(e){console.error(e);toast('保存失败：浏览器空间不足')}return all[id]}
function chatShownName(p){return chatMeta(p.id).remark||p.name||'未命名联系人'}
function chatAvatarMarkup(p,small=false){const meta=chatMeta(p.id),name=chatShownName(p);return meta.avatar?`<img src="${esc(meta.avatar)}" alt="${esc(name)}">`:esc((name||'♡').slice(0,1))}
const CHAT_CONTACT_DB='love-record-chat-index-v1', CHAT_CONTACT_STORE='state';
let chatContactIdsCache=[];
function openChatContactIndexDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(CHAT_CONTACT_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(CHAT_CONTACT_STORE))req.result.createObjectStore(CHAT_CONTACT_STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('聊天联系人索引数据库打开失败'))})}
async function saveChatContactIdsIndexedDB(ids){const db=await openChatContactIndexDB();const value=[...new Set((ids||[]).map(String))];return new Promise((resolve,reject)=>{const tx=db.transaction(CHAT_CONTACT_STORE,'readwrite');tx.objectStore(CHAT_CONTACT_STORE).put({id:'chat-contact-ids',ids:value,updatedAt:Date.now()});tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error('聊天联系人索引保存失败'));tx.onabort=()=>reject(tx.error||new Error('聊天联系人索引保存中断'))})}
async function loadChatContactIdsIndexedDB(){const db=await openChatContactIndexDB();return new Promise((resolve,reject)=>{const req=db.transaction(CHAT_CONTACT_STORE,'readonly').objectStore(CHAT_CONTACT_STORE).get('chat-contact-ids');req.onsuccess=()=>resolve(Array.isArray(req.result?.ids)?req.result.ids.map(String):[]);req.onerror=()=>reject(req.error||new Error('聊天联系人索引读取失败'))})}
function readChatContacts(){let a=[...chatContactIdsCache];try{const x=JSON.parse(localStorage.getItem(CHAT_CONTACTS_KEY)||'[]');if(Array.isArray(x))a.push(...x)}catch{}try{const b=JSON.parse(localStorage.getItem('love-record-chat-contacts-recovery-v1')||'[]');if(Array.isArray(b))a.push(...b)}catch{}return [...new Set(a.map(String))]}
function writeChatContacts(a){const value=[...new Set((a||[]).map(String))];chatContactIdsCache=value;let saved=false;try{localStorage.setItem(CHAT_CONTACTS_KEY,JSON.stringify(value));saved=true}catch(e){console.warn('[LOVE RECORD] primary chat contacts storage full',e)}try{localStorage.setItem('love-record-chat-contacts-recovery-v1',JSON.stringify(value));saved=true}catch(e){console.warn('[LOVE RECORD] recovery chat contacts storage full',e)}return saved}
(async()=>{try{const [ids,storedPeople]=await Promise.all([loadChatContactIdsIndexedDB(),loadPeopleFromIndexedDB()]);if(storedPeople.length){const map=new Map((Array.isArray(state.people)?state.people:[]).map(x=>[String(x.id),x]));storedPeople.forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});state.people=Array.from(map.values())}if(ids.length){chatContactIdsCache=[...new Set([...chatContactIdsCache,...ids])];try{localStorage.setItem(CHAT_CONTACTS_KEY,JSON.stringify(chatContactIdsCache))}catch{}if(typeof renderChat==='function')renderChat()}}catch(e){console.warn('[LOVE RECORD] chat contact index restore skipped',e)}})();

function readChatThreads(){try{return JSON.parse(localStorage.getItem(CHAT_THREADS_KEY)||'{}')}catch{return {}}}
function writeChatThreads(a){localStorage.setItem(CHAT_THREADS_KEY,JSON.stringify(a))}
function contactById(id){return (state.people||[]).find(p=>String(p.id)===String(id))}
function renderChatMessageContent(value, role){
 const raw=String(value==null?'':value);
 const orderMatch=raw.match(/^\[\[\s*LR_ORDER\s*\|\s*(food|shop)\s*\|([^\]]*)\]\]$/i);
 if(orderMatch){
  const food=orderMatch[1].toLowerCase()==='food',kind=food?'外卖订单':'购物订单',parts=orderMatch[2].split('|').map(x=>x.trim());
  let sender='',recipient='',title='订单已创建',detail='',total='￥0.00';
  // 支持新版 sender|recipient|orderNo|items|total 与旧版 sender|orderNo|items|total。
  if(parts.length>=5){[sender,recipient,title,detail,total]=parts;}
  else if(parts.length===4){[sender,title,detail,total]=parts;recipient=(role==='user'&&typeof activeChatContactId!=='undefined'&&typeof contactById==='function'?(contactById(activeChatContactId)?.name||''):'');}
  else {sender=parts[0]||'';title=parts[1]||'订单已创建';detail=parts[2]||'';total=parts[3]||'￥0.00';}
  const headline=role==='user'?'你给'+(recipient||'TA')+(food?'点了外卖':'买了物品'):(sender&&sender!=='你'?sender:'TA')+(food?'给你点了外卖':'给你买了物品');
  total=String(total||'￥0.00').trim().replace(/^(?:RMB|CNY|CN¥|RM|MYR)\s*/i,'￥').replace(/^[¥￥]\s*/,'￥');
  return '<article class="chat-order-card glass-order-card"><div class="order-kicker"><span>LOVE RECORD</span><span>✦ '+kind+'</span></div><div class="order-main"><div class="order-title">'+esc(headline)+'</div><div class="order-number">'+esc(title)+'</div><div class="order-meta">'+esc(detail)+'</div><div class="order-total"><span>订单金额</span><strong>'+esc(total)+'</strong></div><div class="order-footnote">订单已同步至 '+(food?'Foodie':'Orange Market')+'</div></div></article>';
 }
 if(role!=='assistant')return esc(raw);
 const token=/\[\[NARRATION\]\]([\s\S]*?)\[\[\/NARRATION\]\]/gi;
 let out='',last=0,match;
 while((match=token.exec(raw))){out+=esc(raw.slice(last,match.index));out+='<em class="lr-inline-narration">'+esc(match[1].trim())+'</em>';last=token.lastIndex;}
 out+=esc(raw.slice(last));
 return out.replace(/\n/g,'<br>');
}
function renderChat(){
 const ids=readChatContacts().filter((id,i,a)=>a.indexOf(id)===i&&contactById(id));
 const list=$('chatContacts'),conversation=$('chatConversation');
 const detail=!!activeChatContactId&&ids.includes(activeChatContactId);
 $('chat').classList.toggle('is-conversation',detail);
 document.body.classList.toggle('chat-conversation-open',detail);
 $('systemAppbarAction').hidden=false;
 if(!detail){
  activeChatContactId='';conversation.hidden=true;list.hidden=false;
  $('systemAppTitle').textContent='CHAT';
  $('systemAppbarAction').innerHTML='＋';$('systemAppbarAction').setAttribute('aria-label','添加联系人');
  const topBack=document.querySelector('#systemAppbar .system-back');
  if(topBack){topBack.setAttribute('data-launch-home','');topBack.onclick=null;}
  list.innerHTML=ids.length?ids.map(id=>{const p=contactById(id),thread=readChatThreads()[id]||[],last=thread[thread.length-1];return `<button class="chat-contact-card" type="button" data-chat-open="${esc(id)}"><span class="chat-contact-avatar">${chatAvatarMarkup(p)}</span><span class="chat-contact-info"><strong>${esc(chatShownName(p))}</strong><span>${esc(last?last.text:(p.role||p.personality||'开始聊天'))}</span></span><span class="chat-contact-time">${last?'最近':' '}</span></button>`}).join(''):'<div class="chat-empty">这里还没有联系人。<br>添加你的人物，开始第一段对话吧 ♡<br><button class="btn primary" type="button" id="chatEmptyAdd">＋ 添加联系人</button></div>';
  return;
 }
 list.hidden=true;conversation.hidden=false;
 const p=contactById(activeChatContactId),meta=chatMeta(activeChatContactId);
 const topBack=document.querySelector('#systemAppbar .system-back');
 $('systemAppTitle').textContent=chatShownName(p);
 $('systemAppbarAction').innerHTML='⚙';$('systemAppbarAction').setAttribute('aria-label','聊天设置');
 const chatSurface=$('chatMessages'),conversationSurface=$('chatConversation');
 const chatBg=meta.backgroundImage ? 'url(\"'+meta.backgroundImage+'\")' : 'none';
 /* Apply the wallpaper to the complete conversation surface, including the area behind the composer. */
 conversationSurface.style.setProperty('background-color',meta.background||'#f7f3f9','important');
 conversationSurface.style.setProperty('background-image',chatBg,'important');
 conversationSurface.style.setProperty('background-size','cover','important');
 conversationSurface.style.setProperty('background-position','center center','important');
 conversationSurface.style.setProperty('background-repeat','no-repeat','important');
 conversationSurface.style.setProperty('background-attachment','fixed','important');
 chatSurface.style.setProperty('background-color','transparent','important');
 chatSurface.style.setProperty('background-image','none','important');
 chatSurface.style.setProperty('background-size','cover','important');
 chatSurface.style.setProperty('background-position','center center','important');
 chatSurface.style.setProperty('background-repeat','no-repeat','important');
 chatSurface.style.setProperty('background-attachment','fixed','important'); chatSurface.style.setProperty('filter','none','important');
 if(topBack){topBack.removeAttribute('data-launch-home');topBack.onclick=()=>{activeChatContactId='';renderChat()};}
 $('chatPersonAvatar').textContent=(p.name||'♡').slice(0,1);$('chatPersonName').textContent=p.name||'未命名联系人';$('chatPersonRole').textContent=p.role||'AI 联系人';
 const threads=readChatThreads(),items=threads[activeChatContactId]||[];
 let previousAt=null;
 $('chatMessages').innerHTML=items.length?items.map(m=>{const at=Number(m.at)||null;let divider='';if(at&&previousAt&&at-previousAt>=10*60*1000){const d=new Date(at);divider='<div class="lr-chat-time-divider"><span>'+d.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})+'</span></div>';}if(at)previousAt=at;return divider+'<div class="chat-message-row '+(m.role==='user'?'user':'ai')+'"><span class="chat-message-avatar">'+(m.role==='user'?'我':chatAvatarMarkup(p,true))+'</span><div class="chat-bubble '+(m.role==='user'?'user':'ai')+'">'+renderChatMessageContent(m.text,m.role)+'</div></div>';}).join(''):'<div class="chat-empty-inline">还没有消息，发送第一句话吧 ♡</div>';
 $('chatMessages').scrollTop=$('chatMessages').scrollHeight;
 $('chatHint').textContent=state.apiBase&&state.apiKey&&state.apiModel?'已连接 AI · 对话记录仅保存在本设备':'请先在设置中连接 API，连接后即可和联系人聊天。';
}
function openChatContact(id){if(!readChatContacts().includes(id))return;activeChatContactId=id;renderChat()}
function openChatSettings(){
 if(!activeChatContactId)return;
 const p=contactById(activeChatContactId);if(!p)return;
 editingChatMeta={remark:chatMeta(activeChatContactId).remark||'',avatar:chatMeta(activeChatContactId).avatar||'',background:chatMeta(activeChatContactId).background||'#f7f3f9',backgroundImage:chatMeta(activeChatContactId).backgroundImage||''};
 $('chatRemarkInput').value=editingChatMeta.remark;
 $('chatSettingsAvatarPreview').innerHTML=editingChatMeta.avatar?'<img src="'+editingChatMeta.avatar+'" alt="">':esc((chatShownName(p)||'♡').slice(0,1));
 document.querySelectorAll('.chat-bg-option').forEach(b=>b.classList.toggle('active',b.dataset.chatBg===editingChatMeta.background&&!editingChatMeta.backgroundImage));
 $('chatSettingsScreen').classList.add('show');$('chatSettingsScreen').setAttribute('aria-hidden','false');$('systemAppbar').classList.remove('show');
}
function closeChatSettings(){ $('chatSettingsScreen').classList.remove('show');$('chatSettingsScreen').setAttribute('aria-hidden','true');$('systemAppbar').classList.add('show');renderChat(); }
function imageToChatData(file,max=1800,quality=.92){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',quality))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}
async function saveChatSettings(){editingChatMeta.remark=$('chatRemarkInput').value.trim();try{if(window.saveChatMetaSafely){const saved=await window.saveChatMetaSafely(activeChatContactId,editingChatMeta);editingChatMeta={...saved}}else{writeChatMeta(activeChatContactId,editingChatMeta)}closeChatSettings();toast('聊天设置已保存 ♡')}catch(err){console.error('[LOVE RECORD] chat settings save failed',err);toast('保存失败：'+(err?.message||'请检查浏览器储存空间'))}}
function openChatAdd(){ $('chatAddModal').classList.add('show');document.body.style.overflow='hidden';$('chatPeoplePicker').hidden=true;}
function closeChatAdd(){$('chatAddModal').classList.remove('show');document.body.style.overflow=''}
async function renderChatPeoplePicker(){
 const box=$('chatPeoplePicker'),contacts=readChatContacts();
 try{const stored=await loadPeopleFromIndexedDB();if(stored.length){const map=new Map((state.people||[]).map(x=>[String(x.id),x]));stored.forEach(x=>{if(x&&x.id)map.set(String(x.id),x)});state.people=Array.from(map.values())}}catch(e){console.warn('[LOVE RECORD] picker contact hydrate failed',e)}
 const candidates=(state.people||[]).filter(p=>String(p.id)!=='p-yanyan'&&!contacts.map(String).includes(String(p.id)));
 box.hidden=false;
 box.innerHTML=candidates.length?candidates.map(p=>`<label class="chat-picker-item"><input type="checkbox" value="${esc(p.id)}"><span><b>${esc(p.name)}</b><br><span class="sub">${esc(p.role||p.personality||'AI 人物')}</span></span></label>`).join('')+'<button class="btn primary" id="chatConfirmPeople" type="button" style="width:100%;margin-top:12px">添加选中的联系人</button>':'<div class="module-empty">没有可添加的人物。请先去「联系人」创建人物。</div>'; const confirm=box.querySelector('#chatConfirmPeople');if(confirm){confirm.type='button';confirm.onclick=e=>{e.preventDefault();e.stopPropagation();confirmChatPeople()};}
}
async function confirmChatPeople(){
 const box=$('chatPeoplePicker');
 const selected=[...box.querySelectorAll('input[type=checkbox]')].filter(x=>x.checked).map(x=>String(x.value));
 if(!selected.length){toast('先勾选至少一位联系人');return}
 const ids=readChatContacts().map(String),added=[];
 selected.forEach(pid=>{const person=contactById(pid);if(person&&!ids.includes(String(pid))){ids.push(String(pid));added.push(String(pid))}});
 if(!added.length){toast('所选人物已在聊天联系人中，或人物资料已不存在');return}
 // Persist chat IDs independently from the large settings blob and from localStorage quota.
 let indexedSaved=false;
 try{await saveChatContactIdsIndexedDB(ids);indexedSaved=true}catch(e){console.error('[LOVE RECORD] chat contact index save failed',e)}
 const localSaved=writeChatContacts(ids);
 try{await savePeopleToIndexedDB(state.people||[])}catch(e){console.warn('[LOVE RECORD] profile backup skipped',e)}
 if(!indexedSaved&&!localSaved){toast('联系人未能保存：浏览器存储空间已满，请清理空间后重试');return}
 chatContactIdsCache=[...new Set(ids.map(String))];
 closeChatAdd();activeChatContactId='';renderChat();
 const visible=readChatContacts().filter(id=>contactById(id));
 if(added.some(id=>visible.includes(id)))toast('已添加 '+added.length+' 位联系人 ♡');else toast('联系人索引已保存，正在恢复人物资料…');
}

async function sendChatMessage(){
 const input=$('chatInput'),textValue=input.value.trim();if(!textValue||!activeChatContactId)return;
 const p=contactById(activeChatContactId);if(!p)return;
 const threads=readChatThreads(),items=threads[activeChatContactId]||[];items.push({role:'user',text:textValue,at:Date.now()});threads[activeChatContactId]=items;writeChatThreads(threads);input.value='';renderChat();
 if(!state.apiBase||!state.apiKey||!state.apiModel){toast('请先在设置中连接 API');return}
 const send=$('chatSend');send.disabled=true;send.textContent='…';aiBusy=true;
 try{
  const recent=items.slice(-16).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.text}));
  // Always load the actual saved sticker collection before the one and only API call.
  let savedStickers=[];
  try{
    if(typeof window.lrGetStickerItems==='function') savedStickers=await window.lrGetStickerItems();
    if(!Array.isArray(savedStickers)||!savedStickers.length){
      const local=JSON.parse(localStorage.getItem('love-record-stickers-v1')||'[]');
      if(Array.isArray(local)&&local.length) savedStickers=local;
    }
  }catch(stickerReadError){console.warn('[LOVE RECORD] AI sticker library read failed',stickerReadError);}
  if(!Array.isArray(savedStickers)) savedStickers=[];
  const stickerPrompt=savedStickers.map(x=>`${x.id}（分类：${x.category}${x.name?'；名称：'+x.name:''}）`).join('；');
  const system='你正在 LOVE RECORD 中扮演联系人「'+p.name+'」。身份：'+(p.role||'')+'。性格：'+(p.personality||'')+'。外貌：'+(p.appearance||'')+'。说话方式：'+(p.speech||'')+'。背景：'+(p.background||'')+'。角色规则：'+(p.instructions||'保持人物一致，自然聊天，不要替用户决定行动或情绪。')+'。请像真实聊天对象一样自然回复，不要输出 JSON。若用户明确要求你替 TA 点外卖或买东西，且你愿意主动安排，请在回复末尾另起一行输出机器指令 [[LR_AI_ORDER:food|菜品关键词]] 或 [[LR_AI_ORDER:shop|商品关键词]]；关键词必须是你建议的具体商品名称。不要在未被要求或未明确表达下单意愿时输出指令。订单只是本地模拟、需用户确认地址，不要声称已真实付款或配送。\n用户上传的真实表情包库（只能使用以下 ID）：'+(stickerPrompt||'目前没有可用表情包')+'。你可以像真实聊天一样自主决定是否发送表情包，但必须按当下情绪和语境选择；如要发送，必须在回复中输出独立机器标记 [[LR_STICKER:准确ID]]，ID 必须逐字来自上述清单。一次最多发一张。绝对不要输出「[表情包：…]」「发了一个表情包」等文字来代替标记，也不要编造清单外的表情包；若没有合适的，就不发。前端会把有效标记转换成用户上传的原图消息。';
  const r=await fetchTimeout(state.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:system},...recent],stream:false})},60000);
  const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status+' · '+raw.slice(0,180));const data=JSON.parse(raw);let reply=extractAIText(data);if(!reply)throw new Error('没有收到有效回复');  const stickerMatches=[...reply.matchAll(/\[\[LR_STICKER:([^\]]+)\]\]/gi)].map(m=>String(m[1]).trim()).slice(0,1);
  reply=reply.replace(/\[\[LR_STICKER:[^\]]+\]\]/gi,'').trim();
  // Robust fallback: models sometimes describe a sticker instead of returning the required ID marker.
  const stickerCategories={
    '开心':['开心','高兴','快乐','兴奋','欢呼','喜悦','happy','joy','excited'],
    '伤心':['伤心','难过','哭','哭哭','委屈','眼泪','sad','cry','teary'],
    '生气':['生气','愤怒','恼火','气死','angry','mad'],
    '平静':['平静','淡定','无表情','冷静','祥和','心如止水','波澜不惊','毫无波澜','神态安详','安详','平和','无波澜','calm','neutral','serene'],
    '可爱':['可爱','萌','猫','小猫','狗','小狗','卡皮巴拉','cute','kawaii'],
    '撒娇':['撒娇','求抱抱','贴贴','乖','clingy'],
    '害羞':['害羞','脸红','不好意思','shy','blush'],
    '亲亲':['亲亲','亲吻','kiss'],
    '疑惑':['疑惑','不解','问号','困惑','confused'],
    '无奈':['无奈','无语','叹气','无聊','helpless','bored'],
    '晚安':['晚安','睡觉','困了','goodnight','sleepy']
  };
  const categoryNames=[...new Set([...Object.keys(stickerCategories),...savedStickers.map(x=>String(x.category||''))])].filter(Boolean);
  const findCategory=(text)=>{
    const s=String(text||'').toLowerCase();
    // Explicit user category, e.g. 【平静】表情包, takes priority over a model's embellished description.
    const bracket=s.match(/[【\[（(]\s*([^】\]）)]+)\s*[】\]）)]/);
    if(bracket){const b=bracket[1].trim();if(categoryNames.includes(b))return b;}
    for(const cat of categoryNames){if(s.includes(cat.toLowerCase()))return cat;}
    for(const [cat,words] of Object.entries(stickerCategories)){
      if(words.some(w=>s.includes(w.toLowerCase())) && categoryNames.includes(cat))return cat;
    }
    return '';
  };
  const userAskedSticker=/(?:表情包|贴图|贴纸)/i.test(textValue)&&/(?:发|给我|来一张|来个|发送|用)/i.test(textValue);
  const idFromMarker=stickerMatches.length?savedStickers.find(x=>String(x.id)===stickerMatches[0]):null;
  if(stickerMatches.length&&!idFromMarker)stickerMatches.length=0;
  const filenameMatch=reply.match(/[【\[]([^】\]]+\.(?:png|jpe?g|gif|webp|bmp))】?\]/i)||reply.match(/【([^】]+\.(?:png|jpe?g|gif|webp|bmp))】/i);
  const naturalStickerMention=/(?:表情包|贴图|贴纸)/i.test(reply);
  const cueText=[textValue,reply,filenameMatch?filenameMatch[1]:''].join('\n');
  if(!stickerMatches.length&&savedStickers.length&&(userAskedSticker||naturalStickerMention||/\[表情包[：:]/i.test(reply))){
    let category=findCategory(textValue);
    if(!category)category=findCategory(reply);
    if(!category&&filenameMatch){
      const fn=filenameMatch[1].toLowerCase();
      const byName=savedStickers.find(x=>String(x.name||'').toLowerCase()===fn||String(x.name||'').toLowerCase().includes(fn.replace(/\.(png|jpe?g|gif|webp|bmp)$/i,'')));
      if(byName)stickerMatches.push(String(byName.id));
    }
    if(!stickerMatches.length){
      const matched=category?savedStickers.find(x=>String(x.category||'')===category):null;
      if(matched)stickerMatches.push(String(matched.id));
    }
  }
  // Remove model-only sticker notation. If a real image was matched, also remove the textual fake-sticker narration.
  reply=reply.replace(/\[\[LR_STICKER:[^\]]+\]\]/gi,'')
             .replace(/\[表情包[：:][^\n]*/gi,'')
             .replace(/【[^】]+\.(?:png|jpe?g|gif|webp|bmp)】/gi,'').trim();
  if(stickerMatches.length){
    reply=reply.replace(/[^。！？\n]*表情包[^。！？\n]*[。！？]?/gi,'').trim();
    reply=reply.replace(/(?:配字|文字|字幕)\s*[：:]\s*[^。！？\n]+[。！？]?/gi,'').trim();
  }
  if(!stickerMatches.length&&naturalStickerMention&&!savedStickers.length)console.warn('[LOVE RECORD] AI referenced a sticker but the saved sticker library is empty.');
  const orderMatch=reply.match(/\[\[LR_AI_ORDER:(food|shop)\|([^\]]+)\]\]/i);if(orderMatch&&window.LoveRecordLifeApps?.createAIOrder){reply=reply.replace(orderMatch[0],'').trim();const made=await window.LoveRecordLifeApps.createAIOrder(orderMatch[1].toLowerCase()==='food'?'food':'shop',activeChatContactId,[orderMatch[2].trim()]);if(made.ok){toast('请确认订单地址');}else{toast('暂未找到对应商品，请换个商品名称再试');}}else if(/(?:测试|试一下|测试一下).*(?:外卖|点餐|购物|买东西)|(?:外卖|点餐|购物|买东西).*(?:测试|试一下)/i.test(textValue)&&window.LoveRecordLifeApps?.createAITestOrder){const testKind=/(?:购物|买东西)/.test(textValue)&&!/(?:外卖|点餐)/.test(textValue)?'shop':'food';const made=await window.LoveRecordLifeApps.createAITestOrder(testKind,activeChatContactId);if(made.ok){toast('请确认订单地址');}else{toast('暂未找到可用商品，请检查生活集市商品目录');}}const latest=readChatThreads(),thread=latest[activeChatContactId]||[];if(reply)thread.push({role:'assistant',text:reply,at:Date.now()});if(stickerMatches.length){for(const sid of stickerMatches){const sticker=savedStickers.find(x=>String(x.id)===sid);if(sticker&&sticker.attachmentId!=null)thread.push({role:'assistant',kind:'sticker',attachmentId:sticker.attachmentId,stickerId:String(sticker.id),stickerCategory:sticker.category,text:'[表情包：'+sticker.category+']',at:Date.now()});}}latest[activeChatContactId]=thread;writeChatThreads(latest);
 }catch(err){toast('发送失败：'+(err.message||'API 错误'))}
 finally{aiBusy=false;send.disabled=false;send.textContent='发送';renderChat()}
}


function renderMemories(){getImages('memory').then(a=>{$('memoryGrid').innerHTML=a.length?a.map(x=>'<article class="memory"><div class="photo"><img src="'+URL.createObjectURL(x.blob)+'" alt=""></div><div class="memory-body"><div class="memory-date">'+esc(x.date)+'</div><div class="memory-note">'+esc(x.note||'A little moment.')+'</div><button class="btn" type="button" data-delete="'+x.id+'" style="margin-top:9px;padding:8px 12px">DELETE</button></div></article>').join(''):'<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--muted);font-size:13px">还没有回忆。<br>从一张照片开始吧。</div>'})}
function hourScene(){const h=new Date().getHours();if(h<7)return{place:'BEDROOM',text:'房间里很安静，只有手机屏幕还亮着。',quote:'“这么晚还没睡？”',choices:['走过去坐他旁边','直接钻进被窝','问他在看什么','逗他说“你管我”']};if(h<11)return{place:'KITCHEN',text:'厨房里有一点早餐的香味。',quote:'“醒啦？过来吃一点。”',choices:['坐下来吃早餐','从背后抱住他','偷吃一口','问他今天想去哪']};if(h<18)return{place:'LIVING ROOM',text:'下午的光落在沙发上，他正在挑歌。',quote:'“来，帮我选一首。”',choices:['坐过去一起听','抢走他的手机','问他为什么选这首','靠着他休息']};if(h<23)return{place:'LIVING ROOM',text:'晚上回到家，客厅只留着一盏灯。',quote:'“今天辛苦了。”',choices:['抱他一下','问他今晚想做什么','一起看电影','什么也不说，陪着他']};return{place:'BEDROOM',text:'夜深了。房间里很安静，他还没有睡。',quote:'“怎么还没睡？”',choices:['走过去坐他旁边','直接钻进被窝','问他在想什么','说“我就是想找你”']}}
function activeSpace(){return state.spaces.find(x=>x.id===activeSpaceId)||null}
function activeSpacePerson(){const sp=activeSpace();return state.people.find(p=>p.id===sp?.personId)||state.people[0]||null}
function activeSpaceWorld(){const sp=activeSpace();return state.worlds.find(w=>w.id===sp?.worldId)||null}
function activeSpacePersona(){const sp=activeSpace();return state.selfPersonas.find(p=>p.id===sp?.personaId)||null}
let activeSpaceId='';
let editingSpaceId='';
function cloneObj(x){try{return JSON.parse(JSON.stringify(x))}catch{return null}}
function normalizeSpace(sp){
  if(!Array.isArray(sp.events))sp.events=[];
  if(!Array.isArray(sp.history))sp.history=[];
  if(!sp.history.length && sp.events.length){
    for(let i=0;i<sp.events.length;i++){
      const ev=sp.events[i]||{}; const next=sp.events[i+1]||{};
      const looksUser=i%2===0;
      const turn={id:'turn-'+(sp.id||'space')+'-'+i+'-'+Date.now(),time:ev.time||'',userText:looksUser?(ev.text||''):(ev.text||''),aiText:looksUser&&next?String(next.text||''):'' ,beforeScene:null};
      if(!looksUser) turn.userText='';
      sp.history.push(turn); if(looksUser && next)i++;
    }
    if(sp.history.length)sp.events=sp.history.flatMap(t=>[{text:t.userText,time:t.time},{text:t.aiText||'',time:t.time}]).filter(x=>x.text);
  }
  if(!sp.scene||typeof sp.scene!=='object')sp.scene=null;
  return sp
}
function syncSpaceEvents(sp){if(!sp)return;sp.events=(sp.history||[]).flatMap(t=>{const a=[];if(t.userText)a.push({text:t.userText,time:t.time});if(t.aiText)a.push({text:t.aiText,time:t.time});return a}).slice(-40);state.events=sp.events.slice()}
function historyContext(sp){return (sp?.history||[]).slice(-8).map(t=>{const u=t.userText?'用户：'+t.userText:'';const a=t.aiText?'AI：'+t.aiText:'';return [u,a].filter(Boolean).join('\n')}).join('\n')}
function startHistoryTurn(userText){const sp=activeSpace();if(!sp)return null;normalizeSpace(sp);const turn={id:'turn-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),userText:String(userText||''),aiText:'',beforeScene:cloneObj(sp.scene||baseScene())};sp.history.push(turn);syncSpaceEvents(sp);save();renderOurHistory();return turn.id}
function finishHistoryTurn(id,aiText){const sp=activeSpace();if(!sp)return;const t=sp.history.find(x=>x.id===id);if(t)t.aiText=String(aiText||'');syncSpaceEvents(sp);save();renderOurHistory()}
function renderOurHistory(){const box=$('ourHistoryBody');if(!box)return;const sp=activeSpace();if(!sp){box.innerHTML='<div class="module-empty">先选择一个 AI 人物，再开始 SPACE。</div>';return}normalizeSpace(sp);const list=sp.history||[];const zh=currentLang()==='zh';$('historyCount').textContent=String(list.length);if(!list.length){box.innerHTML='<div class="module-empty">'+(zh?'还没有记录。你们说过的话会留在这里。':'No history yet.')+'</div>';return}box.innerHTML=list.slice().reverse().map(t=>`<details class="our-history-item"><summary>${esc((t.time||'').toString())} · ${esc((t.userText||'').slice(0,48))}</summary><div class="our-history-content"><div class="history-label">${zh?'你':'YOU'}</div><div class="history-bubble">${esc(t.userText||'')}</div>${t.aiText?`<div class="history-label" style="margin-top:14px">${esc(activeSpacePerson()?.name||'AI')}</div><div class="history-bubble">${esc(t.aiText)}</div>`:''}<div class="history-rollback"><button class="mini-btn danger" data-action="delete-history-turn" data-id="${esc(t.id)}">${zh?'删除并回到这里之前':'DELETE & ROLLBACK'}</button></div></div></details>`).join('')}
function deleteHistoryTurn(id){const sp=activeSpace();if(!sp)return;normalizeSpace(sp);const idx=sp.history.findIndex(x=>x.id===id);if(idx<0)return;const zh=currentLang()==='zh';if(!confirm(zh?'删除这段记录，并回到它发生之前？后面的剧情也会一起回溯。':'Delete this memory and roll the story back? Later turns will also be removed.'))return;const target=sp.history[idx];sp.scene=cloneObj(target.beforeScene)||baseScene();sp.history=sp.history.slice(0,idx);syncSpaceEvents(sp);save();renderScene();renderOurHistory();toast(zh?'已回溯到上一个话题':'Rolled back to the previous topic')}

let spaceView='directory';
function setSpaceView(view){
  spaceView=view;
  const directory=$('spaceDirectoryView'),workspace=$('spaceWorkspaceView'),archive=$('spaceHistoryView');
  if(directory)directory.hidden=view!=='directory';
  if(workspace)workspace.hidden=view!=='workspace';
  if(archive)archive.hidden=view!=='history';
  const sp=activeSpace(),person=activeSpacePerson();
  if(view==='workspace'&&sp){$('workspaceTitle').textContent=sp.title||person.name;$('workspaceMeta').textContent=person.name+(activeSpaceWorld()?.name?' · '+activeSpaceWorld().name:'');}
  if(view==='history')renderOurHistory();
  window.scrollTo(0,0);
}
function renderSpacePeople(){const box=$('spacePeopleGrid');if(!box)return;const people=state.people.filter(p=>p.id!=='p-yanyan');if(!people.length){box.innerHTML='<div class="module-empty" style="grid-column:1/-1">还没有 AI 人物。先去 HOME → PEOPLE 建立一个吧。</div>';return}box.innerHTML=people.map(p=>{const n=state.spaces.filter(s=>s.personId===p.id).length;const active=activeSpace()?.personId===p.id;const initial=esc((p.name||'?').trim().charAt(0).toUpperCase());const role=esc(p.role||'AI character');return `<button class="space-person-card ${active?'active':''}" type="button" data-action="open-person-space" data-id="${esc(p.id)}"><span class="space-person-avatar">${initial}</span><span class="space-person-info"><b>${esc(p.name)}</b><span>${role} · ${n} ${currentLang()==='zh'?'个空间':'spaces'}${active?' · '+(currentLang()==='zh'?'正在进行':'ACTIVE'):''}</span></span><span class="space-person-arrow">↗</span></button>`}).join('')}
function openPersonSpace(id){const p=state.people.find(x=>x.id===id);if(!p)return;renderPersonSpaceModal(p);$('spacePersonModal').classList.add('show');document.body.style.overflow='hidden'}
function closePersonSpace(){$('spacePersonModal').classList.remove('show');document.body.style.overflow=''}
function renderPersonSpaceModal(person){const list=state.spaces.filter(s=>s.personId===person.id).slice().reverse();const zh=currentLang()==='zh';$('spacePersonEyebrow').textContent='SPACE';$('spacePersonTitle').textContent=person.name;const worldName=id=>state.worlds.find(w=>w.id===id)?.name||(zh?'未选择世界观':'No world');const personaName=id=>state.selfPersonas.find(x=>x.id===id)?.name||(zh?'未选择自设':'No persona');$('spacePersonBody').innerHTML=`<div class="actions"><button class="btn primary" data-action="new-space" data-id="${esc(person.id)}">${zh?'+ 新建 SPACE':'+ NEW SPACE'}</button></div><div class="module-list">${list.length?list.map(s=>`<div class="space-session"><h3>${esc(s.title||(zh?'未命名空间':'Untitled Space'))}</h3><div class="sub">${esc(worldName(s.worldId))} · ${esc(personaName(s.personaId))}</div><div class="mini-actions"><button class="mini-btn" data-action="continue-space" data-id="${esc(s.id)}">${zh?'继续':'CONTINUE'}</button><button class="mini-btn" data-action="edit-space" data-id="${esc(s.id)}">${zh?'编辑':'EDIT'}</button><button class="mini-btn danger" data-action="delete-space" data-id="${esc(s.id)}">${zh?'删除':'DELETE'}</button></div></div>`).join(''):'<div class="module-empty">'+(zh?'还没有 SPACE。创建一个属于你们的故事吧。':'No spaces yet. Create your first story.')+'</div>'}</div>`}
function spacePersonOptions(selectedId,zh){const people=(state.people||[]).filter(x=>x.id!=='p-yanyan');return people.map(x=>`<option value="${esc(x.id)}" ${x.id===selectedId?'selected':''}>${esc(x.name)}${x.role?' · '+esc(x.role):''}</option>`).join('')}
function openNewSpace(personId){editingSpaceId='';const p=state.people.find(x=>x.id===personId);if(!p)return;const worlds=state.worlds||[],personas=state.selfPersonas||[];const zh=currentLang()==='zh';$('spacePersonBody').innerHTML=`<div class="sub">${zh?'为这个 SPACE 选择 AI 角色、世界观和你的自设。':'Choose the AI character, world book, and your persona for this SPACE.'}</div><label>${zh?'AI 角色':'AI CHARACTER'}</label><select id="newSpacePerson">${spacePersonOptions(p.id,zh)}</select><label>${zh?'空间名称':'SPACE NAME'}</label><input id="newSpaceTitle" placeholder="${zh?'例如：雨夜回家':'e.g. A Rainy Night'}"><div class="space-context"><div><label>${zh?'世界观':'WORLD BOOK'}</label><select id="newSpaceWorld"><option value="">${zh?'不使用世界观':'None'}</option>${worlds.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></div><div><label>${zh?'我的自设':'MY PERSONA'}</label><select id="newSpacePersona"><option value="">${zh?'默认自己':'Default me'}</option>${personas.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div></div><div class="actions"><button class="btn primary" data-action="save-new-space" data-id="${esc(p.id)}">${zh?'开始 SPACE':'START SPACE'}</button><button class="btn" data-action="back-person-space" data-id="${esc(p.id)}">${zh?'返回':'BACK'}</button></div>`}
function openEditSpace(spaceId){const sp=state.spaces.find(x=>x.id===spaceId);if(!sp)return;const p=state.people.find(x=>x.id===sp.personId);if(!p)return;editingSpaceId=spaceId;const worlds=state.worlds||[],personas=state.selfPersonas||[];const zh=currentLang()==='zh';$('spacePersonBody').innerHTML=`<div class="sub">${zh?'编辑这个 SPACE。已有剧情和 OUR HISTORY 会保留。':'Edit this SPACE. Existing story and OUR HISTORY will be kept.'}</div><label>${zh?'AI 角色':'AI CHARACTER'}</label><select id="editSpacePerson">${spacePersonOptions(sp.personId,zh)}</select><label>${zh?'空间名称':'SPACE NAME'}</label><input id="editSpaceTitle" value="${esc(sp.title||'')}" placeholder="${zh?'例如：雨夜回家':'e.g. A Rainy Night'}"><div class="space-context"><div><label>${zh?'世界观':'WORLD BOOK'}</label><select id="editSpaceWorld"><option value="">${zh?'不使用世界观':'None'}</option>${worlds.map(w=>`<option value="${esc(w.id)}" ${w.id===sp.worldId?'selected':''}>${esc(w.name)}</option>`).join('')}</select></div><div><label>${zh?'我的自设':'MY PERSONA'}</label><select id="editSpacePersona"><option value="">${zh?'默认自己':'Default me'}</option>${personas.map(x=>`<option value="${esc(x.id)}" ${x.id===sp.personaId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div><div class="actions"><button class="btn primary" data-action="save-edit-space" data-id="${esc(spaceId)}">${zh?'保存修改':'SAVE CHANGES'}</button><button class="btn" data-action="back-person-space" data-id="${esc(p.id)}">${zh?'返回':'BACK'}</button></div>`}
function saveEditSpace(spaceId){const sp=state.spaces.find(x=>x.id===spaceId);if(!sp)return;const title=$('editSpaceTitle')?.value.trim();sp.personId=$('editSpacePerson')?.value||sp.personId;sp.title=title||(currentLang()==='zh'?'新的空间':'New Space');sp.worldId=$('editSpaceWorld')?.value||'';sp.personaId=$('editSpacePersona')?.value||'';editingSpaceId='';save();const p=state.people.find(x=>x.id===sp.personId);if(activeSpaceId===spaceId){state.activeSpaceId=spaceId;state.events=sp.events||[];renderScene();renderOurHistory()}if(p)renderPersonSpaceModal(p);toast(currentLang()==='zh'?'SPACE 已更新':'SPACE updated')}
function baseScene(){const s=hourScene();return {place:s.place,text:s.text,quote:s.quote,choices:s.choices.slice(0,4),hour:new Date().getHours()}}
function saveNewSpace(personId){const selectedPerson=$('newSpacePerson')?.value||personId;const title=$('newSpaceTitle')?.value.trim()||(currentLang()==='zh'?'我们的空间':'Our Space');const sp={id:'spc-'+Date.now(),personId:selectedPerson,title,worldId:$('newSpaceWorld')?.value||'',personaId:$('newSpacePersona')?.value||'',events:[],history:[],scene:baseScene(),createdAt:new Date().toISOString()};state.spaces.push(sp);activeSpaceId=sp.id;state.activeSpaceId=sp.id;state.events=[];save();closePersonSpace();renderSpacePeople();setSpaceView('workspace');renderScene();renderOurHistory();toast(currentLang()==='zh'?'你们的空间已开启':'Your space is open')}
function continueSpace(id){const sp=state.spaces.find(x=>x.id===id);if(!sp)return;normalizeSpace(sp);activeSpaceId=id;state.activeSpaceId=id;state.events=sp.events.slice();save();closePersonSpace();renderSpacePeople();setSpaceView('workspace');renderScene();renderOurHistory();toast(currentLang()==='zh'?'已进入你们的空间':'Space opened')}
function deleteSpace(id){const target=state.spaces.find(x=>x.id===id);if(!target)return;if(!confirm(currentLang()==='zh'?'删除这个 SPACE？':'Delete this SPACE?'))return;state.spaces=state.spaces.filter(x=>x.id!==id);if(activeSpaceId===id){activeSpaceId='';state.activeSpaceId='';state.events=[]}save();renderSpacePeople();openPersonSpace(target.personId)}
function renderScene(){const sp=activeSpace();const h=new Date().getHours();if(sp){normalizeSpace(sp);if(!sp.scene){sp.scene=baseScene();save()}else if(!sp.history.length && !sp.__lrArchiveExternal && sp.scene.hour!==h){sp.scene=baseScene();save()}}const s=sp?.scene||baseScene();lastSceneHour=h;const p=activeSpacePerson();$('place').textContent=s.place;$('sceneText').textContent=s.text;$('sceneQuote').textContent=s.quote;$('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});$('choices').innerHTML='';(s.choices||[]).slice(0,4).forEach((x,i)=>{const b=document.createElement('button');b.className='btn choice';b.type='button';b.dataset.choice=String(i);b.dataset.choiceText=x;b.textContent=x;$('choices').appendChild(b)});updateAIState();const w=activeSpaceWorld(),pe=activeSpacePersona(),title=sp?sp.title:(currentLang()==='zh'?'默认空间 · '+p.name:'Default Space · '+p.name);const card=$('spacePeopleSub');if(card)card.textContent=sp?title+' · '+(w?.name||(currentLang()==='zh'?'未选择世界观':'No world'))+' · '+(pe?.name||(currentLang()==='zh'?'默认自设':'Default persona')):(currentLang()==='zh'?'先选择一位角色，再进入你们的空间。':'Choose a character to enter your shared space.');const wn=$('worldNameDisplay'),wd=$('worldDescriptionDisplay'),wl=$('worldLocationsDisplay');if(wn)wn.textContent=w?.name||(currentLang()==='zh'?'我们的故事，从这里开始':'A LITTLE UNIVERSE');if(wd)wd.textContent=w?.description||(currentLang()==='zh'?'还没有添加世界简介。去世界书，写下这个世界的样子。':'Your world is waiting for its first details. Add a description in the World Book.');if(wl)wl.textContent=w?.locations||(currentLang()==='zh'?'尚未添加地点':'No locations added yet');const who=$('spaceTitleEyebrow');if(who)who.textContent=w?'OUR WORLD · '+(w.name||'SPACE'):'OUR PRIVATE UNIVERSE';renderSpacePeople();renderOurHistory()}
function updateAIState(){$('aiState').textContent=state.apiBase&&state.apiKey&&state.apiModel?'AI HOME IS ON':'HOME IS ALIVE'}
let lastSceneHour=-1;
function refreshSceneByRealTime(){if(!$('space')?.classList.contains('active'))return;const h=new Date().getHours();if(h!==lastSceneHour){renderScene()}else if($('clock'))$('clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
setInterval(refreshSceneByRealTime,15000);window.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSceneByRealTime()});
function addEvent(text){state.events=(state.events||[]).slice(-30);state.events.push({text,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})});const sp=activeSpace();if(sp)sp.events=state.events.slice();save()}
const UI_LANG={
 en:{home:'HOME',memories:'MEMORIES',space:'SPACE',settings:'SETTINGS',littleUniverse:'OUR LITTLE UNIVERSE',daysTogether:'DAYS TOGETHER',today:'TODAY',moment:'A MOMENT',private:'PRIVATE',yourPhoto:'YOUR PHOTO',addPhoto:'ADD PHOTO',clear:'CLEAR',yourWorld:'YOUR WORLD',worldSub:'People, forum, worlds and journals, all in one place.',archive:'OUR LITTLE ARCHIVE',addMemory:'Add a memory',photo:'PHOTO',note:'NOTE',saveMemory:'SAVE MEMORY',rightNow:'RIGHT NOW',homeAlive:'HOME IS ALIVE',whatWill:'WHAT WILL YOU DO?',send:'SEND',ourDay:'OUR LITTLE DAY',newMoment:'A NEW MOMENT',surpriseSub:'Want something unexpected to happen today?',surprise:'SURPRISE US',ourSpace:'OUR SPACE',installTitle:'Add our space to your home screen',installSub:'Open it like a real little app',add:'ADD',us:'US',yourName:'YOUR NAME',partnerName:'PARTNER NAME',startDate:'START DATE',todayText:'TODAY TEXT',saveChanges:'SAVE CHANGES',appearance:'APPEARANCE',appearanceSub:'Fonts, type scale, colors, cards, glass and background.',customize:'CUSTOMIZE LOOK',api:'AI / API',selfPersona:'MY PERSONAS',selfPersonaSub:'Create different versions of yourself. You can keep more than one.',addSelfPersona:'+ ADD PERSONA',homeScreen:'HOME SCREEN',howToAdd:'HOW TO ADD',language:'LANGUAGE',languageSub:'Choose the language for the app interface. AI-generated content will keep its original language.',newPerson:'NEW PERSON',role:'ROLE / IDENTITY',personality:'PERSONALITY',appearanceField:'APPEARANCE',speaking:'SPEAKING STYLE',background:'BACKGROUND',instructions:'AI INSTRUCTIONS',savePerson:'SAVE PERSON',cancel:'CANCEL',newWorld:'NEW WORLD',description:'DESCRIPTION',locations:'LOCATIONS',rules:'RULES',saveWorld:'SAVE WORLD',newEntry:'NEW ENTRY',title:'TITLE',mood:'MOOD',saveEntry:'SAVE ENTRY',discussion:'DISCUSSION',comments:'COMMENTS',generateComments:'GENERATE AI COMMENTS',languageSaved:'Language changed.',selectPerson:'SELECT PERSON',selectPersonSub:'Choose who you want to spend this space with.'},
 zh:{home:'首页',memories:'回忆',space:'空间',settings:'设置',littleUniverse:'我们的小宇宙',daysTogether:'在一起的日子',today:'今天',moment:'此刻',private:'私密',yourPhoto:'你的照片',addPhoto:'添加照片',clear:'清除',yourWorld:'你的世界',worldSub:'人物、论坛、世界和日记，都留在这里。',archive:'我们的小档案',addMemory:'添加一段回忆',photo:'照片',note:'备注',saveMemory:'保存回忆',rightNow:'此刻',homeAlive:'空间正在运行',whatWill:'你想做什么？',send:'发送',ourDay:'我们的一天',newMoment:'新的瞬间',surpriseSub:'想让今天发生一点意外？',surprise:'给我们一个惊喜',ourSpace:'空间',installTitle:'把我们的空间放到主屏幕',installSub:'像一个真正的小 App 一样打开',add:'添加',us:'我们',yourName:'你的名字',partnerName:'恋人名字',startDate:'开始日期',todayText:'今天的文字',saveChanges:'保存修改',appearance:'外观',appearanceSub:'字体、字号、主题色、卡片圆角、毛玻璃和背景，都可以在这里实时调整。',customize:'自定义外观',api:'AI / API',selfPersona:'我的自设',selfPersonaSub:'建立不同版本的自己。可以保存多个自设。',addSelfPersona:'+ 添加自设',homeScreen:'主屏幕',howToAdd:'如何添加',language:'语言',languageSub:'选择 App 界面的显示语言。AI 生成的内容会保持原本的语言。',newPerson:'新建人物',role:'身份 / 职业',personality:'性格',appearanceField:'外貌',speaking:'说话方式',background:'背景故事',instructions:'AI 指令',savePerson:'保存人物',cancel:'取消',newWorld:'新建世界',description:'简介',locations:'地点',rules:'世界规则',saveWorld:'保存世界',newEntry:'新建日记',title:'标题',mood:'心情',saveEntry:'保存日记',discussion:'讨论',comments:'评论',generateComments:'生成 AI 评论',languageSaved:'语言已切换。',selectPerson:'选择对象',selectPersonSub:'选择你想和谁一起进入这个空间。'}
};
function currentLang(){return 'zh'}
function t(k){return UI_LANG[currentLang()][k]||UI_LANG.en[k]||k}
function setText(id,key){const el=$(id);if(el)el.textContent=t(key)}
function localizeEditors(){
 const zh=currentLang()==='zh';
 const set=(sel,val)=>{const el=$(sel);if(el)el.textContent=val};
 const labels=(modalId,vals)=>{const m=$(modalId);if(!m)return;m.querySelectorAll('label').forEach((el,i)=>{if(vals[i])el.textContent=vals[i]})};
 set('personEditTitle',zh?'新建人物':'NEW PERSON');labels('personEditModal',[t('yourName'),t('role'),t('personality'),t('appearanceField'),t('speaking'),t('background'),t('instructions')]);set('savePerson','savePerson');set('cancelPerson','cancel'); set('selfPersonaEditTitle',zh?'新建自设':'NEW PERSONA');labels('selfPersonaEditModal',[t('yourName'),t('role'),t('personality'),t('appearanceField'),t('speaking'),t('background')]);set('saveSelfPersona',zh?'保存自设':'SAVE PERSONA');set('cancelSelfPersona','cancel');
 set('worldEditTitle',zh?'新建世界':'NEW WORLD');labels('worldEditModal',[t('yourName'),t('description'),t('locations'),t('rules')]);set('saveWorld','saveWorld');set('cancelWorld','cancel');
 const jm=$('journalEditModal');if(jm){const h=jm.querySelector('h2');if(h)h.textContent=t('newEntry');const ls=jm.querySelectorAll('label');if(ls[0])ls[0].textContent=t('title');if(ls[1])ls[1].textContent=t('mood');if(ls[2])ls[2].textContent=t('note');set('saveJournal','saveEntry');set('cancelJournal','cancel')}
 const fm=$('forumDetailModal');if(fm){const es=fm.querySelector('.eyebrow');if(es)es.textContent=t('forum');const h=fm.querySelector('h2');if(h)h.textContent=t('discussion')}
 const am=$('appearanceModal');if(am){const es=am.querySelectorAll('.eyebrow');if(es[0])es[0].textContent=t('appearance');const h=am.querySelector('h2');if(h)h.textContent=zh?'让它成为你的样子':'MAKE IT YOURS'}
}
function localizeModule(){
 const body=$('moduleBody');if(!body)return;
 const zh=currentLang()==='zh';
 const set=(sel,val)=>{const el=body.querySelector(sel);if(el)el.textContent=val};
 const map={
  'new-person':zh?'+ 新建人物':'+ NEW PERSON','new-world':zh?'+ 新建世界':'+ NEW WORLD','new-journal':zh?'+ 新建日记':'+ NEW ENTRY',
  'generate-forum':zh?'✦ 使用 API 生成':'✦ GENERATE WITH API','manual-forum':zh?'+ 手动发帖':'+ MANUAL POST',
  'delete-person':zh?'删除':'DELETE','delete-world':zh?'删除':'DELETE','delete-journal':zh?'删除':'DELETE','delete-post':zh?'删除':'DELETE',
  'edit-person':zh?'编辑':'EDIT','edit-world':zh?'编辑':'EDIT'
 };
 Object.entries(map).forEach(([a,v])=>body.querySelectorAll(`[data-action="${a}"]`).forEach(el=>el.textContent=v));
 if(body.querySelector('h3')){const h=body.querySelector('h3');if(h.textContent==='AI GENERATOR'||h.textContent==='AI 生成器')h.textContent=zh?'AI 生成器':'AI GENERATOR'}
 const labels=body.querySelectorAll('label');labels.forEach(l=>{const x=l.textContent.trim();const m=zh?{'TOPIC':'主题','AI PARTICIPANTS':'AI 参与者','HOW MANY POSTS':'生成帖子数量'}:{'主题':'TOPIC','AI 参与者':'AI PARTICIPANTS','生成帖子数量':'HOW MANY POSTS'};if(m[x])l.textContent=m[x]});
}
function applyLanguage(){
 
 document.querySelectorAll('.nav-btn').forEach(b=>{const sp=b.querySelector('span');if(sp)sp.textContent=t(b.dataset.page)});
 const home=$('home');if(home){const h=home.querySelector('h1');if(h)h.textContent=t('littleUniverse');const es=home.querySelectorAll('.eyebrow');if(es[0])es[0].textContent='LOVE RECORD';if(es[1])es[1].textContent=t('today');if(es[2])es[2].textContent=t('moment');if(es[3])es[3].textContent=t('yourWorld');const st=home.querySelector('.status');if(st)st.textContent=t('private');const hp=$('homePhoto');if(hp&&!hp.querySelector('img'))hp.textContent=t('yourPhoto');const bs=home.querySelectorAll('.btn');if(bs[0])bs[0].textContent=t('addPhoto');if(bs[1])bs[1].textContent=t('clear');const sub=home.querySelector('.world-grid')?.parentElement?.querySelector('.sub');if(sub)sub.textContent=t('worldSub')}
 const mem=$('memories');if(mem){const es=mem.querySelectorAll('.eyebrow');if(es[0])es[0].textContent=t('memories');const h=mem.querySelector('h1');if(h)h.textContent=t('archive');const h3=mem.querySelector('h3');if(h3)h3.textContent=t('addMemory');const labs=mem.querySelectorAll('label');if(labs[0])labs[0].textContent=t('photo');if(labs[1])labs[1].textContent=t('note');const b=$('addMemory');if(b)b.textContent=t('saveMemory')}
 const sp=$('space');if(sp){const spe=$('spacePeopleEyebrow');if(spe)spe.textContent=currentLang()==='zh'?'角色 CHARACTER':'THE CHARACTERS';const sps=$('spacePeopleSub');if(sps&&!activeSpaceId)sps.textContent=t('selectPersonSub');const title=$('spaceTitleEyebrow');if(title)title.textContent=currentLang()==='zh'?'我们的私人宇宙':'OUR PRIVATE UNIVERSE';const what=$('spaceWhatWill');if(what)what.textContent=currentLang()==='zh'?'此刻 · 03':'THE PRESENT · 03';const nm=$('newMomentEyebrow');if(nm)nm.textContent=currentLang()==='zh'?'新的瞬间 · 05':'A NEW MOMENT · 05';const h=sp.querySelector('h1');if(h)h.textContent='OUR SPACE';const ai=$('aiState');if(ai)ai.textContent=t('homeAlive');const send=$('sendFree');if(send)send.textContent=t('send');const sur=$('surprise');if(sur)sur.setAttribute('aria-label',t('surprise'));const sub=$('surprise')?.closest('.surprise-feature')?.querySelector('.sub');if(sub)sub.textContent=t('surpriseSub')}
 const st=$('settings');if(st){const es=st.querySelectorAll('.eyebrow');if(es[0])es[0].textContent=t('settings');const h=st.querySelector('h1');if(h)h.textContent=t('ourSpace');const install=st.querySelector('#installBox');if(install){const b=install.querySelector('b');if(b)b.textContent=t('installTitle');const sub=install.querySelector('.sub');if(sub)sub.textContent=t('installSub');if($('installBtn'))$('installBtn').textContent=t('add')}const us=$('settings').querySelector('#usCard h3');if(us)us.textContent=t('us');const labels=$('settings').querySelectorAll('#usCard label');if(labels[0])labels[0].textContent='开始日期';if(labels[1])labels[1].textContent='今天的文字';if($('saveSettings'))$('saveSettings').textContent=t('saveChanges');setText('selfPersonaTitle','selfPersona');setText('selfPersonaSub','selfPersonaSub');setText('addSelfPersona','addSelfPersona');setText('appearanceTitle','appearance');setText('appearanceSub','appearanceSub');if($('openAppearance'))$('openAppearance').textContent=t('customize');setText('apiTitle','api');if($('installHelp'))$('installHelp').textContent=t('howToAdd');renderSelfPersonas()}
 state.language='zh';
 localizeModule();localizeEditors();renderSpacePeople();
}

function nav(page){
  const dock=document.querySelector('.nav');if(dock)dock.style.display='';
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  const target=$(page);if(!target)return;
  target.classList.add('active');
  document.body.classList.toggle('launcher-open',page==='launcher');
  const bar=$('systemAppbar');if(bar)bar.classList.toggle('show',page!=='launcher');
  const titles={launcher:'LOVE RECORD',home:'HOME',memories:'MEMORIES',space:'SPACE',settings:'SETTINGS',chat:'CHAT',music:'MUSIC'};
  const title=$('systemAppTitle');if(title)title.textContent=titles[page]||'LOVE RECORD';const appAction=$('systemAppbarAction');if(appAction){if(page==='chat'){appAction.innerHTML='＋';appAction.setAttribute('role','button');appAction.setAttribute('aria-label','添加联系人');appAction.style.cursor='pointer'}else{appAction.textContent='✦';appAction.removeAttribute('role');appAction.removeAttribute('aria-label');appAction.style.cursor='default'}}
  window.scrollTo(0,0);
  if(page==='home')renderHome();
  if(page==='memories')renderMemories();
  if(page==='chat')renderChat();
  if(page==='space'){
    if(state.activeSpaceId&&state.spaces.some(x=>x.id===state.activeSpaceId)){
      activeSpaceId=state.activeSpaceId;
      state.events=(state.spaces.find(x=>x.id===activeSpaceId)?.events||[]).slice();
    }
    renderSpacePeople();renderScene();renderOurHistory();setSpaceView(state.activeSpaceId&&state.spaces.some(x=>x.id===state.activeSpaceId)?'workspace':'directory');
  }
  if(page==='settings'){renderSettings();if(state.apiBase&&state.apiKey){setApiDebug('正在重新读取当前 API 站点的最新模型列表……');loadModels(true)}}
}
function renderSettings(){
$('setDate').value=state.startDate;$('setToday').value=state.today;$('apiBase').value=state.apiBase;$('apiKey').value=state.apiKey;
renderModelPicker();renderApiPresets();renderSelfPersonas();updateAIState();
const on=!!(state.apiBase&&state.apiKey&&state.apiModel);$('apiStatus').textContent=on?'API 已连接 · '+state.apiModel:'未连接 API。Space 会使用内置角色互动.';$('apiStatus').classList.toggle('on',on)
}
function renderModelPicker(){
 const box=$('modelPicker');
 const label=$('selectedModelLabel');
 if(!box)return;
 const models=Array.isArray(state.modelList)?state.modelList.filter(Boolean):[];
 box.innerHTML='';
 if(!models.length){
   box.innerHTML='<div class="model-empty">连接后会在这里显示中转站返回的全部模型。</div>';
   if(label)label.textContent=state.apiModel?'当前模型：'+state.apiModel:'当前模型：未选择';
   return;
 }
 models.forEach(id=>{const b=document.createElement('button');b.type='button';b.className='model-option'+(id===state.apiModel?' active':'');b.dataset.model=id;b.innerHTML=esc(id)+(id===state.apiModel?'<span class="model-mark">✓ 已选择</span>':'');box.appendChild(b)});
 if(label)label.textContent='当前模型：'+(state.apiModel||models[0]);
}

async function fetchTimeout(url,opts,ms=8000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{return await fetch(url,Object.assign({},opts,{signal:c.signal}))}finally{clearTimeout(t)}}
function apiErrorText(e){if(e&&(e.name==='AbortError'||/signal is aborted|aborted without reason/i.test(String(e.message||''))))return'请求被中止或超时：中转站未在限定时间内返回结果。若 /models 已成功但对话失败，请检查所选模型是否支持 /chat/completions、网络/CORS 与中转站限流。';if(e&&e.message==='Failed to fetch')return'浏览器无法连接 API：常见原因是 CORS、网络拦截或中转站暂时不可用。';return e?.message||String(e)||'未知错误'}
function setApiDebug(text,on=false){const el=$('apiDebug');if(!el)return;el.textContent=text;el.style.color=on?'#526255':'';}
async function loadModels(silent=false){
 const base=($('apiBase')?.value||state.apiBase||'').trim().replace(/\/+$/,'');
 const key=($('apiKey')?.value||state.apiKey||'').trim();
 if(!base||!key){if(!silent)toast('先填写 API 地址和 Key');setApiDebug('请先填写 API 地址和 API Key。');return false}
 if(!silent)toast('正在读取模型…');
 try{
   const r=await fetchTimeout(base+'/models',{headers:{Authorization:'Bearer '+key,Accept:'application/json'}},12000);
   const raw=await r.text();
   if(!r.ok){let detail=raw;try{const j=JSON.parse(raw);detail=j.error?.message||j.message||raw}catch{}throw new Error('HTTP '+r.status+(detail?' · '+detail.slice(0,180):''))}
   let j;try{j=JSON.parse(raw)}catch{throw new Error('模型列表不是有效 JSON')}
   const ids=Array.isArray(j.data)?j.data.map(x=>x?.id).filter(Boolean):Array.isArray(j.models)?j.models.map(x=>typeof x==='string'?x:x?.id||x?.name).filter(Boolean):[];
   if(!ids.length)throw new Error('NO_MODELS · /models 没有返回可用模型');
   state.apiBase=base;state.apiKey=key;state.modelList=[...new Set(ids)];state.apiModel=state.modelList.includes(state.apiModel)?state.apiModel:state.modelList[0];save();
   try{renderSettings()}catch(uiError){console.warn('模型列表已读取，但设置界面刷新有问题：',uiError)}
   setApiDebug('模型读取成功：'+state.modelList.length+' 个。当前：'+state.apiModel,true);
   if(!silent)toast('找到 '+state.modelList.length+' 个模型');
   return true;
 }catch(e){
   const msg=apiErrorText(e);setApiDebug('读取 /models 失败：'+msg);
   if(!silent)toast('模型读取失败，已显示具体原因');
   return false;
 }
}

function extractAIText(j){const c=j?.choices?.[0]?.message?.content;if(typeof c==='string')return c.trim();if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||'')).join('').trim();if(typeof j?.choices?.[0]?.text==='string')return j.choices[0].text.trim();return''}
async function askAI(userText,mode){const selectedModel=(state.apiModel||'').trim();const base=(state.apiBase||$('apiBase')?.value||'').trim().replace(/\/+$/,'');const key=(state.apiKey||$('apiKey')?.value||'').trim();const model=(selectedModel||state.apiModel||'').trim();if(!base||!key||!model)return null;if(aiBusy)return null;aiBusy=true;try{const recent=historyContext(activeSpace())||'无';const s=activeSpace()?.scene||hourScene();const person=activeSpacePerson();const world=activeSpaceWorld();const persona=activeSpacePersona();const system='你正在 LOVE RECORD 的 SPACE 中扮演 '+(person?.name||state.partner)+'。用户是 '+(persona?.name||state.name)+'。你不是任务系统，也不要把互动写成游戏菜单。请保持角色一致，自然回应。人物身份：'+(person?.role||'')+'；性格：'+(person?.personality||'')+'；外貌：'+(person?.appearance||'')+'；说话方式：'+(person?.speech||'')+'；背景：'+(person?.background||'')+'；人物规则：'+(person?.instructions||'')+'。世界观：'+(world?world.name+'；'+world.description+'；地点：'+world.locations+'；规则：'+world.rules:'无')+'。用户自设完整资料：名字='+(persona?.name||state.name)+'；身份='+(persona?.role||'')+'；性格='+(persona?.personality||'')+'；外貌='+(persona?.appearance||'')+'；说话方式='+(persona?.speech||'')+'；背景='+(persona?.background||'')+'。不要替用户决定行动、想法、台词或情绪；只回应用户已经明确做出的事情。当前场景：'+s.place+'；时间：'+new Date().toLocaleString('zh-CN')+'。近期共同记忆：'+recent+'。只返回一段适合直接显示给用户的角色回应，不要JSON，不要解释AI。';const user=(state.name||'用户')+'刚刚说/做了：'+userText+'。请继续这一刻。';setApiDebug('正在请求模型：'+model+' …');const r=await fetchTimeout(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'Accept':'application/json'},body:JSON.stringify({model:model,messages:[{role:'system',content:system},{role:'user',content:user}],stream:false})},60000);const raw=await r.text();if(!r.ok){let detail=raw;try{const j=JSON.parse(raw);detail=j.error?.message||j.message||raw}catch{}throw new Error('HTTP '+r.status+(detail?' · '+detail.slice(0,220):''))}let j;try{j=JSON.parse(raw)}catch{throw new Error('返回内容不是有效 JSON：'+raw.slice(0,160))}const answer=extractAIText(j);if(!answer)throw new Error('API 返回成功，但没有找到 choices[0].message.content');setApiDebug('AI 测试/调用成功。返回正常。',true);return answer}catch(e){setApiDebug('AI 请求失败：'+apiErrorText(e));return null}finally{aiBusy=false}}
async function testAI(){const base=(state.apiBase||$('apiBase')?.value||'').trim().replace(/\/+$/,'');const key=(state.apiKey||$('apiKey')?.value||'').trim();const model=(state.apiModel||'').trim();if(!base||!key||!model){toast('请先连接 API 并选择模型');setApiDebug('当前没有完整的 API Base URL / Key / Model。');return}if(aiBusy){toast('AI 正在处理上一条请求，请稍等 ♡');return}aiBusy=true;setApiDebug('正在测试连接…\n模型：'+model);toast('正在测试 AI…');try{const r=await fetchTimeout(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'Accept':'application/json'},body:JSON.stringify({model:model,messages:[{role:'system',content:'You are a connection test endpoint. Reply with exactly: OK'},{role:'user',content:'Reply with exactly: OK'}],stream:false,max_tokens:8})},60000);const raw=await r.text();if(!r.ok){let detail=raw;try{const j=JSON.parse(raw);detail=j.error?.message||j.message||raw}catch{}throw new Error('HTTP '+r.status+(detail?' · '+detail.slice(0,180):''))}let j;try{j=JSON.parse(raw)}catch{throw new Error('服务器返回的内容不是有效 JSON。')}const answer=extractAIText(j);if(!answer)throw new Error('请求已返回，但没有读取到模型回复。');setApiDebug('API 连接成功 ♡\n模型：'+model+'\n测试通过。角色对话不会显示在这里。',true);toast('AI 连接成功 ♡')}catch(e){setApiDebug('API 连接失败：'+apiErrorText(e));toast('AI 测试失败，请查看错误详情')}finally{aiBusy=false}}
function setSceneResponse(text){$('sceneText').textContent='这一刻，他看着你。';$('sceneQuote').textContent='“'+text.replace(/^["“]|["”]$/g,'')+'”';const sp=activeSpace();if(sp){sp.scene=sp.scene||baseScene();sp.scene.text='这一刻，他看着你。';sp.scene.quote='“'+text.replace(/^["“]|["”]$/g,'')+'”';sp.scene.hour=new Date().getHours();save()}}
function fallbackChoices(trigger){const pools=[['继续追问他刚才那句话','靠近一点看看他的反应','把话题转到今天发生的事','笑着装作什么都没发生'],['问他接下来想做什么','把刚才的话说得更直白一点','换一个轻松的话题','安静陪他一会儿'],['问他为什么会这么想','顺着这个话题继续聊','故意逗他一下','把自己的想法告诉他'],['陪他一起做刚才的事','提出一个新的小计划','问他有没有想和你说的事','什么也不说，只看着他']];const idx=Math.abs(String(trigger||'').length)%pools.length;return pools[idx].slice(0,4)}
async function generateDynamicChoices(context){const sp=activeSpace();if(!sp)return;if(!(state.apiBase&&state.apiKey&&state.apiModel)){sp.scene=sp.scene||baseScene();sp.scene.choices=fallbackChoices(context);save();renderScene();return}const person=activeSpacePerson(),world=activeSpaceWorld(),persona=activeSpacePersona();const recent=historyContext(sp)||'无';const prompt=`为 LOVE RECORD 的 SPACE 生成下一轮恰好4个“用户可以选择的行动”。这些选项必须紧接当前剧情，不要重复上一轮，不要替用户决定结果，也不要替用户写已经发生的行动。当前对象：${person?.name||''}；人物身份：${person?.role||''}；人物性格：${person?.personality||''}；人物外貌：${person?.appearance||''}；人物说话方式：${person?.speech||''}；人物背景：${person?.background||''}；人物规则：${person?.instructions||''}；世界观：${world?world.name+'；'+world.description+'；'+world.locations+'；'+world.rules:'无'}；我的自设完整资料：名字=${persona?.name||'默认自己'}；身份=${persona?.role||''}；性格=${persona?.personality||''}；外貌=${persona?.appearance||''}；说话方式=${persona?.speech||''}；背景=${persona?.background||''}；当前时间：${new Date().toLocaleString('zh-CN')}；刚刚发生：${context}；近期记录：${recent}。选项应该符合“我的自设”可以自然做出的行动，但不要替我决定结果。只返回合法 JSON 数组，例如 ["选项1","选项2","选项3","选项4"]，不要 Markdown，不要解释。`;try{const r=await fetchTimeout(state.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:'你是剧情互动选项生成器，只输出4条自然的下一步行动。'},{role:'user',content:prompt}],stream:false})},15000);const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status);const j=JSON.parse(raw),txt=extractAIText(j),arr=extractJSONArray(txt);if(!arr||arr.length<4)throw new Error('choices parse failed');sp.scene=sp.scene||baseScene();sp.scene.choices=arr.slice(0,4).map(x=>String(x).trim()).filter(Boolean);if(sp.scene.choices.length<4)throw new Error('not enough choices');save();renderScene()}catch(e){sp.scene=sp.scene||baseScene();sp.scene.choices=fallbackChoices(context);save();renderScene()}}
async function handleChoice(text){const chosen=String(text||'');const turnId=startHistoryTurn(state.name+'：'+chosen);if(!turnId)return;if(state.apiBase&&state.apiKey&&state.apiModel){$('sceneText').textContent='他停了一下，看向你。';$('sceneQuote').textContent='正在想怎么回应……';const r=await askAI(chosen,'choice');if(r){setSceneResponse(r);finishHistoryTurn(turnId,activeSpacePerson().name+'：'+r);await generateDynamicChoices(chosen+'\n'+r)}else{finishHistoryTurn(turnId,'');toast('AI 暂时没回应，先陪你把这一刻留着');await generateDynamicChoices(chosen)}}else{const replies=['他轻轻笑了一下，没有催你。','他往旁边挪了挪，给你留了位置。','他看了你一会儿，然后把手伸过来。','“好，那我们就这样待一会儿。”'];const r=replies[Math.floor(Math.random()*replies.length)];setSceneResponse(r);finishHistoryTurn(turnId,activeSpacePerson().name+'：'+r);await generateDynamicChoices(chosen);toast('这一刻留下来了 ♡')}}
async function handleFree(){const input=$('freeInput');const text=input.value.trim();if(!text)return;input.value='';const turnId=startHistoryTurn(state.name+'：'+text);if(!turnId)return;if(state.apiBase&&state.apiKey&&state.apiModel){$('sceneQuote').textContent='正在回应……';const r=await askAI(text,'free');if(r){setSceneResponse(r);finishHistoryTurn(turnId,activeSpacePerson().name+'：'+r);await generateDynamicChoices(text+'\n'+r)}else{finishHistoryTurn(turnId,'');toast('AI 暂时没回应，检查 API 连接后再试')}}else{const r='嗯，我听着。你慢慢说。';setSceneResponse(r);finishHistoryTurn(turnId,activeSpacePerson().name+'：'+r);await generateDynamicChoices(text);toast('内置模式也可以继续聊天 ♡')}}
async function surprise(){const sp=activeSpace();if(!sp){toast('先选择人物并开启一个专属空间 ♡');setSpaceView('directory');return}if(aiBusy){toast('AI 正在回应上一条内容，稍等一下 ♡');return}const pool=['今天发生一件意想不到的小事。','他突然有了一个只想和你分享的计划。','一个平常的瞬间，忽然变得特别起来。','他想带你去一个没去过的地方。','他刚刚想起一件关于你们的小事。'];const text=pool[Math.floor(Math.random()*pool.length)];const turnId=startHistoryTurn('给我们一个惊喜：'+text);if(!turnId)return;$('sceneText').textContent=text;$('sceneQuote').textContent='AI 正在为你们创造一个小惊喜……';if(state.apiBase&&state.apiKey&&state.apiModel){const r=await askAI('请围绕这个意外灵感，结合你的人物设定、我们正在经历的空间和最近的共同记忆，自然地开启一段具体、有细节、适合继续互动的惊喜情节。不要只重复提示语，也不要替用户决定行动。灵感：'+text,'surprise');if(r){setSceneResponse(r);finishHistoryTurn(turnId,activeSpacePerson().name+'：'+r);await generateDynamicChoices(text+'\n'+r);toast('惊喜已经送达 ♡')}else{finishHistoryTurn(turnId,'');toast('这次 API 没有成功返回，请查看 Settings → AI / API 的错误详情')}}else{const r='“过来，我突然想到一件想和你一起做的事。”';setSceneResponse(r);finishHistoryTurn(turnId,activeSpacePerson().name+'：'+r);await generateDynamicChoices(text);toast('给你一个小惊喜 ♡')}}


function ensureSelfPersonas(){if(!Array.isArray(state.selfPersonas))state.selfPersonas=[]}
function renderSelfPersonas(){ensureSelfPersonas();const box=$('selfPersonaList');if(!box)return;if(!state.selfPersonas.length){box.innerHTML='<div class="sub" style="padding:10px 0">还没有自设。先建立一个属于你的版本吧。</div>';return}box.innerHTML=state.selfPersonas.map(x=>'<div class="card" style="padding:14px 16px;margin-top:9px;box-shadow:none"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div style="font-size:16px;letter-spacing:1px">'+esc(x.name||'Untitled')+'</div><div class="sub" style="margin-top:4px">'+esc(x.role||'')+'</div></div><div class="actions" style="margin:0;gap:7px"><button class="btn" type="button" data-self-action="edit" data-id="'+esc(x.id)+'" style="padding:8px 11px">'+(currentLang()==='zh'?'编辑':'EDIT')+'</button><button class="btn" type="button" data-self-action="delete" data-id="'+esc(x.id)+'" style="padding:8px 11px">'+(currentLang()==='zh'?'删除':'DELETE')+'</button></div></div></div>').join('')}
let editingSelfPersonaId='';
function openSelfPersonaEditor(id=''){ensureSelfPersonas();editingSelfPersonaId=id;const p=state.selfPersonas.find(x=>x.id===id)||{};$('selfPersonaEditTitle').textContent=id?(currentLang()==='zh'?'编辑自设':'EDIT PERSONA'):(currentLang()==='zh'?'新建自设':'NEW PERSONA');$('selfPersonaName').value=p.name||'';$('selfPersonaRole').value=p.role||'';$('selfPersonaPersonality').value=p.personality||'';$('selfPersonaAppearance').value=p.appearance||'';$('selfPersonaSpeech').value=p.speech||'';$('selfPersonaBackground').value=p.background||'';$('selfPersonaEditModal').classList.add('show');document.body.style.overflow='hidden'}
function closeSelfPersonaEditor(){$('selfPersonaEditModal').classList.remove('show');document.body.style.overflow=''}
function saveSelfPersona(){ensureSelfPersonas();const obj={id:editingSelfPersonaId||('sp-'+Date.now()),name:$('selfPersonaName').value.trim(),role:$('selfPersonaRole').value.trim(),personality:$('selfPersonaPersonality').value.trim(),appearance:$('selfPersonaAppearance').value.trim(),speech:$('selfPersonaSpeech').value.trim(),background:$('selfPersonaBackground').value.trim()};if(!obj.name){toast(currentLang()==='zh'?'请先填写自设名称':'Please enter a persona name');return}if(editingSelfPersonaId){const i=state.selfPersonas.findIndex(x=>x.id===editingSelfPersonaId);if(i>=0)state.selfPersonas[i]=obj;else state.selfPersonas.push(obj)}else state.selfPersonas.push(obj);save();closeSelfPersonaEditor();renderSettings();toast(currentLang()==='zh'?'自设已保存':'Persona saved')}

function ensureWorldData(){
  if(!Array.isArray(state.people))state.people=defaults.people.map(x=>({...x}));
  if(!Array.isArray(state.worlds))state.worlds=[];
  if(!Array.isArray(state.forumPosts))state.forumPosts=[];
  state.forumPosts.forEach(p=>{if(!Array.isArray(p.comments))p.comments=[];if(!Number.isFinite(Number(p.likes)))p.likes=Math.floor(12+Math.random()*89)});
  if(!Array.isArray(state.journal))state.journal=[];
  if(!Array.isArray(state.spaces))state.spaces=[];
  state.spaces.forEach(normalizeSpace);
  if(!state.activeSpaceId && state.spaces.length)state.activeSpaceId=state.spaces[state.spaces.length-1].id;
  let changed=false;
  const peopleBefore=state.people.length;
  state.people=state.people.filter(p=>!isInvalidContact(p));
  if(state.people.length!==peopleBefore)changed=true;
  if(changed)save();
}
let editingPersonId='',editingWorldId='',editingForumPostId='';
function openModule(name){const modal=$('moduleModal');modal.classList.toggle('journal-fullscreen',name==='journal');modal.dataset.module=name;modal.classList.add('show');document.body.style.overflow='hidden';renderModule(name)}
function closeModule(){ const modal=$('moduleModal');modal.classList.remove('show','journal-fullscreen');delete modal.dataset.module;document.body.style.overflow=''}
function renderModule(name){
 const titles={people:['CONTACTS','MY CONTACTS'],forum:['COMMUNITY','AI COMMUNITY'],world:['WORLD','YOUR WORLDS'],journal:['JOURNAL','LITTLE JOURNAL']};
 $('moduleEyebrow').textContent=titles[name][0];$('moduleTitle').textContent=titles[name][1];
 const b=$('moduleBody');
 if(name==='people'){
   b.innerHTML='<div class="actions"><button class="btn primary" data-action="new-person">+ NEW PERSON</button></div><div class="module-list">'+(state.people.length?state.people.map(p=>`<div class="module-item"><div class="module-item-head"><div><h3>${esc(p.name)}</h3><div class="module-meta">${esc(p.role||'AI character')}<br>${esc(p.personality||'')}</div></div></div><div class="mini-actions"><button class="mini-btn" data-action="edit-person" data-id="${esc(p.id)}">EDIT</button><button class="mini-btn danger" data-action="delete-person" data-id="${esc(p.id)}">DELETE</button></div></div>`).join(''):'<div class="module-empty">还没有人物。先建立一个吧。</div>')+'</div>';
 }else if(name==='world'){
   b.innerHTML='<div class="actions"><button class="btn primary" data-action="new-world">+ NEW WORLD</button></div><div class="module-list">'+(state.worlds.length?state.worlds.map(w=>`<div class="module-item"><h3>${esc(w.name)}</h3><div class="module-meta">${esc(w.description||'')}</div><div class="mini-actions"><button class="mini-btn" data-action="edit-world" data-id="${esc(w.id)}">EDIT</button><button class="mini-btn danger" data-action="delete-world" data-id="${esc(w.id)}">DELETE</button></div></div>`).join(''):'<div class="module-empty">还没有世界观。</div>')+'</div>';
 }else if(name==='journal'){
   b.innerHTML='<div class="actions"><button class="btn primary" data-action="new-journal">+ NEW ENTRY</button></div><div class="module-list">'+(state.journal.length?state.journal.slice().reverse().map(j=>`<div class="module-item"><div class="module-meta">${esc(j.date)} · ${esc(j.mood||'')}</div><h3 style="margin-top:5px">${esc(j.title||'Untitled')}</h3><div class="module-meta">${esc(j.note||'')}</div><div class="mini-actions"><button class="mini-btn danger" data-action="delete-journal" data-id="${esc(j.id)}">DELETE</button></div></div>`).join(''):'<div class="module-empty">把今天留下一点点。</div>')+'</div>';
 }else if(name==='forum'){
   const people=state.people;
   b.innerHTML=`<div class="card" style="margin-top:15px;padding:17px"><h3>AI GENERATOR</h3><div class="sub">AI 会根据主题和你建立的人物，生成一个自然的论坛。评论区则完全开放，由 AI 自由创造网友和参与者。</div><label>TOPIC</label><input id="forumTopic" placeholder="例如：今天最想做的事情"><label>AI PARTICIPANTS</label><div class="check-grid">${people.map(p=>`<label class="check-pill"><input type="checkbox" data-forum-person value="${esc(p.id)}" ${p.id==='p-yanhuan'?'checked':''}>${esc(p.name)}</label>`).join('')}</div><label>HOW MANY POSTS</label><input id="forumCount" type="number" min="1" max="6" value="3"><div class="actions"><button class="btn primary" data-action="generate-forum">✦ GENERATE WITH API</button><button class="btn" data-action="manual-forum">+ MANUAL POST</button></div><div id="forumStatus" class="sub" style="margin-top:10px"></div></div><div class="module-list">${renderForumPosts()}</div>`;
 }}
function forumLikeCount(p){
 const n=Number.isFinite(Number(p.likes))?Number(p.likes):0;
 return Math.max(0,Math.round(n));
}
function renderForumPosts(){
 if(!state.forumPosts.length)return '<div class="module-empty">论坛还很安静。让 AI 先聊起来吧。</div>';
 return state.forumPosts.slice().reverse().map(p=>{
   const count=Array.isArray(p.comments)?p.comments.length:0;
   const likes=forumLikeCount(p);
   return `<article class="forum-post"><button class="forum-open" type="button" data-action="open-post" data-id="${esc(p.id)}"><div class="forum-author">${esc(p.author)} · ${esc(p.date||'')}</div><div class="forum-title">${esc(p.title||'')}</div><div class="forum-body">${esc(p.body||'')}</div><div class="forum-stats">♡ ${likes} · ${count} ${t('comments')}</div></button><div class="mini-actions"><button class="mini-btn danger" data-action="delete-post" data-id="${esc(p.id)}">DELETE</button></div></article>`;
 }).join('');
}
function openForumDetail(id){
 const p=state.forumPosts.find(x=>x.id===id);if(!p)return;
 editingForumPostId=id;
 if(!Array.isArray(p.comments))p.comments=[];
 $('forumDetailBody').innerHTML=`<div class="forum-post" style="margin-top:14px"><div class="forum-author">${esc(p.author)} · ${esc(p.date||'')}</div><div class="forum-title">${esc(p.title||'')}</div><div class="forum-body">${esc(p.body||'')}</div><div class="forum-stats">♡ ${forumLikeCount(p)} · ${p.comments.length} ${t('comments')}</div></div><div class="card" style="margin-top:14px;padding:16px"><div class="home-status"><span class="eyebrow">${t('comments')}</span><span class="status">${p.comments.length}</span></div><div class="sub" style="margin-top:8px">评论由 AI 自由生成。评论者不受 PEOPLE 限制，可以是论坛里的任何人。</div><button class="btn primary" data-action="generate-comments" type="button" style="margin-top:14px">✦ ${t('generateComments')}</button><div id="commentStatus" class="sub" style="margin-top:10px"></div></div><div class="module-list" style="margin-top:15px">${renderForumComments(p)}</div>`;
 $('forumDetailModal').classList.add('show');document.body.style.overflow='hidden';
}
function renderForumComments(p){
 if(!Array.isArray(p.comments)||!p.comments.length)return '<div class="comment-empty">还没有评论。让 AI 自由聊起来吧。</div>';
 return p.comments.map(c=>`<div class="comment-item"><div class="comment-author">${esc(c.author||'AI')} · ${esc(c.date||'')}</div><div class="comment-body">${esc(c.body||'')}</div></div>`).join('');
}
function closeForumDetail(){$('forumDetailModal').classList.remove('show');document.body.style.overflow='';editingForumPostId=''}
function openPersonEditor(id=''){localizeEditors();editingPersonId=id;const p=state.people.find(x=>x.id===id)||{};$('personEditTitle').textContent=id?'EDIT PERSON':'NEW PERSON';$('personName').value=p.name||'';$('personRole').value=p.role||'';$('personPersonality').value=p.personality||'';$('personAppearance').value=p.appearance||'';$('personSpeech').value=p.speech||'';$('personBackground').value=p.background||'';$('personInstructions').value=p.instructions||'';$('personEditModal').classList.add('show');document.body.style.overflow='hidden'}
function closePersonEditor(){ $('personEditModal').classList.remove('show');document.body.style.overflow=''}

async function savePerson(){
 const name=$('personName').value.trim();
 if(!name){toast('请先填写人物名字');$('personName').focus();return}
 try{
  if(!Array.isArray(state.people))state.people=[];
  const obj={id:editingPersonId||'p-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name,role:$('personRole').value.trim(),personality:$('personPersonality').value.trim(),appearance:$('personAppearance').value.trim(),speech:$('personSpeech').value.trim(),background:$('personBackground').value.trim(),instructions:$('personInstructions').value.trim()};
  if(editingPersonId){const i=state.people.findIndex(x=>x.id===editingPersonId);if(i>=0)state.people[i]=obj;else state.people.push(obj)}else state.people.push(obj);
  // IndexedDB is the primary recovery path and is separate from the full localStorage settings blob.
  try{await savePeopleToIndexedDB(state.people)}catch(dbErr){console.error('[LOVE RECORD] IndexedDB contact save failed',dbErr)}
  let mainSaved=true;try{save()}catch(err){mainSaved=false;console.error('[LOVE RECORD] main settings save failed while saving person',err)}
  const recoverySaved=persistPeopleRecovery();
  let dbHasContacts=false;try{dbHasContacts=(await loadPeopleFromIndexedDB()).some(x=>String(x.id)===String(obj.id))}catch{}
  if(!mainSaved&&!recoverySaved&&!dbHasContacts){toast('保存失败：浏览器储存空间不足，且独立联系人储存也失败。请检查浏览器权限/储存空间');return}
  closePersonEditor();renderModule('people');
  toast(mainSaved?'人物已保存 ♡':'人物已保存到独立联系人储存；建议导出备份');
 }catch(err){console.error('[LOVE RECORD] person save failed',err);toast('保存失败：'+(err?.message||'请检查浏览器储存空间'))}
}
function openWorldEditor(id=''){localizeEditors();editingWorldId=id;const w=state.worlds.find(x=>x.id===id)||{};$('worldEditTitle').textContent=id?'EDIT WORLD':'NEW WORLD';$('worldName').value=w.name||'';$('worldDescription').value=w.description||'';$('worldLocations').value=w.locations||'';$('worldRules').value=w.rules||'';$('worldEditModal').classList.add('show');document.body.style.overflow='hidden'}
function closeWorldEditor(){$('worldEditModal').classList.remove('show');document.body.style.overflow=''}
function saveWorld(){const name=$('worldName').value.trim();if(!name){toast('请先填写世界名称');return}const obj={id:editingWorldId||'w-'+Date.now(),name,description:$('worldDescription').value.trim(),locations:$('worldLocations').value.trim(),rules:$('worldRules').value.trim()};if(editingWorldId){const i=state.worlds.findIndex(x=>x.id===editingWorldId);if(i>=0)state.worlds[i]=obj}else state.worlds.push(obj);save();closeWorldEditor();renderModule('world');toast('世界已保存')}
function openJournalEditor(){$('journalTitle').value='';$('journalMood').value='';$('journalNote').value='';$('journalEditModal').classList.add('show');document.body.style.overflow='hidden'}
function closeJournalEditor(){$('journalEditModal').classList.remove('show');document.body.style.overflow=''}
function saveJournal(){const note=$('journalNote').value.trim();if(!note){toast('写一点内容再保存吧');return}state.journal.push({id:'j-'+Date.now(),date:new Date().toLocaleDateString('zh-CN'),title:$('journalTitle').value.trim()||'Untitled',mood:$('journalMood').value.trim(),note});save();closeJournalEditor();renderModule('journal');toast('日记已保存')}
function extractJSONArray(text){let t=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();const a=t.indexOf('['),z=t.lastIndexOf(']');if(a>=0&&z>a)t=t.slice(a,z+1);try{const j=JSON.parse(t);return Array.isArray(j)?j:null}catch{return null}}
async function generateForum(){const topic=$('forumTopic')?.value.trim()||'今天大家都在做什么';const ids=[...document.querySelectorAll('[data-forum-person]:checked')].map(x=>x.value);const participants=state.people.filter(p=>ids.includes(p.id));const count=Math.min(6,Math.max(1,parseInt($('forumCount')?.value||'3',10)||3));if(!participants.length){toast('至少选择一个 AI 人物');return}if(!state.apiBase||!state.apiKey||!state.apiModel){toast('请先在 Settings 连接 API');$('forumStatus').textContent='还没有 API：去 Settings → AI / API 连接后再回来。';return}const prompt=`你正在为一个私人 AI 论坛生成真实自然的社区内容。论坛主题：${topic}。参与人物：${participants.map(p=>`名字=${p.name};身份=${p.role};性格=${p.personality};说话方式=${p.speech};背景=${p.background};AI规则=${p.instructions}`).join('\n')}。请生成 ${count} 条帖子。每条包含 author、title、body、likes；likes 是一个 8 到 120 的自然整数，用于论坛展示的点赞人数；不要生成评论。author 必须来自参与人物。不要替 ${state.name||'用户'} 决定行动。只返回合法 JSON 数组，不要 Markdown，不要解释。`;if(aiBusy){toast('AI 正在处理另一条请求');return}$('forumStatus').textContent='AI 正在生成论坛内容……';aiBusy=true;try{const r=await fetchTimeout(state.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:'你是一个论坛内容生成器。输出必须是合法 JSON 数组。'},{role:'user',content:prompt}],stream:false})},20000);const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status+' · '+raw.slice(0,220));const j=JSON.parse(raw);const txt=extractAIText(j);const arr=extractJSONArray(txt);if(!arr)throw new Error('AI 返回的不是可解析的 JSON 数组');arr.slice(0,count).forEach(x=>state.forumPosts.push({id:'post-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),author:participants.some(p=>p.name===x.author)?x.author:participants[0].name,title:x.title||topic,body:x.body||'',reply:null,comments:[],likes:Number.isFinite(Number(x.likes))?Math.max(0,Math.round(Number(x.likes))):Math.floor(12+Math.random()*89),date:new Date().toLocaleDateString('zh-CN')}));save();renderModule('forum');toast('论坛更新啦 ♡')}catch(e){$('forumStatus').textContent='生成失败：'+apiErrorText(e);toast('论坛生成失败，看一下提示')}finally{aiBusy=false}}
async function generateForumComments(){
 const p=state.forumPosts.find(x=>x.id===editingForumPostId);if(!p)return;
 if(!Array.isArray(p.comments))p.comments=[];
 if(!state.apiBase||!state.apiKey||!state.apiModel){toast('请先在 Settings 连接 API');$('commentStatus').textContent='还没有 API：去 Settings → AI / API 连接后再回来。';return}
 if(aiBusy){toast('AI 正在处理另一条请求');return}
 $('commentStatus').textContent='AI 正在自由生成评论……';aiBusy=true;
 const existing=p.comments.slice(-20).map(c=>`${c.author}：${c.body}`).join('\\n');
 const prompt=`你正在模拟一个自然、活跃但不吵闹的中文私人论坛。请围绕下面这篇帖子，自由生成 7 到 10 条评论。

原帖作者：${p.author}
标题：${p.title}
正文：${p.body}
已有评论（可以自然接话，也可以提出不同观点）：${existing||'暂无'}

重要规则：
1. 评论者完全自由，不受 PEOPLE 人物列表限制。
2. 你可以自行创造论坛用户名、路人、朋友、网友、匿名用户或其他合理身份；不需要用户事先建立这些人物。
3. 评论者之间要有区别，有的人简短，有的人认真，有的人吐槽，有的人接梗，但都要自然。
4. 可以让评论之间互相回复或接话，但每条结果仍然只输出 author 和 body。
5. 不要替 ${state.name||'用户'} 决定行动、想法或现实经历。
6. 不要重复已有评论，不要写成统一的 AI 口吻。
7. 生成 7 到 10 条，不要让用户选择数量。
8. 只返回合法 JSON 数组，不要 Markdown，不要解释。格式：[ { "author": "用户名", "body": "评论内容" } ]`;
 try{
  const r=await fetchTimeout(state.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:'你是一个真实自然的中文论坛评论生成器。评论者不受预设人物列表限制，可以自由创造网友身份。输出必须是合法 JSON 数组。'},{role:'user',content:prompt}],stream:false})},20000);
  const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status+' · '+raw.slice(0,220));
  const j=JSON.parse(raw);const txt=extractAIText(j);const arr=extractJSONArray(txt);if(!arr)throw new Error('AI 返回的不是可解析的 JSON 数组');
  const valid=arr.filter(x=>x&&String(x.body||'').trim()).slice(0,10);
  if(!valid.length)throw new Error('AI 没有返回有效评论');
  valid.forEach(x=>p.comments.push({id:'comment-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),author:String(x.author||'匿名网友').trim()||'匿名网友',body:String(x.body).trim(),date:new Date().toLocaleDateString('zh-CN')}));
  save();openForumDetail(p.id);toast(`${valid.length} 条评论生成啦 ♡`);
 }catch(e){$('commentStatus').textContent='生成失败：'+apiErrorText(e);toast('评论生成失败，看一下提示')}finally{aiBusy=false}
}
function addManualForum(){const author=prompt('谁来发帖？\n可填写 YANYAN 或人物名字。',state.name)||state.name;const title=prompt('帖子标题？','今天的小记录')||'今天的小记录';const body=prompt('帖子内容？','')||'';if(!body)return;state.forumPosts.push({id:'post-'+Date.now(),author,title,body,reply:null,comments:[],likes:0,date:new Date().toLocaleDateString('zh-CN')});save();renderModule('forum');toast('帖子已发布')}

const APPEARANCE_KEY='yanyan-love-appearance-v1';
const appearanceDefaults={preset:'purple',font:'system',fontSize:15,titleScale:1,accent:'#b79bc7',bg:'soft',radius:29,blur:0,opacity:.94,dark:false,motion:true};
let appearance=Object.assign({},appearanceDefaults,JSON.parse(localStorage.getItem(APPEARANCE_KEY)||'{}'));
const fontChoices={system:{name:'SYSTEM',value:'-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif'},clean:{name:'CLEAN',value:'Inter,-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif'},serif:{name:'SERIF',value:'Georgia,"Times New Roman",serif'},round:{name:'ROUND',value:'ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif'}};
const accentChoices=[['#b79bc7','#b79bc7'],['#c89bb0','#c89bb0'],['#9faed0','#9faed0'],['#a9c4a2','#a9c4a2'],['#c7ad8b','#c7ad8b'],['#8e6fae','#8e6fae']];
const bgChoices={soft:{name:'SOFT PURPLE',a:'#f2e8f5',b:'#e9dfee'},cream:{name:'CREAM',a:'#f8f1e7',b:'#eee4d7'},mist:{name:'MIST BLUE',a:'#e8eef7',b:'#dfe7f1'},rose:{name:'SOFT ROSE',a:'#f6e9ef',b:'#eadce5'},plain:{name:'CLEAN',a:'#f7f3f9',b:'#f7f3f9'}};
const presetChoices={purple:{name:'柔雾紫',font:'system',fontSize:15,titleScale:1,accent:'#b79bc7',bg:'soft',radius:29,blur:8,opacity:.92,dark:false,motion:true},night:{name:'夜色紫',font:'serif',fontSize:15,titleScale:1.04,accent:'#9f83bd',bg:'soft',radius:26,blur:14,opacity:.78,dark:true,motion:true},cream:{name:'清晨奶油',font:'round',fontSize:16,titleScale:1.02,accent:'#b79bc7',bg:'cream',radius:32,blur:4,opacity:.96,dark:false,motion:false}};
function saveAppearance(){localStorage.setItem(APPEARANCE_KEY,JSON.stringify(appearance))}
function applyAppearance(){const root=document.documentElement;root.style.setProperty('--ui-font-size',appearance.fontSize+'px');root.style.setProperty('--ui-scale',String(appearance.fontSize/15));root.style.setProperty('--title-scale',String(appearance.titleScale));root.style.setProperty('--accent',appearance.accent);root.style.setProperty('--accent-soft',appearance.accent);root.style.setProperty('--card-radius',appearance.radius+'px');root.style.setProperty('--card-blur',appearance.blur+'px');root.style.setProperty('--card-opacity',appearance.opacity);const bg=bgChoices[appearance.bg]||bgChoices.soft;root.style.setProperty('--preview-a',bg.a);root.style.setProperty('--preview-b',bg.b);root.style.setProperty('--scene-a',bg.a);root.style.setProperty('--scene-b',bg.b);document.body.style.fontFamily=fontChoices[appearance.font]?.value||fontChoices.system.value;document.body.classList.toggle('dark-mode',!!appearance.dark);document.body.style.backgroundImage=appearance.bgData?'url('+appearance.bgData+')':'';document.body.style.backgroundSize=appearance.bgData?'cover':'';document.body.style.backgroundAttachment=appearance.bgData?'fixed':'';document.body.style.backgroundPosition=appearance.bgData?'center':'';document.documentElement.style.setProperty('--card-shadow',appearance.dark?'0 18px 45px rgba(0,0,0,.25)':'0 18px 45px rgba(77,58,88,.07)');document.documentElement.style.setProperty('--soft',appearance.dark?'#30263a':'#eee5f2');if(!appearance.motion){document.documentElement.style.setProperty('--motion-duration','0s')}else{document.documentElement.style.setProperty('--motion-duration','.25s')}saveAppearance();updateAppearanceControls()}
function renderAppearanceControls(){const pg=$('presetGrid');pg.innerHTML=Object.entries(presetChoices).map(([k,v])=>'<button class="appearance-option '+(appearance.preset===k?'active':'')+'" type="button" data-preset="'+k+'">'+esc(v.name)+'</button>').join('');const fg=$('fontGrid');fg.innerHTML=Object.entries(fontChoices).map(([k,v])=>'<button class="appearance-option '+(appearance.font===k?'active':'')+'" type="button" data-font="'+k+'" style="font-family:'+v.value+'">'+esc(v.name)+'</button>').join('');$('accentSwatches').innerHTML=accentChoices.map(([k])=>'<button class="swatch '+(appearance.accent===k?'active':'')+'" type="button" data-accent="'+k+'" style="background:'+k+'" aria-label="'+k+'"></button>').join('');$('backgroundGrid').innerHTML=Object.entries(bgChoices).map(([k,v])=>'<button class="appearance-option '+(appearance.bg===k?'active':'')+'" type="button" data-bg="'+k+'">'+esc(v.name)+'</button>').join('');updateAppearanceControls()}
function updateAppearanceControls(){$('fontSizeRange').value=appearance.fontSize;$('fontSizeValue').textContent=appearance.fontSize+'px';$('titleScaleRange').value=appearance.titleScale;$('titleScaleValue').textContent=Math.round(appearance.titleScale*100)+'%';$('radiusRange').value=appearance.radius;$('radiusValue').textContent=appearance.radius+'px';$('blurRange').value=appearance.blur;$('blurValue').textContent=appearance.blur+'px';$('opacityRange').value=appearance.opacity;$('opacityValue').textContent=Math.round(appearance.opacity*100)+'%';$('customAccent').value=appearance.accent;$('motionToggle').textContent=appearance.motion?'MOTION ON':'MOTION OFF';$('lightModeBtn').classList.toggle('active',!appearance.dark);$('darkModeBtn').classList.toggle('active',appearance.dark);document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('active',x.dataset.preset===appearance.preset));document.querySelectorAll('[data-font]').forEach(x=>x.classList.toggle('active',x.dataset.font===appearance.font));document.querySelectorAll('[data-accent]').forEach(x=>x.classList.toggle('active',x.dataset.accent===appearance.accent));document.querySelectorAll('[data-bg]').forEach(x=>x.classList.toggle('active',x.dataset.bg===appearance.bg));const pv=$('appearancePreview');if(pv){pv.style.fontFamily=fontChoices[appearance.font]?.value||fontChoices.system.value}}
function openAppearance(){localizeEditors();renderAppearanceControls();$('appearanceModal').classList.add('show');document.body.style.overflow='hidden'}
function closeAppearance(){ $('appearanceModal').classList.remove('show');document.body.style.overflow='';applyAppearance()}
function applyPreset(k){if(!presetChoices[k])return;appearance=Object.assign({},appearanceDefaults,presetChoices[k]);appearance.preset=k;applyAppearance();renderAppearanceControls();toast('已切换：'+presetChoices[k].name)}
$('openAppearance').onclick=openAppearance;$('closeAppearance').onclick=closeAppearance;$('appearanceModal').addEventListener('click',e=>{if(e.target.id==='appearanceModal')closeAppearance()});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('appearanceModal').classList.contains('show')){closeAppearance();return}if($('forumDetailModal').classList.contains('show')){closeForumDetail();return}if($('spacePersonModal').classList.contains('show')){closePersonSpace();return}if($('selfPersonaEditModal').classList.contains('show')){closeSelfPersonaEditor();return}if($('moduleModal').classList.contains('show')){closeModule();return}});
$('presetGrid').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(b)applyPreset(b.dataset.preset)});
$('fontGrid').addEventListener('click',e=>{const b=e.target.closest('[data-font]');if(!b)return;appearance.font=b.dataset.font;appearance.preset='custom';applyAppearance();renderAppearanceControls()});
$('accentSwatches').addEventListener('click',e=>{const b=e.target.closest('[data-accent]');if(!b)return;appearance.accent=b.dataset.accent;appearance.preset='custom';applyAppearance();renderAppearanceControls()});
$('backgroundGrid').addEventListener('click',e=>{const b=e.target.closest('[data-bg]');if(!b)return;appearance.bg=b.dataset.bg;appearance.bgData='';appearance.preset='custom';applyAppearance();renderAppearanceControls()});
$('fontSizeRange').oninput=e=>{appearance.fontSize=+e.target.value;appearance.preset='custom';applyAppearance()};
$('titleScaleRange').oninput=e=>{appearance.titleScale=+e.target.value;appearance.preset='custom';applyAppearance()};
$('radiusRange').oninput=e=>{appearance.radius=+e.target.value;appearance.preset='custom';applyAppearance()};
$('blurRange').oninput=e=>{appearance.blur=+e.target.value;appearance.preset='custom';applyAppearance()};
$('opacityRange').oninput=e=>{appearance.opacity=+e.target.value;appearance.preset='custom';applyAppearance()};
$('useCustomAccent').onclick=()=>{appearance.accent=$('customAccent').value;appearance.preset='custom';applyAppearance();renderAppearanceControls()};
$('lightModeBtn').onclick=()=>{appearance.dark=false;appearance.preset='custom';applyAppearance();renderAppearanceControls()};
$('darkModeBtn').onclick=()=>{appearance.dark=true;appearance.preset='custom';applyAppearance();renderAppearanceControls()};
$('motionToggle').onclick=()=>{appearance.motion=!appearance.motion;appearance.preset='custom';applyAppearance()};
$('resetAppearance').onclick=()=>{appearance=Object.assign({},appearanceDefaults);applyAppearance();renderAppearanceControls();toast('已经恢复默认外观')};
$('appearanceBgFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f)});const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url});const max=1400;const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);appearance.bgData=c.toDataURL('image/jpeg',.76);appearance.bg='plain';appearance.preset='custom';applyAppearance();renderAppearanceControls();toast('背景已换成你的照片')}catch(err){toast('背景照片读取失败，请换一张试试')}};
applyAppearance();

// Durable small settings store: keep API presets and launcher layout out of quota-limited localStorage.
const LR_KV_DB='love-record-kv-v1',LR_KV_STORE='settings';
function lrKVOpen(){return new Promise((resolve,reject)=>{try{const r=indexedDB.open(LR_KV_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(LR_KV_STORE))r.result.createObjectStore(LR_KV_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB open failed'))}catch(e){reject(e)}})}
async function lrKVGet(key){const d=await lrKVOpen();return new Promise((resolve,reject)=>{const r=d.transaction(LR_KV_STORE,'readonly').objectStore(LR_KV_STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('IndexedDB read failed'))})}
async function lrKVSet(key,value){const d=await lrKVOpen();return new Promise((resolve,reject)=>{const tx=d.transaction(LR_KV_STORE,'readwrite');tx.objectStore(LR_KV_STORE).put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error('IndexedDB write failed'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB write aborted'))})}
// Persistent multi-page phone launcher. Long-press to drag; swipe horizontally to switch pages.
(function(){
 const grid=document.querySelector('#launcher .launcher-grid'),pages=document.querySelector('#launcherPages');if(!grid||!pages)return;
 const getId=el=>el?.dataset?.dragId;const getApps=()=>Array.from(grid.querySelectorAll('.launcher-app[data-drag-id]'));
 const ORDER_KEY='love-record-launcher-grid-order-v4',PAGE_KEY='love-record-launcher-pages-v2',LAYOUT_KV='launcher-layout-v2';
 // Initial arrangement mirrors the user's confirmed layout: community on page 1; shopping, food, memories and journal on page 2.
 const defaultOrder=['app-space','app-chat','app-music','app-community','app-foodie','app-memories','app-journal'];
 let order=defaultOrder.slice(),pageMap={'app-foodie':1,'app-memories':1,'app-journal':1},currentPage=0,active=null,timer=null,dragged=false,startPoint=null,swipe=null,layoutWriteSeq=0,layoutReady=false;
 try{const x=JSON.parse(localStorage.getItem(ORDER_KEY)||'null');if(Array.isArray(x))order=x}catch{}try{const savedPages=JSON.parse(localStorage.getItem(PAGE_KEY)||'null');if(savedPages&&typeof savedPages==='object')pageMap={...pageMap,...savedPages}}catch{}
 const normalize=()=>{const ids=getApps().map(getId),seen=new Set();order=(order||[]).filter(id=>ids.includes(id)&&!seen.has(id)&&seen.add(id));ids.forEach(id=>{if(!seen.has(id))order.push(id)});getApps().forEach(el=>{if(pageMap[getId(el)]!==1)pageMap[getId(el)]=0})};
 const persist=()=>{const snap={order:order.slice(),pageMap:{...pageMap}};const seq=++layoutWriteSeq;lrKVSet(LAYOUT_KV,snap).then(()=>{if(seq===layoutWriteSeq){try{localStorage.setItem(ORDER_KEY,JSON.stringify(snap.order));localStorage.setItem(PAGE_KEY,JSON.stringify(snap.pageMap))}catch(e){/* IndexedDB is the primary durable copy; localStorage may be full. */}}}).catch(e=>{console.warn('[LOVE RECORD] IndexedDB launcher layout save failed',e);try{localStorage.setItem(ORDER_KEY,JSON.stringify(snap.order));localStorage.setItem(PAGE_KEY,JSON.stringify(snap.pageMap));localStorage.removeItem('love-record-launcher-grid-order-backup-v1')}catch(err){if(typeof toast==='function')toast('布局保存失败：独立储存不可用，请导出备份并检查浏览器权限')}})};
 function render(){normalize();getApps().forEach(el=>{const id=getId(el);el.hidden=(pageMap[id]||0)!==currentPage;el.style.order=String(order.indexOf(id));el.style.removeProperty('transform');el.classList.remove('is-dragging')});pages.querySelectorAll('button').forEach(b=>b.classList.toggle('active',Number(b.dataset.launcherPage)===currentPage));pages.querySelectorAll('button').forEach(b=>b.style.display='block')}
 function setPage(n){if(!layoutReady)return;currentPage=Math.max(0,Math.min(1,n));render();persist()}
 pages.addEventListener('click',e=>{const b=e.target.closest('[data-launcher-page]');if(b)setPage(Number(b.dataset.launcherPage))});
 grid.addEventListener('touchstart',e=>{if(e.target.closest('.launcher-app'))return;const t=e.touches[0];swipe={x:t.clientX,y:t.clientY}}, {passive:true});
 grid.addEventListener('touchend',e=>{if(!swipe)return;const t=e.changedTouches[0],dx=t.clientX-swipe.x,dy=t.clientY-swipe.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2)setPage(currentPage+(dx<0?1:-1));swipe=null},{passive:true});
 document.addEventListener('pointerdown',e=>{if(!layoutReady)return;const el=e.target.closest('#launcher .launcher-app[data-drag-id]');if(!el||el.hidden||e.button!==0||e.target.closest('input,textarea,button:not(.launcher-app)'))return;active={el,id:getId(el),startX:e.clientX,startY:e.clientY,pointerId:e.pointerId};dragged=false;startPoint={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{if(!active)return;dragged=true;active.el.classList.add('is-dragging');try{active.el.setPointerCapture(active.pointerId)}catch{}if(navigator.vibrate)navigator.vibrate(18);if(typeof toast==='function')toast('拖动图标整理位置；拖到右侧页面点可移到第二页')},420)});
 document.addEventListener('pointermove',e=>{if(!active||e.pointerId!==active.pointerId)return;if(!dragged){if(Math.hypot(e.clientX-active.startX,e.clientY-active.startY)>12){clearTimeout(timer);timer=null;active=null}return}if(e.cancelable)e.preventDefault();active.el.style.setProperty('transform',`translate3d(${e.clientX-active.startX}px,${e.clientY-active.startY}px,0)`,'important')},{passive:false});
 function finish(e){clearTimeout(timer);timer=null;if(active&&dragged){const moved=active.el,x=Number.isFinite(e?.clientX)?e.clientX:startPoint.x,y=Number.isFinite(e?.clientY)?e.clientY:startPoint.y;const dot2=pages.querySelector('[data-launcher-page="1"]')?.getBoundingClientRect();if(dot2&&x>=dot2.left-22&&x<=dot2.right+22&&y>=dot2.top-30&&y<=dot2.bottom+30){pageMap[getId(moved)]=1;currentPage=1}else{const others=getApps().filter(el=>el!==moved&&!el.hidden);let target=null,best=Infinity;for(const el of others){const r=el.getBoundingClientRect(),d=Math.hypot(x-(r.left+r.width/2),y-(r.top+r.height/2));if(d<best){best=d;target=el}}const visibleOrder=order.filter(id=>(pageMap[id]||0)===currentPage&&id!==getId(moved));let idx=target?visibleOrder.indexOf(getId(target)):visibleOrder.length;if(idx<0)idx=visibleOrder.length;visibleOrder.splice(idx,0,getId(moved));order=order.filter(id=>!visibleOrder.includes(id));const pageIds=order.filter(id=>(pageMap[id]||0)===currentPage);order=[...order.filter(id=>(pageMap[id]||0)!==currentPage),...visibleOrder];if(!visibleOrder.length)order.push(getId(moved));pageMap[getId(moved)]=currentPage}persist();render();window.__launcherJustDragged=Date.now();if(e?.cancelable)e.preventDefault()}else if(active?.el){active.el.classList.remove('is-dragging');active.el.style.removeProperty('transform')}active=null;dragged=false;startPoint=null}
 document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);window.addEventListener('pagehide',persist);
 document.addEventListener('click',e=>{if(window.__launcherJustDragged&&Date.now()-window.__launcherJustDragged<700&&e.target.closest('#launcher .launcher-app[data-drag-id]')){e.preventDefault();e.stopImmediatePropagation()}},true);
 // Hydrate the durable layout BEFORE the first render. Previously render() immediately
 // persisted defaults, which could overwrite the saved IndexedDB layout during startup.
 (async()=>{let restored=false;try{const saved=await lrKVGet(LAYOUT_KV);if(saved&&Array.isArray(saved.order)&&saved.pageMap&&typeof saved.pageMap==='object'){order=saved.order.slice();pageMap={...saved.pageMap};restored=true}}catch(e){console.warn('[LOVE RECORD] launcher layout restore skipped',e)}normalize();layoutReady=true;render();if(!restored)persist()})();window.__loveRecordLauncherSetPage=setPage;
})();
document.addEventListener('click',e=>{
const spaceLaunch=e.target.closest('[data-space-v2-launch]');if(spaceLaunch){if(typeof window.openLoveRecordSpaceV2==='function'){e.preventDefault();e.stopImmediatePropagation();window.openLoveRecordSpaceV2();return}e.preventDefault();return}const launchPage=e.target.closest('[data-launch-page]');if(launchPage){nav(launchPage.dataset.launchPage);return}
const launchModule=e.target.closest('[data-launch-module]');if(launchModule){openModule(launchModule.dataset.launchModule);return}
const launchAppearance=e.target.closest('[data-launch-appearance]');if(launchAppearance){openAppearance();return}
const launchHome=e.target.closest('[data-launch-home]');if(launchHome){nav('launcher');return}
const n=e.target.closest('.nav-btn');if(n){nav(n.dataset.page);return}const c=e.target.closest('[data-choice]');if(c){handleChoice(c.dataset.choiceText||'');return}const d=e.target.closest('[data-delete]');if(d){deleteImage(+d.dataset.delete).then(()=>{renderMemories();toast('Memory deleted')});return}});

// API presets are stored in IndexedDB first, so full localStorage does not block saving.
const API_PRESETS_KEY='love-record-api-presets-v1',API_PRESETS_KV='api-presets-v1';let apiPresetCache=[];
function readApiPresets(){return apiPresetCache.slice()}
async function loadApiPresets(){try{const v=await lrKVGet(API_PRESETS_KV);if(Array.isArray(v)&&v.length)apiPresetCache=v.filter(x=>x&&x.id);else{try{const old=JSON.parse(localStorage.getItem(API_PRESETS_KEY)||'[]');if(Array.isArray(old))apiPresetCache=old.filter(x=>x&&x.id);if(apiPresetCache.length)await lrKVSet(API_PRESETS_KV,apiPresetCache)}catch(e){}}}catch(e){console.warn('[LOVE RECORD] API preset IndexedDB read failed',e);try{const a=JSON.parse(localStorage.getItem(API_PRESETS_KEY)||'[]');if(Array.isArray(a))apiPresetCache=a.filter(x=>x&&x.id)}catch{}}renderApiPresets()}
async function writeApiPresets(list){try{await lrKVSet(API_PRESETS_KV,list);apiPresetCache=list.filter(x=>x&&x.id);try{localStorage.setItem(API_PRESETS_KEY,JSON.stringify(apiPresetCache))}catch(e){/* primary IndexedDB save succeeded */}return true}catch(e){console.warn('[LOVE RECORD] API presets IndexedDB save failed',e);try{localStorage.setItem(API_PRESETS_KEY,JSON.stringify(list));apiPresetCache=list.filter(x=>x&&x.id);return true}catch(err){return false}}}
function renderApiPresets(){const box=$('apiPresetList');if(!box)return;const list=readApiPresets();box.innerHTML='';if(!list.length){box.innerHTML='<div class="sub">还没有预设。填写站点和模型后，点击「保存预设」即可保存。</div>';return}list.forEach(p=>{const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.58)';const info=document.createElement('div');info.style.cssText='flex:1;min-width:120px';const name=document.createElement('strong');name.textContent=p.name||'未命名预设';name.style.display='block';const detail=document.createElement('small');detail.textContent=(p.apiBase||'未填写站点')+' · '+(p.apiModel||'未选模型');detail.style.cssText='display:block;opacity:.65;overflow-wrap:anywhere;margin-top:3px';info.append(name,detail);const use=document.createElement('button');use.type='button';use.className='btn';use.textContent='切换';use.onclick=()=>{state.apiBase=p.apiBase||'';state.apiKey=p.apiKey||'';state.apiModel=p.apiModel||'';state.modelList=Array.isArray(p.modelList)?p.modelList:[];$('apiPresetName').value=p.name||'';const ok=save();$('apiBase').value=state.apiBase;$('apiKey').value=state.apiKey;renderModelPicker();updateAIState();$('apiStatus').textContent=state.apiBase&&state.apiKey?'已载入预设 · '+(state.apiModel||'待选择模型'):'预设已载入，请补全 API 信息';$('apiStatus').classList.toggle('on',!!(state.apiBase&&state.apiKey&&state.apiModel));$('apiPresetStatus').textContent=ok?'已切换到「'+(p.name||'未命名预设')+'」并保存当前配置。':'已从独立储存载入预设；主设置保存失败，刷新后配置可能需要重新切换。';toast(ok?'已切换 API 预设 ♡':'已切换预设，但主设置保存失败')};const del=document.createElement('button');del.type='button';del.className='btn';del.textContent='删除';del.onclick=async()=>{if(!confirm('确定删除预设「'+(p.name||'未命名预设')+'」？'))return;const next=readApiPresets().filter(x=>x.id!==p.id);const ok=await writeApiPresets(next);renderApiPresets();$('apiPresetStatus').textContent=ok?'预设已删除并保存。':'删除失败：独立储存和浏览器储存均不可用。'};row.append(info,use,del);box.append(row)})}
async function saveCurrentApiPreset(addNew){const name=($('apiPresetName')?.value||'').trim();const apiBase=$('apiBase')?.value.trim().replace(/\/+$/,'')||'';const apiKey=$('apiKey')?.value.trim()||'';const apiModel=state.apiModel||'';if(!name){$('apiPresetStatus').textContent='请先填写预设名称。';toast('请填写预设名称');return}if(!apiBase||!apiKey){$('apiPresetStatus').textContent='请先填写 API Base URL 和 API Key。';toast('请先填写站点和 Key');return}const list=readApiPresets();const existing=!addNew?list.find(x=>x.name===name):null;const profile={id:existing?.id||('api-preset-'+Date.now()),name,apiBase,apiKey,apiModel,modelList:Array.isArray(state.modelList)?state.modelList:[],updatedAt:Date.now()};const next=existing?list.map(x=>x.id===existing.id?profile:x):[...list,profile];const saved=await writeApiPresets(next);if(!saved){$('apiPresetStatus').textContent='保存失败：独立储存和浏览器储存均不可用。请先导出备份并检查浏览器权限。';toast('API 预设保存失败');return}state.apiBase=apiBase;state.apiKey=apiKey;state.language='zh';const stateSaved=save();$('apiBase').value=apiBase;$('apiKey').value=apiKey;renderApiPresets();$('apiPresetStatus').textContent=(existing?'已更新':'已新增')+'预设「'+name+'」：预设已保存成功 ♡'+(stateSaved?'':'（当前主设置未能保存；预设本身已安全保存）');toast((existing?'预设已更新':'预设已添加')+' ♡')}
$('saveApiPreset').onclick=()=>saveCurrentApiPreset(false);$('addApiPreset').onclick=()=>saveCurrentApiPreset(true);
$('apiPresetName').addEventListener('change',()=>{const p=readApiPresets().find(x=>x.name===$('apiPresetName').value.trim());if(p){$('apiBase').value=p.apiBase||'';$('apiKey').value=p.apiKey||'';state.apiModel=p.apiModel||'';state.modelList=p.modelList||[];renderModelPicker()}});
loadApiPresets();

$('chatSend').onclick=sendChatMessage;
const chatPicker=$('chatPeoplePicker');
chatPicker.addEventListener('change',e=>{if(e.target.matches('input[type="checkbox"]'))e.target.closest('.chat-picker-item')?.classList.toggle('selected',e.target.checked)},true);
chatPicker.addEventListener('pointerup',e=>{const b=e.target.closest('#chatConfirmPeople');if(b){e.preventDefault();e.stopPropagation();confirmChatPeople()}},true);
// Remove duplicate compose-plus controls left by legacy UI injections; keep the single canonical button.
 document.querySelectorAll('#chat .chat-compose-plus').forEach((b,i)=>{if(i>0)b.remove()});
 // The unified action menu is injected by chat-interaction-v11.js; avoid rendering a second plus button.
window.addEventListener('lr-life-order-created',e=>{const o=e.detail||{},ctx=(()=>{try{return JSON.parse(localStorage.getItem('lr-life-chat-context-v1')||'{}')}catch{return {}}})();const cid=String(o.contactId||ctx.contactId||'');const person=contactById(cid);if(!cid||!person)return;const threads=readChatThreads(),items=threads[cid]||[],kind=o.orderKind==='food'?'food':'shop',placedBy=o.placedBy==='ai'?'ai':'user',sender=placedBy==='ai'?(person.name||'TA'):(()=>{try{return JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}').name||'用户'}catch{return '用户'}})(),recipient=placedBy==='ai'?'你':(person.name||'TA'),names=(o.items||[]).map(x=>(x.name||'商品')+' × '+(x.qty||1)).join('、')||'订单已创建';items.push({role:placedBy==='ai'?'assistant':'user',text:'[[LR_ORDER|'+kind+'|'+sender+'|'+recipient+'|'+(o.orderNo||'订单已创建')+'|'+names+'|RMB '+(Number(o.total)||0).toFixed(2)+']]',at:Date.now()});threads[cid]=items;try{writeChatThreads(threads)}catch(err){console.error('[LOVE RECORD] order chat message save failed',err);toast('订单已保存，但聊天卡片未能保存，请检查储存空间');return}if(String(activeChatContactId)===cid)renderChat();});

$('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMessage()}});
$('chatAddClose').onclick=closeChatAdd;$('chatAddModal').addEventListener('click',e=>{if(e.target.id==='chatAddModal')closeChatAdd();const b=e.target.closest('#chatConfirmPeople');if(b){e.preventDefault();confirmChatPeople()}});$('chatAddFromPeople').onclick=renderChatPeoplePicker;$('chatBackToContacts').onclick=()=>{activeChatContactId='';renderChat()};$('chatPeoplePicker').addEventListener('click',e=>{if(e.target.id==='chatConfirmPeople')confirmChatPeople()});$('chatContacts').addEventListener('click',e=>{const b=e.target.closest('[data-chat-open]');if(b)openChatContact(b.dataset.chatOpen);if(e.target.id==='chatEmptyAdd')openChatAdd()});$('systemAppbarAction').addEventListener('click',()=>{if(!$('chat').classList.contains('active'))return;if($('chat').classList.contains('is-conversation'))openChatSettings();else openChatAdd()});
$('chatSettingsBack').onclick=closeChatSettings;$('chatSaveSettings').onclick=saveChatSettings;$('chatChooseAvatar').onclick=()=>$('chatAvatarFile').click();$('chatChooseBackground').onclick=()=>$('chatBackgroundFile').click();$('chatClearBackground').onclick=()=>{editingChatMeta.background='#f7f3f9';editingChatMeta.backgroundImage='';document.querySelectorAll('.chat-bg-option').forEach(b=>b.classList.toggle('active',b.dataset.chatBg==='#f7f3f9'))};$('chatAvatarFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{editingChatMeta.avatar=await imageToChatData(f,640,.88);$('chatSettingsAvatarPreview').innerHTML='<img src="'+editingChatMeta.avatar+'" alt="">'}catch{toast('头像读取失败')}e.target.value=''};$('chatBackgroundFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{editingChatMeta.backgroundImage=await imageToChatData(f,2200,.94);document.querySelectorAll('.chat-bg-option').forEach(b=>b.classList.remove('active'))}catch{toast('背景读取失败')}e.target.value=''};document.querySelectorAll('.chat-bg-option').forEach(b=>b.onclick=()=>{editingChatMeta.background=b.dataset.chatBg;editingChatMeta.backgroundImage='';document.querySelectorAll('.chat-bg-option').forEach(x=>x.classList.toggle('active',x===b))});
$('homeUpload').onclick=()=>$('homeFile').click();
$('homeFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;for(const x of await getImages('home'))await deleteImage(x.id);await addImage('home',f,'');e.target.value='';renderHome();toast('Photo added')};
$('homeClear').onclick=async()=>{for(const x of await getImages('home'))await deleteImage(x.id);renderHome();toast('Photo cleared')};
$('addMemory').onclick=async()=>{const f=$('memoryFile').files[0];if(!f){toast('先选照片');return}await addImage('memory',f,$('memoryNote').value.trim());$('memoryFile').value='';$('memoryNote').value='';renderMemories();toast('Memory saved')};
$('saveSettings').onclick=()=>{state.startDate=$('setDate').value;state.today=$('setToday').value.trim()||defaults.today;state.language='zh';const ok=save();renderHome();renderScene();if(typeof window.refreshLoveRecordListeningRoom==='function')window.refreshLoveRecordListeningRoom();toast(ok?'已保存修改 ♡':'保存失败：浏览器储存空间不足')};

$('connectApi').onclick=async()=>{state.apiBase=$('apiBase').value.trim().replace(/\/+$/,'');state.apiKey=$('apiKey').value.trim();save();await loadModels()}
$('refreshModels').onclick=loadModels;
$('testApi').onclick=testAI;
$('modelPicker').addEventListener('click',e=>{const b=e.target.closest('[data-model]');if(!b)return;const m=b.dataset.model;if(!m)return;state.apiModel=m;save();renderModelPicker();updateAIState();$('apiStatus').textContent='API 已连接 · '+state.apiModel;$('apiStatus').classList.add('on');setApiDebug('已切换模型：'+m+'。TEST AI 将使用这个模型。',true);toast('已切换到 '+m)});

$('sendFree').onclick=handleFree;
$('freeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();handleFree()}});
$('surprise').onclick=surprise;
$('installHelp').onclick=()=>toast('Chrome ⋮ → 添加到主屏幕 / 安装应用');

$('moduleClose').onclick=closeModule;$('moduleModal').addEventListener('click',e=>{if(e.target.id==='moduleModal')closeModule()});
$('selfPersonaEditModal').addEventListener('click',e=>{if(e.target.id==='selfPersonaEditModal')closeSelfPersonaEditor()});
$('personEditClose').onclick=closePersonEditor;$('cancelPerson').onclick=closePersonEditor;$('savePerson').onclick=savePerson;$('selfPersonaEditClose').onclick=closeSelfPersonaEditor;$('cancelSelfPersona').onclick=closeSelfPersonaEditor;$('saveSelfPersona').onclick=saveSelfPersona;$('addSelfPersona').onclick=()=>openSelfPersonaEditor();
$('worldEditClose').onclick=closeWorldEditor;$('cancelWorld').onclick=closeWorldEditor;$('saveWorld').onclick=saveWorld;
$('journalEditClose').onclick=closeJournalEditor;$('cancelJournal').onclick=closeJournalEditor;$('saveJournal').onclick=saveJournal;$('spacePersonClose').onclick=closePersonSpace;$('spaceBackToDirectory').onclick=()=>setSpaceView('directory');$('spaceHistoryOpen').onclick=()=>{renderOurHistory();setSpaceView('history')};$('spaceHistoryBack').onclick=()=>setSpaceView('workspace');$('spacePersonModal').addEventListener('click',e=>{if(e.target.id==='spacePersonModal')closePersonSpace()});$('forumDetailClose').onclick=closeForumDetail;$('forumDetailModal').addEventListener('click',e=>{if(e.target.id==='forumDetailModal')closeForumDetail()});
if(!window.__loveRecordGlobalActionsBound){window.__loveRecordGlobalActionsBound=true;document.addEventListener('click',e=>{
 const open=e.target.closest('[data-open-module]');if(open){openModule(open.dataset.openModule);return}
 const sa=e.target.closest('[data-self-action]');if(sa){const sid=sa.dataset.id;if(sa.dataset.selfAction==='edit'){openSelfPersonaEditor(sid);return}if(sa.dataset.selfAction==='delete'){if(confirm(currentLang()==='zh'?'删除这个自设？':'Delete this persona?')){ensureSelfPersonas();state.selfPersonas=state.selfPersonas.filter(x=>x.id!==sid);save();renderSettings();toast(currentLang()==='zh'?'自设已删除':'Persona deleted')}return}}
 const act=e.target.closest('[data-action]');if(!act)return;const a=act.dataset.action,id=act.dataset.id;
 if(a==='new-person'){openPersonEditor();return} if(a==='edit-person'){openPersonEditor(id);return}
 if(a==='delete-person'){if(confirm('删除这个人物？')){state.people=state.people.filter(x=>x.id!==id);save();removePersonFromIndexedDB(id).catch(e=>console.warn(e));persistPeopleRecovery();renderModule('people');toast('人物已删除')}return}
 if(a==='new-world'){openWorldEditor();return} if(a==='edit-world'){openWorldEditor(id);return}
 if(a==='delete-world'){if(confirm('删除这个世界？')){state.worlds=state.worlds.filter(x=>x.id!==id);save();renderModule('world');toast('世界已删除')}return}
 if(a==='new-journal'){openJournalEditor();return}
 if(a==='delete-journal'){if(confirm('删除这篇日记？')){state.journal=state.journal.filter(x=>x.id!==id);save();renderModule('journal');toast('日记已删除')}return}
 if(a==='delete-history-turn'){deleteHistoryTurn(id);return}
 if(a==='open-person-space'){openPersonSpace(id);return}
 if(a==='new-space'){openNewSpace(id);return}
 if(a==='save-new-space'){saveNewSpace(id);return}
 if(a==='back-person-space'){const p=state.people.find(x=>x.id===id);if(p)renderPersonSpaceModal(p);return}
 if(a==='continue-space'){continueSpace(id);return}
 if(a==='edit-space'){openEditSpace(id);return}
 if(a==='save-edit-space'){saveEditSpace(id);return}
 if(a==='delete-space'){deleteSpace(id);return}
 if(a==='generate-forum'){generateForum();return} if(a==='manual-forum'){addManualForum();return} if(a==='open-post'){openForumDetail(id);return} if(a==='generate-comments'){generateForumComments();return}
 if(a==='delete-post'){if(confirm('删除这条帖子？')){state.forumPosts=state.forumPosts.filter(x=>x.id!==id);save();renderModule('forum');toast('帖子已删除')}return}
});}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBox').classList.add('show')});
$('installBtn').onclick=async()=>{if(!deferredPrompt){toast('请打开浏览器菜单 → 添加到主屏幕');return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBox').classList.remove('show')};
window.addEventListener('appinstalled',()=>{$('installBox').classList.remove('show');toast('已经加入主屏幕啦')});

function updateSystemTime(){
 const el=document.getElementById('systemTime');if(!el)return;
 el.textContent=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
}
updateSystemTime();setInterval(updateSystemTime,30000);
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
(async()=>{state.language='zh';ensureSelfPersonas();ensureWorldData();if(state.activeSpaceId&&state.spaces.some(x=>x.id===state.activeSpaceId)){activeSpaceId=state.activeSpaceId;state.events=(state.spaces.find(x=>x.id===activeSpaceId)?.events||[]).slice()}await openDB();renderHome();renderMemories();renderSettings();renderSpacePeople();renderScene();applyLanguage()})();

const loveIntro=document.getElementById('loveIntro');
if(loveIntro){
  window.setTimeout(()=>{loveIntro.setAttribute('aria-hidden','true')},2900);
}
