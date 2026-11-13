# Vague 5 — Documentation des pages : fusion 4a, rédaction complète, vérification et PR — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans le **dossier principal**
> (`/Users/amadou/Devs/projects/badge`, branche `feat/roles-imprimeur-support`), une fois le lot 4a
> terminé et relu (toutes ses tâches `[x]`, rapport « prêt à fusionner »). Toutes les commandes `make`
> tournent dans le dossier principal. Sous-agents de rédaction sur Sonnet, un par espace. En
> exécution automatisée, un commit par tâche (et le commit de fusion) est autorisé sur
> `feat/roles-imprimeur-support` ; sinon aucun commit sans demande. **Aucun déploiement.**

**Objectif :** fusionner le lot 4a, faire rédiger la documentation de toutes les pages restantes des
espaces connectés (plateforme, évènement, compte ; l'espace organisation est déjà fait par le
pilote), la tamponner, la relire, obtenir `make docs-check` vert et une vérification complète, puis
pousser la branche et ouvrir la PR du chantier vers `development`, sans la fusionner.

**Architecture :** fusion `--no-ff` de `feat/roles-imprimeur-support-4a` ; trois sous-agents de
rédaction en parallèle (un par espace, fichiers disjoints : `src/content/page-docs/<espace>/**`), tous
guidés par la section « Documentation des pages » de `CLAUDE.md` ; tampon unique par l'orchestrateur ;
relecture de l'orchestrateur contre les écrans ; vérification complète ; push et PR.

**Tech Stack :** git, `gh`, Make / Docker, Vitest, Playwright, outil `scripts/page-docs`.

**Spec :** [`specs/2026-11-13-40-v4-documentation-des-pages.md`](../specs/2026-11-13-40-v4-documentation-des-pages.md)
(« Mise en place initiale ») et [`specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md`](../specs/2026-11-13-36-v4-chantier-roles-docs-coordination.md)
(vague 5).

**Plans amont :** `2026-11-13-3-fusion-roles.md` (vague 3), `2026-11-13-4a-documentation-des-pages.md`
(lot 4a). Les plans socle (1) et lots (2a, 2b, 2c) alimentent la description de la PR.

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Pré-contrôles | [x] | 2026-11-13 | OK |
| 2 | Rebase et fusion 4a | [x] | 2026-11-13 | fusion e577c5d0 ; docs-check : 71 manquantes (platform 41, event 25, account 5), org complet |
| 3 | Rédaction des docs par espace (sous-agents) | [x] | 2026-11-13 | 3 sous-agents Sonnet, 71 docs |
| 4 | Tampon et `make docs-check` | [x] | 2026-11-13 | 71 tamponnées, docs-check vert, stamp déterministe |
| 5 | Relecture de l'orchestrateur | [ ] | | |
| 6 | e2e, doc, vérification complète | [ ] | | |
| 7 | Arrêt des stacks d'agents | [ ] | | |
| 8 | Push et PR | [ ] | | |

## Fichiers du lot (exclusifs)

Cette vague s'exécute dans le dossier principal. Elle ne modifie, hors résolution de conflit de la
fusion 4a, que :

- `src/content/page-docs/platform/**`, `src/content/page-docs/event/**`,
  `src/content/page-docs/account/**` (rédaction) et les fichiers générés
  `src/content/page-docs/manifest.generated.ts` et `index.generated.ts` (**uniquement via**
  `make docs-stamp`, jamais à la main) ;
- `src/content/page-docs/org/**` : retouches de relecture seulement si le pilote est incohérent
  avec les écrans finaux ;
- `docs/v4/specs/2026-11-13-36…` à `…-40…` (statut, journal) et le `## Progression` des plans du
  chantier ;
- `docs/v4/features/documentation-pages.md` (ajustements issus de la rédaction complète).

**En lecture seule (besoin d'y toucher → s'arrêter et le signaler)** : tout le code (`src/app/**`,
`src/components/**`, `src/lib/**`, `scripts/page-docs/**`), `prisma/schema.prisma`, `.env*`,
`docker-compose*.yml`, `Dockerfile*`, `Caddyfile`. Un écran qui contredit son code ou une
incohérence repérée en rédigeant (option absente, libellé fautif) : la **noter dans le journal de la
spec 40**, ne pas corriger le code ici.

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test »), valables pour tout test touché ou ajouté, y
compris en résolution de conflit :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (jamais la base de dev) ; `make test` la
  crée et la met au schéma.
- **Pas de mock de la base ni de Prisma** : vrai MySQL ; seuls les services externes se mockent.
- **Fabriques** : `src/test/factories.ts` ; pas de `prisma.*.create` dupliqués.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander.
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**`.
- **e2e** : contre l'app en cours d'exécution, fixtures préfixées et nettoyées.

Contraintes de la vague :

- **Pas d'appel à l'API Anthropic, pas de commande de régénération, pas de hook** : les sous-agents
  rédigent sur consigne, l'orchestrateur tamponne et vérifie.
- Fusion : `git merge --no-ff refs/heads/feat/roles-imprimeur-support-4a` après rebase de la branche
  de lot ; conflit limité aux fichiers du lot 4a (docs, outil, composants, pages `docs`) → résoudre,
  relancer les tests concernés ; conflit dans le code du socle ou des lots de rôles, ou dans
  `prisma/schema.prisma` → `git merge --abort`, journaliser, **s'arrêter et signaler**.
- Docs : français avec accents, vouvoiement, ton du guide utilisateur ; aucune option inventée ;
  libellés exacts de l'interface ; **jamais de secret, jeton, mot de passe ni donnée personnelle
  réelle** (exemples fictifs seulement).
- Jamais de `--force`, jamais de push sur `development`, **jamais de fusion de la PR**, aucune
  action sur la préprod ni la prod, aucune commande SSH, **aucun déploiement**, **ne pas modifier
  `.env*`**. Pas de `make db-reset` sans accord.
- Pas de co-auteur IA ni de mention d'IA dans les messages de commit ; messages en français ASCII,
  style conventional commits. Le corps de la PR n'a pas de signature d'outil.
- Échec répété d'une commande : s'arrêter et expliquer, ne pas boucler.

## Review Focus

- Une doc qui décrit une option **absente de l'écran** ou en invente une (anti-objectif de la
  spec 40) : la relecture compare chaque doc à sa page, option par option.
- Une doc qui expose une information sensible (secret SMTP, clé reCAPTCHA, jeton, adresse réelle de
  personne, numéro, identifiant de paiement réel) : recherche par motifs en plus de la lecture.
- Blocs `:::permission` : la clé existe, a la **portée de la page**, et correspond à la garde du
  serveur ; une section affichée sans le bloc qu'elle exige, ou masquée alors que l'écran la montre.
- Pages à rôle variable (plateforme : Imprimeur, Observateur, Support ; organisation : AGENT ;
  évènement : VIEWER, PRINTER) : le panneau n'affiche pas d'actions que le rôle n'a pas à l'écran.
- `make lint` vert alors qu'une doc est périmée : impossible, `docs-check` fait partie de `lint`.
- UI : e2e puis contrôle navigateur à 375, 1024 et 1280 px (menu latéral ~224 px dès `lg`).
- Cohérence des chiffres : le nombre de docs égale le nombre de pages découvertes, sans orpheline.

---

### Task 1: Pré-contrôles

- [ ] Branche, état, plan du lot :
  ```bash
  git rev-parse --abbrev-ref HEAD && git status --short
  git branch --list 'feat/roles-imprimeur-support-4a'
  grep -c "\[ \]\|\[~\]" docs/v4/plans/2026-11-13-4a-documentation-des-pages.md
  ```
  Expected: `feat/roles-imprimeur-support` ; arbre propre ; branche `-4a` ; compte `0` (sinon
  signaler et s'arrêter).
- [ ] Le lot 4a n'a touché que ses fichiers (liste de la spec 36 + ajouts du plan 4a : 
  `src/lib/page-docs/**`, `src/app/api/page-docs/**`, `e2e/transverse/page-docs.spec.ts`) :
  ```bash
  git diff --name-only feat/roles-imprimeur-support...feat/roles-imprimeur-support-4a \
    | grep -vE '^(scripts/(page-docs|__tests__/page-docs)/|src/content/page-docs/|src/components/page-docs/|src/lib/page-docs/|src/app/api/page-docs/|src/app/(platform|account)/docs/|src/app/org/\[orgId\]/docs/|src/app/event/\[eventId\]/docs/|Makefile$|package.json$|yarn.lock$|CLAUDE.md$|\.claude/|docs/v4/|e2e/transverse/page-docs.spec.ts$)'
  ```
  Expected: aucune ligne (sinon signaler et s'arrêter).
- [ ] Stack principale up (`app`, `mysql`, `rustfs`, `renderer`, `worker`) : `make dev` sinon.

### Task 2: Rebase et fusion 4a

- [ ] Rebaser puis fusionner :
  ```bash
  git -C ../badge-wt-4a rebase feat/roles-imprimeur-support
  git merge --no-ff refs/heads/feat/roles-imprimeur-support-4a -m "merge: lot 4a documentation des pages"
  ```
- [ ] Dépendances : `docker compose -f docker-compose.dev.yml exec app yarn install` (nouvelle
  dépendance `markdown-it`), `make db-push` (sans changement attendu), redémarrer app et worker :
  `docker compose -f docker-compose.dev.yml restart app worker`. Un 404 HTML sur une route API
  existante = redémarrer `app` avant de chercher dans le code.
- [ ] Vérifier : `make typecheck` puis `make test FILE=src/lib/page-docs` et
  `make test FILE=src/app/api/page-docs` ; `ls -l AGENTS.md` → toujours un lien vers `CLAUDE.md`.
- [ ] `make docs-check` : l'état attendu liste les pages **manquantes** de `platform`, `event`,
  `account` uniquement (l'espace `org` est complet). Noter les effectifs par espace dans le journal de
  la spec 40 : c'est la référence des tâches suivantes (79 avant le chantier rôles, davantage après :
  `/platform/roles`, `/platform/users/[userId]/permissions`, `/org/[orgId]/roles`,
  `/org/[orgId]/members/[userId]/permissions`, pages du poste sur place AGENT).

### Task 3: Rédaction des docs par espace (sous-agents)

Trois sous-agents **en arrière-plan, `model: "sonnet"`, lancés dans le même message**, un par
espace, dossiers disjoints (aucun conflit possible) :

| Sous-agent | Espace | Pages (avant chantier) | Fichiers écrits |
|---|---|---|---|
| plateforme | `/platform` | 37 (+ pages ajoutées par les rôles) | `src/content/page-docs/platform/**` |
| évènement | `/event/[eventId]` | 23 (+ pages ajoutées) | `src/content/page-docs/event/**` |
| compte | `/account` | 5 | `src/content/page-docs/account/**` |

(L'espace `org` est déjà documenté par le pilote du lot 4a : aucun sous-agent.)

- [ ] **Brief auto-suffisant de chaque sous-agent** : chemin absolu du dépôt ; son espace ; la liste de
  ses pages = sortie de `make docs-check` (« manquantes ») filtrée sur l'espace ; « lis la section
  *Documentation des pages* de `/Users/amadou/Devs/projects/badge/CLAUDE.md` et applique-la à la
  lettre » ; deux docs du pilote `org` comme modèles de ton et de structure ; livrable = un `.md` par
  page avec frontmatter `route`, `title`, `audience`, `access` (d'après la garde de la page) et le
  corps ; **interdits** : toucher au code, aux fichiers `*.generated.ts`, à `sources`, `sourceHash`,
  `updatedAt` ; ne pas lancer `docs-stamp` (l'orchestrateur le fait) ; ne pas lancer de commande
  `make`/Docker hors lecture ; ne pas committer ; rapport final dans
  `.superpowers/sdd/roles-permissions/docs-<espace>-report.md` : liste des docs écrites, incohérences
  d'écran relevées (option sans libellé, libellé fautif, comportement douteux), clés
  `:::permission` utilisées.
- [ ] Pour chaque page, le sous-agent lit la page et **tous** ses composants (les `sources` listées
  par `docs-check`), écrit les sections par bloc d'écran, explique chaque option (effet, valeur par
  défaut, contraintes, conséquences), pose les blocs `:::permission <clé>` autour des sections qui
  dépendent d'un droit (clé de la portée de la page), et se limite à ce que l'écran montre.
- [ ] À chaque rapport final : `TaskStop` du sous-agent (pas de moniteur laissé en vie). Un rapport
  incomplet (pages restantes) : reprise par `SendMessage` avec la liste des pages manquantes.
- [ ] Les incohérences relevées par les sous-agents sont reportées dans le journal de la spec 40 (pas
  de correction du code dans cette vague).

### Task 4: Tampon et `make docs-check`

- [ ] Vérifier d'abord le périmètre des sous-agents :
  ```bash
  git status --short | grep -vE 'src/content/page-docs/(platform|event|account)/|\.superpowers/' || echo OK
  ```
  Expected: `OK` (aucun fichier hors `src/content/page-docs/<espace>/**`).
- [ ] Tamponner : `make docs-stamp PAGES="platform event account"` (sources, empreinte, date,
  manifestes). Expected: aucune erreur de sélecteur ni de format.
- [ ] `make docs-check`. Expected: exit 0, aucune doc obsolète, manquante, orpheline ; format
  valide (frontmatter complet, `access` et clés `:::permission` au catalogue et de la bonne portée,
  blocs fermés). Un `format` rouge : renvoyer au sous-agent concerné (`SendMessage`) ou corriger
  le texte soi-même ; **jamais** éditer `sourceHash` ni les `*.generated.ts`.
- [ ] Déterminisme : relancer `make docs-stamp PAGES=all` puis `git diff --stat` ; Expected: aucun
  diff supplémentaire.
- [ ] Commit : `docs(pages): documentation des pages plateforme, evenement et compte`.

### Task 5: Relecture de l'orchestrateur

- [ ] **Cohérence avec l'écran** : pour chaque espace, lire toutes les docs et les comparer à leurs
  pages (échantillon exhaustif pour les pages à formulaires et paramètres : réglages plateforme,
  paramètres d'évènement, catégories, inscriptions, impression) ; vérifier dans le navigateur au
  moins une page par section avec le bouton « ? » (comptes du seed : SUPER_ADMIN, STAFF_SUPPORT,
  STAFF_PRINTER, STAFF_OBSERVER, OWNER, MANAGER, AUDITOR, AGENT, ADMIN, OPERATOR, PRINTER, VIEWER,
  participant). Une option citée absente de l'écran, ou une option de l'écran non expliquée : corriger
  le texte (puis re-tamponner).
- [ ] **Blocs `:::permission`** : pour chaque bloc, la clé correspond à la garde réelle du serveur
  (route et page) ; le panneau affiche/masque comme attendu pour au moins trois rôles différents sur
  trois pages (une par espace) ; liste des pages à rôles variables relue (Review Focus).
- [ ] **Aucune donnée sensible** :
  ```bash
  grep -rnEi "(password|mot de passe|secret|token|jeton|api[_-]?key|smtp(Password)?|recaptcha(SecretKey)?)[\"' :=]+[A-Za-z0-9+/_-]{8,}" src/content/page-docs || echo OK
  grep -rnE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" src/content/page-docs | grep -vE "@(example\.(com|org|net)|badge\.local)"
  ```
  Expected: `OK` ; second `grep` : aucune adresse réelle (seules des adresses fictives sont tolérées,
  liste relue à la main). Lecture des exemples chiffrés (montants, numéros) : fictifs.
- [ ] **Ton et forme** : français avec accents, vouvoiement, pas de jargon interne (noms de
  fichiers, clés techniques) hors blocs ; titres homogènes ; aucune doc vide ou à moitié rédigée.
- [ ] Corriger les écarts (textes uniquement), `make docs-stamp PAGES=…` des docs modifiées,
  `make docs-check` vert. Journaliser dans la spec 40 : nombre de docs relues, corrections, écarts de
  code relevés. Commit : `docs(pages): relecture de la documentation des pages`.

### Task 6: e2e, doc, vérification complète

- [ ] `make db-seed` (répare aussi le SMTP de dev vers Mailpit ; un échec e2e en masse se vérifie
  d'abord là).
- [ ] `make lint && make typecheck && make test-coverage`. Expected: lint 0 erreur (dont
  `docs-check`), typecheck OK, tous les tests passent, couverture 100 % sur `src/lib/**` et
  `src/app/api/**`.
- [ ] Arrêter les stacks de lot restantes (`scripts/agent-stack.sh status` puis `down`) pour ne pas
  saturer la machine, puis la suite e2e complète sans autre e2e en parallèle : `make test-e2e`. Un
  run unique tué (137, OOM) : rejouer par dossier (`e2e/platform`, `e2e/org`, `e2e/event`,
  `e2e/public`, `e2e/transverse`). Timeouts sous forte charge (`uptime` > 30) : rejouer le fichier seul
  avant de conclure. Tout échec dû au code de production : cause racine puis correctif avec test, ou
  signalement ; jamais d'adaptation du code pour le test.
- [ ] Contrôle navigateur final à **375, 1024 et 1280 px** : bouton « ? » et panneau (plein écran à
  375 px, pas de défilement horizontal), sections Documentation des quatre espaces, une lecture de
  doc avec tableau, menu de chaque espace ; console sans erreur 500 ni 404 HTML sur route existante.
  Remettre le viewport à `desktop`.
- [ ] Documentation : `docs/v4/features/documentation-pages.md` ajusté si la rédaction complète a
  fait évoluer le format ou la consigne ; spec 36 à 40 : statut « implémentée — <date> (PR
  ouverte) », journal avec les résultats (nombre de tests, couverture, e2e, docs rédigées par
  espace, navigateur) ; `## Progression` de tous les plans du chantier à jour (`[x]`, dates, notes ;
  aucune suppression de plan ni de spec). Commit :
  `docs: spec et plans du chantier roles et documentation a jour`.

### Task 7: Arrêt des stacks d'agents

- [ ] ```bash
  scripts/agent-stack.sh down 2a; scripts/agent-stack.sh down 2b; scripts/agent-stack.sh down 2c; scripts/agent-stack.sh down 4a
  scripts/agent-stack.sh status
  ```
  (les commandes sur une stack déjà arrêtée sont sans effet). Expected: plus aucune stack
  `badge-ag-*` ; la stack principale reste démarrée. Worktrees, branches de lot et bases
  `badge_<lot>*` / buckets `badge-<lot>*` sont **conservés** ; la commande de suppression est indiquée
  dans la PR.

### Task 8: Push et PR

- [ ] Rien d'indésirable (pas de `.env`, secret ni fichier d'`uploads/`) :
  ```bash
  git status --short && git diff --name-only development...HEAD | grep -E '(^|/)\.env|uploads/' || echo OK
  ```
  Expected: arbre propre ; `OK`.
- [ ] Pousser (jamais `--force`, jamais `development`) :
  ```bash
  git push -u origin feat/roles-imprimeur-support
  ```
- [ ] Ouvrir la PR vers `development` (corps écrit dans un fichier du scratchpad de la session, titre
  et corps en français ASCII, **sans signature d'outil ni mention d'IA**) :
  ```bash
  gh pr create --base development --head feat/roles-imprimeur-support \
    --title "Roles et permissions configurables, Imprimeur et Agent, loader des planches, quantite des accessoires, documentation des pages" \
    --body-file <fichier-corps>
  ```
  Corps : résumé par volet (spec 37 rôles et permissions : catalogue, rôles système figés et
  personnalisés, ajustements, `STAFF_PRINTER`, `AGENT`, gardes par permission, pages de gestion des
  droits ; spec 38 loader ; spec 39 quantité automatique ; spec 40 documentation : outil, panneau,
  sections, consigne aux agents, docs des N pages) ; décisions assumées (Observateur en lecture
  seule chez les clients, `STAFF_SUPPORT` recentré sur la validation, union rôle d'organisation +
  rôle d'évènement, `users.update` réservé à AD+) ; liste des plans ; résultats (lint avec
  `docs-check`, typecheck, couverture 100 %, e2e, contrôle navigateur à 375/1024/1280 px) ;
  échecs préexistants éventuels ; points à relire (schéma Prisma et colonnes d'enum conservées,
  `scripts/migrate-roles.ts` et `make migrate-roles` **à lancer sur chaque environnement avant
  d'utiliser les rôles** — hors de ce chantier —, anti-escalade, règle de portée des blocs
  `:::permission`, `AGENTS.md` lien symbolique) ; commande de nettoyage des worktrees, branches et
  bases de lot conservés. **Ne pas fusionner la PR.**
- [ ] Notifier l'utilisateur (URL de la PR, résultats, points d'attention) ; `## Progression` à jour
  (tâche 8 `[x]`) ; écrire `DONE` dans `.superpowers/sdd/roles-permissions/state.md` ; désactiver
  la tâche planifiée d'orchestration.
