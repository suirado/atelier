/* =========================================================
   Atelier — a shared plan, view only
   ---------------------------------------------------------
   The plan comes from the link itself (see js/share.js). Anyone can
   look around in 3D; "Make my own copy" puts it in their projects.
   ========================================================= */

import { createPlanner3D, DEFAULT_LIGHT } from "./planner3d.js?v=83";

const { esc, euro, m2, metres } = App;
const status = document.getElementById("viewer-status");
const card = document.getElementById("viewer-card");

function fail(message) {
  status.innerHTML = `<strong>${esc(message)}</strong><span>Ask for the link again, or plan your own home.</span><a class="btn btn-primary btn-small" href="index.html">Go to Atelier</a>`;
  status.classList.add("is-error");
}

let project;
try {
  project = await Share.fromLocation(Projects.uid);
} catch (err) {
  console.error(err);
}

if (!project) {
  fail(location.hash ? "This link looks cut short." : "There's no plan in this link.");
} else {
  project.rooms.forEach((r) => { r.floor ??= "oak"; r.wall ??= "#f5f1ea"; r.height ??= 2.6; r.lamp ??= true; });
  project.light = { ...DEFAULT_LIGHT, ...(project.light || {}) };
  document.title = `${project.name} — Atelier`;
  document.getElementById("view-name").textContent = project.name;
  document.getElementById("card-name").textContent = project.name;

  // ---- The card: size, rooms, pieces, what it costs ----
  const pieces = project.items.filter((it) => { const p = CATALOG.piece(it); return p && !p.structure; }).length;
  const budget = Projects.budget(project);
  document.getElementById("viewer-stats").innerHTML = [
    [m2(Math.round(Projects.area(project))), "floor area"],
    [project.rooms.length, project.rooms.length === 1 ? "room" : "rooms"],
    [pieces, pieces === 1 ? "piece" : "pieces"],
    budget ? [euro(budget), "shopping list"] : null,
  ].filter(Boolean).map(([value, label]) => `<li><strong>${esc(String(value))}</strong><span>${label}</span></li>`).join("");
  document.getElementById("viewer-rooms").innerHTML = project.rooms.map((r) => `
    <li><span class="chip" style="background:${esc(r.color || "#e7e1d8")}" aria-hidden="true"></span>
      <span class="viewer-room-name">${esc(r.name)}</span><span class="viewer-room-size">${metres(r.w)} × ${metres(r.h)}</span></li>`).join("");
  card.hidden = false;

  // ---- The 3D view ----
  const stage = document.getElementById("view3d");
  try {
    const three = createPlanner3D(stage, { getProject: () => project, catalog: CATALOG, readOnly: true, onSelect: () => {} });
    three.setLight(project.light, 0);
    three.update(null);
    three.view("3d", 0);
    status.hidden = true;
    document.querySelectorAll("[data-cam]").forEach((b) => b.addEventListener("click", () => three.view(b.dataset.cam)));
    const WALL_MODES = { auto: ["up", "Walls: up"], up: ["down", "Walls: down"], down: ["auto", "Walls: cut"] };
    document.getElementById("walls-btn").addEventListener("click", () => {
      const [next, label] = WALL_MODES[three.walls];
      three.setWalls(next);
      document.getElementById("walls-label").textContent = label;
    });
    new ResizeObserver(() => three.resize()).observe(stage);
  } catch (err) {
    console.error(err);
    status.textContent = "3D isn't available in this browser, but you can still make your own copy.";
  }

  // ---- Make my own copy: through log in or sign up if needed ----
  document.getElementById("copy-btn").addEventListener("click", () => {
    const m = location.hash.match(/[#&]p=([\w-]+)/);
    Share.keep(m[1]);
    location.href = "projects.html?import=1";
  });
}
