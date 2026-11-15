(()=>{
'use strict';
const $=id=>document.getElementById(id);
const HISTORY_KEY='lr-star-guide-history-v1', SAVE_KEY='lr-star-guide-save-enabled-v1';
let view='home',pendingImage=null,busy=false,turns=[];
let knowledge={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){const t=$('toast');t.textContent=s;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2400)}
function savedEnabled(){try{return localStorage.getItem(SAVE_KEY)==='1'}catch{return false}}
function setView(next){view=next;$('homeView').hidden=next!=='home';$('chatView').hidden=next!=='chat';$('historyView').hidden=next!=='history';$('historyBtn').hidden=next==='history';if(next==='history')renderHistory()}
function close(){try{if(parent&&typeof parent.__LOVE_RECORD_CLOSE_STAR_ASSISTANT==='function'){parent.__LOVE_RECORD_CLOSE_STAR_ASSISTANT();return}parent.postMessage({type:'LR_STAR_ASSISTANT_CLOSE'},location.origin)}catch{history.back()}}
$('backBtn').addEventListener('click',()=>{if(view!=='home')setView('home');else close()});
$('historyBtn').addEventListener('click',()=>setView('history'));
$('historyBack').addEventListener('click',()=>setView('home'));
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>startPrompt(b.dataset.prompt)));
$('uploadShortcut').addEventListener('click',()=>{setView('chat');$('imageInput').click()});
$('imageBtn').addEventListener('click',()=>$('imageInput').click());
$('imageInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type)){toast('请上传 PNG、JPG 或 WEBP 图片');return}if(f.size>8*1024*1024){toast('图片超过 8MB，请先压缩后上传');return}pendingImage=f;const url=URL.createObjectURL(f);$('imagePreview').hidden=false;$('imagePreview').innerHTML=`<img src="${url}" alt="待上传截图"><button id="removeImage">移除截图</button>`;$('removeImage').onclick=()=>{pendingImage=null;$('imageInput').value='';$('imagePreview').hidden=true;$('imagePreview').innerHTML=''};setView('chat')});
$('sendBtn').addEventListener('click',send);
$('questionInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
$('newChatBtn').addEventListener('click',()=>{turns=[];$('messages').innerHTML='';welcome();pendingImage=null;$('imagePreview').hidden=true;$('imagePreview').innerHTML='';$('imageInput').value='';toast('已开始新对话')});
$('saveHistoryToggle').checked=savedEnabled();
$('saveHistoryToggle').addEventListener('change',()=>{try{localStorage.setItem(SAVE_KEY,$('saveHistoryToggle').checked?'1':'0');if(!$('saveHistoryToggle').checked){localStorage.removeItem(HISTORY_KEY);toast('已关闭保存并清除历史记录')}else toast('已开启对话保存')}catch{toast('设置保存失败')}});
$('clearHistoryBtn').addEventListener('click',()=>{if(!confirm('确定删除星星助手保存的全部对话吗？此操作不会影响其他应用。'))return;localStorage.removeItem(HISTORY_KEY);renderHistory();toast('已删除保存的对话')});
function welcome(){ $('messages').innerHTML='<div class="welcome-msg"><div class="star-avatar">✦</div><div class="bubble"><b>我是星星，很高兴见到你！</b><p>你可以直接描述问题，也可以上传截图。我会尽量结合 LOVE RECORD 的资料帮你解答。</p></div></div>'}
function normalizeAssistantMarkdown(raw){
 let s=String(raw??'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 // Repair common malformed emphasis emitted by models.
 s=s.replace(/\*\*\*([\s\S]*?)\*\*\*/g,'**$1**');
 s=s.replace(/(^|\n)\s*\*\*\s*(\d+[.、)]\s*)/g,'$1\n$2');
 s=s.replace(/\s+\*\*\s*(?=(?:#{1,3}\s|[-•]\s|\d+[.、)]\s))/g,'\n');
 s=s.replace(/([。！？；])\s*(?=(?:\*\*[^*\n]{1,30}\*\*|#{1,3}\s|\d+[.、)]\s))/g,'$1\n\n');
 s=s.replace(/([。！？])\s*(?=(?:[-•]\s))/g,'$1\n');
 // If a model opens bold but forgets the closing marker, don't expose raw asterisks.
 s=s.replace(/\*\*(?![^*\n]*\*\*)/g,'');
 return s.trim();
}
function inlineMarkdown(s){
 let x=esc(s);
 x=x.replace(/`([^`]+)`/g,'<code>$1</code>');
 x=x.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
 x=x.replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
 x=x.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>');
 x=x.replace(/(^|[^_])_([^_\n]+)_(?!_)/g,'$1<em>$2</em>');
 // Remove any leftover markdown control characters instead of showing them.
 x=x.replace(/\*\*/g,'').replace(/__/g,'');
 return x;
}
function renderMarkdown(raw){
 const normalized=normalizeAssistantMarkdown(raw);
 const lines=normalized.split('\n');
 const out=[];let para=[],listType='';
 const flushPara=()=>{if(para.length){out.push('<p>'+para.map(inlineMarkdown).join('<br>')+'</p>');para=[]}};
 const closeList=()=>{if(listType){out.push(listType==='ul'?'</ul>':'</ol>');listType=''}};
 for(const line of lines){
  const t=line.trim();
  if(!t){flushPara();closeList();continue}
  const h=t.match(/^(#{1,3})\s+(.+)$/);
  if(h){flushPara();closeList();const level=Math.min(h[1].length+1,4);out.push('<h'+level+'>'+inlineMarkdown(h[2])+'</h'+level+'>');continue}
  const ul=t.match(/^[-*•]\s+(.+)$/),ol=t.match(/^\d+[.)、]\s*(.+)$/);
  if(ul||ol){flushPara();const next=ul?'ul':'ol';if(listType!==next){closeList();out.push('<'+next+'>');listType=next}out.push('<li>'+inlineMarkdown((ul||ol)[1])+'</li>');continue}
  if(/^>\s?/.test(t)){flushPara();closeList();out.push('<blockquote>'+inlineMarkdown(t.replace(/^>\s?/,''))+'</blockquote>');continue}
  para.push(t);
 }
 flushPara();closeList();return out.join('');
}
function addMessage(role,text,imageUrl){const row=document.createElement('div');row.className='message '+(role==='user'?'user':'assistant');if(role!=='user'){const av=document.createElement('div');av.className='star-avatar';av.textContent='✦';row.appendChild(av)}const bubble=document.createElement('div');bubble.className='bubble';if(imageUrl){const im=document.createElement('img');im.src=imageUrl;im.alt='用户上传的截图';bubble.appendChild(im)}const content=document.createElement('div');content.className='message-content';if(role==='assistant')content.innerHTML=renderMarkdown(text);else content.textContent=text;bubble.appendChild(content);row.appendChild(bubble);$('messages').appendChild(row);$('messages').scrollTop=$('messages').scrollHeight}
function getRuntime(){let x={};try{if(parent&&typeof parent.__LOVE_RECORD_GET_RUNTIME_INFO==='function')x=parent.__LOVE_RECORD_GET_RUNTIME_INFO()||{}}catch{}return x}
function getApi(){try{if(parent&&typeof parent.__LOVE_RECORD_GET_API_CONFIG==='function')return parent.__LOVE_RECORD_GET_API_CONFIG()||{}}catch{}try{return JSON.parse(localStorage.getItem('love-record-api-settings-v1')||'{}')}catch{return {}}}
function getVersion(){const r=getRuntime();return String(r.version||r.appVersion||'').trim()}
async function loadKnowledge(){try{const r=await fetch('./star-guide-knowledge.json?v=4',{cache:'no-store'});if(r.ok)knowledge=await r.json()}catch{}const v=getVersion();$('versionPill').textContent=v?'当前应用版本：'+v:'应用版本：暂无法自动读取';$('chatStatus').textContent=v?'当前版本：'+v+' · 优先匹配版本知识':'版本信息暂不可用 · 回答时会说明资料范围'}
function relevantKnowledge(q){
 const text=String(q||'').toLowerCase(),out=[];
 const broad=/(love\s*record|小手机|整个|全部|所有|主要|介绍|功能|应用|app|怎么用|有哪些|总览|新手)/i.test(text);
 for(const group of (knowledge.versions||[])){
  for(const m of (group.modules||[])){
   const terms=[m.name,...(m.keywords||[])];
   let score=terms.reduce((n,t)=>{const term=String(t||'').toLowerCase();return n+(term&&text.includes(term)?(term.length<=2?0.5:1):0)},0);
   if(m.id==='overview'&&broad)score+=5;
   if(score)out.push({score,module:m,version:group.label});
  }
 }
 out.sort((a,b)=>b.score-a.score);
 if(!out.length){
  const current=(knowledge.versions||[]).find(g=>g.status==='active')||(knowledge.versions||[])[0];
  const overview=current?.modules?.find(m=>m.id==='overview');
  if(overview)out.push({score:1,module:overview,version:current.label});
 }
 return out.slice(0,broad?8:5);
}
function relevantCases(q){
 const text=String(q||'').toLowerCase(),hits=[];
 for(const c of (knowledge.troubleshooting_cases||[])){
  const terms=[c.title,...(c.symptoms||[]),...(c.id==='429'?['429']:c.id==='403'?['403']:c.id==='400'?['400']:c.id==='5xx'?['500','502','503','504']:[])];
  const score=terms.reduce((n,t)=>{const v=String(t||'').toLowerCase();return n+(v&&text.includes(v)?(v.length<=2?2:1):0)},0);
  if(score)hits.push({score,case:c});
 }
 return hits.sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.case);
}
function makeContext(q){
 const hits=relevantKnowledge(q),runtime=getRuntime(),cases=relevantCases(q);
 return {runtime:{version:getVersion()||'未知',page:String(runtime.page||'星星助手')},
  knowledge:hits.map(h=>({module:h.module.name,version:h.version,facts:h.module.facts||[],steps:h.module.steps||[],manualSteps:h.module.manual_steps||[],cautions:h.module.cautions||[]})),
  troubleshootingCases:cases.map(c=>({title:c.title,symptoms:c.symptoms,possibleCauses:c.possible_causes,safeSteps:c.safe_steps,resolution:c.resolution,avoid:c.avoid})),
  knowledgeNotice:knowledge.notice||'',sourceBuild:knowledge.sourceBuild||'未知'};
}
function systemPrompt(q){const c=makeContext(q);return `你是 LOVE RECORD 官方智能助手「星星」。请用自然、亲切、清楚的中文回答。你服务于整个 LOVE RECORD。必须优先使用当前版本知识库和检索到的故障案例。
【回答排版】必须使用清晰的 Markdown：开头先给一句结论；不同主题分成独立段落；步骤使用有序列表；并列事项使用项目符号；重要提醒可用 **加粗**。段落之间留一个空行。不要把所有内容挤成一整段，不要输出大段连续文字。不要滥用标题，每个回答最多使用 2-4 个简短小标题。避免把 JSON、内部知识库或检索数据直接展示给用户。用户只问某一个应用（例如「空间」）时，只介绍该应用，不要顺带介绍其他应用。默认控制在 250-450 个汉字；用户明确要求详细说明时再展开。介绍单个应用时按「用途」「主要功能」「怎么开始」组织，只列当前源码确实存在的功能，不要把知识库所有条目原样倾倒给用户。
【知识与准确性】1. 回答功能介绍时可以综合多个模块；用户问整体功能时，应基于总览条目列出当前源码中存在的应用及用途。2. 不得编造当前版本没有证据支持的按钮、页面或功能。3. 若知识库不足，可以用一般技术知识推理，但必须标注「推测/可能原因」，并说明验证方法。4. 版本信息未知或知识库版本不匹配时必须说明。5. 若检索到故障案例，按「现象判断 → 可能原因 → 安全排查 → 下一步处理」组织答案；原因不能当成已证实结论。6. 知识库没有说明具体操作路径时，坦白资料不足，不要猜按钮名称。
【隐私与安全】绝不索取或读取其他应用的聊天记录、联系人资料、角色记忆、农场私人数据、陪伴照片、信件或回忆；不要求用户提供 API Key、密码等秘密。涉及清除数据、重置、覆盖、删除时，先提醒备份并解释风险。排查优先采用安全、可逆步骤。不要建议用户直接清除整个网站数据、IndexedDB 或 localStorage。
当前运行信息、匹配到的知识库与故障案例（资料为空代表没有检索到可靠条目）：${JSON.stringify(c)}`}
async function imageData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file)})}
function apiEndpoint(base){return String(base||'').trim().replace(/\/+$/,'')+'/chat/completions'}
async function send(){if(busy)return;const q=$('questionInput').value.trim();if(!q&&!pendingImage)return;const cfg=getApi();if(!cfg.apiBase||!cfg.apiKey||!cfg.apiModel){toast('请先在 LOVE RECORD 首页配置 API');return}
busy=true;$('sendBtn').disabled=true;const image=pendingImage;const preview=image?await imageData(image):null;addMessage('user',q||'请帮我分析这张截图。',preview);turns.push({role:'user',text:q||'请帮我分析这张截图。',image:preview});$('questionInput').value='';pendingImage=null;$('imageInput').value='';$('imagePreview').hidden=true;$('imagePreview').innerHTML='';addMessage('assistant','星星正在整理资料并分析问题……');
try{const messages=[{role:'system',content:systemPrompt(q)}];for(const t of turns.slice(-10)){if(t.role==='user'&&t.image){messages.push({role:'user',content:[{type:'text',text:t.text},{type:'image_url',image_url:{url:t.image}}]})}else messages.push({role:t.role,content:t.text})}
const res=await fetch(apiEndpoint(cfg.apiBase),{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey,'Accept':'application/json'},body:JSON.stringify({model:cfg.apiModel,messages,stream:false}),signal:AbortSignal.timeout?AbortSignal.timeout(60000):undefined});
const raw=await res.text();if(!res.ok)throw new Error('HTTP '+res.status+'：'+raw.slice(0,260));const data=JSON.parse(raw);const answer=data?.choices?.[0]?.message?.content;if(typeof answer!=='string'||!answer.trim())throw new Error('模型返回了空内容');const last=$('messages').lastElementChild;if(last)last.remove();addMessage('assistant',answer);turns.push({role:'assistant',text:answer});if(savedEnabled())saveHistory(q||'截图问题',turns); 
}catch(e){const last=$('messages').lastElementChild;if(last&&last.textContent.includes('正在整理'))last.remove();addMessage('assistant','这次我没能成功取得模型回复。\\n\\n'+(e.message||'请求失败')+'\\n\\n请检查首页 API 配置、模型状态或稍后重试。你的问题没有被清除，可以重新发送。');}
finally{busy=false;$('sendBtn').disabled=false}}
function startPrompt(q){setView('chat');$('questionInput').value=q;send()}
function saveHistory(title,items){try{const all=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');all.unshift({id:Date.now(),title:String(title).slice(0,80),at:new Date().toISOString(),items:items.map(x=>({role:x.role,text:x.text}))});localStorage.setItem(HISTORY_KEY,JSON.stringify(all.slice(0,40)))}catch{toast('历史记录保存失败：本地存储可能不足')}}
function renderHistory(){const enabled=savedEnabled();$('saveHistoryToggle').checked=enabled;let all=[];try{all=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{};$('historyList').innerHTML=enabled&&all.length?all.map(x=>`<div class="history-item"><span>${esc(x.title)}<br><small>${esc(new Date(x.at).toLocaleString())}</small></span><button data-delete-history="${x.id}">删除</button></div>`).join(''): '<p style="color:#a58c9c;font-size:12px">'+(enabled?'暂时没有保存的对话。':'目前未开启对话保存。')+'</p>';$('historyList').querySelectorAll('[data-delete-history]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.deleteHistory);all=all.filter(x=>x.id!==id);localStorage.setItem(HISTORY_KEY,JSON.stringify(all));renderHistory()})}
loadKnowledge();
})();