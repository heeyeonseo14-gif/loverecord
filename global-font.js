(()=>{'use strict';
const DB='love-record-appearance-assets-v2',STORE='assets',KEY='yanyan-love-appearance-v1';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function get(k){const db=await openDB();return new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(k);r.onsuccess=()=>{db.close();resolve(r.result||null)};r.onerror=()=>{db.close();reject(r.error)}})}
function applyStack(stack){document.documentElement.style.setProperty('--lr-global-font',stack);let s=document.getElementById('lr-global-font-style');if(!s){s=document.createElement('style');s.id='lr-global-font-style';document.head.appendChild(s)}s.textContent='html,body,body *{font-family:var(--lr-global-font)!important}';}
(async()=>{try{let cfg=await get('settings');if(!cfg){try{cfg=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){cfg={}}}
let stack='-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif';
if(cfg?.font==='serif')stack='Georgia,"Times New Roman",serif';
if(cfg?.font==='custom'&&cfg.customFontName){const blob=await get('custom-font');if(blob){const face=new FontFace('LRCustomFont',`url(${URL.createObjectURL(blob)})`);await face.load();document.fonts.add(face);stack='"LRCustomFont",sans-serif';}}
applyStack(stack);
const preset=cfg?.preset||'purple';
document.body.classList.toggle('lr-theme-ios',preset==='ios'||!!cfg?.ios);
document.body.classList.toggle('lr-theme-liquid',preset==='liquid'||!!cfg?.liquid);
if(preset==='ios'||cfg?.ios){
 document.documentElement.style.setProperty('--accent','#007aff');
 document.documentElement.style.setProperty('--purple','#007aff');
}
if(preset==='liquid'||cfg?.liquid){
 document.documentElement.style.setProperty('--accent','#85878b');
 document.documentElement.style.setProperty('--purple','#85878b');
}
let theme=document.getElementById('lr-global-theme-skins-shared');
if(!theme){theme=document.createElement('style');theme.id='lr-global-theme-skins-shared';document.head.appendChild(theme)}
theme.textContent=`
body.lr-theme-ios{background:#f2f2f7!important;color:#1c1c1e!important;--accent:#007aff;--purple:#007aff;--bg:#f2f2f7;--ink:#1c1c1e;--muted:#73737a;--line:rgba(60,60,67,.16)}
body.lr-theme-ios .app-icon,body.lr-theme-ios .panel,body.lr-theme-ios .card,body.lr-theme-ios .dock,body.lr-theme-ios .bottom-nav,body.lr-theme-ios .nav-bar{background:rgba(250,250,252,.76)!important;border-color:rgba(255,255,255,.9)!important;box-shadow:0 12px 34px rgba(25,35,55,.08),inset 0 1px 0 rgba(255,255,255,.95)!important;backdrop-filter:blur(26px) saturate(1.3)!important;-webkit-backdrop-filter:blur(26px) saturate(1.3)!important}
body.lr-theme-ios .app-icon{border-radius:22px!important}
body.lr-theme-liquid{background:linear-gradient(135deg,#d7d8da,#ececee)!important;color:#343538!important;--accent:#85878b;--purple:#85878b;--bg:#d7d8da;--ink:#343538;--muted:#737579;--line:rgba(255,255,255,.68)}
body.lr-theme-liquid .app-icon,body.lr-theme-liquid .panel,body.lr-theme-liquid .card,body.lr-theme-liquid .dock,body.lr-theme-liquid .bottom-nav,body.lr-theme-liquid .nav-bar{background:linear-gradient(135deg,rgba(255,255,255,.64),rgba(210,211,214,.42))!important;border:1px solid rgba(255,255,255,.76)!important;box-shadow:0 18px 48px rgba(53,54,58,.1),inset 0 1px 0 rgba(255,255,255,.86)!important;backdrop-filter:blur(30px) saturate(.5)!important;-webkit-backdrop-filter:blur(30px) saturate(.5)!important}
body.lr-theme-liquid img{filter:grayscale(.65) saturate(.45)}
body.lr-theme-liquid .app-icon{border-radius:25px!important}
`;
}catch(e){/* retain platform default font if IndexedDB is unavailable */}})();
})();