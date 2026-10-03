/* LOVE RECORD MUSIC V6 · immersive player, synced LRC lyrics, listen together */
(()=>{'use strict';
const DB='love-record-music-v1',STORE='tracks',META='meta';
const SOURCES=['netease','tencent','kugou','kuwo'];
const MUSIC_API='https://music-api.gdstudio.xyz/api.php';
let db,audio,tracks=[],current=null,queue=[],history=[],objectUrl=null,onlineResults=[],coverData='',lyricsLines=[],activeLyricIndex=-1,togetherIds=[];
const $=id=>document.getElementById(id);
function req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});if(!d.objectStoreNames.contains(META))d.createObjectStore(META,{keyPath:'key'})};r.onsuccess=()=>{db=r.result;res()};r.onerror=()=>rej(r.error)})}
async function all(){tracks=await req(db.transaction(STORE).objectStore(STORE).getAll());tracks.sort((a,b)=>b.added-a.added);renderLocal()}
async function put(t){await req(db.transaction(STORE,'readwrite').objectStore(STORE).put(t))}
async function del(id){await req(db.transaction(STORE,'readwrite').objectStore(STORE).delete(id));if(current?.id===id){audio.pause();audio.removeAttribute('src');current=null;updateLabels(null);saveState()}await all()}
async function saveState(){try{await req(db.transaction(META,'readwrite').objectStore(META).put({key:'player',current:current?serialTrack(current):null,queue:queue.map(serialTrack)}))}catch{}}
function serialTrack(t){return {id:t.id,remoteId:t.remoteId||'',title:t.title||'',artist:t.artist||'',source:t.source||'',kind:t.kind||'local',album:t.album||'',url:t.url||''}}
async function loadState(){const s=await req(db.transaction(META).objectStore(META).get('player'));if(s){queue=Array.isArray(s.queue)?s.queue:[];return s.current||null}return null}
function fmt(n){if(!Number.isFinite(n))return '0:00';return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')}
function toast(s){const el=$('musicToast');if(!el)return;el.textContent=s;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600)}
async function saveVinylCover(data){try{await req(db.transaction(META,'readwrite').objectStore(META).put({key:'playerCover',data}))}catch(e){toast('封面保存失败，请换一张较小的图片')}}
async function loadVinylCover(){try{const x=await req(db.transaction(META).objectStore(META).get('playerCover'));if(x?.data){coverData=x.data;applyPlayerCover(coverData)}}catch{}}
function applyPlayerCover(data){
 const art=$('musicMainArt'),img=$('musicMainCover');
 if(!art||!img)return;
 if(data){img.src=data;art.classList.add('has-cover')}
 else{img.removeAttribute('src');art.classList.remove('has-cover')}
}
function chooseVinylCover(file){if(!file||!file.type.startsWith('image/'))return;const reader=new FileReader();reader.onload=async()=>{coverData=reader.result;applyPlayerCover(coverData);await saveVinylCover(coverData);toast('歌曲封面已更新 ♡')};reader.onerror=()=>toast('图片读取失败，请重试');reader.readAsDataURL(file)}
function showPlayerView(){const page=$('music');if(page)page.classList.add('is-player-view');$('musicPlaybackView').hidden=false;renderLyrics()}
function showLibraryView(){const page=$('music');if(page)page.classList.remove('is-player-view');$('musicPlaybackView').hidden=true}
function updateLabels(t){
 $('musicNowTitle').textContent=t?.title||'还没有播放歌曲';
 $('musicNowArtist').textContent=t?(t.artist||t.source||'音乐'):'从你的音乐库选择一首歌';
 applyPlayerCover(coverData);
}
function setButtons(){
 const playing=!audio.paused;
 $('musicPlay').textContent=playing?'Ⅱ':'▶';
 $('musicPlay').setAttribute('aria-label',playing?'暂停':'播放');
 $('musicMainArt').classList.toggle('is-playing',playing);
}
function renderLocal(){
 const q=($('musicSearch')?.value||'').trim().toLowerCase(),list=$('musicTrackList');if(!list)return;
 const arr=tracks.filter(t=>(t.title+' '+(t.artist||'')+' '+(t.album||'')).toLowerCase().includes(q));
 $('musicLibraryCount').textContent=tracks.length+' TRACKS';list.innerHTML='';
 if(!arr.length){list.innerHTML='<div class="music-empty">'+(tracks.length?'没有找到相关歌曲。':'这里还没有歌曲。点击「添加音乐」上传你的第一首歌吧。')+'</div>';return}
 arr.forEach(t=>{
  const row=document.createElement('div');row.className='music-track';row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label','播放 '+t.title);
  const play=document.createElement('button');play.className='music-track-play';play.type='button';play.textContent=current?.id===t.id&&!audio.paused?'Ⅱ':'▶';
  const open=()=>current?.id===t.id&&!audio.paused?showPlayerView():playTrack(t.kind==='online'?t:{...t,kind:'local'});
  play.onclick=e=>{e.stopPropagation();open()};
  const meta=document.createElement('div');meta.className='music-track-meta';const name=document.createElement('strong');name.textContent=t.title;const artist=document.createElement('span');artist.textContent=t.kind==='online'?[t.artist,t.source||'在线音乐'].filter(Boolean).join(' · '):(t.artist||'本地音乐');meta.append(name,artist);
  const remove=document.createElement('button');remove.className='music-track-delete';remove.type='button';remove.textContent='⋯';remove.title='从我的歌单移除';remove.onclick=e=>{e.stopPropagation();if(confirm('从我的歌单移除「'+t.title+'」？'))del(t.id)};
  row.onclick=open;row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  row.append(play,meta,remove);list.append(row);
 });
}
function normalizeList(data,source){let a=Array.isArray(data)?data:(data?.data?.list||data?.data?.songs||data?.data?.result||data?.list||data?.songs||data?.result||data?.data||[]);if(!Array.isArray(a)&&a&&typeof a==='object')a=Object.values(a);return (Array.isArray(a)?a:[]).map((x,i)=>({id:String(x.id??x.song_id??x.songmid??x.mid??x.hash??x.rid??i),title:String(x.name??x.title??x.songname??x.songName??x.SongName??'未知歌曲'),artist:String(x.artist??x.singer??x.author??x.artists?.map?.(v=>v.name).join(' / ')??x.SingerName??''),album:String(x.album??x.album_name??x.AlbumName??''),source:x.source||source,url:x.url||x.music_url||x.play_url||'',cover:x.pic||x.cover||x.pic_url||'',kind:'online'})).filter(x=>x.title!=='未知歌曲')}
async function apiJson(url){const r=await fetch(url,{method:'GET',mode:'cors',headers:{'Accept':'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);const text=await r.text();try{return JSON.parse(text)}catch{if(/^https?:\/\//i.test(text.trim()))return text.trim();throw new Error('音乐服务返回了无法识别的数据')}}
async function searchOnline(){const input=$('musicOnlineSearch'),keyword=input.value.trim();if(!keyword){toast('先输入歌名或歌手');return}const box=$('musicOnlineResults'),list=$('musicOnlineList'),btn=$('musicOnlineGo');box.hidden=false;list.innerHTML='<div class="music-empty">正在搜索音乐资源……</div>';$('musicOnlineCount').textContent='SEARCHING';btn.disabled=true;const selected=$('musicOnlineSource').value;const sources=selected==='all'?SOURCES:[selected];try{const batches=await Promise.all(sources.map(async source=>{const u=new URL(MUSIC_API);u.searchParams.set('types','search');u.searchParams.set('source',source);u.searchParams.set('name',keyword);u.searchParams.set('count','20');u.searchParams.set('pages','1');try{return normalizeList(await apiJson(u.toString()),source)}catch(e){return []}}));onlineResults=batches.flat();const seen=new Set();onlineResults=onlineResults.filter(t=>{const k=t.source+':'+t.id;if(seen.has(k))return false;seen.add(k);return true});renderOnline();if(!onlineResults.length)list.innerHTML='<div class="music-empty">没有取得搜索结果。可能是音乐服务暂时不可用，或浏览器跨域限制了请求。<br>可以稍后重试，或切换搜索来源。</div>'}catch(e){list.innerHTML='<div class="music-empty">搜索失败：'+escapeHtml(e.message)+'</div>'}finally{btn.disabled=false}}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderOnline(){const list=$('musicOnlineList');list.innerHTML='';$('musicOnlineCount').textContent=onlineResults.length+' SONGS';if(!onlineResults.length)return;onlineResults.forEach((t,i)=>{const row=document.createElement('div');row.className='music-result-row';const cb=document.createElement('input');cb.type='checkbox';cb.className='music-result-check';cb.dataset.index=i;const meta=document.createElement('div');meta.className='music-result-meta';const title=document.createElement('strong');title.textContent=t.title;const sub=document.createElement('span');sub.textContent=[t.artist,t.album,t.source].filter(Boolean).join(' · ');meta.append(title,sub);const play=document.createElement('button');play.className='music-result-play';play.type='button';play.textContent='▶';play.title='试听';play.onclick=()=>playTrack(t);row.append(cb,meta,play);list.append(row)})}
async function resolveOnline(t){if(t.url)return t.url;const u=new URL(MUSIC_API);u.searchParams.set('types','url');u.searchParams.set('source',t.source);u.searchParams.set('id',t.remoteId||t.id);u.searchParams.set('br','320');const d=await apiJson(u.toString());const url=d?.url||d?.data?.url||d?.data?.play_url||d?.music_url||d?.data?.music_url||(typeof d==='string'?d:'');if(!url||!/^https?:\/\//i.test(url))throw new Error('这个版本暂时没有可播放音源');return url}
async function playTrack(t){
 try{
  if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null}
  current=t;
  if(t.kind!=='online'){objectUrl=URL.createObjectURL(t.blob);audio.src=objectUrl}
  else{toast('正在获取播放地址……');audio.src=await resolveOnline(t)}
  audio.load();updateLabels(t);await saveState();showPlayerView();
  await audio.play();setButtons();renderLocal();await loadLyricsForCurrent();
 }catch(e){showPlayerView();audio.pause();toast('暂时无法播放：'+e.message);setButtons();await loadLyricsForCurrent()}
}
function toggle(){if(!current){if(tracks[0])playTrack(tracks[0].kind==='online'?tracks[0]:{...tracks[0],kind:'local'});else if(queue.length)next();else toast('请先添加或搜索歌曲');return}if(audio.paused){if(!audio.src||current.kind==='online'&&!audio.src)playTrack(current);else audio.play().then(setButtons).catch(()=>toast('浏览器阻止播放，请再点一次'))}else audio.pause()}
function addFiles(files){return (async()=>{let count=0;for(const f of [...files]){if(!f.type.startsWith('audio/'))continue;const id='track-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);await put({id,title:f.name.replace(/\.[^.]+$/,''),artist:'',blob:f,mime:f.type,size:f.size,added:Date.now(),duration:0});count++}await all();toast('已添加 '+count+' 首本地歌曲 ♡')})()}
async function addSelected(){const ids=[...document.querySelectorAll('.music-result-check:checked')].map(x=>Number(x.dataset.index));if(!ids.length){toast('请先勾选歌曲');return}const chosen=ids.map(i=>onlineResults[i]).filter(Boolean);let added=0;for(const t of chosen){const key='online-'+t.source+'-'+t.id;const saved={id:key,remoteId:t.id,title:t.title,artist:t.artist||'',album:t.album||'',source:t.source,url:t.url||'',kind:'online',added:Date.now()};const exists=tracks.some(x=>x.id===key);if(!exists){await put(saved);added++}if(!queue.some(x=>x.kind==='online'&&x.source===t.source&&String(x.id)===String(t.id)))queue.push({...t,kind:'online'})}await all();await saveState();$('musicSelectAll').checked=false;document.querySelectorAll('.music-result-check').forEach(x=>x.checked=false);toast('已加入我的歌单 '+added+' 首，并加入播放队列 ♡');if(!current&&queue.length)next();}
function next(){if(queue.length){let t=queue.shift();if(t.kind==='local'){const found=tracks.find(x=>x.id===t.id);if(found)t={...found,kind:'local'}}history.push(current);saveState();if(t?.blob||t?.kind==='online')playTrack(t);else next();return}if(current?.kind==='local'&&tracks.length){const i=tracks.findIndex(t=>t.id===current.id);playTrack({...tracks[(i+1)%tracks.length],kind:'local'});return}audio.pause();toast('播放队列已结束')}
function prev(){if(audio.currentTime>3){audio.currentTime=0;return}const t=history.pop();if(t)playTrack(t);else if(current?.kind==='local'&&tracks.length){const i=tracks.findIndex(x=>x.id===current.id);playTrack({...tracks[(i-1+tracks.length)%tracks.length],kind:'local'})}}

function parseLRC(text){
 const out=[];
 String(text||'').split(/\r?\n/).forEach(line=>{
  const tags=[...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
  const lyric=line.replace(/^\s*(?:\[\d{1,2}:\d{2}(?:\.\d{1,3})?\])+/,'').trim();
  if(!lyric)return;
  tags.forEach(m=>{const sec=Number(m[1])*60+Number(m[2])+Number(('0.'+(m[3]||'0')).replace('0.','0.'));out.push({time:sec,text:lyric})});
 });
 return out.sort((a,b)=>a.time-b.time);
}
function lyricKey(){return 'lyrics:'+String(current?.id||'none')}
async function loadLyricsForCurrent(){
 lyricsLines=[];activeLyricIndex=-1;
 if(!current){renderLyrics();return}
 try{
  if(current.kind==='local'&&current.lrc){lyricsLines=parseLRC(current.lrc)}
  else{const saved=await req(db.transaction(META).objectStore(META).get(lyricKey()));if(saved?.text)lyricsLines=parseLRC(saved.text)}
 }catch{}
 renderLyrics();
}
function renderLyrics(){
 const box=$('musicLyrics');if(!box)return;box.innerHTML='';
 if(!lyricsLines.length){box.innerHTML='<div class="music-lyrics-empty">还没有歌词<br><small>可以导入这首歌的 .LRC 歌词文件</small></div>';return}
 lyricsLines.forEach((line,i)=>{const el=document.createElement('div');el.className='music-lyrics-line'+(i===activeLyricIndex?' active':'');el.textContent=line.text;el.dataset.index=i;box.append(el)});
}
function updateLyrics(){
 if(!lyricsLines.length)return;
 let idx=-1;for(let i=0;i<lyricsLines.length;i++){if(lyricsLines[i].time<=audio.currentTime)idx=i;else break}
 if(idx===activeLyricIndex)return;activeLyricIndex=idx;
 const box=$('musicLyrics');box?.querySelectorAll('.music-lyrics-line').forEach((el,i)=>el.classList.toggle('active',i===idx));
 const active=box?.querySelector('.music-lyrics-line.active');if(active)active.scrollIntoView({block:'center',behavior:'smooth'});
}
async function importLyrics(file){
 if(!file||!current){toast('请先选择一首歌曲');return}
 try{
  const text=await file.text();const parsed=parseLRC(text);
  if(!parsed.length){toast('没有识别到 LRC 时间轴，请检查歌词文件');return}
  if(current.kind==='local'){
   const t=tracks.find(x=>x.id===current.id);if(t){t.lrc=text;await put(t);current=t}
  }else{await req(db.transaction(META,'readwrite').objectStore(META).put({key:lyricKey(),text}))}
  lyricsLines=parsed;activeLyricIndex=-1;renderLyrics();toast('歌词已保存，可以跟随歌曲滚动 ♡');
 }catch(e){toast('歌词导入失败：'+e.message)}
}
function readPeopleForMusic(){
 let people=[],ids=[],metas={};
 // Prefer the app's live in-memory state and official contact helpers.
 try{if(typeof state!=='undefined'&&Array.isArray(state.people))people=state.people}catch{}
 try{if(typeof readChatContacts==='function')ids=readChatContacts()}catch{}
 try{if(typeof chatMeta==='function'){metas={};people.forEach(p=>{metas[p.id]=chatMeta(p.id)||{}})}}catch{}
 // Storage fallback for isolated loading / older builds.
 try{
  const saved=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}');
  if(!people.length&&Array.isArray(saved.people))people=saved.people;
 }catch{}
 try{if(!ids.length){const savedIds=JSON.parse(localStorage.getItem('love-record-chat-contacts-v2')||'[]');if(Array.isArray(savedIds))ids=savedIds}}catch{}
 try{if(!Object.keys(metas).length)metas=JSON.parse(localStorage.getItem('love-record-chat-meta-v1')||'{}')}catch{}
 const idSet=new Set((Array.isArray(ids)?ids:[]).map(String));
 return people.filter(p=>p&&p.id!=null&&(!idSet.size||idSet.has(String(p.id)))).map(p=>({
  id:String(p.id),name:metas[p.id]?.remark||p.name||'未命名联系人',
  role:p.role||p.personality||'联系人',avatar:metas[p.id]?.avatar||p.avatar||''
 }));
}
function renderTogetherPicker(){
 const box=$('musicTogetherContacts');if(!box)return;
 const people=readPeopleForMusic();box.innerHTML='';
 if(!people.length){
  box.innerHTML='<div class="listening-empty"><span>♡</span><strong>还没有可以邀请的人</strong><small>先去「联系人」添加一位角色，再回来和 TA 一起听歌吧。</small></div>';
  return;
 }
 people.forEach(p=>{
  const label=document.createElement('label');label.className='music-together-contact listening-contact';
  const avatar=document.createElement('span');avatar.className='music-together-avatar listening-contact-avatar';
  if(p.avatar){const img=document.createElement('img');img.src=p.avatar;img.alt='';avatar.append(img)}
  else avatar.textContent=(p.name||'♡').slice(0,1);
  const info=document.createElement('span');info.className='listening-contact-info';
  const strong=document.createElement('strong');strong.textContent=p.name;
  const small=document.createElement('small');small.textContent=p.role;
  info.append(strong,small);
  const check=document.createElement('input');check.type='radio';check.name='musicTogetherPerson';check.value=p.id;check.checked=togetherIds.map(String).includes(p.id);
  label.append(avatar,info,check);box.append(label);
 });
}

function renderTogetherActive(){
 const box=$('musicTogetherActive'),buttonText=$('musicTogetherButtonText');
 if(!box)return;box.innerHTML='';
 const people=readPeopleForMusic(),person=people.find(p=>togetherIds.map(String).includes(p.id));
 if(!person){box.hidden=true;if(buttonText)buttonText.textContent='邀请 TA 进入听歌房间';return}
 box.hidden=false;if(buttonText)buttonText.textContent='更换一起听的对象';
 const pair=document.createElement('div');pair.className='listening-pair';
 const you=document.createElement('div');you.className='listening-person';
 const youAvatar=document.createElement('span');youAvatar.className='listening-avatar listening-you';youAvatar.textContent='妍';
 const youName=document.createElement('strong');youName.textContent='妍妍';
 you.append(youAvatar,youName);
 const center=document.createElement('div');center.className='listening-heart-center';center.innerHTML='<span>♡</span><i></i>';
 const them=document.createElement('div');them.className='listening-person';
 const themAvatar=document.createElement('span');themAvatar.className='listening-avatar listening-them';
 if(person.avatar){const img=document.createElement('img');img.src=person.avatar;img.alt='';themAvatar.append(img)}else themAvatar.textContent=(person.name||'♡').slice(0,1);
 const themName=document.createElement('strong');themName.textContent=person.name;
 them.append(themAvatar,themName);pair.append(you,center,them);box.append(pair);
 const status=document.createElement('div');status.className='listening-room-status';
 status.innerHTML='<span class="listening-live-dots"><i></i><i></i><i></i></span><span>你们正在共享这段音乐时光</span>';
 box.append(status);
 const song=document.createElement('div');song.className='listening-room-song';
 song.textContent=current?`${current.title||'正在播放'}${current.artist?' · '+current.artist:''}`:'等待一首歌开始';
 box.append(song);
 const actions=document.createElement('div');actions.className='listening-room-actions';
 const change=document.createElement('button');change.type='button';change.textContent='更换 TA';change.onclick=()=>openTogetherModal();
 const stop=document.createElement('button');stop.type='button';stop.textContent='结束一起听';stop.onclick=()=>{togetherIds=[];saveTogether();renderTogetherActive();toast('已结束你们的听歌时光')};
 actions.append(change,stop);box.append(actions);
}
async function saveTogether(){
 try{localStorage.setItem('love-record-together-listen-v2',JSON.stringify(togetherIds))}catch{}
 try{if(db)await req(db.transaction(META,'readwrite').objectStore(META).put({key:'togetherListen',ids:togetherIds}))}catch{}
}
async function loadTogether(){
 try{
  if(db){const x=await req(db.transaction(META).objectStore(META).get('togetherListen'));togetherIds=Array.isArray(x?.ids)?x.ids:[]}
 }catch{}
 if(!togetherIds.length){try{const x=JSON.parse(localStorage.getItem('love-record-together-listen-v2')||'[]');if(Array.isArray(x))togetherIds=x.map(String)}catch{}}
 renderTogetherActive();
}
function closeTogetherModal(){
 const modal=$('musicTogetherModal');if(modal)modal.hidden=true;
 document.body.classList.remove('music-listening-modal-open');
}
function openTogetherModal(){
 renderTogetherPicker();
 const modal=$('musicTogetherModal');if(!modal)return;
 const song=$('musicTogetherCurrentSong');
 if(song&&current){
  const strong=song.querySelector('strong');if(strong)strong.textContent=current.title||'正在播放';
  const small=song.querySelector('small');if(small)small.textContent=current.artist||'NOW PLAYING';
 }
 modal.hidden=false;document.body.classList.add('music-listening-modal-open');
}
function init(){
 audio=$('lrGlobalAudio');if(!audio)return;
 audio.addEventListener('play',()=>{setButtons();renderLocal()});
 audio.addEventListener('pause',()=>{setButtons();renderLocal()});
 audio.addEventListener('timeupdate',()=>{const p=audio.duration?audio.currentTime/audio.duration*100:0;$('musicProgress').value=p;$('musicCurrentTime').textContent=fmt(audio.currentTime);$('musicDuration').textContent=fmt(audio.duration);updateLyrics()});
 audio.addEventListener('ended',next);
 $('musicUpload').onclick=()=>$('musicFiles').click();
 $('musicFiles').onchange=e=>{addFiles(e.target.files).catch(()=>toast('歌曲保存失败，请检查浏览器储存空间'));e.target.value=''};
 $('musicSearch').oninput=renderLocal;$('musicPlay').onclick=toggle;$('musicPrev').onclick=prev;$('musicNext').onclick=next;
 $('musicProgress').oninput=()=>{if(audio.duration)audio.currentTime=audio.duration*Number($('musicProgress').value)/100};
 $('musicVolume').oninput=()=>audio.volume=Number($('musicVolume').value);
 $('musicShuffle').onclick=()=>{queue=tracks.map(t=>t.kind==='online'?{...t,kind:'online'}:{...t,kind:'local'}).sort(()=>Math.random()-.5);saveState();toast('已将本地歌曲加入随机队列')};
 $('musicRepeat').onclick=()=>{audio.loop=!audio.loop;$('musicRepeat').classList.toggle('active',audio.loop)};
 $('musicClearSearch').onclick=()=>{$('musicSearch').value='';renderLocal()};
 $('musicCoverChoose').onclick=()=>$('musicCoverFile').click();
 $('musicCoverFile').onchange=e=>{chooseVinylCover(e.target.files?.[0]);e.target.value=''};
 $('musicOnlineGo').onclick=searchOnline;$('musicOnlineSearch').addEventListener('keydown',e=>{if(e.key==='Enter')searchOnline()});
 $('musicAddSelected').onclick=addSelected;$('musicSelectAll').onchange=e=>document.querySelectorAll('.music-result-check').forEach(x=>x.checked=e.target.checked);
 $('musicBackToLibrary').onclick=showLibraryView;
 
 
 $('musicTogetherOpen').addEventListener('click',openTogetherModal);
 document.querySelectorAll('[data-music-together-close]').forEach(el=>el.addEventListener('click',closeTogetherModal));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('musicTogetherModal')?.hidden)closeTogetherModal()});
 $('musicTogetherStart').onclick=async()=>{
  const selected=$('musicTogetherContacts')?.querySelector('input[name="musicTogetherPerson"]:checked');
  if(!selected){toast('先选择一位联系人吧 ♡');return}
  togetherIds=[String(selected.value)];await saveTogether();renderTogetherActive();closeTogetherModal();toast('你们的专属听歌时间开始啦 ♡')
 };
 openDB().then(async()=>{
  await loadVinylCover();const saved=await loadState();await all();await loadTogether();
  if(saved){if(saved.kind==='local'){const t=tracks.find(x=>x.id===saved.id);if(t){current={...t,kind:'local'};objectUrl=URL.createObjectURL(t.blob);audio.src=objectUrl;updateLabels(current)}}else{current=saved;updateLabels(current);if(saved.url)audio.src=saved.url}}
 }).catch(()=>toast('音乐库初始化失败'));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();