const crypto = require('crypto');
const nodemailer = require('nodemailer');

function requireSecretKey() {
  const key = process.env.EMAIL_SECRET_KEY;
  if (!key) throw new Error('EMAIL_SECRET_KEY غير مضبوط في ملف .env');
  return String(key);
}

function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encryptText(plain) {
  if (plain == null || plain === '') return null;
  const secret = requireSecretKey();
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${enc.toString('base64')}:${tag.toString('base64')}`;
}

function decryptText(encStr) {
  if (!encStr) return '';
  const secret = requireSecretKey();
  const key = deriveKey(secret);
  const parts = String(encStr).split(':');
  if (parts.length !== 3) throw new Error('صيغة كلمة المرور المشفرة غير صحيحة');
  const iv = Buffer.from(parts[0], 'base64');
  const enc = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]);
  return out.toString('utf8');
}

function buildProfessionalEmailHtml({ branding = {}, reportDateLabel = '', sentAtLabel = '' } = {}) {
  const laundryName = branding.laundryNameAr || branding.laundryNameEn || 'نظام المغسلة';
  const logoDataUrl = branding.logoDataUrl || '';
  const addressParts = [branding.buildingNumber, branding.streetNameAr, branding.districtAr, branding.cityAr, branding.postalCode].filter(Boolean);
  const addressLine = addressParts.join('، ');

  const logoBlock = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="${laundryName}" style="max-height:56px;max-width:180px;display:block;margin:0 auto 12px;border-radius:8px"/>`
    : '';

  const addressBlock = addressLine
    ? `<div style="font-size:12px;opacity:.9;margin-top:6px;text-align:center">${addressLine}</div>`
    : '';

  const sentAtBlock = sentAtLabel
    ? `<div style="font-size:11px;opacity:.85;margin-top:4px">&#128197; ${sentAtLabel}</div>`
    : '';

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;background:#f1f5f9;padding:24px;font-family:Tahoma,Arial,sans-serif;color:#0f172a">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.06)">

    <div style="background:linear-gradient(135deg,#0ea5e9 0%,#38bdf8 50%,#7dd3fc 100%);padding:22px 24px;text-align:center;color:#fff">
      ${logoBlock}
      <div style="font-size:18px;font-weight:800;letter-spacing:.3px">${laundryName}</div>
      ${addressBlock}
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.25)">
        <div style="font-size:14px;font-weight:700">التقرير اليومي</div>
        <div style="font-size:12px;opacity:.92;margin-top:3px">${reportDateLabel ? 'الفترة: ' + reportDateLabel : ''}</div>
        ${sentAtBlock}
      </div>
    </div>

    <div style="padding:24px 26px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size:12px;font-weight:700;color:#0f172a;padding-bottom:10px">
                  <span style="font-size:14px;margin-left:4px">&#128221;</span> تفاصيل التقرير
                </td>
              </tr>
              <tr>
                <td>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12px;color:#334155">
                    <tr><td style="border-bottom:1px dashed #e2e8f0;padding:6px 0">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td align="right" style="color:#64748b">نوع التقرير</td>
                        <td align="left" style="font-weight:700">تقرير يومي</td>
                      </tr></table>
                    </td></tr>
                    <tr><td style="border-bottom:1px dashed #e2e8f0;padding:6px 0">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td align="right" style="color:#64748b">صيغة الملف المرفق</td>
                        <td align="left" style="font-weight:700">PDF (كامل)</td>
                      </tr></table>
                    </td></tr>
                    <tr><td style="border-bottom:1px dashed #e2e8f0;padding:6px 0">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td align="right" style="color:#64748b">تاريخ التقرير</td>
                        <td align="left" style="font-weight:700">${reportDateLabel || '—'}</td>
                      </tr></table>
                    </td></tr>
                    <tr><td style="padding:6px 0">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                        <td align="right" style="color:#64748b">تاريخ ووقت الإرسال</td>
                        <td align="left" style="font-weight:700;direction:ltr">${sentAtLabel || '—'}</td>
                      </tr></table>
                    </td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="border-top:1px solid #e2e8f0;padding-top:14px;text-align:center">
            <div style="font-size:11px;color:#64748b;margin-bottom:4px">تم الإرسال تلقائيًا من نظام إدارة المغسلة</div>
            <div style="font-size:11px;color:#94a3b8">${laundryName}${addressLine ? ' &middot; ' + addressLine : ''}</div>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

async function sendDailyReportEmail({ from, to, appPassword, subject, html, pdfBuffer, pdfFilename }) {
  if (!from || !to || !appPassword) throw new Error('بيانات البريد غير مكتملة');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: from, pass: appPassword }
  });

  await transporter.sendMail({
    from, to, subject, html,
    attachments: [
      {
        filename: pdfFilename || 'daily-report.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
}

module.exports = {
  encryptText,
  decryptText,
  buildProfessionalEmailHtml,
  sendDailyReportEmail
};
