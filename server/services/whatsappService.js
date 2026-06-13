'use strict';

const path   = require('path');
const fs     = require('fs');
const QRCode = require('qrcode');
const { DATA_ROOT } = require('../paths');

const SESSION_DIR = path.join(DATA_ROOT, 'data', 'whatsapp_session');
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let _sock      = null;
let _status    = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
let _qrDataUrl = null;

async function _loadBaileys() {
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
  } = await import('@whiskeysockets/baileys');
  return { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion };
}

async function connect() {
  if (_status === 'connected' || _status === 'connecting') return;
  _status    = 'connecting';
  _qrDataUrl = null;

  try {
    const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } =
      await _loadBaileys();

    const pino = require('pino');
    const logger = pino({ level: 'silent' });

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version }          = await fetchLatestBaileysVersion();

    _sock = makeWASocket({
      version,
      auth:                  state,
      logger,
      printQRInTerminal:     false,
      browser:               ['Laundry POS', 'Chrome', '1.0.0'],
      connectTimeoutMs:      60_000,
      keepAliveIntervalMs:   30_000,
    });

    _sock.ev.on('creds.update', saveCreds);

    _sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          _qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
        } catch (_) {}
      }

      if (connection === 'open') {
        _status    = 'connected';
        _qrDataUrl = null;
        console.log('[WhatsApp] Connected successfully');
      }

      if (connection === 'close') {
        const code     = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;

        _sock   = null;
        _status = 'disconnected';

        if (loggedOut) {
          _clearSession();
          console.log('[WhatsApp] Logged out — session cleared');
        } else {
          console.log('[WhatsApp] Disconnected, reconnecting in 5s...');
          setTimeout(connect, 5000);
        }
      }
    });
  } catch (err) {
    _status = 'disconnected';
    _sock   = null;
    console.error('[WhatsApp] connect error:', err.message);
  }
}

function _clearSession() {
  try {
    const files = fs.readdirSync(SESSION_DIR);
    for (const f of files) {
      fs.unlinkSync(path.join(SESSION_DIR, f));
    }
  } catch (_) {}
}

async function disconnect() {
  if (_sock) {
    try { await _sock.logout(); } catch (_) {}
    _sock = null;
  }
  _clearSession();
  _status    = 'disconnected';
  _qrDataUrl = null;
}

function getStatus() {
  return { status: _status, qr: _qrDataUrl };
}

/**
 * phone: supports any format:
 *   "0501234567"     → Saudi local   → 966501234567
 *   "00201234567890" → intl prefix   → 201234567890
 *   "+201234567890"  → with plus     → 201234567890
 *   "201234567890"   → already intl  → 201234567890
 *   "966501234567"   → already Saudi → 966501234567
 */
async function sendMessage(phone, text) {
  if (_status !== 'connected') {
    return { success: false, error: 'الواتساب غير متصل' };
  }

  let n = String(phone).replace(/\D/g, ''); // strip everything except digits
  if (n.startsWith('00')) {
    // international dialing prefix (e.g. 00201234567890 → 201234567890)
    n = n.slice(2);
  } else if (n.startsWith('0') && n.length <= 11) {
    // local Saudi number starting with 0 (e.g. 0501234567 → 966501234567)
    n = '966' + n.slice(1);
  }
  // otherwise assume number already contains country code (966..., 20..., 1..., etc.)

  const jid = n + '@s.whatsapp.net';

  try {
    await _sock.sendMessage(jid, { text });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendDocument(phone, buffer, filename, caption) {
  if (_status !== 'connected') {
    return { success: false, error: 'الواتساب غير متصل' };
  }

  let n = String(phone).replace(/\D/g, '');
  if (n.startsWith('00')) {
    n = n.slice(2);
  } else if (n.startsWith('0') && n.length <= 11) {
    n = '966' + n.slice(1);
  }

  const jid = n + '@s.whatsapp.net';

  // التحقق من أن الرقم مسجّل في واتساب قبل الإرسال
  if (_sock && typeof _sock.onWhatsApp === 'function') {
    try {
      const results = await _sock.onWhatsApp(n);
      const found = Array.isArray(results) ? results[0] : results;
      if (!found || !found.exists) {
        console.log('[WhatsApp] رقم غير مسجّل في واتساب، تخطي الإرسال:', n);
        return { success: false, error: 'not_on_whatsapp' };
      }
    } catch (_) {
      // إذا فشل التحقق (مثلاً انقطاع مؤقت)، نكمل الإرسال
    }
  }

  // تأخير عشوائي بين 3 و8 ثوانٍ لتقليل خطر الحظر
  await new Promise(r => setTimeout(r, 3000 + Math.floor(Math.random() * 5000)));

  try {
    await _sock.sendMessage(jid, {
      document: buffer,
      mimetype: 'application/pdf',
      fileName: filename || 'invoice.pdf',
      caption: caption || ''
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { connect, disconnect, getStatus, sendMessage, sendDocument };
