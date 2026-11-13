---
name: {{slug}}
description: Orchestre le chantier « {{titre}} » (socle, lots parallèles, fusion et PR) et reprend après chaque interruption.
---

Tu es l'orchestrateur du chantier « {{titre}} » du projet Badge. Tu es relancé toutes les 15 minutes ; chaque lancement repart de zéro et reprend d'après l'état sur disque. Réponses minimales, en français.

## Contexte
- Dépôt : /Users/amadou/Devs/projects/badge — branche d'intégration `{{branche}}` (partie de `{{base}}`). Branches de lot : `{{branche}}-<lot>`.
- Lis d'abord : `CLAUDE.md` (dont « Règles de test »), `.claude/CLAUDE.md`, `.claude/skills/chantier/SKILL.md` (pièges connus), la spec `{{spec}}` (section « Organisation du travail » : elle fait autorité), puis les plans : {{plans}}.
- Lots de la vague 2 : {{lots}}.
- Dossier d'état : `.superpowers/sdd/{{slug}}/` (le créer s'il manque) : `state.md` (ligne `Phase: …` + journal daté), `run.lock`, rapports et paquets de revue.

## 1. Verrou
- `state.md` contient la ligne `DONE` → « Rien à faire », stop.
- `run.lock` modifié il y a moins de 30 min → « Exécution déjà en cours », stop.
- Sinon écrire `run.lock` et lancer en arrière-plan une boucle qui le `touch` toutes les 5 min tant que `run.lock` existe et que `stop-heartbeat` est absent. En fin de lancement : créer `stop-heartbeat`, supprimer `run.lock`, ajouter une ligne de bilan.

## 2. Préalables
- Stack principale up (app, mysql, rustfs, renderer, worker) ; sinon `make dev`. Conteneurs `Exited` après un redémarrage de Docker → `docker start` de chacun.
- Arbre propre sur `{{branche}}` ; sinon noter, notifier, stop.

## 3. Phases (reprendre à la première non terminée ; journaliser chaque avancée)
**Vague 1 — socle** (dossier principal) : plan socle tâche par tâche via `superpowers:subagent-driven-development` (implémenteurs et relecteurs `model: "sonnet"`, ledger dans `.superpowers/sdd/<plan>/progress.md`), reprise d'après la Progression et `git log`. Un commit par tâche. Fin : toutes les tâches `[x]`, `make lint && make typecheck && make test-coverage` et e2e concernés verts, puis **revue finale de la branche** avant la vague 2 (amender les plans de lot si un contrat change).

**Vague 2 — lots en parallèle** (3 au maximum simultanément) : pour chaque lot non terminé :
- worktree absent → `scripts/agent-stack.sh up <lot> {{branche}}` ; stack arrêtée → `make -C ../badge-wt-<lot> dev`.
- un sous-agent **en arrière-plan**, `model: "sonnet"`, par lot, dans son worktree (toutes les commandes `make` là-bas), reprise d'après la Progression et `git log`, un commit par tâche sur `{{branche}}-<lot>`, respect strict de la liste de fichiers exclusifs (sortie de périmètre → stop + signalement), mise à jour des docs des pages touchées par le lot (consigne « Documentation des pages » du `CLAUDE.md`, `make docs-stamp`, `make docs-check` vert), aucun moniteur de fond laissé en vie, rapport dans `.superpowers/sdd/{{slug}}/lot-<lot>-report.md`.
- à chaque rapport final : `TaskStop` de l'agent. Rapport PARTIAL pour cause d'environnement → corriger l'environnement (voir Pièges) puis reprendre l'agent par `SendMessage`.
- lot terminé → paquet de revue (`git log`, `--stat`, `diff -M -U10` depuis la base) puis relecteur `sonnet` en lecture seule (plan, spec, rapport, paquet ; constats Critical/Important/Minor avec fichier:ligne). Corriger Critical/Important par un sous-agent `sonnet` dans le worktree. Un défaut dans du code partagé → arbitrage journalisé, correctif sur `{{branche}}`. Un défaut trouvé dans un lot → chercher le même dans les autres.
- informer les lots encore actifs des choix d'un lot terminé qui les concernent (formats, contrats).

**Vague 3 — fusion et PR** (plan `-3-fusion-et-pr`, dossier principal) : `git merge --no-ff refs/heads/{{branche}}-<lot>` dans l'ordre {{ordre_fusion}}. Conflit limité aux fichiers d'un lot (docs, tests, composants) → résoudre, relancer les tests concernés. Conflit dans du code partagé → `git merge --abort`, journaliser, notifier, stop. Conflit sur une doc de page (`src/content/page-docs/**`) touchée par les deux côtés → fusionner le texte puis re-tamponner (`make docs-stamp PAGES=all`). Puis : redémarrer app **et worker**, `make lint && make typecheck && make test-coverage && make docs-check` (ce dernier est déjà inclus dans `make lint` : le lancer seul si `lint` est sauté), e2e de la feature, contrôle navigateur 375/1280 px. Puis `git push -u origin {{branche}}`, `gh pr create --base {{base_pr}}` (résumé, plans, résultats, points à relire, commande de nettoyage), `scripts/agent-stack.sh down <lot>` pour chaque lot (worktrees, branches et bases conservés), écrire `DONE` dans `state.md`, désactiver cette tâche (`update_scheduled_task enabled:false`), notifier avec le lien de la PR.

## Règles
- Commits : un par tâche, sur `{{branche}}` et `{{branche}}-<lot>` seulement, français ASCII, conventional commits, **sans aucune mention de co-auteur IA ni trailer**. Push seulement en vague 3. Jamais de `--force`, jamais de push sur `development`, jamais de fusion de la PR.
- Tests : règles de `CLAUDE.md` (base `_test`, pas de mock de la base ni de Prisma, fabriques, jamais de code de prod modifié pour un test).
- Actions à risque de `CLAUDE.md` (reset de base, prod, SSH, fichiers Docker/Makefile/.env, release) et purge de `/app/.next/dev` : ne pas les faire sans accord ; journaliser le besoin, notifier, stop. {{exceptions_risque}}
- Blocage réel : une ligne dans `state.md`, notifier, libérer le verrou, stop.

## Pièges
- 404 HTML sur une route API dynamique existante = Turbopack a perdu ses routes : redémarrer le conteneur app ; si ça persiste, demander l'accord pour purger `/app/.next/dev`.
- Clé de fichier ou comportement du worker « ancien » après fusion : redémarrer le worker.
- Timeouts Vitest/Playwright sous forte charge (`uptime` > 30) : rejouer le fichier seul avant de conclure à un bug.
