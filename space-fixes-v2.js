/* LOVE RECORD · SPACE interaction fixes V2 */
(() => {
  if (window.__lrSpaceFixesV2) return;
  window.__lrSpaceFixesV2 = true;

  const $ = id => document.getElementById(id);
  const style = document.createElement('style');
  style.id = 'lrSpaceFixesV2Styles';
  style.textContent = `
    #space .live-feature-head h2 { font-size:19px !important; line-height:1.18 !important; margin-top:5px !important; }
    #space .scene-place { transition:opacity .18s ease; }
    #space .choices button:disabled, #space #sendFree:disabled { opacity:.55; pointer-events:none; }
    #space .choices.is-loading { opacity:.68; }
    #space .scene-quote .lr-space-paragraph { margin-bottom:1.45em !important; }
    #space .scene-quote .lr-space-aside { margin-top:1.5em !important; margin-bottom:1.6em !important; }
  `;
  document.head.appendChild(style);

  // The response-length setting is a prompt target, not a hard API token ceiling.
  // space-reading-v1 no longer injects a low max_tokens value.

  const placeMap = [
    {keys:['音乐室','音乐房','music room','music studio','录音室','studio'], label:'音乐室 / MUSIC ROOM'},
    {keys:['厨房','kitchen'], label:'厨房 / KITCHEN'},
    {keys:['客厅','living room','沙发'], label:'客厅 / LIVING ROOM'},
    {keys:['卧室','房间里','bedroom','bedroom'], label:'卧室 / BEDROOM'},
    {keys:['咖啡馆','咖啡店','cafe','coffee shop'], label:'咖啡馆 / CAFE'},
    {keys:['餐厅','饭店','restaurant'], label:'餐厅 / RESTAURANT'},
    {keys:['公园','花园','garden','park'], label:'公园 / GARDEN'},
    {keys:['街上','街道','老街','路边','街边','街口','street','old street'], label:'街道 / STREET'},
    {keys:['阳台','balcony'], label:'阳台 / BALCONY'},
    {keys:['书房','study room','study'], label:'书房 / STUDY'},
    {keys:['车里','车内','车上','in the car'], label:'车内 / IN THE CAR'},
    {keys:['楼下','出门','门外','外面','户外','散步','走在路上','outside','outdoors'], label:'外面 / OUTSIDE'}
  ];
  function detectPlace(text, previous) {
    const value = String(text || '').toLowerCase();
    if (!value) return previous || '';
    for (const item of placeMap) {
      if (item.keys.some(k => value.includes(k.toLowerCase()))) return item.label;
    }
    return previous || '';
  }

  // Preserve the selected scene in the AI prompt instead of resetting to a time-based room.
  if (typeof window.askAI === 'function' && !window.__lrAskSceneWrapped) {
    window.__lrAskSceneWrapped = true;
    const originalAskAI = window.askAI;
    window.askAI = function(userText, mode) {
      return originalAskAI.call(this, userText, mode);
    };
  }

  // Remember the user's latest action so a location change can be inferred from both sides
  // of the turn. Only explicit story cues move the scene; otherwise the previous place stays.
  let latestAction = '';
  let interactionBusy = false;

  if (typeof window.setSceneResponse === 'function' && !window.__lrSetSceneWrappedV2) {
    window.__lrSetSceneWrappedV2 = true;
    const originalSetSceneResponse = window.setSceneResponse;
    window.setSceneResponse = function(text) {
      const result = originalSetSceneResponse.call(this, text);
      try {
        const sp = typeof activeSpace === 'function' ? activeSpace() : null;
        if (sp) {
          sp.scene = sp.scene || {};
          const next = detectPlace(latestAction + '\n' + String(text || ''), sp.scene.place);
          if (next) {
            sp.scene.place = next;
            if ($('place')) $('place').textContent = next;
            if (typeof save === 'function') save();
          }
        }
      } catch (_) {}
      latestAction = '';
      return result;
    };
  }

  // A single in-flight interaction prevents double taps and overlapping turn requests.
  function setBusy(on) {
    interactionBusy = on;
    const choices = $('choices');
    if (choices) {
      choices.classList.toggle('is-loading', on);
      choices.querySelectorAll('button').forEach(b => { b.disabled = on; });
    }
    const send = $('sendFree');
    if (send) send.disabled = on;
    const input = $('freeInput');
    if (input) input.disabled = on;
  }
  if (typeof window.handleChoice === 'function' && !window.__lrChoiceWrappedV2) {
    window.__lrChoiceWrappedV2 = true;
    const original = window.handleChoice;
    window.handleChoice = async function(text) {
      if (interactionBusy) return;
      latestAction = String(text || '');
      setBusy(true);
      try { return await original.call(this, text); }
      catch (e) { console.error('SPACE choice failed', e); if (typeof toast === 'function') toast('这一步没有完成，请再试一次 ♡'); }
      finally { setBusy(false); if (typeof renderScene === 'function') renderScene(); }
    };
  }
  if (typeof window.handleFree === 'function' && !window.__lrFreeWrappedV2) {
    window.__lrFreeWrappedV2 = true;
    const original = window.handleFree;
    window.handleFree = async function(...args) {
      if (interactionBusy) return;
      latestAction = String($('freeInput')?.value || '');
      setBusy(true);
      try { return await original.apply(this, args); }
      catch (e) { console.error('SPACE free input failed', e); if (typeof toast === 'function') toast('这一步没有完成，请再试一次 ♡'); }
      finally { setBusy(false); if (typeof renderScene === 'function') renderScene(); }
    };
  }
  if (typeof window.surprise === 'function' && !window.__lrSurpriseWrappedV2) {
    window.__lrSurpriseWrappedV2 = true;
    const original = window.surprise;
    window.surprise = async function(...args) {
      if (interactionBusy) return;
      latestAction = '给我们一个惊喜';
      setBusy(true);
      try { return await original.apply(this, args); }
      catch (e) { console.error('SPACE surprise failed', e); if (typeof toast === 'function') toast('惊喜暂时没有生成成功，请再试一次 ♡'); }
      finally { setBusy(false); if (typeof renderScene === 'function') renderScene(); }
    };
  }

  // Re-render place labels from the active saved scene, never from the clock alone.
  if (typeof window.renderScene === 'function' && !window.__lrRenderSceneWrappedV2) {
    window.__lrRenderSceneWrappedV2 = true;
    const original = window.renderScene;
    window.renderScene = function(...args) {
      const result = original.apply(this, args);
      try {
        const sp = typeof activeSpace === 'function' ? activeSpace() : null;
        if (sp?.scene?.place && $('place')) $('place').textContent = sp.scene.place;
      } catch (_) {}
      return result;
    };
  }

  // Prevent a failed/slow choice refresh from leaving stale controls on screen.
  if (typeof window.generateDynamicChoices === 'function' && !window.__lrChoicesRefreshWrappedV2) {
    window.__lrChoicesRefreshWrappedV2 = true;
    const original = window.generateDynamicChoices;
    window.generateDynamicChoices = async function(context) {
      const before = typeof activeSpace === 'function' ? activeSpace() : null;
      try {
        const result = await original.call(this, context);
        const sp = typeof activeSpace === 'function' ? activeSpace() : null;
        if (sp && sp === before && typeof renderScene === 'function') renderScene();
        return result;
      } catch (e) {
        console.error('SPACE choices refresh failed', e);
        const sp = typeof activeSpace === 'function' ? activeSpace() : null;
        if (sp) {
          sp.scene = sp.scene || (typeof baseScene === 'function' ? baseScene() : {});
          if (typeof fallbackChoices === 'function') sp.scene.choices = fallbackChoices(String(context || '') + Date.now());
          if (typeof save === 'function') save();
          if (typeof renderScene === 'function') renderScene();
        }
      }
    };
  }

  // Keep AI location context aligned with the saved, evolving scene.
  try {
    const scriptText = Array.from(document.scripts).find(s => s.textContent && s.textContent.includes('function askAI('));
    if (scriptText && !scriptText.dataset.lrSceneContextPatched) {
      // askAI is declared in the main inline script; the source-level replacement is applied in the ZIP.
      scriptText.dataset.lrSceneContextPatched = '1';
    }
  } catch (_) {}
})();
