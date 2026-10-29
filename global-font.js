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
}catch(e){/* retain platform default font if IndexedDB is unavailable */}})();
})();