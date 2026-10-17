const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('node:crypto');

admin.initializeApp();
const db = admin.firestore();
const encryptionKeySecret = defineSecret('TELEGRAM_ENCRYPTION_KEY');
const REGION = 'asia-southeast1';
const PRIVATE_SETTINGS = 'privateSettings/telegram';

function getEncryptionKey() {
  const raw = process.env.TELEGRAM_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) throw new Error('TELEGRAM_ENCRYPTION_KEY Secret must be 64 hex characters (32 bytes).');
  return Buffer.from(raw, 'hex');
}
function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return { tokenCiphertext: ciphertext.toString('base64'), tokenIv: iv.toString('base64'), tokenTag: cipher.getAuthTag().toString('base64') };
}
function decryptToken(data) {
  if (!data || !data.tokenCiphertext || !data.tokenIv || !data.tokenTag) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(data.tokenIv, 'base64'));
  decipher.setAuthTag(Buffer.from(data.tokenTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data.tokenCiphertext, 'base64')), decipher.final()]).toString('utf8');
}
async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.collection('admins').doc(uid).get();
  if (!snap.exists) return false;
  const d = snap.data() || {};
  return d.enabled === true || d.active === true;
}
async function verifyAdminRequest(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Authentication token missing.');
  const decoded = await admin.auth().verifyIdToken(match[1]);
  if (!(await isAdmin(decoded.uid))) throw new Error('Admin permission denied.');
  return decoded;
}
async function readTelegramSettings() {
  const snap = await db.doc(PRIVATE_SETTINGS).get();
  return snap.exists ? snap.data() : {};
}
function cleanChatId(value) { return String(value || '').trim().slice(0, 64); }
async function telegramSend(token, chatId, text) {
  if (!token || !chatId) throw new Error('Bot Token বা Chat ID missing.');
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({chat_id: chatId, text: String(text).slice(0, 4000), disable_web_page_preview: true})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) throw new Error(result.description || `Telegram API error (${response.status})`);
  return result;
}
async function sendDualNotification(title, message) {
  const settings = await readTelegramSettings();
  const token = decryptToken(settings);
  const targets = [...new Set([cleanChatId(settings.chatId1), cleanChatId(settings.chatId2)].filter(Boolean))];
  if (!token || targets.length === 0) {
    console.info('Telegram alerts not configured; skipping notification.');
    return {sent: 0, skipped: true};
  }
  const text = `🔔 ${title}\n\n${message}\n\n⏰ ${new Date().toLocaleString('en-GB', {timeZone:'Asia/Dhaka'})} · TIGER TOPUP`;
  const results = await Promise.allSettled(targets.map(id => telegramSend(token, id, text)));
  results.forEach((r, i) => { if (r.status === 'rejected') console.error(`Telegram delivery failed for target ${i + 1}:`, r.reason?.message || r.reason); });
  return {sent: results.filter(r => r.status === 'fulfilled').length, failed: results.filter(r => r.status === 'rejected').length};
}
function safe(value, fallback='N/A') { const s = value === undefined || value === null ? '' : String(value).trim(); return s ? s.slice(0, 300) : fallback; }

exports.telegramAdmin = onRequest({region: REGION, cors: true, secrets: [encryptionKeySecret], timeoutSeconds: 30}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ok:false, error:'Use POST.'});
  try {
    await verifyAdminRequest(req);
    const body = req.body || {};
    const action = String(body.action || '');
    const current = await readTelegramSettings();
    if (action === 'get') {
      return res.json({ok:true, chatId1: current.chatId1 || '', chatId2: current.chatId2 || '', hasBotToken: !!current.tokenCiphertext});
    }
    if (action === 'save') {
      const chatId1 = cleanChatId(body.chatId1);
      const chatId2 = cleanChatId(body.chatId2);
      const newToken = String(body.botToken || '').trim();
      if (!chatId1 && !chatId2) return res.status(400).json({ok:false,error:'কমপক্ষে একটি Chat ID দিন।'});
      const tokenFields = newToken ? encryptToken(newToken) : {};
      if (!newToken && !current.tokenCiphertext) return res.status(400).json({ok:false,error:'প্রথমবার Save করার সময় Bot Token দিতে হবে।'});
      await db.doc(PRIVATE_SETTINGS).set({chatId1, chatId2, ...tokenFields, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: 'admin'}, {merge:true});
      return res.json({ok:true});
    }
    if (action === 'test') {
      const target = String(body.target || '');
      const chatId = cleanChatId(body.chatId);
      if (!['chat1','chat2'].includes(target) || !chatId) return res.status(400).json({ok:false,error:'Valid target and Chat ID required.'});
      const token = String(body.botToken || '').trim() || decryptToken(current);
      if (!token) return res.status(400).json({ok:false,error:'Bot Token সেট করুন।'});
      await telegramSend(token, chatId, `🔔 TIGER TOPUP TEST NOTIFICATION\n\n✅ Telegram connection successful.\n🎯 Target: ${target === 'chat1' ? 'Admin Chat' : 'Group/Channel'}\n⏰ ${new Date().toLocaleString('en-GB', {timeZone:'Asia/Dhaka'})}`);
      return res.json({ok:true});
    }
    return res.status(400).json({ok:false,error:'Unknown action.'});
  } catch (error) {
    const status = /permission denied|authentication token missing|invalid id token|argument-error/i.test(error.message || '') ? 403 : 400;
    console.error('telegramAdmin error:', error.message || error);
    return res.status(status).json({ok:false,error:error.message || 'Request failed.'});
  }
});

exports.notifyNewUser = onDocumentCreated({document:'users/{uid}', region: REGION, secrets:[encryptionKeySecret]}, async event => {
  const d = event.data?.data(); if (!d) return;
  const message = `👤 নতুন ইউজার রেজিস্ট্রেশন\nনাম: ${safe(d.name)}\nইমেইল: ${safe(d.email)}\nফোন: ${safe(d.phone)}\nUID: ${safe(event.params.uid)}`;
  await sendDualNotification('NEW USER REGISTERED', message);
});

exports.notifyNewOrder = onDocumentCreated({document:'orders/{orderId}', region: REGION, secrets:[encryptionKeySecret]}, async event => {
  const d = event.data?.data(); if (!d) return;
  const message = `🛒 নতুন অর্ডার এসেছে\nOrder ID: ${safe(event.params.orderId)}\nইউজার: ${safe(d.userName || d.userEmail)}\nইমেইল: ${safe(d.userEmail)}\nগেম: ${safe(d.gameName)}\nPlayer ID: ${safe(d.playerId)}\nপ্যাকেজ: ${safe(d.productName)}\nপরিমাণ: ৳${safe(d.price, '0')}\nপেমেন্ট: ${safe(d.paymentMethod || d.paymentType)}\nTransaction ID: ${safe(d.trxId)}\nস্ট্যাটাস: ${safe(d.status)}`;
  await sendDualNotification('NEW ORDER', message);
});

exports.notifyNewDeposit = onDocumentCreated({document:'deposits/{depositId}', region: REGION, secrets:[encryptionKeySecret]}, async event => {
  const d = event.data?.data(); if (!d) return;
  const message = `💳 নতুন ডিপোজিট রিকোয়েস্ট\nDeposit ID: ${safe(event.params.depositId)}\nইউজার: ${safe(d.userEmail || d.userId)}\nপরিমাণ: ৳${safe(d.amount, '0')}\nপেমেন্ট: ${safe(d.method)}\nSender Number: ${safe(d.sender)}\nTransaction ID: ${safe(d.trxId)}\nস্ট্যাটাস: ${safe(d.status)}`;
  await sendDualNotification('NEW DEPOSIT REQUEST', message);
});
