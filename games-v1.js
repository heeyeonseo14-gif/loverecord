/* LOVE RECORD · OUR LITTLE FARM v1
   Shared-owner cozy farming sim. Local simulation is independent of API.
   AI calls are event-driven and reuse the homepage API settings.
*/
(()=>{'use strict';
const KEY='lr-our-little-farm-v1';
const ACTIVE_KEY=KEY+'::active';
const profileKey=id=>KEY+'::'+encodeURIComponent(String(id||'solo'));
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const crops={
 carrot:{name:'胡萝卜',emoji:'🥕',cost:4,sell:10,time:35,desc:'脆甜的小可爱'},
 tomato:{name:'番茄',emoji:'🍅',cost:7,sell:17,time:55,desc:'阳光的味道'},
 strawberry:{name:'草莓',emoji:'🍓',cost:10,sell:25,time:75,desc:'甜甜的春日果实'},
 lettuce:{name:'生菜',emoji:'🥬',cost:3,sell:8,time:25,desc:'清爽又好种'},
 pumpkin:{name:'南瓜',emoji:'🎃',cost:15,sell:38,time:110,desc:'秋日丰收明星'},
 flower:{name:'雏菊',emoji:'🌼',cost:8,sell:20,time:60,desc:'可以做成小花束'}
};
const defaults=(ownerId='')=>({version:3,ownerId:String(ownerId||''),createdAt:Date.now(),coins:120,level:1,xp:0,season:'春',day:1,plots:Array.from({length:9},(_,i)=>({id:i,crop:'',plantedAt:0,readyAt:0,watered:false})),inventory:{seed_carrot:12,seed_tomato:5,seed_lettuce:5},unlocked:['carrot','tomato','lettuce'],log:[],lastVisit:Date.now(),partnerId:String(ownerId||''),partnerName:'',partnerAvatar:'',partnerLastAction:0,decor:[],daily:{date:'',done:[]},stats:{harvests:0,planted:0}});
function readStore(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:null}catch{return null}}
function people(){try{return typeof window.__LOVE_RECORD_GET_PEOPLE==='function'?(window.__LOVE_RECORD_GET_PEOPLE()||[]):[]}catch{return[]}}
function personFor(id){return people().find(x=>String(x.id)===String(id))}
function getInitialOwner(){
 const active=localStorage.getItem(ACTIVE_KEY);
 if(active!==null)return String(active);
 const legacy=readStore(KEY);
 return String(legacy?.ownerId||legacy?.partnerId||'');
}
function loadOwner(ownerId){
 const id=String(ownerId||'');
 const stored=readStore(profileKey(id));
 if(stored)return {...defaults(id),...stored,version:3,ownerId:id,partnerId:id};
 // Migrate the old single-farm save once, assigning it to its recorded owner.
 const legacy=readStore(KEY);
 if(legacy){
  const legacyOwner=String(legacy.ownerId||legacy.partnerId||'');
  if(legacyOwner===id||(!legacyOwner&&!id)){
   const migrated={...defaults(id),...legacy,version:3,ownerId:id,partnerId:id};
   try{localStorage.setItem(profileKey(id),JSON.stringify(migrated));localStorage.removeItem(KEY)}catch(e){console.warn('[Farm] legacy migration failed',e)}
   return migrated;
  }
 }
 const p=personFor(id);
 return {...defaults(id),partnerName:p?.remark||p?.name||'',partnerAvatar:p?.avatar||''};
}
let activeOwnerId=getInitialOwner();
let farm=loadOwner(activeOwnerId),view='farm',selectedSeed='carrot',busy=false,apiMessage='';
function save(){
 farm.ownerId=String(activeOwnerId||'');
 farm.partnerId=farm.ownerId;
 farm.lastVisit=Date.now();
 try{
  const payload=JSON.stringify(farm);
  localStorage.setItem(profileKey(activeOwnerId),payload);
  localStorage.setItem(ACTIVE_KEY,String(activeOwnerId||''));
  return true;
 }catch(e){console.error('[Farm] save failed',e);toast('存档暂时无法保存，请检查浏览器空间');return false}
}

function cfg(){let s={};try{s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}')||{}}catch{};return {base:String((typeof state!=='undefined'&&state.apiBase)||s.apiBase||document.querySelector('#apiBase')?.value||'').trim().replace(/\/+$/,''),key:String((typeof state!=='undefined'&&state.apiKey)||s.apiKey||document.querySelector('#apiKey')?.value||'').trim(),model:String((typeof state!=='undefined'&&state.apiModel)||s.apiModel||document.querySelector('#apiModel')?.value||'').trim()}}
function addLog(text,kind='note'){farm.log.unshift({id:Date.now()+Math.random(),text,kind,at:Date.now()});farm.log=farm.log.slice(0,40)}
function toast(s){const n=$('#farmToast');if(n){n.textContent=s;n.classList.add('show');setTimeout(()=>n.classList.remove('show'),1800)}}
function mature(p){return !!p.crop&&Date.now()>=p.readyAt}
function remaining(p){return Math.max(0,Math.ceil((p.readyAt-Date.now())/1000))}
function fmt(sec){const m=Math.floor(sec/60),s=sec%60;return m?`${m}分${s?`${s}秒`:''}`:`${s}秒`}
function settleOffline(){const now=Date.now(),elapsed=Math.max(0,Math.min(now-(farm.lastVisit||now),12*60*60*1000));if(farm.partnerId&&now-(farm.partnerLastAction||0)>30*60*1000){let watered=0;farm.plots.forEach(p=>{if(p.crop&&!mature(p)&&!p.watered&&watered<2){p.watered=true;p.readyAt=Math.max(now,p.readyAt-8000);watered++}});if(watered){farm.partnerLastAction=now;addLog(`${farm.partnerName||'搭档'}趁你不在，帮忙照看了 ${watered} 块菜地。`,'partner')}}farm.lastVisit=now;save()}
function open(){mount();settleOffline();$('#lr-games').classList.add('open');document.body.style.overflow='hidden';view='farm';render()}
function close(){const r=$('#lr-games');if(r)r.classList.remove('open');document.body.style.overflow=''}
const css=`#lr-games{position:fixed;inset:0;z-index:100100;background:#f7f0e7;color:#51453d;display:none;flex-direction:column;font-family:inherit}#lr-games.open{display:flex}#lr-games *{box-sizing:border-box}#lr-games .gbar{height:56px;flex:none;display:flex;align-items:center;gap:12px;padding:0 16px;background:#fffaf3;border-bottom:1px solid #e8d9c9;color:#57483d}#lr-games button{font:inherit;color:inherit;border:1px solid #d9c5b0;background:#fffaf3;border-radius:14px;padding:10px 13px;cursor:pointer}#lr-games button.primary{background:#8d9c78;color:white;border-color:#8d9c78}#lr-games button:disabled{opacity:.45}#lr-games .gscroll{overflow:auto;padding:15px 15px 34px;max-width:760px;width:100%;margin:0 auto}#lr-games .gtitle{font-size:27px;margin:4px 0 5px;color:#57483d}#lr-games .gsub{font-size:12px;color:#8d7d6d;line-height:1.8}#lr-games .gcard{background:linear-gradient(155deg,#fffdf8 0%,#fff8ed 100%);border:1px solid #e6d8c8;border-radius:23px;padding:18px;margin:16px 0;box-shadow:0 8px 24px #7b5c3212}#lr-games .ghead{background:radial-gradient(circle at 90% 10%,#ffffff88,transparent 34%),linear-gradient(135deg,#e8efdf 0%,#f8e7d7 100%);border-radius:25px;padding:21px 19px;margin:5px 0 16px;border:1px solid #d5dfc9;box-shadow:inset 0 1px 0 #ffffffaa,0 8px 22px #8d806018}#lr-games .gstats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}#lr-games .gstat{background:#ffffffb8;border-radius:13px;padding:9px;text-align:center;font-size:11px;color:#857361}#lr-games .gstat b{display:block;font-size:19px;color:#5c6c4d}#lr-games .gmap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:13px;background:linear-gradient(145deg,#e0eacf,#edf0d9);border:1px solid #cbd7b9;border-radius:23px;position:relative;overflow:hidden;box-shadow:inset 0 2px 8px #657a4c12}#lr-games .plot{min-height:104px;border-radius:15px;background:linear-gradient(145deg,#b98b65,#9e704e);border:2px solid #d8b58f;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:5px;color:#fff8ed;text-shadow:0 1px 2px #60452c;font-size:12px}#lr-games .plot.empty{background:linear-gradient(145deg,#c49a75,#a77a54);box-shadow:inset 0 1px 0 #ffffff38,0 3px 8px #6c4a2b20;transition:transform .16s,filter .16s}#lr-games .plot:active{transform:scale(.97);filter:brightness(1.08)}#lr-games .plot.ready{background:linear-gradient(145deg,#9ab77c,#6f9660);border-color:#e1edca;animation:farmGlow 1.8s ease-in-out infinite}#lr-games .plot .cropemoji{font-size:29px;line-height:1.2}#lr-games .plot small{font-size:10px}#lr-games .grow{display:flex;align-items:center;gap:9px;flex-wrap:wrap}#lr-games .gavatar{width:38px;height:38px;border-radius:50%;background:#d9c9b4;display:grid;place-items:center;overflow:hidden;font-size:18px}#lr-games .gavatar img{width:100%;height:100%;object-fit:cover}#lr-games .gseed{display:flex;align-items:center;gap:8px;text-align:left;width:100%;padding:10px!important}#lr-games .gseed.active{border-color:#82966d;background:linear-gradient(135deg,#edf2e5,#f8f5e9);box-shadow:0 0 0 2px #82966d22}#lr-games .gseed .emoji{font-size:25px}#lr-games .gseed small{display:block;color:#8d7d6d;font-size:10px}#lr-games .ggrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}#lr-games select,#lr-games input,#lr-games textarea{width:100%;background:#fff;border:1px solid #dfd0bf;color:#57483d;border-radius:12px;padding:11px;font:inherit}#lr-games .gtabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;position:sticky;bottom:-1px;background:#fffaf3;padding:9px 0 max(9px,env(safe-area-inset-bottom));border-top:1px solid #e8d9c9;margin-top:14px}#lr-games .gtabs button{font-size:11px;padding:9px 2px;border:0;background:transparent}#lr-games .gtabs button.active{background:#e9efdf;color:#596c4b}#lr-games .gmuted{font-size:11px;color:#988777;line-height:1.7}#lr-games .glog{display:grid;gap:8px}#lr-games .glog p{margin:0;padding:10px 12px;background:#f6efe5;border-radius:12px;font-size:12px;line-height:1.7}#lr-games .gnotice{padding:11px 13px;background:#f1eadf;border-radius:13px;color:#7d6b59;font-size:12px;line-height:1.7}#lr-games .gtoast{position:fixed;left:50%;bottom:90px;transform:translate(-50%,12px);opacity:0;transition:.2s;background:#51483d;color:white;padding:10px 15px;border-radius:99px;font-size:12px;pointer-events:none;z-index:3}#lr-games .gtoast.show{opacity:1;transform:translate(-50%,0)}@keyframes farmGlow{50%{filter:brightness(1.12)}}@media(max-width:380px){#lr-games .plot{min-height:86px}#lr-games .gstats{gap:5px}}`;
function mount(){if($('#lr-games'))return;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);const root=document.createElement('div');root.id='lr-games';root.innerHTML=`<div class="gbar"><button id="gclose">‹ 返回 LOVE RECORD</button><b>OUR LITTLE FARM · 我们的小农场</b></div><main class="gscroll" id="gbody"></main><div class="gtoast" id="farmToast"></div>`;document.body.appendChild(root);root.addEventListener('click',onClick);root.addEventListener('change',onChange);$('#gclose').onclick=close;render()}
function partnerCard(){const p=people().find(x=>String(x.id)===String(farm.partnerId));return `<section class="gcard"><b>共同农场主人</b><div class="grow" style="margin-top:10px"><div class="gavatar">${farm.partnerAvatar?`<img src="${esc(farm.partnerAvatar)}">`:esc((farm.partnerName||'♡').slice(0,1))}</div><div style="flex:1"><b>${esc(farm.partnerName||'还没有选择搭档')}</b><div class="gmuted">${p?'与你共同经营这座农场':'选择一位联系人，成为共同主人'}</div></div></div><select id="farmPartner" style="margin-top:12px"><option value="">选择联系人…</option>${people().map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(farm.partnerId)?'selected':''}>${esc(x.remark||x.name||'联系人')}</option>`).join('')}</select></section>`}
function header(){return `<div class="ghead"><div class="gmuted" style="letter-spacing:2px">OUR LITTLE FARM · ${farm.season}季 第${farm.day}天</div><h1 class="gtitle">一起慢慢，把日子种出来。</h1><div class="gsub">这是 ${esc(farm.partnerName||'你的')} 的专属农场。</div><div class="gstats"><div class="gstat"><b>🪙 ${farm.coins}</b>金币</div><div class="gstat"><b>⭐ ${farm.level}</b>农场等级</div><div class="gstat"><b>🌾 ${farm.stats.harvests}</b>累计收获</div></div></div>`}
function tabs(){return `<nav class="gtabs">${[['farm','🌿','农场'],['shop','🛒','商店'],['bag','🧺','仓库'],['life','♡','日常']].map(([v,i,n])=>`<button data-view="${v}" class="${view===v?'active':''}">${i}<br>${n}</button>`).join('')}</nav>`}
function farmView(){const plots=farm.plots.map(p=>{const c=crops[p.crop];if(!c)return `<button class="plot empty" data-plot="${p.id}"><span class="cropemoji">＋</span><small>空地 · 播种</small></button>`;const ready=mature(p);return `<button class="plot ${ready?'ready':''}" data-plot="${p.id}"><span class="cropemoji">${ready?c.emoji:['🌱','🌿','🌾'][Math.min(2,Math.floor((1-remaining(p)/Math.max(1,(p.readyAt-p.plantedAt)/1000))*3))]||'🌱'}</span><b>${c.name}</b><small>${ready?'点击收获':fmt(remaining(p))}</small></button>`}).join('');return `${header()}${partnerCard()}<section class="gcard"><div class="grow" style="justify-content:space-between"><b>我们的菜园</b><span class="gmuted">${farm.plots.length} 块土地</span></div><div class="gmap" style="margin-top:12px">${plots}</div><p class="gmuted">点击空地播种，成熟后点击作物收获。作物会在现实时间中快速成长。</p></section><section class="gcard"><div class="grow" style="justify-content:space-between"><b>选择种子</b><span class="gmuted">当前：${crops[selectedSeed]?.emoji||'🌱'} ${crops[selectedSeed]?.name||'胡萝卜'}</span></div><div class="ggrid" style="margin-top:10px">${farm.unlocked.map(id=>{const c=crops[id];return `<button class="gseed ${selectedSeed===id?'active':''}" data-seed="${id}"><span class="emoji">${c.emoji}</span><span><b>${c.name}</b><small>种子 ${c.cost} 金币 · ${Math.round(c.time/60)} 分钟成熟</small></span></button>`}).join('')}</div><div class="grow" style="margin-top:12px"><span class="gnotice">选择种子后，点击任意一块空地即可播种；一次只种一块。</span><button data-action="water-all">浇水加速</button></div></section><section class="gcard"><b>农场近况</b><div class="glog" style="margin-top:10px">${farm.log.slice(0,4).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p class="gmuted">你们的农场刚刚开始，来种下第一颗种子吧。</p>'}</div></section>${tabs()}`}
function shopView(){return `${header()}<h2 class="gtitle">小镇种子铺</h2><p class="gsub">买些种子回来，让菜园热闹起来。</p><section class="gcard"><b>种子货架</b>${Object.entries(crops).map(([id,c])=>`<div class="grow" style="padding:12px 0;border-bottom:1px solid #eee2d5"><span style="font-size:27px">${c.emoji}</span><div style="flex:1"><b>${c.name}</b><div class="gmuted">${c.desc} · 售价 ${c.sell} 金币</div></div><button data-buy="${id}">购买 · ${c.cost}</button></div>`).join('')}</section><section class="gcard"><b>农场扩建</b><p class="gmuted">扩建土地，让你们有更多空间种植。</p><button class="primary" data-action="expand" ${farm.plots.length>=18?'disabled':''}>增加一块土地 · ${80+Math.max(0,farm.plots.length-9)*35} 金币</button></section>${tabs()}`}
function bagView(){const rows=Object.entries(farm.inventory).filter(([,n])=>n>0);return `${header()}<h2 class="gtitle">共同仓库</h2><p class="gsub">你们一起收获的东西都放在这里。</p><section class="gcard">${rows.length?rows.map(([id,n])=>{const c=crops[id];return `<div class="grow" style="padding:10px 0;border-bottom:1px solid #eee2d5"><span style="font-size:25px">${c?.emoji||'📦'}</span><b style="flex:1">${c?.name||id}</b><span>× ${n}</span><button data-sell="${id}">出售</button></div>`}).join(''):'<p class="gmuted">仓库还是空的，收获作物后就会出现在这里。</p>'}</section><section class="gcard"><b>经营记录</b><div class="gstats"><div class="gstat"><b>${farm.stats.planted}</b>播种次数</div><div class="gstat"><b>${farm.stats.harvests}</b>收获次数</div><div class="gstat"><b>${farm.xp}</b>经验值</div></div></section>${tabs()}`}
function lifeView(){return `${header()}<h2 class="gtitle">农场日常</h2><p class="gsub">一起经营，也一起留下生活的小片段。</p><section class="gcard"><b>和搭档聊聊</b><p class="gmuted">可以聊聊今天的农场、商量种什么，或邀请对方做一件事。</p><textarea id="farmChat" placeholder="和${esc(farm.partnerName||'搭档')}说点什么…"></textarea><button class="primary" data-action="talk" style="margin-top:10px" ${!farm.partnerId?'disabled':''}>发送给搭档</button><div class="gnotice" style="margin-top:10px">${esc(apiMessage||'互动时才调用主页 API，不会在每次种植时请求。')}</div></section><section class="gcard"><div class="grow" style="justify-content:space-between"><b>共同日记</b><button data-action="daily">让搭档分享今天的农场日记</button></div><div class="glog" style="margin-top:12px">${farm.log.slice(0,15).map(x=>`<p>${esc(x.text)}</p>`).join('')||'<p>今天是你们农场的第一天。</p>'}</div></section>${tabs()}`}
function render(){const b=$('#gbody');if(!b)return;b.innerHTML=view==='farm'?farmView():view==='shop'?shopView():view==='bag'?bagView():lifeView()}
function plant(id,seed){const p=farm.plots.find(x=>x.id===id);if(!p||p.crop)return false;const c=crops[seed];if(!c){return false}const seedKey='seed_'+seed;if((farm.inventory[seedKey]||0)<=0){toast('种子不够啦，可以去商店购买');return false}farm.inventory[seedKey]--;p.crop=seed;p.plantedAt=Date.now();p.readyAt=Date.now()+c.time*1000;p.watered=false;farm.stats.planted++;farm.xp+=2;addLog(`你们种下了${c.name}。`);save();return true}
function harvest(id){const p=farm.plots.find(x=>x.id===id);if(!p||!p.crop)return;if(!mature(p)){toast('还在努力生长中，再等等哦');return}const c=crops[p.crop];farm.inventory[p.crop]=(farm.inventory[p.crop]||0)+1;farm.stats.harvests++;farm.xp+=5;addLog(`收获了 ${c.name} × 1，放进共同仓库啦。`);p.crop='';p.plantedAt=0;p.readyAt=0;p.watered=false;if(farm.xp>=farm.level*35){farm.xp-=farm.level*35;farm.level++;addLog(`农场升到 ${farm.level} 级啦！`)}save();render()}
async function callAI(userText,kind){const c=cfg();if(!c.base||!c.key||!c.model){apiMessage='主页 API 尚未连接；农场功能仍可正常使用。';toast('主页 API 尚未连接');render();return}if(busy)return;busy=true;apiMessage='搭档正在想怎么回应…';render();try{const prompt=`你正在与用户共同经营一个温馨的手绘风农场。联系人名字：${farm.partnerName||'搭档'}。农场季节：${farm.season}，第${farm.day}天，等级${farm.level}，金币${farm.coins}。最近农场记录：${farm.log.slice(0,5).map(x=>x.text).join('；')}。用户的内容：${userText}。请以联系人本人的口吻，用自然亲切的中文回应，1-3句话，不要提AI，不要输出系统说明。`;const r=await fetch(c.base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+c.key},body:JSON.stringify({model:c.model,messages:[{role:'system',content:'你是用户的农场共同主人，拥有自己的性格，与你的搭档平等经营农场。'}, {role:'user',content:prompt}],stream:false})});const raw=await r.text();if(!r.ok)throw new Error('HTTP '+r.status);const j=JSON.parse(raw);const answer=j.choices?.[0]?.message?.content?.trim();if(!answer)throw new Error('没有收到有效回复');addLog(`${farm.partnerName||'搭档'}：${answer}`,'partner');apiMessage='搭档回复啦。';save()}catch(e){apiMessage='这次没有联系上搭档，农场内容已经保留。';console.warn('[Farm API]',e);toast(apiMessage)}finally{busy=false;render()}}
function onChange(e){
 if(e.target.id!=='farmPartner')return;
 const nextId=String(e.target.value||'');
 if(nextId===String(activeOwnerId||''))return;
 save();
 activeOwnerId=nextId;
 try{localStorage.setItem(ACTIVE_KEY,activeOwnerId)}catch(e){console.warn('[Farm] active owner save failed',e)}
 const selectedPerson=personFor(activeOwnerId);
 farm=loadOwner(activeOwnerId);
 farm.ownerId=activeOwnerId;farm.partnerId=activeOwnerId;
 farm.partnerName=selectedPerson?.remark||selectedPerson?.name||farm.partnerName||'';
 farm.partnerAvatar=selectedPerson?.avatar||farm.partnerAvatar||'';
 addLog(selectedPerson?`已进入 ${farm.partnerName} 的独立农场。`:'已进入个人农场。','note');
 save();
 selectedSeed='carrot';apiMessage='';render();
 toast(selectedPerson?'已切换到独立农场':'已切换到个人农场');
}
function onClick(e){const b=e.target.closest('button');if(!b)return;if(b.dataset.view){view=b.dataset.view;render();return}if(b.dataset.seed){selectedSeed=b.dataset.seed;render();return}if(b.dataset.plot!==undefined){const id=Number(b.dataset.plot),p=farm.plots.find(x=>x.id===id);if(p?.crop)harvest(id);else if(plant(id,selectedSeed)){toast('播种成功！');render()}return}if(b.dataset.buy){const id=b.dataset.buy,c=crops[id];if(farm.coins<c.cost){toast('金币不够啦');return}farm.coins-=c.cost;farm.inventory['seed_'+id]=(farm.inventory['seed_'+id]||0)+1;if(!farm.unlocked.includes(id))farm.unlocked.push(id);addLog(`购买了${c.name}种子 × 1。`);save();render();return}if(b.dataset.sell){const id=b.dataset.sell,n=farm.inventory[id]||0;if(!n)return;const c=crops[id];farm.inventory[id]=n-1;farm.coins+=c.sell;addLog(`出售了${c.name}，获得 ${c.sell} 金币。`);save();render();return}if(b.dataset.action==='water-all'){let count=0;farm.plots.forEach(p=>{if(p.crop&&!mature(p)&&!p.watered){p.watered=true;p.readyAt=Math.max(Date.now(),p.readyAt-8000);count++}});addLog(count?`你给 ${count} 块土地浇了水，作物加速成长。`:'暂时没有需要浇水的作物。');save();toast(count?'浇水完成，作物加速啦':'没有需要浇水的作物');render();return}if(b.dataset.action==='expand'){const cost=80+Math.max(0,farm.plots.length-9)*35;if(farm.plots.length>=18||farm.coins<cost){toast('金币不足或土地已全部开放');return}farm.coins-=cost;farm.plots.push({id:farm.plots.length,crop:'',plantedAt:0,readyAt:0,watered:false});addLog('你们一起扩建了一块新土地。');save();render();return}if(b.dataset.action==='talk'){const t=$('#farmChat')?.value.trim();if(t)callAI(t,'chat');else toast('先写点想说的话吧');return}if(b.dataset.action==='daily'){callAI('请主动分享今天在农场做过的一件小事，并自然地邀请我一起完成一件小事。','daily');return}}
document.addEventListener('click',e=>{if(e.target.closest('[data-launch-games]')){e.preventDefault();open()}});
window.LoveRecordGames={open,close};
setInterval(()=>{if($('#lr-games')?.classList.contains('open')&&view==='farm')render()},5000);
})();