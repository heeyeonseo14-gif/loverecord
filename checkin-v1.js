(()=>{'use strict';
const $=id=>document.getElementById(id);
const KEY='love-record-checkin-v1';
const defaults={
 profile:{name:'',avatar:'',deviceName:'His phone'},
 activities:[
  {time:'20:18',icon:'♫',title:'打开了音乐播放器',detail:'最近播放了一首收藏歌曲'},
  {time:'18:42',icon:'▤',title:'查看聊天消息',detail:'有一条新消息尚未阅读'},
  {time:'15:26',icon:'▧',title:'保存了一张照片',detail:'添加到最近相册'}
 ],
 messages:[{name:'联系人',text:'晚点有空吗？',time:'18:42'},{name:'群聊',text:'周末要不要一起吃饭？',time:'16:10'},{name:'联系人',text:'收到啦，谢谢！',time:'昨天'}],
 moments:[{title:'今天的天空很好看。',time:'今天 17:20',detail:'一条日常动态 · 示例内容'}],
 contacts:[{name:'联系人 A',note:'朋友',time:'最近联系'},{name:'联系人 B',note:'同事',time:'最近联系'}],
 songs:[{name:'A quiet little moment',artist:'Recently played'},{name:'Somewhere, only we know',artist:'Saved playlist'},{name:'Soft afternoon',artist:'Recently played'}],
 notes:[{title:'随手记',body:'把今天想做的事情记下来。',time:'今天'},{title:'周末计划',body:'找个舒服的地方，慢慢度过下午。',time:'昨天'}],
 calendar:[{time:'10:00',title:'日常安排',detail:'个人时间'},{time:'15:30',title:'待办事项',detail:'留一点时间休息'}],
 notifications:[{name:'聊天软件',text:'收到一条新消息',time:'18:42'},{name:'日历',text:'今天还有一项安排',time:'10:00'}],
 photos:['A slow afternoon','Little details','On the way home','A saved moment']
};
let data;
try{data=JSON.parse(localStorage.getItem(KEY)||'null')||structuredClone(defaults)}catch(e){data=JSON.parse(JSON.stringify(defaults))}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){toast('保存空间不足，暂时无法保存')}}
function getRole(){
 let name='';try{
  const settings=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}');
  name=settings.partner||settings.name||'';
  const people=Array.isArray(settings.people)?settings.people:[];
  const active=settings.activePersonId||settings.currentPersonId||settings.selectedPersonId;
  const person=people.find(p=>String(p.id)===String(active))||people.find(p=>p.isActive||p.active);
  if(person)name=person.name||person.nickname||name;
 }catch(e){}
 return String(name||'').trim();
}
const role=getRole();
if(role){data.profile.name=role;data.profile.deviceName=role+' 的手机'}
const name=data.profile.name||'TA';
$('personName').textContent=name+'的手机';$('sideName').textContent=name+'的手机';$('deviceName').textContent=data.profile.deviceName||name+'的手机';
$('personAvatar').textContent=(name.replace(/\s/g,'')[0]||'H').toUpperCase();
const now=new Date();$('statusTime').textContent=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
$('todayDate').textContent=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'2-digit'}).toUpperCase();
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function row(icon,title,detail,time){return `<div class="list-item"><div class="list-avatar">${icon}</div><div class="list-main"><b>${esc(title)}</b><p>${esc(detail||'')}</p></div><time>${esc(time||'')}</time></div>`}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function activityMarkup(items){return items.map(a=>`<div class="activity-row"><div class="activity-dot">${esc(a.icon||'◦')}</div><div class="activity-copy"><b>${esc(a.title)}</b><p>${esc(a.detail||'')}</p><time>${esc(a.time||'')}</time></div></div>`).join('')||'<div class="empty">还没有活动记录。</div>'}
$('activityPreview').innerHTML=activityMarkup(data.activities.slice(0,3));$('activityAll').innerHTML=activityMarkup(data.activities);
$('statActivities').textContent=String(data.activities.length).padStart(2,'0');$('statUnread').textContent=String(data.messages.length).padStart(2,'0');$('statPhotos').textContent=String(data.photos.length).padStart(2,'0');
$('messageList').innerHTML=data.messages.map(x=>row('▤',x.name,x.text,x.time)).join('')||'<div class="empty">暂时没有聊天记录。</div>';
$('contactList').innerHTML=data.contacts.map(x=>row('♙',x.name,x.note,x.time)).join('')||'<div class="empty">暂无联系人。</div>';
$('musicList').innerHTML=data.songs.map(x=>row('♫',x.name,x.artist,'')).join('');
$('notificationList').innerHTML=data.notifications.map(x=>row('♧',x.name,x.text,x.time)).join('');
$('momentList').innerHTML=data.moments.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.detail||'')}</p></article>`).join('')||'<div class="empty">还没有动态。</div>';
$('noteList').innerHTML=data.notes.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.body)}</p></article>`).join('');
$('calendarList').innerHTML=data.calendar.map(x=>`<article class="glass note"><div class="eyebrow">${esc(x.time)}</div><b>${esc(x.title)}</b><p>${esc(x.detail)}</p></article>`).join('');
$('songTitle').textContent=data.songs[0]?.name||'No music yet';$('songArtist').textContent=data.songs[0]?.artist||'';
$('photoGrid').innerHTML=data.photos.map((p,i)=>`<div class="photo" style="background:linear-gradient(145deg,${['#e6dac8,#bca88e','#d6d0c1,#9c927e','#eadfcf,#c4a98b','#d9c8b2,#a48e72'][i%4]})">${esc(p)}</div>`).join('');
function show(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const el=$(view+'View');if(el)el.classList.add('active');}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',()=>show('home')));
$('phoneSettings').addEventListener('click',()=>show('settings'));
$('backHome').addEventListener('click',()=>location.href='./index.html');
$('playMusic').addEventListener('click',()=>toast('这里只展示播放记录，尚未接入音频播放。'));
function apiConfig(){
 try{const x=JSON.parse(localStorage.getItem('love-record-api-active-v1')||'{}');if(x.apiBase&&x.apiKey&&x.apiModel)return x}catch(e){}
 try{const x=JSON.parse(localStorage.getItem('love-record-api-settings-v1')||'{}');if(x.apiBase&&x.apiKey&&x.apiModel)return x}catch(e){}
 return null;
}
const cfg=apiConfig();$('apiStatus').textContent=cfg?'已读取主页 API 配置：'+cfg.apiModel:'主页尚未配置完整 API。';
window.__LOVE_RECORD_CHECKIN={getData:()=>data,getApiConfig:apiConfig,save};
save();
})();