/* LOVE RECORD V24 · unified chat CSS editor
   Removes the duplicate legacy CSS editor and expands the single V9 editor
   so one per-contact stylesheet can control all chat message types and tools.
*/
(function () {
  'use strict';
  if (window.__lrChatCssUnifiedV1) return;
  window.__lrChatCssUnifiedV1 = true;

  const EXAMPLE = `/* LOVE RECORD · LAVENDER LIQUID GLASS
   薰衣草液态玻璃主题｜气泡、背景、时间、图片、转账、位置、输入栏和弹窗
*/

/* 聊天背景：柔雾渐层 */
#chatMessages {
  background:
    radial-gradient(circle at 15% 12%, rgba(224,196,244,.48), transparent 38%),
    radial-gradient(circle at 88% 78%, rgba(194,184,235,.42), transparent 42%),
    linear-gradient(145deg, #f8f4fc, #eee8f7) !important;
}

/* 我的气泡：紫水晶玻璃（排除转账卡片外层） */
#chatMessages .chat-message-row.user .chat-bubble:not(.lr-transfer-bubble) {
  background: linear-gradient(135deg, rgba(222,202,242,.78), rgba(205,184,231,.58)) !important;
  color: #493957 !important;
  border: 1px solid rgba(255,255,255,.88) !important;
  border-radius: 23px 23px 7px 23px !important;
  box-shadow: 0 8px 26px rgba(116,88,145,.12), inset 0 1px 0 rgba(255,255,255,.8) !important;
  backdrop-filter: blur(22px) saturate(155%) !important;
  -webkit-backdrop-filter: blur(22px) saturate(155%) !important;
}

/* AI 气泡：雾白玻璃 */
#chatMessages .chat-message-row.ai .chat-bubble:not(.lr-transfer-bubble) {
  background: rgba(255,255,255,.72) !important;
  color: #3e3546 !important;
  border: 1px solid rgba(255,255,255,.92) !important;
  border-radius: 23px 23px 23px 7px !important;
  box-shadow: 0 8px 25px rgba(85,67,105,.075), inset 0 1px 0 rgba(255,255,255,.95) !important;
  backdrop-filter: blur(24px) saturate(145%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(145%) !important;
}

/* 消息排布与时间 */
#chatMessages .chat-message-row { gap: 8px !important; margin-bottom: 7px !important; }
#chatMessages .lr-message-time { color: #9b8da8 !important; font-size: 10px !important; }

/* 图片 */
#chatMessages .lr-chat-image {
  border-radius: 19px !important;
  border: 1px solid rgba(255,255,255,.9) !important;
  box-shadow: 0 9px 26px rgba(79,61,99,.16) !important;
}

/* 转账：独立玻璃卡，不要外层重复气泡 */
#chatMessages .chat-message-row .chat-bubble.lr-transfer-bubble {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
  overflow: visible !important;
  max-width: min(78%, 430px) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
#chatMessages .lr-transfer-bubble .lr-transfer-card {
  display: block !important;
  box-sizing: border-box !important;
  width: min(260px, 68vw) !important;
  min-width: 0 !important;
  padding: 23px 21px !important;
  background: linear-gradient(145deg, rgba(205,174,226,.88), rgba(151,119,177,.84)) !important;
  color: #fff !important;
  border: 1px solid rgba(255,255,255,.78) !important;
  border-radius: 27px !important;
  box-shadow: 0 14px 34px rgba(112,79,139,.22), inset 0 1px 0 rgba(255,255,255,.48) !important;
  backdrop-filter: blur(28px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(150%) !important;
}
#chatMessages .lr-transfer-card small { letter-spacing: 2.8px !important; opacity: .82 !important; }
#chatMessages .lr-transfer-card strong { font: 30px Georgia,serif !important; font-weight: 400 !important; }
#chatMessages .lr-transfer-card span { color: rgba(255,255,255,.92) !important; }

/* 位置卡片 */
#chatMessages .lr-location-card {
  display: block !important; min-width: 190px !important; padding: 16px !important;
  background: rgba(255,255,255,.68) !important; color: #594a66 !important;
  border: 1px solid rgba(255,255,255,.9) !important; border-radius: 21px !important;
  text-decoration: none !important; box-shadow: 0 8px 24px rgba(95,72,118,.1) !important;
  backdrop-filter: blur(20px) saturate(145%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(145%) !important;
}
#chatMessages .lr-location-pin { background: rgba(220,202,237,.72) !important; color: #866a9c !important; border-radius: 15px !important; }

/* 输入栏与文字框 */
#chatConversation .chat-compose {
  background: rgba(255,255,255,.72) !important;
  border: 1px solid rgba(255,255,255,.92) !important;
  border-radius: 26px !important;
  box-shadow: 0 10px 30px rgba(92,70,112,.10), inset 0 1px 0 rgba(255,255,255,.95) !important;
  backdrop-filter: blur(26px) saturate(155%) !important;
  -webkit-backdrop-filter: blur(26px) saturate(155%) !important;
}
#chatConversation .chat-compose textarea {
  background: rgba(255,255,255,.56) !important; color: #4d4057 !important;
  border: 1px solid rgba(255,255,255,.7) !important; border-radius: 17px !important;
}

/* 加号与弹出菜单 */
#lrChatPlus { background: rgba(255,255,255,.76) !important; color: #9478a7 !important; border: 1px solid rgba(255,255,255,.95) !important; border-radius: 16px !important; }
#lrChatPlusMenu {
  background: rgba(255,252,255,.78) !important; border: 1px solid rgba(255,255,255,.92) !important;
  border-radius: 22px !important; box-shadow: 0 14px 38px rgba(75,55,94,.16) !important;
  backdrop-filter: blur(26px) saturate(150%) !important; -webkit-backdrop-filter: blur(26px) saturate(150%) !important;
}
#lrChatPlusMenu button { color: #594a66 !important; border-radius: 14px !important; }

/* 行程、心声、转账和位置弹窗 */
#lrScheduleModal .lr-action-sheet, #lrThoughtModal .lr-thought-sheet,
#lrTransferModal .lr-action-sheet, #lrLocationModal .lr-action-sheet {
  background: rgba(255,252,255,.82) !important; color: #493d52 !important;
  border: 1px solid rgba(255,255,255,.95) !important; border-radius: 29px !important;
  box-shadow: 0 20px 60px rgba(70,50,88,.18) !important;
  backdrop-filter: blur(28px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(150%) !important;
}
#lrScheduleModal .lr-schedule-item { background: rgba(255,255,255,.62) !important; border: 1px solid rgba(255,255,255,.9) !important; border-radius: 19px !important; }
#lrScheduleModal .lr-schedule-time { color: #9879aa !important; }
#lrScheduleModal .lr-schedule-title { color: #4b3c53 !important; }
#lrScheduleModal .lr-schedule-detail { color: #8f8296 !important; }
#lrThoughtModal #lrThoughtText { color: #71627a !important; line-height: 1.9 !important; }
#lrTransferModal .lr-transfer-preview { background: linear-gradient(145deg, rgba(205,174,226,.9), rgba(151,119,177,.9)) !important; border: 1px solid rgba(255,255,255,.75) !important; border-radius: 24px !important; }
#lrLocationModal input, #lrLocationModal textarea, #lrTransferModal input {
  background: rgba(255,255,255,.72) !important; color: #4d4057 !important;
  border: 1px solid rgba(255,255,255,.92) !important; border-radius: 16px !important;
}
#lrScheduleModal .lr-action-buttons button, #lrThoughtModal .lr-action-buttons button,
#lrTransferModal .lr-action-buttons button, #lrLocationModal .lr-action-buttons button {
  border-radius: 999px !important;
}`;

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
        #chatMessages .chat-message-row .chat-bubble.lr-transfer-bubble{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;overflow:visible!important;max-width:min(78%,430px)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
        #chatMessages .chat-message-row .lr-transfer-bubble .lr-transfer-card{box-sizing:border-box;display:block;min-width:0;max-width:min(260px,68vw);padding:20px}
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
