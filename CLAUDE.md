# Instructions pour les outils IA — Badge

Ce fichier est la **source unique de vérité** pour tous les agents IA travaillant sur ce projet (Claude Code, Cursor, etc.). Il décrit la **méthode** à suivre pour implémenter une fonctionnalité, pas l'architecture du code (celle-ci est documentée dans `docs/`).

> `AGENTS.md` et `.cursor/rules/project.mdc` pointent vers ce fichier. Toute modification se fait ici.

---

## 1. Avant toute implémentation

1. **Identifier la version active** du travail (voir section 2).
2. **Lire la documentation** de cette version : `docs/<version>/architecture.md`, `docs/<version>/base-de-donnees.md`, puis la doc de la feature concernée dans `docs/<version>/features/`.
3. **Chercher un plan/spec** existant :
   - `docs/<version>/features/<nom>.md`
   - `docs/superpowers/specs/` (specs validées)
   - `docs/superpowers/plans/` (plans d'implémentation)
4. **Si aucune spec n'existe** pour la fonctionnalité demandée → produire une spec avant de coder (workflow : brainstorming → writing-plans → implémentation).
5. Pour chaque modification : **identifier la doc impactée** et la mettre à jour dans le même changement.

---

## 2. Versions de l'application

Le projet est **versionné**. Chaque version majeure a sa propre documentation autonome.

- **Index des versions** : `docs/README.md` (statut de chaque version)
- **Convention** : la doc suit la version majeure de l'app (v1, v2, …)
- **Statuts possibles** :
  - **Production** — version déployée ; modifications conservatrices uniquement
  - **En construction** — refontes autorisées dans le périmètre de la spec ; toute évolution documentée dans la version cible
  - **Archivée** — lecture seule, ne jamais modifier

Si la version n'est pas explicite dans la demande de l'utilisateur, **demander avant de coder**.

### Règles multi-versions

- Une PR ne touche jamais simultanément plusieurs versions de doc sans validation explicite
- Avant de créer/modifier une feature, vérifier si elle existe déjà dans une autre version (éviter les divergences non intentionnelles)
- Si une feature est reprise ou refondue dans une nouvelle version → la lier explicitement à la version précédente dans la nouvelle spec
- Créer une nouvelle version (vX) → suivre la même structure de dossier que la dernière version stable

---

## 3. Sources de vérité

| Sujet | Source |
|-------|--------|
| Index doc versionnée | `docs/README.md` |
| Architecture de la version active | `docs/<version>/architecture.md` |
| Modèle de données | `prisma/schema.prisma` (autorité finale, partagé entre versions) |
| Routes API | `docs/<version>/api/` + lecture directe de `src/app/api/` |
| Règles métier (RBAC, statuts, séparation des rôles) | `docs/<version>/architecture.md` + `src/lib/auth.ts` |
| Spécifications par feature | `docs/<version>/features/<nom>.md` |
| Guide utilisateur | `docs/<version>/guide-utilisateur/` |

**En cas de conflit doc ↔ code → le code fait foi**, et il faut mettre à jour la doc dans le même changement.

---

## 4. Règles d'écriture de code

- **YAGNI** : pas d'abstraction sans 2-3 usages réels, pas de feature flag prématuré, pas de gestion d'erreur pour un cas qui ne peut pas arriver.
- **Pas de commentaires inutiles** : les noms d'identifiants doivent suffire ; commenter uniquement le *pourquoi* non évident (workaround, contrainte cachée, invariant subtil).
- **Validation aux frontières uniquement** : input utilisateur, API externe. Faire confiance au code interne.
- **Réutiliser avant de créer** : chercher dans `src/lib/` avant d'introduire un helper (`activity-log`, `auth`, `mail`, `prisma`, `storage`, `qrcode`, `format-*`, `generate-id`, `image-to-dataurl`).
- **Server Components par défaut** ; ajouter `"use client"` uniquement quand l'interactivité l'exige.
- **Toute action sensible doit logger** via `logActivity()` (`src/lib/activity-log.ts`). Ajouter un nouvel `ActivityType` au schéma Prisma si nécessaire.
- **Toute route API doit vérifier le rôle** via `checkRole()` (`src/lib/auth.ts`) avant l'action.
- **Ne jamais exposer dans une réponse API** : `recaptchaSecretKey`, `smtpPassword`, hash bcrypt, tokens d'invitation ou d'édition non hashés.
- **Pas de demi-implémentation** : si une fonctionnalité ne peut pas être terminée, s'arrêter et expliquer plutôt que livrer du code partiel sans le signaler.

---

## 5. Tests et vérification avant "fini"

Avant de déclarer une tâche terminée :

1. `make lint` — passe sans warning
2. `make typecheck` — passe
3. `make test` — passe (Vitest pour la logique pure, dans `src/lib/__tests__/`)
4. Pour les changements UI : **tester effectivement dans le navigateur** (golden path + cas limites). Ne pas affirmer "ça marche" sans vérification visuelle.
5. Pas de mock de Prisma pour des règles métier critiques — utiliser une base de test ou un test d'intégration.

**L'évidence vient avant l'affirmation** : exécuter la commande puis rapporter son résultat, jamais l'inverse.

---

## 6. Conventions de langue

| Type de contenu | Langue | Accents |
|-----------------|--------|---------|
| UI, emails, messages d'erreur utilisateur | Français | Oui (é, è, à, ç, î, …) |
| Documentation technique (`docs/`, README) | Français | Suivre le style existant du fichier |
| Code, identifiants, types, fonctions, variables | Anglais | — |
| Commentaires de code | Français | Suivre le style existant du fichier |
| Noms de fichiers, branches, commits | ASCII | Non |

---

## 7. Workflow Git

- Branche principale : `development`
- 1 PR = 1 changement cohérent (pas de refactor non lié glissé dans une feature)
- Messages de commit en français ASCII, style conventional commits : `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- **Pas de mention de co-auteur IA** dans les commits : ne jamais ajouter de `Co-Authored-By: Claude …`, `Generated with …`, ni aucune signature d'outil IA. Le message reste neutre.
- **Avant tout commit** : `make lint && make typecheck && make test`
- **Interdit sans demande explicite de l'utilisateur** :
  - `git push --force` (surtout sur `development` ou `main`)
  - `git reset --hard`, `git clean -f`, `git checkout .`
  - `git commit --no-verify` (ne jamais contourner les hooks)
  - Suppression de branches
- **Ne jamais commit** de fichiers contenant des secrets (`.env`, `.env.production`).

---

## 8. Garde-fous spécifiques au projet

- **Modifier `prisma/schema.prisma`** → générer une migration (`prisma migrate dev`) **et** mettre à jour `docs/<version>/base-de-donnees.md`.
- **Ajouter une route API** → la documenter dans `docs/<version>/api/`.
- **Ajouter ou modifier une feature** → mettre à jour ou créer `docs/<version>/features/<nom>.md`.
- **RBAC — séparation des rôles** : `SUPER_ADMIN` n'a **pas** le droit d'approuver, rejeter, supprimer une inscription ni d'imprimer un badge. Toujours respecter cette séparation.
- **Uploads** : taille max 5 Mo, types autorisés JPEG / PNG / WebP / PDF uniquement.
- **Authentification** : mots de passe hashés avec **bcryptjs (12 rounds)**, longueur minimale 6 caractères.
- **Rendu PDF des badges** : utilise Montserrat via Google Fonts → préserver l'accès sortant à `fonts.googleapis.com`.

---

## 9. Actions à risque — toujours demander avant

- `make prod-db-reset`, `make db-reset`, toute commande avec `--force-reset`
- Suppression de fichiers dans `uploads/`
- Modification de `.env`, `.env.production`, `Caddyfile`, `docker-compose.yml`, `Dockerfile`
- Déploiement : `make deploy`, `make upload`
- Toute commande SSH sur le serveur de production

---

## 10. Quand vous bloquez

- **Pas de contournement** : ne pas skip un hook, désactiver un test, mocker pour faire passer, ou supprimer une vérification pour "faire avancer".
- Diagnostiquer la **cause racine** avant de proposer un correctif.
- Si la cause est ambiguë → demander à l'utilisateur.
- Si une commande échoue de façon répétée → s'arrêter et expliquer, ne pas boucler.

---

## 11. Environnement d'exécution

Les commandes `make` tournent dans le **conteneur Docker de développement**. Pour qu'elles fonctionnent :

```bash
make dev    # démarre les conteneurs (à faire une fois)
```

Services disponibles : `app` (3000), `mysql` (3306), `phpmyadmin` (8080), `mailpit` (8025).

Voir `docs/<version>/installation.md` pour les détails.

---

## 12. Références rapides

- `docs/README.md` — index des versions de documentation
- `docs/<version>/architecture.md` — architecture de la version
- `docs/<version>/base-de-donnees.md` — modèle de données
- `docs/<version>/installation.md` — installation et déploiement
- `docs/<version>/api/` — référence API
- `docs/<version>/features/` — spécifications par feature
- `docs/<version>/guide-utilisateur/` — guide utilisateur
- `Makefile` — commandes principales
