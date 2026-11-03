# Vague 3 — Seed de démo : fusion des lots, vérification et PR — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans le dossier principal, une fois les
> lots 2a, 2b et 2c terminés et relus. Sous-agents éventuels sur Sonnet. En exécution automatisée,
> un commit par tâche est autorisé sur `feat/seed-demo` ; sinon aucun commit sans demande.

**Objectif :** fusionner les trois lots dans `feat/seed-demo`, vérifier l'ensemble (dont le seed de
démo de bout en bout), pousser la branche et ouvrir une PR.

**Spec :** [`specs/2026-11-03-37-v4-seed-de-demo.md`](../specs/2026-11-03-37-v4-seed-de-demo.md) (Organisation du travail)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Fusion 2a | [x] | 2026-11-03 | sans conflit |
| 2 | Fusion 2b | [x] | 2026-11-03 | sans conflit |
| 3 | Fusion 2c | [x] | 2026-11-03 | sans conflit |
| 4 | Vérification complète | [x] | 2026-11-03 | lint, typecheck, couverture 100 % (3829 tests), seed 22 s idempotent, e2e 451/452 (1 échec préexistant), navigateur 375/1280 OK ; rejeu db push --force-reset du lot 2c non fait |
| 5 | Push et PR | [x] | 2026-11-03 | |
| 6 | Nettoyage des stacks d'agents | [x] | 2026-11-03 | stacks arrêtées, worktrees et branches conservés |

## Global Constraints

- Ordre de fusion : 2a, puis 2b, puis 2c ; `git merge --no-ff refs/heads/feat/seed-demo-<lot>` dans
  `feat/seed-demo`.
- Conflit limité aux fichiers d'un lot (docs, tests, modules du lot) : le résoudre, relancer les
  tests concernés. Conflit dans du code partagé (`prisma/seed/demo/index.ts`, `context.ts`,
  `src/lib/**`, schéma, compose) : `git merge --abort`, journaliser, notifier, s'arrêter.
- Jamais de `--force`, jamais de push sur `development`, pas de fusion de la PR, aucune action
  sur la préprod ni la prod.

## Review Focus

- Le seed de démo complet tourne de bout en bout en dev (`make db-seed && make db-seed-demo`),
  une seconde fois sans reset (idempotence), en un temps compatible avec un déploiement préprod
  (durée mesurée et notée dans la PR).
- La séquence préprod de 2c fonctionne avec les modules fusionnés (reproduite localement avec
  `BADGE_ENV=preprod`), et le chemin prod de `deploy.sh` est inchangé (`git diff`).

### Tasks 1 à 3: Fusions

- [ ] Fusion 2a ; `make typecheck` ; tests du lot.
- [ ] Fusion 2b ; idem.
- [ ] Fusion 2c ; idem ; relecture de `docs/v4/installation.md` et `DEPLOYMENT.md`.

### Task 4: Vérification complète

- [ ] Redémarrer app et worker ; `make lint && make typecheck && make test-coverage` (100 %).
- [ ] `make db-seed && make db-seed-demo` (durée), relance sans reset, puis `make db-seed` seul
  (seul le SUPER_ADMIN est créé hors données de référence).
- [ ] Séquence préprod reproduite localement (`BADGE_ENV=preprod`) et `smoke-tests` dans les deux
  modes.
- [ ] e2e complets (`make test-e2e`) : ils ne dépendent pas du seed.
- [ ] Contrôle navigateur avec des comptes de démo de chaque type (staff, owner, admin, rôle
  d'évènement, participant) à 375 et 1280 px : listes longues, commandes, abonnement, journal.

### Task 5: Push et PR

- [ ] `git push -u origin feat/seed-demo`.
- [ ] `gh pr create` : base `development` si la PR #25 (`feat/commandes-impression`) est fusionnée,
  sinon base `feat/commandes-impression`. Titre « Seed de démo complet et préprod rechargée à
  chaque déploiement » ; description : décisions de la spec, plans, résultats, durée du seed,
  points à relire (deploy.sh, compose, smoke tests).
- [ ] Notifier l'utilisateur ; désactiver la tâche planifiée.

### Task 6: Nettoyage

- [ ] `scripts/agent-stack.sh down 2a|2b|2c`. Worktrees, branches et bases conservés ; commande de
  suppression indiquée dans la PR.
