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
      #${EXTRA_ID} .lr-narration-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:19px!important;border:1px solid rgba(183,150,197,.28)!important;background:linear-gradient(135deg,#fff 0%,#faf5fc 58%,#f4edf8 100%)!important;box-shadow:0 9px 24px rgba(113,85,128,.07)}
      #${EXTRA_ID} .lr-narration-heading{display:flex;align-items:center;gap:11px}
      #${EXTRA_ID} .lr-narration-heading h3{margin:0 0 5px;font-size:17px;font-weight:500;color:#594a62}
      #${EXTRA_ID} .lr-narration-heading p{margin:0;color:#988b9e;font-size:12px;line-height:1.5}
      #${EXTRA_ID} .lr-narration-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:13px;background:#eee3f3;color:#9b7cab;font-size:22px;flex:none}
      #${EXTRA_ID} .lr-narration-footnote{margin:12px 0 0 47px;color:#aa9eaf;font-size:11px;line-height:1.5}
      #${EXTRA_ID} .lr-switch{display:flex!important;align-items:center;gap:8px;padding:8px 10px;border-radius:99px;background:#f0e8f4;color:#8b7396;font-size:11px;white-space:nowrap;flex:none;cursor:pointer}
      #${EXTRA_ID} .lr-switch input{position:absolute;opacity:0;width:1px;height:1px}
      #${EXTRA_ID} .lr-switch-track{width:43px;height:25px;border-radius:30px;background:#d8d0dc;position:relative;transition:.2s;flex:none}
      #${EXTRA_ID} .lr-switch-track:after{content:'';position:absolute;width:19px;height:19px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0002;transition:.2s}
      #${EXTRA_ID} .lr-switch input:checked+.lr-switch-track{background:#b796c5}
      #${EXTRA_ID} .lr-switch input:checked+.lr-switch-track:after{transform:translateX(18px)}
      #${EXTRA_ID} .lr-narration-card.is-off{background:linear-gradient(135deg,#fff,#faf8fb)!important}
      @media(max-width:390px){#${EXTRA_ID} .lr-narration-card{align-items:flex-start;flex-direction:column}#${EXTRA_ID} .lr-narration-footnote{margin-left:0}}

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
      #${EXTRA_ID} textarea.lr-custom-css{width:100%;min-height:190px;box-sizing:border-box;border:1px solid var(--line);border-radius:15px;background:#fbf9fc;color:var(--ink);padding:12px;font:12px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace;resize:vertical}
      .chat-message-row.lr-search-highlight .chat-bubble{outline:2px solid #b99ac7;box-shadow:0 0 0 5px rgba(185,154,199,.16)}
      .chat-message-avatar img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
      .lr-inline-narration{font-style:italic;color:inherit;opacity:.78}
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
      <section class="lr-setting-card lr-narration-card" id="lrChatNarrationCard">
        <div class="lr-narration-copy">
          <div class="lr-narration-heading"><span class="lr-narration-icon">✧</span><div><h3>旁白模式</h3><p>让对话带上动作、神态与环境描写</p></div></div>
          <div class="lr-narration-footnote">关闭后只保留角色对话，不生成旁白。</div>
        </div>
        <label class="lr-switch" for="lrChatNarration" aria-label="旁白模式开关">
          <span class="lr-switch-state">旁白开启</span>
          <input id="lrChatNarration" type="checkbox" checked>
          <span class="lr-switch-track"></span>
        </label>
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
    const narration = document.getElementById('lrChatNarration');
    const narrationCard = document.getElementById('lrChatNarrationCard');
    if (narration) { narration.checked = meta.narrationEnabled !== false; if (narrationCard) { narrationCard.classList.toggle('is-off', !narration.checked); const label=narrationCard.querySelector('.lr-switch-state'); if(label) label.textContent=narration.checked?'旁白开启':'旁白关闭'; } }
    if (narration && !narration.dataset.lrBound) { narration.dataset.lrBound='1'; narration.addEventListener('change',()=>{ if(narrationCard){narrationCard.classList.toggle('is-off',!narration.checked);const label=narrationCard.querySelector('.lr-switch-state');if(label)label.textContent=narration.checked?'旁白开启':'旁白关闭';} const id=activeChatContactId;if(id){const latest=chatMeta(id);latest.narrationEnabled=!!narration.checked;writeChatMeta(id,latest);editingChatMeta={...editingChatMeta,narrationEnabled:!!narration.checked};} }); }
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
    const metas = readChatMeta(); delete metas[id]; localStorage.setItem('love-record-chat-meta-v2', JSON.stringify(metas));
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
    const narrationOn = meta.narrationEnabled !== false;
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
      const narrationRule = narrationOn ? '旁白模式【开启】：可少量穿插动作、神态、语气或环境描写，必须用 [[NARRATION]]...[[/NARRATION]] 包裹，旁白会在同一聊天气泡内以斜体显示；角色台词放在标记外，不要每条都加旁白。' : '旁白模式【关闭，最高优先级】：只输出角色直接说出口的台词；禁止动作、神态、心理、环境、舞台指示、括号内容、第三人称叙述，禁止输出任何 [[NARRATION]] 标记；不要模仿历史消息中的旁白。';
      const system = `你正在 LOVE RECORD 中扮演联系人「${p.name}」。身份：${p.role || ''}。性格：${p.personality || ''}。外貌：${p.appearance || ''}。说话方式：${p.speech || ''}。背景：${p.background || ''}。角色规则：${p.instructions || '保持人物一致，自然聊天，不要替用户决定行动或情绪。'}。${narrationRule}${personaText}${worldText}像熟悉的人一样自然聊天，优先回应重点，不复述、不客服式总结、不强迫反问；允许短句、停顿、玩笑和自然转移话题。不要输出 JSON。按对话节奏自然分成几条消息，不为凑数拆句。`;
      const response = await fetchTimeout(state.apiBase.replace(/\/+$/,'') + '/chat/completions', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},
        body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:system},...recent],stream:false})
      }, 25000);
      const raw = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + raw.slice(0,180));
      const data = JSON.parse(raw), reply = extractAIText(data);
      if (!reply) throw new Error('没有收到有效回复');
      let safeReply = String(reply);
      if (!narrationOn) safeReply = safeReply.replace(/\[\[NARRATION\]\][\s\S]*?\[\[\/NARRATION\]\]/gi,'').replace(/[（(][^）)]{1,120}[）)]/g,'').trim();
      const latest = readChatThreads(), thread = latest[id] || [];
      const receivedAt = Date.now();
      const paragraphs = safeReply.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n+/).map(part => part.trim()).filter(Boolean);
      const replyParts = paragraphs.length > 1 ? paragraphs : safeReply.replace(/\r\n?/g, '\n').split('\n').map(part => part.trim()).filter(Boolean);
      const transferPattern = /(?:【\s*)?(?:向你转账|给你转账|转账给你|给你转了|转给你)\s*(RM|MYR|RMB|CNY|人民币|¥|￥)?\s*([\d,]+(?:\.\d{1,2})?)\s*(RM|MYR|RMB|CNY|人民币|元|¥|￥)?\s*(?:】)?/i;
      replyParts.forEach(part => {
        const match = part.match(transferPattern);
        if (!match) {
          thread.push({role:'assistant',text:part,at:receivedAt});
          return;
        }
        const before = part.slice(0, match.index).trim();
        const after = part.slice(match.index + match[0].length).trim();
        const currencyRaw = (match[1] || match[3] || 'RM').toUpperCase();
        const currency = /^(RMB|CNY|人民币|元|¥|￥)$/.test(currencyRaw) ? '¥' : 'RM';
        const amount = Number(match[2].replace(/,/g, ''));
        if (before) thread.push({role:'assistant',text:before,at:receivedAt});
        if (Number.isFinite(amount) && amount > 0) {
          thread.push({role:'assistant',kind:'transfer',amount:amount.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}),currency,note:'给你的小心意',text:'转账 '+currency+' '+amount.toFixed(2),at:receivedAt});
        } else {
          thread.push({role:'assistant',text:part,at:receivedAt});
        }
        if (after) thread.push({role:'assistant',text:after,at:receivedAt});
      });
      latest[id] = thread; writeChatThreads(latest);
    } catch (error) { toast('发送失败：' + (error.message || 'API 错误')); }
    finally { aiBusy = false; send.disabled = false; send.textContent = '发送'; renderChat(); }
  }

  function saveExtendedSettings() {
    editingChatMeta.remark = $('chatRemarkInput').value.trim();
    editingChatMeta.personaId = $('lrPersonaSelect').value;
    editingChatMeta.worldId = $('lrWorldSelect').value;
    editingChatMeta.memoryCount = clampMemory($('lrMemoryCount').value);
    editingChatMeta.narrationEnabled = $('lrChatNarration').checked;
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
