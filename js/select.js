/* =========================================================
   Atelier — nicer drop-down menus
   The browser draws a <select>'s option list itself, so it can't match the
   site (and in dark mode it shows a pale blue box). This swaps each <select>
   for a button + list we can style. The real <select> stays underneath,
   hidden: the page's code keeps reading .value and listening for "change".
   Keyboard: arrows, Home/End, Enter/Space, Esc, and typing a letter jumps to it.
   ========================================================= */

const FancySelect = (() => {
  const CHEVRON = '<svg class="icon fs-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const CHECK = '<svg class="icon fs-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const valueProp = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  let count = 0;

  function enhance(select) {
    if (select.dataset.fancy === "done") return;
    select.dataset.fancy = "done";
    const n = ++count;
    const wrap = document.createElement("div");
    wrap.className = "fancy-select" + (select.classList.contains("plain-select") ? " is-block" : "");
    select.before(wrap);
    wrap.append(select);
    select.classList.add("fs-native");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "fs-button";
    button.id = `fs-button-${n}`;
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `<span class="fs-value"></span>${CHEVRON}`;
    const list = document.createElement("ul");
    list.className = "fs-list";
    list.id = `fs-list-${n}`;
    list.setAttribute("role", "listbox");
    list.tabIndex = -1;
    list.hidden = true;
    button.setAttribute("aria-controls", list.id);
    wrap.append(button, list);

    // The <label for="..."> now names the button
    const label = select.id && document.querySelector(`label[for="${CSS.escape(select.id)}"]`);
    if (label) {
      label.htmlFor = button.id;
      label.id ||= `fs-label-${n}`;
      list.setAttribute("aria-labelledby", label.id);
      button.setAttribute("aria-labelledby", `${label.id} ${button.id}`);
    }
    select.focus = (o) => button.focus(o);           // code that focuses the select focuses the button

    let active = -1;
    const options = () => [...select.options];
    const items = () => [...list.children];

    function render() {
      const opts = options();
      list.innerHTML = opts.map((o, i) => `<li role="option" id="${list.id}-${i}" class="fs-option" aria-selected="${o.selected}"${o.disabled ? ' aria-disabled="true"' : ""}><span>${escapeHtml(o.textContent)}</span>${CHECK}</li>`).join("");
      const cur = select.selectedOptions[0];
      button.querySelector(".fs-value").textContent = cur ? cur.textContent : "";
      button.disabled = select.disabled || !opts.length;
    }
    function setActive(i) {
      const all = items();
      if (!all.length) return;
      active = Math.max(0, Math.min(all.length - 1, i));
      all.forEach((li, k) => li.classList.toggle("is-active", k === active));
      list.setAttribute("aria-activedescendant", all[active].id);
      all[active].scrollIntoView({ block: "nearest" });
    }
    function open() {
      if (button.disabled) return;
      render();
      list.hidden = false;
      wrap.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      place();
      setActive(Math.max(0, select.selectedIndex));
      list.focus({ preventScroll: true });
    }
    // The list floats over everything (dialogs and scroll boxes would cut it off), next to the button
    function place() {
      const r = button.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
      const h = Math.min(list.scrollHeight, 300);
      const up = below < h && above > below;
      list.style.minWidth = `${r.width}px`;
      list.style.maxHeight = `${Math.max(120, Math.min(300, up ? above : below))}px`;
      list.style.left = `${r.left}px`;
      list.style.top = up ? `${r.top - 6 - Math.min(h, above)}px` : `${r.bottom + 6}px`;
      // A dialog that is still animating moves "fixed" boxes with it: correct by what we measure
      const got = list.getBoundingClientRect();
      const wantTop = up ? r.top - 6 - got.height : r.bottom + 6;
      list.style.left = `${parseFloat(list.style.left) + r.left - got.left}px`;
      list.style.top = `${parseFloat(list.style.top) + wantTop - got.top}px`;
    }
    window.addEventListener("resize", () => close(false));
    document.addEventListener("scroll", (e) => { if (!list.hidden && !list.contains(e.target)) close(false); }, true);

    function close(refocus = true) {
      if (list.hidden) return;
      list.hidden = true;
      wrap.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
      if (refocus) button.focus({ preventScroll: true });
    }
    function choose(i) {
      const o = options()[i];
      if (!o || o.disabled) return;
      const changed = select.selectedIndex !== i;
      select.selectedIndex = i;
      render();
      close();
      if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    button.addEventListener("click", () => (list.hidden ? open() : close()));
    button.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
    });
    list.addEventListener("click", (e) => {
      const li = e.target.closest(".fs-option");
      if (li) choose(items().indexOf(li));
    });
    list.addEventListener("pointermove", (e) => {
      const li = e.target.closest(".fs-option");
      if (li) setActive(items().indexOf(li));
    });
    let typed = "", typedAt = 0;
    list.addEventListener("keydown", (e) => {
      const all = items();
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); setActive(0); }
      else if (e.key === "End") { e.preventDefault(); setActive(all.length - 1); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === "Tab") close(false);
      else if (e.key.length === 1 && /\S/.test(e.key)) {
        typed = (Date.now() - typedAt > 700 ? "" : typed) + e.key.toLowerCase();
        typedAt = Date.now();
        const hit = options().findIndex((o) => o.textContent.trim().toLowerCase().startsWith(typed));
        if (hit >= 0) setActive(hit);
      }
    });
    document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) close(false); });

    // Stay in step with the page's code: new options, or .value set directly
    new MutationObserver(render).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "selected"] });
    Object.defineProperty(select, "value", {
      get() { return valueProp.get.call(this); },
      set(v) { valueProp.set.call(this, v); render(); },
    });
    select.addEventListener("change", render);
    render();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  document.querySelectorAll("select").forEach(enhance);
  return { enhance };
})();
