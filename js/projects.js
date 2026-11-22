/* =========================================================
   Atelier — "My projects" dashboard
   ========================================================= */

(() => {
  const session = Account.current();
  if (!session) return;                       // the page is already on its way to log in
  const { esc, euro, m2, timeAgo, toast, openDialog, setError } = App;

  const grid = document.getElementById("project-grid");
  const empty = document.getElementById("empty");
  const toolbar = document.getElementById("dash-toolbar");
  const note = document.getElementById("results-note");
  const search = document.getElementById("search");
  const sortSelect = document.getElementById("sort");
  const state = { query: "", filter: "all", sort: localStorage.getItem("atelier.sort") || "edited" };
  sortSelect.value = state.sort;

  const ICON = {
    download: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    star: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    more: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    open: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    rename: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4"/></svg>',
    copy: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    cart: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2.5l2.2 11h10.6l2-8H6.3"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/></svg>',
    ext: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6 M20 4l-9 9 M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
    trash: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16 M9 7V4.5h6V7 M6.5 7l1 13h9l1-13"/></svg>',
  };

  // ---------- Greeting ----------
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  document.getElementById("greeting").textContent = `${hello}, ${String(session.name).trim().split(/\s+/)[0]}`;
  document.getElementById("today").textContent = new Date().toLocaleDateString((typeof I18N !== "undefined" ? I18N.locale : "en-GB"), { weekday: "long", day: "numeric", month: "long" });

  // ---------- Cards ----------
  const sorters = {
    edited: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    name: (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    area: (a, b) => Projects.area(b) - Projects.area(a),
    budget: (a, b) => Projects.budget(b) - Projects.budget(a),
  };

  function card(p) {
    const rooms = p.rooms.length;
    const area = Projects.area(p);
    const budget = Projects.budget(p);
    const facts = [
      `${rooms} ${rooms === 1 ? "room" : "rooms"}`,
      area ? m2(area) : null,
      budget ? euro(budget) : null,
    ].filter(Boolean).join(" · ");
    return `
      <article class="project-card" data-id="${p.id}">
        <a class="project-thumb" href="project.html?id=${p.id}" tabindex="-1" aria-hidden="true">${planThumbnail(p)}</a>
        <div class="project-body">
          <h3><a href="project.html?id=${p.id}">${esc(p.name)}</a></h3>
          <p class="project-facts">${facts}</p>
          <p class="project-time">Edited ${timeAgo(p.updatedAt)}</p>
          ${budget ? `<button type="button" class="card-shop" data-action="shop">${ICON.cart}What to buy</button>` : ""}
        </div>
        <button type="button" class="icon-btn fav-btn" data-action="favorite" aria-pressed="${p.favorite}" aria-label="${p.favorite ? "Remove from" : "Add to"} favourites: ${esc(p.name)}">${ICON.star}</button>
        <div class="card-menu">
          <button type="button" class="icon-btn more-btn" data-action="menu" aria-expanded="false" aria-haspopup="true" aria-label="More actions for ${esc(p.name)}">${ICON.more}</button>
          <div class="card-menu-list" hidden>
            <a class="account-item" href="project.html?id=${p.id}">${ICON.open}Open</a>
            <button type="button" class="account-item" data-action="rename">${ICON.rename}Rename</button>
            <button type="button" class="account-item" data-action="duplicate">${ICON.copy}Duplicate</button>
            ${budget ? `<button type="button" class="account-item" data-action="download">${ICON.download}Download shopping list (PDF)</button>` : ""}
            <button type="button" class="account-item danger" data-action="delete">${ICON.trash}Delete</button>
          </div>
        </div>
      </article>`;
  }

  function render() {
    const all = Projects.list();
    // Totals
    const set = (k, v) => { document.querySelector(`[data-stat="${k}"]`).textContent = v; };
    set("projects", all.length);
    set("area", m2(all.reduce((s, p) => s + Projects.area(p), 0)));
    set("items", all.reduce((s, p) => s + p.items.length, 0));
    set("budget", euro(Math.round(all.reduce((s, p) => s + Projects.budget(p), 0))));

    renderShopping(all);
    const isEmpty = all.length === 0;
    empty.hidden = !isEmpty;
    toolbar.hidden = isEmpty;
    grid.hidden = isEmpty;
    if (isEmpty) { note.textContent = ""; return; }

    const q = state.query.trim().toLowerCase();
    const shown = all
      .filter((p) => state.filter === "all" || p.favorite)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.rooms.some((r) => r.name.toLowerCase().includes(q)))
      .sort(sorters[state.sort]);

    grid.innerHTML = shown.map(card).join("") + (state.filter === "all" && !q ? `
      <button type="button" class="project-card new-card" data-new-project>
        <span class="new-plus" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14 M5 12h14"/></svg></span>
        <strong>New project</strong><span>Choose a room or build your own</span>
      </button>` : "");

    if (!shown.length) {
      note.innerHTML = q
        ? `No projects match “${esc(state.query.trim())}”. <button type="button" class="link-btn" data-clear>Clear the search</button>`
        : `No favourites yet. Tap the star on a project to keep it here. <button type="button" class="link-btn" data-clear>Show all projects</button>`;
    } else {
      note.textContent = q || state.filter !== "all" ? `Showing ${shown.length} of ${all.length} projects` : "";
    }
  }


  // ---------- What to buy: the shopping list for one project, grouped by store ----------
  const shopSection = document.getElementById("shopping");
  const shopSelect = document.getElementById("shop-project");
  const shopBody = document.getElementById("shop-body");
  let shopId = null;
  const r2 = (v) => Math.round(v * 100) / 100;

  function renderShopping(all) {
    const withItems = all.filter((p) => Projects.shoppingList(p).length);
    shopSection.hidden = !withItems.length;
    if (!withItems.length) return;
    if (!withItems.some((p) => p.id === shopId)) shopId = [...withItems].sort(sorters.edited)[0].id;
    shopSelect.innerHTML = withItems.map((p) => `<option value="${p.id}" ${p.id === shopId ? "selected" : ""}>${esc(p.name)}</option>`).join("");
    const project = withItems.find((p) => p.id === shopId);
    const list = Projects.shoppingList(project).sort((a, b) => b.total - a.total);
    const stores = {};
    list.forEach((g) => { (stores[g.product.store] ||= []).push(g); });
    const total = list.reduce((s, g) => s + g.total, 0);
    const pieces = list.reduce((n, g) => n + g.qty, 0);
    shopBody.innerHTML = `
      <div class="shop-summary">
        <div><span>Total</span><strong>${euro(r2(total), list.some((g) => g.product.estimate))}</strong></div>
        <div><span>Pieces</span><strong>${pieces}</strong></div>
        <div><span>Stores</span><strong>${Object.keys(stores).length}</strong></div>
        <a class="mini-btn primary" href="project.html?id=${project.id}">Open in the planner</a>
      </div>
      <div class="store-grid">
        ${Object.entries(stores).map(([store, rows]) => `
          <section class="store-card" aria-label="${esc(store)}">
            <header class="store-head"><h3>${esc(store)}</h3><span>${rows.reduce((n, g) => n + g.qty, 0)} items · <strong>${euro(r2(rows.reduce((s, g) => s + g.total, 0)), rows.some((g) => g.product.estimate))}</strong></span></header>
            <ul class="buy-list">
              ${rows.map((g) => `
                <li class="buy-row">
                  <span class="buy-qty" aria-label="Quantity">${g.qty}×</span>
                  <span class="buy-main"><strong>${esc(g.product.name)}</strong><small>${esc(g.product.product)}</small></span>
                  <span class="buy-price">${euro(r2(g.total), g.product.estimate)}${g.qty > 1 ? `<small>${euro(g.product.price, g.product.estimate)} each</small>` : ""}</span>
                  <a class="buy-link" href="${g.product.url}" target="_blank" rel="noopener" aria-label="View ${esc(g.product.name)} at ${esc(store)} (opens in a new tab)">${g.product.notHere ? "Search" : "View"} ${ICON.ext}</a>
                </li>`).join("")}
            </ul>
          </section>`).join("")}
      </div>
      <p class="shop-note">Prices from ikea.com/fr and leroymerlin.fr, checked November 2026. Stock and prices can change, so check the store before you buy.</p>`;
  }
  function showShopping(id, scroll) {
    shopId = id;
    renderShopping(Projects.list());
    if (scroll) {
      shopSection.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      shopSelect.focus({ preventScroll: true });
    }
  }
  shopSelect.addEventListener("change", () => showShopping(shopSelect.value, false));
  document.getElementById("shop-print").addEventListener("click", () => print());
  document.getElementById("shop-download").addEventListener("click", (e) => ShoppingPDF.download(Projects.get(shopId), e.currentTarget));
  ["pointerenter", "focus"].forEach((type) => document.getElementById("shop-download").addEventListener(type, () => ShoppingPDF.warm(Projects.get(shopId))));
  document.getElementById("shop-copy").addEventListener("click", () => {
    const project = Projects.get(shopId);
    if (!project) return;
    const lines = Projects.shoppingList(project).map((g) => `${g.qty} × ${g.product.product} (${g.product.store}) — ${euro(r2(g.total), g.product.estimate)} — ${g.product.url}`);
    lines.push("", `Total: ${euro(r2(Projects.budget(project)))}`);
    navigator.clipboard?.writeText(`${project.name}\n\n${lines.join("\n")}`).then(() => toast("Shopping list copied"), () => toast("Couldn't copy. Try selecting the list instead."));
  });

  // ---------- Toolbar ----------
  search.addEventListener("input", () => { state.query = search.value; render(); });
  sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; localStorage.setItem("atelier.sort", state.sort); render(); });
  document.querySelectorAll("[data-filter]").forEach((btn) => btn.addEventListener("click", () => {
    state.filter = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    render();
  }));
  note.addEventListener("click", (e) => {
    if (!e.target.closest("[data-clear]")) return;
    search.value = ""; state.query = "";
    document.querySelector('[data-filter="all"]').click();
    search.focus();
  });

  // ---------- Card actions ----------
  const closeMenus = (except) => document.querySelectorAll(".card-menu-list").forEach((m) => {
    if (m === except) return;
    m.hidden = true;
    m.previousElementSibling.setAttribute("aria-expanded", "false");
  });

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.closest(".project-card").dataset.id;
    const action = btn.dataset.action;
    if (action === "shop") { showShopping(id, true); return; }
    if (action === "menu") {
      const list = btn.nextElementSibling;
      closeMenus(list);
      list.hidden = !list.hidden;
      btn.setAttribute("aria-expanded", String(!list.hidden));
      if (!list.hidden) list.querySelector(".account-item").focus();
      return;
    }
    closeMenus();
    if (action === "favorite") {
      const p = Projects.toggleFavorite(id);
      render();
      grid.querySelector(`[data-id="${id}"] .fav-btn`)?.focus();
      toast(p.favorite ? `Added “${p.name}” to favourites` : `Removed “${p.name}” from favourites`, { duration: 2500 });
    }
    if (action === "rename") askRename(id);
    if (action === "duplicate") {
      const copy = Projects.duplicate(id);
      if (copy.trace) TraceStore.get(id).then((blob) => blob && TraceStore.put(copy.id, blob));   // the plan picture comes along
      render();
      toast(`Made a copy: “${copy.name}”`);
    }
    if (action === "delete") askDelete(id);
    if (action === "download") ShoppingPDF.download(Projects.get(id));
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".card-menu")) closeMenus(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".card-menu-list:not([hidden])");
    if (open) { closeMenus(); open.previousElementSibling.focus(); }
  });

  // ---------- Rename ----------
  const renameDialog = document.getElementById("rename-dialog");
  const renameInput = document.getElementById("rename-name");
  let renaming = null;
  function askRename(id) {
    renaming = id;
    renameInput.value = Projects.get(id).name;
    openDialog(renameDialog);
    renameInput.select();
  }
  document.getElementById("rename-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = renameInput.value.trim();
    if (!name) { setError(renameInput, "Give your project a name"); return; }
    Projects.rename(renaming, name);
    renameDialog.close();
    render();
    toast("Name saved");
  });

  // ---------- Delete (with Undo) ----------
  const deleteDialog = document.getElementById("delete-dialog");
  let deleting = null;
  function askDelete(id) {
    deleting = id;
    deleteDialog.querySelector("[data-name]").textContent = Projects.get(id).name;
    openDialog(deleteDialog);
    deleteDialog.querySelector("[data-close]").focus();   // the safe choice has focus
  }
  document.getElementById("delete-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const removed = Projects.remove(deleting);
    deleteDialog.close();
    render();
    if (removed) toast(`Deleted “${removed.project.name}”`, { action: "Undo", duration: 7000, onAction: () => { Projects.restore(removed); render(); } });
  });

  // ---------- New project: choose a room, or build one to size ----------
  const newDialog = document.getElementById("new-dialog");
  const newName = document.getElementById("new-name");
  const start = { how: "choose", furnished: true, template: "living-furnished" };
  const TYPES = CATALOG.ROOM_TYPES;

  const templateCard = (key, t, asRadio, checked) => {
    const preview = planThumbnail({ rooms: t.rooms, items: t.items });
    const pieces = t.items.filter((it) => !CATALOG.byId[it.catalogId]?.structure).length;
    const area = t.rooms.reduce((s, r) => s + r.w * r.h, 0);
    const inner = `<span class="template-thumb">${preview}</span>
      <span class="template-text"><strong>${esc(t.label)}</strong><span>${esc(t.text)}</span><small>${m2(area)} · ${pieces ? `${pieces} pieces` : "empty"}</small></span>`;
    return asRadio
      ? `<label class="template-card"><input type="radio" name="template" value="${key}" ${checked ? "checked" : ""}>${inner}</label>`
      : `<button type="button" class="template-card" data-template="${key}">${inner}</button>`;
  };
  const shownTemplates = () => Object.entries(CATALOG.templates).filter(([, t]) => t.furnished === start.furnished);

  function renderChoices() {
    const list = shownTemplates();
    if (!list.some(([k]) => k === start.template)) start.template = list[0][0];
    document.getElementById("new-templates").innerHTML = list.map(([k, t]) => templateCard(k, t, true, k === start.template)).join("");
    newDialog.querySelectorAll("[data-furnished]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.furnished === "yes") === start.furnished)));
  }
  document.getElementById("empty-templates").innerHTML = Object.entries(CATALOG.templates)
    .filter(([, t]) => t.furnished).map(([k, t]) => templateCard(k, t, false)).join("");

  // Room types for "Build your own"
  const buildType = document.getElementById("build-type");
  buildType.innerHTML = Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${esc(t.label)}</option>`).join("");
  const buildW = document.getElementById("build-w"), buildH = document.getElementById("build-h"), buildC = document.getElementById("build-ceiling");
  const showArea = () => {
    const w = parseFloat(buildW.value), h = parseFloat(buildH.value);
    document.getElementById("build-area").textContent = w > 0 && h > 0 ? `Floor area: ${m2(Math.round(w * h * 10) / 10)}` : "";
  };
  [buildW, buildH].forEach((i) => i.addEventListener("input", showArea));
  buildType.addEventListener("change", () => {
    const t = TYPES[buildType.value];
    buildW.value = t.w; buildH.value = t.h; showArea();
    if (isSuggested(newName.value)) newName.value = suggestedName();
  });

  let lastSuggested = "";
  const isSuggested = (v) => v === lastSuggested || /^(My (first )?home( \d+)?|The Sunlit Dream Home|My [a-z' ]+)$/i.test(v);
  // In French: the room or home's own name ("Salon", "Appartement haussmannien, Paris")
  const fr = typeof I18N !== "undefined" && I18N.lang === "fr";
  function suggestedName() { return (lastSuggested = suggestion()); }
  function suggestion() {
    if (start.how === "build") return fr ? I18N.t(TYPES[buildType.value].label) : `My ${TYPES[buildType.value].label.toLowerCase()}`;
    if (start.template === "sunlit") return fr ? I18N.t("The Sunlit Dream Home") : "The Sunlit Dream Home";
    const t = CATALOG.templates[start.template];
    return fr ? I18N.t(t.label) : `My ${t.label.toLowerCase()}`;
  }

  function setHow(how) {
    start.how = how;
    newDialog.querySelectorAll("[data-start]").forEach((b) => {
      const on = b.dataset.start === how;
      b.setAttribute("aria-selected", String(on)); b.setAttribute("aria-pressed", String(on));
    });
    document.getElementById("start-choose").hidden = how !== "choose";
    document.getElementById("start-build").hidden = how !== "build";
    if (isSuggested(newName.value)) newName.value = suggestedName();
  }
  newDialog.addEventListener("click", (e) => {
    const how = e.target.closest("[data-start]");
    if (how) { setHow(how.dataset.start); return; }
    const f = e.target.closest("[data-furnished]");
    if (f) {
      start.furnished = f.dataset.furnished === "yes";
      const type = CATALOG.templates[start.template]?.type;
      start.template = `${type && type !== "home" ? type : "living"}-${start.furnished ? "furnished" : "empty"}`;
      renderChoices();
      if (isSuggested(newName.value)) newName.value = suggestedName();
    }
  });
  newDialog.addEventListener("change", (e) => {
    if (e.target.name !== "template") return;
    start.template = e.target.value;
    if (isSuggested(newName.value)) newName.value = suggestedName();
  });

  function askNew(template = "living-furnished", how = "choose") {
    start.template = template;
    start.furnished = CATALOG.templates[template]?.furnished ?? true;
    renderChoices();
    newName.value = "";
    setHow(how);
    newName.value = suggestedName();
    showArea();
    openDialog(newDialog);
    newName.select();
  }

  document.getElementById("new-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = newName.value.trim();
    if (!name) { setError(newName, "Give your project a name"); return; }
    let p;
    if (start.how === "build") {
      const w = parseFloat(buildW.value), h = parseFloat(buildH.value), c = parseFloat(buildC.value);
      if (!(w >= 1 && w <= 30)) { setError(buildW, ""); buildW.focus(); toast("Width must be between 1 and 30 m"); return; }
      if (!(h >= 1 && h <= 30)) { buildH.focus(); toast("Length must be between 1 and 30 m"); return; }
      const type = buildType.value;
      p = Projects.create({ name, template: `${type}-empty` });
      const room = p.rooms[0];
      Object.assign(room, { w, h, height: c >= 2 && c <= 5 ? c : 2.6 });
      // A door near the bottom-right corner and a window centred on the top wall
      p.items = [
        { id: Projects.uid(), catalogId: "window", x: Math.round(w / 2 * 100) / 100, y: 0.06, rot: 0 },
        { id: Projects.uid(), catalogId: "door", x: Math.max(0.6, Math.round((w - 0.8) * 100) / 100), y: Math.round((h - 0.06) * 100) / 100, rot: 180 },
      ];
      Projects.save(p);
    } else {
      p = Projects.create({ name, template: start.template });
    }
    location.href = `project.html?id=${p.id}`;
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-build]")) { askNew("living-empty", "build"); return; }
    const begin = e.target.closest("[data-new-project], [data-template]");
    if (begin) askNew(begin.dataset.template || "living-furnished");
  });

  // ---------- Account settings ----------
  const settings = document.getElementById("settings-dialog");
  function openSettings() {
    const me = Account.current();
    if (Account.isGuest(me)) { location.href = "signup.html"; return; }
    const all = JSON.parse(localStorage.getItem("atelier.accounts") || "{}")[me.email.trim().toLowerCase()] || {};
    document.getElementById("set-name").value = me.name;
    settings.querySelector("[data-email]").textContent = me.email;
    settings.querySelector("[data-since]").textContent = all.createdAt
      ? new Date(all.createdAt).toLocaleDateString((typeof I18N !== "undefined" ? I18N.locale : "en-GB"), { month: "long", year: "numeric" }) : "today";
    settings.querySelector("[data-count]").textContent = Projects.list().length;
    settings.querySelectorAll("input[type=password]").forEach((i) => { i.value = ""; });
    openDialog(settings);
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-open-settings]")) return;
    e.preventDefault();
    openSettings();
  });
  settings.addEventListener("close", () => { if (location.hash === "#settings") history.replaceState(null, "", location.pathname + location.search); });

  document.getElementById("name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("set-name");
    const name = input.value.trim();
    if (name.length < 2) { setError(input, "Your name needs at least 2 letters"); return; }
    setError(input, "");
    Account.updateName(name);
    AccountUI.render();
    document.getElementById("greeting").textContent = `${hello}, ${name.split(/\s+/)[0]}`;
    toast("Name updated");
  });

  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("current");
    const next = document.getElementById("new-password");
    setError(current, ""); setError(next, "");
    if (!current.value) return setError(current, "Enter your current password");
    if (next.value.length < 8 || !/[a-z]/i.test(next.value) || !/\d/.test(next.value)) {
      return setError(next, "Use at least 8 characters, with a letter and a number");
    }
    if (next.value === current.value) return setError(next, "Choose a password different from the current one");
    try {
      await Account.changePassword(current.value, next.value);
      current.value = ""; next.value = "";
      toast("Password changed");
    } catch (err) {
      setError(current, err.message || "Something went wrong. Please try again.");
    }
  });

  document.getElementById("delete-account-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("delete-password");
    if (!input.value) return setError(input, "Type your password to confirm");
    try {
      await Account.deleteAccount(input.value);
      location.href = "index.html";
    } catch (err) {
      setError(input, err.message || "Something went wrong. Please try again.");
    }
  });

  // ---------- Start ----------
  render();
  const params = new URLSearchParams(location.search);
  // "Make my own copy" on a shared plan (view.html): it waited here through log in or sign up
  if (params.has("import")) {
    history.replaceState(null, "", location.pathname);
    Share.takePending(Projects.uid).then((data) => {
      if (!data) return;
      const p = Projects.importShared(data);
      location.replace(`project.html?id=${p.id}`);
    }).catch(() => toast("That shared plan couldn't be opened. Ask for the link again.", { duration: 3500 }));
  }
  // "Open this home" on the landing page: a copy of that home, made yours, opened right away
  const home = params.get("home");
  if (home && CATALOG.templates[home]?.showcase) {
    const p = Projects.create({ name: CATALOG.templates[home].label, template: home });
    location.replace(`project.html?id=${p.id}`);
    return;
  }
  if (location.hash === "#settings") openSettings();
  if (location.hash === "#shopping" && !shopSection.hidden) requestAnimationFrame(() => shopSection.scrollIntoView({ block: "start" }));
  else if (params.has("new")) {
    history.replaceState(null, "", location.pathname);
    askNew("living-furnished");
  }
})();
