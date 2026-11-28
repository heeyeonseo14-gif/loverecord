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
