/* =========================================================
   Atelier — where you shop: prices and shop links per country
   ---------------------------------------------------------
   IKEA prices and product pages checked on each country's
   ikea.com site (November 2026). A piece IKEA doesn't sell in a
   country links to a search there, and its price is the French
   one converted (shown with ≈). Other shops are French: outside
   France their prices are converted too.
   Loaded before js/catalog.js, which applies the region chosen.
   ========================================================= */

const Region = (() => {
  const KEY = "atelier.region";
  // rate = how many of the local currency one euro buys (approximate, for estimates only)
  const LIST = {
    fr: { name: "France",         ikea: "fr/fr", currency: "EUR", locale: "en-IE", rate: 1 },
    ro: { name: "România",        ikea: "ro/ro", currency: "RON", locale: "ro-RO", rate: 5.09 },
    gb: { name: "United Kingdom", ikea: "gb/en", currency: "GBP", locale: "en-GB", rate: 0.87 },
    de: { name: "Deutschland",    ikea: "de/de", currency: "EUR", locale: "en-IE", rate: 1 },
    es: { name: "España",         ikea: "es/es", currency: "EUR", locale: "en-IE", rate: 1 },
    it: { name: "Italia",         ikea: "it/it", currency: "EUR", locale: "en-IE", rate: 1 },
    us: { name: "United States",  ikea: "us/en", currency: "USD", locale: "en-US", rate: 1.16 },
  };
  // IKEA outside France: [price in the local currency, the product's page name]
  const IKEA = {
    "vimle-sofa": {"ro":[4400.0,"vimle-canapea-3-locuri-cu-sezlong-cu-tetiera-cu-brate-late-gunnared-bej-s69401302"],"de":[879.0,"vimle-3er-sofa-mit-recamiere-mit-nackenkissen-mit-breiten-armlehnen-gunnared-beige-s69401302"],"es":[1149.0,"vimle-sofa-3-plazas-con-chaiselongue-con-reposacabezas-con-reposabrazos-anchos-gunnared-beige-s69401302"],"it":[939.0,"vimle-divano-a-3-posti-con-chaise-longue-con-poggiatesta-con-braccioli-larghi-gunnared-beige-s69401302"]},
    "stockholm-table": {"ro":[999.0,"stockholm-2025-masuta-cafea-frnr-stjr-sticla-20586552"],"gb":[249.0,"stockholm-2025-coffee-table-oak-veneer-glass-20586552"],"de":[299.0,"stockholm-2025-couchtisch-eichenfurnier-glas-20586552"],"es":[249.0,"stockholm-2025-mesa-centro-chapa-roble-vidrio-20586552"],"it":[249.0,"stockholm-2025-tavolino-impiallacciatura-di-rovere-vetro-20586552"],"us":[299.99,"stockholm-2025-coffee-table-oak-veneer-glass-20586552"]},
    "landskrona": {"ro":[2299.0,"landskrona-fotoliu-grann-bomstad-maro-auriu-lemn-s19269197"],"de":[499.0,"landskrona-sessel-grann-bomstad-goldbraun-holz-s19269197"],"es":[499.0,"landskrona-sillon-grann-bomstad-marron-dorado-madera-s19269197"],"it":[449.0,"landskrona-poltrona-grann-bomstad-ocra-bruna-legno-s19269197"]},
    "stockholm-tv": {"ro":[1799.0,"stockholm-2025-comoda-tv-cu-usi-glisante-frnr-stjr-40586508"],"gb":[349.0,"stockholm-2025-tv-bench-with-sliding-doors-oak-veneer-40586508"],"de":[399.0,"stockholm-2025-tv-bank-schiebetueren-eichenfurnier-40586508"],"es":[349.0,"stockholm-2025-mueble-tv-puertas-correderas-chapa-roble-40586508"],"it":[349.0,"stockholm-2025-mobile-tv-con-ante-scorrevoli-impiallacciatura-di-rovere-40586508"]},
    "kivik-sofa": {"de":[599.0,"kivik-3er-sofa-tresund-hellbeige-s89482830"],"es":[529,"kivik-sofa-3-plazas-tresund-beige-claro-s89482830"],"it":[499,"kivik-divano-a-3-posti-tresund-beige-chiaro-s89482830"]},
    "kivik-leather": {"ro":[3500,"kivik-canapea-3-locuri-grann-bomstad-negru-00519525"],"de":[899.0,"kivik-3er-sofa-grann-bomstad-schwarz-00519525"],"es":[999.0,"kivik-sofa-3-plazas-grann-bomstad-negro-00519525"],"it":[899.0,"kivik-divano-a-3-posti-grann-bomstad-nero-00519525"]},
    "soderhamn-sofa": {"ro":[2600.0,"soederhamn-canapea-3-locuri-kelinge-albastru-inchis-s49621630"],"de":[599.0,"soederhamn-3er-sofa-kelinge-dunkelblau-s49621630"],"es":[549.0,"soderhamn-sofa-3-plazas-kelinge-azul-oscuro-s49621630"],"it":[540.0,"soederhamn-divano-a-3-posti-kelinge-blu-scuro-s49621630"]},
    "strandmon": {"ro":[1099.0,"strandmon-fotoliu-nordvalla-gri-inchis-20343224"],"de":[179.0,"strandmon-ohrensessel-nordvalla-dunkelgrau-20343224"],"es":[199,"strandmon-sillon-orejero-nordvalla-gris-oscuro-20343224"],"it":[249.0,"strandmon-poltrona-nordvalla-grigio-scuro-20343224"]},
    "landskrona-stool": {"de":[299.0,"landskrona-hocker-grann-bomstad-schwarz-holz-s09031813"],"es":[299.0,"landskrona-reposapies-grann-bomstad-negro-madera-s09031813"],"it":[249.0,"landskrona-poggiapiedi-grann-bomstad-nero-legno-s09031813"]},
    "kallax": {"ro":[299.0,"kallax-etajera-aspect-stejar-antichizat-00324518"],"gb":[49,"kallax-shelving-unit-white-stained-oak-effect-00324518"],"de":[59.99,"kallax-regal-eicheneff-wlas-00324518"],"es":[54.99,"kallax-estanteria-efecto-roble-tinte-blanco-00324518"],"it":[55,"kallax-scaffale-effetto-rovere-con-mordente-bianco-00324518"]},
    "billy": {"es":[59.99,"billy-libreria-blanco-20522046"],"it":[59.95,"billy-libreria-bianco-20522046"],"us":[79.0,"billy-bookcase-white-20522046"]},
    "fjallbo": {"ro":[449.0,"fjaellbo-etajera-negru-70339291"],"gb":[115.0,"fjaellbo-shelving-unit-black-70339291"],"de":[129.99,"fjaellbo-regal-schwarz-70339291"],"es":[99.99,"fjallbo-estanteria-negro-70339291"],"it":[139.0,"fjaellbo-scaffale-nero-70339291"],"us":[149.0,"fjaellbo-shelf-unit-black-70339291"]},
    "frotorp": {"ro":[649.0,"froetorp-masuta-cafea-antracit-aspect-marmura-negru-sticla-70497582"],"gb":[149.0,"froetorp-coffee-table-anthracite-marble-effect-black-glass-70497582"],"de":[149.0,"froetorp-couchtisch-anthrazit-marmoriert-schwarz-glas-70497582"],"es":[149.0,"frotorp-mesa-centro-antracita-efecto-marmol-negro-vidrio-70497582"],"it":[199.0,"froetorp-tavolino-antracite-effetto-marmo-nero-vetro-70497582"],"us":[349.99,"froetorp-coffee-table-anthracite-marble-effect-black-glass-70497582"]},
    "stockholm-sideboard": {"ro":[2499.0,"stockholm-2025-bufet-frnr-stjr-10586604"],"gb":[499.0,"stockholm-2025-sideboard-oak-veneer-10586604"],"de":[499.0,"stockholm-2025-sideboard-eichenfurnier-10586604"],"es":[499.0,"stockholm-2025-aparador-chapa-roble-10586604"],"it":[499.0,"stockholm-2025-buffet-impiallacciatura-di-rovere-10586604"],"us":[599.0,"stockholm-2025-sideboard-oak-veneer-10586604"]},
    "besta-walnut": {"gb":[110,"besta-storage-combination-with-doors-black-brown-lappviken-stubbarp-brown-walnut-effect-s49612348"],"de":[175,"besta-aufbewahrung-mit-tueren-schwarzbraun-lappviken-stubbarp-braun-nussbaumnachbildung-s49612348"],"es":[135,"besta-mueble-salon-negro-marron-lappviken-stubbarp-marron-efecto-nogal-s49612348"],"it":[135,"besta-mobile-con-ante-marrone-nero-lappviken-stubbarp-marrone-effetto-noce-s49612348"],"us":[265.0,"besta-storage-combination-with-doors-black-brown-lappviken-stubbarp-brown-walnut-effect-s49612348"]},
    "gurli": {"ro":[14.9,"gurli-fata-de-perna-portocaliu-deschis-20598767"],"de":[3.99,"gurli-kissenbezug-leuchtend-orange-20598767"],"es":[2.99,"gurli-funda-cojin-naranja-claro-20598767"],"it":[2.95,"gurli-fodera-per-cuscino-arancione-vivo-20598767"]},
    "stockholm-lamp": {"ro":[529.0,"stockholm-2025-lampadar-alb-textil-alamit-50585914"],"de":[99.99,"stockholm-2025-standleuchte-weiss-textil-vermessingt-50585914"],"es":[99.99,"stockholm-2025-lampara-pie-blanco-textil-chapado-laton-50585914"],"it":[99.0,"stockholm-2025-lampada-da-terra-bianco-tessuto-ottonato-50585914"]},
    "havberg": {"de":[399.0,"havberg-drehsessel-grann-bomstad-goldbraun-70515109"],"es":[449.0,"havberg-silla-giratoria-grann-bomstad-marron-dorado-70515109"],"it":[399.0,"havberg-poltrona-girevole-grann-bomstad-ocra-bruna-70515109"]},
    "ugglerum": {"ro":[299.0,"ugglerum-masuta-auxiliara-maro-00627983"],"gb":[69.0,"ugglerum-side-table-brown-00627983"],"de":[99.99,"ugglerum-beistelltisch-braun-00627983"],"es":[69.99,"ugglerum-mesa-auxiliar-marron-00627983"],"it":[69.0,"ugglerum-tavolino-marrone-00627983"],"us":[99.99,"ugglerum-side-table-brown-00627983"]},
    "holmerud": {"ro":[249.0,"holmerud-masuta-auxiliara-aspect-stejar-40541421"],"gb":[49.0,"holmerud-side-table-oak-effect-40541421"],"de":[49.99,"holmerud-beistelltisch-eichenachbildung-40541421"],"es":[49.99,"holmerud-mesa-auxiliar-efecto-roble-40541421"],"it":[50.0,"holmerud-tavolino-effetto-rovere-40541421"],"us":[59.99,"holmerud-side-table-oak-effect-40541421"]},
    "tonstad-bookcase": {"ro":[1499.0,"tonstad-biblioteca-frnr-stjr-70528461"],"gb":[199.0,"tonstad-bookcase-oak-veneer-70528461"],"de":[199.0,"tonstad-buecherregal-eichenfurnier-70528461"],"es":[229.0,"tonstad-libreria-chapa-roble-70528461"],"it":[229.0,"tonstad-libreria-impiallacciatura-di-rovere-70528461"],"us":[299.0,"tonstad-bookcase-oak-veneer-70528461"]},
    "metod": {"gb":[1306.0,"metod-kitchen-white-veddinge-white-s99614910"]},
    "vadholma": {"ro":[3999.0,"vadholma-insula-bucatarie-negru-stejar-20359154"],"gb":[579.0,"vadholma-kitchen-island-black-oak-20359154"],"de":[599.0,"vadholma-kuecheninsel-schwarz-eiche-20359154"],"es":[599.0,"vadholma-isla-negro-roble-20359154"],"it":[659.0,"vadholma-isola-per-cucina-nero-rovere-20359154"],"us":[699.0,"vadholma-kitchen-island-black-oak-20359154"]},
    "nordviken-stool": {"de":[69.99,"nordviken-barhocker-schwarz-80369112"]},
    "tonstad-dining": {"ro":[1499.0,"tonstad-masa-extensibila-frnr-stjr-40593882"],"gb":[299.0,"tonstad-extendable-table-oak-veneer-40593882"],"de":[349.0,"tonstad-ausziehtisch-eichenfurnier-40593882"],"es":[299.0,"tonstad-mesa-extensible-chapa-roble-40593882"],"it":[299.0,"tonstad-tavolo-allungabile-impiallacciatura-di-rovere-40593882"],"us":[379.99,"tonstad-extendable-table-oak-veneer-40593882"]},
    "stockholm-chair": {"ro":[899.0,"stockholm-2025-scaun-stejar-piele-00590140"],"de":[189.0,"stockholm-2025-stuhl-eiche-leder-00590140"],"es":[189.0,"stockholm-2025-silla-roble-piel-00590140"],"it":[189.0,"stockholm-2025-sedia-rovere-pelle-00590140"]},
    "knoxhult": {"ro":[670.0,"knoxhult-bucatarie-alb-s49581120"],"gb":[185.0,"knoxhult-kitchen-white-s49581120"],"de":[155.0,"knoxhult-kueche-weiss-s49581120"],"es":[173.0,"knoxhult-cocina-blanco-s49581120"],"it":[154.0,"knoxhult-cucina-bianco-s49581120"]},
    "metod-green": {"gb":[221.0,"metod-maximera-base-cb-3-frnts-2-low-1-md-1-hi-drw-white-axstad-grey-green-s09518456"],"it":[274.0,"metod-maximera-mob-3front-2casset-bas-1med-1alt-bianco-axstad-grigio-verde-s09518456"]},
    "metod-black": {"ro":[1944.0,"metod-knivshult-corp-baza-4-fronturi-2-3-sertare-negru-gri-nickebo-mat-antracit-s89587554"],"gb":[400.0,"metod-knivshult-base-cb-4-frnts-2-low-3-md-drwrs-black-grey-nickebo-matt-anthracite-s89587554"],"de":[589.0,"metod-knivshult-uschr-4-fr-2-sch-3-haho-sch-schwarzgrau-nickebo-matt-anthrazit-s89587554"],"it":[413.0,"metod-knivshult-mobile-4front-2cassetti-bassi-3medi-nero-grigio-nickebo-antracite-opaco-s89587554"]},
    "metod-oak-sink": {"gb":[202.0,"metod-maximera-base-cab-f-sink-2-fronts-2-drawers-white-voxtorp-oak-effect-s99537907"],"it":[228.0,"metod-maximera-mobile-lavello-2frontali-2cassetti-bianco-voxtorp-effetto-rovere-s99537907"]},
    "metod-fridge": {"gb":[294.0,"metod-high-cabinet-for-fridge-w-2-doors-white-aspudden-dark-grey-green-s99605411"],"de":[300,"metod-hs-f-kuehlschr-m-2-tueren-weiss-aspudden-dunkel-graugruen-s99605411"],"it":[279.0,"metod-mobile-frigo-2-ante-bianco-aspudden-grigio-scuro-verde-s99605411"]},
    "lagan-fridge": {"ro":[1999.0,"lagan-frigider-congelator-independent-alb-00571293"],"de":[399.0,"lagan-kuehl-gefrierschrank-frei-stehend-weiss-00571293"],"es":[399,"lagan-frigorifico-congelador-independiente-blanco-00571293"],"it":[399.0,"lagan-frigorifero-congelatore-freestanding-bianco-00571293"]},
    "pinntorp": {"ro":[199.0,"pinntorp-scaun-vopsit-alb-pin-90635177"],"gb":[40.0,"pinntorp-chair-white-stained-pine-90635177"],"de":[34.99,"pinntorp-stuhl-weiss-las-kiefer-90635177"],"es":[35.0,"pinntorp-silla-tinte-blanco-pino-90635177"],"it":[40.0,"pinntorp-sedia-mordente-bianco-pino-90635177"],"us":[40.0,"pinntorp-chair-white-stained-pine-90635177"]},
    "stig-bar": {"ro":[89.9,"stig-scaun-bar-cu-spatar-inaltimea-blatului-negru-negru-30498418"],"gb":[15.0,"stig-bar-stool-with-backrest-counter-height-black-black-30498418"],"de":[16.0,"stig-barhocker-arbeitsplattenhoehe-schwarz-schwarz-30498418"],"es":[14.99,"stig-taburete-alto-altura-la-encimera-negro-negro-30498418"],"it":[19.95,"stig-sgabello-bar-con-schienale-nero-nero-30498418"],"us":[34.99,"stig-bar-stool-with-backrest-counter-height-black-black-30498418"]},
    "marius": {"ro":[24.9,"marius-taburet-negru-10135659"],"gb":[5.0,"marius-stool-black-10135659"],"de":[6.0,"marius-hocker-schwarz-10135659"],"es":[5.99,"marius-taburete-negro-10135659"],"it":[7.95,"marius-sgabello-nero-10135659"],"us":[8.99,"marius-stool-black-10135659"]},
    "stensele": {"ro":[699.0,"stensele-masa-bar-antracit-antracit-s09288224"],"gb":[149.0,"stensele-bar-table-anthracite-anthracite-s09288224"],"de":[149.0,"stensele-bartisch-anthrazit-anthrazit-s09288224"],"es":[139.0,"stensele-mesa-alta-antracita-antracita-s09288224"],"it":[149.0,"stensele-tavolo-bar-antracite-antracite-s09288224"],"us":[229.99,"stensele-bar-table-anthracite-anthracite-s09288224"]},
    "klavrestrom-shelf": {"ro":[199.9,"klavrestroem-etajera-stejar-30601689"],"gb":[25.0,"klavrestroem-wall-shelf-oak-30601689"],"de":[29.99,"klavrestroem-wandregal-eiche-30601689"],"es":[29.99,"klavrestrom-estante-roble-30601689"],"it":[35.0,"klavrestroem-scaffale-da-parete-rovere-30601689"],"us":[39.99,"klavrestroem-wall-shelf-oak-30601689"]},
    "vattentat": {"ro":[99.9,"vattentaet-ceainic-inox-negru-20239595"],"es":[19.99,"vattentat-hervidor-acero-inoxidable-negro-20239595"],"it":[19.95,"vattentaet-bollitore-con-fischietto-inox-nero-20239595"]},
    "lamplig": {"ro":[59.9,"laemplig-tocator-00394380"],"es":[12.99,"lamplig-tabla-cortar-00394380"]},
    "idanas-bed": {},
    "tonstad-bedside": {"ro":[599.0,"tonstad-noptiera-frnr-stjr-80489322"],"gb":[110.0,"tonstad-bedside-table-oak-veneer-80489322"],"de":[119.0,"tonstad-ablagetisch-eichenfurnier-80489322"],"es":[119.0,"tonstad-mesita-noche-chapa-roble-80489322"],"it":[115.0,"tonstad-comodino-impiallacciatura-di-rovere-80489322"],"us":[149.99,"tonstad-nightstand-oak-veneer-80489322"]},
    "tonstad-chest": {"ro":[1599.0,"tonstad-comoda-6-sertare-frnr-stjr-50614624"],"gb":[299.0,"tonstad-chest-of-6-drawers-oak-veneer-50614624"],"de":[349.0,"tonstad-kommode-mit-6-schubladen-eichenfurnier-50614624"],"es":[299.0,"tonstad-comoda-6-cajones-chapa-roble-50614624"],"it":[349.0,"tonstad-cassettiera-con-6-cassetti-impiallacciatura-di-rovere-50614624"]},
    "tonstad-desk": {"ro":[1199.0,"tonstad-birou-frnr-stjr-30538198"],"gb":[199.0,"tonstad-desk-oak-veneer-30538198"],"de":[229.0,"tonstad-schreibtisch-eichenfurnier-30538198"],"es":[209.0,"tonstad-escritorio-chapa-roble-30538198"],"it":[229.0,"tonstad-scrivania-impiallacciatura-di-rovere-30538198"],"us":[329.99,"tonstad-desk-oak-veneer-30538198"]},
    "tertial": {"ro":[79.9,"tertial-veioza-birou-gri-inchis-50355395"],"de":[14.99,"tertial-arbeitsleuchte-dunkelgrau-50355395"],"es":[9.99,"tertial-lampara-flexo-trabajo-gris-oscuro-50355395"],"it":[13.0,"tertial-lampada-da-lavoro-grigio-scuro-50355395"]},
    "pax": {"ro":[1750.0,"pax-dulap-alb-s49502632"],"gb":[340.0,"pax-wardrobe-white-s49502632"],"de":[347.0,"pax-kleiderschrank-weiss-s49502632"],"es":[354.0,"pax-armario-blanco-s49502632"],"it":[375.0,"pax-guardaroba-bianco-s49502632"]},
    "radmanso": {"ro":[1199.0,"radmansoe-comoda-6-sertare-maro-aspect-nuc-90593605"],"gb":[249.0,"radmansoe-chest-of-6-drawers-brown-walnut-effect-90593605"],"de":[249.0,"radmansoe-kommode-mit-6-schubladen-braun-nussbaumnachbildung-90593605"],"es":[249.0,"radmanso-comoda-6-cajones-marron-efecto-nogal-90593605"],"it":[249.0,"radmansoe-cassettiera-con-6-cassetti-marrone-effetto-noce-90593605"]},
    "angsjon-vanity": {"de":[789.0,"aengsjoen-backsjoen-waschbeckenschrank-waschbecken-eichenachbildung-weiss-marmoriert-s99629619"],"es":[696.0,"angsjon-backsjon-mueble-lavabo-lavabo-efecto-roble-blanco-efecto-marmol-s99629619"],"it":[724.0,"aengsjoen-backsjoen-mobile-per-lavabo-lavabi-effetto-rovere-bianco-effetto-marmo-s99629619"]},
    "angsjon-tall": {"de":[399.0,"aengsjoen-hochschrank-mit-tueren-schubladen-hochglanz-weiss-20553165"],"it":[369.0,"aengsjoen-mobile-alto-con-ante-cassetti-lucido-bianco-20553165"]},
    "nammaro-lounger": {"ro":[968.0,"naemmaroe-sezlong-exterior-maro-deschis-vopsit-froesoen-duvholmen-bej-s49533898"],"de":[198.99,"naemmaroe-sonnenliege-fuer-draussen-hellbraun-lasiert-froesoen-duvholmen-beige-s49533898"],"es":[204.0,"nammaro-tumbona-exterior-tinte-marron-claro-froson-duvholmen-beige-s49533898"],"it":[199.0,"naemmaroe-lettino-da-esterno-mordente-marrone-chiaro-froesoen-duvholmen-beige-s49533898"]},
    "tarno-set": {"ro":[299.0,"taernoe-masa-2-scaune-exterior-negru-maro-deschis-vopsit-s69898415"],"gb":[50.0,"taernoe-table-2-chairs-outdoor-black-light-brown-stained-s69898415"],"de":[59.99,"taernoe-tisch-2-stuehle-aussen-schwarz-hellbraun-lasiert-s69898415"],"es":[50.0,"tarno-mesa-con-2-sillas-exterior-negro-tinte-marron-claro-s69898415"],"it":[59.85,"taernoe-tavolo-2-sedie-da-giardino-nero-mordente-marrone-chiaro-s69898415"],"us":[99.99,"taernoe-table-2-chairs-outdoor-black-light-brown-stained-s69898415"]},
    "mabarsbuske-pot": {"ro":[149.0,"mabaersbuske-ghiveci-exterior-bej-inchis-90630429"],"gb":[25.0,"mabaersbuske-plant-pot-outdoor-dark-beige-90630429"],"de":[24.99,"mabaersbuske-blumentopf-fuer-draussen-dunkelbeige-90630429"],"es":[22.99,"mabarsbuske-maceta-exterior-beige-oscuro-90630429"],"it":[29.95,"mabaersbuske-vaso-da-esterno-beige-scuro-90630429"],"us":[29.99,"mabaersbuske-plant-pot-outdoor-dark-beige-90630429"]},
    "bronden-rug": {"es":[399.0,"bronden-alfombra-pelo-corto-mano-beige-70532972"],"it":[399.0,"broenden-tappeto-pelo-corto-fatto-a-mano-beige-70532972"],"us":[499.99,"broenden-rug-low-pile-handmade-beige-70532972"]},
    "stoense-rug": {"ro":[699.0,"stoense-covor-fir-scurt-alb-murdar-20426808"],"gb":[129.0,"stoense-rug-low-pile-off-white-20426808"],"de":[139.0,"stoense-teppich-kurzflor-elfenbeinweiss-20426808"],"es":[129.0,"stoense-alfombra-pelo-corto-hueso-20426808"],"it":[149.0,"stoense-tappeto-pelo-corto-bianco-sporco-20426808"]},
    "lohals-rug": {"ro":[449.0,"lohals-covor-tesatura-plata-natur-50277393"],"gb":[129.0,"lohals-rug-flatwoven-natural-50277393"],"de":[89.99,"lohals-teppich-flach-gewebt-natur-50277393"],"es":[69.99,"lohals-alfombra-natural-50277393"],"it":[99.0,"lohals-tappeto-tessitura-piatta-naturale-50277393"],"us":[129.99,"lohals-rug-flatwoven-natural-50277393"]},
    "stoense-round": {"ro":[249.0,"stoense-covor-fir-scurt-alb-murdar-70426801"],"gb":[45.0,"stoense-rug-low-pile-off-white-70426801"],"de":[49.99,"stoense-teppich-kurzflor-elfenbeinweiss-70426801"],"es":[34.99,"stoense-alfombra-pelo-corto-hueso-70426801"],"it":[49.95,"stoense-tappeto-pelo-corto-bianco-sporco-70426801"]},
    "tversted-rug": {"ro":[999.0,"tversted-covor-fir-scurt-bej-20560806"],"gb":[129,"tversted-rug-low-pile-beige-20560806"],"de":[149,"tversted-teppich-kurzflor-beige-20560806"],"es":[169.0,"tversted-alfombra-pelo-corto-beige-20560806"],"it":[119,"tversted-tappeto-pelo-corto-beige-20560806"],"us":[249.99,"tversted-rug-low-pile-beige-20560806"]},
    "vandplats-rug": {"gb":[79.0,"vaendplats-rug-low-pile-multicolour-stripe-40600934"],"de":[79.99,"vaendplats-teppich-kurzflor-bunt-streifen-40600934"],"it":[79.95,"vaendplats-tappeto-pelo-corto-fantasia-a-righe-40600934"]},
    "undervisning-rug": {"ro":[1399.0,"undervisning-covor-fir-scurt-alb-murdar-negru-lucrat-manual-50560065"],"gb":[249.0,"undervisning-rug-low-pile-off-white-black-handmade-50560065"],"de":[249.0,"undervisning-teppich-kurzflor-elfenbeinweiss-schwarz-handarbeit-50560065"],"es":[249.0,"undervisning-alfombra-pelo-corto-hueso-negro-a-mano-50560065"],"it":[249.0,"undervisning-tappeto-pelo-corto-bianco-sporco-nero-fatto-a-mano-50560065"],"us":[299.99,"undervisning-rug-low-pile-off-white-black-handmade-50560065"]},
    "ikea-ps-rug": {"ro":[899.0,"ikea-ps-2026-covor-fir-scurt-alb-murdar-rosu-10619402"],"gb":[159.0,"ikea-ps-2026-rug-low-pile-off-white-red-10619402"],"de":[149.0,"ikea-ps-2026-teppich-kurzflor-elfenbeinweiss-rot-10619402"],"es":[179.0,"ikea-ps-2026-alfombra-pelo-corto-hueso-rojo-10619402"],"it":[179.0,"ikea-ps-2026-tappeto-pelo-corto-bianco-sporco-rosso-10619402"],"us":[199.99,"ikea-ps-2026-rug-low-pile-off-white-red-10619402"]},
    "koldby-hide": {"ro":[1499.0,"koldby-piele-de-vaca-maro-40222933"],"gb":[199.0,"koldby-cow-hide-brown-40222933"],"de":[199.0,"koldby-kuhfell-braun-40222933"],"es":[249.0,"koldby-piel-vaca-marron-40222933"],"it":[199.0,"koldby-pelle-di-mucca-marrone-40222933"],"us":[229.99,"koldby-cowhide-brown-40222933"]},
    "jarnvag-rug": {"ro":[529.0,"jaernvaeg-covor-fir-scurt-model-decorativ-roz-bej-20595698"],"gb":[99.0,"jaernvaeg-rug-low-pile-ornament-pattern-pink-beige-20595698"],"de":[89.99,"jaernvaeg-teppich-kurzflor-ornamente-rosa-beige-20595698"],"es":[89.99,"jarnvag-alfombra-pelo-corto-motivo-decorativo-rosa-beige-20595698"],"it":[99.0,"jaernvaeg-tappeto-pelo-corto-motivo-decorativo-rosa-beige-20595698"],"us":[129.99,"jaernvaeg-rug-low-pile-ornament-pattern-pink-beige-20595698"]},
    "jarnvag-round": {},
    "onsevig-rug": {"ro":[399.0,"onsevig-covor-fir-scurt-multicolor-60497078"],"gb":[79.0,"onsevig-rug-low-pile-multicolour-60497078"],"de":[89.99,"onsevig-teppich-kurzflor-bunt-60497078"],"es":[79.99,"onsevig-alfombra-pelo-corto-multicolor-60497078"],"it":[99.0,"onsevig-tappeto-pelo-corto-fantasia-60497078"],"us":[149.99,"onsevig-rug-low-pile-multicolor-60497078"]},
    "busenkel-rug": {"ro":[299.0,"busenkel-covor-model-arlechin-multicolor-60520427"],"gb":[50.0,"busenkel-rug-harlequin-pattern-multicolour-60520427"],"de":[49.99,"busenkel-teppich-harlekinmuster-bunt-60520427"],"es":[69.99,"busenkel-alfombra-rombo-multicolor-60520427"],"it":[59.95,"busenkel-tappeto-arlecchino-fantasia-60520427"],"us":[89.99,"busenkel-rug-harlequin-pattern-multicolor-60520427"]},
    "engelsborg-rug": {"de":[169.0,"engelsborg-teppich-kurzflor-beige-20482125"],"us":[249.99,"engelsborg-rug-low-pile-beige-20482125"]},
    "markblamme-rug": {"ro":[699.0,"markblamme-covor-fir-scurt-multicolor-carouri-90625705"],"gb":[129.0,"markblamme-rug-low-pile-multicolour-check-pattern-90625705"],"de":[129.0,"markblamme-teppich-kurzflor-bunt-karos-90625705"],"es":[99.99,"markblamme-alfombra-pelo-corto-multicolor-a-cuadros-90625705"],"it":[99.0,"markblamme-tappeto-pelo-corto-fantasia-a-quadri-90625705"],"us":[149.99,"markblamme-rug-low-pile-multicolor-check-pattern-90625705"]},
    "stockholm-rug": {"ro":[1299.0,"stockholm-2025-covor-tesatura-plata-alb-maro-bleu-tesut-manual-40593815"],"gb":[225.0,"stockholm-2025-rug-flatwoven-white-brown-light-blue-handwoven-40593815"],"de":[249.0,"stockholm-2025-teppich-flach-gewebt-weiss-braun-hellblau-handgewebt-40593815"],"es":[249.0,"stockholm-2025-alfombra-blanco-marron-azul-claro-tejido-mano-40593815"],"it":[249.0,"stockholm-2025-tappeto-tessitura-piatta-bianco-marrone-azzurro-tessuto-a-mano-40593815"],"us":[399.99,"stockholm-2025-rug-flatwoven-white-brown-light-blue-handwoven-40593815"]},
    "raklev-rug": {"ro":[549.0,"raklev-covor-tesatura-plata-tesut-manual-natur-multicolor-80610889"],"gb":[89.0,"raklev-rug-flatwoven-handwoven-natural-multicolour-80610889"],"de":[99.99,"raklev-teppich-flach-gewebt-handgewebt-natur-bunt-80610889"],"es":[99.99,"raklev-alfombra-tejido-mano-natural-multicolor-80610889"],"it":[99.0,"raklev-tappeto-tessitura-piatta-tessuto-a-mano-naturale-fantasia-80610889"]},
    "brevbarare-rug": {"ro":[649.0,"brevbaerare-covor-fir-lung-maro-inchis-00632121"],"gb":[129.0,"brevbaerare-rug-high-pile-deep-brown-00632121"],"de":[99.99,"brevbaerare-teppich-langflor-tiefbraun-00632121"],"es":[129.0,"brevbarare-alfombra-pelo-largo-marron-intenso-00632121"],"it":[129.0,"brevbaerare-tappeto-pelo-lungo-marrone-intenso-00632121"],"us":[149.99,"brevbaerare-rug-high-pile-deep-brown-00632121"]},
    "blaljus-rug": {"ro":[899.0,"blaljus-covor-tesatura-plata-tesut-manual-natur-gri-maro-caro-30595706"],"gb":[149.0,"blaljus-rug-flatwoven-handwoven-natural-grey-brown-check-30595706"],"de":[179.0,"blaljus-teppich-flach-gewebt-handgewebt-natur-grau-braun-karo-30595706"],"es":[199.0,"blaljus-alfombra-tejido-mano-natural-marron-grisaceo-cuadros-30595706"],"it":[179.0,"blaljus-tappeto-tessitura-piatta-tessuto-a-mano-naturale-grigio-marrone-a-quadri-30595706"]},
    "strelitzia": {"ro":[299.0,"strelitzia-planta-naturala-strelizia-nikolai-20466253"],"gb":[59.0,"strelitzia-potted-plant-bird-of-paradise-20466253"],"de":[39.99,"strelitzia-pflanze-strelitzie-20466253"],"es":[59.99,"strelitzia-planta-ave-paraiso-20466253"],"it":[45.0,"strelitzia-pianta-da-vaso-uccello-del-paradiso-20466253"]},
    "pachira": {"ro":[299.0,"pachira-aquatica-planta-naturala-arborele-norocos-00118523"],"de":[39.99,"pachira-aquatica-pflanze-glueckskastanie-00118523"],"es":[39.99,"pachira-aquatica-planta-pachira-00118523"],"it":[39.95,"pachira-aquatica-pianta-da-vaso-pachira-00118523"]},
    "monstera": {"ro":[99.9,"monstera-planta-naturala-planta-30349490"],"gb":[19.0,"monstera-potted-plant-swiss-cheese-plant-30349490"],"de":[14.99,"monstera-pflanze-fensterblatt-30349490"],"es":[19.99,"monstera-planta-ceriman-30349490"],"it":[17.0,"monstera-pianta-da-vaso-pianta-del-formaggio-svizzero-30349490"]},
    "calathea": {"ro":[89.9,"calathea-planta-naturala-calathea-asortate-10258829"],"gb":[15.0,"calathea-potted-plant-calathea-assorted-10258829"],"de":[19.99,"calathea-pflanze-korbmarante-versch-arten-10258829"],"es":[24.99,"calathea-planta-calatea-mezcla-especies-plantas-10258829"],"it":[15.0,"calathea-pianta-da-vaso-calathea-specie-varie-10258829"]},
    "anthurium": {"ro":[39.9,"anthurium-planta-naturala-floarea-flamingo-20444906"],"gb":[7.0,"anthurium-potted-plant-flamingo-plant-20444906"],"de":[6.99,"anthurium-pflanze-flamingoblume-20444906"],"es":[7.99,"anthurium-planta-anturium-20444906"],"it":[7.95,"anthurium-pianta-da-vaso-pianta-delle-aracee-20444906"]},
    "nephrolepis": {"ro":[6.9,"nephrolepis-planta-naturala-feriga-de-camera-00630773"],"gb":[1.25,"nephrolepis-potted-plant-boston-fern-00630773"],"de":[1.3,"nephrolepis-pflanze-farn-00630773"],"es":[1.49,"nephrolepis-planta-helecho-00630773"],"it":[1.5,"nephrolepis-pianta-da-vaso-nephrolepis-exaltata-00630773"]},
    "valtorp-bench": {"ro":[799.0,"valtorp-banca-cu-depozitare-samsala-galben-verde-inchis-40570239"],"de":[149.0,"valtorp-bank-mit-stauraum-samsala-dunkelgelbgruen-40570239"],"es":[169.0,"valtorp-banco-con-almacenaje-samsala-verde-amarillo-oscuro-40570239"],"it":[159.0,"valtorp-panca-con-contenitore-samsala-giallo-scuro-verde-40570239"]},
    "ragrund-bench": {"ro":[249.0,"ragrund-banca-bambus-60549416"],"gb":[40.0,"ragrund-bench-bamboo-60549416"],"de":[49.99,"ragrund-bank-bambus-60549416"],"es":[59.99,"ragrund-banco-bambu-60549416"],"it":[59.95,"ragrund-panca-bambu-60549416"]},
    "enhet-mirror": {"gb":[95.0,"enhet-mirror-cabinet-with-doors-white-80623047"],"de":[89.99,"enhet-spiegelschrank-mit-tueren-weiss-80623047"],"es":[99.0,"enhet-armario-espejo-con-puertas-blanco-80623047"],"it":[99.0,"enhet-mobile-a-specchio-con-ante-bianco-80623047"]},
    "stegesund-ladder": {"ro":[99.9,"stegesund-suport-prosoape-bambus-deschis-80632023"],"de":[19.99,"stegesund-handtuchstaender-bambus-hell-80632023"],"es":[19.99,"stegesund-toallero-bambu-claro-80632023"],"it":[19.95,"stegesund-portasciugamani-da-terra-bambu-chiaro-80632023"],"us":[39.99,"stegesund-towel-stand-light-bamboo-80632023"]},
    "uddarp-washer": {"ro":[1899.0,"uddarp-masina-de-spalat-ikea-300-60523765"],"de":[299.0,"uddarp-waschmaschine-ikea-300-60523765"],"es":[349.0,"uddarp-lavadora-ikea-300-60523765"],"it":[299.0,"uddarp-lavatrice-ikea-300-60523765"]},
    "branas-basket": {"ro":[199.9,"branaes-cos-rufe-cu-captuseala-ratan-20214731"],"gb":[50.0,"branaes-laundry-basket-with-lining-rattan-20214731"],"de":[44.99,"branaes-waeschekorb-gefuettert-rattan-20214731"],"es":[49.99,"branas-cesto-ropa-forrado-ratan-20214731"],"it":[49.95,"branaes-cesta-per-bucato-rivestita-rattan-20214731"]},
    "arstid-lamp": {"ro":[119.9,"arstid-veioza-alama-alb-30321373"],"de":[19.99,"arstid-tischleuchte-messing-weiss-30321373"],"es":[29.99,"arstid-lampara-mesa-laton-blanco-30321373"],"it":[29.95,"arstid-lampada-da-tavolo-ottone-bianco-30321373"]},
    "uppvind-lamp": {"it":[109.0,"uppvind-lampada-da-terra-ottonato-bianco-50483152"]},
    "lauters-lamp": {"ro":[349.0,"lauters-lampadar-frasin-alb-30405042"],"de":[59.99,"lauters-standleuchte-esche-weiss-30405042"],"es":[59.99,"lauters-lampara-pie-fresno-blanco-30405042"],"it":[59.95,"lauters-lampada-da-terra-frassino-bianco-30405042"]},
    "blidvader-lamp": {"ro":[199.9,"blidvaeder-veioza-alb-murdar-ceramica-bej-80501258"],"de":[59.99,"blidvaeder-tischleuchte-elfenbeinweiss-keramik-beige-80501258"],"es":[39.99,"blidvader-lampara-mesa-hueso-ceramica-beige-80501258"],"it":[59.95,"blidvaeder-lampada-da-tavolo-bianco-sporco-ceramica-beige-80501258"]},
    "dytag-curtains": {},
    "fenomen-candles": {"gb":[2.0,"fenomen-unscented-pillar-candle-natural-80528413"],"de":[1.99,"fenomen-blockkerze-duftneutral-naturfarben-80528413"],"es":[3.99,"fenomen-vela-gruesa-sin-perfumar-natural-80528413"],"it":[3.95,"fenomen-cero-senza-profumo-naturale-80528413"],"us":[7.99,"fenomen-unscented-pillar-candle-natural-80528413"]},
    "frovaxt-vase": {"ro":[39.9,"froevaext-vaza-alb-60591919"],"gb":[6.0,"froevaext-vase-white-60591919"],"de":[6.99,"froevaext-vase-weiss-60591919"],"es":[6.99,"frovaxt-florero-jarron-blanco-60591919"],"it":[7.95,"froevaext-vaso-bianco-60591919"],"us":[12.99,"froevaext-vase-white-60591919"]},
    "sockerart-vase": {"ro":[69.9,"sockeraert-vaza-cana-alb-80148465"],"gb":[12.0,"sockeraert-vase-jug-white-80148465"],"de":[14.99,"sockeraert-kanne-vase-weiss-80148465"],"es":[19.99,"sockerart-jarra-blanco-80148465"],"it":[15.0,"sockeraert-brocca-bianco-80148465"],"us":[19.99,"sockeraert-vase-jug-white-80148465"]},
    "hultet-dish": {"ro":[24.9,"hultet-platou-decorativ-bambus-40065160"],"gb":[5.0,"hultet-decoration-dish-bamboo-40065160"],"de":[4.99,"hultet-dekoschale-bambus-40065160"],"es":[4.99,"hultet-plato-decorativo-bambu-40065160"],"it":[4.95,"hultet-piatto-decorativo-bambu-40065160"]},
    "rodalm-small": {"ro":[14.9,"roedalm-rama-negru-10548867"],"gb":[3.0,"roedalm-frame-black-10548867"],"de":[2.99,"roedalm-rahmen-schwarz-10548867"],"es":[2.99,"rodalm-marco-negro-10548867"],"it":[3.95,"roedalm-cornice-nero-10548867"],"us":[5.99,"roedalm-frame-black-10548867"]},
    "fikontrad-frame": {"ro":[7.9,"fikontraed-rama-alb-60518716"],"gb":[1.5,"fikontraed-frame-white-60518716"],"de":[1.99,"fikontraed-rahmen-weiss-60518716"],"es":[1.99,"fikontrad-marco-blanco-60518716"],"it":[1.95,"fikontraed-cornice-bianco-60518716"],"us":[2.99,"fikontraed-frame-white-60518716"]},
    "branas-lid": {"ro":[89.9,"branaes-cos-ratan-00138432"],"gb":[15.0,"branaes-basket-rattan-00138432"],"de":[17.99,"branaes-korb-rattan-00138432"],"es":[18.99,"branas-cesta-ratan-00138432"],"it":[14.95,"branaes-cestino-rattan-00138432"],"us":[24.99,"branaes-basket-rattan-00138432"]},
    "rodalm-oak": {"ro":[89.9,"roedalm-rama-aspect-stejar-60566401"],"gb":[17.0,"roedalm-frame-oak-effect-60566401"],"de":[15.99,"roedalm-rahmen-eichenachbildung-60566401"],"es":[17.99,"rodalm-marco-efecto-roble-60566401"],"it":[23.0,"roedalm-cornice-effetto-rovere-60566401"],"us":[29.99,"roedalm-frame-oak-effect-60566401"]},
    "rodalm-white": {"ro":[34.9,"roedalm-rama-alb-40548922"],"gb":[7.0,"roedalm-frame-white-40548922"],"de":[6.99,"roedalm-rahmen-weiss-40548922"],"es":[6.99,"rodalm-marco-blanco-40548922"],"it":[8.95,"roedalm-cornice-bianco-40548922"]},
    "tromma": {"ro":[12.9,"tromma-ceas-perete-alb-30557078"],"gb":[2.0,"tromma-wall-clock-white-30557078"],"de":[2.0,"tromma-wanduhr-weiss-30557078"],"es":[2.49,"tromma-reloj-pared-blanco-30557078"],"it":[2.5,"tromma-orologio-da-parete-bianco-30557078"],"us":[4.99,"tromma-wall-clock-white-30557078"]},
  };

  const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const code = LIST[saved()] ? saved() : "fr";
  const here = { code, ...LIST[code] };
  const formats = new Map();
  function money(n, estimate = false) {
    const whole = Number.isInteger(Math.round(n * 100) / 100);
    const key = whole ? "w" : "f";
    if (!formats.has(key)) formats.set(key, new Intl.NumberFormat(typeof I18N !== "undefined" && I18N.lang === "fr" ? "fr-FR" : here.locale, {
      style: "currency", currency: here.currency, currencyDisplay: "narrowSymbol",
      minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
    }));
    return (estimate ? "≈ " : "") + formats.get(key).format(n);
  }
  // A converted price, rounded the way shops price things
  const convert = (eur) => {
    const v = eur * here.rate;
    return v >= 100 ? Math.round(v) : Math.round(v * 100) / 100;
  };

  // Point every product at this country's shop, in its currency
  function apply(items) {
    if (code === "fr") return;
    items.forEach((p) => {
      if (p.own || p.structure || !p.price) return;
      if (p.store === "IKEA") {
        const local = IKEA[p.id]?.[code];
        if (local) {
          p.price = local[0];
          p.url = `https://www.ikea.com/${here.ikea}/p/${local[1]}/`;
          return;
        }
        const words = p.product.split(" "), lead = [];
        for (const w of words) { if (/^[A-ZÅÄÖÜ]{2,}$|^\d{4}$/.test(w)) lead.push(w); else break; }   // "STOCKHOLM 2025", "BILLY"
        const name = lead.join(" ") || words[0];
        p.url = `https://www.ikea.com/${here.ikea}/search/?q=${encodeURIComponent(name)}`;
        p.notHere = true;
      }
      p.price = convert(p.price);
      p.estimate = true;
    });
  }

  function set(next) {
    if (!LIST[next] || next === code) return;
    try { localStorage.setItem(KEY, next); } catch {}
    location.reload();
  }

  // The picker beside the account button: a pill that opens a list of countries (a listbox: arrows, Enter, Escape)
  const GLOBE = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`;
  const CHEVRON = `<svg class="icon chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const CHECK = `<svg class="icon region-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
  const symbol = (r) => new Intl.NumberFormat(r.locale, { style: "currency", currency: r.currency, currencyDisplay: "narrowSymbol" })
    .formatToParts(1).find((x) => x.type === "currency").value;
  function addPicker() {
    const spot = document.querySelector(".nav-actions");
    if (!spot || document.querySelector(".region-pick")) return;
    const wrap = document.createElement("div");
    wrap.className = "region-pick";
    const keys = Object.keys(LIST);
    wrap.innerHTML = `
      <button type="button" class="region-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="region-list"
        aria-label="Shop in ${here.name}. Change the country for prices and shop links" title="Where you shop">
        ${GLOBE}<span class="region-code">${code.toUpperCase()}</span>${CHEVRON}
      </button>
      <div class="region-menu" hidden>
        <p class="region-head"><strong>Where you shop</strong><span>Prices and shop links follow the country</span></p>
        <ul class="region-list" id="region-list" role="listbox" aria-label="Country" tabindex="-1">
          ${keys.map((k) => { const r = LIST[k]; return `
          <li role="option" id="region-${k}" data-region="${k}" aria-selected="${k === code}" class="region-option">
            <span class="region-badge" aria-hidden="true">${k.toUpperCase()}</span>
            <span class="region-name">${r.name}<small>${r.currency}</small></span>
            <span class="region-cur" aria-hidden="true">${symbol(r)}</span>${CHECK}
          </li>`; }).join("")}
        </ul>
      </div>`;
    const btn = wrap.querySelector(".region-btn"), menu = wrap.querySelector(".region-menu"), list = wrap.querySelector(".region-list");
    const opts = [...list.querySelectorAll("[role=option]")];
    let active = keys.indexOf(code);
    const mark = (i) => {
      active = (i + opts.length) % opts.length;
      opts.forEach((o, j) => o.classList.toggle("is-active", j === active));
      list.setAttribute("aria-activedescendant", opts[active].id);
      opts[active].scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      menu.hidden = false; btn.setAttribute("aria-expanded", "true");
      mark(keys.indexOf(code)); list.focus();
      document.addEventListener("pointerdown", outside, true);
    };
    const close = (refocus = true) => {
      menu.hidden = true; btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", outside, true);
      if (refocus) btn.focus();
    };
    const outside = (e) => { if (!wrap.contains(e.target)) close(false); };
    const choose = (k) => { close(); if (k !== code) set(k); };
    btn.addEventListener("click", () => (menu.hidden ? open() : close()));
    btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
    list.addEventListener("click", (e) => { const o = e.target.closest("[data-region]"); if (o) choose(o.dataset.region); });
    list.addEventListener("pointermove", (e) => { const o = e.target.closest("[data-region]"); if (o) mark(opts.indexOf(o)); });
    list.addEventListener("keydown", (e) => {
      const go = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: opts.length - 1 }[e.key];
      if (go !== undefined) { e.preventDefault(); mark(go); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(keys[active]); }
      else if (e.key === "Escape" || e.key === "Tab") { if (e.key === "Escape") e.preventDefault(); close(e.key === "Escape"); }
    });
    spot.before(wrap);                                // like the theme button: stays visible when the menu folds away on phones
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addPicker); else addPicker();

  return { LIST, here, money, convert, apply, set };
})();
