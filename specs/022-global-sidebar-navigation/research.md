# Research: Global Sidebar Navigation

## القرارات التصميمية

### 1. استراتيجية المكوّن المشترك

**Decision**: ملف `assets/sidebar.js` يحقن HTML القائمة الجانبية في الصفحة ديناميكياً عند التحميل، مثلما تعمل `auth-guard.js`.

**Rationale**: الكود الحالي يتبع نمط "أداة مشتركة في assets تُحمَّل بـ `<script>`". لا يوجد نظام include/template في هذا المشروع. الحقن الديناميكي يتيح:
- إضافة القائمة لكل شاشة بسطر `<script>` واحد
- تحديث القائمة في مكان واحد يؤثر على جميع الشاشات
- الحفاظ على استقلالية كل شاشة (لا SPA router)

**Alternatives considered**:
- Copy-paste HTML في كل شاشة → مرفوض (صعوبة الصيانة، مخالف لمبدأ DRY)
- Web Components / Custom Elements → مرفوض (يتطلب ES modules، مخالف للدستور)

---

### 2. توقيت الحقن وظهور الصلاحيات

**Decision**: `sidebar.js` يحقن HTML القائمة فوراً عند تحميل الـ script (قبل `DOMContentLoaded`)، ثم يستمع لحدث `userReady` من `auth-guard.js` لإخفاء/إظهار الروابط المقيدة بالصلاحيات.

**Rationale**: 
- `auth-guard.js` يستدعي `fetch('/api/auth/me')` — هذا غير متزامن
- إظهار القائمة فوراً يمنع الوميض (flash) ثم الاختفاء
- عند `userReady`: يُطبَّق `window.hasPermission()` على كل رابط

**Alternatives considered**:
- الانتظار حتى `userReady` قبل رسم القائمة → يسبب وميضاً في التحميل
- إخفاء الروابط المقيدة بـ CSS فقط → غير آمن (يمكن للمستخدم رؤيتها)

---

### 3. تحديد الشاشة النشطة

**Decision**: `sidebar.js` يقارن `location.pathname` بـ pattern الشاشة لكل رابط لتحديد الرابط النشط وإضافة كلاس `.active`.

**Pattern**: `/screens/{screen-name}/{screen-name}.html`

**Rationale**: `window.api.navigateTo(screen)` يستخدم هذا الـ pattern تماماً، وهو موحد في جميع الشاشات.

---

### 4. حالة الطي (Collapsed State)

**Decision**: `localStorage.getItem('sidebar_collapsed')` — قيمة `'1'` تعني مطوية، القيمة الافتراضية هي غير مطوية.

**Key**: `sidebar_collapsed`

**Rationale**: localStorage تبقى بين الجلسات على نفس الجهاز، وهو السلوك المطلوب. لا حاجة لتخزينها في قاعدة البيانات (تفضيل شخصي للجهاز وليس للحساب).

---

### 5. Breakpoint الجوال

**Decision**: `768px` — تحت هذا العرض القائمة تختفي تماماً بـ CSS `display:none`.

**Rationale**: هذا هو breakpoint Tailwind `md:` المستخدم في المشروع، ومتسق مع `screen-mobile-compact.css` الحالي. شاشات الإعدادات تستخدم `@media (max-width:768px)` أيضاً.

---

### 6. تأثير القائمة على layout الصفحات الحالية

**Decision**: كل شاشة مستهدفة تحتاج تعديل layout wrapper ليصبح `display:flex` مع القائمة على اليمين (RTL) والمحتوى على اليسار.

**Approach**: 
- `sidebar.js` يحقن `<aside id="globalSidebar">` كأول عنصر داخل `<body>` أو داخل `.page-wrapper`
- CSS يضيف margin/padding للـ content بعرض القائمة (`--gsb-w: 248px`) على شاشات الكمبيوتر
- عند الطي: `--gsb-w: 64px`

**Critical consideration لشاشة POS**: `pos.html` لها layout معقد — ستحتاج مراجعة دقيقة لضمان عدم التأثير على الـ layout الداخلي.

---

### 7. قائمة الشاشات في القائمة الجانبية

بناءً على `dashboard.html` — الشاشات مرتبة حسب الأهمية للمستخدم اليومي:

| الشاشة | المفتاح | الصلاحية | أولوية |
|--------|---------|----------|--------|
| الرئيسية (dashboard) | `dashboard` | — | P1 |
| نقطة البيع (pos) | `pos` | `pos` | P1 |
| الفواتير (invoices) | `invoices` | `invoices` | P1 |
| التقارير (reports) | `reports` | `reports` | P1 |
| العملاء (customers) | `customers` | `customers` | P2 |
| الاشتراكات (subscriptions) | `subscriptions` | `subscriptions` | P2 |
| إيصالات الاستهلاك | `consumption-receipts` | `consumption_receipts` | P2 |
| الفواتير الدائنة | `credit-invoices` | `credit_invoices` | P2 |
| سير الملابس (hangers) | `hangers` | `hangers` | P2 |
| المصروفات (expenses) | `expenses` | `expenses` | P2 |
| المستخدمون (users) | `users` | `users` | P3 |
| الصلاحيات (roles) | `roles` | `roles` | P3 |
| العمليات (services) | `services` | `services` | P3 |
| الخدمات (products) | `products` | `products` | P3 |
| العروض (offers) | `offers` | `offers` | P3 |
| WhatsApp | `whatsapp` | `whatsapp` | P3 |
| ZATCA | `zatca-settings` | `zatca_settings` | P3 |
| الإعدادات (settings) | `settings` | — (admin only) | P3 |

**Grouping**: القائمة ستُقسَّم إلى مجموعتين:
1. **الرئيسي**: dashboard, pos, invoices, customers, reports
2. **الإدارة**: subscriptions, consumption-receipts, credit-invoices, hangers, expenses, users, roles, services, products, offers, whatsapp, zatca-settings, settings
