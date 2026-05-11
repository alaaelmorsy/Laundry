const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

function toSqlDate(v) {
  if (!v) return null;
  if (v instanceof Date) {
    const p = (x) => String(x).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth()+1)}-${p(v.getDate())}`;
  }
  return String(v).replace('T', ' ').slice(0, 10);
}
function toSqlDateTime(v) {
  if (!v) return null;
  if (v instanceof Date) {
    const p = (x) => String(x).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth()+1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  return String(v).replace('T', ' ').slice(0, 19);
}
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;
const bcryptHash = promisify(bcrypt.hash);
const bcryptCompare = promisify(bcrypt.compare);

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'Db2@dm1n2022',
  port: parseInt(process.env.DB_PORT || '3306', 10)
};

const DB_NAME = process.env.DB_NAME || 'laundry_db';

async function hashPassword(plain) {
  return bcryptHash(plain, BCRYPT_ROUNDS);
}

let pool = null;

async function initialize() {
  const tempConn = await mysql.createConnection(DB_CONFIG);

  await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await tempConn.end();

  pool = mysql.createPool({
    ...DB_CONFIG,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  await createTables();
  await migrateCustomersPhoneWiden();
  await migrateProductPriceLinesRemoveCustomer();
  await migrateProductsBlobAndNameEn();
  await migrateLaundryServicesToMinimal();
  await ensureLaundryServicesIsActiveColumn();
  await ensureManualSortOrderColumns();
  await ensureSubscriptionEndDateColumn();
  await migrateSubscriptionNumberNullable();
  await migrateSubscriptionPeriodToNullable();
  await migrateAppSettings();
  await seedDefaultUser();
  await seedLaundryServices();
  await backfillSortOrderIfNeeded();
  await refreshExpiredSubscriptionPeriods();
  await createOrdersTables();
  await migrateOrdersZatcaColumns();
  await migrateOrdersDeferredColumns();
  await migratePartialInvoicePayments();
  await migrateMixedPaymentColumns();
  await migrateMixedPaymentInvoiceColumns();
  await migrateOrdersPerformanceIndexes();
  await backfillSettledCreditPaymentMethod();
  await backfillSubscriptionPaymentMethod();
  await migrateOrdersHangerColumn();
  await migrateAppSettingsRequireHanger();
  await migrateAppSettingsRequireCustomerPhone();
  await migrateAppSettingsAllowSubscriptionDebt();
  await migrateAppSettingsBarcodeAutoAction();
  await migrateAppSettingsShowBarcodeInInvoice();
  await migrateSubscriptionPeriodsCreatedAt();
  await createCreditNotesTable();
  await createOffersTable();
  await migrateZatcaSettings();
}

async function migrateOrdersZatcaColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const set = new Set(cols.map(r => r.COLUMN_NAME));
    if (!set.has('zatca_uuid')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_uuid VARCHAR(100) DEFAULT NULL`);
    }
    if (!set.has('zatca_hash')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_hash VARCHAR(255) DEFAULT NULL`);
    }
    if (!set.has('zatca_qr')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_qr TEXT DEFAULT NULL`);
    }
    if (!set.has('zatca_submitted')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_submitted DATETIME DEFAULT NULL`);
    }
    if (!set.has('zatca_status')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_status ENUM('pending','submitted','accepted','rejected') DEFAULT 'pending'`);
    }
    if (!set.has('zatca_rejection_reason')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_rejection_reason TEXT DEFAULT NULL`);
    }
    if (!set.has('zatca_response')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN zatca_response LONGTEXT DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrateOrdersZatcaColumns:', e);
  }
}

async function migrateZatcaSettings() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS zatca_settings (
      id INT NOT NULL PRIMARY KEY,
      company_name VARCHAR(200) DEFAULT NULL,
      vat_number VARCHAR(50) DEFAULT NULL,
      commercial_registration VARCHAR(50) DEFAULT NULL,
      business_category VARCHAR(120) NOT NULL DEFAULT 'Supply activities',
      branch_name VARCHAR(150) DEFAULT NULL,
      email VARCHAR(150) DEFAULT NULL,
      street VARCHAR(200) DEFAULT NULL,
      building VARCHAR(50) DEFAULT NULL,
      city VARCHAR(100) NOT NULL DEFAULT 'الرياض',
      postal_code VARCHAR(20) DEFAULT NULL,
      district VARCHAR(120) DEFAULT NULL,
      local_api_endpoint TEXT DEFAULT NULL,
      local_api_param_name VARCHAR(50) DEFAULT 'invoiceJO',
      local_api_param_aliases_json JSON DEFAULT NULL,
      local_api_preferred_mode VARCHAR(30) DEFAULT 'form',
      local_api_enable_text_plain TINYINT(1) NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(
    'ALTER TABLE zatca_settings MODIFY COLUMN company_name VARCHAR(200) DEFAULT NULL'
  ).catch(() => {});
  await pool.query(
    'ALTER TABLE zatca_settings MODIFY COLUMN vat_number VARCHAR(50) DEFAULT NULL'
  ).catch(() => {});

  // Local API columns (add if missing)
  const localCols = [
    ['local_api_endpoint', 'TEXT DEFAULT NULL'],
    ['local_api_param_name', "VARCHAR(50) DEFAULT 'invoiceJO'"],
    ['local_api_param_aliases_json', 'JSON DEFAULT NULL'],
    ['local_api_preferred_mode', "VARCHAR(30) DEFAULT 'form'"],
    ['local_api_enable_text_plain', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ];
  for (const [col, def] of localCols) {
    await pool.query(`ALTER TABLE zatca_settings ADD COLUMN ${col} ${def}`).catch(() => {});
  }

  const [[cnt]] = await pool.query('SELECT COUNT(*) AS c FROM zatca_settings WHERE id = 1');
  if (Number(cnt.c) === 0) {
    await pool.query(
      `INSERT INTO zatca_settings (
        id, company_name, vat_number, commercial_registration, business_category,
        branch_name, email, street, building, city, postal_code, district,
        local_api_endpoint, local_api_param_name, local_api_param_aliases_json, local_api_preferred_mode, local_api_enable_text_plain
      ) VALUES (1, NULL, NULL, NULL, 'Supply activities', NULL, NULL, NULL, NULL, 'الرياض', NULL, NULL,
               'http://localhost:8080/zatca_2/api/customerInvoice/submitInvoice', 'invoiceJO',
               JSON_ARRAY('invoiceJO','invoiceIO','invoiceIo','invoiceJson','invoice','data','payload'),
               'form', 0)`
    );
  }

  // Migrate legacy api_base_url → local_api_endpoint if present
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'zatca_settings'`
    );
    const set = new Set(cols.map(r => r.COLUMN_NAME));
    if (set.has('api_base_url') && set.has('local_api_endpoint')) {
      const [[row]] = await pool.query('SELECT api_base_url, local_api_endpoint FROM zatca_settings WHERE id = 1');
      const legacy = row && row.api_base_url ? String(row.api_base_url).trim() : '';
      const current = row && row.local_api_endpoint ? String(row.local_api_endpoint).trim() : '';
      if (legacy && !current) {
        const base = legacy.replace(/\/+$/, '');
        const endpoint = base.endsWith('/customerInvoice/submitInvoice')
          ? base
          : `${base}/customerInvoice/submitInvoice`;
        await pool.query('UPDATE zatca_settings SET local_api_endpoint = ? WHERE id = 1', [endpoint]);
      }
    }
  } catch (_) {}

  // Drop legacy Phase 2 direct-integration columns (user requested)
  const dropCols = [
    'environment', 'api_base_url', 'csid', 'ccsid', 'pih', 'secret',
    'private_key_pem', 'csr_pem', 'onboarding_completed'
  ];
  for (const c of dropCols) {
    try {
      await pool.query(`ALTER TABLE zatca_settings DROP COLUMN ${c}`);
    } catch (_) {}
  }

  // Migrate preferred_mode from json-raw to form (server only accepts form-urlencoded)
  try {
    await pool.query(
      `UPDATE zatca_settings SET local_api_preferred_mode = 'form' WHERE local_api_preferred_mode = 'json-raw' OR local_api_preferred_mode IS NULL`
    );
  } catch (_) {}
}

async function getZatcaSettings() {
  await migrateZatcaSettings();
  const [[row]] = await pool.query(
    `SELECT id, company_name, vat_number, commercial_registration, business_category,
            branch_name, email, street, building, city, postal_code, district,
            local_api_endpoint, local_api_param_name, local_api_param_aliases_json,
            local_api_preferred_mode, local_api_enable_text_plain,
            updated_at
     FROM zatca_settings WHERE id = 1`
  );
  if (!row) {
    await migrateZatcaSettings();
    return getZatcaSettings();
  }
  return {
    id: row.id,
    companyName: row.company_name || '',
    vatNumber: row.vat_number || '',
    commercialRegistration: row.commercial_registration || '',
    businessCategory: row.business_category || 'Supply activities',
    branchName: row.branch_name || '',
    email: row.email || '',
    address: {
      street: row.street || '',
      building: row.building || '',
      city: row.city || 'الرياض',
      postalCode: row.postal_code || '',
      district: row.district || ''
    },
    localApi: {
      endpoint: row.local_api_endpoint || '',
      paramName: row.local_api_param_name || 'invoiceJO',
      paramAliases: (() => {
        try {
          const parsed = typeof row.local_api_param_aliases_json === 'string'
            ? JSON.parse(row.local_api_param_aliases_json)
            : row.local_api_param_aliases_json;
          return Array.isArray(parsed) ? parsed : ['invoiceJO','invoiceIO','invoiceIo','invoiceJson','invoice','data','payload'];
        } catch {
          return ['invoiceJO','invoiceIO','invoiceIo','invoiceJson','invoice','data','payload'];
        }
      })(),
      preferredMode: row.local_api_preferred_mode || 'form',
      enableTextPlain: row.local_api_enable_text_plain === 1,
    },
    updatedAt: row.updated_at
  };
}

async function saveZatcaSettings(data = {}) {
  await migrateZatcaSettings();
  const s = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));

  const companyName = s(data.companyName, 200);
  const vatNumber = s(data.vatNumber, 50);
  if (!companyName) throw new Error('اسم المنشأة مطلوب');
  if (!vatNumber) throw new Error('رقم التسجيل الضريبي مطلوب');

  // KSA VAT: 15 digits (often starts with 3 and ends with 3)
  const vatDigits = vatNumber.replace(/\D/g, '');
  if (vatDigits.length !== 15) {
    throw new Error('رقم التسجيل الضريبي يجب أن يكون 15 رقم');
  }
  if (!(vatDigits.startsWith('3') && vatDigits.endsWith('3'))) {
    throw new Error('رقم التسجيل الضريبي غير صالح');
  }

  const commercialRegistration = s(data.commercialRegistration, 50) || null;
  const businessCategory = s(data.businessCategory, 120) || 'Supply activities';
  const branchName = s(data.branchName, 150) || null;
  const emailRaw = s(data.email, 150);
  const email = emailRaw ? emailRaw : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('البريد الإلكتروني غير صالح');
  }

  const addr = data.address && typeof data.address === 'object' ? data.address : {};
  const street = s(addr.street, 200) || null;
  const building = s(addr.building, 50) || null;
  const city = s(addr.city, 100) || 'الرياض';
  const postalCode = s(addr.postalCode, 20) || null;
  const district = s(addr.district, 120) || null;

  const localApi = data.localApi && typeof data.localApi === 'object' ? data.localApi : {};
  const localApiEndpoint = s(localApi.endpoint, 5000) || null;
  const localApiParamName = s(localApi.paramName, 50) || 'invoiceJO';
  const localApiPreferredMode = (() => {
    const v = String(localApi.preferredMode || 'json-raw').trim();
    const allowed = new Set(['json-raw', 'json-wrapped', 'json-wrapped-string', 'form', 'multipart', 'text-plain']);
    return allowed.has(v) ? v : 'json-raw';
  })();
  const localApiEnableTextPlain = localApi.enableTextPlain === true ? 1 : 0;
  const localApiParamAliases = Array.isArray(localApi.paramAliases)
    ? localApi.paramAliases.map(x => String(x || '').trim()).filter(Boolean).slice(0, 50)
    : ['invoiceJO', 'invoiceIO', 'invoiceIo', 'invoiceJson', 'invoice', 'data', 'payload'];
  const localApiParamAliasesJson = JSON.stringify(localApiParamAliases);

  await pool.query(
    `UPDATE zatca_settings SET
      company_name = ?, vat_number = ?, commercial_registration = ?, business_category = ?,
      branch_name = ?, email = ?, street = ?, building = ?, city = ?, postal_code = ?, district = ?,
      local_api_endpoint = ?, local_api_param_name = ?, local_api_param_aliases_json = CAST(? AS JSON),
      local_api_preferred_mode = ?, local_api_enable_text_plain = ?
     WHERE id = 1`,
    [
      companyName,
      vatNumber,
      commercialRegistration,
      businessCategory,
      branchName,
      email,
      street,
      building,
      city,
      postalCode,
      district,

      localApiEndpoint,
      localApiParamName,
      localApiParamAliasesJson,
      localApiPreferredMode,
      localApiEnableTextPlain
    ]
  );
  return { success: true };
}

async function migrateOrdersPerformanceIndexes() {
  try {
    const [idx] = await pool.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const names = new Set(idx.map(r => r.INDEX_NAME));

    const ensure = async (name, sql) => {
      if (!names.has(name)) {
        await pool.query(sql).catch(e => console.error('index ' + name + ':', e.message));
      }
    };

    await ensure('idx_orders_customer_id',
      `CREATE INDEX idx_orders_customer_id ON orders (customer_id)`);
    await ensure('idx_orders_invoice_seq',
      `CREATE INDEX idx_orders_invoice_seq ON orders (invoice_seq)`);
    await ensure('idx_orders_created_at',
      `CREATE INDEX idx_orders_created_at ON orders (created_at)`);
    await ensure('idx_orders_payment_status_created',
      `CREATE INDEX idx_orders_payment_status_created ON orders (payment_status, created_at)`);
    await ensure('idx_orders_status_id',
      `CREATE INDEX idx_orders_status_id ON orders (payment_status, id)`);
    await ensure('idx_orders_customer_status',
      `CREATE INDEX idx_orders_customer_status ON orders (customer_id, payment_status)`);
    await ensure('idx_orders_paid_at',
      `CREATE INDEX idx_orders_paid_at ON orders (paid_at)`);
    await ensure('idx_orders_fully_paid_at',
      `CREATE INDEX idx_orders_fully_paid_at ON orders (fully_paid_at)`);

    // invoice_payments: ensure method+order index for aggregation
    const [ipIdx] = await pool.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'invoice_payments'`
    );
    const ipNames = new Set(ipIdx.map(r => r.INDEX_NAME));
    if (!ipNames.has('idx_ip_order_method')) {
      await pool.query(
        `CREATE INDEX idx_ip_order_method ON invoice_payments (order_id, payment_method)`
      ).catch(e => console.error('idx_ip_order_method:', e.message));
    }

    // customers: help joins/search
    const [custIdx] = await pool.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'customers'`
    );
    const custNames = new Set(custIdx.map(r => r.INDEX_NAME));
    if (!custNames.has('idx_customers_phone')) {
      await pool.query(
        `CREATE INDEX idx_customers_phone ON customers (phone)`
      ).catch(e => console.error('idx_customers_phone:', e.message));
    }

    // order_items
    const [oiIdx] = await pool.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'order_items'`
    );
    const oiNames = new Set(oiIdx.map(r => r.INDEX_NAME));
    if (!oiNames.has('idx_oi_order_id')) {
      await pool.query(
        `CREATE INDEX idx_oi_order_id ON order_items (order_id)`
      ).catch(e => console.error('idx_oi_order_id:', e.message));
    }
  } catch (e) {
    console.error('migrateOrdersPerformanceIndexes:', e);
  }
}

async function updateReportEmailLastResult(data = {}) {
  await migrateAppSettings();
  const status = data.status ? String(data.status).slice(0, 20) : null;
  const err = data.error ? String(data.error).slice(0, 5000) : null;
  const sentAt = data.sentAt instanceof Date
    ? data.sentAt
    : (data.sentAt ? new Date(data.sentAt) : null);
  await pool.query(
    `UPDATE app_settings
     SET report_email_last_status = ?, report_email_last_error = ?, report_email_last_sent_at = ?
     WHERE id = 1`,
    [status, err, sentAt && !isNaN(sentAt.getTime()) ? sentAt : null]
  );
}

/**
 * Backfill payment_method / paid_cash / paid_card for fully-paid orders
 * that were settled via invoice_payments (partial payment flow) or
 * via payDeferredOrder but whose stored payment_method still says 'credit'.
 */
async function backfillSettledCreditPaymentMethod() {
  try {
    // 1) Aggregate cash/card from invoice_payments using CASE on payment_method
    //    (cash / card full value goes to its bucket; mixed uses cash_amount & card_amount)
    await pool.query(`
      UPDATE orders o
      LEFT JOIN (
        SELECT
          order_id,
          SUM(CASE
                WHEN payment_method = 'cash'  THEN payment_amount
                WHEN payment_method = 'mixed' THEN cash_amount
                ELSE 0
              END) AS tot_cash,
          SUM(CASE
                WHEN payment_method = 'card'  THEN payment_amount
                WHEN payment_method = 'mixed' THEN card_amount
                ELSE 0
              END) AS tot_card
        FROM invoice_payments
        GROUP BY order_id
      ) ip ON ip.order_id = o.id
      SET
        o.paid_cash = GREATEST(o.paid_cash, COALESCE(ip.tot_cash, 0)),
        o.paid_card = GREATEST(o.paid_card, COALESCE(ip.tot_card, 0))
      WHERE o.payment_status = 'paid'
        AND (ip.tot_cash IS NOT NULL OR ip.tot_card IS NOT NULL)
    `).catch(() => {});

    // 2) Fix payment_method for paid orders whose stored method is still 'credit'
    await pool.query(`
      UPDATE orders
      SET payment_method = CASE
        WHEN paid_cash > 0 AND paid_card > 0 THEN 'mixed'
        WHEN paid_cash > 0 AND paid_card = 0 THEN 'cash'
        WHEN paid_card > 0 AND paid_cash = 0 THEN 'card'
        ELSE payment_method
      END
      WHERE payment_status = 'paid' AND payment_method = 'credit'
    `).catch(() => {});
  } catch (e) {
    console.error('backfillSettledCreditPaymentMethod:', e);
  }
}

/**
 * Backfill payment_method = 'subscription' for orders that were fully paid
 * by subscription credit (have a subscription_ledger consumption entry).
 */
async function backfillSubscriptionPaymentMethod() {
  try {
    const [result] = await pool.query(`
      UPDATE orders o
      INNER JOIN subscription_ledger sl ON sl.ref_type = 'order' AND sl.ref_id = o.id
      SET o.payment_method = 'subscription'
      WHERE o.payment_method != 'subscription'
        AND sl.entry_type = 'consumption'
        AND sl.amount >= o.total_amount
    `);
    if (result && result.affectedRows > 0) {
      console.log(`[backfillSubscriptionPaymentMethod] Updated ${result.affectedRows} orders to payment_method='subscription'`);
    }
  } catch (e) {
    console.error('backfillSubscriptionPaymentMethod:', e);
  }
}

async function migrateOrdersHangerColumn() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'hanger_id'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN hanger_id INT DEFAULT NULL`);
      await pool.query(`
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_hanger
        FOREIGN KEY (hanger_id) REFERENCES hangers(id) ON DELETE SET NULL
      `).catch(() => {});
    }
  } catch (e) {
    console.error('migrateOrdersHangerColumn:', e);
  }
}

async function migrateAppSettingsRequireHanger() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'require_hanger'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE app_settings ADD COLUMN require_hanger TINYINT(1) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error('migrateAppSettingsRequireHanger:', e);
  }
}

async function migrateAppSettingsAllowSubscriptionDebt() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'allow_subscription_debt'
      `
    );
    if (!cols.length) {
      await pool.query(
        'ALTER TABLE app_settings ADD COLUMN allow_subscription_debt TINYINT(1) NOT NULL DEFAULT 0 AFTER require_customer_phone'
      );
    }
  } catch (_) {}
}

async function migrateAppSettingsBarcodeAutoAction() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'barcode_auto_action'`
    );
    if (!cols.length) {
      await pool.query(
        `ALTER TABLE app_settings ADD COLUMN barcode_auto_action VARCHAR(30) NOT NULL DEFAULT 'none' AFTER allow_subscription_debt`
      );
    }
  } catch (e) {
    console.error('migrateAppSettingsBarcodeAutoAction:', e);
  }
}

async function migrateAppSettingsShowBarcodeInInvoice() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'show_barcode_in_invoice'`
    );
    if (!cols.length) {
      await pool.query(
        `ALTER TABLE app_settings ADD COLUMN show_barcode_in_invoice TINYINT(1) NOT NULL DEFAULT 1 AFTER barcode_auto_action`
      );
    }
  } catch (e) {
    console.error('migrateAppSettingsShowBarcodeInInvoice:', e);
  }
}

async function migrateSubscriptionPeriodsCreatedAt() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'subscription_periods' AND column_name = 'created_at'`
    );
    if (!cols.length) {
      await pool.query(
        `ALTER TABLE subscription_periods ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
      );
    }
  } catch (e) {
    console.error('migrateSubscriptionPeriodsCreatedAt:', e);
  }
}

async function migrateAppSettingsRequireCustomerPhone() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'require_customer_phone'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE app_settings ADD COLUMN require_customer_phone TINYINT(1) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error('migrateAppSettingsRequireCustomerPhone:', e);
  }
}

async function migrateMixedPaymentColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    if (!colSet.has('paid_cash')) {
      await pool.query(
        `ALTER TABLE orders ADD COLUMN paid_cash DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER remaining_amount`
      );
    }
    if (!colSet.has('paid_card')) {
      await pool.query(
        `ALTER TABLE orders ADD COLUMN paid_card DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER paid_cash`
      );
    }
  } catch (e) {
    console.error('migrateMixedPaymentColumns:', e);
  }
}

async function migrateMixedPaymentInvoiceColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'invoice_payments'`
    );
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    if (!colSet.has('cash_amount')) {
      await pool.query(
        `ALTER TABLE invoice_payments ADD COLUMN cash_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER payment_method`
      );
    }
    if (!colSet.has('card_amount')) {
      await pool.query(
        `ALTER TABLE invoice_payments ADD COLUMN card_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER cash_amount`
      );
    }
  } catch (e) {
    console.error('migrateMixedPaymentInvoiceColumns:', e);
  }
}

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100),
      role ENUM('admin', 'cashier') DEFAULT 'cashier',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`
    ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'cashier') DEFAULT 'cashier'
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      subscription_number VARCHAR(20)  NOT NULL UNIQUE,
      customer_name       VARCHAR(100) NOT NULL,
      phone               VARCHAR(32)  NOT NULL,
      tax_number          VARCHAR(20)  DEFAULT NULL,
      national_id         VARCHAR(20)  DEFAULT NULL,
      address             TEXT         NOT NULL,
      city                VARCHAR(60)  NOT NULL,
      email               VARCHAR(100) DEFAULT NULL,
      customer_type       ENUM('individual','corporate') DEFAULT 'individual',
      notes               TEXT         DEFAULT NULL,
      is_active           TINYINT(1)   DEFAULT 1,
      created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      title         VARCHAR(200) NOT NULL,
      category      VARCHAR(100) NOT NULL DEFAULT 'عام',
      amount        DECIMAL(10,2) NOT NULL,
      is_taxable    TINYINT(1) DEFAULT 0,
      tax_rate      DECIMAL(5,2) DEFAULT 15.00,
      tax_amount    DECIMAL(10,2) DEFAULT 0.00,
      total_amount  DECIMAL(10,2) NOT NULL,
      expense_date  DATE NOT NULL,
      notes         TEXT DEFAULT NULL,
      created_by    VARCHAR(100) DEFAULT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date_id ON expenses (expense_date DESC, id DESC)
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customers_id ON customers (id ASC)
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customers_search ON customers (customer_name, phone, subscription_number)
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS laundry_services (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name_ar    VARCHAR(150) NOT NULL,
      name_en    VARCHAR(150) NOT NULL,
      is_active  TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name_ar    VARCHAR(200) NOT NULL,
      name_en    VARCHAR(200) DEFAULT NULL,
      image_blob LONGBLOB DEFAULT NULL,
      image_mime VARCHAR(255) DEFAULT NULL,
      is_active  TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_price_lines (
      id                   INT AUTO_INCREMENT PRIMARY KEY,
      product_id           INT NOT NULL,
      laundry_service_id   INT NOT NULL,
      price                DECIMAL(10,2) NOT NULL,
      CONSTRAINT fk_ppl_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      CONSTRAINT fk_ppl_service FOREIGN KEY (laundry_service_id) REFERENCES laundry_services(id) ON DELETE RESTRICT,
      UNIQUE KEY uq_product_service (product_id, laundry_service_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prepaid_packages (
      id                   INT AUTO_INCREMENT PRIMARY KEY,
      name_ar              VARCHAR(200) NOT NULL,
      prepaid_price        DECIMAL(10,2) NOT NULL,
      service_credit_value DECIMAL(10,2) NOT NULL,
      duration_days        INT NOT NULL DEFAULT 30,
      is_active            TINYINT(1) NOT NULL DEFAULT 1,
      sort_order           INT NOT NULL DEFAULT 0,
      notes                TEXT DEFAULT NULL,
      created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_subscriptions (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      customer_id         INT NOT NULL,
      subscription_ref    VARCHAR(24) NOT NULL UNIQUE,
      current_package_id  INT DEFAULT NULL,
      end_date            DATE DEFAULT NULL,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_cs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      CONSTRAINT fk_cs_package FOREIGN KEY (current_package_id) REFERENCES prepaid_packages(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_periods (
      id                         INT AUTO_INCREMENT PRIMARY KEY,
      customer_subscription_id   INT NOT NULL,
      package_id                 INT NOT NULL,
      period_from                DATETIME NOT NULL,
      period_to                  DATETIME DEFAULT NULL,
      prepaid_price_paid         DECIMAL(10,2) NOT NULL,
      credit_value_granted       DECIMAL(10,2) NOT NULL,
      credit_remaining           DECIMAL(10,2) NOT NULL,
      status                     ENUM('active','expired','closed') NOT NULL DEFAULT 'active',
      CONSTRAINT fk_sp_subscription FOREIGN KEY (customer_subscription_id) REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
      CONSTRAINT fk_sp_package FOREIGN KEY (package_id) REFERENCES prepaid_packages(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_ledger (
      id                      INT AUTO_INCREMENT PRIMARY KEY,
      subscription_period_id  INT NOT NULL,
      entry_type              ENUM('purchase','renewal','consumption','adjustment','refund') NOT NULL,
      amount                  DECIMAL(10,2) NOT NULL,
      balance_after           DECIMAL(10,2) NOT NULL,
      ref_type                VARCHAR(50) DEFAULT NULL,
      ref_id                  INT DEFAULT NULL,
      notes                   TEXT DEFAULT NULL,
      created_by              VARCHAR(100) DEFAULT NULL,
      created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sl_period FOREIGN KEY (subscription_period_id) REFERENCES subscription_periods(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cs_customer ON customer_subscriptions (customer_id)
  `).catch(() => {});
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sp_sub_status ON subscription_periods (customer_subscription_id, status)
  `).catch(() => {});
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sp_dates ON subscription_periods (period_from, period_to)
  `).catch(() => {});
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sl_period ON subscription_ledger (subscription_period_id)
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS hangers (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      hanger_number   VARCHAR(20)  NOT NULL UNIQUE,
      label           VARCHAR(100) DEFAULT NULL,
      status          ENUM('free','occupied','maintenance') DEFAULT 'free',
      notes           TEXT DEFAULT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_hangers_status ON hangers (status)
  `).catch(() => {});
}

async function migrateProductPriceLinesRemoveCustomer() {
  try {
    const [[t]] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'product_price_lines'`
    );
    if (!t.c) return;

    const [colRows] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'product_price_lines'`
    );
    const cols = new Set(colRows.map((r) => r.COLUMN_NAME));
    if (!cols.has('customer_id')) return;

    await pool.query('DROP TABLE IF EXISTS product_price_lines_new');
    await pool.query(`
      CREATE TABLE product_price_lines_new (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        product_id           INT NOT NULL,
        laundry_service_id   INT NOT NULL,
        price                DECIMAL(10,2) NOT NULL,
        CONSTRAINT fk_ppln_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_ppln_service FOREIGN KEY (laundry_service_id) REFERENCES laundry_services(id) ON DELETE RESTRICT,
        UNIQUE KEY uq_product_service_new (product_id, laundry_service_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`
      INSERT INTO product_price_lines_new (product_id, laundry_service_id, price)
      SELECT product_id, laundry_service_id, MIN(price)
      FROM product_price_lines
      GROUP BY product_id, laundry_service_id
    `);
    await pool.query('SET FOREIGN_KEY_CHECKS=0');
    await pool.query('DROP TABLE product_price_lines');
    await pool.query('RENAME TABLE product_price_lines_new TO product_price_lines');
    await pool.query('SET FOREIGN_KEY_CHECKS=1');
  } catch (e) {
    console.error('migrateProductPriceLinesRemoveCustomer:', e);
  }
}

async function migrateProductsBlobAndNameEn() {
  try {
    const [[t]] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'products'`
    );
    if (!t.c) return;

    const [colRows] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'`
    );
    const cols = new Set(colRows.map((r) => r.COLUMN_NAME));

    await pool.query('ALTER TABLE products MODIFY COLUMN name_en VARCHAR(200) DEFAULT NULL').catch(() => {});

    if (!cols.has('image_blob')) {
      await pool.query('ALTER TABLE products ADD COLUMN image_blob LONGBLOB DEFAULT NULL').catch(() => {});
    }
    if (!cols.has('image_mime')) {
      await pool.query('ALTER TABLE products ADD COLUMN image_mime VARCHAR(255) DEFAULT NULL').catch(() => {});
    }

    if (cols.has('image_path')) {
      const [prows] = await pool.query(
        'SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path <> \'\''
      );
      for (const p of prows) {
        try {
          const fp = p.image_path;
          if (!fp || !fs.existsSync(fp)) continue;
          const raw = fs.readFileSync(fp);
          const gz = zlib.gzipSync(raw, { level: 9 });
          const ext = path.extname(fp).toLowerCase();
          const mimeMap = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.tif': 'image/tiff',
            '.tiff': 'image/tiff'
          };
          const mime = mimeMap[ext] || 'application/octet-stream';
          await pool.query('UPDATE products SET image_blob=?, image_mime=? WHERE id=?', [gz, mime, p.id]);
        } catch (err) {
          console.error('migrate product image id', p.id, err);
        }
      }
      await pool.query('ALTER TABLE products DROP COLUMN image_path').catch(() => {});
    }
  } catch (e) {
    console.error('migrateProductsBlobAndNameEn:', e);
  }
}

async function ensureLaundryServicesIsActiveColumn() {
  try {
    const [colRows] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'laundry_services' AND COLUMN_NAME = 'is_active'`
    );
    if (colRows.length > 0) return;
    await pool.query(
      `ALTER TABLE laundry_services ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`
    );
  } catch (e) {
    console.error('ensureLaundryServicesIsActiveColumn:', e);
  }
}

async function ensureManualSortOrderColumns() {
  try {
    const [lsCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'laundry_services'`
    );
    const ls = new Set(lsCols.map((r) => r.COLUMN_NAME));
    if (!ls.has('sort_order')) {
      await pool.query(
        'ALTER TABLE laundry_services ADD COLUMN sort_order INT NOT NULL DEFAULT 0'
      ).catch(() => {});
    }

    const [pCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products'`
    );
    const ps = new Set(pCols.map((r) => r.COLUMN_NAME));
    if (!ps.has('sort_order')) {
      await pool.query(
        'ALTER TABLE products ADD COLUMN sort_order INT NOT NULL DEFAULT 0'
      ).catch(() => {});
    }
  } catch (e) {
    console.error('ensureManualSortOrderColumns:', e);
  }
}

async function backfillSortOrderIfNeeded() {
  async function fillTable(table) {
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS c, MIN(sort_order) AS mn, MAX(sort_order) AS mx FROM ${table}`
    );
    if (!stats.c || stats.mn !== 0 || stats.mx !== 0) return;
    const [rows] = await pool.query(`SELECT id FROM ${table} ORDER BY id ASC`);
    for (let i = 0; i < rows.length; i++) {
      await pool.query(`UPDATE ${table} SET sort_order=? WHERE id=?`, [i + 1, rows[i].id]);
    }
  }
  try {
    await fillTable('laundry_services');
    await fillTable('products');
  } catch (e) {
    console.error('backfillSortOrderIfNeeded:', e);
  }
}

async function migrateLaundryServicesToMinimal() {
  try {
    const [[t]] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'laundry_services'`
    );
    if (!t.c) return;

    const [colRows] = await pool.query(
      `SELECT COLUMN_NAME AS Field FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'laundry_services'`
    );
    const set = new Set(colRows.map(r => r.Field));
    if (!set.has('category')) return;

    await pool.query('ALTER TABLE laundry_services DROP INDEX idx_laundry_services_active_sort').catch(() => {});
    for (const col of [
      'description_ar', 'description_en', 'sort_order', 'estimated_hours',
      'default_price', 'unit_type', 'service_speed', 'category', 'is_active'
    ]) {
      if (set.has(col)) {
        await pool.query(`ALTER TABLE laundry_services DROP COLUMN \`${col}\``).catch(() => {});
      }
    }
  } catch (e) {
    console.error('migrateLaundryServicesToMinimal:', e);
  }
}

async function ensureSubscriptionEndDateColumn() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'customer_subscriptions'`
    );
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    if (!colSet.has('end_date')) {
      await pool.query(
        `ALTER TABLE customer_subscriptions ADD COLUMN end_date DATE DEFAULT NULL AFTER current_package_id`
      ).catch(() => {});
    }
  } catch (e) {
    console.error('ensureSubscriptionEndDateColumn:', e);
  }
}

async function migrateSubscriptionNumberNullable() {
  // جعل subscription_number يقبل NULL (لا يُضاف إلا عند الاشتراك في باقة)
  try {
    const [rows] = await pool.query(
      `SELECT IS_NULLABLE FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'customers' AND column_name = 'subscription_number'`
    );
    if (!rows.length) return;
    if (rows[0].IS_NULLABLE === 'YES') return; // already nullable
    // تحويل PENDING إلى NULL قبل تغيير القيد
    await pool.query(`UPDATE customers SET subscription_number = NULL WHERE subscription_number = 'PENDING'`).catch(() => {});
    await pool.query(
      `ALTER TABLE customers MODIFY COLUMN subscription_number VARCHAR(20) DEFAULT NULL`
    ).catch(() => {});
  } catch (e) {
    console.error('migrateSubscriptionNumberNullable:', e);
  }
}

async function migrateSubscriptionPeriodToNullable() {
  // جعل period_to يقبل NULL لدعم الباقات المفتوحة بدون تاريخ انتهاء
  // وتحويل period_from و period_to من DATE إلى DATETIME
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'subscription_periods'
       AND COLUMN_NAME IN ('period_from', 'period_to')`
    );
    const colMap = {};
    cols.forEach(c => { colMap[c.COLUMN_NAME] = c; });

    if (colMap.period_from && colMap.period_from.DATA_TYPE !== 'datetime') {
      await pool.query(
        `ALTER TABLE subscription_periods MODIFY COLUMN period_from DATETIME NOT NULL`
      ).catch(() => {});
    }
    if (colMap.period_to) {
      if (colMap.period_to.DATA_TYPE !== 'datetime' || colMap.period_to.IS_NULLABLE !== 'YES') {
        await pool.query(
          `ALTER TABLE subscription_periods MODIFY COLUMN period_to DATETIME DEFAULT NULL`
        ).catch(() => {});
      }
    }
  } catch (e) {
    console.error('migrateSubscriptionPeriodToNullable:', e);
  }
}

async function seedDefaultUser() {
  const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    const hashed = await hashPassword('admin123');
    await pool.query(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      ['admin', hashed, 'المدير العام', 'admin']
    );
  }
}

async function seedLaundryServices() {
  const [rows] = await pool.query('SELECT COUNT(*) as c FROM laundry_services');
  if (rows[0].c > 0) return;
  await pool.query(
    `INSERT INTO laundry_services (name_ar, name_en) VALUES
      (?, ?), (?, ?), (?, ?), (?, ?)`,
    [
      'غسيل وكوي عادي', 'Wash & Iron (Standard)',
      'غسيل وكوي مستعجل', 'Wash & Iron (Express)',
      'كوي فقط', 'Ironing only',
      'تنظيف جاف', 'Dry clean'
    ]
  );
}

async function findUser(username, passwordPlain) {
  const [rows] = await pool.query(
    'SELECT id, username, full_name, role, password FROM users WHERE username = ? AND is_active = 1',
    [username]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const stored = row.password || '';
  if (stored.startsWith('$2')) {
    const ok = await bcryptCompare(passwordPlain, stored);
    if (!ok) return null;
    return { id: row.id, username: row.username, full_name: row.full_name, role: row.role };
  }
  if (stored === passwordPlain) {
    const hashed = await hashPassword(passwordPlain);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, row.id]);
    return { id: row.id, username: row.username, full_name: row.full_name, role: row.role };
  }
  return null;
}

async function getAllUsers() {
  const [rows] = await pool.query(
    'SELECT id, username, password, full_name, role, is_active, created_at FROM users ORDER BY id ASC'
  );
  return rows;
}

async function createUser(username, password, fullName, role) {
  const hashed = await hashPassword(password);
  const [result] = await pool.query(
    'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
    [username, hashed, fullName, role]
  );
  return result.insertId;
}

async function updateUser(id, username, password, fullName, role) {
  if (password) {
    const hashed = await hashPassword(password);
    await pool.query(
      'UPDATE users SET username=?, password=?, full_name=?, role=? WHERE id=?',
      [username, hashed, fullName, role, id]
    );
  } else {
    await pool.query(
      'UPDATE users SET username=?, full_name=?, role=? WHERE id=?',
      [username, fullName, role, id]
    );
  }
}

async function toggleUserStatus(id, isActive) {
  await pool.query('UPDATE users SET is_active=? WHERE id=?', [isActive, id]);
}

async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id=?', [id]);
}

async function getAllCustomers(filters = {}) {
  const { page, pageSize, search, withoutSubscription } = filters;

  let whereClauses = '';
  const params = [];

  if (search) {
    whereClauses += ' AND (customer_name LIKE ? OR phone LIKE ? OR subscription_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (withoutSubscription) {
    whereClauses += ' AND NOT EXISTS (SELECT 1 FROM customer_subscriptions cs WHERE cs.customer_id = customers.id)';
  }

  const dsc = subscriptionDisplayStatusCaseSql();
  const subSelect = `
    LEFT JOIN (
      SELECT
        cs2.customer_id,
        sp2.credit_remaining AS sub_credit_remaining,
        pp2.name_ar          AS sub_package_name,
        (${dsc.replace(/\bsp\b/g, 'sp2')}) AS sub_display_status
      FROM customer_subscriptions cs2
      LEFT JOIN prepaid_packages pp2 ON pp2.id = cs2.current_package_id
      LEFT JOIN subscription_periods sp2 ON sp2.id = (
        SELECT sp3.id FROM subscription_periods sp3
        WHERE sp3.customer_subscription_id = cs2.id
        ORDER BY sp3.id DESC LIMIT 1
      )
      WHERE cs2.id = (
        SELECT cs4.id FROM customer_subscriptions cs4
        WHERE cs4.customer_id = cs2.customer_id
        ORDER BY cs4.id DESC LIMIT 1
      )
    ) sub_info ON sub_info.customer_id = customers.id
  `;

  const selectCols = `customers.*, sub_info.sub_credit_remaining, sub_info.sub_package_name, sub_info.sub_display_status`;
  const baseFrom = `FROM customers ${subSelect} WHERE 1=1${whereClauses}`;

  if (page && pageSize) {
    const countSql = `SELECT COUNT(*) as total FROM customers WHERE 1=1${whereClauses}`;
    const dataSql  = `SELECT ${selectCols} ${baseFrom} ORDER BY customers.id ASC LIMIT ? OFFSET ?`;
    const offset   = (page - 1) * pageSize;

    const [[countRow], [rows]] = await Promise.all([
      pool.query(countSql, params),
      pool.query(dataSql, [...params, pageSize, offset])
    ]);

    return {
      customers:  rows,
      total:      countRow[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow[0].total / pageSize) || 1
    };
  }

  const [rows] = await pool.query(`SELECT ${selectCols} ${baseFrom} ORDER BY customers.id ASC`, params);
  return { customers: rows, total: rows.length };
}

const CUSTOMER_PHONE_MAX_LEN = 32;

function normalizeCustomerPhoneDigits(phone) {
  if (phone == null) return '';
  let s = String(phone);
  const east = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
  const per = '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
  for (let i = 0; i < 10; i++) {
    s = s.split(east[i]).join(String(i));
    s = s.split(per[i]).join(String(i));
  }
  return s.replace(/\D/g, '');
}

function assertCustomerPhoneDigitsOk(phoneDigits) {
  if (!phoneDigits) {
    const e = new Error('invalid phone');
    e.appCode = 'PHONE_INVALID';
    throw e;
  }
  if (phoneDigits.length > CUSTOMER_PHONE_MAX_LEN) {
    const e = new Error('phone too long');
    e.appCode = 'PHONE_TOO_LONG';
    throw e;
  }
}

async function migrateCustomersPhoneWiden() {
  try {
    const [rows] = await pool.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'customers' AND column_name = 'phone'`
    );
    if (!rows.length) return;
    const len = Number(rows[0].len);
    if (Number.isFinite(len) && len >= CUSTOMER_PHONE_MAX_LEN) return;
    await pool.query(
      `ALTER TABLE customers MODIFY COLUMN phone VARCHAR(${CUSTOMER_PHONE_MAX_LEN}) NOT NULL`
    );
  } catch (e) {
    console.warn('migrateCustomersPhoneWiden:', e.message);
  }
}

async function createCustomer(data) {
  const { customerName, taxNumber, nationalId, address, city, email, customerType, notes, isActive } = data;
  const phone = normalizeCustomerPhoneDigits(data.phone);
  assertCustomerPhoneDigitsOk(phone);
  const [[dup]] = await pool.query('SELECT id FROM customers WHERE phone = ? LIMIT 1', [phone]);
  if (dup) {
    const e = new Error('duplicate phone');
    e.appCode = 'PHONE_DUPLICATE';
    throw e;
  }
  const [[nameDup]] = await pool.query('SELECT id FROM customers WHERE customer_name = ? LIMIT 1', [customerName]);
  if (nameDup) {
    const e = new Error('duplicate name');
    e.appCode = 'NAME_DUPLICATE';
    throw e;
  }
  const [result] = await pool.query(
    `INSERT INTO customers (subscription_number, customer_name, phone, tax_number, national_id, address, city, email, customer_type, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [null, customerName, phone, taxNumber || null, nationalId || null, address, city, email || null, customerType || 'individual', notes || null, isActive !== undefined ? isActive : 1]
  );
  return { id: result.insertId, subscriptionNumber: null };
}

async function updateCustomer(data) {
  const { id, customerName, taxNumber, nationalId, address, city, email, customerType, notes, isActive } = data;
  const phone = normalizeCustomerPhoneDigits(data.phone);
  assertCustomerPhoneDigitsOk(phone);
  const cid = Number(id);
  const [[dup]] = await pool.query(
    'SELECT id FROM customers WHERE phone = ? AND id <> ? LIMIT 1',
    [phone, cid]
  );
  if (dup) {
    const e = new Error('duplicate phone');
    e.appCode = 'PHONE_DUPLICATE';
    throw e;
  }
  const [[nameDup]] = await pool.query(
    'SELECT id FROM customers WHERE customer_name = ? AND id <> ? LIMIT 1',
    [customerName, cid]
  );
  if (nameDup) {
    const e = new Error('duplicate name');
    e.appCode = 'NAME_DUPLICATE';
    throw e;
  }
  await pool.query(
    `UPDATE customers SET customer_name=?, phone=?, tax_number=?, national_id=?, address=?, city=?, email=?, customer_type=?, notes=?, is_active=? WHERE id=?`,
    [customerName, phone, taxNumber || null, nationalId || null, address, city, email || null, customerType || 'individual', notes || null, isActive !== undefined ? isActive : 1, cid]
  );
}

async function toggleCustomerStatus(id, isActive) {
  await pool.query('UPDATE customers SET is_active=? WHERE id=?', [isActive, id]);
}

async function deleteCustomer(id) {
  await pool.query('DELETE FROM customers WHERE id=?', [id]);
}

async function getAllExpenses(filters = {}) {
  const { page, pageSize, search, dateFrom, dateTo } = filters;

  let whereClauses = '';
  const params = [];

  if (search) {
    whereClauses += ' AND (title LIKE ? OR category LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    whereClauses += ' AND expense_date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses += ' AND expense_date <= ?';
    params.push(dateTo);
  }

  const baseFrom = `FROM expenses WHERE 1=1${whereClauses}`;

  if (page && pageSize) {
    const countSql = `SELECT COUNT(*) as total ${baseFrom}`;
    const dataSql  = `SELECT * ${baseFrom} ORDER BY expense_date DESC, id DESC LIMIT ? OFFSET ?`;
    const offset   = (page - 1) * pageSize;

    const [[countRow], [rows]] = await Promise.all([
      pool.query(countSql, params),
      pool.query(dataSql, [...params, pageSize, offset])
    ]);

    return {
      expenses:   rows,
      total:      countRow[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow[0].total / pageSize) || 1
    };
  }

  const dataSql  = `SELECT * ${baseFrom} ORDER BY expense_date DESC, id DESC`;
  const [rows] = await pool.query(dataSql, params);
  return { expenses: rows, total: rows.length };
}

async function getExpensesSummary(filters = {}) {
  const { search, dateFrom, dateTo } = filters;

  let whereClauses = '';
  const params = [];

  if (search) {
    whereClauses += ' AND (title LIKE ? OR category LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (dateFrom) {
    whereClauses += ' AND expense_date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses += ' AND expense_date <= ?';
    params.push(dateTo);
  }

  const [rows] = await pool.query(`
    SELECT
      COALESCE(SUM(amount), 0)       as total_before_tax,
      COALESCE(SUM(tax_amount), 0)   as total_tax,
      COALESCE(SUM(total_amount), 0) as grand_total,
      COUNT(*)                       as count
    FROM expenses WHERE 1=1${whereClauses}
  `, params);
  return rows[0];
}

async function createExpense(data) {
  const { title, category, amount, isTaxable, taxRate, taxAmount, totalAmount, expenseDate, notes, createdBy } = data;
  const [result] = await pool.query(
    `INSERT INTO expenses (title, category, amount, is_taxable, tax_rate, tax_amount, total_amount, expense_date, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, category, amount, isTaxable ? 1 : 0, taxRate || 15.00, taxAmount || 0, totalAmount, expenseDate, notes || null, createdBy || null]
  );
  return result.insertId;
}

async function updateExpense(data) {
  const { id, title, category, amount, isTaxable, taxRate, taxAmount, totalAmount, expenseDate, notes } = data;
  await pool.query(
    `UPDATE expenses SET title=?, category=?, amount=?, is_taxable=?, tax_rate=?, tax_amount=?, total_amount=?, expense_date=?, notes=? WHERE id=?`,
    [title, category, amount, isTaxable ? 1 : 0, taxRate || 15.00, taxAmount || 0, totalAmount, expenseDate, notes || null, id]
  );
}

async function deleteExpense(id) {
  await pool.query('DELETE FROM expenses WHERE id=?', [id]);
}

const LAUNDRY_SERVICE_SORT_COLS = {
  id: 'id',
  name_ar: 'name_ar',
  name_en: 'name_en',
  is_active: 'is_active',
  created_at: 'created_at',
  sort_order: 'sort_order'
};

function buildLaundryServicesOrderBy(filters = {}) {
  const dir = String(filters.sortDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const col = LAUNDRY_SERVICE_SORT_COLS[filters.sortBy];
  if (!col) return 'ORDER BY sort_order ASC, id ASC';
  return `ORDER BY ${col} ${dir}, id ASC`;
}

const PRODUCT_SORT_FRAGMENTS = {
  id: 'p.id',
  name_ar: 'p.name_ar',
  name_en: 'p.name_en',
  is_active: 'p.is_active',
  created_at: 'p.created_at',
  lines: '(SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id)',
  sort_order: 'p.sort_order'
};

function buildProductsOrderBy(filters = {}) {
  const dir = String(filters.sortDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const frag = PRODUCT_SORT_FRAGMENTS[filters.sortBy];
  if (!frag) return 'ORDER BY p.sort_order ASC, p.id ASC';
  return `ORDER BY ${frag} ${dir}, p.id ASC`;
}

async function getAllLaundryServices(filters = {}) {
  const { page, pageSize, search } = filters;

  let whereClauses = '';
  const params = [];

  if (search) {
    whereClauses += ' AND (name_ar LIKE ? OR name_en LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (filters.activeOnly) {
    whereClauses += ' AND is_active = 1';
  }

  const baseFrom = `FROM laundry_services WHERE 1=1${whereClauses}`;
  const orderSql = buildLaundryServicesOrderBy(filters);

  if (page && pageSize) {
    const countSql = `SELECT COUNT(*) as total ${baseFrom}`;
    const dataSql  = `SELECT * ${baseFrom} ${orderSql} LIMIT ? OFFSET ?`;
    const offset   = (page - 1) * pageSize;

    const [[countRow], [rows]] = await Promise.all([
      pool.query(countSql, params),
      pool.query(dataSql, [...params, pageSize, offset])
    ]);

    return {
      services:   rows,
      total:      countRow[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow[0].total / pageSize) || 1
    };
  }

  const [rows] = await pool.query(`SELECT * ${baseFrom} ${orderSql}`, params);
  return { services: rows, total: rows.length };
}

async function createLaundryService(data) {
  const { nameAr, nameEn } = data;
  const [[m]] = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM laundry_services'
  );
  const [result] = await pool.query(
    'INSERT INTO laundry_services (name_ar, name_en, sort_order) VALUES (?, ?, ?)',
    [nameAr, nameEn, m.n]
  );
  return result.insertId;
}

async function updateLaundryService(data) {
  const { id, nameAr, nameEn } = data;
  await pool.query(
    'UPDATE laundry_services SET name_ar=?, name_en=? WHERE id=?',
    [nameAr, nameEn, id]
  );
}

async function deleteLaundryService(id) {
  await pool.query('DELETE FROM laundry_services WHERE id=?', [id]);
}

async function setLaundryServiceActive(id, isActive) {
  await pool.query('UPDATE laundry_services SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
}

async function reorderLaundryServiceRelative({ id, beforeId }) {
  const pid = Number(id);
  if (!pid) return { success: false, message: 'معرّف غير صالح' };
  const before = beforeId != null && beforeId !== '' ? Number(beforeId) : null;
  const [allRows] = await pool.query(
    'SELECT id FROM laundry_services ORDER BY sort_order ASC, id ASC'
  );
  let ids = allRows.map((r) => r.id);
  const from = ids.indexOf(pid);
  if (from === -1) return { success: false, message: 'غير موجود' };
  ids.splice(from, 1);
  let insertAt = ids.length;
  if (before != null && !Number.isNaN(before)) {
    const idx = ids.indexOf(before);
    if (idx !== -1) insertAt = idx;
  }
  ids.splice(insertAt, 0, pid);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await conn.query('UPDATE laundry_services SET sort_order=? WHERE id=?', [i + 1, ids[i]]);
    }
    await conn.commit();
    return { success: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function reorderProductRelative({ id, beforeId }) {
  const pid = Number(id);
  if (!pid) return { success: false, message: 'معرّف غير صالح' };
  const before = beforeId != null && beforeId !== '' ? Number(beforeId) : null;
  const [allRows] = await pool.query(
    'SELECT id FROM products ORDER BY sort_order ASC, id ASC'
  );
  let ids = allRows.map((r) => r.id);
  const from = ids.indexOf(pid);
  if (from === -1) return { success: false, message: 'غير موجود' };
  ids.splice(from, 1);
  let insertAt = ids.length;
  if (before != null && !Number.isNaN(before)) {
    const idx = ids.indexOf(before);
    if (idx !== -1) insertAt = idx;
  }
  ids.splice(insertAt, 0, pid);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) {
      await conn.query('UPDATE products SET sort_order=? WHERE id=?', [i + 1, ids[i]]);
    }
    await conn.commit();
    return { success: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function setProductActive(id, isActive) {
  await pool.query('UPDATE products SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
}

async function getProductImageRowsByIds(ids) {
  const unique = [...new Set(ids.map(Number).filter((n) => n > 0))];
  if (!unique.length) return [];
  const ph = unique.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, image_blob, image_mime FROM products WHERE id IN (${ph}) AND image_blob IS NOT NULL`,
    unique
  );
  return rows;
}

async function getProducts(filters = {}) {
  const { page, pageSize, search } = filters;

  let whereClauses = '';
  const params = [];

  if (search) {
    whereClauses += ' AND (p.name_ar LIKE ? OR p.name_en LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }

  const baseFrom = `FROM products p WHERE 1=1${whereClauses}`;
  const orderSql = buildProductsOrderBy(filters);

  if (page && pageSize) {
    const countSql = `SELECT COUNT(*) as total ${baseFrom}`;
    const dataSql = `
      SELECT p.id, p.name_ar, p.name_en, p.is_active, p.created_at, p.sort_order,
        (p.image_blob IS NOT NULL) AS has_image,
        (SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id) AS price_line_count
      ${baseFrom}
      ${orderSql}
      LIMIT ? OFFSET ?`;
    const offset = (page - 1) * pageSize;

    const [[countRow], [rows]] = await Promise.all([
      pool.query(countSql, params),
      pool.query(dataSql, [...params, pageSize, offset])
    ]);

    return {
      products: rows,
      total: countRow[0].total,
      page,
      pageSize,
      totalPages: Math.ceil(countRow[0].total / pageSize) || 1
    };
  }

  const [rows] = await pool.query(
    `SELECT p.id, p.name_ar, p.name_en, p.is_active, p.created_at, p.sort_order,
      (p.image_blob IS NOT NULL) AS has_image,
      (SELECT COUNT(*) FROM product_price_lines ppl WHERE ppl.product_id = p.id) AS price_line_count
     ${baseFrom} ${orderSql}`,
    params
  );
  return { products: rows, total: rows.length };
}

async function getProductById(id) {
  const [[product]] = await pool.query(
    'SELECT id, name_ar, name_en, is_active, created_at, sort_order, image_mime FROM products WHERE id=?',
    [id]
  );
  if (!product) return null;

  const [[imgRow]] = await pool.query(
    'SELECT image_blob FROM products WHERE id=? AND image_blob IS NOT NULL',
    [id]
  );
  const imageGzipBuffer = imgRow && imgRow.image_blob ? imgRow.image_blob : null;

  const [lines] = await pool.query(
    `SELECT ppl.id, ppl.product_id, ppl.laundry_service_id, ppl.price,
            ls.name_ar AS service_name_ar, ls.name_en AS service_name_en, ls.is_active AS service_is_active
     FROM product_price_lines ppl
     INNER JOIN laundry_services ls ON ls.id = ppl.laundry_service_id
     WHERE ppl.product_id = ?
     ORDER BY ls.sort_order ASC, ls.id ASC, ppl.id ASC`,
    [id]
  );

  return { product, priceLines: lines, imageGzipBuffer };
}

async function saveProduct(data) {
  const {
    id,
    nameAr,
    nameEn,
    isActive,
    priceLines,
    imageGzipBuffer,
    imageMime,
    clearImage
  } = data;
  const lines = Array.isArray(priceLines) ? priceLines : [];
  const nameEnVal = nameEn && String(nameEn).trim() ? String(nameEn).trim() : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let productId = id ? Number(id) : null;
    const active = isActive !== undefined ? (isActive ? 1 : 0) : 1;

    const touchImage = clearImage === true || Buffer.isBuffer(imageGzipBuffer);

    if (productId) {
      if (touchImage) {
        if (clearImage === true) {
          await conn.query(
            'UPDATE products SET name_ar=?, name_en=?, is_active=?, image_blob=NULL, image_mime=NULL WHERE id=?',
            [nameAr, nameEnVal, active, productId]
          );
        } else {
          await conn.query(
            'UPDATE products SET name_ar=?, name_en=?, is_active=?, image_blob=?, image_mime=? WHERE id=?',
            [nameAr, nameEnVal, active, imageGzipBuffer, imageMime || 'application/octet-stream', productId]
          );
        }
      } else {
        await conn.query(
          'UPDATE products SET name_ar=?, name_en=?, is_active=? WHERE id=?',
          [nameAr, nameEnVal, active, productId]
        );
      }
    } else {
      const blob = clearImage === true ? null : (Buffer.isBuffer(imageGzipBuffer) ? imageGzipBuffer : null);
      const mime = clearImage === true ? null : (blob ? (imageMime || 'application/octet-stream') : null);
      const [[m]] = await conn.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM products'
      );
      const [ins] = await conn.query(
        'INSERT INTO products (name_ar, name_en, image_blob, image_mime, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [nameAr, nameEnVal, blob, mime, active, m.n]
      );
      productId = ins.insertId;
    }

    await conn.query('DELETE FROM product_price_lines WHERE product_id=?', [productId]);

    for (const line of lines) {
      const sid = Number(line.laundryServiceId);
      const price = Number(line.price);
      if (!sid || !(price > 0)) continue;
      await conn.query(
        `INSERT INTO product_price_lines (product_id, laundry_service_id, price)
         VALUES (?, ?, ?)`,
        [productId, sid, price]
      );
    }

    await conn.commit();
    return { id: productId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id=?', [id]);
}

async function getProductsExportRows(filters = {}) {
  const { search } = filters;
  let where = 'WHERE 1=1';
  const params = [];
  if (search) {
    where += ' AND (p.name_ar LIKE ? OR p.name_en LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  const [rows] = await pool.query(
    `SELECT p.id AS product_id, p.name_ar AS product_name_ar, p.name_en AS product_name_en,
            (p.image_blob IS NOT NULL) AS has_image,
            ls.id AS laundry_service_id, ls.name_ar AS service_name_ar, ls.name_en AS service_name_en,
            ppl.price
     FROM product_price_lines ppl
     INNER JOIN products p ON p.id = ppl.product_id
     INNER JOIN laundry_services ls ON ls.id = ppl.laundry_service_id
     ${where}
     ORDER BY p.sort_order ASC, p.id ASC, ls.sort_order ASC, ls.id ASC`,
    params
  );
  return rows;
}

async function refreshExpiredSubscriptionPeriods() {
  await pool.query(
    `UPDATE subscription_periods SET status = 'expired'
     WHERE status = 'active' AND period_to IS NOT NULL AND period_to < CURDATE()`
  );
}

async function getAllPrepaidPackages(filters = {}) {
  const { activeOnly, search } = filters;
  let where = 'WHERE 1=1';
  const params = [];
  if (activeOnly) where += ' AND is_active = 1';
  if (search) {
    where += ' AND name_ar LIKE ?';
    params.push(`%${search}%`);
  }
  const [rows] = await pool.query(
    `SELECT * FROM prepaid_packages ${where} ORDER BY sort_order ASC, id ASC`,
    params
  );
  return rows;
}

async function savePrepaidPackage(data) {
  const {
    id,
    nameAr,
    prepaidPrice,
    serviceCreditValue,
    durationDays,
    isActive,
    notes,
    sortOrder
  } = data;
  const name = String(nameAr || '').trim();
  if (!name) throw new Error('اسم الباقة مطلوب');
  const price = Number(prepaidPrice);
  const credit = Number(serviceCreditValue);
  const days = Math.max(1, Math.floor(Number(durationDays) || 30));
  if (!(price >= 0) || !(credit >= 0)) throw new Error('المبالغ غير صالحة');

  if (id) {
    await pool.query(
      `UPDATE prepaid_packages SET name_ar=?, prepaid_price=?, service_credit_value=?, duration_days=?,
       is_active=?, notes=?, sort_order=? WHERE id=?`,
      [
        name,
        price,
        credit,
        days,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        notes || null,
        sortOrder != null ? Number(sortOrder) : 0,
        id
      ]
    );
    return { id: Number(id) };
  }
  const [[m]] = await pool.query(
    'SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM prepaid_packages'
  );
  const [ins] = await pool.query(
    `INSERT INTO prepaid_packages (name_ar, prepaid_price, service_credit_value, duration_days, is_active, sort_order, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      price,
      credit,
      days,
      isActive !== undefined ? (isActive ? 1 : 0) : 1,
      sortOrder != null ? Number(sortOrder) : m.n,
      notes || null
    ]
  );
  return { id: ins.insertId };
}

async function togglePrepaidPackageActive(id, isActive) {
  await pool.query('UPDATE prepaid_packages SET is_active=? WHERE id=?', [isActive ? 1 : 0, id]);
}

async function deletePrepaidPackage(id) {
  const pid = Number(id);
  if (!pid) throw new Error('معرّف الباقة غير صالح');
  const [[usage]] = await pool.query(
    'SELECT COUNT(*) AS c FROM subscription_periods WHERE package_id = ?',
    [pid]
  );
  if (usage.c > 0) {
    throw new Error('لا يمكن حذف الباقة لارتباطها بفترات اشتراك');
  }
  const [r] = await pool.query('DELETE FROM prepaid_packages WHERE id = ?', [pid]);
  if (r.affectedRows === 0) throw new Error('الباقة غير موجودة');
}

function subscriptionDisplayStatusCaseSql() {
  return `CASE
    WHEN sp.id IS NULL THEN 'none'
    WHEN sp.status = 'active' AND sp.period_to IS NULL THEN 'active'
    WHEN sp.status = 'active' AND sp.period_to >= CURDATE() THEN 'active'
    WHEN sp.status = 'active' AND sp.period_to < CURDATE() THEN 'expired'
    WHEN sp.status = 'expired' THEN 'expired'
    WHEN sp.status = 'closed' THEN 'closed'
    ELSE 'none'
  END`;
}

function subscriptionListFromJoinSql() {
  return `
    FROM customer_subscriptions cs
    INNER JOIN customers c ON c.id = cs.customer_id
    LEFT JOIN prepaid_packages pp ON pp.id = cs.current_package_id
    LEFT JOIN subscription_periods sp ON sp.id = (
      SELECT sp2.id FROM subscription_periods sp2
      WHERE sp2.customer_subscription_id = cs.id
      ORDER BY sp2.id DESC
      LIMIT 1
    )
  `;
}

function subscriptionListSelectSql() {
  const dsc = subscriptionDisplayStatusCaseSql();
  return `
    SELECT
      cs.id,
      cs.customer_id,
      cs.subscription_ref,
      cs.current_package_id,
      cs.end_date,
      cs.created_at,
      c.customer_name,
      c.phone,
      c.subscription_number AS customer_file_ref,
      pp.name_ar AS package_name,
      pp.prepaid_price AS package_prepaid_price,
      pp.service_credit_value AS package_credit_value,
      pp.duration_days AS package_duration_days,
      sp.id AS current_period_id,
      sp.period_from,
      sp.period_to,
      sp.credit_remaining,
      sp.credit_value_granted,
      sp.prepaid_price_paid,
      sp.status AS period_status,
      (${dsc}) AS display_status
    ${subscriptionListFromJoinSql()}
  `;
}

async function getCustomerSubscriptionsList(filters = {}) {
  await refreshExpiredSubscriptionPeriods();
  const {
    customerId,
    search,
    statusFilter,
    dateFrom,
    dateTo,
    page: pageRaw,
    pageSize: pageSizeRaw
  } = filters;
  let where = 'WHERE 1=1';
  const params = [];
  if (customerId) {
    where += ' AND cs.customer_id = ?';
    params.push(Number(customerId));
  }
  if (search) {
    where += ` AND (
      cs.subscription_ref LIKE ? OR c.customer_name LIKE ? OR c.phone LIKE ? OR c.subscription_number LIKE ?
    )`;
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  const dfVal = dateFrom ? String(dateFrom).replace('T', ' ') : null;
  const dtVal = dateTo   ? String(dateTo).replace('T', ' ')   : null;
  if (dfVal) {
    where += ' AND EXISTS (SELECT 1 FROM subscription_periods spf WHERE spf.customer_subscription_id = cs.id AND spf.period_to >= ?)';
    params.push(dfVal);
  }
  if (dtVal) {
    where += ' AND EXISTS (SELECT 1 FROM subscription_periods spf2 WHERE spf2.customer_subscription_id = cs.id AND spf2.period_from <= ?)';
    params.push(dtVal);
  }
  if (statusFilter && statusFilter !== 'all') {
    where += ` AND (${subscriptionDisplayStatusCaseSql()}) = ?`;
    params.push(statusFilter);
  }

  const pageNum = Number(pageRaw);
  const sizeNum = Number(pageSizeRaw);
  const wantPaginate =
    Number.isFinite(pageNum) && pageNum >= 1 && Number.isFinite(sizeNum) && sizeNum >= 1;

  if (!wantPaginate) {
    const sql = `${subscriptionListSelectSql()} ${where} ORDER BY cs.id DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  const limit = Math.min(Math.max(1, Math.floor(sizeNum)), 100);
  const page = Math.max(1, Math.floor(pageNum));
  const offset = (page - 1) * limit;

  const countSql = `SELECT COUNT(*) AS total ${subscriptionListFromJoinSql()} ${where}`;
  const [[countRow]] = await pool.query(countSql, params);
  const total = Number(countRow.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const sql = `${subscriptionListSelectSql()} ${where} ORDER BY cs.id DESC LIMIT ? OFFSET ?`;
  const [rows] = await pool.query(sql, [...params, limit, offset]);

  return {
    subscriptions: rows,
    total,
    page,
    pageSize: limit,
    totalPages
  };
}

async function getSubscriptionsReport(filters = {}) {
  await refreshExpiredSubscriptionPeriods();

  const {
    customerId,
    search,
    subscriptionNumber,
    statusFilter,
    packageId,
    dateFrom,
    dateTo,
  } = filters;

  let where = 'WHERE 1=1';
  const params = [];

  if (customerId) {
    where += ' AND cs.customer_id = ?';
    params.push(Number(customerId));
  }
  if (search) {
    where += ` AND (
      cs.subscription_ref LIKE ? OR c.customer_name LIKE ? OR c.phone LIKE ? OR c.subscription_number LIKE ?
    )`;
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (subscriptionNumber) {
    where += ' AND c.subscription_number LIKE ?';
    params.push(`%${subscriptionNumber}%`);
  }
  if (packageId) {
    where += ' AND sp.package_id = ?';
    params.push(Number(packageId));
  }
  const dfVal = dateFrom ? String(dateFrom).replace('T', ' ') : null;
  const dtVal = dateTo   ? String(dateTo).replace('T', ' ')   : null;
  if (dfVal) {
    where += ' AND sp.created_at >= ?';
    params.push(dfVal);
  }
  if (dtVal) {
    where += ' AND sp.created_at <= ?';
    params.push(dtVal);
  }
  if (statusFilter && statusFilter !== 'all') {
    if (statusFilter === 'active') {
      where += ` AND sp.status = 'active' AND (sp.period_to IS NULL OR sp.period_to >= CURDATE()) AND sp.credit_remaining > 0`;
    } else if (statusFilter === 'expired') {
      where += ` AND (sp.status = 'expired' OR (sp.status = 'active' AND sp.period_to IS NOT NULL AND sp.period_to < CURDATE()))`;
    } else if (statusFilter === 'closed') {
      where += ` AND sp.status = 'closed'`;
    } else if (statusFilter === 'negative') {
      where += ` AND sp.status = 'active' AND sp.credit_remaining <= 0`;
    } else if (statusFilter === 'near_expiry') {
      where += ` AND sp.status = 'active' AND sp.period_to IS NOT NULL AND DATEDIFF(sp.period_to, CURDATE()) BETWEEN 0 AND 7`;
    }
  }

  const baseFrom = `
    FROM subscription_periods sp
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    INNER JOIN customers c               ON c.id  = cs.customer_id
    INNER JOIN prepaid_packages pp       ON pp.id = sp.package_id
  `;

  const summarySql = `
    SELECT
      COUNT(*)                                                                         AS total_periods,
      SUM(CASE WHEN sp.status='active'
               AND (sp.period_to IS NULL OR sp.period_to >= CURDATE())
               AND sp.credit_remaining > 0  THEN 1 ELSE 0 END)                        AS active_count,
      SUM(CASE WHEN sp.status='expired'
               OR  (sp.status='active' AND sp.period_to IS NOT NULL AND sp.period_to < CURDATE())
                                            THEN 1 ELSE 0 END)                        AS expired_count,
      SUM(CASE WHEN sp.status='closed'       THEN 1 ELSE 0 END)                       AS closed_count,
      SUM(CASE WHEN sp.status='active'
               AND sp.period_to IS NOT NULL
               AND DATEDIFF(sp.period_to, CURDATE()) BETWEEN 0 AND 7
                                            THEN 1 ELSE 0 END)                        AS near_expiry_count,
      SUM(CASE WHEN sp.status='active'
               AND sp.credit_remaining <= 0 THEN 1 ELSE 0 END)                        AS negative_count,
      COALESCE(SUM(sp.prepaid_price_paid), 0)                                          AS total_revenue,
      COALESCE(SUM(sp.credit_value_granted), 0)                                        AS total_credit_granted,
      COALESCE(SUM(CASE WHEN sp.status='active' THEN sp.credit_remaining ELSE 0 END), 0) AS total_credit_remaining
    ${baseFrom}
    ${where}
  `;

  const detailSql = `
    SELECT
      sp.id                                                AS period_id,
      cs.id                                                AS subscription_id,
      cs.subscription_ref,
      c.id                                                 AS customer_id,
      c.customer_name,
      c.phone,
      c.subscription_number                                AS customer_file_ref,
      pp.id                                                AS package_id,
      pp.name_ar                                           AS package_name,
      pp.prepaid_price,
      pp.service_credit_value,
      sp.period_from,
      sp.period_to,
      sp.prepaid_price_paid,
      sp.credit_value_granted,
      sp.credit_remaining,
      sp.status                                            AS period_status,
      DATEDIFF(sp.period_to, CURDATE())                    AS days_until_expiry,
      CASE
        WHEN sp.status = 'active' AND sp.period_to IS NULL      THEN 'active'
        WHEN sp.status = 'active' AND sp.period_to >= CURDATE() THEN 'active'
        WHEN sp.status = 'active' AND sp.period_to < CURDATE()  THEN 'expired'
        WHEN sp.status = 'expired'                              THEN 'expired'
        WHEN sp.status = 'closed'                               THEN 'closed'
        ELSE 'none'
      END                                                  AS display_status
    ${baseFrom}
    ${where}
    ORDER BY sp.id DESC
  `;

  const [[summaryRows], [periods]] = await Promise.all([
    pool.query(summarySql, params),
    pool.query(detailSql, params),
  ]);

  const s = summaryRows[0] || {};
  return {
    periods,
    summary: {
      totalPeriods:         Number(s.total_periods         || 0),
      activeCount:          Number(s.active_count          || 0),
      expiredCount:         Number(s.expired_count         || 0),
      closedCount:          Number(s.closed_count          || 0),
      nearExpiryCount:      Number(s.near_expiry_count     || 0),
      negativeCount:        Number(s.negative_count        || 0),
      totalRevenue:         Number(s.total_revenue         || 0),
      totalCreditGranted:   Number(s.total_credit_granted  || 0),
      totalCreditRemaining: Number(s.total_credit_remaining|| 0),
    },
  };
}

async function getCustomerActiveSubscription(customerId) {
  await refreshExpiredSubscriptionPeriods();
  const cid = Number(customerId);
  if (!cid) return null;
  const dsc = subscriptionDisplayStatusCaseSql();
  const [rows] = await pool.query(
    `SELECT
       cs.id,
       cs.subscription_ref,
       pp.name_ar AS package_name,
       sp.credit_remaining,
       sp.credit_value_granted,
       sp.period_from,
       sp.period_to,
       sp.status AS period_status,
       (${dsc}) AS display_status
     FROM customer_subscriptions cs
     LEFT JOIN prepaid_packages pp ON pp.id = cs.current_package_id
     LEFT JOIN subscription_periods sp ON sp.id = (
       SELECT sp2.id FROM subscription_periods sp2
       WHERE sp2.customer_subscription_id = cs.id
       ORDER BY sp2.id DESC LIMIT 1
     )
     WHERE cs.customer_id = ?
     ORDER BY cs.id DESC
     LIMIT 1`,
    [cid]
  );
  return rows[0] || null;
}

async function getSubscriptionDetail(subscriptionId) {
  await refreshExpiredSubscriptionPeriods();
  const sid = Number(subscriptionId);
  const [rows] = await pool.query(
    `${subscriptionListSelectSql()} WHERE cs.id = ?`,
    [sid]
  );
  return rows[0] || null;
}

async function getSubscriptionPeriods(subscriptionId) {
  const [rows] = await pool.query(
    `SELECT sp.*, pp.name_ar AS package_name
     FROM subscription_periods sp
     INNER JOIN prepaid_packages pp ON pp.id = sp.package_id
     WHERE sp.customer_subscription_id = ?
     ORDER BY sp.id ASC`,
    [Number(subscriptionId)]
  );
  return rows;
}

async function getSubscriptionLedgerBySubscription(subscriptionId) {
  const [rows] = await pool.query(
    `SELECT sl.*, sp.period_from, sp.period_to
     FROM subscription_ledger sl
     INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
     WHERE sp.customer_subscription_id = ?
     ORDER BY sl.id ASC`,
    [Number(subscriptionId)]
  );
  return rows;
}

async function createSubscription(data) {
  const { customerId, packageId, periodFrom, periodTo, endDate, createdBy } = data;
  const cid = Number(customerId);
  const pid = Number(packageId);
  if (!cid || !pid) throw new Error('العميل والباقة مطلوبان');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[pkg]] = await conn.query(
      'SELECT * FROM prepaid_packages WHERE id = ? AND is_active = 1',
      [pid]
    );
    if (!pkg) throw new Error('الباقة غير موجودة أو غير مفعّلة');

    const [[cust]] = await conn.query('SELECT id FROM customers WHERE id = ?', [cid]);
    if (!cust) throw new Error('العميل غير موجود');

    const [[existingSub]] = await conn.query(
      'SELECT id FROM customer_subscriptions WHERE customer_id = ? LIMIT 1',
      [cid]
    );
    if (existingSub) {
      throw new Error('هذا العميل لديه اشتراك بالفعل. يمكن التجديد فقط من قائمة الاشتراكات.');
    }

    const subEndDate = endDate && String(endDate).trim() ? String(endDate).slice(0, 10) : null;

    const [insSub] = await conn.query(
      'INSERT INTO customer_subscriptions (customer_id, subscription_ref, current_package_id, end_date) VALUES (?, ?, ?, ?)',
      [cid, 'PENDING', pid, subEndDate]
    );
    const subId = insSub.insertId;
    const ref = 'SUB-' + String(subId).padStart(6, '0');
    await conn.query('UPDATE customer_subscriptions SET subscription_ref = ? WHERE id = ?', [ref, subId]);

    // تعيين رقم الاشتراك للعميل إذا لم يكن لديه رقم بعد
    const [[custRow]] = await conn.query('SELECT subscription_number FROM customers WHERE id = ?', [cid]);
    if (!custRow.subscription_number) {
      // استخدام أعلى رقم موجود + 1 لضمان التسلسل
      const [[maxRow]] = await conn.query(
        `SELECT COALESCE(MAX(CAST(subscription_number AS UNSIGNED)), 0) AS maxNum
         FROM customers WHERE subscription_number REGEXP '^[0-9]+$'`
      );
      const nextNum = String((maxRow.maxNum || 0) + 1);
      await conn.query('UPDATE customers SET subscription_number = ? WHERE id = ?', [nextNum, cid]);
    }

    const nowTime = new Date();
    const pad = (x) => String(x).padStart(2, '0');
    const timeSuffix = ` ${pad(nowTime.getHours())}:${pad(nowTime.getMinutes())}:${pad(nowTime.getSeconds())}`;
    const pFrom = periodFrom && String(periodFrom).trim()
      ? toSqlDate(periodFrom) + timeSuffix
      : toSqlDate(nowTime) + timeSuffix;

    // تحديد تاريخ الانتهاء
    let pTo = null;
    if (periodTo && String(periodTo).trim()) {
      // إذا تم إدخال تاريخ انتهاء محدد، استخدمه
      pTo = String(periodTo).slice(0, 10);
    }
    // إذا لم يتم إدخال تاريخ انتهاء، تبقى الباقة مفتوحة (pTo = null)

    const credit = Number(pkg.service_credit_value);
    const paid = Number(pkg.prepaid_price);

    const [insPer] = await conn.query(
      `INSERT INTO subscription_periods (
        customer_subscription_id, package_id, period_from, period_to,
        prepaid_price_paid, credit_value_granted, credit_remaining, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [subId, pid, pFrom, pTo, paid, credit, credit]
    );
    const periodId = insPer.insertId;

    await conn.query(
      `INSERT INTO subscription_ledger (subscription_period_id, entry_type, amount, balance_after, notes, created_by)
       VALUES (?, 'purchase', ?, ?, ?, ?)`,
      [periodId, credit, credit, 'اشتراك جديد', createdBy || null]
    );

    await conn.commit();
    return { subscriptionId: subId, subscriptionRef: ref, periodId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function renewSubscription(data) {
  const { subscriptionId, packageId, periodFrom, periodTo, createdBy, carryOverRemaining = true } = data;
  const sid = Number(subscriptionId);
  const pid = Number(packageId);
  if (!sid || !pid) throw new Error('معرّف الاشتراك والباقة مطلوبان');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await refreshExpiredSubscriptionPeriods();

    const [[pkg]] = await conn.query(
      'SELECT * FROM prepaid_packages WHERE id = ? AND is_active = 1',
      [pid]
    );
    if (!pkg) throw new Error('الباقة غير موجودة أو غير مفعّلة');

    const [[sub]] = await conn.query('SELECT * FROM customer_subscriptions WHERE id = ?', [sid]);
    if (!sub) throw new Error('الاشتراك غير موجود');

    const [periods] = await conn.query(
      `SELECT * FROM subscription_periods WHERE customer_subscription_id = ? ORDER BY id DESC`,
      [sid]
    );
    let carry = 0;
    if (periods.length > 0 && carryOverRemaining) {
      const last = periods[0];
      // السماح بالترحيل السالب (مديونية) — لا نستخدم Math.max(0, ...)
      carry = Number(last.credit_remaining) || 0;
    }

    for (const p of periods) {
      if (p.status === 'active') {
        await conn.query(
          `UPDATE subscription_periods SET status = 'closed' WHERE id = ?`,
          [p.id]
        );
      }
    }

    const nowTime2 = new Date();
    const pad2 = (x) => String(x).padStart(2, '0');
    const timeSuffix2 = ` ${pad2(nowTime2.getHours())}:${pad2(nowTime2.getMinutes())}:${pad2(nowTime2.getSeconds())}`;
    let pFrom;
    if (periodFrom && String(periodFrom).trim()) {
      pFrom = toSqlDate(periodFrom) + timeSuffix2;
    } else if (periods.length > 0 && periods[0].period_to) {
      const [[nextFrom]] = await conn.query(
        `SELECT DATE_ADD(?, INTERVAL 1 DAY) AS d`,
        [toSqlDate(periods[0].period_to)]
      );
      const candidateStr = toSqlDate(nextFrom.d);
      const [[todayRow]] = await conn.query('SELECT CURDATE() AS t');
      const todayStr = toSqlDate(todayRow.t);
      pFrom = (candidateStr >= todayStr ? candidateStr : todayStr) + timeSuffix2;
    } else {
      const [[todayRow]] = await conn.query('SELECT CURDATE() AS t');
      pFrom = toSqlDate(todayRow.t) + timeSuffix2;
    }

    // تحديد تاريخ الانتهاء
    let pTo = null;
    if (periodTo && String(periodTo).trim()) {
      // إذا تم إدخال تاريخ انتهاء محدد، استخدمه
      pTo = String(periodTo).slice(0, 10);
    }
    // إذا لم يتم إدخال تاريخ انتهاء، تبقى الباقة مفتوحة (pTo = null)

    const newCredit = Number(pkg.service_credit_value) + carry;
    const paid = Number(pkg.prepaid_price);

    const [insPer] = await conn.query(
      `INSERT INTO subscription_periods (
        customer_subscription_id, package_id, period_from, period_to,
        prepaid_price_paid, credit_value_granted, credit_remaining, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      [sid, pid, pFrom, pTo, paid, newCredit, newCredit]
    );
    const periodId = insPer.insertId;

    const note = carry > 0 ? `تجديد — ترحيل رصيد ${carry.toFixed(2)}` : carry < 0 ? `تجديد — سداد مديونية ${Math.abs(carry).toFixed(2)}` : 'تجديد اشتراك';
    await conn.query(
      `INSERT INTO subscription_ledger (subscription_period_id, entry_type, amount, balance_after, notes, created_by)
       VALUES (?, 'renewal', ?, ?, ?, ?)`,
      [periodId, newCredit, newCredit, note, createdBy || null]
    );

    await conn.query(
      'UPDATE customer_subscriptions SET current_package_id = ? WHERE id = ?',
      [pid, sid]
    );

    await conn.commit();
    return { subscriptionId: sid, periodId, subscriptionRef: sub.subscription_ref };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getSubscriptionReceiptData(periodId) {
  const pid = Number(periodId);
  const [rows] = await pool.query(
    `SELECT sp.*,
            cs.subscription_ref,
            cs.customer_id,
            c.customer_name,
            c.phone,
            c.subscription_number AS customer_file_ref,
            c.city,
            pp.name_ar AS package_name,
            pp.prepaid_price AS package_prepaid_price,
            pp.service_credit_value AS package_service_credit,
            pp.duration_days AS package_duration_days,
            CASE 
              WHEN sp.period_to IS NOT NULL THEN DATEDIFF(sp.period_to, sp.period_from) + 1
              ELSE NULL
            END AS duration_days
     FROM subscription_periods sp
     INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
     INNER JOIN customers c ON c.id = cs.customer_id
     INNER JOIN prepaid_packages pp ON pp.id = sp.package_id
     WHERE sp.id = ?`,
    [pid]
  );
  return rows[0] || null;
}

async function getSubscriptionsExportRows(filters = {}) {
  await refreshExpiredSubscriptionPeriods();
  const f = { ...(filters || {}) };
  delete f.page;
  delete f.pageSize;
  return getCustomerSubscriptionsList(f);
}

async function stopSubscription(subscriptionId) {
  const sid = Number(subscriptionId);
  if (!sid) throw new Error('معرّف الاشتراك غير صالح');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await refreshExpiredSubscriptionPeriods();
    const [[sub]] = await conn.query('SELECT id FROM customer_subscriptions WHERE id = ?', [sid]);
    if (!sub) throw new Error('الاشتراك غير موجود');
    const [rows] = await conn.query(
      `SELECT id FROM subscription_periods
       WHERE customer_subscription_id = ? AND status = 'active'`,
      [sid]
    );
    if (!rows.length) throw new Error('لا توجد فترة نشطة لإيقافها');
    for (const r of rows) {
      await conn.query(`UPDATE subscription_periods SET status = 'closed' WHERE id = ?`, [r.id]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** إعادة تفعيل آخر فترة كانت موقوفة (مغلقة) عندما لا توجد فترة نشطة */
async function resumeSubscription(subscriptionId) {
  const sid = Number(subscriptionId);
  if (!sid) throw new Error('معرّف الاشتراك غير صالح');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await refreshExpiredSubscriptionPeriods();
    const [[sub]] = await conn.query('SELECT id FROM customer_subscriptions WHERE id = ?', [sid]);
    if (!sub) throw new Error('الاشتراك غير موجود');

    const [[active]] = await conn.query(
      `SELECT id FROM subscription_periods WHERE customer_subscription_id = ? AND status = 'active' LIMIT 1`,
      [sid]
    );
    if (active) throw new Error('الاشتراك مفعّل بالفعل — توجد فترة نشطة');

    const [[latest]] = await conn.query(
      `SELECT id, status FROM subscription_periods
       WHERE customer_subscription_id = ? ORDER BY id DESC LIMIT 1`,
      [sid]
    );
    if (!latest) throw new Error('لا توجد فترات لهذا الاشتراك');
    if (latest.status !== 'closed') {
      throw new Error('لا توجد فترة موقوفة لإعادة تفعيلها — آخر فترة ليست بحالة «مغلق»');
    }

    await conn.query(`UPDATE subscription_periods SET status = 'active' WHERE id = ?`, [latest.id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateActiveSubscriptionPeriod(data) {
  const { subscriptionId, periodFrom, periodTo, endDate, creditRemaining, createdBy } = data;
  const sid = Number(subscriptionId);
  if (!sid) throw new Error('معرّف الاشتراك غير صالح');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await refreshExpiredSubscriptionPeriods();

    const [[period]] = await conn.query(
      `SELECT * FROM subscription_periods
       WHERE customer_subscription_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`,
      [sid]
    );
    if (!period) throw new Error('لا توجد فترة نشطة للتعديل');

    const existingFromSql = toSqlDateTime(period.period_from);
    const existingTime = existingFromSql ? ' ' + existingFromSql.split(' ')[1] : '';
    const nowTs = new Date();
    const defaultTime = ` ${String(nowTs.getHours()).padStart(2,'0')}:${String(nowTs.getMinutes()).padStart(2,'0')}:${String(nowTs.getSeconds()).padStart(2,'0')}`;
    const pFrom =
      periodFrom != null && String(periodFrom).trim()
        ? toSqlDate(periodFrom) + (existingTime || defaultTime)
        : existingFromSql;
    const pTo =
      periodTo != null && String(periodTo).trim()
        ? toSqlDate(periodTo)
        : (period.period_to ? toSqlDate(period.period_to) : null);

    if (pFrom && pTo && pFrom > pTo) throw new Error('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية');

    let newCredit = Number(period.credit_remaining);
    if (creditRemaining != null && String(creditRemaining).trim() !== '') {
      newCredit = Number(creditRemaining);
      if (Number.isNaN(newCredit) || newCredit < 0) throw new Error('قيمة الرصيد غير صالحة');
    }

    const oldCredit = Number(period.credit_remaining);
    const delta = newCredit - oldCredit;

    const subEndDate = endDate !== undefined && endDate !== null && String(endDate).trim() 
      ? String(endDate).slice(0, 10) 
      : null;

    await conn.query(
      `UPDATE subscription_periods
       SET period_from = ?, period_to = ?, credit_remaining = ?
       WHERE id = ?`,
      [pFrom, pTo, newCredit, period.id]
    );

    await conn.query(
      `UPDATE customer_subscriptions
       SET end_date = ?
       WHERE id = ?`,
      [subEndDate, sid]
    );

    if (Math.abs(delta) > 0.0001) {
      await conn.query(
        `INSERT INTO subscription_ledger (subscription_period_id, entry_type, amount, balance_after, notes, created_by)
         VALUES (?, 'adjustment', ?, ?, ?, ?)`,
        [period.id, delta, newCredit, 'تعديل يدوي للرصيد', createdBy || null]
      );
    }

    await conn.commit();
    return { periodId: period.id };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteSubscription(subscriptionId) {
  const sid = Number(subscriptionId);
  if (!sid) throw new Error('معرّف الاشتراك غير صالح');
  const [[row]] = await pool.query('SELECT id FROM customer_subscriptions WHERE id = ?', [sid]);
  if (!row) throw new Error('الاشتراك غير موجود');
  await pool.query('DELETE FROM customer_subscriptions WHERE id = ?', [sid]);
}

async function getSubscriptionCustomerReportRows(customerId, subscriptionId) {
  await refreshExpiredSubscriptionPeriods();
  const cid = Number(customerId);
  if (!cid) return { customer: null, subscriptions: [], periods: [], ledger: [] };

  const [[customer]] = await pool.query('SELECT * FROM customers WHERE id = ?', [cid]);
  let subWhere = 'WHERE cs.customer_id = ?';
  const params = [cid];
  if (subscriptionId) {
    subWhere += ' AND cs.id = ?';
    params.push(Number(subscriptionId));
  }
  const [subs] = await pool.query(
    `SELECT cs.*, pp.name_ar AS package_name
     FROM customer_subscriptions cs
     LEFT JOIN prepaid_packages pp ON pp.id = cs.current_package_id
     ${subWhere}
     ORDER BY cs.id ASC`,
    params
  );

  const subIds = subs.map((s) => s.id);
  if (!subIds.length) {
    return { customer, subscriptions: subs, periods: [], ledger: [] };
  }
  const ph = subIds.map(() => '?').join(',');
  const [periods] = await pool.query(
    `SELECT sp.*, pp.name_ar AS package_name
     FROM subscription_periods sp
     INNER JOIN prepaid_packages pp ON pp.id = sp.package_id
     WHERE sp.customer_subscription_id IN (${ph})
     ORDER BY sp.customer_subscription_id ASC, sp.id ASC`,
    subIds
  );
  const periodIds = periods.map((p) => p.id);
  let ledger = [];
  if (periodIds.length) {
    const ph2 = periodIds.map(() => '?').join(',');
    const [led] = await pool.query(
      `SELECT sl.*, sp.customer_subscription_id
       FROM subscription_ledger sl
       INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
       WHERE sl.subscription_period_id IN (${ph2})
       ORDER BY sl.id ASC`,
      periodIds
    );
    ledger = led;
  }

  // جلب الفواتير المرتبطة بالاشتراك
  let invoices = [];
  if (periodIds.length) {
    const ph3 = periodIds.map(() => '?').join(',');
    const [invRows] = await pool.query(
      `SELECT o.id, o.order_number, o.invoice_seq, o.total_amount,
              o.payment_method, o.payment_status, o.created_at,
              sl.amount AS deducted_amount
       FROM subscription_ledger sl
       INNER JOIN orders o ON o.id = sl.ref_id
       WHERE sl.subscription_period_id IN (${ph3})
         AND sl.ref_type = 'order' AND sl.entry_type = 'consumption'
       ORDER BY o.id ASC`,
      periodIds
    );
    invoices = invRows;
  }

  return { customer, subscriptions: subs, periods, ledger, invoices };
}

async function query(sql, params = []) {
  return pool.query(sql, params);
}

const MAX_APP_SETTINGS_CUSTOM_FIELDS = 20;

async function migrateAppSettings() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INT NOT NULL PRIMARY KEY,
      laundry_name_ar VARCHAR(200) DEFAULT NULL,
      laundry_name_en VARCHAR(200) DEFAULT NULL,
      location_ar TEXT DEFAULT NULL,
      location_en TEXT DEFAULT NULL,
      phone VARCHAR(30) DEFAULT NULL,
      email VARCHAR(150) DEFAULT NULL,
      logo_blob LONGBLOB DEFAULT NULL,
      logo_mime VARCHAR(255) DEFAULT NULL,
      custom_fields_json JSON DEFAULT NULL,
      vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
      vat_number VARCHAR(50) DEFAULT NULL,
      commercial_register VARCHAR(50) DEFAULT NULL,
      building_number VARCHAR(20) DEFAULT NULL,
      street_name_ar VARCHAR(200) DEFAULT NULL,
      district_ar VARCHAR(120) DEFAULT NULL,
      city_ar VARCHAR(100) DEFAULT NULL,
      postal_code VARCHAR(20) DEFAULT NULL,
      additional_number VARCHAR(20) DEFAULT NULL,
      price_display_mode ENUM('inclusive','exclusive') NOT NULL DEFAULT 'exclusive',
      invoice_paper_type ENUM('thermal','a4') NOT NULL DEFAULT 'thermal',
      logo_width INT NOT NULL DEFAULT 180,
      logo_height INT NOT NULL DEFAULT 70,
      print_copies INT NOT NULL DEFAULT 1,
      enabled_payment_methods JSON DEFAULT NULL,
      default_payment_method VARCHAR(20) DEFAULT 'cash',
      require_hanger TINYINT(1) NOT NULL DEFAULT 0,
      require_customer_phone TINYINT(1) NOT NULL DEFAULT 0,
      allow_subscription_debt TINYINT(1) NOT NULL DEFAULT 0,
      barcode_auto_action VARCHAR(50) DEFAULT NULL,
      show_barcode_in_invoice TINYINT(1) NOT NULL DEFAULT 0,
      report_email_enabled TINYINT(1) NOT NULL DEFAULT 0,
      report_email_to VARCHAR(150) DEFAULT NULL,
      report_email_from VARCHAR(150) DEFAULT NULL,
      report_email_app_password_enc TEXT DEFAULT NULL,
      report_email_send_time VARCHAR(5) NOT NULL DEFAULT '09:00',
      report_email_last_status VARCHAR(20) DEFAULT NULL,
      report_email_last_error TEXT DEFAULT NULL,
      report_email_last_sent_at DATETIME DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN invoice_paper_type ENUM('thermal','a4') NOT NULL DEFAULT 'thermal' AFTER price_display_mode"
  ).catch(() => {});
  await pool.query(
    'ALTER TABLE app_settings ADD COLUMN logo_width INT NOT NULL DEFAULT 180 AFTER invoice_paper_type'
  ).catch(() => {});
  await pool.query(
    'ALTER TABLE app_settings ADD COLUMN logo_height INT NOT NULL DEFAULT 70 AFTER logo_width'
  ).catch(() => {});
  await pool.query(
    'ALTER TABLE app_settings ADD COLUMN print_copies INT NOT NULL DEFAULT 1 AFTER logo_height'
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN enabled_payment_methods JSON DEFAULT NULL AFTER print_copies"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN default_payment_method VARCHAR(20) DEFAULT 'cash' AFTER enabled_payment_methods"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN require_hanger TINYINT(1) NOT NULL DEFAULT 0 AFTER default_payment_method"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN require_customer_phone TINYINT(1) NOT NULL DEFAULT 0 AFTER require_hanger"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN allow_subscription_debt TINYINT(1) NOT NULL DEFAULT 0 AFTER require_customer_phone"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN barcode_auto_action VARCHAR(50) DEFAULT NULL AFTER allow_subscription_debt"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN show_barcode_in_invoice TINYINT(1) NOT NULL DEFAULT 0 AFTER barcode_auto_action"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER show_barcode_in_invoice"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_to VARCHAR(150) DEFAULT NULL AFTER report_email_enabled"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_from VARCHAR(150) DEFAULT NULL AFTER report_email_to"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_app_password_enc TEXT DEFAULT NULL AFTER report_email_from"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_send_time VARCHAR(5) NOT NULL DEFAULT '09:00' AFTER report_email_app_password_enc"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_last_status VARCHAR(20) DEFAULT NULL AFTER report_email_send_time"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_last_error TEXT DEFAULT NULL AFTER report_email_last_status"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN report_email_last_sent_at DATETIME DEFAULT NULL AFTER report_email_last_error"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN zatca_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER report_email_last_sent_at"
  ).catch(() => {});
  const [[cnt]] = await pool.query('SELECT COUNT(*) AS c FROM app_settings WHERE id = 1');
  if (Number(cnt.c) === 0) {
    await pool.query(
      `INSERT INTO app_settings (id, custom_fields_json, vat_rate, price_display_mode)
       VALUES (1, JSON_ARRAY(), 15.00, 'exclusive')`
    );
  }
}

function normalizeCustomFieldsJson(raw) {
  let arr = raw;
  if (arr == null) return [];
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (let i = 0; i < arr.length && out.length < MAX_APP_SETTINGS_CUSTOM_FIELDS; i++) {
    const x = arr[i];
    if (!x || typeof x !== 'object') continue;
    const id = String(x.id || `cf_${i}_${Date.now()}`).slice(0, 64);
    const labelAr = String(x.labelAr || x.label_ar || '').trim().slice(0, 120);
    const labelEn = String(x.labelEn || x.label_en || '').trim().slice(0, 120);
    const value = String(x.value || '').trim().slice(0, 500);
    if (!labelAr && !labelEn && !value) continue;
    out.push({ id, labelAr, labelEn, value });
  }
  return out;
}

async function getAppSettings() {
  await migrateAppSettings();
  const [[row]] = await pool.query(
    `SELECT id, laundry_name_ar, laundry_name_en, location_ar, location_en, invoice_notes, phone, email,
            logo_blob, logo_mime, custom_fields_json, vat_rate, vat_number, commercial_register,
            building_number, street_name_ar, district_ar, city_ar, postal_code, additional_number,
            price_display_mode, invoice_paper_type, logo_width, logo_height, print_copies,
            enabled_payment_methods, default_payment_method, require_hanger, require_customer_phone, allow_subscription_debt,
            barcode_auto_action, show_barcode_in_invoice,
            report_email_enabled, report_email_to, report_email_from, report_email_app_password_enc, report_email_send_time,
            report_email_last_status, report_email_last_error, report_email_last_sent_at,
            zatca_enabled,
            updated_at
     FROM app_settings WHERE id = 1`
  );
  if (!row) {
    await pool.query(
      `INSERT INTO app_settings (id, custom_fields_json, vat_rate, price_display_mode)
       VALUES (1, JSON_ARRAY(), 15.00, 'exclusive')`
    );
    return getAppSettings();
  }
  const customFields = normalizeCustomFieldsJson(row.custom_fields_json);
  return {
    id: row.id,
    laundryNameAr: row.laundry_name_ar || '',
    laundryNameEn: row.laundry_name_en || '',
    locationAr: row.location_ar || '',
    locationEn: row.location_en || '',
    invoiceNotes: row.invoice_notes || '',
    phone: row.phone || '',
    email: row.email || '',
    logoMime: row.logo_mime || null,
    logoGzipBuffer: row.logo_blob && row.logo_blob.length ? row.logo_blob : null,
    customFields,
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : 15,
    vatNumber: row.vat_number || '',
    commercialRegister: row.commercial_register || '',
    buildingNumber: row.building_number || '',
    streetNameAr: row.street_name_ar || '',
    districtAr: row.district_ar || '',
    cityAr: row.city_ar || '',
    postalCode: row.postal_code || '',
    additionalNumber: row.additional_number || '',
    priceDisplayMode: row.price_display_mode === 'inclusive' ? 'inclusive' : 'exclusive',
    invoicePaperType: row.invoice_paper_type === 'a4' ? 'a4' : 'thermal',
    logoWidth: Number(row.logo_width) > 0 ? Number(row.logo_width) : 180,
    logoHeight: Number(row.logo_height) > 0 ? Number(row.logo_height) : 70,
    printCopies: Number.isFinite(Number(row.print_copies)) && Number(row.print_copies) >= 0 ? Number(row.print_copies) : 1,
    enabledPaymentMethods: (() => {
      try {
        const parsed = typeof row.enabled_payment_methods === 'string'
          ? JSON.parse(row.enabled_payment_methods)
          : row.enabled_payment_methods;
        return Array.isArray(parsed) && parsed.length > 0
          ? parsed
          : ['cash', 'card', 'credit', 'mixed', 'bank'];
      } catch {
        return ['cash', 'card', 'credit', 'mixed', 'bank'];
      }
    })(),
    defaultPaymentMethod: (() => {
      const allMethods = ['cash', 'card', 'credit', 'mixed', 'bank'];
      const m = row.default_payment_method;
      return m && allMethods.includes(m) ? m : 'cash';
    })(),
    requireHanger: row.require_hanger === 1,
    requireCustomerPhone: row.require_customer_phone === 1,
    allowSubscriptionDebt: row.allow_subscription_debt === 1,
    barcodeAutoAction: row.barcode_auto_action || 'none',
    showBarcodeInInvoice: row.show_barcode_in_invoice === 1,
    reportEmailEnabled: row.report_email_enabled === 1,
    reportEmailTo: row.report_email_to || '',
    reportEmailFrom: row.report_email_from || '',
    reportEmailAppPasswordEnc: row.report_email_app_password_enc || null,
    reportEmailSendTime: row.report_email_send_time || '09:00',
    reportEmailLastStatus: row.report_email_last_status || '',
    reportEmailLastError: row.report_email_last_error || '',
    reportEmailLastSentAt: row.report_email_last_sent_at,
    zatcaEnabled: row.zatca_enabled === 1,
    updatedAt: row.updated_at
  };
}

async function saveAppSettings(data) {
  await migrateAppSettings();
  const s = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
  const laundryNameAr = s(data.laundryNameAr, 200);
  const laundryNameEn = s(data.laundryNameEn, 200);
  const locationAr = s(data.locationAr, 5000);
  const locationEn = s(data.locationEn, 5000);
  const invoiceNotes = s(data.invoiceNotes, 1000);
  const phone = s(data.phone, 30);
  const email = s(data.email, 150);
  const customFields = normalizeCustomFieldsJson(data.customFields);
  const customJson = JSON.stringify(customFields);

  let vatRate = Number(data.vatRate);
  if (Number.isNaN(vatRate) || vatRate < 0) vatRate = 0;
  if (vatRate > 100) vatRate = 100;

  const vatNumber = s(data.vatNumber, 50);
  const commercialRegister = s(data.commercialRegister, 50);
  const buildingNumber = s(data.buildingNumber, 20);
  const streetNameAr = s(data.streetNameAr, 200);
  const districtAr = s(data.districtAr, 120);
  const cityAr = s(data.cityAr, 100);
  const postalCode = s(data.postalCode, 20);
  const additionalNumber = s(data.additionalNumber, 20);
  const priceDisplayMode = data.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive';
  const invoicePaperType = data.invoicePaperType === 'a4' ? 'a4' : 'thermal';
  let logoWidth = Math.floor(Number(data.logoWidth));
  if (!Number.isFinite(logoWidth) || logoWidth < 1) logoWidth = 180;
  if (logoWidth > 2000) logoWidth = 2000;
  let logoHeight = Math.floor(Number(data.logoHeight));
  if (!Number.isFinite(logoHeight) || logoHeight < 1) logoHeight = 70;
  if (logoHeight > 2000) logoHeight = 2000;
  let printCopies = Math.floor(Number(data.printCopies));
  if (!Number.isFinite(printCopies) || printCopies < 0) printCopies = 1;
  if (printCopies > 20) printCopies = 20;

  const allMethods = ['cash', 'card', 'credit', 'mixed', 'bank'];
  let enabledPaymentMethods = Array.isArray(data.enabledPaymentMethods)
    ? data.enabledPaymentMethods.filter(m => allMethods.includes(m))
    : allMethods;
  if (enabledPaymentMethods.length === 0) enabledPaymentMethods = allMethods;
  const enabledPaymentJson = JSON.stringify(enabledPaymentMethods);

  const defaultPaymentMethod = (data.defaultPaymentMethod && allMethods.includes(data.defaultPaymentMethod))
    ? data.defaultPaymentMethod
    : (enabledPaymentMethods[0] || 'cash');
  const requireHanger = data.requireHanger === true ? 1 : 0;
  const requireCustomerPhone = data.requireCustomerPhone === true ? 1 : 0;
  const allowSubscriptionDebt = data.allowSubscriptionDebt === true ? 1 : 0;
  const barcodeAutoAction = (() => {
    const v = String(data.barcodeAutoAction || 'none').trim();
    if (v === 'none') return 'none';
    const valid = ['pay', 'clean', 'deliver'];
    const parts = v.split(',').filter(p => valid.includes(p));
    return parts.length ? parts.join(',') : 'none';
  })();
  const reportEmailEnabled = data.reportEmailEnabled === true ? 1 : 0;
  const reportEmailFrom = s(data.reportEmailFrom, 150);
  const reportEmailSendTime = (() => {
    const v = s(data.reportEmailSendTime, 5);
    return /^\d{2}:\d{2}$/.test(v) ? v : '09:00';
  })();
  const reportEmailAppPasswordEnc = data.reportEmailAppPasswordEnc == null
    ? null
    : String(data.reportEmailAppPasswordEnc).trim().slice(0, 5000);
  const zatcaEnabled = data.zatcaEnabled === true ? 1 : 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE app_settings SET
        laundry_name_ar = ?, laundry_name_en = ?, location_ar = ?, location_en = ?, invoice_notes = ?, phone = ?, email = ?,
        custom_fields_json = CAST(? AS JSON), vat_rate = ?, vat_number = ?, commercial_register = ?,
        building_number = ?, street_name_ar = ?, district_ar = ?, city_ar = ?, postal_code = ?, additional_number = ?,
        price_display_mode = ?, invoice_paper_type = ?, logo_width = ?, logo_height = ?, print_copies = ?,
        enabled_payment_methods = CAST(? AS JSON), default_payment_method = ?, require_hanger = ?, require_customer_phone = ?, allow_subscription_debt = ?,
        barcode_auto_action = ?, show_barcode_in_invoice = ?,
        report_email_enabled = ?, report_email_from = ?, report_email_app_password_enc = ?, report_email_send_time = ?,
        zatca_enabled = ?
       WHERE id = 1`,
      [
        laundryNameAr || null,
        laundryNameEn || null,
        locationAr || null,
        locationEn || null,
        invoiceNotes || null,
        phone || null,
        email || null,
        customJson,
        vatRate,
        vatNumber || null,
        commercialRegister || null,
        buildingNumber || null,
        streetNameAr || null,
        districtAr || null,
        cityAr || null,
        postalCode || null,
        additionalNumber || null,
        priceDisplayMode,
        invoicePaperType,
        logoWidth,
        logoHeight,
        printCopies,
        enabledPaymentJson,
        defaultPaymentMethod,
        requireHanger,
        requireCustomerPhone,
        allowSubscriptionDebt,
        barcodeAutoAction,
        data.showBarcodeInInvoice ? 1 : 0,
        reportEmailEnabled,
        reportEmailFrom || null,
        reportEmailAppPasswordEnc,
        reportEmailSendTime,
        zatcaEnabled
      ]
    );

    if (data.clearLogo === true) {
      await conn.query('UPDATE app_settings SET logo_blob = NULL, logo_mime = NULL WHERE id = 1');
    } else if (Buffer.isBuffer(data.logoGzipBuffer)) {
      await conn.query('UPDATE app_settings SET logo_blob = ?, logo_mime = ? WHERE id = 1', [
        data.logoGzipBuffer,
        data.logoMime || 'application/octet-stream'
      ]);
    }

    await conn.commit();
    return { success: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function createOrdersTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id               INT AUTO_INCREMENT PRIMARY KEY,
      order_number     VARCHAR(20)  NOT NULL UNIQUE,
      invoice_seq      INT          NULL,
      customer_id      INT          NULL,
      subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
      extra_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_rate         DECIMAL(5,2)  NOT NULL DEFAULT 15,
      vat_amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method   ENUM('cash','card','other') NOT NULL DEFAULT 'cash',
      notes            TEXT         DEFAULT NULL,
      created_by       VARCHAR(100) DEFAULT NULL,
      created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
        REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      order_id            INT NOT NULL,
      product_id          INT NOT NULL,
      laundry_service_id  INT NOT NULL,
      quantity            INT NOT NULL DEFAULT 1,
      unit_price          DECIMAL(10,2) NOT NULL,
      line_total          DECIMAL(10,2) NOT NULL,
      CONSTRAINT fk_oi_order   FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
      CONSTRAINT fk_oi_service FOREIGN KEY (laundry_service_id) REFERENCES laundry_services(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Migration: add invoice_seq column if missing
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'invoice_seq'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN invoice_seq INT NULL`);
      // Backfill invoice_seq for existing orders
      await pool.query(`UPDATE orders SET invoice_seq = id WHERE invoice_seq IS NULL`);
    }
  } catch (e) {
    console.error('migrate invoice_seq:', e);
  }
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'price_display_mode'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN price_display_mode ENUM('inclusive','exclusive') NOT NULL DEFAULT 'exclusive'`);
    }
  } catch (e) {
    console.error('migrate price_display_mode:', e);
  }
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'starch'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN starch VARCHAR(50) DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrate starch:', e);
  }
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'bluing'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN bluing VARCHAR(50) DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrate bluing:', e);
  }
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'extra_amount'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN extra_amount DECIMAL(10,2) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error('migrate extra_amount:', e);
  }
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'discount_label'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE orders ADD COLUMN discount_label VARCHAR(255) DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrate discount_label:', e);
  }
}

async function generateOrderNumber() {
  const [[row]] = await pool.query('SELECT COALESCE(MAX(CAST(order_number AS UNSIGNED)), 0) + 1 AS next_num FROM orders');
  return String(row.next_num);
}

async function getPosProducts() {
  const [products] = await pool.query(`
    SELECT p.id, p.name_ar, p.name_en, p.sort_order, p.image_mime,
           (p.image_blob IS NOT NULL AND LENGTH(p.image_blob) > 0) AS has_image
    FROM products p
    WHERE p.is_active = 1
    ORDER BY p.sort_order ASC, p.id ASC
  `);
  const [priceLines] = await pool.query(`
    SELECT ppl.product_id, ppl.laundry_service_id, ppl.price,
           ls.name_ar AS service_name_ar, ls.name_en AS service_name_en
    FROM product_price_lines ppl
    JOIN laundry_services ls ON ls.id = ppl.laundry_service_id AND ls.is_active = 1
    ORDER BY ls.sort_order ASC, ls.id ASC
  `);
  const lineMap = new Map();
  for (const pl of priceLines) {
    if (!lineMap.has(pl.product_id)) lineMap.set(pl.product_id, []);
    lineMap.get(pl.product_id).push(pl);
  }
  return products.map((p) => ({ ...p, priceLines: lineMap.get(p.id) || [] }));
}

async function getPosServices() {
  const [rows] = await pool.query(`
    SELECT id, name_ar, name_en
    FROM laundry_services
    WHERE is_active = 1
    ORDER BY sort_order ASC, id ASC
  `);
  return rows;
}

function buildZatcaTlvBase64({ sellerName, vatNumber, timestamp, totalAmount, vatAmount }) {
  const enc = (tag, value) => {
    const bytes = Buffer.from(String(value || ''), 'utf8');
    const out = Buffer.alloc(2 + bytes.length);
    out[0] = tag;
    out[1] = bytes.length;
    bytes.copy(out, 2);
    return out;
  };
  const parts = [
    enc(1, sellerName || ''),
    enc(2, vatNumber || ''),
    enc(3, timestamp || ''),
    enc(4, totalAmount || '0.00'),
    enc(5, vatAmount || '0.00'),
  ];
  return Buffer.concat(parts).toString('base64');
}

async function createOrder({ orderNumber, customerId, items, subtotal, discountAmount, discountLabel, extraAmount = 0,
  vatRate, vatAmount, totalAmount, paymentMethod, paidCash = 0, paidCard = 0,
  starch, bluing, notes, createdBy, priceDisplayMode, hangerId, allowSubscriptionDebt }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let pm = paymentMethod || 'cash';
    const pdm = priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive';

    // ── تحقق مسبق من الاشتراك لتحديد طريقة الدفع ──
    let subscriptionDeduction = null;
    if (customerId) {
      try {
        const [[activePeriod]] = await conn.query(
          `SELECT sp.id, sp.credit_remaining
           FROM subscription_periods sp
           INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
           WHERE cs.customer_id = ? AND sp.status = 'active'
           ORDER BY sp.id DESC
           LIMIT 1`,
          [Number(customerId)]
        );
        if (activePeriod) {
          const creditRemaining = Number(activePeriod.credit_remaining);
          if (creditRemaining > 0 && creditRemaining >= Number(totalAmount)) {
            // الاشتراك يغطي الفاتورة بالكامل
            const deductAmount = Number(totalAmount);
            const newBalance = creditRemaining - deductAmount;
            pm = 'subscription';
            subscriptionDeduction = { periodId: activePeriod.id, deductAmount, newBalance };
            console.log(`[createOrder] Subscription fully covers invoice: total=${totalAmount}, credit=${creditRemaining}, setting payment_method=subscription`);
          } else if (allowSubscriptionDebt && Number(totalAmount) > 0) {
            // السماح بالمديونية: خصم المبلغ بالكامل والباقي بالسالب
            const deductAmount = Number(totalAmount);
            const newBalance = creditRemaining - deductAmount;
            pm = 'subscription';
            subscriptionDeduction = { periodId: activePeriod.id, deductAmount, newBalance };
            console.log(`[createOrder] Subscription debt allowed: total=${totalAmount}, credit=${creditRemaining}, newBalance=${newBalance}`);
          } else if (creditRemaining > 0 && Number(totalAmount) > creditRemaining) {
            // عدم السماح بالمديونية ومبلغ الفاتورة أكبر من رصيد الاشتراك → منع البيع
            throw new Error(`مبلغ الفاتورة (${Number(totalAmount).toFixed(2)} ر.س) أكبر من رصيد الاشتراك المتاح (${creditRemaining.toFixed(2)} ر.س) — يرجى تفعيل السماح بالمديونية أو تجديد الاشتراك`);
          } else if (creditRemaining <= 0) {
            // عدم السماح بالمديونية ورصيد الاشتراك 0 أو سالب → منع البيع
            throw new Error('رصيد الاشتراك نفد — يرجى تجديد الاشتراك أولاً قبل إتمام العملية');
          }
        } else {
          console.log(`[createOrder] No active subscription for customer=${customerId}`);
        }
      } catch (subErr) {
        if (subErr.message && (subErr.message.includes('رصيد الاشتراك نفد') || subErr.message.includes('أكبر من رصيد الاشتراك المتاح'))) throw subErr;
        console.error('subscription pre-check error:', subErr);
      }
    }

    const payStatus = pm === 'credit' ? 'pending' : 'paid';
    const paidAt    = pm === 'credit' ? null : new Date();

    // Calculate paid_amount and remaining_amount based on payment method
    const paidAmount = pm === 'credit' ? 0 : totalAmount;
    const remainingAmount = pm === 'credit' ? totalAmount : 0;

    // Mixed payment breakdown (cash + card) stored only when payment_method == 'mixed'
    let dbPaidCash = 0;
    let dbPaidCard = 0;
    if (pm === 'mixed') {
      const total = Number(totalAmount) || 0;
      dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), total));
      dbPaidCard = Math.max(0, total - dbPaidCash);
      dbPaidCash = Math.round(dbPaidCash * 100) / 100;
      dbPaidCard = Math.round(dbPaidCard * 100) / 100;
    }

    // Get next invoice_seq
    const [[seqRow]] = await conn.query('SELECT COALESCE(MAX(invoice_seq), 0) + 1 AS next_seq FROM orders');
    const invoiceSeq = seqRow.next_seq;
    const [result] = await conn.query(
      `INSERT INTO orders
         (order_number, invoice_seq, customer_id, subtotal, discount_amount, discount_label, extra_amount, vat_rate, vat_amount,
         total_amount, paid_amount, remaining_amount, paid_cash, paid_card,
         payment_method, payment_status, paid_at, notes, created_by, price_display_mode, starch, bluing, hanger_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, invoiceSeq, customerId || null, subtotal, discountAmount || 0, discountLabel || null, extraAmount || 0, vatRate || 0,
        vatAmount || 0, totalAmount, paidAmount, remainingAmount, dbPaidCash, dbPaidCard,
        pm, payStatus, paidAt, notes || null, createdBy || null, pdm,
        starch || null, bluing || null, hangerId || null]
    );
    const orderId = result.insertId;

    // ── ZATCA QR (TLV) using DB settings ──
    let zatcaQr = null;
    try {
      const [[zs]] = await conn.query(
        `SELECT company_name, vat_number FROM zatca_settings WHERE id = 1`
      );
      const sellerName = zs && zs.company_name ? String(zs.company_name).trim() : '';
      const vatNum = zs && zs.vat_number ? String(zs.vat_number).trim() : '';
      if (sellerName && vatNum) {
        const t = new Date();
        const iso = isNaN(t.getTime()) ? '' : t.toISOString();
        const totalStr = (Number(totalAmount) || 0).toFixed(2);
        const vatStr = (Number(vatAmount) || 0).toFixed(2);
        const tlvB64 = buildZatcaTlvBase64({
          sellerName,
          vatNumber: vatNum,
          timestamp: iso,
          totalAmount: totalStr,
          vatAmount: vatStr
        });
        await conn.query(
          `UPDATE orders SET zatca_qr = ?, zatca_submitted = NOW() WHERE id = ?`,
          [tlvB64, orderId]
        );
        zatcaQr = tlvB64;
      }
    } catch (e) {
      console.error('zatca qr update error:', e);
    }

    // ── ربط الشماعة بالفاتورة ──
    if (hangerId) {
      try {
        await conn.query(`UPDATE hangers SET status = 'occupied' WHERE id = ?`, [Number(hangerId)]);
      } catch (hangerErr) {
        console.error('hanger update error:', hangerErr);
      }
    }
    for (const item of (items || [])) {
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, laundry_service_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.serviceId, item.quantity, item.unitPrice, item.lineTotal]
      );
    }

    // ── خصم من رصيد الاشتراك إن وُجد ──
    if (subscriptionDeduction) {
      try {
        await conn.query(
          `UPDATE subscription_periods SET credit_remaining = ? WHERE id = ?`,
          [subscriptionDeduction.newBalance, subscriptionDeduction.periodId]
        );
        await conn.query(
          `INSERT INTO subscription_ledger
             (subscription_period_id, entry_type, amount, balance_after, ref_type, ref_id, notes, created_by)
           VALUES (?, 'consumption', ?, ?, 'order', ?, ?, ?)`,
          [subscriptionDeduction.periodId, subscriptionDeduction.deductAmount, subscriptionDeduction.newBalance, orderId,
            `فاتورة رقم ${invoiceSeq}`, createdBy || null]
        );
      } catch (subErr) {
        console.error('subscription deduction error:', subErr);
      }
    }

    await conn.commit();
    return { id: orderId, orderNumber, invoiceSeq, paymentMethod: pm, zatcaQr };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getOrdersBySubscription(subscriptionId) {
  const sid = Number(subscriptionId);
  if (!sid) return [];
  const [rows] = await pool.query(
    `SELECT o.id, o.order_number, o.invoice_seq, o.total_amount,
            o.payment_method, o.payment_status, o.created_at,
            sl.amount AS deducted_amount
     FROM subscription_ledger sl
     INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
     INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
     INNER JOIN orders o ON o.id = sl.ref_id
     WHERE cs.id = ? AND sl.ref_type = 'order' AND sl.entry_type = 'consumption'
     ORDER BY o.id DESC`,
    [sid]
  );
  return rows;
}

async function getSubscriptionInvoices({ page = 1, pageSize = 50, search = '', dateFrom = '', dateTo = '' } = {}) {
  const offset = (page - 1) * pageSize;
  const like = `%${search}%`;

  let where = `WHERE sl.ref_type = 'order' AND sl.entry_type = 'consumption'
    AND (o.order_number LIKE ? OR COALESCE(c.customer_name,'') LIKE ? OR COALESCE(c.phone,'') LIKE ?)`;
  const params = [like, like, like];

  if (dateFrom) {
    where += ' AND DATE(o.created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND DATE(o.created_at) <= ?';
    params.push(dateTo);
  }

  const [rows] = await pool.query(`
    SELECT o.id, o.order_number, o.invoice_seq, o.total_amount,
           o.payment_method, o.payment_status, o.created_at,
           sl.amount AS deducted_amount,
           c.customer_name, c.phone
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    INNER JOIN orders o ON o.id = sl.ref_id
    LEFT JOIN customers c ON c.id = o.customer_id
    ${where}
    ORDER BY o.id DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  const [[{ total }]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    INNER JOIN orders o ON o.id = sl.ref_id
    LEFT JOIN customers c ON c.id = o.customer_id
    ${where}
  `, params);

  return { orders: rows, total, page, pageSize };
}

async function getOrders({ page = 1, pageSize = 50, search = '', dateFrom = '', dateTo = '' } = {}) {
  const offset = (page - 1) * pageSize;
  const like = `%${search}%`;

  let whereClauses = 'WHERE (o.order_number LIKE ? OR COALESCE(c.customer_name,\'\') LIKE ? OR COALESCE(c.phone,\'\') LIKE ?)';
  const params = [like, like, like];

  if (dateFrom) {
    whereClauses += ' AND DATE(o.created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses += ' AND DATE(o.created_at) <= ?';
    params.push(dateTo);
  }

  const [rows] = await pool.query(`
    SELECT o.id, o.order_number, o.invoice_seq, o.subtotal, o.discount_amount, o.discount_label, o.extra_amount, o.vat_rate, o.vat_amount,
           o.total_amount, o.payment_method, o.payment_status, o.paid_amount, o.remaining_amount, 
           o.created_at, o.created_by, o.price_display_mode,
           o.zatca_uuid, o.zatca_hash, o.zatca_qr, o.zatca_submitted, o.zatca_status, o.zatca_rejection_reason, o.zatca_response,
           c.customer_name, c.phone
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${whereClauses}
    ORDER BY o.id DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  const [[{ total }]] = await pool.query(`
    SELECT COUNT(*) AS total FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${whereClauses}
  `, params);

  return { orders: rows, total, page, pageSize };
}

async function getOrderById(id) {
  const [[order]] = await pool.query(`
    SELECT o.id, o.order_number, o.invoice_seq, o.customer_id, o.subtotal, o.discount_amount, o.discount_label, o.extra_amount, o.vat_rate, o.vat_amount,
           o.total_amount, o.paid_amount, o.remaining_amount, o.paid_cash, o.paid_card,
           o.payment_method, o.payment_status, o.notes, o.created_at, o.created_by,
           o.paid_at, o.cleaning_date, o.delivery_date, o.price_display_mode, o.starch, o.bluing,
           o.hanger_id, h.hanger_number,
           o.zatca_uuid, o.zatca_hash, o.zatca_qr, o.zatca_submitted, o.zatca_status, o.zatca_rejection_reason, o.zatca_response,
           c.customer_name, c.phone, c.tax_number AS customer_vat, c.address AS customer_address, c.city AS customer_city
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN hangers h ON h.id = o.hanger_id
    WHERE o.id = ?
  `, [id]);
  if (!order) return null;

  const [items] = await pool.query(`
    SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.line_total,
           p.name_ar AS product_name_ar, p.name_en AS product_name_en,
           ls.name_ar AS service_name_ar, ls.name_en AS service_name_en
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN laundry_services ls ON ls.id = oi.laundry_service_id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `, [id]);

  // جلب رصيد الاشتراك المتبقي بعد هذه الفاتورة (من سجل الاشتراك)
  let subscription = null;
  try {
    const [[ledgerRow]] = await pool.query(`
      SELECT sl.balance_after, pp.name_ar AS package_name, c.subscription_number
      FROM subscription_ledger sl
      INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
      INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
      INNER JOIN prepaid_packages pp ON pp.id = sp.package_id
      INNER JOIN orders o ON o.id = ?
      INNER JOIN customers c ON c.id = o.customer_id
      WHERE sl.ref_type = 'order' AND sl.ref_id = ?
      LIMIT 1
    `, [id, id]);
    if (ledgerRow) {
      subscription = {
        package_name: ledgerRow.package_name,
        credit_remaining: ledgerRow.balance_after,
        subscription_number: ledgerRow.subscription_number
      };
    }
  } catch (_) {}

  // إذا لم يوجد سجل في ledger (فاتورة آجلة لم تُسدَّد بعد)، نجلب الاشتراك النشط للعميل
  if (!subscription) {
    try {
      const [[activeRow]] = await pool.query(`
        SELECT pp.name_ar AS package_name, sp.credit_remaining, c.subscription_number
        FROM customer_subscriptions cs
        INNER JOIN subscription_periods sp ON sp.customer_subscription_id = cs.id
        INNER JOIN prepaid_packages pp ON pp.id = sp.package_id
        INNER JOIN orders o ON o.customer_id = cs.customer_id
        INNER JOIN customers c ON c.id = o.customer_id
        WHERE o.id = ?
        ORDER BY sp.id DESC
        LIMIT 1
      `, [id]);
      if (activeRow) {
        subscription = {
          package_name: activeRow.package_name,
          credit_remaining: activeRow.credit_remaining,
          subscription_number: activeRow.subscription_number
        };
      }
    } catch (_) {}
  }

  return { order, items, subscription };
}

async function migrateOrdersDeferredColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const colMap = new Map(cols.map(c => [c.COLUMN_NAME, String(c.COLUMN_TYPE).toLowerCase()]));

    if (colMap.has('payment_method') && colMap.get('payment_method').startsWith('enum')) {
      await pool.query(`ALTER TABLE orders MODIFY COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'cash'`);
    }

    if (!colMap.has('payment_status')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'paid'`);
      await pool.query(`UPDATE orders SET payment_status = 'pending' WHERE payment_method = 'credit'`);
    }

    if (!colMap.has('paid_at')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL DEFAULT NULL`);
      await pool.query(`UPDATE orders SET paid_at = created_at WHERE payment_status = 'paid' AND paid_at IS NULL`);
    }

    if (!colMap.has('cleaning_date')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN cleaning_date DATETIME NULL DEFAULT NULL`);
    }

    if (!colMap.has('delivery_date')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN delivery_date DATETIME NULL DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrateOrdersDeferredColumns:', e);
  }
}

async function migratePartialInvoicePayments() {
  try {
    // Check if invoice_payments table exists
    const [[tableExists]] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'invoice_payments'`
    );

    if (!tableExists.c) {
      // Create invoice_payments table
      await pool.query(`
        CREATE TABLE invoice_payments (
          id                INT AUTO_INCREMENT PRIMARY KEY,
          order_id          INT NOT NULL,
          payment_amount    DECIMAL(10,2) NOT NULL,
          payment_method    VARCHAR(30) NOT NULL DEFAULT 'cash',
          payment_date      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by        VARCHAR(100) NOT NULL,
          notes             TEXT DEFAULT NULL,
          
          CONSTRAINT fk_ip_order 
            FOREIGN KEY (order_id) 
            REFERENCES orders(id) 
            ON DELETE CASCADE,
            
          INDEX idx_order_date (order_id, payment_date DESC)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    // Check and add columns to orders table
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    if (!colSet.has('paid_amount')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_amount`);
    }

    if (!colSet.has('remaining_amount')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN remaining_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER paid_amount`);
    }

    if (!colSet.has('fully_paid_at')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN fully_paid_at TIMESTAMP NULL DEFAULT NULL AFTER payment_status`);
    }

    // Backfill existing orders - fix any orders where paid_amount and remaining_amount are both 0
    // This handles both new columns and any data inconsistencies
    await pool.query(`
      UPDATE orders 
      SET paid_amount = CASE 
        WHEN payment_status = 'paid' THEN total_amount 
        ELSE 0 
      END,
      remaining_amount = CASE 
        WHEN payment_status = 'paid' THEN 0 
        ELSE total_amount 
      END,
      fully_paid_at = CASE 
        WHEN payment_status = 'paid' THEN COALESCE(paid_at, fully_paid_at) 
        ELSE NULL 
      END
      WHERE (paid_amount = 0 AND remaining_amount = 0) 
         OR (payment_status = 'pending' AND remaining_amount = 0)
         OR (payment_status = 'paid' AND paid_amount = 0)
    `);

  } catch (e) {
    console.error('migratePartialInvoicePayments:', e);
  }
}

async function getDeferredOrders({ search = '', statusFilter = 'unpaid' } = {}) {
  const trimmed = (search || '').trim();
  const normalizedStatusFilter = String(statusFilter || 'unpaid').toLowerCase();

  if (trimmed) {
    const isNumeric = /^\d+$/.test(trimmed);
    const params = [];
    let whereClause;
    let includeDeferredOnly = true;

    if (isNumeric) {
      if (trimmed.length >= 7) {
        // رقم طويل → بحث في الجوال فقط (مطابقة تامة أو جزئية من البداية)
        whereClause = `COALESCE(c.phone, '') LIKE ?`;
        params.push(`${trimmed}%`);
      } else {
        // رقم قصير → مطابقة تامة لرقم الفاتورة فقط
        whereClause = `o.invoice_seq = ?`;
        params.push(Number(trimmed));
        includeDeferredOnly = false;
      }
    } else {
      // نص → بحث جزئي في اسم العميل
      whereClause = `COALESCE(c.customer_name, '') LIKE ?`;
      params.push(`%${trimmed}%`);
    }

    if (['paid', 'settled', 'cleaned', 'delivered'].includes(normalizedStatusFilter)) {
      includeDeferredOnly = false;
    }

    const statusClause = includeDeferredOnly ? `AND o.payment_status IN ('pending','partial')` : '';

    const [rows] = await pool.query(`
      SELECT
        o.id, o.order_number, o.invoice_seq, o.total_amount,
        o.paid_amount, o.remaining_amount, o.fully_paid_at,
        o.payment_method, o.payment_status,
        o.created_at, o.paid_at, o.cleaning_date, o.delivery_date,
        o.notes,
        c.id AS customer_id, c.customer_name, c.phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE ${whereClause}
      ${statusClause}
      ORDER BY FIELD(o.payment_status, 'partial', 'pending', 'paid'), o.created_at DESC
      LIMIT 2000
    `, params);
    return rows;
  } else {
    const [rows] = await pool.query(`
      SELECT
        o.id, o.order_number, o.invoice_seq, o.total_amount,
        o.paid_amount, o.remaining_amount, o.fully_paid_at,
        o.payment_method, o.payment_status,
        o.created_at, o.paid_at, o.cleaning_date, o.delivery_date,
        o.notes,
        c.id AS customer_id, c.customer_name, c.phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.payment_status IN ('pending','partial')
      ORDER BY FIELD(o.payment_status, 'partial', 'pending'), o.created_at DESC
      LIMIT 2000
    `);
    return rows;
  }
}

async function payDeferredOrder({ orderId, paymentMethod, paidCash = 0, paidCard = 0 }) {
  const id = Number(orderId);
  if (!id) throw new Error('معرّف الفاتورة غير صالح');
  const pm = String(paymentMethod || 'cash');
  let dbPaidCash = 0;
  let dbPaidCard = 0;

  if (pm === 'mixed') {
    const [[ord]] = await pool.query('SELECT total_amount FROM orders WHERE id = ?', [id]);
    const total = Number((ord && ord.total_amount) || 0);
    dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), total));
    dbPaidCard = Math.max(0, total - dbPaidCash);
    dbPaidCash = Math.round(dbPaidCash * 100) / 100;
    dbPaidCard = Math.round(dbPaidCard * 100) / 100;
  }

  const [result] = await pool.query(`
    UPDATE orders
    SET payment_status   = 'paid',
        paid_at          = NOW(),
        paid_amount      = total_amount,
        remaining_amount = 0,
        payment_method   = ?,
        paid_cash        = ?,
        paid_card        = ?
    WHERE id = ? AND payment_status = 'pending'
  `, [pm, dbPaidCash, dbPaidCard, id]);
  if (result.affectedRows === 0) throw new Error('الفاتورة غير موجودة أو تم سدادها مسبقاً');
}

async function markOrderCleaned({ orderId }) {
  const id = Number(orderId);
  if (!id) throw new Error('معرّف الفاتورة غير صالح');
  await pool.query(`UPDATE orders SET cleaning_date = NOW() WHERE id = ?`, [id]);
}

async function markOrderDelivered({ orderId }) {
  const id = Number(orderId);
  if (!id) throw new Error('معرّف الفاتورة غير صالح');
  await pool.query(`UPDATE orders SET delivery_date = NOW() WHERE id = ?`, [id]);
  // تحرير الشماعة المرتبطة بالفاتورة
  try {
    await pool.query(
      `UPDATE hangers SET status = 'free' WHERE id = (SELECT hanger_id FROM orders WHERE id = ? AND hanger_id IS NOT NULL)`,
      [id]
    );
  } catch (e) {
    console.error('markOrderDelivered hanger release error:', e);
  }
}

// ============================================================================
// Partial Invoice Payment Functions
// ============================================================================

/**
 * Calculate remaining balance
 */
function calculateRemainingBalance(totalAmount, paidAmount) {
  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount) || 0;
  return Math.max(0, total - paid);
}

/**
 * Determine payment status based on amounts
 */
function determinePaymentStatus(totalAmount, paidAmount) {
  const total = Number(totalAmount) || 0;
  const paid = Number(paidAmount) || 0;
  
  if (paid === 0) return 'pending';
  if (paid >= total) return 'paid';
  return 'partial';
}

/**
 * Validate payment amount
 */
function validatePaymentAmount(amount, remainingAmount) {
  const amt = Number(amount);
  const remaining = Number(remainingAmount);
  
  if (!Number.isFinite(amt) || amt <= 0) {
    const e = new Error('المبلغ المدخل غير صحيح');
    e.appCode = 'AMOUNT_ZERO_OR_NEGATIVE';
    throw e;
  }
  
  if (amt > remaining) {
    const e = new Error('المبلغ المدخل يتجاوز المبلغ المتبقي');
    e.appCode = 'AMOUNT_EXCEEDS_REMAINING';
    throw e;
  }
  
  // Round to 2 decimal places
  return Math.round(amt * 100) / 100;
}

/**
 * Get invoice with payment history
 */
async function getInvoiceWithPayments(orderId) {
  const id = Number(orderId);
  if (!id) {
    const e = new Error('معرّف الفاتورة غير صالح');
    e.appCode = 'INVOICE_NOT_FOUND';
    throw e;
  }

  // Get invoice details
  const [[invoice]] = await pool.query(`
    SELECT 
      o.id, o.order_number, o.invoice_seq, o.total_amount,
      o.paid_amount, o.remaining_amount, o.payment_status, o.fully_paid_at,
      o.paid_cash, o.paid_card,
      o.payment_method, o.created_at, o.notes,
      c.id AS customer_id, c.customer_name, c.phone
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.id = ?
  `, [id]);

  if (!invoice) {
    const e = new Error('الفاتورة غير موجودة');
    e.appCode = 'INVOICE_NOT_FOUND';
    throw e;
  }

  // Get payment history
  const [payments] = await pool.query(`
    SELECT 
      id, payment_amount, payment_method, cash_amount, card_amount, payment_date, created_by, notes
    FROM invoice_payments
    WHERE order_id = ?
    ORDER BY payment_date DESC, id DESC
  `, [id]);

  return {
    success: true,
    invoice,
    payments
  };
}

/**
 * Record a new invoice payment
 */
async function recordInvoicePayment({ orderId, paymentAmount, paymentMethod,
  cashAmount = 0, cardAmount = 0, createdBy, notes }) {
  const id = Number(orderId);
  if (!id) {
    const e = new Error('معرّف الفاتورة غير صالح');
    e.appCode = 'INVOICE_NOT_FOUND';
    throw e;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get current invoice state
    const [[invoice]] = await conn.query(`
      SELECT id, total_amount, paid_amount, remaining_amount, payment_status
      FROM orders
      WHERE id = ?
      FOR UPDATE
    `, [id]);

    if (!invoice) {
      const e = new Error('الفاتورة غير موجودة');
      e.appCode = 'INVOICE_NOT_FOUND';
      throw e;
    }

    if (invoice.payment_status === 'paid' && invoice.remaining_amount === 0) {
      const e = new Error('هذه الفاتورة مدفوعة بالكامل');
      e.appCode = 'INVOICE_ALREADY_PAID';
      throw e;
    }

    // Validate payment amount
    const validatedAmount = validatePaymentAmount(paymentAmount, invoice.remaining_amount);

    let dbCash = 0;
    let dbCard = 0;
    const pm = String(paymentMethod || 'cash');
    if (pm === 'mixed') {
      dbCash = Math.max(0, Math.min(Number(cashAmount || 0), validatedAmount));
      dbCard = Math.max(0, validatedAmount - dbCash);
      dbCash = Math.round(dbCash * 100) / 100;
      dbCard = Math.round(dbCard * 100) / 100;
    }

    // Insert payment record
    const [paymentResult] = await conn.query(`
      INSERT INTO invoice_payments (order_id, payment_amount, payment_method, cash_amount, card_amount, created_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, validatedAmount, pm, dbCash, dbCard, createdBy || 'system', notes || null]);

    // Calculate new amounts
    const newPaidAmount = Number(invoice.paid_amount) + validatedAmount;
    const newRemainingAmount = calculateRemainingBalance(invoice.total_amount, newPaidAmount);
    const newPaymentStatus = determinePaymentStatus(invoice.total_amount, newPaidAmount);
    const fullyPaidAt = newPaymentStatus === 'paid' ? new Date() : null;

    // Update invoice
    // إذا تم السداد الكامل، نحدث payment_method + نجمع كاش/شبكة من كل الدفعات
    if (newPaymentStatus === 'paid') {
      // Aggregate cash/card from ALL invoice_payments (including this one just inserted)
      const [[agg]] = await conn.query(`
        SELECT
          COALESCE(SUM(CASE
            WHEN payment_method = 'cash'  THEN payment_amount
            WHEN payment_method = 'mixed' THEN cash_amount
            ELSE 0
          END), 0) AS tot_cash,
          COALESCE(SUM(CASE
            WHEN payment_method = 'card'  THEN payment_amount
            WHEN payment_method = 'mixed' THEN card_amount
            ELSE 0
          END), 0) AS tot_card
        FROM invoice_payments WHERE order_id = ?
      `, [id]);

      // Also include any paid_cash/paid_card already stored on the order
      // (e.g. original createOrder with mixed)
      const [[ordRow]] = await conn.query(
        `SELECT paid_cash, paid_card FROM orders WHERE id = ?`, [id]
      );
      const totCash = Math.round(
        (Number(agg.tot_cash) + Number(ordRow.paid_cash || 0)) * 100
      ) / 100;
      const totCard = Math.round(
        (Number(agg.tot_card) + Number(ordRow.paid_card || 0)) * 100
      ) / 100;

      // Determine effective payment method
      let effectivePm = pm;
      if (totCash > 0 && totCard > 0) effectivePm = 'mixed';
      else if (totCash > 0 && totCard === 0) effectivePm = 'cash';
      else if (totCard > 0 && totCash === 0) effectivePm = 'card';

      await conn.query(`
        UPDATE orders
        SET paid_amount = ?,
            remaining_amount = ?,
            payment_status = ?,
            payment_method = ?,
            paid_cash = ?,
            paid_card = ?,
            fully_paid_at = ?,
            paid_at = CASE WHEN paid_at IS NULL THEN NOW() ELSE paid_at END
        WHERE id = ?
      `, [newPaidAmount, newRemainingAmount, newPaymentStatus, effectivePm,
          totCash, totCard, fullyPaidAt, id]);
    } else {
      await conn.query(`
        UPDATE orders
        SET paid_amount = ?,
            remaining_amount = ?,
            payment_status = ?,
            paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END
        WHERE id = ?
      `, [newPaidAmount, newRemainingAmount, newPaymentStatus, newPaymentStatus, id]);
    }

    await conn.commit();

    // Get the inserted payment
    const [[payment]] = await pool.query(`
      SELECT id, payment_amount, payment_method, cash_amount, card_amount, payment_date, created_by, notes
      FROM invoice_payments
      WHERE id = ?
    `, [paymentResult.insertId]);

    return {
      success: true,
      payment,
      invoice: {
        paid_amount: newPaidAmount,
        remaining_amount: newRemainingAmount,
        payment_status: newPaymentStatus,
        fully_paid_at: fullyPaidAt
      }
    };

  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Get payment history for an invoice
 */
async function getPaymentHistory(orderId) {
  const id = Number(orderId);
  if (!id) {
    const e = new Error('معرّف الفاتورة غير صالح');
    e.appCode = 'INVOICE_NOT_FOUND';
    throw e;
  }

  const [payments] = await pool.query(`
    SELECT 
      id, payment_amount, payment_method, cash_amount, card_amount, payment_date, created_by, notes
    FROM invoice_payments
    WHERE order_id = ?
    ORDER BY payment_date DESC, id DESC
  `, [id]);

  return payments;
}


// ============================================================================
// Credit Notes (إشعارات الدائن) Functions
// ============================================================================

async function createCreditNotesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_notes (
      id                   INT AUTO_INCREMENT PRIMARY KEY,
      credit_note_number   VARCHAR(30) NOT NULL UNIQUE,
      credit_note_seq      INT         NULL,
      original_order_id    INT         NOT NULL,
      original_invoice_seq INT         NULL,
      original_order_number VARCHAR(20) NULL,
      customer_id          INT         NULL,
      subtotal             DECIMAL(10,2) NOT NULL DEFAULT 0,
      discount_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
      extra_amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_rate             DECIMAL(5,2)  NOT NULL DEFAULT 15,
      vat_amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes                TEXT          DEFAULT NULL,
       created_by           VARCHAR(100)  DEFAULT NULL,
       price_display_mode   VARCHAR(20)   DEFAULT 'exclusive',
       created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_cn_order FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS credit_note_items (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      credit_note_id    INT NOT NULL,
      product_id        INT NOT NULL,
      laundry_service_id INT NOT NULL,
      product_name_ar   VARCHAR(255) DEFAULT NULL,
      product_name_en   VARCHAR(255) DEFAULT NULL,
      service_name_ar   VARCHAR(255) DEFAULT NULL,
      service_name_en   VARCHAR(255) DEFAULT NULL,
      quantity          INT NOT NULL DEFAULT 1,
      unit_price        DECIMAL(10,2) NOT NULL,
      line_total        DECIMAL(10,2) NOT NULL,
      CONSTRAINT fk_cni_cn FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'credit_notes' AND column_name = 'credit_note_seq'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN credit_note_seq INT NULL`);
    }
  } catch (e) {
    console.error('migrate credit_note_seq:', e);
  }

  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cn_created_at ON credit_notes(created_at DESC)`);
  } catch (_) {}
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cn_customer_id ON credit_notes(customer_id)`);
  } catch (_) {}
  try {
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cn_seq ON credit_notes(credit_note_seq DESC)`);
  } catch (_) {}
  // migrate: add price_display_mode column if missing
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'credit_notes' AND column_name = 'price_display_mode'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN price_display_mode VARCHAR(20) DEFAULT 'exclusive'`);
    }
  } catch (e) {
    console.error('migrate credit_notes price_display_mode:', e);
  }

  // migrate: add ZATCA columns for credit notes
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'credit_notes'`
    );
    const set = new Set(cols.map(r => r.COLUMN_NAME));
    if (!set.has('zatca_uuid')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_uuid VARCHAR(100) DEFAULT NULL`);
    }
    if (!set.has('zatca_hash')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_hash VARCHAR(255) DEFAULT NULL`);
    }
    if (!set.has('zatca_qr')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_qr TEXT DEFAULT NULL`);
    }
    if (!set.has('zatca_submitted')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_submitted DATETIME DEFAULT NULL`);
    }
    if (!set.has('zatca_status')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_status ENUM('pending','submitted','accepted','rejected') DEFAULT 'pending'`);
    }
    if (!set.has('zatca_rejection_reason')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_rejection_reason TEXT DEFAULT NULL`);
    }
    if (!set.has('zatca_response')) {
      await pool.query(`ALTER TABLE credit_notes ADD COLUMN zatca_response LONGTEXT DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrate credit_notes zatca columns:', e);
  }
}

async function getCreditNotes({ page = 1, pageSize = 50, search = '', dateFrom = '', dateTo = '' } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(500, Math.max(1, Number(pageSize) || 50));
  const offset = (safePage - 1) * safeSize;
  const like = `%${search}%`;

  let whereClauses = `WHERE (
    cn.credit_note_number LIKE ? OR
    COALESCE(cn.original_order_number,'') LIKE ? OR
    CAST(cn.credit_note_seq AS CHAR) LIKE ? OR
    CAST(cn.original_invoice_seq AS CHAR) LIKE ? OR
    COALESCE(c.customer_name,'') LIKE ? OR
    COALESCE(c.phone,'') LIKE ?
  )`;
  const params = [like, like, like, like, like, like];

  if (dateFrom) {
    whereClauses += ' AND DATE(cn.created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClauses += ' AND DATE(cn.created_at) <= ?';
    params.push(dateTo);
  }

  const [rows] = await pool.query(`
    SELECT cn.id, cn.credit_note_number, cn.credit_note_seq,
           cn.original_order_id, cn.original_invoice_seq, cn.original_order_number,
           cn.subtotal, cn.discount_amount, cn.extra_amount,
           cn.vat_rate, cn.vat_amount, cn.total_amount,
           cn.notes, cn.created_by, cn.created_at,
           cn.zatca_status, cn.zatca_rejection_reason, cn.zatca_response,
           c.customer_name, c.phone
    FROM credit_notes cn
    LEFT JOIN customers c ON c.id = cn.customer_id
    ${whereClauses}
    ORDER BY cn.id DESC
    LIMIT ? OFFSET ?
  `, [...params, safeSize, offset]);

  const [[{ total }]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM credit_notes cn
    LEFT JOIN customers c ON c.id = cn.customer_id
    ${whereClauses}
  `, params);

  return { creditNotes: rows, total, page: safePage, pageSize: safeSize };
}

async function getCreditNoteById(id) {
  const [[cn]] = await pool.query(`
    SELECT cn.id, cn.credit_note_number, cn.credit_note_seq,
           cn.original_order_id, cn.original_invoice_seq, cn.original_order_number,
           cn.subtotal, cn.discount_amount, cn.extra_amount,
           cn.vat_rate, cn.vat_amount, cn.total_amount, cn.price_display_mode,
           cn.notes, cn.created_by, cn.created_at,
           cn.zatca_uuid, cn.zatca_status, cn.zatca_rejection_reason, cn.zatca_response,
           cn.customer_id,
           c.customer_name, c.phone, c.tax_number AS customer_vat, c.address AS customer_address, c.city AS customer_city
    FROM credit_notes cn
    LEFT JOIN customers c ON c.id = cn.customer_id
    WHERE cn.id = ?
    LIMIT 1
  `, [id]);
  if (!cn) return null;

  const [items] = await pool.query(`
    SELECT id, product_id, quantity, unit_price, line_total,
           product_name_ar, product_name_en, service_name_ar, service_name_en
    FROM credit_note_items
    WHERE credit_note_id = ?
    ORDER BY id ASC
  `, [id]);

  return { creditNote: cn, items };
}

async function getInvoiceBySeq(invoiceSeq) {
  const seq = Number(invoiceSeq);
  if (!seq) {
    const e = new Error('رقم الفاتورة غير صالح');
    e.appCode = 'INVALID_SEQ';
    throw e;
  }
  const [[order]] = await pool.query(`
    SELECT o.id, o.order_number, o.invoice_seq, o.subtotal, o.discount_amount, o.discount_label, o.extra_amount,
           o.vat_rate, o.vat_amount, o.total_amount, o.payment_method, o.payment_status,
           o.paid_amount, o.remaining_amount, o.price_display_mode,
           o.created_at, o.created_by, o.starch, o.bluing,
           c.id AS customer_id, c.customer_name, c.phone
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.invoice_seq = ?
    LIMIT 1
  `, [seq]);

  if (!order) {
    const e = new Error('الفاتورة غير موجودة');
    e.appCode = 'INVOICE_NOT_FOUND';
    throw e;
  }

  if (order.payment_method === 'credit' && order.payment_status !== 'paid') {
    const e = new Error('لا يمكن معالجة الفواتير الآجلة غير المدفوعة');
    e.appCode = 'INVOICE_IS_CREDIT';
    throw e;
  }

  if (order.payment_status !== 'paid') {
    const e = new Error('لا يمكن معالجة الفواتير غير المدفوعة');
    e.appCode = 'INVOICE_NOT_PAID';
    throw e;
  }

  const [[existingCN]] = await pool.query(
    `SELECT id, credit_note_seq FROM credit_notes WHERE original_order_id = ? LIMIT 1`,
    [order.id]
  );
  if (existingCN) {
    const e = new Error(`تم إنشاء إشعار دائن لهذه الفاتورة مسبقاً (رقم الإشعار: ${existingCN.credit_note_seq || existingCN.id})`);
    e.appCode = 'CREDIT_NOTE_EXISTS';
    throw e;
  }

  const [items] = await pool.query(`
    SELECT oi.id, oi.quantity, oi.unit_price, oi.line_total,
           oi.product_id, oi.laundry_service_id,
           p.name_ar AS product_name_ar, p.name_en AS product_name_en,
           ls.name_ar AS service_name_ar, ls.name_en AS service_name_en
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN laundry_services ls ON ls.id = oi.laundry_service_id
    WHERE oi.order_id = ?
    ORDER BY oi.id ASC
  `, [order.id]);

  return { success: true, order, items };
}

async function createCreditNote({ originalOrderId, customerId, subtotal, discountAmount, extraAmount,
  vatRate, vatAmount, totalAmount, items, notes, createdBy, priceDisplayMode }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[orderRow]] = await conn.query(
      `SELECT id, invoice_seq, order_number, payment_status FROM orders WHERE id = ? FOR UPDATE`,
      [originalOrderId]
    );
    if (!orderRow) {
      const e = new Error('الفاتورة الأصلية غير موجودة');
      e.appCode = 'INVOICE_NOT_FOUND';
      throw e;
    }
    if (orderRow.payment_status !== 'paid') {
      const e = new Error('لا يمكن معالجة فاتورة غير مدفوعة');
      e.appCode = 'INVOICE_NOT_PAID';
      throw e;
    }

    const [[existing]] = await conn.query(
      `SELECT id FROM credit_notes WHERE original_order_id = ? LIMIT 1`,
      [originalOrderId]
    );
    if (existing) {
      const e = new Error('تم إنشاء إشعار دائن لهذه الفاتورة مسبقاً');
      e.appCode = 'CREDIT_NOTE_EXISTS';
      throw e;
    }

    const [[seqRow]] = await conn.query(
      `SELECT COALESCE(MAX(credit_note_seq), 0) + 1 AS next_seq FROM credit_notes`
    );
    const cnSeq = seqRow.next_seq;
    const cnNumber = `CN-${cnSeq}`;

    const [result] = await conn.query(`
      INSERT INTO credit_notes
        (credit_note_number, credit_note_seq, original_order_id, original_invoice_seq,
         original_order_number, customer_id, subtotal, discount_amount, extra_amount,
         vat_rate, vat_amount, total_amount, notes, created_by, price_display_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cnNumber, cnSeq, originalOrderId, orderRow.invoice_seq,
      orderRow.order_number, customerId || null,
      subtotal || 0, discountAmount || 0, extraAmount || 0,
      vatRate || 15, vatAmount || 0, totalAmount || 0,
      notes || null, createdBy || 'system',
      priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive'
    ]);

    const cnId = result.insertId;

    if (Array.isArray(items) && items.length > 0) {
      const values = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const params = [];
      for (const item of items) {
        params.push(
          cnId,
          item.product_id,
          item.laundry_service_id,
          item.product_name_ar || null,
          item.product_name_en || null,
          item.service_name_ar || null,
          item.service_name_en || null,
          item.quantity || 1,
          item.unit_price || 0,
          item.line_total || 0
        );
      }
      await conn.query(`
        INSERT INTO credit_note_items
          (credit_note_id, product_id, laundry_service_id,
           product_name_ar, product_name_en, service_name_ar, service_name_en,
           quantity, unit_price, line_total)
        VALUES ${values}
      `, params);
    }

    await conn.commit();
    return {
      success: true,
      creditNoteId: cnId,
      creditNoteNumber: cnNumber,
      creditNoteSeq: cnSeq,
      originalInvoiceSeq: orderRow.invoice_seq,
      originalOrderNumber: orderRow.order_number
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ============================================================================
// Hanger (سير الملابس) Functions
// ============================================================================

async function getAllHangers(filters = {}) {
  const { search, searchInvoice, status } = filters;
  let where = 'WHERE 1=1';
  const params = [];
  if (search) {
    where += ' AND (h.hanger_number LIKE ? OR h.label LIKE ? OR h.notes LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (searchInvoice) {
    where += ' AND (CAST(o.invoice_seq AS CHAR) LIKE ? OR o.order_number LIKE ?)';
    const q = `%${searchInvoice}%`;
    params.push(q, q);
  }
  if (status && status !== 'all') {
    where += ' AND h.status = ?';
    params.push(status);
  }
  try {
    const sql = `SELECT h.*, o.id AS order_id, o.invoice_seq, o.order_number, c.customer_name
       FROM hangers h
       LEFT JOIN orders o ON o.hanger_id = h.id AND o.delivery_date IS NULL
       LEFT JOIN customers c ON c.id = o.customer_id
       ${where}
       ORDER BY CAST(h.hanger_number AS UNSIGNED) ASC, h.hanger_number ASC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error('getAllHangers error:', err);
    throw err;
  }
}

async function getAvailableHangers() {
  const [rows] = await pool.query(
    `SELECT id, hanger_number, label, status
     FROM hangers
     WHERE status = 'free'
     ORDER BY CAST(hanger_number AS UNSIGNED) ASC, hanger_number ASC`
  );
  console.log('[DB] getAvailableHangers returned rows:', rows.length);
  return rows;
}

async function createHanger(data) {
  const { hangerNumber, label, notes } = data;
  const [result] = await pool.query(
    `INSERT INTO hangers (hanger_number, label, notes) VALUES (?, ?, ?)`,
    [hangerNumber, label || null, notes || null]
  );
  return result.insertId;
}

async function batchCreateHangers(from, to) {
  const f = Math.max(1, Math.floor(Number(from) || 1));
  const t = Math.max(f, Math.floor(Number(to) || f));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const values = [];
    const params = [];
    for (let i = f; i <= t; i++) {
      values.push('(?)');
      params.push(String(i));
    }
    const [result] = await conn.query(
      `INSERT IGNORE INTO hangers (hanger_number) VALUES ${values.join(',')}`,
      params
    );
    await conn.commit();
    return { from: f, to: t, insertedCount: result.affectedRows || 0 };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateHanger(data) {
  const { id, hangerNumber, label, status, notes } = data;
  await pool.query(
    `UPDATE hangers SET hanger_number=?, label=?, status=?, notes=? WHERE id=?`,
    [hangerNumber, label || null, status || 'free', notes || null, id]
  );
}

async function deleteHanger(id) {
  await pool.query('DELETE FROM hangers WHERE id=?', [id]);
}

async function setHangerStatus(id, status) {
  await pool.query('UPDATE hangers SET status=? WHERE id=?', [status, id]);
}

async function getHangerById(id) {
  const [[row]] = await pool.query('SELECT * FROM hangers WHERE id=?', [id]);
  return row || null;
}

// ═══════════════════════════════════════════════════
// ═══ OFFERS / PROMOTIONS ═══
// ═══════════════════════════════════════════════════

async function createOffersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offers (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(200) NOT NULL,
      description TEXT DEFAULT NULL,
      discount_type ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      start_date  DATETIME NOT NULL,
      end_date    DATETIME NOT NULL,
      is_active   TINYINT(1) NOT NULL DEFAULT 1,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAllOffers() {
  const [rows] = await pool.query(
    `SELECT * FROM offers ORDER BY created_at DESC`
  );
  return rows;
}

async function getActiveOffers() {
  const [rows] = await pool.query(
    `SELECT * FROM offers
     WHERE is_active = 1 AND start_date <= NOW() AND end_date >= NOW()
     ORDER BY discount_value DESC`
  );
  return rows;
}

async function createOffer(data) {
  const name = String(data.name || '').trim().slice(0, 200);
  if (!name) throw new Error('اسم العرض مطلوب');
  const discountType = data.discountType === 'fixed' ? 'fixed' : 'percentage';
  let discountValue = Number(data.discountValue);
  if (isNaN(discountValue) || discountValue <= 0) throw new Error('قيمة الخصم غير صالحة');
  if (discountType === 'percentage' && discountValue > 100) throw new Error('النسبة لا يمكن أن تتجاوز 100%');
  const startDate = String(data.startDate || '').replace('T', ' ').slice(0, 19);
  const endDate = String(data.endDate || '').replace('T', ' ').slice(0, 19);
  if (!startDate || !endDate) throw new Error('التواريخ مطلوبة');
  if (startDate > endDate) throw new Error('تاريخ البداية يجب أن يكون قبل النهاية');
  const description = data.description ? String(data.description).trim().slice(0, 2000) : null;

  const [result] = await pool.query(
    `INSERT INTO offers (name, description, discount_type, discount_value, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description, discountType, discountValue, startDate, endDate]
  );
  return { id: result.insertId };
}

async function updateOffer(data) {
  const id = Number(data.id);
  if (!id) throw new Error('معرّف العرض غير صالح');
  const name = String(data.name || '').trim().slice(0, 200);
  if (!name) throw new Error('اسم العرض مطلوب');
  const discountType = data.discountType === 'fixed' ? 'fixed' : 'percentage';
  let discountValue = Number(data.discountValue);
  if (isNaN(discountValue) || discountValue <= 0) throw new Error('قيمة الخصم غير صالحة');
  if (discountType === 'percentage' && discountValue > 100) throw new Error('النسبة لا يمكن أن تتجاوز 100%');
  const startDate = String(data.startDate || '').replace('T', ' ').slice(0, 19);
  const endDate = String(data.endDate || '').replace('T', ' ').slice(0, 19);
  if (!startDate || !endDate) throw new Error('التواريخ مطلوبة');
  if (startDate > endDate) throw new Error('تاريخ البداية يجب أن يكون قبل النهاية');
  const description = data.description ? String(data.description).trim().slice(0, 2000) : null;

  await pool.query(
    `UPDATE offers SET name=?, description=?, discount_type=?, discount_value=?, start_date=?, end_date=? WHERE id=?`,
    [name, description, discountType, discountValue, startDate, endDate, id]
  );
}

async function toggleOfferStatus(id) {
  const oid = Number(id);
  if (!oid) throw new Error('معرّف العرض غير صالح');
  await pool.query('UPDATE offers SET is_active = IF(is_active=1,0,1) WHERE id=?', [oid]);
}

async function deleteOffer(id) {
  const oid = Number(id);
  if (!oid) throw new Error('معرّف العرض غير صالح');
  await pool.query('DELETE FROM offers WHERE id=?', [oid]);
}

/* ========== ZATCA Order Status Functions ========== */

async function updateOrderZatcaStatus(orderId, data = {}) {
  await pool.query(
    `UPDATE orders SET
      zatca_uuid = ?,
      zatca_hash = ?,
      zatca_qr = ?,
      zatca_submitted = NOW(),
      zatca_status = ?,
      zatca_rejection_reason = ?,
      zatca_response = ?
     WHERE id = ?`,
    [
      data.uuid || null,
      data.hash || null,
      data.qr || null,
      data.status || 'pending',
      data.rejectionReason || null,
      data.response || null,
      orderId,
    ]
  );
}

async function updateCreditNoteZatcaStatus(cnId, data = {}) {
  await pool.query(
    `UPDATE credit_notes SET
      zatca_uuid = ?,
      zatca_hash = ?,
      zatca_qr = ?,
      zatca_submitted = NOW(),
      zatca_status = ?,
      zatca_rejection_reason = ?,
      zatca_response = ?
     WHERE id = ?`,
    [
      data.uuid || null,
      data.hash || null,
      data.qr || null,
      data.status || 'pending',
      data.rejectionReason || null,
      data.response || null,
      cnId,
    ]
  );
}

async function getUnsentZatcaOrders(limit = 500) {
  const [rows] = await pool.query(
    `SELECT id FROM orders
     WHERE (zatca_status IS NULL OR zatca_status NOT IN ('submitted', 'accepted'))
       AND zatca_submitted IS NULL
       AND (zatca_response IS NULL OR zatca_response NOT LIKE '%NOT_REPORTED%')
     ORDER BY id ASC
     LIMIT ?`,
    [limit]
  );
  return rows.map(r => r.id);
}

module.exports = {
  initialize, findUser, query,
  getAllUsers, createUser, updateUser, toggleUserStatus, deleteUser,
  getAllCustomers, createCustomer, updateCustomer, toggleCustomerStatus, deleteCustomer,
  getAllExpenses, getExpensesSummary, createExpense, updateExpense, deleteExpense,
  getAllLaundryServices, createLaundryService, updateLaundryService, deleteLaundryService,
  setLaundryServiceActive, reorderLaundryServiceRelative,
  getProducts, getProductById, saveProduct, deleteProduct, getProductsExportRows,
  setProductActive, getProductImageRowsByIds, reorderProductRelative,
  refreshExpiredSubscriptionPeriods,
  getAllPrepaidPackages, savePrepaidPackage, togglePrepaidPackageActive, deletePrepaidPackage,
  getCustomerActiveSubscription,
  getCustomerSubscriptionsList, getSubscriptionDetail, getSubscriptionPeriods,
  getSubscriptionLedgerBySubscription, createSubscription, renewSubscription, stopSubscription,
  resumeSubscription, updateActiveSubscriptionPeriod, deleteSubscription,
  getSubscriptionReceiptData, getSubscriptionsExportRows, getSubscriptionCustomerReportRows,
  getAppSettings, saveAppSettings, updateReportEmailLastResult,
  getZatcaSettings, saveZatcaSettings,
  updateOrderZatcaStatus, updateCreditNoteZatcaStatus, getUnsentZatcaOrders,
  getPosProducts, getPosServices, generateOrderNumber, createOrder, getOrders, getOrderById,
  getOrdersBySubscription, getSubscriptionInvoices,
  getDeferredOrders, payDeferredOrder, markOrderCleaned, markOrderDelivered,
  // Partial invoice payment functions
  calculateRemainingBalance, determinePaymentStatus, validatePaymentAmount,
  getInvoiceWithPayments, recordInvoicePayment, getPaymentHistory,
  // Hanger functions
  getAllHangers, getAvailableHangers, createHanger, batchCreateHangers,
  updateHanger, deleteHanger, setHangerStatus, getHangerById,
  // Credit Note functions
  createCreditNotesTable, getInvoiceBySeq, createCreditNote,
  getCreditNotes, getCreditNoteById,
  // Offer functions
  createOffersTable, getAllOffers, getActiveOffers, createOffer, updateOffer, toggleOfferStatus, deleteOffer,
  // Report functions
  getReportData,
  getAllInvoicesReport,
  getSubscriptionsReport,
};

async function getReportData({ dateFrom = '', dateTo = '' } = {}) {
  const params = [];
  let dateWhere = '';
  const isDatetime = (s) => s && (s.includes('T') || (s.includes(' ') && s.includes(':')));
  if (dateFrom) {
    if (isDatetime(dateFrom)) {
      dateWhere += ' AND created_at >= ?';
    } else {
      dateWhere += ' AND DATE(created_at) >= ?';
    }
    params.push(dateFrom);
  }
  if (dateTo) {
    if (isDatetime(dateTo)) {
      dateWhere += ' AND created_at <= ?';
    } else {
      dateWhere += ' AND DATE(created_at) <= ?';
    }
    params.push(dateTo);
  }

  const dateOrdersWhere = dateWhere.replace(/\bcreated_at\b/g, 'o.created_at');
  const invoicesWhere   = `WHERE 1=1${dateOrdersWhere} AND o.payment_status = 'paid' AND COALESCE(o.payment_method,'cash') NOT IN ('credit','subscription')`;
  const pmWhere         = `WHERE 1=1${dateOrdersWhere}`;
  const invoicesParams  = [...params];
  const pmParams        = [...params];
  const expWhere        = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'expense_date')}`;
  const expParams       = [...params];
  const cnWhere         = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'cn.created_at')}`;
  const cnParams        = [...params];
  const subWhere        = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'sl.created_at')}`;
  const subParams       = [...params];

  const [[ordersSummary]] = await pool.query(`
    SELECT
      COALESCE(SUM(o.subtotal) - SUM(o.vat_amount), 0) AS sales_before_tax,
      COALESCE(SUM(o.vat_amount), 0)                  AS sales_tax,
      COALESCE(SUM(o.subtotal), 0)                    AS sales_after_tax,
      COALESCE(SUM(o.discount_amount), 0)             AS discount_total,
      COUNT(o.id)                                     AS invoice_count
    FROM orders o
    ${invoicesWhere}
  `, invoicesParams);

  const [[expSummary]] = await pool.query(`
    SELECT
      COALESCE(SUM(amount), 0)       AS exp_before_tax,
      COALESCE(SUM(tax_amount), 0)   AS exp_tax,
      COALESCE(SUM(total_amount), 0) AS exp_after_tax
    FROM expenses
    ${expWhere}
  `, expParams);

  const [[cnSummary]] = await pool.query(`
    SELECT
      COALESCE(SUM(cn.total_amount - cn.vat_amount), 0)  AS cn_before_tax,
      COALESCE(SUM(cn.vat_amount), 0)                    AS cn_tax,
      COALESCE(SUM(cn.total_amount), 0)                  AS cn_after_tax
    FROM credit_notes cn
    ${cnWhere}
  `, cnParams);

  const [paymentMethods] = await pool.query(`
    SELECT
      COALESCE(o.payment_method, 'cash')          AS method,
      COUNT(*)                                     AS count,
      COALESCE(SUM(o.total_amount), 0)             AS total_after_tax,
      COALESCE(SUM(o.total_amount - o.vat_amount), 0) AS total_before_tax,
      COALESCE(SUM(o.vat_amount), 0)               AS total_tax
    FROM orders o
    ${pmWhere}
    GROUP BY COALESCE(o.payment_method, 'cash')
    ORDER BY total_after_tax DESC
  `, pmParams);

  const [invoices] = await pool.query(`
    SELECT o.id, o.invoice_seq, o.order_number, o.subtotal, o.discount_amount,
           o.vat_amount, o.total_amount, o.payment_method, o.created_at,
           c.customer_name, c.phone
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${invoicesWhere}
    ORDER BY o.id DESC
  `, invoicesParams);

  const [expenses] = await pool.query(`
    SELECT id, title, category, expense_date AS created_at, amount, tax_amount, total_amount, notes
    FROM expenses
    ${expWhere}
    ORDER BY expense_date DESC, id DESC
  `, expParams);

  const [creditNotes] = await pool.query(`
    SELECT cn.id, cn.credit_note_seq, cn.credit_note_number,
           cn.original_invoice_seq, cn.subtotal, cn.discount_amount,
           cn.vat_amount, cn.total_amount, cn.created_at,
           c.customer_name, c.phone
    FROM credit_notes cn
    LEFT JOIN customers c ON c.id = cn.customer_id
    ${cnWhere}
    ORDER BY cn.id DESC
  `, cnParams);

  const [[subSummary]] = await pool.query(`
    SELECT COALESCE(SUM(sp.prepaid_price_paid), 0) AS sub_total
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    ${subWhere} AND sl.entry_type IN ('purchase', 'renewal')
  `, subParams);

  const [subscriptions] = await pool.query(`
    SELECT c.phone, c.subscription_number, cs.subscription_ref, sp.prepaid_price_paid AS amount, sl.entry_type, sl.created_at
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    INNER JOIN customers c ON c.id = cs.customer_id
    ${subWhere} AND sl.entry_type IN ('purchase', 'renewal')
    ORDER BY sl.created_at DESC
  `, subParams);

  const salesBeforeTax  = Number(ordersSummary.sales_before_tax);
  const salesTax        = Number(ordersSummary.sales_tax);
  const salesAfterTax   = Number(ordersSummary.sales_after_tax);
  const discountTotal   = Number(ordersSummary.discount_total);
  const expBeforeTax    = Number(expSummary.exp_before_tax);
  const expTax          = Number(expSummary.exp_tax);
  const expAfterTax     = Number(expSummary.exp_after_tax);
  const cnBeforeTax     = Number(cnSummary.cn_before_tax);
  const cnTax           = Number(cnSummary.cn_tax);
  const cnAfterTax      = Number(cnSummary.cn_after_tax);

  const salesNetBeforeTax = salesBeforeTax - discountTotal;
  const salesNetTax       = salesTax;
  const salesNetAfterTax  = salesAfterTax - discountTotal;

  const totalNetBeforeTax = salesNetBeforeTax - cnBeforeTax;
  const totalNetTax       = salesNetTax - cnTax;
  const totalNetAfterTax  = salesNetAfterTax - cnAfterTax;

  const subAfterTax  = Number(subSummary.sub_total);
  const subBeforeTax = subAfterTax / 1.15;
  const subTax       = subAfterTax - subBeforeTax;

  const netBeforeTax = totalNetBeforeTax + subBeforeTax - expBeforeTax;
  const netTax       = totalNetTax + subTax - expTax;
  const netAfterTax  = totalNetAfterTax + subAfterTax - expAfterTax;

  return {
    summary: {
      sales:           { beforeTax: salesBeforeTax,  tax: salesTax,  afterTax: salesAfterTax },
      discounts:       { beforeTax: discountTotal,   tax: 0,         afterTax: discountTotal },
      salesAfterDisc:  { beforeTax: salesNetBeforeTax, tax: salesNetTax, afterTax: salesNetAfterTax },
      creditNotes:     { beforeTax: cnBeforeTax,     tax: cnTax,     afterTax: cnAfterTax },
      totalNet:        { beforeTax: totalNetBeforeTax, tax: totalNetTax, afterTax: totalNetAfterTax },
      subscriptions:   { beforeTax: subBeforeTax,  tax: subTax,    afterTax: subAfterTax },
      expenses:        { beforeTax: expBeforeTax,    tax: expTax,    afterTax: expAfterTax },
      net:             { beforeTax: netBeforeTax,    tax: netTax,    afterTax: netAfterTax },
    },
    paymentMethods: paymentMethods.map((r) => ({
      method:         r.method,
      count:          Number(r.count),
      totalAfterTax:  Number(r.total_after_tax),
      totalBeforeTax: Number(r.total_before_tax),
      totalTax:       Number(r.total_tax),
    })),
    invoices,
    expenses,
    creditNotes,
    subscriptions,
    invoiceCount: Number(ordersSummary.invoice_count),
  };
}

async function getAllInvoicesReport({ dateFrom = '', dateTo = '', customerId = '', search = '', subscriptionNumber = '' } = {}) {
  const params = [];
  let dateWhere = '';
  const isDatetime = (s) => s && (s.includes('T') || (s.includes(' ') && s.includes(':')));
  if (dateFrom) {
    dateWhere += isDatetime(dateFrom) ? ' AND o.created_at >= ?' : ' AND DATE(o.created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    dateWhere += isDatetime(dateTo) ? ' AND o.created_at <= ?' : ' AND DATE(o.created_at) <= ?';
    params.push(dateTo);
  }

  let customerWhere = '';
  if (customerId) {
    customerWhere += ' AND o.customer_id = ?';
    params.push(Number(customerId));
  }
  if (search) {
    customerWhere += ` AND (c.customer_name LIKE ? OR c.phone LIKE ? OR c.subscription_number LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (subscriptionNumber) {
    customerWhere += ' AND c.subscription_number LIKE ?';
    params.push(`%${subscriptionNumber}%`);
  }

  const cnDateWhere = dateWhere.replace(/\bo\.created_at\b/g, 'cn.created_at');
  const cnCustomerWhere = customerWhere.replace(/\bo\./g, 'cn.').replace(/o\.customer_id/g, 'cn.customer_id');
  const cnParams = [...params];

  const allOrdersWhere  = `WHERE 1=1${dateWhere}${customerWhere}`;
  const cnWhere         = `WHERE 1=1${cnDateWhere}${cnCustomerWhere}`;

  const [allInvoices] = await pool.query(`
    SELECT o.id, o.invoice_seq, o.order_number,
           o.subtotal, o.discount_amount, o.vat_amount, o.total_amount,
           o.paid_amount, o.remaining_amount,
           o.payment_method, o.payment_status, o.paid_at, o.created_at,
           o.paid_cash, o.paid_card,
           o.cleaning_date, o.delivery_date,
           c.customer_name, c.phone, c.subscription_number
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${allOrdersWhere}
    ORDER BY o.id DESC
  `, [...params]);

  const paidInvoices     = allInvoices.filter(i => i.payment_status === 'paid' && !['credit','subscription'].includes(i.payment_method));
  const deferredInvoices = allInvoices.filter(i => ['credit'].includes(i.payment_method) || i.payment_status !== 'paid');

  const [creditNotes] = await pool.query(`
    SELECT cn.id, cn.credit_note_seq, cn.credit_note_number,
           cn.original_invoice_seq, cn.subtotal, cn.discount_amount,
           cn.vat_amount, cn.total_amount, cn.created_at,
           c.customer_name, c.phone, c.subscription_number
    FROM credit_notes cn
    LEFT JOIN customers c ON c.id = cn.customer_id
    ${cnWhere}
    ORDER BY cn.id DESC
  `, cnParams);

  const [paymentMethods] = await pool.query(`
    SELECT
      COALESCE(o.payment_method, 'cash') AS method,
      COUNT(*)                            AS count,
      COALESCE(SUM(o.total_amount), 0)    AS total_after_tax,
      COALESCE(SUM(o.total_amount - o.vat_amount), 0) AS total_before_tax,
      COALESCE(SUM(o.vat_amount), 0)      AS total_tax,
      COALESCE(SUM(o.paid_amount), 0)     AS total_paid,
      COALESCE(SUM(o.remaining_amount), 0) AS total_remaining
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${allOrdersWhere}
    GROUP BY COALESCE(o.payment_method, 'cash')
    ORDER BY total_after_tax DESC
  `, [...params]);

  const paidTotal       = paidInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const paidTax         = paidInvoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
  const paidBeforeTax   = paidInvoices.reduce((s, i) => s + Number(i.total_amount || 0) - Number(i.vat_amount || 0), 0);
  const paidDiscount    = paidInvoices.reduce((s, i) => s + Number(i.discount_amount || 0), 0);

  const deferredTotal     = deferredInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const deferredTax       = deferredInvoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
  const deferredBeforeTax = deferredInvoices.reduce((s, i) => s + Number(i.total_amount || 0) - Number(i.vat_amount || 0), 0);
  const deferredPaid      = deferredInvoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const deferredRemaining = deferredInvoices.reduce((s, i) => s + Number(i.remaining_amount || 0), 0);

  const cnTotal       = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0), 0);
  const cnTax         = creditNotes.reduce((s, c) => s + Number(c.vat_amount || 0), 0);
  const cnBeforeTax   = creditNotes.reduce((s, c) => s + Number(c.total_amount || 0) - Number(c.vat_amount || 0), 0);

  const allTotal      = paidTotal + deferredTotal;
  const allTax        = paidTax + deferredTax;
  const allBeforeTax  = paidBeforeTax + deferredBeforeTax;

  const netTotal      = allTotal - cnTotal;
  const netTax        = allTax - cnTax;
  const netBeforeTax  = allBeforeTax - cnBeforeTax;

  return {
    allInvoices,
    paidInvoices,
    deferredInvoices,
    creditNotes,
    paymentMethods: paymentMethods.map((r) => ({
      method:          r.method,
      count:           Number(r.count),
      totalAfterTax:   Number(r.total_after_tax),
      totalBeforeTax:  Number(r.total_before_tax),
      totalTax:        Number(r.total_tax),
      totalPaid:       Number(r.total_paid),
      totalRemaining:  Number(r.total_remaining),
    })),
    summary: {
      paid:        { count: paidInvoices.length,     beforeTax: paidBeforeTax,     tax: paidTax,     afterTax: paidTotal,     discount: paidDiscount },
      deferred:    { count: deferredInvoices.length, beforeTax: deferredBeforeTax, tax: deferredTax, afterTax: deferredTotal, paidAmount: deferredPaid, remaining: deferredRemaining },
      creditNotes: { count: creditNotes.length,      beforeTax: cnBeforeTax,       tax: cnTax,       afterTax: cnTotal },
      allInvoices: { count: allInvoices.length,      beforeTax: allBeforeTax,      tax: allTax,      afterTax: allTotal },
      net:         { beforeTax: netBeforeTax,        tax: netTax,                  afterTax: netTotal },
    },
  };
}
