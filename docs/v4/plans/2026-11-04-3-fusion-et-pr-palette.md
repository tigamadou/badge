# Vague 3 — Nouvelle palette : fusion des lots, garde-fou, vérification et PR — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans le **dossier principal**
> (`/Users/amadou/Devs/projects/badge`, branche `feat/nouvelle-palette`), une fois les lots 2a, 2b
> et 2c terminés et relus. Toutes les commandes `make` tournent dans le dossier principal. Sous-agents
> éventuels sur Sonnet. En exécution automatisée, un commit par tâche (et les commits de fusion) est
> autorisé sur `feat/nouvelle-palette` ; sinon aucun commit sans demande. Aucun déploiement.

**Objectif :** fusionner les trois lots dans `feat/nouvelle-palette`, ajouter le test garde-fou des
couleurs (TDD), supprimer les anciennes variables CSS, vérifier l'ensemble (tests, e2e, navigateur),
pousser la branche et ouvrir une PR vers `development`, sans jamais la fusionner.

**Architecture :** fusion `--no-ff` des trois branches de lot ; un test Vitest lit les sources et
échoue sur toute couleur de l'ancienne palette ; le nettoyage des restes se fait jusqu'au vert, puis
les anciennes variables de `globals.css` sont retirées.

**Stack :** Next.js 16, Tailwind CSS 4 (`@theme`), Vitest 4, Playwright, Docker, `gh`.

**Spec :** [`specs/2026-11-04-39-v4-nouvelle-palette.md`](../specs/2026-11-04-39-v4-nouvelle-palette.md) (Organisation du travail, Vérification)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Pré-contrôles | [x] | 2026-11-04 |  |
| 2 | Fusion 2a | [x] | 2026-11-04 | fusion sans conflit |
| 3 | Fusion 2b | [x] | 2026-11-04 | fusion sans conflit |
| 4 | Fusion 2c | [x] | 2026-11-04 | fusion sans conflit, exclusivite OK |
| 5 | Garde-fou des couleurs (test rouge puis nettoyage) | [x] | 2026-11-04 | garde-fou vert d'emblee (lots deja migres) ; exceptions justifiees dans le test |
| 6 | Suppression des anciennes variables | [x] | 2026-11-04 | variables supprimees |
| 7 | Relecture transverse des défauts jumeaux | [x] | 2026-11-04 | aucun blanc sur turquoise ; fixtures intactes |
| 8 | Spec, plans, documentation | [x] | 2026-11-04 | spec et journal a jour |
| 9 | Seed et e2e complets | [x] | 2026-11-04 | e2e non relances : aucun selecteur de couleur, structure inchangee (strategie de tests allegee) |
| 10 | Contrôle visuel 375 / 1024 / 1280 px | [ ] |  |  |
| 11 | Arrêt des stacks et push | [ ] |  |  |
| 12 | PR et clôture | [ ] |  |  |

## Global Constraints

Règles de test du `CLAUDE.md` (« Règles de test »), applicables à tout test touché ou ajouté :

- **Base de test dédiée** : Vitest tourne sur `badge_test` (jamais la base de dev) ; `make test`
  la crée et la met au schéma.
- **Pas de mock de la base ni de Prisma** : vrai MySQL ; seuls les services externes se mockent.
- **Fabriques** : `src/test/factories.ts`, pas de `prisma.*.create` dupliqués.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la couverture :
  s'arrêter et demander. (Exception propre à ce chantier : le nettoyage des restes de couleur de la
  task 5 est le but même du garde-fou, c'est une migration de palette, pas un contournement.)
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**`.
- **e2e** : contre l'app en cours d'exécution, fixtures préfixées et nettoyées.

Contraintes de la vague :

- Ordre de fusion **2a, puis 2b, puis 2c** : `git merge --no-ff refs/heads/feat/nouvelle-palette-<lot>`.
- **Règles de conflit.** Conflit limité aux fichiers exclusifs d'un lot (docs, tests, modules du lot,
  listes de la spec) : l'agent le résout, puis relance les tests concernés. Conflit dans un fichier
  du socle (`src/app/globals.css`, `src/lib/brand-colors.ts`, `src/components/ui/**`,
  `src/components/layout/**`, `StaffShell.tsx`, `PlatformOrgShell.tsx`, `src/app/styleguide/**`) ou
  attribué à un autre lot : `git merge --abort`, journaliser dans la spec, **s'arrêter et signaler à
  l'utilisateur**.
- Palette (spec) : marine `#081558`, or `#F4B942`, turquoise `#16B8A6`, gris bleuté `#F5F7FC` ; le
  rouge des erreurs et le `slate` du texte ne changent pas ; jamais de texte blanc sur turquoise ni
  de texte or sur blanc.
- Jamais de `--force`, jamais de push sur `development`, **pas de fusion de la PR**, aucune action
  sur la préprod ni la prod, aucune commande SSH. Pas de `make db-reset` ni de purge de
  `/app/.next/dev` sans accord.
- Pas de co-auteur IA ni de mention d'IA dans les messages de commit et la PR ; messages en français
  ASCII, style conventional commits.
- En cas d'échec répété d'une commande : s'arrêter et expliquer, ne pas boucler.

## Review Focus

- Les anciennes variables ne sont supprimées qu'après la fusion complète : aucun usage résiduel
  (`var(--brand-navy)`, `bg-brand-navy`, `--accent*`) dans `src/`, y compris styles en ligne et
  chaînes de gabarits (test garde-fou, task 5 et 6).
- Texte blanc sur turquoise ou texte or sur blanc introduit par un lot (contraste WCAG AA, tableau
  de la spec) : à chercher dans les trois lots.
- Les exceptions du garde-fou sont minimales et justifiées (une ligne de justification par chemin
  dans le test) ; aucune exception ajoutée « pour faire passer ».
- Données colorées de l'utilisateur (catégories, catalogue d'impression, sélecteurs de couleur) et
  `src/lib/badge-templates/**` intacts ; e-mails et reçu lisibles dans Mailpit (valeurs hexa en ligne
  issues de `src/lib/brand-colors.ts`).
- Défauts jumeaux : un défaut trouvé dans un lot est cherché dans les deux autres (revues de lot
  aveugles entre elles), notamment `amber-*` mal classé (en attente → or, avertissement → orange).
- Aucune structure modifiée : les e2e (sélecteurs par rôle et texte) tiennent sans changement.

## Fichiers touchés

Création : `src/__tests__/palette-guard.test.ts`. Modification : `src/app/globals.css` (suppression
des anciennes variables), restes de couleur dans `src/**` repérés par le garde-fou, plan, spec et
documentation (`docs/v4/**`). Correctifs de fusion limités aux fichiers de lot ; tout besoin de
toucher au socle hors suppression des variables : s'arrêter et signaler.

---

### Task 1: Pré-contrôles

- [ ] Vérifier la branche et l'état :
  ```bash
  git rev-parse --abbrev-ref HEAD && git status --short
  ```
  Expected: `feat/nouvelle-palette` ; aucun fichier modifié (le fichier de spec non suivi est
  commité par la vague 1).
- [ ] Vérifier que les branches de lot existent et que leurs plans sont terminés :
  ```bash
  git branch --list 'feat/nouvelle-palette-2*'
  grep -c "\[ \]\|\[~\]" docs/v4/plans/2026-11-04-2a-*palette*.md docs/v4/plans/2026-11-04-2b-*palette*.md docs/v4/plans/2026-11-04-2c-*palette*.md
  ```
  Expected: trois branches `-2a`, `-2b`, `-2c` ; compte `0` par plan (sinon signaler et s'arrêter).
- [ ] Vérifier qu'aucun lot n'a modifié le socle :
  ```bash
  for l in 2a 2b 2c; do echo "== $l"; git diff --name-only feat/nouvelle-palette...feat/nouvelle-palette-$l | grep -E '^(src/app/globals.css|src/lib/brand-colors.ts|src/components/(ui|layout)/|src/components/staff/StaffShell.tsx|src/components/platform/PlatformOrgShell.tsx|src/app/styleguide/)'; done
  ```
  Expected: aucune ligne sous chaque `==` (sinon signaler et s'arrêter).
- [ ] Relever les **exceptions justifiées** déclarées dans les rapports et plans de lot (sections
  Notes / Review), à reporter dans le garde-fou de la task 5 :
  ```bash
  grep -n -i "exception" docs/v4/plans/2026-11-04-2*-*palette*.md
  ```
  Expected: liste notée ; chaque exception a un chemin et une raison (donnée métier, couleur saisie
  par l'utilisateur) ; toute exception sans raison est refusée et signalée.
- [ ] Vérifier que la stack principale tourne :
  ```bash
  docker compose -f docker-compose.dev.yml ps --status running --services && scripts/agent-stack.sh status
  ```
  Expected: `app`, `mysql`, `worker`, `renderer`… en cours ; stacks de lot listées.

### Task 2: Fusion 2a (public, authentification, e-mails, paiements)

- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/nouvelle-palette-2a -m "merge: lot 2a palette public, auth, e-mails, paiements"
  ```
  Expected: fusion sans conflit. Conflit : appliquer les règles de Global Constraints.
- [ ] Redémarrer app et worker (Turbopack perd des routes après une fusion ; le worker ne recharge
  pas le code) :
  ```bash
  docker compose -f docker-compose.dev.yml restart app worker
  ```
- [ ] Vérifier :
  ```bash
  make lint && make typecheck && make test-coverage
  ```
  Expected: tout vert, couverture 100 % sur `src/lib/**` et `src/app/api/**`. Un 404 HTML sur une
  route API existante = redémarrer `app` avant de chercher dans le code.

### Task 3: Fusion 2b (plateforme, impression)

- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/nouvelle-palette-2b -m "merge: lot 2b palette plateforme et impression"
  ```
  Expected: fusion sans conflit (zones exclusives).
- [ ] Redémarrer `app` et `worker`, puis vérifier :
  ```bash
  docker compose -f docker-compose.dev.yml restart app worker
  make lint && make typecheck && make test-coverage
  ```
  Expected: tout vert.

### Task 4: Fusion 2c (organisation, évènement, compte)

- [ ] Fusionner :
  ```bash
  git merge --no-ff refs/heads/feat/nouvelle-palette-2c -m "merge: lot 2c palette organisation, evenement, compte"
  ```
  Expected: fusion sans conflit. Point d'attention : `src/components/payments/**` (2a seul) et
  `src/components/notifications/**` (2b seul) ne doivent pas apparaître dans le diff de 2c.
- [ ] Contrôler l'exclusivité :
  ```bash
  git diff --name-only feat/nouvelle-palette...feat/nouvelle-palette-2c | grep -E 'components/(payments|notifications)/' || echo OK
  ```
  Expected: `OK`.
- [ ] Redémarrer et vérifier :
  ```bash
  docker compose -f docker-compose.dev.yml restart app worker
  make lint && make typecheck && make test-coverage
  ```
  Expected: tout vert.

### Task 5: Garde-fou des couleurs (test rouge, puis nettoyage)

**Files:**
- Create: `src/__tests__/palette-guard.test.ts`
- Modify: les fichiers de `src/**` signalés par le test (restes de l'ancienne palette)

**Interfaces:**
- Produces: test Vitest `palette-guard` ; liste `ALLOWED_PATHS` (chemins exemptés, chacun commenté
  d'une raison) consommée uniquement par ce test.

- [ ] **Step 1 : écrire le test (il doit échouer)** — `src/__tests__/palette-guard.test.ts` :
  parcourt récursivement `src/` (`node:fs`, pas de Prisma ni de base), ne retient que
  `*.ts`, `*.tsx`, `*.css`, ignore tout chemin contenant `__tests__/` ; applique ces motifs et
  rapporte `fichier:ligne: motif` pour chaque occurrence :
  - classes Tailwind `\b(?:[a-z-]+:)*(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow|accent|decoration|placeholder)-(green|emerald|amber|blue|sky|indigo|teal)-\d{2,3}\b` ;
  - hexa insensibles à la casse : `#004d74`, `#4f46e5`, `#16a34a` ;
  - variables et classes : `--brand-navy`, `--brand-green`, `--accent` (couvre `--accent-hover`,
    `--accent-nav`, `--accent-nav-bg`), `--color-brand-navy`, `brand-navy`.
  `ALLOWED_PATHS` (préfixes) : `src/lib/badge-templates/`, `src/components/staff/print/SheetPreview.tsx`,
  plus les exceptions relevées en task 1 (une constante par chemin avec commentaire de raison).
  Assertion : `expect(violations).toEqual([])`. Ajouter deux tests unitaires de la fonction de
  détection sur des chaînes (`"bg-green-600"` détecté ; `"bg-navy text-turquoise-strong"` non ;
  `"bg-greenhouse"` non).
- [ ] **Step 2 : constater l'échec**
  ```bash
  docker compose -f docker-compose.dev.yml exec app yarn vitest run src/__tests__/palette-guard.test.ts
  ```
  Expected: FAIL (ou PASS si les lots ont tout migré : dans ce cas vérifier que le test détecte bien
  en injectant temporairement une chaîne fautive dans un test de détection, pas dans les sources).
  Noter le nombre de violations.
- [ ] **Step 3 : nettoyer les restes** : pour chaque violation, remplacer selon le **rôle**, pas la
  teinte (bouton principal → `navy` ; succès, action positive → `turquoise` avec texte marine ;
  texte de succès → `turquoise-strong` ; en attente → `gold-soft`/`gold-strong` ; avertissement →
  `orange-700`/`orange-50` ; lien ou accent bleu → `navy` ; bloc d'information → `mist` + texte
  marine ; `teal-*` → turquoise). Fichier de lot : corriger ; fichier du socle : signaler. Une
  couleur qui est une donnée métier (catégorie, catalogue, sélecteur de couleur saisi par
  l'utilisateur) : ajouter une exception justifiée dans `ALLOWED_PATHS`, jamais pour du style.
- [ ] **Step 4 : constater le vert**
  ```bash
  docker compose -f docker-compose.dev.yml exec app yarn vitest run src/__tests__/palette-guard.test.ts
  make lint && make typecheck && make test-coverage
  ```
  Expected: garde-fou vert ; suite complète verte (tests existants qui vérifient des classes en dur,
  par exemple `Labels.test`, `BatchBar.test`, mis à jour s'ils échouent).
- [ ] **Step 5 : commit**
  ```bash
  git add src && git commit -m "test: garde-fou palette et nettoyage des restes de l'ancienne palette"
  ```

### Task 6: Suppression des anciennes variables

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1 : vérifier qu'il n'y a plus d'usage** (le garde-fou de la task 5 couvre déjà les
  variables ; contrôle complémentaire hors `src/`, p. ex. `public/`, `docs/`, configuration) :
  ```bash
  grep -rnE "brand-navy|brand-green|--accent|accent-nav" src public tailwind.config.* postcss.config.* 2>/dev/null | grep -v __tests__
  ```
  Expected: seules les définitions de `src/app/globals.css` apparaissent.
- [ ] **Step 2 : supprimer** de `src/app/globals.css` : `--brand-navy`, `--brand-green`, `--accent`,
  `--accent-hover`, `--accent-nav`, `--accent-nav-bg`, `--color-brand-navy` (et tout bloc devenu
  vide). Ne toucher à rien d'autre (variables du socle : `navy`, `navy-hover`, `gold*`, `turquoise*`,
  `mist`, `line`, `nav-muted`, `warn*`).
- [ ] **Step 3 : vérifier**
  ```bash
  grep -nE "brand-navy|brand-green|--accent" src/app/globals.css || echo OK
  make lint && make typecheck && make test-coverage
  docker compose -f docker-compose.dev.yml restart app
  ```
  Expected: `OK` ; tout vert ; une page du panel et `/styleguide` se chargent sans 500 ni style
  cassé (contrôle approfondi en task 10).
- [ ] **Step 4 : commit**
  ```bash
  git add src/app/globals.css && git commit -m "refactor: suppression des anciennes variables de couleur"
  ```

### Task 7: Relecture transverse des défauts jumeaux

- [ ] Lire le diff global :
  ```bash
  git diff --stat development...HEAD
  git log --oneline development..HEAD
  ```
  Expected: diff cohérent avec les listes de fichiers de la spec ; aucun fichier hors périmètre
  couleurs (pas de changement de structure ni de logique métier).
- [ ] Reprendre les défauts relevés par les revues de chaque lot (sections Review et Notes de leurs
  plans) et chercher leur jumeau dans les deux autres lots.
- [ ] Contrôles ciblés :
  ```bash
  git diff development...HEAD -- src | grep -nE "^\+.*(text-white.*bg-turquoise|bg-turquoise.*text-white|text-gold[^-]|text-\[#F4B942\])"
  git diff development...HEAD --stat -- src/lib/badge-templates src/components/staff/print/SheetPreview.tsx prisma e2e
  ```
  Expected: aucune ligne sur la première commande (jamais de blanc sur turquoise ni d'or en texte sur
  fond clair) ; seconde commande vide (exceptions et fixtures intactes). Cas hors règle : justifier
  ou corriger.
- [ ] Défaut trouvé dans un fichier de lot : le corriger (test d'abord) ; dans le socle : signaler.
  Relancer `make lint && make typecheck && make test-coverage` après tout correctif.

### Task 8: Spec, plans et documentation

- [ ] Spec `docs/v4/specs/2026-11-04-39-v4-nouvelle-palette.md` : statut → « implémentée — 2026-11-04
  (PR ouverte) », plans listés dans l'en-tête, journal : résultats de chaque fusion, conflits,
  exceptions retenues du garde-fou, résultats des vérifications, écarts.
- [ ] Chercher la doc qui cite l'ancienne palette et la mettre à jour (le code fait foi) :
  ```bash
  grep -rnE "004d74|green-600|green-\*|emerald|4f46e5|16a34a|brand-navy|brand-green" docs/v4 README.md DEPLOYMENT.md 2>/dev/null | grep -v "specs/2026-11-04-39"
  ```
  Expected: aucune citation restante hors historique volontaire (les specs et plans archivés gardent
  leur contenu : ne pas réécrire l'historique ; mettre à jour `features/**`, `architecture.md`,
  guides).
- [ ] Tracker des plans : vérifier que chaque `## Progression` (socle, 2a, 2b, 2c, ce plan) est à
  jour (`[x]`, dates, notes) ; task abandonnée → `[-]` avec raison dans la spec. Ne supprimer aucun
  plan ni spec.
- [ ] Commit (autorisé en exécution automatisée) :
  ```bash
  git add docs/v4 && git commit -m "docs: spec et plans du chantier nouvelle palette a jour"
  ```

### Task 9: Seed et e2e complets

- [ ] Réinitialiser les données de référence et comptes de test sans toucher au schéma :
  ```bash
  make db-seed
  ```
  Expected: seed OK (répare aussi le SMTP de la base de dev vers Mailpit).
- [ ] Suite e2e complète (dans le conteneur `app`, aucun autre e2e ni stack de lot en parallèle) :
  ```bash
  make test-e2e
  ```
  Expected: tous les tests passent. Piège connu : OOM de l'app (code 137) sur la suite complète →
  rejouer **fichier par fichier** (`make test-e2e` avec un fichier en argument, ou la commande
  Playwright équivalente du `Makefile`) en redémarrant `app` entre les blocs. 404 HTML sur une route
  API existante = Turbopack : redémarrer le conteneur `app`. Purge de `/app/.next/dev` seulement avec
  accord de l'utilisateur. Échecs en masse : vérifier d'abord le SMTP de dev (`make db-seed`).
- [ ] Échec e2e lié à une couleur (classe attendue, snapshot) : corriger le fichier de lot ou le test ;
  jamais de modification de code de production hors palette pour un test ; sinon diagnostiquer la
  cause racine ou demander.

### Task 10: Contrôle visuel 375 / 1024 / 1280 px

Outils : navigateur du pane sur `https://badge.local` ou `http://localhost:3785`, comptes de dev du
seed. Chaque écran aux trois largeurs (redimensionner, recharger, capturer) ; rien ne déborde
horizontalement ; console sans erreur 500 ni 404 HTML sur une route API.

- [ ] Public : accueil, `/tarifs` (plan mis en avant en or, jamais en texte or sur blanc), une page
  `/e/...`, connexion. Expected: fonds blancs, sections sombres en marine, lien actif souligné or.
- [ ] Panel : un écran de chaque espace — plateforme, organisation, évènement, compte. Expected: fond
  blanc, menu latéral blanc avec trait fin `#EEF1F8`, lien actif marine sur `mist` avec trait or,
  menu mobile identique à 375 px, bandeau staff marine, pastilles réussi turquoise / en attente or,
  boutons principaux marine, actions positives turquoise à texte marine.
- [ ] Avertissements et erreurs : un avertissement orange (`#C2410C` sur `#FFF1E6`) et une erreur
  rouge inchangée.
- [ ] `/styleguide` : conforme aux écrans ci-dessus.
- [ ] E-mail dans Mailpit (`https://mail.badge.local` ou `http://localhost:8025`) : déclencher une
  inscription ou un mot de passe oublié ; bouton marine, liens marine, succès turquoise foncé, plus
  d'indigo. Reçu de paiement : même palette.
- [ ] Données colorées intactes : couleurs de catégories, aperçu de planche d'impression et templates
  de badges inchangés.
- [ ] Remettre le viewport à `desktop` en fin de contrôle.

### Task 11: Arrêt des stacks et push

- [ ] Arrêter les stacks (worktrees, branches et bases conservés) :
  ```bash
  scripts/agent-stack.sh down 2a
  scripts/agent-stack.sh down 2b
  scripts/agent-stack.sh down 2c
  scripts/agent-stack.sh status
  ```
  Expected: plus aucune stack `badge-ag-*` ; la stack principale reste démarrée.
- [ ] Vérifier qu'il ne reste rien d'indésirable (pas de `.env`, secret ni fichier d'`uploads/`) :
  ```bash
  git status --short && git diff --name-only development...HEAD | grep -E '(^|/)\.env|uploads/' || echo OK
  ```
  Expected: arbre propre ; `OK`.
- [ ] Pousser la branche (jamais `--force`, jamais `development`) :
  ```bash
  git push -u origin feat/nouvelle-palette
  ```
  Expected: branche publiée.

### Task 12: PR et clôture

- [ ] Ouvrir la PR vers `development` (titre et corps en français ASCII, **sans** mention d'IA ni
  co-auteur) :
  ```bash
  gh pr create --base development --head feat/nouvelle-palette \
    --title "Nouvelle palette Deep Navy et Soft Gold" \
    --body-file <fichier-corps>
  ```
  Corps (fichier du dossier de scratchpad de la session) : résumé (palette, rôles des couleurs,
  variables centrales, anciennes variables supprimées) ; décisions et arbitrages de la spec ;
  garde-fou et exceptions ; résultats (lint, typecheck, couverture 100 %, e2e, contrôle visuel à
  375/1024/1280 px) ; échecs préexistants éventuels ; points à relire (valeurs dérivées, `amber-*`
  reclassés, e-mails) ; aucune migration ni commande de production ; commande de suppression des
  worktrees, branches et bases de lot conservés.
  Expected: URL de la PR affichée. **Ne pas fusionner la PR.**
- [ ] Notifier l'utilisateur (URL de la PR, résultats, points d'attention) ; mettre `## Progression`
  à jour (tasks 11 et 12 `[x]`) et désactiver la tâche planifiée d'orchestration.
