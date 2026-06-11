const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const db = require('../database/db');
const { signUserToken, authMiddleware } = require('./middleware/auth');
const { invoke } = require('./invokeHandlers');
const exportsService = require('./services/exportsService');
const cron = require('node-cron');
const reportEmailScheduler = require('./services/reportEmailScheduler');
const { LocalZatcaBridge } = require('./services/zatcaBridge');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '3000', 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

async function start() {
  await db.initialize();

  // Auto-restore WhatsApp session if session files exist
  try {
    const whatsappService = require('./services/whatsappService');
    const waDir = path.join(__dirname, '../data/whatsapp_session');
    const fs = require('fs');
    if (fs.existsSync(waDir) && fs.readdirSync(waDir).length > 0) {
      whatsappService.connect().catch(e => console.error('[WhatsApp] auto-connect failed:', e.message));
    }
  } catch (e) {
    console.error('[WhatsApp] service load failed:', e.message);
  }

  // Start background scheduler for daily report email
  try {
    reportEmailScheduler.startScheduler(cron);
  } catch (e) {
    console.error('[reportEmailScheduler] failed to start', e);
  }

  // Start ZATCA periodic retry scheduler (every 15 minutes)
  let zatcaSchedulerRunning = false;
  async function zatcaRetryRunOnce() {
    if (zatcaSchedulerRunning) return;
    zatcaSchedulerRunning = true;
    try {
      const appSettings = await db.getAppSettings();
      if (!appSettings || !appSettings.zatcaEnabled) { zatcaSchedulerRunning = false; return; }
      const ids = await db.getUnsentZatcaOrders(500);
      if (!ids.length) { zatcaSchedulerRunning = false; return; }
      const bridge = LocalZatcaBridge.getInstance();
      for (const id of ids) {
        try {
          await bridge.submitOrderById(id);
        } catch (e) {
          console.error(`[zatcaScheduler] order ${id} failed:`, e.message);
        }
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error('[zatcaScheduler] run error:', e.message);
    } finally {
      zatcaSchedulerRunning = false;
    }
  }
  // First run after 10 seconds
  setTimeout(zatcaRetryRunOnce, 10000);
  // Then every 15 minutes
  cron.schedule('*/15 * * * *', zatcaRetryRunOnce);

  const app = express();
  // Required when running behind a proxy (e.g. IDE preview) so rate-limit can read X-Forwarded-For safely.
  app.set('trust proxy', 1);
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.get('/', (_req, res) => {
    res.redirect('/screens/login/login.html');
  });

  app.use(express.static(ROOT, { index: false }));

  app.get('/api/accounts/trial-status', async (req, res) => {
    try {
      const settings = await db.getAppSettings();
      if (!settings.trialModeEnabled) {
        return res.json({ trialModeEnabled: false });
      }
      // تحقق من IP الزائر الحالي فقط
      const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                 || req.ip
                 || req.connection?.remoteAddress
                 || null;
      const ip = rawIp ? rawIp.replace(/^::ffff:/, '') : null;

      if (!ip) {
        return res.json({ trialModeEnabled: true, hasAccount: false, active: false, daysLeft: 0 });
      }

      const [[row]] = await db.pool.query(`
        SELECT status, trial_end_date,
               GREATEST(0, DATEDIFF(trial_end_date, NOW())) AS days_left
        FROM accounts
        WHERE ip_address = ?
        LIMIT 1
      `, [ip]);

      if (!row) {
        // هذا الجهاز لم يسجل بعد — اعرض زر التسجيل
        return res.json({ trialModeEnabled: true, hasAccount: false, active: false, daysLeft: 0 });
      }

      const active = row.status === 'Active' || (row.status === 'Trial' && Number(row.days_left) >= 0 && new Date(row.trial_end_date) >= new Date());
      return res.json({
        trialModeEnabled: true,
        hasAccount: true,
        active,
        status: row.status,
        daysLeft: Number(row.days_left)
      });
    } catch (err) {
      console.error('trial-status', err);
      return res.json({ trialModeEnabled: false });
    }
  });

  app.get('/api/license/check', async (_req, res) => {
    try {
      const si = require('systeminformation');
      const [disk, net, board] = await Promise.all([
        si.diskLayout(),
        si.networkInterfaces(),
        si.baseboard()
      ]);

      const diskSerial  = (disk[0]?.serialNum  || '').trim();
      const macAddress  = (Array.isArray(net) ? net.find(n => !n.virtual && n.mac && n.mac !== '00:00:00:00:00:00') : null)?.mac?.trim() || '';
      const boardSerial = (board?.serial || '').trim();

      const serials = [diskSerial, macAddress, boardSerial].filter(Boolean);
      const licensed = await db.isSerialLicensed(serials);
      return res.json({ licensed });
    } catch (err) {
      console.error('[license/check]', err);
      return res.json({ licensed: false });
    }
  });

  app.get('/api/app/day-reset-hour', async (_req, res) => {
    try {
      const settings = await db.getAppSettings();
      return res.json({ success: true, dayResetHour: settings.dayResetHour, dayResetTime: settings.dayResetTime });
    } catch (err) {
      console.error('day-reset-hour', err);
      return res.json({ success: false, dayResetHour: null });
    }
  });

  app.get('/api/app/support-info', async (_req, res) => {
    try {
      const settings = await db.getAppSettings();
      const expiry = settings.supportExpiryDate;
      if (!expiry) return res.json({ hasExpiry: false });
      const expiryDate = new Date(expiry);
      expiryDate.setHours(23, 59, 59, 999);
      const now = new Date();
      const msLeft = expiryDate - now;
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      return res.json({
        hasExpiry: true,
        date: expiry,
        daysLeft,
        expired: daysLeft < 0
      });
    } catch (err) {
      console.error('support-info', err);
      return res.json({ hasExpiry: false });
    }
  });

  app.post('/api/accounts/register', loginLimiter, async (req, res) => {
    try {
      const { name, phone, password } = req.body || {};
      if (!name || !phone || !password) {
        return res.json({ success: false, message: 'جميع الحقول مطلوبة' });
      }
      if (String(phone).replace(/\D/g, '').length < 9) {
        return res.json({ success: false, message: 'رقم الجوال غير صحيح' });
      }
      const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                 || req.ip
                 || req.connection?.remoteAddress
                 || null;
      const ip = rawIp ? rawIp.replace(/^::ffff:/, '') : null;
      await db.registerAccount({ name: String(name).trim(), phone: String(phone).trim(), password, ip });
      return res.json({ success: true });
    } catch (err) {
      if (err.code === 'PHONE_EXISTS') {
        return res.json({ success: false, message: 'رقم الجوال مسجل مسبقاً' });
      }
      if (err.code === 'IP_EXISTS') {
        return res.json({ success: false, message: 'تم تسجيل حساب تجريبي مسبقاً من هذا الجهاز' });
      }
      console.error('register-account', err);
      return res.json({ success: false, message: 'حدث خطأ، حاول مرة أخرى' });
    }
  });

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.json({ success: false, message: 'أدخل اسم المستخدم وكلمة المرور' });
      }
      const settings = await db.getAppSettings();
      if (settings.trialModeEnabled) {
        const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                   || req.ip
                   || req.connection?.remoteAddress
                   || null;
        const ip = rawIp ? rawIp.replace(/^::ffff:/, '') : null;
        const access = await db.checkTrialAccess(ip);
        if (!access.allowed) {
          return res.json({
            success: false,
            trialExpired: !access.needsRegistration,
            needsRegistration: access.needsRegistration,
            message: access.needsRegistration
              ? 'يجب التسجيل أولاً للحصول على نسخة تجريبية لهذا الجهاز'
              : 'انتهت فترة التجربة المجانية'
          });
        }
      }
      const user = await db.findUser(String(username).trim(), password);
      if (!user) {
        return res.json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }
      const token = signUserToken(user);
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      res.cookie('laundry_auth', token, {
        httpOnly: true,
        maxAge,
        sameSite: 'lax',
        path: '/',
        secure: req.secure || req.protocol === 'https'
      });
      const permissions = await db.getPermissionsForUser(user.id);
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          role_id: user.role_id || null,
          permissions
        }
      });
    } catch (err) {
      console.error('login', err);
      return res.json({ success: false, message: 'خطأ في الاتصال بقاعدة البيانات' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('laundry_auth', { path: '/' });
    res.json({ success: true });
  });

  app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
      const permissions = await db.getPermissionsForUser(req.user.id);
      res.json({
        success: true,
        user: {
          id: req.user.id,
          username: req.user.username,
          full_name: req.user.full_name,
          role: req.user.role,
          role_id: req.user.role_id || null,
          permissions
        }
      });
    } catch (e) {
      res.json({ success: true, user: { id: req.user.id, username: req.user.username, full_name: req.user.full_name, role: req.user.role, permissions: {} } });
    }
  });

  app.post('/api/invoke', authMiddleware, async (req, res) => {
    try {
      const { method: rawMethod, payload } = req.body || {};
      const method = typeof rawMethod === 'string' ? rawMethod.trim() : '';
      if (!method) {
        return res.status(400).json({ success: false, message: 'method مطلوب' });
      }
      const out = await invoke(method, payload, req.user);
      return res.json(out);
    } catch (err) {
      console.error('invoke', err);
      return res.status(500).json({ success: false, message: err.message || 'خطأ في الخادم' });
    }
  });

  function sendExport(res, result) {
    const encoded = encodeURIComponent(result.filename);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    res.send(result.buffer);
  }

  app.post('/api/export/expenses', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportExpenses(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/customers', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportCustomers(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/products', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportProducts(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/subscriptions', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportSubscriptions(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/subscription-customer-report', authMiddleware, async (req, res) => {
    try {
      const { type, customerId, subscriptionId, filters = {} } = req.body || {};
      const result = await exportsService.exportSubscriptionCustomerReport(
        type,
        customerId,
        subscriptionId,
        filters
      );
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/subscription-receipt-pdf', authMiddleware, async (req, res) => {
    try {
      const { periodId } = req.body || {};
      const result = await exportsService.exportSubscriptionReceiptPdf(Number(periodId));
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/invoice-pdf', authMiddleware, async (req, res) => {
    try {
      const { orderId, paperType } = req.body || {};
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'رقم الطلب مطلوب' });
      }
      const result = await exportsService.exportInvoicePdf(Number(orderId), paperType || 'thermal');
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/invoice-pdf-from-html', authMiddleware, async (req, res) => {
    try {
      const { html, paperType, orderNum } = req.body || {};
      if (!html) {
        return res.status(400).json({ success: false, message: 'محتوى HTML مطلوب' });
      }
      const result = await exportsService.exportInvoicePdfFromHtml(html, paperType || 'thermal', orderNum || '');
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/report', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportReport(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/zakat-report', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportZakatReport(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/worker-report', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportWorkerReport(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/credit-notes', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportCreditNotes(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/all-invoices-report', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportAllInvoicesReport(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/subscriptions-report', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportSubscriptionsReport(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/types-report', authMiddleware, async (req, res) => {
    try {
      const { type, filters = {} } = req.body || {};
      const result = await exportsService.exportTypesReport(type, filters);
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/export/hanger-ticket', authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.body || {};
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'رقم الطلب مطلوب' });
      }
      const result = await exportsService.exportHangerTicketPdf(Number(orderId));
      sendExport(res, result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/print/hanger-ticket-thermal', authMiddleware, async (req, res) => {
    try {
      const { orderId } = req.body || {};
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'رقم الطلب مطلوب' });
      }
      const html = await exportsService.buildThermalHangerTicketHtml(Number(orderId));
      if (!html) return res.json({ success: false, message: 'الفاتورة غير موجودة' });
      return res.json({ success: true, html });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/subscriptions/receipt-print-html', authMiddleware, async (req, res) => {
    try {
      const { periodId } = req.body || {};
      const html = await exportsService.buildThermalReceiptHtml(Number(periodId));
      if (!html) return res.json({ success: false, message: 'الفترة غير موجودة' });
      return res.json({ success: true, html });
    } catch (err) {
      console.error(err);
      return res.json({ success: false, message: err.message });
    }
  });

  app.post('/api/translate', authMiddleware, async (req, res) => {
    try {
      const { text, target = 'en', source = 'ar' } = req.body || {};
      if (!text || !String(text).trim()) {
        return res.json({ success: false, message: 'النص مطلوب' });
      }
      const apiKey = process.env.LANGBLY_API_KEY;
      if (!apiKey) {
        return res.json({ success: false, message: 'مفتاح Langbly API غير مضبوط في ملف .env' });
      }
      const response = await fetch('https://api.langbly.com/language/translate/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ q: String(text).trim(), target, source })
      });
      const data = await response.json();
      const translatedText = data?.data?.translations?.[0]?.translatedText;
      if (!translatedText) {
        return res.json({ success: false, message: 'فشلت الترجمة، تحقق من المفتاح والنص' });
      }
      return res.json({ success: true, text: translatedText });
    } catch (err) {
      console.error('translate', err);
      return res.json({ success: false, message: err.message || 'خطأ في الترجمة' });
    }
  });

  // ── Start HTTPS server first (for mobile camera access) ──
  let HTTPS_PORT = 0;
  let localIP = 'localhost';
  try {
    const https = require('https');
    const { ensureCerts } = require('./sslCert');
    const sslOpts = ensureCerts();
    HTTPS_PORT = parseInt(process.env.HTTPS_PORT || String(PORT + 443), 10);
    https.createServer(sslOpts, app).listen(HTTPS_PORT, () => {
      const os = require('os');
      const nets = os.networkInterfaces();
      for (const name in nets) {
        for (const iface of nets[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
          }
        }
      }
      console.log(`Laundry HTTPS server https://localhost:${HTTPS_PORT}`);
      console.log(`📱 للدخول من الجوال: https://${localIP}:${HTTPS_PORT}`);
      console.log(`⚠️  عند أول دخول من الجوال: اقبل التحذير الأمني للشهادة الذاتية (مرة واحدة فقط)`);
    });
  } catch (sslErr) {
    console.warn('[SSL] HTTPS server failed to start:', sslErr.message);
    console.warn('[SSL] Camera scanning will only work on localhost');
  }

  // ── Start HTTP server with auto-redirect for mobile ──
  const http = require('http');
  const httpHandler = (req, res) => {
    // Check if request is from a non-localhost client (mobile on LAN)
    // and HTTPS is available — redirect them to HTTPS for camera support
    const host = req.headers.host || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (!isLocalhost && HTTPS_PORT > 0) {
      const hostname = host.split(':')[0];
      const httpsUrl = `https://${hostname}:${HTTPS_PORT}${req.url}`;
      res.writeHead(302, { Location: httpsUrl });
      res.end();
      return;
    }
    // Localhost requests use the normal Express app
    app(req, res);
  };
  http.createServer(httpHandler).listen(PORT, () => {
    console.log(`Laundry web server http://localhost:${PORT}`);
  });

}

start().catch((e) => {
  console.error('Failed to start server', e);
  process.exit(1);
});
