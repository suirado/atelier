/* =========================================================
   Atelier — product catalogue and starter templates
   Prices checked on ikea.com/fr, leroymerlin.fr and castorama.fr (November 2026);
   js/regions.js swaps in other countries' prices and shop pages.
   w × d = footprint on the plan in centimetres (approximate, for drawing).
   ========================================================= */

const CATALOG = (() => {
  const IKEA = (path) => ({ store: "IKEA", url: `https://www.ikea.com/fr/fr/p/${path}/` });
  // Decor you'd find anywhere (or already have): shown in 3D, left off the shopping list
  const OWN = { price: 0, own: true, store: "", url: "" };
  const LM = (path) => ({ store: "Leroy Merlin", url: `https://www.leroymerlin.fr/produits/${path}.html` });
  const JYSK = (path) => ({ store: "JYSK", url: `https://jysk.fr/${path}` });
  const DECA = (path) => ({ store: "Decathlon", url: `https://www.decathlon.fr/p/${path}` });
  const CASTO = (path) => ({ store: "Castorama", url: `https://www.castorama.fr/${path}.prd` });

  const items = [
    // Living room
    { id: "vimle-sofa",        cat: "Living room", name: "Sofa with chaise",       product: "VIMLE 3-seat sofa with chaise, Gunnared beige", price: 1149, w: 252, d: 164, ...IKEA("vimle-canape-3-places-avec-meridienne-avec-appuie-tete-av-accoudoirs-larges-gunnared-beige-s69401302") },
    { id: "stockholm-table",   cat: "Living room", name: "Coffee table",           product: "STOCKHOLM 2025 coffee table, oak & glass",     price: 249,  w: 120, d: 70,  ...IKEA("stockholm-2025-table-basse-plaque-chene-verre-20586552") },
    { id: "landskrona",        cat: "Living room", name: "Leather armchair",       product: "LANDSKRONA armchair, golden-brown leather",    price: 499,  w: 89,  d: 89,  ...IKEA("landskrona-fauteuil-grann-bomstad-brun-dore-bois-s19269197") },
    { id: "stockholm-tv",      cat: "Living room", name: "TV bench",               product: "STOCKHOLM 2025 TV bench, 179 × 42 cm",         price: 369,  w: 179, d: 42,  ...IKEA("stockholm-2025-banc-tv-portes-coulissantes-plaque-chene-40586508") },
    { id: "kivik-sofa",        cat: "Living room", name: "3-seat sofa",            product: "KIVIK 3-seat sofa, Tresund light beige",       price: 649,  w: 228, d: 95,  ...IKEA("kivik-canape-3-places-tresund-beige-clair-s89482830") },
    { id: "kivik-leather",     cat: "Living room", name: "Leather sofa",           product: "KIVIK 3-seat sofa, Grann/Bomstad black",       price: 949,  w: 228, d: 95,  ...IKEA("kivik-canape-3-places-grann-bomstad-noir-00519525") },
    { id: "soderhamn-sofa",    cat: "Living room", name: "Low sofa",               product: "SÖDERHAMN 3-seat sofa, Kelinge dark blue",     price: 609,  w: 198, d: 99,  ...IKEA("soederhamn-canape-3-places-kelinge-bleu-fonce-s49621630") },
    { id: "strandmon",         cat: "Living room", name: "Wing chair",             product: "STRANDMON wing chair, Nordvalla dark grey",    price: 299,  w: 82,  d: 96,  ...IKEA("strandmon-fauteuil-a-oreilles-nordvalla-gris-fonce-20343224") },
    { id: "landskrona-stool",  cat: "Living room", name: "Leather footstool",      product: "LANDSKRONA footstool, black leather & wood",   price: 279,  w: 75,  d: 54,  ...IKEA("landskrona-repose-pieds-grann-bomstad-noir-bois-s09031813") },
    { id: "kallax",            cat: "Living room", name: "Cube shelf",             product: "KALLAX shelf, white-stained oak, 77 × 147 cm", price: 69.99, w: 77, d: 39,  ...IKEA("kallax-etagere-effet-chene-blanchi-00324518") },
    { id: "billy-wide",        cat: "Living room", name: "Wide bookcase",          product: "BILLY bookcase combination, white, 120 × 28 × 237 cm", price: 194.97, w: 120, d: 28, ...IKEA("billy-bibliotheque-blanc-s09581513") },
    { id: "hemnes-bookcase",   cat: "Living room", name: "Wood bookcase",          product: "HEMNES bookcase, white stain/light brown, 90 × 37 × 197 cm", price: 209, w: 90, d: 37, ...IKEA("hemnes-bibliotheque-teinte-blanc-brun-clair-60413502") },
    { id: "billy",             cat: "Living room", name: "Bookcase",               product: "BILLY bookcase, white, 80 × 28 × 202 cm",      price: 59.99, w: 80, d: 28,  ...IKEA("billy-bibliotheque-blanc-20522046") },
    { id: "fjallbo",           cat: "Living room", name: "Metal shelf",            product: "FJÄLLBO shelf, black, 100 × 136 cm",           price: 99.99, w: 100, d: 36, ...IKEA("fjaellbo-etagere-noir-70339291") },
    { id: "frotorp",           cat: "Living room", name: "Round marble table",     product: "FRÖTORP coffee table, anthracite & black marble, Ø 88 cm", price: 149, w: 88, d: 88, round: true, ...IKEA("froetorp-table-basse-anthracite-marbre-noir-verre-70497582") },
    { id: "stockholm-sideboard", cat: "Living room", name: "Oak sideboard",        product: "STOCKHOLM 2025 sideboard, oak veneer, 161 × 42 cm", price: 499, w: 161, d: 42, ...IKEA("stockholm-2025-buffet-plaque-chene-10586604") },
    { id: "besta-walnut",      cat: "Living room", name: "Walnut sideboard",       product: "BESTÅ storage with doors, walnut effect, 120 × 42 cm", price: 180, w: 120, d: 42, ...IKEA("besta-combinaison-rangement-portes-brun-noir-lappviken-stubbarp-brun-motif-noyer-s49612348") },
    { id: "gurli",             cat: "Small decor", name: "Throw cushion",          product: "GURLI cushion cover 50 × 50, bright orange", price: 2.99, w: 50, d: 40, small: true,
      styles: [{ key: "plump", name: "Plump", part: "pillow01", w: 50, d: 40, h: 45 }, { key: "soft", name: "Softer", part: "pillow02", w: 48, d: 33, h: 44 }], ...IKEA("gurli-housse-de-coussin-orange-vif-20598767") },
    { id: "stockholm-lamp",    cat: "Living room", name: "Floor lamp",             product: "STOCKHOLM 2025 floor lamp, textile shade",     price: 149,  w: 40,  d: 40,  lumens: 806, bulb: "SOLHETTA LED bulb E27, 806 lm, as IKEA suggests", ...IKEA("stockholm-2025-lampadaire-blanc-textile-laitonne-50585914") },
    { id: "havberg",           cat: "Living room", name: "Swivel lounge chair",    product: "HAVBERG swivel chair, Grann/Bomstad golden-brown leather", price: 449, w: 84, d: 92, ...IKEA("havberg-siege-pivotant-grann-bomstad-brun-dore-70515109") },
    { id: "ugglerum",          cat: "Living room", name: "Round side table",       product: "UGGLERUM side table, brown, Ø 40 cm",           price: 69.99, w: 40, d: 40, round: true, ...IKEA("ugglerum-table-dappoint-brun-00627983") },
    { id: "holmerud",          cat: "Living room", name: "Oak console table",      product: "HOLMERUD side table, oak effect, 80 × 31 cm",   price: 54.99, w: 80, d: 31, ...IKEA("holmerud-table-dappoint-motif-chene-40541421") },
    { id: "own-cabinet",       cat: "Living room", name: "Oak & steel cabinet",    product: "Industrial cabinet, oak drawers on a black steel frame", w: 114, d: 49, ...OWN },
    { id: "own-tv-wall",       cat: "Living room", name: "Wall-mounted TV",        product: "65-inch flat-screen TV on a wall bracket",     w: 145, d: 6, wall: true, hang: true, hangAt: 125, ...OWN },
    { id: "own-tv-easel",      cat: "Living room", name: "TV on an easel",         product: "55-inch art-mode TV on an oak easel stand",    w: 123, d: 59, ...OWN },
    { id: "own-tv-stand",      cat: "Living room", name: "TV on a floor stand",    product: "65-inch flat-screen TV on a black steel stand", w: 145, d: 42, ...OWN },
    { id: "own-sofa-boucle",    cat: "Living room", name: "Bouclé sofa",          product: "GLOSTRUP 2-seat sofa, off-white bouclé, 137 × 76 cm",      w: 137, d: 76, price: 249, ...JYSK("salon/canapes/canape-glostrup-2-places-tissu-bouclette-blanc-casse") },
    { id: "own-sofa-sage",      cat: "Living room", name: "Olive sofa",      product: "BREDAL 2.5-seat sofa, olive green fabric, 169 × 81 cm",       w: 169, d: 81, price: 300, ...JYSK("salon/canapes/canape-bredal-25-places-tissu-vert-olive") },
    { id: "own-sofa-modular",   cat: "Living room", name: "Low modular sofa",     product: "Armless three-seat modular sofa, oat linen",     w: 260, d: 100, ...OWN },
    { id: "own-sofa-tufted",    cat: "Living room", name: "Black leather-look sofa",  product: "FALSLEV 2-seat sofa, black, 150 × 84 cm", w: 150, d: 84, price: 225, ...JYSK("salon/canapes/canape-falslev-2-places-noir") },
    { id: "own-settee",         cat: "Living room", name: "French settee",        product: "Carved-frame settee in pale linen",             w: 157, d: 80, ...OWN },
    { id: "own-armchair-boucle", cat: "Living room", name: "Bouclé armchair",     product: "VILDSUND armchair, off-white teddy fabric",        w: 89, d: 87, price: 200, ...JYSK("salon/fauteuils/fauteuil-vildsund-tissu-teddy-blanc-casse") },
    { id: "own-coffee-travertine", cat: "Living room", name: "Travertine coffee table", product: "NIELSHAVE coffee table, travertine look, Ø 70 cm", w: 70, d: 70, round: true, price: 79.99, ...JYSK("salon/tables-basses-et-bouts-de-canape/table-basse-nielshave-o70-coloris-travertin") },
    { id: "own-coffee-oval",    cat: "Living room", name: "Oak coffee table", product: "HALSKOV coffee table, natural oak look & black, 120 × 70 cm", w: 120, d: 70, price: 149, ...JYSK("salon/tables-basses-et-bouts-de-canape/table-basse-halskov-70x120-coloris-chene-naturel-noir") },
    { id: "own-coffee-carved",  cat: "Living room", name: "Black carved coffee table", product: "Square black coffee table with a carved wood top, 120 cm", w: 120, d: 120, ...OWN },
    { id: "own-side-marble",    cat: "Living room", name: "Marble side table",    product: "Round marble side table on a brass stem, Ø 44 cm", w: 44, d: 44, round: true, ...OWN },
    { id: "tonstad-bookcase",   cat: "Living room", name: "Oak bookcase",         product: "TONSTAD bookcase, oak veneer, 82 × 37 × 201 cm", price: 229, w: 82, d: 37, ...IKEA("tonstad-bibliotheque-plaque-chene-70528461") },
    { id: "own-steel-shelving", cat: "Living room", name: "Oak & steel shelving", product: "Open shelving, oak boards on a black steel frame, 235 cm", w: 235, d: 72, ...OWN },
    { id: "own-white-bookcase", cat: "Living room", name: "White bookcase",       product: "HORSENS bookcase, 5 shelves, white, 70 × 30 × 197 cm",                 w: 70, d: 30, price: 50, ...JYSK("rangement/bibliotheques-et-etageres/bibliotheque-horsens-5-tablettes-blanc") , retired: true },
    // Kitchen & dining
    { id: "metod",             cat: "Kitchen & dining", name: "Kitchen",          product: "METOD kitchen, 346 × 60 cm, Veddinge white",   price: 1491, w: 346, d: 60,  ...IKEA("metod-cuisine-blanc-veddinge-blanc-s99614910") },
    { id: "vadholma",          cat: "Kitchen & dining", name: "Kitchen island",   product: "VADHOLMA island, black & oak, 126 × 79 cm",    price: 599,  w: 126, d: 79,  ...IKEA("vadholma-ilot-pour-cuisine-noir-chene-20359154") },
    { id: "nordviken-stool",   cat: "Kitchen & dining", name: "Bar stool",        product: "NORDVIKEN bar chair, 75 cm, black",            price: 99.95, w: 45, d: 45,  ...IKEA("nordviken-chaise-de-bar-noir-80369112") },
    { id: "tonstad-dining",    cat: "Kitchen & dining", name: "Dining table",     product: "TONSTAD extendable table, 140/196 × 85 cm",    price: 349,  w: 140, d: 85,  ...IKEA("tonstad-table-extensible-plaque-chene-40593882") },
    { id: "stockholm-chair",   cat: "Kitchen & dining", name: "Dining chair",     product: "STOCKHOLM 2025 chair, oak & leather",          price: 199,  w: 46,  d: 52,  ...IKEA("stockholm-2025-chaise-chene-cuir-00590140") },
    { id: "knoxhult",          cat: "Kitchen & dining", name: "Compact kitchen",   product: "KNOXHULT kitchen, white, 120 × 61 × 220 cm",   price: 174,  w: 120, d: 61,  ...IKEA("knoxhult-cuisine-blanc-s49581120") },
    { id: "metod-green",       cat: "Kitchen & dining", name: "Sage drawer unit",  product: "METOD / MAXIMERA base unit, 3 drawers, Axstad grey-green, 60 cm", price: 281, w: 60, d: 60, ...IKEA("metod-maximera-element-bas-3faces-2tir-bs-1moy-1ht-blanc-axstad-gris-vert-s09518456") },
    { id: "metod-black",       cat: "Kitchen & dining", name: "Black drawer unit", product: "METOD / KNIVSHULT base unit, 4 drawers, Nickebo anthracite, 80 cm", price: 448, w: 80, d: 60, ...IKEA("metod-knivshult-element-bas-4faces-2tir-bas-3moy-noir-gris-nickebo-anthracite-mat-s89587554") },
    { id: "metod-oak-sink",    cat: "Kitchen & dining", name: "Oak sink unit",     product: "METOD / MAXIMERA sink unit, Voxtorp oak effect, 80 cm", price: 261, w: 80, d: 60, ...IKEA("metod-maximera-element-bas-evier-2faces-2tiroirs-blanc-voxtorp-motif-chene-s99537907") },
    { id: "metod-fridge",      cat: "Kitchen & dining", name: "Fridge cabinet",    product: "METOD fridge cabinet, Aspudden dark grey-green, 60 × 220 cm", price: 312, w: 60, d: 60, ...IKEA("metod-armoire-refrigerateur-2-portes-blanc-aspudden-gris-vert-fonce-s99605411") },
    { id: "lagan-fridge",      cat: "Kitchen & dining", name: "Fridge-freezer",    product: "LAGAN freestanding fridge-freezer, white, 197/65 l", price: 499, w: 55, d: 63, ...IKEA("lagan-refrigerateur-congelateur-independant-blanc-00571293") },
    { id: "pinntorp",          cat: "Kitchen & dining", name: "White wooden chair", product: "PINNTORP chair, white stain",                price: 39.99, w: 43, d: 54,  ...IKEA("pinntorp-chaise-teinte-blanc-pin-90635177") },
    { id: "stig-bar",          cat: "Kitchen & dining", name: "Metal bar chair",   product: "STIG bar chair, 63 cm, black",                price: 16.99, w: 46, d: 47,  ...IKEA("stig-chaise-de-bar-hauteur-plateau-noir-noir-30498418") },
    { id: "marius",            cat: "Kitchen & dining", name: "Round stool",       product: "MARIUS stool, 45 cm, black",                  price: 5.99, w: 45,  d: 47,  ...IKEA("marius-tabouret-noir-10135659") },
    { id: "stensele",          cat: "Kitchen & dining", name: "Round bar table",  product: "STENSELE bar table, Ø 70 cm, anthracite",      price: 159, w: 70,  d: 70,  round: true, ...IKEA("stensele-table-de-bar-anthracite-anthracite-s09288224") },
    { id: "own-kitchen-sage",   cat: "Kitchen & dining", name: "Sage kitchen",     product: "GoodHome Ash sage base units, 100 + 80 + 60 cm (worktop and handles not included)", w: 241, d: 67, price: 329.5, ...CASTO("meuble-bas-de-cuisine-2-portes-goodhome-ash-vert-sauge-l-100-x-h-72-cm/5063022704092_CAFR") },
    { id: "own-kitchen-black",  cat: "Kitchen & dining", name: "Anthracite kitchen", product: "Kitchen run, anthracite fronts, walnut worktop, 241 cm", w: 241, d: 67, ...OWN },
    { id: "own-tall-oven",      cat: "Kitchen & dining", name: "Oven tower",       product: "Primalight tall oven housing, 2 doors, white, 60 cm (oven not included)", w: 60, d: 66, price: 117.9, ...CASTO("colonne-pour-four-2-primalight-portes-l-60-cm-blanc/3470422404644_CAFR") },
    { id: "klavrestrom-shelf",  cat: "Kitchen & dining", name: "Oak wall shelf",   product: "KLAVRESTRÖM wall shelf, oak, 60 × 20 cm",       price: 29.99, w: 60, d: 22, wall: true, hang: true, hangAt: 150, ...IKEA("klavrestroem-etagere-murale-chene-30601689") },
    { id: "vattentat",         cat: "Small decor", name: "Kettle",            product: "VATTENTÄT kettle, 2 l, stainless steel",       price: 19.99, w: 26, d: 20,  small: true, ...IKEA("vattentat-bouilloire-acier-inoxydable-noir-20239595") },
    { id: "lamplig",           cat: "Small decor", name: "Chopping board",    product: "LÄMPLIG chopping board, 45 × 38 cm",          price: 12.99, w: 45, d: 25,  small: true, ...IKEA("laemplig-planche-a-decouper-00394380") },
    { id: "own-wine",          cat: "Small decor", name: "Wine bottle",       product: "A bottle of wine, in four bottle shapes",     w: 8,   d: 8,   small: true, ...OWN,
      styles: [{ key: "bordeaux", name: "Bordeaux", part: "bordeaux", w: 8, d: 8, h: 30 }, { key: "burgundy", name: "Burgundy", part: "burgundy", w: 8, d: 8, h: 31 },
               { key: "alsace", name: "Alsace", part: "alsace", w: 8, d: 8, h: 33 }, { key: "champagne", name: "Champagne", part: "champagne", w: 9, d: 9, h: 32 }] },
    { id: "own-tea",           cat: "Small decor", name: "Teapot",            product: "Porcelain teapot, cup, sugar bowl or plate",  w: 17,  d: 27,  small: true, ...OWN,
      styles: [{ key: "teapot", name: "Teapot", part: "teapot", w: 17, d: 27, h: 17 }, { key: "cup", name: "Cup", part: "cup_small_01", w: 11, d: 14, h: 7 },
               { key: "sugar", name: "Sugar bowl", part: "sugar", w: 11, d: 15, h: 11 }, { key: "plate", name: "Plate", part: "plate_large_circular_03", w: 19, d: 19, h: 2 },
               { key: "set", name: "Whole set", part: ".", w: 92, d: 49, h: 17 }] },
    // Bedroom
    { id: "idanas-bed",        cat: "Bedroom", name: "Double bed",                product: "IDANÄS bed frame, 180 × 200 cm",               price: 499,  w: 196, d: 216, ...IKEA("idanaes-cadre-de-lit-matelasse-gunnared-gris-fonce-90458947") },
    { id: "malm-90",           cat: "Bedroom", name: "Single bed",                product: "MALM high bed frame, white, 90 × 200 cm",       price: 149,  w: 97,  d: 209, bedStyle: "panel", ...IKEA("malm-cadre-de-lit-haut-blanc-00249487") },
    { id: "slattum-90",        cat: "Bedroom", name: "Upholstered single bed",    product: "SLATTUM upholstered bed frame, Vissle dark grey, 90 × 200 cm", price: 79, w: 96, d: 208, ...IKEA("slattum-cadre-de-lit-matelasse-vissle-gris-fonce-80571251") },
    { id: "slattum-140",       cat: "Bedroom", name: "Small double bed",          product: "SLATTUM upholstered bed frame, Vissle dark grey, 140 × 200 cm", price: 99, w: 146, d: 208, ...IKEA("slattum-cadre-de-lit-matelasse-vissle-gris-fonce-00571245") },
    { id: "malm-160",          cat: "Bedroom", name: "Queen bed",                 product: "MALM high bed frame, white, with LÖNSET slats, 160 × 200 cm", price: 359, w: 177, d: 209, bedStyle: "panel", ...IKEA("malm-cadre-de-lit-haut-blanc-loenset-s19019085") },
    { id: "malm-180",          cat: "Bedroom", name: "King bed",                  product: "MALM high bed frame, black-brown, with LÖNSET slats, 180 × 200 cm", price: 419, w: 196, d: 209, bedStyle: "panel", ...IKEA("malm-cadre-de-lit-haut-brun-noir-loenset-s99019086") },
    { id: "mydal-bunk",        cat: "Bedroom", name: "Wooden bunk bed",           product: "MYDAL bunk bed frame, pine, 90 × 200 cm",       price: 249,  w: 97,  d: 207, ...IKEA("mydal-structure-lits-superposes-pin-00102452") },
    { id: "tuffing-bunk",      cat: "Bedroom", name: "Metal bunk bed",            product: "TUFFING bunk bed frame, dark grey, 90 × 200 cm", price: 149, w: 96,  d: 207, bedStyle: "metal", ...IKEA("tuffing-structure-lits-superposes-gris-fonce-00239233") },
    { id: "tonstad-bedside",   cat: "Bedroom", name: "Bedside table",             product: "TONSTAD bedside table, 40 × 40 cm",            price: 129,  w: 40,  d: 40,  ...IKEA("tonstad-table-chevet-plaque-chene-80489322") },
    { id: "tonstad-chest",     cat: "Bedroom", name: "Chest of drawers",          product: "TONSTAD 6-drawer chest, 120 × 47 cm",          price: 339,  w: 120, d: 47,  ...IKEA("tonstad-commode-6-tiroirs-plaque-chene-50614624") },
    { id: "tonstad-desk",      cat: "Bedroom", name: "Desk",                      product: "TONSTAD desk, 140 × 75 cm",                    price: 249,  w: 140, d: 75,  ...IKEA("tonstad-bureau-plaque-chene-30538198") },
    { id: "tertial",           cat: "Bedroom", name: "Desk lamp",                 product: "TERTIAL work lamp",                            price: 9.99, w: 20,  d: 61,  lumens: 806, bulb: "SOLHETTA LED bulb E27, 806 lm, as IKEA suggests", ...IKEA("tertial-lampe-de-bureau-gris-fonce-50355395") },
    { id: "pax",               cat: "Bedroom", name: "Wardrobe",                  product: "PAX wardrobe, 175 × 58 × 201 cm",              price: 408,  w: 175, d: 58,  ...IKEA("pax-armoire-penderie-blanc-s49502632") },
    { id: "radmanso",          cat: "Bedroom", name: "Walnut chest of drawers",   product: "RÅDMANSÖ 6-drawer chest, walnut effect, 159 × 48 cm", price: 279, w: 159, d: 48, ...IKEA("radmansoe-commode-6-tiroirs-brun-motif-noyer-90593605") },
    // Bathroom
    { id: "venecia-bath",      cat: "Bathroom", name: "Freestanding bathtub",     product: "Spalina Venecia oval bath, 170 × 80 cm",       price: 959,  w: 170, d: 80,  ...LM("baignoire-ilot-ovale-venecia-170-blanche-170-x80-x57-cm-by-spalina-84799305") },
    { id: "shower-screen",     cat: "Bathroom", name: "Walk-in shower screen",    product: "Glass screen, 120 cm, black frame",            price: 226,  w: 120, d: 90,  ...LM("paroi-de-douche-a-italienne-verre-transparent-l-120-cm-ep-6-mm-noir-dark-83542480") },
    { id: "angsjon-vanity",    cat: "Bathroom", name: "Double vanity",            product: "ÄNGSJÖN / BACKSJÖN vanity, 162 × 49 cm",       price: 781,  w: 162, d: 49,  ...IKEA("aengsjoen-backsjoen-meuble-lavabo-vasques-motif-chene-blanc-marbre-s99629619") },
    { id: "duravit-wc",        cat: "Bathroom", name: "Wall-hung toilet",         product: "Duravit ME by Starck + Grohe frame",           price: 675.9, w: 37, d: 57,  ...LM("pack-wc-suspendu-sans-bride-compact-duravit-me-by-starck-bati-support-grohe-rapid-sl-projet-abattant-plaque-blanc-91733383") },
    { id: "angsjon-tall",      cat: "Bathroom", name: "Tall cabinet",             product: "ÄNGSJÖN high cabinet, 60 × 35 cm",             price: 379,  w: 60,  d: 35,  ...IKEA("aengsjoen-colonne-avec-portes-et-tiroirs-brillant-blanc-20553165") },
    // Outdoor
    { id: "nammaro-lounger",   cat: "Outdoor", name: "Sun lounger",               product: "NÄMMARÖ sun lounger with cushion",             price: 249,  w: 72,  d: 205, ...IKEA("naemmaroe-bain-de-soleil-exterieur-teinte-brun-clair-froesoen-duvholmen-beige-s49533898") },
    { id: "tarno-set",         cat: "Outdoor", name: "Bistro table + 2 chairs",   product: "TÄRNÖ outdoor table and 2 chairs",             price: 74.97, w: 150, d: 80, ...IKEA("taernoe-table-2-chaises-exterieur-noir-teinte-brun-clair-s69898415") },
    { id: "mabarsbuske-pot",   cat: "Plants", name: "Outdoor planter",           product: "MÅBÄRSBUSKE outdoor pot, 32 cm",               price: 29.99, w: 32,  d: 32,  ...IKEA("mabaersbuske-pot-exterieur-beige-fonce-90630429") },
    // Decor
    { id: "bronden-rug",       cat: "Rugs", name: "Large rug",                   product: "BRÖNDEN handmade rug, 200 × 300 cm",           price: 399,  w: 300, d: 200, ...IKEA("broenden-tapis-poils-ras-fait-main-beige-70532972") },
    { id: "stoense-rug",       cat: "Rugs", name: "Low-pile rug",                product: "STOENSE rug, 200 × 300 cm, off-white",         price: 149,  w: 300, d: 200, ...IKEA("stoense-tapis-poils-ras-blanc-casse-20426808") },
    { id: "lohals-rug",        cat: "Rugs", name: "Jute rug",                    product: "LOHALS jute rug, 160 × 230 cm",                price: 99.95, w: 230, d: 160, ...IKEA("lohals-tapis-tisse-a-plat-naturel-50277393") },
    { id: "stoense-round",     cat: "Rugs", name: "Round rug",                   product: "STOENSE round rug, Ø 130 cm",                  price: 39.99, w: 130, d: 130, round: true, ...IKEA("stoense-tapis-poils-ras-blanc-casse-70426801") },
    { id: "tversted-rug",      cat: "Rugs", name: "Beige rug",                   product: "TVERSTED rug, 170 × 240 cm, beige",            price: 149,  w: 240, d: 170, ...IKEA("tversted-tapis-poils-ras-beige-20560806") },
    { id: "vandplats-rug",     cat: "Rugs", name: "Striped rug",                 product: "VÄNDPLATS rug, 170 × 240 cm, multicolour stripe", price: 89.99, w: 240, d: 170, pattern: "stripes", colors: ["#e8dcc6", "#b5543a", "#d7b56d", "#3f5566", "#efe7d8", "#8c9a76", "#c97f5b"], ...IKEA("vaendplats-tapis-poils-ras-multicolore-rayure-40600934") },
    { id: "undervisning-rug",  cat: "Rugs", name: "Hand-drawn rug",              product: "UNDERVISNING handmade rug, 170 × 240 cm, off-white/black", price: 249, w: 240, d: 170, pattern: "lines", colors: ["#26221f"], ...IKEA("undervisning-tapis-poils-ras-blanc-casse-noir-fait-main-50560065") },
    { id: "ikea-ps-rug",       cat: "Rugs", name: "Graphic rug",                 product: "IKEA PS 2026 rug, 170 × 240 cm, off-white/red", price: 179, w: 240, d: 170, pattern: "arches", colors: ["#b73a2c", "#d6704a"], ...IKEA("ikea-ps-2026-tapis-poils-ras-blanc-casse-rouge-10619402") },
    { id: "koldby-hide",       cat: "Rugs", name: "Cowhide",                     product: "KOLDBY cowhide, brown (each one is unique)",   price: 229,  w: 190, d: 160, pattern: "hide", colors: ["#3a2618"], ...IKEA("koldby-peau-de-vache-brun-40222933") },
    { id: "jarnvag-rug",       cat: "Rugs", name: "Faded classic rug",          product: "JÄRNVÄG rug, 160 × 230 cm, pink/beige pattern", price: 99.95, w: 230, d: 160, pattern: "medallion", colors: ["#c08a86", "#a9b4b0", "#6b5550"], ...IKEA("jaernvaeg-tapis-poils-ras-motif-decoratif-rose-beige-20595698") },
    { id: "jarnvag-round",     cat: "Rugs", name: "Round classic rug",          product: "JÄRNVÄG round rug, Ø 195 cm, pink/beige",      price: 99.95, w: 195, d: 195, round: true, pattern: "medallion", colors: ["#c08a86", "#a9b4b0", "#6b5550"], ...IKEA("jaernvaeg-tapis-poils-ras-motif-decoratif-rose-beige-30626741") },
    { id: "onsevig-rug",       cat: "Rugs", name: "Blue vintage rug",           product: "ONSEVIG rug, 160 × 235 cm, multicolour",       price: 79.99, w: 235, d: 160, pattern: "medallion", colors: ["#4f6f8a", "#c7a97e", "#2e3640"], ...IKEA("onsevig-tapis-poils-ras-multicolore-60497078") },
    { id: "busenkel-rug",      cat: "Rugs", name: "Diamond rug",                product: "BUSENKEL rug, 130 × 160 cm, diamond pattern",  price: 59.99, w: 160, d: 130, pattern: "diamonds", colors: ["#d9c7a8", "#c2603d", "#e8dfcf", "#6f7f6a"], ...IKEA("busenkel-tapis-motif-losange-multicolore-60520427") },
    { id: "engelsborg-rug",    cat: "Rugs", name: "Soft cream rug",             product: "ENGELSBORG rug, 160 × 230 cm, beige",          price: 159,  w: 230, d: 160, ...IKEA("engelsborg-tapis-poils-ras-beige-20482125") },
    { id: "markblamme-rug",    cat: "Rugs", name: "Bold block rug",             product: "MARKBLÅMME rug, 160 × 230 cm, block pattern",  price: 119,  w: 230, d: 160, pattern: "blocks", colors: ["#1e1a18", "#e9c3b8", "#5a1f14"], ...IKEA("markblamme-tapis-poils-ras-multicolore-motif-carreaux-90625705") },
    { id: "stockholm-rug",     cat: "Rugs", name: "Checked flatweave",          product: "STOCKHOLM 2025 flatweave rug, 170 × 240 cm, handwoven", price: 259, w: 240, d: 170, pattern: "squares", colors: ["#a9441d", "#2a1a14"], ...IKEA("stockholm-2025-tapis-tisse-a-plat-blanc-brun-bleu-clair-tisse-a-la-main-40593815") },
    { id: "raklev-rug",        cat: "Rugs", name: "Jute rug with threads",      product: "RAKLEV flatweave rug, 170 × 240 cm, natural/multicolour", price: 99.95, w: 240, d: 170, pattern: "threads", colors: ["#b5543a", "#3f5566", "#d7b56d", "#6f7f6a"], ...IKEA("raklev-tapis-tisse-a-plat-tisse-a-la-main-naturel-multicolore-80610889") },
    { id: "brevbarare-rug",    cat: "Rugs", name: "Deep shag rug",              product: "BREVBÄRARE high-pile rug, 160 × 230 cm, deep brown", price: 129, w: 230, d: 160, pile: 2.6, ...IKEA("brevbaerare-tapis-poils-hauts-brun-profond-00632121") },
    { id: "blaljus-rug",       cat: "Rugs", name: "Plaid flatweave",            product: "BLÅLJUS flatweave rug, 170 × 240 cm, natural/grey-brown check", price: 179, w: 240, d: 170, pattern: "plaid", colors: ["#8d8a84", "#6b4a33", "#3b3633"], ...IKEA("blaljus-tapis-tisse-a-plat-tisse-a-la-main-naturel-gris-brun-carreaux-30595706") },
    { id: "strelitzia",        cat: "Plants", name: "Bird of paradise",            product: "STRELITZIA plant, 27 cm pot",                  price: 49.99, w: 60,  d: 60,  round: true, ...IKEA("strelitzia-plante-naturelle-20466253") },
    { id: "pachira",           cat: "Plants", name: "Money tree",                  product: "PACHIRA AQUATICA plant, 27 cm pot",            price: 49.99, w: 50,  d: 50,  round: true, ...IKEA("pachira-aquatica-plante-naturelle-pachira-00118523") },
    { id: "monstera",          cat: "Plants", name: "Monstera",                    product: "MONSTERA plant, 21 cm pot",                    price: 14.99, w: 40,  d: 40,  round: true, ...IKEA("monstera-plante-naturelle-monstera-deliciosa-faux-philo-30349490") },
    { id: "calathea",          cat: "Plants", name: "Calathea",                   product: "CALATHEA plant, 19 cm pot",                    price: 14.99, w: 55,  d: 55,  round: true, ...IKEA("calathea-plante-naturelle-calathea-diverses-especes-10258829") },
    { id: "anthurium",         cat: "Plants", name: "Anthurium on a stand",       product: "ANTHURIUM plant, 12 cm pot",                   price: 7.99, w: 70,  d: 55,  round: true, ...IKEA("anthurium-plante-naturelle-20444906") },
    { id: "nephrolepis",       cat: "Plants", name: "Boston fern",                product: "NEPHROLEPIS plant (Boston fern), 9 cm pot",    price: 1.99, w: 90,  d: 85,  round: true, ...IKEA("nephrolepis-plante-naturelle-fougere-de-boston-00630773") },
    // More plants, every size: tall and leafy on the floor, flowering ones in clay, small ones for a table or a shelf
    { id: "own-fig-urn",       cat: "Plants", name: "Fig tree in an urn",        product: "Young fig tree in a terracotta urn, 135 cm",   w: 60,  d: 60,  round: true, ...OWN },
    { id: "own-syngonium",     cat: "Plants", name: "Arrowhead plant",           product: "Syngonium in a wide terracotta pot, 85 cm",    w: 70,  d: 65,  round: true, ...OWN },
    { id: "own-periwinkle",    cat: "Plants", name: "Pink periwinkle",           product: "Flowering periwinkle in a clay pot, 70 cm",     w: 37,  d: 34,  round: true, ...OWN },
    { id: "own-flower-box",    cat: "Plants", name: "Flower box",                product: "Wooden planter with orange gazanias, 92 cm",    w: 92,  d: 42,  ...OWN },
    { id: "own-gazania-pot",   cat: "Plants", name: "Orange gazanias",           product: "Gazanias in a small clay pot, 31 cm",           w: 27,  d: 27,  small: true, round: true, ...OWN },
    { id: "own-succulent-bloom", cat: "Plants", name: "Flowering succulent",     product: "Cheiridopsis in a clay pot, 40 cm",             w: 31,  d: 31,  small: true, round: true, ...OWN },
    { id: "own-haworthia",     cat: "Plants", name: "Little succulent",          product: "Haworthia in a white pot, 27 cm",               w: 17,  d: 19,  small: true, round: true, ...OWN },
    { id: "valtorp-bench",     cat: "Living room", name: "Bench with storage",          product: "VALTORP bench, 103 cm",                        price: 149,  w: 103, d: 45,  ...IKEA("valtorp-banquette-avec-rangement-samsala-vert-jaune-fonce-40570239") },
    { id: "ragrund-bench",     cat: "Bathroom", name: "Bamboo bench",                product: "RÅGRUND bench, bamboo, 78 × 37 cm",            price: 44.99, w: 78,  d: 37,  ...IKEA("ragrund-banc-bambou-60549416") },
    { id: "own-vanity-walnut",  cat: "Bathroom", name: "Walnut washstand",        product: "GoodHome Imandra wall-hung washstand, walnut effect, ceramic Nira basin, 80 cm", w: 81, d: 48, price: 269, ...CASTO("meuble-vasque-suspendu-effet-noyer-l-80-cm-imandra-plan-vasque-blanc-ceramique-nira-goodhome/5059340726076_CAFR") },
    { id: "own-vanity-white",   cat: "Bathroom", name: "Compact washstand",       product: "Opah wall-hung washstand, white, ceramic basin, 60 cm", w: 61, d: 47, price: 79.9, ...CASTO("meuble-vasque-suspendu-blanc-l-60-cm-plan-vasque-en-ceramique-opah/5059340520551_CAFR") },
    { id: "enhet-mirror",       cat: "Bathroom", name: "Mirror cabinet",          product: "ENHET mirror cabinet with 2 doors, 80 × 17 × 75 cm, white", price: 99.95, w: 80, d: 15, wall: true, hang: true, hangAt: 150, ...IKEA("enhet-meuble-a-miroir-avec-portes-blanc-80623047") },
    { id: "own-mirror-led",     cat: "Bathroom", name: "Round LED mirror",        product: "MPGlass Bishop 2 round LED bathroom mirror, Ø 70 cm",               w: 70, d: 3, wall: true, hang: true, hangAt: 150, price: 189.9, ...CASTO("miroir-de-salle-de-bains-lumineux-led-rond-70-cm-mpglass-bishop-2/3700589133423_CAFR") },
    { id: "own-radiator",       cat: "Bathroom", name: "Towel radiator",          product: "Noirot Actibain electric towel radiator, black, 500 W",      w: 53, d: 11, wall: true, hang: true, hangAt: 80, price: 389.9, ...CASTO("seche-serviettes-electrique-500-w-noir-a-inertie-fluide-soufflerie-1000w-noirot-actibain/3465700057704_CAFR") },
    { id: "stegesund-ladder",   cat: "Bathroom", name: "Towel ladder",            product: "STEGESUND towel stand, light bamboo",            price: 19.99, w: 48, d: 25, ...IKEA("stegesund-portant-serviettes-bambou-clair-80632023") },
    { id: "uddarp-washer",      cat: "Bathroom", name: "Washing machine",         product: "UDDARP washing machine, 7 kg, white",            price: 299, w: 60, d: 64, ...IKEA("uddarp-lave-linge-ikea-300-60523765") },
    { id: "branas-basket",     cat: "Lamps & textiles", name: "Laundry basket",              product: "BRANÄS laundry basket, rattan",                price: 49.99, w: 44,  d: 44,  round: true, ...IKEA("branaes-panier-a-linge-interieur-tissu-rotin-20214731") },
    { id: "arstid-lamp",       cat: "Lamps & textiles", name: "Table lamp",                  product: "ÅRSTID table lamp, brass & white",             price: 19.99, w: 22,  d: 22,  round: true, lumens: 806, bulb: "SOLHETTA LED bulb E27, 806 lm, as IKEA suggests", ...IKEA("arstid-lampe-de-table-pied-laiton-blanc-30321373") },
    { id: "pongori-ttt130",     cat: "Living room", name: "Ping-pong table",      product: "PONGORI TTT 130.2 indoor table tennis table, folding, 274 × 152.5 cm", price: 339.99, w: 274, d: 153, ...DECA("table-de-tennis-de-table-interieure-compacte-avec-filet-innovant-ttt-130-2-noir/342265/m8883577") },
    { id: "pongori-bt600",      cat: "Living room", name: "Pool table",           product: "PONGORI BT 600 convertible pool table, with dining top", price: 549.99, w: 206, d: 117, ...DECA("table-de-billard-convertible-bt-600/349125/m8820447") },
    { id: "own-lamp-arc",       cat: "Lamps & textiles", name: "Arc floor lamp",  product: "Brilliant Manor arc floor lamp, gold brass, 195 cm", w: 124, d: 42, price: 139.9, lumens: 806, bulb: "A usual E27 LED bulb, 806 lm (the shop doesn't say)", ...CASTO("lampadaire-arc-manor-laiton-dore-h-195cm-ip20-e27-20w-brilliant/4004353456053_CAFR") },
    { id: "uppvind-lamp",       cat: "Lamps & textiles", name: "Globe floor lamp", product: "UPPVIND floor lamp, brass/white, 150 cm",      price: 99.99, w: 34, d: 34, round: true, lumens: 806, bulb: "SOLHETTA LED bulb E27, 806 lm, as IKEA suggests", ...IKEA("uppvind-lampadaire-laitonne-blanc-50483152") },
    { id: "lauters-lamp",       cat: "Lamps & textiles", name: "Tripod floor lamp", product: "LAUTERS floor lamp, ash/white",              price: 49.99, w: 55, d: 56, round: true, lumens: 806, bulb: "SOLHETTA LED bulb E27, 806 lm, as IKEA suggests", ...IKEA("lauters-lampadaire-frene-blanc-30405042") },
    { id: "blidvader-lamp",     cat: "Lamps & textiles", name: "Ceramic table lamp", product: "BLIDVÄDER table lamp, off-white ceramic/beige, 50 cm", price: 39.99, w: 38, d: 38, round: true, small: true, lumens: 806, bulb: "SOLHETTA LED bulb E27, 806 lm, as IKEA suggests", ...IKEA("blidvaeder-lampe-de-table-blanc-casse-ceramique-beige-80501258") },
    { id: "dytag-curtains",    cat: "Lamps & textiles", name: "Curtains (pair)",             product: "DYTÅG curtains, 145 × 250 cm, beige",          price: 85,   w: 145, d: 12,  ...IKEA("dytag-rideaux-2-pieces-beige-avec-oeillets-20607804") },
    // Small decor: stands on whatever table, chest or shelf it's put on
    { id: "fenomen-candles",   cat: "Small decor", name: "Block candle",          product: "FENOMEN unscented block candle, natural", price: 2.99, w: 8, d: 8, round: true, small: true, ...IKEA("fenomen-bougie-bloc-non-parfumee-naturel-80528413") },
    { id: "frovaxt-vase",      cat: "Small decor", name: "Round white vase",      product: "FRÖVÄXT vase, 20 cm, white",                   price: 9.99, w: 14,  d: 14,  small: true, round: true, ...IKEA("froevaext-vase-blanc-60591919") },
    { id: "sockerart-vase",    cat: "Small decor", name: "Jug vase",              product: "SOCKERÄRT vase/jug, 22 cm, white",             price: 14.99, w: 12, d: 12,  small: true, round: true, ...IKEA("sockeraert-vase-pichet-blanc-80148465") },
    { id: "hultet-dish",       cat: "Small decor", name: "Wooden bowl",           product: "HULTET decorative dish, bamboo, 30 cm",        price: 4.99, w: 30,  d: 30,  small: true, round: true, ...IKEA("hultet-plat-decoratif-bambou-40065160") },
    { id: "rodalm-small",      cat: "Small decor", name: "Black photo frame",     product: "RÖDALM frame, 13 × 18 cm, black",              price: 4.99, w: 16,  d: 8,   small: true, ...IKEA("roedalm-cadre-noir-10548867") },
    { id: "fikontrad-frame",   cat: "Small decor", name: "White photo frame",     product: "FIKONTRÄD frame, 10 × 15 cm, white",           price: 1.99, w: 13,  d: 6,   small: true, ...IKEA("fikontraed-cadre-blanc-60518716") },
    { id: "branas-lid",        cat: "Small decor", name: "Rattan basket",         product: "BRANÄS basket, rattan, 32 × 34 × 32 cm",       price: 14.99, w: 34, d: 32,  ...IKEA("branaes-panier-rotin-00138432") },
    { id: "own-books",         cat: "Small decor", name: "Books",                 product: "Real books: a few standing, a small stack or one", w: 12, d: 16, small: true, ...OWN,
      styles: [{ key: "row3", name: "3 standing", w: 12, d: 16, h: 23 }, { key: "row2", name: "2 standing", w: 8, d: 16, h: 23 },
               { key: "stack3", name: "Stack of 3", w: 23, d: 16, h: 10 }, { key: "stack2", name: "Stack of 2", w: 23, d: 16, h: 7 }, { key: "one", name: "1 book", w: 4, d: 16, h: 23 }] },
    { id: "own-magazines",     cat: "Small decor", name: "Magazines",             product: "Magazines lying on a table or shelf",           w: 27, d: 21, small: true, ...OWN,
      styles: [{ key: "three", name: "3 magazines", w: 30, d: 24, h: 3 }, { key: "two", name: "2 magazines", w: 30, d: 24, h: 2 }, { key: "one", name: "1 magazine", w: 27, d: 21, h: 1 }] },
    { id: "own-candlestick",   cat: "Small decor", name: "Candlestick",           product: "Turned wooden candlestick with candle",        w: 10,  d: 10,  small: true, round: true, ...OWN },
    { id: "own-lantern",       cat: "Small decor", name: "Storm lantern",         product: "Metal storm lantern",                          w: 12,  d: 10,  small: true, ...OWN },
    { id: "own-vase-tall",     cat: "Small decor", name: "Tall white vase",       product: "Tall square ceramic vase, 41 cm",              w: 11,  d: 11,  small: true, ...OWN },
    { id: "own-vase-blue",     cat: "Small decor", name: "Blue & white vase",     product: "Hand-painted porcelain vase",                  w: 25,  d: 25,  small: true, round: true, ...OWN },
    { id: "own-bust",          cat: "Small decor", name: "Marble bust",           product: "Classical marble bust",                        w: 27,  d: 30,  small: true, ...OWN },
    { id: "own-cat",           cat: "Small decor", name: "Cat statue",            product: "Concrete cat statue",                          w: 15,  d: 25,  small: true, ...OWN },
    { id: "own-elephant",      cat: "Small decor", name: "Wooden elephant",       product: "Carved wooden elephant",                       w: 11,  d: 6,   small: true, ...OWN },
    { id: "own-shell",         cat: "Small decor", name: "Sea shell",             product: "Conch shell",                                  w: 14,  d: 8,   small: true, ...OWN },
    { id: "own-chess",         cat: "Small decor", name: "Chess set",             product: "Wooden chess set",                             w: 40,  d: 40,  small: true, ...OWN },
    { id: "own-alarm",         cat: "Small decor", name: "Alarm clock",           product: "Twin-bell alarm clock",                        w: 13,  d: 7,   small: true, ...OWN },
    { id: "own-mantel-clock",  cat: "Small decor", name: "Mantel clock",          product: "Wooden mantel clock",                          w: 34,  d: 13,  small: true, ...OWN },
    { id: "own-clay-pot",      cat: "Plants", name: "Terracotta pot",        product: "Terracotta flower pot, 27 cm",                 w: 27,  d: 27,  round: true, ...OWN },
    { id: "own-horse",         cat: "Small decor", name: "Porcelain horse",       product: "White porcelain horse figurine",               w: 16,  d: 11,  small: true, ...OWN },
    { id: "own-whale",         cat: "Small decor", name: "Bronze whale",          product: "Bronze whale sculpture on a stand",            w: 26,  d: 38,  small: true, ...OWN },
    { id: "own-candelabra",    cat: "Small decor", name: "Brass candelabra",      product: "Three-arm brass candelabra",                   w: 20,  d: 17,  small: true, ...OWN },
    { id: "own-plate",         cat: "Small decor", name: "Carved wooden plate",   product: "Hand-carved wooden plate",                     w: 27,  d: 27,  small: true, round: true, ...OWN },
    { id: "own-tray-basket",   cat: "Small decor", name: "Wicker tray",           product: "Low wicker basket",                            w: 38,  d: 30,  small: true, ...OWN },
    { id: "own-stoneware",     cat: "Small decor", name: "Stoneware pot",         product: "Glazed stoneware pot with lid",                w: 34,  d: 26,  small: true, ...OWN },
    { id: "own-wood-bowl",     cat: "Small decor", name: "Olive wood bowl",       product: "Small olive wood bowl",                        w: 13,  d: 12,  small: true, ...OWN },
    { id: "own-brass-vase",    cat: "Small decor", name: "Brass vase",            product: "Small engraved brass vase",                    w: 8,   d: 8,   small: true, round: true, ...OWN },
    // Wall art: hangs on the nearest wall, at eye height
    { id: "rodalm-oak",        cat: "Wall art", name: "Landscape print",          product: "RÖDALM frame 50 × 70 cm, oak effect, with print", price: 19.99, w: 70, d: 3, wall: true, hang: true, hangAt: 150, ...IKEA("roedalm-cadre-motif-chene-60566401") },
    { id: "rodalm-white",      cat: "Wall art", name: "Poster frame",             product: "RÖDALM frame 30 × 40 cm, white, with poster",  price: 8.99, w: 30,  d: 2, wall: true, hang: true, hangAt: 150, ...IKEA("roedalm-cadre-blanc-40548922") },
    { id: "tromma",            cat: "Wall art", name: "Wall clock",               product: "TROMMA wall clock, 25 cm, white",              price: 1.99, w: 25,  d: 4, wall: true, hang: true, hangAt: 185, ...IKEA("tromma-horloge-murale-blanc-30557078") },
    { id: "own-painting",      cat: "Wall art", name: "Oil painting",             product: "Landscape oil painting, gilt frame",           w: 60,  d: 2, wall: true, hang: true, hangAt: 150, ...OWN },
    { id: "own-oval",          cat: "Wall art", name: "Oval portrait",            product: "Old photo in an oval wooden frame",            w: 38,  d: 3, wall: true, hang: true, hangAt: 155, ...OWN },
    { id: "own-mirror",        cat: "Wall art", name: "Arched mirror",            product: "Arched mirror, carved frame",                  w: 49,  d: 3, wall: true, hang: true, hangAt: 150, ...OWN },
    { id: "own-poster", cat: "Wall art", name: "Poster", product: "Art print in a thin black frame, 50 × 70 cm", w: 50, d: 2, wall: true, hang: true, hangAt: 150, deco: "poster", ...OWN, styles: [{ key: "arches", name: "Arches" }, { key: "sun", name: "Sunset" }, { key: "lines", name: "Lines" }, { key: "botanical", name: "Botanical" }, { key: "map", name: "Contour map" }] },
    { id: "own-canvas", cat: "Wall art", name: "Woven canvas", product: "Large striped canvas, no frame, 80 × 100 cm", w: 80, d: 3, wall: true, hang: true, hangAt: 150, deco: "canvas", ...OWN, styles: [{ key: "tapestry", name: "Kilim" }, { key: "stripes", name: "Stripes" }] },
    { id: "own-wall-plate", cat: "Wall art", name: "Wall plate", product: "Blue-and-white porcelain plate on a wall hanger, Ø 26 cm", w: 26, d: 3, wall: true, hang: true, hangAt: 160, deco: "plate", ...OWN },
    { id: "own-hanging-plant", cat: "Wall art", name: "Hanging plant", product: "Trailing plant in a macramé hanger", w: 40, d: 30, wall: true, hang: true, hangAt: 175, deco: "hanging-plant", ...OWN },
    { id: "own-macrame", cat: "Wall art", name: "Macramé hanging", product: "Cotton macramé on a wooden dowel, 60 cm", w: 60, d: 3, wall: true, hang: true, hangAt: 160, deco: "macrame", ...OWN },
    { id: "own-string-lights", cat: "Wall art", name: "Photo string lights", product: "Fairy lights with pegged photos, 150 cm", w: 150, d: 3, wall: true, hang: true, hangAt: 170, deco: "string-lights", ...OWN },
    { id: "own-neon", cat: "Wall art", name: "Neon sign", product: "LED neon squiggle on clear acrylic", w: 70, d: 3, wall: true, hang: true, hangAt: 170, deco: "neon", ...OWN },
    { id: "own-guitar", cat: "Wall art", name: "Guitar on the wall", product: "Acoustic guitar on a wall hook", w: 38, d: 10, wall: true, hang: true, hangAt: 140, deco: "guitar", ...OWN },
    { id: "own-pegboard", cat: "Wall art", name: "Pegboard", product: "Painted pegboard with a shelf and hooks, 56 × 56 cm", w: 56, d: 12, wall: true, hang: true, hangAt: 140, deco: "pegboard", ...OWN },
    { id: "own-sunburst", cat: "Wall art", name: "Sunburst mirror", product: "Rattan sunburst mirror, Ø 60 cm", w: 60, d: 3, wall: true, hang: true, hangAt: 155, deco: "sunburst", ...OWN },
    { id: "own-record", cat: "Wall art", name: "Record on a ledge", product: "Vinyl record and sleeve on a picture ledge", w: 32, d: 8, wall: true, hang: true, hangAt: 150, deco: "record", ...OWN, styles: [{ key: "sun", name: "Sunset sleeve" }, { key: "arches", name: "Arches sleeve" }, { key: "lines", name: "Lines sleeve" }] },
    { id: "own-coat-hooks", cat: "Wall art", name: "Peg rail", product: "Oak peg rail with a tote bag and a straw hat, 90 cm", w: 90, d: 14, wall: true, hang: true, hangAt: 150, deco: "hooks", ...OWN },
    { id: "own-corkboard", cat: "Wall art", name: "Cork board", product: "Cork pin board with notes and photos, 60 × 45 cm", w: 60, d: 2, wall: true, hang: true, hangAt: 140, deco: "cork", ...OWN },
    { id: "own-floating-shelf", cat: "Wall art", name: "Floating shelf", product: "Slim oak floating shelf, styled with a plant and books, 80 cm", w: 80, d: 18, wall: true, hang: true, hangAt: 150, deco: "floating-shelf", ...OWN },
    { id: "own-sconce", cat: "Lamps & textiles", name: "Wall lamp", product: "Plug-in wall lamp, brass arm and linen shade", w: 22, d: 25, wall: true, hang: true, hangAt: 160, lumens: 470, bulb: "A usual E14 LED bulb, 470 lm", ...OWN },
    // Doors & windows: part of the room, not on the shopping list
    { id: "door",              cat: "Doors & windows", name: "Door",          product: "Interior door, 90 × 210 cm",   price: 0, w: 90,  d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "window",            cat: "Doors & windows", name: "Window",        product: "Window, 120 × 130 cm",         price: 0, w: 120, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "window-wide",       cat: "Doors & windows", name: "Wide window",   product: "Window, 200 × 150 cm",         price: 0, w: 200, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "glass-door",        cat: "Doors & windows", name: "Glass door",    product: "Glazed garden door, 140 × 220 cm", price: 0, w: 140, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "panel-door",        cat: "Doors & windows", name: "Panelled door", product: "Four-panel door, 83 × 204 cm",  price: 0, w: 83,  d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "oak-door",          cat: "Doors & windows", name: "Oak door",      product: "Solid oak door, 90 × 210 cm",   price: 0, w: 90,  d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "double-door",       cat: "Doors & windows", name: "Double doors",  product: "Glazed double doors, 140 × 210 cm", price: 0, w: 140, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "steel-door",        cat: "Doors & windows", name: "Steel glass door", product: "Black steel glass door, 90 × 210 cm", price: 0, w: 90, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "sliding-door",      cat: "Doors & windows", name: "Sliding patio door", product: "Sliding glass door, 240 × 215 cm", price: 0, w: 240, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "french-window",     cat: "Doors & windows", name: "Floor-length window", product: "French window, 110 × 220 cm", price: 0, w: 110, d: 12, sill: 0, structure: true, wall: true, store: "", url: "" },
    { id: "triple-window",     cat: "Doors & windows", name: "Three-pane window", product: "Three-pane window, 180 × 130 cm", price: 0, w: 180, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "steel-window",      cat: "Doors & windows", name: "Steel window",  product: "Black steel window, 120 × 140 cm", price: 0, w: 120, d: 12, structure: true, wall: true, store: "", url: "" },
    { id: "small-window",      cat: "Doors & windows", name: "Small frosted window", product: "Frosted window, 60 × 60 cm", price: 0, w: 60, d: 12, sill: 150, structure: true, wall: true, store: "", url: "" },
  ];

  /* How each piece looks in 3D: model type, height (cm) and main colour.
     The 3D models are drawn by js/planner3d.js from simple shapes. */
  const LOOK = {
    "billy-wide": ["bookcase", 237, "#f4f2ee"], "hemnes-bookcase": ["bookcase", 197, "#d9c3a0"], "own-magazines": ["decor", 3, "#d8d2c4"],
    "own-poster": ["wall-deco", 70, "#1d1d1d"], "own-canvas": ["wall-deco", 100, "#e8dcc6"], "own-wall-plate": ["wall-deco", 26, "#f6f4ef"],
    "own-hanging-plant": ["wall-deco", 90, "#c9a27a"], "own-macrame": ["wall-deco", 80, "#efe6d6"], "own-string-lights": ["wall-deco", 50, "#fff3d6"],
    "own-neon": ["wall-deco", 35, "#ff5a8a"], "own-guitar": ["wall-deco", 100, "#c98b4f"], "own-pegboard": ["wall-deco", 56, "#9fb3a3"],
    "own-sunburst": ["wall-deco", 60, "#c9a274"], "own-record": ["wall-deco", 32, "#c2410c"], "own-coat-hooks": ["wall-deco", 70, "#c9a274"],
    "own-corkboard": ["wall-deco", 45, "#c9a274"], "own-floating-shelf": ["wall-deco", 25, "#c49a6c"], "own-sconce": ["wall-lamp", 30, "#efe6d6"],
    "pongori-ttt130": ["ping-pong", 76, "#1f3a5f"], "pongori-bt600": ["billiard", 80, "#2f6b4f"],
    "own-fig-urn": ["plant", 135, "#55784a"], "own-syngonium": ["plant", 84, "#4f7d4a"], "own-periwinkle": ["plant", 70, "#c9729a"],
    "own-flower-box": ["planter", 54, "#8a6a4a"], "own-gazania-pot": ["plant", 31, "#e08a3a"], "own-succulent-bloom": ["plant", 40, "#9fb08f"],
    "own-haworthia": ["plant", 27, "#6f8f5f"],
    "vimle-sofa": ["sofa", 83, "#d6cab4"],        "stockholm-table": ["coffee-table", 45, "#c49a6c"],
    "landskrona": ["armchair", 89, "#a4643a"],     "stockholm-tv": ["tv-bench", 50, "#c49a6c"],
    "stockholm-lamp": ["floor-lamp", 150, "#f3ece0"], "metod": ["kitchen", 220, "#f4f2ee"],
    "vadholma": ["island", 90, "#2f2b28"],         "nordviken-stool": ["stool", 100, "#2a2724"],
    "tonstad-dining": ["table", 75, "#c49a6c"],    "stockholm-chair": ["chair", 80, "#c49a6c"],
    "malm-90": ["bed", 100, "#f2f0eb"], "slattum-90": ["bed", 88, "#4d4f52"], "slattum-140": ["bed", 88, "#4d4f52"],
    "malm-160": ["bed", 100, "#f2f0eb"], "malm-180": ["bed", 100, "#3b302b"], "mydal-bunk": ["bunk", 157, "#d9b88a"], "tuffing-bunk": ["bunk", 130, "#3a3c3f"],
    "idanas-bed": ["bed", 105, "#5b5a58"],         "tonstad-bedside": ["bedside", 50, "#c49a6c"],
    "tonstad-chest": ["chest", 96, "#c49a6c"],     "tonstad-desk": ["desk", 75, "#c49a6c"],
    "pax": ["wardrobe", 201, "#f2f0eb"],           "venecia-bath": ["bathtub", 98, "#fbfbfa"],
    "shower-screen": ["shower", 206, "#2a2724"],   "angsjon-vanity": ["vanity", 85, "#b99169"],
    "duravit-wc": ["toilet", 111, "#fbfbfa"],       "angsjon-tall": ["tall-cabinet", 160, "#f7f7f5"],
    "nammaro-lounger": ["lounger", 40, "#b88c5a"], "tarno-set": ["bistro", 72, "#2f2b28"],
    "mabarsbuske-pot": ["planter", 30, "#9c8468"], "bronden-rug": ["rug", 1, "#e1d3ba"],
    "stoense-rug": ["rug", 1, "#ece6da"],          "lohals-rug": ["rug", 1, "#c8ad7f"],
    "stoense-round": ["rug", 1, "#ece6da"],        "strelitzia": ["plant", 150, "#3f6b45"],
    "pachira": ["plant", 120, "#4d7a43"],          "monstera": ["plant", 70, "#2f5d3a"],
    "valtorp-bench": ["bench", 50, "#6b6a3a"],     "ragrund-bench": ["bench", 45, "#c9a46b"],
    "branas-basket": ["basket", 60, "#b4895a"],    "arstid-lamp": ["table-lamp", 55, "#f3ece0"],
    "dytag-curtains": ["curtains", 250, "#e6dccb"],
    "kivik-sofa": ["sofa", 83, "#d9cdb8"],         "kivik-leather": ["sofa", 83, "#2e2a28"],
    "soderhamn-sofa": ["sofa", 69, "#34425a"],     "strandmon": ["wing-chair", 101, "#4b4a4b"],
    "landskrona-stool": ["footstool", 44, "#2e2a28"], "kallax": ["bookcase", 147, "#e9dfcf"],
    "billy": ["bookcase", 202, "#f4f2ee"],         "fjallbo": ["bookcase", 136, "#2a2a2a"],
    "tversted-rug": ["rug", 1, "#d8c6a6"],         "vandplats-rug": ["rug", 1, "#e8dcc6"],
    "undervisning-rug": ["rug", 1, "#efe9dd"],     "ikea-ps-rug": ["rug", 1, "#f1ebe0"],
    "koldby-hide": ["rug", 1, "#7a5338"],
    "jarnvag-rug": ["rug", 1, "#e6d6c6"],          "jarnvag-round": ["rug", 1, "#e6d6c6"],
    "onsevig-rug": ["rug", 1, "#d9cdb8"],          "busenkel-rug": ["rug", 1, "#e3d4b9"],
    "engelsborg-rug": ["rug", 1, "#e9dfcc"],       "markblamme-rug": ["rug", 1, "#f2ece2"],
    "stockholm-rug": ["rug", 1, "#efe8dc"],        "raklev-rug": ["rug", 1, "#c8ad7f"],
    "brevbarare-rug": ["rug", 1, "#5a3e2c"],       "blaljus-rug": ["rug", 1, "#d9cfbf"],
    "frotorp": ["coffee-table", 45, "#2f2f2f"],     "stockholm-sideboard": ["sideboard", 83, "#c49a6c"],
    "besta-walnut": ["sideboard", 75, "#6b4a33"],   "gurli": ["decor", 45, "#c2410c"],
    "knoxhult": ["kitchen", 220, "#f4f2ee"],        "metod-green": ["kitchen-base", 92, "#9aa595"],
    "metod-black": ["kitchen-base", 92, "#3a3b3d"],  "metod-oak-sink": ["kitchen-base", 92, "#c9a274"],
    "metod-fridge": ["tall-fridge", 220, "#5f6b5c"], "lagan-fridge": ["fridge", 186, "#f3f3f1"],
    "pinntorp": ["chair", 96, "#f2efe9"],           "stig-bar": ["stool", 100, "#222222"],
    "marius": ["stool", 45, "#222222"],             "vattentat": ["decor", 25, "#c9ccd0"],
    "lamplig": ["decor", 4, "#c9a274"],             "own-wine": ["decor", 30, "#3b2a2a"],
    "own-tea": ["decor", 17, "#f2efe9"],            "tertial": ["table-lamp", 89, "#c2410c"],
    "panel-door": ["panel-door", 204, "#f7f5f0"],   "oak-door": ["oak-door", 210, "#b98a5e"],
    "double-door": ["double-door", 210, "#f7f5f0"], "steel-door": ["steel-door", 210, "#1f1f1f"],
    "sliding-door": ["sliding-door", 215, "#2b2b2b"], "french-window": ["french-window", 220, "#ffffff"],
    "triple-window": ["triple-window", 130, "#ffffff"], "steel-window": ["steel-window", 140, "#1f1f1f"],
    "small-window": ["small-window", 60, "#ffffff"],
    "fenomen-candles": ["candles", 12, "#efe6d2"],  "frovaxt-vase": ["decor", 20, "#f1eee8"],
    "sockerart-vase": ["decor", 22, "#f1eee8"],     "hultet-dish": ["decor", 9, "#b88c5a"],
    "rodalm-small": ["decor", 20, "#222222"],       "fikontrad-frame": ["decor", 17, "#f4f2ee"],
    "branas-lid": ["basket", 32, "#b4895a"],        "own-books": ["decor", 23, "#7b3b2a"],
    "own-candlestick": ["decor", 22, "#8a5a36"],    "own-lantern": ["decor", 29, "#3a3a3a"],
    "own-vase-tall": ["decor", 41, "#f1eee8"],      "own-vase-blue": ["decor", 44, "#dfe6f0"],
    "own-bust": ["decor", 52, "#ece9e4"],           "own-cat": ["decor", 28, "#9a9a96"],
    "own-elephant": ["decor", 10, "#8a5a36"],       "own-shell": ["decor", 5, "#e8c9a8"],
    "own-chess": ["decor", 11, "#c9a274"],          "own-alarm": ["decor", 17, "#5f8a83"],
    "own-mantel-clock": ["decor", 16, "#5b3a26"],   "own-clay-pot": ["decor", 22, "#b8673f"],
    "rodalm-oak": ["art", 50, "#cfd8d4"],           "rodalm-white": ["art", 40, "#d9d9d9"],
    "tromma": ["art", 25, "#f4f4f2"],               "own-painting": ["art", 46, "#8a8360"],
    "own-oval": ["art", 50, "#6b5a4a"],
    "own-vanity-walnut": ["vanity", 85, "#7a5238"],  "own-vanity-white": ["vanity", 85, "#f3f2ee"],
    "enhet-mirror": ["mirror-cabinet", 71, "#f3f2ee"], "own-mirror-led": ["mirror", 70, "#d7dfe3"],
    "own-radiator": ["radiator", 120, "#1f1e1d"],   "stegesund-ladder": ["ladder", 160, "#d9b98a"],
    "uddarp-washer": ["washer", 84, "#f3f2ee"],     "own-kitchen-sage": ["kitchen", 220, "#8f9c8a"],
    "own-kitchen-black": ["kitchen", 220, "#3a3b3d"], "own-tall-oven": ["tall-fridge", 220, "#f3f2ee"],
    "klavrestrom-shelf": ["wall-shelf", 29, "#c9a274"], "own-sofa-boucle": ["sofa", 78, "#ece5d8"],
    "own-sofa-sage": ["sofa", 77, "#a9b39d"],        "own-sofa-modular": ["sofa", 82, "#ddd0bb"],
    "own-sofa-tufted": ["sofa", 78, "#2a2726"],      "own-settee": ["sofa", 80, "#d8d2c8"],
    "own-armchair-boucle": ["armchair", 96, "#ece5d8"], "own-coffee-travertine": ["coffee-table", 45, "#e2d3bd"],
    "own-coffee-oval": ["coffee-table", 45, "#d2a374"], "own-coffee-carved": ["coffee-table", 37, "#2a2622"],
    "own-side-marble": ["side-table", 55, "#f2efea"], "tonstad-bookcase": ["bookcase", 201, "#d2a374"],
    "own-steel-shelving": ["bookcase", 231, "#b07a4a"], "own-white-bookcase": ["bookcase", 197, "#efede8"],
    "own-lamp-arc": ["floor-lamp", 195, "#c9a45c"],  "uppvind-lamp": ["floor-lamp", 155, "#f6f1e8"],
    "lauters-lamp": ["floor-lamp", 155, "#f4ecdf"],  "blidvader-lamp": ["table-lamp", 50, "#e8dfd0"],
    "havberg": ["armchair", 101, "#8a5a36"],        "ugglerum": ["side-table", 60, "#5b3a26"],
    "holmerud": ["console", 70, "#c9a274"],         "own-cabinet": ["bookcase", 188, "#2a2724"],
    "own-tv-wall": ["tv", 83, "#1d1d1f"],           "own-tv-easel": ["tv-stand", 148, "#b98a5e"],
    "own-tv-stand": ["tv-stand", 155, "#1d1d1f"],   "stensele": ["table", 102, "#3a2a20"],
    "radmanso": ["chest", 81, "#6b4a33"],           "calathea": ["plant", 58, "#3f6b45"],
    "anthurium": ["plant", 97, "#2f5d3a"],          "nephrolepis": ["plant", 64, "#4d7a43"],
    "own-horse": ["decor", 22, "#f1eee8"],          "own-whale": ["decor", 30, "#4a3a2c"],
    "own-candelabra": ["decor", 40, "#b8913f"],     "own-plate": ["decor", 4, "#c9a274"],
    "own-tray-basket": ["basket", 12, "#b4895a"],   "own-stoneware": ["decor", 19, "#8a7a5a"],
    "own-wood-bowl": ["decor", 7, "#a8743f"],       "own-brass-vase": ["decor", 20, "#b8913f"],             "own-mirror": ["art", 74, "#cfd6da"],
    "door": ["door", 210, "#f4f1ea"],              "window": ["window", 130, "#ffffff"],
    "window-wide": ["window", 150, "#ffffff"],     "glass-door": ["glass-door", 220, "#2f2b28"],
  };
  items.forEach((it) => { const [kind, h, color] = LOOK[it.id]; Object.assign(it, { kind, h, color }); });
  // What the upholstery is made of (scanned textures in assets/materials)
  const FABRIC = {
    "vimle-sofa": "fabric", "kivik-sofa": "boucle", "kivik-leather": "leather", "soderhamn-sofa": "velvet",
    "strandmon": "velvet", "landskrona": "leather", "valtorp-bench": "boucle", "lohals-rug": "jute", "raklev-rug": "jute", "blaljus-rug": "jute",
  };
  items.forEach((it) => { if (FABRIC[it.id]) it.fabric = FABRIC[it.id]; });

  const byId = Object.fromEntries(items.map((it) => [it.id, it]));
  // Rugs and curtains come in any size: a placed piece may carry its own (cm), the rest keep the shop's
  // tv / tv-stand: one size (the width); height and depth grow with it, so the screen keeps its shape
  const SIZABLE = { rug: { w: [40, 600], d: [40, 600] }, curtains: { w: [60, 600], h: [100, 400] }, tv: { w: [55, 215] }, "tv-stand": { w: [70, 215] } };
  const SCALES = new Set(["tv", "tv-stand"]);
  // A placed piece may also carry its own colour (tint) and, when it hangs, its own height on the wall (cm)
  // How many of the shop's packs a placed piece takes: wide curtains need more than one pair
  function packs(it) {
    const p = byId[it?.catalogId];
    if (p?.kind === "curtains" && Number.isFinite(it.size?.w)) return Math.max(1, Math.ceil(it.size.w / 150 - 0.05));
    return 1;
  }
  function piece(it) {
    const p = byId[it?.catalogId];
    if (!p) return p;
    const own = {};
    const rules = it.size && SIZABLE[p.kind];
    if (rules) Object.keys(rules).forEach((k) => { if (Number.isFinite(it.size[k])) own[k] = it.size[k]; });
    if (rules && SCALES.has(p.kind) && own.w) {     // a bigger screen: the whole set grows evenly
      const k = own.w / p.w;
      own.h = Math.round(p.h * k);
      own.d = Math.max(p.d, Math.round(p.d * k));
    }
    if (p.hang && Number.isFinite(it.hangAt)) own.hangAt = it.hangAt;
    if (/^#[0-9a-f]{6}$/i.test(it.tint || "")) own.tint = it.tint;
    if (p.lumens && Number.isFinite(it.lumens)) own.lumens = it.lumens;   // a brighter or softer bulb
    if (Number.isInteger(it.shuffle) && it.shuffle > 0) own.shuffle = it.shuffle;   // books and ornaments rearranged
    if (p.styles) {                                  // one of several looks: its own shape and size
      const st = p.styles.find((x) => x.key === it.style) || p.styles[0];
      Object.assign(own, { style: st.key, styleName: st.name, part: st.part });
      ["w", "d", "h"].forEach((k) => { if (st[k]) own[k] = st[k]; });
    }
    return Object.keys(own).length ? { ...p, ...own, sized: !!rules } : p;
  }
  const categories = [...new Set(items.map((it) => it.cat))];

  // Room colours on the 2D plan
  const ROOM_COLORS = ["#f3e4cc", "#f7dccf", "#dfe8d8", "#e4e2dc", "#e8dff0", "#d9e7ef"];

  // Finishes you can pick for a room in 3D
  // tex: a scanned texture in assets/floors (Poly Haven, CC0); size: metres one picture covers; gloss: 0 matte … 1 shiny
  const FLOORS = {
    oak:        { label: "Light oak",        color: "#d8a073", tex: true, size: 1.94, gloss: 0.45 },
    walnut:     { label: "Dark walnut",      color: "#5d3421", tex: true, size: 2,    gloss: 0.5 },
    herring:    { label: "Herringbone",      color: "#bc8f62", tex: true, size: 3.4,  gloss: 0.55 },
    diagonal:   { label: "Diagonal parquet", color: "#a97043", tex: true, size: 2.36, gloss: 0.55 },
    tiles:      { label: "Cream marble",     color: "#d2bf9f", tex: true, size: 1.5,  gloss: 0.75 },
    checker:    { label: "Chequered marble", color: "#aa9b95", tex: true, size: 3,    gloss: 0.6 },
    terracotta: { label: "Terracotta",       color: "#86432d", tex: true, size: 2.08, gloss: 0.35 },
    stone:      { label: "Natural stone",    color: "#9e907e", tex: true, size: 2.4,  gloss: 0.3, v: 2 },   // honed limestone
    terrazzo:   { label: "Terrazzo",         color: "#b89275", tex: true, size: 2,    gloss: 0.65 },
    concrete:   { label: "Concrete",         color: "#b8a894", tex: true, size: 1.8,  gloss: 0.15 },
    carpet:     { label: "Soft carpet",      color: "#e3cfb2", tex: true, size: 0.9,  gloss: 0, pile: 1.6, tint: "#d8c3a4" },
  };
  // Wall colours in groups people know from paint shops
  const WALL_PALETTES = [
    { name: "Whites & neutrals", colors: [
      { hex: "#ffffff", name: "Pure white" }, { hex: "#f5f1ea", name: "Linen" }, { hex: "#ece3d4", name: "Oat" },
      { hex: "#e2dbd0", name: "Pebble" }, { hex: "#cfc8bc", name: "Greige" }, { hex: "#a8a29e", name: "Stone grey" } ] },
    { name: "Warm", colors: [
      { hex: "#f3dcc6", name: "Peach" }, { hex: "#e6d3c3", name: "Clay" }, { hex: "#d9a589", name: "Terracotta pink" },
      { hex: "#c97b5d", name: "Burnt clay" }, { hex: "#ead7a4", name: "Ochre" }, { hex: "#c9b6a3", name: "Mushroom" } ] },
    { name: "Calm & green", colors: [
      { hex: "#d9e2d3", name: "Sage mist" }, { hex: "#b9c9b3", name: "Sage" }, { hex: "#8fa58a", name: "Olive" },
      { hex: "#d6dde4", name: "Morning blue" }, { hex: "#b2c2cf", name: "Sky" }, { hex: "#d9d2e4", name: "Lavender" } ] },
    { name: "Deep", colors: [
      { hex: "#5b6b5a", name: "Forest" }, { hex: "#3e5262", name: "Navy" }, { hex: "#7a4b3a", name: "Chestnut" },
      { hex: "#2f3632", name: "Charcoal" }, { hex: "#8e5a4c", name: "Brick" }, { hex: "#6b6250", name: "Moss" } ] },
  ];
  const WALLS = WALL_PALETTES.flatMap((g) => g.colors.map((c) => c.hex));

  // Floor colours: how the floor should look on average (the scanned grain and weave stay)
  const FLOOR_PALETTES = [
    { name: "Wood tones", colors: [
      { hex: "#ece2d3", name: "Whitewashed" }, { hex: "#e2c29a", name: "Pale oak" }, { hex: "#c98f52", name: "Honey" },
      { hex: "#a8a096", name: "Grey-washed" }, { hex: "#7a5a43", name: "Smoked" }, { hex: "#3b302b", name: "Ebony" } ] },
    { name: "Carpet & soft", colors: [
      { hex: "#ddd0bb", name: "Oat" }, { hex: "#b9b3aa", name: "Stone" }, { hex: "#4a4846", name: "Charcoal" },
      { hex: "#a3ae98", name: "Sage" }, { hex: "#b8694a", name: "Terracotta" }, { hex: "#34425a", name: "Navy" },
      { hex: "#dcbcb0", name: "Blush" }, { hex: "#c99b3c", name: "Mustard" } ] },
    { name: "Stone & tile", colors: [
      { hex: "#eeede8", name: "Chalk" }, { hex: "#b8b1a6", name: "Warm grey" }, { hex: "#5b6066", name: "Slate" }, { hex: "#6f8a7a", name: "Green clay" } ] },
  ];
  // Colours for a piece of furniture or decor: its main surface takes the colour, metal and glass stay
  const FINISH_PALETTES = [
    { name: "Neutrals", colors: [
      { hex: "#f3f1ec", name: "Snow" }, { hex: "#e6dccb", name: "Linen" }, { hex: "#cbb79a", name: "Sand" },
      { hex: "#9c9a95", name: "Stone grey" }, { hex: "#3c3a38", name: "Charcoal" }, { hex: "#1f1e1d", name: "Black" } ] },
    { name: "Earthy", colors: [
      { hex: "#c2410c", name: "Atelier terracotta" }, { hex: "#9a4a2c", name: "Rust" }, { hex: "#c99b3c", name: "Ochre" },
      { hex: "#7a7a4a", name: "Olive" }, { hex: "#9aa792", name: "Sage" }, { hex: "#3f5a46", name: "Forest" } ] },
    { name: "Cool & deep", colors: [
      { hex: "#8fa3b4", name: "Dusty blue" }, { hex: "#2f3e56", name: "Navy" }, { hex: "#2f6466", name: "Teal" },
      { hex: "#b9a9c4", name: "Lilac" }, { hex: "#dcb5aa", name: "Blush" }, { hex: "#6e2a2e", name: "Burgundy" } ] },
    { name: "Wood", colors: [
      { hex: "#e2c9a6", name: "Birch" }, { hex: "#d6a676", name: "Light oak" }, { hex: "#a0683f", name: "Teak" },
      { hex: "#6e4a33", name: "Walnut" }, { hex: "#2e2622", name: "Black oak" } ] },
  ];

  // Room types, like choosing a room in a store's planner. Sizes in metres.
  const ROOM_TYPES = {
    living:   { label: "Living room",  w: 5,   h: 4,   floor: "oak",      wall: "#f5f1ea", color: ROOM_COLORS[0] },
    bedroom:  { label: "Bedroom",      w: 4,   h: 3.6, floor: "walnut",   wall: "#ece3d4", color: ROOM_COLORS[2] },
    kitchen:  { label: "Kitchen",      w: 4,   h: 3.5, floor: "tiles",    wall: "#ffffff", color: ROOM_COLORS[1] },
    dining:   { label: "Dining room",  w: 4,   h: 3.5, floor: "herring",  wall: "#e6d3c3", color: ROOM_COLORS[1] },
    bathroom: { label: "Bathroom",     w: 3,   h: 2.6, floor: "terrazzo", wall: "#d6dde4", color: ROOM_COLORS[3] },
    office:   { label: "Home office",  w: 3.2, h: 3,   floor: "oak",      wall: "#d9e2d3", color: ROOM_COLORS[4] },
  };

  const uidish = (s) => s.toLowerCase().replace(/\W+/g, "-");
  const room = (name, x, y, w, h, color, extra = {}) => ({ id: uidish(name), name, x, y, w, h, color, floor: "oak", wall: "#f5f1ea", height: 2.6, lamp: true, ...extra });
  const typed = (type, x = 0, y = 0, w, h) => {
    const t = ROOM_TYPES[type];
    return room(t.label, x, y, w ?? t.w, h ?? t.h, t.color, { type, floor: t.floor, wall: t.wall });
  };
  // Furniture: x, y = centre in metres. rot: 0 faces down the plan, 90 faces left, 180 up, 270 right.
  const put = (catalogId, x, y, rot = 0) => ({ catalogId, x, y, rot });

  // Furnished versions of each room type (the empty version keeps only the doors and windows)
  const FURNISHED = {
    living: [
      put("window-wide", 2.5, 0.06, 0), put("door", 5 - 0.06, 1.9, 90),
      put("bronden-rug", 2.5, 2.1), put("stockholm-tv", 2.5, 0.33, 0), put("stockholm-table", 2.5, 1.95),
      put("vimle-sofa", 2.5, 3.1, 180), put("landskrona", 0.65, 1.7, 270), put("stockholm-lamp", 0.4, 3.5),
      put("strelitzia", 4.45, 0.5), put("arstid-lamp", 3.28, 0.3), put("billy", 0.48, 0.2, 0),
      put("fenomen-candles", 2.25, 1.9), put("own-books", 2.85, 2.0), put("rodalm-oak", 0.06, 3.0, 270),
    ],
    bedroom: [
      put("window", 0.06, 2.4, 270), put("door", 4 - 0.06, 2.4, 90),
      put("stoense-round", 2, 2.55), put("idanas-bed", 2, 1.17, 0), put("tonstad-bedside", 0.68, 0.32), put("tonstad-bedside", 3.32, 0.32),
      put("pax", 2.15, 3.27, 180), put("monstera", 0.45, 3.15), put("arstid-lamp", 0.68, 0.32),
    ],
    kitchen: [
      put("window", 0.06, 1.8, 270), put("door", 3.2, 3.5 - 0.06, 180),
      put("metod", 2, 0.36, 0), put("vadholma", 2, 1.95), put("nordviken-stool", 1.7, 2.62, 180), put("nordviken-stool", 2.3, 2.62, 180),
      put("pachira", 0.45, 3.05),
    ],
    dining: [
      put("window-wide", 2, 0.06, 0), put("door", 0.06, 2.8, 270),
      put("lohals-rug", 2, 1.75), put("tonstad-dining", 2, 1.75),
      put("stockholm-chair", 1.65, 1.08, 0), put("stockholm-chair", 2.35, 1.08, 0),
      put("stockholm-chair", 1.65, 2.42, 180), put("stockholm-chair", 2.35, 2.42, 180),
      put("tonstad-chest", 2.3, 3.2, 180), put("pachira", 3.55, 0.5),
    ],
    bathroom: [
      put("window", 0.06, 0.9, 270), put("door", 2.3, 0.06, 0),
      put("angsjon-vanity", 1.0, 0.31, 0), put("duravit-wc", 0.35, 1.5, 270),
      put("venecia-bath", 1.95, 2.1, 180), put("angsjon-tall", 2.76, 1.25, 90),
    ],
    office: [
      put("window", 1.6, 0.06, 0), put("door", 3.2 - 0.06, 2.2, 90),
      put("lohals-rug", 1.6, 1.7), put("tonstad-desk", 1.6, 0.44, 0), put("stockholm-chair", 1.6, 1.05, 180),
      put("landskrona", 0.6, 1.6, 270), put("stockholm-lamp", 0.35, 2.6), put("tonstad-chest", 1.55, 2.7, 180),
      put("monstera", 2.85, 0.45),
    ],
  };

  const templates = {};
  Object.entries(ROOM_TYPES).forEach(([type, t]) => {
    const r = typed(type);
    templates[`${type}-furnished`] = {
      type, furnished: true, label: t.label, text: `Furnished ${t.label.toLowerCase()}, ${t.w} × ${t.h} m`,
      rooms: [r], items: FURNISHED[type],
    };
    templates[`${type}-empty`] = {
      type, furnished: false, label: t.label, text: `Empty ${t.label.toLowerCase()}, ${t.w} × ${t.h} m, doors and windows in place`,
      rooms: [r], items: FURNISHED[type].filter((it) => byId[it.catalogId].structure),
    };
  });

  templates.sunlit = {
    type: "home", furnished: true, label: "The Sunlit Dream Home",
    text: "The 160 m² example from the home page, fully furnished.",
    rooms: [
      room("Living room", 0, 0, 8, 5, ROOM_COLORS[0], { type: "living", floor: "oak" }),
      room("Kitchen & dining", 8, 0, 8, 5, ROOM_COLORS[1], { type: "kitchen", floor: "herring", wall: "#ffffff" }),
      room("Bedroom", 0, 5, 10, 5, ROOM_COLORS[2], { type: "bedroom", floor: "walnut", wall: "#ece3d4" }),
      room("Bathroom", 10, 5, 6, 5, ROOM_COLORS[3], { type: "bathroom", floor: "terrazzo", wall: "#d6dde4" }),
      room("Terrace", 16.4, 0, 4.4, 5.6, ROOM_COLORS[5], { type: "terrace", floor: "concrete", wall: "#ffffff", height: 1.1 }),
    ],
    items: [
      put("window-wide", 4, 0.06, 0), put("glass-door", 16 - 0.06, 2.6, 90), put("door", 7.94, 3.8, 90), put("door", 3, 5.06, 0),
      put("window-wide", 3.5, 9.94, 180), put("window", 13, 9.94, 180), put("door", 11.2, 5.06, 0), put("window", 14.4, 0.06, 0),
      put("bronden-rug", 2.6, 2.5), put("vimle-sofa", 4.75, 2.5, 90), put("stockholm-table", 2.5, 2.5),
      put("landskrona", 2.1, 0.75), put("stockholm-tv", 0.35, 2.5, 270), put("stockholm-lamp", 5.7, 0.45), put("strelitzia", 0.5, 0.5),
      put("metod", 11.8, 0.4), put("vadholma", 11.4, 2.65), put("nordviken-stool", 11.0, 3.35, 180), put("nordviken-stool", 11.8, 3.35, 180),
      put("tonstad-dining", 14.2, 2.6), put("stockholm-chair", 13.8, 1.95), put("stockholm-chair", 14.6, 1.95),
      put("stockholm-chair", 13.8, 3.25, 180), put("stockholm-chair", 14.6, 3.25, 180), put("pachira", 8.55, 0.6),
      put("stoense-rug", 2.4, 7.4, 90), put("idanas-bed", 1.3, 7.5, 270), put("tonstad-bedside", 0.3, 6.1), put("tonstad-bedside", 0.3, 8.9),
      put("tonstad-chest", 5.0, 5.35), put("tonstad-desk", 6.6, 9.55, 180), put("pax", 8.9, 9.6, 180),
      put("venecia-bath", 13.5, 9.35, 180), put("angsjon-vanity", 13.6, 5.35), put("duravit-wc", 10.35, 8.4, 270),
      put("shower-screen", 15.3, 6.4, 90), put("angsjon-tall", 10.25, 7.2, 270), put("monstera", 15.6, 9.5),
      put("nammaro-lounger", 17.6, 3.9, 180), put("nammaro-lounger", 18.6, 3.9, 180), put("tarno-set", 19.4, 1.1), put("mabarsbuske-pot", 20.4, 5.2),
    ],
  };

  // ---------- Three homes by Atelier users, shown on the home page (open one to make it yours) ----------
  // open: pairs of rooms with no wall between them. light: the time of day the photos were taken.
  const curtain = (x, y, w, h) => ({ ...put("dytag-curtains", x, y), size: { w, h } });
  templates["paris-flat"] = {
    type: "home", furnished: true, showcase: true, label: "Haussmann flat, Paris",
    owner: "Claire D.", city: "Paris", style: "Parisian classic",
    text: "Herringbone floors, tall French windows and a double salon, furnished soft and light.",
    light: { time: 16.5, dir: 210, lamps: "auto" },
    open: [["Salon", "Dining & kitchen"]],
    rooms: [
      room("Salon", 0, 0, 6, 4.6, ROOM_COLORS[0], { type: "living", floor: "herring", wall: "#f5f1ea", height: 3 }),
      room("Dining & kitchen", 6, 0, 4.4, 4.6, ROOM_COLORS[1], { type: "dining", floor: "herring", wall: "#f5f1ea", height: 3 }),
      room("Bedroom", 0, 4.6, 5.2, 3.8, ROOM_COLORS[2], { type: "bedroom", floor: "herring", wall: "#d9e2d3", height: 3 }),
      room("Bathroom", 5.2, 4.6, 2.8, 3.8, ROOM_COLORS[3], { type: "bathroom", floor: "checker", wall: "#ffffff", height: 3 }),
      room("Study", 8, 4.6, 2.4, 3.8, ROOM_COLORS[4], { type: "office", floor: "herring", wall: "#ece3d4", height: 3 }),
    ],
    items: [
      // openings
      put("french-window", 1.6, 0.06, 0), put("french-window", 4.4, 0.06, 0), put("french-window", 8.2, 0.06, 0),
      put("french-window", 2.6, 8.34, 180), put("small-window", 6.6, 8.34, 180), put("window", 9.2, 8.34, 180),
      put("panel-door", 0.9, 4.6, 0), put("panel-door", 5.2, 6.9, 90), put("panel-door", 9.2, 4.6, 0),
      curtain(1.6, 0.27, 170, 295), curtain(4.4, 0.27, 170, 295), curtain(8.2, 0.27, 170, 295), curtain(2.6, 8.13, 170, 295),
      // salon: a seating group around the console and the arched mirror, like a mantelpiece
      put("jarnvag-round", 2.75, 2.3), put("own-coffee-travertine", 2.75, 2.3), put("own-settee", 4.15, 2.3, 90),
      put("own-armchair-boucle", 2.75, 0.95, 0), put("own-armchair-boucle", 2.75, 3.65, 180),
      put("holmerud", 0.215, 2.3, 270), put("own-mirror", 0.08, 2.3, 270), put("own-candelabra", 0.22, 1.95), put("own-vase-blue", 0.22, 2.65),
      put("own-side-marble", 4.2, 1.15), put("own-brass-vase", 4.2, 1.15), put("lauters-lamp", 4.35, 3.55),
      put("own-fig-urn", 0.45, 0.5), put("own-books", 2.6, 2.25), put("own-candlestick", 2.95, 2.4),
      put("rodalm-oak", 3.4, 4.525, 180), put("own-syngonium", 5.6, 4.15),
      // dining and kitchen
      put("tonstad-dining", 8.0, 2.1), put("stockholm-chair", 7.65, 1.45), put("stockholm-chair", 8.35, 1.45),
      put("stockholm-chair", 7.65, 2.75, 180), put("stockholm-chair", 8.35, 2.75, 180), put("frovaxt-vase", 8.0, 2.1),
      put("own-kitchen-sage", 10.005, 2.4, 90), put("strelitzia", 9.95, 0.45),
      put("stockholm-sideboard", 7.6, 4.33, 180), put("own-painting", 7.6, 4.525, 180), put("sockerart-vase", 7.2, 4.33), put("own-mantel-clock", 7.95, 4.33),
      // bedroom
      put("idanas-bed", 1.14, 6.5, 270), put("tonstad-bedside", 0.26, 5.2, 270), put("tonstad-bedside", 0.26, 7.8, 270),
      put("arstid-lamp", 0.26, 5.2), put("arstid-lamp", 0.26, 7.8), put("engelsborg-rug", 1.9, 6.5, 90),
      put("pax", 3.5, 4.95, 0), put("strandmon", 4.5, 7.75, 180), put("own-oval", 0.08, 6.5, 270), put("calathea", 4.8, 5.55),
      // bathroom
      put("venecia-bath", 6.55, 7.94, 180), put("own-vanity-walnut", 6.35, 4.9, 0), put("own-mirror-led", 6.35, 4.68, 0),
      put("duravit-wc", 7.655, 5.75, 90), put("own-radiator", 7.93, 7.0, 90), put("own-haworthia", 6.1, 4.9),
      // study
      put("tonstad-desk", 9.2, 7.965, 180), put("pinntorp", 9.2, 7.22), put("tertial", 9.75, 7.97),
      put("billy-wide", 8.2, 5.95, 270), put("own-poster", 10.325, 6.4, 90), put("own-periwinkle", 8.28, 7.97),
    ],
  };
  templates["lisbon-house"] = {
    type: "home", furnished: true, showcase: true, label: "Sunny house, Lisbon",
    owner: "Sofia & Tiago", city: "Lisbon", style: "Warm Mediterranean",
    text: "Terracotta floors, clay walls, linen and jute, and a kitchen that opens onto the terrace.",
    light: { time: 18, dir: 250, lamps: "auto" },
    open: [["Living & dining", "Kitchen"]],
    rooms: [
      room("Living & dining", 0, 0, 7, 5, ROOM_COLORS[0], { type: "living", floor: "terracotta", wall: "#f5f1ea", height: 2.8 }),
      room("Kitchen", 7, 0, 3.6, 5, ROOM_COLORS[1], { type: "kitchen", floor: "terracotta", wall: "#ffffff", height: 2.8 }),
      room("Bedroom", 0, 5, 4.4, 4, ROOM_COLORS[2], { type: "bedroom", floor: "oak", wall: "#e6d3c3", height: 2.8 }),
      room("Bathroom", 4.4, 5, 2.6, 4, ROOM_COLORS[3], { type: "bathroom", floor: "terrazzo", wall: "#f3dcc6", height: 2.8 }),
      room("Terrace", 7, 5, 3.6, 4, ROOM_COLORS[5], { type: "terrace", floor: "stone", wall: "#ffffff", height: 1.1 }),
    ],
    items: [
      put("window-wide", 2.0, 0.06, 0), put("french-window", 5.3, 0.06, 0), put("window", 8.8, 0.06, 0),
      put("french-window", 2.2, 8.94, 180), put("small-window", 6.3, 8.94, 180),
      put("sliding-door", 8.8, 5, 0), put("oak-door", 3.85, 5, 0), put("oak-door", 4.4, 8.1, 90),
      curtain(2.0, 0.27, 280, 270), curtain(5.3, 0.27, 190, 270), curtain(2.2, 8.73, 190, 270),
      // living: olive sofa, jute and a pair of chairs facing it
      put("lohals-rug", 1.75, 2.0, 90), put("own-sofa-sage", 0.465, 2.0, 270), put("own-coffee-oval", 1.65, 2.0, 90),
      put("own-armchair-boucle", 2.95, 1.45, 90), put("havberg", 2.95, 2.6, 90), put("gurli", 0.5, 1.5), put("gurli", 0.5, 2.5),
      put("uppvind-lamp", 0.35, 0.6), put("hemnes-bookcase", 0.245, 3.85, 270), put("strelitzia", 0.45, 4.62),
      put("own-stoneware", 1.65, 1.8), put("own-books", 1.65, 2.25), put("own-canvas", 1.8, 4.925, 180),
      // dining
      put("tonstad-dining", 5.3, 3.2), put("pinntorp", 4.95, 2.55), put("pinntorp", 5.65, 2.55),
      put("pinntorp", 4.95, 3.85, 180), put("pinntorp", 5.65, 3.85, 180), put("own-clay-pot", 5.3, 3.2),
      put("pachira", 6.55, 4.5), put("own-macrame", 5.3, 4.925, 180), put("own-hanging-plant", 6.925, 1.8, 90),
      // kitchen
      put("metod", 10.24, 2.3, 90), put("vadholma", 8.6, 2.3, 90), put("nordviken-stool", 7.95, 1.95, 270), put("nordviken-stool", 7.95, 2.65, 270),
      put("own-tea", 8.6, 2.0), put("hultet-dish", 8.6, 2.6), put("klavrestrom-shelf", 7.6, 0.07, 0), put("own-wine", 10.24, 3.6),
      // bedroom
      put("malm-160", 1.9, 6.105, 0), put("tonstad-bedside", 0.7, 5.26, 0), put("tonstad-bedside", 3.1, 5.26, 0),
      put("blidvader-lamp", 0.7, 5.26), put("blidvader-lamp", 3.1, 5.26), put("raklev-rug", 1.9, 7.0),
      put("radmanso", 4.1, 6.8, 90), put("own-sunburst", 1.9, 5.075, 0), put("own-syngonium", 0.45, 8.5), put("own-vase-tall", 4.1, 6.4),
      // bathroom
      put("shower-screen", 6.34, 5.51, 0), put("own-vanity-white", 5.75, 8.705, 180), put("own-mirror-led", 5.75, 8.925, 180),
      put("duravit-wc", 6.655, 7.4, 90), put("stegesund-ladder", 4.6, 6.0, 270), put("monstera", 4.75, 7.3),
      // terrace
      put("nammaro-lounger", 7.6, 7.3), put("tarno-set", 9.6, 7.9), put("mabarsbuske-pot", 10.25, 5.4), put("mabarsbuske-pot", 10.25, 8.6),
      put("own-flower-box", 8.4, 8.7, 180), put("own-gazania-pot", 9.3, 5.45),
    ],
  };
  templates["cluj-loft"] = {
    type: "home", furnished: true, showcase: true, label: "Industrial loft, Cluj",
    owner: "Andrei M.", city: "Cluj-Napoca", style: "Dark industrial",
    text: "Steel windows, deep green walls and dark walnut, with a leather corner and a games room.",
    light: { time: 15, dir: 160, lamps: "auto" },
    open: [["Loft", "Kitchen"]],
    rooms: [
      room("Loft", 0, 0, 8, 5.4, ROOM_COLORS[3], { type: "living", floor: "walnut", wall: "#5b6b5a", height: 3.2 }),
      room("Kitchen", 8, 0, 4, 5.4, ROOM_COLORS[1], { type: "kitchen", floor: "concrete", wall: "#2f3632", height: 3.2 }),
      room("Bedroom", 0, 5.4, 5, 4, ROOM_COLORS[2], { type: "bedroom", floor: "walnut", wall: "#5b6b5a", height: 3.2 }),
      room("Bathroom", 5, 5.4, 2.6, 4, ROOM_COLORS[5], { type: "bathroom", floor: "checker", wall: "#a8a29e", height: 3.2 }),
      room("Games room", 7.6, 5.4, 4.4, 4, ROOM_COLORS[4], { type: "office", floor: "walnut", wall: "#3e5262", height: 3.2 }),
    ],
    items: [
      put("steel-window", 1.6, 0.06, 0), put("steel-window", 4.0, 0.06, 0), put("steel-window", 6.4, 0.06, 0), put("steel-window", 10.0, 0.06, 0),
      put("steel-window", 2.5, 9.34, 180), put("small-window", 6.3, 9.34, 180), put("steel-window", 9.8, 9.34, 180),
      put("steel-door", 4.4, 5.4, 0), put("steel-door", 5.0, 8.8, 90), put("steel-door", 8.6, 5.4, 0),
      // loft: a low modular sofa facing the steel windows
      put("onsevig-rug", 3.6, 2.3), put("kivik-leather", 3.6, 3.4, 180), put("own-coffee-carved", 3.6, 2.0),
      put("landskrona", 1.45, 1.1, 315), put("landskrona-stool", 1.75, 2.2), put("own-lamp-arc", 5.6, 3.3, 180),
      put("own-steel-shelving", 0.42, 3.75, 270), put("strelitzia", 7.45, 0.5), put("own-fig-urn", 7.4, 4.8),
      put("own-chess", 3.4, 1.85), put("own-whale", 3.9, 2.2), put("own-canvas", 3.6, 5.325, 180), put("own-bust", 0.42, 3.4),
      // kitchen and dining
      put("own-kitchen-black", 11.605, 2.3, 90), put("tonstad-dining", 9.6, 2.4, 90),
      put("stockholm-chair", 8.95, 2.05, 270), put("stockholm-chair", 8.95, 2.75, 270), put("stockholm-chair", 10.25, 2.05, 90), put("stockholm-chair", 10.25, 2.75, 90),
      put("own-lantern", 9.6, 2.4), put("anthurium", 10.6, 4.9),
      // bedroom
      put("malm-180", 1.105, 7.4, 270), put("tonstad-bedside", 0.26, 6.1, 270), put("tonstad-bedside", 0.26, 8.7, 270),
      put("arstid-lamp", 0.26, 6.1), put("arstid-lamp", 0.26, 8.7), put("koldby-hide", 2.6, 7.4, 90),
      put("radmanso", 4.70, 7.0, 90), put("rodalm-oak", 0.075, 7.4, 270), put("own-alarm", 0.26, 8.75), put("monstera", 3.3, 5.85),
      // bathroom
      put("venecia-bath", 7.14, 8.45, 90), put("own-vanity-walnut", 6.0, 5.70, 0), put("own-mirror", 6.0, 5.475, 0),
      put("duravit-wc", 7.255, 6.15, 90), put("own-radiator", 5.07, 7.2, 270),
      // games room
      put("pongori-bt600", 9.8, 7.45), put("own-neon", 11.925, 7.45, 90), put("own-guitar", 7.675, 7.5, 270),
      put("kallax", 10.9, 5.66, 0), put("own-record", 10.9, 5.475, 0),
    ],
  };

  if (typeof Region !== "undefined") Region.apply(items);   // prices and shop links for the country you shop in

  return { items: items.filter((it) => !it.retired), byId, piece, packs, SIZABLE, categories, templates, ROOM_COLORS, ROOM_TYPES, FLOORS, WALLS, WALL_PALETTES, FLOOR_PALETTES, FINISH_PALETTES };
})();
