/* =========================================================
   Atelier — landing page behaviour
   ========================================================= */

/* ---------- Example data ---------- */

const REVIEWS = [
  { text: "I furnished our whole new flat in one evening. I had never drawn a floor plan in my life, and it still looked like something an architect made.", name: "Camille Laurent", role: "First flat, Lyon", tone: "clay", stars: 5 },
  { text: "The square metres appear as you draw, so I finally know how big each room really is. The estate agent was off by 4 m².", name: "Mehdi Benali", role: "Flat hunting in Paris", tone: "sage", stars: 5 },
  { text: "My parents used it without calling me once. That says it all.", name: "Ioana Popescu", role: "Student, Bucharest", tone: "sand", stars: 5 },
  { text: "I checked that the KIVIK sofa really fits next to the window before buying it. It did, by 6 cm. Saved me a very awkward return.", name: "Lucas Martin", role: "DIY weekends", tone: "stone", stars: 5 },
  { text: "Sage walls, decided in two minutes. Love the 3D walk-around.", name: "Sofia Rossi", role: "Moving next month", tone: "clay", stars: 5 },
  { text: "Knew the total before I set foot in the store.", name: "Thomas Nguyen", role: "Renovating on a budget", tone: "sage", stars: 4 },
  { text: "I showed the 3D view to our builder instead of waving my hands. He understood the kitchen layout immediately.", name: "Amira Haddad", role: "Homeowner, Marseille", tone: "sand", stars: 5 },
  { text: "Calm, clear, and it never loses my work.", name: "Julien Moreau", role: "Total beginner", tone: "stone", stars: 5 },
  { text: "Feels like a paid app. It isn't.", name: "Elena Dumitru", role: "Interior design student", tone: "clay", stars: 5 },
  { text: "We planned the baby's room together on the sofa, one laptop, zero arguments. Well, almost zero.", name: "Chloé & Antoine Bernard", role: "New parents", tone: "sage", stars: 5 },
];

/* ---------- Helpers ---------- */

const STAR = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';

/* ---------- Reviews marquee ---------- */

function reviewCard(r, hidden) {
  return `
    <figure class="review"${hidden ? ' aria-hidden="true"' : ""}>
      <div class="stars" role="img" aria-label="${r.stars} out of 5 stars">${STAR.repeat(r.stars)}${`<span class="star-off">${STAR}</span>`.repeat(5 - r.stars)}</div>
      <blockquote>“${r.text}”</blockquote>
      <figcaption>
        <span class="avatar tone-${r.tone}" aria-hidden="true">${r.name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("")}</span>
        <div><strong>${r.name}</strong><span>${r.role}</span></div>
      </figcaption>
    </figure>`;
}

// Each row shows half the reviews; the list is repeated once so the loop is seamless.
// The copy is hidden from screen readers so reviews are not read twice.
function fillRow(id, reviews) {
  const original = reviews.map((r) => reviewCard(r, false)).join("");
  const copy = reviews.map((r) => reviewCard(r, true)).join("");
  document.getElementById(id).innerHTML = original + copy;
}
// Each half is listed twice (A B C D A B C D) so the row is wide enough for big screens
const firstHalf = REVIEWS.slice(0, 5);
const secondHalf = REVIEWS.slice(5);
fillRow("marquee-1", [...firstHalf, ...firstHalf]);
fillRow("marquee-2", [...secondHalf, ...secondHalf]);

const marqueeWrap = document.querySelector(".marquee-wrap");
const marqueeToggle = document.getElementById("marquee-toggle");
marqueeToggle.addEventListener("click", () => {
  const paused = marqueeWrap.classList.toggle("paused");
  marqueeToggle.setAttribute("aria-pressed", String(paused));
  marqueeToggle.querySelector("span").textContent = paused ? "Play reviews" : "Pause reviews";
  marqueeToggle.querySelector("svg").innerHTML = paused
    ? '<path d="M7 5l12 7-12 7z"/>'
    : '<path d="M9 5v14 M15 5v14"/>';
});

/* ---------- Hero animations ---------- */

// Number the title words so they appear one after another
document.querySelectorAll(".hero-title .word").forEach((word, i) => {
  word.style.setProperty("--i", i);
});

// Give each wall its real length, so the drawing animation lasts exactly as long as the stroke
document.querySelectorAll(".plan .wall").forEach((wall, i) => {
  wall.style.setProperty("--len", Math.ceil(wall.getTotalLength()));
  wall.style.setProperty("--i", i);
});

/* ---------- Reveal on scroll ---------- */

const revealItems = document.querySelectorAll(".reveal-on-scroll");

// Items in the same grid appear one after another
document.querySelectorAll(".steps, .features, .homes, .faq").forEach((group) => {
  [...group.children].forEach((child, i) => child.style.setProperty("--delay", `${i * 90}ms`));
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealItems.forEach((item) => observer.observe(item));

/* ---------- Navigation ---------- */

const nav = document.getElementById("nav");
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

// Shadow under the bar once the page is scrolled
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 10);
}, { passive: true });

// Mobile menu
function setMenu(open) {
  navLinks.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuToggle.addEventListener("click", () => setMenu(!navLinks.classList.contains("open")));
navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// Highlight the section currently on screen in the nav
const sectionLinks = [...navLinks.querySelectorAll('a[href^="#"]')];
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    sectionLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
    });
  });
}, { rootMargin: "-45% 0px -50% 0px" });
sectionLinks.forEach((link) => {
  const section = document.querySelector(link.getAttribute("href"));
  if (section) sectionObserver.observe(section);
});

/* =========================================================
   Interactive workspace preview (Walls / Furniture / Decor / Measure)
   The picture is a top-down 3D render of an example home.
   Every pin is placed from its real position in metres.
   ========================================================= */

// Every item links to one exact product page. Prices checked on ikea.com/fr and leroymerlin.fr, November 2026.
const IKEA = (path) => ({ store: "IKEA", url: `https://www.ikea.com/fr/fr/p/${path}/` });
const LM = (path) => ({ store: "Leroy Merlin", url: `https://www.leroymerlin.fr/produits/${path}.html` });

const ROOM_TONE = { "Living room": "sand", "Kitchen & dining": "clay", Bedroom: "sage", Bathroom: "stone", Terrace: "sage" };

// The render camera looks straight down from 32 m with a 50 mm lens.
// project() turns a point in metres (x to the east, y to the north, z up) into % of the picture.
const CAMERA = { x: 10.05, y: 5.05, height: 32, lens: 50, sensor: 36, aspect: 2000 / 1375 };
function project([x, y, z = 0]) {
  const halfWidth = ((CAMERA.height - z) * CAMERA.sensor) / (2 * CAMERA.lens);
  const halfHeight = halfWidth / CAMERA.aspect;
  return {
    left: 50 + ((x - CAMERA.x) / halfWidth) * 50,
    top: 50 - ((y - CAMERA.y) / halfHeight) * 50,
  };
}

// qty × price = what the room needs; "product" is the exact model at the store
const FURNITURE = [
  { id: "sofa",          name: "Sofa with chaise",          product: "VIMLE 3-seat sofa with chaise, Gunnared beige",       room: "Living room",      price: 1149,  at: [4.7, 7.9, 0.6],    ...IKEA("vimle-canape-3-places-avec-meridienne-avec-appuie-tete-av-accoudoirs-larges-gunnared-beige-s69401302") },
  { id: "coffee-table",  name: "Coffee table",              product: "STOCKHOLM 2025 coffee table, oak veneer & glass",     room: "Living room",      price: 249,   at: [2.85, 7.9, 0.4],   ...IKEA("stockholm-2025-table-basse-plaque-chene-verre-20586552") },
  { id: "armchair",      name: "Leather armchair",          product: "LANDSKRONA armchair, Grann/Bomstad golden-brown",     room: "Living room",      price: 499,   at: [2.1, 9.2, 0.6],    ...IKEA("landskrona-fauteuil-grann-bomstad-brun-dore-bois-s19269197") },
  { id: "tv-unit",       name: "TV bench",                  product: "STOCKHOLM 2025 TV bench, sliding doors, 179 × 42 cm", room: "Living room",      price: 369,   at: [0.45, 8.0, 0.7],   ...IKEA("stockholm-2025-banc-tv-portes-coulissantes-plaque-chene-40586508") },
  { id: "kitchen",       name: "Kitchen",                   product: "METOD kitchen, 346 × 60 cm, Veddinge white",          room: "Kitchen & dining", price: 1491,  at: [11.8, 9.55, 0.9],  ...IKEA("metod-cuisine-blanc-veddinge-blanc-s99614910") },
  { id: "island",        name: "Kitchen island",            product: "VADHOLMA kitchen island, black & oak, 126 × 79 cm",   room: "Kitchen & dining", price: 599,   at: [11.4, 7.35, 0.93], ...IKEA("vadholma-ilot-pour-cuisine-noir-chene-20359154") },
  { id: "stools",        name: "Bar stools",                product: "NORDVIKEN bar chair, 75 cm, black", qty: 3,           room: "Kitchen & dining", price: 99.95, at: [11.4, 6.32, 0.75], ...IKEA("nordviken-chaise-de-bar-noir-80369112") },
  { id: "dining",        name: "Extendable dining table",   product: "TONSTAD table, oak veneer, 140/196 × 85 cm",          room: "Kitchen & dining", price: 349,   at: [14.1, 7.6, 0.76],  ...IKEA("tonstad-table-extensible-plaque-chene-40593882") },
  { id: "chairs",        name: "Dining chairs",             product: "STOCKHOLM 2025 chair, oak & leather", qty: 6,         room: "Kitchen & dining", price: 199,   at: [14.95, 6.55, 0.9], ...IKEA("stockholm-2025-chaise-chene-cuir-00590140") },
  { id: "bed",           name: "Upholstered bed",           product: "IDANÄS bed frame, 180 × 200 cm, Gunnared grey",       room: "Bedroom",          price: 499,   at: [1.5, 2.5, 0.62],   ...IKEA("idanaes-cadre-de-lit-matelasse-gunnared-gris-fonce-90458947") },
  { id: "nightstand",    name: "Bedside tables",            product: "TONSTAD bedside table, oak veneer, 40 × 40 cm", qty: 2, room: "Bedroom",        price: 129,   at: [0.45, 1.12, 0.55], ...IKEA("tonstad-table-chevet-plaque-chene-80489322") },
  { id: "dresser",       name: "Chest of drawers",          product: "TONSTAD 6-drawer chest, oak veneer, 120 × 47 cm",     room: "Bedroom",          price: 339,   at: [2.0, 4.66, 0.6],   ...IKEA("tonstad-commode-6-tiroirs-plaque-chene-50614624") },
  { id: "desk",          name: "Desk",                      product: "TONSTAD desk, oak veneer, 140 × 75 cm",               room: "Bedroom",          price: 249,   at: [5.9, 0.48, 0.76],  ...IKEA("tonstad-bureau-plaque-chene-30538198") },
  { id: "walk-in",       name: "Walk-in wardrobe",          product: "PAX wardrobe, 175 × 58 × 201 cm, white",              room: "Bedroom",          price: 408,   at: [8.55, 1.45, 0.6],  ...IKEA("pax-armoire-penderie-blanc-s49502632") },
  { id: "bathtub",       name: "Freestanding bathtub",      product: "Spalina Venecia oval bath, 170 × 80 cm",              room: "Bathroom",         price: 959,   at: [13.5, 0.72, 0.58], ...LM("baignoire-ilot-ovale-venecia-170-blanche-170-x80-x57-cm-by-spalina-84799305") },
  { id: "shower",        name: "Walk-in shower screen",     product: "Walk-in glass screen, 120 cm, 6 mm, black frame",     room: "Bathroom",         price: 226,   at: [15.15, 4.1, 0.3],  ...LM("paroi-de-douche-a-italienne-verre-transparent-l-120-cm-ep-6-mm-noir-dark-83542480") },
  { id: "basin",         name: "Double vanity",             product: "ÄNGSJÖN / BACKSJÖN double vanity, 162 cm, oak effect", room: "Bathroom",        price: 781,   at: [11.5, 4.67, 0.88], ...IKEA("aengsjoen-backsjoen-meuble-lavabo-vasques-motif-chene-blanc-marbre-s99629619") },
  { id: "toilet",        name: "Wall-hung toilet",          product: "Duravit ME by Starck + Grohe frame, rimless",         room: "Bathroom",         price: 675.9, at: [10.38, 1.6, 0.42], ...LM("pack-wc-suspendu-sans-bride-compact-duravit-me-by-starck-bati-support-grohe-rapid-sl-projet-abattant-plaque-blanc-91733383") },
  { id: "linen-cabinet", name: "Tall bathroom cabinet",     product: "ÄNGSJÖN high cabinet, 60 × 35 × 195 cm",              room: "Bathroom",         price: 379,   at: [10.3, 2.75, 1.1],  ...IKEA("aengsjoen-colonne-avec-portes-et-tiroirs-brillant-blanc-20553165") },
  { id: "loungers",      name: "Sun loungers",              product: "NÄMMARÖ sun lounger with Frösön cushion", qty: 2,     room: "Terrace",          price: 249,   at: [18.2, 5.6, 0.38],  ...IKEA("naemmaroe-bain-de-soleil-exterieur-teinte-brun-clair-froesoen-duvholmen-beige-s49533898") },
  { id: "terrace-set",   name: "Bistro table + 2 chairs",   product: "TÄRNÖ outdoor table and 2 chairs",                    room: "Terrace",          price: 74.97, at: [19.4, 8.9, 0.7],   ...IKEA("taernoe-table-2-chaises-exterieur-noir-teinte-brun-clair-s69898415") },
];

const DECOR = [
  { id: "rug",            name: "Living room rug",  product: "BRÖNDEN handmade rug, 200 × 300 cm, beige",              room: "Living room",      price: 399,   at: [2.0, 6.8, 0.02],   ...IKEA("broenden-tapis-poils-ras-fait-main-beige-70532972") },
  { id: "cushions",       name: "Cushion covers",   product: "SANELA cushion cover, 50 × 50 cm, dark brown", qty: 4,   room: "Living room",      price: 6.99,  at: [4.72, 8.75, 0.6],  ...IKEA("sanela-housse-de-coussin-brun-fonce-90636025") },
  { id: "throw",          name: "Throw",            product: "VALLKRASSING throw, 150 × 200 cm, off-white",            room: "Living room",      price: 19.99, at: [3.9, 6.45, 0.52],  ...IKEA("vallkrassing-plaid-blanc-casse-20570928") },
  { id: "lamp",           name: "Floor lamp",       product: "STOCKHOLM 2025 floor lamp, textile shade",               room: "Living room",      price: 149,   at: [5.62, 9.55, 1.42], ...IKEA("stockholm-2025-lampadaire-blanc-textile-laitonne-50585914") },
  { id: "curtains",       name: "Curtains",         product: "DYTÅG curtains, pair of 145 × 250 cm, beige", qty: 3,    room: "Whole home",       price: 85,    at: [1.37, 9.78, 0.9],  ...IKEA("dytag-rideaux-2-pieces-beige-avec-oeillets-20607804") },
  { id: "plant-big",      name: "Bird of paradise", product: "STRELITZIA plant, 27 cm pot",                            room: "Living room",      price: 49.99, at: [0.55, 9.45, 1.1],  ...IKEA("strelitzia-plante-naturelle-20466253") },
  { id: "plant-kitchen",  name: "Money tree",       product: "PACHIRA AQUATICA plant, 27 cm pot",                      room: "Kitchen & dining", price: 49.99, at: [8.55, 9.35, 0.9],  ...IKEA("pachira-aquatica-plante-naturelle-pachira-00118523") },
  { id: "vase",           name: "Vase",             product: "PÄRLHÄGG vase, 22 cm, beige",                            room: "Living room",      price: 12.99, at: [2.55, 8.3, 0.55],  ...IKEA("paerlhaegg-vase-beige-80623405") },
  { id: "fruit-bowl",     name: "Fruit bowl",       product: "STOCKHOLM 2025 bowl, 34 cm",                             room: "Kitchen & dining", price: 39.99, at: [11.0, 7.35, 1.0],  ...IKEA("stockholm-2025-coupe-bleu-turquoise-fonce-10590465") },
  { id: "rug-dining",     name: "Jute rug",         product: "LOHALS flatwoven jute rug, 160 × 230 cm",                room: "Kitchen & dining", price: 99.95, at: [13.0, 8.6, 0.02],  ...IKEA("lohals-tapis-tisse-a-plat-naturel-50277393") },
  { id: "rug-bed",        name: "Bedroom rug",      product: "STOENSE low-pile rug, 200 × 300 cm, off-white",          room: "Bedroom",          price: 149,   at: [3.3, 3.9, 0.02],   ...IKEA("stoense-tapis-poils-ras-blanc-casse-20426808") },
  { id: "bedside-lamp",   name: "Bedside lamps",    product: "ÅRSTID table lamp, brass & white", qty: 2,               room: "Bedroom",          price: 19.99, at: [0.42, 3.88, 1.0],  ...IKEA("arstid-lampe-de-table-pied-laiton-blanc-30321373") },
  { id: "bench",          name: "End-of-bed bench", product: "VALTORP bench with storage, 103 cm",                     room: "Bedroom",          price: 149,   at: [2.77, 2.5, 0.46],  ...IKEA("valtorp-banquette-avec-rangement-samsala-vert-jaune-fonce-40570239") },
  { id: "bath-bench",     name: "Bathroom bench",   product: "RÅGRUND bench, bamboo, 78 × 37 cm",                      room: "Bathroom",         price: 44.99, at: [15.6, 2.0, 0.5],   ...IKEA("ragrund-banc-bambou-60549416") },
  { id: "laundry-basket", name: "Laundry basket",   product: "BRANÄS laundry basket, rattan, 80 l",                    room: "Bathroom",         price: 49.99, at: [10.5, 0.5, 0.5],   ...IKEA("branaes-panier-a-linge-interieur-tissu-rotin-20214731") },
  { id: "bath-plant",     name: "Bathroom plants",  product: "MONSTERA plant, 21 cm pot", qty: 3,                      room: "Bathroom",         price: 14.99, at: [15.45, 0.6, 1.0],  ...IKEA("monstera-plante-naturelle-monstera-deliciosa-faux-philo-30349490") },
  { id: "bath-rug",       name: "Round bath rug",   product: "STOENSE round rug, Ø 130 cm, off-white",                 room: "Bathroom",         price: 39.99, at: [12.9, 2.7, 0.02],  ...IKEA("stoense-tapis-poils-ras-blanc-casse-70426801") },
  { id: "terrace-plants", name: "Terrace planters", product: "MÅBÄRSBUSKE outdoor pot, 32 cm", qty: 2,                 room: "Terrace",          price: 29.99, at: [20.2, 4.75, 0.5],  ...IKEA("mabaersbuske-pot-exterieur-beige-fonce-90630429") },
];

// Cheapest first, by what the room needs in total (quantity × price)
const lineTotal = (it) => (it.qty || 1) * it.price;
const byPrice = (a, b) => lineTotal(a) - lineTotal(b);
FURNITURE.sort(byPrice);
DECOR.sort(byPrice);

// Wall lengths; "at" is where the label sits on top of the wall
const WALLS = [
  { id: "w1", name: "North outer wall",                 length: 16.0, at: [8.0, 10.0, 1.23] },
  { id: "w2", name: "East outer wall",                  length: 10.0, at: [16.0, 3.0, 1.23] },
  { id: "w3", name: "South outer wall",                 length: 16.0, at: [9.5, 0.0, 1.23] },
  { id: "w4", name: "West outer wall",                  length: 10.0, at: [0.0, 3.5, 1.23] },
  { id: "w5", name: "Bedrooms ↔ Living & kitchen",      length: 16.0, at: [8.4, 5.0, 1.23] },
  { id: "w6", name: "Bedroom ↔ Bathroom",               length: 5.0,  at: [10.0, 2.2, 1.23] },
  { id: "w7", name: "Walk-in closet glass walls",       length: 4.1,  at: [7.4, 1.6, 1.23] },
];

const ROOMS = [
  { name: "Living room",      w: 8.0, h: 5.0, at: [3.0, 6.0] },
  { name: "Kitchen & dining", w: 8.0, h: 5.0, at: [12.4, 5.75] },
  { name: "Bedroom",          w: 10.0, h: 5.0, at: [5.8, 2.6] },
  { name: "Bathroom",         w: 6.0, h: 5.0, at: [12.4, 1.95] },
];
const TERRACE = { name: "Terrace", w: 4.5, h: 6.0, at: [18.4, 7.3] };
const OUTER = [
  { label: "16.0 m", at: [8.0, -0.6] },
  { label: "10.0 m", at: [-0.6, 5.0] },
];

const ICONS = {
  walls: '<path d="M3 5h18v14H3z M3 12h9 M12 5v14"/>',
  furniture: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3 M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v4H2z"/>',
  decor: '<path d="M12 22V12 M12 12C12 7 8 4 4 4c0 5 3 8 8 8z M12 15c0-4 3-7 8-7 0 4-3 7-8 7z"/>',
  measure: '<path d="M3 8h18v8H3z M7 8v3 M11 8v4 M15 8v3 M19 8v3"/>',
  sort: '<path d="M7 4v16 M3 16l4 4 4-4 M14 6h7 M14 11h5 M14 16h3"/>',
  external: '<path d="M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

const euroFmt = new Intl.NumberFormat(I18N.lang === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR" });
const euroRound = new Intl.NumberFormat(I18N.lang === "fr" ? "fr-FR" : "en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const euro = (n) => (Number.isInteger(Math.round(n * 100) / 100) ? euroRound : euroFmt).format(n);
const metres = (n) => `${n.toFixed(1)} m`;
const place = (at) => { const p = project(at); return `--x:${p.left.toFixed(2)}%;--y:${p.top.toFixed(2)}%`; };

const planCard = document.getElementById("plan-card");
const inspector = document.getElementById("inspector");
const hotspots = document.getElementById("hotspots");
const tabs = [...planCard.querySelectorAll('[role="tab"]')];

// ---------- Points on the picture ----------

const pins = (items) => items.map((it, n) => `
  <button class="pin" type="button" data-item="${it.id}" style="${place(it.at)};--n:${n}"
          aria-label="${it.name}, ${euro(lineTotal(it))}">
    <span class="pin-label" aria-hidden="true">${it.name} · <b>${euro(lineTotal(it))}</b></span>
  </button>`).join("");

hotspots.innerHTML = `
  <div class="hotspot-layer layer-furniture">${pins(FURNITURE)}</div>
  <div class="hotspot-layer layer-decor">${pins(DECOR)}</div>
  <div class="hotspot-layer layer-walls" aria-hidden="true">
    ${WALLS.map((w) => `<span class="tag" data-wall="${w.id}" style="${place(w.at)}">${metres(w.length)}</span>`).join("")}
  </div>
  <div class="hotspot-layer layer-measure" aria-hidden="true">
    ${[...ROOMS, TERRACE].map((r) => `
      <span class="tag room-tag" style="${place(r.at)}">
        <strong>${r.name}</strong><span>${metres(r.w)} × ${metres(r.h)} · ${(r.w * r.h).toFixed(0)} m²</span>
      </span>`).join("")}
    ${OUTER.map((d) => `<span class="tag dim-tag" style="${place(d.at)}">${d.label}</span>`).join("")}
  </div>`;

// ---------- Panel content for each tool ----------

function productRows(items, kind) {
  return items.map((it, n) => `
    <div class="row is-product" data-target="${it.id}" style="--n:${n}">
      <button class="row-toggle" type="button" aria-expanded="false" aria-controls="detail-${it.id}">
        <span class="row-swatch tone-${ROOM_TONE[it.room] || "stone"}">${icon(kind)}</span>
        <span class="row-main">
          <strong>${it.name}</strong>
          <span>${it.room}${it.qty ? ` · ${it.qty} × ${euro(it.price)}` : ""}</span>
        </span>
        <span class="row-value">${euro(lineTotal(it))}</span>
        <svg class="icon row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="row-detail" id="detail-${it.id}" hidden>
        <p><span class="row-store">${it.store}</span>${it.product}</p>
        <a class="row-buy" href="${it.url}" target="_blank" rel="noopener">
          View product ${icon("external")}<span class="sr-only"> (opens ${it.store} in a new tab)</span>
        </a>
      </div>
    </div>`).join("");
}

// ---------- Sorting: every tool can list low → high or high → low ----------
const SORT = { walls: "asc", furniture: "asc", decor: "asc", measure: "asc" };
const SORT_LABEL = { walls: "length", furniture: "price", decor: "price", measure: "size" };
const ordered = (mode, list, key) =>
  [...list].sort((a, b) => (key(a) - key(b)) * (SORT[mode] === "asc" ? 1 : -1));

function sortBar(mode) {
  const option = (dir, arrow, text) => `
    <button class="sort-btn" type="button" data-dir="${dir}" aria-pressed="${SORT[mode] === dir}">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${arrow}"/></svg>${text}
    </button>`;
  return `
    <div class="sort-bar">
      <span class="sort-label">Sort by ${SORT_LABEL[mode]}</span>
      <div class="sort-toggle" role="group" aria-label="Sort by ${SORT_LABEL[mode]}">
        ${option("asc", "M12 19V5 M6 11l6-6 6 6", "Low to high")}
        ${option("desc", "M12 5v14 M6 13l6 6 6-6", "High to low")}
      </div>
    </div>`;
}

function productView(mode, title, all, kind) {
  const items = ordered(mode, all, lineTotal);
  const sum = items.reduce((s, it) => s + lineTotal(it), 0);
  return `
    <div class="inspector-head">
      <h3>${title}</h3>
      <p>${items.length} items · <strong>${euro(Math.round(sum))}</strong></p>
    </div>
    ${sortBar(mode)}
    <div class="inspector-list">${productRows(items, kind)}</div>
    <p class="inspector-note">Tap an item to see the exact product. Prices from IKEA France and Leroy Merlin, checked November 2026.</p>`;
}

const VIEWS = {
  walls() {
    const total = WALLS.reduce((s, w) => s + w.length, 0);
    return `
      <div class="inspector-head">
        <h3>Walls</h3>
        <p>Total length <strong>${metres(total)}</strong> · ceiling 2.7 m</p>
      </div>
      ${sortBar("walls")}
      <div class="inspector-list">
        ${ordered("walls", WALLS, (w) => w.length).map((w, n) => `
          <div class="row" data-target="${w.id}" style="--n:${n}">
            <span class="row-swatch tone-clay">${icon("walls")}</span>
            <div class="row-main"><strong>${w.name}</strong><span>${(w.length * 2.7).toFixed(1)} m² to paint (one side)</span></div>
            <span class="row-value">${metres(w.length)}</span>
          </div>`).join("")}
      </div>`;
  },

  furniture() { return productView("furniture", "Furniture", FURNITURE, "furniture"); },

  decor() { return productView("decor", "Decorations", DECOR, "decor"); },

  measure() {
    const total = ROOMS.reduce((s, r) => s + r.w * r.h, 0);
    return `
      <div class="inspector-head">
        <h3>Measurements</h3>
        <p>Whole home <strong>16.0 × 10.0 m</strong> · <strong>${total.toFixed(0)} m²</strong> + terrace</p>
      </div>
      ${sortBar("measure")}
      <div class="inspector-list">
        ${ordered("measure", [...ROOMS, TERRACE], (r) => r.w * r.h).map((r, n) => `
          <div class="row" style="--n:${n}">
            <span class="row-swatch tone-${ROOM_TONE[r.name]}">${icon("measure")}</span>
            <div class="row-main"><strong>${r.name}</strong><span>${metres(r.w)} × ${metres(r.h)} · perimeter ${metres(2 * (r.w + r.h))}</span></div>
            <span class="row-value">${(r.w * r.h).toFixed(1)} m²</span>
          </div>`).join("")}
      </div>`;
  },
};

// Flip the order: redraw the list, keep the open product open and the focus on the button
inspector.addEventListener("click", (e) => {
  const btn = e.target.closest(".sort-btn");
  if (!btn) return;
  const mode = planCard.dataset.mode;
  if (SORT[mode] === btn.dataset.dir) return;
  SORT[mode] = btn.dataset.dir;
  const openId = inspector.querySelector(".row.is-open")?.dataset.target;
  inspector.innerHTML = VIEWS[mode]();
  clearHighlight();
  hotspots.querySelectorAll(".pin.is-selected").forEach((pin) => pin.classList.remove("is-selected"));
  if (openId) select(openId, true);
  inspector.querySelector(`.sort-btn[data-dir="${btn.dataset.dir}"]`)?.focus();
});

// ---------- Switching tools ----------

function setMode(mode, focus = false) {
  planCard.dataset.mode = mode;
  tabs.forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active) {
      inspector.setAttribute("aria-labelledby", tab.id);
      if (focus) tab.focus();
    }
  });
  inspector.innerHTML = VIEWS[mode]();
  clearHighlight();
}

tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
  // Arrow keys move between tools, like real tabs
  tab.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    setMode(tabs[(i + step + tabs.length) % tabs.length].dataset.mode, true);
  });
});

// ---------- Linking the picture and the list ----------
// Hover = a light preview. Click (a dot or an item) = open that product.

function pictureElement(id) {
  const layer = hotspots.querySelector(`.layer-${planCard.dataset.mode}`);
  return layer?.querySelector(`[data-item="${id}"], [data-wall="${id}"]`);
}

function clearHighlight() {
  planCard.querySelectorAll(".is-highlighted").forEach((el) => el.classList.remove("is-highlighted"));
}

// Keep a dot's label fully inside the picture (dots near the edges would cut it off)
const photoWrap = document.getElementById("plan-photo");
// The badge drawn over the picture ("Total area")
function overlays() {
  return [...document.querySelectorAll(".plan-total")].map((el) => {
    // From the layout box, so the pop-in animation and the hover fade cannot change the answer
    const parent = el.offsetParent.getBoundingClientRect();
    const left = parent.left + el.offsetLeft, top = parent.top + el.offsetTop;
    return { left, right: left + el.offsetWidth, top, bottom: top + el.offsetHeight };
  });
}

function fitLabel(pin) {
  const label = pin?.querySelector(".pin-label");
  if (!label) return;
  label.style.setProperty("--shift", "0px");
  label.classList.remove("is-below");
  const box = photoWrap.getBoundingClientRect();
  const pinBox = pin.getBoundingClientRect();
  const w = label.offsetWidth, h = label.offsetHeight, pad = 8;
  const centre = pinBox.left + pinBox.width / 2;
  const left = centre - w / 2, right = centre + w / 2;
  let shift = 0;
  if (left < box.left + pad) shift = box.left + pad - left;
  else if (right > box.right - pad) shift = box.right - pad - right;
  // Work the label's box out from the dot (not measured, so CSS transitions can't skew it)
  const badges = overlays();
  const spot = (below, sh) => ({
    left: centre - w / 2 + sh, right: centre + w / 2 + sh,
    top: below ? pinBox.bottom + 4 : pinBox.top - 4 - h,
    bottom: below ? pinBox.bottom + 4 + h : pinBox.top - 4,
  });
  const hit = (r) => badges.find((b) => r.right > b.left - 4 && r.left < b.right + 4 && r.bottom > b.top - 4 && r.top < b.bottom + 4);
  let below = pinBox.top - h - 4 < box.top + pad;
  // The "Total area" and "Saved" badges sit on the picture: steer the label around them, never hide them
  const blocker = hit(spot(below, shift));
  if (blocker) {
    if (!hit(spot(!below, shift))) below = !below;                        // other side of the dot
    else if (blocker.left > box.left + box.width / 2)                     // badge on the right: slide left
      shift = Math.max(blocker.left - 6 - (centre + w / 2), box.left + pad - (centre - w / 2));
    else                                                                  // badge on the left: slide right
      shift = Math.min(blocker.right + 6 - (centre - w / 2), box.right - pad - (centre + w / 2));
  }
  label.style.setProperty("--shift", `${Math.round(shift)}px`);
  label.classList.toggle("is-below", below);
}

function highlight(id) {
  clearHighlight();
  if (!id) return;
  const el = pictureElement(id);
  if (el?.classList.contains("pin")) fitLabel(el);
  el?.classList.add("is-highlighted");
  inspector.querySelector(`.row[data-target="${id}"]`)?.classList.add("is-highlighted");
}

function select(id, scrollList = false) {
  inspector.querySelectorAll(".row.is-open").forEach((row) => {
    if (row.dataset.target === id) return;
    row.classList.remove("is-open");
    row.querySelector(".row-toggle")?.setAttribute("aria-expanded", "false");
    row.querySelector(".row-detail")?.setAttribute("hidden", "");
  });
  hotspots.querySelectorAll(".pin.is-selected").forEach((pin) => pin.classList.remove("is-selected"));
  const row = inspector.querySelector(`.row.is-product[data-target="${id}"]`);
  if (!row) return;
  const open = !row.classList.contains("is-open");
  row.classList.toggle("is-open", open);
  row.querySelector(".row-toggle").setAttribute("aria-expanded", String(open));
  row.querySelector(".row-detail").toggleAttribute("hidden", !open);
  if (open) { const pin = pictureElement(id); fitLabel(pin); pin?.classList.add("is-selected"); }
  if (open && scrollList) {
    // Scroll only inside the list, never the whole page
    const list = row.parentElement;
    list.scrollTo({ top: row.offsetTop - list.offsetTop - 8, behavior: "smooth" });
  }
}

// Hovering a row lights up its dot on the picture; clicking it opens the product
inspector.addEventListener("mouseover", (e) => {
  const row = e.target.closest(".row[data-target]");
  if (row) highlight(row.dataset.target);
});
inspector.addEventListener("mouseleave", clearHighlight);
inspector.addEventListener("click", (e) => {
  const toggle = e.target.closest(".row-toggle");
  if (toggle) select(toggle.closest(".row").dataset.target);
});

// Hovering a dot shows its name; clicking it opens that product in the list
hotspots.querySelectorAll(".pin").forEach((pin) => {
  pin.addEventListener("mouseenter", () => { fitLabel(pin); highlight(pin.dataset.item); });
  pin.addEventListener("focus", () => fitLabel(pin));
  pin.addEventListener("mouseleave", clearHighlight);
  pin.addEventListener("click", () => select(pin.dataset.item, true));
});

// First visit starts on Walls, right where the intro animation leaves off
setMode("walls");

// Wall lengths and room sizes near the edge (like the 10.0 m outer size) are nudged back
// inside the picture, and tags that would sit on top of each other are pushed apart.
// Re-done when the window resizes.
function fitTags() {
  const box = photoWrap.getBoundingClientRect();
  if (!box.width) return;
  const pad = 6, gap = 4;
  hotspots.querySelectorAll(".hotspot-layer").forEach((layer) => {
    const placed = overlays();
    layer.querySelectorAll(".tag").forEach((tag) => {
      tag.style.translate = "";
      const r0 = tag.getBoundingClientRect();
      let dx = r0.left < box.left + pad ? box.left + pad - r0.left : r0.right > box.right - pad ? box.right - pad - r0.right : 0;
      let dy = r0.top < box.top + pad ? box.top + pad - r0.top : r0.bottom > box.bottom - pad ? box.bottom - pad - r0.bottom : 0;
      const at = (x, y) => ({ left: r0.left + x, right: r0.right + x, top: r0.top + y, bottom: r0.bottom + y });
      const fits = (r) => r.left >= box.left + pad - 0.5 && r.right <= box.right - pad + 0.5 && r.top >= box.top + pad - 0.5 && r.bottom <= box.bottom - pad + 0.5;
      const free = (r) => !placed.some((o) => r.left < o.right + gap && r.right > o.left - gap && r.top < o.bottom + gap && r.bottom > o.top - gap);
      if (!free(at(dx, dy))) {
        // Try the spots right above, below, left and right of every tag already placed; keep the nearest free one
        const base = at(dx, dy);
        const moves = [];
        placed.forEach((o) => {
          moves.push([0, o.bottom + gap - base.top], [0, o.top - gap - base.bottom], [o.right + gap - base.left, 0], [o.left - gap - base.right, 0]);
        });
        moves.forEach(([mx, my]) => moves.length < 400 && placed.forEach((o) => {
          const r = at(dx + mx, dy + my);
          moves.push([mx, my + o.bottom + gap - r.top], [mx, my + o.top - gap - r.bottom]);
        }));
        const best = moves
          .filter(([mx, my]) => fits(at(dx + mx, dy + my)) && free(at(dx + mx, dy + my)))
          .sort((m, n) => Math.hypot(...m) - Math.hypot(...n))[0];
        if (best) { dx += best[0]; dy += best[1]; }
      }
      const rect = () => at(dx, dy);
      if (dx || dy) tag.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
      placed.push(rect());
    });
  });
}
fitTags();
document.fonts?.ready.then(fitTags);
addEventListener("resize", fitTags);

/* ---------- Intro animation (rendered with Remotion) ---------- */
// Plays once when the card comes into view, then hands over to the interactive picture.
(function playIntro() {
  const wrap = document.getElementById("plan-photo");
  const video = document.getElementById("plan-intro");
  if (!wrap || !video) return;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    video.classList.add("is-done");
    wrap.classList.remove("is-intro");
    setTimeout(() => video.remove(), 600);
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();

  video.addEventListener("ended", finish);
  video.addEventListener("error", finish, true);
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    video.play().catch(finish);              // autoplay blocked → just show the picture
    setTimeout(finish, 9000);                // safety net if the video stalls
  };
  // Start once at least ~40% of the picture is on screen (on load, or when scrolled to)
  const inView = () => {
    const r = wrap.getBoundingClientRect();
    return r.top < innerHeight - r.height * 0.4 && r.bottom > r.height * 0.4;
  };
  const check = () => { if (inView()) { removeEventListener("scroll", check); removeEventListener("resize", check); start(); } };
  addEventListener("scroll", check, { passive: true });
  addEventListener("resize", check);
  check();
})();
