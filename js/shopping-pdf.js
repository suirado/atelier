/* =========================================================
   Atelier — the shopping list as a PDF
   ---------------------------------------------------------
   A4, made in the browser with jsPDF (loaded only when someone
   clicks Download). One section per store, so it works as a
   checklist in the shop: a box to tick, a picture of the piece,
   what it is, how many, and the price. Uses the site's typeface
   (Plus Jakarta Sans) and falls back to Helvetica offline.
   Needs js/projects-store.js and js/catalog.js.
   ========================================================= */

const ShoppingPDF = (() => {
  const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
  const FONT_URL = (w) => `https://cdn.jsdelivr.net/fontsource/fonts/plus-jakarta-sans@latest/latin-${w}-normal.ttf`;

  // Colours from the site
  const C = {
    brand: "#1f4d43", brandSoft: "#eef4f1", brandDeep: "#143630",
    ink: "#1c1917", text: "#44403c", muted: "#78716c", faint: "#a8a29e",
    line: "#e7e0d6", tint: "#faf6f1", thumb: "#e4dbcf", white: "#ffffff",
  };
  // A4 in millimetres
  const PAGE_W = 210, PAGE_H = 297, M = 16, RIGHT = PAGE_W - M, BOTTOM = PAGE_H - 22;
  // Table columns
  const COL = { box: M, thumb: M + 8, text: M + 27, cat: 121, qty: 149, unit: 172, total: RIGHT };
  const TEXT_W = COL.cat - COL.text - 4;
  const PICTURE_WAIT = 12000;

  const euro = (n, est = false) => typeof Region !== "undefined" ? Region.money(Math.round(n * 100) / 100).replace(/^/, est ? "~ " : "") : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Math.round(n * 100) / 100);

  // ---- Loading (once per visit) ----
  let libJob = null, fontJob = null;
  function loadLib() {
    if (window.jspdf) return Promise.resolve(window.jspdf);
    return (libJob ||= new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = JSPDF_URL;
      s.onload = () => resolve(window.jspdf);
      s.onerror = () => { libJob = null; reject(new Error("Couldn't load the PDF maker. Are you online?")); };
      document.head.append(s);
    }));
  }
  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function loadFonts() {
    return (fontJob ||= Promise.all([400, 600, 800].map((w) =>
      fetch(FONT_URL(w)).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => [w, toBase64(b)])
    )).catch(() => { fontJob = null; return null; }));
  }

  // Product pictures: the same 3D renders as in the planner, as small JPEGs on the card colour
  const pictureCache = new Map();
  function pictureOf(product) {
    if (!pictureCache.has(product.id)) {
      const job = makePicture(product).then((url) => { if (!url) pictureCache.delete(product.id); return url; });
      pictureCache.set(product.id, job);                // a failed picture is tried again next time
    }
    return pictureCache.get(product.id);
  }
  async function makePicture(product) {
    try {
      const { productThumbnail } = await import("./planner3d.js?v=83");
      const url = await productThumbnail(product);
      if (!url) return null;
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 200; canvas.height = 150;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = C.thumb;
      ctx.fillRect(0, 0, 200, 150);
      ctx.drawImage(img, 0, 0, 200, 150);
      return canvas.toDataURL("image/jpeg", 0.88);
    } catch { return null; }
  }

  // ---- The document ----
  async function build(project) {
    const [{ jsPDF }, fonts] = await Promise.all([loadLib(), loadFonts()]);
    const list = Projects.shoppingList(project);
    // Pictures render in the background; the PDF waits for them at most PICTURE_WAIT ms,
    // then uses a letter for any that aren't ready (first visit on a slow computer)
    const pictures = new Map();
    const jobs = list.map((g) => pictureOf(g.product).then((url) => { if (url) pictures.set(g.product.id, url); }));
    await Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, PICTURE_WAIT))]);

    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    if (typeof I18N !== "undefined" && I18N.lang === "fr") {   // the list in French, like the page
      const text = doc.text.bind(doc), split = doc.splitTextToSize.bind(doc);
      const fr = (s) => Array.isArray(s) ? s.map((x) => I18N.t(x)) : typeof s === "string" ? I18N.t(s) : s;
      doc.text = (s, ...rest) => text(fr(s), ...rest);
      doc.splitTextToSize = (s, ...rest) => split(fr(s), ...rest);
    }
    let family = "helvetica";
    if (fonts) {
      fonts.forEach(([w, data]) => {
        doc.addFileToVFS(`PlusJakartaSans-${w}.ttf`, data);
        doc.addFont(`PlusJakartaSans-${w}.ttf`, "Jakarta", String(w));
      });
      family = "Jakarta";
    }
    const font = (weight, size, color = C.ink) => {
      const style = family === "Jakarta" ? String(weight) : (weight >= 600 ? "bold" : "normal");
      doc.setFont(family, style);
      doc.setFontSize(size);
      doc.setTextColor(color);
    };
    // Letter-spaced labels: jsPDF leaves the spacing out when it aligns right or centre, so measure it here
    const spaced = (s, x, y, align = "left", cs = 0.5) => {
      if (typeof I18N !== "undefined") s = I18N.t(s);
      const w = doc.getTextWidth(s) + cs * (s.length - 1);
      doc.text(s, align === "right" ? x - w : align === "center" ? x - w / 2 : x, y, { charSpace: cs });
    };
    const hline = (y, color = C.line, x1 = M, x2 = RIGHT, width = 0.25) => {
      doc.setDrawColor(color); doc.setLineWidth(width); doc.line(x1, y, x2, y);
    };

    // Group by store, the biggest spend first
    const stores = new Map();
    list.forEach((g) => {
      const s = stores.get(g.product.store) || { name: g.product.store, rows: [], total: 0, pieces: 0 };
      s.rows.push(g); s.total += g.total; s.pieces += g.qty;
      stores.set(g.product.store, s);
    });
    const storeList = [...stores.values()].sort((a, b) => b.total - a.total);
    storeList.forEach((s) => s.rows.sort((a, b) => b.total - a.total));
    const total = list.reduce((s, g) => s + g.total, 0);
    const pieces = list.reduce((s, g) => s + g.qty, 0);
    const date = new Date().toLocaleDateString((typeof I18N !== "undefined" ? I18N.locale : "en-GB"), { day: "numeric", month: "long", year: "numeric" });

    // ---- Page 1 header ----
    function logo(x, y, size) {
      const k = size / 32;
      doc.setFillColor(C.brand);
      doc.roundedRect(x, y, size, size, 9 * k, 9 * k, "F");
      doc.setFillColor(C.white);
      doc.lines([[8 * k, -6.5 * k], [8 * k, 6.5 * k], [0, 9.5 * k], [-16 * k, 0]], x + 8 * k, y + 15.5 * k, [1, 1], "F", true);
      doc.setDrawColor(C.brand); doc.setLineWidth(1.6 * k);
      doc.line(x + 16 * k, y + 25 * k, x + 16 * k, y + 19 * k);
      doc.line(x + 16 * k, y + 19 * k, x + 24 * k, y + 19 * k);
    }
    logo(M, 14, 9);
    font(800, 13); doc.text("Atelier", M + 12, 20.3);
    font(600, 7.5, C.brand); spaced("SHOPPING LIST", RIGHT, 17.6, "right", 0.6);
    font(400, 8.5, C.muted); doc.text(date, RIGHT, 22, { align: "right" });
    hline(29);

    font(800, 24);
    const title = doc.splitTextToSize(project.name || "My home", PAGE_W - 2 * M);
    doc.text(title[0], M, 43);
    font(400, 9.5, C.muted);
    const roomsCount = project.rooms.length;
    const storeNames = storeList.map((s) => s.name);
    const storeText = new Intl.ListFormat(typeof I18N !== "undefined" && I18N.lang === "fr" ? "fr" : "en-GB", { type: "conjunction" }).format(storeNames);
    doc.text(`${list.length} products · ${pieces} pieces · ${roomsCount} room${roomsCount === 1 ? "" : "s"} · from ${storeText}`, M, 50);

    // Summary cards: the total, then each store
    const cards = [{ label: "TOTAL", value: euro(total), note: `${pieces} pieces`, main: true },
      ...storeList.slice(0, 3).map((s) => ({ label: s.name.toUpperCase(), value: euro(s.total), note: `${s.pieces} piece${s.pieces === 1 ? "" : "s"}` }))];
    const gap = 4, cardW = (PAGE_W - 2 * M - gap * (cards.length - 1)) / cards.length, cardY = 57, cardH = 23;
    cards.forEach((c, i) => {
      const x = M + i * (cardW + gap);
      if (c.main) { doc.setFillColor(C.brand); doc.roundedRect(x, cardY, cardW, cardH, 3, 3, "F"); }
      else { doc.setFillColor(C.tint); doc.setDrawColor(C.line); doc.setLineWidth(0.25); doc.roundedRect(x, cardY, cardW, cardH, 3, 3, "FD"); }
      font(600, 6.8, c.main ? "#fde3d3" : C.muted); spaced(c.label, x + 5, cardY + 7);
      font(800, c.main ? 15 : 13, c.main ? C.white : C.ink); doc.text(c.value, x + 5, cardY + 15);
      font(400, 7.5, c.main ? "#fde3d3" : C.muted); doc.text(c.note, x + 5, cardY + 19.6);
    });

    let y = cardY + cardH + 11;

    // ---- Table ----
    function columnHeads() {
      font(600, 6.8, C.muted);
      spaced("PRODUCT", COL.text, y);
      spaced("CATEGORY", COL.cat, y);
      spaced("QTY", COL.qty, y, "center");
      spaced("EACH", COL.unit, y, "right");
      spaced("TOTAL", COL.total, y, "right");
      y += 2.6;
      hline(y, C.ink, M, RIGHT, 0.35);
      y += 1.5;
    }
    function newPage() {
      doc.addPage();
      y = 16;
      logo(M, y - 4.5, 6);
      font(600, 8.5, C.muted); doc.text(`${project.name} · shopping list (continued)`, M + 8.5, y);
      y += 9;
      columnHeads();
    }
    const room = (h) => { if (y + h > BOTTOM) { newPage(); return true; } return false; };

    columnHeads();
    storeList.forEach((store) => {
      room(10 + 17);                                   // keep a store's name with its first row
      y += 2.5;
      doc.setFillColor(C.brandSoft);
      doc.roundedRect(M, y, PAGE_W - 2 * M, 8.5, 2, 2, "F");
      font(800, 10, C.brandDeep); doc.text(store.name, M + 4, y + 5.7);
      font(600, 8.5, C.brandDeep);
      doc.text(`${store.rows.length} product${store.rows.length === 1 ? "" : "s"}  ·  ${euro(store.total)}`, RIGHT - 4, y + 5.7, { align: "right" });
      y += 10.5;

      store.rows.forEach((g, i) => {
        const p = g.product;
        font(400, 7.8, C.muted);
        const detail = doc.splitTextToSize(p.product || "", TEXT_W).slice(0, 2);
        const textH = 4.6 + detail.length * 3.5 + 4.2;
        const h = Math.max(17, textH + 3);
        if (room(h)) { y += 1; }
        if (i % 2 === 1) { doc.setFillColor(C.tint); doc.rect(M, y, PAGE_W - 2 * M, h, "F"); }

        // A box to tick in the shop
        doc.setDrawColor(C.faint); doc.setLineWidth(0.3);
        doc.roundedRect(COL.box + 0.8, y + h / 2 - 2.2, 4.4, 4.4, 0.9, 0.9, "S");

        // Picture
        const pic = pictures.get(p.id);
        doc.setFillColor(C.thumb);
        doc.roundedRect(COL.thumb, y + (h - 13.5) / 2, 18, 13.5, 1.6, 1.6, "F");
        if (pic) doc.addImage(pic, "JPEG", COL.thumb, y + (h - 13.5) / 2, 18, 13.5, undefined, "FAST");
        else { font(800, 11, C.faint); doc.text((p.name || "?")[0], COL.thumb + 9, y + h / 2 + 1.5, { align: "center" }); }

        // Name, product, link
        let ty = y + (h - textH) / 2 + 4.4;
        font(600, 9.6, C.ink); doc.text(p.name, COL.text, ty);
        ty += 4.1;
        font(400, 7.8, C.muted); doc.text(detail, COL.text, ty, { lineHeightFactor: 1.3 });
        ty += detail.length * 3.5 + 0.6;
        if (p.url) {
          font(600, 7.3, C.brand);
          const label = p.notHere ? `Search at ${p.store}` : `View at ${p.store}`;
          doc.textWithLink(label, COL.text, ty, { url: p.url });
        }

        // Category, quantity, prices
        const mid = y + h / 2 + 1.2;
        font(400, 8.2, C.text); doc.text(doc.splitTextToSize(p.cat || "", COL.qty - COL.cat - 8)[0] || "", COL.cat, mid);
        font(600, 9, C.ink); doc.text(String(g.qty), COL.qty, mid, { align: "center" });
        font(400, 8.6, C.text); doc.text(euro(p.price, p.estimate), COL.unit, mid, { align: "right" });
        font(800, 9.4, C.ink); doc.text(euro(g.total, p.estimate), COL.total, mid, { align: "right" });

        y += h;
        hline(y);
      });
      y += 3;
    });

    // ---- Total ----
    room(34);
    y += 4;
    const boxW = 84, boxX = RIGHT - boxW;
    storeList.forEach((s) => {
      font(400, 8.8, C.text); doc.text(s.name, boxX, y);
      doc.text(euro(s.total), RIGHT, y, { align: "right" });
      y += 5.5;
    });
    hline(y - 2, C.ink, boxX, RIGHT, 0.35);
    y += 4.5;
    font(800, 11, C.ink); doc.text("Total", boxX, y);
    font(800, 16, C.brand); doc.text(euro(total), RIGHT, y + 0.6, { align: "right" });
    font(400, 7.2, C.muted);
    doc.text(doc.splitTextToSize("Prices include VAT, as shown on ikea.com/fr and leroymerlin.fr in November 2026. Delivery and assembly are not included. Check the store before you buy.", boxX - M - 10), M, y - 9.5, { lineHeightFactor: 1.45 });

    // ---- Footer on every page ----
    const pages = doc.getNumberOfPages();
    for (let n = 1; n <= pages; n++) {
      doc.setPage(n);
      hline(PAGE_H - 14);
      font(400, 7.2, C.faint);
      doc.text(`Atelier · ${project.name} · ${date}`, M, PAGE_H - 9.5);
      doc.text(`Page ${n} of ${pages}`, RIGHT, PAGE_H - 9.5, { align: "right" });
    }
    doc.setProperties({ title: `${project.name} — shopping list`, subject: "Shopping list", creator: "Atelier" });
    return doc;
  }

  const fileName = (p) => `${(p.name || "").replace(/[^\w\- ]+/g, "").trim() || "atelier"} ${typeof I18N !== "undefined" && I18N.lang === "fr" ? "liste de courses" : "shopping list"}.pdf`;

  // Builds the PDF and saves it to the downloads, with a message while it works.
  // `button` (optional) is disabled meanwhile, so a double click makes one file.
  let busy = false;
  async function download(project, button) {
    if (busy || !project) return;
    busy = true;
    if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); }
    const say = (msg, opts) => (typeof App !== "undefined" && App.toast ? App.toast(msg, opts) : null);
    say("Making your PDF…", { duration: 15000 });
    try {
      const doc = await build(project);
      doc.save(fileName(project));
      say("Shopping list saved to your downloads as a PDF", { duration: 3000 });
    } catch (err) {
      say(err?.message?.includes("online") ? err.message : "Couldn't make the PDF. Please try again.", { duration: 4000 });
    } finally {
      busy = false;
      if (button) { button.disabled = false; button.removeAttribute("aria-busy"); }
    }
  }

  // Start drawing the pictures early (when the pointer reaches a download button), so they are ready in time
  function warm(project) {
    if (!project) return;
    loadLib().catch(() => {});
    loadFonts();
    Projects.shoppingList(project).forEach((g) => pictureOf(g.product));
  }

  return { build, download, warm, fileName };
})();
