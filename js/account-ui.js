/* =========================================================
   Atelier — the account button in the top bar (every page)
   Logged in: "Log in / Sign up" become your name with a menu
   (My projects, Account settings, Log out), and the home page's
   "Create free account" buttons become "Open my projects".
   ========================================================= */

const AccountUI = (() => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICONS = {
    projects: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>',
    settings: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0 M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>',
    logout: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l-5-5 5-5 M5 12h11"/></svg>',
    arrow: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };
  const needsLogin = () => document.body.dataset.auth === "required";

  function logOut() {
    Account.logOut();
    if (needsLogin()) location.href = "index.html"; else location.reload();
  }

  function render() {
    const session = Account.current();
    if (!session) return;
    const name = String(session.name).trim();
    const first = esc(name.split(/\s+/)[0]);
    const initial = esc(name.charAt(0).toUpperCase() || "?");
    const here = location.pathname.split("/").pop() || "index.html";
    const guest = Account.isGuest(session);
    // A guest has no email or settings: "Create an account" keeps their projects instead
    const who = guest ? "Guest, no account yet" : esc(session.email);
    const settingsItem = guest
      ? `<a class="account-item" href="signup.html">${ICONS.settings}Create an account</a>`
      : `<a class="account-item" href="projects.html#settings" data-open-settings>${ICONS.settings}Account settings</a>`;

    // Desktop: your name with a small menu
    const actions = document.querySelector(".nav-actions");
    if (actions) {
      actions.innerHTML = `
        ${here === "index.html" ? `<a href="projects.html" class="btn btn-ghost btn-small nav-projects">${ICONS.projects}My projects</a>` : ""}
        <div class="account">
          <button class="account-btn" type="button" aria-expanded="false" aria-controls="account-menu">
            <span class="avatar" aria-hidden="true">${initial}</span>
            <span class="account-name">${first}</span>
            <svg class="icon chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="account-menu" id="account-menu" hidden>
            <p class="account-who"><span>${guest ? "Trying Atelier as" : "Logged in as"}</span><strong>${esc(name)}</strong><small>${who}</small></p>
            <a class="account-item" href="projects.html"${here === "projects.html" ? ' aria-current="page"' : ""}>${ICONS.projects}My projects</a>
            ${settingsItem}
            <button class="account-item" type="button" data-logout>${ICONS.logout}${guest ? "Leave guest mode" : "Log out"}</button>
          </div>
        </div>`;
      const button = actions.querySelector(".account-btn");
      const menu = actions.querySelector(".account-menu");
      const setOpen = (open) => { menu.hidden = !open; button.setAttribute("aria-expanded", String(open)); };
      button.addEventListener("click", () => setOpen(menu.hidden));
      menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("click", (e) => { if (!e.target.closest(".account")) setOpen(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setOpen(false); button.focus(); } });
    }

    // Phone menu
    const mobile = document.querySelector(".nav-actions-mobile");
    if (mobile) {
      mobile.innerHTML = `
        <div class="account-card">
          <span class="avatar" aria-hidden="true">${initial}</span>
          <p><strong>${esc(name)}</strong><small>${who}</small></p>
        </div>
        <a href="projects.html" class="btn btn-primary">${ICONS.projects}My projects</a>
        ${guest ? `<a href="signup.html" class="btn btn-secondary">${ICONS.settings}Create an account</a>` : `<a href="projects.html#settings" class="btn btn-secondary" data-open-settings>${ICONS.settings}Account settings</a>`}
        <button class="btn btn-secondary" type="button" data-logout>${ICONS.logout}${guest ? "Leave guest mode" : "Log out"}</button>`;
    }

    document.querySelectorAll("[data-logout]").forEach((el) => el.addEventListener("click", logOut));

    // Home page: no need to sign up again
    document.querySelectorAll('main a.btn[href="signup.html"]').forEach((a) => {
      a.href = "projects.html";
      a.innerHTML = `Open my projects ${ICONS.arrow}`;
    });
  }

  render();
  return { render, logOut };
})();
