# Catalogue des produits d'impression — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'admin de la plateforme gère un catalogue de produits d'impression (support du
badge et accessoires) avec tarifs dégressifs, galerie d'images et options riches ; les
organisateurs le parcourent dans l'assistant de demande (spec 33) avec un prix estimé
recalculé en direct.

**Architecture :** trois couches. (1) Calcul **pur et isomorphe** dans
`src/lib/print-catalog/pricing-core.ts` (palier, suppléments, validation des choix, copie
figée) : aucune base, importable par un composant client. `pricing.ts` le réexporte et ajoute
`loadProductForPricing` (Prisma) : c'est le point d'entrée serveur du plan 33. (2) Écriture
du catalogue dans `src/lib/print-catalog/products.ts` et `content.ts` (galerie, paliers et
options remplacés d'un bloc, en transaction), exposée par des routes staff sous
`/api/platform/print/products/**`, une route d'upload plateforme et une route de lecture
`GET /api/print/catalog`. (3) Écrans staff sous `/platform/print/catalog/**` et composants
vitrine réutilisables `src/components/print/` (consommés par le plan 33).

**Tech Stack :** Next.js 16 App Router, Prisma 6 / MySQL 8, zod, Vitest 4 (BDD réelle,
MinIO réel pour l'upload), Playwright. Aucune nouvelle dépendance.

**Spec :** [`docs/v4/specs/2026-11-01-32-v4-catalogue-produits-d-impression.md`](../specs/2026-11-01-32-v4-catalogue-produits-d-impression.md)
(consommation : [spec 33](../specs/2026-11-01-33-v4-demandes-d-impression-et-devis.md))

**Branche :** `feat/service-impression` (créée depuis `development` le 2026-11-01)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma, libellés d'activité, purge des tests | [ ] | | |
| 2 | Prix : palier, suppléments, « à partir de » | [ ] | | |
| 3 | Validation des choix et copie figée | [ ] | | |
| 4 | Lecture : `loadProductForPricing`, vitrine, `GET /api/print/catalog` | [ ] | | |
| 5 | Upload plateforme + clés `print-requests/` réservées au staff | [ ] | | |
| 6 | API produits : création, modification, archivage | [ ] | | |
| 7 | API galerie, paliers et options | [ ] | | |
| 8 | Composants vitrine `ProductCard` et `ProductConfigurator` | [ ] | | |
| 9 | Écran liste du catalogue + entrée « Catalogue » | [ ] | | dépend de la Task 8 du plan 31 (groupe « Impression ») |
| 10 | Écran d'édition d'un produit + aperçu | [ ] | | |
| 11 | E2E et documentation | [ ] | | |
| — | Vérification finale (lint, typecheck, test, e2e) | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée. En cas d'interruption, passez la ligne à `[~]` et notez
précisément l'état.

## Contraintes globales

- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en
  français, dans le style du fichier touché. Commits et noms de fichiers en ASCII.
- **Prix en FCFA, entiers** (`Int`, comme `Plan.price`). Affichage via `formatFcfa`
  (`Intl.NumberFormat("fr-FR")` : séparateur de milliers U+202F, ex. `"70 000 FCFA"`).
- **Le prix calculé est une estimation** ; l'admin fixe le prix final dans le devis (spec 33).
- **Soft delete partout** : produit, option et valeur sont archivés, jamais supprimés. Une
  écriture sur un produit archivé → `409 PRODUCT_ARCHIVED`.
- **Droits** : lecture staff `STAFF_OBSERVER` (layout `/platform`), écriture `STAFF_ADMIN`.
  `withStaffAuth(handler, { minRole })` (`src/lib/with-staff-auth.ts`). Erreurs API au format
  `{ error: CODE, message: "Phrase en français." }` (lu par `apiErrorMessage`).
- **Toute action sensible loggée** via `logActivity` ; chaque nouvel `ActivityType` reçoit un
  libellé dans `src/lib/activity-labels.ts`.
- **Uploads** : règles de `storage.ts` (`isAllowedMime`, `MAX_UPLOAD_BYTES` = 5 Mo). Images
  produit JPEG/PNG/WebP, servies publiquement par `/api/files`.
- **Aucune nouvelle dépendance, aucune nouvelle variable d'environnement.**
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**`. Tests sur la **vraie MySQL** ;
  nouveaux modèles ajoutés à la purge de `src/test-setup.ts` dans l'ordre des FK.
- **Commandes** (conteneur dev, `make dev` lancé) :
  - un fichier : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - schéma : `make db-push` ;
  - avant de déclarer une task terminée : `make lint && make typecheck && make test`.
- **`make test` vide la BDD de dev** : `make db-seed` avant toute vérification navigateur.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Les étapes « commit » de ce
  plan ne valent pas autorisation. Jamais de trailer de co-auteur.
- **Pas de déploiement, pas de SSH, pas de prod.**

## Points de vigilance de revue

1. **`pricing-core.ts` n'importe jamais Prisma** (ni rien qui l'importe) : il est chargé par
   `ProductConfigurator` côté navigateur. Seul `pricing.ts` touche la base. (Tasks 2-4.)
2. **`QUANTITY_SPLIT`** : supplément pondéré arrondi, et `Σ snapshot.priceDelta + palier =
   unitPriceFor` doit tenir aussi avec l'arrondi. (Tasks 2-3.)
3. **Remplacement des options d'un bloc** : une option ou valeur absente de la liste est
   **archivée** (pas supprimée), un `id` d'un autre produit est refusé, et une valeur
   existante garde son `id` (les copies figées et les brouillons du plan 33 s'y réfèrent).
   (Task 7.)
4. **`/api/files` est aussi modifié par le plan 31** (`print-sheets/`) : fusionner les deux
   classements sans en perdre un ; `platform/print-products/` reste **public**,
   `print-requests/` est **sensible**. (Task 5.)
5. **Vitrine** : un produit brouillon, archivé, ou une option/valeur archivée n'apparaît
   jamais dans `GET /api/print/catalog`, mais `loadProductForPricing` les renvoie (pour que
   `validateChoices` réponde `VALUE_ARCHIVED` plutôt que « inconnue »). (Task 4.)

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | 5 modèles `PrintProduct*`, 2 enums, 3 `ActivityType` |
| `src/lib/print-catalog/pricing-core.ts` (nouveau) | types partagés, calcul, validation, copie figée (pur) |
| `src/lib/print-catalog/pricing.ts` (nouveau) | réexport + `loadProductForPricing` (contrat du plan 33) |
| `src/lib/print-catalog/catalog.ts` (nouveau) | `listPublishedCatalog`, `getProductDetail`, `toCatalogProduct` |
| `src/lib/print-catalog/input.ts` (nouveau) | schémas zod des écritures |
| `src/lib/print-catalog/products.ts` (nouveau) | `CatalogError`, slug, création, modification, archivage, liste staff |
| `src/lib/print-catalog/content.ts` (nouveau) | `replaceImages`, `replaceTiers`, `syncOptions` |
| `src/app/api/print/catalog/route.ts` (nouveau) | lecture de la vitrine |
| `src/app/api/platform/upload/route.ts` (nouveau) | upload plateforme `print-product` / `print-request` |
| `src/app/api/platform/print/products/**` (nouveau) | écritures staff |
| `src/app/api/files/[...path]/route.ts` | `print-requests/` sensible, staff uniquement |
| `src/components/print/ProductCard.tsx`, `ProductConfigurator.tsx` (nouveaux, client) | vitrine réutilisable |
| `src/components/staff/print/CatalogList.tsx`, `ProductEditor.tsx` (nouveaux, client) | écrans staff |
| `src/app/platform/print/catalog/page.tsx`, `[productId]/page.tsx` (nouveaux) | pages |
| `src/components/staff/StaffShell.tsx`, `src/components/ui/Icon.tsx` | entrée « Catalogue », icône `package` |
| `e2e/platform/print-catalog.spec.ts`, `print-catalog-product.spec.ts` (nouveaux) | e2e |
| `docs/v4/features/impression-catalogue.md` (nouveau), `docs/v4/README.md` | documentation |

---

## Task 1 — Schéma, libellés d'activité, purge des tests

**Files :**
- Modify : `prisma/schema.prisma`, `src/test-setup.ts`, `src/lib/activity-labels.ts`
- Test : `src/lib/__tests__/activity-labels.test.ts` (existant, compléter)

**Interfaces :**
- Produces :
  - `enum PrintProductKind { BADGE ACCESSORY }`
  - `enum PrintOptionType { CHOICE MULTI_CHOICE COLOR TEXT FILE QUANTITY_SPLIT }`
  - `model PrintProduct { id cuid, kind PrintProductKind, name String @db.VarChar(120),
    slug String @unique, category String? @db.VarChar(60), description String? @db.Text,
    basePrice Int, minQuantity Int @default(1), leadTimeDays Int?, position Int @default(0),
    published Boolean @default(false), archived Boolean @default(false), archivedAt
    DateTime?, createdById String? (User, SetNull), createdAt, updatedAt @updatedAt,
    images PrintProductImage[], priceTiers PrintProductPriceTier[], options
    PrintProductOption[], @@index([kind, archived, published]) }`
  - `model PrintProductImage { id cuid, productId (PrintProduct, Cascade), storageKey String,
    alt String @default("") @db.VarChar(200), position Int, @@index([productId, position]) }`
  - `model PrintProductPriceTier { id cuid, productId (PrintProduct, Cascade), minQuantity
    Int, unitPrice Int, @@unique([productId, minQuantity]) }`
  - `model PrintProductOption { id cuid, productId (PrintProduct, Cascade), name String
    @db.VarChar(80), help String? @db.VarChar(300), type PrintOptionType, required Boolean
    @default(false), priceDelta Int @default(0) /* TEXT et FILE */, maxLength Int? /* TEXT */,
    position Int, archived Boolean @default(false), archivedAt DateTime?, values
    PrintProductOptionValue[], @@index([productId, position]) }`
  - `model PrintProductOptionValue { id cuid, optionId (PrintProductOption, Cascade), label
    String @db.VarChar(80), colorHex String? @db.VarChar(7), imageKey String?, priceDelta Int
    @default(0), position Int, archived Boolean @default(false), archivedAt DateTime?,
    @@index([optionId, position]) }`
  - `User.printProducts PrintProduct[]`
  - `ActivityType` : `PRINT_PRODUCT_CREATED`, `PRINT_PRODUCT_UPDATED`, `PRINT_PRODUCT_ARCHIVED`
    (classés par `logKind` via les suffixes existants : création, modification, suppression).

- [ ] **Step 1 : compléter le test des libellés** — dans `activity-labels.test.ts`, à côté de
  `PRINT_TYPES` : les trois types ont un libellé non vide ; `logKind` donne `"creation"`,
  `"modification"`, `"suppression"`.
- [ ] **Step 2 : lancer le test** — attendu : FAIL (types inconnus).
- [ ] **Step 3 : schéma et libellés** — ajouter enums, modèles et types ci-dessus ;
  `make db-push` ; `await prisma.printProduct.deleteMany();` dans `src/test-setup.ts` **avant**
  `user` (les enfants partent en cascade) ; libellés « Produit d'impression créé »,
  « Produit d'impression modifié », « Produit d'impression archivé ».
- [ ] **Step 4 : lancer le test** — attendu : PASS. Puis `make typecheck`.
- [ ] **Step 5 : commit** — `feat(impression): schema du catalogue de produits`.

## Task 2 — Prix : palier, suppléments, « à partir de »

**Files :**
- Create : `src/lib/print-catalog/pricing-core.ts`
- Test : `src/lib/__tests__/print-catalog-pricing.test.ts`

**Interfaces :**
- Produces (dans `pricing-core.ts`, **sans aucun import de `@/lib/prisma` ni de
  `@prisma/client`** ; les enums sont des unions de chaînes) :
  - `type PrintOptionTypeName = "CHOICE" | "MULTI_CHOICE" | "COLOR" | "TEXT" | "FILE" |
    "QUANTITY_SPLIT"`
  - `type PricingValue = { id: string; label: string; colorHex: string | null; imageKey:
    string | null; priceDelta: number; archived: boolean }`
  - `type PricingOption = { id: string; name: string; help: string | null; type:
    PrintOptionTypeName; required: boolean; priceDelta: number; maxLength: number | null;
    archived: boolean; values: PricingValue[] }`
  - `type ProductForPricing = { id: string; kind: "BADGE" | "ACCESSORY"; name: string;
    basePrice: number; minQuantity: number; published: boolean; archived: boolean;
    priceTiers: { minQuantity: number; unitPrice: number }[]; options: PricingOption[] }`
  - `type CatalogProduct = ProductForPricing & { slug: string; category: string | null;
    description: string | null; leadTimeDays: number | null; images: { storageKey: string;
    alt: string }[] }` (forme renvoyée par la vitrine et passée aux composants)
  - `type OptionChoice = { optionId: string; valueIds?: string[]; text?: string; fileKey?:
    string; split?: { valueId: string; quantity: number }[] }`
  - `tierPriceFor(product: Pick<ProductForPricing, "basePrice" | "priceTiers">, quantity:
    number): number` — `unitPrice` du palier au `minQuantity` le plus haut `<= quantity`,
    sinon `basePrice`.
  - `startingPrice(product: Pick<ProductForPricing, "basePrice" | "priceTiers">): number` —
    minimum de `basePrice` et des `unitPrice` des paliers.
  - `unitPriceFor(product: ProductForPricing, quantity: number, choices: OptionChoice[]):
    number` — palier + suppléments ; ne valide pas (appeler `validateChoices` avant) ; ignore
    une option ou valeur inconnue.
  - `formatFcfa(amount: number): string`

Règle des suppléments (par unité) : `CHOICE`, `COLOR`, `MULTI_CHOICE` → somme des
`priceDelta` des valeurs choisies ; `TEXT` → `option.priceDelta` si `text.trim()` est non
vide ; `FILE` → `option.priceDelta` si `fileKey` est présent ; `QUANTITY_SPLIT` →
`Math.round(Σ(value.priceDelta × part.quantity) / quantity)`.

Jeu de test commun (critère d'acceptation, à exporter depuis
`src/lib/__tests__/helpers/print-products.ts` pour les Tasks 3, 4 et 8) :

```ts
export const CORDON: CatalogProduct = {
  id: "p1", kind: "ACCESSORY", name: "Cordon tour de cou 20 mm", slug: "cordon-tour-de-cou-20-mm",
  category: "Cordons", description: null, leadTimeDays: 7, basePrice: 500, minQuantity: 50,
  published: true, archived: false,
  images: [{ storageKey: "platform/print-products/a.jpg", alt: "Cordon rouge" }],
  priceTiers: [{ minQuantity: 100, unitPrice: 450 }, { minQuantity: 500, unitPrice: 400 }],
  options: [
    { id: "o-color", name: "Couleur", help: null, type: "COLOR", required: true, priceDelta: 0,
      maxLength: null, archived: false, values: [
        v("rouge", "Rouge", "#D32F2F", 0), v("bleu", "Bleu", "#1976D2", 0), v("noir", "Noir", "#000000", 0),
        v("blanc", "Blanc", "#FFFFFF", 0), v("or", "Or", "#C9A227", 100)] },
    { id: "o-text", name: "Texte imprimé", help: null, type: "TEXT", required: false,
      priceDelta: 150, maxLength: 30, archived: false, values: [] },
  ],
};
// v(id, label, colorHex, priceDelta) -> PricingValue non archivée, imageKey null
```

- [ ] **Step 1 : écrire les tests**

```ts
it("tierPriceFor : 99 -> 500, 100 -> 450, 499 -> 450, 500 -> 400, 10000 -> 400", () => {});
it("tierPriceFor sans palier -> basePrice", () => {});
it("tierPriceFor ne dépend pas de l'ordre des paliers", () => { /* paliers inversés : 500 -> 400 */ });
it("startingPrice(CORDON) = 400 ; sans palier = basePrice ; palier plus cher que la base ignoré", () => {});
it("cordon x50, Rouge, sans texte : 500", () => {
  expect(unitPriceFor(CORDON, 50, [{ optionId: "o-color", valueIds: ["rouge"] }])).toBe(500);
});
it("cordon x100, Or, texte « Forum 2026 » : 450 + 100 + 150 = 700", () => {});
it("cordon x600, Bleu, texte : 400 + 150 = 550", () => {});
it("texte vide ou blanc : pas de supplément", () => { /* text: "   " -> 450 à x100 */ });
it("MULTI_CHOICE : somme des valeurs choisies", () => { /* deux finitions +30 et +20 -> base + 50 */ });
it("FILE : supplément si fileKey présent, rien sinon", () => {});
it("QUANTITY_SPLIT x200 : Rouge 120 (0), Or 80 (+100) -> 450 + 40 = 490", () => {});
it("QUANTITY_SPLIT x3 : Or 1, Rouge 2 -> 500 + round(33,33) = 533", () => {});
it("option ou valeur inconnue ignorée", () => {});
it("formatFcfa(70000) = « 70 000 FCFA », formatFcfa(0) = « 0 FCFA »", () => {});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL (module absent).
- [ ] **Step 3 : implémenter** les types, `tierPriceFor`, `startingPrice`, `unitPriceFor`,
  `formatFcfa` et le helper de test.
- [ ] **Step 4 : lancer les tests** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): calcul du prix estime d'un produit`.

## Task 3 — Validation des choix et copie figée

**Files :**
- Modify : `src/lib/print-catalog/pricing-core.ts`
- Test : `src/lib/__tests__/print-catalog-choices.test.ts`

**Interfaces :**
- Consumes : types et `unitPriceFor` (Task 2), `CORDON`.
- Produces :
  - `type ChoiceErrorCode = "PRODUCT_UNAVAILABLE" | "QUANTITY_BELOW_MINIMUM" |
    "UNKNOWN_OPTION" | "OPTION_ARCHIVED" | "DUPLICATE_OPTION" | "REQUIRED_OPTION_MISSING" |
    "UNKNOWN_VALUE" | "VALUE_ARCHIVED" | "TOO_MANY_VALUES" | "TEXT_TOO_LONG" | "INVALID_FILE"
    | "SPLIT_MISMATCH"`
  - `validateChoices(product: ProductForPricing, choices: OptionChoice[], quantity: number):
    { ok: true } | { ok: false; code: ChoiceErrorCode; optionId?: string }` — le troisième
    paramètre est nécessaire au contrôle `Σ split = quantité` et au minimum de commande.
  - `type ChoiceSnapshot = { optionName: string; type: string; labels: string[]; text?:
    string; fileKey?: string; split?: { label: string; quantity: number }[]; priceDelta:
    number }`
  - `snapshotChoices(product: ProductForPricing, choices: OptionChoice[], quantity: number):
    ChoiceSnapshot[]` — une entrée par choix non vide, dans l'ordre des options du produit ;
    `priceDelta` = le supplément unitaire de l'option tel que compté par `unitPriceFor` (la
    quantité sert au supplément pondéré de `QUANTITY_SPLIT`).
  - `choiceErrorMessage(code: ChoiceErrorCode): string` (français, ex.
    `REQUIRED_OPTION_MISSING` → « Choisissez une valeur pour chaque option obligatoire. »).
  - `defaultConfiguration(product: ProductForPricing): { quantity: number; choices:
    OptionChoice[] }` — `quantity = minQuantity` ; options `CHOICE`/`COLOR` requises
    pré-remplies avec leur première valeur non archivée ; rien d'autre.

Ordre des contrôles (premier échec renvoyé) : produit `archived` ou non `published` →
`PRODUCT_UNAVAILABLE` ; `quantity < minQuantity` → `QUANTITY_BELOW_MINIMUM` ; puis pour chaque
choix : option absente du produit → `UNKNOWN_OPTION`, archivée → `OPTION_ARCHIVED`, déjà vue
→ `DUPLICATE_OPTION` ; un choix est **vide** si le champ de son type est absent ou vide
(`valueIds` `[]`, `text` blanc, `fileKey` absent, `split` `[]`) et compte comme absent ;
valeurs : inconnue → `UNKNOWN_VALUE`, archivée → `VALUE_ARCHIVED`, plus d'une pour
`CHOICE`/`COLOR` → `TOO_MANY_VALUES` ; `TEXT` plus long que `maxLength` → `TEXT_TOO_LONG` ;
`FILE` dont la clé ne commence pas par `print-requests/` → `INVALID_FILE` ; `split` avec une
part non entière ou `<= 0`, une valeur répétée, ou une somme `!= quantity` →
`SPLIT_MISMATCH` ; enfin option requise non archivée sans choix non vide →
`REQUIRED_OPTION_MISSING`. Tous les codes portent `optionId` sauf les deux premiers.

> Note pour le plan 33 : le contrat prévoyait `validateChoices(product, choices)` et
> `snapshotChoices(product, choices)` ; la quantité est ajoutée en dernier paramètre, sans
> quoi la répartition ne peut pas être contrôlée ni chiffrée.

- [ ] **Step 1 : écrire les tests**

```ts
it("cordon x100, Or + texte : ok", () => {});
it("produit archivé ou brouillon -> PRODUCT_UNAVAILABLE", () => {});
it("x49 pour un minimum de 50 -> QUANTITY_BELOW_MINIMUM", () => {});
it("couleur absente -> REQUIRED_OPTION_MISSING, optionId o-color", () => {});
it("couleur avec valueIds [] -> REQUIRED_OPTION_MISSING (choix vide)", () => {});
it("option inconnue -> UNKNOWN_OPTION ; option archivée -> OPTION_ARCHIVED", () => {});
it("même option deux fois -> DUPLICATE_OPTION", () => {});
it("valeur inconnue -> UNKNOWN_VALUE ; valeur archivée -> VALUE_ARCHIVED", () => {});
it("deux couleurs -> TOO_MANY_VALUES ; MULTI_CHOICE à deux valeurs -> ok", () => {});
it("texte de 31 caractères -> TEXT_TOO_LONG ; 30 -> ok", () => {});
it("fileKey « orgs/x/images/a.png » -> INVALID_FILE ; « print-requests/e1/a.pdf » -> ok", () => {});
it("split 120 + 79 pour 200 -> SPLIT_MISMATCH ; part 0 -> SPLIT_MISMATCH ; valeur répétée -> SPLIT_MISMATCH", () => {});
it("option requise archivée sans choix : ok", () => {});
it("snapshotChoices x100, Or + texte", () => {
  expect(snapshotChoices(CORDON, choices, 100)).toEqual([
    { optionName: "Couleur", type: "COLOR", labels: ["Or"], priceDelta: 100 },
    { optionName: "Texte imprimé", type: "TEXT", labels: [], text: "Forum 2026", priceDelta: 150 },
  ]);
});
it("snapshot QUANTITY_SPLIT x200 : split libellé, priceDelta 40", () => {
  // split: [{ label: "Rouge", quantity: 120 }, { label: "Or", quantity: 80 }]
});
it("invariant : tierPriceFor + Σ snapshot.priceDelta = unitPriceFor (x3 avec répartition arrondie)", () => {});
it("la copie figée ne bouge pas quand le produit change ensuite", () => {
  // snapshot, puis renommer la valeur Or et passer son priceDelta à 200 dans l'objet : le snapshot garde « Or » et 100
});
it("choiceErrorMessage : un message français non vide pour chacun des 12 codes", () => {});
it("defaultConfiguration(CORDON) = { quantity: 50, choices: [{ optionId: 'o-color', valueIds: ['rouge'] }] }", () => {});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `validateChoices`, `snapshotChoices`, `choiceErrorMessage`,
  `defaultConfiguration`.
- [ ] **Step 4 : lancer les tests** — attendu : PASS, couverture 100 % de `pricing-core.ts`.
- [ ] **Step 5 : commit** — `feat(impression): validation et copie figee des options`.

## Task 4 — Lecture : `loadProductForPricing`, vitrine, `GET /api/print/catalog`

**Files :**
- Create : `src/lib/print-catalog/pricing.ts`, `src/lib/print-catalog/catalog.ts`,
  `src/app/api/print/catalog/route.ts`, `src/lib/__tests__/helpers/print-products-db.ts`
- Test : `src/lib/__tests__/print-catalog-read.test.ts`,
  `src/lib/__tests__/api-print-catalog.test.ts`

**Interfaces :**
- Consumes : types de `pricing-core.ts` (Tasks 2-3), modèles (Task 1),
  `getSessionUser` (`src/lib/auth-participant.ts`).
- Produces :
  - `pricing.ts` : `export * from "./pricing-core";` et
    `loadProductForPricing(productId: string): Promise<ProductForPricing | null>` — inclut
    options et valeurs **archivées**, paliers par `minQuantity` croissant, options et valeurs
    par `position`.
  - `catalog.ts` : `CATALOG_INCLUDE` (include Prisma : images, paliers, options non archivées
    et leurs valeurs non archivées, triés par `position`) ;
    `toCatalogProduct(row): CatalogProduct` ;
    `listPublishedCatalog(kind?: "BADGE" | "ACCESSORY"): Promise<CatalogProduct[]>` —
    `published: true, archived: false`, tri `position` puis `name` ;
    `getProductDetail(productId: string): Promise<CatalogProduct | null>` (écran staff, même
    forme, brouillon ou archivé compris).
  - Helper de test `createCordonInDb(overrides?: Partial<{ published: boolean; archived:
    boolean; name: string }>): Promise<{ productId: string; optionIds: { color: string; text:
    string }; valueIds: Record<"rouge" | "bleu" | "noir" | "blanc" | "or", string> }>` —
    l'équivalent en base de `CORDON`, avec 4 images.
  - `GET /api/print/catalog?kind=BADGE|ACCESSORY` → `{ products: CatalogProduct[] }` ; 401
    sans session ; 400 `VALIDATION` pour un `kind` inconnu. **Toute session connectée** y a
    accès (voir la justification en fin de plan).

- [ ] **Step 1 : écrire les tests**
  - `loadProductForPricing` : identifiant inconnu → `null` ; le cordon en base donne
    `unitPriceFor(p, 100, [Or, texte]) === 700` ; une valeur archivée reste présente avec
    `archived: true` et `validateChoices` la refuse en `VALUE_ARCHIVED`.
  - `listPublishedCatalog` : brouillon et archivé absents ; option archivée absente ; filtre
    `kind` ; ordre `position` puis nom ; images dans l'ordre de `position`.
  - Route : 401 sans session ; 200 pour un participant connecté sans rôle ; 400
    `kind=FOO` ; archiver le cordon (`archived: true` en base) le retire de la réponse.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `pricing.ts`, `catalog.ts`, la route et le helper.
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): lecture du catalogue publie`.

## Task 5 — Upload plateforme + clés `print-requests/` réservées au staff

**Files :**
- Create : `src/app/api/platform/upload/route.ts`
- Modify : `src/app/api/files/[...path]/route.ts`
- Test : `src/app/api/platform/upload/__tests__/route.test.ts`, test existant de
  `/api/files` (compléter)

**Interfaces :**
- Consumes : `withStaffAuth`, `requireStaff`/`AuthError` (`src/lib/auth-guards.ts`),
  `isAllowedMime`, `MAX_UPLOAD_BYTES`, `uploadFile` (`storage.ts`).
- Produces :
  - `POST /api/platform/upload?context=print-product|print-request` (multipart, champ
    `file`) → 200 `{ storageKey }`.
    - `withStaffAuth(…, { minRole: "STAFF_SUPPORT" })` ; `context=print-product` exige en plus
      `STAFF_ADMIN` (`requireStaff`, `AuthError` → 403).
    - `print-product` : `isAllowedMime(mime, "photo")`, clé
      `platform/print-products/{uuid}.{jpg|png|webp}` ;
      `print-request` : `isAllowedMime(mime, "document")`, clé
      `print-requests/staff/{uuid}.{jpg|png|webp|pdf}`.
    - Erreurs, alignées sur les quatre routes d'upload existantes : 400 `BAD_CONTEXT`
      (contexte absent ou inconnu), 400 `NO_FILE`, **415 `BAD_TYPE`**, **413 `TOO_LARGE`**.
  - `/api/files` : `classify` reconnaît `^print-requests/` comme **sensible**, lisible par
    le staff uniquement (`ctx.isStaff`), `private, no-store`. Le plan 33 étendra la lecture
    aux détenteurs de `print.request` de l'évènement. `platform/print-products/` reste public.

- [ ] **Step 1 : écrire les tests** (modèle : `src/app/api/org/[orgId]/upload/__tests__/route.test.ts`)
  - 401 sans session ; 403 non-staff ; 403 `STAFF_SUPPORT` avec `print-product` ; 403
    `STAFF_OBSERVER` avec `print-request`.
  - 400 `BAD_CONTEXT` sans `context` et avec `context=avatar` ; 400 `NO_FILE` (formulaire
    vide et multipart illisible).
  - `print-product` : PDF → 415 `BAD_TYPE` ; 5 Mo + 1 octet → 413 `TOO_LARGE` ; JPEG, PNG,
    WebP → clé `^platform/print-products/[0-9a-f-]{36}\.(jpg|png|webp)$`.
  - `print-request` (`STAFF_SUPPORT`) : PDF accepté → clé
    `^print-requests/staff/[0-9a-f-]{36}\.pdf$` ; `text/plain` → 415.
  - `/api/files` : `print-requests/staff/x.pdf` → 403 sans session et pour un non-staff,
    200 `private, no-store` pour un `STAFF_OBSERVER` ;
    `platform/print-products/x.jpg` → 200 `public, max-age=3600` sans session.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** la route et le classement.
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): televersement plateforme des images produit`.

## Task 6 — API produits : création, modification, archivage

**Files :**
- Create : `src/lib/print-catalog/input.ts`, `src/lib/print-catalog/products.ts`,
  `src/app/api/platform/print/products/route.ts`,
  `src/app/api/platform/print/products/[productId]/route.ts`
- Test : `src/lib/__tests__/print-catalog-products.test.ts`,
  `src/lib/__tests__/api-platform-print-products.test.ts`

**Interfaces :**
- Consumes : modèles (Task 1), `slugify` (`src/lib/slugify.ts`), `logActivity`.
- Produces :
  - `input.ts` : `productCreateSchema` (zod) — `kind` enum ; `name` 1–120 (trim) ;
    `category` ≤ 60, nullable, optionnel ; `description` ≤ 5000, nullable, optionnel ;
    `basePrice` entier 0–10 000 000 ; `minQuantity` entier 1–100 000, défaut 1 ;
    `leadTimeDays` entier 0–365, nullable, optionnel. `productUpdateSchema` =
    `productCreateSchema.omit({ kind: true }).partial()` + `published` booléen + `position`
    entier 0–10 000. Types `ProductCreateInput`, `ProductUpdateInput` (`z.infer`).
  - `products.ts` :
    - `class CatalogError extends Error { constructor(readonly code: CatalogErrorCode,
      readonly status: 400 | 404 | 409, message: string) }` avec `type CatalogErrorCode =
      "NOT_FOUND" | "PRODUCT_ARCHIVED" | "UNKNOWN_OPTION" | "UNKNOWN_VALUE"` ;
      `catalogErrorResponse(err: CatalogError): NextResponse` (`{ error: code, message }`).
    - `uniqueProductSlug(name: string): Promise<string>` — `slugify(name, { maxLength: 100,
      fallback: "produit" })`, suffixes `-2`, `-3`… (motif de `uniqueEventSlug`).
    - `createProduct(input: ProductCreateInput, userId: string): Promise<PrintProduct>` —
      `position` = max actuel + 1, `published: false`.
    - `updateProduct(productId: string, input: ProductUpdateInput): Promise<{ product:
      PrintProduct; changed: string[] }>` — `changed` = clés dont la valeur a réellement
      changé ; 404 `NOT_FOUND` ; 409 `PRODUCT_ARCHIVED`. Le slug ne change jamais.
    - `archiveProduct(productId: string): Promise<PrintProduct>` — `archived: true`,
      `archivedAt`, `published: false` ; 404 ; 409 si déjà archivé.
    - `type ProductListRow = { id: string; kind: "BADGE" | "ACCESSORY"; name: string;
      category: string | null; basePrice: number; startingPrice: number; published: boolean;
      archived: boolean; mainImageKey: string | null; optionCount: number; updatedAt: Date }`
      et `listProducts(filter: { kind?: "BADGE" | "ACCESSORY"; archived: boolean }):
      Promise<ProductListRow[]>` (tri `position`, puis `name` ; `optionCount` hors archivées).
  - `POST /api/platform/print/products` (`STAFF_ADMIN`) → 201 `{ product }`, 400 `VALIDATION`,
    `PRINT_PRODUCT_CREATED` (`details: { name, kind }`).
  - `PATCH /api/platform/print/products/[productId]` (`STAFF_ADMIN`) → `{ product }`,
    `PRINT_PRODUCT_UPDATED` (`details: { changed }`, aucun log si `changed` est vide) ; 400,
    404, 409.
  - `DELETE /api/platform/print/products/[productId]` (`STAFF_ADMIN`) → `{ product }`
    archivé, `PRINT_PRODUCT_ARCHIVED` (`details: { name }`) ; 404, 409.

- [ ] **Step 1 : écrire les tests**
  - `uniqueProductSlug("Cordon tour de cou 20 mm")` → `"cordon-tour-de-cou-20-mm"`, puis
    `"…-2"` si pris ; `"!!!"` → `"produit"`.
  - `createProduct` : brouillon, `position` croissante, `createdById`.
  - `updateProduct` : `changed` égal à `["basePrice", "published"]` quand seuls ces deux
    changent ; même valeur renvoyée → `changed` vide.
  - `listProducts` : filtre `kind`, `archived`, `mainImageKey` = image de `position` 0,
    `startingPrice` du cordon = 400.
  - Routes : 401 ; 403 `STAFF_OBSERVER` sur POST, PATCH, DELETE ; 201 + log ; 400 (nom vide,
    `basePrice` négatif, `minQuantity` 0, `kind` absent) ; PATCH 404 ; PATCH d'un archivé →
    409 `PRODUCT_ARCHIVED` ; publication (`published: true`) → log avec
    `changed: ["published"]` ; DELETE → `archived`, `published: false`, log ; DELETE répété
    → 409.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `input.ts`, `products.ts` et les routes (modèle :
  `src/app/api/platform/plans/route.ts`).
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): API des produits du catalogue`.

## Task 7 — API galerie, paliers et options

**Files :**
- Create : `src/lib/print-catalog/content.ts`,
  `src/app/api/platform/print/products/[productId]/images/route.ts`,
  `src/app/api/platform/print/products/[productId]/tiers/route.ts`,
  `src/app/api/platform/print/products/[productId]/options/route.ts`
- Modify : `src/lib/print-catalog/input.ts`
- Test : `src/lib/__tests__/print-catalog-content.test.ts`,
  `src/lib/__tests__/api-platform-print-product-content.test.ts`

**Interfaces :**
- Consumes : `CatalogError`, `catalogErrorResponse` (Task 6), `getProductDetail` (Task 4).
- Produces :
  - `input.ts` :
    - `PRODUCT_IMAGE_KEY = /^platform\/print-products\/[0-9a-f-]{36}\.(jpg|png|webp)$/`
    - `imagesInputSchema` : `{ images: { storageKey: string (PRODUCT_IMAGE_KEY); alt: string
      ≤ 200 }[] }`, **10 au plus**, clés distinctes.
    - `tiersInputSchema` : `{ tiers: { minQuantity: entier 2–1 000 000; unitPrice: entier
      0–10 000 000 }[] }`, 20 au plus, `minQuantity` distincts.
    - `optionsInputSchema` : `{ options: OptionInput[] }`, 30 au plus, avec `OptionInput =
      { id?: string; name: 1–80; help: ≤ 300 | null; type: PrintOptionType; required:
      boolean; priceDelta: entier 0–1 000 000; maxLength: entier 1–200 | null; values:
      ValueInput[] (50 au plus) }` et `ValueInput = { id?: string; label: 1–80; colorHex:
      /^#[0-9A-Fa-f]{6}$/ | null; imageKey: PRODUCT_IMAGE_KEY | null; priceDelta: entier
      0–1 000 000 }`. `superRefine` : `CHOICE`, `MULTI_CHOICE`, `COLOR`, `QUANTITY_SPLIT` ont
      au moins une valeur et `priceDelta` 0 ; `COLOR` exige `colorHex` sur chaque valeur ;
      `TEXT` exige `maxLength` ; `TEXT` et `FILE` n'ont aucune valeur.
  - `content.ts` (chaque fonction : 404 `NOT_FOUND`, 409 `PRODUCT_ARCHIVED`, une transaction) :
    - `replaceImages(productId: string, images: ImageInput[]): Promise<void>` — supprime les
      lignes d'images et recrée la liste, `position` = index (seules les lignes ; l'objet S3
      reste).
    - `replaceTiers(productId: string, tiers: TierInput[]): Promise<void>` — idem.
    - `syncOptions(productId: string, options: OptionInput[]): Promise<void>` — option avec
      `id` : mise à jour (doit appartenir au produit et ne pas être archivée, sinon 400
      `UNKNOWN_OPTION`) ; sans `id` : création ; `position` = index ; options non archivées
      absentes de la liste → archivées. Même règle pour les valeurs au sein de chaque option
      (`UNKNOWN_VALUE`).
  - `PUT …/images` `{ images }`, `PUT …/tiers` `{ tiers }`, `PUT …/options` `{ options }`
    (`STAFF_ADMIN`) → `{ product: CatalogProduct }` (via `getProductDetail`),
    `PRINT_PRODUCT_UPDATED` avec `details.changed` = `["images"]`, `["tiers"]`,
    `["options"]`.

- [ ] **Step 1 : écrire les tests**
  - `replaceImages` : 4 images puis réordonnées (D, A, B) → 3 lignes dans cet ordre.
  - `replaceTiers` : deux paliers 100/450 et 500/400 → `tierPriceFor` du produit relu donne
    450 à 100.
  - `syncOptions` : crée l'option `COLOR` à 5 valeurs et l'option `TEXT` (critère
    d'acceptation) ; renvoyer la liste sans la valeur Blanc → Blanc `archived: true`, les
    autres valeurs gardent leur `id` ; renommer Or garde son `id` ; retirer l'option texte →
    archivée ; `id` d'option d'un autre produit → `UNKNOWN_OPTION` sans rien écrire
    (transaction) ; `id` de valeur inconnu → `UNKNOWN_VALUE`.
  - Schémas : 11 images → 400 ; clé `orgs/x/images/a.jpg` → 400 ; deux paliers au même
    `minQuantity` → 400 ; `COLOR` sans `colorHex` → 400 ; `TEXT` sans `maxLength` → 400 ;
    `CHOICE` sans valeur → 400 ; `FILE` avec valeur → 400.
  - Routes : 401, 403 `STAFF_OBSERVER`, 404, 409 archivé, 200 + `{ product }` + log avec le
    bon `changed`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS ; puis `make lint && make typecheck && make test`.
- [ ] **Step 5 : commit** — `feat(impression): galerie, paliers et options des produits`.

## Task 8 — Composants vitrine `ProductCard` et `ProductConfigurator`

**Files :**
- Create : `src/components/print/ProductCard.tsx`, `src/components/print/ProductGallery.tsx`,
  `src/components/print/ProductConfigurator.tsx`
- Test : `src/components/print/__tests__/ProductCard.test.tsx`,
  `src/components/print/__tests__/ProductConfigurator.test.tsx` (`renderToStaticMarkup`,
  comme `src/components/ui/__tests__/StatCard.test.tsx`)

**Interfaces :**
- Consumes : depuis `@/lib/print-catalog/pricing-core` **uniquement** : `CatalogProduct`,
  `OptionChoice`, `startingPrice`, `unitPriceFor`, `validateChoices`, `choiceErrorMessage`,
  `formatFcfa` ; `CORDON` (helper de test).
- Produces (client, `"use client"`) :
  - `type ProductConfiguration = { quantity: number; choices: OptionChoice[] }` (exporté par
    `ProductConfigurator.tsx`).
  - `ProductCard({ product, selected, onSelect }: { product: CatalogProduct; selected?:
    boolean; onSelect?: () => void })` — image principale (`/api/files/{images[0].storageKey}`,
    `alt`) ou pictogramme, nom, catégorie, « À partir de 400 FCFA », délai « Fabrication :
    7 jours » si `leadTimeDays` ; `button` avec `aria-pressed={selected}` si `onSelect`,
    sinon simple carte.
  - `ProductGallery({ images }: { images: CatalogProduct["images"] })` — image principale +
    vignettes cliquables.
  - `ProductConfigurator({ product, value, onChange, uploadFile, quantityLocked }: { product:
    CatalogProduct; value: ProductConfiguration; onChange: (next: ProductConfiguration) =>
    void; uploadFile?: (file: File) => Promise<string> /* renvoie la storageKey */;
    quantityLocked?: boolean })` — composant contrôlé : galerie, description (paragraphes
    séparés par une ligne vide), options, quantité, prix.
    - `CHOICE` : `Select` avec « (+50 FCFA) » derrière les valeurs payantes ; `MULTI_CHOICE` :
      `Checkbox` ; `COLOR` : pastilles `button` (`aria-label` = libellé, `aria-pressed`) ;
      `TEXT` : `Input` `maxLength` + compteur « 10/30 » ; `FILE` : `Dropzone` →
      `uploadFile`, puis `FileBox` ; sans `uploadFile`, champ désactivé et mention
      « Téléversement disponible dans la demande d'impression » ; `QUANTITY_SPLIT` : un champ
      numérique par valeur et « Réparti : 180 / 200 ».
    - Quantité : `Input type="number"` `min={product.minQuantity}`, en lecture seule si
      `quantityLocked` (le plan 33 l'utilise pour le support `BADGE`, qui suit le nombre de
      badges).
    - Prix : « Prix unitaire estimé » `formatFcfa(unitPriceFor(...))`, « Total estimé »
      `formatFcfa(unit × quantity)`, mention « Estimation : le prix définitif est fixé dans le
      devis. » ; si `validateChoices` échoue, `choiceErrorMessage(code)` en rouge sous l'option
      concernée (ou sous la quantité).

- [ ] **Step 1 : écrire les tests**
  - `ProductCard` : contient « Cordon tour de cou 20 mm », « À partir de 400 FCFA »,
    `src="/api/files/platform/print-products/a.jpg"`, « 7 jours » ;
    `selected` → `aria-pressed="true"`.
  - `ProductConfigurator` avec `value = { quantity: 100, choices: [Or, texte « Forum 2026 »] }`
    → contient `formatFcfa(700)` et `formatFcfa(70000)` ; avec `quantity: 49` → le message de
    `QUANTITY_BELOW_MINIMUM` ; produit avec option `FILE` sans `uploadFile` → « Téléversement
    disponible dans la demande d'impression ».
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** les trois composants (`Card`, `Input`, `Select`, `Checkbox`,
  `Dropzone`, `FileBox` de `src/components/ui/`).
- [ ] **Step 4 : lancer** — attendu : PASS ; `make lint && make typecheck` ; puis
  `grep -rn 'print-catalog/pricing"' src/components` doit être vide (les composants
  n'importent que `pricing-core`).
- [ ] **Step 5 : commit** — `feat(impression): composants de la vitrine produits`.

## Task 9 — Écran liste du catalogue + entrée « Catalogue »

**Files :**
- Create : `src/components/staff/print/CatalogList.tsx`,
  `src/app/platform/print/catalog/page.tsx`
- Modify : `src/components/staff/StaffShell.tsx`, `src/components/ui/Icon.tsx`

**Interfaces :**
- Consumes : `listProducts`, `ProductListRow` (Task 6), `POST /api/platform/print/products`,
  `staffRoleAtLeast` (`src/lib/auth-helpers.ts`), `loadUserContext`.
- Produces :
  - `Icon` : entrée `package` (`Package` de `lucide-react`).
  - `NAV` : dans le groupe « Impression » créé par le plan 31 (Task 8), après « Gabarits » :
    `{ href: "/platform/print/catalog", label: "Catalogue", icon: "package" }`. Si le groupe
    n'existe pas encore, le créer à l'identique (`{ group: "Impression" }`) et le signaler
    dans la colonne Notes.
  - Page serveur `/platform/print/catalog?kind=BADGE|ACCESSORY&archived=true` : titre
    « Catalogue », sous-titre « Supports de badge et accessoires proposés aux
    organisateurs » ; `canWrite = staffRoleAtLeast(ctx.staffRole, "STAFF_ADMIN")`.
  - `CatalogList({ rows, kind, archived, canWrite }: { rows: ProductListRow[]; kind:
    "BADGE" | "ACCESSORY" | null; archived: boolean; canWrite: boolean })` — `Segmented`
    « Tous / Supports de badge / Accessoires » et « Archivés » (liens de filtre) ; tableau
    (`TableFrame`) : vignette, nom, catégorie, « À partir de », statut (`StatusBadge`
    « Publié » / « Brouillon » / « Archivé »), nombre d'options ; ligne → page d'édition ;
    état vide « Aucun produit dans le catalogue. » ; si `canWrite`, bouton « Nouveau
    produit » → `Dialog` (famille, nom, prix de base) → POST → `router.push` vers
    `/platform/print/catalog/{id}`.

- [ ] **Step 1 : implémenter** l'icône, l'entrée de menu, `CatalogList` et la page.
- [ ] **Step 2 : vérifier au navigateur** (après `make db-seed`), à 375 px et 1280 px :
  `STAFF_ADMIN` crée « Cordon test » et arrive sur sa page ; filtres ; un `STAFF_OBSERVER`
  ne voit pas « Nouveau produit ».
- [ ] **Step 3 : `make lint && make typecheck`.**
- [ ] **Step 4 : commit** — `feat(impression): ecran liste du catalogue`.

## Task 10 — Écran d'édition d'un produit + aperçu

**Files :**
- Create : `src/components/staff/print/ProductEditor.tsx`,
  `src/components/staff/print/ProductGalleryEditor.tsx`,
  `src/components/staff/print/ProductTiersEditor.tsx`,
  `src/components/staff/print/ProductOptionsEditor.tsx`,
  `src/app/platform/print/catalog/[productId]/page.tsx`

**Interfaces :**
- Consumes : `getProductDetail` (Task 4), routes des Tasks 5-7, `ProductConfigurator`,
  `ProductCard` (Task 8), `defaultConfiguration` (Task 3), `uploadWithProgress`
  (`src/lib/upload-with-progress.ts`), `useAsyncAction`.
- Produces :
  - Page serveur : `notFound()` si `getProductDetail` renvoie `null` ; `canWrite` comme en
    Task 9 ; lien « ← Catalogue ».
  - `ProductEditor({ product, canWrite }: { product: CatalogProduct; canWrite: boolean })` —
    en-tête (nom, statut, `Switch` « Publié » → PATCH `published`, bouton « Archiver » avec
    confirmation → DELETE puis retour à la liste) ; `Tabs` « Informations », « Galerie »,
    « Tarifs », « Options », « Aperçu ». Après chaque enregistrement : toast et
    `router.refresh()`. Sans `canWrite` ou produit archivé : champs désactivés, aucun bouton
    d'écriture.
    - **Informations** : nom, catégorie, description, prix de base, quantité minimale, délai
      (jours) → PATCH.
    - **Galerie** (`ProductGalleryEditor`) : `Dropzone` → upload
      `context=print-product` (erreur 413/415 affichée par le toast), vignettes avec texte
      alternatif, « Monter » / « Descendre » / « Retirer », mention « La première image est
      l'image principale. », 10 au plus (dropzone masquée à 10) → « Enregistrer la galerie »
      (PUT images).
    - **Tarifs** (`ProductTiersEditor`) : lignes « À partir de [n] unités : [prix] FCFA »,
      ajout/retrait → PUT tiers.
    - **Options** (`ProductOptionsEditor`) : liste d'options (nom, aide, type, obligatoire,
      supplément pour `TEXT`/`FILE`, longueur max pour `TEXT`), chacune avec ses valeurs
      (libellé, couleur pour `COLOR`, vignette facultative par upload, supplément),
      réordonnables par « Monter » / « Descendre » → un seul « Enregistrer les options »
      (PUT options, `id` conservés). Erreur 400 → toast.
    - **Aperçu** : `ProductCard` puis `ProductConfigurator` en état local initialisé par
      `defaultConfiguration(product)`, sans `uploadFile` (fiche telle que l'organisateur la
      verra).

- [ ] **Step 1 : implémenter** la page et les composants.
- [ ] **Step 2 : vérifier au navigateur** — scénario du critère d'acceptation : cordon,
  4 images réordonnées, paliers 100/450 et 500/400, option `COLOR` à 5 couleurs dont Or
  +100, option `TEXT` à 150 FCFA (30 caractères), publication ; aperçu : Or, « Forum 2026 »,
  100 unités → « 700 FCFA » et « 70 000 FCFA ». Vérifier à 375 px.
- [ ] **Step 3 : `make lint && make typecheck && make test`.**
- [ ] **Step 4 : commit** — `feat(impression): edition d'un produit du catalogue`.

## Task 11 — E2E et documentation

**Files :**
- Create : `e2e/platform/print-catalog.spec.ts`, `e2e/platform/print-catalog-product.spec.ts`,
  `docs/v4/features/impression-catalogue.md`
- Modify : `e2e/helpers/db.ts` (`createTestPrintProduct(opts: { name: string; kind?:
  "BADGE" | "ACCESSORY"; published?: boolean }): Promise<{ id: string }>` ; nettoyage des
  produits dont le slug commence par `e2e-` dans `cleanupE2ETestData`), `docs/v4/README.md`

**Interfaces :**
- Consumes : tout ce qui précède. Règles `e2e/README.md` : un fichier par page, jamais
  `page.request`, `loginAndEnter`, navigation par le menu du shell, URL assertée à chaque
  étape, `ensureFixtures()` (jpeg, txt, fichier > 5 Mo), `expectLastActivity`.

- [ ] **Step 1 : `print-catalog.spec.ts`** (`Platform — Catalogue d'impression`) — rendu
  par le menu « Impression » → « Catalogue » ; état vide ; `STAFF_ADMIN` crée « e2e-Cordon »
  → URL `/platform/print/catalog/…`, ligne en base `published: false`,
  `PRINT_PRODUCT_CREATED` ; filtre « Accessoires » masque un support `BADGE` ;
  `STAFF_OBSERVER` ne voit pas « Nouveau produit ».
- [ ] **Step 2 : `print-catalog-product.spec.ts`** (`Platform — Fiche produit`) — scénario
  complet du critère d'acceptation (4 images, deux paliers, `COLOR` à 5 couleurs dont une à
  +100, `TEXT` facturé, publication) avec contrôle en base ; aperçu : « 70 000 FCFA » ;
  upload d'un `.txt` → message « Type interdit » et aucune image ajoutée ; fichier > 5 Mo →
  « Fichier trop volumineux (5 Mo max) » ; archivage → retour à la liste, produit absent de
  la vue par défaut, `archived: true`, `PRINT_PRODUCT_ARCHIVED` ; `STAFF_OBSERVER` voit la
  fiche sans bouton d'écriture.
- [ ] **Step 3 : lancer les e2e** — attendu : PASS.
- [ ] **Step 4 : documentation** — `features/impression-catalogue.md` (familles, modèles,
  types d'options, règle de prix et arrondi de la répartition, copie figée, upload et clés,
  droits, `GET /api/print/catalog`, contrat `pricing.ts` pour le plan 33) ; ligne dans
  `docs/v4/README.md`.
- [ ] **Step 5 : commit** — `docs(impression): catalogue des produits`.

## Vérification finale

- [ ] `make lint && make typecheck && make test` (couverture 100 %).
- [ ] E2E des deux pages.
- [ ] Au navigateur : la fiche d'aperçu à 375 px sans débordement horizontal.

---

## Décisions prises dans ce plan (à relire)

1. **`GET /api/print/catalog` ouvert à toute session connectée.** Le catalogue publié ne
   contient que des noms, prix publics et images déjà servies publiquement par `/api/files` ;
   la permission `print.request` n'existe qu'au plan 33, qui protège déjà l'assistant. Une
   règle plus fine coûterait un couplage sans rien protéger.
2. **Calcul pur séparé (`pricing-core.ts`)**, réexporté par `pricing.ts` : le configurateur
   recalcule le prix dans le navigateur sans tirer Prisma dans le bundle client. Le contrat
   (`unitPriceFor`, `validateChoices`, `snapshotChoices`, types, depuis `pricing.ts`) est tenu.
3. **Quantité en 3e paramètre de `validateChoices` et `snapshotChoices`** : sans elle, ni le
   contrôle « somme des parts = quantité » ni le supplément d'une répartition ne sont
   calculables.
4. **Répartition (`QUANTITY_SPLIT`)** : supplément unitaire = moyenne pondérée arrondie à
   l'entier (le prix est une estimation, la ligne du devis est `unitPrice × quantity`).
5. **Codes 415 / 413** pour un type interdit / un fichier trop lourd (la spec écrit « 400 ») :
   alignés sur les quatre routes d'upload existantes et sur la convention e2e
   (`BAD_TYPE`/`TOO_LARGE`).
6. **`print-requests/` sensible dès ce plan** (staff seulement) : la route d'upload écrit
   `print-requests/staff/…` ; sans ce classement, ces pièces seraient publiques jusqu'au
   plan 33.
7. **Galerie, paliers et options remplacés d'un bloc** (`PUT`), options et valeurs retirées
   archivées : moins de routes, réordonnancement gratuit, `id` stables pour le plan 33.
8. **Pas de route staff de lecture** : les pages serveur lisent `listProducts` et
   `getProductDetail` (motif de la page Plans), le layout `/platform` filtrant le staff.

## Auto-relecture

**Couverture de la spec 32 :** deux familles `BADGE`/`ACCESSORY` (T1) ; champs de
`PrintProduct`, images ≤ 10, paliers, options à 6 types, valeurs avec couleur/vignette/
supplément, supplément unique `TEXT`/`FILE` (T1, T7) ; prix d'une ligne = (palier + Σ
suppléments) × quantité (T2, T8) ; copie figée des libellés et suppléments (T3) ; produit
archivé hors vitrine (T4, T6) ; route d'upload `STAFF_ADMIN`, clé, types, 5 Mo, images
publiques (T5) ; écran `/platform/print/catalog` filtré par famille, page dédiée avec infos,
galerie réordonnable, paliers, options, aperçu, publication, archivage, lecture
`STAFF_OBSERVER` / écriture `STAFF_ADMIN` (T9, T10) ; `ActivityType` (T1, T6, T7) ; vitrine
réutilisable pour la spec 33 (T4, T8) ; critères d'acceptation : cordon complet (T7 test,
T10, T11), prix estimé (T2, T8, T11), archivage (T4, T6, T11), upload 403/415/413 (T5, T11),
couverture et e2e (T11, vérification finale). Non-objectifs respectés (ni stock, ni promo, ni
prix par org, ni panier).

**Cohérence des noms :** `ProductForPricing`, `CatalogProduct`, `OptionChoice`,
`ChoiceSnapshot`, `PricingOption`, `PricingValue` (T2-T3) utilisés tels quels en T4, T7, T8,
T10 ; `CatalogError`/`catalogErrorResponse` (T6) réutilisés en T7 ; `getProductDetail` (T4)
en T7 et T10 ; `listProducts`/`ProductListRow` (T6) en T9 ; `ProductConfiguration` (T8) ;
`defaultConfiguration` (T3) en T10 ; `CORDON` (T2) en T3 et T8, `createCordonInDb` (T4) ;
clés `platform/print-products/` et `print-requests/staff/` identiques en T5, T7
(`PRODUCT_IMAGE_KEY`) et T3 (`INVALID_FILE`).
