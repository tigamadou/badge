# Vague 2 · Lot 2a — Planches par commande — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2b et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2a feat/commandes-impression` (vague 0). Toutes les commandes
> `make` se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`. En exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du
> plan (voir la spec, « Organisation du travail ») ; en dehors, aucun commit sans demande explicite.

**Objectif :** réserver les planches aux commandes payées, avec trois sous-pages (À traiter,
Générées, Génération libre) et **une planche sauvegardée par commande**, écrasée à la
regénération.

**Architecture :** l'écran `/platform/print/sheets` devient un groupe de sous-pages à onglets
(`TabLinks`). La génération rattachée à une commande réutilise la ligne unique
`PrintSheetGeneration` de la commande (contrainte posée par le socle) : regénérer la remet en
`PENDING`, le worker écrase le PDF sous une clé stable. La génération libre ne change pas.

**Spec :** [`specs/2026-11-02-36-v4-commandes-d-impression.md`](../specs/2026-11-02-36-v4-commandes-d-impression.md) (décisions 4 à 8)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | File des commandes : `order-queue.ts` | [x] | 2026-11-02 | order-queue.ts ; 7 tests |
| 2 | Génération par commande avec écrasement | [x] | 2026-11-02 | createGeneration ecrase la ligne unique (409 GENERATION_IN_PROGRESS) ; tests lib + API |
| 3 | Worker : clé stable et suppression de l'ancien fichier | [x] | 2026-11-02 | cle stable print-sheets/orders/<id>.pdf ; ancien fichier supprime apres succes |
| 4 | Sous-pages À traiter / Générées / Génération libre | [x] | 2026-11-02 | sous-pages pending/generated/free, OrderQueueTable, modale, GET /orders |
| 5 | e2e, doc, vérification | [x] | 2026-11-02 | e2e print-sheets (5) + print-request-detail (8) verts ; couverture 100% ; doc ; controle navigateur 375 px non fait |

## Fichiers du lot (exclusifs)

Modifiables : `src/app/platform/print/sheets/**`, `src/app/api/platform/print/sheets/**`,
`src/lib/print-sheets/generations.ts`, `src/lib/print-sheets/run-generation.ts`,
`src/lib/print-sheets/order-queue.ts` (nouveau), `src/components/staff/print/Generation*.tsx` et
nouveaux composants `src/components/staff/print/sheets/**`, leurs tests, `e2e/platform/print-sheets.spec.ts`,
`docs/v4/features/impression-planches.md` (sections Génération et Droits).
**En lecture seule** (contrats du socle) : `prisma/schema.prisma`, `src/lib/print-sheets/order-sheet.ts`,
`OrderSheetPanel.tsx`, `src/lib/print-requests/**`. Besoin d'y toucher → s'arrêter et le
signaler (statut NEEDS_CONTEXT).

## Global Constraints

- Tests : nouveaux tests écrits avec les fabriques `src/test/factories.ts` (vague 0) ; Vitest tourne sur la base de test (`make test`), jamais sur la base de dev ; pas de mock de Prisma.
- File de travail : commandes `type = ADVANCE`, `status ∈ {PAID, IN_PRODUCTION}`, non archivées.
- « À traiter » = sans génération `DONE` ; « Générées » = avec génération (`PENDING`, `RUNNING`,
  `DONE` ou `FAILED`), triées par dernière génération.
- Une planche par commande ; regénérer écrase (ligne et fichier). Une génération `RUNNING` ou
  `PENDING` refuse la regénération : `409 GENERATION_IN_PROGRESS`.
- Clé de fichier d'une commande : `print-sheets/orders/<requestId>.pdf`.
- La génération ne modifie pas le statut de la commande ; elle ajoute l'évènement de fil
  existant `SHEETS_GENERATED` (interne au staff) et l'activité `PRINT_SHEETS_GENERATED` avec
  `details.regenerated` à `true` lors d'un écrasement.
- Droits inchangés (`STAFF_SUPPORT` minimum pour générer et télécharger).

## Review Focus

- Regénérer avec un autre gabarit : l'ancien PDF n'est plus téléchargeable, le nouveau l'est,
  une seule ligne en base.
- Commande passée `READY` pendant une génération : la génération se termine normalement ; la
  commande sort des deux sous-pages (file = PAID/IN_PRODUCTION) mais sa planche reste
  accessible depuis la page de la commande (`OrderSheetPanel`).
- Échec du worker : la commande apparaît dans « Générées » avec l'erreur et un bouton Regénérer.
- Commande `ONSITE` payée : jamais dans les sous-pages.

---

### Task 1: File des commandes

**Files:** Create `src/lib/print-sheets/order-queue.ts` ; Test `src/lib/__tests__/print-order-queue.test.ts`

**Contrat :** `listOrdersToGenerate(): Promise<OrderQueueRow[]>` et
`listOrdersWithSheet(): Promise<OrderQueueRow[]>` avec
`type OrderQueueRow = { requestId; reference; status; eventId; eventTitle; orgName; badgeCount: number; badgePages: 1 | 2; paidAt: string | null; sheet: OrderSheetView | null }`
(`OrderSheetView` du socle).

- [ ] Tests (base réelle) : ADVANCE PAID sans génération → À traiter ; avec génération DONE →
  Générées ; ONSITE exclue ; READY exclue ; FAILED → Générées.

### Task 2: Génération par commande avec écrasement

**Files:** Modify `src/lib/print-sheets/generations.ts`, `src/app/api/platform/print/sheets/route.ts` ; Tests associés

- [ ] `createGeneration` avec `printRequestId` : si une ligne existe pour la commande →
  `409 GENERATION_IN_PROGRESS` si `PENDING|RUNNING`, sinon mise à jour de cette ligne (gabarit,
  snapshot, duplex imposé par le template, sélection, statut `PENDING`, compteurs remis à
  `null`, `attempts = 0`) ; sinon création. La commande doit être ADVANCE et PAID/IN_PRODUCTION
  (`ORDER_NOT_READY`, 409, sinon).
- [ ] Tests : création, écrasement, refus en cours, refus commande non payée.

### Task 3: Worker

**Files:** Modify `src/lib/print-sheets/run-generation.ts` ; Tests associés

- [ ] Pour une génération de commande : écriture sous `print-sheets/orders/<requestId>.pdf` ;
  si l'ancien `fileKey` diffère, suppression de l'ancien fichier après succès (via `storage.ts`).
  Générations libres inchangées.
- [ ] Tests : clé stable ; ancien fichier supprimé ; échec → ancien fichier conservé.

### Task 4: Sous-pages

**Files:** `src/app/platform/print/sheets/layout.tsx` (onglets), `page.tsx` (redirection vers
`pending`), `pending/page.tsx`, `generated/page.tsx`, `free/page.tsx` ; composants
`src/components/staff/print/sheets/OrderQueueTable.tsx`, `GenerateOrderSheetDialog.tsx`

- [ ] Onglets (`TabLinks`) : « À traiter » (avec compteur), « Générées », « Génération libre ».
- [ ] À traiter : tableau (référence → lien vers la commande, évènement, organisation, badges,
  recto-verso, payée le) + bouton « Générer » ouvrant une modale de choix du gabarit (aperçu
  `SheetPreview` avec le badge de la commande), qui appelle `POST /api/platform/print/sheets`.
- [ ] Générées : mêmes colonnes + état, gabarit, feuilles/pages, généré le, « Télécharger »,
  « Voir » (modale PDF, comme `OrderSheetPanel`), « Regénérer ». Polling léger (5 s) tant
  qu'une ligne est `PENDING|RUNNING`.
- [ ] Génération libre : l'écran actuel (`GenerationsScreen`), restreint à
  `printRequestId = null` pour l'historique.

### Task 5: e2e, doc, vérification

- [ ] e2e `print-sheets.spec.ts` : commande payée dans À traiter → Générer → apparaît dans
  Générées, PDF téléchargeable → Regénérer avec un autre gabarit → une seule ligne, nouveau
  gabarit affiché ; génération libre toujours fonctionnelle.
- [ ] Doc `impression-planches.md`.
- [ ] Dans le worktree : `make lint && make typecheck && make test`, `make test-e2e FILE=e2e/platform/print-sheets.spec.ts`,
  vérification navigateur sur `http://localhost:<AGENT_APP_PORT>` (375 / 1280 px).
- [ ] Rapport : fichiers touchés, résultats, captures ; prêt à fusionner.
