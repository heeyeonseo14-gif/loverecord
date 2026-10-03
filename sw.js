const CACHE = 'love-record-v24-chat-v9-memory';
const ASSETS = [
  './','./index.html','./manifest.json','./icon-192.png','./icon-512.png',
  './chat-storage-v6.js?v=9',
  './chat-settings-upgrade.js?v=9',
  './chat-save-fix.js?v=9',
  './chat-bubble-split.js?v=9',
  './chat-interaction-v9.js?v=9'
];

function injectScript(html, file) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = new RegExp('<script\\b[^>]*src=["\\\']\\.\\/' + escaped + '(?:\\?[^"\\\']*)?["\\\'][^>]*>\\s*<\\/script>', 'i');
  const replacement = '<script src="./' + file + '?v=9"></script>';
  if (tag.test(html)) return html.replace(tag, replacement);
  return html.replace(/<\/body>/i, replacement + '</body>');
}
function patchHtml(html) {
  html = injectScript(html, 'chat-storage-v6.js');
  html = injectScript(html, 'chat-settings-upgrade.js');
  html = injectScript(html, 'chat-save-fix.js');
  html = injectScript(html, 'chat-bubble-split.js');
  html = html.replace(/<script\b[^>]*src=["']\.\/chat-interaction-v8\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/ig, '');
  html = injectScript(html, 'chat-interaction-v9.js');
  return html;
}
function htmlResponse(html, source) {
  const headers = new Headers(source && source.headers ? source.headers : undefined);
  headers.delete('content-length'); headers.delete('content-encoding'); headers.delete('etag');
  return new Response(patchHtml(html), {
    status: source && source.status ? source.status : 200,
    statusText: source && source.statusText ? source.statusText : 'OK',
    headers
  });
}
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isIndex = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  event.respondWith(fetch(event.request).then(response => {
    if (!response.ok || !isIndex) {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {}); }
      return response;
    }
    return response.text().then(html => {
      const patched = htmlResponse(html, response);
      caches.open(CACHE).then(cache => cache.put(event.request, patched.clone())).catch(() => {});
      return patched;
    });
  }).catch(() => caches.match(event.request).then(cached => {
    if (!cached || !isIndex) return cached;
    return cached.text().then(html => htmlResponse(html, cached));
  })));
});
