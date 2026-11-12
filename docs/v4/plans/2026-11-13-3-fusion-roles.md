# Vague 3 — Chantier rôles et permissions : fusion des lots, retrait de la compatibilité, vérification — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans le **dossier principal**
> (`/Users/amadou/Devs/projects/badge`, branche `feat/roles-imprimeur-support`), une fois le socle
> (vague 1) terminé et les lots 2a, 2b et 2c terminés et relus (toutes leurs tâches `[x]`, rapport
> « prêt à fusionner »). Toutes les commandes `make` tournent dans le dossier principal. Sous-agents
> éventuels sur Sonnet. En exécution automatisée, un commit par tâche (et les commits de fusion) est
> autorisé sur `feat/roles-imprimeur-support` ; sinon aucun commit sans demande. Aucun déploiement,
> aucun push dans cette vague (le push et la PR sont en vague 5).

**Objectif :** fusionner 2a, 2b et 2c dans la branche d'intégration, supprimer la compatibilité
`minRole` / `role` et les helpers dépréciés du socle, obtenir un `grep` nul sur les anciens rôles,
mettre à jour l'architecture et `CLAUDE.md`, vérifier les défauts transverses entre lots, puis
passer la vérification complète (lint, typecheck, couverture 100 %, e2e complets).

**Architecture :** fusion séquentielle `--no-ff` avec rebase préalable de chaque branche de lot sur
la branche d'intégration ; nettoyage du code partagé du socle une fois tous les consommateurs
migrés par les lots ; relecture transverse (les revues de lot ne se voient pas entre elles) ;
vérification complète sur la stack principale.

**Tech Stack :** git, Next.js 16, Prisma 6 / MySQL 8, Vitest 4, Playwright, Make / Docker.

**Spec :** [`specs/2026-11-13-37-v4-roles-et-permissions.md`](../specs/2026-11-13-37-v4-roles-et-permissions.md)
et [`specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md`](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md)
(vague 3, table de contrôle des interfaces partagées).

**Plans amont :** `2026-11-13-1-socle-roles-docs.md`, `2026-11-13-2a-plateforme-permissions.md`,
`2026-11-13-2b-org-evenement-permissions.md`, `2026-11-13-2c-gestion-des-droits.md`.
**Plan aval :** `2026-11-13-4a-documentation-des-pages.md` (part de la branche issue de cette vague).

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Pré-contrôles | [ ] | | |
| 2 | Rebase et fusion 2a | [ ] | | |
| 3 | Rebase et fusion 2b | [ ] | | |
| 4 | Rebase et fusion 2c | [ ] | | |
| 5 | Retrait de la compatibilité et des helpers dépréciés | [ ] | | |
| 6 | Cohérence catalogue ↔ gardes ↔ menus ↔ docs | [ ] | | |
| 7 | Relecture transverse des défauts jumeaux | [ ] | | |
| 8 | Architecture, `CLAUDE.md`, doc de feature, tracker | [ ] | | |
| 9 | e2e, doc, vérification complète | [ ] | | |

## Fichiers du lot (exclusifs)

Cette vague s'exécute dans le dossier principal et touche, hors résolution de conflit de lot :

- Retrait de la compatibilité (socle) : `src/lib/auth-guards.ts`, `src/lib/auth-helpers.ts`,
  `src/lib/user-context.ts`, `src/types/auth.ts`, `src/lib/with-staff-auth.ts`,
  `src/lib/with-org-auth.ts`, `src/lib/with-event-auth.ts`, `src/lib/auth-participant.ts`,
  `src/lib/auth.ts` (si des helpers dépréciés y sont ré-exportés) et leurs `__tests__`.
- Documentation : `docs/v4/architecture.md`, `CLAUDE.md` (liste des helpers de `auth.ts`),
  `docs/v4/features/roles-permissions.md` (relecture complète), specs 36 à 39 (journal, statut),
  `## Progression` des plans du chantier.
- Test de cohérence du catalogue : `src/lib/permissions/__tests__/` (tests uniquement).

**En lecture seule (besoin d'y toucher → s'arrêter et le signaler)** : `prisma/schema.prisma`
(les colonnes d'enum restent, inutilisées : suppression hors chantier), `scripts/migrate-roles.ts`,
`.env*`, `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`. Tout code de page ou de route de lot :
le corriger seulement si le défaut est un défaut de fusion ; sinon le journaliser et signaler.

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test »), applicables à tout test touché ou ajouté,
y compris en résolution de conflit :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (jamais la base de dev) ; `make test` la
  crée et la met au schéma.
- **Pas de mock de la base ni de Prisma** : vrai MySQL ; seuls les services externes se mockent
  (FedaPay, SMTP réel, renderer via `fakeExporter`, session NextAuth).
- **Fabriques** : `src/test/factories.ts` (écriture dans la vraie base de test) ; pas de
  `prisma.*.create` dupliqués dans les tests.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la
  couverture : s'arrêter et demander. (Retirer du code mort de compatibilité fait partie du plan ;
  adapter un comportement pour un test, non.)
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**` (gate dans `vitest.config.ts`).
- **e2e** (Playwright) : contre l'app en cours d'exécution, fixtures préfixées et nettoyées.

Contraintes de la vague :

- Ordre de fusion **2a, puis 2b, puis 2c** : `git merge --no-ff refs/heads/feat/roles-imprimeur-support-<lot>`,
  après rebase de la branche de lot sur la branche d'intégration (`git rebase feat/roles-imprimeur-support`
  depuis le worktree `../badge-wt-<lot>` ; jamais de `--force` vers un remote : les branches de lot
  ne sont pas poussées).
- **Règles de conflit.** Conflit limité aux fichiers exclusifs d'un lot (docs de la section du lot,
  tests, composants, pages, routes du lot) : l'agent le résout puis relance les tests concernés.
  Conflit dans du **code du socle** (liste de la spec 36, vague 1), dans `prisma/schema.prisma`,
  dans un fichier attribué à un autre lot ou dans un fichier de la table de contrôle des
  interfaces partagées : `git merge --abort` (ou `git rebase --abort`), journaliser dans la spec 36,
  **s'arrêter et signaler**.
- Pas de `--force`, pas de push, pas de fusion de PR, aucune action sur la préprod ni la prod,
  aucune commande SSH, **aucun déploiement**. **Ne pas modifier `.env*`.** Pas de `make db-reset`
  sans accord. `make migrate-roles` sur la base de dev est autorisé (idempotent, dev seulement).
- Pas de co-auteur IA ni de mention d'IA dans les messages de commit ; messages en français ASCII,
  style conventional commits.
- Échec répété d'une commande : s'arrêter et expliquer, ne pas boucler.

## Review Focus

Défauts transverses que les revues de lot ne voient pas (un défaut trouvé dans un lot → chercher
son jumeau dans les deux autres) :

- Une clé de permission vérifiée par une route ou une page mais absente du catalogue, ou présente
  au catalogue et jamais vérifiée (anti-objectif de la spec 37).
- Un bouton ou une entrée de menu affiché sans la permission que le serveur exige (cas relevés :
  archivage et création d'organisation, création d'utilisateur, plans, abonnement, test SMTP,
  menu Planches de l'Observateur).
- Une route mutante sans `logActivity()`, ou une réponse qui expose un secret (hash, tokens non
  hashés, `smtpPassword`, `recaptchaSecretKey`).
- Régression de droits non assumée pour un utilisateur existant (assumées : Observateur en lecture
  seule chez les clients ; `STAFF_SUPPORT` sans la production d'impression ; union rôle
  d'organisation + rôle d'évènement ; `users.update` réservé à AD+).
- Cohabitation des trois lots : liens de menu (`/platform/roles`, `/org/[orgId]/roles`) et pages
  de 2c ; `OnsiteStation` (`apiBase`, `backHref`) utilisé par 2a et 2b ; membres d'évènement ;
  sélecteurs de rôle par `roleId` sur tous les formulaires.
- UI : e2e puis contrôle navigateur à 375, 1024 et 1280 px (le menu latéral occupe ~224 px dès `lg`).

---

### Task 1: Pré-contrôles

- [ ] Vérifier la branche, l'état, les branches et les plans de lot :
  ```bash
  git rev-parse --abbrev-ref HEAD && git status --short
  git branch --list 'feat/roles-imprimeur-support-*'
  grep -c "\[ \]\|\[~\]" docs/v4/plans/2026-11-13-1-*.md docs/v4/plans/2026-11-13-2a-*.md docs/v4/plans/2026-11-13-2b-*.md docs/v4/plans/2026-11-13-2c-*.md
  ```
  Expected: `feat/roles-imprimeur-support` ; arbre propre (les specs 36 à 40 et le `Todo.md` sont
  commités ou explicitement mis de côté par l'utilisateur) ; branches `-2a`, `-2b`, `-2c` ; compte `0`
  par plan (sinon signaler et s'arrêter).
- [ ] Aucun lot n'a modifié un fichier du socle :
  ```bash
  for l in 2a 2b 2c; do echo "== $l"; git diff --name-only feat/roles-imprimeur-support...feat/roles-imprimeur-support-$l \
    | grep -E '^(prisma/schema.prisma|src/lib/(permissions/|auth-guards|auth-helpers|user-context|with-(staff|org|event)-auth|auth-participant|activity-labels)|src/types/auth.ts|src/test/factories.ts|src/test-setup.ts|e2e/helpers/)'; done
  ```
  Expected: aucune ligne sous chaque `==` (sinon signaler et s'arrêter).
- [ ] Aucun fichier modifié par deux lots (hors docs) :
  ```bash
  S=<dossier scratchpad de la session>
  for l in 2a 2b 2c; do git diff --name-only feat/roles-imprimeur-support...feat/roles-imprimeur-support-$l | sort > $S/files-$l.txt; done
  comm -12 $S/files-2a.txt $S/files-2b.txt; comm -12 $S/files-2a.txt $S/files-2c.txt; comm -12 $S/files-2b.txt $S/files-2c.txt
  ```
  Expected: intersection vide hors `docs/v4/features/roles-permissions.md` (sections distinctes) ;
  sinon journaliser.
- [ ] Stack principale up (`app`, `mysql`, `rustfs`, `renderer`, `worker`) : `make dev` sinon.

### Task 2: Rebase et fusion 2a (plateforme)

- [ ] Rebaser la branche de lot sur la branche d'intégration depuis son worktree, puis revenir au
  dossier principal :
  ```bash
  git -C ../badge-wt-2a rebase feat/roles-imprimeur-support
  ```
  Expected: rebase sans conflit. Conflit : règles de la section Global Constraints.
- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/roles-imprimeur-support-2a -m "merge: lot 2a plateforme et permissions"
  ```
- [ ] `make db-push` (sans changement attendu), redémarrer app et worker :
  `docker compose -f docker-compose.dev.yml restart app worker`.
- [ ] Vérifier : `make typecheck`, puis les tests du lot (`make test FILE=src/app/api/platform` et
  `make test FILE=src/lib/print-requests`). Un 404 HTML sur une route API existante = redémarrer
  `app` avant de chercher dans le code.

### Task 3: Rebase et fusion 2b (organisation et évènement)

- [ ] Rebaser `-2b` sur la branche d'intégration (qui contient maintenant 2a), puis fusionner :
  ```bash
  git -C ../badge-wt-2b rebase feat/roles-imprimeur-support
  git merge --no-ff refs/heads/feat/roles-imprimeur-support-2b -m "merge: lot 2b organisation, evenement et agent"
  ```
  Points d'attention si conflit : `docs/v4/features/impression-sur-place.md` et spec 35
  (amendements de 2b), `src/components/staff/print/**` (lecture seule pour 2b : tout diff vers
  ce dossier est un défaut de périmètre).
- [ ] Redémarrer app et worker ; `make typecheck` ; tests du lot (`make test FILE=src/app/api/org`,
  `make test FILE=src/lib/print-requests/content`).

### Task 4: Rebase et fusion 2c (gestion des droits et participant)

- [ ] Rebaser `-2c`, puis fusionner :
  ```bash
  git -C ../badge-wt-2c rebase feat/roles-imprimeur-support
  git merge --no-ff refs/heads/feat/roles-imprimeur-support-2c -m "merge: lot 2c gestion des droits et participant"
  ```
- [ ] Redémarrer app et worker ; `make typecheck` ; tests du lot (`make test FILE=src/app/api/platform/roles`,
  `.../users`, `src/app/api/org/` des dossiers `roles` et `members`, `src/components/permissions`).
- [ ] Les liens « Rôles » (`StaffShell` → `/platform/roles`, `OrgShell` → `/org/[orgId]/roles`)
  ajoutés par 2a et 2b pointent vers des pages qui existent : `curl`/navigateur en connexion
  SUPER_ADMIN et OWNER, statut 200.
- [ ] Aucun usage du sélecteur de rôle par enum ne subsiste dans les formulaires de membres
  (`UserCreationForm`, `PlatformOrgMemberInviteForm`, `OrgMemberForm`, `MemberInviteForm`).

### Task 5: Retrait de la compatibilité et des helpers dépréciés

**Interfaces :**
- Consumes : les contrats du socle (`requirePermission`, `requireParticipantPermission`,
  `loadPermissions`, `hasPermission`, `effectivePermissions`, wrappers à `permission`,
  `EventAuthCtx { permissions, isStaffActor }`).
- Produces : `src/lib/auth-guards.ts`, `auth-helpers.ts`, wrappers et `src/types/auth.ts` sans
  `minRole`, sans `role`, sans `effectiveRole`, sans helpers par niveau hiérarchique.

- [ ] **Écrire d'abord le contrôle** (échec attendu avant le retrait) :
  ```bash
  grep -rnE "minRole|staffRoleAtLeast|orgRoleAtLeast|hasOrgRole|requireOrgRole|requireEventRole|\bStaffRole\b|\bOrgRole\b|\bEventRole\b|effectiveRole|allowStaff" \
    src e2e scripts prisma/seed --include=*.ts --include=*.tsx | grep -v "scripts/migrate-roles.ts"
  grep -rnE "\"STAFF\"|'STAFF'" src e2e --include=*.ts --include=*.tsx
  ```
  Expected avant : des lignes (compatibilité du socle, tests). Expected après : **aucune ligne**
  (hors `scripts/migrate-roles.ts`, `prisma/schema.prisma` et `node_modules`). Les occurrences de
  `"STAFF"` qui ne désignent pas un rôle effectif (libellé d'UI, valeur d'`ActivityType`) sont
  listées et justifiées dans le journal, jamais masquées.
- [ ] Retirer de `src/lib/auth-guards.ts` : `requireStaff`, `requireOrgRole`, `requireEventRole`,
  `hasOrgRole`, `hasEventPermission`, `staffRoleAtLeast`, `orgRoleAtLeast` et les tables de
  hiérarchie ; de `src/lib/auth-helpers.ts` : l'ancien `EventPermission` et ses tables ; des
  wrappers : les options `minRole` / `role` et la valeur `"STAFF"` de `effectiveRole` ; de
  `src/types/auth.ts` : les types d'enum devenus inutiles. Garder `requireStaffActor`-équivalents
  seulement s'ils sont nommés par permission.
- [ ] Supprimer les tests de la compatibilité retirée ; **conserver** les tests des règles métier
  qui restent en code (`assertNotLastOwner`, `assertNotLastSuperAdmin`, `isStaffActor`).
  Ne pas écrire de test pour du code qui n'existe plus ; ne pas baisser le seuil de couverture.
- [ ] `make typecheck` doit guider : toute erreur dans un fichier de lot révèle un usage oublié
  par un lot → le corriger (migration vers `permission`) avec son test, le journaliser.
- [ ] `make lint && make typecheck && make test-coverage`. Expected: 0 erreur, couverture 100 %.
- [ ] Rejouer le `grep` : aucune ligne. Commit :
  `git add -A src e2e && git commit -m "refactor(auth): retire la compatibilite minRole/role et les helpers deprecies"`.

### Task 6: Cohérence catalogue ↔ gardes ↔ menus ↔ docs

- [ ] Test de cohérence (tests uniquement, dans `src/lib/permissions/__tests__/catalog-usage.test.ts`) :
  `describe("catalogue de permissions")` avec deux assertions sur les fichiers sources lus
  depuis le disque —
  `it("toute clé citée dans le code existe au catalogue")` (regex sur
  `permission: "…"`, `requirePermission(…, "…"`, `hasPermission(…, "…"`, `permissions.has("…"`
  dans `src/**` hors tests) et
  `it("toute clé non reserved du catalogue est vérifiée quelque part")`.
  Les clés `reserved` et celles évaluées dynamiquement sont listées dans une liste d'exceptions
  **nominative et commentée** du test. Un échec révèle un vrai défaut (clé orpheline ou oubliée) :
  le corriger côté code de lot, pas relâcher le test.
- [ ] Menus ↔ serveur : pour `StaffShell`, `OrgShell`, `EventShell`, chaque entrée est filtrée par
  la **même** permission que la page cible et que ses routes de lecture ; lister les écarts
  éventuels dans le journal et les corriger (le menu suit le serveur, jamais l'inverse).
- [ ] Parcours des rôles système dans le navigateur (comptes du seed) : `STAFF_PRINTER` (menu
  Impression seul), `STAFF_OBSERVER` (aucun bouton d'écriture chez les clients), `AGENT` (poste
  sur place, sans prix ni liste détaillée) ; 375 et 1280 px.
- [ ] Commit si correctifs : `fix(roles): coherence catalogue, gardes et menus apres fusion`.

### Task 7: Relecture transverse des défauts jumeaux

- [ ] Lire `git diff --stat development...HEAD` et `git log --oneline development..HEAD` ; comparer
  aux listes de fichiers de la spec 36.
- [ ] Reprendre les constats des revues de chaque lot (sections Notes de leurs plans, rapports
  `.superpowers/sdd/roles-permissions/lot-*-report.md`) et chercher le jumeau de chaque défaut dans
  les deux autres lots. Contrôles types :
  ```bash
  git diff development...HEAD -- 'src/app/api/**' | grep -nE "^\+.*export (const|async function) (POST|PUT|PATCH|DELETE)"
  grep -rLE "logActivity" $(git diff --name-only development...HEAD -- 'src/app/api/**/route.ts')
  ```
  Expected: chaque route mutante nouvelle ou migrée appelle un wrapper ou helper à permission et
  `logActivity` quand l'action est sensible ; la liste du second `grep` est relue à la main
  (lectures seules légitimes).
- [ ] Vérifier le garde-fou « dernier SUPER_ADMIN / dernier OWNER » sur les trois chemins qui
  changent un rôle (plateforme, membre d'organisation côté plateforme, membre côté organisation) et
  l'anti-escalade sur les trois éditeurs (rôle, ajustement, attribution).
- [ ] Vérifier qu'aucune réponse API n'expose de secret ni de token non hashé (réponses des
  nouvelles routes `roles` et `permissions`).
- [ ] Défaut dans un fichier de lot : le corriger test d'abord ; dans le socle : correctif sur la
  branche d'intégration journalisé ; ambigu : signaler. Relancer lint, typecheck, couverture.

### Task 8: Architecture, `CLAUDE.md`, doc de feature, tracker

- [ ] `docs/v4/architecture.md` : remplacer les mentions `StaffRole` / `OrgRole` / « filtrée par
  role effectif » par le modèle rôles + permissions (catalogue dans le code, rôles en base, rôles
  système figés, ajustements par utilisateur, résolution par cible, gardes par permission, quatre
  niveaux, AGENT et Imprimeur) ; mettre à jour le tableau des espaces (accès par permission) et la
  section « Fin des vues imbriquées » (nav filtrée par permission).
- [ ] `CLAUDE.md`, section « Helpers réutilisables » → `auth.ts` : remplacer la liste v2 par
  `requirePermission`, `requireParticipantPermission`, `loadPermissions`, `hasPermission`,
  `effectivePermissions`, wrappers `withStaffAuth` / `withOrgAuth` / `withEventAuth` (option
  `permission`), `loadUserContext`, `assertNotLastOwner`, `assertNotLastSuperAdmin` ; ajouter la
  ligne `src/lib/permissions/**` (catalogue, rôles système, résolution, libellés) ; adapter la règle
  « RBAC — séparation des rôles » (v2+ : permissions) et « Toute route API doit vérifier la
  permission ». Ne pas toucher aux autres sections (la section « Documentation des pages » est
  ajoutée par la vague 4).
- [ ] `docs/v4/features/roles-permissions.md` : relecture complète pour cohérence entre les sections
  de lot (plateforme / organisation et évènement / gestion des droits) et le socle ; conflit
  doc ↔ code → le code fait foi.
- [ ] Specs 36 à 39 : statut → « implémentée — <date> (branche `feat/roles-imprimeur-support`) »,
  journal : résultat de chaque fusion, conflits et arbitrages, nombre de tests, couverture, e2e,
  contrôle navigateur, écarts. Tracker : chaque `## Progression` des plans socle, 2a, 2b, 2c et de ce
  plan à jour (`[x]`, dates, notes) ; tâche abandonnée → `[-]` + raison dans la spec. Ne supprimer
  aucun plan ni aucune spec.
- [ ] Commit : `git add docs CLAUDE.md && git commit -m "docs: architecture, helpers d'autorisation et suivi du chantier roles"`.

### Task 9: e2e, doc, vérification complète

- [ ] `make migrate-roles` deux fois sur la base de dev (idempotence), puis `make db-seed` (répare
  aussi le SMTP de dev vers Mailpit ; un échec e2e en masse se vérifie d'abord là).
- [ ] `make lint && make typecheck && make test-coverage`. Expected: lint 0 erreur, typecheck OK,
  tous les tests passent, couverture 100 % sur `src/lib/**` et `src/app/api/**`.
- [ ] Suite e2e complète sans autre e2e ni stack de lot en parallèle (arrêter les stacks 2a, 2b,
  2c : `scripts/agent-stack.sh down <lot>`, worktrees, branches et bases conservés) :
  `make test-e2e`. Si le run unique se termine en OOM (137), rejouer par dossier
  (`make test-e2e FILE=e2e/platform`, `e2e/org`, `e2e/event`, `e2e/public`, `e2e/transverse`).
  Un timeout sous forte charge (`uptime` > 30) : rejouer le fichier seul avant de conclure.
  Tout échec dû au code de production : cause racine, correctif avec test, jamais d'adaptation
  du code pour le test.
- [ ] Contrôle navigateur final, comptes SUPER_ADMIN, STAFF_PRINTER, STAFF_OBSERVER, OWNER, AGENT,
  VIEWER : menus, pages `/platform/roles`, `/org/[orgId]/roles`, pages de permissions d'utilisateur,
  poste sur place ; viewports **375, 1024 et 1280 px** (redimensionner, recharger, capturer) ;
  console sans erreur 500 ni 404 HTML sur route existante. Remettre le viewport à `desktop`.
- [ ] Mettre à jour la `## Progression` (tâches 1 à 9 `[x]`) et le journal de la spec 36 ; commit
  final éventuel. **Pas de push** : la branche reste locale jusqu'à la vague 5.

## Amendements de la relecture croisée (2026-11-13)

> Ces amendements **priment** sur le reste du plan en cas de contradiction.

1. Vérifier en plus : aucun `withAnyEventPermission`, aucun `eventTargetOf` redéfini hors
   `src/lib/permissions` ; repli sur l'enum (`roleId` nul) **conservé** jusqu'au changement
   ultérieur de suppression des enums (ne pas le retirer à la fusion) ; double écriture des
   enums conservée pour la même raison.
