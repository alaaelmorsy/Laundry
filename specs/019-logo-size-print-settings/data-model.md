# Data Model: Logo Size in Print Settings

## Existing Entities (no changes needed)

### app_settings (existing, no migration needed)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `logo_width` | INT | 180 | عرض الشعار بالبكسل |
| `logo_height` | INT | 70 | طول الشعار بالبكسل |

**Note**: العمودان موجودان بالفعل مع migrations موجودة في `db.js:3427-3430`. لا يلزم أي تغيير في قاعدة البيانات.

## Data Flow

```
app_settings (DB)
    ↓ db.getSettings()
    ↓ invokeHandlers.js (getSettings case)
    ↓ web-api.js (window.api.getSettings)
    ↓ screen JS (s.logoWidth, s.logoHeight)
    ↓ inline style على <img class="inv-logo">
    → الطباعة الحرارية / A4
```

## Validation Rules (existing in db.js)

- `logoWidth`: يجب أن يكون integer موجب، الحد الأدنى 1، الحد الأقصى 2000، الافتراضي 180
- `logoHeight`: يجب أن يكون integer موجب، الحد الأدنى 1، الحد الأقصى 2000، الافتراضي 70
