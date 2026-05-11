const zlib = require('zlib');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../database/db');
const exportsService = require('./services/exportsService');
const { loadAppBrandingForReceipts } = require('./services/branding');
const { encryptText, decryptText, sendDailyReportEmail, buildProfessionalEmailHtml } = require('./services/emailService');
const { LocalZatcaBridge } = require('./services/zatcaBridge');

const MAX_PRODUCT_IMAGE_RAW_BYTES = 15 * 1024 * 1024;

/**
 * @param {string} method camelCase API method (matches preload.js)
 * @param {object} payload
 * @param {object} _user JWT payload
 */
async function invoke(method, payload, _user) {
  const m = String(method || '').trim();
  switch (m) {
    case 'getAppSettings': {
      const s = await db.getAppSettings();
      let logoDataUrl = '';
      if (s.logoGzipBuffer && s.logoGzipBuffer.length) {
        try {
          const raw = zlib.gunzipSync(s.logoGzipBuffer);
          logoDataUrl = `data:${s.logoMime || 'image/png'};base64,${raw.toString('base64')}`;
        } catch (_) {
          logoDataUrl = '';
        }
      }
      const { logoGzipBuffer: _b, logoMime: _m, ...rest } = s;
      return {
        success: true,
        settings: { ...rest, logoMime: s.logoMime, logoDataUrl }
      };
    }

    case 'saveAppSettings': {
      const data = payload || {};
      const savePayload = {
        laundryNameAr: data.laundryNameAr,
        laundryNameEn: data.laundryNameEn,
        locationAr: data.locationAr,
        locationEn: data.locationEn,
        invoiceNotes: data.invoiceNotes,
        phone: data.phone,
        email: data.email,
        customFields: data.customFields,
        vatRate: data.vatRate,
        vatNumber: data.vatNumber,
        commercialRegister: data.commercialRegister,
        buildingNumber: data.buildingNumber,
        streetNameAr: data.streetNameAr,
        districtAr: data.districtAr,
        cityAr: data.cityAr,
        postalCode: data.postalCode,
        additionalNumber: data.additionalNumber,
        priceDisplayMode: data.priceDisplayMode,
        enabledPaymentMethods: data.enabledPaymentMethods,
        defaultPaymentMethod: data.defaultPaymentMethod,
        invoicePaperType: data.invoicePaperType,
        logoWidth: data.logoWidth,
        logoHeight: data.logoHeight,
        printCopies: data.printCopies,
        requireHanger: data.requireHanger,
        requireCustomerPhone: data.requireCustomerPhone,
        allowSubscriptionDebt: data.allowSubscriptionDebt,
        barcodeAutoAction: data.barcodeAutoAction,
        showBarcodeInInvoice: data.showBarcodeInInvoice,
        reportEmailEnabled: data.reportEmailEnabled,
        reportEmailFrom: data.reportEmailFrom,
        reportEmailSendTime: data.reportEmailSendTime,
        reportEmailAppPasswordEnc: (() => {
          const raw = data.reportEmailAppPassword;
          if (raw == null) return data.reportEmailAppPasswordEnc || null;
          const v = String(raw).trim();
          if (!v) return null;
          return encryptText(v);
        })(),
        zatcaEnabled: data.zatcaEnabled
      };
      if (data.removeLogo === true) {
        savePayload.clearLogo = true;
      } else if (data.imageBase64) {
        const raw = Buffer.from(data.imageBase64, 'base64');
        if (raw.length > MAX_PRODUCT_IMAGE_RAW_BYTES) {
          return { success: false, message: 'حجم الملف كبير جداً (الحد 15 ميجابايت)' };
        }
        savePayload.logoGzipBuffer = zlib.gzipSync(raw, { level: 9 });
        savePayload.logoMime = data.imageMime || 'application/octet-stream';
      }
      await db.saveAppSettings(savePayload);
      return { success: true };
    }

    case 'getZatcaSettings': {
      try {
        const s = await db.getZatcaSettings();
        return { success: true, settings: s };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'saveZatcaSettings': {
      try {
        await db.saveZatcaSettings(payload || {});
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'sendTestDailyReportEmail': {
      try {
        const s = await db.getAppSettings();
        const fromEmail = String(s.reportEmailFrom || '').trim();
        const toEmail = String(s.email || '').trim();
        if (!fromEmail) {
          return { success: false, message: 'يرجى ضبط بريد المؤسسة (From) في إعداد تقرير البريد أولاً' };
        }
        if (!toEmail) {
          return { success: false, message: 'يرجى ضبط بريد المغسلة في بيانات المغسلة أولاً' };
        }
        if (!s.reportEmailAppPasswordEnc) {
          return { success: false, message: 'يرجى إدخال App Password أولاً' };
        }
        const appPassword = decryptText(s.reportEmailAppPasswordEnc);
        const today = new Date();
        const p2 = (x) => String(x).padStart(2, '0');
        const dateKey = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;
        const filters = { dateFrom: dateKey, dateTo: dateKey };
        const pdf = await exportsService.exportReport('pdf', filters);
        const branding = await loadAppBrandingForReceipts().catch(() => ({}));
        const sentAtLabel = `${p2(today.getDate())}-${p2(today.getMonth() + 1)}-${today.getFullYear()} ${p2(today.getHours())}:${p2(today.getMinutes())}`;
        const html = buildProfessionalEmailHtml({ branding, reportDateLabel: dateKey, sentAtLabel });
        const subject = `التقرير اليومي — ${dateKey} — ${branding.laundryNameAr || branding.laundryNameEn || 'نظام المغسلة'} (تجريبي)`;
        await sendDailyReportEmail({
          from: fromEmail,
          to: toEmail,
          appPassword,
          subject,
          html,
          pdfBuffer: pdf.buffer,
          pdfFilename: pdf.filename
        });
        await db.updateReportEmailLastResult({ status: 'sent', error: null, sentAt: new Date() });
        return { success: true };
      } catch (err) {
        await db.updateReportEmailLastResult({ status: 'failed', error: err.message || String(err), sentAt: null }).catch(() => {});
        return { success: false, message: err.message || 'فشل إرسال البريد' };
      }
    }

    case 'getUsers': {
      const users = await db.getAllUsers();
      const safe = users.map((u) => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
        password: ''
      }));
      return { success: true, users: safe };
    }

    case 'createUser': {
      try {
        const id = await db.createUser(payload.username, payload.password, payload.fullName, payload.role);
        return { success: true, id };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return { success: false, message: 'اسم المستخدم موجود بالفعل' };
        return { success: false, message: err.message };
      }
    }

    case 'updateUser': {
      try {
        const pwd = payload.password && String(payload.password).trim() ? payload.password : null;
        await db.updateUser(payload.id, payload.username, pwd, payload.fullName, payload.role);
        return { success: true };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return { success: false, message: 'اسم المستخدم موجود بالفعل' };
        return { success: false, message: err.message };
      }
    }

    case 'toggleUserStatus': {
      try {
        await db.toggleUserStatus(payload.id, payload.isActive);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deleteUser': {
      try {
        await db.deleteUser(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getCustomers': {
      try {
        const result = await db.getAllCustomers(payload || {});
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createCustomer': {
      try {
        const result = await db.createCustomer(payload);
        return { success: true, ...result };
      } catch (err) {
        if (err.appCode === 'NAME_DUPLICATE')  return { success: false, code: 'NAME_DUPLICATE' };
        if (err.appCode === 'PHONE_DUPLICATE') return { success: false, code: 'PHONE_DUPLICATE' };
        if (err.appCode === 'PHONE_INVALID') return { success: false, code: 'PHONE_INVALID' };
        if (err.appCode === 'PHONE_TOO_LONG') return { success: false, code: 'PHONE_TOO_LONG' };
        return { success: false, message: err.message };
      }
    }

    case 'updateCustomer': {
      try {
        await db.updateCustomer(payload);
        return { success: true };
      } catch (err) {
        if (err.appCode === 'NAME_DUPLICATE')  return { success: false, code: 'NAME_DUPLICATE' };
        if (err.appCode === 'PHONE_DUPLICATE') return { success: false, code: 'PHONE_DUPLICATE' };
        if (err.appCode === 'PHONE_INVALID') return { success: false, code: 'PHONE_INVALID' };
        if (err.appCode === 'PHONE_TOO_LONG') return { success: false, code: 'PHONE_TOO_LONG' };
        return { success: false, message: err.message };
      }
    }

    case 'toggleCustomerStatus': {
      try {
        await db.toggleCustomerStatus(payload.id, payload.isActive);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deleteCustomer': {
      try {
        await db.deleteCustomer(payload.id);
        return { success: true };
      } catch (err) {
        const msg = String(err.message || err);
        let friendly = 'حدث خطأ أثناء الحذف';
        if (msg.includes('foreign key constraint fails')) {
          if (msg.includes('customer_subscriptions')) {
            friendly = 'لا يمكن حذف العميل لأنه مرتبط باشتراك';
          } else if (msg.includes('orders')) {
            friendly = 'لا يمكن حذف العميل لأنه مرتبط بفواتير';
          } else {
            friendly = 'لا يمكن حذف العميل لأنه مرتبط ببيانات أخرى';
          }
        }
        return { success: false, message: friendly };
      }
    }

    case 'getExpenses': {
      try {
        const result = await db.getAllExpenses(payload || {});
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getExpensesSummary': {
      try {
        const summary = await db.getExpensesSummary(payload || {});
        return { success: true, summary };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createExpense': {
      try {
        const id = await db.createExpense(payload);
        return { success: true, id };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'updateExpense': {
      try {
        await db.updateExpense(payload);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deleteExpense': {
      try {
        await db.deleteExpense(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getLaundryServices': {
      try {
        const result = await db.getAllLaundryServices(payload || {});
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createLaundryService': {
      try {
        const id = await db.createLaundryService(payload);
        return { success: true, id };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'updateLaundryService': {
      try {
        await db.updateLaundryService(payload);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deleteLaundryService': {
      try {
        await db.deleteLaundryService(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'toggleLaundryServiceStatus': {
      try {
        await db.setLaundryServiceActive(payload.id, payload.isActive);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'reorderLaundryService': {
      try {
        return await db.reorderLaundryServiceRelative(payload);
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getProducts': {
      try {
        const result = await db.getProducts(payload || {});
        if (result.products && result.products.length) {
          const ids = result.products
            .filter((p) => Number(p.has_image) === 1 || p.has_image === true)
            .map((p) => p.id);
          if (ids.length) {
            const rows = await db.getProductImageRowsByIds(ids);
            const byId = new Map(rows.map((r) => [r.id, r]));
            for (const p of result.products) {
              const row = byId.get(p.id);
              if (!row || !row.image_blob) continue;
              try {
                const raw = zlib.gunzipSync(row.image_blob);
                p.imageDataUrl = `data:${row.image_mime || 'application/octet-stream'};base64,${raw.toString('base64')}`;
              } catch (_) {
                p.imageDataUrl = null;
              }
            }
          }
        }
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getProduct': {
      try {
        const data = await db.getProductById(payload.id);
        if (!data) return { success: false, message: 'المنتج غير موجود' };
        let imageDataUrl = null;
        if (data.imageGzipBuffer && data.product.image_mime) {
          try {
            const raw = zlib.gunzipSync(data.imageGzipBuffer);
            imageDataUrl = `data:${data.product.image_mime};base64,${raw.toString('base64')}`;
          } catch (_) {}
        }
        return {
          success: true,
          product: data.product,
          priceLines: data.priceLines,
          imageDataUrl
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'saveProduct': {
      try {
        const data = payload;
        const savePayload = {
          id: data.id,
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          isActive: data.isActive,
          priceLines: data.priceLines
        };
        if (data.removeImage === true) {
          savePayload.clearImage = true;
        } else if (data.imageBase64) {
          const raw = Buffer.from(data.imageBase64, 'base64');
          if (raw.length > MAX_PRODUCT_IMAGE_RAW_BYTES) {
            return { success: false, message: 'حجم الملف كبير جداً (الحد 15 ميجابايت)' };
          }
          savePayload.imageGzipBuffer = zlib.gzipSync(raw, { level: 9 });
          savePayload.imageMime = data.imageMime || 'application/octet-stream';
        }
        const result = await db.saveProduct(savePayload);
        return { success: true, ...result };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
          return { success: false, message: 'تكرار: نفس العملية لهذا المنتج مسجلة مسبقاً' };
        }
        return { success: false, message: err.message };
      }
    }

    case 'deleteProduct': {
      try {
        await db.deleteProduct(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'toggleProductStatus': {
      try {
        await db.setProductActive(payload.id, payload.isActive);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'reorderProduct': {
      try {
        return await db.reorderProductRelative(payload);
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getPrepaidPackages': {
      try {
        const packages = await db.getAllPrepaidPackages(payload || {});
        return { success: true, packages };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'savePrepaidPackage': {
      try {
        const result = await db.savePrepaidPackage(payload);
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'togglePrepaidPackage': {
      try {
        await db.togglePrepaidPackageActive(payload.id, payload.isActive);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deletePrepaidPackage': {
      try {
        await db.deletePrepaidPackage(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getCustomerActiveSubscription': {
      try {
        const sub = await db.getCustomerActiveSubscription(payload && payload.customerId);
        return { success: true, subscription: sub || null };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getCustomerSubscriptionsList': {
      try {
        const result = await db.getCustomerSubscriptionsList(payload || {});
        if (Array.isArray(result)) {
          return { success: true, subscriptions: result };
        }
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getSubscriptionDetail': {
      try {
        const row = await db.getSubscriptionDetail(payload.id);
        if (!row) return { success: false, message: 'الاشتراك غير موجود' };
        return { success: true, subscription: row };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getSubscriptionPeriods': {
      try {
        const periods = await db.getSubscriptionPeriods(payload.subscriptionId);
        return { success: true, periods };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getSubscriptionLedger': {
      try {
        const ledger = await db.getSubscriptionLedgerBySubscription(payload.subscriptionId);
        return { success: true, ledger };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createSubscription': {
      try {
        const result = await db.createSubscription(payload);
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'renewSubscription': {
      try {
        const result = await db.renewSubscription(payload);
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'stopSubscription': {
      try {
        await db.stopSubscription(payload.subscriptionId);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'resumeSubscription': {
      try {
        await db.resumeSubscription(payload.subscriptionId);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'updateActiveSubscriptionPeriod': {
      try {
        const result = await db.updateActiveSubscriptionPeriod(payload);
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deleteSubscription': {
      try {
        await db.deleteSubscription(payload.subscriptionId);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getPosProducts': {
      try {
        const products = await db.getPosProducts();
        // لا نحمل الصور هنا - سيتم تحميلها عند الطلب (lazy loading)
        return { success: true, products };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getPosProductImage': {
      try {
        const { productId } = payload;
        if (!productId) {
          return { success: false, message: 'Product ID required' };
        }
        const rows = await db.getProductImageRowsByIds([productId]);
        if (!rows || rows.length === 0) {
          return { success: true, imageDataUrl: null };
        }
        const row = rows[0];
        if (!row.image_blob) {
          return { success: true, imageDataUrl: null };
        }
        try {
          const raw = zlib.gunzipSync(row.image_blob);
          const imageDataUrl = `data:${row.image_mime || 'image/jpeg'};base64,${raw.toString('base64')}`;
          return { success: true, imageDataUrl };
        } catch (err) {
          return { success: true, imageDataUrl: null };
        }
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getPosProductImages': {
      try {
        const ids = (payload && Array.isArray(payload.productIds)) ? payload.productIds : [];
        if (!ids.length) return { success: true, images: {} };
        const rows = await db.getProductImageRowsByIds(ids);
        const images = {};
        for (const row of rows || []) {
          if (!row || !row.image_blob) continue;
          try {
            const raw = zlib.gunzipSync(row.image_blob);
            images[row.id] = `data:${row.image_mime || 'image/jpeg'};base64,${raw.toString('base64')}`;
          } catch (_) {
            images[row.id] = null;
          }
        }
        // Fill missing IDs with null so client caches the negative result too
        for (const id of ids) {
          if (!(id in images)) images[id] = null;
        }
        return { success: true, images };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getPosServices': {
      try {
        const services = await db.getPosServices();
        return { success: true, services };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createOrder': {
      try {
        const orderNumber = await db.generateOrderNumber();
        // جلب إعداد السماح بالمديونية
        const settings = await db.getAppSettings();
        const result = await db.createOrder({
          ...payload,
          orderNumber,
          paidCash: (payload && payload.paidCash) || 0,
          paidCard: (payload && payload.paidCard) || 0,
          extraAmount: (payload && payload.extraAmount) || 0,
          starch: (payload && payload.starch) || '',
          bluing: (payload && payload.bluing) || '',
          createdBy: _user && _user.username ? _user.username : null,
          allowSubscriptionDebt: settings && settings.allowSubscriptionDebt === true
        });
        // إرسال تلقائي لـ ZATCA إذا كان الربط مفعل
        if (settings && settings.zatcaEnabled && result && result.id) {
          setImmediate(async () => {
            try {
              const bridge = LocalZatcaBridge.getInstance();
              await bridge.submitOrderById(result.id);
            } catch (_) { /* فشل صامت — المجدول سيعيد المحاولة */ }
          });
        }
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getOrders': {
      try {
        const result = await db.getOrders(payload || {});
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getOrdersBySubscription': {
      try {
        const orders = await db.getOrdersBySubscription(payload && payload.subscriptionId);
        return { success: true, orders };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getSubscriptionInvoices': {
      try {
        const result = await db.getSubscriptionInvoices(payload || {});
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getOrderById': {
      try {
        const data = await db.getOrderById(payload.id);
        if (!data) return { success: false, message: 'الفاتورة غير موجودة' };
        return { success: true, ...data };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getDeferredOrders': {
      try {
        const rows = await db.getDeferredOrders({
          search: (payload && payload.search) || '',
          statusFilter: (payload && payload.statusFilter) || 'unpaid',
        });
        return { success: true, orders: rows };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'payDeferredOrder': {
      try {
        await db.payDeferredOrder({
          orderId: payload && payload.orderId,
          paymentMethod: (payload && payload.paymentMethod) || 'cash',
          paidCash: (payload && payload.paidCash) || 0,
          paidCard: (payload && payload.paidCard) || 0,
        });
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getInvoiceWithPayments': {
      try {
        const result = await db.getInvoiceWithPayments(payload && payload.orderId);
        return result;
      } catch (err) {
        return { success: false, message: err.message, code: err.appCode };
      }
    }

    case 'recordInvoicePayment': {
      try {
        const createdBy = (_user && (_user.username || _user.name)) || 'system';
        const result = await db.recordInvoicePayment({
          orderId: payload && payload.orderId,
          paymentAmount: payload && payload.paymentAmount,
          paymentMethod: (payload && payload.paymentMethod) || 'cash',
          cashAmount: (payload && payload.cashAmount) || 0,
          cardAmount: (payload && payload.cardAmount) || 0,
          notes: (payload && payload.notes) || null,
          createdBy,
        });
        return result;
      } catch (err) {
        return { success: false, message: err.message, code: err.appCode };
      }
    }

    case 'getPaymentHistory': {
      try {
        const payments = await db.getPaymentHistory(payload && payload.orderId);
        return { success: true, payments };
      } catch (err) {
        return { success: false, message: err.message, code: err.appCode };
      }
    }

    case 'getInvoiceBySeq': {
      try {
        const result = await db.getInvoiceBySeq(payload && payload.invoiceSeq);
        return result;
      } catch (err) {
        return { success: false, message: err.message, code: err.appCode };
      }
    }

    case 'createCreditNote': {
      try {
        const createdBy = (_user && (_user.username || _user.name)) || 'system';
        const p = payload || {};
        const result = await db.createCreditNote({
          originalOrderId: p.originalOrderId,
          customerId: p.customerId || null,
          subtotal: p.subtotal || 0,
          discountAmount: p.discountAmount || 0,
          extraAmount: p.extraAmount || 0,
          vatRate: p.vatRate || 15,
          vatAmount: p.vatAmount || 0,
          totalAmount: p.totalAmount || 0,
          items: p.items || [],
          notes: p.notes || null,
          createdBy,
          priceDisplayMode: p.priceDisplayMode || 'exclusive'
        });
        return result;
      } catch (err) {
        return { success: false, message: err.message, code: err.appCode };
      }
    }

    case 'getCreditNotes': {
      try {
        const result = await db.getCreditNotes(payload || {});
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getCreditNoteById': {
      try {
        const data = await db.getCreditNoteById(payload && payload.id);
        if (!data) return { success: false, message: 'إشعار الدائن غير موجود' };
        return { success: true, ...data };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'markOrderCleaned': {
      try {
        await db.markOrderCleaned({ orderId: payload && payload.orderId });
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'markOrderDelivered': {
      try {
        await db.markOrderDelivered({ orderId: payload && payload.orderId });
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'generateZatcaQR': {
      try {
        let { sellerName, vatNumber, timestamp, totalAmount, vatAmount, tlvBase64 } = payload || {};

        // If a pre-built TLV base64 is provided (e.g. from DB), use it directly
        if (tlvBase64) {
          const svg = await QRCode.toString(tlvBase64, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 120,
          });
          return { success: true, svg };
        }

        // Prefer ZATCA settings from DB over payload values
        try {
          const zs = await db.getZatcaSettings();
          if (zs && zs.companyName) sellerName = zs.companyName;
          if (zs && zs.vatNumber) vatNumber = zs.vatNumber;
        } catch (_) {}

        // Build ZATCA TLV structure
        function encodeTag(tag, value) {
          const bytes = Buffer.from(String(value || ''), 'utf8');
          const out = Buffer.alloc(2 + bytes.length);
          out[0] = tag;
          out[1] = bytes.length;
          bytes.copy(out, 2);
          return out;
        }

        const parts = [
          encodeTag(1, sellerName || ''),
          encodeTag(2, vatNumber || ''),
          encodeTag(3, timestamp || ''),
          encodeTag(4, totalAmount || '0.00'),
          encodeTag(5, vatAmount || '0.00'),
        ];

        const tlvBuffer = Buffer.concat(parts);
        const b64 = tlvBuffer.toString('base64');

        // Generate QR SVG using the reliable qrcode library
        const svg = await QRCode.toString(b64, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 120,
        });

        return { success: true, svg };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getHangers': {
      try {
        const rows = await db.getAllHangers(payload || {});
        return { success: true, hangers: rows };
      } catch (err) {
        console.error('[API] getHangers error:', err);
        return { success: false, message: err.message };
      }
    }

    case 'getAvailableHangers': {
      try {
        const rows = await db.getAvailableHangers();
        return { success: true, hangers: rows };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createHanger': {
      try {
        const id = await db.createHanger(payload);
        return { success: true, id };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return { success: false, message: 'رقم الشماعة موجود بالفعل' };
        return { success: false, message: err.message };
      }
    }

    case 'batchCreateHangers': {
      try {
        const result = await db.batchCreateHangers(payload.from, payload.to);
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'updateHanger': {
      try {
        await db.updateHanger(payload);
        return { success: true };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return { success: false, message: 'رقم الشماعة موجود بالفعل' };
        return { success: false, message: err.message };
      }
    }

    case 'deleteHanger': {
      try {
        await db.deleteHanger(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'toggleHangerStatus': {
      try {
        await db.setHangerStatus(payload.id, payload.status);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getOffers': {
      try {
        const offers = await db.getAllOffers();
        return { success: true, offers };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getActiveOffers': {
      try {
        const offers = await db.getActiveOffers();
        return { success: true, offers };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'createOffer': {
      try {
        const result = await db.createOffer(payload);
        return { success: true, ...result };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'updateOffer': {
      try {
        await db.updateOffer(payload);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'toggleOffer': {
      try {
        await db.toggleOfferStatus(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'deleteOffer': {
      try {
        await db.deleteOffer(payload.id);
        return { success: true };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getReportData': {
      try {
        const data = await db.getReportData(payload || {});
        return { success: true, ...data };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getAllInvoicesReport': {
      try {
        const data = await db.getAllInvoicesReport(payload || {});
        return { success: true, ...data };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'getSubscriptionsReport': {
      try {
        const data = await db.getSubscriptionsReport(payload || {});
        return { success: true, ...data };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'zatcaSubmitOrder': {
      try {
        const { orderId } = payload || {};
        if (!orderId) return { success: false, message: 'معرّف الفاتورة مطلوب' };

        const bridge = LocalZatcaBridge.getInstance();
        const result = await bridge.submitOrderById(orderId);
        return { success: result.success, ...result };
      } catch (err) {
        console.error('[zatcaSubmitOrder]', err);
        return { success: false, message: err.message };
      }
    }

    case 'zatcaSubmitCreditNote': {
      try {
        const { cnId } = payload || {};
        if (!cnId) return { success: false, message: 'معرّف الإشعار الدائن مطلوب' };

        const bridge = LocalZatcaBridge.getInstance();
        const result = await bridge.submitCreditNoteById(cnId);
        return { success: result.success, ...result };
      } catch (err) {
        console.error('[zatcaSubmitCreditNote]', err);
        return { success: false, message: err.message };
      }
    }

    case 'zatcaGetUnsentOrders': {
      try {
        const ids = await db.getUnsentZatcaOrders(500);
        return { success: true, orderIds: ids };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }

    case 'zatcaRetryUnsent': {
      try {
        const appSettings = await db.getAppSettings();
        if (!appSettings || !appSettings.zatcaEnabled) {
          return { success: false, message: 'الربط الإلكتروني غير مفعل' };
        }
        const ids = await db.getUnsentZatcaOrders(500);
        const bridge = LocalZatcaBridge.getInstance();
        const results = [];
        for (const id of ids) {
          try {
            const r = await bridge.submitOrderById(id);
            results.push({ id, success: r.success, status: r.status });
          } catch (e) {
            results.push({ id, success: false, error: e.message });
          }
          // 5 second delay between submissions
          await new Promise(res => setTimeout(res, 5000));
        }
        return { success: true, processed: results.length, results };
      } catch (err) {
        console.error('[zatcaRetryUnsent]', err);
        return { success: false, message: err.message };
      }
    }

    default:
      return { success: false, message: `طريقة غير معروفة: ${m}` };
  }
}

if (
  typeof db.stopSubscription !== 'function' ||
  typeof db.resumeSubscription !== 'function' ||
  typeof db.updateActiveSubscriptionPeriod !== 'function'
) {
  console.error(
    '[invokeHandlers] database/db.js ناقص (stopSubscription / resumeSubscription / updateActiveSubscriptionPeriod) — انسخ أحدث db.js وأعد تشغيل الخادم.'
  );
}

module.exports = { invoke };
