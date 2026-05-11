# خطة تنفيذ فاتورة A4 الاحترافية

## 1. الهدف

عند اختيار المستخدم من شاشة الإعدادات نوع الفاتورة **A4** بدل **Thermal (حراري)**،
يجب أن تُطبع الفاتورة على ورق مقاس **A4 (210mm × 297mm)** بتصميم احترافي مؤسسي
مع:

- **ترويسة (Header) موحّدة**: معلومات المغسلة عربي يميناً، شعار في الوسط، معلومات المغسلة إنجليزي يساراً.
- **بيانات الفاتورة الكاملة** (كل حقل موجود حالياً في الفاتورة الحرارية + حقول إضافية مناسبة لمقاس A4).
- **تخطيط احترافي** مستوحى من أنظمة ERP الكبرى (SAP / Odoo / Zoho Invoice).
- **توافق كامل مع RTL/LTR** باستخدام نفس محرك `window.I18N` الموجود.

---

## 2. الوضع الحالي (ملخص سريع)

| الملف | الدور |
|---|---|
| [./screens/settings/settings.html](./screens/settings/settings.html) | يحتوي `<select id="invoicePaperType">` بخيارات `thermal` و `a4` (سطر 1127). |
| [./screens/settings/settings.js](./screens/settings/settings.js) | يحفظ/يحمل `invoicePaperType` في `app_settings` (سطور 43 / 155 / 251). |
| [./screens/pos/pos.html](./screens/pos/pos.html) | يحتوي مودال `#invoiceModal` > `.inv-paper` (سطر 586). |
| [./screens/pos/pos.css](./screens/pos/pos.css) | يحتوي `@media print` بعرض ثابت `80mm` (سطر 2234). |
| [./screens/pos/pos.js](./screens/pos/pos.js) | دالة `showInvoiceModal()` (سطر 1118) تعبئ المودال. |
| [./screens/invoices/invoices.js](./screens/invoices/invoices.js) | دالة `renderInvoiceModal()` (سطر 317) + زر طباعة (سطر 531). |
| [./database/db.js](./database/db.js) | جدول `app_settings` (سطر 1849) يحوي حقول الشركة (عربي/إنجليزي). |

الخلاصة: الفاتورة الحالية **واحدة ثابتة بتصميم حراري**. المطلوب: جعلها **ديناميكية حسب `invoicePaperType`**
بدون كسر الحراري.

---

## 3. استراتيجية التنفيذ (High-level)

الاعتماد على **CSS Class Toggle**:

- نُضيف كلاس `.inv-a4` أو `.inv-thermal` على عنصر `#invoiceModal` (والجسم `<body>` عند الطباعة) بناءً على الإعداد.
- ننشئ **قالب A4 جديد** كـ `<div id="invoicePaperA4">` مستقل عن `.inv-paper` الحراري، ويعاد استخدامه بنفس الـ IDs للبيانات قدر الإمكان، أو عبر كلاسات (`[data-field="invOrderNum"]`).
- دالة التعبئة `showInvoiceModal` / `renderInvoiceModal` تعبّئ **كليهما** (الحراري + A4) ثم نُظهر واحداً فقط بالـ CSS.
- `@media print` تُغيّر المقاس والهامش بناءً على كلاس الـ body.

**ميزة هذا النهج**: لا حاجة لإعادة كتابة منطق الحسابات أو تغيير قاعدة البيانات، فقط إضافة قالب وأنماط.

---

## 4. تصميم فاتورة A4 (Visual Design)

### 4.1 نظام الألوان (Professional Palette)

| الغرض | القيمة HEX | الاستخدام |
|---|---|---|
| Primary (Brand) | `#0F4C81` | الترويسة، عنوان "فاتورة ضريبية"، إطار الإجمالي |
| Primary Dark | `#0A3A66` | Footer band، الحدود السميكة |
| Accent Gold | `#C9A961` | خط فاصل أنيق تحت الترويسة |
| Neutral 900 | `#0F172A` | النص الرئيسي |
| Neutral 600 | `#475569` | الليبلز الثانوية |
| Neutral 400 | `#94A3B8` | النصوص المساعدة |
| Neutral 200 | `#E2E8F0` | حدود الجداول، الخطوط الفاصلة |
| Neutral 50  | `#F8FAFC` | خلفيات خفيفة (Header row، Total box) |
| Success     | `#16A34A` | حالة "مدفوع" |
| Warning     | `#D97706` | حالة "آجل/جزئي" |
| Danger      | `#DC2626` | قيمة الخصم، حالة "غير مدفوع" |
| Paper       | `#FFFFFF` | خلفية الورقة |

### 4.2 الطباعة (Typography)

- الخطوط موجودة في `./assets/fonts/` — يُعاد استخدام نفس الخطوط (Cairo للعربي، Inter أو Roboto للإنجليزي).
- مقاسات:
  - عنوان الشركة: `22pt` Bold.
  - Tagline / فرعي: `10pt` Regular.
  - عناوين الأقسام: `12pt` SemiBold.
  - جسم الجدول: `10pt`.
  - Footer: `9pt`.
- استخدام `font-feature-settings: "tnum"` لأرقام متساوية العرض في الإجماليات.

### 4.3 التخطيط العام (Layout 210×297mm)

```
┌─────────────────────────────────────────────────────────────────┐
│ [ترويسة مزدوجة اللغة]   هامش 10mm من كل جانب                  │
│ ┌─────────────┬───────────┬─────────────┐                      │
│ │ عربي يميناً │  شعار وسط │ إنجليزي يسار│  (ارتفاع ~35mm)     │
│ │ اسم المغسلة │   (Logo)  │ Laundry Name│                      │
│ │ العنوان     │           │ Address     │                      │
│ │ جوال/بريد   │           │ Phone/Email │                      │
│ │ ر.ض / س.ت   │           │ VAT / CR    │                      │
│ └─────────────┴───────────┴─────────────┘                      │
│   خط ذهبي رفيع #C9A961                                         │
├─────────────────────────────────────────────────────────────────┤
│  شريط Primary بعنوان "فاتورة ضريبية مبسطة / Simplified Tax Invoice" │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────── Meta Grid (3 أعمدة) ─────────────┐              │
│ │ رقم الفاتورة     │ التاريخ      │ طريقة الدفع │              │
│ │ INV-000123       │ 18/04/2026   │ نقدي        │              │
│ └─────────────────────────────────────────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ معلومات العميل (Bill To) ─┬─ معلومات الطلب ─┐              │
│ │ الاسم / Name                │ تاريخ الاستلام   │              │
│ │ الجوال / Mobile             │ تاريخ التسليم    │              │
│ │ رقم العميل / ID             │ تاريخ التنظيف    │              │
│ └─────────────────────────────┴──────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│ جدول الأصناف (4 أعمدة):                                        │
│ # │ النوع (Product AR/EN) │ العملية (Service) │ الكمية │ السعر │ الإجمالي │
│ ──┼──────────────────────┼───────────────────┼────────┼────────┼──────────│
│ 1 │ ثوب رجالي / Thobe    │ غسيل وكي          │ 2      │ 15.00  │ 30.00    │
│ 2 │ بدلة / Suit          │ جاف                │ 1      │ 40.00  │ 40.00    │
├─────────────────────────────────────────────────────────────────┤
│ ┌─ QR + ملاحظات ──────────┬─ صندوق الإجماليات ──┐              │
│ │  [QR Code ZATCA 35×35mm]│ المجموع قبل الضريبة  │              │
│ │  ملاحظات / شروط          │ الخصم                │              │
│ │                          │ ضريبة القيمة المضافة │              │
│ │                          │ ════════════════════ │              │
│ │                          │ الإجمالي شامل الضريبة│ (Primary)   │
│ └─────────────────────────┴──────────────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  Footer band Primary Dark: شكراً — بريد/موقع — رقم الصفحة     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 تفاصيل مكوّنات التصميم

#### أ) الترويسة المزدوجة (Bilingual Header)

- Grid CSS بثلاثة أعمدة: `1fr 140px 1fr`.
- العمود الأيمن: `direction: rtl; text-align: right;` ويحوي:
  `laundryNameAr` — `locationAr` — `phone` — `vatNumber` — `commercialRegister`.
- العمود الأيسر: `direction: ltr; text-align: left;` ويحوي:
  `laundryNameEn` — `locationEn` — `email` — `VAT No` — `CR No`.
- العمود الأوسط: `<img id="invA4Logo">` بأقصى ارتفاع `80px` وعرض `auto`.
- تحت الترويسة: خط ذهبي `linear-gradient(90deg, transparent, #C9A961, transparent)` بسمك 2px.

> **ملاحظة مهمة لتوافق RTL**: الترويسة **ثابتة التخطيط** بغض النظر عن لغة الواجهة. العربي دائماً يميناً والإنجليزي دائماً يساراً. نستخدم `direction` على كل عمود مستقل وليس الصفحة ككل. هذا يضمن عدم انعكاس الترويسة عند تبديل لغة الواجهة.

#### ب) شريط العنوان (Title Band)

```
┌─────────────────────────────────────────────────────┐
│ فاتورة ضريبية مبسطة   •   Simplified Tax Invoice   │
└─────────────────────────────────────────────────────┘
```
خلفية `#0F4C81`، نص أبيض، ارتفاع `14mm`.

#### ج) شبكة البيانات الوصفية (Meta Grid)

3 أعمدة متساوية، كل خلية بليبل صغير (Neutral-600) وقيمة كبيرة (Neutral-900).
حدود `1px solid #E2E8F0`. تشمل: رقم الفاتورة، التاريخ، طريقة الدفع، تاريخ السداد، تاريخ التنظيف، تاريخ التسليم.

#### د) كتلة بيانات العميل والطلب

قسم مزدوج بعمودين `1fr 1fr`، خلفية `#F8FAFC`، زوايا مدوّرة `4px`.

#### هـ) جدول الأصناف (Items Table)

- رأس الجدول: خلفية `#0F4C81`، نص أبيض، ارتفاع `10mm`.
- صفوف متناوبة: أبيض / `#F8FAFC` (Zebra).
- أعمدة جديدة مقارنة بالحراري: **#** (رقم متسلسل) + **سعر الوحدة**.
- المحاذاة: نصوص → بداية السطر، أرقام → `dir="ltr"` ومحاذاة نهاية السطر.
- حدود سفلية فقط بلون `#E2E8F0` لكل صف.

#### و) صندوق الإجماليات (Totals Box)

- عرض `45%` من الصفحة، يوضع في نهاية اللغة (يسار للعربي بما أن الجدول RTL).
- صفوف: المجموع قبل الضريبة — الخصم — الضريبة — **الإجمالي شامل الضريبة**.
- صف الإجمالي الأخير: خلفية `#0F4C81`، نص أبيض، حجم `14pt` Bold.

#### ز) كتلة QR + الملاحظات

- يسار الصندوق: QR Code ZATCA بحجم `35mm × 35mm` مع تسمية "امسح للتحقق / Scan to verify".
- تحت QR: شروط وملاحظات اختيارية (يمكن إضافة حقل `invoiceNotes` لاحقاً).

#### ح) الـ Footer Band

شريط أسفل الصفحة بخلفية `#0A3A66`، نص أبيض، ارتفاع `10mm`.
المحتوى: "شكراً لثقتكم / Thank you for your business — email — 1/1".

---

## 5. التغييرات التفصيلية على الملفات

### 5.1 [./screens/pos/pos.html](./screens/pos/pos.html)

**إضافة قالب A4 داخل `#invoiceModal`** بعد `.inv-paper` الموجود (السطر 715):

```html
<!-- ===== A4 INVOICE TEMPLATE ===== -->
<div class="inv-a4-paper" id="invoicePaperA4">

  <!-- Bilingual Header -->
  <header class="a4-header">
    <div class="a4-header-ar" dir="rtl">
      <div class="a4-brand-name" id="a4ShopNameAr"></div>
      <div class="a4-brand-sub"  id="a4ShopAddressAr"></div>
      <div class="a4-brand-sub"  id="a4ShopPhoneAr"></div>
      <div class="a4-brand-sub"  id="a4VatAr"></div>
      <div class="a4-brand-sub"  id="a4CrAr"></div>
    </div>
    <div class="a4-header-logo">
      <img id="a4Logo" alt="Logo" />
    </div>
    <div class="a4-header-en" dir="ltr">
      <div class="a4-brand-name" id="a4ShopNameEn"></div>
      <div class="a4-brand-sub"  id="a4ShopAddressEn"></div>
      <div class="a4-brand-sub"  id="a4ShopEmail"></div>
      <div class="a4-brand-sub"  id="a4VatEn"></div>
      <div class="a4-brand-sub"  id="a4CrEn"></div>
    </div>
  </header>
  <div class="a4-gold-rule"></div>

  <!-- Title Band -->
  <div class="a4-title-band">
    <span>فاتورة ضريبية مبسطة</span>
    <span class="a4-title-sep">•</span>
    <span>Simplified Tax Invoice</span>
  </div>

  <!-- Meta Grid -->
  <section class="a4-meta-grid">
    <div class="a4-meta-cell">
      <div class="a4-meta-lbl">رقم الفاتورة / Invoice #</div>
      <div class="a4-meta-val" id="a4OrderNum" dir="ltr"></div>
    </div>
    <div class="a4-meta-cell">
      <div class="a4-meta-lbl">التاريخ / Date</div>
      <div class="a4-meta-val" id="a4Date" dir="ltr"></div>
    </div>
    <div class="a4-meta-cell">
      <div class="a4-meta-lbl">طريقة الدفع / Payment</div>
      <div class="a4-meta-val" id="a4Payment"></div>
    </div>
  </section>

  <!-- Customer / Order dates -->
  <section class="a4-bill-to">
    <div class="a4-card">
      <div class="a4-card-title">بيانات العميل / Bill To</div>
      <div class="a4-kv"><span>الاسم / Name</span><b id="a4CustName"></b></div>
      <div class="a4-kv"><span>الجوال / Mobile</span><b id="a4CustPhone" dir="ltr"></b></div>
    </div>
    <div class="a4-card">
      <div class="a4-card-title">بيانات الطلب / Order</div>
      <div class="a4-kv" id="a4RowCleanedAt"><span>تاريخ التنظيف</span><b id="a4CleanedAt" dir="ltr"></b></div>
      <div class="a4-kv" id="a4RowDeliveredAt"><span>تاريخ التسليم</span><b id="a4DeliveredAt" dir="ltr"></b></div>
      <div class="a4-kv" id="a4RowPaidAt"><span>تاريخ السداد</span><b id="a4PaidAt" dir="ltr"></b></div>
    </div>
  </section>

  <!-- Items Table -->
  <table class="a4-items">
    <thead>
      <tr>
        <th class="w-num">#</th>
        <th>النوع / Item</th>
        <th>العملية / Service</th>
        <th class="w-num">الكمية / Qty</th>
        <th class="w-num">السعر / Price</th>
        <th class="w-num">الإجمالي / Total</th>
      </tr>
    </thead>
    <tbody id="a4ItemsTbody"></tbody>
  </table>

  <!-- QR + Totals -->
  <section class="a4-summary">
    <div class="a4-qr-box">
      <div id="a4QR" class="a4-qr"></div>
      <div class="a4-qr-label">امسح للتحقق / Scan to verify</div>
    </div>
    <div class="a4-totals">
      <div class="a4-trow"><span>المجموع قبل الضريبة</span><b id="a4Subtotal" dir="ltr"></b></div>
      <div class="a4-trow" id="a4DiscRow"><span>الخصم</span><b id="a4Discount" class="neg" dir="ltr"></b></div>
      <div class="a4-trow"><span id="a4VatLabel">ضريبة القيمة المضافة 15%</span><b id="a4Vat" dir="ltr"></b></div>
      <div class="a4-trow a4-grand"><span>الإجمالي شامل الضريبة</span><b id="a4Total" dir="ltr"></b></div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="a4-footer">
    <span>شكراً لثقتكم بنا</span>
    <span id="a4FooterEmail"></span>
    <span>Thank you for your business</span>
  </footer>

</div><!-- /inv-a4-paper -->
```

### 5.2 [./screens/pos/pos.css](./screens/pos/pos.css)

**(أ) إخفاء/إظهار حسب نوع الفاتورة** — يضاف قبل `@media print`:

```css
/* default: thermal visible, A4 hidden */
#invoicePaperA4 { display: none; }

/* when A4 selected: show A4, hide thermal */
body.invtype-a4 .inv-paper { display: none; }
body.invtype-a4 #invoicePaperA4 { display: block; }
```

**(ب) أنماط A4**:

```css
.inv-a4-paper {
  width: 210mm;
  min-height: 297mm;
  padding: 10mm 10mm 14mm;
  margin: 0 auto;
  background: #fff;
  color: #0F172A;
  font-family: 'Cairo', 'Inter', sans-serif;
  font-size: 10pt;
  line-height: 1.45;
  box-sizing: border-box;
  position: relative;
}

/* ===== Header ===== */
.a4-header {
  display: grid;
  grid-template-columns: 1fr 140px 1fr;
  gap: 12mm;
  align-items: center;
  padding-bottom: 6mm;
}
.a4-header-ar { text-align: right; }
.a4-header-en { text-align: left; }
.a4-header-logo { display: flex; justify-content: center; }
.a4-header-logo img { max-height: 80px; max-width: 130px; object-fit: contain; }
.a4-brand-name { font-size: 18pt; font-weight: 700; color: #0F4C81; margin-bottom: 2mm; }
.a4-brand-sub  { font-size: 9.5pt; color: #475569; margin-bottom: 0.8mm; }

.a4-gold-rule {
  height: 2px;
  background: linear-gradient(90deg, transparent, #C9A961 20%, #C9A961 80%, transparent);
  margin-bottom: 5mm;
}

/* ===== Title Band ===== */
.a4-title-band {
  background: #0F4C81;
  color: #fff;
  text-align: center;
  padding: 4mm;
  font-size: 13pt;
  font-weight: 700;
  letter-spacing: 0.5px;
  border-radius: 3px;
  display: flex; justify-content: center; gap: 8mm;
}
.a4-title-sep { color: #C9A961; }

/* ===== Meta Grid ===== */
.a4-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  margin: 5mm 0;
  border: 1px solid #E2E8F0;
  border-radius: 4px;
  overflow: hidden;
}
.a4-meta-cell { padding: 3mm 4mm; border-right: 1px solid #E2E8F0; background: #F8FAFC; }
.a4-meta-cell:last-child { border-right: none; }
.a4-meta-lbl { color: #475569; font-size: 8.5pt; margin-bottom: 1mm; }
.a4-meta-val { color: #0F172A; font-size: 11pt; font-weight: 600; }

/* ===== Bill To ===== */
.a4-bill-to { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 5mm; }
.a4-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px; padding: 4mm; }
.a4-card-title { color: #0F4C81; font-weight: 700; margin-bottom: 2mm; font-size: 10pt; border-bottom: 1px solid #E2E8F0; padding-bottom: 1.5mm; }
.a4-kv { display: flex; justify-content: space-between; font-size: 9.5pt; padding: 1mm 0; }
.a4-kv span { color: #475569; }
.a4-kv b    { color: #0F172A; font-weight: 600; }

/* ===== Items Table ===== */
.a4-items { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 5mm; }
.a4-items thead th {
  background: #0F4C81; color: #fff; font-weight: 600;
  padding: 3mm; text-align: start; font-size: 9.5pt;
}
.a4-items .w-num { text-align: center; }
.a4-items tbody td {
  padding: 2.5mm 3mm; border-bottom: 1px solid #E2E8F0; vertical-align: top;
}
.a4-items tbody tr:nth-child(even) td { background: #F8FAFC; }
.a4-items tbody td.num { text-align: center; font-variant-numeric: tabular-nums; direction: ltr; }

/* ===== Summary (QR + Totals) ===== */
.a4-summary { display: grid; grid-template-columns: 45mm 1fr; gap: 6mm; align-items: start; margin-top: 4mm; }
.a4-qr-box { text-align: center; }
.a4-qr { width: 35mm; height: 35mm; margin: 0 auto 2mm; }
.a4-qr-label { font-size: 8.5pt; color: #475569; }
.a4-totals { border: 1px solid #E2E8F0; border-radius: 4px; overflow: hidden; max-width: 90mm; margin-inline-start: auto; width: 100%; }
.a4-trow {
  display: flex; justify-content: space-between; align-items: center;
  padding: 3mm 4mm; font-size: 10pt; border-bottom: 1px solid #E2E8F0;
}
.a4-trow:last-child { border-bottom: none; }
.a4-trow span { color: #475569; }
.a4-trow b    { color: #0F172A; font-weight: 600; font-variant-numeric: tabular-nums; }
.a4-trow .neg { color: #DC2626; }
.a4-grand { background: #0F4C81; }
.a4-grand span, .a4-grand b { color: #fff; font-size: 12pt; font-weight: 700; }

/* ===== Footer ===== */
.a4-footer {
  position: absolute; left: 10mm; right: 10mm; bottom: 6mm;
  background: #0A3A66; color: #fff; border-radius: 3px;
  padding: 3mm 5mm; font-size: 9pt;
  display: flex; justify-content: space-between; align-items: center;
}
```

**(ج) Print Styles** — تعديل قاعدة `@media print` الحالية:

```css
@media print {
  @page { size: A4; margin: 0; }

  /* thermal (default behavior, unchanged) */
  body:not(.invtype-a4) .inv-paper {
    width: 80mm !important; max-width: 80mm !important;
    margin: 0 auto !important; padding: 4mm !important;
  }
  body:not(.invtype-a4) #invoicePaperA4 { display: none !important; }

  /* A4 */
  body.invtype-a4 #invoicePaperA4 { display: block !important; }
  body.invtype-a4 .inv-paper { display: none !important; }
  body.invtype-a4 .inv-a4-paper {
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    box-shadow: none !important;
    page-break-after: always;
  }

  body > *:not(#invoiceModal) { display: none !important; }
  #invoiceModal { position: static !important; background: none !important; padding: 0 !important; display: block !important; overflow: visible !important; }
  .no-print { display: none !important; }
}
```

**(د) تكيّف المودال على الشاشة**:
عند A4 نضيف scroll داخل `.inv-dialog-body` + `transform: scale(0.75)` اختياري للـ preview على الشاشات الصغيرة.

### 5.3 [./screens/pos/pos.js](./screens/pos/pos.js)

**(أ) إضافة مراجع العناصر** في كائن `els` (بجانب المراجع الحرارية الموجودة):

```javascript
// A4 refs
invoicePaperA4: document.getElementById('invoicePaperA4'),
a4Logo:        document.getElementById('a4Logo'),
a4ShopNameAr:  document.getElementById('a4ShopNameAr'),
a4ShopNameEn:  document.getElementById('a4ShopNameEn'),
// ... باقي عناصر A4 (كلها بنفس نمط التسمية)
a4ItemsTbody:  document.getElementById('a4ItemsTbody'),
a4QR:          document.getElementById('a4QR'),
```

**(ب) دالة جديدة `fillA4Invoice(ctx)`** تُستدعى داخل `showInvoiceModal` بعد تعبئة الحراري:

```javascript
function applyInvoiceTypeClass() {
  var type = (state.appSettings && state.appSettings.invoicePaperType) || 'thermal';
  document.body.classList.toggle('invtype-a4', type === 'a4');
  document.body.classList.toggle('invtype-thermal', type !== 'a4');
}

function fillA4Invoice(ctx) {
  var s = state.appSettings || {};
  // Header bilingual
  setText(els.a4ShopNameAr,    s.laundryNameAr || '');
  setText(els.a4ShopNameEn,    s.laundryNameEn || '');
  setText(els.a4ShopAddressAr, s.locationAr || '');
  setText(els.a4ShopAddressEn, s.locationEn || '');
  setText(els.a4ShopPhoneAr,   'جوال: ' + (s.phone || ''));
  setText(els.a4ShopEmail,     s.email || '');
  setText(els.a4VatAr,         'الرقم الضريبي: ' + (s.vatNumber || ''));
  setText(els.a4VatEn,         'VAT No: ' + (s.vatNumber || ''));
  setText(els.a4CrAr,          'س.ت: ' + (s.commercialRegister || ''));
  setText(els.a4CrEn,          'CR No: ' + (s.commercialRegister || ''));
  if (s.logoBase64) { els.a4Logo.src = s.logoBase64; els.a4Logo.style.display = ''; }
  else { els.a4Logo.style.display = 'none'; }

  // Meta + customer + dates + items + totals (نفس منطق الحراري، استعمل ctx)
  setText(els.a4OrderNum,  ctx.orderNumber);
  setText(els.a4Date,      ctx.dateStr);
  setText(els.a4Payment,   ctx.paymentLabel);
  setText(els.a4CustName,  ctx.customer.name || '—');
  setText(els.a4CustPhone, ctx.customer.phone || '—');

  // Items (6 columns: # / product / service / qty / unit price / total)
  els.a4ItemsTbody.innerHTML = ctx.items.map(function(it, i){
    return '<tr>'
      + '<td class="num">' + (i+1) + '</td>'
      + '<td>' + escapeHtml(it.productAr) + (it.productEn ? '<br><small style="color:#94A3B8">'+escapeHtml(it.productEn)+'</small>' : '') + '</td>'
      + '<td>' + escapeHtml(it.serviceLabel || '—') + '</td>'
      + '<td class="num">' + it.qty + '</td>'
      + '<td class="num">' + fmtLtr(it.unitPrice) + '</td>'
      + '<td class="num">' + fmtLtr(it.lineTotal) + '</td>'
      + '</tr>';
  }).join('');

  setText(els.a4Subtotal, fmtLtr(ctx.subtotal));
  setText(els.a4Discount, '-' + fmtLtr(ctx.discount));
  els.a4DiscRow.style.display = ctx.discount > 0 ? '' : 'none';
  setText(els.a4VatLabel, 'ضريبة القيمة المضافة ' + (ctx.vatRate || 15) + '%');
  setText(els.a4Vat,      fmtLtr(ctx.vatAmount));
  setText(els.a4Total,    fmtLtr(ctx.total));

  // QR (reuse same ZATCA payload)
  renderQR(els.a4QR, ctx.qrPayload, 132);
}
```

**(ج) تعديل `showInvoiceModal`**:
إعادة هيكلة البيانات إلى كائن `ctx` ثم استدعاء:
```javascript
applyInvoiceTypeClass();
fillThermalInvoice(ctx); // الموجود حالياً
fillA4Invoice(ctx);
```

### 5.4 [./screens/invoices/invoices.js](./screens/invoices/invoices.js)

تطبيق **نفس** منطق البند 5.3 داخل `renderInvoiceModal` (سطر 317) — استخراج دالة مساعدة مشتركة `buildInvoiceContext(order, items, subscription)` في ملف جديد:

**اقتراح**: إنشاء [./screens/_shared/invoiceRenderer.js](./screens/_shared/invoiceRenderer.js) يُصدّر:
- `buildInvoiceContext(order, items, settings, subscription)`
- `fillA4Invoice(ctx, els, settings)`
- `applyInvoiceTypeClass(settings)`

وإعادة استخدامه في كلٍ من `pos.js` و `invoices.js` لتجنّب التكرار.

### 5.5 [./screens/settings/settings.js](./screens/settings/settings.js)

لا حاجة لتغيير منطقي — فقط **إرسال حدث** عند حفظ الإعدادات ليُحدّث ال body class إن كانت الشاشة مفتوحة:

```javascript
// بعد saveAppSettings
window.dispatchEvent(new CustomEvent('app:settings-updated', { detail: payload }));
```

وفي `pos.js` و `invoices.js` الاستماع:
```javascript
window.addEventListener('app:settings-updated', function(e){
  state.appSettings = e.detail;
  applyInvoiceTypeClass();
});
```

### 5.6 [./assets/i18n.js](./assets/i18n.js)

إضافة مفاتيح ترجمة جديدة للنصوص الثابتة في قالب A4:

```javascript
'a4-title':          { ar: 'فاتورة ضريبية مبسطة', en: 'Simplified Tax Invoice' },
'a4-billto':         { ar: 'بيانات العميل',       en: 'Bill To' },
'a4-order':          { ar: 'بيانات الطلب',        en: 'Order Details' },
'a4-col-item':       { ar: 'النوع',              en: 'Item' },
'a4-col-service':    { ar: 'العملية',            en: 'Service' },
'a4-col-qty':        { ar: 'الكمية',             en: 'Qty' },
'a4-col-price':      { ar: 'السعر',              en: 'Price' },
'a4-col-total':      { ar: 'الإجمالي',           en: 'Total' },
'a4-subtotal':       { ar: 'المجموع قبل الضريبة', en: 'Subtotal' },
'a4-discount':       { ar: 'الخصم',              en: 'Discount' },
'a4-vat':            { ar: 'ضريبة القيمة المضافة', en: 'VAT' },
'a4-grand':          { ar: 'الإجمالي شامل الضريبة', en: 'Grand Total (incl. VAT)' },
'a4-thanks':         { ar: 'شكراً لثقتكم',        en: 'Thank you' },
'a4-scan':           { ar: 'امسح للتحقق',         en: 'Scan to verify' },
'settings-option-invoice-a4':      { ar: 'فاتورة A4',      en: 'A4 Invoice' },
'settings-option-invoice-thermal': { ar: 'فاتورة حراري',   en: 'Thermal Invoice' },
```

**ملاحظة RTL**: نصوص الترويسة الثنائية (عربي/إنجليزي) **لا تعتمد** على لغة الواجهة — هي ثابتة (العربي يميناً والإنجليزي يساراً). النصوص الباقية (عناوين الأعمدة، الأزرار) تستخدم `data-i18n` العادي.

---

## 6. توافق RTL/LTR

القواعد المتبعة لضمان عرض صحيح في كلا الاتجاهين:

1. **الترويسة**: `direction` محلي لكل عمود — لا يتأثر بلغة الصفحة.
2. **الأرقام**: كل قيم مالية / تواريخ / أرقام فواتير تحمل `dir="ltr"` + `font-variant-numeric: tabular-nums`.
3. **الجدول**: محاذاة `text-align: start` بدلاً من `left/right` (CSS Logical Properties).
4. **Margins/Padding**: استخدام `margin-inline-start`, `padding-inline-end` بدل `margin-left/right`.
5. **صندوق الإجمالي**: يُستخدم `margin-inline-start: auto` ليُدفع تلقائياً إلى الجهة المناسبة.
6. **اختبار**: طباعة نفس الفاتورة بعد تبديل اللغة من الإعدادات والتأكد من عدم انعكاس الترويسة.

---

## 7. الاختبار والتحقق (Verification)

### 7.1 اختبارات يدوية

1. **تشغيل التطبيق**: `npm start` (أو الأمر المستخدم — راجع `package.json`).
2. افتح **الإعدادات** → اختر "فاتورة A4" → احفظ.
3. افتح **POS** → أضف 3 منتجات بخدمات مختلفة → أنجز الطلب → يجب أن تظهر المعاينة بتصميم A4.
4. اضغط **طباعة** (Ctrl+P): يجب أن يعرض Preview بمقاس A4 بدون قص/تمدد.
5. افتح **الفواتير** (سجل) → افتح فاتورة قديمة → نفس الفاتورة تعرض بتصميم A4 عند الإعداد = A4.
6. أعد الإعداد لـ "حراري" → تحقق أن السلوك القديم لم يتأثر (80mm).
7. بدّل لغة الواجهة عربي/إنجليزي → تحقق أن ترويسة الفاتورة محافظة على الترتيب (عربي يمين، إنجليزي يسار).
8. تحقق من QR: امسحه بتطبيق ZATCA للتأكد من الصلاحية.
9. حالة الخصم = 0 → صف الخصم مخفي.
10. فاتورة بدون عميل → قسم Bill To يعرض "—" بدل الأسماء.

### 7.2 اختبارات الطباعة (Print)

- Chrome DevTools → Print Preview → A4 Portrait → **لا يجب أن تُقطع الفاتورة** عبر صفحات إلا إذا زاد عدد الأصناف عن حد معيّن.
- يُختبر على **أكثر من 20 صنف** للتحقق من `page-break` في الجدول (أضف `tr { page-break-inside: avoid; }`).
- تصدير PDF عبر Chrome → مطابقة المقاس 210×297mm.

### 7.3 نقاط حرجة

- [ ] عدم ظهور `.inv-paper` و `#invoicePaperA4` معاً في أي حالة.
- [ ] QR Code يُرسم على كلاهما بنجاح.
- [ ] الخط العربي محمّل قبل الطباعة (منع omission في PDF).
- [ ] الـ Footer band لا يتداخل مع آخر صف من الجدول في الفواتير الطويلة.
- [ ] عند عدم وجود شعار، الشبكة تبقى متوازنة (يمكن ترك العمود الأوسط فارغاً).

---

## 8. ملفات يتم تعديلها (ملخص)

| # | الملف | نوع التغيير |
|---|---|---|
| 1 | [./screens/pos/pos.html](./screens/pos/pos.html) | إضافة قالب `#invoicePaperA4` |
| 2 | [./screens/pos/pos.css](./screens/pos/pos.css)   | إضافة أنماط `.inv-a4-paper` + تحديث `@media print` |
| 3 | [./screens/pos/pos.js](./screens/pos/pos.js)     | إضافة `fillA4Invoice` و `applyInvoiceTypeClass` |
| 4 | [./screens/invoices/invoices.html](./screens/invoices/invoices.html) | إن احتوت مودال منفصل، إضافة قالب مماثل (أو استخدام المودال المشترك) |
| 5 | [./screens/invoices/invoices.js](./screens/invoices/invoices.js) | استدعاء `fillA4Invoice` بعد `renderInvoiceModal` |
| 6 | [./screens/settings/settings.js](./screens/settings/settings.js) | بث حدث `app:settings-updated` بعد الحفظ |
| 7 | [./assets/i18n.js](./assets/i18n.js) | إضافة مفاتيح ترجمة A4 |
| 8 | [./screens/_shared/invoiceRenderer.js](./screens/_shared/invoiceRenderer.js) | (جديد اختياري) مشاركة منطق التعبئة |

**لا تغييرات على**: قاعدة البيانات، السيرفر، `server/pdfFromHtml.js`.

---

## 9. ترتيب التنفيذ الموصى به

1. إضافة قالب HTML الـ A4 في `pos.html` (بدون CSS — للتأكد من صحة الـ IDs).
2. كتابة الأنماط CSS للـ A4 + `@media print`.
3. كتابة دالة `fillA4Invoice` في `pos.js` + اختبار من POS.
4. توحيد المنطق في `_shared/invoiceRenderer.js` وإعادة استخدامه في `invoices.js`.
5. إضافة مفاتيح i18n.
6. اختبار شامل RTL + LTR + Print Preview.

---

**نهاية الخطة** — جاهزة للتنفيذ بعد موافقتك.
