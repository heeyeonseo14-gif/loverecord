/* LOVE RECORD V24 · Unified chat settings + image prompt persistence fix */
(function () {
  'use strict';
  const PROMPT_DB = 'love-record-extra-v1';
  const PROMPT_STORE = 'assets';
  function openPromptDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(PROMPT_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(PROMPT_STORE)) {
          request.result.createObjectStore(PROMPT_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开提示词数据库'));
    });
  }
  async function savePrompt(contactId, value) {
    const text = String(value ?? '');
    const db = await openPromptDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PROMPT_STORE, 'readwrite');
        tx.objectStore(PROMPT_STORE).put({ key: 'prompt:' + String(contactId), value: text });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('提示词写入失败'));
        tx.onabort = () => reject(tx.error || new Error('提示词写入中断'));
      });
      const verified = await new Promise((resolve, reject) => {
        const tx = db.transaction(PROMPT_STORE, 'readonly');
        const req = tx.objectStore(PROMPT_STORE).get('prompt:' + String(contactId));
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error || new Error('提示词读取校验失败'));
      });
      if (verified !== text) throw new Error('提示词保存后复读不一致');
      try { localStorage.setItem('lr-chat-image-prompt-v1:' + String(contactId), text); } catch (_) {}
      return text;
    } finally {
      db.close();
    }
  }

  document.addEventListener('click', async function (event) {
    const button = event.target && event.target.closest ? event.target.closest('#chatSaveSettings') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '保存中…';
    try {
      const contactId = String(window.__lrGetActiveChatContactId?.() || window.activeChatContactId || '');
      if (!contactId) throw new Error('请先打开一位联系人的聊天设置。');
      const promptInput = document.getElementById('lrChatImagePrompt');
      // Empty text is a deliberate value: persist it as empty, never fall back to old prompt text.
      const promptValue = String(promptInput?.value ?? '').replace(/\r\n?/g, '\n').trim();
      const next = Object.assign({}, editingChatMeta || {});
      next.remark = document.getElementById('chatRemarkInput')?.value.trim() || '';
      next.personaId = document.getElementById('lrPersonaSelect')?.value || '';
      next.worldId = document.getElementById('lrWorldSelect')?.value || '';
      const rawCount = parseInt(document.getElementById('lrMemoryCount')?.value || '16', 10);
      next.memoryCount = Math.min(100, Math.max(1, Number.isFinite(rawCount) ? rawCount : 16));
      next.userBubbleColor = document.getElementById('lrUserBubbleColor')?.value || next.userBubbleColor || '#b99ac7';
      next.aiBubbleColor = document.getElementById('lrAiBubbleColor')?.value || next.aiBubbleColor || '#ffffff';
      next.userTextColor = document.getElementById('lrUserTextColor')?.value || next.userTextColor || '#ffffff';
      next.aiTextColor = document.getElementById('lrAiTextColor')?.value || next.aiTextColor || '#28242b';
      next.bubbleRadius = Math.min(36, Math.max(8, parseInt(document.getElementById('lrBubbleRadius')?.value || next.bubbleRadius || '22', 10) || 22));
      next.chatCustomCss = document.getElementById('lrChatCustomCss')?.value || '';
      next.autoMemoryCount = Math.min(100, Math.max(1, parseInt(document.getElementById('lrAutoMemoryCount')?.value || next.autoMemoryCount || '15', 10) || 15));
      next.imagePrompt = promptValue;

      const countInput = document.getElementById('lrMemoryCount');
      if (countInput) countInput.value = next.memoryCount;
      if (typeof window.saveChatMetaSafely !== 'function') throw new Error('聊天存储模块尚未准备好，请刷新后重试。');
      // Save both stores in the same click path; the previous document-level capture handler
      // stopped the button-level prompt handler from ever running.
      await savePrompt(contactId, promptValue);
      const saved = await window.saveChatMetaSafely(contactId, next);
      for (const key of ['remark', 'personaId', 'worldId', 'memoryCount', 'imagePrompt']) {
        if (String(saved[key] ?? '') !== String(next[key] ?? '')) throw new Error('保存校验失败：' + key + '，请重试。');
      }
      editingChatMeta = Object.assign({}, saved);
      closeChatSettings();
      toast('聊天设置与生图提示词已保存并校验 ♡');
    } catch (error) {
      console.error('[LOVE RECORD] unified chat/prompt save failed:', error);
      const message = error && error.message ? error.message : '请检查浏览器储存空间';
      if (typeof toast === 'function') toast('保存失败：' + message);
      else alert('保存失败：' + message);
    } finally {
      button.disabled = false;
      button.textContent = originalText || '保存设置';
    }
  }, true);
})();
