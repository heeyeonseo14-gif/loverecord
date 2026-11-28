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
let dbPromise=null,activeGroupId='',busy=false,sending=false,settingsOpen=false,settingsGroupId='',groupAvatarDraft='',groupBackgroundDraft='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const makeId=prefix=>prefix+'_'+(crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10));
const getPerson=id=>host().getPerson?.(String(id))||null;
const getName=id=>host().contactName?.(String(id))||getPerson(id)?.name||'已删除联系人';
const notify=msg=>host().toast?.(msg);
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
function nextMessageTimestamp(group){return Math.max(Date.now(),(Number(group?.lastMessage?.createdAt)||0)+1)}
function snapshotMember(person){const meta=host().getChatMeta?.(person.id)||{};return {contactId:String(person.id),name:String(person.name||'未命名联系人'),role:String(person.role||''),avatar:String(meta.avatar||''),status:'active',joinedAt:Date.now(),removedAt:null}}
function groupActiveMembers(group){return (group.members||[]).filter(m=>m.status==='active'&&getPerson(m.contactId))}
async function syncUnavailableMembers(group){let changed=false;for(const m of group.members||[]){if(m.status==='active'&&!getPerson(m.contactId)){m.status='unavailable';m.unavailableAt=Date.now();changed=true}}if(changed)await saveGroup(group);return changed}
function groupAvatar(group){if(group.avatar)return `<img src="${esc(group.avatar)}" alt="">`;const text=String(group.name||'群').trim().slice(0,2)||'群';return esc(text)}
function messageAvatar(message,group){if(message.senderType==='user')return '我';const member=(group.members||[]).find(m=>m.contactId===message.senderId);const person=getPerson(message.senderId);const meta=host().getChatMeta?.(message.senderId)||{};const avatar=meta.avatar||member?.avatar||'';if(avatar)return `<img src="${esc(avatar)}" alt="${esc(message.senderNameSnapshot||person?.name||'角色')}">`;return esc((message.senderNameSnapshot||person?.name||member?.name||'♡').slice(0,1))}
function timeLabel(at){if(!at)return '';const d=new Date(at),now=new Date();if(d.toDateString()===now.toDateString())return d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});return d.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}
function safeMessageText(text){return esc(text).replace(/\r\n?/g,'\n').replace(/\n/g,'<br>')}
function ensureGroupList(){const chat=$('chat'),contacts=$('chatContacts');if(!chat||!contacts)return null;let list=$('lrGroupList');if(!list){list=document.createElement('section');list.id='lrGroupList';list.className='lr-group-list';contacts.parentNode.insertBefore(list,contacts)}return list}
async function renderGroupList(){const list=ensureGroupList();if(!list)return;try{const groups=await listGroups();for(const group of groups)await syncUnavailableMembers(group);const privateConversation=$('chatConversation'),chatRoot=$('chat');const oneToOneOpen=!!(privateConversation&&!privateConversation.hidden)||!!chatRoot?.classList.contains('is-conversation');if(activeGroupId||settingsOpen||oneToOneOpen){list.hidden=true;list.setAttribute('aria-hidden','true');return}list.hidden=!groups.length;list.setAttribute('aria-hidden',groups.length?'false':'true');list.innerHTML=groups.length?'<div class="lr-group-list-head"><span>GROUP CHATS</span><small>'+groups.length+' 个群聊</small></div>'+groups.map(g=>{
 const messagesCache=g.lastMessage||{};const preview=messagesCache.text||'群聊已创建，来打个招呼吧。';const sender=messagesCache.senderName?messagesCache.senderName+'：':'';
 return `<button class="lr-group-list-item" type="button" data-lr-group-open="${esc(g.id)}"><span class="lr-group-list-avatar">${groupAvatar(g)}</span><span class="lr-group-list-copy"><strong>${esc(g.name||'未命名群聊')}</strong><small>${esc(sender+preview)}</small></span><span class="lr-group-list-meta"><small>${esc(timeLabel(messagesCache.createdAt||g.updatedAt))}</small><b>${(g.members||[]).filter(m=>m.status==='active'&&getPerson(m.contactId)).length} 人</b></span></button>`}).join(''):'';
 }catch(err){console.warn('[LOVE RECORD] group list render failed',err)}}
function setChatTopBar(group){const bar=$('systemAppbar'),title=$('systemAppTitle'),action=$('systemAppbarAction'),back=bar?.querySelector('.system-back');bar?.classList.add('show');if(title)title.textContent=settingsOpen?'群聊设置':(group.name||'群聊');if(action){action.hidden=!!settingsOpen;action.textContent='⚙';action.setAttribute('aria-label','群聊设置')}if(back)back.removeAttribute('data-launch-home')}
function renderGroupMessages(messages,group){const box=$('lrGroupMessages');if(!box)return;box.style.backgroundColor=group.background||'#f7f3f9';box.innerHTML=messages.length?messages.map(m=>{
 if(m.senderType==='system')return `<div class="lr-group-system-message"><span>${esc(m.text||'')}</span></div>`;
 const isUser=m.senderType==='user';const name=isUser?'我':(m.senderNameSnapshot||getName(m.senderId));
 return `<article class="lr-group-message-row ${isUser?'is-user':'is-character'}"><div class="lr-group-message-avatar">${messageAvatar(m,group)}</div><div class="lr-group-message-content"><div class="lr-group-message-name">${esc(name)} <time>${esc(timeLabel(m.createdAt))}</time></div><div class="lr-group-message-bubble">${safeMessageText(m.text||'')}</div></div></article>`;
 }).join(''):'<div class="lr-group-empty">群聊还没有消息。<br>说点什么，让大家认识一下吧 ♡</div>';
 box.scrollTop=box.scrollHeight;
}
async function renderGroupConversation(){if(!activeGroupId)return;const group=await getOne(STORE_GROUPS,activeGroupId);if(!group){activeGroupId='';window.renderChat?.();return}await syncUnavailableMembers(group);
 const chat=$('chat'),list=$('chatContacts'),baseConv=$('chatConversation'),conv=$('lrGroupConversation'),settingsPage=$('lrGroupSettingsPage');if(!conv)return;
 if(chat)chat.classList.add('is-conversation','is-group-conversation');document.body.classList.add('chat-conversation-open');document.documentElement.classList.add('lr-chat-dock-hidden');const dock=document.querySelector('.nav');if(dock){dock.style.setProperty('display','none','important');dock.style.setProperty('visibility','hidden','important')}
 if(list)list.hidden=true;if(baseConv)baseConv.hidden=true;const gl=$('lrGroupList');if(gl){gl.hidden=true;gl.setAttribute('aria-hidden','true')}
 setChatTopBar(group);if(settingsOpen){conv.hidden=true;if(settingsPage)settingsPage.hidden=false;if(chat)chat.classList.add('is-group-settings');setChatTopBar(group);return}else{if(settingsPage)settingsPage.hidden=true;if(chat)chat.classList.remove('is-group-settings');conv.hidden=false}
 const avatar=$('lrGroupHeaderAvatar');if(avatar)avatar.innerHTML=group.avatar?`<img src="${esc(group.avatar)}" alt="">`:esc((group.name||'群').slice(0,2));
 $('lrGroupHeaderName').textContent=group.name||'未命名群聊';$('lrGroupHeaderMembers').textContent=groupActiveMembers(group).length+' 位成员';
 const ann=$('lrGroupAnnouncement');ann.textContent=group.announcement||'';ann.hidden=!group.announcement;
 const msgs=await listMessages(activeGroupId);renderGroupMessages(msgs,group);const messageBox=$('lrGroupMessages');if(messageBox){messageBox.style.backgroundColor=group.background||'#f7f3f9';messageBox.style.backgroundImage=group.backgroundImage?`linear-gradient(rgba(247,243,249,.76),rgba(247,243,249,.76)),url("${group.backgroundImage}")`:'none'}const turns=(await getAll(STORE_TURNS)).filter(t=>t.groupId===activeGroupId).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));const latestTurn=turns[0];
 $('lrGroupHint').textContent=busy?'角色正在群聊中…':latestTurn?.status==='interrupted'?'上一轮因页面关闭而中断；可以继续发送新消息。':'自然群聊 · 角色会根据语境自主参与';
}
function openGroup(groupId){activeGroupId=String(groupId);settingsOpen=false;host().setActiveChatContact?.('');const chat=$('chat'),list=$('lrGroupList'),conv=$('chatConversation'),dock=document.querySelector('.nav');if(chat)chat.classList.add('is-conversation','is-group-conversation');if(list){list.hidden=true;list.setAttribute('aria-hidden','true')}if(conv)conv.hidden=true;document.body.classList.add('chat-conversation-open');document.documentElement.classList.add('lr-chat-dock-hidden');if(dock){dock.style.setProperty('display','none','important');dock.style.setProperty('visibility','hidden','important')}renderGroupConversation().catch(e=>{console.error(e);notify('打开群聊失败：'+e.message)})}
function backToList(){settingsOpen=false;activeGroupId='';host().setActiveChatContact?.('');const conv=$('lrGroupConversation'),settingsPage=$('lrGroupSettingsPage'),chat=$('chat');if(conv)conv.hidden=true;if(settingsPage)settingsPage.hidden=true;if(chat)chat.classList.remove('is-conversation','is-group-conversation','is-group-settings');document.body.classList.remove('chat-conversation-open');document.documentElement.classList.remove('lr-chat-dock-hidden');const dock=document.querySelector('.nav');if(dock){dock.style.removeProperty('display');dock.style.removeProperty('visibility');dock.style.removeProperty('pointer-events')}const title=$('systemAppTitle'),action=$('systemAppbarAction'),back=$('systemAppbar')?.querySelector('.system-back');if(title)title.textContent='CHAT';if(action){action.hidden=false;action.textContent='＋';action.setAttribute('aria-label','添加联系人')}if(back)back.setAttribute('data-launch-home','');window.renderChat?.()}
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
 const group={id:makeId('group'),name,avatar:'',background:'#f7f3f9',backgroundImage:'',announcement:'',ownerId:'user',members:people.map(snapshotMember),maxAiMessagesPerTurn:4,naturalMode:true,allowCharacterReplies:true,createdAt:Date.now(),updatedAt:Date.now(),status:'active',lastMessage:null};
 try{const welcome={id:makeId('msg'),groupId:group.id,senderType:'system',text:'群聊已创建。你可以开始聊天啦。',createdAt:nextMessageTimestamp(group)};group.lastMessage={text:welcome.text,senderName:'系统',createdAt:welcome.createdAt};await saveGroup(group);await saveMessage(welcome);closeCreateGroup();if($('chatAddModal')?.classList.contains('show'))$('chatAddModal').classList.remove('show');document.body.style.overflow='';await renderGroupList();openGroup(group.id);notify('群聊创建成功 ♡')}catch(err){console.error('[LOVE RECORD] group create failed',err);notify('创建群聊失败：'+err.message)}
}
function renderGroupImagePreview(id,value,emptyText){const box=$(id);if(!box)return;box.replaceChildren();if(value){const img=document.createElement('img');img.src=value;img.alt='群聊图片预览';box.appendChild(img)}else box.textContent=emptyText||'未设置';box.hidden=false}
async function compressGroupImage(file,maxSize=1200,quality=.82){if(!file||!String(file.type||'').startsWith('image/'))throw new Error('请选择图片文件');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('图片读取失败'));r.readAsDataURL(file)});const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('图片解码失败'));i.src=data});const scale=Math.min(1,maxSize/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法处理图片');ctx.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',quality)}
async function openGroupSettings(){if(!activeGroupId)return;const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;settingsGroupId=group.id;
 $('lrGroupEditName').value=group.name||'';$('lrGroupEditAnnouncement').value=group.announcement||'';$('lrGroupReplyLimit').value=String(group.maxAiMessagesPerTurn||4);$('lrGroupBackground').value=group.background||'#f7f3f9';groupAvatarDraft=group.avatar||'';groupBackgroundDraft=group.backgroundImage||'';renderGroupImagePreview('lrGroupAvatarPreview',groupAvatarDraft,'群');renderGroupImagePreview('lrGroupBackgroundPreview',groupBackgroundDraft,'未设置背景图片');
 renderManageMembers(group);renderAddMembers(group);settingsOpen=true;const chat=$('chat'),conv=$('lrGroupConversation'),page=$('lrGroupSettingsPage');if(chat)chat.classList.add('is-group-settings');if(conv)conv.hidden=true;if(page){page.hidden=false;page.setAttribute('aria-hidden','false')}document.body.classList.add('chat-conversation-open');document.documentElement.classList.add('lr-chat-dock-hidden');const dock=document.querySelector('.nav');if(dock){dock.style.setProperty('display','none','important');dock.style.setProperty('visibility','hidden','important')}setChatTopBar(group);}
function closeGroupSettings(){settingsOpen=false;const page=$('lrGroupSettingsPage'),chat=$('chat'),conv=$('lrGroupConversation');if(page){page.hidden=true;page.setAttribute('aria-hidden','true')}if(chat)chat.classList.remove('is-group-settings');if(conv&&activeGroupId)conv.hidden=false;document.body.classList.add('chat-conversation-open');document.documentElement.classList.add('lr-chat-dock-hidden');if(activeGroupId){setChatTopBar({name:$('lrGroupHeaderName')?.textContent||'群聊'})}else{document.body.classList.remove('chat-conversation-open');document.documentElement.classList.remove('lr-chat-dock-hidden')}}
function renderManageMembers(group){const box=$('lrGroupManageMembers');if(!box)return;box.innerHTML=(group.members||[]).map(m=>{const p=getPerson(m.contactId),missing=!p||m.status==='unavailable',removed=m.status==='removed';const name=p?.name||m.name||'已删除联系人';return `<div class="lr-group-member-row" data-lr-group-contact="${esc(m.contactId)}"><span class="lr-group-member-avatar">${esc(name.slice(0,1))}</span><span class="lr-group-member-info"><b>${esc(name)}</b><small data-lr-member-note>${missing?'联系人已删除，保留历史':removed?'已从群聊移除':esc(p?.role||m.role||'群成员')}</small></span>${!missing&&!removed?`<button type="button" class="lr-group-member-remove" data-lr-group-remove="${esc(m.contactId)}">移除</button>`:''}</div>`}).join('')||'<div class="lr-group-empty-picker">暂无群成员</div>';const count=$('lrGroupMemberCount');if(count)count.textContent=groupActiveMembers(group).length+' 位成员'}
function renderAddMembers(group){const box=$('lrGroupAddMembers');if(!box)return;const active=new Set((group.members||[]).filter(m=>m.status==='active').map(m=>String(m.contactId)));const people=(host().getPeople?.()||[]).filter(p=>!active.has(String(p.id)));box.innerHTML=people.length?people.map(p=>`<label class="lr-group-picker-item"><input type="checkbox" value="${esc(p.id)}"><span><b>${esc(p.name||'未命名联系人')}</b><small>${esc(p.role||'AI 联系人')}</small></span></label>`).join(''):'<div class="lr-group-empty-picker">没有可添加的联系人。</div>'}
async function saveGroupSettings(){const id=settingsGroupId;if(!id)return;const group=await getOne(STORE_GROUPS,id);if(!group)return;group.name=String($('lrGroupEditName').value||'').trim()||'未命名群聊';group.announcement=String($('lrGroupEditAnnouncement').value||'').trim();group.maxAiMessagesPerTurn=Math.max(1,Math.min(10,parseInt($('lrGroupReplyLimit').value,10)||4));group.background=$('lrGroupBackground').value||'#f7f3f9';group.avatar=groupAvatarDraft||'';group.backgroundImage=groupBackgroundDraft||'';
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
async function fetchWithTimeout(url,options,timeout=90000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(url,{...options,signal:controller.signal})}finally{clearTimeout(timer)}}
function buildGroupSystem(group,activeMembers,history){
 const world=host().getWorldBookPrompt?.()||'';
 const memberProfiles=activeMembers.map(m=>{const p=getPerson(m.contactId)||{},meta=host().getChatMeta?.(m.contactId)||{};return `角色 ID：${m.contactId}\n姓名：${p.name||m.name}\n身份：${p.role||m.role||''}\n人设：${p.persona||p.personality||''}\n背景：${p.background||''}\n人物规则：${p.instructions||'保持人物一致，不要替用户决定行动、台词或情绪。'}\n个人长期记忆：${String(meta.longTermMemory||'暂无').slice(0,2500)}`}).join('\n\n---\n\n');
 return `你是 LOVE RECORD 的自然群聊调度器。你需要在同一个群聊里扮演多位独立角色。群名：${group.name||'群聊'}。群公告：${group.announcement||'无'}。\n\n可参与的角色资料：\n${memberProfiles}\n\n共同世界书：\n${world||'暂无'}\n\n近期群聊历史：\n${history||'暂无历史'}\n\n核心规则：\n1. 用户是群主和真实参与者。绝对不要替用户生成台词、行为、想法或情绪。\n2. 自然群聊：根据当前话题判断哪些角色适合发言。不要求所有角色每轮都回复。\n3. 允许角色互相回应、接话、吐槽或延续彼此话题，不要每条都只回答用户。\n4. 每条消息必须由一个真实成员发送，senderId 必须严格来自上方角色 ID。保持每个人的人设、语气、关系与知识边界，不得混淆身份。\n5. 角色只能知道自己亲自经历、被告知或在群聊中看到的事情。\n6. 如果用户 @ 某位角色，优先考虑该角色回应，但仍允许其他角色自然参与。\n7. 本轮最多生成 ${group.maxAiMessagesPerTurn||4} 条 AI 消息。可以少于上限，甚至没有角色适合回应时返回空数组。绝不为凑数而发言。\n8. 每条消息应像即时通讯气泡，简洁自然；不写客服式总结，不强行在结尾提问。\n9. 仅输出 JSON，不要 Markdown，不要代码围栏。\n\n返回结构：\n{"messages":[{"senderId":"上方某个角色ID","text":"该角色发出的消息"}],"memoryUpdates":[{"contactId":"角色ID","content":"仅记录该角色确实知道且长期有意义的重要事件"}]}\n\nmemoryUpdates 只记录明确、稳定且值得未来记住的事件或约定；不要记录日常寒暄、猜测或角色没有参与/不知道的事情。没有重要事件时返回空数组。内容要短小、准确。`;
}
async function syncGroupMemory(group,turnId,memoryUpdates){
 if(!Array.isArray(memoryUpdates)||!memoryUpdates.length)return;
 for(const item of memoryUpdates){const id=String(item?.contactId||'');const content=String(item?.content||'').trim();if(!id||!content||!groupActiveMembers(group).some(m=>m.contactId===id)||!getPerson(id))continue;
  try{const meta=host().getChatMeta?.(id)||{},done=Array.isArray(meta.groupMemorySyncedTurns)?meta.groupMemorySyncedTurns:[];if(done.includes(turnId))continue;const prefix=`[群聊记忆·${group.name||'群聊'}·${new Date().toLocaleDateString('zh-CN')}] `;const line=prefix+content;const old=String(meta.longTermMemory||'').trim();if(!old.includes(content)){meta.longTermMemory=(old?old+'\n':'')+line;meta.longTermMemory=meta.longTermMemory.slice(-8800)}meta.groupMemorySyncedTurns=[...done,turnId].slice(-200);await host().saveChatMeta?.(id,meta)}catch(err){console.warn('[LOVE RECORD] group memory sync failed for '+id,err)}
 }
}
async function generateGroupTurn(group,userMessage,turn){
 if(busy){notify('群聊正在生成，请稍候');turn.status='cancelled';turn.completedAt=Date.now();turn.error='已有群聊生成任务正在运行';await saveTurn(turn).catch(()=>{});return}const api=host().getApiConfig?.()||{};if(!api.apiBase||!api.apiKey||!api.apiModel){notify('请先在 LOVE RECORD 设置中连接 AI API');turn.status='failed';turn.error='尚未配置 AI API';turn.failedAt=Date.now();await saveTurn(turn).catch(()=>{});return}
 const members=groupActiveMembers(group);if(!members.length){notify('群聊没有可用角色，请检查群成员');turn.status='failed';turn.error='群聊没有可用角色';turn.failedAt=Date.now();await saveTurn(turn).catch(()=>{});return}
 busy=true;$('lrGroupSend').disabled=true;$('lrGroupSend').textContent='…';$('lrGroupHint').textContent='角色正在思考谁适合加入对话…';
 try{
  const historyMsgs=(await listMessages(group.id)).slice(-28);const history=historyMsgs.map(m=>{const sender=m.senderType==='user'?'用户':m.senderType==='system'?'系统':(m.senderNameSnapshot||getName(m.senderId));return sender+'：'+String(m.text||'').slice(0,700)}).join('\n');
  const system=buildGroupSystem(group,members,history);
  const mentionNames=members.filter(m=>userMessage.text.includes('@'+m.name)||userMessage.text.includes('@'+getName(m.contactId))).map(m=>m.name||getName(m.contactId));
  const userPrompt=`用户刚刚在群聊中发送：\n${userMessage.text}\n\n本轮被 @ 的角色（如果有）：${mentionNames.join('、')||'无'}。\n请基于群聊历史生成自然的多人互动，并严格按 JSON 结构返回。`;
  const response=await fetchWithTimeout(api.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+api.apiKey,'Accept':'application/json'},body:JSON.stringify({model:api.apiModel,messages:[{role:'system',content:system},{role:'user',content:userPrompt}],stream:false})},90000);
  const raw=await response.text();if(!response.ok)throw new Error('HTTP '+response.status+' · '+raw.slice(0,220));let payload;try{payload=JSON.parse(raw)}catch(_){throw new Error('API 返回的不是有效 JSON')};const content=extractAIText(payload);if(!content)throw new Error('AI 没有返回群聊内容');let parsed=parseModelJson(content);
  if(!parsed){const fallback=content.replace(/```[\s\S]*?```/g,'').trim();if(fallback){const target=members.find(m=>mentionNames.includes(m.name))||members[0];parsed={messages:[{senderId:target.contactId,text:fallback}],memoryUpdates:[]}}else parsed={messages:[],memoryUpdates:[]}}
  const limit=Math.max(1,Math.min(10,Number(group.maxAiMessagesPerTurn)||4));const allowed=new Set(members.map(m=>m.contactId));const rawMessages=Array.isArray(parsed.messages)?parsed.messages:[];let count=0;
  for(const item of rawMessages){if(count>=limit)break;const senderId=String(item?.senderId||item?.contactId||'');if(!allowed.has(senderId))continue;const member=members.find(m=>m.contactId===senderId);const text=String(item?.text||item?.content||'').trim();if(!text)continue;for(const bubble of splitBubbles(text)){if(count>=limit)break;const msg={id:makeId('msg'),groupId:group.id,senderType:'character',senderId,senderNameSnapshot:member.name||getName(senderId),senderRoleSnapshot:member.role||'',text:bubble,createdAt:nextMessageTimestamp(group),turnId:turn.id};await saveMessage(msg);count++;group.lastMessage={text:bubble,senderName:msg.senderNameSnapshot,createdAt:msg.createdAt};await saveGroup(group);}}
  await syncGroupMemory(group,turn.id,Array.isArray(parsed.memoryUpdates)?parsed.memoryUpdates:[]);
  turn.status='completed';turn.completedAt=Date.now();turn.generatedCount=count;await saveTurn(turn);
  if(!count)notify('本轮没有角色需要接话，可以继续说点什么。');
 }catch(err){console.error('[LOVE RECORD] group turn failed',err);turn.status='failed';turn.error=String(err?.message||err);turn.failedAt=Date.now();await saveTurn(turn).catch(()=>{});notify('群聊回复失败：'+(err?.message||'请检查 API'))}
 finally{busy=false;$('lrGroupSend').disabled=false;$('lrGroupSend').textContent='发送';await renderGroupConversation().catch(()=>{});}
}
async function sendGroupMessage(){if(!activeGroupId||busy||sending)return;const input=$('lrGroupInput'),button=$('lrGroupSend'),text=String(input.value||'').trim();if(!text)return;sending=true;if(button)button.disabled=true;try{const group=await getOne(STORE_GROUPS,activeGroupId);if(!group)return;const message={id:makeId('msg'),groupId:group.id,senderType:'user',senderId:'user',senderNameSnapshot:'我',text,createdAt:nextMessageTimestamp(group)};const turn={id:makeId('turn'),groupId:group.id,userMessageId:message.id,status:'generating',createdAt:Date.now(),generatedCount:0};await saveMessage(message);group.lastMessage={text,senderName:'我',createdAt:message.createdAt};await saveGroup(group);await saveTurn(turn);input.value='';await renderGroupConversation();await generateGroupTurn(group,message,turn)}catch(err){notify('消息保存失败：'+err.message)}finally{sending=false;if(button&&!busy){button.disabled=false;button.textContent='发送'}}}
function installStyles(){if($('lrGroupChatStyles'))return;const st=document.createElement('style');st.id='lrGroupChatStyles';st.textContent=`
#lrGroupList{margin:0 0 14px}#lrGroupList[hidden]{display:none!important}.lr-group-list-head{display:flex;justify-content:space-between;align-items:center;padding:8px 4px 9px;color:var(--muted,#988a9d);font-size:10px;letter-spacing:1.8px}.lr-group-list-head small{letter-spacing:0;font-size:11px}.lr-group-list-item{width:100%;display:flex;align-items:center;gap:11px;text-align:left;padding:12px 10px;border:1px solid rgba(181,164,191,.18);border-radius:17px;background:rgba(255,255,255,.7);margin-bottom:8px;color:var(--ink,#554b5d);box-shadow:0 5px 16px rgba(70,50,80,.04)}.lr-group-list-avatar,.lr-group-avatar{width:44px;height:44px;min-width:44px;border-radius:15px;background:linear-gradient(145deg,#eee7f2,#e1d7e9);display:grid;place-items:center;overflow:hidden;color:#806d8d;font-size:13px}.lr-group-list-avatar img,.lr-group-avatar img{width:100%;height:100%;object-fit:cover}.lr-group-list-copy{display:grid;gap:4px;flex:1;min-width:0}.lr-group-list-copy strong{font-size:13px;font-weight:600}.lr-group-list-copy small{font-size:11px;color:var(--muted,#93869a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr-group-list-meta{display:grid;justify-items:end;gap:5px;color:var(--muted,#9a8da0);font-size:10px}.lr-group-list-meta b{font-weight:500}.lr-group-conversation{position:relative;min-height:calc(100dvh - 128px);height:calc(100dvh - 128px);display:flex;flex-direction:column;background:#f7f3f9;border-radius:0;overflow:hidden}.lr-group-conversation[hidden]{display:none!important}.lr-group-head{display:flex;align-items:center;gap:11px;padding:12px 14px;background:rgba(255,255,255,.82);border-bottom:1px solid rgba(150,130,160,.12)}.lr-group-head-copy{flex:1;min-width:0;display:grid;gap:3px}.lr-group-head-copy strong{font-size:14px;font-weight:600;color:#5e5266}.lr-group-head-copy small{font-size:11px;color:#a094a5}.lr-group-head-action{width:36px;height:36px;border:1px solid rgba(160,140,175,.2);background:#fff;border-radius:50%;font-size:20px;color:#8c7b97}.lr-group-announcement{padding:8px 13px;background:rgba(239,231,244,.88);font-size:11px;color:#81718b;line-height:1.55}.lr-group-announcement[hidden]{display:none}.lr-group-messages{flex:1;min-height:160px;overflow:auto;padding:16px 12px 22px;display:flex;flex-direction:column;gap:13px;background:#f7f3f9;background-size:cover;background-position:center}.lr-group-message-row{display:flex;align-items:flex-start;gap:8px;max-width:94%}.lr-group-message-row.is-user{flex-direction:row-reverse;align-self:flex-end}.lr-group-message-avatar{width:30px;height:30px;min-width:30px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#e8dfed;color:#806b8a;font-size:11px}.lr-group-message-avatar img{width:100%;height:100%;object-fit:cover}.lr-group-message-content{display:grid;gap:4px;min-width:0}.lr-group-message-name{font-size:10px;color:#988b9f;padding:0 4px}.lr-group-message-name time{margin-left:6px;opacity:.7}.lr-group-message-bubble{padding:10px 12px;border:1px solid rgba(170,150,180,.12);border-radius:15px 15px 15px 5px;background:rgba(255,255,255,.93);color:#514758;font-size:13px;line-height:1.7;overflow-wrap:anywhere;box-shadow:0 4px 12px rgba(62,42,75,.035)}.is-user .lr-group-message-bubble{background:linear-gradient(145deg,#e9e0ee,#e3d8e9);border-radius:15px 15px 5px 15px;color:#5f5068}.lr-group-system-message{text-align:center;margin:2px auto}.lr-group-system-message span{display:inline-block;padding:5px 10px;border-radius:99px;background:rgba(255,255,255,.65);color:#a094a5;font-size:10px}.lr-group-empty{text-align:center;margin:auto;color:#a398aa;font-size:12px;line-height:1.8;padding:24px}.lr-group-compose{display:flex;align-items:flex-end;gap:7px;padding:9px 10px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.9);border-top:1px solid rgba(150,130,160,.12)}.lr-group-compose textarea{flex:1;min-width:0;max-height:100px;resize:none;border:1px solid rgba(169,151,179,.22);border-radius:16px;padding:10px 12px;background:#fff;color:#514758;font:inherit;font-size:13px;line-height:1.5}.lr-group-at,.lr-group-send{min-width:38px;height:38px;border:0;border-radius:13px;background:#eee7f2;color:#826f8c;font-size:14px}.lr-group-send{padding:0 13px;background:var(--lr-accent,#ad91bd);color:#fff}.lr-group-send:disabled{opacity:.55}.lr-group-hint{text-align:center;background:rgba(255,255,255,.9);color:#a99eae;font-size:9px;padding:0 8px 6px}.lr-group-mention-menu{position:absolute;left:12px;bottom:75px;z-index:10;padding:6px;border:1px solid #e9e0ed;border-radius:13px;background:#fff;box-shadow:0 8px 24px #42304a18;display:grid;gap:3px;max-height:190px;overflow:auto}.lr-group-mention-menu[hidden]{display:none}.lr-group-mention-menu button{border:0;background:transparent;padding:9px 13px;text-align:left;color:#766781;border-radius:8px}.lr-group-modal{z-index:2147483100}.lr-group-modal.show{display:flex!important;align-items:flex-start;overflow:auto;padding:12px 10px calc(25px + env(safe-area-inset-bottom))}.lr-group-sheet{width:min(100%,620px);max-height:calc(100dvh - 24px);overflow:auto;border-radius:22px;background:var(--panel,#fff);padding:18px}.lr-group-sheet label{display:block;margin:13px 0 6px;color:var(--muted,#92859a);font-size:12px}.lr-group-sheet input:not([type=checkbox]),.lr-group-sheet textarea,.lr-group-sheet select{width:100%;box-sizing:border-box;border:1px solid var(--line,#e9e1ec);border-radius:12px;background:#fff;padding:11px;color:var(--ink,#514758);font:inherit}.lr-group-picker{display:grid;gap:7px;margin-top:10px;max-height:330px;overflow:auto}.lr-group-picker-item{display:flex!important;align-items:center;gap:10px;padding:10px 11px;border:1px solid rgba(165,145,177,.16);border-radius:13px;background:rgba(255,255,255,.78);margin:0!important}.lr-group-picker-item input{width:17px;height:17px;accent-color:var(--lr-accent,#ad91bd)}.lr-group-picker-item span{display:grid;gap:3px}.lr-group-picker-item b{font-size:12px;color:#62566b}.lr-group-picker-item small{font-size:10px;color:#9b8fa2}.lr-group-picker.compact{max-height:180px}.lr-group-modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.lr-group-modal-actions button{min-height:42px}.lr-group-empty-picker{padding:18px;text-align:center;color:#9c90a2;font-size:12px}.lr-group-settings-section{margin-top:18px;padding-top:14px;border-top:1px solid rgba(165,145,177,.16)}.lr-group-section-head{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#6b5c73;margin-bottom:9px}.lr-group-section-head span{font-size:11px;color:#a094a7}.lr-group-manage-members{display:grid;gap:7px}.lr-group-member-row{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid rgba(165,145,177,.13);border-radius:12px}.lr-group-member-avatar{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#eee7f2;color:#867391;font-size:11px}.lr-group-member-info{flex:1;display:grid;gap:3px}.lr-group-member-info b{font-size:12px;color:#66596e}.lr-group-member-info small{font-size:10px;color:#a094a7}.lr-group-member-remove{border:0;background:transparent;color:#aa777c;font-size:11px;padding:7px}.lr-group-member-row.will-remove{background:rgba(174,116,126,.08);border-color:rgba(174,116,126,.22)}.lr-group-member-row.will-remove .lr-group-member-remove{color:#8e7c91}.lr-group-image-fields{display:grid;gap:14px;margin-top:14px}.lr-group-image-preview{width:88px;height:88px;border-radius:18px;display:grid;place-items:center;overflow:hidden;background:#eee7f2;color:#857391;font-size:13px;border:1px solid rgba(165,145,177,.18);margin:7px 0}.lr-group-image-preview.wide{width:100%;height:112px;border-radius:14px;padding:8px;box-sizing:border-box;text-align:center;font-size:11px}.lr-group-image-preview img{width:100%;height:100%;object-fit:cover}.lr-group-image-preview.wide img{object-fit:cover}.lr-group-image-fields .actions{display:flex;gap:7px;flex-wrap:wrap}.lr-group-image-fields .actions .btn{font-size:11px;padding:8px 11px}.lr-group-member-row.will-remove .lr-group-member-info small{color:#a56f79}.lr-group-danger{width:100%;margin-top:12px;color:#a66c75;border-color:rgba(166,108,117,.25)}

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
 background:var(--bg,#f1eef5)!important;
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
.chat-page.is-group-conversation .lr-group-message-row.is-user{justify-content:flex-end!important}
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
`;document.head.appendChild(st)}
function bind(){
 $('lrOpenCreateGroup')?.addEventListener('click',()=>{const modal=$('chatAddModal');modal?.classList.remove('show');document.body.style.overflow='';openCreateGroup()});
 $('lrCreateGroupClose')?.addEventListener('click',closeCreateGroup);$('lrCreateGroupCancel')?.addEventListener('click',closeCreateGroup);$('lrCreateGroupConfirm')?.addEventListener('click',createGroup);
 $('lrCreateGroupModal')?.addEventListener('click',e=>{if(e.target.id==='lrCreateGroupModal')closeCreateGroup()});
$('lrGroupSaveSettings')?.addEventListener('click',saveGroupSettings);$('lrGroupDissolve')?.addEventListener('click',dissolveGroup);$('lrGroupExport')?.addEventListener('click',exportGroup);$('lrGroupHeaderSettings')?.addEventListener('click',openGroupSettings);$('lrGroupChooseAvatar')?.addEventListener('click',()=>$('lrGroupAvatarFile')?.click());$('lrGroupAvatarFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{groupAvatarDraft=await compressGroupImage(file,640,.84);renderGroupImagePreview('lrGroupAvatarPreview',groupAvatarDraft,'群');}catch(err){notify('群头像处理失败：'+err.message)}finally{e.target.value=''}});$('lrGroupClearAvatar')?.addEventListener('click',()=>{groupAvatarDraft='';renderGroupImagePreview('lrGroupAvatarPreview','','群')});$('lrGroupChooseBackgroundImage')?.addEventListener('click',()=>$('lrGroupBackgroundFile')?.click());$('lrGroupBackgroundFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{groupBackgroundDraft=await compressGroupImage(file,1440,.8);renderGroupImagePreview('lrGroupBackgroundPreview',groupBackgroundDraft,'未设置背景图片');}catch(err){notify('群聊背景处理失败：'+err.message)}finally{e.target.value=''}});$('lrGroupClearBackgroundImage')?.addEventListener('click',()=>{groupBackgroundDraft='';renderGroupImagePreview('lrGroupBackgroundPreview','','未设置背景图片')});

 $('lrGroupMention')?.addEventListener('click',openMentionMenu);$('lrGroupMentionMenu')?.addEventListener('click',e=>{const b=e.target.closest('[data-lr-mention]');if(b)insertMention(b.dataset.lrMention)});
 $('lrGroupSend')?.addEventListener('click',sendGroupMessage);$('lrGroupInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendGroupMessage()}});
 $('lrGroupManageMembers')?.addEventListener('click',e=>{const b=e.target.closest('[data-lr-group-remove]');if(!b)return;const row=b.closest('.lr-group-member-row');if(!row)return;const willRemove=row.dataset.willRemove==='1';row.dataset.willRemove=willRemove?'0':'1';row.classList.toggle('will-remove',!willRemove);const note=row.querySelector('[data-lr-member-note]');if(note){if(willRemove){const groupMemberRole=row.dataset.memberRole||'群成员';note.textContent=groupMemberRole}else{row.dataset.memberRole=note.textContent;note.textContent='保存后将从群聊移除'}}b.textContent=willRemove?'移除':'撤销'});
 document.addEventListener('click',e=>{const b=e.target.closest('[data-lr-group-open]');if(b){e.preventDefault();openGroup(b.dataset.lrGroupOpen)}});
 const back=document.querySelector('#systemAppbar .system-back');if(back)back.addEventListener('click',e=>{if(!activeGroupId)return;e.preventDefault();e.stopImmediatePropagation();if(settingsOpen)closeGroupSettings();else backToList()},{capture:true});
 $('systemAppbarAction')?.addEventListener('click',e=>{if(!activeGroupId||settingsOpen)return;e.preventDefault();e.stopImmediatePropagation();openGroupSettings()},{capture:true});
 document.addEventListener('lr-contacts-updated',()=>{renderGroupList();if(activeGroupId)renderGroupConversation()});
}
// Keep the existing private-chat render and message engine intact. Group mode only intercepts the active view.
function patchRender(){if(typeof window.renderChat!=='function'||window.renderChat.__lrGroupWrapped)return;const base=window.renderChat;const wrapped=function(){if(activeGroupId){const list=$('lrGroupList');if(list){list.hidden=true;list.setAttribute('aria-hidden','true')}renderGroupConversation().catch(e=>console.error('[LOVE RECORD] group render failed',e));return}const out=base.apply(this,arguments);const list=$('lrGroupList'),privateConversation=$('chatConversation'),chatRoot=$('chat'),groupConv=$('lrGroupConversation');const oneToOneOpen=!!(privateConversation&&!privateConversation.hidden)||!!chatRoot?.classList.contains('is-conversation');if(list&&oneToOneOpen){list.hidden=true;list.setAttribute('aria-hidden','true')}else if(list)renderGroupList();if(groupConv)groupConv.hidden=true;return out};wrapped.__lrGroupWrapped=true;window.renderChat=wrapped;}
async function recoverInterruptedTurns(){const turns=await getAll(STORE_TURNS);for(const turn of turns){if(turn.status==='generating'){turn.status='interrupted';turn.interruptedAt=Date.now();turn.error='页面在本轮生成完成前关闭；为防止重复回复，未自动重试。';await saveTurn(turn)}}}
async function init(){installStyles();bind();try{await openDB();await window.__lrChatStorageReady?.catch?.(()=>{});await window.__lrChatContactsReady?.catch?.(()=>{});await recoverInterruptedTurns();patchRender();await renderGroupList();}catch(err){console.error('[LOVE RECORD] group chat initialization failed',err);notify('群聊模块初始化失败：'+err.message)}
 // Re-wrap if another late-loaded extension replaces renderChat.
 setTimeout(patchRender,500);setTimeout(patchRender,1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
