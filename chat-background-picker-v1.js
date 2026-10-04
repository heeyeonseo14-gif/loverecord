/* LOVE RECORD V24 · Reliable chat wallpaper picker */
(function () {
  'use strict';
  if (window.__lrBackgroundPickerV1) return;
  window.__lrBackgroundPickerV1 = true;

  document.addEventListener('click', function (event) {
    const button = event.target && event.target.closest && event.target.closest('#chatChooseBackground');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const input = document.getElementById('chatBackgroundFile');
    if (!input) {
      if (typeof window.toast === 'function') window.toast('找不到背景图片选择框，请刷新页面。');
      return;
    }
    // Keep the native file input available to Android/iOS pickers.
    input.removeAttribute('hidden');
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.value = '';
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch (error) {
      try { input.click(); }
      catch (fallbackError) {
        console.error('[LOVE RECORD] cannot open wallpaper picker:', error, fallbackError);
        if (typeof window.toast === 'function') window.toast('无法打开图片选择器，请刷新页面后重试。');
      }
    }
  }, true);

  // Do not intercept the change event: index.html owns the actual image
  // compression and assigns the result to its lexical editingChatMeta state.
})();
