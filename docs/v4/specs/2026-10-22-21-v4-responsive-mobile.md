# Spec v4 — Espaces d'administration et participant utilisables sur mobile

> **Statut** : proposée — 2026-10-22 — en attente de relecture
> **Type** : refonte responsive des gabarits de navigation + corrections ciblées des composants
> **Périmètre** : v4 — espaces `/platform`, `/org/[orgId]`, `/event/[eventId]`, `/account`, pages publiques `/e/[slug]`
> **Plan** : [`plans/2026-10-22-responsive-mobile.md`](../plans/2026-10-22-responsive-mobile.md)
> **Source** : demande utilisateur du 2026-10-22 (« le panel d'administration n'est pas responsive »)

## Contexte et objectifs

Les administrateurs (staff plateforme, organisations, événements) et les participants
doivent pouvoir utiliser leur compte depuis un téléphone. Les opérateurs de scan, en
particulier, travaillent sur le terrain, téléphone en main.

Aujourd'hui, **les six gabarits d'administration** posent un menu latéral fixe de
224 px (`aside w-56 flex-none`) sans aucune variante responsive :

| Gabarit | Fichier | Espace |
|---|---|---|
| `StaffShell` | `src/components/staff/StaffShell.tsx` | `/platform` |
| `OrgShell` | `src/components/admin/OrgShell.tsx` | `/org/[orgId]` |
| `EventShell` | `src/components/event/EventShell.tsx` | `/event/[eventId]` (ADMIN / staff) |
| `EventOperatorShell` | `src/components/event/EventOperatorShell.tsx` | `/event/[eventId]` (OPERATOR) |
| `EventPrinterShell` | `src/components/event/EventPrinterShell.tsx` | `/event/[eventId]` (PRINTER) |
| `EventViewerShell` | `src/components/event/EventViewerShell.tsx` | `/event/[eventId]` (VIEWER) |

Les six reprennent le même squelette, copié-collé, avec la même structure
`flex h-screen overflow-hidden` > `aside` + colonne (bandeau facultatif, `header h-14`,
`main p-6`).

**Objectif :** à 375 px comme à 768 px, aucune page ne déborde horizontalement, la
navigation reste accessible en un geste, toutes les colonnes et actions restent
atteignables, et l'expérience bureau (≥ 1024 px) reste inchangée.

## Constat (audit du 2026-10-22)

L'audit a été mené dans le navigateur intégré, avec la base peuplée par
`make db-seed-demo`. Il combine des captures à 375 px et une mesure automatisée : chaque
page est chargée dans une iframe de largeur fixe, puis on relève la largeur de `main`,
son débordement (`scrollWidth - clientWidth`) et la largeur des tableaux. Les mesures
portent sur 33 pages d'administration et 2 pages publiques.

### 1. Menu latéral : le problème racine

| Largeur | Menu | Largeur utile de `main` | Pages qui débordent |
|---|---|---|---|
| 375 px | 224 px (60 % de l'écran) | **151 px** | 33 / 33 pages d'administration |
| 768 px | 224 px | 544 px | 0 en débordement de page, mais 4 tableaux tronqués (voir § 3) |

À 375 px, `main` déborde de 6 à 332 px selon la page. Les titres se cassent mot à mot
(« Tableau / de bord »), les cartes de statistiques sont coupées, les tableaux sont
illisibles. Le pied du menu (déconnexion, e-mail) chevauche l'indicateur de dev de Next.

En **masquant le menu** par script (simulation de la cible), la même mesure à 375 px
tombe à **0 px de débordement sur 22 pages sur 24** : le contenu des pages est déjà
largement fluide. Le gabarit concentre l'essentiel du problème.

### 2. En-têtes et bandeaux

- **En-tête** (`header h-14`) : le fil d'Ariane, le badge de rôle (« SUPER
  ADMINISTRATEUR »), le nom et l'avatar ne tiennent pas à 151 px. Ils se coupent sur
  trois lignes ou sortent du cadre. Une fois le menu retiré, ils tiennent sur deux
  lignes, ce qui reste trop chargé.
- **Bandeau « Mode staff »** (`EventShell`) : sur 151 px, la phrase s'étale sur huit
  lignes et occupe 180 px de hauteur.
- **En-tête participant** (`src/app/account/layout.tsx`) : il n'a pas de menu latéral et
  ne déborde pas, mais **le logo est écrasé à 0 px** (le lien parent se réduit, l'image
  n'a pas `flex-none`). De plus, « Mes inscriptions » et « Se déconnecter » passent sur
  deux lignes.

### 3. Tableaux : colonnes coupées sans défilement

La quasi-totalité des tableaux d'administration est enveloppée dans
`<div className="overflow-hidden rounded-xl border …">` : **18 fichiers** utilisent ce
motif. `overflow-hidden` sert à arrondir les coins, mais il **coupe silencieusement**
les colonnes qui dépassent. Elles ne sont plus atteignables, même en défilant.

Largeur des tableaux mesurée, une fois le menu masqué, à 375 px (largeur disponible :
327 px) :

| Page | Largeur du tableau | Colonnes perdues |
|---|---|---|
| `/event/[id]/registrations` | 603 px | statut, date, actions |
| `/platform/users` | 585 px | rôle, statut, actions |
| `/platform/activity` | 555 px | détails |
| `/platform/organizations` | 526 px | plan, actions |
| `/event/[id]/categories` | 492 px | actions |
| `/platform/organizations/[id]/members` | 479 px | rôle, actions |
| `/platform/plans` | 459 px | tableau **sans** enveloppe : c'est la page qui déborde (108 px) |
| `/platform/profiles` | 441 px | statut, actions |
| `/event/[id]/badges` | 402 px | actions |

À 768 px, même avec le menu, quatre tableaux sont encore tronqués :
`registrations` (603/494), `users` (585/494), `activity` (555/494) et
`organizations` (526/494).

Seul `src/components/ui/Table.tsx` prévoit un `overflow-x-auto`, et il est peu utilisé.

### 4. Composants `src/components/ui/`

| Composant | Constat |
|---|---|
| `Modal.tsx` | Largeur correcte (`w-full max-w-md`, `p-4`). En revanche : pas de hauteur max ni de défilement interne, pas de touche Échap. Il est surtout **rendu dans l'arbre du menu** via `LogoutButton` (voir arbitrage D). |
| `Dialog.tsx` | Correct (`max-h-[70vh]` + défilement, Échap, focus). Même risque de rendu dans un ancêtre transformé. |
| `Tabs.tsx` | Rangée d'onglets sans défilement horizontal. `/platform/settings` déborde de 24 px. |
| `Toolbar.tsx` / recherches | `min-w-[200px]` / `min-w-[220px]` : cela passe à 327 px, à la limite. |
| `BatchBar.tsx` | Rangée non repliable : le compteur et les boutons d'action se chevauchent sur une rangée étroite. |
| `Pagination.tsx` | Correct (`flex-wrap`). |
| `StatCard` / `StatGrid` | Correct une fois le menu retiré (`grid-cols-2` → `lg:grid-cols-*`). |
| `Card` / `CardHead` | `px-6` partout : marges généreuses sur 375 px, acceptable. |

### 5. Pages et formulaires ponctuels

- `/platform/plans` (`PlanManager`) : tableau sans enveloppe (débordement de page de
  108 px) et formulaire de création à champs de largeur fixe.
- `/org/[id]/settings` (`SettingsClient.tsx:157`) : `grid grid-cols-2` sans point de
  rupture, mais limité au couple code postal / ville. C'est acceptable à 327 px, à
  vérifier au navigateur.
- Les en-têtes de page « titre + bouton d'action » (par exemple « Utilisateurs » et
  « + Nouvel utilisateur ») tiennent sur une ligne, sans repli : le bouton sort du cadre.
- `/event/[id]/scan` (`ScannerFrame`, `QRScanner`) : largeur `w-[360px]` bornée par
  `max-w`, ce qui reste utilisable une fois le menu retiré. C'est la page **la plus
  critique en usage réel** : l'opérateur scanne au téléphone.

### 6. Ce qui va déjà bien

- Pages publiques `/e/[slug]` et `/e/[slug]/register` : aucun débordement à 375 px.
  Mise en page `max-w-[720px] px-5` saine.
- `AuthCard` (connexion, mot de passe oublié…) : correct.
- `/account`, `/account/profile`, `/account/registrations/[id]` : contenu correct
  (cartes empilées). Seul l'en-tête est à reprendre.

### Limite de l'audit

Les organisations démo n'ont **pas d'abonnement actif** : l'espace `/org/[orgId]` ne
montre, à tout rôle, que l'écran « Abonnement inactif ». Ces pages ont donc été auditées
**par le code**. Elles reprennent exactement les motifs mesurés ailleurs : même gabarit,
même enveloppe `overflow-hidden` autour des tableaux (`events`, `members`, `templates`,
`activity`). Il faudra les vérifier dans le navigateur pendant l'implémentation, après
avoir attribué un abonnement à une organisation démo.

## Décisions

### A. Navigation mobile : tiroir latéral sous 1024 px

**Options envisagées :**

| Option | Pour | Contre |
|---|---|---|
| **1. Tiroir latéral (off-canvas)** ouvert par un bouton « menu » dans l'en-tête | Réutilise **tel quel** le contenu du menu (entrées, groupes, sélecteur d'org, déconnexion). Supporte 2 comme 9 entrées. Motif connu de tous. | Un geste de plus pour changer de page. |
| 2. Barre de navigation inférieure | Accès en un geste, au pouce. | 5 entrées au maximum, alors que les espaces en ont 7 à 9 (avec un groupe « Administration »). Il faudrait un onglet « Plus » qui recrée un tiroir. Elle prend de la hauteur en permanence et entre en conflit avec la `BatchBar` et les actions de bas de formulaire. |
| 3. Menu repliable sous l'en-tête (accordéon) | Simple, sans superposition. | Il pousse le contenu vers le bas et fait sauter la page à l'ouverture. Le sélecteur d'org et la déconnexion s'y casent mal. |
| 4. Rail d'icônes (menu réduit à 56 px) | Navigation toujours visible. | 56 px restent une perte sur 375 px. Les icônes seules sont ambiguës (« Modèles catégories » ou « Catégories » ?). Il faudrait des infobulles, qui n'existent pas au toucher. |

**Décision : option 1, tiroir latéral, pour les six gabarits.** C'est la seule option qui
garde le contenu existant des menus sans réécrire l'information ni dégrader un rôle.
La barre inférieure est écartée à cause du nombre d'entrées. Elle pourra être
reconsidérée **pour le seul `EventOperatorShell`** (2 entrées : Scanner, Profil) si
l'usage terrain le réclame. Par YAGNI, ce n'est pas fait ici : le tiroir couvre aussi
ce cas.

### B. Point de rupture : `lg` (1024 px), pas `md` (768 px)

À 768 px avec le menu, il reste 544 px utiles, et quatre tableaux principaux sont encore
tronqués. Une tablette en portrait se comporte donc mieux avec le tiroir. **Menu
permanent à partir de `lg` (≥ 1024 px), tiroir en dessous.** Le bureau ne change pas,
y compris pour les e2e Playwright (projet `Desktop Chrome`, 1280 px).

### C. Une seule instance du menu dans le DOM, et un gabarit commun

Deux variantes ont été envisagées :

- (a) **dupliquer** le menu : un `aside` pour le bureau et une copie dans le tiroir ;
- (b) **un seul `aside`**, positionné en `fixed` et translaté hors écran sous `lg`, puis
  `static` à partir de `lg`.

**Décision : (b).** Une copie doublerait chaque lien dans l'arbre d'accessibilité. Les e2e
existants (`getByRole("link", { name: "Inscriptions" })`) échoueraient alors en mode
strict. Elle doublerait aussi le rendu serveur des menus.

Fermé sous `lg`, le tiroir est rendu `inert` et `invisible`. Il sort ainsi de l'ordre de
tabulation et de l'arbre d'accessibilité.

Les six gabarits dupliquent aujourd'hui le même squelette. Ajouter le tiroir six fois
multiplierait par six la logique d'état (ouverture, Échap, fermeture au changement de
route, verrouillage du défilement). **On extrait un gabarit commun `AppShell`**. Ce
composant serveur reçoit en props le contenu du menu, l'en-tête, un bandeau facultatif et
les enfants. Il délègue l'interactivité à un petit composant client
`MobileNavProvider` / `MobileNavToggle`. Chaque gabarit existant devient une fine
couche qui compose `AppShell`. Sa logique propre (filtrage par rôle, libellés) ne
bouge pas.

### D. Modales rendues dans un portail

`LogoutButton` rend son `Modal` **à l'intérieur de l'`aside`**. Un ancêtre muni d'un
`transform` (le tiroir translaté) devient le bloc conteneur des descendants
`position: fixed`. La modale de déconnexion s'afficherait alors **dans le tiroir** et non
en plein écran.

**Décision :** `Modal` et `Dialog` se rendent via `createPortal(…, document.body)`. On en
profite pour aligner `Modal` sur `Dialog` : touche Échap, `role="dialog"` et
`aria-modal`, corps défilable `max-h-[70vh]`. La correction est locale à `ui/` et
profite à toutes les modales.

### E. Tableaux : défilement horizontal partout, colonnes secondaires masquées sur les listes principales

**Options :**

| Option | Pour | Contre |
|---|---|---|
| 1. Enveloppe `overflow-x-auto` (en conservant bordure et coins arrondis) | Correction mécanique et sûre sur les 18 fichiers. Plus aucune colonne inaccessible. | Le défilement horizontal reste moins confortable qu'une vue adaptée. |
| 2. Vue en cartes sous `md` (une carte par ligne) | Meilleure lecture au téléphone. | Il faut un rendu par tableau, donc 18 vues à écrire et à tester. Les cases à cocher de sélection en lot sont plus délicates. |
| 3. Masquer les colonnes secondaires sous `md` (`hidden md:table-cell`) | Peu coûteux. Le tableau tient sans défiler. | L'information masquée doit rester accessible ailleurs, par exemple sur la page de détail. |

**Décision : 1 partout, et 3 sur les listes à fort usage mobile** : inscriptions de
l'événement, badges, utilisateurs, organisations, journaux. La colonne d'actions et
l'identifiant principal (nom) restent toujours visibles. Seules sont masquées les
colonnes dont l'information se retrouve sur la page de détail. L'option 2 est écartée
pour cette itération : son coût est disproportionné face au gain, puisque 1 + 3 rend
tout atteignable. Elle pourra revenir pour la liste des inscriptions si les retours
terrain le demandent.

L'enveloppe est factorisée dans un composant `ui/TableFrame.tsx`. Il remplace le motif
`overflow-hidden rounded-xl border` recopié dans les 18 fichiers.

### F. En-têtes compacts

- **Bouton menu** (`MobileNavToggle`, icône `menu`, `aria-label="Ouvrir le menu"`,
  cible tactile de 40 × 40 px au minimum) en tête de l'en-tête, masqué à partir de `lg`.
- **Fil d'Ariane** : seul le dernier segment s'affiche sous `sm`, tronqué
  (`truncate min-w-0`).
- **Badge de rôle et nom** : masqués sous `sm`. Seul l'avatar reste visible. Le rôle
  réapparaît en tête du tiroir.
- **Bandeau « Mode staff »** : texte court sous `sm` (« Mode staff — actions
  auditées »), texte complet au-delà.
- **`main`** : `p-4 sm:p-6`.
- **Hauteur** : `h-screen` devient `h-dvh`, pour que la barre d'adresse mobile ne masque
  pas le bas de page.

### G. Espace participant : en-tête seulement

L'espace `/account` n'a que deux entrées : on garde une navigation en ligne, sans
tiroir. Corrections : logo en `flex-none`, libellés courts sous `sm` (« Inscriptions »,
« Profil »), bouton de déconnexion réduit à l'icône sous `sm` avec `aria-label`, marges
`px-4 sm:px-6`. Les pages publiques `/e/[slug]` ne changent pas.

### H. Pas de nouvelle dépendance

Le tiroir tient en quelques dizaines de lignes : état React, `usePathname` pour fermer au
changement de route, écouteur Échap, `overflow-hidden` sur `body` pendant l'ouverture,
retour du focus sur le bouton à la fermeture. Aucune bibliothèque (Headless UI, Radix)
n'est introduite pour ce seul besoin.

## Conséquences

- Le bureau (≥ 1024 px) est inchangé visuellement. Les e2e existants (Desktop Chrome,
  1280 px) doivent rester verts sans modification.
- Les six gabarits partagent un même squelette : un futur changement de navigation ne
  se fait plus qu'à un seul endroit.
- Une colonne masquée sous `md` doit être consultable sur la page de détail. C'est un
  critère de revue de chaque tableau touché.
- Nouveau test e2e transverse à 375 px : il évite que le débordement horizontal revienne
  sans qu'on le voie.
- La checklist de recette manuelle
  ([`2026-07-22-checklist-tests-manuels-navigateur.md`](2026-07-22-checklist-tests-manuels-navigateur.md))
  vise 390 px sur les parcours marqués (M). Ces points restent valables et seront
  rejoués à 375 px.

## Hors périmètre

- Site marketing `(marketing)` : il a ses propres gabarits, non audités ici.
- Éditeur de template de badge (studio pdfStudio) : il reste un outil de bureau.
- Vue en cartes des tableaux (option E-2) et barre inférieure pour l'opérateur
  (option A-2) : reportées tant que les retours terrain ne les demandent pas.
