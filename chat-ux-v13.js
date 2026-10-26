/* LOVE RECORD V24 · chat UX v13
   Long-press actions, compact WeChat-like quote preview, per-chat character tools,
   IndexedDB-backed CSS presets and custom CSS persistence. */
(function(){
'use strict';
if(window.__lrChatUxV13)return;window.__lrChatUxV13=true;
const $=id=>document.getElementById(id);
const DB='love-record-extra-v1',STORE='assets';
let dbp;
function db(){if(dbp)return dbp;dbp=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbp}
async function put(key,value){const d=await db();return new Promise((res,rej)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put({key,value});t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function get(key){const d=await db();return new Promise((res,rej)=>{const r=d.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>res(r.result?.value??null);r.onerror=()=>rej(r.error)})}
async function del(key){const d=await db();return new Promise((res,rej)=>{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).delete(key);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
const cssKey=id=>'css:'+id,refKey=id=>'ref:'+id,promptKey=id=>'prompt:'+id,localPromptKey=id=>'lr-chat-image-prompt-v1:'+id;
async function readSavedPrompt(id){if(!id)return null;
 // The dedicated prompt record is the source of truth. Contact metadata can be stale when another settings handler saves an older snapshot.
 try{const v=await get(promptKey(id));if(typeof v==='string')return v}catch(e){console.warn('[LOVE RECORD] dedicated IndexedDB prompt read failed',e)}
 try{const v=localStorage.getItem(localPromptKey(id));if(v!==null)return v}catch(e){console.warn('[LOVE RECORD] local prompt mirror read failed',e)}
 try{const v=window.chatMeta?.(String(id))?.imagePrompt;if(typeof v==='string')return v}catch(e){console.warn('[LOVE RECORD] contact metadata prompt read failed',e)}
 return null}
async function writeSavedPrompt(id,value){if(!id)throw new Error('没有选择联系人');const text=String(value??'');
 // Save to a dedicated IndexedDB key and verify it independently of the contact metadata cache.
 await put(promptKey(id),text);const check=await get(promptKey(id));if(check!==text)throw new Error('提示词写入后校验不一致，请重试');
 try{localStorage.setItem(localPromptKey(id),text)}catch(e){console.warn('[LOVE RECORD] local prompt mirror unavailable; IndexedDB is saved',e)}
 return text}
function active(){try{const fromHost=typeof window.__lrGetActiveChatContactId==='function'?window.__lrGetActiveChatContactId():'';if(fromHost)return String(fromHost)}catch(e){}try{if(typeof activeChatContactId!=='undefined'&&activeChatContactId)return String(activeChatContactId)}catch(e){}return String(window.activeChatContactId||window.currentChatContactId||window.__lrActiveChatContactId||'')}
function meta(id=active()){return id&&typeof window.chatMeta==='function'?window.chatMeta(String(id)):{}}
function saveMetaFor(id,v){if(!id)throw new Error('没有选择联系人');if(typeof window.saveChatMetaSafely==='function')return window.saveChatMetaSafely(String(id),v);window.writeChatMeta(String(id),v);return Promise.resolve()}
function escape(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(s){if(typeof window.toast==='function')window.toast(s);else alert(s)}
function quoteText(row){const b=row.querySelector('.chat-bubble');if(b?.querySelector('.lr-chat-image'))return '【引用图片：请结合这张聊天图片理解】';return (b?.innerText||'').trim().slice(0,240)}
function clearMenu(){document.querySelector('.lr-message-menu')?.remove()}
function showMenu(row){
 clearMenu();const menu=document.createElement('div');menu.className='lr-message-menu';
 menu.innerHTML='<button type="button" data-do="quote">引用</button><button type="button" data-do="delete">删除消息</button>';
 document.body.appendChild(menu);
 const r=row.getBoundingClientRect(),w=Math.min(190,window.innerWidth-24);
 menu.style.cssText='position:fixed;z-index:99999;left:'+Math.max(12,Math.min(window.innerWidth-w-12,r.left))+'px;top:'+Math.max(12,Math.min(window.innerHeight-60,r.top-54))+'px;width:'+w+'px';
 menu.onclick=async e=>{const act=e.target.closest('button')?.dataset.do;if(!act)return;const text=quoteText(row),index=Number(row.dataset.messageIndex);clearMenu();
  const threads=window.readChatThreads(),list=threads[active()]||[];
  if(act==='quote'){const input=$('chatInput');if(input){input.dataset.quoteText=text;input.dataset.quoteIndex=String(index);input.focus();input.placeholder='回复引用内容……';input.dispatchEvent(new Event('input',{bubbles:true}));}}
  if(act==='delete'){if(!confirm('确定删除这条消息吗？'))return;if(Number.isInteger(index)&&index>=0&&index<list.length){list.splice(index,1);threads[active()]=list;window.writeChatThreads(threads);window.renderChat?.();}}
 };
}
let pressTimer=null,pressedRow=null,moved=false;
function bindLongPress(){
 const host=$('chatMessages');if(!host||host.dataset.lrLongpress==='1')return;host.dataset.lrLongpress='1';
 host.addEventListener('contextmenu',e=>{const row=e.target.closest('.chat-message-row');if(row){e.preventDefault();showMenu(row)}});
 host.addEventListener('touchstart',e=>{const row=e.target.closest('.chat-message-row');if(!row)return;pressedRow=row;moved=false;pressTimer=setTimeout(()=>{if(!moved&&pressedRow)showMenu(pressedRow)},520)},{passive:true});
 host.addEventListener('touchmove',()=>{moved=true;clearTimeout(pressTimer)},{passive:true});
 ['touchend','touchcancel'].forEach(n=>host.addEventListener(n,()=>{clearTimeout(pressTimer);pressedRow=null}));
 host.addEventListener('click',e=>{if(!e.target.closest('.lr-message-menu'))clearMenu()});
}
function decorateRows(){
 const host=$('chatMessages');if(!host)return;
 host.querySelectorAll('.chat-message-row').forEach((row,i)=>{row.dataset.messageIndex=String(i);const bubble=row.querySelector('.chat-bubble');if(!bubble||bubble.dataset.lrQuoteDecorated)return;bubble.dataset.lrQuoteDecorated='1';
  const raw=bubble.textContent||'';const imageQuote=raw.match(/^\[\[LRQUOTE_IMAGE\]\]([\s\S]*?)\[\[\/LRQUOTE_IMAGE\]\]\n?([\s\S]*)$/);const m=raw.match(/^\[\[LRQUOTE\]\]([\s\S]*?)\[\[\/LRQUOTE\]\]\n?([\s\S]*)$/);
  if(imageQuote){bubble.innerHTML='<div class="lr-quote-preview">▧ '+escape(imageQuote[1]||'引用了一张图片')+'</div><div class="lr-message-body">'+escape(imageQuote[2])+'</div>';}else if(m){bubble.innerHTML='<div class="lr-quote-preview">'+escape(m[1])+'</div><div class="lr-message-body">'+escape(m[2])+'</div>';}
 });
}
function injectSettings(){
 const screen=$('chatSettingsScreen');if(!screen||$('lrChatCharacterTools'))return;
 const card=document.createElement('section');card.className='card';card.id='lrChatCharacterTools';
 card.innerHTML='<h3>人物聊天设置</h3><label>IMAGE GENERATION PROMPT / 生图提示词</label><textarea id="lrChatImagePrompt" rows="4" placeholder="填写这个人物固定的外貌、发型、五官、画风和服装提示词"></textarea><label>REFERENCE IMAGE / 参考图</label><div class="lr-ref-picker"><button type="button" id="lrChatChooseReference" class="secondary">选择／更换参考图</button><input id="lrChatReferenceImage" type="file" accept="image/*" hidden><div class="sub" id="lrChatReferenceStatus" role="status" aria-live="polite">尚未保存参考图</div></div><button type="button" id="lrChatTestPromptImage" class="secondary" style="margin-top:10px;width:100%">测试读取提示词并生图</button><div class="sub" id="lrChatPromptTestStatus" aria-live="polite"></div><div id="lrChatPromptTestPreview"></div>';
 const save=$('chatSaveSettings');(save?.parentElement||screen).insertBefore(card,save||null);
}
async function loadSettings(){
 injectSettings();try{await window.__lrChatStorageReady}catch{}const id=active(),m=meta(id);let savedPrompt=null;try{savedPrompt=await readSavedPrompt(id)}catch{}$('lrChatImagePrompt').value=savedPrompt!==null?savedPrompt:(m.imagePrompt||'');
 let savedReference=null;try{savedReference=await get(refKey(id))}catch{}$('lrChatReferenceStatus').textContent=savedReference?'已保存参考图 ✓（重新选择可替换）':'尚未保存参考图';
 const css=await get(cssKey(active()));const cssBox=$('lrChatCustomCss');if(cssBox&&css!==null)cssBox.value=css;
}
function bindSettings(){
 const file=$('lrChatReferenceImage'),choose=$('lrChatChooseReference');
 if(choose&&!choose.dataset.bound){choose.dataset.bound='1';choose.addEventListener('click',()=>file?.click())}
 if(file&&!file.dataset.bound){file.dataset.bound='1';file.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;if(!f.type.startsWith('image/')){toast('请选择图片文件');return}try{const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=data});const scale=Math.min(1,720/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);await put(refKey(active()),c.toDataURL('image/jpeg',.78));const id=active();if(id){try{await saveMeta({referenceAsset:true})}catch(e){console.warn('[LOVE RECORD] reference meta flag save failed',e)}}$('lrChatReferenceStatus').textContent='参考图已保存到本设备 ✓';toast('参考图已保存 ♡')}catch(e){console.error('[LOVE RECORD] reference image save failed',e);toast('参考图保存失败：'+(e.message||String(e)))}})}
 const btn=$('chatSaveSettings');if(btn&&!btn.dataset.lrWrapped){btn.dataset.lrWrapped='1';btn.addEventListener('click',async e=>{
  // Take over this click so the prompt and main chat settings cannot race each other.
  e.preventDefault();e.stopImmediatePropagation();const id=active(),prompt=$('lrChatImagePrompt')?.value??'';
  if(!id){toast('保存失败：没有选择联系人');return}
  const originalText=btn.textContent;btn.disabled=true;btn.textContent='保存中…';
  try{
   const cleanPrompt=String(prompt).replace(/\r\n?/g,'\n').trim();
   // First persist the ordinary contact settings, then write the prompt against the pinned contact ID.
   // Do not rely on active() after the settings screen closes, and never re-save a stale metadata snapshot.
   if(typeof window.saveChatSettings==='function')await window.saveChatSettings();
   await writeSavedPrompt(id,cleanPrompt);
   const reference=await get(refKey(id));
   const fresh=meta(id);
   const saved=await saveMetaFor(id,{...fresh,imagePrompt:cleanPrompt,referenceAsset:!!reference});
   if(saved&&typeof saved.imagePrompt==='string'&&saved.imagePrompt!==cleanPrompt)throw new Error('联系人资料校验失败：保存后的提示词与输入不一致');
   const check=await readSavedPrompt(id);
   if(check!==cleanPrompt)throw new Error('提示词保存后复读校验失败，请重试');
   $('lrChatReferenceStatus').textContent=reference?'已保存参考图 ✓（重新选择可替换）':'尚未保存参考图';
   toast('生图提示词已保存并校验成功 ♡');
  }catch(err){console.error('[LOVE RECORD] image prompt persistence failed',err);toast('生图提示词保存失败：'+(err?.message||String(err)))}
  finally{btn.disabled=false;btn.textContent=originalText}
  },{capture:true})}
 const test=$('lrChatTestPromptImage');if(test&&!test.dataset.lrBound){test.dataset.lrBound='1';test.addEventListener('click',async()=>{const id=active(),status=$('lrChatPromptTestStatus'),preview=$('lrChatPromptTestPreview');const prompt=$('lrChatImagePrompt')?.value??'';if(!String(prompt).trim()){if(status)status.textContent='请先填写这个角色的生图提示词。';toast('请先填写生图提示词');return}try{const cleanPrompt=String(prompt).replace(/\r\n?/g,'\n').trim();await writeSavedPrompt(id,cleanPrompt);const reference=await get(refKey(id));await saveMetaFor(id,{...meta(id),imagePrompt:cleanPrompt,referenceAsset:!!reference});if(status)status.textContent='正在读取该角色的提示词与参考图，并调用朋友圈生图 API……';test.disabled=true;test.textContent='测试生成中…';if(typeof window.LRMomentsTestCharacterPrompt!=='function')throw new Error('朋友圈生图模块尚未加载，请刷新页面后重试');const result=await window.LRMomentsTestCharacterPrompt(id);if(preview){const img=document.createElement('img');img.alt='生图测试结果';img.src=String(result.image||'');img.style.cssText='display:block;width:100%;max-height:320px;object-fit:contain;border-radius:14px;margin-top:10px';preview.replaceChildren(img)}if(status)status.textContent='测试成功：已读取该角色提示词'+(result.hasReference?'和参考图':'（未设置参考图）')+'，并收到生图结果。';toast('提示词读取与生图测试成功')}catch(err){if(status)status.textContent='测试失败：'+(err?.message||String(err));toast('提示词生图测试失败：'+(err?.message||String(err)))}finally{test.disabled=false;test.textContent='测试读取提示词并生图'}},{once:false})}
}
function patchRender(){
 if(typeof window.renderChat!=='function'||window.renderChat.__lrV13)return;
 const old=window.renderChat;const fn=function(){const out=old.apply(this,arguments);decorateRows();bindLongPress();return out};fn.__lrV13=true;window.renderChat=fn;
}
function patchSend(){
 const input=$('chatInput'),send=$('chatSend');if(!input||!send||send.dataset.lrQuoteBound)return;send.dataset.lrQuoteBound='1';
 send.addEventListener('click',()=>{const q=input.dataset.quoteText;if(!q)return;const body=input.value.trim();input.value='[[LRQUOTE]]'+q+'[[/LRQUOTE]]\n'+body;delete input.dataset.quoteText;delete input.dataset.quoteIndex;input.placeholder='发送一条消息……';},{capture:true});
}
async function initCssPresets(){
 const area=$('lrCssPresetManager');if(!area||area.dataset.lrIdb==='1')return;area.dataset.lrIdb='1';
 const save=area.querySelector('#lrCssPresetSave'),apply=area.querySelector('#lrCssPresetApply'),delBtn=area.querySelector('#lrCssPresetDelete'),sel=area.querySelector('#lrCssPresetSelect');
 if(!area.dataset.lrCapture){area.dataset.lrCapture='1';area.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!['lrCssPresetSave','lrCssPresetApply','lrCssPresetDelete'].includes(b.id))return;e.preventDefault();e.stopImmediatePropagation();const sel=area.querySelector('#lrCssPresetSelect');try{const a=(await get('css-presets'))||[];if(b.id==='lrCssPresetSave'){const name=area.querySelector('#lrCssPresetName').value.trim(),value=$('lrChatCustomCss')?.value||'';if(!name||!value.trim())return toast('请填写预设名称和 CSS 内容');const i=a.findIndex(x=>x.name.toLowerCase()===name.toLowerCase());if(i>=0){if(!confirm('覆盖同名主题？'))return;a[i]={name,css:value,updatedAt:Date.now()}}else a.push({name,css:value,updatedAt:Date.now()});await put('css-presets',a);await refresh();toast('CSS 主题已保存 ♡')}else if(b.id==='lrCssPresetApply'){const v=a[Number(sel.value)];if(!v)return toast('请先选择主题');const box=$('lrChatCustomCss');if(box)box.value=v.css;toast('主题已载入，请点击保存设置')}else{const i=Number(sel.value);if(!a[i])return toast('请先选择预设');if(!confirm('删除这个主题？'))return;a.splice(i,1);await put('css-presets',a);await refresh()}}catch(err){toast('操作失败：'+err.message)}},true)}
 async function all(){return (await get('css-presets'))||[]}
 async function refresh(){const a=await all();sel.innerHTML='<option value="">选择已保存的主题</option>';a.forEach((v,i)=>{const o=document.createElement('option');o.value=i;o.textContent=v.name;sel.append(o)})}
 if(save)save.onclick=async()=>{const name=area.querySelector('#lrCssPresetName').value.trim(),value=$('lrChatCustomCss')?.value||'';if(!name||!value.trim()){toast('请填写预设名称和 CSS 内容');return}try{const a=await all(),i=a.findIndex(x=>x.name.toLowerCase()===name.toLowerCase()),item={name,css:value,updatedAt:Date.now()};if(i>=0){if(!confirm('覆盖同名主题？'))return;a[i]=item}else a.push(item);await put('css-presets',a);await refresh();toast('CSS 主题已保存 ♡')}catch(e){toast('保存失败：'+e.message)}};
 if(apply)apply.onclick=async()=>{const a=await all(),v=a[Number(sel.value)];if(!v)return toast('请先选择主题');const box=$('lrChatCustomCss');if(box){box.value=v.css;box.dispatchEvent(new Event('input',{bubbles:true}))}toast('主题已载入，请点击保存设置')};
 if(delBtn)delBtn.onclick=async()=>{const a=await all(),i=Number(sel.value);if(!a[i])return toast('请先选择预设');if(!confirm('删除这个主题？'))return;a.splice(i,1);await put('css-presets',a);refresh()};
 await refresh();
}
function installStyle(){
 const st=document.createElement('style');st.textContent=`
.lr-message-menu{display:flex;gap:0;padding:6px;background:#fff;border:1px solid #eadfee;border-radius:14px;box-shadow:0 8px 28px #49395722;overflow:hidden}
.lr-message-menu button{border:0;background:transparent;color:#66546e;padding:9px 15px;font:inherit;font-size:13px;white-space:nowrap}
.lr-message-menu button+button{border-left:1px solid #eee5f0;color:#a05c69}
.lr-quote-preview{padding:7px 10px;margin-bottom:7px;border-left:3px solid #b99ac8;background:rgba(120,90,140,.09);border-radius:0 8px 8px 0;color:#8d7b96;font-size:12px;line-height:1.5;white-space:pre-wrap}
.lr-message-body{white-space:pre-wrap}.lr-narration-label{display:flex!important;align-items:center;gap:9px;margin-top:15px}
#lrChatCharacterTools textarea{width:100%;min-height:90px;border:1px solid var(--line);border-radius:14px;padding:11px;font:inherit;box-sizing:border-box}.lr-ref-picker{display:grid;gap:8px}.lr-ref-picker button{width:100%;min-height:42px;border-radius:12px}#lrChatPromptTestPreview img{border:1px solid #eadfee}#lrChatPromptTestStatus{white-space:normal;overflow-wrap:anywhere}
`;document.head.appendChild(st);
}
function start(){installStyle();patchRender();decorateRows();bindLongPress();patchSend();const screen=$('chatSettingsScreen');if(screen){new MutationObserver(()=>{if(screen.classList.contains('show')){loadSettings();bindSettings();}}).observe(screen,{attributes:true,attributeFilter:['class']});}document.addEventListener('click',()=>{patchRender();patchSend();const section=document.querySelector('#chatSettingsScreen');if(section?.classList.contains('show')){bindSettings();initCssPresets();}},true);setTimeout(()=>{patchRender();patchSend();},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(function(){const s=document.createElement('style');s.textContent='.lr-narration-card{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid rgba(183,150,197,.25)!important;border-radius:24px!important;padding:18px 19px!important;box-shadow:0 10px 28px rgba(110,82,125,.07);background:linear-gradient(135deg,#fff,#f8f1fb)!important}.lr-narration-copy h3{margin:0 0 6px;font-size:17px;font-weight:500;color:#594b61}.lr-narration-copy .sub{font-size:12px;line-height:1.6;color:#988b9e}.lr-switch{display:flex!important;align-items:center;gap:8px;padding:7px 10px;border-radius:99px;background:#f1eaf4;color:#8b7396;font-size:11px;white-space:nowrap}.lr-switch input{position:absolute;opacity:0;width:1px;height:1px}.lr-switch-track{width:46px;height:26px;border-radius:30px;background:#d8d0dc;position:relative;transition:.2s}.lr-switch-track:after{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0002;transition:.2s}.lr-switch input:checked+.lr-switch-track{background:#b796c5}.lr-switch input:checked+.lr-switch-track:after{transform:translateX(20px)}.lr-narration-card.is-off{background:#fbf9fc!important}';document.head.appendChild(s)})();
