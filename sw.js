const CACHE='love-record-v24-home1';
const ASSETS=['./','./index.html','./home-layout-v24.js','./manifest.json','./icon-192.png','./icon-512.png'];

function injectPatch(text){
  if(text.includes('home-layout-v24.js')) return text;
  return text.replace('</body>','<script src="./home-layout-v24.js"></script></body>');
}

async function cachePatchedIndex(cache){
  try{
    const r=await fetch('./index.html',{cache:'no-store'});
    const t=await r.text();
    await cache.put('./index.html',new Response(injectPatch(t),{
      headers:{'Content-Type':'text/html; charset=utf-8'}
    }));
  }catch(e){
    // Keep going; the normal cache entries are still useful offline.
  }
}

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(['./','./home-layout-v24.js','./manifest.json','./icon-192.png','./icon-512.png']);
    await cachePatchedIndex(c);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const isIndex=url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
  if(isIndex){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(async r=>{
          const copy=r.clone();
          const t=await r.text();
          const patched=new Response(injectPatch(t),{
            status:r.status,
            statusText:r.statusText,
            headers:r.headers
          });
          caches.open(CACHE).then(c=>c.put('./index.html',patched.clone())).catch(()=>{});
          return patched;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
        return r;
      })
      .catch(()=>caches.match(e.request))
  );
});
