// ============================================================
// شاورما السلطان — بيانات التطبيق
// ⚠️ أصناف المنيو والأسعار أدناه بيانات تجريبية (placeholder).
// استبدلها من حساب الإدارة داخل التطبيق ببيانات فرعك الحقيقية.
// البيانات الحقيقية المؤكدة: اللوجو، الفروع، أرقام التليفونات، الخط الساخن.
// ============================================================

window.BRANCHES = [
  {
    id: "mansoura",
    name: "فرع المنصورة",
    address: "كفر الشيخ سليم، شارع الترعة، امام البنك الأهلي",
    phones: ["01040101101", "01066909246", "01022244577"]
  },
  {
    id: "bela",
    name: "فرع بيلا",
    address: "ميدان البوسطة",
    phones: ["01080188802", "01080188803", "01080188804"]
  }
];

window.HOTLINE = "17827";
window.WHATSAPP_NUMBER = "201040101101"; // رقم واتساب افتراضي (فرع المنصورة) — عدّله من الإدارة لو مختلف
window.ADMIN_PASSWORD = "soltan2026"; // ⚠️ غيّر الباسورد ده لحاجة خاصة بيك قبل النشر الفعلي

window.CATEGORIES = [
  { id: "offers",     label: "عروض السلطان" },
  { id: "shawarma",   label: "شاورما" },
  { id: "meals",      label: "وجبات" },
  { id: "sandwiches", label: "ساندوتشات" },
  { id: "family",     label: "وجبات عائلية" },
  { id: "sides",      label: "بطاطس ومقبلات" },
  { id: "drinks",     label: "مشروبات" }
];

// كل صنف: id, cat, name, desc, price (جنيه), img (رمز تعبيري أو رابط صورة), featured (اختياري)
window.MENU_ITEMS = [
  {
    id: "offer-combo-1",
    cat: "offers",
    name: "عرض شاورما كبير + بطاطس كبير",
    desc: "شاورما دجاج كبيرة مع طبق بطاطس كبير — العرض الأساسي لشاورما السلطان",
    price: 105,
    img: "PROMO",
    featured: true
  },
  {
    id: "shawarma-chicken-reg",
    cat: "shawarma",
    name: "شاورما دجاج (عادي)",
    desc: "شاورما دجاج مشوية على الفحم، مقرمشة، مع الصوص الخاص",
    price: 45,
    img: "🌯"
  },
  {
    id: "shawarma-chicken-large",
    cat: "shawarma",
    name: "شاورما دجاج (كبير)",
    desc: "حجم كبير من شاورما الدجاج المشوية بالفحم",
    price: 65,
    img: "🌯"
  },
  {
    id: "shawarma-meat-reg",
    cat: "shawarma",
    name: "شاورما لحمة (عادي)",
    desc: "شاورما لحم بقري طازج، تتبيلة السلطان الخاصة",
    price: 55,
    img: "🌯"
  },
  {
    id: "shawarma-meat-large",
    cat: "shawarma",
    name: "شاورما لحمة (كبير)",
    desc: "حجم كبير من شاورما اللحمة المشوية بالفحم",
    price: 80,
    img: "🌯"
  },
  {
    id: "meal-chicken",
    cat: "meals",
    name: "وجبة شاورما دجاج",
    desc: "شاورما دجاج + بطاطس + مشروب",
    price: 90,
    img: "🍽️"
  },
  {
    id: "meal-meat",
    cat: "meals",
    name: "وجبة شاورما لحمة",
    desc: "شاورما لحمة + بطاطس + مشروب",
    price: 110,
    img: "🍽️"
  },
  {
    id: "sandwich-chicken",
    cat: "sandwiches",
    name: "ساندوتش دجاج مشوي",
    desc: "صدور دجاج مشوية مع الخضار الطازجة",
    price: 40,
    img: "🥙"
  },
  {
    id: "sandwich-sultan",
    cat: "sandwiches",
    name: "ساندوتش السلطان الخاص",
    desc: "خلطة لحمة ودجاج مع الصوص السري",
    price: 60,
    img: "🥙"
  },
  {
    id: "family-1",
    cat: "family",
    name: "وجبة عائلية (٤ أفراد)",
    desc: "٤ شاورما مشكل + بطاطس كبير + ٤ مشروبات",
    price: 320,
    img: "👨‍👩‍👧‍👦"
  },
  {
    id: "family-2",
    cat: "family",
    name: "وجبة عائلية (٦ أفراد)",
    desc: "٦ شاورما مشكل + ٢ بطاطس كبير + ٦ مشروبات",
    price: 460,
    img: "👨‍👩‍👧‍👦"
  },
  {
    id: "fries-reg",
    cat: "sides",
    name: "بطاطس (عادي)",
    desc: "بطاطس مقرمشة طازجة",
    price: 25,
    img: "🍟"
  },
  {
    id: "fries-large",
    cat: "sides",
    name: "بطاطس (كبير)",
    desc: "طبق بطاطس كبير مقرمش",
    price: 35,
    img: "🍟"
  },
  {
    id: "garlic-sauce",
    cat: "sides",
    name: "صوص ثوم إضافي",
    desc: "علبة صوص ثوم إضافية",
    price: 10,
    img: "🧄"
  },
  {
    id: "drink-cola",
    cat: "drinks",
    name: "كوكاكولا",
    desc: "مشروب غازي بارد",
    price: 15,
    img: "🥤"
  },
  {
    id: "drink-water",
    cat: "drinks",
    name: "مياه معدنية",
    desc: "زجاجة مياه صغيرة",
    price: 8,
    img: "💧"
  }
];
