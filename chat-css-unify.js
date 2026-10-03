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

/* 转账消息：去掉外层普通气泡，只保留转账卡片本身 */
#chatMessages .chat-bubble.lr-transfer-bubble {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
  overflow: visible !important;
}
#chatMessages .lr-transfer-bubble .lr-transfer-card {
  display: block !important;
  box-sizing: border-box !important;
  min-width: 220px !important;
  max-width: min(260px, 68vw) !important;
  padding: 20px !important;
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
    if (!section) return;
    if (section.dataset.lrUnifiedCss === '1') {
      ensurePresetUI(section);
      return;
    }
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
    ensurePresetUI(section);
  }

  const PRESET_KEY = 'loveRecordChatCssPresetsV1';

  function readPresets() {
    try {
      const value = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]');
      return Array.isArray(value) ? value.filter(item => item && typeof item.name === 'string' && typeof item.css === 'string') : [];
    } catch (_) { return []; }
  }

  function writePresets(items) {
    localStorage.setItem(PRESET_KEY, JSON.stringify(items));
  }

  function ensurePresetUI(section) {
    if (section.querySelector('#lrCssPresetManager')) return;
    const area = document.createElement('div');
    area.id = 'lrCssPresetManager';
    area.innerHTML = `
      <div class="lr-css-preset-heading">我的 CSS 主题预设</div>
      <input id="lrCssPresetName" type="text" maxlength="40" placeholder="输入预设名称，例如：薰衣草液态玻璃">
      <div class="lr-css-preset-row">
        <select id="lrCssPresetSelect"><option value="">选择已保存的主题</option></select>
        <button type="button" id="lrCssPresetApply">应用</button>
      </div>
      <div class="lr-css-preset-row lr-css-preset-actions">
        <button type="button" id="lrCssPresetSave">保存当前 CSS</button>
        <button type="button" id="lrCssPresetDelete">删除预设</button>
      </div>
      <div class="lr-css-preset-row lr-css-preset-actions">
        <button type="button" id="lrCssPresetExport">导出主题</button>
        <button type="button" id="lrCssPresetImport">导入主题</button>
        <input id="lrCssPresetFile" type="file" accept="application/json,.json" hidden>
      </div>
      <div class="lr-css-preset-hint">主题保存在当前浏览器。导出 JSON 后可备份或转移到其他设备。</div>`;
    const actions = section.querySelector('.lr-v9-actions');
    if (actions) actions.insertAdjacentElement('afterend', area);
    else section.appendChild(area);

    const style = document.createElement('style');
    style.id = 'lr-css-preset-style';
    style.textContent = `
      #lrCssPresetManager{margin-top:16px;padding:15px;border:1px solid #e9e0ec;border-radius:18px;background:rgba(250,247,252,.82)}
      #lrCssPresetManager .lr-css-preset-heading{font-size:14px;font-weight:600;color:#594b60;margin-bottom:10px}
      #lrCssPresetManager input,#lrCssPresetManager select{box-sizing:border-box;width:100%;min-width:0;min-height:43px;padding:9px 12px;border:1px solid #e6dce9;border-radius:12px;background:#fff;color:#514657;font:inherit}
      #lrCssPresetManager .lr-css-preset-row{display:flex;gap:8px;margin-top:9px}
      #lrCssPresetManager button{flex:1;min-height:40px;padding:7px 10px;border:1px solid #e5d9e9;border-radius:999px;background:#fff;color:#65536d;font:inherit;font-size:12px}
      #lrCssPresetManager #lrCssPresetSave,#lrCssPresetManager #lrCssPresetApply{background:#b99fc8;color:#fff;border-color:#b99fc8}
      #lrCssPresetManager .lr-css-preset-hint{margin-top:9px;color:#988b9d;font-size:11px;line-height:1.6}
      @media(max-width:380px){#lrCssPresetManager .lr-css-preset-row{gap:5px}#lrCssPresetManager button{font-size:11px;padding:6px}}
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    const select = area.querySelector('#lrCssPresetSelect');
    const refresh = selected => {
      const items = readPresets();
      select.innerHTML = '<option value="">选择已保存的主题</option>';
      items.forEach((item, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = item.name;
        select.appendChild(option);
      });
      if (selected !== undefined && items[selected]) select.value = String(selected);
    };
    refresh();

    area.querySelector('#lrCssPresetSave').addEventListener('click', () => {
      const name = area.querySelector('#lrCssPresetName').value.trim();
      const box = section.querySelector('#lrChatCustomCss');
      const value = box ? box.value : '';
      if (!name) { alert('先给这套 CSS 主题起个名字哦'); return; }
      if (!value.trim()) { alert('CSS 内容为空，暂时不能保存'); return; }
      const items = readPresets();
      const existing = items.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
      if (existing >= 0) {
        if (!confirm('已经有同名预设，要覆盖它吗？')) return;
        items[existing] = {name, css:value, updatedAt:new Date().toISOString()};
        writePresets(items); refresh(existing);
      } else {
        items.push({name, css:value, updatedAt:new Date().toISOString()});
        writePresets(items); refresh(items.length - 1);
      }
      alert('主题预设已保存 ♡');
    });
    area.querySelector('#lrCssPresetApply').addEventListener('click', () => {
      const index = Number(select.value), items = readPresets(), item = items[index];
      if (!item) { alert('请先选择一个已保存的主题'); return; }
      const box = section.querySelector('#lrChatCustomCss');
      if (box) {
        box.value = item.css;
        box.dispatchEvent(new Event('input', {bubbles:true}));
        box.dispatchEvent(new Event('change', {bubbles:true}));
      }
      area.querySelector('#lrCssPresetName').value = item.name;
      alert('已载入主题。记得点击页面底部「保存设置」哦 ♡');
    });
    area.querySelector('#lrCssPresetDelete').addEventListener('click', () => {
      const index = Number(select.value), items = readPresets();
      if (!items[index]) { alert('请先选择要删除的预设'); return; }
      if (!confirm('确定删除「' + items[index].name + '」吗？')) return;
      items.splice(index,1); writePresets(items); refresh();
    });
    area.querySelector('#lrCssPresetExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(readPresets(), null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'love-record-css-presets.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const file = area.querySelector('#lrCssPresetFile');
    area.querySelector('#lrCssPresetImport').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const picked = file.files && file.files[0]; if (!picked) return;
      try {
        const parsed = JSON.parse(await picked.text());
        const incoming = Array.isArray(parsed) ? parsed : [parsed];
        const items = readPresets();
        incoming.forEach(item => {
          if (!item || typeof item.name !== 'string' || typeof item.css !== 'string') return;
          const index = items.findIndex(old => old.name.toLowerCase() === item.name.toLowerCase());
          if (index >= 0) items[index] = {name:item.name, css:item.css, updatedAt:new Date().toISOString()};
          else items.push({name:item.name, css:item.css, updatedAt:new Date().toISOString()});
        });
        writePresets(items); refresh();
        alert('主题导入完成 ♡');
      } catch (_) { alert('导入失败：请选择 LOVE RECORD 导出的 JSON 预设文件'); }
      file.value = '';
    });
  }

  function start() {
    if (!document.getElementById('lr-transfer-single-card-fix')) {
      const fix = document.createElement('style');
      fix.id = 'lr-transfer-single-card-fix';
      fix.textContent = `
        #chatMessages .chat-bubble.lr-transfer-bubble{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;overflow:visible!important;max-width:min(78%,430px)!important}
        #chatMessages .lr-transfer-bubble .lr-transfer-card{box-sizing:border-box;display:block;min-width:220px;max-width:min(260px,68vw);padding:20px}
      `;
      document.head.appendChild(fix);
    }
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
