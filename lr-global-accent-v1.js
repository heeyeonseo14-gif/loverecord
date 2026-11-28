/* LOVE RECORD · shared global emphasis-color bridge for standalone app pages. */
(()=>{'use strict';
const KEY='yanyan-love-appearance-v1';
const STYLE_ID='lr-global-accent-shared-v1';
function validColor(value){const s=String(value||'').trim();return /^#[0-9a-f]{6}$/i.test(s)||/^#[0-9a-f]{3}$/i.test(s)?s:'#b79bc7'}
function readAccent(){try{const cfg=JSON.parse(localStorage.getItem(KEY)||'{}');return validColor(cfg&&cfg.accent)}catch(e){return '#b79bc7'}}
function apply(){const accent=readAccent(),root=document.documentElement;root.style.setProperty('--lr-accent',accent);root.style.setProperty('--accent',accent);root.style.setProperty('--purple',accent);root.style.setProperty('--accent-color',accent);root.style.setProperty('--lr-accent-soft',`color-mix(in srgb,${accent} 14%,white)`);root.style.setProperty('--lr-accent-border',`color-mix(in srgb,${accent} 34%,white)`);let style=document.getElementById(STYLE_ID);if(!style){style=document.createElement('style');style.id=STYLE_ID;document.head.appendChild(style)}style.textContent=`
:root{--lr-accent:${accent};--accent:${accent};--purple:${accent};--accent-color:${accent};--lr-accent-soft:color-mix(in srgb,${accent} 14%,white);--lr-accent-border:color-mix(in srgb,${accent} 34%,white)}
button.primary,.btn.primary,.action.primary,.primary-button,.btn-primary,[data-accent-role="primary"]{background:var(--lr-accent)!important;border-color:var(--lr-accent)!important;color:#fff!important}
input[type=range],input[type=checkbox],input[type=radio],progress{accent-color:var(--lr-accent)!important}
.tab.active,.tabs .active,.nav-item.active,[role="tab"][aria-selected="true"],[aria-pressed="true"],.selected,.is-active,.active-option{border-color:var(--lr-accent)!important;color:var(--lr-accent)!important}
.tab.active,.tabs .active,.nav-item.active,[role="tab"][aria-selected="true"],.selected,.is-active,.active-option{box-shadow:0 0 0 1px var(--lr-accent-soft)!important}
.status-dot,.progress-fill,.progress-bar>i,.progress-bar>span,.loading-indicator{background-color:var(--lr-accent)!important}
a:focus-visible,button:focus-visible,select:focus,textarea:focus,input:focus{outline-color:var(--lr-accent)!important}
`}
apply();
window.addEventListener('storage',e=>{if(e.key===KEY)apply()});
window.addEventListener('pageshow',apply);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply()});
})();
