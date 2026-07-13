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
  lastTotalCount: null,
};

/* ---------- Storage ---------- */
const CART_KEY = "menu_cart_v1";

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

    try { localStorage.removeItem(CART_KEY); } catch { }
    try { localStorage.removeItem(CART_ACTIVITY_KEY); } catch { }
    // ملاحظة: بيانات العميل مش بنمسحها هنا (عندك TTL 5 دقائق + مسح بعد الإتمام)
  } catch { }
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
  fillDeliveryAreas(data);

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

      // Store data attributes for active option checks
      card.dataset.sectionTitle = sec.title || "قسم";
      card.dataset.itemName = item.name || "منتج";
      card.dataset.itemPrice = item.price || "";
      card.dataset.itemImage = item.image || "";

      const safeName = escapeHtml(item.name || "منتج");
      const safeDesc = escapeHtml(item.description || "");
      const safePrice = escapeHtml(item.price || "");
      const imgSrc = item.image || "";
      const badgeText = itemIndex === 0 ? "الأكثر طلبًا" : "";

      const secTitleClean = (sec.title || "").trim();
      const itemName = (item.name || "").trim();
      let hasOptions = false;
      let optionList = [];
      if (secTitleClean === "الوجبات") {
        if (itemName === "فرايدو سناك" || itemName === "فرايدو تشيكن فرايز") {
          hasOptions = true;
          optionList = ["عادي", "سبايسي"];
        } else if (itemName === "فرايدو كيدز ميل") {
          hasOptions = false;
        } else {
          hasOptions = true;
          optionList = ["عادي", "سبايسي", "ميكس"];
        }
      } else if (secTitleClean === "وجبات الاستربيس") {
        if (itemName === "استريبس 3 قطع" || itemName === "استريبس 5 قطع") {
          hasOptions = true;
          optionList = ["عادي", "سبايسي", "ميكس"];
        }
      } else if (secTitleClean === "ساندوتشات فرايدو") {
        hasOptions = true;
        optionList = ["عادي", "سبايسي"];
      } else if (secTitleClean === "Light Meals") {
        if (itemName.includes("فتة")) {
          hasOptions = true;
          optionList = ["عادي", "سبايسي"];
        }
      }


      let hasSauces = false;
      let sauceList = [];
      if (secTitleClean === "Light Meals" && itemName.includes("فتة")) {
        hasSauces = true;
        sauceList = ["تكساس", "رانش", "باربكيو", "فاير صوص", "شيدر", "سويت شيلي"];
      }

      let optionsHtml = "";
      if (hasOptions) {
        optionsHtml += `
          <div class="option-selector spicy-selector">
            ${optionList.map((opt, oIdx) => `
              <button class="option-btn${oIdx === 0 ? " active" : ""}" type="button" data-option="${opt}">
                ${opt}
              </button>
            `).join("")}
          </div>
        `;
      }
      if (hasSauces) {
        optionsHtml += `
          <div class="option-title" style="font-size: 11px; color: var(--muted); font-weight: 700; margin-bottom: 4px; text-align: right;">الصوص:</div>
          <div class="option-selector sauce-selector">
            ${sauceList.map((sauce, sIdx) => `
              <button class="option-btn${sIdx === 0 ? " active" : ""}" type="button" data-sauce="${sauce}">
                ${sauce}
              </button>
            `).join("")}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="card-media">
          ${badgeText ? `<div class="badge">${badgeText}</div>` : ""}
          <img src="${escapeAttr(normalizeImgSrc(imgSrc))}" alt="${safeName}" loading="lazy" decoding="async" />

        </div>
        <div class="card-body">
          <h3 class="card-title">${safeName}</h3>
          <p class="card-desc">${safeDesc || " "}</p>
          ${optionsHtml}
          <div class="card-footer">
            <div class="price">${safePrice}</div>
            <div class="card-action-container">
              <button class="add-btn" type="button">أضف للسلة</button>
              <div class="qty-controller" style="display: none;">
                <button class="qty-btn minus" type="button">−</button>
                <span class="qty-num">0</span>
                <button class="qty-btn plus" type="button">+</button>
              </div>
            </div>
          </div>
        </div>
      `;

      if (hasOptions) {
        const optionBtns = card.querySelectorAll(".spicy-selector .option-btn");
        optionBtns.forEach(btn => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            optionBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updateCardStates();
          });
        });
      }

      if (hasSauces) {
        const sauceBtns = card.querySelectorAll(".sauce-selector .option-btn");
        sauceBtns.forEach(btn => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            sauceBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updateCardStates();
          });
        });
      }

      const addBtn = card.querySelector(".add-btn");
      addBtn.addEventListener("click", () => {
        let selectedOption = "";
        let selectedSauce = "";
        if (hasOptions) {
          const activeBtn = card.querySelector(".spicy-selector .option-btn.active");
          if (activeBtn) {
            selectedOption = activeBtn.getAttribute("data-option");
          }
        }
        if (hasSauces) {
          const activeSauce = card.querySelector(".sauce-selector .option-btn.active");
          if (activeSauce) {
            selectedSauce = activeSauce.getAttribute("data-sauce");
          }
        }

        let combinedOption = "";
        if (selectedOption && selectedSauce) {
          combinedOption = `${selectedOption} + صوص ${selectedSauce}`;
        } else if (selectedOption) {
          combinedOption = selectedOption;
        } else if (selectedSauce) {
          combinedOption = `صوص ${selectedSauce}`;
        }

        addToCart(sec.title || "قسم", item, combinedOption);
      });

      const getActiveItemId = () => {
        let selectedOption = "";
        let selectedSauce = "";
        if (hasOptions) {
          const activeBtn = card.querySelector(".spicy-selector .option-btn.active");
          if (activeBtn) {
            selectedOption = activeBtn.getAttribute("data-option");
          }
        }
        if (hasSauces) {
          const activeSauce = card.querySelector(".sauce-selector .option-btn.active");
          if (activeSauce) {
            selectedSauce = activeSauce.getAttribute("data-sauce");
          }
        }

        let combinedOption = "";
        if (selectedOption && selectedSauce) {
          combinedOption = `${selectedOption} + صوص ${selectedSauce}`;
        } else if (selectedOption) {
          combinedOption = selectedOption;
        } else if (selectedSauce) {
          combinedOption = `صوص ${selectedSauce}`;
        }

        const customItem = {
          ...item,
          name: combinedOption ? `${item.name} (${combinedOption})` : item.name
        };
        return stableItemId(sec.title || "قسم", customItem);
      };

      const minusBtn = card.querySelector(".qty-controller .minus");
      const plusBtn = card.querySelector(".qty-controller .plus");

      minusBtn.addEventListener("click", () => {
        const id = getActiveItemId();
        changeQty(id, -1);
      });

      plusBtn.addEventListener("click", () => {
        const id = getActiveItemId();
        changeQty(id, +1);
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
   Fill Delivery Areas Dropdown
   ========================= */
function fillDeliveryAreas(data) {
  const areaSelect = document.getElementById("custArea");
  if (!areaSelect) return;

  areaSelect.innerHTML = '<option value="">اختر المنطقة...</option>';

  const areas = Array.isArray(data.deliveryAreas) ? data.deliveryAreas : [];
  areas.forEach(area => {
    const opt = document.createElement("option");
    opt.value = area.name;
    opt.textContent = `${area.name} (${area.fee} ج)`;
    opt.dataset.fee = area.fee;
    areaSelect.appendChild(opt);
  });
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
    { threshold: 0.01, rootMargin: "0px 0px 160px 0px" }
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

// loadNote and saveNote removed

/* ---------- Cart TTL helpers ---------- */
function clearCartStorage({ notify = false } = {}) {
  try { localStorage.removeItem(CART_KEY); } catch { }
  try { localStorage.removeItem(CART_ACTIVITY_KEY); } catch { }
  cart.items = {};
  updateCartUI();
  if (notify) toast("تم مسح السلة لانتهاء المدة ⏳");
}

function updateCartActivity() {
  try {
    localStorage.setItem(CART_ACTIVITY_KEY, String(Date.now()));
  } catch { }
  scheduleCartExpiryCheck();
}

function checkCartTTLAndMaybeClear({ notify = true } = {}) {
  try {
    const last = Number(localStorage.getItem(CART_ACTIVITY_KEY) || 0);
    if (!last) return;

    if (Date.now() - last > CART_TTL_MS) {
      clearCartStorage({ notify });
    }
  } catch { }
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
  } catch { }
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
      area: typeof partial.area === "string" ? partial.area : (prev.area || ""),
      orderType: typeof partial.orderType === "string" ? partial.orderType : (prev.orderType || "delivery"),
      savedAt: Date.now(), // ✅ بيجدد الـ 5 دقائق مع أي تعديل
    };
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(next));
  } catch { }
}

function clearCustomer() {
  try {
    localStorage.removeItem(CUSTOMER_KEY);
  } catch { }
}

function applyCustomerToInputs() {
  const nameEl = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const addrEl = document.getElementById("custAddress");
  const areaEl = document.getElementById("custArea");
  if (!nameEl || !phoneEl || !addrEl) return;

  const data = loadCustomer();
  const addressWrapper = document.getElementById("addressWrapper");
  const deliveryRadio = document.getElementById("orderTypeDelivery");
  const pickupRadio = document.getElementById("orderTypePickup");
  const lblDelivery = document.getElementById("lblDelivery");
  const lblPickup = document.getElementById("lblPickup");

  if (!data) {
    nameEl.value = "";
    phoneEl.value = "";
    addrEl.value = "";
    if (areaEl) areaEl.value = "";
    if (deliveryRadio) deliveryRadio.checked = true;
    lblDelivery?.classList.add("active");
    lblPickup?.classList.remove("active");
    addressWrapper?.classList.remove("hidden");
    return;
  }

  nameEl.value = data.name || "";
  phoneEl.value = data.phone || "";
  addrEl.value = data.address || "";
  if (areaEl) areaEl.value = data.area || "";

  const orderType = data.orderType || "delivery";
  if (orderType === "pickup") {
    if (pickupRadio) pickupRadio.checked = true;
    lblPickup?.classList.add("active");
    lblDelivery?.classList.remove("active");
    addressWrapper?.classList.add("hidden");
  } else {
    if (deliveryRadio) deliveryRadio.checked = true;
    lblDelivery?.classList.add("active");
    lblPickup?.classList.remove("active");
    addressWrapper?.classList.remove("hidden");
  }
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

  if (!cartFab || !overlay || !drawer || !closeBtn || !clearBtn || !checkoutBtn) return;

  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      updateCartActivity();
      closeCart();
    });
  }

  // ✅ حمّل بيانات العميل لو لسه ضمن 5 دقائق
  applyCustomerToInputs();
  scheduleCustomerExpiryCheck();

  const nameEl = document.getElementById("custName");
  const phoneEl = document.getElementById("custPhone");
  const addrEl = document.getElementById("custAddress");
  const areaEl = document.getElementById("custArea");


  const onCustInput = () => {
    const orderType = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";

    // Convert Arabic numerals to English numerals in-place for better UX and validation compatibility
    const rawPhone = phoneEl?.value || "";
    const normalizedPhone = normalizeArabicNumerals(rawPhone);
    if (phoneEl && phoneEl.value !== normalizedPhone) {
      phoneEl.value = normalizedPhone;
    }

    saveCustomer({
      name: (nameEl?.value || "").trim(),
      phone: normalizedPhone.trim(),
      address: (addrEl?.value || "").trim(),
      area: (areaEl?.value || "").trim(),
      orderType: orderType,
    });
    scheduleCustomerExpiryCheck();
    updateCartActivity(); // نشاط
  };

  nameEl?.addEventListener("input", onCustInput);
  phoneEl?.addEventListener("input", onCustInput);
  addrEl?.addEventListener("input", onCustInput);
  areaEl?.addEventListener("change", () => {
    onCustInput();
    updateCartUI();
  });

  const deliveryRadio = document.getElementById("orderTypeDelivery");
  const pickupRadio = document.getElementById("orderTypePickup");
  const lblDelivery = document.getElementById("lblDelivery");
  const lblPickup = document.getElementById("lblPickup");
  const addressWrapper = document.getElementById("addressWrapper");

  const handleOrderTypeChange = () => {
    const type = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";
    if (type === "pickup") {
      lblPickup?.classList.add("active");
      lblDelivery?.classList.remove("active");
      addressWrapper?.classList.add("hidden");
    } else {
      lblDelivery?.classList.add("active");
      lblPickup?.classList.remove("active");
      addressWrapper?.classList.remove("hidden");
    }
    onCustInput();
    updateCartUI();
  };

  deliveryRadio?.addEventListener("change", handleOrderTypeChange);
  pickupRadio?.addEventListener("change", handleOrderTypeChange);

  cartFab.addEventListener("click", () => {
    checkCartTTLAndMaybeClear({ notify: true });
    applyCustomerToInputs();
    scheduleCustomerExpiryCheck();
    updateCartActivity();
    updateCartUI();
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
    try {
      checkCartTTLAndMaybeClear({ notify: true });

      const entries = Object.values(cart.items);
      if (!entries.length) {
        toast("أضف منتجات للسلة أولاً ❗");
        return;
      }

      const customerName = (nameEl?.value || "").trim();
      const customerPhone = (phoneEl?.value || "").trim();
      const address = (addrEl?.value || "").trim();
      const area = (areaEl?.value || "").trim();
      const note = ($("#cartNote")?.value || "").trim();
      const orderType = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";

      let hasError = false;

      // Helper to shake an element
      const shakeElement = (el) => {
        if (!el) return;
        el.classList.add("shake-input");
        el.addEventListener("animationend", () => {
          el.classList.remove("shake-input");
        }, { once: true });
      };

      if (!customerName) {
        shakeElement(nameEl);
        hasError = true;
      }

      // Phone number validation: non-empty, and must be 11 digits starting with 010/011/012/015 (Arabic numerals normalized first, country code resolved)
      let cleanPhone = normalizeArabicNumerals(customerPhone).replace(/[\s\-\+\(\)]/g, "");
      if (cleanPhone.startsWith("0020")) {
        cleanPhone = cleanPhone.slice(4);
      } else if (cleanPhone.startsWith("20")) {
        cleanPhone = cleanPhone.slice(2);
      }
      if (cleanPhone.length === 10 && /^(10|11|12|15)/.test(cleanPhone)) {
        cleanPhone = "0" + cleanPhone;
      }
      if (!cleanPhone || !/^(010|011|012|015)\d{8}$/.test(cleanPhone)) {
        shakeElement(phoneEl);
        hasError = true;
      }

      let deliveryFee = 0;
      if (orderType === "delivery") {
        if (!area) {
          shakeElement(areaEl);
          hasError = true;
        }
        if (!address) {
          shakeElement(addrEl);
          hasError = true;
        }
        if (areaEl && areaEl.selectedIndex > 0) {
          deliveryFee = Number(areaEl.options[areaEl.selectedIndex].dataset.fee || 0);
        }
      }

      if (hasError) {
        toast("يرجى إكمال البيانات المطلوبة بشكل صحيح ❗");
        return;
      }

      const waUrl = buildWhatsAppCartUrl();
      if (!waUrl) return toast("أضف منتجات للسلة أولاً ❗");

      const finalAddress = orderType === "delivery" ? address : "الفرع الرئيسي (استلام)";
      const payload = buildOrderPayload({
        customerName,
        customerPhone,
        area: orderType === "delivery" ? area : "",
        address: finalAddress,
        deliveryFee: orderType === "delivery" ? deliveryFee : 0,
        note,
        orderType
      });

      const sent = sendOrderToSheetFireAndForget(payload);
      if (sent) toast("جارٍ ارسال البيانات… ✅");

      // ✅ امسح بيانات العميل بعد الإتمام
      clearCustomer();
      applyCustomerToInputs();
      scheduleCustomerExpiryCheck();

      updateCartActivity();

      // Check if mobile device to bypass popup blockers and avoid blank tabs (handles desktop site mode on mobile too)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
      if (isMobile) {
        // Use native protocol link to force launching the native WhatsApp app directly on mobile
        const nativeWaUrl = waUrl.replace("https://wa.me/", "whatsapp://send?phone=").replace("?text=", "&text=");
        window.location.href = nativeWaUrl;
      } else {
        window.open(waUrl, "_blank", "noopener");
      }
    } catch (err) {
      alert("حدث خطأ أثناء إتمام الطلب:\n" + err.message + "\n" + err.stack);
    }
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

function addToCart(sectionTitle, item, selectedOption = "") {
  checkCartTTLAndMaybeClear({ notify: true });

  const customItem = {
    ...item,
    name: selectedOption ? `${item.name} (${selectedOption})` : item.name
  };

  const id = stableItemId(sectionTitle, customItem);
  const priceText = String(item.price || "").trim();
  const priceNum = parsePriceNumber(priceText);

  if (!cart.items[id]) {
    cart.items[id] = {
      id,
      name: customItem.name || "منتج",
      section: sectionTitle || "",
      priceText,
      priceNum,
      image: item.image || "",
      qty: 1,
      note: ""
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

function updateCardStates() {
  const cards = document.querySelectorAll(".card");
  cards.forEach(card => {
    const sectionTitle = card.dataset.sectionTitle;
    const itemName = card.dataset.itemName;
    const itemPrice = card.dataset.itemPrice;
    const itemImage = card.dataset.itemImage;

    const activeOptionBtn = card.querySelector(".spicy-selector .option-btn.active");
    const selectedOption = activeOptionBtn ? (activeOptionBtn.getAttribute("data-option") || "") : "";

    const activeSauceBtn = card.querySelector(".sauce-selector .option-btn.active");
    const selectedSauce = activeSauceBtn ? (activeSauceBtn.getAttribute("data-sauce") || "") : "";

    let combinedOption = "";
    if (selectedOption && selectedSauce) {
      combinedOption = `${selectedOption} + صوص ${selectedSauce}`;
    } else if (selectedOption) {
      combinedOption = selectedOption;
    } else if (selectedSauce) {
      combinedOption = `صوص ${selectedSauce}`;
    }

    const item = {
      name: itemName,
      price: itemPrice,
      image: itemImage
    };

    const customItem = {
      ...item,
      name: combinedOption ? `${item.name} (${combinedOption})` : item.name
    };

    const id = stableItemId(sectionTitle, customItem);
    const cartItem = cart.items[id];

    const addBtn = card.querySelector(".add-btn");
    const qtyController = card.querySelector(".qty-controller");
    const qtyNum = card.querySelector(".qty-controller .qty-num");

    if (addBtn && qtyController && qtyNum) {
      if (cartItem && cartItem.qty > 0) {
        addBtn.style.display = "none";
        qtyController.style.display = "inline-flex";
        qtyNum.textContent = cartItem.qty;
      } else {
        addBtn.style.display = "block";
        qtyController.style.display = "none";
      }
    }
  });
}

function updateCartUI() {
  const countEl = $("#cartCount");
  const subEl = $("#cartSub");
  const itemsRoot = $("#cartItems");
  const totalEl = $("#cartTotal");
  if (!countEl || !subEl || !itemsRoot || !totalEl) return;

  // Sync product cards with cart
  updateCardStates();

  const entries = Object.values(cart.items);
  const totalCount = entries.reduce((a, it) => a + it.qty, 0);

  const fab = $("#cartFab");
  if (totalCount > 0) {
    fab?.classList.remove("hidden");
    countEl.textContent = String(totalCount);
  } else {
    fab?.classList.add("hidden");
  }

  // Trigger pulse animation when cart total increases or appears for the first time
  if (state.lastTotalCount !== null) {
    if ((state.lastTotalCount === 0 && totalCount > 0) || totalCount > state.lastTotalCount) {
      triggerFabPulse();
    }
  }
  state.lastTotalCount = totalCount;

  subEl.textContent = `${totalCount} عنصر`;

  const deliveryRow = document.getElementById("cartDeliveryRow");
  const deliveryFeeEl = document.getElementById("cartDeliveryFee");

  const checkoutBtn = $("#cartCheckout");
  if (!entries.length) {
    itemsRoot.innerHTML = `<div class="cart-empty">السلة فارغة… ابدأ بإضافة منتجات 🍗</div>`;
    totalEl.textContent = "0";
    if (deliveryRow) deliveryRow.style.display = "none";
    if (deliveryFeeEl) deliveryFeeEl.textContent = "0 ج";
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = "0.5";
      checkoutBtn.style.pointerEvents = "none";
    }
    return;
  }

  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = "1";
    checkoutBtn.style.pointerEvents = "auto";
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
      <div class="cart-row-main">
        <div class="cart-thumb">
          <img src="${escapeAttr(normalizeImgSrc(it.image))}" alt="${escapeHtml(it.name)}" loading="eager" decoding="async" />
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
      </div>
      <div class="cart-row-note">
        <span class="note-icon">📝</span>
        <input type="text" class="cart-item-note-input" placeholder="أضف ملاحظة خاصة (بدون بصل، صوص زيادة...)" value="${escapeAttr(it.note || '')}" />
      </div>
    `;

    row.querySelector('.cart-item-note-input').addEventListener("input", (e) => {
      updateItemNote(it.id, e.target.value);
    });

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

  let deliveryFee = 0;
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";
  if (orderType === "delivery") {
    if (deliveryRow) deliveryRow.style.display = "";
    const areaSelect = document.getElementById("custArea");
    if (areaSelect && areaSelect.selectedIndex > 0) {
      deliveryFee = Number(areaSelect.options[areaSelect.selectedIndex].dataset.fee || 0);
    }
    if (deliveryFeeEl) deliveryFeeEl.textContent = `${formatNumber(deliveryFee)} ج`;
  } else {
    if (deliveryRow) deliveryRow.style.display = "none";
    if (deliveryFeeEl) deliveryFeeEl.textContent = "0 ج";
  }

  const grandTotal = total + deliveryFee;
  totalEl.textContent = hasNumeric ? formatNumber(grandTotal) : "—";
}

let fabPulseTimeout = null;
function triggerFabPulse() {
  const fab = $("#cartFab");
  if (!fab) return;
  clearTimeout(fabPulseTimeout);
  fab.classList.remove("pulse-fab");
  void fab.offsetWidth; // Force reflow
  fab.classList.add("pulse-fab");
  fabPulseTimeout = setTimeout(() => {
    fab.classList.remove("pulse-fab");
  }, 400);
}

function updateItemNote(id, noteText) {
  if (cart.items[id]) {
    cart.items[id].note = noteText;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart.items));
      localStorage.setItem(CART_ACTIVITY_KEY, String(Date.now()));
    } catch (e) { }
  }
}

/* =========================
   Order payload + Sheet send
   ========================= */
function buildOrderPayload({ customerName, customerPhone, area, address, deliveryFee, note, orderType }) {
  const entries = Object.values(cart.items);

  const items = entries.map((it) => ({
    name: it.name,
    qty: it.qty,
    priceText: it.priceText || "",
    priceNum: Number.isFinite(it.priceNum) ? it.priceNum : null,
    section: it.section || "",
    note: it.note || "",
  }));

  const itemsText = entries
    .map((it) => {
      const p = it.priceText ? ` — ${it.priceText}` : "";
      const noteText = it.note && it.note.trim() ? ` [ملاحظة: ${it.note.trim()}]` : "";
      return `${it.name} × ${it.qty}${p}${noteText}`;
    })
    .join("\n");

  const totalNumeric = entries.reduce((acc, it) => {
    if (!Number.isFinite(it.priceNum)) return acc;
    return acc + it.priceNum * it.qty;
  }, 0);

  return {
    customerName,
    customerPhone,
    area: area || "",
    address,
    deliveryFee: Number(deliveryFee) || 0,
    note,
    orderType: orderType === "delivery" ? "دليفري" : "استلام من الفرع",
    items,
    itemsText,
    totalNumeric,
    grandTotal: totalNumeric + (orderType === "delivery" ? Number(deliveryFee) || 0 : 0),
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
    } catch { }

    try {
      fetch(SHEET_WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        keepalive: true, // Keep request alive even when page navigates to WhatsApp
      });
      return true;
    } catch { }

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

  const areaSelect = document.getElementById("custArea");
  const area = (areaSelect?.value || "").trim();
  const customerName = ($("#custName")?.value || "").trim();
  const customerPhone = ($("#custPhone")?.value || "").trim();
  const address = ($("#custAddress")?.value || "").trim();
  const orderType = document.querySelector('input[name="orderType"]:checked')?.value || "delivery";

  let deliveryFee = 0;
  if (orderType === "delivery" && areaSelect && areaSelect.selectedIndex > 0) {
    deliveryFee = Number(areaSelect.options[areaSelect.selectedIndex].dataset.fee || 0);
  }

  let msg = `طلب جديد ✅\n\n`;
  if (orderType === "delivery") {
    msg += `🛵 نوع الطلب: دليفري (توصيل)\n`;
  } else {
    msg += `🏪 نوع الطلب: استلام من الفرع\n`;
  }

  if (customerName) msg += `👤 الاسم: ${customerName}\n`;
  if (customerPhone) msg += `📞 الموبايل: ${customerPhone}\n`;

  if (orderType === "delivery") {
    if (area) msg += `📍 المنطقة: ${area}\n`;
    if (address) msg += `🏠 العنوان بالتفصيل: ${address}\n\n`;
  } else {
    msg += `📍 فرع الاستلام: الفرع الرئيسي\n\n`;
  }

  msg += `الطلبات:\n`;
  for (const it of entries) {
    const linePrice = it.priceText ? ` — ${it.priceText}` : "";
    msg += `• ${it.name} × ${it.qty}${linePrice}\n`;
    if (it.note && it.note.trim()) {
      msg += `  (ملاحظة: ${it.note.trim()})\n`;
    }
  }

  const numericTotal = entries.reduce((acc, it) => {
    if (!Number.isFinite(it.priceNum)) return acc;
    return acc + it.priceNum * it.qty;
  }, 0);

  if (numericTotal > 0) {
    msg += `\n💵 إجمالي المنتجات: ${formatNumber(numericTotal)}\n`;
    if (orderType === "delivery") {
      msg += `🛵 خدمة التوصيل: ${formatNumber(deliveryFee)} ج\n`;
      msg += `💰 الإجمالي النهائي: ${formatNumber(numericTotal + deliveryFee)} ج\n`;
    } else {
      msg += `💰 الإجمالي النهائي: ${formatNumber(numericTotal)} ج\n`;
    }
  }

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
function normalizeImgSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
  return encodeURI(s);
}
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

function normalizeArabicNumerals(str) {
  return String(str || "")
    .replace(/[٠۰]/g, "0")
    .replace(/[١۱]/g, "1")
    .replace(/[٢۲]/g, "2")
    .replace(/[٣۳]/g, "3")
    .replace(/[٤۴]/g, "4")
    .replace(/[٥۵]/g, "5")
    .replace(/[٦۶]/g, "6")
    .replace(/[٧۷]/g, "7")
    .replace(/[٨۸]/g, "8")
    .replace(/[٩۹]/g, "9");
}

function sanitizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/\n/g, " ").trim();
}

function getPx(varName) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return Number(String(v).replace("px", "")) || 0;
}

function normalizeImgSrc(src) {
  const s = String(src || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("data:")) return s;
  return encodeURI(s);
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
