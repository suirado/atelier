/* =========================================================
   Atelier — the room planner
   ---------------------------------------------------------
   World units are metres. Rooms: x, y = top-left corner, w × h.
   Furniture: x, y = centre, rot in degrees (any angle), size from the catalogue (cm).
   Every change is saved automatically and can be undone.
   Two views of the same data: 3D (js/planner3d.js) and the 2D plan.
   ========================================================= */

import { createPlanner3D, keepInside, itemHalf, roomAt, nearestRoom, productThumbnail, LIGHT_PRESETS, DEFAULT_LIGHT, WALL_T, openingClash, fitOpening, freeOpeningSpot, isSmall, SURFACES, TV_KINDS, hasShelfContents, hasBookCovers, openingOf, CEILING_LIGHTS, ceilingLight, lampLumens, sharedWalls, onOpenWall } from "./planner3d.js?v=83";
import { checkSpace } from "./space-check.js?v=5";

(() => {
  if (!Account.current()) return;
  const { esc, euro, m2, metres, toast } = App;

  const svg = document.getElementById("canvas");
  const world = document.getElementById("world");
  const gridLayer = document.getElementById("grid");
  const wrap = document.getElementById("canvas-wrap");
  const nameInput = document.getElementById("project-name");
  const saveState = document.getElementById("save-state");
  const inspector = document.getElementById("inspector");
  const tabContent = document.getElementById("tab-content");
  const selBar = document.getElementById("sel-bar");

  // ---------- Load ----------
  const id = new URLSearchParams(location.search).get("id");
  let project = id && Projects.get(id);
  if (!project) {
    document.querySelector(".editor").innerHTML = `
      <div class="canvas-empty" style="position:static"><div>
        <h2>We couldn't find this project</h2>
        <p>It may have been deleted, or it belongs to another account.</p>
        <a class="mini-btn primary" href="projects.html">Back to my projects</a>
      </div></div>`;
    return;
  }
  nameInput.value = project.name;
  document.title = `${project.name} — Atelier`;

  const MIN_ROOM = 0.5;
  const snap = (v, step) => Math.round(v / step) * step;
  const round2 = (v) => Math.round(v * 100) / 100;
  const norm = (deg) => ((Math.round(deg) % 360) + 360) % 360;
  const product = (it) => CATALOG.piece(it);   // with its own size, for rugs and curtains
  const isRug = (it) => CATALOG.byId[it.catalogId]?.kind === "rug";
  const isPlant = (it) => ["plant", "planter"].includes(CATALOG.byId[it.catalogId]?.kind);

  // Older projects: give rooms their 3D finishes and lights
  project.rooms.forEach((r) => {
    r.floor ??= "oak"; r.wall ??= "#f5f1ea"; r.height ??= 2.6; r.lamp ??= true;
  });
  project.light = { ...DEFAULT_LIGHT, ...(project.light || {}) };

  let sel = null;                 // { type: "room" | "item", id }
  let tool = "select";
  let tab = "rooms";
  let mode = localStorage.getItem("atelier.view") === "2d" ? "2d" : "3d";
  let snapOn = localStorage.getItem("atelier.snap") === "on";
  // Measure: room sizes and materials, worked out in Python (see "Measure" below)
  let measureOn = localStorage.getItem("atelier.measure") === "on";
  let materials = null, materialsState = "off";      // off | loading | ready | error
  let measureTimer = 0, measureRun = 0;
  const view = { x: 0, y: 0, s: 50 };   // s = pixels per metre; x, y = world point at the top-left corner
  const itemStep = () => (snapOn ? 0.05 : 0.01);
  const roomStep = () => (snapOn ? 0.1 : 0.01);

  // ---------- Saving + undo ----------
  let undoStack = [], redoStack = [];
  // Everything that can be undone: rooms, furniture and the light
  const stateNow = () => JSON.stringify({ rooms: project.rooms, items: project.items, light: project.light, openWalls: project.openWalls || [] });
  let snapshot = null;      // taken once the curtains are on their windows (see Start)
  let saveTimer;

  function setSaving(saving) {
    saveState.classList.toggle("is-saving", saving);
    saveState.querySelector(".label").textContent = saving ? "Saving…" : "Saved";
  }
  function scheduleSave() {
    setSaving(true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { Projects.save(project); setSaving(false); }, 450);
    scheduleMaterials();
  }
  // Call after a change is finished (end of a drag, a typed value…)
  function commit() {
    if (hangCurtains()) render();
    const now = stateNow();
    if (now === snapshot) return;
    undoStack.push(snapshot);
    if (undoStack.length > 150) undoStack.shift();
    redoStack = [];
    snapshot = now;
    scheduleSave();
    updateUndo();
    announceSpace();
  }
  function restore(state) {
    // A half-typed value in the side panel would otherwise be written back over the undone state
    if (document.activeElement?.closest("#inspector, #light-pop")) document.activeElement.blur();
    const data = JSON.parse(state);
    project.rooms = data.rooms; project.items = data.items; project.openWalls = data.openWalls || [];
    const lightChanged = data.light && JSON.stringify(data.light) !== JSON.stringify(project.light);
    if (data.light) project.light = { ...DEFAULT_LIGHT, ...data.light };
    snapshot = state;
    hangCurtains();
    if (sel && !find(sel)) sel = null;
    drag = null; draft = null; fieldStart = null;
    if (lightChanged) { three?.setLight(project.light, 600); syncLightUI(); }
    delete inspector.dataset.for;
    scheduleSave(); updateUndo(); render(); renderPanel(); announceSpace(true);
    if (mode === "3d") three?.select(sel);
    placeSelBar();
  }
  function undo() {
    if (!undoStack.length) { toast("Nothing to undo yet", { duration: 1400 }); return; }
    redoStack.push(snapshot); restore(undoStack.pop());
    toast(`Undone · ${undoStack.length} more step${undoStack.length === 1 ? "" : "s"} back`, { duration: 1400 });
  }
  function redo() {
    if (!redoStack.length) { toast("Nothing to redo", { duration: 1400 }); return; }
    undoStack.push(snapshot); restore(redoStack.pop());
    toast("Redone", { duration: 1400 });
  }
  function updateUndo() {
    document.getElementById("undo").disabled = !undoStack.length;
    document.getElementById("redo").disabled = !redoStack.length;
  }
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);
  addEventListener("beforeunload", () => { clearTimeout(saveTimer); Projects.save(project); });

  nameInput.addEventListener("change", () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.value = project.name; return; }
    project.name = name;
    document.title = `${name} — Atelier`;
    scheduleSave();
    toast("Name saved", { duration: 1800 });
  });
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") nameInput.blur(); });

  // ---------- Helpers ----------
  const find = (s) => s && (s.type === "room" ? project.rooms : project.items).find((x) => x.id === s.id);
  const footprint = (it) => { const h = itemHalf(product(it), it.rot || 0); return { w: h.hw * 2, h: h.hd * 2 }; };
  const toWorld = (e) => {
    const r = svg.getBoundingClientRect();
    return { x: view.x + (e.clientX - r.left) / view.s, y: view.y + (e.clientY - r.top) / view.s };
  };
  const settle = (it, prefer) => keepInside(project, CATALOG, it, prefer);
  const itemsIn = (room) => project.items.filter((it) => it.x >= room.x && it.x <= room.x + room.w && it.y >= room.y && it.y <= room.y + room.h);

  // ---------- Resizing a room: doors and windows ride along with their wall ----------
  // Remembers, before a resize, which wall each opening sits in and how far along it.
  function openingsOf(room) {
    const near = WALL_T / 2 + 0.12;
    const out = [];
    project.items.forEach((it) => {
      if (!product(it)?.wall) return;
      const alongX = it.x > room.x - 0.05 && it.x < room.x + room.w + 0.05;
      const alongY = it.y > room.y - 0.05 && it.y < room.y + room.h + 0.05;
      let side = null;
      if (alongX && Math.abs(it.y - room.y - WALL_T / 2) < near) side = "top";
      else if (alongX && Math.abs(it.y - (room.y + room.h - WALL_T / 2)) < near) side = "bottom";
      else if (alongY && Math.abs(it.x - room.x - WALL_T / 2) < near) side = "left";
      else if (alongY && Math.abs(it.x - (room.x + room.w - WALL_T / 2)) < near) side = "right";
      if (side) out.push({ it, side, along: side === "top" || side === "bottom" ? it.x - room.x : it.y - room.y });
    });
    return out;
  }
  // Puts each remembered opening back in its wall, after the wall has moved
  function followWalls(room, openings) {
    openings.forEach(({ it, side, along }) => {
      const half = product(it).w / 200, len = side === "top" || side === "bottom" ? room.w : room.h;
      const a = Math.max(Math.min(along, len - half - 0.05), Math.min(half + 0.05, len / 2));
      if (side === "top" || side === "bottom") {
        it.x = round2(room.x + a);
        it.y = round2(side === "top" ? room.y + WALL_T / 2 : room.y + room.h - WALL_T / 2);
        it.rot = side === "top" ? 0 : 180;
      } else {
        it.y = round2(room.y + a);
        it.x = round2(side === "left" ? room.x + WALL_T / 2 : room.x + room.w - WALL_T / 2);
        it.rot = side === "left" ? 270 : 90;
      }
    });
  }
  // Furniture positions when a resize started, so shrinking then growing the room puts things back
  const remember = (room) => itemsIn(room).filter((it) => !product(it)?.wall).map((it) => ({ it, x: it.x, y: it.y }));
  function reflow(room, start) {
    start.furniture.forEach((o) => { o.it.x = o.x; o.it.y = o.y; settle(o.it, room.id); });
    followWalls(room, start.openings);
  }
  let fieldStart = null;   // the room as it was when someone started typing a new size

  // A room that grows stops at the next room's wall instead of running through it.
  // Rooms that already overlapped when the resize started are left alone (so nothing gets stuck).
  const cross = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01;
  let stoppedAt = 0;
  function roomFits(r, w, h, start) {
    const others = project.rooms.filter((q) => q !== r && !cross({ x: r.x, y: r.y, w: start.w, h: start.h }, q));
    let W = w, H = h, stopped = false;
    others.forEach((q) => { if (q.x > r.x && cross({ x: r.x, y: r.y, w: W, h: Math.min(h, start.h) }, q)) { W = Math.max(MIN_ROOM, round2(q.x - r.x)); stopped = true; } });
    others.forEach((q) => { if (q.y > r.y && cross({ x: r.x, y: r.y, w: W, h: H }, q)) { H = Math.max(MIN_ROOM, round2(q.y - r.y)); stopped = true; } });
    if (stopped && performance.now() - stoppedAt > 4000) {
      stoppedAt = performance.now();
      toast("The room stops at the next room's wall. To join them, select the room and switch on “Open to …”.", { duration: 3200 });
    }
    return { w: W, h: H };
  }

  // Chairs and stools slide under tables, desks and counters: that isn't a clash
  const TUCK_SEATS = new Set(["chair", "stool"]), TUCK_UNDER = new Set(["table", "desk", "island", "bistro", "kitchen-base"]);
  const tucks = (seat, table) => TUCK_SEATS.has(product(seat)?.kind) && TUCK_UNDER.has(product(table)?.kind);
  function overlapping() {
    // lamps, vases and other decor stand on tables and shelves
    const solid = project.items.filter((it) => product(it) && !isRug(it) && !product(it).wall && !isSmall(product(it)) && !["decor", "candles"].includes(product(it).kind));
    const hits = new Set();
    for (let i = 0; i < solid.length; i++) {
      const a = solid[i], fa = footprint(a);
      for (let j = i + 1; j < solid.length; j++) {
        const b = solid[j], fb = footprint(b);
        const gap = 0.02;
        if (tucks(a, b) || tucks(b, a)) continue;
        if (Math.abs(a.x - b.x) < (fa.w + fb.w) / 2 - gap && Math.abs(a.y - b.y) < (fa.h + fb.h) / 2 - gap) { hits.add(a.id); hits.add(b.id); }
      }
    }
    project.items.forEach((it) => { if (product(it)?.wall && openingClash(project, CATALOG, it)) hits.add(it.id); });
    return hits;
  }

  // Room edges pull other rooms into line (a few pixels), so walls meet without a grid
  function magnet(v, lines) {
    const reach = 10 / view.s;
    let best = v, bd = reach;
    lines.forEach((l) => { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } });
    return best;
  }
  const edgesX = (except) => project.rooms.filter((r) => r !== except).flatMap((r) => [r.x, r.x + r.w]);
  const edgesY = (except) => project.rooms.filter((r) => r !== except).flatMap((r) => [r.y, r.y + r.h]);

  // ---------- Drawing the plan ----------
  function renderGrid() {
    const r = svg.getBoundingClientRect();
    const x0 = view.x, y0 = view.y, x1 = view.x + r.width / view.s, y1 = view.y + r.height / view.s;
    const minor = view.s >= 28 ? 0.5 : view.s >= 9 ? 1 : 5;
    const major = minor === 5 ? 10 : 1;
    let out = "";
    for (let x = Math.floor(x0 / minor) * minor; x <= x1; x += minor) {
      const px = (x - view.x) * view.s;
      const cls = Math.abs(x / major - Math.round(x / major)) < 1e-6 ? "grid-major" : "grid-minor";
      out += `<line x1="${px}" y1="0" x2="${px}" y2="${r.height}" class="${cls}"/>`;
    }
    for (let y = Math.floor(y0 / minor) * minor; y <= y1; y += minor) {
      const py = (y - view.y) * view.s;
      const cls = Math.abs(y / major - Math.round(y / major)) < 1e-6 ? "grid-major" : "grid-minor";
      out += `<line x1="0" y1="${py}" x2="${r.width}" y2="${py}" class="${cls}"/>`;
    }
    gridLayer.innerHTML = out;
  }

  let draft = null;   // room being drawn
  // A room's name on the plan, cut with … when it is wider than the room (about 7 px a letter at 12.5 px)
  const fitName = (name, px) => {
    const text = I18N.t(name), max = Math.max(3, Math.floor(px / 7));
    return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
  };
  function renderPlan() {
    const s = view.s;
    const fs = (px) => (px / s).toFixed(4);           // text size that stays the same on screen
    const hits = overlapping();
    refreshSpace();
    const marks = spaceShow && tool === "select" ? spaceIssues : [];
    const tight = new Set(marks.flatMap((i) => i.items));
    let out = "";

    project.rooms.forEach((r) => {
      const selected = sel?.type === "room" && sel.id === r.id;
      const showText = r.w * s > 80 && r.h * s > 46;
      out += `<g class="room${selected ? " is-selected" : ""}" data-room="${r.id}">
        <rect class="room-shape" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}" stroke-width="${selected ? 3 : 2.5}" vector-effect="non-scaling-stroke"/>
        ${showText ? `<text class="room-name" x="${r.x + 10 / s}" y="${r.y + 20 / s}" font-size="${fs(12.5)}">${esc(fitName(r.name, r.w * s - 16))}</text>
        <text class="room-area" x="${r.x + 10 / s}" y="${r.y + 35 / s}" font-size="${fs(11)}">${m2(round2(r.w * r.h))}</text>` : ""}
      </g>`;
    });

    const openKeys = new Set(project.openWalls || []);
    sharedWalls(project.rooms).filter((w) => openKeys.has(w.key)).forEach((w) => {
      out += `<g class="open-wall" aria-hidden="true"><line class="open-wall-gap" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${w.a.color}" stroke-width="6" vector-effect="non-scaling-stroke"/>
        <line class="open-wall-dash" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g>`;
    });

    const ordered = [...project.items].sort((a, b) => isRug(b) - isRug(a));   // rugs underneath
    ordered.forEach((it) => {
      const p = product(it);
      if (!p) return;
      const w = p.w / 100, d = p.d / 100;
      const selected = sel?.type === "item" && sel.id === it.id;
      const cls = ["item", selected && "is-selected", isRug(it) && "is-rug", isPlant(it) && "is-plant", p.wall && (p.hang ? "is-hang" : `is-opening is-${p.kind}`), hits.has(it.id) && "is-overlapping", tight.has(it.id) && !p.wall && "is-tight"].filter(Boolean).join(" ");
      const shape = p.round || p.pattern === "hide"
        ? `<ellipse class="item-shape" rx="${w / 2}" ry="${d / 2}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        : `<rect class="item-shape" x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="${Math.min(w, d) * 0.08}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
      const back = !p.round && !isRug(it) && !p.wall ? `<line class="item-front" x1="${-w / 2 + 0.04}" y1="${-d / 2 + 0.06}" x2="${w / 2 - 0.04}" y2="${-d / 2 + 0.06}" stroke-width="2" vector-effect="non-scaling-stroke"/>` : "";
      const fit = footprint(it);
      const label = !isRug(it) && !p.wall && fit.w * s > 64 && fit.h * s > 22
        ? `<text class="item-label" x="${it.x}" y="${it.y + 4 / s}" text-anchor="middle" font-size="${fs(11)}">${esc(p.name)}</text>` : "";
      out += `<g class="${cls}" data-item="${it.id}"><g transform="translate(${it.x} ${it.y}) rotate(${it.rot || 0})">${shape}${back}</g>${label}</g>`;
    });

    // Space check: the spots that will be awkward to live with
    marks.forEach((issue, i) => {
      const z = issue.zone, cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      const text = issue.kind === "door" ? "Keep clear" : issue.label;
      const tw = (text.length * 6.6 + 14) / s, th = 18 / s;
      const fits = z.w * s > tw * s + 6 || z.h * s > 40;
      out += `<g class="space-mark${i === spaceFocus ? " is-focus" : ""} is-${issue.kind}" aria-hidden="true">
        <rect class="space-zone" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${Math.min(z.w, z.h, 0.08) / 2}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        ${fits ? `<rect class="space-tag" x="${cx - tw / 2}" y="${cy - th / 2}" width="${tw}" height="${th}" rx="${th / 2}"/><text class="space-tag-text" x="${cx}" y="${cy + 3.8 / s}" text-anchor="middle" font-size="${fs(10.5)}">${text}</text>` : ""}
      </g>`;
    });

    // Setting the picture's scale: the line being measured
    if (tool === "scale" && scaleLine) {
      const L = scaleLine, len = Math.hypot(L.x1 - L.x0, L.y1 - L.y0);
      out += `<g class="scale-line" aria-hidden="true">
        <line x1="${L.x0}" y1="${L.y0}" x2="${L.x1}" y2="${L.y1}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
        <circle cx="${L.x0}" cy="${L.y0}" r="${5 / s}"/><circle cx="${L.x1}" cy="${L.y1}" r="${5 / s}"/>
        ${len > 0.05 && project.trace?.scaled ? `<text class="dim" x="${(L.x0 + L.x1) / 2}" y="${(L.y0 + L.y1) / 2 - 10 / s}" text-anchor="middle" font-size="${fs(12)}">${metres(round2(len))}</text>` : ""}
      </g>`;
    }

    // Measurements + resize handle for the selected room
    const room = sel?.type === "room" && find(sel);
    if (room) {
      const off = 18 / s, pad = 6 / s, h = 18 / s;
      const label = (cx, cy, text) => {
        const tw = (text.length * 7 + 12) / s;
        return `<rect class="dim-bg" x="${cx - tw / 2}" y="${cy - h / 2}" width="${tw}" height="${h}" rx="${h / 2}" vector-effect="non-scaling-stroke"/>
          <text class="dim" x="${cx}" y="${cy + 4 / s}" text-anchor="middle" font-size="${fs(11.5)}">${text}</text>`;
      };
      out += `<g>
        <line class="dim-line" x1="${room.x}" y1="${room.y - off}" x2="${room.x + room.w}" y2="${room.y - off}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        <line class="dim-line" x1="${room.x - off}" y1="${room.y}" x2="${room.x - off}" y2="${room.y + room.h}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
        ${label(room.x + room.w / 2, room.y - off, metres(room.w))}
        ${label(room.x - off, room.y + room.h / 2, metres(room.h))}
        <rect class="handle" data-handle="${room.id}" x="${room.x + room.w - pad}" y="${room.y + room.h - pad}" width="${pad * 2}" height="${pad * 2}" rx="${pad * 0.5}" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </g>`;
    }

    // While dragging a piece: distance to the nearest walls
    if (drag?.kind === "item" && !product(drag.it).wall) {
      const it = drag.it, r = roomAt(project.rooms, it.x, it.y);
      if (r) {
        const f = footprint(it), T = WALL_T;
        const L = r.x + T, R = r.x + r.w - T, Tp = r.y + T, B = r.y + r.h - T;
        const gx = it.x - f.w / 2 - L < R - (it.x + f.w / 2) ? [L, it.x - f.w / 2] : [it.x + f.w / 2, R];
        const gy = it.y - f.h / 2 - Tp < B - (it.y + f.h / 2) ? [Tp, it.y - f.h / 2] : [it.y + f.h / 2, B];
        const tag = (x, y, m) => {
          const text = `${Math.max(0, Math.round(m * 100))} cm`, tw = (text.length * 7 + 12) / s, h = 18 / s;
          return `<rect class="dim-bg" x="${x - tw / 2}" y="${y - h / 2}" width="${tw}" height="${h}" rx="${h / 2}" vector-effect="non-scaling-stroke"/><text class="dim" x="${x}" y="${y + 4 / s}" text-anchor="middle" font-size="${fs(11)}">${text}</text>`;
        };
        out += `<g class="guides">
          <line class="guide-line" x1="${gx[0]}" y1="${it.y}" x2="${gx[1]}" y2="${it.y}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          <line class="guide-line" x1="${it.x}" y1="${gy[0]}" x2="${it.x}" y2="${gy[1]}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          ${tag((gx[0] + gx[1]) / 2, it.y, gx[1] - gx[0])}${tag(it.x, (gy[0] + gy[1]) / 2, gy[1] - gy[0])}</g>`;
      }
    }

    if (draft) {
      const x = Math.min(draft.x0, draft.x1), y = Math.min(draft.y0, draft.y1);
      const w = Math.abs(draft.x1 - draft.x0), h = Math.abs(draft.y1 - draft.y0);
      out += `<rect class="draft" x="${x}" y="${y}" width="${w}" height="${h}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
      if (w > 0.3 && h > 0.3) {
        out += `<text class="dim" x="${x + w / 2}" y="${y + h / 2 + 4 / s}" text-anchor="middle" font-size="${fs(13)}">${metres(round2(w))} × ${metres(round2(h))}</text>`;
      }
    }

    world.setAttribute("transform", `translate(${-view.x * s} ${-view.y * s}) scale(${s})`);
    world.innerHTML = out;
    document.getElementById("zoom-level").textContent = `${Math.round((s / 50) * 100)}%`;
    document.getElementById("canvas-empty").hidden = emptyHidden();
    renderTrace();
    placeSelBar();
  }

  let three = null;   // the 3D view, created below
  // The "draw your first room" card: not over a plan picture, and not while drawing
  const emptyHidden = () => project.rooms.length > 0 || tool !== "select" || !!project.trace;
  function render() {
    document.getElementById("canvas-empty").hidden = emptyHidden();
    if (mode === "3d") { three?.update(sel); return; }
    renderGrid(); renderPlan();
  }

  // ---------- View: fit, zoom, pan ----------
  function fit() {
    if (mode === "3d") { three?.view("3d"); return; }
    const r = svg.getBoundingClientRect();
    const boxes = [
      ...project.rooms.map((x) => [x.x, x.y, x.x + x.w, x.y + x.h]),
      ...project.items.filter(product).map((it) => { const f = footprint(it); return [it.x - f.w / 2, it.y - f.h / 2, it.x + f.w / 2, it.y + f.h / 2]; }),
      ...(project.trace && traceURL && !project.trace.hidden ? [[project.trace.x, project.trace.y, project.trace.x + project.trace.w, project.trace.y + project.trace.w * project.trace.aspect]] : []),
    ];
    if (!boxes.length) { view.s = 50; view.x = 5 - r.width / 2 / 50; view.y = 4 - r.height / 2 / 50; render(); return; }
    const minX = Math.min(...boxes.map((b) => b[0])), minY = Math.min(...boxes.map((b) => b[1]));
    const maxX = Math.max(...boxes.map((b) => b[2])), maxY = Math.max(...boxes.map((b) => b[3]));
    const padX = 60, padTop = 80, padBottom = 90;
    view.s = Math.max(8, Math.min(160, (r.width - padX * 2) / (maxX - minX || 1), (r.height - padTop - padBottom) / (maxY - minY || 1)));
    view.x = (minX + maxX) / 2 - r.width / 2 / view.s;
    view.y = (minY + maxY) / 2 - (r.height + padTop - padBottom) / 2 / view.s;
    render();
  }
  function zoomAt(factor, cx, cy) {
    if (mode === "3d") { three?.zoom(factor); return; }
    const r = svg.getBoundingClientRect();
    cx ??= r.width / 2; cy ??= r.height / 2;
    const wx = view.x + cx / view.s, wy = view.y + cy / view.s;
    view.s = Math.max(8, Math.min(220, view.s * factor));
    view.x = wx - cx / view.s; view.y = wy - cy / view.s;
    render();
  }
  document.getElementById("zoom-in").addEventListener("click", () => zoomAt(1.25));
  document.getElementById("zoom-out").addEventListener("click", () => zoomAt(0.8));
  document.getElementById("zoom-fit").addEventListener("click", fit);
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    if (e.ctrlKey || !e.deltaX) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    else { view.x += e.deltaX / view.s; view.y += e.deltaY / view.s; render(); }
  }, { passive: false });
  new ResizeObserver(() => { if (mode === "2d") render(); }).observe(wrap);

  // ---------- Tools ----------
  const HINTS = {
    draw: "Drag on the grid to draw a room · Esc to stop",
    scale: "Drag along a wall whose length you know, end to end · Esc to stop",
    "move-plan": "Drag the picture to line it up · Esc when it's in place",
  };
  function setTool(next) {
    if (next !== "select" && mode !== "2d") setMode("2d", false);   // rooms are drawn on the plan
    tool = next;
    document.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === (tool === "draw" ? "draw" : "select"))));
    svg.classList.toggle("is-drawing", tool === "draw" || tool === "scale");
    svg.classList.toggle("is-moving-plan", tool === "move-plan");
    const hint = document.getElementById("canvas-hint");
    hint.hidden = !HINTS[tool];
    if (HINTS[tool]) hint.textContent = HINTS[tool];
    if (tool !== "scale") { scaleLine = null; scaleAsk.hidden = true; }
    render();
    syncSpacePill();
    if (!tracePop.hidden) renderTracePop();
  }
  document.querySelectorAll("[data-tool]").forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-start-draw]")) setTool("draw");
    if (e.target.closest("[data-quick-room]")) addRoom(4, 3);
  });

  function setSnap(on) {
    snapOn = on;
    localStorage.setItem("atelier.snap", on ? "on" : "off");
    const btn = document.getElementById("snap-btn");
    btn.setAttribute("aria-pressed", String(on));
    btn.title = on ? "Snapping to 5 cm and 15° (G)" : "Free placement: no grid (G)";
    toast(on ? "Snap on: pieces move in 5 cm steps and turn in 15° steps" : "Snap off: move and turn freely", { duration: 2200 });
  }
  document.getElementById("snap-btn").addEventListener("click", () => setSnap(!snapOn));

  function nextRoomName() {
    const used = new Set(project.rooms.map((r) => r.name));
    for (let n = project.rooms.length + 1; ; n++) if (!used.has(`Room ${n}`)) return `Room ${n}`;
  }
  const nextColor = () => CATALOG.ROOM_COLORS[project.rooms.length % CATALOG.ROOM_COLORS.length];
  const newRoom = (x, y, w, h) => ({ id: Projects.uid(), name: nextRoomName(), x: round2(x), y: round2(y), w, h, color: nextColor(), floor: "oak", wall: "#f5f1ea", height: 2.6, lamp: true });

  function addRoom(w, h) {
    // Next to the existing rooms, or in the middle of the view
    const r = svg.getBoundingClientRect();
    let x = snap(view.x + r.width / 2 / view.s - w / 2, 0.1), y = snap(view.y + r.height / 2 / view.s - h / 2, 0.1);
    if (project.rooms.length) {
      x = round2(Math.max(...project.rooms.map((q) => q.x + q.w)));
      y = round2(Math.min(...project.rooms.map((q) => q.y)));
    }
    const room = newRoom(x, y, w, h);
    project.rooms.push(room);
    select({ type: "room", id: room.id });
    commit(); fit();
    toast(`Added ${room.name}. Rename it and type its exact size in the panel.`, { duration: 3500 });
  }

  // ---------- Pointer on the 2D plan: select, move, resize, draw, pan, pinch ----------
  const pointers = new Map();
  let drag = null;

  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {                         // second finger: pinch to zoom
      const [a, b] = [...pointers.values()];
      drag = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y) };
      draft = null;
      return;
    }
    const p = toWorld(e);
    const handle = e.target.closest("[data-handle]");
    const itemEl = e.target.closest("[data-item]");
    const roomEl = e.target.closest("[data-room]");

    if (tool === "scale") {
      if (scaleLine?.waiting) { scaleLine.x1 = p.x; scaleLine.y1 = p.y; scaleLine.waiting = false; drag = { kind: "scale", done: true }; }
      else { scaleLine = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; scaleAsk.hidden = true; drag = { kind: "scale" }; }
      renderPlan();
      return;
    }
    if (tool === "move-plan") {
      drag = { kind: "move-plan", start: p, x: project.trace.x, y: project.trace.y };
      return;
    }
    if (tool === "draw") {
      const x = magnet(snap(p.x, roomStep()), edgesX()), y = magnet(snap(p.y, roomStep()), edgesY());
      draft = { x0: x, y0: y, x1: x, y1: y };
      drag = { kind: "draw" };
    } else if (handle) {
      const room = project.rooms.find((r) => r.id === handle.dataset.handle);
      drag = { kind: "resize", room, start: p, w: room.w, h: room.h, keep: { furniture: remember(room), openings: openingsOf(room) } };
    } else if (itemEl) {
      const it = project.items.find((x) => x.id === itemEl.dataset.item);
      select({ type: "item", id: it.id }, false);
      drag = { kind: "item", it, start: p, x: it.x, y: it.y, roomId: roomAt(project.rooms, it.x, it.y)?.id || null };
    } else if (roomEl) {
      const room = project.rooms.find((r) => r.id === roomEl.dataset.room);
      select({ type: "room", id: room.id }, false);
      // Furniture standing in the room moves with it
      drag = { kind: "room", room, start: p, x: room.x, y: room.y, inside: itemsIn(room).map((it) => ({ it, x: it.x, y: it.y })) };
    } else {
      drag = { kind: "pan", sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
      svg.classList.add("is-panning");
    }
    selBar.hidden = true;
    render();
  });

  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    if (drag.kind === "pinch") {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = svg.getBoundingClientRect();
      zoomAt(dist / drag.dist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      drag.dist = dist;
      return;
    }
    const p = toWorld(e);
    if (drag.kind === "pan") {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      view.x = drag.vx - dx / view.s; view.y = drag.vy - dy / view.s;
      render();
      return;
    }
    if (drag.kind === "scale") {
      if (!drag.done) { scaleLine.x1 = p.x; scaleLine.y1 = p.y; }
      renderPlan();
      return;
    }
    if (drag.kind === "move-plan") {
      project.trace.x = round2(drag.x + p.x - drag.start.x); project.trace.y = round2(drag.y + p.y - drag.start.y);
      renderTrace();
      return;
    }
    if (drag.kind === "draw") {
      draft.x1 = magnet(snap(p.x, roomStep()), edgesX()); draft.y1 = magnet(snap(p.y, roomStep()), edgesY());
    } else if (drag.kind === "resize") {
      const r = drag.room;
      const w = round2(Math.max(MIN_ROOM, magnet(snap(r.x + drag.w + p.x - drag.start.x, roomStep()), edgesX(r)) - r.x));
      const h = round2(Math.max(MIN_ROOM, magnet(snap(r.y + drag.h + p.y - drag.start.y, roomStep()), edgesY(r)) - r.y));
      Object.assign(r, roomFits(r, w, h, drag));
      reflow(r, drag.keep);
    } else if (drag.kind === "item") {
      const it = drag.it, prod = product(it);
      const before = { x: it.x, y: it.y, rot: it.rot };
      it.x = round2(snap(drag.x + p.x - drag.start.x, itemStep()));
      it.y = round2(snap(drag.y + p.y - drag.start.y, itemStep()));
      if (prod.wall) {
        const wanted = { ...it };
        if (!fitOpening(project, CATALOG, it, snapOpening, before)) Object.assign(it, before);
        snapOpening(wanted);
        if (onOpenWall(project, CATALOG, wanted)) blocked("open");
        else if (openingClash(project, CATALOG, wanted)) blocked();
        if (isCurtainWindow(it)) hangCurtains();
      }
      else {
        const into = roomAt(project.rooms, it.x, it.y, WALL_T + 0.05);
        if (into) drag.roomId = into.id;
        settle(it, drag.roomId);
      }
    } else if (drag.kind === "room") {
      const r = drag.room;
      let nx = snap(drag.x + p.x - drag.start.x, roomStep()), ny = snap(drag.y + p.y - drag.start.y, roomStep());
      // Either side of the room can line up with another room
      const mx = magnet(nx, edgesX(r)), mx2 = magnet(nx + r.w, edgesX(r)) - r.w;
      nx = mx !== nx ? mx : mx2;
      const my = magnet(ny, edgesY(r)), my2 = magnet(ny + r.h, edgesY(r)) - r.h;
      ny = my !== ny ? my : my2;
      const dx = round2(nx - drag.x), dy = round2(ny - drag.y);
      r.x = round2(drag.x + dx); r.y = round2(drag.y + dy);
      drag.inside.forEach((o) => { o.it.x = round2(o.x + dx); o.it.y = round2(o.y + dy); });
    }
    renderPlan();
    if (drag.kind !== "draw") renderInspector();
  });

  // Doors and windows on the plan: stick to the nearest wall, like in 3D
  // Doors and windows can't share wall space: the planner stops them, like furniture at a wall
  let blockedAt = 0;
  function blocked(why) {
    if (performance.now() - blockedAt < 3500) return;
    blockedAt = performance.now();
    toast(why === "open" ? "There's no wall here: it was taken away to join the rooms." : "Doors and windows can't overlap. Move it to a free part of the wall.", { duration: 2200 });
  }
  // A door or window placed somewhere new: next to the one in the way, else any free wall of the room
  function placeOpening(it, room) {
    if (fitOpening(project, CATALOG, it, snapOpening)) return true;
    const r = room || roomAt(project.rooms, it.x, it.y, -0.3) || nearestRoom(project.rooms, it.x, it.y);
    return !!r && freeOpeningSpot(project, CATALOG, it, r, snapOpening);
  }
  function snapOpening(it) {
    const half = product(it).w / 200;
    let best = null;
    project.rooms.forEach((r) => {
      const clampX = Math.min(r.x + r.w - half - 0.05, Math.max(r.x + half + 0.05, it.x));
      const clampY = Math.min(r.y + r.h - half - 0.15, Math.max(r.y + half + 0.15, it.y));
      [
        { d: Math.abs(it.y - r.y), x: clampX, y: r.y + WALL_T / 2, rot: 0, ok: it.x > r.x - 0.5 && it.x < r.x + r.w + 0.5 },
        { d: Math.abs(it.y - r.y - r.h), x: clampX, y: r.y + r.h - WALL_T / 2, rot: 180, ok: it.x > r.x - 0.5 && it.x < r.x + r.w + 0.5 },
        { d: Math.abs(it.x - r.x), x: r.x + WALL_T / 2, y: clampY, rot: 270, ok: it.y > r.y - 0.5 && it.y < r.y + r.h + 0.5 },
        { d: Math.abs(it.x - r.x - r.w), x: r.x + r.w - WALL_T / 2, y: clampY, rot: 90, ok: it.y > r.y - 0.5 && it.y < r.y + r.h + 0.5 },
      ].forEach((c) => { if (c.ok && (!best || c.d < best.d)) best = c; });
    });
    if (best) { it.x = round2(best.x); it.y = round2(best.y); it.rot = best.rot; }
  }

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (!drag) return;
    if (drag.kind === "pinch") { if (pointers.size === 0) drag = null; return; }
    svg.classList.remove("is-panning");
    if (drag.kind === "scale") {
      drag = null;
      const L = scaleLine;
      if (!L) return;
      if (Math.hypot(L.x1 - L.x0, L.y1 - L.y0) * view.s < 12) { L.waiting = true; renderPlan(); return; }   // a click: the next click sets the other end
      askScale();
      return;
    }
    if (drag.kind === "move-plan") { drag = null; scheduleSave(); return; }
    if (drag.kind === "pan" && !drag.moved) select(null);          // click on empty space: deselect
    if (drag.kind === "draw" && draft) {
      const x = Math.min(draft.x0, draft.x1), y = Math.min(draft.y0, draft.y1);
      const w = round2(Math.abs(draft.x1 - draft.x0)), h = round2(Math.abs(draft.y1 - draft.y0));
      draft = null;
      if (w >= MIN_ROOM && h >= MIN_ROOM) {
        const room = newRoom(x, y, w, h);
        project.rooms.push(room);
        setTool("select");
        select({ type: "room", id: room.id });
        tab = "rooms"; renderPanel();
        toast(`${room.name} added: ${metres(w)} × ${metres(h)}`, { duration: 2500 });
      } else {
        toast("Drag a bit further to draw a room (at least 50 cm each side)", { duration: 2500 });
      }
    }
    drag = null;
    commit();
    render();
    renderPanel();
  }
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);

  // ---------- Selection and commands ----------
  function select(next, redraw = true) {
    sel = next;
    if (redraw) { if (mode === "3d") three?.select(sel); else render(); }
    renderPanel();
    placeSelBar();
  }

  function removeSelected() {
    const thing = find(sel);
    if (!thing) return;
    if (sel.type === "room") {
      project.rooms = project.rooms.filter((r) => r.id !== thing.id);
      toast(`Deleted ${thing.name}`, { action: "Undo", onAction: undo });
    } else {
      project.items = project.items.filter((it) => it.id !== thing.id);
      toast(`Removed ${product(thing).name}`, { action: "Undo", onAction: undo });
    }
    sel = null;
    commit(); render(); renderPanel(); placeSelBar();
  }
  function rotateSelected(by = 90) {
    const it = sel?.type === "item" && find(sel);
    if (!it || product(it).wall) return;
    const room = roomAt(project.rooms, it.x, it.y)?.id;
    it.rot = norm((it.rot || 0) + by);
    settle(it, room);
    commit(); render(); renderInspector();
  }
  function duplicateSelected() {
    const thing = find(sel);
    if (!thing) return;
    if (sel.type === "room") {
      const copy = { ...thing, id: Projects.uid(), name: `${thing.name} copy`, x: round2(thing.x + thing.w), color: nextColor() };
      project.rooms.push(copy);
      sel = { type: "room", id: copy.id };
    } else {
      pasteItem(thing);
      return;
    }
    commit(); render(); renderPanel();
  }
  // Copy / paste: the new piece lands next to the original, inside the same room
  let clipboard = null;
  function pasteItem(src) {
    if (!src) return;
    const p = CATALOG.byId[src.catalogId];
    const copy = { ...src, id: Projects.uid() };
    if (p.wall) {
      copy.x = round2(src.x + (src.rot % 180 === 0 ? p.w / 100 + 0.2 : 0)); copy.y = round2(src.y + (src.rot % 180 === 0 ? 0 : p.w / 100 + 0.2));
      if (!placeOpening(copy)) { toast(`There's no free wall left for another ${p.name.toLowerCase()} here.`); return; }
    }
    else {
      const room = roomAt(project.rooms, src.x, src.y);
      if (room) Object.assign(copy, freeSpot(room, copy, src));
      else { copy.x = round2(src.x + 0.3); copy.y = round2(src.y + 0.3); }
      settle(copy, room?.id);
    }
    project.items.push(copy);
    sel = { type: "item", id: copy.id };
    commit(); render(); renderPanel();
    toast(`Added another ${p.name.toLowerCase()}`, { duration: 1800 });
  }

  // The free place closest to `near` (or the room's middle), so a new piece doesn't land on the bed
  function freeSpot(room, it, near) {
    const f = footprint(it), wall = WALL_T + 0.01;
    const rugNew = isRug(it);
    const blockers = project.items.filter((o) => o !== it && product(o) && !product(o).wall && isRug(o) === rugNew);
    const free = (x, y) => blockers.every((o) => {
      const g = footprint(o);
      return Math.abs(x - o.x) >= (f.w + g.w) / 2 + 0.03 || Math.abs(y - o.y) >= (f.h + g.h) / 2 + 0.03;
    });
    if (near) {                                   // right where it was dropped, if it fits (also across an open wall)
      const t = { ...it, x: near.x, y: near.y };
      keepInside(project, CATALOG, t, room.id);
      if (free(t.x, t.y)) return { x: t.x, y: t.y };
    }
    const cx = near ? near.x : room.x + room.w / 2, cy = near ? near.y : room.y + room.h / 2;
    let best = null;
    for (let x = room.x + wall + f.w / 2; x <= room.x + room.w - wall - f.w / 2 + 1e-6; x += 0.05) {
      for (let y = room.y + wall + f.h / 2; y <= room.y + room.h - wall - f.h / 2 + 1e-6; y += 0.05) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if ((!best || d < best.d) && free(x, y)) best = { x: round2(x), y: round2(y), d };
      }
    }
    return best ? { x: best.x, y: best.y } : { x: round2(cx), y: round2(cy) };
  }

  // A spot on a table, chest or shelf in the room, for small things like vases and books
  function surfaceSpot(room, it) {
    const tops = project.items.filter((o) => SURFACES.has(product(o)?.kind) && roomAt([room], o.x, o.y));
    if (!tops.length) return null;
    const used = project.items.filter((o) => o !== it && isSmall(product(o)));
    for (const o of tops) {
      const f = footprint(o);
      for (const [fx, fy] of [[0.3, 0], [-0.3, 0], [0, 0], [0.3, 0.2], [-0.3, -0.2]]) {
        const x = round2(o.x + fx * f.w), y = round2(o.y + fy * f.h);
        if (used.every((u) => Math.hypot(u.x - x, u.y - y) > 0.18)) return { x, y };
      }
    }
    return null;
  }
  // at: where it was dropped (plan metres), when dragged in from the panel
  // ---------- Curtains hang from a window and stay with it ----------
  // A curtain remembers its window (it.win): when the window moves, turns or changes, or the ceiling
  // goes up or down, the curtain follows. Made to measure (it.fit, the default) it keeps 40 cm past the
  // glass on each side and drops from just under the ceiling; a size typed by hand is kept.
  // Dragged away from its window it hangs free; dragged next to another window it moves onto that one.
  const CURTAIN_WINDOWS = /window|sliding-door|glass-door/;
  const isCurtainWindow = (o) => { const p = CATALOG.byId[o.catalogId]; return !!p?.wall && !p.hang && CURTAIN_WINDOWS.test(p.kind || ""); };
  const isCurtain = (o) => CATALOG.byId[o.catalogId]?.kind === "curtains";
  // Where the curtain for this window hangs: in front of it, on the room side, and how big it is made to measure
  function hangSpot(win) {
    const room = roomAt(project.rooms, win.x, win.y) || roomAt(project.rooms, win.x, win.y, -0.2) || nearestRoom(project.rooms, win.x, win.y);
    const o = openingOf(CATALOG.byId[win.catalogId]);
    const across = (((win.rot || 0) % 180) + 180) % 180 === 0;   // the window runs along x: the curtain stands in front of it in y
    const mid = room ? (across ? room.y + room.h / 2 : room.x + room.w / 2) : (across ? win.y : win.x) + 1;
    const side = Math.sign(mid - (across ? win.y : win.x)) || 1;
    const gap = WALL_T / 2 + 0.15;                 // in front of the window sill (it reaches 16 cm out of the wall's middle)
    const x = across ? win.x : win.x + side * gap, y = across ? win.y + side * gap : win.y;
    // 40 cm past the glass each side, so drawn open the folds gather beside it; never into the next wall
    let half = o.w / 2 + 0.4;
    if (room) {
      const c = across ? win.x : win.y, lo = across ? room.x : room.y, hi = lo + (across ? room.w : room.h);
      half = Math.min(half, c - lo - 0.02, hi - c - 0.02);
    }
    // a window close by on the same wall: the two curtains share the wall between them
    project.items.forEach((n) => {
      if (n === win || !isCurtainWindow(n) || (((n.rot || 0) % 180) + 180) % 180 !== (across ? 0 : 90)) return;
      if (Math.abs(across ? n.y - win.y : n.x - win.x) > 0.05) return;
      const gap = Math.abs(across ? n.x - win.x : n.y - win.y) - o.w / 2 - openingOf(CATALOG.byId[n.catalogId]).w / 2;
      half = Math.min(half, o.w / 2 + gap / 2 - 0.01);
    });
    half = Math.max(o.w / 2 + 0.08, half);
    const H = room?.height || 2.6;
    return { x: round2(x), y: round2(y), rot: across ? 0 : 90, w: half * 2, h: H - 0.06, room };
  }
  function sizeCurtain(it, spot) {
    const rules = CATALOG.SIZABLE.curtains;
    const clamp = (k, v) => Math.min(rules[k][1], Math.max(rules[k][0], Math.round(v / 5) * 5));
    if (it.fit === false) {                       // a size of its own: only never taller than the room
      if (it.size?.h > spot.h * 100 + 1) it.size.h = clamp("h", Math.floor(spot.h * 20) * 5);
      return;
    }
    it.size = { w: clamp("w", Math.floor(spot.w * 20) * 5), h: clamp("h", Math.floor(spot.h * 20) * 5) };
  }
  // The curtains of a room, made to measure for its nearest window without curtains yet
  function fitToWindow(it, room = null) {
    room ||= roomAt(project.rooms, it.x, it.y) || nearestRoom(project.rooms, it.x, it.y);
    const taken = new Set(project.items.filter((o) => o !== it && isCurtain(o) && o.win).map((o) => o.win));
    const wins = project.items.filter((o) => isCurtainWindow(o) && (!room || hangSpot(o).room === room));
    if (!wins.length) return null;
    // a free window first, then a glass door, then one that has curtains already
    const dist = (o) => Math.hypot(o.x - it.x, o.y - it.y) + (taken.has(o.id) ? 100 : 0) + (/window/.test(CATALOG.byId[o.catalogId].kind) ? 0 : 50);
    const win = wins.reduce((a, o) => (dist(o) < dist(a) ? o : a));
    const spot = hangSpot(win);
    it.win = win.id; delete it.fit;
    Object.assign(it, { x: spot.x, y: spot.y, rot: spot.rot });
    sizeCurtain(it, spot);
    return win;
  }
  // Keeps every curtain on its window. Returns true if anything moved.
  const winKeys = new Map();                       // each window where it was last time: to tell "the window moved" from "the curtain was moved"
  function hangCurtains() {
    const wins = project.items.filter(isCurtainWindow);
    const byId = new Map(wins.map((w) => [w.id, w]));
    const key = (w) => `${w.x}|${w.y}|${w.rot || 0}|${w.catalogId}`;
    const curtains = project.items.filter(isCurtain);
    const taken = new Set();
    let changed = false;
    const before = (it) => JSON.stringify([it.x, it.y, it.rot, it.size, it.win]);
    // Curtains still where their window wants them, or whose window moved, keep it; the rest look again
    const loose = [];
    curtains.forEach((it) => {
      const win = byId.get(it.win);
      if (win && !taken.has(win.id)) {
        const moved = winKeys.has(win.id) && winKeys.get(win.id) !== key(win);
        const spot = hangSpot(win);
        if (moved || Math.hypot(spot.x - it.x, spot.y - it.y) < 0.03) { taken.add(win.id); hang(it, win, spot); return; }
      }
      loose.push(it);
    });
    loose.forEach((it) => {
      let best = null, bestD = 0.75;               // close enough to a free window: it goes onto it
      wins.forEach((w) => {
        if (taken.has(w.id)) return;
        const s = hangSpot(w), d = Math.hypot(s.x - it.x, s.y - it.y);
        if (d < bestD) { best = w; bestD = d; }
      });
      if (best) { taken.add(best.id); if (it.win !== best.id && it.win) delete it.fit; hang(it, best, hangSpot(best)); }
      else if (it.win) { delete it.win; changed = true; }
    });
    function hang(it, win, spot) {
      const was = before(it);
      it.win = win.id;
      Object.assign(it, { x: spot.x, y: spot.y, rot: spot.rot });
      sizeCurtain(it, spot);
      if (before(it) !== was) changed = true;
    }
    winKeys.clear();
    wins.forEach((w) => winKeys.set(w.id, key(w)));
    return changed;
  }
  // Where a new piece would go (nothing is changed): used to add it, and to show it while it is dragged in
  function planItem(catalogId, at = null, quiet = false) {
    const p = CATALOG.byId[catalogId];
    const r = svg.getBoundingClientRect();
    const dropRoom = at && project.rooms.length ? (roomAt(project.rooms, at.x, at.y) || nearestRoom(project.rooms, at.x, at.y)) : null;
    const room = dropRoom || (sel?.type === "room" ? find(sel) : sel?.type === "item" ? roomAt(project.rooms, find(sel)?.x, find(sel)?.y) : null);
    const target = room || project.rooms[0];
    let it;
    if (p.wall && target) {          // doors and windows start where dropped, or in the middle of the room's top wall
      if (at && !roomAt(project.rooms, at.x, at.y)) {   // dropped just past a wall: onto that wall
        at = { x: Math.min(target.x + target.w, Math.max(target.x, at.x)), y: Math.min(target.y + target.h, Math.max(target.y, at.y)) };
      }
      it = { id: Projects.uid(), catalogId, rot: 0, x: round2(at ? at.x : target.x + target.w / 2), y: round2(at ? at.y : target.y + WALL_T / 2) };
      if (!placeOpening(it, target)) { if (!quiet) toast(`There's no free wall left in ${target.name} for a ${p.name.toLowerCase()}.`); return null; }
    } else {
      it = { id: Projects.uid(), catalogId, rot: 0,
        x: round2(at ? at.x : target ? target.x + target.w / 2 : view.x + r.width / 2 / view.s),
        y: round2(at ? at.y : target ? target.y + target.h / 2 : view.y + r.height / 2 / view.s) };
      if (target) {
        // Small things land exactly where dropped (on a table, say); big ones on the free floor nearest the drop
        if (isSmall(p)) { if (!at) Object.assign(it, surfaceSpot(target, it) || freeSpot(target, it)); }
        else Object.assign(it, freeSpot(target, it, at));
        if (p.kind === "curtains") fitToWindow(it, target);
        settle(it, target.id);
      }
    }
    return { it, target };
  }
  function addItem(catalogId, at = null) {
    const p = CATALOG.byId[catalogId];
    const planned = planItem(catalogId, at);
    if (!planned) return;
    const { it, target } = planned;
    project.items.push(it);
    sel = { type: "item", id: it.id };
    commit(); render(); renderPanel();
    toast(p.hang ? `Hung the ${p.name.toLowerCase()} on the wall. Drag it to move it along.` : p.wall ? `Added a ${p.name.toLowerCase()}. Drag it along the walls; it snaps to the nearest one.` : `Added ${p.name}${target ? ` to ${target.name}` : ""}`, { duration: 2400 });
  }

  // ---------- Keyboard ----------
  document.addEventListener("keydown", (e) => {
    const el = e.target instanceof Element ? e.target : document.body;
    const typing = el.closest("input:not([type=range]):not([type=checkbox]):not([type=color]), textarea, select");
    // Text boxes keep their own undo for the letters typed; number boxes and everything else use the planner's
    const textBox = el.closest("input[type=text], input[type=search], textarea");
    const mod = e.ctrlKey || e.metaKey;
    // Letter keys by position too, so Ctrl+Z works on every keyboard layout
    const k = /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : (e.code.match(/^Key([A-Z])$/)?.[1] || e.key).toLowerCase();
    if (document.querySelector("dialog[open]")) return;
    if (mod && (k === "z" || k === "y") && !textBox) {
      e.preventDefault();
      if (typing) e.target.blur();
      if (k === "y" || e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && !typing) {
      if (k === "d") { e.preventDefault(); duplicateSelected(); return; }
      if (k === "c" && sel?.type === "item") { clipboard = { ...find(sel) }; toast("Copied. Press Ctrl+V to place another.", { duration: 1800 }); return; }
      if (k === "v" && clipboard) { e.preventDefault(); pasteItem(clipboard); return; }
      return;
    }
    if (typing || mod) return;
    if (e.key === "Escape") {
      if (!lightPop.hidden) { closeLight(); return; }
      if (closeExtras()) return;
      if (tool === "draw") setTool("select"); else if (sel) select(null);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") { if (sel) { e.preventDefault(); removeSelected(); } return; }
    if (e.key === "?" || (e.shiftKey && k === "/")) { document.getElementById("keys-dialog").showModal(); return; }
    if (e.target.matches("input[type=range]")) return;
    if (k === "r") rotateSelected(e.shiftKey ? -90 : 90);
    else if (k === "q") rotateSelected(snapOn ? -15 : -5);
    else if (k === "e") rotateSelected(snapOn ? 15 : 5);
    else if (k === "g") setSnap(!snapOn);
    else if (k === "l" && mode === "3d") toggleLight();
    else if (k === "d" && !e.target.closest(".panel")) setTool("draw");
    else if (k === "v") setTool("select");
    else if (k === "+" || k === "=") zoomAt(1.25);
    else if (k === "-") zoomAt(0.8);
    else if (k === "0") fit();
    else if (k === "3") setMode("3d");
    else if (k === "2") setMode("2d");
    else if (e.key.startsWith("Arrow") && sel && !e.target.closest(".panel-tabs, .cat-chips, .cat-groups, .segmented")) {
      e.preventDefault();
      const step = e.shiftKey ? 0.25 : e.altKey ? 0.01 : sel.type === "room" ? roomStep() * (snapOn ? 1 : 5) : 0.05;
      const thing = find(sel);
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (sel.type === "room") {
        const inside = itemsIn(thing);
        thing.x = round2(thing.x + dx); thing.y = round2(thing.y + dy);
        inside.forEach((it) => { it.x = round2(it.x + dx); it.y = round2(it.y + dy); });
      } else {
        const room = roomAt(project.rooms, thing.x, thing.y)?.id;
        const before = { x: thing.x, y: thing.y, rot: thing.rot };
        thing.x = round2(thing.x + dx); thing.y = round2(thing.y + dy);
        if (product(thing).wall) {
          const wanted = { ...thing };
          if (!fitOpening(project, CATALOG, thing, snapOpening, before)) Object.assign(thing, before);
          snapOpening(wanted);
          if (onOpenWall(project, CATALOG, wanted)) blocked("open");
          else if (openingClash(project, CATALOG, wanted)) blocked();
        }
        else settle(thing, room);
      }
      commit(); render(); renderInspector();
    }
  });

  // ---------- Floating toolbar over the selected piece ----------
  function placeSelBar() {
    const it = sel?.type === "item" && find(sel);
    if (!it || drag) { selBar.hidden = true; return; }
    let pos = null;
    if (mode === "3d") pos = three?.anchor();
    else {
      const f = footprint(it);
      pos = { x: (it.x - view.x) * view.s, y: (it.y - f.h / 2 - view.y) * view.s - 8 };
    }
    if (!pos) { selBar.hidden = true; return; }
    selBar.hidden = false;
    selBar.querySelector('[data-bar="rotate"]').hidden = Boolean(product(it).wall);
    const w = selBar.offsetWidth, h = selBar.offsetHeight, W = wrap.clientWidth;
    const x = Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, pos.x));
    const y = Math.max(h + 70, pos.y);
    selBar.style.transform = `translate(${x - w / 2}px, ${y - h - 10}px)`;
  }
  selBar.addEventListener("click", (e) => {
    const act = e.target.closest("[data-bar]")?.dataset.bar;
    if (act === "rotate") rotateSelected(90);
    if (act === "duplicate") duplicateSelected();
    if (act === "delete") removeSelected();
    if (act === "details") { document.getElementById("panel").scrollIntoView({ behavior: "smooth", block: "nearest" }); inspector.querySelector("input, button")?.focus(); }
  });

  // ---------- Side panel ----------
  const I = {
    ruler: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 16.5l13-13 4 4-13 13z M7.5 12.5l2 2 M10.5 9.5l2 2 M13.5 6.5l2 2"/></svg>',
    rotate: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7"/></svg>',
    download: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>',
    copy: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    trash: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16 M9 7V4.5h6V7 M6.5 7l1 13h9l1-13"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"/></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14 M5 12h14"/></svg>',
    search: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    draw: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="1.5" stroke-dasharray="3 2.5"/><path d="M12 9v6 M9 12h6"/></svg>',
    ext: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6 M20 4l-9 9 M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>',
    drop: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c3.2 4 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-3 2.3-6.2 5.5-10.2z"/></svg>',
    shuffle: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8C14.3 16 15.5 17 17.5 17H21 M18 14l3 3-3 3 M3 17h3.5c1.4 0 2.4-.5 3.2-1.4 M14.3 8.4c.8-.9 1.8-1.4 3.2-1.4H21 M18 4l3 3-3 3"/></svg>',
    bulb: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
    swap: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4L3 8l4 4 M3 8h14 M17 20l4-4-4-4 M21 16H7"/></svg>',
  };
  const openSections = new Set(["finish"]);   // which folding parts of the room card are open
  let recentColors = [];
  try { recentColors = JSON.parse(localStorage.getItem("atelier.colors")) || []; } catch { recentColors = []; }

  // Colour swatches in named groups, the colours you mixed yourself, and a picker for any colour
  function palette(field, current, groups, small = false) {
    const attr = { wall: "data-wall", tint: "data-tint", floorTint: "data-floortint" }[field] || "data-color";
    const what = { wall: "Wall colour", tint: "Colour", floorTint: "Floor colour" }[field] || "Plan colour";
    const cur = String(current || "").toLowerCase();
    const known = new Set(groups.flatMap((g) => g.colors.map((c) => c.hex.toLowerCase())));
    const mine = [...new Set([...(known.has(cur) || !cur ? [] : [cur]), ...recentColors])].filter((c) => !known.has(c)).slice(0, 6);
    const sw = (hex, name) => `<button type="button" class="swatch${small ? " small" : ""}" style="background:${hex}" ${attr}="${hex}" aria-pressed="${hex.toLowerCase() === cur}" aria-label="${what}: ${esc(name)}" title="${esc(name)}"></button>`;
    return `<div class="palette">
      ${groups.map((g) => `<div class="palette-group">${g.name ? `<span class="palette-name">${esc(g.name)}</span>` : ""}<div class="swatches">${g.colors.map((c) => sw(c.hex, c.name)).join("")}</div></div>`).join("")}
      <div class="palette-group"><span class="palette-name">Your colours</span><div class="swatches">
        ${mine.map((c) => sw(c, c)).join("")}
        <label class="swatch custom-swatch${small ? " small" : ""}" title="Pick any colour">
          <input type="color" data-custom="${field}" value="${/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#c2410c"}" aria-label="Pick any ${what.toLowerCase()}">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14 M5 12h14"/></svg>
        </label>
      </div></div>
    </div>`;
  }

  // Pictures are drawn only for cards that are (nearly) on screen, never the whole catalog at once
  const thumbSeen = "IntersectionObserver" in self ? new IntersectionObserver((list) => {
    list.forEach((e) => { if (e.isIntersecting) { thumbSeen.unobserve(e.target); loadThumb(e.target); } });
  }, { rootMargin: "300px 0px" }) : null;
  const thumbUrls = new Map();                   // pictures already made: shown at once on a redraw
  function loadThumb(img) {
    const p = CATALOG.byId[img.dataset.thumb];
    if (!p || img.src) return;
    productThumbnail(p).then((url) => { if (url) { thumbUrls.set(p.id, url); if (img.isConnected) { img.src = url; img.classList.add("is-ready"); } } });
  }
  function fillThumbs(root) {
    root.querySelectorAll("img[data-thumb]:not([src])").forEach((img) => {
      const url = thumbUrls.get(img.dataset.thumb);
      if (url) { img.src = url; img.classList.add("is-ready"); }
      else if (thumbSeen) thumbSeen.observe(img);
      else loadThumb(img);
    });
  }

  // Redraw even though a slider still has focus (after letting go), and keep the focus on it
  let freshInspector = false;
  function renderInspectorFresh() {
    const id = document.activeElement?.id;
    freshInspector = true; renderInspector(); freshInspector = false;
    if (id) document.getElementById(id)?.focus();
  }
  function renderInspector() {
    const thing = find(sel);
    if (!thing) { inspector.innerHTML = ""; delete inspector.dataset.for; return; }
    // Don't redraw while someone is typing or sliding in the inspector
    if (!freshInspector && inspector.contains(document.activeElement) && document.activeElement.matches("input") && inspector.dataset.for === thing.id) {
      inspector.querySelectorAll("[data-live]").forEach((el) => { el.textContent = liveText(el.dataset.live, thing); });
      const range = inspector.querySelector("[data-rot]");
      if (range && document.activeElement !== range) range.value = norm(thing.rot || 0);
      return;
    }
    const isNew = inspector.dataset.for !== thing.id;
    inspector.dataset.for = thing.id;
    queueMicrotask(() => { if (isNew) inspector.querySelector(".inspect")?.classList.add("is-new"); });
    const fold = (key, title, body) => `<details class="fold" data-fold="${key}" ${openSections.has(key) ? "open" : ""}><summary>${title}</summary><div class="fold-body">${body}</div></details>`;
    if (sel.type === "room") {
      inspector.innerHTML = `
        <section class="inspect panel-section" aria-label="Selected room">
          <div class="inspect-head"><span class="chip" style="background:${thing.color}" aria-hidden="true"></span>
            <div class="inspect-title"><span class="inspect-kind">Room</span><strong>${esc(thing.name)}</strong></div>
            <button type="button" class="icon-btn" data-deselect aria-label="Close">${I.close}</button></div>
          <div class="app-field"><label for="room-name">Name</label><input id="room-name" data-field="name" type="text" maxlength="40" value="${esc(thing.name)}"></div>
          <div class="inspect-grid">
            <div class="app-field"><label for="room-w">Width</label><div class="unit-input"><input id="room-w" data-field="w" type="number" inputmode="decimal" min="0.5" max="60" step="0.01" value="${thing.w}"><span>m</span></div></div>
            <div class="app-field"><label for="room-h">Length</label><div class="unit-input"><input id="room-h" data-field="h" type="number" inputmode="decimal" min="0.5" max="60" step="0.01" value="${thing.h}"><span>m</span></div></div>
          </div>
          <div class="inspect-facts"><span class="fact" data-live="area">${liveText("area", thing)}</span><span class="fact" data-live="pieces">${liveText("pieces", thing)}</span></div>
          ${openWallRows(thing)}
          ${fold("finish", "Floor", `
            <div class="finish-list">${Object.entries(CATALOG.FLOORS).map(([k, f]) => `<button type="button" class="finish" data-floor="${k}" aria-pressed="${k === thing.floor}" title="${esc(f.label)}"><span class="finish-chip" style="background-color:${f.color}"><img src="assets/floors/${k}-s.jpg?v=4${f.v ? `.${f.v}` : ""}" alt="" width="240" height="240" decoding="async"></span><span class="finish-name">${esc(f.label)}</span></button>`).join("")}</div>
            <div class="tone-head"><span class="field-label">Colour of the floor</span>
              <button type="button" class="link-btn" data-floor-reset ${thing.floorTint || thing.floorShade ? "" : "hidden"}>Natural</button></div>
            ${palette("floorTint", thing.floorTint, CATALOG.FLOOR_PALETTES, true)}
            <div class="rot-row tone-row">
              <label for="floor-shade">Shade</label>
              <input id="floor-shade" type="range" min="-40" max="40" step="2" value="${thing.floorShade || 0}" data-floorshade aria-valuetext="${shadeText(thing.floorShade)}">
              <output data-live="floorShade" for="floor-shade">${shadeText(thing.floorShade)}</output>
            </div>`)}
          ${fold("walls", "Wall colour", palette("wall", thing.wall, CATALOG.WALL_PALETTES))}
          ${fold("ceiling", "Ceiling &amp; light", ceilingFields(thing))}
          ${fold("more", "Colour on the 2D plan", `
            ${palette("color", thing.color, [{ name: "", colors: CATALOG.ROOM_COLORS.map((hex) => ({ hex, name: hex })) }], true)}`)}
          <div class="inspect-actions">
            <button type="button" class="mini-btn primary" data-act="furnish">${I.plus}Furnish</button>
            <button type="button" class="mini-btn" data-act="duplicate">${I.copy}Duplicate</button>
            <button type="button" class="mini-btn danger" data-act="delete">${I.trash}Delete</button>
          </div>
        </section>`;
    } else {
      const p = product(thing);
      const rot = norm(thing.rot || 0);
      const swaps = swapList(p);
      inspector.innerHTML = `
        <section class="inspect panel-section" aria-label="Selected piece">
          <div class="inspect-head">
            <span class="inspect-thumb"><img data-thumb="${p.id}" alt=""></span>
            <div class="inspect-title"><span class="inspect-kind">${esc(p.cat)}</span><strong>${esc(p.name)}</strong><small title="${esc(p.product)}">${esc(p.product)}</small></div>
            <button type="button" class="icon-btn" data-deselect aria-label="Close">${I.close}</button></div>
          <div class="inspect-facts">
            ${p.structure ? `<span class="fact">${p.w} × ${p.h} cm</span><span class="fact">Part of the wall</span>` : p.own ? `<span class="fact strong">Own item</span><span class="fact">Not on the shopping list</span>` : `<span class="fact strong"${p.estimate ? ` title="${p.notHere ? `Not sold by IKEA in ${Region.here.name}: the French price, converted` : "The French price, converted"}"` : ""}>${euro(p.price, p.estimate)}${CATALOG.packs(thing) > 1 ? ` × ${CATALOG.packs(thing)}` : ""}</span><span class="fact">${p.w} × ${p.d} cm</span>`}
            ${p.url ? `<a class="fact link" href="${p.url}" target="_blank" rel="noopener">${p.notHere ? `Search ${esc(p.store)}` : esc(p.store)} ${I.ext}</a>` : ""}
          </div>
          ${sizeFields(thing, p)}
          ${TV_KINDS.has(p.kind) ? `<label class="switch-row"><input type="checkbox" data-tv ${thing.on ? "checked" : ""}><span class="switch" aria-hidden="true"></span><span>TV on<small>The screen lights up the room, best seen in the evening</small></span></label>` : ""}
          ${p.hang ? hangFields(thing, p) : ""}
          ${lampFields(thing, p)}
          ${styleFields(thing, p)}
          ${hasShelfContents(p) || hasBookCovers(p) ? `<div class="shuffle-row">
            <button type="button" class="mini-btn" data-shuffle>${I.shuffle}${hasBookCovers(p) ? "Other covers" : "Shuffle the books"}</button>
            ${thing.shuffle ? `<button type="button" class="link-btn" data-shuffle-reset>As in the shop</button>` : `<span class="size-note">${hasBookCovers(p) ? "Same books, other titles" : "Same bookcase, other books"}</span>`}</div>` : ""}
          ${shelfFields(thing)}
          ${p.wall ? `<p class="panel-note">${p.hang ? "It hangs on the nearest wall. Drag it along the wall; set how high above." : "Drag it along a wall; it snaps to the nearest one."}</p>` : `
          <div class="rot-row">
            <label for="rot-range">Turn</label>
            <input id="rot-range" type="range" min="0" max="359" step="1" value="${rot}" data-rot aria-valuetext="${rot} degrees">
            <output data-live="rot" for="rot-range">${rot}°</output>
            <button type="button" class="icon-btn" data-act="rotate" aria-label="Turn 90 degrees" title="Turn 90° (R)">${I.rotate}</button>
          </div>`}
          ${p.structure ? "" : fold("tint", `${I.drop}Colour${thing.tint ? ` <span class="tint-dot" style="background:${thing.tint}"></span>` : ""}`, `
            <p class="panel-note">Its main surface takes the colour; metal, glass and lights keep theirs.</p>
            ${palette("tint", thing.tint, CATALOG.FINISH_PALETTES, true)}
            ${thing.tint ? `<button type="button" class="link-btn" data-tint-reset>Back to the shop's colour</button>` : ""}`)}
          ${swaps}
          <div class="inspect-actions">
            <button type="button" class="mini-btn" data-act="duplicate">${I.copy}Duplicate</button>
            <button type="button" class="mini-btn danger" data-act="delete">${I.trash}Remove</button>
          </div>
        </section>`;
      fillThumbs(inspector);
    }
  }
  // A room's ceiling: how high (typed, or a usual height), and the light hanging from it
  const CEILING_HEIGHTS = [2.4, 2.5, 2.6, 2.7, 3.0];
  // Rooms side by side: the wall between them can go, for an open plan (no door needed)
  function openWallRows(room) {
    const mine = sharedWalls(project.rooms).filter((w) => w.a === room || w.b === room);
    if (!mine.length) return "";
    const open = new Set(project.openWalls || []);
    return `<div class="open-walls">${mine.map((w) => {
      const other = w.a === room ? w.b : w.a;
      return `<label class="switch-row"><input type="checkbox" data-open-wall="${esc(w.key)}" ${open.has(w.key) ? "checked" : ""}><span class="switch" aria-hidden="true"></span>
        <span>Open to ${esc(other.name)}<small>${open.has(w.key) ? "No wall between them: one open space" : `Takes away the ${metres(round2(w.len))} wall between the two rooms`}</small></span></label>`;
    }).join("")}</div>`;
  }

  function ceilingFields(room) {
    const H = room.height ?? 2.6, cur = ceilingLight(room), lm = lampLumens(room), k = room.lampWarmth || 2700;
    return `<div class="ceiling-row">
        <div class="app-field"><label for="room-ceiling">Ceiling height</label><div class="unit-input"><input id="room-ceiling" data-field="height" type="number" inputmode="decimal" min="1.8" max="5" step="0.05" value="${H}"><span>m</span></div></div>
        <div class="segmented small ceiling-pick" role="group" aria-label="Usual ceiling heights">${CEILING_HEIGHTS.map((h) =>
          `<button type="button" class="seg-btn" data-ceiling="${h}" aria-pressed="${Math.abs(H - h) < 0.001}">${h.toFixed(1)}</button>`).join("")}</div>
      </div>
      <label class="switch-row"><input type="checkbox" data-lamp ${room.lamp !== false ? "checked" : ""}><span class="switch" aria-hidden="true"></span><span>Ceiling light<small>Hangs in the middle and comes on as the day gets darker</small></span></label>
      ${room.lamp === false ? "" : `
      <div class="finish-list light-list" role="group" aria-label="Which ceiling light">${CEILING_LIGHTS.map((c) =>
        `<button type="button" class="finish" data-lamp-style="${c.key}" aria-pressed="${c.key === cur.key}"><span class="finish-chip"><img src="assets/lights/${c.key}.jpg" alt="" width="200" height="200" loading="lazy" decoding="async"></span><span class="finish-name">${esc(c.name)}</span></button>`).join("")}</div>
      <div class="tone-head"><span class="field-label">Brightness</span>
        <button type="button" class="link-btn" data-lamp-lumens-reset ${Number.isFinite(room.lampLumens) ? "" : "hidden"}>Its own bulbs (${cur.lm} lm)</button></div>
      <div class="rot-row tone-row">
        <label for="lamp-lm">Light</label>
        <input id="lamp-lm" type="range" min="300" max="4000" step="50" value="${lm}" data-lamp-lumens aria-valuetext="${lm} lumens">
        <output data-live="lampLumens" for="lamp-lm">${liveText("lampLumens", room)}</output>
      </div>
      <div class="tone-head"><span class="field-label">Light colour</span><span class="tone-name" data-live="lampWarmthName">${warmthName(k)}</span></div>
      <div class="rot-row tone-row">
        <label for="lamp-k">Warmth</label>
        <input id="lamp-k" class="warmth-range" type="range" min="2200" max="5000" step="100" value="${k}" data-lamp-warmth aria-valuetext="${warmthText(k)}">
        <output data-live="lampWarmth" for="lamp-k">${liveText("lampWarmth", room)}</output>
      </div>`}`;
  }
  // While a ceiling-light slider moves: only that light changes (the whole room isn't rebuilt on every step)
  function lampOnly(room) { if (mode === "3d" && three?.roomLight) three.roomLight(room); else render(); }
  const warmthName = (k) => (k < 2600 ? "Candle warm" : k < 3200 ? "Warm white" : k < 4200 ? "Neutral white" : "Daylight");
  const warmthText = (k) => `${k} K · ${warmthName(k).toLowerCase()}`;
  // A lamp's bulb: the shop's suggestion to start with, any brightness you like
  function lampFields(thing, p) {
    const shop = CATALOG.byId[thing.catalogId];
    if (!shop.lumens) return "";
    return `<div class="size-box" role="group" aria-labelledby="lamp-title">
      <div class="size-head"><span id="lamp-title" class="size-title">${I.bulb}Brightness</span>
        ${Number.isFinite(thing.lumens) ? `<button type="button" class="link-btn" data-lumens-reset>Shop's bulb (${shop.lumens} lm)</button>` : `<span class="size-note">The shop's bulb</span>`}</div>
      <div class="rot-row tone-row">
        <label for="lumens-range">Light</label>
        <input id="lumens-range" type="range" min="100" max="2500" step="25" value="${p.lumens}" data-lumens aria-valuetext="${p.lumens} lumens">
        <output data-live="lumens" for="lumens-range">${liveText("lumens", thing)}</output>
      </div>
      <p class="panel-note">${esc(shop.bulb)}. Lamps light up as the day gets darker.</p>
    </div>`;
  }
  // One piece, several looks: which bottle, which part of the tea set, how many books
  function styleFields(thing, p) {
    const list = CATALOG.byId[thing.catalogId].styles;
    if (!list) return "";
    return `<div class="size-box" role="group" aria-labelledby="style-title">
      <div class="size-head"><span id="style-title" class="size-title">${I.copy}Style</span><span class="size-note">${esc(p.styleName)}</span></div>
      <div class="segmented small shelf-pick">${list.map((st) =>
        `<button type="button" class="seg-btn" data-style="${st.key}" aria-pressed="${st.key === p.style}">${esc(st.name)}</button>`).join("")}</div>
    </div>`;
  }
  // A small thing on a bookcase or shelving: which shelf it stands on (1 = the top)
  function shelfFields(thing) {
    const n = three?.shelvesUnder?.(thing.id) || 0;
    if (n < 2) return "";
    const at = Math.min(thing.level || 0, n - 1);
    return `<div class="size-box" role="group" aria-labelledby="shelf-title">
      <div class="size-head"><span id="shelf-title" class="size-title">${I.ruler}Shelf</span><span class="size-note">${n} shelves, from the top</span></div>
      <div class="segmented small shelf-pick">${Array.from({ length: n }, (_, i) =>
        `<button type="button" class="seg-btn" data-level="${i}" aria-pressed="${i === at}" aria-label="Shelf ${i + 1} of ${n}${i === 0 ? ", the top" : i === n - 1 ? ", the bottom" : ""}">${i === 0 ? "Top" : i === n - 1 ? "Bottom" : i + 1}</button>`).join("")}</div>
    </div>`;
  }
  const shadeText = (v) => !v ? "As scanned" : `${v > 0 ? "Lighter" : "Darker"} ${Math.abs(v)}%`;
  // How high a TV, mirror or picture hangs (cm to its middle): from just above the floor to just under the ceiling
  function hangRange(thing, p) {
    const room = roomAt(project.rooms, thing.x, thing.y) || nearestRoom(project.rooms, thing.x, thing.y);
    const half = Math.ceil(p.h / 2);
    return { min: half + 2, max: Math.max(half + 2, Math.round((room?.height || 2.6) * 100) - half - 2) };
  }
  function hangFields(thing, p) {
    const { min, max } = hangRange(thing, p);
    const shop = CATALOG.byId[thing.catalogId].hangAt || 150;
    return `<div class="size-box" role="group" aria-labelledby="hang-title">
      <div class="size-head"><span id="hang-title" class="size-title">${I.ruler}Height on the wall</span>
        ${Number.isFinite(thing.hangAt) ? `<button type="button" class="link-btn" data-hang-reset>Usual height (${shop} cm)</button>` : `<span class="size-note">To its middle</span>`}</div>
      <div class="rot-row tone-row">
        <label for="hang-range">Height</label>
        <input id="hang-range" type="range" min="${min}" max="${max}" step="1" value="${Math.min(max, Math.max(min, p.hangAt || 150))}" data-hang aria-valuetext="${p.hangAt || 150} centimetres">
        <output data-live="hang" for="hang-range">${p.hangAt || 150} cm</output>
      </div>
    </div>`;
  }
  // Made to measure: rugs and curtains take any size, the rest of the furniture keeps the shop's
  const RUG_SIZES = [[120, 170], [160, 230], [200, 300], [240, 340]];
  function sizeFields(thing, p) {
    const rules = CATALOG.SIZABLE[p.kind];
    if (!rules) return "";
    const shop = CATALOG.byId[thing.catalogId];
    const label = { w: "Width", d: "Length", h: "Drop" };
    const field = (k, name = label[k], both = false) => `<div class="app-field"><label for="size-${k}">${name}</label><div class="unit-input">
      <input id="size-${k}" data-size="${k}" ${both ? "data-both" : ""} type="number" inputmode="numeric" min="${rules[k][0]}" max="${rules[k][1]}" step="5" value="${p[k]}"><span>cm</span></div></div>`;
    const round = p.round && p.kind === "rug";
    const tv = p.kind === "tv" || p.kind === "tv-stand";
    const inch = (w) => Math.round(w / 2.23);       // a 16:9 screen with a slim frame: width (cm) / 2.23 ≈ inches
    const tvPresets = tv ? `<div class="size-presets" role="group" aria-label="Common screen sizes">${[43, 50, 55, 65, 75, 85].map((n) => {
      const w = Math.round(n * 2.23);
      if (w < rules.w[0] || w > rules.w[1]) return "";
      return `<button type="button" class="size-preset" data-tv-size="${w}" aria-pressed="${Math.abs(p.w - w) <= 2}">${n}″</button>`;
    }).join("")}</div>` : "";
    const presets = tv ? tvPresets : p.kind === "rug" && !round ? `<div class="size-presets" role="group" aria-label="Common rug sizes">${RUG_SIZES.map(([a, b]) => {
      const on = Math.min(p.w, p.d) === a && Math.max(p.w, p.d) === b;
      return `<button type="button" class="size-preset" data-preset="${b}x${a}" aria-pressed="${on}">${a} × ${b}</button>`;
    }).join("")}</div>` : "";
    return `<div class="size-box" role="group" aria-labelledby="size-title">
      <div class="size-head"><span id="size-title" class="size-title">${I.ruler}Size</span>
        ${thing.size ? `<button type="button" class="link-btn" data-size-reset>${tv ? `Original size (${inch(shop.w)}″)` : `Shop size (${shop.w} × ${p.kind === "curtains" ? shop.h : shop.d})`}</button>` : `<span class="size-note">${tv ? "Height grows with it" : "Any size you like"}</span>`}</div>
      ${tv ? `<div class="inspect-grid">${field("w", "Width")}<div class="app-field"><span class="field-label">Screen</span><p class="tv-inch"><output data-live="tv-inch">${inch(p.w)}″</output> diagonal</p></div></div>` : round ? field("w", "Diameter", true) : `<div class="inspect-grid">${Object.keys(rules).map((k) => field(k)).join("")}</div>`}
      ${presets}
      ${p.kind === "curtains" ? `<div class="shuffle-row"><button type="button" class="mini-btn" data-fit-window>${I.ruler}Fit to the nearest window</button>
        <span class="size-note">${CATALOG.packs(thing) > 1 ? `${CATALOG.packs(thing)} pairs to cover it` : "One pair covers it"}</span></div>` : ""}
    </div>`;
  }
  function resizePiece(thing, change) {
    const room = roomAt(project.rooms, thing.x, thing.y)?.id;
    if (isCurtain(thing)) thing.fit = false;
    const rules = CATALOG.SIZABLE[CATALOG.byId[thing.catalogId].kind];
    const size = { ...(thing.size || {}) };
    Object.entries(change).forEach(([k, v]) => { size[k] = Math.round(Math.min(rules[k][1], Math.max(rules[k][0], v))); });
    const shop = CATALOG.byId[thing.catalogId];
    if (Object.keys(size).every((k) => size[k] === shop[k])) delete thing.size;   // back to the shop's own size
    else thing.size = size;
    settle(thing, room);
  }

  // Other products that could take this one's place: the same sort of thing
  const SWAP_GROUP = {
    sofa: "seat", armchair: "seat", "wing-chair": "seat", footstool: "seat", bench: "seat", lounger: "seat", bookcase: "storage",
    "coffee-table": "table", table: "table", desk: "table", bistro: "table", island: "table",
    "tv-bench": "storage", chest: "storage", bedside: "storage", wardrobe: "storage", "tall-cabinet": "storage", basket: "storage",
    "floor-lamp": "light", "table-lamp": "light", rug: "rug", plant: "plant", planter: "plant", decor: "decor", candles: "decor", art: "art",
    sideboard: "storage", "kitchen-base": "kitchen", "tall-fridge": "kitchen", fridge: "kitchen",
    "panel-door": "door", "oak-door": "door", "double-door": "door", "steel-door": "door", "sliding-door": "door",
    "french-window": "window", "triple-window": "window", "steel-window": "window", "small-window": "window",
    tv: "tv", "tv-stand": "tv", console: "table", "side-table": "table",
    "ping-pong": "games", billiard: "games", bunk: "bed",
    chair: "chair", stool: "chair", door: "door", "glass-door": "door", window: "window",
  };
  function swapList(p) {
    const group = SWAP_GROUP[p.kind] || p.kind;
    const others = CATALOG.items.filter((q) => q.id !== p.id && (SWAP_GROUP[q.kind] || q.kind) === group);
    if (!others.length) return "";
    return `<details class="fold" data-fold="swap" ${openSections.has("swap") ? "open" : ""}><summary>${I.swap}Swap for something similar <span class="count-soft">${others.length}</span></summary>
      <div class="fold-body"><div class="swap-list">${others.slice(0, 6).map((q) => `<button type="button" class="swap" data-swap="${q.id}"><strong>${esc(q.name)}</strong><span>${q.structure ? `${q.w} × ${q.h} cm` : q.own ? "Own item" : euro(q.price, q.estimate)}</span></button>`).join("")}</div></div></details>`;
  }

  function liveText(what, thing) {
    if (what === "area") return m2(round2(thing.w * thing.h));
    if (what === "pieces") {
      const n = itemsIn(thing).filter((it) => !product(it)?.structure).length;
      return `${n} ${n === 1 ? "piece" : "pieces"}`;
    }
    if (what === "rot") return `${norm(thing.rot || 0)}°`;
    if (what === "lumens") { const lm = product(thing)?.lumens || 0; return `${lm} lm · like a ${Math.round(lm / 13.5 / 5) * 5} W bulb`; }
    if (what === "lampLumens") { const lm = lampLumens(thing); return `${lm} lm`; }
    if (what === "lampWarmth") return `${thing.lampWarmth || 2700} K`;      // short: a longer text would squeeze the slider while it moves
    if (what === "lampWarmthName") return warmthName(thing.lampWarmth || 2700);
    if (what === "hang") return `${product(thing)?.hangAt || 150} cm`;
    if (what === "floorShade") return shadeText(thing.floorShade);
    if (what === "tv-inch") return `${Math.round((product(thing)?.w || 0) / 2.23)}″`;
    return "";
  }

  inspector.addEventListener("toggle", (e) => {
    const key = e.target.dataset?.fold;
    if (!key) return;
    if (!e.target.open) { openSections.delete(key); return; }
    openSections.clear(); openSections.add(key);      // one open at a time, so the card stays short
    inspector.querySelectorAll("details.fold[open]").forEach((d) => { if (d !== e.target) d.open = false; });
  }, true);
  inspector.addEventListener("focusin", (e) => {
    const thing = find(sel);
    if (thing && sel.type === "room" && e.target.matches('[data-field="w"], [data-field="h"]')) {
      fieldStart = { id: thing.id, w: thing.w, h: thing.h, furniture: remember(thing), openings: openingsOf(thing) };
    }
  });
  inspector.addEventListener("input", (e) => {
    const thing = find(sel);
    if (!thing) return;
    if (e.target.matches("[data-custom]")) {          // the colour picker: preview while choosing
      thing[e.target.dataset.custom] = e.target.value;
      render();
      return;
    }
    if (e.target.matches("[data-rot]")) {
      const room = roomAt(project.rooms, thing.x, thing.y)?.id;
      thing.rot = norm(+e.target.value);
      settle(thing, room);
      e.target.setAttribute("aria-valuetext", `${thing.rot} degrees`);
      render(); renderInspector();
      return;
    }
    if (e.target.matches("[data-lumens]")) {        // a brighter or softer bulb: the room follows
      const lm = Math.round(+e.target.value / 25) * 25;
      if (lm === CATALOG.byId[thing.catalogId].lumens) delete thing.lumens; else thing.lumens = lm;
      e.target.setAttribute("aria-valuetext", `${lm} lumens`);
      render(); renderInspector();
      return;
    }
    if (e.target.matches("[data-lamp-lumens]")) {   // the room's ceiling light: brighter or softer
      const lm = Math.round(+e.target.value / 50) * 50;
      if (lm === ceilingLight(thing).lm) delete thing.lampLumens; else thing.lampLumens = lm;
      e.target.setAttribute("aria-valuetext", `${lm} lumens`);
      lampOnly(thing); renderInspector();
      return;
    }
    if (e.target.matches("[data-lamp-warmth]")) {   // from candle-warm to daylight
      const k = Math.round(+e.target.value / 100) * 100;
      if (k === 2700) delete thing.lampWarmth; else thing.lampWarmth = k;
      e.target.setAttribute("aria-valuetext", warmthText(k));
      lampOnly(thing); renderInspector();
      return;
    }
    if (e.target.matches("[data-hang]")) {          // sliding a TV up or down the wall
      const before = thing.hangAt;
      thing.hangAt = Math.round(+e.target.value);
      if (openingClash(project, CATALOG, thing)) {    // would cover a window or door: stay where it was
        if (Number.isFinite(before)) thing.hangAt = before; else delete thing.hangAt;
        e.target.value = product(thing).hangAt || 150;
        toast("It would cover a door or window there.");
      }
      e.target.setAttribute("aria-valuetext", `${product(thing).hangAt} centimetres`);
      render(); renderInspector();
      return;
    }
    if (e.target.matches("[data-floorshade]")) {
      const v = Math.round(+e.target.value);
      if (v) thing.floorShade = v; else delete thing.floorShade;
      e.target.setAttribute("aria-valuetext", shadeText(v));
      render(); renderInspector();
      return;
    }
    if (e.target.matches("[data-size]")) {          // typing a rug's size: the plan follows along
      const v = parseFloat(e.target.value);
      if (!Number.isFinite(v)) return;
      const k = e.target.dataset.size;
      resizePiece(thing, e.target.hasAttribute("data-both") ? { w: v, d: v } : { [k]: v });
      const out = inspector.querySelector('[data-live="tv-inch"]');
      if (out) out.textContent = liveText("tv-inch", thing);
      render();
      return;
    }
    const field = e.target.dataset.field;
    if (!field) return;
    if (field === "name") { thing.name = e.target.value || thing.name; }
    else {
      const v = parseFloat(e.target.value);
      if (!Number.isFinite(v)) return;
      const sizing = field === "w" || field === "h";
      if (sizing && fieldStart?.id !== thing.id) fieldStart = { id: thing.id, w: thing.w, h: thing.h, furniture: remember(thing), openings: openingsOf(thing) };
      thing[field] = field === "height" ? round2(Math.min(5, Math.max(1, v))) : round2(Math.min(60, Math.max(MIN_ROOM, v)));
      if (sizing) Object.assign(thing, roomFits(thing, thing.w, thing.h, fieldStart));
      if (sizing) reflow(thing, fieldStart);
    }
    render(); renderInspector();
  });
  inspector.addEventListener("change", (e) => {
    const thing = find(sel);
    if (e.target.matches("[data-rot], [data-hang], [data-floorshade], [data-lumens], [data-lamp-lumens], [data-lamp-warmth]")) { commit(); if (!e.target.matches("[data-rot]")) renderInspectorFresh(); return; }
    if (e.target.matches("[data-custom]") && thing) {
      const c = e.target.value;
      thing[e.target.dataset.custom] = c;
      recentColors = [c, ...recentColors.filter((x) => x !== c)].slice(0, 6);
      localStorage.setItem("atelier.colors", JSON.stringify(recentColors));
      e.target.blur();
      commit(); render(); renderPanel();
      return;
    }
    if (e.target.matches('[data-field="w"], [data-field="h"]')) fieldStart = null;
    if (e.target.matches("[data-size]") && thing) {
      e.target.value = product(thing)[e.target.dataset.size];   // shows the size it was kept to
      commit(); render(); renderInspectorFresh();                // presets and "Original size" follow
      return;
    }
    if (e.target.matches("[data-open-wall]")) {
      const key = e.target.dataset.openWall, list = new Set(project.openWalls || []);
      e.target.checked ? list.add(key) : list.delete(key);
      project.openWalls = [...list];
      // doors, windows and pictures that were in that wall go with it (Undo brings them back)
      const gone = e.target.checked ? project.items.filter((it) => onOpenWall(project, CATALOG, it)) : [];
      if (gone.length) project.items = project.items.filter((it) => !gone.includes(it));
      commit(); render(); renderInspectorFresh();
      toast(!e.target.checked ? "Wall put back" : gone.length
        ? `Wall taken away, with the ${gone.length === 1 ? product(gone[0]).name.toLowerCase() : `${gone.length} doors, windows and pictures`} in it. Undo brings ${gone.length === 1 ? "it" : "them"} back.`
        : "Wall taken away: the two rooms are one open space", { duration: gone.length ? 3200 : 2000 });
      return;
    }
    if (e.target.matches("[data-lamp]") && thing) { thing.lamp = e.target.checked; commit(); render(); renderInspectorFresh(); return; }
    if (e.target.matches("[data-tv]") && thing) {
      if (e.target.checked) thing.on = true; else delete thing.on;
      commit(); render(); return;
    }
    if (e.target.dataset.field && thing) {
      if (e.target.dataset.field !== "name") e.target.value = thing[e.target.dataset.field];
      else e.target.value = thing.name;
      commit(); renderPanelLists();
    }
  });
  inspector.addEventListener("click", (e) => {
    if (e.target.closest("[data-deselect]")) { select(null); return; }
    e.target.closest("summary")?.parentElement.classList.add("just-opened");
    const floorBtn = e.target.closest("[data-floor]");
    if (floorBtn) { find(sel).floor = floorBtn.dataset.floor; commit(); render(); renderInspector(); return; }
    const wallBtn = e.target.closest("[data-wall]");
    if (wallBtn) { find(sel).wall = wallBtn.dataset.wall; commit(); render(); renderInspector(); return; }
    const swapBtn = e.target.closest("[data-swap]");
    if (swapBtn) {
      const it = find(sel), q = CATALOG.byId[swapBtn.dataset.swap];
      const room = roomAt(project.rooms, it.x, it.y)?.id;
      const before = { ...it };
      if (q.kind !== CATALOG.byId[it.catalogId]?.kind) delete it.size;   // a made-to-measure rug stays that size as another rug
      it.catalogId = q.id;
      if (q.wall) { if (!placeOpening(it)) { Object.assign(it, before); toast(`${q.name} doesn't fit on this wall next to the others.`); return; } }
      else settle(it, room);
      commit(); render(); renderPanel();
      toast(`Swapped for ${q.name}`, { action: "Undo", onAction: undo, duration: 3000 });
      return;
    }
    const tvSize = e.target.closest("[data-tv-size]");
    if (tvSize) {
      resizePiece(find(sel), { w: Number(tvSize.dataset.tvSize) });
      commit(); render(); renderInspector();
      return;
    }
    const preset = e.target.closest("[data-preset]");
    if (preset) {
      const thing = find(sel), [w, d] = preset.dataset.preset.split("x").map(Number);
      resizePiece(thing, { w, d });
      commit(); render(); renderInspector();
      return;
    }
    if (e.target.closest("[data-size-reset]")) {
      const thing = find(sel);
      delete thing.size; if (isCurtain(thing)) thing.fit = false;
      settle(thing, roomAt(project.rooms, thing.x, thing.y)?.id);
      commit(); render(); renderInspector();
      toast("Back to the shop size", { action: "Undo", onAction: undo, duration: 3000 });
      return;
    }
    const tintBtn = e.target.closest("[data-tint]");
    if (tintBtn) { find(sel).tint = tintBtn.dataset.tint; commit(); render(); renderInspector(); return; }
    if (e.target.closest("[data-tint-reset]")) { delete find(sel).tint; commit(); render(); renderInspector(); return; }
    const floorTint = e.target.closest("[data-floortint]");
    if (floorTint) { find(sel).floorTint = floorTint.dataset.floortint; commit(); render(); renderInspector(); return; }
    if (e.target.closest("[data-floor-reset]")) { const r = find(sel); delete r.floorTint; delete r.floorShade; commit(); render(); renderInspector(); return; }
    if (e.target.closest("[data-shuffle]")) { const t = find(sel); t.shuffle = ((t.shuffle || 0) % 999) + 1 + Math.floor(Math.random() * 50); commit(); render(); renderInspector(); return; }
    if (e.target.closest("[data-shuffle-reset]")) { delete find(sel).shuffle; commit(); render(); renderInspector(); return; }
    const ceil = e.target.closest("[data-ceiling]");
    if (ceil) { find(sel).height = +ceil.dataset.ceiling; commit(); render(); renderInspectorFresh(); return; }
    const style = e.target.closest("[data-lamp-style]");
    if (style) { const t = find(sel); t.lampStyle = style.dataset.lampStyle; delete t.lampLumens; commit(); render(); renderInspectorFresh(); return; }
    if (e.target.closest("[data-lamp-lumens-reset]")) { delete find(sel).lampLumens; commit(); render(); renderInspectorFresh(); return; }
    if (e.target.closest("[data-lumens-reset]")) { delete find(sel).lumens; commit(); render(); renderInspector(); return; }
    if (e.target.closest("[data-fit-window]")) {
      const t = find(sel);
      if (!fitToWindow(t)) { toast("Add a window to this room first: the curtains then fit it."); return; }
      settle(t, roomAt(project.rooms, t.x, t.y)?.id); commit(); render(); renderInspector(); return;
    }
    const sty = e.target.closest("[data-style]");
    if (sty) { const t = find(sel), first = CATALOG.byId[t.catalogId].styles?.[0]?.key; if (sty.dataset.style === first) delete t.style; else t.style = sty.dataset.style; commit(); render(); renderInspector(); return; }
    const lvl = e.target.closest("[data-level]");
    if (lvl) { const t = find(sel); if (+lvl.dataset.level) t.level = +lvl.dataset.level; else delete t.level; commit(); render(); renderInspector(); return; }
    if (e.target.closest("[data-hang-reset]")) { delete find(sel).hangAt; commit(); render(); renderInspector(); return; }
    const swatch = e.target.closest("[data-color]");
    if (swatch) { find(sel).color = swatch.dataset.color; commit(); render(); renderPanel(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "rotate") rotateSelected();
    if (act === "duplicate") duplicateSelected();
    if (act === "delete") removeSelected();
    if (act === "furnish") { tab = "add"; renderPanel(); }
  });

  // Tabs
  // Furniture filters: 4 groups, and inside a group the categories it holds (short names)
  const CAT_GROUPS = [
    { key: "All", label: "All", cats: [] },
    { key: "Furniture", label: "Furniture", cats: [["Living room", "Living"], ["Kitchen & dining", "Kitchen"], ["Bedroom", "Bedroom"], ["Bathroom", "Bathroom"], ["Outdoor", "Outdoor"]] },
    { key: "Decor", label: "Decor", cats: [["Rugs", "Rugs"], ["Plants", "Plants"], ["Lamps & textiles", "Lamps"], ["Small decor", "Accessories"], ["Wall art", "Wall art"]] },
    { key: "Openings", label: "Doors & windows", cats: [["Doors & windows", "Doors & windows"]] },
  ];
  const catalogState = { q: "", group: "All", cat: "All" };     // cat "All" = the whole group
  const inGroup = (p) => {
    const g = CAT_GROUPS.find((x) => x.key === catalogState.group);
    if (!g || !g.cats.length) return true;
    if (catalogState.cat !== "All") return p.cat === catalogState.cat;
    return g.cats.some(([c]) => c === p.cat);
  };
  document.querySelectorAll(".panel-tab").forEach((t) => t.addEventListener("click", () => { tab = t.dataset.tab; renderPanel(); }));
  document.querySelector(".panel-tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
    const tabs = [...document.querySelectorAll(".panel-tab")];
    const i = tabs.findIndex((t) => t.dataset.tab === tab);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    tab = next.dataset.tab; renderPanel(); next.focus();
  });

  function renderPanel() {
    document.querySelectorAll(".panel-tab").forEach((t) => {
      const on = t.dataset.tab === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    document.getElementById("panel-body").setAttribute("aria-labelledby", `tab-${tab}`);
    document.getElementById("shop-count").textContent = project.items.filter((it) => product(it) && !product(it).structure && !product(it).own).length;
    renderInspector();
    renderPanelLists();
  }

  function renderPanelLists() {
    if (tab === "rooms") renderRoomsTab();
    if (tab === "add") renderCatalogTab();
    if (tab === "shop") renderShopTab();
  }

  function renderRoomsTab() {
    const total = project.rooms.reduce((s, r) => s + r.w * r.h, 0);
    tabContent.innerHTML = `
      <section class="panel-section">
        <h2 class="panel-title"><span>Rooms · ${project.rooms.length}</span><span>${m2(round2(total))}</span></h2>
        <div class="list">
          ${project.rooms.map((r) => `
            <button type="button" class="list-row${sel?.type === "room" && sel.id === r.id ? " is-selected" : ""}" data-pick-room="${r.id}">
              <span class="chip" style="background:${r.color}" aria-hidden="true"></span>
              <span class="row-main"><strong>${esc(r.name)}</strong><small>${metres(r.w)} × ${metres(r.h)} · ${CATALOG.FLOORS[r.floor]?.label || ""}</small></span>
              <span class="row-end">${m2(round2(r.w * r.h))}</span>
            </button>`).join("") || `<p class="panel-note">No rooms yet. Draw one on the plan, or add one below.</p>`}
        </div>
        <div class="inspect-actions" style="margin-top:.7rem">
          <button type="button" class="mini-btn primary" data-start-draw>${I.draw}Draw a room</button>
          <button type="button" class="mini-btn" data-quick-room>${I.plus}4 × 3 m room</button>
        </div>
      </section>
      ${materialsSection()}`;
  }

  // What to buy besides furniture: paint per colour, ceiling white, floors, skirting
  const PY_BADGE = `<span class="py-badge" title="Worked out by tools/materials.py, running in your browser"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7l-5 5 5 5 M16 7l5 5-5 5"/></svg>Python</span>`;
  function materialsSection() {
    if (!project.rooms.length) return "";
    if (!measureOn) {
      return `<section class="panel-section">
        <h2 class="panel-title mat-head"><span>Materials</span>${PY_BADGE}</h2>
        <p class="panel-note">Room sizes on the 3D plan, plus how much paint, flooring and skirting to buy.</p>
        <div class="inspect-actions" style="margin-top:.6rem"><button type="button" class="mini-btn" data-measure-on>${I.ruler}Measure rooms</button></div>
      </section>`;
    }
    if (materialsState === "loading" || (materialsState !== "error" && !materials)) {
      return `<section class="panel-section">
        <h2 class="panel-title mat-head"><span>Materials</span>${PY_BADGE}</h2>
        <div class="mat-loading" role="status"><span class="mat-spin" aria-hidden="true"></span>Starting Python… the first time takes a few seconds</div>
      </section>`;
    }
    if (materialsState === "error") {
      return `<section class="panel-section">
        <h2 class="panel-title mat-head"><span>Materials</span>${PY_BADGE}</h2>
        <p class="panel-note">Python couldn't start (it needs an internet connection the first time).</p>
        <div class="inspect-actions" style="margin-top:.6rem"><button type="button" class="mini-btn" data-measure-on>Try again</button></div>
      </section>`;
    }
    const t = materials.totals;
    const floorColor = (name) => Object.values(CATALOG.FLOORS).find((f) => f.label === name)?.color || "#c9b8a2";
    const row = (dot, title, sub, qty, qtySub) => `
      <div class="mat-row">${dot}
        <span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
        <span class="mat-qty">${esc(qty)}<small>${esc(qtySub)}</small></span>
      </div>`;
    const rows = [
      ...t.paints.map((p) => row(`<i class="rm-dot" style="background:${esc(p.colour)}"></i>`, `${p.name} paint`, `${p.rooms.join(", ")} · ${p.type.toLowerCase()}`, `${p.litres} L`, p.cans_text)),
      t.ceiling_litres ? row(`<i class="rm-dot" style="background:#ffffff"></i>`, "Ceiling white", "Every room indoors", `${t.ceiling_litres} L`, t.ceiling_cans_text) : "",
      ...t.floors.map((f) => row(`<i class="rm-dot is-floor" style="background:${esc(floorColor(f.name))}"></i>`, `${f.kind} · ${f.name}`, f.rooms.join(", "), `${f.boxes} boxes`, `${f.area.toFixed(1)} m² with cuts`)),
      t.skirting_boards ? row(`<i class="rm-dot is-floor" style="background:var(--color-border-strong)"></i>`, "Skirting boards", "Around the rooms, doors left out", `${t.skirting_boards}`, "boards of 2.4 m") : "",
    ].join("");
    return `<section class="panel-section">
      <h2 class="panel-title mat-head"><span>Materials · ${m2(round2(t.floor_area))}</span>${PY_BADGE}</h2>
      <div class="mat-list">${rows}</div>
      <p class="panel-note" style="margin-top:.6rem">Worked out in Python (tools/materials.py) from your plan: walls minus doors and windows, 2 coats at 10 m² per litre, extra flooring for cuts. Sizes are shown on the 3D plan.</p>
      <div class="inspect-actions" style="margin-top:.5rem"><button type="button" class="mini-btn" data-measure-off>Hide measurements</button></div>
    </section>`;
  }

  // Second row, only for groups with more than one category: "All rooms · Living · Kitchen …"
  function subChips() {
    const g = CAT_GROUPS.find((x) => x.key === catalogState.group);
    if (!g || g.cats.length < 2) return "";
    const count = (c) => CATALOG.items.filter((p) => p.cat === c).length;
    const all = g.key === "Furniture" ? "All rooms" : "All decor";
    const chip = (value, label, n) => `<button type="button" class="cat-chip" data-cat="${esc(value)}" aria-pressed="${value === catalogState.cat}">${esc(label)}${n ? `<span class="cat-count">${n}</span>` : ""}</button>`;
    return `<div class="cat-chips" role="group" aria-label="${esc(g.label)}">
      ${chip("All", all, 0)}${g.cats.map(([c, short]) => chip(c, short, count(c))).join("")}
    </div>`;
  }

  function renderCatalogTab() {
    const q = catalogState.q.trim().toLowerCase();
    const items = CATALOG.items
      .filter(inGroup)
      .filter((p) => !q || `${p.name} ${p.product} ${p.cat} ${I18N.t(p.name)} ${I18N.t(p.product)} ${I18N.t(p.cat)}`.toLowerCase().includes(q))   // French words find things too
      .sort((a, b) => (a.structure ? 1 : 0) - (b.structure ? 1 : 0) || (a.own ? 1 : 0) - (b.own ? 1 : 0) || a.price - b.price);
    const target = sel?.type === "room" ? find(sel) : sel?.type === "item" ? roomAt(project.rooms, find(sel)?.x, find(sel)?.y) : project.rooms[0];
    // Same cards as on screen already (after adding or picking something): only the "adds to" line changes
    const sig = JSON.stringify([q, catalogState.group, catalogState.cat, items.length, !!target]);
    const shown = tabContent.querySelector(".catalog-head");
    if (shown && tabContent.dataset.catalog === sig) {
      const to = tabContent.querySelector(".adds-to strong");
      if (to && target) to.textContent = target.name;
      return;
    }
    tabContent.dataset.catalog = sig;
    const hadFocus = document.activeElement?.id === "catalog-q";
    const card = (p) => `
            <button type="button" class="product-card" data-add="${p.id}" title="${esc(p.product)}${p.structure ? "" : ` · ${p.w} × ${p.d} cm · ${esc(p.store)}`}" aria-label="Add ${esc(p.name)}, ${p.structure ? "included" : p.own ? "own item" : euro(p.price, p.estimate)}">
              <span class="product-thumb"><img data-thumb="${p.id}" alt="" draggable="false" loading="lazy"></span>
              <span class="product-name">${esc(p.name)}</span>
              <span class="product-meta">${p.structure ? `${p.w} × ${p.h} cm` : p.own ? "Own item" : euro(p.price, p.estimate)}</span>
              <span class="product-add" aria-hidden="true">${I.plus}</span>
            </button>`;
    // No search and no single category picked: a short shelf per category, so nothing is 200 cards down
    const g = CAT_GROUPS.find((x) => x.key === catalogState.group);
    const shelves = !q && catalogState.cat === "All" && catalogState.group !== "Openings";
    const cats = catalogState.group === "All" ? [...CAT_GROUPS.flatMap((x) => x.cats), ["Doors & windows"]].filter((c, i, a) => a.findIndex((d) => d[0] === c[0]) === i) : g?.cats || [];
    const body = shelves ? cats.map(([c]) => {
      const list = items.filter((p) => p.cat === c);
      if (!list.length) return "";
      return `<div class="cat-shelf">
          <h3 class="cat-shelf-title"><span>${esc(c)}</span>${list.length > 4 ? `<button type="button" class="see-all" data-see-cat="${esc(c)}">See all ${list.length}<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>` : ""}</h3>
          <div class="catalog-grid">${list.slice(0, 4).map(card).join("")}</div>
        </div>`;
    }).join("") : `<div class="catalog-grid">${items.map(card).join("") || `<p class="panel-note">Nothing matches “${esc(catalogState.q)}”.</p>`}</div>`;
    tabContent.innerHTML = `
      <section class="panel-section">
        <div class="catalog-head">
        <div class="catalog-search">${I.search}<label for="catalog-q" class="sr-only">Search furniture</label>
          <input id="catalog-q" type="search" placeholder="Search sofa, bed, plant…" value="${esc(catalogState.q)}" autocomplete="off"></div>
        <div class="cat-groups" role="group" aria-label="Show">
          ${CAT_GROUPS.map((g) => `<button type="button" class="cat-group" data-group="${g.key}" aria-pressed="${g.key === catalogState.group}">${esc(g.label)}</button>`).join("")}
        </div>
        ${subChips()}
        </div>
        ${target ? `<p class="adds-to">Click to add to <strong>${esc(target.name)}</strong>, or drag onto the plan</p>` : ""}
        ${body}
      </section>`;
    fillThumbs(tabContent);
    if (hadFocus) {
      const input = document.getElementById("catalog-q");
      input.focus(); input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function renderShopTab() {
    const list = Projects.shoppingList(project).sort((a, b) => b.total - a.total);
    const total = list.reduce((s, g) => s + g.total, 0);
    const stores = {};
    list.forEach((g) => { (stores[g.product.store] ||= []).push(g); });
    tabContent.innerHTML = list.length ? `
      <section class="panel-section">
        <div class="budget-card"><span>Total for this home</span><strong>${euro(round2(total), list.some((g) => g.product.estimate))}</strong>
          <div class="budget-split">${list.reduce((n, g) => n + g.qty, 0)} pieces from ${Object.keys(stores).length} ${Object.keys(stores).length === 1 ? "store" : "stores"}</div></div>
        ${Object.entries(stores).map(([store, rows]) => `
          <h2 class="panel-title store-title"><span>${esc(store)}</span><span>${euro(round2(rows.reduce((s, g) => s + g.total, 0)), rows.some((g) => g.product.estimate))}</span></h2>
          <div class="list">
            ${rows.map((g) => `
              <div class="list-row shop-row" data-pick-item="${g.ids[0]}" role="button" tabindex="0" aria-label="Show ${esc(g.product.name)} in the plan">
                <span class="shop-thumb"><img data-thumb="${g.product.id}" alt=""></span>
                <span class="row-main"><strong>${g.qty > 1 ? `${g.qty} × ` : ""}${esc(g.product.name)}</strong>
                  <small>${esc(g.product.product)}</small></span>
                <span class="row-end">${euro(round2(g.total), g.product.estimate)}<a href="${g.product.url}" target="_blank" rel="noopener" aria-label="${g.product.notHere ? `Search for ${esc(g.product.name)} at ${esc(store)}` : `Open ${esc(g.product.name)} at ${esc(store)}`}" data-fr="${g.product.notHere ? "Chercher" : "Voir"}">${g.product.notHere ? "Search" : "View"}</a></span>
              </div>`).join("")}
          </div>`).join("")}
        <div class="inspect-actions" style="margin-top:.8rem">
          <button type="button" class="mini-btn" data-copy-list>${I.copy}Copy list</button>
          <button type="button" class="mini-btn" data-download-list>${I.download}Download PDF</button>
          <button type="button" class="mini-btn" data-export-project title="Rooms, pieces and prices, for the Python tools in tools/">${I.download}Project file</button>
          <a class="mini-btn" href="projects.html#shopping">Full list on My projects</a>
        </div>
        <p class="panel-note" style="margin-top:.6rem">Prices from ikea.com/fr and leroymerlin.fr, checked November 2026.</p>
      </section>` : `
      <section class="panel-section"><p class="panel-note">Your shopping list fills up as you add furniture. Each piece shows its price and where to buy it.</p>
        <div class="inspect-actions" style="margin-top:.6rem"><button type="button" class="mini-btn primary" data-go-add>${I.plus}Add furniture</button></div></section>`;
    fillThumbs(tabContent);
  }

  // Pointer on "Download PDF": start drawing the product pictures for it
  tabContent.addEventListener("pointerover", (e) => { if (e.target.closest("[data-download-list]")) ShoppingPDF.warm(project); });
  tabContent.addEventListener("input", (e) => {
    if (e.target.id === "catalog-q") { catalogState.q = e.target.value; renderCatalogTab(); }
  });
  tabContent.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const room = e.target.closest("[data-pick-room]");
    if (room) { select({ type: "room", id: room.dataset.pickRoom }); focusOn(find(sel)); return; }
    const item = e.target.closest("[data-pick-item]");
    if (item) { select({ type: "item", id: item.dataset.pickItem }); focusOn(find(sel)); return; }
    const cat = e.target.closest("[data-cat]");
    if (cat) { catalogState.cat = cat.dataset.cat; renderCatalogTab(); tabContent.querySelector(`[data-cat="${CSS.escape(catalogState.cat)}"]`)?.focus(); return; }
    const group = e.target.closest("[data-group]");
    if (group) { catalogState.group = group.dataset.group; catalogState.cat = "All"; renderCatalogTab(); tabContent.querySelector(`[data-group="${group.dataset.group}"]`)?.focus(); return; }
    const see = e.target.closest("[data-see-cat]");
    if (see) {
      const c = see.dataset.seeCat;
      catalogState.group = CAT_GROUPS.find((x) => x.cats.some(([k]) => k === c))?.key || "All";
      catalogState.cat = c; renderCatalogTab();
      tabContent.querySelector(".catalog-head")?.scrollIntoView({ block: "start" });
      tabContent.querySelector(`[data-cat="${CSS.escape(c)}"]`)?.focus({ preventScroll: true });
      return;
    }
    const add = e.target.closest("[data-add]");
    if (add) { if (!justDropped) addItem(add.dataset.add); return; }
    if (e.target.closest("[data-go-add]")) { tab = "add"; renderPanel(); return; }
    if (e.target.closest("[data-measure-on]")) { setMeasure(true); if (mode !== "3d" && three) setMode("3d"); return; }
    if (e.target.closest("[data-measure-off]")) { setMeasure(false); return; }
    const pdfBtn = e.target.closest("[data-download-list]");
    if (pdfBtn) { ShoppingPDF.download(project, pdfBtn); return; }
    if (e.target.closest("[data-export-project]")) { Projects.downloadProject(project); toast("Project file saved to your downloads", { duration: 2500 }); return; }
    if (e.target.closest("[data-copy-list]")) {
      const lines = Projects.shoppingList(project).map((g) => `${g.qty} × ${g.product.product} (${g.product.store}) — ${euro(round2(g.total), g.product.estimate)} — ${g.product.url}`);
      lines.push(`Total: ${euro(round2(Projects.budget(project)), Projects.shoppingList(project).some((g) => g.product.estimate))}`);
      navigator.clipboard?.writeText(`${project.name}\n\n${lines.join("\n")}`).then(() => toast("Shopping list copied"), () => toast("Couldn't copy. Select the list by hand instead."));
    }
  });
  tabContent.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-pick-item]")) { e.preventDefault(); e.target.click(); }
  });

  // Bring something into view if it is off screen (2D)
  function focusOn(thing) {
    if (!thing || mode === "3d") return;
    const r = svg.getBoundingClientRect();
    const cx = sel.type === "room" ? thing.x + thing.w / 2 : thing.x;
    const cy = sel.type === "room" ? thing.y + thing.h / 2 : thing.y;
    const px = (cx - view.x) * view.s, py = (cy - view.y) * view.s;
    if (px < 40 || py < 40 || px > r.width - 40 || py > r.height - 40) {
      view.x = cx - r.width / 2 / view.s; view.y = cy - r.height / 2 / view.s;
      render();
    }
  }

  // ---------- Drag a product from the panel onto the plan (mouse and pen; a tap still adds it) ----------
  let cardDrag = null, justDropped = false;
  const stageEl = () => (mode === "3d" ? document.getElementById("view3d") : svg);
  function dropPoint(e) {
    const el = stageEl(), r = el.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (!hit || !(el === hit || el.contains(hit))) return null;       // not over a toolbar or the panel
    return mode === "3d" ? three?.floorAt(e.clientX, e.clientY) || null : (({ x, y }) => ({ x: round2(x), y: round2(y) }))(toWorld(e));
  }
  // While a product is dragged over the plan, the piece itself stands where it would land (not saved, not in the history)
  let preview = null, previewFrame = 0;
  function dropPreview(draw = true) {
    cancelAnimationFrame(previewFrame); previewFrame = 0;
    if (!preview) return;
    const i = project.items.indexOf(preview);
    if (i >= 0) project.items.splice(i, 1);
    preview = null;
    if (draw) render();
  }
  function showPreview(id, at) {
    dropPreview(false);
    const planned = at && planItem(id, at, true);
    if (planned) { preview = { ...planned.it, id: "drag-preview" }; project.items.push(preview); }
    render();
    return !!planned;
  }
  function endCardDrag() {
    if (!cardDrag) return;
    dropPreview();
    cardDrag.ghost?.remove();
    document.body.classList.remove("is-dragging-product");
    stageEl().classList.remove("is-drop-target");
    cardDrag = null;
  }
  document.addEventListener("dragstart", (e) => { if (e.target.closest?.(".product-card")) e.preventDefault(); });
  document.addEventListener("pointerdown", (e) => {
    const card = e.target.closest?.(".product-card[data-add]");
    if (!card || e.button !== 0 || e.pointerType === "touch") return;
    cardDrag = { id: card.dataset.add, card, x: e.clientX, y: e.clientY, ghost: null };
  });
  window.addEventListener("pointermove", (e) => {
    if (!cardDrag) return;
    if (!cardDrag.ghost) {
      if (Math.hypot(e.clientX - cardDrag.x, e.clientY - cardDrag.y) < 6) return;
      const p = CATALOG.byId[cardDrag.id], src = cardDrag.card.querySelector("img")?.src;
      const g = document.createElement("div");
      g.className = "drag-ghost";
      g.innerHTML = `${src ? `<img src="${src}" alt="">` : ""}<span>${esc(p.name)}</span>`;
      document.body.append(g);
      document.body.classList.add("is-dragging-product");
      cardDrag.ghost = g;
    }
    const at = dropPoint(e);
    cardDrag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    cardDrag.ghost.classList.toggle("can-drop", !!at);
    stageEl().classList.toggle("is-drop-target", !!at);
    if (!previewFrame) {                          // once a frame: where the piece would land, drawn in the plan itself
      const id = cardDrag.id;
      previewFrame = requestAnimationFrame(() => {
        previewFrame = 0;
        if (!cardDrag) return;
        const shown = showPreview(id, dropPoint(e));
        cardDrag.ghost?.classList.toggle("is-placed", shown);   // the card picture only while over the panel
      });
    }
  });
  window.addEventListener("pointerup", (e) => {
    if (!cardDrag) return;
    const { id, ghost } = cardDrag;
    const at = ghost && dropPoint(e);
    endCardDrag();                               // the preview goes first: it would stand in the way of the real one
    if (!ghost) return;                          // it was a click: the click handler adds it
    justDropped = true;
    setTimeout(() => { justDropped = false; }, 0);
    if (at) addItem(id, at);
  });
  window.addEventListener("pointercancel", endCardDrag);
  window.addEventListener("blur", endCardDrag);

  // ---------- 3D view ----------
  const view3d = document.getElementById("view3d");
  try {
    three = createPlanner3D(view3d, {
      getProject: () => project,
      catalog: CATALOG,
      getSnap: () => snapOn,
      onSelect: (next) => { sel = next; three.select(sel); renderPanel(); },
      onMove: () => renderInspector(),
      onBlocked: (why) => blocked(why),
      onCommit: () => { commit(); renderPanel(); },
      onFrame: () => { if (mode === "3d") placeSelBar(); },
    });
    three.setLight(project.light, 0);
  } catch (err) {
    console.error(err);
    three = null;
    mode = "2d";
    document.querySelector('[data-mode="3d"]').disabled = true;
    toast("3D isn't available in this browser, so you're seeing the 2D plan.", { duration: 6000 });
  }

  function setMode(next, remember = true) {
    if (next === "3d" && !three) return;
    if (next === "3d" && tool !== "select") {
      tool = "select"; scaleLine = null; scaleAsk.hidden = true;
      document.getElementById("canvas-hint").hidden = true; svg.classList.remove("is-drawing", "is-moving-plan");
      document.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === "select")));
      syncSpacePill();
    }
    if (next === "3d") closeTrace();
    mode = next;
    if (remember) localStorage.setItem("atelier.view", mode);
    wrap.dataset.mode = mode;
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    svg.hidden = mode !== "2d";
    view3d.hidden = mode !== "3d";
    if (mode !== "3d") closeLight();
    document.getElementById("hint3d").hidden = mode !== "3d" || localStorage.getItem("atelier.hint3d") === "seen";
    render();
    if (mode === "3d") { three.resize(); three.view("3d", 0); } else fit();
    placeSelBar();
  }
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelectorAll("[data-cam]").forEach((b) => b.addEventListener("click", () => three?.view(b.dataset.cam)));
  view3d.addEventListener("pointerdown", () => {
    document.getElementById("hint3d").hidden = true;
    localStorage.setItem("atelier.hint3d", "seen");
  }, { once: true });

  const WALL_MODES = { auto: ["up", "Walls: up"], up: ["down", "Walls: down"], down: ["auto", "Walls: cut"] };
  document.getElementById("walls-btn").addEventListener("click", () => {
    const [next, label] = WALL_MODES[three.walls];
    three.setWalls(next);
    document.getElementById("walls-label").textContent = label;
    document.getElementById("walls-btn").setAttribute("aria-label", label);
    toast(next === "auto" ? "Walls in front of you are lowered, like a doll's house" : next === "up" ? "All walls are up" : "All walls are lowered", { duration: 2200 });
  });
  // ---------- Measure: room sizes on the 3D plan, and paint, flooring and skirting ----------
  // The numbers come from tools/materials.py, run in this page by Python (js/python.js)
  const measureBtn = document.getElementById("measure-btn");
  async function recalcMaterials() {
    if (!measureOn) return;
    const run = ++measureRun;
    if (!AtelierPython.ready && materialsState !== "loading") {
      materialsState = "loading";
      if (tab === "rooms") renderRoomsTab();
    }
    try {
      const result = await AtelierPython.materials(Projects.exportData(project));
      if (run !== measureRun || !measureOn) return;
      materials = result;
      materialsState = "ready";
      three?.setMeasurements(result);
    } catch (err) {
      if (run !== measureRun) return;
      console.error(err);
      materials = null;
      materialsState = "error";
      three?.setMeasurements(null);
      toast(err?.message?.includes("online") ? err.message : "Couldn't start Python for the measurements.", { duration: 5000 });
    }
    if (tab === "rooms") renderRoomsTab();
  }
  function scheduleMaterials() {
    if (!measureOn) return;
    clearTimeout(measureTimer);
    measureTimer = setTimeout(recalcMaterials, 250);
  }
  function setMeasure(on, announce = true) {
    measureOn = on;
    localStorage.setItem("atelier.measure", on ? "on" : "off");
    measureBtn?.setAttribute("aria-pressed", String(on));
    if (on) {
      if (announce) toast(AtelierPython.ready ? "Measuring rooms and materials" : "Starting Python to measure your rooms…", { duration: 3000 });
      recalcMaterials();
    } else {
      measureRun++;
      materials = null;
      materialsState = "off";
      three?.setMeasurements(null);
    }
    if (tab === "rooms") renderRoomsTab();
  }
  measureBtn?.addEventListener("click", () => setMeasure(!measureOn));
  if (measureOn) setMeasure(true, false);

  document.getElementById("photo-btn").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = three.screenshot();
    a.download = `${project.name.replace(/[^\w\- ]+/g, "").trim() || "atelier"} 3D.png`;
    a.click();
    toast("Picture saved to your downloads", { duration: 2500 });
  });

  // ---------- Light & sun ----------
  const lightPop = document.getElementById("light-pop");
  const lightBtn = document.getElementById("light-btn");
  const timeRange = document.getElementById("time-range");
  const dirRange = document.getElementById("dir-range");
  const clock = (t) => { const all = Math.round(t * 60), h = Math.floor(all / 60) % 24, m = all % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; };
  const COMPASS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"];
  const compass = (d) => COMPASS[Math.round(norm(d) / 45) % 8];
  function syncLightUI() {
    const L = project.light;
    timeRange.value = Math.round(L.time * 6) * 10; dirRange.value = L.dir;   // the slider counts minutes, in 10-minute steps
    document.getElementById("time-out").textContent = clock(L.time);
    document.getElementById("dir-out").textContent = `From the ${compass(L.dir)}`;
    timeRange.setAttribute("aria-valuetext", clock(L.time));
    document.querySelectorAll("[data-lamps]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lamps === L.lamps)));
    const nearest = Object.entries(LIGHT_PRESETS).find(([, t]) => Math.abs(t - L.time) < 0.01)?.[0];
    document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === nearest)));
    document.getElementById("light-label").textContent = clock(L.time);
  }
  function changeLight(next, ms) {
    Object.assign(project.light, next);
    three?.setLight(project.light, ms);
    syncLightUI();
    scheduleSave();
  }
  function closeLight() { lightPop.hidden = true; lightBtn.setAttribute("aria-expanded", "false"); }
  function toggleLight() {
    lightPop.hidden = !lightPop.hidden;
    lightBtn.setAttribute("aria-expanded", String(!lightPop.hidden));
    if (!lightPop.hidden) lightPop.querySelector('[aria-pressed="true"], button')?.focus();
  }
  lightBtn.addEventListener("click", toggleLight);
  lightPop.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-pop]")) { closeLight(); lightBtn.focus(); return; }
    const preset = e.target.closest("[data-preset]");
    if (preset) { changeLight({ time: LIGHT_PRESETS[preset.dataset.preset] }, 1100); commit(); return; }
    const lamps = e.target.closest("[data-lamps]");
    if (lamps) { changeLight({ lamps: lamps.dataset.lamps }, 0); commit(); }
  });
  timeRange.addEventListener("input", () => changeLight({ time: +timeRange.value / 60 }, 320));
  dirRange.addEventListener("input", () => changeLight({ dir: +dirRange.value }, 0));
  timeRange.addEventListener("change", commit);
  dirRange.addEventListener("change", commit);
  document.addEventListener("pointerdown", (e) => {
    if (!lightPop.hidden && !e.target.closest("#light-pop, #light-btn")) closeLight();
  });
  syncLightUI();

  document.getElementById("keys-btn").addEventListener("click", () => document.getElementById("keys-dialog").showModal());

  // ---------- Popovers that come and go together: share, trace, space check ----------
  const sharePop = document.getElementById("share-pop");
  const shareBtn = document.getElementById("share-btn");
  const tracePop = document.getElementById("trace-pop");
  const traceBtn = document.getElementById("trace-btn");
  const spacePop = document.getElementById("space-pop");
  const spacePill = document.getElementById("space-pill");
  const POPS = [[sharePop, shareBtn], [tracePop, traceBtn], [spacePop, spacePill]];
  function closePops(except) {
    POPS.forEach(([pop, btn]) => { if (pop !== except && !pop.hidden) { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); } });
    if (except && !lightPop.hidden) closeLight();
  }
  function openPop(pop, btn) {
    closePops(pop);
    pop.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function closeTrace() { if (!tracePop.hidden) { tracePop.hidden = true; traceBtn.setAttribute("aria-expanded", "false"); } }
  // Esc: close what's open, or stop a plan-picture tool. True when it did something.
  function closeExtras() {
    const open = POPS.find(([pop]) => !pop.hidden);
    if (open) { open[0].hidden = true; open[1].setAttribute("aria-expanded", "false"); open[1].focus(); return true; }
    if (!scaleAsk.hidden || tool === "scale" || tool === "move-plan") { setTool("select"); return true; }
    return false;
  }
  POPS.forEach(([pop, btn]) => pop.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-pop]")) { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus(); }
  }));
  document.addEventListener("pointerdown", (e) => {
    POPS.forEach(([pop, btn]) => {
      if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    });
  });
  lightBtn.addEventListener("click", () => closePops());

  // ---------- Share: a view-only link that holds the whole plan ----------
  const shareUrl = document.getElementById("share-url");
  const shareCopy = document.getElementById("share-copy");
  const shareOpen = document.getElementById("share-open");
  shareBtn.addEventListener("click", async () => {
    if (!sharePop.hidden) { closePops(); return; }
    openPop(sharePop, shareBtn);
    shareUrl.value = "Making the link…";
    shareCopy.disabled = true;
    try {
      const url = await Share.link(project);
      shareUrl.value = url; shareOpen.href = url;
      shareCopy.disabled = false;
      shareCopy.focus();
    } catch (err) {
      console.error(err);
      shareUrl.value = "This browser couldn't make the link.";
    }
  });
  shareUrl.addEventListener("focus", () => shareUrl.select());
  let copiedTimer = 0;
  shareCopy.addEventListener("click", async () => {
    const label = shareCopy.querySelector("span");
    try {
      await navigator.clipboard.writeText(shareUrl.value);
      label.textContent = "Copied";
      shareCopy.classList.add("is-done");
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => { label.textContent = "Copy"; shareCopy.classList.remove("is-done"); }, 1800);
      toast("Link copied. Paste it anywhere to share your home.", { duration: 2200 });
    } catch {
      shareUrl.focus(); shareUrl.select();
      toast("Press Ctrl+C to copy the link", { duration: 2200 });
    }
  });

  // ---------- Trace: a picture of the floor plan under the rooms ----------
  const traceLayer = document.getElementById("trace-layer");
  const traceImg = document.getElementById("trace-img");
  const traceBody = document.getElementById("trace-body");
  const traceFile = document.getElementById("trace-file");
  const scaleAsk = document.getElementById("scale-ask");
  const scaleLen = document.getElementById("scale-len");
  let traceURL = null;
  let scaleLine = null;      // { x0, y0, x1, y1, waiting } in metres, while setting the scale

  function renderTrace() {
    const t = project.trace;
    const show = !!(t && traceURL && !t.hidden && mode === "2d");
    traceLayer.toggleAttribute("hidden", !show);
    svg.classList.toggle("has-trace", show);
    traceBtn.classList.toggle("has-dot", !!t);
    if (!show) return;
    traceLayer.setAttribute("transform", `translate(${-view.x * view.s} ${-view.y * view.s}) scale(${view.s})`);
    if (traceImg.getAttribute("href") !== traceURL) traceImg.setAttribute("href", traceURL);
    traceImg.setAttribute("x", t.x); traceImg.setAttribute("y", t.y);
    traceImg.setAttribute("width", t.w); traceImg.setAttribute("height", t.w * t.aspect);
    traceImg.setAttribute("opacity", t.opacity);
  }

  const TI = {
    pick: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 15.5l5-4.5 4 3.5 2.5-2 5.5 4.5"/><circle cx="15.5" cy="9" r="1.6"/></svg>',
    ruler: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15.5 15.5 3l5.5 5.5L8.5 21z M7 11.5l2 2 M10 8.5l2 2 M13 5.5l2 2"/></svg>',
    move: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18 M3 12h18 M12 3l-3 3 M12 3l3 3 M12 21l-3-3 M12 21l3-3 M3 12l3-3 M3 12l3 3 M21 12l-3-3 M21 12l-3 3"/></svg>',
  };
  function renderTracePop() {
    const t = project.trace;
    if (!t) {
      traceBody.innerHTML = `
        <p class="pop-note">A photo or scan of your floor plan, from the agent or the builder. Mark one length you know, then draw the rooms on top.</p>
        <button type="button" class="trace-drop" data-trace-pick>${TI.pick}<strong>Choose a picture</strong><small>JPG or PNG · or drop it here</small></button>`;
      return;
    }
    traceBody.innerHTML = `
      <div class="trace-status${t.scaled ? " is-ok" : ""}"><span class="trace-dot" aria-hidden="true"></span>
        <span><strong>${t.scaled ? "To scale" : "Not to scale yet"}</strong><small>${t.scaled ? `The picture is ${metres(round2(t.w))} wide. Draw rooms over it with Draw room.` : "Mark a wall whose length you know, so the rooms come out the right size."}</small></span></div>
      <div class="trace-actions">
        <button type="button" class="mini-btn${t.scaled ? "" : " primary"}" data-trace-scale aria-pressed="${tool === "scale"}">${TI.ruler}${t.scaled ? "Set scale again" : "Set scale"}</button>
        <button type="button" class="mini-btn" data-trace-move aria-pressed="${tool === "move-plan"}">${TI.move}Move</button>
      </div>
      <div class="slider-field">
        <div class="slider-top"><label for="trace-opacity">How visible</label><output id="trace-opacity-out">${Math.round(t.opacity * 100)}%</output></div>
        <input type="range" id="trace-opacity" min="15" max="100" step="5" value="${Math.round(t.opacity * 100)}">
      </div>
      <div class="trace-foot">
        <button type="button" class="link-btn" data-trace-hide>${t.hidden ? "Show picture" : "Hide picture"}</button>
        <button type="button" class="link-btn" data-trace-pick>Replace</button>
        <button type="button" class="link-btn danger" data-trace-remove>Remove</button>
      </div>`;
  }
  function openTrace() {
    if (mode !== "2d") setMode("2d");
    renderTracePop();
    openPop(tracePop, traceBtn);
    tracePop.querySelector("[data-trace-pick], [data-trace-scale]")?.focus();
  }
  traceBtn.addEventListener("click", () => (tracePop.hidden ? openTrace() : closePops()));
  document.addEventListener("click", (e) => { if (e.target.closest("[data-trace-start]")) openTrace(); });

  async function useTraceFile(file) {
    if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type)) { toast("That isn't a picture we can use. Try a JPG or PNG.", { duration: 2600 }); return; }
    try {
      const { blob, width, height } = await TraceStore.shrink(file);
      await TraceStore.put(project.id, blob);
      if (traceURL) URL.revokeObjectURL(traceURL);
      traceURL = URL.createObjectURL(blob);
      // A first guess at its size: over the rooms already drawn, else 12 m wide in the middle of the view
      const aspect = height / width;
      let w = 12, x, y;
      if (project.rooms.length) {
        const minX = Math.min(...project.rooms.map((r) => r.x)), maxX = Math.max(...project.rooms.map((r) => r.x + r.w));
        const minY = Math.min(...project.rooms.map((r) => r.y)), maxY = Math.max(...project.rooms.map((r) => r.y + r.h));
        w = Math.max(maxX - minX, (maxY - minY) / aspect) * 1.15;
        x = (minX + maxX) / 2 - w / 2; y = (minY + maxY) / 2 - (w * aspect) / 2;
      } else {
        const r = svg.getBoundingClientRect();
        x = view.x + r.width / 2 / view.s - w / 2; y = view.y + r.height / 2 / view.s - (w * aspect) / 2;
      }
      project.trace = { x: round2(x), y: round2(y), w: round2(w), aspect, opacity: 0.6, scaled: false };
      scheduleSave();
      closePops();
      if (mode !== "2d") setMode("2d"); else fit();
      setTool("scale");
      toast("Now drag along a wall whose length is written on the plan.", { duration: 4200 });
    } catch (err) {
      console.error(err);
      toast("We couldn't open that picture. Try another one.", { duration: 2600 });
    }
  }
  traceFile.addEventListener("change", () => { useTraceFile(traceFile.files[0]); traceFile.value = ""; });
  // Drop a picture on the open popover or anywhere on the 2D plan
  [tracePop, wrap].forEach((el) => {
    el.addEventListener("dragover", (e) => {
      if (![...(e.dataTransfer?.items || [])].some((i) => i.kind === "file")) return;
      if (el === wrap && mode !== "2d") return;
      e.preventDefault();
      tracePop.querySelector(".trace-drop")?.classList.add("is-over");
    });
    el.addEventListener("dragleave", () => tracePop.querySelector(".trace-drop")?.classList.remove("is-over"));
    el.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file || (el === wrap && mode !== "2d")) return;
      e.preventDefault(); e.stopPropagation();
      useTraceFile(file);
    });
  });

  tracePop.addEventListener("click", (e) => {
    if (e.target.closest("[data-trace-pick]")) { traceFile.click(); return; }
    const t = project.trace;
    if (!t) return;
    if (e.target.closest("[data-trace-scale]")) { closePops(); setTool(tool === "scale" ? "select" : "scale"); return; }
    if (e.target.closest("[data-trace-move]")) {
      if (t.hidden) t.hidden = false;
      setTool(tool === "move-plan" ? "select" : "move-plan");
      return;
    }
    if (e.target.closest("[data-trace-hide]")) {
      t.hidden = !t.hidden;
      if (t.hidden && tool !== "draw") setTool("select");
      scheduleSave(); render(); renderTracePop();
      return;
    }
    if (e.target.closest("[data-trace-remove]")) {
      delete project.trace;
      TraceStore.remove(project.id);
      if (traceURL) URL.revokeObjectURL(traceURL);
      traceURL = null;
      setTool("select");
      scheduleSave(); render(); renderTracePop();
      toast("Plan picture removed. Your rooms stay as they are.", { duration: 2400 });
    }
  });
  tracePop.addEventListener("input", (e) => {
    if (e.target.id !== "trace-opacity" || !project.trace) return;
    project.trace.opacity = +e.target.value / 100;
    document.getElementById("trace-opacity-out").textContent = `${e.target.value}%`;
    renderTrace();
  });
  tracePop.addEventListener("change", (e) => { if (e.target.id === "trace-opacity") scheduleSave(); });

  // Hovering after a first click: the line follows the pointer to the second end
  svg.addEventListener("pointermove", (e) => {
    if (tool !== "scale" || !scaleLine?.waiting) return;
    const p = toWorld(e);
    scaleLine.x1 = p.x; scaleLine.y1 = p.y;
    renderPlan();
  });

  // The line is drawn: ask how long it really is, next to it
  function askScale() {
    const L = scaleLine, len = Math.hypot(L.x1 - L.x0, L.y1 - L.y0);
    const r = wrap.getBoundingClientRect();
    const mx = ((L.x0 + L.x1) / 2 - view.x) * view.s, my = ((L.y0 + L.y1) / 2 - view.y) * view.s;
    scaleAsk.hidden = false;
    const w = scaleAsk.offsetWidth, h = scaleAsk.offsetHeight;
    scaleAsk.style.left = `${Math.max(8, Math.min(r.width - w - 8, mx - w / 2))}px`;
    scaleAsk.style.top = `${Math.max(64, Math.min(r.height - h - 70, my + 18))}px`;
    scaleLen.value = project.trace?.scaled ? round2(len) : "";
    scaleLen.placeholder = "e.g. 4.20";
    scaleLen.focus();
  }
  scaleAsk.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = project.trace, L = scaleLine;
    const real = parseFloat(String(scaleLen.value).replace(",", "."));
    const len = L && Math.hypot(L.x1 - L.x0, L.y1 - L.y0);
    if (!t || !len || !(real > 0.1 && real < 100)) { scaleLen.focus(); return; }
    // Grow or shrink the picture around the line's first end, so that line becomes the length typed
    const k = real / len;
    t.x = round2(L.x0 + (t.x - L.x0) * k); t.y = round2(L.y0 + (t.y - L.y0) * k);
    t.w = Math.round(t.w * k * 1000) / 1000;
    t.scaled = true;
    scheduleSave();
    setTool("select");
    fit();
    toast(`Scale set: that wall is ${metres(round2(real))}. Now use Draw room to trace the rooms over it.`, { duration: 4200 });
  });
  scaleLen.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); setTool("select"); } });

  async function loadTrace() {
    if (!project.trace) return;
    const blob = await TraceStore.get(project.id);
    if (!blob) { delete project.trace; Projects.save(project, { touch: false }); render(); return; }   // e.g. a copied project
    traceURL = URL.createObjectURL(blob);
    if (mode === "2d") fit(); else render();
  }

  // ---------- Space check: what an interior designer would point at ----------
  const spaceList = document.getElementById("space-list");
  const spaceCount = document.getElementById("space-count");
  const spaceShowBox = document.getElementById("space-show");
  let spaceIssues = [];
  let spaceShow = localStorage.getItem("atelier.space") !== "off";
  let spaceFocus = -1, spaceFocusTimer = 0;
  let spaceKnown = null;           // how many there were last time we told the person
  spaceShowBox.checked = spaceShow;

  function refreshSpace() {
    spaceIssues = checkSpace(project, CATALOG);
    syncSpacePill();
  }
  function syncSpacePill() {
    const n = spaceIssues.length;
    spacePill.hidden = !n || tool !== "select";
    spaceCount.textContent = n === 1 ? "1 spot to check" : `${n} spots to check`;
    spacePill.setAttribute("aria-label", `Space check: ${spaceCount.textContent}`);
    if (!spacePop.hidden) { if (n) renderSpaceList(); else closePops(); }
  }
  // After a change: a soft nudge when something new gets tight, a word when all is clear again
  function announceSpace(quiet = false) {
    refreshSpace();
    const n = spaceIssues.length;
    if (!quiet && spaceKnown !== null) {
      if (n > spaceKnown) { spacePill.classList.remove("is-new"); void spacePill.offsetWidth; spacePill.classList.add("is-new"); }
      if (!n && spaceKnown > 0) toast("Space check: everything has room to breathe", { duration: 2200 });
    }
    spaceKnown = n;
  }
  const SPACE_ICON = {
    door: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h9v17 M3 21h18 M11 12.5h.01 M14 4l5 2v15"/></svg>',
    walk: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16 M19 4v16 M9 12h6 M9 12l2-2 M9 12l2 2 M15 12l-2-2 M15 12l-2 2"/></svg>',
    bed: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V7 M3 14h18v4 M21 14v-2a3 3 0 0 0-3-3h-7v5 M7 11.5h.01"/></svg>',
  };
  function renderSpaceList() {
    spaceList.innerHTML = spaceIssues.map((issue, i) => `
      <li><button type="button" class="space-row" data-issue="${i}">
        <span class="space-ico is-${issue.kind}">${SPACE_ICON[issue.kind]}</span>
        <span><strong>${esc(issue.title)}</strong><small>${esc(issue.text)}</small></span>
      </button></li>`).join("");
  }
  spacePill.addEventListener("click", () => {
    if (!spacePop.hidden) { closePops(); return; }
    renderSpaceList();
    openPop(spacePop, spacePill);
  });
  spaceList.addEventListener("click", (e) => {
    const row = e.target.closest("[data-issue]");
    const issue = row && spaceIssues[+row.dataset.issue];
    if (!issue) return;
    if (mode !== "2d") setMode("2d");
    if (!spaceShow) { spaceShow = true; spaceShowBox.checked = true; localStorage.setItem("atelier.space", "on"); }
    select({ type: "item", id: issue.focus }, false);
    // the spot in the upper middle of the plan, close enough to see the gap
    const r = svg.getBoundingClientRect(), z = issue.zone;
    view.s = Math.max(view.s, Math.min(110, 70));
    view.x = z.x + z.w / 2 - r.width / 2 / view.s;
    view.y = z.y + z.h / 2 - (r.height * 0.4) / view.s;
    spaceFocus = +row.dataset.issue;
    clearTimeout(spaceFocusTimer);
    spaceFocusTimer = setTimeout(() => { spaceFocus = -1; if (mode === "2d") renderPlan(); }, 2600);
    render(); renderPanel();
    if (matchMedia("(max-width: 900px)").matches) closePops();
  });
  spaceShowBox.addEventListener("change", () => {
    spaceShow = spaceShowBox.checked;
    localStorage.setItem("atelier.space", spaceShow ? "on" : "off");
    render();
  });

  // ---------- Start ----------
  if (hangCurtains()) scheduleSave();             // curtains onto their windows (older plans, shared links)
  snapshot = stateNow();
  document.getElementById("snap-btn").setAttribute("aria-pressed", String(snapOn));
  updateUndo();
  renderPanel();
  setMode(mode, false);
  loadTrace();
  announceSpace(true);
})();
