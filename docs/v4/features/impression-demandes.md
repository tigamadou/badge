# Commandes d'impression et devis

> Ce document décrit le *quoi* et le *comment* actuels. Le *pourquoi* vit dans
> [`../specs/2026-11-01-33-v4-demandes-d-impression-et-devis.md`](../specs/2026-11-01-33-v4-demandes-d-impression-et-devis.md).

## État actuel

Un organisateur commande l'impression de ses badges à l'équipe Badge : il choisit les badges, un
support et des accessoires du catalogue ([catalogue des produits](catalogue-impression.md)), puis
envoie la commande. Le staff chiffre un **devis**, l'organisateur l'accepte, la commande est payée,
fabriquée, remise, puis terminée. Un fil de discussion accompagne la commande du début à la fin.

| Écran | Rôle | Droits |
|---|---|---|
| `/event/[eventId]/print` (« Impression ») | Liste des commandes de l'évènement, bouton « Nouvelle commande » | Permission `print.request` |
| `/event/[eventId]/print/new` | Choix du type de commande, création du brouillon | `print.request`, évènement non archivé |
| `/event/[eventId]/print/[requestId]/edit` | Assistant en six étapes (type, badges, support, accessoires, remise, récapitulatif) | `print.request`, commande `DRAFT`, `SUBMITTED` ou `QUOTED` |
| `/event/[eventId]/print/[requestId]` | Détail : lignes, informations, actions, fil | `print.request` ; accepter le devis : OWNER de l'organisation seul |
| `/platform/print/orders` (« Commandes ») | Liste filtrable (statut, organisation, type, dates souhaitées), pastille du menu | Tout le staff, `STAFF_OBSERVER` compris |
| `/platform/print/orders/[requestId]` | Détail complet : devis éditable, actions de statut, badges, planches, fil | Lecture : tout le staff ; actions : voir « Droits » |

L'entrée « Impression » du menu de l'évènement n'apparaît que pour les détenteurs de
`print.request` (ADMIN de l'évènement, OWNER et MANAGER de l'organisation). Un `OPERATOR`, un
`PRINTER` ou un `VIEWER` ne la voit pas et revient au tableau de bord s'il ouvre l'adresse. Le
groupe « Impression » du menu staff reçoit l'entrée « Commandes », dont la pastille compte les
commandes `SUBMITTED` en attente de traitement.

## Cycle de vie

Table unique des transitions (`src/lib/print-requests/transitions.ts`, fonction pure `nextStatus`) :
toute combinaison absente est refusée (`409 INVALID_TRANSITION`).

| Action | Depuis | Acteur | Vers |
|---|---|---|---|
| `SUBMIT` (envoyer) | `DRAFT` | organisateur | `SUBMITTED` |
| `ORGANIZER_EDIT` | `DRAFT` / `SUBMITTED` / `QUOTED` | organisateur | `DRAFT` / `SUBMITTED` / `SUBMITTED` |
| `STAFF_EDIT` | `SUBMITTED` / `QUOTED` | staff | `SUBMITTED` |
| `SEND_QUOTE` | `SUBMITTED` | staff | `QUOTED` |
| `ACCEPT` | `QUOTED` | organisateur (OWNER) | `ACCEPTED` |
| `REOPEN` (rouvrir le devis) | `ACCEPTED` | staff | `SUBMITTED` |
| `REJECT` (refuser) | `SUBMITTED` / `QUOTED` | staff | `REJECTED` |
| `CANCEL` (annuler) | `DRAFT` / `SUBMITTED` / `QUOTED` / `ACCEPTED` | organisateur | `CANCELLED` |
| `MARK_PAID` | `ACCEPTED` | système ou staff | `PAID` |
| `START_PRODUCTION` | `PAID` | staff | `IN_PRODUCTION` |
| `MARK_READY` | `IN_PRODUCTION` | staff | `READY` |
| `COMPLETE` | `READY` | staff | `COMPLETED` |
| `TEMPLATE_CHANGED` | `DRAFT` / `SUBMITTED` / `QUOTED` / `ACCEPTED` | système | `DRAFT` / `SUBMITTED` |

Libellés affichés : Brouillon, Envoyée, Devis envoyé, Devis accepté, Payée, En production, Prête,
Terminée, Refusée, Annulée (`PRINT_REQUEST_STATUS_LABELS`).

Toute modification après `QUOTED` (par l'organisateur ou le staff) **remet la commande en
`SUBMITTED`** et écrit l'entrée « Devis en révision » : le devis est renvoyé avant d'être accepté.
Depuis `ACCEPTED`, le devis est figé (`409 QUOTE_ACCEPTED`) ; seul le staff peut le rouvrir, ce qui
annule l'acceptation. Tant qu'un paiement est en cours (`isPaymentInProgress`), la réouverture,
l'annulation d'une commande acceptée, le marquage manuel et le changement de template sont refusés
(`409 PAYMENT_IN_PROGRESS`).

L'acceptation porte sur une **version précise** du devis (`quoteVersion`) : si le devis a changé
entre-temps, elle est refusée (`409 QUOTE_VERSION_MISMATCH`). La version et le total acceptés
(`acceptedVersion`, `acceptedTotal`) sont conservés.

## Lots et réservation

Une commande en amont (`ADVANCE`) porte un **lot figé** de badges : les lignes `PrintRequestItem`
(une par inscription, rangées par catégorie, nom puis prénom). Une commande sur place (`ONSITE`) n'a
pas de lot, seulement une quantité estimée (`estimatedQuantity`).

- Un **brouillon ne réserve rien**. La réservation prend effet à l'envoi, pour les statuts
  `SUBMITTED`, `QUOTED`, `ACCEPTED`, `PAID`, `IN_PRODUCTION`, `READY` et `COMPLETED`
  (`RESERVING_STATUSES`) ; une commande refusée ou annulée libère ses badges.
- Une inscription réservée par une autre commande n'est plus proposée : l'assistant l'affiche grisée
  avec « Déjà dans IMP-… ». À l'envoi, si un badge a été pris entre-temps, l'envoi échoue
  (`409 REGISTRATIONS_TAKEN`).
- Les réservations d'un évènement sont sérialisées par un verrou sur la ligne de l'évènement
  (`lockEventRow`), puis sur la ligne de la commande (`lockRequestWithEvent`). **Ordre des verrous :
  évènement d'abord, commande ensuite**, partout, y compris pour le changement de template.
- Le choix des badges se fait par « Tous les badges disponibles », par catégorie ou à la main. Les
  badges déjà imprimés sont signalés « Déjà imprimé ».
- Les références suivent `IMP-{année}-{numéro sur 4 chiffres}` ; le numéro est le plus grand
  suffixe de l'année plus un, pour éviter les collisions après suppression.

## Suivi des quantités

La ligne du support de badge suit le nombre de badges de la commande : l'organisateur ne saisit pas
cette quantité. Quand le lot change, `followBadgeCount` aligne les quantités des lignes produit et
écrit l'écart dans le fil. Une quantité **fixée** (à la main par le staff, ou par une répartition
`QUANTITY_SPLIT`) ne bouge pas : elle est signalée comme « quantité fixée par l'équipe à vérifier ».
Une ligne dont le prix ou la quantité a été modifiée par le staff est protégée
(`409 LINE_LOCKED_BY_STAFF` pour l'organisateur). Les lignes sont une **copie figée** des produits
et des options choisis : une modification ultérieure du catalogue ne change pas une commande
existante.

## Devis

Les lignes (`PrintQuoteLine`) ont un type : produit, service, remise ou ligne libre. Le staff
(`STAFF_ADMIN`) change les prix et les quantités, ajoute des frais, retire des lignes, tant que la
commande est `SUBMITTED` ou `QUOTED`. Une remise est saisie en montant positif et stockée en prix
unitaire négatif. Un devis vide (`EMPTY_QUOTE`) ou de total négatif (`NEGATIVE_TOTAL`) ne s'envoie
pas. Le total se recalcule après chaque modification.

## Fil de discussion

Le fil (`PrintRequestMessage`) est ouvert dans **tous les statuts** et sur un évènement archivé. Il
mêle des messages (organisateur ou équipe Badge, avec une pièce jointe facultative) et des entrées
automatiques (`kind = EVENT`) : envoi, modifications de lignes, badges, informations, devis envoyé,
accepté, rouvert ou en révision, changement de template, changement de statut, refus, annulation,
paiement reçu ou échoué, planches lancées, inscriptions écartées.

- Chaque modification de lignes crée **sa propre entrée** (aucun regroupement) : une entrée n'est
  jamais modifiée après coup, ce qui garantit que le rafraîchissement par date de création
  (`?after=`) la retrouve.
- Les corps sont stockés bruts et **rendus en texte seulement**, jamais en HTML.
- Le paiement hors ligne écrit « Paiement reçu : … (hors ligne : motif) ».
- L'écran de l'organisateur se rafraîchit toutes les 30 secondes quand l'onglet est visible.

## Droits

| Action | Qui |
|---|---|
| Créer, modifier, envoyer, annuler, écrire dans le fil | Détenteur de `print.request` (jamais le staff côté organisateur : `403 STAFF_FORBIDDEN`) |
| Accepter un devis | OWNER de l'organisation (`403 OWNER_REQUIRED` pour un MANAGER) |
| Modifier les lignes, envoyer le devis, rouvrir, marquer payée | `STAFF_ADMIN` |
| Refuser, passer en production, marquer prête, terminer, écrire dans le fil | `STAFF_SUPPORT` |
| Lire | Tout le staff, `STAFF_OBSERVER` compris |

Un brouillon est invisible du staff (`404`). Sur un évènement archivé, l'organisateur ne peut plus
créer ni modifier, mais peut annuler, lire et écrire dans le fil.

## Paiement hors ligne

Un `STAFF_ADMIN` marque une commande `ACCEPTED` comme payée en saisissant un **motif** (3 à 500
caractères) : statut `PAID`, entrée du fil, journal `PRINT_REQUEST_MARKED_PAID` et notification.
Le bouton « Marquer payée » reste inactif tant que le motif est trop court. Le passage en `PAID` est
réalisé par `markPaid(tx, requestId, { paymentId?, manual? })`, appelée aussi par le paiement en
ligne (plan 34).

## Verrou et épinglage du template

De `PAID` à `READY` (`TEMPLATE_LOCK_STATUSES`), le template de badge de l'évènement **ne change
plus**, à tous les niveaux (évènement, organisation, plateforme) : le changement est refusé
(`409 TEMPLATE_LOCKED_BY_PRINT_REQUEST`) pour l'évènement, et pour un changement d'organisation ou
de plateforme les évènements concernés gardent l'ancien template, **épinglé** sur la commande
(`templatePinned`) puis sur l'évènement. Avant le paiement, un changement de template met la copie
de la commande à jour et la remet en révision (`TEMPLATE_CHANGED`, acceptation annulée). Quand la
commande quitte `ACCEPTED`/`PAID`/`IN_PRODUCTION`/`READY`, l'épinglage est levé.

## Production et planches

Depuis une commande `PAID`, `IN_PRODUCTION` ou `READY` en amont, « Générer les planches » ouvre
`/platform/print/sheets?printRequestId=…` : organisation, évènement et badges sont ceux de la
commande, dans son ordre ([planches](impression-planches.md)). À la terminaison, le staff peut
marquer les badges comme imprimés (route `registrations/print`, par paquets de 500). La commande
passe d'abord en `COMPLETED` ; l'échec du marquage n'annule pas la clôture et prévient seulement.

## Fichiers

- Organisateur : `POST /api/org/[orgId]/events/[eventId]/print-requests/upload` (JPEG, PNG, WebP ou
  PDF, 5 Mo), clés `print-requests/{eventId}/{uuid}.{ext}`. Autorisé sur un évènement archivé.
- Staff : `POST /api/platform/upload?context=print-request`, clés `print-requests/staff/…`
  (`STAFF_SUPPORT`).
- Une pièce jointe ou une option de type fichier doit avoir la **forme stricte** d'une clé de cet
  évènement (ou du staff) : une clé étrangère ou contenant `..` est refusée (`INVALID_ATTACHMENT`).
- Les fichiers restent servis par `/api/files`, qui applique les droits.

## Notifications

| Évènement | Destinataires |
|---|---|
| Commande envoyée | Staff `STAFF_ADMIN` et au-dessus |
| Devis envoyé | ADMIN de l'évènement (le propriétaire, seul à pouvoir accepter, est couvert : OWNER et MANAGER valent ADMIN) |
| Message de l'organisateur | Staff `STAFF_SUPPORT` et au-dessus |
| Message du staff | ADMIN de l'évènement |
| Changement de statut | Selon le cas, l'organisateur (ADMIN de l'évènement), le staff (`STAFF_ADMIN`), ou les deux |
| Passage en `PAID` | ADMIN de l'évènement et `STAFF_ADMIN` ; texte propre au marquage hors ligne |
| Paiement reçu alors que la commande ne l'attendait plus | `STAFF_ADMIN` |

L'auteur de l'action est exclu des destinataires. Chaque notification est aussi envoyée par email (queue d'emails) et ne bloque jamais l'action en
cas d'échec. Les entrées du journal d'activité sont `PRINT_REQUEST_SUBMITTED`, `_UPDATED`, `_QUOTED`,
`_ACCEPTED`, `_REOPENED`, `_STATUS_CHANGED`, `_CANCELLED`, `_REJECTED` et `_MARKED_PAID`.

## Fichiers du code

| Chemin | Contenu |
|---|---|
| `src/lib/print-requests/transitions.ts` | Table des transitions (`nextStatus`) |
| `src/lib/print-requests/service.ts` | Références, verrous, `applyTransition`, `applyEdit`, `markPaid`, sonde de paiement |
| `src/lib/print-requests/lifecycle.ts` | Création, envoi, annulation, acceptation |
| `src/lib/print-requests/content.ts` | Badges, produits, quantités, validation des fichiers |
| `src/lib/print-requests/quote.ts` | Lignes du devis côté staff, envoi, réouverture, refus, paiement manuel |
| `src/lib/print-requests/thread.ts` | Fil : entrées automatiques |
| `src/lib/print-requests/template-lock*.ts` | Verrou et épinglage du template |
| `src/app/api/org/[orgId]/events/[eventId]/print-requests/**` | Routes organisateur |
| `src/app/api/platform/print/requests/**` | Routes staff |
| `src/components/event/print/**`, `src/components/print/**` | Écrans organisateur et composants communs |
| `src/components/staff/print/**` | Écrans staff |
| `e2e/event/print*.spec.ts`, `e2e/platform/print-request*.spec.ts` | Tests de bout en bout |

## Points d'extension

- **Plan 34 (paiement en ligne)** : `paymentProbe` (sonde des paiements en cours, aujourd'hui sur
  les `Payment` `PENDING` de la commande) ; `markPaid`, qui accepte un `paymentId` et le range dans
  `paidPaymentId` ; le bouton « Payer » de l'organisateur, prévu après « Accepter le devis ».
- **Plan 35 (impression sur place)** : `marginPercent` (marge d'impression sur place),
  `parentRequestId` (commande complémentaire rattachée), `PrintQuoteLine.usesOrgCredit` (ligne payée
  par le crédit de l'organisation, `CREDIT_LINE_LOCKED`), compteur et plafond
  (`onsite-counter.ts`). Livré : voir [impression pendant l'évènement](impression-sur-place.md).

## Limites connues

- La suppression d'une inscription retire son badge de la commande sans trace dans le fil.
- Les verrous sont pris par transaction : toute nouvelle écriture sur une commande doit passer par
  `lockRequestWithEvent` (évènement d'abord, commande ensuite).
- Les tests de bout en bout créent les commandes directement en base (`createTestPrintRequest`) et
  épinglent un template jetable sur l'évènement : ils ne dépendent pas du template par défaut.
