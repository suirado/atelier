# Atelier

Planificateur d'intérieur 3D fonctionnant entièrement dans le navigateur.

**Site en ligne : [suirado.github.io/atelier](https://suirado.github.io/atelier/)**

Le bouton « Essayer maintenant, sans compte » ouvre directement un appartement meublé, sans inscription.

---

## Présentation

Atelier permet de dessiner un logement à ses dimensions réelles, de le meubler à partir d'un
catalogue de produits existants, puis de le visiter en 3D. La liste de courses, le budget et les
quantités de matériaux sont calculés automatiquement.

Le site ne nécessite ni installation ni serveur : toutes les données restent dans le navigateur
de l'utilisateur. Il est disponible en français (langue par défaut) et en anglais.

Il s'agit d'un projet personnel, réalisé pour approfondir le développement web, la 3D et Python,
et présenté dans le cadre de ma candidature en licence informatique.

## Fonctionnalités

- **Plan 2D et vue 3D synchronisés** : une modification dans l'un est reportée dans l'autre.
- **Tracé des pièces** à la souris, ou à partir d'une photo de plan mise à l'échelle.
- **Catalogue d'environ 100 produits réels** (IKEA, Leroy Merlin…), avec modèles 3D, dimensions et prix.
- **Vérification de l'espace** : passages trop étroits, portes bloquées, mobilier mal placé.
- **Rideaux sur mesure**, rattachés à une fenêtre et ajustés automatiquement.
- **Éclairage naturel** calculé selon l'heure et l'orientation du logement.
- **Liste de courses en PDF**, organisée par magasin.
- **Calcul des matériaux en Python** (peinture, revêtement de sol, plinthes), exécuté dans la page.
- **Partage par lien**, sans serveur : le plan complet est encodé dans l'adresse.
- **Comptes utilisateurs locaux**, mode clair et sombre, navigation au clavier, version mobile.

## Choix techniques

| Domaine | Technologie |
|---|---|
| Interface | HTML, CSS et JavaScript, sans framework ni étape de compilation |
| Rendu 3D | [Three.js](https://threejs.org) |
| Calculs | Python, exécuté dans le navigateur grâce à [Pyodide](https://pyodide.org) |
| Données | `localStorage` et `IndexedDB` (aucune base de données distante) |
| Hébergement | GitHub Pages |

## Points techniques notables

**Mots de passe sans serveur.** Seul un hachage PBKDF2-SHA-256 salé (150 000 itérations, API Web
Crypto) est conservé ; le mot de passe lui-même n'est jamais stocké.

**Partage sans serveur.** Le plan est réduit à l'essentiel, compressé (*deflate*) puis encodé en
base64url dans le lien : environ 1 500 caractères pour un logement de cinq pièces.

**Vérification de la circulation.** Les pièces ouvertes l'une sur l'autre sont regroupées en un
seul espace par un algorithme *union-find*, puis l'écart entre chaque paire de meubles est mesuré.

**Rideaux liés aux fenêtres.** Chaque rideau conserve l'identifiant de sa fenêtre ; la comparaison
des positions successives permet de savoir lequel des deux a été déplacé.

**Traduction.** Un dictionnaire et un `MutationObserver` traduisent chaque texte dès son apparition,
y compris ceux générés par le JavaScript ; les nombres sont formatés selon l'usage français.

**Mise à l'échelle d'un plan.** Le rapport entre une longueur connue et la longueur tracée
sur l'image est appliqué à l'ensemble du plan importé.

## Structure du dépôt

```
index.html               page d'accueil
projects.html            liste des projets de l'utilisateur
project.html             éditeur (plan 2D et vue 3D)
view.html                plan partagé, en lecture seule
login.html, signup.html  connexion et inscription
legal.html               mentions légales, confidentialité, crédits

js/planner3d.js          rendu 3D
js/editor.js             éditeur : outils, plan 2D, historique des modifications
js/catalog.js            catalogue de produits et logements d'exemple
js/space-check.js        vérification des passages
js/share.js              lien de partage compressé
js/account.js            comptes locaux
js/i18n.js               traduction française (dictionnaire : js/i18n-fr.js)

css/                     feuilles de style
tools/                   scripts Python : matériaux, budget, contrôle du catalogue
assets/                  modèles 3D, textures, police, images
```

## Exécution en local

Le plus simple est d'utiliser la [version en ligne](https://suirado.github.io/atelier/).

- **Windows** : lancer `Ouvrir Atelier.bat`, puis ouvrir `http://localhost:5500`.
- **Autres systèmes** : tout serveur de fichiers statiques, par exemple `python -m http.server 5500`.

L'ouverture directe de `index.html` ne suffit pas : les navigateurs bloquent les modules
JavaScript et les modèles 3D pour les fichiers ouverts depuis le disque.

## Méthode de travail

J'ai conçu ce projet et réalisé son implémentation en Python et en HTML : l'idée, les
fonctionnalités, la structure des pages, les calculs, les logements d'exemple, ainsi que les
tests de chaque étape dans le navigateur.

Pour l'esthétique visuelle (couleurs, mise en page, finitions du design), je me suis appuyé
sur une intelligence artificielle, Claude (Anthropic).

## Crédits

- Modèles 3D et textures : [Poly Haven](https://polyhaven.com), licence CC0 (liste complète : `assets/models/CREDITS.txt`).
- Bibliothèques : [Three.js](https://threejs.org) (MIT), [jsPDF](https://github.com/parallax/jsPDF) (MIT), [Pyodide](https://pyodide.org) (MPL 2.0).
- Police : Plus Jakarta Sans de Tokotype, SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
- IKEA et Leroy Merlin sont des marques de leurs propriétaires respectifs ; ce projet n'est affilié à aucune d'elles.

---

© 2026 — Projet étudiant non commercial.
