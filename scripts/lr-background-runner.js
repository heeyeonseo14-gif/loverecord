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
function safeUserName(value, fallback = '用户') {
  const name = text(value, 80).trim();
  const oldAccountDefaults = ['\u0059\u0041\u004e\u0059\u0041\u004e', '\u598d\u598d'];
  return !name || oldAccountDefaults.includes(name.toUpperCase()) ? fallback : name;
}
function makePrompt(userName, conversation, settings) {
  const time = new Date().toLocaleString('zh-CN', { timeZone: settings.timezone || 'Asia/Kuala_Lumpur', hour12: false });
  const transcript = recentTranscript(conversation) || '目前没有近期聊天记录。请以温和自然的方式开启一段简短对话。';
  const selfProfile = conversation.userPersona || {};
  const groupProfile = conversation.userProfile || {};
  const explicitProfileName = text(groupProfile.nickname, 80).trim() || text(selfProfile.nickname, 80).trim() || text(selfProfile.name, 80).trim();
  const actualUserName = explicitProfileName || safeUserName(userName, '用户');
  const oneOnly = String(settings.messagesPerRun || '2-3') === '1';
  const countRule = oneOnly ? '本轮只生成 1 条消息。' : '本轮自然生成 2–3 条彼此衔接的独立聊天消息；每条都应像单独发送的气泡，不要把多条合并成一大段。不要为了凑数灌水；上下文不足时可以只发 1 条。';
  const baseRules = [
    '你是 LOVE RECORD 中持续存在的角色，不是客服或任务机器人。',
    '你的表达要符合人物设定、最近的真实聊天和长期记忆，不要编造用户已经做过的事。',
    `用户称呼：${actualUserName}。只有使用用户资料里的昵称或自设名称时才可直接称呼用户；不得猜测、套用其他用户的姓名，也不要替用户发言。当前时间：${time}。`,
    `世界书/共同世界：${text(conversation.worldContext, 12000) || '无'}`,
    `长期记忆：${text(conversation.longMemory, 10000) || '无'}`,
    `最近对话：\n${transcript}`,
    '主动消息应简短自然，像真实聊天中主动想到对方时发出的一组连续消息。不要提及后台任务、定时器、API、云端或系统。不要替用户决定行动、想法、台词和情绪。',
    countRule
  ];
  if (conversation.type === 'group') {
    const members = (Array.isArray(conversation.members) ? conversation.members : []).slice(0, 12);
    const list = members.map((m) => `ID=${text(m.id, 180)}；名字=${text(m.name, 80)}；身份=${text(m.role, 180)}；性格=${text(m.personality, 1000)}；外貌=${text(m.appearance, 800)}；说话方式=${text(m.speech, 800)}；背景=${text(m.background, 1000)}；长期记忆=${text(m.longMemory, 5000)}；规则=${text(m.instructions, 1000)}`).join('\n');
    const self = conversation.userPersona || {};
    const profile = conversation.userProfile || {};
    const system = baseRules.join('\n') + `\n用户群聊资料：群昵称=${actualUserName}；群头像=${profile.avatar ? '已设置' : '未设置'}。用户自设：${text(self.name, 100)}；用户昵称=${text(self.nickname, 80)}；${text(self.role, 500)}；${text(self.personality, 1000)}；${text(self.appearance, 800)}；${text(self.speech, 800)}；${text(self.background, 1000)}。如需自然称呼用户，只使用群昵称“${actualUserName}”；如果需要 @ 用户，正文中写作 @${actualUserName}；绝不替用户说话。\n这是一个多人群聊。可以由同一位或不同成员连续发言；每条消息的 senderId 必须严格来自成员列表。只返回 JSON：{"messages":[{"senderId":"成员ID","text":"消息正文"}]}。messages 数组最多 3 项。\n成员列表：\n${list}`;
    return { system, user: `群聊名称：${text(conversation.name, 120)}\n群公告：${text(conversation.announcement, 2000) || '无'}\n请根据上下文自然延续群聊，${oneOnly ? '返回 1 条' : '返回 2–3 条'}有衔接的独立消息。` };
  }
  const p = conversation.person || {};
  const self = conversation.userPersona || {};
  const system = baseRules.join('\n') + `\n你正在扮演：${text(p.name, 100)}。身份：${text(p.role, 500)}。性格：${text(p.personality, 2500)}。外貌：${text(p.appearance, 1200)}。说话方式：${text(p.speech, 1200)}。背景：${text(p.background, 1800)}。人物规则：${text(p.instructions, 1800)}。\n用户自设：${text(self.name, 100)}；用户昵称=${text(self.nickname, 80) || actualUserName}；${text(self.role, 500)}；${text(self.personality, 1000)}；${text(self.appearance, 800)}；${text(self.speech, 800)}；${text(self.background, 1000)}。如需称呼用户，只使用“${actualUserName}”，如需 @ 用户则写作 @${actualUserName}，不要猜测或使用其他姓名；不要代替用户说话。`;
  return { system, user: '现在请你自然地主动给用户发一组连续消息。只返回 JSON：{"messages":["第一条消息","第二条消息"]}，最多 3 条。每条分别是一条聊天气泡，不要加角色名、引号或解释。' };
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
function parseJsonReply(raw) {
  const value = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(value); } catch {
    const start = value.indexOf('{'), end = value.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(value.slice(start, end + 1));
    const a = value.indexOf('['), b = value.lastIndexOf(']');
    if (a >= 0 && b > a) return JSON.parse(value.slice(a, b + 1));
    throw new Error('CHAR batch response was not valid JSON.');
  }
}
function parseSingleBatch(raw, max = 3) {
  let parsed;
  try { parsed = parseJsonReply(raw); }
  catch {
    const fallback = text(raw, 4000).trim();
    if (!fallback) throw new Error('AI returned an empty single-chat response.');
    return [{ senderId: '', senderName: '', text: fallback }];
  }
  const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.messages) ? parsed.messages : (parsed?.text ? [parsed.text] : []);
  const messages = source.map((item) => text(typeof item === 'string' ? item : item?.text, 4000).trim()).filter(Boolean).slice(0, max);
  if (!messages.length) throw new Error('AI returned no usable single-chat messages.');
  return messages.map((message) => ({ senderId: '', senderName: '', text: message }));
}
function parseGroupBatch(raw, members, max = 3) {
  let parsed;
  try { parsed = parseJsonReply(raw); }
  catch {
    const fallback = text(raw, 4000).trim();
    const firstMember = Array.isArray(members) ? members[0] : null;
    if (!fallback || !firstMember?.id) throw new Error('Group batch response was not valid JSON and no fallback member is available.');
    return [{ senderId: String(firstMember.id), senderName: text(firstMember.name || '角色', 80), text: fallback }];
  }
  const source = Array.isArray(parsed?.messages) ? parsed.messages : (parsed?.senderId && parsed?.text ? [parsed] : []);
  const messages = source.slice(0, max).map((item) => {
    const member = members.find((x) => String(x.id) === String(item?.senderId));
    const message = text(item?.text, 4000).trim();
    if (!member || !message) return null;
    return { senderId: String(member.id), senderName: text(member.name || '角色', 80), text: message };
  }).filter(Boolean);
  if (!messages.length) throw new Error('Group batch did not match an active character.');
  return messages;
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
    if (!snap.exists) return { claimed: false, reason: 'missing-context' };
    const data = snap.data() || {};
    const last = Number(data.lastGeneratedAt) || 0;
    const lock = Number(data.lockUntil) || 0;
    if (lock > now) return { claimed: false, reason: 'locked' };
    if (last && now - last < intervalMinutes * 60000) return { claimed: false, reason: 'interval-not-due' };
    tx.set(ref, { lockUntil: now + 7 * 60000, lastAttemptAt: now }, { merge: true });
    return { claimed: true, reason: 'claimed' };
  });
}
async function runConversation(uid, userName, settings, controlDoc, api) {
  const control = controlDoc.data() || {};
  const kind = control.type === 'group' ? 'group' : 'single';
  const id = text(control.conversationId, 180);
  if (!id || control.enabled !== true) return;
  const contextRef = db.doc(`users/${uid}/background/conversations/items/${controlDoc.id}`);
  const contextSnap = await contextRef.get();
  if (!contextSnap.exists) { console.log(`Skip ${kind} ${id.slice(0, 24)}: cloud context missing.`); return; }
  const context = contextSnap.data() || {};
  if (context.enabled !== true || context.conversationId !== id || context.type !== kind) { console.log(`Skip ${kind} ${id.slice(0, 24)}: context disabled or mismatched.`); return; }
  const perConversationInterval = Number(control.intervalMinutes);
  const globalDefaultInterval = Number(settings.intervalMinutes) || 120;
  const selectedInterval = Number.isFinite(perConversationInterval) && perConversationInterval > 0 ? perConversationInterval : globalDefaultInterval;
  const interval = Math.max(15, Math.min(720, Math.round(selectedInterval)));
  const claim = await claimConversation(contextRef, interval);
  if (!claim.claimed) { console.log(`Skip ${kind} ${id.slice(0, 24)}: ${claim.reason}; interval=${interval}m.`); return; }
  try {
    const oneOnly = String(settings.messagesPerRun || '2-3') === '1';
    const maxMessages = oneOnly ? 1 : 3;
    const prompt = makePrompt(userName, context, settings);
    const raw = await callAi(api, prompt);
    const batch = kind === 'group'
      ? parseGroupBatch(raw, Array.isArray(context.members) ? context.members : [], maxMessages)
      : parseSingleBatch(raw, maxMessages);
    const createdAt = Date.now();
    const messageRefs = [];
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const messageRef = db.collection(`users/${uid}/background/messages/items`).doc();
      const senderName = kind === 'group' ? item.senderName : text(context.person?.name || '角色', 80);
      await messageRef.set({
        type: kind, conversationId: id, senderId: kind === 'group' ? item.senderId : '',
        senderName, text: item.text, createdAt: createdAt + i,
        status: 'pending', source: 'github-actions-char', batchId: createdAt.toString(36), batchIndex: i, batchSize: batch.length
      });
      messageRefs.push(messageRef);
    }
    const first = batch[0];
    const title = kind === 'group' ? (text(context.name || '群聊', 80) + ' · ' + first.senderName) : text(context.person?.name || '角色', 80);
    const body = first.text.slice(0, 116) + (batch.length > 1 ? `（还有 ${batch.length - 1} 条新消息）` : '');
    const deviceCount = await sendToUserDevices(uid, {
      title, body, url: './index.html', conversationId: id, conversationType: kind,
      tag: `lr-char-${kind}-${id.slice(0, 32)}-${createdAt.toString(36)}`,
      messageId: messageRefs[0].id, messageCount: batch.length
    });
    const previous = Array.isArray(context.recentMessages) ? context.recentMessages.slice(-20) : [];
    for (let i = 0; i < batch.length; i++) {
      previous.push({ role: 'assistant', name: kind === 'group' ? batch[i].senderName : text(context.person?.name || '角色', 80), text: batch[i].text.slice(0, 1800), at: createdAt + i });
    }
    await contextRef.set({
      recentMessages: previous.slice(-20), lastGeneratedAt: createdAt, lastMessageId: messageRefs.at(-1).id,
      lockUntil: 0, lastRunStatus: deviceCount ? 'sent' : 'generated-no-device',
      lastDeviceCount: deviceCount, lastBatchCount: batch.length, lastError: FieldValue.delete()
    }, { merge: true });
    console.log(`CHAR batch generated for UID ${uid.slice(0, 8)} / ${kind} conversation; messages=${batch.length}; devices=${deviceCount}`);
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
      if (!settingsSnap.exists || settingsSnap.data()?.enabled !== true) { console.log(`Skip UID ${uid.slice(0, 8)}: global background switch is off or settings are missing.`); continue; }
      const profile = profileSnap.data() || {};
      if (profile.consentToBackgroundAI !== true) { console.log(`Skip UID ${uid.slice(0, 8)}: cloud AI consent/profile is missing.`); continue; }
      if (!apiSnap.exists) { console.log(`Skip UID ${uid.slice(0, 8)}: private AI API configuration is missing.`); continue; }
      const settings = settingsSnap.data() || {};
      if (inQuietHours(settings)) { console.log(`Skip UID ${uid.slice(0, 8)}: quiet hours are active.`); continue; }
      const api = apiSnap.data() || {};
      const controls = await root.doc('settings').collection('conversations').where('enabled', '==', true).limit(30).get();
      console.log(`UID ${uid.slice(0, 8)}: enabled conversations=${controls.size}; global interval=${Number(settings.intervalMinutes) || 120}m; batch=${settings.messagesPerRun || '2-3'}.`);
      for (const controlDoc of controls.docs) await runConversation(uid, text(profile.userName || '用户', 80), settings, controlDoc, api);
      if (!controls.size) console.log(`Skip UID ${uid.slice(0, 8)}: no enabled single/group conversations.`);
    } catch (error) {
      console.warn(`Background processing failed for UID ${uid.slice(0, 8)}:`, text(error?.message || error, 200));
    }
  }
}
run().then(() => { console.log('Background runner completed.'); process.exit(0); }).catch((error) => { console.error('Background runner fatal error:', text(error?.message || error, 300)); process.exit(1); });
