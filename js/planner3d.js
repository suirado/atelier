/* =========================================================
   Atelier — the 3D view of a project (Three.js)
   ---------------------------------------------------------
   Plan coordinates (metres): x → right, y → down.
   3D: x = plan x, z = plan y, height = y.
   Furniture faces +z when rot = 0; plan rot is clockwise seen from above.
   Pieces start as simple shapes drawn here, then switch to photo-real
   scanned models (Poly Haven, CC0) from assets/models/ once they load.
   ========================================================= */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Reflector } from "three/addons/objects/Reflector.js";

export const WALL_T = 0.12;
// Two rooms side by side share a wall: one entry per shared stretch. The key matches the 3D walls' link,
// so project.openWalls (a list of keys) can take that wall away for an open plan.
export function sharedWalls(rooms) {
  const out = [];
  rooms.forEach((a, i) => rooms.slice(i + 1).forEach((b) => {
    const key = (axis) => [a.id, b.id].sort().join("|") + axis;
    [[a.x + a.w, b.x], [b.x + b.w, a.x]].forEach(([l1, l2]) => {           // side by side: an upright wall
      if (Math.abs(l1 - l2) > WALL_T + 0.03) return;
      const lo = Math.max(a.y, b.y), hi = Math.min(a.y + a.h, b.y + b.h);
      if (hi - lo >= 0.05) out.push({ key: key("z"), a, b, x1: (l1 + l2) / 2, y1: lo, x2: (l1 + l2) / 2, y2: hi, len: hi - lo });
    });
    [[a.y + a.h, b.y], [b.y + b.h, a.y]].forEach(([l1, l2]) => {           // one above the other
      if (Math.abs(l1 - l2) > WALL_T + 0.03) return;
      const lo = Math.max(a.x, b.x), hi = Math.min(a.x + a.w, b.x + b.w);
      if (hi - lo >= 0.05) out.push({ key: key("x"), a, b, x1: lo, y1: (l1 + l2) / 2, x2: hi, y2: (l1 + l2) / 2, len: hi - lo });
    });
  }));
  return out;
}
export const SURFACES = new Set(["bedside", "tv-bench", "chest", "desk", "table", "coffee-table", "island", "vanity", "kitchen", "kitchen-base", "sideboard", "bookcase", "footstool"]);
const COUNTER = new Set(["kitchen", "kitchen-base"]);
const SEATS = new Set(["sofa", "armchair", "wing-chair", "bench"]);   // cushions sit on the seat       // worktop at 92 cm, whatever the cupboards above
// Small things stand on whatever surface is under them (lamps, vases, books…)
export const isSmall = (p) => !!p && (p.kind === "table-lamp" || !!p.small);
const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const round2 = (v) => Math.round(v * 100) / 100;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

/* ---------- Rules shared with the 2D plan ---------- */
// Half the size of a piece's footprint once turned, along x and along y
export function itemHalf(p, rot = 0) {
  const a = rad(rot), w = p.w / 100, d = p.d / 100;
  return { hw: (Math.abs(w * Math.cos(a)) + Math.abs(d * Math.sin(a))) / 2, hd: (Math.abs(w * Math.sin(a)) + Math.abs(d * Math.cos(a))) / 2 };
}
const inRoom = (r, x, y, m = 0) => x > r.x + m && x < r.x + r.w - m && y > r.y + m && y < r.y + r.h - m;
export function roomAt(rooms, x, y, margin = 0) { return rooms.find((r) => inRoom(r, x, y, margin)) || null; }
export function nearestRoom(rooms, x, y) {
  let best = null, bd = Infinity;
  rooms.forEach((r) => {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = r; }
  });
  return best;
}
// Furniture never goes through a wall: keep the whole footprint inside one room.
// Returns the id of the room the piece ended up in.
export function keepInside(project, catalog, it, prefer = null) {
  const p = catalog.piece(it);
  if (!p || p.wall || !project.rooms.length) return null;
  const preferred = prefer && project.rooms.find((q) => q.id === prefer);
  const r = (preferred && inRoom(preferred, it.x, it.y)) ? preferred
    : roomAt(project.rooms, it.x, it.y) || preferred || nearestRoom(project.rooms, it.x, it.y);
  const { hw, hd } = itemHalf(p, it.rot || 0);
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  // Where the wall to the next room was taken away, a piece goes on through, up to that room's far wall,
  // if it fits through the opening (between the walls at either end of it)
  let x0 = r.x + WALL_T + hw, x1 = r.x + r.w - WALL_T - hw, y0 = r.y + WALL_T + hd, y1 = r.y + r.h - WALL_T - hd;
  const keys = new Set(project.openWalls || []);
  if (keys.size) sharedWalls(project.rooms).forEach((s) => {
    if (!keys.has(s.key) || (s.a !== r && s.b !== r)) return;
    const q = s.a === r ? s.b : s.a;
    if (Math.abs(s.x1 - s.x2) < 1e-6) {           // an upright wall: through it left or right
      if (it.y - hd < s.y1 + WALL_T - 0.01 || it.y + hd > s.y2 - WALL_T + 0.01) return;
      if (q.x > r.x) x1 = Math.max(x1, q.x + q.w - WALL_T - hw); else x0 = Math.min(x0, q.x + WALL_T + hw);
    } else {                                       // a wall along x: through it up or down
      if (it.x - hw < s.x1 + WALL_T - 0.01 || it.x + hw > s.x2 - WALL_T + 0.01) return;
      if (q.y > r.y) y1 = Math.max(y1, q.y + q.h - WALL_T - hd); else y0 = Math.min(y0, q.y + WALL_T + hd);
    }
  });
  it.x = round2(clamp(it.x, x0, x1));
  it.y = round2(clamp(it.y, y0, y1));
  return r.id;
}

/* ---------- Doors and windows never overlap ---------- */
// From how high to how high a wall piece reaches (m): openings from their sill, hung things around their hook height
function heightSpan(p) {
  if (p.hang) { const c = (p.hangAt || 150) / 100, h = p.h / 200; return [c - h, c + h]; }
  const o = openingOf(p);
  return o ? [o.sill, o.sill + o.h] : [0, 3];
}
// The door or window in the way of `it` (same wall, overlapping along it), or null
export function openingClash(project, catalog, it) {
  const p = catalog.piece(it);
  if (!p?.wall) return null;
  const horiz = (it.rot || 0) % 180 === 0;
  return project.items.find((o) => {
    if (o === it || o.id === it.id) return false;
    const q = catalog.piece(o);
    if (!q?.wall || ((o.rot || 0) % 180 === 0) !== horiz) return false;
    // A TV or picture only gets in the way of what is at the same height (it can hang above a door or beside a window)
    const [a0, a1] = heightSpan(p), [b0, b1] = heightSpan(q);
    if (a1 <= b0 + 0.02 || b1 <= a0 + 0.02) return false;
    const across = horiz ? Math.abs(it.y - o.y) : Math.abs(it.x - o.x);
    const along = horiz ? Math.abs(it.x - o.x) : Math.abs(it.y - o.y);
    return across < WALL_T + 0.03 && along < (p.w + q.w) / 200 + 0.05;
  }) || null;
}
// A door, window or picture can't go where a wall was taken away to join two rooms
export function onOpenWall(project, catalog, it) {
  if (!project.openWalls?.length) return false;
  const p = catalog.piece(it);
  if (!p?.wall) return false;
  const keys = new Set(project.openWalls), horiz = (it.rot || 0) % 180 === 0, half = (p.w || 80) / 200;
  return sharedWalls(project.rooms).some((s) => keys.has(s.key) && (horiz
    ? Math.abs(s.y1 - s.y2) < 1e-6 && Math.abs(it.y - s.y1) < WALL_T && Math.min(it.x + half, s.x2) - Math.max(it.x - half, s.x1) > 0.05
    : Math.abs(s.x1 - s.x2) < 1e-6 && Math.abs(it.x - s.x1) < WALL_T && Math.min(it.y + half, s.y2) - Math.max(it.y - half, s.y1) > 0.05));
}
// Snap to the wall; if another opening is there, stop right next to it (on the side it came from,
// so dragging never jumps over). False = no room, nothing changed.
export function fitOpening(project, catalog, it, snap, from = null) {
  const start = { x: it.x, y: it.y, rot: it.rot };
  snap(it);
  if (onOpenWall(project, catalog, it)) { Object.assign(it, start); return false; }
  const hit = openingClash(project, catalog, it);
  if (!hit) return true;
  const base = { x: it.x, y: it.y, rot: it.rot };
  const key = (it.rot || 0) % 180 === 0 ? "x" : "y";
  const gap = (catalog.piece(it).w + catalog.piece(hit).w) / 200 + 0.06;
  const sameWall = from && (from.rot || 0) === (base.rot || 0);
  const tries = sameWall
    ? [from[key] < hit[key] ? hit[key] - gap : hit[key] + gap]
    : [hit[key] - gap, hit[key] + gap].sort((a, b) => Math.abs(a - base[key]) - Math.abs(b - base[key]));
  for (const v of tries) {
    Object.assign(it, base); it[key] = round2(v); snap(it);
    if (it.rot === base.rot && !openingClash(project, catalog, it) && !onOpenWall(project, catalog, it)) return true;
  }
  Object.assign(it, start);
  return false;
}
// Any free stretch of wall in a room, starting from the middle of each wall
export function freeOpeningSpot(project, catalog, it, room, snap) {
  for (const rot of [...new Set([it.rot || 0, 0, 90, 180, 270])]) {
    const horiz = rot % 180 === 0, len = horiz ? room.w : room.h;
    for (let k = 0; k <= len / 2; k += 0.1) {
      for (const s of [1, -1]) {
        const along = (horiz ? room.x + room.w / 2 : room.y + room.h / 2) + s * k;
        it.x = horiz ? along : rot === 90 ? room.x + room.w - 0.01 : room.x + 0.01;
        it.y = horiz ? (rot === 0 ? room.y + 0.01 : room.y + room.h - 0.01) : along;
        snap(it);
        if (it.rot === rot && !openingClash(project, catalog, it) && !onOpenWall(project, catalog, it)) return true;
      }
    }
  }
  return false;
}

/* ---------- Materials and shapes (shared, so the scene stays light) ---------- */
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Scanned surfaces (Poly Haven, CC0): a grey detail picture tinted by the piece's colour, plus its bump map.
// size = metres one picture covers, so the weave and grain keep their real scale on every piece.
const MAT_DIR = new URL("../assets/materials/", import.meta.url).href;
const MAT_SIZE = { paint: 1.2, plaster: 1.6, wood: 0.9, fabric: 0.3, boucle: 0.28, velvet: 0.35, leather: 0.55, rug: 0.5, jute: 0.4 };
const MAT_BUMP = { paint: 0.22, plaster: 0.3, wood: 0.45, leather: 0.7, velvet: 0.6 };
const surfaces = {};
const texListeners = new Set();              // every 3D view redraws when a picture arrives
const texJobs = [];
function flat(color) { const c = document.createElement("canvas"); c.width = c.height = 4; const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, 4, 4); return c; }
function surface(kind) {
  if (surfaces[kind]) return surfaces[kind];
  const k = 1 / (MAT_SIZE[kind] || 0.5);
  const map = new THREE.Texture(flat("#dbdbdb")), normal = new THREE.Texture(flat("#8080ff"));
  [map, normal].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(k, k); t.anisotropy = 8; t.needsUpdate = true; });
  map.colorSpace = THREE.SRGBColorSpace;
  const loader = new THREE.ImageLoader();
  const load = (t, file) => new Promise((done) => loader.load(`${MAT_DIR}${file}?v=2`, (img) => {
    t.image = img; t.needsUpdate = true; texListeners.forEach((f) => f()); done();
  }, undefined, done));
  const ready = Promise.all([load(map, `${kind}.jpg`), load(normal, `${kind}-n.jpg`)]);
  texJobs.push(ready);
  return (surfaces[kind] = { map, normal, ready });
}
// Texture coordinates in metres, projected from the side each face looks at
function worldUV(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  if (!uv || !nor) return geo;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x, z); else if (ax >= az) uv.setXY(i, z, y); else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
  return geo;
}
// Round things: wrap the picture around, in metres
function wrapUV(geo, r) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(nor.getY(i)) > 0.7) uv.setXY(i, x, z);
    else uv.setXY(i, Math.atan2(x, z) * r, y);
  }
  uv.needsUpdate = true;
  return geo;
}

const glowMats = new Set();                 // lamp shades: brighter at night
let lampGlow = 0.6;
const matCache = new Map();
function mat(color, o = {}) {
  const key = `${color}|${o.rough ?? ""}|${o.metal ?? ""}|${o.opacity ?? ""}|${o.glow ?? ""}|${o.tex ?? ""}`;
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough ?? 0.78, metalness: o.metal ?? 0,
      transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1, depthWrite: (o.opacity ?? 1) >= 1,
      emissive: o.glow ? new THREE.Color(o.glow) : new THREE.Color(0), emissiveIntensity: o.glow ? lampGlow : 0,
      map: o.tex ? surface(o.tex).map : null,
      normalMap: o.tex ? surface(o.tex).normal : null,
    });
    if (o.tex) m.normalScale.setScalar(MAT_BUMP[o.tex] ?? 1);
    if (o.glow) glowMats.add(m);
    matCache.set(key, m);
  }
  return matCache.get(key);
}
// Painted walls: a fine roller grain with no marks of its own (so its repeats can't be spotted),
// and soft, large patches of light and shade, like real paint. The patches come from a small
// picture laid over the walls twice, at two unrelated sizes and angles, in world metres: so they
// never line up into a pattern and flow on from one wall to the next.
let mottle = null;
const wallMats = new Map();
function wallMaterial(color) {
  if (wallMats.has(color)) return wallMats.get(color);
  if (!mottle) {
    mottle = new THREE.Texture(flat("#808080"));
    mottle.wrapS = mottle.wrapT = THREE.RepeatWrapping; mottle.needsUpdate = true;
    const job = new Promise((done) => new THREE.ImageLoader().load(`${MAT_DIR}paint-m.png?v=1`, (img) => {
      mottle.image = img; mottle.needsUpdate = true; texListeners.forEach((f) => f()); done();
    }, undefined, done));
    texJobs.push(job);
  }
  const { map, normal } = surface("paint");
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, map, normalMap: normal });
  m.normalScale.setScalar(MAT_BUMP.paint);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uMottle = { value: mottle };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
        varying vec3 vWallPos;
        varying vec3 vWallNrm;`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
        vWallPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWallNrm = abs(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D uMottle;
        varying vec3 vWallPos;
        varying vec3 vWallNrm;`)
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec2 wm = vWallNrm.y > 0.7 ? vWallPos.xz : vec2(vWallPos.x + vWallPos.z, vWallPos.y);
        float m1 = texture2D(uMottle, wm / 6.7 + 0.13).r;
        float m2 = texture2D(uMottle, mat2(0.8, -0.6, 0.6, 0.8) * wm / 2.3 + 0.57).r;
        diffuseColor.rgb *= 1.0 + (m1 - 0.5) * 0.16 + (m2 - 0.5) * 0.07;`);
  };
  m.customProgramCacheKey = () => "wall-paint";
  wallMats.set(color, m);
  return m;
}
const geoCache = new Map();
const WALL_CAP = new THREE.MeshStandardMaterial({ color: "#3d3833", roughness: 0.85 });
function boxGeo(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = [w, h, d, r].map((n) => n.toFixed(3)).join("x");
  if (!geoCache.has(key)) geoCache.set(key, worldUV(r > 0.004 ? new RoundedBoxGeometry(w, h, d, 4, r) : new THREE.BoxGeometry(w, h, d)));
  return geoCache.get(key);
}
const shade = (hex, l) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, l); return `#${c.getHexString()}`; };

const CHROME = { rough: 0.25, metal: 0.9 };
const GLASS = { rough: 0.05, metal: 0.1, opacity: 0.28 };
let FAB = { tex: "fabric", rough: 0.95 };          // swapped per product: linen, bouclé, velvet or leather
const fabricOf = (p) => {
  const tex = p?.fabric || "fabric";
  return { tex, rough: tex === "leather" ? 0.5 : tex === "velvet" ? 0.75 : 0.95 };
};
const WOOD = { tex: "wood", rough: 0.6 };

// Little builder: every helper adds a mesh to the group. y = bottom of the shape.
function builder(g) {
  const add = (mesh, shadow = true) => { mesh.castShadow = shadow; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  return {
    slots: [],                                   // where books can stand (bookcases)
    box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
      const r = o.r ?? Math.min(0.012, w / 4, h / 4, d / 4);
      const m = add(new THREE.Mesh(boxGeo(Math.max(w, 0.004), Math.max(h, 0.004), Math.max(d, 0.004), r), o.material || mat(color, o)), o.shadow !== false);
      m.position.set(x, y + h / 2, z);
      if (o.rx) m.rotation.x = o.rx;
      if (o.ry) m.rotation.y = o.ry;
      if (o.rz) m.rotation.z = o.rz;
      return m;
    },
    cyl(rt, rb, h, color, x = 0, y = 0, z = 0, o = {}) {
      const m = add(new THREE.Mesh(wrapUV(new THREE.CylinderGeometry(rt, rb, h, o.seg || 32), (rt + rb) / 2), mat(color, o)), o.shadow !== false);
      m.position.set(x, y + h / 2, z);
      if (o.sx || o.sz) m.scale.set(o.sx || 1, 1, o.sz || 1);
      if (o.rz) m.rotation.z = o.rz;
      if (o.rx) m.rotation.x = o.rx;
      return m;
    },
    mesh(geo, material, shadow = true) { return add(new THREE.Mesh(geo, material), shadow); },
    flat(shape, material, y = 0) {               // a flat cut-out lying on the floor
      const m = add(new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), material), false);
      m.rotation.x = -Math.PI / 2; m.position.y = y;
      return m;
    },
    blob(r, color, x, y, z, sx = 1, sy = 1, sz = 1, o = {}) {
      const m = add(new THREE.Mesh(worldUV(new THREE.IcosahedronGeometry(r, 3)), mat(color, { rough: 0.9, ...o })));
      m.position.set(x, y, z); m.scale.set(sx, sy, sz);
      if (o.rx) m.rotation.x = o.rx;
      if (o.ry) m.rotation.y = o.ry;
      if (o.rz) m.rotation.z = o.rz;
      return m;
    },
  };
}

/* ---------- Rug patterns: drawn once per product on a canvas, with a pile texture on top ---------- */
const rugTextures = new Map();
// Small speckle tiles, drawn once and repeated over a whole rug in one go (tens of thousands of
// little dots drawn one by one used to freeze the page for over 100 ms per rug)
const noiseTiles = {};
function noiseTile(kind) {
  if (noiseTiles[kind]) return noiseTiles[kind];
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"), r = rand(kind.length * 97 + 11);
  if (kind === "yarn") {                         // a little colour variation, like real yarn
    for (let i = 0; i < N * N / 14; i++) {
      x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${(r() * 0.05).toFixed(3)})` : `rgba(255,255,255,${(r() * 0.04).toFixed(3)})`;
      x.fillRect(Math.floor(r() * N), Math.floor(r() * N), 2, 2);
    }
  } else if (kind === "shag") {                  // shag: tufts catching the light
    for (let i = 0; i < N * N / 18; i++) {
      x.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.09)" : "rgba(255,240,220,0.07)";
      x.beginPath(); x.arc(r() * N, r() * N, 1 + r() * 2.2, 0, 7); x.fill();
    }
  } else if (kind === "worn") {                  // worn: the pattern fades in patches
    for (let i = 0; i < N * N / 30; i++) {
      x.fillStyle = "rgba(240,232,218," + (r() * 0.35).toFixed(3) + ")"; x.fillRect(r() * N, r() * N, 3 + r() * 6, 2);
    }
  }
  return (noiseTiles[kind] = c);
}
function speckle(x, kind, cw, ch) {
  x.save(); x.fillStyle = x.createPattern(noiseTile(kind), "repeat"); x.fillRect(0, 0, cw, ch); x.restore();
}
function rugTexture(p, W, D) {
  const key = `${p.id}|${W}|${D}|${p.color}`;
  if (rugTextures.has(key)) return rugTextures.get(key);
  const k = 1024 / Math.max(W, D), cw = Math.round(W * k), ch = Math.round(D * k);
  const c = document.createElement("canvas"); c.width = cw; c.height = ch;
  const x = c.getContext("2d"), r = rand(p.id.length * 211 + 3);
  const pat = p.pattern, col = p.colors || [];
  x.fillStyle = p.color; x.fillRect(0, 0, cw, ch);
  if (pat === "stripes") {                       // bands of colour across the short side
    let pos = 0, i = 0;
    while (pos < cw) {
      const band = (0.05 + r() * 0.16) * k;
      x.fillStyle = col[i++ % col.length]; x.fillRect(pos, 0, band + 1, ch);
      pos += band;
    }
  } else if (pat === "lines") {                  // hand-drawn ink lines on off-white
    x.strokeStyle = col[0] || "#222"; x.lineCap = "round";
    const step = 0.17 * k;
    for (let y = step; y < ch; y += step) {
      x.lineWidth = 0.02 * k * (0.7 + r() * 0.6);
      x.beginPath(); x.moveTo(0.08 * k, y);
      for (let px = 0.08 * k; px < cw - 0.08 * k; px += 0.1 * k) x.lineTo(px, y + (r() - 0.5) * 0.035 * k);
      x.stroke();
    }
    x.lineWidth = 0.03 * k; x.strokeRect(0.05 * k, 0.05 * k, cw - 0.1 * k, ch - 0.1 * k);
  } else if (pat === "arches") {                 // big graphic arches and dots
    const n = Math.max(2, Math.round(W / 0.55)), u = cw / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = col[i % col.length];
      const cx = u * (i + 0.5), top = ch * (i % 2 ? 0.28 : 0.38);
      x.beginPath(); x.moveTo(cx - u * 0.36, ch * 0.86); x.lineTo(cx - u * 0.36, top);
      x.arc(cx, top, u * 0.36, Math.PI, 0); x.lineTo(cx + u * 0.36, ch * 0.86); x.closePath(); x.fill();
      x.beginPath(); x.arc(cx, ch * (i % 2 ? 0.12 : 0.2), u * 0.09, 0, Math.PI * 2); x.fill();
    }
  } else if (pat === "hide") {                   // cowhide patches
    x.fillStyle = col[0] || "#3a2618";
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      const px = r() * cw, py = r() * ch, rad = (0.08 + r() * 0.16) * k;
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 6) {
        const rr = rad * (0.6 + r() * 0.6);
        x.lineTo(px + Math.cos(a) * rr * 1.4, py + Math.sin(a) * rr);
      }
      x.fill();
    }
  }
  else if (pat === "plaid") {                    // woven check: bands both ways, darker where they cross
    x.globalCompositeOperation = "multiply";
    const bands = col.length ? col : ["#9aa3a6", "#a5532f", "#3b3633"];
    [["v", cw], ["h", ch]].forEach(([dir, len]) => {
      let pos = 0.06 * k, i = 0;
      while (pos < len) {
        const wdt = (i % 3 === 2 ? 0.04 : 0.11) * k;
        x.fillStyle = bands[i % bands.length]; x.globalAlpha = 0.55;
        if (dir === "v") x.fillRect(pos, 0, wdt, ch); else x.fillRect(0, pos, cw, wdt);
        pos += wdt + (0.12 + (i % 2) * 0.08) * k; i++;
      }
    });
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
  } else if (pat === "diamonds") {               // harlequin diamonds with a dot here and there
    const dw = 0.24 * k, dh = 0.34 * k;
    for (let row = -1; row * dh / 2 < ch + dh; row++) for (let ci = -1; ci * dw < cw + dw; ci++) {
      const cx = ci * dw + (row % 2 ? dw / 2 : 0), cy = row * dh / 2;
      x.fillStyle = col[Math.floor(r() * col.length)];
      x.beginPath(); x.moveTo(cx, cy - dh / 2 + 3); x.lineTo(cx + dw / 2 - 3, cy); x.lineTo(cx, cy + dh / 2 - 3); x.lineTo(cx - dw / 2 + 3, cy); x.fill();
      if (r() < 0.25) { x.fillStyle = "#2b2622"; x.beginPath(); x.arc(cx + dw / 2, cy, 0.02 * k, 0, 7); x.fill(); }
    }
    x.strokeStyle = p.color; x.lineWidth = 0.05 * k; x.strokeRect(0, 0, cw, ch);
  } else if (pat === "medallion") {              // a worn, faded classic: borders, a medallion, little motifs
    const main = col[0] || "#b5584a", accent = col[1] || "#8fa3a8", dark = col[2] || "#5a4a42", cream = "#efe4d3";
    const frame = (inset, wdt, c) => { x.strokeStyle = c; x.lineWidth = wdt * k; x.strokeRect(inset * k, inset * k, cw - 2 * inset * k, ch - 2 * inset * k); };
    frame(0.06, 0.05, dark); frame(0.13, 0.08, main); frame(0.2, 0.02, accent); frame(0.24, 0.015, dark);
    for (let i = 0; i < 80; i++) {                 // motifs along the border
      const t = (i % 40) / 40, top = i < 40;
      const px = top ? t * cw : (i % 2 ? 0.13 * k : cw - 0.13 * k), py = top ? (i % 2 ? 0.13 * k : ch - 0.13 * k) : t * ch;
      x.fillStyle = i % 3 ? accent : cream; x.beginPath(); x.arc(px, py, 0.018 * k, 0, 7); x.fill();
    }
    const cx = cw / 2, cy = ch / 2, wide = cw > ch ? 1.35 : 1;
    [[0.62, main], [0.5, cream], [0.42, accent], [0.3, main], [0.16, dark], [0.07, cream]].forEach(([s0, c]) => {
      const a = s0 * Math.min(cw, ch) * 0.55;
      x.fillStyle = c; x.beginPath();
      for (let q = 0; q < 16; q++) { const ang = q / 16 * Math.PI * 2, rr = q % 2 ? 0.78 : 1; x.lineTo(cx + Math.cos(ang) * a * rr * wide, cy + Math.sin(ang) * a * rr * 1.35 / wide); }
      x.fill();
    });
    [[0.32, 0.32], [cw / k - 0.32, 0.32], [0.32, ch / k - 0.32], [cw / k - 0.32, ch / k - 0.32]].forEach(([u, v]) => {
      x.fillStyle = main; x.beginPath(); x.arc(u * k, v * k, 0.13 * k, 0, 7); x.fill();
      x.fillStyle = accent; x.beginPath(); x.arc(u * k, v * k, 0.06 * k, 0, 7); x.fill();
    });
    for (let i = 0; i < 380; i++) {                // scattered small flowers
      const px = (0.3 + r() * (cw / k - 0.6)) * k, py = (0.3 + r() * (ch / k - 0.6)) * k;
      x.fillStyle = [main, accent, dark][i % 3]; x.globalAlpha = 0.5; x.fillRect(px, py, 0.02 * k, 0.02 * k);
    }
    x.globalAlpha = 1;
    speckle(x, "worn", cw, ch);                  // worn: the pattern fades in patches
  } else if (pat === "blocks") {                 // bands of black bars on white, a blush stripe, a chequered edge
    const rowH = ch / 5;
    for (let row = 0; row < 5; row++) {
      const y0 = row * rowH;
      if (row === 0 || row === 4) { x.fillStyle = col[1] || "#e9c3b8"; x.fillRect(0, y0 + rowH * 0.25, cw, rowH * 0.5); }
      else for (let px = 0.04 * k, i = 0; px < cw; px += 0.13 * k, i++) { x.fillStyle = col[0] || "#1e1a18"; x.fillRect(px, y0 + rowH * (i % 2 ? 0.18 : 0.08), 0.06 * k, rowH * 0.74); }
      x.fillStyle = col[2] || "#5a1f14"; x.fillRect(0, y0, cw, 0.03 * k);
    }
    for (let i = 0; i * 0.06 * k < ch; i++) [0, cw - 0.05 * k].forEach((px) => { x.fillStyle = i % 2 ? "#1e1a18" : "#f4eee6"; x.fillRect(px, i * 0.06 * k, 0.05 * k, 0.06 * k); });
  } else if (pat === "squares") {                // flat-woven: rust squares on off-white, dark seams
    const n = Math.max(3, Math.round(W / 0.34)), u = cw / n, m2 = Math.max(4, Math.round(D / 0.3)), v = ch / m2;
    for (let i = 0; i < n; i++) for (let j = 0; j < m2; j++) {
      x.fillStyle = (i + j) % 2 ? col[0] || "#a9441d" : p.color; x.fillRect(i * u, j * v, u, v);
      x.fillStyle = col[1] || "#2a1a14"; x.fillRect(i * u + u * 0.42, j * v + v * 0.42, u * 0.16, v * 0.16);
    }
    x.fillStyle = col[1] || "#2a1a14"; x.fillRect(0, 0, cw, 0.02 * k); x.fillRect(0, ch - 0.02 * k, cw, 0.02 * k);
  } else if (pat === "threads") {                // natural jute with thin coloured threads across
    for (let px = 0.08 * k, i = 0; px < cw; px += (0.06 + r() * 0.12) * k, i++) {
      x.fillStyle = col[i % col.length]; x.globalAlpha = 0.85; x.fillRect(px, 0, 0.008 * k, ch);
    }
    x.globalAlpha = 1;
  } else if (!pat && p.pile) {                   // shag: tufts catching the light, no streaks
    speckle(x, "shag", cw, ch);
  } else if (!pat) {                             // plain: a hand-made look, yarn a shade lighter and darker
    for (let i = 0; i < 40; i++) {
      x.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.03)";
      x.fillRect(r() * cw, 0, (0.02 + r() * 0.06) * k, ch);
    }
  }
  if (pat !== "hide") { x.strokeStyle = "rgba(0,0,0,0.12)"; x.lineWidth = 0.012 * k; x.strokeRect(0, 0, cw, ch); }   // the binding
  if (p.border) { x.strokeStyle = p.border; x.lineWidth = 0.07 * k; x.strokeRect(0.12 * k, 0.12 * k, cw - 0.24 * k, ch - 0.24 * k); }
  speckle(x, "yarn", cw, ch);                    // a little colour variation, like real yarn
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.repeat.set(1 / W, 1 / D); t.offset.set(0.5, 0.5);      // the rug's uv are in metres, centred
  const m = new THREE.MeshStandardMaterial({ map: t, normalMap: surface(p.fabric || "rug").normal, roughness: 1, envMapIntensity: 0.3 });
  m.normalScale.setScalar(p.pile ? 0.5 : 1);   // shaggy rugs: the tufts are drawn, the weave barely shows
  rugTextures.set(key, m);
  return m;
}
function hideShape(W, D) {                       // the outline of a cowhide, W × D
  const s = new THREE.Shape(), pts = [
    [0, -0.5], [0.13, -0.47], [0.2, -0.36], [0.33, -0.44], [0.45, -0.38], [0.4, -0.22], [0.5, -0.05], [0.44, 0.15],
    [0.5, 0.33], [0.36, 0.45], [0.22, 0.36], [0.12, 0.5], [-0.12, 0.5], [-0.22, 0.36], [-0.36, 0.45], [-0.5, 0.33],
    [-0.44, 0.15], [-0.5, -0.05], [-0.4, -0.22], [-0.45, -0.38], [-0.33, -0.44], [-0.2, -0.36], [-0.13, -0.47],
  ].map(([a, b]) => new THREE.Vector2(a * W, b * D));
  s.setFromPoints(new THREE.SplineCurve([...pts, pts[0]]).getPoints(90));
  return s;
}

/* ---------- Furniture drawn from shapes (used until / unless a scanned model exists) ---------- */
const legs4 = (b, W, D, h, color, inset = 0.05, r = 0.018, cx = 0, cz = 0) => {
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.cyl(r, r * 0.8, h, color, cx + sx * (W / 2 - inset), 0, cz + sz * (D / 2 - inset)));
};
function tvOnTop(b, W, D, H) {
  b.box(0.32, 0.02, 0.2, "#1d1d1d", 0, H, -D / 2 + 0.16);
  b.box(0.06, 0.08, 0.04, "#1d1d1d", 0, H + 0.02, -D / 2 + 0.12);
  b.box(1.23, 0.71, 0.035, "#111111", 0, H + 0.1, -D / 2 + 0.12, { r: 0.006, rough: 0.4 });
  b.box(1.19, 0.67, 0.002, "#16202b", 0, H + 0.12, -D / 2 + 0.139, { rough: 0.15, r: 0, shadow: false }).userData.screen = true;
}

/* ---------- Televisions: switched on, the screen shows a picture and lights the room ---------- */
export const TV_KINDS = new Set(["tv", "tv-stand", "tv-bench"]);
let tvMaterial = null;
function tvOnMaterial() {               // a frame from a nature film: dusk over a lake
  if (tvMaterial) return tvMaterial;
  const c = document.createElement("canvas"); c.width = 512; c.height = 288;
  const x = c.getContext("2d"), r = rand(77);
  const sky = x.createLinearGradient(0, 0, 0, 170);
  sky.addColorStop(0, "#2d4f86"); sky.addColorStop(0.55, "#d98a6a"); sky.addColorStop(1, "#f6c27a");
  x.fillStyle = sky; x.fillRect(0, 0, 512, 170);
  x.fillStyle = "#fff1c9"; x.beginPath(); x.arc(330, 150, 22, 0, Math.PI * 2); x.fill();
  const ridge = (y0, amp, col) => {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, 288);
    for (let px = 0; px <= 512; px += 16) x.lineTo(px, y0 - Math.abs(Math.sin(px / 70 + amp)) * amp * 30 - r() * 6);
    x.lineTo(512, 288); x.fill();
  };
  ridge(160, 1.6, "#5a4a6a"); ridge(172, 1.1, "#3a3550");
  const lake = x.createLinearGradient(0, 175, 0, 288);
  lake.addColorStop(0, "#e8a274"); lake.addColorStop(1, "#24304f");
  x.fillStyle = lake; x.fillRect(0, 178, 512, 110);
  x.fillStyle = "rgba(255,236,190,0.55)";
  for (let i = 0; i < 26; i++) x.fillRect(300 + (r() - 0.5) * 70, 182 + i * 4, 20 + r() * 40, 1.5);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  tvMaterial = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.25, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.25 });
  return tvMaterial;
}
// Find a television's screen (drawn or scanned), switch it on or off, and give it its light
function setTv(group, on) {
  const screens = [];
  group.traverse((o) => { if (o.isMesh && (o.userData.screen || /^screen/i.test(o.name))) screens.push(o); });
  screens.forEach((o) => {
    if (!o.userData.offMat) o.userData.offMat = o.material;
    o.material = on ? tvOnMaterial() : o.userData.offMat;
  });
  let light = group.userData.tvLight;
  if (on && screens.length && !light) {
    const s = screens.reduce((a, b) => (new THREE.Box3().setFromObject(b).getSize(new THREE.Vector3()).length() > new THREE.Box3().setFromObject(a).getSize(new THREE.Vector3()).length() ? b : a));
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(s), c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    group.worldToLocal(c);
    light = new THREE.PointLight(0xc9dcff, 0, 4.5, 2);
    light.position.set(c.x, c.y, c.z + 0.35);
    light.userData.tv = Math.max(0.6, size.x * size.y * 2.2);   // bigger screen, more light
    group.add(light); group.userData.tvLight = light;
  }
  if (light) light.intensity = on ? light.userData.tv : 0;
  group.userData.tvOn = on && screens.length > 0;
  return screens.length > 0;
}

// Soft bedding on a mattress whose top is at y: a duvet falling over the sides, a folded-back top, round pillows, a throw
function bedding(b, W, D, y, z0 = 0, p = {}, mh = 0.2) {
  const sheet = "#f7f5f0", duvet = p.duvet || "#e9e3d8", pillow = "#fbfaf7";
  b.box(W, mh, D, sheet, 0, y, z0, { r: Math.min(0.07, mh / 2.2), ...FAB });                       // mattress
  const dz = D * 0.68, front = z0 + D / 2;
  b.box(W + 0.05, mh * 0.75 + 0.06, dz, duvet, 0, y + mh * 0.25, front - dz / 2 + 0.02, { r: 0.05, ...FAB });   // duvet, over the sides
  b.box(W + 0.05, 0.07, 0.24, shade(duvet, 0.05), 0, y + mh + 0.02, front - dz + 0.1, { r: 0.035, rx: 0.06, ...FAB });  // folded back
  const n = W > 1.2 ? 2 : 1, pw = Math.min(0.62, W / n - 0.08);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : (i ? 1 : -1) * W / 4;
    b.blob(0.5, pillow, x, y + mh + 0.06, z0 - D / 2 + 0.24, pw, 0.15, 0.4, { rx: -0.2, ...FAB });
    if (W > 1.2) b.blob(0.5, shade(duvet, -0.12), x * 0.85, y + mh + 0.1, z0 - D / 2 + 0.42, pw * 0.75, 0.13, 0.32, { rx: -0.45, ...FAB });
  }
  if (W > 1.2) b.box(W + 0.06, 0.025, 0.42, p.throw || "#c2410c", 0, y + mh + 0.075, front - 0.32, { r: 0.012, ...FAB });   // a throw at the foot
}
const MODELS = {
  sofa(b, W, D, H, c) {
    const seatD = D > 1.2 ? 0.95 : D, light = shade(c, 0.035);
    const zMain = -D / 2 + seatD / 2, legC = "#2a2420";
    legs4(b, W, seatD, 0.08, legC, 0.1, 0.017, 0, zMain);
    b.box(W, 0.28, seatD, c, 0, 0.08, zMain, { r: 0.05, ...FAB });
    b.box(W - 0.04, H - 0.1, 0.22, c, 0, 0.1, -D / 2 + 0.11, { r: 0.08, ...FAB });
    [-1, 1].forEach((s) => b.box(0.2, 0.54, seatD, c, s * (W / 2 - 0.1), 0.08, zMain, { r: 0.09, ...FAB }));
    const inner = W - 0.4, n = W > 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const x = -inner / 2 + inner / n * (i + 0.5);
      b.box(inner / n - 0.02, 0.17, seatD - 0.28, light, x, 0.35, zMain + 0.1, { r: 0.075, ...FAB });
      b.box(inner / n - 0.04, 0.46, 0.2, light, x, 0.44, -D / 2 + 0.3, { r: 0.09, rx: -0.14, ...FAB });
    }
    if (D > 1.2) {                                   // chaise longue on the right
      const cw = 0.9, cd = D - seatD + 0.02, x = W / 2 - 0.2 - cw / 2;
      b.box(cw + 0.2, 0.28, cd, c, x + 0.1, 0.08, D / 2 - cd / 2, { r: 0.05, ...FAB });
      b.box(cw - 0.03, 0.17, cd + 0.2, light, x, 0.35, D / 2 - cd / 2 - 0.1, { r: 0.075, ...FAB });
      b.box(0.2, 0.54, cd, c, W / 2 - 0.1, 0.08, D / 2 - cd / 2, { r: 0.09, ...FAB });
      legs4(b, cw + 0.2, cd, 0.08, legC, 0.1, 0.017, x + 0.1, D / 2 - cd / 2);
    }
  },
  armchair(b, W, D, H, c) {
    const wood = "#4a3324";
    legs4(b, W, D, 0.2, wood, 0.08, 0.022);
    [-1, 1].forEach((s) => b.box(0.06, 0.42, D - 0.1, wood, s * (W / 2 - 0.05), 0.2, 0, { r: 0.02, ...WOOD }));
    b.box(W - 0.14, 0.16, D - 0.18, c, 0, 0.2, 0.05, { r: 0.06, ...FAB });
    b.box(W - 0.12, H - 0.24, 0.16, c, 0, 0.24, -D / 2 + 0.12, { r: 0.07, rx: -0.1, ...FAB });
  },
  "coffee-table"(b, W, D, H, c) {
    b.box(W, 0.04, D, c, 0, H - 0.04, 0, { r: 0.01, ...WOOD });
    b.box(W - 0.12, 0.012, D - 0.12, "#bcd4dc", 0, 0.14, 0, GLASS);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.box(0.045, H - 0.04, 0.045, c, sx * (W / 2 - 0.05), 0, sz * (D / 2 - 0.05), WOOD));
  },
  "tv-bench"(b, W, D, H, c) {
    legs4(b, W, D, 0.12, "#2b2622", 0.06, 0.015);
    b.box(W, H - 0.12, D, c, 0, 0.12, 0, WOOD);
    [-1, 1].forEach((s) => b.box(W / 2 - 0.03, H - 0.18, 0.012, shade(c, -0.05), s * W / 4, 0.15, D / 2, WOOD));
    tvOnTop(b, W, D, H);
  },
  "floor-lamp"(b, W, D, H, c) {
    b.cyl(0.15, 0.16, 0.025, "#b08d57", 0, 0, 0, CHROME);
    b.cyl(0.011, 0.011, H - 0.32, "#b08d57", 0, 0.025, 0, CHROME);
    b.cyl(0.15, 0.2, 0.32, c, 0, H - 0.34, 0, { glow: "#ffd7a1", rough: 0.95, tex: "fabric" });
    b.blob(0.045, "#fff6e0", 0, H - 0.2, 0, 1, 1, 1, { glow: "#ffe6bf" });
  },
  "table-lamp"(b, W, D, H, c) {
    b.cyl(0.06, 0.07, 0.02, "#b08d57", 0, 0, 0, CHROME);
    b.cyl(0.008, 0.008, H - 0.2, "#b08d57", 0, 0.02, 0, CHROME);
    b.cyl(0.1, 0.13, 0.18, c, 0, H - 0.2, 0, { glow: "#ffd7a1", rough: 0.95, tex: "fabric" });
  },
  kitchen(b, W, D, H, c) {
    const n = Math.max(1, Math.round(W / 0.6)), fw = W / n, oak = "#c49a6c";
    b.box(W, 0.1, D - 0.06, "#d9d6d1", 0, 0, -0.03, { r: 0 });
    b.box(W, 0.78, D - 0.03, c, 0, 0.1, -0.015, { r: 0 });
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + fw * (i + 0.5);
      b.box(fw - 0.006, 0.76, 0.02, c, x, 0.11, D / 2 - 0.01, { r: 0.003, rough: 0.4 });
      b.box(fw * 0.5, 0.014, 0.02, "#2b2b2b", x, 0.8, D / 2 + 0.012, { r: 0.004, ...CHROME });
    }
    b.box(W + 0.02, 0.04, D + 0.02, oak, 0, 0.88, 0, { r: 0.004, ...WOOD });
    b.box(0.55, 0.012, 0.42, "#9ba1a6", -W / 4, 0.915, 0.02, { ...CHROME, r: 0.01 });
    b.cyl(0.015, 0.015, 0.28, "#c9ccd0", -W / 4, 0.92, -0.22, CHROME);
    b.box(0.58, 0.012, 0.5, "#141414", W / 4, 0.915, 0.02, { rough: 0.25, r: 0.005 });
    b.box(W, 0.6, 0.02, "#ebe7e1", 0, 0.92, -D / 2 + 0.01, { r: 0, rough: 0.35 });          // splashback
    b.box(W, 0.72, 0.35, c, 0, 1.48, -D / 2 + 0.175, { r: 0 });                // wall cupboards
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + fw * (i + 0.5);
      b.box(fw - 0.006, 0.7, 0.02, c, x, 1.49, -D / 2 + 0.36, { r: 0.003, rough: 0.4 });
      b.box(fw * 0.5, 0.014, 0.02, "#2b2b2b", x, 1.52, -D / 2 + 0.375, { r: 0.004, ...CHROME });
    }
  },
  island(b, W, D, H, c) {
    b.box(W - 0.06, H - 0.04, D - 0.3, c, 0, 0, -0.13, { r: 0.004 });
    b.box(W, 0.04, D, "#c49a6c", 0, H - 0.04, 0, { r: 0.006, ...WOOD });
  },
  stool(b, W, D, H, c) {
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.cyl(0.013, 0.013, 0.72, c, sx * 0.15, 0, sz * 0.15));
    b.box(0.32, 0.015, 0.015, c, 0, 0.3, 0.15); b.box(0.32, 0.015, 0.015, c, 0, 0.3, -0.15);
    b.box(W - 0.04, 0.04, D - 0.04, "#3a2a20", 0, 0.72, 0, { r: 0.015, ...WOOD });
    b.box(W - 0.06, 0.16, 0.025, c, 0, H - 0.18, -D / 2 + 0.03, { r: 0.008 });
    [-1, 1].forEach((s) => b.box(0.02, H - 0.76, 0.02, c, s * (W / 2 - 0.06), 0.76, -D / 2 + 0.03));
  },
  table(b, W, D, H, c) {
    b.box(W, 0.035, D, c, 0, H - 0.035, 0, { r: 0.008, ...WOOD });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.box(0.05, H - 0.035, 0.05, c, sx * (W / 2 - 0.07), 0, sz * (D / 2 - 0.07), WOOD));
    b.box(W - 0.2, 0.06, 0.02, c, 0, H - 0.1, D / 2 - 0.07, WOOD); b.box(W - 0.2, 0.06, 0.02, c, 0, H - 0.1, -D / 2 + 0.07, WOOD);
  },
  desk(b, W, D, H, c) {
    MODELS.table(b, W, D, H, c);
    b.box(0.4, 0.15, D - 0.15, shade(c, -0.04), W / 2 - 0.28, H - 0.19, 0, WOOD);
    b.box(0.6, 0.38, 0.02, "#202020", -0.1, H, -D / 2 + 0.18, { r: 0.005 });     // a screen
    b.box(0.2, 0.02, 0.14, "#202020", -0.1, H, -D / 2 + 0.2);
  },
  chair(b, W, D, H, c) {
    [[-1, 1], [1, 1]].forEach(([sx, sz]) => b.cyl(0.016, 0.014, 0.44, c, sx * (W / 2 - 0.04), 0, sz * (D / 2 - 0.05)));
    [-1, 1].forEach((sx) => b.box(0.03, H, 0.03, c, sx * (W / 2 - 0.04), 0, -D / 2 + 0.04, { r: 0.008 }));
    b.box(W, 0.04, D - 0.04, c, 0, 0.44, 0.01, { r: 0.01, ...WOOD });
    b.box(W - 0.05, 0.03, D - 0.1, "#4a3426", 0, 0.48, 0.03, { r: 0.012 });
    b.box(W - 0.04, 0.2, 0.025, c, 0, H - 0.22, -D / 2 + 0.04, { r: 0.008, ...WOOD });
  },
  // Beds: the frame by style (upholstered, MALM-like panels, wood, metal), soft bedding on top
  bed(b, W, D, H, c, p = {}) {
    const st = p.bedStyle || "upholstered";
    let top;
    if (st === "panel") {                          // flat panels all round, the mattress sits inside
      b.box(W, 0.38, D - 0.04, c, 0, 0.02, 0.02, { r: 0.006, rough: 0.5 });
      b.box(W, H, 0.04, c, 0, 0, -D / 2 + 0.02, { r: 0.006, rough: 0.5 });
      b.box(W - 0.06, 0.012, D - 0.12, shade(c, -0.08), 0, 0.395, 0.02, { r: 0.002 });
      top = 0.26;
    } else if (st === "wood") {
      legs4(b, W, D, 0.3, c, 0.04, 0.03);
      b.box(W, 0.16, D, c, 0, 0.18, 0, { r: 0.01, ...WOOD });
      b.box(W, H - 0.18, 0.05, c, 0, 0.18, -D / 2 + 0.025, { r: 0.01, ...WOOD });
      for (let i = 0; i < 4; i++) b.box(0.012, H - 0.45, 0.02, shade(c, -0.05), -W / 2 + W * (i + 1) / 5, 0.38, -D / 2 + 0.055, WOOD);
      top = 0.34;
    } else {                                       // upholstered frame and a tall soft headboard
      legs4(b, W, D, 0.06, "#2a2420", 0.1, 0.02);
      b.box(W, 0.28, D, c, 0, 0.06, 0, { r: 0.045, ...FAB });
      b.box(W, H - 0.06, 0.12, c, 0, 0.06, -D / 2 + 0.06, { r: 0.05, ...FAB });
      const n = Math.max(2, Math.round(W / 0.45));   // channel stitching on the headboard
      for (let i = 1; i < n; i++) b.box(0.012, H - 0.42, 0.01, shade(c, -0.06), -W / 2 + W * i / n, 0.4, -D / 2 + 0.122, { r: 0.004, ...FAB });
      top = 0.34;
    }
    bedding(b, W - (st === "panel" ? 0.08 : 0.06), D - 0.16, top, 0.06, p);
  },
  // Bunk beds: two decks, posts, rails round the top one and a ladder on the long side
  bunk(b, W, D, H, c, p = {}) {
    const metal = p.bedStyle === "metal", t = metal ? 0.025 : 0.055, upper = H - (metal ? 0.45 : 0.62);
    const post = (x, z) => metal ? b.cyl(t, t, H, c, x, 0, z, { ...CHROME, rough: 0.45, metal: 0.6, seg: 16 }) : b.box(t, H, t, c, x, 0, z, { r: 0.008, ...WOOD });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => post(sx * (W / 2 - t / 2), sz * (D / 2 - t / 2)));
    const rail = (y, side, h = 0.07) => {          // a rail along a long side (x = ±) or across an end (z = ±)
      if (side === "x+" || side === "x-") b.box(metal ? 0.03 : 0.025, h, D - 2 * t, c, (side === "x+" ? 1 : -1) * (W / 2 - t / 2), y, 0, metal ? { ...CHROME, rough: 0.45, metal: 0.6 } : WOOD);
      else b.box(W - 2 * t, h, metal ? 0.03 : 0.025, c, 0, y, (side === "z+" ? 1 : -1) * (D / 2 - t / 2), metal ? { ...CHROME, rough: 0.45, metal: 0.6 } : WOOD);
    };
    [0.16, upper].forEach((y) => { ["x+", "x-", "z+", "z-"].forEach((sd) => rail(y, sd, 0.12)); });
    // the top bed's guard: both ends and the wall side all the way, the front only up to the ladder
    [upper + 0.28, H - 0.06].forEach((y) => { rail(y, "z+", 0.05); rail(y, "z-", 0.05); rail(y, "x-", 0.05); });
    b.box(metal ? 0.03 : 0.025, 0.05, D * 0.6, c, W / 2 - t / 2, H - 0.06, -D * 0.2 + t, metal ? { ...CHROME, rough: 0.45, metal: 0.6 } : WOOD);
    [-1, 1].forEach((s) => b.box(W - 0.1, 0.25, 0.022, c, 0, s < 0 ? 0.28 : upper + 0.12, -D / 2 + t / 2 + 0.01, metal ? { ...CHROME, rough: 0.45, metal: 0.6 } : WOOD));   // head panels
    // ladder at the foot end of the front side
    const lz = D / 2 - 0.36;
    [-0.2, 0.2].forEach((dz) => b.box(0.035, upper + 0.4, 0.035, c, W / 2 + 0.02, 0, lz + dz, metal ? { ...CHROME, rough: 0.45, metal: 0.6 } : WOOD));
    for (let y = 0.3; y < upper + 0.2; y += 0.27) b.box(0.03, 0.03, 0.4, c, W / 2 + 0.02, y, lz, metal ? { ...CHROME, rough: 0.45, metal: 0.6 } : WOOD);
    bedding(b, W - 2 * t - 0.02, D - 2 * t - 0.02, 0.28, 0, p, 0.14);
    bedding(b, W - 2 * t - 0.02, D - 2 * t - 0.02, upper + 0.12, 0, p, 0.14);
  },
  bedside(b, W, D, H, c) {
    legs4(b, W, D, 0.1, c, 0.03, 0.014);
    b.box(W, H - 0.1, D, c, 0, 0.1, 0, WOOD);
    b.box(W - 0.04, 0.15, 0.012, shade(c, -0.05), 0, H - 0.2, D / 2, WOOD);
    b.cyl(0.012, 0.012, 0.02, "#2b2b2b", 0, H - 0.135, D / 2 + 0.012, { rx: Math.PI / 2 });
  },
  chest(b, W, D, H, c) {
    legs4(b, W, D, 0.1, c, 0.03, 0.016);
    b.box(W, H - 0.1, D, c, 0, 0.1, 0, WOOD);
    const rows = 3, rh = (H - 0.16) / rows;
    for (let r = 0; r < rows; r++) [-1, 1].forEach((s) => {
      b.box(W / 2 - 0.03, rh - 0.02, 0.012, shade(c, -0.04), s * W / 4, 0.13 + r * rh, D / 2, WOOD);
      b.box(0.12, 0.012, 0.02, "#2b2b2b", s * W / 4, 0.13 + r * rh + rh / 2, D / 2 + 0.012, CHROME);
    });
  },
  wardrobe(b, W, D, H, c) {
    b.box(W, H, D, c, 0, 0, 0, { r: 0.004, rough: 0.55 });
    const n = Math.max(1, Math.round(W / 0.55)), dw = W / n;
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + dw * (i + 0.5);
      b.box(dw - 0.008, H - 0.06, 0.018, c, x, 0.04, D / 2 + 0.005, { r: 0.003, rough: 0.5 });
      b.box(0.015, 0.3, 0.02, "#2b2b2b", x + (i % 2 ? -1 : 1) * (dw / 2 - 0.06), H / 2 - 0.1, D / 2 + 0.022, { r: 0.005, ...CHROME });
    }
  },
  bathtub(b, W, D, H, c) {
    b.cyl(0.5, 0.46, H, c, 0, 0, 0, { sx: W, sz: D, seg: 48, rough: 0.2 });
    b.cyl(0.5, 0.5, 0.01, "#bcd9e3", 0, H - 0.1, 0, { sx: W - 0.14, sz: D - 0.14, seg: 48, rough: 0.05, shadow: false });
    b.cyl(0.015, 0.015, 0.95, "#c9ccd0", W / 2 + 0.08, 0, 0, CHROME);
    b.box(0.2, 0.025, 0.025, "#c9ccd0", W / 2 - 0.02, 0.93, 0, CHROME);
  },
  shower(b, W, D, H, c) {
    b.box(W, 0.035, D, "#dedbd6", 0, 0, 0, { r: 0.01, rough: 0.4 });
    b.box(0.006, 0.6, D, "#7b8085", W / 2 - 0.02, 0.035, 0, { r: 0, rough: 0.6 });
    b.box(W * 0.8, H, 0.01, "#cfe6f2", -W * 0.1, 0.035, D / 2 - 0.01, { ...GLASS, r: 0 });
    b.box(W * 0.8, 0.025, 0.025, c, -W * 0.1, H + 0.02, D / 2 - 0.01, { r: 0 });
    b.cyl(0.012, 0.012, 1.1, "#c9ccd0", -W / 2 + 0.08, 1.0, -D / 2 + 0.06, CHROME);
    b.cyl(0.1, 0.1, 0.015, "#c9ccd0", -W / 2 + 0.2, 2.1, -D / 2 + 0.2, CHROME);
  },
  vanity(b, W, D, H, c) {
    b.box(W, 0.48, D, c, 0, 0.34, 0, { r: 0.004, ...WOOD });
    [-1, 1].forEach((s) => b.box(W / 2 - 0.02, 0.46, 0.012, shade(c, -0.04), s * W / 4, 0.35, D / 2, WOOD));
    b.box(W, 0.03, D + 0.01, "#efedea", 0, 0.82, 0, { r: 0.004, rough: 0.3 });
    [-1, 1].forEach((s) => {
      b.cyl(0.18, 0.15, 0.11, "#ffffff", s * W / 4, 0.85, 0.02, { rough: 0.2, sz: 0.85 });
      b.cyl(0.012, 0.012, 0.2, "#c9ccd0", s * W / 4, 0.85, -D / 2 + 0.06, CHROME);
    });
    b.box(W * 0.92, 0.75, 0.02, "#d7dfe3", 0, 1.15, -D / 2 + 0.01, { rough: 0.05, metal: 0.85, r: 0.01 });
  },
  toilet(b, W, D, H, c) {
    b.box(W + 0.12, 1.0, 0.1, "#ece9e4", 0, 0, -D / 2 + 0.05, { r: 0.01 });
    b.box(0.22, 0.15, 0.012, "#c9ccd0", 0, 0.9, -D / 2 + 0.105, CHROME);
    b.box(W, 0.3, D - 0.08, c, 0, 0.12, 0.04, { r: 0.1, rough: 0.2 });
    b.box(W - 0.01, 0.03, D - 0.12, "#ffffff", 0, 0.42, 0.05, { r: 0.012, rough: 0.2 });
  },
  "tall-cabinet"(b, W, D, H, c) {
    b.box(W, H, D, c, 0, 0.25, 0, { r: 0.004, rough: 0.25 });
    b.box(W - 0.02, H - 0.42, 0.012, c, 0, 0.6, D / 2, { r: 0.003, rough: 0.25 });
    b.box(W - 0.02, 0.32, 0.012, c, 0, 0.26, D / 2, { r: 0.003, rough: 0.25 });
  },
  lounger(b, W, D, H, c) {
    b.box(W, 0.06, D, c, 0, 0.22, 0, { r: 0.01, ...WOOD });
    legs4(b, W, D, 0.22, c, 0.05, 0.02);
    b.box(W - 0.04, 0.07, D * 0.62, "#ebe1cf", 0, 0.28, D * 0.18, { r: 0.03, ...FAB });
    b.box(W - 0.04, 0.07, D * 0.4, "#ebe1cf", 0, 0.42, -D / 2 + D * 0.2, { r: 0.03, rx: 0.65, ...FAB });
  },
  bistro(b, W, D, H, c) {
    b.cyl(0.3, 0.3, 0.025, c, 0, H - 0.025, 0);
    b.cyl(0.02, 0.02, H - 0.025, c, 0, 0, 0);
    b.cyl(0.2, 0.22, 0.02, c, 0, 0, 0);
    [-1, 1].forEach((s) => {
      const x = s * (W / 2 - 0.2);
      b.box(0.4, 0.03, 0.4, "#b88c5a", x, 0.44, 0, { r: 0.01, ...WOOD });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, z]) => b.cyl(0.012, 0.012, 0.44, c, x + a * 0.17, 0, z * 0.17));
      b.box(0.03, 0.36, 0.38, c, x + s * 0.19, 0.47, 0, { r: 0.008 });
    });
  },
  planter(b, W, D, H, c) {
    b.cyl(W / 2, W / 2 * 0.8, H, c, 0, 0, 0, { rough: 0.95 });
    b.blob(W * 0.42, "#4f7a46", 0, H + W * 0.25, 0, 1, 0.8, 1);
  },
  plant(b, W, D, H, c) {
    const pot = Math.min(0.17, W / 2.6);
    b.cyl(pot, pot * 0.78, pot * 1.6, "#ece6dc", 0, 0, 0, { rough: 0.6 });
    b.cyl(pot * 0.95, pot * 0.95, 0.01, "#5a4636", 0, pot * 1.55, 0, { shadow: false });
    const leaves = H > 1.3 ? 9 : H > 1 ? 12 : 8;
    for (let i = 0; i < leaves; i++) {
      const a = (i / leaves) * Math.PI * 2 + (i % 2) * 0.4;
      const t = (i % 3) / 3;
      const y = pot * 1.6 + (H - pot * 1.6) * (0.35 + 0.5 * t);
      const reach = W * (0.18 + 0.2 * (1 - t));
      if (H > 1.3) b.blob(0.1, shade(c, (i % 3) * 0.04 - 0.04), Math.cos(a) * reach, y, Math.sin(a) * reach, 0.9, 3.2, 0.25, { ry: -a, rz: Math.cos(a) * 0.35, rx: Math.sin(a) * 0.35 });
      else b.blob(0.1, shade(c, (i % 3) * 0.04 - 0.04), Math.cos(a) * reach, y, Math.sin(a) * reach, 1.6, 0.35, 1.3, { ry: -a });
    }
    if (H > 1 && H <= 1.3) b.cyl(0.025, 0.035, H * 0.55, "#7a6248", 0, pot * 1.5, 0);
  },
  rug(b, W, D, H, c, p) {
    const o = { shadow: false, rough: 1, tex: p.fabric || "rug" };
    if (p.pattern === "hide") {
      const m = rugTexture(p, W, D), shape = hideShape(W, D);
      b.flat(shape, m, 0.006);                  // ShapeGeometry uv are in metres, like the canvas expects
      return;
    }
    // one soft slab; its top shows the woven pattern (uv in metres, centred, like the canvas)
    const th = p.pile ? 0.025 : 0.012;
    if (p.round) b.cyl(W / 2, W / 2, th, c, 0, 0, 0, { ...o, seg: 72 }).material = rugTexture(p, W, D);
    else b.box(W, th, D, c, 0, 0, 0, { ...o, r: Math.min(0.006, th / 2.2), material: rugTexture(p, W, D) });
  },
  candles(b, W, D, H, c) {                       // block candles, lit: one, or three when there's room
    const r = Math.min(0.036, W / 2 - 0.002);
    (W < 0.12 ? [[0, 0, H]] : [[-0.045, 0.02, H], [0.05, -0.03, H * 0.74], [0.012, 0.055, H * 0.52]]).forEach(([x, z, h]) => {
      b.cyl(r, r, h, c, x, 0, z, { rough: 0.45, seg: 40 });
      b.cyl(r - 0.003, r - 0.003, 0.004, shade(c, -0.06), x, h - 0.003, z, { rough: 0.4, seg: 40, shadow: false });
      b.cyl(0.0015, 0.0015, 0.012, "#2b2420", x, h - 0.002, z, { shadow: false });
      b.blob(0.0065, "#ffd27a", x, h + 0.021, z, 0.75, 2.3, 0.75, { glow: "#ffb347", shadow: false });
    });
  },
  decor(b, W, D, H, c) {                          // until the scan arrives
    b.box(W * 0.8, H, D * 0.8, c, 0, 0, 0, { r: Math.min(W, D) * 0.2, rough: 0.5 });
  },
  art(b, W, D, H, c) {                            // a framed picture, until the scan arrives
    b.box(W, H, D, "#2b2622", 0, 0, 0, { r: 0.004, ...WOOD });
    b.box(W - 0.06, H - 0.06, 0.004, c, 0, 0.03, D / 2, { r: 0, rough: 0.8 });
  },
  "kitchen-base"(b, W, D, H, c, p) {             // one base unit with worktop: drawers or a sink
    const front = p.front === "wood" ? { ...WOOD, rough: 0.55 } : { rough: 0.42 };
    b.box(W, 0.1, D - 0.07, "#262626", 0, 0, -0.035, { r: 0 });
    b.box(W, 0.78, D - 0.03, "#ece9e4", 0, 0.1, -0.015, { r: 0 });
    const rows = p.sink ? [0.77] : W > 0.7 ? [0.13, 0.19, 0.2, 0.25] : [0.2, 0.26, 0.31];
    let y = 0.875;
    rows.forEach((h) => {
      y -= h;
      b.box(W - 0.006, h - 0.004, 0.02, c, 0, y + 0.002, D / 2 - 0.01, { r: 0.003, ...front });
      b.box(Math.min(0.36, W * 0.55), 0.012, 0.018, "#3a3a3a", 0, y + h - 0.05, D / 2 + 0.01, { r: 0.004, ...CHROME });
    });
    b.box(W + 0.01, 0.038, D + 0.02, p.top || "#c49a6c", 0, 0.88, 0, { r: 0.003, ...WOOD });
    if (p.sink) {
      b.box(W * 0.62, 0.006, 0.4, "#9ca2a7", 0, 0.918, 0.02, { ...CHROME, r: 0.02 });
      b.cyl(0.016, 0.02, 0.05, "#c9ccd0", 0, 0.918, -0.24, CHROME);
      b.cyl(0.011, 0.011, 0.3, "#c9ccd0", 0, 0.93, -0.24, CHROME);
      b.box(0.022, 0.022, 0.2, "#c9ccd0", 0, 1.21, -0.15, { ...CHROME, r: 0.01 });
    }
  },
  "tall-fridge"(b, W, D, H, c) {                 // fridge hidden behind cupboard doors
    b.box(W, 0.1, D - 0.07, "#262626", 0, 0, -0.035, { r: 0 });
    b.box(W, H - 0.1, D - 0.03, "#ece9e4", 0, 0.1, -0.015, { r: 0 });
    [[0.1, 1.38], [1.49, H - 1.49]].forEach(([y0, h]) => {
      b.box(W - 0.006, h - 0.006, 0.02, c, 0, y0 + 0.003, D / 2 - 0.01, { r: 0.003, rough: 0.42 });
      b.box(0.014, Math.min(0.4, h * 0.4), 0.018, "#3a3a3a", W / 2 - 0.06, y0 + h / 2 - 0.15, D / 2 + 0.01, { r: 0.004, ...CHROME });
    });
  },
  fridge(b, W, D, H, c) {                         // freestanding fridge-freezer
    b.box(W, H - 0.02, D - 0.04, c, 0, 0.02, -0.02, { r: 0.02, rough: 0.3 });
    const split = H * 0.66;
    b.box(W - 0.01, H - split - 0.03, 0.04, c, 0, split + 0.01, D / 2 - 0.02, { r: 0.02, rough: 0.3 });
    b.box(W - 0.01, split - 0.05, 0.04, c, 0, 0.04, D / 2 - 0.02, { r: 0.02, rough: 0.3 });
    b.box(0.02, 0.3, 0.03, "#b9bcbf", -W / 2 + 0.05, split - 0.4, D / 2 + 0.01, { r: 0.008, ...CHROME });
    b.box(0.02, 0.2, 0.03, "#b9bcbf", -W / 2 + 0.05, split + 0.06, D / 2 + 0.01, { r: 0.008, ...CHROME });
    legs4(b, W, D, 0.02, "#222", 0.05, 0.015);
  },
  sideboard(b, W, D, H, c) {                      // long low cabinet on legs, with doors
    const legH = 0.16, n = Math.max(2, Math.round(W / 0.42));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.cyl(0.018, 0.013, legH, shade(c, -0.08), sx * (W / 2 - 0.06), 0, sz * (D / 2 - 0.06), WOOD));
    b.box(W, H - legH, D - 0.02, c, 0, legH, -0.01, { r: 0.006, ...WOOD });
    for (let i = 0; i < n; i++) {
      const fw = W / n, x = -W / 2 + fw * (i + 0.5);
      b.box(fw - 0.008, H - legH - 0.04, 0.018, shade(c, 0.015), x, legH + 0.02, D / 2 - 0.009, { r: 0.003, ...WOOD });
      for (let k = 1; k < 6; k++) b.box(0.004, H - legH - 0.08, 0.004, shade(c, -0.1), x - fw / 2 + fw * k / 6, legH + 0.04, D / 2 + 0.001, { r: 0, shadow: false });
    }
  },
  "wing-chair"(b, W, D, H, c) {               // high back with "ears", like a STRANDMON
    const wood = "#3b2a1f", light = shade(c, 0.04);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => b.cyl(0.022, 0.016, 0.16, wood, sx * (W / 2 - 0.09), 0, sz * (D / 2 - 0.09)));
    b.box(W - 0.06, 0.26, D - 0.06, c, 0, 0.16, 0.02, { r: 0.04, ...FAB });
    b.box(W - 0.3, 0.13, D - 0.3, light, 0, 0.4, 0.08, { r: 0.05, ...FAB });
    b.box(W - 0.1, H - 0.18, 0.2, c, 0, 0.18, -D / 2 + 0.12, { r: 0.07, rx: -0.08, ...FAB });
    [-1, 1].forEach((s) => {
      b.box(0.15, 0.36, D - 0.2, c, s * (W / 2 - 0.09), 0.36, 0.08, { r: 0.06, ...FAB });             // arm
      b.blob(0.075, c, s * (W / 2 - 0.09), 0.72, D / 2 - 0.13, 1, 0.9, 1.1, FAB);                     // rolled front
      b.box(0.13, 0.42, 0.42, c, s * (W / 2 - 0.1), H - 0.48, -D / 2 + 0.26, { r: 0.06, ry: s * 0.25, ...FAB }); // wing
    });
  },
  footstool(b, W, D, H, c) {
    legs4(b, W, D, 0.12, "#3b2a1f", 0.07, 0.02);
    b.box(W, H - 0.12, D, c, 0, 0.12, 0, { r: 0.06, rough: 0.55 });
  },
  bookcase(b, W, D, H, c, p) {                     // open shelves with books
    const t = 0.018, n = Math.max(3, Math.round(H / 0.36)), gap = (H - 0.06 - t) / n;
    b.box(W, H, 0.008, shade(c, -0.03), 0, 0, -D / 2 + 0.004, { r: 0 });
    [-1, 1].forEach((s) => b.box(t, H, D, c, s * (W / 2 - t / 2), 0, 0, { r: 0.002 }));
    b.box(W, 0.06, D - 0.02, c, 0, 0, 0.01, { r: 0.002 });
    for (let i = 0; i <= n; i++) b.box(W - 2 * t, t, D - 0.01, c, 0, 0.06 + i * gap, 0, { r: 0.002 });
    for (let i = 0; i < n; i++) b.slots.push({ y: 0.06 + i * gap + t, x0: -W / 2 + t + 0.01, x1: W / 2 - t - 0.01, zFront: D / 2 - 0.015, maxH: gap - t - 0.015 });
  },
  bench(b, W, D, H, c) {
    b.box(W, H - 0.1, D, c, 0, 0, 0, { r: 0.01, ...WOOD });
    b.box(W - 0.02, 0.08, D - 0.02, shade(c, 0.08), 0, H - 0.1, 0, { r: 0.03, ...FAB });
  },
  basket(b, W, D, H, c) {
    b.cyl(W / 2, W / 2 * 0.85, H, c, 0, 0, 0, { rough: 1, tex: "jute" });
    b.cyl(W / 2 + 0.01, W / 2 + 0.01, 0.03, shade(c, -0.08), 0, H - 0.03, 0);
  },
  "wall-deco"(b, W, D, H, c, p) { (WALL_DECO[p.deco] || WALL_DECO.poster)(b, W, D, H, c, p); },
  "wall-lamp"(b, W, D, H, c) {                   // a wall sconce: back plate, arm, linen shade
    b.cyl(0.05, 0.05, 0.012, "#b08d57", 0, 0, -D / 2 + 0.006, { rx: Math.PI / 2, ...BRASS }).position.y = H * 0.4;
    b.box(0.012, 0.012, D * 0.6, "#b08d57", 0, H * 0.4, -D / 2 + D * 0.3, { r: 0.004, ...BRASS });
    b.cyl(W * 0.32, W / 2, H * 0.55, c, 0, H * 0.4, D * 0.12, { seg: 40, rough: 0.9, glow: "#ffcf8a" });
  },
  "ping-pong"(b, W, D, H, c) {                   // blue top with white lines, the net across, folding legs on wheels
    const top = 0.025, y = H - top;
    b.box(W, top, D, c, 0, y, 0, { r: 0.004, rough: 0.45 });
    const line = (w, d, x, z) => b.box(w, 0.002, d, "#f4f4f2", x, H, z, { r: 0, shadow: false });
    line(W, 0.02, 0, D / 2 - 0.01); line(W, 0.02, 0, -D / 2 + 0.01);
    line(0.02, D, W / 2 - 0.01, 0); line(0.02, D, -W / 2 + 0.01, 0);
    line(W, 0.003, 0, 0);
    // the net: posts, a white band on top and the mesh
    [-1, 1].forEach((s) => b.box(0.03, 0.17, 0.03, "#1d1d1d", 0, H - 0.01, s * (D / 2 + 0.06), { r: 0.004 }));
    b.box(0.006, 0.15, D + 0.12, "#2a2a2a", 0, H, 0, { r: 0, opacity: 0.55, shadow: false });
    b.box(0.012, 0.016, D + 0.12, "#f4f4f2", 0, H + 0.145, 0, { r: 0.002 });
    // frame and legs
    const lh = y - 0.06;
    [-1, 1].forEach((sx) => {
      b.box(0.04, 0.05, D - 0.2, "#2b2b2b", sx * (W / 2 - 0.4), y - 0.05, 0, { r: 0.004, ...STEEL });
      [-1, 1].forEach((sz) => {
        b.box(0.04, lh, 0.04, "#2b2b2b", sx * (W / 2 - 0.4), 0.06, sz * (D / 2 - 0.15), { r: 0.006, ...STEEL });
        b.cyl(0.04, 0.04, 0.03, "#1a1a1a", sx * (W / 2 - 0.4), 0.0, sz * (D / 2 - 0.15), { rx: Math.PI / 2, seg: 20 });
      });
      b.box(0.03, 0.03, D - 0.3, "#2b2b2b", sx * (W / 2 - 0.4), 0.18, 0, { r: 0.004, ...STEEL });
    });
  },
  billiard(b, W, D, H, c) {                      // felt bed, padded rails, six pockets, solid base and legs
    const rail = 0.1, bedY = H - 0.06;
    b.box(W - 0.06, 0.04, D - 0.06, c, 0, bedY, 0, { r: 0.004, rough: 1, tex: "fabric" });
    [[W, rail, 0, D / 2 - rail / 2], [W, rail, 0, -D / 2 + rail / 2], [rail, D - 2 * rail, W / 2 - rail / 2, 0], [rail, D - 2 * rail, -W / 2 + rail / 2, 0]]
      .forEach(([w, d, x, z]) => {
        b.box(w, 0.06, d, "#3a2a1e", x, H - 0.06, z, { r: 0.012, ...WOOD });
      });
    // cushions on the inner edge of the rails, in the felt colour
    [[W - 2 * rail - 0.12, 0.035, 0, D / 2 - rail - 0.0175], [W - 2 * rail - 0.12, 0.035, 0, -D / 2 + rail + 0.0175]].forEach(([w, d, x, z]) =>
      [-1, 1].forEach((s) => b.box(w / 2 - 0.04, 0.035, d, shade(c, -0.05), s * (w / 4 + 0.02), bedY + 0.035, z, { r: 0.01, rough: 1 })));
    [-1, 1].forEach((s) => b.box(0.035, 0.035, D - 2 * rail - 0.14, shade(c, -0.05), s * (W / 2 - rail - 0.0175), bedY + 0.035, 0, { r: 0.01, rough: 1 }));
    // pockets: four corners and two in the middle of the long sides
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]].forEach(([sx, sz]) =>
      b.cyl(0.055, 0.05, 0.03, "#111", sx * (W / 2 - rail * 0.8), H - 0.015, sz * (D / 2 - rail * 0.8), { seg: 24 }));
    // apron and legs
    b.box(W - 0.1, 0.2, D - 0.1, "#3a2a1e", 0, H - 0.27, 0, { r: 0.01, ...WOOD });
    [-1, 1].forEach((sx) => [-1, 1].forEach((sz) =>
      b.box(0.12, H - 0.27, 0.12, "#30231a", sx * (W / 2 - 0.16), 0, sz * (D / 2 - 0.16), { r: 0.02, ...WOOD })));
    // a few balls and the cue ball
    const balls = ["#f5f2e8", "#e0b020", "#1d3f8f", "#c0392b", "#5b2a86", "#e67e22", "#1e7a46", "#7b1e1e", "#151515"];
    balls.forEach((col, i) => {
      const row = i === 0 ? 0 : Math.ceil((Math.sqrt(8 * i + 1) - 1) / 2);
      const k = i === 0 ? 0 : i - (row * (row - 1)) / 2 - 1;
      const x = i === 0 ? -W * 0.25 : W * 0.18 + row * 0.05, z = i === 0 ? 0 : (k - (row - 1) / 2) * 0.058;
      b.blob(0.028, col, x, bedY + 0.04 + 0.028, z, 1, 1, 1, { rough: 0.2 });
    });
  },
  curtains(b, W, D, H, c, p) {
    // the rod, a little longer than the fabric, on two brackets, with a ball at each end
    // (cyl() stands a cylinder on its base: lying down, its height is set after)
    const rodY = H - 0.035;
    b.cyl(0.011, 0.011, W + 0.06, "#2b2b2b", 0, 0, 0, { rz: Math.PI / 2, ...CHROME }).position.y = rodY;
    [-1, 1].forEach((s) => {
      b.blob(0.02, "#2b2b2b", s * (W / 2 + 0.05), rodY, 0, 1, 1, 1, { ...CHROME });
      b.box(0.014, 0.045, 0.07, "#2b2b2b", s * (W / 2 - 0.05), rodY - 0.03, -0.035, { r: 0.004, ...CHROME });
    });
    // Drawn open: each side gathers into pleats beside the glass. The stack grows with the curtain
    // (a wider curtain is more fabric), so it fits the 40 cm past the window that made-to-measure leaves.
    // Hung on a window (p.glass, its width), the folds keep to the wall beside the glass when they can.
    let stack = Math.min(W / 2 - 0.04, Math.max(0.16, Math.min(0.4, W * 0.16)));
    if (p?.glass) stack = Math.min(stack, Math.max(0.08, (W - p.glass) / 2 - 0.01));
    const n = Math.max(3, Math.round(stack / 0.05)), pw = stack / n, amp = Math.min(0.045, pw * 0.9);
    const len = Math.hypot(pw, amp), ang = Math.atan2(amp, pw);
    const drop = H - 0.07;                          // from just above the floor to the rings
    [-1, 1].forEach((s) => {
      for (let i = 0; i < n; i++) {
        const x = s * (W / 2 - 0.01 - (i + 0.5) * pw);
        b.box(len + 0.004, drop, 0.012, c, x, 0.012, 0, { r: 0.004, ry: (i % 2 ? 1 : -1) * ang, ...FAB });
        if (i % 2 === 0) b.cyl(0.016, 0.016, 0.008, "#2b2b2b", x - s * pw / 2, 0, 0, { rz: Math.PI / 2, ...CHROME }).position.y = rodY - 0.004;
      }
    });
  },
};

/* ---------- Things for the walls, drawn here: posters, plants, lights, a guitar… ---------- */
// Pictures painted on a canvas, so posters have something on them: style → texture
const artTex = new Map();
function wallArt(style, w, h) {
  const key = `${style}|${w.toFixed(2)}|${h.toFixed(2)}`;
  if (artTex.has(key)) return artTex.get(key);
  const c = document.createElement("canvas");
  c.width = 384; c.height = Math.max(64, Math.round(384 * h / w));
  const x = c.getContext("2d"), W = c.width, H = c.height, r = rand(style.length * 131 + 7);
  const paper = { arches: "#f1e8da", sun: "#efe4d2", lines: "#f4f1ea", botanical: "#f3efe4", map: "#eef0ea", tapestry: "#e8dcc6", plate: "#f6f4ef", stripes: "#e9e1d2" }[style] || "#f2ece2";
  x.fillStyle = paper; x.fillRect(0, 0, W, H);
  if (style === "arches") {
    [[0.36, "#c2410c"], [0.26, "#d9a066"], [0.16, "#7c8b6a"]].forEach(([rr, col]) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(W * (0.5 - rr), H * 0.92);
      x.arc(W * 0.5, H * 0.62, W * rr, Math.PI, 0); x.lineTo(W * (0.5 + rr), H * 0.92); x.closePath(); x.fill();
    });
  } else if (style === "sun") {
    x.fillStyle = "#e7b77a"; x.fillRect(0, H * 0.62, W, H * 0.38);
    x.fillStyle = "#c2410c"; x.beginPath(); x.arc(W * 0.5, H * 0.5, W * 0.24, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#7c8b6a"; x.beginPath(); x.moveTo(0, H); x.quadraticCurveTo(W * 0.35, H * 0.55, W * 0.7, H * 0.8); x.lineTo(W, H * 0.72); x.lineTo(W, H); x.fill();
  } else if (style === "lines") {
    x.strokeStyle = "#2f3e46"; x.lineWidth = 3;
    for (let i = 0; i < 9; i++) { x.beginPath(); const y = H * (0.15 + i * 0.085); x.moveTo(W * 0.12, y); x.bezierCurveTo(W * 0.4, y - 30 * r(), W * 0.6, y + 30 * r(), W * 0.88, y); x.stroke(); }
    x.fillStyle = "#c2410c"; x.beginPath(); x.arc(W * 0.7, H * 0.3, W * 0.08, 0, Math.PI * 2); x.fill();
  } else if (style === "botanical") {
    x.strokeStyle = "#4f5d43"; x.lineWidth = 3; x.beginPath(); x.moveTo(W * 0.5, H * 0.9); x.quadraticCurveTo(W * 0.45, H * 0.5, W * 0.55, H * 0.12); x.stroke();
    x.fillStyle = "#7c8b6a";
    for (let i = 0; i < 9; i++) {
      const t = 0.18 + i * 0.08, side = i % 2 ? 1 : -1;
      x.save(); x.translate(W * (0.5 + (0.03 - t * 0.04)), H * (0.9 - t * 0.85)); x.rotate(side * 0.9);
      x.beginPath(); x.ellipse(side * W * 0.1, 0, W * 0.11, W * 0.035, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
  } else if (style === "map") {
    x.strokeStyle = "#8a9a86"; x.lineWidth = 1.6;
    for (let k = 0; k < 14; k++) {
      x.beginPath(); const rr = 12 + k * 13;
      for (let a = 0; a <= 64; a++) {
        const t = a / 64 * Math.PI * 2, n = 1 + 0.18 * Math.sin(t * 3 + k * 0.4) + 0.1 * Math.cos(t * 5 - k);
        const px = W / 2 + Math.cos(t) * rr * n * 1.1, py = H / 2 + Math.sin(t) * rr * n * 0.8;
        if (a) x.lineTo(px, py); else x.moveTo(px, py);
      }
      x.stroke();
    }
    x.fillStyle = "#c2410c"; x.beginPath(); x.arc(W * 0.5, H * 0.5, 5, 0, Math.PI * 2); x.fill();
  } else if (style === "tapestry" || style === "stripes") {
    const cols = ["#c2410c", "#e7b77a", "#f3ead8", "#7c8b6a", "#2f3e46", "#d9a066"];
    for (let y = 0; y < H; y += 14 + Math.floor(r() * 26)) { x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(0, y, W, 10 + r() * 20); }
    if (style === "tapestry") {
      x.fillStyle = "#f3ead8";
      for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(W * (i / 6), H * 0.5); x.lineTo(W * ((i + 0.5) / 6), H * 0.4); x.lineTo(W * ((i + 1) / 6), H * 0.5); x.lineTo(W * ((i + 0.5) / 6), H * 0.6); x.fill(); }
    }
  } else if (style === "plate") {
    x.strokeStyle = "#2a4f8f"; x.lineWidth = 6; x.beginPath(); x.arc(W / 2, H / 2, W * 0.44, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(W / 2, H / 2, W * 0.36, 0, Math.PI * 2); x.stroke();
    x.fillStyle = "#2a4f8f";
    for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; x.beginPath(); x.ellipse(W / 2 + Math.cos(t) * W * 0.4, H / 2 + Math.sin(t) * W * 0.4, 9, 4, t, 0, Math.PI * 2); x.fill(); }
    for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; x.beginPath(); x.ellipse(W / 2 + Math.cos(t) * W * 0.13, H / 2 + Math.sin(t) * W * 0.13, W * 0.11, W * 0.04, t, 0, Math.PI * 2); x.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  artTex.set(key, t);
  return t;
}
const printed = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
const glowing = (col, k = 2.4) => new THREE.MeshStandardMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: k, roughness: 0.4 });
const WALL_DECO = {
  poster(b, W, D, H, c, p) {                     // a print in a thin frame
    const f = 0.015;
    b.box(W, H, D, c, 0, 0, 0, { r: 0.002, rough: 0.5 });
    b.box(W - 2 * f, H - 2 * f, 0.003, c, 0, f, D / 2, { r: 0, material: printed(wallArt(p.style || "arches", W, H)) });
  },
  canvas(b, W, D, H, c, p) {                     // stretched canvas, no frame
    b.box(W, H, D, c, 0, 0, 0, { r: 0.003, material: printed(wallArt(p.style || "tapestry", W, H)) });
  },
  plate(b, W, D, H) {
    b.cyl(W / 2, W / 2 * 0.8, D, "#f6f4ef", 0, H / 2 - D / 2, 0, { rx: Math.PI / 2, seg: 48, rough: 0.25 }).position.y = H / 2;
    const face = b.mesh(new THREE.CircleGeometry(W / 2 * 0.98, 48), printed(wallArt("plate", 1, 1)), false);
    face.position.set(0, H / 2, D / 2 + 0.001);
  },
  "hanging-plant"(b, W, D, H) {                  // macramé hanger from a hook, a pot, trailing leaves
    b.cyl(0.006, 0.006, 0.05, "#b08d57", 0, H - 0.02, -D / 2 + 0.025, { rx: Math.PI / 2, ...BRASS }).position.y = H - 0.02;
    const potY = H * 0.35;
    [0, 1, 2, 3].forEach((i) => {
      const a = i * Math.PI / 2 + 0.6;
      const cord = b.cyl(0.003, 0.003, H - potY - 0.1, "#e8dcc6", Math.cos(a) * 0.04, potY + 0.06, Math.sin(a) * 0.04, { rough: 1, seg: 6 });
      cord.rotation.z = Math.cos(a) * 0.12; cord.rotation.x = -Math.sin(a) * 0.12;
    });
    b.cyl(W * 0.3, W * 0.22, 0.15, "#c9a27a", 0, potY - 0.08, 0, { rough: 0.9, seg: 32 });
    const r = rand(5);
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, fall = r() * potY * 0.95;
      b.blob(0.035, i % 3 ? "#4f7a3a" : "#6d9a4c", Math.cos(a) * W * 0.3, potY - fall + 0.05, Math.sin(a) * W * 0.25, 1, 0.35, 0.8, { rough: 0.7, ry: a });
    }
  },
  macrame(b, W, D, H, c) {                       // a wooden dowel with knotted cords and a fringe
    b.cyl(0.012, 0.012, W, "#b08d57", 0, H - 0.02, 0, { rz: Math.PI / 2, ...WOOD }).position.y = H - 0.02;
    const n = Math.round(W / 0.025);
    for (let i = 0; i < n; i++) {
      const x = -W / 2 + 0.02 + i * (W - 0.04) / (n - 1), len = H * (0.62 + 0.3 * Math.cos((i / (n - 1) - 0.5) * Math.PI));
      b.cyl(0.004, 0.004, len, c, x, H - 0.03 - len, 0, { rough: 1, seg: 6 });
    }
    for (let k = 0; k < 4; k++) for (let i = k; i < n - k; i += 2) b.blob(0.01, c, -W / 2 + 0.02 + i * (W - 0.04) / (n - 1) + 0.006, H - 0.1 - k * 0.07, 0.004, 1.2, 1, 0.8, { rough: 1 });
  },
  "string-lights"(b, W, D, H) {                  // fairy lights in a swag, little photos pegged on
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3((t - 0.5) * W, H - 0.02 - Math.sin(t * Math.PI) * H * 0.7, 0)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    b.mesh(new THREE.TubeGeometry(curve, 64, 0.002, 6, false), mat("#3a3a3a"), false);
    for (let i = 1; i < 12; i++) { const q = curve.getPoint(i / 12); b.blob(0.012, "#fff3d6", q.x, q.y - 0.01, q.z + 0.006, 1, 1.3, 1, { glow: "#ffcf8a", rough: 0.3, shadow: false }); }
    [0.2, 0.42, 0.62, 0.82].forEach((t, i) => { const q = curve.getPoint(t); b.box(0.09, 0.12, 0.002, ["#d9c7a8", "#b9c3c9", "#e2c4b0", "#c6cfb8"][i], q.x, q.y - 0.15, 0.004, { r: 0 }); });
  },
  neon(b, W, D, H, c) {                          // a glowing squiggle on clear acrylic
    b.box(W, H, 0.006, "#ffffff", 0, 0, -D / 2 + 0.003, { ...GLASS, r: 0.01 });
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(new THREE.Vector3((t - 0.5) * W * 0.8, H / 2 + Math.sin(t * Math.PI * 3) * H * 0.28 * (1 - Math.abs(t - 0.5)), 0.01)); }
    b.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.007, 8, false), glowing(c), false);
  },
  guitar(b, W, D, H, c) {                        // an acoustic guitar on a wall hook
    b.blob(W / 2, c, 0, H * 0.22, 0, 1, 1.15, D / W * 2, { ...WOOD, rough: 0.35 });
    b.blob(W * 0.4, c, 0, H * 0.43, 0, 1, 1, D / W * 2, { ...WOOD, rough: 0.35 });
    const hole = b.mesh(new THREE.CircleGeometry(W * 0.12, 32), mat("#1b1410"), false); hole.position.set(0, H * 0.36, D / 2 * 0.98 + 0.002);
    b.box(0.05, H * 0.42, 0.025, "#3a2a1e", 0, H * 0.5, D * 0.2, { r: 0.008, ...WOOD });
    b.box(0.075, 0.16, 0.03, "#3a2a1e", 0, H - 0.16, D * 0.15, { r: 0.01, ...WOOD });
    b.box(0.09, 0.03, 0.012, "#2a1d14", 0, H * 0.13, D / 2 * 0.95, { r: 0.003 });
    for (let i = 0; i < 6; i++) b.box(0.0015, H * 0.72, 0.002, "#d7d2c8", (i - 2.5) * 0.008, H * 0.13, D / 2 * 0.95 + 0.012, { r: 0, ...CHROME, shadow: false });
  },
  pegboard(b, W, D, H, c) {                      // a board of holes, a small shelf, hooks and a few things
    b.box(W, H, 0.015, c, 0, 0, -D / 2 + 0.0075, { r: 0.004, rough: 0.6 });
    const dot = new THREE.CircleGeometry(0.004, 8), dark = mat("#3a3530");
    for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) { const m = b.mesh(dot, dark, false); m.position.set(-W / 2 + i * W / 10, j * H / 10, -D / 2 + 0.0155); }
    b.box(W * 0.55, 0.012, 0.1, "#c9a274", -W * 0.15, H * 0.42, -D / 2 + 0.065, { r: 0.003, ...WOOD });
    b.cyl(0.03, 0.025, 0.07, "#c2410c", -W * 0.3, H * 0.43, -D / 2 + 0.065, { rough: 0.6 });
    b.blob(0.04, "#5f8a4a", -W * 0.3, H * 0.43 + 0.1, -D / 2 + 0.065, 1, 0.8, 1, { rough: 0.8 });
    b.box(0.06, 0.08, 0.04, "#2f3e46", -W * 0.05, H * 0.43, -D / 2 + 0.05, { r: 0.004 });
    b.cyl(0.07, 0.07, 0.01, "#7c8b6a", W * 0.3, H * 0.58, -D / 2 + 0.03, { rx: Math.PI / 2, seg: 32, rough: 0.7 }).position.y = H * 0.58;
    b.box(0.2, 0.012, 0.012, "#3a3a3a", W * 0.2, H * 0.2, -D / 2 + 0.03, { r: 0.004, ...STEEL });
  },
  sunburst(b, W, D, H, c) {                      // a round mirror in a rattan sunburst
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2;
      const s = b.box(0.012, W * 0.3, 0.012, c, 0, 0, 0, { r: 0.005, rough: 0.9, tex: "jute" });
      s.rotation.z = a - Math.PI / 2; s.position.set(Math.cos(a) * W * 0.33, H / 2 + Math.sin(a) * W * 0.33, 0);
    }
    b.cyl(W * 0.2, W * 0.2, 0.02, c, 0, 0, 0, { rx: Math.PI / 2, seg: 48, rough: 0.9, tex: "jute" }).position.y = H / 2;
    const m = b.mesh(new THREE.CircleGeometry(W * 0.17, 48), new THREE.MeshStandardMaterial({ color: "#dfe6ea", roughness: 0.04, metalness: 1 }), false);
    m.position.set(0, H / 2, 0.012); m.userData.mirror = "round";
  },
  record(b, W, D, H, c, p) {                     // a record on a picture ledge, its sleeve behind it
    b.box(W, 0.02, D, "#c9a274", 0, 0, 0, { r: 0.003, ...WOOD });
    b.box(W * 0.9, H * 0.92, 0.004, c, -0.02, 0.02, -D / 2 + 0.01, { r: 0, material: printed(wallArt(p.style || "sun", 1, 1)) });
    const R = W * 0.4, cy = 0.02 + R;
    b.cyl(R, R, 0.003, "#141414", 0.05, 0, 0.005, { rx: Math.PI / 2, seg: 64, rough: 0.3 }).position.y = cy;
    b.cyl(R * 0.32, R * 0.32, 0.0035, c, 0.05, 0, 0.007, { rx: Math.PI / 2, seg: 32 }).position.y = cy;
  },
  hooks(b, W, D, H, c) {                         // an oak rail with pegs, a tote bag and a hat hanging
    b.box(W, H * 0.2, 0.02, "#c9a274", 0, H * 0.8, -D / 2 + 0.01, { r: 0.004, ...WOOD });
    const n = Math.max(3, Math.round(W / 0.15));
    for (let i = 0; i < n; i++) b.cyl(0.012, 0.014, 0.07, c, -W / 2 + (i + 0.5) * W / n, 0, -D / 2 + 0.05, { rx: Math.PI / 2, ...WOOD }).position.y = H * 0.88;
    b.box(0.3, 0.36, 0.015, "#e6dccb", -W / 2 + 1.5 * W / n, H * 0.88 - 0.42, -D / 2 + 0.06, { r: 0.01, ...FAB });
    b.cyl(0.14, 0.15, 0.05, "#b08d57", W / 2 - 1.5 * W / n, 0, -D / 2 + 0.1, { rx: Math.PI / 2 - 0.3, seg: 32, rough: 0.9, tex: "jute" }).position.y = H * 0.7;
  },
  cork(b, W, D, H) {                             // a cork board with notes and photos pinned on
    b.box(W, H, D, "#c9a274", 0, 0, 0, { r: 0.004, ...WOOD });
    b.box(W - 0.03, H - 0.03, 0.004, "#b48a5e", 0, 0.015, D / 2, { r: 0, rough: 1, tex: "jute" });
    const r = rand(11), cols = ["#fff3a8", "#f6f4ef", "#ffd0b5", "#cfe3d0", "#d6e2f0"];
    for (let i = 0; i < 9; i++) {
      const w = 0.07 + r() * 0.06;
      const n = b.box(w, w * (0.8 + r() * 0.5), 0.002, cols[i % 5], (r() - 0.5) * (W - 0.15), 0.06 + r() * (H - 0.22), D / 2 + 0.004, { r: 0 });
      n.rotation.z = (r() - 0.5) * 0.3;
    }
  },
  "floating-shelf"(b, W, D, H, c) {              // a slim oak shelf with a plant, books and a frame
    b.box(W, 0.035, D, c, 0, 0, 0, { r: 0.004, ...WOOD });
    b.cyl(0.05, 0.04, 0.1, "#efe9df", -W * 0.3, 0.035, 0, { rough: 0.6, seg: 32 });
    for (let i = 0; i < 8; i++) b.blob(0.03, "#5f8a4a", -W * 0.3 + Math.cos(i) * 0.05, 0.16 + (i % 3) * 0.02, Math.sin(i) * 0.04, 1, 0.5, 1, { rough: 0.8 });
    ["#7b3b2a", "#2f4858", "#d8c9a7", "#5d6b4a"].forEach((col, i) => b.box(0.025, 0.2 - i * 0.01, D * 0.75, col, W * 0.05 + i * 0.027, 0.035, 0, { r: 0.003 }));
    b.box(0.13, 0.17, 0.015, "#2b2622", W * 0.32, 0.035, -0.01, { r: 0.003 }).rotation.x = -0.12;
  },
};

/* ---------- Doors and windows: the wall gets a hole, the model fills it ---------- */
export function openingOf(p) {
  if (!p?.wall || p.hang) return null;
  const w = p.w / 100, h = p.h / 100;
  const sill = p.sill != null ? p.sill / 100 : /window/.test(p.kind) ? (h >= 1.5 ? 0.75 : 0.9) : 0;
  return { w, h, sill };
}
const PAINT = { rough: 0.38 };
const BRASS = { rough: 0.3, metal: 0.95 };
const STEEL = { rough: 0.35, metal: 0.6 };
// A grid of thin glazing bars across a pane
function bars(b, x0, y0, w, h, cols, rows, color, depth = 0.03, t = 0.022, o = STEEL) {
  for (let i = 1; i < cols; i++) b.box(t, h, depth, color, x0 - w / 2 + (w * i) / cols, y0, 0, { ...o, r: 0 });
  for (let j = 1; j < rows; j++) b.box(w, t, depth, color, x0, y0 + (h * j) / rows - t / 2, 0, { ...o, r: 0 });
}
function frameAround(b, o, color, t, opts, depth = WALL_T + 0.03, bottom = false) {
  [-1, 1].forEach((s) => b.box(t, o.h, depth, color, s * (o.w / 2 - t / 2), o.sill, 0, { r: 0.003, ...opts }));
  b.box(o.w, t, depth, color, 0, o.sill + o.h - t, 0, { r: 0.003, ...opts });
  if (bottom) b.box(o.w, t, depth, color, 0, o.sill, 0, { r: 0.003, ...opts });
}
const pane = (b, w, h, x, y, frost) => b.box(w, h, 0.008, frost ? "#e9eef0" : "#cfe6f2", x, y, 0, frost ? { rough: 0.6, opacity: 0.85, r: 0 } : { ...GLASS, r: 0 });
const OPENING_MODELS = {
  "panel-door"(b, o, c) {                        // classic door with four raised panels
    frameAround(b, o, "#ffffff", 0.07, PAINT);
    const lw = o.w - 0.14, lh = o.h - 0.08;
    b.box(lw, lh, 0.04, c, 0, 0.01, 0, { r: 0.004, ...PAINT });
    [[0.12, 0.62], [0.82, lh - 0.94]].forEach(([y, h]) => [-1, 1].forEach((s) => {
      b.box(lw / 2 - 0.13, h, 0.05, shade(c, -0.03), s * (lw / 4 - 0.005), 0.01 + y, 0, { r: 0.012, ...PAINT });
    }));
    [-1, 1].forEach((s) => {
      b.cyl(0.026, 0.026, 0.012, "#b08d57", lw / 2 - 0.09, 1.0, s * 0.03, { ...BRASS, rx: Math.PI / 2 });
      b.box(0.13, 0.018, 0.018, "#b08d57", lw / 2 - 0.15, 0.99, s * 0.05, { ...BRASS, r: 0.008 });
    });
  },
  "oak-door"(b, o, c) {                          // solid oak, flush, with a long black pull
    frameAround(b, o, "#f4f1ea", 0.06, PAINT);
    b.box(o.w - 0.12, o.h - 0.07, 0.042, c, 0, 0.01, 0, { r: 0.004, ...WOOD });
    for (let i = 1; i < 6; i++) b.box(0.003, o.h - 0.1, 0.046, shade(c, -0.12), -o.w / 2 + 0.06 + ((o.w - 0.12) * i) / 6, 0.03, 0, { r: 0, shadow: false });
    [-1, 1].forEach((s) => b.box(0.025, 0.5, 0.025, "#1f1f1f", o.w / 2 - 0.16, 0.8, s * 0.04, { ...STEEL, r: 0.008 }));
  },
  "double-door"(b, o, c) {                       // a pair of glazed doors
    frameAround(b, o, "#ffffff", 0.06, PAINT);
    const lw = (o.w - 0.12) / 2, lh = o.h - 0.07;
    [-1, 1].forEach((s) => {
      const x = s * lw / 2;
      b.box(0.08, lh, 0.045, c, x - s * (lw / 2 - 0.04), 0.01, 0, { r: 0.004, ...PAINT });
      b.box(0.08, lh, 0.045, c, x + s * (lw / 2 - 0.04), 0.01, 0, { r: 0.004, ...PAINT });
      b.box(lw, 0.22, 0.045, c, x, 0.01, 0, { r: 0.004, ...PAINT });
      b.box(lw, 0.08, 0.045, c, x, lh - 0.07, 0, { r: 0.004, ...PAINT });
      pane(b, lw - 0.16, lh - 0.31, x, 0.23);
      bars(b, x, 0.23, lw - 0.16, lh - 0.31, 2, 4, c, 0.04, 0.025, PAINT);
      b.box(0.12, 0.018, 0.018, "#b08d57", x - s * (lw / 2 - 0.12), 1.0, 0.05, { ...BRASS, r: 0.008 });
    });
  },
  "steel-door"(b, o, c) {                        // black steel and glass, workshop style
    const t = 0.045;
    frameAround(b, o, c, t, STEEL, WALL_T + 0.02, true);
    pane(b, o.w - 2 * t, o.h - 2 * t, 0, o.sill + t);
    bars(b, 0, t, o.w - 2 * t, o.h - 2 * t, 3, 5, c, 0.035, 0.024);
    b.box(0.02, 0.32, 0.03, c, o.w / 2 - 0.12, 0.85, 0.05, { ...STEEL, r: 0.008 });
  },
  "sliding-door"(b, o, c) {                      // two big glass panels, one slides
    const t = 0.05;
    frameAround(b, o, c, t, STEEL, WALL_T + 0.03, true);
    const pw = (o.w - t) / 2;
    [[-1, -0.025], [1, 0.025]].forEach(([s, z]) => {
      const x = s * (pw / 2 - 0.005);
      [-1, 1].forEach((k) => b.box(0.045, o.h - 2 * t, 0.05, c, x + k * (pw / 2 - 0.0225), t, z, { ...STEEL, r: 0.002 }));
      b.box(pw, 0.045, 0.05, c, x, t, z, { ...STEEL, r: 0.002 });
      b.box(pw, 0.045, 0.05, c, x, o.h - t - 0.045, z, { ...STEEL, r: 0.002 });
      b.box(pw - 0.09, o.h - 2 * t - 0.09, 0.008, "#cfe6f2", x, t + 0.045, z, { ...GLASS, r: 0 });
    });
    b.box(0.02, 0.35, 0.03, "#2b2b2b", -0.12, 0.9, 0.06, { ...STEEL, r: 0.008 });
  },
  "steel-window"(b, o, c) {
    const t = 0.045;
    frameAround(b, o, c, t, STEEL, WALL_T + 0.02, true);
    pane(b, o.w - 2 * t, o.h - 2 * t, 0, o.sill + t);
    bars(b, 0, o.sill + t, o.w - 2 * t, o.h - 2 * t, Math.max(2, Math.round(o.w / 0.4)), Math.max(2, Math.round(o.h / 0.45)), c, 0.035, 0.022);
    b.box(o.w + 0.08, 0.03, 0.2, "#d8d4cc", 0, o.sill - 0.03, 0.06, { r: 0.006, rough: 0.6 });
  },
  "triple-window"(b, o) {                        // three side-by-side sashes
    const f = "#ffffff";
    frameAround(b, o, f, 0.06, PAINT, WALL_T + 0.03, true);
    const sw = (o.w - 0.12) / 3;
    for (let i = 0; i < 3; i++) {
      const x = -o.w / 2 + 0.06 + sw * (i + 0.5);
      if (i) b.box(0.05, o.h - 0.1, 0.07, f, x - sw / 2, o.sill + 0.05, 0, { r: 0.004, ...PAINT });
      pane(b, sw - 0.05, o.h - 0.12, x, o.sill + 0.06);
    }
    b.box(o.w + 0.1, 0.03, 0.2, f, 0, o.sill - 0.03, 0.06, { r: 0.006, ...PAINT });
  },
  "small-window"(b, o) {                         // frosted, for a bathroom
    frameAround(b, o, "#ffffff", 0.055, PAINT, WALL_T + 0.03, true);
    pane(b, o.w - 0.1, o.h - 0.1, 0, o.sill + 0.05, true);
    b.box(o.w + 0.08, 0.03, 0.16, "#ffffff", 0, o.sill - 0.03, 0.05, { r: 0.006, ...PAINT });
  },
  "french-window"(b, o) {                        // floor-length window with glazing bars
    const f = "#ffffff";
    frameAround(b, o, f, 0.06, PAINT, WALL_T + 0.03, true);
    b.box(0.05, o.h - 0.1, 0.07, f, 0, o.sill + 0.05, 0, { r: 0.004, ...PAINT });
    [-1, 1].forEach((s) => {
      const x = s * (o.w / 4 - 0.008), pw = o.w / 2 - 0.09;
      pane(b, pw, o.h - 0.12, x, o.sill + 0.06);
      bars(b, x, o.sill + 0.06, pw, o.h - 0.12, 1, 4, f, 0.04, 0.03, PAINT);
    });
  },
  door(b, o, c) {
    const f = "#ffffff", t = WALL_T + 0.03;
    [-1, 1].forEach((s) => b.box(0.06, o.h, t, f, s * (o.w / 2 - 0.03), 0, 0, { r: 0.004 }));
    b.box(o.w, 0.06, t, f, 0, o.h - 0.06, 0, { r: 0.004 });
    b.box(o.w - 0.12, o.h - 0.07, 0.04, c, 0, 0.01, 0, { r: 0.006, ...PAINT });
    [-1, 1].forEach((s) => {
      b.cyl(0.026, 0.026, 0.012, "#c9ccd0", o.w / 2 - 0.1, 1.0, s * 0.026, { ...CHROME, rx: Math.PI / 2 });
      b.box(0.13, 0.018, 0.018, "#c9ccd0", o.w / 2 - 0.16, 0.99, s * 0.045, { ...CHROME, r: 0.008 });
    });
  },
  window(b, o) {
    const f = "#ffffff", t = WALL_T + 0.03;
    b.box(o.w, 0.06, t, f, 0, o.sill, 0, { r: 0.004 });
    b.box(o.w, 0.06, t, f, 0, o.sill + o.h - 0.06, 0, { r: 0.004 });
    [-1, 1].forEach((s) => b.box(0.06, o.h, t, f, s * (o.w / 2 - 0.03), o.sill, 0, { r: 0.004 }));
    b.box(0.05, o.h - 0.1, 0.07, f, 0, o.sill + 0.05, 0, { r: 0.004 });
    b.box(o.w - 0.1, o.h - 0.1, 0.008, "#cfe6f2", 0, o.sill + 0.05, 0, { ...GLASS, r: 0 });
    b.box(o.w + 0.1, 0.03, 0.2, f, 0, o.sill - 0.03, 0.06, { r: 0.006 });
  },
  "glass-door"(b, o, c) {
    const t = WALL_T + 0.03;
    [-1, 1].forEach((s) => b.box(0.05, o.h, t, c, s * (o.w / 2 - 0.025), 0, 0, { r: 0.004 }));
    b.box(o.w, 0.05, t, c, 0, o.h - 0.05, 0, { r: 0.004 });
    b.box(o.w, 0.05, t, c, 0, 0, 0, { r: 0.004 });
    b.box(0.04, o.h - 0.1, 0.06, c, 0, 0.05, 0, { r: 0.004 });
    b.box(o.w - 0.1, o.h - 0.1, 0.008, "#cfe6f2", 0, 0.05, 0, { ...GLASS, r: 0 });
  },
};

/* ---------- Scanned models (Poly Haven, CC0), loaded only when used ---------- */
const MODEL_DIR = new URL("../assets/models/", import.meta.url).href;

/* ---------- Scanned floors (Poly Haven, CC0): colour + bump, loaded once and shared ---------- */
const FLOOR_DIR = new URL("../assets/floors/", import.meta.url).href;
const scannedFloors = {};
function scannedFloor(kind, v) {
  if (!scannedFloors[kind]) {
    const loader = new THREE.TextureLoader();
    const load = (file, srgb) => loader.loadAsync(FLOOR_DIR + file).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
    const q = v ? `?v=${v}` : "";                 // a floor whose pictures were replaced: not the old ones from the cache
    scannedFloors[kind] = Promise.all([load(`${kind}.jpg${q}`, true), load(`${kind}-n.jpg${q}`, false)]).then(([map, normal]) => ({ map, normal }));
  }
  return scannedFloors[kind];
}
const gltf = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/draco/gltf/");
gltf.setDRACOLoader(draco);
const assets = new Map();
// One piece out of a set (one bottle of four, the teapot of a tea set), centred on its own spot
const parts = new Map();
function loadPart(file, part) {
  const key = `${file}#${part}`;
  if (!parts.has(key)) parts.set(key, loadAsset(file).then((a) => {
    const re = new RegExp(part, "i");
    const src = a.scene.clone(true);
    const drop = [];
    const named = (o) => { for (let x = o; x && x !== src; x = x.parent) if (re.test(x.name)) return true; return false; };
    src.traverse((o) => { if (o.isMesh && !named(o)) drop.push(o); });
    drop.forEach((o) => o.removeFromParent());
    const box = new THREE.Box3().setFromObject(src);
    const c = box.getCenter(new THREE.Vector3());
    src.position.set(-c.x, -box.min.y, -c.z);
    const holder = new THREE.Group();
    holder.add(src);
    return { scene: holder, size: box.getSize(new THREE.Vector3()) };
  }));
  return parts.get(key);
}
// Each open 3D view gets new scans ready before they are shown: pictures sent to the graphics card
// a few at a time and shaders compiled in the background. Shown cold, one scan could freeze the
// page for a second while the browser did all of that inside a single frame.
const warmers = new Set();
function warmUp(obj) {
  if (!warmers.size) return Promise.resolve();
  const all = Promise.all([...warmers].map((w) => w(obj).catch(() => {})));
  return Promise.race([all, new Promise((res) => setTimeout(res, 4000))]);   // never hold a piece back for long
}
function loadAsset(file) {
  if (!assets.has(file)) {
    assets.set(file, gltf.loadAsync(`${MODEL_DIR}${file}.glb`).then((g) => {
      if (file !== "pillows") {                      // sofas and armchairs come bare: the loose cushions sat between the seat cushions
        const loose = [];
        g.scene.traverse((o) => { if (/^pillow/i.test(o.name)) loose.push(o); });
        loose.forEach((o) => o.removeFromParent());
      }
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const m = o.material;
        if (/glass/i.test(m.name) && /picture|painting|clock|lantern/.test(file)) {   // picture and clock glass: clear, just a reflection
          o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false });
          o.castShadow = false;
          return;
        }
        if (/globe|shade/i.test(m.name) || /^light-/.test(file) && /bulb|lamp|glass/i.test(m.name)) {   // lamp glass glows
          m.emissive = new THREE.Color("#ffe2b8"); m.emissiveIntensity = lampGlow; glowMats.add(m);
        }
      });
      const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
      return warmUp(g.scene).then(() => ({ scene: g.scene, size }));
    }));
  }
  return assets.get(file);
}
// fit: "stretch" = to the catalogue size; "height" = to its height; default = to its footprint
const REAL = {
  landskrona: { file: "armchair" },
  "stockholm-table": { file: "coffee-table", fit: "stretch" },
  "stockholm-tv": { file: "tv-bench", fit: "stretch", tv: true },
  "tonstad-bedside": { file: "bedside", fit: "stretch" },
  "stockholm-chair": { file: "chair" },
  "tonstad-dining": { file: "table", fit: "stretch" },
  strelitzia: { file: "plant-tall", fit: "height" },
  pachira: { file: "plant-money-tree", fit: "height" },
  monstera: { file: "plant-medium", fit: "height" },
  "own-fig-urn": { file: "plant-rubber", fit: "height" },
  "own-syngonium": { file: "plant-leafy", fit: "height" },
  "own-periwinkle": { file: "plant-periwinkle", fit: "height" },
  "own-flower-box": { file: "plant-flower-box", fit: "stretch" },
  "own-gazania-pot": { file: "plant-gazania", fit: "height" },
  "own-succulent-bloom": { file: "plant-flowering-succulent", fit: "height" },
  "own-haworthia": { file: "plant-mini", fit: "height" },
  "mabarsbuske-pot": { file: "succulent" },
  "landskrona-stool": { file: "ottoman", fit: "stretch", tint: "#5a5450" },
  pinntorp: { file: "chair-white" },
  "stig-bar": { file: "bar-chair", fit: "height" },
  marius: { file: "stool-metal", fit: "height" },
  frotorp: { file: "coffee-round", fit: "stretch", tint: "#5d5d5d" },
  tertial: { file: "desk-lamp", fit: "height" },
  gurli: { file: "pillows", fit: "height" },
  "frovaxt-vase": { file: "vase-wide", fit: "height" },
  "sockerart-vase": { file: "vase-jug", fit: "height" },
  "hultet-dish": { file: "bowl", fit: "stretch" },
  "rodalm-small": { file: "frame-black", fit: "height" },
  "fikontrad-frame": { file: "frame-white", fit: "height" },
  "branas-lid": { file: "basket-lid", fit: "stretch" },
  vattentat: { file: "kettle", fit: "height" },
  lamplig: { file: "board", fit: "stretch" },
  tromma: { file: "wall-clock", fit: "stretch" },
  "rodalm-oak": { file: "picture-2", fit: "stretch" },
  "rodalm-white": { file: "picture-1", fit: "stretch" },
  "own-painting": { file: "painting", fit: "stretch" },
  "own-oval": { file: "picture-oval", fit: "stretch" },
  "own-mirror": { file: "mirror", fit: "stretch" },
  "own-bust": { file: "bust", fit: "height" },
  "own-cat": { file: "cat", fit: "height" },
  "own-elephant": { file: "elephant", fit: "height" },
  "own-chess": { file: "chess", fit: "stretch" },
  "own-tea": { file: "tea-set", fit: "height" },
  "own-shell": { file: "shell", fit: "stretch" },
  "own-clay-pot": { file: "clay-pot", fit: "height" },
  "own-alarm": { file: "alarm-clock", fit: "height" },
  "own-mantel-clock": { file: "mantel-clock", fit: "height" },
  "own-candlestick": { file: "candlestick", fit: "height" },
  "own-lantern": { file: "lantern", fit: "height" },
  "own-wine": { file: "wine", fit: "height" },
  "own-vase-tall": { file: "vase-tall", fit: "height" },
  "own-vase-blue": { file: "vase-blue", fit: "height" },
  "own-books": { books: true },
  "own-magazines": { books: true },
  kallax: { file: "cube-shelf", fit: "stretch", tint: "#f1e7d8" },
  havberg: { file: "lounge-chair" },
  ugglerum: { file: "side-table-tall", fit: "stretch" },
  holmerud: { file: "console-table", fit: "stretch" },
  "own-cabinet": { file: "drawer-cabinet", fit: "stretch" },
  "own-tv-wall": { file: "tv-wall", fit: "stretch" },
  "own-tv-easel": { file: "tv-easel", fit: "stretch" },
  "own-tv-stand": { file: "tv-stand", fit: "stretch" },
  stensele: { file: "round-table", fit: "stretch" },
  radmanso: { file: "apothecary-chest", fit: "stretch" },
  "tarno-set": { file: "bistro-wood" },
  calathea: { file: "plant-calathea", fit: "height" },
  anthurium: { file: "plant-anthurium", fit: "height" },
  nephrolepis: { file: "plant-fern", fit: "height" },
  "own-horse": { file: "horse", fit: "height" },
  "own-whale": { file: "whale", fit: "height" },
  "own-candelabra": { file: "candelabra", fit: "height" },
  "own-plate": { file: "wood-plate", fit: "stretch" },
  "own-tray-basket": { file: "wicker-basket", fit: "stretch" },
  "own-stoneware": { file: "ceramic-pot", fit: "height" },
  "own-wood-bowl": { file: "wood-bowl", fit: "height" },
  "own-brass-vase": { file: "brass-vase", fit: "height" },
  // bathroom, modelled for Atelier
  "venecia-bath": { file: "bath-oval", fit: "stretch" },
  "shower-screen": { file: "shower-walkin", fit: "stretch" },
  "angsjon-vanity": { file: "vanity-double", fit: "stretch", keepH: true },
  "own-vanity-walnut": { file: "vanity-walnut", fit: "stretch", keepH: true },
  "own-vanity-white": { file: "vanity-white", fit: "stretch", keepH: true },
  "duravit-wc": { file: "toilet-wall", fit: "stretch" },
  "angsjon-tall": { file: "tall-cabinet-oak", fit: "stretch" },
  "enhet-mirror": { file: "mirror-cabinet", fit: "stretch" },
  "own-mirror-led": { file: "mirror-round-led", fit: "stretch" },
  "own-radiator": { file: "towel-radiator", fit: "stretch" },
  "stegesund-ladder": { file: "towel-ladder", fit: "stretch" },
  "uddarp-washer": { file: "washing-machine", fit: "stretch" },
  // kitchen
  metod: { file: "kitchen-metod", fit: "stretch" },
  knoxhult: { file: "kitchen-compact", fit: "stretch" },
  "own-kitchen-sage": { file: "kitchen-sage", fit: "stretch" },
  "own-kitchen-black": { file: "kitchen-black", fit: "stretch" },
  "metod-green": { file: "base-sage", fit: "stretch" },
  "metod-black": { file: "base-black", fit: "stretch" },
  "metod-oak-sink": { file: "base-oak-sink", fit: "stretch", keepH: true },
  "metod-fridge": { file: "tall-fridge-sage", fit: "stretch" },
  "own-tall-oven": { file: "tall-oven", fit: "stretch" },
  "lagan-fridge": { file: "fridge-white", fit: "stretch" },
  vadholma: { file: "island-oak", fit: "stretch" },
  "klavrestrom-shelf": { file: "wall-shelf-oak", fit: "stretch" },
  // living
  "own-sofa-boucle": { file: "sofa-boucle", fit: "stretch", noDecor: true },
  "own-sofa-sage": { file: "sofa-sage", fit: "stretch", noDecor: true },
  "own-sofa-modular": { file: "sofa-modular", fit: "stretch", noDecor: true },
  "own-sofa-tufted": { file: "sofa-tufted", fit: "stretch", noDecor: true },
  "own-settee": { file: "sofa-settee", fit: "stretch", noDecor: true },
  "own-armchair-boucle": { file: "armchair-boucle", fit: "stretch" },
  "own-coffee-travertine": { file: "coffee-travertine", fit: "stretch" },
  "own-coffee-oval": { file: "coffee-oval-oak", fit: "stretch" },
  "own-coffee-carved": { file: "coffee-table-2", fit: "stretch" },
  "own-side-marble": { file: "side-marble", fit: "stretch" },
  "tonstad-bookcase": { file: "bookcase-oak", fit: "stretch" },
  "own-steel-shelving": { file: "steel-shelf-3", fit: "stretch" },
  "own-white-bookcase": { file: "shelf-wall", fit: "stretch" },
  "own-lamp-arc": { file: "lamp-arc", fit: "stretch" },
  "uppvind-lamp": { file: "lamp-globe", fit: "stretch" },
  "lauters-lamp": { file: "lamp-tripod", fit: "stretch" },
  "blidvader-lamp": { file: "lamp-ceramic", fit: "stretch" },
  fjallbo: { file: "steel-shelf", fit: "stretch" },
};
// Bookcases that come with books and ornaments, which the shuffle button rearranges
export const hasShelfContents = (p) => p?.kind === "bookcase" && (!REAL[p.id] || REAL[p.id].file === "bookcase-oak");
export const hasBookCovers = (p) => !!REAL[p?.id]?.books;
/* ---------- Real books (scanned covers): on shelves, in stacks, as decor ---------- */
const BOOK_NAMES = ["book_hardcover_01_cover02", "book_hardcover_01_cover08", "book_hardcover_01_cover13", "book_hardcover_01_cover29",
  "book_hardcover_01_cover41", "book_hardcover_01_cover65", "book_softcover_01_cover04", "book_softcover_01_cover14",
  "book_softcover_01_cover33", "book_softcover_01_cover56"];
const MAG_NAMES = ["magazine_01_cover16", "magazine_01_cover20", "magazine_01_cover43"];
let bookKit = null;
function loadBooks() {
  return (bookKit ||= Promise.all([...BOOK_NAMES, ...MAG_NAMES].map((n) => loadPart("book-set", `^${n}$`).then((a) => [n, a]))).then((l) => new Map(l)));
}
// one book: spine to the front (+z), standing on y = 0, centred
function bookObj(kit, name) { const a = kit.get(name); return { o: a.scene.clone(true), w: a.size.x, h: a.size.y, d: a.size.z }; }
const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
function bookRow(kit, n, r, maxH = 1) {
  const g = new THREE.Group();
  let x = 0;
  const names = BOOK_NAMES.slice().sort(() => r() - 0.5);
  for (let i = 0; i < n; i++) {
    const b = bookObj(kit, names[i % names.length]), k = Math.min(1, maxH / b.h);
    b.o.scale.setScalar(k); b.o.position.x = x + b.w * k / 2;
    x += b.w * k + 0.0015;
    g.add(b.o);
  }
  g.children.forEach((c) => { c.position.x -= x / 2; });
  g.userData.width = x;
  return g;
}
// lying flat, covers up, a little askew: books or magazines
function bookStack(kit, n, r, mags = false) {
  const g = new THREE.Group();
  const names = (mags ? MAG_NAMES : BOOK_NAMES).slice().sort(() => r() - 0.5);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const b = bookObj(kit, names[i % names.length]);
    const wrap = new THREE.Group();
    b.o.rotation.z = Math.PI / 2;                 // the cover faces up, the spine still to the front
    b.o.position.set(b.h / 2, b.w / 2, 0);
    wrap.add(b.o);
    wrap.position.set((r() - 0.5) * 0.02, y, (r() - 0.5) * 0.015);
    wrap.rotation.y = (r() - 0.5) * (mags ? 0.8 : 0.2);
    y += b.w;
    g.add(wrap);
  }
  g.userData.height = y;
  return g;
}
const markDecor = (g) => { g.userData.decor = true; g.traverse((o) => { o.userData.decor = true; }); return g; };
// The books item: a few standing, a small stack, one book, or magazines
function booksFor(kit, p) {
  const r = rand((p.shuffle || 0) * 7919 + p.id.length * 31 + 5);
  const st = p.style || "";
  if (p.id === "own-magazines") return bookStack(kit, st === "one" ? 1 : st === "two" ? 2 : 3, r, true);
  const m = st.match(/^(row|stack)(\d)$/);
  if (m) return m[1] === "row" ? bookRow(kit, +m[2], r) : bookStack(kit, +m[2], r);
  return bookRow(kit, 1, r);
}
// Fill a bookcase's shelves with real books: slots [{ y, x0, x1, zFront, maxH, full }] in the piece's own space
function fillShelves(group, slots, seed) {
  return loadBooks().then((kit) => {
    group.children.filter((o) => o.name === "shelf-books").forEach((o) => group.remove(o));
    const r = rand(seed * 7919 + 101);
    const holder = new THREE.Group();
    holder.name = "shelf-books";
    slots.forEach((sl) => {
      const width = sl.x1 - sl.x0;
      if (width < 0.05 || sl.maxH < 0.08) return;
      let x = sl.x0 + 0.004;
      const end = sl.full ? sl.x1 : sl.x0 + width * (0.5 + r() * 0.45);
      if (!sl.full && width > 0.45 && r() < 0.3) {     // now and then a small stack lying on its side
        const st = bookStack(kit, 2 + (r() < 0.5 ? 1 : 0), r);
        const k = Math.min(1, (sl.maxH - 0.01) / Math.max(st.userData.height, 0.01));
        st.scale.setScalar(Math.min(1, k));
        st.position.set(x + 0.12, sl.y, sl.zFront - 0.08);
        holder.add(st);
        x += 0.25;
      }
      const names = BOOK_NAMES.slice().sort(() => r() - 0.5);
      let i = 0;
      while (x < end) {
        const b = bookObj(kit, names[i++ % names.length]);
        const k = Math.min(1, (sl.maxH - 0.01) / b.h) * (0.9 + r() * 0.1);
        if (x + b.w * k > sl.x1) break;
        b.o.scale.setScalar(k);
        b.o.position.set(x + b.w * k / 2, sl.y, sl.zFront - b.d * k / 2);
        holder.add(b.o);
        x += b.w * k + 0.001;
      }
    });
    group.add(markDecor(holder));
  });
}
// The oak bookcase's own books were plain blocks: note where they stood, take them out, put real ones there.
// Its two ornaments become real ones too (a jug vase and a wooden bowl).
function oakShelves(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3(), slots = [], baked = [], orn = [];
  obj.traverse((o) => {
    if (!o.isMesh) return;
    if (/^book/i.test(o.name)) baked.push(o);
    else if (/^(vase|bowl)/i.test(o.name)) orn.push(o);
  });
  const rows = new Map();
  baked.forEach((o) => {
    box.setFromObject(o);
    const k = Math.round(box.min.y * 20);
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k).push({ x0: box.min.x, x1: box.max.x, y: box.min.y, top: box.max.y, z: box.max.z });
  });
  rows.forEach((list) => {
    list.sort((a, b) => a.x0 - b.x0);
    let run = null;
    list.forEach((b) => {
      if (run && b.x0 - run.x1 < 0.03) { run.x1 = Math.max(run.x1, b.x1); run.top = Math.max(run.top, b.top); run.z = Math.max(run.z, b.z); return; }
      if (run) slots.push(run);
      run = { ...b };
    });
    if (run) slots.push(run);
  });
  baked.forEach((o) => o.removeFromParent());
  const spots = [];                              // one spot per ornament: parts that touch belong together
  orn.forEach((o) => {
    const k = o.name.match(/^[a-z]+/i)[0].toLowerCase(), b = new THREE.Box3().setFromObject(o);
    const near = spots.find((sp) => sp.k === k && sp.box.clone().expandByScalar(0.02).intersectsBox(b));
    if (near) near.box.union(b); else spots.push({ k, box: b });
  });
  orn.forEach((o) => o.removeFromParent());
  return {
    slots: slots.map((sl) => ({ y: sl.y, x0: sl.x0, x1: sl.x1, zFront: sl.z, maxH: (sl.top - sl.y) + 0.03, full: true })),
    ornaments: spots.map(({ k, box }) => ({ file: k === "bowl" ? "wood-bowl" : "vase-jug", box })),
  };
}
// A few things standing on surfaces, so rooms look lived in: [model, x, z, scale]
const DECOR = {
  "stockholm-tv": [["vase", 0.76, -0.02, 0.75]],
  "stockholm-table": [["vase", 0.32, 0.02, 0.7], ["books", -0.25, 0.05, 0.55]],
  "tonstad-chest": [["books", -0.28, 0, 0.9], ["vase", 0.36, 0, 0.9]],
  "tonstad-desk": [["succulent", 0.48, -0.15, 1], ["books", -0.45, -0.2, 0.6]],
  fjallbo: [["vase", 0.28, 0, 0.7]],
  "tonstad-dining": [["bowl", 0, 0, 0.9]],
  "stockholm-sideboard": [["vase-jug", -0.5, 0, 0.9], ["books", 0.35, 0, 0.6]],
};
// Things every piece of a kind gets: a kettle and a board on kitchens.
// [model, x, z, scale, y, turn] in metres from the piece's centre; y defaults to its top.
const KIND_DECOR = {
  kitchen: (W, D) => [["kettle", W / 2 - 0.3, 0.06, 0.8, 0.92, 0.5]],
  island: () => [["bowl", 0, 0, 1, 0.9]],
};

function tagged(group) {
  const id = group.userData.itemId;
  if (id) group.traverse((o) => { o.userData.itemId = id; });
}
// The average colour of a texture (linear), to aim a recolour at what people will actually see
const texAverages = new WeakMap();
function textureAverage(tex) {
  const img = tex?.image;
  if (!img) return null;
  if (texAverages.has(img)) return texAverages.get(img);
  let col = null;
  try {
    const c = document.createElement("canvas"); c.width = c.height = 8;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    col = new THREE.Color().setRGB(r / 64 / 255, g / 64 / 255, b / 64 / 255, THREE.SRGBColorSpace);
  } catch { col = null; }
  texAverages.set(img, col);
  return col;
}
// Never recoloured: glass, screens, pictures, lights. Kept when there is something else to colour: the metal and fittings.
const NEVER_TINT = /glass|screen|artwork|flame|glow|globe|bulb|^mirror|(^|[^a-z])led([^a-z]|$)|(^|[^a-z])light([^a-z]|$)/i;
const KEEP_FINISH = /shade|chrome|steel|brass|metal|rubber|oven|hob|(^|[^a-z])tap([^a-z]|$)|drain|legs?([^a-z]|$)/i;
export function recolor(obj, hex) {
  const target = new THREE.Color(hex), box = new THREE.Box3(), size = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  // Scanned models often carry a metal map with the metalness factor at 1: only a plain metal factor means metal
  const metal = (m) => m.metalness > 0.5 && !m.metalnessMap;
  const surfaces = (strict) => {
    const area = new Map();
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.screen) return;
      const m = o.material, name = m?.name || "";
      if (!m || Array.isArray(m) || m.transparent || NEVER_TINT.test(name)) return;
      if (m.emissive && m.emissive.getHex() && m.emissiveIntensity > 0) return;
      if (strict && (KEEP_FINISH.test(name) || metal(m))) return;
      box.setFromObject(o).getSize(size);
      area.set(m, (area.get(m) || 0) + 2 * (size.x * size.y + size.y * size.z + size.x * size.z));
    });
    return area;
  };
  let area = surfaces(true);
  if (!area.size) area = surfaces(false);           // all metal (a brass vase, a steel shelf): colour the metal itself
  if (!area.size) return;
  const most = Math.max(...area.values()), swap = new Map();
  area.forEach((a, m) => {
    if (a < most * 0.3) return;                    // the big surfaces: upholstery, the body, the top
    const c = m.clone(), avg = textureAverage(m.map);
    if (avg) {
      const k = (t, v) => Math.min(6, t / Math.max(v, 0.015));
      c.color.setRGB(k(target.r, avg.r), k(target.g, avg.g), k(target.b, avg.b));
    } else c.color.copy(target);
    swap.set(m, c);
  });
  obj.traverse((o) => { if (o.isMesh && swap.has(o.material)) o.material = swap.get(o.material); });
}

// Swap the drawn shapes for the scanned model (and add decor). Resolves when done.
export function upgradeModel(group, p) {
  const spec = REAL[p.id], decor = [...(DECOR[p.id] || []), ...(spec?.noDecor ? [] : KIND_DECOR[p.kind]?.(p.w / 100, p.d / 100, p.h / 100) || [])];
  const W = p.w / 100, D = p.d / 100, H = p.h / 100;
  const jobs = [];
  if (spec?.books) {                             // books and magazines: real scanned covers
    jobs.push(loadBooks().then((kit) => {
      group.children.filter((o) => o.userData.proc).forEach((o) => group.remove(o));
      group.add(booksFor(kit, p));
      group.userData.real = true;
    }));
  } else if (spec) {
    jobs.push((p.part ? loadPart(spec.file, p.part) : loadAsset(spec.file)).then((a) => {
      const obj = a.scene.clone(true), s = a.size;
      if (spec.tint) obj.traverse((o) => {          // same scan, another finish
        if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(spec.tint)); }
      });
      if (p.tint) recolor(obj, p.tint);
      if (spec.fit === "stretch") obj.scale.set(W / s.x, spec.keepH ? 1 : H / s.y, D / s.z);   // keepH: taps rise above the counter
      else if (spec.fit === "height") obj.scale.setScalar(H / s.y);
      else obj.scale.setScalar(Math.min(W / s.x, D / s.z));
      group.children.filter((o) => o.userData.proc).forEach((o) => group.remove(o));
      if (spec.file === "bookcase-oak") {          // its plain books become real ones; shuffle changes only the books
        const { slots, ornaments } = oakShelves(obj);
        const later = [];
        ornaments.forEach(({ file, box }) => later.push(loadAsset(file).then((v) => {
          const o = v.scene.clone(true), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
          o.scale.setScalar(file === "wood-bowl" ? sz.x / v.size.x : sz.y / v.size.y);
          o.position.set(c.x, box.min.y, c.z);
          group.add(markDecor(o));
        }).catch(() => {})));
        later.push(fillShelves(group, slots, p.shuffle || 0));
        group.userData.waitFor = Promise.all(later);
      }
      group.add(obj);
      if (spec.tv) { const tv = new THREE.Group(); tvOnTop(builder(tv), W, D, H); group.add(tv); }
      group.userData.real = true;
      return group.userData.waitFor;
    }).catch(() => {}));
  }
  if (!spec && group.userData.bookSlots) jobs.push(fillShelves(group, group.userData.bookSlots, p.shuffle || 0));
  decor.forEach(([file, x, z, sc, y, turn], i) => {
    if (file === "books") {                       // a little stack of real books
      jobs.push(loadBooks().then((kit) => {
        const st = bookStack(kit, 2 + (i % 2), rand(p.id.length * 13 + i));
        st.position.set(x, y ?? H, z); if (turn) st.rotation.y = turn;
        group.add(markDecor(st));
      }));
      return;
    }
    jobs.push(loadAsset(file).then((a) => {
      const o = a.scene.clone(true);
      o.scale.setScalar(sc); o.position.set(x, y ?? H, z);
      o.userData.decor = true;                       // not a shelf: small things don't stand on it
      if (turn) o.rotation.y = turn;
      group.add(o);
    }).catch(() => {}));
  });
  return Promise.all(jobs).then(() => { tagged(group); if (group.userData.wantTv) setTv(group, true); });
}

// Download and unpack the scans a list of products uses, ahead of time (for quick switching)
export function preloadProducts(products) {
  const files = new Set();
  products.forEach((p) => {
    if (!p) return;
    if (REAL[p.id]) files.add(REAL[p.id].file);
    [...(DECOR[p.id] || []), ...(REAL[p.id]?.noDecor ? [] : KIND_DECOR[p.kind]?.(p.w / 100, p.d / 100, p.h / 100) || [])].forEach(([f]) => files.add(f));
  });
  files.delete(undefined);                       // pieces made of real books have no file of their own
  if (files.delete("books")) loadBooks().catch(() => {});
  return Promise.all([...files].map((f) => loadAsset(f).catch(() => null)));
}

// How strong a lamp's light is: the shop's suggested bulb (806 lm) gives the usual glow, other bulbs in proportion
const lampStrength = (p) => (p.kind === "floor-lamp" ? 5 : p.kind === "wall-lamp" ? 3 : 2) * (p.lumens || 806) / 806;
export function buildModel(p) {
  if (p.tint) p = { ...p, color: p.tint };       // drawn shapes simply use your colour
  const g = new THREE.Group();
  const b = builder(g);
  const W = p.w / 100, D = p.d / 100, H = p.h / 100;
  const keepFab = FAB;
  FAB = fabricOf(p);
  if (p.wall && !p.hang) (OPENING_MODELS[p.kind] || OPENING_MODELS.door)(b, openingOf(p), p.color);
  else (MODELS[p.kind] || ((bb) => bb.box(W, H, D, p.color)))(b, W, D, H, p.color, p);
  FAB = keepFab;
  g.children.forEach((c) => { c.userData.proc = true; });
  if (b.slots.length) g.userData.bookSlots = b.slots;
  if (p.kind === "floor-lamp" || p.kind === "table-lamp" || p.kind === "wall-lamp") {
    const light = new THREE.PointLight(0xffd29a, 0, 5, 2);
    light.position.y = p.kind === "wall-lamp" ? H * 0.6 : H - 0.2;
    if (p.kind === "wall-lamp") light.position.z = D * 0.35;
    light.userData.lamp = lampStrength(p);
    g.add(light);
  }
  return g;
}

/* ---------- Floors drawn on a canvas ---------- */
const floorTextures = {};
const FLOOR_SIZE = { oak: 2, walnut: 2, herring: 1.2, tiles: 1.2, terrazzo: 1.5, concrete: 3, carpet: 1 };
function floorTexture(kind, base) {
  if (floorTextures[kind]) return floorTextures[kind];
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const x = c.getContext("2d"), r = rand(kind.length * 977 + 13);
  const tone = (l) => shade(base, l);
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  if (kind === "oak" || kind === "walnut") {
    const rows = 8, ph = 512 / rows;
    for (let row = 0; row < rows; row++) {
      let pos = -r() * 300;
      while (pos < 512) {
        const len = 220 + r() * 200;
        x.fillStyle = tone((r() - 0.5) * 0.045); x.fillRect(pos, row * ph, len, ph);
        x.strokeStyle = tone(-0.06); x.globalAlpha = 0.35;
        for (let k = 0; k < 5; k++) { x.beginPath(); const yy = row * ph + 6 + r() * (ph - 12); x.moveTo(pos, yy); x.bezierCurveTo(pos + len / 3, yy + (r() - 0.5) * 6, pos + len * 2 / 3, yy + (r() - 0.5) * 6, pos + len, yy); x.stroke(); }
        x.globalAlpha = 1; x.fillStyle = tone(-0.1); x.fillRect(pos, row * ph, 2, ph);
        pos += len;
      }
      x.fillStyle = tone(-0.1); x.fillRect(0, row * ph, 512, 2);
    }
  } else if (kind === "herring") {
    const cell = 128, n = 4, pw = cell / n;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < n; k++) {
      x.fillStyle = tone((r() - 0.5) * 0.08);
      if ((i + j) % 2) x.fillRect(i * cell + k * pw, j * cell, pw - 2, cell - 2);
      else x.fillRect(i * cell, j * cell + k * pw, cell - 2, pw - 2);
    }
  } else if (kind === "tiles") {
    x.fillStyle = "#cfcac3"; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { x.fillStyle = tone((r() - 0.5) * 0.03); x.fillRect(i * 256 + 2, j * 256 + 2, 252, 252); }
  } else if (kind === "terrazzo") {
    const chips = ["#b9b0a4", "#e8e2d8", "#9c8f80", "#c98f6e", "#7d8a7a"];
    for (let i = 0; i < 900; i++) { x.fillStyle = chips[i % chips.length]; x.beginPath(); x.ellipse(r() * 512, r() * 512, 2 + r() * 6, 2 + r() * 4, r() * 3, 0, 7); x.fill(); }
  } else {
    for (let i = 0; i < (kind === "carpet" ? 9000 : 2500); i++) { x.fillStyle = tone((r() - 0.5) * (kind === "carpet" ? 0.08 : 0.12)); x.fillRect(r() * 512, r() * 512, kind === "carpet" ? 2 : 3, kind === "carpet" ? 2 : 3); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return (floorTextures[kind] = t);
}

/* ---------- Daylight: one table from dawn to night ----------
   [hour, background, sky light, ground light, sun colour, sun strength, sky strength, reflections, lamps] */
// Dawn and dusk are spread over about two and a half hours each, with many small steps,
// so ten minutes on the clock is only a small, soft change in the light.
const NIGHT = ["#121826", "#26314a", "#15151c", "#9fb2e0", 0.28, 0.35, 0.12, 1];
const DAY = [
  [0, ...NIGHT],
  [4.5, ...NIGHT],
  [5.25, "#1d2438", "#323d5c", "#1a1a22", "#a4b4de", 0.3, 0.38, 0.15, 1],
  [5.9, "#4a4a63", "#6d6884", "#2f2c36", "#e0a38c", 0.42, 0.46, 0.22, 0.92],
  [6.5, "#9c8f9b", "#d0b2b0", "#635a5e", "#ff9d6c", 0.68, 0.56, 0.32, 0.72],
  [7.1, "#d6bba6", "#f9c9a6", "#957f6b", "#ffa465", 0.95, 0.62, 0.4, 0.42],
  [7.8, "#e2c9b2", "#fcd6b2", "#a68f77", "#ffb472", 1.28, 0.66, 0.47, 0.16],
  [8.6, "#e7d3bf", "#ffdfc0", "#b39f87", "#ffc68c", 1.58, 0.72, 0.55, 0.03],
  [9.6, "#eadac9", "#ffe8d0", "#bfae98", "#ffd4a4", 1.95, 0.8, 0.65, 0],
  [11, "#ece2d6", "#fff2e4", "#c6b9a6", "#ffe5c6", 2.4, 0.88, 0.77, 0],
  [13, "#ece5db", "#fffaf2", "#c9bca9", "#fff4e4", 2.8, 0.95, 0.85, 0],
  [15, "#ede4d8", "#fff6ec", "#c9baa6", "#ffeacf", 2.66, 0.93, 0.82, 0],
  [16.4, "#eee0cf", "#fff0e0", "#c8b6a1", "#ffd9b0", 2.4, 0.88, 0.77, 0],
  [17.4, "#eed8c2", "#ffe7d2", "#c2ab94", "#ffc68c", 2.02, 0.82, 0.68, 0.04],
  [18.3, "#e7c4aa", "#fad6b8", "#a99380", "#ffae6c", 1.55, 0.73, 0.57, 0.18],
  [19.1, "#d2a690", "#ecb99c", "#8a7568", "#ff9255", 1.1, 0.63, 0.45, 0.42],
  [19.8, "#9a7f86", "#c3958e", "#5f5052", "#f37b52", 0.72, 0.53, 0.32, 0.68],
  [20.5, "#4b4862", "#5e5d80", "#2c2a34", "#b6a9d4", 0.44, 0.44, 0.21, 0.88],
  [21.2, "#22283b", "#363f5e", "#1a1a22", "#a4b4de", 0.32, 0.38, 0.15, 0.98],
  [22, ...NIGHT],
  [24, ...NIGHT],
];
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function daylight(t) {
  t = ((t % 24) + 24) % 24;
  let i = 0;
  while (i < DAY.length - 2 && DAY[i + 1][0] <= t) i++;
  const a = DAY[i], b = DAY[i + 1];
  const k = (t - a[0]) / (b[0] - a[0]);      // even blend: no sudden jump in the middle of a step
  const col = (j) => tmpA.set(a[j]).lerp(tmpB.set(b[j]), k).clone();
  const num = (j) => a[j] + (b[j] - a[j]) * k;
  return { bg: col(1), sky: col(2), ground: col(3), sunColor: col(4), sun: num(5), hemi: num(6), env: num(7), lamps: num(8) };
}
// Ceiling lights a room can have (scans, Poly Haven CC0). lm: the bulbs' light out of the box
export const CEILING_LIGHTS = [
  { key: "globe", name: "Glass globe", file: "ceiling-lamp", lm: 1500 },
  { key: "shades-8", name: "Shaded chandelier", file: "light-chandelier-1", lm: 2400 },
  { key: "shades-6", name: "Brass chandelier", file: "light-chandelier-2", lm: 1800 },
  { key: "candles", name: "Candle chandelier", file: "light-chandelier-3", lm: 2000 },
  { key: "lantern", name: "Ornate lantern", file: "light-lantern", lm: 900 },
  { key: "chinese", name: "Chinese lantern", file: "light-chinese", lm: 1200 },
  { key: "industrial", name: "Factory dome", file: "light-industrial", lm: 1600 },
  { key: "caged", name: "Caged strip light", file: "light-caged", lm: 2000 },
];
export const ceilingLight = (r) => CEILING_LIGHTS.find((c) => c.key === r?.lampStyle) || CEILING_LIGHTS[0];
export const lampLumens = (r) => Number.isFinite(r?.lampLumens) ? r.lampLumens : ceilingLight(r).lm;
// The colour of a bulb from its colour temperature (2200 K candle-warm to 5000 K daylight)
export function kelvinColor(k) {
  const t = Math.min(6600, Math.max(1500, k)) / 100;
  const r = 255, g = 99.47 * Math.log(t) - 161.12, b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v) => Math.min(255, Math.max(0, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}
export const LIGHT_PRESETS = { morning: 8, noon: 12.5, afternoon: 16.5, night: 21.5 };
export const DEFAULT_LIGHT = { time: 14, dir: 30, lamps: "auto" };

/* ======================================================= */
export function createPlanner3D(container, { getProject, catalog, onSelect, onMove, onCommit, onFrame, onBlocked, getSnap = () => false, demo = false, readOnly = false }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;         // redrawn only when something in the home changes, see loop()
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "canvas3d";
  renderer.domElement.setAttribute("aria-label", "3D view of your rooms. Drag to look around; drag a piece to move it.");
  renderer.domElement.setAttribute("role", "img");
  container.append(renderer.domElement);
  const overlay = document.createElement("div");
  overlay.className = "view3d-overlay";
  container.append(overlay);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#ece5db");
  scene.fog = new THREE.Fog("#ece5db", 40, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 200);
  // Ambient occlusion: the soft darkening in corners, under sofas and where things meet, like a real photo
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const aoPass = new GTAOPass(scene, camera, 1, 1);
  aoPass.blendIntensity = 1;
  aoPass.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.5, scale: 1.1, samples: 14, distanceFallOff: 1 });
  aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 14 });
  composer.addPass(aoPass);
  composer.addPass(new OutputPass());
  const draw = () => composer.render();
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.9;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 0.6;
  controls.maxDistance = 70;
  controls.screenSpacePanning = false;
  if (demo) {
    // On the home page: the wheel and vertical swipes keep scrolling the page
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotateSpeed = 0.7;
    renderer.domElement.style.touchAction = "pan-y";
  }

  const hemi = new THREE.HemisphereLight(0xfffaf2, 0xc9bca9, 0.95);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(hemi, sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#e3dbcf", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.045; ground.receiveShadow = true;
  scene.add(ground);

  const roomsGroup = new THREE.Group(), itemsGroup = new THREE.Group(), helpers = new THREE.Group();
  scene.add(roomsGroup, itemsGroup, helpers);

  const models = new Map();     // item id → { catalogId, group, target, spawn, wallK }
  const dying = [];             // removed pieces shrinking away
  let walls = [];               // { key, group, normal, roomId, height, items, rect, cur }
  let ceilingLamps = [];        // { group, light, room }
  let wallMode = "auto";        // auto (cut-away) | up | down
  let selection = null;
  let bounds = { cx: 5, cz: 4, size: 10 };
  let synced = false;
  let light = { ...DEFAULT_LIGHT };
  let lampFactor = 0;

  // ---------- Rooms: floors + walls with holes ----------
  function onEdge(it, edge, hung = false) {
    const p = catalog.piece(it);
    if (!p?.wall || !!p.hang !== hung) return false;
    const horizontal = edge.axis === "x";
    const rot = ((Math.round(it.rot || 0)) % 360 + 360) % 360;
    if (horizontal !== (rot === 0 || rot === 180)) return false;
    const across = horizontal ? it.y : it.x, along = horizontal ? it.x : it.y;
    return Math.abs(across - edge.line) < 0.2 && along > edge.a - 0.05 && along < edge.b + 0.05;
  }

  const floorMats = new Map();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // What the floor's colour is multiplied by: aim the average at the colour picked, then lighten or darken
  function floorTone(f, look = {}) {
    const c = new THREE.Color(1, 1, 1);
    if (!look.tint && f.tint) c.set(f.tint);      // a colour of your own is put in by the shader (floorTint)
    return c.multiplyScalar(Math.max(0.3, 1 + (look.shade || 0) / 100));
  }
  // How bright a floor picture is on average (linear light), so a new colour keeps the same brightness pattern
  const lumOf = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  function meanLum(img) {
    try {
      const cv = document.createElement("canvas"); cv.width = cv.height = 16;
      const x = cv.getContext("2d"); x.drawImage(img, 0, 0, 16, 16);
      const d = x.getImageData(0, 0, 16, 16).data, lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
      return s / 256;
    } catch { return null; }
  }
  // A floor in a colour you picked: the grain, veins and grout keep their light and dark, the colour is yours.
  // (Multiplying the picture by a colour barely changed a dark or similar floor.)
  function tintFloor(mat, tint, avg) {
    const u = { floorTint: { value: new THREE.Color(tint) }, floorAvg: { value: avg }, floorMix: { value: 0.9 } };
    mat.userData.floorU = u;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = "uniform vec3 floorTint;\nuniform float floorAvg;\nuniform float floorMix;\n" + sh.fragmentShader.replace("#include <map_fragment>", `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  float fl = dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
  vec3 tinted = floorTint * clamp( mix( 1.0, fl / max( floorAvg, 0.002 ), 0.8 ), 0.0, 2.2 );
  diffuseColor.rgb *= mix( sampledDiffuseColor.rgb, tinted, floorMix );
#endif`);
    };
    mat.customProgramCacheKey = () => "floor-tint";
  }
  // at = the room's corner: the pattern is laid from the same point in every room, so planks and tiles
  // run on from one room into the next (it shows when the wall between them is taken away)
  function floorMaterial(kind, w, h, look = {}, at = { x: 0, y: 0 }) {
    const key = `${kind}|${w}|${h}|${at.x}|${at.y}|${look.tint || ""}|${look.shade || 0}`;
    floorUsed?.add(key);
    if (!floorMats.has(key)) {
      const f = catalog.FLOORS[kind];
      const size = f.size || FLOOR_SIZE[kind] || 2;
      // A drawn texture straight away; the scanned one replaces it as soon as it has loaded
      const tex = floorTexture(kind, f.color).clone();
      tex.needsUpdate = true;
      const lay = (t) => { t.repeat.set(w / size, h / size); t.offset.set(at.x / size, -(at.y + h) / size); };
      lay(tex);
      const gloss = f.gloss ?? (kind === "tiles" ? 0.7 : 0.38);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 - gloss * 0.75, envMapIntensity: f.pile ? 0.2 : 0.45 + gloss * 0.5 });   // fabric: no sheen of reflections
      mat.color.copy(floorTone(f, look));
      if (look.tint) tintFloor(mat, look.tint, lumOf(new THREE.Color(f.color)));
      floorMats.set(key, mat);
      if (f.tex) scannedFloor(kind, f.v).then(({ map, normal }) => {
        const m = map.clone(), n = normal.clone();
        [m, n].forEach((t) => { lay(t); t.anisotropy = maxAniso; t.needsUpdate = true; });
        mat.map = m; mat.normalMap = n; mat.normalScale.setScalar(f.pile ?? 0.6);   // pile: deeper fibres on carpet
        mat.color.copy(floorTone(f, look));                   // carpet: the scan's natural wool a shade warmer
        if (mat.userData.floorU) mat.userData.floorU.floorAvg.value = (map.userData.lum ??= meanLum(map.image)) || mat.userData.floorU.floorAvg.value;
        mat.needsUpdate = true;
        tex.dispose();
        requestRender();
      }).catch(() => {});   // offline: keep the drawn texture
    }
    return floorMats.get(key);
  }

  let floorUsed = null;
  function buildRooms(project) {
    floorUsed = new Set();
    const prev = new Map(walls.map((w) => [w.key, w.cur]));
    roomsGroup.traverse((o) => { if (o.userData.ownGeo) o.geometry.dispose(); });
    roomsGroup.clear();
    walls = []; ceilingLamps = [];
    const openKeys = new Set(project.openWalls || []);
    const open = sharedWalls(project.rooms).filter((s) => openKeys.has(s.key));
    // a corner of the room that sits on a wall taken away: the side wall runs on to fill it
    const openAt = (x, y) => open.some((s) => Math.abs(s.y1 - s.y2) < 1e-6 && Math.abs(s.y1 - y) < WALL_T && x > s.x1 - 0.01 && x < s.x2 + 0.01);
    project.rooms.forEach((r) => {
      const H = r.height || 2.6;
      // Floor
      const kind = catalog.FLOORS[r.floor] ? r.floor : "oak";
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), floorMaterial(kind, r.w, r.h, { tint: r.floorTint, shade: r.floorShade }, { x: r.x, y: r.y }));
      floor.userData.ownGeo = true;
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(r.x + r.w / 2, 0.001, r.y + r.h / 2);
      floor.receiveShadow = true;
      floor.userData.roomId = r.id;
      const slab = new THREE.Mesh(boxGeo(r.w, 0.045, r.h, 0), mat("#cfc6b9"));
      slab.position.set(r.x + r.w / 2, -0.0225, r.y + r.h / 2);
      slab.receiveShadow = true;
      roomsGroup.add(floor, slab);

      // Four walls, inside the room's outline
      const t = WALL_T;
      const edges = [
        { axis: "x", line: r.y, a: r.x, b: r.x + r.w, off: r.y + t / 2, normal: new THREE.Vector3(0, 0, -1) },
        { axis: "x", line: r.y + r.h, a: r.x, b: r.x + r.w, off: r.y + r.h - t / 2, normal: new THREE.Vector3(0, 0, 1) },
        { axis: "z", line: r.x, a: r.y + (openAt(r.x + t / 2, r.y) ? 0 : t), b: r.y + r.h - (openAt(r.x + t / 2, r.y + r.h) ? 0 : t), off: r.x + t / 2, normal: new THREE.Vector3(-1, 0, 0) },
        { axis: "z", line: r.x + r.w, a: r.y + (openAt(r.x + r.w - t / 2, r.y) ? 0 : t), b: r.y + r.h - (openAt(r.x + r.w - t / 2, r.y + r.h) ? 0 : t), off: r.x + r.w - t / 2, normal: new THREE.Vector3(1, 0, 0) },
      ];
      const wallMat = wallMaterial(r.wall || "#f5f1ea");   // painted plaster: a soft, uneven finish
      const skirtMat = mat(shade(r.wall || "#f5f1ea", 0.03), { rough: 0.45 });
      // The cut top of a wall, dark like the walls on an architect's plan: the rooms read at a glance
      const capped = [wallMat, wallMat, WALL_CAP, wallMat, wallMat, wallMat];
      edges.forEach((e, ei) => {
        // Where another room sits right behind this wall, the two walls are one: they go down together.
        // Split the wall there so only the shared stretch is linked.
        const cuts = [e.a, e.b], links = [];
        project.rooms.forEach((q) => {
          if (q === r) return;
          const qLine = e.axis === "x" ? (e.normal.z < 0 ? q.y + q.h : q.y) : (e.normal.x < 0 ? q.x + q.w : q.x);
          if (Math.abs(qLine - e.line) > WALL_T + 0.03) return;
          const lo = Math.max(e.a, e.axis === "x" ? q.x : q.y), hi = Math.min(e.b, e.axis === "x" ? q.x + q.w : q.y + q.h);
          if (hi - lo < 0.05) return;
          cuts.push(lo, hi);
          links.push({ lo, hi, link: [r.id, q.id].sort().join("|") + e.axis });
        });
        const stops = [...new Set(cuts.map((v) => Math.round(v * 1000) / 1000))].sort((u, v) => u - v);
        const segs = [];
        for (let i = 0; i + 1 < stops.length; i++) {
          const a0 = stops[i], a1 = stops[i + 1], mid = (a0 + a1) / 2;
          if (a1 - a0 < 0.005) continue;
          const link = links.find((l) => mid > l.lo && mid < l.hi)?.link || null;
          segs.push({ a0, a1, group: new THREE.Group(), items: new Set(), link, open: !!link && openKeys.has(link) });
        }
        // Next to a wall taken away, the wall that stays runs on by its thickness: it meets the other room's
        // wall there, instead of leaving a notch in the corner
        segs.forEach((g, i) => {
          if (g.open) return;
          if (segs[i - 1]?.open) { g.a0 = Math.max(e.a, g.a0 - t); g.capLo = true; }
          if (segs[i + 1]?.open) { g.a1 = Math.min(e.b, g.a1 + t); g.capHi = true; }
        });
        const holes = project.items.filter((it) => onEdge(it, e)).map((it) => {
          const o = openingOf(catalog.piece(it));
          const c = e.axis === "x" ? it.x : it.y;
          return { id: it.id, a0: Math.max(e.a, c - o.w / 2), a1: Math.min(e.b, c + o.w / 2), ...o };
        }).sort((p, q) => p.a0 - q.a0);
        // One block of wall, cut at the segment borders
        const piece = (A0, A1, y0, y1) => segs.forEach((g) => {
          if (g.open) return;                        // taken away: the two rooms are one open space here
          const a0 = Math.max(A0, g.a0), a1 = Math.min(A1, g.a1);
          if (a1 - a0 < 0.005 || y1 - y0 < 0.005) return;
          const L = a1 - a0, mid = (a0 + a1) / 2;
          const m = new THREE.Mesh(boxGeo(e.axis === "x" ? L : t, y1 - y0, e.axis === "x" ? t : L, 0), y1 >= H - 0.001 ? capped : wallMat);
          m.position.set(e.axis === "x" ? mid : e.off, y0 + (y1 - y0) / 2, e.axis === "x" ? e.off : mid);
          m.castShadow = true; m.receiveShadow = true;
          g.group.add(m);
          if (y0 < 0.001 && y1 > 0.09) {                // a skirting board along the bottom, on the room side
            const sk = new THREE.Mesh(boxGeo(e.axis === "x" ? L : 0.014, 0.08, e.axis === "x" ? 0.014 : L, 0.003), skirtMat);
            const inward = t / 2 + 0.007;
            sk.position.set(e.axis === "x" ? mid : e.off - e.normal.x * inward, 0.04, e.axis === "x" ? e.off - e.normal.z * inward : mid);
            sk.receiveShadow = true;
            g.group.add(sk);
          }
        });
        holes.forEach((h) => segs.forEach((g) => { if (h.a1 > g.a0 && h.a0 < g.a1) g.items.add(h.id); }));
        // Pictures and mirrors go down with the wall they hang on
        project.items.filter((it) => onEdge(it, e, true)).forEach((it) => {
          const c = e.axis === "x" ? it.x : it.y;
          segs.forEach((g) => { if (c >= g.a0 - 0.05 && c <= g.a1 + 0.05) g.items.add(it.id); });
        });
        let cursor = e.a;
        holes.forEach((h) => {
          piece(cursor, h.a0, 0, H);
          piece(h.a0, h.a1, 0, h.sill);
          piece(h.a0, h.a1, Math.min(H, h.sill + h.h), H);
          cursor = Math.max(cursor, h.a1);
        });
        piece(cursor, e.b, 0, H);
        // That wall's end now shows: skirting round it too, so it meets the other room's skirting
        const n = e.axis === "x" ? e.normal.z : e.normal.x, across = t + 0.014, c = e.off - n * 0.007;
        const cap = (g, at) => {
          if (!g.group.children.length) return;
          const m = new THREE.Mesh(boxGeo(e.axis === "x" ? 0.014 : across, 0.08, e.axis === "x" ? across : 0.014, 0.003), skirtMat);
          m.position.set(e.axis === "x" ? at : c, 0.04, e.axis === "x" ? c : at);
          m.receiveShadow = true;
          g.group.add(m);
        };
        segs.forEach((g) => { if (g.capLo) cap(g, g.a0 - 0.007); if (g.capHi) cap(g, g.a1 + 0.007); });
        segs.forEach((g, si) => {
          roomsGroup.add(g.group);
          const key = `${r.id}:${ei}:${si}`;
          const cur = prev.has(key) ? prev.get(key) : 1;
          walls.push({ key, group: g.group, normal: e.normal, roomId: r.id, height: H, items: g.items, rect: r, link: g.link, cur });
        });
      });

      // A ceiling light (kept for every room tall enough to have a ceiling)
      if (r.lamp !== false && H >= 2.1) {
        const lampGroup = new THREE.Group();
        lampGroup.position.set(r.x + r.w / 2, 0, r.y + r.h / 2);
        const kind = ceilingLight(r);
        const pl = new THREE.PointLight(kelvinColor(r.lampWarmth || 2700), 0, Math.max(r.w, r.h) * 1.6, 2);
        pl.position.y = H - 0.78;
        pl.userData.lamp = 9 * lampLumens(r) / 1500;       // the old globe lamp, 1500 lm, was 9
        lampGroup.add(pl);
        roomsGroup.add(lampGroup);
        const entry = { group: lampGroup, light: pl, room: r, model: null };
        ceilingLamps.push(entry);
        loadAsset(kind.file).then((a) => {
          const o = a.scene.clone(true);
          // keep 1.95 m to walk under: a long one is made smaller (to 60 %), then its chain goes up into the ceiling
          const room = H - 1.95, k = a.size.y > room ? Math.max(0.6, room / a.size.y) : 1;
          o.scale.setScalar(k);
          const bottom = Math.max(H - a.size.y * k, Math.min(1.95, H - 0.3));
          o.position.y = bottom;
          pl.position.y = bottom + Math.min(0.25, a.size.y * k * 0.3);
          o.traverse((m) => { m.castShadow = false; });
          entry.model = o;
          lampGroup.add(o);
          requestRender();
        }).catch(() => {});
      }
    });
    applyLampFactor();
    // floors of rooms that moved, grew or changed: let them go (a dragged room would leave hundreds behind)
    if (floorMats.size > 24) floorMats.forEach((m, key) => {
      if (floorUsed.has(key)) return;
      m.map?.dispose(); m.normalMap?.dispose(); m.dispose();
      floorMats.delete(key);
    });
    floorUsed = null;
  }

  // ---------- Mirrors that really reflect the room ----------
  // Each mirror surface gets a Reflector: the room drawn again from behind the glass, like a real mirror
  let reflecting = false;
  function addMirrors(group, p) {
    if (group.userData.mirrorsDone) return;
    const glass = [];                             // the glass: a material called "mirror", or marked by the builder
    group.traverse((o) => { if (o.isMesh && (o.userData.mirror || /mirror/i.test(o.material?.name || ""))) glass.push(o); });
    if (!glass.length) return;
    group.userData.mirrorsDone = true;
    const keep = { p: group.position.clone(), r: group.rotation.y, s: group.scale.clone() };
    group.position.set(0, 0, 0); group.rotation.y = 0; group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const made = [], box = new THREE.Box3();
    glass.forEach((o) => {
      box.setFromObject(o);
      if (box.max.x - box.min.x < 0.05 || box.max.y - box.min.y < 0.05) return;
      // the glass's own shape (round, arched, a door…), flattened just in front of it
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, 0);
      // facing out of the wall (the shading pass reads normals: without them the glass came out black)
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3).map((v, i) => (i % 3 === 2 ? 1 : 0)), 3));
      const m = new Reflector(geo, { clipBias: 0.003, textureWidth: 768, textureHeight: 768, color: 0xc4c6c8 });
      const reflect = m.onBeforeRender;
      // only for the picture itself: not inside the shading pass (it darkened the glass to black), not inside another mirror
      m.onBeforeRender = function (r, sc, cam) {
        if (sc.overrideMaterial || reflecting) return;
        reflecting = true;
        try { reflect.apply(this, arguments); } finally { reflecting = false; }
      };
      m.position.z = box.max.z + 0.0015;
      m.userData.reflector = true; m.userData.decor = true;
      made.push(m);
      o.visible = false;
    });
    group.position.copy(keep.p); group.rotation.y = keep.r; group.scale.copy(keep.s);
    made.forEach((m) => group.add(m));
    tagged(group);
    group.updateMatrixWorld(true);
  }

  // ---------- Furniture ----------
  // The shelves of a piece, top first, in metres: found by dropping rays through the model
  // and keeping the flat surfaces most rays land on (a shelf runs the whole width, books don't)
  const shelfRay = new THREE.Raycaster();
  function shelfLevels(group, q, lx = 0, lz = 0) {
    const W0 = q.w / 100, D0 = q.d / 100;
    lx = Math.max(-W0 * 0.42, Math.min(W0 * 0.42, lx)); lz = Math.max(-D0 * 0.3, Math.min(D0 * 0.3, lz));
    const key = `${Math.round(lx * 20)}|${Math.round(lz * 20)}`;   // 5 cm cells: shelves can differ from column to column
    group.userData.levels ||= {};
    if (group.userData.levels[key]) return group.userData.levels[key];
    const W = q.w / 100, D = q.d / 100, H = q.h / 100;
    const keep = { p: group.position.clone(), r: group.rotation.y, s: group.scale.clone() };
    group.position.set(0, 0, 0); group.rotation.y = 0; group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
    const solid = [];
    const walk = (o) => {
      if (o.userData.decor || !o.visible || o.isLight) return;
      if (o.isMesh) solid.push(o);
      o.children.forEach(walk);
    };
    group.children.forEach(walk);
    const counts = new Map();
    let rays = 0;
    const n = new THREE.Vector3();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const x = lx + (i / 4 - 0.5) * Math.min(0.16, W * 0.3), z = lz + (j - 1) * Math.min(0.08, D * 0.2);
      shelfRay.set(new THREE.Vector3(x, H + 0.5, z), new THREE.Vector3(0, -1, 0));
      const seen = new Set();
      shelfRay.intersectObjects(solid, false).forEach((h) => {
        if (!h.face || h.point.y < 0.03 || h.point.y > H + 0.05) return;
        n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        if (n.y < 0.6) return;
        seen.add(Math.round(h.point.y * 50));        // 2 cm buckets
      });
      seen.forEach((b) => counts.set(b, (counts.get(b) || 0) + 1));
      rays++;
    }
    // a surface behind a drawer front or a door isn't a shelf: look at it from the front
    const shut = (y) => {
      shelfRay.set(new THREE.Vector3(lx, y + 0.05, D / 2 + 0.3), new THREE.Vector3(0, 0, -1));
      const h = shelfRay.intersectObjects(solid, false)[0];
      return !!h && h.point.z > lz + 0.03 && h.point.y < H;
    };
    const found = [...counts].filter(([, c]) => c >= rays * 0.55).map(([b]) => b / 50).sort((a, b) => b - a).filter((y) => !shut(y));
    group.position.copy(keep.p); group.rotation.y = keep.r; group.scale.copy(keep.s);
    group.updateMatrixWorld(true);
    const levels = [];
    found.forEach((y) => { if (!levels.length || levels[levels.length - 1] - y > 0.12) levels.push(y); });
    return (group.userData.levels[key] = levels);
  }
  // Heights a small thing can stand at on piece o: one for a table, one per shelf for a bookcase
  const UP = new THREE.Vector3(0, 1, 0);
  function standHeights(o, q, it) {
    if (COUNTER.has(q.kind)) return [0.92];
    if (SEATS.has(q.kind)) return [0.42];
    const m = models.get(o.id);
    const local = new THREE.Vector3(it.x - o.x, 0, it.y - o.y).applyAxisAngle(UP, rad(o.rot || 0));
    const lv = m ? shelfLevels(m.group, q, local.x, local.z) : [];
    return lv.length ? lv : [q.h / 100];
  }
  function supportUnder(project, it) {
    let found = null;
    project.items.forEach((o) => {
      if (o === it) return;
      const q = catalog.piece(o);
      if (!q || !(SURFACES.has(q.kind) || SEATS.has(q.kind))) return;
      const { hw, hd } = itemHalf(q, o.rot || 0);
      if (Math.abs(it.x - o.x) > hw || Math.abs(it.y - o.y) > hd) return;
      const hs = standHeights(o, q, it);
      if (!found || hs[0] > found.heights[0]) found = { item: o, heights: hs };
    });
    return found;
  }
  function supportHeight(project, it) {
    if (!isSmall(catalog.piece(it))) return 0;
    const s = supportUnder(project, it);
    if (!s) return 0;
    return s.heights[Math.min(it.level || 0, s.heights.length - 1)];
  }
  function place(project, it, now = false) {
    const m = models.get(it.id);
    if (!m) return;
    const p = catalog.piece(it);
    if (p?.hang) {
      const a = rad(it.rot || 0), off = WALL_T / 2 + p.d / 200 + 0.004;
      m.target.set(it.x - Math.sin(a) * off, (p.hangAt || 150) / 100 - p.h / 200, it.y + Math.cos(a) * off);
    } else m.target.set(it.x, supportHeight(project, it), it.y);
    m.targetRot = -rad(it.rot || 0);
    if (now) { m.pos.copy(m.target); m.group.position.copy(m.target); m.group.rotation.y = m.targetRot; }
  }
  // Every lamp is a light, and when the number of lights changes the GPU has to rebuild every
  // material's shader at once: a visible freeze. So the scene always holds the same number
  // of lights; dark spare ones fill the empty places.
  const LIGHT_SLOTS = 12;
  const spareLights = [];
  function padLights() {
    let n = 0;
    scene.traverse((o) => { if (o.isPointLight && !o.userData.spare) n++; });
    const want = Math.max(0, LIGHT_SLOTS - n);
    while (spareLights.length < want) {
      const l = new THREE.PointLight(0x000000, 0, 0.01);
      l.userData.spare = true; l.position.set(0, -40, 0);
      scene.add(l); spareLights.push(l);
    }
    while (spareLights.length > want) scene.remove(spareLights.pop());
  }

  function syncItems(project) {
    let lampsChanged = false;
    const ids = new Set(project.items.map((it) => it.id));
    models.forEach((m, id) => {
      if (ids.has(id)) return;
      models.delete(id);
      dying.push({ group: m.group, t: 0 });
    });
    project.items.forEach((it) => {
      let p = catalog.piece(it);
      if (!p) return;
      // curtains on a window: how wide its glass is, so the folds gather beside it
      if (p.kind === "curtains" && it.win) {
        const win = project.items.find((o) => o.id === it.win);
        const o = win && openingOf(catalog.piece(win));
        if (o) p = { ...p, glass: o.w };
      }
      let m = models.get(it.id);
      const sizeKey = (it.size ? `${it.size.w}|${it.size.d}|${it.size.h}` : "") + (p.glass ? `|g${p.glass}` : "") + (it.tint ? `|${it.tint}` : "") + (it.style ? `|${it.style}` : "") + (it.shuffle ? `|s${it.shuffle}` : "");
      if (!m || m.catalogId !== it.catalogId || m.sizeKey !== sizeKey) {
        if (m) { itemsGroup.remove(m.group); m.group.traverse((o) => { if (o.userData.reflector) o.dispose(); }); }
        const group = buildModel(p);
        group.userData.itemId = it.id;
        tagged(group);
        itemsGroup.add(group);
        m = { catalogId: it.catalogId, sizeKey, group, pos: new THREE.Vector3(), target: new THREE.Vector3(), targetRot: 0, spawn: synced ? 0 : 1, wallK: 1 };
        models.set(it.id, m);
        place(project, it, true);
        upgradeModel(group, p).then(() => {
          delete group.userData.levels;              // the real model has its own shelves
          addMirrors(group, p);
          const pr = getProject();
          pr.items.forEach((x) => { if (x !== it && isSmall(catalog.piece(x))) place(pr, x); });
          padLights(); requestRender();
        });
        if (p.kind === "floor-lamp" || p.kind === "table-lamp") applyLampFactor();
      }
      if (TV_KINDS.has(p.kind) && !!it.on !== !!m.group.userData.wantTv) {
        m.group.userData.wantTv = !!it.on;
        setTv(m.group, !!it.on);
        padLights();
      }
      if (/^(floor|table|wall)-lamp$/.test(p.kind)) {   // a new bulb: same lamp, other light
        const want = lampStrength(p);
        m.group.traverse((o) => { if (o.isPointLight && o.userData.lamp !== undefined && o.userData.lamp !== want) { o.userData.lamp = want; lampsChanged = true; } });
      }
      place(project, it);
    });
    if (lampsChanged) applyLampFactor();
    synced = true;
  }

  // Animate pieces towards where they should be (moves, turns, appearing, disappearing)
  function animateItems(dt) {
    let busy = false;
    models.forEach((m, id) => {
      const g = m.group;
      const fast = drag && drag.it.id === id;
      const k = damp(fast ? 28 : 13, dt);
      if (m.pos.distanceToSquared(m.target) > 1e-7) { m.pos.lerp(m.target, k); busy = true; } else m.pos.copy(m.target);
      let dr = m.targetRot - g.rotation.y;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      if (Math.abs(dr) > 1e-4) { g.rotation.y += dr * damp(fast ? 30 : 12, dt); busy = true; } else g.rotation.y = m.targetRot;
      let s = 1, lift = 0;
      if (m.spawn < 1) {
        m.spawn = Math.min(1, m.spawn + dt / 0.42);
        s = 0.55 + 0.45 * easeBack(m.spawn);
        lift = (1 - ease(m.spawn)) * 0.35;
        busy = true;
      }
      g.scale.set(s, s * m.wallK, s);
      g.position.set(m.pos.x, m.pos.y + lift, m.pos.z);
      g.visible = m.wallK > 0.08;
    });
    for (let i = dying.length - 1; i >= 0; i--) {
      const d = dying[i];
      d.t = Math.min(1, d.t + dt / 0.22);
      d.group.scale.setScalar(Math.max(0.001, 1 - ease(d.t)));
      if (d.t >= 1) {
        itemsGroup.remove(d.group); dying.splice(i, 1); padLights();
        d.group.traverse((o) => { if (o.userData.reflector) o.dispose(); });
      } else busy = true;
    }
    return busy;
  }

  // ---------- Selection: footprint, rotation ring, distances to the walls ----------
  const ACCENT = 0x2f7a66;
  const selGroup = new THREE.Group();
  const fpFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.14, depthWrite: false }));
  fpFill.rotation.x = -Math.PI / 2; fpFill.position.y = 0.006;
  const fpEdge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, 0.008, -0.5), new THREE.Vector3(0.5, 0.008, -0.5), new THREE.Vector3(0.5, 0.008, 0.5), new THREE.Vector3(-0.5, 0.008, 0.5),
  ]), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.75, depthWrite: false }));
  ring.rotation.x = Math.PI / 2;
  const ringHitMesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 6, 64), new THREE.MeshBasicMaterial({ visible: false }));
  ringHitMesh.rotation.x = Math.PI / 2;
  const knob = new THREE.Group();
  const knobDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 32), new THREE.MeshBasicMaterial({ color: ACCENT }));
  const knobDot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const knobHit = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  knob.add(knobDisc, knobDot, knobHit);
  const ringGroup = new THREE.Group();
  ringGroup.add(ring, ringHitMesh, knob);
  ringGroup.position.y = 0.025;
  selGroup.add(fpFill, fpEdge, ringGroup);
  const roomOutline = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: ACCENT }));
  const guideLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0x292524, dashSize: 0.05, gapSize: 0.035, transparent: true, opacity: 0.8 }));
  helpers.add(selGroup, roomOutline, guideLines);
  [selGroup, roomOutline, guideLines].forEach((o) => { o.visible = false; });
  [fpFill, fpEdge, ring, knobDisc, knobDot].forEach((o) => { o.renderOrder = 5; o.material.depthTest = o === fpFill || o === fpEdge; });

  const tags = [0, 1, 2].map(() => {
    const el = document.createElement("span");
    el.className = "measure-tag"; el.hidden = true;
    overlay.append(el);
    return el;
  });

  function overlapsOther(project, it) {
    const p = catalog.piece(it);
    const solid = (q) => q && !q.wall && q.kind !== "rug" && !isSmall(q);
    if (!solid(p)) return false;
    const a = itemHalf(p, it.rot || 0);
    return project.items.some((o) => {
      if (o === it) return false;
      const q = catalog.piece(o);
      if (!solid(q)) return false;
      const b = itemHalf(q, o.rot || 0);
      return Math.abs(it.x - o.x) < a.hw + b.hw - 0.02 && Math.abs(it.y - o.y) < a.hd + b.hd - 0.02;
    });
  }

  function showSelection() {
    const project = getProject();
    selGroup.visible = roomOutline.visible = false;
    if (!selection) return;
    if (selection.type === "item") {
      const it = project.items.find((q) => q.id === selection.id);
      const p = it && catalog.piece(it);
      if (!p || !models.get(it.id)) return;
      const w = p.w / 100 + 0.08, d = (p.wall ? WALL_T + 0.1 : p.d / 100 + 0.08);
      fpFill.scale.set(w, d, 1); fpEdge.scale.set(w, 1, d);
      const R = Math.hypot(p.w / 100, p.d / 100) / 2 + 0.2;
      ring.scale.setScalar(R); ringHitMesh.scale.setScalar(R);
      ring.scale.z = ringHitMesh.scale.z = 1;
      knob.position.set(0, 0, R);
      ringGroup.visible = !p.wall;
      const bad = overlapsOther(project, it);
      fpFill.material.color.set(bad ? 0xdc2626 : ACCENT); fpEdge.material.color.set(bad ? 0xdc2626 : ACCENT);
      selGroup.visible = true;
    } else {
      const r = project.rooms.find((q) => q.id === selection.id);
      if (!r) return;
      roomOutline.geometry.setFromPoints([
        new THREE.Vector3(r.x, 0.012, r.y), new THREE.Vector3(r.x + r.w, 0.012, r.y),
        new THREE.Vector3(r.x + r.w, 0.012, r.y + r.h), new THREE.Vector3(r.x, 0.012, r.y + r.h),
      ]);
      roomOutline.visible = true;
    }
  }
  // The marker follows the animated piece
  function followSelection() {
    if (!selGroup.visible || selection?.type !== "item") return;
    const m = models.get(selection.id);
    if (!m) return;
    const p = catalog.piece(getProject().items.find((q) => q.id === selection.id));
    selGroup.position.set(m.group.position.x, p?.hang ? 0 : m.group.position.y, m.group.position.z);
    selGroup.rotation.y = m.group.rotation.y;
  }

  const v3 = new THREE.Vector3();
  function toScreen(x, y, z) {
    v3.set(x, y, z).project(camera);
    if (v3.z > 1) return null;
    return { x: (v3.x + 1) / 2 * container.clientWidth, y: (1 - v3.y) / 2 * container.clientHeight };
  }
  function setTag(el, text, pos) {
    if (!pos) { el.hidden = true; return; }
    el.hidden = false; el.textContent = text;
    el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
  }
  const cm = (m) => `${Math.max(0, Math.round(m * 100))} cm`;
  // While moving or turning a piece: how far it is from the walls around it
  function updateGuides() {
    tags.forEach((t) => { t.hidden = true; });
    guideLines.visible = false;
    if (!drag) return;
    const project = getProject();
    const it = drag.it, p = catalog.piece(it);
    if (drag.kind === "rotate") {
      const m = models.get(it.id);
      const top = m && toScreen(m.group.position.x, (p.h / 100) + 0.25, m.group.position.z);
      setTag(tags[2], `${Math.round(((it.rot || 0) % 360 + 360) % 360)}°`, top);
    }
    if (p.wall) return;
    const r = roomAt(project.rooms, it.x, it.y);
    if (!r) return;
    const { hw, hd } = itemHalf(p, it.rot || 0), T = WALL_T, y = 0.03;
    const L = r.x + T, Rr = r.x + r.w - T, Tp = r.y + T, B = r.y + r.h - T;
    const gx = it.x - hw - L < Rr - (it.x + hw) ? [L, it.x - hw] : [it.x + hw, Rr];
    const gz = it.y - hd - Tp < B - (it.y + hd) ? [Tp, it.y - hd] : [it.y + hd, B];
    const pts = [new THREE.Vector3(gx[0], y, it.y), new THREE.Vector3(gx[1], y, it.y), new THREE.Vector3(it.x, y, gz[0]), new THREE.Vector3(it.x, y, gz[1])];
    guideLines.geometry.setFromPoints(pts);
    guideLines.computeLineDistances();
    guideLines.visible = true;
    setTag(tags[0], cm(gx[1] - gx[0]), toScreen((gx[0] + gx[1]) / 2, y, it.y));
    setTag(tags[1], cm(gz[1] - gz[0]), toScreen(it.x, y, (gz[0] + gz[1]) / 2));
  }

  // ---------- Measurements on the plan (worked out in Python: tools/materials.py) ----------
  // result.rooms[i] belongs to project.rooms[i]. Each room gets its width and depth on the two
  // edges nearest the camera, and a small card in the middle with what to buy for it.
  let measured = [];
  const escText = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const metres = (v) => `${v.toFixed(2)} m`;
  const num = (v, digits = 2) => String(+v.toFixed(digits));   // 8 instead of 8.00, 2.6 instead of 2.60
  function setMeasurements(result) {
    measured.forEach((m) => { m.w.remove(); m.d.remove(); m.card.remove(); });
    measured = [];
    if (result) {
      const rooms = getProject().rooms;
      result.rooms.forEach((res, i) => {
        const room = rooms[i];
        if (!room) return;
        const make = (cls, html) => { const el = document.createElement("div"); el.className = cls; el.innerHTML = html; overlay.append(el); return el; };
        const floorColor = catalog.FLOORS[room.floor]?.color || "#c9b8a2";
        const paint = res.outdoor ? "" : `<span class="rm-row"><i class="rm-dot" style="background:${escText(res.wall_colour)}"></i>${res.paint_litres} L paint<small>${escText(res.wall_name)}</small></span>`;
        const floor = res.floor.boxes ? `<span class="rm-row"><i class="rm-dot is-floor" style="background:${escText(floorColor)}"></i>${res.floor.boxes} boxes<small>${escText(res.floor.kind.toLowerCase())}</small></span>` : "";
        const card = make("room-measure", `
          <strong>${escText(res.name)}</strong>
          <span class="rm-size">${num(res.w)} × ${num(res.d)} m · ${num(res.floor_area, 1)} m²${res.outdoor ? "" : ` · ${num(res.height)} m high`}</span>
          ${paint}${floor}`);
        measured.push({ id: room.id, card, w: make("dim-tag", metres(res.w)), d: make("dim-tag", metres(res.d)) });
      });
    }
    overlay.classList.toggle("is-measuring", !!result);
    requestRender();
  }
  function placeTag(el, pos) {
    if (!pos || pos.x < -40 || pos.y < -40 || pos.x > container.clientWidth + 40 || pos.y > container.clientHeight + 40) { el.hidden = true; return; }
    el.hidden = false;
    el.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)`;
  }
  // True when no other room is built against this side of r
  function freeEdge(rooms, r, side) {
    return !rooms.some((q) => {
      if (q === r) return false;
      const alongX = q.x < r.x + r.w - 0.2 && q.x + q.w > r.x + 0.2;
      const alongZ = q.y < r.y + r.h - 0.2 && q.y + q.h > r.y + 0.2;
      if (side === "top") return alongX && Math.abs(q.y + q.h - r.y) < 0.5;
      if (side === "bottom") return alongX && Math.abs(q.y - (r.y + r.h)) < 0.5;
      if (side === "left") return alongZ && Math.abs(q.x + q.w - r.x) < 0.5;
      return alongZ && Math.abs(q.x - (r.x + r.w)) < 0.5;
    });
  }
  function updateMeasureTags() {
    if (!measured.length) return;
    const rooms = getProject().rooms;
    const y = 0.04, inset = 0.3;                     // just inside the room, so neighbours' labels never collide
    measured.forEach((m) => {
      const r = rooms.find((q) => q.id === m.id);
      if (!r) { m.w.hidden = m.d.hidden = m.card.hidden = true; return; }
      // The edge nearest the camera, unless another room sits against it and the other edge is free
      let top = Math.abs(camera.position.z - r.y) < Math.abs(camera.position.z - (r.y + r.h));
      if (!freeEdge(rooms, r, top ? "top" : "bottom") && freeEdge(rooms, r, top ? "bottom" : "top")) top = !top;
      let left = Math.abs(camera.position.x - r.x) < Math.abs(camera.position.x - (r.x + r.w));
      if (!freeEdge(rooms, r, left ? "left" : "right") && freeEdge(rooms, r, left ? "right" : "left")) left = !left;
      const nearZ = top ? r.y + inset : r.y + r.h - inset;
      const nearX = left ? r.x + inset : r.x + r.w - inset;
      placeTag(m.w, toScreen(r.x + r.w / 2, y, nearZ));
      placeTag(m.d, toScreen(nearX, y, r.y + r.h / 2));
      const center = toScreen(r.x + r.w / 2, y, r.y + r.h / 2);
      placeTag(m.card, center);
      // Small on screen (far away or a tiny room): only the name and size
      const a = toScreen(r.x, y, r.y + r.h / 2), b = toScreen(r.x + r.w, y, r.y + r.h / 2);
      m.card.classList.toggle("is-compact", !a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 200);
    });
  }

  // ---------- Cut-away walls (like a doll's house), lowered smoothly ----------
  const camDir = new THREE.Vector3();
  function applyWalls(dt) {
    camDir.subVectors(camera.position, controls.target).setY(0).normalize();
    const inside = getProject().rooms.find((r) => camera.position.x > r.x && camera.position.x < r.x + r.w && camera.position.z > r.y && camera.position.z < r.y + r.h && camera.position.y < (r.height || 2.6));
    const factor = new Map();
    let busy = false;
    const lowOf = (w) => {
      let low = wallMode === "down" || (wallMode === "auto" && !inside && w.normal.dot(camDir) > 0.2);
      if (inside && w.roomId !== inside.id && w.normal.dot(camDir) > 0.2) low = wallMode !== "up";
      return low;
    };
    // A wall shared by two rooms goes down as soon as either side of it does (seen from outside)
    const linkedLow = new Set();
    if (wallMode === "auto" && !inside) walls.forEach((w) => { if (w.link && lowOf(w)) linkedLow.add(w.link); });
    walls.forEach((w) => {
      const low = lowOf(w) || (w.link != null && linkedLow.has(w.link));
      const goal = low ? 0 : 1;
      if (Math.abs(goal - w.cur) > 0.002) { w.cur += (goal - w.cur) * damp(7.5, dt); busy = true; } else w.cur = goal;
      const lowH = 0.12 / w.height, k = lowH + (1 - lowH) * ease(w.cur);
      w.group.scale.y = k;
      w.items.forEach((id) => factor.set(id, Math.min(factor.get(id) ?? 1, k)));
    });
    models.forEach((m, id) => { m.wallK = catalog.piece(m)?.wall ? (factor.get(id) ?? 1) : 1; });
    // Ceiling lights hang in the way when you look from above: show them only from inside
    ceilingLamps.forEach((c) => { if (c.model) c.model.visible = wallMode === "up" || (inside && inside.id === c.room.id); });
    return busy;
  }

  // ---------- Sun, sky and lamps ----------
  function applyLampFactor() {
    const L = lampFactor;
    lampGlow = 0.12 + 1.5 * L;
    glowMats.forEach((m) => { m.emissiveIntensity = lampGlow; });
    const set = (l) => { l.intensity = l.userData.lamp * L; };
    itemsGroup.traverse((o) => { if (o.isPointLight) set(o); });
    ceilingLamps.forEach((c) => set(c.light));
  }
  // Dark mode: the space around the house goes dark too, the house itself keeps its daylight
  const DARK_BG = new THREE.Color("#1b1816");
  let darkUI = document.documentElement.dataset.theme === "dark";
  const onTheme = (e) => { darkUI = e.detail === "dark"; applyLight(); requestRender(); };
  window.addEventListener("atelier:theme", onTheme);
  function applyLight() {
    const d = daylight(light.time);
    const bg = darkUI ? d.bg.clone().lerp(DARK_BG, 0.85) : d.bg;
    scene.background.copy(bg);
    scene.fog.color.copy(bg);
    ground.material.color.copy(bg).offsetHSL(0, 0, -0.03);
    if (darkUI) ground.material.color.multiplyScalar(0.35 + 0.5 * Math.max(0, 1 - d.sun / 1.6));   // bright sun lights the ground up: start it darker
    hemi.color.copy(d.sky); hemi.groundColor.copy(d.ground); hemi.intensity = d.hemi;
    scene.environmentIntensity = d.env;
    sun.color.copy(d.sunColor); sun.intensity = d.sun;
    // Sun path: rises in the east of `dir`, highest around 13:00. At dusk the light slides
    // over to the moon's side instead of jumping there, so shadows move gently.
    const t = light.time;
    const sunEl = rad(6 + 56 * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 5.5) / 15.5))));
    const sunAz = rad(light.dir + (t - 13) * 15);
    const moonEl = rad(38), moonAz = rad(light.dir + 180);
    const dayW = THREE.MathUtils.smoothstep(t, 5.2, 7) * (1 - THREE.MathUtils.smoothstep(t, 19.4, 21.4));
    const dirOf = (el, az) => new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const v = dirOf(moonEl, moonAz).lerp(dirOf(sunEl, sunAz), dayW).normalize();
    const dist = bounds.size + 16;
    sun.position.set(bounds.cx + v.x * dist, v.y * dist, bounds.cz + v.z * dist);
    sun.target.position.set(bounds.cx, 0, bounds.cz);
    lampFactor = light.lamps === "on" ? 1 : light.lamps === "off" ? 0 : d.lamps;
    applyLampFactor();
    container.dataset.night = String(d.sun < 0.6);
  }
  // Changes fade instead of switching: a preset eases across over `ms`; while a slider is being
  // dragged (short `ms`) the light keeps gliding after the thumb.
  let lightAnim = null, lightGoal = null, lastLightFrame = 0;
  function setLight(next, ms = 900) {
    const from = light.time, to = next.time ?? light.time;
    light = { ...light, ...next, time: from };
    if (ms === 0) { lightAnim = null; light.time = to; applyLight(); requestRender(); return; }
    if (ms <= 450) {                           // follow a slider smoothly
      lightGoal = to;
      if (!lightAnim || !lightAnim.glide) {
        lastLightFrame = performance.now();
        lightAnim = (now) => {
          const dt = Math.min(0.05, (now - lastLightFrame) / 1000); lastLightFrame = now;
          light.time += (lightGoal - light.time) * damp(1000 / ms * 2.2, dt);
          if (Math.abs(lightGoal - light.time) < 0.003) { light.time = lightGoal; lightAnim = null; }
          applyLight();
        };
        lightAnim.glide = true;
      }
      requestRender();
      return;
    }
    const start = performance.now();
    lightAnim = (now) => {
      const k = Math.min(1, (now - start) / ms);
      light.time = from + (to - from) * ease(k);
      applyLight();
      if (k >= 1) lightAnim = null;
    };
    requestRender();
  }

  // ---------- Camera ----------
  function measure() {
    const project = getProject();
    const pts = project.rooms.flatMap((r) => [[r.x, r.y], [r.x + r.w, r.y + r.h]]);
    project.items.forEach((it) => pts.push([it.x, it.y]));
    if (!pts.length) { bounds = { cx: 3, cz: 2.5, size: 6 }; } else {
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
      bounds = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ, 3) };
    }
    const s = bounds.size / 2 + 4;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: bounds.size * 2 + 40 });
    sun.shadow.camera.updateProjectionMatrix();
    applyLight();
    return bounds;
  }

  let anim = null;
  function flyTo(pos, target, ms = 900, fov = camera.fov) {
    const from = { p: camera.position.clone(), t: controls.target.clone(), f: camera.fov }, start = performance.now();
    if (ms === 0) { camera.position.copy(pos); controls.target.copy(target); setLens(fov); anim = null; requestRender(); return; }
    anim = (now) => {
      const k = Math.min(1, (now - start) / ms), e = ease(k);
      camera.position.lerpVectors(from.p, pos, e);
      controls.target.lerpVectors(from.t, target, e);
      setLens(from.f + (fov - from.f) * e);
      if (k >= 1) anim = null;
    };
    requestRender();
  }

  function setLens(fov) { camera.fov = fov; camera.updateProjectionMatrix(); }

  function view(name, ms = 900) {
    const b = measure();
    const aspect = Math.max(0.5, container.clientWidth / Math.max(1, container.clientHeight));
    const dist = (b.size * (aspect < 1 ? 1.2 / aspect : 0.92)) + 4.2;
    const target = new THREE.Vector3(b.cx, 0.4, b.cz);
    if (name === "top") return flyTo(new THREE.Vector3(b.cx, dist * 1.35, b.cz + 0.01), target, ms, 42);
    if (name === "eye") {
      const project = getProject();
      const r = (selection?.type === "room" && project.rooms.find((q) => q.id === selection.id)) || project.rooms[0];
      if (!r) return view("3d", ms);
      // Stand just inside the door, as if you had walked in; otherwise in the free corner
      const door = project.items.find((it) => ["door", "glass-door"].includes(catalog.piece(it)?.kind)
        && it.x >= r.x - 0.2 && it.x <= r.x + r.w + 0.2 && it.y >= r.y - 0.2 && it.y <= r.y + r.h + 0.2);
      const centre = new THREE.Vector3(r.x + r.w / 2, 1.25, r.y + r.h / 2);
      let eye;
      if (door) {
        const into = { 0: [0, 1], 180: [0, -1], 270: [1, 0], 90: [-1, 0] }[((Math.round(door.rot || 0)) % 360 + 360) % 360] || [0, 1];
        eye = new THREE.Vector3(door.x + into[0] * 0.35, 1.55, door.y + into[1] * 0.35);
      } else {
        eye = new THREE.Vector3(r.x + 0.35, 1.55, r.y + r.h - 0.35);
      }
      return flyTo(eye, centre, ms, 62);
    }
    const dir = new THREE.Vector3(0.42, 0.78, 0.75).normalize().multiplyScalar(dist);
    flyTo(target.clone().add(dir), target, ms, 42);
  }

  function zoom(f) {
    const off = camera.position.clone().sub(controls.target).multiplyScalar(1 / f);
    const len = THREE.MathUtils.clamp(off.length(), controls.minDistance, controls.maxDistance);
    flyTo(controls.target.clone().add(off.setLength(len)), controls.target.clone(), 320);
  }

  // ---------- Picking and dragging ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function aim(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function itemAt(e) {
    aim(e);
    const hit = ray.intersectObjects(itemsGroup.children, true).find((h) => {
      if (!h.object.isMesh) return false;
      for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
      return true;
    });
    return hit?.object.userData.itemId || null;
  }
  function roomAtPointer(e) {
    aim(e);
    const hit = ray.intersectObjects(roomsGroup.children.filter((o) => o.userData.roomId), false)[0];
    return hit?.object.userData.roomId || null;
  }
  const liftedPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function floorPoint(e, y = 0) {
    aim(e);
    const p = new THREE.Vector3();
    if (!y) return ray.ray.intersectPlane(floorPlane, p) ? p : null;
    liftedPlane.constant = -y;
    return ray.ray.intersectPlane(liftedPlane, p) ? p : null;
  }
  function ringHit(e) {
    if (!selGroup.visible || !ringGroup.visible) return false;
    aim(e);
    return ray.intersectObjects([knobHit, ringHitMesh], false).length > 0;
  }

  // Doors and windows stick to the nearest wall
  function snapToWall(project, it, x, z) {
    const p = catalog.piece(it), half = p.w / 200;
    let best = null;
    project.rooms.forEach((r) => {
      const cand = [
        { d: Math.abs(z - r.y), x: THREE.MathUtils.clamp(x, r.x + half + 0.05, r.x + r.w - half - 0.05), z: r.y + WALL_T / 2, rot: 0, ok: x > r.x - 0.5 && x < r.x + r.w + 0.5 },
        { d: Math.abs(z - (r.y + r.h)), x: THREE.MathUtils.clamp(x, r.x + half + 0.05, r.x + r.w - half - 0.05), z: r.y + r.h - WALL_T / 2, rot: 180, ok: x > r.x - 0.5 && x < r.x + r.w + 0.5 },
        { d: Math.abs(x - r.x), x: r.x + WALL_T / 2, z: THREE.MathUtils.clamp(z, r.y + half + 0.15, r.y + r.h - half - 0.15), rot: 270, ok: z > r.y - 0.5 && z < r.y + r.h + 0.5 },
        { d: Math.abs(x - (r.x + r.w)), x: r.x + r.w - WALL_T / 2, z: THREE.MathUtils.clamp(z, r.y + half + 0.15, r.y + r.h - half - 0.15), rot: 90, ok: z > r.y - 0.5 && z < r.y + r.h + 0.5 },
      ];
      cand.forEach((c) => { if (c.ok && (!best || c.d < best.d)) best = c; });
    });
    return best;
  }

  const wallSnap = (q) => {
    const w = snapToWall(getProject(), q, q.x, q.y);
    if (w) { q.x = round2(w.x); q.y = round2(w.z); q.rot = w.rot; }
  };
  const angleAt = (e, it, y = 0) => { const p = floorPoint(e, y); return p ? Math.atan2(p.x - it.x, p.z - it.y) : null; };
  let drag = null, down = null;
  const el = renderer.domElement;
  el.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY };
    if (e.button !== 0 || readOnly) return;              // a shared, view-only plan: look around, move nothing
    const project = getProject();
    if (selection?.type === "item" && ringHit(e)) {
      const it = project.items.find((q) => q.id === selection.id);
      const a0 = it && angleAt(e, it, models.get(it.id)?.target.y || 0);
      if (it && a0 !== null) {
        controls.enabled = false;
        el.setPointerCapture(e.pointerId);
        drag = { kind: "rotate", it, a0, startRot: it.rot || 0, moved: false, roomId: roomAt(project.rooms, it.x, it.y)?.id };
        el.style.cursor = "grabbing";
        requestRender();
        return;
      }
    }
    const id = itemAt(e);
    if (!id) return;
    const it = project.items.find((q) => q.id === id);
    const prodHere = it && catalog.piece(it);
    // the pointer follows the piece at its own height: a wall piece (a mirror at 1.5 m) moved faster than the mouse when measured on the floor
    const m0 = models.get(id);
    const lift = !prodHere || !m0 ? 0 : prodHere.wall ? new THREE.Box3().setFromObject(m0.group).getCenter(new THREE.Vector3()).y : m0.target.y || 0;
    const p = floorPoint(e, lift);
    if (!it || !p) return;
    controls.enabled = false;
    el.setPointerCapture(e.pointerId);
    drag = { kind: "move", it, lift, dx: p.x - it.x, dz: p.z - it.y, moved: false, roomId: roomAt(project.rooms, it.x, it.y)?.id || null };
    selection = { type: "item", id };
    onSelect?.(selection);
    el.style.cursor = "grabbing";
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag) {
      if (e.buttons === 0 && !readOnly) el.style.cursor = ringHit(e) ? "ew-resize" : itemAt(e) ? "grab" : "default";
      return;
    }
    const project = getProject();
    const prod = catalog.piece(drag.it);
    const snapOn = getSnap() !== e.altKey;           // Alt flips snapping for this move
    if (drag.kind === "rotate") {
      const a = angleAt(e, drag.it, models.get(drag.it.id)?.target.y || 0);
      if (a === null) return;
      let r = drag.startRot - deg(a - drag.a0);
      r = ((r % 360) + 360) % 360;
      if (snapOn || e.shiftKey) r = Math.round(r / 15) * 15;
      else { const near = Math.round(r / 45) * 45; if (Math.abs(r - near) < 4) r = near; }   // gentle pull to straight angles
      r = Math.round(r) % 360;
      if (r !== (drag.it.rot || 0)) drag.moved = true;
      drag.it.rot = r;
      keepInside(project, catalog, drag.it, drag.roomId);
    } else {
      const p = floorPoint(e, drag.lift);
      if (!p) return;
      const step = snapOn ? 0.05 : 0.01;
      let x = Math.round((p.x - drag.dx) / step) * step, z = Math.round((p.z - drag.dz) / step) * step;
      if (Math.abs(x - drag.it.x) + Math.abs(z - drag.it.y) > 0.001) drag.moved = true;
      if (prod.wall) {
        const before = { x: drag.it.x, y: drag.it.y, rot: drag.it.rot };
        drag.it.x = x; drag.it.y = z;
        if (!fitOpening(project, catalog, drag.it, wallSnap, before)) Object.assign(drag.it, before);
        const wanted = { ...drag.it, x, y: z };
        wallSnap(wanted);
        if (onOpenWall(project, catalog, wanted)) onBlocked?.("open");
        else if (openingClash(project, catalog, wanted)) onBlocked?.();
      } else {
        // Hop into another room only when the pointer is well inside it; walls are never crossed
        const into = roomAt(project.rooms, x, z, WALL_T + 0.05);
        if (into) drag.roomId = into.id;
        drag.it.x = round2(x); drag.it.y = round2(z);
        keepInside(project, catalog, drag.it, drag.roomId);
      }
    }
    if (prod.wall) buildRooms(project);
    project.items.forEach((q) => place(project, q));   // lamps follow the table they stand on
    showSelection();
    onMove?.(drag.it);
    requestRender();
  });
  const up = (e) => {
    if (drag) {
      controls.enabled = true;
      el.style.cursor = "grab";
      if (drag.moved) onCommit?.();
      drag = null;
      updateGuides();
      requestRender();
      return;
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && e.button === 0) {
      const id = itemAt(e);
      if (!id) {
        const roomId = roomAtPointer(e);
        selection = roomId ? { type: "room", id: roomId } : null;
        onSelect?.(selection);
      }
    }
    down = null;
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);

  // Compile shaders the way they are really drawn: into the ambient-occlusion buffer, not the
  // screen (tone mapping and colour space differ, so screen versions would be of no use)
  function compileLike(obj) {
    if (!renderer.compileAsync) { renderer.compile(obj, camera, scene); return Promise.resolve(); }
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    const job = renderer.compileAsync(obj, camera, scene);
    renderer.setRenderTarget(prev);
    return job;
  }
  const warmer = (obj) => {
    if (!renderer.getContext() || renderer.getContext().isContextLost?.()) return Promise.resolve();
    const textures = new Set();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap"].forEach((k) => { if (m?.[k]) textures.add(m[k]); }));
    });
    const queue = [...textures];
    const later = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16));
    return new Promise((done) => {
      const step = (deadline) => {
        do { if (queue.length) renderer.initTexture(queue.pop()); } while (queue.length && deadline.timeRemaining() > 6);
        if (queue.length) { later(step, { timeout: 200 }); return; }
        const holder = new THREE.Group();
        holder.position.set(0, -500, 0);
        const parent = obj.parent;
        holder.add(obj); scene.add(holder);
        const finish = () => { scene.remove(holder); holder.remove(obj); if (parent) parent.add(obj); done(); };
        compileLike(holder).then(finish, finish);
      };
      later(step, { timeout: 200 });
    });
  };
  warmers.add(warmer);

  // ---------- Render loop (only while something moves) ----------
  let frame = 0, last = performance.now();
  // The first time the home is shown, its shaders are compiled in the background first: drawing it
  // straight away would compile them all inside one frame and freeze the page for a moment.
  let shown = !renderer.compileAsync, firstShow = null;
  function showWhenReady() {
    if (firstShow) return;
    const go = () => { shown = true; requestRender(); };
    firstShow = Promise.race([compileLike(scene).catch(() => {}), new Promise((res) => setTimeout(res, 600))]).then(go, go);
  }

  // Sun shadows only need drawing again when something in the home changed, not when the camera
  // just moves around: that halves the work of every frame while looking around.
  let shadowDirty = true;
  function requestRender() { shadowDirty = true; if (!frame) frame = requestAnimationFrame(loop); }
  function requestView() { if (!frame) frame = requestAnimationFrame(loop); }
  // A TV that is on changes its light a little all the time, like a real picture does
  function flickerTvs(now) {
    let any = false;
    models.forEach((m) => {
      const l = m.group.userData.tvLight;
      if (!l || !m.group.userData.tvOn) return;
      any = true;
      const t = now / 1000, k = 0.82 + 0.1 * Math.sin(t * 2.3) + 0.08 * Math.sin(t * 7.1 + 1.3) * Math.sin(t * 0.7);
      l.intensity = l.userData.tv * k;
      l.color.setHSL(0.6 + 0.03 * Math.sin(t * 0.9), 0.55, 0.8);
    });
    return any;
  }
  function loop(now) {
    frame = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    let busy = false, moved = false;               // moved: something that casts a shadow
    if (anim) { anim(now); busy = true; }
    if (lightAnim) { lightAnim(now); moved = true; }
    if (controls.update()) busy = true;
    if (controls.autoRotate) busy = true;
    if (animateItems(dt)) moved = true;
    if (flickerTvs(now)) busy = true;
    if (applyWalls(dt)) moved = true;
    if (drag) moved = true;
    followSelection();
    updateGuides();
    updateMeasureTags();
    if (shown) {
      if (moved || shadowDirty) renderer.shadowMap.needsUpdate = true;
      shadowDirty = false;
      draw();
    }
    onFrame?.();
    if (busy || moved) requestView();
  }

  controls.addEventListener("change", requestView);
  texListeners.add(requestRender);
  controls.addEventListener("start", () => { controls.autoRotate = false; anim = null; });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  applyLight();

  return {
    setMeasurements,
    // How many shelves the piece under this small thing has (1 for a table, 0 on the floor)
    shelvesUnder(itemId) {
      const project = getProject();
      const it = project.items.find((x) => x.id === itemId);
      if (!it || !isSmall(catalog.piece(it))) return 0;
      return supportUnder(project, it)?.heights.length || 0;
    },
    roomLight(room) {                            // a ceiling light's brightness or colour changed
      const c = ceilingLamps.find((x) => x.room.id === room.id);
      if (!c) return;
      c.room = room;
      c.light.color.copy(kelvinColor(room.lampWarmth || 2700));
      c.light.userData.lamp = 9 * lampLumens(room) / 1500;
      applyLampFactor(); requestRender();
    },
    update(sel) {
      const project = getProject();
      selection = sel;
      measure();
      buildRooms(project);
      syncItems(project);
      padLights();
      showSelection();
      if (!shown) showWhenReady();
      requestRender();
    },
    // Get rooms and products ready in quiet moments: scans downloaded, pictures sent to the
    // graphics card and shaders compiled, so showing them later doesn't stall the page.
    // rooms: [{ floor, w, h }]
    preload(products, rooms = []) {
      return preloadProducts(products).then((list) => {
        const holder = new THREE.Group();
        holder.position.set(0, -500, 0);
        list.forEach((a) => { if (a) holder.add(a.scene.clone(true)); });
        products.forEach((p) => { if (p) holder.add(buildModel(p)); });
        rooms.forEach((r) => {
          if (!catalog.FLOORS[r.floor]) return;
          holder.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMaterial(r.floor, r.w, r.h, { tint: r.floorTint, shade: r.floorShade }, { x: r.x, y: r.y })));
        });
        const lamps = [];
        holder.traverse((o) => { if (o.isLight) lamps.push(o); });
        lamps.forEach((l) => l.parent.remove(l));      // same number of lights as the real scene
        const textures = new Set();
        holder.traverse((o) => {
          if (!o.isMesh) return;
          [].concat(o.material).forEach((m) => ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"].forEach((k) => { if (m?.[k]) textures.add(m[k]); }));
        });
        const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 50));
        const queue = [...textures];
        return new Promise((done) => {
          const step = (deadline) => {
            while (queue.length && deadline.timeRemaining() > 4) renderer.initTexture(queue.pop());
            if (queue.length) { idle(step); return; }
            // Shaders last: compiled in the background where the browser supports it
            scene.add(holder);
            const finish = () => { scene.remove(holder); done(); };
            compileLike(holder).then(finish, finish);
          };
          idle(step);
        });
      });
    },
    select(sel) { selection = sel; showSelection(); requestRender(); },
    // Put the camera at an exact spot (plan metres, height in metres), looking at another
    lookFrom([ex, ey, ez], [tx, ty, tz], fov = 50) { flyTo(new THREE.Vector3(ex, ey, ez), new THREE.Vector3(tx, ty, tz), 0, fov); },
    view, zoom,
    setWalls(mode) { wallMode = mode; requestRender(); },
    get walls() { return wallMode; },
    setLight, get light() { return { ...light }; },
    // Where to show a small toolbar for the selected piece (pixels in the container)
    anchor() {
      if (selection?.type !== "item" || drag) return null;
      const m = models.get(selection.id);
      if (!m || !m.group.visible) return null;
      const box = new THREE.Box3().setFromObject(m.group);
      const pos = toScreen((box.min.x + box.max.x) / 2, box.max.y + 0.05, (box.min.z + box.max.z) / 2);
      if (!pos || pos.x < 0 || pos.y < 0 || pos.x > container.clientWidth || pos.y > container.clientHeight) return null;
      return pos;
    },
    // The point on the floor under the pointer, in plan metres
    floorAt(clientX, clientY) { const p = floorPoint({ clientX, clientY }); return p ? { x: round2(p.x), y: round2(p.z) } : null; },
    renderNow() { controls.update(); applyWalls(1); renderer.shadowMap.needsUpdate = true; draw(); },
    screenshot() {
      controls.update(); applyWalls(1);
      const vis = [selGroup.visible, roomOutline.visible, guideLines.visible];
      selGroup.visible = roomOutline.visible = guideLines.visible = false;
      renderer.shadowMap.needsUpdate = true;
      draw();
      const url = renderer.domElement.toDataURL("image/png");
      [selGroup.visible, roomOutline.visible, guideLines.visible] = vis;
      requestRender();
      return url;
    },
    resize,
    setAutoRotate(on) { controls.autoRotate = on; requestRender(); },
    element: renderer.domElement,
  };
}

/* ---------- Small pictures of each product for the catalogue ---------- */
let thumbKit = null;
const thumbs = new Map();
let thumbQueue = Promise.resolve();
function kit() {
  if (thumbKit) return thumbKit;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(240, 180, false);
  renderer.toneMappingExposure = 0.9;            // a touch darker, so white pieces keep their shading
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.8;
  const key = new THREE.DirectionalLight(0xfff3e4, 2.2); key.position.set(3, 5, 4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc2, 0.9), key);
  const camera = new THREE.PerspectiveCamera(28, 240 / 180, 0.01, 100);
  // A soft contact shadow under each piece: grounds it, and gives white pieces an edge on the light card
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(60,45,30,0.7)");
  grad.addColorStop(0.5, "rgba(60,45,30,0.3)");
  grad.addColorStop(1, "rgba(60,45,30,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -1;
  scene.add(shadow);
  return (thumbKit = { renderer, scene, camera, shadow });
}
// Thumbnails are kept in the browser's cache between visits, so each piece is drawn only once.
// The key carries the piece's own description: change a piece and it is drawn again.
const THUMB_CACHE = "atelier-thumbs-1";
const thumbKey = (p) => {
  let h = 0; const t = JSON.stringify(p);
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return `/__thumb/${encodeURIComponent(p.id)}/${(h >>> 0).toString(36)}`;
};
const thumbStore = () => (self.caches ? caches.open(THUMB_CACHE).catch(() => null) : Promise.resolve(null));
// Let the page breathe between two pictures (clicks, scrolling, the 3D view keep running)
const idle = () => new Promise((res) => (self.requestIdleCallback ? requestIdleCallback(() => res(), { timeout: 400 }) : setTimeout(res, 16)));
export function productThumbnail(p) {
  if (thumbs.has(p.id)) return thumbs.get(p.id);
  const job = thumbStore().then(async (store) => {
    const hit = store && await store.match(thumbKey(p)).catch(() => null);
    if (hit) return URL.createObjectURL(await hit.blob());
    return (thumbQueue = thumbQueue.then(() => drawThumb(p, store)));
  }).catch(() => null);
  thumbs.set(p.id, job);
  return job;
}
function drawThumb(p, store) {
  return idle().then(async () => {
    const { renderer, scene, camera, shadow } = kit();
    const g = buildModel(p);
    await upgradeModel(g, p);
    await Promise.all(texJobs);
    g.traverse((o) => { if (o.isPointLight) o.intensity = 0; });
    scene.add(g);
    const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    // Wall pieces (pictures, mirrors) hang in the air: no shadow on the floor for them
    shadow.visible = !p.hang && !p.wall && p.kind !== "rug";
    shadow.position.set(c.x, box.min.y + 0.002, c.z);
    shadow.scale.set(size.x * 1.35 + 0.15, size.z * 1.35 + 0.15, 1);
    const dist = Math.max(size.x, size.y * 1.15, size.z) * 2.6 + 0.2;
    camera.position.set(c.x + dist * 0.55, c.y + dist * 0.42, c.z + dist * 0.75);
    camera.lookAt(c);
    renderer.render(scene, camera);
    scene.remove(g);
    // The picture is packed away from the page's own work, not while everything waits
    const blob = await new Promise((res) => renderer.domElement.toBlob(res, "image/webp", 0.86));
    if (!blob) return null;
    store?.put(thumbKey(p), new Response(blob, { headers: { "Content-Type": blob.type } })).catch(() => {});
    return URL.createObjectURL(blob);
  }).catch(() => null);
}
