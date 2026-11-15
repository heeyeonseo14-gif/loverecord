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
function addMessage(role,text,imageUrl){const row=document.createElement('div');row.className='message '+(role==='user'?'user':'assistant');if(role!=='user'){const av=document.createElement('div');av.className='star-avatar';av.textContent='✦';row.appendChild(av)}const bubble=document.createElement('div');bubble.className='bubble';if(imageUrl){const im=document.createElement('img');im.src=imageUrl;im.alt='用户上传的截图';bubble.appendChild(im)}const content=document.createElement('div');content.textContent=text;bubble.appendChild(content);row.appendChild(bubble);$('messages').appendChild(row);$('messages').scrollTop=$('messages').scrollHeight}
function getRuntime(){let x={};try{if(parent&&typeof parent.__LOVE_RECORD_GET_RUNTIME_INFO==='function')x=parent.__LOVE_RECORD_GET_RUNTIME_INFO()||{}}catch{}return x}
function getApi(){try{if(parent&&typeof parent.__LOVE_RECORD_GET_API_CONFIG==='function')return parent.__LOVE_RECORD_GET_API_CONFIG()||{}}catch{}try{return JSON.parse(localStorage.getItem('love-record-api-settings-v1')||'{}')}catch{return {}}}
function getVersion(){const r=getRuntime();return String(r.version||r.appVersion||'').trim()}
async function loadKnowledge(){try{const r=await fetch('./star-guide-knowledge.json?v=2',{cache:'no-store'});if(r.ok)knowledge=await r.json()}catch{}const v=getVersion();$('versionPill').textContent=v?'当前应用版本：'+v:'应用版本：暂无法自动读取';$('chatStatus').textContent=v?'当前版本：'+v+' · 优先匹配版本知识':'版本信息暂不可用 · 回答时会说明资料范围'}
function relevantKnowledge(q){
 const text=String(q||'').toLowerCase(),out=[];
 const broad=/(love\\s*record|小手机|整个|全部|所有|主要|介绍|功能|应用|app|怎么用|有哪些|总览|新手)/i.test(text);
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
function makeContext(q){
 const hits=relevantKnowledge(q),runtime=getRuntime();
 return {runtime:{version:getVersion()||'未知',page:String(runtime.page||'星星助手')},
  knowledge:hits.map(h=>({module:h.module.name,version:h.version,facts:h.module.facts||[],steps:h.module.steps||[],cautions:h.module.cautions||[]})),
  knowledgeNotice:knowledge.notice||'',sourceBuild:knowledge.sourceBuild||'未知'};
}
function systemPrompt(q){const c=makeContext(q);return `你是 LOVE RECORD 官方智能助手「星星」。你的表达专业、亲切、耐心，使用中文回答。你服务于整个 LOVE RECORD。你必须先理解用户问的是哪个应用，再优先使用提供的当前版本知识库。回答功能介绍时可以综合多个模块，不要只回答单个关键词；用户问整体功能时，应基于总览条目列出当前源码中存在的应用，并说明各自用途。严格遵守：1. 优先依据提供的知识库事实；2. 不得编造当前版本没有证据支持的按钮、页面或功能；3. 若知识库不足，可以使用一般技术知识推理，但必须明确标注「推测/可能原因」，并给出验证方法；4. 版本信息未知或知识库版本不匹配时必须说明，不得假称已自动识别；5. 只可使用提供的非敏感运行信息，绝不索取或读取其他应用的聊天记录、联系人资料、角色记忆、农场私人数据、陪伴照片、信件或回忆；6. 不要求用户提供 API Key、密码等秘密；7. 涉及清除数据、重置、覆盖、删除时先提醒备份并解释风险；8. 回答故障时优先给出安全、可逆的排查步骤；9. 知识库没有说明具体操作路径时，先坦白资料不足，不要猜按钮名称。回答尽量清晰分段，先给结论，再给步骤。当前运行信息和检索到的知识库资料（资料为空代表没有检索到可靠条目）：${JSON.stringify(c)}`}
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