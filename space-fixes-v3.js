/* LOVE RECORD · SPACE repair V4
 * Fixes: dynamic choices, free-text/choice turns, progress feedback, archive persistence,
 * localStorage quota pressure, and story-location tracking.
 */
(() => {
  'use strict';
  if (window.__lrSpaceRepairV4) return;
  window.__lrSpaceRepairV4 = true;

  const $ = id => document.getElementById(id);
  const SETTINGS_KEY = 'yanyan-love-settings-v5';
  const ARCHIVE_DB = 'love-record-space-archive-v1';
  const ARCHIVE_STORE = 'spaces';
  let busy = false;
  let archiveDb = null;
  let archiveQueue = Promise.resolve();

  const style = document.createElement('style');
  style.id = 'lrSpaceRepairV4Style';
  style.textContent = `
    #space .live-feature-head h2 { font-size:19px !important; line-height:1.18 !important; margin-top:5px !important; }
    #space #choices.is-loading { opacity:.62; pointer-events:none; }
    #space #sendFree:disabled { opacity:.55; }
    #space #freeInput:disabled { opacity:.7; }
    #lrSpaceProgress { display:none; align-items:center; gap:8px; margin:9px 0 2px; color:#92769f; font-size:12px; letter-spacing:.04em; }
    #lrSpaceProgress.is-visible { display:flex; }
    #lrSpaceProgress .dot { width:7px; height:7px; border-radius:50%; background:#b99bc8; box-shadow:0 0 0 4px rgba(185,155,200,.14); animation:lrSpacePulse 1s ease-in-out infinite; }
    @keyframes lrSpacePulse { 50% { opacity:.35; transform:scale(.82); } }
  `;
  document.head.appendChild(style);

  function currentSpace() {
    try { return typeof activeSpace === 'function' ? activeSpace() : null; }
    catch (_) { return null; }
  }
  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
  }
  function requestResult(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IndexedDB 操作失败'));
    });
  }
  function openArchiveDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(ARCHIVE_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ARCHIVE_STORE)) db.createObjectStore(ARCHIVE_STORE, { keyPath: 'spaceId' });
      };
      req.onsuccess = () => { archiveDb = req.result; resolve(archiveDb); };
      req.onerror = () => reject(req.error || new Error('无法打开剧情档案数据库'));
    });
  }
  async function archiveGet(spaceId) {
    const tx = archiveDb.transaction(ARCHIVE_STORE, 'readonly');
    return requestResult(tx.objectStore(ARCHIVE_STORE).get(spaceId));
  }
  async function archivePut(record) {
    const tx = archiveDb.transaction(ARCHIVE_STORE, 'readwrite');
    tx.objectStore(ARCHIVE_STORE).put(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('剧情档案保存失败'));
      tx.onabort = () => reject(tx.error || new Error('剧情档案保存中断'));
    });
  }
  function compactState(source) {
    const snap = clone(source) || {};
    snap.events = Array.isArray(snap.events) ? snap.events.slice(-12) : [];
    snap.spaces = (snap.spaces || []).map(space => {
      const hasHistory = (Array.isArray(space.history) && space.history.length > 0) || (Array.isArray(space.events) && space.events.length > 0);
      const item = { ...space, history: [], events: [], __lrArchiveExternal: hasHistory || !!space.__lrArchiveExternal };
      return item;
    });
    return snap;
  }
  async function persistArchives(source) {
    if (!archiveDb) return;
    for (const sp of (source.spaces || [])) {
      if (!sp || !sp.id) continue;
      await archivePut({
        spaceId: sp.id,
        history: Array.isArray(sp.history) ? sp.history : [],
        events: Array.isArray(sp.events) ? sp.events : [],
        updatedAt: Date.now()
      });
    }
  }
  function writeCompactState(source) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(compactState(source)));
      return true;
    } catch (error) {
      // History/events are already externalized; retry without the duplicated global event feed.
      try {
        const snap = compactState(source);
        snap.events = [];
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(snap));
        return true;
      } catch (secondError) {
        console.error('[LOVE RECORD] compact settings save failed', secondError || error);
        return false;
      }
    }
  }

  // Migrate existing in-localStorage history once, then hydrate it on every visit.
  const archiveReady = openArchiveDb().then(async () => {
    const spaces = Array.isArray(state.spaces) ? state.spaces : [];
    for (const sp of spaces) {
      if (!sp || !sp.id) continue;
      const stored = await archiveGet(sp.id);
      const wasExternalized = !!sp.__lrArchiveExternal;
      const localHistory = wasExternalized ? [] : (Array.isArray(sp.history) ? sp.history : []);
      const localEvents = wasExternalized ? [] : (Array.isArray(sp.events) ? sp.events : []);
      if ((!stored && (localHistory.length || localEvents.length)) || (stored && (localHistory.length > (stored.history || []).length || localEvents.length > (stored.events || []).length))) {
        await archivePut({
          spaceId: sp.id,
          history: localHistory,
          events: localEvents,
          updatedAt: Date.now()
        });
        sp.history = localHistory;
        sp.events = localEvents;
      } else {
        sp.history = Array.isArray(stored?.history) ? stored.history : localHistory;
        sp.events = Array.isArray(stored?.events) ? stored.events : (Array.isArray(sp.events) ? sp.events : []);
      }
      sp.__lrArchiveExternal = false;
    }
    writeCompactState(state);
    if (typeof renderScene === 'function' && currentSpace()) renderScene();
    if (typeof renderOurHistory === 'function') renderOurHistory();
    return true;
  }).catch(error => {
    console.error('[LOVE RECORD] archive database unavailable:', error);
    try { toast('剧情档案暂时无法连接本地数据库，请勿清除浏览器数据。'); } catch (_) {}
    return false;
  });

  // Keep the live state in memory, but store long-running Space history in IndexedDB.
  if (typeof window.save === 'function') {
    window.save = function () {
      const snapshot = clone(state);
      archiveQueue = archiveQueue.then(async () => {
        const ready = await archiveReady;
        if (!ready || !archiveDb) {
          // If IndexedDB is unavailable, never discard the in-memory archive to make a compact snapshot.
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(snapshot));
          return;
        }
        await persistArchives(snapshot);
        if (!writeCompactState(snapshot)) throw new Error('设置数据仍然超出浏览器储存空间');
      }).catch(error => {
        console.error('[LOVE RECORD] durable save failed:', error);
        try { if (typeof toast === 'function') toast('保存失败：' + (error.message || '本地储存空间不足')); } catch (_) {}
      });
    };
  }

  const progress = document.createElement('div');
  progress.id = 'lrSpaceProgress';
  progress.innerHTML = '<span class="dot"></span><span>正在继续剧情……</span>';
  const liveHead = document.querySelector('#space .live-feature-head');
  if (liveHead) liveHead.insertAdjacentElement('afterend', progress);

  function setBusy(value) {
    busy = value;
    const choices = $('choices');
    if (choices) {
      choices.classList.toggle('is-loading', value);
      choices.querySelectorAll('button').forEach(button => { button.disabled = value; });
    }
    const send = $('sendFree');
    if (send) send.disabled = value;
    const input = $('freeInput');
    if (input) input.disabled = value;
    if (progress) progress.classList.toggle('is-visible', value);
  }

  function setScenePlace(label) {
    const sp = currentSpace();
    if (!sp) return;
    sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
    sp.scene.place = label;
    const node = $('place');
    if (node) node.textContent = label;
    if (typeof save === 'function') save();
  }

  const placeAliases = [
    [/音乐室|音乐房|music room|music studio|录音室/i, '音乐室 / MUSIC ROOM'],
    [/厨房|kitchen/i, '厨房 / KITCHEN'],
    [/书房|study room|study\b/i, '书房 / STUDY ROOM'],
    [/卧室|bedroom|房间里/i, '卧室 / BEDROOM'],
    [/阳台|balcony/i, '阳台 / BALCONY'],
    [/咖啡馆|咖啡店|cafe|coffee shop/i, '咖啡馆 / CAFE'],
    [/餐厅|饭店|restaurant/i, '餐厅 / RESTAURANT'],
    [/公园|花园|garden|park/i, '公园 / PARK'],
    [/车里|车内|车上|in the car/i, '车内 / IN THE CAR'],
    [/街道|街上|老街|路边|街边|街口|street|old street/i, '街道 / STREET'],
    [/楼下|门外|出门|外面|户外|散步|走下楼|走出门|outside|outdoors/i, '外面 / OUTSIDE'],
    [/客厅|living room|沙发/i, '客厅 / LIVING ROOM']
  ];
  function normalizePlace(value) {
    const raw = String(value || '').trim().replace(/^["'“「]+|["'”」]+$/g, '');
    if (!raw || /^(unknown|未知|不确定|none)$/i.test(raw)) return '';
    for (const [re, label] of placeAliases) if (re.test(raw)) return label;
    if (raw.length > 38) return '';
    return raw;
  }
  function extractLocation(answer) {
    const text = String(answer || '');
    const match = text.match(/\[\[\s*LR_LOCATION\s*:\s*([^\]]+)\]\]/i);
    if (!match) return { text: text.trim(), place: '' };
    return {
      text: text.replace(match[0], '').trim(),
      place: normalizePlace(match[1])
    };
  }
  function inferPlaceFromLatestText(text, previous) {
    const value = String(text || '');
    let winner = null;
    for (const [re, label] of placeAliases) {
      let match;
      const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
      const rx = new RegExp(re.source, flags);
      while ((match = rx.exec(value))) {
        if (!winner || match.index > winner.index) winner = { index: match.index, label };
      }
    }
    return winner ? winner.label : (previous || '');
  }

  // Ask the role-play model to state the actual end-of-turn location, not a place merely mentioned in memory.
  const previousFetch = window.fetch.bind(window);
  window.fetch = function (input, init = {}) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.includes('/chat/completions') && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const system = messages.find(m => m && m.role === 'system' && String(m.content || '').includes('LOVE RECORD 的 SPACE'));
        if (system) {
          system.content += '\n\n【场景地点同步】请根据本轮结束时人物实际所在的位置更新地点。若剧情从客厅出门、下楼、走到街上，必须更新为外面/街道；若进入音乐室则更新为音乐室。不要因为回忆、提及或计划去某处就改变地点。请在回复最后单独追加标记 [[LR_LOCATION:地点中文 / ENGLISH]]，地点不确定时写 [[LR_LOCATION:UNKNOWN]]。该标记只供程序读取，不要在正文解释。';
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (_) {}
    }
    return previousFetch(input, init);
  };

  function fallbackOptions(turnIndex, previousChoices, context) {
    const pools = [
      ['走近一点，看看他接下来要做什么','顺着眼前的话题问一个细节','笑着说出此刻真实的想法','提议一起做一件眼下能做的小事'],
      ['回应他的动作，再观察他的反应','把刚才没说完的话继续说完','提出一个和当前地点有关的小建议','问问他此刻最想做什么'],
      ['轻轻逗他一句，看看他怎么接话','分享一个突然想起的小细节','邀请他一起留意周围的环境','暂时不说话，陪他走一段'],
      ['问他刚才注意到了什么','自然地接过眼前的小事','提出一个新的、具体的小计划','告诉他自己更倾向于哪一种做法']
    ];
    const old = new Set((previousChoices || []).map(x => String(x).trim()));
    for (let offset = 0; offset < pools.length; offset++) {
      const pool = pools[(Math.abs(turnIndex) + offset) % pools.length];
      if (pool.some(x => !old.has(x))) return pool.map((x, i) => old.has(x) ? ['换个方式回应他','看看周围有什么变化','把话题转向眼前的事','问他一个新的问题'][i] : x);
    }
    return pools[(Math.abs(turnIndex) + 1) % pools.length];
  }

  function parseOptions(text) {
    let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = raw.indexOf('['), end = raw.lastIndexOf(']');
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) return value;
      if (Array.isArray(value?.choices)) return value.choices;
    } catch (_) {}
    return null;
  }

  async function generateFreshOptions(context, previousChoices) {
    const sp = currentSpace();
    if (!sp) return;
    sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
    const old = Array.isArray(previousChoices) ? previousChoices.slice() :
      (Array.isArray(sp.scene.choices) ? sp.scene.choices.slice() : []);
    let next = [];
    if (state.apiBase && state.apiKey && state.apiModel) {
      const person = typeof activeSpacePerson === 'function' ? activeSpacePerson() : {};
      const world = typeof activeSpaceWorld === 'function' ? activeSpaceWorld() : {};
      const persona = typeof activeSpacePersona === 'function' ? activeSpacePersona() : {};
      const recent = (sp.history || []).slice(-8).map(t =>
        [t.userText ? '用户：' + t.userText : '', t.aiText ? '角色：' + t.aiText : ''].filter(Boolean).join('\n')
      ).join('\n');
      const prompt = `请根据最新剧情生成恰好4个下一步互动选项。必须紧接当前场景和刚刚发生的事情，选项是用户可以采取的行动，不要替用户决定结果。不要重复上一轮选项，也不要输出泛泛的固定菜单。当前地点：${sp.scene.place || '未知'}。角色：${person?.name || ''}；身份：${person?.role || ''}；性格：${person?.personality || ''}；说话方式：${person?.speech || ''}；人物规则：${person?.instructions || ''}。用户自设：${persona?.name || state.name}；身份：${persona?.role || ''}；性格：${persona?.personality || ''}。世界观：${world?.name || ''} ${world?.description || ''} ${world?.locations || ''}。最新一轮：${context || ''}。近期剧情：${recent || '无'}。上一轮选项（全部避开）：${old.join('；') || '无'}。只返回 JSON 数组，恰好4条，每条简短、具体、互不重复，不要 Markdown。`;
      try {
        const response = await fetchTimeout(state.apiBase.replace(/\/+$/, '') + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.apiKey, 'Accept': 'application/json' },
          body: JSON.stringify({
            model: state.apiModel,
            messages: [
              { role: 'system', content: '你是互动剧情的下一步选项生成器。只输出合法 JSON 数组。' },
              { role: 'user', content: prompt }
            ],
            stream: false
          })
        }, 22000);
        const raw = await response.text();
        if (!response.ok) throw new Error('选项请求 HTTP ' + response.status + '：' + raw.slice(0, 180));
        const payload = JSON.parse(raw);
        const parsed = parseOptions(typeof extractAIText === 'function' ? extractAIText(payload) : payload?.choices?.[0]?.message?.content);
        if (parsed) {
          const seen = new Set();
          next = parsed.map(x => String(x || '').trim()).filter(x => { if (!x || seen.has(x)) return false; seen.add(x); return true; }).slice(0, 4);
          next = next.filter(x => !old.includes(x));
        }
      } catch (error) {
        console.warn('[LOVE RECORD] dynamic choices fallback:', error);
      }
    }
    if (next.length !== 4) next = fallbackOptions((sp.history || []).length, old, context);
    sp.scene.choices = next;
    if (typeof save === 'function') save();
    if (typeof renderScene === 'function') renderScene();
    return next;
  }
  window.generateDynamicChoices = generateFreshOptions;

  function setResponse(answer, place) {
    const sp = currentSpace();
    if (!sp) return;
    sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
    sp.scene.text = '';
    sp.scene.quote = String(answer || '').trim();
    sp.scene.hour = new Date().getHours();
    if (place) sp.scene.place = place;
    if ($('sceneText')) $('sceneText').textContent = '';
    if (typeof setSceneResponse === 'function') {
      try { setSceneResponse(sp.scene.quote); } catch (_) {}
    }
    if (place) {
      sp.scene.place = place;
      if ($('place')) $('place').textContent = place;
    }
    if (typeof save === 'function') save();
    if (typeof renderScene === 'function') renderScene();
  }

  function offlineReply(text) {
    const replies = [
      '他听完你的话，轻轻笑了笑，顺着你的意思接了下去。',
      '他没有急着打断你，只是看着你，示意你继续说。',
      '他眼底浮起一点笑意，自然地接住了你的话。',
      '“好啊。”他应了一声，随后把注意力放回你们眼前的事情上。'
    ];
    const sp = currentSpace();
    return replies[((sp?.history?.length || 0) + String(text).length) % replies.length];
  }

  async function processTurn(rawText, source) {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    const sp = currentSpace();
    if (!sp) {
      if (typeof toast === 'function') toast('请先进入一个人物的专属空间 ♡');
      return;
    }
    setBusy(true);
    if (typeof toast === 'function') toast('正在继续剧情……');
    await archiveReady;
    if (typeof normalizeSpace === 'function') normalizeSpace(sp);
    sp.history = Array.isArray(sp.history) ? sp.history : [];
    sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
    const oldChoices = Array.isArray(sp.scene.choices) ? sp.scene.choices.slice() : [];
    const input = $('freeInput');
    if (source === 'free' && input) input.value = '';

    let turnId = null;
    try {
      turnId = typeof startHistoryTurn === 'function'
        ? startHistoryTurn(String((state.name || '我') + '：' + text))
        : null;
      if (!turnId) {
        const turn = { id: 'turn-' + Date.now(), time: new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}), userText: String((state.name || '我') + '：' + text), aiText: '', beforeScene: clone(sp.scene) };
        sp.history.push(turn);
        turnId = turn.id;
      }
      if ($('sceneQuote')) $('sceneQuote').textContent = '正在继续剧情……';
      if (typeof save === 'function') save();

      let rawAnswer = '';
      if (state.apiBase && state.apiKey && state.apiModel) {
        if (typeof askAI !== 'function') throw new Error('找不到 AI 请求函数。');
        rawAnswer = await askAI(text, source);
        if (!rawAnswer) {
          const debug = $('apiDebug')?.textContent || '';
          throw new Error(debug.replace(/^AI 请求失败：/, '').slice(0, 180) || 'AI 没有返回内容，请检查 API 设置。');
        }
      } else {
        rawAnswer = offlineReply(text);
      }

      const extracted = extractLocation(rawAnswer);
      let answer = extracted.text;
      const place = extracted.place || inferPlaceFromLatestText(text + '\n' + answer, sp.scene.place);
      if (!answer) throw new Error('AI 返回了地点标记，但没有正文内容。');
      setResponse(answer, place);

      const personName = (typeof activeSpacePerson === 'function' ? activeSpacePerson()?.name : '') || 'AI';
      if (typeof finishHistoryTurn === 'function') finishHistoryTurn(turnId, personName + '：' + answer);
      else {
        const turn = sp.history.find(x => x.id === turnId);
        if (turn) turn.aiText = personName + '：' + answer;
        if (typeof save === 'function') save();
      }

      await generateFreshOptions(text + '\n' + answer, oldChoices);
      if (source === 'free' && input) input.value = '';
    } catch (error) {
      console.error('[LOVE RECORD] Space turn failed:', error);
      if (turnId) {
        const turn = sp.history.find(x => x.id === turnId);
        if (turn) {
          turn.error = String(error?.message || error);
          if (!turn.aiText) turn.aiText = '（本次生成失败：' + String(error?.message || error).slice(0, 120) + '）';
        }
        if (typeof syncSpaceEvents === 'function') syncSpaceEvents(sp);
        if (typeof save === 'function') save();
        if (typeof renderOurHistory === 'function') renderOurHistory();
      }
      if (source === 'free' && input) input.value = text;
      if (typeof renderScene === 'function') renderScene();
      if (typeof toast === 'function') toast('这一步没有完成：' + String(error?.message || error).slice(0, 95));
    } finally {
      setBusy(false);
    }
  }

  document.addEventListener('click', event => {
    const send = event.target?.closest?.('#sendFree');
    if (send) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      processTurn($('freeInput')?.value || '', 'free');
      return;
    }
    const choice = event.target?.closest?.('#choices [data-choice], #choices .choice');
    if (choice) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      processTurn(choice.dataset.choiceText || choice.textContent || '', 'choice');
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.target?.id !== 'freeInput') return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    processTurn(event.target.value || '', 'free');
  }, true);

  // Recover/hydrate archived turns before the user opens the archive screen.
  archiveReady.then(() => {
    if (typeof renderOurHistory === 'function') renderOurHistory();
  });
})();
