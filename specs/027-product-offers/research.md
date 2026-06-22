# Research: عروض الأصناف

**Date**: 2026-06-22

---

## قرار 1: بنية التخزين

**Decision**: جدولان منفصلان `product_offers` + `product_offer_lines`

**Rationale**: الفصل التام عن `offers` (العروض العامة) يمنع تشابك المنطق. العروض العامة تُطبَّق على الفاتورة كاملةً، بينما عروض الأصناف تُطبَّق على بنود محددة — منطقان مختلفان تماماً.

**Alternatives considered**:
- عمود `type` في جدول `offers` موجود → رُفض لأنه يربك الكود ويضيف شرطاً في كل استعلام
- جدول واحد موحد → رُفض لنفس السبب

---

## قرار 2: وحدة الربط (product vs price_line)

**Decision**: الربط على مستوى `product_price_lines.id` (صنف + عملية معاً)

**Rationale**: في الـ POS، البند دائماً = صنف + عملية. ربط العرض بالصنف فقط يُفقد التحديد (هل الخصم على الغسل؟ الكوي؟). الربط بـ price_line يعطي تحكماً كاملاً.

**Alternatives considered**:
- ربط بـ product_id فقط → رُفض لعدم الدقة
- ربط بـ (product_id, laundry_service_id) منفصلاً → نفس نتيجة price_line لكن أعقد

---

## قرار 3: الخصم موحد أم لكل سطر

**Decision**: خصم واحد موحد على مستوى العرض كله (`discount_type` + `discount_value` في `product_offers`)

**Rationale**: سهولة الإدخال والفهم للمستخدم. "خصم 20% على القمصان والجلابيات" أوضح من "قميص غسل 10%، قميص كوي 15%".

**Alternatives considered**:
- خصم لكل سطر في `product_offer_lines` → رُفض بطلب صريح من صاحب المشروع

---

## قرار 4: التواريخ اختيارية

**Decision**: `start_date` و `end_date` كلاهما nullable

**Rationale**: بعض العروض دائمة (مثل خصم VIP مستمر). إجبار التواريخ يُعقّد الواجهة بدون فائدة.

**SQL Rule**: عند التحقق من نشاط العرض:
```sql
is_active = 1
AND (start_date IS NULL OR start_date <= NOW())
AND (end_date IS NULL OR end_date >= NOW())
```

---

## قرار 5: الأصناف بدون عمليات

**Decision**: استبعاد الأصناف التي لا تملك أي سطر في `product_price_lines` من قائمة الاختيار

**Rationale**: صنف بدون عملية لا معنى لربطه بعرض.

**SQL**: `INNER JOIN product_price_lines` يُخرج تلقائياً الأصناف بدون سطور.

---

## قرار 6: تعارض عرضين على نفس الصنف/العملية

**Decision**: السماح بتعدد العروض النشطة على نفس الصنف/العملية — الـ POS يختار لاحقاً (خارج scope هذا الـ spec)

**Rationale**: قاعدة الاختيار (الأعلى خصماً؟ الأقدم؟) تُحدَّد عند تنفيذ تكامل الـ POS.

---

## قرار 7: الحذف الآمن

**Decision**: عند حذف عرض → حذف سطوره من `product_offer_lines` أولاً (أو FK CASCADE)

**Implementation**: استخدام `ON DELETE CASCADE` في تعريف FK في `product_offer_lines`.
