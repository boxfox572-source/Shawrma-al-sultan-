(function(){
  "use strict";

  // ---------- State ----------
  const state = {
    screen: "menu",       // menu | cart | offers | contact | admin
    activeCat: "offers",
    cart: {},              // { itemId: qty }
    orderType: "delivery", // delivery | pickup
    customer: { name:"", phone:"", address:"", notes:"" },
    orders: [],             // loaded live from Firestore (admin only)
    menuItems: [],          // loaded live from Firestore; falls back to window.MENU_ITEMS until first snapshot arrives
    menuLoaded: false,
    adminTab: "orders",    // orders | items
    isAdmin: false,
    authChecked: false,
    loginError: "",
    editingItemId: null,   // null = not editing, "new" = new item, else existing id
    savingItem: false,
    feeDraft: {},          // admin: typed delivery fee per order id (survives live re-renders)
    branchId: "",          // selected branch (used for both delivery and pickup)
    lastOrder: null        // last submitted order, shown on the confirmation screen
  };

  let ordersUnsub = null;
  let menuUnsub = null;

  // ---------- Firestore-backed menu ----------
  function getMenuItems(){
    // Only trust Firestore data once it has actually returned items at least
    // once. An empty snapshot (e.g. a transient cache read before the seed
    // finishes writing) should never blank out the menu the customer sees.
    return (state.menuLoaded && state.menuItems.length > 0) ? state.menuItems : window.MENU_ITEMS;
  }

  // ---------- صور العروض ----------
  function isImgPath(v){
    return typeof v === "string" && /\.(webp|png|jpe?g)$/i.test(v);
  }
  function thumbHtml(it){
    if(it.img === "PROMO") return `<img src="${window.PROMO_IMG}" alt="${it.name}">`;
    if(isImgPath(it.img)) return `<img src="${it.img}" alt="${it.name}" loading="lazy">`;
    return it.img || "🍽️";
  }

  (function injectOfferStyles(){
    const st = document.createElement("style");
    st.textContent = `
      .offer-card{background:var(--char-2, #241915); border:1px solid var(--line); border-radius:18px; overflow:hidden; margin-bottom:16px; box-shadow:0 6px 18px rgba(0,0,0,.35);}
      .offer-card .offer-img{display:block; width:100%; height:auto; background:#000;}
      .offer-card .offer-body{padding:12px 14px 14px;}
      .offer-card .name{font-size:16px; font-weight:800; color:var(--bone); margin-bottom:4px;}
      .offer-card .desc{font-size:13px; color:var(--smoke); line-height:1.6; margin-bottom:10px;}
      .offer-card .row-bottom{display:flex; align-items:center; justify-content:space-between;}
      .offer-card .price{color:var(--gold); font-weight:800; font-size:18px;}
      .variants{margin-top:4px;}
      .vrow{display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px dashed var(--line);}
      .vrow .vlabel{flex:1; font-size:13px; color:var(--bone);}
      .vrow .price{color:var(--gold); font-weight:800; font-size:14px; white-space:nowrap;}
    `;
    document.head.appendChild(st);
  })();

  // ---------- أقسام المنيو الكامل ----------
  const MENU_CATS = [
    { id:"m_shawarma", label:"ساندوتشات الشاورما" },
    { id:"m_arabic",   label:"البوكسات العربي" },
    { id:"m_maria",    label:"الماريا" },
    { id:"m_crepe",    label:"الكريبات" },
    { id:"m_wsand",    label:"الساندوتشات الغربي" },
    { id:"m_potato",   label:"ساندوتشات البطاطس" },
    { id:"m_fatta",    label:"وجبات الفتة" },
    { id:"m_western",  label:"الوجبات الغربي" },
    { id:"m_pasta",    label:"مكرونة" },
    { id:"m_grill",    label:"فراخ الشواية" },
    { id:"m_pizza",    label:"البيتزا" },
    { id:"m_kilo",     label:"شاورما بالكيلو" },
    { id:"m_sweets",   label:"فطائر الحلو" },
    { id:"m_sides",    label:"المقبلات" }
  ];
  if(Array.isArray(window.CATEGORIES)){
    MENU_CATS.forEach(c => { if(!window.CATEGORIES.some(x => x.id === c.id)) window.CATEGORIES.push(c); });
  }

  // helper: V(labels, prices) => variants
  const V = (labels, prices) => labels.map((l,i) => ({ label:l, price:prices[i] })).filter(v => v.price != null);
  const SH = ["كبير","صاروخ","فينو","فرنسي"];
  const AR = ["6 قطع","9 قطع","12 قطعة","18 قطعة","الوجبة العائلي"];
  const ML = ["وسط (M)","كبير (L)"];
  const PZ = ["صغير","وسط","عائلي"];
  const LX = ["كبير (L)","إكس لارج (XL)"];

  // أسعار المنيو من المنيو المطبوع. الصور = إيموجي مؤقتًا لحد ما نجيب صور الأصناف.
  const MENU_IMPORT = [
    // ساندوتشات الشاورما
    { cat:"m_shawarma", img:"🌯", name:"ساندوتش شاورما دجاج", desc:"اختر الحجم", variants:V(SH,[80,90,80,90]) },
    { cat:"m_shawarma", img:"🌯", name:"ساندوتش شاورما لحم",  desc:"اختر الحجم", variants:V(SH,[90,100,90,100]) },
    { cat:"m_shawarma", img:"🌯", name:"ساندوتش شاورما ميكس", desc:"اختر الحجم", variants:V(SH,[85,95,85,95]) },
    // البوكسات العربي
    { cat:"m_arabic", img:"🍱", name:"وجبة عربي دجاج", desc:"اختر عدد القطع", variants:V(AR,[100,130,165,220,300]) },
    { cat:"m_arabic", img:"🍱", name:"وجبة عربي لحم",  desc:"اختر عدد القطع", variants:V(AR,[120,145,190,250,350]) },
    { cat:"m_arabic", img:"🍱", name:"وجبة عربي ميكس", desc:"اختر عدد القطع", variants:V(AR,[110,140,185,240,330]) },
    // الماريا
    { cat:"m_maria", img:"🥙", name:"الماريا الفراخ",    desc:"", price:130 },
    { cat:"m_maria", img:"🥙", name:"الماريا الكريسبي", desc:"", price:140 },
    { cat:"m_maria", img:"🥙", name:"الماريا اللحمة",    desc:"", price:150 },
    { cat:"m_maria", img:"🥙", name:"الماريا الميكس",    desc:"", price:140 },
    // الكريبات
    { cat:"m_crepe", img:"🌮", name:"كريب شاورما دجاج",   desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب شاورما لحم",    desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب شاورما مكس",    desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب زنجر",          desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب سوبر كرانشي",   desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب برجر",          desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب بانيه",         desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب مشكل فراخ",     desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب بطاطس",         desc:"", price:70 },
    { cat:"m_crepe", img:"🌮", name:"كريب شيش طاووق",     desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب كفتة",          desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب مشكل لحوم",     desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب كوردن بلو",     desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب سوسيس",         desc:"", price:120 },
    { cat:"m_crepe", img:"🌮", name:"كريب السلطان",       desc:"", price:135 },
    { cat:"m_crepe", img:"🌮", name:"كريب الأكيل",        desc:"", price:150 },
    // الساندوتشات الغربي (سوري / فينو)
    { cat:"m_wsand", img:"🥪", name:"ساندوتش شيش طاووق", desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش زنجر",       desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش كريسبي",     desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش كفتة",       desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش سوسيس",      desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش كوردن بلو",  desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش برجر جامبو", desc:"سوري / فينو", price:90 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش بانية",      desc:"سوري / فينو", price:80 },
    { cat:"m_wsand", img:"🥪", name:"ساندوتش السلطان",    desc:"سوري / فينو", price:100 },
    // ساندوتشات البطاطس
    { cat:"m_potato", img:"🍟", name:"ساندوتش بطاطس عادي",       desc:"اختر الحجم", variants:V(LX,[35,40]) },
    { cat:"m_potato", img:"🍟", name:"ساندوتش بطاطس موتزاريلا", desc:"اختر الحجم", variants:V(LX,[45,50]) },
    // وجبات الفتة
    { cat:"m_fatta", img:"🍛", name:"وجبة فتة دجاج", desc:"اختر الحجم", variants:V(ML,[100,140]) },
    { cat:"m_fatta", img:"🍛", name:"وجبة فتة لحم",  desc:"اختر الحجم", variants:V(ML,[110,160]) },
    { cat:"m_fatta", img:"🍛", name:"وجبة فتة مكس",  desc:"اختر الحجم", variants:V(ML,[105,150]) },
    // الوجبات الغربي
    { cat:"m_western", img:"🍗", name:"وجبة شيش طاووق", desc:"اختر الحجم", variants:V(ML,[100,140]) },
    { cat:"m_western", img:"🍗", name:"وجبة كفتة",       desc:"اختر الحجم", variants:V(ML,[100,140]) },
    { cat:"m_western", img:"🍗", name:"وجبة زنجر",       desc:"اختر الحجم", variants:V(ML,[100,140]) },
    { cat:"m_western", img:"🍗", name:"وجبة كريسبي",     desc:"اختر الحجم", variants:V(ML,[100,140]) },
    { cat:"m_western", img:"🍗", name:"وجبة مكس جريل",   desc:"اختر الحجم", variants:V(ML,[100,140]) },
    { cat:"m_western", img:"🍗", name:"وجبة السلطان",    desc:"حجم كبير (L)", variants:[{label:"كبير (L)", price:150}] },
    // مكرونة
    { cat:"m_pasta", img:"🍝", name:"مكرونة نجرسكو",         desc:"", price:120 },
    { cat:"m_pasta", img:"🍝", name:"مكرونة بشاميل",          desc:"", price:120 },
    { cat:"m_pasta", img:"🍝", name:"مكرونة تشكن رانش",       desc:"", price:130 },
    { cat:"m_pasta", img:"🍝", name:"مكرونة شاورما لحمة",     desc:"", price:130 },
    // فراخ الشواية
    { cat:"m_grill", img:"🍖", name:"ربع فرخة شواية ورك",  desc:"", price:110 },
    { cat:"m_grill", img:"🍖", name:"ربع فرخة شواية صدر",  desc:"", price:130 },
    { cat:"m_grill", img:"🍖", name:"نصف فرخة سادة",       desc:"", price:190 },
    { cat:"m_grill", img:"🍖", name:"نصف فرخة مع الأرز",   desc:"", price:210 },
    { cat:"m_grill", img:"🍖", name:"الفرخة السادة",       desc:"", price:360 },
    { cat:"m_grill", img:"🍖", name:"الفرخة مع الأرز",     desc:"", price:395 },
    // البيتزا (صغير / وسط / عائلي)
    { cat:"m_pizza", img:"🍕", name:"بيتزا مارجريتا",       desc:"اختر الحجم", variants:V(PZ,[130,180,220]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا جبنة رومي",      desc:"اختر الحجم", variants:V(PZ,[140,190,230]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا مشكل جبن",       desc:"اختر الحجم", variants:V(PZ,[140,190,230]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا مفروم",          desc:"اختر الحجم", variants:V(PZ,[150,200,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا سجق",            desc:"اختر الحجم", variants:V(PZ,[150,200,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا سوبر سوبريم",    desc:"اختر الحجم", variants:V(PZ,[170,220,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا سوسيس",          desc:"اختر الحجم", variants:V(PZ,[150,200,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا بسطرمة",         desc:"اختر الحجم", variants:V(PZ,[170,220,280]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا مشروم",          desc:"اختر الحجم", variants:V(PZ,[150,200,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا مشكل لحوم",      desc:"اختر الحجم", variants:V(PZ,[170,220,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا تونة",           desc:"اختر الحجم", variants:V(PZ,[150,200,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا جمبري",          desc:"اختر الحجم", variants:V(PZ,[200,250,320]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا سي فود",         desc:"اختر الحجم", variants:V(PZ,[200,250,320]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا شاورما فراخ",    desc:"اختر الحجم", variants:V(PZ,[160,210,290]) },
    // شاورما لحمة: سعر "الوسط" في المنيو المطبوع غير واضح (320 أعلى من العائلي) فتم تركه — أضفه من الإدارة بعد التأكد
    { cat:"m_pizza", img:"🍕", name:"بيتزا شاورما لحمة",    desc:"اختر الحجم", variants:[{label:"صغير",price:180},{label:"عائلي",price:310}] },
    { cat:"m_pizza", img:"🍕", name:"بيتزا مكس فراخ",       desc:"اختر الحجم", variants:V(PZ,[160,210,290]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا شيش طاووق",      desc:"اختر الحجم", variants:V(PZ,[160,210,290]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا كرانشي",         desc:"اختر الحجم", variants:V(PZ,[160,210,290]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا بانيه",          desc:"اختر الحجم", variants:V(PZ,[150,200,240]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا تشيكن باربكيو",  desc:"اختر الحجم", variants:V(PZ,[170,220,300]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا تشيكن رانشي",    desc:"اختر الحجم", variants:V(PZ,[170,220,300]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا السلطان",        desc:"اختر الحجم", variants:V(PZ,[180,230,310]) },
    { cat:"m_pizza", img:"🍕", name:"بيتزا حشو أطراف",      desc:"إضافة على البيتزا", variants:V(PZ,[40,60,70]) },
    // شاورما بالكيلو
    { cat:"m_kilo", img:"🥩", name:"شاورما دجاج بالكيلو", desc:"ربع كيلو", price:190 },
    { cat:"m_kilo", img:"🥩", name:"شاورما لحم بالكيلو",  desc:"ربع كيلو", price:240 },
    { cat:"m_kilo", img:"🥩", name:"شاورما مكس بالكيلو",  desc:"ربع كيلو", price:220 },
    // فطائر الحلو
    { cat:"m_sweets", img:"🥞", name:"فطيرة سكر",            desc:"", price:50 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة كاستر",          desc:"", price:60 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة بغاشة",          desc:"", price:80 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة نوتيلا",         desc:"", price:110 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة قشطة وعسل",      desc:"", price:130 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة بغاشة بالقشطة",  desc:"", price:100 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة جوز هند وزبيب",  desc:"", price:110 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة نوتيلا بندق",    desc:"", price:130 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة لوتس بندق",      desc:"", price:130 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة فور سيزون",      desc:"", price:180 },
    { cat:"m_sweets", img:"🥞", name:"فطيرة نوتيلا بالمكسرات", desc:"", price:150 },
    // المقبلات
    { cat:"m_sides", img:"🍚", name:"أرز بسمتي", desc:"", variants:[{label:"إكس لارج (XL)", price:50}] },
    { cat:"m_sides", img:"🧄", name:"ثومية",     desc:"", variants:V(["لارج (L)","إكس لارج (XL)"],[15,20]) },
    { cat:"m_sides", img:"🍟", name:"بطاطس",     desc:"", variants:[{label:"لارج (L)", price:25}] },
    { cat:"m_sides", img:"🥣", name:"طحينة",     desc:"", variants:V(["لارج (L)","إكس لارج (XL)"],[15,20]) },
    { cat:"m_sides", img:"🥒", name:"مخلل",      desc:"", variants:[{label:"لارج (L)", price:25}] }
  ];

  async function importFullMenu(){
    if(!window.db) return;
    if(!confirm("هيتم إضافة أصناف المنيو الكامل (الأصناف الموجودة بنفس الاسم والقسم مش هتتكرر). متأكد؟")) return;
    try{
      const key = i => `${i.cat}|${(i.name||"").trim()}`;
      const existing = new Set(state.menuItems.map(key));
      let order = state.menuItems.reduce((m,i)=> Math.max(m, i.order||0), 0);
      const todo = MENU_IMPORT.filter(i => !existing.has(key(i)));
      if(todo.length === 0){ showToast("المنيو موجود بالفعل"); return; }
      for(let start = 0; start < todo.length; start += 400){
        const batch = window.db.batch();
        todo.slice(start, start + 400).forEach(it => {
          const ref = window.db.collection("menuItems").doc();
          const price = it.variants ? Math.min(...it.variants.map(v => v.price)) : it.price;
          const doc = { cat:it.cat, name:it.name, desc:it.desc || "", price, img:it.img, order: ++order };
          if(it.variants) doc.variants = it.variants;
          batch.set(ref, doc);
        });
        await batch.commit();
      }
      showToast(`تمت إضافة ${todo.length} صنف ✅`);
    }catch(e){
      console.error(e);
      showToast("حصل خطأ أثناء إضافة المنيو");
    }
  }

  // عروض السلطان (تتضاف مرة واحدة من لوحة الإدارة ← الأصناف ← استيراد العروض)
  const OFFERS_IMPORT = [
    { name:"بوكس الأجنبي",          price:320, img:"images/ajnabi.webp",
      desc:"12 قطعة شاورما فراخ + 6 قطع شاورما لحمة + 6 قطع كريسبي + قطعة زنجر، مع بطاطس وتومية ومخلل وكاتشب" },
    { name:"بوكس نعناعة",           price:180, img:"images/naana.webp",
      desc:"6 قطع شاورما لحم + 6 قطع كريسبي + قطعة زنجر، مع بطاطس وتومية ومخلل" },
    { name:"وجبة دبل السلطان",      price:145, img:"images/double-soltan-meal.webp",
      desc:"شاورما فراخ مع بطاطس وتومية ومخلل وكاتشب" },
    { name:"اشتري وجبة واحصل على الثانية مجانًا", price:160, img:"images/buy-one-get-one.webp",
      desc:"وجبتين شاورما مع بطاطس وتومية ومخلل بسعر وجبة واحدة" },
    { name:"عرض بوكس الخماسي",      price:350, img:"images/khamasi.webp",
      desc:"5 شاورما كبير + بطاطس ساخنة + ثومية طازجة" },
    { name:"دبل السلطان (24 قطعة)", price:280, img:"images/double-soltan-24.webp",
      desc:"24 قطعة شاورما فراخ + ثومية + مخلل + بطاطس" },
    { name:"العرض العائلي",         price:350, img:"images/family.webp",
      desc:"30 قطعة شاورما فراخ + ثومية + مخلل + بطاطس + كاتشب" },
    { name:"عرض الفارس",            price:100, img:"images/fares.webp",
      desc:"2 شاورما دجاج كبير + ثومية + مخلل" },
    { name:"عرض الكرم",             price:220, img:"images/karam.webp",
      desc:"فتة وسط + بيتزا شاورما فراخ صغيرة (بدلاً من 260 جنيه) — متاح في فرع بيلا فقط" }
  ];

  async function importOffers(){
    if(!window.db) return;
    if(!confirm("هيتم إضافة عروض السلطان للمنيو (الأسماء الموجودة مسبقًا مش هتتكرر). متأكد؟")) return;
    try{
      const existing = new Set(state.menuItems.map(i => (i.name||"").trim()));
      const maxOrder = state.menuItems.reduce((m,i)=> Math.max(m, i.order||0), 0);
      const batch = window.db.batch();
      let n = 0;
      OFFERS_IMPORT.forEach((o, idx) => {
        if(existing.has(o.name)) return;
        const ref = window.db.collection("menuItems").doc();
        batch.set(ref, { cat:"offers", name:o.name, desc:o.desc, price:o.price, img:o.img, order: maxOrder + 1 + idx });
        n++;
      });
      if(n === 0){ showToast("العروض موجودة بالفعل"); return; }
      await batch.commit();
      showToast(`تمت إضافة ${n} عروض ✅`);
    }catch(e){
      console.error(e);
      showToast("حصل خطأ أثناء إضافة العروض");
    }
  }

  // الأصناف اللي ليها أحجام (variants) بتتحول لأصناف "افتراضية" في السلة: id~رقم_الحجم
  function findItem(id){
    const items = getMenuItems();
    const direct = items.find(i => i.id === id);
    if(direct) return direct;
    const parts = String(id).split("~");
    if(parts.length === 2){
      const base = items.find(i => i.id === parts[0]);
      const v = base && Array.isArray(base.variants) ? base.variants[Number(parts[1])] : null;
      if(v) return { ...base, id, name: `${base.name} — ${v.label}`, price: v.price, variants: null };
    }
    return undefined;
  }

  function startMenuListener(){
    if(!window.db) return;
    window.db.collection("menuItems").orderBy("order", "asc").onSnapshot((snap)=>{
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      state.menuItems = items;
      state.menuLoaded = true;
      render();
    }, (err)=>{
      console.error("menu listener error", err);
    });
  }

  // one-time migration helper: if Firestore menu is empty, seed it from data.js
  async function seedMenuIfEmpty(){
    if(!window.db) return;
    try{
      const snap = await window.db.collection("menuItems").limit(1).get();
      if(snap.empty){
        const batch = window.db.batch();
        window.MENU_ITEMS.forEach((it, idx)=>{
          const ref = window.db.collection("menuItems").doc();
          const { id, ...rest } = it;
          batch.set(ref, { ...rest, order: idx });
        });
        await batch.commit();
      }
    }catch(e){
      console.error("seed error", e);
    }
  }

  // ---------- Orders (Firestore) ----------
  function startOrdersListener(){
    if(!window.db) return;
    if(ordersUnsub) ordersUnsub();
    ordersUnsub = window.db.collection("orders").orderBy("time", "desc").limit(100)
      .onSnapshot((snap)=>{
        const orders = [];
        snap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
        state.orders = orders;
        render();
      }, (err)=>{
        console.error("orders listener error", err);
      });
  }
  function stopOrdersListener(){
    if(ordersUnsub){ ordersUnsub(); ordersUnsub = null; }
  }

  function cartCount(){
    return Object.values(state.cart).reduce((a,b)=>a+b, 0);
  }
  function cartTotal(){
    let t = 0;
    for(const id in state.cart){
      const it = findItem(id);
      if(it) t += it.price * state.cart[id];
    }
    return t;
  }

  function addToCart(id){
    state.cart[id] = (state.cart[id] || 0) + 1;
    showToast(`تمت الإضافة: ${findItem(id).name}`);
    render();
  }
  function decFromCart(id){
    if(!state.cart[id]) return;
    state.cart[id]--;
    if(state.cart[id] <= 0) delete state.cart[id];
    render();
  }
  function removeFromCart(id){
    delete state.cart[id];
    render();
  }

  let toastTimer;
  function showToast(msg){
    const el = document.getElementById("toast");
    if(!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> el.classList.remove("show"), 2200);
  }

  function fmtPhone(p){
    return p;
  }

  function go(screen){
    state.screen = screen;
    render();
    const s = document.querySelector(".screen");
    if(s) s.scrollTop = 0;
  }

  // ---------- Renderers ----------
  function renderTopbar(){
    return `
      <div class="topbar">
        <div class="logo-mark">${window.SOLTAN_LOGO_SVG}</div>
        <h1>شاورما السلطان</h1>
        <a class="hotline-pill" href="tel:${window.HOTLINE}">📞 ${window.HOTLINE}</a>
      </div>
    `;
  }

  function renderMenuScreen(){
    const featured = getMenuItems().find(i => i.featured);
    const cats = window.CATEGORIES.map(c => `
      <div class="chip ${state.activeCat===c.id ? 'active':''}" data-cat="${c.id}">${c.label}</div>
    `).join("");

    const items = getMenuItems().filter(i => i.cat === state.activeCat);
    const itemsHtml = items.map(renderItemCard).join("") || `
      <div class="empty-state"><div class="icon">🍽️</div><p>لا توجد أصناف في هذا القسم حاليًا</p></div>
    `;

    let heroHtml = "";
    if(featured){
      const img = featured.img === "PROMO" ? window.PROMO_IMG : "";
      heroHtml = `
        <div class="hero" data-item="${featured.id}">
          ${img ? `<img src="${img}" alt="${featured.name}">` : ""}
          <div class="hero-text">
            <div class="eyebrow">عرض السلطان</div>
            <h2>${featured.name}</h2>
            <div class="price-tag">${featured.price} جنيه</div>
          </div>
        </div>
      `;
    }

    return `
      ${heroHtml}
      <div class="cats">${cats}</div>
      <div class="section">
        <div class="section-title"><span class="bar"></span>${window.CATEGORIES.find(c=>c.id===state.activeCat)?.label || ""}</div>
        <div class="item-grid">${itemsHtml}</div>
      </div>
    `;
  }

  function renderItemCard(item){
    const qty = state.cart[item.id] || 0;
    const control = qty > 0
      ? `<div class="qty-control" data-id="${item.id}">
           <button class="qty-dec">−</button>
           <span>${qty}</span>
           <button class="qty-inc">+</button>
         </div>`
      : `<button class="add-btn" data-add="${item.id}">+</button>`;

    if(Array.isArray(item.variants) && item.variants.length){
      const rows = item.variants.map((v, i) => {
        const vid = `${item.id}~${i}`;
        const q = state.cart[vid] || 0;
        const ctrl = q > 0
          ? `<div class="qty-control" data-id="${vid}">
               <button class="qty-dec">−</button>
               <span>${q}</span>
               <button class="qty-inc">+</button>
             </div>`
          : `<button class="add-btn" data-add="${vid}">+</button>`;
        return `<div class="vrow"><span class="vlabel">${v.label}</span><span class="price">${v.price} ج.م</span>${ctrl}</div>`;
      }).join("");
      return `
        <div class="item-card">
          <div class="item-thumb">${thumbHtml(item)}</div>
          <div class="item-info">
            <div class="name">${item.name}</div>
            ${item.desc ? `<div class="desc">${item.desc}</div>` : ``}
            <div class="variants">${rows}</div>
          </div>
        </div>
      `;
    }

    if(item.cat === "offers" && isImgPath(item.img)){
      return `
        <div class="offer-card">
          <img class="offer-img" src="${item.img}" alt="${item.name}" loading="lazy">
          <div class="offer-body">
            <div class="name">${item.name}</div>
            <div class="desc">${item.desc}</div>
            <div class="row-bottom">
              <span class="price">${item.price} ج.م</span>
              ${control}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="item-card">
        <div class="item-thumb">${thumbHtml(item)}</div>
        <div class="item-info">
          <div class="name">${item.name}</div>
          <div class="desc">${item.desc}</div>
          <div class="row-bottom">
            <span class="price">${item.price} ج.م</span>
            ${control}
          </div>
        </div>
      </div>
    `;
  }

  function renderOffersScreen(){
    const offers = getMenuItems().filter(i => i.cat === "offers");
    const list = offers.map(renderItemCard).join("") || `
      <div class="empty-state"><div class="icon">🔥</div><p>لا توجد عروض حاليًا، تابعنا قريبًا</p></div>
    `;
    return `
      <div class="section">
        <div class="section-title"><span class="bar"></span>عروض السلطان</div>
        <div class="item-grid">${list}</div>
      </div>
    `;
  }

  function renderCartScreen(){
    const ids = Object.keys(state.cart);
    if(ids.length === 0){
      return `
        <div class="empty-state">
          <div class="icon">🛒</div>
          <p>السلة فارغة، أضف أصناف من المنيو</p>
        </div>
      `;
    }

    const itemsHtml = ids.map(id => {
      const it = findItem(id);
      if(!it) return "";
      const qty = state.cart[id];
      return `
        <div class="cart-item">
          <div class="info">
            <div class="name">${it.name}</div>
            <div class="unit">${it.price} ج.م × ${qty} = ${it.price*qty} ج.م</div>
          </div>
          <div class="qty-control" data-id="${id}">
            <button class="qty-dec">−</button>
            <span>${qty}</span>
            <button class="qty-inc">+</button>
          </div>
          <button class="remove-x" data-remove="${id}">✕</button>
        </div>
      `;
    }).join("");

    const total = cartTotal();

    return `
      <div class="section">
        <div class="section-title"><span class="bar"></span>سلة الطلبات</div>
        ${itemsHtml}

        <div class="summary-box">
          <div class="summary-row"><span>إجمالي الأصناف</span><span>${total} ج.م</span></div>
          ${state.orderType === 'delivery' ? `<div class="summary-row"><span>رسوم التوصيل</span><span>يحددها الموظف عند التأكيد</span></div>` : ``}
          <div class="summary-row total"><span>${state.orderType === 'delivery' ? 'إجمالي الأصناف (بدون التوصيل)' : 'الإجمالي النهائي'}</span><span class="price">${total} ج.م</span></div>
        </div>

        <div class="section-title" style="margin-top:20px;"><span class="bar"></span>طريقة الاستلام</div>
        <div class="toggle-row">
          <div class="toggle-opt ${state.orderType==='delivery'?'active':''}" data-order-type="delivery">🛵 توصيل</div>
          <div class="toggle-opt ${state.orderType==='pickup'?'active':''}" data-order-type="pickup">🏬 استلام من الفرع</div>
        </div>

        <div class="form-group">
          <label>${state.orderType === 'pickup' ? 'اختر الفرع' : 'اختر الفرع اللي هيجهز ويوصل طلبك'}</label>
          <select id="orderBranch">
            ${window.BRANCHES.map(b => `<option value="${b.id}" ${(state.branchId||window.BRANCHES[0].id)===b.id?'selected':''}>${b.name}</option>`).join("")}
          </select>
        </div>

        <div class="form-group">
          <label>الاسم</label>
          <input type="text" id="custName" placeholder="اسمك بالكامل" value="${state.customer.name}">
        </div>
        <div class="form-group">
          <label>رقم الهاتف</label>
          <input type="tel" id="custPhone" placeholder="01xxxxxxxxx" value="${state.customer.phone}">
        </div>
        ${state.orderType === 'delivery' ? `
        <div class="form-group">
          <label>العنوان</label>
          <textarea id="custAddress" placeholder="العنوان بالتفصيل">${state.customer.address}</textarea>
        </div>` : ``}
        <div class="form-group">
          <label>ملاحظات (اختياري)</label>
          <textarea id="custNotes" placeholder="مثال: بدون بصل، إضافة صوص...">${state.customer.notes}</textarea>
        </div>

        <button class="btn-primary" id="confirmOrderBtn">تأكيد الطلب — ${total} ج.م</button>
      </div>
    `;
  }

  function renderContactScreen(){
    const branches = window.BRANCHES.map(b => `
      <div class="branch-card">
        <h3>📍 ${b.name}</h3>
        <div class="addr">${b.address}</div>
        ${b.phones.map(p => `
          <div class="phone-row">
            <span class="num">${fmtPhone(p)}</span>
            <a class="call-btn" href="tel:${p}">📞</a>
          </div>
        `).join("")}
      </div>
    `).join("");

    return `
      <div class="section">
        <div class="hotline-big">
          <div class="label">الخط الساخن</div>
          <div class="num">${window.HOTLINE}</div>
        </div>
        <a class="wa-btn" href="https://wa.me/${window.WHATSAPP_NUMBER}" target="_blank">💬 تواصل عبر واتساب</a>

        <div class="section-title" style="margin-top:22px;"><span class="bar"></span>الفروع</div>
        ${branches}
      </div>
    `;
  }

  function renderAdminLogin(){
    return `
      <div class="section">
        <div class="section-title"><span class="bar"></span>دخول الإدارة</div>
        <div class="empty-state" style="padding:16px; text-align:right;">
          <p style="line-height:1.7;">الصفحة دي محمية بحساب إدارة آمن. سجّل دخول بالإيميل وكلمة السر بتاعة الإدارة.</p>
        </div>
        <div class="form-group">
          <label>الإيميل</label>
          <input type="email" id="adminEmailInput" placeholder="admin@example.com" autocomplete="off">
        </div>
        <div class="form-group">
          <label>كلمة السر</label>
          <input type="password" id="adminPasswordInput" placeholder="••••••••" autocomplete="off">
        </div>
        ${state.loginError ? `<p style="color:var(--ember); font-size:13px; margin-bottom:10px;">${state.loginError}</p>` : ``}
        <button class="btn-primary" id="adminLoginBtn">دخول</button>
      </div>
    `;
  }

  function renderAdminScreen(){
    if(!state.authChecked){
      return `<div class="empty-state"><div class="icon">⏳</div><p>جاري التحقق...</p></div>`;
    }
    if(!state.isAdmin){
      return renderAdminLogin();
    }

    const tabs = `
      <div class="admin-tabs">
        <div class="admin-tab ${state.adminTab==='orders'?'active':''}" data-admin-tab="orders">الطلبات</div>
        <div class="admin-tab ${state.adminTab==='items'?'active':''}" data-admin-tab="items">الأصناف</div>
        <div class="admin-tab" id="adminLogoutBtn" style="flex:0.6; color:var(--ember);">خروج</div>
      </div>
    `;

    if(state.adminTab === "orders"){
      const orders = state.orders;
      const list = orders.map(o => `
        <div class="order-card">
          <div class="top-row">
            <span class="ord-id">طلب #${o.id.slice(-6)}</span>
            <span class="status-badge ${o.status}">${statusLabel(o.status)}</span>
          </div>
          <div class="items-list">
            ${(o.items||[]).map(i => `${i.name} × ${i.qty}`).join("<br>")}
          </div>
          <div class="items-list" style="margin-bottom:10px;">
            👤 ${o.customer?.name||''} — 📞 ${o.customer?.phone||''}<br>
            ${o.orderType === 'delivery' ? `🛵 ${o.customer?.address||''}<br>🏬 الفرع: ${o.branch||''}` : `🏬 استلام: ${o.branch||''}`}
            ${o.orderType === 'delivery' ? `<br>🛵 رسوم التوصيل: ${o.feePending ? '<b style="color:var(--ember);">لم تُحدد بعد</b>' : (o.deliveryFee||0) + ' ج.م'}` : ``}
            <br>💰 الإجمالي: ${o.total} ج.م
          </div>
          ${o.orderType === 'delivery' ? `
          <div class="form-group" style="margin-bottom:10px;">
            <label>رسوم التوصيل (ج.م)</label>
            <div style="display:flex; gap:8px;">
              <input type="number" min="0" inputmode="numeric" data-fee-input="${o.id}" placeholder="مثال: 20" value="${state.feeDraft[o.id] !== undefined ? state.feeDraft[o.id] : (o.feePending ? '' : (o.deliveryFee||0))}">
              <button class="btn-primary" style="width:auto; padding:0 16px;" data-fee-save="${o.id}">حفظ</button>
            </div>
            ${o.feePending ? '' : `<a class="wa-btn" style="display:block; margin-top:8px;" target="_blank" rel="noopener" href="${customerWaLink(o)}">💬 ابعت الإجمالي للعميل</a>`}
          </div>` : ``}
          <select class="status-select" data-order-id="${o.id}">
            <option value="pending" ${o.status==='pending'?'selected':''}>قيد الانتظار</option>
            <option value="preparing" ${o.status==='preparing'?'selected':''}>جاري التحضير</option>
            <option value="done" ${o.status==='done'?'selected':''}>تم التسليم</option>
          </select>
        </div>
      `).join("") || `<div class="empty-state"><div class="icon">📋</div><p>لا توجد طلبات بعد</p></div>`;

      return `<div class="section"><div class="section-title"><span class="bar"></span>إدارة الطلبات</div>${tabs}${list}</div>`;
    }

    // items tab — full add/edit/delete, synced live to Firestore
    if(state.editingItemId !== null){
      return `<div class="section"><div class="section-title"><span class="bar"></span>${state.editingItemId==='new' ? 'إضافة صنف جديد' : 'تعديل الصنف'}</div>${renderItemEditForm()}</div>`;
    }

    const items = getMenuItems();

    const list = items.map(it => `
      <div class="item-card">
        <div class="item-thumb">${thumbHtml(it)}</div>
        <div class="item-info">
          <div class="name">${it.name}</div>
          <div class="desc">${it.desc}</div>
          <div class="row-bottom">
            <span class="price">${it.variants && it.variants.length ? 'من ' : ''}${it.price} ج.م</span>
            <span style="font-size:12px;color:var(--smoke)">${window.CATEGORIES.find(c=>c.id===it.cat)?.label||it.cat}</span>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <button class="call-btn" data-edit-item="${it.id}" title="تعديل">✏️</button>
          <button class="call-btn" data-delete-item="${it.id}" title="حذف" style="color:var(--ember);">🗑️</button>
        </div>
      </div>
    `).join("") || `<div class="empty-state"><div class="icon">🍽️</div><p>لا توجد أصناف بعد</p></div>`;

    return `
      <div class="section">
        <div class="section-title"><span class="bar"></span>إدارة الأصناف</div>
        ${tabs}

        <button class="btn-primary" id="addNewItemBtn" style="margin-bottom:10px;">+ إضافة صنف جديد</button>
        <button class="btn-primary" id="importMenuBtn" style="margin-bottom:10px; background:var(--gold); color:#1a1210;">📋 استيراد المنيو الكامل</button>
        <button class="btn-primary" id="importOffersBtn" style="margin-bottom:14px; background:var(--flame);">🔥 استيراد عروض السلطان (بالصور)</button>

        <div class="empty-state" style="padding:14px; text-align:right; margin-bottom:14px;">
          <p style="line-height:1.7; font-size:13px;">أي تعديل هنا بيظهر فورًا لكل الزباين، على كل الأجهزة.</p>
        </div>

        <div class="item-grid">${list}</div>
      </div>
    `;
  }

  function renderItemEditForm(){
    const isNew = state.editingItemId === "new";
    const item = isNew
      ? { cat: window.CATEGORIES[0].id, name:"", desc:"", price:"", img:"🍽️" }
      : getMenuItems().find(i => i.id === state.editingItemId) || {};

    const catOptions = window.CATEGORIES.map(c =>
      `<option value="${c.id}" ${item.cat===c.id?'selected':''}>${c.label}</option>`
    ).join("");

    return `
      <div class="form-group">
        <label>القسم</label>
        <select id="editCat">${catOptions}</select>
      </div>
      <div class="form-group">
        <label>اسم الصنف</label>
        <input type="text" id="editName" placeholder="مثال: شاورما دجاج كبير" value="${item.name || ''}">
      </div>
      <div class="form-group">
        <label>الوصف</label>
        <textarea id="editDesc" placeholder="وصف قصير للصنف">${item.desc || ''}</textarea>
      </div>
      <div class="form-group">
        <label>السعر (جنيه)</label>
        <input type="number" id="editPrice" placeholder="0" value="${item.price ?? ''}">
      </div>
      <div class="form-group">
        <label>رمز تعبيري للصورة (إيموجي)</label>
        <input type="text" id="editImg" placeholder="🌯" value="${item.img && item.img !== 'PROMO' ? item.img : ''}">
      </div>
      <div style="display:flex; gap:10px; margin-top:6px;">
        <button class="btn-primary" id="saveItemBtn" style="flex:1;" ${state.savingItem?'disabled':''}>${state.savingItem ? 'جاري الحفظ...' : (isNew ? 'إضافة الصنف' : 'حفظ التعديل')}</button>
        <button class="admin-tab" id="cancelEditBtn" style="flex:1;">إلغاء</button>
      </div>
    `;
  }

  async function saveItemFromForm(){
    const cat = document.getElementById("editCat").value;
    const name = document.getElementById("editName").value.trim();
    const desc = document.getElementById("editDesc").value.trim();
    const priceRaw = document.getElementById("editPrice").value;
    const img = document.getElementById("editImg").value.trim() || "🍽️";
    const price = parseFloat(priceRaw);

    if(!name){ showToast("من فضلك أدخل اسم الصنف"); return; }
    if(isNaN(price) || price < 0){ showToast("من فضلك أدخل سعر صحيح"); return; }

    state.savingItem = true;
    render();

    try{
      if(state.editingItemId === "new"){
        const maxOrder = state.menuItems.reduce((m,i)=>Math.max(m, i.order||0), 0);
        await window.db.collection("menuItems").add({ cat, name, desc, price, img, order: maxOrder+1 });
        showToast("تمت إضافة الصنف للجميع");
      } else {
        const existing = state.menuItems.find(i=>i.id===state.editingItemId);
        const finalImg = existing && existing.img === 'PROMO' ? 'PROMO' : img;
        await window.db.collection("menuItems").doc(state.editingItemId).update({ cat, name, desc, price, img: finalImg });
        showToast("تم حفظ التعديل للجميع");
      }
      state.editingItemId = null;
    }catch(e){
      console.error(e);
      showToast("حصل خطأ أثناء الحفظ، حاول تاني");
    }
    state.savingItem = false;
    render();
  }

  async function deleteItem(id){
    try{
      await window.db.collection("menuItems").doc(id).delete();
      showToast("تم حذف الصنف للجميع");
    }catch(e){
      console.error(e);
      showToast("حصل خطأ أثناء الحذف");
    }
  }

  function statusLabel(s){
    return { pending:"قيد الانتظار", preparing:"جاري التحضير", done:"تم التسليم" }[s] || s;
  }

  function renderBottomNav(){
    const items = [
      { id:"menu",    icon:"🍽️", label:"المنيو" },
      { id:"offers",  icon:"🔥", label:"العروض" },
      { id:"cart",    icon:"🛒", label:"السلة", badge: cartCount() },
      { id:"contact", icon:"📞", label:"تواصل" },
      { id:"admin",   icon:"⚙️", label:"الإدارة" },
    ];
    return `
      <div class="bottomnav">
        ${items.map(i => `
          <button class="nav-btn ${state.screen===i.id?'active':''}" data-nav="${i.id}">
            <span class="icon">${i.icon}</span>
            <span>${i.label}</span>
            ${i.badge ? `<span class="badge">${i.badge}</span>` : ""}
          </button>
        `).join("")}
      </div>
    `;
  }

  function customerWaLink(o){
    let ph = String((o.customer && o.customer.phone) || "").replace(/\D/g, "");
    if(ph.startsWith("0")) ph = "20" + ph.slice(1);
    const lines = (o.items||[]).map(i => `• ${i.name} × ${i.qty}`).join("\n");
    const text =
      `أهلاً ${(o.customer && o.customer.name) || ""} 👋\n` +
      `طلبك #${o.id.slice(-6)} من شاورما السلطان:\n${lines}\n` +
      `إجمالي الأصناف: ${o.subtotal != null ? o.subtotal : (o.total - (o.deliveryFee||0))} ج.م\n` +
      `رسوم التوصيل: ${o.deliveryFee||0} ج.م\n` +
      `الإجمالي النهائي: ${o.total} ج.م`;
    return `https://wa.me/${ph}?text=${encodeURIComponent(text)}`;
  }

  async function saveDeliveryFee(orderId){
    const input = document.querySelector(`[data-fee-input="${orderId}"]`);
    const fee = Number(input ? input.value : NaN);
    if(!input || input.value === "" || isNaN(fee) || fee < 0){
      showToast("اكتب رسوم توصيل صحيحة");
      return;
    }
    const o = state.orders.find(x => x.id === orderId);
    if(!o) return;
    const subtotal = o.subtotal != null ? o.subtotal : (o.total - (o.deliveryFee||0));
    try{
      await window.db.collection("orders").doc(orderId).update({
        subtotal: subtotal,
        deliveryFee: fee,
        feePending: false,
        total: subtotal + fee
      });
      delete state.feeDraft[orderId];
      showToast("تم حفظ رسوم التوصيل ✅");
    }catch(e){
      console.error(e);
      showToast("حصل خطأ أثناء حفظ الرسوم");
    }
  }

  function renderConfirmScreen(){
    const o = state.lastOrder;
    if(!o) return `<div class="empty-state"><div class="icon">🍽️</div><p>لا يوجد طلب</p></div>`;
    const waUrl = `https://wa.me/${window.WHATSAPP_NUMBER}?text=${encodeURIComponent(o.waText)}`;
    return `
      <div class="section" style="text-align:center;">
        <div style="font-size:64px;">✅</div>
        <div class="section-title" style="justify-content:center;"><span class="bar"></span>تم استلام طلبك</div>
        <p style="margin:8px 0;">رقم الطلب: <b>#${o.shortId}</b></p>
        <p style="margin:8px 0;">${o.orderType==='delivery' ? '🛵 توصيل' : '🏬 استلام'} — ${o.branch}</p>
        <p style="margin:8px 0;">💰 إجمالي الأصناف: <b>${o.total} ج.م</b></p>
        ${o.orderType==='delivery' ? `<p style="margin:8px 0;">🛵 رسوم التوصيل هيحددها الموظف حسب منطقتك وهنأكد لك الإجمالي النهائي.</p>` : ``}
        <a class="wa-btn" href="${waUrl}" target="_blank" rel="noopener" style="display:block; margin:16px 0;">💬 ابعت الطلب على واتساب للتأكيد</a>
        <button class="btn-primary" id="backToMenuBtn">رجوع للمنيو</button>
      </div>
    `;
  }

  function render(){
    let body = "";
    if(state.screen === "confirm") body = renderConfirmScreen();
    else
    if(state.screen === "menu") body = renderMenuScreen();
    else if(state.screen === "offers") body = renderOffersScreen();
    else if(state.screen === "cart") body = renderCartScreen();
    else if(state.screen === "contact") body = renderContactScreen();
    else if(state.screen === "admin") body = renderAdminScreen();

    document.getElementById("app").innerHTML = `
      ${renderTopbar()}
      <div class="screen">${body}</div>
      ${renderBottomNav()}
      <div class="toast" id="toast"></div>
    `;
    bindEvents();
  }

  function bindEvents(){
    document.querySelectorAll("[data-nav]").forEach(el=>{
      el.addEventListener("click", ()=> go(el.dataset.nav));
    });
    document.querySelectorAll("[data-cat]").forEach(el=>{
      el.addEventListener("click", ()=>{
        state.activeCat = el.dataset.cat;
        render();
      });
    });
    document.querySelectorAll("[data-add]").forEach(el=>{
      el.addEventListener("click", ()=> addToCart(el.dataset.add));
    });
    document.querySelectorAll(".qty-control").forEach(el=>{
      const id = el.dataset.id;
      el.querySelector(".qty-inc").addEventListener("click", ()=> addToCart(id));
      el.querySelector(".qty-dec").addEventListener("click", ()=> decFromCart(id));
    });
    document.querySelectorAll("[data-remove]").forEach(el=>{
      el.addEventListener("click", ()=> removeFromCart(el.dataset.remove));
    });
    const branchEl = document.getElementById("orderBranch");
    if(branchEl){
      if(!state.branchId) state.branchId = branchEl.value;
      branchEl.addEventListener("change", ()=>{ state.branchId = branchEl.value; });
    }
    const importMenuBtn = document.getElementById("importMenuBtn");
    if(importMenuBtn) importMenuBtn.addEventListener("click", importFullMenu);
    const importBtn = document.getElementById("importOffersBtn");
    if(importBtn) importBtn.addEventListener("click", importOffers);
    const backBtn = document.getElementById("backToMenuBtn");
    if(backBtn) backBtn.addEventListener("click", ()=>{ state.lastOrder = null; go("menu"); });
    document.querySelectorAll("[data-order-type]").forEach(el=>{
      el.addEventListener("click", ()=>{
        state.orderType = el.dataset.orderType;
        render();
      });
    });
    document.querySelectorAll("[data-admin-tab]").forEach(el=>{
      el.addEventListener("click", ()=>{
        state.adminTab = el.dataset.adminTab;
        state.editingItemId = null;
        render();
      });
    });

    const adminLoginBtn = document.getElementById("adminLoginBtn");
    if(adminLoginBtn){
      const tryLogin = async ()=>{
        const emailInput = document.getElementById("adminEmailInput");
        const pwInput = document.getElementById("adminPasswordInput");
        const email = emailInput ? emailInput.value.trim() : "";
        const pw = pwInput ? pwInput.value : "";
        if(!email || !pw){
          state.loginError = "من فضلك أدخل الإيميل وكلمة السر";
          render();
          return;
        }
        state.loginError = "";
        try{
          await window.auth.signInWithEmailAndPassword(email, pw);
          // onAuthStateChanged handler will update state.isAdmin and re-render
        }catch(e){
          state.loginError = "الإيميل أو كلمة السر غلط";
          render();
        }
      };
      adminLoginBtn.addEventListener("click", tryLogin);
      const pwInput = document.getElementById("adminPasswordInput");
      if(pwInput){
        pwInput.addEventListener("keydown", (e)=>{
          if(e.key === "Enter") tryLogin();
        });
      }
    }

    const adminLogoutBtn = document.getElementById("adminLogoutBtn");
    if(adminLogoutBtn){
      adminLogoutBtn.addEventListener("click", async ()=>{
        await window.auth.signOut();
        state.adminTab = "orders";
        render();
      });
    }
    document.querySelectorAll("[data-edit-item]").forEach(el=>{
      el.addEventListener("click", ()=>{
        state.editingItemId = el.dataset.editItem;
        render();
      });
    });
    document.querySelectorAll("[data-delete-item]").forEach(el=>{
      el.addEventListener("click", ()=>{
        if(confirm("متأكد إنك عايز تحذف الصنف ده؟")) deleteItem(el.dataset.deleteItem);
      });
    });
    const addNewBtn = document.getElementById("addNewItemBtn");
    if(addNewBtn) addNewBtn.addEventListener("click", ()=>{ state.editingItemId = "new"; render(); });

    const saveItemBtn = document.getElementById("saveItemBtn");
    if(saveItemBtn) saveItemBtn.addEventListener("click", saveItemFromForm);

    const cancelEditBtn = document.getElementById("cancelEditBtn");
    if(cancelEditBtn) cancelEditBtn.addEventListener("click", ()=>{ state.editingItemId = null; render(); });

    document.querySelectorAll("[data-fee-input]").forEach(el=>{
      el.addEventListener("input", ()=>{ state.feeDraft[el.dataset.feeInput] = el.value; });
    });
    document.querySelectorAll("[data-fee-save]").forEach(el=>{
      el.addEventListener("click", ()=> saveDeliveryFee(el.dataset.feeSave));
    });

    document.querySelectorAll("[data-order-id]").forEach(el=>{
      el.addEventListener("change", async ()=>{
        try{
          await window.db.collection("orders").doc(el.dataset.orderId).update({ status: el.value });
        }catch(e){
          console.error(e);
          showToast("حصل خطأ أثناء تحديث الحالة");
        }
      });
    });

    const confirmBtn = document.getElementById("confirmOrderBtn");
    if(confirmBtn){
      confirmBtn.addEventListener("click", submitOrder);
    }
    ["custName","custPhone","custAddress","custNotes"].forEach(id=>{
      const el = document.getElementById(id);
      if(el){
        el.addEventListener("input", ()=>{
          const map = { custName:"name", custPhone:"phone", custAddress:"address", custNotes:"notes" };
          state.customer[map[id]] = el.value;
        });
      }
    });
  }

  async function submitOrder(){
    if(Object.keys(state.cart).length === 0) return;
    if(!state.customer.name || !state.customer.phone){
      showToast("من فضلك أدخل الاسم ورقم الهاتف");
      return;
    }
    if(state.orderType === "delivery" && !state.customer.address){
      showToast("من فضلك أدخل العنوان");
      return;
    }

    const branchObj = window.BRANCHES.find(b=>b.id===(state.branchId || window.BRANCHES[0].id)) || window.BRANCHES[0];
    const branchName = branchObj ? branchObj.name : "";

    const order = {
      items: Object.keys(state.cart).map(id => {
        const it = findItem(id);
        return { id, name: it.name, qty: state.cart[id], price: it.price };
      }),
      subtotal: cartTotal(),
      deliveryFee: 0,
      feePending: state.orderType === "delivery",   // الموظف هيضيف رسوم التوصيل
      total: cartTotal(),
      orderType: state.orderType,
      branch: branchName || "",
      customer: { ...state.customer },
      status: "pending",
      time: firebase.firestore.FieldValue.serverTimestamp()
    };

    const confirmBtn = document.getElementById("confirmOrderBtn");
    if(confirmBtn){ confirmBtn.disabled = true; confirmBtn.textContent = "جاري الإرسال..."; }

    try{
      const ref = await window.db.collection("orders").add(order);
      const shortId = ref.id.slice(-6);
      const lines = order.items.map(i => `• ${i.name} × ${i.qty} = ${i.price*i.qty} ج.م`).join("\n");
      const waText =
        `طلب جديد #${shortId}\n` +
        `${lines}\n` +
        `إجمالي الأصناف: ${order.total} ج.م\n` +
        (order.orderType==='delivery' ? `(رسوم التوصيل هتتحدد من الموظف حسب منطقتك)\n` : ``) +
        `${order.orderType==='delivery' ? 'توصيل' : 'استلام من الفرع'} — ${order.branch}\n` +
        `الاسم: ${order.customer.name}\n` +
        `الهاتف: ${order.customer.phone}\n` +
        (order.orderType==='delivery' ? `العنوان: ${order.customer.address}\n` : ``) +
        (order.customer.notes ? `ملاحظات: ${order.customer.notes}` : ``);
      state.lastOrder = { shortId, total: order.total, orderType: order.orderType, branch: order.branch, waText };
      state.cart = {};
      go("confirm");
    }catch(e){
      console.error(e);
      showToast("حصل خطأ أثناء إرسال الطلب، حاول تاني");
      render();
    }
  }

  // ---------- Auth state wiring ----------
  function initAuth(){
    if(!window.auth){
      state.authChecked = true;
      render();
      return;
    }
    window.auth.onAuthStateChanged((user)=>{
      state.isAdmin = !!user;
      state.authChecked = true;
      if(user){
        startOrdersListener();
      } else {
        stopOrdersListener();
        state.orders = [];
      }
      render();
    });
  }

  // ---------- Boot ----------
  render();
  initAuth();
  seedMenuIfEmpty().finally(startMenuListener);
})();
