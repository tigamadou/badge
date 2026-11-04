# Vague 1 — Socle du chantier « Nouvelle palette » — Plan d'implémentation

> **Exécution :** dans le **dossier principal** (pas de stack d'agent), sur la branche
> `feat/nouvelle-palette` créée depuis `development`. Toutes les commandes `make` tournent dans le
> conteneur de dev (`make dev` d'abord). En exécution automatisée, **un commit par tâche** est
> autorisé sur `feat/nouvelle-palette` ; sinon aucun commit sans demande. Message de commit en
> français ASCII, style conventional commits, sans trailer ni mention d'outil IA. Sous-agents
> éventuels sur Sonnet.
>
> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans`. Les étapes utilisent des cases `- [ ]`.

**Objectif :** poser la palette « Deep Navy & Soft Gold » dans tout ce que les lots 2a, 2b et 2c
consomment : couleurs Tailwind, constantes hexa pour le HTML en ligne, composants `ui`, coquilles
(menu latéral clair, fond blanc) et page `/styleguide`. Après ce plan, les lots n'écrivent plus
aucune couleur de marque en dur : ils appliquent la table de correspondance ci-dessous.

**Architecture :** on **ajoute** les nouvelles couleurs dans `@theme` sans retirer les anciennes
variables (`--brand-navy`, `--brand-green`, `--accent*`, `--color-brand-navy`) : les lots en
dépendent jusqu'à la vague 3. On ajoute `src/lib/brand-colors.ts` (constantes hexa) et
`src/components/layout/sidebar-classes.ts` (classes du menu clair, pour les shells des lots). Puis
on migre chaque composant `ui`, `layout`, `StaffShell`, `PlatformOrgShell` et le styleguide **par
rôle** (pas par teinte).

**Stack :** Tailwind CSS 4 (`@theme`), Next.js 16, React 19, Vitest 4 (environnement `node`,
`renderToStaticMarkup`, pas de testing-library).

**Spec :** [`../specs/2026-11-04-39-v4-nouvelle-palette.md`](../specs/2026-11-04-39-v4-nouvelle-palette.md)
(« Décisions », « Lisibilité », « Arbitrages », « Organisation du travail »).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 0 | Branche `feat/nouvelle-palette` | [x] | 2026-11-04 | |
| 1 | `globals.css` : couleurs `@theme`, focus, `.legal-prose` | [x] | 2026-11-04 | |
| 2 | `src/lib/brand-colors.ts` + tests (dont lisibilité WCAG) | [x] | 2026-11-04 | |
| 3 | `sidebar-classes.ts`, `AppShell`, `MobileNav`, `UserAvatar` (menu clair, fond blanc) | [x] | 2026-11-04 | |
| 4 | `StaffShell` et `PlatformOrgShell` | [ ] | | |
| 4b | Menu latéral clair : `SidebarNav`, `OrgShell`, shells d'évènement, `AccountNav` | [ ] | | |
| 5 | `ui` — boutons (variante `positive`), feedback, étiquettes, statuts, onglets, pagination, champs | [ ] | | |
| 6 | `ui` — reste des composants (barres, cartes, tableaux, fichiers, journal…) | [ ] | | |
| 7 | Garde-fou local du socle + mise à jour des tests existants | [ ] | | |
| 8 | `/styleguide` | [ ] | | |
| 9 | Contrôle visuel 375 / 1024 / 1280 px | [ ] | | |
| 10 | Vérification complète | [ ] | | |

## Fichiers du lot (exclusifs)

Créés : `src/lib/brand-colors.ts`, `src/lib/__tests__/brand-colors.test.ts`,
`src/components/layout/sidebar-classes.ts`, `src/components/layout/__tests__/sidebar-classes.test.ts`,
`src/components/ui/__tests__/StatusBadge.test.tsx`,
`src/components/ui/__tests__/palette-socle.test.ts`.

Ajoutés au socle (navigation partagée, arbitrage de l'agent principal ; **retirés des lots 2a et 2c**) :
`src/components/admin/SidebarNav.tsx`, `src/components/admin/OrgShell.tsx`,
`src/components/event/EventShell.tsx`, `src/components/event/EventViewerShell.tsx`,
`src/components/event/EventOperatorShell.tsx`, `src/components/event/EventPrinterShell.tsx`,
`src/components/public/AccountNav.tsx` (le fichier cité par l'arbitrage, `src/components/account/AccountNav.tsx`,
n'existe pas : la navigation du compte est `src/components/public/AccountNav.tsx`, dossier attribué au
lot 2a par la spec ; à retirer de 2a), avec leurs tests (`src/components/admin/__tests__/SidebarNav.test.tsx`,
`OrgShell.test.tsx`, `src/components/public/__tests__/AccountNav.test.tsx`, tests de shells d'évènement
s'il en existe).

Modifiés : `src/app/globals.css`, `src/components/ui/**` (sources et `__tests__`),
`src/components/layout/**` (sources et `__tests__`), `src/components/staff/StaffShell.tsx`,
`src/components/staff/__tests__/StaffShell.test.tsx`, `src/components/platform/PlatformOrgShell.tsx`,
son test s'il existe, `src/app/styleguide/**`, ce plan (Progression),
`docs/v4/specs/2026-11-04-39-v4-nouvelle-palette.md` (journal des arbitrages seulement).

**Lecture seule** : tout le reste, en particulier `src/components/auth/LogoutButton.tsx` (lot 2a :
il reçoit sa `className` du shell, rien à y changer) et `src/app/account/layout.tsx` (lot 2c : son
fond `bg-slate-50` → `bg-white` et son lien `hover:text-green-600` sont migrés par 2c).
Besoin d'y toucher → **s'arrêter et le signaler**.

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test », valables pour tout test de ce plan) :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (nom en `_test`), jamais sur la base de
  dev ; `make test` / `make test-db` la créent et la mettent au schéma ; garde-fou dans
  `src/test-setup.ts`.
- **Pas de mock de la base ni de Prisma** : MySQL réel. Seuls les services externes se mockent
  (aucun test de ce plan n'a besoin de la base : composants rendus en statique, constantes pures).
- **Fabriques** : si un test a besoin de données en base, passer par `src/test/factories.ts` ; ce
  plan n'en demande pas.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander. Les tests qui vérifient des classes en dur (`BatchBar`, `FileBox`,
  `FormControls`, `Labels`, `QuotaBar`, `RadioCards`, `StatCard`, `Tabs`, `Timeline`,
  `VerifyBanner`…) sont des **fichiers de test** : on les met à jour, c'est autorisé et attendu.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**` (gate `vitest.config.ts`) :
  `src/lib/brand-colors.ts` est couvert à 100 % (tâche 2).

Autres contraintes :

- **Couleurs seulement** : aucune structure, icône, espacement ni contenu ne change (spec §9).
  Le rouge des erreurs (`rose-*`/`red-*`) et le gris `slate` (texte, bordures) ne changent pas.
- Les anciennes variables CSS et la classe `bg-brand-navy` restent définies (les lots les utilisent
  encore) : **le socle lui-même ne les emploie plus** (garde-fou de la tâche 7).
- Données colorées (couleurs de catégories, `CatPill`, `MiniBadge`, sélecteurs de couleur du
  styleguide) : non migrées (exception de la spec).
- Bouton désactivé : opacité actuelle conservée (`disabled:opacity-50`).
- Textes UI en français avec accents ; code et identifiants en anglais ; commentaires en français
  (style du fichier).
- Aucune dépendance npm ajoutée.

## Review Focus

1. **Lisibilité (spec « Lisibilité »)** : jamais de texte blanc sur turquoise, jamais de texte or
   sur blanc ; texte de bouton turquoise = marine ; texte de succès = `turquoise-strong` ; texte
   « en attente » = `gold-strong` (tâches 2, 5).
2. **Rôle, pas teinte** : chaque ancien `green-*`/`emerald-*`/`amber-*`/`blue-*`/`indigo-*`
   est classé selon son rôle (table ci-dessous) ; relire les cas ambigus (barre de progression,
   puce de journal « système », graphique `MiniChart`).
3. **Contrat des lots** : les noms de couleurs, la variante `Button positive`, les tons `Labels`,
   `brand-colors.ts` et `sidebar-classes.ts` sont exactement ceux de ce plan (les lots les consomment).
4. **Menu clair** : lien actif = marine sur `mist` avec trait or à gauche ; focus visible sur fond
   blanc ; tiroir mobile identique (tâches 3, 9).
5. **Rien d'autre ne bouge** : diff limité aux classes de couleur (aucune classe d'espacement,
   de taille ou de structure modifiée).
6. **Anciennes variables conservées** : `globals.css` garde `--brand-navy`, `--brand-green`,
   `--accent*`, `--color-brand-navy`.

## Contrat figé pour les lots

### Couleurs Tailwind 4 déclarées dans `@theme` (`src/app/globals.css`)

| Variable | Valeur | Classes Tailwind | Usage |
|---|---|---|---|
| `--color-navy` | `#081558` | `bg-navy`, `text-navy`, `border-navy`, `ring-navy`, `bg-navy/10` | identité, bouton principal, lien, focus, fond sombre |
| `--color-navy-hover` | `#121F6E` | `hover:bg-navy-hover` | survol du bouton marine |
| `--color-gold` | `#F4B942` | `bg-gold`, `border-gold` | trait du lien actif, accent premium (trait, point, fond ; **jamais du texte sur blanc**) |
| `--color-gold-strong` | `#8A5A00` | `text-gold-strong` | texte « en attente » / mention Pro sur fond clair |
| `--color-gold-soft` | `#FFF4DC` | `bg-gold-soft` | fond « en attente » |
| `--color-turquoise` | `#16B8A6` | `bg-turquoise`, `border-turquoise` | bouton d'action positive (texte **marine**), barres/points de succès |
| `--color-turquoise-strong` | `#0E7C70` | `text-turquoise-strong`, `hover:bg-turquoise-strong` | texte de succès, survol du bouton turquoise |
| `--color-turquoise-soft` | `#E3F7F4` | `bg-turquoise-soft` | fond de succès |
| `--color-mist` | `#F5F7FC` | `bg-mist`, `hover:bg-mist` | survol, sélection, fonds internes du panel |
| `--color-line` | `#EEF1F8` | `border-line`, `bg-line` | trait fin (menu latéral, séparations publiques) |
| `--color-nav-muted` | `#5A6285` | `text-nav-muted` | liens du menu, textes secondaires du menu |
| `--color-warn` | `#C2410C` | `text-warn`, `border-warn`, `bg-warn` | texte et barres d'avertissement |
| `--color-warn-soft` | `#FFF1E6` | `bg-warn-soft` | fond d'avertissement |

`orange-700` / `orange-50` (équivalents Tailwind de `warn` / `warn-soft`) restent permis mais les
lots utilisent `warn` / `warn-soft`.

### Table « ancienne classe → nouvelle classe selon le rôle »

Les lots appliquent cette table ; en cas de doute, le rôle prime sur la teinte.

| Rôle | Ancien | Nouveau |
|---|---|---|
| Bouton principal d'une page/formulaire (Enregistrer, Créer, Envoyer, Payer) | `bg-green-600 text-white hover:bg-green-700` | `<Button>` (marine) ou `bg-navy text-white hover:bg-navy-hover` |
| Action positive sur un élément existant (Approuver, Valider, Accepter le devis, Marquer payé) | `bg-green-600 text-white hover:bg-green-700` | `<Button variant="positive">` ou `bg-turquoise text-navy hover:bg-turquoise-strong hover:text-white` |
| Bouton secondaire | `bg-slate-100 text-slate-700` | `<Button variant="secondary">` (bordure `slate-300`, texte marine) |
| Lien dans le texte | `text-green-600`, `text-blue-600`, `text-sky-600`, `text-indigo-600` (+ `hover:*-700`) | `text-navy hover:underline` |
| Lien actif / onglet actif | `border-green-600 text-green-600` | `border-navy text-navy` |
| Focus (anneau) | `focus:ring-green-500`, `focus-visible:ring-green-500` | `focus:ring-navy`, `focus-visible:ring-navy` (sur fond marine : `ring-gold`) |
| Sélection / survol de carte, zone de dépôt | `border-green-600 bg-emerald-50` | `border-navy bg-mist` |
| Case, interrupteur, étape active | `bg-green-600` / `border-green-600` | `bg-navy` / `border-navy` |
| Succès (pastille, alerte, message, delta positif) | `bg-emerald-50 text-emerald-700`, `border-emerald-200` | `bg-turquoise-soft text-turquoise-strong`, `border-turquoise/30` |
| Succès (barre, point, icône pleine) | `bg-green-500/600`, `text-green-600` | `bg-turquoise` (barre/point) ; icône sur fond clair : `text-turquoise-strong` |
| En attente (statut) | `bg-amber-50 text-amber-700` | `bg-gold-soft text-gold-strong` |
| Avertissement (alerte, quota, texte d'attention) | `bg-amber-50 text-amber-700 border-amber-200`, `text-amber-600/700`, `bg-amber-700` | `bg-warn-soft text-warn border-warn/20`, `text-warn`, `bg-warn` |
| Information | `border-blue-200 bg-blue-50 text-blue-700` | `border-line bg-mist text-navy` |
| Pastille de catégorie « modification » / accent bleu ou indigo | `bg-indigo-500/10 text-indigo-600`, `bg-sky-50 text-sky-700` | `bg-mist text-navy` |
| `teal-*` | `bg-teal-50 text-teal-700` | `bg-turquoise-soft text-turquoise-strong` |
| Marque / en-tête sombre | `bg-brand-navy`, `#004d74` | `bg-navy`, `BRAND.navy` |
| Pastille marine | `bg-brand-navy/10 text-brand-navy` | `bg-navy/10 text-navy` |
| Fond gris **panel** (en-têtes de tableau, encarts, puces d'icône, survol de ligne) | `bg-slate-50`, `bg-slate-100`, `hover:bg-slate-50/100` | `bg-mist`, `hover:bg-mist` |
| Fond gris **pages publiques** (`(marketing)`, `/e/...`, authentification) | `bg-slate-50`, `bg-slate-100` | `bg-white` + séparation `border-t border-line` |
| Fond de page du panel | `bg-slate-50` | `bg-white` |
| Menu latéral | voir `sidebar-classes.ts` | voir « Contrat menu latéral » |
| Inchangés | `rose-*`/`red-*` (erreurs), `slate-*` (texte, bordures), `border-slate-100/200/300` | — |

### API de `src/lib/brand-colors.ts`

```ts
// Valeurs hexa en ligne pour le HTML (e-mails, notifications, reçu) : les clients mail ne lisent
// pas les variables CSS. Miroir exact des couleurs @theme de globals.css (test de non-dérive).
export const BRAND = {
  navy: "#081558",
  navyHover: "#121F6E",
  gold: "#F4B942",
  goldStrong: "#8A5A00",
  goldSoft: "#FFF4DC",
  turquoise: "#16B8A6",
  turquoiseStrong: "#0E7C70",
  turquoiseSoft: "#E3F7F4",
  mist: "#F5F7FC",
  line: "#EEF1F8",
  navMuted: "#5A6285",
  warn: "#C2410C",
  warnSoft: "#FFF1E6",
} as const;
export type BrandColor = keyof typeof BRAND;
```

Une seule exportation de valeurs (`BRAND`) : pas de fonction. Le lot 2a l'importe pour `mail.ts`,
`notify.ts`, `api/contact` et `receipt.ts` (bouton `BRAND.navy`, liens `BRAND.navy`, succès
`BRAND.turquoiseStrong`).

### Contrat composants `ui`

- `Button` : variantes `primary` (marine), `secondary`, `danger` (inchangé), `link`, et **nouvelle
  `positive`** (turquoise, texte marine). `ActionButton` hérite du type `Variant` : `positive`
  disponible.
- `Labels.RoleBadge` : tons `green` (→ turquoise : succès), `navy`, `amber` (→ or : en attente /
  mention Pro), **nouveau `warn`**, `slate`. Les noms `green` et `amber` sont conservés
  (compatibilité des lots), seuls leurs styles changent.
- `StatusBadge` : `PENDING` → or, `APPROVED` → turquoise (libellés inchangés).
- `Alert` : tons `info` / `err` / `warn` / `success` inchangés, styles mis à jour.

### Contrat menu latéral (`src/components/layout/sidebar-classes.ts`)

Les contenus du menu portaient des classes de **fond sombre** (`text-slate-300`,
`hover:bg-white/10`, `text-white`, `green-400`). `SidebarNav`, `OrgShell`, les quatre shells
d'évènement et `AccountNav` sont **dans le socle** (tâche 4 bis) et utilisent les constantes
ci-dessous ; `LogoutButton` reçoit sa classe du shell. Les lots n'ont plus rien à migrer côté
menu ; s'ils créent un nouveau menu, ils importent ces constantes :

```ts
export const SIDEBAR_BRAND = "mb-3 px-2 text-base font-semibold text-navy";
export const SIDEBAR_CONTEXT_TITLE = "px-2 text-sm font-semibold text-navy";
export const SIDEBAR_CONTEXT_MUTED = "px-2 text-xs text-nav-muted";
export const SIDEBAR_GROUP = "px-2.5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-nav-muted";
export const SIDEBAR_LINK = "flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-2 text-sm text-nav-muted transition-colors hover:bg-mist hover:text-navy";
export const SIDEBAR_LINK_ACTIVE = "flex items-center gap-2.5 rounded-lg border-l-2 border-gold bg-mist px-2.5 py-2 text-sm font-medium text-navy";
export const SIDEBAR_COUNT = "ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-navy px-1.5 text-[11px] font-semibold leading-5 text-white";
export const SIDEBAR_FOOTER_TEXT = "truncate px-2 text-xs text-nav-muted";
export const SIDEBAR_ROLE_LABEL = "mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-nav-muted sm:hidden";
export const SHELL_BANNER = "bg-navy px-4 py-1.5 text-xs font-medium text-white"; // bandeau staff : reste marine
```

Aucun lot ne réécrit ces classes (le lien actif remplace le fond vert translucide +
`green-400`). Le socle les utilise dans `StaffShell` (tâche 4) et les fichiers de la tâche 4 bis.

### Focus (`globals.css`)

Contour **marine** partout (`outline: 2px solid var(--color-navy)`), **or** sur fond marine : tout
conteneur portant `data-surface="navy"` donne `outline-color: var(--color-gold)` à ses
descendants focalisables. Les lots posent `data-surface="navy"` sur l'en-tête, le pied de page et
le bandeau d'appel à l'action sombres.

---

### Task 0 : Branche

- [ ] **Step 1: Créer la branche**

Run: `git switch development && git switch -c feat/nouvelle-palette`
Expected: branche `feat/nouvelle-palette` active ; l'arbre ne contient que la spec non suivie
(`docs/v4/specs/2026-11-04-39-v4-nouvelle-palette.md`) : elle est incluse dans le premier commit
du chantier (`docs(v4): spec et plans de la nouvelle palette`) si l'exécution est automatisée.

---

### Task 1 : `globals.css`

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces : les 13 couleurs `@theme` du tableau « Contrat figé », règle de focus, `data-surface`,
  `.legal-prose a` en marine.

- [ ] **Step 1: Ajouter les couleurs** dans le bloc `@theme`, **après** `--color-brand-navy` (qui
  reste) : `--color-navy`, `--color-navy-hover`, `--color-gold`, `--color-gold-strong`,
  `--color-gold-soft`, `--color-turquoise`, `--color-turquoise-strong`, `--color-turquoise-soft`,
  `--color-mist`, `--color-line`, `--color-nav-muted`, `--color-warn`, `--color-warn-soft`, avec les
  valeurs exactes du tableau. Mettre à jour le commentaire d'en-tête (palette « Deep Navy &
  Soft Gold » ; anciennes variables conservées jusqu'à la vague 3).

- [ ] **Step 2: Focus** : la règle `:where(a, button, input, select, textarea, [tabindex]):focus-visible`
  passe à `outline: 2px solid var(--color-navy)`. Ajouter
  `[data-surface="navy"] :where(a, button, input, select, textarea, [tabindex]):focus-visible { outline-color: var(--color-gold); }`.
  Ne pas toucher `:root` (`--accent*` restent définis, `--sidebar-w`, `--header-h`, `--font-badge`
  inchangés).

- [ ] **Step 3: `.legal-prose a`** : `color: var(--color-navy)`.

- [ ] **Step 4: Vérifier**

Run: `make typecheck`
Expected: sans erreur. Contrôle de compilation CSS : ouvrir `/styleguide` (dev tournant), pas
d'erreur Tailwind dans `make logs`. Le test de non-dérive CSS ↔ constantes est écrit en tâche 2.

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): couleurs navy, gold, turquoise, mist dans le theme Tailwind"`.

---

### Task 2 : `src/lib/brand-colors.ts`

**Files:**
- Create: `src/lib/brand-colors.ts`
- Test: `src/lib/__tests__/brand-colors.test.ts`

**Interfaces:**
- Produces : `BRAND`, `BrandColor` (voir « Contrat figé »).

- [ ] **Step 1: Écrire les tests d'abord**
  - Chaque valeur de `BRAND` respecte `/^#[0-9A-F]{6}$/` (majuscules).
  - **Non-dérive** : lire `src/app/globals.css` (`readFileSync`, chemin résolu depuis
    `process.cwd()`), pour chaque clé convertir `navyHover` → `--color-navy-hover` (camel → kebab)
    et vérifier que la déclaration `--color-<nom>: <hex>` existe avec la même valeur
    (insensible à la casse).
  - **Lisibilité** (spec « Lisibilité ») : fonction de test `contrast(a, b)` (luminance relative
    WCAG, définie dans le fichier de test) ; vérifier ≥ 4,5 pour : blanc/navy, navy/turquoise,
    navy/or, `turquoiseStrong`/blanc, `goldStrong`/blanc, `goldStrong`/`goldSoft`, `warn`/`warnSoft`,
    `navMuted`/blanc, `turquoiseStrong`/`turquoiseSoft` ; et **< 3** pour blanc/turquoise et
    or/blanc (documente les couples interdits).

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/lib/__tests__/brand-colors.test.ts`
Expected: FAIL (module introuvable). Si un ratio calculé s'écarte de la table de la spec, noter
l'écart dans « Notes » et le signaler : ne pas modifier les valeurs de la spec.

- [ ] **Step 3: Implémenter `brand-colors.ts`** : l'objet `BRAND` (`as const`) et le type
  `BrandColor`, avec le commentaire du « Contrat figé ». Aucune autre exportation.

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/lib/__tests__/brand-colors.test.ts`
Expected: PASS (couverture 100 % : un fichier de constantes, vérifié en tâche 10).

- [ ] **Step 5: Commit** — `git commit -m "feat(lib): constantes hexa de la palette pour le HTML en ligne"`.

---

### Task 3 : `sidebar-classes.ts`, `AppShell`, `MobileNav`, `UserAvatar`

**Files:**
- Create: `src/components/layout/sidebar-classes.ts`
- Modify: `src/components/layout/AppShell.tsx`, `src/components/layout/MobileNav.tsx`,
  `src/components/layout/UserAvatar.tsx`
- Test: `src/components/layout/__tests__/sidebar-classes.test.ts` (créé),
  `AppShell.test.tsx`, `UserAvatar.test.tsx`

**Interfaces:**
- Produces : constantes `SIDEBAR_*` et `SHELL_BANNER` (voir « Contrat menu latéral »).

- [ ] **Step 1: Tests d'abord**
  - `sidebar-classes.test.ts` : le texte exact de chaque constante (copie du contrat) ;
    `SIDEBAR_LINK_ACTIVE` contient `border-gold`, `bg-mist`, `text-navy` ; aucune constante ne
    contient `white/`, `slate-300`, `green-`, `brand-navy` ; `SIDEBAR_COUNT` contient `bg-navy` et
    `text-white` (marine sur blanc : 16,7) ; `SHELL_BANNER` contient `bg-navy`.
  - `AppShell.test.tsx` : ajouter « le menu est clair » — l'`aside` contient `bg-white` et
    `border-r` + `border-line`, ne contient ni `bg-brand-navy` ni `bg-navy` ; `main` contient
    `bg-white` et pas `bg-slate-50` ; la zone de pied, quand `sidebarFooter` est fourni, a
    `border-line` (pas `border-white/10`) ; le bouton de fermeture ne contient pas `text-slate-300`.
  - `UserAvatar.test.tsx` : le conteneur porte `bg-mist` et `text-navy` (mettre à jour une
    éventuelle assertion `bg-slate-200`).

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/components/layout/__tests__/AppShell.test.tsx`
Expected: FAIL (aside encore `bg-brand-navy`).

- [ ] **Step 3: Implémenter**
  - `sidebar-classes.ts` : les constantes du contrat (commentaire en tête : « classes du menu
    latéral clair, partagées par les shells »).
  - `AppShell.tsx` : `main` `bg-slate-50` → `bg-white` ; commentaire de tête « Le contenu de
    `sidebar` doit rester sur fond sombre (`bg-brand-navy`) » → « Le menu latéral est clair (fond
    blanc, trait `line`) : utiliser les classes de `sidebar-classes.ts` ». L'en-tête garde
    `border-b border-slate-200 bg-white`.
  - `MobileNav.tsx` : `aside` `bg-brand-navy` → `bg-white border-r border-line` (le tiroir garde
    `shadow-2xl`) ; bouton de fermeture `text-slate-300 hover:bg-white/10 hover:text-white` →
    `text-nav-muted hover:bg-mist hover:text-navy` ; pied `border-white/10` → `border-line` ;
    bouton d'ouverture `text-slate-600 hover:bg-slate-100` → `text-slate-600 hover:bg-mist` ;
    voile `bg-black/40` inchangé.
  - `UserAvatar.tsx` : `bg-slate-200 text-slate-600` → `bg-mist text-navy`.

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/components/layout/__tests__/AppShell.test.tsx && make test FILE=src/components/layout/__tests__/sidebar-classes.test.ts && make test FILE=src/components/layout/__tests__/UserAvatar.test.tsx && make typecheck`
Expected: PASS. (`space-shells.test.tsx` est traité en tâche 4.)

- [ ] **Step 5: Commit** — `git commit -m "feat(layout): menu lateral clair, fond blanc et classes partagees du menu"`.

---

### Task 4 : `StaffShell` et `PlatformOrgShell`

**Files:**
- Modify: `src/components/staff/StaffShell.tsx`, `src/components/platform/PlatformOrgShell.tsx`
- Test: `src/components/staff/__tests__/StaffShell.test.tsx`,
  `src/components/layout/__tests__/space-shells.test.tsx` (et le test de `PlatformOrgShell` s'il existe : `grep -rn PlatformOrgShell src --include=*.test.tsx`)

- [ ] **Step 1: Tests d'abord** (mettre à jour / ajouter ; ils échouent avant le code) :
  - `StaffShell.test.tsx` : le mock d'`AppShell` y passe `sidebarHeader`, `sidebarFooter`, `header`
    (étendre le mock pour les rendre) ; vérifier que la marque porte `text-navy` (et plus
    `text-white`), que le badge de rôle de l'en-tête porte `bg-navy/10 text-navy`, que le libellé
    « Staff » porte `text-slate-500` (lisible sur fond blanc), que `LogoutButton` reçoit une
    `className` égale à `SIDEBAR_LINK` (mock : `LogoutButton: ({ className }) => <i data-c={className} />`).
  - `space-shells.test.tsx` : remplacer toute assertion sur des classes sombres (`bg-brand-navy`,
    `text-white`, `slate-300`) par leurs équivalents clairs ; s'il n'y en a pas, ne rien changer.
  - `PlatformOrgShell` : badge « Supervision — lecture seule » en `bg-warn-soft text-warn` ; onglet
    actif `border-navy text-navy` ; onglet inactif `text-slate-500 hover:text-slate-700`.

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/components/staff/__tests__/StaffShell.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Modifier `StaffShell.tsx`** : importer les constantes de
  `@/components/layout/sidebar-classes` ; marque `className={SIDEBAR_BRAND}` ; libellé de rôle du
  tiroir `className={SIDEBAR_ROLE_LABEL}` ; `LogoutButton className={\`w-full ${SIDEBAR_LINK}\`}`
  (même rendu que l'ancien lien déconnexion : classes `flex … text-nav-muted hover:bg-mist
  hover:text-navy`) ; « Staff » `text-slate-400` → `text-slate-500` ; badge de rôle
  `bg-brand-navy/10 text-brand-navy` → `bg-navy/10 text-navy`.

- [ ] **Step 4: Modifier `PlatformOrgShell.tsx`** : lien retour `text-slate-400 hover:text-slate-600`
  → `text-slate-500 hover:text-navy` ; badge de supervision `bg-amber-100 text-amber-700` →
  `bg-warn-soft text-warn` (avertissement, pas un statut en attente) ; onglet actif
  `border-brand-navy … text-brand-navy` → `border-navy … text-navy`.

- [ ] **Step 5: Vérifier**

Run: `make test FILE=src/components/staff/__tests__/StaffShell.test.tsx && make test FILE=src/components/layout/__tests__/space-shells.test.tsx && make typecheck`
Expected: PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(layout): coquilles staff et plateforme sur la palette claire"`.

---

### Task 4 bis : Menu latéral clair (navigation partagée)

**Files:**
- Modify: `src/components/admin/SidebarNav.tsx`, `src/components/admin/OrgShell.tsx`,
  `src/components/event/EventShell.tsx`, `EventViewerShell.tsx`, `EventOperatorShell.tsx`,
  `EventPrinterShell.tsx`, `src/components/public/AccountNav.tsx`
- Test: `src/components/admin/__tests__/SidebarNav.test.tsx`, `OrgShell.test.tsx`,
  `src/components/public/__tests__/AccountNav.test.tsx` ; tests de shells d'évènement existants
  (`grep -rln "EventShell\|EventViewerShell\|EventOperatorShell\|EventPrinterShell" src --include=*.test.tsx`) ; si un shell n'a
  aucun test, créer `src/components/event/__tests__/EventShells.test.tsx` (mêmes mocks que
  `StaffShell.test.tsx`, voir tâche 4) avec une assertion de classes par shell.

**Interfaces:**
- Consumes : constantes de `src/components/layout/sidebar-classes.ts` (tâche 3).

- [ ] **Step 1: Tests d'abord** (échouent avant le code) :
  - `SidebarNav.test.tsx` : lien inactif contient `text-nav-muted` et `hover:bg-mist` ; lien actif
    (`aria-current="page"`) contient `border-gold bg-mist text-navy font-medium` ; intitulé de
    groupe `text-nav-muted` ; pastille de compteur `bg-navy text-white` ; aucune des classes
    `text-white/45`, `green-`, `slate-300`, `bg-white/10`. Les cas existants (compteur nul,
    `exact`, `aria-label`) restent.
  - `OrgShell.test.tsx` : marque `text-navy` (pas `text-white`), nom de l'organisation `text-navy`
    ou `text-nav-muted`, e-mail `text-nav-muted`, `LogoutButton` reçoit `SIDEBAR_LINK` (mock qui
    expose `className`).
  - Shells d'évènement : le titre d'évènement porte `text-navy`, le nom d'organisation
    `text-nav-muted`, les liens `SIDEBAR_LINK` ; plus aucun `text-white`, `text-slate-300`,
    `text-slate-400`, `hover:bg-white/10` ; pour `EventShell` : badge de rôle de l'en-tête
    `bg-navy/10 text-navy` et, en mode staff, bandeau `bg-navy` + `text-white` (plus
    `bg-amber-50`).
  - `AccountNav.test.tsx` : lien actif `bg-mist text-navy`, inactif `text-slate-600 hover:text-navy` ;
    les assertions existantes (`aria-current`, `hidden sm:inline-flex`) restent.

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/components/admin/__tests__/SidebarNav.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter** (ancien → nouveau) :
  - `SidebarNav.tsx` : intitulé de groupe `…text-white/45` → `SIDEBAR_GROUP` ; lien : classe de
    base `flex … rounded-lg border-l-2 px-2.5 py-2 text-sm transition-colors` conservée en
    structure, mais actif `border-green-400 bg-green-500/15 font-medium text-green-400` →
    `SIDEBAR_LINK_ACTIVE`, inactif `border-transparent text-slate-300 hover:bg-white/10
    hover:text-white` → `SIDEBAR_LINK` (les deux constantes portent déjà la structure) ;
    pastille `bg-green-500 … text-white` → `SIDEBAR_COUNT`.
  - `OrgShell.tsx` : marque `mb-1 px-2 text-base font-semibold text-white` → `SIDEBAR_BRAND`
    (marge basse `mb-1` conservée via une classe ajoutée : `${SIDEBAR_BRAND} mb-1` n'est pas
    nécessaire, garder `mb-3` du contrat et ne pas rouvrir les espacements) ; nom d'organisation
    `text-white/80` → `SIDEBAR_CONTEXT_TITLE` ; `LogoutButton className` → `w-full ${SIDEBAR_LINK}` ;
    e-mail `text-slate-400` → `SIDEBAR_FOOTER_TEXT`. En-tête : `text-slate-700` inchangé.
  - `EventShell.tsx` : marque → `SIDEBAR_BRAND` ; lien retour `text-slate-400 … hover:text-slate-200`
    → `text-nav-muted … hover:text-navy` ; titre `text-white` → `SIDEBAR_CONTEXT_TITLE` ; e-mail
    `text-slate-400` → `SIDEBAR_FOOTER_TEXT` ; **bandeau mode staff**
    `border-b border-amber-200 bg-amber-50 … text-amber-700` → `SHELL_BANNER` (marine, texte blanc ;
    les classes de disposition `sm:flex sm:items-center …` sont conservées) ; en-tête : nom d'org
    `text-slate-400` → `text-slate-500`, badge de rôle `bg-green-500/15 … text-green-700` →
    `bg-navy/10 … text-navy`. Le séparateur `text-slate-300` et `text-slate-700` restent.
  - `EventViewerShell.tsx`, `EventOperatorShell.tsx`, `EventPrinterShell.tsx` : nom d'organisation
    `text-slate-400` → `SIDEBAR_CONTEXT_MUTED` ; titre `text-white` → `SIDEBAR_CONTEXT_TITLE` ;
    liens `…text-slate-300 … hover:bg-white/10 hover:text-white` → `SIDEBAR_LINK` ; pied
    `text-slate-400` → `SIDEBAR_FOOTER_TEXT`. Tout lien actif de ces shells (s'il existe) →
    `SIDEBAR_LINK_ACTIVE`.
  - `AccountNav.tsx` : actif `bg-green-500/15 text-green-700` → `bg-mist text-navy` ; inactif
    `text-slate-600 hover:text-slate-900` → `text-slate-600 hover:text-navy`.
  - Ne changer ni structure, ni icône, ni espacement : seulement les classes de couleur (une
    constante qui remplace un groupe de classes ne doit pas modifier padding/typographie ; si une
    constante diffère d'un espacement actuel, ajuster l'appel, pas la constante).

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/components/admin/__tests__/SidebarNav.test.tsx && make test FILE=src/components/admin/__tests__/OrgShell.test.tsx && make test FILE=src/components/public/__tests__/AccountNav.test.tsx && make test FILE=src/components/staff/__tests__/StaffShell.test.tsx && make typecheck`
Expected: PASS (puis les tests de shells d'évènement trouvés au Step 1).

- [ ] **Step 5: Commit** — `git commit -m "feat(layout): navigation laterale claire partagee (menu, shells org et evenement, compte)"`.

---

### Task 5 : `ui` — boutons, feedback, étiquettes, statuts, onglets, pagination, champs

**Files:**
- Modify: `src/components/ui/Button.tsx`, `Feedback.tsx`, `Labels.tsx`, `StatusBadge.tsx`,
  `Tabs.tsx`, `TabLinks.tsx`, `Pagination.tsx`, `Input.tsx`, `Select.tsx`, `Dialog.tsx`,
  `DocumentPreview.tsx`
- Test: `src/components/ui/__tests__/Button.test.tsx`, `Feedback.test.tsx`, `Labels.test.tsx`,
  `Tabs.test.tsx`, `Pagination.test.tsx`, `StatusBadge.test.tsx` (créé), `ActionButton.test.tsx`

- [ ] **Step 1: Tests d'abord** (échouent avant le code) :
  - `Button.test.tsx` : `primary` contient `bg-navy`, `text-white`, `hover:bg-navy-hover`,
    `focus-visible:ring-navy`, et ni `green-` ni `ring-green` ; `positive` contient `bg-turquoise`,
    `text-navy` (pas `text-white`), `hover:bg-turquoise-strong` ; `secondary` contient `border`,
    `border-slate-300`, `text-navy`, `hover:bg-mist` ; `danger` inchangé (`bg-rose-600`) ; `link`
    inchangé (« ni fond ni padding » : le test existant `not.toContain("bg-")` reste vrai).
  - `ActionButton.test.tsx` : `variant="positive"` rend `bg-turquoise`.
  - `Feedback.test.tsx` : `info` → `bg-mist` + `text-navy` ; `warn` → `bg-warn-soft` + `text-warn` ;
    `success` → `bg-turquoise-soft` + `text-turquoise-strong` ; `err` → `bg-rose-50` (inchangé) ;
    spinner `border-t-navy` ; barre de progression `bg-navy` ; icône de succès
    `bg-turquoise-soft text-turquoise-strong`.
  - `Labels.test.tsx` : `RoleBadge` `green` → `bg-turquoise-soft text-turquoise-strong` ; `amber` →
    `bg-gold-soft text-gold-strong` ; `warn` → `bg-warn-soft text-warn` ; `navy` →
    `bg-navy/10 text-navy` ; `slate` inchangé.
  - `StatusBadge.test.tsx` (nouveau) : `PENDING` → « En attente » avec `bg-gold-soft`
    `text-gold-strong` ; `APPROVED` → « Validé » avec `bg-turquoise-soft text-turquoise-strong` ;
    statut inconnu → comportement actuel du composant (lire le fichier, tester ses branches).
  - `Tabs.test.tsx` : onglet actif `border-navy text-navy` ; `Segmented` : conteneur `bg-mist`,
    option active `bg-white`.
  - `Pagination.test.tsx` : page courante `bg-navy text-white` ; focus `ring-navy` ; survol
    `hover:bg-mist` ; les assertions de la vague « retours client » (options 10/20/50/100/500) sont
    conservées.

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/components/ui/__tests__/Button.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter** (classes actuelles → nouvelles) :
  - `Button.tsx` : `type Variant = "primary" | "positive" | "secondary" | "danger" | "link"`.
    `primary` : `bg-green-600 text-white hover:bg-green-700` → `bg-navy text-white hover:bg-navy-hover` ;
    nouvelle `positive` : `bg-turquoise text-navy hover:bg-turquoise-strong hover:text-white` ;
    `secondary` : `bg-slate-100 text-slate-700 hover:bg-slate-200` →
    `border border-slate-300 bg-white text-navy hover:bg-mist` ; `danger` et `link` inchangés ;
    `baseClasses.positive = baseClasses.primary` (même padding) ; anneau
    `focus-visible:ring-green-500` → `focus-visible:ring-navy`. Le spinner du chargement garde sa
    couleur courante (vérifier qu'il hérite de `currentColor`).
  - `Feedback.tsx` : `info` `border-blue-200 bg-blue-50 text-blue-700` → `border-line bg-mist text-navy` ;
    `warn` `border-amber-200 bg-amber-50 text-amber-700` → `border-warn/20 bg-warn-soft text-warn` ;
    `success` `border-emerald-200 bg-emerald-50 text-emerald-700` →
    `border-turquoise/30 bg-turquoise-soft text-turquoise-strong` ; spinner `border-t-green-600` →
    `border-t-navy` ; piste de progression `bg-slate-100` → `bg-mist` et remplissage `bg-green-600`
    → `bg-navy` ; icône de succès `bg-emerald-50 text-green-600` → `bg-turquoise-soft text-turquoise-strong`.
  - `Labels.tsx` : `green` → `bg-turquoise-soft text-turquoise-strong` ; `navy` →
    `bg-navy/10 text-navy` ; `amber` → `bg-gold-soft text-gold-strong` ; ajouter le ton `warn` →
    `bg-warn-soft text-warn` (type `"green" | "navy" | "amber" | "warn" | "slate"`) ; `slate`
    `bg-slate-100 text-slate-600` → `bg-mist text-slate-600` ; puce de ligne 39
    `bg-slate-100` → `bg-mist`.
  - `StatusBadge.tsx` : `PENDING` `bg-amber-50 text-amber-700` → `bg-gold-soft text-gold-strong` ;
    `APPROVED` `bg-emerald-50 text-emerald-700` → `bg-turquoise-soft text-turquoise-strong`
    (les autres statuts éventuels : classer par rôle selon la table).
  - `Tabs.tsx` / `TabLinks.tsx` : actif `border-green-600 text-green-600` → `border-navy text-navy` ;
    `Segmented` `bg-slate-100` → `bg-mist`.
  - `Pagination.tsx` : page courante `bg-green-600` → `bg-navy` ; `focus-visible:ring-green-500` et
    `focus:ring-green-500` → `ring-navy` ; `hover:bg-slate-100` → `hover:bg-mist`.
  - `Input.tsx`, `Select.tsx` : `focus:ring-green-500` → `focus:ring-navy`.
  - `Dialog.tsx` : `hover:bg-slate-100` → `hover:bg-mist` ; `focus-visible:ring-green-500` →
    `focus-visible:ring-navy`.
  - `DocumentPreview.tsx` : lien `text-green-600` → `text-navy`.

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/components/ui/__tests__/Button.test.tsx && make test FILE=src/components/ui/__tests__/ActionButton.test.tsx && make test FILE=src/components/ui/__tests__/Feedback.test.tsx && make test FILE=src/components/ui/__tests__/Labels.test.tsx && make test FILE=src/components/ui/__tests__/StatusBadge.test.tsx && make test FILE=src/components/ui/__tests__/Tabs.test.tsx && make test FILE=src/components/ui/__tests__/Pagination.test.tsx && make typecheck`
Expected: PASS ; `tsc` sans erreur (la nouvelle variante `positive` et le ton `warn` ne cassent
aucun appelant).

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): boutons, alertes, etiquettes, statuts et onglets sur la nouvelle palette"`.

---

### Task 6 : `ui` — reste des composants

**Files:**
- Modify: `src/components/ui/BatchBar.tsx`, `FileBox.tsx`, `FormControls.tsx`, `ImageCropper.tsx`,
  `JournalBlocks.tsx`, `MiniChart.tsx`, `PasswordMeter.tsx`, `PickCard.tsx`, `QuotaBar.tsx`,
  `RadioCards.tsx`, `StatCard.tsx`, `Stepper.tsx`, `Table.tsx`, `Timeline.tsx`, `VerifyBanner.tsx`
- Test : fichiers de `src/components/ui/__tests__/` correspondants (mise à jour des assertions)

- [ ] **Step 1: Tests d'abord** — adapter les assertions existantes aux nouvelles classes
  (elles échouent avant le code) :
  - `BatchBar.test.tsx` : `bg-brand-navy` → `bg-navy`.
  - `FileBox.test.tsx` : `text-amber-600` → `text-warn` ; zone de dépôt au repos
    `border-slate-300 bg-slate-50` → `bg-mist`, en survol/dépôt `border-navy bg-mist`.
  - `FormControls.test.tsx` : interrupteur actif `bg-green-600` → `bg-navy` ; case cochée
    `border-navy bg-navy text-white`.
  - `QuotaBar.test.tsx` : 50 % → `bg-turquoise` ; 80 % → `bg-warn` ; 95 % → `bg-rose-600`
    (inchangé) ; alerte de quota `border-warn/20 bg-warn-soft text-warn`.
  - `RadioCards.test.tsx` : sélectionné `bg-emerald-50` → `border-navy bg-mist` ; coche `text-navy` ;
    désactivé `bg-mist`.
  - `StatCard.test.tsx` : delta positif `text-emerald-700` → `text-turquoise-strong` ; négatif
    `text-rose-700` inchangé ; puce d'icône `bg-mist`.
  - `Timeline.test.tsx` : `ok` `bg-green-600` → `border-turquoise bg-turquoise` ; `warn`
    `border-warn bg-white`.
  - `VerifyBanner.test.tsx` : valide `bg-green-600` → `bg-turquoise` **et `text-navy`** (jamais
    `text-white` sur turquoise) ; invalide `bg-rose-600 text-white` inchangé ; zone enfant
    `bg-slate-50` → `bg-mist`.
  - `JournalBlocks.test.tsx` : `creation` → `bg-turquoise-soft text-turquoise-strong` ;
    `modification` → `bg-mist text-navy` ; `systeme` → `bg-gold-soft text-gold-strong` ;
    `acces` → `bg-navy/10 text-navy` ; `connexion` inchangé ; bloc de réussite
    `border-turquoise/30 bg-turquoise-soft`.
  - Pas de test dédié existant pour `MiniChart`, `PasswordMeter`, `PickCard`, `Stepper`, `Table` :
    ajouter, dans les tests existants (`MiniChart.test`, `PasswordMeter.test`, `PickCard.test`,
    `Stepper.test`) une assertion par classe migrée ; pour `Table`, ajouter
    `src/components/ui/__tests__/Table.test.tsx` (en-tête `bg-mist`, ligne `hover:bg-mist`).

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/components/ui/__tests__/QuotaBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implémenter** (ancien → nouveau) :
  - `BatchBar.tsx` : `bg-brand-navy` → `bg-navy` ; ajouter `data-surface="navy"` (focus or sur marine).
  - `FileBox.tsx` : puce `bg-slate-100` → `bg-mist` ; avertissement `text-amber-600` → `text-warn` ;
    zone : `border-green-600 bg-emerald-50` → `border-navy bg-mist` ;
    `border-slate-300 bg-slate-50 hover:border-green-600 hover:bg-emerald-50` →
    `border-slate-300 bg-mist hover:border-navy hover:bg-mist`.
  - `FormControls.tsx` : interrupteur `bg-green-600` → `bg-navy` ; case
    `border-green-600 bg-green-600 text-white` → `border-navy bg-navy text-white`.
  - `ImageCropper.tsx` : `text-amber-700` → `text-warn` ; le `#ffffff` du canvas ne change pas.
  - `JournalBlocks.tsx` : tables de classes du tableau de tâche (commentaire de tête mis à jour :
    « accent unique marine ; or réservé aux catégories "système" ») ; `creation`
    `bg-emerald-50 text-emerald-700` → `bg-turquoise-soft text-turquoise-strong` ; `modification`
    `bg-indigo-500/10 text-indigo-600` → `bg-mist text-navy` ; `systeme` `bg-amber-50 text-amber-700`
    → `bg-gold-soft text-gold-strong` ; `acces` `bg-brand-navy/10 text-brand-navy` →
    `bg-navy/10 text-navy` ; `connexion` `bg-slate-100` → `bg-mist` ; bloc ligne 52
    `border-emerald-200 bg-emerald-50` → `border-turquoise/30 bg-turquoise-soft`.
  - `MiniChart.tsx` : barres `bg-green-500 … hover:bg-green-600` → `bg-navy … hover:bg-navy-hover`
    (série neutre, pas un succès).
  - `PasswordMeter.tsx` : `FILL` `["bg-rose-600","bg-rose-600","bg-amber-700","bg-green-500","bg-green-600"]` →
    `["bg-rose-600","bg-rose-600","bg-warn","bg-turquoise","bg-turquoise-strong"]`.
  - `PickCard.tsx` : puce `bg-slate-100 text-brand-navy` → `bg-mist text-navy` ;
    `hover:border-green-600` (deux occurrences, dont la carte en pointillés) → `hover:border-navy` ;
    texte survolé éventuel `hover:text-green-*` → `hover:text-navy`.
  - `QuotaBar.tsx` : `bg-amber-700` → `bg-warn` ; `bg-green-600` → `bg-turquoise` ; piste
    `bg-slate-100` → `bg-mist` ; alerte `border-amber-200 bg-amber-50 text-amber-700` →
    `border-warn/20 bg-warn-soft text-warn`.
  - `RadioCards.tsx` : `border-green-600 bg-emerald-50` → `border-navy bg-mist` ; coche
    `text-green-600` → `text-navy` ; désactivé `bg-slate-50` → `bg-mist`.
  - `StatCard.tsx` : puce `bg-slate-100` → `bg-mist` ; delta positif `text-emerald-700` →
    `text-turquoise-strong`.
  - `Stepper.tsx` : actif `bg-green-600 text-white` → `bg-navy text-white` ; fait
    `bg-emerald-50 text-green-700` → `bg-turquoise-soft text-turquoise-strong` ; à venir
    `bg-slate-100 text-slate-500` → `bg-mist text-slate-500`.
  - `Table.tsx` : en-tête `bg-slate-50` → `bg-mist` ; `hover:bg-slate-50` → `hover:bg-mist`.
  - `Timeline.tsx` : `ok` `border-green-600 bg-green-600` → `border-turquoise bg-turquoise` ;
    `warn` `border-amber-700` → `border-warn`.
  - `VerifyBanner.tsx` : valide `bg-green-600 text-white` → `bg-turquoise text-navy` ; invalide
    inchangé ; `bg-slate-50` → `bg-mist`.
  - **Inchangés** : `Card`, `Icon`, `Modal`, `Toolbar`, `TableFrame`, `TemplatePreview`,
    `AppToaster`, `ActionButton` (aucune couleur de marque ; vérifier par `grep`).

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/components/ui/__tests__/` (tous les tests du dossier) puis `make typecheck`
Expected: PASS ; `tsc` sans erreur.

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): barres, cartes, tableaux, fichiers et journal sur la nouvelle palette"`.

---

### Task 7 : Garde-fou local du socle

**Files:**
- Create: `src/components/ui/__tests__/palette-socle.test.ts`

Le garde-fou global (`src/__tests__/palette-guard.test.ts`) est écrit en vague 3. Ce test local
verrouille les fichiers du socle dès maintenant (utile aux lots qui modifieraient un composant
`ui` par erreur : ils ne le peuvent pas, mais la régression se verrait).

- [ ] **Step 1: Écrire le test** : lire (`readFileSync`) les sources non-test de
  `src/components/ui/`, `src/components/layout/`, `src/components/staff/StaffShell.tsx`,
  `src/components/platform/PlatformOrgShell.tsx`, `src/components/admin/SidebarNav.tsx`,
  `src/components/admin/OrgShell.tsx`, `src/components/event/Event{,Viewer,Operator,Printer}Shell.tsx`,
  `src/components/public/AccountNav.tsx`, `src/app/styleguide/page.tsx` ; échouer si une
  source contient l'un de : `green-` , `emerald-`, `amber-`, `blue-`, `sky-`, `indigo-`, `teal-`,
  `brand-navy`, `brand-green`, `#004d74`, `#4f46e5`, `var(--accent`, `var(--brand`. **Exceptions
  par ligne** : les lignes du styleguide contenant `color="#` / `color: "#` / `categoryColor="#`
  (données colorées) ; le test ignore ces valeurs hexa car elles ne figurent pas dans la liste
  interdite (seul `#004d74` / `#4f46e5` le sont).

- [ ] **Step 2: Vérifier**

Run: `make test FILE=src/components/ui/__tests__/palette-socle.test.ts`
Expected: échoue tant que le styleguide (tâche 8) n'est pas migré ; sinon PASS. Si une occurrence
subsiste dans un composant migré, corriger le composant (pas le test).

- [ ] **Step 3: Revue des tests existants** — `grep -rn "green-\|emerald-\|amber-\|brand-navy\|text-white" src/components/ui/__tests__ src/components/layout/__tests__ src/components/staff/__tests__/StaffShell.test.tsx` : plus aucune assertion ne doit viser une ancienne classe. Compléter la mise à jour des tests restants.

- [ ] **Step 4: Commit** — `git commit -m "test(ui): garde-fou des couleurs du socle"`.

---

### Task 8 : `/styleguide`

**Files:**
- Modify: `src/app/styleguide/page.tsx`

Référence visuelle servant au contrôle : elle montre la palette et chaque composant migré.

- [ ] **Step 1: Ajouter une section « Palette »** en tête de page : une pastille par couleur du
  tableau « Contrat figé » (13 entrées) avec son nom de classe et sa valeur ; les pastilles utilisent
  les classes Tailwind du contrat (`bg-navy`, `bg-gold`, … ; `text-white` ou `text-navy` selon le
  fond). Ajouter les **couples de lisibilité autorisés** (blanc/marine, marine/turquoise, marine/or,
  turquoise-strong/blanc, gold-strong/gold-soft, warn/warn-soft, nav-muted/blanc) en petits
  exemples de texte.
- [ ] **Step 2: Section « Boutons »** : `primary`, `positive`, `secondary`, `danger`, `link`,
  chacun normal, désactivé et en chargement.
- [ ] **Step 3: Étiquettes et statuts** : `RoleBadge` avec les cinq tons (`green`, `navy`, `amber`,
  `warn`, `slate`) ; `StatusBadge` `PENDING` / `APPROVED` ; `Alert` des quatre tons.
- [ ] **Step 4: Migrer les classes en dur** de la page : titre de section `text-slate-500` inchangé ;
  tout `green-*`, `bg-slate-50/100` éventuels selon la table (la page ne doit plus contenir de
  classes interdites par la tâche 7). `CatPill`, `MiniBadge`, `color="#16a34a"`… restent
  (données colorées, exception).
- [ ] **Step 5: Menu latéral** : ajouter un exemple statique « menu clair » (conteneur
  `w-56 border-r border-line bg-white`) montrant `SIDEBAR_BRAND`, `SIDEBAR_GROUP`, un
  `SIDEBAR_LINK`, un `SIDEBAR_LINK_ACTIVE`, un `SIDEBAR_COUNT`, `SIDEBAR_FOOTER_TEXT`, et le
  `SHELL_BANNER` : références pour les lots.
- [ ] **Step 6: Vérifier**

Run: `make typecheck && make lint && make test FILE=src/components/ui/__tests__/palette-socle.test.ts`
Expected: sans erreur ; le garde-fou local passe maintenant en entier.

- [ ] **Step 7: Commit** — `git commit -m "feat(styleguide): reference visuelle de la nouvelle palette"`.

---

### Task 9 : Contrôle visuel (obligatoire, UI)

Dev tournant (`make dev`). Se connecter avec un compte du seed démo. Aucun contrôle ne passe par
les lots : le socle seul est visible.

- [ ] **Step 1: `/styleguide`** à **375, 1024 et 1280 px** (outil de redimensionnement du navigateur) :
  palette lisible, tous les boutons, étiquettes, alertes et statuts conformes au contrat, aucun
  texte blanc sur turquoise, aucun texte or sur blanc, aucun défilement horizontal à 375 px,
  focus clavier (Tab) visible en marine sur chaque contrôle.
- [ ] **Step 2: Espace plateforme** (`/platform`, `StaffShell`) à 375 / 1024 / 1280 px : fond de page
  blanc, menu latéral blanc avec trait `line`, marque en marine, bouton menu et tiroir mobile
  (voile, fermeture, focus) corrects, avatar `mist`/marine, badge de rôle marine ; liens du menu
  `nav-muted`, lien actif marine sur `mist` avec trait or, pastille de commandes marine, groupes
  lisibles.
- [ ] **Step 3: Page d'une organisation vue du staff** (`/platform/organizations/<id>`,
  `PlatformOrgShell`) à 1024 px : badge « Supervision — lecture seule » orange pâle, onglet actif marine.
- [ ] **Step 4: Un écran de chaque autre shell** (`/org/<id>` `OrgShell`, un évènement `EventShell`
  y compris en mode staff pour le bandeau marine, un évènement en rôle lecteur/opérateur/imprimeur
  si le seed le permet, `/account` pour `AccountNav`) à 375 / 1024 / 1280 px : fond blanc, menu
  clair lisible, lien actif marine sur `mist` + trait or, tiroir mobile, `Button`, `Pagination`,
  `Alert`. Le contenu des pages reste en ancien style jusqu'aux lots : attendu.
- [ ] **Step 5: Noter** les résultats dans « Notes » de la table (une ligne par largeur) ; un
  défaut dans un fichier hors socle → le signaler, ne pas le corriger.

---

### Task 10 : Vérification complète

- [ ] **Step 1: Chaîne complète**

Run: `make lint && make typecheck && make test-coverage`
Expected: lint sans warning ; `tsc` sans erreur ; tous les tests PASS ; seuils 100 % respectés sur
`src/lib/**` et `src/app/api/**` (en particulier `src/lib/brand-colors.ts` à 100 %). Toute
branche non couverte → ajouter un test, jamais d'exclusion ni de modification du code de prod.

- [ ] **Step 2: Contrat prêt pour les lots** : vérifier par `grep` que `globals.css` contient les
  13 variables `--color-*` du contrat **et** toujours `--color-brand-navy`, `--brand-navy`,
  `--brand-green`, `--accent`, `--accent-hover`, `--accent-nav`, `--accent-nav-bg` ; que
  `BRAND` expose les 13 clés ; que `Button` accepte `positive` ; que `RoleBadge` accepte `warn` ;
  que `sidebar-classes.ts` exporte les 10 constantes ; que `SidebarNav`, `OrgShell`, les shells d'évènement et `AccountNav` n'ont plus de classe de fond sombre (`grep -n "text-white\|slate-300\|white/10\|green-\|amber-"`).

- [ ] **Step 3: Journal et progression** — mettre la table Progression à `[x]` datée ; ajouter au
  journal de la spec les arbitrages ci-dessous (sidebar-classes, variante `positive`, tons
  `Labels`, `data-surface`, `MiniChart`/progression en marine, séparation shells/lots). Commit :
  `git commit -m "docs(v4): progression du socle nouvelle palette"`.

---

## Contradictions et points signalés (spec ↔ code)

1. **Navigation dans le socle** : sur arbitrage de l'agent principal, `SidebarNav`, `OrgShell`, les
   quatre shells d'évènement et `AccountNav` passent au socle (tâche 4 bis) pour une navigation
   homogène. Écart de chemin : `AccountNav` est `src/components/public/AccountNav.tsx` (et non
   `src/components/account/`) ; la spec attribue `src/components/public/**` au lot 2a : **2a doit
   exclure `AccountNav.tsx` et son test** ; **2c doit exclure** `src/components/admin/SidebarNav.tsx`,
   `OrgShell.tsx` et `src/components/event/Event*Shell.tsx` (et leurs tests). `src/app/account/layout.tsx`
   (fond `bg-slate-50`, lien `hover:text-green-600`) reste à 2c. Le bandeau du mode staff d'`EventShell`
   passe de l'ambre à une bande marine (`SHELL_BANNER`), conformément à la spec (« bandeau staff
   marine »).
2. **Variante `positive`** : la spec exige un « bouton d'action positive turquoise, texte marine »
   mais `Button` n'a que `primary` / `secondary` / `danger` / `link`. Ajout de `positive` au contrat
   (les lots remplacent leurs boutons verts d'action positive par `<Button variant="positive">`).
3. **Tons `Labels`** : `RoleBadge` garde `green` et `amber` (noms hérités) mais leurs styles
   deviennent turquoise (succès) et or (en attente) ; ajout de `warn`. Les lots ne doivent pas
   utiliser `green` pour autre chose qu'un succès.
4. **`data-surface="navy"`** : le focus or sur fond marine (spec §Arbitrages) passe par un attribut
   que les lots posent sur leurs sections sombres ; ajout au contrat, `BatchBar` l'utilise déjà.
5. **Séries neutres** : `MiniChart` et la barre de progression `Feedback` passent en marine
   (série neutre, pas un succès) ; `QuotaBar` normal passe en turquoise (état sain) et ≥ 75 % en
   `warn`. Arbitrage de l'agent, à relire.
6. **Puce « système » du journal** (`JournalBlocks`) : catégorie, pas un statut ni un avertissement :
   or (`gold-soft` / `gold-strong`). Arbitrage de l'agent, à relire.
7. **`brand-colors.ts` ne contient que la palette** : les autres hexa en ligne des e-mails (gris du
   texte, bordures, rouge des erreurs) ne sont pas centralisés ici ; le lot 2a les garde en
   ligne (hors périmètre de la spec : seuls bleu, vert et indigo changent).
