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
function normalizeExpenseDateFrom(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s} 00:00:00` : toSqlDateTime(s);
}
function normalizeExpenseDateTo(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s} 23:59:59` : toSqlDateTime(s);
}
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;
const bcryptHash = promisify(bcrypt.hash);
const bcryptCompare = promisify(bcrypt.compare);

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'Db2@dm1n2022',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  charset: 'utf8mb4'
};

const DB_NAME = process.env.DB_NAME || 'laundry_db';

async function hashPassword(plain) {
  return bcryptHash(plain, BCRYPT_ROUNDS);
}

let pool = null;

async function initialize() {
  // انتظار MySQL إلى الأبد — لا نخرج بـ exit 1 لئلا NSSM يدخل Paused
  // نسجّل كل 30 ثانية حتى يستطيع المستخدم تشخيص المشكلة من الـ log
  let tempConn;
  let attempt = 0;
  while (!tempConn) {
    attempt++;
    try {
      tempConn = await mysql.createConnection(DB_CONFIG);
      console.log(`[DB] ✓ Connected to MySQL on attempt ${attempt} (${DB_CONFIG.host}:${DB_CONFIG.port})`);
    } catch (err) {
      const code = err.code || 'UNKNOWN';
      let hint = '';
      if (code === 'ECONNREFUSED')      hint = ' → MySQL غير مثبتة أو الخدمة متوقفة';
      else if (code === 'ER_ACCESS_DENIED_ERROR') hint = ' → كلمة سر root خاطئة في .env';
      else if (code === 'ENOTFOUND')    hint = ' → DB_HOST غير صحيح';
      else if (code === 'ETIMEDOUT')    hint = ' → MySQL لا تستجيب (firewall؟)';
      console.log(`[DB] ✗ attempt ${attempt} failed [${code}]${hint}: ${err.message}`);
      // أول 30 محاولة كل 3 ثوانٍ (90s)، بعدها كل 30 ثانية
      const delay = attempt < 30 ? 3000 : 30000;
      await new Promise(r => setTimeout(r, delay));
    }
  }

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
  // Ensure orders table can link to subscription periods
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN subscription_period_id INT NULL`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE orders ADD CONSTRAINT fk_orders_sub_period FOREIGN KEY (subscription_period_id) REFERENCES subscription_periods(id) ON DELETE SET NULL`);
  } catch (_) {};

  await migrateOrdersZatcaColumns();
  await migrateOrdersDeferredColumns();
  await migratePartialInvoicePayments();
  await migrateMixedPaymentColumns();
  await migrateMixedPaymentInvoiceColumns();
  await migrateOrdersPerformanceIndexes();
  await backfillSettledCreditPaymentMethod();
  await backfillSubscriptionPaymentMethod();
  await migrateOrdersHangerColumn();
  await migrateConsumptionReceipts();
  await migrateOrdersConsumptionFlag();
  await migrateAppSettingsRequireHanger();
  await migrateAppSettingsRequireCustomerPhone();
  await migrateAppSettingsAllowSubscriptionDebt();
  await migrateAppSettingsBarcodeAutoAction();
  await migrateAppSettingsShowBarcodeInInvoice();
  await migrateSubscriptionPeriodsCreatedAt();
  await createCreditNotesTable();
  await createRefundsTable();
  await migrateRefundsColumns();
  await createOffersTable();
  await createProductOffersTable();
  await createProductOfferLinesTable();
  await migrateZatcaSettings();
  await migrateSubscriptionInvoicesTable();
  await migrateOrderTypeColumn();
  await migrateOrderItemsNullable();
  await migrateExpensesDateTime();
  await migrateSubscriptionPeriodsOrderId();
  await migrateOrdersRefundColumns();
  await fixSubscriptionLedgerNotesEncoding();
  await migrateWhatsappQuota();
  await migrateLoyalty();
  await expireLoyaltyPoints();
  await migrateUsersPasswordPlain();
  await migrateRolesSystem();
  await migrateAppSettingsTrialMode();
  await createAccountsTable();
  await createLicenseTable();
  await migrateCustomerDiscountColumns();
  await migrateOrdersCustomerDiscountAmount();
  await migrateOrdersManualDiscountAmount();
  await fixSubscriptionVatAmounts();
  await createMerzamTypesTable();
  await migrateMerzamEnabled();
  await migrateMerzamOrderItems();
  await createCustomerCustomPricesTable();
  await migrateEnsureOrderTypeSaleValue();
  await migrateAddConsolidatedFlag();
  await migrateAddWorkOrderRefOnItems();
  await migrateCreateWorkOrders();
  await migrateCreateWorkOrderItems();
  await migrateWorkOrderItemsMerzam();
  await createUserSessionsMigration();
}

async function createUserSessionsMigration() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT          NOT NULL,
        login_at      DATETIME     NOT NULL,
        logout_at     DATETIME     NULL,
        last_seen_at  DATETIME     NULL,
        status        ENUM('active','closed') NOT NULL DEFAULT 'active',
        logout_type   ENUM('manual','browser_closed','server_shutdown','abnormal','jwt_expired') NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_us_user_id   (user_id),
        INDEX idx_us_login_at  (login_at),
        INDEX idx_us_status    (status),
        INDEX idx_us_user_date (user_id, login_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (_) {}
}

async function createUserSession(userId) {
  const [result] = await pool.query(
    `INSERT INTO user_sessions (user_id, login_at) VALUES (?, NOW())`,
    [userId]
  );
  return { sessionId: result.insertId };
}

async function closeUserSession(sessionId, logoutType, logoutAt = null) {
  if (!sessionId) return;
  const at = logoutAt ? logoutAt : new Date();
  await pool.query(
    `UPDATE user_sessions SET status='closed', logout_type=?, logout_at=? WHERE id=? AND status='active'`,
    [logoutType, at, sessionId]
  );
}

async function heartbeatUserSession(sessionId) {
  if (!sessionId) return;
  await pool.query(
    `UPDATE user_sessions SET last_seen_at=NOW() WHERE id=? AND status='active'`,
    [sessionId]
  );
}

async function reactivateUserSession(sessionId) {
  if (!sessionId) return;
  await pool.query(
    `UPDATE user_sessions SET status='active', logout_type=NULL, logout_at=NULL, last_seen_at=NOW()
     WHERE id=? AND status='closed' AND logout_type='browser_closed'`,
    [sessionId]
  );
}

async function closeAllActiveSessions(logoutType) {
  await pool.query(
    `UPDATE user_sessions SET status='closed', logout_type=?, logout_at=COALESCE(last_seen_at, login_at) WHERE status='active'`,
    [logoutType]
  );
}

async function getUserSessions(filters = {}) {
  const { userId, from, to, page = 1, pageSize = 20 } = filters;
  const conditions = [];
  const params = [];

  if (userId) { conditions.push('us.user_id = ?'); params.push(userId); }
  if (from)   { conditions.push('us.login_at >= ?'); params.push(from); }
  if (to)     { conditions.push('us.login_at <= ?'); params.push(to); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (page - 1) * pageSize;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM user_sessions us ${where}`,
    params
  );

  const [sessions] = await pool.query(
    `SELECT us.id, us.user_id, u.full_name, u.username,
            us.login_at, us.logout_at, us.last_seen_at,
            us.status, us.logout_type
     FROM user_sessions us
     LEFT JOIN users u ON u.id = us.user_id
     ${where}
     ORDER BY us.login_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return { sessions, total: Number(total) };
}

async function createCustomerCustomPricesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_custom_prices (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        customer_id        INT NOT NULL,
        product_id         INT NOT NULL,
        laundry_service_id INT NOT NULL,
        custom_price       DECIMAL(10,2) NOT NULL,
        created_by         INT NULL,
        updated_by         INT NULL,
        created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ccp (customer_id, product_id, laundry_service_id),
        KEY idx_ccp_customer   (customer_id),
        KEY idx_ccp_product_svc (product_id, laundry_service_id),
        CONSTRAINT fk_ccp_customer FOREIGN KEY (customer_id)
          REFERENCES customers(id) ON DELETE CASCADE,
        CONSTRAINT fk_ccp_product FOREIGN KEY (product_id)
          REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_ccp_service FOREIGN KEY (laundry_service_id)
          REFERENCES laundry_services(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (e) {
    console.log('[DB] createCustomerCustomPricesTable:', e.message);
  }
}

async function migrateEnsureOrderTypeSaleValue() {
  // قواعد بيانات قديمة أُنشئت بـ 'pos' بدلاً من 'sale' — نضيف القيمتين معاً للحفاظ على البيانات الموجودة
  try {
    await pool.query(
      `ALTER TABLE orders MODIFY COLUMN order_type ENUM('pos','sale','subscription_new','subscription_renewal') NOT NULL DEFAULT 'sale'`
    );
  } catch (e) {
    console.error('[DB] migrateEnsureOrderTypeSaleValue:', e.message);
  }
}

async function migrateAddConsolidatedFlag() {
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN is_consolidated TINYINT(1) NOT NULL DEFAULT 0`);
  } catch (_) {}
  try {
    await pool.query(`
      UPDATE orders
      SET payment_status = 'paid',
          paid_amount = total_amount,
          remaining_amount = 0,
          paid_at = COALESCE(paid_at, created_at, NOW()),
          fully_paid_at = COALESCE(fully_paid_at, paid_at, created_at, NOW()),
          cleaning_date = COALESCE(cleaning_date, created_at, NOW()),
          delivery_date = COALESCE(delivery_date, created_at, NOW())
      WHERE is_consolidated = 1
    `);
  } catch (_) {}
}

async function migrateAddWorkOrderRefOnItems() {
  try {
    await pool.query(`ALTER TABLE order_items ADD COLUMN work_order_id INT DEFAULT NULL`);
  } catch (_) {}
}

async function migrateCreateWorkOrders() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        work_order_seq       INT NOT NULL,
        work_order_number    VARCHAR(20) NOT NULL,
        customer_id          INT NOT NULL,
        subtotal             DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
        vat_rate             DECIMAL(5,2)  NOT NULL DEFAULT 15,
        vat_amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
        price_display_mode   ENUM('inclusive','exclusive') NOT NULL DEFAULT 'exclusive',
        status               ENUM('pending','invoiced','cancelled') NOT NULL DEFAULT 'pending',
        consolidated_order_id INT DEFAULT NULL,
        notes                TEXT DEFAULT NULL,
        created_by           VARCHAR(100) DEFAULT NULL,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wo_number (work_order_number),
        KEY idx_wo_customer (customer_id),
        KEY idx_wo_status (status),
        KEY idx_wo_created_at (created_at),
        KEY idx_wo_consolidated (consolidated_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (_) {}
}

async function migrateCreateWorkOrderItems() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_order_items (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        work_order_id   INT NOT NULL,
        product_name    VARCHAR(200) NOT NULL DEFAULT '',
        service_name    VARCHAR(200) DEFAULT NULL,
        quantity        DECIMAL(10,3) NOT NULL DEFAULT 1,
        unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
        line_total      DECIMAL(10,2) NOT NULL DEFAULT 0,
        item_type       VARCHAR(50) DEFAULT 'product',
        sort_order      INT NOT NULL DEFAULT 0,
        KEY idx_woi_order (work_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (_) {}
}

async function migrateWorkOrderItemsMerzam() {
  try {
    await pool.query(`ALTER TABLE work_order_items ADD COLUMN merzam_type_name VARCHAR(100) NULL`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE work_orders ADD COLUMN cleaning_date DATETIME NULL DEFAULT NULL`);
  } catch (_) {}
  try {
    await pool.query(`ALTER TABLE work_orders ADD COLUMN delivery_date DATETIME NULL DEFAULT NULL`);
  } catch (_) {}
}

async function createLicenseTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS license (
      id TINYINT NOT NULL DEFAULT 1,
      serial VARCHAR(512) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT chk_single_row CHECK (id = 1)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function migrateCustomerDiscountColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'customers'
       AND COLUMN_NAME IN ('discount_type','discount_value','discount_expiry')`
    );
    const existing = new Set(cols.map(r => r.COLUMN_NAME));
    if (!existing.has('discount_type')) {
      await pool.query(`ALTER TABLE customers ADD COLUMN discount_type ENUM('percentage','fixed') DEFAULT NULL`);
    }
    if (!existing.has('discount_value')) {
      await pool.query(`ALTER TABLE customers ADD COLUMN discount_value DECIMAL(10,2) DEFAULT NULL`);
    }
    if (!existing.has('discount_expiry')) {
      await pool.query(`ALTER TABLE customers ADD COLUMN discount_expiry DATE DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrateCustomerDiscountColumns:', e);
  }
}

async function migrateOrdersCustomerDiscountAmount() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'
       AND COLUMN_NAME = 'customer_discount_amount'`
    );
    if (!cols.length) {
      await pool.query(`ALTER TABLE orders ADD COLUMN customer_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error('migrateOrdersCustomerDiscountAmount:', e);
  }
}

async function migrateOrdersManualDiscountAmount() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'
       AND COLUMN_NAME = 'manual_discount_amount'`
    );
    if (!cols.length) {
      await pool.query(`ALTER TABLE orders ADD COLUMN manual_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error('migrateOrdersManualDiscountAmount:', e);
  }
}

async function fixSubscriptionVatAmounts() {
  try {
    // الاشتراك دائماً شامل الضريبة — صحّح أي فاتورة اشتراك أو إشعار دائن خُزّن بضريبة منفصلة بسبب خطأ || 15
    const [[row]] = await pool.query(`SELECT vat_rate FROM app_settings WHERE id = 1`);
    if (!row || Number(row.vat_rate) !== 0) return;
    // تصحيح فواتير الاشتراك
    await pool.query(`
      UPDATE orders
      SET vat_rate   = 0,
          vat_amount = 0,
          subtotal   = total_amount
      WHERE order_type IN ('subscription_new', 'subscription_renewal')
        AND vat_rate > 0
    `);
  } catch (e) {
    console.error('fixSubscriptionVatAmounts (orders):', e);
  }
  try {
    // تصحيح إشعارات الاشتراك دائماً بغض النظر عن إعداد معدل الضريبة الحالي
    await pool.query(`
      UPDATE credit_notes cn
      JOIN orders o ON o.id = cn.original_order_id
      SET cn.vat_rate   = 0,
          cn.vat_amount = 0,
          cn.subtotal   = cn.total_amount
      WHERE o.order_type IN ('subscription_new', 'subscription_renewal')
        AND (cn.vat_rate > 0 OR cn.vat_amount > 0)
    `);
  } catch (e) {
    console.error('fixSubscriptionVatAmounts (credit_notes):', e);
  }
}

async function isSerialLicensed(serials) {
  if (!Array.isArray(serials) || serials.length === 0) return false;
  const valid = serials.filter(s => typeof s === 'string' && s.trim().length > 0);
  if (valid.length === 0) return false;
  const [rows] = await pool.query(
    `SELECT id FROM license WHERE UPPER(TRIM(serial)) IN (${valid.map(() => '?').join(',')}) LIMIT 1`,
    valid.map(s => s.trim().toUpperCase())
  );
  return rows.length > 0;
}

// ── Accounts (Trial / Subscription) ─────────────────────────────────────────

async function createAccountsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      status ENUM('Trial','Active','Expired') NOT NULL DEFAULT 'Trial',
      created_at DATETIME NOT NULL,
      trial_end_date DATETIME NOT NULL,
      subscription_start_date DATETIME NULL,
      subscription_end_date DATETIME NULL,
      plan_name VARCHAR(100) NULL,
      last_login DATETIME NULL,
      ip_address VARCHAR(45) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // migration: add ip_address if missing
  try {
    await pool.query(`ALTER TABLE accounts ADD COLUMN ip_address VARCHAR(45) NULL`);
  } catch (_) {}
}

async function registerAccount({ name, phone, password, ip }) {
  const [[existing]] = await pool.query('SELECT id FROM accounts WHERE phone=?', [phone]);
  if (existing) {
    const err = new Error('رقم الجوال مسجل مسبقاً');
    err.code = 'PHONE_EXISTS';
    throw err;
  }
  if (ip) {
    const [[ipExists]] = await pool.query('SELECT id FROM accounts WHERE ip_address=?', [ip]);
    if (ipExists) {
      const err = new Error('تم تسجيل حساب تجريبي مسبقاً من هذا الجهاز');
      err.code = 'IP_EXISTS';
      throw err;
    }
  }
  const hashed = await hashPassword(password);
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 7);
  await pool.query(
    `INSERT INTO accounts (name, phone, password, status, created_at, trial_end_date, ip_address)
     VALUES (?, ?, ?, 'Trial', ?, ?, ?)`,
    [name, phone, hashed, toSqlDateTime(now), toSqlDateTime(trialEnd), ip || null]
  );
}

async function checkTrialAccess(ip) {
  // حساب مدفوع (Active) → مسموح من أي جهاز
  const [[active]] = await pool.query(
    `SELECT id FROM accounts WHERE status = 'Active' LIMIT 1`
  );
  if (active) return { allowed: true };

  // تجربة → يجب أن يكون الـ IP مسجلاً وغير منتهٍ
  if (!ip) return { allowed: false, needsRegistration: true };
  const [[trial]] = await pool.query(
    `SELECT id FROM accounts WHERE status = 'Trial' AND ip_address = ? AND trial_end_date >= NOW() LIMIT 1`,
    [ip]
  );
  if (trial) return { allowed: true };

  // تحقق هل هذا الـ IP سجّل من قبل لكن انتهت مدته
  const [[expired]] = await pool.query(
    `SELECT id FROM accounts WHERE ip_address = ? LIMIT 1`,
    [ip]
  );
  return expired
    ? { allowed: false, needsRegistration: false }  // منتهي
    : { allowed: false, needsRegistration: true };   // لم يسجل بعد
}

// ── Roles & Permissions ─────────────────────────────────────────────────────

const ALL_PERMISSION_KEYS = [
  'pos','invoices','credit_invoices','consumption_receipts','payment',
  'customers','products','services','hangers','subscriptions',
  'expenses','offers','users','roles','settings','whatsapp','zatca_settings',
  'reports'
];

function buildAllPermissions(val = true) {
  const p = {};
  ALL_PERMISSION_KEYS.forEach(k => { p[k] = val; });
  return p;
}

async function migrateRolesSystem() {
  try {
    // Add permissions JSON column directly to users table
    const [userCols2] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'`
    );
    const colSet2 = new Set(userCols2.map(r => r.COLUMN_NAME));
    if (!colSet2.has('permissions')) {
      await pool.query(`ALTER TABLE users ADD COLUMN permissions JSON NULL`);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        permissions JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [userCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'users'`
    );
    const colSet = new Set(userCols.map(r => r.COLUMN_NAME));
    if (!colSet.has('role_id')) {
      await pool.query(`ALTER TABLE users ADD COLUMN role_id INT NULL`);
    }

    // Seed default roles if empty
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM roles');
    if (Number(cnt) === 0) {
      const adminPerms = JSON.stringify(buildAllPermissions(true));
      const cashierPerms = JSON.stringify({
        pos: true, invoices: true, credit_invoices: false,
        consumption_receipts: true, payment: true,
        customers: true, products: false, services: false,
        hangers: true, subscriptions: false,
        expenses: false, offers: false, users: false, roles: false,
        settings: false, whatsapp: false, zatca_settings: false, reports: false
      });
      await pool.query(
        `INSERT INTO roles (name, permissions) VALUES (?, ?), (?, ?)`,
        ['مدير', adminPerms, 'كاشير', cashierPerms]
      );
    }

    // Assign existing users to matching default roles
    const [[adminRole]] = await pool.query(`SELECT id FROM roles WHERE name='مدير' LIMIT 1`);
    const [[cashierRole]] = await pool.query(`SELECT id FROM roles WHERE name='كاشير' LIMIT 1`);
    if (adminRole) {
      await pool.query(
        `UPDATE users SET role_id=? WHERE role='admin' AND role_id IS NULL`,
        [adminRole.id]
      );
    }
    if (cashierRole) {
      await pool.query(
        `UPDATE users SET role_id=? WHERE role='cashier' AND role_id IS NULL`,
        [cashierRole.id]
      );
    }
  } catch (e) {
    console.error('migrateRolesSystem:', e);
  }
}

async function getAllRoles() {
  const [rows] = await pool.query('SELECT id, name, permissions FROM roles ORDER BY id ASC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions
  }));
}

async function createRole(name, permissions) {
  const [result] = await pool.query(
    'INSERT INTO roles (name, permissions) VALUES (?, ?)',
    [name, JSON.stringify(permissions)]
  );
  return result.insertId;
}

async function updateRole(id, name, permissions) {
  await pool.query(
    'UPDATE roles SET name=?, permissions=? WHERE id=?',
    [name, JSON.stringify(permissions), id]
  );
}

async function deleteRole(id) {
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM users WHERE role_id=?', [id]
  );
  if (Number(cnt) > 0) {
    const err = new Error('لا يمكن حذف الدور لأنه مرتبط بمستخدمين');
    err.code = 'ROLE_IN_USE';
    throw err;
  }
  await pool.query('DELETE FROM roles WHERE id=?', [id]);
}

async function getPermissionsForUser(userId) {
  const [[user]] = await pool.query(
    'SELECT role, permissions FROM users WHERE id=?', [userId]
  );
  if (!user) return buildAllPermissions(false);
  if (user.role === 'admin') return buildAllPermissions(true);
  if (!user.permissions) return buildAllPermissions(false);
  const perms = typeof user.permissions === 'string'
    ? JSON.parse(user.permissions) : user.permissions;
  const result = buildAllPermissions(false);
  Object.assign(result, perms);
  return result;
}

async function getUsersList() {
  const [rows] = await pool.query(
    `SELECT id, username, full_name, role, permissions
     FROM users WHERE is_active = 1 ORDER BY id ASC`
  );
  return rows.map(u => ({
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    role: u.role,
    permissions: u.permissions
      ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions)
      : null
  }));
}

async function saveUserPermissions(userId, permissions) {
  await pool.query(
    'UPDATE users SET permissions=? WHERE id=?',
    [JSON.stringify(permissions), userId]
  );
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
    ['send_start_date', 'DATE DEFAULT NULL'],
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
            send_start_date, updated_at
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
    sendStartDate: row.send_start_date ? toSqlDate(row.send_start_date) : null,
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

  const sendStartDate = data.sendStartDate ? toSqlDate(data.sendStartDate) : null;

  await pool.query(
    `UPDATE zatca_settings SET
      company_name = ?, vat_number = ?, commercial_registration = ?, business_category = ?,
      branch_name = ?, email = ?, street = ?, building = ?, city = ?, postal_code = ?, district = ?,
      local_api_endpoint = ?, local_api_param_name = ?, local_api_param_aliases_json = CAST(? AS JSON),
      local_api_preferred_mode = ?, local_api_enable_text_plain = ?,
      send_start_date = ?
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
      localApiEnableTextPlain,
      sendStartDate
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

async function migrateConsumptionReceipts() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS consumption_receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receipt_seq INT NOT NULL,
        order_id INT DEFAULT NULL,
        customer_id INT NOT NULL,
        subscription_id INT NOT NULL,
        period_id INT NOT NULL,
        package_name VARCHAR(200) DEFAULT NULL,
        amount_consumed DECIMAL(10,2) NOT NULL DEFAULT 0,
        balance_before DECIMAL(10,2) NOT NULL DEFAULT 0,
        balance_after DECIMAL(10,2) NOT NULL DEFAULT 0,
        items_json JSON DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_by VARCHAR(100) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
        FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE RESTRICT,
        FOREIGN KEY (period_id) REFERENCES subscription_periods(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await pool.query(`CREATE INDEX idx_cr_customer ON consumption_receipts(customer_id)`).catch(() => {});
    await pool.query(`CREATE INDEX idx_cr_subscription ON consumption_receipts(subscription_id)`).catch(() => {});
    await pool.query(`CREATE INDEX idx_cr_created ON consumption_receipts(created_at)`).catch(() => {});

    // add cleaning/delivery date columns if missing
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'consumption_receipts'`
    );
    const colSet = new Set(cols.map(r => r.COLUMN_NAME));
    if (!colSet.has('cleaning_date')) {
      await pool.query(`ALTER TABLE consumption_receipts ADD COLUMN cleaning_date DATETIME NULL DEFAULT NULL`);
    }
    if (!colSet.has('delivery_date')) {
      await pool.query(`ALTER TABLE consumption_receipts ADD COLUMN delivery_date DATETIME NULL DEFAULT NULL`);
    }
    if (!colSet.has('discount_amount')) {
      await pool.query(`ALTER TABLE consumption_receipts ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0`);
    }
    if (!colSet.has('discount_label')) {
      await pool.query(`ALTER TABLE consumption_receipts ADD COLUMN discount_label VARCHAR(255) NULL DEFAULT NULL`);
    }
  } catch (e) {
    console.error('migrateConsumptionReceipts:', e);
  }
}

async function migrateOrdersConsumptionFlag() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const set = new Set(cols.map(r => r.COLUMN_NAME));
    if (!set.has('is_consumption_only')) {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN is_consumption_only TINYINT(1) NOT NULL DEFAULT 0
        COMMENT '1 = الطلب بالكامل من رصيد الاشتراك — لا فاتورة ضريبية'
      `);
    }
    if (!set.has('consumption_receipt_id')) {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN consumption_receipt_id INT DEFAULT NULL
        COMMENT 'مرجع إيصال الاستهلاك المرتبط'
      `);
    }
    if (!set.has('consumption_amount')) {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN consumption_amount DECIMAL(10,2) NOT NULL DEFAULT 0
        COMMENT 'المبلغ المستهلك من رصيد الاشتراك'
      `);
    }
  } catch (e) {
    console.error('migrateOrdersConsumptionFlag:', e);
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

async function migrateAppSettingsTrialMode() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'app_settings' AND column_name = 'trial_mode_enabled'`
    );
    if (!cols.length) {
      await pool.query(
        `ALTER TABLE app_settings ADD COLUMN trial_mode_enabled TINYINT(1) NOT NULL DEFAULT 0`
      );
    }
  } catch (e) {
    console.error('migrateAppSettingsTrialMode:', e);
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

async function migrateOrdersRefundColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders'`
    );
    const set = new Set(cols.map(r => r.COLUMN_NAME));
    if (!set.has('is_refund')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN is_refund TINYINT(1) NOT NULL DEFAULT 0`);
    }
    if (!set.has('refund_of_order_id')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN refund_of_order_id INT DEFAULT NULL`);
    }
    if (!set.has('refund_reason')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN refund_reason TEXT DEFAULT NULL`);
    }
    if (!set.has('refunded_at')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN refunded_at DATETIME DEFAULT NULL`);
    }
    if (!set.has('refunded_by')) {
      await pool.query(`ALTER TABLE orders ADD COLUMN refunded_by VARCHAR(100) DEFAULT NULL`);
    }
    await pool.query(`CREATE INDEX idx_orders_is_refund ON orders(is_refund)`).catch(() => {});
    await pool.query(`CREATE INDEX idx_orders_refund_of ON orders(refund_of_order_id)`).catch(() => {});
  } catch (e) {
    console.error('migrateOrdersRefundColumns:', e);
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
      expense_date  DATETIME NOT NULL,
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

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ppl_product_id ON product_price_lines (product_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products (sort_order)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_search ON products (name_ar, name_en)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_sort_order ON laundry_services (sort_order)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_services_search ON laundry_services (name_ar, name_en)`).catch(() => {});

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
    'SELECT id, username, full_name, role, role_id, password FROM users WHERE username = ? AND is_active = 1',
    [username]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const stored = row.password || '';
  if (stored.startsWith('$2')) {
    const ok = await bcryptCompare(passwordPlain, stored);
    if (!ok) return null;
    return { id: row.id, username: row.username, full_name: row.full_name, role: row.role, role_id: row.role_id };
  }
  if (stored === passwordPlain) {
    const hashed = await hashPassword(passwordPlain);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, row.id]);
    return { id: row.id, username: row.username, full_name: row.full_name, role: row.role, role_id: row.role_id };
  }
  return null;
}

async function getAllUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.password, u.password_plain, u.full_name, u.role, u.role_id,
            r.name AS role_name, u.is_active, u.created_at
     FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.username != 'superAdmin' ORDER BY u.id ASC`
  );
  return rows;
}

async function createUser(username, password, fullName, role, roleId) {
  if (username.toLowerCase() === 'superadmin') throw new Error('اسم المستخدم محجوز ولا يمكن استخدامه');
  const hashed = await hashPassword(password);
  const [result] = await pool.query(
    'INSERT INTO users (username, password, password_plain, full_name, role, role_id) VALUES (?, ?, ?, ?, ?, ?)',
    [username, hashed, password, fullName, role, roleId || null]
  );
  return result.insertId;
}

async function updateUser(id, username, password, fullName, role, roleId) {
  if (password) {
    const hashed = await hashPassword(password);
    await pool.query(
      'UPDATE users SET username=?, password=?, password_plain=?, full_name=?, role=?, role_id=? WHERE id=?',
      [username, hashed, password, fullName, role, roleId || null, id]
    );
  } else {
    await pool.query(
      'UPDATE users SET username=?, full_name=?, role=?, role_id=? WHERE id=?',
      [username, fullName, role, roleId || null, id]
    );
  }
}

async function toggleUserStatus(id, isActive) {
  if (!isActive) {
    const [[user]] = await pool.query('SELECT role FROM users WHERE id=?', [id]);
    if (user && user.role === 'admin') {
      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM users WHERE role=? AND is_active=1', ['admin']
      );
      if (cnt <= 1) {
        const err = new Error('لا يمكن إيقاف آخر مدير في النظام');
        err.code = 'LAST_ADMIN';
        throw err;
      }
    }
  }
  await pool.query('UPDATE users SET is_active=? WHERE id=?', [isActive, id]);
}

async function deleteUser(id) {
  const [[user]] = await pool.query('SELECT role FROM users WHERE id=?', [id]);
  if (user && user.role === 'admin') {
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM users WHERE role=? AND is_active=1', ['admin']
    );
    if (cnt <= 1) {
      const err = new Error('لا يمكن حذف آخر مدير في النظام');
      err.code = 'LAST_ADMIN';
      throw err;
    }
  }
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
  const { discountType, discountExpiry } = data;
  let discountValue = data.discountValue != null ? Number(data.discountValue) : null;
  const dbDiscountType = (discountType === 'percentage' || discountType === 'fixed') ? discountType : null;
  if (dbDiscountType === null) { discountValue = null; }
  if (dbDiscountType === 'percentage' && discountValue > 100) discountValue = 100;
  if (dbDiscountType && discountValue <= 0) { discountValue = null; }
  const dbDiscountExpiry = dbDiscountType && discountExpiry ? discountExpiry : null;
  const [result] = await pool.query(
    `INSERT INTO customers (subscription_number, customer_name, phone, tax_number, national_id, address, city, email, customer_type, notes, is_active, discount_type, discount_value, discount_expiry)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [null, customerName, phone, taxNumber || null, nationalId || null, address || '', city || '', email || null, customerType || 'individual', notes || null, isActive !== undefined ? isActive : 1, dbDiscountType, discountValue, dbDiscountExpiry || null]
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
  const { discountType, discountExpiry } = data;
  let discountValue = data.discountValue != null ? Number(data.discountValue) : null;
  const dbDiscountType = (discountType === 'percentage' || discountType === 'fixed') ? discountType : null;
  if (dbDiscountType === null) { discountValue = null; }
  if (dbDiscountType === 'percentage' && discountValue > 100) discountValue = 100;
  if (dbDiscountType && discountValue <= 0) { discountValue = null; }
  const dbDiscountExpiry = dbDiscountType && discountExpiry ? discountExpiry : null;
  await pool.query(
    `UPDATE customers SET customer_name=?, phone=?, tax_number=?, national_id=?, address=?, city=?, email=?, customer_type=?, notes=?, is_active=?, discount_type=?, discount_value=?, discount_expiry=? WHERE id=?`,
    [customerName, phone, taxNumber || null, nationalId || null, address || '', city || '', email || null, customerType || 'individual', notes || null, isActive !== undefined ? isActive : 1, dbDiscountType, discountValue, dbDiscountExpiry || null, cid]
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
    params.push(normalizeExpenseDateFrom(dateFrom));
  }
  if (dateTo) {
    whereClauses += ' AND expense_date <= ?';
    params.push(normalizeExpenseDateTo(dateTo));
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
    params.push(normalizeExpenseDateFrom(dateFrom));
  }
  if (dateTo) {
    whereClauses += ' AND expense_date <= ?';
    params.push(normalizeExpenseDateTo(dateTo));
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
    [title, category, amount, isTaxable ? 1 : 0, taxRate || 15.00, taxAmount || 0, totalAmount, toSqlDateTime(expenseDate), notes || null, createdBy || null]
  );
  return result.insertId;
}

async function updateExpense(data) {
  const { id, title, category, amount, isTaxable, taxRate, taxAmount, totalAmount, expenseDate, notes } = data;
  await pool.query(
    `UPDATE expenses SET title=?, category=?, amount=?, is_taxable=?, tax_rate=?, tax_amount=?, total_amount=?, expense_date=?, notes=? WHERE id=?`,
    [title, category, amount, isTaxable ? 1 : 0, taxRate || 15.00, taxAmount || 0, totalAmount, toSqlDateTime(expenseDate), notes || null, id]
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
  lines: 'COUNT(ppl.id)',
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

  const cols = 'id, name_ar, name_en, is_active, sort_order, created_at';

  if (page && pageSize) {
    const countSql = `SELECT COUNT(*) as total ${baseFrom}`;
    const dataSql  = `SELECT ${cols} ${baseFrom} ${orderSql} LIMIT ? OFFSET ?`;
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

  const [rows] = await pool.query(`SELECT ${cols} ${baseFrom} ${orderSql}`, params);
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

  const orderSql = buildProductsOrderBy(filters);

  if (page && pageSize) {
    const countSql = `SELECT COUNT(*) as total FROM products p WHERE 1=1${whereClauses}`;
    const dataSql = `
      SELECT p.id, p.name_ar, p.name_en, p.is_active, p.merzam_enabled, p.created_at, p.sort_order,
        (p.image_blob IS NOT NULL) AS has_image,
        COUNT(ppl.id) AS price_line_count
      FROM products p
      LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
      WHERE 1=1${whereClauses}
      GROUP BY p.id
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
    `SELECT p.id, p.name_ar, p.name_en, p.is_active, p.merzam_enabled, p.created_at, p.sort_order,
       (p.image_blob IS NOT NULL) AS has_image,
       COUNT(ppl.id) AS price_line_count
     FROM products p
     LEFT JOIN product_price_lines ppl ON ppl.product_id = p.id
     WHERE 1=1${whereClauses}
     GROUP BY p.id
     ${orderSql}`,
    params
  );
  return { products: rows, total: rows.length };
}

async function getProductById(id) {
  const [[product]] = await pool.query(
    'SELECT id, name_ar, name_en, is_active, merzam_enabled, created_at, sort_order, image_mime FROM products WHERE id=?',
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
    merzamEnabled,
    priceLines,
    imageGzipBuffer,
    imageMime,
    clearImage
  } = data;
  const lines = Array.isArray(priceLines) ? priceLines : [];
  const nameEnVal = nameEn && String(nameEn).trim() ? String(nameEn).trim() : null;
  const merzam = merzamEnabled ? 1 : 0;

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
            'UPDATE products SET name_ar=?, name_en=?, is_active=?, merzam_enabled=?, image_blob=NULL, image_mime=NULL WHERE id=?',
            [nameAr, nameEnVal, active, merzam, productId]
          );
        } else {
          await conn.query(
            'UPDATE products SET name_ar=?, name_en=?, is_active=?, merzam_enabled=?, image_blob=?, image_mime=? WHERE id=?',
            [nameAr, nameEnVal, active, merzam, imageGzipBuffer, imageMime || 'application/octet-stream', productId]
          );
        }
      } else {
        await conn.query(
          'UPDATE products SET name_ar=?, name_en=?, is_active=?, merzam_enabled=? WHERE id=?',
          [nameAr, nameEnVal, active, merzam, productId]
        );
      }
    } else {
      const blob = clearImage === true ? null : (Buffer.isBuffer(imageGzipBuffer) ? imageGzipBuffer : null);
      const mime = clearImage === true ? null : (blob ? (imageMime || 'application/octet-stream') : null);
      const [[m]] = await conn.query(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM products'
      );
      const [ins] = await conn.query(
        'INSERT INTO products (name_ar, name_en, image_blob, image_mime, is_active, merzam_enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [nameAr, nameEnVal, blob, mime, active, merzam, m.n]
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
      sp.order_id AS current_order_id,
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

  // جلب إيصالات الاستهلاك بنفس فلاتر العميل والتاريخ
  const crWhere = ['1=1'];
  const crParams = [];
  if (customerId) { crWhere.push('cr.customer_id = ?'); crParams.push(Number(customerId)); }
  if (dfVal) { crWhere.push('cr.created_at >= ?'); crParams.push(dfVal); }
  if (dtVal) { crWhere.push('cr.created_at <= ?'); crParams.push(dtVal); }
  if (search && !customerId) {
    crWhere.push('(c.customer_name LIKE ? OR c.phone LIKE ?)');
    crParams.push(`%${search}%`, `%${search}%`);
  }

  const [[summaryRows], [periods], [consumptionReceipts]] = await Promise.all([
    pool.query(summarySql, params),
    pool.query(detailSql, params),
    pool.query(
      `SELECT cr.id, cr.receipt_seq, cr.created_at,
              cr.amount_consumed, cr.balance_before, cr.balance_after,
              cr.package_name,
              c.customer_name, c.phone
       FROM consumption_receipts cr
       JOIN customers c ON c.id = cr.customer_id
       WHERE ${crWhere.join(' AND ')}
       ORDER BY cr.created_at DESC`,
      crParams
    ),
  ]);

  const s = summaryRows[0] || {};
  return {
    periods,
    consumptionReceipts,
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
       c.subscription_number,
       pp.name_ar AS package_name,
       sp.credit_remaining,
       sp.credit_value_granted,
       sp.period_from,
       sp.period_to,
       sp.status AS period_status,
       (${dsc}) AS display_status
     FROM customer_subscriptions cs
     INNER JOIN customers c ON c.id = cs.customer_id
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

/**
 * إنشاء فاتورة بيع للاشتراك داخل نفس الـ connection (transaction)
 * تُستدعى من createSubscription و renewSubscription
 */
async function _createSubscriptionOrder(conn, {
  customerId, packageId, packageNameAr, packageNameEn,
  periodId, orderType, paymentMethod, paidCash, paidCard, vatRate
}) {
  // جلب سعر الباقة
  const [[pkgRow]] = await conn.query(
    'SELECT prepaid_price FROM prepaid_packages WHERE id = ?',
    [packageId]
  );
  if (!pkgRow) throw new Error('الباقة غير موجودة');
  const prepaidPrice = Number(pkgRow.prepaid_price) || 0;

  // الاشتراك دائماً شامل الضريبة (inclusive)
  const totalAmount = prepaidPrice;
  const vatAmt = vatRate > 0 ? Math.round((totalAmount - totalAmount / (1 + vatRate / 100)) * 100) / 100 : 0;

  // طريقة الدفع
  let pm = paymentMethod || 'cash';
  let dbPaidCash = 0;
  let dbPaidCard = 0;
  if (pm === 'mixed') {
    dbPaidCash = Math.min(Number(paidCash || 0), totalAmount);
    dbPaidCard = Math.max(0, totalAmount - dbPaidCash);
  } else if (pm === 'card') {
    dbPaidCard = totalAmount;
  } else {
    dbPaidCash = totalAmount;
  }

  // توليد invoice_seq
  const [[seqRow]] = await conn.query('SELECT GREATEST(COALESCE(MAX(invoice_seq), 0), COALESCE(MAX(id), 0)) + 1 AS next_seq FROM orders');
  const invoiceSeq = seqRow.next_seq;

  // توليد order_number
  const orderNumber = 'SUB-' + Date.now();

  // إدراج الفاتورة
  const [orderInsert] = await conn.query(
    `INSERT INTO orders (
       order_number, invoice_seq, order_type, subscription_period_id, customer_id,
       subtotal, discount_amount, discount_label, extra_amount,
       vat_rate, vat_amount, total_amount,
       paid_amount, remaining_amount, paid_cash, paid_card,
       payment_method, payment_status, paid_at,
       cleaning_date, delivery_date,
       notes, created_by, price_display_mode
     ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 0, ?, ?, ?, ?, 0, ?, ?, ?, 'paid', NOW(), NOW(), NOW(), ?, NULL, 'inclusive')`,
    [
      orderNumber, invoiceSeq, orderType, periodId, customerId || null,
      totalAmount,  // subtotal (شامل الضريبة)
      vatRate, vatAmt, totalAmount,
      totalAmount,  // paid_amount
      dbPaidCash, dbPaidCard,
      pm,
      packageNameAr  // notes = اسم الباقة
    ]
  );
  const orderId = orderInsert.insertId;

  // نوع الخدمة
  const svcAr = orderType === 'subscription_renewal' ? 'تجديد اشتراك' : 'اشتراك جديد';
  const svcEn = orderType === 'subscription_renewal' ? 'Subscription Renewal' : 'New Subscription';

  // إدراج بند واحد يمثل الباقة
  await conn.query(
    `INSERT INTO order_items (
       order_id, product_id, laundry_service_id,
       product_name_ar, product_name_en,
       service_name_ar, service_name_en,
       quantity, unit_price, line_total,
       subscription_period_id
     ) VALUES (?, NULL, NULL, ?, ?, ?, ?, 1, ?, ?, ?)`,
    [
      orderId,
      packageNameAr, packageNameEn || packageNameAr,
      svcAr, svcEn,
      totalAmount, totalAmount,
      periodId
    ]
  );

  // ZATCA QR
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
      const vatStr = (Number(vatAmt) || 0).toFixed(2);
      const tlvB64 = buildZatcaTlvBase64({
        sellerName, vatNumber: vatNum, timestamp: iso,
        totalAmount: totalStr, vatAmount: vatStr
      });
      await conn.query(
        `UPDATE orders SET zatca_qr = ?, zatca_submitted = NOW() WHERE id = ?`,
        [tlvB64, orderId]
      );
    }
  } catch (e) {
    console.error('subscription order zatca qr error:', e);
  }

  return orderId;
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

    // ── إنشاء فاتورة بيع للاشتراك ──
    const subOrderId = await _createSubscriptionOrder(conn, {
      customerId: cid,
      packageId: pid,
      packageNameAr: pkg.name_ar || '',
      packageNameEn: pkg.name_en || '',
      periodId,
      orderType: 'subscription_new',
      paymentMethod: data.paymentMethod || 'cash',
      paidCash: data.paidCash || 0,
      paidCard: data.paidCard || 0,
      vatRate: Number(data.vatRate) || 0,
    });
    // ربط الفترة بالفاتورة
    await conn.query('UPDATE subscription_periods SET order_id = ? WHERE id = ?', [subOrderId, periodId]);

    await conn.commit();
    return { subscriptionId: subId, subscriptionRef: ref, periodId, orderId: subOrderId };
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

    // ── إنشاء فاتورة بيع للتجديد ──
    const renewOrderId = await _createSubscriptionOrder(conn, {
      customerId: sub.customer_id,
      packageId: pid,
      packageNameAr: pkg.name_ar || '',
      packageNameEn: pkg.name_en || '',
      periodId,
      orderType: 'subscription_renewal',
      paymentMethod: data.paymentMethod || 'cash',
      paidCash: data.paidCash || 0,
      paidCard: data.paidCard || 0,
      vatRate: Number(data.vatRate) || 0,
    });
    // ربط الفترة بالفاتورة
    await conn.query('UPDATE subscription_periods SET order_id = ? WHERE id = ?', [renewOrderId, periodId]);

    await conn.commit();
    return {
      success:        true,
      periodId:       periodId,
      customerId:     sub.customer_id,
      packageId:      pid,
      subscriptionId: sid,
      subscriptionRef: sub.subscription_ref,
      orderId:        renewOrderId,
    };
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

async function getCustomerUnpaidInvoices(customerId) {
  const cid = Number(customerId);
  if (!cid) throw new Error('معرّف العميل مطلوب');
  const [rows] = await pool.query(
    `SELECT id, invoice_seq, total_amount, created_at
     FROM orders
     WHERE customer_id = ?
       AND payment_status = 'pending'
       AND COALESCE(is_refund, 0) = 0
       AND COALESCE(is_consumption_only, 0) = 0
       AND settled_by_subscription_period_id IS NULL
     ORDER BY created_at ASC`,
    [cid]
  );
  return rows;
}

async function settleInvoicesFromSubscription({ subscriptionPeriodId, invoiceIds, createdBy }) {
  const periodId = Number(subscriptionPeriodId);
  if (!periodId) throw new Error('معرّف فترة الاشتراك مطلوب');
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) throw new Error('يجب اختيار فاتورة واحدة على الأقل');
  const ids = invoiceIds.map(Number).filter(Boolean);
  if (ids.length === 0) throw new Error('معرّفات الفواتير غير صالحة');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[period]] = await conn.query(
      'SELECT id, status, credit_remaining, customer_subscription_id FROM subscription_periods WHERE id = ? FOR UPDATE',
      [periodId]
    );
    if (!period) throw new Error('فترة الاشتراك غير موجودة');
    if (period.status !== 'active') throw new Error('فترة الاشتراك غير نشطة');

    const [[subRow]] = await conn.query(
      'SELECT customer_id FROM customer_subscriptions WHERE id = ?',
      [period.customer_subscription_id]
    );
    if (!subRow) throw new Error('الاشتراك غير موجود');
    const customerId = subRow.customer_id;

    const [invoices] = await conn.query(
      'SELECT id, total_amount, customer_id, payment_status, is_refund, is_consumption_only, settled_by_subscription_period_id FROM orders WHERE id IN (?)',
      [ids]
    );
    if (invoices.length !== ids.length) throw new Error('بعض الفواتير المختارة غير موجودة');
    for (const inv of invoices) {
      if (inv.customer_id !== customerId) throw new Error('بعض الفواتير لا تخص هذا العميل');
      if (inv.payment_status !== 'pending') throw new Error('بعض الفواتير المختارة غير مؤهلة للتسوية');
      if (inv.is_refund == 1) throw new Error('بعض الفواتير المختارة غير مؤهلة للتسوية');
      if (inv.is_consumption_only == 1) throw new Error('بعض الفواتير المختارة غير مؤهلة للتسوية');
      if (inv.settled_by_subscription_period_id) throw new Error('بعض الفواتير مسوّاة مسبقاً');
    }

    const totalSettled = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const creditRemaining = Number(period.credit_remaining);
    if (totalSettled > creditRemaining + 0.001) {
      throw new Error(`إجمالي الفواتير المختارة (${totalSettled.toFixed(2)}) يتجاوز رصيد الاشتراك (${creditRemaining.toFixed(2)})`);
    }

    await conn.query(
      'UPDATE orders SET payment_status = ?, payment_method = ?, paid_at = NOW(), paid_amount = total_amount, remaining_amount = 0, settled_by_subscription_period_id = ? WHERE id IN (?)',
      ['paid', 'cash', periodId, ids]
    );

    const newBalance = Math.round((creditRemaining - totalSettled) * 100) / 100;
    await conn.query(
      'UPDATE subscription_periods SET credit_remaining = ? WHERE id = ?',
      [newBalance, periodId]
    );

    await conn.query(
      `INSERT INTO subscription_ledger (subscription_period_id, entry_type, amount, balance_after, notes, created_by, created_at)
       VALUES (?, 'adjustment', ?, ?, ?, ?, NOW())`,
      [periodId, -totalSettled, newBalance, `تسوية فواتير — عدد الفواتير: ${ids.length}`, createdBy || null]
    );

    await conn.commit();
    return { success: true, settledCount: ids.length, totalSettled: totalSettled.toFixed(2), creditRemainingAfter: newBalance.toFixed(2) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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

  // جلب إيصالات الاستهلاك المرتبطة بالاشتراك
  let consumptionReceipts = [];
  if (subIds.length) {
    const ph4 = subIds.map(() => '?').join(',');
    const [crRows] = await pool.query(
      `SELECT cr.id, cr.receipt_seq, cr.created_at,
              cr.amount_consumed, cr.balance_before, cr.balance_after,
              cr.package_name, cr.items_json,
              c.customer_name, c.phone
       FROM consumption_receipts cr
       LEFT JOIN customers c ON c.id = cr.customer_id
       WHERE cr.subscription_id IN (${ph4})
       ORDER BY cr.created_at ASC`,
      subIds
    );
    consumptionReceipts = crRows;
  }

  return { customer, subscriptions: subs, periods, ledger, invoices, consumptionReceipts };
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
      show_barcode_in_invoice TINYINT(1) NOT NULL DEFAULT 1,
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
    "ALTER TABLE app_settings ADD COLUMN invoice_notes TEXT DEFAULT NULL AFTER location_en"
  ).catch(() => {});
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
    "ALTER TABLE app_settings ADD COLUMN show_barcode_in_invoice TINYINT(1) NOT NULL DEFAULT 1 AFTER barcode_auto_action"
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
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN whatsapp_send_on_print TINYINT(1) NOT NULL DEFAULT 0 AFTER zatca_enabled"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN whatsapp_send_on_clean TINYINT(1) NOT NULL DEFAULT 0 AFTER whatsapp_send_on_print"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN whatsapp_send_on_deliver TINYINT(1) NOT NULL DEFAULT 0 AFTER whatsapp_send_on_clean"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN whatsapp_send_on_subscription TINYINT(1) NOT NULL DEFAULT 0 AFTER whatsapp_send_on_deliver"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN whatsapp_send_on_pay TINYINT(1) NOT NULL DEFAULT 0 AFTER whatsapp_send_on_subscription"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN whatsapp_invoice_message TEXT DEFAULT NULL AFTER whatsapp_send_on_pay"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN support_expiry_date DATE DEFAULT NULL"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN day_reset_hour TINYINT UNSIGNED DEFAULT NULL COMMENT '0-23, null=midnight'"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN day_reset_time VARCHAR(5) DEFAULT NULL COMMENT 'HH:MM format'"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN thermal_margin_left DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER day_reset_time"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN thermal_margin_right DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER thermal_margin_left"
  ).catch(() => {});
  await pool.query(
    "ALTER TABLE app_settings ADD COLUMN show_email_in_invoice TINYINT(1) NOT NULL DEFAULT 1 AFTER thermal_margin_right"
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
    if (!labelAr && !labelEn) continue;
    out.push({ id, labelAr, labelEn });
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
            whatsapp_send_on_print, whatsapp_send_on_clean, whatsapp_send_on_deliver,
            whatsapp_send_on_subscription, whatsapp_send_on_pay, whatsapp_invoice_message,
            loyalty_enabled, loyalty_points_per_sar, loyalty_sar_per_point, loyalty_expiry_date,
            trial_mode_enabled,
            support_expiry_date,
            day_reset_hour,
            day_reset_time,
            thermal_margin_left,
            thermal_margin_right,
            show_email_in_invoice,
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
    thermalMarginLeft: Number.isFinite(Number(row.thermal_margin_left)) ? Number(row.thermal_margin_left) : 0,
    thermalMarginRight: Number.isFinite(Number(row.thermal_margin_right)) ? Number(row.thermal_margin_right) : 0,
    showEmailInInvoice: row.show_email_in_invoice !== 0,
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
    whatsappSendOnPrint: row.whatsapp_send_on_print === 1,
    whatsappSendOnClean: row.whatsapp_send_on_clean === 1,
    whatsappSendOnDeliver: row.whatsapp_send_on_deliver === 1,
    whatsappSendOnSubscription: row.whatsapp_send_on_subscription === 1,
    whatsappSendOnPay: row.whatsapp_send_on_pay === 1,
    whatsappInvoiceMessage: row.whatsapp_invoice_message || '',
    loyaltyEnabled: row.loyalty_enabled === 1,
    loyaltyPointsPerSar: Number(row.loyalty_points_per_sar) || 1,
    loyaltySarPerPoint: Number(row.loyalty_sar_per_point) || 0.05,
    loyaltyExpiryDate: row.loyalty_expiry_date || null,
    trialModeEnabled: row.trial_mode_enabled === 1,
    supportExpiryDate: row.support_expiry_date || null,
    dayResetHour: row.day_reset_hour != null ? Number(row.day_reset_hour) : null,
    dayResetTime: row.day_reset_time || null,
    updatedAt: row.updated_at
  };
}

async function saveAppSettings(data) {
  await migrateAppSettings();

  // ── قراءة السطر الموجود كاملاً أولاً لاستخدامه fallback لأي حقل غير مُرسل ──
  const [[ex]] = await pool.query('SELECT * FROM app_settings WHERE id = 1');
  const existing = ex || {};

  const s = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));

  const laundryNameAr = data.laundryNameAr !== undefined ? s(data.laundryNameAr, 200) : (existing.laundry_name_ar || '');
  const laundryNameEn = data.laundryNameEn !== undefined ? s(data.laundryNameEn, 200) : (existing.laundry_name_en || '');
  const locationAr    = data.locationAr    !== undefined ? s(data.locationAr, 5000)   : (existing.location_ar || '');
  const locationEn    = data.locationEn    !== undefined ? s(data.locationEn, 5000)   : (existing.location_en || '');
  const invoiceNotes  = data.invoiceNotes  !== undefined ? s(data.invoiceNotes, 1000) : (existing.invoice_notes || '');
  const phone         = data.phone  !== undefined ? s(data.phone, 30)   : (existing.phone || '');
  const email         = data.email  !== undefined ? s(data.email, 150)  : (existing.email || '');

  const customFields = data.customFields !== undefined
    ? normalizeCustomFieldsJson(data.customFields)
    : normalizeCustomFieldsJson(existing.custom_fields_json);
  const customJson = JSON.stringify(customFields);

  let vatRate = data.vatRate !== undefined ? Number(data.vatRate) : Number(existing.vat_rate);
  if (Number.isNaN(vatRate) || vatRate < 0) vatRate = 0;
  if (vatRate > 100) vatRate = 100;

  const vatNumber          = data.vatNumber          !== undefined ? s(data.vatNumber, 50)          : (existing.vat_number || '');
  const commercialRegister = data.commercialRegister !== undefined ? s(data.commercialRegister, 50) : (existing.commercial_register || '');
  const buildingNumber     = data.buildingNumber     !== undefined ? s(data.buildingNumber, 20)     : (existing.building_number || '');
  const streetNameAr       = data.streetNameAr       !== undefined ? s(data.streetNameAr, 200)      : (existing.street_name_ar || '');
  const districtAr         = data.districtAr         !== undefined ? s(data.districtAr, 120)        : (existing.district_ar || '');
  const cityAr             = data.cityAr             !== undefined ? s(data.cityAr, 100)            : (existing.city_ar || '');
  const postalCode         = data.postalCode         !== undefined ? s(data.postalCode, 20)         : (existing.postal_code || '');
  const additionalNumber   = data.additionalNumber   !== undefined ? s(data.additionalNumber, 20)   : (existing.additional_number || '');

  const priceDisplayMode = data.priceDisplayMode !== undefined
    ? (data.priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive')
    : (existing.price_display_mode === 'inclusive' ? 'inclusive' : 'exclusive');

  const invoicePaperType = data.invoicePaperType !== undefined
    ? (data.invoicePaperType === 'a4' ? 'a4' : 'thermal')
    : (existing.invoice_paper_type === 'a4' ? 'a4' : 'thermal');

  let logoWidth = data.logoWidth !== undefined ? Math.floor(Number(data.logoWidth)) : Number(existing.logo_width);
  if (!Number.isFinite(logoWidth) || logoWidth < 1) logoWidth = 180;
  if (logoWidth > 2000) logoWidth = 2000;

  let logoHeight = data.logoHeight !== undefined ? Math.floor(Number(data.logoHeight)) : Number(existing.logo_height);
  if (!Number.isFinite(logoHeight) || logoHeight < 1) logoHeight = 70;
  if (logoHeight > 2000) logoHeight = 2000;

  let printCopies = data.printCopies !== undefined ? Math.floor(Number(data.printCopies)) : Number(existing.print_copies);
  if (!Number.isFinite(printCopies) || printCopies < 0) printCopies = 1;
  if (printCopies > 20) printCopies = 20;

  let thermalMarginLeft = data.thermalMarginLeft !== undefined ? Number(data.thermalMarginLeft) : Number(existing.thermal_margin_left || 0);
  if (!Number.isFinite(thermalMarginLeft) || thermalMarginLeft < 0) thermalMarginLeft = 0;
  if (thermalMarginLeft > 20) thermalMarginLeft = 20;

  let thermalMarginRight = data.thermalMarginRight !== undefined ? Number(data.thermalMarginRight) : Number(existing.thermal_margin_right || 0);
  if (!Number.isFinite(thermalMarginRight) || thermalMarginRight < 0) thermalMarginRight = 0;
  if (thermalMarginRight > 20) thermalMarginRight = 20;

  const allMethods = ['cash', 'card', 'credit', 'mixed', 'bank'];
  let enabledPaymentMethods;
  if (data.enabledPaymentMethods !== undefined) {
    enabledPaymentMethods = Array.isArray(data.enabledPaymentMethods)
      ? data.enabledPaymentMethods.filter(m => allMethods.includes(m))
      : allMethods;
  } else {
    try {
      const parsed = typeof existing.enabled_payment_methods === 'string'
        ? JSON.parse(existing.enabled_payment_methods)
        : existing.enabled_payment_methods;
      enabledPaymentMethods = Array.isArray(parsed) && parsed.length > 0 ? parsed : allMethods;
    } catch { enabledPaymentMethods = allMethods; }
  }
  if (enabledPaymentMethods.length === 0) enabledPaymentMethods = allMethods;
  const enabledPaymentJson = JSON.stringify(enabledPaymentMethods);

  const defaultPaymentMethod = data.defaultPaymentMethod !== undefined
    ? ((data.defaultPaymentMethod && allMethods.includes(data.defaultPaymentMethod)) ? data.defaultPaymentMethod : (enabledPaymentMethods[0] || 'cash'))
    : (existing.default_payment_method && allMethods.includes(existing.default_payment_method) ? existing.default_payment_method : 'cash');

  const requireHanger        = data.requireHanger        !== undefined ? (data.requireHanger === true ? 1 : 0)        : (existing.require_hanger || 0);
  const requireCustomerPhone = data.requireCustomerPhone !== undefined ? (data.requireCustomerPhone === true ? 1 : 0) : (existing.require_customer_phone || 0);
  const allowSubscriptionDebt= data.allowSubscriptionDebt!== undefined ? (data.allowSubscriptionDebt === true ? 1 : 0): (existing.allow_subscription_debt || 0);

  const barcodeAutoAction = (() => {
    const raw = data.barcodeAutoAction !== undefined ? data.barcodeAutoAction : (existing.barcode_auto_action || 'none');
    const v = String(raw || 'none').trim();
    if (v === 'none') return 'none';
    const valid = ['pay', 'clean', 'deliver'];
    const parts = v.split(',').filter(p => valid.includes(p));
    return parts.length ? parts.join(',') : 'none';
  })();

  const showBarcodeInInvoice = data.showBarcodeInInvoice !== undefined
    ? (data.showBarcodeInInvoice ? 1 : 0)
    : (existing.show_barcode_in_invoice != null ? existing.show_barcode_in_invoice : 1);

  const showEmailInInvoice = data.showEmailInInvoice !== undefined
    ? (data.showEmailInInvoice ? 1 : 0)
    : (existing.show_email_in_invoice != null ? existing.show_email_in_invoice : 1);

  const reportEmailEnabled = data.reportEmailEnabled !== undefined
    ? (data.reportEmailEnabled === true ? 1 : 0)
    : (existing.report_email_enabled || 0);

  const reportEmailFrom = data.reportEmailFrom !== undefined
    ? s(data.reportEmailFrom, 150)
    : (existing.report_email_from || '');

  const reportEmailSendTime = (() => {
    const raw = data.reportEmailSendTime !== undefined ? data.reportEmailSendTime : (existing.report_email_send_time || '09:00');
    const v = s(raw, 5);
    return /^\d{2}:\d{2}$/.test(v) ? v : '09:00';
  })();

  const reportEmailAppPasswordEnc = (() => {
    if (data.reportEmailAppPasswordEnc !== undefined) {
      return data.reportEmailAppPasswordEnc == null ? null : String(data.reportEmailAppPasswordEnc).trim().slice(0, 5000);
    }
    return existing.report_email_app_password_enc || null;
  })();

  const zatcaEnabled = data.zatcaEnabled !== undefined
    ? (data.zatcaEnabled === true ? 1 : 0)
    : (existing.zatca_enabled || 0);

  const whatsappSendOnPrint        = data.whatsappSendOnPrint        !== undefined ? (data.whatsappSendOnPrint        ? 1 : 0) : (existing.whatsapp_send_on_print        || 0);
  const whatsappSendOnClean        = data.whatsappSendOnClean        !== undefined ? (data.whatsappSendOnClean        ? 1 : 0) : (existing.whatsapp_send_on_clean        || 0);
  const whatsappSendOnDeliver      = data.whatsappSendOnDeliver      !== undefined ? (data.whatsappSendOnDeliver      ? 1 : 0) : (existing.whatsapp_send_on_deliver      || 0);
  const whatsappSendOnSubscription = data.whatsappSendOnSubscription !== undefined ? (data.whatsappSendOnSubscription ? 1 : 0) : (existing.whatsapp_send_on_subscription || 0);
  const whatsappSendOnPay          = data.whatsappSendOnPay          !== undefined ? (data.whatsappSendOnPay          ? 1 : 0) : (existing.whatsapp_send_on_pay          || 0);
  const whatsappInvoiceMessage     = data.whatsappInvoiceMessage     !== undefined ? (s(data.whatsappInvoiceMessage, 1000) || null) : (existing.whatsapp_invoice_message || null);

  const loyaltyEnabled = data.loyaltyEnabled != null
    ? (data.loyaltyEnabled ? 1 : 0)
    : (existing.loyalty_enabled || 0);
  const loyaltyPointsPerSar = data.loyaltyPointsPerSar != null
    ? (() => { let v = Number(data.loyaltyPointsPerSar); return (Number.isFinite(v) && v > 0) ? v : 1; })()
    : (Number(existing.loyalty_points_per_sar) || 1);
  const loyaltySarPerPoint = data.loyaltySarPerPoint != null
    ? (() => { let v = Number(data.loyaltySarPerPoint); return (Number.isFinite(v) && v > 0) ? v : 0.05; })()
    : (Number(existing.loyalty_sar_per_point) || 0.05);
  const loyaltyExpiryDate = data.loyaltyExpiryDate !== undefined
    ? ((data.loyaltyExpiryDate && /^\d{4}-\d{2}-\d{2}$/.test(data.loyaltyExpiryDate)) ? data.loyaltyExpiryDate : null)
    : (existing.loyalty_expiry_date || null);

  const dayResetHour = data.dayResetHour !== undefined
    ? (() => { const h = parseInt(data.dayResetHour, 10); return (Number.isFinite(h) && h >= 0 && h <= 23) ? h : null; })()
    : (existing.day_reset_hour != null ? Number(existing.day_reset_hour) : null);
  const dayResetTime = data.dayResetTime !== undefined
    ? (() => { const t = String(data.dayResetTime || '').trim(); return /^\d{2}:\d{2}$/.test(t) ? t : null; })()
    : (existing.day_reset_time || null);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE app_settings SET
        laundry_name_ar = ?, laundry_name_en = ?, location_ar = ?, location_en = ?, invoice_notes = ?, phone = ?, email = ?,
        custom_fields_json = CAST(? AS JSON), vat_rate = ?, vat_number = ?, commercial_register = ?,
        building_number = ?, street_name_ar = ?, district_ar = ?, city_ar = ?, postal_code = ?, additional_number = ?,
        price_display_mode = ?, invoice_paper_type = ?, logo_width = ?, logo_height = ?, print_copies = ?, thermal_margin_left = ?, thermal_margin_right = ?,
        enabled_payment_methods = CAST(? AS JSON), default_payment_method = ?, require_hanger = ?, require_customer_phone = ?, allow_subscription_debt = ?,
        barcode_auto_action = ?, show_barcode_in_invoice = ?, show_email_in_invoice = ?,
        report_email_enabled = ?, report_email_from = ?, report_email_app_password_enc = ?, report_email_send_time = ?,
        zatca_enabled = ?,
        whatsapp_send_on_print = ?, whatsapp_send_on_clean = ?, whatsapp_send_on_deliver = ?,
        whatsapp_send_on_subscription = ?, whatsapp_send_on_pay = ?, whatsapp_invoice_message = ?,
        loyalty_enabled = ?, loyalty_points_per_sar = ?, loyalty_sar_per_point = ?, loyalty_expiry_date = ?,
        day_reset_hour = ?, day_reset_time = ?
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
        thermalMarginLeft,
        thermalMarginRight,
        enabledPaymentJson,
        defaultPaymentMethod,
        requireHanger,
        requireCustomerPhone,
        allowSubscriptionDebt,
        barcodeAutoAction,
        showBarcodeInInvoice,
        showEmailInInvoice,
        reportEmailEnabled,
        reportEmailFrom || null,
        reportEmailAppPasswordEnc,
        reportEmailSendTime,
        zatcaEnabled,
        whatsappSendOnPrint,
        whatsappSendOnClean,
        whatsappSendOnDeliver,
        whatsappSendOnSubscription,
        whatsappSendOnPay,
        whatsappInvoiceMessage,
        loyaltyEnabled,
        loyaltyPointsPerSar,
        loyaltySarPerPoint,
        loyaltyExpiryDate,
        dayResetHour,
        dayResetTime
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
           (p.image_blob IS NOT NULL AND LENGTH(p.image_blob) > 0) AS has_image,
           p.merzam_enabled
    FROM products p
    WHERE p.is_active = 1
    ORDER BY p.sort_order ASC, p.id ASC
  `);
  const [priceLines] = await pool.query(`
    SELECT ppl.id AS price_line_id, ppl.product_id, ppl.laundry_service_id, ppl.price,
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

async function insertConsumptionReceipt(conn, {
  orderId = null,
  customerId,
  subscriptionId,
  periodId,
  packageName = null,
  amountConsumed,
  balanceBefore,
  balanceAfter,
  itemsJson = null,
  notes = null,
  createdBy = null,
  discountAmount = 0,
  discountLabel = null
}) {
  const [[maxRow]] = await conn.query(
    'SELECT COALESCE(MAX(receipt_seq), 0) AS mx FROM consumption_receipts FOR UPDATE'
  );
  const receiptSeq = Number(maxRow.mx) + 1;
  const [result] = await conn.query(`
    INSERT INTO consumption_receipts
      (receipt_seq, order_id, customer_id, subscription_id, period_id,
       package_name, amount_consumed, balance_before, balance_after,
       items_json, notes, created_by, discount_amount, discount_label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    receiptSeq, orderId, customerId, subscriptionId, periodId,
    packageName, amountConsumed, balanceBefore, balanceAfter,
    itemsJson ? JSON.stringify(itemsJson) : null, notes, createdBy,
    Number(discountAmount) || 0, discountLabel || null
  ]);
  return { receiptId: result.insertId, receiptSeq };
}

async function createConsumptionReceipt(params) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await insertConsumptionReceipt(conn, params);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getConsumptionReceipts({
  page = 1,
  pageSize = 50,
  search = '',
  customerId = null,
  subscriptionId = null,
  dateFrom = null,
  dateTo = null
} = {}) {
  let where = '1=1';
  const params = [];

  if (customerId) {
    where += ' AND cr.customer_id = ?';
    params.push(customerId);
  }
  if (subscriptionId) {
    where += ' AND cr.subscription_id = ?';
    params.push(subscriptionId);
  }
  if (search) {
    where += ` AND (
      c.customer_name LIKE ? OR c.phone LIKE ?
      OR CAST(cr.receipt_seq AS CHAR) LIKE ?
    )`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (dateFrom) {
    where += ' AND cr.created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND cr.created_at <= ?';
    params.push(dateTo + ' 23:59:59');
  }

  const [[countRow]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM consumption_receipts cr
    JOIN customers c ON c.id = cr.customer_id
    WHERE ${where}
  `, params);
  const total = Number(countRow.total);

  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(`
    SELECT
      cr.id, cr.receipt_seq, cr.order_id, cr.customer_id,
      cr.subscription_id, cr.period_id, cr.package_name,
      cr.amount_consumed, cr.balance_before, cr.balance_after,
      cr.discount_amount, cr.discount_label,
      cr.items_json, cr.notes, cr.created_by, cr.created_at,
      c.customer_name, c.phone,
      cs.subscription_ref,
      ref.id AS refund_id,
      ref.refund_amount,
      ref.refund_reason,
      ref.refunded_by,
      ref.refunded_at,
      ref.old_balance AS refund_old_balance,
      ref.new_balance AS refund_new_balance,
      cn.credit_note_number,
      cn.credit_note_seq
    FROM consumption_receipts cr
    JOIN customers c ON c.id = cr.customer_id
    LEFT JOIN customer_subscriptions cs ON cs.id = cr.subscription_id
    LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
    LEFT JOIN credit_notes cn ON cn.id = ref.credit_note_id
    WHERE ${where}
    ORDER BY cr.created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, pageSize, offset]);

  return {
    receipts: rows.map(r => ({
      ...r,
      items: r.items_json ? (typeof r.items_json === 'string' ? JSON.parse(r.items_json) : r.items_json) : []
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1
  };
}

async function getConsumptionReceiptById(receiptId) {
  const [[row]] = await pool.query(`
    SELECT
      cr.*,
      c.customer_name, c.phone, c.address, c.city,
      c.subscription_number, c.customer_type,
      c.national_id, c.tax_number,
      cs.subscription_ref,
      sp.period_from, sp.period_to,
      sp.credit_value_granted,
      ref.id AS refund_id,
      ref.refund_amount,
      ref.refund_reason,
      ref.refunded_by,
      ref.refunded_at,
      ref.old_balance AS refund_old_balance,
      ref.new_balance AS refund_new_balance,
      cn.credit_note_number,
      cn.credit_note_seq
    FROM consumption_receipts cr
    JOIN customers c ON c.id = cr.customer_id
    LEFT JOIN customer_subscriptions cs ON cs.id = cr.subscription_id
    LEFT JOIN subscription_periods sp ON sp.id = cr.period_id
    LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
    LEFT JOIN credit_notes cn ON cn.id = ref.credit_note_id
    WHERE cr.id = ?
  `, [receiptId]);
  if (!row) return null;
  let items = row.items_json ? (typeof row.items_json === 'string' ? JSON.parse(row.items_json) : row.items_json) : [];
  if (row.order_id && Array.isArray(items) && items.length) {
    try {
      const [orderItems] = await pool.query(
        `SELECT id, merzam_type_name
           FROM order_items
          WHERE order_id = ?
          ORDER BY id ASC`,
        [row.order_id]
      );
      if (Array.isArray(orderItems) && orderItems.length) {
        items = items.map((it, idx) => ({
          ...it,
          merzamTypeName: it.merzamTypeName || it.merzam_type_name || (orderItems[idx] ? orderItems[idx].merzam_type_name || null : null)
        }));
      }
    } catch (_) {}
  }
  return {
    ...row,
    items
  };
}

async function searchConsumptionReceiptForRefund({ q } = {}) {
  const query = String(q || '').trim();
  if (!query) throw new Error('قيمة البحث مطلوبة');

  const digitsOnly = query.replace(/\D/g, '');
  const hasReceiptHint = /C\s*[-]?/i.test(query) || /إيصال/i.test(query);

  // If query looks like "C-123" / contains C- use receipt_seq first.
  let receiptSeq = null;
  const mReceipt = query.match(/(?:^|\D)C\s*-\s*(\d+)/i) || query.match(/(?:^|\D)C\s*(\d+)/i);
  if (mReceipt) receiptSeq = Number(mReceipt[1]);
  if (receiptSeq == null && hasReceiptHint && digitsOnly) receiptSeq = Number(digitsOnly);
  if (receiptSeq == null && /^\d+$/.test(query) && digitsOnly) receiptSeq = Number(digitsOnly);

  // Try by receipt_seq (C-#) first when we have a candidate.
  if (receiptSeq != null && Number.isFinite(receiptSeq) && receiptSeq > 0) {
    const [[cr]] = await pool.query(`
      SELECT
        cr.*,
        c.customer_name,
        c.phone,
        c.subscription_number
      FROM consumption_receipts cr
      JOIN customers c ON c.id = cr.customer_id
      WHERE cr.receipt_seq = ?
      ORDER BY cr.created_at DESC
      LIMIT 1
    `, [receiptSeq]);

    if (cr) {
      const [[existing]] = await pool.query(`
        SELECT id, credit_note_seq, credit_note_number, created_at
        FROM credit_notes
        WHERE original_order_id = ?
        ORDER BY id DESC
        LIMIT 1
      `, [cr.order_id]);

      return {
        success: true,
        receipt: {
          receiptId: cr.id,
          receiptSeq: Number(cr.receipt_seq),
          receiptSeqLabel: 'C-' + Number(cr.receipt_seq),
          orderId: cr.order_id,
          createdAt: cr.created_at,
          packageName: cr.package_name,
          customer: {
            id: cr.customer_id,
            name: cr.customer_name,
            phone: cr.phone,
            subscriptionNumber: cr.subscription_number
          },
          amountConsumed: Number(cr.amount_consumed) || 0,
          balanceBefore: Number(cr.balance_before) || 0,
          balanceAfter: Number(cr.balance_after) || 0,
          subscriptionId: cr.subscription_id,
          periodId: cr.period_id,
          items: cr.items_json
            ? (typeof cr.items_json === 'string' ? JSON.parse(cr.items_json) : cr.items_json)
            : []
        },
        alreadyRefunded: existing
          ? {
            creditNoteId: existing.id,
            creditNoteSeq: existing.credit_note_seq,
            creditNoteNumber: existing.credit_note_number,
            refundedAt: existing.created_at
          }
          : null
      };
    }
  }

  // Fallback: treat query as subscription_number and return latest consumption receipt.
  const [[cust]] = await pool.query(`
    SELECT id, subscription_number
    FROM customers
    WHERE subscription_number = ? OR subscription_number LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `, [query, `%${query}%`]);

  if (!cust) throw new Error('لم يتم العثور على اشتراك بهذا الرقم');

  const [[cr]] = await pool.query(`
    SELECT
      cr.*,
      c.customer_name,
      c.phone,
      c.subscription_number
    FROM consumption_receipts cr
    JOIN customer_subscriptions cs ON cs.id = cr.subscription_id
    JOIN customers c ON c.id = cs.customer_id
    WHERE c.subscription_number = ?
    ORDER BY cr.created_at DESC
    LIMIT 1
  `, [cust.subscription_number]);

  if (!cr) throw new Error('لا توجد إيصالات استهلاك لهذا الاشتراك');

  const [[existing]] = await pool.query(`
    SELECT id, credit_note_seq, credit_note_number, created_at
    FROM credit_notes
    WHERE original_order_id = ?
    ORDER BY id DESC
    LIMIT 1
  `, [cr.order_id]);

  return {
    success: true,
    receipt: {
      receiptId: cr.id,
      receiptSeq: Number(cr.receipt_seq),
      receiptSeqLabel: 'C-' + Number(cr.receipt_seq),
      orderId: cr.order_id,
      createdAt: cr.created_at,
      packageName: cr.package_name,
      customer: {
        id: cr.customer_id,
        name: cr.customer_name,
        phone: cr.phone,
        subscriptionNumber: cr.subscription_number
      },
      amountConsumed: Number(cr.amount_consumed) || 0,
      balanceBefore: Number(cr.balance_before) || 0,
      balanceAfter: Number(cr.balance_after) || 0,
      subscriptionId: cr.subscription_id,
      periodId: cr.period_id,
      items: cr.items_json
        ? (typeof cr.items_json === 'string' ? JSON.parse(cr.items_json) : cr.items_json)
        : []
    },
    alreadyRefunded: existing
      ? {
        creditNoteId: existing.id,
        creditNoteSeq: existing.credit_note_seq,
        creditNoteNumber: existing.credit_note_number,
        refundedAt: existing.created_at
      }
      : null
  };
}

async function refundConsumptionReceipt({ receiptSeq, reason, refundedBy } = {}) {
  const seq = Number(receiptSeq);
  if (!seq) throw new Error('رقم الإيصال غير صالح');

  const [[cr]] = await pool.query(`
    SELECT
      cr.*,
      c.customer_name,
      c.phone,
      c.subscription_number
    FROM consumption_receipts cr
    JOIN customers c ON c.id = cr.customer_id
    WHERE cr.receipt_seq = ?
    LIMIT 1
  `, [seq]);

  if (!cr) throw new Error('الإيصال غير موجود');
  if (!cr.order_id) throw new Error('لا يمكن إرجاع هذا الإيصال — مرجع الطلب غير موجود');

  const [[existing]] = await pool.query(`
    SELECT id, created_at FROM refunds
    WHERE consumption_receipt_id = ?
    ORDER BY id DESC LIMIT 1
  `, [cr.id]);
  if (existing) {
    const dateStr = existing.created_at ? String(existing.created_at).slice(0, 10) : '—';
    throw new Error(`هذا الإيصال تم إرجاعه مسبقًا بتاريخ ${dateStr}`);
  }

  const items = cr.items_json
    ? (typeof cr.items_json === 'string' ? JSON.parse(cr.items_json) : cr.items_json)
    : [];

  const cnItems = Array.isArray(items)
    ? items.map(it => ({
      product_id: it.productId ?? it.product_id ?? null,
      laundry_service_id: it.serviceId ?? it.laundry_service_id ?? null,
      product_name_ar: it.productNameAr ?? it.product_name_ar ?? null,
      product_name_en: it.productNameEn ?? it.product_name_en ?? null,
      service_name_ar: it.serviceNameAr ?? it.service_name_ar ?? null,
      service_name_en: it.serviceNameEn ?? it.service_name_en ?? null,
      quantity: it.qty ?? it.quantity ?? 1,
      unit_price: it.unitPrice ?? it.unit_price ?? 0,
      line_total: it.lineTotal ?? it.line_total ?? 0
    }))
    : [];

  const [[orderRow]] = await pool.query(`
    SELECT id, order_number, subtotal, discount_amount, extra_amount,
           vat_rate, vat_amount, total_amount,
           payment_method, payment_status, price_display_mode,
           customer_id
    FROM orders
    WHERE id = ?
    LIMIT 1
  `, [cr.order_id]);

  if (!orderRow) throw new Error('مرجع الفاتورة غير موجود');
  if (orderRow.payment_status !== 'paid') throw new Error('لا يمكن إرجاع فاتورة غير مدفوعة');
  if (orderRow.payment_method !== 'subscription') {
    throw new Error('لا يمكن إرجاع هذا الإيصال — غير مدفوع برصيد الاشتراك');
  }

  const createdByLabel = refundedBy || 'system';
  const conn = await pool.getConnection();
  let refundAmount = null;
  let oldBalance = null;
  let newBalance = null;

  try {
    await conn.beginTransaction();

    // استرجاع مبلغ الاستهلاك من دفتر الاشتراك
    const [[ledgerRow]] = await conn.query(
      `SELECT subscription_period_id, amount
         FROM subscription_ledger
        WHERE ref_type = 'order' AND ref_id = ? AND entry_type = 'consumption'
        ORDER BY id DESC LIMIT 1`,
      [orderRow.id]
    );

    if (ledgerRow) {
      const periodId = Number(ledgerRow.subscription_period_id);
      refundAmount = Number(ledgerRow.amount) || 0;

      const [[periodRow]] = await conn.query(
        `SELECT credit_remaining FROM subscription_periods WHERE id = ? FOR UPDATE`,
        [periodId]
      );
      if (periodRow && refundAmount > 0) {
        oldBalance = Number(periodRow.credit_remaining);
        newBalance = oldBalance + refundAmount;
        await conn.query(
          `UPDATE subscription_periods SET credit_remaining = ? WHERE id = ?`,
          [newBalance, periodId]
        );
        const reasonTxt = reason && String(reason).trim() ? ` — سبب: ${String(reason).trim()}` : '';
        await conn.query(
          `INSERT INTO subscription_ledger
             (subscription_period_id, entry_type, amount, balance_after, ref_type, ref_id, notes, created_by)
           VALUES (?, 'refund', ?, ?, 'consumption_receipt', ?, ?, ?)`,
          [periodId, refundAmount, newBalance, cr.id,
           `إرجاع إيصال استهلاك رقم C-${Number(cr.receipt_seq)}${reasonTxt}`, createdByLabel]
        );
      }
    }

    await conn.query(
      `INSERT INTO refunds
        (original_order_id, consumption_receipt_id, subscription_id, refund_amount, refund_reason, refunded_by, old_balance, new_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderRow.id, cr.id, cr.subscription_id,
       Number(refundAmount) || 0, reason || null, createdByLabel, oldBalance, newBalance]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return {
    success: true,
    receipt: {
      receiptId: cr.id,
      receiptSeq: Number(cr.receipt_seq),
      receiptSeqLabel: 'C-' + Number(cr.receipt_seq),
      orderId: cr.order_id,
      createdAt: cr.created_at,
      packageName: cr.package_name,
      customer: {
        id: cr.customer_id,
        name: cr.customer_name,
        phone: cr.phone,
        subscriptionNumber: cr.subscription_number
      },
      amountConsumed: Number(cr.amount_consumed) || 0,
      balanceBefore: Number(cr.balance_before) || 0,
      balanceAfter: Number(cr.balance_after) || 0,
      subscriptionId: cr.subscription_id,
      periodId: cr.period_id,
      items
    },
    refund: {
      refundAmount,
      oldBalance,
      newBalance,
      reason: reason || null
    }
  };
}

async function generateRefundNumber() {
  const [rows] = await pool.query(
    `SELECT order_number FROM orders
     WHERE order_number REGEXP '^R[0-9]+$'
     ORDER BY CAST(SUBSTRING(order_number, 2) AS UNSIGNED) DESC LIMIT 1`
  );
  let next = 1;
  if (rows.length) {
    const num = parseInt(rows[0].order_number.slice(1), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `R${next}`;
}

async function getOrderForRefund(orderId) {
  const [rows] = await pool.query(
    `SELECT o.*,
            c.customer_name, c.phone
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = ?`,
    [orderId]
  );
  if (!rows.length) return null;
  const order = rows[0];
  const [items] = await pool.query(
    `SELECT oi.*, p.name_ar AS product_name, ls.name_ar AS service_name
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN laundry_services ls ON ls.id = oi.laundry_service_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return { ...order, items };
}

async function createRefund({ originalOrderId, reason, createdBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.query(
      `SELECT * FROM orders WHERE id = ? FOR UPDATE`,
      [originalOrderId]
    );
    if (!orders.length) throw new Error('الإيصال غير موجود');
    const original = orders[0];
    if (original.is_refund) throw new Error('لا يمكن إرجاع سجل مرتجع');
    if (original.refunded_at) throw new Error('هذا الإيصال تم إرجاعه مسبقًا');

    const refundNumber = await generateRefundNumber();
    const totalAmount = Number(original.total_amount) || 0;
    const originalPaymentMethod = String(original.payment_method || 'cash');
    const originalPaidCash = Math.round(Number(original.paid_cash || 0) * 100) / 100;
    const originalPaidCard = Math.round(Number(original.paid_card || 0) * 100) / 100;
    const refundPaidCash = originalPaymentMethod === 'mixed' ? -originalPaidCash : 0;
    const refundPaidCard = originalPaymentMethod === 'mixed' ? -originalPaidCard : 0;
    const refundPaymentMethod = originalPaymentMethod === 'mixed' ? 'mixed' : originalPaymentMethod;

    const [insertRes] = await conn.query(
      `INSERT INTO orders (
        order_number, customer_id, subscription_period_id,
        subtotal, discount_amount, extra_amount, vat_rate, vat_amount, total_amount,
        paid_amount, remaining_amount, paid_cash, paid_card,
        payment_method, payment_status, notes, created_by, created_at,
        is_refund, refund_of_order_id, refund_reason, refunded_at, refunded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1, ?, ?, NOW(), ?)`,
      [
        refundNumber,
        original.customer_id,
        original.subscription_period_id,
        -(Number(original.subtotal) || 0),
        -(Number(original.discount_amount) || 0),
        -(Number(original.extra_amount) || 0),
        original.vat_rate,
        -(Number(original.vat_amount) || 0),
        -totalAmount,
        -totalAmount, 0,
        refundPaidCash,
        refundPaidCard,
        refundPaymentMethod, 'paid',
        `مرتجع إيصال رقم ${original.order_number}`,
        createdBy || null,
        original.id,
        reason || null,
        createdBy || null
      ]
    );
    const refundId = insertRes.insertId;

    await conn.query(
      `UPDATE orders SET refunded_at = NOW(), refunded_by = ? WHERE id = ?`,
      [createdBy || null, originalOrderId]
    );

    const [origItems] = await conn.query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [originalOrderId]
    );
    for (const item of origItems) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, laundry_service_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [refundId, item.product_id, item.laundry_service_id, item.quantity, item.unit_price, -(Number(item.line_total) || 0)]
      );
    }

    let subscriptionInfo = null;
    if (original.subscription_period_id) {
      const [periods] = await conn.query(
        `SELECT sp.*, cs.id AS cs_id
         FROM subscription_periods sp
         JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
         WHERE sp.id = ? FOR UPDATE`,
        [original.subscription_period_id]
      ).catch(() => []);
      const period = periods && periods.length ? periods[0] : null;
      if (period) {
        const newBalance = Number(period.credit_remaining || 0) + totalAmount;
        await conn.query(
          `UPDATE subscription_periods SET credit_remaining = ? WHERE id = ?`,
          [newBalance, original.subscription_period_id]
        );
        try {
          await conn.query(
            `INSERT INTO subscription_ledger
              (subscription_id, period_id, entry_type, amount, balance_after, ref_type, ref_id, notes, created_by)
             VALUES (?, ?, 'refund', ?, ?, 'order', ?, ?, ?)`,
            [
              period.cs_id,
              original.subscription_period_id,
              totalAmount,
              newBalance,
              refundId,
              `مرتجع إيصال رقم ${original.order_number}`,
              createdBy || null
            ]
          );
        } catch (_) {}
        subscriptionInfo = {
          subscriptionId: period.cs_id,
          periodId: original.subscription_period_id,
          newBalance
        };
      }
    }

    await conn.commit();
    return {
      id: refundId,
      orderNumber: refundNumber,
      originalOrderNumber: original.order_number,
      amount: totalAmount,
      subscription: subscriptionInfo
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getSubscriptionTransactions(subscriptionId) {
  const [rows] = await pool.query(
    `SELECT sl.id, sl.entry_type AS type, sl.amount, sl.balance_after,
            sl.ref_id AS reference_order_id,
            sl.notes AS description, sl.created_by AS performed_by, sl.created_at
     FROM subscription_ledger sl
     WHERE sl.subscription_id = ?
     ORDER BY sl.created_at DESC, sl.id DESC`,
    [subscriptionId]
  );
  return rows;
}

async function createOrder({ orderNumber, customerId, items, subtotal, discountAmount, discountLabel, extraAmount = 0,
  vatRate, vatAmount, totalAmount, paymentMethod, paidCash = 0, paidCard = 0,
  starch, bluing, notes, createdBy, priceDisplayMode, hangerId, allowSubscriptionDebt,
  loyaltyPointsToRedeem = 0, customerDiscountAmount = 0, manualDiscountAmount = 0,
  totalWithoutOffer = null, consumptionDiscountAmount = 0, consumptionDiscountLabel = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let pm = paymentMethod || 'cash';
    const pdm = priceDisplayMode === 'inclusive' ? 'inclusive' : 'exclusive';
    const orderType = arguments[0].orderType || 'pos';
    const subscriptionPeriodId = arguments[0].subscriptionPeriodId || null;
    const skipSubscription = arguments[0].skipSubscription === true;

    const numTotal = Number(totalAmount) || 0;
    let consumptionAmount = 0;
    let invoiceAmount = numTotal;
    let isConsumptionOnly = false;
    let pendingConsumption = null;
    const isSubscriptionInvoice = orderType === 'subscription_new' || orderType === 'subscription_renewal';

    if (customerId && !isSubscriptionInvoice && !skipSubscription && numTotal > 0) {
      const [[activeSub]] = await conn.query(`
        SELECT cs.id AS sub_id, sp.id AS period_id, sp.credit_remaining,
               pp.name_ar AS package_name, cs.subscription_ref
        FROM customer_subscriptions cs
        JOIN subscription_periods sp ON sp.customer_subscription_id = cs.id AND sp.status = 'active'
        LEFT JOIN prepaid_packages pp ON pp.id = sp.package_id
        WHERE cs.customer_id = ?
        ORDER BY sp.id DESC LIMIT 1
      `, [Number(customerId)]);

      if (activeSub) {
        const creditRemaining = Number(activeSub.credit_remaining);
        const allowDebt = allowSubscriptionDebt === true;
        // العرض لا يطبق على إيصالات الاستهلاك — نستخدم الإجمالي بعد خصم العميل فقط
        const numTotalForConsumption = totalWithoutOffer != null
          ? Math.round(Number(totalWithoutOffer) * 100) / 100
          : numTotal;

        if (allowDebt) {
          consumptionAmount = numTotalForConsumption;
        } else if (creditRemaining >= numTotalForConsumption) {
          consumptionAmount = numTotalForConsumption;
        }
        // إذا الرصيد لا يكفي الطلب كاملاً ولا مديونية → لا خصم ولا إيصال استهلاك

        if (consumptionAmount === 0 && !allowDebt) {
          const subErr = new Error('رصيد الاشتراك غير كافٍ لتغطية هذا الطلب');
          subErr.code = 'INSUFFICIENT_SUBSCRIPTION_CREDIT';
          subErr.creditRemaining = creditRemaining;
          subErr.orderTotal = numTotalForConsumption;
          throw subErr;
        }

        consumptionAmount = Math.round(consumptionAmount * 100) / 100;
        // invoiceAmount = ما يدفعه العميل نقداً بعد خصم الاستهلاك من الإجمالي المخصوم (numTotal)
        invoiceAmount = Math.round((numTotal - consumptionAmount) * 100) / 100;
        if (invoiceAmount < 0) invoiceAmount = 0;
        isConsumptionOnly = invoiceAmount === 0 && consumptionAmount > 0;

        if (consumptionAmount > 0) {
          const balanceBefore = creditRemaining;
          const newBalance = Math.round((creditRemaining - consumptionAmount) * 100) / 100;
          if (isConsumptionOnly) {
            pm = 'subscription';
          }
          pendingConsumption = {
            subscriptionId: activeSub.sub_id,
            periodId: activeSub.period_id,
            packageName: activeSub.package_name,
            amountConsumed: consumptionAmount,
            balanceBefore,
            balanceAfter: newBalance,
            newBalance
          };
        }
      }
    }

    const payStatus = pm === 'credit' ? 'pending' : 'paid';
    const paidAt = pm === 'credit' ? null : new Date();
    const paidAmount = pm === 'credit' ? 0 : numTotal;
    const remainingAmount = pm === 'credit' ? numTotal : 0;

    let dbPaidCash = 0;
    let dbPaidCard = 0;
    if (pm === 'mixed') {
      dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), numTotal));
      dbPaidCard = Math.max(0, numTotal - dbPaidCash);
      dbPaidCash = Math.round(dbPaidCash * 100) / 100;
      dbPaidCard = Math.round(dbPaidCard * 100) / 100;
    }

    let dbSubtotal = Number(subtotal) || 0;
    let dbVatRate = Number(vatRate) || 0;
    let dbVatAmount = Number(vatAmount) || 0;
    if (isConsumptionOnly) {
      dbVatRate = 0;
      dbVatAmount = 0;
    } else if (consumptionAmount > 0 && invoiceAmount > 0 && numTotal > 0) {
      const ratio = invoiceAmount / numTotal;
      dbVatAmount = Math.round(dbVatAmount * ratio * 100) / 100;
      dbSubtotal = Math.round(dbSubtotal * ratio * 100) / 100;
    }

    let invoiceSeq = null;
    if (!isConsumptionOnly) {
      const [[seqRow]] = await conn.query(
        'SELECT GREATEST(COALESCE(MAX(invoice_seq), 0), COALESCE(MAX(id), 0)) AS mx FROM orders FOR UPDATE'
      );
      invoiceSeq = Number(seqRow.mx) + 1;
    }

    const [result] = await conn.query(
      `INSERT INTO orders
         (order_number, invoice_seq, order_type, subscription_period_id, customer_id, subtotal, discount_amount, discount_label, extra_amount, vat_rate, vat_amount,
         total_amount, paid_amount, remaining_amount, paid_cash, paid_card,
         payment_method, payment_status, paid_at, notes, created_by, price_display_mode, starch, bluing, hanger_id,
         is_consumption_only, consumption_amount, customer_discount_amount, manual_discount_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, invoiceSeq, orderType, subscriptionPeriodId, customerId || null, dbSubtotal, discountAmount || 0, discountLabel || null, extraAmount || 0, dbVatRate,
        dbVatAmount, numTotal, paidAmount, remainingAmount, dbPaidCash, dbPaidCard,
        pm, payStatus, paidAt, notes || null, createdBy || null, pdm,
        starch || null, bluing || null, hangerId || null,
        isConsumptionOnly ? 1 : 0, consumptionAmount, Number(customerDiscountAmount) || 0, Number(manualDiscountAmount) || 0]
    );
    const orderId = result.insertId;

    let zatcaQr = null;
    if (!isConsumptionOnly && invoiceSeq) {
      try {
        const [[zs]] = await conn.query(
          `SELECT company_name, vat_number FROM zatca_settings WHERE id = 1`
        );
        const sellerName = zs && zs.company_name ? String(zs.company_name).trim() : '';
        const vatNum = zs && zs.vat_number ? String(zs.vat_number).trim() : '';
        if (sellerName && vatNum) {
          const t = new Date();
          const iso = isNaN(t.getTime()) ? '' : t.toISOString();
          const qrTotal = invoiceAmount > 0 && consumptionAmount > 0 ? invoiceAmount : numTotal;
          const qrVat = dbVatAmount;
          const tlvB64 = buildZatcaTlvBase64({
            sellerName,
            vatNumber: vatNum,
            timestamp: iso,
            totalAmount: qrTotal.toFixed(2),
            vatAmount: qrVat.toFixed(2)
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
    }

    if (hangerId) {
      try {
        await conn.query(`UPDATE hangers SET status = 'occupied' WHERE id = ?`, [Number(hangerId)]);
      } catch (hangerErr) {
        console.error('hanger update error:', hangerErr);
      }
    }

    const itemsJsonSnapshot = (items || []).map(it => ({
      productId: it.productId || null,
      serviceId: it.serviceId || null,
      qty: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
      productNameAr: it.productNameAr || null,
      productNameEn: it.productNameEn || null,
      serviceNameAr: it.serviceNameAr || null,
      serviceNameEn: it.serviceNameEn || null,
      merzamTypeName: it.merzamTypeName || null
    }));

    for (const item of (items || [])) {
      await conn.query(
        `INSERT INTO order_items
           (order_id, product_id, laundry_service_id, quantity, unit_price, line_total, merzam_type_id, merzam_type_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId || null, item.serviceId || null, item.quantity, item.unitPrice, item.lineTotal,
         item.merzamTypeId || null, item.merzamTypeName || null]
      );
    }

    let consumptionReceiptId = null;
    let consumptionReceiptSeq = null;

    if (pendingConsumption) {
      await conn.query(
        'UPDATE subscription_periods SET credit_remaining = ? WHERE id = ?',
        [pendingConsumption.newBalance, pendingConsumption.periodId]
      );

      const receipt = await insertConsumptionReceipt(conn, {
        orderId,
        customerId: Number(customerId),
        subscriptionId: pendingConsumption.subscriptionId,
        periodId: pendingConsumption.periodId,
        packageName: pendingConsumption.packageName,
        amountConsumed: pendingConsumption.amountConsumed,
        balanceBefore: pendingConsumption.balanceBefore,
        balanceAfter: pendingConsumption.balanceAfter,
        itemsJson: itemsJsonSnapshot,
        notes: null,
        createdBy: createdBy || null,
        discountAmount: Number(consumptionDiscountAmount) || 0,
        discountLabel: consumptionDiscountLabel || null
      });
      consumptionReceiptId = receipt.receiptId;
      consumptionReceiptSeq = receipt.receiptSeq;

      await conn.query(
        'UPDATE orders SET consumption_receipt_id = ? WHERE id = ?',
        [consumptionReceiptId, orderId]
      );

      const ledgerNote = isConsumptionOnly
        ? `إيصال استهلاك C-${receipt.receiptSeq}`
        : `استهلاك جزئي C-${receipt.receiptSeq} — فاتورة ${invoiceSeq || ''}`;

      await conn.query(
        `INSERT INTO subscription_ledger
           (subscription_period_id, entry_type, amount, balance_after, ref_type, ref_id, notes, created_by)
         VALUES (?, 'consumption', ?, ?, 'order', ?, ?, ?)`,
        [pendingConsumption.periodId, pendingConsumption.amountConsumed, pendingConsumption.balanceAfter,
          orderId, ledgerNote, createdBy || null]
      );
    }

    // ── Loyalty Points: Earn & Redeem ──────────────────────────────────────
    let loyaltyEarned   = 0;
    let loyaltyRedeemed = 0;
    let loyaltyDiscAmt  = 0;

    if (customerId && !isConsumptionOnly) {
      try {
        const [[loySettings]] = await conn.query(
          'SELECT loyalty_enabled, loyalty_points_per_sar, loyalty_sar_per_point FROM app_settings WHERE id = 1'
        );
        if (loySettings && loySettings.loyalty_enabled) {
          const pps = Number(loySettings.loyalty_points_per_sar) || 1;
          const spp = Number(loySettings.loyalty_sar_per_point) || 0.05;

          // ── Redeem ──
          const toRedeem = Math.max(0, Math.floor(Number(loyaltyPointsToRedeem) || 0));
          if (toRedeem > 0) {
            const [[custRow]] = await conn.query(
              'SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE',
              [Number(customerId)]
            );
            const currentBalance = custRow ? Number(custRow.loyalty_points) : 0;
            const actualRedeem = Math.min(toRedeem, currentBalance);
            if (actualRedeem > 0) {
              loyaltyDiscAmt  = Math.round(actualRedeem * spp * 100) / 100;
              loyaltyRedeemed = actualRedeem;
              const newBalance = currentBalance - actualRedeem;
              await conn.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newBalance, Number(customerId)]);
              await conn.query(
                `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, balance_after, note, created_by)
                 VALUES (?, ?, 'redeem', ?, ?, ?, ?)`,
                [Number(customerId), orderId, -actualRedeem, newBalance,
                  `استرداد ${actualRedeem} نقطة — فاتورة رقم ${invoiceSeq || orderId}`, createdBy || null]
              );
              await conn.query(
                'UPDATE orders SET loyalty_discount_amount = ?, loyalty_points_redeemed = ? WHERE id = ?',
                [loyaltyDiscAmt, actualRedeem, orderId]
              );
            }
          }

          // ── Earn (على إجمالي المبلغ المدفوع، فقط للفواتير المدفوعة فوراً — الآجل يُضاف عند السداد) ──
          if (pm !== 'credit') {
            loyaltyEarned = Math.floor(numTotal * pps);
            if (loyaltyEarned > 0) {
              const [[custAfter]] = await conn.query(
                'SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE',
                [Number(customerId)]
              );
              const balAfterRedeem = custAfter ? Number(custAfter.loyalty_points) : 0;
              const newBalanceEarn = balAfterRedeem + loyaltyEarned;
              await conn.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newBalanceEarn, Number(customerId)]);
              await conn.query('UPDATE orders SET loyalty_points_earned = ? WHERE id = ?', [loyaltyEarned, orderId]);
              await conn.query(
                `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, balance_after, note, created_by)
                 VALUES (?, ?, 'earn', ?, ?, ?, ?)`,
                [Number(customerId), orderId, loyaltyEarned, newBalanceEarn,
                  `كسب ${loyaltyEarned} نقطة — فاتورة رقم ${invoiceSeq || orderId}`, createdBy || null]
              );
            }
          }
          // تنبيه: الفواتير الآجلة (credit) تُضاف نقاطها عند السداد في payDeferredOrder
        }
      } catch (loyErr) {
        console.error('loyalty points error in createOrder:', loyErr);
      }
    }
    // ── End Loyalty ───────────────────────────────────────────────────────

    await conn.commit();
    return {
      id: orderId,
      orderNumber,
      invoiceSeq,
      paymentMethod: pm,
      zatcaQr,
      isConsumptionOnly,
      consumptionReceiptId,
      consumptionReceiptSeq,
      consumptionAmount,
      customerDiscountAmount: Number(customerDiscountAmount) || 0,
      consumptionDiscountAmount: Number(consumptionDiscountAmount) || 0,
      consumptionDiscountLabel: consumptionDiscountLabel || null,
      discountLabel: discountLabel || null,
      invoiceAmount,
      loyaltyEarned,
      loyaltyRedeemed
    };
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
            o.is_consumption_only, o.consumption_receipt_id, o.consumption_amount,
            sl.amount AS deducted_amount,
            cr.receipt_seq AS consumption_receipt_seq
     FROM subscription_ledger sl
     INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
     INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
     INNER JOIN orders o ON o.id = sl.ref_id
     LEFT JOIN consumption_receipts cr ON cr.id = o.consumption_receipt_id
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

  let whereClauses = `WHERE (o.order_number LIKE ? OR COALESCE(c.customer_name,'') LIKE ? OR COALESCE(c.phone,'') LIKE ?)
    AND COALESCE(o.is_consumption_only, 0) = 0`;
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
    SELECT o.id, o.order_number, o.invoice_seq, o.order_type, o.subscription_period_id, o.subtotal, o.discount_amount, o.discount_label, o.extra_amount, o.vat_rate, o.vat_amount,
           o.total_amount, o.payment_method, o.payment_status, o.paid_amount, o.remaining_amount,
           o.notes, o.created_at, o.created_by, o.price_display_mode,
           o.is_consumption_only, o.consumption_receipt_id, o.consumption_amount,
           o.zatca_uuid, o.zatca_hash, o.zatca_qr, o.zatca_submitted, o.zatca_status, o.zatca_rejection_reason, o.zatca_response,
           o.is_refund, o.refunded_at,
           c.customer_name, c.phone,
           COALESCE((SELECT usr.full_name FROM users usr WHERE usr.username = CONVERT(o.created_by USING utf8mb4) COLLATE utf8mb4_unicode_ci LIMIT 1), o.created_by) AS cashier_name
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
    SELECT o.id, o.order_number, o.invoice_seq, o.order_type, o.customer_id, o.subtotal, o.discount_amount, o.discount_label, o.extra_amount, o.vat_rate, o.vat_amount,
           o.total_amount, o.paid_amount, o.remaining_amount, o.paid_cash, o.paid_card,
           o.payment_method, o.payment_status, o.notes, o.created_at, o.created_by,
           o.paid_at, 
           COALESCE(cr.cleaning_date, o.cleaning_date) AS cleaning_date, 
           COALESCE(cr.delivery_date, o.delivery_date) AS delivery_date, 
           o.price_display_mode, o.starch, o.bluing,
           o.hanger_id, h.hanger_number,
           o.is_consumption_only, o.is_consolidated, o.consumption_receipt_id, o.consumption_amount,
           o.zatca_uuid, o.zatca_hash, o.zatca_qr, o.zatca_submitted, o.zatca_status, o.zatca_rejection_reason, o.zatca_response,
           o.is_refund, o.refunded_at, o.refund_reason, o.refunded_by,
           o.loyalty_points_earned, o.loyalty_points_redeemed, o.loyalty_discount_amount,
           c.customer_name, c.phone, c.tax_number AS customer_vat, c.address AS customer_address, c.city AS customer_city,
           c.loyalty_points AS customer_loyalty_points,
           COALESCE((SELECT usr.full_name FROM users usr WHERE usr.username = CONVERT(o.created_by USING utf8mb4) COLLATE utf8mb4_unicode_ci LIMIT 1), o.created_by) AS cashier_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN hangers h ON h.id = o.hanger_id
    LEFT JOIN consumption_receipts cr ON cr.id = o.consumption_receipt_id
    WHERE o.id = ?
  `, [id]);
  if (!order) return null;

  const [items] = await pool.query(`
    SELECT oi.id, oi.product_id, oi.laundry_service_id, oi.quantity, oi.unit_price, oi.line_total,
           COALESCE(oi.product_name_ar, p.name_ar) AS product_name_ar,
           COALESCE(oi.product_name_en, p.name_en) AS product_name_en,
           COALESCE(oi.service_name_ar, ls.name_ar) AS service_name_ar,
           COALESCE(oi.service_name_en, ls.name_en) AS service_name_en,
           oi.merzam_type_name
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN laundry_services ls ON ls.id = oi.laundry_service_id
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

    await pool.query(`
      UPDATE orders
      SET payment_status = 'paid',
          paid_amount = total_amount,
          remaining_amount = 0,
          paid_at = COALESCE(paid_at, created_at, NOW()),
          fully_paid_at = COALESCE(fully_paid_at, paid_at, created_at, NOW()),
          cleaning_date = COALESCE(cleaning_date, created_at, NOW()),
          delivery_date = COALESCE(delivery_date, created_at, NOW())
      WHERE COALESCE(is_consolidated, 0) = 1
    `);
  } catch (e) {
    console.error('migrateOrdersDeferredColumns:', e);
  }
}

async function migrateExpensesDateTime() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'expenses'`
    );
    const colMap = new Map(cols.map(c => [c.COLUMN_NAME, String(c.COLUMN_TYPE).toLowerCase()]));
    const expenseDateType = colMap.get('expense_date') || '';
    if (expenseDateType === 'date') {
      await pool.query(`ALTER TABLE expenses MODIFY COLUMN expense_date DATETIME NOT NULL`);
    }
  } catch (e) {
    console.error('migrateExpensesDateTime:', e);
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
    const seqMatch = trimmed.match(/^[cC]-?(\d+)$/);
    const workOrderMatch = trimmed.match(/^[dD]-?(\d+)$/);
    const workOrderSeq = workOrderMatch ? Number(workOrderMatch[1]) : null;
    const params = [];
    let whereClause;
    let includeDeferredOnly = true;

    if (seqMatch) {
      // c1, c2 ... → بحث في إيصالات الاستهلاك برقم الإيصال
      const receiptSeq = Number(seqMatch[1]);
      const [receiptRows] = await pool.query(`
        SELECT cr.id, cr.receipt_seq, cr.order_id,
               cr.amount_consumed AS total_amount,
               cr.created_at, cr.cleaning_date, cr.delivery_date,
               c.id AS customer_id, c.customer_name, c.phone,
               'receipt' AS rowType,
               CASE WHEN ref.id IS NOT NULL THEN 1 ELSE 0 END AS is_refund
        FROM consumption_receipts cr
        LEFT JOIN customers c ON c.id = cr.customer_id
        LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
        WHERE cr.receipt_seq = ?
        LIMIT 1
      `, [receiptSeq]);
      return receiptRows;
    } else if (workOrderMatch) {
      whereClause = `
        EXISTS (
          SELECT 1
          FROM work_orders wo
          LEFT JOIN order_items oi ON oi.work_order_id = wo.id
          WHERE wo.work_order_seq = ?
            AND (wo.consolidated_order_id = o.id OR oi.order_id = o.id)
        )
      `;
      params.push(workOrderSeq);
      includeDeferredOnly = false;
    } else if (isNumeric) {
      if (trimmed.length >= 7) {
        // رقم طويل → بحث في الجوال
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

    const includeReceipts = ['paid', 'settled', 'cleaned', 'delivered', 'unclean', 'undelivered', 'all'].includes(normalizedStatusFilter);
    if (includeReceipts) {
      includeDeferredOnly = false;
    }

    if (workOrderMatch) {
      let workOrderDateClause = '';
      if (normalizedStatusFilter === 'unclean') {
        workOrderDateClause = `AND wo.cleaning_date IS NULL`;
      } else if (normalizedStatusFilter === 'undelivered') {
        workOrderDateClause = `AND wo.delivery_date IS NULL`;
      } else if (normalizedStatusFilter === 'cleaned') {
        workOrderDateClause = `AND wo.cleaning_date IS NOT NULL`;
      } else if (normalizedStatusFilter === 'delivered') {
        workOrderDateClause = `AND wo.delivery_date IS NOT NULL`;
      }

      const [workOrderRows] = await pool.query(`
        SELECT
          wo.id, wo.work_order_number AS order_number, wo.work_order_seq AS invoice_seq,
          wo.total_amount, wo.total_amount AS paid_amount, 0 AS remaining_amount,
          wo.created_at AS fully_paid_at, 'work_order' AS payment_method, 'paid' AS payment_status,
          wo.created_at, wo.created_at AS paid_at, wo.cleaning_date, wo.delivery_date,
          wo.notes, NULL AS refunded_at, 0 AS is_refund, 0 AS is_consolidated,
          0 AS has_credit_note,
          c.id AS customer_id, c.customer_name, c.phone,
          'work_order' AS rowType, wo.work_order_number, wo.work_order_seq
        FROM work_orders wo
        LEFT JOIN customers c ON c.id = wo.customer_id
        WHERE wo.work_order_seq = ?
          AND wo.consolidated_order_id IS NULL
          AND wo.status <> 'cancelled'
          ${workOrderDateClause}
        LIMIT 1
      `, [workOrderSeq]);

      if (workOrderRows.length > 0) {
        return workOrderRows;
      }
    }

    let statusClause;
    if (normalizedStatusFilter === 'unclean') {
      statusClause = `AND o.payment_status = 'paid' AND o.cleaning_date IS NULL`;
    } else if (normalizedStatusFilter === 'undelivered') {
      statusClause = `AND o.payment_status = 'paid' AND o.delivery_date IS NULL`;
    } else if (normalizedStatusFilter === 'cleaned') {
      statusClause = `AND o.cleaning_date IS NOT NULL`;
    } else if (normalizedStatusFilter === 'delivered') {
      statusClause = `AND o.delivery_date IS NOT NULL`;
    } else {
      statusClause = includeDeferredOnly ? `AND o.payment_status IN ('pending','partial')` : '';
    }

    const [rows] = await pool.query(`
      SELECT
        o.id, o.order_number, o.invoice_seq, o.total_amount,
        o.paid_amount, o.remaining_amount, o.fully_paid_at,
        o.payment_method, o.payment_status,
        o.created_at, o.paid_at, o.cleaning_date, o.delivery_date,
        o.notes, o.refunded_at, COALESCE(o.is_refund, 0) AS is_refund, COALESCE(o.is_consolidated, 0) AS is_consolidated,
        (EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.original_order_id = o.id)) AS has_credit_note,
        c.id AS customer_id, c.customer_name, c.phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE ${whereClause}
      AND COALESCE(o.is_consumption_only, 0) = 0
      ${statusClause}
      ORDER BY FIELD(o.payment_status, 'partial', 'pending', 'paid'), o.created_at DESC
      LIMIT 2000
    `, params);

    let resultRows = rows;

    if ((isNumeric && trimmed.length >= 7) || !isNumeric) {
      let workOrderWhere;
      const workOrderParams = [];
      if (isNumeric && trimmed.length >= 7) {
        workOrderWhere = `COALESCE(c.phone, '') LIKE ?`;
        workOrderParams.push(`${trimmed}%`);
      } else {
        workOrderWhere = `COALESCE(c.customer_name, '') LIKE ?`;
        workOrderParams.push(`%${trimmed}%`);
      }

      let workOrderDateClause = '';
      if (normalizedStatusFilter === 'unclean') {
        workOrderDateClause = `AND wo.cleaning_date IS NULL`;
      } else if (normalizedStatusFilter === 'undelivered') {
        workOrderDateClause = `AND wo.delivery_date IS NULL`;
      } else if (normalizedStatusFilter === 'cleaned') {
        workOrderDateClause = `AND wo.cleaning_date IS NOT NULL`;
      } else if (normalizedStatusFilter === 'delivered') {
        workOrderDateClause = `AND wo.delivery_date IS NOT NULL`;
      }

      const [workOrderRows] = await pool.query(`
        SELECT
          wo.id, wo.work_order_number AS order_number, wo.work_order_seq AS invoice_seq,
          wo.total_amount, wo.total_amount AS paid_amount, 0 AS remaining_amount,
          wo.created_at AS fully_paid_at, 'work_order' AS payment_method, 'paid' AS payment_status,
          wo.created_at, wo.created_at AS paid_at, wo.cleaning_date, wo.delivery_date,
          wo.notes, NULL AS refunded_at, 0 AS is_refund, 0 AS is_consolidated,
          0 AS has_credit_note,
          c.id AS customer_id, c.customer_name, c.phone,
          'work_order' AS rowType, wo.work_order_number, wo.work_order_seq
        FROM work_orders wo
        LEFT JOIN customers c ON c.id = wo.customer_id
        WHERE ${workOrderWhere}
          AND wo.consolidated_order_id IS NULL
          AND wo.status <> 'cancelled'
          ${workOrderDateClause}
        ORDER BY wo.created_at DESC
        LIMIT 2000
      `, workOrderParams);

      resultRows = [...resultRows, ...workOrderRows];
    }

    // إضافة إيصالات الاستهلاك عند الفلاتر المناسبة
    if (includeReceipts) {
      let receiptWhere;
      const receiptParams = [];
      if (isNumeric && trimmed.length >= 7) {
        receiptWhere = `COALESCE(c.phone, '') LIKE ?`;
        receiptParams.push(`${trimmed}%`);
      } else if (!isNumeric) {
        receiptWhere = `COALESCE(c.customer_name, '') LIKE ?`;
        receiptParams.push(`%${trimmed}%`);
      } else {
        // بحث برقم قصير → لا نبحث في الإيصالات هنا (c1 معالج مسبقاً)
        return resultRows;
      }

      let receiptDateClause = '';
      if (normalizedStatusFilter === 'unclean') {
        receiptDateClause = `AND cr.cleaning_date IS NULL`;
      } else if (normalizedStatusFilter === 'undelivered') {
        receiptDateClause = `AND cr.delivery_date IS NULL`;
      } else if (normalizedStatusFilter === 'cleaned') {
        receiptDateClause = `AND cr.cleaning_date IS NOT NULL`;
      } else if (normalizedStatusFilter === 'delivered') {
        receiptDateClause = `AND cr.delivery_date IS NOT NULL`;
      }

      const [receiptRows] = await pool.query(`
        SELECT cr.id, NULL AS order_number, cr.receipt_seq AS invoice_seq, cr.amount_consumed AS total_amount,
               cr.amount_consumed AS paid_amount, 0 AS remaining_amount, cr.created_at AS fully_paid_at,
               'subscription' AS payment_method, 'paid' AS payment_status,
               cr.created_at, cr.created_at AS paid_at, cr.cleaning_date, cr.delivery_date,
               cr.notes,
               c.id AS customer_id, c.customer_name, c.phone,
               'receipt' AS rowType, cr.receipt_seq,
               CASE WHEN ref.id IS NOT NULL THEN 1 ELSE 0 END AS is_refund
        FROM consumption_receipts cr
        LEFT JOIN customers c ON c.id = cr.customer_id
        LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
        WHERE ${receiptWhere}
        ${receiptDateClause}
        ORDER BY cr.created_at DESC
        LIMIT 2000
      `, receiptParams);
      return [...resultRows, ...receiptRows];
    }

    return resultRows;
  } else {
    const [rows] = await pool.query(`
      SELECT
        o.id, o.order_number, o.invoice_seq, o.total_amount,
        o.paid_amount, o.remaining_amount, o.fully_paid_at,
        o.payment_method, o.payment_status,
        o.created_at, o.paid_at, o.cleaning_date, o.delivery_date,
        o.notes, o.refunded_at, COALESCE(o.is_refund, 0) AS is_refund, COALESCE(o.is_consolidated, 0) AS is_consolidated,
        (EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.original_order_id = o.id)) AS has_credit_note,
        c.id AS customer_id, c.customer_name, c.phone
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.payment_status IN ('pending','partial')
      AND COALESCE(o.is_consumption_only, 0) = 0
      ORDER BY FIELD(o.payment_status, 'partial', 'pending'), o.created_at DESC
      LIMIT 2000
    `);
    return rows;
  }
}

async function getDeferredBySubscription({ subscriptionSearch, statusFilter = 'unpaid' } = {}) {
  const trimmed = String(subscriptionSearch || '').trim();
  if (!trimmed) return [];

  const normalizedStatusFilter = String(statusFilter || 'unpaid').toLowerCase();
  const includeReceipts = ['paid', 'settled', 'cleaned', 'delivered', 'unclean', 'undelivered', 'all'].includes(normalizedStatusFilter);

  // بناء شرط الحالة للطلبات
  let orderStatusClause = '';
  if (normalizedStatusFilter === 'unclean') {
    orderStatusClause = `AND o.payment_status = 'paid' AND o.cleaning_date IS NULL`;
  } else if (normalizedStatusFilter === 'undelivered') {
    orderStatusClause = `AND o.payment_status = 'paid' AND o.delivery_date IS NULL`;
  } else if (!includeReceipts) {
    orderStatusClause = `AND o.payment_status IN ('pending','partial')`;
  } else if (normalizedStatusFilter === 'cleaned') {
    orderStatusClause = `AND o.cleaning_date IS NOT NULL`;
  } else if (normalizedStatusFilter === 'delivered') {
    orderStatusClause = `AND o.delivery_date IS NOT NULL`;
  }

  // شرط الحالة لإيصالات الاستهلاك
  let receiptStatusClause = '';
  if (normalizedStatusFilter === 'unclean') {
    receiptStatusClause = `AND cr.cleaning_date IS NULL`;
  } else if (normalizedStatusFilter === 'undelivered') {
    receiptStatusClause = `AND cr.delivery_date IS NULL`;
  } else if (normalizedStatusFilter === 'cleaned') {
    receiptStatusClause = `AND cr.cleaning_date IS NOT NULL`;
  } else if (normalizedStatusFilter === 'delivered') {
    receiptStatusClause = `AND cr.delivery_date IS NOT NULL`;
  }

  // ابحث عن العميل برقم ملف الاشتراك أولاً
  const [[customer]] = await pool.query(
    `SELECT id FROM customers WHERE subscription_number = ? LIMIT 1`,
    [trimmed]
  );
  if (!customer) return [];
  const customerId = customer.id;

  const [orderRows] = await pool.query(`
    SELECT o.id, o.order_number, o.invoice_seq, o.total_amount,
           o.paid_amount, o.remaining_amount, o.fully_paid_at,
           o.payment_method, o.payment_status,
           o.created_at, o.paid_at, o.cleaning_date, o.delivery_date,
           o.notes, o.refunded_at, COALESCE(o.is_refund, 0) AS is_refund, COALESCE(o.is_consolidated, 0) AS is_consolidated,
           (EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.original_order_id = o.id)) AS has_credit_note,
           c.id AS customer_id, c.customer_name, c.phone
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.customer_id = ?
    AND COALESCE(o.is_consumption_only, 0) = 0
    ${orderStatusClause}
    ORDER BY FIELD(o.payment_status, 'partial', 'pending', 'paid'), o.created_at DESC
    LIMIT 2000
  `, [customerId]);

  if (!includeReceipts) return orderRows;

  const [receiptRows] = await pool.query(`
    SELECT cr.id, NULL AS order_number, cr.receipt_seq AS invoice_seq, cr.amount_consumed AS total_amount,
           cr.amount_consumed AS paid_amount, 0 AS remaining_amount, cr.created_at AS fully_paid_at,
           'subscription' AS payment_method, 'paid' AS payment_status,
           cr.created_at, cr.created_at AS paid_at, cr.cleaning_date, cr.delivery_date,
           cr.notes,
           c.id AS customer_id, c.customer_name, c.phone,
           'receipt' AS rowType, cr.receipt_seq,
           CASE WHEN ref.id IS NOT NULL THEN 1 ELSE 0 END AS is_refund
    FROM consumption_receipts cr
    LEFT JOIN customers c ON c.id = cr.customer_id
    LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
    WHERE cr.customer_id = ?
    ${receiptStatusClause}
    ORDER BY cr.created_at DESC
    LIMIT 2000
  `, [customerId]);

  return [...orderRows, ...receiptRows];
}

async function payDeferredOrder({ orderId, paymentMethod, paidCash = 0, paidCard = 0, createdBy = 'system' }) {
  const id = Number(orderId);
  if (!id) throw new Error('معرّف الفاتورة غير صالح');
  const pm = String(paymentMethod || 'cash');
  let dbPaidCash = 0;
  let dbPaidCard = 0;

  const [[ord]] = await pool.query(
    'SELECT total_amount, paid_amount, remaining_amount, customer_id, subtotal, discount_amount, vat_rate, price_display_mode, invoice_seq, loyalty_points_earned FROM orders WHERE id = ?',
    [id]
  );
  if (!ord) throw new Error('الفاتورة غير موجودة');
  const total = Number(ord.total_amount || 0);
  // المبلغ المتبقي الفعلي (قد يكون بعض منه مدفوع مسبقاً بدفعات جزئية)
  const remaining = Number(ord.remaining_amount || total);

  if (pm === 'mixed') {
    dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), remaining));
    dbPaidCard = Math.max(0, remaining - dbPaidCash);
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

  // تسجيل الدفعة في invoice_payments حتى تُحسب ضمن "مدفوعات الآجل" في التقارير
  // وتُستثنى من سطر المبيعات العادية
  await pool.query(`
    INSERT INTO invoice_payments (order_id, payment_amount, payment_method, cash_amount, card_amount, created_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, remaining, pm, dbPaidCash, dbPaidCard, createdBy, 'سداد كامل الفاتورة الآجلة']);

  // ── إضافة نقاط الولاء عند سداد الفاتورة الآجلة ──
  const customerId = Number(ord.customer_id);
  const alreadyEarned = Number(ord.loyalty_points_earned || 0);
  if (customerId && alreadyEarned === 0) {
    try {
      const [[loySettings]] = await pool.query(
        'SELECT loyalty_enabled, loyalty_points_per_sar, loyalty_sar_per_point FROM app_settings WHERE id = 1'
      );
      if (loySettings && loySettings.loyalty_enabled) {
        const pps = Number(loySettings.loyalty_points_per_sar) || 1;
        const loyaltyEarned = Math.floor(Number(ord.total_amount) * pps);
        if (loyaltyEarned > 0) {
          const [[custRow]] = await pool.query('SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE', [customerId]);
          const currentBal = custRow ? Number(custRow.loyalty_points) : 0;
          const newBal = currentBal + loyaltyEarned;
          await pool.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newBal, customerId]);
          await pool.query('UPDATE orders SET loyalty_points_earned = ? WHERE id = ?', [loyaltyEarned, id]);
          await pool.query(
            `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, balance_after, note, created_by)
             VALUES (?, ?, 'earn', ?, ?, ?, NULL)`,
            [customerId, id, loyaltyEarned, newBal,
              `كسب ${loyaltyEarned} نقطة عند سداد فاتورة رقم ${ord.invoice_seq || id}`]
          );
        }
      }
    } catch (loyErr) {
      console.error('loyalty points error in payDeferredOrder:', loyErr);
    }
  }
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

async function markReceiptCleaned({ receiptId }) {
  const id = Number(receiptId);
  if (!id) throw new Error('معرّف الإيصال غير صالح');
  await pool.query(`UPDATE consumption_receipts SET cleaning_date = NOW() WHERE id = ?`, [id]);
}

async function markReceiptDelivered({ receiptId }) {
  const id = Number(receiptId);
  if (!id) throw new Error('معرّف الإيصال غير صالح');
  await pool.query(`UPDATE consumption_receipts SET delivery_date = NOW() WHERE id = ?`, [id]);
}

async function markWorkOrderCleaned({ workOrderId }) {
  const id = Number(workOrderId);
  if (!id) throw new Error('معرّف أمر التشغيل غير صالح');
  await pool.query(`UPDATE work_orders SET cleaning_date = NOW() WHERE id = ?`, [id]);
}

async function markWorkOrderDelivered({ workOrderId }) {
  const id = Number(workOrderId);
  if (!id) throw new Error('معرّف أمر التشغيل غير صالح');
  await pool.query(`UPDATE work_orders SET delivery_date = NOW() WHERE id = ?`, [id]);
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
      // تحديث paid_cash و paid_card من مجموع كل invoice_payments للدفع الجزئي
      const [[agg2]] = await conn.query(`
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
      const partialCash = Math.round(Number(agg2.tot_cash) * 100) / 100;
      const partialCard = Math.round(Number(agg2.tot_card) * 100) / 100;
      await conn.query(`
        UPDATE orders
        SET paid_amount = ?,
            remaining_amount = ?,
            payment_status = ?,
            paid_cash = ?,
            paid_card = ?,
            paid_at = CASE WHEN ? = 'paid' AND paid_at IS NULL THEN NOW() ELSE paid_at END
        WHERE id = ?
      `, [newPaidAmount, newRemainingAmount, newPaymentStatus, partialCash, partialCard, newPaymentStatus, id]);
    }

    await conn.commit();

    // ── إضافة نقاط الولاء عند اكتمال سداد الفاتورة الآجلة ──
    let loyaltyEarned = 0;
    let newLoyaltyBalance = 0;
    if (newPaymentStatus === 'paid') {
      try {
        const [[fullOrder]] = await pool.query(
          `SELECT customer_id, total_amount, invoice_seq, loyalty_points_earned
           FROM orders WHERE id = ?`, [id]
        );
        const customerId = Number(fullOrder && fullOrder.customer_id);
        const alreadyEarned = Number(fullOrder && fullOrder.loyalty_points_earned || 0);
        if (customerId && alreadyEarned === 0) {
          const [[loySettings]] = await pool.query(
            'SELECT loyalty_enabled, loyalty_points_per_sar FROM app_settings WHERE id = 1'
          );
          if (loySettings && loySettings.loyalty_enabled) {
            const pps = Number(loySettings.loyalty_points_per_sar) || 1;
            loyaltyEarned = Math.floor(Number(fullOrder.total_amount) * pps);
            if (loyaltyEarned > 0) {
              const [[custRow]] = await pool.query(
                'SELECT loyalty_points FROM customers WHERE id = ?', [customerId]
              );
              const currentBal = custRow ? Number(custRow.loyalty_points) : 0;
              newLoyaltyBalance = currentBal + loyaltyEarned;
              await pool.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newLoyaltyBalance, customerId]);
              await pool.query('UPDATE orders SET loyalty_points_earned = ? WHERE id = ?', [loyaltyEarned, id]);
              await pool.query(
                `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, balance_after, note, created_by)
                 VALUES (?, ?, 'earn', ?, ?, ?, NULL)`,
                [customerId, id, loyaltyEarned, newLoyaltyBalance,
                  `كسب ${loyaltyEarned} نقطة عند سداد فاتورة رقم ${fullOrder.invoice_seq || id}`]
              );
            }
          }
        }
      } catch (loyErr) {
        console.error('loyalty points error in recordInvoicePayment:', loyErr);
      }
    }

    // Get the inserted payment
    const [[payment]] = await pool.query(`
      SELECT id, payment_amount, payment_method, cash_amount, card_amount, payment_date, created_by, notes
      FROM invoice_payments
      WHERE id = ?
    `, [paymentResult.insertId]);

    return {
      success: true,
      payment,
      loyaltyEarned,
      newLoyaltyBalance,
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

async function createRefundsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS refunds (
      id                     INT AUTO_INCREMENT PRIMARY KEY,
      original_order_id     INT NOT NULL UNIQUE COMMENT 'الطلب الأصلي الذي تم إرجاعه',
      consumption_receipt_id INT NOT NULL COMMENT 'إيصال الاستهلاك الأصلي (C-#)',
      subscription_id       INT NOT NULL COMMENT 'اشتراك العميل المرتبط بالإيصال',
      refund_amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
      refund_reason         TEXT DEFAULT NULL,
      refunded_by           VARCHAR(100) DEFAULT NULL,
      refunded_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      old_balance           DECIMAL(10,2) DEFAULT NULL,
      new_balance           DECIMAL(10,2) DEFAULT NULL,
      credit_note_id        INT DEFAULT NULL,
      FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE RESTRICT,
      FOREIGN KEY (consumption_receipt_id) REFERENCES consumption_receipts(id) ON DELETE RESTRICT,
      FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE RESTRICT,
      CONSTRAINT fk_refunds_credit_notes FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_refunds_refunded_at ON refunds(refunded_at DESC)`).catch(() => {});
}

async function migrateRefundsColumns() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'refunds'`
    );
    const set = new Set(cols.map(r => r.COLUMN_NAME));
    if (!set.has('old_balance')) {
      await pool.query(`ALTER TABLE refunds ADD COLUMN old_balance DECIMAL(10,2) NULL`);
    }
    if (!set.has('new_balance')) {
      await pool.query(`ALTER TABLE refunds ADD COLUMN new_balance DECIMAL(10,2) NULL`);
    }
    if (!set.has('credit_note_id')) {
      await pool.query(`ALTER TABLE refunds ADD COLUMN credit_note_id INT NULL`);
      await pool.query(`ALTER TABLE refunds ADD CONSTRAINT fk_refunds_credit_notes FOREIGN KEY (credit_note_id) REFERENCES credit_notes(id) ON DELETE SET NULL`).catch(() => {});
    }
  } catch (e) {
    console.error('migrateRefundsColumns error:', e);
  }
}

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
      product_id        INT NULL,
      laundry_service_id INT NULL,
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

  // migrate: allow NULL for product_id and laundry_service_id in credit_note_items (subscription invoices have no product/service)
  try {
    await pool.query(`ALTER TABLE credit_note_items MODIFY COLUMN product_id INT NULL`);
    await pool.query(`ALTER TABLE credit_note_items MODIFY COLUMN laundry_service_id INT NULL`);
  } catch (_) {}

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

  // support "c1", "C2" etc. as receipt seq search
  const seqMatch = search.match(/^[cC](\d+)$/);
  const seqNum = seqMatch ? parseInt(seqMatch[1], 10) : null;

  // استبعاد الفواتير الدائنة الناتجة عن مرتجع إيصال استهلاك (ليست فواتير ضريبية)
  const excludeConsumptionRefunds = `cn.original_order_id NOT IN (SELECT order_id FROM consumption_receipts WHERE order_id IS NOT NULL)`;

  let whereClauses;
  let params;
  if (seqNum !== null) {
    whereClauses = `WHERE cn.credit_note_seq = ? AND ${excludeConsumptionRefunds}`;
    params = [seqNum];
  } else {
    whereClauses = `WHERE (
      cn.credit_note_number LIKE ? OR
      COALESCE(cn.original_order_number,'') LIKE ? OR
      CAST(cn.credit_note_seq AS CHAR) LIKE ? OR
      CAST(cn.original_invoice_seq AS CHAR) LIKE ? OR
      COALESCE(c.customer_name,'') LIKE ? OR
      COALESCE(c.phone,'') LIKE ?
    ) AND ${excludeConsumptionRefunds}`;
    params = [like, like, like, like, like, like];
  }

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
           c.customer_name, c.phone,
           COALESCE((SELECT usr.full_name FROM users usr WHERE usr.username = CONVERT(cn.created_by USING utf8mb4) COLLATE utf8mb4_unicode_ci LIMIT 1), cn.created_by) AS cashier_name
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
           c.customer_name, c.phone, c.tax_number AS customer_vat, c.address AS customer_address, c.city AS customer_city,
           COALESCE((SELECT usr.full_name FROM users usr WHERE usr.username = CONVERT(cn.created_by USING utf8mb4) COLLATE utf8mb4_unicode_ci LIMIT 1), cn.created_by) AS cashier_name
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

  // جلب قيد استرجاع الاشتراك المرتبط بإشعار الدائن إن وُجد
  let subscriptionRefund = null;
  try {
    const [[refRow]] = await pool.query(`
      SELECT sl.amount, sl.balance_after, sl.notes, sl.subscription_period_id,
             c.subscription_number, pp.name_ar AS package_name
        FROM subscription_ledger sl
        INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
        INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
        INNER JOIN customers c ON c.id = cs.customer_id
        INNER JOIN prepaid_packages pp ON pp.id = sp.package_id
       WHERE sl.ref_type = 'credit_note' AND sl.ref_id = ? AND sl.entry_type = 'refund'
       ORDER BY sl.id DESC
       LIMIT 1
    `, [id]);
    if (refRow) {
      subscriptionRefund = {
        amount: Number(refRow.amount) || 0,
        newBalance: Number(refRow.balance_after) || 0,
        note: refRow.notes || '',
        subscriptionNumber: refRow.subscription_number || '',
        packageName: refRow.package_name || '',
        originalInvoiceSeq: cn.original_invoice_seq || null
      };
    }
  } catch (_) {}

  return { creditNote: cn, items, subscriptionRefund };
}

async function getInvoiceBySeq(invoiceSeq) {
  const seq = Number(invoiceSeq);
  if (!seq) {
    const e = new Error('رقم الفاتورة غير صالح');
    e.appCode = 'INVALID_SEQ';
    throw e;
  }
  const [[order]] = await pool.query(`
    SELECT o.id, o.order_number, o.invoice_seq, o.order_type, o.subscription_period_id, o.subtotal, o.discount_amount, o.discount_label, o.extra_amount,
           o.vat_rate, o.vat_amount, o.total_amount, o.payment_method, o.payment_status,
           o.paid_amount, o.remaining_amount, o.price_display_mode,
           o.created_at, o.created_by, o.starch, o.bluing, o.notes,
           c.id AS customer_id, c.customer_name, c.phone, c.subscription_number
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

  // فاتورة اشتراك: تحقق من عدم وجود ايصالات استهلاك نشطة للفترة
  const isSubInvoice = order.order_type === 'subscription_new' || order.order_type === 'subscription_renewal';
  if (isSubInvoice && order.subscription_period_id) {
    const [[activeReceipts]] = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM consumption_receipts cr
      WHERE cr.period_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM credit_notes cn WHERE cn.original_order_id = cr.order_id
        )
    `, [order.subscription_period_id]);
    if (activeReceipts && Number(activeReceipts.cnt) > 0) {
      const e = new Error(`لا يمكن معالجة فاتورة الاشتراك — يوجد ${activeReceipts.cnt} ايصال استهلاك لم يُرجع بعد. يجب إرجاع جميع الايصالات المرتبطة بهذا الاشتراك أولاً`);
      e.appCode = 'SUBSCRIPTION_HAS_ACTIVE_RECEIPTS';
      throw e;
    }
  }

  const [items] = await pool.query(`
    SELECT oi.id, oi.quantity, oi.unit_price, oi.line_total,
           oi.product_id, oi.laundry_service_id,
           p.name_ar AS product_name_ar, p.name_en AS product_name_en,
           ls.name_ar AS service_name_ar, ls.name_en AS service_name_en
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN laundry_services ls ON ls.id = oi.laundry_service_id
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
      `SELECT id, invoice_seq, order_number, payment_status, payment_method, order_type, subscription_period_id, notes FROM orders WHERE id = ? FOR UPDATE`,
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

    // فاتورة اشتراك: تحقق من عدم وجود ايصالات استهلاك نشطة للفترة
    const isSubInvoice = orderRow.order_type === 'subscription_new' || orderRow.order_type === 'subscription_renewal';
    if (isSubInvoice && orderRow.subscription_period_id) {
      const [[activeReceipts]] = await conn.query(`
        SELECT COUNT(*) AS cnt
        FROM consumption_receipts cr
        WHERE cr.period_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM credit_notes cn WHERE cn.original_order_id = cr.order_id
          )
      `, [orderRow.subscription_period_id]);
      if (activeReceipts && Number(activeReceipts.cnt) > 0) {
        const e = new Error(`لا يمكن معالجة فاتورة الاشتراك — يوجد ${activeReceipts.cnt} ايصال استهلاك لم يُرجع بعد. يجب إرجاع جميع الايصالات المرتبطة بهذا الاشتراك أولاً`);
        e.appCode = 'SUBSCRIPTION_HAS_ACTIVE_RECEIPTS';
        throw e;
      }
    }

    const [[seqRow]] = await conn.query(
      `SELECT COALESCE(MAX(credit_note_seq), 0) + 1 AS next_seq FROM credit_notes`
    );
    const cnSeq = seqRow.next_seq;
    const cnNumber = `CN-${cnSeq}`;

    // فواتير الاشتراك دائماً بدون ضريبة منفصلة — السعر شامل الضريبة
    const finalVatRate   = isSubInvoice ? 0 : (Number(vatRate) || 0);
    const finalVatAmount = isSubInvoice ? 0 : (vatAmount || 0);
    const finalSubtotal  = isSubInvoice ? (totalAmount || 0) : (subtotal || 0);

    const [result] = await conn.query(`
      INSERT INTO credit_notes
        (credit_note_number, credit_note_seq, original_order_id, original_invoice_seq,
         original_order_number, customer_id, subtotal, discount_amount, extra_amount,
         vat_rate, vat_amount, total_amount, notes, created_by, price_display_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cnNumber, cnSeq, originalOrderId, orderRow.invoice_seq,
      orderRow.order_number, customerId || null,
      finalSubtotal, discountAmount || 0, extraAmount || 0,
      finalVatRate, finalVatAmount, totalAmount || 0,
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

    // ── استرجاع رصيد الاشتراك إذا كانت الفاتورة الأصلية مدفوعة بالاشتراك ──
    let subscriptionRefund = null;
    if (orderRow.payment_method === 'subscription') {
      try {
        const [[ledgerRow]] = await conn.query(
          `SELECT sl.subscription_period_id, sl.amount
             FROM subscription_ledger sl
            WHERE sl.ref_type = 'order' AND sl.ref_id = ? AND sl.entry_type = 'consumption'
            ORDER BY sl.id DESC
            LIMIT 1`,
          [originalOrderId]
        );
        if (ledgerRow) {
          const periodId = Number(ledgerRow.subscription_period_id);
          const refundAmount = Number(ledgerRow.amount) || 0;

          const [[periodRow]] = await conn.query(
            `SELECT credit_remaining FROM subscription_periods WHERE id = ? FOR UPDATE`,
            [periodId]
          );
          if (periodRow && refundAmount > 0) {
            const newBalance = Number(periodRow.credit_remaining) + refundAmount;
            await conn.query(
              `UPDATE subscription_periods SET credit_remaining = ? WHERE id = ?`,
              [newBalance, periodId]
            );
            const reasonTxt = notes && String(notes).trim() ? ` — سبب: ${String(notes).trim()}` : '';
            const refundNote = `إرجاع المبلغ المرتبط بالفاتورة رقم ${orderRow.invoice_seq} (إشعار دائن ${cnNumber})${reasonTxt}`;
            await conn.query(
              `INSERT INTO subscription_ledger
                 (subscription_period_id, entry_type, amount, balance_after, ref_type, ref_id, notes, created_by)
               VALUES (?, 'refund', ?, ?, 'credit_note', ?, ?, ?)`,
              [periodId, refundAmount, newBalance, cnId, refundNote, createdBy || 'system']
            );
            subscriptionRefund = {
              amount: refundAmount,
              newBalance,
              periodId,
              originalInvoiceSeq: orderRow.invoice_seq,
              note: refundNote
            };
          }
        }
      } catch (refErr) {
        console.error('subscription refund on credit note error:', refErr);
      }
    }

    // فاتورة اشتراك جديد أو تجديد: خصم رصيد الباقة الممنوح من رصيد الاشتراك
    // (نخصم credit_value_granted — قيمة الباقة المضافة عند الشراء — وليس مبلغ الفاتورة)
    let subscriptionPeriodCancelled = false;
    if (isSubInvoice && orderRow.subscription_period_id) {
      try {
        const [[periodRow]] = await conn.query(
          `SELECT sp.id, sp.credit_remaining, sp.credit_value_granted, sp.customer_subscription_id FROM subscription_periods sp WHERE sp.id = ? FOR UPDATE`,
          [orderRow.subscription_period_id]
        );
        if (periodRow) {
          const currentBalance = Number(periodRow.credit_remaining) || 0;
          const packageCredit = Number(periodRow.credit_value_granted) || 0;
          const refundAmt = Math.min(packageCredit, currentBalance);
          const newBalance = Math.round((currentBalance - refundAmt) * 100) / 100;
          const willClose = newBalance <= 0;

          await conn.query(
            `UPDATE subscription_periods SET ${willClose ? "status = 'closed', " : ''}credit_remaining = ? WHERE id = ?`,
            [newBalance, orderRow.subscription_period_id]
          );

          const pkgName = orderRow.notes || '';
          const refundNote = willClose
            ? `إلغاء اشتراك${pkgName ? ' (' + pkgName + ')' : ''} بموجب إشعار دائن ${cnNumber}`
            : `استرجاع باقة${pkgName ? ' (' + pkgName + ')' : ''} بموجب إشعار دائن ${cnNumber}`;

          await conn.query(
            `INSERT INTO subscription_ledger
               (subscription_period_id, entry_type, amount, balance_after, ref_type, ref_id, notes, created_by)
             VALUES (?, 'refund', ?, ?, 'credit_note', ?, ?, ?)`,
            [orderRow.subscription_period_id,
             refundAmt, newBalance, cnId, refundNote, createdBy || 'system']
          );

          subscriptionPeriodCancelled = willClose;
          subscriptionRefund = subscriptionRefund || {
            amount: refundAmt,
            newBalance,
            periodId: orderRow.subscription_period_id,
            originalInvoiceSeq: orderRow.invoice_seq,
            note: refundNote
          };
        }
      } catch (cancelErr) {
        console.error('subscription period refund on credit note error:', cancelErr);
      }
    }

    // ── عكس نقاط الولاء عند إنشاء إشعار دائن ──────────────────────────────
    let loyaltyReversal = null;
    try {
      const [[origOrder]] = await conn.query(
        'SELECT customer_id, loyalty_points_earned, loyalty_points_redeemed, invoice_seq FROM orders WHERE id = ?',
        [originalOrderId]
      );
      if (origOrder && origOrder.customer_id) {
        const cid = Number(origOrder.customer_id);
        const earned   = Number(origOrder.loyalty_points_earned   || 0);
        const redeemed = Number(origOrder.loyalty_points_redeemed || 0);
        const netReverse = redeemed - earned; // موجب = يرجع نقاط، سالب = يطرح نقاط

        const [[custRow]] = await conn.query('SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE', [cid]);
        if (custRow) {
          const oldBalance = Number(custRow.loyalty_points);
          const newBalance = Math.max(0, oldBalance + netReverse);
          if (netReverse !== 0) {
            await conn.query('UPDATE customers SET loyalty_points = ? WHERE id = ?', [newBalance, cid]);
            const note = `عكس نقاط — إشعار دائن ${cnNumber} (فاتورة رقم ${origOrder.invoice_seq || originalOrderId})`;
            await conn.query(
              `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, balance_after, note, created_by)
               VALUES (?, ?, 'adjust', ?, ?, ?, ?)`,
              [cid, originalOrderId, netReverse, newBalance, note, createdBy || 'system']
            );
          }
          loyaltyReversal = {
            earned,
            redeemed,
            netReverse,
            newBalance: netReverse !== 0 ? newBalance : oldBalance,
          };
        }
      }
    } catch (loyErr) {
      console.error('loyalty reversal error on credit note:', loyErr);
    }
    // ── End Loyalty Reversal ──────────────────────────────────────────────

    await conn.commit();
    return {
      success: true,
      creditNoteId: cnId,
      creditNoteNumber: cnNumber,
      creditNoteSeq: cnSeq,
      originalInvoiceSeq: orderRow.invoice_seq,
      originalOrderNumber: orderRow.order_number,
      subscriptionRefund,
      loyaltyReversal
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

async function migrateSubscriptionInvoicesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_invoices (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      invoice_seq       INT NOT NULL,
      subscription_id   INT NOT NULL,
      period_id         INT DEFAULT NULL,
      customer_id       INT NOT NULL,
      package_id        INT NOT NULL,
      package_name_ar   VARCHAR(255) NOT NULL,
      invoice_type      ENUM('new','renewal') NOT NULL DEFAULT 'new',
      payment_method    VARCHAR(50) NOT NULL DEFAULT 'cash',
      paid_cash         DECIMAL(10,2) NOT NULL DEFAULT 0,
      paid_card         DECIMAL(10,2) NOT NULL DEFAULT 0,
      prepaid_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_rate          DECIMAL(5,2) NOT NULL DEFAULT 15.00,
      net_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
      vat_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
      price_display_mode VARCHAR(20) NOT NULL DEFAULT 'inclusive',
      zatca_uuid        VARCHAR(100) DEFAULT NULL,
      zatca_hash        VARCHAR(255) DEFAULT NULL,
      zatca_qr          TEXT DEFAULT NULL,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subscription_id) REFERENCES customer_subscriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id)     REFERENCES customers(id)              ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function migrateOrderTypeColumn() {
  // إضافة عمود order_type للتمييز بين فاتورة بيع عادية واشتراك
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'order_type'`
    );
    if (cols.length === 0) {
      await pool.query(
        `ALTER TABLE orders ADD COLUMN order_type ENUM('sale','subscription_new','subscription_renewal') NOT NULL DEFAULT 'sale'`
      );
    }
  } catch (e) {
    console.error('migrateOrderTypeColumn:', e);
  }
  // إضافة عمود subscription_period_id لربط الفاتورة بالفترة
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'subscription_period_id'`
    );
    if (cols.length === 0) {
      await pool.query(
        `ALTER TABLE orders ADD COLUMN subscription_period_id INT DEFAULT NULL`
      );
    }
  } catch (e) {
    console.error('migrate subscription_period_id:', e);
  }
}

async function migrateOrderItemsNullable() {
  // السماح بـ NULL في product_id و laundry_service_id لفاتورة الاشتراك
  try {
    await pool.query(`ALTER TABLE order_items MODIFY COLUMN product_id INT NULL`);
  } catch (e) {
    console.error('migrate order_items product_id nullable:', e);
  }
  try {
    await pool.query(`ALTER TABLE order_items MODIFY COLUMN laundry_service_id INT NULL`);
  } catch (e) {
    console.error('migrate order_items laundry_service_id nullable:', e);
  }
  // إضافة أعمدة اسم المنتج والخدمة مباشرة في order_items للاشتراكات
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'product_name_ar'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE order_items
        ADD COLUMN product_name_ar VARCHAR(255) DEFAULT NULL,
        ADD COLUMN product_name_en VARCHAR(255) DEFAULT NULL,
        ADD COLUMN service_name_ar VARCHAR(255) DEFAULT NULL,
        ADD COLUMN service_name_en VARCHAR(255) DEFAULT NULL,
        ADD COLUMN subscription_period_id INT DEFAULT NULL
      `);
    }
  } catch (e) {
    console.error('migrate order_items subscription columns:', e);
  }
}

async function migrateSubscriptionPeriodsOrderId() {
  // إضافة عمود order_id لربط الفترة بفاتورتها
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'subscription_periods' AND column_name = 'order_id'`
    );
    if (cols.length === 0) {
      await pool.query(
        `ALTER TABLE subscription_periods ADD COLUMN order_id INT DEFAULT NULL`
      );
    }
  } catch (e) {
    console.error('migrate subscription_periods order_id:', e);
  }
}

async function createSubscriptionInvoice({
  subscriptionId, periodId, customerId, packageId,
  packageNameAr, invoiceType,
  paymentMethod, paidCash, paidCard,
  prepaidPrice, vatRate,
  netAmount, vatAmount, totalAmount
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[seqRow]] = await conn.query(
      `SELECT COALESCE(
         GREATEST(
           (SELECT COALESCE(MAX(invoice_seq),0) FROM orders),
           (SELECT COALESCE(MAX(invoice_seq),0) FROM subscription_invoices)
         ), 0
       ) + 1 AS next_seq`
    );
    const invoiceSeq = seqRow.next_seq;

    const [ins] = await conn.query(
      `INSERT INTO subscription_invoices
         (invoice_seq, subscription_id, period_id, customer_id, package_id,
          package_name_ar, invoice_type, payment_method,
          paid_cash, paid_card,
          prepaid_price, vat_rate, net_amount, vat_amount, total_amount,
          price_display_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'inclusive')`,
      [
        invoiceSeq, subscriptionId, periodId || null, customerId, packageId,
        packageNameAr, invoiceType, paymentMethod,
        paidCash || 0, paidCard || 0,
        prepaidPrice, vatRate, netAmount, vatAmount, totalAmount
      ]
    );

    await conn.commit();
    return { id: ins.insertId, invoiceSeq };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getSubscriptionInvoice(id) {
  const [[row]] = await pool.query(
    `SELECT si.*,
            c.customer_name, c.phone AS customer_phone,
            c.address AS customer_address, c.city AS customer_city
     FROM subscription_invoices si
     JOIN customers c ON c.id = si.customer_id
     WHERE si.id = ?`,
    [id]
  );
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

// ═══════════════════════════════════════════════════
// ═══ PRODUCT OFFERS ═══
// ═══════════════════════════════════════════════════

async function createProductOffersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_offers (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      name           VARCHAR(200) NOT NULL,
      discount_type  ENUM('percentage','fixed') NOT NULL DEFAULT 'percentage',
      discount_value DECIMAL(10,2) NOT NULL,
      start_date     DATETIME DEFAULT NULL,
      end_date       DATETIME DEFAULT NULL,
      is_active      TINYINT(1) NOT NULL DEFAULT 1,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function createProductOfferLinesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_offer_lines (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      offer_id      INT NOT NULL,
      price_line_id INT NOT NULL,
      UNIQUE KEY uq_offer_priceline (offer_id, price_line_id),
      FOREIGN KEY (offer_id) REFERENCES product_offers(id) ON DELETE CASCADE,
      FOREIGN KEY (price_line_id) REFERENCES product_price_lines(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getProductsForOffers() {
  const [rows] = await pool.query(`
    SELECT
      p.id        AS product_id,
      p.name_ar   AS product_name,
      ppl.id      AS price_line_id,
      ls.name_ar  AS service_name,
      ppl.price
    FROM products p
    INNER JOIN product_price_lines ppl ON ppl.product_id = p.id
    INNER JOIN laundry_services ls     ON ls.id = ppl.laundry_service_id
    ORDER BY p.name_ar, ls.name_ar
  `);
  // Group by product
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.product_id)) {
      map.set(row.product_id, { product_id: row.product_id, product_name: row.product_name, lines: [] });
    }
    map.get(row.product_id).lines.push({
      price_line_id: row.price_line_id,
      service_name: row.service_name,
      price: row.price
    });
  }
  return Array.from(map.values());
}

async function getAllProductOffers() {
  const [rows] = await pool.query(`
    SELECT po.*,
           COUNT(pol.id) AS lines_count
    FROM product_offers po
    LEFT JOIN product_offer_lines pol ON pol.offer_id = po.id
    GROUP BY po.id
    ORDER BY po.created_at DESC
  `);
  return rows;
}

async function getProductOfferById(id) {
  const oid = Number(id);
  if (!oid) throw new Error('معرّف العرض غير صالح');
  const [[offer]] = await pool.query(`SELECT * FROM product_offers WHERE id = ?`, [oid]);
  if (!offer) throw new Error('العرض غير موجود');
  const [lines] = await pool.query(`SELECT price_line_id FROM product_offer_lines WHERE offer_id = ?`, [oid]);
  return { offer, price_line_ids: lines.map(l => l.price_line_id) };
}

function _validateProductOffer(data) {
  const name = String(data.name || '').trim().slice(0, 200);
  if (!name) throw new Error('اسم العرض مطلوب');
  const discountType = data.discountType === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = Number(data.discountValue);
  if (isNaN(discountValue) || discountValue <= 0) throw new Error('قيمة الخصم غير صالحة');
  if (discountType === 'percentage' && discountValue > 100) throw new Error('النسبة لا يمكن أن تتجاوز 100%');
  const priceLineIds = Array.isArray(data.priceLineIds) ? data.priceLineIds.map(Number).filter(n => n > 0) : [];
  if (priceLineIds.length === 0) throw new Error('يجب اختيار صنف وعملية واحدة على الأقل');
  const startDate = data.startDate ? String(data.startDate).replace('T', ' ').slice(0, 19) : null;
  const endDate   = data.endDate   ? String(data.endDate).replace('T', ' ').slice(0, 19)   : null;
  if (startDate && endDate && startDate > endDate) throw new Error('تاريخ البداية يجب أن يكون قبل النهاية');
  return { name, discountType, discountValue, startDate, endDate, priceLineIds };
}

async function createProductOffer(data) {
  const { name, discountType, discountValue, startDate, endDate, priceLineIds } = _validateProductOffer(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO product_offers (name, discount_type, discount_value, start_date, end_date) VALUES (?, ?, ?, ?, ?)`,
      [name, discountType, discountValue, startDate, endDate]
    );
    const offerId = result.insertId;
    const lineValues = priceLineIds.map(pid => [offerId, pid]);
    await conn.query(`INSERT INTO product_offer_lines (offer_id, price_line_id) VALUES ?`, [lineValues]);
    await conn.commit();
    return { id: offerId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateProductOffer(data) {
  const id = Number(data.id);
  if (!id) throw new Error('معرّف العرض غير صالح');
  const { name, discountType, discountValue, startDate, endDate, priceLineIds } = _validateProductOffer(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE product_offers SET name=?, discount_type=?, discount_value=?, start_date=?, end_date=? WHERE id=?`,
      [name, discountType, discountValue, startDate, endDate, id]
    );
    await conn.query(`DELETE FROM product_offer_lines WHERE offer_id = ?`, [id]);
    const lineValues = priceLineIds.map(pid => [id, pid]);
    await conn.query(`INSERT INTO product_offer_lines (offer_id, price_line_id) VALUES ?`, [lineValues]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function toggleProductOfferStatus(id) {
  const oid = Number(id);
  if (!oid) throw new Error('معرّف العرض غير صالح');
  await pool.query(`UPDATE product_offers SET is_active = IF(is_active=1,0,1) WHERE id=?`, [oid]);
}

async function deleteProductOffer(id) {
  const oid = Number(id);
  if (!oid) throw new Error('معرّف العرض غير صالح');
  await pool.query(`DELETE FROM product_offers WHERE id=?`, [oid]);
}

async function getActiveProductOffersForPos() {
  // Returns all currently active product offers with their price_line_ids
  const [offers] = await pool.query(`
    SELECT po.id, po.name, po.discount_type, po.discount_value
    FROM product_offers po
    WHERE po.is_active = 1
      AND (po.start_date IS NULL OR po.start_date <= NOW())
      AND (po.end_date IS NULL OR po.end_date >= NOW())
    ORDER BY po.discount_value DESC
  `);
  if (!offers.length) return {};
  const offerIds = offers.map(o => o.id);
  const placeholders = offerIds.map(() => '?').join(',');
  const [lines] = await pool.query(
    `SELECT offer_id, price_line_id FROM product_offer_lines WHERE offer_id IN (${placeholders})`,
    offerIds
  );
  // Map: price_line_id -> best offer (highest discount_value)
  const priceLineOfferMap = {};
  for (const offer of offers) {
    const offerLines = lines.filter(l => l.offer_id === offer.id);
    for (const line of offerLines) {
      const plid = line.price_line_id;
      if (!priceLineOfferMap[plid]) {
        priceLineOfferMap[plid] = {
          offerId: offer.id,
          offerName: offer.name,
          discountType: offer.discount_type,
          discountValue: parseFloat(offer.discount_value)
        };
      }
    }
  }
  return priceLineOfferMap;
}

/* ========== ZATCA Order Status Functions ========== */

async function getSubscriptionOrderByPeriod(periodId) {
  const [rows] = await pool.query(
    `SELECT o.*, c.customer_name, c.phone
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.subscription_period_id = ?
     LIMIT 1`,
    [periodId]
  );
  return rows[0] || null;
}

async function createSubscriptionOrder({
  customerId, subscriptionPeriodId, packageNameAr, packageNameEn, prepaidPricePaid, paymentMethod = 'cash', createdBy
}) {
  const settings = await getAppSettings();
  const vatRate = parseFloat(settings.vatRate || 15);
  const total = parseFloat(prepaidPricePaid) || 0;
  const subtotal = parseFloat((total / (1 + vatRate / 100)).toFixed(2));
  const vatAmount = parseFloat((total - subtotal).toFixed(2));
  const orderNumber = await generateOrderNumber();

  const [result] = await pool.query(
    `INSERT INTO orders
       (order_number, customer_id, subtotal, discount_amount, vat_rate,
        vat_amount, total_amount, payment_method, notes,
        subscription_period_id, created_by)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNumber,
      customerId || null,
      subtotal,
      vatRate,
      vatAmount,
      total,
      paymentMethod,
      'اشتراك: ' + (packageNameAr || ''),
      subscriptionPeriodId || null,
      createdBy || null
    ]
  );

  return {
    orderId: result.insertId,
    orderNumber,
    subtotal,
    vatRate,
    vatAmount,
    total,
    packageNameAr: packageNameAr || '',
    packageNameEn: packageNameEn || ''
  };
}

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

async function getCreditNoteDate(cnId) {
  const [[row]] = await pool.query('SELECT created_at FROM credit_notes WHERE id = ?', [cnId]);
  return row && row.created_at ? toSqlDate(row.created_at) : null;
}

async function getUnsentZatcaOrders(limit = 500) {
  const [[cfg]] = await pool.query('SELECT send_start_date FROM zatca_settings WHERE id = 1');
  const startDate = cfg && cfg.send_start_date ? toSqlDate(cfg.send_start_date) : null;

  const params = [limit];
  const dateClause = startDate ? `AND DATE(created_at) >= ?` : '';
  if (startDate) params.unshift(startDate);

  const [rows] = await pool.query(
    `SELECT id FROM orders
     WHERE (zatca_status IS NULL OR zatca_status NOT IN ('submitted', 'accepted'))
       AND zatca_submitted IS NULL
       AND (zatca_response IS NULL OR zatca_response NOT LIKE '%NOT_REPORTED%')
       AND COALESCE(is_consumption_only, 0) = 0
       AND invoice_seq IS NOT NULL
       ${dateClause}
     ORDER BY id ASC
     LIMIT ?`,
    params
  );
  return rows.map(r => r.id);
}

async function fixSubscriptionLedgerNotesEncoding() {
  try {
    // Fix notes that were stored with wrong charset (latin1 connection storing UTF-8 bytes)
    // Detectable by presence of Ø (U+00D8) or Ù (U+00D9) which are the first bytes of Arabic UTF-8 sequences when misread as latin1
    await pool.query(`
      UPDATE subscription_ledger
      SET notes = CONVERT(BINARY CONVERT(notes USING latin1) USING utf8mb4)
      WHERE notes IS NOT NULL
        AND (notes LIKE '%Ø%' OR notes LIKE '%Ù%' OR notes LIKE '%â€"%')
    `);
  } catch (_) {}
}

// ── Loyalty Points System ──────────────────────────────────────────────────────

const MAX_LOYALTY_REDEEM_PCT = 90; // الحد الأقصى للخصم بالنقاط: 90% من الإجمالي قبل الضريبة

async function migrateUsersPasswordPlain() {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM users LIKE 'password_plain'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN password_plain VARCHAR(255) DEFAULT NULL AFTER password`);
    }
  } catch (e) {
    console.error('migrateUsersPasswordPlain:', e);
  }
}

async function migrateLoyalty() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      customer_id   INT NOT NULL,
      order_id      INT NULL,
      type          ENUM('earn','redeem','expire','adjust') NOT NULL,
      points        INT NOT NULL,
      balance_after INT NOT NULL,
      note          TEXT NULL,
      created_by    VARCHAR(100) NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});
  await pool.query('ALTER TABLE customers ADD COLUMN loyalty_points INT NOT NULL DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE app_settings ADD COLUMN loyalty_enabled TINYINT(1) NOT NULL DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE app_settings ADD COLUMN loyalty_points_per_sar DECIMAL(10,4) NOT NULL DEFAULT 1.0000').catch(() => {});
  await pool.query('ALTER TABLE app_settings ADD COLUMN loyalty_sar_per_point DECIMAL(10,4) NOT NULL DEFAULT 0.0500').catch(() => {});
  await pool.query('ALTER TABLE app_settings ADD COLUMN loyalty_expiry_months INT NOT NULL DEFAULT 12').catch(() => {});
  await pool.query('ALTER TABLE app_settings ADD COLUMN loyalty_expiry_date VARCHAR(20) DEFAULT NULL').catch(() => {});
  await pool.query('ALTER TABLE orders ADD COLUMN loyalty_points_earned INT NOT NULL DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE orders ADD COLUMN loyalty_points_redeemed INT NOT NULL DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE orders ADD COLUMN loyalty_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0').catch(() => {});
  await pool.query('ALTER TABLE orders ADD COLUMN settled_by_subscription_period_id INT DEFAULT NULL').catch(() => {});
  await pool.query('CREATE INDEX idx_orders_settled_by_sub ON orders(settled_by_subscription_period_id)').catch(() => {});
}

async function getLoyaltySettings() {
  const [[row]] = await pool.query(
    'SELECT loyalty_enabled, loyalty_points_per_sar, loyalty_sar_per_point, loyalty_expiry_date FROM app_settings WHERE id = 1'
  );
  if (!row) return { loyaltyEnabled: false, loyaltyPointsPerSar: 1, loyaltySarPerPoint: 0.05, loyaltyExpiryDate: null };
  return {
    loyaltyEnabled: row.loyalty_enabled === 1,
    loyaltyPointsPerSar: Number(row.loyalty_points_per_sar) || 1,
    loyaltySarPerPoint: Number(row.loyalty_sar_per_point) || 0.05,
    loyaltyExpiryDate: row.loyalty_expiry_date || null
  };
}

async function saveLoyaltySettings({ loyaltyEnabled, loyaltyPointsPerSar, loyaltySarPerPoint, loyaltyExpiryDate }) {
  const enabled = loyaltyEnabled ? 1 : 0;
  let pps = Number(loyaltyPointsPerSar);
  if (!Number.isFinite(pps) || pps <= 0) pps = 1;
  let spp = Number(loyaltySarPerPoint);
  if (!Number.isFinite(spp) || spp <= 0) spp = 0.05;
  // التحقق من صحة التاريخ (YYYY-MM-DD)
  const expDate = (loyaltyExpiryDate && /^\d{4}-\d{2}-\d{2}$/.test(loyaltyExpiryDate))
    ? loyaltyExpiryDate : null;
  await pool.query(
    'UPDATE app_settings SET loyalty_enabled=?, loyalty_points_per_sar=?, loyalty_sar_per_point=?, loyalty_expiry_date=? WHERE id=1',
    [enabled, pps, spp, expDate]
  );
}

async function getCustomerLoyaltyBalance(customerId) {
  const [[row]] = await pool.query('SELECT loyalty_points FROM customers WHERE id = ?', [customerId]);
  return row ? Number(row.loyalty_points) : 0;
}

async function getLoyaltyTransactions({ customerId, page = 1, pageSize = 50 }) {
  const offset = (page - 1) * pageSize;
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM loyalty_transactions WHERE customer_id = ?', [customerId]);
  const [rows] = await pool.query(
    'SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [customerId, pageSize, offset]
  );
  return { transactions: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

async function expireLoyaltyPoints() {
  try {
    const [[settings]] = await pool.query(
      'SELECT loyalty_enabled, loyalty_expiry_date FROM app_settings WHERE id = 1'
    );
    if (!settings || !settings.loyalty_enabled) return;
    const expiryDate = settings.loyalty_expiry_date;
    if (!expiryDate) return; // فارغ = لا تنتهي صلاحية النقاط

    // التحقق: هل وصلنا أو تجاوزنا تاريخ الانتهاء؟
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (today < expiryDate) return; // لم يحن موعد الانتهاء بعد

    // جلب جميع العملاء الذين لديهم نقاط > 0 ولم تُنتهَ نقاطهم بسبب هذا التاريخ بعد
    const [customers] = await pool.query(`
      SELECT c.id AS customer_id, c.loyalty_points
      FROM customers c
      WHERE c.loyalty_points > 0
        AND NOT EXISTS (
          SELECT 1 FROM loyalty_transactions lt
          WHERE lt.customer_id = c.id
            AND lt.type = 'expire'
            AND lt.note LIKE ?
        )
    `, [`%انتهاء صلاحية بتاريخ ${expiryDate}%`]);

    for (const row of customers) {
      const cid = row.customer_id;
      const toExpire = Number(row.loyalty_points);
      if (toExpire <= 0) continue;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [[custRow]] = await conn.query('SELECT loyalty_points FROM customers WHERE id = ? FOR UPDATE', [cid]);
        if (!custRow) { await conn.rollback(); continue; }
        await conn.query('UPDATE customers SET loyalty_points = 0 WHERE id = ?', [cid]);
        await conn.query(
          `INSERT INTO loyalty_transactions (customer_id, order_id, type, points, balance_after, note)
           VALUES (?, NULL, 'expire', ?, 0, ?)`,
          [cid, -toExpire, `انتهاء صلاحية بتاريخ ${expiryDate}`]
        );
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        console.error('expireLoyaltyPoints error for customer', cid, e);
      } finally {
        conn.release();
      }
    }
  } catch (e) {
    console.error('expireLoyaltyPoints top-level error:', e);
  }
}

// ── Zakat Report ─────────────────────────────────────────────────────────────
async function getZakatReport({ dateFrom, dateTo }) {
  const fromTs = dateFrom.includes('T') ? dateFrom.replace('T', ' ') + ':00' : `${dateFrom} 00:00:00`;
  const toTs   = dateTo.includes('T')   ? dateTo.replace('T', ' ')   + ':00' : `${dateTo} 23:59:59`;

  const [ordersRows] = await pool.query(
    `SELECT o.id, o.invoice_seq, o.order_number,
            COALESCE(c.customer_name,'') AS customer_name,
            COALESCE(c.phone,'') AS customer_phone,
            o.subtotal, o.vat_amount, o.total_amount,
            o.payment_status, o.created_at
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.created_at BETWEEN ? AND ?
       AND o.is_refund = 0
     ORDER BY o.created_at ASC`,
    [fromTs, toTs]
  );

  const [cnRows] = await pool.query(
    `SELECT cn.id, cn.credit_note_number, cn.credit_note_seq,
            COALESCE(c.customer_name,'') AS customer_name,
            COALESCE(c.phone,'') AS customer_phone,
            cn.subtotal, cn.vat_amount, cn.total_amount,
            cn.created_at
     FROM credit_notes cn
     LEFT JOIN customers c ON c.id = cn.customer_id
     WHERE cn.created_at BETWEEN ? AND ?
     ORDER BY cn.created_at ASC`,
    [fromTs, toTs]
  );

  const [expRows] = await pool.query(
    `SELECT id, title, category, amount, tax_amount, total_amount, expense_date
     FROM expenses
     WHERE expense_date BETWEEN ? AND ?
     ORDER BY expense_date ASC`,
    [fromTs, toTs]
  );

  const orders      = ordersRows.map(r => ({
    ...r,
    subtotal:     Math.round((Number(r.total_amount) - Number(r.vat_amount)) * 100) / 100,
    vat_amount:   Number(r.vat_amount),
    total_amount: Number(r.total_amount),
  }));
  const creditNotes = cnRows.map(r => ({
    ...r,
    subtotal:     Math.round((Number(r.total_amount) - Number(r.vat_amount)) * 100) / 100,
    vat_amount:   Number(r.vat_amount),
    total_amount: Number(r.total_amount),
  }));
  const expenses    = expRows.map(r => ({ ...r, amount: Number(r.amount), tax_amount: Number(r.tax_amount), total_amount: Number(r.total_amount) }));

  const ordersSubtotal      = Math.round(orders.reduce((s, r) => s + r.subtotal,      0) * 100) / 100;
  const ordersVat           = Math.round(orders.reduce((s, r) => s + r.vat_amount,    0) * 100) / 100;
  const ordersTotal         = Math.round(orders.reduce((s, r) => s + r.total_amount,  0) * 100) / 100;
  const creditNotesSubtotal = Math.round(creditNotes.reduce((s, r) => s + r.subtotal,     0) * 100) / 100;
  const creditNotesVat      = Math.round(creditNotes.reduce((s, r) => s + r.vat_amount,   0) * 100) / 100;
  const creditNotesTotal    = Math.round(creditNotes.reduce((s, r) => s + r.total_amount, 0) * 100) / 100;
  const expensesSubtotal    = Math.round(expenses.reduce((s, r) => s + r.amount,        0) * 100) / 100;
  const expensesVat         = Math.round(expenses.reduce((s, r) => s + r.tax_amount,    0) * 100) / 100;
  const expensesTotal       = Math.round(expenses.reduce((s, r) => s + r.total_amount,  0) * 100) / 100;
  const netSubtotal         = Math.round((ordersSubtotal - creditNotesSubtotal - expensesSubtotal) * 100) / 100;
  const netVat              = Math.round((ordersVat      - creditNotesVat      - expensesVat)      * 100) / 100;
  const netTotal            = Math.round((ordersTotal    - creditNotesTotal    - expensesTotal)    * 100) / 100;

  return {
    orders,
    creditNotes,
    expenses,
    summary: { ordersSubtotal, ordersVat, ordersTotal, creditNotesSubtotal, creditNotesVat, creditNotesTotal, expensesSubtotal, expensesVat, expensesTotal, netSubtotal, netVat, netTotal },
  };
}

// ── كشف حساب العميل ──────────────────────────────────────────────────────────
async function getCustomerAccountStatement({ customerId, dateFrom, dateTo }) {
  const cid = Number(customerId);
  if (!cid) throw new Error('معرّف العميل مطلوب');

  // ── 1. الرصيد السابق: مجموع كل الحركات قبل dateFrom ──────────────────────
  const priorDateOrder  = dateFrom ? 'AND o.created_at < ?'      : '';
  const priorDateIp     = dateFrom ? 'AND ip.payment_date < ?'   : '';
  const priorDateCn     = dateFrom ? 'AND cn.created_at < ?'     : '';
  const priorDateCr     = dateFrom ? 'AND cr.created_at < ?'     : '';
  const pd = dateFrom ? [dateFrom] : [];

  const [[priorRow]] = await pool.query(`
    SELECT COALESCE(SUM(debit) - SUM(credit), 0) AS prior_balance
    FROM (
      -- فواتير مدفوعة (نقد/بطاقة)
      SELECT o.total_amount AS debit, 0 AS credit
      FROM orders o
      WHERE o.customer_id = ? ${priorDateOrder}
        AND o.payment_status = 'paid'
        AND COALESCE(o.payment_method,'cash') NOT IN ('credit','subscription')
        AND o.order_type NOT IN ('subscription_new','subscription_renewal')

      UNION ALL
      -- فواتير آجلة (إنشاء الدين)
      SELECT o.total_amount, 0
      FROM orders o
      WHERE o.customer_id = ? ${priorDateOrder}
        AND o.payment_method = 'credit'
        AND o.order_type NOT IN ('subscription_new','subscription_renewal')

      UNION ALL
      -- سداد آجل
      SELECT 0, ip.payment_amount
      FROM invoice_payments ip
      INNER JOIN orders o ON o.id = ip.order_id
      WHERE o.customer_id = ? ${priorDateIp}

      UNION ALL
      -- اشتراكات إنشاء/تجديد
      SELECT o.total_amount, 0
      FROM orders o
      WHERE o.customer_id = ? ${priorDateOrder}
        AND o.order_type IN ('subscription_new','subscription_renewal')

      UNION ALL
      -- فواتير دائنة (مرتجع)
      SELECT 0, cn.total_amount
      FROM credit_notes cn
      WHERE cn.customer_id = ? ${priorDateCn}
    ) AS all_prior
  `, [cid, ...pd, cid, ...pd, cid, ...pd, cid, ...pd, cid, ...pd]);

  const priorBalance = Number(priorRow.prior_balance || 0);

  // ── 2. حركات الفترة (UNION ALL) ──────────────────────────────────────────
  const p = [cid];
  let dc = '';
  if (dateFrom && dateTo) { dc = 'AND mv_date BETWEEN ? AND ?'; p.push(dateFrom, dateTo); }
  else if (dateFrom)      { dc = 'AND mv_date >= ?';            p.push(dateFrom); }
  else if (dateTo)        { dc = 'AND mv_date <= ?';            p.push(dateTo); }

  const [movements] = await pool.query(`
    SELECT * FROM (

      -- 1. فاتورة مدفوعة نقد/بطاقة
      SELECT
        o.created_at                                                                    AS mv_date,
        CONVERT(CAST(o.invoice_seq AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci  AS doc_number,
        CONVERT(NULL USING utf8mb4)          COLLATE utf8mb4_unicode_ci                AS pay_ref,
        'paid_invoice'                       COLLATE utf8mb4_unicode_ci                AS mv_type,
        CONVERT(CONCAT('فاتورة #', o.invoice_seq) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS description,
        o.total_amount                                                                  AS debit,
        0                                                                               AS credit,
        CONVERT(o.order_number USING utf8mb4) COLLATE utf8mb4_unicode_ci               AS ref_number,
        o.id                                                                            AS source_id,
        'order'                              COLLATE utf8mb4_unicode_ci                AS source_type,
        o.paid_at                                                                       AS paid_at,
        o.cleaning_date                                                                 AS cleaning_date,
        o.delivery_date                                                                 AS delivery_date
      FROM orders o
      WHERE o.customer_id = ? ${dc.replace(/mv_date/g,'o.created_at')}
        AND o.payment_status = 'paid'
        AND COALESCE(o.payment_method,'cash') NOT IN ('credit','subscription')
        AND o.order_type NOT IN ('subscription_new','subscription_renewal')

      UNION ALL

      -- 2. فاتورة آجلة
      SELECT
        o.created_at,
        CONVERT(CAST(o.invoice_seq AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        'deferred_invoice' COLLATE utf8mb4_unicode_ci,
        CONVERT(CONCAT('فاتورة آجلة #', o.invoice_seq) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        o.total_amount,
        0,
        CONVERT(o.order_number USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        o.id,
        'order' COLLATE utf8mb4_unicode_ci,
        o.paid_at,
        o.cleaning_date,
        o.delivery_date
      FROM orders o
      WHERE o.customer_id = ? ${dc.replace(/mv_date/g,'o.created_at')}
        AND o.payment_method = 'credit'
        AND o.order_type NOT IN ('subscription_new','subscription_renewal')

      UNION ALL

      -- 3. سداد آجل
      SELECT
        ip.payment_date,
        CONVERT(CAST(o.invoice_seq AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        CONVERT(ip.notes USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        'deferred_payment' COLLATE utf8mb4_unicode_ci,
        CONVERT(CONCAT('سداد آجل - فاتورة #', o.invoice_seq) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        0,
        ip.payment_amount,
        CONVERT(o.order_number USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        o.id,
        'order' COLLATE utf8mb4_unicode_ci,
        o.paid_at,
        o.cleaning_date,
        o.delivery_date
      FROM invoice_payments ip
      INNER JOIN orders o ON o.id = ip.order_id
      WHERE o.customer_id = ? ${dc.replace(/mv_date/g,'ip.payment_date')}

      UNION ALL

      -- 4. اشتراك إنشاء/تجديد
      SELECT
        o.created_at,
        CONVERT(COALESCE(CAST(o.invoice_seq AS CHAR), o.order_number) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        'subscription' COLLATE utf8mb4_unicode_ci,
        CONVERT(CASE o.order_type WHEN 'subscription_new' THEN 'اشتراك جديد' ELSE 'تجديد اشتراك' END USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        o.total_amount,
        0,
        CONVERT(o.order_number USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        o.id,
        'order' COLLATE utf8mb4_unicode_ci,
        o.paid_at,
        o.cleaning_date,
        o.delivery_date
      FROM orders o
      WHERE o.customer_id = ? ${dc.replace(/mv_date/g,'o.created_at')}
        AND o.order_type IN ('subscription_new','subscription_renewal')

      UNION ALL

      -- 5. إيصال استهلاك (غير مرتجع)
      SELECT
        cr.created_at,
        CONVERT(CAST(cr.receipt_seq AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        'consumption' COLLATE utf8mb4_unicode_ci,
        CONVERT(CONCAT('استهلاك اشتراك #', cr.receipt_seq) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        0,
        cr.amount_consumed,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        cr.id,
        'consumption' COLLATE utf8mb4_unicode_ci,
        NULL,
        cr.cleaning_date,
        cr.delivery_date
      FROM consumption_receipts cr
      WHERE cr.customer_id = ? ${dc.replace(/mv_date/g,'cr.created_at')}
        AND NOT EXISTS (SELECT 1 FROM refunds rf WHERE rf.consumption_receipt_id = cr.id)

      UNION ALL

      -- 6. مرتجع إيصال استهلاك
      SELECT
        rf.refunded_at,
        CONVERT(CAST(cr.receipt_seq AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        'consumption_refund' COLLATE utf8mb4_unicode_ci,
        CONVERT(CONCAT('مرتجع إيصال #', cr.receipt_seq) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        rf.refund_amount,
        0,
        CONVERT(ro.order_number USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        rf.original_order_id,
        'order' COLLATE utf8mb4_unicode_ci,
        NULL,
        NULL,
        NULL
      FROM refunds rf
      INNER JOIN consumption_receipts cr ON cr.id = rf.consumption_receipt_id
      LEFT JOIN orders ro ON ro.id = rf.original_order_id
      WHERE cr.customer_id = ? ${dc.replace(/mv_date/g,'rf.refunded_at')}

      UNION ALL

      -- 7. فاتورة دائنة
      SELECT
        cn.created_at,
        CONVERT(cn.credit_note_number USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        'credit_note' COLLATE utf8mb4_unicode_ci,
        CONVERT(CONCAT('فاتورة دائنة - ', cn.credit_note_number) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        0,
        cn.total_amount,
        CONVERT(NULL USING utf8mb4) COLLATE utf8mb4_unicode_ci,
        cn.id,
        'credit_note' COLLATE utf8mb4_unicode_ci,
        NULL,
        NULL,
        NULL
      FROM credit_notes cn
      WHERE cn.customer_id = ? ${dc.replace(/mv_date/g,'cn.created_at')}

    ) AS all_mv
    ORDER BY mv_date ASC, doc_number ASC
  `, [...p, ...p, ...p, ...p, ...p, ...p, ...p]);

  // ── 3. ملخص الاشتراك ────────────────────────────────────────────────────
  const [subPeriods] = await pool.query(`
    SELECT
      sp.id,
      sp.period_from,
      sp.period_to,
      sp.status,
      sp.prepaid_price_paid   AS total_value,
      sp.credit_value_granted AS credit_granted,
      sp.credit_remaining,
      (sp.credit_value_granted - sp.credit_remaining) AS total_consumed
    FROM subscription_periods sp
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    WHERE cs.customer_id = ?
    ORDER BY sp.period_from ASC
  `, [cid]);

  // ── 4. الملخص الإجمالي ───────────────────────────────────────────────────
  const totalDebit  = movements.reduce((s, m) => s + Number(m.debit  || 0), 0);
  const totalCredit = movements.reduce((s, m) => s + Number(m.credit || 0), 0);
  const closingBalance = Math.round((priorBalance + totalDebit - totalCredit) * 100) / 100;

  // المديونية الآجلة الحالية (فواتير آجلة لم تُسدَّد بالكامل بعيداً عن الفترة)
  const [[deferredRow]] = await pool.query(`
    SELECT COALESCE(SUM(o.remaining_amount), 0) AS deferred_outstanding
    FROM orders o
    WHERE o.customer_id = ?
      AND o.payment_method = 'credit'
      AND o.payment_status IN ('pending','partial')
      AND o.order_type NOT IN ('subscription_new','subscription_renewal')
  `, [cid]);

  return {
    movements: movements.map(m => ({
      mv_date:      m.mv_date,
      doc_number:   m.doc_number,
      ref_number:   m.ref_number  || null,
      pay_ref:      m.pay_ref     || null,
      mv_type:      m.mv_type,
      description:  m.description,
      debit:        Number(m.debit  || 0),
      credit:       Number(m.credit || 0),
      source_id:    m.source_id   || null,
      source_type:  m.source_type || null,
      paid_at:      m.paid_at      || null,
      cleaning_date: m.cleaning_date || null,
      delivery_date: m.delivery_date || null,
    })),
    priorBalance,
    subscriptionPeriods: subPeriods.map(sp => ({
      id:            sp.id,
      period_from:   sp.period_from,
      period_to:     sp.period_to,
      status:        sp.status,
      total_value:   Number(sp.total_value   || 0),
      credit_granted: Number(sp.credit_granted || 0),
      total_consumed: Number(sp.total_consumed || 0),
      credit_remaining: Number(sp.credit_remaining || 0),
    })),
    summary: {
      priorBalance,
      totalDebit:  Math.round(totalDebit  * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      closingBalance,
      deferredOutstanding: Number(deferredRow.deferred_outstanding || 0),
    },
  };
}

// ── Merzam Types ─────────────────────────────────────────────────────────────

async function createMerzamTypesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merzam_types (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name_ar    VARCHAR(100) NOT NULL,
      name_en    VARCHAR(100) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active  TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // seed defaults if table is empty
  const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM merzam_types');
  if (cnt === 0) {
    const defaults = [
      ['مزرام', 'Merzam', 1],
      ['مربع', 'Moraba3', 2],
      ['بدون مزرام', 'Bdon Merzam', 3],
      ['قطري', 'Qatary', 4],
      ['كويتي', 'Kuwaity', 5],
      ['مزرام مقلوب', 'Merzam Maklob', 6],
      ['مثلث', 'Triangle', 7],
      ['دوبل مزرام', 'Double Merzam', 8],
    ];
    for (const [nameAr, nameEn, sortOrder] of defaults) {
      await pool.query(
        'INSERT IGNORE INTO merzam_types (name_ar, name_en, sort_order) VALUES (?, ?, ?)',
        [nameAr, nameEn, sortOrder]
      );
    }
  }
}

async function migrateMerzamEnabled() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'merzam_enabled'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE products ADD COLUMN merzam_enabled TINYINT(1) NOT NULL DEFAULT 0`);
    }
  } catch (e) {
    console.error('migrateMerzamEnabled:', e);
  }
}

async function migrateMerzamOrderItems() {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'merzam_type_id'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE order_items ADD COLUMN merzam_type_id INT NULL`);
    }
  } catch (e) {
    console.error('migrateMerzamOrderItems merzam_type_id:', e);
  }
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'merzam_type_name'`
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE order_items ADD COLUMN merzam_type_name VARCHAR(100) NULL`);
    }
  } catch (e) {
    console.error('migrateMerzamOrderItems merzam_type_name:', e);
  }
}

async function getMerzamTypes() {
  const [rows] = await pool.query(
    `SELECT id, name_ar, name_en, sort_order FROM merzam_types WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`
  );
  return rows;
}

async function saveMerzamType({ id, nameAr, nameEn, sortOrder, isActive }) {
  const nameEnVal = nameEn && String(nameEn).trim() ? String(nameEn).trim() : null;
  const active = isActive !== undefined ? (isActive ? 1 : 0) : 1;
  const order = Number(sortOrder) || 0;
  if (id) {
    await pool.query(
      'UPDATE merzam_types SET name_ar=?, name_en=?, sort_order=?, is_active=? WHERE id=?',
      [nameAr, nameEnVal, order, active, Number(id)]
    );
    return { id: Number(id) };
  } else {
    const [result] = await pool.query(
      'INSERT INTO merzam_types (name_ar, name_en, sort_order, is_active) VALUES (?, ?, ?, ?)',
      [nameAr, nameEnVal, order, active]
    );
    return { id: result.insertId };
  }
}

async function deleteMerzamType(id) {
  await pool.query('DELETE FROM merzam_types WHERE id = ?', [Number(id)]);
}

// ── Customer Custom Prices ────────────────────────────────────────────────────

async function getCustomPricesScreenData(customerId) {
  const id = Number(customerId);

  // Validate customer exists
  const [custRows] = await pool.query(
    'SELECT id, customer_name AS name, phone FROM customers WHERE id = ? LIMIT 1',
    [id]
  );
  if (!custRows.length) return { success: false, message: 'العميل غير موجود' };
  const customer = custRows[0];

  // JOIN: products × product_price_lines × laundry_services LEFT JOIN customer_custom_prices
  const [rows] = await pool.query(`
    SELECT
      p.id           AS product_id,
      p.name_ar,
      p.name_en,
      p.sort_order   AS product_sort,
      ppl.laundry_service_id,
      ls.name_ar     AS service_name_ar,
      ls.name_en     AS service_name_en,
      ls.sort_order  AS service_sort,
      ppl.price      AS general_price,
      ccp.custom_price
    FROM products p
    JOIN product_price_lines ppl ON ppl.product_id = p.id
    JOIN laundry_services ls ON ls.id = ppl.laundry_service_id AND ls.is_active = 1
    LEFT JOIN customer_custom_prices ccp
      ON ccp.product_id = p.id
      AND ccp.laundry_service_id = ppl.laundry_service_id
      AND ccp.customer_id = ?
    WHERE p.is_active = 1
    ORDER BY p.sort_order, p.id, ls.sort_order, ls.id
  `, [id]);

  // Group by product in JS
  const productMap = {};
  const productOrder = [];
  rows.forEach(function (r) {
    if (!productMap[r.product_id]) {
      productMap[r.product_id] = {
        id: r.product_id,
        name_ar: r.name_ar,
        name_en: r.name_en,
        services: []
      };
      productOrder.push(r.product_id);
    }
    productMap[r.product_id].services.push({
      laundryServiceId: r.laundry_service_id,
      serviceName_ar: r.service_name_ar,
      serviceName_en: r.service_name_en,
      generalPrice: parseFloat(r.general_price),
      customPrice: r.custom_price !== null ? parseFloat(r.custom_price) : null
    });
  });

  const products = productOrder.map(function (pid) {
    const p = productMap[pid];
    const customCount = p.services.filter(function (s) { return s.customPrice !== null; }).length;
    return Object.assign({}, p, { totalServices: p.services.length, customCount: customCount });
  });

  // Summary
  let totalServices = 0;
  let customServices = 0;
  let totalDiffPct = 0;
  let diffCount = 0;
  products.forEach(function (p) {
    totalServices += p.totalServices;
    customServices += p.customCount;
    p.services.forEach(function (s) {
      if (s.customPrice !== null && s.generalPrice > 0 && s.customPrice < s.generalPrice) {
        totalDiffPct += (s.generalPrice - s.customPrice) / s.generalPrice * 100;
        diffCount++;
      }
    });
  });

  return {
    success: true,
    customer: customer,
    products: products,
    summary: {
      totalServices: totalServices,
      customServices: customServices,
      averageDifferencePercent: diffCount > 0 ? parseFloat((totalDiffPct / diffCount).toFixed(2)) : 0
    }
  };
}

async function saveCustomerCustomPrices(customerId, changes, deletes, userId) {
  const cid = Number(customerId);
  const uid = userId ? Number(userId) : null;

  // Validate all (productId, laundryServiceId) pairs exist in product_price_lines
  const allPairs = (changes || []).concat(deletes || []);
  for (const pair of allPairs) {
    const [check] = await pool.query(
      'SELECT 1 FROM product_price_lines WHERE product_id = ? AND laundry_service_id = ? LIMIT 1',
      [Number(pair.productId), Number(pair.laundryServiceId)]
    );
    if (!check.length) {
      return { success: false, message: 'خط سعر غير صحيح: صنف ' + pair.productId + ' / خدمة ' + pair.laundryServiceId };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let saved = 0;
    for (const c of (changes || [])) {
      const price = parseFloat(c.customPrice);
      if (isNaN(price) || price < 0) continue;
      await conn.query(`
        INSERT INTO customer_custom_prices
          (customer_id, product_id, laundry_service_id, custom_price, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          custom_price = VALUES(custom_price),
          updated_by   = VALUES(updated_by),
          updated_at   = CURRENT_TIMESTAMP
      `, [cid, Number(c.productId), Number(c.laundryServiceId), price, uid, uid]);
      saved++;
    }

    let deleted = 0;
    for (const d of (deletes || [])) {
      const [res] = await conn.query(
        'DELETE FROM customer_custom_prices WHERE customer_id = ? AND product_id = ? AND laundry_service_id = ?',
        [cid, Number(d.productId), Number(d.laundryServiceId)]
      );
      deleted += res.affectedRows;
    }

    await conn.commit();
    return { success: true, saved: saved, deleted: deleted };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getCustomerPosCustomPrices(customerId) {
  const id = Number(customerId);
  const [rows] = await pool.query(
    'SELECT product_id, laundry_service_id, custom_price FROM customer_custom_prices WHERE customer_id = ?',
    [id]
  );
  const prices = {};
  rows.forEach(function (r) {
    prices[r.product_id + ':' + r.laundry_service_id] = {
      productId: r.product_id,
      laundryServiceId: r.laundry_service_id,
      customPrice: parseFloat(r.custom_price)
    };
  });
  return { success: true, prices: prices };
}

// ── Work Orders (Hotels & Companies) ─────────────────────────────────────────

async function createWorkOrder({ customerId, items, subtotal, discountAmount, vatRate, vatAmount, totalAmount, priceDisplayMode, notes, createdBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[seqRow]] = await conn.execute('SELECT COALESCE(MAX(work_order_seq), 0) AS mx FROM work_orders FOR UPDATE');
    const seq = Number(seqRow.mx) + 1;
    const workOrderNumber = 'D-' + seq;

    const [[cust]] = await conn.execute('SELECT customer_name, tax_number, customer_type FROM customers WHERE id = ?', [customerId]);
    if (!cust) { const e = new Error('العميل غير موجود'); e.appCode = 'CUSTOMER_NOT_FOUND'; throw e; }
    if (cust.customer_type !== 'corporate') { const e = new Error('العميل ليس شركة'); e.appCode = 'CUSTOMER_NOT_CORPORATE'; throw e; }

    const [woRes] = await conn.execute(
      `INSERT INTO work_orders (work_order_seq, work_order_number, customer_id, subtotal, discount_amount, vat_rate, vat_amount, total_amount, price_display_mode, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [seq, workOrderNumber, customerId, subtotal || 0, discountAmount || 0, vatRate || 15, vatAmount || 0, totalAmount || 0, priceDisplayMode || 'exclusive', notes || null, createdBy || null]
    );
    const workOrderId = woRes.insertId;

    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await conn.execute(
          `INSERT INTO work_order_items (work_order_id, product_name, service_name, merzam_type_name, quantity, unit_price, line_total, item_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [workOrderId, it.productName || it.productNameAr || '', it.serviceName || it.serviceNameAr || null, it.merzamTypeName || it.merzam_type_name || null, it.quantity || 1, it.unitPrice || 0, it.lineTotal || 0, it.itemType || 'product', i]
        );
      }
    } else {
      const e = new Error('لا توجد أصناف في الأمر'); e.appCode = 'ITEMS_EMPTY'; throw e;
    }

    await conn.commit();
    return { workOrderId, workOrderNumber, workOrderSeq: seq, customerName: cust.customer_name, customerTaxNumber: cust.tax_number || null, createdAt: new Date().toISOString() };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getWorkOrders({ status, customerId, search, dateFrom, dateTo, page, pageSize } = {}) {
  const p = [];
  let where = 'WHERE 1=1';
  if (status) { where += ' AND wo.status = ?'; p.push(status); }
  if (customerId) { where += ' AND wo.customer_id = ?'; p.push(customerId); }
  if (search) {
    where += ' AND (wo.work_order_number LIKE ? OR (wo.consolidated_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM orders o WHERE o.id = wo.consolidated_order_id AND CONCAT(o.invoice_seq) LIKE ?)))';
    p.push('%' + search + '%', '%' + search + '%');
  }
  if (dateFrom) { where += ' AND DATE(wo.created_at) >= ?'; p.push(dateFrom); }
  if (dateTo)   { where += ' AND DATE(wo.created_at) <= ?'; p.push(dateTo); }

  const pg = Math.max(1, parseInt(page) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  const offset = (pg - 1) * ps;

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM work_orders wo ${where}`, p);

  const [rows] = await pool.execute(`
    SELECT wo.id, wo.work_order_number, wo.work_order_seq, wo.customer_id,
           c.customer_name, c.tax_number AS customer_tax_number,
           wo.subtotal, wo.discount_amount, wo.vat_rate, wo.vat_amount, wo.total_amount,
           wo.price_display_mode, wo.status, wo.consolidated_order_id,
           wo.notes, wo.created_by, wo.created_at, wo.cleaning_date, wo.delivery_date,
           o.invoice_seq AS consolidated_invoice_seq,
           o.payment_method AS consolidated_payment_method,
           o.payment_status AS consolidated_payment_status,
           o.total_amount   AS consolidated_total_amount
    FROM work_orders wo
    JOIN customers c ON c.id = wo.customer_id
    LEFT JOIN orders o ON o.id = wo.consolidated_order_id
    ${where}
    ORDER BY COALESCE(wo.consolidated_order_id, wo.id) DESC, wo.id DESC
    LIMIT ? OFFSET ?
  `, [...p, ps, offset]);

  const ids = rows.map(r => r.id);
  let itemsMap = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const [items] = await pool.execute(`SELECT * FROM work_order_items WHERE work_order_id IN (${placeholders}) ORDER BY work_order_id, sort_order`, ids);
    items.forEach(it => {
      if (!itemsMap[it.work_order_id]) itemsMap[it.work_order_id] = [];
      itemsMap[it.work_order_id].push(it);
    });
  }

  return {
    rows: rows.map(r => ({ ...r, items: itemsMap[r.id] || [] })),
    total: Number(total), page: pg, pageSize: ps,
    totalPages: Math.ceil(Number(total) / ps)
  };
}

async function cancelWorkOrder({ workOrderId }) {
  const [res] = await pool.execute(
    `UPDATE work_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`,
    [workOrderId]
  );
  if (res.affectedRows === 0) {
    const e = new Error('الأمر غير موجود أو ليس في حالة انتظار'); e.appCode = 'NOT_PENDING'; throw e;
  }
}

async function getWorkOrderForPrint({ workOrderId }) {
  const [[wo]] = await pool.execute(`
    SELECT wo.*, c.customer_name, c.tax_number AS customer_tax_number, c.phone AS customer_phone
    FROM work_orders wo JOIN customers c ON c.id = wo.customer_id
    WHERE wo.id = ?
  `, [workOrderId]);
  if (!wo) { const e = new Error('أمر التشغيل غير موجود'); e.appCode = 'NOT_FOUND'; throw e; }
  const [items] = await pool.execute(`SELECT * FROM work_order_items WHERE work_order_id = ? ORDER BY sort_order`, [workOrderId]);
  return { ...wo, items };
}

async function createConsolidatedInvoice({ workOrderIds, discountAmount, discountPercent, paymentMethod, paidCash = 0, paidCard = 0, notes, createdBy, confirmNoVat }) {
  if (!Array.isArray(workOrderIds) || workOrderIds.length === 0) {
    const e = new Error('لم يتم تحديد أوامر تشغيل'); e.appCode = 'NO_ORDERS_SELECTED'; throw e;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const placeholders = workOrderIds.map(() => '?').join(',');
    const [wos] = await conn.execute(
      `SELECT wo.*, c.customer_name, c.tax_number AS customer_tax_number, c.customer_type
       FROM work_orders wo JOIN customers c ON c.id = wo.customer_id
       WHERE wo.id IN (${placeholders}) FOR UPDATE`,
      workOrderIds
    );

    if (wos.length !== workOrderIds.length) {
      const e = new Error('بعض أوامر التشغيل غير موجودة'); e.appCode = 'SOME_NOT_PENDING'; throw e;
    }
    const notPending = wos.filter(w => w.status !== 'pending');
    if (notPending.length > 0) {
      const e = new Error('بعض الأوامر ليست في حالة انتظار'); e.appCode = 'SOME_NOT_PENDING'; throw e;
    }
    const customerIds = [...new Set(wos.map(w => w.customer_id))];
    if (customerIds.length > 1) {
      const e = new Error('الأوامر المحددة تخص عملاء مختلفين'); e.appCode = 'MIXED_CUSTOMERS'; throw e;
    }

    const cust = wos[0];
    if (!cust.customer_tax_number && !confirmNoVat) {
      const e = new Error('الرقم الضريبي غير مُدخَل'); e.appCode = 'NEEDS_VAT_CONFIRM'; throw e;
    }

    let woSubtotal = wos.reduce((s, w) => s + Number(w.subtotal), 0);
    const vatRate = Number(wos[0].vat_rate) || 15;
    const priceMode = wos[0].price_display_mode || 'exclusive';

    let disc = 0;
    if (discountAmount && Number(discountAmount) > 0) disc = Number(discountAmount);
    else if (discountPercent && Number(discountPercent) > 0) disc = woSubtotal * Number(discountPercent) / 100;
    disc = Math.min(disc, woSubtotal);

    if (disc > woSubtotal) {
      const e = new Error('الخصم أكبر من المجموع'); e.appCode = 'DISCOUNT_EXCEEDS_TOTAL'; throw e;
    }

    let vatAmount, total;
    if (priceMode === 'inclusive') {
      total = woSubtotal - disc;
      vatAmount = total - total / (1 + vatRate / 100);
    } else {
      vatAmount = (woSubtotal - disc) * vatRate / 100;
      total = woSubtotal - disc + vatAmount;
    }
    woSubtotal = Math.round(woSubtotal * 100) / 100;
    disc       = Math.round(disc * 100) / 100;
    vatAmount  = Math.round(vatAmount * 100) / 100;
    total      = Math.round(total * 100) / 100;

    const [[seqRow]] = await conn.execute('SELECT COALESCE(MAX(invoice_seq), 0) AS mx FROM orders FOR UPDATE');
    const invoiceSeq = Number(seqRow.mx) + 1;
    const [[idRow]] = await conn.execute('SELECT COALESCE(MAX(id), 0) AS mx FROM orders');
    const nextId = Number(idRow.mx) + 1;
    const orderNumber = 'ORD-' + nextId;
    const allowedPaymentMethods = ['cash', 'card', 'bank', 'transfer', 'credit', 'deferred', 'mixed', 'subscription'];
    const dbPaymentMethod = allowedPaymentMethods.includes(String(paymentMethod || '').trim())
      ? String(paymentMethod).trim()
      : 'cash';
    let dbPaidCash = 0;
    let dbPaidCard = 0;
    if (dbPaymentMethod === 'mixed') {
      dbPaidCash = Math.max(0, Math.min(Number(paidCash || 0), total));
      dbPaidCash = Math.round(dbPaidCash * 100) / 100;
      dbPaidCard = Math.max(0, Math.round((total - dbPaidCash) * 100) / 100);
    } else if (dbPaymentMethod === 'cash') {
      dbPaidCash = total;
    } else if (dbPaymentMethod === 'card' || dbPaymentMethod === 'bank' || dbPaymentMethod === 'transfer') {
      dbPaidCard = total;
    }

    const isDeferred = dbPaymentMethod === 'deferred' || dbPaymentMethod === 'credit';
    const dbPaymentStatus   = isDeferred ? 'pending' : 'paid';
    const dbPaidAmount      = isDeferred ? 0 : total;
    const dbRemainingAmount = isDeferred ? total : 0;
    const paidAtExpr        = isDeferred ? 'NULL' : 'NOW()';

    const [oRes] = await conn.execute(
      `INSERT INTO orders (order_number, invoice_seq, customer_id, subtotal, discount_amount, vat_rate, vat_amount, total_amount, payment_method, payment_status, paid_amount, remaining_amount, paid_cash, paid_card, paid_at, fully_paid_at, cleaning_date, delivery_date, price_display_mode, order_type, is_consolidated, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${paidAtExpr}, ${paidAtExpr}, NOW(), NOW(), ?, 'sale', 1, ?, ?)`,
      [orderNumber, invoiceSeq, cust.customer_id, woSubtotal, disc, vatRate, vatAmount, total, dbPaymentMethod,
       dbPaymentStatus, dbPaidAmount, dbRemainingAmount, dbPaidCash, dbPaidCard,
       priceMode, notes || null, createdBy || null]
    );
    const orderId = oRes.insertId;

    const [allItems] = await conn.execute(
      `SELECT * FROM work_order_items WHERE work_order_id IN (${placeholders}) ORDER BY work_order_id, sort_order`,
      workOrderIds
    );
    for (const it of allItems) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_name_ar, product_name_en, service_name_ar, service_name_en, quantity, unit_price, line_total, work_order_id, merzam_type_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderId, it.product_name || null, it.product_name || null, it.service_name || null, it.service_name || null,
         it.quantity, it.unit_price, it.line_total, it.work_order_id, it.merzam_type_name || null]
      );
    }

    await conn.execute(
      `UPDATE work_orders SET status = 'invoiced', consolidated_order_id = ? WHERE id IN (${placeholders})`,
      [orderId, ...workOrderIds]
    );

    await conn.commit();
    return { orderId, invoiceSeq, orderNumber };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getConsolidatedInvoiceForPrint({ orderId }) {
  const [[order]] = await pool.execute(`
    SELECT o.*, c.customer_name, c.tax_number AS customer_tax_number, c.phone AS customer_phone
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.id = ? AND o.is_consolidated = 1
  `, [orderId]);
  if (!order) { const e = new Error('الفاتورة غير موجودة'); e.appCode = 'NOT_FOUND'; throw e; }

  const [ois] = await pool.execute(
    `SELECT oi.id, oi.order_id, oi.product_id, oi.laundry_service_id,
            COALESCE(oi.product_name_ar, '') AS product_name,
            COALESCE(p.name_en, oi.product_name_en, oi.product_name_ar, '') AS product_name_en,
            COALESCE(oi.service_name_ar, '') AS service_name,
            COALESCE(ls.name_en, oi.service_name_en, oi.service_name_ar, '') AS service_name_en,
            oi.merzam_type_name,
            oi.quantity, oi.unit_price, oi.line_total, oi.work_order_id
     FROM order_items oi
     LEFT JOIN products p ON p.name_ar = oi.product_name_ar
     LEFT JOIN laundry_services ls ON ls.name_ar = oi.service_name_ar
     WHERE oi.order_id = ? ORDER BY oi.id`,
    [orderId]
  );

  const woIds = [...new Set(ois.map(r => r.work_order_id).filter(Boolean))];
  let workOrders = [];
  if (woIds.length > 0) {
    const ph = woIds.map(() => '?').join(',');
    const [wos] = await pool.execute(`SELECT wo.id, wo.work_order_number, wo.created_at, wo.subtotal, wo.total_amount FROM work_orders wo WHERE wo.id IN (${ph}) ORDER BY wo.id`, woIds);
    const [wItems] = await pool.execute(`SELECT * FROM work_order_items WHERE work_order_id IN (${ph}) ORDER BY work_order_id, sort_order`, woIds);
    const wItemMap = {};
    wItems.forEach(it => { if (!wItemMap[it.work_order_id]) wItemMap[it.work_order_id] = []; wItemMap[it.work_order_id].push(it); });
    workOrders = wos.map(w => ({ ...w, items: wItemMap[w.id] || [] }));
  }

  return { invoice: { ...order, isConsolidated: true, workOrders, orderItems: ois } };
}

async function settleConsolidatedInvoice({ orderId, paymentMethod, paidCash = 0, paidCard = 0 }) {
  const allowedMethods = ['cash', 'card', 'bank', 'transfer', 'mixed'];
  const dbMethod = allowedMethods.includes(String(paymentMethod || '').trim()) ? String(paymentMethod).trim() : 'cash';

  const [[order]] = await pool.execute(
    'SELECT id, total_amount, payment_status, is_consolidated FROM orders WHERE id = ?', [orderId]
  );
  if (!order) throw Object.assign(new Error('الفاتورة غير موجودة'), { appCode: 'NOT_FOUND' });
  if (!order.is_consolidated) throw Object.assign(new Error('هذه ليست فاتورة مجمعة'), { appCode: 'INVALID' });
  if (order.payment_status === 'paid') throw Object.assign(new Error('الفاتورة مدفوعة مسبقاً'), { appCode: 'ALREADY_PAID' });

  const total = Number(order.total_amount);
  let dbPaidCash = 0, dbPaidCard = 0;
  if (dbMethod === 'mixed') {
    dbPaidCash = Math.max(0, Math.min(Math.round(Number(paidCash) * 100) / 100, total));
    dbPaidCard = Math.max(0, Math.round((total - dbPaidCash) * 100) / 100);
  } else if (dbMethod === 'cash') {
    dbPaidCash = total;
  } else {
    dbPaidCard = total;
  }

  await pool.execute(
    `UPDATE orders SET payment_method = ?, payment_status = 'paid', paid_amount = total_amount,
     remaining_amount = 0, paid_cash = ?, paid_card = ?, paid_at = NOW(), fully_paid_at = NOW()
     WHERE id = ?`,
    [dbMethod, dbPaidCash, dbPaidCard, orderId]
  );

  return { success: true };
}

async function getCorporateCustomers({ search, page, pageSize } = {}) {
  const p = [];
  let where = `WHERE c.customer_type = 'corporate' AND c.is_active = 1`;
  if (search) { where += ' AND (c.customer_name LIKE ? OR c.phone LIKE ?)'; p.push('%' + search + '%', '%' + search + '%'); }

  const pg = Math.max(1, parseInt(page) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
  const offset = (pg - 1) * ps;

  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM customers c ${where}`, p);
  const [rows] = await pool.execute(`
    SELECT c.id, c.customer_name, c.phone, c.tax_number,
           (SELECT COUNT(*) FROM work_orders wo WHERE wo.customer_id = c.id AND wo.status = 'pending') AS pending_work_orders,
           (SELECT COALESCE(SUM(wo.total_amount), 0) FROM work_orders wo WHERE wo.customer_id = c.id AND wo.status = 'pending') AS pending_total
    FROM customers c
    ${where}
    ORDER BY pending_work_orders DESC, c.customer_name
    LIMIT ? OFFSET ?
  `, [...p, ps, offset]);

  return { rows, total: Number(total), page: pg, pageSize: ps, totalPages: Math.ceil(Number(total) / ps) };
}

/* ============================================================================
 * تقرير الفنادق والشركات (031) — قراءة فقط، لا كتابة، MySQL 5.7-safe
 * ========================================================================== */

// تطبيع التاريخ القادم من datetime-local (YYYY-MM-DDTHH:mm:ss) إلى صيغة MySQL
function _normDt(v) {
  if (!v) return null;
  return String(v).replace('T', ' ');
}

// كشف حساب تفصيلي لعميل مؤسسي واحد خلال فترة
async function getCorporateReportStatement({ customerId, dateFrom, dateTo, docType = 'all', status = 'all' } = {}) {
  const cid = Number(customerId);
  if (!cid) { const e = new Error('يجب اختيار عميل'); e.appCode = 'NO_CUSTOMER'; throw e; }

  const from = _normDt(dateFrom);
  const to   = _normDt(dateTo);
  if (from && to && from > to) { const e = new Error('نطاق التاريخ غير صحيح'); e.appCode = 'BAD_RANGE'; throw e; }

  // العميل — يجب أن يكون شركة/فندق
  const [[cust]] = await pool.execute(
    `SELECT id, customer_name, phone, tax_number, customer_type FROM customers WHERE id = ?`, [cid]
  );
  if (!cust) { const e = new Error('العميل غير موجود'); e.appCode = 'NOT_FOUND'; throw e; }
  if (cust.customer_type !== 'corporate') { const e = new Error('العميل المحدد ليس شركة/فندق'); e.appCode = 'NOT_CORPORATE'; throw e; }

  // فلاتر النوع/الحالة: حالات أوامر التشغيل مقابل حالات دفع الفواتير
  const woStatuses  = ['pending', 'invoiced', 'cancelled'];
  const invStatuses = ['paid', 'deferred'];
  const includeWO  = (docType === 'all' || docType === 'work_orders') && (status === 'all' || woStatuses.includes(status));
  const includeInv = (docType === 'all' || docType === 'invoices')   && (status === 'all' || invStatuses.includes(status));

  // أوامر التشغيل خلال الفترة
  let workOrders = [];
  if (includeWO) {
    const wp = [cid];
    let ww = 'WHERE wo.customer_id = ?';
    if (from) { ww += ' AND wo.created_at >= ?'; wp.push(from); }
    if (to)   { ww += ' AND wo.created_at <= ?'; wp.push(to); }
    if (woStatuses.includes(status)) { ww += ' AND wo.status = ?'; wp.push(status); }
    const [wrows] = await pool.execute(`
      SELECT wo.id, wo.work_order_number, wo.work_order_seq, wo.status, wo.created_at,
             wo.subtotal, wo.discount_amount, wo.vat_amount, wo.total_amount,
             wo.consolidated_order_id,
             o.invoice_seq AS consolidated_invoice_seq
      FROM work_orders wo
      LEFT JOIN orders o ON o.id = wo.consolidated_order_id
      ${ww}
      ORDER BY wo.created_at ASC, wo.id ASC
    `, wp);
    workOrders = wrows;
  }

  // الفواتير المجمعة خلال الفترة
  let consolidatedInvoices = [];
  if (includeInv) {
    const ip = [cid];
    let iw = 'WHERE o.customer_id = ? AND COALESCE(o.is_consolidated, 0) = 1';
    if (from) { iw += ' AND o.created_at >= ?'; ip.push(from); }
    if (to)   { iw += ' AND o.created_at <= ?'; ip.push(to); }
    if (status === 'paid')     { iw += " AND o.payment_status = 'paid'"; }
    if (status === 'deferred') { iw += " AND o.payment_status IN ('pending','partial')"; }
    const [irows] = await pool.execute(`
      SELECT o.id, o.invoice_seq, o.order_number, o.created_at,
             o.subtotal, o.discount_amount, o.vat_amount, o.total_amount,
             o.payment_status, o.paid_amount, o.remaining_amount,
             (SELECT COUNT(DISTINCT oi.work_order_id) FROM order_items oi
               WHERE oi.order_id = o.id AND oi.work_order_id IS NOT NULL) AS work_orders_count
      FROM orders o
      ${iw}
      ORDER BY o.created_at ASC, o.id ASC
    `, ip);
    consolidatedInvoices = irows;

    // أرقام D-XXX المضمَّنة لكل فاتورة (استعلام واحد)
    const invIds = consolidatedInvoices.map(r => r.id);
    if (invIds.length > 0) {
      const ph = invIds.map(() => '?').join(',');
      const [links] = await pool.execute(`
        SELECT DISTINCT oi.order_id, wo.work_order_number
        FROM order_items oi
        JOIN work_orders wo ON wo.id = oi.work_order_id
        WHERE oi.order_id IN (${ph}) AND oi.work_order_id IS NOT NULL
        ORDER BY wo.work_order_seq ASC
      `, invIds);
      const map = {};
      links.forEach(l => { (map[l.order_id] = map[l.order_id] || []).push(l.work_order_number); });
      consolidatedInvoices.forEach(inv => { inv.work_order_numbers = map[inv.id] || []; });
    }
  }

  // الملخص المالي — يُحسب تطبيقياً (تفادي window functions)
  const r2 = n => Math.round(Number(n || 0) * 100) / 100;
  let totalWorkOrdered = 0, totalDiscount = 0, totalVat = 0;
  let cancelledCount = 0, activeWoCount = 0;
  workOrders.forEach(w => {
    if (w.status === 'cancelled') { cancelledCount++; return; }
    activeWoCount++;
    totalWorkOrdered += Number(w.total_amount || 0);
    totalDiscount    += Number(w.discount_amount || 0);
    totalVat         += Number(w.vat_amount || 0);
  });
  let totalInvoiced = 0, totalPaid = 0, totalOutstanding = 0, invDiscount = 0, invVat = 0;
  consolidatedInvoices.forEach(inv => {
    totalInvoiced    += Number(inv.total_amount || 0);
    totalPaid        += Number(inv.paid_amount || 0);
    totalOutstanding += Number(inv.remaining_amount || 0);
    invDiscount      += Number(inv.discount_amount || 0);
    invVat           += Number(inv.vat_amount || 0);
  });

  const summary = {
    totalWorkOrdered: r2(totalWorkOrdered),
    totalInvoiced:    r2(totalInvoiced),
    totalDiscount:    r2(totalDiscount + invDiscount),
    totalVat:         r2(totalVat + invVat),
    totalPaid:        r2(totalPaid),
    totalOutstanding: r2(totalOutstanding),
    workOrdersCount:  activeWoCount,
    cancelledCount,
    invoicesCount:    consolidatedInvoices.length,
  };

  return {
    customer: {
      id: cust.id, customer_name: cust.customer_name, phone: cust.phone,
      tax_number: cust.tax_number, hasTaxNumber: !!cust.tax_number,
    },
    dateFrom: from, dateTo: to,
    workOrders, consolidatedInvoices, summary,
  };
}

// ملخص كل عملاء الشركات/الفنادق النشطين خلال فترة
async function getCorporateReportSummary({ dateFrom, dateTo, search } = {}) {
  const from = _normDt(dateFrom);
  const to   = _normDt(dateTo);
  if (from && to && from > to) { const e = new Error('نطاق التاريخ غير صحيح'); e.appCode = 'BAD_RANGE'; throw e; }

  // شروط التاريخ كنصوص قابلة لإعادة الاستخدام داخل subqueries
  const woDate = (from ? ' AND wo.created_at >= ?' : '') + (to ? ' AND wo.created_at <= ?' : '');
  const oDate  = (from ? ' AND o.created_at >= ?'  : '') + (to ? ' AND o.created_at <= ?'  : '');
  const dateArgs = [];
  if (from) dateArgs.push(from);
  if (to)   dateArgs.push(to);

  const params = [];
  // ترتيب الـ subqueries: wo_count, total_work_ordered, inv_count, total_invoiced, total_paid, total_outstanding
  params.push(...dateArgs);  // wo_count
  params.push(...dateArgs);  // total_work_ordered
  params.push(...dateArgs);  // inv_count
  params.push(...dateArgs);  // total_invoiced
  params.push(...dateArgs);  // total_paid
  params.push(...dateArgs);  // total_outstanding
  let searchWhere = '';
  if (search) { searchWhere = ' AND c.customer_name LIKE ?'; params.push('%' + search + '%'); }

  const [rows] = await pool.execute(`
    SELECT c.id, c.customer_name, c.tax_number,
      (SELECT COUNT(*) FROM work_orders wo
        WHERE wo.customer_id = c.id AND wo.status <> 'cancelled'${woDate}) AS wo_count,
      (SELECT COALESCE(SUM(wo.total_amount), 0) FROM work_orders wo
        WHERE wo.customer_id = c.id AND wo.status <> 'cancelled'${woDate}) AS total_work_ordered,
      (SELECT COUNT(*) FROM orders o
        WHERE o.customer_id = c.id AND COALESCE(o.is_consolidated,0) = 1${oDate}) AS inv_count,
      (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND COALESCE(o.is_consolidated,0) = 1${oDate}) AS total_invoiced,
      (SELECT COALESCE(SUM(o.paid_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND COALESCE(o.is_consolidated,0) = 1${oDate}) AS total_paid,
      (SELECT COALESCE(SUM(o.remaining_amount), 0) FROM orders o
        WHERE o.customer_id = c.id AND COALESCE(o.is_consolidated,0) = 1${oDate}) AS total_outstanding
    FROM customers c
    WHERE c.customer_type = 'corporate'${searchWhere}
    HAVING (wo_count > 0 OR inv_count > 0)
    ORDER BY total_outstanding DESC, c.customer_name ASC
  `, params);

  const r2 = n => Math.round(Number(n || 0) * 100) / 100;
  const totals = rows.reduce((t, r) => ({
    wo_count:          t.wo_count + Number(r.wo_count || 0),
    total_work_ordered: t.total_work_ordered + Number(r.total_work_ordered || 0),
    inv_count:         t.inv_count + Number(r.inv_count || 0),
    total_invoiced:    t.total_invoiced + Number(r.total_invoiced || 0),
    total_paid:        t.total_paid + Number(r.total_paid || 0),
    total_outstanding: t.total_outstanding + Number(r.total_outstanding || 0),
  }), { wo_count: 0, total_work_ordered: 0, inv_count: 0, total_invoiced: 0, total_paid: 0, total_outstanding: 0 });
  Object.keys(totals).forEach(k => { if (k.startsWith('total_')) totals[k] = r2(totals[k]); });

  return { dateFrom: from, dateTo: to, rows, totals };
}

module.exports = {
  initialize, findUser, query, buildAllPermissions,
  getAllUsers, createUser, updateUser, toggleUserStatus, deleteUser,
  getAllRoles, createRole, updateRole, deleteRole, getPermissionsForUser,
  getUsersList, saveUserPermissions,
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
  getCustomerUnpaidInvoices, settleInvoicesFromSubscription,
  getSubscriptionReceiptData, getSubscriptionsExportRows, getSubscriptionCustomerReportRows,
  get pool() { return pool; },
  createSubscriptionInvoice, getSubscriptionInvoice,
  // New subscription order helpers
  createSubscriptionOrder, getSubscriptionOrderByPeriod,
  getAppSettings, saveAppSettings, updateReportEmailLastResult,
  getZatcaSettings, saveZatcaSettings,
  updateOrderZatcaStatus, updateCreditNoteZatcaStatus, getUnsentZatcaOrders, getCreditNoteDate,
  getPosProducts, getPosServices, generateOrderNumber, createOrder, getOrders, getOrderById,
  createConsumptionReceipt, getConsumptionReceipts, getConsumptionReceiptById,
  searchConsumptionReceiptForRefund, refundConsumptionReceipt,
  getOrdersBySubscription, getSubscriptionInvoices,
  getDeferredOrders, getDeferredBySubscription, payDeferredOrder,
  markOrderCleaned, markOrderDelivered,
  markReceiptCleaned, markReceiptDelivered,
  markWorkOrderCleaned, markWorkOrderDelivered,
  // Partial invoice payment functions
  calculateRemainingBalance, determinePaymentStatus, validatePaymentAmount,
  getInvoiceWithPayments, recordInvoicePayment, getPaymentHistory,
  // Hanger functions
  getAllHangers, getAvailableHangers, createHanger, batchCreateHangers,
  updateHanger, deleteHanger, setHangerStatus, getHangerById,
  // Credit Note functions
  createCreditNotesTable, getInvoiceBySeq, createCreditNote,
  getCreditNotes, getCreditNoteById,
  // Refund functions
  generateRefundNumber, createRefund, getOrderForRefund, getSubscriptionTransactions,
  // Offer functions
  createOffersTable, getAllOffers, getActiveOffers, createOffer, updateOffer, toggleOfferStatus, deleteOffer,
  // Product Offer functions
  createProductOffersTable, createProductOfferLinesTable,
  getAllProductOffers, getProductOfferById,
  createProductOffer, updateProductOffer, toggleProductOfferStatus, deleteProductOffer,
  getActiveProductOffersForPos,
  getProductsForOffers,
  // Customer Account Statement
  getCustomerAccountStatement,
  // Zakat Report
  getZakatReport,
  // Report functions
  getReportData,
  getWorkerReportData,
  getAllInvoicesReport,
  getSubscriptionsReport,
  getTypesReport,
  getWhatsappQuota,
  incrementWhatsappUsed,
  setWhatsappQuota,
  // Loyalty Points functions
  getLoyaltySettings, saveLoyaltySettings, getCustomerLoyaltyBalance, getLoyaltyTransactions,
  // System Restore
  systemRestore,
  // Accounts (Trial / Subscription)
  registerAccount, checkTrialAccess,
  // License
  isSerialLicensed,
  // Merzam Types
  getMerzamTypes, saveMerzamType, deleteMerzamType,
  // Customer Custom Prices
  getCustomPricesScreenData, saveCustomerCustomPrices, getCustomerPosCustomPrices,
  // Hotels & Companies (Work Orders)
  createWorkOrder, getWorkOrders, cancelWorkOrder, getWorkOrderForPrint,
  createConsolidatedInvoice, getConsolidatedInvoiceForPrint, getCorporateCustomers, settleConsolidatedInvoice,
  getCorporateReportStatement, getCorporateReportSummary,
  // User Sessions
  createUserSession, closeUserSession, reactivateUserSession, heartbeatUserSession, closeAllActiveSessions, getUserSessions,
};

// ── System Restore ───────────────────────────────────────────────────────────

async function systemRestore({ invoices, subscriptions, consumptionReceipts, customers, services, expenses, garments } = {}) {
  const invoiceTables             = ['credit_note_items','credit_notes','refunds','subscription_invoices','order_items','invoice_payments','orders'];
  const subscriptionTables        = ['loyalty_transactions','subscription_ledger','subscription_periods','customer_subscriptions'];
  const consumptionReceiptTables  = ['consumption_receipts'];
  const customerTables            = ['customers'];
  const serviceTables             = ['product_price_lines','products','offers','prepaid_packages','laundry_services'];
  const expenseTables             = ['expenses'];
  const garmentTables             = ['hangers'];

  const selected = [];
  if (invoices)             invoiceTables.forEach(t            => selected.push(t));
  if (subscriptions)        subscriptionTables.forEach(t       => selected.push(t));
  if (consumptionReceipts)  consumptionReceiptTables.forEach(t => selected.push(t));
  if (customers)            customerTables.forEach(t           => selected.push(t));
  if (services)             serviceTables.forEach(t            => selected.push(t));
  if (expenses)             expenseTables.forEach(t            => selected.push(t));
  if (garments)             garmentTables.forEach(t            => selected.push(t));

  if (selected.length === 0) return { success: true, deleted: [] };

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    for (const tbl of selected) {
      await conn.query(`TRUNCATE TABLE \`${tbl}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    return { success: true, deleted: selected };
  } catch (e) {
    await conn.query('SET FOREIGN_KEY_CHECKS=1').catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

// ── WhatsApp Quota ────────────────────────────────────────────────────────────

async function migrateWhatsappQuota() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_quota (
        id          INT NOT NULL DEFAULT 1 PRIMARY KEY,
        quota_total INT NOT NULL DEFAULT 0,
        quota_used  INT NOT NULL DEFAULT 0,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`INSERT IGNORE INTO whatsapp_quota (id, quota_total, quota_used) VALUES (1, 0, 0)`);
  } catch (e) {
    console.error('migrateWhatsappQuota:', e);
  }
}

async function getWhatsappQuota() {
  const [[row]] = await pool.query(
    'SELECT quota_total, quota_used, (quota_total - quota_used) AS quota_remaining FROM whatsapp_quota WHERE id = 1'
  );
  return row || { quota_total: 0, quota_used: 0, quota_remaining: 0 };
}

async function incrementWhatsappUsed() {
  await pool.query(
    'UPDATE whatsapp_quota SET quota_used = quota_used + 1 WHERE id = 1 AND quota_used < quota_total'
  );
}

async function setWhatsappQuota(total) {
  await pool.query(
    'UPDATE whatsapp_quota SET quota_total = ?, quota_used = 0 WHERE id = 1',
    [total]
  );
}

async function getTypesReport(filters = {}) {
  const dateFrom = toSqlDateTime(filters.dateFrom) || '1970-01-01 00:00:00';
  const dateTo   = toSqlDateTime(filters.dateTo)   || '9999-12-31 23:59:59';
  const params = [dateFrom, dateTo];
  const conditions = [
    'o.created_at >= ?',
    'o.created_at <= ?'
  ];
  if (filters.productId) {
    conditions.push('oi.product_id = ?');
    params.push(Number(filters.productId));
  }
  if (filters.serviceId) {
    conditions.push('oi.laundry_service_id = ?');
    params.push(Number(filters.serviceId));
  }
  const where = conditions.join(' AND ');
  const sql = `
    SELECT
      oi.product_id,
      p.name_ar                       AS product_name_ar,
      p.name_en                       AS product_name_en,
      oi.laundry_service_id           AS service_id,
      ls.name_ar                      AS service_name_ar,
      ls.name_en                      AS service_name_en,
      SUM(oi.quantity)                AS total_qty,
      SUM(oi.line_total)              AS total_sales,
      SUM(oi.line_total *
          IFNULL(o.vat_rate, 0) / 100) AS total_vat,
      SUM(oi.line_total *
          (1 + IFNULL(o.vat_rate, 0) / 100)) AS total_gross
    FROM order_items oi
    JOIN orders           o  ON o.id = oi.order_id
    JOIN products         p  ON p.id = oi.product_id
    LEFT JOIN laundry_services ls ON ls.id = oi.laundry_service_id
    WHERE ${where}
    GROUP BY oi.product_id, oi.laundry_service_id
    ORDER BY total_sales DESC, p.name_ar, ls.name_ar
  `;
  const [rows] = await pool.query(sql, params);
  const totals = rows.reduce((acc, r) => {
    acc.total_qty    += Number(r.total_qty    || 0);
    acc.total_sales  += Number(r.total_sales  || 0);
    acc.total_vat    += Number(r.total_vat    || 0);
    acc.total_gross  += Number(r.total_gross  || 0);
    return acc;
  }, { total_qty: 0, total_sales: 0, total_vat: 0, total_gross: 0 });
  return { rows, totals };
}

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
  const invoicesWhere   = `WHERE 1=1${dateOrdersWhere} AND o.payment_status = 'paid' AND COALESCE(o.payment_method,'cash') NOT IN ('credit','subscription') AND o.order_type NOT IN ('subscription_new','subscription_renewal') AND NOT EXISTS (SELECT 1 FROM invoice_payments ip_ex WHERE ip_ex.order_id = o.id)`;
  // Allow refunded orders to remain in payment-method aggregation so the negative
  // refund row offsets the original paid invoice in the same report window.
  const pmWhere         = `WHERE 1=1${dateOrdersWhere} AND NOT EXISTS (SELECT 1 FROM credit_notes cn_chk WHERE cn_chk.original_order_id = o.id) AND NOT EXISTS (SELECT 1 FROM invoice_payments ip_ex2 WHERE ip_ex2.order_id = o.id)`;
  const invoicesParams  = [...params];
  const pmParams        = [...params];
  const expWhere        = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'expense_date')}`;
  const expParams       = [...params];
  const cnWhere         = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'cn.created_at')} AND cn.original_order_id NOT IN (SELECT order_id FROM consumption_receipts WHERE order_id IS NOT NULL)`;
  const cnParams        = [...params];
  const subWhere        = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'sl.created_at')}`;
  const subParams       = [...params];
  const ipDateWhere     = dateWhere.replace(/created_at/g, 'ip.payment_date');
  // نشمل جميع دفعات invoice_payments بغض النظر عن حالة الفاتورة (partial/pending/paid)
  // لأن الفواتير المكتملة عبر دفعات جزئية يجب أن تُحسب بتاريخ الدفع لا تاريخ الإنشاء
  const partialWhere    = `WHERE 1=1${ipDateWhere}`;
  const partialParams   = [...params];

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
    SELECT method, COUNT(*) AS count,
      COALESCE(SUM(total_after_tax), 0)  AS total_after_tax,
      COALESCE(SUM(total_before_tax), 0) AS total_before_tax,
      COALESCE(SUM(total_tax), 0)        AS total_tax
    FROM (
      SELECT COALESCE(o.payment_method,'cash') AS method, 1 AS count,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount ELSE o.total_amount END AS total_after_tax,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount - o.remaining_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
             ELSE o.total_amount - o.vat_amount END AS total_before_tax,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
             ELSE o.vat_amount END AS total_tax
      FROM orders o ${pmWhere} AND COALESCE(o.payment_method,'cash') != 'mixed'
      UNION ALL
      SELECT 'cash', 1,
        o.paid_cash,
        o.paid_cash - o.paid_cash*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)),
        o.paid_cash*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM orders o ${pmWhere} AND o.payment_method = 'mixed' AND (o.paid_cash > 0 OR COALESCE(o.is_refund, 0) = 1)
      UNION ALL
      SELECT 'card', 1,
        o.paid_card,
        o.paid_card - o.paid_card*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)),
        o.paid_card*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM orders o ${pmWhere} AND o.payment_method = 'mixed' AND (o.paid_card > 0 OR COALESCE(o.is_refund, 0) = 1)
    ) AS pm_rows
    GROUP BY method
    ORDER BY total_after_tax DESC
  `, [...pmParams, ...pmParams, ...pmParams]);

  const [invoices] = await pool.query(`
    SELECT o.id, o.invoice_seq, o.order_number, o.subtotal, o.discount_amount,
           o.vat_amount, o.total_amount, o.payment_method, o.created_at, o.created_by,
           c.customer_name, c.phone,
           COALESCE((SELECT usr.full_name FROM users usr WHERE usr.username = CONVERT(o.created_by USING utf8mb4) COLLATE utf8mb4_unicode_ci LIMIT 1), o.created_by) AS cashier_name
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
    SELECT
      COALESCE(SUM(sp.prepaid_price_paid), 0)    AS sub_total,
      COALESCE(SUM(IFNULL(o.vat_amount, 0)), 0)  AS sub_vat
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    LEFT JOIN orders o ON o.id = sp.order_id
    ${subWhere} AND sl.entry_type IN ('purchase', 'renewal')
  `, subParams);

  const [subscriptions] = await pool.query(`
    SELECT c.phone, c.subscription_number, cs.subscription_ref, cs.id AS subscription_id, sp.order_id, sp.prepaid_price_paid AS amount, sl.entry_type, sl.created_at
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    INNER JOIN customers c ON c.id = cs.customer_id
    ${subWhere} AND sl.entry_type IN ('purchase', 'renewal')
    ORDER BY sl.created_at DESC
  `, subParams);

  const [partialByMethod] = await pool.query(`
    SELECT method, COUNT(*) AS count,
      COALESCE(SUM(total_after_tax), 0) AS total_after_tax,
      COALESCE(SUM(total_tax), 0)       AS total_tax
    FROM (
      SELECT ip.payment_method AS method, 1 AS count,
        ip.payment_amount AS total_after_tax,
        ip.payment_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)) AS total_tax
      FROM invoice_payments ip INNER JOIN orders o ON o.id = ip.order_id
      ${partialWhere} AND ip.payment_method != 'mixed'
      UNION ALL
      SELECT 'cash', 1,
        ip.cash_amount,
        ip.cash_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM invoice_payments ip INNER JOIN orders o ON o.id = ip.order_id
      ${partialWhere} AND ip.payment_method = 'mixed' AND ip.cash_amount > 0
      UNION ALL
      SELECT 'card', 1,
        ip.card_amount,
        ip.card_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM invoice_payments ip INNER JOIN orders o ON o.id = ip.order_id
      ${partialWhere} AND ip.payment_method = 'mixed' AND ip.card_amount > 0
    ) AS pb_rows
    GROUP BY method
  `, [...partialParams, ...partialParams, ...partialParams]);

  const [[partialTotalRow]] = await pool.query(`
    SELECT
      COALESCE(SUM(ip.payment_amount), 0) AS partial_total,
      COALESCE(SUM(ip.payment_amount * IFNULL(o.vat_rate,0) / (100 + IFNULL(o.vat_rate,0))), 0) AS partial_tax
    FROM invoice_payments ip
    INNER JOIN orders o ON o.id = ip.order_id
    ${partialWhere}
  `, partialParams);

  // المبلغ الآجل المتبقي للفواتير التي سُدِّد جزء منها في الفترة (مستثناة من pmWhere)
  const [[deferredRemainingRow]] = await pool.query(`
    SELECT
      COUNT(DISTINCT o.id) AS cnt,
      COALESCE(SUM(o.remaining_amount), 0) AS total_after_tax,
      COALESCE(SUM(o.remaining_amount * IFNULL(o.vat_rate,0) / (100 + IFNULL(o.vat_rate,0))), 0) AS total_tax
    FROM orders o
    INNER JOIN invoice_payments ip ON ip.order_id = o.id
    WHERE 1=1${ipDateWhere}
      AND o.remaining_amount > 0
      AND COALESCE(o.payment_method,'cash') IN ('credit','deferred')
  `, partialParams);

  // قائمة تفصيلية بكل دفعة من دفعات الفواتير الآجلة (المبلغ المدفوع فقط لكل دفعة)
  const deferredParams = [...params];
  const deferredDateWhere = dateWhere.replace(/\bcreated_at\b/g, 'ip.payment_date');
  const [deferredPayments] = await pool.query(`
    SELECT ip.id AS payment_id, ip.order_id,
           ip.payment_amount, ip.payment_method,
           ip.payment_date AS created_at,
           o.invoice_seq, o.order_number,
           c.customer_name, c.phone
    FROM invoice_payments ip
    INNER JOIN orders o ON o.id = ip.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 1=1${deferredDateWhere}
    ORDER BY ip.payment_date DESC
  `, deferredParams);

  const crDateWhere = dateWhere.replace(/\bcreated_at\b/g, 'cr.created_at');
  const [consumptionReceipts] = await pool.query(`
    SELECT cr.id, cr.receipt_seq, cr.order_id, cr.amount_consumed AS total_amount,
           cr.package_name, cr.balance_before, cr.balance_after, cr.created_at,
           c.customer_name, c.phone
    FROM consumption_receipts cr
    LEFT JOIN customers c ON c.id = cr.customer_id
    WHERE 1=1${crDateWhere}
    ORDER BY cr.id DESC
  `, [...params]);

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
  const partialAfterTax  = Number(partialTotalRow.partial_total);
  const partialTax       = Number(partialTotalRow.partial_tax);
  const partialBeforeTax = Math.round((partialAfterTax - partialTax) * 100) / 100;

  const salesNetBeforeTax = salesBeforeTax - discountTotal;
  const salesNetTax       = salesTax;
  const salesNetAfterTax  = salesAfterTax - discountTotal;

  const totalNetBeforeTax = salesNetBeforeTax - cnBeforeTax;
  const totalNetTax       = salesNetTax - cnTax;
  const totalNetAfterTax  = salesNetAfterTax - cnAfterTax;

  const subAfterTax  = Number(subSummary.sub_total);
  const subTax       = Number(subSummary.sub_vat);
  const subBeforeTax = subAfterTax - subTax;

  const netBeforeTax = totalNetBeforeTax + subBeforeTax - expBeforeTax + partialBeforeTax;
  const netTax       = totalNetTax + subTax - expTax + partialTax;
  const netAfterTax  = totalNetAfterTax + subAfterTax - expAfterTax + partialAfterTax;

  // إشعارات دائنة صدرت في الفترة لفواتير آجلة مدفوعة → لخصم مبالغها من طرق الدفع
  const cnOffsetDateWhere = dateWhere.replace(/\bcreated_at\b/g, 'cn.created_at');
  const [cnPaymentOffsets] = await pool.query(`
    SELECT method,
      COALESCE(SUM(deduct_amount), 0) AS deduct_amount,
      COALESCE(SUM(deduct_tax), 0)    AS deduct_tax
    FROM (
      SELECT ip.payment_method AS method,
        ip.payment_amount AS deduct_amount,
        ip.payment_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)) AS deduct_tax
      FROM credit_notes cn
      INNER JOIN orders o ON o.id = cn.original_order_id
      INNER JOIN invoice_payments ip ON ip.order_id = o.id
      WHERE 1=1${cnOffsetDateWhere} AND ip.payment_method != 'mixed'
      UNION ALL
      SELECT 'cash',
        ip.cash_amount,
        ip.cash_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM credit_notes cn
      INNER JOIN orders o ON o.id = cn.original_order_id
      INNER JOIN invoice_payments ip ON ip.order_id = o.id
      WHERE 1=1${cnOffsetDateWhere} AND ip.payment_method = 'mixed' AND ip.cash_amount > 0
      UNION ALL
      SELECT 'card',
        ip.card_amount,
        ip.card_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM credit_notes cn
      INNER JOIN orders o ON o.id = cn.original_order_id
      INNER JOIN invoice_payments ip ON ip.order_id = o.id
      WHERE 1=1${cnOffsetDateWhere} AND ip.payment_method = 'mixed' AND ip.card_amount > 0
    ) AS cn_offsets
    GROUP BY method
  `, [...params, ...params, ...params]);

  // دمج الدفعات الجزئية مع طرق الدفع
  const pmMap = new Map(paymentMethods.map(r => [r.method, {
    method: r.method, count: Number(r.count),
    totalAfterTax: Number(r.total_after_tax),
    totalBeforeTax: Number(r.total_before_tax),
    totalTax: Number(r.total_tax),
  }]));
  for (const pp of partialByMethod) {
    const m = pp.method || 'cash';
    if (pmMap.has(m)) {
      const ex = pmMap.get(m);
      ex.count += Number(pp.count);
      ex.totalAfterTax  = Math.round((ex.totalAfterTax  + Number(pp.total_after_tax)) * 100) / 100;
      ex.totalTax       = Math.round((ex.totalTax       + Number(pp.total_tax || 0)) * 100) / 100;
      ex.totalBeforeTax = Math.round((ex.totalBeforeTax + Number(pp.total_after_tax) - Number(pp.total_tax || 0)) * 100) / 100;
    } else {
      pmMap.set(m, {
        method: m, count: Number(pp.count),
        totalAfterTax:  Number(pp.total_after_tax),
        totalBeforeTax: Math.round((Number(pp.total_after_tax) - Number(pp.total_tax || 0)) * 100) / 100,
        totalTax:       Number(pp.total_tax || 0),
      });
    }
  }
  // خصم مدفوعات الفواتير الآجلة التي صدرت لها إشعارات دائنة في نفس الفترة
  for (const off of cnPaymentOffsets) {
    const m = off.method || 'cash';
    const deduct = Number(off.deduct_amount || 0);
    const deductTax = Number(off.deduct_tax || 0);
    if (deduct === 0) continue;
    if (pmMap.has(m)) {
      const ex = pmMap.get(m);
      ex.totalAfterTax  = Math.round((ex.totalAfterTax  - deduct) * 100) / 100;
      ex.totalTax       = Math.round((ex.totalTax       - deductTax) * 100) / 100;
      ex.totalBeforeTax = Math.round((ex.totalBeforeTax - (deduct - deductTax)) * 100) / 100;
    }
  }

  // أضف المبلغ الآجل المتبقي إلى بطاقة الفواتير الآجلة
  const drCount = Number(deferredRemainingRow.cnt || 0);
  const drAfterTax = Number(deferredRemainingRow.total_after_tax || 0);
  const drTax = Number(deferredRemainingRow.total_tax || 0);
  const drBeforeTax = Math.round((drAfterTax - drTax) * 100) / 100;
  if (drCount > 0) {
    if (pmMap.has('credit')) {
      const ex = pmMap.get('credit');
      ex.count        += drCount;
      ex.totalAfterTax  = Math.round((ex.totalAfterTax  + drAfterTax)  * 100) / 100;
      ex.totalTax       = Math.round((ex.totalTax       + drTax)       * 100) / 100;
      ex.totalBeforeTax = Math.round((ex.totalBeforeTax + drBeforeTax) * 100) / 100;
    } else {
      pmMap.set('credit', { method: 'credit', count: drCount, totalAfterTax: drAfterTax, totalBeforeTax: drBeforeTax, totalTax: drTax });
    }
  }

  const mergedPaymentMethods = Array.from(pmMap.values()).sort((a, b) => b.totalAfterTax - a.totalAfterTax);

  return {
    summary: {
      sales:           { beforeTax: salesBeforeTax,    tax: salesTax,    afterTax: salesAfterTax },
      discounts:       { beforeTax: discountTotal,     tax: 0,           afterTax: discountTotal },
      salesAfterDisc:  { beforeTax: salesNetBeforeTax, tax: salesNetTax, afterTax: salesNetAfterTax },
      creditNotes:     { beforeTax: cnBeforeTax,       tax: cnTax,       afterTax: cnAfterTax },
      totalNet:        { beforeTax: totalNetBeforeTax, tax: totalNetTax, afterTax: totalNetAfterTax },
      partialPayments: { beforeTax: partialBeforeTax,  tax: partialTax,  afterTax: partialAfterTax },
      subscriptions:   { beforeTax: subBeforeTax,      tax: subTax,      afterTax: subAfterTax },
      expenses:        { beforeTax: expBeforeTax,      tax: expTax,      afterTax: expAfterTax },
      net:             { beforeTax: netBeforeTax,      tax: netTax,      afterTax: netAfterTax },
    },
    paymentMethods: mergedPaymentMethods,
    invoices,
    expenses,
    creditNotes,
    subscriptions,
    deferredPayments,
    consumptionReceipts,
    invoiceCount: Number(ordersSummary.invoice_count),
  };
}

async function getWorkerReportData({ dateFrom = '', dateTo = '', userId = '' } = {}) {
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

  const userWhere = userId ? ' AND created_by = ?' : '';
  const userOrdersWhere = userId ? ' AND o.created_by = ?' : '';
  const userCnWhere = userId ? ' AND cn.created_by = ?' : '';
  const userSubWhere = userId ? ' AND sl.created_by = ?' : '';

  const dateOrdersWhere = dateWhere.replace(/\bcreated_at\b/g, 'o.created_at');
  const invoicesWhere   = `WHERE 1=1${dateOrdersWhere}${userOrdersWhere} AND o.payment_status = 'paid' AND COALESCE(o.payment_method,'cash') NOT IN ('credit','subscription') AND o.order_type NOT IN ('subscription_new','subscription_renewal') AND NOT EXISTS (SELECT 1 FROM invoice_payments ip_ex WHERE ip_ex.order_id = o.id)`;
  // Keep refunded orders in the payment aggregation so refund rows can net out
  // the original invoice's payment method totals.
  const pmWhere         = `WHERE 1=1${dateOrdersWhere}${userOrdersWhere} AND NOT EXISTS (SELECT 1 FROM credit_notes cn_chk WHERE cn_chk.original_order_id = o.id) AND NOT EXISTS (SELECT 1 FROM invoice_payments ip_ex2 WHERE ip_ex2.order_id = o.id)`;
  const invoicesParams  = [...params];
  const pmParams        = [...params];
  if (userId) { invoicesParams.push(userId); pmParams.push(userId); }
  const ipDateWhere   = dateWhere.replace(/created_at/g, 'ip.payment_date');
  const partialWhere  = `WHERE 1=1${ipDateWhere}${userId ? ' AND o.created_by = ?' : ''}`;
  const partialParams = [...params];
  if (userId) partialParams.push(userId);
  const expWhere        = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'expense_date')}${userWhere}`;
  const expParams       = [...params];
  if (userId) expParams.push(userId);
  const cnWhere         = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'cn.created_at')}${userCnWhere} AND cn.original_order_id NOT IN (SELECT order_id FROM consumption_receipts WHERE order_id IS NOT NULL)`;
  const cnParams        = [...params];
  if (userId) cnParams.push(userId);
  const subWhere        = `WHERE 1=1${dateWhere.replace(/\bcreated_at\b/g, 'sl.created_at')}${userSubWhere}`;
  const subParams       = [...params];
  if (userId) subParams.push(userId);

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
    SELECT method, COUNT(*) AS count,
      COALESCE(SUM(total_after_tax), 0)  AS total_after_tax,
      COALESCE(SUM(total_before_tax), 0) AS total_before_tax,
      COALESCE(SUM(total_tax), 0)        AS total_tax
    FROM (
      SELECT COALESCE(o.payment_method,'cash') AS method, 1 AS count,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount ELSE o.total_amount END AS total_after_tax,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount - o.remaining_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
             ELSE o.total_amount - o.vat_amount END AS total_before_tax,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
             ELSE o.vat_amount END AS total_tax
      FROM orders o ${pmWhere} AND COALESCE(o.payment_method,'cash') != 'mixed'
      UNION ALL
      SELECT 'cash', 1,
        o.paid_cash,
        o.paid_cash - o.paid_cash*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)),
        o.paid_cash*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM orders o ${pmWhere} AND o.payment_method = 'mixed' AND (o.paid_cash > 0 OR COALESCE(o.is_refund, 0) = 1)
      UNION ALL
      SELECT 'card', 1,
        o.paid_card,
        o.paid_card - o.paid_card*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)),
        o.paid_card*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM orders o ${pmWhere} AND o.payment_method = 'mixed' AND (o.paid_card > 0 OR COALESCE(o.is_refund, 0) = 1)
    ) AS pm_rows
    GROUP BY method
    ORDER BY total_after_tax DESC
  `, [...pmParams, ...pmParams, ...pmParams]);

  const [invoices] = await pool.query(`
    SELECT o.id, o.invoice_seq, o.order_number, o.subtotal, o.discount_amount,
           o.vat_amount, o.total_amount, o.payment_method, o.created_at, o.created_by,
           c.customer_name, c.phone,
           COALESCE((SELECT usr.full_name FROM users usr WHERE usr.username = CONVERT(o.created_by USING utf8mb4) COLLATE utf8mb4_unicode_ci LIMIT 1), o.created_by) AS cashier_name
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
    SELECT
      COALESCE(SUM(sp.prepaid_price_paid), 0)    AS sub_total,
      COALESCE(SUM(IFNULL(o.vat_amount, 0)), 0)  AS sub_vat
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    LEFT JOIN orders o ON o.id = sp.order_id
    ${subWhere} AND sl.entry_type IN ('purchase', 'renewal')
  `, subParams);

  const [subscriptions] = await pool.query(`
    SELECT c.phone, c.subscription_number, cs.subscription_ref, cs.id AS subscription_id, sp.order_id, sp.prepaid_price_paid AS amount, sl.entry_type, sl.created_at
    FROM subscription_ledger sl
    INNER JOIN subscription_periods sp ON sp.id = sl.subscription_period_id
    INNER JOIN customer_subscriptions cs ON cs.id = sp.customer_subscription_id
    INNER JOIN customers c ON c.id = cs.customer_id
    ${subWhere} AND sl.entry_type IN ('purchase', 'renewal')
    ORDER BY sl.created_at DESC
  `, subParams);

  const [partialByMethod] = await pool.query(`
    SELECT method, COUNT(*) AS count,
      COALESCE(SUM(total_after_tax), 0) AS total_after_tax,
      COALESCE(SUM(total_tax), 0)       AS total_tax
    FROM (
      SELECT ip.payment_method AS method, 1 AS count,
        ip.payment_amount AS total_after_tax,
        ip.payment_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)) AS total_tax
      FROM invoice_payments ip INNER JOIN orders o ON o.id = ip.order_id
      ${partialWhere} AND ip.payment_method != 'mixed'
      UNION ALL
      SELECT 'cash', 1,
        ip.cash_amount,
        ip.cash_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM invoice_payments ip INNER JOIN orders o ON o.id = ip.order_id
      ${partialWhere} AND ip.payment_method = 'mixed' AND ip.cash_amount > 0
      UNION ALL
      SELECT 'card', 1,
        ip.card_amount,
        ip.card_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM invoice_payments ip INNER JOIN orders o ON o.id = ip.order_id
      ${partialWhere} AND ip.payment_method = 'mixed' AND ip.card_amount > 0
    ) AS pb_rows
    GROUP BY method
  `, [...partialParams, ...partialParams, ...partialParams]);

  const [[partialTotalRow]] = await pool.query(`
    SELECT
      COALESCE(SUM(ip.payment_amount), 0) AS partial_total,
      COALESCE(SUM(ip.payment_amount * IFNULL(o.vat_rate,0) / (100 + IFNULL(o.vat_rate,0))), 0) AS partial_tax
    FROM invoice_payments ip
    INNER JOIN orders o ON o.id = ip.order_id
    ${partialWhere}
  `, partialParams);

  const [[deferredRemainingRow]] = await pool.query(`
    SELECT
      COUNT(DISTINCT o.id) AS cnt,
      COALESCE(SUM(o.remaining_amount), 0) AS total_after_tax,
      COALESCE(SUM(o.remaining_amount * IFNULL(o.vat_rate,0) / (100 + IFNULL(o.vat_rate,0))), 0) AS total_tax
    FROM orders o
    INNER JOIN invoice_payments ip ON ip.order_id = o.id
    WHERE 1=1${ipDateWhere}${userId ? ' AND o.created_by = ?' : ''}
      AND o.remaining_amount > 0
      AND COALESCE(o.payment_method,'cash') IN ('credit','deferred')
  `, partialParams);

  const deferredDateWhere = dateWhere.replace(/\bcreated_at\b/g, 'ip.payment_date');
  const [deferredPayments] = await pool.query(`
    SELECT ip.id AS payment_id, ip.order_id,
           ip.payment_amount, ip.payment_method,
           ip.payment_date AS created_at,
           o.invoice_seq, o.order_number,
           c.customer_name, c.phone
    FROM invoice_payments ip
    INNER JOIN orders o ON o.id = ip.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 1=1${deferredDateWhere}${userId ? ' AND o.created_by = ?' : ''}
    ORDER BY ip.payment_date DESC
  `, partialParams);

  const crDateWhere = dateWhere.replace(/\bcreated_at\b/g, 'cr.created_at');
  const crParams = [...params];
  if (userId) crParams.push(userId);
  const [consumptionReceipts] = await pool.query(`
    SELECT cr.id, cr.receipt_seq, cr.order_id, cr.amount_consumed AS total_amount,
           cr.package_name, cr.balance_before, cr.balance_after, cr.created_at,
           c.customer_name, c.phone
    FROM consumption_receipts cr
    LEFT JOIN customers c ON c.id = cr.customer_id
    WHERE 1=1${crDateWhere}${userId ? ' AND cr.created_by = ?' : ''}
    ORDER BY cr.id DESC
  `, crParams);

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

  const partialAfterTax  = Number(partialTotalRow.partial_total);
  const partialTax       = Number(partialTotalRow.partial_tax);
  const partialBeforeTax = Math.round((partialAfterTax - partialTax) * 100) / 100;

  const salesNetBeforeTax = salesBeforeTax - discountTotal;
  const salesNetTax       = salesTax;
  const salesNetAfterTax  = salesAfterTax - discountTotal;

  const totalNetBeforeTax = salesNetBeforeTax - cnBeforeTax;
  const totalNetTax       = salesNetTax - cnTax;
  const totalNetAfterTax  = salesNetAfterTax - cnAfterTax;

  const subAfterTax  = Number(subSummary.sub_total);
  const subTax       = Number(subSummary.sub_vat);
  const subBeforeTax = subAfterTax - subTax;

  const netBeforeTax = totalNetBeforeTax + subBeforeTax - expBeforeTax + partialBeforeTax;
  const netTax       = totalNetTax + subTax - expTax + partialTax;
  const netAfterTax  = totalNetAfterTax + subAfterTax - expAfterTax + partialAfterTax;

  const pmMap = new Map(paymentMethods.map(r => [r.method, {
    method: r.method, count: Number(r.count),
    totalAfterTax: Number(r.total_after_tax),
    totalBeforeTax: Number(r.total_before_tax),
    totalTax: Number(r.total_tax),
  }]));
  for (const pp of partialByMethod) {
    const m = pp.method || 'cash';
    if (pmMap.has(m)) {
      const ex = pmMap.get(m);
      ex.count += Number(pp.count);
      ex.totalAfterTax  = Math.round((ex.totalAfterTax  + Number(pp.total_after_tax)) * 100) / 100;
      ex.totalTax       = Math.round((ex.totalTax       + Number(pp.total_tax || 0)) * 100) / 100;
      ex.totalBeforeTax = Math.round((ex.totalBeforeTax + Number(pp.total_after_tax) - Number(pp.total_tax || 0)) * 100) / 100;
    } else {
      pmMap.set(m, {
        method: m, count: Number(pp.count),
        totalAfterTax:  Number(pp.total_after_tax),
        totalBeforeTax: Math.round((Number(pp.total_after_tax) - Number(pp.total_tax || 0)) * 100) / 100,
        totalTax:       Number(pp.total_tax || 0),
      });
    }
  }
  const drCount = Number(deferredRemainingRow.cnt || 0);
  const drAfterTax = Number(deferredRemainingRow.total_after_tax || 0);
  const drTax = Number(deferredRemainingRow.total_tax || 0);
  const drBeforeTax = Math.round((drAfterTax - drTax) * 100) / 100;
  if (drCount > 0) {
    if (pmMap.has('credit')) {
      const ex = pmMap.get('credit');
      ex.count        += drCount;
      ex.totalAfterTax  = Math.round((ex.totalAfterTax  + drAfterTax)  * 100) / 100;
      ex.totalTax       = Math.round((ex.totalTax       + drTax)       * 100) / 100;
      ex.totalBeforeTax = Math.round((ex.totalBeforeTax + drBeforeTax) * 100) / 100;
    } else {
      pmMap.set('credit', { method: 'credit', count: drCount, totalAfterTax: drAfterTax, totalBeforeTax: drBeforeTax, totalTax: drTax });
    }
  }
  const mergedPaymentMethods = Array.from(pmMap.values()).sort((a, b) => b.totalAfterTax - a.totalAfterTax);

  return {
    summary: {
      sales:           { beforeTax: salesBeforeTax,  tax: salesTax,  afterTax: salesAfterTax },
      discounts:       { beforeTax: discountTotal,   tax: 0,         afterTax: discountTotal },
      salesAfterDisc:  { beforeTax: salesNetBeforeTax, tax: salesNetTax, afterTax: salesNetAfterTax },
      creditNotes:     { beforeTax: cnBeforeTax,     tax: cnTax,     afterTax: cnAfterTax },
      totalNet:        { beforeTax: totalNetBeforeTax, tax: totalNetTax, afterTax: totalNetAfterTax },
      partialPayments: { beforeTax: partialBeforeTax,  tax: partialTax,  afterTax: partialAfterTax },
      subscriptions:   { beforeTax: subBeforeTax,  tax: subTax,    afterTax: subAfterTax },
      expenses:        { beforeTax: expBeforeTax,    tax: expTax,    afterTax: expAfterTax },
      net:             { beforeTax: netBeforeTax,    tax: netTax,    afterTax: netAfterTax },
    },
    paymentMethods: mergedPaymentMethods,
    invoices,
    expenses,
    creditNotes,
    subscriptions,
    deferredPayments,
    consumptionReceipts,
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

  const crDateWhere = dateWhere.replace(/\bo\.created_at\b/g, 'cr.created_at');
  const crCustomerWhere = customerWhere.replace(/\bo\./g, 'cr.').replace(/o\.customer_id/g, 'cr.customer_id').replace(/c\.customer_name/g, 'cust.customer_name').replace(/c\.phone/g, 'cust.phone').replace(/c\.subscription_number/g, 'cust.subscription_number');
  const crParams = [...params];

  const allOrdersWhere  = `WHERE COALESCE(o.is_consumption_only, 0) = 0 AND COALESCE(o.payment_method,'cash') != 'subscription'${dateWhere}${customerWhere}`;
  const cnWhere         = `WHERE 1=1${cnDateWhere}${cnCustomerWhere} AND cn.original_order_id NOT IN (SELECT order_id FROM consumption_receipts WHERE order_id IS NOT NULL)`;

  const [allInvoices] = await pool.query(`
    SELECT o.id, o.invoice_seq, o.order_number,
           o.subtotal, o.discount_amount, o.vat_amount, o.total_amount,
           o.paid_amount, o.remaining_amount,
           o.payment_method, o.payment_status, o.paid_at, o.created_at,
           o.paid_cash, o.paid_card,
           COALESCE(cr.cleaning_date, o.cleaning_date) AS cleaning_date,
           COALESCE(cr.delivery_date, o.delivery_date) AS delivery_date,
           c.customer_name, c.phone, c.subscription_number
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN consumption_receipts cr ON cr.id = o.consumption_receipt_id
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

  const crWhere = `WHERE 1=1${crDateWhere}${crCustomerWhere}`;
  const [consumptionReceipts] = await pool.query(`
    SELECT cr.id, cr.receipt_seq, cr.amount_consumed, cr.balance_before, cr.balance_after,
           cr.created_at, cr.order_id, cr.package_name,
           cust.customer_name, cust.phone, cust.subscription_number,
           ref.id AS refund_id
    FROM consumption_receipts cr
    LEFT JOIN customers cust ON cust.id = cr.customer_id
    LEFT JOIN refunds ref ON ref.consumption_receipt_id = cr.id
    ${crWhere}
    ORDER BY cr.id DESC
  `, crParams);

  // Keep refunded orders in payment-method totals so the refund row can offset
  // the original paid invoice in the same report window.
  const pmBaseWhere = `WHERE 1=1${dateWhere}${customerWhere}`;
  const [paymentMethods] = await pool.query(`
    SELECT method, COUNT(*) AS count,
      COALESCE(SUM(total_after_tax), 0)  AS total_after_tax,
      COALESCE(SUM(total_before_tax), 0) AS total_before_tax,
      COALESCE(SUM(total_tax), 0)        AS total_tax
    FROM (
      SELECT COALESCE(o.payment_method,'cash') AS method, 1 AS count,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount ELSE o.total_amount END AS total_after_tax,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount - o.remaining_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
             ELSE o.total_amount - o.vat_amount END AS total_before_tax,
        CASE WHEN COALESCE(o.payment_method,'cash') IN ('credit','deferred')
             THEN o.remaining_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
             ELSE o.vat_amount END AS total_tax
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      ${pmBaseWhere} AND COALESCE(o.payment_method,'cash') != 'mixed'
      UNION ALL
      SELECT 'cash', 1,
        o.paid_cash,
        o.paid_cash - o.paid_cash*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)),
        o.paid_cash*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      ${pmBaseWhere} AND o.payment_method = 'mixed' AND (o.paid_cash > 0 OR COALESCE(o.is_refund, 0) = 1)
      UNION ALL
      SELECT 'card', 1,
        o.paid_card,
        o.paid_card - o.paid_card*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)),
        o.paid_card*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
      ${pmBaseWhere} AND o.payment_method = 'mixed' AND (o.paid_card > 0 OR COALESCE(o.is_refund, 0) = 1)
    ) AS pm_rows
    GROUP BY method
    ORDER BY total_after_tax DESC
  `, [...params, ...params, ...params]);

  const ipDateWhere = dateWhere.replace(/\bo\.created_at\b/g, 'ip.payment_date');
  const partialBaseWhere = `WHERE 1=1${ipDateWhere}${customerWhere}`;

  const [partialByMethod] = await pool.query(`
    SELECT method, COUNT(*) AS count,
      COALESCE(SUM(total_after_tax), 0) AS total_after_tax,
      COALESCE(SUM(total_tax), 0)       AS total_tax
    FROM (
      SELECT ip.payment_method AS method, 1,
        ip.payment_amount AS total_after_tax,
        ip.payment_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0)) AS total_tax
      FROM invoice_payments ip
      INNER JOIN orders o ON o.id = ip.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ${partialBaseWhere} AND ip.payment_method != 'mixed'
      UNION ALL
      SELECT 'cash', 1,
        ip.cash_amount,
        ip.cash_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM invoice_payments ip
      INNER JOIN orders o ON o.id = ip.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ${partialBaseWhere} AND ip.payment_method = 'mixed' AND ip.cash_amount > 0
      UNION ALL
      SELECT 'card', 1,
        ip.card_amount,
        ip.card_amount*IFNULL(o.vat_rate,0)/(100+IFNULL(o.vat_rate,0))
      FROM invoice_payments ip
      INNER JOIN orders o ON o.id = ip.order_id
      LEFT JOIN customers c ON c.id = o.customer_id
      ${partialBaseWhere} AND ip.payment_method = 'mixed' AND ip.card_amount > 0
    ) AS pb_rows
    GROUP BY method
  `, [...params, ...params, ...params]);


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

  const pmMap = new Map(paymentMethods.map(r => [r.method, {
    method: r.method, count: Number(r.count),
    totalAfterTax: Number(r.total_after_tax),
    totalBeforeTax: Number(r.total_before_tax),
    totalTax: Number(r.total_tax),
  }]));
  for (const pp of partialByMethod) {
    const m = pp.method || 'cash';
    if (pmMap.has(m)) {
      const ex = pmMap.get(m);
      ex.count += Number(pp.count);
      ex.totalAfterTax  = Math.round((ex.totalAfterTax  + Number(pp.total_after_tax)) * 100) / 100;
      ex.totalTax       = Math.round((ex.totalTax       + Number(pp.total_tax || 0)) * 100) / 100;
      ex.totalBeforeTax = Math.round((ex.totalBeforeTax + Number(pp.total_after_tax) - Number(pp.total_tax || 0)) * 100) / 100;
    } else {
      pmMap.set(m, {
        method: m, count: Number(pp.count),
        totalAfterTax:  Number(pp.total_after_tax),
        totalBeforeTax: Math.round((Number(pp.total_after_tax) - Number(pp.total_tax || 0)) * 100) / 100,
        totalTax:       Number(pp.total_tax || 0),
      });
    }
  }
  const mergedPaymentMethods = Array.from(pmMap.values()).sort((a, b) => b.totalAfterTax - a.totalAfterTax);

  return {
    allInvoices,
    paidInvoices,
    deferredInvoices,
    creditNotes,
    consumptionReceipts,
    paymentMethods: mergedPaymentMethods,
    summary: {
      paid:        { count: paidInvoices.length,     beforeTax: paidBeforeTax,     tax: paidTax,     afterTax: paidTotal,     discount: paidDiscount },
      deferred:    { count: deferredInvoices.length, beforeTax: deferredBeforeTax, tax: deferredTax, afterTax: deferredTotal, paidAmount: deferredPaid, remaining: deferredRemaining },
      creditNotes: { count: creditNotes.length,      beforeTax: cnBeforeTax,       tax: cnTax,       afterTax: cnTotal },
      allInvoices: { count: allInvoices.length,      beforeTax: allBeforeTax,      tax: allTax,      afterTax: allTotal },
      net:         { beforeTax: netBeforeTax,        tax: netTax,                  afterTax: netTotal },
    },
  };
}
