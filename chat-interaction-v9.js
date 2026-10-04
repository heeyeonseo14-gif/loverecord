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

  function cleanupLegacySelfContact() {
    try {
      if (Array.isArray(state.people)) {
        const before = state.people.length;
        state.people = state.people.filter(person => person && person.id !== 'p-yanyan');
        if (state.people.length !== before) save();
      }
      const ids = readChatContacts();
      if (ids.includes('p-yanyan')) writeChatContacts(ids.filter(id => id !== 'p-yanyan'));
      const threads = readChatThreads();
      if (Object.prototype.hasOwnProperty.call(threads, 'p-yanyan')) {
        delete threads['p-yanyan'];
        writeChatThreads(threads);
      }
      if (typeof readChatMeta === 'function' && typeof writeChatMeta === 'function') {
        const metas = readChatMeta();
        if (metas && Object.prototype.hasOwnProperty.call(metas, 'p-yanyan')) {
          delete metas['p-yanyan'];
          localStorage.setItem('love-record-chat-meta-v2', JSON.stringify(metas));
          localStorage.removeItem('love-record-chat-meta-v1');
        }
      }
    } catch (error) {
      console.warn('[LOVE RECORD] legacy YANYAN cleanup skipped:', error);
    }
  }

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
      .lr-typing-row{display:flex;align-items:center;gap:9px;align-self:flex-start;color:var(--muted);font-size:12px;padding:8px 12px;background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:15px}
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

  function splitAIReply(value) {
    const text = safe(value).replace(/\r\n?/g, '\n').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    if (!text) return [];
    // Split only at explicit bubble separators / paragraph boundaries. Never split
    // a narration token across bubbles and never chop a sentence just because it is long.
    let parts = text.split(/\s*(?:\|\|\||\n\s*\n+)\s*/g).map(x => x.trim()).filter(Boolean);
    if (parts.length === 1 && /\n/.test(text)) {
      parts = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
    }
    if (parts.length > 6) parts = [...parts.slice(0,5), parts.slice(5).join(' ')];
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
    host.scrollTop = host.scrollHeight;
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
    const transcript = newItems.map(m => `${m.role === 'assistant' ? 'AI' : '用户'}：${safe(m.text)}`).join('\n');
    addTyping('正在整理长期记忆');
    try {
      const summarySystem = '你是长期聊天记忆整理器。请把已有记忆与新增聊天整理为一份简洁、准确、可供未来对话使用的长期记忆。只记录聊天明确出现的稳定偏好、人物关系、重要经历、约定、未完成事项；不推测、不编造、不记录临时寒暄。保留仍然有效的旧信息，修正明确过时的信息。用第三人称或清晰标签表达，控制在 2500 个汉字以内，只输出记忆正文。';
      const response = await fetchTimeout(
        state.apiBase.replace(/\/+$/,'') + '/chat/completions',
        {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},
          body:JSON.stringify({
            model:state.apiModel,
            messages:[
              {role:'system',content:summarySystem},
              {role:'user',content:`已有长期记忆：\n${oldMemory || '（暂无）'}\n\n本次新增聊天：\n${transcript}\n\n请整合为更新后的长期记忆。`}
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
        if (m.kind === 'image' && m.attachmentId) {
          let dataUrl = '';
          try { dataUrl = await window.lrLoadChatAttachmentDataUrl?.(m.attachmentId) || ''; } catch (e) { console.warn('[LOVE RECORD] image context load failed', e); }
          const parts = [{type:'text', text: safe(m.text || '[用户发送了一张图片]') + (dataUrl ? '' : '（图片文件暂时无法读取，请勿猜测图片内容）')}];
          if (dataUrl) parts.push({type:'image_url', image_url:{url:dataUrl, detail:'auto'}});
          recent.push({role, content:parts});
        } else {
          recent.push({role, content:safe(m.text)});
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
        ? `以下是你需要参考的长期聊天记忆：\n${safe(meta.longTermMemory)}\n`
        : '';
      const system = `你正在 LOVE RECORD 中扮演联系人「${person.name}」。身份：${person.role || ''}。性格：${person.personality || ''}。外貌：${person.appearance || ''}。说话方式：${person.speech || ''}。背景：${person.background || ''}。角色规则：${person.instructions || '保持人物一致，自然聊天，不要替用户决定行动或情绪。'}。${meta.narrationEnabled===false?'【旁白模式：关闭】这是硬性规则：只允许角色直接说出口的台词。严禁输出任何动作、表情、心理、环境、第三人称叙述、括号内容或舞台提示。':'【旁白模式：开启】旁白必须以内嵌标记输出，绝不能把旁白单独写成括号段落。动作、神态、心理或环境描写必须包在 [[NARRATION]] 和 [[/NARRATION]] 之间，例如：[[NARRATION]]他抬眼看了你一眼，唇边带着一点笑意。[[/NARRATION]]「知道了。」旁白不是必需品，不要为了展示旁白而每轮硬加。只有动作、神态或环境细节确实能增加临场感时才偶尔写一小笔；允许连续几轮完全没有旁白。旁白应像自然发生的细节，避免小说式铺陈、重复描写动作或每条消息都用括号开头。'}。${personaText}${worldText}${longMemoryText}当前本地时间：${new Date().toLocaleString('zh-CN',{hour12:false})}。${(()=>{const h=new Date().getHours();return h<5?'现在是凌晨':h<7?'现在是清晨':h<11?'现在是早上':h<12?'现在是上午':h<14?'现在是中午':h<18?'现在是下午':h<22?'现在是晚上':'现在是深夜'})()}。请严格遵守现实时间逻辑：早上不要说晚安或描述深夜，晚上不要说早安或描述早餐；不要擅自让时间跳跃数小时或数天；用户未说明时间经过时，默认仍处于当前时间附近。聊天风格要求：把这段互动当作真实、持续发生的私人聊天，而不是问答客服或剧情任务。先自然接住用户这句话里最重要的情绪、事实或话题，不要复述整句话来证明你听见了；不要每轮都用‘我理解’‘听起来’‘你现在感觉怎么样’等模板开头，也不要习惯性在结尾抛问题。不要把普通聊天变成健康科普、人生建议或心理分析，除非用户明确在求助。回复长度跟随情境：日常闲聊可以短，值得展开时再多说；允许自然的语气变化、玩笑、轻微吐槽、停顿和主动分享，但不能凭空编造共同经历。参考最近多轮对话，不要只盯着最后一句；避免重复之前已经说过的安慰或建议。不要强行推进剧情，也不要替用户决定行动、台词或感受。如果用户引用了此前消息，请结合引用原文及对应上下文回答；如果引用的是图片，只有在图片数据随请求提供时才描述画面。不得假装看过未成功加载的图片。不要输出 JSON。消息气泡规则：气泡数量完全跟随当下对话节奏，不要固定每轮发三条，也不要为了凑数拆句。简短回应只发一个气泡；有自然停顿、补充、不同话题或动作与对白时才用独占一行的 ||| 分隔成多个气泡，通常1到5条即可，必要时更多或更少。每个气泡像手机即时聊天，避免连续堆砌长段落。旁白开启时只把旁白放进 [[NARRATION]]...[[/NARRATION]] 标记内，台词保持普通文本。旁白关闭时绝不输出旁白标记、括号动作或叙述。不要输出编号或说明。`;
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
      const rawReply = extractAIText(JSON.parse(raw));
      const reply = normalizeNarrationReply(rawReply, meta.narrationEnabled !== false);
      if (!reply) throw new Error('没有收到有效回复');
      const bubbles = splitAIReply(reply);
      const latest = readChatThreads();
      const current = Array.isArray(latest[id]) ? latest[id] : [];
      const now = Date.now();
      const newMessages = bubbles.map((part, index) => ({
        role:'assistant', text:part, at:now + index, turnId:'ai-' + now
      }));
      current.splice(Math.min(requestBoundary, current.length), 0, ...newMessages);
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
    custom.textContent = safe(meta.chatCustomCss);
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
        <div class="sub">仅作用于当前联系人的聊天界面。可以自定义背景、气泡、字体和间距。</div>
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
    if (css) css.textContent = val('lrChatCustomCss');
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
