/* =========================================================
   Atelier — small helpers shared by "My projects" and the planner
   ========================================================= */

const App = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Money in the currency of the country you shop in; estimate = a converted price, shown with ≈
  const euro = (n, estimate = false) => typeof Region !== "undefined" ? Region.money(n, estimate) : new Intl.NumberFormat("en-IE", {
    style: "currency", currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2,
  }).format(n);
  const m2 = (n) => `${n.toLocaleString((typeof I18N !== "undefined" ? I18N.locale : "en-GB"), { maximumFractionDigits: n < 10 ? 1 : 0 })} m²`;
  const metres = (n) => `${n.toFixed(2).replace(/\.?0+$/, "")} m`;

  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 45) return "just now";
    if (s < 3600) return plural(Math.round(s / 60), "minute");
    if (s < 86400) return plural(Math.round(s / 3600), "hour");
    if (s < 86400 * 2) return typeof I18N !== "undefined" && I18N.lang === "fr" ? "hier" : "yesterday";
    if (s < 604800) return plural(Math.round(s / 86400), "day");
    return new Date(iso).toLocaleDateString((typeof I18N !== "undefined" ? I18N.locale : "en-GB"), { day: "numeric", month: "short", year: "numeric" });
  }
  const plural = (n, word) => typeof I18N !== "undefined" && I18N.lang === "fr"
    ? new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(-n, word)
    : `${n} ${word}${n === 1 ? "" : "s"} ago`;

  // ---------- Toasts: short messages, optionally with one action ("Undo") ----------
  // One message at a time: a new one replaces the one on screen instead of stacking up
  // (deleting or undoing many things quickly would otherwise fill the screen)
  let current = null;
  function toast(message, { action, onAction, duration = 5000 } = {}) {
    const region = document.getElementById("toasts");
    if (!region) return;
    let el = current?.el;
    if (el && el.isConnected && !el.classList.contains("is-leaving")) {
      clearTimeout(current.timer);
      el.classList.remove("is-bump"); void el.offsetWidth; el.classList.add("is-bump");   // small nudge: "this is new"
    } else {
      el = document.createElement("div");
      el.className = "toast";
      region.replaceChildren(el);
      el.addEventListener("mouseenter", () => clearTimeout(current?.timer));
      el.addEventListener("mouseleave", () => { if (current?.el === el) current.timer = setTimeout(current.close, 2500); });
    }
    el.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg><span>${esc(message)}</span>`;
    const close = () => {
      if (current?.el !== el) return;
      clearTimeout(current.timer); current = null;
      el.classList.add("is-leaving"); setTimeout(() => el.remove(), 250);
    };
    if (action) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "toast-action"; btn.textContent = action;
      btn.addEventListener("click", () => { onAction?.(); close(); });
      el.append(btn);
    }
    current = { el, close, timer: setTimeout(close, duration) };
  }

  // ---------- Dialogs (native <dialog>: focus stays inside, Esc closes) ----------
  function openDialog(dialog) {
    dialog.querySelectorAll(".app-field").forEach((f) => setError(f.querySelector("input"), ""));
    dialog.showModal();
  }
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close]");
    if (closer) closer.closest("dialog")?.close();
    // Click on the dimmed backdrop closes too
    if (e.target instanceof HTMLDialogElement && e.target.open) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });

  // ---------- Field errors next to the field ----------
  function setError(input, message) {
    if (!input) return;
    const field = input.closest(".app-field");
    const error = field?.querySelector(".app-error");
    field?.classList.toggle("is-invalid", Boolean(message));
    input.setAttribute("aria-invalid", String(Boolean(message)));
    if (error) { error.textContent = message; error.hidden = !message; }
    if (message) input.focus();
  }

  // ---------- Phone menu ----------
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");
  if (menuToggle && navLinks) {
    const setMenu = (open) => {
      navLinks.classList.toggle("open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    menuToggle.addEventListener("click", () => setMenu(!navLinks.classList.contains("open")));
    navLinks.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  }

  return { esc, euro, m2, metres, timeAgo, toast, openDialog, setError };
})();
