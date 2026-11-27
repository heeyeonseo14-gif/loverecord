/* LOVE RECORD · SPACE CITY v1
 * Offline-first pixel life simulation. No AI API is required for everyday city behavior.
 * Contacts/personas are read from the existing LOVE RECORD homepage as source snapshots.
 */
(()=>{
  'use strict';
  if(window.__LR_SPACE_CITY_V1__)return;
  window.__LR_SPACE_CITY_V1__=true;
  const $=id=>document.getElementById(id);
  const ROOT_ID='lrSpaceV2Directory';
  const DB_NAME='love-record-space-city-sim-v1';
  const STORE='worlds';
  const REGISTRY_ID='__registry__';
  const LEGACY_KEY='love-record-space-city-sim-fallback-v1';
  const now=()=>Date.now();
  const uid=(p='x')=>p+'-'+now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const BUILDINGS=[
    {id:'home',name:'居民公寓',icon:'🏠',type:'home',x:15,y:24,desc:'城市居民的日常居所',open:'全天'},
    {id:'cafe',name:'像素咖啡馆',icon:'☕',type:'cafe',x:47,y:20,desc:'喝咖啡、聊天和偶遇',open:'07:00–23:00'},
    {id:'park',name:'中央公园',icon:'🌳',type:'park',x:78,y:24,desc:'散步、运动与休闲',open:'全天'},
    {id:'school',name:'城市校园',icon:'🏫',type:'school',x:23,y:70,desc:'学习与社团活动',open:'07:00–18:00'},
    {id:'shop',name:'生活商店',icon:'🛍️',type:'shop',x:53,y:69,desc:'服装与日常用品',open:'09:00–22:00'},
    {id:'studio',name:'兴趣工作室',icon:'🎨',type:'studio',x:81,y:70,desc:'音乐、阅读和创作',open:'08:00–22:00'}
  ];
  const CLOTHES={
    hair:[['hair-short','清爽短发'],['hair-pixie','精灵短发'],['hair-bob','齐肩短发'],['hair-long','顺直长发'],['hair-wave','柔软波浪长发'],['hair-curl','蓬松卷发'],['hair-tie','低束发'],['hair-sidepart','侧分短发'],['hair-middle','中分长发'],['hair-ponytail','高马尾'],['hair-highponytail','活力高马尾'],['hair-lowponytail','低马尾'],['hair-twin','双马尾'],['hair-bun','丸子头'],['hair-halfup','半扎发'],['hair-braid','双侧编发'],['hair-frenchbraid','法式编发'],['hair-wolf','层次狼尾'],['hair-mullet','短狼尾'],['hair-curtain','八字刘海']],
    top:[['top-tee','基础 T 恤'],['top-shirt','日常衬衫'],['top-knit','柔软针织衫'],['top-hoodie','连帽卫衣'],['top-cardigan','开衫'],['top-sweater','宽松毛衣'],['top-blouse','荷叶边衬衫'],['top-turtleneck','高领针织'],['top-offshoulder','露肩上衣'],['top-sailor','水手领上衣'],['top-polo','POLO 衫'],['top-vest','针织背心']],
    bottom:[['bottom-pants','直筒长裤'],['bottom-jeans','牛仔裤'],['bottom-skirt','A 字半身裙'],['bottom-shorts','休闲短裤'],['bottom-wide','阔腿裤'],['bottom-cargo','工装裤'],['bottom-pleated','百褶短裙'],['bottom-long-skirt','飘逸长裙'],['bottom-leggings','贴身长裤'],['bottom-culottes','西装阔腿短裤']],
    dress:[['dress-simple','简约连衣裙'],['dress-knit','针织连衣裙'],['dress-shirt','衬衫裙'],['dress-floral','碎花连衣裙'],['dress-summer','夏日吊带裙'],['dress-pinafore','背带裙'],['dress-party','派对裙'],['dress-long','长款连衣裙']],
    outer:[['outer-none','不穿外套'],['outer-jacket','短夹克'],['outer-coat','长风衣'],['outer-cardigan','薄开衫'],['outer-denim','牛仔外套'],['outer-puffer','轻羽绒服'],['outer-blazer','西装外套'],['outer-hooded','连帽外套']],
    shoes:[['shoes-sneaker','休闲运动鞋'],['shoes-leather','复古皮鞋'],['shoes-boots','短靴'],['shoes-sandal','凉鞋'],['shoes-loafer','乐福鞋'],['shoes-canvas','帆布鞋']],
    accessory:[['acc-none','不佩戴配饰'],['acc-glasses','眼镜'],['acc-hat','帽子'],['acc-bag','斜挎包'],['acc-necklace','项链'],['acc-earrings','耳饰'],['acc-ribbon','发带蝴蝶结'],['acc-beret','贝雷帽']],
    sleep:[['sleep-set','睡衣套装'],['sleep-nightgown','柔软睡裙'],['sleep-tee','宽松家居服'],['sleep-pajama','棉质睡衣'],['sleep-robe','轻柔浴袍'],['sleep-shorts','短袖短裤套装']],
    face:[]
  };
  const REL_LABELS={friend:'朋友',lover:'恋人',spouse:'夫妻',family:'家人',parent:'父母 → 子女',child:'子女 → 父母',sibling:'兄弟姐妹',grandparent:'祖父母 / 外祖父母 → 孙辈',grandchild:'孙辈 → 祖父母 / 外祖父母',relative:'其他亲属'};
  const COLORS=['#d9b6c9','#a9c1d8','#b5c6a7','#e5c58d','#b9a4ce','#e6a9a9','#8b8797','#f1e4d0','#596a86','#a46e64','#f5f0e8','#33313a'];
  const DEFAULT_OUTFIT={hair:'hair-wave',hairColor:'#493d4c',skin:'#f1c9ac',top:'top-knit',topColor:'#c4a4d3',bottom:'bottom-pants',bottomColor:'#667b9a',dress:'',outer:'outer-none',outerColor:'#ad91bc',shoes:'shoes-sneaker',shoeColor:'#f2eee8',accessory:'acc-none',accessoryColor:'#d5b77e',sleepwear:'sleep-set'};
  const legacySpaceBridge=window.LRSpaceStoryBridge||{};
  let worlds=[],activeId='',world=null,dbPromise=null,tickTimer=null,openModal='',selectedResidentId='',controlResidentId='',currentScreen='map',interiorBuildingId='',toastTimer=null;
  const DEFAULT_SETTINGS={speed:'standard',customSpeed:20,paused:false,residentLimit:24,weather:'sunny',season:'spring',lastRealAt:now(),realMultiplier:20};
  function people(){
    try{if(window.LRSpaceStoryBridge?.getContacts)return window.LRSpaceStoryBridge.getContacts().filter(p=>p&&p.id&&p.name)}catch(e){}
    try{const s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}');return Array.isArray(s.people)?s.people.filter(p=>p&&p.id&&p.name&&p.id!=='p-yanyan'):[]}catch(e){return []}
  }
  function personas(){
    try{if(window.LRSpaceStoryBridge?.getSelfPersonas)return window.LRSpaceStoryBridge.getSelfPersonas()}catch(e){}
    try{const s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}');return Array.isArray(s.selfPersonas)?s.selfPersonas:[]}catch(e){return []}
  }
  function userName(){try{return String(state.name||'我')}catch(e){try{return JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}').name||'我'}catch(_){return '我'}}}
  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('当前浏览器不支持 IndexedDB'));return}
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'})};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('数据库打开失败'));
    }).catch(e=>{dbPromise=null;throw e});
    return dbPromise;
  }
  async function idbAll(){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
  async function idbPut(v){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
  async function idbDelete(id){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
  function notify(msg){const el=$('scToast');if(!el){if(window.toast)window.toast(msg);return}el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
  function stamp(d=world?.worldNow||now()){return new Date(d)}
  function dateLabel(d=world?.worldNow||now()){return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(d))}
  function timeLabel(d=world?.worldNow||now()){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date(d))}
  function currentResident(id){return (world?.residents||[]).find(r=>r.id===id)}
  function displayResident(r){return r?.name||'未命名居民'}
  function log(title,detail,kind='life',residentId=''){
    if(!world)return;
    world.logs=Array.isArray(world.logs)?world.logs:[];
    world.logs.unshift({id:uid('log'),at:world.worldNow||now(),title,detail,kind,residentId});
    if(world.logs.length>500)world.logs.length=500;
  }
  function addRelationship(a,b,type='friend',source='user',affinity=20){
    if(!world||a===b)return null;
    world.relationships=world.relationships||[];
    let rel=world.relationships.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));
    if(!rel){rel={id:uid('rel'),a,b,type,source,affinity,since:world.worldNow||now(),locked:type==='lover'||type==='spouse'};world.relationships.push(rel)}
    else {if(['parent','child','grandparent','grandchild'].includes(type)){rel.a=a;rel.b=b}rel.type=type;rel.source=source;rel.affinity=Math.max(rel.affinity||0,affinity);rel.locked=type==='lover'||type==='spouse';rel.updatedAt=world.worldNow||now()}
    return rel;
  }
  function relationship(a,b){return (world?.relationships||[]).find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a))}
  function relationAllowed(a,b,manual=false){
    if(!a||!b||a.id===b.id)return false;
    if(a.kind==='npc'&&b.kind==='npc')return true;
    if(a.kind==='user'&&(b.kind==='char'||b.kind==='npc'))return manual&&b.kind==='char';
    if(b.kind==='user'&&(a.kind==='char'||a.kind==='npc'))return manual&&a.kind==='char';
    if(a.kind==='char'&&b.kind==='char')return manual;
    return false;
  }
  function makeResident({kind='npc',sourceId='',name='新居民',age=24,role='',personality='',avatar='',gender='',outfit={},id}={}){
    const base=clone(DEFAULT_OUTFIT),input=outfit||{},merged={...base,...input};
    const seedText=String(name||'resident')+'|'+String(sourceId||id||kind),seed=[...seedText].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,17);
    const pick=(arr,offset=0)=>arr[(seed+offset)%arr.length];
    const hairStyles=['hair-short','hair-pixie','hair-bob','hair-long','hair-wave','hair-curl','hair-sidepart','hair-middle','hair-ponytail','hair-lowponytail','hair-twin','hair-bun','hair-halfup','hair-braid','hair-frenchbraid','hair-wolf','hair-mullet','hair-curtain'];
    const hairColors=['#493d4c','#5b473b','#3a4652','#80624e','#6b4a5a','#a16e48','#34323e','#9a7560'];
    const outfitColors=['#c4a4d3','#9eb9cf','#c5a58f','#b4c49f','#d5a5b0','#d0b776','#8c9daf','#c7b7a0'];
    const genderText=String(gender||'');
    if(!Object.prototype.hasOwnProperty.call(input,'hair'))merged.hair=pick(hairStyles,1);
    if(!Object.prototype.hasOwnProperty.call(input,'hairColor'))merged.hairColor=pick(hairColors,2);
    if(!Object.prototype.hasOwnProperty.call(input,'topColor'))merged.topColor=pick(outfitColors,3);
    if(!Object.prototype.hasOwnProperty.call(input,'skin'))merged.skin=pick(SKIN_TONES,4);
    if(!Object.prototype.hasOwnProperty.call(input,'faceShape'))merged.faceShape=pick(['oval','round','soft-square'],5);
    if(!Object.prototype.hasOwnProperty.call(input,'eyeShape'))merged.eyeShape=pick(['almond','round','narrow','down'],6);
    if(!Object.prototype.hasOwnProperty.call(input,'browShape'))merged.browShape=pick(['soft','straight','arched'],7);
    if(!Object.prototype.hasOwnProperty.call(input,'bodyShape'))merged.bodyShape=/女|female|woman/i.test(genderText)?'feminine':/男|male|man/i.test(genderText)?'masculine':'balanced';
    const sleep={...clone(merged),top:'top-tee',topColor:'#d9c9d8',bottom:'bottom-shorts',bottomColor:'#b9a6bd',sleepwear:'sleep-set'};
    return {id:id||uid('resident'),kind,sourceId:String(sourceId||''),name:String(name||'新居民').slice(0,40),age:clamp(age,1,100)||24,role:String(role||''),personality:String(personality||''),gender:String(gender||''),avatar:avatar||'',outfit:merged,wardrobe:{presets:[],auto:true,dayOutfit:clone(merged),sleepOutfit:sleep},expression:'neutral',pose:'idle',homeId:'home',jobId:'cafe',position:{x:48+Math.floor(Math.random()*7),y:51+Math.floor(Math.random()*5)},buildingId:'home',status:'居家',controlled:false,createdAt:now(),birthdayMonth:1+Math.floor(Math.random()*12),birthdayDay:1+Math.floor(Math.random()*28),familyId:''};
  }
  function worldTemplate(name,selectedIds=[],personaId=''){
    const contacts=people(),selected=contacts.filter(p=>selectedIds.includes(String(p.id)));
    const residents=[];
    let linkedWorldBooks=[];try{linkedWorldBooks=(window.LRSpaceStoryBridge?.getWorldBooks?.()||[]).map(b=>({id:String(b.id||uid('book')),name:String(b.name||'未命名世界书'),description:String(b.description||''),rules:String(b.rules||''),locations:clone(b.locations||[]),entries:clone(b.entries||[]),sourceUpdatedAt:Number(b.updatedAt||b.updated_at||0)}))}catch(e){linkedWorldBooks=[]}
    const persona=personas().find(p=>String(p.id)===String(personaId));
    // A player character must come from a self-persona explicitly created on the homepage.
    // Never synthesize one from the account/display name.
    if(persona){
      const user=makeResident({kind:'user',sourceId:persona.id,name:persona.name,gender:persona.gender||persona.sex||'',age:Number(persona.age)||24,role:persona.role||'用户自设',personality:persona.personality||persona.description||'',avatar:persona.avatar||''});
      user.personaSnapshot=clone(persona);user.role=persona.role||'用户自设';residents.push(user);
    }
    selected.forEach((p,i)=>residents.push(makeResident({kind:'char',sourceId:p.id,name:p.name,gender:p.gender||p.sex||'',role:p.role||'CHAR',personality:p.personality||p.description||'',avatar:p.avatar||'',age:Number(p.age)||24,outfit:{topColor:COLORS[(i+1)%COLORS.length],hairColor:['#453845','#5b473b','#3a4652','#80624e'][i%4]}})));
    residents.forEach((r,i)=>{r.position={x:18+(i%4)*20,y:50+Math.floor(i/4)*8};});
    const perf=Number(navigator.deviceMemory||4),cores=Number(navigator.hardwareConcurrency||4);
    const suggested=clamp(Math.round(Math.min(48,Math.max(12,perf*5+cores*1.5))),8,48);
    return {id:uid('city'),name:String(name||'我的像素城市').slice(0,50),createdAt:now(),updatedAt:now(),worldNow:now(),lastRealAt:now(),personaRef:persona?{id:persona.id,snapshot:clone(persona)}:null,settings:{...clone(DEFAULT_SETTINGS),residentLimit:suggested},map:{width:100,height:100,unlockedAreas:['中心城区'],activeArea:'中心城区',buildings:BUILDINGS.map(b=>({...b,area:'中心城区'})),weather:'sunny',season:'spring',roads:[]},residents,relationships:[],families:[],logs:[{id:uid('log'),at:now(),title:'城市正式启用',detail:'第一批居民入住了这座城市。',kind:'system'}],events:[],photos:[],calendar:[],currentLocation:'home',currentController:residents[0]?.id||'',worldBooks:linkedWorldBooks,storyLinks:[],createdVia:'SPACE CITY'};
  }
  async function persist(){
    if(!world)return;
    world.updatedAt=now();world.lastRealAt=now();
    try{await idbPut(clone(world));await writeRegistry();return true}
    catch(e){console.error('[SPACE CITY] save failed',e);try{const list=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]');const next=list.filter(x=>x.id!==world.id);next.push(clone(world));localStorage.setItem(LEGACY_KEY,JSON.stringify(next));notify('本机数据库暂不可用，已尝试使用兼容存档保存。')}catch(_){notify('城市保存失败，请勿关闭页面。')}return false}
  }
  async function writeRegistry(){
    const registry={id:REGISTRY_ID,kind:'registry',activeId,worlds:worlds.map(w=>({id:w.id,name:w.name,updatedAt:w.updatedAt||w.createdAt||0,createdAt:w.createdAt||0}))};
    await idbPut(registry);
  }
  async function loadWorlds(){
    try{
      const rows=await idbAll();worlds=rows.filter(x=>x&&x.id!==REGISTRY_ID&&x.residents&&Array.isArray(x.residents));
      const reg=rows.find(x=>x?.id===REGISTRY_ID);if(reg?.worlds?.length){const ordered=reg.worlds.map(m=>worlds.find(w=>w.id===m.id)).filter(x=>x&&x.id&&Array.isArray(x.residents));const seen=new Set(ordered.map(w=>w.id));worlds=[...ordered,...worlds.filter(w=>!seen.has(w.id))]}
    }catch(e){console.warn('[SPACE CITY] IndexedDB unavailable, use fallback',e);try{worlds=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]')}catch(_){worlds=[]}}
    activeId=worlds.some(w=>w.id===activeId)?activeId:(worlds[0]?.id||'');
  }
  function migrateOldCities(){
    if(worlds.length||!legacySpaceBridge?.getCities)return;
    try{
      const old=legacySpaceBridge.getCities()||[];
      old.forEach(meta=>{
        const snap=legacySpaceBridge.getCitySnapshot?.(meta.id)?.snapshot||{};
        const w=worldTemplate(meta.name||'迁移城市',[], '');
        w.id='city-migrated-'+meta.id;w.name=(meta.name||'旧版城市')+' · 迁移';
        const ids=Array.isArray(snap.selectedPeople)?snap.selectedPeople:meta.peopleIds||[];
        const selected=people().filter(p=>ids.includes(p.id));
        selected.forEach(p=>w.residents.push(makeResident({kind:'char',sourceId:p.id,name:p.name,gender:p.gender||p.sex||'',role:p.role,personality:p.personality,avatar:p.avatar})));
        (snap.locations||[]).forEach((loc,i)=>{if(i<10)w.map.buildings.push({id:'legacy-'+loc.id,name:loc.name||'旧地点',icon:'📍',type:'legacy',x:20+(i%4)*20,y:25+Math.floor(i/4)*28,desc:loc.description||''})});
        (snap.activityLog||[]).slice(0,30).forEach(a=>w.logs.push({id:uid('migrated'),at:a.at||now(),title:a.title||'旧版动态',detail:a.detail||a.description||'',kind:'migrated'}));
        w.logs.unshift({id:uid('migration'),at:now(),title:'旧版 SPACE 城市已保留',detail:'原有地点和生活记录已迁入独立城市档案；旧剧情与记忆资料仍保留在原模块。',kind:'system'});
        worlds.push(w);
      });
    }catch(e){console.warn('[SPACE CITY] legacy import skipped',e)}
  }
  function buildMarkup(){
    const root=$('space');if(!root)return;
    root.className='page active lr-space-v2 lr-space-city-shell';
    root.innerHTML=`
      <div id="${ROOT_ID}" class="lr-space-v2-screen sc-root">
        <header class="sc-header lr-space-v2-head"><div><div class="sc-kicker">LOVE RECORD · PIXEL LIFE</div><h1>SPACE CITY</h1><p>让居民在自己的城市里，自主生活。</p></div><button class="sc-icon-btn" data-sc-action="story" title="长文剧情">▤</button></header>
        <section id="scLobby" class="sc-panel"><div class="sc-panel-head"><div><small>YOUR LITTLE WORLD</small><h2>我的城市</h2></div><button class="sc-btn sc-primary" data-sc-action="new-city">＋ 新城市</button></div><div id="scCityList" class="sc-city-list"></div></section>
        <section id="scCreatePanel" class="sc-panel" hidden><div class="sc-panel-head"><div><small>CREATE A CITY</small><h2>建立新城市</h2></div><button class="sc-text-btn" data-sc-action="cancel-create">取消</button></div><label class="sc-label">城市名称</label><input id="scNewCityName" class="sc-input" maxlength="50" placeholder="例如：云朵小镇"><label class="sc-label">选择要加入城市的主页 CHAR</label><div id="scContactChoices" class="sc-choice-grid"></div><label class="sc-label">选择你的用户自设（必选）</label><select id="scPersonaSelect" class="sc-input" required></select><p class="sc-note">用户角色只会引用你在主页【自设】中亲自创建的资料，不会自动生成 YANYAN 或其他默认角色。CHAR 与自设只读取资料快照，不会修改主页资料。</p><button class="sc-btn sc-primary sc-full" data-sc-action="create-city">创建城市</button></section>
        <section id="scWorld" hidden>
          <header class="sc-world-head"><button class="sc-back" data-sc-action="back-lobby">‹ 城市</button><div class="sc-world-title"><b id="scWorldName">我的城市</b><small id="scWorldDate">--</small></div><button class="sc-icon-btn" data-sc-action="world-settings">⚙</button></header>
          <div class="sc-statusline"><span id="scClock">08:00</span><span id="scWeather">☀ 晴天</span><span id="scSeason">春季</span><span id="scResidentCount">1 位居民</span></div>
          <nav class="sc-tabs"><button class="active" data-sc-tab="map">城市</button><button data-sc-tab="residents">居民</button><button data-sc-tab="relations">关系与家庭</button><button data-sc-tab="records">生活档案</button><button data-sc-tab="settings">设置</button></nav>
          <div id="scViewMap" class="sc-view">
            <div class="sc-map-meta"><span id="scAreaName">中心城区</span><span><select id="scAreaSelect" class="sc-small-select" aria-label="选择城市区域"></select><button class="sc-text-btn" data-sc-action="add-building">＋ 新建筑</button><button class="sc-text-btn" data-sc-action="expand-area">＋ 解锁新区</button></span></div>
            <div id="scTownMap" class="sc-town-map"><div class="sc-map-river"></div><div class="sc-road sc-road-a"></div><div class="sc-road sc-road-b"></div><div id="scBuildings" class="sc-building-grid"></div><div id="scSprites"></div></div>
            <div class="sc-map-help">点击建筑进入室内 · 点击空地移动当前角色</div>
            <section class="sc-control-panel"><div class="sc-control-info"><b>手动控制</b><select id="scControllerSelect" class="sc-small-select"></select></div><div class="sc-dpad"><button data-sc-move="up">▲</button><button data-sc-move="left">◀</button><button data-sc-move="down">▼</button><button data-sc-move="right">▶</button></div><button class="sc-btn sc-soft" data-sc-action="stop-control">暂停控制角色</button></section>
            <div class="sc-shortcuts"><button data-sc-action="open-closet">👕 换装</button><button data-sc-action="add-resident">＋ 添加居民</button><button data-sc-action="random-event">✦ 生活事件</button><button data-sc-action="calendar">▦ 家庭日历</button></div>
            <section class="sc-panel sc-mini-panel"><div class="sc-panel-head"><div><small>LIVE IN THE CITY</small><h2>正在发生</h2></div><button class="sc-text-btn" data-sc-tab="records">全部记录 ›</button></div><div id="scLatestLogs" class="sc-latest-logs"></div></section>
          </div>
          <div id="scViewResidents" class="sc-view" hidden><div class="sc-view-head"><div><small>PEOPLE OF THE CITY</small><h2>居民中心</h2><p>每位居民都有自己的住所、日程、性格和衣柜。</p></div><button class="sc-btn sc-primary" data-sc-action="add-resident">＋ 添加</button></div><div id="scResidentList" class="sc-resident-list"></div></div>
          <div id="scViewRelations" class="sc-view" hidden><div class="sc-view-head"><div><small>RELATIONSHIPS</small><h2>关系与家庭</h2><p>已有 CHAR 恋爱关系会受到保护；NPC 可以自主发展关系。</p></div></div><section class="sc-panel"><h3>关系设置</h3><p class="sc-note">A、B 按选择顺序区分：建立父母/子女或祖孙关系时，按选项说明选择方向。</p><div class="sc-form-grid"><select id="scRelA" class="sc-input"></select><select id="scRelB" class="sc-input"></select><select id="scRelType" class="sc-input"><option value="friend">朋友</option><option value="lover">恋人</option><option value="spouse">夫妻</option><option value="family">家人（未细分）</option><option value="parent">父母 → 子女（A 为父母）</option><option value="child">子女 → 父母（A 为子女）</option><option value="sibling">兄弟姐妹</option><option value="grandparent">祖父母 / 外祖父母 → 孙辈（A 为长辈）</option><option value="grandchild">孙辈 → 祖父母 / 外祖父母（A 为晚辈）</option><option value="relative">其他亲属</option></select></div><button class="sc-btn sc-primary sc-full" data-sc-action="save-relation">保存关系</button><p class="sc-note">恋爱关系的手动设置由用户决定；系统只会让 NPC × NPC 自主发展恋爱。没有预先设定关系的 CHAR 不会被自动配对，CHAR × NPC 不会自主发展恋爱。</p></section><section class="sc-panel"><div class="sc-panel-head"><h3>家庭档案</h3><button class="sc-btn sc-soft" data-sc-action="create-family">＋ 建立家庭</button></div><div id="scFamilyList" class="sc-family-list"></div></section><section class="sc-panel"><h3>居民关系网</h3><div id="scRelationshipList" class="sc-relationship-list"></div></section></div>
          <div id="scViewRecords" class="sc-view" hidden><div class="sc-view-head"><div><small>CITY ARCHIVE</small><h2>生活档案</h2><p>居民日常、重要事件、城市相册与家庭日历。</p></div></div><div class="sc-record-tabs"><button class="active" data-sc-record="logs">生活日志</button><button data-sc-record="events">人生事件</button><button data-sc-record="photos">生活相册</button><button data-sc-record="calendar">家庭日历</button></div><div id="scRecordContent"></div></div>
          <div id="scViewSettings" class="sc-view" hidden><div class="sc-view-head"><div><small>CITY SETTINGS</small><h2>城市设置</h2><p>本地模拟运行，不需要 API。</p></div></div><section class="sc-panel"><label class="sc-label">城市时间速度</label><select id="scSpeed" class="sc-input"><option value="realtime">现实同步 · 1×</option><option value="slow">慢速 · 5×</option><option value="standard">标准 · 20×</option><option value="fast">快速 · 60×</option><option value="custom">自定义</option></select><div id="scCustomSpeedWrap" hidden><label class="sc-label">自定义倍速 <span id="scCustomSpeedValue">20×</span></label><input id="scCustomSpeed" type="range" min="1" max="120" value="20"></div><label class="sc-switch"><input id="scPaused" type="checkbox"><span>暂停城市时间</span></label><label class="sc-label">居民数量上限</label><input id="scResidentLimit" class="sc-input" type="number" min="1" max="150"><p class="sc-note" id="scCapacityNote"></p><div class="sc-form-grid"><div><label class="sc-label">天气</label><select id="scWeatherSelect" class="sc-input"><option value="sunny">晴天</option><option value="cloudy">多云</option><option value="rain">下雨</option><option value="snow">下雪</option><option value="wind">微风</option></select></div><div><label class="sc-label">季节</label><select id="scSeasonSelect" class="sc-input"><option value="spring">春季</option><option value="summer">夏季</option><option value="autumn">秋季</option><option value="winter">冬季</option></select></div></div><button class="sc-btn sc-primary sc-full" data-sc-action="save-settings">保存城市设置</button></section><section class="sc-panel"><h3>数据管理</h3><div class="sc-short-actions"><button class="sc-btn sc-soft" data-sc-action="export-backup">导出城市备份</button><button class="sc-btn sc-soft" data-sc-action="import-backup">导入城市备份</button><input id="scBackupFile" type="file" accept="application/json,.json" hidden></div><button class="sc-btn sc-danger sc-full" data-sc-action="delete-world">删除当前城市</button></section></div>
        </section>
        <div id="scInterior" class="sc-interior" hidden><header class="sc-world-head"><button class="sc-back" data-sc-action="leave-interior">‹ 返回城市</button><div class="sc-world-title"><b id="scInteriorName">室内</b><small>INDOOR SCENE</small></div><button class="sc-icon-btn" data-sc-action="open-closet">👕</button></header><div id="scRoom" class="sc-room"><div class="sc-room-window"></div><div class="sc-room-door"></div><div id="scRoomFurniture" class="sc-room-furniture"></div><div id="scRoomResidents" class="sc-room-residents"></div></div><div class="sc-map-help">点击家具进行互动 · 点击居民查看资料</div></div>
        </section>
        <div id="scModal" class="sc-modal" hidden><div class="sc-backdrop" data-sc-action="close-modal"></div><section class="sc-sheet"><div class="sc-sheet-head"><div><small id="scModalKicker">SPACE CITY</small><h2 id="scModalTitle">详情</h2></div><button class="sc-close" data-sc-action="close-modal">×</button></div><div id="scModalBody"></div></section></div>
        <div id="scToast" class="sc-toast" role="status" aria-live="polite"></div>
        <input id="scPhotoFile" type="file" accept="image/*" hidden>
      </div>`;
    installStyles();
  }
  function installStyles(){
    if($('scCityStyles'))return;
    const st=document.createElement('style');st.id='scCityStyles';st.textContent=`
#space.lr-space-city-shell{background:#f4f0e7!important;color:#4e4650!important;min-height:100dvh!important;padding:0 0 calc(92px + env(safe-area-inset-bottom))!important;overflow-x:hidden!important;font-family:ui-monospace,'SFMono-Regular',Consolas,monospace!important}
#space.lr-space-city-shell *{box-sizing:border-box}#space.lr-space-city-shell button,#space.lr-space-city-shell input,#space.lr-space-city-shell select,#space.lr-space-city-shell textarea{font:inherit}#space.lr-space-city-shell .sc-root{max-width:900px;margin:0 auto;padding:18px 14px 110px;min-height:100dvh;background:#f4f0e7}
#space.lr-space-city-shell .sc-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 3px 17px}.sc-kicker{font-size:9px;letter-spacing:2px;color:#9a849c}.sc-header h1{font-size:27px;letter-spacing:1px;margin:5px 0;color:#55465c}.sc-header p{font:11px/1.6 sans-serif;color:#958795;margin:0}.sc-icon-btn{width:40px;height:40px;border:2px solid #8e788e;background:#e7d9e8;color:#624f67;box-shadow:3px 3px 0 #d1c0d2;border-radius:3px;font-size:18px}
#space.lr-space-city-shell .sc-panel{border:2px solid #8d788d;border-radius:4px;background:#fffaf0;padding:14px;margin:0 0 13px;box-shadow:4px 4px 0 #d8cbd4}#space.lr-space-city-shell .sc-panel h2{font-size:17px;margin:4px 0;color:#5c4b60}#space.lr-space-city-shell .sc-panel h3{font-size:13px;margin:0 0 11px;color:#725c76}#space.lr-space-city-shell .sc-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.sc-panel-head small,.sc-view-head small{font-size:8px;letter-spacing:1.7px;color:#a186a3}.sc-btn{border:2px solid #89758b;background:#f3eaf1;color:#624f67;border-radius:3px;padding:9px 11px;font-size:10px;box-shadow:2px 2px 0 #d2c3d4;min-height:37px}.sc-primary{background:#a987ae;color:#fff;border-color:#735c7b}.sc-soft{background:#eef0e4;border-color:#8c987f;color:#5c6a54}.sc-danger{border-color:#b98d96;color:#915d68;background:#fff1f1}.sc-full{width:100%;margin-top:10px}.sc-text-btn{border:0;background:transparent;color:#9879a0;font-size:10px;padding:8px}
.sc-city-list,.sc-resident-list,.sc-family-list,.sc-relationship-list{display:grid;gap:9px;margin-top:12px}.sc-city-card,.sc-resident-card,.sc-family-card,.sc-rel-card{border:1px solid #dfd1df;background:#fffdf7;padding:11px;border-radius:3px;display:flex;align-items:center;gap:10px}.sc-city-card>div:first-child,.sc-resident-info{flex:1;min-width:0}.sc-city-card b,.sc-resident-info b{font-size:12px;color:#5c4b60;display:block;overflow-wrap:anywhere}.sc-city-card small,.sc-resident-info small{display:block;font:10px/1.5 sans-serif;color:#998b99;margin-top:4px}.sc-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:7px 0}.sc-choice{display:flex;align-items:center;gap:7px;padding:9px;border:1px solid #dfd1df;background:#fffdf8;font:11px sans-serif;border-radius:3px}.sc-choice input{width:16px;height:16px;accent-color:#a987ae}.sc-label{display:block;font:10px sans-serif;color:#8c788f;margin:13px 0 6px}.sc-input{width:100%;min-width:0;border:1px solid #d9cbd9;border-radius:3px;background:#fffefa;color:#55485a;padding:10px;font:12px sans-serif!important}.sc-note{font:10px/1.7 sans-serif;color:#9b8c9b;margin:8px 0}.sc-world-head{display:flex;align-items:center;gap:8px;margin:0 0 9px}.sc-back{border:1px solid #d7c7d9;background:#fffaf2;color:#806b84;padding:8px 10px;font-size:10px;border-radius:3px;white-space:nowrap}.sc-world-title{min-width:0;flex:1;text-align:center}.sc-world-title b,.sc-world-title small{display:block}.sc-world-title b{font-size:13px;color:#5a495e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-world-title small{font:9px sans-serif;color:#9b8b9b;margin-top:4px}.sc-statusline{display:flex;gap:7px;justify-content:space-between;flex-wrap:wrap;font:9px sans-serif;color:#8f7c91;padding:7px 9px;background:#fffaf0;border:1px solid #e0d4df;margin-bottom:9px}.sc-tabs{display:flex;gap:5px;overflow-x:auto;padding:0 0 9px;scrollbar-width:none}.sc-tabs button,.sc-record-tabs button{flex:none;border:1px solid #d8cbd9;background:#fffaf3;color:#88768b;padding:8px 10px;font-size:9px;border-radius:3px}.sc-tabs button.active,.sc-record-tabs button.active{background:#8f7794;color:#fff;border-color:#725d78}.sc-view[hidden],#scWorld[hidden],#scInterior[hidden],#scCreatePanel[hidden]{display:none!important}.sc-view-head{display:flex;align-items:center;justify-content:space-between;gap:9px;margin:7px 0 13px}.sc-view-head h2{font-size:19px;margin:4px 0;color:#5b4a60}.sc-view-head p{font:10px/1.6 sans-serif;color:#998b9a;margin:0}
.sc-map-meta{display:flex;align-items:center;justify-content:space-between;margin:6px 2px;font-size:10px;color:#947d98}.sc-town-map{position:relative;width:100%;height:clamp(360px,68vw,560px);max-height:65vh;overflow:hidden;border:3px solid #657a6b;background-color:#dce6c9;background-image:linear-gradient(90deg,rgba(255,255,255,.18) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.18) 1px,transparent 1px);background-size:20px 20px;image-rendering:pixelated;touch-action:manipulation}.sc-town-map:before{content:"";position:absolute;inset:6% 4%;border:2px solid rgba(113,137,111,.5);pointer-events:none}.sc-map-river{position:absolute;right:-7%;top:-10%;width:17%;height:125%;background:#9ccbd4;transform:rotate(12deg);border-left:5px solid #83b8c5;border-right:5px solid #83b8c5}.sc-road{position:absolute;background:#e4d6ba;border:2px solid #c7b89d;z-index:1}.sc-road-a{left:0;right:0;top:48%;height:9%;border-left:0;border-right:0}.sc-road-b{left:43%;top:0;bottom:0;width:9%;border-top:0;border-bottom:0}.sc-building{position:absolute;z-index:3;transform:translate(-50%,-50%);width:24%;max-width:118px;min-width:72px;border:2px solid #806d82;background:#fff7e9;box-shadow:3px 3px 0 rgba(101,80,105,.28);padding:5px 3px;text-align:center;color:#65546a;border-radius:2px}.sc-building:active{transform:translate(-50%,-50%) scale(.96)}.sc-building i{font-style:normal;font-size:20px;display:block}.sc-building b{font:9px/1.4 sans-serif;display:block;overflow-wrap:anywhere}.sc-building small{font:8px sans-serif;color:#9d899e}.sc-sprite{position:absolute;z-index:5;width:36px;height:50px;transition:left .32s ease,top .32s ease;transform:translate(-50%,-50%);border:0;background:transparent;padding:0;filter:drop-shadow(2px 2px 0 rgba(61,49,62,.24));image-rendering:pixelated}.sc-sprite svg{width:100%;height:100%;overflow:visible;image-rendering:pixelated}.sc-sprite-label{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font:7px sans-serif;color:#514753;background:#fffaf0d9;padding:2px 4px;border:1px solid #d8cad8}.sc-map-help{text-align:center;font:9px sans-serif;color:#9c8c9d;padding:8px}.sc-control-panel{border:1px solid #ded0df;background:#fffaf0;padding:10px;display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:11px}.sc-control-info{min-width:0;flex:1}.sc-control-info b{display:block;font-size:10px;color:#725d77;margin-bottom:5px}.sc-small-select{max-width:100%;border:1px solid #ddd0de;background:#fffefa;color:#69566d;padding:6px;font:9px sans-serif}.sc-dpad{width:112px;display:grid;grid-template-columns:repeat(3,32px);grid-template-rows:repeat(2,30px);gap:3px;justify-content:center}.sc-dpad button{border:1px solid #a18da5;background:#eee5ef;color:#725c77;font-size:11px;border-radius:3px}.sc-dpad button[data-sc-move=up]{grid-column:2}.sc-dpad button[data-sc-move=left]{grid-column:1;grid-row:2}.sc-dpad button[data-sc-move=down]{grid-column:2;grid-row:2}.sc-dpad button[data-sc-move=right]{grid-column:3;grid-row:2}.sc-shortcuts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:13px}.sc-shortcuts button{border:1px solid #d7cbd9;background:#fffaf2;padding:10px 4px;font-size:9px;color:#7b687e;border-radius:3px}.sc-latest-logs{display:grid;gap:7px;margin-top:10px}.sc-log{border-left:3px solid #b99cbe;padding:5px 8px;background:#fffdf8}.sc-log b{display:block;font-size:10px;color:#6a596e}.sc-log small{font:9px sans-serif;color:#9f909f}.sc-log p{font:10px/1.5 sans-serif;color:#897c8b;margin:3px 0 0}
.sc-resident-avatar{width:54px;height:60px;display:grid;place-items:center;background:#f1e8ef;border:1px solid #d8c9dc;flex:none}.sc-resident-avatar svg{width:100%;height:100%;image-rendering:pixelated}.sc-resident-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.sc-resident-actions button{border:1px solid #d8c9db;background:#f5edf5;color:#806c84;padding:6px 7px;font-size:8px;border-radius:3px}.sc-tag{display:inline-block;padding:2px 4px;background:#ece2ed;color:#876d8c;font:8px sans-serif;margin:3px 3px 0 0}.sc-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.sc-family-card{display:block}.sc-family-card b{font-size:11px;color:#66546b}.sc-family-card p{font:9px/1.5 sans-serif;color:#9a8c9d;margin:5px 0}.sc-rel-card{justify-content:space-between}.sc-rel-card span{font:10px sans-serif;color:#77667a}.sc-record-tabs{display:flex;gap:5px;overflow:auto;padding:5px 0 11px}.sc-record-item{padding:11px 4px;border-bottom:1px solid #e8dce7}.sc-record-item b{font-size:11px;color:#6d5c70}.sc-record-item small{display:block;font:9px sans-serif;color:#a08f9f;margin:4px 0}.sc-record-item p{font:10px/1.6 sans-serif;color:#887b89;margin:0}.sc-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.sc-photo-grid img{width:100%;aspect-ratio:1;object-fit:cover;border:2px solid #bba8bb}.sc-switch{display:flex;align-items:center;gap:9px;margin:13px 0;font:10px sans-serif;color:#77677b}.sc-short-actions{display:flex;gap:7px;flex-wrap:wrap}
.sc-interior{padding-bottom:20px}.sc-room{height:clamp(360px,70vw,520px);position:relative;overflow:hidden;border:3px solid #786981;background:linear-gradient(#d9c9d5 0 58%,#bca18f 58%);image-rendering:pixelated}.sc-room:after{content:"";position:absolute;left:0;right:0;bottom:0;height:12%;background:repeating-linear-gradient(90deg,#9e827b 0 25px,#b49587 25px 27px);border-top:4px solid #876e6b}.sc-room-window{position:absolute;top:9%;left:9%;width:31%;height:24%;border:7px solid #f6e7d5;background:linear-gradient(#a9d4e0 0 55%,#95b78e 56%);box-shadow:inset 0 0 0 2px #839ca2}.sc-room-door{position:absolute;right:8%;bottom:12%;width:16%;height:45%;background:#b78c70;border:5px solid #815f55}.sc-room-furniture,.sc-room-residents{position:absolute;inset:0;z-index:2}.sc-furniture{position:absolute;transform:translate(-50%,-50%);border:2px solid #886d7d;background:#eee1ec;padding:10px 5px;color:#69556e;font:9px sans-serif;min-width:60px;min-height:50px;box-shadow:3px 3px 0 #967d8f}.sc-room-residents{z-index:4}.sc-room-person{position:absolute;transform:translate(-50%,-50%);width:42px;height:55px;border:0;background:transparent;padding:0}.sc-room-person svg{width:100%;height:100%}
.sc-modal{position:fixed;z-index:10080;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(47,37,51,.4);backdrop-filter:blur(4px)}.sc-modal[hidden]{display:none!important}.sc-backdrop{position:absolute;inset:0}.sc-sheet{position:relative;width:100%;max-width:650px;max-height:88dvh;overflow:auto;background:#fffaf0;border:3px solid #806b83;border-bottom:0;padding:15px 14px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -10px 35px #44384c44}.sc-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-bottom:1px solid #e7dce6;padding-bottom:11px;margin-bottom:12px}.sc-sheet-head small{font-size:8px;letter-spacing:1.6px;color:#a084a5}.sc-sheet-head h2{font-size:17px;color:#59495e;margin:4px 0}.sc-close{width:32px;height:32px;border:1px solid #d9cbd9;background:#fff;color:#806b84;font-size:19px}.sc-modal-content{font:11px/1.65 sans-serif;color:#756879}.sc-form-row{margin:10px 0}.sc-form-row label{display:block;font-size:10px;color:#927d94;margin-bottom:5px}.sc-form-row input,.sc-form-row select,.sc-form-row textarea{width:100%;padding:10px;border:1px solid #dacdda;background:#fffefa;color:#5f5362;font:12px sans-serif}.sc-form-row textarea{min-height:70px}.sc-outfit-preview{width:95px;height:118px;margin:0 auto 10px;background:#eee4ed;border:2px solid #907993;display:grid;place-items:center}.sc-outfit-preview svg{width:100%;height:100%}.sc-clothes-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:7px 0}.sc-clothes-item{border:1px solid #dbcedb;background:#fffdf8;padding:8px;text-align:left;font:10px sans-serif;color:#76647b}.sc-clothes-item.active{border:2px solid #a37aa8;background:#f0e5f2}.sc-color-row{display:flex;gap:6px;flex-wrap:wrap}.sc-color-swatch{width:26px;height:26px;border:2px solid #d7cbd7}.sc-color-swatch.active{outline:2px solid #8e6d97;outline-offset:2px}.sc-tabs-inline{display:flex;gap:5px;overflow:auto;padding:3px 0 9px}.sc-tabs-inline button{flex:none;border:1px solid #d9ced9;background:#fff;padding:7px 9px;font-size:9px;color:#846f88}.sc-tabs-inline button.active{background:#8d7692;color:#fff}.sc-toast{position:fixed;z-index:10090;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translate(-50%,10px);opacity:0;pointer-events:none;background:#55465e;color:#fff;padding:9px 13px;font:10px sans-serif;transition:.2s;max-width:90vw;text-align:center}.sc-toast.show{opacity:1;transform:translate(-50%,0)}.sc-view[hidden]{display:none!important}
@media(max-width:420px){#space.lr-space-city-shell .sc-root{padding-left:11px;padding-right:11px}.sc-town-map{height:390px}.sc-control-panel{gap:6px;padding:8px}.sc-control-info{width:35%}.sc-dpad{width:104px;grid-template-columns:repeat(3,29px)}.sc-shortcuts{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-choice-grid{grid-template-columns:1fr}.sc-resident-card{align-items:flex-start;flex-wrap:wrap}.sc-resident-actions{width:100%;justify-content:flex-end}}
`;
    st.textContent += `
/* SPACE CITY visual revision: full-screen city, true pixel buildings and furniture */
#space.lr-space-city-shell.sc-city-immersive .sc-header{display:none!important}
#space.lr-space-city-shell.sc-city-immersive #lrSpaceStoryHub{display:none!important}
#space.lr-space-city-shell.sc-city-immersive .sc-root{padding-top:10px}
#space.lr-space-city-shell .sc-building-grid{position:relative;z-index:3;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 9px;padding:30px 12px 34px;align-content:start}
#space.lr-space-city-shell .sc-town-map{height:auto;min-height:455px;max-height:none;overflow:hidden;background-color:#b9d09e;background-image:linear-gradient(90deg,rgba(88,119,81,.12) 1px,transparent 1px),linear-gradient(rgba(88,119,81,.12) 1px,transparent 1px),repeating-linear-gradient(0deg,transparent 0 142px,#dfd0ae 142px 170px),repeating-linear-gradient(90deg,transparent 0 104px,rgba(224,210,181,.88) 104px 128px);background-size:16px 16px,16px 16px,100% 170px,128px 100%;border:4px solid #607b5e;box-shadow:inset 0 0 0 5px #d1dfb7}
#space.lr-space-city-shell .sc-town-map:before{inset:9px;border:3px solid rgba(80,112,76,.38);box-shadow:inset 0 0 0 4px rgba(239,235,194,.18)}
#space.lr-space-city-shell .sc-map-river{right:-5%;top:-5%;width:11%;height:112%;background:#83bfd0;border-left:5px solid #5c9eae;border-right:5px solid #5c9eae;transform:none;clip-path:polygon(18% 0,100% 0,78% 100%,0 100%)}
#space.lr-space-city-shell .sc-road-a{top:48%;height:34px;background:#e7d5ad;border-color:#c3ae87;box-shadow:inset 0 5px #f4e7c9,inset 0 -5px #d6c39c}
#space.lr-space-city-shell .sc-road-b{left:48%;width:34px;background:#e7d5ad;border-color:#c3ae87;box-shadow:inset 5px 0 #f4e7c9,inset -5px 0 #d6c39c}
#space.lr-space-city-shell .sc-building{position:relative;left:auto!important;top:auto!important;transform:none!important;width:100%;min-width:0;max-width:none;height:138px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;padding:5px 3px 7px;border:0;background:transparent;box-shadow:none;border-radius:0;z-index:3;color:#594b5e}
#space.lr-space-city-shell .sc-building:active{transform:translateY(2px)!important}
#space.lr-space-city-shell .sc-building-art{width:100%;height:88px;display:grid;place-items:center;filter:drop-shadow(3px 4px 0 rgba(58,73,53,.24));image-rendering:pixelated}
#space.lr-space-city-shell .sc-building-art svg{width:min(100%,112px);height:88px;overflow:visible;shape-rendering:crispEdges;image-rendering:pixelated}
#space.lr-space-city-shell .sc-building b{display:block;max-width:100%;font:700 9px/1.25 ui-monospace,monospace;text-align:center;overflow-wrap:anywhere;background:#f7efd8;border:2px solid #7b6c74;padding:3px 4px;box-shadow:2px 2px 0 #b4a18a}
#space.lr-space-city-shell .sc-building small{font:8px ui-monospace,monospace;color:#6c7b61;text-shadow:0 1px #edf1d7}
#space.lr-space-city-shell #scSprites{position:absolute;inset:0;z-index:6;pointer-events:none}
#space.lr-space-city-shell .sc-sprite{pointer-events:auto;width:32px;height:48px}
#space.lr-space-city-shell .sc-sprite-label{font:7px ui-monospace,monospace;background:#fff5d8;border:2px solid #7b6c74;box-shadow:2px 2px 0 #b4a18a}
#space.lr-space-city-shell .sc-room{height:clamp(390px,105vw,560px);background:#d9c6d4;box-shadow:inset 0 -10px #8f716d}
#space.lr-space-city-shell .sc-room:before{content:"";position:absolute;inset:0 0 16% 0;background:repeating-linear-gradient(90deg,rgba(255,255,255,.09) 0 18px,transparent 18px 36px);pointer-events:none}
#space.lr-space-city-shell .sc-room:after{height:16%;background:repeating-linear-gradient(90deg,#987b73 0 30px,#b39283 30px 34px);border-top:5px solid #755e61}
#space.lr-space-city-shell .sc-room-furniture{z-index:3;pointer-events:none}
#space.lr-space-city-shell .sc-room-furniture .sc-furniture{pointer-events:auto!important;cursor:pointer;touch-action:manipulation}
#space.lr-space-city-shell .sc-room-residents{z-index:4;pointer-events:none!important}
#space.lr-space-city-shell .sc-room-residents .sc-room-person{pointer-events:auto!important;touch-action:manipulation}
#space.lr-space-city-shell .sc-furniture{position:absolute;transform:translate(-50%,-50%);width:29%;max-width:112px;min-width:76px;height:104px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;pointer-events:auto;border:0;background:transparent;padding:3px;box-shadow:none;color:#5f4e61;font:700 8px ui-monospace,monospace}
#space.lr-space-city-shell .sc-furniture-art{width:100%;height:74px;display:grid;place-items:center;filter:drop-shadow(2px 3px 0 rgba(62,50,61,.22));}
#space.lr-space-city-shell .sc-furniture-art svg{width:100%;height:100%;max-width:100px;shape-rendering:crispEdges;image-rendering:pixelated}
#space.lr-space-city-shell .sc-furniture-label{display:block;padding:2px 4px;background:#f6ecd8;border:2px solid #826d7e;box-shadow:2px 2px 0 #baa4b1;white-space:nowrap}
#space.lr-space-city-shell .sc-room-person{z-index:5;filter:drop-shadow(2px 2px 0 rgba(55,45,55,.22))}
#space.lr-space-city-shell .sc-expression-panel{margin:12px 0;padding:10px;border:1px solid #ded0df;background:#fffaf0}
#space.lr-space-city-shell .sc-expression-panel label{display:block;font:10px sans-serif;color:#8c788f;margin:7px 0 4px}
#space.lr-space-city-shell .sc-expression-panel select{width:100%;padding:9px;border:1px solid #d9cbd9;background:#fffefa;color:#55485a;border-radius:3px}

/* Boutique wardrobe studio */
#space.lr-space-city-shell .sc-closet-content{padding-bottom:3px}
#space.lr-space-city-shell .sc-closet-stage{position:relative;overflow:hidden;padding:13px 14px 11px;margin:2px 0 16px;border:1px solid #d9c5dc;border-radius:15px;background:radial-gradient(ellipse at 50% 35%,#fffaf7 0,#eee0ee 47%,#d9c8dc 100%);box-shadow:inset 0 1px #fff,0 6px 18px rgba(104,79,111,.11)}
#space.lr-space-city-shell .sc-closet-stage:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 0 12%,rgba(255,255,255,.26) 12% 13%,transparent 13% 87%,rgba(255,255,255,.26) 87% 88%,transparent 88%);pointer-events:none}
#space.lr-space-city-shell .sc-closet-stage-top{position:relative;display:flex;justify-content:space-between;align-items:center;font:8px/1.4 ui-monospace,monospace;letter-spacing:1.5px;color:#8f7895}
#space.lr-space-city-shell .sc-closet-live{font-size:7px;letter-spacing:.8px;color:#81977c}
#space.lr-space-city-shell .sc-closet-mirror{position:relative;width:154px;height:190px;margin:12px auto 8px;border:8px solid #f7eee5;border-radius:78px 78px 10px 10px;background:linear-gradient(145deg,#f9f1f8,#e6d8e9 58%,#cdbbd1);box-shadow:inset 0 0 0 2px #a78fab,0 5px 0 #b49bb6,0 10px 18px rgba(79,58,84,.14);display:flex;align-items:center;justify-content:center}
#space.lr-space-city-shell .sc-closet-mirror-glow{position:absolute;inset:9px;border-radius:70px 70px 4px 4px;background:linear-gradient(135deg,rgba(255,255,255,.7),rgba(255,255,255,.05) 43%,transparent 70%);pointer-events:none}
#space.lr-space-city-shell .sc-closet-avatar{position:relative;z-index:1;width:104px;height:156px;display:grid;place-items:center;filter:drop-shadow(0 5px 2px rgba(68,53,72,.15))}
#space.lr-space-city-shell .sc-closet-avatar svg{width:100%;height:100%;image-rendering:pixelated}
#space.lr-space-city-shell .sc-closet-plinth{position:absolute;bottom:-5px;width:112px;height:8px;border-radius:50%;background:rgba(93,72,100,.18);filter:blur(3px)}
#space.lr-space-city-shell .sc-closet-caption{position:relative;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(139,112,145,.2);padding-top:9px;color:#69576f}
#space.lr-space-city-shell .sc-closet-caption small{display:block;font-size:8px;color:#9b899e;letter-spacing:1px}
#space.lr-space-city-shell .sc-closet-caption b{font-size:12px}
#space.lr-space-city-shell .sc-closet-star{color:#b28ab4;font-size:18px}
#space.lr-space-city-shell .sc-closet-section{margin:14px 0;padding:13px 11px;border:1px solid #e2d5e3;border-radius:12px;background:linear-gradient(145deg,#fffdf8,#faf4f0);box-shadow:0 3px 10px rgba(94,72,100,.045)}
#space.lr-space-city-shell .sc-closet-section-head{display:flex;justify-content:space-between;align-items:end;gap:8px;margin-bottom:10px}
#space.lr-space-city-shell .sc-closet-section-head small{display:block;font:7px ui-monospace,monospace;letter-spacing:1.5px;color:#ad96af}
#space.lr-space-city-shell .sc-closet-section-head h3{margin:2px 0 0;font:600 15px sans-serif;color:#655269}
#space.lr-space-city-shell .sc-closet-section-head>span{font:8px sans-serif;color:#a18fa2}
#space.lr-space-city-shell .sc-closet-categories{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 8px;scrollbar-width:none}
#space.lr-space-city-shell .sc-closet-categories button{flex:none;min-width:54px;padding:7px 8px;border:1px solid #e2d5e2;border-radius:9px;background:#fff;color:#8c7a90;display:flex;flex-direction:column;align-items:center;gap:3px}
#space.lr-space-city-shell .sc-closet-categories button i{font-style:normal;font-size:15px;color:#a18aa5}
#space.lr-space-city-shell .sc-closet-categories button span{font:9px sans-serif}
#space.lr-space-city-shell .sc-closet-categories button.active{border-color:#a987ae;background:linear-gradient(150deg,#f2e6f3,#e5d6e9);color:#684f70;box-shadow:0 2px 0 #c7b0ca}
#space.lr-space-city-shell .sc-closet-categories button.active i{color:#795d82}
#space.lr-space-city-shell .sc-closet-picked{display:flex;justify-content:space-between;align-items:center;margin:2px 0 8px}
#space.lr-space-city-shell .sc-closet-picked b{font:600 11px sans-serif;color:#77617b}
#space.lr-space-city-shell .sc-closet-picked span{font:8px sans-serif;color:#aa9baa}
#space.lr-space-city-shell .sc-clothes-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0}
#space.lr-space-city-shell .sc-clothes-item{position:relative;min-height:92px;display:flex;align-items:center;gap:9px;padding:8px;border:1px solid #e2d7e3;border-radius:10px;background:linear-gradient(150deg,#fff,#fbf7f5);box-shadow:0 2px 4px rgba(83,66,89,.035);transition:border-color .15s,transform .15s}
#space.lr-space-city-shell .sc-clothes-item:active{transform:scale(.98)}
#space.lr-space-city-shell .sc-clothes-item.active{border:2px solid #a987ae;background:linear-gradient(145deg,#f7edf7,#eee2f0);box-shadow:0 3px 0 #d4c2d6}
#space.lr-space-city-shell .sc-cloth-thumb{flex:none;width:45px;height:58px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(145deg,#f0e8f1,#fffaf5);border:1px solid #e5dbe6}
#space.lr-space-city-shell .sc-cloth-thumb svg{width:100%;height:100%;shape-rendering:crispEdges;image-rendering:pixelated}
#space.lr-space-city-shell .sc-cloth-thumb .sc-pixel-item{width:100%;height:100%;}
#space.lr-space-city-shell .sc-cloth-name{font:10px/1.4 sans-serif;color:#6e5e73;flex:1;text-align:left}
#space.lr-space-city-shell .sc-cloth-check{position:absolute;right:6px;top:5px;font:7px sans-serif;color:#a28ba5}
#space.lr-space-city-shell .sc-clothes-item.active .sc-cloth-check{color:#785d81;font-weight:700}
#space.lr-space-city-shell .sc-color-section{padding-bottom:16px}
#space.lr-space-city-shell .sc-color-row{gap:10px}
#space.lr-space-city-shell .sc-color-swatch{width:29px;height:29px;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #ded1df;outline:none;flex:none}
#space.lr-space-city-shell .sc-color-swatch.active{outline:2px solid #8e6d97;outline-offset:3px;box-shadow:0 0 0 1px #fff}
#space.lr-space-city-shell .sc-closet-presets{display:flex;gap:8px;overflow-x:auto;padding:2px 0 5px}
#space.lr-space-city-shell .sc-lookbook-card{flex:none;width:94px;padding:7px;border:1px solid #e2d6e3;border-radius:9px;background:#fffaf8;display:flex;flex-direction:column;align-items:center;gap:3px;color:#77667a}
#space.lr-space-city-shell .sc-lookbook-card>span{width:62px;height:66px;display:grid;place-items:center;background:#eee5ef;border-radius:7px}
#space.lr-space-city-shell .sc-lookbook-card svg{width:100%;height:100%}
#space.lr-space-city-shell .sc-lookbook-card b{font:9px sans-serif;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#space.lr-space-city-shell .sc-lookbook-card small{font:7px sans-serif;color:#a293a3}
#space.lr-space-city-shell .sc-closet-empty{padding:15px;border:1px dashed #dfd0e0;border-radius:9px;font:9px/1.6 sans-serif;color:#a292a4;background:#fffdfa}
#space.lr-space-city-shell .sc-closet-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:14px}
#space.lr-space-city-shell .sc-closet-actions button{font-size:9px;padding:10px 6px}
#space.lr-space-city-shell .sc-closet-actions button:last-child{grid-column:1/-1}
#space.lr-space-city-shell .sc-closet-done{margin-top:9px;padding:13px;font-size:11px}
#space.lr-space-city-shell .sc-profile-preview{width:120px;height:148px;margin:4px auto 12px;border-radius:13px;background:linear-gradient(145deg,#f5ebf4,#e4d5e8);box-shadow:inset 0 0 0 1px #fff,0 4px 12px rgba(97,73,104,.1)}
#space.lr-space-city-shell .sc-profile-preview svg{width:100%;height:100%}
#space.lr-space-city-shell .sc-profile-pick-head{display:flex;justify-content:space-between;align-items:center;margin:11px 0 7px}
#space.lr-space-city-shell .sc-profile-pick-head b{font:600 11px sans-serif;color:#705b76}
#space.lr-space-city-shell .sc-profile-pick-head small{font:8px sans-serif;color:#a18fa2}
#space.lr-space-city-shell .sc-profile-expression-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
#space.lr-space-city-shell .sc-profile-pose-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#space.lr-space-city-shell .sc-profile-option{display:flex;align-items:center;gap:7px;padding:8px 7px;border:1px solid #e0d3e0;border-radius:8px;background:#fffdf8;color:#796a7c;text-align:left}
#space.lr-space-city-shell .sc-profile-option span{font-size:17px}
#space.lr-space-city-shell .sc-profile-option b{font:9px sans-serif}
#space.lr-space-city-shell .sc-profile-option.active{border:2px solid #a987ae;background:#f1e6f2;color:#644b6b;box-shadow:0 2px 0 #d5c1d7}
#space.lr-space-city-shell .sc-family-home{display:block;font:9px sans-serif;color:#8c7a90;margin-top:6px}
@media(max-width:390px){#space.lr-space-city-shell .sc-closet-stage{padding-left:9px;padding-right:9px}#space.lr-space-city-shell .sc-closet-mirror{width:142px;height:178px}#space.lr-space-city-shell .sc-clothes-item{gap:6px;padding:6px;min-height:84px}#space.lr-space-city-shell .sc-cloth-thumb{width:39px;height:52px}#space.lr-space-city-shell .sc-profile-expression-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}

@media(max-width:430px){#space.lr-space-city-shell .sc-building-grid{gap:13px 5px;padding:23px 7px}#space.lr-space-city-shell .sc-building{height:130px}#space.lr-space-city-shell .sc-building-art{height:78px}#space.lr-space-city-shell .sc-furniture{height:96px;width:31%;min-width:72px}}
/* TRUE PIXEL character system: grid-aligned rectangular color clusters only. */
#space.lr-space-city-shell .sc-pixel-character{display:block;width:100%;height:100%;overflow:visible;shape-rendering:crispEdges;image-rendering:pixelated;}
#space.lr-space-city-shell .sc-closet-avatar{width:120px;height:168px;}
#space.lr-space-city-shell .sc-closet-avatar .sc-pixel-character{width:100%;height:100%;}
#space.lr-space-city-shell .sc-sprite{width:40px!important;height:56px!important;}
#space.lr-space-city-shell .sc-sprite .sc-pixel-character{width:100%;height:100%;}
#space.lr-space-city-shell .sc-room-person{width:40px;height:56px;}
#space.lr-space-city-shell .sc-room-person .sc-pixel-character{width:100%;height:100%;}
#space.lr-space-city-shell .sc-profile-preview{height:168px;}
#space.lr-space-city-shell .sc-profile-preview .sc-pixel-character{width:100%;height:100%;}
#space.lr-space-city-shell .sc-clothes-item{min-height:100px;}
#space.lr-space-city-shell .sc-cloth-thumb{width:54px;height:76px;overflow:hidden;}
#space.lr-space-city-shell .sc-cloth-pixel-preview{width:100%;height:100%;display:grid;place-items:center;overflow:hidden;}
#space.lr-space-city-shell .sc-cloth-pixel-preview .sc-pixel-character{width:145%;height:145%;max-width:none;image-rendering:pixelated;}
#space.lr-space-city-shell .sc-face-editor{display:grid;gap:9px;grid-column:1/-1;}
#space.lr-space-city-shell .sc-face-feature{padding:9px;border:1px solid #e6d9e6;border-radius:9px;background:#fffdf9;}
#space.lr-space-city-shell .sc-face-feature>b{display:block;margin-bottom:7px;font:600 10px sans-serif;color:#705b76;}
#space.lr-space-city-shell .sc-face-feature>div{display:flex;flex-wrap:wrap;gap:6px;}
#space.lr-space-city-shell .sc-face-feature button{padding:7px 9px;border:1px solid #e0d4e0;border-radius:7px;background:#fff;color:#88768b;font:9px sans-serif;}
#space.lr-space-city-shell .sc-face-feature button.active{border-color:#9674a0;background:#eee3f0;color:#624b6b;box-shadow:0 2px 0 #d4c1d7;}
#space.lr-space-city-shell .sc-face-grid{display:block;}
`;
    document.head.appendChild(st);
  }
  function normalizePixelLooks(){
    if(!world)return;
    const hairStyles=['hair-short','hair-pixie','hair-bob','hair-long','hair-wave','hair-curl','hair-sidepart','hair-middle','hair-ponytail','hair-lowponytail','hair-twin','hair-bun','hair-halfup','hair-braid','hair-frenchbraid','hair-wolf','hair-mullet','hair-curtain'];
    const hairColors=['#493d4c','#5b473b','#3a4652','#80624e','#6b4a5a','#a16e48','#34323e','#9a7560'];
    const tops=['#c4a4d3','#9eb9cf','#c5a58f','#b4c49f','#d5a5b0','#d0b776','#8c9daf','#c7b7a0'];
    (world.residents||[]).forEach(r=>{
      r.outfit={...clone(DEFAULT_OUTFIT),...(r.outfit||{})};
      if(r._pixelLookVersion===1)return;
      const seed=[...(String(r.name||'')+'|'+String(r.id||''))].reduce((n,ch)=>(n*31+ch.charCodeAt(0))>>>0,17);
      const isDefaultHair=r.outfit.hair==='hair-wave'&&r.outfit.hairColor==='#493d4c';
      const isDefaultTop=r.outfit.topColor==='#c4a4d3';
      if(isDefaultHair){r.outfit.hair=hairStyles[seed%hairStyles.length];r.outfit.hairColor=hairColors[(seed+2)%hairColors.length]}
      if(isDefaultTop)r.outfit.topColor=tops[(seed+3)%tops.length];
      if(!r.outfit.faceShape)r.outfit.faceShape=['oval','round','soft-square'][seed%3];
      if(!r.outfit.eyeShape)r.outfit.eyeShape=['almond','round','narrow','down'][seed%4];
      if(!r.outfit.browShape)r.outfit.browShape=['soft','straight','arched'][seed%3];
      if(!r.outfit.bodyShape)r.outfit.bodyShape=/女|female|woman/i.test(String(r.gender||r.personaSnapshot?.gender||''))?'feminine':/男|male|man/i.test(String(r.gender||r.personaSnapshot?.gender||''))?'masculine':'balanced';
      if(r.wardrobe){if(r.wardrobe.dayOutfit){r.wardrobe.dayOutfit={...clone(r.outfit),...r.wardrobe.dayOutfit};if(isDefaultHair){r.wardrobe.dayOutfit.hair=r.outfit.hair;r.wardrobe.dayOutfit.hairColor=r.outfit.hairColor}if(isDefaultTop)r.wardrobe.dayOutfit.topColor=r.outfit.topColor}if(r.wardrobe.sleepOutfit){['hair','hairColor','faceShape','eyeShape','browShape','bodyShape'].forEach(k=>{if(r.wardrobe.sleepOutfit[k]===undefined||isDefaultHair&&['hair','hairColor'].includes(k))r.wardrobe.sleepOutfit[k]=r.outfit[k]})}}
      r._pixelLookVersion=1;
    });
  }
  function sprite(r){
    const o={...DEFAULT_OUTFIT,...(r?.outfit||{})};
    const W=40,H=56,grid=Array.from({length:H},()=>Array(W).fill(''));
    const safeHex=(v,f)=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):f;
    const skin=safeHex(o.skin,'#edc5a8'),hair=safeHex(o.hairColor,'#493d4c'),top=safeHex(o.topColor,'#c4a4d3'),bottom=safeHex(o.bottomColor,'#667b9a'),shoe=safeHex(o.shoeColor,'#f2eee8'),outerColor=safeHex(o.outerColor,'#ad91bc'),accColor=safeHex(o.accessoryColor,'#d5b77e');
    const shade=(hex,amt)=>{const n=parseInt(hex.slice(1),16),r=clamp((n>>16)+amt,0,255),g=clamp(((n>>8)&255)+amt,0,255),b=clamp((n&255)+amt,0,255);return '#'+[r,g,b].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('')};
    const skinLight=shade(skin,16),skinShadow=shade(skin,-25),hairLight=shade(hair,28),hairShadow=shade(hair,-24),clothLight=shade(top,22),clothShadow=shade(top,-24),pantsShadow=shade(bottom,-22),outline='#594852',ink='#443b49';
    const paint=(x,y,w,h,c)=>{for(let yy=Math.max(0,y);yy<Math.min(H,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(W,x+w);xx++)grid[yy][xx]=c};
    const rowShape=(cx,y,widths,c)=>widths.forEach((w,i)=>{if(w>0)paint(Math.round(cx-w/2),y+i,w,1,c)});
    const pixel=(x,y,c)=>paint(x,y,1,1,c);
    const rows=(cx,y,widths,colors)=>widths.forEach((w,i)=>{if(w>0)paint(Math.round(cx-w/2),y+i,w,1,Array.isArray(colors)?colors[i%colors.length]:colors)});
    const expr=r?.expression||'neutral',pose=r?.pose||'idle',hairId=o.hair||'hair-wave',topId=o.top||'top-knit',bottomId=o.bottom||'bottom-pants';
    const hairType=hairId.replace('hair-','');
    const longHair=['long','wave','curl','ponytail','highponytail','lowponytail','twin','halfup','braid','frenchbraid','wolf','mullet','curtain'].includes(hairType);
    const midHair=['bob','sidepart','middle','bun','pixie','short','tie','sailor'].includes(hairType);
    const bodyChoice=o.bodyShape||'auto';const bodyShape=bodyChoice!=='auto'?bodyChoice:((/女|female|woman/i.test(String(r?.gender||r?.personaSnapshot?.gender||r?.personaSnapshot?.sex||'')))?'feminine':(/男|male|man/i.test(String(r?.gender||r?.personaSnapshot?.gender||r?.personaSnapshot?.sex||'')))?'masculine':'balanced');

    // Hair behind the body: stepped pixel masses, never vector curves or strokes.
    if(longHair){rowShape(20,3,[8,14,18,20,22,22,22,22,22,22,22,20,20,18,18,16,16,14,14,12,12,10,10,8],hair);paint(10,18,3,14,hairShadow);paint(27,18,3,15,hairShadow);}
    else if(midHair){rowShape(20,3,[8,14,18,20,22,22,22,22,20,20,18,16,14,12,10],hair);}
    else {rowShape(20,3,[8,14,18,20,22,22,20,18,16,14,12],hair);}
    // Distinct silhouettes for 20 hairstyles.
    if(['ponytail','highponytail'].includes(hairType)){paint(28,hairType==='highponytail'?2:9,6,5,hair);paint(31,hairType==='highponytail'?6:13,4,17,hair);paint(33,hairType==='highponytail'?9:17,2,10,hairShadow);}
    if(hairType==='lowponytail'){paint(27,16,5,6,hair);paint(30,20,6,16,hair);paint(34,31,3,7,hairShadow)}
    if(hairType==='twin'){paint(7,9,6,8,hair);paint(6,15,5,16,hair);paint(27,9,6,8,hair);paint(29,15,5,16,hair)}
    if(hairType==='bun'){paint(15,0,10,5,hair);paint(17,1,6,3,hairLight);}
    if(hairType==='halfup'){paint(14,3,12,5,hairLight);paint(16,1,8,3,hair)}
    if(['braid','frenchbraid'].includes(hairType)){for(let i=0;i<6;i++){paint(10+(i%2),17+i*3,3,3,i%2?hairLight:hairShadow);paint(27-(i%2),17+i*3,3,3,i%2?hairShadow:hairLight)}}
    if(hairType==='wolf'||hairType==='mullet'){paint(9,17,4,15,hairShadow);paint(27,17,4,16,hairShadow);paint(13,23,3,8,hairLight)}

    // Legs, body and shoes. Four-head silhouette with visible limbs.
    const isSit=pose==='sit',isWalk=pose==='walk'||pose==='run';
    const fem=bodyShape==='feminine',masc=bodyShape==='masculine';
    const shoulder=fem?18:masc?22:20,waist=fem?13:masc?17:15,hip=fem?18:masc?16:17;
    // legs: pixel clusters with step-shaped hems
    if(isSit){paint(14,40,12,5,bottom);paint(12,44,12,4,bottom);paint(22,40,10,5,bottom);paint(25,44,9,4,bottom);paint(10,47,10,4,shoe);paint(27,47,10,4,shoe)}
    else {
      if(['bottom-skirt','bottom-pleated','bottom-long-skirt','bottom-culottes'].includes(bottomId)||o.dress){
        rowShape(20,38,[hip,hip+3,hip+7,hip+9,hip+11,hip+11,hip+9,hip+7],bottom);
        for(let x=14;x<=25;x+=4)paint(x,41,1,4,pantsShadow);
        if(o.dress){rowShape(20,26,[shoulder,shoulder+4,shoulder+2,waist,waist,hip,hip+4,hip+7,hip+9,hip+9,hip+7,hip+5],top)}
        else {paint(15,47,4,5,skin);paint(21,47,4,5,skin)}
      }else{
        const leg1=isWalk?13:14,leg2=isWalk?22:22;
        if(bottomId==='bottom-shorts'){paint(leg1,39,6,8,bottom);paint(leg2,39,6,8,bottom);paint(15,46,4,5,skin);paint(22,46,4,5,skin)}
        else {paint(leg1,39,6,11,bottom);paint(leg2,39,6,11,bottom);paint(leg1,48,6,2,pantsShadow);paint(leg2,48,6,2,pantsShadow)}
        if(bottomId==='bottom-jeans'){paint(15,40,1,8,clothLight);paint(23,40,1,8,clothLight)}
        if(bottomId==='bottom-cargo'){paint(13,43,3,4,clothLight);paint(24,43,3,4,clothLight)}
        if(isWalk){paint(12,49,8,2,skin);paint(23,48,7,2,skin)}
      }
      // shoes with pixels, soles and highlights
      paint(isWalk?11:13,51,8,3,shoe);paint(isWalk?23:21,51,8,3,shoe);paint(isWalk?11:13,53,8,1,outline);paint(isWalk?23:21,53,8,1,outline);
      paint(isWalk?13:15,51,3,1,shade(shoe,20));paint(isWalk?25:23,51,3,1,shade(shoe,20));
    }

    // Arms and neck (all contours made from pixel clusters).
    paint(18,21,4,5,skinShadow);paint(19,21,2,4,skinLight);
    paint(9,27,4,10,skin);paint(27,27,4,10,skin);paint(10,34,3,3,skinShadow);paint(27,34,3,3,skinShadow);
    if(pose==='wave'){paint(27,25,4,5,skin);paint(29,20,3,7,skin);paint(30,18,3,3,skinLight);}
    if(pose==='run'){paint(8,31,5,4,skin);paint(6,28,4,4,skinLight);paint(27,30,5,4,skin);paint(30,27,4,4,skinLight)}
    if(pose==='hug'){paint(11,31,7,3,skin);paint(22,31,7,3,skin);paint(16,32,8,3,skinLight)}
    if(pose==='shop'){paint(10,31,6,4,skin);paint(24,31,6,4,skin);paint(28,34,7,7,'#b98b73');paint(29,35,5,5,'#d7b79a')}
    if(pose==='dance'){paint(8,25,4,5,skin);paint(6,21,4,6,skin);paint(28,25,4,5,skin);paint(30,21,4,6,skin)}
    if(['read','work','eat','talk'].includes(pose)){paint(10,33,5,3,skin);paint(25,33,5,3,skin);paint(13,34,6,3,skinLight);paint(22,34,6,3,skinLight)}

    // Torso base and clothing silhouette.
    rowShape(20,25,[shoulder-3,shoulder+1,shoulder+3,shoulder+1,waist,waist,waist,waist+2,waist+2,waist+2,waist+2,waist+2,waist+2,waist+2],skinShadow);
    rowShape(20,25,[shoulder-5,shoulder-1,shoulder+1,shoulder-1,waist-2,waist-2,waist-2,waist,waist,waist,waist,waist,waist,waist],skin);
    const dressId=o.dress||'';
    if(dressId){
      rowShape(20,25,[shoulder,shoulder+4,shoulder+2,waist+3,waist+3,hip,hip+3,hip+5,hip+7,hip+7,hip+5,hip+3,hip+1],top);
      paint(19,27,2,2,clothLight);paint(19,36,2,1,clothShadow);
      if(dressId==='dress-shirt')paint(20,28,1,8,'#f6e9e5');
      if(dressId==='dress-knit')for(let y=33;y<39;y+=3)paint(14,y,12,1,clothLight);
      if(['dress-floral','dress-summer','dress-party','dress-long','dress-pinafore'].includes(dressId)){pixel(15,35,'#f4d4cf');pixel(24,38,'#f4d4cf');pixel(18,42,'#e8c4cf')}
      if(dressId==='dress-pinafore'){paint(15,27,3,2,clothShadow);paint(22,27,3,2,clothShadow)}
      if(dressId==='dress-party'){paint(14,36,12,2,clothLight);pixel(20,32,'#f3d58e')}
    }else{
      rowShape(20,25,[shoulder,shoulder+4,shoulder+2,waist+2,waist,waist,waist,waist,waist,waist,waist,waist,waist,waist],top);
      paint(12,27,4,5,top);paint(24,27,4,5,top);paint(12,31,3,4,clothShadow);paint(25,31,3,4,clothShadow);
      paint(14,27,2,2,clothLight);paint(24,27,2,2,clothLight);
      if(['top-shirt','top-blouse','top-polo','top-sailor','top-vest'].includes(topId)){paint(18,25,4,3,'#f8eee8');paint(19,28,2,8,shade(top,-6));for(let y=29;y<36;y+=3)pixel(21,y,'#f7e5cd')}
      if(['top-knit','top-sweater','top-turtleneck'].includes(topId)){paint(17,26,6,2,clothLight);for(let y=31;y<38;y+=3){paint(15,y,2,1,clothLight);paint(23,y,2,1,clothLight)}}
      if(topId==='top-hoodie'){paint(17,23,6,4,clothShadow);paint(18,25,4,2,clothLight);paint(17,35,6,2,clothShadow)}
      if(topId==='top-cardigan'){paint(19,27,2,11,clothShadow);for(let y=29;y<37;y+=3)pixel(21,y,'#f4e5d8')}
      if(topId==='top-offshoulder'){paint(14,26,12,2,shade(top,-15));paint(17,27,6,1,skin)}
      if(topId==='top-vest'){paint(15,27,3,9,clothShadow);paint(22,27,3,9,clothShadow)}
      if(topId==='top-blouse'){pixel(14,30,'#f4e3df');pixel(25,30,'#f4e3df');paint(18,27,4,1,clothLight)}
      if(topId==='top-turtleneck'){paint(17,24,6,3,clothShadow);paint(18,24,4,1,clothLight)}
      if(topId==='top-polo'){paint(18,26,4,2,'#f4eee5');pixel(21,29,'#f4eee5')}
      if(topId==='top-sailor'){paint(16,26,8,3,'#f4eee8');paint(18,28,4,2,'#7183a0');pixel(20,30,'#f0c6c6')}
    }

    // Outerwear layer: distinct pixel panels over the base outfit.
    if(o.outer&&o.outer!=='outer-none'){
      const oc=outerColor,os=shade(oc,-22),ol=shade(oc,20);
      paint(10,27,4,12,oc);paint(26,27,4,12,oc);paint(12,28,3,9,os);paint(25,28,3,9,ol);
      paint(15,26,3,12,oc);paint(22,26,3,12,oc);paint(18,26,4,12,oc);
      if(o.outer==='outer-coat'){paint(14,37,12,4,oc);paint(14,40,12,1,os)}
      if(o.outer==='outer-denim'||o.outer==='outer-blazer'){paint(14,29,2,2,'#dbe4e9');paint(24,29,2,2,'#dbe4e9');paint(19,27,2,10,ol)}
      if(o.outer==='outer-hooded'){paint(16,24,8,4,os);paint(18,24,4,2,ol)}
      if(o.outer==='outer-puffer'){paint(14,30,12,2,ol);paint(14,34,12,2,ol);paint(14,38,12,2,os)}
      if(o.outer==='outer-cardigan')for(let y=29;y<38;y+=3){paint(15,y,10,1,ol)}
    }

    // Head outline and face shape.
    const faceShape=o.faceShape&&o.faceShape!=='auto'?o.faceShape:'oval';
    const widths=faceShape==='round'?[8,12,16,18,20,20,20,20,18,16,14,10]:faceShape==='soft-square'?[10,16,18,18,18,18,18,18,18,16,14,10]:[8,14,18,20,20,20,20,18,18,16,12,8];
    rowShape(20,7,widths.map(w=>w+2),outline);
    rowShape(20,8,widths,skin);
    paint(12,12,2,5,skinShadow);paint(26,12,2,5,skinShadow);paint(15,9,8,1,skinLight);paint(17,19,6,1,skinShadow);
    // Brows and eyes use square pixel clusters; expression changes actual pixels.
    const brow=o.browShape&&o.browShape!=='auto'?o.browShape:'soft';
    if(expr==='angry'){paint(14,12,5,1,ink);paint(22,12,5,1,ink);pixel(15,11,ink);pixel(25,11,ink)}
    else if(brow==='straight'){paint(14,12,5,1,ink);paint(22,12,5,1,ink)}
    else if(brow==='arched'){paint(14,11,4,1,ink);pixel(14,10,ink);paint(22,11,4,1,ink);pixel(25,10,ink)}
    else {paint(14,12,4,1,ink);paint(22,12,4,1,ink);}
    if(expr==='sleepy'||expr==='sleep'||expr==='laugh'){paint(14,15,5,1,ink);paint(22,15,5,1,ink)}
    else if(expr==='wink'){paint(14,15,5,1,ink);paint(22,14,5,2,ink);pixel(24,13,'#fff7ee')}
    else if(expr==='happy'||expr==='blush'||expr==='shy'){paint(14,14,5,1,ink);pixel(15,13,ink);paint(22,14,5,1,ink);pixel(25,13,ink)}
    else if(expr==='surprised'){paint(15,13,3,4,ink);paint(23,13,3,4,ink);pixel(16,14,'#fff5e9');pixel(24,14,'#fff5e9')}
    else if(expr==='sad'||expr==='cry'){paint(15,14,3,2,ink);paint(23,14,3,2,ink);pixel(14,13,ink);pixel(26,13,ink);pixel(27,17,'#91c9da');if(expr==='cry'){paint(27,17,1,4,'#91c9da');paint(12,17,1,3,'#91c9da')}}
    else {const eye=o.eyeShape&&o.eyeShape!=='auto'?o.eyeShape:'almond';if(eye==='round'){paint(15,13,3,4,ink);paint(23,13,3,4,ink);pixel(16,13,'#fff7ee');pixel(24,13,'#fff7ee')}
      else if(eye==='narrow'){paint(14,14,5,2,ink);paint(22,14,5,2,ink);}
      else if(eye==='down'){paint(14,13,4,2,ink);paint(23,13,4,2,ink);pixel(17,15,ink);pixel(23,15,ink)}
      else {paint(14,14,5,2,ink);paint(22,14,5,2,ink);pixel(15,13,ink);pixel(24,13,ink);pixel(16,14,'#fff7ee');pixel(24,14,'#fff7ee')}
    }
    if(expr==='blush'||expr==='shy'||expr==='happy'||expr==='laugh'){paint(12,17,3,1,'#e99b9e');paint(25,17,3,1,'#e99b9e')}
    pixel(20,17,skinShadow);
    if(expr==='surprised'){paint(19,19,3,3,'#ad6270')}
    else if(expr==='sad'||expr==='cry'){paint(18,20,4,1,'#a96371');paint(19,19,2,1,'#a96371')}
    else if(expr==='happy'||expr==='laugh'||expr==='shy'){paint(18,19,4,2,'#a96371');pixel(17,19,'#a96371');pixel(22,19,'#a96371')}
    else {paint(19,20,3,1,'#a96371')}

    // Front hair, bangs and side locks. Pixel masses create the silhouette.
    const fringe=hairType==='sidepart'||hairType==='curtain'?[12,16,13,9]:hairType==='middle'?[9,12,7,7]:hairType==='pixie'?[14,12,8]:[16,17,16,12,7];
    rowShape(20,4,fringe,hair);paint(10,8,4,7,hair);paint(26,8,4,7,hair);
    if(hairType==='curtain'||hairType==='middle'){paint(18,7,3,7,hairLight);paint(21,7,3,7,hairShadow)}
    if(hairType==='sidepart'){paint(14,5,7,6,hairLight);paint(22,7,6,7,hairShadow)}
    if(hairType==='braid'||hairType==='frenchbraid'){paint(10,18,3,10,hairLight);paint(27,18,3,10,hairShadow)}
    // Pixel highlights, not stroked lines.
    paint(15,5,3,1,hairLight);paint(18,4,4,1,hairLight);paint(26,8,2,2,hairShadow);
    if(longHair){paint(10,28,3,5,hairLight);paint(27,29,3,4,hairShadow)}

    // Accessories and small clothing details.
    const acc=o.accessory||'acc-none';
    if(acc==='acc-glasses'){paint(13,14,6,1,outline);paint(13,14,1,4,outline);paint(18,14,1,4,outline);paint(22,14,1,4,outline);paint(27,14,1,4,outline);paint(18,15,4,1,outline)}
    if(acc==='acc-hat'){paint(11,4,18,3,accColor);paint(15,0,10,5,shade(accColor,-14));paint(12,6,16,1,shade(accColor,-22))}
    if(acc==='acc-bag'){paint(27,31,5,9,shade(accColor,-15));paint(28,32,3,6,accColor);pixel(29,34,shade(accColor,28))}
    if(acc==='acc-necklace'){paint(17,27,1,3,accColor);paint(22,27,1,3,accColor);paint(19,30,3,1,accColor);pixel(20,31,'#f7e3a5')}
    if(acc==='acc-earrings'){pixel(11,18,accColor);pixel(28,18,accColor);pixel(11,20,shade(accColor,-18));pixel(28,20,shade(accColor,-18))}
    if(acc==='acc-ribbon'){paint(10,6,4,3,accColor);paint(26,6,4,3,accColor);pixel(19,7,shade(accColor,-20));pixel(20,7,shade(accColor,-20))}
    if(acc==='acc-beret'){paint(12,4,16,4,accColor);paint(15,1,10,4,shade(accColor,15));pixel(25,3,shade(accColor,-20))}
    // Pose-specific hands and props; all marks remain pixel clusters.
    if(pose==='read'){paint(17,34,6,1,'#9a789f');paint(16,35,8,4,'#f1e4cb');paint(19,35,1,4,'#9f879d')}
    if(pose==='work'){paint(17,36,7,2,'#a9856b');paint(18,35,4,1,'#e2cda9')}
    if(pose==='eat'){paint(18,18,4,1,'#f2d8a8')}
    if(pose==='sleep'||expr==='sleepy'){paint(30,7,1,1,'#8d87a8');paint(32,5,1,1,'#8d87a8');paint(34,3,1,1,'#8d87a8')}

    // Compact each horizontal run into pixel rectangles. Every visible element is a hard-edged pixel.
    let out='';for(let y=0;y<H;y++){let x=0;while(x<W){const c=grid[y][x];if(!c){x++;continue}let end=x+1;while(end<W&&grid[y][end]===c)end++;out+=`<rect x="${x}" y="${y}" width="${end-x}" height="1" fill="${c}"/>`;x=end}}
    return `<svg class="sc-pixel-character" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(r?.name||'像素居民')}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
  }

  function buildingSvg(type='home'){
    const palette={home:['#b78b9c','#f2d8b7','#76576b'],cafe:['#c98f76','#f6dfb8','#805b50'],shop:['#88a6aa','#f2ddb5','#557378'],park:['#84a86f','#d8e5ad','#52764b'],school:['#8b91bd','#f1d8a5','#5c638a'],studio:['#bc9a70','#f4dfb8','#876b4c'],legacy:['#9c8daf','#f0dfb7','#6e5c7a']};
    const [roof,wall,trim]=palette[type]||palette.home;
    const roofMarkup=type==='park'?'<rect x="16" y="24" width="64" height="12" fill="#75a96b"/><rect x="27" y="12" width="42" height="18" fill="#8ebc75"/>':`<path d="M8 38L48 8 88 38H8Z" fill="${roof}"/><path d="M15 36L48 12 81 36" fill="none" stroke="${trim}" stroke-width="5"/>`;
    const body=type==='park'?'<rect x="24" y="34" width="48" height="33" fill="#96bd79"/><rect x="15" y="61" width="66" height="8" fill="#6d955e"/><circle cx="48" cy="46" r="9" fill="#c9df9f"/>':`<rect x="15" y="35" width="66" height="38" fill="${wall}" stroke="${trim}" stroke-width="4"/><rect x="24" y="43" width="13" height="12" fill="#8cc5d0" stroke="${trim}" stroke-width="3"/><rect x="59" y="43" width="13" height="12" fill="#8cc5d0" stroke="${trim}" stroke-width="3"/><rect x="42" y="52" width="13" height="21" fill="${trim}"/><rect x="45" y="56" width="7" height="8" fill="#e9c98e"/>`;
    return `<svg viewBox="0 0 96 82" aria-hidden="true" shape-rendering="crispEdges"><rect x="5" y="72" width="86" height="5" fill="#71815d"/>${roofMarkup}${body}<rect x="9" y="75" width="78" height="3" fill="#e8dfbc"/></svg>`;
  }
  function furnitureSvg(name){
    const common='shape-rendering="crispEdges"';
    const icons={
      '床':'<rect x="10" y="37" width="76" height="27" fill="#b98da5" stroke="#765a71" stroke-width="4"/><rect x="16" y="28" width="22" height="15" fill="#f5e9d8" stroke="#8d7584" stroke-width="3"/><rect x="40" y="39" width="40" height="20" fill="#d6a9c2"/><rect x="8" y="63" width="8" height="9" fill="#74596c"/><rect x="80" y="63" width="8" height="9" fill="#74596c"/>',
      '沙发':'<rect x="10" y="35" width="76" height="32" fill="#b18cba" stroke="#715c7a" stroke-width="4"/><rect x="16" y="28" width="64" height="23" fill="#d0b3d2" stroke="#715c7a" stroke-width="3"/><rect x="5" y="34" width="11" height="34" fill="#92739a"/><rect x="80" y="34" width="11" height="34" fill="#92739a"/><rect x="19" y="65" width="8" height="8" fill="#715c7a"/><rect x="69" y="65" width="8" height="8" fill="#715c7a"/>',
      '餐桌':'<rect x="12" y="30" width="72" height="12" fill="#bd936d" stroke="#785943" stroke-width="4"/><rect x="21" y="42" width="8" height="30" fill="#896448"/><rect x="67" y="42" width="8" height="30" fill="#896448"/><rect x="35" y="21" width="26" height="8" fill="#e6c8a3"/>',
      '书架':'<rect x="20" y="9" width="56" height="65" fill="#a77c62" stroke="#664e48" stroke-width="4"/><path d="M23 31H73M23 51H73" stroke="#664e48" stroke-width="4"/><rect x="27" y="15" width="10" height="14" fill="#a9b9c8"/><rect x="40" y="13" width="9" height="16" fill="#d2a27d"/><rect x="53" y="17" width="14" height="12" fill="#8fa77f"/><rect x="28" y="35" width="12" height="14" fill="#d9c08a"/><rect x="44" y="34" width="10" height="15" fill="#9985ad"/><rect x="58" y="36" width="10" height="13" fill="#a9b9c8"/>',
      '咖啡机':'<rect x="23" y="12" width="50" height="54" fill="#9daeb0" stroke="#596c72" stroke-width="4"/><rect x="32" y="20" width="32" height="18" fill="#d7e5df"/><rect x="36" y="44" width="24" height="8" fill="#5d6670"/><rect x="38" y="57" width="20" height="11" fill="#f1e1c7" stroke="#866d68" stroke-width="3"/><rect x="46" y="39" width="5" height="10" fill="#6a4c3d"/>',
      '服装架':'<path d="M17 18H79M24 18V70M72 18V70" stroke="#78647a" stroke-width="5"/><path d="M30 23V47H42V23M44 23V48H57V23M60 23V47H69V23" fill="#d3afc9" stroke="#8b6c8c" stroke-width="3"/><path d="M35 20l-5 7M49 20l-5 7M64 20l-4 7" stroke="#78647a" stroke-width="3"/>',
      '试衣镜':'<rect x="29" y="6" width="38" height="64" rx="0" fill="#b4d0d2" stroke="#826d7d" stroke-width="5"/><rect x="35" y="13" width="26" height="49" fill="#d9e7e0"/><rect x="20" y="70" width="56" height="5" fill="#826d7d"/>',
      '收银台':'<rect x="11" y="30" width="74" height="38" fill="#b58c70" stroke="#765947" stroke-width="4"/><rect x="23" y="15" width="26" height="17" fill="#91b8b7" stroke="#596d6a" stroke-width="3"/><rect x="55" y="20" width="18" height="10" fill="#f4e3bd"/>',
      '长椅':'<rect x="16" y="35" width="64" height="10" fill="#b58a61" stroke="#70533e" stroke-width="3"/><rect x="16" y="49" width="64" height="10" fill="#c49b70" stroke="#70533e" stroke-width="3"/><rect x="23" y="59" width="7" height="15" fill="#70533e"/><rect x="66" y="59" width="7" height="15" fill="#70533e"/>',
      '喷泉':'<rect x="12" y="54" width="72" height="17" fill="#8ab7c0" stroke="#547b87" stroke-width="4"/><rect x="26" y="43" width="44" height="11" fill="#a5d0d4" stroke="#547b87" stroke-width="3"/><rect x="42" y="21" width="12" height="22" fill="#85b8c5"/><rect x="46" y="11" width="4" height="10" fill="#b3dce0"/>',
      '花坛':'<rect x="10" y="47" width="76" height="25" fill="#9b775b" stroke="#72533f" stroke-width="4"/><rect x="22" y="32" width="10" height="17" fill="#6f9a63"/><rect x="43" y="25" width="10" height="24" fill="#80a96a"/><rect x="65" y="32" width="10" height="17" fill="#6f9a63"/><rect x="19" y="25" width="16" height="10" fill="#d6a2bd"/><rect x="40" y="16" width="16" height="12" fill="#e4c27c"/><rect x="62" y="25" width="16" height="10" fill="#d6a2bd"/>',
      '课桌':'<rect x="12" y="27" width="76" height="14" fill="#c39a72" stroke="#76583e" stroke-width="4"/><rect x="19" y="41" width="8" height="31" fill="#876648"/><rect x="72" y="41" width="8" height="31" fill="#876648"/><rect x="35" y="16" width="25" height="8" fill="#f1e3ca"/>',
      '黑板':'<rect x="8" y="8" width="80" height="56" fill="#496b5b" stroke="#8e725f" stroke-width="6"/><path d="M20 23H74M20 35H63M20 47H70" stroke="#e7e3c7" stroke-width="3"/><rect x="43" y="65" width="10" height="8" fill="#8e725f"/>',
      '工作台':'<rect x="10" y="32" width="76" height="15" fill="#bd946f" stroke="#765943" stroke-width="4"/><rect x="18" y="47" width="8" height="24" fill="#825e47"/><rect x="70" y="47" width="8" height="24" fill="#825e47"/><rect x="36" y="17" width="24" height="13" fill="#9bb9b2" stroke="#5f7773" stroke-width="3"/>',
      '书桌':'<rect x="10" y="31" width="76" height="14" fill="#bd946f" stroke="#765943" stroke-width="4"/><rect x="19" y="45" width="8" height="27" fill="#825e47"/><rect x="69" y="45" width="8" height="27" fill="#825e47"/><rect x="35" y="18" width="27" height="10" fill="#e9e0c9"/>',
      '画架':'<path d="M48 10L20 72M48 10L76 72M48 10V76" stroke="#806248" stroke-width="5"/><rect x="27" y="18" width="42" height="37" fill="#f3e5cb" stroke="#8c7280" stroke-width="4"/><path d="M33 47L44 33 53 41 63 27" stroke="#b58cae" stroke-width="4" fill="none"/>'
    };
    return `<svg viewBox="0 0 96 80" ${common} aria-hidden="true"><rect x="3" y="74" width="90" height="3" fill="#88756e"/>${icons[name]||icons['工作台']}</svg>`;
  }
  function furnitureList(type){
    const lists={home:[['床',22,72],['沙发',52,73],['餐桌',79,54],['书架',23,33]],cafe:[['咖啡机',77,34],['餐桌',27,67],['沙发',55,75]],shop:[['服装架',27,37],['试衣镜',70,37],['收银台',50,72]],park:[['长椅',28,67],['喷泉',70,45],['花坛',50,78]],school:[['课桌',26,63],['黑板',50,32],['书架',77,62]],studio:[['画架',30,43],['沙发',70,72],['工作台',71,34]]};
    return lists[type]||lists.studio;
  }
  function renderCityList(){const box=$('scCityList');if(!box)return;box.innerHTML=worlds.length?worlds.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).map(w=>`<article class="sc-city-card"><div><b>${esc(w.name)}</b><small>${(w.residents||[]).length} 位居民 · ${esc(dateLabel(w.worldNow||w.createdAt))} · 更新 ${esc(new Date(w.updatedAt||w.createdAt).toLocaleDateString())}</small></div><button class="sc-btn sc-primary" data-sc-action="enter-city" data-id="${esc(w.id)}">进入</button><button class="sc-btn sc-soft" data-sc-action="export-one" data-id="${esc(w.id)}">备份</button></article>`).join(''):'<div class="sc-note">还没有城市。创建一座城市，选择主页 CHAR 加入，居民会从第一天开始自主生活。</div>'}
  function renderContactChoices(){const box=$('scContactChoices');if(!box)return;const list=people();box.innerHTML=list.length?list.map(p=>`<label class="sc-choice"><input type="checkbox" value="${esc(p.id)}"><span><b>${esc(p.name)}</b><br><small>${esc(p.role||'主页 CHAR')}</small></span></label>`).join(''):'<div class="sc-note">主页还没有 CHAR，可以稍后再添加。</div>';const sel=$('scPersonaSelect');const ps=personas();document.querySelector('#scCreatePanel .sc-persona-warning')?.remove();sel.innerHTML='<option value="">请选择你创建的自设</option>'+ps.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'未命名自设')}</option>`).join('');if(!ps.length){sel.disabled=true;sel.insertAdjacentHTML('afterend','<p class="sc-note sc-persona-warning">当前主页没有可用自设。请先到主页【自设】创建一个角色，再回来建立城市。</p>')}else{sel.disabled=false;document.querySelector('#scCreatePanel .sc-persona-warning')?.remove()}}
  function setTab(tab){currentScreen=tab;['map','residents','relations','records','settings'].forEach(k=>{$('scView'+k[0].toUpperCase()+k.slice(1)).hidden=k!==tab});document.querySelectorAll('#scWorld .sc-tabs [data-sc-tab]').forEach(b=>b.classList.toggle('active',b.dataset.scTab===tab));if(tab==='residents')renderResidents();if(tab==='relations')renderRelations();if(tab==='records')renderRecords('logs');if(tab==='settings')fillSettings()}
  function normalizePlayerResident(){
    if(!world)return;
    const old=world.residents.find(r=>r.kind==='user');if(!old)return;
    const linked=personas().find(p=>String(p.id)===String(old.sourceId||world.personaRef?.id||''));
    if(linked){old.sourceId=linked.id;old.name=linked.name;old.age=Number(linked.age)||old.age||24;old.role=linked.role||'用户自设';old.personality=linked.personality||linked.description||'';old.avatar=linked.avatar||'';old.personaSnapshot=clone(linked);world.personaRef={id:linked.id,snapshot:clone(linked)};return}
    if(!old.sourceId||!old.personaSnapshot){
      const exact=personas().find(p=>String(p.name||'').trim()===String(old.name||'').trim());
      if(exact){old.sourceId=exact.id;old.name=exact.name;old.age=Number(exact.age)||old.age||24;old.role=exact.role||'用户自设';old.personality=exact.personality||exact.description||'';old.avatar=exact.avatar||'';old.personaSnapshot=clone(exact);world.personaRef={id:exact.id,snapshot:clone(exact)};return}
      world.residents=world.residents.filter(r=>r.id!==old.id);
      world.relationships=(world.relationships||[]).filter(r=>r.a!==old.id&&r.b!==old.id);
      (world.families||[]).forEach(f=>f.memberIds=(f.memberIds||[]).filter(x=>x!==old.id));
      world.currentController=world.residents[0]?.id||'';
      log('移除未关联的默认用户角色','旧版本自动生成的「'+old.name+'」不是主页自设，已从城市居民中移除。请通过【添加居民 → 添加用户自设】选择你自己创建的角色。','system');
      world._needsPersonaNotice=true;
    }
  }
  function openWorld(id){const found=worlds.find(w=>w.id===id);if(!found)return;world=found;activeId=id;world.settings={...clone(DEFAULT_SETTINGS),...(world.settings||{})};if(!world.map)world.map={buildings:clone(BUILDINGS),unlockedAreas:['中心城区']};if(!Array.isArray(world.map.buildings))world.map.buildings=clone(BUILDINGS);if(!Array.isArray(world.residents))world.residents=[];if(!Array.isArray(world.relationships))world.relationships=[];if(!Array.isArray(world.families))world.families=[];if(!Array.isArray(world.logs))world.logs=[];if(!world.worldNow)world.worldNow=now();if(!world.lastRealAt)world.lastRealAt=now();normalizePlayerResident();normalizePixelLooks();normalizeExistingCoupleHomes();const needsPersonaNotice=!!world._needsPersonaNotice;delete world._needsPersonaNotice;$('space').classList.add('sc-city-immersive');$('scLobby').hidden=true;$('scCreatePanel').hidden=true;$('lrSpaceV2Directory').hidden=false;$('scWorld').hidden=false;$('scInterior').hidden=true;$('scWorldName').textContent=world.name;$('scWorldDate').textContent=dateLabel(world.worldNow);setTab('map');advanceTime();renderMap();renderLatestLogs();fillController();persist();startTicker();if(needsPersonaNotice)notify('旧版自动生成的用户角色已移除，请添加你在主页创建的自设。')}
  function createCity(){const personaId=$('scPersonaSelect').value;const persona=personas().find(p=>String(p.id)===String(personaId));if(!persona){notify('请先在主页创建并选择一个自设，SPACE CITY 不会自动生成用户角色。');return}const name=$('scNewCityName').value.trim()||'我的像素城市';const ids=[...document.querySelectorAll('#scContactChoices input:checked')].map(x=>x.value);const w=worldTemplate(name,ids,personaId);worlds.push(w);activeId=w.id;world=w;persist().then(ok=>{if(ok){renderCityList();openWorld(w.id);notify('城市创建成功！已使用你选择的主页自设。')}else notify('城市创建失败，请检查浏览器存储。')})}
  function renderMap(){if(!world)return;$('scWorldName').textContent=world.name;$('scWorldDate').textContent=dateLabel(world.worldNow);$('scClock').textContent=timeLabel(world.worldNow);$('scWeather').textContent=({sunny:'☀ 晴天',cloudy:'☁ 多云',rain:'☂ 下雨',snow:'❄ 下雪',wind:'༄ 微风'}[world.settings.weather]||'☀ 晴天');$('scSeason').textContent=({spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'}[world.settings.season]||'春季');$('scResidentCount').textContent=world.residents.length+' 位居民';$('scAreaName').textContent=world.map.activeArea||'中心城区';const areaSelect=$('scAreaSelect');if(areaSelect){areaSelect.innerHTML=(world.map.unlockedAreas||['中心城区']).map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');areaSelect.value=world.map.activeArea||'中心城区'}
    const buildings=(world.map.buildings||[]).filter(x=>x.area===(world.map.activeArea||'中心城区')||!x.area);
    const b=$('scBuildings');b.innerHTML=buildings.map(x=>`<button class="sc-building" data-sc-building="${esc(x.id)}" aria-label="进入${esc(x.name)}"><span class="sc-building-art">${buildingSvg(x.type)}</span><b>${esc(x.name)}</b><small>${esc(x.open||'全天')}</small></button>`).join('');
    const sprites=$('scSprites');sprites.innerHTML=world.residents.map(r=>{const p=r.position||{x:50,y:52};return `<button class="sc-sprite" style="left:${clamp(p.x,2,96)}%;top:${clamp(p.y,8,94)}%" data-sc-resident="${esc(r.id)}" aria-label="${esc(r.name)}">${sprite(r)}<span class="sc-sprite-label">${esc(r.name)}</span></button>`}).join('');
    fillController();$('scTownMap').dataset.area=world.map.activeArea||'中心城区';}
  function renderLatestLogs(){const box=$('scLatestLogs');if(!box||!world)return;box.innerHTML=(world.logs||[]).slice(0,3).map(l=>`<div class="sc-log"><b>${esc(l.title)}</b><small>${esc(timeLabel(l.at))} · ${esc(l.kind||'生活')}</small><p>${esc(l.detail)}</p></div>`).join('')||'<div class="sc-note">居民正在熟悉这座城市。</div>'}
  function fillController(){const s=$('scControllerSelect');if(!s||!world)return;s.innerHTML=world.residents.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${r.kind==='user'?'用户':r.kind==='char'?'CHAR':'NPC'}</option>`).join('');controlResidentId=world.currentController||world.residents.find(r=>r.kind==='user')?.id||world.residents[0]?.id||'';s.value=controlResidentId}
  function enterInterior(id){const b=world.map.buildings.find(x=>x.id===id);if(!b)return;interiorBuildingId=id;world.currentLocation=id;const moving=currentResident(controlResidentId);if(moving){moving.buildingId=id;moving.status='在 '+b.name+' 活动';moveResident(moving,50,83)}persist();$('space').classList.add('sc-city-immersive');$('scWorld').hidden=true;$('scInterior').hidden=false;$('scInteriorName').textContent=b.name;$('scRoomFurniture').innerHTML=furnitureList(b.type).map(f=>`<button class="sc-furniture" style="left:${f[1]}%;top:${f[2]}%" data-sc-furniture="${esc(f[0])}" aria-label="${esc(f[0])}"><span class="sc-furniture-art">${furnitureSvg(f[0])}</span><span class="sc-furniture-label">${esc(f[0])}</span></button>`).join('');renderInteriorResidents();} 
  function renderInteriorResidents(){const box=$('scRoomResidents');if(!box)return;const here=world.residents.filter(r=>(r.buildingId||r.homeId||'home')===interiorBuildingId);box.innerHTML=here.map((r,i)=>{const p=r.roomPosition||{x:18+(i%4)*20,y:78-Math.floor(i/4)*22};return `<button class="sc-room-person" style="left:${p.x}%;top:${p.y}%" data-sc-resident="${esc(r.id)}" aria-label="查看 ${esc(r.name)} 档案">${sprite(r)}</button>`}).join('')}
  function renderResidents(){const box=$('scResidentList');if(!box||!world)return;box.innerHTML=world.residents.map(r=>`<article class="sc-resident-card"><div class="sc-resident-avatar">${sprite(r)}</div><div class="sc-resident-info"><b>${esc(r.name)}</b><small>${r.kind==='user'?'用户角色':r.kind==='char'?'主页 CHAR':'NPC'} · ${r.age} 岁 · ${esc(r.role||'居民')}<br>${esc(r.status||'自由活动')} · ${esc(world.map.buildings.find(b=>b.id===r.buildingId)?.name||'城市')}</small><span class="sc-tag">${r.wardrobe?.auto===false?'手动穿搭':'自动换装'}</span></div><div class="sc-resident-actions"><button data-sc-action="profile" data-id="${esc(r.id)}">档案</button><button data-sc-action="closet-one" data-id="${esc(r.id)}">换装</button><button data-sc-action="control-one" data-id="${esc(r.id)}">控制</button><button data-sc-action="interact" data-id="${esc(r.id)}">互动</button></div></article>`).join('')}
  function renderRelations(){const a=$('scRelA'),b=$('scRelB');if(!world)return;const opts=world.residents.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');a.innerHTML=opts;b.innerHTML=opts;if(world.residents[1])b.value=world.residents[1].id;const fam=$('scFamilyList');fam.innerHTML=(world.families||[]).map(f=>`<article class="sc-family-card"><b>${esc(f.name)}</b><p>${(f.memberIds||[]).map(id=>displayResident(currentResident(id))).join('、')}</p><small class="sc-family-home">⌂ 共同住所：${esc(world.map.buildings.find(x=>x.id===f.sharedHomeId)?.name||'居民公寓')}</small></article>`).join('')||'<div class="sc-note">还没有家庭档案。</div>';const rel=$('scRelationshipList');rel.innerHTML=world.relationships.length?world.relationships.map(r=>`<div class="sc-rel-card"><span>${esc(displayResident(currentResident(r.a)))} ⇄ ${esc(displayResident(currentResident(r.b)))}</span><b>${(REL_LABELS[r.type]||r.type)} · ${clamp(r.affinity,0,100)}%</b></div>`).join(''):'<div class="sc-note">目前还没有明确的关系。</div>'}
  function renderRecords(tab='logs'){
    const box=$('scRecordContent');if(!box||!world)return;document.querySelectorAll('[data-sc-record]').forEach(b=>b.classList.toggle('active',b.dataset.scRecord===tab));
    if(tab==='logs')box.innerHTML=(world.logs||[]).map(l=>`<article class="sc-record-item"><b>${esc(l.title)}</b><small>${esc(dateLabel(l.at))} ${esc(timeLabel(l.at))} · ${esc(l.kind)}</small><p>${esc(l.detail)}</p></article>`).join('')||'<div class="sc-note">暂时还没有生活日志。</div>';
    else if(tab==='events')box.innerHTML=(world.events||[]).map(e=>`<article class="sc-record-item"><b>${esc(e.title)} ${e.status==='pending'?'· 待确认':''}</b><small>${esc(dateLabel(e.at))}</small><p>${esc(e.detail)}</p>${e.status==='pending'?`<div class="sc-short-actions"><button class="sc-btn sc-primary" data-sc-action="approve-event" data-id="${esc(e.id)}">确认</button><button class="sc-btn sc-soft" data-sc-action="reject-event" data-id="${esc(e.id)}">暂不执行</button></div>`:''}</article>`).join('')||'<div class="sc-note">还没有人生事件。</div>';
    else if(tab==='photos')box.innerHTML=`<button class="sc-btn sc-primary" data-sc-action="add-photo">＋ 添加生活照片</button><div class="sc-photo-grid">${(world.photos||[]).map(p=>`<img src="${esc(p.data)}" alt="${esc(p.caption||'城市生活照片')}">`).join('')}</div>`;
    else box.innerHTML=`<button class="sc-btn sc-primary" data-sc-action="add-calendar">＋ 添加纪念日 / 活动</button>`+(world.calendar||[]).map(c=>`<article class="sc-record-item"><b>${esc(c.title)}</b><small>${esc(c.date||'未设定日期')} · ${esc(c.kind||'纪念日')}</small><p>${esc(c.note||'')}</p></article>`).join('');
  }
  function fillSettings(){if(!world)return;const s=world.settings;$('scSpeed').value=s.speed||'standard';$('scCustomSpeed').value=s.customSpeed||20;$('scCustomSpeedValue').textContent=(s.customSpeed||20)+'×';$('scCustomSpeedWrap').hidden=s.speed!=='custom';$('scPaused').checked=!!s.paused;$('scResidentLimit').value=s.residentLimit||24;$('scWeatherSelect').value=s.weather||'sunny';$('scSeasonSelect').value=s.season||'spring';const device=Number(navigator.deviceMemory||4),suggest=Math.min(48,Math.round(device*5+(Number(navigator.hardwareConcurrency)||4)*1.5));$('scCapacityNote').textContent='当前设备建议容量约 '+suggest+' 位；可自行调整，最高 150 位。超过建议容量时，系统会减少非可见居民的更新频率。离线补算最多处理 180 个城市日，以避免长时间离线后手机运算过重。'}
  function speedMultiplier(){const s=world.settings;return ({realtime:1,slow:5,standard:20,fast:60,custom:clamp(s.customSpeed,1,120)})[s.speed]||20}
  function scheduleFor(r,hour){let dest=r.homeId||'home',status='居家';if(hour>=7&&hour<9){dest=r.homeId||'home';status='准备出门'}else if(hour>=9&&hour<17){dest=r.kind==='npc'&&r.role.includes('学生')?'school':(r.jobId||'cafe');status=r.role.includes('学生')?'学习中':'工作中'}else if(hour>=17&&hour<21){dest=['cafe','park','studio'][Math.abs((r.name||'').length)%3];status='外出活动'}else if(hour>=21){dest=r.homeId||'home';status=hour>=23?'休息中':'居家放松'}else{dest=r.homeId||'home';status='睡眠中'}return {dest,status}}
  function moveResident(r,x,y){r.position={x:clamp(x,4,96),y:clamp(y,10,92)};}
  function dailyRoutine(){
    if(!world)return;const hour=stamp().getHours();
    world.residents.forEach((r,i)=>{
      if(r.controlled)return;
      const target=scheduleFor(r,hour);if(r.buildingId!==target.dest||r.status!==target.status){r.buildingId=target.dest;r.status=target.status;const b=world.map.buildings.find(x=>x.id===target.dest)||world.map.buildings[i%world.map.buildings.length];if(b)moveResident(r,20+(i%4)*19+(Math.random()*4-2),49+Math.floor(i/4)*8+(Math.random()*3-1.5));log(r.name+' · '+target.status,(world.map.buildings.find(x=>x.id===target.dest)?.name||'城市')+'，按自己的日程开始活动。','routine',r.id);}
      if(r.wardrobe?.auto!==false){r.wardrobe.dayOutfit=r.wardrobe.dayOutfit||clone(r.outfit);r.wardrobe.sleepOutfit=r.wardrobe.sleepOutfit||{...clone(r.outfit),top:'top-tee',topColor:'#d9c9d8',bottom:'bottom-shorts',bottomColor:'#b9a6bd',sleepwear:'sleep-set'};const isSleep=hour>=22||hour<7;const targetOutfit=isSleep?r.wardrobe.sleepOutfit:r.wardrobe.dayOutfit;if(targetOutfit){r.outfit=clone(targetOutfit);r.outfit.isSleeping=isSleep;}}
    });
  }
  function autoNpcRelationships(){
    const npcs=world.residents.filter(r=>r.kind==='npc'&&r.age>=18);
    for(let i=0;i<npcs.length;i++)for(let j=i+1;j<npcs.length;j++){
      const a=npcs[i],b=npcs[j],rel=relationship(a.id,b.id);
      if(!rel){const affinity=Math.random()<.22?Math.floor(Math.random()*9):0;if(affinity>0)addRelationship(a.id,b.id,'friend','auto',affinity);continue}
      if(rel.type==='friend')rel.affinity=clamp((rel.affinity||0)+(Math.random()<.42?2:0),0,100);
      if(rel.type==='friend'&&rel.affinity>=65&&Math.random()<.08){rel.type='lover';rel.locked=true;rel.since=world.worldNow;const family=makeCoupleFamily(a,b);log('新的恋爱关系',a.name+' 与 '+b.name+' 开始交往，并安排共同住所：'+(world.map.buildings.find(x=>x.id===family?.sharedHomeId)?.name||'居民公寓')+'。','relationship');}
      else if(rel.type==='lover'&&rel.since&&world.worldNow-rel.since>5*86400000&&Math.random()<.025){rel.type='spouse';log('NPC 结婚了',a.name+' 与 '+b.name+' 决定成为家人，并开始共同生活。','family');makeCoupleFamily(a,b);}
    }
  }
  function makeCoupleFamily(a,b,homeId,moveNow=true){
    if(!world||!a||!b)return null;
    const linkedFamilies=(world.families||[]).filter(f=>(f.memberIds||[]).some(id=>id===a.id||id===b.id));
    let fam=linkedFamilies[0];
    if(!fam){fam={id:uid('family'),name:a.name+'与'+b.name+'的家庭',memberIds:[],createdAt:world.worldNow,sharedHomeId:'home'};world.families.push(fam)}
    const mergedMembers=new Set([a.id,b.id,...linkedFamilies.flatMap(f=>f.memberIds||[])]);
    fam.memberIds=Array.from(mergedMembers);
    world.families=world.families.filter(f=>f===fam||!linkedFamilies.includes(f));
    const homes=(world.map.buildings||[]).filter(x=>x.type==='home');
    const valid=id=>homes.some(x=>x.id===id);
    const residence=valid(homeId)?homeId:(valid(fam.sharedHomeId)?fam.sharedHomeId:(valid(a.homeId)&&a.homeId===b.homeId?a.homeId:(valid(a.homeId)?a.homeId:(valid(b.homeId)?b.homeId:(homes[0]?.id||'home')))));
    fam.sharedHomeId=residence;
    fam.memberIds.forEach((id,i)=>{const member=currentResident(id);if(member){member.familyId=fam.id;member.householdId=fam.id;member.homeId=residence;if(moveNow){member.buildingId=residence;member.status='共同居住中';member.roomPosition={x:34+(i%3)*16,y:73};}}});
    return fam;
  }
  function normalizeExistingCoupleHomes(){
    if(!world)return;
    (world.relationships||[]).filter(rel=>['lover','spouse'].includes(rel.type)).forEach(rel=>{
      const a=currentResident(rel.a),b=currentResident(rel.b);if(!a||!b)return;
      const existing=(world.families||[]).some(f=>(f.memberIds||[]).includes(a.id)&&(f.memberIds||[]).includes(b.id));
      if(!existing||!a.homeId||a.homeId!==b.homeId)makeCoupleFamily(a,b,undefined,true);
    });
  }
  function socialPulse(){
    const established=(world.relationships||[]).filter(rel=>['lover','spouse'].includes(rel.type)).filter(rel=>currentResident(rel.a)&&currentResident(rel.b));
    if(established.length&&Math.random()<.35){const rel=established[Math.floor(Math.random()*established.length)],a=currentResident(rel.a),b=currentResident(rel.b);log(rel.type==='spouse'?'家庭日常':'恋人约会',a.name+' 和 '+b.name+' 一起度过了一段温馨时光。','relationship');}
    const npcs=world.residents.filter(r=>r.kind==='npc');if(npcs.length<2)return;
    const a=npcs[Math.floor(Math.random()*npcs.length)],near=npcs.filter(r=>r.id!==a.id&&r.buildingId===a.buildingId);if(!near.length)return;
    const b=near[Math.floor(Math.random()*near.length)],rel=relationship(a.id,b.id);
    if(!rel){addRelationship(a.id,b.id,'friend','auto',20);log('居民结识新朋友',a.name+' 在 '+(world.map.buildings.find(x=>x.id===a.buildingId)?.name||'城市')+' 认识了 '+b.name+'。','social');}
    else if(rel.type==='friend'){rel.affinity=clamp((rel.affinity||0)+5,0,100);log('居民日常交流',a.name+' 和 '+b.name+' 一起聊天，友谊更近了一些。','social');}
    else if(['lover','spouse'].includes(rel.type))log('居民亲密时光',a.name+' 和 '+b.name+' 一起度过了温馨时光。','social');
  }
  function randomLifeEvent(silent=false){
    const npcs=world.residents.filter(r=>r.kind==='npc');if(!npcs.length){if(!silent)notify('城市里还没有 NPC，添加 NPC 后就会出现更多自主事件。');return}
    const r=npcs[Math.floor(Math.random()*npcs.length)],type=['friend','trip','job','move'][Math.floor(Math.random()*4)];let event;
    if(type==='friend'){const other=npcs.find(x=>x.id!==r.id&&!relationship(x.id,r.id));if(!other){if(!silent)notify('NPC 之间已经有不少关系了。');return}event={title:'结识新朋友',detail:r.name+' 在日常活动中认识了 '+other.name+'。',apply:()=>addRelationship(r.id,other.id,'friend','auto',30)}}
    else if(type==='trip')event={title:'短途旅行',detail:r.name+' 想在周末去附近走走，暂时离开日常路线。',apply:()=>{r.status='短途旅行';r.buildingId='park';moveResident(r,76,45)}};
    else if(type==='job')event={title:'工作安排变化',detail:r.name+' 收到新的工作机会，想把工作地点调整到兴趣工作室。',apply:()=>{r.jobId='studio';r.role=r.role||'自由职业者'}};
    else event={title:'考虑搬家',detail:r.name+' 想换一个居住环境，计划搬到居民公寓。',apply:()=>{r.homeId='home';r.buildingId='home'}};
    event.id=uid('event');event.at=world.worldNow;event.residentId=r.id;event.status='approved';event.apply();world.events.unshift(event);log(event.title,event.detail,'event',r.id);if(!silent)persist().then(()=>{renderRecords('events');renderMap();notify('发生了一个 NPC 人生事件。')});
  }
  function approveEvent(id,yes){const e=world.events.find(x=>x.id===id);if(!e||e.status!=='pending')return;e.status=yes?'approved':'rejected';if(yes){const r=currentResident(e.residentId);if(r){if(e.kind==='move'){r.homeId='home';r.buildingId='home';r.status='已搬入新住所'}if(e.kind==='job'){r.jobId='studio';r.status='工作安排已更新'};if(e.kind==='trip'){r.status='短途旅行';r.buildingId='park';moveResident(r,76,45)}}log('已确认人生事件',e.title,'event',r?.id||'')}else log('人生事件暂缓',e.title,'event');persist().then(()=>renderRecords('events'))}
  function proposeCharEvent(){
    const chars=world.residents.filter(r=>r.kind==='char');if(!chars.length)return;
    const r=chars[Math.floor(Math.random()*chars.length)],kind=['move','job','trip'][Math.floor(Math.random()*3)];
    const title=kind==='move'?'搬家提议':kind==='job'?'工作安排提议':'旅行提议';
    const detail=kind==='move'?r.name+' 想更换居住环境。是否同意调整住所？':kind==='job'?r.name+' 想调整工作或学习地点。是否同意更新日程？':r.name+' 想安排一次短途旅行。是否同意加入日程？';
    if(world.events.some(e=>e.residentId===r.id&&e.status==='pending'&&e.kind===kind))return;
    world.events.unshift({id:uid('event'),at:world.worldNow,residentId:r.id,title,detail,kind,status:'pending'});
    log('等待用户确认',detail,'event',r.id);
  }
  function ambientMovement(){
    if(!world||world.settings.paused)return;
    world.residents.forEach(r=>{if(r.controlled||r.status==='睡眠中'||Math.random()>.28)return;const p=r.position||{x:50,y:50};moveResident(r,p.x+(Math.random()-.5)*2.2,p.y+(Math.random()-.5)*2.2)});
  }
  function advanceTime(){
    if(!world)return;
    const realNow=now(),last=Number(world.lastRealAt)||realNow;
    const elapsed=clamp(realNow-last,0,180*86400000);world.lastRealAt=realNow;
    if(world.settings.paused||elapsed<=0)return;
    const DAY=86400000,HOUR=3600000,MAX_CATCHUP_DAYS=180;
    let remaining=Math.min(elapsed*speedMultiplier(),MAX_CATCHUP_DAYS*DAY);
    let currentDay=new Date(world.worldNow||realNow).toDateString();
    let guard=0;
    while(remaining>0&&guard++<MAX_CATCHUP_DAYS*24+24){
      const d=new Date(world.worldNow||realNow);
      const nextHour=new Date(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()+1,0,0,0).getTime();
      const step=Math.max(1,Math.min(remaining,nextHour-(Number(world.worldNow)||realNow)));
      world.worldNow=(Number(world.worldNow)||realNow)+step;remaining-=step;
      dailyRoutine();
      const dayNow=new Date(world.worldNow).toDateString();
      if(dayNow!==currentDay){
        currentDay=dayNow;autoNpcRelationships();socialPulse();
        if(Math.random()<.25)randomLifeEvent(true);
        if(Math.random()<.12)proposeCharEvent();
        if(Math.random()<.3)world.settings.weather=['sunny','cloudy','rain','wind'][Math.floor(Math.random()*4)];
        const month=new Date(world.worldNow).getMonth()+1;
        world.settings.season=month>=3&&month<=5?'spring':month>=6&&month<=8?'summer':month>=9&&month<=11?'autumn':'winter';
      }
    }
    ambientMovement();
  }
  function startTicker(){clearInterval(tickTimer);tickTimer=setInterval(()=>{if(!world||!$('space')?.classList.contains('active'))return;advanceTime();renderMap();renderLatestLogs();if($('scInterior')&&!$('scInterior').hidden)renderInteriorResidents();persist()},10000)}
  function moveControlled(dx,dy){const r=currentResident(controlResidentId);if(!r||!world)return;r.controlled=true;world.currentController=r.id;const p=r.position||{x:50,y:50};moveResident(r,p.x+dx,p.y+dy);r.status='手动控制中';renderMap();persist()}
  function moveToPoint(e){const rect=$('scTownMap').getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*100,y=(e.clientY-rect.top)/rect.height*100;if(e.target.closest('.sc-building,.sc-sprite'))return;const r=currentResident(controlResidentId);if(!r)return;r.controlled=true;moveResident(r,x,y);r.status='手动移动中';renderMap();persist()}
  function modal(title,body,kicker='SPACE CITY'){ $('scModalTitle').textContent=title;$('scModalKicker').textContent=kicker;$('scModalBody').innerHTML='<div class="sc-modal-content">'+body+'</div>';$('scModal').hidden=false;openModal=title; }
  function closeModal(){$('scModal').hidden=true;openModal=''}
  let closetSlot='hair';
  const SKIN_TONES=['#f9dfc8','#edc5a8','#d9a782','#bd8968','#91634d','#704b3d'];
  function clothingArt(slot,item,color,baseResident){
    const outfit=baseResident?.outfit||DEFAULT_OUTFIT;
    const safeHex=(v,f)=>/^#[0-9a-f]{6}$/i.test(String(v||''))?String(v):f;
    const c=safeHex(color||({hair:outfit.hairColor,top:outfit.topColor,bottom:outfit.bottomColor,dress:outfit.topColor,outer:outfit.outerColor,shoes:outfit.shoeColor,accessory:outfit.accessoryColor,sleep:outfit.topColor,face:outfit.skin}[slot]),'#c4a4d3');
    const dark='#5a4b60',light=safeHex((baseResident?.outfit?.skin),'#edc5a8'),shade=(hex,amt)=>{const n=parseInt(hex.slice(1),16),a=[(n>>16)+amt,((n>>8)&255)+amt,(n&255)+amt].map(v=>clamp(v,0,255));return '#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('')};
    const grid=Array.from({length:48},()=>Array(40).fill(''));
    const paint=(x,y,w,h,col)=>{for(let yy=Math.max(0,y);yy<48&&yy<y+h;yy++)for(let xx=Math.max(0,x);xx<40&&xx<x+w;xx++)grid[yy][xx]=col};
    const row=(cy,y,widths,col)=>widths.forEach((w,i)=>{if(w)paint(cy-Math.floor(w/2),y+i,w,1,col)});
    const skinShadow=shade(light,-22),cl=shade(c,22),cd=shade(c,-24),hair=safeHex(outfit.hairColor,'#493d4c');
    if(slot==='hair'||slot==='face'){
      row(20,8,[10,16,20,20,20,18,16,14,12,10],slot==='face'?skin:hair);
      if(slot==='hair'){
        const length=item.includes('long')||item.includes('wave')||item.includes('curl')||/ponytail|twin|braid|wolf|mullet|curtain/.test(item);
        if(length){paint(9,16,4,19,hair);paint(27,16,4,19,shade(hair,-18))}
        if(item.includes('twin')){paint(5,14,5,17,hair);paint(30,14,5,17,hair)}
        if(item.includes('bun'))paint(14,3,12,6,hair);
        if(item.includes('ponytail'))paint(29,10,6,20,hair);
        if(item.includes('braid'))for(let y=18;y<34;y+=4){paint(9,y,4,3,y%2?shade(hair,20):hair);paint(27,y,4,3,y%2?hair:shade(hair,20))}
        paint(12,12,16,4,hair);paint(14,10,6,2,shade(hair,25));paint(12,18,3,6,shade(hair,-20));
      }else{
        paint(14,19,4,2,dark);paint(22,19,4,2,dark);paint(19,25,3,1,'#a96371');paint(13,24,3,1,'#e99b9e');paint(24,24,3,1,'#e99b9e');
      }
    }else if(slot==='top'||slot==='outer'){
      row(20,7,[8,14,20,24,22,18,18,18,18,18,18,18,18,18,18,18,18,18,18],c);
      paint(7,13,7,8,c);paint(26,13,7,8,c);paint(11,15,3,15,cd);paint(27,15,3,15,cl);
      paint(17,7,6,3,slot==='outer'?cd:'#f1dedc');paint(19,10,2,15,cl);
      if(item.includes('shirt')||item.includes('blouse')||item.includes('blazer')){paint(18,9,4,3,'#fbf1e7');for(let y=13;y<29;y+=4)paint(20,y,1,1,'#f5e1c2')}
      if(item.includes('knit')||item.includes('sweater'))for(let y=14;y<31;y+=4){paint(12,y,16,1,cl)}
      if(item.includes('hoodie')){paint(15,5,10,5,cd);paint(18,8,4,2,cl)}
      if(item.includes('cardigan'))paint(19,10,2,22,cd);
      if(item.includes('turtleneck'))paint(16,5,8,4,cd);
    }else if(slot==='bottom'){
      paint(10,8,20,4,cd);
      if(/skirt|pleated|long-skirt|culottes/.test(item)){
        const widths=item.includes('long')?[18,20,22,24,26,28,28,26,24,22,20,18,18,18]:[18,20,22,24,26,28,28,26,24];row(20,12,widths,c);
        for(let x=13;x<=25;x+=5)paint(x,17,1,widths.length-3,cl);
      }else{
        paint(11,12,8,30,c);paint(21,12,8,30,c);paint(12,13,2,23,cl);paint(26,13,2,23,cd);
        if(item.includes('jeans')){paint(15,14,1,24,'#d9e2ec');paint(24,14,1,24,'#d9e2ec')}
        if(item.includes('cargo')){paint(9,25,5,5,cl);paint(26,25,5,5,cl)}
        if(item.includes('leggings')){paint(13,18,4,20,cl);paint(23,18,4,20,cl)}
      }
    }else if(slot==='dress'||slot==='sleep'){
      row(20,5,[8,14,20,24,22,20,18,18,18,18,18,20,22,24,26,26,24,22,20,18,18,16,14,12,10,8],c);
      paint(10,11,6,7,c);paint(24,11,6,7,c);paint(17,7,6,2,cl);
      paint(13,20,2,14,cd);paint(25,20,2,14,cl);
      if(item.includes('floral')||item.includes('party')){paint(14,31,2,2,'#f1d5d9');paint(24,36,2,2,'#f1d5d9');paint(19,26,2,2,'#e7cc8e')}
    }else if(slot==='shoes'){
      paint(7,17,12,18,c);paint(22,17,12,18,c);paint(7,31,13,4,dark);paint(22,31,13,4,dark);paint(9,19,5,2,cl);paint(24,19,5,2,cl);
      if(item.includes('boots')){paint(8,8,9,12,c);paint(23,8,9,12,c);paint(8,8,9,2,cd);paint(23,8,9,2,cd)}
      if(item.includes('sandal')){paint(8,24,10,2,'#d6b38d');paint(23,24,10,2,'#d6b38d')}
    }else if(slot==='accessory'){
      if(item.includes('glasses')){paint(5,18,12,2,c);paint(5,18,2,9,c);paint(15,18,2,9,c);paint(23,18,2,9,c);paint(33,18,2,9,c);paint(17,21,6,2,dark)}
      else if(item.includes('hat')){paint(6,17,28,4,c);paint(11,8,18,10,c);paint(12,8,16,2,cl)}
      else if(item.includes('bag')){paint(11,10,18,30,c);paint(13,13,14,24,cl);paint(17,18,4,4,cd)}
      else if(item.includes('necklace')){paint(12,10,2,18,c);paint(26,10,2,18,c);paint(17,26,7,2,c);paint(19,28,3,4,cl)}
      else if(item.includes('earrings')){paint(8,14,3,9,c);paint(29,14,3,9,c);paint(9,22,1,4,cl);paint(30,22,1,4,cl)}
      else if(item.includes('ribbon')){paint(7,12,11,7,c);paint(22,12,11,7,c);paint(17,14,6,4,cd)}
      else {paint(8,15,24,5,c);paint(13,8,14,8,cl);paint(18,14,4,3,cd)}
    }
    let out='';for(let y=0;y<48;y++){let x=0;while(x<40){const col=grid[y][x];if(!col){x++;continue}let end=x+1;while(end<40&&grid[y][end]===col)end++;out+=`<rect x="${x}" y="${y}" width="${end-x}" height="1" fill="${col}"/>`;x=end}}
    return `<svg class="sc-pixel-item" viewBox="0 0 40 48" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
  }
  function closetModal(id,slot='hair'){
    const r=currentResident(id||selectedResidentId);if(!r)return;selectedResidentId=r.id;closetSlot=slot;
    const cats=[['hair','发型','✦'],['top','上衣','▱'],['bottom','下装','▤'],['dress','连衣裙','♧'],['outer','外套','◇'],['shoes','鞋子','⌑'],['accessory','配饰','✧'],['sleep','睡衣','☾'],['face','面容','☻']];
    const activeCat=cats.find(c=>c[0]===closetSlot)||cats[0];
    const selectedItem=closetSlot==='sleep'?(r.wardrobe.sleepOutfit?.sleepwear||'sleep-set'):(r.outfit[closetSlot]||'');
    const colorKey={hair:'hairColor',top:'topColor',bottom:'bottomColor',dress:'topColor',outer:'outerColor',shoes:'shoeColor',accessory:'accessoryColor',sleep:'topColor'}[closetSlot];
    const currentColor=closetSlot==='face'?(r.outfit.skin||SKIN_TONES[1]):((closetSlot==='sleep'?r.wardrobe.sleepOutfit?.[colorKey]:r.outfit[colorKey])||COLORS[0]);
    const choices=(CLOTHES[closetSlot]||[]).map(([item,label])=>`<button class="sc-clothes-item ${selectedItem===item?'active':''}" data-sc-cloth="${item}" data-slot="${closetSlot}"><span class="sc-cloth-thumb">${clothingArt(closetSlot,item,currentColor,r)}</span><span class="sc-cloth-name">${esc(label)}</span><span class="sc-cloth-check">${selectedItem===item?'✓':'选择'}</span></button>`).join('');
    const previewSprite=closetSlot==='sleep'?sprite({...r,outfit:{...(r.wardrobe.sleepOutfit||r.outfit),isSleeping:true}}):sprite(r);
    const faceGroups=[['faceShape','脸型',[['oval','鹅蛋脸'],['round','圆脸'],['soft-square','柔和方脸'],['auto','自动']]],['eyeShape','眼型',[['almond','杏眼'],['round','圆眼'],['narrow','细长眼'],['down','下垂眼'],['auto','默认']]],['browShape','眉形',[['soft','自然眉'],['straight','平眉'],['arched','弯眉'],['auto','默认']]],['bodyShape','身形轮廓',[['auto','根据角色资料'],['feminine','偏女性轮廓'],['masculine','偏男性轮廓'],['balanced','中性匀称']]]];
    const faceEditor=faceGroups.map(([key,label,opts])=>`<div class="sc-face-feature"><b>${label}</b><div>${opts.map(([v,n])=>`<button class="${(r.outfit[key]||'auto')===v?'active':''}" data-sc-face-feature="${key}" data-sc-face-value="${v}">${n}</button>`).join('')}</div></div>`).join('');
    const itemChoices=closetSlot==='face'?`<div class="sc-face-editor">${faceEditor}<p class="sc-note">面容由真实像素色块组合，调整后会同步到衣柜、地图、室内和居民档案。</p></div>`:choices;
    const outfitLabel=Object.values(CLOTHES).flat().find(([key])=>key===selectedItem)?.[1]||'自定义搭配';
    $('scModalTitle').textContent=r.name+' · 专属衣帽间';$('scModalKicker').textContent='THE LITTLE WARDROBE · STYLE STUDIO';$('scModal').hidden=false;openModal='衣柜';
    $('scModalBody').dataset.closetResident=r.id;
    $('scModalBody').innerHTML=`<div class="sc-modal-content sc-closet-content">
      <section class="sc-closet-stage"><div class="sc-closet-stage-top"><span>DAILY LOOK</span><span class="sc-closet-live">● LIVE PREVIEW</span></div><div class="sc-closet-mirror"><div class="sc-closet-mirror-glow"></div><div class="sc-closet-avatar">${previewSprite}</div><div class="sc-closet-plinth"></div></div><div class="sc-closet-caption"><div><small>正在试穿</small><b>${esc(outfitLabel)}</b></div><span class="sc-closet-star">✦</span></div></section>
      <section class="sc-closet-section"><div class="sc-closet-section-head"><div><small>COLLECTION</small><h3>挑选单品</h3></div><span>${closetSlot==='face'?'4 项面容设置':(CLOTHES[closetSlot]||[]).length+' 件可选'}</span></div><div class="sc-closet-categories">${cats.map(([k,n,ico])=>`<button class="${closetSlot===k?'active':''}" data-sc-slot="${k}"><i>${ico}</i><span>${n}</span></button>`).join('')}</div><div class="sc-closet-picked"><b>${activeCat[1]}</b><span>点击单品，即时预览效果</span></div><div class="sc-clothes-grid ${closetSlot==='face'?'sc-face-grid':''}">${itemChoices}</div></section>
      <section class="sc-closet-section sc-color-section"><div class="sc-closet-section-head"><div><small>COLOR PALETTE</small><h3>${closetSlot==='face'?'肤色选择':'专属配色'}</h3></div><span>${closetSlot==='face'?SKIN_TONES.length+' 种肤色':COLORS.length+' 种颜色'}</span></div><div class="sc-color-row">${(closetSlot==='face'?SKIN_TONES:COLORS).map(c=>`<button class="sc-color-swatch ${currentColor===c?'active':''}" style="--swatch:${c};background:${c}" data-sc-color="${c}" data-slot="${closetSlot}" aria-label="选择颜色 ${c}"></button>`).join('')}</div></section>
      <section class="sc-closet-section"><div class="sc-closet-section-head"><div><small>MY LOOKBOOK</small><h3>我的穿搭收藏</h3></div><span>${(r.wardrobe.presets||[]).length} 套</span></div><div class="sc-closet-presets">${(r.wardrobe.presets||[]).map((p,i)=>`<button class="sc-lookbook-card" data-sc-outfit-preset="${i}"><span>${sprite({...r,outfit:p.outfit})}</span><b>${esc(p.name)}</b><small>点击套用</small></button>`).join('')||'<div class="sc-closet-empty">还没有收藏穿搭。完成搭配后，可以保存到这里。</div>'}</div></section>
      <div class="sc-closet-actions"><button class="sc-btn sc-soft" data-sc-action="save-outfit">＋ 保存搭配</button><button class="sc-btn sc-soft" data-sc-action="share-outfit">分享穿搭</button><button class="sc-btn ${r.wardrobe.auto===false?'sc-soft':'sc-primary'}" data-sc-action="toggle-auto-outfit">${r.wardrobe.auto===false?'开启自动换装':'自动换装：开启'}</button></div><button class="sc-btn sc-primary sc-full sc-closet-done" data-sc-action="close-modal">完成搭配</button></div>`;
  }
  function applyClothing(slot,id){const r=currentResident($('scModalBody').dataset.closetResident);if(!r)return;r.outfit[slot]=id;drawClosetRefresh();}
  function drawClosetRefresh(){const id=$('scModalBody').dataset.closetResident;closetModal(id)}
  function saveOutfit(){const r=currentResident($('scModalBody').dataset.closetResident);if(!r)return;const n=prompt('给这套穿搭取个名字：','我的搭配');if(!n)return;r.wardrobe.presets=r.wardrobe.presets||[];r.wardrobe.presets.push({name:n.slice(0,30),outfit:clone(r.outfit),createdAt:now()});persist();closetModal(r.id,closetSlot);notify('穿搭已保存。')}
  function shareOutfit(){const source=currentResident($('scModalBody').dataset.closetResident);if(!source)return;const others=world.residents.filter(r=>r.id!==source.id);if(!others.length){notify('城市里暂时没有其他居民。');return}modal('分享穿搭',`<p class="sc-note">把 ${esc(source.name)} 当前的像素穿搭复制给另一位居民。</p><select id="scOutfitTarget" class="sc-input">${others.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select><button class="sc-btn sc-primary sc-full" data-sc-action="apply-shared-outfit">应用这套穿搭</button>`)}
  function applySharedOutfit(){const source=selectedResidentId,target=currentResident($('scOutfitTarget')?.value);const from=currentResident(source);if(!from||!target)return;target.outfit=clone(from.outfit);target.wardrobe.dayOutfit=clone(from.wardrobe?.dayOutfit||from.outfit);target.wardrobe.sleepOutfit=clone(from.wardrobe?.sleepOutfit||from.outfit);target.wardrobe.auto=from.wardrobe?.auto!==false;target.wardrobe.presets=target.wardrobe.presets||[];target.wardrobe.presets.push({name:'来自 '+from.name+' 的穿搭',outfit:clone(from.outfit),createdAt:now()});log('分享穿搭',from.name+' 把一套穿搭分享给 '+target.name+'。','wardrobe',target.id);persist();closetModal(from.id,closetSlot);notify('穿搭已分享给 '+target.name+'。')}
  function renderProfile(id){
    const r=currentResident(id);if(!r)return;
    const expressions=[['neutral','自然','😐'],['happy','开心','😊'],['laugh','大笑','😆'],['shy','害羞','☺️'],['wink','眨眼','😉'],['sad','难过','🥺'],['cry','哭泣','😭'],['angry','生气','😠'],['surprised','惊讶','😲'],['sleepy','困倦','😴']];
    const poses=[['idle','站立','🧍'],['walk','行走','🚶'],['run','小跑','🏃'],['wave','挥手','👋'],['hug','拥抱','🫂'],['sit','坐下','🪑'],['read','阅读','📖'],['dance','跳舞','💃'],['sleep','睡觉','💤'],['work','工作','🧰'],['eat','用餐','🍽️'],['talk','聊天','💬'],['shop','购物','🛍️']];
    modal(r.name+' · 居民档案',`<div class="sc-outfit-preview sc-profile-preview" id="scProfilePreview">${sprite(r)}</div><p><b>${esc(r.name)}</b> · ${r.age} 岁</p><p>${esc(r.kind==='user'?'用户自设':r.kind==='char'?'主页 CHAR':'NPC')} · ${esc(r.role||'居民')}</p><p>${esc(r.personality||'还没有填写性格资料。')}</p><p>当前状态：<strong id="scProfileStatus">${esc(r.status||'自由活动')}</strong></p><section class="sc-expression-panel"><div class="sc-profile-pick-head"><b>人物表情</b><small>点击立即应用</small></div><div class="sc-profile-expression-grid">${expressions.map(([v,n,ico])=>`<button class="sc-profile-option ${r.expression===v?'active':''}" data-sc-expression="${v}" data-sc-id="${esc(id)}"><span>${ico}</span><b>${n}</b></button>`).join('')}</div><div class="sc-profile-pick-head"><b>人物动作</b><small>点击立即应用</small></div><div class="sc-profile-pose-grid">${poses.map(([v,n,ico])=>`<button class="sc-profile-option ${r.pose===v?'active':''}" data-sc-pose="${v}" data-sc-id="${esc(id)}"><span>${ico}</span><b>${n}</b></button>`).join('')}</div></section><div class="sc-short-actions"><button class="sc-btn sc-primary" data-sc-action="closet-one" data-id="${esc(id)}">换装</button><button class="sc-btn sc-soft" data-sc-action="control-one" data-id="${esc(id)}">手动控制</button><button class="sc-btn sc-soft" data-sc-action="edit-resident" data-id="${esc(id)}">编辑资料</button></div>`);
  }
  function applyProfileVisual(id,kind,value){
    const r=currentResident(id);if(!r)return;
    if(kind==='expression')r.expression=value;else if(kind==='pose')r.pose=value;
    const preview=$('scProfilePreview');if(preview)preview.innerHTML=sprite(r);const editPreview=$('scEditPreview');if(editPreview)editPreview.innerHTML=sprite(r);
    const status=$('scProfileStatus')||$('scEditStatus');if(status&&kind==='pose'){const labels={idle:'站立中',walk:'正在行走',run:'正在小跑',wave:'正在挥手',hug:'正在拥抱',sit:'坐下休息',read:'正在阅读',dance:'正在跳舞',sleep:'正在睡觉',work:'正在工作',eat:'正在用餐',talk:'正在交谈',shop:'正在购物'};r.status=labels[value]||r.status;status.textContent=r.status;}
    document.querySelectorAll('[data-sc-expression]').forEach(el=>el.classList.toggle('active',el.dataset.scExpression===r.expression));
    document.querySelectorAll('[data-sc-pose]').forEach(el=>el.classList.toggle('active',el.dataset.scPose===r.pose));
    log('角色状态更新',r.name+' 的'+(kind==='expression'?'表情':'动作')+'已调整。','appearance',r.id);
    renderMap();renderResidents();if(!$('scInterior').hidden)renderInteriorResidents();persist();notify(kind==='expression'?'表情已即时更换。':'动作已即时切换。');
  }
  function addResidentModal(){const contacts=people().filter(p=>!world.residents.some(r=>r.kind==='char'&&r.sourceId===p.id));const ps=personas().filter(p=>!world.residents.some(r=>r.kind==='user'&&r.sourceId===p.id));modal('添加居民',`<div class="sc-tabs-inline"><button class="active" data-sc-add-tab="npc">创建 NPC</button><button data-sc-add-tab="char">添加主页 CHAR</button><button data-sc-add-tab="persona">添加用户自设</button></div><div id="scAddResidentForm"><div class="sc-form-row"><label>居民姓名</label><input id="scNpcName" placeholder="输入姓名"></div><div class="sc-form-row"><label>年龄（固定）</label><input id="scNpcAge" type="number" min="1" max="100" value="24"></div><div class="sc-form-row"><label>人物身形倾向</label><select id="scNpcGender" class="sc-input"><option value="">中性 / 不指定</option><option value="女性">偏女性轮廓</option><option value="男性">偏男性轮廓</option></select></div><div class="sc-form-row"><label>职业 / 身份</label><input id="scNpcRole" placeholder="例如：咖啡师、学生、插画师"></div><div class="sc-form-row"><label>性格与兴趣</label><textarea id="scNpcPersonality" placeholder="例如：慢热、喜欢音乐和散步"></textarea></div><button class="sc-btn sc-primary sc-full" data-sc-action="create-npc">创建 NPC</button></div><div id="scAddCharList" hidden>${contacts.map(p=>`<button class="sc-clothes-item sc-full" data-sc-add-char="${esc(p.id)}">${esc(p.name)} · 添加为 CHAR</button>`).join('')||'<p>没有尚未加入城市的主页 CHAR。</p>'}</div><div id="scAddPersonaList" hidden>${ps.map(p=>`<button class="sc-clothes-item sc-full" data-sc-add-persona="${esc(p.id)}">${esc(p.name)} · 添加为用户角色</button>`).join('')||'<p class="sc-note">没有尚未加入城市的自设。请先在主页【自设】创建。</p>'}</div>`)}
  function addPersona(id){const p=personas().find(x=>String(x.id)===String(id));if(!p)return;if(world.residents.some(r=>r.kind==='user')){notify('这座城市已经有一个用户自设。请先移除现有用户角色，再添加其他自设。');return}if(world.residents.length>=world.settings.residentLimit){notify('已达到居民数量上限。');return}const r=makeResident({kind:'user',sourceId:p.id,name:p.name,gender:p.gender||p.sex||'',age:p.age||24,role:p.role||'用户自设',personality:p.personality||p.description||'',avatar:p.avatar||''});r.personaSnapshot=clone(p);world.personaRef={id:p.id,snapshot:clone(p)};r.position={x:48,y:52};world.residents.unshift(r);world.currentController=r.id;controlResidentId=r.id;log('用户自设加入城市',p.name+' 已作为用户角色加入城市。','resident',r.id);closeModal();renderResidents();renderMap();persist();notify('已添加你创建的自设。')}
  function createNpc(){const name=$('scNpcName')?.value.trim();if(!name){notify('请先填写 NPC 姓名。');return}if(world.residents.length>=world.settings.residentLimit){notify('已经达到当前居民数量上限。');return}const r=makeResident({kind:'npc',name,gender:$('scNpcGender')?.value||'',age:$('scNpcAge').value,role:$('scNpcRole').value,personality:$('scNpcPersonality').value});const n=world.residents.length;r.position={x:18+(n%4)*20,y:50+Math.floor(n/4)*8};world.residents.push(r);log('新居民入住',r.name+' 加入了这座城市。','resident',r.id);closeModal();renderResidents();renderMap();persist();notify('NPC 已加入城市。')}
  function addChar(id){const p=people().find(x=>x.id===id);if(!p)return;if(world.residents.length>=world.settings.residentLimit){notify('已达到居民数量上限。');return}const r=makeResident({kind:'char',sourceId:p.id,name:p.name,gender:p.gender||p.sex||'',role:p.role,personality:p.personality||p.description,avatar:p.avatar,age:p.age||24});const n=world.residents.length;r.position={x:18+(n%4)*20,y:50+Math.floor(n/4)*8};world.residents.push(r);log('CHAR 加入城市',p.name+' 加入了城市生活。','resident');closeModal();renderResidents();renderMap();persist()}
  function interactResident(id){const r=currentResident(id);if(!r)return;world.residents.forEach(x=>{if(x.id!==id&&x.kind==='npc'&&r.kind==='npc'){const rel=relationship(id,x.id);if(rel)rel.affinity=clamp(rel.affinity+8,0,100);else if(Math.random()<.5)addRelationship(id,x.id,'friend','auto',28)}});r.status='正在社交';log('居民互动',r.name+' 与其他居民进行了一次日常交流。','social',id);persist();renderResidents();renderRelations();notify('互动已记录，关系亲密度可能有所变化。')}
  function saveRelation(){const a=currentResident($('scRelA').value),b=currentResident($('scRelB').value),type=$('scRelType').value;if(!a||!b||a.id===b.id){notify('请选择两位不同居民。');return}if(['lover','spouse'].includes(type)&&!relationAllowed(a,b,true)){notify('这组角色不能由用户设定为恋爱关系：只允许用户与 CHAR、CHAR 与 CHAR（手动确认），以及 NPC 与 NPC。');return}addRelationship(a.id,b.id,type,'user',type==='friend'?25:100);if(type==='lover'||type==='spouse'){const fam=makeCoupleFamily(a,b);log('共同住所已安排',a.name+' 与 '+b.name+' 已成为'+(type==='spouse'?'夫妻':'恋人')+'，共同居住于 '+(world.map.buildings.find(x=>x.id===fam?.sharedHomeId)?.name||'居民公寓')+'。','family');}renderRelations();renderResidents();renderMap();persist();notify(['lover','spouse'].includes(type)?'关系已保存，双方已安排共同居住。':'关系设置已保存。')}
  function createFamily(){const opts=world.residents.map(r=>`<label class="sc-choice"><input type="checkbox" value="${esc(r.id)}"><span>${esc(r.name)}</span></label>`).join('');const homes=(world.map.buildings||[]).filter(b=>b.type==='home');const homeOpts=homes.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');modal('建立家庭',`<div class="sc-form-row"><label>家庭名称</label><input id="scFamilyName" placeholder="例如：云朵公寓"></div><div class="sc-form-row"><label>选择共同住所</label><select id="scFamilyHome" class="sc-input">${homeOpts||'<option value="home">居民公寓</option>'}</select></div><div class="sc-form-row"><label>选择家庭成员</label><div class="sc-choice-grid">${opts}</div></div><p class="sc-note">创建后，所有家庭成员会共享这处住所，并在居家时间回到这里。</p><button class="sc-btn sc-primary sc-full" data-sc-action="save-family">建立家庭并安排共同居住</button>`)}
  function saveFamily(){const ids=[...document.querySelectorAll('#scModalBody input[type=checkbox]:checked')].map(x=>x.value);if(ids.length<2){notify('至少选择两位家庭成员。');return}const name=$('scFamilyName').value.trim()||'我们的家庭';const homeId=$('scFamilyHome')?.value||'home';const linked=(world.families||[]).filter(f=>(f.memberIds||[]).some(id=>ids.includes(id)));const f=linked[0]||{id:uid('family'),createdAt:world.worldNow};f.name=name;f.memberIds=Array.from(new Set([...ids,...linked.flatMap(x=>x.memberIds||[])]));f.sharedHomeId=homeId;world.families=world.families.filter(x=>x===f||!linked.includes(x));if(!linked.length)world.families.push(f);f.memberIds.forEach((id,i)=>{const r=currentResident(id);if(r){r.familyId=f.id;r.householdId=f.id;r.homeId=homeId;if(ids.includes(id)){r.buildingId=homeId;r.status='家庭共同居住';r.roomPosition={x:28+(i%4)*15,y:73};}}});for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)if(!relationship(ids[i],ids[j]))addRelationship(ids[i],ids[j],'family','user',50);log('建立家庭',name+' 已建立，共同住所：'+(world.map.buildings.find(x=>x.id===homeId)?.name||'居民公寓')+'；成员：'+f.memberIds.map(id=>displayResident(currentResident(id))).join('、'),'family');closeModal();renderRelations();renderResidents();renderMap();persist();notify('家庭已建立，所有成员已经搬入共同住所。')}
  function openCalendar(){setTab('records');renderRecords('calendar')}
  function addCalendar(){const title=prompt('纪念日或活动名称：');if(!title)return;const date=prompt('日期（YYYY-MM-DD）：',new Date(world.worldNow).toISOString().slice(0,10))||'';world.calendar.push({id:uid('cal'),title:title.slice(0,60),date,kind:'纪念日',note:''});persist();renderRecords('calendar')}
  function exportBackup(id=''){const w=id?worlds.find(x=>x.id===id):world;if(!w)return;const blob=new Blob([JSON.stringify({format:'LOVE_RECORD_SPACE_CITY',version:1,exportedAt:now(),world:clone(w)},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=(w.name||'SPACE_CITY').replace(/[\\/:*?"<>|]/g,'_')+'.space-city.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  async function importBackup(file){try{const obj=JSON.parse(await file.text());const w=obj.world||obj;if(!w||!Array.isArray(w.residents)||!w.id)throw new Error('备份格式不正确');const copy=clone(w);copy.id=uid('import-city');copy.name=(copy.name||'导入城市')+'（导入）';copy.createdAt=now();copy.updatedAt=now();worlds.push(copy);await idbPut(copy);await writeRegistry();renderCityList();notify('城市备份已作为新城市导入，原有城市未覆盖。')}catch(e){notify('导入失败：'+e.message)}}
  function saveSettings(){advanceTime();const oldLimit=world.settings.residentLimit;world.settings.speed=$('scSpeed').value;world.settings.customSpeed=clamp($('scCustomSpeed').value,1,120);world.settings.realMultiplier=speedMultiplier();world.settings.paused=$('scPaused').checked;world.settings.residentLimit=clamp($('scResidentLimit').value,1,150);world.settings.weather=$('scWeatherSelect').value;world.settings.season=$('scSeasonSelect').value;world.map.weather=world.settings.weather;world.map.season=world.settings.season;if(world.residents.length>world.settings.residentLimit)notify('当前居民人数高于新上限。已有居民不会被删除，只是暂时不能新增。');persist();renderMap();notify('城市设置已保存。')}
  function expandArea(){const options=['海滨街区','城市中心','郊外住宅区','娱乐街区','高级住宅区'];const next=options.find(x=>!world.map.unlockedAreas.includes(x));if(!next){notify('所有预设新区都已解锁。');return}world.map.unlockedAreas.push(next);world.map.activeArea=next;const base=BUILDINGS.map((b,i)=>({...b,id:next+'-'+b.id,x:12+(i%3)*34,y:22+Math.floor(i/3)*47,area:next}));world.map.buildings.push(...base.slice(0,3));log('新区开放',next+' 已加入城市地图。','city');renderMap();persist();notify(next+' 已解锁。')}
  function addBuildingModal(){modal('新增城市建筑',`<div class="sc-form-row"><label>建筑名称</label><input id="scBuildingName" placeholder="例如：花店、图书馆、住宅"></div><div class="sc-form-row"><label>建筑类型</label><select id="scBuildingType" class="sc-input"><option value="home">住宅</option><option value="cafe">餐饮</option><option value="shop">商店</option><option value="park">公园</option><option value="school">学校</option><option value="studio">兴趣空间</option></select></div><div class="sc-form-row"><label>建筑简介</label><textarea id="scBuildingDesc" placeholder="描述这个地点的用途……"></textarea></div><button class="sc-btn sc-primary sc-full" data-sc-action="save-building">添加到当前区域</button>`)}
  function saveBuilding(){const name=$('scBuildingName')?.value.trim();if(!name){notify('请填写建筑名称。');return}const type=$('scBuildingType').value;const places=[[15,20],[48,17],[80,22],[20,69],[52,70],[83,69],[33,42],[67,43]];const used=new Set(world.map.buildings.filter(b=>(b.area||'中心城区')===(world.map.activeArea||'中心城区')).map(b=>b.x+','+b.y));const pos=places.find(p=>!used.has(p[0]+','+p[1]))||[10+Math.random()*80,15+Math.random()*70];const icons={home:'🏠',cafe:'☕',shop:'🛍️',park:'🌳',school:'🏫',studio:'🎨'};world.map.buildings.push({id:uid('building'),name,icon:icons[type]||'🏡',type,x:pos[0],y:pos[1],area:world.map.activeArea||'中心城区',desc:$('scBuildingDesc').value.trim(),open:'全天'});log('新建筑落成',name+' 已加入 '+(world.map.activeArea||'中心城区')+'。','city');closeModal();renderMap();persist();notify('新建筑已添加。')}
  function editResidentModal(id){
    const r=currentResident(id);if(!r)return;
    const expressions=[['neutral','自然','😐'],['happy','开心','😊'],['laugh','大笑','😆'],['shy','害羞','☺️'],['wink','眨眼','😉'],['sad','难过','🥺'],['cry','哭泣','😭'],['angry','生气','😠'],['surprised','惊讶','😲'],['sleepy','困倦','😴']];
    const poses=[['idle','站立','🧍'],['walk','行走','🚶'],['run','小跑','🏃'],['wave','挥手','👋'],['hug','拥抱','🫂'],['sit','坐下','🪑'],['read','阅读','📖'],['dance','跳舞','💃'],['sleep','睡觉','💤'],['work','工作','🧰'],['eat','用餐','🍽️'],['talk','聊天','💬'],['shop','购物','🛍️']];
    modal('编辑居民资料',`<div class="sc-outfit-preview sc-profile-preview" id="scEditPreview">${sprite(r)}</div><div class="sc-form-row"><label>姓名</label><input id="scEditName" value="${esc(r.name)}"></div><div class="sc-form-row"><label>固定年龄</label><input id="scEditAge" type="number" min="1" max="100" value="${r.age}"></div><div class="sc-form-row"><label>职业 / 身份</label><input id="scEditRole" value="${esc(r.role||'')}"></div><div class="sc-form-row"><label>性格与兴趣</label><textarea id="scEditPersonality">${esc(r.personality||'')}</textarea></div><section class="sc-expression-panel"><div class="sc-profile-pick-head"><b>人物表情</b><small>点击即时预览并保存</small></div><div class="sc-profile-expression-grid">${expressions.map(([v,n,ico])=>`<button class="sc-profile-option ${r.expression===v?'active':''}" data-sc-expression="${v}" data-sc-id="${esc(id)}"><span>${ico}</span><b>${n}</b></button>`).join('')}</div><div class="sc-profile-pick-head"><b>人物动作</b><small>点击即时预览并保存</small></div><div class="sc-profile-pose-grid">${poses.map(([v,n,ico])=>`<button class="sc-profile-option ${r.pose===v?'active':''}" data-sc-pose="${v}" data-sc-id="${esc(id)}"><span>${ico}</span><b>${n}</b></button>`).join('')}</div></section><button class="sc-btn sc-primary sc-full" data-sc-action="save-resident" data-id="${esc(id)}">保存资料</button>`);
  }
  function saveResident(id){const r=currentResident(id);if(!r)return;r.name=$('scEditName').value.trim()||r.name;r.age=clamp($('scEditAge').value,1,100)||r.age;r.role=$('scEditRole').value.trim();r.personality=$('scEditPersonality').value.trim();log('居民资料更新',r.name+' 的资料已由用户更新。','resident',r.id);closeModal();renderResidents();renderMap();persist()}
  function useFurniture(name,button){
    const here=world.residents.filter(x=>(x.buildingId||x.homeId||'home')===interiorBuildingId);
    let r=here.find(x=>x.id===controlResidentId)||here[0]||currentResident(controlResidentId)||world.residents[0];if(!r)return;
    const poses={'床':['sleep','sleepy','休息中'],'沙发':['sit','happy','坐在沙发上休息'],'餐桌':['eat','happy','正在用餐'],'咖啡机':['eat','happy','正在喝咖啡'],'书架':['read','neutral','正在阅读'],'课桌':['read','neutral','正在学习'],'黑板':['work','neutral','正在上课'],'书桌':['work','neutral','正在工作'],'工作台':['work','happy','正在创作'],'画架':['work','happy','正在绘画'],'长椅':['sit','happy','坐在长椅上休息'],'喷泉':['idle','happy','在喷泉旁放松'],'花坛':['idle','happy','在花坛旁欣赏花朵'],'收银台':['work','neutral','正在整理店铺']};
    const [pose,expression,status]=poses[name]||['idle','neutral','正在活动'];
    const left=Number.parseFloat(button?.style?.left),top=Number.parseFloat(button?.style?.top);
    if(button&&Number.isFinite(left)&&Number.isFinite(top))r.roomPosition={x:clamp(left,8,92),y:clamp(top+17,18,87)};
    r.buildingId=interiorBuildingId;r.pose=pose;r.expression=expression;r.status=status;
    log('家具互动',r.name+' '+status+'。','interaction',r.id);renderInteriorResidents();renderMap();renderLatestLogs();persist();notify(r.name+' '+status+'。');
  }
  function action(action,el){const id=el.dataset.id;switch(action){
    case 'new-city':$('scCreatePanel').hidden=false;renderContactChoices();break;case 'cancel-create':$('scCreatePanel').hidden=true;break;case 'create-city':createCity();break;case 'enter-city':openWorld(id);break;case 'export-one':exportBackup(id);break;case 'back-lobby':clearInterval(tickTimer);persist();world=null;$('space').classList.remove('sc-city-immersive');$('scWorld').hidden=true;$('scInterior').hidden=true;$('scLobby').hidden=false;renderCityList();break;
    case 'world-settings':setTab('settings');break;case 'expand-area':expandArea();break;case 'add-building':addBuildingModal();break;case 'save-building':saveBuilding();break;case 'open-closet':closetModal(controlResidentId||world.residents[0]?.id);break;case 'add-resident':addResidentModal();break;case 'random-event':randomLifeEvent();break;case 'calendar':openCalendar();break;case 'stop-control':{const r=currentResident(controlResidentId);if(r){r.controlled=false;r.status='自主生活';renderMap();persist();notify(r.name+' 已恢复自主行动。')}break}
    case 'story':document.querySelector('#lrSpaceStoryHub [data-story-action="library"]')?.click();break;
    case 'profile':renderProfile(id);break;case 'save-expression-pose':{const r=currentResident(id);if(r){r.expression=$('scExpressionSelect')?.value||'neutral';r.pose=$('scPoseSelect')?.value||'idle';log('角色状态更新',r.name+' 切换了表情与动作。','appearance',r.id);closeModal();renderMap();renderResidents();if(!$('scInterior').hidden)renderInteriorResidents();persist();notify('表情与动作已应用。')}break}case 'edit-resident':editResidentModal(id);break;case 'save-resident':saveResident(id);break;case 'closet-one':closetModal(id);break;case 'control-one':world.residents.forEach(x=>{x.controlled=false});controlResidentId=id;world.currentController=id;const rr=currentResident(id);if(rr){rr.controlled=true;rr.status='手动控制中'}fillController();setTab('map');renderMap();persist();closeModal();notify('已切换手动控制角色。');break;case 'interact':interactResident(id);break;case 'create-npc':createNpc();break;case 'create-family':createFamily();break;case 'save-family':saveFamily();break;case 'save-relation':saveRelation();break;case 'save-settings':saveSettings();break;case 'export-backup':exportBackup();break;case 'import-backup':$('scBackupFile').click();break;case 'delete-world':if(confirm('确定删除这座城市及其所有居民、关系、日志和照片吗？此操作不可撤销。')){worlds=worlds.filter(x=>x.id!==world.id);idbDelete(world.id).then(writeRegistry);world=null;$('space').classList.remove('sc-city-immersive');$('scWorld').hidden=true;$('scLobby').hidden=false;renderCityList()}break;
    case 'leave-interior':$('scInterior').hidden=true;$('scWorld').hidden=false;$('space').classList.add('sc-city-immersive');renderMap();break;case 'close-modal':closeModal();break;case 'toggle-auto-outfit':{const r=currentResident($('scModalBody').dataset.closetResident);if(r){r.wardrobe.auto=r.wardrobe.auto===false;persist();closetModal(r.id,closetSlot)}break}case 'save-outfit':saveOutfit();break;case 'share-outfit':shareOutfit();break;case 'apply-shared-outfit':applySharedOutfit();break;case 'add-photo':$('scPhotoFile').click();break;case 'add-calendar':addCalendar();break;case 'approve-event':approveEvent(id,true);break;case 'reject-event':approveEvent(id,false);break;
    case 'save-outfit':saveOutfit();break;
  }}
  function bind(){
    if(!window.__LR_SPACE_CITY_DELEGATED__){window.__LR_SPACE_CITY_DELEGATED__=true;
    document.addEventListener('click',e=>{
      const expression=e.target.closest?.('[data-sc-expression]');if(expression){e.preventDefault();applyProfileVisual(expression.dataset.scId,'expression',expression.dataset.scExpression);return}
      const pose=e.target.closest?.('[data-sc-pose]');if(pose){e.preventDefault();applyProfileVisual(pose.dataset.scId,'pose',pose.dataset.scPose);return}
      const move=e.target.closest?.('[data-sc-move]');if(move){const v=move.dataset.scMove;moveControlled(v==='left'?-3:v==='right'?3:0,v==='up'?-3:v==='down'?3:0);return}
      const act=e.target.closest?.('[data-sc-action]');if(act){e.preventDefault();const a=act.dataset.scAction;if(a==='save-relation'&&act.id!==''){}try{action(a,act)}catch(err){console.error('[SPACE CITY action]',err);notify('操作失败：'+(err.message||'请重试'))}return}
      const tab=e.target.closest?.('[data-sc-tab]');if(tab){if(tab.dataset.scTab==='records')setTab('records');else setTab(tab.dataset.scTab);return}
      const rec=e.target.closest?.('[data-sc-record]');if(rec){renderRecords(rec.dataset.scRecord);return}
      const building=e.target.closest?.('[data-sc-building]');if(building){enterInterior(building.dataset.scBuilding);return}
      const resident=e.target.closest?.('[data-sc-resident]');if(resident){renderProfile(resident.dataset.scResident);return}
      const furniture=e.target.closest?.('[data-sc-furniture]');if(furniture){const name=furniture.dataset.scFurniture;if(['服装架','试衣镜'].includes(name)){closetModal(controlResidentId||world.residents[0]?.id);notify('打开衣柜，可以为当前角色试穿搭配。')}else useFurniture(name,furniture);return}
      const cloth=e.target.closest?.('[data-sc-cloth]');if(cloth){const r=currentResident($('scModalBody').dataset.closetResident);if(r){const slot=cloth.dataset.slot;if(slot==='sleep'){r.wardrobe.sleepOutfit=r.wardrobe.sleepOutfit||clone(r.outfit);r.wardrobe.sleepOutfit.sleepwear=cloth.dataset.scCloth;if(r.outfit.isSleeping)r.outfit.sleepwear=cloth.dataset.scCloth}else{r.outfit[slot]=cloth.dataset.scCloth;if(slot==='dress'&&cloth.dataset.scCloth)r.outfit.top='';if(['top','bottom'].includes(slot))r.outfit.dress='';if(slot==='hair'){r.wardrobe.sleepOutfit=r.wardrobe.sleepOutfit||clone(r.outfit);r.wardrobe.sleepOutfit.hair=cloth.dataset.scCloth;}if(r.wardrobe.auto!==false)r.wardrobe.dayOutfit=clone(r.outfit)}closetModal(r.id,closetSlot);persist()}return}
      const faceFeature=e.target.closest?.('[data-sc-face-feature]');if(faceFeature){const r=currentResident($('scModalBody').dataset.closetResident);if(r){r.outfit[faceFeature.dataset.scFaceFeature]=faceFeature.dataset.scFaceValue;if(r.wardrobe?.auto!==false)r.wardrobe.dayOutfit=clone(r.outfit);if(r.wardrobe?.sleepOutfit){['faceShape','eyeShape','browShape','bodyShape'].forEach(k=>r.wardrobe.sleepOutfit[k]=r.outfit[k])}closetModal(r.id,'face');persist();renderMap();renderResidents();if(!$('scInterior').hidden)renderInteriorResidents()}return}
      const color=e.target.closest?.('[data-sc-color]');if(color){const r=currentResident($('scModalBody').dataset.closetResident);if(r){const key={hair:'hairColor',top:'topColor',bottom:'bottomColor',dress:'topColor',outer:'outerColor',shoes:'shoeColor',accessory:'accessoryColor',sleep:'topColor',face:'skin'}[color.dataset.slot];if(color.dataset.slot==='sleep'){r.wardrobe.sleepOutfit=r.wardrobe.sleepOutfit||clone(r.outfit);r.wardrobe.sleepOutfit[key]=color.dataset.scColor;if(r.outfit.isSleeping)r.outfit[key]=color.dataset.scColor}else{r.outfit[key]=color.dataset.scColor;if(color.dataset.slot==='hair'||color.dataset.slot==='face'){r.wardrobe.sleepOutfit=r.wardrobe.sleepOutfit||clone(r.outfit);r.wardrobe.sleepOutfit[key]=color.dataset.scColor;}if(r.wardrobe.auto!==false)r.wardrobe.dayOutfit=clone(r.outfit)}closetModal(r.id,closetSlot);persist()}return}
      const slot=e.target.closest?.('[data-sc-slot]');if(slot){const id=$('scModalBody').dataset.closetResident;closetModal(id,slot.dataset.scSlot);return}
      const preset=e.target.closest?.('[data-sc-outfit-preset]');if(preset){const r=currentResident($('scModalBody').dataset.closetResident);const p=r?.wardrobe?.presets?.[Number(preset.dataset.scOutfitPreset)];if(r&&p){r.outfit=clone(p.outfit);if(r.wardrobe.auto!==false)r.wardrobe.dayOutfit=clone(r.outfit);closetModal(r.id,closetSlot);persist()}return}
      const addtab=e.target.closest?.('[data-sc-add-tab]');if(addtab){const tab=addtab.dataset.scAddTab;$('scAddResidentForm').hidden=tab!=='npc';$('scAddCharList').hidden=tab!=='char';$('scAddPersonaList').hidden=tab!=='persona';document.querySelectorAll('[data-sc-add-tab]').forEach(x=>x.classList.toggle('active',x===addtab));return}
      const addchar=e.target.closest?.('[data-sc-add-char]');if(addchar){addChar(addchar.dataset.scAddChar);return}const addpersona=e.target.closest?.('[data-sc-add-persona]');if(addpersona){addPersona(addpersona.dataset.scAddPersona);return}
    });
    window.addEventListener('lr-contacts-updated',()=>{if(world){renderResidents();renderContactChoices?.()}});
    }
    $('scTownMap')?.addEventListener('click',moveToPoint);
    $('scAreaSelect')?.addEventListener('change',e=>{world.map.activeArea=e.target.value;renderMap();persist()});
    $('scControllerSelect')?.addEventListener('change',e=>{world.residents.forEach(x=>{x.controlled=false});controlResidentId=e.target.value;world.currentController=controlResidentId;const r=currentResident(controlResidentId);if(r){r.controlled=true;r.status='手动控制中'}renderMap();persist()});
    $('scSpeed')?.addEventListener('change',e=>{$('scCustomSpeedWrap').hidden=e.target.value!=='custom'});
    $('scCustomSpeed')?.addEventListener('input',e=>$('scCustomSpeedValue').textContent=e.target.value+'×');
    $('scBackupFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackup(f);e.target.value=''});
    $('scPhotoFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>3*1024*1024){notify('照片请控制在 3MB 以内。');e.target.value='';return}const reader=new FileReader();reader.onload=()=>{world.photos.unshift({id:uid('photo'),data:String(reader.result),caption:f.name,at:now()});persist();renderRecords('photos');notify('照片已加入生活相册。')};reader.readAsDataURL(f);e.target.value=''});
  }
  async function open(){
    try{await loadWorlds();migrateOldCities();if(worlds.length&&!activeId)activeId=worlds[0].id;buildMarkup();bind();renderCityList();$('scLobby').hidden=false;$('scCreatePanel').hidden=true;$('scWorld').hidden=true;$('scInterior').hidden=true;document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$('space').classList.add('active');document.body.classList.remove('launcher-open');document.body.classList.add('lr-space-standalone');const nav=document.querySelector('.nav');if(nav)nav.style.setProperty('display','none','important');$('systemAppbar')?.classList.add('show');$('systemAppTitle').textContent='SPACE CITY';window.scrollTo(0,0);try{window.dispatchEvent(new CustomEvent('lr-space-v2-ready'))}catch(_){}if(worlds.length&&!worlds.some(w=>w.id===REGISTRY_ID)){for(const w of worlds)try{await idbPut(w)}catch(_){}try{await writeRegistry()}catch(_){}}}
    catch(e){console.error('[SPACE CITY open]',e);notify('SPACE CITY 启动失败：'+(e.message||'存储不可用'))}
  }
  function bridgeSnapshot(w){const buildings=clone(w.map?.buildings||[]),locationId=w.currentLocation||'home',location=buildings.find(b=>b.id===locationId);return {id:w.id,name:w.name,worldNow:w.worldNow,weather:w.settings?.weather||'sunny',season:w.settings?.season||'spring',residents:clone(w.residents||[]),relationships:clone(w.relationships||[]),families:clone(w.families||[]),buildings,currentLocation:locationId,currentLocationName:location?.name||'城市',worldBooks:clone(w.worldBooks||[]),logs:clone((w.logs||[]).slice(0,30))}}
  window.LRSpaceCityBridge={getCities:()=>worlds.map(w=>({id:w.id,name:w.name,peopleIds:(w.residents||[]).filter(r=>r.kind==='char').map(r=>r.sourceId),updatedAt:w.updatedAt})),getCitySnapshot:id=>{const w=worlds.find(x=>x.id===id);return w?{id:w.id,name:w.name,updatedAt:w.updatedAt,snapshot:bridgeSnapshot(w)}:null},getActiveCityId:()=>activeId,appendStoryEvent:async(id,event)=>{const w=worlds.find(x=>x.id===id);if(!w)return {ok:false};w.storyLinks=w.storyLinks||[];const proposal={id:uid('story-sync'),...event,at:w.worldNow||now(),status:'pending'};w.storyLinks.push(proposal);w.events.unshift({...proposal,kind:'story-sync',detail:event.detail||'剧情提出了一项城市状态变更，等待用户确认。',status:'pending'});w.logs.unshift({id:uid('log'),at:w.worldNow||now(),title:'收到剧情同步提案',detail:event.title||'剧情事件需要确认',kind:'story-sync'});await idbPut(w);return {ok:true,needsConfirmation:true}},setCityCurrentLocation:async(id,buildingId)=>{const w=worlds.find(x=>x.id===id),b=w?.map?.buildings?.find(x=>x.id===buildingId);if(!w||!b)return {ok:false,message:'找不到城市或地点'};if(!confirm('剧情希望把城市当前地点同步为「'+b.name+'」，要更新城市状态吗？'))return {ok:false,message:'用户取消同步'};w.currentLocation=b.id;const user=w.residents.find(r=>r.kind==='user');if(user){user.buildingId=b.id;user.position={x:b.x,y:b.y+10};user.status='已同步到剧情地点'}w.logs.unshift({id:uid('log'),at:w.worldNow||now(),title:'剧情地点同步',detail:'当前地点更新为 '+b.name,'kind':'story-sync'});await idbPut(w);if(w.id===activeId&&world){world=w;renderMap()}return {ok:true,cityName:w.name,locationName:b.name}}};
  // Keep the homepage contact/persona/world-book bridge, but route city data to the
  // new autonomous simulation rather than the legacy story-place map.
  window.LRSpaceStoryBridge={...legacySpaceBridge,getCities:()=>window.LRSpaceCityBridge.getCities(),getCitySnapshot:id=>window.LRSpaceCityBridge.getCitySnapshot(id),getActiveCityId:()=>window.LRSpaceCityBridge.getActiveCityId(),setCityCurrentLocation:(id,locationId)=>window.LRSpaceCityBridge.setCityCurrentLocation(id,locationId),appendStoryEvent:(id,event)=>window.LRSpaceCityBridge.appendStoryEvent(id,event)};
  window.openLoveRecordSpaceV2=()=>open();
  // Story UI is registered by SPACE STORY when this readiness event is dispatched.
  // Provide a safe home callback so the story module can return to the city shell.
  window.LRSpaceCityHome=()=>{if($('space')?.classList.contains('active')){$('lrSpaceV2Directory').hidden=false;$('lrSpaceWorld')?.removeAttribute('hidden');}};
})();
