/* LOVE RECORD background & push foundation. Firebase config is public client config. */
(() => {
  'use strict';
  const KEY = 'lr-background-settings-v1';
  const $ = (id) => document.getElementById(id);
  const cfg = () => window.LR_FIREBASE_CONFIG || {};
  const configured = () => { const c=cfg(); return !!(c.apiKey && c.authDomain && c.projectId && c.messagingSenderId && c.appId && window.LR_FIREBASE_VAPID_KEY); };
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const status = (s) => { const el=$('lrBackgroundStatus'); if(el) el.textContent=s; };
  function render() {
    const settings=read();
    const card=$('lrBackgroundCard'); if(!card) return;
    const ready=configured();
    status(ready ? (settings.pushEnabled ? 'Firebase 配置已读取 · 推送已启用（需完成服务器部署）' : 'Firebase 配置已读取 · 尚未启用通知') : '等待填写 Firebase Web 配置与 VAPID 公钥');
    const button=$('lrBackgroundEnable'); if(button) { button.disabled=!ready; button.textContent=settings.pushEnabled?'重新注册此设备':'启用后台通知'; }
  }
  function loadCompat(src) { return new Promise((resolve,reject)=>{ if(document.querySelector('script[data-lr-firebase="'+src+'"]')) return resolve(); const s=document.createElement('script');s.src=src;s.async=true;s.dataset.lrFirebase=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s); }); }
  async function enablePush() {
    if(!configured()) { status('请先在 firebase-config.js 填入 Firebase Web 配置和 VAPID 公钥。'); return; }
    if(!('serviceWorker' in navigator) || !('Notification' in window)) { status('当前浏览器不支持 Web Push。'); return; }
    if(!/^https:/.test(location.protocol) && location.hostname!=='localhost') { status('Web Push 需要 HTTPS 网站环境。'); return; }
    const button=$('lrBackgroundEnable'); if(button) button.disabled=true;
    try {
      status('正在连接 Firebase…');
      await loadCompat('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
      await loadCompat('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js');
      await loadCompat('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
      await loadCompat('https://www.gstatic.com/firebasejs/10.14.1/firebase-functions-compat.js');
      if(!firebase.apps.length) firebase.initializeApp(cfg());
      const permission=await Notification.requestPermission();
      if(permission!=='granted') throw new Error('通知权限未获准。请在 Android 网站/应用通知设置中允许通知。');
      const reg=await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      await navigator.serviceWorker.ready;
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:window.LR_FIREBASE_VAPID_KEY,serviceWorkerRegistration:reg});
      if(!token) throw new Error('没有取得 FCM 注册令牌。请检查 VAPID 公钥和 Firebase Cloud Messaging 设置。');
      const auth= firebase.auth();
      if(!auth.currentUser) await auth.signInAnonymously();
      const functions=firebase.app().functions((window.LR_FIREBASE_FUNCTIONS_REGION||'asia-southeast1'));
      await functions.httpsCallable('registerPushDevice')({token, platform:'web', userAgent:navigator.userAgent.slice(0,180)});
      const old=read(); write({...old,pushEnabled:true,registeredAt:Date.now()});
      status('此设备已注册推送。后台 AI 活动仍需部署 Functions 并完成角色云端同步。');
    } catch(error) {
      console.error('[LOVE RECORD] push setup failed',error);
      status('启用失败：'+(error && error.message || String(error)));
    } finally { if(button) button.disabled=false; render(); }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const card=$('lrBackgroundCard'); if(card) { $('lrBackgroundEnable')?.addEventListener('click',enablePush); render(); }
  });
  window.LRBackground={render,enablePush,isConfigured:configured};
})();
