/* ============================================================
     DATA: pizza menu — a collection of objects.
     First 7 = regular ($8.50). Remaining 5 = gourmet (+$5).
     ============================================================ */
  const REGULAR_PRICE = 8.50;
  const GOURMET_SURCHARGE = 5.00;
  const DELIVERY_CHARGE = 3.00;
  const MAX_PIZZAS = 5;

  const menu = [
    { name: "Margherita Classic",     category: "regular" },
    { name: "Pepperoni Feast",        category: "regular" },
    { name: "Hawaiian Breeze",        category: "regular" },
    { name: "Garden Vegetarian",      category: "regular" },
    { name: "Meat Lovers",            category: "regular" },
    { name: "BBQ Chicken",            category: "regular" },
    { name: "Four Cheese",            category: "regular" },
    { name: "Smoked Salmon & Dill",   category: "gourmet" },
    { name: "Truffle Mushroom",       category: "gourmet" },
    { name: "Prosciutto & Rocket",    category: "gourmet" },
    { name: "Mediterranean Lamb",     category: "gourmet" },
    { name: "Spicy Nduja Diavola",    category: "gourmet" },
  ].map((p, i) => ({ ...p, index: i, price: getPriceForIndex(i) }));

  // function with a parameter and a return value
  function getPriceForIndex(index){
    return index < 7 ? REGULAR_PRICE : (REGULAR_PRICE + GOURMET_SURCHARGE);
  }

  function formatCurrency(amount){
    // non-basic string manipulation: fixed decimals + currency symbol
    return "$" + amount.toFixed(2);
  }

  // non-basic string manipulation: strips non-digits and checks length
  function isValidPhone(str){
  const trimmed = str.trim();
  const allowedCharsOnly = /^[0-9 +\-()]+$/.test(trimmed);
  if(!allowedCharsOnly) return false;
  const digitsOnly = trimmed.replace(/[^0-9]/g, "");
  return digitsOnly.length >= 7 && digitsOnly.length <= 11;
}
  

  function isValidName(str){
    return str.trim().length >= 2;
  }

  /* ============================================================
     STATE
     ============================================================ */
  let order = freshOrder();
  let orderRail = [];      // collection of completed orders
  let step = "type";       // type | details | count | select | summary | closing
  let slotIndex = 0;       // which pizza (0-based) we're currently choosing

  function freshOrder(){
    return {
      isDelivery: null,   // boolean
      name: "",
      address: "",
      phone: "",
      pizzaCount: null,   // numeric
      pizzas: []           // collection, modified as pizzas are chosen
    };
  }

  /* ============================================================
     TOTAL / SUMMARY HELPERS
     ============================================================ */
  function calculateSubtotal(pizzas){
    return pizzas.reduce((sum, p) => sum + p.price, 0);
  }

  function calculateTotal(pizzas, isDelivery){
    const subtotal = calculateSubtotal(pizzas);
    return isDelivery ? subtotal + DELIVERY_CHARGE : subtotal;
  }

  /* ============================================================
     RENDER: stepper bar
     ============================================================ */
  const STEPS = [
    { key:"type",    label:"Order Type" },
    { key:"details",  label:"Customer" },
    { key:"count",    label:"Pizza Count" },
    { key:"select",   label:"Select Pizzas" },
    { key:"summary",  label:"Confirm" },
  ];

  function renderStepper(){
    const bar = document.getElementById("stepperBar");
    if(step === "closing"){ bar.innerHTML = ""; return; }
    const currentIdx = STEPS.findIndex(s => s.key === step);
    bar.innerHTML = STEPS.map((s, i) => {
      let cls = "step-chip";
      if(i === currentIdx) cls += " active";
      else if(i < currentIdx) cls += " done";
      const num = String(i+1).padStart(2,"0");
      const mark = i < currentIdx ? "✓" : num;
      return `<div class="${cls}"><span class="n">${mark}</span>No.${num} ${s.label}</div>`;
    }).join("");
  }

  /* ============================================================
     RENDER: mini running-total bar (mobile-friendly nudge)
     ============================================================ */
  function renderMiniBar(){
    const bar = document.getElementById("miniBar");
    if((step === "select" || step === "summary") && order.pizzas.length > 0){
      const total = calculateTotal(order.pizzas, order.isDelivery);
      bar.style.display = "flex";
      bar.innerHTML = `<span>${order.pizzas.length} pizza${order.pizzas.length>1?"s":""} added</span><span>${formatCurrency(total)}</span>`;
    } else {
      bar.style.display = "none";
    }
  }

  /* ============================================================
     RENDER: each step's form content
     ============================================================ */
  function renderStep(){
    renderStepper();
    renderMiniBar();
    const el = document.getElementById("stepContent");

    if(step === "type") el.innerHTML = stepTypeHTML();
    else if(step === "details") el.innerHTML = stepDetailsHTML();
    else if(step === "count") el.innerHTML = stepCountHTML();
    else if(step === "select") el.innerHTML = stepSelectHTML();
    else if(step === "summary") el.innerHTML = stepSummaryHTML();
    else if(step === "closing") el.innerHTML = stepClosingHTML();

    renderDocket();
    attachStepEvents();
  }

  function cancelButtonHTML(){
    if(step === "closing") return "";
    return `<div class="cancel-zone"><button class="btn btn-cancel" id="btnCancel" type="button">Cancel order</button></div>`;
  }

  function stepTypeHTML(){
    return `
      <h2 class="step-title">How is this order going out?</h2>
      <p class="step-sub">Choose pickup or delivery to begin the order.</p>
      <div class="choice-row">
        <button type="button" class="choice-card ${order.isDelivery===false?'selected':''}" data-type="pickup">
          <span class="ico">🥡</span>
          <span class="ttl">Pickup</span>
          <span class="desc">Customer collects in-store. Name only.</span>
        </button>
        <button type="button" class="choice-card ${order.isDelivery===true?'selected':''}" data-type="delivery">
          <span class="ico">🛵</span>
          <span class="ttl">Delivery</span>
          <span class="desc">Adds a ${formatCurrency(DELIVERY_CHARGE)} delivery charge.</span>
        </button>
      </div>
      ${cancelButtonHTML()}
    `;
  }

  function stepDetailsHTML(){
    const deliveryFields = order.isDelivery ? `
      <label class="field">
        <span>Delivery address</span>
        <input type="text" id="inputAddress" value="${escapeAttr(order.address)}" placeholder="14 Ponsonby Road, Auckland">
        <div class="errmsg" id="errAddress">Please enter a delivery address.</div>
      </label>
      <label class="field">
        <span>Phone number</span>
        <input type="tel" id="inputPhone" value="${escapeAttr(order.phone)}" placeholder="021 234 5678">
        <div class="errmsg" id="errPhone">Please enter a valid phone number.</div>
      </label>
    ` : "";

    return `
      <h2 class="step-title">Customer details</h2>
      <p class="step-sub">${order.isDelivery ? "Delivery orders need a name, address and phone number." : "Pickup orders just need a name."}</p>
      <label class="field">
        <span>Customer name</span>
        <input type="text" id="inputName" value="${escapeAttr(order.name)}" placeholder="e.g. Priya Nair">
        <div class="errmsg" id="errName">Please enter the customer's name.</div>
      </label>
      ${deliveryFields}
      <div class="actions-row">
        <button class="btn btn-ghost" id="btnBack" type="button">Back</button>
        <button class="btn btn-primary" id="btnNext" type="button">Continue</button>
      </div>
      ${cancelButtonHTML()}
    `;
  }

  function stepCountHTML(){
    const count = order.pizzaCount || 1;
    return `
      <h2 class="step-title">How many pizzas?</h2>
      <p class="step-sub">Maximum ${MAX_PIZZAS} pizzas per phone order.</p>
      <div class="pizza-count-row">
        <button class="stepper-btn" id="btnMinus" type="button" ${count<=1?"disabled":""}>−</button>
        <div class="pizza-count-display">${count}</div>
        <button class="stepper-btn" id="btnPlus" type="button" ${count>=MAX_PIZZAS?"disabled":""}>+</button>
      </div>
      <div class="actions-row">
        <button class="btn btn-ghost" id="btnBack" type="button">Back</button>
        <button class="btn btn-primary" id="btnNext" type="button">Continue to menu</button>
      </div>
      ${cancelButtonHTML()}
    `;
  }

  function stepSelectHTML(){
    const menuHTML = menu.map(p => `
      <button type="button" class="menu-item" data-index="${p.index}">
        <div class="mi-left">
          <span class="mi-name">${p.name}</span>
          <span class="badge ${p.category}">${p.category}</span>
        </div>
        <span class="mi-price">${formatCurrency(p.price)}</span>
      </button>
    `).join("");

    const pickedHTML = order.pizzas.length ? `
      <div class="picked-list">
        ${order.pizzas.map((p,i) => `<span class="picked-pill">${i+1}. ${p.name}</span>`).join("")}
      </div>` : "";

    return `
      <h2 class="step-title">Choose the pizzas</h2>
      <div class="slot-progress">Selecting pizza <b>${slotIndex+1}</b> of <b>${order.pizzaCount}</b></div>
      ${pickedHTML}
      <div class="menu-grid">${menuHTML}</div>
      <div class="actions-row">
        <button class="btn btn-ghost" id="btnBack" type="button">Back</button>
        <span></span>
      </div>
      ${cancelButtonHTML()}
    `;
  }

  function stepSummaryHTML(){
    return `
      <h2 class="step-title">Order confirmed</h2>
      <p class="step-sub">The docket on the right shows everything for this order.</p>
      <div class="actions-row">
        <button class="btn btn-basil" id="btnNewOrder" type="button">Start new order</button>
        <button class="btn btn-ghost" id="btnExit" type="button">Exit terminal</button>
      </div>
    `;
  }

  function stepClosingHTML(){
    return `
      <div class="closing">
        <h2>Terminal closed</h2>
        <p>${orderRail.length} order${orderRail.length===1?"":"s"} taken this session. Ready when you are.</p>
        <button class="btn btn-primary" id="btnReopen" type="button">Reopen terminal</button>
      </div>
    `;
  }

  function escapeAttr(str){
    return String(str).replace(/"/g, "&quot;");
  }

  /* ============================================================
     RENDER: live docket (right-hand receipt preview)
     ============================================================ */
  function renderDocket(printed){
    const d = document.getElementById("docket");
    d.className = "docket" + (printed ? " printed" : "");

    if(step === "type" || (step==="type")){
      // no selections yet
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const dateStr = now.toLocaleDateString([], {day:'2-digit', month:'short'});

    let metaHTML = "";
    let itemsHTML = "";
    let totalsHTML = "";

    const hasType = order.isDelivery !== null;
    const hasName = order.name && order.name.trim().length > 0;

    if(!hasType){
      itemsHTML = `<div class="docket-empty">Order details will appear here<br>as you build the order.</div>`;
    } else {
      const typeLine = order.isDelivery ? "DELIVERY" : "PICKUP";
      metaHTML += `<div class="docket-meta"><b>${typeLine}</b></div>`;
      if(hasName){
        metaHTML += `<div class="docket-meta">Customer: <b>${order.name}</b></div>`;
      }
      if(order.isDelivery && order.address){
        metaHTML += `<div class="docket-meta">Address: <b>${order.address}</b></div>`;
      }
      if(order.isDelivery && order.phone){
        metaHTML += `<div class="docket-meta">Phone: <b>${order.phone}</b></div>`;
      }

      if(order.pizzas.length === 0){
        itemsHTML = `<div class="docket-empty">No pizzas selected yet.</div>`;
      } else {
        itemsHTML = `<div class="docket-items">` + order.pizzas.map(p => `
          <div class="docket-item">
            <div class="din">${p.name}<div class="dtag">${p.category}</div></div>
            <div>${formatCurrency(p.price)}</div>
          </div>
        `).join("") + `</div>`;

        const subtotal = calculateSubtotal(order.pizzas);
        const total = calculateTotal(order.pizzas, order.isDelivery);
        totalsHTML = `<div class="docket-totals">
          <div class="row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
          ${order.isDelivery ? `<div class="row"><span>Delivery charge</span><span>${formatCurrency(DELIVERY_CHARGE)}</span></div>` : ""}
          <div class="row total"><span>Total</span><span>${formatCurrency(total)}</span></div>
        </div>`;
      }
    }

    d.innerHTML = `
      <div class="docket-head">
        <div class="dh-name">Dream Pizzas</div>
        <div class="dh-sub">${dateStr} · ${timeStr}</div>
      </div>
      <hr>
      ${metaHTML}
      ${metaHTML ? "<hr>" : ""}
      ${itemsHTML}
      ${totalsHTML}
      <div class="docket-foot">Thanks for the order</div>
    `;
  }

  /* ============================================================
     RENDER: order rail (list of completed orders this session)
     ============================================================ */
  function renderOrderRail(){
    document.getElementById("railCounter").innerHTML =
      `Orders taken today: <b>${orderRail.length}</b>`;

    const box = document.getElementById("orderRailBox");
    if(orderRail.length === 0){ box.innerHTML = ""; return; }

    box.innerHTML = `<div class="docket-label" style="margin-top:22px;">Completed this session</div>` +
      orderRail.slice().reverse().map(o => `
        <div class="rail-item">
          <span><b>${o.name}</b> · ${o.isDelivery ? "Delivery" : "Pickup"} · ${o.pizzas.length} pizza${o.pizzas.length>1?"s":""}</span>
          <span>${formatCurrency(o.total)}</span>
        </div>
      `).join("");
  }

  /* ============================================================
     EVENTS
     ============================================================ */
  function attachStepEvents(){
    const cancelBtn = document.getElementById("btnCancel");
    if(cancelBtn) cancelBtn.addEventListener("click", handleCancelOrder);

    if(step === "type"){
      document.querySelectorAll(".choice-card").forEach(card => {
        card.addEventListener("click", () => {
          order.isDelivery = card.dataset.type === "delivery";
          step = "details";
          renderStep();
        });
      });
    }

    if(step === "details"){
      document.getElementById("btnBack").addEventListener("click", () => {
        step = "type";
        renderStep();
      });
      document.getElementById("btnNext").addEventListener("click", handleDetailsSubmit);
    }

    if(step === "count"){
      const minus = document.getElementById("btnMinus");
      const plus = document.getElementById("btnPlus");
      if(minus) minus.addEventListener("click", () => {
        order.pizzaCount = Math.max(1, (order.pizzaCount||1) - 1);
        renderStep();
      });
      if(plus) plus.addEventListener("click", () => {
        order.pizzaCount = Math.min(MAX_PIZZAS, (order.pizzaCount||1) + 1);
        renderStep();
      });
      document.getElementById("btnBack").addEventListener("click", () => {
        step = "details";
        renderStep();
      });
      document.getElementById("btnNext").addEventListener("click", () => {
        order.pizzaCount = order.pizzaCount || 1;
        order.pizzas = [];
        slotIndex = 0;
        step = "select";
        renderStep();
      });
    }

    if(step === "select"){
      document.querySelectorAll(".menu-item").forEach(item => {
        item.addEventListener("click", () => {
          const idx = parseInt(item.dataset.index, 10);
          const chosen = menu[idx];
          order.pizzas.push({ name: chosen.name, price: chosen.price, category: chosen.category });
          if(slotIndex < order.pizzaCount - 1){
            slotIndex++;
            renderStep();
          } else {
            finishOrder();
          }
        });
      });
      document.getElementById("btnBack").addEventListener("click", () => {
        if(order.pizzas.length > 0){
          order.pizzas.pop();
          slotIndex = Math.max(0, slotIndex - 1);
          renderStep();
        } else {
          step = "count";
          renderStep();
        }
      });
    }

    if(step === "summary"){
      document.getElementById("btnNewOrder").addEventListener("click", () => {
        order = freshOrder();
        slotIndex = 0;
        step = "type";
        renderStep();
      });
      document.getElementById("btnExit").addEventListener("click", () => {
        step = "closing";
        renderStep();
      });
    }

    if(step === "closing"){
      document.getElementById("btnReopen").addEventListener("click", () => {
        order = freshOrder();
        slotIndex = 0;
        step = "type";
        renderStep();
      });
    }
  }

  function handleDetailsSubmit(){
    let valid = true;

    const nameInput = document.getElementById("inputName");
    if(!isValidName(nameInput.value)){
      nameInput.classList.add("err");
      document.getElementById("errName").classList.add("show");
      valid = false;
    } else {
      nameInput.classList.remove("err");
      document.getElementById("errName").classList.remove("show");
      order.name = nameInput.value.trim();
    }

    if(order.isDelivery){
      const addrInput = document.getElementById("inputAddress");
      const phoneInput = document.getElementById("inputPhone");

      if(!addrInput.value.trim()){
        addrInput.classList.add("err");
        document.getElementById("errAddress").classList.add("show");
        valid = false;
      } else {
        addrInput.classList.remove("err");
        document.getElementById("errAddress").classList.remove("show");
        order.address = addrInput.value.trim();
      }

      if(!isValidPhone(phoneInput.value)){
        phoneInput.classList.add("err");
        document.getElementById("errPhone").classList.add("show");
        valid = false;
      } else {
        phoneInput.classList.remove("err");
        document.getElementById("errPhone").classList.remove("show");
        order.phone = phoneInput.value.trim();
      }
    }

    if(valid){
      step = "count";
      renderStep();
    }
  }

  function handleCancelOrder(){
    const ok = window.confirm("Cancel this order? Everything entered so far will be lost.");
    if(ok){
      order = freshOrder();
      slotIndex = 0;
      step = "type";
      renderStep();
    }
  }

  function finishOrder(){
    const total = calculateTotal(order.pizzas, order.isDelivery);
    orderRail.push({
      name: order.name,
      isDelivery: order.isDelivery,
      address: order.address,
      phone: order.phone,
      pizzas: order.pizzas.slice(),
      total: total
    });
    renderOrderRail();
    step = "summary";
    renderStep();
    renderDocket(true); // trigger "printed" animation
  }

  /* ============================================================
     INIT
     ============================================================ */
  renderOrderRail();
  renderStep();
