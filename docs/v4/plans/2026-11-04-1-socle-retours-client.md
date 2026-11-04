# Vague 1 — Socle du chantier « Retours client » — Plan d'implémentation

> **Exécution :** dans le **dossier principal** (pas de stack d'agent), sur `feat/retours-client-v3`.
> Toutes les commandes `make` tournent dans le conteneur de dev (`make dev` d'abord). En exécution
> automatisée, **un commit par tâche** est autorisé sur `feat/retours-client-v3` ; sinon aucun commit
> sans demande. Message de commit en français ASCII, style conventional commits, sans trailer ni
> mention d'outil IA. Sous-agents éventuels sur Sonnet.
>
> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans`. Les étapes utilisent des cases `- [ ]`.

**Objectif :** figer les contrats partagés des lots 2a, 2b et 2c : schéma Prisma, lecture de
dimensions d'image, pagination (helper + composants), seed minimal et fabriques de test.

**Architecture :** aucune fonctionnalité visible. On ajoute des champs Prisma (nullables ou avec
défaut), deux modules `src/lib/` purs (`image-dimensions.ts`, `list-query.ts`), on réécrit
`badge-list-query.ts` par-dessus `list-query.ts` (même API exportée), on étend `ui/Pagination.tsx`
(options par défaut + `UrlPagination`), puis seed et fabriques.

**Stack :** Prisma 6 / MySQL 8, Next.js 16, React 19, Vitest 4 (environnement `node`,
`renderToStaticMarkup` pour les composants, pas de testing-library).

**Spec :** [`../specs/2026-11-04-38-v4-retours-client.md`](../specs/2026-11-04-38-v4-retours-client.md)
(section « Socle (vague 1) »).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma Prisma + `ActivityType` + libellés | [x] | 2026-11-04 | |
| 2 | `src/lib/image-dimensions.ts` | [x] | 2026-11-04 | |
| 3 | `src/lib/list-query.ts` + réécriture de `badge-list-query.ts` | [x] | 2026-11-04 | |
| 4 | `Pagination.tsx` (options 10/20/50/100/500) + `UrlPagination` | [x] | 2026-11-04 | |
| 5 | Seed minimal (motifs de rejet, plans `publicVisible`) | [ ] | | |
| 6 | Fabriques (nouveaux champs) | [ ] | | |
| 7 | Vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Créés : `src/lib/image-dimensions.ts`, `src/lib/list-query.ts`,
`src/lib/__tests__/image-dimensions.test.ts`, `src/lib/__tests__/list-query.test.ts`,
`src/lib/__tests__/badge-list-query.test.ts`, `src/components/ui/__tests__/Pagination.test.tsx`.

Modifiés : `prisma/schema.prisma`, `src/lib/activity-labels.ts`,
`src/lib/__tests__/activity-labels.test.ts`, `src/lib/badge-list-query.ts`,
`src/components/ui/Pagination.tsx`, `prisma/seed/minimal.ts`, `prisma/seed/__tests__/minimal.test.ts`,
`src/test/factories.ts`, ce plan (Progression), `docs/v4/specs/2026-11-04-38-v4-retours-client.md`
(journal des arbitrages seulement).

**Lecture seule** (aucun autre fichier ne doit changer) : tout le reste, en particulier
`src/components/event/BadgeListTable.tsx`, `src/app/platform/jobs/**`, `src/lib/jobs/admin.ts` et
`src/app/api/org/[orgId]/events/[eventId]/badges/route.ts` (appartiennent aux lots de la vague 2).
Besoin d'y toucher → **s'arrêter et le signaler**.

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test », valables pour tout test de ce plan) :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (nom en `_test`), jamais sur la base de
  dev ; `make test` / `make test-db` la créent et la mettent au schéma ; garde-fou dans
  `src/test-setup.ts`.
- **Pas de mock de la base ni de Prisma** : MySQL réel. Seuls les services externes se mockent
  (`next/navigation` pour un composant client est un cas hors base, accepté).
- **Fabriques** : données préparées avec `src/test/factories.ts` (faker, vraie base de test), pas de
  `prisma.*.create` dupliqués dans les tests quand une fabrique existe.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander.
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**` (gate `vitest.config.ts`) : chaque
  branche de `image-dimensions.ts`, `list-query.ts` et `badge-list-query.ts` est testée.

Autres contraintes :

- Schéma appliqué par `make db-push` (pas de dossier migrations) ; base de test par `make test-db`
  (qui utilise `--skip-generate` : toujours lancer `make db-push` **avant** pour regénérer le client).
- Tous les champs ajoutés sont nullables ou ont un défaut (aucune donnée existante à reprendre).
- Textes UI en français avec accents ; code et identifiants en anglais ; commentaires de code en
  français (style du fichier : sans accents dans les fichiers qui n'en ont pas).
- `BADGE_PAGE_SIZE_DEFAULT` reste 100.
- Aucune dépendance npm ajoutée (lecture d'en-têtes à la main).

## Review Focus

1. **Octets tronqués ou corrompus** : `readImageDimensions` sur buffer vide, de 3 octets, signature
   valide mais en-tête coupé, JPEG sans marqueur SOF, WebP à dimensions 0 → `null`, jamais d'exception
   (testé en tâche 2).
2. **Faux formats** : un fichier `.png` qui contient du texte ou du PDF → `null` (tâche 2).
3. **Paramètres d'URL hostiles** : `page=-1`, `page=abc`, `page=1e9`, `pageSize=7`, `pageSize=` vide,
   paramètre répété (`?page=2&page=3` → tableau) → valeurs par défaut ou plafonnées, jamais de
   `skip` négatif ni de dépassement (tâche 3).
4. **Ratio dégénéré** : `ratioMatches` avec cible 0 ou négative, dimensions 0 → `false` (tâche 2).
5. **Rétrocompatibilité des listes existantes** : tailles `30` (jobs) et `200` (badges) disparaissent
   de la liste officielle ; voir « Contradictions » en fin de plan (tâches 3 et 4).

## Interfaces produites (contrats de la spec, à reprendre à l'identique)

```ts
// src/lib/image-dimensions.ts
export function readImageDimensions(
  buf: Buffer,
): { width: number; height: number; format: "jpeg" | "png" | "webp" } | null;
export function ratioMatches(
  width: number, height: number, targetWidth: number, targetHeight: number, tolerance = 0.02,
): boolean;
export const ID_PHOTO_RATIO = { width: 7, height: 9 };

// src/lib/list-query.ts
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500];
export const DEFAULT_PAGE_SIZE = 20;
export function parseListPage(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  opts?: { defaultSize?: number },
): { page: number; pageSize: number; skip: number; take: number };
// Ajout du plan (non contractuel, utilisé par UrlPagination et testé en lib) :
export const LIST_PAGE_MAX = 100_000;
export function withListParams(search: string, patch: { page?: number; pageSize?: number }): string;

// src/lib/badge-list-query.ts : API exportée inchangée
//   BADGE_FILTERS, BadgeFilter, BADGE_PAGE_SIZE_DEFAULT (=100), BADGE_PAGE_SIZE_MAX, BADGE_PAGE_MAX,
//   BADGE_LIST_ORDER, parseBadgePage(params: URLSearchParams): { page: number; pageSize: number },
//   buildBadgeWhere(eventId: string, params: URLSearchParams)

// src/components/ui/Pagination.tsx
export function Pagination(props: PaginationProps): JSX.Element | null; // pageSizeOptions défaut = PAGE_SIZE_OPTIONS
export function UrlPagination(props: {
  page: number; totalPages: number; total: number; pageSize: number; pageSizeOptions?: number[];
}): JSX.Element | null; // client : écrit page/pageSize dans l'URL, page=1 si la taille change

// Prisma
// Event: logoOriginal String?, bannerOriginal String?, logoWidth/logoHeight/bannerWidth/bannerHeight Int?
// Payment: listPrice Int?, prorataCredit Int?, coversFrom DateTime?, coversTo DateTime?
// Plan: publicVisible Boolean @default(false), position Int @default(0), description String? @db.Text,
//       features Json?, highlighted Boolean @default(false)
// ActivityType: EVENT_IMAGE_UPDATED, PAYMENT_PRORATA_MISMATCH
```

---

### Task 1 : Schéma Prisma, `ActivityType` et libellés

**Files:**
- Modify: `prisma/schema.prisma` (modèles `Event` l.161, `Plan` l.644, `Payment` l.722 ; enum `ActivityType` l.529)
- Modify: `src/lib/activity-labels.ts`
- Test: `src/lib/__tests__/activity-labels.test.ts`

**Interfaces:**
- Produces : champs Prisma de l'encadré ci-dessus ; types `EVENT_IMAGE_UPDATED` (image logo/bannière
  d'évènement envoyée ou recadrée, lot 2a) et `PAYMENT_PRORATA_MISMATCH` (écart de crédit constaté à
  la confirmation FedaPay, lot 2b, spec volet 2).

- [ ] **Step 1: Test d'abord** — dans `activity-labels.test.ts`, ajouter `"EVENT_IMAGE_UPDATED"` et
  `"PAYMENT_PRORATA_MISMATCH"` à `ALL_ACTIVITY_TYPES`, puis un bloc :

```ts
describe("types retours client", () => {
  it("EVENT_IMAGE_UPDATED : modification, libelle FR", () => {
    expect(logKind(as("EVENT_IMAGE_UPDATED"))).toBe("modification");
    expect(describeActivity(as("EVENT_IMAGE_UPDATED"))).toBe("Image d'événement modifiée");
  });
  it("PAYMENT_PRORATA_MISMATCH : systeme, libelle FR", () => {
    expect(logKind(as("PAYMENT_PRORATA_MISMATCH"))).toBe("systeme");
    expect(describeActivity(as("PAYMENT_PRORATA_MISMATCH"))).toBe("Écart de prorata sur un paiement");
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/lib/__tests__/activity-labels.test.ts`
Expected: FAIL (les deux libellés renvoient le type brut ; `EVENT_IMAGE_UPDATED` finit par
`_UPDATED` donc `logKind` passe déjà, l'échec porte sur `describeActivity`).

- [ ] **Step 3: Modifier `prisma/schema.prisma`** (champs exactement comme dans l'encadré
  « Interfaces produites »). Placer les champs `Event` après `banner` avec un commentaire
  (« clé de l'original avant recadrage ; dimensions de la version recadrée, mémorisées à
  l'enregistrement »), ceux de `Payment` après `mode` (« prix plein, crédit déduit et période
  achetée, fixés à la création / à l'application »), ceux de `Plan` après `price`. Ajouter les deux
  valeurs en fin de l'enum `ActivityType`. Ajouter à `Plan` `@@index([publicVisible, position])`.

- [ ] **Step 4: Ajouter les deux libellés** dans `DESCRIPTIONS` de `src/lib/activity-labels.ts`
  (textes du Step 1). Ne pas toucher `logKind` (le comportement attendu est déjà obtenu par suffixe /
  repli).

- [ ] **Step 5: Appliquer le schéma**

Run: `make db-push`
Expected: « Your database is now in sync with your Prisma schema », client régénéré (aucune perte
de données signalée).

Run: `make test-db`
Expected: même message sur `badge_test`.

- [ ] **Step 6: Vérifier**

Run: `make test FILE=src/lib/__tests__/activity-labels.test.ts && make typecheck`
Expected: PASS ; `tsc` sans erreur.

- [ ] **Step 7: Commit** — `git add prisma/schema.prisma src/lib/activity-labels.ts src/lib/__tests__/activity-labels.test.ts`
  puis `git commit -m "feat(schema): champs images, prorata et tarifs publics, types d'audit"`.

---

### Task 2 : Lecture de dimensions d'image

**Files:**
- Create: `src/lib/image-dimensions.ts`
- Test: `src/lib/__tests__/image-dimensions.test.ts`

**Interfaces:**
- Produces : `readImageDimensions`, `ratioMatches`, `ID_PHOTO_RATIO` (voir encadré).

- [ ] **Step 1: Écrire les tests** (en-têtes fabriqués par des helpers du test, aucun fichier binaire) :
  - helpers `png(w,h)` (signature `89 50 4E 47 0D 0A 1A 0A`, chunk `IHDR` : largeur/hauteur
    big-endian aux offsets 16 et 20), `jpeg(w,h)` (SOI `FFD8`, un segment APP0 factice, puis SOF0
    `FFC0` : hauteur aux octets +5..6, largeur +7..8 big-endian), `webpVp8(w,h)`, `webpVp8l(w,h)`,
    `webpVp8x(w,h)`.
  - `it("lit un PNG")` : `png(1500, 500)` → `{ width: 1500, height: 500, format: "png" }`.
  - `it("lit un JPEG en sautant les segments avant SOF")` (avec APP0 puis SOF2 `FFC2`) → `format: "jpeg"`.
  - `it.each` trois variantes WebP (`VP8 `, `VP8L`, `VP8X`) → bonnes dimensions, `format: "webp"`.
  - `it("renvoie null pour")` : buffer vide ; 3 octets ; PNG tronqué avant IHDR ; JPEG sans SOF
    (SOI + APP0 seulement) ; JPEG dont la longueur de segment dépasse le buffer ; JPEG dont un
    marqueur n'est pas précédé de `FF` ; WebP `RIFF…WEBP` avec chunk inconnu ; WebP tronqué (un cas
    par variante) ; PNG/WebP/JPEG à dimension 0 ; texte `%PDF-1.4…` ; buffer de 12 octets `RIFF….`
    non WEBP.
  - `describe("ratioMatches")` : `(1500,500,3,1)` → true ; `(1500,520,3,1)` → true (écart < 2 %) ;
    `(1500,540,3,1)` → false (écart > 2 %) ; tolérance explicite `(1500,540,3,1,0.1)` → true ;
    `(0,500,3,1)`, `(1500,0,3,1)`, `(1500,500,0,1)`, `(1500,500,3,-1)` → false ;
    `(700,900,ID_PHOTO_RATIO.width,ID_PHOTO_RATIO.height)` → true ; `ID_PHOTO_RATIO` égal à
    `{ width: 7, height: 9 }`.

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/lib/__tests__/image-dimensions.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `src/lib/image-dimensions.ts`**
  - `readImageDimensions(buf)` : détecte le format par signature (PNG 8 octets ; JPEG `FF D8` ; WebP
    `RIFF` aux octets 0-3 et `WEBP` aux octets 8-11) et délègue à trois fonctions internes ; toute
    lecture hors bornes, tout format inconnu, toute dimension ≤ 0 → `null`. Jamais d'exception.
  - PNG : largeur/hauteur uint32 BE aux offsets 16/20, après avoir vérifié que le chunk à l'offset 12
    est `IHDR`.
  - JPEG : parcourir les segments à partir de l'offset 2 ; marqueurs SOF = `C0..CF` sauf `C4`, `C8`,
    `CC` ; hauteur uint16 BE à `offset+5`, largeur à `offset+7` ; avancer de `2 + longueur` du segment ;
    ignorer les octets de bourrage `FF` répétés ; `null` si fin de buffer atteinte.
  - WebP (chunk à l'offset 12) : `"VP8 "` → largeur = uint16 LE à 26 `& 0x3FFF`, hauteur = uint16 LE
    à 28 `& 0x3FFF` ; `"VP8L"` → octet 20 = `0x2F`, puis 28 bits packés à partir de l'octet 21 :
    largeur = `1 + (b0 | (b1 & 0x3F) << 8)`, hauteur = `1 + ((b1 >> 6) | b2 << 2 | (b3 & 0x0F) << 10)` ;
    `"VP8X"` → largeur = `1 + uint24 LE` à 24, hauteur = `1 + uint24 LE` à 27 ; autre chunk → `null`.
  - `ratioMatches` : `false` si une des quatre valeurs n'est pas finie et > 0 ; sinon
    `Math.abs(width/height - targetWidth/targetHeight) / (targetWidth/targetHeight) <= tolerance`.
  - `export const ID_PHOTO_RATIO = { width: 7, height: 9 };`

- [ ] **Step 4: Vérifier le succès et la couverture**

Run: `make test FILE=src/lib/__tests__/image-dimensions.test.ts`
Expected: PASS. Puis `make test-coverage` est repoussé à la tâche 7 ; si une branche reste
non couverte, ajouter le cas au test (jamais modifier le code pour la couverture).

- [ ] **Step 5: Commit** — `git commit -m "feat(lib): lecture des dimensions d'image sans dependance et controle de ratio"`.

---

### Task 3 : `list-query.ts` et réécriture de `badge-list-query.ts`

**Files:**
- Create: `src/lib/list-query.ts`
- Modify: `src/lib/badge-list-query.ts` (remplacer `positiveInt` et le corps de `parseBadgePage`)
- Test: `src/lib/__tests__/list-query.test.ts`, `src/lib/__tests__/badge-list-query.test.ts`

**Interfaces:**
- Produces : `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, `LIST_PAGE_MAX`, `parseListPage`,
  `withListParams` (voir encadré) ; `badge-list-query.ts` conserve toute son API exportée.
- Consumes : rien.

- [ ] **Step 1: Écrire `list-query.test.ts`**
  - `PAGE_SIZE_OPTIONS` égal à `[10, 20, 50, 100, 500]`, `DEFAULT_PAGE_SIZE` à `20`.
  - `parseListPage(new URLSearchParams())` → `{ page: 1, pageSize: 20, skip: 0, take: 20 }`.
  - `?page=3&pageSize=50` → `{ page: 3, pageSize: 50, skip: 100, take: 50 }`.
  - Objet de Next : `{ page: "2", pageSize: "10" }` → `skip: 10` ; `{ page: ["2", "3"] }` → page 2
    (premier élément) ; `{ page: undefined }` → page 1.
  - Hostiles (`it.each`) : `page` = `"0"`, `"-1"`, `"abc"`, `"1.5"`, `""` → 1 ; `"1e9"`, `"999999999"` →
    `LIST_PAGE_MAX` (`skip` fini, `= (100000-1) * pageSize`) ; `pageSize` = `"7"`, `"0"`, `"-10"`,
    `"abc"`, `""`, `"1000"` → 20.
  - `{ defaultSize: 100 }` : sans `pageSize` → 100 ; `pageSize=7` → 100 ; `pageSize=50` → 50.
  - `withListParams("q=a&page=4&pageSize=20", { pageSize: 50, page: 1 })` → chaîne contenant
    `q=a`, `page=1`, `pageSize=50` ; `withListParams("", { page: 2 })` → `"page=2"` ;
    `withListParams("?x=1", {})` → `"x=1"` (le `?` initial est toléré, aucun paramètre autre n'est perdu).

- [ ] **Step 2: Écrire `badge-list-query.test.ts`** (les API de liste sont déjà couvertes par
  `api-event-badges.test.ts`, mais la lib doit l'être seule) :
  - `BADGE_PAGE_SIZE_DEFAULT === 100`, `BADGE_PAGE_SIZE_MAX === 500`.
  - `parseBadgePage(new URLSearchParams())` → `{ page: 1, pageSize: 100 }` ;
    `?page=2&pageSize=50` → `{ page: 2, pageSize: 50 }` ; `?pageSize=7` → 100 ;
    `?page=1e9` → `BADGE_PAGE_MAX`.
  - `buildBadgeWhere("evt", params)` : sans filtre → `{ eventId: "evt", status: "APPROVED" }` ; avec
    `filter=printed|unprinted|allaccess`, `categoryId`, et `q="jean dupont"` (deux jetons, chacun
    dans un `OR` de trois champs) ; `q` blanc ignoré.

- [ ] **Step 3: Vérifier l'échec**

Run: `make test FILE=src/lib/__tests__/list-query.test.ts`
Expected: FAIL (module introuvable). (`badge-list-query.test.ts` passe déjà sauf le cas `?pageSize=7`.)

- [ ] **Step 4: Implémenter `src/lib/list-query.ts`** : constantes de l'encadré ;
  `parseListPage` prend la première valeur si tableau, accepte un entier décimal strict
  (`/^\d+$/`, converti par `Number`) ; `page` = valeur ≥ 1 plafonnée à `LIST_PAGE_MAX`, sinon 1 ;
  `pageSize` doit appartenir à `PAGE_SIZE_OPTIONS`, sinon `opts.defaultSize ?? DEFAULT_PAGE_SIZE` ;
  `skip = (page - 1) * pageSize`, `take = pageSize`. `withListParams` : `new URLSearchParams(search)`,
  pose `page` / `pageSize` présents dans `patch`, renvoie `toString()`. Fonctions pures, sans import
  de `next`.

- [ ] **Step 5: Réécrire `badge-list-query.ts`** : `BADGE_PAGE_SIZE_DEFAULT = 100` (inchangé),
  `BADGE_PAGE_SIZE_MAX = PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1]`,
  `BADGE_PAGE_MAX = LIST_PAGE_MAX`, `parseBadgePage(params)` renvoie
  `{ page, pageSize }` issus de `parseListPage(params, { defaultSize: BADGE_PAGE_SIZE_DEFAULT })`.
  Supprimer `positiveInt`. `BADGE_FILTERS`, `BadgeFilter`, `BADGE_LIST_ORDER`, `buildBadgeWhere`
  restent identiques.

- [ ] **Step 6: Vérifier**

Run: `make test FILE=src/lib/__tests__/list-query.test.ts && make test FILE=src/lib/__tests__/badge-list-query.test.ts && make test FILE=src/lib/__tests__/api-event-badges.test.ts && make test FILE=src/lib/__tests__/api-event-badge-batch.test.ts`
Expected: tous PASS (si `api-event-badges.test.ts` utilise une taille hors liste, l'écrire dans
« Notes » et la signaler : ne pas modifier le code pour le test).

- [ ] **Step 7: Commit** — `git commit -m "feat(lib): lecture partagee des parametres de pagination (10/20/50/100/500)"`.

---

### Task 4 : `Pagination.tsx` et `UrlPagination`

**Files:**
- Modify: `src/components/ui/Pagination.tsx`
- Test: `src/components/ui/__tests__/Pagination.test.tsx`

**Interfaces:**
- Consumes : `PAGE_SIZE_OPTIONS`, `withListParams` de `@/lib/list-query`.
- Produces : `Pagination` (props inchangées ; `pageSizeOptions` par défaut `PAGE_SIZE_OPTIONS`),
  `UrlPagination` (props de l'encadré).

- [ ] **Step 1: Écrire le test** (`renderToStaticMarkup`, style de `Toolbar.test.tsx`) ;
  `vi.mock("next/navigation", …)` renvoie `useRouter: () => ({ push: vi.fn() })`,
  `usePathname: () => "/org/o1/events"`, `useSearchParams: () => new URLSearchParams("q=a&page=2")`
  (mock de navigation, sans lien avec la base) :
  - `Pagination` avec `total=0` → chaîne vide.
  - Sans `pageSizeOptions` : le HTML contient `<option` pour `10 par page`, `20`, `50`, `100`,
    `500` et ne contient pas `30 par page`.
  - Avec `pageSizeOptions={[50, 100]}` : seulement ces deux options (contrat des usages existants).
  - `total=95, pageSize=10, page=1` : `aria-current="page"` sur `1`, bouton « Page précédente »
    `disabled`, texte `95 résultats`.
  - `UrlPagination` rend le même balisage (options 10/20/50/100/500, `total=0` → vide).

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/components/ui/__tests__/Pagination.test.tsx`
Expected: FAIL (`UrlPagination` absent ; `30 par page` encore présent).

- [ ] **Step 3: Modifier `Pagination.tsx`** : supprimer la constante locale
  `PAGE_SIZE_OPTIONS = [10, 20, 30, 50]`, importer celle de `@/lib/list-query`, la prendre comme
  défaut de `pageSizeOptions`. Ajouter `export function UrlPagination(...)` (même fichier, client) :
  hooks `useRouter`, `usePathname`, `useSearchParams` de `next/navigation` ; navigation par
  `router.push(`${pathname}?${withListParams(searchParams.toString(), …)}`)` avec
  `onPageChange = p => { page: p }` et `onPageSizeChange = size => { pageSize: size, page: 1 }` ;
  rend `<Pagination … />`. Ne pas modifier la structure visuelle de `Pagination`.

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/components/ui/__tests__/Pagination.test.tsx && make typecheck`
Expected: PASS ; `tsc` sans erreur (`BadgeListTable.tsx` passe `pageSizeOptions` explicite,
`JobsPagination.tsx` n'en passe pas : les deux compilent).

- [ ] **Step 5: Commit** — `git commit -m "feat(ui): pagination 10/20/50/100/500 et UrlPagination pilotee par l'URL"`.

---

### Task 5 : Seed minimal

**Files:**
- Modify: `prisma/seed/minimal.ts` (plans l.216-231, motifs de rejet)
- Test: `prisma/seed/__tests__/minimal.test.ts`

- [ ] **Step 1: Adapter le test** (échoue avant le code) :
  - `reasons: 9` → `13` (partout où 9 apparaît).
  - Nouveau test « pose les 4 motifs de photo d'identité » : après `runMinimalSeed(DEV)`, les libellés
    `"Fond non blanc"`, `"Visage non visible ou non centré"`, `"Photo floue ou sombre"`,
    `"Couvre-chef ou lunettes de soleil"` existent chacun une fois avec `scope: "PROFILE"` et un
    `sortOrder` ; deuxième appel → toujours une seule ligne chacun.
  - Nouveau test « plans publics » : `free` et `Standard` ont `publicVisible: true` ;
    `position` 0 pour `free` et 1 pour `Standard` ; `Standard.highlighted === true`.
  - Nouveau test « respecte les réglages du staff » : mettre `publicVisible: false` et
    `position: 5` sur `Standard`, relancer le seed → inchangés (`update: {}`).
  - Le libellé reste avec accents « non centré » (cohérent avec les libellés de la spec) ; les autres
    libellés du seed sont sans accents : le test fixe le texte exact de la spec.

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=prisma/seed/__tests__/minimal.test.ts`
Expected: FAIL (9 motifs, `publicVisible` faux).

- [ ] **Step 3: Modifier `minimal.ts`** :
  - Ajouter à `rejectionReasonSeeds` (portée `PROFILE`, `sortOrder` 21, 22, 23, 24 pour s'intercaler
    après « Photo non conforme ») les quatre libellés de la spec. Le test vérifie les libellés, pas
    l'ordre exact.
  - `create` des plans : `free` → `publicVisible: true, position: 0` ; `Standard` →
    `publicVisible: true, position: 1, highlighted: true`. Garder `update: {}` (réglages staff
    conservés). Ne pas ajouter de `description` ni `features` (le staff les saisit).

- [ ] **Step 4: Vérifier**

Run: `make test FILE=prisma/seed/__tests__/minimal.test.ts && make test FILE=prisma/seed/__tests__/run.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(seed): motifs de rejet photo d'identite et plans publics par defaut"`.

---

### Task 6 : Fabriques

**Files:**
- Modify: `src/test/factories.ts`

Les nouveaux champs sont tous optionnels : `makeEvent` (`Partial<Prisma.EventUncheckedCreateInput>`)
les accepte déjà par surcharge. Le besoin du socle est d'offrir des fabriques pour les modèles
`Plan` et `Payment` qui n'en ont pas, utiles aux lots 2b.

- [ ] **Step 1: Test d'abord** — créer `src/lib/__tests__/factories-retours-client.test.ts` :
  - `makeEvent(org.id, { logoOriginal: "uploads/o.png", logoWidth: 1500, logoHeight: 500 })` relu en
    base porte ces valeurs ; sans surcharge les six champs d'image valent `null`.
  - `makePlan()` : `name` unique, `publicVisible === false`, `position === 0`, `highlighted === false`,
    `features === null` ; `makePlan({ publicVisible: true, features: ["A", "B"], price: 15000 })`
    relu en base conserve `features` et `price`.
  - `makePayment(org.id, { planId })` : `status: "PENDING"`, `purpose: "SUBSCRIPTION"`, `amount > 0`,
    `listPrice`, `prorataCredit`, `coversFrom`, `coversTo` à `null` ;
    `makePayment(org.id, { coversFrom, coversTo, listPrice: 15000, prorataCredit: 3000, amount: 12000 })`
    relu à l'identique.

- [ ] **Step 2: Vérifier l'échec**

Run: `make test FILE=src/lib/__tests__/factories-retours-client.test.ts`
Expected: FAIL (`makePlan` / `makePayment` non exportés).

- [ ] **Step 3: Ajouter dans `factories.ts`** :
  `makePlan(data: Partial<Prisma.PlanUncheckedCreateInput> = {})` (nom `Plan ${uid()}`,
  `maxEvents: 10`, `maxParticipantsPerEvent: 1000`) et
  `makePayment(orgId: string, data: Partial<Prisma.PaymentUncheckedCreateInput> = {})` (`amount`
  faker entier 1000-50000, `purpose` laissé au défaut). Même style que les autres fabriques
  (retournent la promesse Prisma).

- [ ] **Step 4: Vérifier**

Run: `make test FILE=src/lib/__tests__/factories-retours-client.test.ts && make typecheck`
Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "test(factories): fabriques de plan et de paiement, champs retours client"`.

---

### Task 7 : Vérification

- [ ] **Step 1: Schéma et base de test à jour**

Run: `make db-push && make test-db`
Expected: « already in sync » sur dev puis sur `badge_test`.

- [ ] **Step 2: Chaîne complète**

Run: `make lint && make typecheck && make test-coverage`
Expected: lint sans warning ; `tsc` sans erreur ; tous les tests PASS ; seuils 100 % respectés sur
`src/lib/**` et `src/app/api/**` (en particulier `image-dimensions.ts`, `list-query.ts`,
`badge-list-query.ts` à 100 %). Toute branche non couverte → ajouter un test, jamais d'exclusion ni
de modification du code de prod.

- [ ] **Step 3: Usages existants de `Pagination.tsx`** — confirmer qu'ils compilent (déjà garanti par
  `tsc`) et que leurs tests passent :

Run: `grep -rn "ui/Pagination" src` puis
`make test FILE=src/lib/__tests__/api-event-badges.test.ts && make test FILE=src/app/api/platform/jobs/__tests__/jobs-api.test.ts && make test FILE=src/components/layout/__tests__/space-shells.test.tsx`
Expected: seuls `BadgeListTable.tsx` et `src/app/platform/jobs/_components/JobsPagination.tsx`
(plus `UrlPagination` interne) importent le composant ; les trois fichiers de test PASS.

- [ ] **Step 4: Contrôle visuel rapide** (obligatoire pour l'UI, dev tournant) : ouvrir la liste des
  badges d'un évènement du seed démo et `/platform/jobs` ; la barre de pagination s'affiche, le
  sélecteur de taille de la liste des badges propose 50/100/200/500 (options explicites inchangées)
  et celui des jobs propose 10/20/50/100/500. Noter le résultat dans « Notes ».

- [ ] **Step 5: Journal et progression** — mettre la table Progression à `[x]` datée ; ajouter au
  journal de la spec les arbitrages de la section ci-dessous (taille 30 des jobs, 200 des badges,
  `withListParams`, `PAYMENT_PRORATA_MISMATCH`). Commit : `git commit -m "docs(v4): progression du socle retours client"`.

---

## Contradictions et points signalés (spec ↔ code)

1. **Jobs** : `src/lib/jobs/admin.ts` valide `pageSize` contre `JOB_PAGE_SIZES = [10, 20, 30, 50]`
   (défaut 20). Une fois `Pagination` par défaut en 10/20/50/100/500, `JobsPagination` proposera
   100 et 500 que le serveur remplace par 20, et 30 n'est plus proposé. Les fichiers sont au lot 2c
   (`src/lib/jobs/admin.ts` y figure déjà) : **2c doit faire passer les jobs sur `parseListPage`**.
   Transitoire sans gravité entre les vagues 1 et 2.
2. **Badges** : `BadgeListTable.tsx` propose `[50, 100, 200, 500]` ; `200` n'est pas dans la liste
   officielle, donc `parseBadgePage` le ramène à 100 (avant : accepté, tout entier ≤ 500). Même
   remède côté 2c (retirer 200 du tableau).
3. **`parseBadgePage`** acceptait toute taille entière 1-500 ; il n'accepte plus que la liste. C'est
   la conséquence voulue de « valeur hors liste → défaut » de la spec.
4. La spec laisse « les nouveaux types dont les lots ont besoin (ex. `EVENT_IMAGE_UPDATED`) » : le
   plan fige `EVENT_IMAGE_UPDATED` et `PAYMENT_PRORATA_MISMATCH` (volet 2 : « écart tracé dans
   l'audit »). Un lot qui a besoin d'un autre type doit s'arrêter et le signaler.
5. `withListParams` et `LIST_PAGE_MAX` sont des ajouts au contrat (besoin de tester l'URL de
   `UrlPagination` en couverture `src/lib`) ; `makePlan` / `makePayment` sont ajoutés à
   `src/test/factories.ts` (la spec ne demande que « nouveaux champs », qui passent déjà par
   surcharge).
