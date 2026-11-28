/* Notification click handler is registered before importing Firebase Messaging. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './index.html', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of wins) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

/* Firebase Cloud Messaging receives data-only pushes while the PWA is backgrounded. */
try {
  importScripts('./firebase-config.js');
  const fc = self.LR_FIREBASE_CONFIG || {};
  if (fc.apiKey && fc.projectId && fc.messagingSenderId && fc.appId) {
    importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/13.0.0/firebase-messaging-compat.js');
    firebase.initializeApp(fc);
    const lrMessaging = firebase.messaging();
    lrMessaging.onBackgroundMessage((payload) => {
      const d = payload.data || {};
      const title = (payload.notification && payload.notification.title) || d.title || 'LOVE RECORD';
      const options = {
        body: (payload.notification && payload.notification.body) || d.body || '有新的消息。',
        icon: './icon-192.png', badge: './icon-192.png',
        tag: d.tag || ('lr-' + (d.conversationId || Date.now())),
        data: { url: d.url || './index.html', conversationId: d.conversationId || '' }
      };
      return self.registration.showNotification(title, options);
    });
  }
} catch (e) { console.warn('[LOVE RECORD] Firebase Messaging is not configured.', e); }
const CACHE='love-record-our-little-farm-20261128-v143';
const ASSETS=['./zodiac.html','./zodiac.css?v=1','./zodiac.js?v=1','./dream-fate.html','./dream-fate.css?v=2','./dream-fate.js?v=2','./weather-calendar.html','./weather-calendar.css?v=1','./weather-calendar.js?v=1','./lr-store.html','./lr-store.js?v=1','./lr-store-runtime.js?v=2','./global-font.js?v=100','./chat-interaction-v10.js?v=99','./','./index.html?v=143','./appearance.html?v=124','./home-fixed-layout-v1.css?v=10','./home-fixed-layout-v1.js?v=7','./lr-appearance-enhancements-v1.js?v=2','./lr-global-accent-v1.js?v=1','./checkin.html','./checkin-v1.js?v=11','./manifest.json?v=118','./icon-192.png','./icon-512.png','./music.js?v=100','./chat-storage-v6.js?v=99','./chat-settings-upgrade.js?v=17','./chat-save-fix.js?v=100','./chat-bubble-split.js?v=19','./chat-interaction-v9.js?v=26','./chat-interaction-v11.js?v=46','./chat-long-storage.js?v=100','./lr-full-backup-v1.js?v=4','./chat-ux-v13.js?v=100','./lr-group-chat-v1.js?v=15','./diary-v1.js?v=2','./chat-background-picker-v1.js?v=24','./chat-css-unify.js?v=19','./community-v1.js?v=4','./space-v2.js?v=61','./space-story-v1.js?v=18','./space-city-v1.js?v=10','./games-v1.js?v=28','./farm-home-3d.js?v=28','./moments-v1.js?v=100', './star-assistant.html','./star-assistant.css?v=4','./star-assistant.js?v=5','./star-guide-knowledge.json?v=4','./firebase-config.js?v=2','./lr-background-v1.js?v=2','./functions/package.json','./functions/index.js'];
function inject(html,file){
 const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const tag=new RegExp("<script\\b[^>]*src=[\"']\\./"+escaped+"(?:\\?[^\"']*)?[\"'][^>]*>\\s*<\\/script>",'i');
 const versions={'music.js':'100','chat-long-storage.js':'100','chat-storage-v6.js':'16','chat-save-fix.js':'100','chat-interaction-v11.js':'46','chat-interaction-v9.js':'26','chat-background-picker-v1.js':'24','community-v1.js':'4','space-v2.js':'61','life-apps.js':'20261010-orderui1','chat-ux-v13.js':'100','moments-v1.js':'100','lr-full-backup-v1.js':'4','chat-css-unify.js':'19','lr-group-chat-v1.js':'14'};
 const version=versions[file]||'19';
 const replacement='<script src="./'+file+'?v='+version+'"></script>';
 return tag.test(html)?html.replace(tag,replacement):html.replace('</body>',replacement+'</body>')
}
function patch(html){html=inject(html,'chat-storage-v6.js');html=inject(html,'chat-settings-upgrade.js');html=inject(html,'chat-save-fix.js');html=inject(html,'chat-bubble-split.js');html=html.replace(/<script\b[^>]*src=["']\.\/chat-interaction-v8\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/ig,'');html=html.replace(/<script\b[^>]*src=["']\.\/chat-interaction-v10\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/ig,'');html=inject(html,'chat-interaction-v9.js');html=inject(html,'chat-interaction-v11.js');html=inject(html,'chat-long-storage.js');html=inject(html,'lr-full-backup-v1.js');html=inject(html,'chat-ux-v13.js');html=inject(html,'chat-css-unify.js');html=inject(html,'chat-background-picker-v1.js');html=inject(html,'music.js');html=inject(html,'community-v1.js');html=inject(html,'space-v2.js');
 const fresh=['chat-interaction-v10.js','chat-interaction-v11.js','chat-long-storage.js','chat-save-fix.js','chat-storage-v6.js','chat-ux-v13.js','global-font.js','moments-v1.js','music.js','lr-full-backup-v1.js'];
 html=html.replace(/(src=["']\.\/(?:app|community-v1|games-v1|life-apps|chat-interaction-v10|chat-interaction-v11|chat-long-storage|chat-save-fix|chat-storage-v6|chat-ux-v13|global-font-v1|moments-v1|music)\.js\?v=)\d+/g,'$1'+'99');
 html=html.replace(/(src=["']\.\/chat-long-storage\.js\?v=)\d+/g,'$1'+'100');
 html=html.replace(/(src=["']\.\/music\.js\?v=)\d+/g,'$1'+'100');
 html=html.replace(/(src=["']\.\/lr-full-backup-v1\.js\?v=)\d+/g,'$1'+'4');
 html=html.replace(/(src=["']\.\/moments-v1\.js\?v=)\d+/g,'$1'+'100');
 html=html.replace(/(src=["']\.\/chat-save-fix\.js\?v=)\d+/g,'$1'+'100');
 html=html.replace(/(src=["']\.\/chat-ux-v13\.js\?v=)\d+/g,'$1'+'100');
 return html}
function response(html,source){const h=new Headers(source?.headers||{});['content-length','content-encoding','etag'].forEach(x=>h.delete(x));return new Response(patch(html),{status:source?.status||200,statusText:source?.statusText||'OK',headers:h})}
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('love-record-our-little-farm-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url),isIndex=u.pathname.endsWith('/')||u.pathname.endsWith('/index.html');if(u.pathname.endsWith('/shiyi.html')){e.respondWith(fetch(e.request,{cache:'no-store'}));return}e.respondWith(fetch(e.request).then(r=>{if(!r.ok||!isIndex){if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone())).catch(()=>{});return r}return r.text().then(t=>{const p=response(t,r);caches.open(CACHE).then(c=>c.put(e.request,p.clone())).catch(()=>{});return p})}).catch(()=>caches.match(e.request).then(c=>!c||!isIndex?c:c.text().then(t=>response(t,c)))))});
