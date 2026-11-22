<div align="center">

<img src="assets/logo.svg" alt="" width="72">

# Atelier

**Planificateur d'intérieur 3D, directement dans le navigateur**

Dessiner ses pièces à leurs vraies dimensions · les meubler avec de vrais produits · s'y promener en 3D

### [→ Ouvrir le site : suirado.github.io/atelier](https://suirado.github.io/atelier/)

*Bouton « Essayer maintenant, sans compte » : on entre directement dans un appartement meublé.*

</div>

---

## Le projet en bref

Atelier est un planificateur d'intérieur qui fonctionne **entièrement dans le navigateur**, sans rien
installer et sans serveur. On trace ses pièces, on choisit parmi une centaine de meubles réels
(IKEA, Leroy Merlin…) et on visite le résultat en 3D. La liste de courses, le budget et les
quantités de matériaux se calculent tout seuls.

C'est un projet personnel, réalisé pour apprendre le développement web, la 3D et Python,
et présenté dans le cadre de ma candidature en **licence informatique**.

| | |
|---|---|
| **Langues** | français (par défaut) et anglais, bouton **FR / EN** en haut de chaque page |
| **Appareils** | ordinateur et téléphone, mode clair et sombre, utilisable au clavier |
| **Installation** | aucune : le site tourne dans le navigateur |

---

## Fonctionnalités

| | Fonctionnalité | En pratique |
|:-:|---|---|
| 📐 | **Plan 2D et vue 3D synchronisés** | on déplace un meuble dans l'un, il bouge dans l'autre |
| ✏️ | **Dessin des pièces** | à la souris, ou en décalquant une photo de son plan mise à l'échelle |
| 🛋️ | **Catalogue de ~100 produits réels** | modèles 3D, dimensions exactes, couleurs, prix et lien vers le magasin |
| 🚶 | **Vérification de l'espace** | passages de moins de 60 cm, portes bloquées, lit collé au mur… |
| 🪟 | **Rideaux sur mesure** | ils s'accrochent à une fenêtre et la suivent quand elle bouge |
| ☀️ | **Lumière du jour** | selon l'heure et l'orientation ; les lampes s'allument le soir |
| 🧾 | **Liste de courses en PDF** | une section par magasin, à cocher en boutique |
| 🐍 | **Calcul des matériaux en Python** | peinture, parquet, plinthes, calculés par Python dans la page |
| 🔗 | **Partage par lien** | tout le plan tient dans l'adresse ; on le visite en 3D et on peut le copier |

---

## Comment c'est construit

```
 Navigateur
 ├── HTML / CSS ............ les pages, sans framework ni étape de compilation
 ├── JavaScript ............ l'éditeur, le plan 2D, les comptes, le partage, la traduction
 │    └── Three.js ......... le rendu 3D (murs découpés, ombres, matériaux réalistes)
 └── Python (Pyodide) ...... tools/materials.py, exécuté directement dans la page

 Stockage : localStorage et IndexedDB, dans le navigateur. Aucun serveur, aucune base de données :
 c'est ce qui permet d'héberger le site gratuitement sur GitHub Pages.
```

### Quelques problèmes intéressants

| Problème | Solution |
|---|---|
| Stocker des mots de passe sans serveur | seul un hachage **PBKDF2-SHA-256** salé (150 000 itérations) est gardé, jamais le mot de passe |
| Partager un plan sans serveur | le plan est compressé (*deflate*) puis encodé dans le lien : ~1 500 caractères pour 5 pièces |
| Savoir si on peut circuler | les pièces ouvertes l'une sur l'autre forment un seul espace (**union-find**), puis on mesure l'écart entre les meubles |
| Distinguer « la fenêtre a bougé » de « le rideau a bougé » | chaque rideau garde l'identifiant de sa fenêtre et compare sa position à la précédente |
| Traduire tout le site sans framework | un dictionnaire et un `MutationObserver` qui traduit chaque texte dès qu'il apparaît |
| Mettre une photo de plan à l'échelle | facteur `longueur réelle / longueur tracée` appliqué à toute l'image |

---

## Organisation des fichiers

```
atelier/
├── index.html ............... page d'accueil
├── projects.html ............ « Mes projets »
├── project.html ............. l'éditeur (plan 2D + vue 3D)
├── view.html ................ un plan partagé, en lecture seule
├── login.html, signup.html .. connexion et inscription
├── legal.html ............... confidentialité, conditions, crédits
│
├── js/
│   ├── planner3d.js ......... le rendu 3D
│   ├── editor.js ............ l'éditeur : outils, plan 2D, annuler / rétablir
│   ├── catalog.js ........... produits, pièces et logements d'exemple
│   ├── space-check.js ....... vérification des passages
│   ├── share.js ............. lien de partage compressé
│   ├── account.js ........... comptes locaux
│   └── i18n.js .............. version française (dictionnaire : i18n-fr.js)
│
├── css/ ..................... styles, thème clair / sombre
├── tools/ ................... scripts Python : matériaux, budget, contrôles du catalogue
└── assets/ .................. modèles 3D, textures, police, images
```

---

## Lancer le site sur son ordinateur

| Méthode | Comment |
|---|---|
| **En ligne** (le plus simple) | [suirado.github.io/atelier](https://suirado.github.io/atelier/) |
| **Windows** | double-cliquer sur `Ouvrir Atelier.bat`, puis ouvrir `http://localhost:5500` |
| **Autre système** | n'importe quel serveur statique, par ex. `python -m http.server 5500` |

> Ouvrir `index.html` directement par un double-clic ne suffit pas : les navigateurs bloquent
> les modules JavaScript et les modèles 3D pour les fichiers ouverts ainsi.

---

## Méthode de travail

J'ai conçu ce projet et réalisé son implémentation en **Python** et en **HTML** : l'idée, les
fonctionnalités, la structure des pages, les calculs, les logements d'exemple, et les tests
de chaque étape dans le navigateur.

Pour l'**esthétique visuelle** (couleurs, mise en page, finitions du design), je me suis servi
d'une intelligence artificielle, **Claude** (Anthropic).

---

## Crédits

- **Modèles 3D et textures** : [Poly Haven](https://polyhaven.com), licence CC0. Liste complète : `assets/models/CREDITS.txt`
- **Bibliothèques** : [Three.js](https://threejs.org) (MIT) · [jsPDF](https://github.com/parallax/jsPDF) (MIT) · [Pyodide](https://pyodide.org) (MPL 2.0)
- **Police** : Plus Jakarta Sans de Tokotype, SIL Open Font License 1.1 (`assets/fonts/OFL.txt`)
- IKEA et Leroy Merlin sont des marques de leurs propriétaires ; Atelier n'est pas affilié à ces marques.

<div align="center">

© 2026 · projet étudiant non commercial

</div>
