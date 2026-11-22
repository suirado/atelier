/* =========================================================
   Atelier — accounts, kept in this browser
   ---------------------------------------------------------
   Each account is saved in localStorage. The password itself is never
   stored: only a salted PBKDF2-SHA-256 hash (150 000 rounds), the same
   method real sites use. Logging in hashes what you type and compares.

   Limits of a browser-only version: accounts live on this device and
   this browser only. To move to real online accounts, replace the
   bodies of signUp / logIn / logOut / current with Supabase Auth calls;
   the pages only use these five functions.
   ========================================================= */

const Account = (() => {
  const ACCOUNTS_KEY = "atelier.accounts";
  const SESSION_KEY = "atelier.session";
  const ROUNDS = 150000;
  // "Try it without an account": a guest, kept in this browser like any account, with no password.
  // Signing up later takes the guest's projects along.
  const GUEST = "guest@atelier.local";

  const normalise = (email) => String(email || "").trim().toLowerCase();
  const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  function readAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || {}; } catch { return {}; }
  }
  function writeAccounts(all) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(all)); }

  async function hash(password, salt, rounds = ROUNDS) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, 256);
    return toB64(bits);
  }

  // Compare without stopping at the first different character
  function sameText(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // Errors carry a code and the field they belong to, so the form can show them in the right place
  class AccountError extends Error {
    constructor(code, field, message) { super(message); this.code = code; this.field = field; }
  }

  function startSession(account, remember) {
    const session = JSON.stringify({ email: account.email, name: account.name, since: Date.now() });
    // "Keep me logged in" = survives closing the browser; otherwise only this tab session
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, session);
  }

  return {
    AccountError,

    exists(email) { return Boolean(readAccounts()[normalise(email)]); },

    GUEST,
    isGuest(session = this.current()) { return !!session && normalise(session.email) === GUEST; },

    startGuest() {
      const all = readAccounts();
      if (!all[GUEST]) {
        all[GUEST] = { name: "Guest", email: GUEST, guest: true, createdAt: new Date().toISOString() };
        writeAccounts(all);
      }
      startSession(all[GUEST], true);
      return { name: all[GUEST].name, email: GUEST };
    },

    async signUp({ name, email, password }) {
      const id = normalise(email);
      const all = readAccounts();
      if (id === GUEST) throw new AccountError("exists", "email", "There is already an account with this email.");
      const wasGuest = this.isGuest();
      if (all[id]) throw new AccountError("exists", "email", "There is already an account with this email.");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const account = {
        name: String(name).trim(),
        email: String(email).trim(),
        salt: toB64(salt),
        hash: await hash(password, salt),
        rounds: ROUNDS,
        createdAt: new Date().toISOString(),
      };
      all[id] = account;
      // A guest who signs up keeps what they planned
      if (wasGuest) {
        const plans = localStorage.getItem(`atelier.projects.${GUEST}`);
        if (plans) localStorage.setItem(`atelier.projects.${id}`, plans);
        localStorage.removeItem(`atelier.projects.${GUEST}`);
        delete all[GUEST];
      }
      writeAccounts(all);
      startSession(account, true);
      return { name: account.name, email: account.email };
    },

    async logIn({ email, password, remember = true }) {
      const account = readAccounts()[normalise(email)];
      if (!account || account.guest) throw new AccountError("no-account", "email", "We couldn't find an account with this email.");
      const attempt = await hash(password, fromB64(account.salt), account.rounds);
      if (!sameText(attempt, account.hash)) throw new AccountError("wrong-password", "password", "That password isn't right.");
      startSession(account, remember);
      return { name: account.name, email: account.email };
    },

    current() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
        const session = raw && JSON.parse(raw);
        // A session only counts if its account still exists
        return session && readAccounts()[normalise(session.email)] ? session : null;
      } catch { return null; }
    },

    logOut() {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    },

    // ---- Account settings (only for the person logged in) ----
    updateName(name) {
      const session = this.current();
      if (!session) throw new AccountError("no-session", "name", "Please log in again.");
      const all = readAccounts();
      const id = normalise(session.email);
      all[id].name = String(name).trim();
      writeAccounts(all);
      const store = sessionStorage.getItem(SESSION_KEY) ? sessionStorage : localStorage;
      store.setItem(SESSION_KEY, JSON.stringify({ ...session, name: all[id].name }));
      return all[id].name;
    },

    async changePassword(current, next) {
      const session = this.current();
      if (!session) throw new AccountError("no-session", "current", "Please log in again.");
      const all = readAccounts();
      const account = all[normalise(session.email)];
      const attempt = await hash(current, fromB64(account.salt), account.rounds);
      if (!sameText(attempt, account.hash)) throw new AccountError("wrong-password", "current", "That isn't your current password.");
      const salt = crypto.getRandomValues(new Uint8Array(16));
      Object.assign(account, { salt: toB64(salt), hash: await hash(next, salt), rounds: ROUNDS });
      writeAccounts(all);
    },

    async deleteAccount(password) {
      const session = this.current();
      if (!session) throw new AccountError("no-session", "delete-password", "Please log in again.");
      const all = readAccounts();
      const id = normalise(session.email);
      const attempt = all[id].guest ? "" : await hash(password, fromB64(all[id].salt), all[id].rounds);
      if (!all[id].guest && !sameText(attempt, all[id].hash)) throw new AccountError("wrong-password", "delete-password", "That password isn't right.");
      delete all[id];
      writeAccounts(all);
      localStorage.removeItem(`atelier.projects.${id}`);   // the projects go with the account
      this.logOut();
    },
  };
})();
