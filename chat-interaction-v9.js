/* LOVE RECORD V24 · Chat interaction v9
   Per-message long-press deletion, transient undo, per-contact chat styling,
   auto long-term memory summaries, and legacy self-contact cleanup.
*/
(function () {
  'use strict';
  if (window.__lrChatInteractionV9) return;
  window.__lrChatInteractionV9 = true;

  const $ = id => document.getElementById(id);
  const safe = value => String(value == null ? '' : value);
  let selected = new Set();
  let lastDeleted = null;
  let undoTimer = null;
  let requestBusy = false;
  let lastContactId = '';
  let pressTimer = null;
  let longPressed = false;
  let suppressClick = false;

  function activeId() {
    return typeof activeChatContactId !== 'undefined' ? activeChatContactId : '';
  }
  function threadFor(id) {
    const all = readChatThreads();
    return Array.isArray(all[id]) ? all[id] : [];
  }
  function writeThread(id, messages) {
    const all = readChatThreads();
    all[id] = messages;
    writeChatThreads(all);
  }
  function currentMeta(id) {
    return typeof chatMeta === 'function' ? chatMeta(id) : {};
  }
  function persistMeta(id, meta) {
    if (typeof saveChatMetaSafely === 'function') return saveChatMetaSafely(id, meta);
    writeChatMeta(id, meta);
    return Promise.resolve(meta);
  }
  function clampCount(value, fallback) {
    const n = parseInt(value, 10);
    return Math.min(100, Math.max(1, Number.isFinite(n) ? n : fallback));
  }
  function clampReplyCount(value) {
    const n = parseInt(value, 10);
    return Math.min(10, Math.max(1, Number.isFinite(n) ? n : 4));
  }

  function formatChatDateTime(value) {
    const time = Number(value);
    if (!Number.isFinite(time) || time <= 0) return '时间未知';
    const d = new Date(time);
    return d.toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  }
  function chatTimeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '设备本地时区'; }
    catch (_) { return '设备本地时区'; }
  }
  function currentChatClock() {
    const now = Date.now();
    return `当前真实设备时间：${formatChatDateTime(now)}；时区：${chatTimeZone()}。`;
  }

  function cleanupLegacySelfContact() { /* Non-destructive: preserve all user-created contacts and chat history. */ }

  function addStyles() {
    if ($('lr-chat-v9-style')) return;
    const style = document.createElement('style');
    style.id = 'lr-chat-v9-style';
    style.textContent = `
      .chat-compose{display:flex;align-items:flex-end;gap:8px}
      #chatSend{flex:0 0 auto}
      #lrAskAI{width:46px;height:46px;flex:0 0 46px;border:0;border-radius:16px;background:#b99ac7;color:#fff;font-size:25px;line-height:1;display:grid;place-items:center;box-shadow:0 5px 14px rgba(125,94,143,.16)}
      #lrAskAI:disabled{opacity:.5}
      #lrChatMessageTools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 2px 9px}
      #lrChatMessageTools[hidden]{display:none!important}
      #lrChatMessageTools button{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:7px 12px;font-size:12px}
      #lrChatMessageTools .lr-delete-selected{color:#9a6575;border-color:#d9bfc8}
      #lrChatMessageTools .lr-selection-count{font-size:11px;color:var(--muted);margin-right:auto}
      .chat-message-row{touch-action:pan-y}
      .chat-message-row.lr-selected{background:rgba(185,154,199,.13);outline:2px solid rgba(185,154,199,.72);outline-offset:3px;border-radius:17px}
      .lr-typing-row{display:flex;align-items:center;gap:9px;align-self:flex-start;order:9999;position:relative;z-index:1;margin:2px 0 5px 42px;max-width:calc(100% - 54px);color:var(--muted);font-size:12px;padding:8px 12px;background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:15px;box-shadow:0 3px 12px rgba(60,45,70,.04)}
      .lr-typing-dots{letter-spacing:2px;animation:lrTypingPulse 1s ease-in-out infinite}
      @keyframes lrTypingPulse{0%,100%{opacity:.35}50%{opacity:1}}
      #lrUndoToast{position:relative;display:flex;justify-content:center;align-items:center;gap:10px;margin:0 auto 8px;padding:7px 12px;width:max-content;max-width:90%;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 4px 18px rgba(70,50,80,.08);font-size:12px;color:var(--muted)}
      #lrUndoToast[hidden]{display:none!important}
      #lrUndoToast button{border:0;background:transparent;color:#8c7099;font:inherit;font-weight:600}
      #chatMessages .chat-bubble.user{background:var(--lr-user-bubble,#b99ac7)!important;color:var(--lr-user-text,#fff)!important;border-radius:var(--lr-bubble-radius,22px)!important}
      #chatMessages .chat-bubble.ai{background:var(--lr-ai-bubble,#fff)!important;color:var(--lr-ai-text,#28242b)!important;border-radius:var(--lr-bubble-radius,22px)!important}
      #chatSettingsScreen .lr-v9-card{background:rgba(255,255,255,.8);border:1px solid var(--line);border-radius:22px;padding:16px;margin:14px 0}
      #chatSettingsScreen .lr-v9-card h3{font-size:17px;font-weight:500;margin:0 0 12px}
      #chatSettingsScreen .lr-v9-card label{display:block;margin:10px 0 6px;color:var(--muted);font-size:13px}
      #chatSettingsScreen .lr-v9-card input[type=color]{width:100%;height:44px;border:1px solid var(--line);border-radius:12px;background:#fff;padding:4px}
      #chatSettingsScreen .lr-v9-card input[type=number],#chatSettingsScreen .lr-v9-card textarea{box-sizing:border-box;width:100%;border:1px solid var(--line);border-radius:14px;background:#fff;padding:11px 12px;color:var(--ink);font:inherit}
      #chatSettingsScreen .lr-v9-card textarea{min-height:120px;resize:vertical}
      #chatSettingsScreen .lr-v9-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      #chatSettingsScreen .lr-v9-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      #chatSettingsScreen .lr-v9-actions .btn{flex:1;min-width:120px}
      #lrLongMemoryPanel[hidden]{display:none!important}
      .dark-mode #lrChatMessageTools button,.dark-mode #lrUndoToast{background:#211c24;color:#f4eef6;border-color:#3a323e}
      @media(max-width:420px){#lrAskAI{width:44px;height:44px;flex-basis:44px;border-radius:15px}#chatSettingsScreen .lr-v9-card{padding:14px}}
    `;
    document.head.appendChild(style);
  }

  function ensureControls() {
    const compose = document.querySelector('#chatConversation .chat-compose');
    if (!compose) return;
    let tools = $('lrChatMessageTools');
    if (!tools) {
      tools = document.createElement('div');
      tools.id = 'lrChatMessageTools';
      tools.hidden = true;
      tools.innerHTML = `
        <span class="lr-selection-count" id="lrSelectionCount">已选择 0 条</span>
        <button type="button" class="lr-delete-selected" id="lrDeleteSelected">删除所选</button>
        <button type="button" id="lrCancelSelection">取消</button>`;
      compose.parentNode.insertBefore(tools, compose);
      $('lrDeleteSelected').addEventListener('click', deleteSelected);
      $('lrCancelSelection').addEventListener('click', clearSelection);
    }
    let undo = $('lrUndoToast');
    if (!undo) {
      undo = document.createElement('div');
      undo.id = 'lrUndoToast';
      undo.hidden = true;
      undo.innerHTML = '<span>消息已删除</span><button type="button" id="lrUndoButton">撤销</button>';
      compose.parentNode.insertBefore(undo, compose);
      $('lrUndoButton').addEventListener('click', undoDelete);
    }
    if (!$('lrAskAI')) {
      const ask = document.createElement('button');
      ask.type = 'button';
      ask.id = 'lrAskAI';
      ask.textContent = '✦';
      ask.title = '让 AI 回复';
      ask.setAttribute('aria-label', '让 AI 回复');
      ask.addEventListener('click', requestAIReply);
      const send = $('chatSend');
      if (send) send.insertAdjacentElement('afterend', ask);
    }
    refreshSelectionUI();
  }

  function refreshSelectionUI() {
    const tools = $('lrChatMessageTools');
    if (!tools) return;
    const count = selected.size;
    tools.hidden = count === 0;
    const countNode = $('lrSelectionCount');
    if (countNode) countNode.textContent = `已选择 ${count} 条`;
  }

  function markRows() {
    const host = $('chatMessages');
    if (!host) return;
    host.querySelectorAll('.chat-message-row').forEach((row, index) => {
      row.dataset.lrMessageIndex = String(index);
      row.classList.toggle('lr-selected', selected.has(index));
      row.setAttribute('aria-label', selected.has(index) ? '已选择消息' : '长按选择消息');
    });
  }

  function clearSelection() {
    selected.clear();
    markRows();
    refreshSelectionUI();
  }

  function showUndo() {
    const box = $('lrUndoToast');
    if (!box) return;
    box.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      if (box) box.hidden = true;
      lastDeleted = null;
    }, 6500);
  }

  function deleteSelected() {
    const id = activeId();
    if (!id || !selected.size) return;
    const before = threadFor(id);
    const indexes = [...selected].filter(i => i >= 0 && i < before.length).sort((a,b) => a-b);
    if (!indexes.length) return clearSelection();
    const removed = indexes.map(index => ({index, message: before[index]}));
    if (!confirm(indexes.length === 1 ? '确定删除这条消息吗？' : `确定删除选中的 ${indexes.length} 条消息吗？`)) return;
    const removeSet = new Set(indexes);
    const after = before.filter((_, index) => !removeSet.has(index));
    try {
      writeThread(id, after);
      lastDeleted = {contactId:id, before, after, removed};
      selected.clear();
      renderChat();
      ensureControls();
      refreshSelectionUI();
      showUndo();
    } catch (error) {
      toast('删除失败：请检查本地储存空间');
    }
  }

  function undoDelete() {
    if (!lastDeleted || lastDeleted.contactId !== activeId()) return;
    try {
      const current = threadFor(lastDeleted.contactId);
      const restored = current.slice();
      const missing = lastDeleted.removed.slice().sort((a,b)=>a.index-b.index);
      missing.forEach(item => restored.splice(Math.min(item.index, restored.length), 0, item.message));
      writeThread(lastDeleted.contactId, restored);
      lastDeleted = null;
      clearTimeout(undoTimer);
      if ($('lrUndoToast')) $('lrUndoToast').hidden = true;
      renderChat();
      toast('已恢复刚才删除的消息 ♡');
    } catch (_) {
      toast('恢复失败，请稍后重试');
    }
  }

  function splitAIReply(value, maxBubbles) {
    const text = safe(value).replace(/\r\n?/g, '\n').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    if (!text) return [];
    let parts = text.split(/\s*(?:\|\|\||\n\s*\n+)\s*/g).map(x => x.trim()).filter(Boolean);
    if (parts.length === 1 && /\n/.test(text)) parts = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
    // If the model ignored the bubble marker, group complete sentences naturally;
    // avoid chopping at commas or splitting narration protocol blocks.
    if (parts.length === 1 && text.length > 58 && !/\[\[NARRATION\]\]|\[\[\/NARRATION\]\]/i.test(text)) {
      const sentences = text.match(/[^。！？!?]+[。！？!?]?/g)?.map(x => x.trim()).filter(Boolean) || [text];
      if (sentences.length > 1) {
        const grouped = []; let chunk = '';
        for (const sentence of sentences) {
          if (chunk && (chunk.length + sentence.length > 64 || chunk.length >= 42)) { grouped.push(chunk.trim()); chunk = ''; }
          chunk += sentence;
        }
        if (chunk.trim()) grouped.push(chunk.trim());
        if (grouped.length > 1) parts = grouped;
      }
    }
    const limit = clampReplyCount(maxBubbles || 4);
    if (parts.length > limit) parts = [...parts.slice(0, limit - 1), parts.slice(limit - 1).join(' ')];
    return parts.length ? parts : [text];
  }

  function normalizeNarrationReply(value, narrationEnabled) {
    let text = safe(value).replace(/\r\n?/g, '\n').trim();
    if (!narrationEnabled) {
      // Remove explicitly marked narration and common standalone action/thought asides.
      text = text.replace(/\[\[NARRATION\]\][\s\S]*?\[\[\/NARRATION\]\]/gi, '');
      text = text.replace(/(?:^|\n)\s*[（(][^）)\n]{1,100}[）)]\s*(?=\n|$)/g, '\n');
      text = text.replace(/\n{3,}/g, '\n\n').trim();
      return text;
    }
    // Convert common parenthetical stage directions into renderer-readable inline italics.
    text = text.replace(/\[\[NARRATION\]\]([\s\S]*?)\[\[\/NARRATION\]\]/gi, (_, n) => `[[NARRATION]]${n.trim()}[[/NARRATION]]`);
    return text;
  }

  function addTyping(label) {
    const host = $('chatMessages');
    if (!host || $('lrTypingIndicator')) return;
    const row = document.createElement('div');
    row.id = 'lrTypingIndicator';
    row.className = 'lr-typing-row';
    row.innerHTML = `<span>${label || '正在输入'}</span><span class="lr-typing-dots">•••</span>`;
    host.appendChild(row);
    requestAnimationFrame(() => { if (row.isConnected) { host.scrollTop = host.scrollHeight; row.scrollIntoView?.({block:'nearest',behavior:'auto'}); } });
  }
  function removeTyping() {
    const node = $('lrTypingIndicator');
    if (node) node.remove();
  }

  function queueUserMessage() {
    const input = $('chatInput');
    const text = input && input.value.trim();
    const id = activeId();
    if (!text || !id) return;
    const person = contactById(id);
    if (!person) return;
    const meta = currentMeta(id);
    if (meta.blocked) { toast('这位联系人已被拉黑，请先取消拉黑'); return; }
    const all = readChatThreads();
    const thread = Array.isArray(all[id]) ? all[id] : [];
    thread.push({role:'user', text, at:Date.now()});
    all[id] = thread;
    try {
      writeChatThreads(all);
      input.value = '';
      selected.clear();
      renderChat();
      input.focus();
    } catch (error) {
      toast('消息未能保存：本地储存空间可能不足');
    }
  }

  async function maybeSummarizeMemory(id) {
    const meta = currentMeta(id);
    const thread = threadFor(id);
    const threshold = clampCount(meta.autoMemoryCount || 15, 15);
    let summarizedThrough = Math.max(0, parseInt(meta.memorySummarizedThrough, 10) || 0);
    if (summarizedThrough > thread.length) summarizedThrough = 0;
    if (thread.length - summarizedThrough < threshold) return;
    const newItems = thread.slice(summarizedThrough);
    const oldMemory = safe(meta.longTermMemory).trim();
    const transcript = newItems.map(m => `[消息时间：${formatChatDateTime(m.at)}] ${m.role === 'assistant' ? '我（角色）' : '用户'}：${safe(m.text)}`).join('\n');
    addTyping('正在整理长期记忆');
    try {
      const character = contactById(id);
      const summarySystem = `你是 LOVE RECORD 角色「${character?.name || '当前角色'}」的长期记忆整理器。请将已有记忆与新增聊天整合为一份准确、可持续更新的长期记忆。重要：记忆主体必须采用角色本人的第一人称视角，用“我”记录角色自己做过、说过、感受到或明确知道的事；用户的行动与偏好要清楚写成“用户本人”，不能把用户经历写成角色亲历。只记录聊天明确出现的稳定偏好、人物关系、重要经历、约定、未完成事项；不推测、不编造。每条新增聊天都带有真实发送时间，必须保留重要事件的完整年月日，必要时保留时分；“今天/昨天/明天/上周”等相对日期，必须以该条消息自身的【消息时间】为基准换算为绝对日期，不得以总结当天或当前时间重新解释，绝不能把昨天发生的事情改写成今天。若缺少消息时间或日期无法确定，明确标注“日期未确认”，不要猜测。旧记忆中已发生的事要保留为历史，不要写成正在发生。按“人物关系、用户信息、我经历的事件、共同经历与约定、持续事项、重要日期”清晰分区，控制在 2500 个汉字以内，只输出记忆正文。`;
      const response = await fetchTimeout(
        state.apiBase.replace(/\/+$/,'') + '/chat/completions',
        {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},
          body:JSON.stringify({
            model:state.apiModel,
            messages:[
              {role:'system',content:summarySystem},
              {role:'user',content:`${currentChatClock()}\n已有长期记忆：\n${oldMemory || '（暂无）'}\n\n本次新增聊天（每条消息的时间戳是解释日期的唯一依据）：\n${transcript}\n\n请按角色第一人称视角整合为更新后的长期记忆，保留重要事件绝对日期。`}
            ],
            stream:false
          })
        },
        30000
      );
      const raw = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = extractAIText(JSON.parse(raw));
      if (!result) throw new Error('总结内容为空');
      const latest = currentMeta(id);
      latest.longTermMemory = result.trim().slice(0, 9000);
      latest.memorySummarizedThrough = thread.length;
      latest.lastMemorySummaryAt = Date.now();
      await persistMeta(id, latest);
      toast('长期记忆已更新 ♡');
      const area = $('lrLongMemoryText');
      if (area && activeId() === id) area.value = latest.longTermMemory;
    } catch (error) {
      console.warn('[LOVE RECORD] memory summary failed:', error);
      toast('本次长期记忆总结未完成，下次聊天时会再尝试');
    } finally {
      removeTyping();
    }
  }

  async function requestAIReply() {
    const id = activeId();
    if (!id || requestBusy) return;
    const person = contactById(id);
    if (!person) return;
    const meta = currentMeta(id);
    if (meta.blocked) { toast('这位联系人已被拉黑，请先取消拉黑'); return; }
    if (!state.apiBase || !state.apiKey || !state.apiModel) {
      toast('请先在设置中连接 API');
      return;
    }
    const thread = threadFor(id);
    const requestBoundary = thread.length;
    const lastAssistant = thread.map(m => m.role === 'assistant' ? 1 : 0).lastIndexOf(1);
    const pending = thread.slice(lastAssistant + 1).some(m => m.role === 'user');
    if (!pending) {
      toast('先发送一条或多条消息，再点击 ✦ 让 AI 回复');
      return;
    }
    selected.clear();
    requestBusy = true;
    if (typeof aiBusy !== 'undefined') aiBusy = true;
    if ($('lrAskAI')) $('lrAskAI').disabled = true;
    addTyping();
    try {
      const memoryCount = clampCount(meta.memoryCount || 16, 16);
      const recent = [];
      for (const m of thread.slice(-memoryCount)) {
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        const timeTag = `【消息时间：${formatChatDateTime(m.at)}】\n`;
        if (m.kind === 'image' && m.attachmentId) {
          let dataUrl = '';
          try { dataUrl = await window.lrLoadChatAttachmentDataUrl?.(m.attachmentId) || ''; } catch (e) { console.warn('[LOVE RECORD] image context load failed', e); }
          const parts = [{type:'text', text: timeTag + safe(m.text || '[用户发送了一张图片]') + (dataUrl ? '' : '（图片文件暂时无法读取，请勿猜测图片内容）')}];
          if (dataUrl) parts.push({type:'image_url', image_url:{url:dataUrl, detail:'auto'}});
          recent.push({role, content:parts});
        } else {
          recent.push({role, content:timeTag + safe(m.text)});
        }
      }
      const persona = (state.selfPersonas || []).find(x => x.id === meta.personaId) || null;
      const world = (state.worlds || []).find(x => x.id === meta.worldId) || null;
      const personaText = persona
        ? `用户当前人设：${persona.name || ''}；身份：${persona.role || ''}；性格：${persona.personality || ''}；外貌：${persona.appearance || ''}；说话方式：${persona.speech || ''}；背景：${persona.background || ''}。请尊重该人设，但不要替用户决定行动、台词或情绪。`
        : '用户以本人身份参与聊天，不要替用户决定行动、台词或情绪。';
      const worldText = world
        ? `当前启用世界书「${world.name || ''}」：${world.description || ''}；地点：${world.locations || ''}；规则：${world.rules || ''}。请将这些设定作为背景资料，保持一致。`
        : '';
      const longMemoryText = safe(meta.longTermMemory).trim()
        ? `以下是你需要参考的长期聊天记忆。记忆中标注的年月日属于已经发生的历史时间，必须原样尊重；不要把旧记忆里的“昨天/今天”按当前日期重新解释。角色只把自己确实亲历、被告知或明确知道的内容当作自己的记忆：\n${safe(meta.longTermMemory)}\n`
        : '';
      // Read stickers in the real AI reply handler. The older sendChatMessage path is not used by the ✦ reply button.
      let stickerSyncOn = true;
      try { const pref = localStorage.getItem('love-record-ai-sticker-sync-v1'); stickerSyncOn = pref === null || pref === '1'; } catch (_) {}
      let savedStickers = [];
      if (stickerSyncOn) {
        try {
          if (typeof window.lrGetStickerItems === 'function') savedStickers = await window.lrGetStickerItems();
          if (!Array.isArray(savedStickers) || !savedStickers.length) {
            const localItems = JSON.parse(localStorage.getItem('love-record-stickers-v1') || '[]');
            if (Array.isArray(localItems)) savedStickers = localItems;
          }
        } catch (stickerError) { console.warn('[LOVE RECORD] sticker library read failed in actual reply path', stickerError); }
      }
      savedStickers = Array.isArray(savedStickers) ? savedStickers.filter(x => x && x.id != null && x.attachmentId != null) : [];
      const stickerListText = savedStickers.map(x => `${x.id}（分类：${x.category || '自定义'}${x.name ? '；名称：' + x.name : ''}）`).join('；');
      const stickerPrompt = !stickerSyncOn ? '用户已关闭 AI 表情包同步，不要发送表情包。' : savedStickers.length
        ? `用户真实收藏的表情包如下：${stickerListText}。你可以根据角色当下情绪和聊天语境自然、自主地发送一张。若决定发送，必须输出机器标记 [[LR_STICKER:收藏ID]]，ID 必须逐字取自清单。绝不能把文件名或表情包描述当成图片发送。用户明确要求测试或发送表情包时，必须选择一张。`
        : '当前没有可用的已收藏表情包，不要编造图片或文件名。';
      const system = `你正在 LOVE RECORD 中扮演联系人「${person.name}」。身份：${person.role || ''}。性格：${person.personality || ''}。外貌：${person.appearance || ''}。说话方式：${person.speech || ''}。背景：${person.background || ''}。角色规则：${person.instructions || '保持人物一致，自然聊天，不要替用户决定行动或情绪。'}。${meta.narrationEnabled===false?'【旁白模式：关闭】这是硬性规则：只允许角色直接说出口的台词。严禁输出任何动作、表情、心理、环境、第三人称叙述、括号内容或舞台提示。':'【旁白模式：开启】旁白必须以内嵌标记输出，绝不能把旁白单独写成括号段落。动作、神态、心理或环境描写必须包在 [[NARRATION]] 和 [[/NARRATION]] 之间，例如：[[NARRATION]]他抬眼看了你一眼，唇边带着一点笑意。[[/NARRATION]]「知道了。」旁白不是必需品，不要为了展示旁白而每轮硬加。只有动作、神态或环境细节确实能增加临场感时才偶尔写一小笔；允许连续几轮完全没有旁白。旁白应像自然发生的细节，避免小说式铺陈、重复描写动作或每条消息都用括号开头。'}。${personaText}${worldText}${longMemoryText}${stickerPrompt}${currentChatClock()} 请严格遵守时间与日期：每条历史消息前的【消息时间】是真实发送时刻；必须按每条消息自己的时间戳理解“今天、昨天、明天、前天、上周”等说法，不能把旧消息里的“昨天”按现在重新计算，也不能把昨天的事情说成今天发生。当前时钟只用于判断现在的时段和当前时间，不得覆盖历史消息时间。除非用户明确说时间已过去，或真实消息时间戳确实显示时间变化，否则不要擅自跳过数小时或数天；若日期/时间不确定，先自然询问，不要编造。聊天风格要求：把这段互动当作真实、持续发生的私人聊天，而不是问答客服或剧情任务。先自然接住用户这句话里最重要的情绪、事实或话题，不要复述整句话来证明你听见了；不要每轮都用‘我理解’‘听起来’‘你现在感觉怎么样’等模板开头，也不要习惯性在结尾抛问题。不要把普通聊天变成健康科普、人生建议或心理分析，除非用户明确在求助。回复长度跟随情境：日常闲聊可以短，值得展开时再多说；允许自然的语气变化、玩笑、轻微吐槽、停顿和主动分享，但不能凭空编造共同经历。参考最近多轮对话，不要只盯着最后一句；避免重复之前已经说过的安慰或建议。不要强行推进剧情，也不要替用户决定行动、台词或感受。如果用户引用了此前消息，请结合引用原文及对应上下文回答；如果引用的是图片，只有在图片数据随请求提供时才描述画面。不得假装看过未成功加载的图片。不要输出 JSON。消息气泡规则：气泡数量完全跟随当下对话节奏，不要固定每轮发三条，也不要为了凑数拆句。简短回应只发一个气泡；有自然停顿、补充、不同话题或动作与对白时才用独占一行的 ||| 分隔成多个气泡，通常1到5条即可，必要时更多或更少。每个气泡像手机即时聊天，避免连续堆砌长段落。旁白开启时只把旁白放进 [[NARRATION]]...[[/NARRATION]] 标记内，台词保持普通文本。旁白关闭时绝不输出旁白标记、括号动作或叙述。不要输出编号或说明。引用规则：当你想引用聊天中你或用户之前发过的文字时，用 [[LRQUOTE]]原文[[/LRQUOTE]] 包住被引用的原文，再继续写你的回应；引用图片时使用 [[LRQUOTE_IMAGE]]图片[[/LRQUOTE_IMAGE]]，并且只引用本轮上下文中确实出现过的图片，不得猜测图片内容。转账规则：只有你确实决定给用户转账时，单独输出一行 [[LR_TRANSFER amount=金额 currency=￥ note=备注]]，金额必须是正数，备注简短；所有转账卡统一使用人民币符号￥，不要输出RM。订单规则：当用户明确让你点外卖或购物并且你决定照做时，在回复末尾单独输出机器指令 [[LR_AI_ORDER:food|商品关键词]] 或 [[LR_AI_ORDER:shop|商品关键词]]；关键词应是具体菜品或商品名称。该指令用于创建本地模拟订单，不要声称已真实付款或配送。聊天气泡规则：回复要像即时聊天，避免一大段长文；有自然停顿时用 ||| 分隔气泡，通常每个气泡1至3句，不要为了分段而切断句子。回复条数上限：本次最多生成 ${clampReplyCount(meta.replyCount || 4)} 条独立消息；请按自然聊天节奏使用 ||| 分隔，绝不可超过该数量，也不要为了凑数拆句。`;
      const response = await fetchTimeout(
        state.apiBase.replace(/\/+$/,'') + '/chat/completions',
        {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},
          body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:system},...recent],stream:false,temperature:0.85})
        },
        25000
      );
      const raw = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + raw.slice(0,180));
      let rawReply = extractAIText(JSON.parse(raw));
      if (!rawReply) throw new Error('AI 没有返回内容');
      let chosenSticker = null;
      if (stickerSyncOn && savedStickers.length) {
        const marker = rawReply.match(/\[\[\s*LR_STICKER\s*:\s*([^\]]+?)\s*\]\]/i);
        if (marker) chosenSticker = savedStickers.find(x => String(x.id) === marker[1].trim()) || null;
        rawReply = rawReply.replace(/\[\[\s*LR_STICKER\s*:[^\]]+\]\]/gi, '').trim();
        const pendingUserText = thread.slice(lastAssistant + 1).filter(m => m.role === 'user').map(m => safe(m.text)).join('\n');
        const explicitStickerRequest = /(?:表情包|贴图|贴纸)/i.test(pendingUserText) && /(?:发|给我|来一张|来个|发送|用|测试)/i.test(pendingUserText);
        const categoryWords = {
          '开心':['开心','高兴','快乐','兴奋','欢呼','喜悦','happy','joy'], '伤心':['伤心','难过','哭','委屈','眼泪','sad','cry'],
          '生气':['生气','愤怒','恼火','angry','mad'], '平静':['平静','淡定','无表情','冷静','祥和','心如止水','波澜不惊','安详','无聊','bored','calm','neutral'],
          '可爱':['可爱','萌','猫','小猫','狗','小狗','cute'], '撒娇':['撒娇','求抱抱','贴贴'], '害羞':['害羞','脸红','不好意思'],
          '亲亲':['亲亲','亲吻','kiss'], '疑惑':['疑惑','问号','困惑'], '无奈':['无奈','无语','叹气'], '晚安':['晚安','睡觉','困了']
        };
        const searchText = (pendingUserText + '\n' + rawReply).toLowerCase();
        const wantedCategory = Object.keys(categoryWords).find(cat => searchText.includes(cat.toLowerCase()) || categoryWords[cat].some(w => searchText.includes(w.toLowerCase())));
        const filename = rawReply.match(/[【\[]([^】\]\n]+?\.(?:png|jpe?g|gif|webp|bmp))[】\]]/i);
        if (!chosenSticker && filename) {
          const stem = filename[1].replace(/\.(?:png|jpe?g|gif|webp|bmp)$/i, '').toLowerCase();
          chosenSticker = savedStickers.find(x => String(x.name || '').toLowerCase() === stem || String(x.name || '').toLowerCase().includes(stem)) || null;
        }
        if (!chosenSticker && (explicitStickerRequest || /(?:表情包|贴图|贴纸)/i.test(rawReply))) {
          chosenSticker = savedStickers.find(x => String(x.category || '') === wantedCategory) || savedStickers[0] || null;
        }
        if (chosenSticker) {
          rawReply = rawReply.replace(/[【\[][^】\]\n]+?\.(?:png|jpe?g|gif|webp|bmp)[】\]]/gi, '').replace(/[^。！？\n]*(?:发来一张|发送了一张|发了一个|表情包图片|表情包|贴图|贴纸|配字|图片是)[^。！？\n]*[。！？]?/gi, '').trim();
        }
      }
      // Convert model order markers into actual local simulated orders, and never show
      // the machine protocol as a visible chat bubble.
      const aiOrderMatch = rawReply.match(/\[\[\s*LR_AI_ORDER\s*:\s*(food|shop)\s*\|\s*([^\]]+?)\s*\]\]/i);
      const legacyOrderMatch = !aiOrderMatch && rawReply.match(/\[\[\s*LR_ORDER\s*\|\s*(food|shop)\s*\|([^\]]+)\]\]/i);
      if (aiOrderMatch || legacyOrderMatch) {
        let kind, keyword;
        if (aiOrderMatch) { kind = aiOrderMatch[1].toLowerCase(); keyword = aiOrderMatch[2].trim(); rawReply = rawReply.replace(aiOrderMatch[0], '').trim(); }
        else {
          kind = legacyOrderMatch[1].toLowerCase();
          const fields = legacyOrderMatch[2].split('|').map(x => x.trim());
          // Legacy AI output: sender|orderNo|item description|total, or
          // sender|recipient|orderNo|item description|total.
          keyword = fields.length >= 5 ? fields[3] : (fields[2] || fields[1] || '');
          keyword = keyword.replace(/\s*[×x*]\s*\d+\s*$/i, '').trim();
          rawReply = rawReply.replace(legacyOrderMatch[0], '').trim();
        }
        try {
          const maker = window.LoveRecordLifeApps?.createAIOrder;
          const made = maker ? await maker(kind, id, [keyword]) : {ok:false, reason:'生活集市模块未加载'};
          if (made?.ok) window.toast?.('请确认订单地址');
          else window.toast?.('暂未找到对应商品，请换个商品名称再试');
        } catch (orderError) {
          console.warn('[LOVE RECORD] AI order command failed', orderError);
          window.toast?.('订单暂时没能创建，请稍后再试');
        }
      }
      const normalizedReply = normalizeNarrationReply(rawReply, meta.narrationEnabled !== false);
      const reply = normalizedReply;
      if (!reply && !chosenSticker) throw new Error('没有收到有效回复');
      const bubbles = splitAIReply(reply, clampReplyCount(meta.replyCount || 4));
      const latest = readChatThreads();
      const current = Array.isArray(latest[id]) ? latest[id] : [];
      const now = Date.now();
      const newMessages = bubbles.map((part, index) => {
        const transfer = part.match(/^\s*\[\[LR_TRANSFER\s+amount=([\d,.]+)\s+currency=(RM|MYR|RMB|CNY|¥|￥)\s+note=([^\]]*)\]\]\s*$/i) || part.match(/^\s*(?:【\s*)?(?:向你转账|给你转账|转账给你)\s*(RM|MYR|RMB|CNY|人民币|¥|￥)?\s*([\d,]+(?:\.\d{1,2})?)\s*(RM|MYR|RMB|CNY|人民币|元|¥|￥)?\s*(?:】)?\s*$/i);
        if (transfer) {
          const isProtocol = String(part).includes('LR_TRANSFER');
          const amount = Number((isProtocol ? transfer[1] : transfer[2]).replace(/,/g,''));
          const currencyRaw = isProtocol ? transfer[2] : (transfer[1] || transfer[3] || '￥');
          const note = isProtocol ? transfer[3] : '给你的小心意';
          if (Number.isFinite(amount) && amount > 0) return {role:'assistant',kind:'transfer',amount:amount.toFixed(2),currency:'￥',note:note.trim()||'给你的小心意',text:'转账 ￥'+amount.toFixed(2),at:now+index,turnId:'ai-'+now};
        }
        return {role:'assistant', text:part, at:now + index, turnId:'ai-' + now};
      });
      current.splice(Math.min(requestBoundary, current.length), 0, ...newMessages);
      if (chosenSticker && chosenSticker.attachmentId != null) {
        current.splice(Math.min(requestBoundary + newMessages.length, current.length), 0, {
          role:'assistant', kind:'sticker', attachmentId:chosenSticker.attachmentId,
          stickerId:String(chosenSticker.id), stickerCategory:String(chosenSticker.category || '自定义'),
          text:'[表情包：'+String(chosenSticker.category || '自定义')+']', at:now + newMessages.length, turnId:'ai-'+now
        });
      }
      latest[id] = current;
      writeChatThreads(latest);
      renderChat();
      removeTyping();
      await maybeSummarizeMemory(id);
    } catch (error) {
      toast('AI 回复失败：' + (error && error.message ? error.message : 'API 错误'));
    } finally {
      requestBusy = false;
      if (typeof aiBusy !== 'undefined') aiBusy = false;
      removeTyping();
      if ($('lrAskAI')) $('lrAskAI').disabled = false;
      renderChat();
    }
  }

  function scopePrivateChatCss(input) {
    const css = String(input || '').replace(/<\/style/gi, '');
    const root = '#chatConversation';
    const portalRoots = ['#lrChatPlusMenu','#lrThoughtModal','#lrScheduleModal','#lrTransferModal','#lrLocationModal','#lrTransferDecision','#lrStickerModal'];
    const findOpen = (text, from) => { let quote='', comment=false, escape=false, paren=0; for(let i=from;i<text.length;i++){const c=text[i],n=text[i+1];if(comment){if(c==='*'&&n==='/'){comment=false;i++}continue}if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}if(c==='/'&&n==='*'){comment=true;i++;continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='[')paren++;else if(c===')'||c===']')paren=Math.max(0,paren-1);else if(c==='{'&&paren===0)return i}return -1; };
    const findClose = (text, open) => { let depth=1,quote='',comment=false,escape=false; for(let i=open+1;i<text.length;i++){const c=text[i],n=text[i+1];if(comment){if(c==='*'&&n==='/'){comment=false;i++}continue}if(quote){if(escape){escape=false;continue}if(c==='\\'){escape=true;continue}if(c===quote)quote='';continue}if(c==='/'&&n==='*'){comment=true;i++;continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='{')depth++;else if(c==='}'&&--depth===0)return i}return text.length; };
    const splitSelectors = text => { const out=[];let start=0,depth=0,quote='';for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c==='\\'){i++;continue}if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;continue}if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth=Math.max(0,depth-1);else if(c===','&&depth===0){out.push(text.slice(start,i));start=i+1}}out.push(text.slice(start));return out; };
    const scoped = sel => {
      const value=sel.trim();if(!value)return value;
      if(value===root||value.startsWith(root+' ')||value.startsWith(root+':')||value.startsWith(root+'['))return value;
      if(portalRoots.some(x=>value===x||value.startsWith(x+' ')||value.startsWith(x+':')||value.startsWith(x+'[')))return 'html:not([data-lr-group-chat-mode]) body.chat-conversation-open '+value;
      return root+' '+value;
    };
    const walk = text => { let out='',pos=0;while(pos<text.length){const open=findOpen(text,pos);if(open<0){out+=text.slice(pos);break}const close=findClose(text,open),header=text.slice(pos,open),body=text.slice(open+1,close),trim=header.trim();let nextBody=body;if(/^@(media|supports|container|layer|document)\b/i.test(trim))nextBody=walk(body);else if(!trim.startsWith('@')){out+=splitSelectors(header).map(scoped).join(',')+'{'+nextBody+'}';pos=close+1;continue}out+=header+'{'+nextBody+'}';pos=close+1}return out; };
    return walk(css);
  }

  function applyChatAppearance(id) {
    const host = $('chatMessages');
    if (!host) return;
    const meta = currentMeta(id);
    host.style.setProperty('--lr-user-bubble', meta.userBubbleColor || '#b99ac7');
    host.style.setProperty('--lr-ai-bubble', meta.aiBubbleColor || '#ffffff');
    host.style.setProperty('--lr-user-text', meta.userTextColor || '#ffffff');
    host.style.setProperty('--lr-ai-text', meta.aiTextColor || '#28242b');
    host.style.setProperty('--lr-bubble-radius', clampCount(meta.bubbleRadius || 22, 22) + 'px');
    let custom = $('lr-chat-custom-css');
    if (!custom) {
      custom = document.createElement('style');
      custom.id = 'lr-chat-custom-css';
      document.head.appendChild(custom);
    }
    custom.textContent = scopePrivateChatCss(meta.chatCustomCss);
  }

  function ensureSettingsUI() {
    const screen = $('chatSettingsScreen');
    const saveButton = $('chatSaveSettings');
    if (!screen || !saveButton || $('lrChatV9Settings')) return;
    const section = document.createElement('div');
    section.id = 'lrChatV9Settings';
    section.innerHTML = `
      <section class="lr-v9-card">
        <h3>自定义聊天 CSS</h3>
        <div class="sub">可自定义当前单聊的完整界面：顶部资料栏、聊天背景、消息排布、头像、时间戳与时间分割、引用预览、气泡、图片/表情包/转账/位置卡、输入栏、加号菜单、AI 按钮及聊天弹窗。CSS 自动限定在当前单聊，不影响群聊与其他联系人。</div>
        <label for="lrChatCustomCss">CSS 代码</label>
        <textarea id="lrChatCustomCss" maxlength="12000" spellcheck="false" placeholder="/* 透明液态玻璃示例：聊天背景照片由背景设置管理，请勿给 #chatMessages 设置 background 或 background-image */\n#chatMessages .chat-message-row .chat-bubble { backdrop-filter: blur(20px) saturate(145%); -webkit-backdrop-filter: blur(20px) saturate(145%); border: 1px solid rgba(255,255,255,.72); box-shadow: 0 8px 24px rgba(40,40,40,.08); }\n#chatMessages .chat-message-row.ai .chat-bubble { background: rgba(255,255,255,.58); color: #333; }\n#chatMessages .chat-message-row.user .chat-bubble { background: rgba(255,255,255,.34); color: #333; }"></textarea>
        <div class="lr-v9-actions"><button class="btn" id="lrResetChatCss" type="button">恢复默认 CSS</button></div>
      </section>
      <section class="lr-v9-card">
        <h3>自动总结长期记忆</h3>
        <label for="lrAutoMemoryCount">每累计多少条新消息总结一次（1–100）</label>
        <input id="lrAutoMemoryCount" type="number" min="1" max="100" value="15">
        <div class="sub" style="margin-top:7px">默认 15 条。达到数量后，在下一次 AI 回复完成时自动整理长期记忆。</div>
      </section>
      <section class="lr-v9-card">
        <h3>长期记忆</h3>
        <div class="sub">查看这位联系人的长期记忆。AI 会在后续聊天中参考这些内容。</div>
        <div class="lr-v9-actions"><button class="btn" id="lrToggleLongMemory" type="button">查看 / 编辑长期记忆</button></div>
        <div id="lrLongMemoryPanel" hidden>
          <label for="lrLongMemoryText">已保存的记忆</label>
          <textarea id="lrLongMemoryText" maxlength="9000" placeholder="目前还没有长期记忆。累计达到设定消息条数后，AI 会自动总结。"></textarea>
          <div class="lr-v9-actions"><button class="btn primary" id="lrSaveLongMemory" type="button">保存记忆</button><button class="btn" id="lrClearLongMemory" type="button">清空记忆</button></div>
        </div>
      </section>`;
    screen.insertBefore(section, saveButton);

    $('lrResetChatCss').addEventListener('click', () => {
      $('lrChatCustomCss').value = '';
      applyChatAppearance(activeId());
      toast('已清空自定义 CSS');
    });
    $('lrToggleLongMemory').addEventListener('click', () => {
      const panel = $('lrLongMemoryPanel');
      panel.hidden = !panel.hidden;
      $('lrToggleLongMemory').textContent = panel.hidden ? '查看 / 编辑长期记忆' : '收起长期记忆';
      if (!panel.hidden) $('lrLongMemoryText').focus();
    });
    $('lrSaveLongMemory').addEventListener('click', async () => {
      const id = activeId();
      if (!id) return;
      const meta = currentMeta(id);
      meta.longTermMemory = $('lrLongMemoryText').value.trim().slice(0,9000);
      try { await persistMeta(id, meta); toast('长期记忆已保存 ♡'); }
      catch (error) { toast('记忆保存失败：' + (error.message || '请重试')); }
    });
    $('lrClearLongMemory').addEventListener('click', async () => {
      if (!confirm('确定清空这位联系人的长期记忆吗？')) return;
      const id = activeId();
      const meta = currentMeta(id);
      meta.longTermMemory = '';
      meta.memorySummarizedThrough = threadFor(id).length;
      try {
        await persistMeta(id, meta);
        $('lrLongMemoryText').value = '';
        toast('长期记忆已清空');
      } catch (error) { toast('清空失败，请重试'); }
    });
    ['lrChatCustomCss'].forEach(id => {
      $(id).addEventListener('input', () => applyDraftAppearance());
    });
  }

  function applyDraftAppearance() {
    const host = $('chatMessages');
    if (!host) return;
    const val = id => $(id) ? $(id).value : '';
    host.style.setProperty('--lr-user-bubble', val('lrUserBubbleColor') || '#b99ac7');
    host.style.setProperty('--lr-ai-bubble', val('lrAiBubbleColor') || '#ffffff');
    host.style.setProperty('--lr-user-text', val('lrUserTextColor') || '#ffffff');
    host.style.setProperty('--lr-ai-text', val('lrAiTextColor') || '#28242b');
    host.style.setProperty('--lr-bubble-radius', clampCount(val('lrBubbleRadius') || 22, 22) + 'px');
    const css = $('lr-chat-custom-css');
    if (css) css.textContent = scopePrivateChatCss(val('lrChatCustomCss'));
  }

  function fillSettings() {
    ensureSettingsUI();
    const meta = currentMeta(activeId());
    const set = (id, value) => { if ($(id)) $(id).value = value; };
    set('lrUserBubbleColor', meta.userBubbleColor || '#b99ac7');
    set('lrAiBubbleColor', meta.aiBubbleColor || '#ffffff');
    set('lrUserTextColor', meta.userTextColor || '#ffffff');
    set('lrAiTextColor', meta.aiTextColor || '#28242b');
    set('lrBubbleRadius', clampCount(meta.bubbleRadius || 22, 22));
    set('lrChatCustomCss', meta.chatCustomCss || '');
    set('lrAutoMemoryCount', clampCount(meta.autoMemoryCount || 15, 15));
    set('lrLongMemoryText', meta.longTermMemory || '');
    const panel = $('lrLongMemoryPanel');
    if (panel) panel.hidden = true;
    if ($('lrToggleLongMemory')) $('lrToggleLongMemory').textContent = '查看 / 编辑长期记忆';
    applyChatAppearance(activeId());
  }

  function extendSaveFixPayload() {
    const button = $('chatSaveSettings');
    if (!button || button.dataset.lrV9SaveBound) return;
    button.dataset.lrV9SaveBound = '1';
    // The save-fix script handles the capture-phase click. Keep editingChatMeta
    // populated so its safe IndexedDB-backed writer persists these small fields.
    button.addEventListener('click', () => {
      if (typeof editingChatMeta === 'undefined' || !editingChatMeta) return;
      editingChatMeta.userBubbleColor = $('lrUserBubbleColor')?.value || '#b99ac7';
      editingChatMeta.aiBubbleColor = $('lrAiBubbleColor')?.value || '#ffffff';
      editingChatMeta.userTextColor = $('lrUserTextColor')?.value || '#ffffff';
      editingChatMeta.aiTextColor = $('lrAiTextColor')?.value || '#28242b';
      editingChatMeta.bubbleRadius = clampCount($('lrBubbleRadius')?.value || 22, 22);
      editingChatMeta.chatCustomCss = $('lrChatCustomCss')?.value || '';
      editingChatMeta.autoMemoryCount = clampCount($('lrAutoMemoryCount')?.value || 15, 15);
    }, true);
  }

  function bindMessageGestures() {
    const host = $('chatMessages');
    if (!host || host.dataset.lrV9GestureBound) return;
    host.dataset.lrV9GestureBound = '1';
    host.addEventListener('pointerdown', event => {
      const row = event.target.closest('.chat-message-row');
      if (!row || !host.contains(row)) return;
      longPressed = false;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        const index = Number(row.dataset.lrMessageIndex);
        if (!Number.isInteger(index)) return;
        longPressed = true;
        suppressClick = true;
        if (!selected.has(index)) selected.add(index);
        markRows();
        refreshSelectionUI();
      }, 430);
    });
    ['pointerup','pointercancel','pointerleave'].forEach(type => host.addEventListener(type, () => clearTimeout(pressTimer)));
    host.addEventListener('contextmenu', event => {
      const row = event.target.closest('.chat-message-row');
      if (!row) return;
      event.preventDefault();
      const index = Number(row.dataset.lrMessageIndex);
      if (Number.isInteger(index)) {
        selected.add(index);
        markRows();
        refreshSelectionUI();
      }
    });
    host.addEventListener('click', event => {
      const row = event.target.closest('.chat-message-row');
      if (!row || !host.contains(row)) return;
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!selected.size) return;
      const index = Number(row.dataset.lrMessageIndex);
      if (!Number.isInteger(index)) return;
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      markRows();
      refreshSelectionUI();
    });
  }

  function install() {
    cleanupLegacySelfContact();
    addStyles();
    ensureControls();
    bindMessageGestures();
    extendSaveFixPayload();

    window.sendChatMessage = queueUserMessage;
    const send = $('chatSend');
    if (send) send.onclick = queueUserMessage;

    const input = $('chatInput');
    if (input && !input.dataset.lrV9ManualSendBound) {
      input.dataset.lrV9ManualSendBound = '1';
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          queueUserMessage();
        }
      }, true);
    }

    if (!window.__lrChatV9RenderWrapped && typeof window.renderChat === 'function') {
      window.__lrChatV9RenderWrapped = true;
      const originalRender = window.renderChat;
      window.renderChat = function () {
        const id = activeId();
        if (id !== lastContactId) {
          selected.clear();
          lastContactId = id;
          lastDeleted = null;
          clearTimeout(undoTimer);
          const undoBox = $('lrUndoToast');
          if (undoBox) undoBox.hidden = true;
        }
        const result = originalRender.apply(this, arguments);
        ensureControls();
        bindMessageGestures();
        markRows();
        refreshSelectionUI();
        applyChatAppearance(id);
        if (requestBusy) addTyping();
        return result;
      };
    }

    if (!window.__lrChatV9OpenWrapped && typeof window.openChatSettings === 'function') {
      window.__lrChatV9OpenWrapped = true;
      const originalOpen = window.openChatSettings;
      window.openChatSettings = function () {
        const result = originalOpen.apply(this, arguments);
        fillSettings();
        return result;
      };
    }

    ensureSettingsUI();
    fillSettings();
    applyChatAppearance(activeId());
    markRows();
    refreshSelectionUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
