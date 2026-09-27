/* LOVE RECORD V24 — Home layout refinement */
(function(){
  'use strict';
  const STYLE_ID='v24-home-layout-style';
  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      #home.v24-refined-home .hero{position:relative;padding:18px 4px 30px;min-height:300px}
      #home.v24-refined-home .days{margin-top:42px}
      #home.v24-refined-home .home-moment-mini{position:absolute;right:0;top:76px;width:31%;max-width:150px;margin:0!important;padding:10px;background:rgba(255,255,255,.94);border-radius:24px;box-shadow:0 18px 45px rgba(77,58,88,.07);border:1px solid rgba(255,255,255,.95);z-index:2}
      #home.v24-refined-home .home-moment-mini .home-status{margin:0 2px 9px}
      #home.v24-refined-home .home-moment-mini .eyebrow{font-size:8px;letter-spacing:2.2px;white-space:nowrap}
      #home.v24-refined-home .home-moment-mini .status{font-size:7px;letter-spacing:1px}
      #home.v24-refined-home .home-moment-mini .photo{aspect-ratio:3/4;width:100%;height:auto;border-radius:16px;margin-top:0!important}
      #home.v24-refined-home .home-moment-mini .actions{display:none}
      #home.v24-refined-home .home-moment-mini #homeFile{display:none}
      #home.v24-refined-home .v24-today-line{display:flex;align-items:baseline;gap:12px;min-height:34px;margin:28px 0 20px;padding:0 4px 10px;border-bottom:1px solid var(--line);color:var(--ink)}
      #home.v24-refined-home .v24-today-label{flex:none;font-size:10px;letter-spacing:3px;color:var(--muted);white-space:nowrap}
      #home.v24-refined-home .v24-today-text{font-size:15px;line-height:1.55;flex:1;min-width:0}
      #home.v24-refined-home .v24-today-card{display:none!important}
      @media(max-width:420px){
        #home.v24-refined-home .hero{min-height:270px}
        #home.v24-refined-home .home-moment-mini{width:29%;top:76px;right:0}
        #home.v24-refined-home .days{font-size:86px;margin-top:40px}
        #home.v24-refined-home .names{font-size:15px;letter-spacing:2px}
      }
    `;
    document.head.appendChild(s);
  }
  function refine(){
    injectStyle();
    const home=document.getElementById('home');
    if(!home) return;
    const cards=[...home.querySelectorAll(':scope > .card')];
    const todayCard=cards.find(c=>/TODAY|今天/.test(c.querySelector('.eyebrow')?.textContent||''));
    const momentCard=cards.find(c=>/A MOMENT|此刻/.test(c.querySelector('.eyebrow')?.textContent||''));
    const hero=home.querySelector(':scope > .hero');
    const line=home.querySelector(':scope > .line');
    if(!todayCard||!momentCard||!hero||!line)return;
    home.classList.add('v24-refined-home');
    if(!momentCard.classList.contains('v24-moment-mini')){
      momentCard.classList.add('v24-moment-mini');
      hero.appendChild(momentCard);
    }
    let todayLine=home.querySelector('.v24-today-line');
    if(!todayLine){
      todayLine=document.createElement('div');
      todayLine.className='v24-today-line';
      todayLine.innerHTML='<span class="v24-today-label">TODAY</span><span class="v24-today-text"></span>';
      line.replaceWith(todayLine);
    }
    const source=document.getElementById('todayText');
    const target=todayLine.querySelector('.v24-today-text');
    if(source&&target)target.textContent=source.textContent;
    todayCard.classList.add('v24-today-card');
    const photo=momentCard.querySelector('#homePhoto');
    const file=momentCard.querySelector('#homeFile');
    if(photo&&file&&!photo.dataset.v24Bound){
      photo.dataset.v24Bound='1';
      photo.style.cursor='pointer';
      photo.addEventListener('click',()=>file.click());
    }
  }
  function sync(){
    const source=document.getElementById('todayText');
    const target=document.querySelector('#home.v24-refined-home .v24-today-text');
    if(source&&target)target.textContent=source.textContent;
  }
  function boot(){
    refine();sync();
    const source=document.getElementById('todayText');
    if(source&&window.MutationObserver)new MutationObserver(sync).observe(source,{characterData:true,childList:true,subtree:true});
    setTimeout(sync,100);setTimeout(refine,350);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
