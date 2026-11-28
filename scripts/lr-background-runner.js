'use strict';

/*
 * LOVE RECORD cloud background runner.
 * Runs from GitHub Actions (public-repository standard runners are free).
 * Firebase Admin credentials must be provided as the encrypted
 * FIREBASE_SERVICE_ACCOUNT_JSON repository secret. Never commit credentials.
 */
const admin = require('../functions/node_modules/firebase-admin');

const PROJECT_ID = 'love-record-0928';
const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!SERVICE_ACCOUNT_RAW) {
  console.error('Missing repository secret: FIREBASE_SERVICE_ACCOUNT_JSON');
  process.exit(1);
}
let serviceAccount;
try { serviceAccount = JSON.parse(SERVICE_ACCOUNT_RAW); }
catch { console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.'); process.exit(1); }

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID });
const db = admin.firestore();
const messaging = admin.messaging();
const FieldValue = admin.firestore.FieldValue;

function text(value, max = 12000) { return String(value ?? '').slice(0, max); }
function minuteOfDay(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
function inQuietHours(settings, now = new Date()) {
  const quiet = settings?.quietHours;
  if (!quiet || quiet.enabled !== true) return false;
  const tz = text(settings.timezone || 'Asia/Kuala_Lumpur', 80);
  let parts;
  try { parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now); }
  catch { parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now); }
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  const current = get('hour') * 60 + get('minute');
  const start = minuteOfDay(quiet.start || '23:00'), end = minuteOfDay(quiet.end || '08:00');
  if (start === null || end === null || start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}
function recentTranscript(conversation) {
  return (Array.isArray(conversation.recentMessages) ? conversation.recentMessages : []).slice(-20)
    .map((m) => `[${m.role === 'user' ? '用户' : (m.name || '角色')}] ${text(m.text, 1800)}`)
    .filter(Boolean).join('\n').slice(-18000);
}
function makePrompt(userName, conversation, settings) {
  const time = new Date().toLocaleString('zh-CN', { timeZone: settings.timezone || 'Asia/Kuala_Lumpur', hour12: false });
  const transcript = recentTranscript(conversation) || '目前没有近期聊天记录。请以温和自然的方式开启一段简短对话。';
  const baseRules = [
    '你是 LOVE RECORD 中持续存在的角色，不是客服或任务机器人。',
    '你的表达要符合人物设定、最近的真实聊天和长期记忆，不要编造用户已经做过的事。',
    `用户称呼：${text(userName, 80)}。当前时间：${time}。`,
    `世界书/共同世界：${text(conversation.worldContext, 12000) || '无'}`,
    `长期记忆：${text(conversation.longMemory, 10000) || '无'}`,
    `最近对话：\n${transcript}`,
    '主动消息应简短自然，像真实聊天中主动想到对方时发出的一条消息。不要提及后台任务、定时器、API、云端或系统。不要替用户决定行动、想法、台词和情绪。只输出角色准备发送的消息正文。'
  ];
  if (conversation.type === 'group') {
    const members = (Array.isArray(conversation.members) ? conversation.members : []).slice(0, 12);
    const list = members.map((m) => `ID=${text(m.id, 180)}；名字=${text(m.name, 80)}；身份=${text(m.role, 180)}；性格=${text(m.personality, 1000)}；外貌=${text(m.appearance, 800)}；说话方式=${text(m.speech, 800)}；背景=${text(m.background, 1000)}；长期记忆=${text(m.longMemory, 5000)}；规则=${text(m.instructions, 1000)}`).join('\n');
    const self = conversation.userPersona || {};
    const system = baseRules.join('\n') + `\n用户自设：${text(self.name, 100)}；${text(self.role, 500)}；${text(self.personality, 1000)}；${text(self.background, 1000)}。不要替用户说话。\n这是一个多人群聊。请从下面有效成员中选择一位最适合自然发言的角色。只返回 JSON：{"senderId":"成员ID","text":"消息正文"}。senderId 必须严格来自成员列表。\n成员列表：\n${list}`;
    return { system, user: `群聊名称：${text(conversation.name, 120)}\n群公告：${text(conversation.announcement, 2000) || '无'}\n请根据上下文自然发出一条主动群消息。` };
  }
  const p = conversation.person || {};
  const self = conversation.userPersona || {};
  const system = baseRules.join('\n') + `\n你正在扮演：${text(p.name, 100)}。身份：${text(p.role, 500)}。性格：${text(p.personality, 2500)}。外貌：${text(p.appearance, 1200)}。说话方式：${text(p.speech, 1200)}。背景：${text(p.background, 1800)}。人物规则：${text(p.instructions, 1800)}。\n用户自设：${text(self.name, 100)}；${text(self.role, 500)}；${text(self.personality, 1000)}。不要代替用户说话。`;
  return { system, user: '现在请你自然地主动给用户发一条消息。只输出消息正文，不要加角色名、引号或解释。' };
}
async function callAi(api, prompt) {
  const base = text(api.apiBase, 500).replace(/\/+$/, '');
  const key = text(api.apiKey, 4000);
  const model = text(api.apiModel, 200);
  if (!/^https:\/\//i.test(base) || !key || !model) throw new Error('Cloud AI configuration is incomplete or API base is not HTTPS.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(base + '/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'Accept': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], stream: false })
    });
    if (!response.ok) throw new Error('AI provider HTTP ' + response.status);
    const data = await response.json();
    let answer = data?.choices?.[0]?.message?.content;
    if (Array.isArray(answer)) answer = answer.map((x) => x?.text || '').join('');
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('AI provider returned an empty message.');
    return answer.trim().slice(0, 4000);
  } finally { clearTimeout(timer); }
}
function parseGroupAnswer(raw, members) {
  const value = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(value); } catch {
    const start = value.indexOf('{'), end = value.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Group character answer was not valid JSON.');
    parsed = JSON.parse(value.slice(start, end + 1));
  }
  const member = members.find((x) => String(x.id) === String(parsed.senderId));
  const message = text(parsed.text, 4000).trim();
  if (!member || !message) throw new Error('Group message did not match an active character.');
  return { senderId: String(member.id), senderName: text(member.name || '角色', 80), text: message };
}
async function sendToUserDevices(uid, payload) {
  const snap = await db.collection(`users/${uid}/devices`).where('active', '==', true).limit(30).get();
  let successes = 0;
  for (const doc of snap.docs) {
    const token = text(doc.data()?.token, 4096);
    if (!token) continue;
    try {
      await messaging.send({ token, data: Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, String(v ?? '')])) });
      successes++;
    } catch (error) {
      if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(error?.code)) {
        await doc.ref.set({ active: false, invalidAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        console.warn('FCM delivery failed:', error?.code || 'unknown-error');
      }
    }
  }
  return successes;
}
async function processTestRequests(uid) {
  const queue = db.collection(`users/${uid}/background/requests/queue`);
  const snap = await queue.where('status', '==', 'pending').limit(5).get();
  for (const doc of snap.docs) {
    const req = doc.data() || {};
    if (req.type !== 'test-push') continue;
    try {
      const count = await sendToUserDevices(uid, {
        title: 'LOVE RECORD', body: '后台通知测试成功。你可以在手机通知栏看到这条消息。',
        url: './index.html', conversationId: '', conversationType: 'single', tag: 'lr-background-test', messageId: ''
      });
      await doc.ref.set({ status: count ? 'sent' : 'no-active-device', sentDeviceCount: count, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
      await doc.ref.set({ status: 'failed', error: text(error?.message || 'send failed', 240), completedAt: FieldValue.serverTimestamp() }, { merge: true });
      console.warn('Test push request failed:', text(error?.message || error, 180));
    }
  }
}
async function claimConversation(ref, intervalMinutes) {
  const now = Date.now();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const last = Number(data.lastGeneratedAt) || 0;
    const lock = Number(data.lockUntil) || 0;
    if (lock > now || (last && now - last < intervalMinutes * 60000)) return false;
    tx.set(ref, { lockUntil: now + 7 * 60000, lastAttemptAt: now }, { merge: true });
    return true;
  });
}
async function runConversation(uid, userName, settings, controlDoc, api) {
  const control = controlDoc.data() || {};
  const kind = control.type === 'group' ? 'group' : 'single';
  const id = text(control.conversationId, 180);
  if (!id || control.enabled !== true) return;
  const contextRef = db.doc(`users/${uid}/background/conversations/items/${controlDoc.id}`);
  const contextSnap = await contextRef.get();
  if (!contextSnap.exists) return;
  const context = contextSnap.data() || {};
  if (context.enabled !== true || context.conversationId !== id || context.type !== kind) return;
  const perConversationInterval = Number(control.intervalMinutes);
  const globalDefaultInterval = Number(settings.intervalMinutes) || 120;
  const selectedInterval = Number.isFinite(perConversationInterval) && perConversationInterval > 0 ? perConversationInterval : globalDefaultInterval;
  const interval = Math.max(15, Math.min(720, Math.round(selectedInterval)));
  if (!await claimConversation(contextRef, interval)) return;
  try {
    const prompt = makePrompt(userName, context, settings);
    const raw = await callAi(api, prompt);
    let senderId = '', senderName = text(context.person?.name || '角色', 80), messageText = raw;
    if (kind === 'group') {
      const chosen = parseGroupAnswer(raw, Array.isArray(context.members) ? context.members : []);
      senderId = chosen.senderId; senderName = chosen.senderName; messageText = chosen.text;
    }
    const messageRef = db.collection(`users/${uid}/background/messages/items`).doc();
    const createdAt = Date.now();
    const message = {
      type: kind, conversationId: id, senderId, senderName, text: messageText,
      createdAt, status: 'pending', source: 'github-actions-char'
    };
    await messageRef.set(message);
    const deviceCount = await sendToUserDevices(uid, {
      title: kind === 'group' ? (text(context.name || '群聊', 80) + ' · ' + senderName) : senderName,
      body: messageText.slice(0, 160), url: './index.html', conversationId: id,
      conversationType: kind, tag: 'lr-char-' + kind + '-' + id.slice(0, 48), messageId: messageRef.id
    });
    const previous = Array.isArray(context.recentMessages) ? context.recentMessages.slice(-19) : [];
    previous.push({ role: 'assistant', name: senderName, text: messageText.slice(0, 1800), at: createdAt });
    await contextRef.set({ recentMessages: previous, lastGeneratedAt: createdAt, lastMessageId: messageRef.id, lockUntil: 0, lastRunStatus: 'sent', lastDeviceCount: deviceCount, lastError: FieldValue.delete() }, { merge: true });
    console.log(`CHAR message generated for UID ${uid.slice(0, 8)} / ${kind} conversation; devices=${deviceCount}`);
  } catch (error) {
    await contextRef.set({ lockUntil: 0, lastRunStatus: 'error', lastError: text(error?.message || 'generation failed', 240), lastAttemptAt: Date.now() }, { merge: true });
    console.warn(`CHAR generation failed for UID ${uid.slice(0, 8)} / ${kind}:`, text(error?.message || error, 180));
  }
}
async function run() {
  const userSnap = await db.collection('users').get();
  console.log('Background runner: users=', userSnap.size);
  for (const userDoc of userSnap.docs) {
    const uid = userDoc.id;
    try {
      await processTestRequests(uid);
      const root = userDoc.ref.collection('background');
      const [settingsSnap, profileSnap, apiSnap] = await Promise.all([
        root.doc('settings').get(), root.doc('cloudProfile').get(), root.doc('private').collection('secrets').doc('apiConfig').get()
      ]);
      if (!settingsSnap.exists || settingsSnap.data()?.enabled !== true) continue;
      const profile = profileSnap.data() || {};
      if (profile.consentToBackgroundAI !== true) continue;
      if (!apiSnap.exists) continue;
      const settings = settingsSnap.data() || {};
      if (inQuietHours(settings)) continue;
      const api = apiSnap.data() || {};
      const controls = await root.doc('settings').collection('conversations').where('enabled', '==', true).limit(30).get();
      for (const controlDoc of controls.docs) await runConversation(uid, text(profile.userName || '用户', 80), settings, controlDoc, api);
    } catch (error) {
      console.warn(`Background processing failed for UID ${uid.slice(0, 8)}:`, text(error?.message || error, 200));
    }
  }
}
run().then(() => { console.log('Background runner completed.'); process.exit(0); }).catch((error) => { console.error('Background runner fatal error:', text(error?.message || error, 300)); process.exit(1); });
