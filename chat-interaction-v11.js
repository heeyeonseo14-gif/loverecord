/* LOVE RECORD V24 · Chat interaction v11
   Left-side attachment menu, image/location/transfer messages, timestamps,
   character schedule with foreground due checks, and private inner thoughts.
   Attachments are stored in a separate IndexedDB database, never localStorage.
*/
(function () {
  'use strict';
  if (window.__lrChatInteractionV11) return;
  window.__lrChatInteractionV11 = true;
  const $ = id => document.getElementById(id);
  const DB_NAME = 'love-record-chat-files-v1';
  const STORE = 'attachments';
  let dbPromise;
  let menuOpen = false;
  let scheduleBusy = false;
  let scheduleCheckBusy = false;
  let thoughtBusy = false;
  const objectUrls = new Map();

  const activeId = () => typeof activeChatContactId !== 'undefined' ? activeChatContactId : '';
  const threads = () => readChatThreads();
  const threadFor = id => Array.isArray(threads()[id]) ? threads()[id] : [];
  const metaFor = id => typeof chatMeta === 'function' ? chatMeta(id) : {};
  const persistMeta = async (id, value) => {
    if (typeof saveChatMetaSafely === 'function') return saveChatMetaSafely(id, value);
    writeChatMeta(id, value); return value;
  };
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localNow = () => new Date();
  const timeText = value => {
    const d = new Date(Number(value));
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false});
  };
  const dateTimeText = value => {
    const d = new Date(Number(value));
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN', {hour12:false});
  };
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, {keyPath:'id', autoIncrement:true}); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('图片储存初始化失败'));
    });
    return dbPromise;
  }
  async function saveAttachment(file) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).add({blob:file, name:file.name || 'image', type:file.type || 'image/*', createdAt:Date.now()});
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('图片保存失败'));
    });
  }
  async function loadAttachment(id) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const req = database.transaction(STORE, 'readonly').objectStore(STORE).get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('图片读取失败'));
    });
  }
  async function attachmentUrl(id) {
    if (objectUrls.has(id)) return objectUrls.get(id);
    const record = await loadAttachment(id);
    if (!record || !record.blob) return '';
    const url = URL.createObjectURL(record.blob);
    objectUrls.set(id, url);
    return url;
  }
  function pushMessage(message) {
    const id = activeId(); if (!id) return;
    const all = threads(); const list = Array.isArray(all[id]) ? all[id] : [];
    list.push(Object.assign({at:Date.now()}, message)); all[id] = list;
    writeChatThreads(all);
    if (typeof renderChat === 'function') renderChat();
  }
  function addStyles() {
    if ($('lr-v10-style')) return;
    const style = document.createElement('style'); style.id = 'lr-v10-style';
    style.textContent = `
      #chatConversation .chat-compose{position:relative;display:flex;align-items:flex-end;gap:7px}
      #lrChatPlus{width:44px;height:44px;flex:0 0 44px;border:1px solid #e6dce9;border-radius:15px;background:#fff;color:#987ba5;font-size:27px;line-height:1;display:grid;place-items:center;padding:0}
      #chatConversation .chat-compose textarea{min-width:0;flex:1}
      #chatSend{flex:0 0 auto}
      #lrAskAI{flex:0 0 44px!important;width:44px!important;height:44px!important}
      #lrChatPlusMenu{position:absolute;left:0;bottom:calc(100% + 10px);z-index:30;width:min(245px,78vw);padding:9px;background:rgba(255,255,255,.97);border:1px solid #e9e0ec;border-radius:19px;box-shadow:0 12px 34px rgba(70,48,82,.14);display:grid;gap:4px}
      #lrChatPlusMenu[hidden]{display:none!important}
      #lrChatPlusMenu button{border:0;background:transparent;border-radius:12px;padding:11px 12px;text-align:left;color:#55495d;font:inherit;font-size:14px}
      #lrChatPlusMenu button:active{background:#f2eaf5}
      .lr-message-time{flex:0 0 auto;font-size:10px;color:#a49aa8;line-height:1.2;padding:0 2px 3px;white-space:nowrap;align-self:flex-end}
      .chat-message-row{flex-wrap:nowrap;align-items:flex-end;gap:7px}
      .chat-message-row .chat-bubble{max-width:min(68%,430px)}
      .chat-message-row.user{justify-content:flex-end}
      .chat-message-row.ai{justify-content:flex-start}
      .chat-message-row.user .chat-message-avatar{order:3}
      .chat-message-row.user .lr-message-time{order:2}
      .chat-message-row.user .chat-bubble{order:1}
      .chat-message-row.ai .chat-message-avatar{order:1}
      .chat-message-row.ai .chat-bubble{order:2}
      .chat-message-row.ai .lr-message-time{order:3}
      .lr-chat-image{display:block;max-width:min(62vw,260px);max-height:360px;border-radius:13px;object-fit:cover}
      .lr-transfer-card{min-width:220px;max-width:260px;padding:19px 20px;border-radius:20px;background:linear-gradient(145deg,#c5a7d0,#9877a8);color:#fff;box-shadow:0 9px 22px rgba(126,93,143,.17)}
      .lr-transfer-card small{display:block;opacity:.72;font-size:9px;letter-spacing:2px;margin-bottom:10px}
      .lr-transfer-card strong{display:block;font:29px Georgia,serif;font-weight:400;margin-bottom:9px}
      .lr-transfer-card span{font-size:12px;opacity:.9}
      .lr-location-card{display:block;text-decoration:none;color:inherit}
      .lr-location-card small{display:block;color:inherit;opacity:.75;margin-top:5px}
      #lrThoughtModal{position:fixed;inset:0;z-index:10020;background:rgba(35,27,40,.35);display:grid;place-items:center;padding:22px}
      #lrThoughtModal[hidden]{display:none!important}
      #lrThoughtModal .lr-thought-sheet{width:100%;max-width:420px;background:#fff;border-radius:25px;padding:22px;box-shadow:0 18px 60px rgba(30,20,40,.2);color:#423748}
      #lrThoughtModal h3{font-weight:500;margin:0 0 12px;font-size:19px}
      #lrThoughtText{white-space:pre-wrap;line-height:1.85;color:#716778;min-height:65px}
      #lrThoughtModal button{margin-top:15px;width:100%}
      .lr-schedule-list{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:10px}
      .lr-schedule-item{display:grid;grid-template-columns:58px 1fr;gap:12px;padding:13px 14px;border:1px solid #eee7f1;border-radius:17px;background:linear-gradient(135deg,#fff,#faf6fc)}
      .lr-schedule-time{font:19px Georgia,serif;color:#9676a4;padding-top:2px}
      .lr-schedule-title{font-size:14px;color:#44394a;font-weight:600}
      .lr-schedule-detail{font-size:12px;color:#8c8191;line-height:1.65;margin-top:4px}
      .lr-action-overlay{position:fixed;inset:0;z-index:10030;background:rgba(42,33,47,.38);display:grid;place-items:center;padding:18px;backdrop-filter:blur(5px)}
      .lr-action-overlay[hidden]{display:none!important}
      .lr-action-sheet{width:100%;max-width:430px;max-height:84vh;overflow:auto;background:#fff;border:1px solid rgba(255,255,255,.8);border-radius:28px;padding:23px 21px 20px;box-shadow:0 22px 70px rgba(43,31,52,.2);color:#403747}
      .lr-action-kicker{font-size:9px;letter-spacing:4px;color:#a493ad}
      .lr-action-title{font:25px Georgia,serif;margin:8px 0 7px;color:#3e3543}
      .lr-action-desc{font-size:12px;line-height:1.7;color:#968b9a;margin-bottom:15px}
      .lr-action-sheet label{display:block;font-size:12px;color:#8d8092;margin:13px 0 6px}
      .lr-action-sheet input,.lr-action-sheet textarea{width:100%;border:1px solid #e9e1ec;border-radius:15px;padding:13px 14px;background:#fcfafd;color:#403747;font:inherit;font-size:14px;outline:none}
      .lr-action-sheet textarea{min-height:78px;resize:vertical}
      .lr-action-buttons{display:flex;gap:9px;margin-top:18px}
      .lr-action-buttons button{flex:1;min-height:45px;border-radius:999px;border:1px solid #e7dfe9;background:#fff;color:#6e6174;font:inherit}
      .lr-action-buttons .primary{background:linear-gradient(135deg,#c5a9d0,#a989b8);border-color:transparent;color:#fff}
      .lr-transfer-preview{background:linear-gradient(145deg,#c5a7d0,#9877a8);border-radius:22px;padding:20px;color:#fff;margin:14px 0 5px}
      .lr-transfer-preview small{display:block;opacity:.8;letter-spacing:2px;font-size:9px}
      .lr-transfer-preview strong{display:block;font:32px Georgia,serif;margin:10px 0 4px}
      .lr-transfer-preview span{font-size:12px;opacity:.9}
      .lr-location-pin{width:42px;height:42px;border-radius:15px;background:#f0e7f4;color:#9a7ca8;display:grid;place-items:center;font-size:21px;float:right}
      .lr-thought-loading{display:flex;align-items:center;gap:9px;color:#9a8ba0;font-size:13px;padding:18px 0}
      .lr-thought-loading:before{content:'';width:7px;height:7px;border-radius:50%;background:#b99ac7;box-shadow:12px 0 #d7c4df,24px 0 #eadfee;margin-right:22px;animation:lrPulse 1s infinite alternate}
      @keyframes lrPulse{to{opacity:.35}}
      .lr-thought-error{color:#986879;background:#fbf2f5;border-radius:14px;padding:12px;font-size:12px;line-height:1.65}
      #lrThoughtModal .lr-thought-sheet{padding:25px 23px;border-radius:28px}
      #lrThoughtText{min-height:75px;font-size:14px}
      @media(max-width:420px){#lrChatPlus{width:42px;height:42px;flex-basis:42px}#lrAskAI{width:42px!important;height:42px!important;flex-basis:42px!important}.lr-action-sheet{padding:21px 18px}}
    `;
    document.head.appendChild(style);
  }
  function ensureMenu() {
    const compose = document.querySelector('#chatConversation .chat-compose');
    if (!compose || $('lrChatPlus')) return;
    const plus = document.createElement('button'); plus.type='button'; plus.id='lrChatPlus'; plus.textContent='＋'; plus.setAttribute('aria-label','更多聊天功能');
    const menu = document.createElement('div'); menu.id='lrChatPlusMenu'; menu.hidden=true;
    menu.innerHTML = `<button type="button" data-lr-action="image">▧　发送图片</button><button type="button" data-lr-action="transfer">↗　转账</button><button type="button" data-lr-action="location">⌖　发送位置</button><button type="button" data-lr-action="schedule">◷　角色行程</button><button type="button" data-lr-action="thought">♡　角色心声</button>`;
    const input = $('chatInput');
    compose.insertBefore(plus, input);
    compose.insertBefore(menu, plus);
    plus.addEventListener('click', () => { menuOpen=!menuOpen; menu.hidden=!menuOpen; plus.textContent=menuOpen?'×':'＋'; });
    menu.addEventListener('click', event => {
      const button = event.target.closest('[data-lr-action]'); if (!button) return;
      menu.hidden=true;menuOpen=false;plus.textContent='＋';
      const action=button.dataset.lrAction;
      if(action==='image') $('lrChatImageInput').click();
      if(action==='transfer') sendTransfer();
      if(action==='location') sendLocation();
      if(action==='schedule') openSchedule();
      if(action==='thought') showInnerThought();
    });
    document.addEventListener('click', event => { if(menuOpen && !menu.contains(event.target) && event.target!==plus){menu.hidden=true;menuOpen=false;plus.textContent='＋';} });
    const picker=document.createElement('input');picker.type='file';picker.accept='image/*';picker.hidden=true;picker.id='lrChatImageInput';compose.appendChild(picker);
    picker.addEventListener('change',async()=>{
      const file=picker.files&&picker.files[0];if(!file)return;
      if(!file.type.startsWith('image/')){toast('请选择图片文件');picker.value='';return;}
      try{const attachmentId=await saveAttachment(file);pushMessage({role:'user',kind:'image',attachmentId,text:'[图片]'});}
      catch(error){toast('图片发送失败：'+(error.message||'储存失败'));}
      picker.value='';
    });
    ensureActionModals();
  }
  function ensureActionModals(){
    if(!$('lrThoughtModal')){
      const modal=document.createElement('div');modal.id='lrThoughtModal';modal.className='lr-action-overlay';modal.hidden=true;
      modal.innerHTML='<section class="lr-action-sheet"><div class="lr-action-kicker">INNER THOUGHTS</div><div class="lr-action-title">角色心声</div><div class="lr-action-desc">只属于此刻的他，正在想些什么。</div><div id="lrThoughtText" class="lr-thought-loading">正在连接角色的思绪…</div><div class="lr-action-buttons"><button type="button" id="lrThoughtRetry" class="primary" hidden>再试一次</button><button type="button" id="lrThoughtClose">关闭</button></div></section>';
      document.body.appendChild(modal);$('lrThoughtClose').addEventListener('click',()=>modal.hidden=true);$('lrThoughtRetry').addEventListener('click',showInnerThought);modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
    }
    if(!$('lrScheduleModal')){
      const modal=document.createElement('div');modal.id='lrScheduleModal';modal.className='lr-action-overlay';modal.hidden=true;
      modal.innerHTML='<section class="lr-action-sheet"><div class="lr-action-kicker">CHARACTER SCHEDULE</div><div class="lr-action-title">角色今日行程</div><div class="lr-action-desc">行程会保存在这位联系人的聊天设置中。再次打开时会显示上次保存的版本。</div><div id="lrScheduleEmpty" class="lr-action-desc" hidden>还没有生成过行程，点击下方按钮生成第一份。</div><ul id="lrScheduleList" class="lr-schedule-list"></ul><div class="lr-action-buttons"><button type="button" id="lrScheduleClose">关闭</button><button type="button" id="lrScheduleGenerate" class="primary">重新生成</button></div></section>';
      document.body.appendChild(modal);$('lrScheduleClose').addEventListener('click',()=>modal.hidden=true);$('lrScheduleGenerate').addEventListener('click',createSchedule);modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
    }
    if(!$('lrTransferModal')){
      const modal=document.createElement('div');modal.id='lrTransferModal';modal.className='lr-action-overlay';modal.hidden=true;
      modal.innerHTML='<section class="lr-action-sheet"><div class="lr-action-kicker">A LITTLE GIFT</div><div class="lr-action-title">转账</div><div class="lr-action-desc">制作一张聊天里的转账纪念卡，不会发生真实付款。</div><div class="lr-transfer-preview"><small>LOVE RECORD · TRANSFER</small><strong id="lrTransferPreviewAmount">RM 0.00</strong><span id="lrTransferPreviewNote">给你的小心意</span></div><label for="lrTransferAmount">金额（RM）</label><input id="lrTransferAmount" inputmode="decimal" type="number" min="0.01" step="0.01" placeholder="例如 100.00"><label for="lrTransferNote">备注</label><input id="lrTransferNote" maxlength="60" placeholder="写一句小心意"><div class="lr-action-buttons"><button type="button" id="lrTransferCancel">取消</button><button type="button" id="lrTransferSend" class="primary">发送转账卡</button></div></section>';
      document.body.appendChild(modal);$('lrTransferCancel').addEventListener('click',()=>modal.hidden=true);$('lrTransferAmount').addEventListener('input',updateTransferPreview);$('lrTransferNote').addEventListener('input',updateTransferPreview);$('lrTransferSend').addEventListener('click',()=>{const value=Number($('lrTransferAmount').value);if(!Number.isFinite(value)||value<=0){toast('请输入有效金额');return;}const note=$('lrTransferNote').value.trim()||'给你的小心意';pushMessage({role:'user',kind:'transfer',amount:value.toFixed(2),note,text:'转账 RM '+value.toFixed(2)});modal.hidden=true;});modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
    }
    if(!$('lrLocationModal')){
      const modal=document.createElement('div');modal.id='lrLocationModal';modal.className='lr-action-overlay';modal.hidden=true;
      modal.innerHTML='<section class="lr-action-sheet"><div class="lr-action-kicker">SHARE A PLACE</div><div class="lr-action-title">发送位置</div><div class="lr-action-desc">手动填写你想分享的地点。不会读取 GPS，也不会获取当前设备位置。</div><label for="lrLocationInput">地点名称 / 地址</label><input id="lrLocationInput" maxlength="160" placeholder="例如：KLCC、吉隆坡国际机场"><label for="lrLocationNote">补充说明（选填）</label><textarea id="lrLocationNote" maxlength="120" placeholder="例如：我们在正门碰面"></textarea><div class="lr-action-buttons"><button type="button" id="lrLocationCancel">取消</button><button type="button" id="lrLocationSend" class="primary">发送地点</button></div></section>';
      document.body.appendChild(modal);$('lrLocationCancel').addEventListener('click',()=>modal.hidden=true);$('lrLocationSend').addEventListener('click',()=>{const place=$('lrLocationInput').value.trim(),note=$('lrLocationNote').value.trim();if(!place){toast('请先填写地点');$('lrLocationInput').focus();return;}pushMessage({role:'user',kind:'location',place,note,text:'位置：'+place+(note?'（'+note+'）':'')});modal.hidden=true;});modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
    }
  }

  function decorateMessages() {
    const id=activeId(), host=$('chatMessages');if(!id||!host)return;
    const list=threadFor(id);const rows=[...host.querySelectorAll('.chat-message-row')];
    rows.forEach((row,index)=>{
      const msg=list[index];if(!msg)return;
      const bubble=row.querySelector('.chat-bubble');if(!bubble)return;
      if(msg.kind==='image'&&msg.attachmentId){
        bubble.textContent='图片加载中…';
        attachmentUrl(msg.attachmentId).then(url=>{if(url&&bubble.isConnected)bubble.innerHTML='<img class="lr-chat-image" src="'+url+'" alt="聊天图片">';else if(bubble.isConnected)bubble.textContent='图片无法读取';}).catch(()=>{bubble.textContent='图片无法读取';});
      } else if(msg.kind==='transfer'){
        bubble.innerHTML='<div class="lr-transfer-card"><small>LOVE RECORD · A LITTLE GIFT</small><strong>RM '+escapeHtml(msg.amount||'0.00')+'</strong><span>'+escapeHtml(msg.note||'给你的小心意')+'</span></div>';
      } else if(msg.kind==='location'){
        const place=escapeHtml(msg.place||msg.text||'未填写地点');
        const url='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(msg.place||msg.text||'');
        bubble.innerHTML='<a class="lr-location-card" href="'+url+'" target="_blank" rel="noopener"><div class="lr-location-pin">⌖</div><strong>位置分享</strong><small>'+place+'</small><small>点击打开地图搜索</small></a>';
      }
      let stamp=row.querySelector('.lr-message-time');if(!stamp){stamp=document.createElement('div');stamp.className='lr-message-time';row.appendChild(stamp);}stamp.textContent=msg.at?timeText(msg.at):'';
    });
  }
  function localTimeContext() {
    const d=localNow(),h=d.getHours();
    let period=h<5?'凌晨':h<7?'清晨':h<11?'早上':h<12?'上午':h<14?'中午':h<18?'下午':h<22?'晚上':'深夜';
    return {now:d,period,text:`现在是用户所在地的真实本地时间：${dateTimeText(d.getTime())}（${period}）。必须按照这个时间段聊天：早上不能说晚安或描述深夜，晚上不能说早安或描述早餐；不要让角色声称已经发生尚未发生的事情，不要擅自跳过数小时或数天。若用户没有说明时间经过，就默认对话发生在当前时间附近。`};
  }
  function apiReady() { return !!(state.apiBase&&state.apiKey&&state.apiModel); }
  async function callModel(system, user, timeout=25000) {
    if(!apiReady())throw new Error('请先在设置中连接 API');
    const response=await fetchTimeout(state.apiBase.replace(/\/+$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:system},{role:'user',content:user}],stream:false})},timeout);
    const raw=await response.text();if(!response.ok)throw new Error('HTTP '+response.status+' · '+raw.slice(0,160));
    const answer=extractAIText(JSON.parse(raw));if(!answer)throw new Error('AI 没有返回内容');return answer;
  }
  function sendTransfer() {
    const modal=$('lrTransferModal'); if(!modal)return;
    $('lrTransferAmount').value=''; $('lrTransferNote').value='给你的小心意';
    modal.hidden=false; $('lrTransferAmount').focus(); updateTransferPreview();
  }
  function updateTransferPreview(){
    const value=Number(String($('lrTransferAmount')?.value||'').replace(/,/g,''));
    $('lrTransferPreviewAmount').textContent=Number.isFinite(value)&&value>0?'RM '+value.toFixed(2):'RM 0.00';
    $('lrTransferPreviewNote').textContent=$('lrTransferNote')?.value.trim()||'给你的小心意';
  }
  function sendLocation() {
    const modal=$('lrLocationModal');if(!modal)return;
    $('lrLocationInput').value='';$('lrLocationNote').value='';modal.hidden=false;$('lrLocationInput').focus();
  }
  function scheduleItemsFor(id){const items=metaFor(id).characterSchedule;return Array.isArray(items)?items:[];}
  function renderScheduleModal(){
    const id=activeId(),items=scheduleItemsFor(id),list=$('lrScheduleList'),empty=$('lrScheduleEmpty');
    if(!list)return;
    list.innerHTML='';
    if(!items.length){empty.hidden=false;$('lrScheduleGenerate').textContent='生成行程';return;}
    empty.hidden=true;$('lrScheduleGenerate').textContent='重新生成';
    items.forEach(item=>{
      const li=document.createElement('li');li.className='lr-schedule-item';
      const time=document.createElement('div');time.className='lr-schedule-time';time.textContent=item.time||'--:--';
      const body=document.createElement('div');
      const title=document.createElement('div');title.className='lr-schedule-title';title.textContent=item.title||'日常安排';
      const detail=document.createElement('div');detail.className='lr-schedule-detail';detail.textContent=item.detail||'';
      body.append(title,detail);li.append(time,body);list.appendChild(li);
    });
  }
  function openSchedule(){
    if(!$('lrScheduleModal'))return;
    renderScheduleModal();$('lrScheduleModal').hidden=false;
  }
  async function createSchedule(){
    const id=activeId(),person=contactById(id);if(!id||!person||scheduleBusy)return;
    if(!apiReady()){toast('请先连接 API，再生成角色行程');return;}
    scheduleBusy=true;$('lrScheduleGenerate').disabled=true;$('lrScheduleGenerate').textContent='正在生成…';
    try{
      const time=localTimeContext();
      const system='你是角色日程规划器。只输出 JSON 数组，每项格式为 {"time":"HH:mm","title":"事项","detail":"简短说明"}。安排3至5项，时间必须从当前时间之后开始，符合现实生活节奏，不能安排过去的时间。';
      const user=`角色：${person.name}。身份：${person.role||''}。性格：${person.personality||''}。背景：${person.background||''}。${time.text}请为角色安排今天剩余时间的个人行程；如果已是深夜，则安排明天的行程，并在每项增加 date 字段 YYYY-MM-DD。只返回 JSON。`;
      const raw=await callModel(system,user,30000);let arr;
      try{arr=JSON.parse(raw.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}catch{throw new Error('行程格式无法读取，请再试一次');}
      if(!Array.isArray(arr)||!arr.length)throw new Error('没有生成有效行程');
      const base=new Date();const items=arr.slice(0,6).map((x,i)=>{
        const match=String(x.time||'').match(/^(\d{1,2}):(\d{2})$/);if(!match)return null;
        const d=new Date(base);if(x.date&&/^\d{4}-\d{2}-\d{2}$/.test(x.date)){const [y,m,day]=x.date.split('-').map(Number);d.setFullYear(y,m-1,day);}
        d.setHours(Number(match[1]),Number(match[2]),0,0);if(!x.date&&d.getTime()<=base.getTime())d.setDate(d.getDate()+1);
        return {id:'sched-'+Date.now()+'-'+i,at:d.getTime(),time:String(x.time),title:String(x.title||'日常安排'),detail:String(x.detail||''),fired:false};
      }).filter(Boolean);
      if(!items.length)throw new Error('行程时间格式不正确');
      const meta=metaFor(id);meta.characterSchedule=items;await persistMeta(id,meta);
      renderScheduleModal();toast('新行程已保存 ♡');checkDueSchedule();
    }catch(error){toast('行程生成失败：'+(error.message||'请重试'));}
    finally{$('lrScheduleGenerate').disabled=false;$('lrScheduleGenerate').textContent='重新生成';scheduleBusy=false;}
  }
  async function triggerSchedule(item, id) {
    const person=contactById(id);if(!person)return;
    const time=localTimeContext();
    const system=`你正在扮演角色「${person.name}」。身份：${person.role||''}；性格：${person.personality||''}；背景：${person.background||''}。${time.text}现在到了你自己的行程时间，请自然地以角色身份主动发来一条简短消息，告诉对方你正在做什么；不要提及系统、定时器或 AI。`;
    try{
      const answer=await callModel(system,`当前行程：${item.time} ${item.title}。详情：${item.detail}。请发一条自然的主动消息。`,20000);
      const all=threads(),list=Array.isArray(all[id])?all[id]:[];const now=Date.now();
      const parts=answer.split(/\s*(?:\|\|\||\n\s*\n+|\n+)\s*/).map(x=>x.trim()).filter(Boolean).slice(0,3);
      parts.forEach((text,i)=>list.push({role:'assistant',text,at:now+i,turnId:'schedule-'+item.id}));all[id]=list;writeChatThreads(all);
      if(id===activeId()&&typeof renderChat==='function')renderChat();
      return true;
    }catch(error){console.warn('[LOVE RECORD] schedule trigger failed',error);return false;}
  }
  async function checkDueSchedule() {
    if(scheduleCheckBusy)return;
    scheduleCheckBusy=true;
    try {
      const ids=typeof readChatContacts==='function'?readChatContacts():[activeId()];
      const now=Date.now();
      for(const id of ids){
        if(!id||!contactById(id))continue;
        const meta=metaFor(id),items=Array.isArray(meta.characterSchedule)?meta.characterSchedule:[];if(!items.length)continue;
        let changed=false;
        for(const item of items){if(!item.fired&&Number(item.at)<=now){const delivered=await triggerSchedule(item,id);if(delivered){item.fired=true;changed=true;}}}
        if(changed){meta.characterSchedule=items;try{await persistMeta(id,meta)}catch(error){console.warn('[LOVE RECORD] schedule state save failed',error)}}
      }
    } finally { scheduleCheckBusy=false; }
  }
  async function showInnerThought() {
    const id=activeId(),person=contactById(id);if(!id||!person||thoughtBusy)return;
    const modal=$('lrThoughtModal'),text=$('lrThoughtText');modal.hidden=false;
    text.className='lr-thought-loading';text.textContent='正在连接角色的思绪…';
    $('lrThoughtRetry').hidden=true;
    if(!apiReady()){text.className='lr-thought-error';text.textContent='还没有连接完整的 API。请检查 API 地址、密钥和模型设置后重试。';$('lrThoughtRetry').hidden=false;return;}
    thoughtBusy=true;
    try{
      const time=localTimeContext(),meta=metaFor(id),recent=threadFor(id).slice(-12).map(m=>(m.role==='user'?'我：':'他：')+(m.text||'')).join('\n');
      const system=`你正在扮演角色「${person.name}」。身份：${person.role||''}；性格：${person.personality||''}；背景：${person.background||''}。${time.text}请根据最近聊天，写出角色此刻真实、克制、符合人设的内心独白。不要把内心想法说成用户已知事实，不要编造未发生的事件。只输出独白正文，不要标题。`;
      const answer=await callModel(system,`角色已有长期记忆：${String(meta.longTermMemory||'暂无')}\n最近聊天：\n${recent||'暂时没有聊天记录'}\n\n请写一段此刻的角色心声，80至180字。`,30000);
      text.className='';text.textContent=answer;
    }catch(error){text.className='lr-thought-error';text.textContent='这次没有成功读取到心声：'+(error.message||'未知错误')+'。你可以检查 API 设置后再试。';$('lrThoughtRetry').hidden=false;}
    finally{thoughtBusy=false;}
  }
  function wrapRender() {
    if(window.__lrV10RenderWrapped||typeof window.renderChat!=='function')return;
    window.__lrV10RenderWrapped=true;const original=window.renderChat;
    window.renderChat=function(){const result=original.apply(this,arguments);ensureMenu();decorateMessages();checkDueSchedule();return result;};
  }
  function install() {
    addStyles();ensureMenu();wrapRender();decorateMessages();checkDueSchedule();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDueSchedule();});
    window.addEventListener('focus',checkDueSchedule);
    setInterval(()=>{if(!document.hidden)checkDueSchedule();},30000);
    // If v9 has not wrapped renderChat yet, retry once the DOM settles.
    setTimeout(()=>{wrapRender();ensureMenu();decorateMessages();},300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
