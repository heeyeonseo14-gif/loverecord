const CACHE='love-record-v24-chat-bubbles-v7';
const ASSETS=[
  './','./index.html','./manifest.json','./icon-192.png','./icon-512.png',
  './chat-settings-upgrade.js?v=7','./chat-save-fix.js?v=6','./chat-storage-v6.js?v=6','./chat-bubble-split.js?v=7'
];
function patchHtml(html){
  if(!html.includes('chat-settings-upgrade.js')){
    html=html.replace(/<\/body>/i,'<script src="./chat-settings-upgrade.js?v=6"></script></body>');
  }
  if(!html.includes('chat-save-fix.js')){
    html=html.replace(/<\/body>/i,'<script src="./chat-save-fix.js?v=6"></script></body>');
  } else {
    html=html.replace(/chat-save-fix\.js(?:\?v=[^"']*)?/g,'chat-save-fix.js?v=6');
  }
  if(!html.includes('chat-storage-v6.js')){
    html=html.replace(/<\/body>/i,'<script src="./chat-storage-v6.js?v=6"></script></body>');
  }
  if(!html.includes('chat-bubble-split.js')){
    html=html.replace(/<\/body>/i,'<script src="./chat-bubble-split.js?v=7"></script></body>');
  }
  return html;
}
function responseFromHtml(html,source){
  const headers=new Headers(source&&source.headers?source.headers:undefined);
  headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
  return new Response(patchHtml(html),{
    status:source&&source.status?source.status:200,
    statusText:source&&source.statusText?source.statusText:'OK',
    headers
  });
}
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isIndex=url.pathname.endsWith('/')||url.pathname.endsWith('/index.html');
  event.respondWith(fetch(event.request).then(response=>{
    if(!response.ok||!isIndex){
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}
      return response;
    }
    return response.text().then(html=>{
      const patched=responseFromHtml(html,response);
      caches.open(CACHE).then(cache=>cache.put(event.request,patched.clone())).catch(()=>{});
      return patched;
    });
  }).catch(()=>caches.match(event.request).then(cached=>{
    if(!cached||!isIndex)return cached;
    return cached.text().then(html=>responseFromHtml(html,cached));
  })));
});
