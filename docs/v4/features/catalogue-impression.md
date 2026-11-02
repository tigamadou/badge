# Catalogue des produits d'impression

> Ce document décrit le *quoi* et le *comment* actuels. Le *pourquoi* vit dans
> [`../specs/2026-11-01-32-v4-catalogue-produits-d-impression.md`](../specs/2026-11-01-32-v4-catalogue-produits-d-impression.md).

## État actuel

Le staff de la plateforme tient un **catalogue** de produits d'impression : supports de badge
et accessoires (cordons, porte-badges…) que les organisateurs pourront commander. Chaque
produit a un prix de base, des prix dégressifs, des images et des options configurables. Le
calcul du prix estimé et la copie figée des choix sont fournis ici ; l'assistant de demande et
le devis arrivent avec le plan 33.

| Écran | Rôle | Droits |
|---|---|---|
| `/platform/print/catalog` (« Catalogue ») | Liste filtrée par famille et par état (actifs / archivés), création d'un produit | Lecture `STAFF_OBSERVER`, écriture `STAFF_ADMIN` |
| `/platform/print/catalog/[productId]` | Fiche : informations, galerie, tarifs, options, aperçu, publication, archivage | Lecture `STAFF_OBSERVER`, écriture `STAFF_ADMIN` |

L'entrée « Catalogue » est dans le groupe « Impression » de la navigation staff
(`StaffShell`), après « Gabarits ». Un `STAFF_OBSERVER` voit la fiche sans bouton ni champ
modifiable. Les organisateurs n'ont pas d'écran ici : ils verront la vitrine dans l'assistant
du plan 33.

Le seed (minimal comme démo) publie cinq **accessoires** : porte-badge souple, porte-badge
rigide, cordon tour de cou (couleur, marquage texte, logo), pince crocodile et enrouleur de
badge, avec prix dégressifs. Ils sont créés une seule fois (par slug) : un produit déjà présent
n'est pas modifié. Aucun support de badge n'est seedé.

## Familles et produits

Modèle `PrintProduct` (suppression logique : `archived`, `archivedAt`).

| Champ | Contenu |
|---|---|
| `kind` | `BADGE` (support de badge) ou `ACCESSORY` (accessoire) ; sert au filtre de la liste |
| `name`, `slug` | nom (120 caractères) ; le slug est dérivé du nom et unique (suffixe en cas de collision) |
| `category`, `description` | libellé libre de regroupement, texte de présentation |
| `basePrice` | prix unitaire en FCFA, entier |
| `minQuantity` | quantité minimale de commande (1 par défaut) |
| `leadTimeDays` | délai de fabrication indicatif, facultatif |
| `published` | visible de la vitrine ; un produit créé est un **brouillon** |

La liste affiche l'image principale, le nom, la catégorie, le prix « à partir de » (le plus bas
entre le prix de base et les paliers), l'état (Brouillon, Publié, Archivé) et le nombre
d'options. Le nom du produit est un lien vers la fiche (accessible au clavier) ; un clic sur
la ligne l'ouvre aussi.

Archiver un produit le **dépublie** d'abord, puis le **verrouille** : toute modification
ultérieure est refusée (`409 PRODUCT_ARCHIVED`). Chaque onglet de la fiche (informations,
galerie, tarifs, options) s'enregistre séparément, et l'onglet « Aperçu » montre la version
**enregistrée**, pas les modifications en cours.

## Images

Jusqu'à **10 images** par produit ; la première est l'image principale. La galerie est
remplacée d'un bloc à l'enregistrement (`PUT .../images`), avec réordonnancement (Monter /
Descendre) et texte alternatif. À la 10e image, la zone de dépôt disparaît. Le champ de dépôt
prend **un fichier à la fois**.

## Paliers de prix

`PrintProductPriceTier` (`minQuantity` ≥ 2, `unitPrice`), uniques par quantité. Le prix
unitaire de base d'une ligne est celui du palier à la quantité la plus haute atteinte par la
quantité commandée ; sans palier atteint, `basePrice`. Les paliers sont remplacés d'un bloc
(`PUT .../tiers`).

## Options

`PrintProductOption` : nom, aide, type, caractère obligatoire, position. Six types :

| Type | Saisie | Supplément |
|---|---|---|
| `CHOICE` | une valeur | celui de la valeur |
| `MULTI_CHOICE` | plusieurs valeurs (sans doublon) | somme des valeurs choisies |
| `COLOR` | une couleur (pastille `colorHex`) | celui de la couleur |
| `QUANTITY_SPLIT` | quantité répartie entre les valeurs (tailles, couleurs…) | moyenne pondérée, voir ci-dessous |
| `TEXT` | texte libre, longueur maximale (1 à 200) | `priceDelta` de l'option, si un texte est saisi |
| `FILE` | fichier joint | `priceDelta` de l'option, si un fichier est joint |

Les types à valeurs (`CHOICE`, `MULTI_CHOICE`, `COLOR`, `QUANTITY_SPLIT`) portent des
`PrintProductOptionValue` : libellé, couleur (`COLOR`), vignette facultative, supplément par
unité, position. Options et valeurs sont remplacées d'un bloc (`PUT .../options`) ; celles qui
disparaissent sont **archivées** (jamais supprimées), avec leur `id` conservé pour les demandes
existantes. Le type d'une option enregistrée est **verrouillé** : `PUT .../options` refuse un
changement (`400 OPTION_TYPE_LOCKED`) ; il faut retirer l'option et en créer une nouvelle.

## Règle de prix

Prix unitaire estimé = **prix du palier + somme des suppléments des options choisies**. Total
estimé = prix unitaire × quantité. Exemple de la fiche de test : 100 cordons, palier à 500
FCFA, couleur rouge +100, texte brodé +100, soit 700 FCFA l'unité et **70 000 FCFA** au total.

Répartition (`QUANTITY_SPLIT`) : supplément unitaire = Σ (supplément de la valeur × part) /
quantité, **arrondi à l'entier**. Le prix est une estimation ; la ligne du devis est
`prix unitaire × quantité`. Une quantité ≤ 0 donne un supplément nul. Les montants sont
affichés par `formatFcfa` (« 70 000 FCFA »).

Le supplément de répartition est un supplément **unitaire arrondi** : le total de la ligne
(`unitaire × quantité`) peut donc différer de la somme exacte des suppléments par valeur de
jusqu'à `quantité / 2` FCFA. C'est voulu : la copie figée et le devis restent cohérents (même
unitaire, même total). Le plan 33 ne doit pas « corriger » cet écart.

## Copie figée

`snapshotChoices(product, choices, quantity)` produit une copie des choix avec **les libellés
et les suppléments au moment de la demande** (`ChoiceSnapshot`). Modifier ou archiver ensuite
le produit ne change pas les demandes déjà passées. Les demandes d'impression (plan 33) la
stockeront telle quelle.

## Téléversement et clés

`POST /api/platform/upload?context=…` (staff) :

| Contexte | Rôle minimum | Clé de stockage | Visibilité |
|---|---|---|---|
| `print-product` (images du catalogue) | `STAFF_ADMIN` | `platform/print-products/{uuid}.{ext}` | publique via `/api/files` |
| `print-request` (pièces d'une demande) | `STAFF_SUPPORT` | `print-requests/staff/{uuid}.{ext}` | réservée au staff |

Types acceptés : JPEG, PNG, WebP (et PDF pour `print-request`), **5 Mo maximum**. Réponses
d'erreur alignées sur les autres routes d'upload : `403` hors rôle, `400` contexte invalide ou
fichier absent, **`415` `BAD_TYPE`** (« Type interdit »), **`413` `TOO_LARGE`** (« Fichier trop
volumineux (5 Mo max) »). Le préfixe `print-requests/` est classé sensible : seul le staff lit
ces fichiers.

## API

| Route | Rôle minimum | Rôle |
|---|---|---|
| `POST /api/platform/print/products` | `STAFF_ADMIN` | créer un produit (brouillon) |
| `PATCH` / `DELETE /api/platform/print/products/[productId]` | `STAFF_ADMIN` | modifier, publier / dépublier, archiver |
| `PUT .../[productId]/images`, `/tiers`, `/options` | `STAFF_ADMIN` | remplacer galerie, paliers, options |
| `GET /api/print/catalog?kind=BADGE\|ACCESSORY` | toute session connectée | vitrine des produits publiés |

`GET /api/print/catalog` n'est pas réservé au staff : le catalogue publié ne contient que des
noms, des prix publics et des images déjà servies publiquement. Il renvoie `401` sans session
et `400` si `kind` est inconnu. Il n'existe pas de route de lecture pour le staff : les pages
lisent directement `listProducts` et `getProductDetail`.

## Journal d'activité

`PRINT_PRODUCT_CREATED`, `PRINT_PRODUCT_UPDATED` (informations, galerie, paliers, options,
publication) et `PRINT_PRODUCT_ARCHIVED`, avec `targetId` = identifiant du produit.

## Contrat pour le plan 33

Le plan 33 (demandes et devis) consomme `src/lib/print-catalog/pricing.ts`, qui réexporte le
calcul pur de `pricing-core.ts` (utilisable dans le navigateur, sans Prisma) :

- `unitPriceFor(product, quantity, choices)` : prix unitaire estimé ;
- `validateChoices(product, choices, quantity)` : `{ ok: true }` ou `{ ok: false, code, optionId? }`
  (12 codes, de `PRODUCT_UNAVAILABLE` à `SPLIT_MISMATCH`) ; à appeler avant tout chiffrage ;
- `snapshotChoices(product, choices, quantity)` : copie figée ;
- `pruneChoices(product, choices)` : retire des choix enregistrés les options absentes ou
  archivées, les valeurs absentes ou archivées (`valueIds`, parts de répartition) et les choix
  devenus vides ; à appliquer aux `choices` stockés d'une ligne avant d'alimenter
  `ProductConfigurator` et avant toute re-validation (sinon `UNKNOWN_OPTION` sur une option que
  le configurateur n'affiche plus). `ProductConfigurator` l'applique lui-même à son entrée et
  prévient le parent par `onChange` ;
- types `ProductForPricing`, `CatalogProduct`, `OptionChoice`, `ChoiceSnapshot`,
  `PricingOption`, `PricingValue` ; `loadProductForPricing(productId)` charge un produit depuis
  la base.

La quantité est le **3e paramètre** de `validateChoices` et `snapshotChoices` : sans elle, ni
« somme des parts = quantité » ni le supplément d'une répartition ne sont calculables.
`ProductConfigurator` (composant contrôlé) est le configurateur de la vitrine ; la fiche staff
l'utilise dans l'onglet « Aperçu », où un brouillon s'affiche comme une fiche publiée.

## Tests

- Unitaires et intégration : `src/lib/print-catalog/`, `src/components/staff/print/`,
  `src/components/print/`, routes `src/app/api/platform/print/products/`,
  `src/app/api/platform/upload/`, `src/app/api/print/catalog/`.
- E2E : `e2e/platform/print-catalog.spec.ts` (liste, création, filtre, lecture seule),
  `e2e/platform/print-catalog-product.spec.ts` (cordon complet avec aperçu à 70 000 FCFA,
  refus `415` et `413` affichés, plafond de 10 images, archivage, lecture seule).

## Limites connues

- **Le champ de dépôt de la galerie ne réinitialise pas sa valeur** : sélectionner de nouveau
  le même fichier juste après ne déclenche pas le téléversement (le navigateur ne signale pas
  de changement).
- Le type MIME d'un fichier téléversé est celui déclaré par le client, sans vérification des
  octets (comme les autres routes d'upload).
- Pas de stock, de promotion, de prix par organisation ni de panier : voir les non-objectifs de
  la spec.
