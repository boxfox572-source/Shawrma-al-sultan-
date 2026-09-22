# تحويل تطبيق شاورما السلطان إلى APK

التطبيق المرفق (index.html + app.js + data.js) هو نموذج أولي شغّال بالكامل — منيو، سلة، طلب، تواصل، وشاشة إدارة بسيطة. لتحويله إلى ملف APK قابل للتثبيت على أندرويد، أسهل طريقة هي **Capacitor** من Ionic (مجاني ومفتوح المصدر).

## الطريقة 1: Capacitor (موصى بها)

### المتطلبات
- Node.js مثبت على جهازك
- Android Studio مثبت (لبناء الـ APK)

### الخطوات

```bash
# 1. أنشئ مجلد مشروع جديد وانسخ ملفات التطبيق بداخله
mkdir soltan-app && cd soltan-app
mkdir www
# انسخ index.html, app.js, data.js, promo_data.js داخل مجلد www

# 2. ثبّت Capacitor
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init "شاورما السلطان" "com.soltan.shawarma" --web-dir=www

# 3. أضف منصة أندرويد
npm install @capacitor/android
npx cap add android

# 4. زامن الملفات
npx cap sync

# 5. افتح المشروع في Android Studio
npx cap open android
```

من داخل Android Studio:
- اختر **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- ستجد ملف الـ APK في: `android/app/build/outputs/apk/debug/app-debug.apk`

### لنشره على متجر Google Play
تحتاج لبناء نسخة **release** موقّعة (signed) بدلاً من debug — Android Studio يوفر معالج (wizard) لهذا عبر **Build → Generate Signed Bundle / APK**.

---

## الطريقة 2: PWA Builder (أسهل، بدون تثبيت برامج)

1. ارفع ملفات التطبيق على أي استضافة ويب (حتى مجانية مثل GitHub Pages أو Netlify)
2. اذهب إلى [pwabuilder.com](https://www.pwabuilder.com)
3. أدخل رابط موقعك المرفوع
4. اختر **Android** من قائمة المنصات
5. حمّل ملف الـ APK الجاهز مباشرة

هذه الطريقة أسرع لكنها تتطلب رفع التطبيق على رابط عام أولاً (لأن PWA Builder يبني الـ APK من نسخة مستضافة على الإنترنت، وليس من ملفات محلية).

---

## ملاحظات مهمة قبل النشر

- **الأصناف والأسعار الحالية في `data.js` بيانات تجريبية** — لازم تستبدلها بمنيو مطعمك الحقيقي (الأسماء، الأوصاف، الأسعار، الصور) قبل الإطلاق.
- **شاشة الإدارة الحالية بسيطة** (محلية على الجهاز عبر localStorage) — لإدارة حقيقية متعددة المستخدمين (يشوف فيها كل الفروع نفس الطلبات لحظيًا) هتحتاج قاعدة بيانات فعلية (مثل Firebase أو Supabase) بدل التخزين المحلي.
- **رقم واتساب الفرع الافتراضي** في `data.js` (`WHATSAPP_NUMBER`) لازم تتأكد إنه صحيح.
- الأيقونة (App Icon) اللي هتظهر في أندرويد لازم تتضاف من داخل مشروع Capacitor (مجلد `android/app/src/main/res/`) — ممكن تستخدم [أداة توليد الأيقونات دي](https://icon.kitchen) من نفس اللوجو.
