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

  app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.json({ success: false, message: 'أدخل اسم المستخدم وكلمة المرور' });
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
        secure: process.env.NODE_ENV === 'production'
      });
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role
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

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        role: req.user.role
      }
    });
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

  app.listen(PORT, () => {
    console.log(`Laundry web server http://localhost:${PORT}`);
  });
}

start().catch((e) => {
  console.error('Failed to start server', e);
  process.exit(1);
});
