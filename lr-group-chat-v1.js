/* LOVE RECORD · Group Chat 1.0
   Isolated group data, natural multi-character turn scheduler and group management.
   Does not write to the existing private-chat thread store. */
(function(){
'use strict';
if(window.__LRGroupChatV1)return;window.__LRGroupChatV1=true;
const DB_NAME='love-record-group-chat-v1',DB_VERSION=1;
const STORE_GROUPS='groups',STORE_MESSAGES='messages',STORE_TURNS='turns';
const $=id=>document.getElementById(id);
const host=()=>window.LRGroupChatHost||{};
let dbPromise=null,activeGroupId='',busy=false,sending=false,settingsOpen=false,settingsGroupId='',groupAvatarDraft='',groupBackgroundDraft='',groupToolMode='';
let quoteDraft=null,groupSelectionMode=false,selectedGroupMessageIds=new Set(),groupPressTimer=null,groupLongPressTriggered=false,groupTransferDecisionId='',groupPressStartX=0,groupPressStartY=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const makeId=prefix=>prefix+'_'+(crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10));
const getPerson=id=>host().getPerson?.(String(id))||null;
const getName=id=>host().contactName?.(String(id))||getPerson(id)?.name||'已删除联系人';
const notify=msg=>host().toast?.(msg);
/* Keep group-chat navigation state separate from the legacy private-chat body class.
   The legacy nav() and renderChat() routines may reset body classes/styles, so the
   root data attribute and the nav's hidden state are the authoritative guard. */
function setGroupDockMode(mode){
 const root=document.documentElement;
 if(mode){
  root.setAttribute('data-lr-group-chat-mode',mode);
  root.classList.add('lr-chat-dock-hidden');
 }else{
  root.removeAttribute('data-lr-group-chat-mode');
  root.classList.remove('lr-chat-dock-hidden');
 }
 document.querySelectorAll('nav.nav, .nav[aria-label="Dock"]').forEach(dock=>{
  if(mode){dock.hidden=true;dock.setAttribute('aria-hidden','true');dock.style.setProperty('display','none','important');dock.style.setProperty('visibility','hidden','important');dock.style.setProperty('pointer-events','none','important');}
  else{dock.hidden=false;dock.removeAttribute('aria-hidden');dock.style.removeProperty('display');dock.style.removeProperty('visibility');dock.style.removeProperty('pointer-events');}
 });
}
function openDB(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(STORE_GROUPS))db.createObjectStore(STORE_GROUPS,{keyPath:'id'});
   if(!db.objectStoreNames.contains(STORE_MESSAGES)){const st=db.createObjectStore(STORE_MESSAGES,{keyPath:'id'});st.createIndex('groupId','groupId',{unique:false});st.createIndex('createdAt','createdAt',{unique:false});}
   if(!db.objectStoreNames.contains(STORE_TURNS)){const st=db.createObjectStore(STORE_TURNS,{keyPath:'id'});st.createIndex('groupId','groupId',{unique:false});}
  };
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('群聊数据库打开失败'));req.onblocked=()=>reject(new Error('群聊数据库正在被其他页面占用，请关闭重复页面后重试'));
 });
 return dbPromise;
}
async function getAll(store){const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error||new Error('群聊数据读取失败'))})}
async function getOne(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('群聊数据读取失败'))})}
async function putOne(store,value){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error('群聊数据保存失败'));tx.onabort=()=>reject(tx.error||new Error('群聊数据保存中断'))})}
async function deleteGroupData(groupId){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction([STORE_GROUPS,STORE_MESSAGES,STORE_TURNS],'readwrite');tx.objectStore(STORE_GROUPS).delete(groupId);for(const storeName of [STORE_MESSAGES,STORE_TURNS]){const store=tx.objectStore(storeName),idx=store.index('groupId'),req=idx.openCursor(IDBKeyRange.only(groupId));req.onsuccess=()=>{const cursor=req.result;if(cursor){cursor.delete();cursor.continue()}}}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('群聊删除失败'))})}
async function listGroups(){const a=await getAll(STORE_GROUPS);return a.sort((x,y)=>(Number(y.updatedAt)||0)-(Number(x.updatedAt)||0))}
async function listMessages(groupId){const db=await openDB();return new Promise((resolve,reject)=>{const idx=db.transaction(STORE_MESSAGES,'readonly').objectStore(STORE_MESSAGES).index('groupId');const req=idx.getAll(IDBKeyRange.only(groupId));req.onsuccess=()=>resolve((req.result||[]).sort((a,b)=>(Number(a.createdAt)||0)-(Number(b.createdAt)||0)));req.onerror=()=>reject(req.error||new Error('群聊消息读取失败'))})}
async function saveGroup(group){group.updatedAt=Date.now();return putOne(STORE_GROUPS,group)}
async function saveMessage(message){await putOne(STORE_MESSAGES,message);return message}
async function saveTurn(turn){return putOne(STORE_TURNS,turn)}
async function clearGroupStoreRows(storeName,groupId){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);if(store.indexNames.contains('groupId')){const req=store.index('groupId').openCursor(IDBKeyRange.only(groupId));req.onsuccess=()=>{const cursor=req.result;if(cursor){cursor.delete();cursor.continue()}}}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('群聊记录清理失败'));tx.onabort=()=>reject(tx.error||new Error('群聊记录清理已中断'))})}
function nextMessageTimestamp(group){return Math.max(Date.now(),(Number(group?.lastMessage?.createdAt)||0)+1)}
function snapshotMember(person){const meta=host().getChatMeta?.(person.id)||{};return {contactId:String(person.id),name:String(person.name||'未命名联系人'),role:String(person.role||''),avatar:String(meta.avatar||''),status:'active',joinedAt:Date.now(),removedAt:null}}
function groupActiveMembers(group){return (group.members||[]).filter(m=>m.status==='active'&&getPerson(m.contactId))}
async function syncUnavailableMembers(group){let changed=false;for(const m of group.members||[]){if(m.status==='active'&&!getPerson(m.contactId)){m.status='unavailable';m.unavailableAt=Date.now();changed=true}}if(changed)await saveGroup(group);return changed}
function groupAvatar(group){if(group.avatar)return `<img src="${esc(group.avatar)}" alt="">`;const text=String(group.name||'群').trim().slice(0,2)||'群';return esc(text)}
function messageAvatar(message,group){if(message.senderType==='user')return '我';const member=(group.members||[]).find(m=>m.contactId===message.senderId);const person=getPerson(message.senderId);const meta=host().getChatMeta?.(message.senderId)||{};const avatar=meta.avatar||member?.avatar||'';if(avatar)return `<img src="${esc(avatar)}" alt="${esc(message.senderNameSnapshot||person?.name||'角色')}">`;return esc((message.senderNameSnapshot||person?.name||member?.name||'♡').slice(0,1))}
function timeLabel(at){if(!at)return '';const d=new Date(at),now=new Date();if(d.toDateString()===now.toDateString())return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});return d.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}
function exactGroupDateTime(at){const n=Number(at);if(!Number.isFinite(n)||n<=0)return '时间未知';return new Date(n).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}
function groupTimeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'设备本地时区'}catch(_){return '设备本地时区'}}
function groupTimeDividerMarkup(at){const d=new Date(Number(at));if(!Number.isFinite(d.getTime()))return '';const label=d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});return `<div class="lr-group-time-divider"><span>${esc(label)}</span></div>`}
function safeMessageText(text){return esc(text).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>')}
function ensureGroupList(){const chat=$('chat'),contacts=$('chatContacts');if(!chat||!contacts)return null;let list=$('lrGroupList');if(!list){list=document.createElement('section');list.id='lrGroupList';list.className='lr-group-list';contacts.parentNode.insertBefore(list,contacts)}return list}
async function renderGroupList(){const list=ensureGroupList();if(!list)return;try{const groups=await listGroups();for(const group of groups)await syncUnavailableMembers(group);const privateConversation=$('chatConversation'),chatRoot=$('chat');const oneToOneOpen=!!(privateConversation&&!privateConversation.hidden)||!!chatRoot?.classList.contains('is-conversation');if(activeGroupId||settingsOpen||oneToOneOpen){list.hidden=true;list.setAttribute('aria-hidden','true');return}list.hidden=!groups.length;list.setAttribute('aria-hidden',groups.length?'false':'true');list.innerHTML=groups.length?'<div class="lr-group-list-head"><span>GROUP CHATS</span><small>'+groups.length+' 个群聊</small></div>'+groups.map(g=>{
 const messagesCache=g.lastMessage||{};const preview=messagesCache.text||'群聊已创建，来打个招呼吧。';const sender=messagesCache.senderName?messagesCache.senderName+'：':'';
 return `<button class="lr-group-list-item" type="button" data-lr-group-open="${esc(g.id)}"><span class="lr-group-list-avatar">${groupAvatar(g)}</span><span class="lr-group-list-copy"><strong>${esc(g.name||'未命名群聊')}</strong><small>${esc(sender+preview)}</small></span><span class="lr-group-list-meta"><small>${esc(timeLabel(messagesCache.createdAt||g.updatedAt))}</small><b>${(g.members||[]).filter(m=>m.status==='active'&&getPerson(m.contactId)).length} 人</b></span></button>`}).join(''):'';
 }catch(err){console.warn('[LOVE RECORD] group list render failed',err)}}
function setChatTopBar(group){const bar=$('systemAppbar'),title=$('systemAppTitle'),action=$('systemAppbarAction'),back=bar?.querySelector('.system-back');bar?.classList.add('show');if(title)title.textContent=settingsOpen?'群聊设置':(group.name||'群聊');if(action){action.hidden=!!settingsOpen;action.textContent='⚙';action.setAttribute('aria-label','群聊设置')}if(back)back.removeAttribute('data-launch-home')}
function groupMessageBody(m){
 if(m.kind==='image'||m.kind==='sticker')return `<div class="lr-group-attachment" data-group-attachment="${esc(m.attachmentId)}" data-group-attachment-kind="${m.kind}">图片加载中…</div>`;
 if(m.kind==='transfer'){
  const status=m.transferStatus==='accepted'?'已接收':m.transferStatus==='refunded'?'已退还':'';
  const canResolve=m.senderType==='character'&&!status;
  return `<div class="lr-group-transfer-card ${canResolve?'is-actionable':''}" ${canResolve?`role="button" tabindex="0" data-lr-group-transfer="${esc(m.id)}"`:''}><small>LOVE RECORD · A LITTLE GIFT</small><strong>${esc(m.currency||'￥')}${esc(m.amount||'0.00')}</strong><span>${esc(m.note||'给你的小心意')}</span><span class="lr-group-transfer-state">${status|| (canResolve?'点击查看 · 接收或退还':'模拟转账卡')}</span></div>`;
 }
 if(m.kind==='location'){const place=String(m.place||m.text||'未填写地点');const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(place);return `<a class="lr-group-location-card" href="${esc(url)}" target="_blank" rel="noopener"><b>⌖　位置分享</b><span>${esc(place)}</span>${m.note?`<small>${esc(m.note)}</small>`:''}<small>点击打开地图搜索</small></a>`}
 if(m.kind==='order'){const items=Array.isArray(m.orderItems)?m.orderItems.map(x=>`${esc(x.name||'商品')} × ${Number(x.qty)||1}`).join('、'):esc(m.text||'订单已创建');return `<div class="lr-group-order-card"><small>LOVE RECORD · ${m.orderKind==='food'?'FOOD ORDER':'SHOPPING ORDER'}</small><strong>${m.orderKind==='food'?'外卖订单':'购物订单'}</strong><span>${items||'订单已创建'}</span><b>￥${(Number(m.orderTotal)||0).toFixed(2)}</b><small>订单号：${esc(m.orderNo||'—')}</small></div>`}
 return safeMessageText(m.text||'');
}
function groupMessageQuoteMarkup(m){
 if(!m?.quoteMessageId&&!m?.quotedText)return '';
 return `<div class="lr-group-quoted-message"><strong>↪ ${esc(m.quotedSenderName||'引用消息')}</strong><span>${esc(String(m.quotedText||'[消息]').slice(0,180))}</span></div>`;
}
function groupMessageMarkup(m,group){
 const selected=selectedGroupMessageIds.has(String(m.id));
 if(m.senderType==='system')return `<div class="lr-group-system-message ${selected?'is-selected':''}" data-group-message-id="${esc(m.id)}" data-created-at="${Number(m.createdAt)||0}"><span>${esc(m.text||'')}</span></div>`;
 const isUser=m.senderType==='user';const name=isUser?'我':(m.senderNameSnapshot||getName(m.senderId));
 return `<article class="lr-group-message-row ${isUser?'is-user':'is-character'} ${selected?'is-selected':''}" data-group-message-id="${esc(m.id)}" data-created-at="${Number(m.createdAt)||0}"><div class="lr-group-message-avatar">${messageAvatar(m,group)}</div><div class="lr-group-message-content"><div class="lr-group-message-name">${esc(name)} <time>${esc(timeLabel(m.createdAt))}</time></div>${groupMessageQuoteMarkup(m)}<div class="lr-group-message-bubble ${m.kind==='image'?'has-image':''} ${m.kind==='sticker'?'has-sticker':''}">${groupMessageBody(m)}</div></div></article>`;
}
async function hydrateGroupAttachments(root=$('lrGroupMessages')){const bridge=window.LRChatInteractionV11;if(!bridge?.loadAttachmentDataUrl||!root)return;for(const node of root.querySelectorAll('[data-group-attachment]')){const id=node.dataset.groupAttachment,kind=node.dataset.groupAttachmentKind;try{const url=await bridge.loadAttachmentDataUrl(id);if(!url||!node.isConnected)continue;const img=document.createElement('img');img.src=url;img.alt=kind==='sticker'?'表情包':'聊天图片';img.className=kind==='sticker'?'lr-group-sticker-image':'lr-group-chat-image';node.replaceChildren(img)}catch(err){if(node.isConnected)node.textContent='图片无法读取'}}}
function renderGroupMessages(messages,group){const box=$('lrGroupMessages');if(!box)return;const root=$('lrGroupConversation');if(root)root.dataset.lrGroupId=String(group.id);let previousAt=0;const content=messages.map(m=>{const at=Number(m.createdAt)||0;const divider=at&&previousAt&&at-previousAt>=10*60*1000?groupTimeDividerMarkup(at):'';if(at)previousAt=at;return divider+groupMessageMarkup(m,group)}).join('');box.innerHTML=messages.length?content:'<div class="lr-group-empty">群聊还没有消息。<br>说点什么，让大家认识一下吧 ♡</div>';box.scrollTop=box.scrollHeight;hydrateGroupAttachments(box);updateGroupMessageToolbar();}
function appendGroupMessageToView(message,group){
 if(activeGroupId!==String(group.id)||settingsOpen)return;
 const box=$('lrGroupMessages');if(!box)return;
 box.querySelector('.lr-group-empty')?.remove();
 const previousNodes=[...box.querySelectorAll('[data-group-message-id][data-created-at]')];
 const previousAt=Number(previousNodes.at(-1)?.dataset.createdAt)||0;
 const newAt=Number(message.createdAt)||0;
 if(previousAt&&newAt&&newAt-previousAt>=10*60*1000){const dividerHolder=document.createElement('div');dividerHolder.innerHTML=groupTimeDividerMarkup(newAt);if(dividerHolder.firstElementChild)box.appendChild(dividerHolder.firstElementChild)}
 const holder=document.createElement('div');holder.innerHTML=groupMessageMarkup(message,group);
 const node=holder.firstElementChild;if(!node)return;
 node.classList.add('lr-group-message-arrive');box.appendChild(node);
 box.scrollTo?.({top:box.scrollHeight,behavior:'smooth'});if(!box.scrollTo)box.scrollTop=box.scrollHeight;
 hydrateGroupAttachments(node);updateGroupMessageToolbar();
}
function updateGroupMessageToolbar(){
 const bar=$('lrGroupMessageToolbar');if(!bar)return;
 if(groupSelectionMode){bar.hidden=false;bar.innerHTML=`<span>已选择 ${selectedGroupMessageIds.size} 条消息</span><button type="button" data-group-toolbar="all">全选</button><button type="button" data-group-toolbar="delete" ${selectedGroupMessageIds.size?'':'disabled'}>删除选中</button><button type="button" data-group-toolbar="cancel">取消</button>`;}
 else if(quoteDraft){bar.hidden=false;bar.innerHTML=`<span class="lr-group-quote-preview">回复 <b>${esc(quoteDraft.senderName)}</b>：${esc(String(quoteDraft.text||'[图片]').slice(0,60))}</span><button type="button" data-group-toolbar="cancel-quote">取消引用</button>`;}
 else{bar.hidden=true;bar.innerHTML='';}
 const box=$('lrGroupMessages');box?.querySelectorAll('[data-group-message-id]').forEach(row=>row.classList.toggle('is-selected',selectedGroupMessageIds.has(String(row.dataset.groupMessageId))));
}
async function getGroupMessage(messageId){if(!activeGroupId)return null;return (await listMessages(activeGroupId)).find(m=>String(m.id)===String(messageId))||null;}
function ensureGroupMessageActionMenu(){let menu=$('lrGroupMessageActionMenu');if(menu)return menu;menu=document.createElement('div');menu.id='lrGroupMessageActionMenu';menu.className='lr-group-message-action-menu';menu.hidden=true;document.body.appendChild(menu);menu.addEventListener('click',async e=>{const button=e.target.closest('[data-group-message-action]');if(!button)return;const action=button.dataset.groupMessageAction,id=menu.dataset.messageId;menu.hidden=true;const message=await getGroupMessage(id);if(!message)return;if(action==='quote'){quoteDraft={messageId:String(message.id),senderName:message.senderType==='user'?'我':(message.senderNameSnapshot||getName(message.senderId)),text:message.text||({image:'[图片]',sticker:'[表情包]',transfer:'转账卡',location:'位置分享'}[message.kind]||'[消息]'),senderType:message.senderType,kind:message.kind||'text'};groupSelectionMode=false;selectedGroupMessageIds.clear();updateGroupMessageToolbar();$('lrGroupInput')?.focus();}
 else if(action==='select'){groupSelectionMode=true;selectedGroupMessageIds=new Set([String(id)]);updateGroupMessageToolbar();}
 else if(action==='delete'){if(!confirm('确定删除这条群聊消息吗？'))return;await deleteGroupMessages([String(id)]);}
 });return menu;}
function showGroupMessageActionMenu(id,x,y){const menu=ensureGroupMessageActionMenu();menu.dataset.messageId=String(id);menu.innerHTML='<button type="button" data-group-message-action="quote">引用回复</button><button type="button" data-group-message-action="select">加入多选</button><button type="button" data-group-message-action="delete" class="danger">删除消息</button>';menu.hidden=false;const left=Math.max(10,Math.min((Number(x)||20)-70,window.innerWidth-175));const top=Math.max(10,Math.min((Number(y)||100)-120,window.innerHeight-160));menu.style.left=left+'px';menu.style.top=top+'px';}
async function deleteGroupMessages(ids){
 const unique=[...new Set((ids||[]).map(String))];if(!activeGroupId||!unique.length)return;
 const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE_MESSAGES,'readwrite'),store=tx.objectStore(STORE_MESSAGES);unique.forEach(id=>store.delete(id));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('消息删除失败'));tx.onabort=()=>reject(tx.error||new Error('消息删除已中断'))});
 const group=await getOne(STORE_GROUPS,activeGroupId);if(group){const remaining=await listMessages(activeGroupId);const last=remaining[remaining.length-1];group.lastMessage=last?{text:last.text||({image:'[图片]',sticker:'[表情包]',transfer:'转账卡',location:'位置分享'}[last.kind]||'新消息'),senderName:last.senderType==='user'?'我':last.senderType==='system'?'系统':last.senderNameSnapshot,createdAt:last.createdAt}:null;await saveGroup(group);}
 if(quoteDraft&&unique.includes(quoteDraft.messageId))quoteDraft=null;selectedGroupMessageIds.clear();groupSelectionMode=false;await renderGroupConversation();notify(`已删除 ${unique.length} 条消息`);
}
function bindGroupMessageInteractions(){
 const box=$('lrGroupMessages');if(!box||box.dataset.lrInteractionsBound)return;box.dataset.lrInteractionsBound='1';
 box.addEventListener('pointerdown',e=>{const row=e.target.closest('[data-group-message-id]');if(!row||groupSelectionMode)return;groupLongPressTriggered=false;clearTimeout(groupPressTimer);groupPressStartX=e.clientX;groupPressStartY=e.clientY;const id=row.dataset.groupMessageId,x=e.clientX,y=e.clientY;groupPressTimer=setTimeout(()=>{groupLongPressTriggered=true;showGroupMessageActionMenu(id,x,y)},520)});
 box.addEventListener('pointermove',e=>{if(groupPressTimer&&Math.hypot(e.clientX-groupPressStartX,e.clientY-groupPressStartY)>12)clearTimeout(groupPressTimer)});
 ['pointerup','pointercancel','pointerleave'].forEach(type=>box.addEventListener(type,()=>clearTimeout(groupPressTimer)));
 box.addEventListener('contextmenu',e=>{const row=e.target.closest('[data-group-message-id]');if(!row)return;e.preventDefault();showGroupMessageActionMenu(row.dataset.groupMessageId,e.clientX,e.clientY)});
 box.addEventListener('click',e=>{if(groupLongPressTriggered){groupLongPressTriggered=false;return;}const row=e.target.closest('[data-group-message-id]');if(groupSelectionMode&&row){if(e.target.closest('a,button,[role=button]'))e.preventDefault();const id=String(row.dataset.groupMessageId);if(selectedGroupMessageIds.has(id))selectedGroupMessageIds.delete(id);else selectedGroupMessageIds.add(id);updateGroupMessageToolbar();return;}const transfer=e.target.closest('[data-lr-group-transfer]');if(transfer){e.preventDefault();openGroupTransferDecision(transfer.dataset.lrGroupTransfer);return;}});
 box.addEventListener('keydown',e=>{const transfer=e.target.closest('[data-lr-group-transfer]');if(transfer&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openGroupTransferDecision(transfer.dataset.lrGroupTransfer);}});
 const toolbar=$('lrGroupMessageToolbar');toolbar?.addEventListener('click',async e=>{const b=e.target.closest('[data-group-toolbar]');if(!b)return;const action=b.dataset.groupToolbar;if(action==='cancel'){groupSelectionMode=false;selectedGroupMessageIds.clear()}else if(action==='all'){const messages=await listMessages(activeGroupId);selectedGroupMessageIds=new Set(messages.map(m=>String(m.id)))}else if(action==='delete'){if(!selectedGroupMessageIds.size)return;if(!confirm(`确定删除选中的 ${selectedGroupMessageIds.size} 条消息吗？`))return;await deleteGroupMessages([...selectedGroupMessageIds]);return}else if(action==='cancel-quote')quoteDraft=null;updateGroupMessageToolbar();});
 document.addEventListener('click',e=>{const menu=$('lrGroupMessageActionMenu');if(menu&&!menu.hidden&&!menu.contains(e.target))menu.hidden=true;});
}
function ensureGroupTransferDecisionModal(){let modal=$('lrGroupTransferDecision');if(modal)return modal;modal=document.createElement('div');modal.id='lrGroupTransferDecision';modal.className='lr-action-overlay';modal.hidden=true;modal.innerHTML='<section class="lr-action-sheet"><div class="lr-action-kicker">LOVE RECORD · A LITTLE GIFT</div><div class="lr-action-title">收到一张转账卡</div><div class="lr-action-desc" id="lrGroupTransferDecisionText">这是聊天中的模拟转账，不会发生真实付款。</div><div class="lr-action-buttons"><button type="button" data-group-transfer-choice="refunded">退还</button><button type="button" data-group-transfer-choice="accepted" class="primary">接收</button></div></section>';document.body.appendChild(modal);modal.addEventListener('click',async e=>{if(e.target===modal){modal.hidden=true;return}const b=e.target.closest('[data-group-transfer-choice]');if(!b||!groupTransferDecisionId)return;const id=groupTransferDecisionId;const message=await getGroupMessage(id);if(!message)return;message.transferStatus=b.dataset.groupTransferChoice;message.transferResolvedAt=Date.now();await saveMessage(message);modal.hidden=true;groupTransferDecisionId='';await renderGroupConversation();notify(message.transferStatus==='accepted'?'已接收这张模拟转账卡':'已退还这张模拟转账卡');});return modal;}
async function openGroupTransferDecision(id){const message=await getGroupMessage(id);if(!message||message.kind!=='transfer'||message.senderType!=='character'||message.transferStatus)return;groupTransferDecisionId=String(id);const modal=ensureGroupTransferDecisionModal();$('lrGroupTransferDecisionText').textContent=`${message.senderNameSnapshot||getName(message.senderId)} 给你转账 ￥${message.amount||'0.00'}。${message.note||'给你的小心意'}。这是模拟卡片，不会发生真实付款。`;modal.hidden=false;}
async function renderGroupConversation(){if(!activeGroupId)return;const group=await getOne(STORE_GROUPS,activeGroupId);if(!group){activeGroupId='';window.renderChat?.();return}await syncUnavailableMembers(group);
 const chat=$('chat'),list=$('chatContacts'),baseConv=$('chatConversation'),conv=$('lrGroupConversation'),settingsPage=$('lrGroupSettingsPage');if(!conv)return;
 if(chat)chat.classList.add('is-conversation','is-group-conversation');document.body.classList.add('chat-conversation-open');setGroupDockMode(settingsOpen?'settings':'conversation');
 if(list)list.hidden=true;if(baseConv)baseConv.hidden=true;const gl=$('lrGroupList');if(gl){gl.hidden=true;gl.setAttribute('aria-hidden','true')}
 setChatTopBar(group);if(settingsOpen){conv.hidden=true;if(settingsPage)settingsPage.hidden=false;if(chat)chat.classList.add('is-group-settings');setChatTopBar(group);return}else{if(settingsPage)settingsPage.hidden=true;if(chat)chat.classList.remove('is-group-settings');conv.hidden=false}
 const avatar=$('lrGroupHeaderAvatar');if(avatar)avatar.innerHTML=group.avatar?`<img src="${esc(group.avatar)}" alt="">`:esc((group.name||'群').slice(0,2));
 $('lrGroupHeaderName').textContent=group.name||'未命名群聊';$('lrGroupHeaderMembers').textContent=groupActiveMembers(group).length+' 位成员';
 const ann=$('lrGroupAnnouncement');ann.textContent=group.announcement||'';ann.hidden=!group.announcement;
 const msgs=await listMessages(activeGroupId);renderGroupMessages(msgs,group);applyGroupCustomCss(group);const messageBox=$('lrGroupMessages');if(messageBox){messageBox.style.background='transparent';messageBox.style.backgroundImage='none'}conv.style.backgroundColor=group.background||'#f7f3f9';conv.style.backgroundImage=group.backgroundImage?`linear-gradient(rgba(247,243,249,.22),rgba(247,243,249,.22)),url("${group.backgroundImage}")`:'none';conv.style.backgroundSize='cover';conv.style.backgroundPosition='center center';conv.style.backgroundRepeat='no-repeat';conv.style.backgroundAttachment='scroll';const turns=(await getAll(STORE_TURNS)).filter(t=>t.groupId===activeGroupId).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));const latestTurn=turns[0];
 $('lrGroupHint').textContent=busy?'角色正在群聊中…':latestTurn?.status==='interrupted'?'上一轮因页面关闭而中断；可以继续发送新消息。':'自然群聊 · 长按消息可引用或删除';
}
function openGroup(groupId){activeGroupId=String(groupId);settingsOpen=false;quoteDraft=null;groupSelectionMode=false;selectedGroupMessageIds.clear();host().setActiveChatContact?.('');const chat=$('chat'),list=$('lrGroupList'),conv=$('chatConversation');if(chat)chat.classList.add('is-conversation','is-group-conversation');if(list){list.hidden=true;list.setAttribute('aria-hidden','true')}if(conv)conv.hidden=true;document.body.classList.add('chat-conversation-open');setGroupDockMode('conversation');renderGroupConversation().catch(e=>{console.error(e);notify('打开群聊失败：'+e.message)})}
function backToList(){settingsOpen=false;activeGroupId='';quoteDraft=null;groupSelectionMode=false;selectedGroupMessageIds.clear();updateGroupMessageToolbar();try{localStorage.removeItem('lr-life-chat-context-v1');sessionStorage.removeItem('lr-life-active-group')}catch{}host().setActiveChatContact?.('');const conv=$('lrGroupConversation'),settingsPage=$('lrGroupSettingsPage'),chat=$('chat');if(conv)conv.hidden=true;if(settingsPage)settingsPage.hidden=true;if(chat)chat.classList.remove('is-conversation','is-group-conversation','is-group-settings');document.body.classList.remove('chat-conversation-open');setGroupDockMode('');const title=$('systemAppTitle'),action=$('systemAppbarAction'),back=$('systemAppbar')?.querySelector('.system-back');if(title)title.textContent='CHAT';if(action){action.hidden=false;action.textContent='＋';action.setAttribute('aria-label','添加联系人')}if(back)back.setAttribute('data-launch-home','');window.renderChat?.()}
async function openCreateGroup(){
 const people=host().getPeople?.()||[],box=$('lrCreateGroupMembers');if(!box)return;
 box.innerHTML=people.length?people.map(p=>`<label class="lr-group-picker-item"><input type="checkbox" value="${esc(p.id)}"><span><b>${esc(p.name||'未命名联系人')}</b><small>${esc(p.role||p.persona||'AI 联系人')}</small></span></label>`).join(''):'<div class="lr-group-empty-picker">还没有联系人，请先去「联系人」创建角色。</div>';
 $('lrNewGroupName').value='';$('lrCreateGroupModal').classList.add('show');$('lrCreateGroupModal').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
}
function closeCreateGroup(){const m=$('lrCreateGroupModal');m?.classList.remove('show');m?.setAttribute('aria-hidden','true');document.body.style.overflow=''}
async function createGroup(){
 const selected=[...$('lrCreateGroupMembers').querySelectorAll('input[type=checkbox]:checked')].map(x=>String(x.value));
 if(selected.length<2){notify('群聊至少需要选择两位联系人');return}
 const people=selected.map(getPerson).filter(Boolean);if(people.length<2){notify('请重新选择有效联系人');return}
 const name=String($('lrNewGroupName').value||'').trim()||people.slice(0,2).map(p=>p.name).join('、')+'的小群';
 const group={id:makeId('group'),name,avatar:'',background:'#f7f3f9',backgroundImage:'',announcement:'',ownerId:'user',members:people.map(snapshotMember),maxAiMessagesPerTurn:4,naturalMode:true,allowCharacterReplies:true,worldId:'',worldBookSelectionConfigured:true,memoryCount:50,autoMemoryCount:15,memorySummarizedThrough:0,longTermMemory:'',chatCustomCss:'',createdAt:Date.now(),updatedAt:Date.now(),status:'active',lastMessage:null};
 try{const welcome={id:makeId('msg'),groupId:group.id,senderType:'system',text:'群聊已创建。你可以开始聊天啦。',createdAt:nextMessageTimestamp(group)};group.lastMessage={text:welcome.text,senderName:'系统',createdAt:welcome.createdAt};await saveGroup(group);await saveMessage(welcome);closeCreateGroup();if($('chatAddModal')?.classList.contains('show'))$('chatAddModal').classList.remove('show');document.body.style.overflow='';await renderGroupList();openGroup(group.id);notify('群聊创建成功 ♡')}catch(err){console.error('[LOVE RECORD] group create failed',err);notify('创建群聊失败：'+err.message)}
}
function renderGroupImagePreview(id,value,emptyText){const box=$(id);if(!box)return;box.replaceChildren();if(value){const img=document.createElement('img');img.src=value;img.alt='群聊图片预览';box.appendChild(img)}else box.textContent=emptyText||'未设置';box.hidden=false}
async function compressGroupImage(file,maxSize=1200,quality=.82){if(!file||!String(file.type||'').startsWith('image/'))throw new Error('请选择图片文件');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('图片读取失败'));r.readAsDataURL(file)});const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('图片解码失败'));i.src=data});const scale=Math.min(1,maxSize/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法处理图片');ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',quality)}
function scopeGroupCss(input){
 const css=String(input||'').replace(/<\/style/gi,'');
 const root='#lrGroupConversation';
 const findOpen=(text,from)=>{let quote='',comment=false,escape=false,paren=0;for(let i=from;i<text.length;i++){const c=text[i],n=text[i+1];if(comment){if(c==='*'&&n==='/'){comment=false;i++}continue}if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}if(c==='/'&&n==='*'){comment=true;i++;continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='[')paren++;else if(c===')'||c===']')paren=Math.max(0,paren-1);else if(c==='{'&&paren===0)return i}return -1};
 const findClose=(text,open)=>{let depth=1,quote='',comment=false,escape=false;for(let i=open+1;i<text.length;i++){const c=text[i],n=text[i+1];if(comment){if(c==='*'&&n==='/'){comment=false;i++}continue}if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}if(c==='/'&&n==='*'){comment=true;i++;continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='{')depth++;else if(c==='}'&&--depth===0)return i}return text.length};
 const splitSelectors=text=>{const out=[];let start=0,depth=0,quote='';for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='\\'){i++;continue}if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth=Math.max(0,depth-1);else if(c===','&&depth===0){out.push(text.slice(start,i));start=i+1}}out.push(text.slice(start));return out};
 const walk=text=>{let out='',pos=0;while(pos<text.length){const open=findOpen(text,pos);if(open<0){out+=text.slice(pos);break}const close=findClose(text,open),header=text.slice(pos,open),body=text.slice(open+1,close),trim=header.trim();let nextBody=body;if(/^@(media|supports|container|layer|document)\b/i.test(trim))nextBody=walk(body);else if(!trim.startsWith('@')){const selectors=splitSelectors(header).map(raw=>{const sel=raw.trim();if(!sel)return sel;if(sel===root||sel.startsWith(root+' ')||sel.startsWith(root+':')||sel.startsWith(root+'['))return sel;if(sel.startsWith('.lr-group-message-action-menu'))return sel;return root+' '+sel});out+=selectors.join(',')+'{'+nextBody+'}';pos=close+1;continue}else{nextBody=body}out+=header+'{'+nextBody+'}';pos=close+1}return out};
 return walk(css);
}
function applyGroupCustomCss(group){let style=$('lrGroupCustomCssStyle');if(!style){style=document.createElement('style');style.id='lrGroupCustomCssStyle';document.head.appendChild(style)}style.textContent=scopeGroupCss(group?.chatCustomCss||'');}
function fillGroupCssExample(){const area=$('lrGroupCustomCss');if(!area)return;area.value=`/* LOVE RECORD · GROUP LAVENDER LIQUID GLASS
   完整群聊界面示例：顶部、公告、背景、头像、时间、引用、消息卡、输入工具栏
*/
#lrGroupConversation { --lr-group-glass:rgba(255,255,255,.72); color:#55465f; }
#lrGroupConversation .lr-group-head { background:rgba(250,247,252,.84); border-bottom:1px solid rgba(255,255,255,.88); backdrop-filter:blur(22px); }
#lrGroupConversation .lr-group-head-copy strong { color:#584765; letter-spacing:.04em; }
#lrGroupConversation .lr-group-head-copy small { color:#a092aa; }
#lrGroupConversation .lr-group-head-action { background:rgba(255,255,255,.8); border-color:rgba(255,255,255,.95); color:#8e76a0; }
#lrGroupConversation .lr-group-announcement { background:rgba(239,231,244,.72); color:#897995; border-bottom:1px solid rgba(255,255,255,.6); }
#lrGroupConversation .lr-group-messages { background-color:rgba(247,242,250,.34); gap:15px; }
#lrGroupConversation .lr-group-message-avatar { border:1px solid rgba(255,255,255,.95); box-shadow:0 4px 12px rgba(80,60,95,.08); }
#lrGroupConversation .lr-group-message-name { color:#9b8da5; letter-spacing:.02em; }
#lrGroupConversation .lr-group-message-name time { color:#a99bab; }
#lrGroupConversation .lr-group-time-divider { color:#9b8aa5; margin:13px 0; }
#lrGroupConversation .lr-group-time-divider span { padding:4px 11px; border-radius:999px; background:rgba(255,255,255,.65); border:1px solid rgba(255,255,255,.9); }
#lrGroupConversation .lr-group-quoted-message { background:rgba(236,228,241,.56); border-left-color:#b99ac7; color:#897895; border-radius:0 11px 11px 0; }
#lrGroupConversation .lr-group-message-bubble { background:rgba(255,255,255,.78); color:#493f51; border:1px solid rgba(255,255,255,.92); border-radius:21px 21px 21px 7px; box-shadow:0 8px 23px rgba(85,67,105,.075); backdrop-filter:blur(22px); }
#lrGroupConversation .lr-group-message-row.is-user .lr-group-message-bubble { background:linear-gradient(135deg,rgba(218,199,234,.82),rgba(199,178,220,.68)); color:#493957; border-radius:21px 21px 7px 21px; }
#lrGroupConversation .lr-group-chat-image,#lrGroupConversation .lr-group-sticker-image { border:1px solid rgba(255,255,255,.9); border-radius:17px; box-shadow:0 8px 23px rgba(79,61,99,.13); }
#lrGroupConversation .lr-group-transfer-card,#lrGroupConversation .lr-group-order-card { border:1px solid rgba(255,255,255,.65); box-shadow:0 12px 28px rgba(112,79,139,.18); border-radius:23px; }
#lrGroupConversation .lr-group-location-card { background:#f7f1fa; border:1px solid rgba(185,155,200,.22); border-radius:17px; color:#6c5877; padding:14px 16px; box-shadow:0 6px 18px rgba(110,83,128,.07); }
#lrGroupConversation .lr-group-compose { background:rgba(255,255,255,.78); border-top:1px solid rgba(255,255,255,.92); backdrop-filter:blur(24px); padding:10px 11px calc(10px + env(safe-area-inset-bottom)); }
#lrGroupConversation .lr-group-compose textarea { background:rgba(255,255,255,.7); color:#4d4057; border:1px solid rgba(255,255,255,.88); border-radius:17px; }
#lrGroupConversation .lr-group-plus,#lrGroupConversation .lr-group-at,#lrGroupConversation .lr-group-send { border-radius:15px; box-shadow:0 5px 15px rgba(109,82,128,.1); }
#lrGroupConversation .lr-group-plus-menu { background:rgba(255,252,255,.91); border:1px solid rgba(255,255,255,.95); border-radius:22px; box-shadow:0 14px 38px rgba(75,55,94,.16); backdrop-filter:blur(25px); }
#lrGroupConversation .lr-group-plus-menu button { color:#594a66; border-radius:13px; }
.lr-group-message-action-menu { background:rgba(255,252,255,.94); border:1px solid rgba(255,255,255,.96); border-radius:18px; backdrop-filter:blur(22px); }
`;applyGroupCustomCss({chatCustomCss:area.value});}
async function searchGroupHistory(){if(!settingsGroupId)return;const keyword=String($('lrGroupSearchKeyword')?.value||'').trim().toLocaleLowerCase(),box=$('lrGroupSearchResults');if(!keyword){box.innerHTML='<div class="lr-group-search-empty">先输入要查找的关键词。</div>';return}const messages=await listMessages(settingsGroupId),hits=[];messages.forEach((m,index)=>{const text=String(m.text||'');const who=m.senderType==='user'?'我':m.senderType==='system'?'系统':(m.senderNameSnapshot||getName(m.senderId));if((text+' '+who).toLocaleLowerCase().includes(keyword))hits.push({m,index,who})});box.innerHTML=hits.length?hits.slice(-40).reverse().map(({m,index,who})=>`<button type="button" class="lr-group-search-hit" data-lr-group-hit="${esc(m.id)}"><small>${esc(who)} · ${esc(timeLabel(m.createdAt))}</small>${esc(String(m.text||'').slice(0,220))}</button>`).join(''):'<div class="lr-group-search-empty">没有找到相关聊天记录。</div>';}
async function deleteGroupHistory(){if(!settingsGroupId)return;if(!confirm('确定删除这个群聊的全部消息记录吗？删除后无法恢复；群聊成员、群设置和已保存的长期记忆会保留。'))return;const id=settingsGroupId;try{await Promise.all([clearGroupStoreRows(STORE_MESSAGES,id),clearGroupStoreRows(STORE_TURNS,id)]);const group=await getOne(STORE_GROUPS,id);if(group){group.lastMessage=null;group.memorySummarizedThrough=0;await saveGroup(group);/* Update the hidden conversation DOM now, so closing settings never reveals stale deleted messages. */renderGroupMessages([],group)}$('lrGroupSearchResults').innerHTML='<div class="lr-group-search-empty">聊天记录已删除。</div>';notify('群聊记录已删除，群设置和长期记忆已保留')}catch(err){notify('删除群聊记录失败：'+err.message)}}
async function saveGroupLongMemory(){if(!settingsGroupId)return;try{const group=await getOne(STORE_GROUPS,settingsGroupId);if(!group)return;group.longTermMemory=String($('lrGroupLongMemoryText').value||'').trim().slice(0,9000);await saveGroup(group);notify('群聊长期记忆已保存 ♡')}catch(err){notify('群聊长期记忆保存失败：'+err.message)}}
async function clearGroupLongMemory(){if(!settingsGroupId)return;if(!confirm('确定清空这个群聊的长期记忆吗？成员个人长期记忆不会受到影响。'))return;try{const group=await getOne(STORE_GROUPS,settingsGroupId);if(!group)return;group.longTermMemory='';group.memorySummarizedThrough=(await listMessages(settingsGroupId)).filter(m=>m.senderType==='user'||m.senderType==='character').length;await saveGroup(group);$('lrGroupLongMemoryText').value='';notify('群聊长期记忆已清空')}catch(err){notify('清空长期记忆失败：'+err.message)}}
function bindGroupAdvancedSettings(){
 const bind=(id,event,fn)=>{const el=$(id);if(el&&!el.dataset.lrBound){el.dataset.lrBound='1';el.addEventListener(event,fn)}};
 bind('lrGroupSearchButton','click',searchGroupHistory);bind('lrGroupSearchKeyword','keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchGroupHistory()}});bind('lrGroupDeleteHistory','click',deleteGroupHistory);
 bind('lrGroupCssExample','click',fillGroupCssExample);bind('lrGroupCssClear','click',()=>{const el=$('lrGroupCustomCss');if(el)el.value='';applyGroupCustomCss({chatCustomCss:''})});bind('lrGroupCustomCss','input',()=>applyGroupCustomCss({chatCustomCss:$('lrGroupCustomCss').value}));
 bind('lrGroupToggleLongMemory','click',()=>{const panel=$('lrGroupLongMemoryPanel');panel.hidden=!panel.hidden;$('lrGroupToggleLongMemory').textContent=panel.hidden?'查看 / 编辑长期记忆':'收起长期记忆'});bind('lrGroupSaveLongMemory','click',saveGroupLongMemory);bind('lrGroupClearLongMemory','click',clearGroupLongMemory);
 bind('lrGroupSearchResults','click',e=>{const b=e.target.closest('[data-lr-group-hit]');if(!b)return;const id=b.dataset.lrGroupHit;closeGroupSettings();setTimeout(()=>{const row=document.querySelector(`#lrGroupMessages [data-group-message-id="${CSS.escape(id)}"]`);row?.scrollIntoView({behavior:'smooth',block:'center'});if(row){row.classList.add('lr-group-search-highlight');setTimeout(()=>row.classList.remove('lr-group-search-highlight'),2200)}},50)});
}
async function openGroupSettings(){if(!activeGroupId)return;await host().waitForWorldBooks?.();const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;settingsGroupId=group.id;
 $('lrGroupEditName').value=group.name||'';$('lrGroupEditAnnouncement').value=group.announcement||'';$('lrGroupReplyLimit').value=String(groupReplyLimit(group));$('lrGroupBackground').value=group.background||'#f7f3f9';$('lrGroupWorldBook').innerHTML='<option value="">不选择世界书</option>'+(host().getWorldBooks?.()||[]).map(w=>`<option value="${esc(w.id)}">${esc(w.name||'未命名世界书')}</option>`).join('');$('lrGroupWorldBook').value=group.worldId||'';$('lrGroupMemoryCount').value=String(group.memoryCount||50);$('lrGroupAutoMemoryCount').value=String(group.autoMemoryCount||15);$('lrGroupCustomCss').value=group.chatCustomCss||'';$('lrGroupLongMemoryText').value=group.longTermMemory||'';$('lrGroupLongMemoryPanel').hidden=true;$('lrGroupToggleLongMemory').textContent='查看 / 编辑长期记忆';$('lrGroupSearchKeyword').value='';$('lrGroupSearchResults').innerHTML='';applyGroupCustomCss(group);groupAvatarDraft=group.avatar||'';groupBackgroundDraft=group.backgroundImage||'';renderGroupImagePreview('lrGroupAvatarPreview',groupAvatarDraft,'群');renderGroupImagePreview('lrGroupBackgroundPreview',groupBackgroundDraft,'未设置背景图片');
 renderManageMembers(group);renderAddMembers(group);settingsOpen=true;const chat=$('chat'),conv=$('lrGroupConversation'),page=$('lrGroupSettingsPage');if(chat)chat.classList.add('is-group-settings');if(conv)conv.hidden=true;if(page){page.hidden=false;page.setAttribute('aria-hidden','false')}document.body.classList.add('chat-conversation-open');setGroupDockMode('settings');setChatTopBar(group);}
function closeGroupSettings(){settingsOpen=false;const page=$('lrGroupSettingsPage'),chat=$('chat'),conv=$('lrGroupConversation');if(page){page.hidden=true;page.setAttribute('aria-hidden','true')}if(chat)chat.classList.remove('is-group-settings');if(conv&&activeGroupId)conv.hidden=false;if(activeGroupId){document.body.classList.add('chat-conversation-open');setGroupDockMode('conversation');setChatTopBar({name:$('lrGroupHeaderName')?.textContent||'群聊'})}else{document.body.classList.remove('chat-conversation-open');setGroupDockMode('')}}
function renderManageMembers(group){const box=$('lrGroupManageMembers');if(!box)return;box.innerHTML=(group.members||[]).map(m=>{const p=getPerson(m.contactId),missing=!p||m.status==='unavailable',removed=m.status==='removed';const name=p?.name||m.name||'已删除联系人';return `<div class="lr-group-member-row" data-lr-group-contact="${esc(m.contactId)}"><span class="lr-group-member-avatar">${esc(name.slice(0,1))}</span><span class="lr-group-member-info"><b>${esc(name)}</b><small data-lr-member-note>${missing?'联系人已删除，保留历史':removed?'已从群聊移除':esc(p?.role||m.role||'群成员')}</small></span>${!missing&&!removed?`<button type="button" class="lr-group-member-remove" data-lr-group-remove="${esc(m.contactId)}">移除</button>`:''}</div>`}).join('')||'<div class="lr-group-empty-picker">暂无群成员</div>';const count=$('lrGroupMemberCount');if(count)count.textContent=groupActiveMembers(group).length+' 位成员'}
function renderAddMembers(group){const box=$('lrGroupAddMembers');if(!box)return;const active=new Set((group.members||[]).filter(m=>m.status==='active').map(m=>String(m.contactId)));const people=(host().getPeople?.()||[]).filter(p=>!active.has(String(p.id)));box.innerHTML=people.length?people.map(p=>`<label class="lr-group-picker-item"><input type="checkbox" value="${esc(p.id)}"><span><b>${esc(p.name||'未命名联系人')}</b><small>${esc(p.role||'AI 联系人')}</small></span></label>`).join(''):'<div class="lr-group-empty-picker">没有可添加的联系人。</div>'}
async function saveGroupSettings(){const id=settingsGroupId;if(!id)return;const group=await getOne(STORE_GROUPS,id);if(!group)return;group.name=String($('lrGroupEditName').value||'').trim()||'未命名群聊';group.announcement=String($('lrGroupEditAnnouncement').value||'').trim();group.maxAiMessagesPerTurn=Math.max(1,Math.min(10,parseInt($('lrGroupReplyLimit').value,10)||4));group.background=$('lrGroupBackground').value||'#f7f3f9';group.worldId=String($('lrGroupWorldBook').value||'');group.worldBookSelectionConfigured=true;group.memoryCount=Math.max(1,Math.min(100,parseInt($('lrGroupMemoryCount').value,10)||50));group.autoMemoryCount=Math.max(1,Math.min(100,parseInt($('lrGroupAutoMemoryCount').value,10)||15));group.chatCustomCss=String($('lrGroupCustomCss').value||'').slice(0,12000);group.longTermMemory=String($('lrGroupLongMemoryText').value||group.longTermMemory||'').trim().slice(0,9000);group.avatar=groupAvatarDraft||'';group.backgroundImage=groupBackgroundDraft||'';
 const removeIds=[...$('lrGroupManageMembers').querySelectorAll('.lr-group-member-row[data-will-remove="1"]')].map(row=>String(row.dataset.lrGroupContact||''));
 const addIds=[...$('lrGroupAddMembers').querySelectorAll('input[type=checkbox]:checked')].map(x=>String(x.value));
 const membershipEvents=[];for(const m of group.members||[]){if(removeIds.includes(String(m.contactId))&&m.status==='active'){m.status='removed';m.removedAt=Date.now();membershipEvents.push((m.name||'一位成员')+' 已退出群聊')}}
 for(const pid of addIds){const p=getPerson(pid);if(!p)continue;let existing=(group.members||[]).find(m=>String(m.contactId)===pid);if(existing){existing.status='active';existing.removedAt=null;existing.unavailableAt=null;existing.name=p.name||existing.name;existing.role=p.role||'';existing.avatar=host().getChatMeta?.(pid)?.avatar||existing.avatar;membershipEvents.push((p.name||'一位成员')+' 加入了群聊')}else{group.members.push(snapshotMember(p));membershipEvents.push((p.name||'一位成员')+' 加入了群聊')}}
 if(groupActiveMembers(group).length<1){notify('群聊至少需要保留一位有效角色');return}
 try{for(const text of membershipEvents){const at=nextMessageTimestamp(group);await saveMessage({id:makeId('msg'),groupId:group.id,senderType:'system',text,createdAt:at});group.lastMessage={text,senderName:'系统',createdAt:at}}await saveGroup(group);closeGroupSettings();await renderGroupList();await renderGroupConversation();notify('群聊设置已保存 ♡')}catch(err){notify('群聊设置保存失败：'+err.message)}
}
async function dissolveGroup(){if(!settingsGroupId)return;if(!confirm('确定解散这个群聊吗？群组、消息和群聊记忆索引将从本设备删除。已经同步到个人长期记忆的内容不会自动删除。'))return;try{await deleteGroupData(settingsGroupId);const id=settingsGroupId;settingsGroupId='';closeGroupSettings();if(activeGroupId===id)backToList();else renderGroupList();notify('群聊已解散')}catch(err){notify('解散失败：'+err.message)}}
async function exportGroup(){if(!settingsGroupId)return;try{const group=await getOne(STORE_GROUPS,settingsGroupId),messages=await listMessages(settingsGroupId),turns=(await getAll(STORE_TURNS)).filter(t=>t.groupId===settingsGroupId);const blob=new Blob([JSON.stringify({format:'LOVE_RECORD_GROUP_CHAT',version:1,group,messages,turns},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(group.name||'LOVE_RECORD_GROUP').replace(/[\\/:*?"<>|]/g,'_')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notify('群聊记录已导出')}catch(err){notify('导出失败：'+err.message)}}
function openMentionMenu(){const box=$('lrGroupMentionMenu');if(!box||!activeGroupId)return;getOne(STORE_GROUPS,activeGroupId).then(g=>{if(!g)return;const members=groupActiveMembers(g);box.innerHTML=members.map(m=>`<button type="button" data-lr-mention="${esc(m.contactId)}">@${esc(m.name||getName(m.contactId))}</button>`).join('');box.hidden=!box.hidden})}
function insertMention(id){const gId=activeGroupId;getOne(STORE_GROUPS,gId).then(g=>{const m=g?.members?.find(x=>String(x.contactId)===String(id));if(!m)return;const input=$('lrGroupInput'),text='@'+(m.name||getName(id))+' ';input.value=(input.value?input.value+' ':'')+text;input.focus();$('lrGroupMentionMenu').hidden=true})}
function parseModelJson(raw){let text=String(raw||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');try{return JSON.parse(text)}catch(_){}const a=text.indexOf('{'),b=text.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(text.slice(a,b+1))}catch(_){}}return null}
function extractAIText(data){let c=data?.choices?.[0]?.message?.content;if(Array.isArray(c))c=c.map(x=>x?.text||'').join('');if(typeof c==='string')return c;return String(data?.output_text||'')}
function splitBubbles(text){const parts=String(text||'').split(/\s*\|\|\|\s*/).map(x=>x.trim()).filter(Boolean);return parts.length?parts:[String(text||'').trim()].filter(Boolean)}
function groupReplyLimit(group){const n=Number(group?.maxAiMessagesPerTurn);return Number.isFinite(n)&&n>0?Math.max(1,Math.min(10,Math.floor(n))):4}
function resolveGroupSenderId(value,members){
 const raw=String(value??'').trim();if(!raw)return '';
 const exact=members.find(m=>String(m.contactId)===raw);if(exact)return String(exact.contactId);
 const normalized=raw.replace(/^@/,'').trim().toLocaleLowerCase();
 const matches=members.filter(m=>[m.name,getName(m.contactId),getPerson(m.contactId)?.name].some(name=>String(name||'').trim().toLocaleLowerCase()===normalized));
 return matches.length===1?String(matches[0].contactId):'';
}
async function fetchWithTimeout(url,options,timeout=90000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
async function compactGroupImageForAI(dataUrl){
 if(!dataUrl||!/^data:image\//i.test(dataUrl)||dataUrl.length<1800000)return dataUrl;
 try{
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片解码失败'));img.src=dataUrl});
  const scale=Math.min(1,1800/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((image.naturalWidth||image.width)*scale));canvas.height=Math.max(1,Math.round((image.naturalHeight||image.height)*scale));
  const context=canvas.getContext('2d');if(!context)return dataUrl;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.84);
 }catch(err){console.warn('[LOVE RECORD] group image optimization skipped',err);return dataUrl}
}
async function buildGroupImageContext(historyMessages){
 const imageMessages=(historyMessages||[]).filter(m=>m.kind==='image'&&m.attachmentId!=null).slice(-6);
 if(!imageMessages.length)return [];
 const parts=[];
 for(const message of imageMessages){
  const sender=message.senderType==='user'?'用户':(message.senderNameSnapshot||getName(message.senderId));
  parts.push({type:'text',text:`群聊图片｜发送者：${sender}｜时间：${timeLabel(message.createdAt)||'近期'}｜消息文字：${String(message.text||'[图片]').slice(0,180)}。请直接观察图片中可见内容，不确定的细节不要猜测。`});
  let dataUrl='';
  try{const loader=window.lrLoadChatAttachmentDataUrl||window.LRChatInteractionV11?.loadAttachmentDataUrl;if(typeof loader==='function')dataUrl=await loader(message.attachmentId)}catch(err){console.warn('[LOVE RECORD] group image context load failed',err)}
  if(dataUrl&&/^data:image\//i.test(dataUrl))parts.push({type:'image_url',image_url:{url:await compactGroupImageForAI(dataUrl),detail:'auto'}});
  else parts.push({type:'text',text:'（这张图片的本地附件暂时无法读取，请勿臆测图片内容。）'});
 }
 return parts;
}
const GROUP_STICKER_KEYWORDS={
 '开心':['开心','高兴','快乐','兴奋','欢呼','喜悦','happy','joy','excited'],
 '伤心':['伤心','难过','哭','哭哭','委屈','眼泪','sad','cry','teary'],
 '生气':['生气','愤怒','恼火','气死','angry','mad'],
 '平静':['平静','淡定','无表情','冷静','祥和','心如止水','波澜不惊','安详','平和','calm','neutral','serene'],
 '可爱':['可爱','萌','猫','小猫','狗','小狗','卡皮巴拉','cute','kawaii'],
 '撒娇':['撒娇','求抱抱','贴贴','乖','clingy'],
 '害羞':['害羞','脸红','不好意思','shy','blush'],
 '亲亲':['亲亲','亲吻','kiss'],
 '疑惑':['疑惑','不解','问号','困惑','confused'],
 '无奈':['无奈','无语','叹气','无聊','helpless','bored'],
 '晚安':['晚安','睡觉','困了','goodnight','sleepy']
};
function detectGroupStickerCategory(text,items){
 const value=String(text||'').toLowerCase(),categories=[...new Set((items||[]).map(x=>String(x?.category||'')).filter(Boolean))];
 const bracket=value.match(/[【\[（(]\s*([^】\]）)]+)\s*[】\]）)]/);
 if(bracket&&categories.includes(bracket[1].trim()))return bracket[1].trim();
 for(const category of categories)if(value.includes(category.toLowerCase()))return category;
 for(const [category,words] of Object.entries(GROUP_STICKER_KEYWORDS))if(categories.includes(category)&&words.some(word=>value.includes(word.toLowerCase())))return category;
 return '';
}
async function getUsableGroupStickers(){
 let items=[];
 try{items=typeof window.lrGetStickerItems==='function'?await window.lrGetStickerItems():[]}catch(error){console.warn('[LOVE RECORD] group sticker metadata unavailable',error);return []}
 if(!Array.isArray(items)||!items.length)return [];
 const loader=window.lrLoadChatAttachmentDataUrl||window.LRChatInteractionV11?.loadAttachmentDataUrl;
 if(typeof loader!=='function'){console.warn('[LOVE RECORD] group sticker attachment loader unavailable');return []}
 const usable=[];
 for(const item of items.slice(0,120)){
  if(!item||item.id==null||item.attachmentId==null)continue;
  try{const data=await loader(item.attachmentId);if(/^data:image\//i.test(String(data||'')))usable.push({...item});}
  catch(error){console.warn('[LOVE RECORD] unusable group sticker attachment',item.id,error)}
 }
 return usable;
}
function buildGroupSystem(group,activeMembers,history,stickerItems=[],stickerEnabled=true){
 const world=group.worldId?(host().getWorldBookPromptById?.(group.worldId)||''):(group.worldBookSelectionConfigured?'':(host().getWorldBookPrompt?.()||''));
 const sharedMemory=String(group.longTermMemory||'').trim();
 const memberProfiles=activeMembers.map(m=>{const p=getPerson(m.contactId)||{},meta=host().getChatMeta?.(m.contactId)||{};return `角色 ID：${m.contactId}\n姓名：${p.name||m.name}\n身份：${p.role||m.role||''}\n人设：${p.persona||p.personality||''}\n背景：${p.background||''}\n人物规则：${p.instructions||'保持人物一致，不要替用户决定行动、台词或情绪。'}\n个人长期记忆：${String(meta.longTermMemory||'暂无').slice(0,2500)}`}).join('\n\n---\n\n');
 const stickerList=stickerItems.map(x=>`${x.id}（分类：${x.category||'自定义'}${x.name?'；名称：'+x.name:''}）`).join('；');
 const stickerRules=stickerEnabled&&stickerItems.length?`\n用户真实收藏的表情包库（只能使用以下 ID）：${stickerList}。每位角色都可以像单聊一样，根据自己的语气、情绪和聊天语境决定是否发送。若要发送，优先在对应消息对象中设置 kind="sticker"、stickerId 为准确 ID；也可在 text 中添加 [[LR_STICKER:准确ID]] 标记。ID 必须逐字来自清单，不能自己编造图片；一次群聊回复最多一张，适合时再发，不要每条都发。用户明确要求发送、测试或展示表情包时，必须选择一张真实收藏图片并返回 kind="sticker" 与 stickerId，不能只用文字说"发了表情包"。`: '\n用户已关闭 AI 表情包同步，或者没有可用的收藏表情包。禁止生成表情包消息。';
 return `你是 LOVE RECORD 的自然群聊调度器。你需要在同一个群聊里扮演多位独立角色。群名：${group.name||'群聊'}。群公告：${group.announcement||'无'}。\n\n${'当前真实设备时间：'+exactGroupDateTime(Date.now())+'；设备时区：'+groupTimeZone()+ '。'}\n时间与日期是严格规则：近期历史每条消息都包含真实消息时间戳，必须以该条消息自己的时间戳解释“今天、昨天、明天、前天、上周”等相对日期，不得按当前日期重新计算，不得把昨天的事情说成今天。当前时钟只用于判断此刻时段，不能覆盖历史发生时间。除非用户明确说明时间经过，或消息时间戳确实体现时间变化，不得擅自跳过数小时或数天；时间不确定时先自然询问，不可编造。\n\n可参与的角色资料：\n${memberProfiles}\n\n群聊长期记忆：\n${sharedMemory||'暂无'}\n\n共同世界书：\n${world||'未选择世界书'}\n\n近期群聊历史（每条消息都带有真实 ID，可用于引用）：\n${history||'暂无历史'}\n${stickerRules}\n\n核心规则：\n1. 用户是群主和真实参与者。绝对不要替用户生成台词、行为、想法或情绪。\n2. 自然群聊：根据当前话题判断哪些角色适合发言。不要求所有角色每轮都回复。\n3. 允许角色互相回应、接话、吐槽或延续彼此话题，不要每条都只回答用户。\n4. 每条消息必须由一个真实成员发送，senderId 必须严格来自上方角色 ID。保持每个人的人设、语气、关系与知识边界，不得混淆身份。\n5. 角色只能知道自己亲自经历、被告知或在群聊中看到的事情。\n6. 如果用户 @ 某位角色，优先考虑该角色回应，但仍允许其他角色自然参与。\n7. 本轮最多生成 ${groupReplyLimit(group)} 条 AI 独立消息。上限不是必须凑满的固定目标，但也不要默认每轮只生成三条；如果有多位角色确实适合回应、接话或彼此互动，请充分展开到自然合理的数量，最多不超过上限。没有内容可说时才少发或返回空数组，绝不灌水。\n8. 每条消息应像即时通讯气泡，简洁自然；不写客服式总结，不强行在结尾提问。每位角色分别使用自己的 senderId（角色 ID）；不要用姓名代替 ID。\n9. 如果近期上下文附有群聊图片，必须先观察图片，并结合聊天语境回应图片中能确认的内容；不能确认的细节不要猜。\n10. 当回应某条消息时可以通过 quoteMessageId 引用它；只能使用历史中确实出现的消息 ID，不得编造 ID。特别适合回应用户引用消息或角色之间接话时使用，不要每条都引用。\n11. 角色可以主动发送模拟转账卡：在消息对象中设置 kind="transfer"、amount（正数）、note；这只是聊天模拟，不会发生真实付款。也可在 text 中输出 [[LR_TRANSFER amount=金额 currency=￥ note=备注]]。\n12. 角色可以分享地点卡：仅使用聊天里已提到、设定里已知或角色明确说明的地点，不得假装读取 GPS 或编造用户实时位置。消息对象设置 kind="location"、place、note；也可在 text 中写 [[LR_LOCATION place=地点名称|note=补充说明]]。\n13. memoryUpdates 的 content 必须使用对应历史消息的真实时间戳为事件标注完整年月日（YYYY-MM-DD）；若对话里说“昨天/今天/上周”，必须按那条消息自己的时间戳换算，不能使用当前日期代替事件日期。没有足够依据时标注“日期未确认”，不要编造。\n14. 仅输出 JSON，不要 Markdown，不要代码围栏。\n\n返回结构：\n{"messages":[{"senderId":"上方某个角色ID","text":"该角色发出的消息","quoteMessageId":"可选，引用的真实消息ID","kind":"可选：transfer、location 或 sticker","amount":"转账金额","note":"备注","place":"地点名称","stickerId":"可选的真实表情包ID"}],"memoryUpdates":[{"contactId":"角色ID","content":"仅记录该角色确实知道且长期有意义的重要事件"}]}\n\nmemoryUpdates 只记录明确、稳定且值得未来记住的事件或约定；必须用对应消息的历史日期标注事件时间，不要把当前写入时间当成事件发生时间；不要记录日常寒暄、猜测或角色没有参与/不知道的事情。没有重要事件时返回空数组。内容要短小、准确。`;
}
async function syncGroupMemory(group,turnId,memoryUpdates){
 if(!Array.isArray(memoryUpdates)||!memoryUpdates.length)return;
 for(const item of memoryUpdates){const id=String(item?.contactId||'');const content=String(item?.content||'').trim();if(!id||!content||!groupActiveMembers(group).some(m=>m.contactId===id)||!getPerson(id))continue;
  try{const meta=host().getChatMeta?.(id)||{},done=Array.isArray(meta.groupMemorySyncedTurns)?meta.groupMemorySyncedTurns:[];if(done.includes(turnId))continue;const prefix=`[群聊记忆·${group.name||'群聊'}·写入时间：${exactGroupDateTime(Date.now())}] `;const line=prefix+content;const old=String(meta.longTermMemory||'').trim();if(!old.includes(content)){meta.longTermMemory=(old?old+'\n':'')+line;meta.longTermMemory=meta.longTermMemory.slice(-8800)}meta.groupMemorySyncedTurns=[...done,turnId].slice(-200);await host().saveChatMeta?.(id,meta)}catch(err){console.warn('[LOVE RECORD] group memory sync failed for '+id,err)}
 }
}
async function maybeSummarizeGroupMemory(groupId){
 try{
  const group=await getOne(STORE_GROUPS,groupId);if(!group)return;
  const messages=(await listMessages(groupId)).filter(m=>m.senderType==='user'||m.senderType==='character');
  let through=Math.max(0,parseInt(group.memorySummarizedThrough,10)||0);if(through>messages.length)through=0;
  const threshold=Math.max(1,Math.min(100,parseInt(group.autoMemoryCount,10)||15));if(messages.length-through<threshold)return;
  const batch=messages.slice(through),api=host().getApiConfig?.()||{};if(!api.apiBase||!api.apiKey||!api.apiModel)return;
  $('lrGroupHint').textContent='正在整理群聊长期记忆…';
  const transcript=batch.map(m=>`[消息时间：${exactGroupDateTime(m.createdAt)}] ${m.senderType==='user'?'用户':(m.senderNameSnapshot||getName(m.senderId))}：${String(m.text||'').slice(0,600)}`).join('\n');
  const system='你是 LOVE RECORD 群聊的长期记忆整理器。整理后的群聊记忆必须按角色分区；在每个角色自己的区块中，以该角色第一人称“我”记录自己亲历、说过、感受到或明确知道的事。用户行动与偏好仍写作“用户/妍妍”，不能把用户经历变成角色自己的经历，也不能把某一角色的经历归到其他角色。只记录聊天明确出现的稳定偏好、关系、重要经历、共同约定与持续事项，不推测、不编造。每条消息有真实发送时间；必须保留重要事件的完整年月日，必要时记录时分；“今天/昨天/明天/前天/上周”等相对日期必须以该条消息自己的时间戳换算，绝不能按总结当天重新解释，也不能把昨天的事改成今天。无法确认日期时标注“日期未确认”。旧事件保留为历史。建议分区：群聊共同事实、用户信息、各角色第一人称记忆、共同约定与待办、重要日期。控制在 2500 个汉字以内，只输出记忆正文。';
  const response=await fetchWithTimeout(api.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+api.apiKey,'Accept':'application/json'},body:JSON.stringify({model:api.apiModel,messages:[{role:'system',content:system},{role:'user',content:`当前真实时间：${exactGroupDateTime(Date.now())}；设备时区：${groupTimeZone()}。\n已有群聊长期记忆：\n${group.longTermMemory||'（暂无）'}\n\n本次新增群聊（每条时间戳是解释日期的唯一依据）：\n${transcript}\n\n请按角色第一人称视角整合并保留重要事件绝对日期。`}],stream:false})},45000);
  const raw=await response.text();if(!response.ok)throw new Error('HTTP '+response.status);const payload=JSON.parse(raw),result=extractAIText(payload).trim();if(!result)throw new Error('总结内容为空');
  const latest=await getOne(STORE_GROUPS,groupId);if(!latest)return;latest.longTermMemory=result.slice(0,9000);latest.memorySummarizedThrough=messages.length;latest.lastMemorySummaryAt=Date.now();await saveGroup(latest);notify('群聊长期记忆已更新 ♡');
 }catch(err){console.warn('[LOVE RECORD] group long-memory summary skipped:',err);notify('群聊长期记忆总结未完成，下次达到条件时会重试')}
}
async function generateGroupTurn(group,userMessage,turn){
 if(busy){notify('群聊正在生成，请稍候');turn.status='cancelled';turn.completedAt=Date.now();turn.error='已有群聊生成任务正在运行';await saveTurn(turn).catch(()=>{});return}const api=host().getApiConfig?.()||{};if(!api.apiBase||!api.apiKey||!api.apiModel){notify('请先在 LOVE RECORD 设置中连接 AI API');turn.status='failed';turn.error='尚未配置 AI API';turn.failedAt=Date.now();await saveTurn(turn).catch(()=>{});return}
 const members=groupActiveMembers(group);if(!members.length){notify('群聊没有可用角色，请检查群成员');turn.status='failed';turn.error='群聊没有可用角色';turn.failedAt=Date.now();await saveTurn(turn).catch(()=>{});return}
 busy=true;$('lrGroupSend').disabled=true;$('lrGroupSend').textContent='…';const aiButton=$('lrGroupAiCall');if(aiButton){aiButton.disabled=true;aiButton.setAttribute('aria-busy','true')}$('lrGroupHint').textContent='角色正在思考谁适合加入对话…';
 try{
  const historyMsgs=(await listMessages(group.id)).filter(m=>m.senderType==='user'||m.senderType==='character').slice(-Math.max(1,Math.min(100,Number(group.memoryCount)||50)));const latestUserMessage=[...historyMsgs].reverse().find(m=>m.senderType==='user')||null;const latestUserText=String(latestUserMessage?.text||'');const history=historyMsgs.map(m=>{const sender=m.senderType==='user'?'用户':m.senderType==='system'?'系统':(m.senderNameSnapshot||getName(m.senderId));const quoted=m.quoteMessageId?`（引用 ${m.quotedSenderName||'消息'}：${String(m.quotedText||'').slice(0,160)}）`:'';return `[消息ID:${m.id}] [消息时间：${exactGroupDateTime(m.createdAt)}] ${sender}：${String(m.text||({image:'[图片]',sticker:'[表情包]',transfer:'[转账卡]',location:'[位置卡]'}[m.kind]||'')).slice(0,700)}${quoted}`}).join('\n');
  let stickerEnabled=true;try{const pref=localStorage.getItem('love-record-ai-sticker-sync-v1');stickerEnabled=pref===null||pref==='1'}catch(_){}
  // Load the real library and verify each attachment can be read before exposing it to AI.
  const stickerItems=stickerEnabled?await getUsableGroupStickers():[];
  if(stickerEnabled&&!stickerItems.length)console.warn('[LOVE RECORD] sticker sync is on, but no readable saved sticker images were found.');
  const system=buildGroupSystem(group,members,history,stickerItems,stickerEnabled);
  const activeUserText=String(userMessage?.text||latestUserText||'');
  const mentionNames=members.filter(m=>activeUserText.includes('@'+m.name)||activeUserText.includes('@'+getName(m.contactId))).map(m=>m.name||getName(m.contactId));
  const imageContext=await buildGroupImageContext(historyMsgs);
  const userPrompt=userMessage?.manualTrigger
   ?`用户点击了输入栏旁边的「AI 调用」按钮，没有发送新消息。最近一条用户消息是：${latestUserText||'（暂无）'}。请把它作为当前上下文的重要线索；若其中明确要求发送或测试表情包，请按系统规则发送一张真实收藏图片。请不要虚构用户的新台词或行动；直接根据最近的群聊上下文、群聊长期记忆、成员人设${imageContext.length?'及随附图片':''}，自然判断哪些角色适合主动延续话题、回应其他成员或开启轻量互动。不要固定只输出三条；如果有多位角色自然有话可说，可以充分利用本轮上限。请严格按 JSON 结构返回。`
   :`用户刚刚在群聊中发送：\n${userMessage?.text||''}\n\n本轮被 @ 的角色（如果有）：${mentionNames.join('、')||'无'}。${imageContext.length?'请认真观察随附图片，并结合图片内容与聊天语境回应。':''}\n请基于群聊历史生成自然的多人互动；如果有多个角色适合接话，请不要默认只生成三条，并严格按 JSON 结构返回。`;
  const apiMessages=[{role:'system',content:system}];
  const userContent=imageContext.length?[{type:'text',text:'以下是近期群聊中实际发送的图片。请将图片与上方聊天记录对应起来理解：'},...imageContext,{type:'text',text:userPrompt}]:userPrompt;
  apiMessages.push({role:'user',content:userContent});
  const response=await fetchWithTimeout(api.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+api.apiKey,'Accept':'application/json'},body:JSON.stringify({model:api.apiModel,messages:apiMessages,stream:false})},90000);
  const raw=await response.text();if(!response.ok){const detail='HTTP '+response.status+' · '+raw.slice(0,220);if(imageContext.some(part=>part.type==='image_url')&&/image|vision|multimodal|unsupported|content.?type/i.test(raw))throw new Error('当前 API 模型或服务商可能不支持图片输入，请确认使用支持视觉识别的模型。'+detail);throw new Error(detail)}let payload;try{payload=JSON.parse(raw)}catch(_){throw new Error('API 返回的不是有效 JSON')};const content=extractAIText(payload);if(!content)throw new Error('AI 没有返回群聊内容');let parsed=parseModelJson(content);
  if(!parsed){const fallback=content.replace(/```[\s\S]*?```/g,'').trim();if(fallback){const target=members.find(m=>mentionNames.includes(m.name))||members[0];parsed={messages:[{senderId:target.contactId,text:fallback}],memoryUpdates:[]}}else parsed={messages:[],memoryUpdates:[]}}
  const limit=groupReplyLimit(group);const rawMessages=Array.isArray(parsed.messages)?parsed.messages:[];let count=0;
  const mentionedMember=members.find(m=>mentionNames.some(n=>String(n).toLocaleLowerCase()===String(m.name||getName(m.contactId)).toLocaleLowerCase()));
  const messageById=new Map(historyMsgs.map(m=>[String(m.id),m]));
  const outgoing=[];
  const stickerById=new Map(stickerItems.map(x=>[String(x.id),x]));let stickerSentThisTurn=false;
  for(const item of rawMessages){
   if(outgoing.length>=limit)break;
   const senderCandidates=[item?.senderId,item?.contactId,item?.senderName,item?.speaker,item?.name,(typeof item?.sender==='object'?(item.sender.id||item.sender.name):item?.sender)].filter(value=>value!=null&&String(value).trim());
   const senderId=senderCandidates.map(value=>resolveGroupSenderId(value,members)).find(Boolean)||(mentionedMember?String(mentionedMember.contactId):'');
   if(!senderId)continue;
   const member=members.find(m=>String(m.contactId)===senderId);if(!member)continue;
   let text=String(item?.text??item?.content??item?.message??'').trim();
   const quoteId=String(item?.quoteMessageId||item?.replyToId||item?.quoteId||'').trim();
   const quoted=quoteId?messageById.get(quoteId):null;
   const quoteFields=quoted?{quoteMessageId:String(quoted.id),quotedSenderName:quoted.senderType==='user'?'我':(quoted.senderNameSnapshot||getName(quoted.senderId)),quotedText:quoted.text||({image:'[图片]',sticker:'[表情包]',transfer:'[转账卡]',location:'[位置卡]'}[quoted.kind]||'[消息]'),quotedSenderType:quoted.senderType}:{};
   const common={senderType:'character',senderId,senderNameSnapshot:member.name||getName(senderId),senderRoleSnapshot:member.role||'',turnId:turn.id,...quoteFields};
   const transferMarker=text.match(/\[\[\s*LR_TRANSFER\s+amount=([\d,.]+)(?:\s+currency=([^\s\]]+))?(?:\s+note=([^\]]*))?\s*\]\]/i);
   const locationMarker=text.match(/\[\[\s*LR_LOCATION\s+place=([^|\]]+)(?:\|note=([^\]]+))?\s*\]\]/i);
   const stickerMarker=text.match(/\[\[\s*LR_STICKER\s*:\s*([^\]]+?)\s*\]\]/i);
   const explicitKind=String(item?.kind||'').toLowerCase();
   if(explicitKind==='transfer'||transferMarker){
    const amount=Number(String(item?.amount??transferMarker?.[1]??'').replace(/,/g,'').replace(/[^\d.-]/g,''));
    if(Number.isFinite(amount)&&amount>0){const note=String(item?.note??transferMarker?.[3]??'给你的小心意').trim().replace(/^['"]|['"]$/g,'');outgoing.push({...common,kind:'transfer',amount:amount.toFixed(2),currency:'￥',note:note||'给你的小心意',text:'转账 ￥'+amount.toFixed(2)});}
    text=text.replace(/\[\[\s*LR_TRANSFER[^\]]*\]\]/ig,'').trim();
   }
   if(explicitKind==='location'||locationMarker){
    const place=String(item?.place??locationMarker?.[1]??'').trim().replace(/^['"]|['"]$/g,'');
    if(place)outgoing.push({...common,kind:'location',place,note:String(item?.note??locationMarker?.[2]??'').trim(),text:'位置：'+place});
    text=text.replace(/\[\[\s*LR_LOCATION[^\]]*\]\]/ig,'').trim();
   }
   let chosenStickerId=String(item?.stickerId??item?.sticker_id??item?.sticker?.id??stickerMarker?.[1]??'').trim();
   if(stickerMarker)text=text.replace(stickerMarker[0],'').trim();
   if(explicitKind==='sticker'&&(!chosenStickerId||!stickerById.has(chosenStickerId))){
    const requestedCategory=String(item?.stickerCategory||item?.category||'').trim()||detectGroupStickerCategory(text,stickerItems);
    const categoryMatch=requestedCategory?stickerItems.find(x=>String(x.category||'')===requestedCategory):null;
    const nameMatch=stickerItems.find(x=>String(x.name||'').trim()&&text.toLowerCase().includes(String(x.name).toLowerCase()));
    const selected=nameMatch||categoryMatch||stickerItems[0];if(selected)chosenStickerId=String(selected.id);
   }
   if(explicitKind==='sticker')text=text.replace(/\[?表情包[：:]?[^\]】]*[\]】]?/gi,'').trim();
   if(text){
    const bubbles=splitBubbles(text);
    for(const bubble of bubbles){if(outgoing.length>=limit)break;outgoing.push({...common,text:bubble});}
   }
   if(chosenStickerId&&stickerEnabled&&!stickerSentThisTurn&&stickerById.has(chosenStickerId)&&outgoing.length<limit){const sticker=stickerById.get(chosenStickerId);outgoing.push({...common,kind:'sticker',attachmentId:sticker.attachmentId,stickerId:String(sticker.id),stickerCategory:String(sticker.category||'自定义'),text:'[表情包：'+String(sticker.category||'自定义')+']'});stickerSentThisTurn=true;}
   if(!text&&!chosenStickerId&&!transferMarker&&!locationMarker&&explicitKind==='transfer')continue;
  }
  // Match the single-chat fallback: a model that forgets the marker must not turn an explicit sticker request into text-only narration.
  const requestText=String(userMessage?.text||(userMessage?.manualTrigger?latestUserText:''));
  const requestMessageId=String(userMessage?.id||(userMessage?.manualTrigger?latestUserMessage?.id:''));
  const handledStickerRequestIds=Array.isArray(group.aiStickerRequestHandledMessageIds)?group.aiStickerRequestHandledMessageIds.map(String):[];
  const stickerRequestAlreadyHandled=!!requestMessageId&&handledStickerRequestIds.includes(requestMessageId);
  const explicitStickerRequest=!stickerRequestAlreadyHandled&&/(?:表情包|贴图|贴纸)/i.test(requestText)&&/(?:发|给|来|发送|用|测试|试一下|看看|展示)/i.test(requestText);
  const modelStickerIntent=rawMessages.some(item=>/(?:表情包|贴图|贴纸)/i.test(String(item?.text??item?.content??item?.message??'')));
  const alreadyHasSticker=outgoing.some(message=>message.kind==='sticker');
  if(stickerEnabled&&stickerItems.length&&!alreadyHasSticker&&(explicitStickerRequest||modelStickerIntent)){
   const combined=[requestText,...rawMessages.map(item=>String(item?.text??item?.content??item?.message??''))].join('\n');
   const preferredCategory=detectGroupStickerCategory(combined,stickerItems);
   const filenameMatch=combined.match(/[【\[]([^】\]]+\.(?:png|jpe?g|gif|webp|bmp))】?/i);
   const named=filenameMatch?stickerItems.find(x=>String(x.name||'').toLowerCase().includes(filenameMatch[1].replace(/\.(?:png|jpe?g|gif|webp|bmp)$/i,'').toLowerCase())):null;
   const chosen=named||(preferredCategory?stickerItems.find(x=>String(x.category||'')===preferredCategory):null)||stickerItems[0];
   if(chosen){
    // Respect the configured per-round cap; replace the last plain text bubble only if the cap is already full.
    if(outgoing.length>=limit){let replaceIndex=outgoing.map((m,i)=>({m,i})).reverse().find(x=>x.m.kind!=='sticker')?.i;if(replaceIndex==null&&outgoing.length)replaceIndex=outgoing.length-1;if(replaceIndex!=null)outgoing.splice(replaceIndex,1);}
    if(outgoing.length<limit){
     const lastSpeaker=[...outgoing].reverse().find(m=>m.senderType==='character');
     const fallbackMember=members.find(m=>String(m.contactId)===String(lastSpeaker?.senderId))||mentionedMember||members[0];
     outgoing.push({senderType:'character',senderId:String(fallbackMember.contactId),senderNameSnapshot:fallbackMember.name||getName(fallbackMember.contactId),senderRoleSnapshot:fallbackMember.role||'',turnId:turn.id,kind:'sticker',attachmentId:chosen.attachmentId,stickerId:String(chosen.id),stickerCategory:String(chosen.category||'自定义'),text:'[表情包：'+String(chosen.category||'自定义')+']'});
    }
   }
  }
  if(explicitStickerRequest&&!outgoing.some(message=>message.kind==='sticker')){
   if(!stickerEnabled)notify('请先在表情包收藏中开启「AI 同步使用表情包图片」。');
   else if(!stickerItems.length)notify('表情包同步已开启，但暂时读取不到收藏图片附件；请重新上传这张表情包后再试。');
  }
  for(let index=0;index<outgoing.length&&count<limit;index++){
   const msg={id:makeId('msg'),groupId:group.id,createdAt:nextMessageTimestamp(group),...outgoing[index]};
   await saveMessage(msg);count++;group.lastMessage={text:msg.text||({image:'[图片]',sticker:'[表情包]',transfer:'转账卡',location:'位置分享'}[msg.kind]||'新消息'),senderName:msg.senderNameSnapshot,createdAt:msg.createdAt};await saveGroup(group);
   appendGroupMessageToView(msg,group);
   if(index<outgoing.length-1&&count<limit)await new Promise(resolve=>setTimeout(resolve,560));
  }
  if(requestMessageId&&explicitStickerRequest&&outgoing.some(message=>message.kind==='sticker')){
   group.aiStickerRequestHandledMessageIds=[...handledStickerRequestIds,requestMessageId].slice(-100);await saveGroup(group);
  }
  await syncGroupMemory(group,turn.id,Array.isArray(parsed.memoryUpdates)?parsed.memoryUpdates:[]);
  await maybeSummarizeGroupMemory(group.id);
  turn.status='completed';turn.completedAt=Date.now();turn.generatedCount=count;await saveTurn(turn);
  if(!count)notify('本轮没有角色需要接话，可以继续说点什么。');
 }catch(err){console.error('[LOVE RECORD] group turn failed',err);turn.status='failed';turn.error=String(err?.message||err);turn.failedAt=Date.now();await saveTurn(turn).catch(()=>{});notify('群聊回复失败：'+(err?.message||'请检查 API'))}
 finally{busy=false;$('lrGroupSend').disabled=false;$('lrGroupSend').textContent='发送';const aiButton=$('lrGroupAiCall');if(aiButton){aiButton.disabled=false;aiButton.removeAttribute('aria-busy')}await renderGroupConversation().catch(()=>{});}
}
async function sendGroupMessage(){
 if(!activeGroupId||busy||sending)return;
 const input=$('lrGroupInput'),button=$('lrGroupSend'),text=String(input?.value||'').trim();if(!text)return;
 sending=true;if(button)button.disabled=true;
 try{
  const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;
  const message={id:makeId('msg'),groupId:group.id,senderType:'user',senderId:'user',senderNameSnapshot:'我',text,createdAt:nextMessageTimestamp(group),...(quoteDraft?{quoteMessageId:quoteDraft.messageId,quotedSenderName:quoteDraft.senderName,quotedText:quoteDraft.text,quotedSenderType:quoteDraft.senderType}: {})};
  await saveMessage(message);group.lastMessage={text,senderName:'我',createdAt:message.createdAt};await saveGroup(group);
  input.value='';quoteDraft=null;await renderGroupConversation();
  const hint=$('lrGroupHint');if(hint)hint.textContent='消息已发送 · 点击 ✦ 手动调用 AI';
 }catch(err){notify('消息发送失败：'+err.message)}
 finally{sending=false;if(button&&!busy){button.disabled=false;button.textContent='发送'}}
}
async function invokeGroupAI(){if(!activeGroupId||busy||sending)return;sending=true;const button=$('lrGroupAiCall');if(button)button.disabled=true;try{const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;const turn={id:makeId('turn'),groupId:group.id,userMessageId:null,trigger:'manual-ai-call',status:'generating',createdAt:Date.now(),generatedCount:0};await saveTurn(turn);await generateGroupTurn(group,{id:'',text:'',manualTrigger:true},turn)}catch(err){notify('AI 调用失败：'+(err?.message||'请检查 API 配置'))}finally{sending=false;if(button&&!busy)button.disabled=false}}
function installStyles(){if($('lrGroupChatStyles'))return;const st=document.createElement('style');st.id='lrGroupChatStyles';st.textContent=`
#lrGroupList{margin:0 0 14px}#lrGroupList[hidden]{display:none!important}.lr-group-list-head{display:flex;justify-content:space-between;align-items:center;padding:8px 4px 9px;color:var(--muted,#988a9d);font-size:10px;letter-spacing:1.8px}.lr-group-list-head small{letter-spacing:0;font-size:11px}.lr-group-list-item{width:100%;display:flex;align-items:center;gap:11px;text-align:left;padding:12px 10px;border:1px solid rgba(181,164,191,.18);border-radius:17px;background:rgba(255,255,255,.7);margin-bottom:8px;color:var(--ink,#554b5d);box-shadow:0 5px 16px rgba(70,50,80,.04)}.lr-group-list-avatar,.lr-group-avatar{width:44px;height:44px;min-width:44px;border-radius:15px;background:linear-gradient(145deg,#eee7f2,#e1d7e9);display:grid;place-items:center;overflow:hidden;color:#806d8d;font-size:13px}.lr-group-list-avatar img,.lr-group-avatar img{width:100%;height:100%;object-fit:cover}.lr-group-list-copy{display:grid;gap:4px;flex:1;min-width:0}.lr-group-list-copy strong{font-size:13px;font-weight:600}.lr-group-list-copy small{font-size:11px;color:var(--muted,#93869a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr-group-list-meta{display:grid;justify-items:end;gap:5px;color:var(--muted,#9a8da0);font-size:10px}.lr-group-list-meta b{font-weight:500}.lr-group-conversation{position:relative;min-height:calc(100dvh - 128px);height:calc(100dvh - 128px);display:flex;flex-direction:column;background:#f7f3f9;border-radius:0;overflow:hidden}.lr-group-conversation[hidden]{display:none!important}.lr-group-head{display:flex;align-items:center;gap:11px;padding:12px 14px;background:rgba(255,255,255,.82);border-bottom:1px solid rgba(150,130,160,.12)}.lr-group-head-copy{flex:1;min-width:0;display:grid;gap:3px}.lr-group-head-copy strong{font-size:14px;font-weight:600;color:#5e5266}.lr-group-head-copy small{font-size:11px;color:#a094a5}.lr-group-head-action{width:36px;height:36px;border:1px solid rgba(160,140,175,.2);background:#fff;border-radius:50%;font-size:20px;color:#8c7b97}.lr-group-announcement{padding:8px 13px;background:rgba(239,231,244,.88);font-size:11px;color:#81718b;line-height:1.55}.lr-group-announcement[hidden]{display:none}.lr-group-messages{flex:1;min-height:160px;overflow:auto;padding:16px 12px 22px;display:flex;flex-direction:column;gap:13px;background:#f7f3f9;background-size:cover;background-position:center}.lr-group-message-row{display:flex;align-items:flex-start;gap:8px;max-width:94%}.lr-group-message-row.is-user{flex-direction:row-reverse;align-self:flex-end}.lr-group-message-avatar{width:30px;height:30px;min-width:30px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#e8dfed;color:#806b8a;font-size:11px}.lr-group-message-avatar img{width:100%;height:100%;object-fit:cover}.lr-group-message-content{display:grid;gap:4px;min-width:0}.lr-group-message-name{font-size:10px;color:#988b9f;padding:0 4px}.lr-group-message-name time{margin-left:6px;opacity:.7}.lr-group-message-bubble{padding:10px 12px;border:1px solid rgba(170,150,180,.12);border-radius:15px 15px 15px 5px;background:rgba(255,255,255,.93);color:#514758;font-size:13px;line-height:1.7;overflow-wrap:anywhere;box-shadow:0 4px 12px rgba(62,42,75,.035)}.is-user .lr-group-message-bubble{background:linear-gradient(145deg,#e9e0ee,#e3d8e9);border-radius:15px 15px 5px 15px;color:#5f5068}.lr-group-system-message{text-align:center;margin:2px auto}.lr-group-system-message span{display:inline-block;padding:5px 10px;border-radius:99px;background:rgba(255,255,255,.65);color:#a094a5;font-size:10px}.lr-group-empty{text-align:center;margin:auto;color:#a398aa;font-size:12px;line-height:1.8;padding:24px}.lr-group-compose{display:flex;align-items:flex-end;gap:7px;padding:9px 10px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.9);border-top:1px solid rgba(150,130,160,.12)}.lr-group-compose textarea{flex:1;min-width:0;max-height:100px;resize:none;border:1px solid rgba(169,151,179,.22);border-radius:16px;padding:10px 12px;background:#fff;color:#514758;font:inherit;font-size:13px;line-height:1.5}.lr-group-compose{position:relative}.lr-group-plus{width:38px;height:38px;min-width:38px;border:1px solid rgba(169,151,179,.22);border-radius:13px;background:#fff;color:#826f8c;font-size:24px;line-height:1}.lr-group-plus-menu{position:absolute;left:10px;bottom:calc(100% + 9px);z-index:10025;width:min(260px,78vw);max-height:min(66dvh,520px);overflow:auto;padding:8px;border:1px solid rgba(169,151,179,.2);border-radius:18px;background:rgba(255,255,255,.97);box-shadow:0 12px 34px rgba(70,48,82,.16);display:grid;gap:2px;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.lr-group-plus-menu[hidden]{display:none!important}.lr-group-plus-menu button{width:100%;border:0;border-radius:11px;background:transparent;padding:10px 12px;text-align:left;color:#55495d;font:inherit;font-size:13px}.lr-group-plus-menu button:active{background:#f2eaf5}.lr-group-compose #lrGroupImageInput{display:none}.lr-group-tool-members{display:grid;gap:8px;margin-top:12px}.lr-group-tool-member{width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #eee6f1;border-radius:14px;background:#fff;text-align:left;color:#55495d;font:inherit}.lr-group-tool-avatar{width:36px;height:36px;border-radius:13px;background:#eee7f2;display:grid;place-items:center;color:#866f91}.lr-group-tool-member>span:nth-child(2){display:grid;gap:3px;flex:1}.lr-group-tool-member b{font-size:13px;font-weight:500}.lr-group-tool-member small{font-size:10px;color:#9b8da1}.lr-group-tool-arrow{font-size:20px;color:#b09ab8}.lr-group-diary-sheet{max-height:88vh}.lr-group-diary-sheet select{width:100%;border:1px solid #e9e1ec;border-radius:15px;padding:13px 14px;background:#fcfafd;color:#403747;font:inherit;font-size:14px}.lr-group-diary-sheet input,.lr-group-diary-sheet textarea{width:100%;box-sizing:border-box}.lr-group-diary-sheet textarea{min-height:150px}.lr-group-diary-status{margin-top:12px;color:#92859a;font-size:11px;line-height:1.6}.lr-group-attachment{display:block;min-height:28px;color:#93859a;font-size:11px}.lr-group-chat-image{display:block;max-width:min(66vw,280px);max-height:360px;object-fit:cover;border-radius:12px}.lr-group-sticker-image{display:block;max-width:min(52vw,200px);max-height:210px;object-fit:contain;border-radius:12px}.lr-group-transfer-card,.lr-group-order-card{min-width:190px;max-width:270px;padding:17px 18px;border-radius:18px;background:linear-gradient(145deg,#c5a7d0,#9877a8);color:#fff;box-shadow:0 8px 20px rgba(126,93,143,.14)}.lr-group-transfer-card small,.lr-group-order-card small{display:block;font-size:9px;letter-spacing:1.4px;opacity:.78;margin-bottom:8px}.lr-group-transfer-card strong{display:block;font:28px Georgia,serif;margin-bottom:6px}.lr-group-transfer-card span,.lr-group-order-card span{display:block;font-size:12px;line-height:1.65}.lr-group-order-card strong{display:block;font-size:14px;margin-bottom:6px}.lr-group-order-card b{display:block;font:21px Georgia,serif;margin-top:10px}.lr-group-order-card small:last-child{margin:8px 0 0;letter-spacing:0}.lr-group-location-card{display:block;min-width:175px;text-decoration:none;color:#6c5877;background:#f7f1fa;border-radius:15px;padding:13px}.lr-group-location-card b,.lr-group-location-card span,.lr-group-location-card small{display:block}.lr-group-location-card span{margin-top:7px;font-size:13px}.lr-group-location-card small{margin-top:5px;color:#9b8ba3;font-size:10px}.lr-group-at,.lr-group-send{min-width:38px;height:38px;border:0;border-radius:13px;background:#eee7f2;color:#826f8c;font-size:14px}.lr-group-send{padding:0 13px;background:var(--lr-accent,#ad91bd);color:#fff}.lr-group-send:disabled{opacity:.55}.lr-group-hint{text-align:center;background:rgba(255,255,255,.9);color:#a99eae;font-size:9px;padding:0 8px 6px}.lr-group-mention-menu{position:absolute;left:12px;bottom:75px;z-index:10;padding:6px;border:1px solid #e9e0ed;border-radius:13px;background:#fff;box-shadow:0 8px 24px #42304a18;display:grid;gap:3px;max-height:190px;overflow:auto}.lr-group-mention-menu[hidden]{display:none}.lr-group-mention-menu button{border:0;background:transparent;padding:9px 13px;text-align:left;color:#766781;border-radius:8px}.lr-group-modal{z-index:2147483100}.lr-group-modal.show{display:flex!important;align-items:flex-start;overflow:auto;padding:12px 10px calc(25px + env(safe-area-inset-bottom))}.lr-group-sheet{width:min(100%,620px);max-height:calc(100dvh - 24px);overflow:auto;border-radius:22px;background:var(--panel,#fff);padding:18px}.lr-group-sheet label{display:block;margin:13px 0 6px;color:var(--muted,#92859a);font-size:12px}.lr-group-sheet input:not([type=checkbox]),.lr-group-sheet textarea,.lr-group-sheet select{width:100%;box-sizing:border-box;border:1px solid var(--line,#e9e1ec);border-radius:12px;background:#fff;padding:11px;color:var(--ink,#514758);font:inherit}.lr-group-picker{display:grid;gap:7px;margin-top:10px;max-height:330px;overflow:auto}.lr-group-picker-item{display:flex!important;align-items:center;gap:10px;padding:10px 11px;border:1px solid rgba(165,145,177,.16);border-radius:13px;background:rgba(255,255,255,.78);margin:0!important}.lr-group-picker-item input{width:17px;height:17px;accent-color:var(--lr-accent,#ad91bd)}.lr-group-picker-item span{display:grid;gap:3px}.lr-group-picker-item b{font-size:12px;color:#62566b}.lr-group-picker-item small{font-size:10px;color:#9b8fa2}.lr-group-picker.compact{max-height:180px}.lr-group-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.lr-group-modal-actions button{min-height:42px}.lr-group-empty-picker{padding:18px;text-align:center;color:#9c90a2;font-size:12px}.lr-group-settings-section{margin-top:18px;padding-top:14px;border-top:1px solid rgba(165,145,177,.16)}.lr-group-section-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#6b5c73;margin-bottom:9px}.lr-group-section-head span{font-size:11px;color:#a094a7}.lr-group-manage-members{display:grid;gap:7px}.lr-group-member-row{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid rgba(165,145,177,.13);border-radius:12px}.lr-group-member-avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#eee7f2;color:#867391;font-size:11px}.lr-group-member-info{flex:1;display:grid;gap:3px}.lr-group-member-info b{font-size:12px;color:#66596e}.lr-group-member-info small{font-size:10px;color:#a094a7}.lr-group-member-remove{border:0;background:transparent;color:#aa777c;font-size:11px;padding:7px}.lr-group-member-row.will-remove{background:rgba(174,116,126,.08);border-color:rgba(174,116,126,.22)}.lr-group-member-row.will-remove .lr-group-member-remove{color:#8e7c91}.lr-group-image-fields{display:grid;gap:14px;margin-top:14px}.lr-group-image-preview{width:88px;height:88px;border-radius:18px;display:grid;place-items:center;overflow:hidden;background:#eee7f2;color:#857391;font-size:13px;border:1px solid rgba(165,145,177,.18);margin:7px 0}.lr-group-image-preview.wide{width:100%;height:112px;border-radius:14px;padding:8px;box-sizing:border-box;text-align:center;font-size:11px}.lr-group-image-preview img{width:100%;height:100%;object-fit:cover}.lr-group-image-preview.wide img{object-fit:cover}.lr-group-image-fields .actions{display:flex;gap:7px;flex-wrap:wrap}.lr-group-image-fields .actions .btn{font-size:11px;padding:8px 11px}.lr-group-member-row.will-remove .lr-group-member-info small{color:#a56f79}.lr-group-danger{width:100%;margin-top:12px;color:#a66c75;border-color:rgba(166,108,117,.25)}
.lr-group-setting-card{margin-top:18px;padding:15px;border:1px solid rgba(165,145,177,.16);border-radius:18px;background:rgba(255,255,255,.72)}
.lr-group-setting-card h3{margin:0 0 10px;font-size:15px;font-weight:500;color:#584c60}
.lr-group-setting-card label{display:block;margin:10px 0 6px;color:#92859a;font-size:12px}
.lr-group-setting-card input,.lr-group-setting-card select,.lr-group-setting-card textarea{width:100%;box-sizing:border-box;border:1px solid var(--line,#e9e1ec);border-radius:13px;background:#fff;padding:11px 12px;color:var(--ink,#514758);font:inherit}
.lr-group-setting-card textarea{min-height:110px;resize:vertical}
.lr-group-setting-card textarea.lr-group-css-editor{min-height:210px;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace}
.lr-group-setting-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.lr-group-setting-actions .btn{flex:1;min-width:112px}
.lr-group-search-results{display:grid;gap:8px;margin-top:10px}
.lr-group-search-hit{width:100%;text-align:left;border:1px solid var(--line,#e9e1ec);border-radius:13px;background:#fff;padding:11px 12px;color:var(--ink,#514758);font:inherit}
.lr-group-search-hit small{display:block;margin-bottom:4px;color:var(--muted,#988a9d);font-size:10px}
.lr-group-search-empty{padding:9px 2px;color:#9b90a2;font-size:12px}
.lr-group-search-highlight .lr-group-message-bubble{outline:2px solid #b99ac7;box-shadow:0 0 0 5px rgba(185,154,199,.16)!important}


/* GROUP CHAT · share the single-chat fullscreen frame and app bar. */
/* One-to-one entries use the same soft card language as the group list. */
#chat:not(.is-conversation) .chat-contact-list{gap:8px!important}
#chat:not(.is-conversation) .chat-contact-card{
 width:100%!important;min-height:70px!important;display:flex!important;align-items:center!important;gap:11px!important;
 padding:12px 10px!important;margin:0!important;box-sizing:border-box!important;
 border:1px solid rgba(181,164,191,.18)!important;border-radius:17px!important;
 background:rgba(255,255,255,.7)!important;color:var(--ink,#554b5d)!important;
 box-shadow:0 5px 16px rgba(70,50,80,.04)!important;text-align:left!important;
}
#chat:not(.is-conversation) .chat-contact-avatar{width:44px!important;height:44px!important;flex:0 0 44px!important;border-radius:15px!important}
#chat:not(.is-conversation) .chat-contact-info{flex:1!important;min-width:0!important;display:grid!important;gap:4px!important}
#chat:not(.is-conversation) .chat-contact-info strong{font-size:13px!important;font-weight:600!important}
#chat:not(.is-conversation) .chat-contact-info span{font-size:11px!important;margin-top:0!important;color:var(--muted,#93869a)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
#chat:not(.is-conversation) .chat-contact-time{align-self:center!important;margin-left:auto!important;font-size:10px!important;color:#9a8da0!important}

.chat-page.is-group-conversation{
 position:fixed!important;z-index:40!important;top:52px!important;right:0!important;bottom:0!important;left:0!important;
 width:100%!important;height:auto!important;min-height:0!important;margin:0!important;
 padding:0 14px calc(8px + env(safe-area-inset-bottom))!important;box-sizing:border-box!important;
 display:flex!important;flex-direction:column!important;overflow:hidden!important;background:var(--bg,#f1eef5)!important;
}
.chat-page.is-group-conversation .chat-page-heading,
.chat-page.is-group-conversation #chatConversation,
.chat-page.is-group-conversation #chatContacts{display:none!important}
.chat-page.is-group-conversation #lrGroupConversation{
 position:relative!important;inset:auto!important;display:flex!important;flex:1 1 auto!important;
 width:100%!important;height:100%!important;min-height:0!important;max-height:100%!important;
 margin:0!important;padding:0!important;box-sizing:border-box!important;overflow:hidden!important;
 flex-direction:column!important;border:0!important;border-radius:0!important;
 background-color:var(--bg,#f1eef5)!important;
}
/* The system app bar already carries the group name, back button and settings action. */
.chat-page.is-group-conversation .lr-group-head{display:none!important}
.chat-page.is-group-conversation .lr-group-announcement{
 flex:none!important;margin:10px 0 2px!important;padding:9px 12px!important;border:1px solid rgba(255,255,255,.8)!important;
 border-radius:15px!important;background:rgba(255,255,255,.62)!important;color:#83768d!important;
}
.chat-page.is-group-conversation .lr-group-messages{
 flex:1 1 auto!important;height:0!important;min-height:0!important;max-height:none!important;
 margin:0!important;padding:18px 3px 16px!important;overflow-y:auto!important;overscroll-behavior:contain!important;
 gap:15px!important;
}
.chat-page.is-group-conversation .lr-group-message-row{align-items:flex-end!important;gap:8px!important;max-width:100%!important;width:100%!important}
.chat-page.is-group-conversation .lr-group-message-row.is-user{justify-content:flex-start!important;flex-direction:row-reverse!important}.chat-page.is-group-conversation .lr-group-message-row.is-user .lr-group-message-content{align-items:flex-end!important;text-align:right!important}.chat-page.is-group-conversation .lr-group-message-row.is-user .lr-group-message-name{text-align:right!important;width:100%!important}
.chat-page.is-group-conversation .lr-group-message-row.is-character{justify-content:flex-start!important}
.chat-page.is-group-conversation .lr-group-message-avatar{width:30px!important;height:30px!important;min-width:30px!important;border-radius:10px!important}
.chat-page.is-group-conversation .lr-group-message-content{max-width:min(82%,430px)!important;gap:4px!important}
.chat-page.is-group-conversation .lr-group-message-bubble{max-width:100%!important;padding:11px 14px!important;border-radius:16px!important;font-size:14px!important;line-height:1.65!important;box-shadow:0 2px 7px rgba(65,48,76,.035)!important}
.chat-page.is-group-conversation .lr-group-message-row.is-character .lr-group-message-bubble{border-top-left-radius:5px!important;background:#fff!important;color:#39333e!important}
.chat-page.is-group-conversation .lr-group-message-row.is-user .lr-group-message-bubble{border-top-right-radius:5px!important;background:var(--lr-accent,#b99fc8)!important;color:#fff!important}
.chat-page.is-group-conversation .lr-group-message-name{font-size:10px!important;color:#988b9f!important;padding:0 4px!important}
.chat-page.is-group-conversation .lr-group-compose{
 flex:none!important;align-items:flex-end!important;gap:8px!important;margin:0!important;padding:8px!important;
 border:1px solid rgba(155,140,166,.18)!important;border-radius:23px!important;
 background:rgba(255,255,255,.88)!important;box-shadow:0 5px 18px rgba(74,57,86,.06)!important;
 backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;
}
.chat-page.is-group-conversation .lr-group-compose textarea{
 min-height:43px!important;max-height:110px!important;resize:none!important;border:0!important;border-radius:14px!important;
 background:transparent!important;box-shadow:none!important;padding:10px 11px!important;font-size:14px!important;outline:none!important;
}
.chat-page.is-group-conversation .lr-group-at,
.chat-page.is-group-conversation .lr-group-send{min-width:42px!important;height:42px!important;border-radius:16px!important}
.chat-page.is-group-conversation #lrGroupConversation{background-color:var(--bg,#f1eef5)!important;background-size:cover!important;background-position:center center!important;background-repeat:no-repeat!important}
.chat-page.is-group-conversation .lr-group-messages{background:transparent!important}
.chat-page.is-group-conversation .lr-group-compose{background:rgba(255,255,255,.82)!important}
.lr-group-ai-call{width:42px;height:42px;min-width:42px;display:grid;place-items:center;border:0;border-radius:16px;background:var(--lr-accent,#b79bc7);color:#fff;font-size:23px;line-height:1;box-shadow:0 5px 14px color-mix(in srgb,var(--lr-accent,#b79bc7) 28%,transparent);transition:transform .16s ease,opacity .16s ease,box-shadow .16s ease}
.lr-group-ai-call:active{transform:scale(.94)}.lr-group-ai-call:disabled{opacity:.5;box-shadow:none}.lr-group-ai-call[aria-busy="true"] span{animation:lrGroupAiPulse 1s ease-in-out infinite}@keyframes lrGroupAiPulse{50%{opacity:.38;transform:scale(.82)}}
.chat-page.is-group-conversation .lr-group-send{min-width:58px!important;padding:0 15px!important;background:var(--lr-accent,#b99fc8)!important}
.chat-page.is-group-conversation .lr-group-hint{flex:none!important;padding:4px 8px 1px!important;background:transparent!important;color:#a99eae!important}
.chat-page.is-group-conversation .lr-group-mention-menu{bottom:72px!important;z-index:15!important}

/* v127: route separation, dock isolation and dedicated group-settings screen. */
#lrGroupList[hidden],
#chat.is-conversation #lrGroupList,
#chat.is-group-conversation #lrGroupList,
#chat.is-group-settings #lrGroupList{display:none!important}
#chat.is-conversation #lrGroupList,
#chat.is-group-conversation #lrGroupList{visibility:hidden!important;pointer-events:none!important}
#chat.is-group-conversation,
#chat.is-group-settings{z-index:110!important}
html.lr-chat-dock-hidden .nav,
body.chat-conversation-open .nav{display:none!important;visibility:hidden!important;pointer-events:none!important}
/* v128 hard guard: group view owns a root-level state that legacy chat rendering cannot reset. */
html[data-lr-group-chat-mode="conversation"] body .nav,
html[data-lr-group-chat-mode="settings"] body .nav{display:none!important;visibility:hidden!important;pointer-events:none!important}
html[data-lr-group-chat-mode="conversation"] body .nav[hidden],
html[data-lr-group-chat-mode="settings"] body .nav[hidden]{display:none!important} 
body.chat-conversation-open{padding-bottom:0!important;overflow:hidden!important}
.chat-page.is-group-conversation{bottom:0!important;padding-bottom:calc(8px + env(safe-area-inset-bottom))!important}
.chat-page.is-group-conversation .lr-group-compose{margin-bottom:calc(5px + env(safe-area-inset-bottom))!important}
.lr-group-settings-page[hidden]{display:none!important}
.lr-group-settings-page{display:none;min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;background:var(--bg,#f1eef5);padding:14px 14px calc(20px + env(safe-area-inset-bottom));}
.chat-page.is-group-settings #lrGroupConversation{display:none!important}
.chat-page.is-group-settings #lrGroupSettingsPage{display:flex!important;flex-direction:column!important;position:relative!important;inset:auto!important;width:100%!important;height:100%!important;max-height:none!important;min-height:0!important;flex:1 1 auto!important;overflow-y:auto!important;box-sizing:border-box!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet{position:relative!important;width:min(100%,680px)!important;max-width:680px!important;min-height:100%!important;max-height:none!important;overflow:visible!important;margin:0 auto!important;padding:20px 18px calc(26px + env(safe-area-inset-bottom))!important;box-sizing:border-box!important;border:1px solid rgba(255,255,255,.88)!important;border-radius:24px!important;background:rgba(255,255,255,.84)!important;box-shadow:0 8px 26px rgba(74,57,86,.055)!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet>.module-head{position:relative!important;display:block!important;margin:0 0 18px!important;padding:2px 0 13px!important;border-bottom:1px solid rgba(155,140,166,.14)!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet>.module-head .eyebrow{font-size:9px!important;letter-spacing:3px!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet>.module-head h2{font-size:25px!important;font-weight:400!important;margin:7px 0 0!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet>label{display:block!important;margin:14px 0 6px!important;font-size:12px!important;color:#93869a!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet input:not([type=checkbox]),
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet textarea,
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet select{width:100%!important;box-sizing:border-box!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet .lr-group-image-fields{grid-template-columns:1fr!important;}
.chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet .lr-group-modal-actions{grid-template-columns:1fr 1fr!important;}
@media(max-width:420px){
 .lr-group-settings-page{padding:12px 10px calc(18px + env(safe-area-inset-bottom))!important}
 .chat-page.is-group-settings #lrGroupSettingsPage>.lr-group-sheet{padding:17px 14px calc(22px + env(safe-area-inset-bottom))!important;border-radius:21px!important}
}

body.chat-conversation-open .nav{display:none!important}
body.chat-conversation-open{padding-bottom:0!important;overflow:hidden!important}
@media(max-width:420px){
 .chat-page.is-group-conversation{padding-left:14px!important;padding-right:14px!important}
 .chat-page.is-group-conversation .lr-group-message-bubble{font-size:13px!important}
}
`;st.textContent += `
.lr-group-time-divider{display:flex;align-items:center;justify-content:center;gap:10px;margin:13px 0;color:#9b8fa3;font-size:10px;letter-spacing:.04em}.lr-group-time-divider:before,.lr-group-time-divider:after{content:'';height:1px;flex:1;max-width:72px;background:rgba(140,130,145,.2)}.lr-group-time-divider span{padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.64);border:1px solid rgba(255,255,255,.8)}
.lr-group-message-arrive{animation:lrGroupMessageArrive .34s cubic-bezier(.2,.75,.25,1) both}@keyframes lrGroupMessageArrive{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
.lr-group-quoted-message{display:grid;gap:3px;margin:0 0 6px;padding:7px 9px;border-left:2px solid rgba(166,139,180,.6);border-radius:0 9px 9px 0;background:rgba(236,228,241,.42);color:#8b7b92;font-size:10px;line-height:1.45;max-width:100%}.lr-group-quoted-message strong{font-weight:600}.lr-group-quoted-message span{overflow-wrap:anywhere;opacity:.9}
.lr-group-message-row.is-selected,.lr-group-system-message.is-selected{outline:2px solid rgba(164,132,183,.75);outline-offset:3px;border-radius:13px;background:rgba(188,160,205,.13)}
.lr-group-message-action-menu{position:fixed;z-index:2147483000;min-width:150px;display:grid;gap:2px;padding:7px;border:1px solid rgba(169,151,179,.24);border-radius:15px;background:rgba(255,255,255,.97);box-shadow:0 12px 32px rgba(58,43,67,.18);backdrop-filter:blur(16px)}.lr-group-message-action-menu[hidden]{display:none!important}.lr-group-message-action-menu button{border:0;border-radius:9px;background:transparent;padding:10px 12px;text-align:left;color:#5b4e62;font:inherit;font-size:12px}.lr-group-message-action-menu button:active{background:#f1eaf4}.lr-group-message-action-menu button.danger{color:#a76f78}
.lr-group-message-toolbar{display:flex;align-items:center;gap:7px;padding:8px 12px;background:rgba(255,255,255,.92);border-top:1px solid rgba(150,130,160,.1);color:#887b90;font-size:11px}.lr-group-message-toolbar[hidden]{display:none!important}.lr-group-message-toolbar>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lr-group-message-toolbar button{border:1px solid rgba(169,151,179,.24);border-radius:99px;background:#fff;padding:6px 10px;color:#766680;font:inherit;font-size:10px;white-space:nowrap}.lr-group-message-toolbar button:disabled{opacity:.4}.lr-group-quote-preview b{font-weight:600}.lr-group-transfer-card.is-actionable{cursor:pointer}.lr-group-transfer-card .lr-group-transfer-state{display:inline-flex;margin-top:11px;padding-top:8px;border-top:1px solid rgba(255,255,255,.25);font-size:10px;opacity:.9}
#lrGroupMessages [data-group-message-id]{-webkit-user-select:none;user-select:none;touch-action:pan-y}
`;document.head.appendChild(st)}
function groupTranscript(messages,limit=60){return messages.slice(-limit).map(m=>`[消息时间：${exactGroupDateTime(m.createdAt)}] ${m.senderType==='user'?'我':m.senderType==='system'?'系统':(m.senderNameSnapshot||getName(m.senderId))}：${m.text||({image:'[图片]',sticker:'[表情包]',transfer:'[转账卡]',location:'[位置分享]',order:'[订单]'}[m.kind]||'')}`).join('\n')}
async function appendExternalGroupMessage(payload,groupId=activeGroupId){
 const id=String(groupId||'');if(!id)throw new Error('没有指定目标群聊');const group=await getOne(STORE_GROUPS,id);if(!group)throw new Error('目标群聊不存在');
 const data={...(payload||{})};const senderType=data.senderType==='character'?'character':'user';const message={id:makeId('msg'),groupId:id,senderType,senderId:String(data.senderId||(senderType==='user'?'user':'')),senderNameSnapshot:String(data.senderNameSnapshot||(senderType==='user'?'我':'角色')),createdAt:nextMessageTimestamp(group),...data};
 message.id=makeId('msg');message.groupId=id;message.createdAt=nextMessageTimestamp(group);delete message.role;
 await saveMessage(message);group.lastMessage={text:String(message.text||({image:'[图片]',sticker:'[表情包]',transfer:'转账卡',location:'位置分享',order:'订单'}[message.kind]||'新消息')),senderName:message.senderNameSnapshot,createdAt:message.createdAt};await saveGroup(group);
 if(activeGroupId===id&&!settingsOpen)await renderGroupConversation();else await renderGroupList();return message;
}
function ensureGroupCharacterToolModal(){let modal=$('lrGroupCharacterToolModal');if(modal)return modal;modal=document.createElement('div');modal.id='lrGroupCharacterToolModal';modal.className='lr-action-overlay';modal.hidden=true;modal.innerHTML='<section class="lr-action-sheet"><div class="lr-action-kicker">GROUP CHARACTER TOOLS</div><div class="lr-action-title" id="lrGroupCharacterToolTitle">选择角色</div><div class="lr-action-desc" id="lrGroupCharacterToolDesc">选择一位群成员继续。</div><div id="lrGroupCharacterToolMembers" class="lr-group-tool-members"></div><div class="lr-action-buttons"><button type="button" id="lrGroupCharacterToolCancel">取消</button></div></section>';document.body.appendChild(modal);$('lrGroupCharacterToolCancel').onclick=()=>modal.hidden=true;modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});$('lrGroupCharacterToolMembers').addEventListener('click',async e=>{const btn=e.target.closest('[data-group-tool-contact]');if(!btn)return;const id=btn.dataset.groupToolContact,mode=groupToolMode;modal.hidden=true;const bridge=window.LRChatInteractionV11;if(!bridge){notify('聊天功能模块尚未就绪，请刷新后重试');return}if(mode==='schedule'){bridge.openScheduleFor(id);return}const group=await getOne(STORE_GROUPS,activeGroupId);const messages=group?await listMessages(group.id):[];const context=group?`群聊名称：${group.name}\n群聊公告：${group.announcement||'无'}\n最近群聊内容：\n${groupTranscript(messages,24)}`:'';bridge.openInnerThoughtFor(id,context)});return modal}
async function openGroupCharacterTool(mode){if(!activeGroupId)return;groupToolMode=mode;const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;const modal=ensureGroupCharacterToolModal(),members=groupActiveMembers(group),title=$('lrGroupCharacterToolTitle'),desc=$('lrGroupCharacterToolDesc'),box=$('lrGroupCharacterToolMembers');title.textContent=mode==='schedule'?'选择要查看行程的角色':'选择要读取心声的角色';desc.textContent=mode==='schedule'?'行程仍保存在该角色自己的联系人资料中。':'AI 会结合该角色人设、个人记忆和当前群聊内容生成心声。';box.innerHTML=members.map(m=>`<button type="button" class="lr-group-tool-member" data-group-tool-contact="${esc(m.contactId)}"><span class="lr-group-tool-avatar">${esc((m.name||getName(m.contactId)).slice(0,1))}</span><span><b>${esc(m.name||getName(m.contactId))}</b><small>${esc(m.role||'群成员')}</small></span><span class="lr-group-tool-arrow">›</span></button>`).join('')||'<div class="lr-group-search-empty">没有可用成员。</div>';modal.hidden=false}
function ensureGroupDiaryModal(){let modal=$('lrGroupDiaryModal');if(modal)return modal;modal=document.createElement('div');modal.id='lrGroupDiaryModal';modal.className='lr-action-overlay';modal.hidden=true;modal.innerHTML='<section class="lr-action-sheet lr-group-diary-sheet"><div class="lr-action-kicker">LOVE RECORD · GROUP DIARY</div><div class="lr-action-title">群聊日记</div><div class="lr-action-desc">可以记录这次群聊，也可以让 AI 根据实际聊天内容整理一篇日记。</div><label for="lrGroupDiaryAuthor">日记视角</label><select id="lrGroupDiaryAuthor"></select><label for="lrGroupDiaryTitle">标题</label><input id="lrGroupDiaryTitle" maxlength="120" placeholder="今天想记住什么？"><label for="lrGroupDiaryMood">心情（选填）</label><input id="lrGroupDiaryMood" maxlength="80" placeholder="开心、平静、热闹……"><label for="lrGroupDiaryContent">日记内容</label><textarea id="lrGroupDiaryContent" rows="7" placeholder="写下群聊里值得留存的片段……"></textarea><div class="lr-action-buttons"><button type="button" id="lrGroupDiaryGenerate">AI 帮我整理</button><button type="button" id="lrGroupDiarySave" class="primary">保存日记</button></div><div class="lr-action-buttons"><button type="button" id="lrGroupDiaryOpenBook">打开日记本</button><button type="button" id="lrGroupDiaryClose">关闭</button></div><div class="lr-group-diary-status" id="lrGroupDiaryStatus" role="status"></div></section>';document.body.appendChild(modal);$('lrGroupDiaryClose').onclick=()=>modal.hidden=true;modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});$('lrGroupDiaryOpenBook').onclick=()=>{modal.hidden=true;window.LRDiaryGroupAPI?.open?.()};$('lrGroupDiaryGenerate').onclick=generateGroupDiary;$('lrGroupDiarySave').onclick=saveGroupDiary;return modal}
async function openGroupDiary(){if(!activeGroupId)return;const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;const modal=ensureGroupDiaryModal(),members=groupActiveMembers(group);$('lrGroupDiaryAuthor').innerHTML='<option value="user">以我的视角</option>'+members.map(m=>`<option value="${esc(m.contactId)}">以 ${esc(m.name||getName(m.contactId))} 的视角</option>`).join('');$('lrGroupDiaryTitle').value=group.name+' · 群聊记录';$('lrGroupDiaryMood').value='';$('lrGroupDiaryContent').value='';$('lrGroupDiaryStatus').textContent='日记将保存在 LOVE RECORD 日记本，并标记来源群聊。';modal.hidden=false}
async function generateGroupDiary(){const id=activeGroupId;if(!id)return;const group=await getOne(STORE_GROUPS,id);if(!group)return;const api=host().getApiConfig?.()||{};if(!api.apiBase||!api.apiKey||!api.apiModel){$('lrGroupDiaryStatus').textContent='请先在 LOVE RECORD 设置中连接 AI API。';return}const authorId=$('lrGroupDiaryAuthor').value,person=authorId==='user'?null:getPerson(authorId),messages=await listMessages(id),transcript=groupTranscript(messages,80);if(!transcript.trim()){$('lrGroupDiaryStatus').textContent='群聊还没有可整理的内容。';return}const btn=$('lrGroupDiaryGenerate');btn.disabled=true;btn.textContent='正在整理…';$('lrGroupDiaryStatus').textContent='正在根据群聊记录生成日记…';try{const system=person?`你是角色日记写作者。请严格依据群聊记录、角色人设和角色知道的信息，以「${person.name}」第一人称写日记。不得替用户编造内心、台词或行动，不得添加未发生事实。只输出 JSON：{"title":"标题","mood":"心情短语","content":"日记正文"}。`:'你是私人日记助手。根据群聊记录，以用户第一人称写日记，只记录聊天中有依据的重要经历，不替用户捏造感受、行动或事实。只输出 JSON：{"title":"标题","mood":"心情短语","content":"日记正文"}。';const profile=person?`角色：${person.name}\n身份：${person.role||''}\n性格：${person.personality||''}\n背景：${person.background||''}\n角色规则：${person.instructions||''}`:'';const prompt=`群聊名称：${group.name}\n群公告：${group.announcement||'无'}\n${profile}\n聊天记录（按时间顺序）：\n${transcript}\n请写一篇约 180–450 字的日记。不要逐条复述聊天，重点是值得留存的片段。只返回 JSON。`;const response=await fetchWithTimeout(api.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+api.apiKey,'Accept':'application/json'},body:JSON.stringify({model:api.apiModel,messages:[{role:'system',content:system},{role:'user',content:prompt}],stream:false})},45000);const raw=await response.text();if(!response.ok)throw new Error('HTTP '+response.status+' · '+raw.slice(0,180));const parsed=parseModelJson(extractAIText(JSON.parse(raw)));if(!parsed||!String(parsed.content||'').trim())throw new Error('AI 没有返回有效日记');$('lrGroupDiaryTitle').value=String(parsed.title||'群聊日记');$('lrGroupDiaryMood').value=String(parsed.mood||'');$('lrGroupDiaryContent').value=String(parsed.content||'');$('lrGroupDiaryStatus').textContent='已生成草稿，请检查后点击「保存日记」。'}catch(err){$('lrGroupDiaryStatus').textContent='生成失败：'+err.message}finally{btn.disabled=false;btn.textContent='AI 帮我整理'}}
async function saveGroupDiary(){const id=activeGroupId;if(!id)return;const group=await getOne(STORE_GROUPS,id);if(!group)return;const title=String($('lrGroupDiaryTitle').value||'').trim()||'群聊日记',content=String($('lrGroupDiaryContent').value||'').trim(),mood=String($('lrGroupDiaryMood').value||'').trim(),authorId=$('lrGroupDiaryAuthor').value,person=authorId==='user'?null:getPerson(authorId);if(!content){notify('先写一点日记内容，或让 AI 帮你整理');return}if(!window.LRDiaryGroupAPI?.addEntry){notify('日记模块尚未就绪，请刷新后重试');return}try{await window.LRDiaryGroupAPI.addEntry({authorType:person?'ai':'user',authorName:person?.name||'我',contactId:person?String(person.id):'',contactName:person?.name||'',groupId:String(group.id),groupName:String(group.name||'群聊'),title,mood,content,source:'group-chat-diary'});$('lrGroupDiaryStatus').textContent='已保存到日记本 ♡';notify('群聊日记已保存 ♡')}catch(err){$('lrGroupDiaryStatus').textContent='保存失败：'+err.message;notify('群聊日记保存失败：'+err.message)}}
async function openGroupMarket(){const id=activeGroupId;if(!id)return;const group=await getOne(STORE_GROUPS,id);if(!group)return;const context={groupId:String(group.id),groupName:String(group.name||'群聊'),kind:'food',at:Date.now()};try{sessionStorage.setItem('lr-life-active-group',String(group.id));sessionStorage.removeItem('lr-life-active-contact')}catch(e){console.warn('[LOVE RECORD] group market session context unavailable',e)}try{localStorage.setItem('lr-life-chat-context-v1',JSON.stringify(context))}catch(e){console.warn('[LOVE RECORD] group market context unavailable',e)}if(window.LoveRecordLifeApps&&typeof window.LoveRecordLifeApps.open==='function'){try{await window.LoveRecordLifeApps.open('food')}catch(err){notify('生活集市打开失败：'+(err.message||'请稍后重试'))}}else notify('生活集市模块尚未加载，请刷新页面后再试')}
function handleGroupAction(action){const bridge=window.LRChatInteractionV11;if(action==='image'){$('lrGroupImageInput')?.click();return}if(action==='sticker'){if(!bridge?.openStickerPickerForGroup){notify('表情包功能尚未就绪，请稍后重试');return}bridge.openStickerPickerForGroup(message=>appendExternalGroupMessage({...message,senderType:'user',senderId:'user',senderNameSnapshot:'我'}));return}if(action==='transfer'){if(!bridge?.openTransferForGroup){notify('转账功能尚未就绪');return}bridge.openTransferForGroup(message=>appendExternalGroupMessage({...message,senderType:'user',senderId:'user',senderNameSnapshot:'我'}));return}if(action==='location'){if(!bridge?.openLocationForGroup){notify('位置分享功能尚未就绪');return}bridge.openLocationForGroup(message=>appendExternalGroupMessage({...message,senderType:'user',senderId:'user',senderNameSnapshot:'我'}));return}if(action==='schedule'||action==='thought'){openGroupCharacterTool(action);return}if(action==='journal'){openGroupDiary();return}if(action==='market'){openGroupMarket();return}}
function bindGroupActionMenu(){const plus=$('lrGroupPlus'),menu=$('lrGroupPlusMenu');if(!plus||!menu)return;plus.addEventListener('click',e=>{e.stopPropagation();menu.hidden=!menu.hidden;plus.textContent=menu.hidden?'＋':'×'});menu.addEventListener('click',e=>{const btn=e.target.closest('[data-lr-group-action]');if(!btn)return;const action=btn.dataset.lrGroupAction;menu.hidden=true;plus.textContent='＋';handleGroupAction(action)});document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&e.target!==plus){menu.hidden=true;plus.textContent='＋'}});$('lrGroupImageInput')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const bridge=window.LRChatInteractionV11;if(!bridge?.saveAttachment)throw new Error('图片储存模块尚未就绪');const attachmentId=await bridge.saveAttachment(file);await appendExternalGroupMessage({kind:'image',attachmentId,text:'[图片]',senderType:'user',senderId:'user',senderNameSnapshot:'我'});if($('lrGroupHint'))$('lrGroupHint').textContent='图片已发送 · 点击 ✦ 让群成员查看并回应';notify('图片已发送')}catch(err){notify('图片发送失败：'+err.message)}finally{e.target.value=''}})}

function bind(){
 bindGroupActionMenu();
 bindGroupMessageInteractions();
 bindGroupAdvancedSettings();
 $('lrOpenCreateGroup')?.addEventListener('click',()=>{const modal=$('chatAddModal');modal?.classList.remove('show');document.body.style.overflow='';openCreateGroup()});
 $('lrCreateGroupClose')?.addEventListener('click',closeCreateGroup);$('lrCreateGroupCancel')?.addEventListener('click',closeCreateGroup);$('lrCreateGroupConfirm')?.addEventListener('click',createGroup);
 $('lrCreateGroupModal')?.addEventListener('click',e=>{if(e.target.id==='lrCreateGroupModal')closeCreateGroup()});
$('lrGroupSaveSettings')?.addEventListener('click',saveGroupSettings);$('lrGroupDissolve')?.addEventListener('click',dissolveGroup);$('lrGroupExport')?.addEventListener('click',exportGroup);$('lrGroupHeaderSettings')?.addEventListener('click',openGroupSettings);$('lrGroupChooseAvatar')?.addEventListener('click',()=>$('lrGroupAvatarFile')?.click());$('lrGroupAvatarFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{groupAvatarDraft=await compressGroupImage(file,640,.84);renderGroupImagePreview('lrGroupAvatarPreview',groupAvatarDraft,'群');}catch(err){notify('群头像处理失败：'+err.message)}finally{e.target.value=''}});$('lrGroupClearAvatar')?.addEventListener('click',()=>{groupAvatarDraft='';renderGroupImagePreview('lrGroupAvatarPreview','','群')});$('lrGroupChooseBackgroundImage')?.addEventListener('click',()=>$('lrGroupBackgroundFile')?.click());$('lrGroupBackgroundFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{groupBackgroundDraft=await compressGroupImage(file,1440,.8);renderGroupImagePreview('lrGroupBackgroundPreview',groupBackgroundDraft,'未设置背景图片');}catch(err){notify('群聊背景处理失败：'+err.message)}finally{e.target.value=''}});$('lrGroupClearBackgroundImage')?.addEventListener('click',()=>{groupBackgroundDraft='';renderGroupImagePreview('lrGroupBackgroundPreview','','未设置背景图片')});

 $('lrGroupMention')?.addEventListener('click',openMentionMenu);$('lrGroupMentionMenu')?.addEventListener('click',e=>{const b=e.target.closest('[data-lr-mention]');if(b)insertMention(b.dataset.lrMention)});
 $('lrGroupSend')?.addEventListener('click',sendGroupMessage);$('lrGroupInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendGroupMessage()}});
 $('lrGroupAiCall')?.addEventListener('click',invokeGroupAI);
 $('lrGroupManageMembers')?.addEventListener('click',e=>{const b=e.target.closest('[data-lr-group-remove]');if(!b)return;const row=b.closest('.lr-group-member-row');if(!row)return;const willRemove=row.dataset.willRemove==='1';row.dataset.willRemove=willRemove?'0':'1';row.classList.toggle('will-remove',!willRemove);const note=row.querySelector('[data-lr-member-note]');if(note){if(willRemove){const groupMemberRole=row.dataset.memberRole||'群成员';note.textContent=groupMemberRole}else{row.dataset.memberRole=note.textContent;note.textContent='保存后将从群聊移除'}}b.textContent=willRemove?'移除':'撤销'});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-lr-group-open]');if(b){e.preventDefault();openGroup(b.dataset.lrGroupOpen)}});
 const back=document.querySelector('#systemAppbar .system-back');if(back)back.addEventListener('click',e=>{if(!activeGroupId)return;e.preventDefault();e.stopImmediatePropagation();if(settingsOpen)closeGroupSettings();else backToList()},{capture:true});
 $('systemAppbarAction')?.addEventListener('click',e=>{if(!activeGroupId||settingsOpen)return;e.preventDefault();e.stopImmediatePropagation();openGroupSettings()},{capture:true});
 document.addEventListener('lr-contacts-updated',()=>{renderGroupList();if(activeGroupId)renderGroupConversation()});
}
// Keep the existing private-chat render and message engine intact. Group mode only intercepts the active view.
function patchRender(){if(typeof window.renderChat!=='function'||window.renderChat.__lrGroupWrapped)return;const base=window.renderChat;const wrapped=function(){if(activeGroupId){const list=$('lrGroupList');if(list){list.hidden=true;list.setAttribute('aria-hidden','true')}renderGroupConversation().catch(e=>console.error('[LOVE RECORD] group render failed',e));return}const out=base.apply(this,arguments);const list=$('lrGroupList'),privateConversation=$('chatConversation'),chatRoot=$('chat'),groupConv=$('lrGroupConversation');const oneToOneOpen=!!(privateConversation&&!privateConversation.hidden)||!!chatRoot?.classList.contains('is-conversation');if(list&&oneToOneOpen){list.hidden=true;list.setAttribute('aria-hidden','true')}else if(list)renderGroupList();if(groupConv)groupConv.hidden=true;return out};wrapped.__lrGroupWrapped=true;window.renderChat=wrapped;}
window.LRGroupChatActions={appendMessage:appendExternalGroupMessage,getActiveGroupId:()=>activeGroupId,getGroup:groupId=>getOne(STORE_GROUPS,String(groupId||activeGroupId))};
async function recoverInterruptedTurns(){const turns=await getAll(STORE_TURNS);for(const turn of turns){if(turn.status==='generating'){turn.status='interrupted';turn.interruptedAt=Date.now();turn.error='页面在本轮生成完成前关闭；为防止重复回复，未自动重试。';await saveTurn(turn)}}}
async function init(){installStyles();bind();try{await openDB();await window.__lrChatStorageReady?.catch?.(()=>{});await window.__lrChatContactsReady?.catch?.(()=>{});await recoverInterruptedTurns();patchRender();await renderGroupList();}catch(err){console.error('[LOVE RECORD] group chat initialization failed',err);notify('群聊模块初始化失败：'+err.message)}
 // Re-wrap if another late-loaded extension replaces renderChat.
 setTimeout(patchRender,500);setTimeout(patchRender,1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
