# Gabarits d'impression et planches de badges — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** le staff définit des gabarits d'impression (feuille, marges, espaces, orientations)
et génère, pour les badges d'un évènement, un PDF de planches prêt pour un imprimeur
(badges à 100 %, traits de coupe, recto-verso aligné), avec un aperçu.

**Architecture :** trois couches. (1) Géométrie **pure** dans `src/lib/print-sheets/`
(`computeSheetLayout`, `planPlacements`) : aucune base, aucun réseau, partagée par l'aperçu
navigateur et la génération. (2) Composition PDF avec `pdf-lib` (`composeSheets`) à partir
des PDF de badges rendus par le service existant (`renderBadgePdf`). (3) Une file propre
(`PrintSheetGeneration`) traitée par le worker existant, en parallèle des emails, avec
battement de cœur. Écrans staff sous `/platform/print/**`.

**Tech Stack :** Next.js 16 App Router, Prisma 6 / MySQL 8, zod, `pdf-lib` 1.17.1 (nouvelle
dépendance), Vitest 4 (BDD réelle), Playwright.

**Spec :** [`docs/v4/specs/2026-11-01-31-v4-gabarits-et-planches-d-impression.md`](../specs/2026-11-01-31-v4-gabarits-et-planches-d-impression.md)

**Branche :** `feat/service-impression` (créée depuis `development` le 2026-11-01)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma, dépendance `pdf-lib`, libellés d'activité | [x] | 2026-11-01 | revue validée |
| 2 | Géométrie : `computeSheetLayout` | [x] | 2026-11-01 | revue validée |
| 3 | Placements et recto-verso : `planPlacements` | [x] | 2026-11-01 | revue validée |
| 4 | Composition PDF : `composeSheets` | [x] | 2026-11-01 | revue validée |
| 5 | API des gabarits | [x] | 2026-11-01 | revue validée |
| 6 | Création d'une génération + API + fichiers sensibles | [x] | 2026-11-01 | revue validée |
| 7 | Exécution d'une génération dans le worker | [x] | 2026-11-01 | revue validée |
| 8 | Écran des gabarits + aperçu SVG + menu « Impression » | [x] | 2026-11-01 | revue validée |
| 9 | Écran des générations | [x] | 2026-11-01 | revue validée |
| 11 | Export ZIP asynchrone sans limite (organisateur) | [x] | 2026-11-01 | exécutée avant la 10 |
| 10 | E2E et documentation | [x] | 2026-11-01 | revue validée |
| 12 | Sélection de tous les badges sans limite (après relecture finale) | [x] | 2026-11-01 | revue validée |
| — | Vérification finale (lint, typecheck, test, e2e, PDF réel, impression papier) | [~] | 2026-11-01 | relecture finale + correctifs validés ; lint/typecheck/test/e2e verts ; planche réelle contrôlée à l'écran ; reste le test papier recto-verso (utilisateur) ; trous de couverture antérieurs dans render-badge.ts / types.ts |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée. En cas d'interruption, passez la ligne à `[~]` et notez
précisément l'état.

## Contraintes globales

- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en
  français, dans le style du fichier touché. Commits et noms de fichiers en ASCII.
- **Longueurs stockées en dixièmes de millimètre (entiers)** ; l'interface saisit des mm avec
  une décimale. Badge en px CSS à 96 dpi : `mm = px × 25.4 / 96` ; PDF : `pt = mm × 72 / 25.4`.
- **Jamais de mise à l'échelle** d'un badge : posé à 100 %.
- **Tolérance de format** : un PDF de badge dont la page diffère de plus de **0,01 mm** du
  format attendu fait échouer la génération.
- **Droits** : gabarits — lecture `STAFF_OBSERVER`, écriture `STAFF_ADMIN` ; générations —
  lancer et télécharger `STAFF_SUPPORT`. `withStaffAuth(handler, { minRole })`
  (`src/lib/with-staff-auth.ts`).
- **Toute action sensible loggée** via `logActivity` ; chaque nouvel `ActivityType` reçoit un
  libellé dans `src/lib/activity-labels.ts`.
- **Une seule nouvelle dépendance : `pdf-lib@1.17.1`.** Aucune nouvelle variable
  d'environnement.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**`. Tests sur la **vraie MySQL** ;
  nouveaux modèles ajoutés à la purge de `src/test-setup.ts` dans l'ordre des FK. Le rendu
  de badge est injecté (`renderBadge`) : les tests de composition lui passent de vrais PDF
  fabriqués avec `pdf-lib` (le faux exporteur ne produit pas un PDF lisible).
- **Commandes** (conteneur dev, `make dev` lancé) :
  - un fichier : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - schéma : `make db-push` ;
  - avant de déclarer une task terminée : `make lint && make typecheck && make test`.
- **`make test` vide la BDD de dev** : `make db-seed` avant toute vérification navigateur.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Les étapes « commit » de ce
  plan ne valent pas autorisation. Jamais de trailer de co-auteur.
- **Pas de déploiement, pas de SSH, pas de prod.**

## Points de vigilance de revue

1. **Badge plus grand que la zone utile** dans une orientation mais pas dans l'autre :
   `AUTO` doit choisir celle qui tient ; `ORIGINAL`/`ROTATED` forcés qui ne tiennent pas
   → `BADGE_TOO_LARGE`, jamais une grille à 0 colonne silencieuse. (Task 2.)
2. **Recto-verso avec badges pivotés et feuille paysage** : la combinaison la plus facile à
   rater ; chaque verso doit tomber derrière son recto et à l'endroit. (Task 3.)
3. **Dernière feuille partielle en recto-verso** : les versos d'une feuille incomplète sont
   aux emplacements miroirs des rectos présents, pas tassés au début. (Task 3.)
4. **Worker arrêté au milieu d'une génération** (déploiement) : la génération est reprise
   une fois le battement périmé, jamais traitée par deux workers à la fois, et le fichier
   d'une tentative précédente est écrasé. (Task 7.)
5. **Inscription rejetée entre la création et le rendu** : écartée et listée, la génération
   aboutit avec les autres. (Task 7.)

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | `PrintSheetLayout`, `PrintSheetGeneration`, enums, `ActivityType` |
| `src/lib/print-sheets/units.ts` (nouveau) | conversions px/mm/pt, dixièmes de mm |
| `src/lib/print-sheets/compute-layout.ts` (nouveau) | `computeSheetLayout` (pur) |
| `src/lib/print-sheets/placements.ts` (nouveau) | `planPlacements`, `slotAnchor` (pur) |
| `src/lib/print-sheets/compose.ts` (nouveau) | `composeSheets` (pdf-lib) |
| `src/lib/print-sheets/layout-input.ts` (nouveau) | schéma zod d'un gabarit, `toLayoutSpec` |
| `src/lib/print-sheets/generations.ts` (nouveau) | `createGeneration`, `orderRegistrations` |
| `src/lib/print-sheets/run-generation.ts` (nouveau) | `claimGeneration`, `runGeneration`, `recoverStaleGenerations` |
| `src/lib/jobs/worker-loop.ts` | lance une génération à la fois, sans bloquer les emails |
| `src/app/api/platform/print/layouts/**` (nouveau) | CRUD des gabarits |
| `src/app/api/platform/print/sheets/**` (nouveau) | création, liste, statut d'une génération |
| `src/app/api/files/[...path]/route.ts` | clé sensible `print-sheets/` réservée au staff |
| `src/components/staff/print/SheetPreview.tsx` (nouveau, client) | schéma SVG |
| `src/components/staff/print/LayoutManager.tsx` (nouveau, client) | liste + formulaire des gabarits |
| `src/components/staff/print/GenerationForm.tsx`, `GenerationList.tsx` (nouveaux, client) | génération |
| `src/app/platform/print/layouts/page.tsx`, `src/app/platform/print/sheets/page.tsx` (nouveaux) | pages |
| `src/components/staff/StaffShell.tsx` | groupe « Impression » |
| `docker-compose.yml`, `docker-compose.preprod.yml` | `RENDERER_URL` + réseau `rendu` pour `worker` |
| `docs/v4/features/impression-planches.md` (nouveau), `docs/v4/README.md` | documentation |

---

## Task 1 — Schéma, dépendance `pdf-lib`, libellés d'activité

**Files :**
- Modify : `prisma/schema.prisma`, `package.json`, `yarn.lock`, `src/test-setup.ts`,
  `src/lib/activity-labels.ts`
- Test : `src/lib/__tests__/activity-labels.test.ts` (existant, compléter)

**Interfaces :**
- Produces :
  - `enum SheetOrientation { PORTRAIT LANDSCAPE }`
  - `enum BadgeOrientation { AUTO ORIGINAL ROTATED }`
  - `enum DuplexFlip { LONG_EDGE SHORT_EDGE }`
  - `enum PrintSheetGenerationStatus { PENDING RUNNING DONE FAILED }`
  - `enum GenerationOutput { SHEETS ZIP }` (ZIP : export de l'organisateur, Task 11)
  - `model PrintSheetLayout { id cuid, name String @unique, sheetWidth Int, sheetHeight Int,
    sheetOrientation SheetOrientation, marginTop Int, marginRight Int, marginBottom Int,
    marginLeft Int, gapHorizontal Int, gapVertical Int, badgeOrientation BadgeOrientation
    @default(AUTO), duplexFlip DuplexFlip @default(LONG_EDGE), cropMarks Boolean
    @default(true), archived Boolean @default(false), archivedAt DateTime?, createdById
    String? (User, SetNull), createdAt, updatedAt }` — toutes les longueurs en dixièmes de
    mm ; `sheetWidth <= sheetHeight` (format stocké en portrait).
  - `model PrintSheetGeneration { id cuid, output GenerationOutput @default(SHEETS),
    eventId (Event, Cascade), layoutId String? (PrintSheetLayout, SetNull), layoutSnapshot
    Json? (null pour ZIP), duplex Boolean @default(false), registrationIds Json
    (string[] ordonné), status PrintSheetGenerationStatus @default(PENDING), attempts Int
    @default(0), lockedBy String?, heartbeatAt DateTime?, sheetCount Int?, badgeCount Int?,
    skippedIds Json?, fileKey String?, error String? @db.Text, createdById String? (User,
    SetNull), createdAt, startedAt DateTime?, completedAt DateTime?,
    @@index([status, createdAt]), @@index([eventId]) }`
  - `ActivityType` : `PRINT_LAYOUT_CREATED`, `PRINT_LAYOUT_UPDATED`, `PRINT_LAYOUT_ARCHIVED`,
    `PRINT_SHEETS_GENERATED`.

- [ ] **Step 1 : compléter le test des libellés** — dans `activity-labels.test.ts`, vérifier
  que les quatre nouveaux types ont un libellé non vide et un `logKind` (« Impression »).
- [ ] **Step 2 : lancer le test** — attendu : FAIL (types inconnus).
- [ ] **Step 3 : schéma et dépendance** — ajouter enums et modèles ci-dessus ;
  `docker compose -f docker-compose.dev.yml exec app yarn add pdf-lib@1.17.1` ; `make db-push` ;
  ajouter `printSheetGeneration` puis `printSheetLayout` à la purge de `src/test-setup.ts`
  **avant** `event` et `user` ; libellés dans `activity-labels.ts`.
- [ ] **Step 4 : lancer le test** — attendu : PASS. Puis `make typecheck`.
- [ ] **Step 5 : commit** — `feat(impression): schema des gabarits et des planches`.

## Task 2 — Géométrie : `computeSheetLayout`

**Files :**
- Create : `src/lib/print-sheets/units.ts`, `src/lib/print-sheets/compute-layout.ts`
- Test : `src/lib/__tests__/print-sheets-compute-layout.test.ts`

**Interfaces :**
- Produces :
  - `units.ts` : `tenthsToMm(n: number): number`, `mmToTenths(mm: number): number`
    (arrondi à l'entier), `pxToMm(px: number): number`, `mmToPt(mm: number): number`.
  - `type LayoutSpec = { sheetWidthMm: number; sheetHeightMm: number; sheetOrientation:
    "PORTRAIT" | "LANDSCAPE"; marginsMm: { top: number; right: number; bottom: number; left:
    number }; gapHorizontalMm: number; gapVerticalMm: number; badgeOrientation: "AUTO" |
    "ORIGINAL" | "ROTATED"; duplexFlip: "LONG_EDGE" | "SHORT_EDGE"; cropMarks: boolean }`
    (format stocké en portrait ; l'orientation le tourne).
  - `type Rect = { x: number; y: number; width: number; height: number }` en mm, **origine en
    haut à gauche** de la feuille (repère écran, utilisé par l'aperçu ; la conversion vers le
    repère PDF est faite en Task 4).
  - `type CropMark = { x1: number; y1: number; x2: number; y2: number }` (mm, même repère).
  - `type SheetLayout = { sheet: { width: number; height: number }; rotated: boolean;
    columns: number; rows: number; perSheet: number; slots: Rect[] /* ordre de lecture */;
    cropMarks: CropMark[]; warnings: SheetWarning[] }`
  - `type SheetWarning = "CROP_MARKS_TOP_OMITTED" | "CROP_MARKS_RIGHT_OMITTED" |
    "CROP_MARKS_BOTTOM_OMITTED" | "CROP_MARKS_LEFT_OMITTED"`
  - `class BadgeTooLargeError extends Error {}`
  - `computeSheetLayout(spec: LayoutSpec, badge: { widthMm: number; heightMm: number }):
    SheetLayout` — lève `BadgeTooLargeError` si `perSheet === 0`.

Règles (spec 31) : zone utile = feuille − marges ; `cols = floor((utileW + gapH) / (w + gapH))`,
idem lignes ; `AUTO` garde l'orientation qui place le plus de badges, l'originale à égalité ;
grille **centrée** dans la zone utile ; traits de coupe de **5 mm**, à **2 mm** de la grille,
dans le prolongement de chaque bord de colonne (haut et bas) et de ligne (gauche et droite),
omis d'un côté si l'espace réel entre la grille et le bord de la feuille de ce côté est
**< 7 mm** (avertissement correspondant) ; aucun trait si `cropMarks` est faux.

- [ ] **Step 1 : écrire les tests**

```ts
const A3 = { sheetWidthMm: 297, sheetHeightMm: 420, sheetOrientation: "PORTRAIT",
  marginsMm: { top: 10, right: 10, bottom: 10, left: 10 }, gapHorizontalMm: 5,
  gapVerticalMm: 5, badgeOrientation: "AUTO", duplexFlip: "LONG_EDGE", cropMarks: true } as const;

it("A3 portrait, badge 84x120, AUTO garde l'orientation d'origine (9 contre 8)", () => {
  const l = computeSheetLayout(A3, { widthMm: 84, heightMm: 120 });
  expect([l.rotated, l.columns, l.rows, l.perSheet]).toEqual([false, 3, 3, 9]);
  expect(l.slots[0].x).toBeCloseTo(17.5, 2);   // 10 + (277 - 262) / 2
  expect(l.slots[0].y).toBeCloseTo(25, 2);     // 10 + (400 - 370) / 2
  expect(l.slots[1].x).toBeCloseTo(106.5, 2);  // 17.5 + 84 + 5
  expect(l.slots[3].y).toBeCloseTo(150, 2);    // 25 + 120 + 5
});
it("ROTATED forcé : 2 colonnes x 4 lignes, badge 120x84", () => { /* columns 2, rows 4, slots[0].width 120 */ });
it("A3 paysage : la feuille vaut 420 x 297", () => { /* sheet.width 420, sheet.height 297 */ });
it("AUTO choisit la rotation quand seule elle tient (badge 300x100 sur A3 portrait)", () => { /* rotated true */ });
it("ORIGINAL forcé qui ne tient pas lève BadgeTooLargeError", () => { /* badge 300x100, ORIGINAL */ });
it("traits de coupe : 2 par colonne en haut et en bas, 2 par ligne à gauche et à droite", () => {
  // 3 colonnes x 3 lignes -> 6 + 6 + 6 + 6 = 24 traits ; premier trait haut : x1 = x2 = 17.5, y2 = 25 - 2, y1 = 25 - 7
});
it("espace réel < 7 mm : traits omis de ce côté + avertissement", () => {
  // feuille libre 200 x 300, marges 3, espaces 4, badge 95 x 145 : 2 x 2, grille 194 x 294,
  // espace réel 3 mm de chaque côté -> les 4 avertissements, cropMarks vide
});
it("espace réel >= 7 mm grâce au centrage malgré une marge de 3 mm : traits conservés", () => {
  // A3, marges 3, badge 84x120 : espace haut réel = 3 + (414 - 370) / 2 = 25 mm
});
it("cropMarks faux : aucun trait, aucun avertissement", () => {});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL (module absent).
- [ ] **Step 3 : implémenter `units.ts` et `computeSheetLayout`.**
- [ ] **Step 4 : lancer les tests** — attendu : PASS, couverture 100 % des deux fichiers.
- [ ] **Step 5 : commit** — `feat(impression): calcul de la grille des planches`.

## Task 3 — Placements et recto-verso : `planPlacements`

**Files :**
- Create : `src/lib/print-sheets/placements.ts`
- Test : `src/lib/__tests__/print-sheets-placements.test.ts`

**Interfaces :**
- Consumes : `SheetLayout`, `Rect` (Task 2).
- Produces :
  - `type Placement = { sheetIndex: number; face: "RECTO" | "VERSO"; badgeIndex: number;
    pageIndex: 0 | 1; slot: Rect; rotation: 0 | 90 | 180 | 270 }` — `rotation` en degrés
    **anti-horaires**, appliquée au contenu de la page du badge pour qu'il remplisse `slot`.
  - `planPlacements(layout: SheetLayout, spec: Pick<LayoutSpec, "sheetOrientation" |
    "duplexFlip">, opts: { badgeCount: number; duplex: boolean }): { sheetCount: number;
    placements: Placement[] }`
  - Ordre des pages du futur PDF : feuille 1 recto, feuille 1 verso, feuille 2 recto… en
    recto-verso ; une page par feuille sinon. `pageNumber(sheetIndex, face, duplex)` exporté.

Algorithme du verso (non déterminé par la signature) : soit θ la rotation du recto
(0, ou 90 si `layout.rotated`). Le retournement de la feuille est une symétrie S :
- axe **vertical** (x → largeur − x) si (portrait et `LONG_EDGE`) ou (paysage et `SHORT_EDGE`) ;
- axe **horizontal** (y → hauteur − y) sinon.

Le verso d'un badge occupe `S(slot du recto)` et sa rotation vaut **−θ** (mod 360) quand S est
verticale, **180 − θ** (mod 360) quand S est horizontale. (Le verso d'un badge se lit en le
retournant autour de son propre axe vertical ; la composition de ces deux symétries donne
une rotation.)

- [ ] **Step 1 : écrire les tests**

```ts
it("9 par feuille, 20 badges, sans recto-verso : 3 feuilles, la dernière avec 2 badges", () => {
  // sheetCount 3 ; placements.length 20 ; tous face RECTO, pageIndex 0, rotation 0
});
it("recto-verso, portrait LONG_EDGE, badge non pivoté : verso en miroir gauche-droite, rotation 0", () => {
  // badge 0 : recto slot.x 17.5 -> verso slot.x 297 - 17.5 - 84 = 195.5, même y ; pageIndex 1
});
it("recto-verso, portrait SHORT_EDGE : verso en miroir haut-bas, rotation 180", () => {
  // recto y 25 -> verso y 420 - 25 - 120 = 275
});
it("recto-verso, badges pivotés (θ = 90), portrait LONG_EDGE : verso rotation 270", () => {});
it("recto-verso, paysage LONG_EDGE : symétrie horizontale, rotation 180 - θ", () => {});
it("dernière feuille partielle : les versos sont aux emplacements miroirs des rectos présents", () => {
  // 11 badges, 9 par feuille : feuille 2 = badges 9 et 10 aux slots 0 et 1 ; leurs versos aux miroirs des slots 0 et 1
});
it("pageNumber : feuille 2 verso = page 4 en recto-verso", () => {});
it("superposition : pour toute combinaison orientation feuille x badge x retournement, S(verso) = recto", () => {
  // boucle sur les 8 combinaisons : appliquer S au slot du verso redonne exactement le slot du recto (au centième)
});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL.
- [ ] **Step 3 : implémenter `planPlacements` et `pageNumber`.**
- [ ] **Step 4 : lancer les tests** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): placements recto-verso des planches`.

## Task 4 — Composition PDF : `composeSheets`

**Files :**
- Create : `src/lib/print-sheets/compose.ts`, `src/lib/__tests__/helpers/badge-pdf.ts`
- Test : `src/lib/__tests__/print-sheets-compose.test.ts`

**Interfaces :**
- Consumes : `SheetLayout`, `planPlacements`, `pageNumber`, `mmToPt` (Tasks 2-3).
- Produces :
  - `slotAnchor(slotPt: { x: number; y: number; width: number; height: number }, rotation:
    0 | 90 | 180 | 270): { x: number; y: number }` — point d'ancrage à passer à
    `page.drawPage` (pdf-lib tourne autour de ce point) pour que la page tournée remplisse
    exactement le rectangle `slotPt` (repère PDF, origine en bas à gauche).
  - `class BadgeSizeMismatchError extends Error { constructor(readonly badgeIndex: number,
    readonly pageIndex: number) }`
  - `composeSheets(input: { layout: SheetLayout; spec: LayoutSpec; duplex: boolean;
    badgeMm: { width: number; height: number }; badges: Uint8Array[] /* un PDF par badge,
    dans l'ordre */ }): Promise<{ pdf: Uint8Array; sheetCount: number }>`
  - Helper de test `makeBadgePdf(opts: { widthMm: number; heightMm: number; pages: 1 | 2 }):
    Promise<Uint8Array>` (pdf-lib, une marque différente par page).

Approche : conversion slot (repère haut-gauche, mm) → repère PDF en pt
(`yPdf = hauteurFeuille − y − hauteur`) ; `PDFDocument.embedPdf` des pages de chaque badge,
`drawPage(embedded, { x, y, width, height, rotate: degrees(rotation) })` avec la largeur et
la hauteur **de la page du badge** (jamais celles du slot : pas d'échelle) ; traits de coupe
en `drawLine` noir, épaisseur 0,25 pt. Contrôle de chaque page de badge avant pose : écart
> 0,01 mm avec `badgeMm` → `BadgeSizeMismatchError`. Pages de verso absentes si `duplex` est
faux ; un badge d'une page avec `duplex` vrai → `BadgeSizeMismatchError(badgeIndex, 1)`.

- [ ] **Step 1 : écrire les tests**

```ts
it("slotAnchor : rotation 0 -> coin bas gauche ; 90 -> (x + width, y) ; 180 -> (x + width, y + height) ; 270 -> (x, y + height)", () => {});
it("20 badges 84x120 sur A3, sans recto-verso : 3 pages de 841.89 x 1190.55 pt", async () => {});
it("recto-verso : 6 pages, page 2 = verso de la feuille 1", async () => {});
it("chaque badge est posé à 100 % : les XObjects dessinés font 238.11 x 340.16 pt", async () => {
  // relire le PDF produit avec pdf-lib, parcourir les opérateurs `cm` de la page 1, ou contrôler via un spy sur PDFPage.drawPage
});
it("une page de badge de 84 x 121 mm lève BadgeSizeMismatchError(index, 0)", async () => {});
it("recto-verso demandé avec un badge d'une seule page lève BadgeSizeMismatchError(index, 1)", async () => {});
it("traits de coupe : drawLine appelé layout.cropMarks.length fois par feuille recto, jamais au verso", async () => {});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL.
- [ ] **Step 3 : implémenter `slotAnchor` et `composeSheets`.**
- [ ] **Step 4 : lancer les tests** — attendu : PASS.
- [ ] **Step 5 : contrôle visuel** — script jetable (non commité) qui écrit dans le
  scratchpad un PDF de contrôle : badges numérotés avec une flèche « haut » au recto et au
  verso, A3 portrait et paysage, `LONG_EDGE` et `SHORT_EDGE`. L'ouvrir et vérifier à l'œil.
- [ ] **Step 6 : commit** — `feat(impression): composition des planches en PDF`.

## Task 5 — API des gabarits

**Files :**
- Create : `src/lib/print-sheets/layout-input.ts`,
  `src/app/api/platform/print/layouts/route.ts`,
  `src/app/api/platform/print/layouts/[layoutId]/route.ts`
- Test : `src/lib/__tests__/api-platform-print-layouts.test.ts`

**Interfaces :**
- Consumes : `LayoutSpec`, `tenthsToMm` (Task 2), modèles (Task 1).
- Produces :
  - `layoutInputSchema` (zod) : `name` 1–120 ; `sheetWidth`, `sheetHeight` entiers en
    dixièmes de mm, 500–20000 (50 mm à 2 m), `sheetWidth <= sheetHeight` ; marges et espaces
    entiers 0–1000 ; enums ; `cropMarks` booléen.
  - `toLayoutSpec(row: Pick<PrintSheetLayout, ...champs géométriques>): LayoutSpec`.
  - `GET /api/platform/print/layouts?archived=true|false` → `{ layouts }` (`STAFF_OBSERVER`).
  - `POST` → 201 `{ layout }`, 409 `NAME_TAKEN`, 400 `VALIDATION` (`STAFF_ADMIN`),
    `PRINT_LAYOUT_CREATED`.
  - `PATCH /[layoutId]` (champs partiels, `STAFF_ADMIN`) → `{ layout }`,
    `PRINT_LAYOUT_UPDATED` avec `details.changed` (noms des champs modifiés) ; 404.
  - `DELETE /[layoutId]` → archivage (`archived`, `archivedAt`), `PRINT_LAYOUT_ARCHIVED` ;
    jamais de suppression physique.

Modèle : `src/app/api/platform/plans/route.ts` et `src/lib/__tests__/api-platform-plans.test.ts`.

- [ ] **Step 1 : écrire les tests** — contrat minimal par route : 2xx, 401 sans session,
  403 `STAFF_OBSERVER` en écriture, 400 (largeur > hauteur, marge négative, nom vide),
  404, 409 nom pris, assertion `logActivity` ; archivage : le gabarit n'apparaît plus dans
  `archived=false`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter le schéma, `toLayoutSpec` et les routes.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): API des gabarits d'impression`.

## Task 6 — Création d'une génération + API + fichiers sensibles

**Files :**
- Create : `src/lib/print-sheets/generations.ts`,
  `src/app/api/platform/print/sheets/route.ts`,
  `src/app/api/platform/print/sheets/[generationId]/route.ts`
- Modify : `src/app/api/files/[...path]/route.ts`
- Test : `src/lib/__tests__/print-sheets-generations.test.ts`,
  `src/lib/__tests__/api-platform-print-sheets.test.ts`, test existant de `/api/files`

**Interfaces :**
- Consumes : `computeSheetLayout`, `BadgeTooLargeError` (Task 2), `toLayoutSpec` (Task 5),
  `resolveEventTemplate` (`src/lib/badge-templates/render-badge.ts`).
- Produces :
  - `orderRegistrations<T extends { category: { number: number }; snapshotLastName: string;
    snapshotFirstName: string; id: string }>(rows: T[]): T[]` — catégorie, nom, prénom
    (`localeCompare` « fr », sensibilité `base`), puis `id`.
  - `type GenerationSelection = { mode: "ALL" } | { mode: "CATEGORIES"; categoryIds:
    string[] } | { mode: "IDS"; registrationIds: string[] }` (inscriptions `APPROVED` de
    l'évènement uniquement ; `IDS` contenant une inscription non approuvée ou d'un autre
    évènement → `INVALID_SELECTION`).
  - `createGeneration(input: { eventId: string; layoutId: string; selection:
    GenerationSelection; duplex: boolean; userId: string }): Promise<PrintSheetGeneration>`
    — erreurs `GenerationError` codes `LAYOUT_NOT_FOUND` (404), `EVENT_NOT_FOUND` (404),
    `EMPTY_SELECTION` (400), `INVALID_SELECTION` (400), `DUPLEX_UNAVAILABLE` (400, template
    d'une page), `BADGE_TOO_LARGE` (400). Fige `layoutSnapshot` (= `LayoutSpec`) et l'ordre.
  - `POST /api/platform/print/sheets` `{ eventId, layoutId, selection, duplex }` → 201
    `{ generation }` (`STAFF_SUPPORT`), `PRINT_SHEETS_GENERATED` (avec `eventId`, nombre de
    badges, gabarit).
  - `GET /api/platform/print/sheets?eventId=` → 50 dernières générations
    (`STAFF_SUPPORT`), avec évènement, gabarit, auteur.
  - `GET /api/platform/print/sheets/[generationId]` → `{ generation }` (statut pour le
    rafraîchissement de l'écran).
  - `/api/files` : `print-sheets/…` classé sensible, lisible par le **staff uniquement**
    (`STAFF_SUPPORT` minimum), `private, no-store`.

- [ ] **Step 1 : écrire les tests** — `orderRegistrations` (catégorie 2 avant 10, accents
  « Émile » rangé avec « Emile ») ; `createGeneration` : chaque code d'erreur, `ALL` exclut
  `PENDING`/`REJECTED`, ordre figé, snapshot égal au gabarit ; routes : 401, 403
  `STAFF_OBSERVER`, 201 + log ; `/api/files` : 403 pour un non-staff et pour
  `STAFF_OBSERVER` sur `print-sheets/x.pdf`, 200 `no-store` pour `STAFF_SUPPORT`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): creation des generations de planches`.

## Task 7 — Exécution d'une génération dans le worker

**Files :**
- Create : `src/lib/print-sheets/run-generation.ts`
- Modify : `src/lib/jobs/worker-loop.ts`, `src/lib/jobs/constants.ts`,
  `docker-compose.yml`, `docker-compose.preprod.yml`
- Test : `src/lib/__tests__/print-sheets-run-generation.test.ts`,
  `src/lib/jobs/__tests__/worker-loop.test.ts` (existant, compléter)

**Interfaces :**
- Consumes : `createGeneration` (Task 6), `computeSheetLayout`, `composeSheets` (Tasks 2-4),
  `renderBadgePdf`, `loadBadgeRegistration` (`render-badge.ts`), `uploadFile` (`storage.ts`).
- Produces :
  - Constantes : `PRINT_SHEETS_STALE_MS = 180_000`, `PRINT_SHEETS_MAX_ATTEMPTS = 3`.
  - `claimGeneration(opts: { workerId: string; now: Date }): Promise<PrintSheetGeneration |
    null>` — `SELECT … WHERE status = 'PENDING' ORDER BY createdAt LIMIT 1 FOR UPDATE SKIP
    LOCKED`, passe `RUNNING`, `lockedBy`, `heartbeatAt = now`, `startedAt`, `attempts + 1`.
  - `type RunDeps = { renderBadge(registrationId: string): Promise<Uint8Array | null>
    /* null = inscription absente ou non APPROVED */; upload(key: string, pdf: Uint8Array):
    Promise<void>; now(): Date }` et `defaultRunDeps`.
  - `runGeneration(generationId: string, workerId: string, deps?: RunDeps): Promise<"DONE" |
    "FAILED" | "LOCK_LOST">` — rend les badges un par un (concurrence
    `BATCH_RENDER_CONCURRENCY`), met à jour `heartbeatAt` **après chaque badge** sous
    condition `lockedBy = workerId` (perte de verrou → arrêt, `LOCK_LOST`) ; badges `null`
    écartés dans `skippedIds` ; aucun badge restant → `FAILED` « aucun badge à imprimer » ;
    compose, téléverse `print-sheets/{id}.pdf` (`application/pdf`), passe `DONE` avec
    `sheetCount`, `badgeCount`, `fileKey`, `completedAt`. Toute erreur (dont
    `BadgeSizeMismatchError` : message « le badge n° N n'a pas le format attendu »)
    → `FAILED` avec `error`.
  - `output = ZIP` : même boucle de rendu et même battement, puis archive JSZip (un PDF
    par badge, nom `badgeFileName(registration)` de `src/lib/badge-batch.ts`), clé
    `badge-exports/{eventId}/{id}.zip` (`application/zip`) ; `sheetCount` reste nul. Test
    dédié : 3 badges → ZIP de 3 fichiers aux noms attendus.
  - `recoverStaleGenerations(now: Date): Promise<number>` — `RUNNING` dont `heartbeatAt` est
    plus vieux que `PRINT_SHEETS_STALE_MS` : `PENDING` si `attempts < 3`, sinon `FAILED`
    (« génération interrompue trop de fois »).
  - `createWorkerLoop` : nouvelle dépendance `printSheets: { claim, run, recover }` ;
    `runOnce` appelle `recover`, puis, **si aucune génération n'est en cours dans ce
    worker**, `claim` et lance `run` **sans l'attendre** (promesse gardée) ; `stop()`
    n'attend pas la génération (elle sera reprise via le battement).

- [ ] **Step 1 : écrire les tests** — avec `makeBadgePdf` comme `renderBadge` et un `upload`
  espion : DONE (3 badges, 1 feuille, fichier téléversé, clé attendue) ; badge `null`
  écarté et listé ; tous `null` → FAILED ; format faux → FAILED avec message ; verrou repris
  par un autre worker en cours de route → `LOCK_LOST`, rien n'est écrit ; deux
  `claimGeneration` concurrents ne prennent jamais la même ligne ; `recoverStaleGenerations`
  remet en `PENDING` puis passe `FAILED` à la 3e ; boucle : un `run` qui ne se termine pas
  n'empêche pas `processBatch` d'être appelé au tour suivant, et une seule génération à la
  fois.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter `run-generation.ts` et brancher la boucle.**
- [ ] **Step 4 : Docker** — service `worker` de `docker-compose.yml` et
  `docker-compose.preprod.yml` : `environment: RENDERER_URL: http://badge-renderer:3000`
  (preprod : `http://badge-renderer-preprod:3000`) et `networks: [default, rendu]`, comme le
  service `app` du même fichier. Le dev l'a déjà.
- [ ] **Step 5 : lancer** — attendu : PASS ; puis `make lint && make typecheck && make test`.
- [ ] **Step 6 : vérification réelle** — dans le dev, créer une génération (seed + appel API)
  et constater qu'elle passe `DONE` via le worker et le vrai service de rendu.
- [ ] **Step 7 : commit** — `feat(impression): generation des planches par le worker`.

## Task 8 — Écran des gabarits + aperçu SVG + menu « Impression »

**Files :**
- Create : `src/components/staff/print/SheetPreview.tsx`,
  `src/components/staff/print/LayoutManager.tsx`, `src/app/platform/print/layouts/page.tsx`
- Modify : `src/components/staff/StaffShell.tsx`

**Interfaces :**
- Consumes : `computeSheetLayout`, `BadgeTooLargeError`, `tenthsToMm`, `pxToMm` (Task 2),
  API Task 5.
- Produces :
  - `SheetPreview({ spec: LayoutSpec; badgeMm: { width: number; height: number } | null;
    badgeCount?: number })` — SVG à l'échelle de la feuille : zone de marges, emplacements
    numérotés, traits de coupe, cotes principales ; résumé « 9 badges par feuille » et, si
    `badgeCount`, « 3 feuilles » ; avertissements en clair ; badge trop grand → message
    « Ce badge ne tient pas dans ce gabarit ».
  - `NAV` : groupe `{ group: "Impression" }` puis `{ href: "/platform/print/sheets", label:
    "Planches", icon: "printer" }` et `{ href: "/platform/print/layouts", label:
    "Gabarits", icon: "layout-grid" }` (les specs 32 et 33 ajouteront « Catalogue » et
    « Demandes » dans ce groupe).
  - Page `/platform/print/layouts` : liste (nom, format, orientations, badges par feuille
    pour le badge témoin choisi), création, édition, archivage (`STAFF_ADMIN` ; lecture
    seule sinon). Formulaire : préréglages A3 (297 × 420), A4 (210 × 297), SRA3 (320 × 450),
    « Format libre » ; saisie en mm (une décimale) convertie en dixièmes. Badge témoin :
    sélecteur des templates installés (`pageWidthPx`/`pageHeightPx` → mm) ou taille libre ;
    l'aperçu se met à jour à chaque frappe.

Modèle d'écran : `src/components/staff/PlanManager.tsx` ; composants `Card`, `Input`,
`Select`, `Segmented`, `Switch`, `Button`, `Dialog` de `src/components/ui/` ; feedback
`useAsyncAction` + `toastSuccess` / `toastApiError`.

- [ ] **Step 1 : implémenter** `SheetPreview`, `LayoutManager`, la page et le menu.
- [ ] **Step 2 : vérifier au navigateur** (après `make db-seed`), à 375 px et 1280 px :
  créer « A3 test », voir 9 badges pour un badge 84 × 120, passer en paysage, forcer la
  rotation, réduire une marge à 3 mm et voir l'avertissement des traits.
- [ ] **Step 3 : `make lint && make typecheck`.**
- [ ] **Step 4 : commit** — `feat(impression): ecran des gabarits avec apercu`.

## Task 9 — Écran des générations

**Files :**
- Create : `src/components/staff/print/GenerationForm.tsx`,
  `src/components/staff/print/GenerationList.tsx`, `src/app/platform/print/sheets/page.tsx`
- Modify : au besoin une route de lecture pour le formulaire :
  `src/app/api/platform/print/sheets/options/route.ts` (organisations → évènements →
  catégories et inscriptions approuvées, `STAFF_SUPPORT`) ; test
  `src/lib/__tests__/api-platform-print-sheets-options.test.ts`

**Interfaces :**
- Consumes : API Tasks 5-6, `SheetPreview` (Task 8), `DocumentPreview`
  (`src/components/ui/DocumentPreview.tsx`).
- Produces : page `/platform/print/sheets` :
  - **Historique** (`GenerationList`) : date, évènement, gabarit, badges, feuilles, statut
    (`StatusBadge`), auteur ; ligne `DONE` → « Aperçu » (`DocumentPreview` sur
    `/api/files/print-sheets/{id}.pdf`) et « Télécharger » ; `FAILED` → message d'erreur ;
    badges écartés listés. Rafraîchissement toutes les 5 s tant qu'une ligne est
    `PENDING`/`RUNNING` et que l'onglet est visible.
  - **Nouvelle génération** (`GenerationForm`) : organisation → évènement → sélection
    (tous les approuvés / par catégorie / sélection dans une liste cherchable) → gabarit →
    recto-verso (coché et modifiable si le template a 2 pages, masqué sinon) ; à droite,
    `SheetPreview` avec le format réel du badge de l'évènement et le nombre de badges ;
    « Générer » → POST, la ligne apparaît en tête de l'historique.

- [ ] **Step 1 : test de la route `options`** (401, 403 `STAFF_OBSERVER`, 200 : seules les
  inscriptions `APPROVED`, format du template effectif en mm). Lancer → FAIL.
- [ ] **Step 2 : implémenter la route** → PASS.
- [ ] **Step 3 : implémenter les composants et la page.**
- [ ] **Step 4 : vérifier au navigateur** (dev complet avec worker et rendu) : générer les
  planches d'un évènement du seed, attendre `DONE`, ouvrir l'aperçu, télécharger.
- [ ] **Step 5 : `make lint && make typecheck && make test`.**
- [ ] **Step 6 : commit** — `feat(impression): ecran de generation des planches`.

## Task 11 — Export ZIP asynchrone, sans limite (organisateur)

**Files :**
- Create : `src/app/api/org/[orgId]/events/[eventId]/badges/exports/route.ts`,
  `src/app/api/org/[orgId]/events/[eventId]/badges/exports/[exportId]/route.ts`
- Modify : `src/lib/print-sheets/generations.ts` (création `ZIP`),
  `src/app/api/files/[...path]/route.ts`, `src/components/event/BadgeBatchPanel.tsx`,
  `src/lib/badge-batch.ts`
- Delete : `src/app/api/org/[orgId]/events/[eventId]/badges/print-zip/route.ts` et ses tests
- Test : `src/lib/__tests__/api-event-badge-exports.test.ts`, test de `/api/files`,
  tests de `badge-batch` (retirer `MAX_BADGES_PER_BATCH`)

**Interfaces :**
- Consumes : `createGeneration`, `GenerationSelection` (Task 6), worker (Task 7).
- Produces :
  - `createZipExport(input: { eventId: string; registrationIds: string[]; userId: string }):
    Promise<PrintSheetGeneration>` — inscriptions `APPROVED` de l'évènement, ordre de la
    sélection conservé, `output = ZIP` ; `EMPTY_SELECTION`, `INVALID_SELECTION` (400).
  - `POST …/badges/exports` `{ ids: string[] }` (aucun maximum) → 201 `{ export }` ;
    `withEventAuth({ permission: "badge.print", allowArchived: true })` ; `BADGE_BATCH_EXPORTED`
    (type existant) avec le nombre de badges.
  - `GET …/badges/exports/[exportId]` → `{ export }` (statut, `fileKey`) ; 404 si l'export
    n'appartient pas à l'évènement.
  - `/api/files` : `badge-exports/{eventId}/…` sensible, lisible par le staff et par
    `hasEventPermission(ctx, eventId, orgId, "badge.print")`, `private, no-store`.
  - `BadgeBatchPanel` : plus de plafond ni de message « au plus 200 » ; le lien ZIP devient
    « Préparer le ZIP » → POST, puis état « Préparation… (n badges) » rafraîchi toutes les
    3 s, puis « Télécharger le ZIP » (`/api/files/<fileKey>`) ; échec → message d'erreur.
    « Marquer imprimés » envoie la sélection par paquets de 500
    (`…/registrations/print`, inchangée).
  - `MAX_BADGES_PER_BATCH` supprimé de `badge-batch.ts`.

- [ ] **Step 1 : écrire les tests** — routes : 401, 403 (rôle `VIEWER`), 201 avec 750
  identifiants (aucune limite), 400 sélection vide ou inscription non approuvée, 404 export
  d'un autre évènement, `BADGE_BATCH_EXPORTED` loggé ; `/api/files` : `PRINTER` de
  l'évènement lit, `PRINTER` d'un autre évènement reçoit 403.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter**, supprimer `print-zip` et la constante, adapter le panneau.
- [ ] **Step 4 : lancer** — attendu : PASS ; `make lint && make typecheck && make test`.
- [ ] **Step 5 : navigateur** — sélectionner tous les badges d'un évènement du seed,
  préparer le ZIP, le télécharger ; marquer imprimés une sélection.
- [ ] **Step 6 : adapter les e2e existants** du panneau de lot (`e2e/event/…badges…`) qui
  utilisaient le lien `print-zip`.
- [ ] **Step 7 : commit** — `feat(badges): export zip asynchrone sans limite`.

## Task 12 — Sélection de tous les badges, sans limite (ajoutée après la relecture finale)

> Ajoutée le 2026-11-01 : la relecture finale a montré que la liste des badges de
> l'organisateur (`GET …/badges`, `take: 200`) n'affiche que 200 inscriptions et n'offre pas de
> « tout sélectionner » ; la décision 13 (export sans limite) reste donc inatteignable depuis
> l'écran. Corrige aussi le trou de couverture de `src/app/api/platform/print/sheets/options/route.ts`.

**Files :**
- Modify : `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts`, la page
  `/event/[eventId]/badges` et `src/components/event/BadgeListTable.tsx`,
  `src/app/api/platform/print/sheets/options/route.ts` (tests seulement si possible)
- Test : tests de la route `badges` (existants, compléter), test de la route `options`, e2e
  `e2e/event/badges.spec.ts`

**Interfaces :**
- Produces :
  - `GET …/badges?filter=all|unprinted|printed&q=&categoryId=&page=&pageSize=` → `{ registrations,
    total, page, pageSize }` (pageSize 100 par défaut, 500 au plus) ; tri inchangé.
  - `GET …/badges/ids?filter=…&q=&categoryId=` → `{ ids: string[] }` : **tous** les ids
    correspondant aux filtres, sans limite (pour « tout sélectionner »), `badge.print`.
  - `BadgeListTable` : pagination ; case « Tout sélectionner (N) » qui sélectionne les N
    inscriptions correspondant aux filtres courants via `…/badges/ids` (pas seulement la page
    affichée) ; compteur de sélection exact ; la sélection traverse les pages ; l'ouverture du lot
    passe par le transport `?sel=` existant.

- [ ] **Step 1 : tests** — route `badges` : `total` exact avec 250 inscriptions approuvées,
  pages 1 à 3 de 100, filtres ; route `ids` : 1 200 ids renvoyés sans troncature, filtres
  respectés, 403 hors `badge.print`, rien d'un autre évènement ; route `options` : couvrir les
  lignes non couvertes (voir `make test-coverage`).
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** routes et écran.
- [ ] **Step 4 : lancer** — PASS ; `make lint && make typecheck && make test-coverage` : le seuil
  de 100 % ne doit plus échouer que sur des fichiers non modifiés par la branche
  (`render-badge.ts`, `types.ts`, trous antérieurs).
- [ ] **Step 5 : e2e** — « Tout sélectionner » sur un évènement de plus de 100 badges (créé par
  le helper e2e), ouvrir le lot, le compteur annonce le total, préparer le ZIP.
- [ ] **Step 6 : commit** — `feat(badges): selection de tous les badges sans limite`.

## Task 10 — E2E et documentation

**Files :**
- Create : `e2e/platform/print-layouts.spec.ts`, `e2e/platform/print-sheets.spec.ts`,
  `docs/v4/features/impression-planches.md`
- Modify : `docs/v4/README.md` (index et état), `e2e/helpers/db.ts` (helpers de création de
  gabarit et de génération si besoin)

**Interfaces :**
- Consumes : tout ce qui précède. Règles e2e : un fichier par page, jamais `page.request`
  dans une spec UI, helpers de `e2e/helpers/` (`loginAndEnter`, `db`, `pdf`).

- [ ] **Step 1 : `print-layouts.spec.ts`** — `STAFF_ADMIN` crée un gabarit A3, l'aperçu
  annonce « 9 badges par feuille » pour un badge 84 × 120, modifie une marge, archive ;
  `STAFF_OBSERVER` voit la liste sans bouton d'écriture.
- [ ] **Step 2 : `print-sheets.spec.ts`** — `STAFF_SUPPORT` lance une génération sur un
  évènement du seed, la ligne passe à « Terminée » (worker de dev), le PDF téléchargé a le
  nombre de pages attendu (helper `e2e/helpers/pdf.ts`) ; un non-staff reçoit 403 sur
  `/api/files/print-sheets/…`.
- [ ] **Step 3 : lancer les e2e** — attendu : PASS.
- [ ] **Step 4 : documentation** — `features/impression-planches.md` (gabarits, règles de
  calcul, recto-verso et bord de retournement, génération, droits, limites) ; ligne dans
  `docs/v4/README.md`.
- [ ] **Step 5 : commit** — `docs(impression): planches d'impression`.

## Vérification finale

- [ ] `make lint && make typecheck && make test` (couverture 100 %).
- [ ] E2E des deux pages.
- [ ] Un vrai PDF de planches (A3, recto-verso, badges pivotés) ouvert et contrôlé à l'écran.
- [ ] **Avant la première vraie commande** : l'utilisateur imprime une planche de contrôle
  recto-verso chez l'imprimeur (ou sur une imprimante recto-verso) et vérifie à la lumière
  que chaque verso est derrière son recto. Régler `duplexFlip` du gabarit selon le résultat.
