/* LOVE RECORD · Shared AI Diary v1
   Browser-local diary storage, contact-aware AI writing, important-event sync and manual reviews. */
(function(){
'use strict';
const KEY='love-record-diary-v1';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let generationBusy=false, syncBusy=false, reviewBusy=false, filter='all', query='', diaryCache=null, diaryInitPromise=null;
function normalizeDiary(x){x=x&&typeof x==='object'?x:{};return {entries:Array.isArray(x.entries)?x.entries:[],autoImportant:x.autoImportant!==false,processed:Array.isArray(x.processed)?x.processed:[]}}
function read(){if(diaryCache)return diaryCache;try{const raw=localStorage.getItem(KEY);if(raw)return normalizeDiary(JSON.parse(raw));const legacy=(typeof state!=='undefined'&&Array.isArray(state.journal))?state.journal:[];const migrated=legacy.map((j,i)=>({id:String(j.id||('legacy-diary-'+i)),createdAt:Number(j.createdAt)||Date.now(),updatedAt:Number(j.updatedAt)||Date.now(),authorType:'user',authorName:personaName(),contactId:'',contactName:'',title:String(j.title||'今天的日记'),mood:String(j.mood||''),content:String(j.note||j.content||''),source:'legacy'}));return normalizeDiary({entries:migrated,autoImportant:true,processed:[]})}catch{return normalizeDiary({})}}
async function initDiaryStore(){if(diaryInitPromise)return diaryInitPromise;diaryInitPromise=(async()=>{let stored=null;try{if(typeof lrKVGet==='function')stored=await lrKVGet(KEY)}catch(e){console.warn('[LR diary] IndexedDB read failed; attempting legacy migration',e)}if(stored&&typeof stored==='object'){diaryCache=normalizeDiary(stored);return diaryCache}let legacy=null;try{legacy=localStorage.getItem(KEY)}catch{}if(legacy){try{diaryCache=normalizeDiary(JSON.parse(legacy))}catch{diaryCache=normalizeDiary({})}}else diaryCache=read();try{if(typeof lrKVSet==='function')await lrKVSet(KEY,diaryCache);else throw new Error('IndexedDB helper unavailable');}catch(e){console.warn('[LR diary] IndexedDB migration/write failed',e)}return diaryCache})();return diaryInitPromise}
async function write(d){const next=normalizeDiary(d);try{if(typeof lrKVSet==='function'){await lrKVSet(KEY,next);diaryCache=next;try{localStorage.setItem(KEY,JSON.stringify(next))}catch(e){/* IndexedDB is the primary copy; localStorage may be full. */}return true}}catch(e){console.error('[LR diary] IndexedDB save failed',e)}try{localStorage.setItem(KEY,JSON.stringify(next));diaryCache=next;return true}catch(e){console.error('[LR diary] save failed',e);return false}}
function cfg(){let s={};try{s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}')||{}}catch{};return {base:String((typeof state!=='undefined'&&state.apiBase)||s.apiBase||$('apiBase')?.value||'').trim().replace(/\/+$/,''),key:String((typeof state!=='undefined'&&state.apiKey)||s.apiKey||$('apiKey')?.value||'').trim(),model:String((typeof state!=='undefined'&&state.apiModel)||s.apiModel||$('apiModel')?.value||'').trim()}}
function people(){const ps=(typeof state!=='undefined'&&Array.isArray(state.people))?state.people:[];const ids=typeof readChatContacts==='function'?readChatContacts():ps.map(p=>p.id);return ps.filter(p=>ids.map(String).includes(String(p.id)))}
function getThreads(){try{return typeof readChatThreads==='function'?readChatThreads():JSON.parse(localStorage.getItem('love-record-chat-threads-v1')||'{}')}catch{return {}}}
function threadOf(id){const t=getThreads();return Array.isArray(t[String(id)])?t[String(id)]:[]}
function textOf(m){return String(m?.text??m?.content??'').replace(/\[\[LR_ORDER\|[\s\S]*?\]\]/g,'[外卖/购物订单]').trim()}
function dateLabel(at){try{return new Date(at||Date.now()).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return ''}}
function contactName(id){return people().find(p=>String(p.id)===String(id))?.name||'AI 联系人'}
function personaName(){try{return (state.selfPersonas||[]).find(p=>p.id===state.activeSelfPersonaId)?.name||state.name||'我'}catch{return '我'}}
function toast(s){if(typeof window.toast==='function')window.toast(s);else alert(s)}
function status(s,good=false){const el=$('lrDiaryStatus');if(el){el.textContent=s;el.style.color=good?'#66816f':'#8c7b90'}}
function apiReady(){const c=cfg();return c.base&&c.key&&c.model}
async function ask(prompt,system){
 const c=cfg();if(!c.base||!c.key||!c.model)throw new Error('请先在设置中连接 API，并确认 Base URL、Key 和模型。');
 const r=await fetch(c.base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key,'Accept':'application/json'},body:JSON.stringify({model:c.model,messages:[{role:'system',content:system},{role:'user',content:prompt}],stream:false})});
 const raw=await r.text();if(!r.ok){let msg=raw;try{msg=JSON.parse(raw).error?.message||JSON.parse(raw).message||raw}catch{}throw new Error('HTTP '+r.status+' · '+String(msg).slice(0,220))}
 let j;try{j=JSON.parse(raw)}catch{throw new Error('API 返回内容不是有效 JSON')}
 const ch=j?.choices?.[0]?.message?.content;let out=typeof ch==='string'?ch:Array.isArray(ch)?ch.map(x=>x.text||'').join(''):'';if(!out)throw new Error('模型没有返回内容');return out.trim()
}
function parseJSON(s){const clean=String(s).replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();try{return JSON.parse(clean)}catch{}const a=clean.indexOf('{'),b=clean.lastIndexOf('}');if(a>=0&&b>a){try{return JSON.parse(clean.slice(a,b+1))}catch{}}const c=clean.indexOf('['),d=clean.lastIndexOf(']');if(c>=0&&d>c){try{return JSON.parse(clean.slice(c,d+1))}catch{}}throw new Error('AI 返回格式无法解析，请重试')}
async function addEntry(entry){const d=read();const x={id:'diary-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),createdAt:Date.now(),updatedAt:Date.now(),visibility:'shared',...entry};d.entries.unshift(x);if(!await write(d))throw new Error('日记保存失败：浏览器独立储存不可用，请检查浏览器权限后重试。');return x}
function render(){
 const body=$('moduleBody');if(!body)return;
 const d=read(),ps=people();
 const filtered=d.entries.filter(e=>(filter==='all'||e.authorType===filter)&&(query===''||(e.title+' '+e.content+' '+e.authorName).toLowerCase().includes(query.toLowerCase())));
 body.innerHTML=`
 <div class="lr-diary-wrap">
  <section class="lr-diary-hero"><div class="lr-diary-kicker">OUR PRIVATE JOURNAL</div><h3>把重要的日子，留在这里。</h3><p>你和当前 AI 联系人共享日记。你可以亲自写，也可以让 AI 根据聊天生成你或 TA 的日记。</p>
   <div class="lr-diary-actions"><button class="btn primary" data-diary-action="write">＋ 写一篇日记</button><button class="btn" data-diary-action="generate-me">✦ 生成我的日记</button><button class="btn" data-diary-action="generate-ai">♡ 生成 TA 的日记</button></div>
   ${ps.length?`<div class="lr-diary-target-row"><label for="lrDiaryTarget">选择聊天联系人</label><select id="lrDiaryTarget">${ps.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>`:'<div class="sub" style="margin-top:12px">先添加联系人并开启聊天，就能生成 TA 的日记。</div>'}
  </section>
  <section class="lr-diary-settings"><div class="lr-diary-setting-row"><div><b>聊天重要事件同步</b><small>仅提取值得记住的事件，不会把每句聊天都写进日记。</small></div><label class="lr-diary-switch"><input id="lrDiaryAuto" type="checkbox" ${d.autoImportant?'checked':''}><span></span></label></div>
   <div class="lr-diary-actions"><button class="btn" data-diary-action="sync">从聊天整理重要事件</button><button class="btn" data-diary-action="review">生成周期回顾</button></div>
   <div class="sub" id="lrDiaryStatus" role="status" aria-live="polite">${apiReady()?'API 已就绪，可以生成日记。':'请先连接 API；手动写日记仍可使用。'}</div>
  </section>
  <section class="lr-diary-filter"><label for="lrDiaryContact">查看日记</label><select id="lrDiaryContact"><option value="all">全部日记</option><option value="user">我的日记</option><option value="ai">AI 联系人的日记</option><option value="event">聊天重要事件</option><option value="review">周期回顾</option></select><input id="lrDiarySearch" placeholder="搜索标题、内容或联系人…" value="${esc(query)}"></section>
  <div class="lr-diary-list">${filtered.length?filtered.map(e=>`<article class="lr-diary-entry"><div class="lr-diary-entry-top"><span class="lr-diary-author">${esc(e.authorName||'日记')}</span><span class="lr-diary-date">${esc(dateLabel(e.createdAt))}</span></div><h4>${esc(e.title||'未命名日记')}</h4>${e.mood?`<div class="lr-diary-mood">♡ ${esc(e.mood)}</div>`:''}<p>${esc(e.content||'').replace(/\n/g,'<br>')}</p>${e.source==='chat-event'?'<div class="lr-diary-tag">聊天重要事件</div>':e.source==='review'?'<div class="lr-diary-tag">周期回顾</div>':''}<div class="lr-diary-entry-actions"><button class="mini-btn" data-diary-action="edit" data-id="${esc(e.id)}">编辑</button><button class="mini-btn danger" data-diary-action="delete" data-id="${esc(e.id)}">删除</button></div></article>`).join(''):'<div class="module-empty">这里还没有日记。可以先写一篇，或者点「生成 TA 的日记」，让 AI 联系人用自己的视角记录你们的故事。</div>'}</div>
 </div>`;
 const sel=$('lrDiaryContact');if(sel)sel.value=filter;
 const search=$('lrDiarySearch');if(search)search.addEventListener('input',()=>{query=search.value;const pos=search.selectionStart;render();const s=$('lrDiarySearch');s.focus();s.setSelectionRange(pos,pos)});
 const selector=$('lrDiaryContact');if(selector)selector.addEventListener('change',()=>{filter=selector.value;render()});
 const auto=$('lrDiaryAuto');if(auto)auto.addEventListener('change',async()=>{const x=read();x.autoImportant=auto.checked;if(!await write(x)){status('设置保存失败：浏览器独立储存不可用');return}status(auto.checked?'已开启：整理重要事件时会优先检查未处理的聊天内容。':'已关闭自动重要事件同步。',true)});
}
function openEditor(entry=null){
 const old=$('lrDiaryEditor');if(old)old.remove();
 const peopleOpts=people().map(p=>`<option value="${esc(p.id)}" ${entry?.contactId===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
 const wrap=document.createElement('div');wrap.id='lrDiaryEditor';wrap.className='lr-diary-editor-overlay';
 wrap.innerHTML=`<section class="lr-diary-editor"><div class="lr-diary-editor-head"><div><div class="lr-diary-kicker">JOURNAL ENTRY</div><h3>${entry?'编辑日记':'写一篇日记'}</h3></div><button type="button" class="module-close" data-diary-close>×</button></div><label>日记作者</label><select id="lrDiaryAuthor"><option value="user" ${!entry||entry.authorType==='user'?'selected':''}>我</option><option value="ai" ${entry?.authorType==='ai'?'selected':''}>AI 联系人</option></select><label>关联联系人</label><select id="lrDiaryEditorContact">${peopleOpts||'<option value="">还没有联系人</option>'}</select><label>标题</label><input id="lrDiaryEditTitle" maxlength="120" placeholder="今天想记住什么？" value="${esc(entry?.title||'')}"><label>心情（可选）</label><input id="lrDiaryEditMood" maxlength="80" placeholder="平静、开心、疲惫……" value="${esc(entry?.mood||'')}"><label>日记内容</label><textarea id="lrDiaryEditContent" rows="7" placeholder="写下今天发生的事……">${esc(entry?.content||'')}</textarea><div class="lr-diary-actions"><button class="btn primary" data-diary-save="${esc(entry?.id||'')}">保存日记</button><button class="btn" data-diary-close>取消</button></div></section>`;
 $('moduleBody').appendChild(wrap);
}
async function generate(type){
 if(generationBusy){toast('日记正在生成，请稍等一下 ♡');return}generationBusy=true;const actionButtons=[...document.querySelectorAll('[data-diary-action^="generate-"]')];actionButtons.forEach(b=>{b.disabled=true;b.dataset.oldText=b.textContent;b.textContent='正在生成…'});status('AI 正在整理你们的聊天并生成日记……');try{
  const ps=people();if(!ps.length)throw new Error('请先在联系人页面添加 AI 联系人，并把 TA 加入聊天。');
  const chosen=$('lrDiaryTarget')?.value||ps[0].id;const person=ps.find(p=>String(p.id)===String(chosen))||ps[0];
  const thread=threadOf(person.id);if(!thread.length)throw new Error('你和 '+person.name+' 还没有聊天记录，先聊几句再生成会更自然。');
  const recent=thread.slice(-80).map(m=>({role:m.role==='assistant'?'AI联系人':'我',time:dateLabel(m.at),text:textOf(m)})).filter(m=>m.text);
  const isAI=type==='ai',system=isAI?'你是角色日记写作者。严格依据聊天记录和角色设定，以该 AI 联系人的第一人称写日记。可以写角色有根据的感受和观察，但不得伪造聊天中没有发生的重大事实，不要替用户编造内心、台词或行动。输出严格 JSON 对象：{"title":"标题","mood":"心情短语","content":"日记正文"}。只输出 JSON。':'你是私人日记助手。根据聊天记录，以用户第一人称写一篇用户自己的日记，温柔自然，像真实的人在回顾一天。只记录聊天中有依据的重要经历；不要替用户捏造感受、行动或事实。不必面面俱到，重点是值得留存的片段。输出严格 JSON 对象：{"title":"标题","mood":"心情短语","content":"日记正文"}。只输出 JSON。';
  const prompt=`作者：${isAI?person.name:personaName()}。\nAI联系人资料：名字=${person.name};身份=${person.role||''};性格=${person.personality||''};说话方式=${person.speech||''};背景=${person.background||''};外貌=${person.appearance||''};规则=${person.instructions||''}。\n以下是最近聊天，时间顺序排列：\n${JSON.stringify(recent)}\n请生成一篇 180-450 字左右的日记，避免把聊天逐条复述；有标题和自然的正文。`;
  const obj=parseJSON(await ask(prompt,system));if(!obj.content)throw new Error('AI 没有生成日记正文。');
  await addEntry({authorType:isAI?'ai':'user',authorName:isAI?person.name:personaName(),contactId:String(person.id),contactName:person.name,title:String(obj.title||'今天的日记'),mood:String(obj.mood||''),content:String(obj.content),source:'ai-generated',threadLastAt:thread[thread.length-1]?.at||0});
  status((isAI?person.name:'你的')+'的日记已生成并保存。',true);render();toast((isAI?person.name:'你的')+'的日记生成成功 ♡');
 }catch(e){status('生成失败：'+e.message);toast('日记生成失败：'+e.message)}finally{generationBusy=false;actionButtons.forEach(b=>{b.disabled=false;if(b.dataset.oldText)b.textContent=b.dataset.oldText;delete b.dataset.oldText})}
}
async function syncEvents(){
 if(syncBusy){toast('正在整理重要事件，请稍等 ♡');return}syncBusy=true;try{
  const d=read(),ps=people();if(!ps.length)throw new Error('没有可同步的 AI 联系人。');
  const allThreads=getThreads(),pending=[];
  ps.forEach(p=>(allThreads[String(p.id)]||[]).slice(-60).forEach((m,i)=>{const text=textOf(m),at=Number(m.at)||0,key=String(p.id)+'|'+at+'|'+text.slice(0,80);if(text&&text.length>8&&!d.processed.includes(key))pending.push({key,contactId:String(p.id),contactName:p.name,role:m.role==='assistant'?'AI联系人':'我',at,text})}));
  if(!pending.length){status('没有发现尚未整理的新聊天内容。',true);return}
  status('正在筛选值得记录的重要事件……');
  const batch=pending.slice(-100);
  const out=parseJSON(await ask(`请从以下聊天中筛选真正重要、值得长期留存的事件，例如关系进展、承诺、重要决定、共同经历、特殊纪念日或明显影响后续的事情。普通寒暄、重复内容、纯订单提示、无意义短句不要记录。不能推测事实。对每个事件给出 sourceKeys 数组（只能使用输入里的 key），title、content（简短客观概括）、contactId、contactName、at。若没有重要事件，返回空数组。输入：${JSON.stringify(batch.map(x=>({...x, text:x.text.slice(0,500)})))}\n只输出 JSON 数组。`,'你是重要事件筛选器，只能输出合法 JSON 数组，不要编造事件。'));
  const arr=Array.isArray(out)?out:(out.events||[]);let count=0;
  for(const ev of arr){const keys=Array.isArray(ev.sourceKeys)?ev.sourceKeys:[];const source=batch.find(x=>keys.includes(x.key));if(!source||!String(ev.content||'').trim())continue;await addEntry({authorType:'event',authorName:source.contactName+' · 共同记忆',contactId:source.contactId,contactName:source.contactName,title:String(ev.title||'一件值得记住的事'),mood:'',content:String(ev.content),source:'chat-event',createdAt:Number(ev.at)||source.at||Date.now(),sourceKeys:keys});count++}
  const latest=read();latest.processed=[...new Set([...latest.processed,...batch.map(x=>x.key)])].slice(-5000);if(!await write(latest))throw new Error('重要事件已整理，但处理记录保存失败；请检查浏览器储存权限后重试。');status(count?`已从聊天中整理并保存 ${count} 条重要事件。`:'整理完成：这批聊天里没有发现需要单独记录的重要事件。',true);render();toast(count?'重要事件已同步到日记 ♡':'整理完成，没有新增重要事件');
 }catch(e){status('同步失败：'+e.message);toast('重要事件同步失败：'+e.message)}finally{syncBusy=false}
}
async function review(){
 if(reviewBusy){toast('周期回顾正在生成，请稍等 ♡');return}reviewBusy=true;try{const d=read(),recent=d.entries.filter(e=>e.source!=='review').slice(0,40);if(!recent.length)throw new Error('还没有日记或重要事件，先积累一些记录再生成回顾。');
 status('正在生成周期回顾……');const obj=parseJSON(await ask(`请根据这些日记与重要事件，生成一份温柔、准确的周期回顾。总结反复出现的主题、值得珍惜的瞬间、关系变化和仍未完成的约定；只根据材料，不作诊断、不凭空添加。输出 JSON 对象 {"title":"回顾标题","content":"回顾正文"}。材料：${JSON.stringify(recent.map(e=>({date:dateLabel(e.createdAt),author:e.authorName,title:e.title,content:e.content,source:e.source})))}`,'你是私人日记回顾助手，只输出合法 JSON 对象。'));
 await addEntry({authorType:'review',authorName:'我们的周期回顾',contactId:'',contactName:'',title:String(obj.title||'最近的日子'),mood:'回顾',content:String(obj.content||''),source:'review'});status('周期回顾已生成并保存。',true);render();toast('周期回顾生成成功 ♡');
 }catch(e){status('回顾生成失败：'+e.message);toast('周期回顾生成失败：'+e.message)}finally{reviewBusy=false}
}
async function saveEditor(id){
 const title=$('lrDiaryEditTitle').value.trim(),content=$('lrDiaryEditContent').value.trim();if(!content){toast('先写一点日记内容吧');return}
 const d=read(),old=d.entries.find(e=>e.id===id),authorType=$('lrDiaryAuthor').value,contactId=$('lrDiaryEditorContact').value,person=people().find(p=>String(p.id)===String(contactId));
 const patch={authorType,authorName:authorType==='ai'?(person?.name||'AI 联系人'):personaName(),contactId:String(contactId||''),contactName:person?.name||'',title:title||'今天的日记',mood:$('lrDiaryEditMood').value.trim(),content,source:'manual',updatedAt:Date.now()};
 if(old)Object.assign(old,patch,{updatedAt:Date.now()});else d.entries.unshift({id:'diary-'+Date.now(),createdAt:Date.now(),...patch});
 if(!await write(d)){toast('保存失败：浏览器独立储存不可用');return false}render();toast('日记已保存 ♡');return true
}
function bind(){
 const body=$('moduleBody');if(!body||body.dataset.diaryBound)return;body.dataset.diaryBound='1';
 body.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-diary-action],[data-diary-save],[data-diary-close]');if(!btn)return;
  e.preventDefault();e.stopPropagation();
  if(btn.hasAttribute('data-diary-close')){$('lrDiaryEditor')?.remove();return}
  if(btn.hasAttribute('data-diary-save')){const saved=await saveEditor(btn.dataset.diarySave);if(saved)$('lrDiaryEditor')?.remove();return}
  const a=btn.dataset.diaryAction,id=btn.dataset.id,d=read(),entry=d.entries.find(x=>x.id===id);
  if(a==='write'){openEditor();return}
  if(a==='generate-me'||a==='generate-ai'){
   if(window.__lrDiaryAutoScanTimer){clearTimeout(window.__lrDiaryAutoScanTimer);window.__lrDiaryAutoScanTimer=null}
   if(!apiReady()){status('请先连接 API，并选择模型。');return}
   let target=$('lrDiaryTarget');if(!target){const ps=people();if(!ps.length){toast('请先添加并启用一个聊天联系人');return}
    const wrap=document.createElement('div');wrap.className='lr-diary-target-row';wrap.innerHTML=`<label for="lrDiaryTarget">选择同步联系人</label><select id="lrDiaryTarget">${ps.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>`;body.querySelector('.lr-diary-hero')?.appendChild(wrap)}
   generate(a==='generate-ai'?'ai':'user');return
  }
  if(a==='sync'){if(window.__lrDiaryAutoScanTimer){clearTimeout(window.__lrDiaryAutoScanTimer);window.__lrDiaryAutoScanTimer=null}if(!apiReady()){status('请先连接 API，并选择模型。');return}syncEvents();return}
  if(a==='review'){if(!apiReady()){status('请先连接 API，并选择模型。');return}review();return}
  if(a==='edit'&&entry){openEditor(entry);return}
  if(a==='delete'&&entry&&confirm('确定删除这篇日记吗？')){d.entries=d.entries.filter(x=>x.id!==id);if(await write(d)){render();toast('日记已删除')}else toast('删除失败：浏览器独立储存不可用');return}
 });
 body.addEventListener('change',e=>{if(e.target.id==='lrDiaryContact'){filter=e.target.value;render()}});
}
const style=document.createElement('style');style.textContent=`
/* Full-screen journal app shell */
.module-modal.journal-fullscreen{z-index:2147483000!important;inset:0!important;align-items:stretch!important;justify-content:stretch!important;display:none;background:linear-gradient(145deg,rgba(241,235,248,.96),rgba(230,224,241,.93) 48%,rgba(248,242,247,.97))!important;backdrop-filter:blur(30px) saturate(165%)!important;-webkit-backdrop-filter:blur(30px) saturate(165%)!important;overflow:hidden}
.module-modal.journal-fullscreen.show{display:flex!important}
.module-modal.journal-fullscreen .module-sheet{position:relative!important;width:100%!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;padding:calc(env(safe-area-inset-top,0px) + 18px) 20px calc(env(safe-area-inset-bottom,0px) + 30px)!important;border-radius:0!important;overflow-y:auto!important;overscroll-behavior:contain;background:linear-gradient(145deg,rgba(255,255,255,.54),rgba(247,242,251,.42) 45%,rgba(255,255,255,.58))!important;border:1px solid rgba(255,255,255,.72)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 60px rgba(126,95,151,.09)!important;box-sizing:border-box!important;backdrop-filter:blur(36px) saturate(170%)!important;-webkit-backdrop-filter:blur(36px) saturate(170%)!important}
.module-modal.journal-fullscreen .module-head{position:sticky;top:calc(-1 * (env(safe-area-inset-top,0px) + 18px));z-index:5;margin:calc(-1 * (env(safe-area-inset-top,0px) + 18px)) -20px 18px;padding:calc(env(safe-area-inset-top,0px) + 22px) 20px 16px;background:rgba(247,242,250,.64);border-bottom:1px solid rgba(255,255,255,.78);backdrop-filter:blur(28px) saturate(170%);-webkit-backdrop-filter:blur(28px) saturate(170%)}
.module-modal.journal-fullscreen .module-head h2{font-family:Georgia,'Noto Serif SC',serif;font-size:28px;letter-spacing:.01em;font-weight:500;margin:6px 0 0;color:#3e3545}
.module-modal.journal-fullscreen .module-close{width:44px;height:44px;background:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.95);box-shadow:0 5px 18px rgba(83,62,98,.08);backdrop-filter:blur(18px);font-size:22px}
.lr-diary-wrap{display:grid;gap:16px;padding:0 0 34px;max-width:760px;margin:0 auto;color:#443b4b}
.lr-diary-hero,.lr-diary-settings,.lr-diary-filter,.lr-diary-entry{position:relative;background:linear-gradient(135deg,rgba(255,255,255,.66),rgba(255,255,255,.34));border:1px solid rgba(255,255,255,.86);border-radius:28px;padding:21px;box-shadow:0 12px 34px rgba(100,76,120,.07),inset 0 1px 0 rgba(255,255,255,.9);backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%)}
.lr-diary-kicker{font-family:Georgia,serif;font-size:10px;letter-spacing:.28em;color:#a18eab}.lr-diary-hero h3{font-family:Georgia,'Noto Serif SC',serif;font-size:clamp(23px,5vw,30px);line-height:1.4;font-weight:400;letter-spacing:.015em;margin:12px 0;color:#3f3547}.lr-diary-hero p,.lr-diary-settings small{font-size:13px;line-height:1.9;color:#8c8092}.lr-diary-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}.lr-diary-actions .btn{margin:0;flex:0 1 auto;min-height:43px;border-radius:999px;padding:11px 16px;background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.98);box-shadow:0 4px 15px rgba(108,83,126,.045);color:#5d5064;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.lr-diary-actions .btn.primary{background:linear-gradient(135deg,rgba(185,155,201,.93),rgba(160,131,183,.9));color:#fff;border-color:rgba(255,255,255,.6);box-shadow:0 7px 20px rgba(152,119,173,.18)}.lr-diary-actions .btn:disabled{opacity:.58;cursor:wait}
.lr-diary-setting-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.lr-diary-setting-row b{display:block;font-size:15px;font-weight:500;margin-bottom:5px;color:#55485d}.lr-diary-setting-row small{display:block;max-width:300px}.lr-diary-switch input{position:absolute;opacity:0}.lr-diary-switch span{display:block;width:46px;height:27px;border-radius:99px;background:rgba(175,159,184,.48);border:1px solid rgba(255,255,255,.9);position:relative;transition:.2s;box-shadow:inset 0 2px 4px rgba(70,48,82,.07)}.lr-diary-switch span:after{content:'';position:absolute;width:21px;height:21px;left:2px;top:2px;border-radius:50%;background:linear-gradient(145deg,#fff,#f2edf5);box-shadow:0 2px 7px rgba(54,35,63,.17);transition:.2s}.lr-diary-switch input:checked+span{background:linear-gradient(120deg,#c5a6d0,#a98bbd)}.lr-diary-switch input:checked+span:after{transform:translateX(19px)}
.lr-diary-filter{display:grid;grid-template-columns:1fr;gap:10px}.lr-diary-filter label,.lr-diary-editor label,.lr-diary-target-row label{font-size:12px;color:#98889f;letter-spacing:.08em}.lr-diary-filter input,.lr-diary-filter select,.lr-diary-editor input,.lr-diary-editor textarea,.lr-diary-editor select,.lr-diary-target-row select{width:100%;box-sizing:border-box;border:1px solid rgba(222,211,230,.85);border-radius:17px;background:rgba(255,255,255,.57);padding:13px 14px;color:#463b4e;font:inherit;outline:none;box-shadow:inset 0 1px 2px rgba(90,65,105,.025);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}.lr-diary-filter input:focus,.lr-diary-filter select:focus,.lr-diary-editor input:focus,.lr-diary-editor textarea:focus,.lr-diary-editor select:focus,.lr-diary-target-row select:focus{border-color:rgba(172,140,192,.8);box-shadow:0 0 0 3px rgba(181,151,199,.13)}
.lr-diary-list{display:grid;gap:13px}.lr-diary-entry{padding:19px 20px;background:linear-gradient(145deg,rgba(255,255,255,.7),rgba(255,255,255,.38));border-radius:25px}.lr-diary-entry-top{display:flex;justify-content:space-between;gap:8px;align-items:center}.lr-diary-author{font-size:12px;color:#9a7da8;letter-spacing:.02em}.lr-diary-date{font-size:10px;color:#afa2b5}.lr-diary-entry h4{font-family:Georgia,'Noto Serif SC',serif;font-size:20px;font-weight:400;margin:11px 0 7px;color:#403646}.lr-diary-entry p{font-size:14px;line-height:2;color:#6d6172;white-space:normal;overflow-wrap:anywhere}.lr-diary-mood,.lr-diary-tag{display:inline-block;font-size:11px;color:#91749e;background:rgba(236,224,243,.7);border:1px solid rgba(255,255,255,.8);border-radius:99px;padding:5px 10px;margin:3px 0}.lr-diary-entry-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.lr-diary-entry-actions .mini-btn{background:rgba(255,255,255,.45);border-color:rgba(255,255,255,.9);border-radius:999px;padding:8px 13px}.lr-diary-target-row{margin-top:16px;display:grid;gap:8px}.lr-diary-target-row select{max-width:100%}.lr-diary-editor-overlay{position:fixed;inset:0;z-index:2147483002;background:rgba(62,48,72,.25);backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);display:flex;align-items:flex-end;justify-content:center;padding:12px;box-sizing:border-box}.lr-diary-editor{width:min(100%,620px);max-height:88dvh;overflow:auto;background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(248,242,251,.8));border:1px solid rgba(255,255,255,.95);border-radius:30px;padding:23px;box-sizing:border-box;box-shadow:0 24px 80px rgba(55,36,69,.2);backdrop-filter:blur(36px) saturate(160%);-webkit-backdrop-filter:blur(36px) saturate(160%)}.lr-diary-editor-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.lr-diary-editor-head h3{margin:7px 0 0;font-size:24px;font-weight:400;color:#403646}.lr-diary-editor label{display:block;margin:13px 0 7px}.lr-diary-editor textarea{resize:vertical;line-height:1.9}.lr-diary-editor .module-close{background:rgba(255,255,255,.6)}.module-modal.journal-fullscreen .module-empty{padding:38px 18px;border:1px dashed rgba(180,157,192,.42);border-radius:24px;color:#96869e;background:rgba(255,255,255,.24);line-height:1.9}
@media(min-width:560px){.lr-diary-filter{grid-template-columns:1fr 1.3fr;align-items:center}.lr-diary-filter label{grid-column:1/-1}.lr-diary-editor-overlay{align-items:center}}
@media(prefers-reduced-transparency:reduce){.module-modal.journal-fullscreen .module-sheet,.lr-diary-hero,.lr-diary-settings,.lr-diary-filter,.lr-diary-entry{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(249,245,251,.96)}}`
document.head.appendChild(style);
const oldRender=window.renderModule;
if(typeof oldRender==='function'){window.renderModule=function(name){oldRender(name);if(name==='journal'){initDiaryStore().then(()=>{if(document.querySelector('#moduleModal')?.dataset.module!=='journal')return;render();bind();const d=read();if(d.autoImportant&&apiReady()&&!window.__lrDiaryAutoScanRunning&&!window.__lrDiaryAutoScanTimer){window.__lrDiaryAutoScanTimer=setTimeout(()=>{window.__lrDiaryAutoScanTimer=null;window.__lrDiaryAutoScanRunning=true;syncEvents().finally(()=>{window.__lrDiaryAutoScanRunning=false})},1500)}}).catch(e=>{console.error('[LR diary] init failed',e);status('日记储存初始化失败，请刷新页面后重试。')})}}}
document.addEventListener('DOMContentLoaded',()=>{bind()});
})();
