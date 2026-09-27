# دليل إدارة المتجر | Store admin guide

افتح `admin/login.html` وسجّل الدخول بحساب الإدارة الذي أنشأه مالك المتجر. تتطلب الصفحات صلاحية مسؤول مفعّلة. / Open `admin/login.html` and sign in with the owner-provisioned admin account. Admin pages require an active admin record.

## المنتجات | Products

- من لوحة التحكم اختر **المنتجات** لإضافة المنتجات أو تعديلها والبحث فيها. / Choose **Products** to add, edit, and search products.
- أدخل الاسم والسعر والمخزون والفئة، ثم احفظ. استخدم الحالة لإظهار المنتج أو إخفائه، ويمكن تمييزه كمنتج بارز. / Enter the name, price, stock, and category, then save. Use the status to show or hide a product; featured products can be marked separately.
- ارفع الصور من الصفحة نفسها. استخدم صوراً مناسبة للويب ولا ترفع معلومات شخصية. / Upload images from the page. Use web-ready images and do not upload personal information.

## التصنيفات | Categories

- أنشئ اسماً ورابطاً مختصراً ووصفاً اختيارياً، ثم اختر الحالة والصورة. / Add a name, URL slug, optional description, status, and image.
- لا يمكن حذف تصنيف مرتبط بمنتجات؛ عطّله إذا لم تعد تريد عرضه. / A category in use cannot be deleted; deactivate it if it should no longer be shown.

## العروض | Offers

- اختر منتجاً نشطاً، وأدخل عنوان العرض وسعره وتواريخه. تحقّق من أن سعر العرض لا يتجاوز السعر السابق وأن تاريخ النهاية ليس قبل البداية. / Select an active product, then enter the offer title, price, and dates. Ensure the offer price does not exceed the old price and the end date is not before the start date.
- العروض المنتهية لا تُحذف تلقائياً. حدّث حالتها أو اتركها محفوظة كسجل. / Expired offers are not deleted automatically. Update their status or retain them as records.

## الطلبات | Orders

- افتح **الطلبات** لمراجعة بيانات الطلب والعناصر والأسعار المحفوظة وقت الشراء. / Open **Orders** to review customer details, items, and the price snapshots recorded at purchase time.
- حدّث حالة الطلب وفق سير العمل الفعلي للمتجر. لا تعدّل المبالغ أو العناصر التاريخية. / Update the order status according to the store’s actual workflow. Do not alter historical amounts or items.

## إعدادات المتجر | Store settings

- حدّث بيانات التواصل وساعات العمل ومعلومات التوصيل والدفع وروابط التواصل الاجتماعي. اترك الحقول غير المعروفة فارغة؛ لا تستخدم بيانات تجريبية على الموقع المنشور. / Update contact details, hours, delivery/payment information, and social links. Leave unknown fields blank; do not publish demo contact details.

## السلامة | Safety

- استخدم حساب الإدارة فقط على جهاز موثوق، وسجّل الخروج عند الانتهاء. / Use the admin account on a trusted device and sign out when finished.
- لا تشارك كلمات المرور أو مفاتيح Supabase السرية. مفاتيح الخدمة لا توضع في الموقع أو المتصفح. / Never share passwords or Supabase secret keys. Service keys must not be placed in the website or browser.
- عند فقدان صلاحية مسؤول، يطلب مالك المشروع تعطيلها من Supabase. لا تنشئ حسابات إدارية من الواجهة. / If an admin should lose access, the project owner can disable the authorization in Supabase. Do not create admin accounts from the website.
