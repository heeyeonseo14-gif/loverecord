/* LOVE RECORD · Fixed Home Layout v1
   Fixed two-page launcher, editable profile/photos/countdowns, and a controller bridge
   to the single existing music player. No draggable desktop objects or widget studio. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const PROFILE_KEY='lr-home-profile-v1';
const PHOTOS_KEY='lr-home-photo-grid-v1';
const COUNTDOWN_KEY='lr-home-countdowns-v1';
const CHARACTER_SPOTLIGHT_KEY='lr-home-character-spotlight-v1';
const DEFAULT_PROFILE={name:'我',username:'@yourname',bio:'把喜欢的日常，慢慢收藏起来。',phrase:'EVERY LITTLE MOMENT MATTERS.',avatar:'',banner:''};
let profile={...DEFAULT_PROFILE},profileDraft={...DEFAULT_PROFILE},photos=['',''],countdowns=[],editingCountdownId='';
let characterCards=[],activeCharacterCardId='',editingCharacterCardId='';
const screens=()=>Array.from(document.querySelectorAll('#launcher [data-launcher-screen]'));
function setNotice(message){if(typeof window.toast==='function')window.toast(message);else console.info('[LOVE RECORD]',message)}
async function storeGet(key){try{return await lrKVGet(key)}catch(e){console.warn('[LOVE RECORD] home data read failed',key,e);return null}}
async function storeSet(key,value){try{await lrKVSet(key,value);return true}catch(e){console.error('[LOVE RECORD] home data save failed',key,e);setNotice('保存失败，请检查浏览器储存空间');return false}}
function safeText(value,fallback=''){const v=String(value??'').trim();return v||fallback}
function setImage(imgId,src){const img=$(imgId);if(!img)return;img.hidden=!src;if(src)img.src=src;else img.removeAttribute('src')}
function applyProfile(){
 $('lrProfileName').textContent=safeText(profile.name,DEFAULT_PROFILE.name);
 $('lrProfileId').textContent=safeText(profile.username,DEFAULT_PROFILE.username);
 $('lrProfileBio').textContent=safeText(profile.bio,DEFAULT_PROFILE.bio);
 $('lrProfilePhrase').textContent=safeText(profile.phrase,DEFAULT_PROFILE.phrase);
 setImage('lrProfileAvatarImage',profile.avatar);setImage('lrProfileBannerImage',profile.banner);
 $('lrProfileAvatarFallback').hidden=!!profile.avatar;
}
function fillProfileForm(){
 setImage('lrProfileAvatarPreview',profileDraft.avatar||'');setImage('lrProfileBannerPreview',profileDraft.banner||'');
 $('lrProfileNameInput').value=profileDraft.name||'';
 $('lrProfileUsernameInput').value=profileDraft.username||'';
 $('lrProfileBioInput').value=profileDraft.bio||'';
 $('lrProfilePhraseInput').value=profileDraft.phrase||'';
}
function syncDialogDock(){const open=!$('lrProfileModal').hidden||!$('lrCountdownModal').hidden||!$('lrCharacterSpotlightModal').hidden;document.body.classList.toggle('lr-home-dialog-open',open)}
function openProfileEditor(){profileDraft={...profile};fillProfileForm();$('lrProfileModal').hidden=false;syncDialogDock()}
function closeProfileEditor(){$('lrProfileModal').hidden=true;syncDialogDock()}
async function compressImage(file,maxSide=1800,quality=.86){
 if(!file||!file.type?.startsWith('image/'))throw new Error('请选择图片文件');
 const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file)});
 const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('无法打开这张图片'));image.src=source});
 const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('图片处理不可用');ctx.drawImage(img,0,0,canvas.width,canvas.height);
 return canvas.toDataURL('image/jpeg',quality);
}
function bindProfile(){
 $('lrProfileEdit').addEventListener('click',openProfileEditor);
 $('lrProfileAvatarOpen').addEventListener('click',openProfileEditor);
 $('lrProfileBannerOpen').addEventListener('click',openProfileEditor);
 $('lrProfileModalClose').addEventListener('click',closeProfileEditor);
 $('lrProfileModal').addEventListener('click',e=>{if(e.target===$('lrProfileModal'))closeProfileEditor()});
 $('lrProfilePickAvatar').addEventListener('click',()=>$('lrProfileAvatarFile').click());
 $('lrProfilePickBanner').addEventListener('click',()=>$('lrProfileBannerFile').click());
 $('lrProfileAvatarFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{profileDraft.avatar=await compressImage(f,800,.88);setImage('lrProfileAvatarPreview',profileDraft.avatar);setNotice('头像已选好，记得保存资料');}catch(err){setNotice(err.message||'头像读取失败')}finally{e.target.value=''}});
 $('lrProfileBannerFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{profileDraft.banner=await compressImage(f,1800,.86);setImage('lrProfileBannerPreview',profileDraft.banner);setNotice('横幅已选好，记得保存资料');}catch(err){setNotice(err.message||'横幅读取失败')}finally{e.target.value=''}});
 $('lrProfileForm').addEventListener('submit',async e=>{
  e.preventDefault();profileDraft.name=safeText($('lrProfileNameInput').value,DEFAULT_PROFILE.name).slice(0,32);
  let username=safeText($('lrProfileUsernameInput').value,DEFAULT_PROFILE.username);if(username&&!username.startsWith('@'))username='@'+username.replace(/^@+/,'');
  profileDraft.username=username.slice(0,36);profileDraft.bio=safeText($('lrProfileBioInput').value,DEFAULT_PROFILE.bio).slice(0,100);
  profileDraft.phrase=safeText($('lrProfilePhraseInput').value,DEFAULT_PROFILE.phrase).slice(0,80);
  if(await storeSet(PROFILE_KEY,profileDraft)){profile={...profileDraft};applyProfile();closeProfileEditor();setNotice('个人资料已保存 ♡')}
 });
}
function renderPhotos(){
 photos.forEach((src,index)=>{
  const img=$('lrHomePhoto'+(index+1)),empty=$('lrHomePhotoPlaceholder'+(index+1)),clear=$('lrHomePhotoClear'+(index+1));
  if(!img)return;img.hidden=!src;if(src)img.src=src;else img.removeAttribute('src');if(empty)empty.hidden=!!src;if(clear)clear.hidden=!src;
 });
}
function bindPhotos(){
 document.querySelectorAll('[data-lr-photo-upload]').forEach(button=>button.addEventListener('click',()=>{const idx=Number(button.dataset.lrPhotoUpload);$('lrHomePhotoFile'+(idx+1)).click()}));
 document.querySelectorAll('[data-lr-photo-clear]').forEach(button=>button.addEventListener('click',async e=>{e.stopPropagation();const idx=Number(button.dataset.lrPhotoClear);photos[idx]='';if(await storeSet(PHOTOS_KEY,photos)){renderPhotos();setNotice('照片已移除')}}));
 [0,1].forEach(idx=>$('lrHomePhotoFile'+(idx+1)).addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;try{photos[idx]=await compressImage(f,1500,.88);if(await storeSet(PHOTOS_KEY,photos)){renderPhotos();setNotice('照片已保存 ♡')}}catch(err){setNotice(err.message||'照片保存失败')}finally{e.target.value=''}
 }));
}
function dateAtMidnight(value){const d=new Date(String(value||'')+'T00:00:00');return Number.isNaN(d.getTime())?null:d}
function dayDistance(value){const today=new Date();today.setHours(0,0,0,0);const date=dateAtMidnight(value);if(!date)return null;return Math.round((date-today)/86400000)}
function formatDate(value){const d=dateAtMidnight(value);if(!d)return value||'';return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`}
function selectedCountdown(){
 const valid=countdowns.filter(x=>x&&x.id&&x.title&&x.date&&dayDistance(x.date)!==null);
 const upcoming=valid.filter(x=>dayDistance(x.date)>=0).sort((a,b)=>a.date.localeCompare(b.date));
 if(upcoming.length)return upcoming[0];
 return valid.sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
}
function renderCountdown(){
 const item=selectedCountdown(),display=$('lrCountdownDisplay');display.replaceChildren();
 if(!item){const empty=document.createElement('div');empty.className='lr-countdown-empty';empty.textContent='留下一个想认真期待的日子。';display.append(empty);return}
 const main=document.createElement('div');main.className='lr-countdown-main';
 const copy=document.createElement('div');copy.className='lr-countdown-copy';
 const title=document.createElement('div');title.className='lr-countdown-title';title.textContent=item.title;
 const date=document.createElement('div');date.className='lr-countdown-date';date.textContent=formatDate(item.date);
 copy.append(title,date);
 const value=document.createElement('div');value.className='lr-countdown-number';const n=dayDistance(item.date);
 value.textContent=n>0?String(n):(n===0?'TODAY':String(Math.abs(n)));
 const unit=document.createElement('small');unit.textContent=n>0?'DAYS LEFT':(n===0?'THE DAY':'DAYS AGO');value.append(unit);
 main.append(copy,value);display.append(main);
}
function renderCountdownList(){
 const box=$('lrCountdownList');box.replaceChildren();
 if(!countdowns.length){const empty=document.createElement('p');empty.className='lr-countdown-empty';empty.textContent='还没有添加日期。';box.append(empty);return}
 countdowns.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(item=>{
  const row=document.createElement('div');row.className='lr-countdown-list-item';
  const copy=document.createElement('div');copy.className='lr-countdown-list-copy';
  const title=document.createElement('strong');title.textContent=item.title;
  const date=document.createElement('small');date.textContent=formatDate(item.date);
  copy.append(title,date);
  const edit=document.createElement('button');edit.type='button';edit.textContent='编辑';edit.setAttribute('aria-label','编辑 '+item.title);edit.addEventListener('click',()=>editCountdown(item.id));
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','删除 '+item.title);remove.addEventListener('click',async()=>{if(!confirm('删除「'+item.title+'」这个日期吗？'))return;countdowns=countdowns.filter(x=>x.id!==item.id);if(await storeSet(COUNTDOWN_KEY,countdowns)){renderCountdown();renderCountdownList();resetCountdownForm();setNotice('日期已删除')}});
  row.append(copy,edit,remove);box.append(row);
 });
}
function resetCountdownForm(){editingCountdownId='';$('lrCountdownTitleInput').value='';$('lrCountdownDateInput').value='';$('lrCountdownSave').textContent='添加日期'}
function editCountdown(id){const item=countdowns.find(x=>x.id===id);if(!item)return;editingCountdownId=id;$('lrCountdownTitleInput').value=item.title;$('lrCountdownDateInput').value=item.date;$('lrCountdownSave').textContent='保存修改'}
function openCountdownManager(){renderCountdownList();resetCountdownForm();$('lrCountdownModal').hidden=false;syncDialogDock()}
function closeCountdownManager(){$('lrCountdownModal').hidden=true;syncDialogDock()}
function bindCountdown(){
 $('lrCountdownManage').addEventListener('click',openCountdownManager);$('lrCountdownModalClose').addEventListener('click',closeCountdownManager);
 $('lrCountdownModal').addEventListener('click',e=>{if(e.target===$('lrCountdownModal'))closeCountdownManager()});
 $('lrCountdownReset').addEventListener('click',resetCountdownForm);
 $('lrCountdownForm').addEventListener('submit',async e=>{
  e.preventDefault();const title=safeText($('lrCountdownTitleInput').value).slice(0,40),date=$('lrCountdownDateInput').value;
  if(!title||!date||!dateAtMidnight(date)){setNotice('请填写名称和有效日期');return}
  if(editingCountdownId){const item=countdowns.find(x=>x.id===editingCountdownId);if(item){item.title=title;item.date=date}}
  else countdowns.push({id:'cd-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),title,date});
  if(await storeSet(COUNTDOWN_KEY,countdowns)){renderCountdown();renderCountdownList();resetCountdownForm();setNotice('倒数日已保存 ♡')}
 });
}

function characterPeople(){
 try{const people=window.__LOVE_RECORD_GET_PEOPLE?.();return Array.isArray(people)?people.filter(p=>p&&p.id&&p.name&&true):[]}catch{return[]}
}
function characterMeta(personId){try{return typeof window.chatMeta==='function'?(window.chatMeta(String(personId))||{}):{}}catch{return{}}}
function characterName(personId){const p=characterPeople().find(x=>String(x.id)===String(personId));return p?.name||'已删除的角色'}
function characterAvatar(personId){const p=characterPeople().find(x=>String(x.id)===String(personId));const meta=characterMeta(personId);return meta.avatar||p?.avatar||p?.avatarUrl||p?.image||p?.photo||''}
function activeCharacterCard(){return characterCards.find(x=>x&&x.id===activeCharacterCardId)||characterCards[0]||null}
function renderCharacterSpotlight(){
 const card=activeCharacterCard(),button=$('lrCharacterSpotlightOpen'),name=$('lrCharacterSpotlightName'),description=$('lrCharacterSpotlightDescription'),avatar=$('lrCharacterSpotlightAvatar'),background=$('lrCharacterSpotlightBackground');if(!button)return;
 if(!card){
  button.classList.add('is-empty');button.classList.remove('has-background');button.setAttribute('aria-label','选择角色展示');
  name.textContent='选择一位喜欢的 CHAR';description.textContent='为 TA 设置专属背景与介绍。';
  avatar.hidden=true;avatar.removeAttribute('src');background.hidden=true;background.style.backgroundImage='none';return;
 }
 const person=characterPeople().find(x=>String(x.id)===String(card.personId));const shownName=safeText(card.displayName,person?.name||'未命名角色');const text=safeText(card.description,person?.role||'My favorite character.');
 // A saved spotlight remains a real card even while the contact directory is hydrating.
 // Do not apply the empty-card white veil just because person metadata is not ready yet.
 button.classList.remove('is-empty');button.classList.toggle('has-background',!!card.background);button.setAttribute('aria-label','打开 '+shownName+' 的聊天');name.textContent=shownName;description.textContent=text;
 const avatarSrc=card.avatar||characterAvatar(card.personId);avatar.hidden=!avatarSrc;if(avatarSrc)avatar.src=avatarSrc;else avatar.removeAttribute('src');
 const backgroundSrc=typeof card.background==='string'?card.background.trim():'';
 background.hidden=!backgroundSrc;
 background.style.backgroundImage=backgroundSrc?'url('+JSON.stringify(backgroundSrc)+')':'none';
}
function renderCharacterSelectors(selectedCardId='',selectedPersonId=''){
 const cardSelect=$('lrCharacterCardSelect'),personSelect=$('lrCharacterPersonSelect');cardSelect.replaceChildren(new Option('选择已有展示卡',''));
 characterCards.forEach(card=>{const option=new Option(safeText(card.displayName,characterName(card.personId)),card.id);cardSelect.add(option)});cardSelect.value=selectedCardId||'';
 personSelect.replaceChildren(new Option('请选择现有角色',''));characterPeople().forEach(person=>personSelect.add(new Option(person.name+(person.role?' · '+person.role:''),String(person.id))));personSelect.value=selectedPersonId||'';
 if(!personSelect.options.length||personSelect.options.length===1){const option=new Option('还没有 CHAR，请先在联系人中创建角色','');personSelect.add(option)}
}
function renderCharacterEditorPreviews(){
 const personId=$('lrCharacterPersonSelect').value,avatarSrc=characterDraftAvatar||characterAvatar(personId),backgroundSrc=characterDraftBackground||'';
 setImage('lrCharacterAvatarPreview',avatarSrc);setImage('lrCharacterBackgroundPreview',backgroundSrc);
 $('lrCharacterClearAvatar').disabled=!characterDraftAvatar;$('lrCharacterClearBackground').disabled=!characterDraftBackground;
}
let characterDraftAvatar='',characterDraftBackground='';
function loadCharacterEditor(card){
 editingCharacterCardId=card?.id||'';characterDraftAvatar=card?.avatar||'';characterDraftBackground=card?.background||'';
 renderCharacterSelectors(card?.id||'',card?.personId||'');$('lrCharacterDisplayName').value=card?.displayName||'';$('lrCharacterDescription').value=card?.description||'';
 if(!card){$('lrCharacterDisplayName').value='';$('lrCharacterDescription').value='';}
 renderCharacterEditorPreviews();$('lrCharacterDeleteCard').disabled=!card; $('lrCharacterSetActive').disabled=!card||card.id===activeCharacterCardId;
 $('lrCharacterManagerHint').textContent=card?((card.id===activeCharacterCardId?'这张卡目前正在主页展示。':'保存后可设为主页展示。')+' 背景图和展示头像独立保存。'):'新建一张角色卡；主页只会展示你选中的一张。';
}
function openCharacterManager(){
 renderCharacterSelectors();const current=activeCharacterCard();if(current)loadCharacterEditor(current);else loadCharacterEditor(null);
 $('lrCharacterSpotlightModal').hidden=false;syncDialogDock();
}
function closeCharacterManager(){$('lrCharacterSpotlightModal').hidden=true;syncDialogDock()}
function newCharacterCard(){loadCharacterEditor(null);const first=characterPeople()[0];if(first){$('lrCharacterPersonSelect').value=String(first.id);$('lrCharacterDisplayName').value=first.name||'';$('lrCharacterDescription').value=first.role||'';renderCharacterEditorPreviews()}$('lrCharacterCardSelect').value=''}
async function saveCharacterCollection(){return storeSet(CHARACTER_SPOTLIGHT_KEY,{cards:characterCards,activeId:activeCharacterCardId})}
async function bindCharacterSpotlight(){
 try{if(window.__lrChatStorageReady)await window.__lrChatStorageReady}catch(e){console.warn('[LOVE RECORD] character avatar metadata not fully hydrated',e)}
 const saved=await storeGet(CHARACTER_SPOTLIGHT_KEY);if(Array.isArray(saved)){characterCards=saved;activeCharacterCardId=characterCards[0]?.id||''}else if(saved&&typeof saved==='object'){characterCards=Array.isArray(saved.cards)?saved.cards.filter(x=>x&&x.id&&x.personId):[];activeCharacterCardId=String(saved.activeId||'')}
 renderCharacterSpotlight();$('lrCharacterSpotlightManage').addEventListener('click',openCharacterManager);$('lrCharacterSpotlightModalClose').addEventListener('click',closeCharacterManager);$('lrCharacterSpotlightModal').addEventListener('click',e=>{if(e.target===$('lrCharacterSpotlightModal'))closeCharacterManager()});
 $('lrCharacterNewCard').addEventListener('click',newCharacterCard);$('lrCharacterCardSelect').addEventListener('change',e=>{const card=characterCards.find(x=>x.id===e.target.value);loadCharacterEditor(card||null)});
 $('lrCharacterPersonSelect').addEventListener('change',()=>{const person=characterPeople().find(x=>String(x.id)===$('lrCharacterPersonSelect').value);if(!editingCharacterCardId&&person){$('lrCharacterDisplayName').value=person.name||'';$('lrCharacterDescription').value=person.role||''}renderCharacterEditorPreviews()});
 $('lrCharacterPickAvatar').addEventListener('click',()=>$('lrCharacterAvatarFile').click());$('lrCharacterPickBackground').addEventListener('click',()=>$('lrCharacterBackgroundFile').click());
 $('lrCharacterClearAvatar').addEventListener('click',()=>{characterDraftAvatar='';renderCharacterEditorPreviews()});$('lrCharacterClearBackground').addEventListener('click',()=>{characterDraftBackground='';renderCharacterEditorPreviews()});
 $('lrCharacterAvatarFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{characterDraftAvatar=await compressImage(file,760,.86);renderCharacterEditorPreviews()}catch(err){setNotice(err.message||'头像读取失败')}finally{e.target.value=''}});
 $('lrCharacterBackgroundFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{characterDraftBackground=await compressImage(file,1500,.82);renderCharacterEditorPreviews()}catch(err){setNotice(err.message||'背景读取失败')}finally{e.target.value=''}});
 $('lrCharacterSpotlightForm').addEventListener('submit',async e=>{e.preventDefault();const personId=$('lrCharacterPersonSelect').value,person=characterPeople().find(x=>String(x.id)===String(personId));if(!person){setNotice('请先选择一位现有 CHAR');return}const displayName=safeText($('lrCharacterDisplayName').value,person.name).slice(0,32),description=safeText($('lrCharacterDescription').value,person.role||'My favorite character.').slice(0,100);const id=editingCharacterCardId||('char-card-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7));const card={id,personId:String(person.id),displayName,description,avatar:characterDraftAvatar,background:characterDraftBackground};const idx=characterCards.findIndex(x=>x.id===id);if(idx>=0)characterCards[idx]=card;else characterCards.push(card);if(!activeCharacterCardId)activeCharacterCardId=id;if(await saveCharacterCollection()){renderCharacterSpotlight();loadCharacterEditor(card);setNotice('角色展示卡已保存 ♡')}});
 $('lrCharacterSetActive').addEventListener('click',async()=>{if(!editingCharacterCardId)return;activeCharacterCardId=editingCharacterCardId;if(await saveCharacterCollection()){renderCharacterSpotlight();loadCharacterEditor(characterCards.find(x=>x.id===editingCharacterCardId));setNotice('已切换主页展示角色 ♡')}});
 $('lrCharacterDeleteCard').addEventListener('click',async()=>{if(!editingCharacterCardId)return;const card=characterCards.find(x=>x.id===editingCharacterCardId);if(!confirm('删除「'+(card?.displayName||'这张角色卡')+'」吗？'))return;characterCards=characterCards.filter(x=>x.id!==editingCharacterCardId);if(activeCharacterCardId===editingCharacterCardId)activeCharacterCardId=characterCards[0]?.id||'';if(await saveCharacterCollection()){renderCharacterSpotlight();loadCharacterEditor(activeCharacterCard());setNotice('角色展示卡已删除')}});
 $('lrCharacterSpotlightOpen').addEventListener('click',openSpotlightCharacterChat);window.addEventListener('lr-contact-meta-ready',renderCharacterSpotlight);
}
function openSpotlightCharacterChat(){
 const card=activeCharacterCard();if(!card){openCharacterManager();return}const person=characterPeople().find(x=>String(x.id)===String(card.personId));if(!person){setNotice('这位 CHAR 已不存在，请重新选择');openCharacterManager();return}
 try{const ids=new Set();for(const key of ['love-record-chat-contacts-v2','love-record-chat-contacts-recovery-v1']){try{const list=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(list))list.forEach(x=>ids.add(String(x)))}catch{}}ids.add(String(person.id));const value=[...ids];localStorage.setItem('love-record-chat-contacts-v2',JSON.stringify(value));localStorage.setItem('love-record-chat-contacts-recovery-v1',JSON.stringify(value));
  const request=indexedDB.open('love-record-chat-index-v1');request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('state')){db.close();return}const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),get=store.get('chat-contact-ids');get.onsuccess=()=>{const old=Array.isArray(get.result?.ids)?get.result.ids.map(String):[];store.put({id:'chat-contact-ids',ids:[...new Set([...old,...value])],updatedAt:Date.now()})};tx.oncomplete=()=>db.close();tx.onerror=()=>db.close()};
 }catch(e){console.warn('[LOVE RECORD] character chat link index update skipped',e)}
 if(typeof window.nav==='function')window.nav('chat');else document.querySelector('[data-launch-page="chat"]')?.click();
 setTimeout(()=>{const target=[...document.querySelectorAll('#chatContacts [data-chat-open]')].find(x=>String(x.dataset.chatOpen)===String(person.id));if(target)target.click();else setNotice('已打开聊天列表，可以选择 '+person.name)},100);
}

function fmtTime(n){if(!Number.isFinite(n)||n<0)return '0:00';return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')}
function renderMusic(snapshot=window.LRMusicSnapshot){
 const state=snapshot||{};const title=$('lrHomeMusicTitle'),artist=$('lrHomeMusicArtist'),play=$('lrHomeMusicPlay'),progress=$('lrHomeMusicProgress');
 title.textContent=state.title||'还没有播放歌曲';artist.textContent=state.artist||'从音乐库选择一首歌';
 setImage('lrHomeMusicCover',state.cover||'');$('lrHomeMusicCoverFallback').hidden=!!state.cover;
 play.textContent=state.playing?'Ⅱ':'▶';play.setAttribute('aria-label',state.playing?'暂停':'播放');
 const duration=Number(state.duration)||0,current=Number(state.currentTime)||0;progress.value=duration?String(Math.max(0,Math.min(100,current/duration*100))):'0';
 $('lrHomeMusicCurrent').textContent=fmtTime(current);$('lrHomeMusicDuration').textContent=fmtTime(duration);
}
function bindMusic(){
 document.querySelectorAll('[data-lr-music-action]').forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.lrMusicAction,controller=window.LRMusicController;
  if(!controller){setNotice('音乐播放器正在初始化，请稍后再试');return}
  if(action==='play')controller.toggle();else if(action==='previous')controller.previous();else if(action==='next')controller.next();
 }));
 $('lrHomeMusicProgress').addEventListener('input',e=>{
  const controller=window.LRMusicController,snapshot=window.LRMusicSnapshot||{},duration=Number(snapshot.duration)||0;
  if(controller&&duration)controller.seek(duration*Number(e.target.value)/100);
 });
 window.addEventListener('lr-music-state-change',e=>renderMusic(e.detail));
 const audio=$('lrGlobalAudio');if(audio){audio.addEventListener('timeupdate',()=>renderMusic(window.LRMusicSnapshot));audio.addEventListener('durationchange',()=>renderMusic(window.LRMusicSnapshot))}
 renderMusic();
}
function setPage(index){const list=screens();const next=Math.max(0,Math.min(list.length-1,Number(index)||0));list.forEach((screen,i)=>screen.classList.toggle('is-active',i===next));
 const dots=$('launcherPages');if(dots){dots.querySelectorAll('button').forEach((b,i)=>{b.classList.toggle('active',i===next);b.setAttribute('aria-current',i===next?'page':'false')})}
 window.__loveRecordLauncherCurrentPage=next;window.dispatchEvent(new CustomEvent('lr-launcher-page-change',{detail:{page:next}}));
 const root=$('launcher');if(root)root.scrollTo({top:0,behavior:'smooth'});
}
function initPages(){
 const root=$('launcher'),dots=$('launcherPages'),list=screens();if(!root||!dots||list.length!==2)return;
 dots.replaceChildren();list.forEach((screen,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',`第${i+1}页`);b.dataset.launcherPage=String(i);b.addEventListener('click',()=>setPage(i));dots.append(b)});
 let start=null,axis='',suppressAppClickUntil=0;
 root.addEventListener('click',e=>{if(Date.now()<suppressAppClickUntil&&e.target.closest('.launcher-app')){e.preventDefault();e.stopImmediatePropagation()}},true);
 root.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||e.target.closest('input,textarea,select,[contenteditable="true"],.lr-home-modal,.lr-photo-slot-clear,.lr-profile-edit,.lr-profile-banner-edit,.lr-countdown-manage,.lr-home-music-controls,.lr-home-music-progress')){start=null;axis='';return}
  const t=e.touches[0];start={x:t.clientX,y:t.clientY,time:Date.now()};axis='';
 },{passive:true});
 root.addEventListener('touchmove',e=>{
  if(!start||e.touches.length!==1)return;const t=e.touches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;
  if(!axis&&Math.max(Math.abs(dx),Math.abs(dy))>8)axis=Math.abs(dx)>Math.abs(dy)*1.18?'x':'y';
  if(axis==='x'&&e.cancelable)e.preventDefault();
 },{passive:false});
 root.addEventListener('touchend',e=>{
  if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y,elapsed=Date.now()-start.time;
  if(axis==='x'&&Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.18&&elapsed<1300){const current=Number(window.__loveRecordLauncherCurrentPage)||0;setPage(current+(dx<0?1:-1));suppressAppClickUntil=Date.now()+750}
  start=null;axis='';
 },{passive:true});
 root.addEventListener('touchcancel',()=>{start=null;axis=''} ,{passive:true});
 setPage(0);
}
async function migrateLegacyPhoto(){
 try{
  if(photos.some(Boolean)||typeof getImages!=='function')return;
  const old=await getImages('home');if(!old?.length)return;
  const first=old[0].blob;if(!first)return;
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(first)});
  photos[0]=data;await storeSet(PHOTOS_KEY,photos);renderPhotos();
 }catch(e){console.warn('[LOVE RECORD] legacy home photo migration skipped',e)}
}
async function init(){
 profile={...DEFAULT_PROFILE,...(await storeGet(PROFILE_KEY)||{})};if(['\u598d\u598d','\u0059\u0041\u004e\u0059\u0041\u004e'].includes(String(profile.name||'').trim().toUpperCase()))profile.name='我';profileDraft={...profile};applyProfile();
 const savedPhotos=await storeGet(PHOTOS_KEY);if(Array.isArray(savedPhotos))photos=[String(savedPhotos[0]||''),String(savedPhotos[1]||'')];renderPhotos();if(!savedPhotos)await migrateLegacyPhoto();
 const savedCountdowns=await storeGet(COUNTDOWN_KEY);countdowns=Array.isArray(savedCountdowns)?savedCountdowns.filter(x=>x&&x.id&&x.title&&x.date):[];renderCountdown();
 bindProfile();bindPhotos();bindCountdown();bindMusic();await bindCharacterSpotlight();initPages();

}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(e=>console.error('[LOVE RECORD] fixed home init failed',e)),{once:true});
else init().catch(e=>console.error('[LOVE RECORD] fixed home init failed',e));
window.__loveRecordLauncherSetPage=setPage;
window.__loveRecordLauncherAddPage=()=>setNotice('主页固定为两页，不支持添加页面');
window.__loveRecordLauncherRefresh=()=>{const moreApps=document.querySelector('#launcher .launcher-grid[data-launcher-grid="more"]');if(moreApps){document.querySelectorAll('#launcher .lr-user-app').forEach(x=>{if(x.parentElement!==moreApps)moreApps.append(x)})}};
})();
