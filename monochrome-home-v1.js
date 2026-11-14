(()=>{'use strict';
const intro=document.getElementById('loveIntro');
document.body.classList.add('lr-monochrome-home');
const soundBtn=document.getElementById('lrIntroSound'),skipBtn=document.getElementById('lrIntroSkip');
const KEY='lr-intro-sound-enabled-v1';
let soundOn=true,played=false,ctx=null;
try{const v=localStorage.getItem(KEY);if(v!==null)soundOn=v!=='0'}catch(e){}
function update(){if(!soundBtn)return;soundBtn.textContent=soundOn?'SOUND ON':'SOUND OFF';soundBtn.setAttribute('aria-pressed',String(soundOn))}
function playTone(){
 if(!soundOn||played)return;
 played=true;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  ctx=ctx||new AC();
  const run=()=>{const now=ctx.currentTime;[[392,.035,0],[587.33,.022,.16],[783.99,.012,.34]].forEach(([freq,vol,delay])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(freq,now+delay);g.gain.setValueAtTime(.0001,now+delay);g.gain.exponentialRampToValueAtTime(vol,now+delay+.18);g.gain.exponentialRampToValueAtTime(.0001,now+delay+2.1);o.connect(g);g.connect(ctx.destination);o.start(now+delay);o.stop(now+delay+2.2)})};
  if(ctx.state==='suspended')ctx.resume().then(run).catch(()=>{played=false});else run();
 }catch(e){}
}
update();
soundBtn?.addEventListener('click',()=>{soundOn=!soundOn;try{localStorage.setItem(KEY,soundOn?'1':'0')}catch(e){}played=false;update();if(soundOn)playTone()});
let started=false;function skip(){if(started)return;started=true;if(intro){intro.style.animation='none';intro.style.opacity='0';intro.style.visibility='hidden';intro.style.pointerEvents='none'}if(typeof window.LRShowWelcomeTour==='function')window.LRShowWelcomeTour()}
skipBtn?.addEventListener('click',skip);
window.addEventListener('pointerdown',()=>{if(!played&&soundOn)playTone()},{once:true,passive:true});
window.setTimeout(()=>{if(intro)intro.setAttribute('aria-hidden','true')},6100);
})();