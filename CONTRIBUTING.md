# دليل المساهمة — PLUS Laundry

شكراً لاهتمامك بالمساهمة في المشروع. يرجى قراءة هذا الدليل كاملاً قبل فتح أي Issue أو Pull Request.

---

## 📋 قبل أي شيء

اقرأ هذين الملفين أولاً:

- **[PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md)** — الدستور الكامل للمشروع (معمارية، قواعد، محظورات)
- **[CLAUDE.md](CLAUDE.md)** — الدليل العملي اليومي

أي مساهمة تتعارض مع هذين الملفين ستُرفض تلقائياً.

---

## 🐛 الإبلاغ عن مشكلة (Bug Report)

1. تأكد أن المشكلة لم تُبلَّغ مسبقاً في [Issues](https://github.com/alaaelmorsy/Laundry/issues)
2. افتح Issue جديدة باستخدام قالب **Bug Report**
3. أرفق:
   - خطوات إعادة المشكلة بالتفصيل
   - النتيجة المتوقعة vs النتيجة الفعلية
   - إصدار التطبيق (`package.json` → `version`)
   - نظام التشغيل وإصدار MySQL
   - أي رسائل خطأ من `data/logs/boot.log`

---

## 💡 اقتراح ميزة جديدة (Feature Request)

1. افتح Issue باستخدام قالب **Feature Request**
2. اشرح:
   - المشكلة التي تحلها الميزة
   - السلوك المقترح
   - أي بديل جربته

---

## 🔧 تقديم Pull Request

### شروط أساسية

- [ ] قرأت [PROJECT_CONSTITUTION.md](PROJECT_CONSTITUTION.md) كاملاً
- [ ] التغيير يتبع نمط المشروع الحالي (Node.js · Vanilla JS · mysql2 · بدون ORM)
- [ ] جميع SQL متوافق مع MySQL 5.7
- [ ] لا يكسر: POS · الاشتراكات · الفواتير · الطباعة · ZATCA

### خطوات تقديم PR

```bash
# 1. fork المستودع وأنشئ branch جديد
git checkout -b feature/your-feature-name

# 2. طوّر التغيير باتباع المعمارية الحالية
# راجع CLAUDE.md §4 (API 4-Step) و§14 (Impact Checklist)

# 3. تحقق من كل شيء يدوياً:
#    - POS checkout يعمل من البداية للنهاية
#    - الطباعة الحرارية: 76mm، margin: 0 auto
#    - ZATCA columns على orders غير متأثرة
#    - الـ migrations: additive فقط، try/catch، مسجلة في db.initialize()

# 4. commit مع رسالة واضحة
git commit -m "feat: وصف موجز للتغيير"

# 5. افتح Pull Request مع ملء قالب PR كاملاً
```

### قواعد رسائل الـ Commit

```
feat:   ميزة جديدة
fix:    إصلاح مشكلة
docs:   تحديث توثيق فقط
style:  تنسيق CSS/UI بدون تغيير منطق
refactor: إعادة هيكلة بدون تغيير سلوك
chore:  تحديث dependencies أو build scripts
```

---

## 🚫 ما لا يُقبل

أي PR يحتوي على الآتي سيُغلق فوراً:

- React / Vue / Svelte أو أي JS framework
- ORM (Sequelize / Prisma / Knex / TypeORM)
- تغيير معمارية `/api/invoke`
- SQL بصيغة MySQL 8.0 فقط (Window functions / CTEs / LATERAL)
- تغيير أبعاد الطباعة الحرارية (`76mm / margin: 0 auto`)
- `DROP COLUMN` أو `RENAME COLUMN` في migrations
- `process.exit()` داخل request handlers
- `spawn(detached: true)` لـ post-exit scripts

---

## 📞 التواصل

للأسئلة التقنية أو النقاشات: افتح [Discussion](https://github.com/alaaelmorsy/Laundry/discussions) أو Issue بعلامة `question`.
