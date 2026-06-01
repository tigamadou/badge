# Instructions pour les outils IA — Badge (spécificités projet)

> Ce fichier contient **uniquement les spécificités du projet Badge**. La **méthode générique** (process, décomposition en agents, règles d'écriture, workflow git, gestion des plans/specs, blocage) vit dans `.claude/CLAUDE.md` — un template destiné à être externalisé dans un repo personnel. Les outils IA doivent lire **les deux fichiers** : le template (méthode) et celui-ci (spécificités).

> **Activation du template** : Claude Code ne charge **pas automatiquement** `.claude/CLAUDE.md` (il ne lit que le `CLAUDE.md` racine et `~/.claude/CLAUDE.md` global). Pour activer la méthode dans Claude Code, soit symlinker `~/.claude/CLAUDE.md` vers `.claude/CLAUDE.md`, soit copier son contenu dans `~/.claude/CLAUDE.md`. Pour Cursor et AGENTS.md (qui pointent vers ce `CLAUDE.md` racine), il faudra adapter leur config pour inclure aussi le template.

> `AGENTS.md` et `.cursor/rules/project.mdc` pointent vers ce fichier. Toute modification se fait ici.

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Runtime | Node.js 22+ |
| UI | React 19 + Tailwind CSS 4 |
| Langage | TypeScript 5 |
| ORM | Prisma 6 |
| BDD | MySQL 8 |
| Auth | NextAuth.js (Credentials, JWT) |
| PDF | @react-pdf/renderer 4 |
| QR Code | qrcode + html5-qrcode |
| Email | nodemailer |
| Hash mot de passe | bcryptjs (12 rounds) |
| CAPTCHA | react-google-recaptcha v3 |
| Tests | Vitest 4 |
| Package manager | Yarn via Corepack |
| Conteneurs | Docker (dev + prod), reverse proxy Caddy |

---

## Versionnement de la documentation

Le projet est **versionné**. Voir `docs/README.md` pour la convention, les statuts (Production / En construction / Archivée) et les règles multi-versions. Si la version active n'est pas explicite dans la demande, **demander avant de coder**.

Versions actuelles :
- **v1** — Production (déployée)
- **v2** — En construction (refonte SaaS multi-organisation)
- **v3** — En conception (extension v2 : politique de tests + CI, stockage S3, déploiement Kamal — chantiers post-MVP)

---

## Sources de vérité (par sujet)

| Sujet | Source |
|-------|--------|
| Index doc versionnée | `docs/README.md` |
| Architecture, RBAC, garde-fous métier de la version active | `docs/<version>/architecture.md` |
| Modèle de données | `prisma/schema.prisma` (autorité finale, partagé entre versions) |
| Routes API | `docs/<version>/api/` + lecture directe de `src/app/api/` |
| Spécifications par feature | `docs/<version>/features/<nom>.md` |
| Installation, environnement, commandes | `docs/<version>/installation.md` (ou `features/deploiement-*.md` pour v2) |
| Specs (ADR — capture du *pourquoi*) | `docs/<version>/specs/` |
| Plans d'implémentation (tracker en tête) | `docs/<version>/plans/` |
| Guide utilisateur | `docs/<version>/guide-utilisateur/` |

**En cas de conflit doc ↔ code → le code fait foi**, et il faut mettre à jour la doc dans le même changement.

---

## Helpers réutilisables (`src/lib/`)

Avant d'introduire un nouveau helper, chercher dans `src/lib/` :

- **`auth.ts`** — helpers d'autorisation :
  - v2 : `requireStaff`, `requireOrgRole`, `requireEventRole`, `requireEventPermission`, `getEffectiveEventRoles`, `loadUserContext`, `assertNotLastOwner`, `assertNotLastSuperAdmin`
  - v1 : `checkRole(userRole, requiredRole)`
- **`activity-log.ts`** — audit via `logActivity({ type, userId?, targetId?, orgId?, eventId?, details?, req? })`. Tout nouveau type d'action → ajouter un `ActivityType` au schéma Prisma.
- **`mail.ts`** — envoi d'emails. v2 : `resolveTransporter(ctx)` utilise un SMTP **plateforme uniquement** (`getPlatformSmtp()`, pas de cascade — décision 2026-05-31, voir `docs/v2/features/notifications-email.md`). Le **branding** reste contextuel : `fromLabel`, `logoUrl`, `contactEmail`/`contactPhone` sont résolus en cascade `Event → Org`. v1 mono-event.
- **`settings.ts`** (v2) — `resolveSettings(eventId?, orgId?)` cascade `Event → Org` pour `contactEmail` / `contactPhone` uniquement (premier non-null gagne, pas de fallback Platform). Le SMTP et le reCAPTCHA ne sont **pas** cascadés : lecture directe via `getPlatformSmtp()` / `getPlatformRecaptcha()` (avec secret) / `getPlatformPublicRecaptcha()` (sans secret, pour les Server Components publics). `resolveBadgeTemplateId(event, organization, platformSettings)` cascade `Event → Org → Platform` pour le template de badge.
- **`prisma.ts`** — client Prisma singleton.
- **`storage.ts`** — abstraction upload/get/delete fichiers (local d'abord, S3 plus tard).
- **`qrcode.ts`**, **`generate-id.ts`**, **`format-badge-name.ts`**, **`format-date.ts`**, **`image-to-dataurl.ts`** — utilitaires divers.

---

## Règles d'écriture spécifiques

- **Server Components par défaut** ; ajouter `"use client"` uniquement quand l'interactivité l'exige.
- **Toute action sensible doit logger** via `logActivity()` (`src/lib/activity-log.ts`).
- **Toute route API doit vérifier le rôle/permission** via les helpers de `src/lib/auth.ts` avant l'action.
- **Ne jamais exposer dans une réponse API** : hash bcrypt, `smtpPassword`, `recaptchaSecretKey`, tokens d'invitation ou d'édition non hashés.

---

## Conventions de langue

| Type de contenu | Langue | Accents |
|-----------------|--------|---------|
| UI, emails, messages d'erreur utilisateur | Français | Oui (é, è, à, ç, î, …) |
| Documentation technique (`docs/`, README) | Français | Suivre le style existant du fichier |
| Code, identifiants, types, fonctions, variables | Anglais | — |
| Commentaires de code | Français | Suivre le style existant du fichier |
| Noms de fichiers, branches, commits | ASCII | Non |

---

## Garde-fous métier

- **Mot de passe** : bcryptjs avec **12 rounds**, longueur minimale **6 caractères**.
- **Uploads** : taille max **5 Mo**, types **JPEG / PNG / WebP / PDF** uniquement.
- **Soft delete partout** (`archived: bool` + `archivedAt: DateTime?`). Hard delete = action staff explicite.
- **RBAC — séparation des rôles (v1 uniquement)** : en **v1**, `SUPER_ADMIN` n'a **pas** le droit d'approuver, rejeter, supprimer une inscription ni d'imprimer un badge. **En v2**, cette restriction n'existe plus : `SUPER_ADMIN` est au sommet de `StaffRole` (`SUPER_ADMIN > STAFF_ADMIN > STAFF_SUPPORT > STAFF_OBSERVER`) avec tous les droits sans restriction, y compris les actions métier (avec audit `staffActor=true`). Voir `docs/v2/features/multi-tenancy-rbac.md`.
- **Rendu PDF des badges** : utilise Montserrat via Google Fonts (`https://fonts.googleapis.com/`) — préserver l'accès sortant à ce domaine.

---

## Workflow Git — valeurs projet

- **Branche principale** : `development`
- **Avant tout commit** : `make lint && make typecheck && make test`
- Messages de commit en **français ASCII**, style conventional commits.

Le reste des règles git (pas d'initiative de commit, pas de co-auteur IA, interdits) vit dans `CLAUDE.template.md`.

---

## Environnement d'exécution

Les commandes `make` tournent dans le **conteneur Docker de développement**. Pour qu'elles fonctionnent :

```bash
make dev    # démarre les conteneurs (à faire une fois)
```

Services disponibles :

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Next.js avec hot reload |
| `mysql` | 3306 | Base de données |
| `phpmyadmin` | 8080 | Interface admin BDD |
| `mailpit` | 8025 | Capture d'emails |

Commandes principales :

| Commande | Description |
|----------|-------------|
| `make lint` / `make typecheck` / `make test` | Vérifications avant commit |
| `make dev` / `make dev-down` / `make logs` | Cycle dev local |
| `make db-push` / `make db-seed` / `make db-studio` | Schéma Prisma + seed + Prisma Studio |
| `make db-reset` | **Reset BDD dev (destructif — demander avant)** |

Voir `docs/<version>/installation.md` pour la liste complète.

---

## Actions à risque — toujours demander avant

- `make prod-db-reset`, `make db-reset`, toute commande avec `--force-reset`
- Suppression de fichiers dans `uploads/`
- Modification de `.env`, `.env.production`, `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`
- Déploiement : `make deploy`, `make upload`
- Toute commande SSH sur le serveur de production
