# Research: Logo Size in Print Settings

## Findings

### Current State (ما هو موجود بالفعل)

**Decision**: الـ feature مُنجزة جزئياً — الـ DB والـ settings UI موجودان، لكن الطباعة لا تستخدم القيم.

**What exists**:
- `app_settings.logo_width` (INT DEFAULT 180) و `logo_height` (INT DEFAULT 70) — موجودان في DB
- `db.js` يقرأ ويحفظ `logoWidth`/`logoHeight` بشكل صحيح
- `settings.js` يُظهر ويحفظ الخانتين في تبويب إعدادات الطباعة
- `getSettings` API يُرجع `logoWidth` و `logoHeight` ضمن بيانات الإعدادات

**What's missing (الجزء المفقود)**:
- كل شاشة تطبع الشعار تستخدم CSS hardcoded:
  - الحرارية: `max-width:80px; max-height:60px`
  - A4: `max-height:60px; max-width:80px`
- لا توجد أي شاشة تُطبِّق `logoWidth`/`logoHeight` من الإعدادات كـ inline style على عنصر الشعار

### Affected Screens

| الشاشة | الملف | نوع الطباعة |
|--------|-------|-------------|
| POS | `screens/pos/pos.js` + `pos.css` | حرارية + A4 |
| Invoices | `screens/invoices/invoices.js` + `invoices.css` | حرارية + A4 |
| Credit Invoices | `screens/credit-invoices/credit-invoices.js` + `credit-invoices.css` | حرارية + A4 |
| Consumption Receipts | `screens/consumption-receipts/consumption-receipts.js` + `consumption-receipts.css` | حرارية |
| Hangers | `screens/hangers/hangers.css` | A4 |
| All-Invoices Report | `screens/reports/all-invoices-report/all-invoices-report.css` | حرارية |

### Implementation Approach

**Decision**: تطبيق inline styles على عنصر الشعار (`<img class="inv-logo">`) في كل شاشة عند تحميل الإعدادات، مع إبقاء CSS كـ fallback.

**Rationale**: 
- Inline style يتغلب على CSS class
- كل شاشة تستدعي `getSettings` مسبقاً وتحصل على `logoWidth`/`logoHeight`
- لا حاجة لتغيير الـ API أو قاعدة البيانات

**Pattern**: في كل شاشة حيث يُعيَّن `logo.src = s.logoDataUrl`:
```js
logo.style.width = s.logoWidth + 'px';
logo.style.height = s.logoHeight + 'px';
logo.style.objectFit = 'contain';
```

**For A4 HTML strings** (حيث يتم بناء HTML كـ string ثم طباعته بـ puppeteer أو print):
```js
`<img src="${logoDataUrl}" style="width:${logoWidth}px;height:${logoHeight}px;object-fit:contain">`
```
