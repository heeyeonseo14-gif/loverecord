/* LOVE RECORD COMMUNITY V1 · local-first Douban-inspired community */
(() => {
  'use strict';
  if (window.__lrCommunityV1) return;
  window.__lrCommunityV1 = true;

  const DB_NAME = 'love-record-community-db';
  const DB_VERSION = 2;
  const STORE = 'posts';
  const PROFILE_STORE = 'profile';
  const SETTINGS_KEY = 'yanyan-love-settings-v5';
  const COMMUNITY_KEY = 'love-record-community-profile-v1';
  const CATS = [
    {id:'life', name:'生活日记', en:'LIFE NOTES', desc:'把日常的小事，认真地记录下来。', icon:'▤', tone:'sage'},
    {id:'music', name:'音乐分享', en:'MUSIC ROOM', desc:'交换最近喜欢的旋律与歌单。', icon:'♫', tone:'sand'},
    {id:'interest', name:'兴趣交流', en:'COMMON GROUND', desc:'从一个共同的爱好，认识更多可能。', icon:'✳', tone:'lilac'},
    {id:'heart', name:'情感树洞', en:'HEART TO HEART', desc:'把不方便说出口的话，轻轻放在这里。', icon:'♡', tone:'rose'},
    {id:'film', name:'影视讨论', en:'ON THE SCREEN', desc:'聊电影、剧集，以及那些难忘的角色。', icon:'▣', tone:'blue'},
    {id:'game', name:'游戏专区', en:'GAME LOUNGE', desc:'分享游戏体验、攻略和通关时刻。', icon:'⌘', tone:'ochre'}
  ];
  const $ = (id, root=document) => root.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateText = ts => new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));
  let aiMemory = {};
  let db = null, posts = [], page = 'home', activeCategory = '', activePost = '', sortMode = 'new', searchTerm = '', draftFiles = [], objectUrls = [], profile = {name:'妍妍', bio:'在这里记录喜欢的事。', avatar:'', cover:'', worldSetting:'', communityContactsEnabled:[], aiFollowers:[], following:[]}, initialized = false, aiBusy=false;

  function getProfile() {
    try { aiMemory=JSON.parse(localStorage.getItem('love-record-community-ai-memory-v1')||'{}'); } catch { aiMemory={}; }
    try {
      const saved = JSON.parse(localStorage.getItem(COMMUNITY_KEY)||'{}');
      const app = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
      profile = {...profile, ...saved};
      if (!saved.name && app.name) profile.name = app.name;
    } catch {}
  }
  function saveProfile() {
    const meta = {...profile}; delete meta.avatar; delete meta.cover;
    try { localStorage.setItem(COMMUNITY_KEY, JSON.stringify(meta)); }
    catch (e) { console.warn('[Community] profile metadata storage quota reached', e); }
    if (db) {
      try { const tx=db.transaction(PROFILE_STORE,'readwrite'); tx.objectStore(PROFILE_STORE).put({id:'main',avatar:profile.avatar||'',cover:profile.cover||''}); }
      catch(e) { console.warn('[Community] profile image storage failed',e); }
    }
  }
  async function loadProfileImages() {
    if (!db) return;
    const saved = await new Promise(resolve=>{const r=db.transaction(PROFILE_STORE,'readonly').objectStore(PROFILE_STORE).get('main');r.onsuccess=()=>resolve(r.result||{});r.onerror=()=>resolve({});});
    profile.avatar=saved.avatar||''; profile.cover=saved.cover||'';
  }

  function openDatabase() {
    return new Promise((resolve,reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE,{keyPath:'id'});
        if (!d.objectStoreNames.contains(PROFILE_STORE)) d.createObjectStore(PROFILE_STORE,{keyPath:'id'});
      };
      req.onsuccess = () => { db=req.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }
  function allPosts() {
    return new Promise((resolve,reject) => {
      const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
    });
  }
  function putPost(post) {
    return new Promise((resolve,reject) => {
      const req=db.transaction(STORE,'readwrite').objectStore(STORE).put(post);
      req.onsuccess=()=>resolve(post); req.onerror=()=>reject(req.error);
    });
  }
  function deletePost(id) {
    return new Promise((resolve,reject) => {
      const req=db.transaction(STORE,'readwrite').objectStore(STORE).delete(id);
      req.onsuccess=resolve; req.onerror=()=>reject(req.error);
    });
  }
  async function refreshPosts() { posts=await allPosts(); posts.sort((a,b)=>b.createdAt-a.createdAt); }
  async function migrateLegacy() {
    if (localStorage.getItem('lr-community-legacy-migrated-v1')) return;
    try {
      const old=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
      const legacy=Array.isArray(old.forumPosts)?old.forumPosts:[];
      for (const p of legacy) {
        if (!p || posts.some(x=>x.id===String(p.id))) continue;
        await putPost({
          id:String(p.id||('legacy-'+Date.now()+Math.random())),
          category:'interest', title:String(p.title||'旧论坛帖子'),
          body:String(p.body||''), author:String(p.author||profile.name),
          authorType:'legacy', createdAt:Date.now(), updatedAt:Date.now(),
          likes:Math.max(0,Number(p.likes)||0), liked:false, favorite:false,
          images:[], comments:(Array.isArray(p.comments)?p.comments:[]).map(c=>({
            id:'c-'+Date.now()+Math.random(), author:String(c.author||'旧论坛用户'),
            body:String(c.body||''), createdAt:Date.now()
          }))
        });
      }
    } catch(e) { console.warn('[Community] legacy migration skipped',e); }
    localStorage.setItem('lr-community-legacy-migrated-v1','1');
    await refreshPosts();
  }
  function category(id) { return CATS.find(c=>c.id===id)||CATS[2]; }
  function catMarkup(c, compact=false) {
    return `<button class="lr-cm-cat ${c.tone}" data-c-action="category" data-id="${c.id}">
      <span class="lr-cm-cat-icon">${c.icon}</span><span class="lr-cm-cat-copy"><b>${c.name}</b><small>${c.en}</small></span><span class="lr-cm-cat-arrow">↗</span>
    </button>`;
  }
  function cleanupUrls() { objectUrls.forEach(u=>URL.revokeObjectURL(u)); objectUrls=[]; }
  function imageUrl(blob) { const u=URL.createObjectURL(blob); objectUrls.push(u); return u; }
  function imageMarkup(post, limit=3) {
    const images=(post.images||[]).slice(0,limit);
    if (!images.length) return '';
    return `<div class="lr-cm-images ${images.length===1?'single':''}">${images.map((im,i)=>{
      const src=im.dataUrl || (im.blob ? imageUrl(im.blob) : '');
      return src?`<button type="button" class="lr-cm-image" data-c-action="view-image" data-post="${esc(post.id)}" data-index="${i}"><img src="${src}" alt="帖子图片" loading="lazy"></button>`:'';
    }).join('')}</div>`;
  }
  function postCard(p, compact=false) {
    const c=category(p.category), comments=(p.comments||[]).length;
    const body=esc(p.body||'').replace(/\n/g,'<br>');
    return `<article class="lr-cm-post ${compact?'compact':''}">
      <div class="lr-cm-post-meta"><span class="lr-cm-avatar">${esc((p.author||'友').slice(0,1))}</span><span class="lr-cm-author">${esc(p.author||'社区成员')}<small>${dateText(p.createdAt||Date.now())}</small></span><button class="lr-cm-tag" data-c-action="category" data-id="${c.id}">${c.name}</button></div>
      <div class="lr-cm-post-open" role="button" tabindex="0" data-c-action="detail" data-id="${esc(p.id)}"><h3>${esc(p.title||'未命名')}</h3><p>${body}</p>${imageMarkup(p,compact?1:3)}</div>
      <div class="lr-cm-post-actions"><button data-c-action="like" data-id="${esc(p.id)}" class="${p.liked?'active':''}">♡ <span>${Number(p.likes)||0}</span></button><button data-c-action="detail" data-id="${esc(p.id)}">评论 ${comments}</button><button data-c-action="favorite" data-id="${esc(p.id)}" class="${p.favorite?'active':''}">${p.favorite?'★ 已收藏':'☆ 收藏'}</button></div>
    </article>`;
  }
  function visiblePosts(list=posts) {
    let result=list.slice();
    if (searchTerm) {
      const q=searchTerm.toLowerCase();
      result=result.filter(p=>(p.title+' '+p.body+' '+p.author+' '+category(p.category).name).toLowerCase().includes(q));
    }
    if (sortMode==='hot') result.sort((a,b)=>(Number(b.likes)||0)-(Number(a.likes)||0)||b.createdAt-a.createdAt);
    else result.sort((a,b)=>b.createdAt-a.createdAt);
    return result;
  }
  function emptyState(title='这里还很安静',desc='发布第一条内容，让这个分区慢慢热闹起来。') {
    return `<div class="lr-cm-empty"><span>✳</span><b>${title}</b><p>${desc}</p><button class="lr-cm-primary" data-c-action="compose">写下第一篇</button></div>`;
  }
  function header(title='社区广场', sub='COMMUNITY') {
    return `<header class="lr-cm-header"><button class="lr-cm-brand" data-c-action="home" aria-label="返回社区首页"><span class="lr-cm-brand-mark">l.</span><span><b>LOVE RECORD</b><small>${sub}</small></span></button><div class="lr-cm-header-actions"><button data-c-action="search-focus" aria-label="搜索">⌕</button><button data-c-action="profile" aria-label="个人主页">${esc((profile.name||'友').slice(0,1))}</button><button data-c-action="close" aria-label="关闭社区">×</button></div></header>`;
  }
  function bottomNav(active='home') {
    return `<nav class="lr-cm-bottom">
      <button class="${active==='home'?'on':''}" data-c-action="home"><i>⌂</i><span>广场</span></button>
      <button class="${active==='groups'?'on':''}" data-c-action="groups"><i>▦</i><span>分区</span></button>
      <button class="lr-cm-create-nav" data-c-action="compose"><i>＋</i><span>发布</span></button>
      <button class="${active==='activity'?'on':''}" data-c-action="activity"><i>♡</i><span>互动</span></button>
      <button class="${active==='profile'?'on':''}" data-c-action="profile"><i>○</i><span>我的</span></button>
    </nav>`;
  }
  function homeView() {
    const list=visiblePosts();
    const featured=CATS.map(catMarkup).join('');
    return `${header()}<main class="lr-cm-scroll"><section class="lr-cm-welcome"><div class="lr-cm-eyebrow">A PLACE FOR YOUR INTERESTS</div><h1>兴趣，让生活<br><em>有回音。</em></h1><p>记录喜欢的事，也遇见喜欢相同事物的人。</p><button class="lr-cm-write" data-c-action="compose"><span>＋</span><span><b>分享一个新发现</b><small>写下此刻想说的话……</small></span><i>↗</i></button><div class="lr-cm-search-wrap"><span>⌕</span><input id="lrCmSearch" type="search" placeholder="搜索帖子、话题或分区……" value="${esc(searchTerm)}"></div></section>
      <section class="lr-cm-section"><div class="lr-cm-section-head"><div><small>EXPLORE BY INTEREST</small><h2>发现兴趣分区</h2></div><button data-c-action="groups">全部分区 ↗</button></div><div class="lr-cm-cats">${featured}</div></section>
      <section class="lr-cm-section lr-cm-feed"><div class="lr-cm-section-head"><div><small>COMMUNITY NOTES</small><h2>社区动态</h2></div><span class="lr-cm-local-pill">AI 虚拟社区</span></div><div class="lr-cm-ai-panel"><div><b>让社区生活起来</b><small>固定角色 + 随机网友 · 使用已配置的 API</small></div><button class="lr-cm-primary" data-c-action="ai-generate">✦ 生成社区动态</button><div class="lr-cm-ai-status" id="lrCmAiStatus">${aiBusy?'AI 正在创作…':'等待生成新的社区动态'}</div></div><div class="lr-cm-feed-tabs"><button class="${sortMode==='new'?'on':''}" data-c-action="sort" data-id="new">最新</button><button class="${sortMode==='hot'?'on':''}" data-c-action="sort" data-id="hot">热门</button></div>
      <div class="lr-cm-post-list">${list.length?list.map(p=>postCard(p)).join(''):emptyState()}</div></section><div class="lr-cm-local-note">AI 内容由你配置的模型生成 · 帖子与资料保存在当前设备</div></main>${bottomNav('home')}`;
  }
  function groupsView() {
    return `${header('兴趣分区','DISCOVER') }<main class="lr-cm-scroll"><section class="lr-cm-page-intro"><div class="lr-cm-eyebrow">SIX ROOMS, MANY INTERESTS</div><h1>找到你的<br><em>兴趣角落。</em></h1><p>每个分区都是一个独立的小天地。</p></section><div class="lr-cm-groups-list">${CATS.map(c=>`<div class="lr-cm-group-row"><div class="lr-cm-group-art ${c.tone}">${c.icon}</div><div class="lr-cm-group-info"><small>${c.en}</small><b>${c.name}</b><p>${c.desc}</p></div><button data-c-action="category" data-id="${c.id}">进入 ↗</button></div>`).join('')}</div></main>${bottomNav('groups')}`;
  }
  function categoryView() {
    const c=category(activeCategory), list=visiblePosts(posts.filter(p=>p.category===c.id));
    return `${header(c.name,c.en)}<main class="lr-cm-scroll"><section class="lr-cm-category-hero ${c.tone}"><span>${c.icon}</span><div class="lr-cm-eyebrow">${c.en}</div><h1>${c.name}</h1><p>${c.desc}</p><button data-c-action="compose" data-category="${c.id}">＋ 在这个分区发布</button></section><section class="lr-cm-section lr-cm-feed"><div class="lr-cm-section-head"><div><small>DISCUSSION</small><h2>分区帖子</h2></div><span>${list.length} 篇</span></div><div class="lr-cm-feed-tabs"><button class="${sortMode==='new'?'on':''}" data-c-action="sort" data-id="new">最新</button><button class="${sortMode==='hot'?'on':''}" data-c-action="sort" data-id="hot">热门</button></div><div class="lr-cm-post-list">${list.length?list.map(p=>postCard(p)).join(''):emptyState('还没有帖子','来做第一个分享的人吧。')}</div></section></main>${bottomNav('groups')}`;
  }
  function detailView() {
    const p=posts.find(x=>x.id===activePost); if(!p){page='home';return homeView();}
    const comments=(p.comments||[]).slice().sort((a,b)=>a.createdAt-b.createdAt);
    return `${header('帖子详情','POST DETAIL')}<main class="lr-cm-scroll"><button class="lr-cm-back" data-c-action="back">‹ 返回</button><article class="lr-cm-detail"><div class="lr-cm-post-meta"><span class="lr-cm-avatar">${esc((p.author||'友').slice(0,1))}</span><span class="lr-cm-author">${esc(p.author||'社区成员')}<small>${dateText(p.createdAt)}</small></span><button class="lr-cm-tag" data-c-action="category" data-id="${esc(p.category)}">${category(p.category).name}</button></div><h1>${esc(p.title)}</h1><div class="lr-cm-detail-body">${esc(p.body||'').replace(/\n/g,'<br>')}</div>${imageMarkup(p,10)}<div class="lr-cm-post-actions"><button data-c-action="like" data-id="${esc(p.id)}" class="${p.liked?'active':''}">♡ ${Number(p.likes)||0} 赞</button><button data-c-action="favorite" data-id="${esc(p.id)}" class="${p.favorite?'active':''}">${p.favorite?'★ 已收藏':'☆ 收藏'}</button><button data-c-action="delete" data-id="${esc(p.id)}">删除</button></div></article><section class="lr-cm-comments"><div class="lr-cm-section-head"><div><small>CONVERSATION</small><h2>评论 · ${comments.length}</h2></div><button class="lr-cm-ai-comment" data-c-action="ai-comments">✦ AI 网友来聊聊</button></div>${comments.length?comments.map(c=>`<div class="lr-cm-comment" id="${esc(c.id)}"><span class="lr-cm-avatar">${esc((c.author||'友').slice(0,1))}</span><div><b>${esc(c.author||profile.name)}</b><small>${dateText(c.createdAt)}${c.replyToName?` · 回复 @${esc(c.replyToName)}`:''}</small><p>${esc(c.body).replace(/\n/g,'<br>')}</p><button class="lr-cm-reply" data-c-action="reply-comment" data-id="${esc(c.id)}" data-name="${esc(c.author||'网友')}">回复</button></div></div>`).join(''):'<div class="lr-cm-no-comment">还没有评论，留下第一句回应吧。</div>'}<form id="lrCmCommentForm" class="lr-cm-comment-form"><div id="lrCmReplyHint" class="lr-cm-reply-hint" hidden></div><input id="lrCmCommentInput" maxlength="800" placeholder="写下你的评论……" required><button type="submit">发送</button></form></section></main>${bottomNav('home')}`;
  }
  function composeView() {
    const selected=activeCategory||'life';
    return `${header('发布新帖','CREATE A POST')}<main class="lr-cm-scroll"><section class="lr-cm-compose"><div class="lr-cm-eyebrow">YOUR VOICE MATTERS</div><h1>分享一个<br><em>小小发现。</em></h1><label>选择分区</label><select id="lrCmCategory">${CATS.map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${c.name}</option>`).join('')}</select><label>标题</label><input id="lrCmTitle" maxlength="100" placeholder="给这篇帖子起个标题"><label>正文</label><textarea id="lrCmBody" maxlength="12000" rows="8" placeholder="想说什么，都可以从这里开始……"></textarea><div class="lr-cm-upload-area"><div><b>添加照片</b><small>最多 6 张 · 图片保存在本机</small></div><button type="button" data-c-action="choose-images">＋ 选择图片</button><input id="lrCmFiles" type="file" accept="image/*" multiple hidden></div><div id="lrCmPreview" class="lr-cm-preview"></div><div class="lr-cm-compose-actions"><button class="lr-cm-secondary" data-c-action="back">取消</button><button class="lr-cm-primary" data-c-action="publish">发布帖子</button></div><p class="lr-cm-privacy">LOCAL COMMUNITY · 仅保存在当前设备，不会公开到互联网。</p></section></main>${bottomNav('')}`;
  }
  function profileView() {
    const mine=posts.filter(p=>p.author===profile.name), fav=posts.filter(p=>p.favorite);
    const followers=Array.isArray(profile.aiFollowers)?profile.aiFollowers:[];
    const following=Array.isArray(profile.following)?profile.following:[];
    const cover=profile.cover?`background-image:linear-gradient(0deg,rgba(35,42,34,.42),rgba(35,42,34,.04)),url("${profile.cover}")`:'background:linear-gradient(125deg,#dce7dc,#eee9e2 55%,#e8e2ed)';
    return `${header('我的个人主页','MY PROFILE')}<main class="lr-cm-scroll"><section class="lr-cm-profile-cover" style='${cover}'><div class="lr-cm-profile-avatar">${profile.avatar?`<img src="${profile.avatar}" alt="头像">`:esc((profile.name||'友').slice(0,1))}</div><div class="lr-cm-profile-cover-name"><div class="lr-cm-eyebrow">LOVE RECORD MEMBER</div><h1>${esc(profile.name)}</h1><p>${esc(profile.bio||'')}</p></div></section><div class="lr-cm-profile-stats"><div><b>${followers.length}</b><small>粉丝</small></div><div><b>${following.length}</b><small>关注</small></div><div><b>${mine.length}</b><small>帖子</small></div><div><b>${mine.reduce((n,p)=>n+(Number(p.likes)||0),0)}</b><small>获赞</small></div></div><div class="lr-cm-followers"><b>最近关注你的网友</b><span>${followers.length?followers.slice(-12).reverse().map(n=>`<i>${esc(n)}</i>`).join(''):'AI 网友开始和你互动后，会有人关注你。'}</span></div>
      <section class="lr-cm-profile-edit"><div class="lr-cm-section-head"><div><small>PERSONAL SPACE</small><h2>编辑个人主页</h2></div></div><label>用户名</label><input id="lrCmProfileName" maxlength="24" value="${esc(profile.name)}"><label>个人简介</label><textarea id="lrCmProfileBio" rows="2" maxlength="180">${esc(profile.bio||'')}</textarea><div class="lr-cm-profile-upload-row"><label>头像<input id="lrCmAvatarFile" type="file" accept="image/*"></label><label>背景封面<input id="lrCmCoverFile" type="file" accept="image/*"></label></div><button class="lr-cm-primary" data-c-action="save-profile">保存个人主页</button></section>
      <section class="lr-cm-profile-edit lr-cm-world-setting"><div class="lr-cm-section-head"><div><small>COMMUNITY LORE</small><h2>社区世界观设定</h2></div><span class="lr-cm-local-pill">AI 创作核心</span></div><p>写下这个社区的背景、时代、氛围、规则、人物关系与日常。AI 会依据这里的设定生成帖子和互动。</p><textarea id="lrCmWorldSetting" rows="7" maxlength="6000" placeholder="例如：这是一个现代都市里的兴趣社区……这里的人有各自的生活、工作、爱好与关系；固定角色会延续过往经历，随机网友会自然加入讨论……">${esc(profile.worldSetting||'')}</textarea><div class="lr-cm-compose-actions"><button class="lr-cm-secondary" data-c-action="save-world">保存设定</button><button class="lr-cm-primary" data-c-action="generate-world">✦ 根据设定生成</button></div><small class="lr-cm-world-hint">世界观会作为 AI 生成内容的长期背景，不会覆盖你已有的帖子。</small></section>
      <section class="lr-cm-profile-edit lr-cm-participants"><div class="lr-cm-section-head"><div><small>COMMUNITY PARTICIPANTS</small><h2>参与联系人</h2></div><span class="lr-cm-local-pill">固定角色</span></div><p>勾选允许进入社区的 LOVE RECORD 联系人。未勾选的联系人不会参与社区发帖、评论或自动互动；随机网友不受此设置影响。</p><div class="lr-cm-participant-list">${participantMarkup()}</div><button class="lr-cm-primary" data-c-action="save-participants">保存参与名单</button></section>
      <section class="lr-cm-section"><div class="lr-cm-section-head"><div><small>YOUR CONTRIBUTIONS</small><h2>我的帖子</h2></div></div><div class="lr-cm-post-list">${mine.length?mine.map(p=>postCard(p)).join(''):emptyState('还没有发布内容','分享第一篇帖子，留下你的社区足迹。')}</div></section><section class="lr-cm-section"><div class="lr-cm-section-head"><div><small>BOOKMARKS</small><h2>我的收藏</h2></div></div><div class="lr-cm-post-list">${fav.length?fav.map(p=>postCard(p)).join(''):emptyState('收藏夹还是空的','遇到喜欢的帖子，可以把它收藏起来。')}</div></section></main>${bottomNav('profile')}`;
  }
  function participantMarkup(){
    const people=readAppSettings().people||[]; const enabled=Array.isArray(profile.communityContactsEnabled)?profile.communityContactsEnabled:people.map(p=>p.id);
    if(!people.length)return '<p class="lr-cm-world-hint">还没有联系人。请先在 LOVE RECORD 的联系人页面添加角色。</p>';
    return people.map(p=>`<label class="lr-cm-participant"><input type="checkbox" value="${esc(p.id)}" ${enabled.includes(p.id)?'checked':''}><span><b>${esc(p.name||p.nickname||'未命名联系人')}</b><small>${esc(p.role||p.identity||'AI 联系人')}</small></span></label>`).join('');
  }
  function activityView() {
    const comments=[];
    posts.forEach(p=>(p.comments||[]).forEach(c=>comments.push({post:p,comment:c})));
    comments.sort((a,b)=>b.comment.createdAt-a.comment.createdAt);
    return `${header('互动记录','ACTIVITY')}<main class="lr-cm-scroll"><section class="lr-cm-page-intro"><div class="lr-cm-eyebrow">YOUR COMMUNITY ACTIVITY</div><h1>互动<br><em>记录。</em></h1><p>你在本机社区留下的评论与回应。</p></section><section class="lr-cm-section"><div class="lr-cm-post-list">${comments.length?comments.map(x=>`<button class="lr-cm-activity-item" data-c-action="detail" data-id="${esc(x.post.id)}"><b>${esc(x.comment.author||profile.name)}</b><p>${esc(x.comment.body)}</p><small>评论于：${esc(x.post.title)}</small></button>`).join(''):emptyState('暂时没有互动','在帖子下留言后，会在这里看到记录。')}</div></section></main>${bottomNav('activity')}`;
  }
  function render() {
    cleanupUrls();
    const root=$('lrCommunityApp'); if(!root)return;
    let content='';
    if(page==='home')content=homeView();
    else if(page==='groups')content=groupsView();
    else if(page==='category')content=categoryView();
    else if(page==='detail')content=detailView();
    else if(page==='compose')content=composeView();
    else if(page==='profile')content=profileView();
    else if(page==='activity')content=activityView();
    else content=homeView();
    const shell=root.querySelector('.lr-cm-shell') || root;
    shell.innerHTML=content;
    root.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.closest('.lr-cm-image')?.classList.add('broken'),{once:true}));
  }
  function open() {
    const root=$('lrCommunityApp'); if(!root)return;
    root.hidden=false; document.body.classList.add('lr-community-open');
    document.body.dataset.lrCommunityPrevOverflow=document.body.style.overflow||'';
    document.body.style.overflow='hidden';
    page='home';activeCategory='';activePost='';sortMode='new';searchTerm='';
    refreshPosts().then(render).catch(e=>{console.error(e);render();});
  }
  function close() {
    const root=$('lrCommunityApp'); if(!root)return;
    root.hidden=true;document.body.classList.remove('lr-community-open');
    document.body.style.overflow=document.body.dataset.lrCommunityPrevOverflow||'';
    cleanupUrls();
  }
  function go(next) { page=next; render(); const sc=$('lrCommunityApp')?.querySelector('.lr-cm-scroll'); if(sc)sc.scrollTop=0; }
  function toast(msg) {
    const old=$('toast');
    if(old){old.textContent=msg;old.classList.add('show');clearTimeout(window.__lrCmToast);window.__lrCmToast=setTimeout(()=>old.classList.remove('show'),2000);}
    else alert(msg);
  }
  async function chooseCategory(id) { activeCategory=id;sortMode='new';go('category'); }
  async function publish() {
    const title=$('lrCmTitle')?.value.trim()||'';
    const body=$('lrCmBody')?.value.trim()||'';
    const cat=$('lrCmCategory')?.value||'life';
    if(!title&&!body&&!draftFiles.length){toast('先写一点内容或添加照片吧。');return;}
    if(!title){toast('请先填写帖子标题。');$('lrCmTitle')?.focus();return;}
    if(!body&&!draftFiles.length){toast('正文或照片至少填写一项。');return;}
    const post={id:'cm-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),category:cat,title,body,author:profile.name||'社区成员',createdAt:Date.now(),updatedAt:Date.now(),likes:0,liked:false,favorite:false,images:draftFiles.map(f=>({blob:f,name:f.name,type:f.type})),comments:[]};
    try { await putPost(post); await refreshPosts(); draftFiles=[]; activePost=post.id; page='detail';render();toast('发布成功，已保存在本机 ♡'); }
    catch(e){console.error(e);toast('保存失败，可能是浏览器存储空间不足。');}
  }
  async function togglePost(id,field) {
    const p=posts.find(x=>x.id===id);if(!p)return;
    if(field==='liked'){p.liked=!p.liked;p.likes=Math.max(0,(Number(p.likes)||0)+(p.liked?1:-1));}
    else p.favorite=!p.favorite;
    await putPost(p);await refreshPosts();render();
  }
  let replyTarget=null;
  async function addComment() {
    const input=$('lrCmCommentInput'), body=input?.value.trim();if(!body)return;
    const p=posts.find(x=>x.id===activePost);if(!p)return;
    p.comments=Array.isArray(p.comments)?p.comments:[];
    const target=replyTarget?p.comments.find(c=>c.id===replyTarget.id):null;
    p.comments.push({id:'c-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),author:profile.name,body,replyTo:target?.id||'',replyToName:target?.author||'',createdAt:Date.now()});
    replyTarget=null;await putPost(p);await refreshPosts();render();
  }
  function beginReply(id,name){replyTarget={id,name};const hint=$('lrCmReplyHint');if(hint){hint.hidden=false;hint.textContent='正在回复 @'+name+' · 点击输入框即可编辑';} $('lrCmCommentInput')?.focus();}
  async function deleteCurrentPost(id) {
    const p=posts.find(x=>x.id===id);if(!p)return;
    if(p.author!==profile.name){toast('只能删除自己发布的帖子。');return;}
    if(!confirm('确定删除这篇帖子吗？'))return;
    await deletePost(id);await refreshPosts();page='home';render();toast('帖子已删除。');
  }
  function showImage(postId,index) {
    const p=posts.find(x=>x.id===postId), im=p?.images?.[index];if(!im)return;
    const src=im.dataUrl||(im.blob?imageUrl(im.blob):'');if(!src)return;
    const light=document.createElement('div');light.className='lr-cm-lightbox';light.innerHTML=`<button aria-label="关闭">×</button><img src="${src}" alt="帖子图片">`;
    light.addEventListener('click',()=>light.remove());light.querySelector('img').addEventListener('click',e=>e.stopPropagation());$('lrCommunityApp').appendChild(light);
  }
  function previewFiles() {
    const box=$('lrCmPreview');if(!box)return;
    cleanupUrls();
    box.innerHTML=draftFiles.map((f,i)=>{const u=URL.createObjectURL(f);objectUrls.push(u);return `<div><img src="${u}" alt=""><button type="button" data-c-action="remove-image" data-id="${i}">×</button></div>`}).join('');
  }
  function readAppSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return {}}}
  function aiConfig(){const a=readAppSettings();return {base:String(a.apiBase||'').replace(/\/+$/,''),key:a.apiKey||'',model:a.apiModel||'',people:Array.isArray(a.people)?a.people:[]};}
  async function askCommunityAI(prompt,system='你是一个沉浸式虚拟社区的内容引擎。必须只输出合法 JSON，不要 Markdown。'){
    const cfg=aiConfig();if(!cfg.base||!cfg.key||!cfg.model)throw new Error('请先到 LOVE RECORD 设置 → AI / API 连接模型。');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    try{const res=await fetch(cfg.base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key,'Accept':'application/json'},body:JSON.stringify({model:cfg.model,stream:false,messages:[{role:'system',content:system},{role:'user',content:prompt}]}),signal:controller.signal});const raw=await res.text();if(!res.ok)throw new Error('HTTP '+res.status+'：'+raw.slice(0,260));const data=JSON.parse(raw);let txt=data.choices?.[0]?.message?.content||'';if(Array.isArray(txt))txt=txt.map(x=>x.text||'').join('');txt=String(txt).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();return JSON.parse(txt);}finally{clearTimeout(timer);}
  }
  async function askCommunityAIMultimodal(prompt, images, system='你是虚拟社区的内容引擎。只输出合法 JSON。'){
    const cfg=aiConfig();if(!cfg.base||!cfg.key||!cfg.model)throw new Error('请先连接 API。');
    const content=[{type:'text',text:prompt}];
    for(const image of (images||[]).slice(0,4)){
      const data=await imageAsDataURL(image); if(data)content.push({type:'image_url',image_url:{url:data}});
    }
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{const res=await fetch(cfg.base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key,'Accept':'application/json'},body:JSON.stringify({model:cfg.model,stream:false,messages:[{role:'system',content:system},{role:'user',content}]}),signal:controller.signal});const raw=await res.text();if(!res.ok)throw new Error('HTTP '+res.status+'：'+raw.slice(0,240));const data=JSON.parse(raw);let txt=data.choices?.[0]?.message?.content||'';if(Array.isArray(txt))txt=txt.map(x=>x.text||'').join('');txt=String(txt).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();return JSON.parse(txt);}finally{clearTimeout(timer);}
  }
  function imageAsDataURL(image){return new Promise(resolve=>{if(image?.dataUrl){resolve(image.dataUrl);return;}const blob=image?.blob||image;if(!(blob instanceof Blob)){resolve('');return;}const reader=new FileReader();reader.onload=()=>{const im=new Image();im.onload=()=>{const max=1200,scale=Math.min(1,max/Math.max(im.width,im.height)),canvas=document.createElement('canvas');canvas.width=Math.round(im.width*scale);canvas.height=Math.round(im.height*scale);canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.78));};im.onerror=()=>resolve('');im.src=reader.result;};reader.onerror=()=>resolve('');reader.readAsDataURL(blob);});}
  function fixedCharacterPool(cfg){return cfg.people.map(p=>({name:p.name||p.nickname||'社区熟人',role:p.role||p.identity||'',personality:p.personality||'',speech:p.speech||p.speaking||'',background:p.background||'',instructions:p.instructions||''}));}
  async function generateCommunity(mode='normal'){
    if(aiBusy)return;aiBusy=true;const status=$('lrCmAiStatus');if(status)status.textContent='AI 正在构思社区动态…';
    try{
      const cfg=aiConfig(), enabled=Array.isArray(profile.communityContactsEnabled)?profile.communityContactsEnabled:cfg.people.map(p=>p.id), fixed=fixedCharacterPool(cfg).filter((p,i)=>enabled.includes(cfg.people[i]?.id));const count=mode==='world'?5:4;
      const lore=profile.worldSetting||'一个现代生活兴趣社区。氛围自然、真实、温暖，有日常感。';
      const recent=posts.slice(0,18).map(p=>({author:p.author,title:p.title,body:String(p.body||'').slice(0,360),category:p.category,comments:(p.comments||[]).slice(-2).map(c=>({author:c.author,body:c.body}))}));
      const prompt=`社区世界观：\n${lore}\n\n角色长期记忆（请延续，不要随意推翻）：${JSON.stringify(aiMemory)}\n最近社区动态（避免重复，并自然延续关系）：${JSON.stringify(recent)}\n\n固定角色（优先使用这些人物，保持人设一致）：${JSON.stringify(fixed)}\n\n请生成${count}条新帖子。固定角色与随机网友都要出现：固定角色从人物列表中选择；随机网友则新建自然的昵称、身份与简短性格，不要使用现实名人；若近期动态中已有随机网友，允许他们以相同昵称再次出现，逐渐形成熟人感。帖子要像真实网友分享生活，不要像AI说明文；不同帖子主题分布在生活日记、音乐分享、兴趣交流、情感树洞、影视讨论、游戏专区。不要替社区主人${profile.name}发言、行动或编造其经历。每条帖子包含 category（life/music/interest/heart/film/game）、author、authorType（fixed/random）、title、body、likes（0-30，视互动兴趣自动产生）、comments（0-2条，含 author/body/authorType）。评论者可为固定角色或随机网友，互动自然，避免每个人都同意。每篇帖子另给出likedBy数组，表示实际点赞的AI网友昵称（0-5个，不能重复）。另给出followsYou数组，表示这轮有0-3个AI网友主动关注社区主人，每项是简短昵称。同时返回memoryUpdates数组，每项包含name和memory，记录这轮互动后值得长期保留的经历、兴趣变化或关系进展。输出JSON对象：{posts:[...],followsYou:[...],memoryUpdates:[...]}。`;
      const result=await askCommunityAI(prompt,'你负责运营一个持续生活的虚拟兴趣社区。固定角色必须尊重人物设定，随机网友需要有差异化声音。所有输出严格为JSON对象。');
      const arr=Array.isArray(result)?result:(Array.isArray(result.posts)?result.posts:[]);if(!arr.length)throw new Error('模型没有返回可用帖子，请重试。');
      for(const x of arr.slice(0,7)){
        const author=String(x.author||'新来的网友').slice(0,32),cat=CATS.some(c=>c.id===x.category)?x.category:'interest';
        const comments=(Array.isArray(x.comments)?x.comments:[]).slice(0,4).map(c=>({id:'c-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),author:String(c.author||'路过的网友').slice(0,32),authorType:c.authorType==='fixed'?'fixed':'random',body:String(c.body||'').slice(0,1200),createdAt:Date.now()+Math.floor(Math.random()*1000)})).filter(c=>c.body);
        await putPost({id:'ai-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),category:cat,title:String(x.title||'今天的随手记录').slice(0,100),body:String(x.body||'').slice(0,12000),author,authorType:x.authorType==='fixed'?'fixed':'random',createdAt:Date.now()+Math.floor(Math.random()*1000),updatedAt:Date.now(),likes:Math.max(0,Math.min(999,Number(x.likes)||0)),liked:false,favorite:false,images:[],comments});
      }
      const updates=Array.isArray(result.memoryUpdates)?result.memoryUpdates:[];updates.forEach(m=>{if(m.name&&m.memory)aiMemory[String(m.name).slice(0,40)]=String(m.memory).slice(0,900);});try{localStorage.setItem('love-record-community-ai-memory-v1',JSON.stringify(aiMemory));}catch(e){console.warn('AI memory storage full',e);}
      const followers=Array.isArray(result.followsYou)?result.followsYou:[];profile.aiFollowers=[...new Set([...(profile.aiFollowers||[]),...followers.map(x=>String(x).slice(0,32)).filter(Boolean)])];saveProfile();await refreshPosts();page='home';render();toast(`社区更新啦！新增 ${Math.min(arr.length,7)} 条动态 ♡`);
    }catch(e){console.error('[Community AI]',e);if(status)status.textContent='生成失败：'+e.message;toast('AI 生成失败：'+e.message);}finally{aiBusy=false;}
  }
  async function generateAIComments(){
    const p=posts.find(x=>x.id===activePost);if(!p||aiBusy)return;p.comments=Array.isArray(p.comments)?p.comments:[];aiBusy=true;
    const btn=document.querySelector('[data-c-action="ai-comments"]');if(btn){btn.disabled=true;btn.textContent='正在生成评论…';}
    const hint=document.querySelector('.lr-cm-section-head .lr-cm-ai-comment');
    try{
      if(hint)hint.textContent='✦ AI 正在阅读帖子与图片…';
      const cfg=aiConfig(),enabled=Array.isArray(profile.communityContactsEnabled)?profile.communityContactsEnabled:cfg.people.map(x=>x.id),fixed=fixedCharacterPool(cfg).filter((x,i)=>enabled.includes(cfg.people[i]?.id));
      const prompt=`社区世界观：${profile.worldSetting||'现代兴趣社区'}
帖子作者：${p.author}
标题：${p.title}
正文：${p.body}
现有评论：${JSON.stringify(p.comments||[])}
固定联系人（仅允许使用这些角色）：${JSON.stringify(fixed)}
请先认真观察随消息附带的帖子图片，识别画面中可见的主体、场景、动作、氛围及明显物品；评论必须准确结合图片和正文，不得臆测图片中无法确认的身份或关系。生成2-4条自然、有差异的评论，可由已启用固定角色或随机网友发表。若已有评论，允许针对某条评论进行回复，使用replyToName字段；否则留空。不要使用未启用联系人。不要替社区主人发言。返回JSON数组，每项包含author、authorType、body、replyToName。`;
      const arr=await askCommunityAIMultimodal(prompt,p.images||[],'你是能理解图片的虚拟社区网友。先观察图片再评论，必须具体、贴合图片；只输出JSON数组。');
      (Array.isArray(arr)?arr:[]).slice(0,4).forEach(c=>{if(c.body)p.comments.push({id:'c-'+Date.now()+'-'+Math.random(),author:String(c.author||'社区网友').slice(0,32),authorType:c.authorType==='fixed'?'fixed':'random',body:String(c.body).slice(0,1200),replyToName:String(c.replyToName||'').slice(0,32),createdAt:Date.now()});});
      await putPost(p);await refreshPosts();render();toast('网友们来回复啦 ♡');
    }catch(e){console.error('[Community comments]',e);toast('评论生成失败：'+e.message);if(hint)hint.textContent='生成失败，可检查 API 或模型是否支持图片理解后重试';}
    finally{aiBusy=false;}
  }
  function saveParticipants(){const people=readAppSettings().people||[];profile.communityContactsEnabled=Array.from(document.querySelectorAll('.lr-cm-participant input:checked')).map(x=>x.value).filter(id=>people.some(p=>p.id===id));saveProfile();toast('参与联系人名单已保存 ♡');}
  function saveWorld(){profile.worldSetting=$('lrCmWorldSetting')?.value.trim()||'';saveProfile();toast('社区世界观已保存 ♡');}
  async function saveProfileForm(){const name=$('lrCmProfileName')?.value.trim();if(!name){toast('用户名不能为空');return;}const oldName=profile.name;profile.name=name;profile.bio=$('lrCmProfileBio')?.value.trim()||'';saveProfile();for(const p of posts){if(p.author===oldName){p.author=name;await putPost(p);}}await refreshPosts();render();toast('个人主页已更新 ♡');}
  function loadProfileImage(file,key){if(!file)return;if(!file.type.startsWith('image/')){toast('请选择图片文件');return;}if(file.size>10*1024*1024){toast('图片请控制在 10MB 以内');return;}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=key==='avatar'?240:900,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);profile[key]=canvas.toDataURL('image/jpeg',.55);saveProfile();render();toast(key==='avatar'?'头像已更新':'背景封面已更新');};img.onerror=()=>toast('图片读取失败，请换一张试试');img.src=reader.result;};reader.readAsDataURL(file);}
  async function handleAction(btn) {
    const a=btn.dataset.cAction,id=btn.dataset.id;
    if(a==='close'){close();return;}
    if(a==='home'){go('home');return;}
    if(a==='groups'){go('groups');return;}
    if(a==='profile'){go('profile');return;}
    if(a==='activity'){go('activity');return;}
    if(a==='category'){await chooseCategory(id);return;}
    if(a==='sort'){sortMode=id;render();return;}
    if(a==='compose'){activeCategory=btn.dataset.category||activeCategory;draftFiles=[];go('compose');return;}
    if(a==='back'){if(activePost){activePost='';go(activeCategory?'category':'home')}else go('home');return;}
    if(a==='detail'){activePost=id;go('detail');return;}
    if(a==='like'){await togglePost(id,'liked');return;}
    if(a==='favorite'){await togglePost(id,'favorite');return;}
    if(a==='delete'){await deleteCurrentPost(id);return;}
    if(a==='choose-images'){$('lrCmFiles')?.click();return;}
    if(a==='remove-image'){draftFiles.splice(Number(id),1);previewFiles();return;}
    if(a==='view-image'){showImage(btn.dataset.post,Number(btn.dataset.index));return;}
    if(a==='publish'){await publish();return;}
    if(a==='search-focus'){const q=$('lrCmSearch');q?.focus();return;}
    if(a==='ai-generate'){await generateCommunity('normal');return;}
    if(a==='ai-comments'){await generateAIComments();return;}
    if(a==='reply-comment'){beginReply(id,btn.dataset.name||'网友');return;}
    if(a==='save-participants'){saveParticipants();return;}
    if(a==='save-profile'){saveProfileForm();return;}
    if(a==='save-world'){saveWorld();return;}
    if(a==='generate-world'){saveWorld();await generateCommunity('world');return;}
    if(a==='edit-profile'){go('profile');return;}
  }
  function ensureRoot() {
    if($('lrCommunityApp'))return;
    const root=document.createElement('div');root.id='lrCommunityApp';root.hidden=true;
    root.innerHTML='<div class="lr-cm-shell" aria-label="LOVE RECORD 社区"></div>';
    document.body.appendChild(root);
    root.addEventListener('click',async e=>{
      const btn=e.target.closest('[data-c-action]');if(btn){e.preventDefault();await handleAction(btn);return;}
    });
    root.addEventListener('submit',async e=>{
      if(e.target.id==='lrCmCommentForm'){e.preventDefault();await addComment();}
    });
    root.addEventListener('change',e=>{
      if(e.target.id==='lrCmAvatarFile'){loadProfileImage(e.target.files?.[0],'avatar');return;}
      if(e.target.id==='lrCmCoverFile'){loadProfileImage(e.target.files?.[0],'cover');return;}
      if(e.target.id==='lrCmFiles'){ 
        const files=Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/'));
        const room=Math.max(0,6-draftFiles.length);
        const chosen=files.slice(0,room);
        const tooBig=chosen.find(f=>f.size>10*1024*1024);
        if(tooBig){toast('单张图片请控制在 10MB 以内。');e.target.value='';return;}
        draftFiles=draftFiles.concat(chosen);previewFiles();e.target.value='';
        if(files.length>room)toast('最多添加 6 张图片。');
      }
    });
    root.addEventListener('input',e=>{
      if(e.target.id==='lrCmSearch'){searchTerm=e.target.value;const list=root.querySelector('.lr-cm-post-list');if(list){const data=visiblePosts();list.innerHTML=data.length?data.map(p=>postCard(p)).join(''):emptyState('没有找到相关帖子','换个关键词试试看。');}}
    });
  }
  function installStyle() {
    if($('lrCommunityStyle'))return;
    const style=document.createElement('style');style.id='lrCommunityStyle';style.textContent=CSS;document.head.appendChild(style);
  }
  const CSS = `
#lrCommunityApp{position:fixed;inset:0;z-index:10020;background:#f7f6f2;color:#292b28;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC",sans-serif;overflow:hidden}
#lrCommunityApp[hidden]{display:none!important}#lrCommunityApp:not([hidden]){display:block}body.lr-community-open{overflow:hidden!important}
#lrCommunityApp *{box-sizing:border-box}#lrCommunityApp button,#lrCommunityApp input,#lrCommunityApp textarea,#lrCommunityApp select{font:inherit}
#lrCommunityApp button{cursor:pointer}#lrCommunityApp .lr-cm-shell{height:100%;max-width:760px;margin:0 auto;position:relative;background:#f7f6f2;display:flex;flex-direction:column}
.lr-cm-header{height:68px;flex:none;padding:calc(8px + env(safe-area-inset-top)) 20px 8px;display:flex;align-items:center;justify-content:space-between;background:rgba(250,249,246,.96);border-bottom:1px solid #e9e7df;z-index:3}
.lr-cm-brand{border:0;background:none;display:flex;align-items:center;gap:10px;text-align:left;color:#343830;padding:0}
.lr-cm-brand-mark{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#dce7dc;color:#4d6852;font:italic 22px Georgia,serif}
.lr-cm-brand b{display:block;font-size:10px;letter-spacing:2px;font-weight:650}.lr-cm-brand small{display:block;font-size:9px;letter-spacing:2px;color:#96978e;margin-top:3px}
.lr-cm-header-actions{display:flex;gap:8px;align-items:center}.lr-cm-header-actions button{width:36px;height:36px;border:1px solid #e6e5dc;background:#fff;border-radius:50%;font-size:20px;color:#656b60}.lr-cm-header-actions button:last-child{font-size:24px;font-weight:300}
.lr-cm-scroll{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:0 20px calc(104px + env(safe-area-inset-bottom));scrollbar-width:thin}
.lr-cm-welcome{padding:35px 2px 27px}.lr-cm-eyebrow{font-size:9px;letter-spacing:2.5px;color:#93968a;font-weight:650}
.lr-cm-welcome h1,.lr-cm-page-intro h1,.lr-cm-compose h1{font:400 34px/1.27 Georgia,"Noto Serif SC",serif;letter-spacing:.02em;margin:13px 0 10px;color:#353b33}
.lr-cm-welcome h1 em,.lr-cm-page-intro h1 em,.lr-cm-compose h1 em{font-style:normal;color:#78907a}
.lr-cm-welcome>p,.lr-cm-page-intro>p{font-size:13px;color:#85877e;line-height:1.8;margin:0 0 22px}
.lr-cm-search-wrap{display:flex;align-items:center;gap:9px;margin-top:10px;padding:0 13px;height:42px;border:1px solid #e6e7df;border-radius:12px;background:rgba(255,255,255,.7);color:#9a9d91}.lr-cm-search-wrap span{font-size:21px}.lr-cm-search-wrap input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#535a50;font-size:11px}
.lr-cm-write{width:100%;display:flex;align-items:center;gap:12px;text-align:left;padding:13px 15px;border:1px solid #e6e7df;border-radius:15px;background:#fff;box-shadow:0 5px 20px rgba(65,75,59,.035);color:#5e655b}
.lr-cm-write>span:first-child{width:34px;height:34px;border-radius:11px;background:#e8eee6;color:#648067;display:grid;place-items:center;font-size:22px}
.lr-cm-write b,.lr-cm-write small{display:block}.lr-cm-write b{font-size:12px;font-weight:600}.lr-cm-write small{font-size:10px;color:#a2a49b;margin-top:4px}.lr-cm-write i{margin-left:auto;font-style:normal;color:#a0a596;font-size:18px}
.lr-cm-section{margin:8px 0 30px}.lr-cm-section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:14px}.lr-cm-section-head small{font-size:9px;letter-spacing:2px;color:#9b9d91}.lr-cm-section-head h2{font:400 20px Georgia,"Noto Serif SC",serif;margin:5px 0 0;color:#3b4039}.lr-cm-section-head>button{border:0;background:none;color:#81917d;font-size:11px;padding:4px}
.lr-cm-cats{display:grid;grid-template-columns:1fr 1fr;gap:9px}.lr-cm-cat{min-height:76px;border:1px solid transparent;border-radius:13px;padding:12px 10px;display:flex;align-items:center;gap:9px;text-align:left;color:#4b5349}
.lr-cm-cat-icon{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font:20px Georgia,serif;background:rgba(255,255,255,.55)}
.lr-cm-cat-copy{min-width:0;flex:1}.lr-cm-cat-copy b{display:block;font-size:12px;font-weight:600}.lr-cm-cat-copy small{display:block;font-size:8px;letter-spacing:1px;color:#92968a;margin-top:4px;white-space:nowrap}.lr-cm-cat-arrow{font-size:13px;color:#a1a697}
.lr-cm-cat.sage,.lr-cm-category-hero.sage{background:#e9efe7}.lr-cm-cat.sand,.lr-cm-category-hero.sand{background:#f1eee5}.lr-cm-cat.lilac,.lr-cm-category-hero.lilac{background:#eeeaf1}.lr-cm-cat.rose,.lr-cm-category-hero.rose{background:#f3e9e8}.lr-cm-cat.blue,.lr-cm-category-hero.blue{background:#e9edf0}.lr-cm-cat.ochre,.lr-cm-category-hero.ochre{background:#f0ece3}
.lr-cm-local-pill{font-size:9px;color:#70836e;background:#e8eee6;border-radius:99px;padding:5px 9px}
.lr-cm-feed-tabs{display:flex;gap:18px;border-bottom:1px solid #e7e6de;margin-bottom:4px}.lr-cm-feed-tabs button{border:0;background:none;padding:8px 2px 10px;color:#a0a196;font-size:12px;position:relative}.lr-cm-feed-tabs button.on{color:#526d54;font-weight:650}.lr-cm-feed-tabs button.on:after{content:"";position:absolute;bottom:-1px;left:0;right:0;height:2px;background:#829780;border-radius:3px}
.lr-cm-post-list{display:grid}.lr-cm-post{padding:17px 0 13px;border-bottom:1px solid #e8e7df}.lr-cm-post-meta{display:flex;align-items:center;gap:9px;margin-bottom:11px}.lr-cm-avatar{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#e5e9df;color:#71836d;font:14px Georgia,serif;flex:none}.lr-cm-author{font-size:11px;color:#555c52;flex:1}.lr-cm-author small{display:block;font-size:9px;color:#a2a398;margin-top:3px}.lr-cm-tag{border:0;background:#edf0e9;color:#75836d;padding:5px 8px;border-radius:99px;font-size:9px}
.lr-cm-post-open{display:block;width:100%;text-align:left;padding:0;border:0;background:none;color:inherit}.lr-cm-post-open h3{font-size:16px;font-weight:600;line-height:1.55;margin:0 0 6px;color:#343a33}.lr-cm-post-open p{font-size:12px;line-height:1.85;color:#73776e;margin:0;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.lr-cm-images{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:12px}.lr-cm-images.single{grid-template-columns:minmax(0,75%)}.lr-cm-image{padding:0;border:0;background:#e9e9e2;border-radius:9px;overflow:hidden;aspect-ratio:1/1}.lr-cm-image img{width:100%;height:100%;object-fit:cover;display:block}.lr-cm-images.single .lr-cm-image{aspect-ratio:4/3}
.lr-cm-post-actions{display:flex;align-items:center;gap:20px;margin-top:12px}.lr-cm-post-actions button{border:0;background:none;padding:2px 0;color:#92968b;font-size:10px}.lr-cm-post-actions button.active{color:#789478}
.lr-cm-empty{padding:35px 12px;text-align:center;color:#96998f}.lr-cm-empty>span{display:block;font:28px Georgia,serif;color:#9aaa94;margin-bottom:9px}.lr-cm-empty b{font-size:13px;color:#697065}.lr-cm-empty p{font-size:11px;line-height:1.7}.lr-cm-primary{border:0;background:#728a72;color:#fff;border-radius:10px;padding:10px 17px;font-size:11px}.lr-cm-secondary{border:1px solid #dfe2d8;background:#fff;color:#777e72;border-radius:10px;padding:10px 17px;font-size:11px}
.lr-cm-local-note{text-align:center;font-size:9px;color:#b0b1a7;padding:5px 0 15px}
.lr-cm-ai-panel{display:grid;grid-template-columns:1fr auto;gap:7px 10px;align-items:center;padding:13px;margin:12px 0 15px;background:#edf1e9;border:1px solid #e0e7dc;border-radius:14px}.lr-cm-ai-panel b{display:block;font-size:12px;color:#53634f}.lr-cm-ai-panel small{display:block;font-size:9px;color:#8b9585;margin-top:4px}.lr-cm-ai-panel .lr-cm-primary{font-size:10px;padding:9px 11px;white-space:nowrap}.lr-cm-ai-status{grid-column:1/-1;font-size:9px;color:#899486}.lr-cm-profile-cover{min-height:190px;margin:17px 0 0;border-radius:17px;background-size:cover;background-position:center;display:flex;align-items:end;padding:18px;gap:13px;color:#fff}.lr-cm-profile-avatar{width:68px;height:68px;flex:none;border-radius:50%;border:3px solid rgba(255,255,255,.9);background:#e7ece2;color:#687b65;display:grid;place-items:center;font:27px Georgia,serif;overflow:hidden}.lr-cm-profile-avatar img{width:100%;height:100%;object-fit:cover}.lr-cm-profile-cover-name{min-width:0}.lr-cm-profile-cover-name h1{font:400 25px Georgia,'Noto Serif SC',serif;margin:5px 0}.lr-cm-profile-cover-name p{font-size:11px;margin:0;line-height:1.5;color:rgba(255,255,255,.9)}.lr-cm-profile-cover-name .lr-cm-eyebrow{color:rgba(255,255,255,.75)}.lr-cm-profile-stats{display:grid;grid-template-columns:repeat(4,1fr);padding:15px 0;border-bottom:1px solid #e7e6df}.lr-cm-profile-stats div{text-align:center;border-right:1px solid #e7e6df}.lr-cm-profile-stats div:last-child{border:0}.lr-cm-profile-stats b{display:block;font:20px Georgia,serif;color:#586b55}.lr-cm-profile-stats small{font-size:9px;color:#96998f}.lr-cm-profile-edit{padding:18px 0 20px;border-bottom:1px solid #e7e6df}.lr-cm-profile-edit label{display:block;font-size:10px;color:#82877c;margin:12px 0 6px}.lr-cm-profile-edit input,.lr-cm-profile-edit textarea{width:100%;border:1px solid #e2e4dc;border-radius:10px;background:#fff;padding:11px;color:#444b42;font-size:12px;outline:none}.lr-cm-profile-edit textarea{resize:vertical;line-height:1.7}.lr-cm-profile-upload-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.lr-cm-profile-upload-row input{font-size:9px;padding:8px}.lr-cm-profile-edit>.lr-cm-primary{margin-top:13px}.lr-cm-world-setting>p{font-size:11px;color:#8b8e84;line-height:1.7}.lr-cm-world-setting textarea{min-height:130px}.lr-cm-world-hint{display:block;color:#a1a398;font-size:9px;line-height:1.6;margin-top:10px}.lr-cm-ai-comment{border:1px solid #dfe5da;background:#edf1e9;color:#657b62;border-radius:99px;padding:7px 10px;font-size:9px;white-space:nowrap}

.lr-cm-bottom{position:absolute;left:0;right:0;bottom:0;padding:9px 12px calc(9px + env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(5,1fr);background:rgba(250,249,246,.96);border-top:1px solid #e7e6df;backdrop-filter:blur(15px);z-index:4}
.lr-cm-bottom button{border:0;background:none;color:#a0a397;display:flex;flex-direction:column;align-items:center;gap:3px;padding:2px;font-size:9px}.lr-cm-bottom button i{font-style:normal;font-size:20px;line-height:1.1}.lr-cm-bottom button.on{color:#637c62}.lr-cm-bottom .lr-cm-create-nav i{width:29px;height:25px;display:grid;place-items:center;border-radius:8px;background:#718a72;color:#fff;font-size:20px}
.lr-cm-page-intro{padding:34px 2px 22px}.lr-cm-groups-list{padding-bottom:25px}.lr-cm-group-row{display:flex;align-items:center;gap:13px;padding:15px 0;border-bottom:1px solid #e7e6df}.lr-cm-group-art{width:57px;height:57px;border-radius:14px;display:grid;place-items:center;font:26px Georgia,serif;color:#697d69;flex:none}.lr-cm-group-info{flex:1;min-width:0}.lr-cm-group-info small{font-size:8px;letter-spacing:1.5px;color:#9b9e93;display:block}.lr-cm-group-info b{font-size:14px;display:block;margin-top:4px;font-weight:600}.lr-cm-group-info p{font-size:10px;color:#8b8e84;margin:4px 0 0;line-height:1.5}.lr-cm-group-row>button{border:0;background:none;color:#778c74;font-size:10px;white-space:nowrap}
.lr-cm-category-hero{margin:22px 0 24px;border-radius:18px;padding:22px 20px;color:#4b5549}.lr-cm-category-hero>span{float:right;font:42px Georgia,serif;opacity:.6}.lr-cm-category-hero h1{font:400 28px Georgia,"Noto Serif SC",serif;margin:9px 0}.lr-cm-category-hero p{font-size:12px;color:#7e8579;line-height:1.7;margin:0 0 15px}.lr-cm-category-hero button{border:1px solid rgba(103,126,100,.3);border-radius:99px;background:rgba(255,255,255,.55);color:#647c62;padding:8px 12px;font-size:10px}
.lr-cm-back{border:0;background:none;color:#87917f;padding:16px 0 8px;font-size:12px}.lr-cm-detail{padding:10px 0 18px;border-bottom:1px solid #e6e5de}.lr-cm-detail h1{font:400 25px/1.45 Georgia,"Noto Serif SC",serif;margin:15px 0;color:#343a33}.lr-cm-detail-body{font-size:14px;line-height:2;color:#555d52;white-space:normal;overflow-wrap:anywhere}
.lr-cm-comments{padding:22px 0}.lr-cm-comment{display:flex;gap:10px;padding:13px 0;border-bottom:1px solid #e8e7e0}.lr-cm-comment>div{flex:1}.lr-cm-comment b{font-size:11px;color:#596253}.lr-cm-comment small{display:block;font-size:9px;color:#a4a69b;margin-top:3px}.lr-cm-reply{border:0;background:transparent;color:#71866f;padding:5px 0;font-size:10px}.lr-cm-reply-hint{flex-basis:100%;font-size:10px;color:#71866f}.lr-cm-participant-list{display:grid;gap:8px;margin:12px 0}.lr-cm-participant{display:flex!important;align-items:center;gap:10px;padding:10px;border:1px solid #e3e6dd;border-radius:10px;background:#fff}.lr-cm-participant input{width:18px!important;height:18px!important;flex:none}.lr-cm-participant span{display:grid;gap:3px}.lr-cm-participant b{font-size:11px;color:#586253}.lr-cm-participant small{font-size:9px;color:#999}.lr-cm-comment p{font-size:12px;color:#73796f;line-height:1.7;margin:7px 0 0;white-space:pre-wrap}.lr-cm-no-comment{font-size:11px;color:#a1a397;padding:18px 0}.lr-cm-comment-form{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;position:sticky;bottom:0;padding:9px 0;background:#f7f6f2}.lr-cm-comment-form input{min-width:0;flex:1;border:1px solid #e1e3d9;border-radius:10px;padding:11px 12px;background:#fff;font-size:12px;outline:none}.lr-cm-comment-form button{border:0;border-radius:10px;background:#728a72;color:white;padding:0 15px;font-size:11px}
.lr-cm-compose{padding:27px 0}.lr-cm-compose h1{margin-bottom:25px}.lr-cm-compose label{display:block;font-size:11px;color:#687264;margin:18px 0 7px}.lr-cm-compose input,.lr-cm-compose textarea,.lr-cm-compose select{display:block;width:100%;border:1px solid #e1e3da;background:#fff;border-radius:11px;padding:12px;color:#454c43;font-size:13px;outline:none}.lr-cm-compose textarea{resize:vertical;line-height:1.8}.lr-cm-upload-area{display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding:13px;background:#eeefe9;border-radius:12px}.lr-cm-upload-area b,.lr-cm-upload-area small{display:block}.lr-cm-upload-area b{font-size:11px;color:#596452}.lr-cm-upload-area small{font-size:9px;color:#999d91;margin-top:4px}.lr-cm-upload-area button{border:1px solid #d7dfd3;background:#fff;border-radius:9px;padding:8px 11px;color:#71866e;font-size:10px}
.lr-cm-preview{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.lr-cm-preview>div{width:74px;height:74px;position:relative}.lr-cm-preview img{width:100%;height:100%;object-fit:cover;border-radius:9px}.lr-cm-preview button{position:absolute;right:-5px;top:-5px;width:22px;height:22px;border:0;border-radius:50%;background:#41473f;color:white}
.lr-cm-compose-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}.lr-cm-privacy{text-align:center;font-size:9px;color:#a4a69b;margin:20px 0}
.lr-cm-profile-hero{display:flex;align-items:center;gap:14px;padding:32px 0 20px}.lr-cm-profile-avatar{width:58px;height:58px;border-radius:50%;background:#e4ebdf;display:grid;place-items:center;color:#6f866b;font:24px Georgia,serif}.lr-cm-profile-hero>div:nth-child(2){flex:1}.lr-cm-profile-hero h1{font:400 23px Georgia,serif;margin:5px 0}.lr-cm-profile-hero p{font-size:10px;color:#909489;margin:0}.lr-cm-profile-hero>button{border:1px solid #e0e2d9;background:#fff;border-radius:9px;padding:7px 10px;color:#7c8575;font-size:10px}
.lr-cm-profile-stats{display:grid;grid-template-columns:repeat(3,1fr);padding:15px 0;border-top:1px solid #e7e6df;border-bottom:1px solid #e7e6df;margin-bottom:24px}.lr-cm-profile-stats div{text-align:center}.lr-cm-profile-stats b{display:block;font:21px Georgia,serif;color:#566b54}.lr-cm-profile-stats small{font-size:9px;color:#9b9e93}
.lr-cm-activity-item{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #e7e6df;background:none;padding:15px 0}.lr-cm-activity-item b{font-size:11px;color:#596452}.lr-cm-activity-item p{font-size:12px;color:#747a70;margin:7px 0}.lr-cm-activity-item small{font-size:9px;color:#9da194}
.lr-cm-lightbox{position:absolute;inset:0;background:rgba(20,22,19,.94);z-index:10;display:flex;align-items:center;justify-content:center;padding:24px}.lr-cm-lightbox img{max-width:100%;max-height:85%;object-fit:contain}.lr-cm-lightbox button{position:absolute;right:20px;top:calc(20px + env(safe-area-inset-top));width:38px;height:38px;border:1px solid #ffffff55;border-radius:50%;background:#ffffff22;color:white;font-size:23px}
.lr-cm-followers{padding:12px 0 4px;border-bottom:1px solid #e7e6df}.lr-cm-followers>b{display:block;font-size:10px;color:#697365;margin-bottom:8px}.lr-cm-followers span{display:flex;gap:6px;flex-wrap:wrap;font-size:9px;color:#a0a397}.lr-cm-followers i{font-style:normal;background:#edf0e9;border-radius:99px;padding:5px 8px;color:#71806d}.lr-cm-profile-cover .lr-cm-profile-avatar{width:68px;height:68px;border:3px solid rgba(255,255,255,.9);overflow:hidden}.lr-cm-profile-cover .lr-cm-profile-avatar img{width:100%;height:100%;object-fit:cover}.lr-cm-profile-stats{grid-template-columns:repeat(4,1fr);margin:0 0 8px;border-top:0}.lr-cm-profile-stats div{border-right:1px solid #e7e6df}.lr-cm-profile-stats div:last-child{border:0}
@media(min-width:600px){#lrCommunityApp .lr-cm-shell{border-left:1px solid #e6e5dc;border-right:1px solid #e6e5dc}.lr-cm-scroll{padding-left:28px;padding-right:28px}.lr-cm-cats{grid-template-columns:repeat(3,1fr)}}
@media(max-width:370px){.lr-cm-welcome h1{font-size:30px}.lr-cm-cat{padding:10px 8px;gap:6px}.lr-cm-cat-copy small{letter-spacing:.5px}.lr-cm-cat-icon{width:29px;height:29px}}
`;
  async function init() {
    getProfile(); ensureRoot(); installStyle();
    try { await openDatabase(); await loadProfileImages(); await refreshPosts(); await migrateLegacy(); }
    catch(e) { console.error('[Community] IndexedDB unavailable',e); toast('社区本地数据库暂时无法打开，请检查浏览器存储权限。'); }
    initialized=true;
  }
  document.addEventListener('click', async e => {
    const launch=e.target.closest('[data-launch-module="forum"],[data-open-module="forum"]');
    if(!launch)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!initialized) await init();
    open();
  }, true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('lrCommunityApp')?.hidden)close();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();