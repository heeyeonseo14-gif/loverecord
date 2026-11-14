/* LOVE RECORD · Monochrome Welcome Experience */
(()=>{'use strict';
const KEY='lr-welcome-tour-permanently-closed-v1';
if(window.__LR_WELCOME_TOUR_MONO__)return;window.__LR_WELCOME_TOUR_MONO__=true;
const slides=[
{eyebrow:'01 / YOUR SPACE',title:'A world of your own.',desc:'这里是属于你的私人数字空间。整理桌面、挑选壁纸、添加组件，让每一次打开都有熟悉的感觉。',tags:['个性化桌面','自定义壁纸','自由组件'],note:'Make this little world yours.'},
{eyebrow:'02 / YOUR PEOPLE',title:'Keep them close.',desc:'创建联系人与角色，设定人设、背景和关系。通过聊天、动态与共同故事，让重要的人一直在故事里。',tags:['角色与联系人','聊天与长期记忆','动态与互动'],note:'Every connection has a story.'},
{eyebrow:'03 / YOUR MEMORIES',title:'Moments never fade.',desc:'把照片、文字、日记和生活片段收进自己的时间线。值得记住的事情，都可以在这里找到位置。',tags:['回忆与相册','拾忆与日记','音乐与生活记录'],note:'Keep the moments that matter.'},
{eyebrow:'04 / YOUR RECORD',title:'Make it yours.',desc:'从图标、字体、主题到桌面组件，慢慢调整成你喜欢的样子。LOVE RECORD 会成为只属于你的私人空间。',tags:['图标与字体美化','主题与组件','备份与数据管理'],note:'A private world of memories.'}
];
const style=`
#lrWelcomeTour{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;padding:22px;background:#070707;color:#f7f7f7;opacity:0;transition:opacity .45s ease;font-family:Arial,-apple-system,BlinkMacSystemFont,sans-serif}
#lrWelcomeTour.show{display:flex;opacity:1}
#lrWelcomeTour *{box-sizing:border-box}
#lrWelcomeTour .lrwt-shell{width:min(540px,100%);min-height:min(690px,88dvh);display:flex;flex-direction:column;justify-content:space-between;padding:clamp(20px,5vw,34px);border:1px solid rgba(255,255,255,.15);border-radius:28px;background:linear-gradient(145deg,rgba(35,35,35,.88),rgba(10,10,10,.96));box-shadow:0 28px 90px #000a,inset 0 1px 0 #ffffff12;backdrop-filter:blur(26px)}
#lrWelcomeTour .lrwt-top{display:flex;justify-content:space-between;align-items:center;color:#999;font-size:9px;letter-spacing:.22em}
#lrWelcomeTour .lrwt-brand{color:#eee;letter-spacing:.25em}
#lrWelcomeTour .lrwt-count{font-variant-numeric:tabular-nums}
#lrWelcomeTour .lrwt-stage{display:flex;align-items:center;flex:1;min-height:350px;touch-action:pan-y}
#lrWelcomeTour .lrwt-slide{width:100%;padding:28px 0;animation:lrwtFade .48s ease both}
#lrWelcomeTour .lrwt-art{width:100%;height:140px;margin:0 0 34px;border-radius:20px;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,#333 0%,#171717 48%,#0c0c0c 100%);border:1px solid #ffffff16;color:#fff;font:300 42px Georgia,serif;letter-spacing:.16em}
#lrWelcomeTour .lrwt-eyebrow{font-size:9px;letter-spacing:.28em;color:#aaa;margin-bottom:16px}
#lrWelcomeTour .lrwt-title{font-size:clamp(27px,7vw,39px);line-height:1.18;font-weight:300;letter-spacing:-.035em;color:#fff;margin:0 0 17px}
#lrWelcomeTour .lrwt-desc{font-size:13px;line-height:1.95;color:#aaa;margin:0;max-width:440px}
#lrWelcomeTour .lrwt-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:23px}
#lrWelcomeTour .lrwt-tag{border:1px solid #ffffff20;background:#ffffff08;border-radius:999px;padding:8px 11px;color:#ddd;font-size:10px;letter-spacing:.04em}
#lrWelcomeTour .lrwt-note{font:italic 11px Georgia,serif;letter-spacing:.04em;color:#777;margin:26px 0 0}
#lrWelcomeTour .lrwt-progress{height:1px;background:#ffffff20;margin:0 0 18px;overflow:hidden}
#lrWelcomeTour .lrwt-progress span{display:block;height:100%;background:#fff;transition:width .3s ease}
#lrWelcomeTour .lrwt-actions{display:flex;justify-content:space-between;gap:10px}
#lrWelcomeTour .lrwt-btn{min-height:45px;border-radius:999px;padding:0 20px;font-size:11px;letter-spacing:.08em}
#lrWelcomeTour .lrwt-skip{border:1px solid #ffffff28;background:transparent;color:#aaa}
#lrWelcomeTour .lrwt-next{border:1px solid #fff;background:#fff;color:#111;min-width:145px}
#lrWelcomeTour .lrwt-hint{text-align:center;color:#666;font-size:8px;letter-spacing:.2em;margin-top:17px}
#lrWelcomeTour .lrwt-confirm{position:absolute;inset:0;display:none;align-items:center;justify-content:center;padding:22px;background:#000a;backdrop-filter:blur(14px)}
#lrWelcomeTour .lrwt-confirm.show{display:flex}
#lrWelcomeTour .lrwt-dialog{width:min(390px,100%);padding:27px;border:1px solid #ffffff20;border-radius:24px;background:#171717;box-shadow:0 24px 70px #000b;animation:lrwtFade .3s ease both}
#lrWelcomeTour .lrwt-dialog-mark{color:#fff;font-size:22px;margin-bottom:14px}
#lrWelcomeTour .lrwt-dialog h2{font-size:21px;font-weight:400;color:#fff;margin:0 0 10px}
#lrWelcomeTour .lrwt-dialog p{font-size:12px;line-height:1.85;color:#aaa;margin:0 0 20px}
#lrWelcomeTour .lrwt-dialog-actions{display:grid;gap:9px}
#lrWelcomeTour .lrwt-dialog-actions button{min-height:46px;border-radius:999px;font-size:12px;letter-spacing:.05em}
#lrWelcomeTour .lrwt-permanent{color:#111;background:#fff;border:1px solid #fff}
#lrWelcomeTour .lrwt-keep{color:#eee;background:#222;border:1px solid #ffffff25}
@keyframes lrwtFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-height:680px){#lrWelcomeTour .lrwt-shell{min-height:94dvh;padding:18px}#lrWelcomeTour .lrwt-art{height:95px;margin-bottom:20px}#lrWelcomeTour .lrwt-stage{min-height:280px}}
@media(prefers-reduced-motion:reduce){#lrWelcomeTour *{animation:none!important;transition:none!important}}
`;
function start(force=false){
 try{if(!force&&localStorage.getItem(KEY)==='1')return}catch(e){}
 if(document.getElementById('lrWelcomeTour'))return;
 const root=document.createElement('section');root.id='lrWelcomeTour';root.setAttribute('aria-label','LOVE RECORD 功能导览');
 root.innerHTML=`<div class="lrwt-shell"><header class="lrwt-top"><span class="lrwt-brand">LOVE RECORD</span><span class="lrwt-count" id="lrwtCount">01 / 04</span></header><div class="lrwt-stage" id="lrwtStage"></div><footer class="lrwt-bottom"><div class="lrwt-progress"><span id="lrwtProgress" style="width:25%"></span></div><div class="lrwt-actions"><button class="lrwt-btn lrwt-skip" id="lrwtSkip" type="button">跳过导览</button><button class="lrwt-btn lrwt-next" id="lrwtNext" type="button">继续 →</button></div><div class="lrwt-hint">SWIPE TO EXPLORE · 左右滑动探索</div></footer><div class="lrwt-confirm" id="lrwtConfirm"><div class="lrwt-dialog"><div class="lrwt-dialog-mark">✧</div><h2>永久关闭导览？</h2><p>选择“不关闭”，以后每次进入 LOVE RECORD 都会再次看到完整导览。选择“永久关闭”，以后将直接进入主页。</p><div class="lrwt-dialog-actions"><button class="lrwt-permanent" id="lrwtCloseForever" type="button">永久关闭</button><button class="lrwt-keep" id="lrwtKeep" type="button">不关闭</button></div></div></div></div>`;
 document.head.appendChild(Object.assign(document.createElement('style'),{textContent:style}));document.body.appendChild(root);
 let index=0;const stage=root.querySelector('#lrwtStage'),count=root.querySelector('#lrwtCount'),progress=root.querySelector('#lrwtProgress'),next=root.querySelector('#lrwtNext'),confirm=root.querySelector('#lrwtConfirm');
 function draw(){const s=slides[index];stage.innerHTML=`<article class="lrwt-slide"><div class="lrwt-art" aria-hidden="true">0${index+1}</div><div class="lrwt-eyebrow">${s.eyebrow}</div><h1 class="lrwt-title">${s.title}</h1><p class="lrwt-desc">${s.desc}</p><div class="lrwt-tags">${s.tags.map(t=>`<span class="lrwt-tag">${t}</span>`).join('')}</div><p class="lrwt-note">${s.note}</p></article>`;count.textContent=`${String(index+1).padStart(2,'0')} / 04`;progress.style.width=((index+1)/4*100)+'%';next.textContent=index===3?'进入 LOVE RECORD　→':'继续 →'}
 function finish(){confirm.classList.add('show')}
 function closeTour(){root.classList.remove('show');setTimeout(()=>root.remove(),450)}
 function advance(){if(index<3){index++;draw()}else finish()}
 next.addEventListener('click',advance);root.querySelector('#lrwtSkip').addEventListener('click',finish);
 root.querySelector('#lrwtCloseForever').addEventListener('click',()=>{try{localStorage.setItem(KEY,'1')}catch(e){}closeTour()});
 root.querySelector('#lrwtKeep').addEventListener('click',closeTour);
 let sx=0,sy=0;stage.addEventListener('touchstart',e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY},{passive:true});
 stage.addEventListener('touchend',e=>{const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.2){if(dx<0)advance();else if(index>0){index--;draw()}}},{passive:true});
 let down=null;stage.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY}});stage.addEventListener('pointerup',e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;down=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.2){if(dx<0)advance();else if(index>0){index--;draw()}}});
 draw();requestAnimationFrame(()=>root.classList.add('show'));
}
window.LRShowWelcomeTour=()=>start(true);
const settingsMenu=document.getElementById('settingsHomeMenu');if(settingsMenu&&!settingsMenu.querySelector('[data-lr-open-tour]')){const b=document.createElement('button');b.type='button';b.className='settings-entry';b.setAttribute('data-lr-open-tour','');b.innerHTML='<span class="settings-entry-icon" aria-hidden="true">✧</span><span class="settings-entry-copy"><strong>WELCOME TOUR</strong><small>重新查看 LOVE RECORD 功能导览</small></span><span class="settings-entry-arrow" aria-hidden="true">›</span>';settingsMenu.appendChild(b);b.addEventListener('click',()=>window.LRShowWelcomeTour())}
const delay=6200;window.setTimeout(start,delay);
})();