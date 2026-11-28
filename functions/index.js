const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 5 });
const db = getFirestore();

exports.registerPushDevice = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '请先完成 Firebase 登录。');
  const token = String(request.data?.token || '').trim();
  if (!token || token.length > 4096) throw new HttpsError('invalid-argument', 'FCM token 无效。');
  const id = require('crypto').createHash('sha256').update(token).digest('hex');
  await db.doc(`users/${request.auth.uid}/devices/${id}`).set({
    token, platform: 'web', userAgent: String(request.data?.userAgent || '').slice(0,180),
    active: true, updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.saveBackgroundPreferences = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '请先完成 Firebase 登录。');
  const d = request.data || {};
  const allowed = {
    enabled: !!d.enabled,
    mode: ['hybrid','scheduled','interval'].includes(d.mode) ? d.mode : 'hybrid',
    timezone: String(d.timezone || 'Asia/Kuala_Lumpur').slice(0,64),
    intervalMinutes: Math.min(720, Math.max(30, Number(d.intervalMinutes) || 120)),
    quietHours: d.quietHours && typeof d.quietHours === 'object' ? {
      enabled: !!d.quietHours.enabled,
      start: String(d.quietHours.start || '23:00').slice(0,5),
      end: String(d.quietHours.end || '08:00').slice(0,5)
    } : { enabled: true, start: '23:00', end: '08:00' }
  };
  await db.doc(`users/${request.auth.uid}/background/settings`).set({ ...allowed, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, preferences: allowed };
});

/* Hybrid activity runner foundation.
 * It deliberately does not invent/generate character dialogue until the app has
 * synced an explicit cloud character profile + conversation context for this UID.
 * Next implementation step: populate users/{uid}/cloudProfile and queuedEvents.
 */
exports.characterActivityScheduler = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Asia/Kuala_Lumpur' }, async () => {
  const users = await db.collection('users').get();
  for (const user of users.docs) {
    const pref = await user.ref.collection('background').doc('settings').get();
    if (!pref.exists || !pref.data().enabled) continue;
    const profile = await user.ref.collection('background').doc('cloudProfile').get();
    if (!profile.exists || !profile.data().consentToBackgroundAI) continue;
    // Intentionally staged: the next release will generate messages from the
    // synced profile/context, persist them, then send FCM. No browser local data
    // is accessible from Cloud Functions, so do not guess missing context.
    await user.ref.collection('background').doc('schedulerState').set({
      lastCheckedAt: FieldValue.serverTimestamp(), status: 'awaiting-character-context-v1'
    }, { merge: true });
  }
});

// Send a data-only test push to this authenticated user's registered devices.
// The Service Worker renders one notification; no chat content is included.
exports.sendBackgroundTestNotification = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '请先完成 Firebase 登录。');
  const snap = await db.collection(`users/${request.auth.uid}/devices`).where('active', '==', true).get();
  if (snap.empty) throw new HttpsError('failed-precondition', '尚未登记本机推送令牌，请先启用后台通知。');
  const data = {
    title: 'LOVE RECORD',
    body: '后台通知测试成功。你可以在手机通知栏看到这条消息。',
    url: './index.html',
    conversationId: '',
    tag: 'lr-background-test'
  };
  let successCount = 0;
  let failureCount = 0;
  const remove = [];
  await Promise.all(snap.docs.map(async (doc) => {
    const token = String(doc.data().token || '');
    if (!token) { failureCount++; remove.push(doc.ref); return; }
    try {
      await getMessaging().send({ token, data });
      successCount++;
    } catch (error) {
      failureCount++;
      if (['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error?.code)) remove.push(doc.ref);
      console.warn('[LOVE RECORD] test push failed for a device:', error?.code || error?.message);
    }
  }));
  if (remove.length) await Promise.all(remove.map((ref) => ref.delete()));
  return { ok: successCount > 0, successCount, failureCount };
});

