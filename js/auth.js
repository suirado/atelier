/* =========================================================
   Atelier — sign up & log in
   Friendly checks: a field is checked when you leave it, and an
   error disappears as soon as you fix it. Nothing is checked while
   you are still typing for the first time.

   Accounts are handled by js/account.js (kept in this browser,
   passwords stored only as salted hashes).
   ========================================================= */

const ICON_ALERT = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5 M12 16.5v.01"/></svg>';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Password rules for new accounts (also shown as a checklist under the field)
const RULES = {
  length: (v) => v.length >= 8,
  letter: (v) => /[a-zA-Z]/.test(v),
  number: (v) => /\d/.test(v),
};
const RULE_TEXT = { length: "at least 8 characters", letter: "a letter", number: "a number" };

// One message per problem, written as what to do next
function problemWith(input) {
  const value = input.type === "checkbox" ? input.checked : input.value.trim();
  switch (input.name) {
    case "name":
      if (!value) return "Enter your name";
      if (value.length < 2) return "Your name needs at least 2 letters";
      return "";
    case "email":
    case "reset-email":
      if (!value) return "Enter your email address";
      if (!EMAIL_RE.test(value)) return "Enter an email address like name@example.com";
      return "";
    case "password": {
      const raw = input.value;
      if (!input.hasAttribute("data-rules")) return raw ? "" : "Enter your password";
      if (!raw) return "Create a password";
      const missing = Object.keys(RULES).filter((r) => !RULES[r](raw)).map((r) => RULE_TEXT[r]);
      if (!missing.length) return "";
      return `Your password still needs ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")}`;
    }
    case "terms":
      return value ? "" : "Tick the box to agree to the Terms and Privacy policy";
    default:
      return "";
  }
}

function fieldOf(input) { return input.closest(".field"); }

// extra = optional HTML after the message (e.g. a "Log in instead" link)
function showResult(input, message, extra = "") {
  const field = fieldOf(input);
  const error = field.querySelector(".field-error");
  field.classList.toggle("is-invalid", Boolean(message));
  const tick = !message && input.type !== "checkbox" && input.name !== "password" && input.value.trim();
  field.classList.toggle("is-valid", Boolean(tick));
  input.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) {
    error.innerHTML = message ? `${ICON_ALERT}<span>${message}${extra ? ` ${extra}` : ""}</span>` : "";
    error.hidden = !message;
  }
}

function check(input) {
  const message = problemWith(input);
  showResult(input, message);
  return message;
}

// ---------- Password: show / hide, checklist, strength, Caps Lock ----------

document.querySelectorAll(".reveal").forEach((button) => {
  const input = document.getElementById(button.getAttribute("aria-controls"));
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    input.focus({ preventScroll: true });
  });
});

document.querySelectorAll('input[name="password"][data-rules]').forEach((input) => {
  const field = fieldOf(input);
  const meter = field.querySelector(".strength");
  const update = () => {
    const met = Object.keys(RULES).filter((rule) => {
      const ok = RULES[rule](input.value);
      field.querySelector(`[data-rule="${rule}"]`)?.classList.toggle("is-met", ok);
      return ok;
    }).length;
    if (meter) meter.dataset.level = input.value ? String(Math.max(1, met)) : "0";
  };
  input.addEventListener("input", update);
  update();
});

document.querySelectorAll('input[type="password"]').forEach((input) => {
  const warning = fieldOf(input).querySelector(".caps-warning");
  if (!warning) return;
  const update = (e) => { warning.hidden = !(e.getModifierState && e.getModifierState("CapsLock")); };
  input.addEventListener("keydown", update);
  input.addEventListener("keyup", update);
  input.addEventListener("blur", () => { warning.hidden = true; });
});

// Coming from "Log in instead" / "Create an account": keep the email already typed
const emailFromLink = new URLSearchParams(location.search).get("email");
if (emailFromLink) {
  const email = document.getElementById("email");
  if (email) email.value = emailFromLink;
}

// ---------- Forms ----------

function setBusy(button, busy, busyText) {
  const label = button.querySelector(".label");
  if (busy) {
    button.dataset.idle = label.textContent;
    label.textContent = busyText;
  } else if (button.dataset.idle) {
    label.textContent = button.dataset.idle;
  }
  button.setAttribute("aria-busy", String(busy));
  button.disabled = busy;
}

function showSummary(summary, problems) {
  if (!summary) { problems[0][0].focus(); return; }
  summary.querySelector("ul").innerHTML = problems
    .map(([input, message]) => `<li><a href="#${input.id}" data-focus="${input.id}">${message}</a></li>`)
    .join("");
  summary.hidden = false;
  summary.focus();
}

// submit(data) does the real work. It may throw an Account.AccountError;
// explain(error, data) turns that into a message (+ helpful link) on the right field.
function wireForm(form, { submit, explain }) {
  const inputs = [...form.querySelectorAll("input[name]")].filter((i) => i.name !== "remember");
  const summary = document.getElementById(form.dataset.summary);

  inputs.forEach((input) => {
    input.addEventListener("blur", () => {
      if (input.type === "checkbox") return;
      if (input.value.trim() || input.dataset.touched) { input.dataset.touched = "1"; check(input); }
    });
    input.addEventListener(input.type === "checkbox" ? "change" : "input", () => {
      if (input.dataset.touched || fieldOf(input).classList.contains("is-invalid")) check(input);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const problems = inputs
      .map((input) => { input.dataset.touched = "1"; return [input, check(input)]; })
      .filter(([, message]) => message);
    if (problems.length) { showSummary(summary, problems); return; }

    if (summary) summary.hidden = true;
    const button = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form));
    setBusy(button, true, button.dataset.busy || "One moment…");
    try {
      await submit(data);
    } catch (error) {
      if (!(error instanceof Account.AccountError)) {
        console.error(error);
        error.field = inputs[0].name;
        error.message = "Something went wrong on our side. Please try again.";
      }
      const input = form.querySelector(`[name="${error.field}"]`) || inputs[0];
      const { message, extra } = explain ? explain(error, data) : { message: error.message };
      showResult(input, message, extra);
      showSummary(summary, [[input, message]]);
    } finally {
      setBusy(button, false);
    }
  });
}

// Links in the error summary jump straight into the field
document.querySelectorAll(".error-summary").forEach((summary) => {
  summary.addEventListener("click", (e) => {
    const link = e.target.closest("[data-focus]");
    if (!link) return;
    e.preventDefault();
    const input = document.getElementById(link.dataset.focus);
    input.focus();
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  });
});

function showDone(hideList, done, name) {
  hideList.forEach((el) => el && (el.hidden = true));
  if (name) done.querySelectorAll("[data-name]").forEach((el) => { el.textContent = name; });
  done.hidden = false;
  done.querySelector("h2").focus();
}

const firstName = (name) => String(name || "").trim().split(/\s+/)[0];

// Already logged in? Say so instead of showing the form again
function showAlreadyIn(session) {
  const card = document.querySelector(".auth-card");
  [...card.children].forEach((el) => { el.hidden = true; });
  const panel = document.createElement("div");
  panel.className = "auth-done";
  panel.innerHTML = `
    <div class="done-badge" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h2 tabindex="-1">You're already logged in</h2>
    <p>Logged in as <strong>${escapeHtml(session.name)}</strong> (${escapeHtml(session.email)}).</p>
    <div class="auth-done-actions">
      <a href="projects.html" class="btn btn-primary btn-large">Go to my projects</a>
      <button type="button" class="btn btn-light btn-large" id="switch-account">Log out</button>
    </div>`;
  card.append(panel);
  panel.querySelector("#switch-account").addEventListener("click", () => { Account.logOut(); location.reload(); });
}

// Where to go after logging in or signing up: only our own pages
const nextPage = (() => {
  const next = new URLSearchParams(location.search).get("next");
  return next && /^[a-z-]+\.html([?#][\w=&#%.-]*)?$/i.test(next) ? next : null;
})();

// "Try it without an account": straight in as a guest (someone logged in just goes on)
function goAsGuest() {
  if (!Account.current()) Account.startGuest();
  location.replace(nextPage || "projects.html");
}
if (new URLSearchParams(location.search).has("guest")) goAsGuest();
document.querySelectorAll("[data-guest]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); goAsGuest(); }));

// A guest can still log in or sign up (signing up keeps their projects)
const session = Account.current();
if (session && !Account.isGuest(session) && (document.getElementById("signup-form") || document.getElementById("login-form"))) {
  showAlreadyIn(session);
}
// Switching between "Log in" and "Sign up" keeps it
if (nextPage) document.querySelectorAll(".auth-switch a").forEach((a) => {
  a.href = `${a.getAttribute("href").split("?")[0]}?next=${encodeURIComponent(nextPage)}`;
});

// ---------- Sign up ----------

const signupForm = document.getElementById("signup-form");
if (signupForm && !session) {
  wireForm(signupForm, {
    submit: async (data) => {
      const account = await Account.signUp(data);
      if (nextPage) { location.href = nextPage; return; }     // e.g. making a copy of a shared plan
      showDone(
        [signupForm, document.getElementById("auth-intro"), document.querySelector(".auth-switch")],
        document.getElementById("auth-done"),
        firstName(account.name),
      );
    },
    explain: (error, data) => error.code === "exists"
      ? { message: "There's already an account with this email.", extra: `<a href="login.html?email=${encodeURIComponent(data.email)}">Log in instead</a>` }
      : { message: error.message },
  });
}

// ---------- Log in + forgot password ----------

const loginForm = document.getElementById("login-form");
if (loginForm && !session) {
  const intro = document.getElementById("auth-intro");
  const resetPanel = document.getElementById("reset-panel");
  const resetForm = document.getElementById("reset-form");
  const resetSent = document.getElementById("reset-sent");
  const summary = document.getElementById("login-errors");

  wireForm(loginForm, {
    submit: async (data) => {
      await Account.logIn({ email: data.email, password: data.password, remember: data.remember === "on" });
      // Back to the page that asked for a log-in (only our own pages), otherwise to your projects
      location.href = nextPage || "projects.html";
    },
    explain: (error, data) => {
      if (error.code === "no-account") {
        return { message: "We couldn't find an account with this email.", extra: `<a href="signup.html?email=${encodeURIComponent(data.email)}">Create one</a>` };
      }
      if (error.code === "wrong-password") {
        return { message: "That password isn't right.", extra: 'Check Caps Lock, or <button type="button" class="link-button inline" data-open-reset>reset your password</button>.' };
      }
      return { message: error.message };
    },
  });

  const openReset = () => {
    summary.hidden = true;
    loginForm.hidden = true;
    intro.hidden = true;
    resetPanel.hidden = false;
    resetForm.hidden = false;
    resetSent.hidden = true;
    document.getElementById("reset-email").value = document.getElementById("email").value;   // no need to type it twice
    resetPanel.querySelector("h2").focus();
  };
  const closeReset = () => {
    resetPanel.hidden = true;
    loginForm.hidden = false;
    intro.hidden = false;
    document.getElementById("email").focus();
  };
  document.getElementById("forgot").addEventListener("click", openReset);
  document.getElementById("back-to-login").addEventListener("click", closeReset);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-open-reset]")) openReset(); });

  wireForm(resetForm, {
    submit: async (data) => {
      if (!Account.exists(data["reset-email"])) {
        throw new Account.AccountError("no-account", "reset-email", "We couldn't find an account with this email.");
      }
      resetForm.hidden = true;
      resetSent.querySelector("[data-email]").textContent = data["reset-email"];
      resetSent.hidden = false;
      resetSent.focus();
    },
    explain: (error, data) => error.code === "no-account"
      ? { message: "We couldn't find an account with this email.", extra: `<a href="signup.html?email=${encodeURIComponent(data["reset-email"])}">Create one</a>` }
      : { message: error.message },
  });
}
