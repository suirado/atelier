/* =========================================================
   Atelier — space check
   ---------------------------------------------------------
   Looks at the plan the way an interior designer would and finds the
   spots that will be annoying to live with:
     · a piece standing where a door needs to open or be walked through
     · a gap between two pieces too narrow to walk through
     · a bed you can only get into by squeezing along the wall
   Pure geometry: no drawing here. The editor draws the zones it returns.
   Units are metres, like the rest of the planner.
   ========================================================= */

import { itemHalf, roomAt, WALL_T, isSmall } from "./planner3d.js?v=83";

const DOOR_CLEAR = 0.8;       // free floor in front of a door
const WALK = 0.6;             // narrowest gap a person walks through without turning sideways
const BED_SIDE = 0.5;         // less than this beside a bed and getting in is a squeeze
const MIN_GAP = 0.08;         // closer than this, the pieces simply stand together (a bedside by a bed)

const LOW_KINDS = new Set(["rug", "curtains", "decor", "candles", "art", "wall-deco", "wall-shelf", "basket", "table-lamp"]);
const SEATS = new Set(["chair", "stool", "footstool", "bench"]);
const LOUNGE = new Set(["sofa", "armchair", "wing-chair", "lounger"]);
// Small things people tuck beside furniture on purpose: never a corridor
const TUCKED = new Set(["plant", "planter", "floor-lamp", "side-table", "bedside", "coffee-table"]);
const BATH = new Set(["toilet", "vanity", "bathtub", "shower", "washer", "radiator", "ladder", "tall-cabinet"]);
const KITCHEN = new Set(["kitchen", "kitchen-base", "tall-fridge", "fridge"]);
const isDoor = (p) => p.wall && !p.hang && (/door/.test(p.kind || p.id) || p.sill === 0);

// Something that stands on the floor and gets in the way
const blocks = (p) => !!p && !p.wall && !isSmall(p) && !LOW_KINDS.has(p.kind) && (p.h ?? 60) >= 25;
// Tall and big enough to make a corridor with another piece
const bulky = (p, box) => blocks(p) && !TUCKED.has(p.kind) && (p.h ?? 60) >= 55 && (box.x2 - box.x1) * (box.y2 - box.y1) >= 0.25;

const boxOf = (it, p) => {
  const h = itemHalf(p, it.rot || 0);
  return { x1: it.x - h.hw, x2: it.x + h.hw, y1: it.y - h.hd, y2: it.y + h.hd };
};
const overlap = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
const cm = (m) => `${Math.max(0, Math.round(m * 100))} cm`;
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const an = (s) => `${/^[aeiou]/i.test(s) ? "an" : "a"} ${lower(s)}`;

// Rooms joined by an open wall count as one space
function spaces(project) {
  const parent = new Map(project.rooms.map((r) => [r.id, r.id]));
  const top = (id) => (parent.get(id) === id ? id : top(parent.get(id)));
  (project.openWalls || []).forEach((key) => {
    const [a, b] = key.slice(0, -1).split("|");
    if (parent.has(a) && parent.has(b)) parent.set(top(a), top(b));
  });
  return (room) => (room ? top(room.id) : null);
}

// Both pieces stand against the same wall, the one their gap runs along
const NEAR_WALL = 0.2;
function sameWall(a, b, gapAxis) {
  const ra = a.room, rb = b.room;
  const at = (q, side) => {
    const r = q.room;
    if (side === "top") return q.box.y1 - (r.y + WALL_T / 2) < NEAR_WALL ? r.y : null;
    if (side === "bottom") return r.y + r.h - WALL_T / 2 - q.box.y2 < NEAR_WALL ? r.y + r.h : null;
    if (side === "left") return q.box.x1 - (r.x + WALL_T / 2) < NEAR_WALL ? r.x : null;
    return r.x + r.w - WALL_T / 2 - q.box.x2 < NEAR_WALL ? r.x + r.w : null;
  };
  const sides = gapAxis === "x" ? ["top", "bottom"] : ["left", "right"];
  return sides.some((side) => { const wa = at(a, side), wb = at(b, side); return wa !== null && wb !== null && Math.abs(wa - wb) < 0.05 && ra && rb; });
}

export function checkSpace(project, catalog) {
  const issues = [];
  const spaceOf = spaces(project);
  const pieces = project.items.map((it) => {
    const p = catalog.piece(it);
    if (!p) return null;
    const box = boxOf(it, p);
    const room = roomAt(project.rooms, it.x, it.y);
    return { it, p, box, room, space: spaceOf(room) };
  }).filter(Boolean);
  const standing = pieces.filter((q) => blocks(q.p));

  // ---- Doors: about 80 cm of free floor on each side that has a room ----
  pieces.filter((q) => isDoor(q.p)).forEach((door) => {
    const a = ((door.it.rot || 0) * Math.PI) / 180;
    const nx = Math.round(-Math.sin(a)), ny = Math.round(Math.cos(a));     // pointing into the room
    if (Math.abs(nx) + Math.abs(ny) !== 1) return;                          // a door at an odd angle: skip it
    const half = door.p.w / 200;
    [1, -1].forEach((side) => {
      const sx = nx * side, sy = ny * side;
      const probe = roomAt(project.rooms, door.it.x + sx * (WALL_T / 2 + 0.3), door.it.y + sy * (WALL_T / 2 + 0.3));
      if (!probe) return;                                                   // the outside of the home
      const near = WALL_T / 2, far = WALL_T / 2 + DOOR_CLEAR;
      const zone = sy
        ? { x: door.it.x - half, w: half * 2, y: door.it.y + Math.min(sy * near, sy * far), h: DOOR_CLEAR }
        : { y: door.it.y - half, h: half * 2, x: door.it.x + Math.min(sx * near, sx * far), w: DOOR_CLEAR };
      standing.forEach((q) => {
        const ox = overlap(zone.x, zone.x + zone.w, q.box.x1, q.box.x2);
        const oy = overlap(zone.y, zone.y + zone.h, q.box.y1, q.box.y2);
        if (ox < 0.06 || oy < 0.06) return;
        issues.push({
          kind: "door", items: [q.it.id, door.it.id], focus: q.it.id, zone,
          title: `${q.p.name} is in front of ${an(door.p.name)}`,
          text: "Keep about 80 cm of floor clear so the door opens and you can walk through.",
          label: "Door",
        });
      });
    });
  });

  // ---- Walking between two pieces ----
  const big = standing.filter((q) => bulky(q.p, q.box));
  big.forEach((a, i) => big.slice(i + 1).forEach((b) => {
    if (!a.space || a.space !== b.space) return;
    if (SEATS.has(a.p.kind) || SEATS.has(b.p.kind)) return;                 // chairs get pulled out and pushed in
    if (LOUNGE.has(a.p.kind) && LOUNGE.has(b.p.kind)) return;               // a sofa and armchairs: one seating group
    if (BATH.has(a.p.kind) && BATH.has(b.p.kind)) return;                   // a bathroom is tight by nature
    if (KITCHEN.has(a.p.kind) && KITCHEN.has(b.p.kind)) return;             // one kitchen run
    if (a.p.kind === "bed" || b.p.kind === "bed") return;                   // beds have their own check below
    const ox = overlap(a.box.x1, a.box.x2, b.box.x1, b.box.x2);
    const oy = overlap(a.box.y1, a.box.y2, b.box.y1, b.box.y2);
    let gap, zone;
    if (ox >= 0.25 && oy < 0) {                                             // one above the other on the plan
      gap = -oy;
      const [top, bottom] = a.box.y2 <= b.box.y1 ? [a, b] : [b, a];
      const x1 = Math.max(a.box.x1, b.box.x1);
      zone = { x: x1, w: ox, y: top.box.y2, h: bottom.box.y1 - top.box.y2 };
    } else if (oy >= 0.25 && ox < 0) {                                      // side by side
      gap = -ox;
      const [left, right] = a.box.x2 <= b.box.x1 ? [a, b] : [b, a];
      const y1 = Math.max(a.box.y1, b.box.y1);
      zone = { y: y1, h: oy, x: left.box.x2, w: right.box.x1 - left.box.x2 };
    } else return;
    if (gap < MIN_GAP || gap >= WALK) return;
    // Two pieces along the same wall, with a niche between them: nobody walks into that
    if (a.room && b.room && sameWall(a, b, oy >= 0.25 && ox < 0 ? "x" : "y")) return;
    issues.push({
      kind: "walk", items: [a.it.id, b.it.id], focus: a.it.id, zone, gap,
      title: `Narrow gap: ${lower(a.p.name)} and ${lower(b.p.name)}`,
      text: `${cm(gap)} between them. Aim for 60 cm or more to walk through, or push them together.`,
      label: cm(gap),
    });
  }));

  // ---- Getting into bed ----
  pieces.filter((q) => (q.p.kind === "bed" || q.p.kind === "bunk") && q.room).forEach((bed) => {
    const r = bed.room, b = bed.box;
    // along: the bed's length runs up and down the plan, so its long sides face left and right
    const along = b.y2 - b.y1 >= b.x2 - b.x1;
    const sides = along
      ? [{ dir: "x", from: b.x2, wall: r.x + r.w - WALL_T / 2, sign: 1 }, { dir: "x", from: b.x1, wall: r.x + WALL_T / 2, sign: -1 }]
      : [{ dir: "y", from: b.y2, wall: r.y + r.h - WALL_T / 2, sign: 1 }, { dir: "y", from: b.y1, wall: r.y + WALL_T / 2, sign: -1 }];
    sides.forEach((s) => {
      // the nearest thing beside the bed on this side: the wall, or a tall piece level with the bed
      let edge = s.wall, what = null;
      standing.forEach((q) => {
        if (q === bed || q.p.kind === "bedside" || q.space !== bed.space) return;
        const level = s.dir === "x" ? overlap(b.y1, b.y2, q.box.y1, q.box.y2) : overlap(b.x1, b.x2, q.box.x1, q.box.x2);
        if (level < 0.3) return;
        const near = s.sign > 0 ? (s.dir === "x" ? q.box.x1 : q.box.y1) : (s.dir === "x" ? q.box.x2 : q.box.y2);
        if ((near - s.from) * s.sign < -0.02) return;
        if ((near - edge) * s.sign < 0) { edge = near; what = q; }
      });
      const gap = (edge - s.from) * s.sign;
      if (gap < MIN_GAP || gap >= BED_SIDE) return;
      const zone = s.dir === "x"
        ? { x: Math.min(s.from, edge), w: gap, y: b.y1, h: b.y2 - b.y1 }
        : { y: Math.min(s.from, edge), h: gap, x: b.x1, w: b.x2 - b.x1 };
      issues.push({
        kind: "bed", items: [bed.it.id, ...(what ? [what.it.id] : [])], focus: bed.it.id, zone, gap,
        title: `Squeeze to get into the ${lower(bed.p.name)}`,
        text: `${cm(gap)} ${what ? `to the ${lower(what.p.name)}` : "to the wall"}. Leave 60 cm, or push the bed right against it.`,
        label: cm(gap),
      });
    });
  });

  return issues;
}
