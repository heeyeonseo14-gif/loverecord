/* LOVE RECORD V29 · foreground autonomy, unread badges and in-app incoming alerts.
 * Foreground autonomy runs only while this PWA page is visible. Cloud background
 * generation and FCM remain handled by GitHub Actions + Firebase Messaging.
 */
(() => {
  'use strict';
  if (window.__LR_MESSAGING_ENHANCEMENTS_V1__) return;
  window.__LR_MESSAGING_ENHANCEMENTS_V1__ = true;

  const UNREAD_KEY = 'lr-chat-unread-v1';
  const FOREGROUND_KEY = 'lr-foreground-autonomy-state-v1';
  const AUTO_TICK_MS = 15000;
  const activeRequests = new Set();
  let foregroundBusy = false;
  let badgeRenderQueued = false;

  const safeJson = (key, fallback = {}) => {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : fallback; }
    catch (_) { return fallback; }
  };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('[LOVE RECORD] local message state could not be saved', error); } };
  const keyFor = (type, id) => (type === 'group' ? 'group:' : 'single:') + String(id || '');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  function isConversationOpen(type, id) {
    const chatPage = document.getElementById('chat');
    if (!chatPage?.classList.contains('active') || !chatPage.classList.contains('is-conversation')) return false;
    if (type === 'group') return String(window.LRGroupChatActions?.getActiveGroupId?.() || '') === String(id);
    return String(window.LRGroupChatHost?.getActiveChatContactId?.() || '') === String(id) && !chatPage.classList.contains('is-group-conversation');
  }

  function readUnread() { return safeJson(UNREAD_KEY, {}); }
  function unreadCount(type, id) { const value = readUnread()[keyFor(type, id)]; return Math.max(0, Number(value?.count) || 0); }
  function totalUnread() { return Object.values(readUnread()).reduce((sum, item) => sum + Math.max(0, Number(item?.count) || 0), 0); }

  function makeBadge(count, extraClass = '') {
    const badge = document.createElement('span');
    badge.className = 'lr-unread-count ' + extraClass;
    const label = count > 99 ? '99+' : String(count);
    if (badge.textContent !== label) badge.textContent = label;
    badge.setAttribute('aria-label', count + ' 条未读消息');
    return badge;
  }

  function decorateCard(card, count, placement) {
    let badge = card.querySelector(':scope > .lr-unread-count');
    if (!count) { badge?.remove(); card.classList.remove('lr-has-unread'); return; }
    if (!badge) { badge = makeBadge(count); card.appendChild(badge); }
    const label = count > 99 ? '99+' : String(count);
    if (badge.textContent !== label) badge.textContent = label;
    badge.setAttribute('aria-label', count + ' 条未读消息');
    card.classList.add('lr-has-unread');
    if (placement) placement.style.position = 'relative';
  }

  function renderBadges() {
    const total = totalUnread();
    document.querySelectorAll('[data-launch-page="chat"]').forEach((button) => {
      const icon = button.querySelector('.app-icon') || button;
      let badge = button.querySelector(':scope > .lr-app-unread-count');
      if (!badge && total) { badge = makeBadge(total, 'lr-app-unread-count'); button.appendChild(badge); }
      if (badge) {
        badge.hidden = !total;
        const label = total > 99 ? '99+' : String(total);
        if (badge.textContent !== label) badge.textContent = label;
      }
      icon.style.position = 'relative';
    });
    document.querySelectorAll('#chatContacts [data-chat-open]').forEach((card) => {
      decorateCard(card, unreadCount('single', card.dataset.chatOpen), card.querySelector('.chat-contact-time'));
    });
    document.querySelectorAll('#lrGroupList [data-lr-group-open]').forEach((card) => {
      decorateCard(card, unreadCount('group', card.dataset.lrGroupOpen), card.querySelector('.lr-group-list-meta'));
    });
  }

  function scheduleBadgeRender() {
    if (badgeRenderQueued) return;
    badgeRenderQueued = true;
    setTimeout(() => { badgeRenderQueued = false; renderBadges(); }, 0);
  }

  function showToast(message) {
    if (document.visibilityState !== 'visible') return;
    if (typeof window.toast === 'function') window.toast(String(message || '有新的消息'));
  }

  function openConversationFromBanner(type, id) {
    const chatPage = document.getElementById('chat');
    if (!chatPage?.classList.contains('active')) document.querySelector('[data-launch-page=\"chat\"]')?.click();
    let attempts = 0;
    const tryOpen = () => {
      attempts++;
      const selector = type === 'group' ? '#lrGroupList [data-lr-group-open]' : '#chatContacts [data-chat-open]';
      const target = Array.from(document.querySelectorAll(selector)).find((node) => String(type === 'group' ? node.dataset.lrGroupOpen : node.dataset.chatOpen) === String(id));
      if (target) { target.click(); return; }
      if (attempts < 10) setTimeout(tryOpen, 250);
    };
    setTimeout(tryOpen, 180);
  }

  function showIncomingBanner({ title = 'LOVE RECORD', preview = '有新的消息。', count = 1, type = 'single', conversationId = '' } = {}) {
    if (document.visibilityState !== 'visible' || !document.body) return;
    let node = document.getElementById('lrIncomingMessageBanner');
    if (!node) {
      node = document.createElement('div');
      node.id = 'lrIncomingMessageBanner';
      node.className = 'lr-incoming-message-banner';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.innerHTML = '<button class=\"lr-incoming-main\" type=\"button\"><span class=\"lr-incoming-avatar\">♡</span><span class=\"lr-incoming-copy\"><strong></strong><small></small><em>点按查看消息</em></span><b class=\"lr-incoming-count\"></b></button><button class=\"lr-incoming-close\" type=\"button\" aria-label=\"关闭提醒\">×</button>';
      document.body.appendChild(node);
      node.querySelector('.lr-incoming-main').addEventListener('click', () => {
        const t = node.dataset.type || 'single'; const id = node.dataset.conversationId || '';
        node.classList.remove('is-visible');
        if (id) openConversationFromBanner(t, id);
      });
      node.querySelector('.lr-incoming-close').addEventListener('click', (event) => {
        event.stopPropagation(); node.classList.remove('is-visible'); clearTimeout(node.__lrHideTimer);
      });
    }
    node.dataset.type = type;
    node.dataset.conversationId = String(conversationId || '');
    node.querySelector('.lr-incoming-copy strong').textContent = String(title || 'LOVE RECORD');
    node.querySelector('.lr-incoming-copy small').textContent = String(preview || '有新的消息。').slice(0, 140);
    const countNode = node.querySelector('.lr-incoming-count');
    countNode.textContent = count > 1 ? String(count > 99 ? '99+' : count) : '';
    countNode.hidden = count <= 1;
    node.classList.add('is-visible');
    clearTimeout(node.__lrHideTimer);
    node.__lrHideTimer = setTimeout(() => node.classList.remove('is-visible'), 5200);
  }

  function recordIncoming(type, conversationId, messageId, options = {}) {
    const id = String(conversationId || ''); if (!id) return 0;
    if (isConversationOpen(type, id)) { markRead(type, id); return 0; }
    const all = readUnread(); const key = keyFor(type, id); const item = all[key] || { count: 0, ids: [] };
    const messageKey = String(messageId || '');
    if (messageKey && Array.isArray(item.ids) && item.ids.includes(messageKey)) return Number(item.count) || 0;
    item.count = Math.min(999, Math.max(0, Number(item.count) || 0) + 1);
    item.ids = [...(Array.isArray(item.ids) ? item.ids : []), ...(messageKey ? [messageKey] : [])].slice(-120);
    item.updatedAt = Date.now(); all[key] = item; writeJson(UNREAD_KEY, all); renderBadges();
    if (!options.silent) {
      const name = options.title || (type === 'group' ? '群聊' : (window.LRGroupChatHost?.contactName?.(id) || '联系人'));
      showIncomingBanner({ title:name, preview:options.preview || '发来一条新消息', count:item.count, type, conversationId:id });
    }
    return item.count;
  }

  function markRead(type, conversationId) {
    const all = readUnread(); const key = keyFor(type, conversationId);
    if (all[key]) { all[key].count = 0; all[key].readAt = Date.now(); writeJson(UNREAD_KEY, all); }
    renderBadges();
  }

  function parseReply(raw) {
    const value = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(value); } catch (_) {
      const start = value.indexOf('{'), end = value.lastIndexOf('}');
      if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
      const a = value.indexOf('['), b = value.lastIndexOf(']');
      if (a >= 0 && b > a) return JSON.parse(value.slice(a, b + 1));
      return { messages: [value] };
    }
  }

  function foregroundPrompt(conversation, userName, desired) {
    const history = (Array.isArray(conversation.recentMessages) ? conversation.recentMessages : []).slice(-20)
      .map((m) => `[${m.role === 'user' ? '用户' : (m.name || '角色')}] ${String(m.text || '').slice(0, 1200)}`).join('\n') || '目前还没有近期聊天内容，请自然地开启一段简短对话。';
    const base = [
      '你是 LOVE RECORD 中持续存在的角色，正在一段真实的私人聊天里主动联系用户。',
      '遵守人物设定、世界书和长期记忆；不要替用户编造行为、台词、想法或情绪。',
      `用户称呼：${String(userName || '用户').slice(0, 80)}。`,
      `共同世界/世界书：${String(conversation.worldContext || '无').slice(0, 10000)}`,
      `长期记忆：${String(conversation.longMemory || '无').slice(0, 8000)}`,
      `最近聊天：\n${history}`,
      desired === 1 ? '请自然发送 1 条消息。' : '请自然发送 2–3 条前后衔接的独立消息气泡；每条都要短一些，像连续聊天，不要重复或灌水。上下文不适合多条时可以只发 1 条。',
      '不要提到定时器、后台、API、云端或系统。只返回 JSON，不要 Markdown。'
    ];
    if (conversation.type === 'group') {
      const members = (Array.isArray(conversation.members) ? conversation.members : []).slice(0, 12);
      base.push('这是多人群聊，可以让一位或多位成员自然接话，但每条必须严格使用下列成员 ID。');
      base.push('成员：' + members.map((m) => `ID=${m.id}; name=${m.name}; role=${m.role}; personality=${m.personality}; speech=${m.speech}; background=${m.background}; memory=${m.longMemory}; rules=${m.instructions}`).join('\n'));
      base.push('返回格式：{"messages":[{"senderId":"成员ID","text":"消息正文"}]}，最多 3 条。');
      return { system: base.join('\n'), user: `群聊名称：${conversation.name || '群聊'}\n群公告：${conversation.announcement || '无'}\n请自然延续最近话题。` };
    }
    const p = conversation.person || {};
    base.push(`你正在扮演：${p.name || '角色'}。身份：${p.role || ''}。性格：${p.personality || ''}。外貌：${p.appearance || ''}。说话方式：${p.speech || ''}。背景：${p.background || ''}。人物规则：${p.instructions || ''}。`);
    base.push('返回格式：{"messages":["第一条消息","第二条消息"]}，最多 3 条。');
    return { system: base.join('\n'), user: '请像真实聊天对象一样，自然地想起用户并延续之前的话题。' };
  }

  async function callForegroundAI(api, prompt) {
    const base = String(api?.apiBase || '').trim().replace(/\/+$/, '');
    const key = String(api?.apiKey || '').trim(); const model = String(api?.apiModel || '').trim();
    if (!/^https:\/\//i.test(base) || !key || !model) throw new Error('当前 AI/API 设置不完整。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch(base + '/chat/completions', {
        method:'POST', signal:controller.signal,
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'Accept':'application/json'},
        body:JSON.stringify({ model, messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}], stream:false })
      });
      if (!response.ok) throw new Error('AI 服务返回 HTTP ' + response.status);
      const payload = await response.json(); let content = payload?.choices?.[0]?.message?.content;
      if (Array.isArray(content)) content = content.map((part) => part?.text || '').join('');
      if (typeof content !== 'string' || !content.trim()) throw new Error('AI 没有返回可用消息。');
      return content.trim();
    } finally { clearTimeout(timer); }
  }

  function extractBatch(raw, conversation, maxCount) {
    const data = parseReply(raw);
    const source = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : (data?.text ? [data] : []);
    if (conversation.type === 'group') {
      const members = Array.isArray(conversation.members) ? conversation.members : [];
      return source.slice(0, maxCount).map((item) => {
        const member = members.find((m) => String(m.id) === String(item?.senderId));
        const message = String(item?.text || '').trim().slice(0, 4000);
        return member && message ? { senderId:String(member.id), senderName:String(member.name || '角色'), text:message } : null;
      }).filter(Boolean);
    }
    return source.slice(0, maxCount).map((item) => String(typeof item === 'string' ? item : item?.text || '').trim().slice(0, 4000)).filter(Boolean).map((text) => ({ text }));
  }

  async function runForegroundConversation(snapshot, conversation) {
    const type = conversation.type === 'group' ? 'group' : 'single';
    const id = String(conversation.conversationId || '');
    const key = keyFor(type, id); if (!id || activeRequests.has(key)) return false;
    activeRequests.add(key);
    const state = safeJson(FOREGROUND_KEY, {});
    const now = Date.now();
    state[key] = { ...(state[key] || {}), lastAttemptAt: now };
    writeJson(FOREGROUND_KEY, state);
    try {
      const oneOnly = String(conversation.foregroundMessagesPerRun || '2-3') === '1';
      const maxCount = oneOnly ? 1 : 3;
      const raw = await callForegroundAI(snapshot.apiConfig, foregroundPrompt(conversation, snapshot.userName, maxCount));
      const batch = extractBatch(raw, conversation, maxCount);
      if (!batch.length) throw new Error('AI 没有返回符合角色设定的消息。');
      const baseAt = Date.now();
      const messageIds = [];
      if (type === 'group') {
        if (!window.LRGroupChatActions?.appendMessage) throw new Error('群聊消息模块尚未就绪。');
        for (let i = 0; i < batch.length; i++) {
          const message = await window.LRGroupChatActions.appendMessage({
            senderType:'character', senderId:batch[i].senderId, senderNameSnapshot:batch[i].senderName,
            text:batch[i].text, source:'foreground-autonomy'
          }, id);
          messageIds.push(String(message?.id || (baseAt + '-' + i)));
        }
      } else {
        if (typeof window.readChatThreads !== 'function' || typeof window.writeChatThreads !== 'function') throw new Error('单聊记录模块尚未就绪。');
        const all = window.readChatThreads(); const thread = Array.isArray(all[id]) ? all[id].slice() : [];
        for (let i = 0; i < batch.length; i++) {
          const messageId = 'fg-' + baseAt.toString(36) + '-' + i;
          thread.push({ role:'assistant', text:batch[i].text, at:baseAt + i, foregroundMessageId:messageId });
          messageIds.push(messageId);
        }
        all[id] = thread; window.writeChatThreads(all);
        if (window.LRGroupChatHost?.getActiveChatContactId?.() === id) window.renderChat?.();
      }
      messageIds.forEach((messageId) => window.LRMessageUX?.recordIncoming?.(type, id, messageId, { silent:true }));
      const latest = safeJson(FOREGROUND_KEY, {});
      latest[key] = { ...(latest[key] || {}), lastGeneratedAt:baseAt, lastAttemptAt:baseAt, lastError:'' };
      writeJson(FOREGROUND_KEY, latest);
      if (!isConversationOpen(type, id)) {
        const name = type === 'group' ? String(conversation.name || '群聊') : String(conversation.person?.name || '角色');
        window.LRMessageUX?.notifyIncoming?.({ title:name, preview:batch[0]?.text || '发来新消息', count:batch.length, type, conversationId:id });
      }
      window.LRMessageUX?.render?.();
      console.info('[LOVE RECORD] foreground autonomous messages generated', { type, conversationId:id, count:batch.length });
      return true;
    } catch (error) {
      const latest = safeJson(FOREGROUND_KEY, {});
      latest[key] = { ...(latest[key] || {}), lastAttemptAt:Date.now(), lastError:String(error?.message || error).slice(0, 240) };
      writeJson(FOREGROUND_KEY, latest);
      console.warn('[LOVE RECORD] foreground autonomous generation failed', type, id, error);
      return false;
    } finally { activeRequests.delete(key); }
  }

  async function foregroundTick() {
    if (foregroundBusy || document.visibilityState !== 'visible' || !navigator.onLine) return;
    if (typeof window.__LOVE_RECORD_GET_BACKGROUND_CONTEXT !== 'function') return;
    foregroundBusy = true;
    try {
      const snapshot = await window.__LOVE_RECORD_GET_BACKGROUND_CONTEXT({ includeForeground:true });
      const conversations = (Array.isArray(snapshot?.conversations) ? snapshot.conversations : []).filter((item) => item.foregroundAutonomousEnabled === true);
      if (!conversations.length || !snapshot?.apiConfig?.apiKey) return;
      const state = safeJson(FOREGROUND_KEY, {}); const now = Date.now();
      const due = conversations.filter((item) => {
        const type = item.type === 'group' ? 'group' : 'single'; const key = keyFor(type, item.conversationId);
        const interval = Math.min(30, Math.max(1, Number(item.foregroundIntervalMinutes) || 2)) * 60000;
        const last = Number(state[key]?.lastGeneratedAt || state[key]?.lastAttemptAt || state[key]?.enabledAt || 0);
        if (!last) { state[key] = { ...(state[key] || {}), enabledAt:now }; return false; }
        return now - last >= interval && !activeRequests.has(key);
      }).sort((a,b) => {
        const ka = keyFor(a.type, a.conversationId), kb = keyFor(b.type, b.conversationId);
        return Number(state[ka]?.lastGeneratedAt || state[ka]?.enabledAt || 0) - Number(state[kb]?.lastGeneratedAt || state[kb]?.enabledAt || 0);
      });
      writeJson(FOREGROUND_KEY, state);
      // Process one due conversation at a time to avoid bursts of simultaneous API calls.
      if (due.length) await runForegroundConversation(snapshot, due[0]);
    } catch (error) { console.warn('[LOVE RECORD] foreground autonomy scan skipped', error); }
    finally { foregroundBusy = false; }
  }

  function initializeForegroundState() {
    if (typeof window.__LOVE_RECORD_GET_BACKGROUND_CONTEXT !== 'function') return;
    window.__LOVE_RECORD_GET_BACKGROUND_CONTEXT({ includeForeground:true }).then((snapshot) => {
      const state = safeJson(FOREGROUND_KEY, {}); const now = Date.now(); let changed = false;
      (snapshot?.conversations || []).filter((item) => item.foregroundAutonomousEnabled === true).forEach((item) => {
        const key = keyFor(item.type, item.conversationId);
        if (!state[key]?.enabledAt && !state[key]?.lastGeneratedAt) { state[key] = { ...(state[key] || {}), enabledAt:now }; changed = true; }
      });
      if (changed) writeJson(FOREGROUND_KEY, state);
    }).catch(() => {});
  }

  function settingsChanged() { initializeForegroundState(); renderBadges(); }

  const style = document.createElement('style');
  style.id = 'lr-message-enhancements-style';
  style.textContent = `
    .lr-unread-count{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:#e34c59;color:#fff;font:700 10px/1 system-ui,sans-serif;letter-spacing:0;box-shadow:0 1px 4px rgba(0,0,0,.14);z-index:9}
    .chat-contact-card.lr-has-unread,.lr-group-list-item.lr-has-unread{position:relative}
    .chat-contact-card>.lr-unread-count,.lr-group-list-item>.lr-unread-count{position:absolute;top:8px;right:9px}
    .launcher-app{position:relative}
    .launcher-app>.lr-app-unread-count{position:absolute;top:1px;right:2px;min-width:18px;height:18px;font-size:9px}
    .lr-incoming-message-banner{position:fixed;z-index:2147483646;top:calc(78px + env(safe-area-inset-top));left:12px;right:12px;margin:0 auto;max-width:560px;display:flex;align-items:stretch;gap:5px;padding:7px;border:1px solid rgba(255,255,255,.88);border-radius:20px;background:rgba(255,253,255,.94);box-shadow:0 12px 34px rgba(54,42,66,.2);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);opacity:0;transform:translateY(-12px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}
    .lr-incoming-message-banner.is-visible{opacity:1;transform:translateY(0);pointer-events:auto}
    .lr-incoming-main{display:flex;align-items:center;gap:11px;flex:1;min-width:0;padding:8px 9px;border:0;border-radius:14px;background:transparent;text-align:left;color:#4c4353;font:inherit}
    .lr-incoming-avatar{width:38px;height:38px;min-width:38px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(145deg,#f2e8f7,#d9c6e6);color:#9476a5;font-size:20px}
    .lr-incoming-copy{display:grid;gap:3px;min-width:0;flex:1}
    .lr-incoming-copy strong{font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lr-incoming-copy small{font-size:11px;line-height:1.45;color:#837789;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lr-incoming-copy em{font-size:9px;color:#aa9caf;font-style:normal}
    .lr-incoming-count{align-self:flex-start;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:#e34c59;color:#fff;font:700 10px/19px system-ui;text-align:center}
    .lr-incoming-count[hidden]{display:none}
    .lr-incoming-close{width:28px;min-width:28px;height:28px;align-self:flex-start;border:0;border-radius:50%;background:rgba(240,235,243,.9);color:#8b7e92;font-size:18px;line-height:1}
    @media(prefers-reduced-motion:reduce){.lr-incoming-message-banner{transition:none}}
  `;
  document.head.appendChild(style);

  // Re-apply counts immediately when contact/group rows are rebuilt by their modules.
  if (typeof MutationObserver === 'function' && document.body) {
    const badgeObserver = new MutationObserver(scheduleBadgeRender);
    badgeObserver.observe(document.body, { childList: true, subtree: true });
  }

  window.LRMessageUX = { recordIncoming, markRead, unreadCount, totalUnread, render:renderBadges, showToast, notifyIncoming:showIncomingBanner };
  window.LRForegroundAutonomy = { settingsChanged, scan:foregroundTick };

  // If a cloud push reaches an already-open page, show an in-app alert and import its messages.
  // The Firebase Messaging onMessage hook in lr-background-v1.js invokes syncIncomingMessages.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { foregroundTick(); renderBadges(); } });
  window.addEventListener('online', foregroundTick);
  window.addEventListener('lr-chat-threads-updated', renderBadges);
  window.addEventListener('lr-group-chat-updated', renderBadges);
  setInterval(() => { renderBadges(); foregroundTick(); }, AUTO_TICK_MS);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeForegroundState, { once:true });
  else initializeForegroundState();
  setTimeout(renderBadges, 500);
  setTimeout(renderBadges, 1500);
})();
