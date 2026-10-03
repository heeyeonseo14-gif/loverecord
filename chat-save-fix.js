/* LOVE RECORD V24 · chat settings save safety patch */
(function () {
  'use strict';
  document.addEventListener('click', function (event) {
    const button = event.target && event.target.closest
      ? event.target.closest('#chatSaveSettings') : null;
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (!window.activeChatContactId && typeof activeChatContactId !== 'undefined' && !activeChatContactId) {
        throw new Error('请先打开一位联系人的聊天设置。');
      }
      const next = Object.assign({}, editingChatMeta || {});
      next.remark = document.getElementById('chatRemarkInput').value.trim();
      next.personaId = document.getElementById('lrPersonaSelect').value || '';
      next.worldId = document.getElementById('lrWorldSelect').value || '';
      const rawCount = parseInt(document.getElementById('lrMemoryCount').value, 10);
      next.memoryCount = Math.min(100, Math.max(1, Number.isFinite(rawCount) ? rawCount : 16));
      document.getElementById('lrMemoryCount').value = next.memoryCount;

      writeChatMeta(activeChatContactId, next);
      const saved = chatMeta(activeChatContactId);
      if (saved.remark !== next.remark ||
          saved.personaId !== next.personaId ||
          saved.worldId !== next.worldId ||
          Number(saved.memoryCount) !== Number(next.memoryCount) ||
          (saved.myAvatar || '') !== (next.myAvatar || '')) {
        throw new Error('保存后校验失败，可能是浏览器储存空间不足。');
      }

      editingChatMeta = next;
      closeChatSettings();
      toast('聊天设置已保存 ♡');
    } catch (error) {
      console.error('[LOVE RECORD] save failed:', error);
      if (typeof toast === 'function') {
        toast('保存失败：' + (error && error.message ? error.message : '请检查浏览器储存空间'));
      } else {
        alert('保存失败：' + (error && error.message ? error.message : '请检查浏览器储存空间'));
      }
    }
  }, true);
})();
