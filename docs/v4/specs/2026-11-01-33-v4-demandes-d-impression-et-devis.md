# Spec v4 — Demandes d'impression, devis et fil de discussion

> **Statut** : proposée — 2026-11-01 — en attente de relecture
> **Type** : nouvelle fonctionnalité
> **Périmètre** : v4 — espace `/event/[eventId]` (nouvelle entrée « Impression »), espace `/platform` (groupe « Impression », entrée « Demandes »), notifications, `src/lib/print-requests/**`
> **Plan** : à rédiger
> **Chantier** : service d'impression, spec 3 sur 5 — voir aussi les specs
> [31](2026-11-01-31-v4-gabarits-et-planches-d-impression.md),
> [32](2026-11-01-32-v4-catalogue-produits-d-impression.md),
> [34](2026-11-01-34-v4-paiement-des-devis-d-impression.md),
> [35](2026-11-01-35-v4-impression-pendant-l-evenement.md)

## Contexte

Aujourd'hui, un organisateur imprime ses badges lui-même (PDF individuel ou ZIP pour
imprimante à badges). La plateforme veut lui vendre un **service d'impression** : il envoie
ses badges et choisit des accessoires (catalogue, spec 32), l'admin de la plateforme chiffre,
l'organisateur accepte et paie (spec 34), l'admin imprime avec les planches (spec 31).

## Objectif

Un organisateur envoie une **demande d'impression** pour un évènement. L'admin la reçoit dans
un nouveau menu, l'ajuste et la transforme en **devis**. Les deux échangent dans un **fil de
discussion** qui retrace aussi chaque modification. L'organisateur accepte le devis, puis
paie.

## Décisions (validées par l'utilisateur le 2026-11-01)

1. L'organisateur peut envoyer ses badges à l'impression **par lot ou au total** ; la
   meilleure façon reste à décider (proposition de l'agent ci-dessous).
2. Il choisit les **accessoires** du catalogue pour ses badges.
3. Deux **types d'impression** : **en amont** de l'évènement et **pendant** l'évènement. Le
   second exige un template de badge adapté (spec 35).
4. L'admin reçoit la demande avec **les détails de l'évènement, le nombre de badges et tous
   les détails**.
5. L'admin **valide d'abord** la demande de cotation ; l'organisateur ne peut payer
   qu'ensuite.
6. L'admin peut **ajouter des lignes, modifier les prix**, etc.
7. Un **fil de discussion** par demande, avec des échanges, et des **mises à jour dans le
   fil** quand l'admin modifie les prix ou ajoute des lignes.
8. L'organisateur **accepte** finalement le devis et **paie**, « à la façon d'Alibaba ».
9. Les demandes apparaissent dans un **nouveau menu de l'admin**, d'où il peut **générer le
   gabarit d'impression** (les planches, spec 31).
10. **Template verrouillé après paiement** (2026-11-01, après relecture) : l'évènement ne
    peut plus changer de template de badge tant qu'il a une demande d'impression payée.
11. **C'est le propriétaire (OWNER) de l'organisation qui paie** (2026-11-01).
12. **Pas de réimpression** par le service (2026-11-01), mais **la conversation reste
    ouverte** : le fil d'une demande terminée reste utilisable.

## Choix de conception (arbitrages de l'agent, à relire)

### Lots : une demande = un lot figé

- Une demande porte sur une **liste figée d'inscriptions** `APPROVED`, choisie par
  l'organisateur : toutes celles **pas encore imprimées ni déjà demandées**, une ou plusieurs
  catégories, ou une sélection manuelle. « Au total » = tout sélectionner.
- Un évènement peut avoir **plusieurs demandes** (un lot initial, puis un lot de
  retardataires). Une inscription ne peut figurer que dans **une seule demande active**
  (non annulée, non refusée) : la vitrine l'indique et l'écarte.
- Les inscriptions approuvées après l'envoi iront dans une nouvelle demande.
- Un **brouillon** (`DRAFT`) ne réserve rien : les inscriptions sont réservées à l'envoi, et
  l'envoi échoue si l'une d'elles a été prise entre-temps par une autre demande.
- Une inscription qui n'est plus `APPROVED` après le paiement est écartée à la génération
  (spec 31) et signalée dans le fil ; pas de remboursement (hors périmètre, spec 34).

### Quantités et prix

- À la création, la quantité du produit `BADGE` et celle de chaque accessoire valent le
  nombre de badges de la demande (l'organisateur peut changer celle d'un accessoire).
- Tant qu'une ligne n'a pas été retouchée par l'admin, sa quantité **suit** le nombre de
  badges quand l'organisateur en ajoute ou en retire. Une ligne retouchée par l'admin
  (`priceOverridden`, `quantityOverridden`) ne bouge plus seule ; le fil signale l'écart.

### Modèles

**`PrintRequest`**

| Champ | Contenu |
|---|---|
| `reference` | référence lisible, ex. `IMP-2026-0042` |
| `eventId`, `orgId` | |
| `type` | `ADVANCE` (en amont) \| `ONSITE` (pendant l'évènement, spec 35) |
| `status` | voir le cycle de vie |
| `createdById` | organisateur qui a créé la demande |
| `badgeTemplateId`, `badgeWidthPx`, `badgeHeightPx`, `badgePages` | copie du template effectif à l'envoi (l'admin sait quel format il imprimera) |
| `delivery` | `PICKUP` (retrait) \| `DELIVERY` (livraison) — `ADVANCE` uniquement |
| `deliveryAddress`, `deliveryContactName`, `deliveryContactPhone`, `wantedBy` | infos de remise, date souhaitée — `ADVANCE` uniquement |
| `estimatedQuantity`, `onsiteSchedule` (JSON : jours et plages horaires), `onsiteLocation`, `onsiteContactName`, `onsiteContactPhone` | `ONSITE` uniquement (spec 35) |
| `notes` | remarque libre de l'organisateur |
| `quoteVersion` | entier, +1 à chaque envoi de devis |
| `acceptedVersion`, `acceptedTotal`, `acceptedAt`, `acceptedById` | acceptation |
| `total` | total courant (somme des lignes), FCFA |
| dates | `submittedAt`, `quotedAt`, `paidAt`, `completedAt`, `cancelledAt` |

**`PrintRequestItem`** (`ADVANCE` uniquement) : `requestId`, `registrationId` (unique parmi
les demandes actives, contrôlé dans le code), `position` (ordre d'impression, calculé à
l'envoi : catégorie `number`, nom, prénom — la règle de la spec 31).

**`PrintQuoteLine`** : `requestId`, `kind` (`PRODUCT` \| `SERVICE` \| `DISCOUNT` \| `CUSTOM`),
`productId` (nullable), `label`, `optionsSnapshot` (JSON : options et valeurs choisies, avec
libellés et suppléments), `quantity`, `unitPrice` (FCFA, négatif autorisé pour `DISCOUNT`),
`lineTotal`, `position`, `addedBy` (`ORGANIZER` \| `STAFF`), `removedAt` (soft delete, pour
que le fil garde l'historique).

**`PrintRequestMessage`** (le fil) : `requestId`, `authorId` (nullable pour le système),
`side` (`ORGANIZER` \| `STAFF` \| `SYSTEM`), `kind` (`MESSAGE` \| `EVENT`), `body` (texte),
`eventType` et `details` (JSON) pour les entrées automatiques, `attachmentKey` (nullable, une
pièce jointe image ou PDF de 5 Mo au plus), `createdAt`.

### Cycle de vie

```
DRAFT ──envoi──▶ SUBMITTED ──devis envoyé──▶ QUOTED ──acceptation──▶ ACCEPTED ──paiement──▶ PAID
                     │                         │  ▲                       │                    │
                     │                         │  └──réouverture admin────┘                    ▼
                     └──refus admin──▶ REJECTED                                         IN_PRODUCTION
   annulation organisateur possible jusqu'à ACCEPTED ──▶ CANCELLED                            │
                                                                                               ▼
                                                                        READY (prête / expédiée) ──▶ COMPLETED
```

- `DRAFT` : l'organisateur compose (assistant), rien n'est visible du staff.
- `SUBMITTED` : la demande arrive chez l'admin. L'organisateur peut encore la modifier
  (badges, produits) ; chaque modification apparaît dans le fil.
- L'admin édite les lignes (ajout, prix, quantités, remise, frais de livraison) puis
  **« Envoyer le devis »** : `QUOTED`, `quoteVersion` + 1, entrée dans le fil avec le total.
  Tant qu'il n'a pas envoyé, ses modifications sont visibles dans le fil mais l'organisateur
  ne peut pas accepter.
- Toute modification **après** `QUOTED`, par l'admin (lignes) comme par l'organisateur
  (badges, produits), repasse la demande en `SUBMITTED` (« devis en révision ») jusqu'au
  prochain envoi : l'organisateur n'accepte jamais un devis qui bouge.
- **Acceptation** : l'organisateur accepte **une version précise** (`acceptedVersion`,
  `acceptedTotal`). Les lignes **et la liste des badges** sont alors verrouillées. Avant
  paiement, l'admin peut **rouvrir** le devis (retour à `QUOTED` après modification et
  renvoi), l'acceptation est annulée et le fil l'indique.
- **Paiement en cours** : tant qu'un paiement de la demande est `PENDING`, ni la réouverture
  ni l'annulation ne sont possibles (`409 PAYMENT_IN_PROGRESS`). Un paiement approuvé après
  coup sur une demande qui n'est plus `ACCEPTED` est traité par la spec 34.
- **Paiement hors ligne** : le staff `STAFF_ADMIN` peut passer une demande `ACCEPTED` en
  `PAID` à la main, avec un motif obligatoire (spec 34).
- `PAID` : posé par le paiement (spec 34). Ensuite l'admin fait avancer la demande :
  `IN_PRODUCTION`, `READY` (prête au retrait ou expédiée), `COMPLETED`. Chaque passage est une
  entrée du fil et une notification.
- `REJECTED` : l'admin refuse avec un motif (message obligatoire). `CANCELLED` :
  l'organisateur annule tant que rien n'est payé. Les deux libèrent les inscriptions.
- Une inscription d'une demande `COMPLETED` reste réservée : **pas de réimpression** par le
  service (décision 12).
- **Le fil reste ouvert dans tous les statuts**, y compris `COMPLETED`, `REJECTED` et
  `CANCELLED` : les deux côtés peuvent toujours écrire.

### Template de l'évènement

- **De `PAID` jusqu'à `COMPLETED`** (`PAID`, `IN_PRODUCTION`, `READY`) : changer le template
  de l'évènement est **refusé** (`409 TEMPLATE_LOCKED_BY_PRINT_REQUEST`), à tous les niveaux
  de la cascade qui le modifieraient (réglage de l'évènement ; un changement au niveau de
  l'org ou de la plateforme ne s'applique pas à un évènement verrouillé tant que le verrou
  tient). L'écran de choix du template explique pourquoi.
- **Avant le paiement** (`SUBMITTED`, `QUOTED`, `ACCEPTED`) : le changement est permis ; la
  copie du template de la demande est mise à jour, la demande repasse en `SUBMITTED`
  (acceptation annulée) et le fil l'indique, car le format, donc le prix, peut changer.
  (Arbitrage de l'agent.)
- Le passage à `COMPLETED` propose à l'admin de **marquer les badges imprimés** (action
  existante, avec ses notifications au participant ; la route accepte 500 identifiants au
  plus, le marquage d'une grosse demande est découpé en plusieurs appels).

### Fichiers

- L'organisateur téléverse les fichiers des options `FILE` (spec 32) et ses pièces jointes
  du fil par `POST /api/org/[orgId]/events/[eventId]/print-requests/upload`
  (`print.request`), clé `print-requests/{eventId}/{uuid}.{ext}`, image ou PDF, 5 Mo.
- Le staff joint ses fichiers par la route plateforme de la spec 32, clé
  `print-requests/staff/{uuid}.{ext}`.
- `/api/files` : nouvelle famille de clés sensibles `print-requests/`, lisible par le staff
  et par les détenteurs de `print.request` de l'évènement concerné, `no-store`.

### Entrées automatiques du fil

Ligne ajoutée, modifiée (ancien → nouveau prix ou quantité), retirée ; devis envoyé (version,
total) ; devis accepté ; devis rouvert ; changement de statut ; paiement reçu ou échoué ;
badges ajoutés ou retirés de la demande. Les entrées sont **regroupées** quand l'admin fait
plusieurs modifications avant d'envoyer (une entrée « 3 lignes modifiées » détaillée, plutôt
que trois).

### Notifications

- Nouveaux `NotificationType` : `PRINT_REQUEST_SUBMITTED` (staff `STAFF_ADMIN`, portée
  PLATFORM), `PRINT_REQUEST_QUOTED`, `PRINT_REQUEST_MESSAGE`, `PRINT_REQUEST_STATUS_CHANGED`
  (admins de l'évènement, portée EVENT ; et staff pour les messages et l'acceptation).
- Emails via la queue existante (`EMAIL_BY_TYPE`). Un message du fil notifie l'autre côté ;
  l'auteur n'est pas notifié.
- Pas de temps réel : la page du fil se recharge après chaque action et toutes les 30 s
  quand l'onglet est visible.

### Écrans

**Organisateur** — nouvelle entrée **« Impression »** dans `EventShell` (rôle évènement
`ADMIN`) :

- `/event/[eventId]/print` : liste des demandes de l'évènement (référence, type, nombre de
  badges, total, statut) et bouton « Nouvelle demande ».
- Assistant (`Stepper`) : 1. type (en amont / pendant, spec 35) ; 2. badges (en amont) ou
  quantité estimée (sur place) ; 3. support du badge (un produit `BADGE`) ; 4. accessoires
  (vitrine, spec 32) ; 5. remise (en amont : retrait ou livraison, adresse, date souhaitée,
  contact ; sur place : jours, horaires, lieu, contact) ;
  6. récapitulatif avec **prix estimé** et la mention « Le prix définitif est fixé par
  l'équipe Badge dans le devis ». Brouillon enregistré à chaque étape.
- `/event/[eventId]/print/[requestId]` : en-tête (statut, total), lignes du devis, fil de
  discussion (`Timeline`) avec zone de message et pièce jointe, actions selon le statut
  (Modifier, Annuler, Accepter le devis, Payer — spec 34).

**Admin** — entrée **« Demandes »** du groupe « Impression » (`StaffShell`) :

- `/platform/print/requests` : liste filtrable par statut, organisation, type, date
  souhaitée ; compteur des demandes en attente dans le menu.
- `/platform/print/requests/[requestId]` : détails de l'évènement (titre, date, lieu,
  organisation, contacts), template et format du badge avec aperçu d'un badge, nombre de
  badges et leur liste, lignes éditables, fil, actions (Envoyer le devis, Refuser, Rouvrir,
  avancer le statut) et, pour une demande en amont, **« Générer les planches »** qui ouvre
  la génération de la spec 31 pré-remplie avec les badges de la demande (la génération est
  liée à la demande).

### Droits

- Côté organisateur : nouvelle permission d'évènement **`print.request`** (rôle évènement
  `ADMIN` : membre `ADMIN` de l'évènement, OWNER ou MANAGER de l'org) pour créer, modifier,
  annuler et écrire dans le fil.
- **Accepter le devis et payer : OWNER de l'organisation uniquement** (décision 11 pour le
  paiement ; l'agent étend la règle à l'acceptation, qui engage à payer). Les autres
  préparent la demande ; l'OWNER est notifié quand un devis attend son acceptation.
- `hasEventPermission` laisse passer tout le staff : les routes **d'acceptation et de
  paiement refusent explicitement le staff** (403), qui n'agit jamais à la place de
  l'organisateur. Le staff écrit dans le fil par ses propres routes, côté `STAFF`. Les écritures exigent le droit d'abonnement `MANAGE_ONGOING_EVENTS` (comme toute
  écriture dans `withEventAuth`). Un évènement archivé ne peut plus créer de demande.
- Côté staff : lecture `STAFF_OBSERVER`, messages et statuts `STAFF_SUPPORT`, prix et lignes
  `STAFF_ADMIN`.
- `ActivityType` : `PRINT_REQUEST_SUBMITTED`, `PRINT_REQUEST_UPDATED`,
  `PRINT_REQUEST_QUOTED`, `PRINT_REQUEST_ACCEPTED`, `PRINT_REQUEST_REOPENED`,
  `PRINT_REQUEST_STATUS_CHANGED`, `PRINT_REQUEST_CANCELLED`, `PRINT_REQUEST_REJECTED`,
  `PRINT_REQUEST_MARKED_PAID`.

## Non-objectifs

- Négociation en temps réel (websocket), accusés de lecture.
- Factures PDF, bons de livraison PDF.
- Suivi de colis chez un transporteur.
- Plusieurs devis concurrents pour une même demande.
- Demande couvrant plusieurs évènements.

## Critères d'acceptation

- Un organisateur crée une demande de 150 badges avec support PVC et cordons, l'envoie ;
  le staff est notifié et la voit dans « Demandes » avec tous les détails.
- L'admin modifie un prix et ajoute des frais de livraison : le fil montre les deux
  changements ; l'organisateur ne peut pas accepter avant l'envoi du devis.
- L'organisateur accepte la version 2 ; une modification ultérieure de l'admin exige une
  réouverture et un nouvel envoi, et l'acceptation précédente est annulée dans le fil.
- Une inscription déjà présente dans une demande active n'est pas proposée dans une autre.
- « Générer les planches » depuis une demande produit les planches de ses badges (spec 31).
- Les messages des deux côtés apparaissent dans le fil et notifient l'autre côté.
- Couverture 100 % maintenue sur `src/lib/**` et `src/app/api/**` ; e2e des pages
  organisateur et admin.
