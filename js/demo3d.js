/* =========================================================
   Atelier — live 3D demo on the home page
   The same 3D engine as the planner, showing the furnished rooms
   people can start from. Loaded only when the section comes near
   the screen, so the rest of the page stays fast.
   ========================================================= */

const section = document.getElementById("planner");
const stage = document.getElementById("demo-stage");
const status = document.getElementById("demo-status");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let three = null;
let project = null;
let roomType = "living";

// Showcase rooms: styled more richly than the starter templates, each in its own light.
// x, y = centre in metres from the room's top-left corner. rot: 0 faces down the plan,
// 90 faces left, 180 up, 270 right. Wall art hangs on the wall it is placed against.
const put = (catalogId, x, y, rot = 0) => ({ catalogId, x, y, rot });
const SHOWCASE = {
  living: {
    mood: "Golden hour · 18:40", light: { time: 18.65, dir: 210, lamps: "auto" },
    room: { floor: "herring", wall: "#e6d3c3" },
    items: [
      put("window-wide", 2.5, 0.06, 0), put("door", 4.94, 3.0, 90),
      put("tversted-rug", 2.5, 2.2), put("kivik-sofa", 2.5, 3.43, 180), put("frotorp", 2.5, 2.2),
      put("strandmon", 0.68, 1.75, 270), put("landskrona-stool", 1.42, 1.75),
      put("stockholm-sideboard", 2.5, 0.3, 0), put("own-candlestick", 2.45, 0.3),
      put("fjallbo", 4.74, 1.35, 90), put("own-bust", 4.74, 1.35),
      put("stockholm-lamp", 0.42, 3.55), put("strelitzia", 4.48, 0.48), put("branas-basket", 1.05, 3.55),
      put("fenomen-candles", 2.38, 2.12), put("hultet-dish", 2.66, 2.3),
      put("rodalm-oak", 2.5, 3.94, 180), put("own-oval", 0.06, 1.75, 270),
    ],
  },
  bedroom: {
    mood: "Late evening · 22:00, lamps on", light: { time: 22, dir: 30, lamps: "on" },
    room: { floor: "walnut", wall: "#b9c9b3" },
    items: [
      put("window", 0.06, 2.6, 270), put("door", 3.94, 1.5, 90),
      put("ikea-ps-rug", 2, 1.95), put("idanas-bed", 2, 1.17, 0),
      put("tonstad-bedside", 0.68, 0.32), put("tonstad-bedside", 3.32, 0.32),
      put("arstid-lamp", 0.64, 0.28), put("arstid-lamp", 3.28, 0.28), put("own-alarm", 3.44, 0.42), put("own-books", 0.7, 0.44),
      put("valtorp-bench", 2, 2.52), put("gurli", 2, 2.52),
      put("tonstad-chest", 2.2, 3.3, 180), put("monstera", 0.42, 3.2), put("own-lantern", 0.8, 3.3),
      put("rodalm-oak", 2, 0.06, 0), put("own-mirror", 3.94, 2.65, 90),
    ],
  },
  kitchen: {
    mood: "Morning sun · 08:15", light: { time: 8.25, dir: 120, lamps: "off" },
    room: { floor: "checker", wall: "#ffffff" },
    items: [
      put("steel-window", 0.06, 1.8, 270), put("door", 3.2, 3.44, 180),
      put("metod-fridge", 0.4, 0.36, 0), put("metod-green", 1.0, 0.36, 0), put("metod-oak-sink", 1.7, 0.36, 0),
      put("metod-black", 2.5, 0.36, 0), put("metod-green", 3.2, 0.36, 0),
      put("frovaxt-vase", 1.0, 0.3), put("own-tea", 2.5, 0.34), put("own-wine", 3.2, 0.3),
      put("vadholma", 2, 1.95), put("sockerart-vase", 2.45, 1.85),
      put("stig-bar", 1.6, 2.6, 180), put("stig-bar", 2.4, 2.6, 180),
      put("pachira", 0.45, 3.05), put("tromma", 3.94, 1.6, 90),
    ],
  },
  dining: {
    mood: "Dinner at dusk · 20:10, candles lit", light: { time: 20.15, dir: 250, lamps: "on" },
    room: { floor: "diagonal", wall: "#d9a589" },
    items: [
      put("window-wide", 2, 0.06, 0), put("door", 0.06, 2.8, 270),
      put("lohals-rug", 2, 1.75), put("tonstad-dining", 2, 1.75),
      put("pinntorp", 1.65, 1.08, 0), put("pinntorp", 2.35, 1.08, 0),
      put("pinntorp", 1.65, 2.42, 180), put("pinntorp", 2.35, 2.42, 180),
      put("stockholm-chair", 0.98, 1.75, 270), put("stockholm-chair", 2.98, 1.75, 90),
      put("own-candlestick", 1.55, 1.72), put("own-candlestick", 2.45, 1.78), put("own-wine", 2.0, 2.05),
      put("stockholm-sideboard", 3.73, 1.75, 90), put("own-mantel-clock", 3.73, 1.75),
      put("own-painting", 3.94, 1.75, 90), put("strelitzia", 3.5, 0.5), put("own-clay-pot", 0.42, 0.45),
      put("own-vase-blue", 3.55, 3.1),
    ],
  },
  bathroom: {
    mood: "Bright noon · 12:30", light: { time: 12.5, dir: 60, lamps: "off" },
    room: { floor: "terrazzo", wall: "#b2c2cf" },
    items: [
      put("window", 0.06, 0.9, 270), put("door", 2.3, 0.06, 0),
      put("angsjon-vanity", 1.0, 0.31, 0), put("frovaxt-vase", 0.42, 0.3), put("own-shell", 1.5, 0.3),
      put("own-mirror", 1.0, 0.06, 0), put("duravit-wc", 0.35, 1.5, 270),
      put("venecia-bath", 1.95, 2.1, 180), put("fenomen-candles", 2.68, 1.86),
      put("angsjon-tall", 2.76, 1.25, 90), put("monstera", 0.38, 2.24),
    ],
  },
  office: {
    mood: "Quiet afternoon · 16:20", light: { time: 16.35, dir: 300, lamps: "auto" },
    room: { floor: "oak", wall: "#5b6b5a" },
    items: [
      put("window", 1.6, 0.06, 0), put("door", 3.14, 2.2, 90),
      put("undervisning-rug", 1.6, 1.75), put("tonstad-desk", 1.6, 0.44, 0), put("stockholm-chair", 1.6, 1.05, 180),
      put("tertial", 2.2, 0.56), put("rodalm-small", 1.4, 0.3),
      put("strandmon", 0.62, 1.95, 270), put("stockholm-lamp", 0.36, 2.66),
      put("kallax", 2.94, 1.05, 90), put("own-vase-blue", 2.94, 0.85), put("own-elephant", 2.94, 1.25),
      put("monstera", 2.85, 0.4), put("own-oval", 0.06, 1.0, 270), put("branas-basket", 1.6, 2.7),
    ],
  },
};

// A throw-away project for one showcase room (never saved)
function demoProject(type) {
  const t = CATALOG.templates[`${type}-furnished`];
  const show = SHOWCASE[type];
  let n = 0;
  return {
    rooms: t.rooms.map((r) => ({ ...r, ...(show?.room || {}), id: `r${n++}` })),
    items: (show?.items || t.items).filter((it) => CATALOG.byId[it.catalogId]).map((it) => ({ ...it, id: `i${n++}` })),
  };
}
const mood = document.getElementById("demo-mood");
function showLight(type, ms) {
  const show = SHOWCASE[type];
  if (!show || !three) return;
  three.setLight(show.light, ms);
  if (mood) { mood.textContent = show.mood; mood.hidden = false; }
}

function setStatus(text) { status.textContent = text; }

async function start() {
  setStatus("Loading the 3D view…");
  try {
    const { createPlanner3D } = await import("./planner3d.js?v=83");
    project = demoProject(roomType);
    three = createPlanner3D(stage, {
      demo: true,
      getProject: () => project,
      catalog: CATALOG,
      onSelect: (sel) => three.select(sel),
    });
    three.update(null);
    three.view("3d", 0);
    showLight(roomType, 0);
    stage.classList.add("is-ready");
    setStatus("");
    watchVisibility();
    // The other rooms' scans load quietly in the background, so switching rooms is instant
    const others = Object.keys(SHOWCASE).filter((k) => k !== roomType);
    const products = [...new Set(others.flatMap((k) => SHOWCASE[k].items.map((it) => CATALOG.byId[it.catalogId])))];
    const rooms = others.map((k) => { const t = CATALOG.ROOM_TYPES[k]; return { floor: SHOWCASE[k].room.floor, w: t.w, h: t.h }; });
    setTimeout(() => three.preload?.(products, rooms), 1500);
  } catch (err) {
    console.error(err);
    stage.classList.add("is-failed");
    setStatus("The 3D preview couldn't load here. You can still try it in the planner.");
  }
}

// Turn slowly while on screen; stop when scrolled away (and never if motion is reduced)
function watchVisibility() {
  let spinning = null;
  const check = () => {
    const r = stage.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < innerHeight;
    const spin = visible && !reduceMotion && !stage.dataset.touched;
    if (spin !== spinning) { spinning = spin; three.setAutoRotate(spin); }
  };
  addEventListener("scroll", check, { passive: true });
  addEventListener("resize", check);
  stage.addEventListener("pointerdown", () => { stage.dataset.touched = "1"; check(); }, { once: true });
  check();
}

// Room tabs
const tabs = [...section.querySelectorAll("[data-demo-room]")];
tabs.forEach((tab) => tab.addEventListener("click", () => {
  roomType = tab.dataset.demoRoom;
  tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
  if (!three) return;
  project = demoProject(roomType);
  three.update(null);
  three.view("3d", 450);
  showLight(roomType, 900);
}));

// Camera buttons
section.querySelectorAll("[data-demo-cam]").forEach((btn) => btn.addEventListener("click", () => {
  if (!three) return;
  stage.dataset.touched = "1";
  three.setAutoRotate(false);
  three.view(btn.dataset.demoCam);
}));

// Start once the section is close (checked on load, scroll and resize)
const near = () => section.getBoundingClientRect().top < innerHeight * 1.6;
const wait = () => {
  if (!near()) return;
  removeEventListener("scroll", wait);
  removeEventListener("resize", wait);
  start();
};
addEventListener("scroll", wait, { passive: true });
addEventListener("resize", wait);
wait();
