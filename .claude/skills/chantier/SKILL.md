---
name: chantier
description: Organise un chantier non trivial du projet Badge à partir d'une spec validée - découpage en socle + lots parallèles à fichiers exclusifs + fusion, rédaction des plans en parallèle par des sous-agents, puis création d'une tâche planifiée qui orchestre l'exécution (un environnement d'agent par lot, revues, fusion, PR). Utiliser dès qu'une feature touche plusieurs zones du code ou demande plus d'une session.
---

# Chantier : du design validé à la PR, en parallèle

Méthode éprouvée sur le chantier « Commandes d'impression » (2026-11-02/03). Elle complète
`CLAUDE.md` (règles projet, **Règles de test**) et `.claude/CLAUDE.md` (méthode générique) : en cas
de conflit, ces deux fichiers font foi.

## 0. Préalables

1. **Version active** connue (sinon demander). **Spec validée** dans `docs/<version>/specs/` ; sans
   spec : `superpowers:brainstorming` d'abord, et ne pas aller plus loin avant validation.
2. Demander en **une seule question** ce qui manque parmi : nom court du chantier (slug ASCII,
   ex. `commandes-impression`), branche d'intégration (défaut `feat/<slug>`, partie de
   `development`).
3. Prérequis outillage (déjà en place depuis la vague 0 du premier chantier) : base de test
   dédiée, fabriques `src/test/factories.ts`, `scripts/agent-stack.sh`. Si un manque, le chantier
   commence par un plan « vague 0 » qui l'ajoute.

## 1. Découpage (écrit dans la spec, section « Organisation du travail »)

- **Vague 1 — socle** (séquentiel, dossier principal) : tout ce qui est **partagé** — schéma
  Prisma, helpers `src/lib/**` utilisés par plusieurs lots, shells et layouts, menus, renommages,
  contrats d'API consommés par plusieurs lots. Le socle fige les contrats (signatures, DTO, codes
  d'erreur) que les lots consomment.
- **Vague 2 — lots** (parallèles, **3 au maximum** : un environnement d'agent ≈ 1,5 Go et Docker
  plafonne à ~14 Go) : chacun avec une **liste de fichiers exclusifs** (globs) et une liste **en
  lecture seule** (contrats du socle). Aucun fichier modifiable dans deux lots. Un document partagé
  (doc de feature) est découpé en **sections** attribuées à un seul lot.
- **Vague 3 — fusion et PR** : ordre de fusion fixé, règles de conflit, vérification complète (dont `make docs-check` : docs des pages à jour).
- Plus de 3 lots indépendants : faire deux vagues de lots plutôt que plus de stacks.
- Écrire dans le journal de la spec une table de contrôle : une ligne par paire de lots qui
  partagent un fichier ou une interface (qui produit / qui consomme / verdict). Un fichier
  partagé non résolu = il remonte dans le socle.

## 2. Rédaction des plans en parallèle

Plans dans `docs/<version>/plans/<date>-<n>-<slug>.md` : `-1-socle-…`, `-2a-…`, `-2b-…`, `-2c-…`,
`-3-fusion-et-pr`. Lancer **un sous-agent par plan, tous dans le même message**, `model: "sonnet"`,
chacun avec : la spec, la section « Organisation du travail », la liste de fichiers de son lot,
les contrats du socle, et la consigne d'utiliser `superpowers:writing-plans`.

Chaque plan contient obligatoirement :
- en-tête **Exécution** : où il tourne (dossier principal ou `scripts/agent-stack.sh up <lot>
  <branche>`), « toutes les commandes `make` dans le worktree », « en exécution automatisée, un
  commit par tâche est autorisé sur la branche du plan ; sinon aucun commit sans demande » ;
- `## Progression` (table Task / Intitulé / Statut / Date / Notes, statuts `[ ]`, `[~]`, `[x]`,
  `[-]`) ;
- `## Fichiers du lot (exclusifs)` et la liste en lecture seule, avec « besoin d'y toucher →
  s'arrêter et le signaler » ;
- `## Global Constraints` reprenant les **Règles de test** de `CLAUDE.md` (base `_test`, pas de
  mock de la base ni de Prisma, fabriques, ne jamais modifier le code de prod pour un test,
  couverture 100 % sur `src/lib/**` et `src/app/api/**`) ;
- `## Review Focus` ; pour toute UI : e2e Playwright **et** contrôle à 375, 1024 et 1280 px (le
  menu latéral occupe ~224 px dès `lg` : prévoir les points de rupture en conséquence) ;
- une dernière tâche « e2e, doc, vérification » (`make lint && make typecheck && make
  test-coverage` + e2e du lot) qui inclut **la mise à jour des docs des pages du lot**
  (`make docs-stamp PAGES="…"`, consigne de la section « Documentation des pages » du `CLAUDE.md`)
  et `make docs-check` vert.

Puis **relecture croisée par l'agent principal** : contrats socle ↔ lots (noms, signatures,
formats d'évènement), cohérence des listes exclusives, tâches qui se contredisent. Amender les
plans, journaliser chaque arbitrage dans la spec.

## 3. Validation utilisateur

Présenter : découpage, plans, fichiers par lot, ce que la tâche fera seule (commits par tâche sur
les branches du chantier, push et PR en fin, jamais de fusion de PR). **Attendre un accord
explicite** avant de créer la tâche planifiée.

## 4. Tâche planifiée d'orchestration

Créer la tâche avec `create_scheduled_task` (toutes les 15 min, `*/15 * * * *`) dont le prompt est
[orchestrator-template.md](orchestrator-template.md) rempli (remplacer chaque `{{…}}`). Ajouter un
plan `-3-fusion-et-pr` s'il manque. Indiquer à l'utilisateur : nom de la tâche, où suivre l'état
(`.superpowers/sdd/<slug>/state.md`), et qu'elle ne tourne que Claude Desktop ouvert et la
machine éveillée (avec Docker Desktop lancé).

## Pièges connus (intégrés au modèle)

- **Charge machine** : 3 stacks + l'app principale + Chromium saturent l'hôte ; Docker doit avoir
  ~14 Go. Ne pas lancer d'e2e en parallèle sur la même stack.
- **404 sur une route API dynamique existante** : Turbopack a perdu ses routes (fréquent après une
  fusion ou un redémarrage de Docker). Redémarrer le conteneur app ; si ça persiste, purger
  `/app/.next/dev` dans ce conteneur — **avec l'accord de l'utilisateur**.
- **Worker** : il ne recharge pas le code ; le redémarrer après une fusion qui touche du code
  exécuté par le worker.
- **Sous-agents qui renvoient leur rapport en boucle** ou laissent des moniteurs : `TaskStop` dès
  le rapport final reçu, pour éviter des `make test` parallèles sur la même base.
- **Fusion d'entrées de fil / mise à jour sur place** incompatibles avec un polling `?after=` :
  préférer une ligne par évènement.
- Les revues de lot ne voient pas les autres lots : l'orchestrateur vérifie lui-même les défauts
  transverses (un défaut trouvé dans un lot → chercher son jumeau dans les autres).
