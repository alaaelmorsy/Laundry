const exportsService = require('./exportsService');
const db = require('../../database/db');
const { loadAppBrandingForReceipts } = require('./branding');
const { decryptText, sendDailyReportEmail, buildProfessionalEmailHtml } = require('./emailService');

function pad2(x) {
  return String(x).padStart(2, '0');
}

function nowTimeHHMM(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function sameDay(a, b) {
  if (!a || !b) return false;
  const da = a instanceof Date ? a : new Date(a);
  const dbb = b instanceof Date ? b : new Date(b);
  if (isNaN(da.getTime()) || isNaN(dbb.getTime())) return false;
  return dateKey(da) === dateKey(dbb);
}

async function trySendOnce() {
  const settings = await db.getAppSettings();
  if (!settings || !settings.reportEmailEnabled) return;

  const sendTime = settings.reportEmailSendTime || '09:00';
  const nowHHMM = nowTimeHHMM(new Date());
  if (nowHHMM !== sendTime) return;

  // Avoid duplicate send in same day
  if (settings.reportEmailLastSentAt && sameDay(settings.reportEmailLastSentAt, new Date())) {
    return;
  }

  const from = String(settings.reportEmailFrom || '').trim();
  const to = String(settings.email || '').trim();
  if (!from) {
    await db.updateReportEmailLastResult({ status: 'failed', error: 'إعدادات البريد ناقصة: يرجى ضبط بريد المؤسسة (From) في إعداد تقرير البريد', sentAt: null });
    return;
  }
  if (!to) {
    await db.updateReportEmailLastResult({ status: 'failed', error: 'إعدادات البريد ناقصة: يرجى ضبط بريد المغسلة في بيانات المغسلة', sentAt: null });
    return;
  }

  const enc = settings.reportEmailAppPasswordEnc;
  if (!enc) {
    await db.updateReportEmailLastResult({ status: 'failed', error: 'App Password غير مضبوط', sentAt: null });
    return;
  }

  let appPassword = '';
  try {
    appPassword = decryptText(enc);
  } catch (e) {
    await db.updateReportEmailLastResult({ status: 'failed', error: e.message || 'فشل فك التشفير', sentAt: null });
    return;
  }

  const today = new Date();
  const reportDateLabel = dateKey(today);

  try {
    const filters = { dateFrom: reportDateLabel, dateTo: reportDateLabel };
    const pdf = await exportsService.exportReport('pdf', filters);

    const branding = await loadAppBrandingForReceipts().catch(() => ({}));
    const sentAtLabel = `${pad2(today.getDate())}-${pad2(today.getMonth() + 1)}-${today.getFullYear()} ${pad2(today.getHours())}:${pad2(today.getMinutes())}`;
    const html = buildProfessionalEmailHtml({ branding, reportDateLabel, sentAtLabel });
    const subject = `التقرير اليومي — ${reportDateLabel} — ${branding.laundryNameAr || branding.laundryNameEn || 'نظام المغسلة'}`;

    await sendDailyReportEmail({
      from,
      to,
      appPassword,
      subject,
      html,
      pdfBuffer: pdf.buffer,
      pdfFilename: pdf.filename
    });

    await db.updateReportEmailLastResult({ status: 'sent', error: null, sentAt: new Date() });
  } catch (e) {
    await db.updateReportEmailLastResult({ status: 'failed', error: e.message || String(e), sentAt: null });
  }
}

function startScheduler(cron) {
  // Default schedule every minute
  const job = cron.schedule('* * * * *', () => {
    trySendOnce().catch((e) => {
      // Last resort: keep scheduler alive
      console.error('[reportEmailScheduler]', e);
    });
  });
  return job;
}

module.exports = { startScheduler, trySendOnce };
