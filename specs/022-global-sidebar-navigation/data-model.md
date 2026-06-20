# Data Model: Global Sidebar Navigation

> ميزة frontend بحتة — لا تغييرات على قاعدة البيانات.

## الكيانات المنطقية (Frontend State)

### 1. SidebarConfig (ثابت في sidebar.js)

تعريف القائمة — مصفوفة من مجموعات الروابط، كل مجموعة تحتوي روابطاً.

```
SidebarConfig {
  groups: SidebarGroup[]
}

SidebarGroup {
  label: string           // مفتاح i18n لعنوان المجموعة
  items: SidebarItem[]
}

SidebarItem {
  screen: string          // اسم الشاشة (يستخدمه navigateTo)
  labelKey: string        // مفتاح i18n للنص
  permission: string|null // مفتاح hasPermission() — null يعني للجميع
  svgPath: string         // SVG markup للأيقونة
}
```

### 2. SidebarState (يُحفظ في localStorage)

```
SidebarState {
  collapsed: boolean      // localStorage key: 'sidebar_collapsed'
}
```

**Storage**: `localStorage.getItem('sidebar_collapsed') === '1'`

**Default**: `false` (قائمة مفتوحة بالكامل)

### 3. CSS Custom Properties (في sidebar.css)

```css
:root {
  --gsb-w: 248px;      /* عرض القائمة الكاملة */
  --gsb-w-col: 64px;   /* عرض القائمة المطوية */
}
```

هذه القيم تُستخدم في كل الشاشات لضبط المسافة الجانبية للمحتوى.

## التأثير على Layout الصفحات

كل صفحة مستهدفة تحتاج:

1. إضافة `<link rel="stylesheet" href="../../assets/sidebar.css" />` في `<head>`
2. إضافة `<script src="../../assets/sidebar.js"></script>` قبل إغلاق `</body>` (بعد web-api.js وauth-guard.js)
3. تعديل الـ page wrapper ليستوعب القائمة (flex container)

## تدفق بيانات الصلاحيات

```
auth-guard.js fetch('/api/auth/me')
  → sets window.__currentUser
  → fires 'userReady' event

sidebar.js listens for 'userReady'
  → calls window.hasPermission(item.permission) for each item
  → hides items where permission denied
```

**ملاحظة**: `window.hasPermission()` معرَّفة في `auth-guard.js` وتُرجع `true` للـ admin/superadmin دائماً.
