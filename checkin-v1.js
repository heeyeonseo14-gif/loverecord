(()=>{'use strict';
const $=id=>document.getElementById(id);
const SETTINGS_KEY='yanyan-love-settings-v5', API_KEY='love-record-api-active-v1', LEGACY_API_KEY='love-record-api-settings-v1';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emptyData=()=>({activities:[],messages:[],contacts:[],songs:[],notes:[],calendar:[],photos:[],browserHistory:[],xhsNotes:[]});
let selected=null,data=emptyData();
function readJSON(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v??fallback}catch{return fallback}}
function getPeople(){const state=readJSON(SETTINGS_KEY,{});return (Array.isArray(state.people)?state.people:[]).filter(p=>p&&p.id&&String(p.id)!=='p-yanyan'&&String(p.name||'').trim())}
function getApi(){let c=readJSON(API_KEY,null);if(c&&c.apiBase&&c.apiKey&&c.apiModel)return c;c=readJSON(LEGACY_API_KEY,null);if(c&&c.apiBase&&c.apiKey&&c.apiModel)return c;const s=readJSON(SETTINGS_KEY,{});return s.apiBase&&s.apiKey&&s.apiModel?{apiBase:s.apiBase,apiKey:s.apiKey,apiModel:s.apiModel}:null}
function storeKey(id){return 'love-record-checkin-v1:'+encodeURIComponent(String(id))}
function loadPhone(p){selected=p;data=readJSON(storeKey(p.id),emptyData());$('personName').textContent=(p.name||'联系人')+' 的手机';$('sideName').textContent=(p.name||'联系人')+' 的手机';$('deviceName').textContent=p.name+' 的手机';$('personAvatar').textContent=(p.name||'?').trim().charAt(0);$('apiState').textContent=getApi()?'API 已连接':'请先配置主页 API';renderData();show('home')}
function save(){if(selected)try{localStorage.setItem(storeKey(selected.id),JSON.stringify(data))}catch(e){toast('手机数据保存失败：浏览器储存空间不足')}}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)}
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const el=$(view+'View');if(el)el.classList.add('active');}
function renderContacts(){const people=getPeople(),box=$('contactPicker');if(!people.length){box.innerHTML='<div class="empty">还没有可查岗的 AI 联系人。请先到 LOVE RECORD 的联系人页面添加 AI 人物。</div>';return}box.innerHTML=people.map(p=>`<button class="list-item" data-contact-id="${esc(p.id)}" style="width:100%;background:none;text-align:left"><span class="list-avatar">${esc((p.name||'?').trim().charAt(0))}</span><span class="list-main"><b>${esc(p.name)}</b><p>${esc(p.role||'AI 联系人')} · 独立手机空间</p></span><span style="color:#ad9a85">›</span></button>`).join('');box.querySelectorAll('[data-contact-id]').forEach(b=>b.addEventListener('click',()=>{const p=people.find(x=>String(x.id)===b.dataset.contactId);if(p)loadPhone(p)}))}
function row(icon,title,detail,time){return `<div class="list-item"><div class="list-avatar">${esc(icon)}</div><div class="list-main"><b>${esc(title)}</b><p>${esc(detail||'')}</p></div><time>${esc(time||'')}</time></div>`}
function activityMarkup(items){return items.length?items.map(a=>`<div class="activity-row"><div class="activity-dot">${esc(a.icon||'◦')}</div><div class="activity-copy"><b>${esc(a.title)}</b><p>${esc(a.detail||'')}</p><time>${esc(a.time||'')}</time></div></div>`).join(''):'<div class="empty">暂无活动记录。可以在主页 API 配置完成后生成活动。</div>'}
function renderData(){
 $('activityPreview').innerHTML=activityMarkup(data.activities.slice(0,3));$('activityAll').innerHTML=activityMarkup(data.activities);
 $('statActivities').textContent=String(data.activities.length).padStart(2,'0');$('statUnread').textContent=String(data.messages.length).padStart(2,'0');$('statPhotos').textContent=String(data.photos.length).padStart(2,'0');
 $('messageList').innerHTML=data.messages.map(x=>row('▤',x.name||'聊天',x.text,x.time)).join('')||'<div class="empty">暂无聊天记录。</div>';
 $('contactList').innerHTML=data.contacts.map(x=>row('♙',x.name,x.note,x.time)).join('')||'<div class="empty">暂无手机联系人。</div>';
 $('musicList').innerHTML=data.songs.map(x=>row('♫',x.name,x.artist,'')).join('')||'<div class="empty">暂无播放记录。</div>';
 $('noteList').innerHTML=data.notes.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.body)}</p></article>`).join('')||'<div class="empty">暂无备忘录。</div>';
 $('calendarList').innerHTML=data.calendar.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></article>`).join('')||'<div class="empty">暂无日程。</div>';
 $('songTitle').textContent=data.songs[0]?.name||'暂无播放记录';$('songArtist').textContent=data.songs[0]?.artist||'';
 $('photoGrid').innerHTML=data.photos.length?data.photos.map((p,i)=>`<div class="photo">${esc(typeof p==='string'?p:(p.title||'照片'))}</div>`).join(''):'<div class="empty" style="grid-column:1/-1">暂无照片。</div>';
}
async function generateActivity(){
 if(!selected){toast('请先选择联系人');return}
 const cfg=getApi();if(!cfg){toast('请先在 LOVE RECORD 主页配置 API 地址、密钥和模型');return}
 const btn=$('generateActivity');btn.disabled=true;btn.textContent='正在生成…';
 const prompt=`请为一个虚构 AI 联系人的手机生成 2 到 4 条自然、日常、彼此一致的手机活动记录。当前角色资料：姓名 ${selected.name||''}；身份/职业 ${selected.role||''}；性格与人物设定 ${selected.persona||selected.personality||''}；背景 ${selected.background||''}；人物指令 ${selected.instructions||''}。最近已有活动：${JSON.stringify(data.activities.slice(0,8))}。请不要重复已有事件，不要擅自编造与用户已知剧情冲突的事实。返回严格 JSON 数组，每项字段为 time（HH:mm）、icon（单个简短符号）、title（活动标题）、detail（简短说明）。只返回 JSON，不要 Markdown。`;
 try{
  const base=String(cfg.apiBase).replace(/\/+$/,'');
  const response=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.apiKey,'Accept':'application/json'},body:JSON.stringify({model:cfg.apiModel,messages:[{role:'system',content:'你是 LOVE RECORD 查岗模块的手机活动生成器。尊重角色设定，输出有效 JSON。'}, {role:'user',content:prompt}],temperature:.85,max_tokens:700,stream:false})});
  const raw=await response.text();if(!response.ok)throw new Error('HTTP '+response.status+' '+raw.slice(0,180));
  const json=JSON.parse(raw);let content=json.choices?.[0]?.message?.content??json.choices?.[0]?.text??'';if(Array.isArray(content))content=content.map(x=>x.text||'').join('');
  const clean=String(content).replace(/```(?:json)?/gi,'').replace(/```/g,'').trim();const start=clean.indexOf('['),end=clean.lastIndexOf(']');if(start<0||end<start)throw new Error('模型没有返回有效 JSON 数组');
  const items=JSON.parse(clean.slice(start,end+1));if(!Array.isArray(items)||!items.length)throw new Error('没有生成活动');
  const normalized=items.slice(0,4).filter(x=>x&&x.title).map(x=>({time:String(x.time||new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})),icon:String(x.icon||'◦').slice(0,2),title:String(x.title),detail:String(x.detail||'')}));
  data.activities=[...normalized,...data.activities].slice(0,80);save();renderData();toast('已为 '+selected.name+' 生成手机活动');
 }catch(e){toast('生成失败：'+(e.message||'请检查主页 API 配置'))}
 finally{btn.disabled=false;btn.textContent='✦ 生成手机活动'}
}
function renderBrowser(){const list=$('browserHistory');if(!list)return;list.innerHTML=data.browserHistory.length?data.browserHistory.map(x=>row('⌕',x.title,x.url,x.time)).join(''):'<div class="empty">暂无浏览记录。</div>'}
function renderXhs(){const box=$('xhsFeed');if(!box)return;box.innerHTML=data.xhsNotes.length?data.xhsNotes.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time||'')}</div><b>${esc(x.title||'笔记')}</b><p>${esc(x.body||'')}</p></article>`).join(''):'<div class="empty">暂无笔记内容。</div>'}
function addBrowserSearch(){const input=$('browserSearch'),q=(input?.value||'').trim();if(!q){toast('请输入搜索内容或网址');return}const url=(q.startsWith('http://')||q.startsWith('https://'))?q:'https://www.google.com/search?q='+encodeURIComponent(q);data.browserHistory.unshift({title:q,url,time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})});data.browserHistory=data.browserHistory.slice(0,40);save();renderBrowser();window.open(url,'_blank','noopener');}
$('browserGo')?.addEventListener('click',addBrowserSearch);$('browserSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')addBrowserSearch()});
renderBrowser();renderXhs();
const now=new Date();$('statusTime').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('todayDate').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'2-digit'}).toUpperCase();
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',()=>show('home')));
document.querySelectorAll('[data-contacts]').forEach(b=>b.addEventListener('click',()=>{renderContacts();show('contacts')}));
$('backHome').addEventListener('click',()=>{try{sessionStorage.setItem('lr-skip-intro-once','1')}catch(e){}location.replace('./index.html')});
$('generateActivity').addEventListener('click',generateActivity);
$('playMusic').addEventListener('click',()=>toast('此版本展示播放记录，尚未接入音频播放。'));
$('apiStatus').textContent=getApi()?'已读取主页 API 配置':'主页尚未配置完整 API';
renderContacts();show('contacts');
window.__LOVE_RECORD_CHECKIN={getSelected:()=>selected,getData:()=>data,refreshContacts:renderContacts};
})();