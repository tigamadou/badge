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
| PDF / rendu | `@tigamadou/pdf-engine` 2 (HTML) + service de rendu Chromium (`ghcr.io/tigamadou/pdf-engine-renderer`) |
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

- **`auth-guards.ts`** / **`auth-participant.ts`** — autorisation par **permission** : `requirePermission`, `requireParticipantPermission` (participant), `loadPermissions`, `loadMemberPermissions` (et `hasPermission`, `effectivePermissions` de `permissions/`) ; wrappers de routes `withStaffAuth` / `withOrgAuth` / `withEventAuth` (option `permission` : une clé ou une liste « au moins une ») ; `loadUserContext` ; garde-fous `assertNotLastOwner`, `assertNotLastSuperAdmin`. Plus de helper par niveau hiérarchique (`minRole`, `requireOrgRole`…).
- **`permissions/**`** — catalogue des permissions, rôles système, résolution par cible (`resolve.ts`), libellés ; `src/lib/role-management/**` — rôles personnalisés et ajustements.
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
- **Toute route API doit vérifier la permission** via les wrappers et gardes de `src/lib/auth-guards.ts` avant l'action.
- **Ne jamais exposer dans une réponse API** : hash bcrypt, `smtpPassword`, `recaptchaSecretKey`, tokens d'invitation ou d'édition non hashés.

---

## Documentation des pages

Chaque page des espaces connectés (`/platform`, `/org/[orgId]`, `/event/[eventId]`, `/account`)
a une doc dans `src/content/page-docs/<espace>/<chemin>.md`, affichée par le bouton « ? » et
dans la section Documentation de l'espace. **Tu la tiens à jour dans le même changement que le
code.**

**Quand**
- Tu modifies une page, ou un composant qu'elle utilise (`src/app/**`, `src/components/**`) :
  mets sa doc à jour (option ajoutée, retirée ou modifiée, comportement changé).
- Nouvelle page → nouvelle doc. Page supprimée → doc supprimée.
- Refactor sans effet visible : ne change pas le texte, re-tamponne seulement.

**Comment**
1. Lis la page et ses composants (`make docs-check` liste les docs manquantes, obsolètes et
   orphelines, avec le chemin attendu du fichier et les sources).
2. Rédige ou corrige le corps du fichier ; ne touche jamais à la main `sources`, `sourceHash`,
   `updatedAt` ni aux fichiers `*.generated.ts`.
3. `make docs-stamp PAGES="<id> …"` (id de doc, route, espace ou `all`).
4. `make docs-check` doit être vert avant tout commit.

**Format** : frontmatter `route`, `title`, `audience` (`organisateur` | `staff` |
`participant`), `access` (clé de permission exigée par la garde de la page, si elle en a une),
puis le corps :
- « À quoi sert cet écran » ;
- une section par bloc de l'écran, avec chaque option expliquée (effet, valeur par défaut,
  contraintes, conséquences) ;
- « Questions fréquentes » seulement si utile.
- Une section qui n'a de sens qu'avec une permission se place entre `:::permission <clé>` et
  `:::` (clé du catalogue `src/lib/permissions/catalog.ts`, de la **portée de l'espace** :
  `/platform` (y compris `/platform/organizations/[orgId]/…`) → clés PLATFORM ; `/org` → ORG ;
  `/event` → EVENT ; `/account` → PARTICIPANT ; pas de blocs imbriqués). Un bloc n'est justifié que si
  l'écran masque réellement la section sans la permission (vérifie la condition d'affichage dans le
  code) ; sinon décris le droit en texte. Une page sans garde de permission n'a pas de `access`.

**Rédaction** : français avec accents, vouvoiement, ton du guide utilisateur ; public =
organisateurs et staff ; n'explique que ce que l'écran montre, avec les libellés exacts de
l'interface ; ne rien inventer ; jamais de secret, de jeton, ni de donnée personnelle réelle
(exemples fictifs seulement).

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
- **RBAC** : en **v1**, `SUPER_ADMIN` n'a **pas** le droit d'approuver, rejeter, supprimer une inscription ni d'imprimer un badge. **À partir de la v2 (v4 : modèle rôles + permissions, spec 37)**, tout passe par des permissions du catalogue ; `SUPER_ADMIN` détient toutes les permissions plateforme, organisation et évènement (audit `staffActor=true` pour les actions métier). Voir `docs/v4/features/roles-permissions.md`.
- **Rendu des badges** : le moteur `@tigamadou/pdf-engine` rend un badge en HTML ; le PDF, le document figé de l'aperçu et l'épreuve `proof.png` sont produits par le **service de rendu** (`renderer`, jamais exposé, réseau interne sans accès sortant), dont le tag d'image est égal à la version exacte du moteur. Montserrat est embarquée dans le moteur : plus d'accès sortant à Google Fonts requis. Un paquet de template peut embarquer ses propres polices (TTF/OTF), enregistrées sous une famille préfixée par template. Les images d'un paquet sont limitées à **JPEG et PNG** : le moteur ne lit pas le WebP, pourtant accepté ailleurs pour les uploads. Un document de badge de plus de 20 Mo est refusé avant l'appel. Voir `docs/v4/features/templates-badges.md` et `DEPLOYMENT.md`.

---

## Règles de test (tous les tests, présents et futurs)

Ces règles s'appliquent à **tout nouveau test** écrit dans le projet, quel que soit le plan ou
la tâche.

- **Base de test dédiée** : Vitest tourne sur une base dont le nom finit par `_test`
  (`badge_test` ; `badge_<lot>_test` pour un agent), jamais sur une base de dev. `make test`
  crée et met au schéma cette base (`make test-db`). Un garde-fou dans `src/test-setup.ts` refuse
  toute autre base.
- **Pas de mock de la base ni de Prisma** : les tests d'intégration utilisent le vrai MySQL
  (verrous, `SKIP LOCKED`, contraintes d'unicité, transactions, cascades). Seuls les services
  externes se mockent (FedaPay, SMTP réel, renderer via `fakeExporter`, session NextAuth).
- **Fabriques de données** : préparer les données avec `src/test/factories.ts`
  (`@faker-js/faker`, écriture dans la vraie base de test, graine fixée par fichier). Ajouter une
  fabrique plutôt que dupliquer des `prisma.*.create` dans les tests.
- **Ne jamais modifier le code de production pour faire passer un test** ou atteindre la
  couverture : s'arrêter et demander.
- **Couverture** : 100 % sur `src/lib/**` et `src/app/api/**` (gate dans `vitest.config.ts`).
- **e2e** (Playwright) : contre l'app en cours d'exécution, avec leurs propres fixtures
  préfixées et nettoyées (`e2e/helpers/db.ts`).

---

## Chantiers (features multi-zones)

Tout chantier non trivial (plusieurs zones du code ou plus d'une session) suit le skill projet
**`chantier`** (`.claude/skills/chantier/SKILL.md`) : une fois la spec validée, découpage en socle,
lots parallèles à fichiers exclusifs (3 au maximum) et fusion ; plans rédigés en parallèle par des
sous-agents ; puis, après accord de l'utilisateur, une tâche planifiée d'orchestration
(`.claude/skills/chantier/orchestrator-template.md`) qui fait tourner chaque lot dans son propre
environnement d'agent (`scripts/agent-stack.sh`), en respectant les règles de test ci-dessus.

---

## Workflow Git — valeurs projet

- **Branche principale** : `development`
- **Avant tout commit** : `make lint && make typecheck && make test` ; `make docs-check` (inclus dans `make lint`) pour les docs des pages
- Messages de commit en **français ASCII**, style conventional commits.

Le reste des règles git (pas d'initiative de commit, pas de co-auteur IA, interdits) vit dans `CLAUDE.template.md`.

---

## Environnement d'exécution

Les commandes `make` tournent dans le **conteneur Docker de développement**. Pour qu'elles fonctionnent :

```bash
make dev    # démarre les conteneurs (à faire une fois)
```

Services disponibles :

| Service | Port direct | URL via Caddy (HTTPS) | Description |
|---------|-------------|-----------------------|-------------|
| `app` | 3785 | `https://badge.local` | Next.js avec hot reload |
| `mysql` | 33060 | — | Base de données |
| `phpmyadmin` | 8080 | `https://pma.badge.local` | Interface admin BDD |
| `mailpit` | 8025 | `https://mail.badge.local` | Capture d'emails |
| `rustfs` | 9001 | `https://s3.badge.local` | Console RustFS (stockage S3) |
| `renderer` | — (jamais publié) | — | Service de rendu des badges (Chromium, image linux/amd64, réseau interne `rendu`) |
| `caddy` | 80 / 443 | — | Reverse proxy dev (sous-domaines `*.badge.local`, `tls internal`) |

> **Pré-requis pour les URL `*.badge.local`** : lancer `make dev-https` une fois (renseigne `/etc/hosts` et approuve la CA locale de Caddy — voir `docs/v4/installation.md`). Les ports directs (`localhost:3785`, `localhost:8080`, `localhost:8025`) restent disponibles en parallèle.

Commandes principales :

| Commande | Description |
|----------|-------------|
| `make init` | Initialisation d'un poste neuf : prérequis, `NPM_TOKEN`, build, schéma, seed, HTTPS local |
| `make lint` / `make typecheck` / `make test` | Vérifications avant commit |
| `make test-db` | Crée et met au schéma la base de test (`badge_test`) ; appelé par `make test` |
| `scripts/agent-stack.sh up\|down\|status` | Stack légère d'un sous-agent (worktree, app, worker, Mailpit) ; voir `docs/v4/installation.md` |
| `make dev` / `make dev-down` / `make logs` | Cycle dev local |
| `make dev-https` / `make dev-https-check` | HTTPS local : `/etc/hosts` + confiance CA Caddy (idempotent) |
| `make db-push` / `make db-seed` / `make db-studio` | Schéma Prisma + seed + Prisma Studio |
| `make db-reset` | **Reset BDD dev (destructif — demander avant)** |

Voir `docs/<version>/installation.md` pour la liste complète.

---

## Actions à risque — toujours demander avant

- `make prod-db-reset`, `make db-reset`, `make db-drop-agent`, toute commande avec `--force-reset`
- Suppression de fichiers dans `uploads/`
- Modification de `.env`, `.env.production`, `Caddyfile`, `docker-compose*.yml`, `Dockerfile*`
- Déploiement : publication d'une release ou pre-release GitHub (déclenche `.github/workflows/deploy.yml`)
- Toute commande SSH sur le serveur de production
