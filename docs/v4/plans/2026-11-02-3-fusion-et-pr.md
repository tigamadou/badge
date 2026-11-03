# Vague 3 — Fusion des lots, vérification et PR — Plan d'implémentation

> **Exécution :** par l'orchestrateur (tâche planifiée), dans le dossier principal, une fois les
> lots 2a, 2b et 2c terminés (toutes leurs tâches cochées, rapport « prêt à fusionner »).
> Sous-agents éventuels sur Sonnet 5.5.

**Objectif :** fusionner les trois lots dans `feat/commandes-impression`, vérifier l'ensemble,
pousser la branche et ouvrir une PR vers `development`.

**Spec :** [`specs/2026-11-02-36-v4-commandes-d-impression.md`](../specs/2026-11-02-36-v4-commandes-d-impression.md) (Organisation du travail)

## Progression

| Task | Intitulé | Statut | Date | Notes |
|---|---|---|---|---|
| 1 | Fusion 2a | [x] | 2026-11-03 | eb95ae9, sans conflit |
| 2 | Fusion 2b | [x] | 2026-11-03 | 5e92069 ; conflits tests et doc (fil sans regroupement) résolus |
| 3 | Fusion 2c | [x] | 2026-11-03 | sans conflit ; impression-demandes.md relu |
| 4 | Vérification complète | [x] | 2026-11-03 | lint 0 erreur, typecheck OK, 3700 tests à 100 %, e2e impression 63/63 (après purge du cache Turbopack et redémarrage du worker), contrôle navigateur 375/1280 |
| 5 | Push et PR | [x] | 2026-11-03 | |
| 6 | Nettoyage des stacks d'agents | [ ] | | |

## Global Constraints

- Ordre de fusion : 2a, puis 2b, puis 2c ; `git merge --no-ff` de `feat/commandes-impression-<lot>`
  (référence complète `refs/heads/…`) dans `feat/commandes-impression`.
- Conflit limité à des fichiers propres aux lots (docs, tests, composants du lot) : le résoudre,
  relancer les tests concernés. Conflit dans du code partagé (`src/lib/**` hors fichiers créés
  par le lot, `prisma/schema.prisma`, shells, layouts) : **s'arrêter**, laisser la fusion en
  cours annulée (`git merge --abort`), noter le conflit dans le journal et notifier.
- Jamais de `--force`, jamais de push sur `development`, pas de fusion de la PR.

## Review Focus

- Les trois lots modifient `docs/v4/features/impression-demandes.md` (parties distinctes) : le
  document final doit être cohérent (relecture complète).
- Les compteurs de menu (staff et organisateur) et les non-lus fonctionnent ensemble après
  fusion.

---

### Tasks 1 à 3: Fusions

- [ ] Fusion 2a ; `make typecheck` ; tests du lot (`make test FILE=…` des fichiers du lot).
- [ ] Fusion 2b ; idem.
- [ ] Fusion 2c ; idem ; relecture de `impression-demandes.md`.

### Task 4: Vérification complète

- [ ] `make lint && make typecheck && make test-coverage` (100 %).
- [ ] e2e d'impression : `e2e/platform/print-*.spec.ts`, `e2e/event/print-*.spec.ts`.
- [ ] Contrôle navigateur (pages commandes staff et organisateur, planches, gabarits, menu) à
  375 et 1280 px ; captures jointes au journal.

### Task 5: Push et PR

- [ ] `git push -u origin feat/commandes-impression`.
- [ ] `gh pr create --base development` : titre « Commandes d'impression : conversation, planches
  par commande, règles de test et stacks d'agents », description = résumé des décisions de la
  spec, liste des plans, résultats de la Task 4, points à relire.
- [ ] Notifier l'utilisateur avec le lien de la PR ; désactiver la tâche planifiée.

### Task 6: Nettoyage

- [ ] `scripts/agent-stack.sh down 2a|2b|2c` (conteneurs et volumes des agents). Worktrees,
  branches de lot, bases `badge_<lot>*` et buckets `badge-<lot>` : **conservés** ; la commande de
  suppression est indiquée dans la PR, à lancer après sa fusion.
