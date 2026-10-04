/* LOVE RECORD V24 — split one AI turn into separate chat bubbles.
   Keeps each stored assistant turn intact; this is a presentation-only change. */
(function () {
  'use strict';
  if (window.__lrBubbleSplitInstalled) return;
  window.__lrBubbleSplitInstalled = true;

  const STYLE_ID = 'lr-chat-bubble-split-style';
  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .lr-inline-narration{font-style:italic;color:inherit;opacity:.72;font-size:.94em}.lr-ai-message-stack{display:flex;flex-direction:column;align-items:flex-start;gap:6px;max-width:min(76%,430px);min-width:0}
      .lr-ai-message-stack .chat-bubble{max-width:100%;width:fit-content;box-sizing:border-box}
      .lr-ai-message-stack .lr-ai-bubble-first{border-top-left-radius:5px;border-bottom-left-radius:15px}
      .lr-ai-message-stack .lr-ai-bubble-middle{border-radius:15px}
      .lr-ai-message-stack .lr-ai-bubble-last{border-top-left-radius:15px;border-bottom-left-radius:5px}
      .lr-ai-message-stack .lr-ai-bubble-single{border-top-left-radius:5px;border-bottom-left-radius:5px}
    `;
    document.head.appendChild(style);
  }

  function splitText(value) {
    const text = String(value == null ? '' : value).replace(/\r\n?/g, '\n').trim();
    if (!text) return [];
    let parts = text.split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
    // Some models use single line breaks instead of paragraph breaks.
    if (parts.length === 1 && parts[0].includes('\n')) {
      const lines = parts[0].split('\n').map(x => x.trim()).filter(Boolean);
      if (lines.length > 1) parts = lines;
    }
    return parts.length ? parts : [text];
  }

  function splitRenderedMessages() {
    const host = document.getElementById('chatMessages');
    if (!host) return;
    host.querySelectorAll('.chat-message-row.ai').forEach(row => {
      if (row.dataset.lrSplitApplied === '1') return;
      const original = row.querySelector(':scope > .chat-bubble.ai');
      if (!original || original.querySelector('.lr-inline-narration')) return;
      const parts = splitText(original.textContent);
      if (parts.length <= 1) return;

      const stack = document.createElement('div');
      stack.className = 'lr-ai-message-stack';
      parts.forEach((part, index) => {
        const bubble = document.createElement('div');
        let shape = 'middle';
        if (parts.length === 1) shape = 'single';
        else if (index === 0) shape = 'first';
        else if (index === parts.length - 1) shape = 'last';
        bubble.className = 'chat-bubble ai lr-ai-bubble lr-ai-bubble-' + shape;
        bubble.textContent = part;
        stack.appendChild(bubble);
      });
      original.replaceWith(stack);
      row.dataset.lrSplitApplied = '1';
    });
  }

  function install() {
    addStyles();
    if (typeof window.renderChat === 'function') {
      const originalRender = window.renderChat;
      window.renderChat = function () {
        const result = originalRender.apply(this, arguments);
        splitRenderedMessages();
        return result;
      };
      splitRenderedMessages();
    } else {
      // Fallback for a slow script load or a future render function setup.
      const observer = new MutationObserver(() => {
        if (typeof window.renderChat === 'function') {
          observer.disconnect();
          install();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  install();
})();
