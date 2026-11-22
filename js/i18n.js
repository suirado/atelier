/* =========================================================
   Atelier — English / français (every page)
   Loaded in <head>, right after js/i18n-fr.js (the dictionary),
   before the page paints. The pages are written in English; in
   French, every piece of text the page shows (and the titles,
   labels and placeholders) is swapped for its French version as
   soon as it appears, including text the scripts add later.
   Numbers get a decimal comma: 2,7 m, 4,5:1.
   Your choice is remembered; until you choose, the site is in
   French.
   ========================================================= */

const I18N = (() => {
  const KEY = "atelier.lang";
  const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const lang = saved() === "fr" || saved() === "en" ? saved()
    : "fr";                                          // French until you choose English
  const root = document.documentElement;
  root.lang = lang;
  const locale = lang === "fr" ? "fr-FR" : "en-GB";

  function set(next) {
    if (next === lang) return;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: nothing to remember */ }
    location.reload();
  }

  // ---------- The button: beside the light / dark button ----------
  function addButton() {
    const theme = document.querySelector(".theme-toggle");
    const spot = theme || document.querySelector(".nav-actions") || document.querySelector(".auth-top");
    if (!spot || document.querySelector(".lang-toggle")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lang-toggle";
    b.setAttribute("translate", "no");
    b.lang = lang === "fr" ? "en" : "fr";
    b.textContent = lang === "fr" ? "EN" : "FR";
    b.title = lang === "fr" ? "English" : "Français";
    b.setAttribute("aria-label", lang === "fr" ? "Switch to English" : "Passer en français");
    b.addEventListener("click", () => set(lang === "fr" ? "en" : "fr"));
    if (spot === theme || spot.classList.contains("nav-actions")) spot.before(b); else spot.append(b);
  }
  // after js/theme.js has put its button in
  const ready = () => setTimeout(addButton, 0);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();

  if (lang !== "fr") return { lang, locale, set, t: (s) => s };

  // ---------- The dictionary ----------
  const D = window.ATELIER_FR || { exact: {}, patterns: [] };
  const exact = new Map(Object.entries(D.exact));
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // "Showing {} of {} projects": the parts around {} must match, the {} can be anything
  const patterns = D.patterns.map(([en, fr]) => {
    const parts = en.split("{}");
    return { head: parts[0], re: new RegExp("^" + parts.map(escape).join("(.*?)") + "$"), fr };
  });

  // 1,500 → 1 500 and 2.7 → 2,7 (not inside web addresses, e-mails or file names)
  function numbers(s) {
    if (!/\d[.,]\d/.test(s) || /:\/\/|@|\.(pdf|json|txt|js|py|html|jpe?g|png)\b|www\./i.test(s)) return s;
    // …but a version number after a word stays as it is: WCAG 2.2, licence 1.1 (a measurement has its unit: plafond 2.7 m)
    const unit = /^\d*\s?(m²|m\b|cm|mm|km|l\b|L\b|kg|%|×|€|lm|W\b|:1)/;
    return s.replace(/(\d),(\d{3})(?!\d)/g, "$1\u202f$2")
      .replace(/([A-Za-z]+ )?(\d+)\.(\d)/g, (all, word, a, b, at) => word && !unit.test(s.slice(at + all.length)) ? all : `${word || ""}${a},${b}`);
  }

  const cache = new Map();
  function lookup(key) {
    let out = exact.get(key);
    if (out === undefined) {
      for (const p of patterns) {
        if (!key.startsWith(p.head)) continue;
        const m = p.re.exec(key);
        if (!m) continue;
        const parts = m.slice(1);
        let i = 0;
        out = p.fr.replace(/\{(\d?)\}/g, (_, n) => translate(parts[n === "" ? i++ : +n] ?? ""));
        break;
      }
    }
    if (out === undefined) out = loose(key);
    if (out === undefined) return numbers(key);
    // French spacing: a space that never breaks before ? ! : ; » and after «
    return numbers(out).replace(/ ([?!:;»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
  }
  // Text the page glues to a mark or a price: “a quote”, "Sofa ·", "Sofa, 339 €"
  function loose(key) {
    // a name written small inside a sentence ("between the dining chair and …"): as in the list, written small too
    if (/^[a-z]/.test(key)) {
      const big = exact.get(key[0].toUpperCase() + key.slice(1));
      if (big !== undefined) return big[0].toLowerCase() + big.slice(1);
    }
    const q = /^[“"](.+)[”"]$/.exec(key);
    if (q) { const inner = lookup(q[1]); return inner === q[1] ? undefined : `« ${inner} »`; }
    const m = /^([\s·•—–:(.,]*)(.*?)([\s·•—–:,.;)]*)$/.exec(key);
    if (m && (m[1] || m[3]) && m[2]) {
      const core = exact.get(m[2]);
      if (core !== undefined) return m[1] + core + m[3];
      const whole = exact.get(m[2] + m[3].trim());          // ". The TVs … in Blender." with its full stop
      if (whole !== undefined) return m[1] + whole;
    }
    const n = /^(\d+ × )(.+)$/.exec(key);                 // "4 × Dining chair"
    if (n) { const t = known(n[2]); if (t !== undefined) return n[1] + t; }
    // "BILLY bookcase, white · 80 × 28 cm · IKEA": each piece on its own, the bigger pieces first
    for (const sep of [" · ", ", "]) {
      if (!key.includes(sep)) continue;
      let changed = false;
      const parts = key.split(sep).map((p) => {
        const t = sep === " · " ? lookup(p) : known(p);
        if (t === undefined || t === p) return p;
        changed = true; return t;
      });
      if (changed) return parts.join(sep);
    }
    return undefined;
  }
  function known(s) {
    const t = exact.get(s);
    if (t !== undefined) return t;
    for (const p of patterns) {
      if (!s.startsWith(p.head)) continue;
      const m = p.re.exec(s);
      if (m) { let i = 0; const g = m.slice(1); return p.fr.replace(/\{(\d?)\}/g, (_, k) => g[k === "" ? i++ : +k] ?? ""); }
    }
    return undefined;
  }
  // Keeps the spaces around the text as they were
  function translate(raw) {
    if (!raw || !/[A-Za-z0-9]/.test(raw)) return raw;
    const key = raw.replace(/\s+/g, " ").trim();
    let out = cache.get(key);
    if (out === undefined) {
      if (cache.size > 4000) cache.clear();      // dragging makes a new measurement every frame
      out = lookup(key);
      cache.set(key, out);
    }
    if (out === key) return raw;
    const lead = /^\s*/.exec(raw)[0], trail = /\s*$/.exec(raw)[0];
    return lead + out + trail;
  }

  // ---------- Translating the page as it is built and changed ----------
  const ATTRS = ["title", "aria-label", "placeholder", "alt", "aria-valuetext", "data-tip", "label"];
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT", "CODE", "PRE"]);
  const done = new WeakMap();                   // what we wrote, so our own changes aren't translated twice

  function text(n) {
    const el = n.parentElement;
    if (!el || SKIP.has(el.nodeName) || el.closest("[translate=no]")) return;
    const v = n.nodeValue;
    if (done.get(n) === v) return;
    // data-fr="…" on the element: its own French wording, where the usual one is too long for the spot
    const own = el.dataset.fr;
    const t = own !== undefined && /\S/.test(v) ? v.replace(/\S(?:[\s\S]*\S)?/, own) : translate(v);
    done.set(n, t);
    if (t !== v) n.nodeValue = t;
  }
  function attrs(el, only) {
    for (const a of only ? [only] : ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const mine = done.get(el);
      if (mine && mine[a] === v) continue;
      const t = translate(v);
      (mine || done.set(el, {}).get(el))[a] = t;
      if (t !== v) el.setAttribute(a, t);
    }
    if (el.nodeName === "META" && /^(description|og:title|og:description|twitter:title|twitter:description)$/.test(el.getAttribute("name") || el.getAttribute("property") || "")) {
      const v = el.getAttribute("content"), t = translate(v);
      if (t !== v) el.setAttribute("content", t);
    }
  }
  const filter = {
    acceptNode: (n) => n.nodeType === 1
      ? (SKIP.has(n.nodeName) || n.getAttribute("translate") === "no" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
      : NodeFilter.FILTER_ACCEPT,
  };
  function walk(node) {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1) return;
    if (node.closest("[translate=no]")) return;
    attrs(node);
    if (SKIP.has(node.nodeName)) return;
    const w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? text(n) : attrs(n);
  }

  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") text(m.target);
      else if (m.type === "attributes" && !m.target.closest("[translate=no]")) attrs(m.target, m.attributeName);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  walk(root);
  // Headings built word by word for their entrance (the home page title): the French words, in the same spans
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-fr-words]").forEach((el) => {
      const words = el.dataset.frWords.split(" "), spans = el.querySelectorAll(".word");
      if (words.length === spans.length) spans.forEach((sp, i) => { sp.textContent = words[i]; });
      el.setAttribute("translate", "no");
    });
  });

  return { lang, locale, set, t: translate };
})();
