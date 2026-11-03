# Vague 1 — Socle des commandes d'impression — Plan d'implémentation

> **Exécution :** séquentielle, dans le dossier principal, après la vague 0 et avant la vague 2.
> Sous-skill : `superpowers:subagent-driven-development` (tâches dans l'ordre, un implémenteur à
> la fois) ou `superpowers:executing-plans`. En exécution automatisée (tâche planifiée), **un commit par tâche est autorisé** sur la branche du plan (voir la spec, « Organisation du travail ») ; en dehors, aucun commit sans demande explicite de
> l'utilisateur ; la vague 2 ne démarre qu'une fois ce socle **commité** sur
> `feat/commandes-impression`.

**Objectif :** poser tout ce que les lots parallèles partagent — schéma, helpers du fil et des
non-lus, panneau de planche d'une commande, renommage « commande », nouvelles URL, menu et liste
des gabarits — pour qu'en vague 2 aucun lot ne touche `schema.prisma` ni un fichier d'un autre.

**Spec :** [`specs/2026-11-02-36-v4-commandes-d-impression.md`](../specs/2026-11-02-36-v4-commandes-d-impression.md)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Branche d'intégration | [x] | 2026-11-02 | créée en vague 0 |
| 2 | Schéma : notes internes, lectures, une planche par commande | [x] | 2026-11-02 | db-push dev OK (--accept-data-loss : seule alerte = contrainte unique). Requête ponctuelle (0 ligne supprimée) : `DELETE g FROM PrintSheetGeneration g JOIN PrintSheetGeneration n ON n.printRequestId = g.printRequestId AND (n.createdAt > g.createdAt OR (n.createdAt = g.createdAt AND n.id > g.id)) WHERE g.printRequestId IS NOT NULL`. Relation `PrintRequest.generations` devient `generation` (1-1). Test `api-platform-print-sheets` « transmet printRequestId » échoue (2 générations pour une commande) : à traiter en Task 5. |
| 3 | Fil : messages internes et lecture incrémentale | [x] | 2026-11-02 | `internal` sur `postMessage` / `appendThreadEvent` (4e arg `opts`), `listThread(…, { after })`, `ThreadEntryDTO.internal`, pas de notification pour une note interne. |
| 4 | Non-lus : `read-state.ts` | [x] | 2026-11-02 | `markRead` (upsert + updateMany, ne recule pas), `unreadByRequest`, `countOrdersWithUnread`; entrées sans auteur (système) comptées pour tous ; fabrique `makePrintMessage`. |
| 5 | Planche d'une commande : `getOrderSheet` + `OrderSheetPanel` | [x] | 2026-11-02 | Panneau : rendu statique des 4 états (Dialog pour l aperçu iframe) ; fabrique makePrintGeneration. Test API planches déjà vert. Correctif : lien PDF via /api/files (et non l endpoint JSON de statut). |
| 6 | Renommage « commande » et URL `/platform/print/orders` | [x] | 2026-11-02 | `git mv` des pages staff vers `orders/`, redirection 308 dans `next.config.ts`, libellés et docs en « commande » (identifiants, routes API et fichiers `impression-demandes.md` inchangés), e2e de redirection ajouté. |
| 7 | Menu staff | [x] | 2026-11-02 | Groupes Impression (Commandes, Planches, Gabarits, Catalogue) et Plateforme (Emails, Paramètres, Journal) |
| 8 | Liste des gabarits simplifiée | [x] | 2026-11-02 | Liste sans badge témoin ni `?badge` ; témoin conservé dans l'éditeur ; `witnessFromParams` supprimé |
| 9 | Vérification et commit (sur demande) | [x] | 2026-11-02 | lint 0 erreur, typecheck OK, make test-coverage 292 fichiers / 3658 tests sans erreur de seuil (trou render-badge comblé par test) ; e2e impression plateforme 38 ok (1 flaky print-sheets, rendu >120 s, passé au retry) + évènement 19 ok ; menu, 308, gabarits, libellé « commande » vérifiés |

## Global Constraints

- Tests : nouveaux tests écrits avec les fabriques `src/test/factories.ts` (vague 0) ; Vitest tourne sur la base de test (`make test`), jamais sur la base de dev ; pas de mock de Prisma.
- Vocabulaire : « commande d'impression », « commande », « commandes » (UI, e-mails,
  notifications, docs). Code, modèles et routes API gardent `PrintRequest` / `print-requests`.
- Seules les demandes **d'impression** sont renommées (le mot « demande » sert ailleurs :
  contact, inscriptions…).
- UI et messages en français avec accents ; code en anglais ; commentaires dans le style du
  fichier.
- Couverture 100 % sur `src/lib/**` et `src/app/api/**` (gate existant).
- Toute nouvelle fonction exportée ici est un **contrat** pour la vague 2 : signature exacte
  ci-dessous, ne pas la changer sans mettre à jour les plans 2a/2b/2c.

## Review Focus

- Un organisateur ne reçoit jamais une note interne (fil, polling, notification, compteur).
- Les anciennes URL `/platform/print/requests/...` (liens d'e-mails et notifications déjà
  envoyés) redirigent vers `/platform/print/orders/...`.
- `@@unique([printRequestId])` : la base de dev peut contenir plusieurs générations par
  commande ; le passage du schéma ne doit pas échouer.
- Mes propres messages ne comptent jamais comme non lus.

---

### Task 1: Branche d'intégration

- [ ] `git switch -c feat/commandes-impression` depuis `feat/service-impression` (à jour).

### Task 2: Schéma

**Files:** Modify `prisma/schema.prisma` ; Test `src/lib/__tests__/` (tests des Tasks 3–5)

- [ ] `PrintRequestMessage.internal Boolean @default(false)` — note ou évènement visible du staff
  seulement.
- [ ] Nouveau modèle `PrintRequestRead { id String @id @default(cuid()); requestId String;
  userId String; lastReadAt DateTime; @@unique([requestId, userId]) }`, relations
  `onDelete: Cascade` vers `PrintRequest` et `User`.
- [ ] `PrintSheetGeneration` : `@@unique([printRequestId])` (les générations libres ont
  `printRequestId = NULL`, permis plusieurs fois).
- [ ] Avant `make db-push` : commande ponctuelle (hors code) qui, dans la base de dev, ne garde
  que la génération la plus récente par `printRequestId` non nul. Noter dans la Progression la
  requête utilisée. La production n'a pas encore de commandes (rien à migrer) — à confirmer
  avec l'utilisateur avant tout déploiement.

### Task 3: Fil — messages internes et lecture incrémentale

**Files:** Modify `src/lib/print-requests/thread.ts` ; Test `src/lib/__tests__/` (fichier de test
existant du fil)

**Contrat :**
- `postMessage(input: { requestId; authorId; side: "ORGANIZER" | "STAFF"; body; attachmentKey: string | null; internal?: boolean })` —
  `internal` refusé (`VALIDATION`) si `side !== "STAFF"`.
- `appendThreadEvent(...)` accepte `internal?: boolean` dans ses options.
- `listThread(requestId, audience: ThreadAudience, opts?: { after?: Date }): Promise<ThreadEntryDTO[]>` —
  `ORGANIZER` exclut `internal = true` ; `after` ne renvoie que les entrées strictement
  postérieures.
- `ThreadEntryDTO` gagne `internal: boolean`.
- `src/lib/notifications/triggers.ts` : la notification de message (`PRINT_REQUEST_MESSAGE`) ne
  part pas vers l'organisateur pour un message interne.

- [ ] Tests rouges puis implémentation : interne refusé côté organisateur ; interne absent de
  `listThread(…, "ORGANIZER")` ; `after` filtre ; pas de notification organisateur pour un
  interne.

### Task 4: Non-lus

**Files:** Create `src/lib/print-requests/read-state.ts` ; Test `src/lib/__tests__/print-read-state.test.ts`

**Contrat :**
- `markRead(requestId: string, userId: string, at?: Date): Promise<void>` — upsert, ne recule
  jamais `lastReadAt`.
- `unreadByRequest(userId: string, audience: ThreadAudience, requestIds: string[]): Promise<Record<string, number>>` —
  messages et évènements visibles de l'audience, postérieurs à `lastReadAt` (ou tous si jamais
  lu), dont l'auteur n'est pas `userId`.
- `countOrdersWithUnread(userId: string, audience: ThreadAudience, scope: { eventId?: string }): Promise<number>` —
  nombre de commandes (hors `DRAFT`) ayant au moins un non-lu ; `scope.eventId` restreint à un
  évènement (organisateur).

- [ ] Tests : jamais lu ; lu puis nouveau message ; mes messages exclus ; note interne non
  comptée pour l'organisateur ; `markRead` ne recule pas.

### Task 5: Planche d'une commande

**Files:** Create `src/lib/print-sheets/order-sheet.ts`, `src/components/staff/print/OrderSheetPanel.tsx` ;
Test `src/lib/__tests__/print-order-sheet.test.ts`

**Contrat :**
- `type OrderSheetView = { generationId: string; status: PrintSheetGenerationStatus; layoutName: string | null; duplex: boolean; badgeCount: number | null; sheetCount: number | null; pageCount: number | null; completedAt: string | null; error: string | null; downloadUrl: string | null }`
  (`pageCount = sheetCount × (duplex ? 2 : 1)` ; `downloadUrl = /api/files/${fileKey ?? "print-sheets/<id>.pdf"}`
  quand `DONE`).
- `getOrderSheet(requestId: string): Promise<OrderSheetView | null>`.
- `<OrderSheetPanel sheet={OrderSheetView | null} sheetsHref={string} />` (client) : état (à
  générer / en cours / prête / échec), chiffres, bouton « Télécharger », bouton « Voir la
  planche » ouvrant une **modale** qui affiche le PDF (`<iframe>` sur `downloadUrl`), lien
  « Gérer dans Planches ».

- [ ] Tests de `getOrderSheet` (aucune, en cours, prête recto seul, prête recto-verso) ; rendu du
  panneau dans ses quatre états.

### Task 6: Renommage et URL

**Files:** `src/app/platform/print/requests/**` → `src/app/platform/print/orders/**` (`git mv`),
`next.config.*` (redirections), composants et libs qui contiennent les libellés ou l'URL
(`grep -rn "/platform/print/requests"` et `grep -rnE "[Dd]emandes? d.impression|Demandes"` sur
`src/` et `e2e/`), `src/lib/notifications/messages.ts`, `src/lib/mail.ts` et gabarits d'e-mail,
`docs/v4/features/impression-*.md`, `docs/v4/README.md`.

- [ ] Redirection permanente `/platform/print/requests/:path*` → `/platform/print/orders/:path*`.
- [ ] Tous les liens internes et ceux générés pour e-mails et notifications pointent vers
  `/orders`.
- [ ] Libellés : « Demandes » → « Commandes », « Demande d'impression » → « Commande
  d'impression », etc., côté staff **et** organisateur (pages, listes, boutons, toasts, e-mails,
  notifications, `PRINT_REQUEST_*_LABELS`).
- [ ] e2e d'impression mis à jour (URL et textes) ; un e2e vérifie la redirection.

### Task 7: Menu staff

**Files:** Modify `src/components/staff/StaffShell.tsx`

- [ ] Groupe « Impression » : Commandes (`/platform/print/orders`, avec le compteur actuel),
  Planches, Gabarits, Catalogue. Nouveau groupe « Plateforme » : Emails, Paramètres, Journal.
  (Le compteur des non-lus est ajouté par le lot 2b.)

### Task 8: Liste des gabarits simplifiée

**Files:** Modify `src/components/staff/print/LayoutList.tsx`, `src/app/platform/print/layouts/page.tsx`,
`e2e/platform/print-layouts.spec.ts`, `docs/v4/features/impression-planches.md`

- [ ] La liste n'a plus de badge témoin : en-tête = titre + bouton « Nouveau gabarit » ; cartes =
  miniature de la feuille **sans emplacements** (zone utile seulement), nom, format, orientation,
  marges et espacements, puces (retournement, traits de coupe), actions. Plus de paramètres
  `?badge` entre liste et éditeur (l'éditeur garde son témoin, initialisé par défaut).
- [ ] e2e : le test « badge témoin recto-verso » passe dans l'éditeur ; plus d'attente de
  « N badges par feuille » sur la liste.

### Task 9: Vérification et commit

- [ ] `make lint && make typecheck && make test` (couverture), e2e d'impression, navigateur
  (menu, redirection, liste des gabarits, commande staff et organisateur renommées).
- [ ] Demander à l'utilisateur l'autorisation de commiter sur `feat/commandes-impression`.
