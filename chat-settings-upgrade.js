/* LOVE RECORD V24 · Chat settings upgrade
   Adds per-contact profile, persona/world context, memory limit, search,
   confirmed deletion and reversible blocking. Existing app storage is preserved. */
(function () {
  'use strict';
  const STYLE_ID = 'lr-chat-settings-upgrade-style';
  const EXTRA_ID = 'lr-chat-settings-extra';
  const clampMemory = value => Math.min(100, Math.max(1, parseInt(value, 10) || 16));
  const currentMeta = () => (typeof activeChatContactId !== 'undefined' && activeChatContactId) ? chatMeta(activeChatContactId) : {};
  const safeText = value => String(value == null ? '' : value);

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${EXTRA_ID}{margin-top:14px}
      #${EXTRA_ID} .lr-setting-card{background:rgba(255,255,255,.78);border:1px solid var(--line);border-radius:22px;padding:16px;margin:14px 0}
      #${EXTRA_ID} .lr-setting-card h3{margin:0 0 12px;font-size:17px;font-weight:500}
      #${EXTRA_ID} label{display:block;margin:10px 0 7px;color:var(--muted);font-size:13px}
      #${EXTRA_ID} input,#${EXTRA_ID} select{width:100%;min-height:46px;border:1px solid var(--line);border-radius:14px;background:#fff;padding:10px 13px;color:var(--ink);font:inherit;box-sizing:border-box}
      #${EXTRA_ID} .lr-avatar-row{display:flex;align-items:center;gap:13px}
      #${EXTRA_ID} .lr-my-avatar{width:58px;height:58px;border-radius:19px;background:#e9deef;display:grid;place-items:center;overflow:hidden;color:#8c7597;font-size:20px;flex:none}
      #${EXTRA_ID} .lr-my-avatar img{width:100%;height:100%;object-fit:cover}
      #${EXTRA_ID} .lr-action-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      #${EXTRA_ID} .lr-action-row .btn{flex:1;min-width:115px}
      #${EXTRA_ID} .lr-danger{border-color:#d9bfc7;color:#9a5365}
      #${EXTRA_ID} .lr-search-results{display:grid;gap:8px;margin-top:10px}
      #${EXTRA_ID} .lr-search-hit{width:100%;text-align:left;border:1px solid var(--line);background:#fff;border-radius:13px;padding:11px 12px;color:var(--ink);font:inherit}
      #${EXTRA_ID} .lr-search-hit small{display:block;color:var(--muted);margin-bottom:4px}
      #${EXTRA_ID} .lr-empty{font-size:13px;color:var(--muted);padding:8px 0}
      .chat-message-row.lr-search-highlight .chat-bubble{outline:2px solid #b99ac7;box-shadow:0 0 0 5px rgba(185,154,199,.16)}
      .chat-message-avatar img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
      .lr-blocked-tag{font-size:10px;color:#9a5365;border:1px solid #dfc6ce;border-radius:99px;padding:2px 7px;margin-left:6px}
      @media(max-width:420px){#${EXTRA_ID} .lr-setting-card{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function ensureExtraUI() {
    const screen = document.getElementById('chatSettingsScreen');
    if (!screen || document.getElementById(EXTRA_ID)) return;
    const saveButton = document.getElementById('chatSaveSettings');
    const extra = document.createElement('div');
    extra.id = EXTRA_ID;
    extra.innerHTML = `
      <section class="lr-setting-card">
        <h3>我的资料</h3>
        <div class="lr-avatar-row"><div class="lr-my-avatar" id="lrMyAvatarPreview">我</div><div style="flex:1"><div style="font-size:14px">我的头像</div><div class="sub" style="margin-top:4px">只影响我在这位联系人的聊天气泡旁显示的头像。</div><button class="btn" id="lrChooseMyAvatar" type="button" style="margin-top:9px">更换我的头像</button><input id="lrMyAvatarFile" type="file" accept="image/*" hidden></div></div>
        <label for="lrPersonaSelect">我的人设</label><select id="lrPersonaSelect"></select>
        <div class="sub" style="margin-top:7px">从「我的自设」中选择；没有建立自设时会使用默认的我。</div>
      </section>
      <section class="lr-setting-card">
        <h3>AI 阅读设置</h3>
        <label for="lrWorldSelect">世界书</label><select id="lrWorldSelect"></select>
        <div class="sub" style="margin-top:7px">选中的世界书会随聊天请求一起发送给 AI。</div>
        <label for="lrMemoryCount">短期记忆条数（1–100）</label><input id="lrMemoryCount" type="number" inputmode="numeric" min="1" max="100" step="1" value="16">
        <div class="sub" style="margin-top:7px">每次请求会带上最近指定条数的聊天消息。</div>
      </section>
      <section class="lr-setting-card">
        <h3>聊天记录</h3>
        <label for="lrSearchKeyword">查找聊天记录</label><input id="lrSearchKeyword" type="search" placeholder="输入关键词搜索这段聊天">
        <div class="lr-action-row"><button class="btn" id="lrSearchButton" type="button">搜索记录</button></div>
        <div class="lr-search-results" id="lrSearchResults"></div>
        <div class="lr-action-row"><button class="btn lr-danger" id="lrDeleteHistory" type="button">删除聊天记录</button></div>
      </section>
      <section class="lr-setting-card">
        <h3>联系人管理</h3>
        <div class="sub">删除只会将联系人从聊天列表移除，并清除这段聊天及聊天设置；人物资料仍保留在「联系人」中，可再次添加。</div>
        <div class="lr-action-row"><button class="btn lr-danger" id="lrDeleteContact" type="button">删除联系人</button><button class="btn" id="lrToggleBlock" type="button">拉黑联系人</button></div>
      </section>`;
    if (saveButton) screen.insertBefore(extra, saveButton);
    else screen.appendChild(extra);
    document.getElementById('lrChooseMyAvatar').onclick = () => document.getElementById('lrMyAvatarFile').click();
    document.getElementById('lrMyAvatarFile').onchange = async event => {
      const file = event.target.files && event.target.files[0]; if (!file) return;
      try {
        const data = await imageToChatData(file, 512);
        editingChatMeta.myAvatar = data;
        document.getElementById('lrMyAvatarPreview').innerHTML = '<img src="' + data + '" alt="我的头像">';
      } catch (_) { toast('我的头像读取失败'); }
      event.target.value = '';
    };
    document.getElementById('lrSearchButton').onclick = searchCurrentThread;
    document.getElementById('lrSearchKeyword').addEventListener('keydown', e => { if (e.key === 'Enter') searchCurrentThread(); });
    document.getElementById('lrDeleteHistory').onclick = deleteCurrentThread;
    document.getElementById('lrDeleteContact').onclick = deleteCurrentContact;
    document.getElementById('lrToggleBlock').onclick = toggleCurrentBlock;
    document.getElementById('lrSearchResults').addEventListener('click', e => {
      const hit = e.target.closest('[data-lr-hit]'); if (!hit) return;
      const index = Number(hit.dataset.lrHit);
      const row = document.querySelectorAll('#chatMessages .chat-message-row')[index];
      if (row) { row.scrollIntoView({behavior:'smooth', block:'center'}); row.classList.add('lr-search-highlight'); setTimeout(() => row.classList.remove('lr-search-highlight'), 2200); }
    });
  }

  function fillExtraUI() {
    ensureExtraUI();
    const meta = currentMeta();
    const avatar = document.getElementById('lrMyAvatarPreview');
    if (avatar) avatar.innerHTML = meta.myAvatar ? '<img src="' + meta.myAvatar + '" alt="我的头像">' : '我';
    const persona = document.getElementById('lrPersonaSelect');
    if (persona) {
      const list = Array.isArray(state.selfPersonas) ? state.selfPersonas : [];
      persona.innerHTML = '<option value="">默认的我</option>' + list.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name || '未命名人设') + '</option>').join('');
      persona.value = meta.personaId || '';
    }
    const world = document.getElementById('lrWorldSelect');
    if (world) {
      const list = Array.isArray(state.worlds) ? state.worlds : [];
      world.innerHTML = '<option value="">不选择世界书</option>' + list.map(w => '<option value="' + esc(w.id) + '">' + esc(w.name || '未命名世界') + '</option>').join('');
      world.value = meta.worldId || '';
    }
    const count = document.getElementById('lrMemoryCount'); if (count) count.value = clampMemory(meta.memoryCount || 16);
    const blocked = document.getElementById('lrToggleBlock'); if (blocked) { blocked.textContent = meta.blocked ? '取消拉黑' : '拉黑联系人'; blocked.classList.toggle('lr-danger', !meta.blocked); }
    const results = document.getElementById('lrSearchResults'); if (results) results.innerHTML = '';
  }

  function applyMessageAvatars() {
    if (!activeChatContactId) return;
    const meta = chatMeta(activeChatContactId);
    document.querySelectorAll('#chatMessages .chat-message-row').forEach(row => {
      const avatar = row.querySelector('.chat-message-avatar'); if (!avatar) return;
      if (row.classList.contains('user')) avatar.innerHTML = meta.myAvatar ? '<img src="' + meta.myAvatar + '" alt="我">' : '我';
    });
    const headAvatar = document.getElementById('chatPersonAvatar');
    if (headAvatar) {
      const p = contactById(activeChatContactId), src = meta.avatar;
      headAvatar.innerHTML = src ? '<img src="' + src + '" alt="' + esc(p?.name || '联系人') + '">' : esc((p?.name || '♡').slice(0,1));
    }
  }

  function searchCurrentThread() {
    const keyword = document.getElementById('lrSearchKeyword').value.trim().toLocaleLowerCase();
    const box = document.getElementById('lrSearchResults');
    if (!keyword) { box.innerHTML = '<div class="lr-empty">先输入要查找的关键词。</div>'; return; }
    const items = (readChatThreads()[activeChatContactId] || []);
    const hits = [];
    items.forEach((m, index) => { if (safeText(m.text).toLocaleLowerCase().includes(keyword)) hits.push({m,index}); });
    box.innerHTML = hits.length ? hits.slice(-30).reverse().map(({m,index}) => '<button class="lr-search-hit" type="button" data-lr-hit="' + index + '"><small>' + (m.role === 'user' ? '我' : esc(contactById(activeChatContactId)?.name || '联系人')) + ' · ' + esc(m.at ? new Date(m.at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '') + '</small>' + esc(safeText(m.text).slice(0,180)) + '</button>').join('') : '<div class="lr-empty">没有找到包含「' + esc(keyword) + '」的消息。</div>';
  }

  function deleteCurrentThread() {
    if (!activeChatContactId) return;
    if (!confirm('确定要删除与「' + (chatShownName(contactById(activeChatContactId)) || '这位联系人') + '」的全部聊天记录吗？删除后无法恢复。')) return;
    const all = readChatThreads(); all[activeChatContactId] = []; writeChatThreads(all);
    document.getElementById('lrSearchResults').innerHTML = '<div class="lr-empty">聊天记录已删除。</div>';
    renderChat(); toast('聊天记录已删除');
  }

  function deleteCurrentContact() {
    if (!activeChatContactId) return;
    const id = activeChatContactId, p = contactById(id);
    if (!confirm('确定要从聊天列表删除「' + (chatShownName(p) || '这位联系人') + '」吗？这会同时删除聊天记录和该联系人的聊天设置；人物资料仍会保留，可之后重新添加。')) return;
    writeChatContacts(readChatContacts().filter(x => x !== id));
    const threads = readChatThreads(); delete threads[id]; writeChatThreads(threads);
    const metas = readChatMeta(); delete metas[id]; localStorage.setItem(CHAT_META_KEY, JSON.stringify(metas));
    activeChatContactId = ''; closeChatSettings(); renderChat(); toast('联系人已从聊天列表移除');
  }

  function toggleCurrentBlock() {
    if (!activeChatContactId) return;
    const meta = chatMeta(activeChatContactId); meta.blocked = !meta.blocked; writeChatMeta(activeChatContactId, meta);
    fillExtraUI(); renderChat();
    toast(meta.blocked ? '已拉黑该联系人；可以随时取消拉黑' : '已取消拉黑');
  }

  async function upgradedSendChatMessage() {
    const input = $('chatInput'), textValue = input.value.trim();
    if (!textValue || !activeChatContactId) return;
    const id = activeChatContactId, p = contactById(id), meta = chatMeta(id);
    if (!p) return;
    if (meta.blocked) { toast('这位联系人已被拉黑，请先取消拉黑'); return; }
    const threads = readChatThreads(), items = threads[id] || [];
    items.push({role:'user', text:textValue, at:Date.now()}); threads[id] = items; writeChatThreads(threads);
    input.value = ''; renderChat();
    if (!state.apiBase || !state.apiKey || !state.apiModel) { toast('请先在设置中连接 API'); return; }
    const send = $('chatSend'); send.disabled = true; send.textContent = '…'; aiBusy = true;
    try {
      const memoryCount = clampMemory(meta.memoryCount || 16);
      const recent = items.slice(-memoryCount).map(m => ({role:m.role === 'assistant' ? 'assistant' : 'user', content:m.text}));
      const persona = (state.selfPersonas || []).find(x => x.id === meta.personaId) || null;
      const world = (state.worlds || []).find(x => x.id === meta.worldId) || null;
      const personaText = persona ? `用户当前人设：${persona.name || ''}；身份：${persona.role || ''}；性格：${persona.personality || ''}；外貌：${persona.appearance || ''}；说话方式：${persona.speech || ''}；背景：${persona.background || ''}。请尊重该人设，但不要替用户决定行动、台词或情绪。` : '用户以本人身份参与聊天，不要替用户决定行动、台词或情绪。';
      const worldText = world ? `当前启用世界书「${world.name || ''}」：${world.description || ''}；地点：${world.locations || ''}；规则：${world.rules || ''}。请将这些设定作为背景资料，保持一致。` : '';
      const system = `你正在 LOVE RECORD 中扮演联系人「${p.name}」。身份：${p.role || ''}。性格：${p.personality || ''}。外貌：${p.appearance || ''}。说话方式：${p.speech || ''}。背景：${p.background || ''}。角色规则：${p.instructions || '保持人物一致，自然聊天，不要替用户决定行动或情绪。'}。${personaText}${worldText}请像真实聊天对象一样自然回复，不要输出 JSON。`;
      const response = await fetchTimeout(state.apiBase.replace(/\/+$/,'') + '/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},
        body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:system},...recent],stream:false})
      }, 25000);
      const raw = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + raw.slice(0,180));
      const data = JSON.parse(raw), reply = extractAIText(data);
      if (!reply) throw new Error('没有收到有效回复');
      const latest = readChatThreads(), thread = latest[id] || [];
      thread.push({role:'assistant',text:reply,at:Date.now()}); latest[id] = thread; writeChatThreads(latest);
    } catch (error) { toast('发送失败：' + (error.message || 'API 错误')); }
    finally { aiBusy = false; send.disabled = false; send.textContent = '发送'; renderChat(); }
  }

  function saveExtendedSettings() {
    editingChatMeta.remark = $('chatRemarkInput').value.trim();
    editingChatMeta.personaId = $('lrPersonaSelect').value;
    editingChatMeta.worldId = $('lrWorldSelect').value;
    editingChatMeta.memoryCount = clampMemory($('lrMemoryCount').value);
    $('lrMemoryCount').value = editingChatMeta.memoryCount;
    writeChatMeta(activeChatContactId, editingChatMeta);
    closeChatSettings(); toast('聊天设置已保存 ♡');
  }

  function init() {
    addStyles(); ensureExtraUI();
    const originalRender = renderChat;
    renderChat = function () { originalRender(); applyMessageAvatars(); document.querySelectorAll('[data-chat-open]').forEach(card => { const id = card.dataset.chatOpen; if (chatMeta(id).blocked) { const info = card.querySelector('.chat-contact-info'); if (info && !info.querySelector('.lr-blocked-tag')) { const tag = document.createElement('span'); tag.className='lr-blocked-tag'; tag.textContent='已拉黑'; info.appendChild(tag); } } }); };
    const originalOpenSettings = openChatSettings;
    openChatSettings = function () { originalOpenSettings(); fillExtraUI(); };
    $('chatSaveSettings').onclick = saveExtendedSettings;
    sendChatMessage = upgradedSendChatMessage;
    $('chatSend').onclick = sendChatMessage;
    // Keep blocked state visible and prevent opening a new message flow from accidental send.
    fillExtraUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
