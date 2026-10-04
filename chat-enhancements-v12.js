/* LOVE RECORD V24 · chat polish and quote reply */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const css=document.createElement('style');css.textContent=`
 .lr-quote-action{display:block;margin:5px 3px 0 auto;padding:3px 9px;border:1px solid #e8ddeb;border-radius:99px;background:rgba(255,255,255,.72);color:#92789e;font-size:11px;line-height:1.5}
 .chat-message-row.ai .lr-quote-action{margin:5px auto 0 3px}
 .lr-quoted-context{display:block;margin-bottom:7px;padding:6px 9px;border-left:2px solid #b99bc8;background:rgba(185,155,200,.11);border-radius:0 8px 8px 0;color:#8c7895;font-size:12px;white-space:pre-wrap}
 #personReferencePreview{padding:7px 0;color:#998da0;font-size:12px}
 `;document.head.appendChild(css);
 function decorate(){
  const host=$('chatMessages');if(!host)return;
  host.querySelectorAll('.chat-message-row').forEach(row=>{
   if(row.querySelector('.lr-quote-action'))return;
   const bubble=row.querySelector('.chat-bubble');if(!bubble)return;
   const btn=document.createElement('button');btn.type='button';btn.className='lr-quote-action';btn.textContent='↩ 引用这条';
   btn.addEventListener('click',e=>{
    e.stopPropagation();
    const copy=bubble.cloneNode(true);copy.querySelectorAll('.lr-quote-action').forEach(x=>x.remove());const text=(copy.innerText||'').trim();if(!text)return;
    const input=$('chatInput');if(!input)return;
    const quote=text.length>180?text.slice(0,180)+'…':text;
    input.value=(input.value?input.value+'\n':'')+'「引用：'+quote+'」\n';
    input.focus();input.dispatchEvent(new Event('input',{bubbles:true}));
   });
   bubble.appendChild(btn);
  });
 }
 function wrap(){
  if(window.__lrQuoteRenderWrapped||typeof window.renderChat!=='function')return;
  window.__lrQuoteRenderWrapped=true;const original=window.renderChat;
  window.renderChat=function(){const out=original.apply(this,arguments);decorate();return out;};
 }
 function boot(){wrap();decorate();setTimeout(()=>{wrap();decorate()},350);document.addEventListener('click',e=>{if(e.target?.closest('.lr-quote-action'))setTimeout(decorate,30)})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();