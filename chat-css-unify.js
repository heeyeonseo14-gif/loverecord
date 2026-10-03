/* LOVE RECORD V24 · unified chat CSS editor
   Removes the duplicate legacy CSS editor and expands the single V9 editor
   so one per-contact stylesheet can control all chat message types and tools.
*/
(function () {
  'use strict';
  if (window.__lrChatCssUnifiedV1) return;
  window.__lrChatCssUnifiedV1 = true;

  const EXAMPLE = `/* LOVE RECORD · 完整聊天样式示例
   这份示例包含：双方气泡、聊天背景、时间戳、图片、转账、位置、
   输入栏、加号菜单、角色行程和角色心声。可以按需修改或删除。
*/

/* 聊天背景 */
#chatMessages {
  background: #f8f3fa !important;
}

/* 我的消息气泡 */
#chatMessages .chat-message-row.user .chat-bubble {
  background: #dec9ed !important;
  color: #493653 !important;
  border: 1px solid #d2b8e2 !important;
  border-radius: 22px 22px 6px 22px !important;
  box-shadow: 0 4px 14px rgba(125, 94, 143, .08) !important;
}

/* AI 消息气泡 */
#chatMessages .chat-message-row.ai .chat-bubble {
  background: #ffffff !important;
  color: #39333e !important;
  border: 1px solid #eee5f1 !important;
  border-radius: 22px 22px 22px 6px !important;
  box-shadow: 0 4px 14px rgba(75, 58, 88, .06) !important;
}

/* 消息之间的间距 */
#chatMessages .chat-message-row {
  gap: 9px !important;
  margin-bottom: 5px !important;
}

/* 时间戳 */
#chatMessages .lr-message-time {
  color: #9c8ca4 !important;
  font-size: 10px !important;
}

/* 图片消息 */
#chatMessages .lr-chat-image {
  border-radius: 16px !important;
  border: 2px solid #ffffff !important;
  box-shadow: 0 5px 16px rgba(75, 58, 88, .12) !important;
}

/* 转账卡片 */
#chatMessages .lr-transfer-card {
  background: linear-gradient(145deg, #c7a9d5, #9876a9) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255,255,255,.45) !important;
  border-radius: 22px !important;
  box-shadow: 0 9px 24px rgba(126, 93, 143, .18) !important;
}
#chatMessages .lr-transfer-card small {
  letter-spacing: 2.5px !important;
  opacity: .78 !important;
}
#chatMessages .lr-transfer-card strong {
  font-size: 30px !important;
}
#chatMessages .lr-transfer-card span {
  color: rgba(255,255,255,.9) !important;
}

/* 位置分享卡片 */
#chatMessages .lr-location-card {
  display: block !important;
  min-width: 190px !important;
  padding: 15px !important;
  background: #f4edf8 !important;
  color: #55445f !important;
  border: 1px solid #e5d8ed !important;
  border-radius: 18px !important;
  text-decoration: none !important;
}
#chatMessages .lr-location-pin {
  background: #e4d4ed !important;
  color: #896b9b !important;
  border-radius: 14px !important;
}

/* 底部输入栏 */
#chatConversation .chat-compose {
  background: rgba(255,255,255,.94) !important;
  border: 1px solid #e8deed !important;
  border-radius: 24px !important;
  box-shadow: 0 7px 22px rgba(75, 58, 88, .08) !important;
}

/* 左侧加号按钮 */
#lrChatPlus {
  background: #ffffff !important;
  color: #9b7cac !important;
  border: 1px solid #e4d8e9 !important;
  border-radius: 15px !important;
}

/* 加号弹出菜单 */
#lrChatPlusMenu {
  background: #fffaff !important;
  border: 1px solid #e7dbea !important;
  border-radius: 20px !important;
  box-shadow: 0 12px 34px rgba(70, 48, 82, .14) !important;
}
#lrChatPlusMenu button {
  color: #55445f !important;
  border-radius: 13px !important;
}

/* 行程弹窗与行程项目 */
#lrScheduleModal .lr-action-sheet {
  background: #fffaff !important;
  border: 1px solid #eadfee !important;
  border-radius: 27px !important;
}
#lrScheduleModal .lr-schedule-item {
  background: #fbf7fd !important;
  border: 1px solid #eee4f2 !important;
  border-radius: 17px !important;
}
#lrScheduleModal .lr-schedule-time {
  color: #9878a8 !important;
}
#lrScheduleModal .lr-schedule-title {
  color: #4b3c53 !important;
}
#lrScheduleModal .lr-schedule-detail {
  color: #8f8296 !important;
}

/* 角色心声弹窗 */
#lrThoughtModal .lr-thought-sheet {
  background: #fffaff !important;
  border: 1px solid #eadfee !important;
  border-radius: 27px !important;
}
#lrThoughtModal #lrThoughtText {
  color: #71627a !important;
  line-height: 1.9 !important;
}

/* 转账 / 位置编辑弹窗 */
#lrTransferModal .lr-action-sheet,
#lrLocationModal .lr-action-sheet {
  background: #fffaff !important;
  border: 1px solid #eadfee !important;
  border-radius: 27px !important;
}
#lrTransferModal .lr-transfer-preview {
  background: linear-gradient(145deg, #c7a9d5, #9876a9) !important;
  border-radius: 21px !important;
}
#lrLocationModal input,
#lrLocationModal textarea,
#lrTransferModal input {
  background: #fbf7fd !important;
  border-color: #e7dbea !important;
  border-radius: 15px !important;
}

/* 弹窗按钮 */
#lrScheduleModal .lr-action-buttons button,
#lrThoughtModal .lr-action-buttons button,
#lrTransferModal .lr-action-buttons button,
#lrLocationModal .lr-action-buttons button {
  border-radius: 999px !important;
}
`;

  function customizeEditor() {
    const legacy = document.getElementById('lr-chat-settings-extra');
    if (legacy) {
      legacy.querySelectorAll('section').forEach(section => {
        const heading = section.querySelector('h3');
        if (heading && /自定义聊天\s*CSS/i.test(heading.textContent || '')) {
          section.remove();
        }
      });
    }

    const v9 = document.getElementById('lrChatV9Settings');
    if (!v9) return;
    const section = Array.from(v9.querySelectorAll('section')).find(item => {
      const heading = item.querySelector('h3');
      return heading && /自定义聊天\s*CSS|聊天界面自定义 CSS/.test(heading.textContent || '');
    });
    if (!section || section.dataset.lrUnifiedCss === '1') return;
    section.dataset.lrUnifiedCss = '1';

    const heading = section.querySelector('h3');
    if (heading) heading.textContent = '聊天界面自定义 CSS';

    const desc = section.querySelector('.sub');
    if (desc) desc.textContent = '统一调整当前联系人的整个聊天界面：消息气泡、文字、背景、时间戳、图片、转账、位置、输入栏、加号菜单、角色行程和角色心声。修改后点击底部「保存设置」生效。';

    const textarea = section.querySelector('#lrChatCustomCss');
    if (textarea) {
      textarea.placeholder = '可点击「填入完整示例 CSS」，再按自己的喜好修改。';
      textarea.style.minHeight = '230px';
      textarea.style.fontSize = '12px';
      textarea.style.lineHeight = '1.65';
    }

    const actions = section.querySelector('.lr-v9-actions');
    if (actions) {
      const reset = section.querySelector('#lrResetChatCss');
      if (reset) reset.textContent = '清空自定义样式';
      if (!section.querySelector('#lrUnifiedCssExample')) {
        const example = document.createElement('button');
        example.type = 'button';
        example.className = 'btn';
        example.id = 'lrUnifiedCssExample';
        example.textContent = '填入完整示例 CSS';
        if (reset) actions.insertBefore(example, reset);
        else actions.appendChild(example);
        example.addEventListener('click', () => {
          const box = section.querySelector('#lrChatCustomCss');
          if (box) {
            box.value = EXAMPLE;
            box.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }
    }
  }

  function start() {
    customizeEditor();
    const screen = document.getElementById('chatSettingsScreen');
    if (screen) {
      new MutationObserver(customizeEditor).observe(screen, { childList: true, subtree: true });
    } else {
      const observer = new MutationObserver(() => {
        const target = document.getElementById('chatSettingsScreen');
        if (target) {
          observer.disconnect();
          new MutationObserver(customizeEditor).observe(target, { childList: true, subtree: true });
          customizeEditor();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    [100, 350, 900, 1800].forEach(ms => setTimeout(customizeEditor, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
