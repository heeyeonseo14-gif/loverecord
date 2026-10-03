/* LOVE RECORD · SPACE typography + writing presets + response length */
(() => {
  if (window.__lrSpaceReadingPatchV1) return;
  window.__lrSpaceReadingPatchV1 = true;

  const $ = id => document.getElementById(id);
  const modal = $('spaceStyleModal');
  if (!modal) return;

  const activeId = () => {
    try { return (typeof activeSpace === 'function' && activeSpace()?.id) || 'default'; }
    catch (_) { return 'default'; }
  };
  const settingsKey = () => `loveRecordSpaceWriting:${activeId()}`;
  const presetsKey = () => `loveRecordSpaceWritingPresets:${activeId()}`;
  let writing = { style: '', limit: 0 };
  let writingPresets = [];

  const styleBlock = document.createElement('style');
  styleBlock.id = 'lrSpaceReadingStyles';
  styleBlock.textContent = `
    #space .scene-text { display:none !important; }
    #space .scene-quote {
      display:block !important; font-style:normal !important;
      font-size:var(--space-body-size,16px) !important;
      line-height:2 !important; white-space:normal !important;
      margin-top:18px !important;
    }
    #space .scene-quote .lr-space-paragraph {
      display:block; margin:0 0 1.25em !important;
      font-style:normal !important; line-height:2 !important;
      font-size:var(--space-body-size,16px) !important;
      letter-spacing:.015em;
    }
    #space .scene-quote .lr-space-aside {
      display:block; margin:1.2em 0 1.35em !important;
      color:#827487; font-style:italic !important;
      font-size:var(--space-aside-size,14px) !important;
      line-height:2 !important; letter-spacing:.025em;
    }
    #space .scene-quote .lr-space-paragraph:last-child,
    #space .scene-quote .lr-space-aside:last-child { margin-bottom:0 !important; }
    .lr-writing-panel { margin:16px 0 18px; padding:16px; border:1px solid rgba(185,155,200,.28); border-radius:19px; background:rgba(246,240,249,.72); }
    .lr-writing-panel h3 { margin:0 0 7px; font-size:14px; font-weight:500; color:#514458; }
    .lr-writing-panel p { margin:0 0 11px; font-size:11px; line-height:1.65; color:#938797; }
    .lr-writing-panel textarea,.lr-writing-panel input { width:100%; border:1px solid #e3dce7; border-radius:14px; padding:12px; background:rgba(255,255,255,.9); color:#403744; font:13px/1.65 inherit; }
    .lr-writing-panel textarea { min-height:76px; resize:vertical; }
    .lr-writing-panel .lr-writing-row { display:flex; gap:8px; align-items:center; margin-top:9px; }
    .lr-writing-panel .lr-writing-row input { min-width:0; flex:1; }
    .lr-writing-panel .lr-writing-row button { border:1px solid #d9cadd; border-radius:13px; background:#fff; color:#725d7d; padding:10px 13px; font-size:12px; white-space:nowrap; }
    .lr-writing-list { display:flex; flex-wrap:wrap; gap:7px; margin-top:10px; }
    .lr-writing-list button { border:1px solid #ded3e3; border-radius:999px; background:#fff; padding:7px 11px; color:#77667f; font-size:11px; }
    .lr-writing-list button.active { background:#eadff0; border-color:#b99bc8; color:#5b4666; }
    .lr-limit-row { display:flex; align-items:center; gap:10px; }
    .lr-limit-row input { width:112px; flex:none; }
    @media (prefers-color-scheme: dark) {
      .lr-writing-panel { background:rgba(45,36,51,.88); border-color:#514458; }
      .lr-writing-panel h3 { color:#f0e8f3; }
      .lr-writing-panel textarea,.lr-writing-panel input { background:#302837; color:#f0e8f3; border-color:#55475c; }
      .lr-writing-panel .lr-writing-row button,.lr-writing-list button { background:#382e40; color:#eadff0; border-color:#594b61; }
    }
  `;
  document.head.appendChild(styleBlock);

  function renderText(raw) {
    const box = $('sceneQuote');
    if (!box) return;
    let value = String(raw || '').trim();
    value = value.replace(/^["“「『]+|["”」』]+$/g, '').trim();
    value = value.replace(/^这一刻[，,]\s*他看着你[。.!！]?\s*/,'').trim();
    if (!value) { box.textContent = ''; return; }

    const pieces = [];
    const re = /（[\s\S]*?）|\([\s\S]*?\)/g;
    let last = 0, match;
    while ((match = re.exec(value))) {
      const before = value.slice(last, match.index).trim();
      if (before) pieces.push({type:'body', text:before});
      const aside = match[0].slice(1, -1).trim();
      if (aside) pieces.push({type:'aside', text:aside});
      last = re.lastIndex;
    }
    const tail = value.slice(last).trim();
    if (tail) pieces.push({type:'body', text:tail});

    box.innerHTML = '';
    pieces.forEach(piece => {
      const p = document.createElement('p');
      p.className = piece.type === 'aside' ? 'lr-space-aside' : 'lr-space-paragraph';
      p.textContent = piece.text;
      box.appendChild(p);
    });
  }

  function currentSceneText() {
    try {
      const sp = typeof activeSpace === 'function' ? activeSpace() : null;
      return sp?.scene?.quote || $('sceneQuote')?.textContent || '';
    } catch (_) { return $('sceneQuote')?.textContent || ''; }
  }

  if (typeof window.renderScene === 'function' && !window.__lrOriginalRenderScene) {
    window.__lrOriginalRenderScene = window.renderScene;
    window.renderScene = function(...args) {
      const result = window.__lrOriginalRenderScene.apply(this, args);
      renderText(currentSceneText());
      return result;
    };
  }

  if (typeof window.setSceneResponse === 'function' && !window.__lrOriginalSetSceneResponse) {
    window.__lrOriginalSetSceneResponse = window.setSceneResponse;
    window.setSceneResponse = function(text) {
      const clean = String(text || '').trim().replace(/^["“「『]+|["”」』]+$/g, '');
      const sp = typeof activeSpace === 'function' ? activeSpace() : null;
      if (sp) {
        sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
        sp.scene.text = '';
        sp.scene.quote = clean;
        sp.scene.hour = new Date().getHours();
        if (typeof save === 'function') save();
      }
      if ($('sceneText')) $('sceneText').textContent = '';
      renderText(clean);
    };
  }

  function readWriting() {
    try { writing = {...writing, ...JSON.parse(localStorage.getItem(settingsKey()) || '{}')}; } catch (_) {}
    try { writingPresets = JSON.parse(localStorage.getItem(presetsKey()) || '[]'); } catch (_) { writingPresets = []; }
    if (!Number.isFinite(+writing.limit) || +writing.limit < 0) writing.limit = 0;
  }
  function persistWriting() {
    localStorage.setItem(settingsKey(), JSON.stringify(writing));
  }

  const grid = modal.querySelector('.space-style-grid');
  if (grid && !$('lrWritingControls')) {
    const panel = document.createElement('section');
    panel.id = 'lrWritingControls';
    panel.innerHTML = `
      <div class="lr-writing-panel">
        <h3>添加文风预设</h3>
        <p>写下希望 AI 长期遵循的叙述方式、语气和细节偏好。选择后只作用于当前空间。</p>
        <textarea id="lrWritingStyle" placeholder="例如：旁白细腻但克制；人物对话自然，不要过度抒情；动作和环境描写有画面感……"></textarea>
        <div class="lr-writing-row"><input id="lrWritingPresetName" placeholder="预设名称，例如：温柔日常"><button type="button" id="lrWritingPresetSave">保存文风</button></div>
        <div class="lr-writing-list" id="lrWritingPresetList"></div>
      </div>
      <div class="lr-writing-panel">
        <h3>文本字数</h3>
        <p>0 表示不限制。设置后会要求 AI 尽量控制在指定字数附近；实际长度仍会受模型输出上限影响。</p>
        <div class="lr-limit-row"><input id="lrWritingLimit" type="number" min="0" max="20000" step="100" value="0"><span style="font-size:12px;color:#8f8494">字 / 次　（0 = 不限制）</span></div>
      </div>`;
    grid.parentNode.insertBefore(panel, grid);
  }

  function renderPresetList() {
    const list = $('lrWritingPresetList');
    if (!list) return;
    list.innerHTML = '';
    if (!writingPresets.length) {
      const empty = document.createElement('span');
      empty.style.cssText = 'font-size:11px;color:#9b8fa0';
      empty.textContent = '还没有文风预设';
      list.appendChild(empty);
      return;
    }
    writingPresets.forEach((preset, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = preset.name || `文风 ${index + 1}`;
      button.classList.toggle('active', writing.style === preset.style);
      button.addEventListener('click', () => {
        writing.style = preset.style || '';
        $('lrWritingStyle').value = writing.style;
        persistWriting();
        renderPresetList();
      });
      list.appendChild(button);
    });
  }

  function fillWritingControls() {
    readWriting();
    if ($('lrWritingStyle')) $('lrWritingStyle').value = writing.style || '';
    if ($('lrWritingLimit')) $('lrWritingLimit').value = String(+writing.limit || 0);
    renderPresetList();
  }

  const originalOpen = document.querySelectorAll('.space-style-open');
  originalOpen.forEach(button => button.addEventListener('click', () => setTimeout(fillWritingControls, 0)));
  if ($('lrWritingPresetSave')) $('lrWritingPresetSave').addEventListener('click', () => {
    const name = $('lrWritingPresetName').value.trim() || `文风 ${writingPresets.length + 1}`;
    const style = $('lrWritingStyle').value.trim();
    if (!style) { if (typeof toast === 'function') toast('先写下这套文风的要求 ♡'); return; }
    writingPresets.push({name, style});
    writing.style = style;
    localStorage.setItem(presetsKey(), JSON.stringify(writingPresets));
    persistWriting();
    $('lrWritingPresetName').value = '';
    renderPresetList();
    if (typeof toast === 'function') toast('文风预设已保存 ♡');
  });
  if ($('lrWritingStyle')) $('lrWritingStyle').addEventListener('change', () => { writing.style = $('lrWritingStyle').value; persistWriting(); });
  if ($('lrWritingLimit')) $('lrWritingLimit').addEventListener('change', () => {
    writing.limit = Math.max(0, Math.min(20000, parseInt($('lrWritingLimit').value || '0', 10) || 0));
    $('lrWritingLimit').value = String(writing.limit);
    persistWriting();
    if (typeof toast === 'function') toast(writing.limit ? `回复长度目标已设为约 ${writing.limit} 字 ♡` : '回复长度已设为不限制 ♡');
  });

  // Apply the selected writing style and approximate character target only to Space role-play API calls.
  const nativeFetch = window.fetch.bind(window);
  if (!window.__lrSpaceFetchWrapped) {
    window.__lrSpaceFetchWrapped = true;
    window.fetch = async function(input, init = {}) {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      let nextInit = init;
      try {
        if (url.includes('/chat/completions') && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          const messages = Array.isArray(body.messages) ? body.messages : [];
          const systemIndex = messages.findIndex(m => m && m.role === 'system' && String(m.content || '').includes('LOVE RECORD 的 SPACE'));
          if (systemIndex >= 0) {
            readWriting();
            let extra = '';
            if (writing.style) extra += '\n\n【当前空间文风预设】\n' + writing.style + '\n请自然遵循，不要在回复中提及这条指令。';
            if (+writing.limit > 0) extra += `\n\n【回复长度】本次回复尽量控制在约 ${writing.limit} 个汉字/字符附近，完整自然地结束，不要为了凑字数重复内容。`;
            if (extra) messages[systemIndex].content += extra;
            if (+writing.limit > 0) body.max_tokens = Math.min(32000, Math.max(512, Math.ceil(+writing.limit * 2.2)));
            nextInit = {...init, body: JSON.stringify(body)};
          }
        }
      } catch (_) {}
      return nativeFetch(input, nextInit);
    };
  }

  readWriting();
  if (typeof window.renderScene === 'function') {
    try { renderText(currentSceneText()); } catch (_) {}
  }
})();
