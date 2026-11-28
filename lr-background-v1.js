/* LOVE RECORD · Background push + cloud CHAR sync (Spark-compatible client)
 * Device registration/preferences/context use the user's own Firestore path.
 * No Firebase Cloud Functions are called by the web client.
 */
(() => {
  'use strict';
  if (window.__LR_BACKGROUND_V2__) return;
  window.__LR_BACKGROUND_V2__ = true;

  const KEY = 'lr-background-settings-v1';
  const CONTROL_KEY = 'lr-background-conversation-controls-v1';
  const $ = (id) => document.getElementById(id);
  const SDK_VERSION = '13.4.0';
  let firebaseCorePromise = null;
  let authObserverBound = false;
  let currentUser = null;
  let visibleStatus = '';
  let contextSyncTimer = null;
  let automaticContextSyncBusy = false;
  const compatPromises = new Map();
  const cfg = () => window.LR_FIREBASE_CONFIG || {};
  const appConfigured = () => {
    const c = cfg();
    return !!(c.apiKey && c.authDomain && c.projectId && c.messagingSenderId && c.appId);
  };
  const pushConfigured = () => appConfigured() && !!window.LR_FIREBASE_VAPID_KEY;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  const write = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { console.warn('[LOVE RECORD] background local settings write failed', e); } };
  function status(message) {
    visibleStatus = String(message || '');
    const el = $('lrBackgroundStatus');
    if (el) el.textContent = visibleStatus;
  }
  const aiStatus = (message) => { const el = $('lrBackgroundAiStatus'); if (el) el.textContent = message; };
  const dbFor = () => firebase.firestore();
  const userRoot = (uid = currentUser?.uid) => {
    if (!uid) throw new Error('Firebase 用户身份尚未建立，请刷新页面后重试。');
    return dbFor().collection('users').doc(uid);
  };
  async function ensureUserDocument(user, db = dbFor()) {
    if (!user?.uid) throw new Error('Firebase 用户身份尚未建立。');
    // The scheduled runner enumerates /users, so create this parent document
    // before writing any nested device/background documents.
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      accountType: user.isAnonymous ? 'anonymous' : 'registered',
      lastSeenAt: firebase.firestore.FieldValue.serverTimestamp(),
      client: 'love-record-web'
    }, { merge: true });
  }
  function render() {
    const settings = read();
    const card = $('lrBackgroundCard');
    if (!card) return;
    const button = $('lrBackgroundEnable');
    if (button) {
      button.disabled = !pushConfigured();
      button.textContent = settings.pushEnabled ? '重新登记本机通知' : '启用本机后台通知';
    }
    if (!visibleStatus) {
      if (!appConfigured()) visibleStatus = '等待填写 Firebase Web 配置';
      else if (!window.LR_FIREBASE_VAPID_KEY) visibleStatus = 'Firebase 已配置，仍需填写 Web Push VAPID 公钥';
      else visibleStatus = settings.pushEnabled ? '本机推送令牌已登记' : 'Firebase 配置完成，尚未登记本机';
    }
    const statusNode = $('lrBackgroundStatus');
    if (statusNode) statusNode.textContent = visibleStatus;
    const activity = $('lrBackgroundActivityEnabled'); if (activity) activity.checked = !!settings.activityEnabled;
    const mode = $('lrBackgroundMode'); if (mode) mode.value = 'interval';
    const interval = $('lrBackgroundInterval'); if (interval) interval.value = String(settings.intervalMinutes || 120);
    const batch = $('lrBackgroundMessagesPerRun'); if (batch) batch.value = String(settings.messagesPerRun || '2-3');
    const quiet = $('lrBackgroundQuietEnabled'); if (quiet) quiet.checked = settings.quietHours?.enabled !== false;
    const start = $('lrBackgroundQuietStart'); if (start) start.value = settings.quietHours?.start || '23:00';
    const end = $('lrBackgroundQuietEnd'); if (end) end.value = settings.quietHours?.end || '08:00';
    const save = $('lrBackgroundSavePrefs'); if (save) save.disabled = !appConfigured();
    const test = $('lrBackgroundTestPush'); if (test) test.disabled = !settings.pushEnabled || !appConfigured();
    const sync = $('lrBackgroundSyncContext'); if (sync) sync.disabled = !appConfigured();
    aiStatus(settings.cloudContextSyncedAt ? '角色/记忆已同步 · 等待云端定时任务' : (settings.activityEnabled ? '后台开关已保存 · 尚未同步角色/记忆' : '尚未启用'));
  }
  function loadCompat(src) {
    if (compatPromises.has(src)) return compatPromises.get(src);
    const existing = document.querySelector('script[data-lr-firebase="' + src + '"]');
    if (existing?.dataset.loaded === 'true') return Promise.resolve();
    const promise = new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      if (!existing) { script.src = src; script.async = true; script.dataset.lrFirebase = src; }
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => { compatPromises.delete(src); reject(new Error('Firebase SDK 加载失败：' + src)); };
      if (!existing) document.head.appendChild(script);
    });
    compatPromises.set(src, promise);
    return promise;
  }
  function formatAuthDate(value) {
    if (!value) return '暂无记录';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '暂无记录';
    try { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); }
    catch { return date.toLocaleString(); }
  }
  function renderIdentity(user, message) {
    const statusNode = $('lrIdentityStatus'), uidNode = $('lrIdentityUid'), copy = $('lrIdentityCopy');
    const created = $('lrIdentityCreatedAt'), last = $('lrIdentityLastSeen');
    if (!statusNode && !uidNode && !copy) return;
    if (message) {
      if (statusNode) statusNode.textContent = message;
      if (uidNode) uidNode.textContent = '暂不可用';
      if (copy) copy.disabled = true;
      if (created) created.textContent = '—';
      if (last) last.textContent = '—';
      return;
    }
    if (!user) {
      if (statusNode) statusNode.textContent = '正在建立匿名身份…';
      if (uidNode) uidNode.textContent = '正在获取…';
      if (copy) copy.disabled = true;
      return;
    }
    currentUser = user;
    if (statusNode) statusNode.textContent = user.isAnonymous ? '已连接 · 匿名账户' : '已连接 · 已绑定账户';
    if (uidNode) uidNode.textContent = user.uid;
    if (copy) copy.disabled = !user.uid;
    if (created) created.textContent = formatAuthDate(user.metadata?.creationTime);
    if (last) last.textContent = formatAuthDate(user.metadata?.lastSignInTime);
  }
  async function initFirebase({ messaging = false } = {}) {
    if (!appConfigured()) throw new Error('请先在 firebase-config.js 填入 Firebase Web App 配置。');
    if (!firebaseCorePromise) {
      firebaseCorePromise = (async () => {
        const base = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';
        await loadCompat(base + 'firebase-app-compat.js');
        await loadCompat(base + 'firebase-auth-compat.js');
        await loadCompat(base + 'firebase-firestore-compat.js');
        if (!firebase.apps.length) firebase.initializeApp(cfg());
        const auth = firebase.auth();
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        let user = auth.currentUser;
        if (!user) {
          const credential = await auth.signInAnonymously();
          user = credential?.user || auth.currentUser;
        }
        if (!authObserverBound) {
          authObserverBound = true;
          auth.onAuthStateChanged((nextUser) => { currentUser = nextUser || null; renderIdentity(nextUser || null); });
        }
        currentUser = user || auth.currentUser || null;
        renderIdentity(currentUser);
        const db = firebase.firestore();
        if (currentUser?.uid) {
          try { await ensureUserDocument(currentUser, db); }
          catch (error) { console.warn('[LOVE RECORD] user index document is not writable yet; publish firestore.rules first', error); }
        }
        return { app: firebase.app(), auth, user: currentUser, db };
      })().catch((error) => { firebaseCorePromise = null; throw error; });
    }
    const core = await firebaseCorePromise;
    if (messaging) await loadCompat('https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-messaging-compat.js');
    return core;
  }
  async function bootstrapIdentity() {
    if (!appConfigured()) { renderIdentity(null, '等待 Firebase Web 配置'); return null; }
    renderIdentity(null);
    try { const { user } = await initFirebase(); return user; }
    catch (error) {
      console.error('[LOVE RECORD] anonymous identity initialization failed', error);
      renderIdentity(null, '连接失败：' + (error?.message || String(error)));
      return null;
    }
  }
  async function copyIdentity() {
    const uid = currentUser?.uid;
    if (!uid) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(uid);
      else {
        const field = document.createElement('textarea'); field.value = uid; field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field); field.select();
        const ok = document.execCommand('copy'); field.remove(); if (!ok) throw new Error('浏览器未允许复制');
      }
      if (typeof window.toast === 'function') window.toast('用户编号已复制');
      else { const node = $('lrIdentityStatus'); if (node) node.textContent = '用户编号已复制'; }
    } catch (error) {
      console.warn('[LOVE RECORD] copy UID failed', error);
      const node = $('lrIdentityStatus'); if (node) node.textContent = '复制失败，请长按 UID 手动复制';
    }
  }
  async function sha256Hex(value) {
    if (!crypto?.subtle) throw new Error('当前浏览器不支持安全摘要，无法生成设备登记编号。');
    const data = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function enablePush() {
    if (!pushConfigured()) { status(appConfigured() ? '请填写 Firebase Web Push VAPID 公钥。' : '请先填写 Firebase Web 配置。'); return; }
    if (!('serviceWorker' in navigator) || !('Notification' in window)) { status('当前浏览器不支持 Web Push。'); return; }
    if (!/^https:/.test(location.protocol) && location.hostname !== 'localhost') { status('Web Push 需要 HTTPS 网站环境。'); return; }
    const button = $('lrBackgroundEnable'); if (button) button.disabled = true;
    try {
      // Ask for permission immediately inside the user's click gesture, before network awaits.
      status('正在确认手机通知权限…');
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('通知权限未获准。请在 Android Chrome 的网站设置中允许通知。');
      status('通知权限已允许，正在连接 Firebase…');
      const { user, db } = await initFirebase({ messaging: true });
      if (!user?.uid) throw new Error('Firebase 匿名身份尚未建立。');
      status('正在建立云端用户索引…');
      await ensureUserDocument(user, db);
      let reg = await navigator.serviceWorker.getRegistration('./');
      if (!reg) reg = await navigator.serviceWorker.register('./sw.js?v=14', { scope: './', updateViaCache: 'none' });
      await reg.update().catch(() => {});
      await navigator.serviceWorker.ready;
      status('正在向浏览器申请 FCM 推送令牌…');
      const messaging = firebase.messaging();
      bindForegroundMessaging(messaging);
      if (typeof messaging.isSupported === 'function' && !(await messaging.isSupported())) {
        throw new Error('当前浏览器环境不支持 Firebase Web Push。请使用最新版 Android Chrome，并确认未处于无痕模式。');
      }
      const token = await messaging.getToken({ vapidKey: window.LR_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
      if (!token) throw new Error('浏览器没有返回 FCM Token。请确认 Chrome 通知权限及 VAPID 公钥。');
      const tokenHash = await sha256Hex(token);
      status('已取得推送令牌，正在直接登记到你的 Firebase 用户空间…');
      // Deactivate a previously stored token for this same browser if FCM rotated it.
      const previousHash = read().tokenHash;
      const deviceCollection = db.collection('users').doc(user.uid).collection('devices');
      if (previousHash && previousHash !== tokenHash) {
        await deviceCollection.doc(previousHash).set({ active: false, rotatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      }
      // Firestore per-UID rules authorize this device to write only its own token.
      await deviceCollection.doc(tokenHash).set({
        token, tokenHash, platform: 'web', userAgent: navigator.userAgent.slice(0, 180),
        active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      const old = read();
      write({ ...old, pushEnabled: true, tokenHash, registeredAt: Date.now() });
      status('本机推送登记成功。可以提交测试通知。');
      if (typeof window.toast === 'function') window.toast('本机推送登记成功 ♡');
    } catch (error) {
      console.error('[LOVE RECORD] push setup failed', error);
      const code = String(error?.code || '');
      if (code.includes('permission-denied')) status('Firebase 身份已连接，但 Firestore 拒绝写入。请先在 Firebase Console → Firestore Database → Rules 发布 ZIP 内 firestore.rules，然后再启用一次。');
      else if (code.includes('failed-precondition') && /index/i.test(error?.message || '')) status('推送登记失败：Firestore 缺少索引，请把错误截图发给我。');
      else status('启用失败：' + (error?.message || String(error)));
    } finally {
      if (button) button.disabled = false;
      render();
    }
  }
  function collectPreferences() {
    return {
      enabled: !!$('lrBackgroundActivityEnabled')?.checked,
      mode: $('lrBackgroundMode')?.value || 'interval',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kuala_Lumpur',
      intervalMinutes: Math.max(15, Math.min(720, Number($('lrBackgroundInterval')?.value) || 120)),
      messagesPerRun: String($('lrBackgroundMessagesPerRun')?.value || '2-3') === '1' ? '1' : '2-3',
      quietHours: { enabled: !!$('lrBackgroundQuietEnabled')?.checked, start: $('lrBackgroundQuietStart')?.value || '23:00', end: $('lrBackgroundQuietEnd')?.value || '08:00' }
    };
  }
  async function savePreferences() {
    const button = $('lrBackgroundSavePrefs'); if (button) button.disabled = true;
    const prefs = collectPreferences();
    const old = read(); write({ ...old, activityEnabled: prefs.enabled, mode: prefs.mode, intervalMinutes: prefs.intervalMinutes, messagesPerRun: prefs.messagesPerRun, quietHours: prefs.quietHours, preferencesSavedAt: Date.now() });
    try {
      const { user, db } = await initFirebase();
      await ensureUserDocument(user, db);
      await db.collection('users').doc(user.uid).collection('background').doc('settings').set({ ...prefs, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      aiStatus(prefs.enabled ? '后台总开关已同步 · 等待角色/记忆同步' : '后台自主活动已关闭');
      status('后台活动设置已保存到 Firebase。');
      return { local: true, cloud: true };
    } catch (error) {
      console.error('[LOVE RECORD] save background preferences failed', error);
      status('设置已保存在本机；云端同步失败：' + (error?.message || String(error)));
      return { local: true, cloud: false, reason: error?.message || String(error) };
    } finally { if (button) button.disabled = false; render(); }
  }
  async function setConversationControl(type, conversationId, enabled, intervalMinutes = null) {
    const kind = type === 'group' ? 'group' : type === 'single' ? 'single' : '';
    const id = String(conversationId || '').trim();
    if (!kind || !id || id.length > 180) throw new Error('聊天类型或聊天 ID 无效。');
    let controls = {};
    try { controls = JSON.parse(localStorage.getItem(CONTROL_KEY) || '{}') || {}; } catch { controls = {}; }
    const key = kind + ':' + id;
    const interval = intervalMinutes == null || intervalMinutes === '' ? null : Math.max(15, Math.min(720, Number(intervalMinutes) || 120));
    controls[key] = { type: kind, conversationId: id, enabled: !!enabled, intervalMinutes: interval, updatedAt: Date.now() };
    localStorage.setItem(CONTROL_KEY, JSON.stringify(controls));
    try {
      const { user, db } = await initFirebase();
      await ensureUserDocument(user, db);
      const controlId = await sha256Hex(kind + ':' + id);
      const stamp = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('users').doc(user.uid).collection('background').doc('settings').collection('conversations').doc(controlId).set({
        type: kind, conversationId: id, enabled: !!enabled, intervalMinutes: interval, updatedAt: stamp
      }, { merge: true });
      // Disabling a chat also disables its already-synced context immediately;
      // otherwise the cloud scheduler could continue generating after opt-out.
      const contextRef = db.collection('users').doc(user.uid).collection('background').doc('conversations').collection('items').doc(controlId);
      const contextSnap = await contextRef.get();
      if (contextSnap.exists) await contextRef.set({ enabled: !!enabled, updatedAt: stamp }, { merge: true });
      if (enabled) scheduleCloudContextSync();
      status('聊天后台开关已保存并同步到 Firebase。');
      return { local: true, cloud: true };
    } catch (error) {
      console.warn('[LOVE RECORD] background conversation control cloud sync pending', error);
      status('聊天后台开关已保存在本机；云端同步失败：' + (error?.message || String(error)));
      return { local: true, cloud: false, reason: error?.message || String(error) };
    }
  }
  function getEnabledControls() {
    try {
      const controls = JSON.parse(localStorage.getItem(CONTROL_KEY) || '{}') || {};
      return Object.values(controls).filter((x) => x && x.enabled === true && ['single', 'group'].includes(x.type) && x.conversationId);
    } catch { return []; }
  }
  function isConversationEnabled(type, conversationId) {
    const settings = read();
    if (!settings.activityEnabled) return false;
    return getEnabledControls().some((x) => x.type === (type === 'group' ? 'group' : 'single') && String(x.conversationId) === String(conversationId));
  }
  async function setGlobalActivityEnabled(enabled) {
    const old = read(); write({ ...old, activityEnabled: !!enabled });
    const input = $('lrBackgroundActivityEnabled'); if (input) input.checked = !!enabled;
    return savePreferences();
  }

  let foregroundMessagingBound = false;
  function bindForegroundMessaging(messagingInstance) {
    if (foregroundMessagingBound || !messagingInstance || typeof messagingInstance.onMessage !== 'function') return;
    foregroundMessagingBound = true;
    messagingInstance.onMessage(() => {
      syncIncomingMessages().catch((error) => console.warn('[LOVE RECORD] foreground push sync failed', error));
    });
  }
  async function refreshRegisteredPushToken() {
    const settings = read();
    if (!settings.pushEnabled || !pushConfigured() || !('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const { user, db } = await initFirebase({ messaging: true });
      if (!user?.uid) return false;
      await ensureUserDocument(user, db);
      const registration = await navigator.serviceWorker.ready;
      const messagingInstance = firebase.messaging();
      bindForegroundMessaging(messagingInstance);
      const token = await messagingInstance.getToken({ vapidKey: window.LR_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) return false;
      const tokenHash = await sha256Hex(token);
      const deviceCollection = db.collection('users').doc(user.uid).collection('devices');
      const previousHash = settings.tokenHash;
      if (previousHash && previousHash !== tokenHash) {
        await deviceCollection.doc(previousHash).set({ active: false, rotatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
      }
      await deviceCollection.doc(tokenHash).set({
        token, tokenHash, platform: 'web', userAgent: navigator.userAgent.slice(0, 180),
        active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      write({ ...read(), pushEnabled: true, tokenHash, registeredAt: Date.now() });
      return true;
    } catch (error) {
      console.warn('[LOVE RECORD] silent FCM token refresh skipped', error);
      return false;
    }
  }
  async function sendTestPush() {
    const button = $('lrBackgroundTestPush'); if (button) button.disabled = true;
    try {
      const { user, db } = await initFirebase();
      await ensureUserDocument(user, db);
      const devices = await db.collection('users').doc(user.uid).collection('devices').where('active', '==', true).limit(10).get();
      if (devices.empty) throw new Error('Firestore 中没有活动设备 Token。请先成功启用本机后台通知。');
      const requestId = 'test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      await db.collection('users').doc(user.uid).collection('background').doc('requests').collection('queue').doc(requestId).set({
        type: 'test-push', status: 'pending', createdAt: Date.now(), deviceCount: devices.size
      });
      status('测试通知已排入云端队列。GitHub Actions 约每 5 分钟巡检一次；实际发送可能延迟。');
    } catch (error) {
      console.error('[LOVE RECORD] test push enqueue failed', error);
      status('测试通知提交失败：' + (error?.message || String(error)));
    } finally { if (button) button.disabled = false; render(); }
  }
  async function syncCloudContext(options = {}) {
    const silent = options === true || options?.silent === true;
    const button = $('lrBackgroundSyncContext'); if (button && !silent) button.disabled = true;
    if (silent && automaticContextSyncBusy) return { skipped: true };
    if (silent) automaticContextSyncBusy = true;
    try {
      if (typeof window.__LOVE_RECORD_GET_BACKGROUND_CONTEXT !== 'function') throw new Error('聊天资料读取模块尚未就绪，请刷新 LOVE RECORD 后重试。');
      const { user, db } = await initFirebase();
      await ensureUserDocument(user, db);
      const snapshot = await window.__LOVE_RECORD_GET_BACKGROUND_CONTEXT();
      if (!snapshot?.apiConfig?.apiBase || !snapshot?.apiConfig?.apiKey || !snapshot?.apiConfig?.apiModel) {
        throw new Error('请先在 LOVE RECORD 的 AI/API 设置中连接一个可用模型。');
      }
      if (!Array.isArray(snapshot.conversations) || !snapshot.conversations.length) {
        throw new Error('没有找到已开启「允许后台保活」的单聊或群聊。请先到对应聊天设置开启。');
      }
      const priorConsent = read().cloudConsentGranted === true;
      const accepted = priorConsent || window.confirm(
        '开启 CHAR 云端后台活动前，需要明确授权：\n\n' +
        '• 同步已开启后台保活的聊天角色设定、世界书/长期记忆摘要及最近 20 条文字消息；\n' +
        '• 同步当前 AI API 地址、模型和 API Key，保存在你自己的 Firebase UID 私有数据路径；\n' +
        '• 不上传图片、语音、表情包附件或完整本地备份；\n' +
        '• GitHub Actions 后台任务会读取这些资料，向你配置的 AI 服务商请求角色消息。\n\n' +
        'Firebase 项目所有者及拥有后台服务凭证的人仍可能访问云端数据。API 服务商也会按其政策处理请求。是否继续？'
      );
      if (!accepted) { if (!silent) status('已取消云端同步；本机数据没有上传。'); return { cancelled: true }; }
      const root = db.collection('users').doc(user.uid);
      const now = Date.now();
      const api = snapshot.apiConfig;
      const prefs = collectPreferences();
      const localSettings = read();
      // Pause the cloud runner while replacing a previously synced snapshot.
      await root.collection('background').doc('settings').set({ ...prefs, enabled: false, syncingContext: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await root.collection('background').doc('private').collection('secrets').doc('apiConfig').set({
        apiBase: String(api.apiBase).replace(/\/+$/, '').slice(0, 500),
        apiKey: String(api.apiKey).slice(0, 4000),
        apiModel: String(api.apiModel).slice(0, 200),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      for (const conversation of snapshot.conversations) {
        const kind = conversation.type === 'group' ? 'group' : 'single';
        const id = String(conversation.conversationId || '').trim();
        if (!id) continue;
        const refId = await sha256Hex(kind + ':' + id);
        const clean = {
          type: kind, conversationId: id, enabled: true,
          intervalMinutes: conversation.intervalMinutes == null ? null : Math.max(15, Math.min(720, Number(conversation.intervalMinutes) || 120)),
          name: String(conversation.name || '').slice(0, 120),
          person: conversation.person || null,
          members: Array.isArray(conversation.members) ? conversation.members.slice(0, 12) : [],
          userPersona: conversation.userPersona || null,
          worldContext: String(conversation.worldContext || '').slice(0, 12000),
          longMemory: String(conversation.longMemory || '').slice(0, 10000),
          announcement: String(conversation.announcement || '').slice(0, 2000),
          recentMessages: (Array.isArray(conversation.recentMessages) ? conversation.recentMessages : []).slice(-20).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            name: String(m.name || '').slice(0, 80), text: String(m.text || '').slice(0, 1800), at: Number(m.at) || now
          })).filter((m) => m.text),
          syncedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await root.collection('background').doc('conversations').collection('items').doc(refId).set(clean, { merge: true });
        await root.collection('background').doc('settings').collection('conversations').doc(refId).set({
          type: kind, conversationId: id, enabled: true, intervalMinutes: clean.intervalMinutes, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      await root.collection('background').doc('settings').set({ ...prefs, enabled: !!localSettings.activityEnabled, syncingContext: false, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      // Publish the consent flag only after settings, API config and all conversation snapshots are saved.
      await root.collection('background').doc('cloudProfile').set({
        consentToBackgroundAI: true, userName: String(snapshot.userName || '用户').slice(0, 80),
        syncedAt: firebase.firestore.FieldValue.serverTimestamp(), schemaVersion: 2
      }, { merge: true });
      const old = read(); write({ ...old, cloudConsentGranted: true, cloudContextSyncedAt: now, cloudConversationCount: snapshot.conversations.length });
      aiStatus('已同步 ' + snapshot.conversations.length + ' 个聊天 · 等待云端定时任务');
      if (!silent) status('角色资料、近期记忆及 API 配置已同步到当前 UID 的 Firebase 私有空间。');
      return { ok: true, conversationCount: snapshot.conversations.length };
    } catch (error) {
      console.error('[LOVE RECORD] cloud context sync failed', error);
      if (!silent) status('云端同步失败：' + (error?.message || String(error)));
      return { ok: false, error: error?.message || String(error) };
    } finally {
      if (button && !silent) button.disabled = false;
      if (silent) automaticContextSyncBusy = false;
      render();
    }
  }
  function scheduleCloudContextSync() {
    if (read().cloudConsentGranted !== true || !navigator.onLine) return;
    clearTimeout(contextSyncTimer);
    contextSyncTimer = setTimeout(() => syncCloudContext({ silent: true }).catch((error) => console.warn('[LOVE RECORD] automatic context sync failed', error)), 5000);
  }
  async function syncIncomingMessages() {
    if (!appConfigured() || !currentUser?.uid || !navigator.onLine) return 0;
    try {
      const { db, user } = await initFirebase();
      const root = db.collection('users').doc(user.uid).collection('background').doc('messages').collection('items');
      const snap = await root.where('status', '==', 'pending').limit(20).get();
      if (snap.empty) return 0;
      let imported = 0;
      for (const doc of snap.docs) {
        const message = doc.data() || {};
        try {
          if (message.type === 'group') {
            if (!window.LRGroupChatActions?.appendMessage) continue;
            await window.LRGroupChatActions.appendMessage({
              senderType: 'character', senderId: String(message.senderId || ''),
              senderNameSnapshot: String(message.senderName || '角色'), text: String(message.text || '')
            }, String(message.conversationId || ''));
          } else {
            const id = String(message.conversationId || '');
            if (!id || !String(message.text || '').trim()) continue;
            if (typeof window.readChatThreads !== 'function' || typeof window.writeChatThreads !== 'function') throw new Error('聊天记录模块尚未就绪，消息已保留在云端，稍后会重试导入。');
            const all = window.readChatThreads();
            const thread = Array.isArray(all[id]) ? all[id].slice() : [];
            if (!thread.some((m) => m.backgroundMessageId === doc.id)) {
              thread.push({ role: 'assistant', text: String(message.text).slice(0, 4000), at: Number(message.createdAt) || Date.now(), backgroundMessageId: doc.id });
              all[id] = thread;
              if (typeof window.writeChatThreads === 'function') await window.writeChatThreads(all);
            }
          }
          window.LRMessageUX?.recordIncoming?.(message.type === 'group' ? 'group' : 'single', String(message.conversationId || ''), doc.id, { title: String(message.type === 'group' ? (message.senderName ? message.senderName + ' · 群聊' : '群聊') : (message.senderName || '角色')), preview: String(message.text || '有新的消息') });
          await doc.ref.update({ status: 'imported', importedAt: firebase.firestore.FieldValue.serverTimestamp() });
          imported++;
        } catch (error) { console.warn('[LOVE RECORD] unable to import a cloud CHAR message', error); }
      }
      if (imported && typeof window.renderChat === 'function') window.renderChat();
      return imported;
    } catch (error) {
      console.warn('[LOVE RECORD] cloud message sync skipped', error);
      return 0;
    }
  }
  function escapeCheckHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
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
        if (user?.uid) {
          add('Firebase 匿名身份', '已登录 · UID ' + user.uid.slice(0, 8) + '…', 'ok');
          try {
            const rootDoc = await dbFor().collection('users').doc(user.uid).get();
            add('Firestore 用户空间', rootDoc.exists ? '已建立用户索引' : '用户索引尚未建立；需检查 Firestore Rules', rootDoc.exists ? 'ok' : 'warn');
          } catch (error) { add('Firestore 用户空间', '访问失败：' + (error?.message || error), 'warn'); }
        } else add('Firebase 匿名身份', '未能确认登录', 'warn');
      }
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('./').catch(() => null);
        const worker = registration && (registration.active || registration.waiting || registration.installing);
        add('Service Worker', worker ? '已找到注册记录 · ' + worker.state : '尚未找到注册记录', worker?.state === 'activated' ? 'ok' : 'warn');
      } else add('Service Worker', '当前浏览器不支持', 'warn');
      const permission = 'Notification' in window ? Notification.permission : 'unsupported';
      add('通知权限', permission === 'granted' ? '已允许' : permission === 'denied' ? '已拒绝' : '尚未允许/不支持', permission === 'granted' ? 'ok' : 'warn');
      add('Web Push VAPID 公钥', window.LR_FIREBASE_VAPID_KEY ? '已配置' : '尚未配置', window.LR_FIREBASE_VAPID_KEY ? 'ok' : 'warn');
      const settings = read();
      let registered = false;
      if (settings.tokenHash && currentUser?.uid && appConfigured()) {
        try {
          const doc = await dbFor().collection('users').doc(currentUser.uid).collection('devices').doc(settings.tokenHash).get();
          registered = doc.exists && doc.data()?.active === true;
        } catch (error) { add('Firestore 设备登记', '读取失败：' + (error?.message || error), 'warn'); }
      }
      add('本机推送登记', registered ? '已在 Firestore 找到本机活动 Token' : '尚未在 Firestore 确认登记', registered ? 'ok' : 'warn');
      add('后台活动总开关', settings.activityEnabled ? '已开启（本机设置）' : '未开启（本机设置）', settings.activityEnabled ? 'ok' : 'info');
      add('CHAR 云端同步', settings.cloudContextSyncedAt ? '本机记录已完成同步；仍需云端工作流运行' : '尚未同步角色/记忆/API 配置', settings.cloudContextSyncedAt ? 'ok' : 'warn');
      add('云端定时任务', 'GitHub Actions 约每 5 分钟巡检一次；实际可能延迟，角色生成仍遵循聊天间隔', 'info');
      const passed = checks.filter((x) => x.level === 'ok').length;
      const pending = checks.filter((x) => x.level === 'warn').length;
      if (summary) summary.textContent = '检测完成 · ' + passed + ' 项通过 · ' + pending + ' 项待处理';
      if (details) details.innerHTML = checks.map((x) => '<div class="check-row"><span>' + escapeCheckHtml(x.name) + '</span><strong>' + escapeCheckHtml(x.value) + '</strong></div>').join('');
    } catch (error) {
      console.error('[LOVE RECORD] background runtime check failed', error);
      if (summary) summary.textContent = '检测未完成';
      if (details) details.textContent = '检测过程中发生错误：' + (error?.message || String(error));
    } finally { if (button) button.disabled = false; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('lrIdentityCopy')?.addEventListener('click', copyIdentity);
    if ($('lrBackgroundCard')) {
      $('lrBackgroundEnable')?.addEventListener('click', enablePush);
      $('lrBackgroundSavePrefs')?.addEventListener('click', savePreferences);
      $('lrBackgroundTestPush')?.addEventListener('click', sendTestPush);
      $('lrBackgroundSyncContext')?.addEventListener('click', syncCloudContext);
      $('lrBackgroundRunCheck')?.addEventListener('click', testBackgroundRuntime);
      render();
    }
    bootstrapIdentity().then(async () => {
      await refreshRegisteredPushToken();
      await syncIncomingMessages();
      if (read().cloudConsentGranted === true) scheduleCloudContextSync();
    });
  });
  window.addEventListener('lr-chat-threads-updated', scheduleCloudContextSync);
  window.addEventListener('lr-group-chat-updated', scheduleCloudContextSync);
  window.addEventListener('lr-self-personas-updated', scheduleCloudContextSync);
  window.addEventListener('lr-people-updated', scheduleCloudContextSync);
  window.addEventListener('lr-contacts-updated', scheduleCloudContextSync);
  window.addEventListener('lr-worldbooks-updated', scheduleCloudContextSync);
  window.addEventListener('lr-chat-meta-updated', scheduleCloudContextSync);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncIncomingMessages();
      if (read().cloudConsentGranted === true) scheduleCloudContextSync();
    }
  });
  window.addEventListener('online', () => { syncIncomingMessages(); scheduleCloudContextSync(); });
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      syncIncomingMessages();
      if (read().cloudConsentGranted === true) scheduleCloudContextSync();
    }
  }, 5 * 60 * 1000);
  window.LRBackground = {
    render, enablePush, refreshRegisteredPushToken, savePreferences, sendTestPush, syncCloudContext, syncIncomingMessages,
    testBackgroundRuntime, setConversationControl, getEnabledControls, isConversationEnabled,
    setGlobalActivityEnabled, isConfigured: appConfigured, isPushConfigured: pushConfigured,
    ensureIdentity: bootstrapIdentity, getCurrentUser: () => currentUser
  };
})();
