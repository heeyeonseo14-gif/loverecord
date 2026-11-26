(function(){
'use strict';
const $=id=>document.getElementById(id);
const HISTORY_KEY='lr-dream-fate-history-v1';
const modes={dream:{label:'梦境解析',title:'解梦记录',icon:'☾'},fortune:{label:'命理解读',title:'命理记录',icon:'✧'},match:{label:'关系配对',title:'配对记录',icon:'♡'}};
let currentMode='dream',lastReading=null,controller=null,requestTimer=null,requestTimedOut=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),2400)}
function apiConfig(){try{if(window.parent&&window.parent!==window&&typeof window.parent.__LOVE_RECORD_GET_API_CONFIG==='function'){const x=window.parent.__LOVE_RECORD_GET_API_CONFIG()||{};return{apiBase:String(x.apiBase||'').trim(),apiKey:String(x.apiKey||'').trim(),apiModel:String(x.apiModel||'').trim()}}}catch(e){console.warn('[寻梦] homepage API bridge unavailable',e)}for(const key of ['love-record-api-active-v1','love-record-api-settings-v1']){try{const x=JSON.parse(localStorage.getItem(key)||'{}');if(x.apiBase&&x.apiKey&&x.apiModel)return{apiBase:String(x.apiBase).trim(),apiKey:String(x.apiKey).trim(),apiModel:String(x.apiModel).trim()}}catch(e){}}return{apiBase:'',apiKey:'',apiModel:''}}
function apiEndpoint(base){const value=String(base||'').trim().replace(/\/+$/,'');return /\/chat\/completions$/i.test(value)?value:value+'/chat/completions'}
function updateApiStatus(){const cfg=apiConfig(),note=$('apiNote'),text=$('apiStatusText');if(cfg.apiBase&&cfg.apiKey&&cfg.apiModel){note.classList.remove('error');note.classList.add('ready');text.textContent='已读取主页 API 配置 · '+cfg.apiModel}else{note.classList.remove('ready');note.classList.add('error');text.textContent='尚未读取到完整的主页 API 配置，请先在主页设置并保存。'}}
function switchMode(mode){if(!modes[mode])return;currentMode=mode;document.querySelectorAll('.df-tab').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));['dream','fortune','match'].forEach(k=>$(k+'Panel').hidden=k!==mode);$('resultPanel').hidden=true;lastReading=null}
function showMain(){ $('mainView').hidden=false;$('historyView').hidden=true;$('historyBtn').hidden=false}
function showHistory(){$('mainView').hidden=true;$('historyView').hidden=false;$('historyBtn').hidden=true;renderHistory()}
function closeApp(){try{if(window.parent&&window.parent!==window){window.parent.postMessage({type:'LR_CLOSE_EXTERNAL_APP'},location.origin);return}}catch(e){}history.back()}
function renderMarkdown(raw){let text=esc(raw).replace(/\r\n?/g,'\n');text=text.replace(/^###\s+(.+)$/gm,'<h4>$1</h4>').replace(/^##\s+(.+)$/gm,'<h3>$1</h3>').replace(/^#\s+(.+)$/gm,'<h3>$1</h3>').replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');const lines=text.split('\n'),out=[];let para=[],list='';const flush=()=>{if(para.length){out.push('<p>'+para.join('<br>')+'</p>');para=[]}};const close=()=>{if(list){out.push(list==='ul'?'</ul>':'</ol>');list=''}};for(const rawLine of lines){const line=rawLine.trim();if(!line){flush();close();continue}const ul=line.match(/^[-•*]\s+(.+)$/),ol=line.match(/^\d+[.)、]\s*(.+)$/);if(ul||ol){flush();const next=ul?'ul':'ol';if(list!==next){close();out.push('<'+next+'>');list=next}out.push('<li>'+((ul||ol)[1])+'</li>');continue}para.push(line)}flush();close();return out.join('')}
function readPayload(){
 if(currentMode==='dream'){
  const dream=$('dreamText').value.trim();if(dream.length<5){toast('先多写一点梦境内容吧');$('dreamText').focus();return null}
  const data={dream,mood:$('dreamMood').value,repeat:$('dreamRepeat').value,extra:$('dreamExtra').value.trim()};
  return{title:'梦境解析',summary:dream.slice(0,70),data,prompt:`请直接分析下面这段用户真实描述的梦境。必须以梦境原文为依据，不要套用通用安慰话，也不要把用户没有提到的人物、地点或事件编进来。\n\n【梦境原文】\n${data.dream}\n\n【梦中主要感觉】${data.mood}\n【重复情况】${data.repeat}\n【近期相关背景】${data.extra||'用户未补充'}\n\n请使用中文，按以下五个标题依次分析，每一部分都要有具体内容：\n## 一、梦境情节与核心主题\n准确概括梦里实际发生了什么，并指出最突出的主题。\n## 二、关键意象与可能联想\n从梦境原文中挑选2至4个真实出现的物件、人物、地点或动作，分别解释可能的个人联想；如果梦境细节不足，要坦白说明，不要硬凑。\n## 三、情绪线索\n结合用户选择的梦中感觉，分析梦境情绪如何变化、可能在表达什么。\n## 四、与现实生活的可能连接\n结合用户提供的近期背景作谨慎联想；没有背景资料时，只提供开放式思考问题，不要擅自猜测用户的感情或生活遭遇。\n## 五、可以带走的提醒\n给出温和、具体且不武断的自我观察建议。\n\n请充分展开，整体约500至800个汉字；每个部分至少写2至3个有信息量的句子。开头直接进入梦境分析，禁止问候、自我介绍、品牌介绍、泛泛祝福或只输出免责声明。明确说明梦境象征没有统一标准，这只是文化与情绪意象层面的探索，不是预言或心理诊断。`}
 }
 if(currentMode==='fortune'){
  const birth=$('fortuneBirth').value;if(!birth){toast('请先填写出生日期');$('fortuneBirth').focus();return null}
  const data={name:$('fortuneName').value.trim()||'用户',birthDate:birth,birthTime:$('fortuneTime').value||'未知',birthPlace:$('fortunePlace').value.trim()||'未提供',focus:$('fortuneFocus').value,extra:$('fortuneExtra').value.trim()};
  return{title:'命理解读 · '+data.focus,summary:`${data.name} · ${data.birthDate}`,data,prompt:`请以尊重传统文化、同时清楚说明局限的方式，为用户提供${data.focus}方向的命理民俗解读。请用中文，结构为「基础信息与资料完整度」「传统文化角度的性格/五行/生肖线索（仅在资料足以支持时提供）」「当前阶段的主题与机会」「需要留意的地方」「现实可执行的小建议」。出生日期：${data.birthDate}；出生时间：${data.birthTime}；出生地点：${data.birthPlace}；关注方向：${data.focus}；补充背景：${data.extra||'无'}。如缺少时辰、历法换算或地点时区等信息，不要假装已经精确排出完整八字，也不要编造日柱、时柱或五行比例；请说明不能精确判断的部分。不要使用确定性预言，不要建议用户据此作重大财务、医疗或人生决定。把内容定位为传统民俗文化与自我反思参考。请以${data.name}作为称呼。`}
 }
 const dateA=$('matchBirthA').value,dateB=$('matchBirthB').value;if(!dateA||!dateB){toast('请填写两个人的出生日期');$('matchBirthA').focus();return null}
 const data={nameA:$('matchNameA').value.trim()||'第一个人',birthA:dateA,noteA:$('matchNoteA').value.trim()||'未补充',nameB:$('matchNameB').value.trim()||'第二个人',birthB:dateB,noteB:$('matchNoteB').value.trim()||'未补充',relation:$('matchRelation').value,focus:$('matchStyle').value};
 return{title:'关系配对 · '+data.relation,summary:`${data.nameA} × ${data.nameB}`,data,prompt:`请为以下两个人做一份温和、平衡、具体的关系配对分析。用中文回答，结构为「两个人各自的相处特质」「容易产生共鸣的地方」「可能出现的差异与摩擦」「沟通和相处建议」「这段关系可以如何经营」。关系类型：${data.relation}；分析重点：${data.focus}。A：${data.nameA}，生日${data.birthA}，特点：${data.noteA}。B：${data.nameB}，生日${data.birthB}，特点：${data.noteB}。可以将生日/星座作为轻度趣味参考，但不要将其当成科学人格判断。不要给出绝对匹配结论，不要用虚假的精确分数定义关系。重点是帮助理解差异和提供可执行的相处建议。`}
}
function systemPrompt(mode){
 if(mode==='dream')return'你是「寻梦」中的梦境叙事与情绪意象分析助手。你的首要任务是认真分析用户提供的梦境原文，而不是闲聊或安慰。回答必须引用或准确指出梦里实际出现的具体场景、人物、物件和动作；不得虚构梦境细节，不得假设用户梦见了恋人或某个特定的人。必须按用户要求的五个部分展开，输出有实质内容的中文分析，目标长度约500至800个汉字。禁止问候、禁止自我介绍、禁止介绍应用品牌、禁止只给祝福或免责声明。对象征意义使用「可能」「也许」「可以联想到」等审慎措辞，不把解释说成唯一答案、预言或心理诊断。';
 return'你是 LOVE RECORD 的文化探索助手。用自然、温柔、清楚的中文回答，避免故弄玄虚。命理内容必须说明传统民俗属性和信息不足的限制；配对结果不得声称能确定关系成败。不得编造精确历法、八字柱、星盘位置或数据。若信息不足，请明确说明。请使用简洁 Markdown 标题、列表和短段落，不输出 JSON。不要鼓励用户据此做医疗、投资、法律或重大人生决定。'
}
async function requestCompletion(cfg,messages,extra={}){
 const body={model:cfg.apiModel,messages,stream:false,...extra};
 const response=await fetch(apiEndpoint(cfg.apiBase),{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey,'Accept':'application/json'},body:JSON.stringify(body),signal:controller.signal});
 const raw=await response.text();
 if(!response.ok)throw new Error('HTTP '+response.status+'：'+raw.slice(0,260));
 let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('API 返回内容不是有效 JSON')}
 let answer=parsed?.choices?.[0]?.message?.content;
 if(Array.isArray(answer))answer=answer.map(x=>x?.text||'').join('\n');
 if(typeof answer!=='string'||!answer.trim())throw new Error('模型没有返回有效解读内容');
 return answer.trim();
}
function needsDreamRetry(answer){return answer.length<280||/我是.{0,30}(DREAM\s*&\s*FATE|寻梦)|欢迎来到|你好[，,！!].{0,30}(助手|时光|这里)/i.test(answer)}
async function runReading(mode){
 if(controller)return;
 currentMode=mode;
 const payload=readPayload();if(!payload)return;
 const cfg=apiConfig();if(!cfg.apiBase||!cfg.apiKey||!cfg.apiModel){updateApiStatus();toast('请先在主页设置并保存 API 地址、密钥和模型');return}
 $('resultPanel').hidden=true;$('loading').hidden=false;$('loadingTitle').textContent=mode==='dream'?'正在逐段分析梦境细节…':mode==='fortune'?'正在整理生日与命理线索…':'正在分析两个人的相处特点…';document.querySelectorAll('[data-submit]').forEach(b=>b.disabled=true);controller=new AbortController();requestTimedOut=false;const cancel=$('cancelRequest');cancel.disabled=false;requestTimer=setTimeout(()=>{requestTimedOut=true;if(controller)controller.abort()},90000);
 try{
  const messages=[{role:'system',content:systemPrompt(mode)},{role:'user',content:payload.prompt}];
  let answer;
  if(mode==='dream'){
   try{answer=await requestCompletion(cfg,messages,{max_tokens:2600,reasoning_effort:'low'})}
   catch(error){if(error.message&&/unknown parameter|unsupported parameter|reasoning_effort|max_tokens/i.test(error.message))answer=await requestCompletion(cfg,messages);else throw error}
   if(needsDreamRetry(answer)){
    $('loadingTitle').textContent='正在补充核对梦境细节…';
    const retryMessages=[...messages,{role:'assistant',content:answer},{role:'user',content:'刚才的回答没有充分分析梦境原文。请重新完成，不要寒暄，不要自我介绍，不要输出品牌欢迎语。请逐项引用梦境原文中真实出现的细节，并严格按五个指定标题展开；每部分给出具体分析，合计至少500个汉字。若原文信息有限，请围绕有限细节深入说明，不要编造。'}];
    answer=await requestCompletion(cfg,retryMessages,{max_tokens:3200,reasoning_effort:'low'}).catch(async error=>{if(error.message&&/unknown parameter|unsupported parameter|reasoning_effort|max_tokens/i.test(error.message))return await requestCompletion(cfg,retryMessages);throw error});
   }
   if(needsDreamRetry(answer))throw new Error('模型返回的内容仍未具体分析你的梦境。请稍后重试，或检查主页当前 API 模型是否正常。');
  }else answer=await requestCompletion(cfg,messages);
  lastReading={id:'df-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),mode,title:payload.title,summary:payload.summary,data:payload.data,result:answer,createdAt:new Date().toISOString()};
  $('resultTitle').textContent=payload.title;$('resultDate').textContent=new Date(lastReading.createdAt).toLocaleString('zh-CN');$('resultContent').innerHTML=renderMarkdown(answer);$('resultPanel').hidden=false;$('resultPanel').scrollIntoView({behavior:'smooth',block:'start'});toast('解读已生成，可以保存到记录');
 }catch(error){if(error.name==='AbortError')toast(requestTimedOut?'请求超时，请检查 API 服务后重试':'已取消本次分析');else{console.error('[寻梦]',error);toast('分析失败：'+(error.message||'请检查 API 配置'));}}
 finally{if(requestTimer)clearTimeout(requestTimer);requestTimer=null;controller=null;$('loading').hidden=true;document.querySelectorAll('[data-submit]').forEach(b=>b.disabled=false)}
}

function loadHistory(){try{const rows=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}}
function saveHistory(){if(!lastReading)return;try{const all=loadHistory();if(all.some(x=>x.id===lastReading.id)){toast('这条解读已经保存过了');return}all.unshift(lastReading);localStorage.setItem(HISTORY_KEY,JSON.stringify(all.slice(0,60)));toast('已保存到我的记录')}catch(e){toast('保存失败：本地存储空间可能不足')}}
function renderHistory(){const rows=loadHistory(),list=$('historyList');if(!rows.length){list.innerHTML='<div class="df-history-empty">这里还没有保存的解读。<br>完成一次分析后，可以将结果保存到这里。</div>';return}list.innerHTML=rows.map(x=>`<article class="df-history-item"><span class="df-history-icon">${modes[x.mode]?.icon||'✧'}</span><div class="df-history-copy"><b>${esc(x.title||'解读记录')}</b><small>${esc(x.summary||'')} · ${esc(new Date(x.createdAt).toLocaleString('zh-CN'))}</small></div><button type="button" data-open-history="${esc(x.id)}" aria-label="查看记录">›</button></article>`).join('');list.querySelectorAll('[data-open-history]').forEach(b=>b.addEventListener('click',()=>showHistoryDetail(b.dataset.openHistory)))}
function showHistoryDetail(id){const item=loadHistory().find(x=>x.id===id);if(!item)return;const list=$('historyList');list.innerHTML=`<article class="df-history-detail"><h3>${esc(item.title)}</h3><p style="color:#a79c8b;font-size:10px">${esc(new Date(item.createdAt).toLocaleString('zh-CN'))}</p><div>${renderMarkdown(item.result||'')}</div><div class="df-history-actions"><button type="button" id="historyDetailBack">返回记录</button><button type="button" id="historyDeleteOne">删除这条记录</button></div></article>`;$('historyDetailBack').addEventListener('click',renderHistory);$('historyDeleteOne').addEventListener('click',()=>{if(!confirm('确定删除这条解读记录吗？'))return;localStorage.setItem(HISTORY_KEY,JSON.stringify(loadHistory().filter(x=>x.id!==id)));renderHistory();toast('记录已删除')})}
$('backBtn').addEventListener('click',closeApp);$('historyBtn').addEventListener('click',showHistory);$('historyBack').addEventListener('click',()=>{showMain();$('resultPanel').hidden=true});$('apiRefresh').addEventListener('click',updateApiStatus);document.querySelectorAll('.df-tab').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));document.querySelectorAll('[data-submit]').forEach(b=>b.addEventListener('click',()=>runReading(b.dataset.submit)));$('saveResult').addEventListener('click',saveHistory);$('againBtn').addEventListener('click',()=>{$('resultPanel').hidden=true;document.querySelector('.df-form-panel:not([hidden])')?.scrollIntoView({behavior:'smooth',block:'start'})});$('cancelRequest').addEventListener('click',()=>{if(controller)controller.abort()});$('dreamText').addEventListener('input',()=>{$('dreamCount').textContent=String($('dreamText').value.length)});const today=new Date(),todayValue=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');document.querySelectorAll('input[type=date]').forEach(input=>input.max=todayValue);window.addEventListener('focus',updateApiStatus);window.addEventListener('pageshow',updateApiStatus);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateApiStatus()});updateApiStatus();
})();
