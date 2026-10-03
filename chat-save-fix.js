/* LOVE RECORD V24 · Save settings through IndexedDB-backed chat metadata */
(function () {
  'use strict';
  document.addEventListener('click', async function (event) {
    const button = event.target && event.target.closest ? event.target.closest('#chatSaveSettings') : null;
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '保存中…';
    try {
      if (!activeChatContactId) throw new Error('请先打开一位联系人的聊天设置。');
      const next = Object.assign({}, editingChatMeta || {});
      next.remark = document.getElementById('chatRemarkInput').value.trim();
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

      const countInput = document.getElementById('lrMemoryCount');
      if (countInput) countInput.value = next.memoryCount;
      if (typeof window.saveChatMetaSafely !== 'function') throw new Error('聊天存储模块尚未准备好，请刷新后重试。');
      const saved = await window.saveChatMetaSafely(activeChatContactId, next);
      for (const key of ['remark', 'personaId', 'worldId', 'memoryCount']) {
        if (String(saved[key] ?? '') !== String(next[key] ?? '')) throw new Error('保存校验失败，请重试。');
      }
      editingChatMeta = Object.assign({}, saved);
      closeChatSettings();
      toast('聊天设置已保存 ♡');
    } catch (error) {
      console.error('[LOVE RECORD] save failed:', error);
      const message = error && error.message ? error.message : '请检查浏览器储存空间';
      if (typeof toast === 'function') toast('保存失败：' + message);
      else alert('保存失败：' + message);
    } finally {
      button.disabled = false;
      button.textContent = originalText || '保存设置';
    }
  }, true);
})();
