# Spec v4 — Catalogue des produits d'impression (supports et accessoires)

> **Statut** : proposée — 2026-11-01 — en attente de relecture
> **Type** : nouvelle fonctionnalité
> **Périmètre** : v4 — espace `/platform` (groupe « Impression »), vitrine côté évènement, `src/lib/print-catalog/**`
> **Plan** : à rédiger
> **Chantier** : service d'impression, spec 2 sur 5 — voir aussi les specs
> [31](2026-11-01-31-v4-gabarits-et-planches-d-impression.md),
> [33](2026-11-01-33-v4-demandes-d-impression-et-devis.md),
> [34](2026-11-01-34-v4-paiement-des-devis-d-impression.md),
> [35](2026-11-01-35-v4-impression-pendant-l-evenement.md)

## Contexte

La plateforme va proposer aux organisateurs un **service d'impression de badges** (spec 33).
L'organisateur doit pouvoir y choisir des **accessoires** pour ses badges (cordons,
porte-badges, clips…). Rien n'existe aujourd'hui : aucun modèle de produit, aucune image
multiple (un champ image = une clé S3), aucune route de téléversement côté plateforme.

## Objectif

L'admin de la plateforme gère un **catalogue** de produits, avec leurs tarifs, plusieurs
images et des options riches. Les organisateurs le parcourent comme une boutique pour composer
leur demande d'impression et personnaliser entièrement leurs badges.

## Décisions (validées par l'utilisateur le 2026-11-01)

1. L'organisateur choisit **différents accessoires** pour ses badges.
2. Chaque accessoire est **configurable par l'admin de la plateforme**.
3. Chaque accessoire a des **tarifs** et **plusieurs images**.
4. **Un maximum d'options** pour chaque accessoire.
5. But : une plateforme où les organisateurs **personnalisent entièrement** leurs badges.

## Choix de conception (arbitrages de l'agent, à relire)

### Deux familles de produits, un seul modèle

L'impression du badge elle-même est un produit tarifé (support PVC ou carton, épaisseur,
pelliculage…). Plutôt que de la coder en dur, elle vit dans le même catalogue :

- `PrintProduct.kind` : `BADGE` (le support d'impression du badge) ou `ACCESSORY`.
- Une demande d'impression (spec 33) contient **exactement un** produit `BADGE` et **zéro ou
  plusieurs** `ACCESSORY`.

### Modèles

**`PrintProduct`**

| Champ | Contenu |
|---|---|
| `kind` | `BADGE` \| `ACCESSORY` |
| `name`, `slug` | ex. « Cordon tour de cou 20 mm » |
| `category` | texte libre court pour regrouper dans la vitrine (« Cordons », « Porte-badges »…) |
| `description` | texte (paragraphes simples, pas de HTML) |
| `basePrice` | prix unitaire en FCFA, entier (`Int`, XOF comme `Plan.price`) |
| `minQuantity` | quantité minimale de commande (défaut 1) |
| `leadTimeDays` | délai de fabrication indicatif, nullable |
| `position` | ordre d'affichage |
| `published` | visible des organisateurs ou brouillon |
| `archived`, `archivedAt`, dates, `createdById` | soft delete |

**`PrintProductImage`** : `productId`, `storageKey`, `alt`, `position`. Jusqu'à **10 images**
par produit ; la première est l'image principale. Téléversement par une nouvelle route
`POST /api/platform/upload` (`STAFF_ADMIN`), clé `platform/print-products/{uuid}.{ext}`,
JPEG/PNG/WebP, 5 Mo (règles existantes de `storage.ts`). Images publiques via `/api/files`.

**`PrintProductPriceTier`** (prix dégressifs, facultatifs) : `productId`, `minQuantity`,
`unitPrice`. Le prix unitaire de base est celui du palier le plus haut atteint par la
quantité ; sans palier, `basePrice`.

**`PrintProductOption`** : `productId`, `name` (« Couleur », « Largeur », « Texte imprimé »…),
`help`, `type`, `required`, `position`, `archived`. Types :

| Type | Saisie de l'organisateur | Exemple |
|---|---|---|
| `CHOICE` | un choix dans une liste | largeur 15 / 20 / 25 mm |
| `MULTI_CHOICE` | plusieurs choix | finitions : mousqueton, sécurité anti-étranglement |
| `COLOR` | un choix dans une liste de couleurs (pastille) | couleur du cordon |
| `TEXT` | un texte court (longueur max réglable) | texte imprimé sur le cordon |
| `FILE` | un fichier image ou PDF téléversé | logo à imprimer sur le cordon |
| `QUANTITY_SPLIT` | répartition de la quantité entre valeurs | 120 rouges, 80 bleus |

**`PrintProductOptionValue`** (pour `CHOICE`, `MULTI_CHOICE`, `COLOR`, `QUANTITY_SPLIT`) :
`optionId`, `label`, `colorHex` (nullable), `imageKey` (nullable, vignette), `priceDelta`
(FCFA par unité, peut être 0), `position`, `archived`.
Pour `TEXT` et `FILE`, un `priceDelta` unique sur l'option (supplément si renseigné).

**Prix d'une ligne** = (prix unitaire du palier + somme des `priceDelta` choisis) × quantité.
Ce prix est une **estimation** : l'admin fixe le prix final dans le devis (spec 33).

### Copie figée

Une demande d'impression **copie** le nom, les options choisies (libellés et suppléments) et
les prix au moment de la soumission. Modifier ou archiver un produit ne change jamais une
demande existante. Un produit archivé disparaît de la vitrine.

### Écrans

- **Admin** — `/platform/print/catalog` (entrée « Catalogue » du groupe « Impression ») :
  liste filtrée par famille, création et édition d'un produit sur une page dédiée (infos,
  galerie avec réordonnancement, paliers, options et valeurs, aperçu de la fiche telle que
  l'organisateur la verra), publication, archivage. Lecture `STAFF_OBSERVER`, écriture
  `STAFF_ADMIN`. Modèle d'écran : `PlanManager` et `src/app/api/platform/plans/`.
  > L'utilisateur a parlé des « paramètres de la plateforme » : l'agent propose une page
  > dédiée plutôt qu'un onglet de `/platform/settings`, le catalogue étant trop riche pour un
  > onglet. À confirmer.
- **Organisateur** — la vitrine apparaît dans l'assistant de demande d'impression
  (spec 33) : cartes produit (image principale, nom, prix « à partir de »), fiche avec galerie,
  description, options, quantité et prix estimé recalculé en direct. Pas de page boutique
  séparée hors d'une demande.
- `ActivityType` : `PRINT_PRODUCT_CREATED`, `PRINT_PRODUCT_UPDATED`, `PRINT_PRODUCT_ARCHIVED`.

## Non-objectifs

- Gestion de stock, variantes avec stock propre, fournisseurs.
- Promotions, codes promo (l'admin peut ajouter une remise dans le devis, spec 33).
- Prix par organisation ou par plan d'abonnement.
- Autre devise que le FCFA, taxes (TVA) détaillées.
- Vente hors d'une demande d'impression (pas de panier libre).

## Critères d'acceptation

- L'admin crée un cordon avec 4 images, deux paliers de prix, une option `COLOR` à
  5 couleurs (dont une avec supplément), une option `TEXT` facturée, et le publie.
- Un organisateur voit le cordon dans l'assistant de demande, choisit ses options, et le prix
  estimé correspond au calcul ci-dessus.
- Archiver le cordon le retire de la vitrine sans toucher aux demandes qui le contiennent.
- La route de téléversement plateforme refuse un non-staff (403), un fichier trop lourd ou
  d'un type interdit (400).
- Couverture 100 % maintenue sur `src/lib/**` et `src/app/api/**` ; e2e de la page catalogue
  et de la fiche produit.
