/* LOVE RECORD · SPACE V2
   A standalone world/map/story experience. It intentionally does not hard-code any
   specific character or user name; it uses the contacts already stored in LOVE RECORD.
*/
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const KEY='love-record-space-v2';
  let data={selectedPeople:[],locations:[],currentLocation:null,history:[],worldNote:'',worldTitle:'',worldDescription:'',worldBookIds:[],timeSense:{enabled:false,zone:'Asia/Kuala_Lumpur'},season:'none',seasonFx:true,seasonAi:true,atmosphere:'default',updatedAt:0};
  let busy=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function load(){try{data={...data,...JSON.parse(localStorage.getItem(KEY)||'{}')};if(!Array.isArray(data.selectedPeople))data.selectedPeople=[];if(!Array.isArray(data.locations))data.locations=[];if(!Array.isArray(data.history))data.history=[];if(!Array.isArray(data.worldBookIds))data.worldBookIds=[];if(!data.timeSense||typeof data.timeSense!=='object')data.timeSense={enabled:false,zone:'Asia/Kuala_Lumpur'};if(!data.timeSense.zone)data.timeSense.zone='Asia/Kuala_Lumpur';if(!data.season)data.season='none';if(typeof data.seasonFx!=='boolean')data.seasonFx=true;if(typeof data.seasonAi!=='boolean')data.seasonAi=true;if(!data.worldTitle&&data.worldNote)data.worldTitle=data.worldNote;if(!data.worldTitle)data.worldTitle='我们的世界';}catch(e){}}
  function save(){data.updatedAt=Date.now();try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}}
  function people(){
    // Read the same persistent people store used by LOVE RECORD itself.
    // Do not depend on window.state: the main app declares `let state`, which is
    // a global lexical binding rather than a window property.
    try{
      const raw=localStorage.getItem('yanyan-love-settings-v5');
      const parsed=raw?JSON.parse(raw):null;
      const list=Array.isArray(parsed?.people)?parsed.people:[];
      if(list.length)return list.filter(p=>p&&p.id!=='p-yanyan'&&String(p.name||'').trim());
    }catch(e){}
    try{
      if(typeof state!=='undefined' && Array.isArray(state.people)){
        return state.people.filter(p=>p&&p.id!=='p-yanyan'&&String(p.name||'').trim());
      }
    }catch(e){}
    return [];
  }
  function person(id){return people().find(p=>p.id===id)}
  function toast(msg){if(typeof window.toast==='function')window.toast(msg);else alert(msg)}
  function apiConfig(){let s={};try{s=JSON.parse(localStorage.getItem('yanyan-love-settings-v5')||'{}')||{}}catch(e){}return {base:String(s.apiBase||$('apiBase')?.value||'').trim().replace(/\/+$/,''),key:String(s.apiKey||$('apiKey')?.value||'').trim(),model:String(s.apiModel||$('apiModel')?.value||'').trim()}}
  async function callAPI(system,user){
    const {base,key,model}=apiConfig();
    if(!base||!key||!model){toast('请先在 LOVE RECORD 的 API 设置里连接模型。');return null}
    busy=true; setBusy(true,'正在连接 API…');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const r=await fetch(base+'/chat/completions',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+key,'Accept':'application/json'},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:user}],temperature:.9,stream:false})});
      const raw=await r.text();if(!r.ok){let d=raw;try{const j=JSON.parse(raw);d=j.error?.message||j.message||raw}catch{}throw new Error('HTTP '+r.status+' · '+String(d).slice(0,220))}
      let j;try{j=JSON.parse(raw)}catch{throw new Error('API 返回不是有效 JSON')}
      let c=j?.choices?.[0]?.message?.content??j?.choices?.[0]?.text??'';
      if(Array.isArray(c))c=c.map(x=>x?.text||'').join('');
      if(!String(c).trim())throw new Error('API 返回为空');
      return String(c).trim();
    }catch(e){toast(e.name==='AbortError'?'API 请求超时（30秒）':'API 请求失败：'+e.message);return null}
    finally{clearTimeout(timer);busy=false;setBusy(false)}
  }
  function setBusy(on,text='正在生成…'){
    const m=$('lrSpaceV2Busy');if(!m)return;m.querySelector('.lr-space-busy-text').textContent=text;m.classList.toggle('show',!!on);
  }
  function installStyles(){
    if($('lrSpaceV2Style'))return;
    const s=document.createElement('style');s.id='lrSpaceV2Style';s.textContent=`
.lr-space-v2.active ~ .nav{display:none!important}
#space.lr-space-v2{position:relative;padding:0 0 110px;background:linear-gradient(180deg,#f8f4f9 0%,#f1edf4 100%);min-height:calc(100dvh - 150px);overflow:hidden}
#space.lr-space-v2 *{box-sizing:border-box}.lr-space-v2-screen{min-height:calc(100dvh - 150px);padding:24px 0}.lr-space-v2.hidden{display:none!important}
.lr-space-v2-intro{position:fixed;inset:0;z-index:5000;background:radial-gradient(circle at 50% 40%,#fff 0,#f4edf7 40%,#d8c6e0 100%);display:grid;place-items:center;opacity:1;pointer-events:auto;transition:opacity .7s ease}.lr-space-v2-intro.hide{opacity:0;pointer-events:none}.lr-space-v2-intro-inner{text-align:center;transform:translateY(12px);animation:lrSpaceIntro 1.25s ease both}.lr-space-v2-intro-mark{width:76px;height:76px;border-radius:50%;margin:0 auto 22px;background:radial-gradient(circle at 35% 30%,#fff,#d5b9df 58%,#a987b8);box-shadow:0 18px 55px rgba(126,92,145,.22);animation:lrSpaceOrb 2.2s ease-in-out infinite}.lr-space-v2-intro-title{font:400 42px/1 Georgia,'Noto Serif SC',serif;letter-spacing:.12em;color:#55465d}.lr-space-v2-intro-sub{margin-top:12px;color:#95869b;letter-spacing:.16em;font-size:11px}.lr-space-v2-intro-line{width:54px;height:1px;background:#c79ab5;margin:20px auto}
@keyframes lrSpaceIntro{from{opacity:0;transform:translateY(28px) scale(.96)}to{opacity:1;transform:none}}@keyframes lrSpaceOrb{50%{transform:scale(1.06);box-shadow:0 24px 70px rgba(126,92,145,.3)}}
.lr-space-v2-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:20px}.lr-space-v2-kicker{font-size:11px;letter-spacing:.18em;color:#b18ca6;text-transform:uppercase}.lr-space-v2-head h1{margin:5px 0 0;font:400 34px/1.1 Georgia,'Noto Serif SC',serif;color:#4b3d50}.lr-space-v2-head p{margin:7px 0 0;color:#948896;font-size:12px;line-height:1.7}.lr-space-v2-pill{border:1px solid #e1d3e4;background:rgba(255,255,255,.7);padding:10px 14px;border-radius:999px;color:#88677d;white-space:nowrap}
.lr-space-v2-panel{background:rgba(255,255,255,.74);border:1px solid rgba(255,255,255,.9);border-radius:28px;box-shadow:0 14px 40px rgba(91,68,101,.08);backdrop-filter:blur(18px);padding:20px;margin-bottom:15px}.lr-space-v2-panel h2{margin:0;color:#4e4054;font:400 22px/1.3 Georgia,'Noto Serif SC',serif}.lr-space-v2-sub{margin:7px 0 0;color:#958996;font-size:12px;line-height:1.7}
.lr-space-people{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.lr-space-person{border:1px solid #e6dbe8;background:rgba(255,255,255,.78);border-radius:20px;padding:12px;display:flex;align-items:center;gap:10px;text-align:left;color:#5c4e62;cursor:pointer}.lr-space-person.selected{border-color:#c887a8;box-shadow:0 0 0 2px rgba(200,135,168,.12);background:#fff}.lr-space-avatar{width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;background:linear-gradient(145deg,#f8e9f1,#dfc8e5);color:#a56f91;font-weight:600;overflow:hidden}.lr-space-avatar img{width:100%;height:100%;object-fit:cover}.lr-space-person b{display:block;font-size:14px}.lr-space-person small{display:block;margin-top:4px;color:#9a8c9d;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr-space-check{margin-left:auto;width:22px;height:22px;border-radius:50%;border:1px solid #d8cbdc;display:grid;place-items:center;color:#fff}.selected .lr-space-check{background:#c887a8;border-color:#c887a8}
.lr-space-actions{display:flex;justify-content:flex-end;margin-top:16px}.lr-space-primary{border:0;background:linear-gradient(135deg,#d38cab,#b96f95);color:#fff;border-radius:999px;padding:13px 22px;font-size:14px;box-shadow:0 10px 24px rgba(185,111,149,.22);cursor:pointer}.lr-space-primary:disabled{opacity:.45}.lr-space-secondary{border:1px solid #e0d2e3;background:#fff;color:#89697d;border-radius:999px;padding:11px 17px;cursor:pointer}
.lr-space-map{position:relative;min-height:560px;border-radius:30px;overflow:hidden;background:radial-gradient(circle at 25% 25%,rgba(255,255,255,.92),transparent 30%),linear-gradient(145deg,#e9e0ed,#f8f4f8 50%,#e3d7e8);border:1px solid rgba(255,255,255,.95);box-shadow:inset 0 0 0 1px rgba(255,255,255,.45),0 18px 50px rgba(91,68,101,.1)}
.lr-space-map:before{content:"";position:absolute;inset:0;background-image:linear-gradient(115deg,transparent 48%,rgba(255,255,255,.72) 49%,transparent 50%),linear-gradient(25deg,transparent 48%,rgba(255,255,255,.72) 49%,transparent 50%);background-size:180px 140px;opacity:.55}.lr-space-map-title{position:absolute;left:20px;top:18px;z-index:2}.lr-space-map-title b{display:block;font:400 20px Georgia,'Noto Serif SC',serif;color:#55455c}.lr-space-map-title span{font-size:10px;color:#9a899f;letter-spacing:.12em}.lr-space-location{position:absolute;z-index:3;transform:translate(-50%,-50%);border:0;background:transparent;cursor:pointer;text-align:center;color:#56475e}.lr-space-location-pin{width:58px;height:58px;border-radius:21px;background:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.95);box-shadow:0 12px 24px rgba(92,67,103,.13);display:grid;place-items:center;margin:auto;font-size:23px;color:#b3799a;transition:.2s}.lr-space-location:hover .lr-space-location-pin{transform:translateY(-4px) scale(1.04)}.lr-space-location b{display:block;margin-top:6px;font-size:11px;font-weight:600}.lr-space-location small{display:block;color:#9b8b9e;font-size:9px;margin-top:2px;max-width:110px}.lr-space-map-add{position:absolute;right:16px;bottom:16px;z-index:4}.lr-space-empty-map{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#8f8193;padding:30px}.lr-space-empty-map b{display:block;font:400 22px Georgia,'Noto Serif SC',serif;color:#5b4c61;margin-bottom:8px}
.lr-space-story{background:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.92);border-radius:28px;box-shadow:0 14px 40px rgba(91,68,101,.08);padding:22px}.lr-space-story-place{font-size:10px;letter-spacing:.16em;color:#b17d98;text-transform:uppercase}.lr-space-story h2{font:400 27px/1.25 Georgia,'Noto Serif SC',serif;color:#4e4054;margin:6px 0}.lr-space-story-meta{color:#988b9a;font-size:11px;line-height:1.7}.lr-space-story-body{margin-top:18px;color:#5a4d60;font-size:15px;line-height:2;white-space:pre-wrap}.lr-space-story-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.lr-space-story-input{display:flex;gap:8px;margin-top:14px}.lr-space-story-input input{flex:1;min-width:0;border:1px solid #e2d6e4;background:#fff;border-radius:18px;padding:13px 14px;outline:none;color:#514455}.lr-space-story-input button{flex:none}
.lr-space-create textarea{width:100%;min-height:120px;resize:vertical;border:1px solid #dfd2e2;border-radius:18px;padding:14px;background:#fff;outline:none;color:#504355;font:inherit;line-height:1.7}.lr-space-create label{display:block;font-size:11px;color:#9b8b9e;margin:16px 0 7px}.lr-space-create .hint{font-size:11px;color:#9b8b9e;margin-top:7px}.lr-space-locations-list{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}.lr-space-location-tag{padding:8px 11px;border:1px solid #e3d7e6;border-radius:999px;background:#fff;color:#806b84;font-size:11px}
.lr-space-busy{position:fixed;inset:0;z-index:5100;background:rgba(49,39,54,.22);backdrop-filter:blur(8px);display:none;place-items:center}.lr-space-busy.show{display:grid}.lr-space-busy-box{width:min(280px,calc(100vw - 48px));padding:25px;border-radius:26px;background:rgba(255,255,255,.92);text-align:center;box-shadow:0 24px 70px rgba(50,35,58,.2)}.lr-space-spinner{width:38px;height:38px;border:2px solid #eadde9;border-top-color:#bb7f9e;border-radius:50%;margin:0 auto 14px;animation:lrSpin .9s linear infinite}.lr-space-busy-text{color:#66556b;font-size:13px}@keyframes lrSpin{to{transform:rotate(360deg)}}

.lr-space-map-heading-row{display:flex;align-items:flex-start}.lr-space-world-title-btn{border:0;background:transparent;padding:0;text-align:left;color:inherit;cursor:pointer}.lr-space-world-title-btn h1{display:inline-block}.lr-space-fixed-title{margin:5px 0 8px!important;font:400 34px/1.1 Georgia,'Noto Serif SC',serif!important;color:#4b3d50}.lr-space-world-title-btn{display:block}.lr-space-world-title-btn span:first-child{display:block;font:400 16px/1.4 Georgia,'Noto Serif SC',serif;color:#806a86}.lr-space-title-edit{display:block;font-size:10px;color:#b18ca6;letter-spacing:.08em;margin-top:3px;opacity:1}.lr-space-location-pin img{width:100%;height:100%;object-fit:cover;border-radius:20px}.lr-space-modal{position:fixed;inset:0;z-index:5200;display:none;align-items:flex-end;background:rgba(52,41,58,.2);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.lr-space-modal.show{display:flex}.lr-space-sheet{width:100%;max-height:88dvh;overflow:auto;background:rgba(255,255,255,.96);border:1px solid rgba(255,255,255,.95);border-radius:30px 30px 0 0;padding:20px 19px 28px;box-shadow:0 -18px 60px rgba(66,46,74,.16)}.lr-space-sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.lr-space-sheet h2{margin:4px 0 0;font:400 25px/1.25 Georgia,'Noto Serif SC',serif;color:#4e4054}.lr-space-sheet-head p{margin:5px 0 0;font-size:11px;color:#9a8b9e}.lr-space-close{width:36px;height:36px;border:1px solid #e5dbe7;border-radius:50%;background:#fff;color:#7f6d84;font-size:20px}.lr-space-setting-section{padding:16px 0;border-top:1px solid #eee6ef}.lr-space-setting-section:first-of-type{border-top:0}.lr-space-setting-section h3{margin:0;font-size:10px;letter-spacing:.18em;color:#a68196}.lr-space-setting-section p{margin:6px 0 10px;color:#9a8d9d;font-size:11px;line-height:1.6}.lr-space-setting-list{display:grid;gap:8px}.lr-space-setting-check{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid #e7dce9;border-radius:15px;background:#fff}.lr-space-setting-check input{margin-top:2px}.lr-space-setting-check b{display:block;font-size:12px;color:#5b4c61}.lr-space-setting-check small{display:block;margin-top:3px;font-size:10px;color:#9a8c9e;line-height:1.5}.lr-space-select,.lr-space-input,.lr-space-textarea{width:100%;border:1px solid #e2d6e4;border-radius:15px;background:#fff;color:#514356;padding:12px 13px;font:inherit;outline:none}.lr-space-textarea{min-height:100px;resize:vertical;line-height:1.7}.lr-space-sheet>label{display:block;margin:12px 0 6px;font-size:10px;color:#9b8b9e}.lr-space-switch{display:flex!important;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;margin:0!important;color:#66566b!important;font-size:12px!important}.lr-space-switch input{display:none}.lr-space-switch i{width:42px;height:24px;border-radius:999px;background:#ddd2df;position:relative;flex:none;transition:.2s}.lr-space-switch i:after{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.12);transition:.2s}.lr-space-switch input:checked+i{background:#c887a8}.lr-space-switch input:checked+i:after{transform:translateX(18px)}.lr-space-full-btn{width:100%;margin-top:14px}.lr-space-location-preview{height:150px;border:1px dashed #d9cadc;border-radius:20px;background:linear-gradient(145deg,#f8f2f9,#eee5f1);display:grid!important;place-items:center;color:#9d8da0;overflow:hidden;cursor:pointer}.lr-space-location-preview img{width:100%;height:100%;object-fit:cover}.lr-space-edit-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px}.lr-space-danger{border:1px solid #e8ccd6;background:#fff4f7;color:#a66578;border-radius:999px;padding:12px 15px}.lr-space-season-fx{position:absolute;inset:0;z-index:5;pointer-events:none;overflow:hidden;border-radius:30px}.lr-space-season-fx span{position:absolute;top:-30px;animation:lrSeasonFall 10s linear infinite;filter:drop-shadow(0 2px 4px rgba(110,80,120,.12))}.season-winter span{color:#fff}.season-spring span{color:#d39ab4}.season-summer span{color:#d7a86b}.season-autumn span{color:#b98268}.season-night{filter:saturate(.9)}@keyframes lrSeasonFall{0%{transform:translate3d(0,-20px,0) rotate(0deg)}50%{transform:translate3d(22px,300px,0) rotate(100deg)}100%{transform:translate3d(-18px,650px,0) rotate(220deg)}}
@media(max-width:560px){.lr-space-people{grid-template-columns:1fr}.lr-space-map{min-height:500px}.lr-space-v2-head{align-items:flex-start}.lr-space-v2-head h1{font-size:30px}}
`;
    document.head.appendChild(s);
  }
  function replaceSpace(){
    const old=$('space');if(!old)return;
    old.className='page active lr-space-v2';
    old.innerHTML=`
      <div id="lrSpaceV2Directory" class="lr-space-v2-screen">
        <div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">LOVE RECORD · SPACE</div><h1>空间</h1><p>先选择今天一起进入这个世界的人。</p></div></div>
        <section class="lr-space-v2-panel"><h2>今天，谁会来到这里？</h2><div class="lr-space-v2-sub">支持单人或多人。选择完成后，AI 会根据同行者共同开启今天的空间。</div><div id="lrSpacePeople" class="lr-space-people"></div><div class="lr-space-actions"><button id="lrSpaceEnter" class="lr-space-primary" type="button" disabled>进入空间</button></div></section>
      </div>
      <div id="lrSpaceV2Map" class="lr-space-v2-screen" hidden>
        <div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">THE WORLD</div><div class="lr-space-map-heading-row"><div><h1 class="lr-space-fixed-title">空间地图</h1><button id="lrSpaceWorldTitleBtn" class="lr-space-world-title-btn" type="button" aria-label="编辑世界名称"><span id="lrSpaceWorldTitle">我们的世界</span><span class="lr-space-title-edit">编辑世界名称</span></button></div></div><p id="lrSpaceMapMeta">选择一个地方，让故事从这里开始。</p></div><button id="lrSpaceBackPeople" class="lr-space-secondary" type="button">更换同行者</button></div>
        <div class="lr-space-map" id="lrSpaceMap"><div class="lr-space-map-title"><span>PLACES · STORIES · MOMENTS</span></div><div id="lrSpaceMapLocations"></div><div class="lr-space-map-add"><button id="lrSpaceCreateBtn" class="lr-space-primary" type="button">＋ 创建地点</button></div><div id="lrSpaceSeasonFX" class="lr-space-season-fx" aria-hidden="true"></div></div>
      </div>
      <div id="lrSpaceV2Story" class="lr-space-v2-screen" hidden>
        <div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">CURRENT PLACE</div><h1>正在发生</h1><p id="lrSpaceStoryPeople"></p></div><button id="lrSpaceBackMap" class="lr-space-secondary" type="button">返回地图</button></div>
        <section class="lr-space-story"><div id="lrSpaceStoryPlace" class="lr-space-story-place"></div><h2 id="lrSpaceStoryTitle"></h2><div id="lrSpaceStoryMeta" class="lr-space-story-meta"></div><div id="lrSpaceStoryBody" class="lr-space-story-body">正在让这个地点发生故事……</div><div id="lrSpaceStoryActions" class="lr-space-story-actions"></div><div class="lr-space-story-input"><input id="lrSpaceStoryInput" placeholder="告诉 AI 你想做什么……"><button id="lrSpaceStorySend" class="lr-space-primary" type="button">继续</button></div></section>
      </div>
      <div id="lrSpaceCreate" class="lr-space-v2-screen" hidden><div class="lr-space-v2-head"><div><div class="lr-space-v2-kicker">CREATE PLACE</div><h1>创建地点</h1><p>告诉 AI 你想让地图里出现什么地方。</p></div><button id="lrSpaceCreateBack" class="lr-space-secondary" type="button">返回地图</button></div><section class="lr-space-panel lr-space-v2-panel lr-space-create"><h2>你想要什么地点？</h2><label for="lrSpaceCreatePrompt">地点描述</label><textarea id="lrSpaceCreatePrompt" placeholder="例如：城市边缘的一间可以看星星的玻璃温室，适合晚上聊天。"></textarea><div class="hint">写下你的想法后，AI 会整理出地点名称、用途、简介、氛围与可发生的故事。</div><div class="lr-space-actions"><button id="lrSpaceCreateSubmit" class="lr-space-primary" type="button">让 AI 创建地点</button></div></section><section class="lr-space-v2-panel"><h2>已创建地点</h2><div id="lrSpaceCreatedList" class="lr-space-locations-list"></div></section></div>
      <div id="lrSpaceSettings" class="lr-space-modal"><section class="lr-space-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">SPACE SETTINGS</div><h2>世界设置</h2></div><button class="lr-space-close" id="lrSpaceSettingsClose" type="button">×</button></div><div class="lr-space-setting-section"><h3>WORLD BOOK</h3><p>选择这个空间需要读取的世界书。</p><div id="lrSpaceBookList" class="lr-space-setting-list"></div></div><div class="lr-space-setting-section"><h3>TIME & PLACE</h3><p>让世界感知指定地区的当地时间。</p><label class="lr-space-switch"><span>启用时间感知</span><input id="lrSpaceTimeEnabled" type="checkbox"><i></i></label><select id="lrSpaceTimeZone" class="lr-space-select"><optgroup label="中国地区"><option value="Asia/Shanghai">上海 · 中国</option><option value="Asia/Shanghai">北京 · 中国</option><option value="Asia/Shanghai">广州 · 中国</option><option value="Asia/Shanghai">深圳 · 中国</option><option value="Asia/Shanghai">杭州 · 中国</option><option value="Asia/Shanghai">成都 · 中国</option><option value="Asia/Shanghai">重庆 · 中国</option><option value="Asia/Shanghai">南京 · 中国</option><option value="Asia/Shanghai">苏州 · 中国</option><option value="Asia/Shanghai">武汉 · 中国</option><option value="Asia/Shanghai">厦门 · 中国</option><option value="Asia/Shanghai">青岛 · 中国</option><option value="Asia/Shanghai">西安 · 中国</option><option value="Asia/Shanghai">昆明 · 中国</option><option value="Asia/Shanghai">大理 · 中国</option><option value="Asia/Shanghai">哈尔滨 · 中国</option><option value="Asia/Shanghai">长沙 · 中国</option><option value="Asia/Shanghai">三亚 · 中国</option></optgroup><optgroup label="其他地区"><option value="Asia/Kuala_Lumpur">Kuala Lumpur · 马来西亚</option><option value="Asia/Tokyo">Tokyo · 日本</option><option value="Asia/Seoul">Seoul · 韩国</option><option value="Europe/London">London · 英国</option><option value="America/New_York">New York · 美国</option><option value="America/Los_Angeles">Los Angeles · 美国</option></optgroup></select></div><div class="lr-space-setting-section"><h3>SEASON</h3><p>手动决定这个世界现在是什么季节。</p><select id="lrSpaceSeason" class="lr-space-select"><option value="none">不设置季节</option><option value="spring">春 · 花瓣</option><option value="summer">夏 · 光影</option><option value="autumn">秋 · 落叶</option><option value="winter">冬 · 飘雪</option></select><label class="lr-space-switch"><span>显示季节动态效果</span><input id="lrSpaceSeasonFx" type="checkbox"><i></i></label><label class="lr-space-switch"><span>让 AI 感知当前季节</span><input id="lrSpaceSeasonAi" type="checkbox"><i></i></label></div><div class="lr-space-setting-section"><h3>ATMOSPHERE</h3><select id="lrSpaceAtmosphere" class="lr-space-select"><option value="default">默认</option><option value="dreamy">梦幻</option><option value="quiet">安静</option><option value="warm">温暖</option><option value="rainy">雨夜</option><option value="morning">清晨</option><option value="night">深夜</option></select></div><button id="lrSpaceSettingsSave" class="lr-space-primary lr-space-full-btn" type="button">保存世界设置</button></section></div>
      <div id="lrSpaceWorldEdit" class="lr-space-modal"><section class="lr-space-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">THE WORLD</div><h2>编辑世界</h2></div><button class="lr-space-close" id="lrSpaceWorldEditClose" type="button">×</button></div><label>世界名称</label><input id="lrSpaceWorldName" class="lr-space-input"><label>世界简介</label><textarea id="lrSpaceWorldDescription" class="lr-space-textarea" placeholder="这个世界是什么样的？"></textarea><button id="lrSpaceWorldSave" class="lr-space-primary lr-space-full-btn" type="button">保存</button></section></div>
      <div id="lrSpaceLocationEdit" class="lr-space-modal"><section class="lr-space-sheet"><div class="lr-space-sheet-head"><div><div class="lr-space-v2-kicker">EDIT PLACE</div><h2>编辑地点</h2><p>长按地图上的地点即可打开。</p></div><button class="lr-space-close" id="lrSpaceLocationEditClose" type="button">×</button></div><label>地点图片</label><label id="lrSpaceLocationPreview" class="lr-space-location-preview" for="lrSpaceLocationImage"><span>上传地点图片</span></label><input id="lrSpaceLocationImage" type="file" accept="image/*" hidden><label>地点名称</label><input id="lrSpaceLocationName" class="lr-space-input"><label>地点类型</label><input id="lrSpaceLocationType" class="lr-space-input"><label>地点用途</label><input id="lrSpaceLocationPurpose" class="lr-space-input" placeholder="例如：居住空间 / 餐饮休闲 / 公共空间"><label>地点概要</label><textarea id="lrSpaceLocationDescription" class="lr-space-textarea"></textarea><label>氛围</label><input id="lrSpaceLocationAtmosphere" class="lr-space-input" placeholder="例如：安静、温暖、适合聊天"><div class="lr-space-edit-actions"><button id="lrSpaceLocationDelete" class="lr-space-danger" type="button">删除地点</button><button id="lrSpaceLocationSave" class="lr-space-primary" type="button">保存修改</button></div></section></div>
      <div id="lrSpaceV2Busy" class="lr-space-busy"><div class="lr-space-busy-box"><div class="lr-space-spinner"></div><div class="lr-space-busy-text">正在生成…</div></div></div>`;
    renderPeople();renderMap();renderCreatedList();
  }
  function bindSpaceControls(){
    const bind=(id,fn)=>{
      const el=$(id);
      if(!el || el.dataset.lrBound==='1')return;
      el.dataset.lrBound='1';
      el.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn(e)},{capture:true});
    };
    bind('lrSpaceCreateBtn',()=>show('create'));
    bind('lrSpaceCreateBack',()=>show('map'));
    bind('lrSpaceCreateSubmit',()=>createLocation());
    bind('lrSpaceWorldTitleBtn',()=>openWorldEditor());
    bind('lrSpaceSettingsClose',()=>closeWorldSettings());
    bind('lrSpaceSettingsSave',()=>saveWorldSettings());
    bind('lrSpaceWorldEditClose',()=>closeWorldEditor());
    bind('lrSpaceWorldSave',()=>saveWorldEditor());
    bind('lrSpaceLocationEditClose',()=>closeLocationEditor());
    bind('lrSpaceLocationSave',()=>saveLocationEditor());
    bind('lrSpaceLocationDelete',()=>deleteLocationEditor());
  }
  function renderPeople(){
    const box=$('lrSpacePeople');if(!box)return;const list=people();
    if(!list.length){box.innerHTML='<div style="grid-column:1/-1;color:#9a8d9d;font-size:12px;padding:18px 4px">还没有可进入空间的人物。请先在 LOVE RECORD 的人物/联系人里添加角色。</div>';return}
    box.innerHTML=list.map(p=>{const selected=data.selectedPeople.includes(p.id);const av=p.avatar||p.image||'';return `<button type="button" class="lr-space-person ${selected?'selected':''}" data-space-person="${esc(p.id)}"><span class="lr-space-avatar">${av?`<img src="${esc(av)}" alt="">`:esc((p.name||'?').slice(0,1))}</span><span style="min-width:0"><b>${esc(p.name||'未命名人物')}</b><small>${esc(p.role||p.personality||'角色')}</small></span><span class="lr-space-check">${selected?'✓':''}</span></button>`}).join('');
    $('lrSpaceEnter').disabled=!data.selectedPeople.length;
  }
  function worldBooks(){
    try{if(typeof state!=='undefined'&&Array.isArray(state.worlds))return state.worlds}catch(e){}
    try{const raw=localStorage.getItem('yanyan-love-settings-v5');const s=raw?JSON.parse(raw):{};return Array.isArray(s.worlds)?s.worlds:[]}catch(e){return []}
  }
  function worldBookContext(){return worldBooks().filter(w=>data.worldBookIds.includes(w.id)).map(w=>({name:w.name,description:w.description,locations:w.locations,rules:w.rules}))}
  function timeContext(){
    if(!data.timeSense?.enabled)return '时间感知：关闭。';
    try{const zone=data.timeSense.zone||'Asia/Kuala_Lumpur';const now=new Date();const parts=new Intl.DateTimeFormat('zh-CN',{timeZone:zone,dateStyle:'full',timeStyle:'medium'}).formatToParts(now);const obj=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `时间感知：开启；地区：${zone}；当地时间：${obj.year||''}-${obj.month||''}-${obj.day||''} ${obj.hour||''}:${obj.minute||''}:${obj.second||''}；星期：${obj.weekday||''}`;}catch(e){return '时间感知：开启；地区：'+String(data.timeSense?.zone||'Asia/Kuala_Lumpur')}}
  function worldContext(){return {worldName:data.worldTitle||data.worldNote||'我们的世界',worldDescription:data.worldDescription||'',worldBooks:worldBookContext(),time:timeContext(),season:data.season||'none',seasonAware:!!data.seasonAi,atmosphere:data.atmosphere||'default'}}
  function applySeasonFX(){
    const root=$('lrSpaceSeasonFX');if(!root)return;root.innerHTML='';root.className='lr-space-season-fx season-'+(data.season||'none');if(!data.seasonFx||!data.season||data.season==='none')return;
    const map={winter:['❄','·','✦'],spring:['✿','·','❀'],summer:['·','✦','○'],autumn:['•','·','❧']};const chars=map[data.season]||[];
    for(let i=0;i<30;i++){const el=document.createElement('span');el.textContent=chars[i%chars.length];el.style.left=(Math.random()*100)+'%';el.style.animationDelay=(-Math.random()*10)+'s';el.style.animationDuration=(7+Math.random()*8)+'s';el.style.opacity=(.25+Math.random()*.55).toFixed(2);el.style.fontSize=(8+Math.random()*10)+'px';root.appendChild(el)}
  }
  function openWorldSettings(){
    const modal=$('lrSpaceSettings');if(!modal)return;const books=worldBooks();
    $('lrSpaceBookList').innerHTML=books.length?books.map(w=>`<label class="lr-space-setting-check"><input type="checkbox" value="${esc(w.id)}" ${data.worldBookIds.includes(w.id)?'checked':''}><span><b>${esc(w.name||'未命名世界')}</b><small>${esc(w.description||'')}</small></span></label>`).join(''):'<div class="lr-space-setting-empty">还没有世界书。你可以先在 LOVE RECORD 的「世界书」里创建。</div>';
    $('lrSpaceTimeEnabled').checked=!!data.timeSense.enabled;$('lrSpaceTimeZone').value=data.timeSense.zone||'Asia/Kuala_Lumpur';$('lrSpaceSeason').value=data.season||'none';$('lrSpaceSeasonFx').checked=!!data.seasonFx;$('lrSpaceSeasonAi').checked=!!data.seasonAi;$('lrSpaceAtmosphere').value=data.atmosphere||'default';modal.classList.add('show');document.body.style.overflow='hidden';
  }
  function closeWorldSettings(){const m=$('lrSpaceSettings');if(m)m.classList.remove('show');document.body.style.overflow=''}
  function saveWorldSettings(){
    data.worldBookIds=[...document.querySelectorAll('#lrSpaceBookList input:checked')].map(x=>x.value);data.timeSense={enabled:!!$('lrSpaceTimeEnabled').checked,zone:$('lrSpaceTimeZone').value};data.season=$('lrSpaceSeason').value;data.seasonFx=!!$('lrSpaceSeasonFx').checked;data.seasonAi=!!$('lrSpaceSeasonAi').checked;data.atmosphere=$('lrSpaceAtmosphere').value;save();applySeasonFX();closeWorldSettings();toast('世界设置已保存');
  }
  function openWorldEditor(){const m=$('lrSpaceWorldEdit');if(!m)return;$('lrSpaceWorldName').value=data.worldTitle||data.worldNote||'我们的世界';$('lrSpaceWorldDescription').value=data.worldDescription||'';m.classList.add('show');document.body.style.overflow='hidden'}
  function closeWorldEditor(){const m=$('lrSpaceWorldEdit');if(m)m.classList.remove('show');document.body.style.overflow=''}
  function saveWorldEditor(){const name=$('lrSpaceWorldName').value.trim();if(!name){toast('请先填写世界名称。');return}data.worldTitle=name;data.worldNote=name;data.worldDescription=$('lrSpaceWorldDescription').value.trim();save();renderMap();closeWorldEditor();toast('世界名称已更新')}
  function openLocationEditor(id){const l=locationById(id);if(!l)return;const m=$('lrSpaceLocationEdit');if(!m)return;m.dataset.id=id;$('lrSpaceLocationName').value=l.name||'';$('lrSpaceLocationType').value=l.type||'';$('lrSpaceLocationPurpose').value=l.purpose||'';$('lrSpaceLocationDescription').value=l.description||'';$('lrSpaceLocationAtmosphere').value=l.atmosphere||'';$('lrSpaceLocationImage').value='';const preview=$('lrSpaceLocationPreview');preview.innerHTML=l.image?`<img src="${esc(l.image)}" alt="">`:'<span>上传地点图片</span>';m.classList.add('show');document.body.style.overflow='hidden'}
  function closeLocationEditor(){const m=$('lrSpaceLocationEdit');if(m)m.classList.remove('show');document.body.style.overflow=''}
  function saveLocationEditor(){const id=$('lrSpaceLocationEdit').dataset.id,l=locationById(id);if(!l)return;const name=$('lrSpaceLocationName').value.trim();if(!name){toast('地点名称不能为空。');return}l.name=name;l.type=$('lrSpaceLocationType').value.trim();l.purpose=$('lrSpaceLocationPurpose').value.trim();l.description=$('lrSpaceLocationDescription').value.trim();l.atmosphere=$('lrSpaceLocationAtmosphere').value.trim();const file=$('lrSpaceLocationImage').files?.[0];const finish=()=>{save();renderMap();renderCreatedList();closeLocationEditor();toast('地点已更新')};if(file){const reader=new FileReader();reader.onload=()=>{l.image=String(reader.result||'');finish()};reader.readAsDataURL(file)}else finish()}
  function deleteLocationEditor(){const id=$('lrSpaceLocationEdit').dataset.id;if(!id)return;if(!confirm('删除这个地点？'))return;data.locations=data.locations.filter(x=>x.id!==id);if(data.currentLocation===id)data.currentLocation=null;save();renderMap();renderCreatedList();closeLocationEditor();toast('地点已删除')}
  function renderMap(){
    const box=$('lrSpaceMapLocations');if(!box)return;const list=data.locations||[];
    if(!list.length){box.innerHTML='<div class="lr-space-empty-map"><div><b>这座城市还是空白的</b><div>先创建一个地点，让空间有第一个故事发生。</div></div></div>';return}
    const positions=[[18,30],[50,25],[80,34],[30,58],[63,56],[18,79],[48,78],[78,76],[50,44]];
    box.innerHTML=list.map((l,i)=>{const pos=positions[i%positions.length];return `<button class="lr-space-location" style="left:${pos[0]}%;top:${pos[1]}%" data-space-location="${esc(l.id)}" type="button"><span class="lr-space-location-pin">${l.image?`<img src="${esc(l.image)}" alt="">`:esc(l.icon||'⌂')}</span><b>${esc(l.name)}</b><small>${esc(l.type||l.purpose||'地点')}</small></button>`}).join('');
    $('lrSpaceWorldTitle').textContent=data.worldTitle||data.worldNote||'我们的世界';applySeasonFX();
  }
  function renderCreatedList(){const box=$('lrSpaceCreatedList');if(!box)return;box.innerHTML=data.locations.length?data.locations.map(l=>`<span class="lr-space-location-tag">${esc(l.name)}</span>`).join(''):'<span style="color:#9a8d9d;font-size:11px">还没有自定义地点。</span>'}
  function selectedSummary(){return data.selectedPeople.map(person).filter(Boolean).map(p=>({id:p.id,name:p.name,role:p.role,personality:p.personality,background:p.background,speech:p.speech,instructions:p.instructions}));}
  function locationById(id){return data.locations.find(x=>x.id===id)}
  async function createLocation(){
    if(busy)return;const prompt=String($('lrSpaceCreatePrompt')?.value||'').trim();if(!prompt){toast('先告诉我你想创建什么地点。');return}
    const system=`你是 LOVE RECORD 的空间世界设计师。根据用户想法创建一个可用于持续剧情的虚拟地点。只返回 JSON，不要 Markdown。字段：name,type,purpose,description,atmosphere,storyHooks,icon。icon 只允许一个简单字符，不要 emoji。不要加入任何用户未提供的真实人物姓名。`;
    const out=await callAPI(system,JSON.stringify({idea:prompt,world:worldContext(),people:selectedSummary()}));if(!out)return;
    try{const clean=out.replace(/^```json\s*|^```|```$/g,'').trim();const j=JSON.parse(clean);const loc={id:'loc-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),name:String(j.name||'未命名地点'),type:String(j.type||'地点'),purpose:String(j.purpose||''),description:String(j.description||''),atmosphere:String(j.atmosphere||''),storyHooks:Array.isArray(j.storyHooks)?j.storyHooks:[],icon:String(j.icon||'⌂').slice(0,2)};data.locations.push(loc);save();$('lrSpaceCreatePrompt').value='';renderMap();renderCreatedList();show('map');toast('地点已加入空间地图。')}catch(e){toast('AI 返回的地点资料格式不正确，请再试一次。')}
  }
  async function enterLocation(id){
    const loc=locationById(id);if(!loc||busy)return;data.currentLocation=id;save();show('story');
    $('lrSpaceStoryPlace').textContent=loc.name;$('lrSpaceStoryTitle').textContent=loc.purpose||loc.type;$('lrSpaceStoryMeta').textContent=(loc.description||'')+(loc.atmosphere?' · '+loc.atmosphere:'');$('lrSpaceStoryBody').textContent='正在让这个地点发生故事……';$('lrSpaceStoryActions').innerHTML='';
    const system=`你是 LOVE RECORD【空间】里的剧情导演。用户刚进入一个地点，请根据地点设定、同行人物和世界状态开启一段自然、具体、有画面感的剧情。不要替用户决定行动、台词、思想或情绪。可以让同行人物主动行动。不要写成游戏任务清单。结尾留出自然可回应的空间。只返回剧情正文。`;
    const user=JSON.stringify({world:worldContext(),location:loc,people:selectedSummary(),recent:data.history.slice(-8)});
    const out=await callAPI(system,user);if(out){appendHistory(loc.name,out);$('lrSpaceStoryBody').textContent=out;makeStoryActions(out)}else{$('lrSpaceStoryBody').textContent='这次 API 没有成功返回。你可以重新进入这个地点再试一次。'}
  }
  function makeStoryActions(text){$('lrSpaceStoryActions').innerHTML='';const defaults=['继续观察眼前发生的事情','回应同行的人','做一个和当前地点有关的小行动'];defaults.forEach(t=>{const b=document.createElement('button');b.className='lr-space-secondary';b.type='button';b.textContent=t;b.onclick=()=>continueStory(t);$('lrSpaceStoryActions').appendChild(b)});}
  async function continueStory(action){if(busy)return;const loc=locationById(data.currentLocation);if(!loc)return;const system=`你是 LOVE RECORD【空间】的剧情导演。继续上一段地点剧情。只写新的剧情正文。不要替用户决定行动、台词、思想或情绪；用户的行动只有在输入明确后才发生。同行人物可以自然回应。保持地点和连续性。`;
    const user=JSON.stringify({world:worldContext(),location:loc,people:selectedSummary(),recent:data.history.slice(-8),userAction:action});const out=await callAPI(system,user);if(out){appendHistory(loc.name,out);$('lrSpaceStoryBody').textContent=out;makeStoryActions(out)}}
  async function sendStory(){const input=$('lrSpaceStoryInput');const t=String(input?.value||'').trim();if(!t||busy)return;if(input)input.value='';await continueStory(t)}
  function appendHistory(place,text){data.history.push({id:'h-'+Date.now(),place,text,at:Date.now()});if(data.history.length>40)data.history=data.history.slice(-40);save()}
  function show(which){const ids={directory:'lrSpaceV2Directory',map:'lrSpaceV2Map',story:'lrSpaceV2Story',create:'lrSpaceCreate'};Object.entries(ids).forEach(([k,id])=>{const el=$(id);if(!el)return;el.hidden=k!==which;el.classList.toggle('is-current',k===which)});if(which==='create')renderCreatedList()}
  async function seedMap(){
    if(busy||data.locations.length)return;
    const system=`你是 LOVE RECORD【空间】的世界地图设计师。根据同行人物与用户已有世界设定，创建一个适合长期剧情的现代虚拟城市/区域地图。只返回 JSON，不要 Markdown。字段：worldName,worldDescription,locations。locations 是数组，生成 6 个地点，每项字段为 name,type,purpose,description,atmosphere,storyHooks,icon。地点之间要有明显差异，例如居住、餐饮、公共空间、自然空间、商业空间、安静空间。icon 只允许一个简单非 emoji 字符。不要加入任何具体人物姓名。`;
    const out=await callAPI(system,JSON.stringify({people:selectedSummary(),worldNote:data.worldNote||'',context:worldContext()}));
    if(!out)return;
    try{const clean=out.replace(/^```json\s*|^```|```$/g,'').trim();const j=JSON.parse(clean);data.worldNote=String(j.worldName||'我们的世界');data.worldTitle=data.worldNote;data.worldDescription=String(j.worldDescription||'');data.locations=(Array.isArray(j.locations)?j.locations:[]).slice(0,8).map((l,i)=>({id:'loc-'+Date.now()+'-'+i,name:String(l.name||('地点 '+(i+1))),type:String(l.type||'地点'),purpose:String(l.purpose||''),description:String(l.description||''),atmosphere:String(l.atmosphere||''),storyHooks:Array.isArray(l.storyHooks)?l.storyHooks:[],icon:String(l.icon||'⌂').slice(0,2)}));save();renderMap();toast('地图已经生成。选一个地方开始剧情。')}catch(e){toast('AI 返回的地图格式不正确，请再试一次。')}
  }
  async function enterMap(){if(!data.selectedPeople.length){toast('至少选择一位同行者。');return}save();$('lrSpaceMapMeta').textContent='同行者：'+data.selectedPeople.map(id=>person(id)?.name).filter(Boolean).join('、');show('map');renderMap();applySeasonFX();if(!data.locations.length)await seedMap()}
  function activateSpacePage(){
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    const target=$('space');
    if(!target)return false;
    target.classList.add('active');
    document.body.classList.remove('launcher-open');
    const dock=document.querySelector('.nav');if(dock)dock.style.display='none';
    const bar=$('systemAppbar');if(bar)bar.classList.add('show');
    const title=$('systemAppTitle');if(title)title.textContent='SPACE';
    window.scrollTo(0,0);
    return true;
  }
  function open(){
    load();installStyles();
    /* Do not call the legacy nav('space') here. The old Space renderer expects
       the removed legacy DOM (#place, #choices, etc.) and can throw before V2
       finishes opening. Activate the page shell directly instead. */
    activateSpacePage();
    replaceSpace();
    bindSpaceControls();
    // The directory is created dynamically, so render the real contacts immediately.
    // Without this call the new SPACE opens correctly but the people grid stays empty.
    renderPeople();
    show('directory');
    const intro=document.createElement('div');intro.className='lr-space-v2-intro';intro.id='lrSpaceIntro';
    intro.innerHTML='<div class="lr-space-v2-intro-inner"><div class="lr-space-v2-intro-mark"></div><div class="lr-space-v2-intro-title">SPACE</div><div class="lr-space-v2-intro-line"></div><div class="lr-space-v2-intro-sub">ENTER YOUR WORLD</div></div>';
    document.body.appendChild(intro);setTimeout(()=>intro.classList.add('hide'),1700);setTimeout(()=>intro.remove(),2400);
  }
  window.openLoveRecordSpaceV2=()=>{open()};
  function init(){
    load();installStyles();
    const launch=document.querySelector('[data-space-v2-launch]');if(launch){launch.querySelector('span:last-child')?.replaceChildren(document.createTextNode('空间'));launch.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();window.openLoveRecordSpaceV2();},{capture:true})}
    document.addEventListener('click',e=>{
      const p=e.target.closest?.('[data-space-person]');if(p){const id=p.dataset.spacePerson;data.selectedPeople=data.selectedPeople.includes(id)?data.selectedPeople.filter(x=>x!==id):[...data.selectedPeople,id];save();renderPeople();return}
      const l=e.target.closest?.('[data-space-location]');if(l){if(l.dataset.longPressed==='1'){l.dataset.longPressed='';return}enterLocation(l.dataset.spaceLocation);return}
    });
    document.addEventListener('pointerdown',e=>{const l=e.target.closest?.('[data-space-location]');if(!l)return;clearTimeout(l._lrHold);l._lrHold=setTimeout(()=>{l.dataset.longPressed='1';openLocationEditor(l.dataset.spaceLocation);if(navigator.vibrate)navigator.vibrate(18)},620)},{passive:true});
    document.addEventListener('pointerup',e=>{const l=e.target.closest?.('[data-space-location]');if(l)clearTimeout(l._lrHold)},{passive:true});
    document.addEventListener('pointercancel',e=>{const l=e.target.closest?.('[data-space-location]');if(l)clearTimeout(l._lrHold)},{passive:true});
    document.addEventListener('pointermove',e=>{const l=e.target.closest?.('[data-space-location]');if(l&&Math.abs(e.movementX)+Math.abs(e.movementY)>12)clearTimeout(l._lrHold)},{passive:true});
    document.addEventListener('click',e=>{
      const el=e.target.closest?.('button,[role="button"],select');
      const id=el?.id||e.target.id;
      if(id==='lrSpaceEnter')enterMap();
      else if(id==='lrSpaceBackPeople'){show('directory');renderPeople()}
      else if(id==='lrSpaceBackMap')show('map');
      else if(id==='lrSpaceCreateBtn')show('create');
      else if(id==='lrSpaceCreateBack')show('map');
      else if(id==='lrSpaceCreateSubmit')createLocation();
      else if(id==='lrSpaceStorySend')sendStory();
      else if(id==='lrSpaceSettingsClose')closeWorldSettings();
      else if(id==='lrSpaceSettingsSave')saveWorldSettings();
      else if(id==='lrSpaceWorldEditClose')closeWorldEditor();
      else if(id==='lrSpaceWorldSave')saveWorldEditor();
      else if(id==='lrSpaceWorldTitleBtn')openWorldEditor();
      else if(id==='lrSpaceLocationEditClose')closeLocationEditor();
      else if(id==='lrSpaceLocationSave')saveLocationEditor();
      else if(id==='lrSpaceLocationDelete')deleteLocationEditor();
      else if(id==='systemAppbarAction'&&$('space')?.classList.contains('active'))openWorldSettings();
    });
    document.addEventListener('change',e=>{if(e.target?.id!=='lrSpaceLocationImage')return;const f=e.target.files?.[0],p=$('lrSpaceLocationPreview');if(f&&p){const r=new FileReader();r.onload=()=>p.innerHTML=`<img src="${esc(String(r.result||''))}" alt="">`;r.readAsDataURL(f)}});
    $('systemAppbarAction')?.addEventListener('click',()=>{if($('space')?.classList.contains('active'))openWorldSettings()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
