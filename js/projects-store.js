/* =========================================================
   Atelier — projects of the person logged in
   ---------------------------------------------------------
   Saved in this browser under "atelier.projects.<email>", so each
   account only ever sees its own projects. Rooms are in metres
   (x, y = top-left corner); furniture x, y = its centre, rot in degrees.
   Needs js/account.js and js/catalog.js.
   ========================================================= */

const Projects = (() => {
  const keyFor = () => {
    const session = Account.current();
    return session ? `atelier.projects.${session.email.trim().toLowerCase()}` : null;
  };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function readAll() {
    const key = keyFor();
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  }
  function writeAll(list) {
    const key = keyFor();
    if (key) localStorage.setItem(key, JSON.stringify(list));
  }

  const now = () => new Date().toISOString();

  // ---- Numbers shown on cards and in the editor ----
  const area = (p) => p.rooms.reduce((sum, r) => sum + r.w * r.h, 0);
  const budget = (p) => p.items.reduce((sum, it) => sum + (CATALOG.byId[it.catalogId]?.price || 0) * CATALOG.packs(it), 0);

  // Group identical products: [{ product, qty, total }]
  function shoppingList(p) {
    const groups = new Map();
    p.items.forEach((it) => {
      const product = CATALOG.byId[it.catalogId];
      if (!product || product.structure || product.own) return;   // doors and windows are part of the room; your own decor isn't bought
      const g = groups.get(product.id) || { product, qty: 0, total: 0, ids: [] };
      const n = CATALOG.packs(it);                  // wide curtains: two pairs or more
      g.qty += n; g.total += product.price * n; g.ids.push(it.id);
      groups.set(product.id, g);
    });
    return [...groups.values()];
  }

  // ---- Download: the whole project for the Python tools (the shopping list PDF is in shopping-pdf.js) ----
  const roomOf = (p, x, y) => p.rooms.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null;

  // "Linen" instead of #f5f1ea, when the colour comes from the paint palettes
  const colourName = (hex) => {
    for (const pal of CATALOG.WALL_PALETTES) {
      const c = pal.colors.find((x) => x.hex.toLowerCase() === String(hex).toLowerCase());
      if (c) return c.name;
    }
    return String(hex).toUpperCase();
  };

  // Everything the tools in tools/ need: the shopping list ("items", same as before),
  // the rooms, and every piece with where it stands
  function exportData(p) {
    return {
      format: "atelier-project", version: 3,
      project: p.name,
      exported: new Date().toISOString().slice(0, 10),
      currency: "EUR",
      items: shoppingList(p).map((g) => ({
        name: g.product.name, product: g.product.product, category: g.product.cat, store: g.product.store,
        qty: g.qty, unit_price: g.product.price, url: g.product.url,
      })),
      rooms: p.rooms.map((r) => ({
        name: r.name, type: r.type || "", x: r.x, y: r.y, w: r.w, h: r.h,
        height: r.height || 2.6,
        floor: r.floor || "oak", floor_name: CATALOG.FLOORS[r.floor || "oak"]?.label || r.floor || "",
        wall: r.wall || "#f5f1ea", wall_name: colourName(r.wall || "#f5f1ea"),
      })),
      placed: p.items.map((it) => {
        const q = CATALOG.piece(it);
        if (!q) return null;
        return {
          id: it.catalogId, name: q.name, category: q.cat, kind: q.kind || "",
          room: roomOf(p, it.x, it.y)?.name || "",
          x: it.x, y: it.y, rot: it.rot || 0, w: q.w, d: q.d, h: q.h || 0,
          price: q.own ? 0 : q.price,
          small: !!(q.small || q.kind === "table-lamp"), wall: !!q.wall, rug: q.kind === "rug",
        };
      }).filter(Boolean),
    };
  }

  // Save text as a file in the browser's downloads
  function download(filename, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fileName = (p, rest) => `${(p.name || "").replace(/[^\w\- ]+/g, "").trim() || "atelier"} ${rest}`;
  const downloadProject = (p) => download(fileName(p, "project.json"), JSON.stringify(exportData(p), null, 2), "application/json");

  return {
    uid, area, budget, shoppingList, exportData, downloadProject,

    list() { return readAll(); },
    get(id) { return readAll().find((p) => p.id === id) || null; },

    create({ name, template = "blank" }) {
      const t = CATALOG.templates[template] || { rooms: [], items: [] };   // an unknown starter: an empty home
      const project = {
        id: uid(),
        name: String(name).trim() || "Untitled home",
        template,
        favorite: false,
        createdAt: now(),
        updatedAt: now(),
        rooms: t.rooms.map((r) => ({ ...r, id: uid() })),
        items: t.items.map((it) => ({ ...it, id: uid(), ...(it.size ? { size: { ...it.size } } : {}) })),
      };
      if (t.light) project.light = { ...t.light };
      // Rooms with no wall between them, named in the template: the key is the two room ids and
      // the wall's direction ("z" for side by side, "x" for one above the other), as the planner uses
      if (t.open) project.openWalls = t.open.map(([na, nb]) => {
        const a = project.rooms.find((r) => r.name === na), b = project.rooms.find((r) => r.name === nb);
        if (!a || !b) return null;
        const side = Math.abs(a.x + a.w - b.x) < 0.2 || Math.abs(b.x + b.w - a.x) < 0.2;
        return [a.id, b.id].sort().join("|") + (side ? "z" : "x");
      }).filter(Boolean);
      // In French, the starter's rooms and home get French names (the planner shows them as they are stored)
      if (typeof I18N !== "undefined") { project.name = I18N.t(project.name); project.rooms.forEach((r) => { r.name = I18N.t(r.name); }); }
      writeAll([project, ...readAll()]);
      return project;
    },

    // A plan someone shared (js/share.js): a new project of yours, fresh ids already given
    importShared(data) {
      const project = {
        id: uid(),
        name: String(data.name || "Shared home").trim().slice(0, 60),
        template: "shared",
        favorite: false,
        createdAt: now(),
        updatedAt: now(),
        rooms: data.rooms,
        items: data.items,
        openWalls: data.openWalls || [],
      };
      if (data.light) project.light = { ...data.light };
      // In French, the starter's rooms and home get French names (the planner shows them as they are stored)
      if (typeof I18N !== "undefined") { project.name = I18N.t(project.name); project.rooms.forEach((r) => { r.name = I18N.t(r.name); }); }
      writeAll([project, ...readAll()]);
      return project;
    },

    save(project, { touch = true } = {}) {
      const list = readAll();
      const i = list.findIndex((p) => p.id === project.id);
      if (touch) project.updatedAt = now();
      if (i === -1) list.unshift(project); else list[i] = project;
      writeAll(list);
      return project;
    },

    rename(id, name) {
      const p = this.get(id);
      if (!p) return null;
      p.name = String(name).trim() || p.name;
      return this.save(p);
    },

    toggleFavorite(id) {
      const p = this.get(id);
      if (!p) return null;
      p.favorite = !p.favorite;
      return this.save(p, { touch: false });
    },

    duplicate(id) {
      const p = this.get(id);
      if (!p) return null;
      const copy = {
        ...structuredClone(p),
        id: uid(),
        name: typeof I18N !== "undefined" ? I18N.t(`${p.name} (copy)`) : `${p.name} (copy)`,
        favorite: false,
        createdAt: now(),
        updatedAt: now(),
      };
      copy.rooms.forEach((r) => { r.id = uid(); });
      copy.items.forEach((it) => { it.id = uid(); });
      const list = readAll();
      list.splice(list.findIndex((x) => x.id === id) + 1, 0, copy);
      writeAll(list);
      return copy;
    },

    remove(id) {
      const list = readAll();
      const i = list.findIndex((p) => p.id === id);
      if (i === -1) return null;
      const [gone] = list.splice(i, 1);
      writeAll(list);
      return { project: gone, index: i };
    },

    // Put a deleted project back where it was (for "Undo")
    restore({ project, index }) {
      const list = readAll();
      list.splice(Math.min(index, list.length), 0, project);
      writeAll(list);
    },
  };
})();

/* ---------- A small drawing of a plan, used for the project cards ---------- */
function planThumbnail(project) {
  const rooms = project.rooms;
  if (!rooms.length) {
    return `<svg class="thumb-svg" viewBox="0 0 160 100" aria-hidden="true">
      <rect x="48" y="26" width="64" height="48" rx="3" class="thumb-empty"/>
      <path d="M80 42v16 M72 50h16" class="thumb-plus"/>
    </svg>`;
  }
  const minX = Math.min(...rooms.map((r) => r.x)), minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.w)), maxY = Math.max(...rooms.map((r) => r.y + r.h));
  const pad = Math.max(maxX - minX, maxY - minY) * 0.08;
  const vb = [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2].map((n) => n.toFixed(2)).join(" ");
  const stroke = Math.max(maxX - minX, maxY - minY) / 110;
  const roomsSvg = rooms.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" stroke-width="${stroke * 2}"/>`).join("");
  const itemsSvg = project.items.map((it) => {
    const c = CATALOG.piece(it);
    if (!c) return "";
    const w = c.w / 100, d = c.d / 100;
    const shape = c.round
      ? `<ellipse cx="0" cy="0" rx="${w / 2}" ry="${d / 2}"/>`
      : `<rect x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="${Math.min(w, d) * 0.08}"/>`;
    return `<g transform="translate(${it.x} ${it.y}) rotate(${it.rot || 0})" stroke-width="${stroke * 0.8}">${shape}</g>`;
  }).join("");
  return `<svg class="thumb-svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g class="thumb-rooms">${roomsSvg}</g><g class="thumb-items">${itemsSvg}</g>
  </svg>`;
}
