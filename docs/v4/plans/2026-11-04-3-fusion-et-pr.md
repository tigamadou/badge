# Vague 3 — Retours client : fusion des lots, vérification et PR — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans le **dossier principal**
> (`/Users/amadou/Devs/projects/badge`, branche `feat/retours-client-v3`), une fois les lots 2a, 2b
> et 2c terminés et relus. Toutes les commandes `make` tournent dans le dossier principal. Sous-agents
> éventuels sur Sonnet. En exécution automatisée, un commit par tâche (et les commits de fusion) est
> autorisé sur `feat/retours-client-v3` ; sinon aucun commit sans demande. Aucun déploiement.

**Objectif :** fusionner les trois lots dans `feat/retours-client-v3`, vérifier l'ensemble (tests,
e2e, navigateur), pousser la branche et ouvrir une PR vers `development`, sans jamais la fusionner.

**Spec :** [`specs/2026-11-04-38-v4-retours-client.md`](../specs/2026-11-04-38-v4-retours-client.md) (Organisation du travail)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Pré-contrôles | [ ] | | |
| 2 | Fusion 2b | [ ] | | |
| 3 | Fusion 2a | [ ] | | |
| 4 | Fusion 2c | [ ] | | |
| 5 | Seed et e2e complets | [ ] | | |
| 6 | Contrôle navigateur | [ ] | | |
| 7 | Relecture transverse | [ ] | | |
| 8 | Spec, plans, documentation | [ ] | | |
| 9 | Arrêt des stacks | [ ] | | |
| 10 | Push et PR | [ ] | | |

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test »), applicables à tout test touché ou ajouté lors
d'une résolution de conflit :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (jamais la base de dev) ; `make test`
  la crée et la met au schéma.
- **Pas de mock de la base ni de Prisma** : vrai MySQL ; seuls les services externes se mockent.
- **Fabriques** : `src/test/factories.ts` (et `src/test/factories-<lot>.ts`), pas de
  `prisma.*.create` dupliqués.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander.
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**`.
- **e2e** : contre l'app en cours d'exécution, fixtures préfixées et nettoyées.

Contraintes de la vague :

- Ordre de fusion **2b, puis 2a, puis 2c** : `git merge --no-ff refs/heads/feat/retours-client-v3-<lot>`.
- **Règles de conflit.** Conflit limité aux fichiers exclusifs d'un lot (docs, tests, modules du
  lot, listes de la spec) : l'agent le résout, puis relance les tests concernés. Conflit dans du
  **code partagé** ou dans un fichier **en lecture seule du socle** (`prisma/schema.prisma`,
  `src/lib/image-dimensions.ts`, `src/lib/list-query.ts`, `src/lib/badge-list-query.ts`,
  `src/components/ui/Pagination.tsx`, `src/lib/activity-labels.ts`, `src/test/factories.ts`,
  `e2e/helpers/db.ts`, `prisma/seed/minimal.ts`), ou dans un fichier attribué à un autre lot :
  `git merge --abort`, journaliser dans la spec, **s'arrêter et signaler à l'utilisateur**.
- Jamais de `--force`, jamais de push sur `development`, **pas de fusion de la PR**, aucune action
  sur la préprod ni la prod, aucune commande SSH. Pas de `make db-reset` sans accord.
- Pas de co-auteur IA ni de mention d'IA dans les messages de commit et la PR ; messages en français
  ASCII, style conventional commits.
- En cas d'échec répété d'une commande : s'arrêter et expliquer, ne pas boucler.

## Review Focus

- Les trois lots coexistent : pagination (socle) utilisée par 2b (listes de paiements) et 2c ;
  `PaymentHistory` garde ses props pour 2c ; `EVENT_IMAGES_NONCOMPLIANT` (2a) est bien affiché par
  les écrans de 2c (`RequestStatusActions`, `PrintRequestActions`) ; `badges/route.ts` GET (2c) et
  `[badgeId]/**` (2a) cohabitent.
- Défauts jumeaux : un défaut trouvé dans un lot est cherché dans les deux autres (revues de lot
  aveugles entre elles).
- Aucun fichier de lecture seule du socle modifié par un lot (`git diff` contre le socle).
- Parcours clés vérifiés dans le navigateur à 375, 1024 et 1280 px (menu latéral ~224 px dès `lg`).
- Doc impactée à jour (features, spec, tracker des plans).

## Fichiers touchés

Plan, spec et documentation uniquement (`docs/v4/plans/2026-11-04-*.md`,
`docs/v4/specs/2026-11-04-38-v4-retours-client.md`) ; correctifs de fusion limités aux fichiers de
lot. Tout besoin de toucher au code partagé : s'arrêter et signaler.

---

### Task 1: Pré-contrôles

- [ ] Vérifier la branche et l'état :
  ```bash
  git rev-parse --abbrev-ref HEAD && git status --short
  ```
  Expected: `feat/retours-client-v3` ; aucun fichier modifié (le fichier de spec non suivi est
  commité par la vague 1).
- [ ] Vérifier que les branches de lot existent et que leurs plans sont terminés :
  ```bash
  git branch --list 'feat/retours-client-v3-2*'
  grep -c "\[ \]\|\[~\]" docs/v4/plans/2026-11-04-2a-*.md docs/v4/plans/2026-11-04-2b-*.md docs/v4/plans/2026-11-04-2c-*.md
  ```
  Expected: trois branches `-2a`, `-2b`, `-2c` ; compte `0` par plan (sinon, signaler et s'arrêter).
- [ ] Vérifier qu'aucun lot n'a modifié les fichiers en lecture seule :
  ```bash
  for l in 2a 2b 2c; do echo "== $l"; git diff --name-only feat/retours-client-v3...feat/retours-client-v3-$l | grep -E '^(prisma/schema.prisma|src/lib/(image-dimensions|list-query|badge-list-query|activity-labels).ts|src/components/ui/Pagination.tsx|src/test/factories.ts|e2e/helpers/db.ts|prisma/seed/minimal.ts)$'; done
  ```
  Expected: aucune ligne sous chaque `==` (sinon, signaler et s'arrêter).
- [ ] Vérifier que la stack principale tourne et les stacks de lot :
  ```bash
  docker compose -f docker-compose.dev.yml ps --status running --services && scripts/agent-stack.sh status
  ```
  Expected: `app`, `mysql`, `worker`, `renderer`… en cours ; stacks de lot listées (pas de commande
  `up` nécessaire ici).

### Task 2: Fusion 2b (abonnement, paiements, tarifs)

- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/retours-client-v3-2b -m "merge: lot 2b abonnement, paiements et tarifs"
  ```
  Expected: fusion sans conflit. En cas de conflit : appliquer les règles de la section Global
  Constraints (fichier de lot : résoudre ; sinon `git merge --abort` et signaler).
- [ ] Appliquer le schéma et redémarrer app et worker (Turbopack perd des routes après une
  fusion ; le worker ne recharge pas le code) :
  ```bash
  make db-push
  docker compose -f docker-compose.dev.yml restart app worker
  ```
  Expected: `db-push` « already in sync » (le schéma vient du socle) ; conteneurs redémarrés.
- [ ] Vérifier :
  ```bash
  make lint && make typecheck && make test-coverage
  ```
  Expected: lint et typecheck sans erreur ; tous les tests passent, couverture 100 % sur
  `src/lib/**` et `src/app/api/**`. Un 404 HTML sur une route API existante = redémarrer le
  conteneur `app` avant de chercher dans le code.
- [ ] Commit si la fusion a demandé une résolution ou un correctif (sinon le commit de fusion
  suffit).

### Task 3: Fusion 2a (images du badge)

- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/retours-client-v3-2a -m "merge: lot 2a images du badge"
  ```
  Expected: fusion sans conflit (lockfiles : `package.json`/`yarn.lock` ne sont modifiés que par
  2a). Conflit de code partagé : abandon et signalement.
- [ ] Mise à jour des dépendances, schéma, redémarrage :
  ```bash
  docker compose -f docker-compose.dev.yml exec app yarn install
  make db-push
  docker compose -f docker-compose.dev.yml restart app worker
  ```
  Expected: dépendance de recadrage installée ; `db-push` sans changement ; conteneurs redémarrés.
- [ ] Vérifier :
  ```bash
  make lint && make typecheck && make test-coverage
  ```
  Expected: tout vert, couverture 100 %.

### Task 4: Fusion 2c (pagination et page commande)

- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/retours-client-v3-2c -m "merge: lot 2c pagination et page commande"
  ```
  Expected: fusion sans conflit. Points d'attention si conflit : `src/app/api/org/[orgId]/events/[eventId]/badges/route.ts`
  (GET liste à 2c, reste à 2a), `src/components/layout/AppShell.tsx` ; hors liste d'un lot →
  abandon et signalement.
- [ ] Schéma, redémarrage :
  ```bash
  make db-push
  docker compose -f docker-compose.dev.yml restart app worker
  ```
  Expected: sans changement ; conteneurs redémarrés.
- [ ] Vérifier :
  ```bash
  make lint && make typecheck && make test-coverage
  ```
  Expected: tout vert, couverture 100 % (gate `vitest.config.ts` active).
- [ ] Contrôle d'interface : les pages de 2c et de 2b (listes de paiements) utilisent toutes
  `parseListPage` / `UrlPagination` ; aucune liste ne définit sa propre liste de tailles :
  ```bash
  grep -rn "pageSizeOptions\|\[10, 25\|\[10, 20, 50" src --include=*.ts --include=*.tsx | grep -v "list-query.ts\|Pagination.tsx\|__tests__"
  ```
  Expected: aucune définition concurrente de la liste 10/20/50/100/500.

### Task 5: Seed et e2e complets

- [ ] Réinitialiser les données de référence et les comptes de test sans toucher au schéma :
  ```bash
  make db-seed
  ```
  Expected: seed OK (plans par défaut `publicVisible`, motifs de rejet de portée profil).
- [ ] Suite e2e complète (dans le conteneur `app`, contre l'app en cours d'exécution ; pas d'autre
  e2e ni de stack de lot en cours en parallèle) :
  ```bash
  make test-e2e
  ```
  Expected: tous les tests passent. En cas d'échecs en masse, vérifier d'abord le SMTP de la base de
  dev (`make db-seed` le répare) avant de chercher dans le code. Un échec préexistant sur
  `development` est noté (comparer avec `git stash`-free : relancer le fichier sur `development`
  via un worktree n'est pas requis ; le noter dans la PR) ; tout autre échec : corriger si c'est un
  fichier de lot, sinon signaler.
- [ ] Si un test e2e ou unitaire échoue pour une raison de code de production : ne pas adapter le
  code pour le test ; diagnostiquer la cause racine, puis corriger le vrai défaut ou demander.

### Task 6: Contrôle navigateur des parcours clés

Outils : navigateur du pane (ou Chrome MCP) sur `https://badge.local` / `http://localhost:3785`,
comptes de dev du seed. Viewports **375, 1024 et 1280 px** pour chaque parcours (redimensionner,
recharger, capturer).

- [ ] **Recadrage logo/photo** : paramètres d'évènement (logo, bannière) — envoi d'une image au
  mauvais ratio, recadrage, enregistrement, bandeau « images à recadrer » sur le tableau de bord
  évènement ; photo d'identité 7:9 (profil et formulaire d'inscription).
  Expected: recadreur utilisable au doigt à 375 px, original conservé, aucun débordement
  horizontal.
- [ ] **Montée en gamme au prorata** : espace organisation, abonnement — choix d'un plan
  supérieur, devis au prorata (prix plein, crédit, net), retour de paiement.
  Expected: montants cohérents avec `Payment.listPrice` / `prorataCredit` ; période couverte
  affichée.
- [ ] **Module paiements** : `/org/<orgId>/payments` (organisateur) et `/platform/payments`
  (staff) — liste, filtres, pagination, lien vers la fiche.
  Expected: listes paginées 10/20/50/100/500, lisibles à 375 px.
- [ ] **`/tarifs`** : cartes de plans (`publicVisible`, `position`, `highlighted`, `features`),
  tableau comparatif ; gestion du catalogue staff (`/platform/plans`).
  Expected: seuls les plans publics sont visibles, ordre respecté.
- [ ] **Sélecteur de taille de page 10/20/50/100/500** sur au moins une liste par espace
  (organisation, évènement, plateforme, compte) : changement de taille remet `page` à 1, l'URL porte
  `page`/`pageSize`, valeur hors liste ramenée à 20.
- [ ] **Page commande** staff (`/platform/print/orders/<id>`) et organisateur
  (`/event/<eventId>/print/<id>`) : conversation pleine hauteur, actions de statut, erreurs 4xx
  (dont `EVENT_IMAGES_NONCOMPLIANT`) affichées.
  Expected: aucun défilement horizontal de la page à 375, 1024, 1280 px ; le menu latéral (~224 px
  dès `lg`) ne comprime pas la conversation.
- [ ] Vérifier la console navigateur et le réseau : aucune erreur 500, aucun 404 HTML sur une route
  API existante (sinon redémarrer `app`).
- [ ] Remettre le viewport à `desktop` en fin de contrôle.

### Task 7: Relecture transverse des défauts jumeaux

- [ ] Lire le diff global :
  ```bash
  git diff --stat development...HEAD
  git log --oneline development..HEAD
  ```
  Expected: diff cohérent avec les listes de fichiers de la spec.
- [ ] Reprendre les défauts relevés par les revues de chaque lot (sections « Review » et Notes de
  leurs plans) et chercher leur jumeau dans les deux autres lots : par exemple absence de
  `logActivity()` sur une action sensible, route sans contrôle de rôle, secret exposé dans une
  réponse, texte sans accents, état de chargement ou vide manquant, débordement à 375 px, champ
  non validé aux frontières.
- [ ] Contrôles ciblés :
  ```bash
  git diff development...HEAD -- 'src/app/api/**' | grep -n "^+.*export async function \(POST\|PUT\|PATCH\|DELETE\)" 
  ```
  Expected: chaque nouvelle route mutante appelle un helper de `src/lib/auth.ts` et `logActivity`
  (vérification à la lecture).
- [ ] Défaut trouvé dans un fichier de lot : le corriger (test d'abord, selon les règles de test) ;
  dans du code partagé : signaler. Relancer `make lint && make typecheck && make test-coverage`
  après tout correctif.

### Task 8: Spec, plans et documentation

- [ ] Spec `docs/v4/specs/2026-11-04-38-v4-retours-client.md` : statut → « implémentée — 2026-11-04
  (PR ouverte) », plans listés dans l'en-tête, journal : résultats de chaque fusion, conflits et
  arbitrages, résultats des vérifications (nombre de tests, couverture, e2e, navigateur), écarts.
- [ ] Tracker des plans : vérifier que chaque `## Progression` des plans socle, 2a, 2b, 2c et de ce
  plan est à jour (`[x]`, dates, notes) ; une task abandonnée passe à `[-]` avec la raison dans la
  spec. Ne supprimer aucun plan ni spec.
- [ ] Doc de features impactée (`templates-badges`, `validation-profils`, `abonnements`,
  `paiements-fedapay`, `impression-demandes`) : relire pour la cohérence entre lots ; conflit
  doc ↔ code → le code fait foi.
- [ ] Commit (autorisé en exécution automatisée) :
  ```bash
  git add docs/v4 && git commit -m "docs: spec et plans du chantier retours client a jour"
  ```
  Expected: commit créé, sans trailer ni mention d'IA.

### Task 9: Arrêt des stacks d'agents

- [ ] Arrêter les stacks (worktrees, branches et bases conservés) :
  ```bash
  scripts/agent-stack.sh down 2a
  scripts/agent-stack.sh down 2b
  scripts/agent-stack.sh down 2c
  scripts/agent-stack.sh status
  ```
  Expected: plus aucune stack `badge-ag-*` ; la stack principale reste démarrée.

### Task 10: Push et PR

- [ ] Vérifier qu'il ne reste rien d'indésirable (pas de `.env`, secret ni fichier d'`uploads/`) :
  ```bash
  git status --short && git diff --name-only development...HEAD | grep -E '(^|/)\.env|uploads/' || echo OK
  ```
  Expected: arbre propre ; `OK`.
- [ ] Pousser la branche (jamais `--force`, jamais `development`) :
  ```bash
  git push -u origin feat/retours-client-v3
  ```
  Expected: branche publiée.
- [ ] Ouvrir la PR vers `development` (titre et corps en français ASCII, **sans** mention d'IA ni
  co-auteur) :
  ```bash
  gh pr create --base development --head feat/retours-client-v3 \
    --title "Retours client v3 : images du badge, abonnements, paiements, tarifs, pagination, page commande" \
    --body-file <fichier-corps>
  ```
  Corps (écrit dans un fichier du dossier de scratchpad de la session) : résumé des 6 volets ;
  décisions de la spec et plans ; résultats (lint, typecheck, couverture 100 %, e2e, contrôle
  navigateur à 375/1024/1280 px) ; échecs préexistants éventuels ; points à relire (schéma Prisma,
  prorata, recadrage, pagination) ; mention que `make db-push` suffit (pas de migration de
  production à lancer dans ce chantier) ; commande de suppression des worktrees/branches/bases de
  lot conservés.
  Expected: URL de la PR affichée. **Ne pas fusionner la PR.**
- [ ] Notifier l'utilisateur (URL de la PR, résultats, points d'attention) ; mettre `## Progression`
  à jour (task 10 `[x]`) et désactiver la tâche planifiée d'orchestration.
