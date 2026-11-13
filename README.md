# Friedo Digital Menu — منيو مطعم فرايدو الرقمي

منيو رقمي ونظام طلبات أونلاين لمطعم **Friedo**، مبني بتقنيات الويب الحديثة ليعمل بأقصى سرعة واستقرار مع تكامل مباشر مع نظام كاشير **Tayaran POS** وقاعدة بيانات **Supabase** وتسجيل الطلبات في **Google Sheets**.

---

## التقنيات المستخدمة (Tech Stack)
- **Framework & Bundler:** React 19 + Vite 8 + TypeScript
- **Styling:** Tailwind CSS v4 + Lucide Icons
- **State Management:** Zustand
- **Backend & Database:** Supabase (PostgreSQL) — متوافق مع جداول نظام Tayaran POS
- **Deployment:** Vercel (SPA Architecture)

---

## المميزات الأساسية
- **تحميل فوري (Zero-Latency Fallback):** عرض المنيو فوراً مع التحديث الصامت في الخلفية من Supabase.
- **حماية متكاملة للمنتجات:** حجب المنتجات غير المتوفرة تلقائياً مع تنظيف السلة قبل تأكيد الطلب.
- **تكامل الواتساب:** إرسال تفاصيل الطلب منسقة مع الخيارات المجمعة، الإضافات، الملاحظات، ورمز التتبع (`#ORD_XXXXX`).
- **تسجيل تلقائي للطلبات:** حفظ الطلبات في قاعدة بيانات Supabase وفي Google Sheets بالتوازي.

---

## التشغيل المحلي (Local Development)

```bash
# 1. تثبيت الحزم
npm install

# 2. تشغيل خادم التطوير
npm run dev

# 3. فحص الأنواع وبناء نسخة الإنتاج
npm run build
```

> **ملاحظة:** يجب إعداد متغيرات البيئة (Environment Variables) وفقاً للنموذج في `.env.example` في بيئة التشغيل المحلية أو في إعدادات منصة النشر (Vercel).
