<div align="center">

# 🧺 PLUS Laundry — نظام نقاط بيع لمحلات التنظيف الجاف

<p>
  <img src="https://img.shields.io/badge/version-1.0.27-blue?style=flat-square" alt="version"/>
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white" alt="node"/>
  <img src="https://img.shields.io/badge/MySQL-5.7%2B-4479A1?style=flat-square&logo=mysql&logoColor=white" alt="mysql"/>
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4?style=flat-square&logo=windows&logoColor=white" alt="platform"/>
  <img src="https://img.shields.io/badge/ZATCA-Phase%201-2ea44f?style=flat-square" alt="zatca"/>
  <img src="https://img.shields.io/github/actions/workflow/status/alaaelmorsy/Laundry/release.yml?style=flat-square&label=CI%2FCD" alt="ci"/>
</p>

**نظام متكامل لإدارة محلات التنظيف الجاف**
فواتير · اشتراكات · تقارير · ZATCA · واتساب · تحديث ذاتي

</div>

---

## ✨ المميزات

| المجال | التفاصيل |
|--------|---------|
| 🧾 **نقطة البيع (POS)** | فواتير فورية، دفع مختلط (نقد + بطاقة)، فواتير آجلة |
| 📦 **الاشتراكات** | باقات مسبقة الدفع، تتبع الرصيد، استهلاك تلقائي |
| 🔁 **المرتجعات** | استرداد كامل أو جزئي مع تحديث أرصدة الاشتراكات |
| 🖨️ **الطباعة** | حرارية 80mm + A4، رمز QR لـ ZATCA، نسخ متعددة |
| 📊 **التقارير** | يومي · دوري · عمال · اشتراكات · زكاة · ضريبي |
| 🟢 **ZATCA** | توافق الفوترة الإلكترونية المرحلة الأولى (Phase 1) |
| 💬 **واتساب** | إرسال الإيصالات تلقائياً عبر Baileys |
| 💰 **نقاط الولاء** | نظام كسب واسترداد مرتبط بالفواتير |
| 🏷️ **أسعار مخصصة** | أسعار خاصة لكل عميل على مستوى الخدمات والمنتجات |
| 🔒 **الصلاحيات** | نظام أدوار (Admin / Cashier) مع حماية JWT |
| 🔄 **تحديث ذاتي** | تحديث تلقائي عبر GitHub Releases بدون تدخل يدوي |
| 🖥️ **Windows Service** | يعمل كخدمة ويندوز دائمة عبر NSSM |

---

## 🛠️ التقنية المستخدمة

| الطبقة | التقنية |
|--------|---------|
| **Backend** | Node.js 20 · Express.js · CommonJS |
| **Database** | MySQL 5.7+ · `mysql2/promise` · بدون ORM |
| **Frontend** | Vanilla JS · Tailwind CSS · بدون framework |
| **Build** | `@yao-pkg/pkg` → `.exe` · Inno Setup → installer |
| **Deployment** | Windows Service (NSSM) · HTTPS محلي (mkcert) |
| **External** | ZATCA API · WhatsApp (Baileys) · Gmail SMTP |
| **CI/CD** | GitHub Actions (windows-latest) → GitHub Releases |

---

## 📁 هيكل المشروع

```
├── server/
│   ├── index.js              ← نقطة الدخول: Express + cron + ZATCA
│   ├── invokeHandlers.js     ← كل منطق API في switch واحد
│   ├── middleware/auth.js    ← JWT + authMiddleware
│   └── services/             ← ZATCA · WhatsApp · Update · Email · Export
├── database/
│   └── db.js                 ← pool MySQL + جميع الدوال + الـ migrations
├── assets/
│   └── web-api.js            ← window.api (المتصفح → /api/invoke)
├── screens/
│   ├── pos/                  ← نقطة البيع
│   ├── invoices/             ← الفواتير
│   ├── customers/            ← إدارة العملاء
│   ├── subscriptions/        ← الاشتراكات
│   ├── reports/              ← كل التقارير
│   └── …
├── scripts/                  ← PowerShell: updater · installer · NSSM
├── installer/laundry.iss     ← Inno Setup script
├── release/                  ← laundry-app.exe (للتحديث التلقائي)
└── specs/                    ← توثيق الـ features (Spec Kit)
```

---

## ⚡ البدء السريع (تطوير)

### المتطلبات

- Node.js 20+
- MySQL 5.7 أو أحدث (XAMPP / WAMP / MySQL Server)
- Windows 10/11

### الإعداد

```bash
# 1. استنسخ المستودع
git clone https://github.com/alaaelmorsy/Laundry.git
cd Laundry

# 2. ثبّت الحزم
npm install

# 3. انسخ ملف البيئة وعدّله
copy .env.example .env

# 4. شغّل الخادم
npm start
```

افتح المتصفح على: `http://localhost:3000`

---

## 🔨 البناء والإصدار

```bash
npm run build           # بناء كامل: exe + installer
npm run build:css       # Tailwind CSS
npm run watch:css       # Tailwind في وضع المراقبة
npm run build:installer # installer فقط (Inno Setup)
```

| الأداة | الناتج |
|--------|--------|
| `@yao-pkg/pkg` | `release/laundry-app.exe` |
| Inno Setup | `dist/Laundry-PLUS-Setup-vX.X.X.exe` |

---

## 🚀 CI/CD

كل push على `main` يُشغّل pipeline تلقائي:

```
GitHub Actions (windows-latest)
  ├── قراءة الإصدار من package.json
  ├── التحقق من وجود Release بنفس الإصدار (لتجنب التكرار)
  ├── بناء laundry-app-vX.X.X.exe  ←  pkg
  ├── بناء Laundry-PLUS-Setup-vX.X.X.exe  ←  Inno Setup
  ├── توليد SHA256 checksums
  └── رفع GitHub Release + الملفات الثلاثة
```

أجهزة العملاء تتحقق من GitHub Releases كل 6 ساعات وتُحدَّث تلقائياً.

---

## 🏗️ معمارية API

```
window.api.methodName(payload)
  → POST /api/invoke  { method, payload }
    → server/invokeHandlers.js  switch(method)
      → database/db.js  namedFunction()
        → MySQL
```

**الاستجابة دائماً بأحد الشكلين:**
```js
{ success: true,  ...data }
{ success: false, message: 'رسالة خطأ بالعربي' }
```

كل method جديدة تتبع **4 خطوات إلزامية:**

| # | الملف | العملية |
|---|-------|---------|
| 1 | `database/db.js` | إضافة دالة query |
| 2 | `server/invokeHandlers.js` | إضافة `case` في الـ switch |
| 3 | `assets/web-api.js` | تسجيل في `window.api` |
| 4 | ملف الشاشة JS | استدعاء `window.api.methodName()` |

---

## 📋 متطلبات ملف `.env`

```env
PORT=3000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_password
DB_PORT=3306
DB_NAME=laundry_db
JWT_SECRET=your_jwt_secret_min_16_chars
```

---

## 📜 التوثيق

| الملف | المحتوى |
|-------|---------|
| [CLAUDE.md](CLAUDE.md) | دليل الـ AI agent اليومي (قواعد الكود) |
| [PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md) | الدستور الكامل: معمارية، أنماط، محظورات |
| [CONTRIBUTING.md](CONTRIBUTING.md) | دليل المساهمة وسير العمل |
| [SECURITY.md](SECURITY.md) | سياسة الأمان والإبلاغ عن الثغرات |
| [specs/](specs/) | توثيق الـ features (Spec Kit) |

---

## 🔐 الأمان

- تحقق الترخيص: Serial القرص + MAC + Serial اللوحة الأم
- JWT في `httpOnly` cookie (7 أيام)
- كلمات المرور مشفرة بـ bcrypt (10 rounds)
- Rate limiting على تسجيل الدخول: 50 طلب / 15 دقيقة
- للإبلاغ عن ثغرة: راجع [SECURITY.md](SECURITY.md)

---

<div align="center">
  <sub>صُنع بـ ❤️ لخدمة محلات التنظيف الجاف في المملكة العربية السعودية 🇸🇦</sub>
</div>
