/* ============================================================
     Dream Pizzas phone order terminal - browser side.
     This file only draws the screens and reacts to clicks. The menu,
     prices, validation, totals and saved orders all come from the Flask
     server (app.py) through the /api routes.
     ============================================================ */

  // Filled in from /api/config when the page loads.
  let menu = [];
  let MAX_PIZZAS = 0;
  let DELIVERY_CHARGE = 0;

  // Send a request to the server and return { ok, data }.
  // POST when a body is given, GET otherwise.
  async function api(path, body){
    const options = body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    };
    try {
      const response = await fetch(path, options);
      return { ok: response.ok, data: await response.json() };
    } catch (error) {
      window.alert("Could not reach the order server. Is it running?");
      return { ok: false, data: {} };
    }
  }

  // non-basic string manipulation: fixed decimals + currency symbol
  function formatCurrency(amount){
    return "$" + amount.toFixed(2);
  }

  // function with a parameter and a return value: "1 pizza" / "3 pizzas"
  function pizzaLabel(count){
    return `${count} pizza${count > 1 ? "s" : ""}`;
  }

  /* ============================================================
     STATE
     ============================================================ */
  let order = freshOrder();
  let orderRail = [];      // collection of completed orders (from the server)
  let step = "type";       // type | details | count | select | summary | closing
  let slotIndex = 0;       // which pizza (0-based) we're currently choosing

  function freshOrder(){
    return {
      isDelivery: null,   // boolean
      name: "",
      address: "",
      phone: "",
      pizzaCount: null,   // numeric
      pizzas: [],         // collection, modified as pizzas are chosen
      summary: { subtotal: 0, delivery_charge: 0, total: 0 }   // worked out by the server
    };
  }

  // Ask the server for the totals of the pizzas picked so far.
  async function refreshSummary(){
    const result = await api("/api/summary", {
      pizza_indices: order.pizzas.map(p => p.index),
      is_delivery: Boolean(order.isDelivery)
    });
    if(result.ok) order.summary = result.data;
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
      bar.style.display = "flex";
      bar.innerHTML = `<span>${pizzaLabel(order.pizzas.length)} added</span><span>${formatCurrency(order.summary.total)}</span>`;
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
        <button class="stepper-btn" id="btnMinus" type="button" aria-label="Decrease pizza count" ${count<=1?"disabled":""}>−</button>
        <div class="pizza-count-display" aria-live="polite">${count}</div>
        <button class="stepper-btn" id="btnPlus" type="button" aria-label="Increase pizza count" ${count>=MAX_PIZZAS?"disabled":""}>+</button>
      </div>
      <div class="actions-row">
        <button class="btn btn-ghost" id="btnBack" type="button">Back</button>
        <button class="btn btn-primary" id="btnNext" type="button">Continue to menu</button>
      </div>
      ${cancelButtonHTML()}
    `;
  }

  function stepSelectHTML(){
    // Non-colour "already in this order" cue: pizzas already picked for an
    // earlier slot get a checkmark badge directly in the menu (in addition
    // to the picked-pill list below), so repeats are visible without
    // relying on colour alone.
    const pickedNames = new Set(order.pizzas.map(p => p.name));
    const menuHTML = menu.map(p => `
      <button type="button" class="menu-item ${pickedNames.has(p.name) ? "picked" : ""}" data-index="${p.index}">
        <div class="mi-left">
          <span class="mi-name">${p.name}</span>
          <span class="badge ${p.category}">${p.category}</span>
          ${pickedNames.has(p.name) ? `<span class="picked-tag">✓ Already in order</span>` : ""}
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

        const { subtotal, delivery_charge, total } = order.summary;   // calculated by the server
        totalsHTML = `<div class="docket-totals">
          <div class="row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
          ${order.isDelivery ? `<div class="row"><span>Delivery charge</span><span>${formatCurrency(delivery_charge)}</span></div>` : ""}
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
          <span><b>${o.name}</b> · ${o.is_delivery ? "Delivery" : "Pickup"} · ${pizzaLabel(o.pizzas.length)}</span>
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
        card.addEventListener("click", async () => {
          order.isDelivery = card.dataset.type === "delivery";
          await refreshSummary();   // the delivery charge depends on the order type
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
      document.getElementById("btnNext").addEventListener("click", async () => {
        order.pizzaCount = order.pizzaCount || 1;
        order.pizzas = [];
        await refreshSummary();
        slotIndex = 0;
        step = "select";
        renderStep();
      });
    }

    if(step === "select"){
      document.querySelectorAll(".menu-item").forEach(item => {
        item.addEventListener("click", async () => {
          const idx = parseInt(item.dataset.index, 10);
          const chosen = menu[idx];
          order.pizzas.push({ index: chosen.index, name: chosen.name, price: chosen.price, category: chosen.category });
          await refreshSummary();
          if(slotIndex < order.pizzaCount - 1){
            slotIndex++;
            renderStep();
          } else {
            finishOrder();
          }
        });
      });
      document.getElementById("btnBack").addEventListener("click", async () => {
        if(order.pizzas.length > 0){
          order.pizzas.pop();
          await refreshSummary();
          slotIndex = Math.max(0, slotIndex - 1);
          renderStep();
        } else {
          step = "count";
          renderStep();
        }
      });
    }

    if(step === "summary"){
      document.getElementById("btnNewOrder").addEventListener("click", resetOrder);
      document.getElementById("btnExit").addEventListener("click", () => {
        step = "closing";
        renderStep();
      });
    }

    if(step === "closing"){
      document.getElementById("btnReopen").addEventListener("click", resetOrder);
    }
  }

  // Element ids for each field's input box and its error message.
  const FIELD_IDS = {
    name:    ["inputName", "errName"],
    address: ["inputAddress", "errAddress"],
    phone:   ["inputPhone", "errPhone"]
  };

  // Send the details to the server to be checked, then show or hide the error
  // under each field. Moves on to the next step only if everything is valid.
  async function handleDetailsSubmit(){
    const values = {
      name: document.getElementById("inputName").value,
      address: order.isDelivery ? document.getElementById("inputAddress").value : "",
      phone: order.isDelivery ? document.getElementById("inputPhone").value : ""
    };
    const result = await api("/api/validate-details", { is_delivery: Boolean(order.isDelivery), ...values });
    if(!result.ok) return;

    for(const [field, [inputId, errId]] of Object.entries(FIELD_IDS)){
      const input = document.getElementById(inputId);
      if(!input) continue;                      // address/phone only exist for delivery
      const message = result.data.errors[field];
      input.classList.toggle("err", Boolean(message));
      const err = document.getElementById(errId);
      err.classList.toggle("show", Boolean(message));
      if(message) err.textContent = message;
    }

    if(result.data.valid){
      order.name = values.name.trim();
      order.address = values.address.trim();
      order.phone = values.phone.trim();
      step = "count";
      renderStep();
    }
  }

  // Clears the current order and returns to the first step.
  function resetOrder(){
    order = freshOrder();
    slotIndex = 0;
    step = "type";
    renderStep();
  }

  function handleCancelOrder(){
    const ok = window.confirm("Cancel this order? Everything entered so far will be lost.");
    if(ok) resetOrder();
  }

  // Ask the server to check and save the finished order, then show the docket.
  async function finishOrder(){
    const saved = await api("/api/orders", {
      name: order.name,
      is_delivery: Boolean(order.isDelivery),
      address: order.address,
      phone: order.phone,
      pizza_indices: order.pizzas.map(p => p.index)
    });
    if(!saved.ok){
      window.alert("The server could not save this order. Please check the details and try again.");
      return;
    }
    order.summary = saved.data;
    orderRail = (await api("/api/orders")).data;
    renderOrderRail();
    step = "summary";
    renderStep();
    renderDocket(true); // trigger "printed" animation
  }

  /* ============================================================
     INIT
     ============================================================ */
  async function init(){
    const config = (await api("/api/config")).data;
    if(!config.menu){
      document.getElementById("stepContent").textContent =
        "Could not load the menu. Please check that the server is running.";
      return;
    }
    menu = config.menu;
    MAX_PIZZAS = config.max_pizzas;
    DELIVERY_CHARGE = config.delivery_charge;
    orderRail = (await api("/api/orders")).data;
    renderOrderRail();
    renderStep();
  }

  init();
