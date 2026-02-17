/* =========================
   Premium Menu App (Vanilla JS)
   - Loads from data.json
   - Builds tabs + sections + cards
   - ScrollSpy highlight
   - Intersection animations (minimal)
   - Theme + pattern background
   - CART: add/remove/qty + localStorage + WhatsApp checkout
   - Back To Top button
   - (Optional) Save order to Google Sheet (fire-and-forget)
   - Customer Data TTL (5 minutes)
   - Cart: Clear on Refresh + TTL (3 minutes inactivity)
   ========================= */

const $ = (sel, root = document) => root.querySelector(sel);

/* ---------- App State ---------- */
const state = {
  data: null,
  sectionEls: [],
  tabEls: [],
  activeId: null,
};

/* ---------- Storage ---------- */
const CART_KEY = "menu_cart_v1";
const NOTE_KEY = "menu_cart_note_v1";

/* ✅ بيانات العميل (5 دقائق فقط) */
const CUSTOMER_KEY = "menu_customer_v1";
const CUSTOMER_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* ✅ السلة: Activity + TTL (3 دقائق عدم استخدام) */
const CART_ACTIVITY_KEY = "menu_cart_last_activity_v1";
const CART_TTL_MS = 3 * 60 * 1000; // 3 minutes

/* ✅ لازم يكون /exec (مش /exe) */
const SHEET_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbwQaeNMjx-tYVAQYI8_R9OOOqj1P5m5go-llqZSZjPN0Bn5drpIu0SfYbyqEo8Rq2i5DA/exec";

/* =========================
   Cart: Clear on Refresh (early)
   ========================= */
(function clearCartOnRefreshEarly() {
  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0];
    const isReload = nav?.type === "reload";
    if (!isReload) return;

    try { localStorage.removeItem(CART_KEY); } catch {}
    try { localStorage.removeItem(NOTE_KEY); } catch {}
    try { localStorage.removeItem(CART_ACTIVITY_KEY); } catch {}
    // ملاحظة: بيانات العميل مش بنمسحها هنا (عندك TTL 5 دقائق + مسح بعد الإتمام)
  } catch {}
})();

const cart = {
  items: loadCart(),
};

init().catch(console.error);

/* =========================
   Boot
   ========================= */
async function init() {
  const loading = $("#loading");

  // ✅ TTL check عند بداية الصفحة (لو انتهت الـ 3 دقائق)
  checkCartTTLAndMaybeClear({ notify: false });

  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load data.json");
  const data = await res.json();
  state.data = data;

  applyTheme(data);
  fillHero(data);
  buildMenu(data);

  setupCartUI();
  updateCartUI();

  setupRevealAnimations();
  setupScrollSpy();
  setupBackToTop();

  // ✅ جدولة مسح السلة لو انتهت المدة أثناء بقاء الصفحة مفتوحة
  scheduleCartExpiryCheck();

  requestAnimationFrame(() => loading?.classList.add("hidden"));
}

/* =========================
   Theme + Pattern Background
   ========================= */
function applyTheme(data) {
  const theme = data.themeColor || "#ff2b2b";
  const accent = "#f7c96a";

  document.documentElement.style.setProperty("--theme", theme);
  document.documentElement.style.setProperty("--accent", accent);

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  themeMeta?.setAttribute("content", theme);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="520" height="520" viewBox="0 0 520 520">
    <defs>
      <style>
        .t{
          font: 900 96px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial;
          fill: none;
          stroke: ${accent};
          stroke-width: 3;
          opacity: .35;
        }
      </style>
    </defs>

    <rect width="520" height="520" fill="transparent"/>
    <g transform="translate(20,40) rotate(-18)">
      <text class="t" x="0" y="110">FRIED</text>
      <text class="t" x="0" y="220">CHICKEN</text>
      <text class="t" x="0" y="330">FRIED</text>
      <text class="t" x="0" y="440">CHICKEN</text>
    </g>
    <circle cx="160" cy="310" r="120" fill="${accent}" opacity=".06"/>
  </svg>`.trim();

  const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  const bg = $(".bg-pattern");
  if (bg) bg.style.backgroundImage = `url("data:image/svg+xml,${encoded}")`;
}

/* =========================
   Hero
   ========================= */
function fillHero(data) {
  document.title = data.restaurantName || "Menu";

  $("#restaurantName").textContent = data.restaurantName || "اسم المطعم";
  $("#restaurantDesc").textContent = data.description || "وصف قصير للمطعم";

  const logo = $("#restaurantLogo");
  if (logo) {
    logo.src = data.logo || "";
    logo.onerror = () => {
      logo.src =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
            <rect width="96" height="96" rx="18" fill="rgba(255,255,255,0.65)"/>
            <text x="50%" y="54%" text-anchor="middle" font-size="18" font-family="Arial" fill="#111">LOGO</text>
          </svg>`
        );
    };
  }

  const phone = sanitizePhone(data.phone || "");
  const callBtn = $("#callBtn");
  if (callBtn) callBtn.href = phone ? `tel:${phone}` : "#";
}

/* =========================
   Build Menu
   ========================= */
function buildMenu(data) {
  const tabsRoot = $("#tabs");
  const sectionsRoot = $("#sections");
  if (!tabsRoot || !sectionsRoot) return;

  tabsRoot.innerHTML = "";
  sectionsRoot.innerHTML = "";

  const sections = Array.isArray(data.sections) ? data.sections : [];

  sections.forEach((sec, idx) => {
    const id = slugify(sec.title || `section-${idx}`);

    const tab = document.createElement("button");
    tab.className = "tab";
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.dataset.target = id;
    tab.textContent = sec.title || "قسم";
    tab.addEventListener("click", () => {
      scrollToSection(id);
      setActiveTab(id, { center: true });
    });
    tabsRoot.appendChild(tab);

    const sectionEl = document.createElement("section");
    sectionEl.className = "section";
    sectionEl.id = id;

    const items = Array.isArray(sec.items) ? sec.items : [];

    sectionEl.innerHTML = `
      <div class="section-head">
        <h2 class="section-title">${escapeHtml(sec.title || "قسم")}</h2>
        <div class="section-count">${items.length} عنصر</div>
      </div>
      <div class="grid"></div>
    `;

    const grid = $(".grid", sectionEl);

    items.forEach((item, itemIndex) => {
      const card = document.createElement("article");
      card.className = "card reveal";

      const safeName = escapeHtml(item.name || "منتج");
      const safeDesc = escapeHtml(item.description || "");
      const safePrice = escapeHtml(item.price || "");
      const imgSrc = item.image || "";
      const badgeText = itemIndex === 0 ? "الأكثر طلبًا" : "";

      card.innerHTML = `
        <div class="card-media">
          ${badgeText ? `<div class="badge">${badgeText}</div>` : ""}
          <img src="${escapeAttr(imgSrc)}" alt="${safeName}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${safeName}</h3>
          <p class="card-desc">${safeDesc || " "}</p>
          <div class="card-footer">
            <div class="price">${safePrice}</div>
            <button class="add-btn" type="button">أضف للسلة</button>
          </div>
        </div>
      `;

      $(".add-btn", card).addEventListener("click", () => {
        addToCart(sec.title || "قسم", item);
        openCart();
      });

      const img = $("img", card);
      img.addEventListener("error", () => {
        img.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480">
              <rect width="800" height="480" fill="rgba(255,255,255,0.35)"/>
              <text x="50%" y="50%" text-anchor="middle" font-size="34" font-family="Arial" fill="rgba(0,0,0,0.55)">No Image</text>
            </svg>`
          );
      });

      grid.appendChild(card);
    });

    sectionsRoot.appendChild(sectionEl);
  });

  state.sectionEls = [...document.querySelectorAll(".section")];
  state.tabEls = [...document.querySelectorAll(".tab")];

  const firstId = state.sectionEls[0]?.id;
  if (firstId) setActiveTab(firstId, { center: false });
}

/* =========================
   Scroll helpers
   ========================= */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const headerH = getPx("--headerHeight");
  const tabH = getPx("--tabHeight");
  const offset = headerH + tabH + 14;

  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

function setActiveTab(id, opts = { center: false }) {
  if (state.activeId === id) return;
  state.activeId = id;

  state.tabEls.forEach((t) => t.classList.toggle("active", t.dataset.target === id));

  if (opts.center) {
    const active = state.tabEls.find((t) => t.dataset.target === id);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

/* =========================
   ScrollSpy
   ========================= */
function setupScrollSpy() {
  const headerH = getPx("--headerHeight");
  const tabH = getPx("--tabHeight");

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (visible?.target?.id) setActiveTab(visible.target.id, { center: false });
    },
    {
      threshold: [0.22, 0.33, 0.45, 0.6],
      rootMargin: `-${headerH + tabH + 28}px 0px -55% 0px`,
    }
  );

  state.sectionEls.forEach((sec) => observer.observe(sec));
}

/* =========================
   Reveal animations
   ========================= */
function setupRevealAnimations() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
  );
  els.forEach((el) => io.observe(el));
}

/* =========================
   Back To Top ✅
   ========================= */
function setupBackToTop() {
  const btn = $("#backToTop");
  if (!btn) return;

  const toggle = () => {
    const show = window.scrollY > 450;
    btn.classList.toggle("show", show);
  };

  toggle();
  window.addEventListener("scroll", toggle, { passive: true });

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ===========================================================
   CART
   =========================================================== */
function loadCart() {
  // ✅ TTL check قبل القراءة
  checkCartTTLAndMaybeClear({ notify: false });

  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart.items));
  updateCartUI();
}

function loadNote() {
  try {
    return localStorage.getItem(NOTE_KEY) || "";
  } catch {
    return "";
  }
}

function saveNote(v) {
  try {
    localStorage.setItem(NOTE_KEY, v || "");
  } catch {}
}

/* ---------- Cart TTL helpers ---------- */
function clearCartStorage({ notify = false } = {}) {
  try { localStorage.removeItem(CART_KEY); } catch {}
  try { localStorage.removeItem(NOTE_KEY); } catch {}
  try { localStorage.removeItem(CART_ACTIVITY_KEY); } catch {}
  cart.items = {};
  updateCartUI();
  if (notify) toast("تم مسح السلة لانتهاء المدة ⏳");
}

function updateCartActivity() {
  try {
    localStorage.setItem(CART_ACTIVITY_KEY, String(Date.now()));
  } catch {}
  scheduleCartExpiryCheck();
}

function checkCartTTLAndMaybeClear({ notify = true } = {}) {
  try {
    const last = Number(localStorage.getItem(CART_ACTIVITY_KEY) || 0);
    if (!last) return;

    if (Date.now() - last > CART_TTL_MS) {
      clearCartStorage({ notify });
    }
  } catch {}
}

let cartExpireTimer = null;
function scheduleCartExpiryCheck() {
  clearTimeout(cartExpireTimer);
  try {
    const last = Number(localStorage.getItem(CART_ACTIVITY_KEY) || 0);
    if (!last) return;

    const remaining = CART_TTL_MS - (Date.now() - last);
    if (remaining <= 0) {
      clearCartStorage({ notify: true });
      return;
    }

    cartExpireTimer = setTimeout(() => {
      checkCartTTLAndMaybeClear({ notify: true });
    }, remaining + 50);
  } catch {}
}

/* ===========================================================
   Customer Data TTL (5 minutes)
   =========================================================== */
function loadCustomer() {
  try {
    const raw = localStorage.getItem(CUSTOMER_KEY);
    if (!raw) return null;

    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;

    const savedAt = Number(obj.savedAt || 0);
    if (!savedAt || Date.now() - savedAt > CUSTOMER_TTL_MS) {
      localStorage.removeItem(CUSTOMER_KEY);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

function saveCustomer(partial) {
  try {
    const prev = loadCustomer() || {};
    const next = {
      name: typeof partial.name === "string" ? partial.name : (prev.name || ""),
      phone: typeof partial.phone === "string" ? partial.phone : (prev.phone || ""),
      address: typeof partial.address === "string" ? partial.address : (prev.address || ""),
      savedAt: Date.now(), // ✅ بيجدد الـ 5 دقائق مع أي تعديل
    };
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(next));
  } catch {}
}

function clearCustomer() {
  try {
    localStorage.removeItem(CUSTOMER_KEY);
  } catch {}
}

function applyCustomerToInputs() {
  const nameEl = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const addrEl = document.getElementById("custAddress");
  if (!nameEl || !phoneEl || !addrEl) return;

  const data = loadCustomer();
  if (!data) {
    nameEl.value = "";
    phoneEl.value = "";
    addrEl.value = "";
    return;
  }

  nameEl.value = data.name || "";
  phoneEl.value = data.phone || "";
  addrEl.value = data.address || "";
}

let customerExpireTimer = null;
function scheduleCustomerExpiryCheck() {
  clearTimeout(customerExpireTimer);
  const data = loadCustomer();
  if (!data?.savedAt) return;

  const remaining = CUSTOMER_TTL_MS - (Date.now() - Number(data.savedAt));
  if (remaining <= 0) {
    clearCustomer();
    applyCustomerToInputs();
    return;
  }

  customerExpireTimer = setTimeout(() => {
    clearCustomer();
    applyCustomerToInputs();
  }, remaining + 50);
}

function setupCartUI() {
  const cartFab = $("#cartFab");
  const overlay = $("#cartOverlay");
  const drawer = $("#cartDrawer");
  const closeBtn = $("#cartClose");
  const clearBtn = $("#cartClear");
  const checkoutBtn = $("#cartCheckout");
  const continueBtn = $("#cartContinue");
  const noteEl = $("#cartNote");

  if (!cartFab || !overlay || !drawer || !closeBtn || !clearBtn || !checkoutBtn || !noteEl) return;

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      updateCartActivity();
      closeCart();
    });
  }

  noteEl.value = loadNote();
  noteEl.addEventListener("input", () => {
    saveNote(noteEl.value);
    updateCartActivity();
  });

  // ✅ حمّل بيانات العميل لو لسه ضمن 5 دقائق
  applyCustomerToInputs();
  scheduleCustomerExpiryCheck();

  // ✅ احفظ بيانات العميل عند أي تعديل
  const nameEl = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const addrEl = document.getElementById("custAddress");

  const onCustInput = () => {
    saveCustomer({
      name: (nameEl?.value || "").trim(),
      phone: (phoneEl?.value || "").trim(),
      address: (addrEl?.value || "").trim(),
    });
    scheduleCustomerExpiryCheck();
    updateCartActivity(); // نشاط
  };

  nameEl?.addEventListener("input", onCustInput);
  phoneEl?.addEventListener("input", onCustInput);
  addrEl?.addEventListener("input", onCustInput);

  cartFab.addEventListener("click", () => {
    checkCartTTLAndMaybeClear({ notify: true });
    applyCustomerToInputs();
    scheduleCustomerExpiryCheck();
    updateCartActivity();
    openCart();
  });

  overlay.addEventListener("click", closeCart);
  closeBtn.addEventListener("click", closeCart);

  clearBtn.addEventListener("click", () => {
    cart.items = {};
    saveCart();
    updateCartActivity();
    toast("تم تفريغ السلة ✅");
  });

  checkoutBtn.addEventListener("click", () => {
    checkCartTTLAndMaybeClear({ notify: true });

    const waUrl = buildWhatsAppCartUrl();
    if (!waUrl) return toast("أضف منتجات للسلة أولاً ❗");

    const customerName = ($("#custName")?.value || "").trim();
    const customerPhone = ($("#custPhone")?.value || "").trim();
    const address = ($("#custAddress")?.value || "").trim();
    const note = ($("#cartNote")?.value || "").trim();

    if (!customerName || !customerPhone) {
      toast("اكتب الاسم ورقم الموبايل أولاً ❗");
      return;
    }

    const payload = buildOrderPayload({ customerName, customerPhone, address, note });

    const sent = sendOrderToSheetFireAndForget(payload);
    if (sent) toast("جارٍ حفظ البيانات… ✅");

    // ✅ امسح بيانات العميل بعد الإتمام
    clearCustomer();
    applyCustomerToInputs();
    scheduleCustomerExpiryCheck();

    updateCartActivity();

    window.open(waUrl, "_blank", "noopener");
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });
}

function openCart() {
  $("#cartOverlay").hidden = false;
  $("#cartDrawer").classList.add("open");
  $("#cartDrawer").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#cartDrawer").setAttribute("aria-hidden", "true");
  $("#cartOverlay").hidden = true;
  document.body.style.overflow = "";
}

function addToCart(sectionTitle, item) {
  checkCartTTLAndMaybeClear({ notify: true });

  const id = stableItemId(sectionTitle, item);
  const priceText = String(item.price || "").trim();
  const priceNum = parsePriceNumber(priceText);

  if (!cart.items[id]) {
    cart.items[id] = {
      id,
      name: item.name || "منتج",
      section: sectionTitle || "",
      priceText,
      priceNum,
      image: item.image || "",
      qty: 1,
    };
  } else {
    cart.items[id].qty += 1;
  }

  saveCart();
  updateCartActivity();
  toast("تمت الإضافة للسلة ✅");
}

function changeQty(id, delta) {
  checkCartTTLAndMaybeClear({ notify: true });

  const it = cart.items[id];
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) delete cart.items[id];
  saveCart();
  updateCartActivity();
}

function updateCartUI() {
  const countEl = $("#cartCount");
  const subEl = $("#cartSub");
  const itemsRoot = $("#cartItems");
  const totalEl = $("#cartTotal");
  if (!countEl || !subEl || !itemsRoot || !totalEl) return;

  const entries = Object.values(cart.items);
  const totalCount = entries.reduce((a, it) => a + it.qty, 0);

  countEl.textContent = String(totalCount);
  subEl.textContent = `${totalCount} عنصر`;

  if (!entries.length) {
    itemsRoot.innerHTML = `<div class="cart-empty">السلة فارغة… ابدأ بإضافة منتجات 🍗</div>`;
    totalEl.textContent = "0";
    return;
  }

  itemsRoot.innerHTML = "";
  let total = 0;
  let hasNumeric = false;

  for (const it of entries) {
    if (Number.isFinite(it.priceNum)) {
      total += it.priceNum * it.qty;
      hasNumeric = true;
    }

    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div class="cart-thumb">
        <img src="${escapeAttr(it.image)}" alt="${escapeHtml(it.name)}" loading="lazy" />
      </div>
      <div class="cart-info">
        <p class="cart-name">${escapeHtml(it.name)}</p>
        <p class="cart-price">${escapeHtml(it.priceText || "")}</p>
      </div>
      <div class="cart-qty">
        <button class="qty-btn" type="button" data-act="plus">+</button>
        <span class="qty-num">${it.qty}</span>
        <button class="qty-btn" type="button" data-act="minus">−</button>
      </div>
    `;

    row.querySelector('[data-act="plus"]').addEventListener("click", () => changeQty(it.id, +1));
    row.querySelector('[data-act="minus"]').addEventListener("click", () => changeQty(it.id, -1));

    const img = row.querySelector("img");
    img.addEventListener("error", () => {
      img.src =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
            <rect width="120" height="120" rx="18" fill="rgba(255,255,255,0.7)"/>
            <text x="50%" y="54%" text-anchor="middle" font-size="16" font-family="Arial" fill="rgba(0,0,0,0.55)">No Image</text>
          </svg>`
        );
    });

    itemsRoot.appendChild(row);
  }

  totalEl.textContent = hasNumeric ? formatNumber(total) : "—";
}

/* =========================
   Order payload + Sheet send
   ========================= */
function buildOrderPayload({ customerName, customerPhone, address, note }) {
  const entries = Object.values(cart.items);

  const items = entries.map((it) => ({
    name: it.name,
    qty: it.qty,
    priceText: it.priceText || "",
    priceNum: Number.isFinite(it.priceNum) ? it.priceNum : null,
    section: it.section || "",
  }));

  const itemsText = entries
    .map((it) => {
      const p = it.priceText ? ` — ${it.priceText}` : "";
      return `${it.name} × ${it.qty}${p}`;
    })
    .join("\n");

  const totalNumeric = entries.reduce((acc, it) => {
    if (!Number.isFinite(it.priceNum)) return acc;
    return acc + it.priceNum * it.qty;
  }, 0);

  return {
    customerName,
    customerPhone,
    address,
    note,
    items,
    itemsText,
    totalNumeric,
    userAgent: navigator.userAgent,
    pageUrl: location.href,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Fire-and-forget:
 * - Try sendBeacon first (best for cross-origin & not blocking UI)
 * - Fallback to fetch no-cors
 * - Returns true if it *attempted* sending.
 */
function sendOrderToSheetFireAndForget(payload) {
  try {
    if (!SHEET_WEBAPP_URL || !SHEET_WEBAPP_URL.includes("/exec")) return false;
    const body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(
          SHEET_WEBAPP_URL,
          new Blob([body], { type: "text/plain;charset=utf-8" })
        );
        if (ok) return true;
      }
    } catch {}

    try {
      fetch(SHEET_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
      });
      return true;
    } catch {}

    return false;
  } catch {
    return false;
  }
}

/* =========================
   WhatsApp URL
   ========================= */
function buildWhatsAppCartUrl() {
  const phone = sanitizePhone(state.data?.phone || "");
  if (!phone) return "";

  const entries = Object.values(cart.items);
  if (!entries.length) return "";

  const note = (loadNote() || "").trim();

  let msg = `طلب جديد ✅\n\n`;
  for (const it of entries) {
    const linePrice = it.priceText ? ` — ${it.priceText}` : "";
    msg += `• ${it.name} × ${it.qty}${linePrice}\n`;
  }

  const numericTotal = entries.reduce((acc, it) => {
    if (!Number.isFinite(it.priceNum)) return acc;
    return acc + it.priceNum * it.qty;
  }, 0);

  if (numericTotal > 0) msg += `\nالإجمالي التقريبي: ${formatNumber(numericTotal)}\n`;
  if (note) msg += `\nملاحظات:\n${note}\n`;

  msg += `\nشكراً 🙏`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

function stableItemId(sectionTitle, item) {
  const base = `${sectionTitle || ""}|${item?.name || ""}|${item?.price || ""}|${item?.image || ""}`;
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `it_${(h >>> 0).toString(16)}`;
}

function parsePriceNumber(priceText) {
  const t = String(priceText || "").replace(",", ".");
  const m = t.match(/(\d+(\.\d+)?)/);
  if (!m) return NaN;
  return Number(m[1]);
}

function formatNumber(n) {
  try {
    return new Intl.NumberFormat("ar-EG").format(n);
  } catch {
    return String(n);
  }
}

/* =========================
   Utilities
   ========================= */
function slugify(str) {
  return (
    String(str || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\u0600-\u06FF\w-]/g, "")
      .replace(/-+/g, "-")
      .slice(0, 60) || `sec-${Math.random().toString(16).slice(2)}`
  );
}

function sanitizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s).replaceAll("\n", " ").trim();
}

function getPx(varName) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return Number(String(v).replace("px", "")) || 0;
}

/* Toast */
let toastTimer = null;
function toast(text) {
  clearTimeout(toastTimer);
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText = `
      position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%);
      z-index: 1000; padding: 10px 14px; border-radius: 999px;
      background: rgba(255,255,255,0.78); border: 1px solid rgba(255,255,255,0.65);
      box-shadow: 0 16px 44px rgba(0,0,0,0.12);
      font-weight: 900; font-size: 13px; color: #111;
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      opacity: 0; transition: opacity 160ms ease;
    `;
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = "1";
  toastTimer = setTimeout(() => (el.style.opacity = "0"), 1600);
}
