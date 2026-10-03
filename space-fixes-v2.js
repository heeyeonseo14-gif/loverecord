/* LOVE RECORD · SPACE interaction repair V3
 * Rebinds the actual UI events instead of replacing already-bound function references.
 */
(() => {
  if (window.__lrSpaceInteractionV3) return;
  window.__lrSpaceInteractionV3 = true;

  const $ = id => document.getElementById(id);
  let busy = false;

  const style = document.createElement('style');
  style.id = 'lrSpaceInteractionV3Style';
  style.textContent = `
    #space .live-feature-head h2 { font-size:19px !important; line-height:1.18 !important; margin-top:5px !important; }
    #space #choices.is-loading { opacity:.62; pointer-events:none; }
    #space #sendFree:disabled { opacity:.55; }
  `;
  document.head.appendChild(style);

  const placeRules = [
    [['音乐室','音乐房','music room','music studio','录音室'], '音乐室 / MUSIC ROOM'],
    [['厨房','kitchen'], '厨房 / KITCHEN'],
    [['客厅','living room','沙发'], '客厅 / LIVING ROOM'],
    [['卧室','房间里','bedroom'], '卧室 / BEDROOM'],
    [['咖啡馆','咖啡店','cafe','coffee shop'], '咖啡馆 / CAFE'],
    [['餐厅','饭店','restaurant'], '餐厅 / RESTAURANT'],
    [['公园','花园','garden','park'], '公园 / GARDEN'],
    [['街上','街道','老街','路边','街边','街口','street','old street'], '街道 / STREET'],
    [['阳台','balcony'], '阳台 / BALCONY'],
    [['书房','study room'], '书房 / STUDY'],
    [['车里','车内','车上','in the car'], '车内 / IN THE CAR'],
    [['楼下','出门','门外','外面','户外','散步','走在路上','outside','outdoors'], '外面 / OUTSIDE']
  ];
  function detectPlace(text, previous) {
    const value = String(text || '').toLowerCase();
    for (const [keys, label] of placeRules) {
      if (keys.some(key => value.includes(key.toLowerCase()))) return label;
    }
    return previous || '';
  }

  function currentSpace() {
    try { return typeof activeSpace === 'function' ? activeSpace() : null; }
    catch (_) { return null; }
  }
  function safeSave() {
    try { if (typeof save === 'function') save(); } catch (error) { console.error('SPACE save failed', error); }
  }
  function syncHistory(sp) {
    try { if (typeof syncSpaceEvents === 'function') syncSpaceEvents(sp); } catch (error) { console.error('SPACE history sync failed', error); }
    safeSave();
    try { if (typeof renderOurHistory === 'function') renderOurHistory(); } catch (error) { console.error('SPACE history render failed', error); }
  }
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
  }
  function makeOfflineReply(text) {
    const replies = [
      '他听完你的话，轻轻笑了笑，认真地接住了你的意思。',
      '他没有急着打断你，只是靠近了一点，示意你继续说。',
      '他看着你，眼底带着一点笑意，顺着你的话继续聊了下去。',
      '“好啊。”他应了一声，随后自然地把话题接了过去。'
    ];
    const sp = currentSpace();
    return replies[(Number(sp?.history?.length || 0) + String(text).length) % replies.length];
  }
  function fallbackOptions(turnIndex) {
    const pools = [
      ['问问他刚才那句话是什么意思','走近一点，看看他的反应','把话题转到眼前正在做的事','笑着说出自己的想法'],
      ['问他接下来有什么打算','顺着刚才的话题继续聊','提出一个你突然想到的小计划','安静陪他一会儿'],
      ['告诉他你真实的感受','轻轻逗他一下','问问他有没有别的想法','邀请他一起做点什么'],
      ['回应他的目光','换一个轻松的话题','提起你们之前的一段回忆','把选择权交给他']
    ];
    return pools[Math.abs(turnIndex) % pools.length].slice();
  }
  async function refreshOptions(context, previousChoices) {
    const sp = currentSpace();
    if (!sp) return;
    sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
    try {
      if (typeof generateDynamicChoices === 'function') {
        await generateDynamicChoices(String(context || '') + '\n[turn ' + (sp.history?.length || 0) + ']');
      }
    } catch (error) {
      console.error('SPACE dynamic options failed', error);
    }
    const latest = currentSpace();
    if (!latest) return;
    latest.scene = latest.scene || {};
    let next = Array.isArray(latest.scene.choices) ? latest.scene.choices.map(String).filter(Boolean).slice(0,4) : [];
    const unchanged = next.length === 4 && Array.isArray(previousChoices) && next.join('\n') === previousChoices.join('\n');
    if (next.length !== 4 || unchanged) next = fallbackOptions(latest.history?.length || 0);
    latest.scene.choices = next;
    safeSave();
    try { if (typeof renderScene === 'function') renderScene(); } catch (error) { console.error('SPACE render after options failed', error); }
  }

  async function processTurn(rawText, source) {
    const text = String(rawText || '').trim();
    if (!text || busy) return;
    const sp = currentSpace();
    if (!sp) {
      if (typeof toast === 'function') toast('请先进入一个人物的专属空间 ♡');
      return;
    }
    if (typeof normalizeSpace === 'function') normalizeSpace(sp);
    sp.history = Array.isArray(sp.history) ? sp.history : [];
    sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
    const previousChoices = Array.isArray(sp.scene.choices) ? sp.scene.choices.slice() : [];
    const beforeScene = typeof cloneObj === 'function' ? cloneObj(sp.scene) : JSON.parse(JSON.stringify(sp.scene));
    const turn = {
      id: 'turn-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
      time: new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}),
      userText: String((state?.name || '我') + '：' + text),
      aiText: '',
      beforeScene
    };
    sp.history.push(turn);
    syncHistory(sp);
    setBusy(true);
    if (source === 'free' && $('freeInput')) $('freeInput').value = '';

    try {
      let answer = '';
      const hasApi = !!(state?.apiBase && state?.apiKey && state?.apiModel);
      if (hasApi) {
        if (typeof askAI !== 'function') throw new Error('找不到 AI 请求函数 askAI');
        answer = await askAI(text, source);
        if (!answer) {
          throw new Error('AI 没有返回回复。请检查 Settings → AI / API 中的连接状态和错误详情。');
        }
      } else {
        answer = makeOfflineReply(text);
      }

      if (typeof setSceneResponse === 'function') setSceneResponse(answer);
      else {
        sp.scene.quote = answer;
        const quote = $('sceneQuote');
        if (quote) quote.textContent = answer;
      }
      const place = detectPlace(text + '\n' + answer, sp.scene.place);
      if (place) {
        sp.scene.place = place;
        const placeNode = $('place');
        if (placeNode) placeNode.textContent = place;
      }
      turn.aiText = String((typeof activeSpacePerson === 'function' ? activeSpacePerson()?.name : '') || 'AI') + '：' + answer;
      syncHistory(sp);
      await refreshOptions(text + '\n' + answer, previousChoices);
      if (!hasApi && typeof toast === 'function') toast('这一刻留下来了 ♡');
    } catch (error) {
      console.error('SPACE interaction failed:', error);
      sp.history = sp.history.filter(item => item.id !== turn.id);
      syncHistory(sp);
      if (source === 'free' && $('freeInput')) $('freeInput').value = text;
      try { if (typeof renderScene === 'function') renderScene(); } catch (_) {}
      const message = String(error?.message || error || '未知错误');
      if (typeof toast === 'function') toast(message.length > 105 ? message.slice(0,102) + '…' : message);
    } finally {
      setBusy(false);
    }
  }

  // Capture-phase listeners take precedence over the page's older click handlers,
  // including the old onclick reference assigned during initial page setup.
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
      const value = choice.dataset.choiceText || choice.textContent || '';
      processTurn(value, 'choice');
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    if (event.target?.id !== 'freeInput') return;
    event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
    processTurn(event.target.value || '', 'free');
  }, true);
})();
