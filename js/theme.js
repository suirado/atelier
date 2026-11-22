/* =========================================================
   Atelier — light / dark mode (every page)
   Loaded in <head> before the page paints, so there is no white flash.
   Your choice is remembered; until you choose, it follows the system setting.
   ========================================================= */

(() => {
  const KEY = "atelier.theme";
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const current = () => saved() || (system.matches ? "dark" : "light");

  function apply(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelectorAll(".theme-toggle").forEach((b) => {
      const dark = theme === "dark";
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      b.title = dark ? "Light mode" : "Dark mode";
    });
    window.dispatchEvent(new CustomEvent("atelier:theme", { detail: theme }));
  }
  apply(current());
  system.addEventListener("change", () => { if (!saved()) apply(current()); });

  const ICON = `<svg class="icon icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
    <svg class="icon icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>`;

  function addButton() {
    // Beside the account button (app and home page) or at the end of the sign-in page's top bar
    const spot = document.querySelector(".nav-actions") || document.querySelector(".auth-top");
    if (!spot || document.querySelector(".theme-toggle")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "theme-toggle";
    b.innerHTML = ICON;
    b.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem(KEY, next); } catch { /* private mode: still switch for this page */ }
      root.classList.add("theme-switching");          // colours change at once, no half-faded mix
      apply(next);
      setTimeout(() => root.classList.remove("theme-switching"), 60);
    });
    if (spot.classList.contains("nav-actions")) spot.before(b); else spot.append(b);
    apply(current());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
})();
