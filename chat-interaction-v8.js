/* LOVE RECORD V24 · Chat interaction repair v8
   - Sending a message never calls the API.
   - The ✦ control explicitly requests an AI reply.
   - AI turns are stored as separate message records/bubbles.
   - Tap messages to select; delete selected; undo the latest deletion.
*/
(function () {
  'use strict';
  if (window.__lrChatInteractionV8) return;
  window.__lrChatInteractionV8 = true;

  const STYLE_ID = 'lr-chat-interaction-v8-style';
  let selected = new Set();
  let lastDeleted = null;
  let requestBusy = false;
  let lastRenderedContactId = '';

  const $ = id => document.getElementById(id);
  const activeId = () => (typeof activeChatContactId !== 'undefined' ? activeChatContactId : '');
  const safe = value => String(value == null ? '' : value);

  function addStyles() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .chat-compose{display:flex;align-items:flex-end;gap:8px}
      #chatSend{flex:0 0 auto}
      #lrAskAI{width:46px;height:46px;flex:0 0 46px;border:0;border-radius:16px;background:#b99ac7;color:#fff;font-size:25px;line-height:1;display:grid;place-items:center;box-shadow:0 5px 14px rgba(125,94,143,.16)}
      #lrAskAI:disabled{opacity:.5}
      #lrChatMessageTools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 2px 9px}
      #lrChatMessageTools[hidden]{display:none!important}
      #lrChatMessageTools button{border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);padding:7px 12px;font-size:12px}
      #lrChatMessageTools .lr-delete-selected{color:#9a6575;border-color:#d9bfc8}
      #lrChatMessageTools .lr-undo{color:#806b8b}
      #lrChatMessageTools .lr-selection-count{font-size:11px;color:var(--muted);margin-right:auto}
      .chat-message-row.lr-selected{background:rgba(185,154,199,.13);outline:2px solid rgba(185,154,199,.72);outline-offset:3px;border-radius:17px}
      .chat-message-row{cursor:pointer}
      .lr-typing-row{display:flex;align-items:center;gap:9px;align-self:flex-start;color:var(--muted);font-size:12px;padding:8px 12px;background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:15px}
      .lr-typing-dots{letter-spacing:2px;animation:lrTypingPulse 1s ease-in-out infinite}
      @keyframes lrTypingPulse{0%,100%{opacity:.35}50%{opacity:1}}
      .dark-mode #lrChatMessageTools button{background:#211c24;color:#f4eef6;border-color:#3a323e}
      @media(max-width:420px){#lrAskAI{width:44px;height:44px;flex-basis:44px;border-radius:15px}}
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
        <button type="button" id="lrCancelSelection">取消</button>
        <button type="button" class="lr-undo" id="lrUndoDelete" hidden>撤销删除</button>`;
      compose.parentNode.insertBefore(tools, compose);
      $('lrDeleteSelected').addEventListener('click', deleteSelected);
      $('lrCancelSelection').addEventListener('click', clearSelection);
      $('lrUndoDelete').addEventListener('click', undoDelete);
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
    tools.hidden = count === 0 && !lastDeleted;
    const countNode = $('lrSelectionCount');
    if (countNode) countNode.textContent = count ? `已选择 ${count} 条` : '消息管理';
    const del = $('lrDeleteSelected');
    const cancel = $('lrCancelSelection');
    if (del) del.hidden = count === 0;
    if (cancel) cancel.hidden = count === 0;
    const undo = $('lrUndoDelete');
    if (undo) undo.hidden = !(lastDeleted && lastDeleted.contactId === activeId());
  }

  function markRows() {
    const host = $('chatMessages');
    if (!host) return;
    host.querySelectorAll('.chat-message-row').forEach((row, index) => {
      row.dataset.lrMessageIndex = String(index);
      row.classList.toggle('lr-selected', selected.has(index));
      row.setAttribute('aria-label', selected.has(index) ? '已选择消息' : '点击选择消息');
    });
  }

  function clearSelection() {
    selected.clear();
    markRows();
    refreshSelectionUI();
  }

  function readThread(id) {
    const all = readChatThreads();
    return Array.isArray(all[id]) ? all[id] : [];
  }

  function writeThread(id, messages) {
    const all = readChatThreads();
    all[id] = messages;
    writeChatThreads(all);
  }

  function deleteSelected() {
    const id = activeId();
    if (!id || !selected.size) return;
    const before = readThread(id);
    const indexes = [...selected].filter(i => i >= 0 && i < before.length).sort((a,b) => a-b);
    if (!indexes.length) return clearSelection();
    const removed = indexes.map(index => ({index, message: before[index]}));
    const after = before.filter((_, index) => !selected.has(index));
    try {
      writeThread(id, after);
      lastDeleted = {contactId:id, before, after};
      selected.clear();
      renderChat();
      refreshSelectionUI();
      toast(`已删除 ${removed.length} 条消息，可点击「撤销删除」恢复`);
    } catch (error) {
      toast('删除失败：本地储存空间可能不足');
    }
  }

  function undoDelete() {
    if (!lastDeleted || lastDeleted.contactId !== activeId()) return;
    try {
      const current = readThread(lastDeleted.contactId);
      const after = lastDeleted.after;
      let restored;
      if (JSON.stringify(current) === JSON.stringify(after)) {
        restored = lastDeleted.before;
      } else {
        // Keep newer messages and put deleted messages back near their original positions.
        restored = current.slice();
        // Compare serialized message values (the storage reader returns fresh objects).
        const counts = new Map();
        after.forEach(message => {
          const key = JSON.stringify(message);
          counts.set(key, (counts.get(key) || 0) + 1);
        });
        const missing = [];
        lastDeleted.before.forEach((message, index) => {
          const key = JSON.stringify(message);
          const count = counts.get(key) || 0;
          if (count > 0) counts.set(key, count - 1);
          else missing.push({message, index});
        });
        missing.forEach(item => restored.splice(Math.min(item.index, restored.length), 0, item.message));
      }
      writeThread(lastDeleted.contactId, restored);
      lastDeleted = null;
      renderChat();
      refreshSelectionUI();
      toast('已恢复刚才删除的消息 ♡');
    } catch (_) {
      toast('恢复失败，请稍后重试');
    }
  }

  function splitAIReply(value) {
    let text = safe(value).replace(/\r\n?/g, '\n').replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
    if (!text) return [];
    let parts = text.split(/\s*(?:\|\|\||\n\s*\n+|\n+)\s*/g).map(x => x.trim()).filter(Boolean);
    if (parts.length === 1 && text.length > 72) {
      const sentences = text.split(/(?<=[。！？!?])\s*/).map(x => x.trim()).filter(Boolean);
      if (sentences.length > 1) {
        parts = [];
        let current = '';
        for (const sentence of sentences) {
          if (current && current.length + sentence.length > 58 && parts.length < 4) {
            parts.push(current); current = sentence;
          } else current += sentence;
        }
        if (current) parts.push(current);
      }
    }
    if (parts.length > 5) parts = [...parts.slice(0,4), parts.slice(4).join('')];
    return parts.length ? parts : [text];
  }

  function addTyping() {
    const host = $('chatMessages');
    if (!host || $('lrTypingIndicator')) return;
    const row = document.createElement('div');
    row.id = 'lrTypingIndicator';
    row.className = 'lr-typing-row';
    row.innerHTML = '<span>正在输入</span><span class="lr-typing-dots">•••</span>';
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
    const meta = typeof chatMeta === 'function' ? chatMeta(id) : {};
    if (meta && meta.blocked) { toast('这位联系人已被拉黑，请先取消拉黑'); return; }
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
      toast('消息未能保存：本地储存空间不足');
    }
  }

  async function requestAIReply() {
    const id = activeId();
    if (!id || requestBusy) return;
    const person = contactById(id);
    if (!person) return;
    const meta = typeof chatMeta === 'function' ? chatMeta(id) : {};
    if (meta && meta.blocked) { toast('这位联系人已被拉黑，请先取消拉黑'); return; }
    if (!state.apiBase || !state.apiKey || !state.apiModel) {
      toast('请先在设置中连接 API');
      return;
    }
    const thread = readThread(id);
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
    const ask = $('lrAskAI');
    if (ask) ask.disabled = true;
    addTyping();
    try {
      const memoryCount = Math.min(100, Math.max(1, parseInt(meta.memoryCount,10) || 16));
      const recent = thread.slice(-memoryCount).map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: safe(m.text)
      }));
      const persona = (state.selfPersonas || []).find(x => x.id === meta.personaId) || null;
      const world = (state.worlds || []).find(x => x.id === meta.worldId) || null;
      const personaText = persona
        ? `用户当前人设：${persona.name || ''}；身份：${persona.role || ''}；性格：${persona.personality || ''}；外貌：${persona.appearance || ''}；说话方式：${persona.speech || ''}；背景：${persona.background || ''}。请尊重该人设，但不要替用户决定行动、台词或情绪。`
        : '用户以本人身份参与聊天，不要替用户决定行动、台词或情绪。';
      const worldText = world
        ? `当前启用世界书「${world.name || ''}」：${world.description || ''}；地点：${world.locations || ''}；规则：${world.rules || ''}。请将这些设定作为背景资料，保持一致。`
        : '';
      const system = `你正在 LOVE RECORD 中扮演联系人「${person.name}」。身份：${person.role || ''}。性格：${person.personality || ''}。外貌：${person.appearance || ''}。说话方式：${person.speech || ''}。背景：${person.background || ''}。角色规则：${person.instructions || '保持人物一致，自然聊天，不要替用户决定行动或情绪。'}。${personaText}${worldText}请像真实聊天对象一样自然回复，不要输出 JSON。请把回复写成 2–5 条自然、简短、连续的聊天消息，每条之间必须用独占一行的 ||| 分隔符；如果内容很短，只发一条，不要为了凑数而拆句。不要输出 ||| 以外的编号或说明。`;
      const response = await fetchTimeout(
        state.apiBase.replace(/\/+$/,'') + '/chat/completions',
        {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+state.apiKey,'Accept':'application/json'},
          body:JSON.stringify({model:state.apiModel,messages:[{role:'system',content:system},...recent],stream:false})
        },
        25000
      );
      const raw = await response.text();
      if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + raw.slice(0,180));
      const data = JSON.parse(raw);
      const reply = extractAIText(data);
      if (!reply) throw new Error('没有收到有效回复');
      const bubbles = splitAIReply(reply);
      const latest = readChatThreads();
      const current = Array.isArray(latest[id]) ? latest[id] : [];
      const now = Date.now();
      const newMessages = bubbles.map((part, index) => ({
        role:'assistant',
        text:part,
        at:now + index,
        turnId:'ai-' + now
      }));
      current.splice(Math.min(requestBoundary, current.length), 0, ...newMessages);
      latest[id] = current;
      writeChatThreads(latest);
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

  function install() {
    addStyles();
    ensureControls();

    // Replace the previous auto-API send behavior.
    window.sendChatMessage = queueUserMessage;
    const send = $('chatSend');
    if (send) send.onclick = queueUserMessage;

    const input = $('chatInput');
    if (input && !input.dataset.lrManualSendBound) {
      input.dataset.lrManualSendBound = '1';
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          queueUserMessage();
        }
      }, true);
    }

    const host = $('chatMessages');
    if (host && !host.dataset.lrSelectBound) {
      host.dataset.lrSelectBound = '1';
      host.addEventListener('click', event => {
        const row = event.target.closest('.chat-message-row');
        if (!row || !host.contains(row)) return;
        const index = Number(row.dataset.lrMessageIndex);
        if (!Number.isInteger(index)) return;
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);
        markRows();
        refreshSelectionUI();
      });
    }

    if (!window.__lrChatRenderWrapped && typeof window.renderChat === 'function') {
      window.__lrChatRenderWrapped = true;
      const originalRender = window.renderChat;
      window.renderChat = function () {
        const currentContactId = activeId();
        if (currentContactId !== lastRenderedContactId) {
          selected.clear();
          lastRenderedContactId = currentContactId;
        }
        const result = originalRender.apply(this, arguments);
        ensureControls();
        markRows();
        refreshSelectionUI();
        if (requestBusy) addTyping();
        return result;
      };
    }
    ensureControls();
    markRows();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, {once:true});
  } else {
    install();
  }
})();
