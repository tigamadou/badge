# Vague 2 · Lot 2b — Commande côté staff en conversation — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2c, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2b feat/commandes-impression`. Toutes les commandes `make`
> se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`. En exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du
> plan (voir la spec, « Organisation du travail ») ; en dehors, aucun commit sans demande explicite.

**Objectif :** transformer `/platform/print/orders/[requestId]` en page de conversation à trois
colonnes (résumé, fil, devis et actions), avec notes internes, modifications de prix tracées
dans le fil, non-lus (liste, menu, notifications) et rafraîchissement par polling.

**Spec :** [`specs/2026-11-02-36-v4-commandes-d-impression.md`](../specs/2026-11-02-36-v4-commandes-d-impression.md) (décisions 8 à 13)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | API messages staff : polling, notes internes, lecture | [x] | 2026-11-02 | GET ?after= + markRead(at), POST internal via toEntryDTO ; masquage du lien de planche pour STAFF_OBSERVER reporté à la Task 3 (UI) |
| 2 | Prix dans le fil : évènements internes et récapitulatif d'envoi | [x] | 2026-11-03 | LINES_CHANGED internes, une entrée par enregistrement (écriture directe : appendThreadEvent fusionne et ne relirait pas par polling) ; récapitulatif d'envoi = message STAFF visible organisateur après QUOTE_SENT (le corps d'un évènement est reconstruit côté organisateur, il ne peut pas le porter) ; instantané des lignes dans details.lines |
| 3 | Page conversation 3 colonnes | [x] | 2026-11-03 | RequestDetail recomposé (résumé / fil / devis) ; composants order/** ; lien de planche masqué pour STAFF_OBSERVER ; carte « Générations » remplacée par OrderSheetPanel ; e2e détail verts |
| 4 | Non-lus : liste et menu staff | [x] | 2026-11-03 | Pastille par commande (unreadByRequest) ; compteur menu = SUBMITTED + non-lus sans double compte ; menu rafraîchi après la première lecture du fil |
| 5 | e2e, doc, vérification | [x] | 2026-11-03 | e2e détail/liste/onsite 25 verts ; lint, typecheck, make test-coverage (292 fichiers, 3670 tests, gate 100 %) verts ; contrôle 1280 et 375 px sans débordement ; QuoteEditor compacté pour la colonne de 380 px |

## Fichiers du lot (exclusifs)

Modifiables : `src/app/platform/print/orders/page.tsx`, `src/app/platform/print/orders/[requestId]/page.tsx`
(pas `onsite/`), `src/app/api/platform/print/requests/[requestId]/messages/route.ts`,
`src/lib/print-requests/quote.ts`, `src/components/staff/print/RequestDetail.tsx`,
`RequestList.tsx`, `RequestStatusActions.tsx`, `QuoteEditor.tsx`, `RequestCreditPanel.tsx`,
nouveaux composants `src/components/staff/print/order/**`, `src/app/platform/layout.tsx`
(compteur du menu), leurs tests, `e2e/platform/print-request-detail.spec.ts`, `e2e/platform/print-requests.spec.ts`,
`docs/v4/features/impression-demandes.md` (partie staff).
**En lecture seule** : `prisma/schema.prisma`, `src/lib/print-requests/thread.ts`,
`read-state.ts`, `src/lib/print-sheets/order-sheet.ts`, `OrderSheetPanel.tsx`,
`src/components/print/**` (dont `PrintThread.tsx`, `QuoteLinesTable.tsx`), `StaffShell.tsx`,
tout `src/app/event/**` et `src/components/event/**`. Besoin d'y toucher → s'arrêter
(NEEDS_CONTEXT).

## Global Constraints

- Tests : nouveaux tests écrits avec les fabriques `src/test/factories.ts` (vague 0) ; Vitest tourne sur la base de test (`make test`), jamais sur la base de dev ; pas de mock de Prisma.
- Contrats du socle : `postMessage(… internal?)`, `listThread(requestId, audience, { after })`,
  `markRead`, `unreadByRequest`, `countOrdersWithUnread`, `getOrderSheet`, `<OrderSheetPanel>`.
- Une modification de ligne (ajout, modification, retrait, remise) = **un évènement interne**
  `LINES_CHANGED` (une entrée par enregistrement, plus de regroupement côté staff).
- L'envoi du devis (`sendQuote`) ajoute un évènement `QUOTE_SENT` **visible de l'organisateur**
  dont le corps récapitule les lignes ajoutées, modifiées et retirées depuis la version
  précédente et le nouveau total.
- Polling 10 s via `GET …/messages?after=`, suspendu quand l'onglet est caché
  (`document.visibilityState`) ; chaque réponse appelle `markRead`.
- Les droits existants s'appliquent (écriture du devis `STAFF_ADMIN`… voir les routes actuelles).

## Review Focus

- Note interne : jamais visible ni notifiée côté organisateur (vérifier aussi par l'API org).
- Deux onglets staff ouverts : les messages de l'un apparaissent dans l'autre sous 10 s, sans
  doublon.
- Un staff ne voit pas ses propres messages comme non lus.
- Écran 1280 px : les trois colonnes restent lisibles ; sous `lg`, empilement résumé → fil →
  devis.

---

### Task 1: API messages staff

**Files:** Modify `src/app/api/platform/print/requests/[requestId]/messages/route.ts` ; Test associé

- [ ] `GET ?after=<ISO>` → capturer `const at = new Date()` **avant** `listThread(…, "STAFF", { after })`, puis `markRead(requestId, userId, at)` (un message arrivé pendant la lecture n'est pas marqué lu).
- [ ] Le client envoie `after` avec un chevauchement (plus grand `createdAt` reçu moins 2 s) et dédoublonne les entrées par `id` (aucune entrée perdue entre deux polls).
- [ ] `POST` : le schéma zod accepte `internal?: boolean` et la réponse est construite par `toEntryDTO` (comme la route organisateur), donc `entry.internal` est renseigné.
- [ ] Le lien de téléchargement de la planche est masqué pour `STAFF_OBSERVER` (`/api/files` lui répond 403 sur `print-sheets/`).
- [ ] `POST` accepte `internal: boolean` (défaut `false`) ; notification organisateur seulement
  si non interne (garde déjà posée par le socle dans les triggers, à vérifier par test).

### Task 2: Prix dans le fil

**Files:** Modify `src/lib/print-requests/quote.ts` ; Tests associés

- [ ] `addStaffLine`, `updateStaffLine`, `removeStaffLine` : évènement `LINES_CHANGED` avec
  `internal: true` et le détail (`describeLineChange`) de la ligne concernée.
- [ ] `sendQuote` : évènement `QUOTE_SENT` non interne, corps = récapitulatif (lignes
  ajoutées / modifiées / retirées depuis la version `quoteVersion - 1`, total). Fonction pure
  `summarizeQuoteDiff(previous, current): string` testée à part.

### Task 3: Page conversation

**Files:** `src/app/platform/print/orders/[requestId]/page.tsx`, `src/components/staff/print/order/OrderSummaryColumn.tsx`,
`OrderConversation.tsx`, `OrderComposer.tsx`, `OrderQuoteColumn.tsx` (réutilise `QuoteEditor`,
`RequestStatusActions`, `RequestCreditPanel`, `OrderSheetPanel`)

- [ ] Grille `lg:grid-cols-[300px_minmax(0,1fr)_380px]` ; gauche : référence, statut, évènement,
  organisation, type, badges (nombre, recto-verso, template), livraison, dates, total accepté ;
  centre : fil (bulles staff à droite, organisateur à gauche, évènements système centrés, notes
  internes sur fond ambré « Note interne »), pièces jointes, saisie avec bascule « Note
  interne » ; droite : devis éditable, actions de statut, crédit, `OrderSheetPanel`.
- [ ] Polling 10 s, défilement automatique en bas à l'arrivée d'un message si l'utilisateur
  était déjà en bas, sinon indicateur « Nouveaux messages ».
- [ ] Le résumé et le devis se rafraîchissent après une action (`router.refresh()`).

### Task 4: Non-lus staff

**Files:** `src/app/platform/print/orders/page.tsx`, `src/components/staff/print/RequestList.tsx`, `src/app/platform/layout.tsx`

- [ ] Liste : pastille du nombre de non-lus par commande (`unreadByRequest`).
- [ ] Menu « Commandes » : compteur = commandes à traiter (calcul actuel) **+** commandes avec
  non-lus (`countOrdersWithUnread`), sans double comptage (union des identifiants).

### Task 5: e2e, doc, vérification

- [ ] e2e : note interne invisible côté organisateur ; message organisateur reçu côté staff par
  polling ; modification de prix → évènement interne ; envoi du devis → récapitulatif visible
  côté organisateur ; pastille de non-lus qui disparaît à l'ouverture.
- [ ] Doc `impression-demandes.md` (partie staff, vocabulaire « commande »).
- [ ] Dans le worktree : `make lint && make typecheck && make test`, e2e d'impression staff,
  navigateur 375 / 1280 px. Rapport prêt à fusionner.
