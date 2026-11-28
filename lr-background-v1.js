/* LOVE RECORD Firebase background preferences + Web Push integration.
 * No chat history, character memories, or AI API keys are uploaded by this module.
 */
(() => {
  'use strict';
  const KEY = 'lr-background-settings-v1';
  const $ = (id) => document.getElementById(id);
  const cfg = () => window.LR_FIREBASE_CONFIG || {};
  const appConfigured = () => { const c=cfg(); return !!(c.apiKey && c.authDomain && c.projectId && c.messagingSenderId && c.appId); };
  const pushConfigured = () => appConfigured() && !!window.LR_FIREBASE_VAPID_KEY;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
  const status = (s) => { const el=$('lrBackgroundStatus'); if(el) el.textContent=s; };
  const aiStatus = (s) => { const el=$('lrBackgroundAiStatus'); if(el) el.textContent=s; };
  function render() {
    const settings=read();
    const card=$('lrBackgroundCard'); if(!card) return;
    const button=$('lrBackgroundEnable');
    if(button){button.disabled=!pushConfigured();button.textContent=settings.pushEnabled?'重新注册此设备':'启用本机后台通知';}
    if(!appConfigured()) status('等待填写 Firebase Web 配置');
    else if(!window.LR_FIREBASE_VAPID_KEY) status('Firebase 已配置，仍需填写 Web Push VAPID 公钥');
    else status(settings.pushEnabled?'本机已登记推送令牌':'Firebase 配置完成，尚未登记本机');
    const activity=$('lrBackgroundActivityEnabled'); if(activity) activity.checked=!!settings.activityEnabled;
    const mode=$('lrBackgroundMode'); if(mode) mode.value=settings.mode||'hybrid';
    const quiet=$('lrBackgroundQuietEnabled'); if(quiet) quiet.checked=settings.quietHours?.enabled!==false;
    const start=$('lrBackgroundQuietStart'); if(start) start.value=settings.quietHours?.start||'23:00';
    const end=$('lrBackgroundQuietEnd'); if(end) end.value=settings.quietHours?.end||'08:00';
    const save=$('lrBackgroundSavePrefs'); if(save) save.disabled=!appConfigured();
    const test=$('lrBackgroundTestPush'); if(test) test.disabled=!settings.pushEnabled || !appConfigured();
    aiStatus(settings.activityEnabled?'已保存活动偏好 · 等待角色/记忆云端同步':'尚未启用');
  }
  function loadCompat(src) { return new Promise((resolve,reject)=>{ if(document.querySelector('script[data-lr-firebase="'+src+'"]')) return resolve(); const s=document.createElement('script');s.src=src;s.async=true;s.dataset.lrFirebase=src;s.onload=resolve;s.onerror=()=>reject(new Error('Firebase SDK 加载失败：'+src));document.head.appendChild(s); }); }
  async function initFirebase({messaging=false}={}) {
    if(!appConfigured()) throw new Error('请先在 firebase-config.js 填入 Firebase Web App 配置。');
    const base='https://www.gstatic.com/firebasejs/13.0.0/';
    await loadCompat(base+'firebase-app-compat.js');
    await loadCompat(base+'firebase-auth-compat.js');
    await loadCompat(base+'firebase-functions-compat.js');
    if(messaging) await loadCompat(base+'firebase-messaging-compat.js');
    if(!firebase.apps.length) firebase.initializeApp(cfg());
    const auth=firebase.auth();
    if(!auth.currentUser) await auth.signInAnonymously();
    return {app:firebase.app(),auth,functions:firebase.app().functions(window.LR_FIREBASE_FUNCTIONS_REGION||'asia-southeast1')};
  }
  async function enablePush() {
    if(!pushConfigured()) { status(appConfigured()?'请填写 Firebase Web Push VAPID 公钥。':'请先填写 Firebase Web 配置。'); return; }
    if(!('serviceWorker' in navigator) || !('Notification' in window)) { status('当前浏览器不支持 Web Push。'); return; }
    if(!/^https:/.test(location.protocol) && location.hostname!=='localhost') { status('Web Push 需要 HTTPS 网站环境。'); return; }
    const button=$('lrBackgroundEnable'); if(button) button.disabled=true;
    try {
      status('正在连接 Firebase…');
      const {functions}=await initFirebase({messaging:true});
      const permission=await Notification.requestPermission();
      if(permission!=='granted') throw new Error('通知权限未获准。请在 Android 网站/应用通知设置中允许通知。');
      const reg=await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      await navigator.serviceWorker.ready;
      const messaging=firebase.messaging();
      const token=await messaging.getToken({vapidKey:window.LR_FIREBASE_VAPID_KEY,serviceWorkerRegistration:reg});
      if(!token) throw new Error('没有取得 FCM 注册令牌。请检查 VAPID 公钥和 Firebase Cloud Messaging 设置。');
      await functions.httpsCallable('registerPushDevice')({token,platform:'web',userAgent:navigator.userAgent.slice(0,180)});
      const old=read(); write({...old,pushEnabled:true,registeredAt:Date.now()});
      status('本机推送令牌已登记。可以发送测试通知。');
    } catch(error) {
      console.error('[LOVE RECORD] push setup failed',error);
      status('启用失败：'+(error && error.message || String(error)));
    } finally { if(button) button.disabled=false; render(); }
  }
  function collectPreferences() {
    return {
      enabled:!!$('lrBackgroundActivityEnabled')?.checked,
      mode:$('lrBackgroundMode')?.value||'hybrid',
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Kuala_Lumpur',
      intervalMinutes:120,
      quietHours:{enabled:!!$('lrBackgroundQuietEnabled')?.checked,start:$('lrBackgroundQuietStart')?.value||'23:00',end:$('lrBackgroundQuietEnd')?.value||'08:00'}
    };
  }
  async function savePreferences() {
    const button=$('lrBackgroundSavePrefs'); if(button) button.disabled=true;
    try {
      const prefs=collectPreferences();
      const {functions}=await initFirebase();
      await functions.httpsCallable('saveBackgroundPreferences')(prefs);
      const old=read(); write({...old,activityEnabled:prefs.enabled,mode:prefs.mode,quietHours:prefs.quietHours,preferencesSavedAt:Date.now()});
      aiStatus(prefs.enabled?'活动偏好已同步 · 等待角色/记忆云端同步':'后台自主活动已关闭');
      status('后台活动偏好已保存到 Firebase。');
    } catch(error) {
      console.error('[LOVE RECORD] save background preferences failed',error);
      status('保存失败：'+(error?.message||String(error)));
    } finally { if(button) button.disabled=false; render(); }
  }
  async function sendTestPush() {
    const button=$('lrBackgroundTestPush'); if(button) button.disabled=true;
    try {
      const {functions}=await initFirebase();
      const result=await functions.httpsCallable('sendBackgroundTestNotification')({});
      status('测试通知已提交：成功 '+(result.data?.successCount??0)+' 台设备。请检查手机通知栏。');
    } catch(error) {
      console.error('[LOVE RECORD] test push failed',error);
      status('测试通知失败：'+(error?.message||String(error)));
    } finally { if(button) button.disabled=false; render(); }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(!$('lrBackgroundCard')) return;
    $('lrBackgroundEnable')?.addEventListener('click',enablePush);
    $('lrBackgroundSavePrefs')?.addEventListener('click',savePreferences);
    $('lrBackgroundTestPush')?.addEventListener('click',sendTestPush);
    render();
  });
  window.LRBackground={render,enablePush,savePreferences,sendTestPush,isConfigured:appConfigured,isPushConfigured:pushConfigured};
})();
