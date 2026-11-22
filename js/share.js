/* =========================================================
   Atelier — share a plan as a link
   ---------------------------------------------------------
   The whole plan travels inside the link itself (after the #), packed
   with the browser's own deflate, so there is no server to keep it on and
   nothing is uploaded anywhere. Opening the link shows view.html.
   Room ids are swapped for their position in the list; the traced plan
   image is never part of it.
   ========================================================= */

const Share = (() => {
  const VERSION = 1;

  // ---- base64url for bytes ----
  const toB64 = (bytes) => {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const fromB64 = (text) => {
    const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  const canPack = typeof CompressionStream === "function";

  // Only what's needed to draw the home again
  function pack(project) {
    const index = new Map(project.rooms.map((r, i) => [r.id, i]));
    const rooms = project.rooms.map(({ id, ...r }) => r);
    const items = project.items.map(({ id, ...it }) => it);
    const open = (project.openWalls || []).map((key) => {
      const [a, b] = key.slice(0, -1).split("|");
      return index.has(a) && index.has(b) ? [index.get(a), index.get(b), key.slice(-1)] : null;
    }).filter(Boolean);
    return { v: VERSION, name: project.name, rooms, items, light: project.light, open };
  }

  // Back to a project, with fresh ids
  function unpack(data, uid) {
    if (!data || data.v !== VERSION || !Array.isArray(data.rooms) || !Array.isArray(data.items)) throw new Error("This link doesn't hold a plan.");
    const rooms = data.rooms.map((r) => ({ ...r, id: uid() }));
    const items = data.items.filter((it) => it && typeof it.catalogId === "string").map((it) => ({ ...it, id: uid() }));
    const openWalls = (data.open || []).map(([a, b, axis]) => (rooms[a] && rooms[b] ? [rooms[a].id, rooms[b].id].sort().join("|") + axis : null)).filter(Boolean);
    return { name: String(data.name || "Shared home").slice(0, 60), rooms, items, light: data.light, openWalls };
  }

  async function encode(project) {
    const bytes = new TextEncoder().encode(JSON.stringify(pack(project)));
    return canPack ? "z" + toB64(await pipe(bytes, new CompressionStream("deflate-raw"))) : "j" + toB64(bytes);
  }
  async function decode(text) {
    const kind = text.charAt(0), body = fromB64(text.slice(1));
    const bytes = kind === "z" ? await pipe(body, new DecompressionStream("deflate-raw")) : body;
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  // Full link to view.html for this project
  async function link(project) {
    const url = new URL("view.html", location.href);
    url.hash = "p=" + (await encode(project));
    return url.href;
  }
  // The plan in this page's link, or null
  async function fromLocation(uid) {
    const m = location.hash.match(/[#&]p=([\w-]+)/);
    if (!m) return null;
    return unpack(await decode(m[1]), uid);
  }

  // "Make my own copy": the plan waits here while the person logs in or signs up
  const PENDING = "atelier.import";
  const keep = (text) => sessionStorage.setItem(PENDING, text);
  async function takePending(uid) {
    const text = sessionStorage.getItem(PENDING) || localStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING); localStorage.removeItem(PENDING);
    return text ? unpack(await decode(text), uid) : null;
  }

  return { link, fromLocation, keep, takePending, encode };
})();
