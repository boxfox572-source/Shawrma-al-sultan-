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
    isAdmin: false
  };

  function saveOrders(){
    localStorage.setItem("soltan_orders", JSON.stringify(state.orders));
  }

  function findItem(id){ return window.MENU_ITEMS.find(i => i.id === id); }

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
    const featured = window.MENU_ITEMS.find(i => i.featured);
    const cats = window.CATEGORIES.map(c => `
      <div class="chip ${state.activeCat===c.id ? 'active':''}" data-cat="${c.id}">${c.label}</div>
    `).join("");

    const items = window.MENU_ITEMS.filter(i => i.cat === state.activeCat);
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
    const offers = window.MENU_ITEMS.filter(i => i.cat === "offers");
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

  function renderAdminScreen(){
    const tabs = `
      <div class="admin-tabs">
        <div class="admin-tab ${state.adminTab==='orders'?'active':''}" data-admin-tab="orders">الطلبات</div>
        <div class="admin-tab ${state.adminTab==='items'?'active':''}" data-admin-tab="items">الأصناف</div>
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

    // items tab — read-only preview + note pointing to data.js
    const list = window.MENU_ITEMS.map(it => `
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
      </div>
    `).join("");

    return `
      <div class="section">
        <div class="section-title"><span class="bar"></span>إدارة الأصناف</div>
        ${tabs}
        <div class="empty-state" style="padding:16px; text-align:right;">
          <p style="line-height:1.7;">لتعديل الأصناف أو الأسعار أو رفع صور جديدة، حرّر ملف <b>data.js</b> مباشرة — كل صنف فيه: الاسم، الوصف، السعر، القسم، والصورة. هذا يعطيك تحكم كامل قبل ربط لوحة إدارة حقيقية بقاعدة بيانات.</p>
        </div>
        <div class="item-grid">${list}</div>
      </div>
    `;
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
        render();
      });
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
