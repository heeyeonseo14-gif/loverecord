/* LOVE RECORD Beauty Studio V1. Additive layer: existing data keys and feature logic remain untouched. */
(function(){
  'use strict';
  const KEY='yanyan-love-appearance-v1';
  const THEME_KEY='love-record-glass-theme-v1';
  const FONT_KEY='love-record-custom-font-v1';
  const APPEARANCE_FALLBACK_KEY='love-record-appearance-overrides-v1';
  const themeMap={obsidian:'lr-glass-obsidian',pearl:'lr-glass-pearl',amethyst:'lr-glass-amethyst'};
  const themeMeta={
    obsidian:{name:'黑曜 Obsidian',preset:{font:'system',fontSize:15,titleScale:1,accent:'#c0b5d7',textColor:'#f3f1f7',bg:'plain',radius:26,blur:20,opacity:.76,dark:true,motion:true}},
    pearl:{name:'珍珠白 Pearl',preset:{font:'system',fontSize:15,titleScale:1,accent:'#9e98ad',textColor:'#34323a',bg:'plain',radius:28,blur:20,opacity:.78,dark:false,motion:true}},
    amethyst:{name:'紫晶 Amethyst',preset:{font:'system',fontSize:15,titleScale:1,accent:'#a98acb',textColor:'#352a40',bg:'soft',radius:29,blur:20,opacity:.76,dark:false,motion:true}}
  };
  const parseStored=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')||{}}catch(_){return {}}};
  const safeRead=()=>Object.assign({},parseStored(KEY),parseStored(APPEARANCE_FALLBACK_KEY),parseStored(THEME_KEY),parseStored(FONT_KEY));
  // Store only the tiny values this add-on owns; never rewrite the legacy appearance blob (it may contain a large background image).
  const safeWrite=v=>{let ok=true;try{if(v.glassTheme){localStorage.setItem(THEME_KEY,JSON.stringify({glassTheme:v.glassTheme}))}}catch(e){ok=false}
    try{if(v.customFontName||v.customFontUrl){localStorage.setItem(FONT_KEY,JSON.stringify({customFontName:v.customFontName||'',customFontUrl:v.customFontUrl||''}))}}catch(e){ok=false}
    if(!ok&&typeof window.toast==='function')window.toast('设置暂时无法保存：浏览器储存空间不足；现有资料未被清除');return ok};
  // If the original appearance JSON cannot be rewritten because it contains a large background image,
  // keep a compact set of appearance controls separately instead of discarding the background or data.
  function installQuotaSafeAppearanceSave(){
    if(typeof window.saveAppearance!=='function'||window.__lrQuotaSafeSaveInstalled)return;
    const original=window.saveAppearance;
    window.saveAppearance=function(){try{return original()}catch(e){try{const compact={};['preset','font','fontSize','titleScale','accent','textColor','bg','radius','blur','opacity','dark','motion'].forEach(k=>{if(typeof appearance!=='undefined'&&appearance[k]!==undefined)compact[k]=appearance[k]});localStorage.setItem(APPEARANCE_FALLBACK_KEY,JSON.stringify(compact));return true}catch(err){if(typeof window.toast==='function')window.toast('设置保存失败：储存空间不足；请先勿清除网站资料');return false}}};
    window.__lrQuotaSafeSaveInstalled=true;
  }
  function syncThemeToPages(key){
    const pages=['launcher','music','chat'];
    const classes=Object.values(themeMap);
    pages.forEach(id=>{
      const page=document.getElementById(id);if(!page)return;
      page.classList.remove(...classes);
      if(themeMap[key])page.classList.add(themeMap[key]);
    });
    // The home photo belongs only to the launcher. It must never become the body/chat/Space background.
    const home=document.getElementById('launcher');
    if(home){
      const photo=typeof appearance!=='undefined'&&appearance.bgData?appearance.bgData:'';
      const gradients={
        obsidian:'radial-gradient(ellipse at 8% 0%,rgba(116,104,139,.22),transparent 48%),radial-gradient(ellipse at 100% 38%,rgba(79,84,105,.20),transparent 45%)',
        pearl:'radial-gradient(ellipse at 0% 0%,rgba(255,255,255,.96),transparent 48%),radial-gradient(ellipse at 100% 35%,rgba(221,220,230,.38),transparent 46%)',
        amethyst:'radial-gradient(ellipse at 8% 0%,rgba(255,255,255,.82),transparent 45%),radial-gradient(ellipse at 100% 30%,rgba(195,165,224,.30),transparent 44%)'
      };
      home.style.backgroundImage=photo?`${gradients[key]||gradients.amethyst},url("${photo}")`:(gradients[key]||'');
      home.style.backgroundSize=photo?'cover,cover':'';
      home.style.backgroundPosition=photo?'center,center':'';
      home.style.backgroundAttachment=photo?'fixed,fixed':'';
    }
    const colors={obsidian:['#f3f1f7','#17171c'],pearl:['#302b35','#f3f2f5'],amethyst:['#352a40','#eee7f5']};
    pages.forEach(id=>{const page=document.getElementById(id);if(!page)return;const c=colors[key]||colors.amethyst;page.style.setProperty('--ink',c[0]);page.style.setProperty('--theme-text',c[0]);page.style.setProperty('--bg',c[1]);page.style.color=c[0];page.style.backgroundColor=c[1];});
    window.__lrCurrentGlassTheme=key||'';
    document.querySelectorAll('[data-lr-glass-theme]').forEach(b=>{b.classList.toggle('active',b.dataset.lrGlassTheme===key);b.setAttribute('aria-pressed',String(b.dataset.lrGlassTheme===key))});
  }
  function applyTheme(key,save=true){
    if(!themeMap[key])return;
    syncThemeToPages(key);
    const current=safeRead();current.glassTheme=key;if(typeof appearance!=='undefined')appearance.glassTheme=key;
    if(save&&!window.__lrAppearanceEditing)safeWrite(current);
  }
  function addThemePresets(){
    if(typeof presetChoices==='undefined')return;
    Object.entries(themeMeta).forEach(([key,item])=>{
      // These presets feed the existing appearance controls, so all legacy controls keep working.
      presetChoices[key]={name:item.name,...item.preset,glassTheme:key};
    });
  }
  function mountThemePicker(){
    const presetSection=document.getElementById('presetGrid')?.closest('.appearance-section');
    if(!presetSection||document.getElementById('lrGlassThemePicker'))return;
    const section=document.createElement('div');section.className='appearance-section';section.id='lrGlassThemePicker';
    section.innerHTML='<h3>LIQUID GLASS THEMES</h3><div class="sub">三套高级毛玻璃主题，保留 Space 原有场景风格。</div><div class="lr-beauty-theme-grid">'+
      '<button type="button" class="lr-beauty-theme" data-lr-glass-theme="obsidian"><span class="lr-beauty-chip" style="background:linear-gradient(135deg,#17171c,#57515f 55%,#25242d)"></span><strong>黑曜</strong><small>Obsidian</small></button>'+
      '<button type="button" class="lr-beauty-theme" data-lr-glass-theme="pearl"><span class="lr-beauty-chip" style="background:linear-gradient(135deg,#fff,#e5e2ea 55%,#f8f7fa)"></span><strong>珍珠白</strong><small>Pearl</small></button>'+
      '<button type="button" class="lr-beauty-theme" data-lr-glass-theme="amethyst"><span class="lr-beauty-chip" style="background:linear-gradient(135deg,#faf4ff,#cbb3e5 55%,#a98acb)"></span><strong>紫晶</strong><small>Amethyst</small></button></div>';
    presetSection.insertAdjacentElement('afterend',section);
    section.addEventListener('click',e=>{const b=e.target.closest('[data-lr-glass-theme]');if(!b)return;const key=b.dataset.lrGlassTheme;
      // Theme selection changes only the glass theme; preserve custom photo, font, accent and all other controls.
      if(typeof appearance!=='undefined')appearance.glassTheme=key;
      applyTheme(key,false);
      if(!window.__lrAppearanceEditing)safeWrite(Object.assign({},safeRead(),{glassTheme:key}));
    });
  }
  function applySavedCustomFont(saved){
    try{const parsed=new URL(saved.customFontUrl,location.href);if(!/^https?:$/.test(parsed.protocol))return;
      let style=document.getElementById('lrCustomFontFace');if(!style){style=document.createElement('style');style.id='lrCustomFontFace';document.head.appendChild(style)}
      style.textContent='@font-face{font-family:"LRUserCustomFont";src:url("'+parsed.href.replace(/["\\]/g,'')+'");font-display:swap;}';
      document.body.style.fontFamily='"LRUserCustomFont", sans-serif';
    }catch(_){}
  }
  function mountFontControls(){
    const fontGrid=document.getElementById('fontGrid');if(!fontGrid||document.getElementById('lrCustomFontControls'))return;
    const section=document.createElement('div');section.className='appearance-section';section.id='lrCustomFontControls';
    section.innerHTML='<h3>CUSTOM FONT</h3><div class="sub">可使用字体文件直链（WOFF2 / WOFF / TTF）。只修改全局字体，不影响聊天或剧情资料。</div><div class="lr-custom-font-grid">'+
      '<div><label for="lrCustomFontName">字体名称</label><input id="lrCustomFontName" type="text" maxlength="60" placeholder="例如：My Chinese Font"></div>'+
      '<div><label for="lrCustomFontUrl">字体文件 URL</label><input id="lrCustomFontUrl" type="url" inputmode="url" placeholder="https://…/font.woff2"></div>'+
      '<div class="lr-font-full"><div class="lr-font-preview" id="lrCustomFontPreview">LOVE RECORD · 与你共度的每一个瞬间</div></div>'+
      '<div class="lr-font-full"><div class="actions"><button class="btn primary" id="lrApplyCustomFont" type="button">应用自定义字体</button><button class="btn" id="lrResetCustomFont" type="button">恢复默认字体</button></div></div></div>'+
      '<div class="lr-font-help">提示：字体网址需允许网页跨域加载；若字体源不支持跨域，浏览器可能会拒绝加载。不会上传或删除你的任何资料。</div>';
    const fontSection=fontGrid.closest('.appearance-section');fontSection?.insertAdjacentElement('afterend',section);
    const name=document.getElementById('lrCustomFontName'),url=document.getElementById('lrCustomFontUrl'),preview=document.getElementById('lrCustomFontPreview');
    const saved=safeRead();name.value=saved.customFontName||'';url.value=saved.customFontUrl||'';
    function previewFont(){const n=name.value.trim();preview.style.fontFamily=n?`"${n.replace(/["\\]/g,'')}"`:'inherit'}
    name.addEventListener('input',previewFont);
    document.getElementById('lrApplyCustomFont').addEventListener('click',()=>{
      const n=name.value.trim(),u=url.value.trim();
      if(!n||!u){if(typeof window.toast==='function')window.toast('请填写字体名称和字体文件 URL');return}
      let parsed;try{parsed=new URL(u,location.href)}catch(_){if(typeof window.toast==='function')window.toast('字体 URL 格式不正确');return}
      if(!/^https?:$/.test(parsed.protocol)){if(typeof window.toast==='function')window.toast('字体 URL 需使用 HTTP 或 HTTPS');return}
      const safeName=n.replace(/["\\;]/g,'').slice(0,60);if(!safeName){if(typeof window.toast==='function')window.toast('字体名称无效');return}
      let style=document.getElementById('lrCustomFontFace');if(!style){style=document.createElement('style');style.id='lrCustomFontFace';document.head.appendChild(style)}
      style.textContent='@font-face{font-family:"LRUserCustomFont";src:url("'+parsed.href.replace(/["\\]/g,'')+'");font-display:swap;}';
      document.body.style.fontFamily='"LRUserCustomFont", "'+safeName+'", -apple-system, BlinkMacSystemFont, sans-serif';
      const v=safeRead();v.customFontName=safeName;v.customFontUrl=parsed.href;v.font='custom';safeWrite(v);if(typeof appearance!=='undefined'){appearance.customFontName=safeName;appearance.customFontUrl=parsed.href;appearance.font='custom'}previewFont();
      if(typeof window.toast==='function')window.toast('自定义字体已应用');
    });
    document.getElementById('lrResetCustomFont').addEventListener('click',()=>{
      document.getElementById('lrCustomFontFace')?.remove();document.body.style.fontFamily='';
      const v=safeRead();delete v.customFontName;delete v.customFontUrl;if(v.font==='custom')v.font='system';safeWrite(v);if(typeof appearance!=='undefined'){delete appearance.customFontName;delete appearance.customFontUrl;if(appearance.font==='custom')appearance.font='system'}name.value='';url.value='';preview.style.fontFamily='';
      if(typeof window.applyAppearance==='function')window.applyAppearance();if(typeof window.toast==='function')window.toast('已恢复默认字体');
    });
    if(saved.customFontName&&saved.customFontUrl){applySavedCustomFont(saved);previewFont()}
  }
  function init(){
    const savebar=document.getElementById('lrAppearanceSavebar');if(savebar&&savebar.parentElement!==document.body)document.body.appendChild(savebar);
    installQuotaSafeAppearanceSave();
    if(typeof appearance!=='undefined'){const fallback=parseStored(APPEARANCE_FALLBACK_KEY);Object.keys(fallback).forEach(k=>{if(k!=='bgData')appearance[k]=fallback[k]});}
    mountThemePicker();mountFontControls();
    const saved=safeRead();const bootTheme=themeMap[saved.glassTheme]?saved.glassTheme:(typeof appearance!=='undefined'&&themeMap[appearance.glassTheme]?appearance.glassTheme:'amethyst');applyTheme(bootTheme,false);
    // Preserve the independent theme/font settings when the legacy appearance function saves its object.
    if(typeof applyAppearance==='function'){
      const originalApplyAppearance=applyAppearance;
      applyAppearance=function(){
        const prior=safeRead();
        if(prior.glassTheme&&!appearance.glassTheme)appearance.glassTheme=prior.glassTheme;
        if(prior.customFontName&&!appearance.customFontName)appearance.customFontName=prior.customFontName;
        if(prior.customFontUrl&&!appearance.customFontUrl)appearance.customFontUrl=prior.customFontUrl;
        originalApplyAppearance();
        const now=safeRead();
        if(now.customFontName&&now.customFontUrl)applySavedCustomFont(now);
        if(themeMap[now.glassTheme])applyTheme(now.glassTheme,false);
      };
    }
    // Keep the chosen glass theme when the legacy appearance controls are changed or re-rendered.
    const presetGrid=document.getElementById('presetGrid');presetGrid?.addEventListener('click',e=>{
      const b=e.target.closest('[data-preset]');if(!b)return;const key=b.dataset.preset;
      if(themeMap[key]){const v=safeRead();v.glassTheme=key;safeWrite(v);applyTheme(key,false)}
      else {const v=safeRead();if(themeMap[v.glassTheme])applyTheme(v.glassTheme,false)}
    });
    const observer=new MutationObserver(()=>{const v=safeRead();document.querySelectorAll('[data-lr-glass-theme]').forEach(b=>{b.classList.toggle('active',b.dataset.lrGlassTheme===v.glassTheme);b.setAttribute('aria-pressed',String(b.dataset.lrGlassTheme===v.glassTheme))})});
    const grid=document.getElementById('presetGrid');if(grid)observer.observe(grid,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
