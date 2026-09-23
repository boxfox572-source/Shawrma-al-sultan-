(function(){
  "use strict";

  // ---------- State ----------
  const state = {
    screen: "menu",       // menu | cart | offers | contact | admin
    activeCat: "offers",
    cart: {},              // { itemId: qty }
    orderType: "delivery", // delivery | pickup
    customer: { name:"", phone:"", address:"", notes:"" },
    orders: JSON.parse(localStorage.getItem("soltan_orders") || "[]"),
    adminTab: "orders",    // orders | items
    isAdmin: sessionStorage.getItem("soltan_admin_auth") === "1",
    loginError: false,
    editingItemId: null,   // null = not editing, "new" = new item, else existing id
    localItems: JSON.parse(localStorage.getItem("soltan_local_items") || "null")
  };

  // ---------- Local menu overrides (layered on top of data.js) ----------
  // If the admin has made edits, state.localItems holds the FULL current
  // menu array (a working copy of window.MENU_ITEMS). Otherwise we fall
  // back to window.MENU_ITEMS untouched.
  function getMenuItems(){
    return state.localItems || window.MENU_ITEMS;
  }
  function ensureLocalCopy(){
    if(!state.localItems){
      state.localItems = JSON.parse(JSON.stringify(window.MENU_ITEMS));
    }
  }
  function saveLocalItems(){
    localStorage.setItem("soltan_local_items", JSON.stringify(state.localItems));
  }
  function resetLocalItems(){
    state.localItems = null;
    localStorage.removeItem("soltan_local_items");
  }

  function saveOrders(){
    localStorage.setItem("soltan_orders", JSON.stringify(state.orders));
  }

  function findItem(id){ return getMenuItems().find(i => i.id === id); }

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
    // display as groups for readability, keep tel: href raw
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
    const img = item.img === "PROMO" ? window.PROMO_IMG : null;
    const thumbContent = img ? `<img src="${img}" alt="${item.name}">` : (item.img || "🍽️");
    const control = qty > 0
      ? `<div class="qty-control" data-id="${item.id}">
           <button class="qty-dec">−</button>
           <span>${qty}</span>
           <button class="qty-inc">+</button>
         </div>`
      : `<button class="add-btn" data-add="${item.id}">+</button>`;

    return `
      <div class="item-card">
        <div class="item-thumb">${thumbContent}</div>
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
          <div class="summary-row"><span>الإجمالي</span><span>${total} ج.م</span></div>
          <div class="summary-row total"><span>الإجمالي النهائي</span><span class="price">${total} ج.م</span></div>
        </div>

        <div class="section-title" style="margin-top:20px;"><span class="bar"></span>طريقة الاستلام</div>
        <div class="toggle-row">
          <div class="toggle-opt ${state.orderType==='delivery'?'active':''}" data-order-type="delivery">🛵 توصيل</div>
          <div class="toggle-opt ${state.orderType==='pickup'?'active':''}" data-order-type="pickup">🏬 استلام من الفرع</div>
        </div>

        ${state.orderType === 'pickup' ? `
        <div class="form-group">
          <label>اختر الفرع</label>
          <select id="pickupBranch">
            ${window.BRANCHES.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
          </select>
        </div>` : ``}

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
          <p style="line-height:1.7;">الصفحة دي محمية — أدخل كلمة السر الخاصة بالإدارة عشان تكمل.</p>
        </div>
        <div class="form-group">
          <label>كلمة السر</label>
          <input type="password" id="adminPasswordInput" placeholder="••••••••" autocomplete="off">
        </div>
        ${state.loginError ? `<p style="color:var(--ember); font-size:13px; margin-bottom:10px;">كلمة السر غلط، حاول تاني</p>` : ``}
        <button class="btn-primary" id="adminLoginBtn">دخول</button>
      </div>
    `;
  }

  function renderAdminScreen(){
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
      const orders = [...state.orders].reverse();
      const list = orders.map(o => `
        <div class="order-card">
          <div class="top-row">
            <span class="ord-id">طلب #${o.id}</span>
            <span class="status-badge ${o.status}">${statusLabel(o.status)}</span>
          </div>
          <div class="items-list">
            ${o.items.map(i => `${i.name} × ${i.qty}`).join("<br>")}
          </div>
          <div class="items-list" style="margin-bottom:10px;">
            👤 ${o.customer.name} — 📞 ${o.customer.phone}<br>
            ${o.orderType === 'delivery' ? `🛵 ${o.customer.address}` : `🏬 استلام: ${o.branch||''}`}
            <br>💰 الإجمالي: ${o.total} ج.م
          </div>
          <select class="status-select" data-order-id="${o.id}">
            <option value="pending" ${o.status==='pending'?'selected':''}>قيد الانتظار</option>
            <option value="preparing" ${o.status==='preparing'?'selected':''}>جاري التحضير</option>
            <option value="done" ${o.status==='done'?'selected':''}>تم التسليم</option>
          </select>
        </div>
      `).join("") || `<div class="empty-state"><div class="icon">📋</div><p>لا توجد طلبات بعد</p></div>`;

      return `<div class="section"><div class="section-title"><span class="bar"></span>إدارة الطلبات</div>${tabs}${list}</div>`;
    }

    // items tab — full add/edit/delete + export to data.js
    if(state.editingItemId !== null){
      return `<div class="section"><div class="section-title"><span class="bar"></span>${state.editingItemId==='new' ? 'إضافة صنف جديد' : 'تعديل الصنف'}</div>${renderItemEditForm()}</div>`;
    }

    const items = getMenuItems();
    const dirty = !!state.localItems;

    const list = items.map(it => `
      <div class="item-card">
        <div class="item-thumb">${it.img==='PROMO' ? `<img src="${window.PROMO_IMG}">` : it.img}</div>
        <div class="item-info">
          <div class="name">${it.name}</div>
          <div class="desc">${it.desc}</div>
          <div class="row-bottom">
            <span class="price">${it.price} ج.م</span>
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

        <button class="btn-primary" id="addNewItemBtn" style="margin-bottom:14px;">+ إضافة صنف جديد</button>

        ${dirty ? `
        <div class="empty-state" style="padding:14px; text-align:right; border:1px solid var(--gold); border-radius:14px; margin-bottom:14px;">
          <p style="line-height:1.7; font-size:13px;">⚠️ عندك تعديلات محفوظة على <b>هذا الموبايل بس</b>. عشان الزباين التانيين يشوفوا نفس التعديلات، اضغط "تصدير الكود" وانسخه في ملف <b>data.js</b> على GitHub.</p>
        </div>
        <button class="btn-primary" id="exportCodeBtn" style="background:var(--gold); color:#1a1210; margin-bottom:10px;">📋 تصدير الكود لـ data.js</button>
        <button class="admin-tab" id="resetLocalBtn" style="width:100%; margin-bottom:14px; color:var(--ember);">إلغاء كل التعديلات المحلية</button>
        ` : `
        <div class="empty-state" style="padding:14px; text-align:right; margin-bottom:14px;">
          <p style="line-height:1.7; font-size:13px;">التعديلات بتتحفظ على موبايلك، وبعدين تقدر تصدّر الكود الجاهز وتلزقه في <b>data.js</b> على GitHub عشان تظهر لكل الزباين.</p>
        </div>
        `}

        <div class="item-grid">${list}</div>
      </div>
    `;
  }

  function renderItemEditForm(){
    const isNew = state.editingItemId === "new";
    const item = isNew
      ? { id:"", cat: window.CATEGORIES[0].id, name:"", desc:"", price:"", img:"🍽️" }
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
        <button class="btn-primary" id="saveItemBtn" style="flex:1;">${isNew ? 'إضافة الصنف' : 'حفظ التعديل'}</button>
        <button class="admin-tab" id="cancelEditBtn" style="flex:1;">إلغاء</button>
      </div>
    `;
  }

  function slugify(text){
    return "item-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,6);
  }

  function saveItemFromForm(){
    const cat = document.getElementById("editCat").value;
    const name = document.getElementById("editName").value.trim();
    const desc = document.getElementById("editDesc").value.trim();
    const priceRaw = document.getElementById("editPrice").value;
    const img = document.getElementById("editImg").value.trim() || "🍽️";
    const price = parseFloat(priceRaw);

    if(!name){ showToast("من فضلك أدخل اسم الصنف"); return; }
    if(isNaN(price) || price < 0){ showToast("من فضلك أدخل سعر صحيح"); return; }

    ensureLocalCopy();

    if(state.editingItemId === "new"){
      state.localItems.push({ id: slugify(name), cat, name, desc, price, img });
      showToast("تمت إضافة الصنف");
    } else {
      const idx = state.localItems.findIndex(i => i.id === state.editingItemId);
      if(idx > -1){
        const prevFeatured = state.localItems[idx].featured;
        const prevImg = state.localItems[idx].img === 'PROMO' ? 'PROMO' : img;
        state.localItems[idx] = { ...state.localItems[idx], cat, name, desc, price, img: prevImg, featured: prevFeatured };
      }
      showToast("تم حفظ التعديل");
    }

    saveLocalItems();
    state.editingItemId = null;
    render();
  }

  function deleteItem(id){
    ensureLocalCopy();
    state.localItems = state.localItems.filter(i => i.id !== id);
    saveLocalItems();
    showToast("تم حذف الصنف");
    render();
  }

  function exportItemsCode(){
    const items = getMenuItems();
    const lines = items.map(it => {
      const imgVal = it.img === 'PROMO' ? `"PROMO"` : JSON.stringify(it.img);
      const featuredLine = it.featured ? `,\n    featured: true` : "";
      return `  {\n    id: ${JSON.stringify(it.id)},\n    cat: ${JSON.stringify(it.cat)},\n    name: ${JSON.stringify(it.name)},\n    desc: ${JSON.stringify(it.desc)},\n    price: ${it.price},\n    img: ${imgVal}${featuredLine}\n  }`;
    });
    const code = `window.MENU_ITEMS = [\n${lines.join(",\n")}\n];`;

    // Show in a simple prompt-like overlay via textarea for copy
    const ta = document.createElement("textarea");
    ta.value = code;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    try{
      document.execCommand("copy");
      showToast("تم نسخ الكود! الصقه في data.js مكان MENU_ITEMS");
    }catch(e){
      showToast("انسخ الكود يدويًا من المربع اللي ظهر");
    }
    document.body.removeChild(ta);

    // Also open a visible modal with the code as fallback for manual copy
    showExportModal(code);
  }

  function showExportModal(code){
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `
      <div style="background:var(--char-3); border:1px solid var(--line); border-radius:16px; padding:16px; max-width:440px; width:100%; max-height:80vh; display:flex; flex-direction:column; gap:10px;">
        <div style="font-weight:800; font-size:15px;">الكود الجاهز — انسخه والصقه في data.js</div>
        <textarea readonly style="flex:1; min-height:280px; background:var(--char-2); border:1px solid var(--line); border-radius:10px; color:var(--bone); padding:10px; font-family:monospace; font-size:11px; direction:ltr; text-align:left;">${code}</textarea>
        <button class="btn-primary" id="closeExportModal">تم</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("closeExportModal").addEventListener("click", ()=>{
      document.body.removeChild(overlay);
    });
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

  function render(){
    let body = "";
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
      const tryLogin = ()=>{
        const input = document.getElementById("adminPasswordInput");
        if(input && input.value === window.ADMIN_PASSWORD){
          state.isAdmin = true;
          state.loginError = false;
          sessionStorage.setItem("soltan_admin_auth", "1");
          render();
        } else {
          state.loginError = true;
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
      adminLogoutBtn.addEventListener("click", ()=>{
        state.isAdmin = false;
        sessionStorage.removeItem("soltan_admin_auth");
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

    const exportBtn = document.getElementById("exportCodeBtn");
    if(exportBtn) exportBtn.addEventListener("click", exportItemsCode);

    const resetBtn = document.getElementById("resetLocalBtn");
    if(resetBtn) resetBtn.addEventListener("click", ()=>{
      if(confirm("هيتم إلغاء كل التعديلات المحلية والرجوع لأصناف data.js الأصلية. متأكد؟")){
        resetLocalItems();
        showToast("تم إلغاء التعديلات المحلية");
        render();
      }
    });
    document.querySelectorAll("[data-order-id]").forEach(el=>{
      el.addEventListener("change", ()=>{
        const ord = state.orders.find(o=>o.id===el.dataset.orderId);
        if(ord){ ord.status = el.value; saveOrders(); render(); }
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

  function submitOrder(){
    if(Object.keys(state.cart).length === 0) return;
    if(!state.customer.name || !state.customer.phone){
      showToast("من فضلك أدخل الاسم ورقم الهاتف");
      return;
    }
    if(state.orderType === "delivery" && !state.customer.address){
      showToast("من فضلك أدخل العنوان");
      return;
    }

    const branchSelect = document.getElementById("pickupBranch");
    const branchName = branchSelect ? window.BRANCHES.find(b=>b.id===branchSelect.value)?.name : "";

    const order = {
      id: Date.now().toString().slice(-6),
      items: Object.keys(state.cart).map(id => {
        const it = findItem(id);
        return { id, name: it.name, qty: state.cart[id], price: it.price };
      }),
      total: cartTotal(),
      orderType: state.orderType,
      branch: branchName,
      customer: { ...state.customer },
      status: "pending",
      time: new Date().toISOString()
    };

    state.orders.push(order);
    saveOrders();
    state.cart = {};
    showToast(`تم إرسال الطلب #${order.id} بنجاح 🎉`);
    go("menu");
  }

  render();
})();
