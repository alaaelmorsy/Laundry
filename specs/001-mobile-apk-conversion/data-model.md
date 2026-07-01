# Data Model: Flutter Mobile App (SQLite)

**Feature**: تحويل نظام المغاسل إلى تطبيق Flutter موبايل
**Date**: 2026-06-30

## Money Representation

جميع القيم المالية تُخزَّن كـ `INTEGER` (هللات = قرش):
- `99.50 ريال` → `9950` في قاعدة البيانات
- عند العرض: `value / 100.0`
- يتجنب floating point errors تماماً

في drift: `IntColumn` للمبالغ، مع extension للتحويل:
```dart
extension MoneyX on int {
  double get toRiyals => this / 100.0;
  String get display => toRiyals.toStringAsFixed(2);
}
```

---

## Core Tables

### app_settings
```sql
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  shop_name TEXT NOT NULL DEFAULT '',
  vat_number TEXT,
  vat_rate INTEGER NOT NULL DEFAULT 1500,  -- 15.00% × 100
  price_display_mode TEXT NOT NULL DEFAULT 'inclusive',
  currency TEXT NOT NULL DEFAULT 'SAR',
  logo_image BLOB,  -- gzip compressed
  print_copies INTEGER NOT NULL DEFAULT 1,
  zatca_enabled INTEGER NOT NULL DEFAULT 0,
  zatca_mode TEXT DEFAULT 'simulation',
  zatca_certificate TEXT,
  zatca_private_key TEXT,
  zatca_device_serial TEXT,
  zatca_pih TEXT,
  daily_report_email TEXT,
  invoice_footer TEXT,
  loyalty_enabled INTEGER NOT NULL DEFAULT 0,
  loyalty_points_per_riyal INTEGER NOT NULL DEFAULT 0,
  loyalty_riyal_per_point INTEGER NOT NULL DEFAULT 0
);
```

### users
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### roles
```sql
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### role_permissions
```sql
CREATE TABLE role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  permission TEXT NOT NULL,
  UNIQUE(role_id, permission)
);
```

### customers
```sql
CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  customer_type TEXT NOT NULL DEFAULT 'individual',  -- individual / corporate
  company_name TEXT,
  address TEXT,
  notes TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_type ON customers(customer_type);
```

### products
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  price INTEGER NOT NULL DEFAULT 0,  -- cents
  category TEXT,
  image_data BLOB,  -- gzip compressed
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### laundry_services
```sql
CREATE TABLE laundry_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_en TEXT,
  price INTEGER NOT NULL DEFAULT 0,  -- cents
  service_type TEXT DEFAULT 'standard',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### prepaid_packages
```sql
CREATE TABLE prepaid_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,  -- cents
  credit_amount INTEGER NOT NULL DEFAULT 0,  -- cents
  validity_days INTEGER NOT NULL DEFAULT 30,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  package_id INTEGER REFERENCES prepaid_packages(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id)  -- اشتراك واحد لكل عميل
);
```

### subscription_periods
```sql
CREATE TABLE subscription_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  credit_amount INTEGER NOT NULL DEFAULT 0,   -- cents (الرصيد الأصلي)
  credit_remaining INTEGER NOT NULL DEFAULT 0, -- cents (الرصيد المتبقي ≥ 0)
  status TEXT NOT NULL DEFAULT 'active',       -- active / expired
  order_id INTEGER REFERENCES orders(id),      -- فاتورة الشراء
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(credit_remaining >= 0)  -- لا يقل عن صفر أبداً
);
CREATE INDEX idx_subscription_periods_sub_id ON subscription_periods(subscription_id);
```

### orders
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_seq INTEGER NOT NULL UNIQUE,     -- رقم الفاتورة التسلسلي
  order_number TEXT NOT NULL UNIQUE,       -- رقم الطلب
  customer_id INTEGER REFERENCES customers(id),
  order_type TEXT NOT NULL DEFAULT 'pos',  -- pos / subscription / deferred
  payment_method TEXT NOT NULL DEFAULT 'cash',  -- cash / card / mixed / deferred / subscription
  payment_status TEXT NOT NULL DEFAULT 'paid',  -- paid / pending
  subtotal INTEGER NOT NULL DEFAULT 0,     -- cents
  discount INTEGER NOT NULL DEFAULT 0,     -- cents
  vat_amount INTEGER NOT NULL DEFAULT 0,   -- cents
  total_amount INTEGER NOT NULL DEFAULT 0, -- cents (= subtotal - discount + vat_amount)
  paid_cash INTEGER NOT NULL DEFAULT 0,    -- cents
  paid_card INTEGER NOT NULL DEFAULT 0,    -- cents
  paid_amount INTEGER NOT NULL DEFAULT 0,  -- cents
  price_display_mode TEXT NOT NULL DEFAULT 'inclusive',
  vat_rate INTEGER NOT NULL DEFAULT 1500,  -- 15.00% × 100
  notes TEXT,
  cashier_id INTEGER REFERENCES users(id),
  -- ZATCA fields
  zatca_status TEXT NOT NULL DEFAULT 'pending',  -- pending / submitted / failed / exempt
  zatca_hash TEXT,
  zatca_uuid TEXT,
  zatca_qr TEXT,
  zatca_signed_invoice TEXT,
  zatca_clearance_status TEXT,
  zatca_response TEXT,
  zatca_submitted_at TEXT,
  zatca_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_invoice_seq ON orders(invoice_seq);
CREATE INDEX idx_orders_zatca_status ON orders(zatca_status);
CREATE INDEX idx_orders_payment_method ON orders(payment_method);
```

### order_items
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  item_type TEXT NOT NULL,         -- product / service
  item_id INTEGER,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL DEFAULT 0,  -- cents
  total_price INTEGER NOT NULL DEFAULT 0, -- cents
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

### credit_notes
```sql
CREATE TABLE credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  customer_id INTEGER REFERENCES customers(id),
  amount INTEGER NOT NULL DEFAULT 0,       -- cents
  remaining_amount INTEGER NOT NULL DEFAULT 0, -- cents
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / settled / partial
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### refunds
```sql
CREATE TABLE refunds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  amount INTEGER NOT NULL DEFAULT 0,    -- cents
  reason TEXT,
  refund_method TEXT NOT NULL DEFAULT 'cash',
  cashier_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### consumption_receipts
```sql
CREATE TABLE consumption_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_period_id INTEGER NOT NULL REFERENCES subscription_periods(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount_used INTEGER NOT NULL DEFAULT 0,  -- cents
  notes TEXT,
  cashier_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### subscription_receipts
```sql
CREATE TABLE subscription_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_period_id INTEGER NOT NULL REFERENCES subscription_periods(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### loyalty_points
```sql
CREATE TABLE loyalty_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  points INTEGER NOT NULL DEFAULT 0,  -- موجب للكسب، سالب للاستهلاك
  operation_type TEXT NOT NULL,       -- earn / redeem
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_loyalty_customer_id ON loyalty_points(customer_id);
```

### expenses
```sql
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,  -- cents
  category TEXT,
  expense_date TEXT NOT NULL,
  cashier_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
```

### offers
```sql
CREATE TABLE offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage',  -- percentage / fixed
  discount_value INTEGER NOT NULL DEFAULT 0,         -- % × 100 أو cents
  min_order_amount INTEGER DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### hangers
```sql
CREATE TABLE hangers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'available',  -- available / in_use
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### customer_custom_prices
```sql
CREATE TABLE customer_custom_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  item_type TEXT NOT NULL,   -- product / service
  item_id INTEGER NOT NULL,
  custom_price INTEGER NOT NULL DEFAULT 0,  -- cents
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, item_type, item_id)
);
```

### accounts
```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT,
  mac_address TEXT,
  disk_serial TEXT,
  board_serial TEXT,
  is_trial INTEGER NOT NULL DEFAULT 1,
  trial_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### license
```sql
CREATE TABLE license (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### zatca_queue (جدول جديد)
```sql
CREATE TABLE zatca_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) UNIQUE,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / processing / done / failed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_zatca_queue_status ON zatca_queue(status);
```

---

## State Transitions

### Order Payment Status
```
created → paid (cash/card)
created → pending (deferred)
pending → paid (settled via credit_notes)
```

### Subscription Period Status
```
active → expired (balance=0 OR end_date passed)
```

### ZATCA Status
```
pending → submitted (نجح الإرسال)
pending → failed (فشل مؤقت) → retry → submitted
pending → exempt (فاتورة معفاة)
```

### ZATCA Queue Status
```
pending → processing → done (نجح)
processing → pending (retry بعد فشل)
processing → failed (تجاوز عدد المحاولات)
```

---

## Entity Relationships

```
customers ←── subscriptions ←── subscription_periods
     │                                    │
     └──────────────── orders ────────────┘
                          │
                    order_items
                          │
                    zatca_queue
```
