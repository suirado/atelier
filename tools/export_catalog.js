// Writes tools/data/catalog.json from js/catalog.js, so the Python tools can read the catalogue.
// Run it after changing the catalogue:   node tools/export_catalog.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "js", "catalog.js"), "utf8") + ";this.__catalog = CATALOG;", context);
const C = context.__catalog;

const products = C.items.map((p) => ({
  id: p.id, category: p.cat, name: p.name, product: p.product || "",
  kind: p.kind || "", price: p.price ?? 0, w: p.w ?? 0, d: p.d ?? 0, h: p.h ?? 0,
  store: p.store || "", url: p.url || "",
  own: !!p.own, small: !!p.small, wall: !!p.wall, hang: !!p.hang, structure: !!p.structure,
}));
const out = { exported: new Date().toISOString().slice(0, 10), count: products.length, categories: C.categories, products };
fs.writeFileSync(path.join(__dirname, "data", "catalog.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`Saved ${products.length} products to tools/data/catalog.json`);
