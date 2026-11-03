# Vague 2 · Lot 2c — Commande côté organisateur en conversation — Plan d'implémentation

> **Exécution :** sous-agent autonome, en parallèle des lots 2a et 2b, dans son worktree et sa
> stack : `scripts/agent-stack.sh up 2c feat/commandes-impression`. Toutes les commandes `make`
> se lancent **dans le worktree**. Sous-skill : `superpowers:executing-plans`. En exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du
> plan (voir la spec, « Organisation du travail ») ; en dehors, aucun commit sans demande explicite.

**Objectif :** transformer `/event/[eventId]/print/[requestId]` en page de conversation à trois
colonnes pour l'organisateur (résumé, fil, devis en lecture et actions), avec non-lus (liste,
menu « Impression », notifications) et rafraîchissement par polling. Implémentation **distincte**
de celle du staff.

**Spec :** [`specs/2026-11-02-36-v4-commandes-d-impression.md`](../specs/2026-11-02-36-v4-commandes-d-impression.md) (décisions 9, 10, 12, 13)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | API messages organisateur : polling et lecture | [x] | 2026-11-02 | GET ?after (400 si date invalide), markRead(at capture avant lecture) sauf staff en consultation ; POST au schéma strict (internal -> 400). Chevauchement 2 s + dédoublonnage : côté client (tâche 2). |
| 2 | Page conversation 3 colonnes | [~] | 2026-11-03 | Code écrit (page, order/*, thread-sync + test unitaire), typecheck OK ; e2e print-request-detail non concluant (hôte saturé, load > 90) — à rejouer. Non commité. |
| 3 | Non-lus : liste et menu de l'évènement | [~] | 2026-11-03 | Code écrit (liste, EventShell, layout, router.refresh à l'ouverture) ; e2e print-conversation.spec.ts écrit, jamais exécuté. Non commité. |
| 4 | e2e, doc, vérification | [ ] | | |

## Fichiers du lot (exclusifs)

Modifiables : `src/app/event/[eventId]/print/page.tsx`, `src/app/event/[eventId]/print/[requestId]/page.tsx`
(pas `edit/` ni `return/`), `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/messages/route.ts`,
`src/components/event/print/PrintRequestActions.tsx`, `PrintPayButton.tsx`, nouveaux composants
`src/components/event/print/order/**`, `src/components/event/EventShell.tsx` et
`src/app/event/[eventId]/layout.tsx` (compteur « Impression »), leurs tests,
`e2e/event/print-*.spec.ts` (hors `print-new` si non concerné), `docs/v4/features/impression-demandes.md`
(partie organisateur).
**En lecture seule** : `prisma/schema.prisma`, `src/lib/print-requests/**`, `src/lib/notifications/**`,
`src/components/print/**`, tout `src/app/platform/**` et `src/components/staff/**`. Besoin d'y
toucher → s'arrêter (NEEDS_CONTEXT).

## Global Constraints

- Tests : nouveaux tests écrits avec les fabriques `src/test/factories.ts` (vague 0) ; Vitest tourne sur la base de test (`make test`), jamais sur la base de dev ; pas de mock de Prisma.
- Contrats du socle : `listThread(requestId, "ORGANIZER", { after })` (sans notes internes),
  `markRead`, `unreadByRequest`, `countOrdersWithUnread(userId, "ORGANIZER", { eventId })`.
- L'organisateur ne voit **jamais** de note ni d'évènement interne, ni la planche.
- Le devis est en lecture ; actions selon le statut et le rôle actuels : accepter (OWNER),
  payer (`PrintPayButton`), annuler, modifier la commande (lien vers `edit/` tant que permis).
- Polling 10 s via `GET …/messages?after=`, suspendu onglet caché ; chaque réponse appelle
  `markRead`. Pas de bascule « note interne » dans la saisie.
- Les droits d'accès actuels (permission `print.request`) s'appliquent.

## Review Focus

- Un organisateur sans permission `print.request` ne voit ni l'entrée de menu ni le compteur.
- Le récapitulatif `QUOTE_SENT` (produit par le lot 2b) s'affiche comme un évènement lisible ; si
  2b n'est pas encore fusionné, l'ancien évènement s'affiche sans erreur.
- Compteur de menu limité à l'évènement courant.
- Mobile 375 px : colonnes empilées, saisie toujours accessible en bas du fil.

---

### Task 1: API messages organisateur

**Files:** Modify `src/app/api/org/[orgId]/events/[eventId]/print-requests/[requestId]/messages/route.ts` ; Test associé

- [ ] `GET ?after=<ISO>` → capturer `const at = new Date()` **avant** `listThread(…, "ORGANIZER", { after })`, puis `markRead(requestId, userId, at)`.
- [ ] Le client envoie `after` avec un chevauchement (plus grand `createdAt` reçu moins 2 s) et dédoublonne les entrées par `id`.
- [ ] Un `POST` avec `internal` est refusé (`400 VALIDATION`) — garde déjà dans `postMessage`,
  à couvrir par un test de route.

### Task 2: Page conversation

**Files:** `src/app/event/[eventId]/print/[requestId]/page.tsx`, `src/components/event/print/order/OrganizerOrderSummary.tsx`,
`OrganizerConversation.tsx`, `OrganizerComposer.tsx`, `OrganizerQuoteColumn.tsx` (réutilise
`QuoteLinesTable`, `PrintRequestActions`, `PrintPayButton`)

- [ ] Grille `lg:grid-cols-[280px_minmax(0,1fr)_340px]` ; gauche : référence, statut, type,
  nombre de badges, livraison ou dates sur place, total ; centre : fil (bulles organisateur à
  droite, staff à gauche, évènements centrés), pièces jointes (dépôt existant), saisie ;
  droite : devis en lecture, total, actions.
- [ ] Polling 10 s, défilement et indicateur « Nouveaux messages » comme côté staff (code
  propre au lot).

### Task 3: Non-lus organisateur

**Files:** `src/app/event/[eventId]/print/page.tsx`, `src/components/event/EventShell.tsx`, `src/app/event/[eventId]/layout.tsx`

- [ ] Liste des commandes : pastille de non-lus (`unreadByRequest`).
- [ ] Entrée de menu « Impression » : compteur `countOrdersWithUnread(userId, "ORGANIZER", { eventId })`
  (masqué à 0).

### Task 4: e2e, doc, vérification

- [ ] e2e : message staff reçu par polling ; pastille de non-lus puis lecture ; note interne
  créée en base invisible côté organisateur ; actions accepter / payer toujours fonctionnelles
  depuis la nouvelle page.
- [ ] Doc `impression-demandes.md` (partie organisateur).
- [ ] Dans le worktree : `make lint && make typecheck && make test`, e2e `e2e/event/print-*.spec.ts`,
  navigateur 375 / 1280 px. Rapport prêt à fusionner.
