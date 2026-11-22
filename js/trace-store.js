/* =========================================================
   Atelier — the floor plan pictures people trace over
   ---------------------------------------------------------
   Pictures are too big for localStorage, so they live in IndexedDB,
   one per project id. Where it sits and how big it is (in metres) is
   saved with the project as project.trace.
   ========================================================= */

const TraceStore = (() => {
  let db = null;
  const open = () => db || (db = new Promise((resolve, reject) => {
    const req = indexedDB.open("atelier-trace", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("plans");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = async (mode, fn) => {
    const store = (await open()).transaction("plans", mode).objectStore("plans");
    return new Promise((resolve, reject) => {
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  // A big photo or scan, made small enough to keep (longest side 2400 px)
  async function shrink(file) {
    const bitmap = await createImageBitmap(file);
    const k = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);          // transparent PNGs: on white, like paper
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86));
    return { blob, width: w, height: h };
  }

  return {
    shrink,
    get: (id) => run("readonly", (s) => s.get(id)).catch(() => null),
    put: (id, blob) => run("readwrite", (s) => s.put(blob, id)),
    remove: (id) => run("readwrite", (s) => s.delete(id)).catch(() => {}),
  };
})();
