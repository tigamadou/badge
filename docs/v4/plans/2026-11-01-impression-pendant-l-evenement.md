# Impression pendant l'évènement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** un organisateur commande une impression **sur place** (`ONSITE`) si le template de
son évènement est déclaré adapté ; un opérateur de la plateforme imprime les badges à
l'accueil en scannant le QR d'accueil du participant ; la demande compte les impressions,
bloque au plafond (commande + marge) et, à la clôture, verse les badges non utilisés au
crédit FCFA de l'organisation ou crée une demande complémentaire pour le surplus.

**Architecture :** quatre couches. (1) Réglages plateforme (onglet « Impression sur place »,
`getOnsitePrintSettings`) et éligibilité du template, branchés sur l'envoi et l'avancement
d'une demande du plan 33. (2) Calcul **pur** du compteur et du plafond
(`src/lib/print-requests/onsite-counter.ts`). (3) Poste d'impression : journal
`PrintRequestPrint`, recherche / lecture de QR / impression sous verrou de la demande, routes
staff `…/onsite/**`, page `/platform/print/requests/[requestId]/onsite` réutilisant la caméra
du scanner. (4) Crédit `OrgPrintCredit` (mouvements FCFA) et clôture `closeOnsiteRequest`
(crédit ou demande complémentaire). Le QR d'accueil (même lien `/verify/<ID>` que le badge)
est ajouté à l'email d'approbation et à la page d'inscription du participant.

**Tech Stack :** Next.js 16 App Router, Prisma 6 / MySQL 8, zod, `qrcode` (déjà présent),
`html5-qrcode` (déjà présent), Vitest 4 (BDD réelle), Playwright. Aucune nouvelle dépendance.

**Spec :** [`docs/v4/specs/2026-11-01-35-v4-impression-pendant-l-evenement.md`](../specs/2026-11-01-35-v4-impression-pendant-l-evenement.md)
(contexte : specs [33](../specs/2026-11-01-33-v4-demandes-d-impression-et-devis.md) et
[34](../specs/2026-11-01-34-v4-paiement-des-devis-d-impression.md)). Question ouverte 4
tranchée « oui » : un évènement peut avoir une demande en amont **et** une demande sur place ;
rien dans ce plan ne l'interdit.

**Branche :** `feat/service-impression` (créée depuis `development` le 2026-11-01)

**Prérequis :** plans 32, 33 et 34 exécutés (catalogue, demandes et devis, paiement).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Schéma, purge des tests, libellés d'activité | [ ] | | |
| 2 | Réglages « Impression sur place » : lecture et API | [ ] | | |
| 3 | Onglet des réglages et pictogramme des templates | [ ] | | |
| 4 | Éligibilité du template et envoi d'une demande sur place | [ ] | | |
| 5 | Template devenu inadapté : alerte et blocage de l'avancement | [ ] | | |
| 6 | QR d'accueil : email d'approbation et page participant | [ ] | | |
| 7 | Compteur et plafond (pur) | [ ] | | |
| 8 | Poste d'impression : recherche, QR, impression journalisée | [ ] | | |
| 9 | API du poste et réglage de la marge | [ ] | | |
| 10 | Écran du poste, compteur des deux côtés | [ ] | | |
| 11 | Crédit d'impression : solde, application, dépense au paiement | [ ] | | |
| 12 | Clôture : crédit ou demande complémentaire | [ ] | | |
| 13 | Écrans du crédit et des demandes complémentaires | [ ] | | |
| 14 | E2E et documentation | [ ] | | |
| — | Vérification finale (lint, typecheck, test, e2e, impression réelle au poste) | [ ] | | |

Statuts : `[ ]` à faire, `[~]` en cours, `[x]` terminé, `[-]` abandonné. Mettez à jour la
ligne après chaque task validée. En cas d'interruption, passez la ligne à `[~]` et notez
précisément l'état.

## Contraintes globales

- **UI en français avec accents.** Code et identifiants en anglais. Commentaires en
  français, dans le style du fichier touché. Commits et noms de fichiers en ASCII.
- **Montants entiers en FCFA**, affichés avec `Intl.NumberFormat("fr-FR")` + « FCFA » (les
  tests construisent la chaîne attendue avec le même formateur : séparateur insécable).
- **Quantité commandée** d'une demande sur place = quantité de la ligne `PRODUCT` non retirée
  dont le produit est de `kind = BADGE` ; **prix unitaire du badge** = `unitPrice` de cette
  ligne (suppléments d'options compris, accessoires exclus).
- **Plafond** = commandé + `ceil(commandé × marge / 100)`. Alerte à 90 % de la commande.
- **Seul le journal `PrintRequestPrint` compte**, hors lignes `reprint`. Les impressions de
  l'organisateur (action existante) ou d'une demande en amont n'y entrent jamais.
- **Demande complémentaire** = `PrintRequest` avec `parentRequestId` non nul : ni poste, ni
  compteur, ni clôture en crédit / surplus.
- **Droits** : réglages et marge `STAFF_ADMIN` ; poste (recherche, QR, impression)
  `STAFF_SUPPORT` ; lecture du compteur `STAFF_OBSERVER` ; application du crédit
  `STAFF_ADMIN`. `withStaffAuth(handler, { minRole })` (`src/lib/with-staff-auth.ts`).
- **Toute action sensible loggée** via `logActivity` ; chaque nouvel `ActivityType` reçoit un
  libellé dans `src/lib/activity-labels.ts`.
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

### Contrat amont (plans 32, 33, 34)

Consommé tel quel : modèles `PrintRequest` (`type`, `status`, `estimatedQuantity`,
`onsiteSchedule`, `onsiteLocation`, `onsiteContactName`, `onsiteContactPhone`,
`marginPercent Int?`, `parentRequestId String?` — relation `"PrintRequestParent"`,
`badgeTemplateId String?` et les autres champs de copie du template, `templatePinned`
laissé à `false`), `PrintQuoteLine` (`kind`, `productId`, `optionsSnapshot`, `choices`,
`unitPrice`, `quantity`, `lineTotal`, `addedBy`, `removedAt`), `PrintProduct.kind = BADGE` ;
depuis `src/lib/print-requests/service.ts` (plan 33) : `applyEdit(tx, request, side,
userId)` (seule voie d'une modification de lignes : `QUOTED → SUBMITTED` + entrée
`QUOTE_REVISION`, `ACCEPTED` → 409 `QUOTE_ACCEPTED`, statut figé → 409 `REQUEST_LOCKED`),
`recomputeTotal(tx, requestId)`, `nextReference(tx, now)`, `markPaid` ; `appendThreadEvent(tx,
requestId, eventType: ThreadEventType, details, actor?)` (`thread.ts`, acteur `SYSTEM` par
défaut) ; `notifyPrintRequestQuoted(requestId, actorId)`,
`notifyPrintRequestStatusChanged(requestId, actorId, to)` (`triggers.ts`) ; l'assistant de
demande et les pages `/platform/print/requests/[requestId]` et
`/event/[eventId]/print/[requestId]`. **Aucune écriture directe de `status`** : toute
transition passe par `applyTransition` / `applyEdit` (règle du plan 33).

Points d'accroche dans le code des plans 33 et 34 (ce plan **modifie** ces fichiers ; si le
fichier porte un autre nom à l'exécution, adapter le chemin, jamais le comportement) :

| Accroche | Où | Appel ajouté |
|---|---|---|
| A1 — envoi d'une demande (`DRAFT → SUBMITTED`) | `submitRequest` (`src/lib/print-requests/lifecycle.ts`, plan 33), dans sa transaction, avant `applyTransition(SUBMIT)` ; la route `…/print-requests/[requestId]/submit/route.ts` traduit `OnsiteError` | `prepareOnsiteSubmission` (Task 4) |
| A2 — avancement staff (envoi du devis, `IN_PRODUCTION`, `READY`, `COMPLETED`) | routes `src/app/api/platform/print/requests/[requestId]/send-quote/route.ts` et `…/status/route.ts` (plan 33), avant l'appel de `sendQuote` / `advanceStatus` | `assertOnsiteCanAdvance` (Task 5) |
| A3 — passage à `COMPLETED` | `…/status/route.ts`, après validation de `advanceStatus(to: "COMPLETED")` | `closeOnsiteRequest` (Task 12) |
| A4 — passage à `PAID` (paiement FedaPay **et** paiement hors ligne) | branche `PRINT_REQUEST` de `confirmPayment` (`src/lib/payments.ts`, plan 34) et `markPaidManually` (`src/lib/print-requests/quote.ts`, plan 33), dans la même transaction, quand `markPaid` renvoie `true` | `spendOrgCreditForPaidRequest` (Task 11) |
| A5 — référence d'une nouvelle demande, notification `PRINT_REQUEST_QUOTED` | `nextReference` (`service.ts`) et `notifyPrintRequestQuoted` (`triggers.ts`) du plan 33 | réutilisés par la demande complémentaire (Task 12) |

Modification de lignes par le staff (crédit, Task 11) : `applyEdit(tx, request, "STAFF",
userId)` (action `STAFF_EDIT` de la table du plan 33), jamais `nextStatus` appelé à la main.
Entrées du fil ajoutées par ce plan à `ThreadEventType` et `describeThreadEvent`
(`src/lib/print-requests/thread.ts`) : `ONSITE_MARGIN_CHANGED`, `ORG_CREDIT_APPLIED`,
`ORG_CREDIT_SPENT`, `ONSITE_CREDIT_EARNED`, `ONSITE_SUPPLEMENT_CREATED`.

## Arbitrages de cohérence (2026-11-01, contrôleur)

- `OrgPrintCredit.requestId` est **nullable, `onDelete: SetNull`** (et non `Restrict`) : le
  crédit appartient à l'organisation ; supprimer un évènement ne doit pas échouer ni effacer
  l'historique du crédit.
- Garde à ajouter au plan 33 (dans la task qui crée `usesOrgCredit`) : `updateStaffLine` et
  `removeStaffLine` refusent une ligne `usesOrgCredit` avec `409 CREDIT_LINE_LOCKED`, avec un
  test par fonction ; seules les routes de crédit de ce plan créent, ajustent ou retirent cette
  ligne.

## Points de vigilance de revue

1. **Plafond franchi par concurrence** (double clic, deux onglets) : verrou `FOR UPDATE` sur la demande dans `recordOnsitePrint` ; jamais 221 impressions comptées pour un plafond de 220. (Task 8.)
2. **Fenêtre du PDF bloquée** : l'onglet s'ouvre **au clic**, de façon synchrone, reçoit l'URL après le succès de l'API et se ferme en cas de refus. (Task 10.)
3. **Crédit dépensé deux fois** : réservation des crédits des demandes non payées, verrou de l'organisation à l'application, dépense idempotente (`@@unique([requestId, kind])`) même si le webhook est rejoué. (Task 11.)
4. **Clôture rejouée** (double passage à `COMPLETED`, nouvelle tentative) : un seul mouvement de crédit, une seule demande complémentaire ; une demande complémentaire n'est jamais clôturée en crédit. (Task 12.)
5. **Comptage** : lignes `reprint` exclues ; une inscription supprimée après impression continue de compter (`SetNull`) ; un badge déjà imprimé ailleurs passe en réimpression. (Tasks 1, 8.)

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | champs `PlatformSettings`, `PrintRequestPrint`, `OrgPrintCredit`, `PrintQuoteLine.usesOrgCredit`, `ActivityType` |
| `src/lib/settings.ts` | `getOnsitePrintSettings`, `parseOnsiteTemplateIds` |
| `src/lib/platform-settings-tabs.ts` | onglet `onsite-print` |
| `src/app/api/platform/settings/onsite-print/route.ts` (nouveau) | `PATCH` des réglages |
| `src/components/staff/OnsitePrintSettingsForm.tsx` (nouveau, client) | formulaire de l'onglet |
| `src/lib/badge-templates/resolve.ts`, `src/components/admin/BadgeTemplatePicker.tsx`, `BadgeTemplateTiles.tsx`, `src/app/platform/badge-templates/page.tsx` | pictogramme « Impression sur place » |
| `src/lib/print-requests/onsite.ts` (nouveau) | `OnsiteError`, éligibilité, `prepareOnsiteSubmission`, `assertOnsiteCanAdvance` |
| `src/lib/print-requests/onsite-counter.ts` (nouveau) | `onsiteCap`, `computeOnsiteCounter`, `orderedBadgeLine` (pur) |
| `src/lib/print-requests/onsite-station.ts` (nouveau) | `loadOnsiteRequest`, `lookupOnsiteRegistration`, `searchOnsiteRegistrations`, `recordOnsitePrint`, `setOnsiteMargin` |
| `src/lib/print-requests/org-credit.ts` (nouveau) | solde, disponible, mouvements, `applyOrgCredit`, `spendOrgCreditForPaidRequest` |
| `src/lib/print-requests/close-onsite.ts` (nouveau) | `closeOnsiteRequest` |
| `src/lib/print-requests/thread.ts` (plan 33) | 5 nouveaux `ThreadEventType` et leurs textes |
| `src/lib/print-requests/lifecycle.ts`, `quote.ts` (plan 33), `src/lib/payments.ts` (plan 34) | accroches A1 et A4 |
| `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/submit/route.ts`, `src/app/api/platform/print/requests/[requestId]/{send-quote,status}/route.ts` (plan 33) | accroches A1 (erreur), A2, A3 |
| `src/lib/registration-qr.ts` (nouveau) | `registrationVerifyUrl`, `parseRegistrationQr` |
| `src/lib/qrcode.ts` | `generateQRCodePng` |
| `src/app/api/public/qr/[registrationId]/route.ts` (nouveau) | image PNG du QR d'accueil (email) |
| `src/lib/mail.ts`, `src/app/account/registrations/[id]/page.tsx` | QR d'accueil |
| `src/app/api/platform/print/requests/[requestId]/onsite/{lookup,search,print,margin}/route.ts` (nouveaux) | poste et marge |
| `src/app/api/platform/print/requests/[requestId]/credit/route.ts` (nouveau) | application du crédit |
| `src/components/event/QrCamera.tsx` (nouveau, client), `QRScanner.tsx` | caméra partagée |
| `src/components/print/OnsiteCounterCard.tsx`, `OnsiteTemplateAlert.tsx`, `OrgPrintCreditCard.tsx` (nouveaux) | blocs communs org / staff |
| `src/components/staff/print/OnsiteStation.tsx`, `OnsiteMarginForm.tsx`, `ApplyCreditDialog.tsx` (nouveaux, client) | écrans staff |
| `src/app/platform/print/requests/[requestId]/onsite/page.tsx` (nouveau) | poste d'impression |
| `docs/v4/features/impression-sur-place.md` (nouveau), `docs/v4/README.md` | documentation |

---

## Task 1 — Schéma, purge des tests, libellés d'activité

**Files :**
- Modify : `prisma/schema.prisma`, `src/test-setup.ts`, `src/lib/activity-labels.ts`
- Test : `src/lib/__tests__/activity-labels.test.ts` (existant, compléter)

**Interfaces :**
- Produces :
  - `PlatformSettings` : `onsitePrintTemplateIds Json?` (liste d'identifiants
    `InstalledBadgeTemplate`), `onsitePrinterNote String? @db.Text`,
    `onsiteDefaultMarginPercent Int @default(10)`.
  - `model PrintRequestPrint { id cuid, requestId (PrintRequest, Cascade), registrationId
    String? (Registration, SetNull), printedById String? (User, SetNull), printedAt DateTime
    @default(now()), reprint Boolean @default(false), @@index([requestId, reprint]),
    @@index([registrationId]) }`
  - `enum OrgPrintCreditKind { EARNED SPENT }`
  - `model OrgPrintCredit { id cuid, orgId (Organization, Cascade), kind OrgPrintCreditKind,
    amount Int /* FCFA : > 0 pour EARNED, < 0 pour SPENT */, requestId (PrintRequest,
    Restrict), quantity Int? /* badges non utilisés (EARNED) */, unitPrice Int?,
    createdById String? (User, SetNull), createdAt, @@unique([requestId, kind]),
    @@index([orgId, createdAt]) }`
  - `PrintQuoteLine.usesOrgCredit Boolean @default(false)` (ligne `DISCOUNT` liée au crédit)
    — **ajout au modèle du plan 33**, qui ne le déclare pas.
  - `ActivityType` : `PRINT_REQUEST_MARGIN_RAISED`, `PRINT_CREDIT_APPLIED`,
    `PRINT_CREDIT_EARNED`, `PRINT_REQUEST_SUPPLEMENT_CREATED`.

- [ ] **Step 1 : compléter le test des libellés** — les quatre types ont un libellé non vide ;
  `logKind` : `PRINT_REQUEST_MARGIN_RAISED` → `"modification"`, `PRINT_CREDIT_APPLIED` →
  `"modification"`, `PRINT_CREDIT_EARNED` → `"creation"`, `PRINT_REQUEST_SUPPLEMENT_CREATED`
  → `"creation"`.
- [ ] **Step 2 : lancer le test** — attendu : FAIL (types inconnus).
- [ ] **Step 3 : schéma** — ajouts ci-dessus ; `make db-push` ; purge de `src/test-setup.ts` :
  `printRequestPrint` et `orgPrintCredit` **avant** `printQuoteLine` / `printRequest` ;
  libellés et deux cas explicites dans `logKind` (`_RAISED`, `PRINT_CREDIT_APPLIED`).
- [ ] **Step 4 : lancer le test** — attendu : PASS. Puis `make typecheck`.
- [ ] **Step 5 : commit** — `feat(impression): schema de l'impression sur place et du credit`.

## Task 2 — Réglages « Impression sur place » : lecture et API

**Files :**
- Modify : `src/lib/settings.ts`
- Create : `src/app/api/platform/settings/onsite-print/route.ts`
- Test : `src/lib/__tests__/settings.test.ts` (compléter),
  `src/lib/__tests__/api-platform-settings-onsite-print.test.ts`

**Interfaces :**
- Consumes : champs `PlatformSettings` (Task 1).
- Produces :
  - `type OnsitePrintSettings = { templateIds: string[]; printerNote: string | null;
    defaultMarginPercent: number }`
  - `parseOnsiteTemplateIds(value: unknown): string[]` — tolérante : non-tableau → `[]`,
    éléments non chaînes ignorés, doublons retirés, ordre conservé.
  - `getOnsitePrintSettings(): Promise<OnsitePrintSettings>` (singleton absent → valeurs par
    défaut `[]`, `null`, `10`).
  - `PATCH /api/platform/settings/onsite-print` (`STAFF_ADMIN`), corps `{ templateIds:
    string[] (≤ 100), printerNote: string | null (≤ 500), defaultMarginPercent: entier 0–100 }`
    → 200 `{ settings }` ; 400 `INVALID_BODY` ; 400 `UNKNOWN_TEMPLATE` (identifiant absent
    d'`InstalledBadgeTemplate`) ; log `PLATFORM_SETTINGS_UPDATED` avec `details: { section:
    "onsite-print", templateCount }`.

- [ ] **Step 1 : écrire les tests**

```ts
it("parseOnsiteTemplateIds : null -> [], ['a', 3, 'a', 'b'] -> ['a', 'b']", () => {});
it("getOnsitePrintSettings : valeurs par défaut [], null, 10", async () => {});
it("PATCH enregistre deux templates, la note et 15 %", async () => {
  // 200 ; getOnsitePrintSettings() -> { templateIds: [t1.id, t2.id], printerNote: "Zebra ZC300, CR80", defaultMarginPercent: 15 }
});
it("PATCH : 401 sans session, 403 STAFF_SUPPORT", async () => {});
it("PATCH : 400 INVALID_BODY pour une marge de 101 ou -1", async () => {});
it("PATCH : 400 UNKNOWN_TEMPLATE pour un identifiant inconnu, rien n'est écrit", async () => {});
it("PATCH : logActivity PLATFORM_SETTINGS_UPDATED { section: 'onsite-print', templateCount: 2 }", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** (modèle : `src/app/api/platform/settings/badge/route.ts`,
  avec `withStaffAuth`).
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): reglages de l'impression sur place`.

## Task 3 — Onglet des réglages et pictogramme des templates

**Files :**
- Modify : `src/lib/platform-settings-tabs.ts`, `src/app/platform/settings/page.tsx`,
  `src/lib/badge-templates/resolve.ts`, `src/components/admin/BadgeTemplatePicker.tsx`,
  `src/components/admin/BadgeTemplateTiles.tsx`, `src/app/platform/badge-templates/page.tsx`
- Create : `src/components/staff/OnsitePrintSettingsForm.tsx`
- Test : `src/lib/__tests__/platform-settings-tabs.test.ts`,
  `src/lib/badge-templates/__tests__/resolve.test.ts` (compléter)

**Interfaces :**
- Consumes : `getOnsitePrintSettings`, API Task 2.
- Produces :
  - `PLATFORM_SETTINGS_TABS` : `{ value: "onsite-print", label: "Impression sur place",
    adminOnly: true }` (dernier).
  - `TemplateSummary` (les deux déclarations) gagne `onsite: boolean` ;
    `listAvailableTemplates()` le renseigne depuis `getOnsitePrintSettings()`.
  - `OnsitePrintSettingsForm({ templates: Array<{ id: string; label: string; version:
    number; widthMm: number; heightMm: number; previewSrc: string }>; initial:
    OnsitePrintSettings })` — cases à cocher sur **toutes les versions** installées non
    archivées (« Nom — v3 — 86 × 54 mm »), note de l'imprimante, marge par défaut (%).
  - Pictogramme `printer` + libellé accessible « Impression sur place » sur les tuiles du
    picker, de `BadgeTemplateTiles` et de la liste `/platform/badge-templates`.

- [ ] **Step 1 : écrire les tests** — onglet visible pour un `STAFF_ADMIN`, absent sinon ;
  `resolveSettingsTab("onsite-print", false)` → `"email"` ; `listAvailableTemplates()` :
  `onsite: true` pour le template coché, `false` pour l'autre.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** l'onglet, la section de page (`tab === "onsite-print"`, carte
  « Impression sur place »), le formulaire (`useAsyncAction`, `toastSuccess` /
  `toastApiError`) et les pictogrammes.
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : navigateur** (après `make db-seed`, 375 px et 1280 px) : cocher un template,
  enregistrer, recharger ; le pictogramme apparaît dans le catalogue et dans le choix du
  template d'un évènement.
- [ ] **Step 6 : commit** — `feat(impression): onglet impression sur place et pictogramme`.

## Task 4 — Éligibilité du template et envoi d'une demande sur place

**Files :**
- Create : `src/lib/print-requests/onsite.ts`
- Modify : `src/lib/print-requests/lifecycle.ts` (`submitRequest`, accroche A1) et
  `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/submit/route.ts`
  (traduction d'`OnsiteError` par `onsiteErrorResponse`, sinon `printRequestErrorResponse`
  la relancerait en 500), page `src/app/event/[eventId]/print/new/page.tsx` (étape « type »,
  plan 33)
- Test : `src/lib/__tests__/print-requests-onsite.test.ts`

**Interfaces :**
- Consumes : `getOnsitePrintSettings` (Task 2), `resolveEventTemplateId`
  (`src/lib/badge-templates/event-template-variables.ts`).
- Produces :
  - `type OnsiteErrorCode = "ONSITE_TEMPLATE_UNSUITABLE" | "NOT_FOUND" | "NOT_ONSITE" |
    "REQUEST_NOT_PRINTABLE" | "REGISTRATION_NOT_FOUND" | "FOREIGN_EVENT" | "NOT_APPROVED" |
    "ALREADY_PRINTED" | "CAP_REACHED" | "MARGIN_BELOW_PRINTED" | "NOT_CLOSABLE" |
    "REQUEST_LOCKED" | "CREDIT_INSUFFICIENT" | "CREDIT_EXCEEDS_TOTAL"`
  - `class OnsiteError extends Error { constructor(readonly code: OnsiteErrorCode, readonly
    httpStatus: number, readonly details?: Record<string, unknown>) }` et
    `onsiteErrorResponse(err: OnsiteError): NextResponse` (`{ error, code, message,
    ...details }`).
  - `getOnsiteEligibility(eventId: string): Promise<{ eligible: boolean; templateId: string }>`
  - `prepareOnsiteSubmission(tx: Prisma.TransactionClient, request: { eventId: string; type:
    PrintRequestType }): Promise<{ marginPercent: number } | null>` — `null` pour `ADVANCE` ;
    pour `ONSITE` : template effectif hors liste → `OnsiteError("ONSITE_TEMPLATE_UNSUITABLE",
    409)` ; sinon la marge par défaut, que l'accroche A1 écrit dans `marginPercent`.
  - Assistant : l'option « Pendant l'évènement » est désactivée si `eligible` est faux, avec
    « Le modèle de badge de cet évènement n'est pas adapté à l'impression sur place. » et le
    lien « Changer le modèle de badge » vers `/event/[eventId]/settings/badge`.

- [ ] **Step 1 : écrire les tests**

```ts
it("éligible : template de l'évènement dans la liste", async () => {});
it("éligible par héritage : l'évènement hérite du template de l'organisation, coché", async () => {});
it("non éligible : template hors liste", async () => {});
it("envoi ONSITE avec un template hors liste : 409 ONSITE_TEMPLATE_UNSUITABLE, la demande reste DRAFT", async () => {});
it("envoi ONSITE : marginPercent = 10 ; passer la marge par défaut à 15 ne change pas la demande envoyée", async () => {});
it("envoi ADVANCE : marginPercent reste null", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `onsite.ts`, l'accroche A1 et l'état désactivé de l'assistant.
- [ ] **Step 4 : lancer** — attendu : PASS (et tests d'envoi du plan 33 toujours verts).
- [ ] **Step 5 : commit** — `feat(impression): template adapte exige pour une demande sur place`.

## Task 5 — Template devenu inadapté : alerte et blocage de l'avancement

**Files :**
- Modify : `src/lib/print-requests/onsite.ts`, routes
  `src/app/api/platform/print/requests/[requestId]/send-quote/route.ts` et `…/status/route.ts`
  (plan 33, accroche A2, `OnsiteError` → `onsiteErrorResponse`), pages de la demande
  `src/app/event/[eventId]/print/[requestId]/page.tsx` et
  `src/app/platform/print/requests/[requestId]/page.tsx` (plan 33)
- Create : `src/components/print/OnsiteTemplateAlert.tsx`
- Test : `src/lib/__tests__/print-requests-onsite.test.ts` (compléter), test de la route de
  statut du plan 33 (compléter)

**Interfaces :**
- Produces :
  - `onsiteTemplateStatus(request: { type: PrintRequestType; parentRequestId: string | null;
    badgeTemplateId: string | null }): Promise<"OK" | "UNSUITABLE" | "NOT_APPLICABLE">` — lit
    la copie du template de la demande (mise à jour par `syncRequestTemplates` du plan 33
    quand l'évènement change de template) ; copie absente (`DRAFT`) → `NOT_APPLICABLE`.
  - `assertOnsiteCanAdvance(request: same): Promise<void>` — `UNSUITABLE` → `OnsiteError(
    "ONSITE_TEMPLATE_UNSUITABLE", 409)`. Refus et annulation ne passent pas par là.
  - `OnsiteTemplateAlert({ side: "ORGANIZER" | "STAFF"; eventId: string })` — organisateur :
    « Le modèle de badge choisi n'est pas adapté à l'impression sur place. L'équipe Badge ne
    peut pas avancer cette demande. » + lien vers le réglage du template ; staff : « Template
    non adapté : l'avancement est bloqué jusqu'au retour à un template adapté. »

- [ ] **Step 1 : écrire les tests** — `OK` ; `NOT_APPLICABLE` pour `ADVANCE` et pour une
  demande complémentaire ; `UNSUITABLE` après retrait du template de la liste ; route staff :
  envoi du devis et `PAID → IN_PRODUCTION` → 409 `ONSITE_TEMPLATE_UNSUITABLE`, statut
  inchangé ; refus d'une demande `SUBMITTED` toujours permis.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** et afficher l'alerte des deux côtés quand le statut vaut
  `UNSUITABLE`.
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): blocage d'une demande sur place au template inadapte`.

## Task 6 — QR d'accueil : email d'approbation et page participant

**Files :**
- Create : `src/lib/registration-qr.ts`, `src/app/api/public/qr/[registrationId]/route.ts`
- Modify : `src/lib/qrcode.ts`, `src/lib/badge-templates/build-context.ts`,
  `src/app/api/org/[orgId]/events/[eventId]/scan/verify/route.ts`, `src/lib/mail.ts`
  (`sendStatusNotification`, branche `APPROVED`),
  `src/app/account/registrations/[id]/page.tsx`
- Test : `src/lib/__tests__/registration-qr.test.ts`,
  `src/app/api/__tests__/public-qr.test.ts`, `src/lib/__tests__/mail.test.ts` (compléter) ;
  `build-context.test.ts` et `api-event-scan.test.ts` restent verts

**Interfaces :**
- Produces :
  - `registrationVerifyUrl(baseUrl: string, registrationId: string): string` →
    `${baseUrl sans / final}/verify/${encodeURIComponent(id)}` (utilisée par
    `build-context.ts` à la place de la ligne actuelle).
  - `parseRegistrationQr(payload: string): string` — l'`extractBadgeId` de la route de scan,
    déplacé et exporté.
  - `generateQRCodePng(data: string): Promise<Buffer>` (mêmes options que la data URL).
  - `GET /api/public/qr/[registrationId]` → `image/png` du QR de `registrationVerifyUrl` ;
    404 si l'inscription n'existe pas ou n'est pas `APPROVED` ; `Cache-Control: public,
    max-age=86400`. (Une image hébergée, car les clients mail bloquent les images `data:`.)
  - Email d'approbation : bloc « Votre QR d'accueil » — `<img
    src="{base}/api/public/qr/{id}" width="200" alt="QR d'accueil">`, l'ID en clair, « À
    présenter à l'accueil, sur votre téléphone ou imprimé », lien vers
    `/account/registrations/{id}`. La phrase actuelle sur le badge est conservée.
  - Page participant, inscription `APPROVED` : carte « QR d'accueil » (data URL de
    `generateQRCodeDataURL`, ID en clair, même consigne).

- [ ] **Step 1 : écrire les tests**

```ts
it("registrationVerifyUrl('https://badge.example/', 'EV-1/2') -> 'https://badge.example/verify/EV-1%2F2'", () => {});
it("parseRegistrationQr('https://badge.example/verify/C01-20261115-0007') -> 'C01-20261115-0007'", () => {});
it("parseRegistrationQr('  C01-20261115-0007 ') -> 'C01-20261115-0007'", () => {});
it("GET /api/public/qr : 200 image/png commençant par 89 50 4E 47 pour une inscription APPROVED", async () => {});
it("GET /api/public/qr : 404 pour PENDING et pour un ID inconnu", async () => {});
it("email d'approbation : contient /api/public/qr/<id>, l'ID en clair et /account/registrations/<id>", async () => {});
it("email de rejet : ne contient pas /api/public/qr/", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** ; la route de scan et `build-context.ts` importent les
  helpers (aucun changement de comportement).
- [ ] **Step 4 : lancer** — attendu : PASS, y compris les tests existants de scan et de
  contexte.
- [ ] **Step 5 : navigateur** — approuver une inscription du seed ; l'email dans Mailpit
  affiche le QR ; la page du compte aussi ; scanner l'image avec le scanner de l'évènement :
  « Accès autorisé ».
- [ ] **Step 6 : commit** — `feat(inscriptions): QR d'accueil dans l'email et le compte`.

## Task 7 — Compteur et plafond (pur)

**Files :**
- Create : `src/lib/print-requests/onsite-counter.ts`
- Test : `src/lib/__tests__/print-requests-onsite-counter.test.ts`

**Interfaces :**
- Produces :
  - `onsiteCap(ordered: number, marginPercent: number): number`
  - `type OnsiteCounterLevel = "NORMAL" | "WARNING" | "OVER" | "CAP_REACHED"`
  - `type OnsiteCounter = { ordered: number; marginPercent: number; cap: number; printed:
    number; beyondOrder: number; remainingToCap: number; level: OnsiteCounterLevel }`
  - `computeOnsiteCounter(input: { ordered: number; marginPercent: number; printed: number }):
    OnsiteCounter` — `CAP_REACHED` si `printed >= cap` ; sinon `OVER` si `printed > ordered` ;
    sinon `WARNING` si `printed × 10 >= ordered × 9` ; sinon `NORMAL`.
  - `orderedBadgeLine(lines: Array<{ kind: string; quantity: number; unitPrice: number;
    removedAt: Date | null; product: { kind: string } | null }>): { quantity: number;
    unitPrice: number } | null`

- [ ] **Step 1 : écrire les tests**

```ts
it("plafond : 200 et 10 % -> 220 ; 200 et 0 % -> 200 ; 7 et 10 % -> 8 (arrondi supérieur)", () => {});
it("179 imprimés sur 200 -> NORMAL ; 180 -> WARNING ; 200 -> WARNING", () => {});
it("212 imprimés sur 200 à 10 % -> OVER, beyondOrder 12, remainingToCap 8", () => {});
it("220 imprimés -> CAP_REACHED, remainingToCap 0", () => {});
it("orderedBadgeLine : ignore les accessoires et les lignes retirées -> { quantity: 200, unitPrice: 1500 }", () => {});
it("orderedBadgeLine : aucune ligne BADGE -> null", () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): compteur et plafond de l'impression sur place`.

## Task 8 — Poste d'impression : recherche, QR, impression journalisée

**Files :**
- Create : `src/lib/print-requests/onsite-station.ts`
- Test : `src/lib/__tests__/print-requests-onsite-station.test.ts`

**Interfaces :**
- Consumes : `OnsiteError` (Task 4), `computeOnsiteCounter`, `orderedBadgeLine` (Task 7),
  `parseRegistrationQr` (Task 6), `notifyBadgePrinted`
  (`src/lib/notifications/triggers.ts`), `sendBadgePrintedNotification` (`src/lib/mail.ts`).
- Produces :
  - `type OnsiteRegistrationCard = { id: string; firstName: string; lastName: string; email:
    string; photoKey: string; status: RegistrationStatus; category: { name: string; color:
    string }; badgePrinted: boolean; badgePrintedAt: Date | null }`
  - `loadOnsiteRequest(requestId: string): Promise<{ request: PrintRequest; orgId: string;
    eventId: string; counter: OnsiteCounter }>` — `NOT_FOUND` (404) ; `NOT_ONSITE` (409) pour
    `ADVANCE` ou une demande complémentaire. Sans ligne `BADGE`, `ordered` vaut
    `estimatedQuantity`.
  - `lookupOnsiteRegistration(requestId: string, payload: string):
    Promise<OnsiteRegistrationCard>` — `REGISTRATION_NOT_FOUND` (404), `FOREIGN_EVENT` (404,
    « Ce QR ne correspond pas à cet évènement. »), `NOT_APPROVED` (409, `details: { status }`).
  - `searchOnsiteRegistrations(requestId: string, q: string):
    Promise<OnsiteRegistrationCard[]>` — `q` de 2 caractères au moins (sinon `[]`) ; prénom,
    nom ou email contenant `q`, ou ID commençant par `q` ; inscriptions de l'évènement, tous
    statuts ; 20 au plus, triées par nom puis prénom.
  - `recordOnsitePrint(input: { requestId: string; registrationId: string; userId: string;
    confirmReprint: boolean }): Promise<{ print: PrintRequestPrint; counter: OnsiteCounter }>`
    — transaction : `SELECT id FROM PrintRequest WHERE id = ? FOR UPDATE` ; statut hors
    `PAID | IN_PRODUCTION | READY` → `REQUEST_NOT_PRINTABLE` (409) ; contrôles d'évènement et
    de statut comme `lookup` ; déjà imprimé (`badgePrinted`) sans `confirmReprint` →
    `ALREADY_PRINTED` (409, `details: { printedAt }`) ; avec → ligne `reprint: true` ;
    impression comptée alors que `printed >= cap` → `CAP_REACHED` (409) ; met
    `badgePrinted` / `badgePrintedAt` à jour. Après la transaction, **première impression
    seulement** : `notifyBadgePrinted([id], userId)` puis `sendBadgePrintedNotification(id)`
    (erreur d'email journalisée, non bloquante).

- [ ] **Step 1 : écrire les tests** (demande `IN_PRODUCTION`, ligne `BADGE` de 10 à 1 500,
  marge 10 % → plafond 11 ; les impressions déjà faites sont posées par `createMany` avec
  `registrationId: null`)

```ts
it("lookup par URL de QR : fiche avec nom, catégorie, statut APPROVED", async () => {});
it("lookup d'une inscription d'un autre évènement : FOREIGN_EVENT 404", async () => {});
it("lookup d'une inscription PENDING : NOT_APPROVED 409 avec status 'PENDING'", async () => {});
it("search 'dup' trouve « Dupont » et « dupuis@x.org », 'C01-2026' trouve par ID, 'd' -> []", async () => {});
it("impression : 201, badgePrinted vrai, compteur printed 1, notification et email mis en file", async () => {});
it("10 déjà comptées : la 11e passe (CAP_REACHED), la 12e est refusée CAP_REACHED", async () => {});
it("au plafond, une réimpression confirmée passe et ne compte pas (printed reste 11)", async () => {});
it("badge imprimé par l'organisateur : ALREADY_PRINTED sans confirmation ; reprint avec", async () => {});
it("demande QUOTED : REQUEST_NOT_PRINTABLE", async () => {});
it("deux impressions concurrentes à 10/11 : une seule passe", async () => {
  // Promise.allSettled de deux recordOnsitePrint sur deux inscriptions -> 1 fulfilled, 1 rejected CAP_REACHED
});
it("loadOnsiteRequest : NOT_ONSITE pour une demande ADVANCE et pour une demande complémentaire", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): poste d'impression journalise`.

## Task 9 — API du poste et réglage de la marge

**Files :**
- Create : `src/app/api/platform/print/requests/[requestId]/onsite/lookup/route.ts`,
  `…/onsite/search/route.ts`, `…/onsite/print/route.ts`, `…/onsite/margin/route.ts`
- Modify : `src/lib/print-requests/onsite-station.ts`, `src/lib/print-requests/thread.ts`
  (plan 33 : `ONSITE_MARGIN_CHANGED` dans `ThreadEventType`, texte « Marge : {from} % →
  {to} % ({reason}) »)
- Test : `src/lib/__tests__/api-platform-print-onsite.test.ts`

**Interfaces :**
- Consumes : Task 8, `appendThreadEvent` (plan 33, acteur `{ userId, side: "STAFF" }`).
- Produces :
  - `POST …/onsite/lookup` `{ payload: string (1–2000) }` → 200 `{ registration }`
    (`STAFF_SUPPORT`).
  - `GET …/onsite/search?q=` → 200 `{ registrations }` (`STAFF_SUPPORT`).
  - `POST …/onsite/print` `{ registrationId: string; confirmReprint?: boolean }` → 201
    `{ print, counter, pdfUrl }` avec `pdfUrl = /api/org/{orgId}/events/{eventId}/badges/{id}`
    (`STAFF_SUPPORT`) ; log `BADGE_PRINTED` `{ printRequestId, reprint }`.
  - `setOnsiteMargin(input: { requestId: string; marginPercent: number; reason: string;
    userId: string }): Promise<OnsiteCounter>` — `MARGIN_BELOW_PRINTED` (409) si le nouveau
    plafond est inférieur aux impressions comptées ; entrée du fil `ONSITE_MARGIN_CHANGED`
    `{ from, to, reason }`.
  - `PATCH …/onsite/margin` `{ marginPercent: 0–100; reason: 3–500 caractères }` → 200
    `{ counter }` (`STAFF_ADMIN`) ; log `PRINT_REQUEST_MARGIN_RAISED` `{ from, to, reason }`.
  - Toute `OnsiteError` → `onsiteErrorResponse`.

- [ ] **Step 1 : écrire les tests** — par route : 401, 403 `STAFF_OBSERVER` (marge : 403
  `STAFF_SUPPORT`), 400 corps invalide, cas nominal ; `print` → 201, `pdfUrl` attendu, log
  `BADGE_PRINTED` avec `reprint: false` ; 409 `CAP_REACHED` relayé ; marge : 200 commandés,
  220 comptés, passer de 10 à 15 % → plafond 230, fil et log `{ from: 10, to: 15 }` ; passer à
  5 % → 409 `MARGIN_BELOW_PRINTED` ; motif absent → 400.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): API du poste d'impression sur place`.

## Task 10 — Écran du poste, compteur des deux côtés

**Files :**
- Create : `src/components/event/QrCamera.tsx`, `src/components/print/OnsiteCounterCard.tsx`,
  `src/components/staff/print/OnsiteStation.tsx`,
  `src/components/staff/print/OnsiteMarginForm.tsx`,
  `src/app/platform/print/requests/[requestId]/onsite/page.tsx`
- Modify : `src/components/event/QRScanner.tsx`, pages de la demande org et staff (plan 33)
- Test : `src/components/print/__tests__/OnsiteCounterCard.test.tsx`

**Interfaces :**
- Consumes : API Task 9, `loadOnsiteRequest` (Task 8), `ScannerFrame`, `DocumentPreview`,
  `BadgeDocumentView` / `badgeDocumentUrl`.
- Produces :
  - `QrCamera({ elementId: string; onDecode: (text: string) => void })` — la logique
    `html5-qrcode` sortie de `QRScanner`, qui l'utilise désormais (comportement inchangé).
  - `OnsiteCounterCard({ counter: OnsiteCounter })` — « 212 / 200 badges imprimés »,
    barre de progression ; `WARNING` : « 90 % de la commande atteinte » ; `OVER` : « 12 badges
    au-delà de la commande, facturés après l'évènement » ; `CAP_REACHED` : « Plafond atteint
    (220) : l'impression est bloquée ».
  - Page du poste (`STAFF_SUPPORT`, sinon redirection vers la demande) : en-tête (référence,
    évènement, lieu, note de l'imprimante), compteur, caméra (`QrCamera` dans
    `ScannerFrame`), recherche (nom, email ou ID ; saisie d'un contenu de QR acceptée), fiche
    (photo, nom, catégorie, aperçu du badge), bouton « Imprimer » ; refus affichés en clair ;
    badge déjà imprimé → « Déjà imprimé le … » et bouton « Réimprimer ».
  - « Imprimer » : `window.open("about:blank")` **au clic**, puis `POST …/print` ; succès →
    l'onglet reçoit `pdfUrl`, le compteur se met à jour ; refus → l'onglet se ferme, toast
    d'erreur.
  - Page staff de la demande : `OnsiteCounterCard`, bouton « Ouvrir le poste d'impression »
    (statuts `PAID`, `IN_PRODUCTION`, `READY`), `OnsiteMarginForm` (`STAFF_ADMIN` : marge et
    motif). Page organisateur : `OnsiteCounterCard`.

- [ ] **Step 1 : écrire le test du composant** — les quatre niveaux affichent les textes
  ci-dessus pour (179, 200, 10), (180, 200, 10), (212, 200, 10), (220, 200, 10).
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `QrCamera` (puis `QRScanner` dessus), les composants et les
  pages.
- [ ] **Step 4 : lancer** — attendu : PASS ; `e2e/event/scan.spec.ts` toujours vert.
- [ ] **Step 5 : navigateur** (téléphone réel ou webcam, 375 px et 1280 px) : scanner le QR
  d'accueil d'un participant du seed, imprimer, voir le compteur monter ; QR d'un autre
  évènement refusé ; le PDF s'ouvre (popup non bloquée).
- [ ] **Step 6 : `make lint && make typecheck`.**
- [ ] **Step 7 : commit** — `feat(impression): ecran du poste d'impression sur place`.

## Task 11 — Crédit d'impression : solde, application, dépense au paiement

**Files :**
- Create : `src/lib/print-requests/org-credit.ts`,
  `src/app/api/platform/print/requests/[requestId]/credit/route.ts`
- Modify (accroche A4) : `src/lib/payments.ts` (branche `PRINT_REQUEST` de
  `confirmPayment`, plan 34) et `src/lib/print-requests/quote.ts` (`markPaidManually`, plan
  33 — seul passage manuel en `PAID`, la route `…/mark-paid` n'est pas touchée) ;
  `src/lib/print-requests/thread.ts` (plan 33 : `ORG_CREDIT_APPLIED` « Crédit d'impression
  appliqué : {F(amount)} », `ORG_CREDIT_SPENT` « Crédit d'impression décompté : {F(amount)} »)
- Test : `src/lib/__tests__/print-requests-org-credit.test.ts`,
  `src/lib/__tests__/api-platform-print-credit.test.ts`, tests de `confirmPayment`
  (`payments-print-request.test.ts`, plan 34) et de `markPaidManually`
  (`print-requests-quote.test.ts`, plan 33) (compléter)

**Interfaces :**
- Consumes : `OnsiteError` (Task 4), `applyEdit`, `recomputeTotal`, `appendThreadEvent`,
  `notifyPrintRequestStatusChanged` (plan 33), `markPaid` (plan 33, via ses deux appelants).
- Produces :
  - `getOrgPrintCreditBalance(orgId: string): Promise<number>` — somme des `amount`.
  - `getAvailableOrgPrintCredit(orgId: string, excludeRequestId?: string): Promise<number>` —
    solde − crédits réservés (lignes `usesOrgCredit`, non retirées, des demandes de l'org en
    `SUBMITTED | QUOTED | ACCEPTED`).
  - `listOrgPrintCreditMovements(orgId: string): Promise<Array<{ id: string; kind:
    OrgPrintCreditKind; amount: number; quantity: number | null; createdAt: Date; request: {
    id: string; reference: string; eventId: string } }>>` (plus récent d'abord).
  - `applyOrgCredit(input: { requestId: string; amount: number; userId: string }):
    Promise<{ line: PrintQuoteLine; revised: boolean }>` — transaction, `SELECT id FROM Organization WHERE id = ? FOR
    UPDATE` ; statut hors `SUBMITTED | QUOTED` → `REQUEST_LOCKED` (409) ; `amount` >
    disponible (hors cette demande) → `CREDIT_INSUFFICIENT` (409) ; `amount` > total des
    autres lignes → `CREDIT_EXCEEDS_TOTAL` (409) ; retire (`removedAt`) l'éventuelle ligne de
    crédit précédente ; crée `{ kind: "DISCOUNT", label: "Crédit d'impression", quantity: 1,
    unitPrice: -amount, lineTotal: -amount, addedBy: "STAFF", usesOrgCredit: true }` ;
    `applyEdit(tx, request, "STAFF", userId)` (`QUOTED → SUBMITTED` + `QUOTE_REVISION`,
    comme toute modification de lignes du plan 33) ; `recomputeTotal` ; fil
    `ORG_CREDIT_APPLIED` `{ amount }` (acteur `{ userId, side: "STAFF" }`) ; `revised` =
    départ `QUOTED`.
  - `spendOrgCreditForPaidRequest(tx: Prisma.TransactionClient, requestId: string):
    Promise<number>` — appelée par les deux appelants de `markPaid` (accroche A4) quand il
    renvoie `true` ; ligne de crédit présente : mouvement `SPENT` de `lineTotal` (négatif),
    ignoré s'il existe déjà ; fil `ORG_CREDIT_SPENT` ; renvoie le montant dépensé (0 sinon).
  - `POST /api/platform/print/requests/[requestId]/credit` `{ amount: entier ≥ 1 }` → 201
    `{ line, available }` (`STAFF_ADMIN`) ; log `PRINT_CREDIT_APPLIED` `{ amount }` ; si
    `revised`, `notifyPrintRequestStatusChanged(requestId, userId, { organizer: true, staff:
    false })` comme les routes de lignes du plan 33.

- [ ] **Step 1 : écrire les tests** (org avec un mouvement `EARNED` de 45 000 ; demande
  `SUBMITTED` de 60 000)

```ts
it("solde 45 000, disponible 45 000", async () => {});
it("appliquer 45 000 : ligne -45 000, total 15 000, disponible 0, solde toujours 45 000", async () => {});
it("une seconde demande ne peut pas réutiliser ce crédit : CREDIT_INSUFFICIENT", async () => {});
it("la première demande annulée avant paiement : disponible revient à 45 000", async () => {});
it("crédit de 100 000 appliqué à 70 000 sur une demande de 60 000 : CREDIT_EXCEEDS_TOTAL", async () => {});
it("réappliquer 20 000 remplace la ligne précédente (une seule ligne active)", async () => {});
it("demande QUOTED : repasse SUBMITTED avec entrée QUOTE_REVISION ; demande ACCEPTED : REQUEST_LOCKED", async () => {});
it("paiement confirmé : mouvement SPENT -45 000, solde 0 ; webhook rejoué : un seul mouvement", async () => {});
it("paiement hors ligne (marquer payé) : même dépense", async () => {});
it("route : 401, 403 STAFF_SUPPORT, 400 montant 0, 201 + log PRINT_CREDIT_APPLIED", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `org-credit.ts`, la route et l'accroche A4 (dans la même
  transaction que le passage à `PAID`).
- [ ] **Step 4 : lancer** — attendu : PASS (tests de paiement des abonnements toujours verts).
- [ ] **Step 5 : commit** — `feat(impression): credit d'impression de l'organisation`.

## Task 12 — Clôture : crédit ou demande complémentaire

**Files :**
- Create : `src/lib/print-requests/close-onsite.ts`
- Modify : `src/app/api/platform/print/requests/[requestId]/status/route.ts` (plan 33,
  accroche A3), `src/lib/print-requests/thread.ts` (plan 33 : `ONSITE_CREDIT_EARNED`
  « {quantity} badges non utilisés : {F(amount)} versés au crédit d'impression »,
  `ONSITE_SUPPLEMENT_CREATED` « Demande complémentaire {reference} : {extraBadges} badges
  supplémentaires »)
- Test : `src/lib/__tests__/print-requests-close-onsite.test.ts`,
  `src/lib/__tests__/api-platform-print-requests.test.ts` (plan 33, route de statut,
  compléter)

**Interfaces :**
- Consumes : `orderedBadgeLine` (Task 7), `OnsiteError` (Task 4), `appendThreadEvent`,
  `nextReference(tx, now)` et `notifyPrintRequestQuoted(requestId, actorId)` du plan 33
  (accroche A5).
- Produces :
  - `type OnsiteClosure = { outcome: "CREDIT"; amount: number; unusedBadges: number } |
    { outcome: "SUPPLEMENT"; supplementRequestId: string; extraBadges: number; total: number }
    | { outcome: "NONE" }`
  - `closeOnsiteRequest(requestId: string): Promise<OnsiteClosure>` — exige `ONSITE`, sans
    parent, `COMPLETED` (sinon `NOT_CLOSABLE`, 409) ; `printed` = journal hors `reprint` ;
    - moins que commandé → `OrgPrintCredit` `EARNED` (`amount = non utilisés × unitPrice`,
      `quantity`, `unitPrice`), fil `ONSITE_CREDIT_EARNED`, log `PRINT_CREDIT_EARNED` ;
    - plus que commandé → demande complémentaire (**créée** directement en `QUOTED`, ce qui
      n'est pas une transition) : `reference = nextReference(tx, now)`, même évènement,
      org, auteur et copie du template, `type: "ONSITE"`, `parentRequestId`, `status:
      "QUOTED"`, `quoteVersion: 1`, `submittedAt` et `quotedAt`, une ligne `PRODUCT`
      « Badges supplémentaires » (même `productId`, `optionsSnapshot` et `choices`,
      `addedBy: "STAFF"`, `quantity = surplus`, même `unitPrice`), `total` ; fil
      `ONSITE_SUPPLEMENT_CREATED` sur les deux demandes ; log
      `PRINT_REQUEST_SUPPLEMENT_CREATED` ; la notification `PRINT_REQUEST_QUOTED` est
      envoyée par la route (A3) après la transaction :
      `notifyPrintRequestQuoted(supplementRequestId, userId)` ;
    - égal, ou aucune ligne `BADGE` → `NONE`.
    - Rejouée : renvoie le résultat existant sans rien créer.
  - Accroche A3 : après validation du passage à `COMPLETED` d'une demande `ONSITE` sans
    parent, appel de `closeOnsiteRequest` ; le résultat est renvoyé dans la réponse
    (`closure`).

- [ ] **Step 1 : écrire les tests**

```ts
it("200 commandés à 1 500 FCFA, 170 imprimés + 5 réimpressions : CREDIT 45 000, unusedBadges 30", async () => {
  // mouvement EARNED { amount: 45000, quantity: 30, unitPrice: 1500 } ; getOrgPrintCreditBalance(org) === 45000
});
it("rejouée : même résultat, un seul mouvement", async () => {});
it("200 commandés, marge 10 %, 212 imprimés : SUPPLEMENT de 12 badges, total 18 000", async () => {
  // enfant : status QUOTED, parentRequestId = parent.id, ligne « Badges supplémentaires » quantity 12 unitPrice 1500
});
it("rejouée : aucune seconde demande complémentaire", async () => {});
it("200 imprimés sur 200 : NONE, rien n'est créé", async () => {});
it("demande READY : NOT_CLOSABLE ; demande complémentaire : NOT_CLOSABLE", async () => {});
it("route de statut READY -> COMPLETED sur une demande sur place : closure dans la réponse, crédit créé", async () => {});
```

- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** `closeOnsiteRequest` (transaction, contrôles d'existence pour
  l'idempotence) et l'accroche A3.
- [ ] **Step 4 : lancer** — attendu : PASS.
- [ ] **Step 5 : commit** — `feat(impression): cloture d'une demande sur place`.

## Task 13 — Écrans du crédit et des demandes complémentaires

**Files :**
- Create : `src/components/print/OrgPrintCreditCard.tsx`,
  `src/components/staff/print/ApplyCreditDialog.tsx`
- Modify (plan 33) : `src/app/event/[eventId]/print/page.tsx` (liste des demandes),
  `src/components/event/print/PrintRequestWizard.tsx` (récapitulatif),
  `src/app/event/[eventId]/print/[requestId]/page.tsx`,
  `src/app/platform/print/requests/[requestId]/page.tsx`
- Test : `src/components/print/__tests__/OrgPrintCreditCard.test.tsx`

**Interfaces :**
- Consumes : `getOrgPrintCreditBalance`, `getAvailableOrgPrintCredit`,
  `listOrgPrintCreditMovements` (Task 11), API Task 11.
- Produces :
  - `OrgPrintCreditCard({ balance: number; movements: … })` — « Crédit d'impression :
    45 000 FCFA » ; mouvements « + 45 000 FCFA — 30 badges non utilisés — IMP-… » et
    « − 45 000 FCFA — appliqué à IMP-… » ; solde nul sans mouvement → carte masquée.
  - Liste `/event/[eventId]/print` : la carte, au-dessus des demandes.
  - Récapitulatif de l'assistant, disponible > 0 : « Votre organisation dispose de 45 000 FCFA
    de crédit d'impression ; l'équipe Badge pourra l'appliquer à ce devis. »
  - Page staff de la demande : « Crédit disponible de l'organisation : X FCFA » et
    `ApplyCreditDialog` (`STAFF_ADMIN`, statuts `SUBMITTED | QUOTED`, montant pré-rempli
    `min(disponible, total)`).
  - Liens croisés : parent « Demande complémentaire IMP-… » ; enfant « Complément de
    IMP-… » ; une demande complémentaire n'affiche ni compteur ni poste.

- [ ] **Step 1 : écrire le test du composant** — 45 000 de solde avec un mouvement `EARNED`
  et un `SPENT` : textes ci-dessus (montants formatés avec `Intl.NumberFormat("fr-FR")`) ;
  solde 0 sans mouvement : rien n'est rendu.
- [ ] **Step 2 : lancer** — attendu : FAIL.
- [ ] **Step 3 : implémenter** la carte, la boîte de dialogue et les ajouts de pages.
- [ ] **Step 4 : lancer** — attendu : PASS ; `make lint && make typecheck`.
- [ ] **Step 5 : navigateur** — clôturer une demande sur place du seed avec moins de badges
  imprimés que commandés : le crédit apparaît côté org ; l'appliquer à une nouvelle demande ;
  payer en sandbox : le solde baisse.
- [ ] **Step 6 : commit** — `feat(impression): ecrans du credit et des demandes complementaires`.

## Task 14 — E2E et documentation

**Files :**
- Create : `e2e/platform/print-request-onsite.spec.ts`,
  `docs/v4/features/impression-sur-place.md`
- Modify : `e2e/platform/settings.spec.ts`, `e2e/public/account-registration.spec.ts`,
  `e2e/event/print.spec.ts` (assistant, plan 33), `e2e/helpers/db.ts` (`createTestPrintRequest`
  du plan 33 étendu : demande sur place payée, impressions du journal), `docs/v4/README.md`

**Interfaces :**
- Consumes : tout ce qui précède. Règles `e2e/README.md` : un fichier par page, aucun
  `page.request`, `loginAndEnter`, URL assertée, chaque action vérifie sa réponse (UI + base).

- [ ] **Step 1 : `settings.spec.ts`** — `STAFF_ADMIN` coche un template dans « Impression sur
  place », règle 15 %, enregistre ; la base le reflète ; `STAFF_SUPPORT` ne voit pas l'onglet.
- [ ] **Step 2 : assistant** — template non adapté : option « Pendant l'évènement »
  désactivée, message et lien ; template adapté : une demande sur place s'envoie avec
  `marginPercent` 15.
- [ ] **Step 3 : `account-registration.spec.ts`** — inscription approuvée : carte « QR
  d'accueil » et ID visibles ; l'email Mailpit contient l'image `/api/public/qr/…`.
- [ ] **Step 4 : `print-request-onsite.spec.ts`** — `STAFF_SUPPORT` ouvre le poste depuis la
  demande (10 commandés, 10 %) ; saisie du contenu d'un QR d'accueil → fiche → « Imprimer » →
  compteur « 1 / 10 », `PrintRequestPrint` en base ; QR d'un autre évènement → « Ce QR ne
  correspond pas à cet évènement. » ; inscription en attente → refus avec son statut ;
  plafond atteint (11 posées par helper) → « Plafond atteint (11) » et bouton désactivé ;
  `STAFF_ADMIN` relève la marge avec motif → l'impression reprend.
- [ ] **Step 5 : lancer les e2e** — attendu : PASS.
- [ ] **Step 6 : documentation** — `features/impression-sur-place.md` (templates adaptés,
  QR d'accueil, poste, compteur et plafond, clôture, crédit, demande complémentaire, droits,
  limites) ; ligne dans `docs/v4/README.md`.
- [ ] **Step 7 : commit** — `docs(impression): impression pendant l'evenement`.

## Vérification finale

- [ ] `make lint && make typecheck && make test` (couverture 100 %).
- [ ] E2E des pages touchées, y compris `e2e/event/scan.spec.ts` (caméra extraite).
- [ ] Parcours réel : approbation → QR reçu par email → scan au poste depuis un téléphone →
  PDF imprimé sur l'imprimante de badges → clôture → crédit visible côté organisation.
- [ ] Les critères d'acceptation chiffrés de la spec (45 000 FCFA ; plafond 220 ; demande
  complémentaire de 12) sont couverts par des tests nommés (Tasks 7, 8, 12).

---

## Auto-relecture

- **Couverture de la spec** : onglet et templates adaptés (Tasks 2-3), pictogramme (3),
  assistant désactivé avec lien (4), marge copiée à l'envoi (4), alerte et blocage du staff
  après changement de template (5), QR d'accueil email + compte (6), poste avec scan,
  recherche, contrôles évènement / statut / déjà imprimé, réimpression non comptée (8-10),
  journal et compteur à 90 % et au dépassement (7, 10), plafond bloquant et marge relevée avec
  motif audité (8-9), crédit FCFA proposé, appliqué en `DISCOUNT`, décompté au paiement,
  restitué à l'annulation, plafonné au total (11, 13), clôture crédit ou complémentaire en
  `QUOTED` (12), exclusivité crédit / surplus (12), demande en amont + sur place sur un même
  évènement permise (aucun contrôle ajouté). Non-objectifs respectés (pas de pilote
  d'imprimante, pas d'inscription sur place, surplus facturé à la clôture seulement).
- **Cohérence des types** : `OnsiteError` / `OnsiteErrorCode` définis en Task 4 et seuls
  utilisés ensuite ; `OnsiteCounter` (Task 7) consommé par les Tasks 8-10 ; noms du contrat
  (`getOrgPrintCreditBalance`, `closeOnsiteRequest(requestId)`, champs `PlatformSettings`,
  `PrintRequestPrint`, `OrgPrintCredit`) repris à l'identique ; noms du plan 33
  (`applyEdit`, `recomputeTotal`, `nextReference`, `markPaid`, `markPaidManually`,
  `submitRequest`, `sendQuote`, `advanceStatus`, `notifyPrintRequestQuoted`,
  `notifyPrintRequestStatusChanged`, `ThreadEventType`) et du plan 34 (`confirmPayment`)
  écrits comme dans leurs plans.
- **Hypothèses à vérifier à l'exécution** : chemins des accroches A1-A5 (alignés sur les
  plans 33 et 34) ; la modification de lignes passe par `applyEdit(…, "STAFF", …)` (action
  `STAFF_EDIT` du plan 33) ; s'ils diffèrent dans le code, adapter l'appel, pas la règle.
- **Aucun « TBD »** ; les seuls algorithmes décrits (niveau du compteur, plafond, clôture,
  disponible du crédit) le sont parce que la signature ne les détermine pas.
