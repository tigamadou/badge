# Instructions pour les outils IA (template generique)

> **Methode de travail des agents IA** (Claude Code, Cursor, etc.). Ce fichier est un **template generique reutilisable d'un projet a l'autre**. Les valeurs concretes propres au projet (commandes, branche principale, helpers, frameworks, garde-fous metier) sont definies dans le `CLAUDE.md` du projet, en complement de ce template.

> **Maintenance** : ce fichier evolue rarement. Quand une amelioration de methode emerge dans un projet, la backporter ici puis la distribuer aux autres projets.

> **Convention recommandee** : placer ce template a `~/.claude/CLAUDE.md` (chargement automatique par Claude Code) **ou** dans un repo personnel (e.g. dotfiles) et le copier dans chaque nouveau projet a cote du `CLAUDE.md` projet. Les outils qui ne supportent pas le chargement multi-niveaux (Cursor, AGENTS.md) doivent etre configures pour lire les deux fichiers (concatenation manuelle ou import).

---

## 1. Avant toute implementation

1. **Identifier la version active** du travail si le projet est versionne. La convention de versionnement, les statuts (production / en construction / archivee) et les regles multi-versions sont definies dans le `CLAUDE.md` du projet (ou dans `docs/README.md` selon la convention adoptee). Si la version active n'est pas explicite dans la demande, **demander avant de coder**.
2. **Lire la documentation** pertinente : architecture, modele de donnees, puis la doc de la feature concernee. Les chemins exacts dependent du projet (voir `CLAUDE.md` projet).
3. **Chercher un plan/spec** existant dans les emplacements du projet (typiquement `docs/<version>/features/`, `docs/<version>/specs/`, `docs/<version>/plans/`).
4. **Si aucune spec n'existe** pour la fonctionnalite demandee : produire une spec avant de coder (workflow : brainstorming -> writing-plans -> implementation).
5. **Decomposer et deleguer aux agents.** Pour chaque changement non trivial, **evaluer explicitement** le mode d'execution **avant** de coder et l'annoncer a l'utilisateur. Cinq modes possibles, du plus leger au plus structurant :

   | Mode | Quand l'utiliser | Outils / skill |
   |---|---|---|
   | **Execution directe** | 1 fichier ou 1 sous-tache coherente courte, sans benefice a deleguer. | Agent principal seul. |
   | **Agents paralleles jetables** | 2+ sous-taches **independantes** qui tiennent dans **un seul tour**, sans etat partage : N fichiers a modifier en miroir, N bugs sans lien, N investigations paralleles. | `superpowers:dispatching-parallel-agents` -- plusieurs appels `Agent(...)` dans un meme message. |
   | **Agent Teams persistants** | Travail **volumineux qui depasse un tour**, ou roles specialises avec memoire propre, ou besoin de **messaging inter-agents** (lead + coequipiers : ex. un agent code + un agent revue + un agent tests qui dialoguent). | Tools `TeamCreate`, `Agent({team_name, name})`, `SendMessage`. Requiert `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true` dans `settings.json`. |
   | **Plan sequentiel dans la session courante** | Etapes **ordonnees** avec dependances entre elles, a executer dans la conversation actuelle. | `superpowers:subagent-driven-development`. |
   | **Plan sequentiel avec revue utilisateur** | Implementation d'un plan detaille necessitant des **points de controle utilisateur** entre etapes, possiblement dans une session dediee. | `superpowers:executing-plans`. |

   **Regle d'evaluation rapide** :
   - Sous-taches independantes ET tenant dans un tour -> **agents paralleles jetables**.
   - Sous-taches qui doivent dialoguer ou survivre plusieurs tours -> **Agent Teams**.
   - Sous-taches qui s'enchainent avec dependances -> **plan + skill associe**.
   - Pas de gain reel a deleguer -> **execution directe**.

   L'agent principal reste responsable de la coherence globale, de la mise a jour de la doc et du respect des regles de ce fichier. Les agents delegues doivent recevoir un brief auto-suffisant (chemins absolus, contexte, criteres d'acceptation, livrable attendu).
6. Pour chaque modification : **identifier la doc impactee** et la mettre a jour dans le meme changement.
7. **Conservation et suivi des plans d'implementation** : les plans et les specs vivent dans la version concernee (typiquement `docs/<version>/plans/` et `docs/<version>/specs/`, ou emplacement equivalent selon convention projet). Les deux sont **conserves indefiniment**, meme apres implementation complete. Ne **jamais** supprimer un plan ou une spec sans demande explicite de l'utilisateur.
   - **Plans** : decrivent *comment* implementer une feature (taches, ordre, fichiers touches, tests TDD). Chaque plan contient en tete une section `## Progression` avec une table par task (statuts : `[ ]` pending, `[~]` in_progress, `[x]` completed, `[-]` abandoned), date et notes.
   - **Specs** : ADR (Architecture Decision Record) -- capturent le *pourquoi* du design, les options envisagees, les arbitrages. Le code et la doc d'architecture documentent le *quoi* et le *comment* actuels ; la spec documente le *pourquoi* historique.
   - **Workflow tracker** : avant chaque session, lire la section `## Progression` du plan concerne pour savoir ou on s'etait arrete. Apres chaque task validee (tests verts + criteres d'acceptation OK), mettre a jour le statut a `[x]` et dater. En cas d'interruption mi-task, passer a `[~]`, dater, et noter precisement l'etat (step en cours, fichiers touches, prochaine etape). En cas d'abandon, passer a `[-]` et noter la raison dans la spec correspondante.

---

## 2. Sources de verite

Hierarchie generique :

1. **Code** > documentation : en cas de conflit, le code fait foi ; mettre a jour la doc dans le meme changement.
2. **Schema de donnees** (Prisma, SQL, etc.) = autorite finale sur le modele.
3. **Routes API** = lecture directe du code applicatif.
4. **Architecture, regles metier** = doc projet versionnee.

Les chemins exacts (architecture, schema, lib de helpers, etc.) sont indiques dans le `CLAUDE.md` projet.

---

## 3. Regles d'ecriture de code

- **YAGNI** : pas d'abstraction sans 2-3 usages reels, pas de feature flag premature, pas de gestion d'erreur pour un cas qui ne peut pas arriver.
- **Pas de commentaires inutiles** : les noms d'identifiants doivent suffire ; commenter uniquement le *pourquoi* non evident (workaround, contrainte cachee, invariant subtil).
- **Validation aux frontieres uniquement** : input utilisateur, API externe. Faire confiance au code interne.
- **Reutiliser avant de creer** : chercher dans la lib partagee du projet avant d'introduire un helper.
- **Toute action sensible doit logger** via la fonction d'audit definie par le projet.
- **Toute route API doit verifier le role/permission** via les helpers d'autorisation du projet avant l'action.
- **Ne jamais exposer dans une reponse API** des valeurs sensibles : hashes de mots de passe, secrets (SMTP, reCAPTCHA, cles d'API), tokens d'invitation ou d'edition non hashes, etc.
- **Documentation utilisateur liee** : quand le projet documente ses ecrans ou ses fonctions pour les utilisateurs, mettre a jour cette documentation dans le meme changement que le code, selon la consigne du `CLAUDE.md` projet ; ne pas livrer de code dont la doc est obsolete.
- **Pas de demi-implementation** : si une fonctionnalite ne peut pas etre terminee, s'arreter et expliquer plutot que livrer du code partiel sans le signaler.
- **Modifications scopees au projet** : toutes les creations et modifications de fichier (`Edit`, `Write`, `NotebookEdit`, ainsi que les commandes Bash mutantes comme `mkdir`, `touch`, `mv`, `rm`, `cp`, `sed -i`, `>` de redirection) doivent rester **dans le dossier projet** (la racine du repo, retournee par `pwd` si necessaire). Si une operation doit toucher un fichier ou un dossier en dehors du projet (par exemple `~/.config`, `/etc`, un autre repo, `/tmp/...`), **arreter et demander explicitement l'autorisation a l'utilisateur avant de lancer l'action**. Ne pas se contenter de subir le prompt automatique du harness : annoncer clairement l'intention et attendre la validation.
- **Paths absolus pour les commandes Bash mutantes** : quand vous utilisez `mkdir`, `touch`, `mv` (ou equivalents) via Bash, preferer le **chemin absolu** (par exemple `mkdir /Users/.../<projet>/src/new` plutot que `mkdir src/new`). Le harness n'autorise sans prompt que les commandes dont le prefixe correspond a un path absolu projet -- un path relatif declenche un prompt redondant alors que la commande est sure. Recuperer la racine du projet via `pwd` au debut d'une session si necessaire.
- **Actions web autorisees par defaut** (si la policy `.claude/settings.json` du projet le permet) : `WebSearch` et `WebFetch` sont a utiliser librement pour rechercher de la doc, verifier une syntaxe, consulter une page externe.

---

## 4. Tests et verification avant "fini"

Avant de declarer une tache terminee :

1. **Linter** : passe sans warning.
2. **Type checking** : passe.
3. **Tests** : passent (la commande exacte est dans `CLAUDE.md` projet).
4. Pour les changements UI : **tester effectivement dans le navigateur** (golden path + cas limites). Ne pas affirmer "ca marche" sans verification visuelle.
5. Pas de mock de l'ORM ou des regles metier critiques -- utiliser une base de test ou un test d'integration.

**L'evidence vient avant l'affirmation** : executer la commande puis rapporter son resultat, jamais l'inverse.

---

## 5. Conventions de langue

A definir dans le `CLAUDE.md` projet (la langue de l'UI, des emails, de la doc, des commentaires de code varie d'un projet a l'autre). Convention par defaut conservatrice :

| Type de contenu | Langue | Accents |
|-----------------|--------|---------|
| UI, emails, messages d'erreur utilisateur | A definir | A definir |
| Documentation technique | A definir | A definir |
| Code, identifiants, types, fonctions, variables | Anglais (recommande) | -- |
| Commentaires de code | A definir | A definir |
| Noms de fichiers, branches, commits | ASCII | Non |

---

## 6. Workflow Git

- **Branche principale** : voir `CLAUDE.md` projet.
- **1 PR = 1 changement coherent** (pas de refactor non lie glisse dans une feature).
- **Ne jamais prendre l'initiative d'un commit.** Aucune autorite implicite : un agent ne commit **que** si l'utilisateur l'a explicitement demande via une commande de la conversation courante (ex : "commit", "fais un commit", "cree le commit"). Pas de commit automatique apres une feature, pas de commit pour "sauvegarder le travail", pas de commit pour "clore une etape". En cas de doute, demander.
- **Pas de mention de co-auteur IA** dans les commits, jamais : ne jamais ajouter `Co-Authored-By: Claude ...`, `Generated with ...`, `Generated by ...`, ni aucune signature, attribution, ou trailer renvoyant a un outil IA. Le message reste strictement neutre, comme s'il avait ete redige par un humain.
- Messages de commit en ASCII (langue selon convention projet), style conventional commits : `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`.
- **Avant tout commit** : lancer lint + typecheck + tests (commandes exactes dans `CLAUDE.md` projet).
- **Interdit sans demande explicite de l'utilisateur** :
  - `git push --force` (surtout sur les branches partagees)
  - `git reset --hard`, `git clean -f`, `git checkout .`
  - `git commit --no-verify` (ne jamais contourner les hooks)
  - Suppression de branches
- **Ne jamais commit** de fichiers contenant des secrets (`.env`, credentials, cles privees, etc.).

---

## 7. Actions a risque -- toujours demander avant

Toute action destructive, irreversible, ou affectant un environnement partage (production, base de donnees, fichiers persistants, infrastructure) **doit etre confirmee par l'utilisateur avant execution**. La liste precise des commandes operationnelles a risque vit dans le `CLAUDE.md` projet (ou dans la doc d'installation projet). Principe general :

- **Reset / suppression de donnees** : BDD, contenu d'uploads, fichiers persistants.
- **Modification d'infrastructure** : variables d'environnement de production, configuration Docker, reverse proxy, CI/CD.
- **Deploiement** : toute commande de deploiement ou de push vers un environnement partage.
- **Connexion SSH au serveur de production** ou tout acces SSH a un environnement non-local.
- **Modification de policies / permissions** (IAM, ACL, secrets).

---

## 8. Quand vous bloquez

- **Pas de contournement** : ne pas skip un hook, desactiver un test, mocker pour faire passer, ou supprimer une verification pour "faire avancer".
- Diagnostiquer la **cause racine** avant de proposer un correctif.
- Si la cause est ambigue -> demander a l'utilisateur.
- Si une commande echoue de facon repetee -> s'arreter et expliquer, ne pas boucler.
