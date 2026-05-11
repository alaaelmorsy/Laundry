/**
 * LocalZatcaBridge — جسر الإرسال المحلي لـ ZATCA Phase 2
 * يقرأ جميع الإعدادات من قاعدة البيانات (لا يملك ملفات تكوين خارجية)
 *
 * الاستراتيجيات: form, json-raw, json-wrapped, json-wrapped-string, multipart, multipart-file, text-plain
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const db = require('../../database/db');

/* ========== Singleton ========== */
let _instance = null;

class LocalZatcaBridge {
  constructor() {
    if (_instance) return _instance;
    _instance = this;

    this.endpoint = 'http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice';
    this.paramName = 'invoiceJO';
    this.paramAliases = ['invoiceJO', 'invoiceIO', 'invoiceIo', 'invoiceJson', 'invoice', 'data', 'payload'];
    this.preferredMode = 'form';
    this.enableTextPlain = false;
  }

  static getInstance() {
    if (!_instance) _instance = new LocalZatcaBridge();
    return _instance;
  }

  /* ========== تحميل الإعدادات من قاعدة البيانات ========== */
  async _loadConfig() {
    const zs = await db.getZatcaSettings();
    const localApi = zs && zs.localApi && typeof zs.localApi === 'object' ? zs.localApi : {};
    if (localApi.endpoint && String(localApi.endpoint).trim()) {
      this.endpoint = String(localApi.endpoint).trim();
    }
    if (localApi.paramName && String(localApi.paramName).trim()) {
      this.paramName = String(localApi.paramName).trim();
    }
    if (Array.isArray(localApi.paramAliases) && localApi.paramAliases.length) {
      this.paramAliases = localApi.paramAliases.map(x => String(x || '').trim()).filter(Boolean);
    }
    if (localApi.preferredMode && String(localApi.preferredMode).trim()) {
      this.preferredMode = String(localApi.preferredMode).trim();
    }
    this.enableTextPlain = localApi.enableTextPlain === true;
    return zs;
  }

  /* ========== بناء جسم الفاتورة من قاعدة البيانات ========== */
  async buildBodyFromOrder(orderId) {
    const zs = await db.getZatcaSettings();
    const orderData = await db.getOrderById(orderId);
    if (!orderData || !orderData.order) throw new Error('الفاتورة غير موجودة');

    const order = orderData.order;
    const items = orderData.items || [];

    // بيانات الشركة من zatca_settings
    const company = zs || {};
    const addr = company.address && typeof company.address === 'object' ? company.address : {};

    // حساب المجاميع
    const discount = Math.abs(Number(order.discount_amount || 0));
    const taxRate = Number(order.vat_rate || 15);

    // UUID — استخدام المخزن أو إنشاء جديد
    const uuid = order.zatca_uuid || crypto.randomUUID();

    // نوع المستند
    const isCredit = order.doc_type === 'credit_note' || order.order_type === 'credit_note';
    const typeInv = isCredit ? '381' : '388';

    // طريقة الدفع
    const paymentType = mapPaymentType(order.payment_method);

    // تاريخ الفاتورة
    const invoiceDate = order.created_at
      ? new Date(order.created_at).toISOString().replace('T', ' ').slice(0, 19)
      : new Date().toISOString().replace('T', ' ').slice(0, 19);

    // بنود الفاتورة — تنسيق مطابق لعينة ZATCA
    const sumPreVat = items.reduce((s, it) => s + (Number(it.unit_price || 0) * Number(it.quantity || 1)), 0);
    const products = items.map(it => {
      const price = Number(it.unit_price || 0);
      const count = Number(it.quantity || 1);
      const sellingPrice = price * count;
      const share = sumPreVat > 0 ? sellingPrice / sumPreVat : 0;
      const disVal = discount * share;
      const totalSellingAfterDis = sellingPrice - disVal;
      const taxVal = +(totalSellingAfterDis * (taxRate / 100)).toFixed(2);
      const totalPriceAfterDis = +(totalSellingAfterDis + taxVal).toFixed(2);

      return {
        id: it.product_id || it.id,
        name: it.service_name_ar || it.product_name_ar || 'خدمة',
        count,
        price,
        dis_val: +disVal.toFixed(2),
        tax_rate: taxRate,
        selling_price: +sellingPrice.toFixed(2),
        total_selling_after_dis: +totalSellingAfterDis.toFixed(2),
        total_price_after_dis: totalPriceAfterDis,
        tax: taxVal,
        tax_val: taxVal,
      };
    });

    // حساب المجاميع من البنود — يضمن تطابق total_with_tax = total_without_tax + tax
    const calcSum = products.reduce((s, p) => s + p.selling_price, 0);
    const calcTotalWithoutTax = products.reduce((s, p) => s + p.total_selling_after_dis, 0);
    const calcTax = products.reduce((s, p) => s + p.tax_val, 0);
    const calcTotalWithTax = +(calcTotalWithoutTax + calcTax).toFixed(2);

    // بيانات العميل — تنسيق مطابق لعينة ZATCA
    const customer = {
      id: order.customer_id || 1,
      ar_name: order.customer_name || 'عميل نقدي',
      en_name: 'Cash Customer',
      ar_address: order.customer_address || 'الرياض',
      build_number: addr.building || '0000',
      additional_number: '',
      subdivision: addr.district || '',
      zip: addr.postalCode || '00000',
      tax_number: order.customer_vat || '300000000000003',
      country: { en_name: 'Saudi Arabia', ar_name: 'السعودية' },
      city: { en_name: order.customer_city || addr.city || 'Riyadh', ar_name: order.customer_city || addr.city || 'الرياض' },
    };

    // بيانات الفرع — تنسيق مطابق لعينة ZATCA
    const branch = {
      ar_name: company.companyName || '',
      en_name: company.companyName || '',
      branch_name: company.branchName || 'Main Branch',
      ar_address: addr.street || '',
      en_address: addr.city || 'Riyadh',
      tax_number: company.vatNumber || '',
      commercial_num: company.commercialRegistration || '',
      build_number: Number(addr.building) || 0,
      additional_number: 0,
      subdivision: addr.district || '',
      zip: Number(addr.postalCode) || 0,
      email: company.email || '',
      businessCategory: company.businessCategory || 'Supply activities',
      // للإشعارات الدائنة
      reason_code: isCredit ? '01' : '',
      reason_text: isCredit ? (order.notes || 'Credit note') : '',
      city: { name: addr.city || 'Riyadh', en_name: addr.city || 'Riyadh', ar_name: addr.city || 'الرياض' },
      country: { name: 'Saudi Arabia', en_name: 'Saudi Arabia', ar_name: 'السعودية' },
    };

    // الجسم النهائي — أرقام محسوبة من البنود
    const body = {
      id: order.order_number || order.id,
      uuid,
      payment_type: paymentType,
      total: calcTotalWithTax,
      wanted_amount: 0,
      invoice_date: invoiceDate,
      return_id: null,
      return_invoices: [],
      tax_rate: taxRate,
      tax: +calcTax.toFixed(2),
      discount: +discount.toFixed(2),
      delivery_date: null,
      shipping_price: 0,
      shipping_tax: 0,
      type_inv: typeInv,
      type_invoice: '0200000',
      sum: +calcSum.toFixed(2),
      total_without_tax: +calcTotalWithoutTax.toFixed(2),
      total_with_tax: calcTotalWithTax,
      paid: isCredit ? 0 : calcTotalWithTax,
      customer,
      branch,
      products,
    };

    // للإشعارات الدائنة
    if (isCredit) {
      body.return_id = order.original_order_id || null;
      body.return_invoices = order.original_invoice_seq ? [String(order.original_invoice_seq)] : [];
    }

    return { body, uuid, orderId };
  }

  /* ========== إرسال مع استراتيجيات Fallback ========== */
  async sendWithFallback(body) {
    const modes = ['form', 'form-raw', 'json-raw', 'json-wrapped', 'json-wrapped-string', 'multipart', 'multipart-file', 'text-plain'];

    // وضع الاستراتيجية المفضلة أولاً
    const prefIdx = modes.indexOf(this.preferredMode);
    if (prefIdx > 0) {
      modes.splice(prefIdx, 1);
      modes.unshift(this.preferredMode);
    }

    const attempts = [];
    let lastError = null;

    for (const mode of modes) {
      const paramNames = (mode === 'json-wrapped' || mode === 'json-wrapped-string' || mode === 'form' || mode === 'form-raw' || mode === 'multipart' || mode === 'multipart-file')
        ? this.paramAliases
        : [this.paramName];

      for (const pName of paramNames) {
        try {
          const result = await this._tryMode(mode, pName, body);
          return result;
        } catch (err) {
          const msg = err.message || String(err);
          attempts.push(`${mode}:${pName} -> ${msg.slice(0, 120)}`);

          // توقف مبكر فقط عند أخطاء الشبكة (اتصال/مهلة) — أخطاء HTTP تستمر
          const isNetworkError = /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|انتهت مهلة|socket hang up/i.test(msg);
          if (isNetworkError) {
            lastError = new Error(`Network ERR at ${this.endpoint} | mode=${mode}, param=${pName}\n${msg}\nAttempts: [${attempts.join('] [')}]`);
            throw lastError;
          }
          lastError = err;
        }
      }
    }

    throw new Error(`جميع استراتيجيات الإرسال فشلت\nAttempts: [${attempts.join('] [')}]`);
  }

  /* ========== محاولة إرسال باستراتيجية واحدة ========== */
  async _tryMode(mode, pName, body) {
    const jsonStr = JSON.stringify(body);

    let contentType = 'application/json';
    let payload = '';

    switch (mode) {
      case 'json-raw':
        payload = jsonStr;
        break;

      case 'json-wrapped':
        payload = JSON.stringify({ [pName]: body });
        break;

      case 'json-wrapped-string':
        payload = JSON.stringify({ [pName]: jsonStr });
        break;

      case 'form':
        contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        payload = `${pName}=${encodeURIComponent(jsonStr)}`;
        break;

      case 'form-raw':
        // إرسال JSON خام بدون ترميز — بعض خوادم Payara لا تفك encodeURIComponent
        contentType = 'application/x-www-form-urlencoded; charset=UTF-8';
        payload = `${pName}=${jsonStr}`;
        break;

      case 'multipart': {
        const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
        contentType = `multipart/form-data; boundary=${boundary}`;
        payload = `--${boundary}\r\nContent-Disposition: form-data; name="${pName}"\r\nContent-Type: application/json\r\n\r\n${jsonStr}\r\n--${boundary}--\r\n`;
        break;
      }

      case 'multipart-file': {
        const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
        contentType = `multipart/form-data; boundary=${boundary}`;
        payload = `--${boundary}\r\nContent-Disposition: form-data; name="${pName}"; filename="invoice.json"\r\nContent-Type: application/json\r\n\r\n${jsonStr}\r\n--${boundary}--\r\n`;
        break;
      }

      case 'text-plain':
        contentType = 'text/plain';
        payload = jsonStr;
        break;

      default:
        payload = jsonStr;
    }

    console.log(`[zatcaBridge] mode=${mode} param=${pName} contentType=${contentType} payloadLen=${payload.length} jsonLen=${jsonStr.length}`);
    console.log(`[zatcaBridge] JSON preview: ${jsonStr.slice(0, 500)}`);

    return this._httpPost(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Accept': 'application/json',
      },
      body: payload,
    });
  }

  /* ========== HTTP POST عام ========== */
  _httpPost(url, opts) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      // حساب Content-Length بدقة (UTF-8) لمنع chunked encoding
      const bodyBuf = opts.body ? Buffer.from(opts.body, 'utf-8') : null;
      const headers = { ...opts.headers };
      if (bodyBuf) headers['Content-Length'] = bodyBuf.length;

      const reqOpts = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: opts.method || 'POST',
        headers,
      };

      const req = lib.request(reqOpts, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve({ success: true, data: JSON.parse(body), raw: body });
            } catch {
              resolve({ success: true, data: { raw: body }, raw: body });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 800)}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(30000, () => {
        req.destroy(new Error('انتهت مهلة الاتصال (30 ثانية)'));
      });

      if (bodyBuf) req.write(bodyBuf);
      req.end();
    });
  }

  /* ========== إرسال فاتورة بالكامل ========== */
  async submitOrderById(orderId) {
    // تحميل الإعدادات
    await this._loadConfig();

    // التحقق من تفعيل ZATCA
    const appSettings = await db.getAppSettings();
    if (!appSettings || !appSettings.zatcaEnabled) {
      throw new Error('الربط الإلكتروني غير مفعل من الإعدادات');
    }

    // بناء الجسم
    const { body, uuid } = await this.buildBodyFromOrder(orderId);

    // إرسال
    const result = await this.sendWithFallback(body);

    // معالجة الرد
    return this._processResponse(orderId, uuid, result);
  }

  /* ========== إرسال إشعار دائن بالكامل ========== */
  async submitCreditNoteById(cnId) {
    await this._loadConfig();

    const appSettings = await db.getAppSettings();
    if (!appSettings || !appSettings.zatcaEnabled) {
      throw new Error('الربط الإلكتروني غير مفعل من الإعدادات');
    }

    const { body, uuid } = await this.buildBodyFromCreditNote(cnId);
    const result = await this.sendWithFallback(body);
    return this._processCreditNoteResponse(cnId, uuid, result);
  }

  /* ========== معالجة الرد وتحديث قاعدة البيانات ========== */
  async _processResponse(orderId, uuid, result) {
    const rawResp = result.raw || '';
    const obj = result.data || {};

    // كشف NOT_REPORTED
    const notReported = /NOT[_\s-]?REPORTED/i.test(rawResp)
      || obj?.statusCode === 'NOT_REPORTED'
      || obj?.status === 'NOT_REPORTED'
      || obj?.data?.status === 'NOT_REPORTED';

    if (notReported) {
      await db.updateOrderZatcaStatus(orderId, {
        uuid,
        hash: null,
        qr: null,
        status: 'rejected',
        rejectionReason: 'NOT_REPORTED',
        response: rawResp.slice(0, 50000),
      });
      return { success: false, status: 'rejected', reason: 'NOT_REPORTED', raw: rawResp };
    }

    // نجاح
    const invoiceHash = obj?.invoiceHash || obj?.data?.invoiceHash || null;
    const qrCode = obj?.qrCode || obj?.data?.qrCode || null;

    await db.updateOrderZatcaStatus(orderId, {
      uuid,
      hash: invoiceHash,
      qr: qrCode,
      status: 'submitted',
      rejectionReason: null,
      response: rawResp.slice(0, 50000),
    });

    return { success: true, status: 'submitted', hash: invoiceHash, qr: qrCode, raw: rawResp };
  }

  /* ========== بناء جسم الإشعار الدائن من قاعدة البيانات ========== */
  async buildBodyFromCreditNote(cnId) {
    const zs = await db.getZatcaSettings();
    const cnData = await db.getCreditNoteById(cnId);
    if (!cnData || !cnData.creditNote) throw new Error('الإشعار الدائن غير موجود');

    const cn = cnData.creditNote;
    const items = cnData.items || [];

    const company = zs || {};
    const addr = company.address && typeof company.address === 'object' ? company.address : {};

    const discount = Math.abs(Number(cn.discount_amount || 0));
    const taxRate = Number(cn.vat_rate || 15);

    const uuid = cn.zatca_uuid || crypto.randomUUID();

    const invoiceDate = cn.created_at
      ? new Date(cn.created_at).toISOString().replace('T', ' ').slice(0, 19)
      : new Date().toISOString().replace('T', ' ').slice(0, 19);

    // بنود الإشعار — تنسيق مطابق لعينة ZATCA
    const sumPreVat = items.reduce((s, it) => s + (Number(it.unit_price || 0) * Number(it.quantity || 1)), 0);
    const products = items.map(it => {
      const price = Number(it.unit_price || 0);
      const count = Number(it.quantity || 1);
      const sellingPrice = price * count;
      const share = sumPreVat > 0 ? sellingPrice / sumPreVat : 0;
      const disVal = discount * share;
      const totalSellingAfterDis = sellingPrice - disVal;
      const taxVal = +(totalSellingAfterDis * (taxRate / 100)).toFixed(2);
      const totalPriceAfterDis = +(totalSellingAfterDis + taxVal).toFixed(2);

      return {
        id: it.product_id || it.id,
        name: it.service_name_ar || it.product_name_ar || 'خدمة',
        count,
        price,
        dis_val: +disVal.toFixed(2),
        tax_rate: taxRate,
        selling_price: +sellingPrice.toFixed(2),
        total_selling_after_dis: +totalSellingAfterDis.toFixed(2),
        total_price_after_dis: totalPriceAfterDis,
        tax: taxVal,
        tax_val: taxVal,
      };
    });

    // حساب المجاميع من البنود — يضمن تطابق total_with_tax = total_without_tax + tax
    const calcSum = products.reduce((s, p) => s + p.selling_price, 0);
    const calcTotalWithoutTax = products.reduce((s, p) => s + p.total_selling_after_dis, 0);
    const calcTax = products.reduce((s, p) => s + p.tax_val, 0);
    const calcTotalWithTax = +(calcTotalWithoutTax + calcTax).toFixed(2);

    const customer = {
      id: cn.customer_id || 1,
      ar_name: cn.customer_name || 'عميل نقدي',
      en_name: 'Cash Customer',
      ar_address: cn.customer_address || 'الرياض',
      build_number: addr.building || '0000',
      additional_number: '',
      subdivision: addr.district || '',
      zip: addr.postalCode || '00000',
      tax_number: cn.customer_vat || '300000000000003',
      country: { en_name: 'Saudi Arabia', ar_name: 'السعودية' },
      city: { en_name: cn.customer_city || addr.city || 'Riyadh', ar_name: cn.customer_city || addr.city || 'الرياض' },
    };

    const branch = {
      ar_name: company.companyName || '',
      en_name: company.companyName || '',
      branch_name: company.branchName || 'Main Branch',
      ar_address: addr.street || '',
      en_address: addr.city || 'Riyadh',
      tax_number: company.vatNumber || '',
      commercial_num: company.commercialRegistration || '',
      build_number: Number(addr.building) || 0,
      additional_number: 0,
      subdivision: addr.district || '',
      zip: Number(addr.postalCode) || 0,
      email: company.email || '',
      businessCategory: company.businessCategory || 'Supply activities',
      reason_code: '01',
      reason_text: cn.notes || 'Credit note',
      city: { name: addr.city || 'Riyadh', en_name: addr.city || 'Riyadh', ar_name: addr.city || 'الرياض' },
      country: { name: 'Saudi Arabia', en_name: 'Saudi Arabia', ar_name: 'السعودية' },
    };

    const body = {
      id: cn.credit_note_number || cn.id,
      uuid,
      payment_type: 10,
      total: calcTotalWithTax,
      wanted_amount: 0,
      invoice_date: invoiceDate,
      return_id: cn.original_order_id || null,
      return_invoices: cn.original_invoice_seq ? [String(cn.original_invoice_seq)] : [],
      tax_rate: taxRate,
      tax: +calcTax.toFixed(2),
      discount: +discount.toFixed(2),
      delivery_date: null,
      shipping_price: 0,
      shipping_tax: 0,
      type_inv: '381',
      type_invoice: '0200000',
      sum: +calcSum.toFixed(2),
      total_without_tax: +calcTotalWithoutTax.toFixed(2),
      total_with_tax: calcTotalWithTax,
      paid: 0,
      customer,
      branch,
      products,
    };

    return { body, uuid, cnId };
  }

  /* ========== معالجة رد الإشعار الدائن ========== */
  async _processCreditNoteResponse(cnId, uuid, result) {
    const rawResp = result.raw || '';
    const obj = result.data || {};

    const notReported = /NOT[_\s-]?REPORTED/i.test(rawResp)
      || obj?.statusCode === 'NOT_REPORTED'
      || obj?.status === 'NOT_REPORTED'
      || obj?.data?.status === 'NOT_REPORTED';

    if (notReported) {
      await db.updateCreditNoteZatcaStatus(cnId, {
        uuid,
        hash: null,
        qr: null,
        status: 'rejected',
        rejectionReason: 'NOT_REPORTED',
        response: rawResp.slice(0, 50000),
      });
      return { success: false, status: 'rejected', reason: 'NOT_REPORTED', raw: rawResp };
    }

    const invoiceHash = obj?.invoiceHash || obj?.data?.invoiceHash || null;
    const qrCode = obj?.qrCode || obj?.data?.qrCode || null;

    await db.updateCreditNoteZatcaStatus(cnId, {
      uuid,
      hash: invoiceHash,
      qr: qrCode,
      status: 'submitted',
      rejectionReason: null,
      response: rawResp.slice(0, 50000),
    });

    return { success: true, status: 'submitted', hash: invoiceHash, qr: qrCode, raw: rawResp };
  }
}

/* ========== دالة مساعدة لطريقة الدفع ========== */
function mapPaymentType(method) {
  const m = String(method || 'cash').toLowerCase().trim();
  if (m === 'cash' || m === 'كاش') return 10;
  if (m === 'card' || m === 'network' || m === 'mada' || m === 'شبكة') return 20;
  if (m === 'bank' || m === 'transfer' || m === 'تحويل') return 30;
  if (m === 'mixed' || m === 'مختلط') return 40;
  return 10;
}

module.exports = { LocalZatcaBridge, mapPaymentType };
