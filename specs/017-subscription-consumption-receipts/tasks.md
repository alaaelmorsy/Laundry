# Tasks: إيصالات الاستهلاك في تقرير الاشتراكات

**Input**: Design documents from `specs/017-subscription-consumption-receipts/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Data Model**: [data-model.md](data-model.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: يمكن تنفيذه بالتوازي مع مهمة أخرى (ملفات مختلفة، لا تبعيات)
- **[US1]**: مرتبط بـ User Story 1 (قائمة الإيصالات)
- **[US2]**: مرتبط بـ User Story 2 (عرض الإيصال التفصيلي)

---

## Phase 1: Setup — تحقق وتهيئة

**Purpose**: التحقق من وجود الـ API الأساسية قبل البدء

- [X] T001 ابحث في `server/invokeHandlers.js` عن case `getConsumptionReceiptById` — إذا غير موجود أضفه بنفس نمط `getConsumptionReceipts`: `const receipt = await db.getConsumptionReceiptById(payload.id); return { success: true, receipt };`

- [X] T002 ابحث في `assets/web-api.js` عن `getConsumptionReceiptById` — إذا غير موجود أضف: `getConsumptionReceiptById: (payload) => invoke('getConsumptionReceiptById', payload),`

---

## Phase 2: Foundational — تحديث الـ API لإرجاع إيصالات الاستهلاك

**Purpose**: إضافة `consumptionReceipts` لبيانات تقرير الاشتراك — يُبلوك كل شيء بعده

**CRITICAL**: لا يمكن بناء الواجهة قبل اكتمال هذه المرحلة

- [X] T003 في `database/db.js`، ابحث عن الدالة التي تُستدعى من invoke handler الخاص بتقرير الاشتراك للعميل (ابحث عن `getSubscriptionCustomerReport` أو تتبع من `invokeHandlers.js`). أضف الاستعلام التالي داخلها وأضف نتيجته `consumptionReceipts` لكائن الـ return:
```sql
SELECT cr.id, cr.receipt_seq, cr.created_at,
       cr.amount_consumed, cr.balance_before, cr.balance_after,
       cr.package_name, cr.items_json, c.customer_name, c.phone
FROM consumption_receipts cr
LEFT JOIN customers c ON c.id = cr.customer_id
WHERE cr.subscription_id = ?
ORDER BY cr.created_at ASC
```

**Checkpoint**: اختبر بـ `console.log(data.consumptionReceipts)` في شاشة الاشتراكات للتحقق من وصول البيانات

---

## Phase 3: User Story 1 — قائمة إيصالات الاستهلاك في التقرير (P1)

**Goal**: إضافة قسم يعرض جميع إيصالات الاستهلاك في تقرير الاشتراك

**Independent Test**: افتح تقرير عميل لديه اشتراك واستهلاكات — يجب أن يظهر القسم بالبيانات الصحيحة

### Implementation

- [X] T004 [P] [US1] في `screens/subscriptions/subscriptions.js` — قسم الإيصالات أضيف للواجهة (desktop + mobile tab)، أضف قسم إيصالات الاستهلاك بعد آخر قسم موجود:
```html
<div class="report-section" id="consumptionSection">
  <h2 class="section-title">إيصالات الاستهلاك</h2>
  <table class="report-table" id="consumptionTable">
    <thead>
      <tr>
        <th>#</th><th>رقم الإيصال</th><th>التاريخ</th>
        <th>الجوال</th><th>المستهلك</th><th>الرصيد بعد</th><th></th>
      </tr>
    </thead>
    <tbody id="consumptionTableBody"></tbody>
  </table>
  <div id="consumptionTotal" class="section-footer"></div>
</div>
```

- [X] T005 [US1] دالة crHtml بُنيت في openDetailModal بـ subscriptions.js، أضف دالة `renderConsumptionReceipts(receipts)` التي:
  - إذا فارغة: تكتب في tbody صف واحد "لا توجد إيصالات استهلاك"
  - وإلا: تبني صفوف الجدول (index، receipt_seq، created_at بـ fmtDate، phone، amount_consumed بـ sarHtml، balance_after بـ sarHtml، زر "عرض الإيصال" بـ `onclick="openReceiptViewer(${r.id})"`)
  - تكتب في `#consumptionTotal`: عدد الإيصالات وإجمالي amount_consumed

- [X] T006 [US1] getConsumptionReceipts يُجلب مع openDetailModal في Promise.all، في الدالة التي تعالج response الـ API بعد تحميل التقرير، أضف استدعاء:
```javascript
renderConsumptionReceipts(data.consumptionReceipts || []);
```
(ابحث عن المكان الذي تُستدعى فيه renderSubscriptions أو renderPeriods وأضف بعدها مباشرة)

- [X] T007 [P] [US1] في `server/services/reportHtml.js` — قسم إيصالات الاستهلاك أضيف لـ buildPdfHtmlForSubscriptionCustomerReport، في دالة `buildPdfHtmlForSubscriptionCustomerReport`، أضف قسم إيصالات الاستهلاك في HTML template بعد قسم الفواتير:
  - بنِ `consRows` من `(report.consumptionReceipts || [])` بأعمدة: #، receipt_seq، created_at، amount_consumed، balance_before، balance_after
  - أضف `<h2>إيصالات الاستهلاك</h2>` + جدول بنفس CSS classes الجداول الأخرى في الدالة
  - إذا فارغ: صف واحد `<td colspan="6">لا توجد إيصالات</td>`

**Checkpoint**: يجب الآن أن يظهر القسم في الشاشة وفي الـ PDF

---

## Phase 4: User Story 2 — عرض الإيصال التفصيلي (P1)

**Goal**: زر "عرض الإيصال" يفتح نافذة بنفس الإيصال المطبوع من شاشة البيع بالضبط

**Independent Test**: اضغط "عرض الإيصال" لأي صف — قارن المحتوى مع الإيصال المطبوع من شاشة البيع لنفس الرقم

### Implementation

- [X] T008 [P] [US2] modal عرض الإيصال أضيف لـ subscriptions.html (#subCrViewerModal)، أضف modal للـ viewer (بعد قسم consumptionSection):
```html
<div id="consumptionReceiptViewer" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:none;align-items:center;justify-content:center">
  <div style="background:#fff;border-radius:12px;padding:16px;max-height:90vh;overflow-y:auto;position:relative;width:340px;max-width:95vw">
    <button id="closeReceiptViewerBtn" style="position:absolute;top:8px;left:8px;background:none;border:none;font-size:18px;cursor:pointer">✕</button>
    <div id="crViewerPaper"></div>
  </div>
</div>
```

- [X] T009 [US2] window._subOpenCrViewer أضيفت لـ subscriptions.js — تجلب الإيصال والإعدادات وتعرض المودال(receiptId)` التي:
  1. تستدعي `window.api.getConsumptionReceiptById({ id: receiptId })`
  2. في حالة الخطأ أو `!res.success`: تستدعي `showToast('الإيصال غير متاح', 'error')` وتوقف
  3. في حالة النجاح: تستدعي `populateCrViewer(res.receipt)` ثم تعرض `#consumptionReceiptViewer` بـ `style.display = 'flex'`

- [X] T010 [US2] _populateSubCrViewer أضيفت — تملأ عناصر المودال ببيانات الإيصال والإعدادات(receipt)` التي تملأ `#crViewerPaper` بنفس HTML الإيصال من `screens/consumption-receipts/consumption-receipts.html`:
  - افتح `screens/consumption-receipts/consumption-receipts.html` وانسخ HTML الكامل لـ `#crPaper` (جميع عناصره)
  - اكتب الدالة تُنشئ نفس HTML وتحقن البيانات مباشرة (shopName، receipt_seq، created_at، customer_name، phone، package_name، items_json، amount_consumed، balance_before، balance_after)
  - استخدم نفس CSS classes الموجودة في `screens/consumption-receipts/consumption-receipts.css`

- [X] T011 [P] [US2] CSS مكفول — subscriptions.html يحمّل pos.css الذي يحتوي .inv-paper و .cr-info-grid وكل الكلاسات المطلوبة لـ `consumption-receipts.css` إذا لم يكن محملاً، **أو** انسخ الـ CSS classes المستخدمة في `#crPaper` (inv-paper, inv-header-wrap, inv-shop-name, cr-info-grid, cr-info-cell, inv-table, inv-totals-box, إلخ) إلى `screens/reports/subscriptions-report/subscriptions-report.css`

- [X] T012 [US2] closeSubCrViewer + event listeners (زر الإغلاق، backdrop، Escape) أضيفت لـ subscriptions.js
  - `closeReceiptViewer()` تخفي `#consumptionReceiptViewer` بـ `style.display = 'none'`
  - Event listener على `#closeReceiptViewerBtn` يستدعي `closeReceiptViewer()`
  - Event listener على الـ backdrop (الضغط خارج الـ modal) يستدعي `closeReceiptViewer()`
  - Event listener على `Escape` key يستدعي `closeReceiptViewer()`

**Checkpoint**: اضغط "عرض الإيصال" — يجب أن تظهر نافذة بإيصال مطابق لشاشة البيع

---

## Phase 5: Polish

- [ ] T013 [P] راجع `specs/017-subscription-consumption-receipts/quickstart.md` ونفّذ السيناريوهات الثلاثة يدوياً للتحقق ونفّذ السيناريوهات الثلاثة يدوياً للتحقق من:
  - ظهور القسم بالبيانات الصحيحة
  - تطابق الإيصال 100% مع شاشة البيع (استخدم الجدول في quickstart.md)
  - ظهور القسم في تصدير PDF

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: لا تبعيات — ابدأ فوراً
- **Phase 2 (Foundational)**: يعتمد على Phase 1 — يُبلوك Phases 3 و 4
- **Phase 3 (US1)**: يعتمد على Phase 2 — T004 و T007 يمكن تنفيذهما بالتوازي
- **Phase 4 (US2)**: يعتمد على T006 (الـ button يجب أن يكون موجوداً في T005 أولاً)
- **Phase 5 (Polish)**: يعتمد على اكتمال Phase 3 و 4

### User Story Dependencies

- **US1 (Phase 3)**: يبدأ بعد اكتمال Phase 2
- **US2 (Phase 4)**: يبدأ بعد T005 (زر "عرض الإيصال" موجود في الـ render)

### Parallel Opportunities

- T004 (HTML section) و T007 (PDF section) يمكن تنفيذهما بالتوازي
- T008 (modal HTML) و T011 (CSS) يمكن تنفيذهما بالتوازي مع T009
- T001 و T002 يمكن تنفيذهما بالتوازي

---

## Implementation Strategy

### MVP (User Story 1 فقط)

1. Phase 1: T001, T002 (تحقق سريع)
2. Phase 2: T003 (تحديث الـ API)
3. Phase 3: T004 → T005 → T006 → T007
4. **توقف وتحقق**: يظهر القسم بالبيانات الصحيحة في الشاشة والـ PDF

### Full Delivery

بعد MVP، أكمل Phase 4 (T008 → T009 → T010 → T011 → T012) لإضافة "عرض الإيصال"

---

## Notes

- [P] = ملفات مختلفة، لا تبعيات على مهام غير مكتملة
- [US1]/[US2] = ارتباط بـ User Story للتتبع
- نقطة البداية الأهم: T003 — ابحث عن handler تقرير الاشتراك في `invokeHandlers.js` ثم تتبع إلى `db.js`
- populateCrViewer (T010) هي المهمة الأكثر تعقيداً — افتح `consumption-receipts.html` جنباً إلى جنب أثناء التنفيذ
