# Instructions pour les outils IA — Badge

Ce fichier est la **source unique de vérité** pour la **méthode de travail** des agents IA (Claude Code, Cursor, etc.) sur ce projet. Il décrit *comment travailler* : process, règles d'écriture, vérification, git. Les règles métier (RBAC, modèle de données, garde-fous fonctionnels) et les détails d'environnement (commandes, variables d'env, infrastructure) vivent dans `docs/` (versionnée).

> `AGENTS.md` et `.cursor/rules/project.mdc` pointent vers ce fichier. Toute modification se fait ici.

---

## 1. Avant toute implémentation

1. **Identifier la version active** du travail. Voir `docs/README.md` pour la convention de versionnement, les statuts et les règles multi-versions. Si la version n'est pas explicite dans la demande, **demander avant de coder**.
2. **Lire la documentation** de cette version : `docs/<version>/architecture.md`, `docs/<version>/base-de-donnees.md` (si présent), puis la doc de la feature concernée dans `docs/<version>/features/`.
3. **Chercher un plan/spec** existant :
   - `docs/<version>/features/<nom>.md`
   - `docs/<version>/specs/` (specs validées : capture du *pourquoi* du design)
   - `docs/<version>/plans/` (plans d'implémentation : tracker de progression en tête, cf. § 1 point 7)
4. **Si aucune spec n'existe** pour la fonctionnalité demandée → produire une spec avant de coder (workflow : brainstorming → writing-plans → implémentation).
5. **Décomposer et déléguer aux agents.** Pour chaque changement non trivial, **évaluer explicitement** le mode d'exécution **avant** de coder et l'annoncer à l'utilisateur. Cinq modes possibles, du plus léger au plus structurant :

   | Mode | Quand l'utiliser | Outils / skill |
   |---|---|---|
   | **Exécution directe** | 1 fichier ou 1 sous-tâche cohérente courte, sans bénéfice à déléguer. | Agent principal seul. |
   | **Agents parallèles jetables** | 2+ sous-tâches **indépendantes** qui tiennent dans **un seul tour**, sans état partagé : N fichiers à modifier en miroir, N bugs sans lien, N investigations parallèles. | `superpowers:dispatching-parallel-agents` — plusieurs appels `Agent(...)` dans un même message. |
   | **Agent Teams persistants** | Travail **volumineux qui dépasse un tour**, ou rôles spécialisés avec mémoire propre, ou besoin de **messaging inter-agents** (lead + coéquipiers : ex. un agent code + un agent revue + un agent tests qui dialoguent). | Tools `TeamCreate`, `Agent({team_name, name})`, `SendMessage`. Requiert `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` dans `settings.json`. |
   | **Plan séquentiel dans la session courante** | Étapes **ordonnées** avec dépendances entre elles, à exécuter dans la conversation actuelle. | `superpowers:subagent-driven-development`. |
   | **Plan séquentiel avec revue utilisateur** | Implémentation d'un plan détaillé nécessitant des **points de contrôle utilisateur** entre étapes, possiblement dans une session dédiée. | `superpowers:executing-plans`. |

   **Règle d'évaluation rapide** :
   - Sous-tâches indépendantes ET tenant dans un tour → **agents parallèles jetables**.
   - Sous-tâches qui doivent dialoguer ou survivre plusieurs tours → **Agent Teams**.
   - Sous-tâches qui s'enchaînent avec dépendances → **plan + skill associé**.
   - Pas de gain réel à déléguer → **exécution directe**.

   L'agent principal reste responsable de la cohérence globale, de la mise à jour de la doc et du respect des règles de ce fichier. Les agents délégués doivent recevoir un brief auto-suffisant (chemins absolus, contexte, critères d'acceptation, livrable attendu).
6. Pour chaque modification : **identifier la doc impactée** et la mettre à jour dans le même changement.
7. **Conservation et suivi des plans d'implémentation** : les plans et les specs vivent désormais **dans la version concernée**, sous `docs/<version>/plans/` et `docs/<version>/specs/`. Les deux sont **conservés indéfiniment**, même après implémentation complète. Ne **jamais** supprimer un plan ou une spec sans demande explicite et explicite de l'utilisateur.
   - **Plans** (`docs/<version>/plans/`) : décrivent *comment* implémenter une feature (tâches, ordre, fichiers touchés, tests TDD). Chaque plan contient en tête une section `## Progression` avec une table par task (statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned), date et notes.
   - **Specs** (`docs/<version>/specs/`) : ADR (Architecture Decision Record) — capturent le *pourquoi* du design, les options envisagées, les arbitrages. Le code et `docs/<version>/architecture.md` documentent le *quoi* et le *comment* actuels ; la spec documente le *pourquoi* historique.
   - **Workflow tracker** : avant chaque session, lire la section `## Progression` du plan concerné pour savoir où on s'était arrêté. Après chaque task validée (tests verts + critères d'acceptation OK), mettre à jour le statut à `[x]` et dater. En cas d'interruption mi-task, passer à `[~]`, dater, et noter précisément l'état (step en cours, fichiers touchés, prochaine étape). En cas d'abandon, passer à `[-]` et noter la raison dans la spec correspondante.

---

## 2. Sources de vérité

| Sujet | Source |
|-------|--------|
| Index doc versionnée, convention de versionnement, règles multi-versions | `docs/README.md` |
| Architecture, RBAC, garde-fous métier de la version active | `docs/<version>/architecture.md` |
| Modèle de données | `prisma/schema.prisma` (autorité finale, partagé entre versions) |
| Routes API | `docs/<version>/api/` + lecture directe de `src/app/api/` |
| Spécifications par feature | `docs/<version>/features/<nom>.md` |
| Installation, environnement, commandes opérationnelles | `docs/<version>/installation.md` (ou `features/deploiement-*.md` pour v2) |
| Guide utilisateur | `docs/<version>/guide-utilisateur/` |

**En cas de conflit doc ↔ code → le code fait foi**, et il faut mettre à jour la doc dans le même changement.

---

## 3. Règles d'écriture de code

- **YAGNI** : pas d'abstraction sans 2-3 usages réels, pas de feature flag prématuré, pas de gestion d'erreur pour un cas qui ne peut pas arriver.
- **Pas de commentaires inutiles** : les noms d'identifiants doivent suffire ; commenter uniquement le *pourquoi* non évident (workaround, contrainte cachée, invariant subtil).
- **Validation aux frontières uniquement** : input utilisateur, API externe. Faire confiance au code interne.
- **Réutiliser avant de créer** : chercher dans `src/lib/` avant d'introduire un helper.
- **Server Components par défaut** ; ajouter `"use client"` uniquement quand l'interactivité l'exige.
- **Toute action sensible doit logger** via `logActivity()` (`src/lib/activity-log.ts`).
- **Toute route API doit vérifier le rôle/permission** via les helpers de `src/lib/auth.ts` avant l'action.
- **Ne jamais exposer dans une réponse API** des valeurs sensibles (hash bcrypt, secrets SMTP/reCAPTCHA, tokens d'invitation ou d'édition non hashés).
- **Pas de demi-implémentation** : si une fonctionnalité ne peut pas être terminée, s'arrêter et expliquer plutôt que livrer du code partiel sans le signaler.
- **Modifications scopées au projet** : toutes les créations et modifications de fichier (`Edit`, `Write`, `NotebookEdit`, ainsi que les commandes Bash mutantes comme `mkdir`, `touch`, `mv`, `rm`, `cp`, `sed -i`, `>` de redirection) doivent rester **dans le dossier projet** (la racine du repo, retournée par `pwd` si nécessaire). Si une opération doit toucher un fichier ou un dossier en dehors du projet (par exemple `~/.config`, `/etc`, un autre repo, `/tmp/...`), **arrêter et demander explicitement l'autorisation à l'utilisateur avant de lancer l'action**. Ne pas se contenter de subir le prompt automatique du harness : annoncer clairement l'intention et attendre la validation.
- **Paths absolus pour les commandes Bash mutantes** : quand vous utilisez `mkdir`, `touch`, `mv` (ou équivalents) via Bash, préférer le **chemin absolu** (par exemple `mkdir /Users/.../<projet>/src/new` plutôt que `mkdir src/new`). Le harness n'autorise sans prompt que les commandes dont le préfixe correspond à un path absolu projet — un path relatif déclenche un prompt redondant alors que la commande est sûre. Récupérer la racine du projet via `pwd` au début d'une session si nécessaire.
- **Actions web autorisées par défaut** : `WebSearch` et `WebFetch` sont déjà dans la policy `allow`. Pas besoin de les annoncer ou de demander confirmation — les utiliser librement pour rechercher de la doc, vérifier une syntaxe, consulter une page externe.

---

## 4. Tests et vérification avant "fini"

Avant de déclarer une tâche terminée :

1. `make lint` — passe sans warning
2. `make typecheck` — passe
3. `make test` — passe (Vitest pour la logique pure, dans `src/lib/__tests__/`)
4. Pour les changements UI : **tester effectivement dans le navigateur** (golden path + cas limites). Ne pas affirmer "ça marche" sans vérification visuelle.
5. Pas de mock de Prisma pour des règles métier critiques — utiliser une base de test ou un test d'intégration.

**L'évidence vient avant l'affirmation** : exécuter la commande puis rapporter son résultat, jamais l'inverse.

---

## 5. Conventions de langue

| Type de contenu | Langue | Accents |
|-----------------|--------|---------|
| UI, emails, messages d'erreur utilisateur | Français | Oui (é, è, à, ç, î, …) |
| Documentation technique (`docs/`, README) | Français | Suivre le style existant du fichier |
| Code, identifiants, types, fonctions, variables | Anglais | — |
| Commentaires de code | Français | Suivre le style existant du fichier |
| Noms de fichiers, branches, commits | ASCII | Non |

---

## 6. Workflow Git

- Branche principale : `development`
- 1 PR = 1 changement cohérent (pas de refactor non lié glissé dans une feature)
- **Ne jamais prendre l'initiative d'un commit.** Aucune autorité implicite : un agent ne commit **que** si l'utilisateur l'a explicitement demandé via une commande de la conversation courante (ex : « commit », « fais un commit », « crée le commit »). Pas de commit automatique après une feature, pas de commit pour « sauvegarder le travail », pas de commit pour « clore une étape ». En cas de doute, demander.
- **Pas de mention de co-auteur IA** dans les commits, jamais : ne jamais ajouter `Co-Authored-By: Claude …`, `Generated with …`, `🤖 Generated with …`, ni aucune signature, attribution, ou trailer renvoyant à un outil IA. Le message reste strictement neutre, comme s'il avait été rédigé par un humain.
- Messages de commit en français ASCII, style conventional commits : `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Avant tout commit** : `make lint && make typecheck && make test`
- **Interdit sans demande explicite de l'utilisateur** :
  - `git push --force` (surtout sur `development` ou `main`)
  - `git reset --hard`, `git clean -f`, `git checkout .`
  - `git commit --no-verify` (ne jamais contourner les hooks)
  - Suppression de branches
- **Ne jamais commit** de fichiers contenant des secrets (`.env`, `.env.production`).

---

## 7. Actions à risque — toujours demander avant

Toute action destructive, irréversible, ou affectant un environnement partagé (production, base de données, fichiers persistants, infrastructure) **doit être confirmée par l'utilisateur avant exécution**. La liste précise des commandes opérationnelles à risque vit dans `docs/<version>/installation.md`. Principe général :

- **Reset / suppression de données** : BDD, contenu d'`uploads/`, fichiers persistants — toujours demander.
- **Modification d'infrastructure** : `.env`, `.env.production`, `docker-compose*`, `Dockerfile*`, `Caddyfile`, configuration CI/CD — toujours demander.
- **Déploiement** : `make deploy`, `make upload`, ou tout équivalent — toujours demander.
- **Connexion SSH au serveur de production** — toujours demander.

---

## 8. Quand vous bloquez

- **Pas de contournement** : ne pas skip un hook, désactiver un test, mocker pour faire passer, ou supprimer une vérification pour "faire avancer".
- Diagnostiquer la **cause racine** avant de proposer un correctif.
- Si la cause est ambiguë → demander à l'utilisateur.
- Si une commande échoue de façon répétée → s'arrêter et expliquer, ne pas boucler.
