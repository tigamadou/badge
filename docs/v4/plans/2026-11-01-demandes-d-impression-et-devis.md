# Demandes d'impression, devis et fil de discussion — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un organisateur compose et envoie une demande d'impression (lot figé de badges ou
quantité sur place, support, accessoires, remise) ; le staff la chiffre en devis, les deux
échangent dans un fil qui retrace chaque modification ; l'OWNER accepte une version précise
du devis ; le staff fait avancer la demande jusqu'à `COMPLETED` et génère les planches.

**Architecture :** quatre couches. (1) Une **machine à états pure**
(`src/lib/print-requests/transitions.ts`, `nextStatus`) : seule source des transitions
permises. (2) Des **services transactionnels** (`service.ts` pour le noyau partagé avec les
plans 34 et 35, `content.ts` pour le contenu saisi par l'organisateur, `lifecycle.ts` pour
envoi / annulation / acceptation, `quote.ts` pour les opérations du staff) ; toute écriture
passe par `applyTransition` (mise à jour conditionnelle sur le statut lu) et ajoute son
entrée au fil (`thread.ts`, regroupement des modifications de lignes). (3) Des **routes
minces** : côté organisateur sous `/api/org/[orgId]/events/[eventId]/print-requests/**`
(`withEventAuth`, permission `print.request`), côté staff sous
`/api/platform/print/requests/**` (`withStaffAuth`) ; elles journalisent (`logActivity`) et
notifient après validation de la transaction. (4) Les **écrans** `/event/[eventId]/print/**`
et `/platform/print/requests/**`, un fil partagé (`PrintThread`) rafraîchi toutes les 30 s.
Le verrou du template (`template-lock.ts`) s'insère dans les trois routes de réglage du
template.

**Tech Stack :** Next.js 16 App Router, Prisma 6 / MySQL 8, zod, Vitest 4 (BDD réelle),
Playwright. Aucune nouvelle dépendance.

**Spec :** [`docs/v4/specs/2026-11-01-33-v4-demandes-d-impression-et-devis.md`](../specs/2026-11-01-33-v4-demandes-d-impression-et-devis.md)
(interactions : specs [31](../specs/2026-11-01-31-v4-gabarits-et-planches-d-impression.md),
[32](../specs/2026-11-01-32-v4-catalogue-produits-d-impression.md),
[34](../specs/2026-11-01-34-v4-paiement-des-devis-d-impression.md),
[35](../specs/2026-11-01-35-v4-impression-pendant-l-evenement.md))

**Branche :** `feat/service-impression` (créée depuis `development` le 2026-11-01)

**Prérequis :** plans 31 (gabarits et planches) et 32 (catalogue) terminés sur la branche.
Le plan 34 (paiement) et le plan 35 (impression sur place) viennent **après** celui-ci.

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma, permission `print.request`, notifications, libellés | [ ] | | |
| 2 | Machine à états et libellés : `nextStatus`, `formatFcfa` | [ ] | | |
| 3 | Fil : `describeThreadEvent`, `appendThreadEvent`, `postMessage` | [ ] | | |
| 4 | Notifications des demandes | [ ] | | |
| 5 | Noyau : brouillon, référence, `applyTransition`, `markPaid`, `assertOwner` | [ ] | | |
| 6 | Contenu : informations de remise et badges (réservation) | [ ] | | |
| 7 | Contenu : produits de l'organisateur | [ ] | | |
| 8 | Envoi, annulation, acceptation | [ ] | | |
| 9 | Opérations du staff : lignes, devis, refus, statuts, paiement manuel | [ ] | | |
| 10 | API organisateur | [ ] | | |
| 11 | API staff | [ ] | | |
| 12 | Téléversement organisateur et fichiers sensibles | [ ] | | |
| 13 | Verrou du template de l'évènement | [ ] | | |
| 14 | « Générer les planches » depuis une demande | [ ] | | |
| 15 | Écrans organisateur + entrée « Impression » | [ ] | | |
| 16 | Écrans staff + entrée « Demandes » avec compteur | [ ] | | |
| 17 | E2E et documentation | [ ] | | |
| — | Vérification finale (lint, typecheck, test, e2e, parcours complet au navigateur) | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée. En cas d'interruption, passez la ligne à `[~]` et notez
précisément l'état.

## Contraintes globales

- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en
  français, dans le style du fichier touché. Commits et noms de fichiers en ASCII.
- **Montants en FCFA, entiers** (`Int`) ; affichage par `formatFcfa` (Task 2). Une ligne
  `DISCOUNT` a un `unitPrice <= 0`, toutes les autres `>= 0`.
- **Référence** : `IMP-{année}-{numéro sur 4 chiffres}`, attribuée à la création du
  brouillon, unique.
- **Toute transition passe par `applyTransition`** (Task 5) : jamais de `update` direct du
  champ `status` ailleurs, plans 34 et 35 compris.
- **Droits** : organisateur — permission d'évènement `print.request` (rôle évènement
  `ADMIN`) ; accepter un devis — OWNER de l'organisation seulement, staff refusé (403
  `STAFF_FORBIDDEN`) ; staff — lecture `STAFF_OBSERVER`, messages et statuts
  `STAFF_SUPPORT`, lignes, devis, réouverture et paiement manuel `STAFF_ADMIN`.
  `withEventAuth` impose déjà `MANAGE_ONGOING_EVENTS` aux écritures non-staff.
- **Évènement archivé** : création, modification et envoi refusés (410 de `withEventAuth`) ;
  lecture, fil, annulation et acceptation restent permis (`allowArchived: true`).
- **Toute action sensible loggée** via `logActivity` ; chaque nouvel `ActivityType` reçoit un
  libellé dans `src/lib/activity-labels.ts`. Les notifications partent **après** la
  transaction (déclencheurs `notifyPrintRequest*`, qui ne lèvent jamais).
- **Couverture 100 %** sur `src/lib/**` et `src/app/api/**`. Tests sur la **vraie MySQL** ;
  nouveaux modèles ajoutés à la purge de `src/test-setup.ts` dans l'ordre des FK. Fixture
  commune : `src/lib/__tests__/helpers/print-requests.ts` (Task 5).
- **Commandes** (conteneur dev, `make dev` lancé) :
  - un fichier : `docker compose -f docker-compose.dev.yml exec app yarn vitest run <chemin>` ;
  - schéma : `make db-push` ;
  - avant de déclarer une task terminée : `make lint && make typecheck && make test`.
- **`make test` vide la BDD de dev** : `make db-seed` avant toute vérification navigateur.
- **Commit — uniquement sur demande explicite de l'utilisateur.** Les étapes « commit » de ce
  plan ne valent pas autorisation. Jamais de trailer de co-auteur.
- **Pas de déploiement, pas de SSH, pas de prod.**

## Arbitrages de cohérence (2026-11-01, contrôleur)

- Une ligne `usesOrgCredit` (ajoutée par le plan 35) n'est **ni modifiable ni retirable** par
  `updateStaffLine` / `removeStaffLine` : ces fonctions refusent avec `409 CREDIT_LINE_LOCKED`
  (le plan 35 ajoute ce garde et ses tests ; seules ses routes de crédit touchent cette ligne).
- `followBadgeCount` ne fait **pas suivre** une ligne dont les choix contiennent une
  répartition `QUANTITY_SPLIT` : elle se comporte comme `quantityOverridden`, et le fil
  signale l'écart (évite un `SPLIT_MISMATCH` au prochain enregistrement de l'organisateur).

## Points de vigilance de revue

1. **Réservation concurrente** : deux envois simultanés partageant une inscription — un seul
   aboutit, l'autre reçoit 409 `REGISTRATIONS_TAKEN` ; un brouillon ne réserve rien. Verrou
   `SELECT … FOR UPDATE` sur la ligne `Event`. (Tasks 6 et 8.)
2. **Un devis accepté ne bouge jamais** : toute modification après `QUOTED` repasse en
   `SUBMITTED` ; `ACCEPTED` refuse toute modification tant que le staff n'a pas rouvert ;
   accepter une version périmée → 409 `QUOTE_VERSION_MISMATCH`. (Tasks 5, 8, 9.)
3. **Paiement en cours** : réouverture, annulation, passage manuel en `PAID` et changement de
   template d'une demande `ACCEPTED` refusés (409 `PAYMENT_IN_PROGRESS`) — à tester par la
   sonde injectable. (Tasks 5, 8, 9, 13.)
4. **Verrou du template à tous les niveaux de la cascade** : un changement au niveau org ou
   plateforme **épingle** le template des évènements verrouillés qui en héritaient, et
   l'épinglage est levé à la sortie du verrou. (Task 13.)
5. **Le staff n'agit jamais comme organisateur** : `hasEventPermission` laisse passer le
   staff ; les routes d'acceptation et de message organisateur doivent le refuser
   explicitement, sinon un message staff serait enregistré côté `ORGANIZER`. (Task 10.)

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | enums, `PrintRequest`, `PrintRequestItem`, `PrintQuoteLine`, `PrintRequestMessage`, `PrintSheetGeneration.printRequestId`, types de notification et d'activité |
| `src/lib/auth-helpers.ts` | permission `print.request` |
| `src/lib/print-requests/labels.ts` (nouveau) | libellés de statut et de type, `formatFcfa`, ensembles de statuts, `chunk` |
| `src/lib/print-requests/transitions.ts` (nouveau) | `nextStatus` (pur) |
| `src/lib/print-requests/errors.ts` (nouveau) | `PrintRequestError`, `printRequestErrorResponse` |
| `src/lib/print-requests/thread.ts` (nouveau) | textes du fil, `appendThreadEvent`, `postMessage`, `listThread` |
| `src/lib/print-requests/service.ts` (nouveau) | noyau partagé : `createDraft`, `applyTransition`, `applyEdit`, `markPaid`, `assertOwner`, `isPaymentInProgress`… |
| `src/lib/print-requests/inputs.ts` (nouveau) | schémas zod des entrées |
| `src/lib/print-requests/content.ts` (nouveau) | informations, badges, produits de l'organisateur |
| `src/lib/print-requests/lifecycle.ts` (nouveau) | envoi, annulation, acceptation |
| `src/lib/print-requests/quote.ts` (nouveau) | lignes du staff, envoi du devis, réouverture, refus, statuts, paiement manuel |
| `src/lib/print-requests/template-lock.ts` (nouveau) | verrou et épinglage du template, resynchronisation des copies |
| `src/lib/notifications/{notify,messages,triggers}.ts` | 4 nouveaux types |
| `src/app/api/org/[orgId]/events/[eventId]/print-requests/**` (nouveau) | API organisateur |
| `src/app/api/platform/print/requests/**` (nouveau) | API staff |
| `src/app/api/files/[...path]/route.ts`, `src/lib/storage.ts` | clés `print-requests/` |
| `src/app/api/{org/[orgId]/events/[eventId]/settings,org/[orgId]/settings,platform/settings}/badge/route.ts` | verrou du template |
| `src/lib/print-sheets/generations.ts`, `run-generation.ts`, `src/app/api/platform/print/sheets/route.ts`, `src/components/staff/print/GenerationForm.tsx` | génération liée à une demande |
| `src/components/print/PrintThread.tsx`, `QuoteLinesTable.tsx` (nouveaux, client) | fil et lignes, partagés |
| `src/components/event/print/**` (nouveau) | assistant, sélection des badges, actions |
| `src/components/staff/print/Request*.tsx`, `QuoteEditor.tsx` (nouveaux) | écrans staff |
| `src/app/event/[eventId]/print/**`, `src/app/platform/print/requests/**` (nouveaux) | pages |
| `src/components/event/EventShell.tsx`, `src/components/staff/StaffShell.tsx`, `src/components/admin/SidebarNav.tsx`, `src/app/platform/layout.tsx` | navigation et compteur |
| `src/hooks/useVisibleInterval.ts` (nouveau) | rafraîchissement quand l'onglet est visible |
| `docs/v4/features/impression-demandes.md` (nouveau), `docs/v4/README.md` | documentation |

---

## Task 1 — Schéma, permission `print.request`, notifications, libellés

**Files :**
- Modify : `prisma/schema.prisma`, `src/test-setup.ts`, `src/lib/auth-helpers.ts`,
  `src/lib/activity-labels.ts`, `src/lib/notifications/notify.ts`
- Test : `src/lib/__tests__/activity-labels.test.ts`, `src/lib/__tests__/auth-helpers.test.ts`,
  `src/lib/notifications/__tests__/notify.test.ts` (existants, compléter)

**Interfaces :**
- Consumes : `PrintProduct` (plan 32), `PrintSheetGeneration` (plan 31).
- Produces :
  - `enum PrintRequestType { ADVANCE ONSITE }`
  - `enum PrintRequestStatus { DRAFT SUBMITTED QUOTED ACCEPTED PAID IN_PRODUCTION READY COMPLETED REJECTED CANCELLED }`
  - `enum PrintDelivery { PICKUP DELIVERY }`, `enum PrintQuoteLineKind { PRODUCT SERVICE DISCOUNT CUSTOM }`,
    `enum PrintLineAuthor { ORGANIZER STAFF }`, `enum PrintThreadSide { ORGANIZER STAFF SYSTEM }`,
    `enum PrintMessageKind { MESSAGE EVENT }`
  - `model PrintRequest { id cuid, reference String @unique, eventId (Event, Cascade), orgId
    (Organization, Cascade), type PrintRequestType, status PrintRequestStatus @default(DRAFT),
    createdById String? (User "PrintRequestCreatedBy", SetNull), badgeTemplateId String?,
    badgeWidthPx Float?, badgeHeightPx Float?, badgePages Int?, templatePinned Boolean
    @default(false), delivery PrintDelivery?, deliveryAddress String? @db.Text,
    deliveryContactName String?, deliveryContactPhone String?, wantedBy DateTime?,
    estimatedQuantity Int?, onsiteSchedule Json?, onsiteLocation String? @db.Text,
    onsiteContactName String?, onsiteContactPhone String?, notes String? @db.Text,
    quoteVersion Int @default(0), acceptedVersion Int?, acceptedTotal Int?, acceptedAt
    DateTime?, acceptedById String? (User "PrintRequestAcceptedBy", SetNull), total Int
    @default(0), marginPercent Int? /* plan 35 */, parentRequestId String? (PrintRequest
    "PrintRequestParent", SetNull) /* plan 35 */, submittedAt DateTime?, quotedAt DateTime?,
    paidAt DateTime?, paidPaymentId String? /* plan 34 : Payment qui a soldé la demande,
    sans relation Prisma, écrit par markPaid */, completedAt DateTime?, cancelledAt
    DateTime?, createdAt, updatedAt
    @updatedAt, @@index([eventId, status]), @@index([status, submittedAt]), @@index([orgId]) }`
  - `model PrintRequestItem { id cuid, requestId (PrintRequest, Cascade), registrationId
    (Registration, Cascade), position Int, createdAt, @@unique([requestId, registrationId]),
    @@index([registrationId]) }`
  - `model PrintQuoteLine { id cuid, requestId (PrintRequest, Cascade), kind
    PrintQuoteLineKind, productId String? (PrintProduct, SetNull), label String,
    optionsSnapshot Json? /* ChoiceSnapshot[] */, choices Json? /* OptionChoice[] brut, pour
    rouvrir le configurateur */, quantity Int, unitPrice Int, lineTotal Int, position Int,
    addedBy PrintLineAuthor, priceOverridden Boolean @default(false), quantityOverridden
    Boolean @default(false), removedAt DateTime?, createdAt, updatedAt @updatedAt,
    @@index([requestId, removedAt]) }`
  - `model PrintRequestMessage { id cuid, requestId (PrintRequest, Cascade), authorId String?
    (User, SetNull), side PrintThreadSide, kind PrintMessageKind, body String @db.Text,
    eventType String?, details Json?, attachmentKey String?, createdAt, updatedAt @updatedAt,
    @@index([requestId, createdAt]), @@index([attachmentKey]) }`
  - `PrintSheetGeneration.printRequestId String?` (PrintRequest, SetNull) +
    `@@index([printRequestId])`.
  - `NotificationType` : `PRINT_REQUEST_SUBMITTED`, `PRINT_REQUEST_QUOTED`,
    `PRINT_REQUEST_MESSAGE`, `PRINT_REQUEST_STATUS_CHANGED` ; `EMAIL_BY_TYPE` : `true` pour
    les quatre.
  - `ActivityType` : `PRINT_REQUEST_SUBMITTED`, `PRINT_REQUEST_UPDATED`,
    `PRINT_REQUEST_QUOTED`, `PRINT_REQUEST_ACCEPTED`, `PRINT_REQUEST_REOPENED`,
    `PRINT_REQUEST_STATUS_CHANGED`, `PRINT_REQUEST_CANCELLED`, `PRINT_REQUEST_REJECTED`,
    `PRINT_REQUEST_MARKED_PAID` — libellés : « Demande d'impression envoyée », « … modifiée »,
    « Devis d'impression envoyé », « Devis d'impression accepté », « Devis d'impression
    rouvert », « Statut de demande d'impression changé », « Demande d'impression annulée »,
    « Demande d'impression refusée », « Demande d'impression marquée payée ».
  - `EventPermission` : `"print.request"` ; `EVENT_PERMISSION_ROLES["print.request"] = ["ADMIN"]`.

- [ ] **Step 1 : compléter les tests**
  - `activity-labels.test.ts` : bloc « types des demandes d'impression » — les 9 types ont un
    libellé différent du type brut ; `logKind("PRINT_REQUEST_UPDATED") === "modification"`,
    `logKind("PRINT_REQUEST_QUOTED") === "systeme"`.
  - `auth-helpers.test.ts` : `print.request` vrai pour un membre `ADMIN` de l'évènement, un
    OWNER et un MANAGER de l'org, le staff ; faux pour `OPERATOR`, `PRINTER`, `VIEWER`, un
    AUDITOR.
  - `notify.test.ts` (« EMAIL_BY_TYPE suit la matrice ») : les 4 nouveaux types valent `true`.
- [ ] **Step 2 : lancer les tests** — attendu : FAIL (types et permission inconnus).
- [ ] **Step 3 : schéma, permission, libellés** — `make db-push` ; ajouter à la purge de
  `src/test-setup.ts`, **en tête** (avant `printSheetGeneration`) :
  `printRequestMessage`, `printQuoteLine`, `printRequestItem`, puis `printRequest` (mettre
  d'abord `parentRequestId` à `null` par `updateMany` pour la FK auto-référente).
- [ ] **Step 4 : lancer les tests** — attendu : PASS. Puis `make typecheck`.
- [ ] **Step 5 : commit** — `feat(impression): schema des demandes d'impression`.

## Task 2 — Machine à états et libellés

**Files :**
- Create : `src/lib/print-requests/labels.ts`, `src/lib/print-requests/transitions.ts`
- Test : `src/lib/__tests__/print-requests-transitions.test.ts`,
  `src/lib/__tests__/print-requests-labels.test.ts`

**Interfaces :**
- Produces (`labels.ts`) :
  - `PRINT_REQUEST_STATUS_LABELS: Record<PrintRequestStatus, string>` : Brouillon, Envoyée,
    Devis envoyé, Devis accepté, Payée, En production, Prête, Terminée, Refusée, Annulée.
  - `PRINT_REQUEST_TYPE_LABELS: Record<PrintRequestType, string>` : « En amont »,
    « Pendant l'évènement ».
  - `RESERVING_STATUSES: PrintRequestStatus[]` = tous sauf `DRAFT`, `REJECTED`, `CANCELLED`.
  - `formatFcfa(amount: number): string` — **réexporté** depuis
    `@/lib/print-catalog/pricing-core` (plan 32, Task 2), pas réimplémenté.
  - `chunk<T>(items: T[], size: number): T[][]`.
- Produces (`transitions.ts`) :
  - `type PrintRequestActor = "ORGANIZER" | "STAFF" | "SYSTEM"`
  - `type PrintRequestAction = "SUBMIT" | "ORGANIZER_EDIT" | "STAFF_EDIT" | "SEND_QUOTE" |
    "ACCEPT" | "REOPEN" | "REJECT" | "CANCEL" | "MARK_PAID" | "START_PRODUCTION" |
    "MARK_READY" | "COMPLETE" | "TEMPLATE_CHANGED"`
  - `nextStatus(status: PrintRequestStatus, action: PrintRequestAction, actor:
    PrintRequestActor): PrintRequestStatus | null` — pur, table ci-dessous, `null` ailleurs.

Table des transitions (référence de tout le plan ; les colonnes « fil » et « notification »
sont appliquées par les fonctions des Tasks 5 à 9 et les routes des Tasks 10-11) :

| # | Départ | Action | Acteur | Arrivée | Entrée du fil | Notification |
|---|---|---|---|---|---|---|
| 1 | DRAFT | SUBMIT | ORGANIZER | SUBMITTED | `SUBMITTED` | `PRINT_REQUEST_SUBMITTED` → staff `STAFF_ADMIN` |
| 2 | DRAFT | ORGANIZER_EDIT | ORGANIZER | DRAFT | aucune | aucune |
| 3 | SUBMITTED | ORGANIZER_EDIT | ORGANIZER | SUBMITTED | `BADGES_CHANGED` / `LINES_CHANGED` / `REQUEST_UPDATED` | aucune |
| 4 | QUOTED | ORGANIZER_EDIT | ORGANIZER | SUBMITTED | idem + `QUOTE_REVISION` | `STATUS_CHANGED` → staff `STAFF_ADMIN` |
| 5 | SUBMITTED | STAFF_EDIT | STAFF | SUBMITTED | `LINES_CHANGED` (regroupée) | aucune |
| 6 | QUOTED | STAFF_EDIT | STAFF | SUBMITTED | `LINES_CHANGED` + `QUOTE_REVISION` | `STATUS_CHANGED` → admins de l'évènement |
| 7 | SUBMITTED | SEND_QUOTE | STAFF | QUOTED | `QUOTE_SENT` | `PRINT_REQUEST_QUOTED` → admins de l'évènement |
| 8 | QUOTED | ACCEPT | ORGANIZER (OWNER) | ACCEPTED | `QUOTE_ACCEPTED` | `STATUS_CHANGED` → staff `STAFF_ADMIN` + admins |
| 9 | ACCEPTED | REOPEN | STAFF | SUBMITTED | `QUOTE_REOPENED` | `STATUS_CHANGED` → admins |
| 10-11 | SUBMITTED, QUOTED | REJECT | STAFF | REJECTED | `REJECTED` | `STATUS_CHANGED` → admins |
| 12 | DRAFT | CANCEL | ORGANIZER | CANCELLED | `CANCELLED` | aucune |
| 13-15 | SUBMITTED, QUOTED, ACCEPTED | CANCEL | ORGANIZER | CANCELLED | `CANCELLED` | `STATUS_CHANGED` → staff `STAFF_ADMIN` |
| 16-17 | ACCEPTED | MARK_PAID | SYSTEM, STAFF | PAID | `PAYMENT_RECEIVED` | `STATUS_CHANGED` → admins + staff `STAFF_ADMIN` |
| 18 | PAID | START_PRODUCTION | STAFF | IN_PRODUCTION | `STATUS_CHANGED` | `STATUS_CHANGED` → admins |
| 19 | IN_PRODUCTION | MARK_READY | STAFF | READY | `STATUS_CHANGED` | `STATUS_CHANGED` → admins |
| 20 | READY | COMPLETE | STAFF | COMPLETED | `STATUS_CHANGED` | `STATUS_CHANGED` → admins |
| 21 | DRAFT | TEMPLATE_CHANGED | SYSTEM | DRAFT | aucune | aucune |
| 22-24 | SUBMITTED, QUOTED, ACCEPTED | TEMPLATE_CHANGED | SYSTEM | SUBMITTED | `TEMPLATE_CHANGED` | `STATUS_CHANGED` → admins + staff `STAFF_ADMIN` (si le statut change) |

Gardes hors table (dans les services) : `PAYMENT_IN_PROGRESS` pour 9, 15, 17 (passage
manuel) et 24 ; OWNER pour 8 ; « admins » = `eventRoles ADMIN` (inclut OWNER et MANAGER de l'org).

- [ ] **Step 1 : écrire les tests**

```ts
it("les 24 combinaisons de la table, et elles seules, sont permises", () => {
  // boucle sur 10 statuts x 13 actions x 3 acteurs : compte des non-null === 24
});
it("DRAFT + SUBMIT par ORGANIZER -> SUBMITTED ; par STAFF -> null", () => {});
it("QUOTED + STAFF_EDIT -> SUBMITTED (le devis repasse en révision)", () => {});
it("ACCEPTED + STAFF_EDIT -> null : il faut rouvrir", () => {});
it("ACCEPTED + MARK_PAID par SYSTEM et par STAFF -> PAID ; par ORGANIZER -> null", () => {});
it("COMPLETED, REJECTED, CANCELLED n'ont aucune sortie", () => {});
it("PAID + CANCEL -> null", () => {});
it("formatFcfa(6000) === '6 000 FCFA'", () => {});
it("chunk([1,2,3,4,5], 2) === [[1,2],[3,4],[5]]", () => {});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL (modules absents).
- [ ] **Step 3 : implémenter `labels.ts` et `transitions.ts`.**
- [ ] **Step 4 : lancer les tests** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): machine a etats des demandes`.

## Task 3 — Fil : textes, entrées automatiques regroupées, messages

**Files :**
- Create : `src/lib/print-requests/errors.ts`, `src/lib/print-requests/thread.ts`
- Test : `src/lib/__tests__/print-requests-thread.test.ts`

**Interfaces :**
- Consumes : modèles (Task 1), `formatFcfa`, `PRINT_REQUEST_STATUS_LABELS` (Task 2).
- Produces :
  - `type PrintRequestErrorCode = "NOT_FOUND" | "VALIDATION" | "INVALID_TRANSITION" |
    "PAYMENT_IN_PROGRESS" | "QUOTE_ACCEPTED" | "REQUEST_LOCKED" | "REGISTRATIONS_TAKEN" |
    "INVALID_SELECTION" | "EMPTY_SELECTION" | "TYPE_MISMATCH" | "BADGE_PRODUCT_REQUIRED" |
    "BADGE_COUNT_REQUIRED" | "PRODUCT_UNAVAILABLE" | "INVALID_CHOICES" | "BELOW_MIN_QUANTITY"
    | "LINE_LOCKED_BY_STAFF" | "DELIVERY_INCOMPLETE" | "ONSITE_INCOMPLETE" |
    "QUOTE_VERSION_MISMATCH" | "EMPTY_QUOTE" | "NEGATIVE_TOTAL" | "OWNER_REQUIRED" |
    "STAFF_FORBIDDEN" | "INVALID_ATTACHMENT" | "TEMPLATE_LOCKED_BY_PRINT_REQUEST"`
  - `class PrintRequestError extends Error { constructor(readonly code: PrintRequestErrorCode,
    readonly status: 400 | 403 | 404 | 409, readonly details?: Record<string, unknown>) }`
  - `printRequestErrorResponse(err: unknown): NextResponse` — `{ error: code, ...details }`
    avec `status` ; relance toute autre erreur.
  - `type ThreadEventType = "SUBMITTED" | "LINES_CHANGED" | "BADGES_CHANGED" |
    "REQUEST_UPDATED" | "QUOTE_SENT" | "QUOTE_ACCEPTED" | "QUOTE_REOPENED" | "QUOTE_REVISION"
    | "TEMPLATE_CHANGED" | "STATUS_CHANGED" | "REJECTED" | "CANCELLED" | "PAYMENT_RECEIVED" |
    "PAYMENT_FAILED" | "SHEETS_GENERATED" | "REGISTRATIONS_SKIPPED"` (les plans 34-35
    l'étendent, union et textes de `describeThreadEvent` dans ce même fichier : plan 34
    `PAYMENT_UNMATCHED` ; plan 35 `ONSITE_MARGIN_CHANGED`, `ORG_CREDIT_APPLIED`,
    `ORG_CREDIT_SPENT`, `ONSITE_CREDIT_EARNED`, `ONSITE_SUPPLEMENT_CREATED`).
  - `type ThreadActor = { userId: string | null; side: PrintThreadSide }` ; défaut
    `{ userId: null, side: "SYSTEM" }`.
  - `type LineChange = { op: "ADDED" | "UPDATED" | "REMOVED"; lineId: string; label: string;
    from?: { quantity: number; unitPrice: number }; to?: { quantity: number; unitPrice:
    number } }`
  - `describeLineChange(c: LineChange): string`, `describeThreadEvent(eventType:
    ThreadEventType, details: Record<string, unknown>): string` (purs, textes ci-dessous).
  - `appendThreadEvent(tx: Prisma.TransactionClient, requestId: string, eventType:
    ThreadEventType, details: Record<string, unknown>, actor?: ThreadActor):
    Promise<PrintRequestMessage>` — `kind = EVENT`, `body = describeThreadEvent(...)`.
    **Regroupement** : si `eventType === "LINES_CHANGED"` et que la dernière entrée de la
    demande (`createdAt desc, id desc`) est un `EVENT` `LINES_CHANGED` de même `side` et même
    `authorId`, elle est mise à jour (`details.changes` concaténés, `body` recalculé) au lieu
    d'en créer une. Un message ou toute autre entrée intercalée coupe le regroupement.
  - `postMessage(input: { requestId: string; authorId: string; side: "ORGANIZER" | "STAFF";
    body: string; attachmentKey: string | null }): Promise<PrintRequestMessage>` — `body`
    nettoyé, 0 à 5000 caractères, vide permis seulement avec une pièce jointe (sinon
    `VALIDATION`) ; pièce jointe organisateur préfixée `print-requests/{eventId}/`, staff
    `print-requests/staff/`, sinon 400 `INVALID_ATTACHMENT` ; demande absente → 404. Permis
    dans **tous** les statuts.
  - `type ThreadEntryDTO = { id: string; side: PrintThreadSide; kind: PrintMessageKind; body:
    string; eventType: string | null; details: unknown; attachmentKey: string | null;
    authorName: string | null; createdAt: string }` ;
    `listThread(requestId: string): Promise<ThreadEntryDTO[]>` (ordre chronologique).

Textes (`n` = nombre, `F(x)` = `formatFcfa(x)`, `L(s)` = libellé de statut) :

| Type | `details` | Texte |
|---|---|---|
| `LINES_CHANGED` 1 changement | `{ changes: [c] }` | `describeLineChange(c)` |
| `LINES_CHANGED` n > 1 | `{ changes }` | `n lignes modifiées` |
| ligne `ADDED` | | `Ligne ajoutée : {label} ({q} × {F(unit)})` |
| ligne `UPDATED` | | `Ligne modifiée : {label} (quantité {a} → {b}, prix unitaire {F(a)} → {F(b)})` — seules les parties qui changent, séparées par `, ` |
| ligne `REMOVED` | | `Ligne retirée : {label}` |
| `SUBMITTED` | `{ badgeCount, total }` | `Demande envoyée : {badgeCount} badges, total estimé {F(total)}` |
| `BADGES_CHANGED` | `{ added, removed, count, lagging: string[] }` | `Badges de la demande : +{added}, −{removed} ({count} au total)` + si `lagging` non vide ` — quantités fixées par l'équipe à vérifier : {lagging.join(", ")}` |
| `REQUEST_UPDATED` | `{ fields: string[] }` | `Informations modifiées : {fields.join(", ")}` |
| `QUOTE_SENT` | `{ version, total }` | `Devis v{version} envoyé : {F(total)}` |
| `QUOTE_ACCEPTED` | `{ version, total }` | `Devis v{version} accepté : {F(total)}` |
| `QUOTE_REOPENED` | `{ version }` | `Devis v{version} rouvert : l'acceptation est annulée` |
| `QUOTE_REVISION` | `{}` | `Devis en révision : il sera renvoyé avant acceptation` |
| `TEMPLATE_CHANGED` | `{ fromLabel, toLabel, acceptanceCancelled }` | `Template de badge changé : {fromLabel} → {toLabel}` + `; l'acceptation est annulée` si vrai |
| `STATUS_CHANGED` | `{ from, to }` | `Statut : {L(from)} → {L(to)}` |
| `REJECTED` | `{ reason }` | `Demande refusée : {reason}` |
| `CANCELLED` | `{}` | `Demande annulée` |
| `PAYMENT_RECEIVED` | `{ amount, reason? }` | `Paiement reçu : {F(amount)}` + ` (hors ligne : {reason})` si `reason` |
| `PAYMENT_FAILED` | `{ amount, paymentId?, reason? }` (plan 34) | `Paiement échoué : {F(amount)}` |
| `SHEETS_GENERATED` | `{ generationId, badgeCount }` | `Planches lancées pour {badgeCount} badges` |
| `REGISTRATIONS_SKIPPED` | `{ registrationIds }` | `{n} badge(s) écarté(s) à la génération (inscription non approuvée) : {ids.join(", ")}` |

- [ ] **Step 1 : écrire les tests**

```ts
it("describeLineChange UPDATED ne cite que le prix quand seul le prix change", () => {
  // { op: "UPDATED", label: "Support PVC", from: { quantity: 150, unitPrice: 1500 }, to: { quantity: 150, unitPrice: 1200 } }
  // -> `Ligne modifiée : Support PVC (prix unitaire ${formatFcfa(1500)} → ${formatFcfa(1200)})`
});
it("describeThreadEvent couvre chaque ThreadEventType (texte non vide, sans 'undefined')", () => {});
it("trois modifications de lignes du même staff donnent une seule entrée « 3 lignes modifiées »", async () => {
  // 3 appendThreadEvent LINES_CHANGED, actor { userId: staff.id, side: "STAFF" } -> 1 ligne en base, details.changes.length 3
});
it("un message intercalé coupe le regroupement", async () => { /* ajout, postMessage, ajout -> 3 lignes */ });
it("auteur différent ou côté différent : pas de regroupement", async () => {});
it("postMessage refuse un corps vide sans pièce jointe (VALIDATION)", async () => {});
it("postMessage organisateur avec une clé print-requests/staff/x.pdf -> INVALID_ATTACHMENT", async () => {});
it("postMessage reste permis sur une demande COMPLETED, REJECTED et CANCELLED", async () => {});
it("listThread renvoie le nom de l'auteur, null pour le système, dans l'ordre", async () => {});
it("printRequestErrorResponse : PrintRequestError -> statut et { error, ...details } ; autre erreur relancée", async () => {});
```

- [ ] **Step 2 : lancer les tests** — attendu : FAIL.
- [ ] **Step 3 : implémenter `errors.ts` et `thread.ts`** (les tests créent les demandes
  directement par Prisma : `createDraft` n'existe qu'en Task 5).
- [ ] **Step 4 : lancer les tests** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): fil des demandes d'impression`.

## Task 4 — Notifications des demandes

**Files :**
- Modify : `src/lib/notifications/messages.ts`, `src/lib/notifications/triggers.ts`
- Test : `src/lib/notifications/__tests__/messages.test.ts` (compléter),
  `src/lib/notifications/__tests__/triggers-print-requests.test.ts` (nouveau)

**Interfaces :**
- Consumes : `notifyAll`, `withNotificationGuard`, `NotificationContent`, libellés (Task 2).
- Produces (`messages.ts`) — liens : organisateur `/event/{eventId}/print/{requestId}`, staff
  `/platform/print/requests/{requestId}` ; `links: []` :
  - `printRequestSubmittedMessage(a: { requestId: string; reference: string; eventTitle:
    string; orgName: string; type: PrintRequestType; badgeCount: number })` → titre
    « Nouvelle demande d'impression », corps `{orgName} a envoyé la demande {reference}
    ({type en minuscules}, {badgeCount} badges) pour {eventTitle}.`, bouton « Voir la
    demande » (lien staff).
  - `printRequestQuotedMessage(a: { requestId: string; eventId: string; reference: string;
    eventTitle: string; version: number; total: number })` → « Devis d'impression
    disponible », `Le devis v{version} de la demande {reference} ({eventTitle}) s'élève à
    {formatFcfa(total)}. Le propriétaire de l'organisation peut l'accepter.`, « Voir le
    devis ».
  - `printRequestMessageMessage(a: { requestId: string; eventId: string; reference: string;
    authorName: string; body: string; toStaff: boolean })` → `Nouveau message — {reference}`,
    `{authorName} : {extrait}` (140 caractères, puis `…`), « Répondre ».
  - `printRequestStatusChangedMessage(a: { requestId: string; eventId: string; reference:
    string; eventTitle: string; status: PrintRequestStatus; toStaff: boolean })` →
    `Demande {reference} : {libellé en minuscules}`, `La demande d'impression {reference}
    ({eventTitle}) est maintenant « {libellé} ».`, « Voir la demande ».
- Produces (`triggers.ts`, ne lèvent jamais, ne font rien si la demande a disparu) :
  - `notifyPrintRequestSubmitted(requestId: string, actorId: string): Promise<void>` —
    `staffMinRole: "STAFF_ADMIN"`, portée `PLATFORM`.
  - `notifyPrintRequestQuoted(requestId: string, actorId: string): Promise<void>` —
    `eventRoles ADMIN`, portée `EVENT`.
  - `notifyPrintRequestMessage(messageId: string, actorId: string): Promise<void>` — message
    `ORGANIZER` → `staffMinRole: "STAFF_SUPPORT"` (`PLATFORM`) ; message `STAFF` →
    `eventRoles ADMIN` (`EVENT`). L'auteur est exclu (`actorId`).
  - `notifyPrintRequestStatusChanged(requestId: string, actorId: string | null, to: {
    organizer: boolean; staff: boolean }): Promise<void>` — statut lu en base ; `organizer` →
    `eventRoles ADMIN` (`EVENT`), `staff` → `staffMinRole: "STAFF_ADMIN"` (`PLATFORM`).

- [ ] **Step 1 : écrire les tests** — messages : titres, corps et `href` exacts des quatre
  fonctions (extrait tronqué à 140 + `…` pour un corps de 200 caractères). Déclencheurs
  (vraie BDD, `enqueueEmail` espionné comme dans `notify.test.ts`) : soumission → une
  notification par `STAFF_ADMIN` et `SUPER_ADMIN`, aucune pour `STAFF_SUPPORT` ; devis → OWNER,
  MANAGER et membre `ADMIN` de l'évènement, pas l'`OPERATOR` ; message organisateur → staff
  `STAFF_SUPPORT`+, l'auteur exclu ; message staff → admins de l'évènement ; statut avec
  `{ organizer: true, staff: false }` → aucun staff ; un email en file par destinataire ;
  demande supprimée → aucune notification, pas d'exception.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): notifications des demandes`.

## Task 5 — Noyau : brouillon, référence, transitions, paiement, OWNER

**Files :**
- Create : `src/lib/print-requests/service.ts`, `src/lib/__tests__/helpers/print-requests.ts`
- Modify : `src/lib/badge-templates/event-template-variables.ts` (exporter `findRow` sous le
  nom `findEffectiveTemplateRow`)
- Test : `src/lib/__tests__/print-requests-service.test.ts`

**Interfaces :**
- Consumes : `nextStatus` (Task 2), `appendThreadEvent`, `PrintRequestError` (Task 3),
  `resolveEventTemplateId`, `loadUserContext`.
- Produces (`service.ts`, **contrat des plans 34 et 35**) :
  - `export { appendThreadEvent } from "./thread"`.
  - `paymentProbe: { isPaymentInProgress(requestId: string): Promise<boolean> }` — objet
    mutable, implémentation par défaut `async () => false` ; **le plan 34 remplace ce corps**
    par `count(Payment where printRequestId and status PENDING) > 0` (le champ
    `Payment.printRequestId` n'existe qu'à partir du plan 34). Les tests la remplacent par
    `vi.spyOn(paymentProbe, "isPaymentInProgress")`.
  - `isPaymentInProgress(requestId: string): Promise<boolean>` — délègue à `paymentProbe`.
  - `assertOwner(userId: string, orgId: string): Promise<void>` — staff → 403
    `STAFF_FORBIDDEN` ; pas de `OrgMembership` `OWNER` sur `orgId` → 403 `OWNER_REQUIRED`.
  - `nextReference(tx: Prisma.TransactionClient, now: Date): Promise<string>` —
    `IMP-{année}-{(nombre de références de l'année) + 1, sur 4 chiffres}`.
  - `createDraft(input: { eventId: string; orgId: string; type: PrintRequestType; userId:
    string; now?: Date }): Promise<PrintRequest>` — réessaie 3 fois sur collision de
    référence (`P2002`).
  - `snapshotEventTemplate(eventId: string, db?: Prisma.TransactionClient): Promise<{
    badgeTemplateId: string; badgeWidthPx: number; badgeHeightPx: number; badgePages: number;
    label: string }>`.
  - `loadRequest(requestId: string, scope?: { eventId: string }): Promise<PrintRequest>` —
    404 `NOT_FOUND` si absente ou d'un autre évènement.
  - `applyTransition(tx: Prisma.TransactionClient, request: Pick<PrintRequest, "id" |
    "status">, action: PrintRequestAction, actor: PrintRequestActor, now?: Date):
    Promise<PrintRequestStatus>` — `nextStatus` nul → 409 `INVALID_TRANSITION` `{ from,
    action }` ; `updateMany({ where: { id, status: from } })` à 0 ligne → 409
    `INVALID_TRANSITION` (statut changé entre-temps) ; pose `submittedAt` (DRAFT → SUBMITTED),
    `quotedAt`, `paidAt`, `completedAt`, `cancelledAt` ; quitter `ACCEPTED` vers `SUBMITTED`
    ou `CANCELLED` remet `acceptedVersion`, `acceptedTotal`, `acceptedAt`, `acceptedById` à
    `null`. N'écrit **pas** le fil (l'appelant le fait, il connaît les détails).
  - `applyEdit(tx: Prisma.TransactionClient, request: Pick<PrintRequest, "id" | "status">,
    side: "ORGANIZER" | "STAFF", userId: string): Promise<{ from: PrintRequestStatus; to:
    PrintRequestStatus }>` — action `ORGANIZER_EDIT` ou `STAFF_EDIT` ; refus : statut
    `ACCEPTED` → 409 `QUOTE_ACCEPTED`, autre statut sans transition → 409 `REQUEST_LOCKED` ;
    départ `QUOTED` → entrée `QUOTE_REVISION` (auteur et côté de l'éditeur).
  - `recomputeTotal(tx: Prisma.TransactionClient, requestId: string): Promise<number>` —
    somme des `lineTotal` des lignes sans `removedAt`, écrite dans `total`.
  - `requestBadgeCount(tx: Prisma.TransactionClient, request: Pick<PrintRequest, "id" |
    "type" | "estimatedQuantity">): Promise<number>` — `ADVANCE` : nombre d'items ;
    `ONSITE` : `estimatedQuantity ?? 0`.
  - `markPaid(tx: Prisma.TransactionClient, requestId: string, opts: { paymentId?: string;
    manual?: { userId: string; reason: string } }): Promise<boolean>` — demande non
    `ACCEPTED` → `false`, rien n'est écrit (le plan 34 traite le paiement tardif) ; sinon
    `applyTransition(MARK_PAID, manual ? "STAFF" : "SYSTEM")` (pose `PAID` et `paidAt`),
    `paidPaymentId = paymentId ?? null`, entrée `PAYMENT_RECEIVED`
    `{ amount: acceptedTotal, paymentId?, reason? }` (texte « Paiement reçu : … » suffixé
    « (hors ligne : {reason}) » en manuel ; auteur `manual.userId`, côté `STAFF` ; sinon
    système), `true`. Ni journal ni notification : l'appelant les fait après la
    transaction. Appelants : `markPaidManually` (Task 9) et la branche `PRINT_REQUEST` de
    `confirmPayment` (plan 34) ; le plan 35 ajoute, à ces deux endroits, la dépense du crédit
    d'impression.
- Produces (fixture de test) : `seedPrintFixture(): Promise<{ owner, manager, eventAdmin,
  operator, staffAdmin, staffSupport, staffObserver, org, event, template, categories: [c1,
  c2], approved: Registration[] /* 3, dont 2 en c1 */, pending: Registration, badgeProduct
  /* BADGE, basePrice 1500 */, lanyard /* ACCESSORY, basePrice 500 */ }>` — template
  320 × 460 px, 2 pages, posé sur l'évènement ; produits publiés (champs du plan 32).
  `makeRequest(fx, over?: Partial<Prisma.PrintRequestUncheckedCreateInput>)` crée une demande
  directement en base.

- [ ] **Step 1 : écrire les tests**

```ts
const NOV_2026 = new Date("2026-11-01T10:00:00Z");
it("createDraft numérote IMP-2026-0001 puis IMP-2026-0002, et IMP-2027-0001 l'année suivante", async () => {});
it("createDraft : DRAFT, createdById, total 0, quoteVersion 0", async () => {});
it("assertOwner : OWNER passe ; MANAGER -> OWNER_REQUIRED ; STAFF_ADMIN -> STAFF_FORBIDDEN", async () => {});
it("snapshotEventTemplate copie 320 x 460 px, 2 pages et le libellé", async () => {});
it("applyTransition SUBMITTED + SEND_QUOTE (STAFF) -> QUOTED et quotedAt posé", async () => {});
it("applyTransition non permise -> 409 INVALID_TRANSITION { from: 'PAID', action: 'CANCEL' }", async () => {});
it("applyTransition sur un statut périmé (ligne passée CANCELLED entre-temps) -> INVALID_TRANSITION", async () => {});
it("applyTransition ACCEPTED + REOPEN efface acceptedVersion/Total/At/ById", async () => {});
it("applyEdit depuis QUOTED -> SUBMITTED + entrée QUOTE_REVISION ; depuis ACCEPTED -> QUOTE_ACCEPTED ; depuis PAID -> REQUEST_LOCKED", async () => {});
it("recomputeTotal : 4500 + 1500 + une ligne retirée de 999 -> 6000", async () => {});
it("markPaid sur ACCEPTED (acceptedTotal 6000) -> true, PAID, paidAt, entrée « Paiement reçu : 6 000 FCFA »", async () => {});
it("markPaid avec paymentId -> paidPaymentId posé ; en manuel -> paidPaymentId null", async () => {});
it("markPaid manuel : entrée suffixée « (hors ligne : virement du 30/10) », auteur staff, côté STAFF", async () => {});
it("markPaid sur QUOTED -> false, demande inchangée, aucune entrée", async () => {});
it("isPaymentInProgress vaut false par défaut et suit paymentProbe", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter `service.ts`, la fixture, l'export `findEffectiveTemplateRow`.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): noyau des demandes d'impression`.

## Task 6 — Contenu : informations de remise et badges

**Files :**
- Create : `src/lib/print-requests/inputs.ts`, `src/lib/print-requests/content.ts`
- Test : `src/lib/__tests__/print-requests-content.test.ts`

**Interfaces :**
- Consumes : `applyEdit`, `recomputeTotal`, `requestBadgeCount`, `loadRequest` (Task 5),
  `appendThreadEvent` (Task 3), `RESERVING_STATUSES` (Task 2), `orderRegistrations`
  (`src/lib/print-sheets/generations.ts`, plan 31).
- Produces (`inputs.ts`) :
  - `onsiteSlotSchema = z.object({ date: /^\d{4}-\d{2}-\d{2}$/, from: /^\d{2}:\d{2}$/, to:
    /^\d{2}:\d{2}$/ })` avec `from < to`.
  - `detailsPatchSchema` (tous facultatifs) : `delivery` enum, `deliveryAddress` ≤ 500,
    `deliveryContactName` ≤ 120, `deliveryContactPhone` ≤ 40, `wantedBy` date ISO ou `null`,
    `estimatedQuantity` entier 1–100 000, `onsiteSchedule` 1–30 créneaux, `onsiteLocation`
    ≤ 500, `onsiteContactName` ≤ 120, `onsiteContactPhone` ≤ 40, `notes` ≤ 2000 ou `null`.
  - `badgeSelectionSchema` : `{ mode: "ALL_AVAILABLE" } | { mode: "CATEGORIES"; categoryIds:
    string[] (1+) } | { mode: "IDS"; registrationIds: string[] (1+) }` →
    `type BadgeSelection`.
- Produces (`content.ts`) :
  - `lockEventRow(tx: Prisma.TransactionClient, eventId: string): Promise<void>` —
    `SELECT id FROM Event WHERE id = ? FOR UPDATE`.
  - `reservedRegistrations(tx: Prisma.TransactionClient, eventId: string, excludeRequestId:
    string): Promise<Map<string, string>>` — inscription → référence, demandes de statut
    `RESERVING_STATUSES`.
  - `type CandidateRow = { id: string; firstName: string; lastName: string; categoryId:
    string; categoryName: string; categoryNumber: number; printed: boolean; reservedBy:
    string | null; selected: boolean }` ;
    `listCandidates(eventId: string, requestId: string): Promise<CandidateRow[]>` —
    inscriptions `APPROVED`, ordre `orderRegistrations`.
  - `followBadgeCount(tx: Prisma.TransactionClient, requestId: string, previous: number,
    next: number): Promise<{ lagging: string[] }>` — lignes `PRODUCT` actives, non
    `quantityOverridden`, dont `quantity === previous` → `quantity = next`, `lineTotal =
    next × unitPrice` (prix unitaire **figé**, copie de la spec 32) ; lignes
    `quantityOverridden` dont la quantité diffère de `next` → libellé dans `lagging` ;
    `recomputeTotal`.
  - `setBadges(input: { requestId: string; eventId: string; userId: string; selection:
    BadgeSelection }): Promise<{ count: number; revised: boolean }>` — `ONSITE` → 400
    `TYPE_MISMATCH` ; résolution : `ALL_AVAILABLE` = `APPROVED`, non imprimées, non
    réservées ailleurs ; `CATEGORIES` = idem restreint aux catégories ; `IDS` = inscriptions
    `APPROVED` de l'évènement (sinon 400 `INVALID_SELECTION { registrationIds }`) non
    réservées ailleurs (sinon 409 `REGISTRATIONS_TAKEN { registrationIds }`), imprimées
    permises ; vide → 400 `EMPTY_SELECTION`. Transaction : `lockEventRow` (hors `DRAFT`),
    `applyEdit(ORGANIZER)`, remplacement des items, positions `orderRegistrations`,
    `followBadgeCount` ; hors `DRAFT`, entrée `BADGES_CHANGED { added, removed, count,
    lagging }` (auteur, côté `ORGANIZER`). `revised` = départ `QUOTED`.
  - `updateDetails(input: { requestId: string; eventId: string; userId: string; patch:
    z.infer<typeof detailsPatchSchema> }): Promise<{ request: PrintRequest; revised: boolean
    }>` — champs `delivery*`/`wantedBy` sur `ONSITE`, ou `estimatedQuantity`/`onsite*` sur
    `ADVANCE` → 400 `TYPE_MISMATCH` ; `applyEdit(ORGANIZER)` ; changement de
    `estimatedQuantity` → `followBadgeCount` ; hors `DRAFT`, entrée `REQUEST_UPDATED {
    fields }` avec les libellés « mode de remise », « adresse de livraison », « contact »,
    « téléphone du contact », « date souhaitée », « quantité estimée », « horaires sur
    place », « lieu », « remarque ».

- [ ] **Step 1 : écrire les tests** (fixture Task 5)
  - `listCandidates` : 3 lignes (l'inscription `PENDING` absente), `reservedBy` =
    référence d'une autre demande `SUBMITTED`, `null` si l'autre demande est `DRAFT`,
    `CANCELLED` ou `REJECTED`.
  - `setBadges ALL_AVAILABLE` : exclut l'imprimée et la réservée ; positions 0..n−1 dans
    l'ordre catégorie, nom, prénom.
  - `CATEGORIES [c1]` → 2 items ; `IDS` avec l'inscription `PENDING` → `INVALID_SELECTION` ;
    `IDS` avec une réservée → 409 `REGISTRATIONS_TAKEN` et son id ; sélection vide →
    `EMPTY_SELECTION` ; demande `ONSITE` → `TYPE_MISMATCH`.
  - Suivi des quantités : lignes BADGE (3 × 1500) et cordon (3 × 500), passage à 2 badges →
    2 × 1500 et 2 × 500, total 4000 ; une ligne `quantityOverridden` à 10 reste à 10 et son
    libellé est dans `lagging` ; un cordon fixé à 5 par l'organisateur reste à 5.
  - Demande `QUOTED` : `setBadges` → `SUBMITTED`, `revised: true`, entrées `BADGES_CHANGED`
    puis `QUOTE_REVISION` ; demande `DRAFT` → aucune entrée.
  - `updateDetails` : `{ delivery: "DELIVERY", deliveryAddress: "Rue 12, Cotonou" }` sur
    `SUBMITTED` → entrée « Informations modifiées : mode de remise, adresse de livraison » ;
    `{ estimatedQuantity: 200 }` sur `ADVANCE` → `TYPE_MISMATCH` ; sur `ONSITE` de 150 à 200 →
    lignes suivies ; créneau `from: "18:00", to: "09:00"` → `VALIDATION` (zod).
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): badges et informations d'une demande`.

## Task 7 — Contenu : produits de l'organisateur

**Files :**
- Modify : `src/lib/print-requests/content.ts`, `src/lib/print-requests/inputs.ts`
- Test : `src/lib/__tests__/print-requests-products.test.ts`

**Interfaces :**
- Consumes (plan 32, `src/lib/print-catalog/pricing.ts`, qui réexporte `pricing-core.ts`) :
  `type OptionChoice` (`{ optionId; valueIds?; text?; fileKey?; split? }`), `type
  ProductForPricing` (porte `id`, `kind`, `name`, `minQuantity`, `published`, `archived`),
  `type ChoiceSnapshot`, `type ChoiceErrorCode`,
  `loadProductForPricing(productId): Promise<ProductForPricing | null>` (**`null` seulement
  pour un identifiant inconnu** : un produit archivé ou brouillon est renvoyé avec ses
  drapeaux, options et valeurs archivées comprises), `unitPriceFor(product, quantity,
  choices): number`, `validateChoices(product, choices, quantity): { ok: true } | { ok:
  false; code: ChoiceErrorCode; optionId?: string }` (**ne lève pas**),
  `snapshotChoices(product, choices, quantity): ChoiceSnapshot[]`. Une valeur d'option `FILE`
  est une clé de stockage dans `OptionChoice.fileKey` (`validateChoices` exige déjà le
  préfixe `print-requests/`). Tout écart constaté dans le code : adapter les appels de ce
  Task, pas le plan 32.
- Produces :
  - `optionChoiceSchema` (zod, forme exacte d'`OptionChoice` du plan 32) : `{ optionId:
    string; valueIds?: string[]; text?: string; fileKey?: string; split?: { valueId: string;
    quantity: int }[] }`.
  - `organizerProductsSchema` : `z.array(z.object({ productId: z.string(), quantity:
    z.number().int().min(1).max(1_000_000).nullable(), choices: z.array(optionChoiceSchema)
    }))` (0–30 éléments).
  - `type OrganizerProductInput = { productId: string; quantity: number | null; choices:
    OptionChoice[] }`
  - `setOrganizerProducts(input: { requestId: string; eventId: string; userId: string;
    products: OrganizerProductInput[] }): Promise<{ lines: PrintQuoteLine[]; total: number;
    revised: boolean }>` — règles :
    - nombre de badges nul → 409 `BADGE_COUNT_REQUIRED` (l'assistant choisit les badges
      avant les produits) ;
    - `loadProductForPricing` → `null` → 400 `PRODUCT_UNAVAILABLE { productId }` ; deux
      produits `BADGE` → 400 `BADGE_PRODUCT_REQUIRED` ;
    - quantité : `BADGE` = nombre de badges (la valeur saisie est ignorée) ; `ACCESSORY` =
      saisie ou, à défaut, nombre de badges ;
    - `validateChoices(product, choices, quantity)` renvoie `{ ok: false, code }` →
      traduction : `PRODUCT_UNAVAILABLE` (archivé ou brouillon) → 400 `PRODUCT_UNAVAILABLE {
      productId }` ; `QUANTITY_BELOW_MINIMUM` → 400 `BELOW_MIN_QUANTITY { productId,
      minQuantity }` ; tout autre code → 400 `INVALID_CHOICES { productId, code, optionId }` ;
      en plus, clé `FILE` hors `print-requests/{eventId}/` → `INVALID_CHOICES` ;
    - ligne : `kind PRODUCT`, `label = name`, `optionsSnapshot = snapshotChoices(product,
      choices, quantity)`, `choices`, `unitPrice = unitPriceFor(product, quantity, choices)`,
      `lineTotal`, `addedBy ORGANIZER`, positions
      `BADGE` 0 puis accessoires dans l'ordre reçu ;
    - comparaison avec les lignes `ORGANIZER` actives, par `productId` : absente → ajout ;
      disparue → retrait (`DRAFT` : suppression ; sinon `removedAt`) ; quantité ou `choices`
      différents → modification, refusée (409 `LINE_LOCKED_BY_STAFF { productId }`) si la
      ligne est `priceOverridden` ou `quantityOverridden` ; identique → inchangée ;
    - hors `DRAFT` : `applyEdit(ORGANIZER)` et une entrée `LINES_CHANGED` (côté
      `ORGANIZER`) listant les changements ; `recomputeTotal`.

- [ ] **Step 1 : écrire les tests** — 3 badges : `[badge, cordon]` → lignes 3 × 1500 =
  4500 et 3 × 500 = 1500, total 6000 ; quantité 99 saisie pour le `BADGE` ignorée (3) ;
  cordon à 5 → 2500 ; deux `BADGE` → `BADGE_PRODUCT_REQUIRED` ; produit archivé →
  `PRODUCT_UNAVAILABLE` ; choix invalide → `INVALID_CHOICES` ; clé de fichier d'un autre
  évènement → `INVALID_CHOICES` ; `minQuantity` 10 avec 3 badges → `BELOW_MIN_QUANTITY` ;
  aucun badge → `BADGE_COUNT_REQUIRED` ; `DRAFT` : retirer le cordon supprime la ligne, sans
  entrée ; `SUBMITTED` : retirer le cordon pose `removedAt`, entrée « Ligne retirée : Cordon »
  ; ligne retouchée par le staff puis quantité changée par l'organisateur →
  `LINE_LOCKED_BY_STAFF`, mais son retrait passe ; `QUOTED` → `SUBMITTED`, `revised: true`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): produits choisis par l'organisateur`.

## Task 8 — Envoi, annulation, acceptation

**Files :**
- Create : `src/lib/print-requests/lifecycle.ts`
- Test : `src/lib/__tests__/print-requests-lifecycle.test.ts`

**Interfaces :**
- Consumes : Tasks 3, 5, 6.
- Produces :
  - `submitRequest(input: { requestId: string; eventId: string; userId: string; now?: Date
    }): Promise<PrintRequest>` — `DRAFT` requis (sinon `INVALID_TRANSITION`) ; contrôles :
    exactement une ligne `PRODUCT` active d'un produit `BADGE` (sinon 400
    `BADGE_PRODUCT_REQUIRED`) ; `ADVANCE` : au moins un item (`EMPTY_SELECTION`), `delivery`
    renseigné et, si `DELIVERY`, adresse, contact et téléphone (sinon 400
    `DELIVERY_INCOMPLETE { fields }`) ; `ONSITE` : `estimatedQuantity`, `onsiteSchedule` non
    vide, lieu, contact, téléphone (sinon 400 `ONSITE_INCOMPLETE { fields }`). Transaction :
    `lockEventRow`, intersection des items avec `reservedRegistrations` non vide → 409
    `REGISTRATIONS_TAKEN { registrationIds }`, positions recalculées, copie
    `snapshotEventTemplate`, `applyTransition(SUBMIT)`, entrée `SUBMITTED { badgeCount, total
    }` (auteur, côté `ORGANIZER`).
  - `cancelRequest(input: { requestId: string; eventId: string; userId: string }): Promise<{
    request: PrintRequest; from: PrintRequestStatus }>` — `ACCEPTED` avec paiement en cours →
    409 `PAYMENT_IN_PROGRESS` ; `applyTransition(CANCEL)` ; entrée `CANCELLED` ; les items
    restent en base (la réservation tombe avec le statut).
  - `acceptQuote(input: { requestId: string; eventId: string; userId: string; version:
    number; now?: Date }): Promise<PrintRequest>` — `assertOwner` d'abord ; `version !==
    quoteVersion` → 409 `QUOTE_VERSION_MISMATCH { current }` ; `applyTransition(ACCEPT)` ;
    `acceptedVersion`, `acceptedTotal = total`, `acceptedAt`, `acceptedById` ; entrée
    `QUOTE_ACCEPTED { version, total }`.

- [ ] **Step 1 : écrire les tests**

```ts
it("envoi complet : SUBMITTED, submittedAt, copie du template (320 x 460, 2 pages), entrée « Demande envoyée : 3 badges… »", async () => {});
it("envoi sans produit BADGE -> BADGE_PRODUCT_REQUIRED", async () => {});
it("livraison sans adresse -> DELIVERY_INCOMPLETE { fields: ['deliveryAddress'] }", async () => {});
it("ONSITE sans horaires -> ONSITE_INCOMPLETE { fields: ['onsiteSchedule'] }", async () => {});
it("deux brouillons avec la même inscription : le premier envoi passe, le second -> REGISTRATIONS_TAKEN", async () => {});
it("deux envois concurrents (Promise.allSettled) partageant une inscription : exactement un fulfilled", async () => {});
it("annuler un ACCEPTED avec paiement en cours -> PAYMENT_IN_PROGRESS ; sans -> CANCELLED, acceptation effacée", async () => {});
it("annuler libère les inscriptions : un nouveau brouillon peut les envoyer", async () => {});
it("annuler un PAID -> INVALID_TRANSITION", async () => {});
it("accepter la version 2 sur un devis v2 : ACCEPTED, acceptedTotal = total, entrée « Devis v2 accepté »", async () => {});
it("accepter la version 1 sur un devis v2 -> QUOTE_VERSION_MISMATCH { current: 2 }", async () => {});
it("accepter en MANAGER -> OWNER_REQUIRED ; en staff -> STAFF_FORBIDDEN ; sur SUBMITTED -> INVALID_TRANSITION", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): envoi, annulation et acceptation`.

## Task 9 — Opérations du staff

**Files :**
- Create : `src/lib/print-requests/quote.ts`
- Modify : `src/lib/print-requests/inputs.ts`
- Test : `src/lib/__tests__/print-requests-quote.test.ts`

**Interfaces :**
- Consumes : Tasks 3, 5 ; `loadProductForPricing`, `snapshotChoices` (plan 32).
- Produces :
  - `staffLineSchema` : `{ kind: PrintQuoteLineKind; productId?: string | null; label:
    string (1–200); quantity: int 1–1 000 000; unitPrice: int −10 000 000–10 000 000;
    choices?: unknown[] }` ; raffinement : `DISCOUNT` ⇒ `unitPrice <= 0`, sinon `>= 0` ;
    `PRODUCT` ⇒ `productId` requis. `staffLinePatchSchema` : `label`, `quantity`, `unitPrice`
    facultatifs, au moins un.
  - `addStaffLine(input: { requestId: string; userId: string; line: z.infer<typeof
    staffLineSchema> }): Promise<{ line: PrintQuoteLine; revised: boolean }>` —
    `applyEdit(STAFF)` ; `addedBy STAFF`, position = max + 1 ; `PRODUCT` : produit chargé
    par `loadProductForPricing` (`null` → `PRODUCT_UNAVAILABLE`) ; si `choices` (validés par
    `optionChoiceSchema`) : `validateChoices(product, choices, quantity)` en échec → même
    traduction qu'en Task 7, puis `optionsSnapshot = snapshotChoices(product, choices,
    quantity)` et `choices` stockés ; le `unitPrice` saisi par le staff fait foi ; entrée
    `LINES_CHANGED` `ADDED` (côté `STAFF`, regroupée) ; `recomputeTotal`.
  - `updateStaffLine(input: { requestId: string; lineId: string; userId: string; patch:
    z.infer<typeof staffLinePatchSchema> }): Promise<{ line: PrintQuoteLine; revised: boolean
    }>` — ligne active de la demande (sinon 404) ; `unitPrice` changé ⇒ `priceOverridden`,
    `quantity` changée ⇒ `quantityOverridden` ; même règle de signe ; entrée `UPDATED` avec
    `from`/`to`.
  - `removeStaffLine(input: { requestId: string; lineId: string; userId: string }):
    Promise<{ revised: boolean }>` — toute ligne active, `removedAt` ; entrée `REMOVED`.
  - `sendQuote(input: { requestId: string; userId: string; now?: Date }):
    Promise<PrintRequest>` — aucune ligne active → 400 `EMPTY_QUOTE` ; total négatif → 400
    `NEGATIVE_TOTAL` ; `applyTransition(SEND_QUOTE)`, `quoteVersion + 1` ; entrée
    `QUOTE_SENT { version, total }`.
  - `reopenQuote(input: { requestId: string; userId: string }): Promise<PrintRequest>` —
    paiement en cours → 409 `PAYMENT_IN_PROGRESS` ; `applyTransition(REOPEN)` ; entrée
    `QUOTE_REOPENED { version: acceptedVersion }`.
  - `rejectRequest(input: { requestId: string; userId: string; reason: string }):
    Promise<PrintRequest>` — motif nettoyé 3–1000 caractères (sinon `VALIDATION`) ; entrée
    `REJECTED { reason }`.
  - `advanceStatus(input: { requestId: string; userId: string; to: "IN_PRODUCTION" | "READY"
    | "COMPLETED" }): Promise<PrintRequest>` — action `START_PRODUCTION` / `MARK_READY` /
    `COMPLETE` ; entrée `STATUS_CHANGED { from, to }`.
  - `markPaidManually(input: { requestId: string; userId: string; reason: string }):
    Promise<PrintRequest>` — **seul passage manuel en `PAID` du chantier** (le plan 34 n'en
    crée pas d'autre) ; motif nettoyé 3–500 caractères (sinon `VALIDATION`) ; transaction avec
    `SELECT … FOR UPDATE` sur la demande ; `isPaymentInProgress` → 409 `PAYMENT_IN_PROGRESS` ;
    `markPaid(tx, requestId, { manual: { userId, reason } })` à `false` → 409
    `INVALID_TRANSITION`.

- [ ] **Step 1 : écrire les tests** — critère d'acceptation 2 : sur `SUBMITTED` (total
  6000), prix du support passé de 1500 à 1200 puis ligne `SERVICE` « Frais de livraison »
  1 × 5000 → une seule entrée « 2 lignes modifiées » avec les deux changements, total 8600,
  `priceOverridden` vrai, statut toujours `SUBMITTED` (`acceptQuote` → `INVALID_TRANSITION`) ;
  `sendQuote` → `QUOTED`, `quoteVersion` 1, entrée « Devis v1 envoyé : 8 600 FCFA ».
  Critère 3 : devis v2 accepté, `updateStaffLine` → `QUOTE_ACCEPTED` ; `reopenQuote` →
  `SUBMITTED`, acceptation effacée, entrée « Devis v2 rouvert… » ; nouvelle modification puis
  `sendQuote` → v3. Autres : `DISCOUNT` à +100 → `VALIDATION` ; `SERVICE` à −100 →
  `VALIDATION` ; total négatif → `NEGATIVE_TOTAL` ; `sendQuote` sans ligne → `EMPTY_QUOTE` ;
  réouverture avec paiement en cours → `PAYMENT_IN_PROGRESS` ; refus avec motif « ok » →
  `VALIDATION`, avec « Format non pris en charge » → `REJECTED` ; `advanceStatus` PAID →
  IN_PRODUCTION → READY → COMPLETED avec trois entrées `STATUS_CHANGED`, saut PAID →
  COMPLETED → `INVALID_TRANSITION` ; `markPaidManually` sur `ACCEPTED` → `PAID`, sur `QUOTED`
  → `INVALID_TRANSITION`, avec paiement en cours (sonde) → `PAYMENT_IN_PROGRESS` ; `PRODUCT`
  ajouté par le staff avec un choix invalide → `INVALID_CHOICES`.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): devis et statuts cote staff`.

## Task 10 — API organisateur

**Files :**
- Create, sous `src/app/api/org/[orgId]/events/[eventId]/print-requests/` : `route.ts`,
  `[requestId]/route.ts`, `[requestId]/registrations/route.ts`,
  `[requestId]/badges/route.ts`, `[requestId]/products/route.ts`,
  `[requestId]/submit/route.ts`, `[requestId]/cancel/route.ts`,
  `[requestId]/accept/route.ts`, `[requestId]/messages/route.ts`
- Test : `src/lib/__tests__/api-event-print-requests.test.ts` (modèle :
  `api-event-settings.test.ts` — `getServerSession` et `loadOrgAccess` mockés)

**Interfaces :**
- Consumes : Tasks 3 à 8, déclencheurs (Task 4), `withEventAuth`, `logActivity`.
- Produces — toutes en `withEventAuth({ permission: "print.request", … })`, erreurs via
  `printRequestErrorResponse`, corps invalide → 400 `VALIDATION` :

| Route | Méthode | `allowArchived` | Corps → réponse | Journal / notification |
|---|---|---|---|---|
| `print-requests` | GET | oui | → `{ requests: { id, reference, type, status, badgeCount, total, submittedAt, wantedBy }[] }` (brouillons compris, récentes d'abord) | — |
| `print-requests` | POST | non | `{ type }` → 201 `{ request }` | — |
| `[requestId]` | GET | oui | → `{ request, lines (actives, triées), badgeCount, canAccept }` (`canAccept` = OWNER non staff et `QUOTED`) | — |
| `[requestId]` | PATCH | non | `detailsPatchSchema` → `{ request }` | `PRINT_REQUEST_UPDATED` hors brouillon ; `revised` → statut au staff |
| `[requestId]/registrations` | GET | oui | → `{ candidates }` | — |
| `[requestId]/badges` | PUT | non | `{ selection }` → `{ count }` | idem PATCH |
| `[requestId]/products` | PUT | non | `{ products }` → `{ lines, total }` | idem PATCH |
| `[requestId]/submit` | POST | non | → `{ request }` | `PRINT_REQUEST_SUBMITTED` ; `notifyPrintRequestSubmitted` |
| `[requestId]/cancel` | POST | oui | → `{ request }` | `PRINT_REQUEST_CANCELLED` ; statut au staff si `from !== "DRAFT"` |
| `[requestId]/accept` | POST | oui | `{ version }` → `{ request }` ; **session staff → 403 `STAFF_FORBIDDEN` avant tout** | `PRINT_REQUEST_ACCEPTED` ; statut organisateur + staff |
| `[requestId]/messages` | GET | oui | → `{ entries: ThreadEntryDTO[] }` | — |
| `[requestId]/messages` | POST | oui | `{ body, attachmentKey? }` → 201 `{ entry }` ; **session staff → 403 `STAFF_FORBIDDEN`** | `notifyPrintRequestMessage` |

Les identifiants `requestId` d'un autre évènement → 404 (`loadRequest(..., { eventId })`).

- [ ] **Step 1 : écrire les tests** — par route : 401 sans session, 403 pour un `OPERATOR`,
  succès pour un membre `ADMIN` ; plus : POST sur évènement archivé → 410 ; GET liste sur
  évènement archivé → 200 ; demande d'un autre évènement → 404 ; `accept` par un MANAGER →
  403 `OWNER_REQUIRED`, par un staff `SUPER_ADMIN` → 403 `STAFF_FORBIDDEN`, par l'OWNER → 200 et
  journal `PRINT_REQUEST_ACCEPTED` ; `messages` POST par un staff → 403 ; parcours du critère 1
  : brouillon, 150 inscriptions approuvées (créées par `createMany`), badges `ALL_AVAILABLE`,
  produits PVC + cordon, remise retrait, envoi → 200, journal, une notification par
  `STAFF_ADMIN` ; `canAccept` vrai pour l'OWNER sur `QUOTED`, faux pour un MANAGER.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter les routes.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): API des demandes cote organisateur`.

## Task 11 — API staff

**Files :**
- Create, sous `src/app/api/platform/print/requests/` : `route.ts`, `[requestId]/route.ts`,
  `[requestId]/lines/route.ts`, `[requestId]/lines/[lineId]/route.ts`,
  `[requestId]/send-quote/route.ts`, `[requestId]/reopen/route.ts`,
  `[requestId]/reject/route.ts`, `[requestId]/status/route.ts`,
  `[requestId]/mark-paid/route.ts`, `[requestId]/messages/route.ts`
- Test : `src/lib/__tests__/api-platform-print-requests.test.ts`

**Interfaces :**
- Consumes : Tasks 3, 4, 5, 9 ; `withStaffAuth(handler, { minRole })`.
- Produces — un brouillon est invisible du staff (404) ; journal avec `orgId` et `eventId`
  de la demande, `targetId = requestId` :

| Route | Méthode | Rôle min. | Corps → réponse | Journal / notification |
|---|---|---|---|---|
| `requests` | GET | OBSERVER | `?status&orgId&type&wantedFrom&wantedTo&page` → `{ requests, total, page }` (50 par page, `submittedAt` desc, avec organisation, évènement, nombre de badges, total) | — |
| `[requestId]` | GET | OBSERVER | → `{ request, event: { id, title, date, endDate, location, org: { id, name, contactEmail, contactPhone } }, template: { id, label, widthPx, heightPx, pages, proofPath } \| null, items: { registrationId, position, firstName, lastName, categoryName, status, badgePrinted }[], lines, generations: { id, status, badgeCount, sheetCount, fileKey, createdAt }[] }` | — |
| `[requestId]/lines` | POST | ADMIN | `staffLineSchema` → 201 `{ line }` | `PRINT_REQUEST_UPDATED` ; `revised` → statut organisateur |
| `[requestId]/lines/[lineId]` | PATCH / DELETE | ADMIN | patch → `{ line }` / → `{ ok: true }` | idem |
| `[requestId]/send-quote` | POST | ADMIN | → `{ request }` | `PRINT_REQUEST_QUOTED` ; `notifyPrintRequestQuoted` |
| `[requestId]/reopen` | POST | ADMIN | → `{ request }` | `PRINT_REQUEST_REOPENED` ; statut organisateur |
| `[requestId]/reject` | POST | SUPPORT | `{ reason }` → `{ request }` | `PRINT_REQUEST_REJECTED` ; statut organisateur |
| `[requestId]/status` | POST | SUPPORT | `{ to: "IN_PRODUCTION" \| "READY" \| "COMPLETED" }` → `{ request }` | `PRINT_REQUEST_STATUS_CHANGED` ; statut organisateur |
| `[requestId]/mark-paid` | POST | ADMIN | `{ reason }` (3–500) → `{ request }` ; 409 `PAYMENT_IN_PROGRESS` / `INVALID_TRANSITION` | `PRINT_REQUEST_MARKED_PAID { reason }` ; statut organisateur + staff (`notifyPrintRequestStatusChanged`, que le plan 34 remplace par `notifyPrintRequestPaid(…, { manual: true })`) |
| `[requestId]/messages` | GET / POST | OBSERVER / SUPPORT | → `{ entries }` / `{ body, attachmentKey? }` → 201 `{ entry }` | `notifyPrintRequestMessage` |

- [ ] **Step 1 : écrire les tests** — 401 ; 403 non-staff ; 403 `STAFF_OBSERVER` en
  écriture ; 403 `STAFF_SUPPORT` sur lignes, envoi, réouverture, paiement manuel ; 200
  `STAFF_SUPPORT` sur refus, statut, message ; brouillon → 404 ; filtres de liste
  (`status=SUBMITTED` ne renvoie que celles-ci ; `orgId` ; `wantedFrom=2026-12-01` exclut
  une demande souhaitée le 2026-11-20) ; détail : 3 items triés, template 320 × 460 ;
  `send-quote` → notification à l'OWNER ; message staff → notification aux admins de
  l'évènement, pas au staff ; `mark-paid` sans motif → 400.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): API des demandes cote staff`.

## Task 12 — Téléversement organisateur et fichiers sensibles

**Files :**
- Create : `src/app/api/org/[orgId]/events/[eventId]/print-requests/upload/route.ts`
- Modify : `src/lib/storage.ts`, `src/app/api/files/[...path]/route.ts`
- Test : `src/lib/__tests__/api-event-print-requests-upload.test.ts`, test existant de
  `/api/files` (compléter)

**Interfaces :**
- Consumes : `isAllowedMime(mime, "document")`, `MAX_UPLOAD_BYTES`, `uploadFile` ; modèle
  d'écriture : `src/app/api/account/upload/route.ts`.
- Produces :
  - `printRequestFileKey(eventId: string, filename: string): string` →
    `print-requests/{eventId}/{filename}`.
  - `POST …/print-requests/upload` (`withEventAuth({ permission: "print.request" })`,
    multipart `file`) → `{ storageKey, originalName, size }` ; sans fichier 400 `NO_FILE`,
    type hors JPEG/PNG/WebP/PDF 415 `BAD_TYPE`, plus de 5 Mo 413 `TOO_LARGE`.
  - `/api/files` : **étend** le classement posé par le plan 32 (Task 5 : `^print-requests/`
    sensible, staff seulement) — sans le dupliquer ni toucher aux familles du plan 31
    (`print-sheets/`, `badge-exports/`) ni à `platform/print-products/` (public).
    `print-requests/staff/…` et `print-requests/{eventId}/…` sensibles,
    `private, no-store` ; staff : lecture ; non-staff : clé d'évènement →
    `hasEventPermission(ctx, eventId, orgId, "print.request")` ; clé staff → évènement
    retrouvé par `PrintRequestMessage.attachmentKey`, puis même permission ; aucune ligne →
    403.

- [ ] **Step 1 : écrire les tests** — upload : 401, 403 `OPERATOR`, 413, 415, 200 avec clé
  préfixée ; `/api/files` : membre `ADMIN` de l'évènement lit `print-requests/{eventId}/x.pdf`
  (200, `no-store`), `ADMIN` d'un autre évènement → 403, `PRINTER` → 403 ; pièce jointe staff
  d'un message lisible par l'`ADMIN` de l'évènement, clé staff orpheline → 403 non-staff, 200
  staff.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): fichiers des demandes d'impression`.

## Task 13 — Verrou du template de l'évènement

**Files :**
- Create : `src/lib/print-requests/template-lock.ts`
- Modify : `src/lib/print-requests/service.ts` (`applyTransition`), les trois routes
  `…/settings/badge/route.ts` (évènement, org, plateforme),
  `src/app/event/[eventId]/settings/badge/page.tsx`,
  `src/components/admin/BadgeTemplatePicker.tsx`
- Test : `src/lib/__tests__/print-requests-template-lock.test.ts`, tests existants des trois
  routes (`__tests__/route.test.ts`, compléter)

**Interfaces :**
- Consumes : `snapshotEventTemplate`, `applyTransition`, `isPaymentInProgress` (Task 5),
  `appendThreadEvent` (Task 3), `notifyPrintRequestStatusChanged` (Task 4).
- Produces :
  - `TEMPLATE_LOCK_STATUSES = ["PAID", "IN_PRODUCTION", "READY"] as const`.
  - `findTemplateLock(eventId: string, db?: Prisma.TransactionClient): Promise<{ requestId:
    string; reference: string } | null>`.
  - `assertTemplateChangeAllowed(eventId: string): Promise<void>` — verrou → 409
    `TEMPLATE_LOCKED_BY_PRINT_REQUEST { reference }` ; demande `ACCEPTED` avec paiement en
    cours → 409 `PAYMENT_IN_PROGRESS`.
  - `pinLockedEventTemplates(scope: { orgId: string } | { platform: true }): Promise<number>`
    — évènements du périmètre **sans** `badgeTemplateId` propre et verrouillés (ou `ACCEPTED`
    avec paiement en cours) : `event.badgeTemplateId = request.badgeTemplateId`,
    `request.templatePinned = true` ; renvoie le nombre d'évènements épinglés.
  - `releaseTemplatePin(tx: Prisma.TransactionClient, requestId: string): Promise<void>` —
    si `templatePinned` : remet `event.badgeTemplateId` à `null` **s'il vaut encore**
    `request.badgeTemplateId` et qu'aucune autre demande ne verrouille l'évènement ;
    `templatePinned = false`. Appelée par `applyTransition` dès que le statut d'arrivée
    n'est pas dans `ACCEPTED`, `PAID`, `IN_PRODUCTION`, `READY`.
  - `syncRequestTemplates(scope: { eventId: string } | { orgId: string } | { platform: true
    }, actorId: string): Promise<string[]>` — demandes `DRAFT`, `SUBMITTED`, `QUOTED`,
    `ACCEPTED` du périmètre dont la copie diffère du template effectif : copie mise à jour,
    `applyTransition(TEMPLATE_CHANGED, "SYSTEM")` (sauf `DRAFT`), entrée `TEMPLATE_CHANGED {
    fromLabel, toLabel, acceptanceCancelled }` ; une demande `ACCEPTED` avec paiement en cours
    est laissée telle quelle (elle a été épinglée). Renvoie les ids passés en `SUBMITTED` ; la
    route appelle pour chacun `notifyPrintRequestStatusChanged(id, actorId, { organizer:
    true, staff: true })`.
  - Routes : évènement — `assertTemplateChangeAllowed` avant l'écriture, puis
    `syncRequestTemplates({ eventId })` ; org — `pinLockedEventTemplates({ orgId })` avant,
    `syncRequestTemplates({ orgId })` après ; plateforme — `pinLockedEventTemplates({
    platform: true })` avant, `syncRequestTemplates({ platform: true })` après.
  - `BadgeTemplatePicker` : prop `lockedReason?: string` — si présente, encadré
    d'avertissement avec ce texte et tous les boutons désactivés. Page de l'évènement :
    `lockedReason = « Le template est verrouillé : la demande d'impression {reference} a été
    payée. Il redeviendra modifiable quand elle sera terminée. »`.

- [ ] **Step 1 : écrire les tests** — route évènement : demande `PAID` → 409
  `TEMPLATE_LOCKED_BY_PRINT_REQUEST { reference }`, template inchangé ; `COMPLETED` → 200 ;
  `ACCEPTED` avec paiement en cours → 409 `PAYMENT_IN_PROGRESS` ; `QUOTED` → 200, demande
  `SUBMITTED`, copie mise à jour (nouvelles dimensions), entrée « Template de badge changé :
  A → B » ; `ACCEPTED` → acceptation effacée, entrée suffixée « ; l'acceptation est
  annulée ». Route org : évènement verrouillé héritant de l'org → épinglé sur l'ancien
  template, son template effectif ne change pas ; évènement non verrouillé → suit le
  nouveau ; évènement verrouillé avec son propre template → intact. Route plateforme : même
  chose. `releaseTemplatePin` : passage `READY → COMPLETED` d'une demande épinglée remet
  `badgeTemplateId` à `null` ; pas si le template de l'évènement a été changé entre-temps ;
  pas si une autre demande `PAID` verrouille l'évènement.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter le module, brancher `applyTransition`, les routes, la page et
  le sélecteur.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : vérifier au navigateur** — demande passée `PAID` en base (seed) : la page
  `/event/[eventId]/settings/badge` affiche l'encadré et les boutons sont inactifs.
- [ ] **Step 6 : commit** — `feat(impression): verrou du template apres paiement`.

## Task 14 — « Générer les planches » depuis une demande

**Files :**
- Modify : `src/lib/print-sheets/generations.ts`, `src/lib/print-sheets/run-generation.ts`,
  `src/app/api/platform/print/sheets/route.ts`, `src/components/staff/print/GenerationForm.tsx`,
  `src/app/platform/print/sheets/page.tsx`
- Test : `src/lib/__tests__/print-sheets-generations.test.ts`,
  `src/lib/__tests__/print-sheets-run-generation.test.ts`,
  `src/lib/__tests__/api-platform-print-sheets.test.ts` (existants, compléter)

**Interfaces :**
- Consumes : `createGeneration`, `GenerationError`, `runGeneration` (plan 31) ;
  `appendThreadEvent` (Task 3) ; `GET /api/platform/print/requests/[requestId]` (Task 11).
- Produces (modifications du code du plan 31, Task 6-7) :
  - Union des codes de `GenerationError` (plan 31) étendue de `PRINT_REQUEST_NOT_FOUND`,
    `PRINT_REQUEST_NOT_ADVANCE`, `PRINT_REQUEST_NOT_PAID` (les autres codes inchangés).
  - `createGeneration` : entrée étendue d'un `printRequestId?: string`. Contrôles : demande
    inconnue → `GenerationError("PRINT_REQUEST_NOT_FOUND")` (404) ; `ONSITE` →
    `"PRINT_REQUEST_NOT_ADVANCE"` (400) ; évènement différent → `"INVALID_SELECTION"` (400) ;
    statut hors `PAID`, `IN_PRODUCTION`, `READY`, `COMPLETED` → `"PRINT_REQUEST_NOT_PAID"`
    (409) ; sélection non `IDS` ou contenant une inscription absente des items →
    `"INVALID_SELECTION"`. Pour une génération liée (spec 31) : **ordre = `position` des
    items** (pas de nouveau tri `orderRegistrations`), **recto-verso imposé** par la demande
    (`duplex = badgePages === 2`, la valeur reçue est ignorée), et une inscription de la
    demande qui n'est plus `APPROVED` n'est **pas** refusée en `INVALID_SELECTION` : elle est
    gardée et le rendu l'écarte (`skippedIds`, entrée `REGISTRATIONS_SKIPPED`). Écrit
    `printRequestId` et, dans la même transaction, l'entrée `SHEETS_GENERATED {
    generationId, badgeCount }` (auteur, côté `STAFF`).
  - `POST /api/platform/print/sheets` : accepte `printRequestId` facultatif.
  - `runGeneration` : génération `DONE` liée à une demande avec `skippedIds` non vide →
    entrée `REGISTRATIONS_SKIPPED { registrationIds }` (système).
  - Page `/platform/print/sheets?printRequestId=…` : `GenerationForm` reçoit `printRequestId`
    en prop, charge la demande, pré-remplit organisation, évènement et sélection `IDS` (items
    dans l'ordre de `position`), verrouille ces trois champs et affiche « Planches de la
    demande {reference} ».

- [ ] **Step 1 : écrire les tests** — critère 5 : demande `PAID` de 3 items →
  génération avec `registrationIds` dans l'ordre des positions, `printRequestId` posé, entrée
  « Planches lancées pour 3 badges » ; demande `QUOTED` → `PRINT_REQUEST_NOT_PAID` ; `ONSITE`
  → `PRINT_REQUEST_NOT_ADVANCE` ; inscription hors demande → `INVALID_SELECTION` ; item
  passé `REJECTED` après paiement → génération créée quand même ; `duplex: false` reçu sur
  un template de 2 pages → génération recto-verso ; exécution avec un badge `null` → entrée
  « 1 badge(s) écarté(s)… » ; route : `printRequestId` transmis.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): planches generees depuis une demande`.

## Task 15 — Écrans organisateur + entrée « Impression »

**Files :**
- Create : `src/hooks/useVisibleInterval.ts`, `src/components/print/PrintThread.tsx`,
  `src/components/print/QuoteLinesTable.tsx`, `src/components/event/print/PrintRequestWizard.tsx`,
  `src/components/event/print/BadgeSelectionStep.tsx`,
  `src/components/event/print/PrintRequestActions.tsx`,
  `src/app/event/[eventId]/print/page.tsx`, `src/app/event/[eventId]/print/new/page.tsx`,
  `src/app/event/[eventId]/print/[requestId]/page.tsx`,
  `src/app/event/[eventId]/print/[requestId]/edit/page.tsx`
- Modify : `src/components/event/EventShell.tsx`
- Test : `src/hooks/__tests__/useVisibleInterval.test.ts`

**Interfaces :**
- Consumes : API Tasks 10 et 12 ; `ProductCard({ product, selected?, onSelect? })`,
  `ProductConfigurator({ product, value: { quantity, choices }, onChange, uploadFile?,
  quantityLocked? })` et `type ProductConfiguration` (`src/components/print/`, plan 32 —
  `uploadFile` poste sur `…/print-requests/upload` et renvoie la `storageKey` ;
  `quantityLocked` pour le produit `BADGE`, dont la quantité suit le nombre de badges),
  `GET /api/print/catalog?kind=` → `{ products: CatalogProduct[] }` (plan 32, toute
  session) ; `pruneChoices(product, choices)` (plan 32, `pricing-core`) : les `choices`
  enregistrés d'une ligne doivent y passer avant d'alimenter le configurateur et avant toute
  re-validation (options ou valeurs archivées depuis) ; `Stepper`,
  `Timeline`/`TimelineItem`, `Table`, `StatusBadge`, `Button`, `Dialog`, `RadioCards`,
  `FileBox` (`src/components/ui/`) ; `useAsyncAction`, `toastSuccess`, `toastApiError`.
- Produces :
  - `useVisibleInterval(callback: () => void, ms: number): void` — appelle `callback` toutes
    les `ms` tant que `document.visibilityState === "visible"`, et une fois au retour de
    visibilité.
  - `PrintThread({ entriesUrl: string; postUrl: string | null; uploadUrl: string | null })`
    — `Timeline` : messages (auteur, date, texte, pièce jointe ouverte par `/api/files/…`),
    entrées automatiques en ton `default`, détail des `LINES_CHANGED` regroupées
    (`describeLineChange` de chaque changement) ; zone de message et pièce jointe si
    `postUrl` ; rechargement après envoi et par `useVisibleInterval(…, 30_000)`.
  - `QuoteLinesTable({ lines; total; badgeCount })` — libellé, options (`optionsSnapshot`),
    quantité, prix unitaire, total de ligne, total général, en `formatFcfa`.
  - `EventShell` : `{ href: `${base}/print`, label: "Impression", icon: "printer" }` après
    « Badges », seulement si `effectiveRole` vaut `"ADMIN"` ou `"STAFF"`.
  - Pages (garde : `hasEventPermission(ctx, eventId, orgId, "print.request")`, sinon
    redirection vers `/event/{eventId}`) :
    - `/print` : tableau (référence, type, badges, total, statut, date d'envoi), bouton
      « Nouvelle demande » (masqué si l'évènement est archivé), état vide « Aucune demande
      d'impression pour cet évènement. ».
    - `/print/new` : étape 1 (type, `RadioCards` « En amont » / « Pendant l'évènement ») →
      POST, puis redirection vers `/print/{id}/edit`.
    - `/print/{id}/edit` (statuts `DRAFT`, `SUBMITTED`, `QUOTED` ; sinon redirection vers le
      détail) : `PrintRequestWizard`, `Stepper` des 6 étapes « Type », « Badges » (ou
      « Quantité »), « Support », « Accessoires », « Remise », « Récapitulatif » ; chaque
      « Suivant » enregistre l'étape (PUT badges, PUT products, PATCH) ; étape 2 en amont :
      `BadgeSelectionStep` (modes « Tous les badges disponibles », « Par catégorie »,
      « Sélection manuelle » avec recherche ; lignes réservées grisées avec « Déjà dans
      {reference} », imprimées signalées) ; étapes 3-4 : cartes et configurateur du plan 32
      (`BADGE` puis accessoires) ; étape 6 : `QuoteLinesTable` + « Le prix définitif est fixé
      par l'équipe Badge dans le devis » + « Envoyer la demande » (brouillon) ou « Enregistrer
      les modifications » (déjà envoyée).
    - `/print/{id}` : en-tête (référence, statut, total, version du devis), lignes, informations
      de remise, `PrintThread`, `PrintRequestActions` : « Modifier » (`DRAFT`, `SUBMITTED`,
      `QUOTED`), « Annuler la demande » (jusqu'à `ACCEPTED`, `Dialog` de confirmation),
      « Accepter le devis v{n} » (si `canAccept`), sinon sur `QUOTED` la mention « Seul le
      propriétaire de l'organisation peut accepter ce devis. ». Le bouton « Payer » est
      ajouté par le plan 34.

- [ ] **Step 1 : test du hook** (fake timers, `visibilityState` simulé) : 3 appels en 90 s
  visibles, 0 caché, 1 au retour de visibilité. Lancer → FAIL.
- [ ] **Step 2 : implémenter le hook** → PASS.
- [ ] **Step 3 : implémenter composants, pages et entrée de menu.**
- [ ] **Step 4 : vérifier au navigateur** (après `make db-seed`, catalogue du plan 32
  renseigné), à 375 px et 1280 px : créer une demande en amont, choisir tous les badges,
  un support et un cordon, remise « Retrait », envoyer ; la demande apparaît « Envoyée » ;
  écrire un message avec une pièce jointe PDF ; l'entrée « Impression » est absente pour un
  `OPERATOR`.
- [ ] **Step 5 : `make lint && make typecheck`.**
- [ ] **Step 6 : commit** — `feat(impression): ecrans des demandes cote organisateur`.

## Task 16 — Écrans staff + entrée « Demandes » avec compteur

**Files :**
- Create : `src/components/staff/print/RequestList.tsx`,
  `src/components/staff/print/RequestDetail.tsx`, `src/components/staff/print/QuoteEditor.tsx`,
  `src/components/staff/print/RequestStatusActions.tsx`,
  `src/app/platform/print/requests/page.tsx`,
  `src/app/platform/print/requests/[requestId]/page.tsx`
- Modify : `src/components/admin/SidebarNav.tsx`, `src/components/staff/StaffShell.tsx`,
  `src/app/platform/layout.tsx`
- Test : `src/components/admin/__tests__/SidebarNav.test.tsx` (créer ou compléter, rendu
  `renderToString` comme `PaymentHistory.test.tsx`)

**Interfaces :**
- Consumes : API Task 11 ; `PrintThread`, `QuoteLinesTable` (Task 15) ; `chunk` (Task 2) ;
  `POST /api/org/{orgId}/events/{eventId}/registrations/print` (existant, 500 identifiants
  au plus, le staff y passe par `withEventAuth`).
- Produces :
  - `NavLink.count?: number` — pastille à droite du libellé si `count > 0`, `aria-label`
    « {n} en attente ».
  - `StaffShell` : prop `pendingPrintRequests: number` ; entrée `{ href:
    "/platform/print/requests", label: "Demandes", icon: "inbox", count:
    pendingPrintRequests }` dans le groupe « Impression » (après « Gabarits »).
    `platform/layout.tsx` : `prisma.printRequest.count({ where: { status: "SUBMITTED" } })`.
  - `/platform/print/requests` : filtres statut, organisation, type, date souhaitée (du… au…),
    tableau (référence, organisation, évènement, type, badges, total, statut, date
    souhaitée), pagination, état vide « Aucune demande ».
  - `/platform/print/requests/{id}` : évènement (titre, dates, lieu, organisation, contacts) ;
    template (libellé, format en mm via `pxToMm`, pages) et épreuve `proofPath` ; badges
    (nombre, liste repliable avec catégorie, statut, imprimé) ; remise ; `QuoteEditor`
    (lignes éditables en ligne — quantité, prix unitaire, libellé — ajout d'une ligne
    produit, service, remise ou libre, retrait ; lecture seule sauf `STAFF_ADMIN` sur
    `SUBMITTED`/`QUOTED`) ; `RequestStatusActions` selon statut et rôle : « Envoyer le devis »,
    « Refuser » (motif obligatoire), « Rouvrir le devis », « Passer en production »,
    « Marquer prête », « Terminer », « Marquer payée » (`ACCEPTED`, `STAFF_ADMIN`, `Dialog`
    avec motif obligatoire → `POST …/mark-paid` ; seul écran de passage manuel, le plan 34
    n'y ajoute que l'historique des paiements et le message de `PAYMENT_IN_PROGRESS`),
    « Générer les planches » (`ADVANCE`, `PAID` et après → `/platform/print/sheets?
    printRequestId={id}`) ; générations liées (statut, téléchargement) ; `PrintThread` côté
    staff (pièces jointes par `POST /api/platform/upload?context=print-request`, plan 32).
  - « Terminer » ouvre un `Dialog` « Marquer les {n} badges comme imprimés ? » ; « Oui »
    envoie les items non imprimés par paquets de 500 (`chunk`) à la route existante, puis
    passe la demande en `COMPLETED` ; « Non » passe seulement en `COMPLETED`.

- [ ] **Step 1 : test de `SidebarNav`** — `count: 3` → pastille « 3 » ; `count: 0` ou
  absent → pas de pastille. Lancer → FAIL.
- [ ] **Step 2 : implémenter la pastille** → PASS.
- [ ] **Step 3 : implémenter le shell, le layout, les composants et les pages.**
- [ ] **Step 4 : vérifier au navigateur** : avec la demande envoyée en Task 15, le menu
  affiche « Demandes 1 » ; modifier un prix et ajouter « Frais de livraison » : une entrée
  « 2 lignes modifiées » dans le fil ; envoyer le devis : le compteur tombe à 0 ; côté
  organisateur (OWNER), accepter ; « Marquer payée » avec motif ; « Générer les planches »
  ouvre le formulaire pré-rempli ; « Terminer » avec marquage des badges.
- [ ] **Step 5 : `make lint && make typecheck && make test`.**
- [ ] **Step 6 : commit** — `feat(impression): ecrans des demandes cote staff`.

## Task 17 — E2E et documentation

**Files :**
- Create : `e2e/event/print.spec.ts`, `e2e/event/print-request.spec.ts`,
  `e2e/platform/print-requests.spec.ts`, `e2e/platform/print-request-detail.spec.ts`,
  `docs/v4/features/impression-demandes.md`
- Modify : `e2e/helpers/db.ts` (`createTestPrintRequest(opts: { eventId; orgId; createdById;
  status; type?; registrationIds?; lines?: { label; quantity; unitPrice; kind? }[] })`,
  purge des quatre modèles dans `cleanupE2ETestData`), `docs/v4/README.md`

**Interfaces :**
- Consumes : tout ce qui précède. Règles e2e (`e2e/README.md`) : un fichier par page,
  aucun `page.request`, `loginAndEnter`, navigation par le shell, URL assertée.

- [ ] **Step 1 : `print.spec.ts`** (liste + assistant) — un admin d'évènement (OWNER) crée
  une demande en amont : badges « Tous », support, cordon, retrait, envoi ; la liste montre
  « Envoyée » ; un deuxième brouillon ne propose pas les inscriptions déjà demandées
  (« Déjà dans IMP-… ») ; un `OPERATOR` ne voit pas l'entrée « Impression » ; état vide.
- [ ] **Step 2 : `print-request.spec.ts`** (détail) — message avec pièce jointe visible dans
  le fil ; sur un devis `QUOTED` v2, un MANAGER lit la mention « Seul le propriétaire… », l'OWNER
  accepte et voit « Devis accepté » ; annulation d'une demande `SUBMITTED` confirmée.
- [ ] **Step 3 : `print-requests.spec.ts`** (liste staff) — compteur « Demandes » ; filtre
  par statut ; `STAFF_OBSERVER` voit la liste.
- [ ] **Step 4 : `print-request-detail.spec.ts`** (détail staff) — `STAFF_ADMIN` modifie un
  prix, ajoute des frais, envoie le devis ; entrée regroupée dans le fil ; refus avec motif
  vide → message d'erreur affiché ; « Marquer payée » avec motif sur une demande `ACCEPTED`
  → statut « Payée », entrée « (hors ligne : …) », `PRINT_REQUEST_MARKED_PAID` ;
  `STAFF_SUPPORT` ne voit ni l'éditeur de lignes ni « Marquer payée » ;
  « Générer les planches » ouvre `/platform/print/sheets?printRequestId=…` pré-rempli.
- [ ] **Step 5 : lancer les e2e** — attendu : PASS.
- [ ] **Step 6 : documentation** — `features/impression-demandes.md` : cycle de vie (table
  de la Task 2), lots et réservation, suivi des quantités, fil et regroupement, droits,
  verrou et épinglage du template, fichiers, notifications, points d'extension des plans 34
  (`paymentProbe`, `markPaid`, `paidPaymentId`) et 35 (`marginPercent`, `parentRequestId`,
  `PrintQuoteLine.usesOrgCredit`) ; ligne dans
  `docs/v4/README.md`.
- [ ] **Step 7 : commit** — `docs(impression): demandes d'impression et devis`.

## Vérification finale

- [ ] `make lint && make typecheck && make test` (couverture 100 %).
- [ ] E2E des quatre pages.
- [ ] Parcours complet au navigateur : création (150 badges, PVC, cordons), devis, échange
  de messages des deux côtés avec notifications, acceptation, paiement manuel, template
  verrouillé, planches générées, terminaison avec marquage des badges.

## Auto-relecture

**Couverture de la spec 33 :**

| Exigence | Task |
|---|---|
| Modèles et champs (`PrintRequest`, items, lignes, fil), `ONSITE` | 1 |
| Cycle de vie complet, réouverture, refus, annulation, production | 2, 5, 8, 9 |
| Une demande = un lot figé, réservation à l'envoi, brouillon sans réservation | 6, 8 |
| Quantités qui suivent le nombre de badges, écart signalé | 6 |
| Copie figée des produits et options | 7 |
| Le staff ajoute des lignes, change prix et quantités ; modifications visibles et regroupées dans le fil | 3, 9 |
| Toute modification après `QUOTED` repasse en révision | 2, 5 |
| Acceptation d'une version précise, OWNER seul, staff refusé | 8, 10 |
| `PAYMENT_IN_PROGRESS` | 5, 8, 9, 13 |
| Paiement hors ligne `STAFF_ADMIN` avec motif | 9, 11 |
| `markPaid` pour le plan 34 | 5 |
| Template verrouillé de `PAID` à `COMPLETED`, à tous les niveaux ; avant paiement : copie mise à jour et révision | 13 |
| Marquage des badges imprimés à la terminaison, par 500 | 16 |
| Fichiers : upload organisateur, clés sensibles, pièces jointes staff | 12, 16 |
| Entrées automatiques du fil (lignes, devis, acceptation, réouverture, statut, paiement, badges, template, inscriptions écartées) | 3, 6-9, 13, 14 |
| Notifications et emails, auteur exclu | 1, 4, 10, 11 |
| Rafraîchissement 30 s onglet visible | 15 |
| Écrans organisateur (liste, assistant 6 étapes, détail) et entrée « Impression » | 15 |
| Écrans admin (liste filtrable, détail complet, compteur) | 16 |
| « Générer les planches » lié à la demande | 14 |
| Permission `print.request`, rôles staff, évènement archivé, droit d'abonnement | 1, 10, 11 |
| `ActivityType` (9) | 1, 10, 11 |
| Fil ouvert dans tous les statuts | 3 |
| Critères d'acceptation 1 à 6 | 10 (1), 9 (2, 3), 6 et 8 (4), 14 (5), 4 et 11 (6) ; e2e en 17 |

Hors de ce plan : poste d'impression, compteur, marge, crédit, demande complémentaire et
contrôle du template adapté pour `ONSITE`, `PrintQuoteLine.usesOrgCredit` et dépense du
crédit dans `markPaidManually` (plan 35) ; checkout, `Payment.printRequestId`, corps réel de
`paymentProbe`, bouton « Payer », historique des paiements, notification dédiée du passage
en `PAID` (plan 34). Le passage manuel en `PAID` (service, route, bouton) est **dans ce
plan** et nulle part ailleurs.

**Cohérence des noms :** `nextStatus`, `PrintRequestAction`, `PrintRequestActor` (Task 2) ;
`appendThreadEvent`, `ThreadEventType`, `ThreadActor`, `PrintRequestError` (Task 3) ;
`markPaid`, `assertOwner`, `isPaymentInProgress`, `paymentProbe`, `applyTransition`,
`applyEdit` (Task 5) — mêmes signatures partout où elles sont consommées. Les codes d'erreur
utilisés dans les Tasks 5 à 13 figurent tous dans `PrintRequestErrorCode` (Task 3) ; les
codes `PRINT_REQUEST_*` de la Task 14 sont des codes de `GenerationError` (plan 31). Le
groupe de menu « Impression » vient du plan 31 ; ce plan n'y ajoute que « Demandes ».
