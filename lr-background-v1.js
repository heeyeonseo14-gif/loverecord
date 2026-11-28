/* LOVE RECORD Firebase background preferences + Web Push integration.
 * No chat history, character memories, or AI API keys are uploaded by this module.
 */
(() => {
  'use strict';
  const KEY = 'lr-background-settings-v1';
  const CONTROL_KEY = 'lr-background-conversation-controls-v1';
  const $ = (id) => document.getElementById(id);
  const SDK_VERSION = '13.4.0';
  let firebaseCorePromise = null;
  let authObserverBound = false;
  let currentUser = null;
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
  const compatPromises = new Map();
  function loadCompat(src) {
    if (compatPromises.has(src)) return compatPromises.get(src);
    const existing = document.querySelector('script[data-lr-firebase="'+src+'"]');
    if (existing?.dataset.loaded === 'true') return Promise.resolve();
    const promise = new Promise((resolve,reject)=>{
      const script = existing || document.createElement('script');
      if (!existing) { script.src=src; script.async=true; script.dataset.lrFirebase=src; }
      script.onload=()=>{script.dataset.loaded='true';resolve();};
      script.onerror=()=>{compatPromises.delete(src);reject(new Error('Firebase SDK 加载失败：'+src));};
      if (!existing) document.head.appendChild(script);
    });
    compatPromises.set(src,promise);
    return promise;
  }
  function formatAuthDate(value) {
    if (!value) return '暂无记录';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无记录';
    try { return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date); }
    catch { return date.toLocaleString(); }
  }
  function renderIdentity(user, message) {
    const statusNode=$('lrIdentityStatus'), uidNode=$('lrIdentityUid'), copy=$('lrIdentityCopy');
    const created=$('lrIdentityCreatedAt'), last=$('lrIdentityLastSeen');
    if (!statusNode && !uidNode && !copy) return;
    if (message) {
      if(statusNode) statusNode.textContent=message;
      if(uidNode) uidNode.textContent='暂不可用';
      if(copy) copy.disabled=true;
      if(created) created.textContent='—';
      if(last) last.textContent='—';
      return;
    }
    if (!user) {
      if(statusNode) statusNode.textContent='正在建立匿名身份…';
      if(uidNode) uidNode.textContent='正在获取…';
      if(copy) copy.disabled=true;
      return;
    }
    currentUser=user;
    if(statusNode) statusNode.textContent=user.isAnonymous?'已连接 · 匿名账户':'已连接 · 已绑定账户';
    if(uidNode) uidNode.textContent=user.uid;
    if(copy) copy.disabled=!user.uid;
    if(created) created.textContent=formatAuthDate(user.metadata?.creationTime);
    if(last) last.textContent=formatAuthDate(user.metadata?.lastSignInTime);
  }
  async function initFirebase({messaging=false}={}) {
    if(!appConfigured()) throw new Error('请先在 firebase-config.js 填入 Firebase Web App 配置。');
    if (!firebaseCorePromise) {
      firebaseCorePromise = (async () => {
        const base='https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/';
        await loadCompat(base+'firebase-app-compat.js');
        await loadCompat(base+'firebase-auth-compat.js');
        await loadCompat(base+'firebase-functions-compat.js');
        if(!firebase.apps.length) firebase.initializeApp(cfg());
        const auth=firebase.auth();
        // Explicit LOCAL persistence keeps the anonymous identity in this browser.
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        let user=auth.currentUser;
        if(!user) {
          const credential=await auth.signInAnonymously();
          user=credential?.user || auth.currentUser;
        }
        if (!authObserverBound) {
          authObserverBound=true;
          auth.onAuthStateChanged((nextUser)=>{currentUser=nextUser||null;renderIdentity(nextUser||null);});
        }
        currentUser=user||auth.currentUser||null;
        renderIdentity(currentUser);
        return {app:firebase.app(),auth,user:currentUser};
      })().catch((error)=>{firebaseCorePromise=null;throw error;});
    }
    const core=await firebaseCorePromise;
    if(messaging) await loadCompat('https://www.gstatic.com/firebasejs/'+SDK_VERSION+'/firebase-messaging-compat.js');
    return {...core,functions:core.app.functions(window.LR_FIREBASE_FUNCTIONS_REGION||'asia-southeast1')};
  }
  async function bootstrapIdentity() {
    if (!appConfigured()) { renderIdentity(null,'等待 Firebase Web 配置'); return null; }
    renderIdentity(null);
    try { const {user}=await initFirebase(); return user; }
    catch(error) {
      console.error('[LOVE RECORD] anonymous identity initialization failed',error);
      renderIdentity(null,'连接失败：'+(error?.message||String(error)));
      return null;
    }
  }
  async function copyIdentity() {
    const uid=currentUser?.uid;
    if(!uid) return;
    try {
      if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(uid);
      else { const field=document.createElement('textarea');field.value=uid;field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('浏览器未允许复制'); }
      if(typeof window.toast==='function') window.toast('用户编号已复制');
      else if(typeof window.notify==='function') window.notify('用户编号已复制');
      else { const node=$('lrIdentityStatus');if(node)node.textContent='用户编号已复制'; }
    } catch(error) {
      console.warn('[LOVE RECORD] copy UID failed',error);
      const node=$('lrIdentityStatus');if(node)node.textContent='复制失败，请长按 UID 手动复制';
    }
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
    const prefs=collectPreferences();
    const old=read(); write({...old,activityEnabled:prefs.enabled,mode:prefs.mode,quietHours:prefs.quietHours,preferencesSavedAt:Date.now()});
    try {
      if (!appConfigured()) {
        aiStatus(prefs.enabled?'总开关已保存在本机 · 等待 Firebase 配置':'后台自主活动已关闭');
        status('后台活动设置已保存在本机；填写 Firebase 配置后可同步云端。');
        return { local: true, cloud: false };
      }
      const {functions}=await initFirebase();
      await functions.httpsCallable('saveBackgroundPreferences')(prefs);
      aiStatus(prefs.enabled?'总开关已同步 · 等待角色/记忆云端同步':'后台自主活动已关闭');
      status('后台活动总开关已保存到 Firebase。');
      return { local: true, cloud: true };
    } catch(error) {
      console.error('[LOVE RECORD] save background preferences failed',error);
      status('设置已保存在本机；云端同步待完成：'+(error?.message||String(error)));
      return { local: true, cloud: false, reason: error?.message || String(error) };
    } finally { if(button) button.disabled=false; render(); }
  }
  async function setConversationControl(type, conversationId, enabled) {
    const kind = type === 'group' ? 'group' : 'single';
    const id = String(conversationId || '').trim();
    if (!id || id.length > 180) throw new Error('聊天 ID 无效。');
    let controls = {};
    try { controls = JSON.parse(localStorage.getItem(CONTROL_KEY) || '{}') || {}; } catch { controls = {}; }
    const key = kind + ':' + id;
    controls[key] = { type: kind, conversationId: id, enabled: !!enabled, updatedAt: Date.now() };
    try { localStorage.setItem(CONTROL_KEY, JSON.stringify(controls)); } catch (error) { throw new Error('后台开关本地保存失败：' + (error?.message || '储存空间不足')); }
    if (!appConfigured()) {
      status('聊天后台开关已保存在本机；填写 Firebase 配置后可同步云端。');
      return { local: true, cloud: false, reason: 'firebase-not-configured' };
    }
    try {
      const { functions } = await initFirebase();
      await functions.httpsCallable('saveBackgroundConversationControl')({ type: kind, conversationId: id, enabled: !!enabled });
      status('聊天后台开关已保存并同步到 Firebase。');
      return { local: true, cloud: true };
    } catch (error) {
      console.warn('[LOVE RECORD] background conversation control cloud sync pending', error);
      status('聊天后台开关已保存在本机；云端同步待完成：' + (error?.message || String(error)));
      return { local: true, cloud: false, reason: error?.message || String(error) };
    }
  }
  function isConversationEnabled(type, conversationId) {
    const settings = read();
    if (!settings.activityEnabled) return false;
    try {
      const controls = JSON.parse(localStorage.getItem(CONTROL_KEY) || '{}') || {};
      return controls[(type === 'group' ? 'group:' : 'single:') + String(conversationId || '')]?.enabled === true;
    } catch { return false; }
  }
  async function setGlobalActivityEnabled(enabled) {
    const old = read(); write({ ...old, activityEnabled: !!enabled });
    const input = $('lrBackgroundActivityEnabled'); if (input) input.checked = !!enabled;
    return savePreferences();
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
  function escapeCheckHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  async function testBackgroundRuntime() {
    const button = $('lrBackgroundRunCheck');
    const summary = $('lrBackgroundCheckSummary');
    const details = $('lrBackgroundCheckDetails');
    if (button) button.disabled = true;
    if (summary) summary.textContent = '正在检测…';
    const checks = [];
    const add = (name, value, level = 'info') => checks.push({ name, value, level });
    try {
      const secure = location.protocol === 'https:' || location.hostname === 'localhost';
      add('HTTPS 安全环境', secure ? '当前环境符合要求' : '当前不是 HTTPS；推送功能需要 HTTPS', secure ? 'ok' : 'warn');

      const configured = appConfigured();
      add('Firebase Web 配置', configured ? '已检测到必要配置项' : '尚未填写完整配置', configured ? 'ok' : 'warn');
      if (configured) {
        const user = await bootstrapIdentity();
        if (user?.uid) add('Firebase 匿名身份', '已登录 · UID ' + user.uid.slice(0, 8) + '…', 'ok');
        else add('Firebase 匿名身份', '未能确认登录；请查看上方身份状态及浏览器控制台', 'warn');
      } else {
        add('Firebase 匿名身份', '跳过：请先完成 Firebase Web 配置', 'info');
      }

      if ('serviceWorker' in navigator) {
        let registration = null;
        try { registration = await navigator.serviceWorker.getRegistration('./'); } catch (_) {}
        const worker = registration && (registration.active || registration.waiting || registration.installing);
        if (worker) {
          add('Service Worker', '已找到注册记录 · ' + worker.state, worker.state === 'activated' ? 'ok' : 'warn');
        } else {
          add('Service Worker', '尚未找到活动注册记录；请刷新页面后重试', 'warn');
        }
      } else {
        add('Service Worker', '当前浏览器不支持', 'warn');
      }

      if ('Notification' in window) {
        const permission = Notification.permission;
        const permissionText = permission === 'granted' ? '已允许' : permission === 'denied' ? '已拒绝；请到 Android/浏览器设置中开启' : '尚未询问/尚未允许';
        add('通知权限', permissionText, permission === 'granted' ? 'ok' : 'warn');
      } else {
        add('通知权限', '当前浏览器不支持通知 API', 'warn');
      }

      add('Web Push VAPID 公钥', window.LR_FIREBASE_VAPID_KEY ? '已配置' : '尚未配置', window.LR_FIREBASE_VAPID_KEY ? 'ok' : 'warn');
      const settings = read();
      add('本机推送登记标记', settings.pushEnabled ? '本机保存为已登记（此项不代表服务器端已复核）' : '本机尚未记录推送登记', settings.pushEnabled ? 'ok' : 'warn');
      add('后台活动总开关', settings.activityEnabled ? '已开启（本机设置）' : '未开启（本机设置）', settings.activityEnabled ? 'ok' : 'info');
      add('云端定时任务 / CHAR 自动生成', '此按钮无法验证云端部署；当前版本尚未接通 CHAR 后台自动生成', 'info');

      const passed = checks.filter(item => item.level === 'ok').length;
      const pending = checks.filter(item => item.level === 'warn').length;
      if (summary) summary.textContent = '检测完成 · ' + passed + ' 项通过 · ' + pending + ' 项待处理';
      if (details) {
        details.innerHTML = checks.map(item => '<div class="check-row"><span>' + escapeCheckHtml(item.name) + '</span><strong>' + escapeCheckHtml(item.value) + '</strong></div>').join('');
      }
    } catch (error) {
      console.error('[LOVE RECORD] background runtime check failed', error);
      if (summary) summary.textContent = '检测未完成';
      if (details) details.textContent = '检测过程中发生错误：' + (error?.message || String(error));
    } finally {
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('lrIdentityCopy')?.addEventListener('click',copyIdentity);
    if($('lrBackgroundCard')) {
      $('lrBackgroundEnable')?.addEventListener('click',enablePush);
      $('lrBackgroundSavePrefs')?.addEventListener('click',savePreferences);
      $('lrBackgroundTestPush')?.addEventListener('click',sendTestPush);
      $('lrBackgroundRunCheck')?.addEventListener('click',testBackgroundRuntime);
      render();
    }
    // Create or restore the anonymous Firebase identity automatically on app startup.
    bootstrapIdentity();
  });
  window.LRBackground={render,enablePush,savePreferences,sendTestPush,testBackgroundRuntime,setConversationControl,isConversationEnabled,setGlobalActivityEnabled,isConfigured:appConfigured,isPushConfigured:pushConfigured,ensureIdentity:bootstrapIdentity,getCurrentUser:()=>currentUser};
})();
